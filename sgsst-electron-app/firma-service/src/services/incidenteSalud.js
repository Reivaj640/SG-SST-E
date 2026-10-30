/**
 * CARGA ACCIDENTAL DE DATOS DE SALUD (el 10.8(d) del Acuerdo de uso)
 * =================================================================
 *
 * QUE ES ESTE MODULO
 * ------------------
 * El soporte MINIMO del procedimiento que el Acuerdo exige cuando se carga
 * por accidente un documento con datos de salud. Es un procedimiento
 * CONTRACTUAL, no un modulo de incidentes: no hay bandeja, no hay triaje, no
 * hay escalamiento, no hay plazos de notificacion.
 *
 * Lo que el 10.8(d) le exige a K+AIR (el Encargado) es exactamente esto:
 *
 *   (i)   BLOQUEAR la solicitud y su enlace de firma, de modo que no pueda
 *         firmarse ni reimprimirse, y RETENERLA para que no sea suprimida
 *         mientras se resuelve el reporte.
 *   (ii)  AISLAR el documento: no comunicarlo a terceros distintos de los
 *         subencargados del Anexo de Nube, no usarlo para otra finalidad y
 *         conservarlo solo mientras se resuelve el reporte.
 *   (iii) REGISTRAR el reporte en el registro de eventos del servicio, con
 *         fecha y hora, quien lo reporta, la causa invocada y las medidas
 *         adoptadas (el 3.6(g)).
 *   (iv)  AVISAR a la Empresa por su canal de incidentes y informarle de que
 *         la solicitud quedo bloqueada.
 *   (v)   SUPRIMIR el documento y sus derivados conforme al 8.6 cuando se
 *         resuelve el reporte, y liberar el hold.
 *
 * QUE NO HACE (Y POR QUE)
 * -----------------------
 * El aislamiento del documento ORIGINAL que esta en poder de la Empresa, las
 * medidas hacia el Titular y el reporte a la autoridad son de la EMPRESA: es
 * la Responsable del tratamiento (el 10.1). K+AIR es el Encargado. Este
 * modulo no construye nada de eso: registra, bloquea, retiene y avisa.
 *
 * COMO SE BLOQUEA
 * --------------
 * Con el estado terminal REVOKED, que es el mecanismo que ya existe para
 * "esta solicitud ya no va". Un estado terminal hace que `resolveToken()`
 * responda 410, y con el 410 caen a la vez las tres cosas que el 10.8(d)(i)
 * pide cerrar: el enlace de firma (no se abre la mini-app), la firma (no se
 * puede firmar) y la reimpresion (no se descarga ni el PDF original ni el
 * firmado ni la Constancia).
 *
 * El estado NO se inventa: se usa el que el sistema ya tiene y el que ya
 * sabe leer el resto del codigo. Lo que NO se hace es desmentir una firma ya
 * hecha: una solicitud en estado SIGNED no se "desfirma" (eso seria
 * falsear la evidencia), y el reporte lo dice en vez de fingir un bloqueo que
 * no ocurrio.
 *
 * LA RETENCION
 * ------------
 * El hold de `services/conservacion.js` (el mismo que usa el deber legal de
 * conservacion). Con hold, la fila NUNCA es elegible para supresion: no la
 * borra el codigo y no la borra la base de datos (el trigger de la migracion
 * 020 se niega). Ademas, mientras el hold esta puesto, el registro de eventos
 * tampoco se puede alterar: el evento del 10.8(d)(iii) sobrevive al reporte.
 *
 * Los nombres de los eventos son ESTABLES. El 3.6(g) dice que el registro no
 * se altera una vez escrito: un evento escrito con un nombre no se puede
 * renombrar despues sin romper a quien ya lo leyo.
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const signRequestService = require('./signRequest');
const conservacion = require('./conservacion');
const empresaService = require('./empresa');
const mailer = require('./mailer');
const { AppError } = require('../middleware/errors');

/**
 * Los dos eventos del 10.8(d).
 *
 * - INCIDENTE_DATOS_SENSIBLES: se escribe al registrar el reporte (iii).
 * - INCIDENTE_DATOS_SENSIBLES_RESUELTO: se escribe cuando el reporte se
 *   resuelve (v).
 *
 * Son NOMBRES, no parametros: no se traducen, no se versionan, no se
 * reconstuyen. Quien mira la linea de tiempo los ve por su etiqueta legible
 * (EVENTO_LABEL en services/pdfGen.js y _EVENTO_LABELS en la app Electron).
 */
