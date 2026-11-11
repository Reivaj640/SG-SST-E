/**
 * LA ACREDITACION DE LA FACULTAD DE QUIEN CONTRAFIRMA POR GESSTIAR
 * ============================================================================
 *
 * QUE ES
 * ------
 * El registro de los PODERES (y las delegaciones) con los que una persona
 * puede actuar en nombre de Gesstiar S.A.S., y la COMPROBACION de esa
 * facultad cuando K+AIR contrafirma un instrumento.
 *
 * POR QUE EXISTE
 * --------------
 * El abogado (respuesta al punto P7, 10-nov-2026) condiciono la contrafirma
 * del Anexo de Nube:
 *
 *   "La ejecucion por una persona distinta del representante legal de
 *    Gesstiar S.A.S. requerira acreditar previamente la facultad de
 *    representacion o poder suficiente, que debera conservarse en el
 *    expediente."
 *
 * El codigo ya demuestra la facultad del lado de la EMPRESA: `_cotejarFirmante`
 * (services/anexoNube.js) contrasta quien firmo contra el representante legal
 * de la ficha de esa Empresa, y sin ese cotejo no hay contrafirma. Del lado de
 * GESSTIAR no habia nada: el segundo acto se cerraba con el nombre que
 * llegaba en la cabecera `X-Admin-Actor` y sin ninguna acreditacion. Un acta
 * que no dice CON QUE PODER se firmo esta a medias.
 *
 * LAS DOS PREGUNTAS QUE CONTESTA
 * ------------------------------
 *   1. ¿Quien es el representante legal de Gesstiar? Lo declara el manifiesto
 *      legal (`legal-readiness.json` -> `encargado.representante_legal`).
 *      Quien sea esa persona puede contrafirmar sin acreditar nada mas: es
 *      el caso que el abogado excluyo de la exigencia.
 *
 *   2. ¿Y si contrafirma otra persona? Entonces TIENE que haber un poder
 *      acreditado a su nombre, VIGENTE, con su referencia de instrumento y
 *      con la huella SHA-256 del documento. Si no hay, la contrafirma NO se
 *      cierra: se responde 409 FACULTAD_NO_ACREDITADA.
 *
 * LO QUE ESTO NO ES
 * -----------------
 * Esto acredita la FACULTAD (que esa persona pueda actuar por Gesstiar), no
 * la IDENTIDAD de quien esta escribiendo. La identidad descansa en la API key
 * administrativa y en el nombre que declara el operador en `X-Admin-Actor`:
 * el mismo reparto que tiene el resto de los actos administrativos del
 * servicio, y que hay que decir en voz alta en el acta.
 *
 * FALLA CERRADO
 * -------------
 * Si la tabla de poderes no existe (migracion 061 sin aplicar), la
 * comprobacion NO se salta: solo se acepta al representante legal declarado en
 * el manifiesto. Un poder que no se puede leer no es un poder acreditado.
 */

'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const manifiestoLegal = require('./manifiestoLegal');

// ============================================================================
// LAS CONSTANTES
// ============================================================================

/** Los tipos de instrumento que acreditan una facultad. */
const TIPOS = ['PODER', 'DELEGACION', 'REPRESENTACION'];

/** Los estados de un poder acreditado. */
const ESTADOS = {
  VIGENTE: 'VIGENTE',
  REVOCADO: 'REVOCADO',
};

/** Los resultados posibles de la comprobacion de la facultad. */
const RESULTADOS = {
  REPRESENTANTE_LEGAL: 'REPRESENTANTE_LEGAL_ENCARGADO',
  PODER: 'PODER_ACREDITADO',
};

// ============================================================================
// LOS HELPERS
// ============================================================================

/**
 * Un texto acotado: sin principes ni finales, con tope de longitud.
 *
 * @param {*} v
 * @param {number} max
 * @returns {string}
 */
function _texto(v, max) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  const limite = max || 200;
  return s.length > limite ? s.slice(0, limite) : s;
}

