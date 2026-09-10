/**
 * Servicio de Sign Request (solicitud de firma).
 *
 * Maneja:
 * - create: crea una solicitud con PDF congelado, token_hash, ID.
 * - getById: consulta por id.
 * - getByIdSolicitud: consulta por id_solicitud (SIGN-YYYY-NNNNNN).
 * - getByTokenHash: consulta por token_hash (validación al recibir token).
 * - list: lista con filtros.
 * - registerEvent: registra un evento (helper para otros services).
 *
 * Ver DATA_MODEL.md §3.3 (tabla gh_firmas_electronicas) y
 * DATA_MODEL.md §3.5 (tabla gh_firma_sesiones).
 * Ver API.md §6.1, §6.2, §6.8.
 *
 * IMPORTANTE: este service NO firma documentos. Solo crea y
 * gestiona el ciclo de vida de la solicitud.
 */
'use strict';

const db = require('../db/connection');
const config = require('../config');
const { sha256, generateSalt, hashWithSalt } = require('../crypto/hash');
const { generateToken, hashToken, generateIdSolicitud } = require('../crypto/token');
const storage = require('./storage');
const agreementService = require('./agreement');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const crypto = require('crypto');

// =============================================================================
// I-013b (C-22): cifrado del token para recuperación.
// =============================================================================
// El token se retorna en plaintext SOLO en la respuesta de create(). Después
// se almacena hasheado (token_hash) en BD. Para permitir que K+AIR recupere
// el token si perdió la respuesta de create, se cifra con AES-256-GCM y se
// guarda en `metadata._server_metadata.token_encrypted` (sub-objeto con
// prefijo underscore para evitar colisión con campos que K+AIR pueda poner
// en metadata al hacer POST).
//
// La key de cifrado se lee de `TOKEN_ENCRYPTION_KEY` (32 bytes hex = 64 chars).
// Si NO está seteada, se genera una al boot y se loguea warning (solo dev).
// En prod, se requiere la env var — falla al boot si no está.
//
// Ver docs/kair-firma-integration/READY-TO-IMPLEMENT.md §C.I-013b.
let _tokenEncryptionKey = null;
function _getTokenEncryptionKey() {
  if (_tokenEncryptionKey) return _tokenEncryptionKey;
  const fromEnv = process.env.TOKEN_ENCRYPTION_KEY;
  if (typeof fromEnv === 'string' && /^[0-9a-fA-F]{64}$/.test(fromEnv)) {
    _tokenEncryptionKey = Buffer.from(fromEnv, 'hex');
    return _tokenEncryptionKey;
  }
  if (config.env === 'production') {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY requerida en producción (32 bytes hex = 64 chars). ' +
      'Generar con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  // Dev: generar y loguear warning para que el operador sepa.
  _tokenEncryptionKey = crypto.randomBytes(32);
  logger.warn('TOKEN_ENCRYPTION_KEY no seteada, usando key efímera (solo dev)', {
    hint: 'Setea TOKEN_ENCRYPTION_KEY en .env para que el cifrado persista entre reinicios',
  });
  return _tokenEncryptionKey;
}

/**
 * Cifra un token con AES-256-GCM y retorna {iv, authTag, ciphertext} en hex.
 * El output es un objeto plain que se serializa a JSON dentro de metadata.
 */
function encryptToken(token) {
  const key = _getTokenEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

/**
 * Descifra un token previamente cifrado con encryptToken().
 * Lanza Error si la estructura es inválida o la autenticación GCM falla.
 */
function decryptToken(enc) {
  if (!enc || typeof enc !== 'object') throw new Error('encrypted token inválido');
  const { iv, authTag, ciphertext } = enc;
  if (typeof iv !== 'string' || typeof authTag !== 'string' || typeof ciphertext !== 'string') {
    throw new Error('encrypted token: campos faltantes');
  }
  const key = _getTokenEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', key,
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}

/**
 * Resetea la key cacheada (usado en tests para inyectar una key nueva).
 */
function _resetTokenEncryptionKey() {
  _tokenEncryptionKey = null;
}

/**
 * Lee el token cifrado de un sign request (I-013b, recovery).
 *
 * Retorna { found: true, token, url_publica } si el sign request tiene
 * `metadata._server_metadata.token_encrypted` y se puede descifrar.
 * Retorna { found: false, reason } si no hay token cifrado (legacy
 * pre-I-013b) o si el descifrado falla (corrupción, key rotada).
 *
 * El handler HTTP es responsable de aplicar el cross-company check y el
 * check de estado terminal ANTES de llamar esta función.
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas (de getById o getByIdSolicitud).
 * @returns {{found: true, token: string, url_publica: string} | {found: false, reason: string}}
 */
function getTokenForRecovery(signRequest) {
  if (!signRequest || !signRequest.id_solicitud) {
    return { found: false, reason: 'invalid_signrequest' };
  }
  if (!signRequest.metadata) {
    return { found: false, reason: 'legacy_no_token_recovery' };
  }
  let parsed;
  try {
    parsed = JSON.parse(signRequest.metadata);
  } catch {
    return { found: false, reason: 'corrupt_metadata' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { found: false, reason: 'corrupt_metadata' };
  }
  const serverMeta = parsed._server_metadata;
  if (!serverMeta || typeof serverMeta !== 'object' || !serverMeta.token_encrypted) {
    return { found: false, reason: 'legacy_no_token_recovery' };
  }
  let token;
  try {
    token = decryptToken(serverMeta.token_encrypted);
  } catch (e) {
    logger.warn('I-013b: descifrado de token falló', {
      id_solicitud: signRequest.id_solicitud,
      error: e.message,
    });
    return { found: false, reason: 'decrypt_failed' };
  }
  return {
    found: true,
    token,
    url_publica: `${config.publicUrl}/s/${token}`,
  };
}

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_MAGIC = Buffer.from('%PDF-');

// I-103.A1.5.1 · Importar mailer localmente (lazy para evitar ciclos en
// tests que mockean storage antes que mailer). El require vive dentro de
// notifyRemote(), no a nivel de módulo, para no crear dependencia circular
// si mailer.js en el futuro importa algo de signRequest.js.

/**
 * Máscara determinística de un correo para logging seguro.
 *
 * `ab***@cd.com` (4 chars visibles a la izquierda, dominio completo).
 * El logger del proyecto YA redacta `correo`/`email` por nombre de campo
 * (SENSITIVE_KEYS en utils/logger.js) — esto es redundancia explícita para
 * los eventos de auditoría que se persisten en gh_firma_eventos.metadata
 * (donde el campo NO se llama `correo` y podría bypasear la redacción por
 * nombre de campo del logger runtime, pero la query SELECT del audit sí
 * lo vería).
 */
function _maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '[INVALID_EMAIL]';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '[INVALID_EMAIL]';
  const visible = local.slice(0, Math.min(2, local.length));
  const stars = '*'.repeat(Math.max(0, local.length - visible.length));
  return `${visible}${stars}@${domain}`;
}

/**
 * I-103.A1.5.1 · Envía (o re-envía) la invitación de firma al correo del firmante.
 *
 * Es el "primer contacto" con el firmante. La URL se reconstruye a partir
 * del token cifrado en metadata._server_metadata.token_encrypted (mismo
 * mecanismo que /link, I-013b). NO genera ni envía OTP — el OTP se
 * genera en publicFlow.identify() cuando el firmante abre la URL.
 *
 * Auditoría: registra evento INVITE_SENT con metadata que incluye
 * `correo_destino_enmascarado` (no plaintext), `messageId`, contexto del
 * request. Si la auditoría falla, se loguea WARN pero el envío se considera
 * exitoso (la invitación YA salió).
 *
 * Side effects:
 *   - Llama mailer.sendInvite() (dev mode: jsonTransport, prod: SMTP real)
 *   - INSERT en gh_firma_eventos (evento=INVITE_SENT, actor=`rh:<prefix>` o sistema)
 *
 * Errores:
 *   - 410 INVITE_NOT_AVAILABLE: sign request sin token cifrado (legacy pre-I-013b)
 *   - 410 INVITE_NOT_AVAILABLE: estado terminal (SIGNED/REJECTED/REVOKED/EXPIRED/CANCELLED)
 *   - 502 INVITE_EMAIL_FAILED: mailer lanzó (SMTP caído, red, etc.)
 *
 * Pre-condiciones (validadas por el handler ANTES de llamar):
 *   - signRequest existe y pertenece a la empresa autenticada
 *   - signRequest NO está en estado terminal
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas (de getById o getByIdSolicitud)
 * @param {string} correo - correo destino del firmante
 * @param {object} [opts]
 * @param {string} [opts.actor] - actor que dispara el envío (default 'sistema')
 * @param {string} [opts.ip] - IP del caller (para auditoría)
 * @param {string} [opts.user_agent] - User-Agent del caller (para auditoría)
 * @param {object} [opts.context] - metadata libre para el evento
 * @returns {Promise<{ok: true, messageId: string, sent_at: string, evento_id?: number}>}
 */
async function notifyRemote(signRequest, correo, opts = {}) {
  if (!signRequest || !signRequest.id_solicitud) {
    throw new AppError(500, 'INTERNAL_ERROR', 'signRequest inválido en notifyRemote');
  }
  if (typeof correo !== 'string' || !correo.includes('@') || correo.length > 254) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'correo inválido');
  }

  // 1) Recuperar el token cifrado (mismo helper que /link).
  const recovery = getTokenForRecovery(signRequest);
  if (!recovery.found) {
    throw new AppError(410, 'INVITE_NOT_AVAILABLE',
      'No se puede recuperar el link para enviar la invitación',
      { reason: recovery.reason });
  }

  // 2) Enviar el correo vía mailer.
  const mailer = require('./mailer');
  let sendResult;
  try {
    sendResult = await mailer.sendInvite({
      to: correo,
      url_publica: recovery.url_publica,
      id_solicitud: signRequest.id_solicitud,
      context: opts.context || null,
    });
  } catch (e) {
    logger.error('notifyRemote: mailer.sendInvite falló', {
      id_solicitud: signRequest.id_solicitud,
      error: e.message,
      code: e.code || 'SEND_ERROR',
    });
    throw new AppError(502, 'INVITE_EMAIL_FAILED',
      'No se pudo enviar la invitación por correo',
      { reason: 'smtp_failure', upstream_error: e.message });
  }

  const sent_at = new Date().toISOString();

  // 3) Auditoría: registrar evento INVITE_SENT (best-effort — si falla,
  // la invitación YA salió, se loguea WARN).
  let evento_id;
  try {
    registerEvent(
      signRequest.id,
      'INVITE_SENT',
      {
        // PII segura: el correo se enmascara antes de persistir.
        correo_destino_enmascarado: _maskEmail(correo),
        messageId: sendResult.messageId,
        canal: 'email',
        context: opts.context || undefined,
      },
      opts.actor || 'sistema',
      opts.ip || null,
      opts.user_agent || null,
    );
    // Obtener el id del evento recién insertado (lastInsertRowid sobre la
    // misma tabla). registerEvent no retorna el id, pero como acabamos de
    // insertar, podemos leerlo de la conexión.
    const evtRow = db.prepare(`
      SELECT id FROM gh_firma_eventos
      WHERE firma_id = ? AND evento = 'INVITE_SENT'
      ORDER BY id DESC LIMIT 1
    `).get(signRequest.id);
    evento_id = evtRow ? evtRow.id : undefined;
  } catch (auditErr) {
    logger.warn('notifyRemote: auditoría INVITE_SENT falló (invitación ya enviada)', {
      id_solicitud: signRequest.id_solicitud,
      messageId: sendResult.messageId,
      audit_error: auditErr.message,
    });
    // No relanzamos — el envío fue exitoso.
  }

  logger.info('Invitación enviada', {
    id_solicitud: signRequest.id_solicitud,
    // PII: el logger redacta `correo` por nombre, pero acá usamos
    // explícitamente el campo renombrado para que el dato persistido en
    // log sea siempre enmascarado.
    correo_destino_enmascarado: _maskEmail(correo),
    messageId: sendResult.messageId,
    evento_id,
  });

  return {
    ok: true,
    messageId: sendResult.messageId,
    sent_at,
    evento_id,
  };
}

