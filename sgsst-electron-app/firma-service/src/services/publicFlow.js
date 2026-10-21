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
const { hashToken, hashTokenHmac, tokenHashCandidates, tokenTombstoneCandidates } = require('../crypto/token');
const { generateOTP, hashOTP, hashOTPHmac, verifyOTP, verifyOTPHmac, isLocked } = require('../crypto/otp');
const { hashWithSalt, generateSalt, sha256, generateIdSolicitud: _ } = require('../crypto/hash');
const { canonicalJSON } = require('../crypto/compare');
const { algHmac, esAlgHmac } = require('../crypto/hmac');
const identificacion = require('./identificacion');
const ultimos4 = require('./ultimos4');
const sensibles = require('./sensibles');  // 8B: documentos con información de salud (10.8)
const { candidatosBusqueda } = require('./trabajador');
const signRequestService = require('./signRequest');
const consentService = require('./consent');
const mailer = require('./mailer');
const storage = require('./storage');
const pdfGen = require('./pdfGen');
const agreementService = require('./agreement');  // D2: re-validar Acuerdo en view/commit
const empresaService = require('./empresa');
const mediosService = require('./medios');   // 9A: los medios autorizados (el 8.2)
const papelService = require('./papel');   // 9A: la firma autográfica (el 7.1-7.3)
const pdfGenPapel = require('./pdfGenPapel');   // 9A: el Registro de firma autográfica
const conservacion = require('./conservacion');    // 8A.1: vencimiento del plazo (num. 10.6)
const supresion = require('./supresion');        // 8A.2: lápida de la supresión de datos
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const { withAppErrorWrapping, withAppErrorWrappingSync } = require('../utils/errorWrap');
const { isExpired } = require('../crypto/otp');

// Rate limiter en memoria para resend-otp.
// Key: signRequest.id → array de timestamps (ms) de llamadas recientes.
// Se limpia automáticamente cuando la ventana expira.
const _resendOtpTimestamps = new Map();

// Estados en los que la firma YA ocurrió. El 5.4 del Acuerdo de uso obliga
// al Firmante a poder descargar copia del documento firmado desde el propio
// enlace de firma, así que el enlace sigue sirviendo (solo para descargar)
// en estos estados.
const ESTADOS_FIRMADOS = ['SIGNED', 'DUAL_FIRMADO'];

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
 * - La solicitud no ha vencido por CONSERVACIÓN (numeral 10.6)
 * - La solicitud no ha expirado (ventana para firmar)
 * - El estado es adecuado (no terminal)
 *
 * Retorna un objeto con:
 *   { signRequest, estado } si todo OK
 *
 * Lanza AppError si hay algún problema (404 / 410 / 409).
 *
 * OPCIONES
 * --------
 *   permitirHistorico  Operación histórica autorizada (la verificación
 *                      pública y la comparación del PDF firmado). Ignora el
 *                      VENCIMIENTO DEL ENLACE, porque la ventana para firmar
 *                      no debe impedir consultar lo que ya se firmó.
 *                      NO ignora el vencimiento del plazo de conservación:
 *                      ese no es un permiso, es el estado del dato.
 *
 *   permitirFirmado    Deja pasar una solicitud YA FIRMADA para las
 *                      descargas de solo lectura (numeral 5.4). No reabre el
 *                      flujo y no extiende el TTL.
 */
function resolveToken(token, opts) {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'No disponible');
  }

  // Las solicitudes anteriores a la migración 019 guardan SHA-256(token);
  // las nuevas guardan HMAC-SHA256(token). El token es el mismo en ambos
  // casos, así que se prueban todas las huellas candidatas: la fila se
  // encuentra con la que tenga, sin importar cuándo se creó ni con qué
  // versión de llave se calculó.
  const signRequest = signRequestService.getByTokenHash(tokenHashCandidates(token));

  if (!signRequest) {
    // 8A.2 · ¿Hay lápida? La fila ya no está porque su plazo de conservación
    // venció y el dato se suprimió (numeral 10.6). Eso NO es lo mismo que un
    // enlace que nunca existió: la respuesta honesta es "no disponible por
    // vencimiento del plazo", no un 404 que no dice por qué.
    const lapida = supresion.buscarLapidada(tokenTombstoneCandidates(token));
    if (lapida) {
      throw new AppError(410, 'CONSERVACION_VENCIDA', 'No disponible por vencimiento del plazo', {
        fecha_conservacion: lapida.purgado_at,
      });
    }
    // No se confirma la existencia: la misma respuesta para un token que
    // nunca existió y para uno que ya no se puede mostrar.
    throw new AppError(404, 'TOKEN_NOT_FOUND', 'No disponible');
  }

  // 8A.1 · VENCIMIENTO POR CONSERVACIÓN (numeral 10.6).
  //
  // `fecha_conservacion` = fecha_creacion + plazo_retencion_dias, que
  // declara la Empresa. Vencida, el dato se debe suprimir (capa 5B). Mientras
  // la supresión no se haya ejecutado, el sistema NO puede seguir
  // afirmando que la firma está vigente: la respuesta honesta es "no
  // disponible por vencimiento del plazo". Ni "inválido" (mentiría sobre el
  // motivo) ni "firma válida" (afirmaría una vigencia que ya no existe).
  //
  // Este chequeo NO se omite en ningún caso, tampoco en la verificación
  // histórica: omitirlo era justamente el defecto que esta fase cierra
  // (antes bastaba `skipExpirationCheck` para saltárselo todo).
  if (conservacion.vencidaPorConservacion(signRequest)) {
    throw new AppError(410, 'CONSERVACION_VENCIDA', 'No disponible por vencimiento del plazo', {
      fecha_conservacion: signRequest.fecha_conservacion,
    });
  }

  // I-VERIFICACION-PUBLICA: la consulta histórica es READ-ONLY y debe
  // funcionar incluso después de la fecha_expiracion (la ventana para
  // firmar no debe impedir consultar lo que ya se firmó).
  if (opts && opts.permitirHistorico) {
    return { signRequest, estado: signRequest.estado };
  }

  // Verificar expiración
  const now = Date.now();
  const expiresAt = new Date(signRequest.fecha_expiracion).getTime();
  if (now > expiresAt) {
    // Marcar como expirado si aún no lo está (idempotente).
    //
    // DUAL_FIRMADO va en la lista de excluidos: es un estado FIRMADO (el
    // trabajador y el representante ya firmaron). Antes no estaba, así que
    // un enlace de firma dual que se abría después de su vencimiento
    // BORRABA el estado de la firma dual y dejaba la fila en EXPIRED: la
    // evidencia de una firma que sí ocurrió, perdida por un TTL. Un enlace
    // vencido no puede reescribir lo que ya se firmó.
    if (!['EXPIRED', 'SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'REVOKED', 'CANCELLED'].includes(signRequest.estado)) {
      const tx = db.transaction(() => {
        db.prepare(`
          UPDATE gh_firmas_electronicas
          SET estado = 'EXPIRED'
          WHERE id = ? AND estado NOT IN ('SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED')
        `).run(signRequest.id);
        signRequestService.registerEvent(signRequest.id, 'EXPIRED', null, 'sistema');
      });
      tx();
    }
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado', {
      expired_at: signRequest.fecha_expiracion,
    });
  }

  // Estados terminales.
  //
  // Excepción acotada: `permitirFirmado` deja pasar una solicitud YA
  // FIRMADA. No reabre el flujo —identificar, pedir OTP, aceptar el
  // Acuerdo y firmar siguen cerrados en estado firmado—: solo permite
  // descargar lo que ya está firmado, que es lo que pide el 5.4 del
  // Acuerdo de uso ("descargar copia [...] del documento firmado desde el
  // propio enlace de firma"). Los demás terminales (rechazada, revocada,
  // cancelada, vencida) siguen muriendo con 410.
  if (['SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED'].includes(signRequest.estado)) {
    if (opts && opts.permitirFirmado && ESTADOS_FIRMADOS.includes(signRequest.estado)) {
      return { signRequest, estado: signRequest.estado };
    }
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
    // 10.4: este 409 ya NO es un callejón sin salida. La mini-app lo
    // traduce a "leé y aceptá la versión vigente" y recarga el contexto; al
    // aceptar, la solicitud migra (ver `migrarAVersionVigente`).
    throw new AppError(409, 'AGREEMENT_VERSION_NO_LONGER_ACTIVE',
      'El Acuerdo de uso cambió: leé y aceptá la versión vigente para firmar',
      {
        sign_request_version: signRequest.agreement_version,
        active_version: acuerdoActivo ? acuerdoActivo.version : null,
        accion: 'reaceptar_version_vigente',
      });
  }
}

/**
 * Resuelve el Acuerdo de uso que debe leer el firmante de ESTE sign request.
 *
 * Se busca por `agreement_version` (la version ligada a la solicitud), NO por
 * la version activa. Razon: el consentimiento que se registra al marcar la
 * casilla guarda `hash_texto_acuerdo` de esa version puntual. Si la version
 * activa cambia entre que se creo la solicitud y que el firmante abre el
 * enlace, mostrar el texto de la activa haria que el firmante leyera un
 * documento cuyo hash no es el que queda archivado.
 *
 * Los sign requests legacy (`agreement_version = null`) no tienen version
 * ligada: en ese caso se cae al acuerdo activo, que es lo que corresponde
 * porque esos SR no se re-validan contra ninguna version.
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @returns {{version: string, texto: string, texto_hash: string}|null}
 */
/**
 * 10.4 · EL CAMINO POSITIVO DEL 9.5: MIGRAR LA SOLICITUD A LA VERSIÓN
 * VIGENTE DEL ACUERDO.
 *
 * EL PROBLEMA
 * -----------
 * Si se publica una versión nueva del Acuerdo mientras hay solicitudes
 * pendientes, el firmante que llega tarde se encontraba con un 409 sin
 * salida: la solicitud estaba ligada a la versión anterior, esa versión ya no
 * era la vigente, y el sistema le decía que no podía firmar. Eso era
 * IMPEDIR publicar la v1.1: cambiar el hash del Acuerdo sin este camino
 * dejaba a los trabajadores con enlaces colgados.
 *
 * LA SOLUCIÓN
 * -----------
 * El 9.5 dice que "para las firmas posteriores a la entrada en vigencia de
 * una versión nueva, el Trabajador debe leer y aceptar ESA versión nueva en
 * el momento mismo de la firma". O sea: lo que hay que corregir no es el
 * texto que se muestra, es la LIGACIÓN de la solicitud.
 *
 * Al aceptar, la solicitud MIGRA a la versión vigente:
 *
 *   1. Se busca (o se crea) el consentimiento de esa versión para el mismo
 *      trabajador y la misma empresa.
 *   2. La solicitud pasa a apuntar a ese consentimiento y a esa versión, con
 *      su huella.
 *   3. Se deja el evento `AGREEMENT_VERSION_MIGRATED`, con la versión
 *      anterior y la nueva: el cambio de versión queda en la traza.
 *
 * Con eso, el texto que el firmante leyó y el texto que queda archivado (con
 * su huella) SON EL MISMO. No hay dos verdades.
 *
 * Lo que NO se toca: los consentimientos ya aceptados de la versión
 * anterior. Quedan como están: son la prueba de lo que ese trabajador aceptó
 * en su momento. El 9.5 lo dice así ("el Trabajador que haya aceptado una
 * versión anterior se rige por esa versión respecto de las firmas ya
 * realizadas").
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas (se muta)
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{version_anterior: string, version_nueva: string, consent_id: number}|null}
 *   null si no hubo migración.
 */
async function migrarAVersionVigente(signRequest, ip, user_agent) {
  // Los sign requests legacy (sin versión ligada) NO se migran: no tienen
  // con qué compararse y su comportamiento histórico (validar el
  // consentimiento como siempre) se conserva. Es el mismo criterio que
  // `validateForCommit` y `validateAgreementStillActive`.
  if (!signRequest.agreement_version) return null;

  const vigente = agreementService.getActive();
  if (!vigente) return null;

  const versionAnterior = signRequest.agreement_version || null;
  if (versionAnterior === vigente.version) return null;

  // El consentimiento vigente: se reutiliza si ya existe (aceptado o
  // pendiente); si no, se crea con el correo que ya tiene el actual.
  let consentVigente = null;
  try {
    consentVigente = consentService.getExisting({
      id_trabajador: signRequest.id_trabajador,
      id_empresa: signRequest.id_empresa,
      version_acuerdo: vigente.version,
    });
  } catch (e) {
    consentVigente = null;
  }

  if (!consentVigente) {
    const anterior = signRequest.consent_id
      ? db.prepare(
        'SELECT correo_verificacion FROM gh_consentimientos_firma WHERE id = ?'
      ).get(signRequest.consent_id)
      : null;
    const correo = (anterior && anterior.correo_verificacion) || null;
    if (!correo) {
      throw new AppError(409, 'CONSENT_MIGRATION_NO_CORREO',
        'No se pudo migrar la solicitud a la versión vigente del Acuerdo: '
        + 'falta el correo de verificación del trabajador',
        { id_solicitud: signRequest.id_solicitud, version_vigente: vigente.version });
    }
    const creado = await consentService.create({
      id_trabajador: signRequest.id_trabajador,
      id_empresa: signRequest.id_empresa,
      version_acuerdo: vigente.version,
      correo_verificacion: correo,
      kair_version: signRequest.version_kair,
      ip: ip || null,
      user_agent: user_agent || null,
    });
    consentVigente = creado.consent;
  }

  // La solicitud pasa a la versión vigente.
  db.prepare(`
    UPDATE gh_firmas_electronicas
    SET agreement_version = ?, agreement_hash = ?, consent_id = ?
    WHERE id = ?
  `).run(vigente.version, vigente.texto_hash, consentVigente.id, signRequest.id);
  signRequest.agreement_version = vigente.version;
  signRequest.agreement_hash = vigente.texto_hash;
  signRequest.consent_id = consentVigente.id;

  signRequestService.registerEvent(signRequest.id, 'AGREEMENT_VERSION_MIGRATED', {
    version_anterior: versionAnterior,
    version_nueva: vigente.version,
    texto_hash_nuevo: vigente.texto_hash,
    id_consentimiento: consentVigente.id,
    id_solicitud: signRequest.id_solicitud,
  }, 'sistema', ip, user_agent);

  logger.info('Solicitud migrada a la versión vigente del Acuerdo (10.4)', {
    id_solicitud: signRequest.id_solicitud,
    version_anterior: versionAnterior,
    version_nueva: vigente.version,
    id_consentimiento: consentVigente.id,
  });

  return {
    version_anterior: versionAnterior,
    version_nueva: vigente.version,
    consent_id: consentVigente.id,
  };
}