/**
 * El nombre de una persona, normalizado para COMPARARLO.
 *
 * Se quitan las marcas combinantes (los codepoints 0x300-0x36F) por
 * comparacion de codepoint: el archivo queda en ASCII puro y el cotejo de
 * nombres no depende de como se escriban las tildes ni de si el nombre llega
 * en mayusculas.
 *
 * @param {*} v
 * @returns {string}
 */
function normalizarNombre(v) {
  return String(v || '').normalize('NFD')
    .split('').filter((ch) => ch.charCodeAt(0) < 0x300).join('')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Una fecha ISO 8601 valida, o null.
 *
 * @param {*} v
 * @returns {string|null}
 */
function _fecha(v) {
  const s = _texto(v, 40);
  if (!s) return null;
  if (Number.isNaN(new Date(s).getTime())) return null;
  return s;
}

/**
 * Una huella SHA-256 en hexadecimal, o null si no lo es.
 *
 * @param {*} v
 * @returns {string|null}
 */
function _hash(v) {
  const s = _texto(v, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(s)) return null;
  return s;
}

/**
 * ¿Existe la tabla de poderes?
 *
 * La migracion 061 puede no estar aplicada todavia (un despliegue parcial, o
 * una base vieja). La comprobacion NO se salta en ese caso: se decide con lo
 * que hay, y lo que no se puede leer no se puede acreditar.
 *
 * @returns {boolean}
 */
function hayTabla() {
  try {
    const filas = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gh_firma_encargado_poderes'",
    ).all();
    return filas.length > 0;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// EL REPRESENTANTE LEGAL DE GESSTIAR
// ============================================================================

/**
 * El representante legal de Gesstiar, tal como lo declara el manifiesto legal.
 *
 * @returns {string} cadena vacia si el manifiesto no lo declara.
 */
function representanteLegalEncargado() {
  try {
    const leido = manifiestoLegal.manifiesto();
    if (!leido || !leido.existe || !leido.datos) return '';
    const encargado = leido.datos.encargado || {};
    return _texto(encargado.representante_legal, 200);
  } catch (e) {
    logger.error('No se pudo leer el representante legal del Encargado del manifiesto', {
      error: e && e.message ? e.message : String(e),
    });
    return '';
  }
}

// ============================================================================
// EL REGISTRO DE PODERES
// ============================================================================

/**
 * Todos los poderes registrados, del mas reciente al mas antiguo.
 *
 * @returns {object[]}
 */
function listarPoderes() {
  if (!hayTabla()) return [];
  try {
    return db.prepare(`SELECT * FROM gh_firma_encargado_poderes
      ORDER BY id DESC`).all();
  } catch (e) {
    logger.error('No se pudo leer el registro de poderes del Encargado', {
      error: e && e.message ? e.message : String(e),
    });
    return [];
  }
}

/**
 * Un poder por su id.
 *
 * @param {number|string} id
 * @returns {object|null}
 */
function poderPorId(id) {
  const n = parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) return null;
  if (!hayTabla()) return null;
  try {
    return db.prepare('SELECT * FROM gh_firma_encargado_poderes WHERE id = ?')
      .get(n) || null;
  } catch (e) {
    return null;
  }
}

/**
 * El rastro de un poder, del primero al ultimo.
 *
 * @param {number|string} id
 * @returns {object[]}
 */
function eventosDePoder(id) {
  const n = parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) return [];
  if (!hayTabla()) return [];
  try {
    return db.prepare(`SELECT evento, detalle, fecha_hora, ip, user_agent
      FROM gh_firma_encargado_poderes_eventos
      WHERE id_poder = ? ORDER BY id ASC`).all(n);
  } catch (e) {
    return [];
  }
}

/**
 * Escribe un evento en el rastro append-only.
 *
 * @param {number} idPoder
 * @param {string} evento
 * @param {string} [detalle]
 * @param {object} [ctx]
 */