/**
 * Tipos válidos de documento que se firma (categoría legal/administrativa).
 *
 * Es la categoría del DOCUMENTO QUE SE FIRMA, NO del documento de
 * identificación del firmante (eso es `identificacion_tipo`: CC, CE, TI, etc.).
 *
 * Decisión D-1 (aprobada): la palabra `tipo_documento` se reemplaza por
 * `tipo_identificacion` en todo el código y esquema. La columna
 * `gh_firmas_electronicas.tipo_identificacion` (migration 007) usa estos
 * valores.
 *
 * Validación:
 *   - zod schema (src/schemas/index.js) lo usa como enum en la frontera HTTP.
 *   - Este service re-valida en create() para defenderse de bypass (e.g. tests
 *     que llaman signRequestService.create() directamente, o un futuro caller
 *     interno que no pase por HTTP).
 *   - BD NO tiene CHECK ni dominio (consistente con agreement_version,
 *     consent_id, id_constancia).
 *
 * Sub-tipo (D-2): string libre en `metadata.subtipo_identificacion` (e.g.
 * 'autorizacion_datos', 'contrato_fijo'). NO se valida acá.
 *
 * @type {readonly ['CONTRATO', 'OTROSI', 'ACTA', 'CONSENTIMIENTO', 'AUTORIZACION', 'REGLAMENTO', 'POLITICA', 'CERTIFICADO', 'FORMATO', 'OTRO']}
 */
