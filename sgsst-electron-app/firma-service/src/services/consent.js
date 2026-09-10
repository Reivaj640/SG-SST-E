/**
 * Servicio de Consentimiento del Acuerdo de uso.
 *
 * Maneja el ciclo de vida del consentimiento:
 * - create: crea un consentimiento PENDING, genera OTP, lo envía.
 * - verifyOtp: verifica el OTP y marca como aceptado.
 * - accept: acepta el consentimiento desde la mini-app (UI, sin OTP).
 *   Usado por el Bloque E6.5 (tercera casilla "Acepto el Acuerdo" en
 *   el flujo del firmante). Idempotente.
 *
 * Ver DATA_MODEL.md §3.2 (tabla gh_consentimientos_firma).
 * Ver API.md §6.10 y §6.11.
 *
 * IMPORTANTE: este servicio NO firma documentos. Solo gestiona la
 * aceptación del Acuerdo de uso (mecanismo), que es independiente
 * de la firma de cada documento (contenido).
 */
'use strict';

const db = require('../db/connection');
const config = require('../config');
const { sha256, hashWithSalt, generateSalt } = require('../crypto/hash');
const { generateOTP, verifyOTP, isLocked, isExpired } = require('../crypto/otp');
const mailer = require('./mailer');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

const ESTADO_PENDING = 'OTP_PENDING';
const ESTADO_ACCEPTED = 'ACCEPTED';
const ESTADO_LOCKED = 'OTP_LOCKED';
const ESTADO_EXPIRED = 'EXPIRED';

// Estados terminales para consentimientos: no admiten más transiciones.
// (ACCEPTED se considera terminal a efectos de /expire: un consentimiento
//  aceptado NO puede ser expirado administrativamente — el Acuerdo ya fue
//  firmado y la trazabilidad debe preservarse. Para revocar un consentimiento
//  ya aceptado se necesitaría un flujo de revocación distinto que está
//  fuera del alcance de esta fase.)
const TERMINAL_STATES = new Set([ESTADO_ACCEPTED, ESTADO_EXPIRED]);

/**
 * Busca un consentimiento por su ID interno.
 */
function getById(id) {
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null;
  return db.prepare(`
    SELECT id, id_trabajador, id_empresa, version_acuerdo,
           hash_texto_acuerdo, correo_verificacion, correo_hash,
           otp_hash, otp_sal, otp_intentos, ip, user_agent,
           fecha_aceptacion, fecha_otp_enviado, kair_version,
           manifestacion_aceptada, estado, created_at, updated_at,
           rol_firmante, nombre_aceptante, cargo_aceptante,
           identificacion_aceptante
    FROM gh_consentimientos_firma
    WHERE id = ?
    LIMIT 1
  `).get(id);
}

/**
 * Busca un consentimiento existente para (trabajador, empresa, versión).
 */
