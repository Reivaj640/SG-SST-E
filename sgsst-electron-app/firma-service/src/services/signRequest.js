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

const fs = require('fs');
const path = require('path');
const db = require('../db/connection');
const mediosService = require('./medios');   // 9A: el alta automatica de medios (el 8.2)
const config = require('../config');
const { sha256 } = require('../crypto/hash');
const { generateToken, hashToken, hashTokenHmac, generateIdSolicitud } = require('../crypto/token');
const { getMasterKey } = require('../crypto/keys');
const { valorParaGuardar, candidatosBusquedaConAmbitos } = require('./trabajador');
const { huellaDesdeHashPrevio } = require('./identificacion');
const { algHmac, hmacHex } = require('../crypto/hmac');
const storage = require('./storage');
const agreementService = require('./agreement');
const metadataService = require('./metadata');  // 8B: lista blanca de lo que se archiva
const sensibles = require('./sensibles');  // 8B: documentos con información de salud (10.8)
const representanteService = require('./representante');  // 8B: el número del representante va cifrado
const conservacion = require('./conservacion');
const retencion = require('./retencion');  // catálogo de retención por documento
const empresaService = require('./empresa');  // D-03: habilitación de la Empresa (1.4 y 8.6)
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const crypto = require('crypto');

// Propósito de la derivación del hash del correo. Es el mismo en el
// consentimiento y en el sign request: un correo es un correo, y la
// separación de dominio se hace por empresa (ámbito), no por tabla.
const PROPOSITO_CORREO = 'correo';

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
//
// La llave se toma de `src/crypto/keys.js`, que es la fuente ÚNICA de la
// llave maestra del servicio: de ella se derivan por HKDF tanto la clave de
// cifrado de tokens como las claves HMAC de identificación, de OTP y de
// token de acceso. Así, rotar `TOKEN_ENCRYPTION_KEY` invalida todo junto.
let _tokenEncryptionKey = null;
function _getTokenEncryptionKey() {
  if (_tokenEncryptionKey) return _tokenEncryptionKey;
  // `getMasterKey` ya valida: en producción lanza si la variable no está.
  _tokenEncryptionKey = getMasterKey();
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

  // 1) El token del enlace.
  //
  // 8C: el token ya no se recupera de la base (no hay copia reversible). Hay
  // dos caminos:
  //
  //   a) El cliente trae el token que ya tenía (`opts.token`): se usa tal
  //      cual. No se emite nada nuevo y no se gasta un cupo de rotación. Se
  //      comprueba que el token sea de ESTA solicitud: si no, es un token de
  //      otro lado y no se usa.
  //   b) El cliente no lo tiene: se emite uno nuevo (rotación). El token
  //      existe solo en memoria y en el correo que sale; en la base queda su
  //      HMAC.
  let urlPublica;
  let emisionToken = null;
  if (opts.token) {
    if (!tokenPerteneceA(signRequest.id, opts.token)) {
      throw new AppError(409, 'TOKEN_MISMATCH',
        'El token enviado no pertenece a esta solicitud',
        { reason: 'token_de_otra_solicitud' });
    }
    urlPublica = `${config.publicUrl}/s/${opts.token}`;
  } else {
    const emitido = emitirToken({
      firmaId: signRequest.id,
      actor: opts.actor || 'sistema',
      motivo: opts.motivo || 'invitacion',
      origen: 'notify',
    });
    urlPublica = emitido.url_publica;
    emisionToken = emitido.emision;
  }

  // 2) Enviar el correo vía mailer.
  const mailer = require('./mailer');
  let sendResult;
  try {
    // Numeral 8.6 del Acuerdo: la comunicación del plazo de conservación y
    // del canal de copia sale con la INVITACIÓN, que es lo que el Trabajador
    // recibe antes de firmar. Los declara la Empresa (migración 021); si no
    // los tiene, el correo sale sin esas líneas (no se inventa un plazo).
    let plazoRetencion = null;
    let canalCopia = null;
    // El deber legal de conservación sin término (migración 029). Si está
    // activo, el documento NO se borra automáticamente y el Trabajador tiene
    // que saberlo: el 8.6 obliga a comunicar el plazo y sus consecuencias.
    let deberLegal = { activo: false, norma: null };
    try {
      const empresaService = require('./empresa');
      const emp = signRequest.id_empresa ? empresaService.getById(signRequest.id_empresa) : null;
      if (emp) {
        plazoRetencion = emp.plazo_retencion || null;
        canalCopia = emp.canal_solicitud_copia || null;
        deberLegal = {
          activo: Boolean(emp.conservacion_por_deber_legal),
          norma: emp.norma_conservacion || null,
        };
      }
    } catch (e) {
      // La empresa puede no existir (empresa borrada) o el snapshot no tener
      // los campos. El correo sale igual: la comunicación del 8.6 es un
      // requisito de la Empresa, y no puede bloquear la invitación.
      logger.warn('notifyRemote: no se pudo leer el plazo de retención de la empresa', {
        id_solicitud: signRequest.id_solicitud,
        id_empresa: signRequest.id_empresa,
        error: e.message,
      });
    }
    // 033 · CATÁLOGO POR DOCUMENTO.
    //
    // Si la solicitud tiene categoría propia, lo que se comunica es el plazo
    // de ESE documento (20 años desde el cese, contrato sin término, historia
    // laboral), no el de la tabla de la Empresa. Y si la fila tiene un hold,
    // el Trabajador tiene que saber que su documento no se borra.
    if (signRequest.plazo_retencion_aplicable) {
      plazoRetencion = signRequest.plazo_retencion_aplicable;
    }
    if (signRequest.hold_legal === 1) {
      const alcance = signRequest.motivo_hold
        ? String(signRequest.motivo_hold).replace(/^deber_legal_/, '')
        : null;
      deberLegal = { activo: true, norma: alcance || deberLegal.norma || null };
    }
    sendResult = await mailer.sendInvite({
      to: correo,
      url_publica: urlPublica,
      id_solicitud: signRequest.id_solicitud,
      context: opts.context || null,
      plazo_retencion: plazoRetencion,
      canal_solicitud_copia: canalCopia,
      // El canal de derechos del Titular (10.7(b)). Es distinto del de
      // incidentes: este es para ejercer derechos, aquel para avisar que
      // se comprometieron los datos de creacion de la firma.
      canal_proteccion_datos: require('../config').canalProteccionDatos,
      deber_legal_conservacion: deberLegal,
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
    // 9A · el 7.2-7.3: el correo de invitación es el primer contacto y
    // ya le ofrece al Trabajador la vía en papel. Queda asentado, con la
    // huella de lo que se le mostró (la miní-app) para que la Empresa
    // pueda demostrar que la opción estuvo disponible y accesible.
    //
    // La IP y el user-agent NO se guardan aquí: esto no es una manifestación
    // del Trabajador, es la constancia de una oferta. Minimización (Ley
    // 1581 art. 4(d), D.1377 art. 4).
    try {
      require('./publicFlow').registrarOpcionPapelDisponible(
        signRequest, 'correo', sendResult.body_hash || null
      );
    } catch (e) {
      logger.warn('notifyRemote: no se pudo registrar la oferta de la vía en papel', {
        id_solicitud: signRequest.id_solicitud,
        error: e.message,
      });
    }

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
 * @param {string} [opts.categoria_retencion] - Categoría del catálogo de
 *        retención por documento (services/retencion.js). Si no se envía, se
 *        deriva de `tipo_identificacion` + `subtipo_identificacion`; si
 *        tampoco hay datos, la solicitud es legacy y usa la tabla de la
 *        Empresa. La categoría explícita siempre gana.
 * @param {string} [opts.fecha_terminacion] - Fecha de cese de la relación
 *        laboral (SST) o de retiro (historia laboral). Es la base de los 20 o
 *        100 años. Si falta, la fecha de conservación queda NULL y la fila se
 *        marca pendiente: no se inventa.
 * @param {string} [opts.subtipo_identificacion] - Subtipo libre del documento
 *        (ej. "induccion", "examen_especializado"). Solo se usa para derivar
 *        la categoría cuando no viene explícita.
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
  categoria_retencion,  // catálogo por documento (SST, contrato, historia laboral)
  fecha_terminacion,    // cese/retiro: base de los 20/100 años
  subtipo_identificacion,  // libre: ayuda a derivar la categoría
  consent_id,
  correo_verificacion,  // I-103.A1.6.C · RF-FIRMA-CORREO-01
  // D-2 (2026-10-20, decisión del owner): el MEDIO PERSONAL que declara la
  // EMPRESA para el código de verificación. Es el dato de creación de la
  // firma (el 47.4 num. 1): no puede ir al buzón que la Empresa pueda leer.
  // La Empresa lo declara porque es quien tiene la ficha del trabajador; si no
  // lo declara, el Trabajador puede hacerlo en la mini-app (el campo de la
  // pantalla de identificación).
  correo_otp,
  requiere_firma_empresa,        // I-FIRMA-DUAL: opt-in para firma de empresa (v0.1.180)
  representante_legal_snapshot,  // I-FIRMA-DUAL: snapshot del representante legal al crear el padre
  // 8B · La declaración de la Empresa sobre el dato sensible (numeral 10.8).
  // La clasificación final la hace `sensibles.clasificar()`, que además
  // INFIERE la sensibilidad del tipo de documento: la Empresa puede subir la
  // clasificación, no bajarla.
  datos_sensibles,
  categorias_datos_sensibles,
  base_legal_sensible,
  base_legal_sensible_descripcion,
  finalidad_sensible,
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

  // ───────────────────────────────────────────────────────────────────────────
  // CATÁLOGO DE RETENCIÓN POR DOCUMENTO
  // ───────────────────────────────────────────────────────────────────────────
  //
  // La categoría decide el plazo. Se resuelve ANTES de la habilitación porque
  // una inducción o un contrato NO dependen de que la Empresa haya declarado
  // `plazo_retencion_dias`: el plazo (o el hold) lo fija la ley. La categoría
  // explícita gana; si no viene, se deriva del tipo + subtipo; si no hay datos,
  // la solicitud es legacy y sigue con la tabla de la Empresa.
  let categoriaResuelta = null;
  try {
    if (categoria_retencion != null) retencion.validarCategoria(categoria_retencion);
    categoriaResuelta = retencion.resolverCategoria({
      categoria_retencion,
      tipo_identificacion,
      subtipo_identificacion,
      metadata,
    });
  } catch (e) {
    if (e.code === 'CATEGORIA_RETENCION_INVALIDA') {
      throw new AppError(400, 'INVALID_REQUEST_BODY', e.message, {
        categorias: e.categorias,
      });
    }
    throw e;
  }

  const fechaTerminacion = fecha_terminacion == null
    ? null
    : retencion.normalizarFecha(fecha_terminacion);
  if (fecha_terminacion != null && !fechaTerminacion) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'fecha_terminacion debe ser una fecha válida (ISO o YYYY-MM-DD)',
      { provided: fecha_terminacion });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // D-03 · LA EMPRESA TIENE QUE ESTAR HABILITADA
  // ───────────────────────────────────────────────────────────────────────────
  //
  // El 1.4 del Acuerdo hace depender de un Anexo de Encargo firmado la
  // relación de K+AIR con la Empresa, y el 8.6 obliga a la Empresa a
  // comunicar el plazo de conservación antes de pedir la firma. Sin las dos
  // cosas, la firma se apoyaría en promesas que el sistema no puede cumplir:
  // el 10.6 no tendría fecha, el 12.7 conservaría la prueba de una
  // autorización que no está respaldada por un encargo.
  //
  // El bloqueo va AQUÍ (antes de generar token e identificadores) para que
  // una solicitud rechazada no consuma identificadores ni tokens.
  //
  // La bandera `FIRMA_EXIGIR_HABILITACION_EMPRESA` existe para la
  // transición: con ella apagada, la firma pasa pero queda un WARN con
  // código. No hay default silencioso.
  const habilitacion = empresaService.verificarHabilitacionFirma(id_empresa);
  if (habilitacion.ok === false) {
    if (config.exigirHabilitacionEmpresa) {
      throw new AppError(409, 'EMPRESA_NO_HABILITADA', habilitacion.mensaje, {
        id_empresa,
        pendientes: habilitacion.pendientes,
      });
    }
    logger.warn('SignRequest: la Empresa NO está habilitada y el bloqueo está desactivado', {
      id_empresa,
      pendientes: habilitacion.pendientes,
      aviso: 'EMPRESA_NO_HABILITADA',
    });
  }

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
  const token_hash = hashTokenHmac(token);
  const id_solicitud = generateIdSolicitud();
  const sesion_id = require('crypto').randomUUID();

  // ───────────────────────────────────────────────────────────────────────────
  // Identificación del firmante: HMAC, no "hash con sal en la misma tabla"
  // ───────────────────────────────────────────────────────────────────────────
  // El cliente (K+AIR) envía el SHA-256 del número de documento. La fila
  // guarda un HMAC-SHA256 de ese hash, con clave derivada por HKDF de la
  // llave maestra del servicio, que vive FUERA de la base de datos. Quien
  // lea la base ya no puede recomputar candidatos: el 3.4(d) del Acuerdo
  // pide una huella con sal, y una sal guardada al lado del hash no es una
  // sal.
  //
  // La sal del cliente se conserva (si la manda) porque el hash previo que
  // él calculó la incluye (`sha256(sal || documento)`). Ya no es un
  // secreto: sin la llave maestra no permite probar ningún candidato.
  const sal = identificacion_numero_sal || null;
  const identificacion_hash_guardado = identificacion_numero_hash
    ? huellaDesdeHashPrevio(identificacion_numero_hash, id_empresa)
    : null;
  const identificacion_alg = identificacion_numero_hash ? algHmac() : null;

  // ───────────────────────────────────────────────────────────────────────────
  // Seudónimo del trabajador
  // ───────────────────────────────────────────────────────────────────────────
  // `id_trabajador` es la llave de unión del sistema y por convención del
  // proyecto es la cédula. A partir de ahora la fila guarda el seudónimo
  // HMAC del documento: la cédula no queda en claro en la base del
  // servicio, que es la base de un encargado (Capítulo X del Acuerdo).
  //
  // El cliente NO cambia: sigue mandando la cédula por el canal interno
  // autenticado. Lo que cambia es lo que se guarda. Las búsquedas por
  // `id_trabajador` prueban los dos valores (seudónimo y el crudo) para
  // seguir encontrando las filas anteriores a este cambio.
  //
  // El seudónimo se deriva con el ÁMBITO de la empresa: el mismo trabajador
  // que firma para dos empresas distintas tiene dos seudónimos, y quien lea
  // la base no puede enlazar ambos.
  const { valor: id_trabajador_guardado, alg: id_trabajador_alg } =
    valorParaGuardar(id_trabajador, id_empresa);

  // TTL
  const ttl_horas = tipo_firma === 'presencial'
    ? config.ttl.tokenHoursPresencial
    : config.ttl.tokenHoursRemote;
  const now = new Date();
  const fecha_expiracion = new Date(now.getTime() + ttl_horas * 3600 * 1000).toISOString();

  // El plan de retención se calcula con la MISMA fecha de creación que se
  // inserta. Aplica a TODA firma nueva: la custodia del sistema (80 años) o,
  // si la Empresa declaró un plazo en su tabla, el de esa tabla. No hay nada
  // que decidir ni que preguntar.
  const planRetencion = retencion.planificar({
    categoria_retencion: categoriaResuelta,
    fecha_creacion: now.toISOString(),
    fecha_terminacion: fechaTerminacion,
    empresa: empresaService.getById(id_empresa),
  });

  // Guardar PDF
  const safe_filename = `${id_solicitud}.pdf`;
  const pdf_original_path = storage.saveOriginal(safe_filename, pdf_buffer);

  // 8C · EL TOKEN NO SE GUARDA DE FORMA RECUPERABLE.
  //
  // Antes se cifraba con AES-256-GCM y se guardaba en
  // `metadata._server_metadata.token_encrypted`, y un endpoint interno lo
  // devolvía en texto claro. Cifrado sigue siendo reversible con la llave:
  // el token existía en la base en una forma que se podía recuperar, y eso
  // rompe la letra del 3.6(e) ("se conserva únicamente en forma de huella
  // digital").
  //
  // Ahora la única copia del token es su HMAC-SHA-256 con clave secreta
  // (`gh_firma_tokens` y la columna `token_hash` de la fila). La necesidad
  // operativa que cubría la recuperación —"la Empresa perdió la respuesta de
  // creación"— la cubre la ROTACIÓN: se emite un token nuevo y se devuelve
  // una sola vez. Ver `emitirToken()`.
  //
  // El metadata del cliente se conserva, pero pasa por la LISTA BLANCA (8B):
  // lo que no está permitido no se archiva. Y sin el sub-objeto
  // `_server_metadata`: esa clave es nuestra y se elimina para que ningún
  // `token_encrypted` pueda quedar guardado por el camino del metadata (8C).
  //
  // Por qué una lista blanca y no "que cada cliente mande lo que quiera": lo
  // que se archiva es DATO. El `metadata` libre es el cajón de sastre donde
  // un cliente puede dejar PII o dato de salud sin que nadie lo pidiera, y el
  // 10.8 exige consentimiento expreso para tratar el segundo. La ruta ya
  // rechaza lo desconocido con un 400; acá, que es el último punto antes de
  // escribir la fila, se descarta lo que se cuele por otro camino y queda
  // rastro en el log.
  //
  // Antes se seudonimizaba el `id_trabajador` que venía dentro del blob. Ya
  // no hace falta: la clave no está en la lista, así que se descarta entera
  // y la cédula no llega a archivarse (ni seudonimizada).
  let metadataToStore = null;
  if (metadata && typeof metadata === 'string' && metadata.length > 0) {
    const filtrado = metadataService.filtrarMetadata(metadata);
    if (filtrado.error) {
      logger.warn('8B: metadata ilegible; se archiva sin metadata', {
        id_solicitud,
        error: filtrado.error,
      });
    } else if (!filtrado.ok) {
      logger.warn('8B: metadata con claves no permitidas; se archiva solo la lista blanca', {
        id_solicitud,
        claves_no_permitidas: filtrado.desconocidas,
      });
    }
    if (filtrado.valor && Object.keys(filtrado.valor).length > 0) {
      metadataToStore = JSON.stringify(filtrado.valor);
    }
  }

  // I-103.A1.6.C · RF-FIRMA-CORREO-01: hashear el correo del firmante al
  // momento de crear el sign request. Se persiste en
  // gh_firmas_electronicas.correo_verificacion (columna directa) +
  // correo_hash (para búsqueda/comparación sin plaintext).
  //
  // El hash del correo es una HUELLA PERSISTENTE más, y por eso se calcula
  // con HMAC: la llave vive FUERA de la base de datos. Antes era SHA-256 con
  // sal en la misma tabla, que no protege nada — quien lee la base tiene la
  // sal y el hash, y el espacio de correos es lo bastante pequeño para
  // probarlos. Con el HMAC, el ámbito de la empresa (migración 022) y la
  // versión de la llave, la fila no alcanza para deducir el correo.
  //
  // Validación mínima: el string debe contener '@'. Validación completa
  // de email (RFC) la hace zod en el schema de la ruta; acá solo evitamos
  // persistir basura que pase la validación de zod pero no se parezca a email.
  let correo_persisted = null;
  let correo_hash_persisted = null;
  let correo_alg_persisted = null;
  if (typeof correo_verificacion === 'string' && correo_verificacion.includes('@')) {
    correo_persisted = correo_verificacion;
    correo_hash_persisted = hmacHex(PROPOSITO_CORREO, correo_verificacion, id_empresa);
    correo_alg_persisted = algHmac();
  }

  // 8B · LA CLASIFICACIÓN DEL DATO SENSIBLE (numeral 10.8).
  //
  // Lo que declaró la Empresa MÁS lo que se infiere del tipo de documento.
  // La Empresa puede subir la clasificación, no bajarla: el sistema no puede
  // leer el PDF, y no declarar algo sensible es la forma habitual de que un
  // dato sensible se trate sin base legal. Ver services/sensibles.js.
  const clasificacionSensible = sensibles.clasificar({
    tipoIdentificacion: tipo_identificacion || null,
    declarado: datos_sensibles === true || datos_sensibles === 1,
    categoriasDeclaradas: categorias_datos_sensibles || null,
    baseLegalDeclarada: base_legal_sensible || null,
    baseLegalDescripcion: base_legal_sensible_descripcion || null,
    finalidadDeclarada: finalidad_sensible || null,
  });
  // El aviso se fija al crear la solicitud (ver el INSERT).
  let avisoSensible = { texto: null, hash: null, version: null };

  if (clasificacionSensible.sensible) {
    // El aviso que verá el Titular, fijado con su huella.
    const aviso = sensibles.avisoDe(clasificacionSensible);
    avisoSensible = aviso;
    logger.info('8B: documento con información de salud', {
      id_solicitud,
      tipo_identificacion: tipo_identificacion || null,
      origen: clasificacionSensible.origen,
      base_legal: clasificacionSensible.base_legal,
      categorias: clasificacionSensible.categorias.length,
    });
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
         correo_verificacion, correo_hash, correo_alg,  -- I-103.A1.6.C · RF-FIRMA-CORREO-01 · 022
         correo_otp,  -- D-2: el medio personal del código (declarado por la Empresa)
         requiere_firma_empresa, tipo_firmante,  -- I-FIRMA-DUAL (migration 013)
         representante_legal_snapshot,  -- I-FIRMA-DUAL (migration 013)
         identificacion_numero_alg,  -- migration 019 (HMAC)
         id_trabajador_alg,  -- migration 019 (seudónimo) · 022 (ámbito y versión)
         datos_sensibles, categorias_sensibles, finalidad_sensible,  -- 8B (migration 027)
         base_legal_sensible, aviso_sensible_texto, aviso_sensible_hash,  -- 8B (migration 027)
         aviso_sensible_version,  -- 8B (migration 027)
         categoria_retencion, regla_retencion, fecha_terminacion,  -- 033
         plazo_retencion_aplicable)  -- 033
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_solicitud, id_documento, id_trabajador_guardado, id_empresa,
      tipo_firma, calculated_hash, agreement_hash, agreement_version,
      token_hash, sesion_id, identificacion_tipo || null, identificacion_hash_guardado,
      sal,  // P1-2: sal aleatoria por sign request
      now.toISOString(), fecha_expiracion, version_kair,
      ip || null, user_agent || null, pdf_original_path, metadataToStore, 'email',
      consent_id || null,
      tipo_identificacion || null,
      correo_persisted,
      correo_hash_persisted,
      correo_alg_persisted,
      // D-2: el medio personal declarado por la Empresa (vacío = null).
      (typeof correo_otp === 'string' && correo_otp.includes('@'))
        ? correo_otp.trim().toLowerCase()
        : null,
      requiere_firma_empresa ? 1 : 0,  // I-FIRMA-DUAL: default 0 (legacy compat)
      'TRABAJADOR',  // I-FIRMA-DUAL: el padre siempre es TRABAJADOR
      // 8B · El número del representante legal se CIFRA antes de archivarse
      // (H23). Es prueba de la representación, así que no se hashea: se
      // cifra con la llave del servicio, que vive fuera de la base. Ver
      // services/representante.js.
      representanteService.snapshotParaGuardar(representante_legal_snapshot, id_empresa),
      identificacion_alg,
      id_trabajador_alg,
      // 8B · El dato sensible (10.8). La clasificación ya viene resuelta:
      // lo que declaró la Empresa MÁS lo que se infiere del tipo de
      // documento.
      //
      // El AVISO se fija aquí, con su huella: es el texto exacto que verá el
      // Titular, y la prueba del consentimiento tiene que poder demostrar
      // QUÉ se le informó. Si se compusiera en cada visita, un cambio de
      // redacción cambiaría lo que "aceptó" sin que se note.
      clasificacionSensible.sensible ? 1 : 0,
      clasificacionSensible.categorias.length > 0
        ? JSON.stringify(clasificacionSensible.categorias)
        : null,
      clasificacionSensible.finalidad,
      clasificacionSensible.base_legal,
      clasificacionSensible.sensible ? avisoSensible.texto : null,
      clasificacionSensible.sensible ? avisoSensible.hash : null,
      clasificacionSensible.sensible ? avisoSensible.version : null,
      // 033 · Retención por documento. La fila guarda SIEMPRE la decisión:
      // la categoría (si el sistema la pudo derivar del tipo de documento),
      // la regla aplicada, la fecha de terminación (si se conoce) y el texto
      // que se le comunica al Trabajador. Las filas anteriores a este
      // catálogo siguen con las cuatro columnas en NULL y con el texto vivo
      // de la Empresa: no se les cambia lo que se les comunicó.
      categoriaResuelta,
      planRetencion.regla,
      fechaTerminacion,
      planRetencion.texto,
    );
    const firmaId = result.lastInsertRowid;

    // 8A.2 · 12.7: el identificador de la solicitud en la prueba de aceptación.
    //
    // El numeral 12.7 del Acuerdo deja en cabeza de la Empresa la conservación
    // de "la prueba de la aceptación de este Acuerdo por el Trabajador, junto
    // con la versión aceptada, la huella digital de su texto, la fecha y hora Y
    // EL IDENTIFICADOR DE LA SOLICITUD".
    //
    // Hay dos caminos de aceptación y cada uno conoce el identificador en un
    // momento distinto:
    //
    //   - La aceptación desde la mini-app (consent.js): la fila de la firma ya
    //     existe, así que el identificador se escribe ahí mismo.
    //   - La aceptación por OTP (consent.js, verifyOtp): el consentimiento se
    //     acepta ANTES de que exista la firma — así es en el flujo de la
    //     Empresa, que crea el consentimiento, el trabajador lo acepta y
    //     después se emite el enlace. En ese momento no hay identificador de
    //     solicitud que escribir.
    //
    // Por eso el enlace se cierra acá, que es donde la fila de la firma y el
    // consentimiento quedan unidos. Con COALESCE: si ya estaba escrito (por la
    // vía de la mini-app), no se pisa. El que se conserva es el primero, que
    // es el que corresponde a la aceptación que se probó.
    if (consent_id) {
      db.prepare(`
        UPDATE gh_consentimientos_firma
           SET id_solicitud = COALESCE(id_solicitud, ?),
               updated_at = datetime('now')
         WHERE id = ?
      `).run(id_solicitud, consent_id);
    }

    // 8C · El token, como huella digital y solo.
    //
    // Se registra en `gh_firma_tokens` (emisión 1: el token original). La
    // columna `token_hash` de la fila guarda la misma huella: es la que
    // usaban las firmas anteriores a esta tabla, y dejarla mantiene la
    // compatibilidad sin duplicar credenciales.
    db.prepare(`
      INSERT INTO gh_firma_tokens
        (firma_id, token_hash, emision, emitido_at, expira_en, origen)
      VALUES (?, ?, 1, ?, ?, 'create')
    `).run(firmaId, token_hash, now.toISOString(), fecha_expiracion);

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

    // Congelar la fecha de conservación (numeral 8.6). El plazo vive en el
    // código del sistema (la custodia de 80 años) o en la tabla de retención
    // que declaró la Empresa; si esa tabla no existe, la custodia del sistema
    // la reemplaza. Se congela acá y no después: el 8.6 habla del plazo "que le
    // resulta aplicable" al firmante cuando se le pide la firma, y que la
    // Empresa cambie su política después no mueve lo ya firmado.
    try {
      // El plan trae la fecha calculada y, si el documento no tiene término
      // (el contrato electrónico) o la Empresa declaró un deber legal sin
      // término, el hold automático.
      conservacion.aplicarPlanRetencion(firmaId, planRetencion);
    } catch (e) {
      // La conservación no puede tumbar la creación de la firma. Si la
      // columna todavía no existe (migración 023 sin aplicar), la firma se
      // crea igual y queda sin fecha de conservación: sin fecha, no hay
      // purga. Es el lado seguro del fallo.
      logger.warn('SignRequest: no se pudo fijar la fecha de conservación', {
        id_solicitud,
        error: e.message,
      });
      // Red de seguridad: el camino viejo (la tabla de la Empresa), por si lo
      // que falló fue el plan del catálogo y no la base. Los dos fallos
      // quedan en el log; ninguno se traga en silencio.
      try {
        const fecha = conservacion.asignarFechaConservacion(
          firmaId, id_empresa, now.toISOString()
        );
        if (!fecha) {
          logger.warn('SignRequest: la firma queda sin fecha de conservación (nunca se purga)', {
            id_solicitud,
            aviso: 'RETAIN_SIN_PLAZO',
          });
        }
      } catch (fallbackErr) {
        logger.warn('SignRequest: tampoco se pudo aplicar la fecha por la tabla de la empresa', {
          id_solicitud,
          error: fallbackErr.message,
        });
      }
    }

    // 9A (el 8.2): el alta automatica de los medios autorizados. El correo
    // que la Empresa registro (el de la hoja de vida) y el enlace de K+AIR
    // los autoriza el 8.2 de entrada: no espera a que el Trabajador haga
    // nada.
    try {
      mediosService.registrarAltaPorSolicitud({
        id_empresa,
        id_trabajador: id_trabajador_guardado,
        correo_verificacion: correo_persisted,
        // D-2: el medio personal que la Empresa declara para el código.
        // Nace PENDIENTE: hasta que el Trabajador no demuestre que lo
        // controla (el código le llega y lo verifica), no es un medio
        // verificado, y por él no se le entrega ninguna copia.
        correo_otp: (typeof correo_otp === 'string' && correo_otp.includes('@'))
          ? correo_otp.trim().toLowerCase()
          : null,
      });
    } catch (e) {
      // El registro de medios NO puede tumbar la creacion de la firma: es
      // un dato de entrega, no de la firma. Sin el, la copia se entrega
      // por el canal de siempre (el correo de la solicitud).
      logger.warn('SignRequest: no se pudieron registrar los medios autorizados', {
        id_solicitud,
        error: e.message,
      });
    }

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
           consent_id, id_trabajador_alg,
           categoria_retencion, regla_retencion, fecha_terminacion,
           plazo_retencion_aplicable, fecha_conservacion,
           hold_legal, motivo_hold, hold_alcance
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
  const token_hash = hashTokenHmac(token);
  const id_solicitud = generateIdSolicitud();
  const sesion_id = require('crypto').randomUUID();

  // 6. TTL (mismo que el padre: remote, es firma remota por definición)
  const ttl_horas = config.ttl.tokenHoursRemote;
  const now = new Date();
  const fecha_expiracion = new Date(now.getTime() + ttl_horas * 3600 * 1000).toISOString();

  // 7. Insertar (reusando el PDF original del padre).
  //    8C: el metadata ya NO lleva el token cifrado (mismo criterio que
  //    create()). Solo conserva la trazabilidad de la firma dual: de qué
  //    solicitud viene y quién firma.
  const metadataToStore = JSON.stringify({
    parent_id_solicitud,
    tipo_firmante: 'EMPRESA',
  });

  // 8B · El número del representante en claro.
  //
  // Puede llegar de dos maneras y las dos tienen que funcionar:
  // - desde la API (el cliente lo mandó en claro), o
  // - desde el snapshot YA CIFRADO del padre, que es lo que pasa cuando el
  //   hijo se dispara automáticamente al final del commit del trabajador.
  //
  // `numeroEnClaro` descifra si hace falta y devuelve el número tal cual si
  // el snapshot es heredado (número en claro). Con esto, el pre-hash de la
  // identificación es SIEMPRE del número real: si se calculara sobre el
  // sobre cifrado, el representante no podría identificarse en la mini-app.
  const numeroRep = representanteService.numeroEnClaro(representante, padre.id_empresa);

  const result = db.prepare(`
    INSERT INTO gh_firmas_electronicas (
      id_solicitud, id_documento, id_empresa, id_trabajador,
      tipo_firma, agreement_version, agreement_hash, document_hash_original,
      pdf_original_path, fecha_creacion, fecha_expiracion, estado,
      token_hash, sesion_id, correo_verificacion, correo_hash, correo_alg, metadata,
      version_kair,
      requiere_firma_empresa, tipo_firmante, parent_id_solicitud,
      representante_legal_snapshot, identificacion_tipo,
      consent_id,  -- I-FIRMA-DUAL consent propio: NULL al crear; se vincula
                    -- el consentimiento PROPIO del rep en consentAccept()
                    -- (antes se heredaba el del trabajador: dato falso en
                    -- constancia). validateForCommit lo exige antes del commit.
      identificacion_numero_hash,  -- 📦 v0.1.180 (Task 1.14): pre-poblado del snapshot
      identificacion_numero_alg,  -- migration 019: HMAC · 022: ámbito y versión
      id_trabajador_alg,  -- migration 022: el hijo HEREDA el seudónimo del
                          -- padre (ya es un seudónimo: no se re-hashea) y con
                          -- él el marcador de algoritmo con que se calculó
      categoria_retencion, regla_retencion, fecha_terminacion,  -- 033: hereda
      plazo_retencion_aplicable  -- la decisión de retención del padre
    ) VALUES (
      ?, ?, ?, ?,
      'remoto', ?, ?, ?,
      ?, ?, ?, 'PENDING',
      ?, ?, ?, ?, ?, ?,
      ?,
      0, 'EMPRESA', ?,
      ?, ?,
      ?,
      ?,
      ?,
      ?,
      ?, ?, ?, ?
    )
  `).run(
    id_solicitud, id_documento, id_empresa, padre.id_trabajador,
    padre.agreement_version, padre.agreement_hash, padre.document_hash_original,
    padre.pdf_original_path, now.toISOString(), fecha_expiracion,
    token_hash, sesion_id, representante.correo,
    // Huella persistente del correo: HMAC con el ámbito de la empresa
    // (migración 022), igual que en el padre y en el consentimiento.
    hmacHex(PROPOSITO_CORREO, representante.correo, padre.id_empresa),
    algHmac(),
    metadataToStore,
    padre.version_kair,
    parent_id_solicitud,
    // 8B: el snapshot del hijo también va con el número cifrado.
    representanteService.snapshotParaGuardar(representante, padre.id_empresa),
    representante.tipo_identificacion || 'CC',
    null, // consent_id NULL: el rep acepta SU consentimiento propio en
           // consentAccept() (antes se heredaba el del trabajador).
    // 📦 v0.1.180 (Task 1.14): hash de la cédula del rep para que
    // publicFlow.identify() pase el precheck de MISSING_IDENTIFICATION_DATA.
    // El rep debe ingresar exactamente este CC en la mini-app. Si RH captura
    // un CC distinto en el snapshot (numero_identificacion), el rep no
    // podrá identificarse — diseño conservador: el rep ES la persona del
    // snapshot, no cualquier persona que sepa la URL.
    //
    // migration 019: se archiva el HMAC de ese hash, no el hash pelado. Sin
    // la llave maestra no se puede probar ningún candidato, así que la base
    // de datos del encargado no permite deducir la cédula del representante.
    // Sin sal: el pre-hash del representante es sha256(documento), igual que
    // lo que publicFlow.identify() reconstruye para comparar.
    //
    // 8B: se usa `numeroRep` (el número en claro, descifrado si el snapshot
    // venía cifrado). Calcularlo sobre el sobre cifrado daría una huella
    // distinta de la del número real, y el representante no podría
    // identificarse en la mini-app.
    numeroRep
      ? huellaDesdeHashPrevio(sha256(numeroRep), padre.id_empresa)
      : null,
    representante.numero_identificacion ? algHmac() : null,
    // El seudónimo del trabajador se hereda del padre tal cual (ya es un
    // seudónimo) y con él el marcador del algoritmo con que se calculó.
    padre.id_trabajador_alg || null,
    // 033 · El hijo es el mismo documento: hereda la categoría, la regla, la
    // fecha de terminación y el texto que se le comunicó al trabajador. La
    // fecha de conservación NO se recalcula desde la creación del hijo: el
    // documento nació con el padre.
    padre.categoria_retencion || null,
    padre.regla_retencion || null,
    padre.fecha_terminacion || null,
    padre.plazo_retencion_aplicable || null
  );
  const childId = result.lastInsertRowid;

  // 8C · La firma de la Empresa también es un token más: se registra su
  // huella (emisión 1) en `gh_firma_tokens`, sin copia recuperable.
  db.prepare(`
    INSERT INTO gh_firma_tokens
      (firma_id, token_hash, emision, emitido_at, expira_en, origen)
    VALUES (?, ?, 1, ?, ?, 'create')
  `).run(childId, token_hash, now.toISOString(), fecha_expiracion);

  // 7.5 I-AUDIT-2026-09-10: copiar el PDF original del padre al path del hijo
  //     para que el hijo tenga su propia copia física en disco. ANTES el
  //     registro del hijo apuntaba al MISMO archivo del padre (decisión de
  //     diseño documentada en línea 628-630), lo que causaba:
  //       - si el archivo del padre se borraba (cleanup/rotación), el
  //         registro del hijo quedaba con path roto
  //       - para auditoría legal "qué vio el rep antes de firmar", no
  //         había rastro físico del PDF que vio el rep, solo del que vio
  //         el trabajador (el padre)
  //     Ahora cada SR tiene su propio archivo en originales/{id_solicitud}.pdf.
  //     Si la copia falla (permisos, espacio), NO se aborta el create — el
  //     SR sigue siendo válido (el padre es la fuente de verdad del contenido,
  //     document_hash_original ya está en BD). Solo se loguea warning.
  if (padre.pdf_original_path) {
    try {
      const hijoOriginalPath = path.join(storage.PATHS.originales, `${id_solicitud}.pdf`);
      fs.copyFileSync(padre.pdf_original_path, hijoOriginalPath);
      db.prepare(
        'UPDATE gh_firmas_electronicas SET pdf_original_path = ? WHERE id = ?'
      ).run(hijoOriginalPath, childId);
      logger.info('SignRequest: PDF original copiado para hijo', {
        parent: padre.id_solicitud,
        child: id_solicitud,
        src: padre.pdf_original_path,
        dst: hijoOriginalPath,
      });
    } catch (copyErr) {
      // No fallar el create — el hash y el path del padre siguen siendo válidos.
      logger.warn('SignRequest: no se pudo copiar PDF original al hijo (no fatal)', {
        parent: padre.id_solicitud,
        child: id_solicitud,
        error: copyErr.message,
        code: copyErr.code,
      });
    }
  }

  // 7.6 Congelar la fecha de conservación del hijo (numeral 8.6).
  //
  // El hijo es el MISMO documento: hereda la fecha ya calculada para el
  // padre y el hold si el padre lo tiene. Recalcularla desde la creación del
  // hijo correría el reloj por la firma del representante, que no es el hecho
  // que la ley mira.
  try {
    db.prepare(
      'UPDATE gh_firmas_electronicas SET fecha_conservacion = ? WHERE id = ?'
    ).run(padre.fecha_conservacion || null, childId);
    if (padre.hold_legal === 1) {
      conservacion.ponerHold(childId, {
        actor: 'sistema',
        motivo: padre.motivo_hold,
        alcance: padre.hold_alcance || null,
      });
    }
  } catch (e) {
    logger.warn('SignRequest: no se pudo fijar la fecha de conservación del hijo', {
      id_solicitud,
      error: e.message,
    });
  }

  // 8. Notificar al representante legal (I-FIRMA-DUAL, v0.1.180).
  //    Se usa `mailer.sendInviteForCompany` (correo DIFERENCIADO al del
  //    worker) en vez de `notifyRemote` (que es el flujo del worker).
  //    8C: el token del hijo está EN MEMORIA (se acaba de generar), así que
  //    no hay nada que recuperar de la base: el enlace se arma con ese token.
  //    Es la diferencia con la recuperación del metadata cifrado, que la 8C
  //    eliminó: el token existe en el momento de usarlo y en ningún otro.
  //    Fire-and-forget: la notificación NO bloquea el create. Si la
  //    notificación falla, se loguea error pero el create ya quedó
  //    persistido y se retorna exitosamente al caller.
  //
  //    Se usa una IIFE async + .catch() en vez de await para NO cambiar
  //    la firma de createForCompany a async (mantiene backward compat
  //    con callers que esperan retorno sync).
  const mailer = require('./mailer');
  const urlHijo = `${config.publicUrl}/s/${token}`;
  (async () => {
    try {
      await mailer.sendInviteForCompany({
        to: representante.correo,
        url_publica: urlHijo,
        id_solicitud: id_solicitud,
        id_documento: id_documento,
        rep_nombre: representante.nombre,
        context: { parent_id_solicitud, tipo_firmante: 'EMPRESA' },
      });
      logger.info('firma-dual: invitación enviada al rep', {
        id_solicitud,
        rep_correo: representante.correo,
      });
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
    id: childId,
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
           representante_legal_snapshot,  -- I-FIRMA-DUAL (migration 013)
           categoria_retencion, regla_retencion, fecha_terminacion,  -- 033
           plazo_retencion_aplicable, fecha_conservacion, hold_legal, motivo_hold  -- 023/033
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
 *
 * Acepta UN hash o una LISTA de candidatos. Las solicitudes viejas
 * guardan SHA-256(token); las nuevas guardan HMAC(token). Como el token es
 * el mismo en ambos casos, la búsqueda prueba las dos huellas: la fila se
 * encuentra con la que tenga, sin importar cuándo se creó.
 *
 * 8C · ORDEN DE BÚSQUEDA
 * -----------------------
 * 1. `gh_firma_tokens`: es la fuente de verdad desde la 8C, porque una firma
 *    puede tener varios tokens (el original y sus rotaciones). Si el token
 *    está en la tabla y está REVOCADO, la función devuelve null: un token
 *    revocado no resuelve, y es lo que distingue "este enlace se revocó" de
 *    "este enlace nunca existió".
 * 2. `gh_firmas_electronicas.token_hash`: el camino legado, para las firmas
 *    anteriores a la tabla de tokens. Si el token está en la tabla (aunque
 *    sea el backfill de una firma vieja), el paso 1 lo resuelve y este no
 *    llega a ejecutarse.
 *
 * @param {string|string[]} token_hash
 */
function getByTokenHash(token_hash) {
  const hashes = (Array.isArray(token_hash) ? token_hash : [token_hash])
    .filter(h => typeof h === 'string' && h.length > 0);
  if (hashes.length === 0) return null;

  const placeholders = hashes.map(() => '?').join(',');

  // 1. La tabla de tokens (8C).
  let tokenRow = null;
  try {
    tokenRow = db.prepare(`
      SELECT firma_id, revocado_at
      FROM gh_firma_tokens
      WHERE token_hash IN (${placeholders})
      LIMIT 1
    `).get(...hashes);
  } catch (e) {
    // La tabla puede no existir si la migración 026 no está aplicada: en ese
    // caso se sigue por el camino legado, que es el de siempre.
    logger.warn('8C: gh_firma_tokens no disponible, se resuelve por la columna legada', {
      error: e.message,
    });
  }
  if (tokenRow) {
    if (tokenRow.revocado_at) {
      // Revocado: el enlace está muerto a propósito. No resuelve, y no se
      // dice por qué (el 404 no confirma existencia).
      return null;
    }
    return db.prepare(`
      SELECT *
      FROM gh_firmas_electronicas
      WHERE id = ?
      LIMIT 1
    `).get(tokenRow.firma_id);
  }

  // 2. El camino legado: la huella en la fila de la firma.
  if (hashes.length === 1) {
    return db.prepare(`
      SELECT *
      FROM gh_firmas_electronicas
      WHERE token_hash = ?
      LIMIT 1
    `).get(hashes[0]);
  }
  return db.prepare(`
    SELECT *
    FROM gh_firmas_electronicas
    WHERE token_hash IN (${placeholders})
    ORDER BY id DESC
    LIMIT 1
  `).get(...hashes);
}

// =============================================================================
// 8C · ROTACIÓN DE TOKENS (decisión D1)
// =============================================================================

/**
 * Estados en los que la solicitud ya no admite un enlace nuevo.
 * El endpoint de recuperación (`GET /link`) y el de rotación usan la misma
 * lista: una solicitud terminal no se "reabre" por el hecho de pedir un
 * enlace.
 */
const ESTADOS_TERMINALES = ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED'];

/**
 * Tope de tokens VIVOS por solicitud.
 *
 * Cada token es una credencial de acceso al flujo de firma. El tope acota
 * cuántas hay vivas a la vez para una misma solicitud: con el original y dos
 * rotaciones hay tres accesos, que es lo que hace falta para el caso real
 * (la Empresa perdió la respuesta de creación, y reenvía la invitación).
 *
 * Cuando se llega al tope, el sistema NO emite un cuarto token ni revoca por
 * su cuenta el más viejo: revocar es una decisión, y un enlace que ya está
 * en manos del trabajador no se rompe a escondidas. Quien llama decide con
 * `revocar_anteriores: true`.
 */
const MAX_TOKENS_ACTIVOS = 3;

/**
 * Los tokens emitidos de una firma (todos, revocados incluidos).
 *
 * @param {number} firmaId
 * @returns {Array<object>}
 */
function tokensDe(firmaId) {
  try {
    return db.prepare(`
      SELECT id, emision, emitido_at, expira_en, revocado_at, revocado_por,
             motivo_revocacion, origen
      FROM gh_firma_tokens
      WHERE firma_id = ?
      ORDER BY emision ASC
    `).all(firmaId);
  } catch (e) {
    // La tabla puede no existir (migración 026 sin aplicar): no hay tokens
    // que listar.
    return [];
  }
}

/**
 * Emite un token nuevo para una firma: la ROTACIÓN.
 *
 * Es el mecanismo que reemplaza a la recuperación del token cifrado. El
 * token en texto claro existe solo en el valor de retorno: la base guarda su
 * HMAC-SHA-256 con clave secreta. El que lo recibe lo usa una vez y, si lo
 * pierde, pide otra rotación.
 *
 * Los tokens anteriores NO se invalidan: siguen sirviendo hasta su
 * vencimiento (la ventana de la firma). La rotación no extiende el plazo,
 * solo emite otro acceso al mismo plazo.
 *
 * @param {object} opts
 * @param {number} opts.firmaId
 * @param {string} opts.actor - quién pide la rotación (queda en el registro).
 * @param {string} [opts.motivo] - por qué (queda en el registro).
 * @param {string} [opts.origen] - 'rotate' | 'notify'.
 * @param {boolean} [opts.revocarAnteriores] - revoca los tokens vivos antes
 *   de emitir el nuevo.
 * @returns {{token: string, url_publica: string, emision: number, expira_en: string, revocados: number[]}}
 */
function emitirToken({ firmaId, actor, motivo, origen = 'rotate', revocarAnteriores = false }) {
  const firma = db.prepare(`
    SELECT id, id_solicitud, id_empresa, token_hash, fecha_creacion, fecha_expiracion, estado
    FROM gh_firmas_electronicas
    WHERE id = ?
    LIMIT 1
  `).get(firmaId);
  if (!firma) {
    throw new AppError(404, 'NOT_FOUND', 'Solicitud no encontrada');
  }
  if (ESTADOS_TERMINALES.includes(firma.estado)) {
    throw new AppError(
      410,
      'LINK_NOT_AVAILABLE',
      `El link no está disponible en estado terminal '${firma.estado}'`,
      { current_state: firma.estado, reason: 'terminal_state' }
    );
  }

  const ahora = new Date().toISOString();
  const quien = actor || 'system';

  const tx = db.transaction(() => {
    // Backfill: si la firma todavía no tiene tokens en la tabla, su token
    // original (el de la columna `token_hash`) entra como emisión 1. Así
    // todos los tokens de la firma quedan registrados y se pueden revocar:
    // una firma creada antes de la 8C no queda con un token fuera del
    // control.
    const cuantos = db.prepare(
      'SELECT COUNT(*) AS n FROM gh_firma_tokens WHERE firma_id = ?'
    ).get(firmaId).n;
    if (cuantos === 0 && firma.token_hash) {
      db.prepare(`
        INSERT INTO gh_firma_tokens
          (firma_id, token_hash, emision, emitido_at, expira_en, origen)
        VALUES (?, ?, 1, ?, ?, 'legacy')
      `).run(firmaId, firma.token_hash, firma.fecha_creacion || ahora, firma.fecha_expiracion);
    }

    // Revocación explícita de los anteriores.
    const revocados = [];
    if (revocarAnteriores) {
      const previos = db.prepare(`
        SELECT emision FROM gh_firma_tokens
        WHERE firma_id = ? AND revocado_at IS NULL
      `).all(firmaId);
      db.prepare(`
        UPDATE gh_firma_tokens
           SET revocado_at = ?, revocado_por = ?, motivo_revocacion = ?
         WHERE firma_id = ? AND revocado_at IS NULL
      `).run(ahora, quien, motivo || 'rotacion_con_revocacion', firmaId);
      revocados.push(...previos.map(p => p.emision));
    }

    // El tope de tokens vivos. Se comprueba DESPUÉS de la revocación
    // explícita: revocar y emitir es una sola operación.
    const activos = db.prepare(`
      SELECT emision FROM gh_firma_tokens
      WHERE firma_id = ? AND revocado_at IS NULL
        AND (expira_en IS NULL OR expira_en > ?)
      ORDER BY emision ASC
    `).all(firmaId, ahora);
    if (activos.length >= MAX_TOKENS_ACTIVOS) {
      throw new AppError(
        409,
        'TOKEN_LIMIT_REACHED',
        `La solicitud ya tiene ${activos.length} enlaces vigentes`,
        {
          max_tokens: MAX_TOKENS_ACTIVOS,
          tokens_activos: activos.map(a => a.emision),
          revocables: true,
        }
      );
    }

    const emision = (db.prepare(
      'SELECT MAX(emision) AS m FROM gh_firma_tokens WHERE firma_id = ?'
    ).get(firmaId).m || 0) + 1;

    const token = generateToken();
    const tokenHash = hashTokenHmac(token);
    db.prepare(`
      INSERT INTO gh_firma_tokens
        (firma_id, token_hash, emision, emitido_at, expira_en, origen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(firmaId, tokenHash, emision, ahora, firma.fecha_expiracion, origen);

    return { token, emision, expira_en: firma.fecha_expiracion, revocados };
  });

  const resultado = tx();

  logger.info('8C: token emitido (rotación)', {
    id_solicitud: firma.id_solicitud,
    emision: resultado.emision,
    origen,
    actor: quien,
    revocados: resultado.revocados.length,
    expira_en: resultado.expira_en,
  });

  return {
    ...resultado,
    url_publica: `${config.publicUrl}/s/${resultado.token}`,
  };
}

/**
 * Los tokens VIVOS de una firma (no revocados y no vencidos).
 *
 * @param {number} firmaId
 * @returns {Array<object>}
 */
function tokensActivosDe(firmaId) {
  const ahora = new Date().toISOString();
  try {
    return db.prepare(`
      SELECT id, emision, emitido_at, expira_en, origen
      FROM gh_firma_tokens
      WHERE firma_id = ? AND revocado_at IS NULL
        AND (expira_en IS NULL OR expira_en > ?)
      ORDER BY emision ASC
    `).all(firmaId, ahora);
  } catch (e) {
    return [];
  }
}

/**
 * Revoca los tokens vivos de una firma (sin emitir uno nuevo).
 *
 * @param {object} opts
 * @param {number} opts.firmaId
 * @param {string} opts.actor
 * @param {string} [opts.motivo]
 * @returns {number[]} las emisiones revocadas.
 */
function revocarTokens({ firmaId, actor, motivo }) {
  const ahora = new Date().toISOString();
  const quien = actor || 'system';
  const tx = db.transaction(() => {
    const previos = db.prepare(`
      SELECT emision FROM gh_firma_tokens
      WHERE firma_id = ? AND revocado_at IS NULL
    `).all(firmaId);
    db.prepare(`
      UPDATE gh_firma_tokens
         SET revocado_at = ?, revocado_por = ?, motivo_revocacion = ?
       WHERE firma_id = ? AND revocado_at IS NULL
    `).run(ahora, quien, motivo || 'revocacion_explicita', firmaId);
    return previos.map(p => p.emision);
  });
  const revocados = tx();
  logger.info('8C: tokens revocados', {
    firma_id: firmaId,
    revocados,
    actor: quien,
  });
  return revocados;
}

/**
 * ¿El token (en texto claro) pertenece a esta firma?
 *
 * Se usa cuando el cliente manda un token que ya tenía (por ejemplo, para
 * reenviar la invitación sin emitir otro). Comparar la huella evita que un
 * token de otra solicitud se use para construir el enlace de esta.
 *
 * @param {number} firmaId
 * @param {string} token
 * @returns {boolean}
 */
function tokenPerteneceA(firmaId, token) {
  if (typeof token !== 'string' || token.length === 0) return false;
  const hash = hashTokenHmac(token);
  const fila = db.prepare(`
    SELECT id FROM gh_firma_tokens
    WHERE firma_id = ? AND token_hash = ? AND revocado_at IS NULL
    LIMIT 1
  `).get(firmaId, hash);
  if (fila) return true;
  // Legado: la huella en la fila de la firma.
  const legacy = db.prepare(
    'SELECT id FROM gh_firmas_electronicas WHERE id = ? AND token_hash = ? LIMIT 1'
  ).get(firmaId, hash);
  return Boolean(legacy);
}

/**
 * Las empresas que tienen al menos una firma.
 *
 * Se usa cuando una consulta filtra por `id_trabajador` pero NO por
 * `id_empresa`: el seudónimo depende del ámbito (la empresa), así que sin
 * saber la empresa hay que probar el de todas.
 *
 * @returns {string[]}
 */
function empresasConFirmas() {
  try {
    return db.prepare('SELECT DISTINCT id_empresa FROM gh_firmas_electronicas')
      .all()
      .map((r) => r.id_empresa)
      .filter((e) => typeof e === 'string' && e.length > 0);
  } catch (e) {
    return [];
  }
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
    // El valor que llega del cliente es el documento crudo. La fila puede
    // guardar el seudónimo (solicitudes nuevas) o el valor crudo (las
    // anteriores a la migración 019), así que hay que buscar por los dos.
    //
    // El seudónimo se deriva con el ámbito de la empresa. Si la consulta no
    // filtra por empresa, no se sabe con qué ámbito se calculó: se prueban
    // los de todas las empresas con firmas (son pocas) más el valor crudo.
    const ambitos = id_empresa ? [id_empresa] : empresasConFirmas();
    const cands = candidatosBusquedaConAmbitos(id_trabajador, ambitos);
    if (cands.length === 0) {
      where.push('1 = 0');
    } else if (cands.length === 1) {
      where.push('id_trabajador = @id_trabajador');
      params.id_trabajador = cands[0];
    } else {
      const placeholders = cands.map((_, i) => `@id_trabajador${i}`).join(',');
      where.push(`id_trabajador IN (${placeholders})`);
      cands.forEach((c, i) => { params[`id_trabajador${i}`] = c; });
    }
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
  empresasConFirmas,
  list,
  registerEvent,
  getTokenForRecovery,  // I-013b: descifrar token de metadata (LEGADO, 8C)
  // 8C · la rotación reemplaza a la recuperación del token cifrado.
  emitirToken,
  revocarTokens,
  tokensDe,
  tokensActivosDe,
  tokenPerteneceA,
  MAX_TOKENS_ACTIVOS,
  ESTADOS_TERMINALES,
  notifyRemote,  // I-103.A1.5.1: enviar invitación al firmante
  // Exports para tests
  _resetTokenEncryptionKey,  // I-013b
  encryptToken,  // I-013b
  decryptToken,  // I-013b
  _maskEmail,  // I-103.A1.5.1: helper de auditoría
  MAX_PDF_SIZE,
  TIPOS_IDENTIFICACION,  // I-002: single source of truth (zod + service)
};