const EVENTO_INCIDENTE = 'INCIDENTE_DATOS_SENSIBLES';
const EVENTO_RESUELTO = 'INCIDENTE_DATOS_SENSIBLES_RESUELTO';

/**
 * El motivo del hold.
 *
 * NEUTRO a proposito: el `motivo_hold` se muestra al firmante (public.js lo
 * lee como "norma de conservacion"), asi que no puede llevar la causa del
 * reporte adentro. La causa viaja en el EVENTO, que es donde el 10.8(d)(iii)
 * la pide.
 */
const MOTIVO_HOLD = 'incidente_datos_sensibles';

/**
 * Los estados desde los que la solicitud se puede bloquear.
 *
 * Son los no terminales del CHECK de `gh_firmas_electronicas.estado`
 * (migracion 001, revisada por la 005 y la 014). Los terminales ya estan
 * cerrados: no hay nada que bloquear en ellos.
 */
const ESTADOS_BLOQUEABLES = [
  'PENDING',
  'OPENED',
  'IDENTIFICATION_STARTED',
  'IDENTIFIED',
  'OTP_SENT',
  'OTP_VERIFIED',
  'DOCUMENT_OPENED',
  'DOCUMENT_VIEWED',
  'MANIFESTATION_RECORDED',
  'OTP_LOCKED',
  'IDENTIFICATION_FAILED',
];

/**
 * Texto limpio y no vacio.
 *
 * @param {*} valor
 * @param {string} campo - Para el mensaje del error.
 * @param {number} [max] - Longitud maxima.
 * @returns {string}
 */
function _texto(valor, campo, max = 2000) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', `\`${campo}\` es requerido`, { campo });
  }
  return texto.slice(0, max);
}

/**
 * Una lista de medidas: texto plano, sin vacios.
 *
 * @param {*} valor
 * @returns {string[]}
 */
function _medidas(valor) {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((m) => (typeof m === 'string' ? m.trim() : ''))
    .filter((m) => m.length > 0)
    .map((m) => m.slice(0, 500));
}

/**
 * El primer correo que se puede leer en un texto libre.
 *
 * `canal_incidentes` es texto libre: puede ser un correo, una URL de un
 * formulario, un telefono o un texto con el correo adentro. De un texto
 * libre se saca el primer correo que parece un correo; si no hay ninguno, el
 * canal NO es un correo y se cae al siguiente destino.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function _correoDe(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  if (!texto) return null;
  const encontrado = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(texto);
  return encontrado ? encontrado[0] : null;
}

/**
 * A quien se avisa, y por que se avisa ahi.
 *
 * El 10.8(d)(iv) dice "K+AIR avisa a la Empresa por su canal de incidentes".
 * El canal de incidentes es `canal_incidentes`. Si ahi no hay un correo
 * valido (la Empresa declaro una URL, un telefono, o nada), el aviso cae al
 * `responsable_tratamiento_correo`, que es el otro buzon que la Empresa
 * registro y el unico que garantiza que exista. Si tampoco hay ese, NO se
 * manda correo: el reporte se registra igual y queda constancia de que el
 * aviso no salio. Un reporte jamas falla por falta de correo.
 *
 * @param {object|null} empresa - La fila de `gh_firma_empresas`.
 * @returns {{destinatario: string|null, origen: string, motivo_fallback: string|null}}
 */
function _destinatario(empresa) {
  const canal = empresa ? empresa.canal_incidentes : null;
  const correoCanal = _correoDe(canal);
  if (correoCanal) {
    return { destinatario: correoCanal, origen: 'canal_incidentes', motivo_fallback: null };
  }
  const correoResponsable = _correoDe(empresa ? empresa.responsable_tratamiento_correo : null);
  if (correoResponsable) {
    return {
      destinatario: correoResponsable,
      origen: 'responsable_tratamiento_correo',
      motivo_fallback: 'la Empresa no tiene un correo valido en su canal de incidentes',
    };
  }
  return {
    destinatario: null,
    origen: 'ninguno',
    motivo_fallback: 'la Empresa no tiene correo de incidentes ni de responsable de tratamiento',
  };
}

/**
 * La firma del reporte, por id_solicitud.
 *
 * @param {string} id_solicitud
 * @returns {object}
 */
function _firma(id_solicitud) {
  const fila = signRequestService.getByIdSolicitud(id_solicitud);
  if (!fila) {
    throw new AppError(404, 'SIGN_REQUEST_NOT_FOUND',
      `La solicitud ${id_solicitud} no existe`, { id_solicitud });
  }
  return fila;
}

/**
 * Los holds VIGENTES de una firma.
 *
 * @param {number} idFirma
 * @returns {object[]}
 */