function _evento(idPoder, evento, detalle, ctx) {
  try {
    db.prepare(`INSERT INTO gh_firma_encargado_poderes_eventos
      (id_poder, evento, detalle, fecha_hora, ip, user_agent)
      VALUES (?, ?, ?, datetime('now'), ?, ?)`)
      .run(idPoder, evento, detalle || null, (ctx && ctx.ip) || null,
        (ctx && ctx.user_agent) || null);
  } catch (e) {
    logger.error('No se pudo escribir el evento del rastro de poderes', {
      id_poder: idPoder, evento, error: e && e.message ? e.message : String(e),
    });
  }
}

/**
 * Registra un poder (o una delegacion) a nombre de una persona.
 *
 * EL MOTIVO ES OBLIGATORIO: es un acto de K+AIR que habilita a alguien a
 * firmar por la empresa, y un acto sin motivo no dice quien lo hizo ni por que.
 *
 * @param {object} datos
 * @param {string} datos.nombre - quien tiene la facultad.
 * @param {string} [datos.cargo]
 * @param {string} datos.tipo - PODER | DELEGACION | REPRESENTACION.
 * @param {string} datos.instrumento_ref - la referencia del documento.
 * @param {string} datos.instrumento_sha256 - la huella del documento.
 * @param {string} [datos.documento_archivo] - el nombre del archivo del expediente.
 * @param {string} [datos.emitido_at]
 * @param {string} [datos.vigente_desde]
 * @param {string} [datos.vigente_hasta]
 * @param {object} ctx - { actor, motivo, ip, user_agent }.
 * @returns {object} el poder registrado.
 */
