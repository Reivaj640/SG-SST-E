/**
 * Servicio de Flujo Público de firma.
 *
 * Maneja todas las operaciones que el trabajador hace desde la
 * mini-app pública. Usa el token como bearer implícito (sin header
 * de auth — el token ES la credencial).
 *
 * Sub-bloque 1: resolveToken + identify
 * Sub-bloque 2: verifyOtp
 * Sub-bloque 3: viewDocument + getPdf
 * Sub-bloque 4: commit + reject
 *
 * Ver DATA_MODEL.md §3.3, §3.5 y API.md §5.
 * Ver FLOWS.md §3 (Flujo 2: Firma presencial).
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db/connection');
const config = require('../config');
const { hashToken } = require('../crypto/token');
const { generateOTP, hashOTP, verifyOTP, isLocked } = require('../crypto/otp');
const { hashWithSalt, generateSalt, sha256, generateIdSolicitud: _ } = require('../crypto/hash');
const { canonicalJSON } = require('../crypto/compare');
const signRequestService = require('./signRequest');
const consentService = require('./consent');
const mailer = require('./mailer');
const storage = require('./storage');
const pdfGen = require('./pdfGen');
const agreementService = require('./agreement');  // D2: re-validar Acuerdo en view/commit
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const { withAppErrorWrapping, withAppErrorWrappingSync } = require('../utils/errorWrap');
const { isExpired } = require('../crypto/otp');

// Rate limiter en memoria para resend-otp.
// Key: signRequest.id → array de timestamps (ms) de llamadas recientes.
// Se limpia automáticamente cuando la ventana expira.
const _resendOtpTimestamps = new Map();

/**
 * Resultado de resolver un token.
 *
 * - ok=true: el token es válido, se retorna el contexto
 * - ok=false: hubo un error (revisar code y message)
 */
function resolveTokenResult(ok, code, message, signRequest, estado) {
  return { ok, code, message, signRequest, estado };
}

/**
 * Resuelve un token y retorna el contexto público.
 *
 * Valida:
 * - El token existe (calculando token_hash y buscando en BD)
 * - La solicitud no ha expirado
 * - El estado es adecuado (no terminal)
 *
 * Retorna un objeto con:
 *   { signRequest, estado } si todo OK
 *
 * Lanza AppError si hay algún problema (404 / 410 / 409).
 */
function resolveToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token no encontrado');
  }

  const token_hash = hashToken(token);
  const signRequest = signRequestService.getByTokenHash(token_hash);

  if (!signRequest) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe');
  }

  // Verificar expiración
  const now = Date.now();
  const expiresAt = new Date(signRequest.fecha_expiracion).getTime();
  if (now > expiresAt) {
    // Marcar como expirado si aún no lo está (idempotente)
    if (!['EXPIRED', 'SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED'].includes(signRequest.estado)) {
      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE gh_firmas_electronicas
          SET estado = 'EXPIRED'
          WHERE id = ? AND estado NOT IN ('SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED')
        `).run(signRequest.id);
        signRequestService.registerEvent(signRequest.id, 'EXPIRED', null, 'sistema');
      });
      tx();
    }
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado', {
      expired_at: signRequest.fecha_expiracion,
    });
  }

  // Estados terminales
  if (['SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED'].includes(signRequest.estado)) {
    throw new AppError(410, 'TOKEN_ALREADY_USED',
      `La solicitud está en estado terminal '${signRequest.estado}'`);
  }

  return { signRequest, estado: signRequest.estado };
}

/**
 * Re-valida que la versión del Acuerdo vinculada al sign request sigue
 * siendo la activa y vigente (Bloque D2).
 *
 * Si la `agreement_version` del sign request NO coincide con la versión
 * activa del Acuerdo, lanza 409 AGREEMENT_VERSION_NO_LONGER_ACTIVE.
 *
 * Sign requests legacy (pre-Bloque A) tienen `agreement_version = null`.
 * Esos se firmaron antes de la introducción de versiones, así que NO se
 * pueden re-validar contra el Acuerdo actual. Se dejan pasar para
 * preservar la trazabilidad histórica.
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas
 * @throws AppError 409 AGREEMENT_VERSION_NO_LONGER_ACTIVE
 */
function validateAgreementStillActive(signRequest) {
  // Sign request legacy sin agreement_version → no se puede re-validar
  if (!signRequest.agreement_version) {
    return;
  }
  const acuerdoActivo = agreementService.getActive();
  if (!acuerdoActivo || acuerdoActivo.version !== signRequest.agreement_version) {
    throw new AppError(409, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE',
      'La versión del Acuerdo de esta solicitud ya no está activa',
      {
        sign_request_version: signRequest.agreement_version,
        active_version: acuerdoActivo ? acuerdoActivo.version : null,
      });
  }
}

/**
 * Registra el evento OPENED si es la primera vez que se carga el token.
 *
 * Bloque E8.1 (fix bug): antes solo seteaba `fecha_apertura` pero NO
 * transicionaba `estado` a 'OPENED', dejando al sign request en 'PENDING'
 * después del primer acceso. Esto causaba:
 *   - El estado 'OPENED' del CHECK era inalcanzable (quedaba zombie).
 *   - identify() veía `estado === 'PENDING'` (no 'OPENED') y operaba
 *     en un estado "pre-apertura" engañoso.
 *
 * Fix: el primer UPDATE ahora setea `estado = 'OPENED'` Y
 * `fecha_apertura` simultáneamente, con un WHERE `estado = 'PENDING'`
 * para evitar race con `identify()` (que cambia estado a IDENTIFIED).
 * Si `updateResult.changes !== 1`, significa que otro proceso (ej. un
 * identify concurrente en otra tab) ya transicionó, así que NO
 * registramos OPENED — la concurrencia es segura.
 *
 * Si el sign request ya tenía `fecha_apertura`, es un segundo acceso
 * (recarga del HTML / nuevo GET /s/:token) → no hacemos nada.
 */
function registerOpenedIfFirst(signRequest, ip, user_agent) {
  if (signRequest.fecha_apertura) {
    return; // ya estaba abierto
  }
  const tx = db.transaction(() => {
    const updateResult = db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OPENED',
          fecha_apertura = ?
      WHERE id = ? AND estado = 'PENDING'
    `).run(new Date().toISOString(), signRequest.id);
    // Si changes !== 1, otro proceso ya transicionó (ej. identify() en
    // otra tab). No es un error — solo significa que OPENED fue "ganado"
    // por la otra transición. NO registramos evento OPENED duplicado.
    if (updateResult.changes === 1) {
      signRequestService.registerEvent(signRequest.id, 'OPENED',
        { token_prefix: signRequest.id_solicitud }, 'trabajador', ip, user_agent);
    }
  });
  tx();
}

/**
 * NOTA: La función `transitionToIdentificationStarted` fue eliminada en
 * Bloque E8.3. Era dead code: exportada pero nunca usada.
 * Si en el futuro se necesita un paso explícito entre OPENED y
 * IDENTIFIED, se puede reintroducir con tests.
 */