function _holdsActivos(idFirma) {
  return conservacion.holdsDe(idFirma).filter((h) => Number(h.activo) === 1);
}

/**
 * Registra el reporte de una carga accidental de datos de salud.
 *
 * ORDEN DE LAS OPERACIONES (importa):
 *   1. bloquear   (i)   - la solicitud deja de firmarse y de reimprimirse
 *   2. retener    (i)   - el hold impide que se suprima mientras se resuelve
 *   3. avisar     (iv)  - la Empresa se enter por su canal de incidentes
 *   4. registrar (iii) - el evento con la trazabilidad minima
 *
 * El evento va AL FINAL a proposito: el registro de eventos es append-only,
 * asi que lo que se escribe no se puede corregir despues. Escribiendolo al
 * final, el evento ya puede decir si el aviso salio o no.
 *
 * @param {object} opts
 * @param {string} opts.id_solicitud - SIGN-YYYY-NNNNNN
 * @param {string} opts.reporta - QUIEN reporta (el 10.8(d)(iii)).
 * @param {string} opts.causa - La causa invocada.
 * @param {string[]} [opts.medidas] - Medidas declaradas por quien reporta.
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {Promise<object>} Lo que se hizo.
 */
async function reportar(opts = {}) {
  const id_solicitud = _texto(opts.id_solicitud, 'id_solicitud', 64);
  const reporta = _texto(opts.reporta, 'reporta', 200);
  const causa = _texto(opts.causa, 'causa', 2000);
  const medidasDeclaradas = _medidas(opts.medidas);

  const firma = _firma(id_solicitud);
  const ahora = new Date().toISOString();

  // ── (i) BLOQUEO ────────────────────────────────────────────────────────
  const estadoPrevio = firma.estado;
  let bloqueo = { aplicado: false, estado_previo: estadoPrevio, estado_nuevo: estadoPrevio, motivo: null };

  if (ESTADOS_BLOQUEABLES.includes(estadoPrevio)) {
    const upd = db.prepare(`
      UPDATE gh_firmas_electronicas
         SET estado = 'REVOKED',
             fecha_revocacion = ?,
             motivo_revocacion = ?
       WHERE id = ? AND estado = ?
    `).run(ahora, MOTIVO_HOLD, firma.id, estadoPrevio);
    if (upd.changes !== 1) {
      throw new AppError(409, 'INVALID_STATE_TRANSITION',
        'La solicitud cambio de estado mientras se registraba el reporte',
        { estado_previo: estadoPrevio });
    }
    bloqueo = { aplicado: true, estado_previo: estadoPrevio, estado_nuevo: 'REVOKED', motivo: null };
  } else if (estadoPrevio === 'REVOKED') {
    // Ya estaba bloqueada: el reporte se registra igual (la trazabilidad no
    // depende de que el bloqueo sea nuevo).
    bloqueo = {
      aplicado: true,
      estado_previo: estadoPrevio,
      estado_nuevo: estadoPrevio,
      motivo: 'la solicitud ya estaba bloqueada',
    };
  } else if (estadoPrevio === 'SIGNED' || estadoPrevio === 'DUAL_FIRMADO') {
    // NO se inventa un bloqueo: una firma que ya ocurrio no se puede des-firmar
    // sin falsear la evidencia. Lo que se puede es retener y avisar.
    bloqueo = {
      aplicado: false,
      estado_previo: estadoPrevio,
      estado_nuevo: estadoPrevio,
      motivo: 'la solicitud ya estaba firmada: no hay firma que bloquear; '
        + 'queda retenida y avisada, y la copia que la Empresa conserva es de la Empresa',
    };
  } else {
    // Los demas terminales (REJECTED, EXPIRED, CANCELLED) ya tienen el enlace
    // muerto: no hay nada que cerrar.
    bloqueo = {
      aplicado: true,
      estado_previo: estadoPrevio,
      estado_nuevo: estadoPrevio,
      motivo: 'la solicitud ya estaba en un estado terminal: el enlace ya no servia',
    };
  }

  // ── (i) RETENCION ──────────────────────────────────────────────────────
  // Si ya habia un hold vigente, la retencion ya esta garantizada: no se
  // declara un segundo, porque dos holds activos se desarman a medias
  // (liberarHold solo baja el mas reciente) y la firma podria quedar retenida
  // por un motivo que ya se levanto.
  const holdsPrevios = _holdsActivos(firma.id);
  let retencion;
  if (holdsPrevios.length > 0) {
    retencion = {
      declarada: false,
      motivo: 'la firma ya tenia una retencion vigente',
      hold_previo: {
        actor: holdsPrevios[0].actor,
        motivo: holdsPrevios[0].motivo,
        alcance: holdsPrevios[0].alcance,
      },
    };
  } else {
    const hold = conservacion.ponerHold(firma.id, {
      actor: reporta,
      motivo: MOTIVO_HOLD,
      alcance: `${MOTIVO_HOLD}:${id_solicitud}`,
    });
    retencion = { declarada: true, motivo: null, hold_previo: null, declarado_at: hold.declarado_at };
  }

  // ── (ii) AISLAMIENTO ───────────────────────────────────────────────────
  // El aislamiento del documento, en el alcance de K+AIR, es esto: el
  // documento no se comunica (el aviso no lleva adjunto ni enlace), no se
  // usa para otra finalidad (la solicitud queda bloqueada, no se genera
  // Constancia, no sale ninguna copia) y se conserva solo mientras se
  // resuelve el reporte (el hold lo impide suprimir).
  const aislamiento = {
    documento_comunicado: false,
    documento_en_correo: false,
    enlace_de_descarga: false,
    conservado_hasta_resolver_el_reporte: true,
  };

  // ── (iv) AVISO A LA EMPRESA ────────────────────────────────────────────
  const empresa = empresaService.getById(firma.id_empresa);
  const destinatario = _destinatario(empresa);
  let notificacion = {
    enviada: false,
    destinatario: destinatario.destinatario,
    origen_canal: destinatario.origen,
    motivo_fallback: destinatario.motivo_fallback,
    message_id: null,
    error: null,
  };

  if (destinatario.destinatario) {
    try {
      const envio = await mailer.sendAvisoIncidenteDatosSensibles({
        to: destinatario.destinatario,
        canal: destinatario.origen,
        id_solicitud,
        causa,
        medidas: medidasDeclaradas,
        fecha_reporte: ahora,
      });
      notificacion = {
        enviada: true,
        destinatario: destinatario.destinatario,
        origen_canal: destinatario.origen,
        motivo_fallback: destinatario.motivo_fallback,
        message_id: envio.messageId || null,
        error: null,
      };
    } catch (err) {
      // El aviso NO es lo que hace el reporte. Si el correo falla, el
      // reporte se registra igual: lo que se perdio fue el aviso, no el
      // bloqueo ni la retencion ni la trazabilidad.
      notificacion.error = err.message;
      logger.warn('No se pudo avisar a la Empresa del incidente de datos sensibles', {
        id_solicitud,
        id_empresa: firma.id_empresa,
        error: err.message,
      });
    }
  } else {
    logger.warn('Incidente de datos sensibles registrado sin aviso: la Empresa no tiene correo', {
      id_solicitud,
      id_empresa: firma.id_empresa,
      motivo: destinatario.motivo_fallback,
    });
  }

  // ── (iii) REGISTRO ─────────────────────────────────────────────────────
  const medidas = [
    'solicitud bloqueada: no se puede firmar ni reimprimir',
    'documento retenido: no se suprime mientras se resuelve el reporte',
    'documento no comunicado: el aviso no lleva adjunto ni enlace de descarga',
    'documento conservado solo mientras se resuelve el reporte',
  ].concat(medidasDeclaradas);

  signRequestService.registerEvent(firma.id, EVENTO_INCIDENTE, {
    id_solicitud,
    reporta,
    causa,
    medidas,
    fecha_reporte: ahora,
    bloqueo: bloqueo.estado_nuevo,
    bloqueo_aplicado: bloqueo.aplicado,
    bloqueo_motivo: bloqueo.motivo,
    retencion: retencion.declarada ? 'declarada' : 'preexistente',
    aislamiento,
    notificacion,
  }, reporta, opts.ip, opts.user_agent);

  logger.warn('Incidente de datos sensibles registrado', {
    id_solicitud,
    id_empresa: firma.id_empresa,
    reporta,
    bloqueo: bloqueo.estado_nuevo,
    notificacion_enviada: notificacion.enviada,
  });

  return {
    id_solicitud,
    estado: bloqueo.estado_nuevo,
    bloqueo,
    retencion,
    aislamiento,
    notificacion,
    medidas,
    evento: EVENTO_INCIDENTE,
  };
}