const TIPOS_IDENTIFICACION = Object.freeze([
  'CONTRATO',
  'OTROSI',
  'ACTA',
  'CONSENTIMIENTO',
  'AUTORIZACION',
  'REGLAMENTO',
  'POLITICA',
  'CERTIFICADO',
  'FORMATO',
  'OTRO',
]);

/**
 * Crea una nueva solicitud de firma.
 *
 * @param {object} opts
 * @param {string} opts.id_documento
 * @param {string} opts.id_trabajador
 * @param {string} opts.id_empresa
 * @param {string} opts.tipo_firma - 'presencial' | 'remoto'
 * @param {string} opts.agreement_version - Versión del Acuerdo (ej. 'v1.0')
 * @param {string} opts.agreement_hash - SHA-256 del Acuerdo
 * @param {string} opts.document_hash - SHA-256 declarado por K+AIR
 * @param {Buffer} opts.pdf_buffer - Bytes del PDF
 * @param {string} opts.pdf_filename - Nombre del archivo (opcional)
 * @param {string} opts.version_kair
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.metadata] - JSON string
 * @param {string} [opts.tipo_identificacion] - Categoría del documento que
 *        se firma (CONTRATO, OTROSI, ACTA, etc.). DISTINTO de
 *        `identificacion_tipo` (CC, CE, TI, PPT, PA) que es el tipo de
 *        documento de identificación del firmante. Ver TIPOS_IDENTIFICACION.
 *        Opcional en v1: si no se envía, queda NULL (sign requests legacy
 *        pre-migration 007).
 * @param {number} [opts.consent_id] - id de gh_consentimientos_firma (Bloque E6).
 *        Se persiste en la fila; la validación contra manifestacion_aceptada
 *        y (id_trabajador, id_empresa, agreement_version) se hace en
 *        commit() (services/publicFlow.js#validateConsentForCommit).
 * @returns {{signRequest: object, token: string, url_publica: string}}
 */