/**
 * Identifica al trabajador. Valida cédula contra el hash guardado.
 *
 * Si la identificación es exitosa, genera OTP, lo guarda hasheado,
 * y envía por correo.
 *
 * @param {string} token
 * @param {string} tipo_identificacion - Tipo de documento de IDENTIFICACIÓN
 *        del firmante (CC, CE, TI, PPT, PA). D-1 (I-002): antes `tipo_documento`.
 *        NO confundir con el campo del sign request `tipo_identificacion`
 *        (categoría del doc que se firma: CONTRATO, etc.).
 * @param {string} numero_documento
 * @param {string} ip
 * @param {string} user_agent
 * @returns {Promise<{ok: true, estado, otp_ttl_seconds, correo_destino_enmascarado, devOtp?}>}
 */
async function identify(token, tipo_identificacion, numero_documento, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar que la solicitud está en estado adecuado para identify
  const estadosPermitidos = ['PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED', 'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede identificar en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Validar que tenemos los datos de identificación guardados
  if (!signRequest.identificacion_numero_hash || !signRequest.identificacion_tipo) {
    throw new AppError(500, 'MISSING_IDENTIFICATION_DATA',
      'La solicitud no tiene datos de identificación del trabajador');
  }

  // 4. Validar tipo de documento de identificación del firmante
  if (signRequest.identificacion_tipo !== tipo_identificacion) {
    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'El tipo de documento no coincide',
      { expected: signRequest.identificacion_tipo, provided: tipo_identificacion });
  }

  // 5. Calcular hash de la cédula con sal (P1-2).
  //    Si el sign request tiene sal → SHA-256(sal || numero_documento).
  //    Si es legacy (sal = NULL) → SHA-256(numero_documento) (fallback).
  //    Esto preserva compatibilidad con sign requests pre-migración 006.
  const sal = signRequest.identificacion_numero_sal;
  let provided_hash;
  if (sal) {
    // Con sal: SHA-256(sal_hex || numero_documento).
    // Concatenamos los strings y hasheamos.
    provided_hash = require('crypto').createHash('sha256')
      .update(sal + numero_documento)
      .digest('hex');
  } else {
    // Legacy sin sal.
    provided_hash = sha256(numero_documento);
  }
  if (provided_hash !== signRequest.identificacion_numero_hash) {
    // Incrementar intentos
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET identificacion_coincidio = 0
      WHERE id = ?
    `).run(signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_FAILED',
      { tipo_identificacion }, 'trabajador', ip, user_agent);

    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'La identificación no coincide con nuestros registros');
  }

  // 6+7+8. Identificación + generación OTP + guardado, TODO en una sola tx.
  //    P1-3: antes había 2 tx separadas (IDENTIFIED y OTP_SENT) con una
  //    ventana de 20-30ms donde el estado podía quedar en IDENTIFIED sin
  //    OTP guardado. Ahora todo es atómico: si algo falla, rollback total.
  //    Persistimos ip_origen y user_agent del firmante en la fila.
  //    Estos valores se usan luego en el evidence_hash del commit.
  //    COALESCE: si ya hay IP/UA de una identificación previa, los
  //    preservamos (no sobrescribimos). El FAILED no persiste IP/UA
  //    porque un intento fallido puede venir de cualquier red.
  const otp = generateOTP();
  const otp_sal = generateSalt();
  const otp_hash = hashWithSalt(otp, otp_sal);
  const now_iso = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          identificacion_coincidio = 1,
          ip_origen = COALESCE(?, ip_origen),
          user_agent = COALESCE(?, user_agent),
          otp_hash = ?, otp_sal = ?,
          otp_intentos = 0, otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(ip || null, user_agent || null, otp_hash, otp_sal, now_iso, signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_COMPLETED',
      { tipo_identificacion }, 'trabajador', ip, user_agent);
  });
  tx();

  // 9. Obtener correo desde consentimiento (fuente de verdad) o metadata (legacy)
  const correo = resolveCorreo(signRequest);
  if (!correo) {
    throw new AppError(400, 'MISSING_EMAIL',
      'No hay correo de verificación disponible para esta solicitud');
  }

  // 10. Enviar OTP
  const sendResult = await mailer.sendOTP({
    to: correo,
    otp,
    tipo: 'signature',
    context: { id_solicitud: signRequest.id_solicitud },
  });

  // 11. Enriquecer auditoría SMTP del evento OTP_SENT (ya registrado en la tx)
  //     con messageId real y correo destino enmascarado.
  signRequestService.registerEvent(signRequest.id, 'OTP_SENT',
    {
      canal: 'email',
      correo_destino_enmascarado: maskEmail(correo),
      messageId: sendResult.messageId || null,
      envio_exitoso: sendResult.ok === true,
    }, 'sistema', ip, user_agent);

  logger.info('Identificación exitosa, OTP enviado', {
    id_solicitud: signRequest.id_solicitud,
    tipo_identificacion,
    correo_destino: maskEmail(correo),
  });

  // 12. Respuesta pública
  return {
    estado: 'OTP_SENT',
    otp_ttl_seconds: config.ttl.otpSeconds,
    correo_destino_enmascarado: maskEmail(correo),
    devOtp: sendResult.devOtp,  // solo en dev
  };
}

function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}${'*'.repeat(Math.max(0, local.length - visible.length))}@${domain}`;
}

/**
 * Resuelve el correo de verificación del firmante.
 *
 * FASE 4 · A1.5.4-B · ARQUITECTURA CORREO:
 *
 *   - signRequest.metadata.correo es la FUENTE PRIMARIA.
 *     Cada sign request tiene su propio correo destino. Es el dato vivo:
 *     refleja el último correo que el operador introdujo en el modal de
 *     K+AIR al crear ESTA solicitud específica. Cuando hay 1 consent y N
 *     sign requests vinculados, cada SR puede tener un correo distinto
 *     y el OTP va al correo del SR, no del consent.
 *
 *   - consent.correo_verificacion queda como FALLBACK y dato histórico.
 *     Se conserva para trazabilidad (saber a qué correo se refería el
 *     operador cuando creó el consentimiento del Acuerdo), pero NO se
 *     usa para enviar el OTP de la firma si el SR tiene su propio
 *     correo en metadata. Esto evita la dependencia incorrecta entre
 *     consent y sign_request que rompía el flujo cuando el operador
 *     cambiaba el correo entre envíos.
 *
 *   - Para SR legacy sin metadata.correo, se usa el consent como
 *     fallback. Esto preserva compatibilidad con sign requests creados
 *     antes del fix A1.5.4-A.
 *
 * Si ambos fallan, retorna null (el caller debe decidir si lanzar error
 * o usar un placeholder).
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas
 * @returns {string|null} correo o null
 */
function resolveCorreo(signRequest) {
  // I-103.A1.6.C · RF-FIRMA-CORREO-01: prioridad 1 es la columna directa
  // gh_firmas_electronicas.correo_verificacion, persistida al momento
  // de crear el SR con el correo ingresado por el operador. Es la fuente
  // de verdad para INVITE, OTP inicial y reenvíos de OTP. Si el operador
  // cambió el correo del consent después, el SR sigue usando el correo
  // original (congelado).
  if (typeof signRequest.correo_verificacion === 'string' && signRequest.correo_verificacion.includes('@')) {
    return signRequest.correo_verificacion;
  }

  // 2. Fuente secundaria: metadata del sign request (compatibilidad con
  //    código que enviaba `correo` dentro del sub-objeto metadata).
  if (signRequest.metadata) {
    try {
      const meta = JSON.parse(signRequest.metadata);
      if (meta && typeof meta.correo === 'string' && meta.correo.includes('@')) {
        return meta.correo;
      }
    } catch (_) {
      // metadata corrupto, ignorar y caer al fallback
    }
  }

  // 3. Fallback: consentimiento asociado (dato histórico / SR legacy).
  //    Si el SR no tiene metadata.correo ni correo_verificacion, usamos
  //    el correo del consent con el que se vinculó. Esto preserva el
  //    comportamiento para sign requests legacy.
  if (signRequest.consent_id) {
    try {
      const consent = db.prepare(
        'SELECT correo_verificacion FROM gh_consentimientos_firma WHERE id = ?'
      ).get(signRequest.consent_id);
      if (consent && consent.correo_verificacion) {
        return consent.correo_verificacion;
      }
    } catch (_) {
      // Si la query falla (consent no existe, DB corrupta), continuamos
    }
  }

  // 4. Sin fuente válida
  return null;
}

/**
 * Cierra la firma: transición atómica a SIGNED.
 *
 * Precondiciones:
 * - Token válido
 * - Estado = DOCUMENT_VIEWED
 * - manifestacion_aceptada = true
 *
 * Pasos:
 * 1. Verificar precondiciones y re-validar Acuerdo (D2)
 * 2. Generar id_constancia = crypto.randomUUID() (server-side)
 * 3. Generar PDF firmado y Constancia en memoria
 * 4. Calcular hashes (document_hash_firmado, evidence_hash)
 * 5. Escribir PDFs directamente a paths_FINAL con fsync (writeFileAtomic)
 * 6. db.transaction() atómica: UPDATE estado=SIGNED con todos los hashes,
 *    paths, id_constancia + 4 eventos (MANIFESTATION_RECORDED,
 *    SIGN_COMMITTED, PDF_GENERATED, COPY_SENT temporal hasta E2)
 * 7. Enviar correo con PDF + Constancia (best-effort, E2 lo moverá a post-tx)
 *
 * Atomicidad: si la escritura de PDFs falla (paso 5), la tx no se hace y
 * NO hay inconsistencia. Si la tx falla (paso 6), los archivos se borran
 * en el catch para no dejar PDFs huérfanos. BD↔FS 1:1.
 *
 * @param {string} token
 * @param {object} opts - { manifestacion_aceptada, firma_visual_png? }
 * @returns {Promise<{ok: true, estado, evidence_hash, fecha_firma, ...}>}
 */
async function commit(token, opts, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Re-validar que el Acuerdo vinculado sigue siendo el activo (D2)
  validateAgreementStillActive(signRequest);

  // 2.5. Validar consentimiento del Acuerdo (Bloque E6).
  //      Demuestra la cadena legal: Acuerdo v1.0 → Consentimiento ACEPTADO
  //      → Sign Request → Firma. Si signRequest.agreement_version IS NULL
  //      (legacy pre-Bloque A), validateForCommit retorna skip:true y
  //      no aplica esta validación (compatibilidad histórica, igual que
  //      validateAgreementStillActive).
  //      Si signRequest.agreement_version IS NOT NULL, el consentimiento
  //      debe existir, estar aceptado, y coincidir con (trabajador,
  //      empresa, version_acuerdo). Cualquier falla lanza 409 con código
  //      específico (CONSENT_NOT_FOUND, CONSENT_NOT_ACCEPTED, etc.).
  //
  //      Decisión de diseño: se valida ANTES de generar PDFs/id_constancia
  //      para fallar rápido. En la práctica de K+AIR actual,
  //      manifestacion_aceptada solo cambia 0→1 (no hay endpoint de
  //      revocación), por lo que la ventana de race es teórica.
  consentService.validateForCommit(signRequest);

  // 3. Validar precondiciones
  if (signRequest.estado !== 'DOCUMENT_VIEWED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede firmar en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }
  if (!opts.manifestacion_aceptada) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'Debe aceptar la manifestación de voluntad (manifestacion_aceptada=true)');
  }

  // 4. id_constancia UUID server-side (migración 003)
  const id_constancia = crypto.randomUUID();

  // 5. Leer PDF original
  const pdfOriginal = storage.readPdf(signRequest.pdf_original_path);

  // 6. Generar PDF firmado (con metadata XMP).
  //    El XMP incluye id_solicitud, agreement_version, fecha_firma.
  //    NO incluye document_hash_firmado ni evidence_hash (chicken-and-egg:
  //    ambos se calculan DESPUÉS de generar el PDF y persisten en BD).
  const fecha_firma = new Date().toISOString();
  const pdfFirmadoBuf = await withAppErrorWrapping(
    () => pdfGen.generateSignedPdf(pdfOriginal, {
      id_solicitud: signRequest.id_solicitud,
      id_documento: signRequest.id_documento,
      id_trabajador: signRequest.id_trabajador,
      agreement_version: signRequest.agreement_version,
      fecha_firma,
    }),
    'PDF_GENERATION_FAILED',
    'No se pudo generar el PDF firmado',
  );
  const document_hash_firmado = sha256(pdfFirmadoBuf);

  // 7. Construir evidencia (JSON canónico) — Bloque E3.
  //
  //    El evidence_hash compromete TODOS los elementos que un
  //    auditor forense necesita para reproducir y verificar la firma.
  //    Cualquier cambio en estos campos produce un hash distinto,
  //    demostrando criptográficamente que la firma está vinculada
  //    a esos datos.
  //
  //    Política de IP/UA (decisión E3.2): `ip_origen` y `user_agent`
  //    representan el contexto del FIRMANTE, capturado en identify().
  //    El commit NO los sobrescribe. Si el firmante cambia de red
  //    entre identificar y firmar, el hash sigue anclado al contexto
  //    de identificación (que es donde se validó la identidad).
  //    El contexto del commit se preserva en `gh_firma_eventos.ip/user_agent`
  //    de los eventos post-identificación.
  // Texto de manifestación reforzado (robustez jurídica):
  // - Pacto de método (art. 2.2.2.47.7 D.1074/2015): activa la presunción
  //   de confiabilidad del mecanismo OTP+correo.
  // - Aviso de evidencia: el firmante sabe que IP/dispositivo quedan grabados.
  // - Autorización Ley 1581/2012 para el tratamiento de esos datos.
  // ATENCIÓN: si cambias este texto, revisá el checkbox #manifestacion_voluntad
  // en web/firma/index.html — lo que el trabajador LEE debe coincidir con lo
  // que aquí se hashea como evidencia.
  const manifestacion_voluntad_texto = 'He leído, comprendido y acepto el contenido del documento en su totalidad. Acepto firmar este documento electrónicamente mediante verificación de mi correo electrónico (código OTP), conforme al art. 2.2.2.47.7 del Decreto 1074 de 2015. Reconozco que mi identificación, dirección IP y datos del dispositivo quedan registrados como evidencia de esta firma, y autorizo su tratamiento conforme a la Ley 1581 de 2012.';
  const manifestacion_voluntad_hash = sha256(manifestacion_voluntad_texto);
  const evidencia = {
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    id_trabajador: signRequest.id_trabajador,
    id_empresa: signRequest.id_empresa,
    document_hash_original: signRequest.document_hash_original,
    document_hash_firmado,
    agreement_hash: signRequest.agreement_hash,
    agreement_version: signRequest.agreement_version,  // ← D1 fix
    identificacion_tipo: signRequest.identificacion_tipo,
    // === E3 nuevos campos ===
    tipo_firma: signRequest.tipo_firma,
    manifestacion_voluntad_hash,
    // IP/UA del firmante, persistidos en identify() (no en commit).
    // Si es null (caso legacy o bug de plomería HTTP), el hash usa null.
    ip_origen: signRequest.ip_origen || null,
    user_agent: signRequest.user_agent || null,
    fecha_creacion: signRequest.fecha_creacion,
    fecha_firma,
    version_kair: signRequest.version_kair,
    manifestacion_voluntad_texto,
  };
  const evidencia_canonica = canonicalJSON(evidencia);
  const evidence_hash = sha256(evidencia_canonica);

  // 8. Paths finales (escritura directa, sin temp+rename).
  //    Trade-off: writeFileSync directo es prácticamente atómico en NTFS/ext4
  //    para buffers pequeños (PDFs típicos <4 MB). Si writeFileSync falla,
  //    la tx no se hace y la BD queda intacta. Atomicidad BD↔FS 1:1.
  const pdf_firmado_filename = signRequest.id_solicitud + '.pdf';
  const pdf_firmado_path = path.join(storage.PATHS.firmados, pdf_firmado_filename);

  const constancia_filename = signRequest.id_solicitud + '-constancia.pdf';
  const constancia_path = path.join(storage.PATHS.constancias, constancia_filename);

  // 9. Generar Constancia (en memoria) — incluye id_constancia.
  // Los datos visibles de empresa/trabajador se sacan del metadata del SR
  // (K+AIR los envía: nombre_empresa, nombre_trabajador). El correo del
  // firmante ya existe en correo_verificacion. evidence_hash se pasa aparte
  // para que NO salga "undefined" en el PDF.
  let _srMeta = {};
  try { _srMeta = signRequest.metadata ? JSON.parse(signRequest.metadata) : {}; } catch (e) { _srMeta = {}; }

  // Fallback para SRs legacy (creados antes de que K+AIR enviara los nombres):
  // buscar en el consentimiento vinculado o en OTRO sign request del mismo
  // trabajador/empresa que sí los tenga. Cero migración de BD.
  let nombreEmpresa = _srMeta.nombre_empresa || null;
  let nombreTrabajador = _srMeta.nombre_trabajador || null;

  function _parseMetaSafe(m) {
    try { return m ? JSON.parse(m) : {}; } catch (e) { return {}; }
  }

  // Fuente 2: consentimiento vinculado
  if ((!nombreEmpresa || !nombreTrabajador) && signRequest.consent_id) {
    try {
      const consent = db.prepare(
        'SELECT metadata FROM gh_consentimientos_firma WHERE id = ?'
      ).get(signRequest.consent_id);
      const cm = _parseMetaSafe(consent && consent.metadata);
      if (!nombreEmpresa && cm.nombre_empresa) nombreEmpresa = cm.nombre_empresa;
      if (!nombreTrabajador && cm.nombre_trabajador) nombreTrabajador = cm.nombre_trabajador;
    } catch (e) { /* noop — fallback best-effort */ }
  }

  // Fuente 3: otro sign request del mismo trabajador (misma empresa)
  if (!nombreEmpresa || !nombreTrabajador) {
    try {
      const siblings = db.prepare(
        "SELECT metadata FROM gh_firmas_electronicas WHERE id_trabajador = ? AND id_empresa = ? AND metadata IS NOT NULL AND metadata != '' ORDER BY fecha_creacion DESC LIMIT 5"
      ).all(signRequest.id_trabajador, signRequest.id_empresa);
      for (const sib of siblings) {
        const sm = _parseMetaSafe(sib.metadata);
        if (!nombreEmpresa && sm.nombre_empresa) nombreEmpresa = sm.nombre_empresa;
        if (!nombreTrabajador && sm.nombre_trabajador) nombreTrabajador = sm.nombre_trabajador;
        if (nombreEmpresa && nombreTrabajador) break;
      }
    } catch (e) { /* noop */ }
  }

  const correoConstancia = resolveCorreo(signRequest); // ya tiene fallback a consent

  // 9b. Trazabilidad para la Constancia: leer historial de eventos y anexar
  //     sintéticamente los 3 que la transacción de commit (paso 11) va a
  //     persistir con estos mismos datos (fecha_firma/ip/ua). La constancia
  //     se genera ANTES de la tx (diseño E1: archivos primero, BD después),
  //     así que sin este anexo la línea de tiempo quedaría sin el cierre.
  //     Se muestran los últimos 20 (los más recientes, incluidos los 3 del
  //     cierre) para mantener el PDF en 1-2 páginas; el historial completo
  //     queda en gh_firma_eventos / endpoint interno de auditoría.
  let eventosConstancia = [];
  let eventosTotal = 0;
  try {
    const _rows = db.prepare(`
      SELECT evento, fecha_hora, ip, id_actor
      FROM gh_firma_eventos
      WHERE firma_id = ?
      ORDER BY fecha_hora ASC, id ASC
    `).all(signRequest.id);
    eventosTotal = _rows.length + 3; // +3 eventos sintéticos del commit
    _rows.push(
      { evento: 'MANIFESTATION_RECORDED', fecha_hora: fecha_firma, ip: ip || null, id_actor: 'trabajador' },
      { evento: 'SIGN_COMMITTED', fecha_hora: fecha_firma, ip: ip || null, id_actor: 'trabajador' },
      { evento: 'PDF_GENERATED', fecha_hora: fecha_firma, ip: ip || null, id_actor: 'sistema' },
    );
    // Si hay más de 20, conservar los primeros (contexto inicial: creación,
    // apertura, identificación) + los últimos (verificación, firma) sin
    // perder el cierre — el rango medio (p.ej. reenvíos masivos de OTP)
    // queda en la BD. El header de la sección indica el total real.
    if (_rows.length > 20) {
      const head = _rows.slice(0, 10);
      const tail = _rows.slice(-10);
      eventosConstancia = head.concat(tail);
    } else {
      eventosConstancia = _rows;
    }
  } catch (e) {
    // No bloquear la firma por un fallo de lectura del historial; la
    // constancia sale sin auditoría (mejor que nada) y queda en log.
    logger.warn('No se pudo leer gh_firma_eventos para la constancia', {
      id_solicitud: signRequest.id_solicitud,
      error: e.message,
    });
  }

  const constanciaBuf = await withAppErrorWrapping(
    () => pdfGen.generateConstanciaPdf({
      ...evidencia,
      evidence_hash,          // fix: el objeto evidencia no lo trae de fábrica
      id_constancia,
      nombre_empresa: nombreEmpresa,
      nombre_trabajador: nombreTrabajador,
      correo_trabajador: correoConstancia || null,
      correo_emisor: config.smtp.fromEmail || null,
      eventos: eventosConstancia,
      eventos_total: eventosTotal,
    }),
    'PDF_GENERATION_FAILED',
    'No se pudo generar la constancia',
  );

  // 10. Escribir PDFs a disco con fsync (writeFileAtomic).
  //     Si esto falla, NO se toca BD y NO hay inconsistencia.
  try {
    writeFileAtomic(pdf_firmado_path, pdfFirmadoBuf);
    writeFileAtomic(constancia_path, constanciaBuf);
  } catch (err) {
    // Si el primer write OK y el segundo falla, hacer cleanup del primero
    try { fs.unlinkSync(pdf_firmado_path); } catch (_) { /* ignore */ }
    throw new AppError(500, 'STORAGE_WRITE_FAILED',
      'No se pudieron escribir los PDFs en disco', { error: err.message });
  }

  // 11. Transacción atómica: UPDATE estado=SIGNED + persistir todos los hashes,
  //     paths, id_constancia + 4 eventos.
  //     Si esto falla, los archivos quedan en disco pero la BD rollback.
  //     Cleanup: borrar archivos en error path.
  try {
    const tx = db.transaction(() => {
      const updateResult = db.prepare(`
        UPDATE gh_firmas_electronicas
        SET estado = 'SIGNED',
            document_hash_firmado = ?,
            evidence_hash = ?,
            fecha_manifestacion = ?,
            fecha_firma = ?,
            manifestacion_voluntad_texto = ?,
            manifestacion_voluntad_hash = ?,
            id_constancia = ?,
            pdf_firmado_path = ?,
            constancia_path = ?
        WHERE id = ? AND estado = 'DOCUMENT_VIEWED'
      `).run(
        document_hash_firmado, evidence_hash, fecha_firma, fecha_firma,
        manifestacion_voluntad_texto, manifestacion_voluntad_hash,
        id_constancia, pdf_firmado_path, constancia_path, signRequest.id,
      );
      if (updateResult.changes !== 1) {
        throw new AppError(409, 'INVALID_STATE_TRANSITION',
          'La firma no se pudo cerrar: el estado cambió durante el commit');
      }
      // I-008.3: usar withAppErrorWrappingSync (no la versión async) porque
      // estamos DENTRO de la callback sync de db.transaction (better-sqlite3
      // v11 no soporta await en esa callback). Errores no-AppError ahora se
      // convierten en AppError(500, 'EVENT_REGISTRATION_FAILED', ...) →
      // rollback atómico + cliente recibe código específico en vez de
      // INTERNAL_ERROR genérico (HALLAZGO #2).
      withAppErrorWrappingSync(
        () => signRequestService.registerEvent(signRequest.id, 'MANIFESTATION_RECORDED',
          { texto_hash: manifestacion_voluntad_hash },
          'trabajador', ip, user_agent),
        'EVENT_REGISTRATION_FAILED',
        'No se pudo registrar el evento MANIFESTATION_RECORDED',
      );
      withAppErrorWrappingSync(
        () => signRequestService.registerEvent(signRequest.id, 'SIGN_COMMITTED',
          { evidence_hash },
          'trabajador', ip, user_agent),
        'EVENT_REGISTRATION_FAILED',
        'No se pudo registrar el evento SIGN_COMMITTED',
      );
      withAppErrorWrappingSync(
        () => signRequestService.registerEvent(signRequest.id, 'PDF_GENERATED',
          { path: pdf_firmado_path, size: pdfFirmadoBuf.length, id_constancia },
          'sistema', ip, user_agent),
        'EVENT_REGISTRATION_FAILED',
        'No se pudo registrar el evento PDF_GENERATED',
      );
      // COPY_SENT se registra post-tx (Bloque E2) — ver paso 13 abajo
    });
    tx();
  } catch (err) {
    // Cleanup: borrar archivos escritos
    try { fs.unlinkSync(pdf_firmado_path); } catch (_) { /* ignore */ }
    try { fs.unlinkSync(constancia_path); } catch (_) { /* ignore */ }
    throw err;
  }

  // 13. Enviar copia firmada al correo (Bloque E2).
  //     Best-effort: si el envío falla, el sign request sigue en SIGNED
  //     (la firma es válida legalmente), pero se registra COPY_FAILED en
  //     la auditoría para que RH pueda intervenir (reenviar, escalar).
  //     El PDF y la Constancia se adjuntan al correo vía sendSignedCopy().
  const correo = resolveCorreo(signRequest);
  if (!correo) {
    logger.warn('No hay correo para enviar copia firmada', {
      id_solicitud: signRequest.id_solicitud,
    });
    signRequestService.registerEvent(signRequest.id, 'COPY_FAILED',
      {
        canal: 'email',
        error: 'No hay correo de verificación disponible',
        code: 'MISSING_EMAIL',
      },
      'sistema', ip, user_agent);
  } else {
    try {
      const sendResult = await mailer.sendSignedCopy({
        to: correo,
        pdfPath: pdf_firmado_path,
        constanciaPath: constancia_path,
        context: {
          id_solicitud: signRequest.id_solicitud,
          id_constancia,
        },
      });
      signRequestService.registerEvent(signRequest.id, 'COPY_SENT',
        {
          canal: 'email',
          messageId: sendResult.messageId,
          size_pdf: pdfFirmadoBuf.length,
          size_constancia: constanciaBuf.length,
        },
        'sistema', ip, user_agent);
      logger.info('Copia firmada enviada', {
        id_solicitud: signRequest.id_solicitud,
        id_constancia,
        messageId: sendResult.messageId,
      });
    } catch (err) {
      logger.warn('No se pudo enviar copia al trabajador', {
        id_solicitud: signRequest.id_solicitud,
        id_constancia,
        error: err.message,
      });
      signRequestService.registerEvent(signRequest.id, 'COPY_FAILED',
        {
          canal: 'email',
          error: err.message,
          code: err.code || 'SEND_ERROR',
        },
        'sistema', ip, user_agent);
      // NO throw: la firma es válida. COPY_FAILED es informativo.
    }
  }

  logger.info('Firma cerrada', {
    id_solicitud: signRequest.id_solicitud,
    id_constancia,
    evidence_hash,
  });

  return {
    ok: true,
    estado: 'SIGNED',
    id_solicitud: signRequest.id_solicitud,
    document_hash_firmado,
    evidence_hash,
    fecha_firma,
    id_constancia,
    // URLs informativas. Los endpoints reales se implementan en Bloque E'
    // (siguiente bloque después de E). Se mantienen como referencia.
    pdf_firmado_url: `/internal/sign-requests/${signRequest.id_solicitud}/pdf-firmado`,
    constancia_url: `/internal/sign-requests/${signRequest.id_solicitud}/constancia`,
  };
}