/**
 * El Acuerdo que VE el firmante: la versión VIGENTE (la activa).
 *
 * 10.4 (el camino positivo del 9.5)
 * ----------------------------------
 * El 9.5 dice: "Para las firmas posteriores a la entrada en vigencia de una
 * versión nueva, el Trabajador debe leer y aceptar ESA versión nueva en el
 * momento mismo de la firma."
 *
 * Antes, el texto que se mostraba era el de la versión LIGADA a la
 * solicitud, y si esa versión ya no era la activa, el flujo moría con un 409
 * sin salida: el trabajador no podía firmar y no tenía a dónde ir. Ese 409
 * era la razón por la que NO se podía publicar una v1.1 del Acuerdo.
 *
 * Ahora se muestra y se acepta la versión vigente, y la SOLICITUD MIGRA a
 * esa versión en el momento de la aceptación (ver `consentAccept`). Así el
 * texto que el firmante leyó y el texto que queda archivado (con su huella)
 * son el MISMO: no hay dos verdades, hay una.
 *
 * Los sign requests legacy (`agreement_version = null`) no tienen versión
 * ligada: se les muestra la activa, que es lo que corresponde (no se
 * re-validan contra ninguna versión).
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @returns {{version: string, texto: string, texto_hash: string,
 *   version_ligada: string|null, requiere_aceptar_vigente: boolean}|null}
 */
function resolverAcuerdoVigente(signRequest) {
  let acuerdo = null;
  try {
    acuerdo = agreementService.getActive()
      || (signRequest.agreement_version
        ? agreementService.getByVersion(signRequest.agreement_version)
        : null);
  } catch (_) {
    return null;
  }
  if (!acuerdo || typeof acuerdo.texto !== 'string' || acuerdo.texto.length === 0) {
    return null;
  }
  const versionLigada = signRequest.agreement_version || null;
  return {
    version: acuerdo.version,
    texto: acuerdo.texto,
    texto_hash: acuerdo.texto_hash,
    version_ligada: versionLigada,
    // `true` cuando lo que se muestra NO es lo que la solicitud tiene
    // ligado: el firmante tiene que aceptarlo para poder seguir.
    requiere_aceptar_vigente: !!versionLigada && versionLigada !== acuerdo.version,
  };
}

/**
 * El Acuerdo ARCHIVADO de esta solicitud: el de su versión ligada (que, tras
 * la 10.4, es la vigente en el momento de la aceptación).
 *
 * Para la copia que baja el firmante (5.4) y para la constancia: lo que se
 * archivó es lo que se le entregó.
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @returns {{version: string, texto: string, texto_hash: string}|null}
 */
function resolverAcuerdo(signRequest) {
  let acuerdo = null;
  try {
    acuerdo = signRequest.agreement_version
      ? agreementService.getByVersion(signRequest.agreement_version)
      : agreementService.getActive();
  } catch (_) {
    return null;
  }
  if (!acuerdo || typeof acuerdo.texto !== 'string' || acuerdo.texto.length === 0) {
    return null;
  }
  return {
    version: acuerdo.version,
    texto: acuerdo.texto,
    texto_hash: acuerdo.texto_hash,
  };
}

/**
 * ¿El Firmante ya aceptó el Acuerdo de uso de esta solicitud?
 *
 * Versión LENIENTE: solo mira si el consentimiento vinculado quedó
 * aceptado. Es la que usa la mini-app para saber si puede mostrar el
 * documento; NO es una validación de seguridad y por eso no lanza.
 *
 * La versión ESTRICTA es `exigirAcuerdoAceptado`, que además valida la
 * cadena completa (empresa, trabajador, version).
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @returns {boolean}
 */
function acuerdoAceptado(signRequest) {
  // Legacy sin Acuerdo versionado: no hay a qué exigirse (mismo criterio
  // que validateForCommit).
  if (!signRequest.agreement_version) return true;
  if (!signRequest.consent_id) return false;
  try {
    const c = db.prepare(
      'SELECT manifestacion_aceptada FROM gh_consentimientos_firma WHERE id = ?'
    ).get(signRequest.consent_id);
    return !!(c && c.manifestacion_aceptada === 1);
  } catch (e) {
    return false;
  }
}

/**
 * Exige que el Firmante ya haya leído y aceptado el Acuerdo de uso.
 *
 * El 3.4 del Acuerdo de uso pacta el orden del flujo:
 *
 *   (g) Superada la verificación, el Trabajador lee en pantalla el presente
 *       Acuerdo, en la versión vigente, y lo acepta. [...] El Trabajador no
 *       puede avanzar en el flujo sin leer y aceptar el Acuerdo.
 *   (h) El Trabajador visualiza y descarga el documento objeto de la firma.
 *
 * Es decir: (g) va ANTES de (h). El documento no se sirve hasta que el
 * Acuerdo está aceptado.
 *
 * **Una sola respuesta para todos los casos en que el Firmante todavía no
 * aceptó**: no hay consentimiento vinculado, no existe, no está aceptado, o
 * el dato es inconsistente (otra empresa, otra versión). El Firmante solo
 * necesita saber que tiene que leer y aceptar el Acuerdo; el camino de error
 * no dice nada de la estructura interna ni del consentimiento ajeno.
 *
 * El detalle fino (CONSENT_NOT_FOUND, CONSENT_WORKER_MISMATCH,
 * CONSENT_COMPANY_MISMATCH, CONSENT_VERSION_MISMATCH) lo sigue dando
 * `consentService.validateForCommit` en el commit: ahí el que pregunta es el
 * propio flujo, y el dato inconsistente tiene que ser rastreable.
 *
 * Los sign requests legacy (sin `agreement_version`) se saltan el chequeo,
 * igual que en el commit: no hay Acuerdo versionado al que exigirse.
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @throws AppError 409 CONSENT_NOT_ACCEPTED
 */
function exigirAcuerdoAceptado(signRequest) {
  if (!signRequest.agreement_version) return;

  // 10.4 · La versión vigente tiene que ser la que el firmante aceptó.
  //
  //    Si se publicó una versión nueva DESPUÉS de la aceptación, el
  //    firmante leyó un texto que ya no es el vigente. El documento no se le
  //    muestra hasta que acepte la nueva: es lo que dice el 9.5 ("debe leer
  //    y aceptar esa versión nueva en el momento mismo de la firma").
  let vigente = null;
  try {
    vigente = agreementService.getActive();
  } catch (_) {
    vigente = null;
  }
  if (vigente && vigente.version !== signRequest.agreement_version) {
    throw new AppError(409, 'AGREEMENT_VERSION_REACCEPT_REQUIRED',
      'El Acuerdo de uso cambió: tenés que leer y aceptar la versión vigente '
      + 'para continuar',
      {
        id_solicitud: signRequest.id_solicitud,
        sign_request_version: signRequest.agreement_version,
        active_version: vigente.version,
        accion: 'reaceptar_version_vigente',
      });
  }

  const consent = signRequest.consent_id
    ? db.prepare(
        'SELECT id_empresa, version_acuerdo, manifestacion_aceptada ' +
        'FROM gh_consentimientos_firma WHERE id = ?'
      ).get(signRequest.consent_id)
    : null;

  const aceptado = !!consent
    && consent.manifestacion_aceptada === 1
    && consent.id_empresa === signRequest.id_empresa
    && consent.version_acuerdo === signRequest.agreement_version;

  if (!aceptado) {
    throw new AppError(409, 'CONSENT_NOT_ACCEPTED',
      'Primero debes leer y aceptar el Acuerdo de uso para ver el documento',
      { id_solicitud: signRequest.id_solicitud });
  }
}

/**
 * 8B · EL DATO SENSIBLE (numeral 10.8)
 * =============================================================================
 *
 * El 10.8(a) exige que el Titular sea informado de manera EXPRESA Y PREVIA de
 * que el dato es sensible, de cuáles son los datos y de la finalidad, y que
 * otorgue su CONSENTIMIENTO EXPRESO. El 10.8(b) recuerda que ninguna
 * actividad puede condicionarse a que el Titular SUMINISTRE datos sensibles.
 *
 * El orden es el mismo del Acuerdo en general: el aviso va ANTES, y el
 * documento no se sirve hasta que la autorización está registrada. Por eso
 * la puerta está en `viewDocument` y `getPdfForToken`, igual que la del
 * Acuerdo (3.4(g) antes de (h)).
 */

/**
 * El aviso de dato sensible que la mini-app debe mostrar.
 *
 * El texto está FIJADO en la fila (con su huella y su versión): es
 * exactamente el que se le mostró al Titular, y es el que se archiva con la
 * prueba del consentimiento.
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @returns {object|null} null si el documento no tiene dato sensible.
 */
function resolverDatoSensible(signRequest) {
  if (!signRequest.datos_sensibles) return null;

  let categorias = [];
  try {
    const parseado = JSON.parse(signRequest.categorias_sensibles || '[]');
    if (Array.isArray(parseado)) categorias = parseado;
  } catch (e) {
    categorias = [];
  }

  const baseLegal = signRequest.base_legal_sensible || 'autorizacion_expresa';

  return {
    // El texto del aviso, tal cual se mostró.
    texto: signRequest.aviso_sensible_texto || null,
    hash: signRequest.aviso_sensible_hash || null,
    version: signRequest.aviso_sensible_version || null,
    // Los datos concretos que se tratan (el 10.8(a) exige informarlos).
    categorias,
    // La finalidad del tratamiento.
    finalidad: signRequest.finalidad_sensible || null,
    // La base legal. Con 'autorizacion_expresa' el Titular tiene que
    // autorizar; con 'otra' la base la declaró la Empresa (10.8(c)) y ya
    // está informada en el aviso.
    base_legal: baseLegal,
    // Si la base legal es la autorización expresa, hace falta la casilla
    // separada. Si no, la mini-app solo muestra el aviso.
    requiere_autorizacion: baseLegal === 'autorizacion_expresa',
    // Si el Titular ya autorizó (o si no hacía falta), la mini-app no vuelve
    // a preguntar.
    autorizado: sensibleAutorizado(signRequest),
  };
}

/**
 * ¿Está registrado el consentimiento expreso del dato sensible?
 *
 * @param {object} signRequest
 * @returns {boolean}
 */
function sensibleAutorizado(signRequest) {
  // Con una base legal distinta a la autorización expresa no hay nada que
  // otorgar: el 10.8(c) deja la base en la Empresa, que ya la informó.
  if (signRequest.base_legal_sensible && signRequest.base_legal_sensible !== 'autorizacion_expresa') {
    return true;
  }
  try {
    const prueba = db.prepare(
      'SELECT manifestacion_aceptada FROM gh_consentimientos_sensibles WHERE id_solicitud = ?'
    ).get(signRequest.id_solicitud);
    return !!(prueba && prueba.manifestacion_aceptada === 1);
  } catch (e) {
    // La tabla puede no existir (migración 027 sin aplicar): sin registro no
    // hay autorización.
    return false;
  }
}

/**
 * Exige el consentimiento expreso del dato sensible, si el documento lo es.
 *
 * Se apoya en `exigirAcuerdoAceptado`: una sola respuesta para todos los
 * casos en que el Firmante todavía no ha autorizado. El detalle fino
 * (sensibilidad, categorías) lo da el contexto, que es lo que la mini-app
 * necesita para mostrar el aviso.
 *
 * @param {object} signRequest fila de gh_firmas_electronicas
 * @throws AppError 409 SENSIBLE_CONSENT_NOT_ACCEPTED
 */
function exigirConsentimientoSensible(signRequest) {
  if (!signRequest.datos_sensibles) return;
  if (sensibleAutorizado(signRequest)) return;

  throw new AppError(
    409,
    'SENSIBLE_CONSENT_NOT_ACCEPTED',
    'Este documento contiene información de salud: primero debes leer el aviso y autorizar su tratamiento',
    { id_solicitud: signRequest.id_solicitud }
  );
}

/**
 * Registra el consentimiento expreso del dato sensible.
 *
 * La autorización es un HECHO: se escribe una vez y no se reescribe. Si el
 * Titular vuelve a abrir el enlace y autoriza otra vez, la respuesta es
 * idempotente (no hay una segunda prueba).
 *
 * @param {string} token
 * @param {object} opts
 * @param {boolean} opts.autoriza - lo que el Titular marcó.
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {object}
 */