function create({
  id_documento, id_trabajador, id_empresa, tipo_firma,
  agreement_version, agreement_hash, document_hash, pdf_buffer, pdf_filename,
  version_kair, ip, user_agent, metadata,
  identificacion_tipo, identificacion_numero_hash,
  identificacion_numero_sal,  // P1-2: opcional, server genera si falta
  tipo_identificacion,  // I-002: categoría del doc que se firma (CONTRATO, OTROSI, etc.)
  consent_id,
  correo_verificacion,  // I-103.A1.6.C · RF-FIRMA-CORREO-01
  requiere_firma_empresa,        // I-FIRMA-DUAL: opt-in para firma de empresa (v0.1.180)
  representante_legal_snapshot,  // I-FIRMA-DUAL: snapshot del representante legal al crear el padre
}) {
  // Validar PDF
  if (!Buffer.isBuffer(pdf_buffer)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'pdf_buffer debe ser un Buffer');
  }
  if (pdf_buffer.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'PDF vacío');
  }
  if (pdf_buffer.length > MAX_PDF_SIZE) {
    throw new AppError(413, 'INVALID_REQUEST_BODY',
      `PDF demasiado grande (${pdf_buffer.length} bytes, máximo ${MAX_PDF_SIZE})`);
  }
  // Verificar magic bytes (los PDFs empiezan con %PDF-)
  if (!pdf_buffer.slice(0, 5).equals(PDF_MAGIC)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El archivo no parece ser un PDF válido (faltan magic bytes %PDF-)');
  }

  // Validar que el hash declarado coincida con el calculado
  const calculated_hash = sha256(pdf_buffer);
  if (document_hash && document_hash !== calculated_hash) {
    throw new AppError(422, 'DOCUMENT_HASH_MISMATCH',
      'El hash del PDF no coincide con el declarado',
      { declared: document_hash, calculated: calculated_hash });
  }

  // Validar Acuerdo (Bloque A — agreement_version obligatorio, 5 pasos).
  // Esta validación se hace ANTES de generar token/ID para no consumir IDs
  // en solicitudes inválidas.
  validateAcuerdo(agreement_version, agreement_hash);

  // Validar tipo_identificacion si se proporciona (I-002).
  // Defensa contra bypass de zod (e.g. tests que llaman create() directo).
  // Si no se proporciona, queda NULL (sign requests legacy pre-007 son válidos).
  if (tipo_identificacion != null && !TIPOS_IDENTIFICACION.includes(tipo_identificacion)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      `tipo_identificacion debe ser uno de: ${TIPOS_IDENTIFICACION.join(', ')}`,
      { provided: tipo_identificacion });
  }

  // Generar token y IDs
  const token = generateToken();
  const token_hash = hashToken(token);
  const id_solicitud = generateIdSolicitud();
  const sesion_id = require('crypto').randomUUID();

  // P1-2: sal aleatoria para hashear la cédula del trabajador.
  // Si K+AIR no la envía, sal es NULL (compatibilidad con tests legacy
  // y con sign requests pre-migración 006). identify() usa sha256(raw)
  // como fallback cuando sal es NULL.
  // K+AIR DEBE migrar para enviar sal en nuevos sign requests (ver docs).
  const sal = identificacion_numero_sal || null;

  // TTL
  const ttl_horas = tipo_firma === 'presencial'
    ? config.ttl.tokenHoursPresencial
    : config.ttl.tokenHoursRemote;
  const now = new Date();
  const fecha_expiracion = new Date(now.getTime() + ttl_horas * 3600 * 1000).toISOString();

  // Guardar PDF
  const safe_filename = `${id_solicitud}.pdf`;
  const pdf_original_path = storage.saveOriginal(safe_filename, pdf_buffer);

  // I-013b: cifrar el token para futura recuperación (C-22).
  // Se guarda en `metadata._server_metadata.token_encrypted`. El prefijo
  // underscore es convención: K+AIR no debería pisar esta sub-clave al
  // enviar su propio metadata. Si la pisa, la recuperación se pierde para
  // ese sign request (no es breaking: el sign request sigue funcionando,
  // solo no se puede recuperar el link).
  const tokenEncrypted = encryptToken(token);
  // Merge con metadata del cliente: parseamos el metadata entrante (si es
  // string JSON) y le inyectamos _server_metadata. Si ya viene
  // _server_metadata, lo preservamos.
  let metadataToStore = null;
  if (metadata && typeof metadata === 'string' && metadata.length > 0) {
    try {
      const parsed = JSON.parse(metadata);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Preservar _server_metadata entrante si existe (defensa), pero
        // sobreescribir token_encrypted con el nuestro.
        const serverMeta = (parsed._server_metadata && typeof parsed._server_metadata === 'object')
          ? { ...parsed._server_metadata }
          : {};
        serverMeta.token_encrypted = tokenEncrypted;
        parsed._server_metadata = serverMeta;
        metadataToStore = JSON.stringify(parsed);
      } else {
        // metadata es un primitivo (raro, no debería pasar por zod) → wrappear
        metadataToStore = JSON.stringify({
          value: parsed,
          _server_metadata: { token_encrypted: tokenEncrypted },
        });
      }
    } catch {
      // metadata corrupto (zod no lo aceptaría, pero defensa en profundidad)
      metadataToStore = JSON.stringify({
        _server_metadata: { token_encrypted: tokenEncrypted },
      });
    }
  } else {
    metadataToStore = JSON.stringify({
      _server_metadata: { token_encrypted: tokenEncrypted },
    });
  }

  // I-103.A1.6.C · RF-FIRMA-CORREO-01: hashear el correo del firmante al
  // momento de crear el sign request. Se persiste en
  // gh_firmas_electronicas.correo_verificacion (columna directa) +
  // correo_hash (para búsqueda/comparación sin plaintext).
  // El salt es por sign request (P1-2 patrón).
  // Validación mínima: el string debe contener '@'. Validación completa
  // de email (RFC) la hace zod en el schema de la ruta; acá solo evitamos
  // persistir basura que pase la validación de zod pero no se parezca a email.
  let correo_persisted = null;
  let correo_sal_persisted = null;
  let correo_hash_persisted = null;
  if (typeof correo_verificacion === 'string' && correo_verificacion.includes('@')) {
    correo_persisted = correo_verificacion;
    correo_sal_persisted = generateSalt();
    correo_hash_persisted = hashWithSalt(correo_verificacion, correo_sal_persisted);
  }

  // Insertar en BD + sesión en transacción.
  // Si la tx falla (UNIQUE collision, FK fail, BD busy, etc.), el PDF ya
  // está escrito al disco. Sin cleanup, queda huérfano. Ver E9.2.
  //   - storage.deletePdf() es silencioso: si el archivo no existe, no throw.
  //   - Relanzamos el error original para no cambiar la API pública.
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO gh_firmas_electronicas
        (id_solicitud, id_documento, id_trabajador, id_empresa,
         tipo_firma, document_hash_original, agreement_hash, agreement_version,
         token_hash, sesion_id, identificacion_tipo, identificacion_numero_hash,
         identificacion_numero_sal,  -- P1-2
         fecha_creacion, fecha_expiracion, version_kair,
         ip_origen, user_agent, pdf_original_path, metadata,
         verification_channel, consent_id,
         tipo_identificacion,  -- I-002 (migration 007)
         correo_verificacion, correo_hash,  -- I-103.A1.6.C · RF-FIRMA-CORREO-01
         requiere_firma_empresa, tipo_firmante,  -- I-FIRMA-DUAL (migration 013)
         representante_legal_snapshot)  -- I-FIRMA-DUAL (migration 013)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_solicitud, id_documento, id_trabajador, id_empresa,
      tipo_firma, calculated_hash, agreement_hash, agreement_version,
      token_hash, sesion_id, identificacion_tipo || null, identificacion_numero_hash || null,
      sal,  // P1-2: sal aleatoria por sign request
      now.toISOString(), fecha_expiracion, version_kair,
      ip || null, user_agent || null, pdf_original_path, metadataToStore, 'email',
      consent_id || null,
      tipo_identificacion || null,
      correo_persisted,
      correo_hash_persisted,
      requiere_firma_empresa ? 1 : 0,  // I-FIRMA-DUAL: default 0 (legacy compat)
      'TRABAJADOR',  // I-FIRMA-DUAL: el padre siempre es TRABAJADOR
      representante_legal_snapshot ? JSON.stringify(representante_legal_snapshot) : null,
    );
    const firmaId = result.lastInsertRowid;

    // Crear sesión
    db.prepare(`
      INSERT INTO gh_firma_sesiones
        (id, firma_id, estado_sesion, iniciado_en, ultimo_cambio_en)
      VALUES (?, ?, 'PENDING', ?, ?)
    `).run(sesion_id, firmaId, now.toISOString(), now.toISOString());

    // Registrar evento CREATED
    db.prepare(`
      INSERT INTO gh_firma_eventos
        (firma_id, evento, fecha_hora, ip, user_agent, id_actor, metadata)
      VALUES (?, 'CREATED', ?, ?, ?, ?, ?)
    `).run(
      firmaId, now.toISOString(), ip || null, user_agent || null,
      'rh:system', JSON.stringify({
        id_documento, tipo_firma, ttl_horas, document_hash: calculated_hash,
        agreement_version,
        consent_id: consent_id || null,
        tipo_identificacion: tipo_identificacion || null,  // I-002
      }),
    );

    return firmaId;
  });

  let firmaId;
  try {
    firmaId = tx();
  } catch (txErr) {
    // Cleanup del PDF huérfano. deletePdf es silencioso: si el archivo ya
    // no existe (otra ruta lo borró), no throw. Si el unlink falla por
    // permisos o BD, logueamos pero NO ocultamos el error original.
    const cleaned = storage.deletePdf(pdf_original_path);
    logger.warn('SignRequest: tx BD falló, PDF huérfano cleanup', {
      id_solicitud,
      pdf_original_path,
      cleaned,
      tx_error_code: txErr.code,
      tx_error_message: txErr.message,
    });
    throw txErr;
  }

  // URL pública
  const url_publica = `${config.publicUrl}/s/${token}`;

  logger.info('SignRequest creado', {
    id_solicitud,
    // P1-5: NO loguear id_trabajador (PII: cédula).
    tipo_firma,
    ttl_horas,
    agreement_version,
  });

  const signRequest = getById(firmaId);
  return { signRequest, token, url_publica };
}