/**
 * Resuelve el reporte: libera el hold y deja el documento disponible para la
 * via del 8.6.
 *
 * QUE HACE CON EL 8.6
 * -------------------
 * No reescribe el motor de purga: lo deja trabajar. El 8.6 suprime cuando
 * vencio el plazo que declaro la Empresa y no hay deber legal ni
 * contractual de conservacion. El hold era el unico freno que ponia este
 * modulo, asi que al liberarlo el documento vuelve a la via normal: el motor
 * existente lo suprime cuando le toca.
 *
 * El hold NO se levanta si hay otro hold vigente: ese otro hold es el
 * deber legal o contractual de otro, y levantarlo seria privar a la Empresa
 * de una retencion que no le pertenece a este reporte.
 *
 * @param {object} opts
 * @param {string} opts.id_solicitud - SIGN-YYYY-NNNNNN
 * @param {string} opts.resuelve - QUIEN resuelve el reporte.
 * @param {string} opts.causa - Como se resolvio.
 * @param {string[]} [opts.medidas] - Medidas que se adoptaron al resolver.
 * @param {string} [opts.ip]
 * @param {string} [opts.user_agent]
 * @returns {object}
 */
function resolver(opts = {}) {
  const id_solicitud = _texto(opts.id_solicitud, 'id_solicitud', 64);
  const resuelve = _texto(opts.resuelve, 'resuelve', 200);
  const causa = _texto(opts.causa, 'causa', 2000);
  const medidasDeclaradas = _medidas(opts.medidas);

  const firma = _firma(id_solicitud);

  // El reporte tiene que existir: resolver un incidente que nunca se
  // reporto escribiria una resolucion sin incidente.
  const eventos = db.prepare(
    'SELECT evento, fecha_hora FROM gh_firma_eventos WHERE firma_id = ? ORDER BY id'
  ).all(firma.id);
  const ultimoIncidente = [...eventos].reverse().find((e) => e.evento === EVENTO_INCIDENTE);
  if (!ultimoIncidente) {
    throw new AppError(409, 'NO_HAY_INCIDENTE_ABIERTO',
      'La solicitud no tiene un incidente de datos sensibles registrado',
      { id_solicitud });
  }
  const yaResuelto = [...eventos].reverse().find((e) => e.evento === EVENTO_RESUELTO);
  if (yaResuelto) {
    throw new AppError(409, 'INCIDENTE_YA_RESUELTO',
      'El incidente de datos sensibles ya estaba resuelto',
      { id_solicitud });
  }

  const ahora = new Date().toISOString();

  // ── (v) LIBERAR EL HOLD ────────────────────────────────────────────────
  const holds = _holdsActivos(firma.id);
  const propio = [...holds].reverse().find((h) => h.motivo === MOTIVO_HOLD);
  let liberacion = { liberado: false, motivo: null, liberado_at: null };

  if (!holds.length) {
    liberacion = { liberado: false, motivo: 'no hay ninguna retencion vigente', liberado_at: null };
  } else if (propio) {
    const r = conservacion.liberarHold(firma.id, {
      actor: resuelve,
      motivo: 'reporte de carga accidental de datos de salud resuelto',
    });
    liberacion = { liberado: true, motivo: null, liberado_at: r.liberado_at };
  } else {
    liberacion = {
      liberado: false,
      motivo: 'hay otra retencion vigente que no es de este reporte: no se levanta',
      liberado_at: null,
    };
  }

  // ── (v) VIA DEL 8.6 ────────────────────────────────────────────────────
  // El documento queda disponible para la supresion del 8.6: sin hold, sin
  // que el motor de purga tenga que saltarse nada. Lo que lo suprime es el
  // motor que ya existe (ventana + lote + plazo vencido), no este modulo.
  const via86 = {
    disponible: liberacion.liberado,
    motor: 'supresion (8.6): ventana + lote + plazo declarado por la Empresa',
    retenciones_pendientes: liberacion.liberado ? 0 : holds.length,
  };

  // ── (iii) REGISTRO ─────────────────────────────────────────────────────
  const medidas = [
    'retencion del incidente liberada',
    'documento disponible para la via de supresion del 8.6',
  ].concat(medidasDeclaradas);

  signRequestService.registerEvent(firma.id, EVENTO_RESUELTO, {
    id_solicitud,
    resuelve,
    causa,
    medidas,
    fecha_resolucion: ahora,
    liberacion,
    via_86: via86,
  }, resuelve, opts.ip, opts.user_agent);

  logger.info('Incidente de datos sensibles resuelto', {
    id_solicitud,
    resuelve,
    hold_liberado: liberacion.liberado,
  });

  return {
    id_solicitud,
    liberacion,
    via_86: via86,
    medidas,
    evento: EVENTO_RESUELTO,
  };
}

module.exports = {
  reportar,
  resolver,
  EVENTO_INCIDENTE,
  EVENTO_RESUELTO,
  MOTIVO_HOLD,
};