function getExisting({ id_trabajador, id_empresa, version_acuerdo, rol_firmante }) {
  var rol = rol_firmante || 'TRABAJADOR';
  // FASE 4 · A1.5.4-B: ORDER BY id DESC para que el consent más reciente
  // gane. Sin ORDER BY, SQLite retorna por ROWID ascendente, lo que causaba
  // que se agarrara un EXPIRED viejo y se ocultara el OTP_PENDING que sí
  // bloquea el UNIQUE INDEX PARCIAL (id_trabajador+id_empresa+version_acuerdo,
  // WHERE estado IN ('OTP_PENDING','OTP_LOCKED')). El bug se manifestaba como
  // 500 INTERNAL_ERROR al intentar crear un nuevo consent cuando coexistían
  // EXPIRED viejos y un OTP_PENDING nuevo. El branching posterior en create()
  // ya distingue EXPIRED/ACCEPTED/OTP_PENDING/OTP_LOCKED correctamente;
  // este ORDER BY solo garantiza que se inspeccione el registro correcto.
  return db.prepare(`
    SELECT id, id_trabajador, id_empresa, version_acuerdo,
           manifestacion_aceptada, estado, otp_intentos,
           fecha_aceptacion, fecha_otp_enviado, rol_firmante
    FROM gh_consentimientos_firma
    WHERE id_trabajador = ?
      AND id_empresa = ?
      AND version_acuerdo = ?
      AND rol_firmante = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(id_trabajador, id_empresa, version_acuerdo, rol);
}

/**
 * Crea un consentimiento para que el trabajador acepte el Acuerdo.
 *
 * Flujo:
 * 1. Verifica que la versión del Acuerdo existe y está activa.
 * 2. Si ya existe un consentimiento ACEPTADO para esa versión,
 *    retorna { alreadyAccepted: true, consent }.
 * 3. Si ya existe un consentimiento PENDING/LOCKED, retorna
 *    { alreadyPending: true, consent } (no crea duplicado).
 * 4. Genera OTP, lo hashea con sal, guarda en BD.
 * 5. Envía OTP al correo.
 *
 * @param {object} opts
 * @param {string} opts.id_trabajador
 * @param {string} opts.id_empresa
 * @param {string} opts.version_acuerdo
 * @param {string} opts.correo_verificacion
 * @param {string} opts.kair_version
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {Promise<{consent: object, alreadyAccepted?: boolean,
 *                    alreadyPending?: boolean, devOtp?: string}>}
 */
async function create({
  id_trabajador, id_empresa, version_acuerdo,
  correo_verificacion, kair_version, ip, user_agent,
}) {
  // 1. Verificar acuerdo activo
  const acuerdo = db.prepare(`
    SELECT version, texto, texto_hash, activa
    FROM gh_firma_acuerdo_versiones
    WHERE version = ? AND activa = 1
    LIMIT 1
  `).get(version_acuerdo);

  if (!acuerdo) {
    throw new AppError(404, 'ACUERDO_NOT_FOUND',
      `No hay versión activa del Acuerdo con identificador '${version_acuerdo}'`);
  }

  // 2. Verificar si ya existe
  const existing = getExisting({ id_trabajador, id_empresa, version_acuerdo });
  if (existing) {
    if (existing.manifestacion_aceptada === 1) {
      return { alreadyAccepted: true, consent: existing };
    }
    if (existing.estado === ESTADO_PENDING) {
      // FASE 2 · A1.5.4-B · RECUPERACIÓN CONSENT_PENDING:
      // si el OTP del consent previo está vencido, expirar atómicamente
      // y dejar caer al flujo de creación normal (nuevo OTP, nuevo mail).
      // Si el OTP sigue vigente, mantener el comportamiento CONSENT_PENDING.
      // Formato del evento CONSENT_EXPIRED consistente con verifyOtp
      // (lines ~239-246): actor='sistema:*', motivo, fecha_otp_enviado, ttl.
      // El UNIQUE INDEX parcial (idx_consentimientos_key_activo, migración 011)
      // solo aplica a estado IN ('OTP_PENDING','OTP_LOCKED'), así que expirar
      // el viejo libera el slot para que el INSERT de abajo no choque.
      if (existing.fecha_otp_enviado &&
          isExpired(existing.fecha_otp_enviado, config.ttl.otpSeconds)) {
        logger.info('Consent previo con OTP vencido; auto-expirando y recreando', {
          consent_id: existing.id,
        });
        try {
          const tx = db.transaction(() => {
            // Re-leer estado DENTRO de la transacción (TOCTOU safety):
            // si otro proceso cambió el estado entre el getExisting y
            // aquí, no auto-expiramos (el caller manejará el caso).
            const current = db.prepare(
              'SELECT estado FROM gh_consentimientos_firma WHERE id = ?'
            ).get(existing.id);
            if (current && current.estado !== ESTADO_PENDING) {
              return;
            }
            db.prepare(`
              UPDATE gh_consentimientos_firma
              SET estado = ?, updated_at = datetime('now')
              WHERE id = ? AND estado = ?
            `).run(ESTADO_EXPIRED, existing.id, ESTADO_PENDING);
            db.prepare(`
              INSERT INTO gh_consentimientos_eventos
                (consent_id, evento, fecha_hora, id_actor, ip, user_agent, metadata)
              VALUES (?, ?, datetime('now'), ?, NULL, NULL, ?)
            `).run(
              existing.id,
              'CONSENT_EXPIRED',
              'sistema:recreate-on-expired',
              JSON.stringify({
                motivo: 'recreate_on_expired_create',
                fecha_otp_enviado: existing.fecha_otp_enviado,
                ttl_seconds: config.ttl.otpSeconds,
              }),
            );
          });
          tx();
        } catch (e) {
          logger.error('Auto-expira falló', {
            consent_id: existing.id,
            error: e.message,
            error_code: e.code,
            stack: e.stack,
          });
          throw new AppError(500, 'AUTO_EXPIRE_FAILED',
            `No se pudo auto-expirar el consentimiento ${existing.id}: ${e.message}`);
        }
        // Continúa al flujo de creación normal (genera nuevo OTP,
        // envía mail, retorna 201 con nuevo consent_id).
      } else {
        return { alreadyPending: true, consent: existing };
      }
    }
    // Si está LOCKED, podemos crear uno nuevo (después de un tiempo
    // de espera, o si RH lo resetea). Por ahora rechazamos.
    if (existing.estado === ESTADO_LOCKED) {
      throw new AppError(409, 'CONSENT_LOCKED',
        'Consentimiento bloqueado por exceso de intentos. Contacta a RRHH.');
    }
  }

  // 3. Generar hashes (NO OTP — FASE 4 rediseño)
  //    El consent del Acuerdo ya no tiene OTP propio. La aceptación
  //    ocurre en la mini-app vía POST /api/sign/:token/consent/accept
  //    (3ª casilla "He leído y acepto el Acuerdo de Firma Electrónica v1.0").
  const correo_sal = generateSalt();
  const correo_hash = hashWithSalt(correo_verificacion, correo_sal);
  const hash_texto_acuerdo = acuerdo.texto_hash;

  // 4. Insertar consentimiento (sin OTP)
  //    otp_hash, otp_sal, fecha_otp_enviado quedan NULL.
  //    El estado default del schema es 'OTP_PENDING' (legacy, no se renombra
  //    en esta migración para evitar recreación de tabla; el significado
  //    actual es simplemente "pendiente de aceptación en la mini-app").
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO gh_consentimientos_firma
        (id_trabajador, id_empresa, version_acuerdo,
         hash_texto_acuerdo, correo_verificacion, correo_hash,
         otp_hash, otp_sal, otp_intentos, ip, user_agent,
         kair_version, manifestacion_aceptada, estado,
         fecha_otp_enviado)
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, ?, NULL)
    `).run(
      id_trabajador, id_empresa, version_acuerdo,
      hash_texto_acuerdo, correo_verificacion, correo_hash,
      ip || null, user_agent || null,
      kair_version, ESTADO_PENDING,
    );
    return result.lastInsertRowid;
  });
  const consentId = tx();

  logger.info('Consentimiento creado (pendiente de aceptación en mini-app)', {
    consent_id: consentId,
    version_acuerdo,
  });

  const consent = getById(consentId);
  return { consent, devOtp: null };
}