/**
 * I-FIRMA-DUAL (v0.1.180) · Crea el sign request HIJO (tipo_firmante='EMPRESA')
 * vinculado a un sign request PADRE mediante parent_id_solicitud.
 *
 * Pre-condiciones (validadas en este orden, ANTES de cualquier INSERT):
 *   1. parent_id_solicitud y representante.correo presentes
 *   2. El padre existe en BD
 *   3. El padre tiene requiere_firma_empresa=1 (opt-in explícito del RH)
 *   4. No existe ya un hijo para este padre (UNIQUE idx_gh_firmas_unico_hijo)
 *   5. El Acuerdo del padre sigue siendo válido (re-validación 5-pasos)
 *
 * El hijo REUSA el PDF original del padre (NO copia el archivo en disco).
 * Esto es por diseño: ambas firmas se aplican al mismo PDF; el padre es la
 * fuente de verdad del documento.
 *
 * El hijo se inserta con:
 *   - tipo_firmante = 'EMPRESA'
 *   - id_trabajador = padre.id_trabajador (el documento es SOBRE ese trabajador;
 *     el firmante es la empresa, no el trabajador. El esquema mantiene
 *     id_trabajador NOT NULL por diseño: el padre es siempre la fuente
 *     de verdad del sujeto del documento)
 *   - parent_id_solicitud = padre.id_solicitud
 *   - requiere_firma_empresa = 0 (el flag es del padre; el hijo lo hereda por contexto)
 *   - representante_legal_snapshot = JSON.stringify(representante) (snapshot inmutable)
 *   - estado = 'PENDING' (default)
 *   - version_kair = padre.version_kair (el mismo flujo K+AIR)
 *
 * NOTA: el objeto JS retornado expone `id_trabajador: null` para que los
 * callers distingan semánticamente "firma de empresa" vs "firma de trabajador"
 * (la DB mantiene el id del trabajador del padre por la restricción NOT NULL).
 *
 * Notificación al representante: fire-and-forget vía notifyRemote (no bloquea
 * la respuesta del create). Si la notificación falla (sync o async), se
 * loguea pero NO se propaga — el hijo ya está persistido y la invitación
 * puede re-enviarse después vía el endpoint /notify.
 *
 * Retorna el objeto del hijo SIN el token en claro (el token solo viaja en
 * el correo de invitación al representante, no en la respuesta HTTP).
 *
 * @param {object} opts
 * @param {string} opts.parent_id_solicitud - id_solicitud del padre (SIGN-YYYY-NNNNNN)
 * @param {string} opts.id_empresa - empresa que firma
 * @param {string} opts.id_documento - id del documento (mismo que el padre)
 * @param {object} opts.representante - snapshot del representante legal
 * @param {string} opts.representante.correo
 * @param {string} opts.representante.nombre
 * @param {string} [opts.representante.tipo_identificacion] - default 'CC'
 * @param {string} [opts.representante.numero_identificacion]
 * @param {string} [opts.representante.cargo]
 * @returns {object} - el hijo creado (sin token en claro)
 * @throws AppError 400 INVALID_REQUEST_BODY si faltan params
 * @throws AppError 404 PARENT_NOT_FOUND si el padre no existe
 * @throws AppError 409 INVALID_STATE si el padre no requiere firma de empresa
 * @throws AppError 409 COMPANY_FIRMA_ALREADY_EXISTS si ya hay un hijo
 * @throws AppError 422 ACUERDO_INVALIDO si el Acuerdo del padre ya no es válido
 */