function consentirDatoSensible(token, { autoriza, ip, user_agent } = {}) {
  const { signRequest } = resolveToken(token);

  if (!signRequest.datos_sensibles) {
    throw new AppError(409, 'NOT_SENSITIVE_DOCUMENT',
      'Este documento no contiene información de salud');
  }

  const aviso = resolverDatoSensible(signRequest);
  const yaEsta = sensibleAutorizado(signRequest);

  if (yaEsta) {
    return { ok: true, idempotente: true, ya_autorizado: true, aviso };
  }

  // Sin la base legal de la autorización expresa no hay nada que otorgar:
  // el 10.8(c) deja la base en la Empresa, que ya la informó en el aviso.
  if (!aviso.requiere_autorizacion) {
    throw new AppError(409, 'CONSENT_NOT_REQUIRED',
      'Este documento se trata con una base legal declarada por la Empresa: no hay autorización que otorgar',
      { base_legal: aviso.base_legal });
  }

  if (autoriza !== true) {
    // No autorizar es el derecho del Titular (el 10.8(a) le informa de que
    // no está obligado). Se registra la NO autorización, para que quede
    // prueba de que se le informó y de que él decidió no autorizar.
    const ya = db.prepare(
      'SELECT id FROM gh_consentimientos_sensibles WHERE id_solicitud = ?'
    ).get(signRequest.id_solicitud);
    if (!ya) {
      db.prepare(`
        INSERT INTO gh_consentimientos_sensibles
          (id_solicitud, id_empresa, id_trabajador, version_aviso, hash_aviso,
           categorias, finalidad, base_legal, base_legal_descripcion,
           manifestacion_aceptada, fecha_manifestacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        signRequest.id_solicitud,
        signRequest.id_empresa,
        signRequest.id_trabajador,
        aviso.version || sensibles.VERSION_AVISO,
        aviso.hash || '',
        JSON.stringify(aviso.categorias || []),
        aviso.finalidad || '',
        aviso.base_legal,
        null,
        new Date().toISOString()
      );
    }
    throw new AppError(409, 'SENSIBLE_CONSENT_NOT_ACCEPTED',
      'Para firmar este documento por medios electrónicos debes autorizar el tratamiento de la información de salud',
      {
        id_solicitud: signRequest.id_solicitud,
        via_alternativa: 'firma_en_papel',
        fundamento: 'numeral 10.8(a) del Acuerdo de uso',
      });
  }

  const ahora = new Date().toISOString();
  db.prepare(`
    INSERT INTO gh_consentimientos_sensibles
      (id_solicitud, id_empresa, id_trabajador, version_aviso, hash_aviso,
       categorias, finalidad, base_legal, base_legal_descripcion,
       manifestacion_aceptada, fecha_manifestacion, fecha_aceptacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    signRequest.id_solicitud,
    signRequest.id_empresa,
    signRequest.id_trabajador,
    aviso.version || sensibles.VERSION_AVISO,
    aviso.hash || '',
    JSON.stringify(aviso.categorias || []),
    aviso.finalidad || '',
    aviso.base_legal,
    null,
    ahora,
    ahora
  );

  try {
    signRequestService.registerEvent(
      signRequest.id,
      'SENSIBLE_CONSENT_ACCEPTED',
      {
        version_aviso: aviso.version,
        hash_aviso: aviso.hash,
        categorias: aviso.categorias,
        base_legal: aviso.base_legal,
      },
      'firmante',
      ip || null,
      user_agent || null
    );
  } catch (e) {
    logger.warn('8B: no se pudo registrar el evento SENSIBLE_CONSENT_ACCEPTED', {
      id_solicitud: signRequest.id_solicitud,
      error: e.message,
    });
  }

  return { ok: true, idempotente: false, ya_autorizado: false, aviso };
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
async function identify(token, tipo_identificacion, numero_documento, ip, user_agent, medioOtp) {
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

  // 5. Comparar la identificación.
  //    La fila guarda un HMAC-SHA256 del hash previo del número de
  //    documento, con clave derivada de la llave maestra del servicio
  //    (migración 019). Quien lea la base de datos no puede recomputar
  //    candidatos: la llave no está ahí.
  //
  //    Las filas anteriores a esa migración guardan el hash pelado (con o
  //    sin sal). Se comparan con su propio algoritmo y, si coinciden, la
  //    fila se reescribe con el HMAC. Así la migración es autosuficiente:
  //    no hay que re-hashear nada a mano ni abrir una ventana de
  //    mantenimiento, y las firmas en curso no se invalidan.
  const verificacion = identificacion.verificar(numero_documento, signRequest);
  if (!verificacion.ok) {
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

  // 5b. Apartar los últimos cuatro dígitos del documento, EN MEMORIA.
  //
  //     El documento en claro acaba de pasar por aquí y no se guarda en
  //     ninguna parte: la fila solo tiene su huella. Pero la constancia
  //     necesita poder mostrarle al firmante los últimos cuatro dígitos
  //     para que confirme visualmente que el documento es el suyo.
  //
  //     Esos cuatro dígitos viajan en memoria hasta el commit y se
  //     descartan ahí. Ver src/services/ultimos4.js para por qué NO van a
  //     la base de datos (el 10.5(a) manda guardar únicamente la huella).
  ultimos4.guardar(
    signRequest.id,
    numero_documento,
    tipo_identificacion
  );

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
  // HMAC-SHA256 con clave derivada de la llave maestra del servicio. La
  // llave vive FUERA de la base de datos: quien lea la tabla no puede
  // recuperar el OTP probando los 10^6 candidatos, que es lo que sí podía
  // con la sal guardada al lado del hash. Es lo que pide el 3.4(e) y el
  // 3.6(e) del Acuerdo de uso.
  const otp_hash = hashOTPHmac(otp, signRequest.id_empresa);
  const otp_sal = null;
  const now_iso = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          identificacion_coincidio = 1,
          ip_origen = COALESCE(?, ip_origen),
          user_agent = COALESCE(?, user_agent),
          otp_hash = ?, otp_sal = ?, otp_alg = ?,
          otp_intentos = 0, otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(ip || null, user_agent || null, otp_hash, otp_sal, algHmac(), now_iso, signRequest.id);

    // Autoupgrade de la fila heredada: si la identificación se había
    // verificado con el algoritmo viejo, ahora se reescribe con el HMAC.
    // Es el momento seguro: la fila ya identificó al firmante.
    if (verificacion.huellaNueva) {
      db.prepare(`
        UPDATE gh_firmas_electronicas
        SET identificacion_numero_hash = ?, identificacion_numero_alg = ?
        WHERE id = ?
      `).run(verificacion.huellaNueva, algHmac(), signRequest.id);
    }
    signRequestService.registerEvent(signRequest.id, 'IDENTIFICATION_COMPLETED',
      { tipo_identificacion }, 'trabajador', ip, user_agent);
  });
  tx();

  // 9. D-2: el OTP (dato de creación) va al medio PERSONAL que declaró
  //    el Trabajador; la invitación (token) sigue yendo al contacto
  //    registrado por la Empresa. El medio declarado queda congelado en la fila.
  if (medioOtp) {
    declararMedioOtp(signRequest, medioOtp);
  }
  const destinoOtp = resolveCorreoOtp(signRequest, medioOtp);
  const correo = destinoOtp.correo;
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
 * D-2 · A DÓNDE VA EL OTP (y a dónde NO va la invitación).
 *
 * EL PROBLEMA
 * -----------
 * `correo_verificacion` cumple dos papeles: a dónde va la INVITACIÓN (con el
 * token de acceso) y a dónde va el OTP (el dato de creación). Y la app de
 * escritorio lo precarga con el correo del trabajador en el registro de la
 * Empresa: en la práctica, el OTP le llega a un buzón que la Empresa puede
 * leer.
 *
 * El 2.2.2.47.4 num. 1 dice que "los datos de creación de la firma, en el
 * contexto en que son utilizados, corresponden exclusivamente al firmante".
 * Un OTP entregado a un buzón de la Empresa rompe esa condición en el
 * contexto en que se usa.
 *
 * LA DECISIÓN (owner, 2026-10-20)
 * -------------------------------
 * Separar los dos canales:
 *
 *   - La INVITACIÓN (el token) sigue yendo al contacto registrado por la
 *     Empresa. En el contexto de uso no es un factor: sin el OTP no se
 *     firma.
 *   - El OTP va a un medio PERSONAL que declara el propio Trabajador.
 *
 * EL RECHAZO (D2) Y CUÁNDO SE ACTIVA
 * ---------------------------------
 * El rechazo (400 con el texto del 3.7(a) al lado) está en el código, pero
 * **APAGADO** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`, default false). Se enciende
 * cuando exista la 9A (la firma en papel): sin esa salida, exigir un medio
 * personal sería una barrera de acceso al empleo (el 2.2.1.1.11).
 *
 * Mientras tanto, cada caso en el que el OTP va a (o pasaría por) un buzón
 * corporativo queda en el log como WARN, que es de donde sale el número del
 * inventario.
 *
 * @param {object} signRequest
 * @param {string} [medioDeclarado] - el medio que declaró el Trabajador
 * @returns {{correo: string|null, origen: string, riesgo_47_4: boolean}}
 */
/**
 * Declara el medio personal del OTP desde la vápica pública (D-2).
 *
 * @param {string} token
 * @param {string} medio
 * @returns {{correo_otp: string, congelado: boolean}}
 */
function declararMedioPublico(token, medio) {
  const { signRequest } = resolveToken(token);
  return declararMedioOtp(signRequest, medio);
}

function resolveCorreoOtp(signRequest, medioDeclarado, correoBase) {
  // `correoBase` permite que quien ya resolvio el contacto (el reenvio de OTP
  // usa el del consentimiento) lo conserve: la regla del D-2 cambia el
  // DESTINO, no la prioridad de resolucion.
  const contacto = correoBase || resolveCorreo(signRequest);
  const declarado = (medioDeclarado || signRequest.correo_otp || '');
  const medio = (typeof declarado === 'string' ? declarado.trim().toLowerCase() : '');

  const evaluar = (correo, origen) => {
    if (!correo) return { correo: null, origen, riesgo_47_4: false };
    const corporativo = empresaService.esDominioCorporativo(correo, signRequest.id_empresa);
    if (corporativo) {
      if (config.exigirMedioPersonalOtp) {
        // El mensaje NO manda a una puerta que no existe en el producto: la
        // vía en papel no es un botón de la mini-app, es el canal de atención
        // de la Empresa. Por eso el mensaje dice a quién le pedirlo.
        const empresaDelCanal = empresaService.getById(signRequest.id_empresa);
        const canalEmpresa = empresaDelCanal ? (empresaDelCanal.canal_pqrs || null) : null;
        throw new AppError(400, 'MEDIO_OTP_CORPORATIVO',
          'Ese buzón es del dominio de la Empresa. Si la Empresa puede leer ese '
          + 'buzón, también puede leer el código de verificación, y entonces los '
          + 'datos de creación de la firma no corresponderían exclusivamente al '
          + 'Firmante (numeral 3.7(a) y 2.2.2.47.4 num. 1), con lo que la '
          + 'garantía del 6.1(d) sería falsa. Usá un medio personal, o '
          + 'pedile a tu Empresa la firma en papel (numeral 7.2 del Acuerdo): '
          + 'es tu derecho y no tiene costo.',
          {
            id_solicitud: signRequest.id_solicitud,
            origen,
            dominio_corporativo: true,
            canal_empresa: canalEmpresa,
          });
      }
      logger.warn('El OTP va a un buzón que la Empresa puede leer: el 47.4 queda en riesgo', {
        id_solicitud: signRequest.id_solicitud,
        id_empresa: signRequest.id_empresa,
        origen,
        aviso: 'OTP_MEDIO_CORPORATIVO',
      });
    }
    return { correo, origen, riesgo_47_4: corporativo };
  };

  // 1. El medio que declaró el Trabajador manda.
  if (medio && medio.includes('@')) {
    return evaluar(medio, 'declarado_por_el_trabajador');
  }

  // 2. Sin medio declarado: el contacto registrado de la Empresa.
  return evaluar(contacto, 'contacto_registrado');
}

/**
 * Declara (o congela) el medio personal del Trabajador para el OTP.
 *
 * Se congela: una vez que el OTP salió, el medio ya no se cambia (el código
 * ya viaja). Antes de eso, se puede corregir.
 *
 * @param {object} signRequest
 * @param {string} medio
 * @returns {{correo_otp: string, congelado: boolean}}
 */
function declararMedioOtp(signRequest, medio) {
  const correo = (typeof medio === 'string' ? medio.trim().toLowerCase() : '');
  if (!correo || !correo.includes('@')) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El medio para el código de verificación no parece un correo');
  }

  // Ya se envió un OTP: el medio queda congelado.
  if (signRequest.correo_otp && signRequest.fecha_otp_enviado) {
    return { correo_otp: signRequest.correo_otp, congelado: true };
  }

  db.prepare(
    'UPDATE gh_firmas_electronicas SET correo_otp = ? WHERE id = ?'
  ).run(correo, signRequest.id);
  signRequest.correo_otp = correo;

  // 9A (el 8.2): el medio declarado entra al REGISTRO de medios autorizados.
  // Nace PENDIENTE: hasta que el Trabajador verifique el codigo no demostro
  // que controla el buzon, y por ese medio no se le puede entregar una copia.
  if (signRequest.id_trabajador) {
    mediosService.registrar({
      id_empresa: signRequest.id_empresa,
      id_trabajador: signRequest.id_trabajador,
      tipo: 'CORREO_OTP',
      valor: correo,
      origen: 'TRABAJADOR',
      estado: 'PENDIENTE',
    });
  }

  logger.info('Medio para el OTP declarado por el Trabajador', {
    id_solicitud: signRequest.id_solicitud,
    id_empresa: signRequest.id_empresa,
  });
  return { correo_otp: correo, congelado: false };
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

// Busca el primer evento de una línea de tiempo para un set de nombres.
function _firstEvent(rows, names) {
  const wanted = new Set(names);
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    if (row && wanted.has(row.evento)) return row;
  }
  return null;
}

// Resume la línea de tiempo en los hitos que una persona espera ver primero.
function _buildHitosFirma(rows, signRequest, fechaFirma) {
  const enviado = _firstEvent(rows, ['INVITE_SENT', 'CREATED']);
  const visto = _firstEvent(rows, ['DOCUMENT_VIEWED', 'DOCUMENT_OPENED', 'OPENED']);
  const acuerdo = _firstEvent(rows, ['CONSENT_ACCEPTED']);
  const manifestacion = _firstEvent(rows, ['MANIFESTATION_RECORDED']);
  const firmado = _firstEvent(rows, ['SIGN_COMMITTED']);
  const constancia = _firstEvent(rows, ['PDF_GENERATED']);

  return [
    { label: 'Solicitud enviada', fecha_hora: enviado ? enviado.fecha_hora : signRequest.fecha_creacion, estado: 'Registrada' },
    { label: 'Documento visualizado', fecha_hora: visto ? visto.fecha_hora : signRequest.fecha_documento_visto, estado: 'Lectura confirmada' },
    { label: 'Acuerdo aceptado', fecha_hora: acuerdo ? acuerdo.fecha_hora : null, estado: 'Consentimiento registrado' },
    { label: 'Manifestación registrada', fecha_hora: manifestacion ? manifestacion.fecha_hora : fechaFirma, estado: 'Voluntad confirmada' },
    { label: 'Firma completada', fecha_hora: firmado ? firmado.fecha_hora : fechaFirma, estado: 'Integridad verificada' },
    { label: 'Constancia generada', fecha_hora: constancia ? constancia.fecha_hora : fechaFirma, estado: 'Constancia emitida' },
  ];
}

// Lee el consentimiento vinculado (si existe) para mostrarlo en la constancia.
function _getConsentResumen(consentId) {
  if (!consentId) return null;
  try {
    return db.prepare(`
      SELECT id, version_acuerdo, hash_texto_acuerdo, fecha_aceptacion,
             rol_firmante, nombre_aceptante, cargo_aceptante,
             empresa_snapshot, empresa_hash
      FROM gh_consentimientos_firma
      WHERE id = ?
    `).get(consentId) || null;
  } catch (_) {
    return null;
  }
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
 * @param {object} opts - { manifestacion_aceptada }
 *   (SOLO eso: la firma visual en PNG no se admite y el endpoint la rechaza
 *   con un 400 que lo dice. Ver routes/public.js, `rechazarFirmaVisual`.)
 * @returns {Promise<{ok: true, estado, evidence_hash, fecha_firma, ...}>}
 */
async function commit(token, opts, ip, user_agent) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 1b. Metadata archivada del sign request (la envía K+AIR): de ahí salen
  //     los datos LEGIBLES del firmante (nombre) y de la empresa. Se lee
  //     temprano porque el PDF firmado y la constancia los necesitan.
  let _srMeta = {};
  try { _srMeta = signRequest.metadata ? JSON.parse(signRequest.metadata) : {}; } catch (e) { _srMeta = {}; }
  if (!_srMeta || typeof _srMeta !== 'object') _srMeta = {};

  // 📦 I-FIRMA-DUAL (v0.1.180): detectar si este commit es del representante
  // legal (sign request hijo con tipo_firmante='EMPRESA'). Si lo es, el PDF
  // generado lleva las 2 firmas (trabajador del padre + empresa del rep) y al
  // final del commit ambos sign requests (padre e hijo) quedan en estado
  // DUAL_FIRMADO. Si NO lo es, flujo legacy intacto (1 firma del worker).
  const isCompanyCommit = signRequest.tipo_firmante === 'EMPRESA';

  // Helper para determinar el rol del firmante según tipo_firmante
  function getActorRole(signRequest) {
    return signRequest.tipo_firmante === 'EMPRESA' ? 'empresa' : 'trabajador';
  }

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
  const paginasDocumentoOriginal = await withAppErrorWrapping(
    () => pdfGen.getPdfPageCount(pdfOriginal),
    'PDF_GENERATION_FAILED',
    'No se pudo leer el número de páginas del PDF original',
  );

  // 6. Generar PDF firmado (con metadata XMP).
  //    El XMP incluye id_solicitud, agreement_version, fecha_firma.
  //    NO incluye document_hash_firmado ni evidence_hash (chicken-and-egg:
  //    ambos se calculan DESPUÉS de generar el PDF y persisten en BD).
  const fecha_firma = new Date().toISOString();
  const pdfFirmadoBuf = await withAppErrorWrapping(
    async () => {
      if (isCompanyCommit) {
        // 📦 I-FIRMA-DUAL: el rep está firmando (hijo con tipo_firmante='EMPRESA').
        // Construir array de 2 firmas: el worker del PADRE (ya firmó) + la
        // empresa del rep actual. El PDF sale con 3 páginas (original + sello
        // + constancia dual visible). Usamos el padreRow para recuperar la
        // fecha_firma del worker y sus datos identificativos.
        const padreRow = db.prepare(
          'SELECT * FROM gh_firmas_electronicas WHERE id_solicitud = ?'
        ).get(signRequest.parent_id_solicitud);
        const padreMeta = padreRow?.metadata ? JSON.parse(padreRow.metadata) : {};

        const firmasParaPdf = [
          {
            tipo: 'TRABAJADOR',
            firmante: {
              id_trabajador: padreRow?.id_trabajador,
              // El nombre humano viene del metadata archivado del padre
              // (`nombre_trabajador`). `id_trabajador` es el seudónimo: no
              // sirve como nombre en el PDF.
              nombre: padreMeta.nombre_trabajador || null,
              identificacion: (padreRow?.identificacion_tipo || '')
                + ' '
                + (padreRow?.identificacion_numero_hash?.substring(0, 6) || '***'),
            },
            fecha_firma: padreRow?.fecha_manifestacion || padreRow?.fecha_firma,
            id_solicitud_firmante: padreRow?.id_solicitud,
          },
          {
            tipo: 'EMPRESA',
            firmante: {
              id_trabajador: null,
              // Nombre real desde el snapshot (antes: literal genérico).
              nombre: (function () {
                try {
                  var s = signRequest.representante_legal_snapshot
                    ? JSON.parse(signRequest.representante_legal_snapshot) : null;
                  if (s && s.nombre) return s.nombre;
                } catch (e) { /* noop */ }
                return 'Representante legal';
              })(),
              // Los datos del rep están en representante_legal_snapshot del
              // padre (se snapshotearon al crear el padre con la flag activa);
              // pero para identificar al firmante actual usamos la
              // identificación que ÉL ingresó durante identify() en este
              // commit (signRequest.identificacion_*).
              identificacion: (signRequest.identificacion_tipo || '')
                + ' '
                + (signRequest.identificacion_numero_hash?.substring(0, 6) || '***'),
            },
            fecha_firma: signRequest.fecha_manifestacion || new Date().toISOString(),
            id_solicitud_firmante: signRequest.id_solicitud,
          },
        ];

        return pdfGen.generateSignedPdf(pdfOriginal, {
          id_solicitud: signRequest.id_solicitud,
          id_documento: signRequest.id_documento,
          agreement_version: signRequest.agreement_version,
          fecha_firma: new Date().toISOString(),
          firmas: firmasParaPdf,
          // Pasar también `firmante_display` para que addSelloPage muestre
          // al rep (firmante actual de este commit), NO al worker del padre.
          firmante_display: firmasParaPdf[1].firmante,
        });
      } else {
        // Flujo legacy (1 firma del worker). Se pasa también `firmante_display`
        // poblado con el nombre del firmante para que addSelloPage lo use.
        // `id_trabajador` es el seudónimo del trabajador (migración 019): no
        // es un nombre humano, así que no se usa como nombre en el PDF. Antes
        // de la migración 019 ese campo era la cédula, y el PDF firmado
        // mostraba la cédula completa del trabajador.
        return pdfGen.generateSignedPdf(pdfOriginal, {
          id_solicitud: signRequest.id_solicitud,
          id_documento: signRequest.id_documento,
          id_trabajador: signRequest.id_trabajador,
          agreement_version: signRequest.agreement_version,
          fecha_firma,
          nombre_trabajador: _srMeta.nombre_trabajador || null,
          identificacion_enmascarada: identificacion.enmascarar(
            signRequest.identificacion_tipo,
            signRequest.identificacion_numero_hash
          ),
          firmante_display: {
            id_trabajador: signRequest.id_trabajador,
            nombre: _srMeta.nombre_trabajador || null,
            identificacion: identificacion.enmascarar(
              signRequest.identificacion_tipo,
              signRequest.identificacion_numero_hash
            ),
          },
        });
      }
    },
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
  // (`_srMeta` ya se leyó al inicio del commit.)

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
      // La fila puede guardar el seudónimo del trabajador (migración 019) o
      // el documento crudo (filas anteriores). Se prueban las dos cosas.
      const cands = candidatosBusqueda(signRequest.id_trabajador, signRequest.id_empresa);
      if (cands.length) {
        const ph = cands.map(() => '?').join(',');
        const siblings = db.prepare(
          "SELECT metadata FROM gh_firmas_electronicas WHERE id_trabajador IN (" + ph + ") AND id_empresa = ? AND metadata IS NOT NULL AND metadata != '' ORDER BY fecha_creacion DESC LIMIT 5"
        ).all(...cands, signRequest.id_empresa);
        for (const sib of siblings) {
          const sm = _parseMetaSafe(sib.metadata);
          if (!nombreEmpresa && sm.nombre_empresa) nombreEmpresa = sm.nombre_empresa;
          if (!nombreTrabajador && sm.nombre_trabajador) nombreTrabajador = sm.nombre_trabajador;
          if (nombreEmpresa && nombreTrabajador) break;
        }
      }
    } catch (e) { /* noop */ }
  }

  const correoConstancia = resolveCorreo(signRequest); // ya tiene fallback a consent
  const consentResumen = _getConsentResumen(signRequest.consent_id);

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
  let hitosFirma = [];
  try {
    const _rows = db.prepare(`
      SELECT evento, fecha_hora, ip, id_actor
      FROM gh_firma_eventos
      WHERE firma_id = ?
      ORDER BY fecha_hora ASC, id ASC
    `).all(signRequest.id);
    eventosTotal = _rows.length + 3; // +3 eventos sintéticos del commit
    const actorRole = signRequest.tipo_firmante === 'EMPRESA' ? 'empresa' : 'trabajador';
    _rows.push(
      { evento: 'MANIFESTATION_RECORDED', fecha_hora: fecha_firma, ip: ip || null, id_actor: actorRole },
      { evento: 'SIGN_COMMITTED', fecha_hora: fecha_firma, ip: ip || null, id_actor: actorRole },
      { evento: 'PDF_GENERATED', fecha_hora: fecha_firma, ip: ip || null, id_actor: 'sistema' },
    );
    hitosFirma = _buildHitosFirma(_rows, signRequest, fecha_firma);
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

  // Identificación de la empresa tal como se le MOSTRÓ al firmante en el
  // bloque del numeral 1.2 del Acuerdo. Se lee del snapshot archivado en el
  // consentimiento, NO de gh_firma_empresas: la fila de la empresa es
  // editable y hoy puede no ser la que el firmante vio. Sin esto, la
  // constancia cumpliría con mostrar la identificación equivocada.
  const empresaIdentificacion = consentResumen
    ? empresaService.parseSnapshotParaMostrar(
      consentResumen.empresa_snapshot,
      signRequest.id_empresa,
      { hashEsperado: consentResumen.empresa_hash }
    )
    : null;

  const constanciaMetadata = {
    ...evidencia,
    evidence_hash,            // fix: el objeto evidencia no lo trae de fábrica
    id_constancia,
    // Referencia legible de la identificación del firmante: los primeros 6
    // caracteres de la huella archivada (misma convención que la página de
    // verificación pública y el PDF de firma dual). Antes se mostraban los
    // últimos 4 dígitos del documento, que salía del `id_trabajador` en
    // claro; con el seudónimo (migración 019) eso ya no es posible ni
    // tiene sentido: la huella es lo que el servicio puede mostrar.
    identificacion_enmascarada: identificacion.enmascarar(
      signRequest.identificacion_tipo,
      signRequest.identificacion_numero_hash
    ),
    // Últimos cuatro dígitos del documento, APARTADOS EN MEMORIA en el
    // identify() (ver src/services/ultimos4.js). No vienen de la base: no
    // están en la base. Si el proceso se reinició entre la identificación y
    // la firma, esto viene null y la constancia sale solo con la referencia
    // opaca, que es el comportamiento de siempre.
    identificacion_ultimos4: (function () {
      const u4 = ultimos4.obtener(signRequest.id);
      return u4 ? u4.digitos : null;
    })(),
    nombre_empresa: nombreEmpresa,
    nombre_trabajador: nombreTrabajador,
    correo_trabajador: correoConstancia || null,
    correo_emisor: config.smtp.fromEmail || null,
    asunto_documento: _srMeta.asunto_documento || _srMeta.titulo_documento || signRequest.id_documento,
    paginas_documento_original: paginasDocumentoOriginal,
    hitos_firma: hitosFirma,
    consent_id: consentResumen ? consentResumen.id : null,
    fecha_aceptacion_acuerdo: consentResumen ? consentResumen.fecha_aceptacion : null,
    empresa_identificacion: empresaIdentificacion,
    empresa_hash: consentResumen ? consentResumen.empresa_hash : null,
    zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    nivel_seguridad: 'Correo verificado + código temporal por correo + manifestación expresa',
    control_registro: {
      estado: 'Original firmado',
      titular: nombreEmpresa || signRequest.id_empresa,
      ubicacion: 'K+AIR Firma Electrónica',
      generado_en: fecha_firma,
    },
    eventos: eventosConstancia,
    eventos_total: eventosTotal,
  };

  // Una sola generación: el número de páginas de la constancia lo cierra
  // pdfGen internamente justo antes de guardar el buffer.
  const constanciaBuf = await withAppErrorWrapping(
    () => pdfGen.generateConstanciaPdf(constanciaMetadata),
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
      const actorRole = signRequest.tipo_firmante === 'EMPRESA' ? 'empresa' : 'trabajador';
      withAppErrorWrappingSync(
        () => signRequestService.registerEvent(signRequest.id, 'MANIFESTATION_RECORDED',
          { texto_hash: manifestacion_voluntad_hash },
          actorRole, ip, user_agent),
        'EVENT_REGISTRATION_FAILED',
        'No se pudo registrar el evento MANIFESTATION_RECORDED',
      );
      withAppErrorWrappingSync(
        () => signRequestService.registerEvent(signRequest.id, 'SIGN_COMMITTED',
          { evidence_hash },
          actorRole, ip, user_agent),
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
  //
  //     D-2: la copia va al CONTACTO REGISTRADO por la Empresa (el mismo
  //     canal que la invitación), no al medio personal del OTP. Son dos
  //     canales distintos: el OTP es el dato de creación; la copia es la
  //     evidencia que la Empresa le debe a su trabajador.
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

  // 📦 I-FIRMA-DUAL: trigger para crear el hijo si requiere_firma_empresa=1
  // Va DESPUÉS de la firma del padre (paso 11) y del envío de copia (paso 13).
  // Si falla la creación del hijo, NO revertir el commit del padre — el padre
  // ya firmó legalmente y el snapshot permite reproceso manual por RH.
  if (signRequest.requiere_firma_empresa === 1) {
    try {
      const representante = signRequest.representante_legal_snapshot
        ? JSON.parse(signRequest.representante_legal_snapshot)
        : null;

      if (!representante || !representante.correo) {
        logger.error('firma-dual: padre requiere firma empresa pero sin snapshot del representante', {
          id_solicitud: signRequest.id_solicitud,
        });
        // NO fallar el commit del worker — el padre ya firmó
      } else {
        await signRequestService.createForCompany({
          parent_id_solicitud: signRequest.id_solicitud,
          id_empresa: signRequest.id_empresa,
          id_documento: signRequest.id_documento,
          representante,
        });

        // 📦 Registrar evento de auditoría
        signRequestService.registerEvent(
          signRequest.id,
          'COMPANY_FIRMA_DISPARADA',
          { parent: signRequest.id_solicitud, rep_correo: representante.correo },
          'server', null, null
        );

        logger.info('firma-dual: hijo creado automáticamente', {
          padre: signRequest.id_solicitud,
          rep_correo: representante.correo,
        });
      }
    } catch (err) {
      // Si falla la creación del hijo, NO revertir el commit del padre
      logger.error('firma-dual: error creando hijo', {
        padre: signRequest.id_solicitud,
        error: err.message,
        stack: err.stack,
      });
    }
  }

  // 📦 I-FIRMA-DUAL (v0.1.180): cierre de la firma dual.
  // Si este commit es del rep (tipo_firmante='EMPRESA'), el PDF ya fue
  // generado con las 2 firmas y enviado. Ahora: marcar AMBOS sign requests
  // (padre e hijo) como DUAL_FIRMADO y registrar COMPANY_FIRMA_COMPLETADA.
  // Se hace en try/catch separado: si falla, NO revertir el commit — el PDF
  // ya está firmado y enviado al correo; el estado DUAL_FIRMADO puede
  // corregirse por reproceso manual de RH sin perder la firma legal.
  if (isCompanyCommit) {
    try {
      db.prepare(
        "UPDATE gh_firmas_electronicas SET estado = 'DUAL_FIRMADO' WHERE id_solicitud = ?"
      ).run(signRequest.parent_id_solicitud);
      db.prepare(
        "UPDATE gh_firmas_electronicas SET estado = 'DUAL_FIRMADO' WHERE id_solicitud = ?"
      ).run(signRequest.id_solicitud);

      signRequestService.registerEvent(
        signRequest.id,
        'COMPANY_FIRMA_COMPLETADA',
        {
          parent: signRequest.parent_id_solicitud,
          hijo: signRequest.id_solicitud,
          documento_hash_dual: document_hash_firmado,
        },
        'server', null, null
      );

      logger.info('firma-dual: DUAL_FIRMADO', {
        padre: signRequest.parent_id_solicitud,
        hijo: signRequest.id_solicitud,
      });
    } catch (err) {
      logger.error('firma-dual: error marcando DUAL_FIRMADO', {
        error: err.message,
        stack: err.stack,
        padre: signRequest.parent_id_solicitud,
        hijo: signRequest.id_solicitud,
      });
      // NO fallar el commit — el PDF ya está generado y enviado
    }
  }

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
  // Misma búsqueda que resolveToken: se prueban todas las huellas del token
  // (SHA-256 en las filas viejas, HMAC en las nuevas, y cada versión de
  // llave del anillo).
  const signRequest = signRequestService.getByTokenHash(tokenHashCandidates(token));
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

  // 2. Exigir el Acuerdo ACEPTADO (3.4(g) va antes de (h)).
  //
  //    El orden pactado es: (g) leer y aceptar el Acuerdo → (h) visualizar
  //    y descargar el documento. El 3.4(g) lo dice sin rodeos: "El Trabajador
  //    no puede avanzar en el flujo sin leer y aceptar el Acuerdo". Antes de
  //    esta fase, con solo el OTP verificado (estado OTP_VERIFIED) ya se
  //    podía pedir el documento y registrar su visualización: el Firmante
  //    veía el documento y la casilla del Acuerdo al mismo tiempo, y podía
  //    firmar sin haber aceptado.
  exigirAcuerdoAceptado(signRequest);

  // 2.1. 8B · Exigir el consentimiento EXPRESO del dato sensible (10.8).
  //
  // Si el documento contiene información de salud, el Titular tiene que
  // haber leído el aviso y autorizadoslo antes de ver el documento. Es el
  // mismo orden que el Acuerdo (el aviso va antes que el documento) y la
  // misma razón: el 10.8(a) pide que se le informe de manera expresa y
  // PREVIA.
  exigirConsentimientoSensible(signRequest);

  // 3. Re-validar que el Acuerdo vinculado sigue siendo el activo (D2)
  validateAgreementStillActive(signRequest);
  // 4. Validar estado: debe estar al menos en OTP_VERIFIED
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `No se puede ver el documento en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 5. Validar que vio el documento hasta el final
  if (!scrollAlFinal) {
    throw new AppError(422, 'INVALID_REQUEST_BODY',
      'Debe scrollear al final del documento antes de continuar');
  }

  // 6. Transición de estado
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
 * Devuelve el PDF del documento OBJETO DE LA FIRMA para descarga/visualización.
 *
 * Esto es el paso (h) del 3.4: "El Trabajador visualiza y descarga el
 * documento objeto de la firma". El documento firmado es otra cosa, y lo
 * sirve `getSignedPdfForToken` (5.4).
 *
 * Solo accesible en estados donde se ha verificado el OTP **y** se ha
 * aceptado el Acuerdo: el orden pactado es (g) Acuerdo → (h) documento.
 */
function getPdfForToken(token) {
  // 1. Resolver token
  const { signRequest } = resolveToken(token);

  // 2. Exigir el Acuerdo ACEPTADO (3.4(g) va antes de (h)).
  exigirAcuerdoAceptado(signRequest);

  // 2.1. 8B · Y el consentimiento expreso del dato sensible, si lo hay
  // (numeral 10.8). El PDF es el documento: si se sirve el PDF, el Titular
  // ya tiene que haber sido informado.
  exigirConsentimientoSensible(signRequest);

  // 3. Validar estado
  //
  //    'SIGNED' no va aquí: en estado firmado el enlace entrega el documento
  //    firmado por otra ruta (5.4), no el original.
  const estadosPermitidos = ['OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED'];
  if (!estadosPermitidos.includes(signRequest.estado)) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      `El PDF no está disponible en estado '${signRequest.estado}'`,
      { current_state: signRequest.estado });
  }

  // 4. Leer PDF
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
 * Devuelve el PDF FIRMADO de la solicitud (5.4 del Acuerdo de uso).
 *
 * "El Firmante puede imprimir o descargar copia de este Acuerdo y del
 * documento firmado desde el propio enlace de firma, sin costo alguno."
 *
 * El enlace es de un solo uso (3.4(c)): esto NO reabre el flujo. Solo
 * permite bajar lo que ya está firmado, y solo mientras el enlace siga
 * vigente. Identificar, pedir OTP, aceptar el Acuerdo y firmar siguen
 * cerrados en estado firmado.
 *
 * Regla que se cumple aquí: **el token solo no sirve el PDF firmado antes de
 * la identidad**. Un enlace que no pasó por OTP y aceptación del Acuerdo no
 * llega ni a este punto: el estado no es de firma y la respuesta es 409.
 *
 * @param {string} token
 * @returns {{buffer: Buffer, filename: string}}
 */
function getSignedPdfForToken(token) {
  // 1. Resolver token permitiendo el estado firmado (no los demás terminales:
  //    una solicitud rechazada, revocada o cancelada no descarga nada).
  const { signRequest } = resolveToken(token, { permitirFirmado: true });

  // 2. Solo si la firma ya ocurrió.
  if (!ESTADOS_FIRMADOS.includes(signRequest.estado)) {
    throw new AppError(409, 'SIGNED_DOCUMENT_NOT_AVAILABLE',
      'El documento firmado todavía no está disponible',
      { current_state: signRequest.estado });
  }

  // 3. Leer el PDF firmado que dejó el commit().
  if (!signRequest.pdf_firmado_path) {
    throw new AppError(404, 'PDF_NOT_FOUND', 'No se encontró el documento firmado');
  }

  const pdfBuffer = storage.readPdf(signRequest.pdf_firmado_path);
  return {
    buffer: pdfBuffer,
    filename: `${signRequest.id_solicitud}-firmado.pdf`,
  };
}

/**
 * Devuelve el TEXTO del Acuerdo de uso que el firmante aceptó (5.4).
 *
 * "descargar copia de este Acuerdo [...] desde el propio enlace de firma".
 *
 * Se devuelve el texto EXACTO de la versión ligada a la solicitud: es el
 * mismo cuyo SHA-256 quedó archivado como `hash_texto_acuerdo` en el
 * consentimiento. La respuesta lleva ese hash en la cabecera
 * `X-Acuerdo-SHA256`, para que el firmante pueda comprobar que la copia es
 * la que aceptó.
 *
 * @param {string} token
 * @returns {{texto: string, version: string, texto_hash: string, filename: string}}
 */
function getAgreementCopyForToken(token) {
  // 1. Resolver token (permitiendo el estado firmado: la copia del Acuerdo
  //    se puede bajar también después de firmar).
  const { signRequest } = resolveToken(token, { permitirFirmado: true });

  // 2. Resolver el Acuerdo de esta solicitud.
  const acuerdo = resolverAcuerdo(signRequest);
  if (!acuerdo) {
    throw new AppError(404, 'AGREEMENT_NOT_FOUND', 'No se encontró el Acuerdo de uso');
  }

  return {
    texto: acuerdo.texto,
    version: acuerdo.version,
    texto_hash: acuerdo.texto_hash,
    filename: `acuerdo-uso-${acuerdo.version}.txt`,
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
  //
  //    La fila guarda el HMAC del código (migración 019). Las filas
  //    anteriores guardan SHA-256(sal || otp) con la sal en la misma tabla:
  //    se verifican con su algoritmo y, si coinciden, se reescriben con el
  //    HMAC. La ventana de debilidad de esas filas es de 10 minutos (la
  //    vigencia del OTP) y se cierra sola con cada verificación exitosa.
  if (!signRequest.otp_hash) {
    throw new AppError(500, 'MISSING_OTP_DATA', 'No hay OTP almacenado para esta solicitud');
  }

  const esHmac = esAlgHmac(signRequest.otp_alg);
  let result;
  if (esHmac) {
    const valido = verifyOTPHmac(otp, signRequest.otp_hash, signRequest.id_empresa);
    result = { valid: valido, attempts: signRequest.otp_intentos + 1 };
  } else {
    if (!signRequest.otp_sal) {
      throw new AppError(500, 'MISSING_OTP_DATA', 'No hay OTP almacenado para esta solicitud');
    }
    result = verifyOTP(otp, signRequest.otp_hash, signRequest.otp_sal, signRequest.otp_intentos);
  }

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

      // Autoupgrade: la fila heredada queda con el HMAC y sin sal.
      if (!esHmac) {
        db.prepare(`
          UPDATE gh_firmas_electronicas
          SET otp_hash = ?, otp_sal = NULL, otp_alg = ?
          WHERE id = ?
        `).run(hashOTPHmac(otp, signRequest.id_empresa), algHmac(), signRequest.id);
      }

      signRequestService.registerEvent(signRequest.id, 'OTP_VERIFIED',
        { intentos: result.attempts }, 'trabajador', ip, user_agent);

      // 9A (el 8.2): verificado el codigo, el Trabajador demostro que
      // controla el buzon que declaro. El medio pasa a ACTIVO: ya es un
      // medio ELECTRONICO AUTORIZADO por el, y por ese buzon se le puede
      // entregar la copia del documento.
      if (signRequest.correo_otp && signRequest.id_trabajador) {
        mediosService.activar(
          signRequest.id_empresa,
          signRequest.id_trabajador,
          'CORREO_OTP',
          signRequest.correo_otp
        );
      }
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

async function consentAccept(token, ip, user_agent) {
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

  // 3. 10.4 · EL CAMINO POSITIVO DEL 9.5.
  //
  //    Si la versión vigente del Acuerdo no es la que la solicitud tiene
  //    ligada, la solicitud MIGRARA a la vigente: es la que el firmante está
  //    leyendo en pantalla y es la que hay que dejar archivada con su huella.
  //    Sin esto, publicar una v1.1 dejaría a los trabajadores con enlaces
  //    colgados en un 409 sin salida.
  const migracion = await migrarAVersionVigente(signRequest, ip, user_agent);
  if (migracion) {
    // La versión que se archivó cambió: el firmante tiene que leer y
    // aceptar la nueva. El texto que se le muestra es la versión vigente
    // (ver `resolverAcuerdoVigente`), así que lo que acepta es lo que se
    // archiva.
    logger.info('consentAccept: la solicitud se migró a la versión vigente', {
      id_solicitud: signRequest.id_solicitud,
      ...migracion,
    });
  }

  // 3b. Rama EMPRESA (I-FIRMA-DUAL): el representante acepta SU consentimiento,
  // no el del trabajador. Va ANTES del chequeo de nulo porque el hijo ya no
  // hereda consent_id (se vincula aquí mismo).
  // no el del trabajador. Garantizarlo (crearlo si no existe), vincularlo al
  // hijo y aceptar sobre él. Antes se aceptaba el consent del worker de forma
  // idempotente y no quedaba registro propio del rep (dato falso en constancia).
  let effectiveConsentId = signRequest.consent_id;
  let esRepFlow = signRequest.tipo_firmante === 'EMPRESA';
  if (esRepFlow) {
    let repSnapshot = null;
    try { repSnapshot = signRequest.representante_legal_snapshot ? JSON.parse(signRequest.representante_legal_snapshot) : null; } catch (e) { repSnapshot = null; }
    // El hijo también puede no traer snapshot propio: fallback al del padre.
    if ((!repSnapshot || !repSnapshot.correo) && signRequest.parent_id_solicitud) {
      try {
        const padreSnap = db.prepare(
          'SELECT representante_legal_snapshot FROM gh_firmas_electronicas WHERE id_solicitud = ?'
        ).get(signRequest.parent_id_solicitud);
        if (padreSnap && padreSnap.representante_legal_snapshot) {
          repSnapshot = JSON.parse(padreSnap.representante_legal_snapshot);
        }
      } catch (e) { /* noop — se valida abajo */ }
    }
    if (!repSnapshot || !repSnapshot.correo) {
      throw new AppError(409, 'REP_SNAPSHOT_MISSING',
        'Falta el snapshot del representante legal para su consentimiento propio',
        { id_solicitud: signRequest.id_solicitud });
    }
    // Hash del acuerdo: el del consent del trabajador (misma versión) o la tabla.
    let hashAcuerdo = null;
    try {
      // La fila puede guardar el seudónimo (migración 019) o el documento
      // crudo (filas anteriores): se prueban las dos cosas.
      const cands = candidatosBusqueda(signRequest.id_trabajador, signRequest.id_empresa);
      if (cands.length) {
        const ph = cands.map(() => '?').join(',');
        const cTrab = db.prepare(
          `SELECT hash_texto_acuerdo FROM gh_consentimientos_firma
           WHERE id_trabajador IN (${ph}) AND id_empresa = ? AND version_acuerdo = ?
             AND (rol_firmante IS NULL OR rol_firmante = 'TRABAJADOR')
           ORDER BY id DESC LIMIT 1`
        ).get(...cands, signRequest.id_empresa, signRequest.agreement_version);
        if (cTrab) hashAcuerdo = cTrab.hash_texto_acuerdo;
      }
    } catch (e) { /* noop — fallback abajo */ }
    if (!hashAcuerdo) {
      const ac = db.prepare(
        'SELECT texto_hash FROM gh_firma_acuerdo_versiones WHERE version = ? AND activa = 1 LIMIT 1'
      ).get(signRequest.agreement_version);
      if (ac) hashAcuerdo = ac.texto_hash;
    }
    if (!hashAcuerdo) {
      throw new AppError(409, 'ACUERDO_HASH_MISSING',
        'No se pudo resolver el hash del Acuerdo para el consentimiento del representante',
        { id_solicitud: signRequest.id_solicitud });
    }
    const ensured = consentService.ensureRepConsent({
      id_trabajador: signRequest.id_trabajador,
      id_empresa: signRequest.id_empresa,
      version_acuerdo: signRequest.agreement_version,
      hash_texto_acuerdo: hashAcuerdo,
      rep: {
        nombre: repSnapshot.nombre || null,
        cargo: repSnapshot.cargo || 'Representante Legal',
        numero_identificacion: repSnapshot.numero_identificacion || null,
        correo: repSnapshot.correo,
      },
      ip: ip || null,
      user_agent: user_agent || null,
      kair_version: signRequest.version_kair,
    });
    effectiveConsentId = ensured.consent.id;
    if (signRequest.consent_id !== effectiveConsentId) {
      db.prepare(
        'UPDATE gh_firmas_electronicas SET consent_id = ? WHERE id = ?'
      ).run(effectiveConsentId, signRequest.id);
      signRequest.consent_id = effectiveConsentId;
    }
  }

  // 3c. Validar consent_id efectivo (tras la rama EMPRESA ya quedó vinculado).
  if (!effectiveConsentId) {
    throw new AppError(409, 'CONSENT_REQUIRED',
      'El sign request no tiene consent_id vinculado (legado sin Acuerdo?)',
      { id_solicitud: signRequest.id_solicitud });
  }

  // 4. Llamar al service (UPDATE atómico en consentimiento)
  const result = consentService.accept(effectiveConsentId, { signRequest });

  // 5. Registrar evento CONSENT_ACCEPTED SOLO en la primera aceptación.
  //    Si fue idempotente, ya existe un evento previo (o un reintento que
  //    no debe duplicar la auditoría).
  //    Excepción rama EMPRESA: el consent del rep se reutiliza entre
  //    documentos del mismo expediente, así que se registra SIEMPRE (con
  //    marca idempotente) para dejar rastro por documento.
  if (!result.idempotente || esRepFlow) {
    const updatedConsent = result.consent;
    signRequestService.registerEvent(signRequest.id, 'CONSENT_ACCEPTED', {
      id_consentimiento: updatedConsent.id,
      version_acuerdo: updatedConsent.version_acuerdo,
      hash_texto_acuerdo: updatedConsent.hash_texto_acuerdo,
      id_solicitud: signRequest.id_solicitud,
      idempotente: !!result.idempotente,
      rol_firmante: updatedConsent.rol_firmante || 'TRABAJADOR',
    }, esRepFlow ? 'empresa' : 'trabajador', ip, user_agent);
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
  return resendOtpDeSignRequest(signRequest, ip, user_agent);
}

/**
 * El núcleo del reenvío de OTP, sin token.
 *
 * 8C: el endpoint interno `POST /internal/sign-requests/:id/resend-otp` ya
 * tiene la solicitud (la resolvió por id), así que no necesita—and no debe
 * necesitar— un token en texto claro. Antes lo recuperaba de la copia
 * cifrada del metadata, que la 8C dejó de existir.
 *
 * Lo que NO se salta: la ventana para firmar. Un OTP para una solicitud
 * vencida no sirve de nada, y es la misma respuesta que daba el flujo
 * público (410 TOKEN_EXPIRED).
 *
 * @param {object} signRequest - fila de gh_firmas_electronicas.
 * @param {string} ip
 * @param {string} user_agent
 */
function resendOtpDeSignRequest(signRequest, ip, user_agent) {
  // 1.5. La ventana para firmar (el mismo chequeo que hace resolveToken).
  if (Date.now() > new Date(signRequest.fecha_expiracion).getTime()) {
    throw new AppError(410, 'TOKEN_EXPIRED', 'El token ha expirado', {
      expired_at: signRequest.fecha_expiracion,
    });
  }

  // 1.6. Estados terminales → 410. La misma respuesta que daba el flujo
  // público: `resolveToken` rechazaba los terminales antes de llegar al
  // chequeo de estados del reenvío.
  if (['SIGNED', 'REJECTED', 'REVOKED', 'CANCELLED', 'EXPIRED'].includes(signRequest.estado)) {
    throw new AppError(410, 'TOKEN_ALREADY_USED',
      `La solicitud está en estado terminal '${signRequest.estado}'`);
  }

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
  //    HMAC, no "hash con sal en la misma tabla" (migración 019).
  const otp = generateOTP();
  const otp_hash = hashOTPHmac(otp, signRequest.id_empresa);
  const otp_sal = null;
  const now_iso = new Date().toISOString();

  // 5. Obtener correo
  // I-AUDIT-2026-09-10 (v0.1.194): en resend-otp, la fuente autoritativa es
  // el correo del CONSENTIMIENTO vinculado (no metadata.correo ni la columna
  // del SR). Razón: el operador introduce un solo correo al crear el consent
  // y el OTP debe ir siempre a ese correo, aunque el SR traiga su propio
  // metadata. Si NO hay consent vinculado, caemos al resolveCorreo estándar
  // (columna > metadata) para preservar comportamiento de SR legacy.
  let correo = null;
  if (signRequest.consent_id) {
    const consentRow = db.prepare(
      'SELECT correo_verificacion FROM gh_consentimientos_firma WHERE id = ?'
    ).get(signRequest.consent_id);
    if (consentRow && consentRow.correo_verificacion) {
      correo = consentRow.correo_verificacion;
    }
  }
  if (!correo) {
    correo = resolveCorreo(signRequest);
  }
  if (!correo) {
    throw new AppError(400, 'MISSING_EMAIL',
      'No hay correo de verificación disponible para reenviar OTP');
  }
  // D-2: el reenvío del OTP va al MISMO destino que el OTP original (el
  // medio personal declarado, o el contacto registrado si no se declaró
  // nada). Un código que llega a un buzón distinto al del primero rompería
  // la trazabilidad del 3.4(e).
  const destinoOtp = resolveCorreoOtp(signRequest, null, correo);
  if (destinoOtp.correo) {
    correo = destinoOtp.correo;
  }

  // 6. Actualizar BD + registrar evento en transacción atómica
  const tx = db.transaction(() => {
    // Si estaba bloqueado, desbloquear
    const wasLocked = signRequest.estado === 'OTP_LOCKED';
    db.prepare(`
      UPDATE gh_firmas_electronicas
      SET estado = 'OTP_SENT',
          otp_hash = ?, otp_sal = ?, otp_alg = ?,
          otp_intentos = 0,
          otp_bloqueado = 0,
          fecha_otp_enviado = ?
      WHERE id = ?
    `).run(otp_hash, otp_sal, algHmac(), now_iso, signRequest.id);

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

// =============================================================================
// I-VERIFICACION-PUBLICA: endpoint de solo lectura
// =============================================================================

/**
 * Enmascara el correo del firmante para exposición pública.
 * Ej: juan.perez@example.com → ju****@example.com
 * (versión local de la función _maskEmailPublico de public.js, porque
 * getVerificationContext se ejecuta desde el service layer sin acceso al scope del route file).
 */
function _maskEmail(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return local[0] + '****@' + domain;
  return local.slice(0, 2) + '****@' + domain;
}

/**
 * Estado público de un sign request, listo para que la mini-app lo muestre
 * en la pantalla de verificación. Es una vista READ-ONLY: no expone token_hash,
 * paths internos, ni campos que permitan acciones sobre el documento.
 *
 * @param {string} token
 * @returns {{
 *   id_solicitud, id_documento, id_trabajador, id_empresa,
 *   estado, fecha_creacion, fecha_firma, fecha_expiracion,
 *   tipo_firma, identificacion_tipo, tipo_identificacion,
 *   document_hash_original, document_hash_firmado, evidence_hash,
 *   firmante: { nombre, identificacion_enmascarada, correo_enmascarado, tipo_firmante, fecha_firma },
 *   firmante_empresa: { nombre, cargo, identificacion_enmascarada, correo, fecha_firma } | null
 * }}
 */
function getVerificationContext(token) {
  // permitirHistorico=true: la verificación pública debe funcionar
  // indefinidamente (es READ-ONLY, no permite firmar ni otras acciones).
  // 8A.1: esto ignora el VENCIMIENTO DEL ENLACE, no el del plazo de
  // conservación: si el 10.6 venció, el resolveToken lanza y aquí no se
  // llega a afirmar que la firma está vigente.
  const { signRequest } = resolveToken(token, { permitirHistorico: true });

  // Cédula enmascarada: primeros 6 chars de la huella archivada, mismo
  // patrón que el PDF. La huella es determinística, así que dos personas
  // que tengan la misma cédula ven la misma máscara.
  // Desde la migración 019 la huella archivada es un HMAC con la llave del
  // servicio: la máscara se calcula sobre ese HMAC. La propiedad se mantiene
  // (valor derivado de la huella, no un fragmento del número de documento).
  var maskIdentificacion = identificacion.enmascarar;

  // Firmante principal: leer del snapshot si hay representante legal (DUAL),
  // si no, del metadata legacy (campo id_trabajador no es nombre humano).
  var firmante = null;
  if (signRequest.tipo_firmante === 'EMPRESA' && signRequest.representante_legal_snapshot) {
    try {
      var snap = JSON.parse(signRequest.representante_legal_snapshot);
      firmante = {
        tipo: 'Representante Legal',
        nombre: snap.nombre || null,
        cargo: snap.cargo || 'Representante Legal',
        identificacion_enmascarada: maskIdentificacion(
          snap.tipo_identificacion || signRequest.identificacion_tipo,
          signRequest.identificacion_numero_hash
        ),
        correo_enmascarado: _maskEmail(snap.correo),
        fecha_firma: signRequest.fecha_firma,
      };
    } catch (e) {
      // snapshot corrupto: caer a null
      firmante = null;
    }
  } else {
    // Firmante único (legacy). El nombre humano viaja en el metadata que
    // envía K+AIR (`nombre_trabajador`); `id_trabajador` es el seudónimo y
    // no debe mostrarse como si fuera un nombre.
    var metaLegacy = {};
    try { metaLegacy = JSON.parse(signRequest.metadata || '{}') || {}; } catch (e) { metaLegacy = {}; }
    firmante = {
      tipo: 'Trabajador',
      nombre: metaLegacy.nombre_trabajador || null,
      cargo: null,
      identificacion_enmascarada: maskIdentificacion(
        signRequest.identificacion_tipo,
        signRequest.identificacion_numero_hash
      ),
      correo_enmascarado: _maskEmail(signRequest.correo_verificacion),
      fecha_firma: signRequest.fecha_firma,
    };
  }

  // Para DUAL_FIRMADO, también exponer el firmante del padre (trabajador)
  // si está disponible. Buscamos el SR padre por parent_id_solicitud.
  var firmanteTrabajador = null;
  if (signRequest.tipo_firmante === 'EMPRESA' && signRequest.parent_id_solicitud) {
    var padreRow = db.prepare(
      'SELECT id_trabajador, identificacion_tipo, identificacion_numero_hash, correo_verificacion, fecha_firma, metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
    ).get(signRequest.parent_id_solicitud);
    if (padreRow) {
      var nombreTrabajador = null;
      try { nombreTrabajador = (JSON.parse(padreRow.metadata || '{}') || {}).nombre_trabajador; } catch (e) { /* noop */ }
      firmanteTrabajador = {
        tipo: 'Trabajador',
        nombre: nombreTrabajador || null,
        cargo: null,
        identificacion_enmascarada: maskIdentificacion(
          padreRow.identificacion_tipo,
          padreRow.identificacion_numero_hash
        ),
        correo_enmascarado: _maskEmail(padreRow.correo_verificacion),
        fecha_firma: padreRow.fecha_firma,
      };
    }
  }

  // Verificación REAL de integridad del archivo firmado.
  //
  // Antes esta función solo devolvía el hash que quedó registrado al momento de
  // la firma, y la mini-app lo pintaba como "documento íntegro" sin que nadie
  // hubiera recalculado nada. Si el PDF almacenado se alteraba después de
  // firmar, la pantalla seguía mostrando el banner verde y los hashes
  // originales: afirmaba integridad sobre un archivo que no había comprobado.
  //
  // Ahora sí se recalcula el SHA-256 del PDF firmado en disco y se compara con
  // el hash archivado. `verificado` distingue "no comprobamos" de "comprobamos
  // y NO coincide", porque la UI no debe afirmar integridad cuando no hay nada
  // que haya, ni quedarse callada cuando hay una discrepancia.
  var integridad = { verificado: false, coincide: false, motivo: null };
  // Firma dual (I-FIRMA-DUAL): el commit del representante marca DUAL_FIRMADO
  // en el padre Y en el hijo (publicFlow.js, cierre de firma dual), pero el PDF
  // firmado y su hash solo quedan en la fila del hijo. Si nos fijamos solo en
  // esta fila, el padre se veria como "sin archivo firmado" aunque la firma sea
  // valida. Cuando estamos en esa situacion resolvemos el hijo y verificamos
  // contra SU archivo, que es el unico que existe.
  var fila_para_verificar = signRequest;
  if (
    signRequest.estado === 'DUAL_FIRMADO' &&
    !signRequest.pdf_firmado_path &&
    signRequest.id_solicitud
  ) {
    try {
      var hijoDual = db.prepare(
        'SELECT pdf_firmado_path, document_hash_firmado FROM gh_firmas_electronicas WHERE parent_id_solicitud = ? AND pdf_firmado_path IS NOT NULL LIMIT 1'
      ).get(signRequest.id_solicitud);
      if (hijoDual) fila_para_verificar = hijoDual;
    } catch (_) {
      // Si la consulta falla seguimos con la fila original: peor no verificar
      // que romper la pantalla de verificacion.
    }
  }
  if (!fila_para_verificar.document_hash_firmado || !fila_para_verificar.pdf_firmado_path) {
    integridad.motivo =
      'Este documento no tiene un archivo firmado con hash asociado.';
  } else {
    var almacenado = storage.readPdfIfExists(fila_para_verificar.pdf_firmado_path);
    if (!almacenado.found) {
      integridad.motivo =
        'No fue posible localizar el archivo firmado en el servidor.';
    } else {
      integridad.verificado = true;
      integridad.coincide =
        sha256(almacenado.buffer) === fila_para_verificar.document_hash_firmado;
      if (!integridad.coincide) {
        integridad.motivo =
          'El archivo almacenado NO coincide con el hash registrado en la firma. ' +
          'Fue alterado después de firmarse.';
      }
    }
  }

  return {
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    id_trabajador: signRequest.id_trabajador,
    id_empresa: signRequest.id_empresa,
    estado: signRequest.estado,
    fecha_creacion: signRequest.fecha_creacion,
    fecha_firma: signRequest.fecha_firma,
    fecha_expiracion: signRequest.fecha_expiracion,
    tipo_firma: signRequest.tipo_firma,
    identificacion_tipo: signRequest.identificacion_tipo,
    tipo_identificacion: signRequest.tipo_identificacion,
    document_hash_original: signRequest.document_hash_original,
    document_hash_firmado: signRequest.document_hash_firmado,
    evidence_hash: signRequest.evidence_hash,
    integridad_documento: integridad,
    firmante: firmante,
    firmante_trabajador: firmanteTrabajador, // null para SRs no-duales
    version_kair: signRequest.version_kair,
  };
}

/**
 * Compara el SHA-256 de un PDF subido con el document_hash_firmado del SR.
 * Devuelve match/mismatch + ambos hashes para que la UI los muestre.
 *
 * NO revela el contenido del PDF, solo el hash. Registra el evento
 * PDF_VERIFIED con el resultado (match/mismatch) para auditoría.
 *
 * @param {string} token
 * @param {Buffer} pdfBuffer
 * @param {string} ip
 * @param {string} user_agent
 * @returns {{ matches: boolean, server_hash: string, computed_hash: string, document_hash_original: string|null, estado: string, message: string }}
 */
function verifyPdfHash(token, pdfBuffer, ip, user_agent) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new AppError(400, 'INVALID_INPUT', 'Se requiere un PDF no vacío');
  }
  if (pdfBuffer.length > 50 * 1024 * 1024) {
    throw new AppError(413, 'PDF_TOO_LARGE', 'El PDF supera el límite de 50MB');
  }
  // Validar magic bytes del PDF
  if (pdfBuffer.slice(0, 5).toString('latin1') !== '%PDF-') {
    throw new AppError(400, 'NOT_A_PDF', 'El archivo no parece ser un PDF válido');
  }

  // Operación histórica autorizada: comparar el PDF que el firmante tiene
  // contra el que se firmó es una consulta de solo lectura, válida aunque
  // la ventana para firmar ya haya vencido (8A.1). El vencimiento del plazo de
  // conservación (10.6) no se salta.
  const { signRequest } = resolveToken(token, { permitirHistorico: true });
  const computed = sha256(pdfBuffer);
  const stored = signRequest.document_hash_firmado;
  const matches = !!(stored && computed === stored);

  // Registrar evento de auditoría (match o mismatch)
  try {
    signRequestService.registerEvent(signRequest.id, 'PDF_VERIFIED', {
      matches: matches,
      computed_hash: computed,
      stored_hash: stored,
      pdf_bytes: pdfBuffer.length,
    }, 'sistema', ip, user_agent);
  } catch (e) {
    // auditoría es best-effort, no fallamos la operación si no se puede
    // registrar (ej. SR firmada antes de que existiera la tabla eventos)
    logger.warn('No se pudo registrar evento PDF_VERIFIED', { error: e.message });
  }

  return {
    matches: matches,
    server_hash: stored || null,
    computed_hash: computed,
    document_hash_original: signRequest.document_hash_original || null,
    estado: signRequest.estado,
    message: matches
      ? '✅ El archivo coincide con el original firmado'
      : (stored
          ? '❌ El archivo NO coincide con el original firmado. El PDF que tienes puede haber sido alterado.'
          : '⚠️ Este documento aún no está firmado, no hay hash para comparar'),
  };
}

/**
 * Registra una consulta a la página de verificación (cada vez que se abre
 * el endpoint /verify, no solo la primera). El evento VERIFY_CONSULTED
 * permite a RH ver "el contrato fue verificado N veces por la empresa X
 * en tal fecha" — útil como evidencia adicional.
 */
function registerVerifyConsulted(signRequest, ip, user_agent) {
  try {
    signRequestService.registerEvent(signRequest.id, 'VERIFY_CONSULTED', {
      estado: signRequest.estado,
      tipo_firmante: signRequest.tipo_firmante,
    }, 'sistema', ip, user_agent);
  } catch (e) {
    logger.warn('No se pudo registrar evento VERIFY_CONSULTED', { error: e.message });
  }
}

// ===========================================================================
// 9A · LA FIRMA EN PAPEL (el 7.1-7.3) Y LOS MEDIOS AUTORIZADOS (el 8.2)
// ===========================================================================

/**
 * La Empresa registra el documento YA FIRMADO en papel (el 7.2).
 *
 * Lo que hace:
 *   - guarda el PDF firmado (el que la Empresa escaneó) y calcula su huella
 *     (la calcula el servidor, no el cliente);
 *   - genera el "Registro de firma autográfica": la evidencia del acto
 *     (en el sentido en que la Constancia lo es del acto electrónico);
 *   - deja el asiento en la tabla de firmas en papel y el evento;
 *   - le entrega la COPIA al Trabajador por un medio que él autorizó (el
 *     8.2 y el 8.5).
 *
 * @param {string} id_solicitud
 * @param {object} opts
 * @param {Buffer} opts.pdfBuffer - el PDF firmado en papel
 * @param {string} opts.pdfHash - el SHA-256 (lo calcula el servidor)
 * @param {string} [opts.actor] - el operador de la Empresa
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @param {object} [opts.metadata]
 * @returns {Promise<object>}
 */
async function registrarFirmaEnPapel(id_solicitud, opts) {
  const opciones = opts || {};
  const signRequest = signRequestService.getByIdSolicitud(id_solicitud);
  if (!signRequest) {
    throw new AppError(404, 'SIGN_REQUEST_NOT_FOUND', 'No existe la solicitud');
  }

  // La vía en papel la abre la EMPRESA: el Trabajador le pide el papel por
  // el canal que la Empresa tenga (el de atención, el de PQRS, el que le
  // muestre el Acuerdo) y la Empresa lo registra aquí. Si la vía no
  // estaba abierta, se abre con el asiento `PAPER_TRACK_OPENED`, que guarda
  // el canal por el que llegó la petición: eso es lo que prueba que la
  // opción existía y era accesible (el 2.2.1.1.11 es un deber de medios,
  // y los medios se prueban, no se declaran).
  if (!papelService.obtenerPorSolicitud(id_solicitud)) {
    papelService.abrir(signRequest, {
      actor: opciones.actor || 'empresa',
      canal: opciones.canal || null,
      motivo: opciones.motivo || null,
      ip: opciones.ip,
      user_agent: opciones.user_agent,
      registerEvent: signRequestService.registerEvent,
    });
  }

  if (!Buffer.isBuffer(opciones.pdfBuffer)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'No se recibió el PDF del documento firmado en papel');
  }

  // 1. El PDF firmado en papel.
  const pdfPath = storage.savePapel(id_solicitud + '-firmado.pdf', opciones.pdfBuffer);

  // 2. El Registro de firma autográfica (la evidencia del acto).
  const empresa = empresaService.getById(signRequest.id_empresa);
  const parcial = ultimos4.obtener(signRequest.id);
  const ahora = new Date().toISOString();
  const registroBuffer = await pdfGenPapel.generateRegistroFirmaAutografica({
    id_solicitud: signRequest.id_solicitud,
    id_documento: signRequest.id_documento,
    razon_social: empresa ? empresa.razon_social : null,
    nit: empresa ? empresa.nit : null,
    identificacion_parcial: parcial
      ? ((signRequest.identificacion_tipo || parcial.tipo || '') + ' \u2022\u2022\u2022\u2022 ' + parcial.digitos)
      : null,
    tipo_identificacion: signRequest.identificacion_tipo,
    fecha_firma: ahora,
    pdf_hash: opciones.pdfHash,
    pdf_hash_original: signRequest.document_hash_original || null,
    version_kair: signRequest.version_kair,
    acuerdo_hash: signRequest.agreement_hash,
    id_actor: opciones.actor || 'sistema',
    fecha_registro: ahora,
  });
  const registroPath = storage.savePapel(id_solicitud + '-registro.pdf', registroBuffer);

  // 3. El asiento y el evento.
  // La metadata del asiento: la pareja de huellas (el documento original y
  // el firmado en papel) es lo que ata el papel al documento que se envió
  // a firma. El papel firmado NO puede tener la misma huella que el
  // original (está firmado a mano), así que el vínculo tiene que ser
  // expréso en la evidencia.
  const metadataPapel = Object.assign({}, opciones.metadata || {}, {
    id_documento: signRequest.id_documento,
    document_hash_original: signRequest.document_hash_original || null,
    pdf_hash: opciones.pdfHash,
  });

  const fila = papelService.registrarFirmado({
    id_solicitud,
    pdfPath,
    pdfHash: opciones.pdfHash,
    registroPath,
    acuerdoHash: signRequest.agreement_hash,
    actor: opciones.actor || 'sistema',
    ip: opciones.ip,
    user_agent: opciones.user_agent,
    metadata: metadataPapel,
    registerEvent: signRequestService.registerEvent,
  });

  // 4. La vía electrónica de esta solicitud queda CERRADA: el documento se
  //    firmó a mano, no electrónicamente. Cerrarla es lo que impide la doble
  //    firma (y el 2.2.2.47.2 exige que la salida en papel no prive de efecto a
  //    la firma electrónica: aquí no se prive de nada, la electrónica nunca
  //    se firma).
  const txCierre = db.transaction(() => {
    db.prepare(`
      UPDATE gh_firmas_electronicas SET estado = 'CANCELLED' WHERE id = ?
    `).run(signRequest.id);
    signRequestService.registerEvent(signRequest.id, 'ELECTRONIC_FLOW_CANCELLED', {
      motivo: 'FIRMA_EN_PAPEL',
      id_solicitud: signRequest.id_solicitud,
    }, opciones.actor || 'empresa', opciones.ip, opciones.user_agent);
  });
  txCierre();

  // 5. La copia al Trabajador, por un medio que él autorizó (el 8.2/8.5).
  const destino = _destinoCopiaTrabajador(signRequest);
  let copia = { enviada: false, motivo: 'sin_medio_autorizado' };
  if (destino.correo) {
    try {
      await mailer.sendSignedCopy({
        to: destino.correo,
        pdfPath,
        constanciaPath: registroPath,
        context: {
          id_solicitud: signRequest.id_solicitud,
          id_constancia: 'REGISTRO-' + id_solicitud,
        },
        tipo: 'PAPEL',
      });
      copia = { enviada: true, medio: destino.medio, correo: destino.correo };
    } catch (e) {
      // La copia que NO se pudo enviar no invalida la firma: el documento
      // firmado ya está. Queda el aviso para que la Empresa lo reintente.
      logger.warn('9A: no se pudo enviar la copia de la firma en papel', {
        id_solicitud,
        error: e.message,
      });
      signRequestService.registerEvent(signRequest.id, 'PAPER_COPY_FAILED', {
        id_solicitud,
        error: e.message,
      }, opciones.actor || 'sistema', opciones.ip, opciones.user_agent);
      copia = { enviada: false, motivo: 'error_envio', error: e.message };
    }
  }

  return {
    ok: true,
    id_solicitud: signRequest.id_solicitud,
    estado_papel: fila.estado,
    pdf_hash: opciones.pdfHash,
    registro_path: registroPath,
    copia,
  };
}

/**
 * A qué medio se le entrega la copia del documento firmado (el 8.2).
 *
 * El orden NO es arbitrario: primero el medio PERSONAL que el Trabajador
 * declaró y verificó (el CORREO_OTP), después el correo registrado en la
 * hoja de vida, y por último el correo de la solicitud (que es el de la
 * Empresa: es el peor, pero es el que hay).
 *
 * @param {object} signRequest
 * @returns {{correo: string|null, medio: string|null}}
 */
function _destinoCopiaTrabajador(signRequest) {
  const activos = mediosService.listarActivos(
    signRequest.id_empresa,
    signRequest.id_trabajador
  );
  const porTipo = {};
  for (const m of activos) porTipo[m.tipo] = m.valor;

  if (porTipo.CORREO_OTP && String(porTipo.CORREO_OTP).includes('@')) {
    return { correo: porTipo.CORREO_OTP, medio: 'CORREO_OTP' };
  }
  if (porTipo.EMAIL_HOJA_VIDA && String(porTipo.EMAIL_HOJA_VIDA).includes('@')) {
    return { correo: porTipo.EMAIL_HOJA_VIDA, medio: 'EMAIL_HOJA_VIDA' };
  }
  if (signRequest.correo_verificacion
      && String(signRequest.correo_verificacion).includes('@')) {
    return { correo: signRequest.correo_verificacion, medio: 'CONTACTO_SOLICITUD' };
  }
  return { correo: null, medio: null };
}

/**
 * 9A · LOS MEDIOS AUTORIZADOS DEL TRABAJADOR (el 8.2) — el servicio
 * =====================================================================
 *
 * El 8.2 del Acuerdo: "El Trabajador puede modificar esta autorización en
 * cualquier momento y sin costo alguno."
 *
 * Estas dos funciones son la vía por la que lo hace, desde la mini-app:
 *
 *   listarMediosTrabajador()   → lo que hay registrado y con qué estado.
 *   gestionarMediosTrabajador() → agregar o retirar un medio.
 *
 * EL ESTADO `PENDIENTE` Y POR QUÉ
 * --------------------------------
 * Un medio agregado nace PENDIENTE y se activa SOLO cuando el Trabajador
 * demuestra que lo controla: cuando el código de verificación llega a ese
 * medio y lo verifica (la vía del D-2, la declaración del medio del OTP).
 *
 * El motivo es concreto: si un medio naciera ACTIVO, cualquiera que tuviera
 * el enlace podría escribir un correo ajeno en el registro, y a partir de ahí
 * la Empresa le entregaría la copia del documento a un desconocido. Con el
 * medio en PENDIENTE, la copia solo se entrega por un buzón que el
 * Trabajador demostró controlar.
 *
 * Tests: tests/n9a-medios-y-papel.test.js
 */
'use strict';

/**
 * Los estados en los que la vía de medios está habilitada.
 * A partir de IDENTIFIED, el que llama ya demostró conocer el documento.
 */
const ESTADOS_CON_MEDIOS = [
  'IDENTIFIED', 'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED',
  'DOCUMENT_VIEWED', 'MANIFESTATION_RECORDED',
];

/**
 * Exige que la solicitud esté identificada.
 * @param {object} signRequest
 */
function _exigirEstadoMedios(signRequest) {
  if (ESTADOS_CON_MEDIOS.indexOf(signRequest.estado) === -1) {
    throw new AppError(409, 'INVALID_STATE_TRANSITION',
      'Para ver o modificar tus medios autorizados primero tenés que '
      + 'identificarte en esta solicitud',
      { current_state: signRequest.estado });
  }
}

/**
 * Los medios autorizados del Trabajador.
 *
 * @param {string} token
 * @param {string} ip
 * @param {string} user_agent
 * @returns {object}
 */
function listarMediosTrabajador(token, ip, user_agent) {
  const { signRequest } = resolveToken(token);
  _exigirEstadoMedios(signRequest);

  const medios = mediosService.listarTodos(
    signRequest.id_empresa,
    signRequest.id_trabajador
  );

  return {
    id_solicitud: signRequest.id_solicitud,
    medios: medios.map((m) => ({
      tipo: m.tipo,
      valor: m.valor,
      estado: m.estado,
      origen: m.origen,
      fecha_registro: m.fecha_registro,
      fecha_modificacion: m.fecha_modificacion,
    })),
    aviso: 'Un medio nuevo queda pendiente hasta que lo verifiques: '
      + 'te mandamos un código y, cuando lo recibas, queda activo para '
      + 'entregarte las copias.',
  };
}

/**
 * Agrega o retira un medio autorizado (el 8.2).
 *
 * @param {string} token
 * @param {object} body - {accion: 'ALTA'|'BAJA', tipo, correo}
 * @param {string} ip
 * @param {string} user_agent
 * @returns {object}
 */
function gestionarMediosTrabajador(token, body, ip, user_agent) {
  const { signRequest } = resolveToken(token);
  _exigirEstadoMedios(signRequest);

  const datos = body || {};
  const accion = datos.accion === 'BAJA' ? 'BAJA' : 'ALTA';
  const tipo = datos.tipo || 'CORREO_OTP';
  const correo = (datos.correo || '').trim().toLowerCase();

  if (accion === 'BAJA') {
    if (!correo) {
      throw new AppError(400, 'INVALID_REQUEST_BODY',
        'Falta el correo del medio que querés retirar');
    }
    const resultado = mediosService.darDeBaja({
      id_empresa: signRequest.id_empresa,
      id_trabajador: signRequest.id_trabajador,
      tipo,
      valor: correo,
    });
    signRequestService.registerEvent(signRequest.id, 'AUTHORIZED_MEDIA_REMOVED', {
      tipo,
      correo: _enmascarar(correo),
    }, 'trabajador', ip, user_agent);
    return {
      ok: true,
      accion: 'BAJA',
      medio: { tipo, valor: correo, estado: 'BAJA' },
      aviso: 'Listo: ese medio ya no te lo usamos para entregarte copias.',
    };
  }

  if (!correo || !correo.includes('@')) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'El medio debe ser un correo electrónico válido');
  }

  const resultado = mediosService.registrar({
    id_empresa: signRequest.id_empresa,
    id_trabajador: signRequest.id_trabajador,
    tipo,
    valor: correo,
    origen: 'TRABAJADOR',
    estado: 'PENDIENTE',
  });

  signRequestService.registerEvent(signRequest.id, 'AUTHORIZED_MEDIA_ADDED', {
    tipo,
    correo: _enmascarar(correo),
    estado: 'PENDIENTE',
  }, 'trabajador', ip, user_agent);

  return {
    ok: true,
    accion: 'ALTA',
    medio: {
      tipo,
      valor: correo,
      estado: 'PENDIENTE',
    },
    aviso: 'Lo agregamos. Queda pendiente hasta que lo verifiques: '
      + 'te mandamos un código a ese correo y, cuando lo recibas, '
      + 'queda activo para entregarte las copias.',
  };
}

/**
 * Enmascara un correo para el registro de eventos.
 * @param {string} correo
 * @returns {string}
 */
function _enmascarar(correo) {
  if (typeof correo !== 'string' || !correo.includes('@')) return '—';
  const [local, dominio] = correo.split('@');
  const visible = local.slice(0, Math.min(3, local.length));
  return visible + '***@' + dominio;
}

/**
 * Deja constancia de que se le OFRECIÓ al Trabajador la vía en papel.
 *
 * POR QUÉ HAY DOS ASIENTOS Y NO UNO
 * -------------------------------
 *   - `PAPER_TRACK_OPENED`: la vía se ABRIÓ (la Empresa la registró, con
 *     el canal por el que el Trabajador la pidió). Prueba que la vía
 *     existía y era accesible.
 *   - `PAPER_OPTION_AVAILABLE` (este): se le OFRECIÓ. Prueba que la
 *     opción estuvo disponible y accesible. La oferta viaja en el CORREO de
 *     invitación (lo manda la Empresa, que es quien tiene el deber del 7.2),
 *     y la huella del cuerpo del correo es lo que queda archivado.
 *
 * El segundo es el que sostiene la posición de la Empresa frente a un
 * Inspector del Trabajo (el 2.2.1.1.15) o frente a un reclamo del Titular:
 * la pregunta que se hará es ¿cómo prueba la Empresa que la opción
 * estaba ahí?, no solo que un trabajador la encontró.
 *
 * Se escribe UNA vez por solicitud (la primera vez que se le muestra la
 * mini-app o que se le manda la invitación).
 *
 * MINIMIZACIÓN: no se guarda la IP ni el user-agent. Esto no es una
 * manifestación del Trabajador: es la constancia de una oferta. Guardo
 * la IP del QUE PIDIÓ (que sí es una manifestación) en el evento de
 * la petición.
 *
 * @param {object} signRequest
 * @param {string} [canal] - 'correo'
 * @param {string} [hashOferta] - la huella del cuerpo del correo enviado
 * @returns {boolean} true si se registró ahora
 */
function registrarOpcionPapelDisponible(signRequest, canal, hashOferta) {
  const ya = db.prepare(
    "SELECT id FROM gh_firma_eventos WHERE firma_id = ? AND evento = 'PAPER_OPTION_AVAILABLE' LIMIT 1"
  ).get(signRequest.id);
  if (ya) return false;

  signRequestService.registerEvent(signRequest.id, 'PAPER_OPTION_AVAILABLE', {
    id_solicitud: signRequest.id_solicitud,
    id_empresa: signRequest.id_empresa,
    version_kair: signRequest.version_kair || null,
    // La huella de lo que se le mostró: el cuerpo del correo de invitación
    // (la oferta de la vía en papel viaja en el correo de la Empresa, no
    // en la mini-app: el 7.2 es un deber de la Empresa y el producto no puede
    // prometer en su nombre).
    hash_oferta: hashOferta || null,
    canal: canal || 'mini_app',
    // El numeral del Acuerdo que respalda la opción.
    fundamento: '7.2 y 7.3 del Acuerdo de uso; 2.2.1.1.11 del Decreto 1072 de 2015',
  }, 'sistema', null, null);

  logger.info('Opción de firma en papel ofrecida', {
    id_solicitud: signRequest.id_solicitud,
    canal: canal || 'mini_app',
  });
  return true;
}

module.exports = {
  resolveToken,
  registerOpenedIfFirst,
  identify,
  verifyOtp,
  resendOtp,
  resendOtpDeSignRequest,  // 8C: el endpoint interno no necesita un token
  viewDocument,
  getPdfForToken,
  // FASE 6 · 5.4: el enlace de firma entrega el documento firmado y la copia
  // del Acuerdo, sin reabrir el flujo.
  getSignedPdfForToken,
  getAgreementCopyForToken,
  // FASE 6 · orden (g)/(h): resolución del Acuerdo de la solicitud y estado
  // de aceptación. La versión estricta (exigirAcuerdoAceptado) es interna.
  resolverAcuerdo,
  resolverAcuerdoVigente,
  resolveCorreoOtp,
  declararMedioOtp,
  declararMedioPublico,
  // 9A: la firma en papel (el 7.1-7.3)
  registrarFirmaEnPapel,
  registrarOpcionPapelDisponible,
  // 9A: los medios autorizados (el 8.2)
  listarMediosTrabajador,
  gestionarMediosTrabajador,
  ESTADOS_CON_MEDIOS,
  acuerdoAceptado,
  // 8B · El dato sensible (10.8).
  resolverDatoSensible,
  sensibleAutorizado,
  exigirConsentimientoSensible,
  consentirDatoSensible,
  commit,
  reject,
  consentAccept,
  clearResendOtpRateLimit,
  // I-VERIFICACION-PUBLICA: contexto de solo lectura + comparación de PDF
  // para que la mini-app muestre metadata verificable y permita al usuario
  // subir su copia para comparar SHA-256 contra el original firmado.
  getVerificationContext,
  verifyPdfHash,
  registerVerifyConsulted,
  // FASE 4 · A1.5.4-B: expuesto con prefijo _ para auditoría de consistencia
  // de correo. No es parte del contrato público, pero permite a los scripts
  // de auditoría (audit-consistency-5puntos.js, audit-multi-sr-correos.js)
  // verificar el orden de prioridad metadata > consent sin tener que
  // replicar la lógica.
  _resolveCorreo: resolveCorreo,
  // Expuestos para la constancia consolidada del expediente
  // (routes/constancia.js): resume la línea de tiempo de cada solicitud
  // en los 6 hitos legibles, sin duplicar la lógica de prioridad.
  _buildHitosFirma: _buildHitosFirma,
  _getConsentResumen: _getConsentResumen,
};