/**
 * Escribe un Buffer a un archivo con fsync para durabilidad.
 * Lanza si la escritura falla.
 *
 * En Windows NTFS y Linux ext4, `fs.writeFileSync` es prácticamente
 * atómico para buffers <4 MB: el kernel escribe los bloques de forma
 * transaccional. Para PDFs típicos (decenas a cientos de KB), el riesgo
 * de archivo corrupto a mitad de escritura es muy bajo.
 *
 * Se descartó el patrón temp+rename (escribir a `.tmp.${id}` y luego
 * `renameSync` a destino final) porque introducía una ventana de
 * inconsistencia: si el rename fallía, la BD ya tenía paths_FINAL pero
 * el FS no. Con `writeFileSync` directo, la atomicidad BD↔FS es 1:1.
 */
function writeFileAtomic(filepath, buffer) {
  const fd = fs.openSync(filepath, 'w');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Registra rechazo explícito del documento.
 *
 * @param {string} token
 * @param {string} [motivo] - Motivo del rechazo (opcional)
 * @returns {{ok: true, estado: 'REJECTED'}}
 */
function reject(token, motivo, ip, user_agent) {
  // 1. Lookup directo (sin resolveToken que retornaría 410 si SIGNED)
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'Token no encontrado');
  }
  const token_hash = hashToken(token);
  const signRequest = signRequestService.getByTokenHash(token_hash);
  if (!signRequest) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe');
  }

  // 2. Validar estado: no se puede rechazar si ya está firmado
  if (signRequest.estado === 'SIGNED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'No se puede rechazar un documento ya firmado');
  }

  // 3. Validar estados terminales
  if (['REJECTED', 'CANCELLED', 'REVOKED'].includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `La solicitud ya está en estado '${signRequest.estado}'`);
  }

  // 4. Validar expiración
  const now = Date.now();
  const expiresAt = new Date(signRequest.fecha_expiracion).getTime();
  if (now > expiresAt) {
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado');
  }

  // 3. UPDATE + evento en una sola tx atómica (P1-1).
  //    Antes: UPDATE corría primero, luego registerEvent. Si el evento
  //    fallaba, el estado quedaba en REJECTED sin evento registrado
  //    (desfase en auditoría). Ahora, si CUALQUIERA falla, rollback total.
  //    Consistencia con commit() e identify() que ya usan este patrón.
  const tx = db.transaction(() => {
    const updateResult = db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'REJECTED',
          motivo_rechazo = ?
      WHERE id = ? AND estado NOT IN ('SIGNED', 'REJECTED', 'CANCELLED', 'REVOKED')
    `).run(motivo || null, signRequest.id);

    if (updateResult.changes !== 1) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION',
        'La firma no se pudo rechazar: el estado cambió');
    }

    signRequestService.registerEvent(signRequest.id, 'REJECTED',
      { motivo_texto: motivo || null }, 'trabajador', ip, user_agent);
  });
  tx();

  logger.info('Documento rechazado', {
    id_solicitud: signRequest.id_solicitud,
    // P1-5: NO loguear motivo completo (texto libre del trabajador, PII).
    // Solo logueamos la longitud para análisis sin exponer contenido.
    motivo_length: motivo ? motivo.length : 0,
  });

  return {
    ok: true,
    estado: 'REJECTED',
    id_solicitud: signRequest.id_solicitud,
  };
}

/**
 * Registra que el trabajador vio el documento (scroll al final).
 *
 * Transición: OTP_VERIFIED -> DOCUMENT_OPENED -> DOCUMENT_VIEWED
 *
 * @param {string} token
 * @param {object} opts - { segundosEnPagina, scrollAlFinal }
 * @returns {{ok: true, estado, manifestacion_voluntad_texto}}
 */
function viewDocument(token, { segundosEnPagina, scrollAlFinal }, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Re-validar que el Acuerdo vinculado sigue siendo el activo (D2)
  validateAgreementStillActive(signRequest);

  // 3. Validar estado: debe estar al menos en OTP_VERIFIED
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede ver el documento en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Validar que vio el documento hasta el final
  if (!scrollAlFinal) {
    throw new AppError(422, 'INVALID_REQUEST_BODY',
      'Debe scrollear al final del documento antes de continuar');
  }

  // 4. Transición de estado
  const now = new Date().toISOString();
  const nuevoEstado = signRequest.estado === 'OTP_VERIFIED'
    ? 'DOCUMENT_VIEWED'  // primera vez: salta a VIEWED si trae scroll=true
    : 'DOCUMENT_VIEWED';
  // NOTA: en el flujo real, DOCUMENT_OPENED y DOCUMENT_VIEWED son separados
  // (uno cuando abre el visor, otro cuando scrollea al final).
  // Para v1 simplificamos: viewDocument con scroll=true marca VIEWED.

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = ?,
          fecha_documento_visto = COALESCE(fecha_documento_visto, ?)
      WHERE id = ?
    `).run(nuevoEstado, now, signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'DOCUMENT_VIEWED',
      { segundos_en_pagina: segundosEnPagina || 0 }, 'trabajador', ip, user_agent);
  });
  tx();

  logger.info('Documento visto', { id_solicitud: signRequest.id_solicitud });

  return {
    ok: true,
    estado: nuevoEstado,
  };
}