function createForCompany({ parent_id_solicitud, id_empresa, id_documento, representante }) {
  if (!parent_id_solicitud) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'parent_id_solicitud es requerido');
  }
  if (!representante || !representante.correo) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'representante.correo es requerido');
  }

  // 1. Leer el padre
  //    El hijo YA NO hereda consent_id (consentimiento propio del rep,
  //    vinculado en consentAccept()). Se conserva el SELECT de contexto
  //    para validaciones.
  const padre = db.prepare(`
    SELECT id_solicitud, id_empresa, id_documento, id_trabajador, version_kair,
           pdf_original_path, document_hash_original,
           agreement_version, agreement_hash, requiere_firma_empresa,
           consent_id
    FROM gh_firmas_electronicas
    WHERE id_solicitud = ?
  `).get(parent_id_solicitud);

  if (!padre) {
    throw new AppError(404, 'PARENT_NOT_FOUND', `Sign request padre '${parent_id_solicitud}' no existe`);
  }

  // 2. Validar que requiere firma de empresa
  if (padre.requiere_firma_empresa !== 1) {
    throw new AppError(409, 'INVALID_STATE',
      `El sign request padre no requiere firma de empresa (requiere_firma_empresa=${padre.requiere_firma_empresa})`);
  }

  // 3. Validar que no existe ya un hijo (UNIQUE constraint idx_gh_firmas_unico_hijo).
  //    Pre-check defensivo para devolver un 409 limpio con código semántico
  //    en vez de propagar el error crudo de SQLite ("UNIQUE constraint failed").
  const existingHijo = db.prepare(
    'SELECT id_solicitud FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?'
  ).get(parent_id_solicitud);
  if (existingHijo) {
    throw new AppError(409, 'COMPANY_FIRMA_ALREADY_EXISTS',
      `Ya existe un sign request hijo (${existingHijo.id_solicitud}) para este padre (UNIQUE idx_gh_firmas_unico_hijo)`);
  }

  // 4. Validar Acuerdo del padre (re-validación 5-pasos; misma función que create)
  validateAcuerdo(padre.agreement_version, padre.agreement_hash);

  // 5. Generar token + IDs
  const token = generateToken();
  const token_hash = hashToken(token);
  const id_solicitud = generateIdSolicitud();
  const sesion_id = require('crypto').randomUUID();

  // 6. TTL (mismo que el padre: remote, es firma remota por definición)
  const ttl_horas = config.ttl.tokenHoursRemote;
  const now = new Date();
  const fecha_expiracion = new Date(now.getTime() + ttl_horas * 3600 * 1000).toISOString();

  // 7. Insertar (reusando el PDF original del padre).
  //    metadata contiene el token cifrado para futura recuperación del link
  //    (mismo patrón I-013b que create()).
  const tokenEncrypted = encryptToken(token);
  const metadataToStore = JSON.stringify({
    _server_metadata: {
      token_encrypted: tokenEncrypted,
      parent_id_solicitud,
      tipo_firmante: 'EMPRESA',
    },
  });

  const result = db.prepare(`
    INSERT INTO gh_firmas_electronicas (
      id_solicitud, id_documento, id_empresa, id_trabajador,
      tipo_firma, agreement_version, agreement_hash, document_hash_original,
      pdf_original_path, fecha_creacion, fecha_expiracion, estado,
      token_hash, sesion_id, correo_verificacion, metadata,
      version_kair,
      requiere_firma_empresa, tipo_firmante, parent_id_solicitud,
      representante_legal_snapshot, identificacion_tipo,
      consent_id,  -- I-FIRMA-DUAL consent propio: NULL al crear; se vincula
                    -- el consentimiento PROPIO del rep en consentAccept()
                    -- (antes se heredaba el del trabajador: dato falso en
                    -- constancia). validateForCommit lo exige antes del commit.
      identificacion_numero_hash  -- 📦 v0.1.180 (Task 1.14): pre-poblado del snapshot
    ) VALUES (
      ?, ?, ?, ?,
      'remoto', ?, ?, ?,
      ?, ?, ?, 'PENDING',
      ?, ?, ?, ?,
      ?,
      0, 'EMPRESA', ?,
      ?, ?,
      ?,
      ?
    )
  `).run(
    id_solicitud, id_documento, id_empresa, padre.id_trabajador,
    padre.agreement_version, padre.agreement_hash, padre.document_hash_original,
    padre.pdf_original_path, now.toISOString(), fecha_expiracion,
    token_hash, sesion_id, representante.correo, metadataToStore,
    padre.version_kair,
    parent_id_solicitud,
    JSON.stringify(representante),
    representante.tipo_identificacion || 'CC',
    null, // consent_id NULL: el rep acepta SU consentimiento propio en
           // consentAccept() (antes se heredaba el del trabajador).
    // 📦 v0.1.180 (Task 1.14): hash de la cédula del rep para que
    // publicFlow.identify() pase el precheck de MISSING_IDENTIFICATION_DATA.
    // El rep debe ingresar exactamente este CC en la mini-app. Si RH captura
    // un CC distinto en el snapshot (numero_identificacion), el rep no
    // podrá identificarse — diseño conservador: el rep ES la persona del
    // snapshot, no cualquier persona que sepa la URL.
    representante.numero_identificacion ? sha256(representante.numero_identificacion) : null
  );
  const childId = result.lastInsertRowid;

  // 8. Notificar al representante legal (I-FIRMA-DUAL, v0.1.180).
  //    Se usa `mailer.sendInviteForCompany` (correo DIFERENCIADO al del
  //    worker) en vez de `notifyRemote` (que es el flujo del worker).
  //    El token se recupera del metadata cifrado que acabamos de
  //    persistir (mismo patrón I-013b que `create()` y `notifyRemote`).
  //    Fire-and-forget: la notificación NO bloquea el create. Si la
  //    notificación falla, se loguea error pero el create ya quedó
  //    persistido y se retorna exitosamente al caller.
  //
  //    Se usa una IIFE async + .catch() en vez de await para NO cambiar
  //    la firma de createForCompany a async (mantiene backward compat
  //    con callers que esperan retorno sync).
  const mailer = require('./mailer');
  // Re-leer el signRequest del hijo (ahora tiene el metadata con token cifrado).
  const hijoRow = db.prepare(
    'SELECT id_solicitud, metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  (async () => {
    try {
      const recovery = getTokenForRecovery(hijoRow);
      if (recovery.found) {
        await mailer.sendInviteForCompany({
          to: representante.correo,
          url_publica: recovery.url_publica,
          id_solicitud: id_solicitud,
          id_documento: id_documento,
          rep_nombre: representante.nombre,
          context: { parent_id_solicitud, tipo_firmante: 'EMPRESA' },
        });
        logger.info('firma-dual: invitación enviada al rep', {
          id_solicitud,
          rep_correo: representante.correo,
        });
      } else {
        logger.error('firma-dual: no se pudo recuperar el token para notificar', {
          id_solicitud,
          reason: recovery.reason,
        });
      }
    } catch (err) {
      logger.error('firma-dual: notify falló', {
        id_solicitud,
        error: err.message,
      });
      // No fallar el create por un error de notificación.
    }
  })().catch(err => {
    // Catch final por si la IIFE misma lanza (no debería, pero defensivo).
    logger.error('firma-dual: notify IIFE failed', {
      id_solicitud,
      error: err.message,
    });
  });

  // 9. Retornar el hijo (sin token en claro)
  return {
    id_solicitud,
    id_documento,
    id_empresa,
    id_trabajador: null,
    tipo_firmante: 'EMPRESA',
    parent_id_solicitud,
    correo_verificacion: representante.correo,
    estado: 'PENDING',
    fecha_expiracion,
  };
}