/**
 * Garantiza el consentimiento PROPIO del representante legal para un
 * sign request hijo (tipo_firmante='EMPRESA').
 *
 * Motivación (I-FIRMA-DUAL): el hijo se creaba con el consent_id DEL
 * TRABAJADOR y el rep lo "aceptaba" de forma idempotente, sin dejar
 * registro propio (fecha/IP/identidad). La constancia mostraba datos
 * del trabajador como si fueran del rep.
 *
 * - Reutiliza uno existente (mismo trío + rol EMPRESA) si está activo
 *   o ya aceptado (idempotencia entre documentos del mismo expediente).
 * - Si no existe (o el último está expirado), crea uno nuevo PENDING con
 *   los datos del snapshot del representante. Sin envío de correo: el rep
 *   ya se autentica con el OTP del propio sign request hijo.
 *
 * @param {object} opts
 * @param {string} opts.id_trabajador - id del trabajador (vínculo expediente)
 * @param {string} opts.id_empresa
 * @param {string} opts.version_acuerdo
 * @param {string} opts.hash_texto_acuerdo
 * @param {object} opts.rep - { nombre, cargo, correo, tipo_identificacion }
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {string} [opts.kair_version]
 * @returns {{consent: object, reused: boolean}}
 */
function ensureRepConsent({
  id_trabajador, id_empresa, version_acuerdo,
  hash_texto_acuerdo, rep, ip, user_agent, kair_version,
}) {
  if (!rep || !rep.correo) {
    throw new AppError(400, 'INVALID_INPUT',
      'Se requieren los datos del representante (snapshot) para su consentimiento propio');
  }
  const existing = getExisting({
    id_trabajador, id_empresa, version_acuerdo, rol_firmante: 'EMPRESA',
  });
  if (existing && (existing.estado === ESTADO_ACCEPTED || existing.estado === ESTADO_PENDING || existing.estado === ESTADO_LOCKED)) {
    logger.info('Consentimiento del representante reutilizado', {
      consent_id: existing.id,
      estado: existing.estado,
    });
    return { consent: getById(existing.id), reused: true };
  }
  const now = new Date().toISOString();
  const correo_sal = generateSalt();
  const result = db.prepare(`
    INSERT INTO gh_consentimientos_firma
      (id_trabajador, id_empresa, version_acuerdo,
       hash_texto_acuerdo, correo_verificacion, correo_hash,
       otp_hash, otp_sal, otp_intentos, ip, user_agent,
       kair_version, manifestacion_aceptada, estado,
       fecha_otp_enviado,
       rol_firmante, nombre_aceptante, cargo_aceptante,
       identificacion_aceptante)
    VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?, ?, 0, ?, NULL, ?, ?, ?, ?)
  `).run(
    id_trabajador, id_empresa, version_acuerdo,
    hash_texto_acuerdo, rep.correo, hashWithSalt(rep.correo, correo_sal),
    ip || null, user_agent || null,
    kair_version, ESTADO_PENDING,
    'EMPRESA', rep.nombre || null, rep.cargo || null,
    rep.numero_identificacion || null,
  );
  const consent = getById(result.lastInsertRowid);
  logger.info('Consentimiento propio del representante creado', {
    consent_id: consent.id,
    version_acuerdo,
  });
  return { consent, reused: false };
}

