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
 * @param {string} tipo_documento
 * @param {string} numero_documento
 * @param {string} ip
 * @param {string} user_agent
 * @returns {Promise<{ok: true, estado, otp_ttl_seconds, correo_destino_enmascarado, devOtp?}>}
 */
async function identify(token, tipo_documento, numero_documento, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Validar que la solicitud está en estado adecuado para identify.
  //    Bloque E8.4: 'DOCUMENT_OPENED' removido del CHECK (estado zombie, no se usa en código).
  const estadosPermitidos = ['PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED', 'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_VIEWED'];
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

  // 4. Validar tipo de documento
  if (signRequest.identificacion_tipo !== tipo_documento) {
    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'El tipo de documento no coincide',
      { expected: signRequest.identificacion_tipo, provided: tipo_documento });
  }

  // 5. Calcular hash SHA-256 de la cédula ingresada y comparar.
  //    K+AIR debe hashear con el mismo método (SHA-256 sin sal).
  const provided_hash = sha256(numero_documento);
  if (provided_hash !== signRequest.identificacion_numero_hash) {
    // Incrementar intentos
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET identificacion_coincidio = 0
      WHERE id = ?
    `).run(signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_FAILED',
      { tipo_documento }, 'trabajador', ip, user_agent);

    throw new AppError(422, 'IDENTIFICATION_FAILED',
      'La identificación no coincide con nuestros registros');
  }

  // 6. Identificación exitosa
  //    Persistimos ip_origen y user_agent del firmante en la fila.
  //    Estos valores se usan luego en el evidence_hash del commit.
  //    COALESCE: si ya hay IP/UA de una identificación previa, los
  //    preservamos (no sobrescribimos). El FAILED no persiste IP/UA
  //    porque un intento fallido puede venir de cualquier red.
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'IDENTIFIED',
          identificacion_coincidio = 1,
          ip_origen = COALESCE(?, ip_origen),
          user_agent = COALESCE(?, user_agent),
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(ip || null, user_agent || null, new Date().toISOString(), signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_COMPLETED',
      { tipo_documento }, 'trabajador', ip, user_agent);
  });
  tx();

  // 7. Generar OTP
  const otp = generateOTP();
  const otp_sal = generateSalt();
  const otp_hash = hashWithSalt(otp, otp_sal);

  // 8. Guardar OTP
  const tx2 = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          otp_hash = ?,
          otp_sal = ?,
          otp_intentos = 0,
          otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(otp_hash, otp_sal, new Date().toISOString(), signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'OTP_SENT',
      { canal: 'email' }, 'sistema', ip, user_agent);
  });
  tx2();

  // 9. Obtener correo (lo guardamos en la solicitud o en consentimiento)
  // Por ahora, usamos un placeholder. K+AIR lo enviará en el flujo.
  // TODO: integrar con la BD de trabajadores cuando exista.
  // Por ahora, lo dejamos en metadata si está disponible.
  const correo = (signRequest.metadata && JSON.parse(signRequest.metadata || '{}').correo) || 'trabajador@ejemplo.com';

  // 10. Enviar OTP
  const sendResult = await mailer.sendOTP({
    to: correo,
    otp,
    tipo: 'signature',
    context: { id_solicitud: signRequest.id_solicitud },
  });

  logger.info('Identificación exitosa, OTP enviado', {
    id_solicitud: signRequest.id_solicitud,
    tipo_documento,
  });

  // 11. Respuesta pública
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
  const pdfFirmadoBuf = await pdfGen.generateSignedPdf(pdfOriginal, {
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    id_trabajador: signRequest.id_trabajador,
    agreement_version: signRequest.agreement_version,
    fecha_firma,
  });
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
  const manifestacion_voluntad_texto = 'He leído, comprendido y acepto el contenido del documento en su totalidad.';
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

  // 9. Generar Constancia (en memoria) — incluye id_constancia
  const constanciaBuf = await pdfGen.generateConstanciaPdf({
    ...evidencia,
    id_constancia,
  });

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
      signRequestService.registerEvent(signRequest.id, 'MANIFESTATION_RECORDED',
        { texto_hash: manifestacion_voluntad_hash },
        'trabajador', ip, user_agent);
      signRequestService.registerEvent(signRequest.id, 'SIGN_COMMITTED',
        { evidence_hash },
        'trabajador', ip, user_agent);
      signRequestService.registerEvent(signRequest.id, 'PDF_GENERATED',
        { path: pdf_firmado_path, size: pdfFirmadoBuf.length, id_constancia },
        'sistema', ip, user_agent);
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
  const correo = (signRequest.metadata && JSON.parse(signRequest.metadata || '{}').correo) || 'trabajador@ejemplo.com';
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

  // 3. UPDATE atómico
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

  // 4. Evento
  signRequestService.registerEvent(signRequest.id, 'REJECTED',
    { motivo_texto: motivo || null }, 'trabajador', ip, user_agent);

  logger.info('Documento rechazado', {
    id_solicitud: signRequest.id_solicitud,
    motivo: motivo || '(sin motivo)',
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
 * Transición (v1 simplificada, Bloque E8.4): OTP_VERIFIED -> DOCUMENT_VIEWED
 *   (v1 salta el estado intermedio DOCUMENT_OPENED — no se usa en código).
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

  // 3. Validar estado: debe estar al menos en OTP_VERIFIED.
  //    Bloque E8.4: 'DOCUMENT_OPENED' y 'MANIFESTATION_RECORDED' removidos del CHECK
  //    (estados zombie). En el flujo real, v1 salta OTP_VERIFIED → DOCUMENT_VIEWED directo.
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_VIEWED'];
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

  // 4. Transición de estado (v1 simplificada, Bloque E8.4).
  //    DOCUMENT_OPENED fue removido del CHECK (estado zombie, no se usa en código).
  //    El flujo va directo: OTP_VERIFIED -> DOCUMENT_VIEWED.
  const now = new Date().toISOString();
  const nuevoEstado = 'DOCUMENT_VIEWED';  // siempre VIEWED (v1)

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

  // 2. Validar estado.
  //    Bloque E8.4: 'DOCUMENT_OPENED' y 'MANIFESTATION_RECORDED' removidos del CHECK
  //    (estados zombie). El PDF se sirve desde OTP_VERIFIED en adelante.
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_VIEWED', 'SIGNED'];
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

module.exports = {
  resolveToken,
  registerOpenedIfFirst,
  identify,
  verifyOtp,
  viewDocument,
  getPdfForToken,
  commit,
  reject,
};