/**
 * Valida que el Acuerdo referenciado por el cliente existe, es la versión
 * activa y vigente, y que el agreement_hash coincide con su texto_hash.
 *
 * 5 pasos:
 *   1. agreement_version es string no vacío
 *   2. existe en gh_firma_acuerdo_versiones (getByVersion)
 *   3. esa versión es la activa y vigente (getActive la retorna)
 *   4. fecha_vigencia_inicio <= now
 *   5. fecha_vigencia_fin IS NULL o fecha_vigencia_fin > now
 *      (esto lo aplica getActive() en su WHERE; aquí solo validamos hash)
 *   + agreement_hash === texto_hash de esa versión
 *
 * Nota: getActive() ya implementa la regla "activa + vigente por fecha"
 * (cambiada en Bloque A), por lo que comparar getByVersion(v).version
 * con getActive()?.version es suficiente para "existe y es la activa".
 *
 * @throws AppError 422 ACUERDO_INVALIDO si algo falla.
 */
function validateAcuerdo(agreement_version, agreement_hash) {
  if (typeof agreement_version !== 'string' || agreement_version.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'agreement_version es requerido');
  }
  if (typeof agreement_hash !== 'string' || agreement_hash.length === 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'agreement_hash es requerido');
  }

  // Paso 1: lookup por versión
  const acuerdoPorVersion = agreementService.getByVersion(agreement_version);
  if (!acuerdoPorVersion) {
    throw new AppError(422, 'ACUERDO_INVALIDO',
      'La versión del Acuerdo no existe',
      { reason: 'version_not_found', agreement_version });
  }

  // Pasos 2-5: verificar que es la activa y vigente
  const acuerdoActivo = agreementService.getActive();
  if (!acuerdoActivo) {
    throw new AppError(422, 'ACUERDO_INVALIDO',
      'No hay versión activa y vigente del Acuerdo',
      { reason: 'no_active_version', agreement_version });
  }
  if (acuerdoActivo.version !== agreement_version) {
    throw new AppError(422, 'ACUERDO_INVALIDO',
      'La versión del Acuerdo no es la activa y vigente',
      {
        reason: 'inactive',
        agreement_version,
        active_version: acuerdoActivo.version,
      });
  }

  // Paso extra: agreement_hash debe coincidir con texto_hash
  if (agreement_hash !== acuerdoPorVersion.texto_hash) {
    throw new AppError(422, 'ACUERDO_INVALIDO',
      'El agreement_hash no coincide con el texto_hash de la versión',
      {
        reason: 'hash_mismatch',
        agreement_version,
        expected_hash: acuerdoPorVersion.texto_hash,
        received_hash: agreement_hash,
      });
  }
}

/**
 * Obtiene por ID interno.
 */