function registrarPoder(datos, ctx = {}) {
  if (!hayTabla()) {
    throw new AppError(503, 'REGISTRO_NO_DISPONIBLE',
      'El registro de poderes del Encargado no esta disponible en este servidor: '
      + 'falta aplicar la migracion 061');
  }

  const d = datos || {};

  const nombre = _texto(d.nombre, 200);
  if (!nombre) {
    throw new AppError(400, 'NOMBRE_REQUERIDO',
      'nombre es requerido: sin saber a quien se le da la facultad no hay nada que acreditar');
  }

  const tipo = _texto(d.tipo, 30).toUpperCase();
  if (TIPOS.indexOf(tipo) === -1) {
    throw new AppError(400, 'TIPO_INVALIDO',
      `tipo tiene que ser uno de: ${TIPOS.join(', ')}`);
  }

  const instrumentoRef = _texto(d.instrumento_ref, 300);
  if (!instrumentoRef) {
    throw new AppError(400, 'INSTRUMENTO_REQUERIDO',
      'instrumento_ref es requerido: hay que decir contra que documento se acredita la facultad');
  }

  const instrumentoHash = _hash(d.instrumento_sha256);
  if (!instrumentoHash) {
    throw new AppError(400, 'INSTRUMENTO_HASH_INVALIDO',
      'instrumento_sha256 es requerido y tiene que ser una huella SHA-256 en hexadecimal');
  }

  const motivo = _texto(ctx.motivo, 500);
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para registrar un poder del Encargado');
  }

  const emitidoAt = _fecha(d.emitido_at);
  const vigenteDesde = _fecha(d.vigente_desde);
  const vigenteHasta = _fecha(d.vigente_hasta);
  if (d.emitido_at && !emitidoAt) {
    throw new AppError(400, 'FECHA_INVALIDA', 'emitido_at no es una fecha valida');
  }
  if (d.vigente_desde && !vigenteDesde) {
    throw new AppError(400, 'FECHA_INVALIDA', 'vigente_desde no es una fecha valida');
  }
  if (d.vigente_hasta && !vigenteHasta) {
    throw new AppError(400, 'FECHA_INVALIDA', 'vigente_hasta no es una fecha valida');
  }
  if (vigenteDesde && vigenteHasta && new Date(vigenteHasta) < new Date(vigenteDesde)) {
    throw new AppError(400, 'VIGENCIA_INVALIDA',
      'vigente_hasta no puede ser anterior a vigente_desde');
  }

  const ahora = new Date().toISOString();
  let id = null;
  try {
    const info = db.prepare(`INSERT INTO gh_firma_encargado_poderes
      (nombre, cargo, tipo, instrumento_ref, instrumento_sha256, documento_archivo,
       emitido_at, vigente_desde, vigente_hasta, estado, registrado_por, motivo,
       ip, user_agent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        nombre, _texto(d.cargo, 200) || null, tipo, instrumentoRef, instrumentoHash,
        _texto(d.documento_archivo, 300) || null, emitidoAt, vigenteDesde, vigenteHasta,
        ESTADOS.VIGENTE, _texto(ctx.actor, 200) || null, motivo,
        ctx.ip || null, ctx.user_agent || null, ahora, ahora,
      );
    id = Number(info.lastInsertRowid);
  } catch (e) {
    logger.error('No se pudo registrar el poder del Encargado', {
      nombre, error: e && e.message ? e.message : String(e),
    });
    throw new AppError(500, 'PODER_NO_REGISTRADO',
      'No se pudo registrar el poder del Encargado');
  }

  _evento(id, 'PODER_REGISTRADO',
    `tipo=${tipo} instrumento=${instrumentoRef} hash=${instrumentoHash}`, ctx);

  logger.info('Poder del Encargado registrado', {
    id_poder: id, nombre, tipo, actor: ctx.actor || null,
  });

  return poderPorId(id);
}

/**
 * Revoca un poder.
 *
 * NO borra la fila: la deja en REVOCADO, con su fecha y su motivo, y escribe el
 * evento. El expediente tiene que poder decir que hubo un poder vigente y que
 * dejo de estarlo.
 *
 * @param {number|string} id
 * @param {object} ctx - { actor, motivo, ip, user_agent }.
 * @returns {object} el poder revocado.
 */
function revocarPoder(id, ctx = {}) {
  const poder = poderPorId(id);
  if (!poder) {
    throw new AppError(404, 'PODER_NO_ENCONTRADO', 'No existe ese poder');
  }
  if (poder.estado === ESTADOS.REVOCADO) {
    throw new AppError(409, 'PODER_YA_REVOCADO', 'Ese poder ya estaba revocado');
  }

  const motivo = _texto(ctx.motivo, 500);
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para revocar un poder del Encargado');
  }

  const revocadoAt = new Date().toISOString();
  db.prepare(`UPDATE gh_firma_encargado_poderes
    SET estado = ?, revocado_at = ?, revocado_motivo = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(ESTADOS.REVOCADO, revocadoAt, motivo, poder.id);

  _evento(poder.id, 'PODER_REVOCADO', `motivo=${motivo}`, ctx);

  logger.info('Poder del Encargado revocado', {
    id_poder: poder.id, nombre: poder.nombre, actor: ctx.actor || null,
  });

  return poderPorId(poder.id);
}

// ============================================================================
// LA COMPROBACION DE LA FACULTAD
// ============================================================================

/**
 * ¿Un poder está vigente AHORA?
 *
 * @param {object} poder
 * @param {string} [ahora] - ISO 8601 del instante de la comprobacion.
 * @returns {boolean}
 */
function estaVigente(poder, ahora) {
  if (!poder) return false;
  if (String(poder.estado || '') !== ESTADOS.VIGENTE) return false;
  const momento = ahora ? new Date(ahora) : new Date();
  if (poder.vigente_desde && new Date(poder.vigente_desde) > momento) return false;
  if (poder.vigente_hasta && new Date(poder.vigente_hasta) < momento) return false;
  return true;
}

/**
 * El poder vigente de una persona, si lo hay.
 *
 * Si hay mas de uno, manda el mas reciente (el id mas alto): es el ultimo
 *atto sobre esa persona, y es el que refleja la situacion actual.
 *
 * @param {string} nombre
 * @param {string} [ahora]
 * @returns {object|null}
 */
function poderVigenteDe(nombre, ahora) {
  const objetivo = normalizarNombre(nombre);
  if (!objetivo) return null;
  const candidatos = listarPoderes().filter(
    (p) => normalizarNombre(p.nombre) === objetivo && estaVigente(p, ahora),
  );
  if (!candidatos.length) return null;
  return candidatos[0];
}

/**
 * La COMPROBACION de la facultad de quien contrafirma por Gesstiar.
 *
 * Es la funcion que la contrafirma del Anexo de Nube llama antes de cerrar el
 * segundo acto. Devuelve el dato con el que se justifico la facultad, o
 * LANZA el error 409 FACULTAD_NO_ACREDITADA.
 *
 * @param {string} actor - quien hace el acto (la cabecera `X-Admin-Actor`).
 * @param {string} [ahora] - ISO 8601 del instante de la comprobacion.
 * @returns {object} { resultado, nombre, cargo, tipo, instrumento_ref,
 *   instrumento_sha256, id_poder, verificado_at }
 */
function verificarFacultadContrafirmante(actor, ahora) {
  const momento = ahora || new Date().toISOString();
  const nombre = _texto(actor, 200);

  if (!nombre) {
    throw new AppError(409, 'FACULTAD_NO_ACREDITADA',
      'No se sabe quien hizo el acto: la contrafirma tiene que declarar el actor '
      + '(X-Admin-Actor) para poder cotejar su facultad de representacion');
  }

  // 1. EL REPRESENTANTE LEGAL DE GESSTIAR: no necesita acreditar nada mas.
  //    Es el caso que el abogado excluyo de la exigencia.
  const representante = representanteLegalEncargado();
  if (representante && normalizarNombre(representante) === normalizarNombre(nombre)) {
    return {
      resultado: RESULTADOS.REPRESENTANTE_LEGAL,
      nombre,
      cargo: 'Representante Legal',
      tipo: 'REPRESENTACION',
      instrumento_ref: 'Representante legal declarado en el manifiesto legal '
        + '(legal-readiness.json -> encargado.representante_legal)',
      instrumento_sha256: null,
      id_poder: null,
      verificado_at: momento,
    };
  }

  // 2. UNA PERSONA DISTINTA: tiene que haber un poder acreditado a su nombre.
  const poder = poderVigenteDe(nombre, momento);
  if (poder) {
    return {
      resultado: RESULTADOS.PODER,
      nombre: poder.nombre,
      cargo: poder.cargo || null,
      tipo: poder.tipo,
      instrumento_ref: poder.instrumento_ref,
      instrumento_sha256: poder.instrumento_sha256,
      documento_archivo: poder.documento_archivo || null,
      id_poder: poder.id,
      emitido_at: poder.emitido_at || null,
      vigente_desde: poder.vigente_desde || null,
      vigente_hasta: poder.vigente_hasta || null,
      verificado_at: momento,
    };
  }

  // 3. NADA: no se contrafirma.
  throw new AppError(409, 'FACULTAD_NO_ACREDITADA',
    'Quien contrafirma no es el representante legal de Gesstiar S.A.S. y no tiene '
    + 'un poder acreditado vigente a su nombre: la ejecucion por una persona '
    + 'distinta exige acreditar previamente la facultad de representacion o poder '
    + 'suficiente. Registre el poder por la via administrativa y repita el acto.');
}

module.exports = {
  TIPOS,
  ESTADOS,
  RESULTADOS,
  normalizarNombre,
  hayTabla,
  representanteLegalEncargado,
  listarPoderes,
  poderPorId,
  eventosDePoder,
  registrarPoder,
  revocarPoder,
  estaVigente,
  poderVigenteDe,
  verificarFacultadContrafirmante,
};