/**
 * Verifica el OTP de un consentimiento y lo marca como aceptado.
 *
 * @param {object} opts
 * @param {number} opts.consentId
 * @param {string} opts.otp
 * @param {string} [opts.kair_version]
 * @returns {{ok: true, consent: object} |
 *           {ok: false, code: string, message: string, attempts: number}}
 */
function verifyOtp({ consentId, otp, kair_version }) {
  const consent = getById(consentId);
  if (!consent) {
    throw new AppError(404, 'CONSENT_NOT_FOUND',
      `Consentimiento ${consentId} no encontrado`);
  }

  // Si ya está aceptado, rechazar
  if (consent.manifestacion_aceptada === 1) {
    throw new AppError(409, 'ALREADY_ACCEPTED',
      'Este consentimiento ya fue aceptado');
  }

  // Si está bloqueado
  if (consent.estado === ESTADO_LOCKED) {
    throw new AppError(422, 'OTP_LOCKED',
      'Demasiados intentos. Contacta a RRHH.');
  }

  // Si está en estado distinto a PENDING
  if (consent.estado !== ESTADO_PENDING) {
    throw new AppError(409, 'INVALID_STATE',
      `Estado actual '${consent.estado}' no permite verificación`);
  }

  // FASE 3 (A1.5.4-B): OTP vencido → transición a EXPIRED.
  // Si fecha_otp_enviado está seteado y (now - fecha_otp_enviado) > TTL,
  // el OTP ya no es válido. Transicionamos a EXPIRED y emitimos evento.
  // Si fecha_otp_enviado es NULL (consentimiento legacy pre-migración 010),
  // no podemos calcular expiración → no aplicamos esta rama (fallback
  // seguro, evita romper consentimientos legacy).
  if (consent.fecha_otp_enviado &&
      isExpired(consent.fecha_otp_enviado, config.ttl.otpSeconds)) {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE gh_consentimientos_firma
        SET estado = ?, updated_at = datetime('now')
        WHERE id = ? AND estado = ?
      `).run(ESTADO_EXPIRED, consentId, ESTADO_PENDING);
      db.prepare(`
        INSERT INTO gh_consentimientos_eventos
          (consent_id, evento, fecha_hora, id_actor, ip, user_agent, metadata)
        VALUES (?, ?, datetime('now'), ?, NULL, NULL, ?)
      `).run(
        consentId,
        'CONSENT_EXPIRED',
        'sistema:otp-expiry',
        JSON.stringify({
          motivo: 'otp_expired',
          fecha_otp_enviado: consent.fecha_otp_enviado,
          ttl_seconds: config.ttl.otpSeconds,
        }),
      );
    });
    tx();
    logger.info('Consentimiento expirado por OTP vencido', {
      consent_id: consentId,
      fecha_otp_enviado: consent.fecha_otp_enviado,
    });
    throw new AppError(422, 'OTP_EXPIRED',
      'El código OTP ha vencido. Solicita uno nuevo.',
      { consent_id: consentId });
  }

  // Verificar OTP
  const result = verifyOTP(otp, consent.otp_hash, consent.otp_sal, consent.otp_intentos);

  if (result.valid) {
    // Aceptar
    const fecha_aceptacion = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE gh_consentimientos_firma
        SET manifestacion_aceptada = 1,
            fecha_aceptacion = ?,
            estado = ?,
            otp_intentos = ?,
            kair_version = COALESCE(?, kair_version),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(fecha_aceptacion, ESTADO_ACCEPTED,
             result.attempts, kair_version, consentId);
    });
    tx();

    logger.info('Consentimiento aceptado', { consent_id: consentId });
    return { ok: true, consent: getById(consentId) };
  }

  // OTP incorrecto
  const newAttempts = result.attempts;
  const locked = isLocked(newAttempts, config.ttl.otpMaxAttempts);
  const estado = locked ? ESTADO_LOCKED : ESTADO_PENDING;
  const updateStmt = db.prepare(`
    UPDATE gh_consentimientos_firma
    SET otp_intentos = ?,
        estado = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(newAttempts, estado, consentId);

  logger.warn('OTP incorrecto', {
    consent_id: consentId,
    attempts: newAttempts,
    locked,
  });

  if (locked) {
    throw new AppError(422, 'OTP_LOCKED',
      `Demasiados intentos (${newAttempts}). Consentimiento bloqueado.`,
      { attempts: newAttempts });
  }

  throw new AppError(422, 'OTP_INVALID',
    'El código ingresado no es correcto',
    { attempts: newAttempts, max_attempts: config.ttl.otpMaxAttempts });
}

/**
 * Acepta un consentimiento del Acuerdo de uso desde la mini-app (UI, sin OTP).
 *
 * Esta función es el camino alterno a `verifyOtp` para que el firmante
 * pueda aceptar el Acuerdo v1.0 desde la UI de la mini-app (tercera
 * casilla "Acepto el Acuerdo") en sign requests que ya fueron
 * autenticados por OTP en una sesión previa (Bloque E6.5).
 *
 * A diferencia de `verifyOtp`, este flujo NO usa OTP: la aceptación
 * queda registrada en BD por decisión explícita del firmante (click
 * en checkbox 3), después de que el firmante ya pasó por identify() +
 * verify-otp() para autenticarse. La precondición de estado se valida
 * en el orquestador (publicFlow.consentAccept), que exige que la
 * solicitud esté en OTP_VERIFIED o DOCUMENT_VIEWED.
 *
 * Reglas (en orden de evaluación, cada una con código de error específico):
 *
 *   1. El consentimiento con id = consentId NO existe
 *      → 404 CONSENT_NOT_FOUND
 *
 *   2. signRequest.consent_id !== consentId
 *      → 409 CONSENT_ID_MISMATCH
 *      Defensa contra que un cliente envíe un consentId arbitrario.
 *
 *   3. El consentimiento es de OTRO trabajador
 *      → 409 CONSENT_WORKER_MISMATCH
 *
 *   4. El consentimiento es de OTRA empresa
 *      → 409 CONSENT_COMPANY_MISMATCH
 *
 *   5. El consentimiento es de OTRA versión del Acuerdo
 *      → 409 CONSENT_VERSION_MISMATCH
 *
 *   6. El consentimiento está LOCKED
 *      → 409 CONSENT_LOCKED
 *
 *   7. El consentimiento está manifestacion_aceptada=1
 *      - Si estado = ACCEPTED → idempotente: true (sin UPDATE, sin evento)
 *      - Si estado != ACCEPTED → 409 CONSENT_INCONSISTENT_STATE
 *        (NO corregimos silenciosamente, reportamos el estado)
 *
 *   8. El consentimiento está en estado != OTP_PENDING
 *      → 409 INVALID_STATE
 *
 *   9. UPDATE atómico en transacción con WHERE adicional
 *      (`manifestacion_aceptada = 0 AND estado = 'OTP_PENDING'`)
 *      para protección contra TOCTOU races:
 *      - Si WHERE no matchea (otro request ya aceptó) → idempotente: true
 *      - Si WHERE matchea → marca aceptado y retorna manifestacion_aceptada: true
 *
 *  10. El evento CONSENT_ACCEPTED se registra desde el orquestador
 *      (`publicFlow.consentAccept`), NO aquí, para mantener este
 *      servicio desacoplado de `signRequestService` (consent.js no
 *      debe importar signRequest.js — ese es el patrón del proyecto).
 *      El orquestador lo registra SOLO si esta función retorna
 *      `idempotente: false` (primera aceptación).
 *
 * Si todo OK, retorna { ok: true, idempotente: boolean, consent }.
 *
 * @param {number} consentId
 * @param {object} opts
 * @param {object} opts.signRequest - fila de gh_firmas_electronicas
 *        (necesaria para cross-validate y para que el orquestador
 *        pueda registrar el evento CONSENT_ACCEPTED con firma_id).
 * @returns {{ok: true, idempotente: boolean, consent: object}}
 * @throws AppError 404 / 409 según la regla que falle.
 */
function accept(consentId, { signRequest } = {}) {
  if (!signRequest) {
    throw new AppError(500, 'INTERNAL_ERROR',
      'consentService.accept requiere opts.signRequest');
  }

  // 1. Consentimiento existe
  const consent = getById(consentId);
  if (!consent) {
    throw new AppError(404, 'CONSENT_NOT_FOUND',
      `Consentimiento ${consentId} no encontrado`);
  }

  // 2. Coincide con signRequest.consent_id (defensa contra consentId arbitrario)
  if (signRequest.consent_id !== consentId) {
    throw new AppError(409, 'CONSENT_ID_MISMATCH',
      'El consentimiento no está vinculado a esta solicitud',
      {
        sign_request_id: signRequest.id,
        sign_request_consent_id: signRequest.consent_id,
        provided_consent_id: consentId,
      });
  }

  // 3. Cross-validate mismo trabajador
  if (consent.id_trabajador !== signRequest.id_trabajador) {
    throw new AppError(409, 'CONSENT_WORKER_MISMATCH',
      'El consentimiento pertenece a otro trabajador',
      { consent_id: consent.id });
  }

  // 4. Cross-validate misma empresa
  if (consent.id_empresa !== signRequest.id_empresa) {
    throw new AppError(409, 'CONSENT_COMPANY_MISMATCH',
      'El consentimiento pertenece a otra empresa',
      { consent_id: consent.id });
  }

  // 5. Cross-validate misma versión del Acuerdo
  if (consent.version_acuerdo !== signRequest.agreement_version) {
    throw new AppError(409, 'CONSENT_VERSION_MISMATCH',
      'El consentimiento es de otra versión del Acuerdo',
      { consent_id: consent.id });
  }

  // 6. Locked
  if (consent.estado === ESTADO_LOCKED) {
    throw new AppError(409, 'CONSENT_LOCKED',
      'Consentimiento bloqueado por exceso de intentos. Contacta a RRHH.',
      { consent_id: consent.id });
  }

  // 7. Ya aceptado (idempotente)
  if (consent.manifestacion_aceptada === 1) {
    if (consent.estado !== ESTADO_ACCEPTED) {
      // Inconsistencia detectada: manifestacion_aceptada=1 pero estado != ACCEPTED
      // NO corregimos silenciosamente, reportamos el estado para auditoría.
      throw new AppError(409, 'CONSENT_INCONSISTENT_STATE',
        `Consentimiento marcado como aceptado (manifestacion_aceptada=1) pero con estado '${consent.estado}'`,
        {
          consent_id: consent.id,
          manifestacion_aceptada: 1,
          estado: consent.estado,
          id_solicitud: signRequest.id_solicitud,
        });
    }
    // Idempotente: ya estaba aceptado y estado consistente
    logger.info('Consentimiento ya aceptado (idempotente)', {
      consent_id: consent.id,
      id_solicitud: signRequest.id_solicitud,
    });
    return { ok: true, idempotente: true, consent };
  }

  // 8. Estado debe ser OTP_PENDING
  if (consent.estado !== ESTADO_PENDING) {
    throw new AppError(409, 'INVALID_STATE',
      `Estado actual '${consent.estado}' no permite aceptación`,
      {
        consent_id: consent.id,
        current_state: consent.estado,
        id_solicitud: signRequest.id_solicitud,
      });
  }

  // 9. UPDATE atómico con WHERE para protección TOCTOU.
  //    El WHERE garantiza que si otra request aceptó mientras tanto,
  //    el UPDATE no haga nada y detectemos el race.
  const fecha_aceptacion = new Date().toISOString();
  let wasIdempotent = false;
  const tx = db.transaction(() => {
    const updateResult = db.prepare(`
      UPDATE gh_consentimientos_firma
      SET manifestacion_aceptada = 1,
          fecha_aceptacion = ?,
          estado = ?,
          updated_at = datetime('now')
      WHERE id = ? AND manifestacion_aceptada = 0 AND estado = ?
    `).run(fecha_aceptacion, ESTADO_ACCEPTED, consentId, ESTADO_PENDING);

    if (updateResult.changes === 0) {
      // Otro request aceptó mientras tanto (TOCTOU race)
      wasIdempotent = true;
    }
  });
  tx();

  if (wasIdempotent) {
    logger.info('Consentimiento ya aceptado (race detectada por WHERE)', {
      consent_id: consentId,
      id_solicitud: signRequest.id_solicitud,
    });
    return { ok: true, idempotente: true, consent: getById(consentId) };
  }

  logger.info('Consentimiento aceptado (vía UI)', {
    consent_id: consentId,
    id_solicitud: signRequest.id_solicitud,
  });
  return { ok: true, idempotente: false, consent: getById(consentId) };
}

/**
 * Valida un consentimiento para ser usado en commit() de un sign request.
 *
 * Esta es la pieza clave del Bloque E6: demuestra la cadena legal
 *   Acuerdo v1.0 → Consentimiento ACEPTADO → Sign Request → Firma
 *
 * Reglas (en orden de evaluación, cada una con código de error específico):
 *
 *   1. signRequest.agreement_version IS NULL
 *      → retornar { skip: true } (compatibilidad legacy, no se valida)
 *      Nota: esta rama se decide en el caller (publicFlow.js#commit)
 *      para mantener validateForCommit enfocado en la validación.
 *      Si llegara aquí con agreement_version=NULL, también sería skip
 *      por seguridad (defensa en profundidad).
 *
 *   2. signRequest.consent_id IS NULL
 *      → 409 CONSENT_REQUIRED
 *      "Falta consent_id en un sign request con agreement_version"
 *
 *   3. El consentimiento con id = consent_id NO existe
 *      → 409 CONSENT_NOT_FOUND
 *
 *   4. El consentimiento NO está aceptado (manifestacion_aceptada != 1)
 *      → 409 CONSENT_NOT_ACCEPTED
 *
 *   5. El consentimiento es de OTRO trabajador
 *      → 409 CONSENT_WORKER_MISMATCH
 *
 *   6. El consentimiento es de OTRA empresa
 *      → 409 CONSENT_COMPANY_MISMATCH
 *
 *   7. El consentimiento es de OTRA versión del Acuerdo
 *      → 409 CONSENT_VERSION_MISMATCH
 *
 * Si todo OK, retorna { skip: false, consent: <fila> }.
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas
 * @returns {{skip: true} | {skip: false, consent: object}}
 * @throws AppError 409 con código específico en cualquier falla.
 */
function validateForCommit(signRequest) {
  // Defensa en profundidad: si llegan sign requests legacy,
  // también saltamos (no deberían llegar aquí — el caller decide).
  if (!signRequest.agreement_version) {
    return { skip: true };
  }

  // Paso 2: consent_id obligatorio
  if (signRequest.consent_id === null || signRequest.consent_id === undefined) {
    throw new AppError(409, 'CONSENT_REQUIRED',
      'El sign request requiere un consent_id (Bloque E6) vinculado a un consentimiento ACEPTADO del Acuerdo',
      {
        id_solicitud: signRequest.id_solicitud,
        agreement_version: signRequest.agreement_version,
      });
  }

  // Paso 3: el consentimiento existe
  const consent = getById(signRequest.consent_id);
  if (!consent) {
    throw new AppError(409, 'CONSENT_NOT_FOUND',
      `El consentimiento ${signRequest.consent_id} no existe`,
      {
        consent_id: signRequest.consent_id,
        id_solicitud: signRequest.id_solicitud,
      });
  }

  // Paso 4: manifestacion_aceptada = 1
  if (consent.manifestacion_aceptada !== 1) {
    throw new AppError(409, 'CONSENT_NOT_ACCEPTED',
      'El consentimiento no está aceptado (manifestacion_aceptada != 1)',
      {
        consent_id: consent.id,
        manifestacion_aceptada: consent.manifestacion_aceptada,
        estado: consent.estado,
        id_solicitud: signRequest.id_solicitud,
      });
  }

  // Paso 5: mismo trabajador
  if (consent.id_trabajador !== signRequest.id_trabajador) {
    throw new AppError(409, 'CONSENT_WORKER_MISMATCH',
      'El consentimiento pertenece a otro trabajador',
      {
        consent_id: consent.id,
        consent_id_trabajador: consent.id_trabajador,
        sign_request_id_trabajador: signRequest.id_trabajador,
      });
  }

  // Paso 6: misma empresa
  if (consent.id_empresa !== signRequest.id_empresa) {
    throw new AppError(409, 'CONSENT_COMPANY_MISMATCH',
      'El consentimiento pertenece a otra empresa',
      {
        consent_id: consent.id,
        consent_id_empresa: consent.id_empresa,
        sign_request_id_empresa: signRequest.id_empresa,
      });
  }

  // Paso 7: misma versión del Acuerdo
  if (consent.version_acuerdo !== signRequest.agreement_version) {
    throw new AppError(409, 'CONSENT_VERSION_MISMATCH',
      'El consentimiento es de otra versión del Acuerdo',
      {
        consent_id: consent.id,
        consent_version_acuerdo: consent.version_acuerdo,
        sign_request_agreement_version: signRequest.agreement_version,
      });
  }

  return { skip: false, consent };
}

/**
 * Expira un consentimiento administrativamente (FASE 3 · A1.5.4-B).
 *
 * Caso de uso: un consentimiento quedó colgado en OTP_PENDING porque
 *   (a) el OTP nunca llegó al correo del firmante (typo, SMTP rebotado,
 *       buzón lleno, etc.),
 *   (b) el firmante nunca introdujo el OTP, o
 *   (c) el OTP se envió pero está vencido y nadie intentó verificarlo.
 *
 * Sin esta función, ese consentimiento OTP_PENDING bloquea la creación
 * de un nuevo consentimiento para la misma key
 * (trabajador, empresa, version_acuerdo) por la UNIQUE constraint, y la
 * única forma de "liberarlo" sería hacer UPDATE manual a EXPIRED (lo
 * que hicimos en FASE 1 para consent_id=2 con el typo de correo).
 *
 * Reglas (en orden de evaluación, cada una con código de error específico):
 *
 *   1. Consentimiento no existe
 *      → 404 CONSENT_NOT_FOUND
 *
 *   2. Estado terminal (ACCEPTED o EXPIRED)
 *      → 409 CONSENT_EXPIRE_NOT_ALLOWED
 *      Defensa: no se puede "expirar" un consentimiento que ya fue
 *      aceptado por el firmante (cadena legal rota) ni uno que ya
 *      está expirado (idempotencia vía estado, no vía endpoint).
 *
 *   3. UPDATE atómico con WHERE adicional (`estado NOT IN (terminal)`)
 *      para protección contra TOCTOU races. Si WHERE no matchea,
 *      otro proceso cambió el estado → 409 CONSENT_EXPIRE_NOT_ALLOWED.
 *
 *   4. Insertar evento CONSENT_EXPIRED en gh_consentimientos_eventos
 *      con metadata completa (motivo, actor, estado_anterior, timestamp).
 *
 * Retorna { ok, consent, estado_anterior, already_expired }.
 *
 * @param {object} opts
 * @param {number} opts.consentId
 * @param {string} opts.motivo - Justificación (>=10 chars, <=500)
 * @param {string} opts.actor  - Quién ejecuta la acción (<=100)
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {{ok: true, consent: object, estado_anterior: string,
 *           already_expired: boolean}}
 * @throws AppError 404 / 409 según la regla que falle.
 */
function expireConsent({ consentId, motivo, actor, ip, user_agent }) {
  // Validación de argumentos (defensa en profundidad — el route también
  // valida con zod, pero aquí somos estrictos por si llaman al service
  // directamente).
  if (typeof motivo !== 'string' || motivo.trim().length < 10) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'motivo es requerido (mínimo 10 caracteres)');
  }
  if (typeof actor !== 'string' || actor.length < 1 || actor.length > 100) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'actor es requerido (1-100 caracteres)');
  }

  // 1. Consentimiento existe
  const consent = getById(consentId);
  if (!consent) {
    throw new AppError(404, 'CONSENT_NOT_FOUND',
      `Consentimiento ${consentId} no encontrado`);
  }

  // 2. Estado terminal: ACCEPTED se rechaza, EXPIRED es idempotente.
  //    Diferenciamos ANTES de la transacción para no tener que hacer
  //    un SELECT extra dentro de la tx. La verificación de TOCTOU
  //    se hace dentro de la tx (paso 3).
  if (consent.estado === ESTADO_ACCEPTED) {
    throw new AppError(409, 'CONSENT_EXPIRE_NOT_ALLOWED',
      `No se puede expirar un consentimiento en estado ${consent.estado}`,
      {
        consent_id: consent.id,
        current_state: consent.estado,
        allowed_states: [ESTADO_PENDING, ESTADO_LOCKED, ESTADO_EXPIRED],
      });
  }

  // 3. UPDATE atómico con guard de estado.
  //    WHERE excluye explícitamente los estados terminales para protección
  //    contra TOCTOU races (otro proceso cambió el estado entre el SELECT
  //    y el UPDATE).
  const now = new Date().toISOString();
  const estadoAnterior = consent.estado;
  let alreadyExpired = false;
  const tx = db.transaction(() => {
    // Re-leer estado DENTRO de la transacción por la misma razón que
    // internal-audit.js#revoke: si el estado cambió entre el SELECT
    // externo y aquí, la transición puede no ser segura.
    const current = db.prepare(
      'SELECT estado FROM gh_consentimientos_firma WHERE id = ?'
    ).get(consentId);
    if (!current) {
      throw new AppError(404, 'CONSENT_NOT_FOUND',
        `Consentimiento ${consentId} no encontrado`);
    }
    if (TERMINAL_STATES.has(current.estado)) {
      // Idempotencia: si ya está EXPIRED, devolver éxito sin cambios.
      if (current.estado === ESTADO_EXPIRED) {
        alreadyExpired = true;
        return;
      }
      // ACCEPTED: rechazar.
      throw new AppError(409, 'CONSENT_EXPIRE_NOT_ALLOWED',
        `No se puede expirar un consentimiento en estado ${current.estado}`,
        { consent_id: consentId, current_state: current.estado });
    }
    db.prepare(`
      UPDATE gh_consentimientos_firma
      SET estado = ?, updated_at = datetime('now')
      WHERE id = ? AND estado NOT IN (?, ?)
    `).run(ESTADO_EXPIRED, consentId, ESTADO_ACCEPTED, ESTADO_EXPIRED);
    // Insertar evento de auditoría
    db.prepare(`
      INSERT INTO gh_consentimientos_eventos
        (consent_id, evento, fecha_hora, id_actor, ip, user_agent, metadata)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?)
    `).run(
      consentId,
      'CONSENT_EXPIRED',
      `admin:${actor}`,
      ip || null,
      user_agent || null,
      JSON.stringify({
        motivo,
        actor,
        estado_anterior: current.estado,
        timestamp: now,
        source: 'admin-endpoint',
      }),
    );
  });
  tx();

  if (alreadyExpired) {
    logger.info('Consentimiento ya expirado (idempotente)', {
      consent_id: consentId,
      actor,
    });
    return {
      ok: true,
      consent: getById(consentId),
      estado_anterior: ESTADO_EXPIRED,
      already_expired: true,
    };
  }

  logger.info('Consentimiento expirado por admin', {
    consent_id: consentId,
    estado_anterior: estadoAnterior,
    actor,
  });
  return {
    ok: true,
    consent: getById(consentId),
    estado_anterior: estadoAnterior,
    already_expired: false,
  };
}

module.exports = {
  create,
  verifyOtp,
  accept,
  expireConsent,
  getById,
  getExisting,
  ensureRepConsent,
  validateForCommit,
  ESTADO_PENDING,
  ESTADO_ACCEPTED,
  ESTADO_LOCKED,
  ESTADO_EXPIRED,
};