function getById(id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  return db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           tipo_firma, estado, document_hash_original, document_hash_firmado,
           agreement_hash, agreement_version, evidence_hash, token_hash, identificacion_tipo,
           identificacion_numero_hash, identificacion_numero_sal,  -- P1-2
           identificacion_coincidio,
           correo_verificacion, correo_hash, otp_hash, otp_sal,
           otp_intentos, otp_bloqueado, ip_origen, user_agent,
           sesion_id, verification_channel, fecha_creacion, fecha_expiracion,
           fecha_apertura, fecha_otp_enviado, fecha_otp_verificado,
           fecha_documento_visto, fecha_manifestacion, fecha_firma,
           fecha_revocacion, motivo_revocacion, motivo_rechazo,
           version_kair, manifestacion_voluntad_texto,
           manifestacion_voluntad_hash, pdf_original_path, pdf_firmado_path,
           constancia_path, metadata, consent_id,
           tipo_identificacion,  -- I-002 (migration 007)
           requiere_firma_empresa, tipo_firmante,  -- I-FIRMA-DUAL (migration 013)
           parent_id_solicitud,  -- I-FIRMA-DUAL (migration 013)
           representante_legal_snapshot  -- I-FIRMA-DUAL (migration 013)
    FROM gh_firmas_electronicas
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

/**
 * Obtiene por id_solicitud (SIGN-YYYY-NNNNNN).
 */
function getByIdSolicitud(id_solicitud) {
  if (typeof id_solicitud !== 'string' || id_solicitud.length === 0) return null;
  return db.prepare(`
    SELECT *
    FROM gh_firmas_electronicas
    WHERE id_solicitud = ?
    LIMIT 1
  `).get(id_solicitud);
}

/**
 * Obtiene por token_hash. Usado para validar tokens al recibirlos.
 * NO retorna el token original (solo el hash está en BD).
 */
function getByTokenHash(token_hash) {
  if (typeof token_hash !== 'string' || token_hash.length === 0) return null;
  return db.prepare(`
    SELECT *
    FROM gh_firmas_electronicas
    WHERE token_hash = ?
    LIMIT 1
  `).get(token_hash);
}

/**
 * Lista solicitudes con filtros y paginación.
 */
function list({
  id_empresa, estado, id_trabajador, id_documento,
  desde, hasta, limit = 50, offset = 0,
} = {}) {
  const where = [];
  const params = {};

  if (id_empresa) {
    where.push('id_empresa = @id_empresa');
    params.id_empresa = id_empresa;
  }
  if (estado) {
    const estados = Array.isArray(estado) ? estado : [estado];
    const placeholders = estados.map((_, i) => `@estado${i}`).join(',');
    where.push(`estado IN (${placeholders})`);
    estados.forEach((e, i) => { params[`estado${i}`] = e; });
  }
  if (id_trabajador) {
    where.push('id_trabajador = @id_trabajador');
    params.id_trabajador = id_trabajador;
  }
  if (id_documento) {
    where.push('id_documento = @id_documento');
    params.id_documento = id_documento;
  }
  if (desde) {
    where.push('fecha_creacion >= @desde');
    params.desde = desde;
  }
  if (hasta) {
    where.push('fecha_creacion <= @hasta');
    params.hasta = hasta;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const items = db.prepare(`
    SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
           tipo_firma, estado, fecha_creacion, fecha_expiracion, fecha_firma
    FROM gh_firmas_electronicas
    ${whereClause}
    ORDER BY fecha_creacion DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: safeLimit, offset: safeOffset });

  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM gh_firmas_electronicas ${whereClause}
  `).get(params).n;

  return { items, total, limit: safeLimit, offset: safeOffset };
}

/**
 * Batch lookup de sign requests por ids mixtos (I-008).
 *
 * Acepta ids en formato `SIGN-YYYY-NNNNNN` o enteros positivos. Retorna un
 * Map indexado por el id normalizado (string canónico) para que el handler
 * HTTP pueda correlacionar input con output sin re-normalizar.
 *
 * Características:
 *  - Dedup: si el mismo id aparece N veces, se retorna 1 fila.
 *  - Mixto: `SIGN-2026-000001` y `42` se buscan en sus respectivas columnas.
 *  - Cap de 200 ids (validado por el handler con zod antes de llamar).
 *  - Filtra por id_empresa en client mode (NO se filtra acá — el handler
 *    HTTP aplica el cross-company check usando req.id_empresa y separa
 *    los items en `items` vs `forbidden`).
 *
 * @param {string[]} ids - Lista de ids crudos (SIN normalizar).
 * @returns {Map<string, object>} key=id normalizado (`SIGN-...` o string(num)),
 *          value=fila de gh_firmas_electronicas. Los ids no encontrados NO
 *          aparecen en el Map.
 */
function getByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return new Map();

  // Separar ids SIGN-... vs numéricos
  const signIds = [];
  const numericIds = [];
  for (const id of ids) {
    if (typeof id !== 'string') continue;
    if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
      signIds.push(id);
    } else if (/^\d+$/.test(id)) {
      const n = parseInt(id, 10);
      if (n > 0) numericIds.push(n);
    }
  }

  const result = new Map();
  if (signIds.length === 0 && numericIds.length === 0) return result;

  // Query con IN clause parametrizada (anti SQL-injection)
  const allRows = [];

  if (signIds.length > 0) {
    const placeholders = signIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
              tipo_firma, estado, fecha_creacion, fecha_expiracion, fecha_firma
       FROM gh_firmas_electronicas
       WHERE id_solicitud IN (${placeholders})`
    ).all(...signIds);
    allRows.push(...rows);
  }

  if (numericIds.length > 0) {
    const placeholders = numericIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
              tipo_firma, estado, fecha_creacion, fecha_expiracion, fecha_firma
       FROM gh_firmas_electronicas
       WHERE id IN (${placeholders})`
    ).all(...numericIds);
    allRows.push(...rows);
  }

  // Indexar por ambas claves (id_solicitud y string(id)) para que el
  // handler pueda buscar el id original.
  for (const row of allRows) {
    result.set(row.id_solicitud, row);
    result.set(String(row.id), row);
  }
  return result;
}

/**
 * Registra un evento en gh_firma_eventos.
 */
function registerEvent(firmaId, evento, metadata, actor, ip, user_agent) {
  const fecha_hora = new Date().toISOString();
  db.prepare(`
    INSERT INTO gh_firma_eventos
      (firma_id, evento, fecha_hora, ip, user_agent, metadata, id_actor)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    firmaId, evento, fecha_hora, ip || null, user_agent || null,
    metadata ? JSON.stringify(metadata) : null, actor || 'sistema',
  );
}

module.exports = {
  create,
  createForCompany,  // I-FIRMA-DUAL: sign request hijo (tipo_firmante='EMPRESA')
  getById,
  getByIdSolicitud,
  getByTokenHash,
  getByIds,  // I-008: batch lookup
  list,
  registerEvent,
  getTokenForRecovery,  // I-013b: descifrar token de metadata
  notifyRemote,  // I-103.A1.5.1: enviar invitación al firmante
  // Exports para tests
  _resetTokenEncryptionKey,  // I-013b
  encryptToken,  // I-013b
  decryptToken,  // I-013b
  _maskEmail,  // I-103.A1.5.1: helper de auditoría
  MAX_PDF_SIZE,
  TIPOS_IDENTIFICACION,  // I-002: single source of truth (zod + service)
};