/**
 * Devuelve el PDF del documento para descarga/visualización.
 *
 * Solo accesible en estados donde se ha verificado OTP.
 */
function getPdfForToken(token) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar estado
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED', 'SIGNED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `El PDF no está disponible en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 3. Leer PDF
  if (!signRequest.pdf_original_path) {
    throw new AppError(500, 'PDF_NOT_FOUND', 'No se encontró el PDF original');
  }

  const pdfBuffer = storage.readPdf(signRequest.pdf_original_path);
  return {
    buffer: pdfBuffer,
    filename: `${signRequest.id_solicitud}.pdf`,
  };
}

/**
 * Verifica el OTP de una solicitud.
 *
 * @param {string} token
 * @param {string} otp - 6 dígitos
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{ok: true, estado: 'OTP_VERIFIED'} |
 *           {ok: false, code, message, attempts?}}
 */
function verifyOtp(token, otp, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Verificar bloqueo (antes del estado, porque OTP_LOCKED es terminal)
  if (signRequest.estado === 'OTP_LOCKED' || signRequest.otp_bloqueado) {
    throw new AppError(422, 'OTP_LOCKED',
      'Demasiados intentos. El OTP está bloqueado.',
      { attempts: signRequest.otp_intentos, max_attempts: config.ttl.otpMaxAttempts });
  }

  // 3. Validar estado actual
  if (signRequest.estado !== 'OTP_SENT' && signRequest.estado !== 'OTP_VERIFIED') {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede verificar OTP en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 4. Verificar OTP
  if (!signRequest.otp_hash || !signRequest.otp_sal) {
    throw new AppError(500, 'MISSING_OTP_DATA', 'No hay OTP almacenado para esta solicitud');
  }

  const result = verifyOTP(otp, signRequest.otp_hash, signRequest.otp_sal, signRequest.otp_intentos);

  if (result.valid) {
    // 5. OTP correcto
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE gh_firmas_electronicas
        SET estado = 'OTP_VERIFIED',
            otp_intentos = ?,
            fecha_otp_verificado = ?
        WHERE id = ?
      `).run(result.attempts, new Date().toISOString(), signRequest.id);
      signRequestService.registerEvent(signRequest.id, 'OTP_VERIFIED',
        { intentos: result.attempts }, 'trabajador', ip, user_agent);
    });
    tx();

    logger.info('OTP verificado', { id_solicitud: signRequest.id_solicitud });
    return { ok: true, estado: 'OTP_VERIFIED' };
  }

  // 6. OTP incorrecto
  const locked = isLocked(result.attempts, config.ttl.otpMaxAttempts);
  const newEstado = locked ? 'OTP_LOCKED' : 'OTP_SENT';
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET otp_intentos = ?,
          estado = ?,
          otp_bloqueado = ?
      WHERE id = ?
    `).run(result.attempts, newEstado, locked ? 1 : 0, signRequest.id);
    signRequestService.registerEvent(signRequest.id, locked ? 'OTP_LOCKED' : 'OTP_FAILED',
      { intentos: result.attempts, locked }, 'trabajador', ip, user_agent);
  });
  tx();

  if (locked) {
    throw new AppError(422, 'OTP_LOCKED',
      `Demasiados intentos (${result.attempts}). OTP bloqueado.`,
      { attempts: result.attempts, max_attempts: config.ttl.otpMaxAttempts });
  }

  throw new AppError(422, 'OTP_INVALID',
    'El código ingresado no es correcto',
    { attempts: result.attempts, max_attempts: config.ttl.otpMaxAttempts });
}

/**
 * Acepta el consentimiento del Acuerdo vinculado a un sign request
 * desde la UI de la mini-app (tercera casilla "Acepto el Acuerdo").
 *
 * Esta función es el orquestador de Bloque E6.5 — la pieza que cierra
 * el flujo de firma en sign requests con `agreement_version` (es decir,
 * sign requests que requieren consentimiento del Acuerdo v1.0 explícito).
 *
 * Precondiciones (validadas aquí, en orden):
 *
 *   1. El token es válido y la solicitud NO está en estado terminal
 *      (validado por `resolveToken` → 404 / 410).
 *
 *   2. La solicitud está en `OTP_VERIFIED` o `DOCUMENT_VIEWED`.
 *      Lista INEQUÍVOCA — solo estos 2 estados:
 *        - OTP_VERIFIED  : el firmante ya pasó identify() + verify-otp().
 *        - DOCUMENT_VIEWED: el firmante también vio el documento.
 *      NO se permite aceptar el consentimiento ANTES del OTP (PENDING,
 *      OPENED, IDENTIFICATION_STARTED, IDENTIFIED, OTP_SENT → 409).
 *      Esto cumple el requisito legal: el consentimiento es post-
 *      autenticación, no la reemplaza.
 *
 *      NOTA: `SIGNED` es estado terminal manejado por resolveToken (410).
 *      `DOCUMENT_OPENED` no existe en el CHECK constraint de la tabla
 *      (estado intermedio eliminado en migración 005_reduce_check).
 *
 *   3. El sign request tiene `consent_id` vinculado.
 *      Sign requests legacy (pre-Bloque A, sin agreement_version) NO
 *      requieren consentimiento. Si llegamos aquí con uno, es un bug.
 *
 *   4. Delega en `consentService.accept(consentId, { signRequest })`:
 *      - El service hace el UPDATE atómico con WHERE de protección TOCTOU.
 *      - El service retorna `{ ok, idempotente, consent }`.
 *      - Si `idempotente: false` (primera aceptación), registramos el
 *        evento `CONSENT_ACCEPTED` en `gh_firma_eventos` con metadata:
 *          · id_consentimiento
 *          · version_acuerdo
 *          · hash_texto_acuerdo
 *          · id_solicitud
 *          · idempotente: false
 *      - Si `idempotente: true` (ya aceptado), NO se crea otro evento
 *        (decisión de auditoría: una sola entrada CONSENT_ACCEPTED por
 *        consentimiento).
 *
 * Garantías:
 *
 *   - Idempotencia: el service tiene doble protección (lectura previa +
 *     WHERE en UPDATE) + manejo de estado inconsistente. Si el evento
 *     de registro falla, no se afecta el estado del consentimiento.
 *
 *   - Anti-aceptación-pre-OTP: solo se permite aceptar desde estados
 *     POST-autenticación. Lista cerrada de 2 estados (OTP_VERIFIED,
 *     DOCUMENT_VIEWED). Cualquier otro estado (incluido PENDING, OPENED,
 *     IDENTIFIED, OTP_SENT) → 409 CONSENT_ACCEPT_TOO_EARLY.
 *
 *   - Atomicidad del UPDATE: el service usa `db.transaction(() => ...)`
 *     con `WHERE manifestacion_aceptada = 0 AND estado = 'OTP_PENDING'`
 *     para que un UPDATE concurrente desde otra tab/request no duplique.
 *
 * @param {string} token
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{ok: true, idempotente: boolean, consent: object}}
 * @throws AppError 404/409/410 según la regla que falle.
 */
const ESTADOS_PERMITIDOS_PARA_CONSENT = ['OTP_VERIFIED', 'DOCUMENT_VIEWED'];

function consentAccept(token, ip, user_agent) {
  // 1. Resolver token (404 / 410)
  const { signRequest } = resolveToken(token);

  // 2. Validar estado de la solicitud (lista INEQUÍVOCA)
  if (!ESTADOS_PERMITIDOS_PARA_CONSENT.includes(signRequest.estado)) {
    throw new AppError(409, 'CONSENT_ACCEPT_TOO_EARLY',
      `No se puede aceptar el consentimiento en estado '${signRequest.estado}'. ` +
      `La solicitud debe estar en OTP_VERIFIED o DOCUMENT_VIEWED.`,
      {
        current_state: signRequest.estado,
        required_states: ESTADOS_PERMITIDOS_PARA_CONSENT,
        id_solicitud: signRequest.id_solicitud,
      });
  }

  // 3. Validar consent_id
  if (!signRequest.consent_id) {
    throw new AppError(409, 'CONSENT_REQUIRED',
      'El sign request no tiene consent_id vinculado (legado sin Acuerdo?)',
      { id_solicitud: signRequest.id_solicitud });
  }

  // 4. Llamar al service (UPDATE atómico en consentimiento)
  const result = consentService.accept(signRequest.consent_id, { signRequest });

  // 5. Registrar evento CONSENT_ACCEPTED SOLO en la primera aceptación.
  //    Si fue idempotente, ya existe un evento previo (o un reintento que
  //    no debe duplicar la auditoría).
  if (!result.idempotente) {
    const updatedConsent = result.consent;
    signRequestService.registerEvent(signRequest.id, 'CONSENT_ACCEPTED', {
      id_consentimiento: updatedConsent.id,
      version_acuerdo: updatedConsent.version_acuerdo,
      hash_texto_acuerdo: updatedConsent.hash_texto_acuerdo,
      id_solicitud: signRequest.id_solicitud,
      idempotente: false,
    }, 'trabajador', ip, user_agent);
  }

  // 6. Aplanar respuesta para conveniencia del frontend.
  //    El service retorna { ok, idempotente, consent }; el frontend prefiere
  //    campos top-level (consent_id, manifestacion_aceptada, estado, etc.).
  const c = result.consent;
  return {
    ok: result.ok,
    consent_id: c.id,
    manifestacion_aceptada: c.manifestacion_aceptada === 1,
    estado: c.estado,
    fecha_aceptacion: c.fecha_aceptacion,
    version_acuerdo: c.version_acuerdo,
    hash_texto_acuerdo: c.hash_texto_acuerdo,
    idempotente: result.idempotente,
  };
}

/**
 * Reenvía OTP a una solicitud que ya pasó por identify().
 *
 * Estados permitidos:
 *   - OTP_SENT: el OTP anterior expiró o está por expirar
 *   - OTP_LOCKED: desbloquear y generar OTP nuevo
 *
 * Estados NO permitidos (lanzan 409):
 *   - PENDING, OPENED, IDENTIFICATION_STARTED, IDENTIFIED: aún no se ha identificado
 *   - OTP_VERIFIED, DOCUMENT_OPENED, DOCUMENT_VIEWED: ya pasó el OTP
 *   - SIGNED, REJECTED, REVOKED, CANCELLED, EXPIRED: estados terminales
 *
 * Comportamiento:
 *   1. Valida estado del SR (resolveToken valida token + expiración)
 *   2. Si OTP_LOCKED: desbloquear (otp_bloqueado=0, estado→OTP_SENT)
 *   3. Si OTP_SENT: verificar que el OTP anterior expiró
 *   4. Generar nuevo OTP (hash + salt)
 *   5. Obtener correo desde consentimiento o metadata
 *   6. Enviar OTP vía mailer
 *   7. Registrar evento OTP_RESENT con metadata completa
 *   8. Retornar estado + TTL + correo enmascarado
 *
 * @param {string} token
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{ok: true, estado, otp_ttl_seconds, correo_destino_enmascarado, devOtp?}}
 * @throws AppError 404/409/410/422 según la regla que falle.
 */
function resendOtp(token, ip, user_agent) {
  // 1. Resolver token (valida existencia, expiración, estados terminales)
  const { signRequest } = resolveToken(token);

  // 2. Validar estado actual
  const ESTADOS_RESEND_PERMITIDOS = ['OTP_SENT', 'OTP_LOCKED'];
  if (!ESTADOS_RESEND_PERMITIDOS.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede reenviar OTP en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado, allowed_states: ESTADOS_RESEND_PERMITIDOS });
  }

  // 2.5. Rate limiting: máx N reenvíos por ventana de 1 hora por SR.
  const now = Date.now();
  const WINDOW_MS = 60 * 60 * 1000; // 1 hora
  const MAX_RESENDS = config.rateLimit.resendOtpPerHour;
  let timestamps = _resendOtpTimestamps.get(signRequest.id);
  if (!timestamps) {
    timestamps = [];
    _resendOtpTimestamps.set(signRequest.id, timestamps);
  }
  // Limpiar timestamps fuera de la ventana
  while (timestamps.length > 0 && timestamps[0] <= now - WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= MAX_RESENDS) {
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED',
      `Demasiados reenvíos de OTP. Máximo ${MAX_RESENDS} por hora.`,
      { max: MAX_RESENDS, window_seconds: 3600, retry_after_seconds: Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000) });
  }

  // 3. Si OTP_SENT, verificar que el OTP anterior expiró
  if (signRequest.estado === 'OTP_SENT' && signRequest.fecha_otp_enviado) {
    const otpExpirado = isExpired(signRequest.fecha_otp_enviado, config.ttl.otpSeconds);
    if (!otpExpirado) {
      throw new AppError(400, 'OTP_NOT_EXPIRED',
        'El OTP actual aún está vigente. Espere a que expire o use el OTP existente.',
        {
          fecha_otp_enviado: signRequest.fecha_otp_enviado,
          ttl_seconds: config.ttl.otpSeconds,
        });
    }
  }

  // 4. Generar nuevo OTP
  const otp = generateOTP();
  const otp_sal = generateSalt();
  const otp_hash = hashWithSalt(otp, otp_sal);
  const now_iso = new Date().toISOString();

  // 5. Obtener correo
  const correo = resolveCorreo(signRequest);
  if (!correo) {
    throw new AppError(400, 'MISSING_EMAIL',
      'No hay correo de verificación disponible para reenviar OTP');
  }

  // 6. Actualizar BD + registrar evento en transacción atómica
  const tx = db.transaction(() => {
    // Si estaba bloqueado, desbloquear
    const wasLocked = signRequest.estado === 'OTP_LOCKED';
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          otp_hash = ?, otp_sal = ?,
          otp_intentos = 0,
          otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(otp_hash, otp_sal, now_iso, signRequest.id);

    signRequestService.registerEvent(signRequest.id, 'OTP_RESENT', {
      canal: 'email',
      correo_destino_enmascarado: maskEmail(correo),
      OTP_ANTERIOR_BLOQUEADO: wasLocked,
    }, 'sistema', ip, user_agent);
  });
  tx();

  // 6.1. Registrar timestamp para rate limiting
  timestamps.push(Date.now());

  // 7. Enviar OTP vía mailer (post-tx, best-effort)
  //    Si el envío falla, el OTP ya quedó generado en BD. El frontend puede
  //    reintentar resend o el usuario puede reportar el problema a RH.
  mailer.sendOTP({
    to: correo,
    otp,
    tipo: 'signature',
    context: { id_solicitud: signRequest.id_solicitud },
  }).then((sendResult) => {
    // Enriquecer auditoría con messageId real
    signRequestService.registerEvent(signRequest.id, 'OTP_RESENT',
      {
        canal: 'email',
        correo_destino_enmascarado: maskEmail(correo),
        messageId: sendResult.messageId || null,
        envio_exitoso: sendResult.ok === true,
      }, 'sistema', ip, user_agent);
  }).catch((err) => {
    logger.warn('Error enviando OTP reenviado', {
      id_solicitud: signRequest.id_solicitud,
      error: err.message,
    });
    signRequestService.registerEvent(signRequest.id, 'OTP_SEND_FAILED',
      {
        canal: 'email',
        error: err.message,
        code: err.code || 'SEND_ERROR',
      }, 'sistema', ip, user_agent);
  });

  logger.info('OTP reenviado', {
    id_solicitud: signRequest.id_solicitud,
    correo_destino: maskEmail(correo),
  });

  // 8. Respuesta pública
  return {
    ok: true,
    estado: 'OTP_SENT',
    otp_ttl_seconds: config.ttl.otpSeconds,
    correo_destino_enmascarado: maskEmail(correo),
  };
}

function clearResendOtpRateLimit() {
  _resendOtpTimestamps.clear();
}

module.exports = {
  resolveToken,
  registerOpenedIfFirst,
  identify,
  verifyOtp,
  resendOtp,
  viewDocument,
  getPdfForToken,
  commit,
  reject,
  consentAccept,
  clearResendOtpRateLimit,
  // FASE 4 · A1.5.4-B: expuesto con prefijo _ para auditoría de consistencia
  // de correo. No es parte del contrato público, pero permite a los scripts
  // de auditoría (audit-consistency-5puntos.js, audit-multi-sr-correos.js)
  // verificar el orden de prioridad metadata > consent sin tener que
  // replicar la lógica.
  _resolveCorreo: resolveCorreo,
};
