/**
 * LAS APROBACIONES DE PUBLICACIÓN DEL ACUERDO (decisión del owner 1.f)
 * =========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * Con el abogado quedó claro que APROBAR EL TEXTO y AUTORIZAR LA PUBLICACIÓN
 * son dos actos distintos:
 *
 *   - El abogado aprueba que el TEXTO diga lo que tiene que decir.
 *   - Alguien con la evidencia técnica (la garantía exigida, el resultado de
 *     las verificaciones y un responsable del despliegue) autoriza que ese
 *     texto se PUBLIQUE.
 *
 * Antes, el que publicaba ya había aprobado: una sola fila de
 * `gh_firma_acuerdo_versiones` guardaba las dos cosas. Por eso la publicación
 * era una promesa (decía "se aprobó") y no una barrera (decía "no se publica
 * sin autorización operativa registrada").
 *
 * POR QUÉ EL HASH ES OBLIGATORIO
 * ------------------------------
 * La aprobación apunta a un TEXTO, no a un nombre de versión. El hash es el
 * SHA-256 del texto aprobado: si el texto cambia un caracter, el hash cambia y
 * la autorización deja de servir para esa versión. Sin el hash, una
 * autorización de la v1.1 serviría para publicar cualquier texto como v1.1.
 *
 * POR QUÉ ES APPEND-ONLY
 * ----------------------
 * La tabla tiene triggers que abortan UPDATE y DELETE (migración 044): lo que
 * se escribió una vez no se altera ni se borra. Una aprobación corregida es
 * una aprobación NUEVA. Por eso `registrar` es IDEMPOTENTE por
 * (versión, hash, tipo) y no duplica la fila: volver a registrar la misma
 * aprobación no agrega nada al rastro.
 *
 * Tests: tests/services/aprobacion-publicacion.test.js
 */
'use strict';

const db = require('../db/connection');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');

/**
 * Los dos tipos de aprobación. Son actos distintos y se archivan por separado.
 * @type {Readonly<Record<string, {label: string, campos: string[]}>>}
 */
const TIPOS = Object.freeze({
  JURIDICA: {
    label: 'Aprobación jurídica del texto',
    campos: ['aprobado_por', 'fecha'],
  },
  OPERATIVA: {
    label: 'Autorización operativa para publicar',
    // La autorización operativa es la que destraba la publicación: por eso exige
    // evidencia completa (qué garantía se comprobó, qué dio y quién responde
    // del despliegue). Sin eso no es una autorización, es una intención.
    campos: [
      'aprobado_por', 'fecha', 'garantia',
      'resultado_verificaciones', 'responsable_despliegue',
    ],
  },
});

const VERSION_REGEX = /^v\d+\.\d+$/;
const HASH_REGEX = /^[0-9a-f]{64}$/;
const MAX_CAMPO_CHARS = 4000;

/**
 * Normaliza un texto de campo libre: sin espacios de más, con tope de largo.
 * @param {string} valor
 * @returns {string|null} null si no hay valor
 */
function _texto(valor) {
  if (typeof valor !== 'string') return null;
  const v = valor.trim();
  if (!v) return null;
  return v.length > MAX_CAMPO_CHARS ? v.slice(0, MAX_CAMPO_CHARS) : v;
}

/**
 * Normaliza la fecha de la aprobación a YYYY-MM-DD.
 *
 * Acepta una fecha (2026-10-27) o un ISO-8601 con hora (2026-10-27T14:40:00Z)
 * y guarda solo el día: la columna `fecha` es el DÍA en que se aprobó.
 *
 * @param {string} valor
 * @returns {string} YYYY-MM-DD
 */
function _fecha(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new AppError(400, 'APROBACION_CAMPOS_INCOMPLETOS',
      'La fecha de la aprobación es obligatoria');
  }
  const d = new Date(valor.trim());
  if (Number.isNaN(d.getTime())) {
    throw new AppError(400, 'APROBACION_CAMPOS_INCOMPLETOS',
      'La fecha de la aprobación no es una fecha válida');
  }
  return d.toISOString().slice(0, 10);
}

/**
 * ¿Existe la tabla de aprobaciones en esta base?
 *
 * La base puede no tener la migración aplicada todavía (una base vieja, o el
 * ambiente de test antes de correr las migraciones). En ese caso NO hay
 * aprobación: la respuesta es "no", que es la respuesta segura (la
 * publicación queda bloqueada).
 *
 * @returns {boolean}
 */
function _tablaExiste() {
  try {
    const fila = db.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'gh_firma_aprobaciones_publicacion'"
    ).get();
    return fila.n > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Registra una aprobación de publicación.
 *
 * IDEMPOTENTE por (versión, hash, tipo): si ya existe esa aprobación, se
 * devuelve la que hay y no se duplica la fila (la tabla es append-only: lo que
 * se escribió no se altera).
 *
 * El hash lo CALCULA EL SERVIDOR a partir del texto (`texto`), o se recibe ya
 * calculado (`hash`). El cliente nunca decide de qué texto se trata: si la
 * versión ya existe en `gh_firma_acuerdo_versiones`, el hash tiene que ser el
 * de ESA versión, o la aprobación no sirve y se rechaza.
 *
 * @param {object} datos
 * @param {string} datos.version - 'v1.0', 'v1.1'...
 * @param {string} [datos.hash] - SHA-256 hex del texto aprobado
 * @param {string} [datos.texto] - el texto aprobado (el servidor calcula el hash)
 * @param {string} datos.tipo - 'JURIDICA' | 'OPERATIVA'
 * @param {string} datos.aprobado_por
 * @param {string} datos.fecha - YYYY-MM-DD o ISO-8601
 * @param {string} [datos.garantia] - texto de la garantía técnica exigida
 * @param {string} [datos.resultado_verificaciones]
 * @param {string} [datos.responsable_despliegue]
 * @param {string} [datos.notas]
 * @returns {object} La aprobación registrada
 * @throws {AppError} 400/409
 */
function registrar(datos) {
  const d = datos || {};

  // 1. La versión.
  if (typeof d.version !== 'string' || !VERSION_REGEX.test(d.version.trim())) {
    throw new AppError(400, 'APROBACION_VERSION_INVALIDA',
      'La versión de la aprobación debe tener el formato v<major>.<minor> (ej. v1.1)');
  }
  const version = d.version.trim();

  // 2. El tipo: JURIDICA u OPERATIVA. No hay un "aprobación genérica".
  const tipo = typeof d.tipo === 'string' ? d.tipo.trim().toUpperCase() : '';
  if (!TIPOS[tipo]) {
    throw new AppError(400, 'APROBACION_TIPO_INVALIDO',
      'El tipo de aprobación debe ser JURIDICA u OPERATIVA');
  }

  // 3. El hash del texto aprobado.
  //
  //    Si viene el TEXTO, el hash lo calcula el servidor. Si viene el hash, se
  //    valida el formato y se contrasta con el texto de la versión si esa
  //    versión ya existe: una aprobación que no apunta al texto publicado no
  //    puede quedarse archivada como si lo pointed.
  let hash = null;
  if (typeof d.texto === 'string' && d.texto.length > 0) {
    hash = sha256(d.texto);
  } else if (typeof d.hash === 'string' && d.hash.trim()) {
    hash = d.hash.trim().toLowerCase();
  }
  if (!hash || !HASH_REGEX.test(hash)) {
    throw new AppError(400, 'APROBACION_HASH_INVALIDO',
      'La aprobación necesita el texto aprobado o su hash SHA-256');
  }

  // 4. Los campos mínimos según el tipo.
  const campos = {};
  for (const nombre of TIPOS[tipo].campos) {
    if (nombre === 'fecha') {
      campos.fecha = _fecha(d.fecha);
      continue;
    }
    const valor = _texto(d[nombre]);
    if (!valor) {
      throw new AppError(400, 'APROBACION_CAMPOS_INCOMPLETOS',
        `La aprobación ${tipo} necesita el campo '${nombre}'`);
    }
    campos[nombre] = valor;
  }
  const garantia = _texto(d.garantia);
  const resultado = _texto(d.resultado_verificaciones);
  const responsable = _texto(d.responsable_despliegue);
  const notas = _texto(d.notas);

  if (!_tablaExiste()) {
    throw new AppError(500, 'APROBACIONES_NO_DISPONIBLES',
      'La tabla de aprobaciones de publicación no existe en esta base');
  }

  // 5. Si la versión YA existe, el hash tiene que ser el de ESA versión.
  const versionExistente = db.prepare(
    'SELECT version, texto_hash FROM gh_firma_acuerdo_versiones WHERE version = ? LIMIT 1'
  ).get(version);
  if (versionExistente && versionExistente.texto_hash !== hash) {
    throw new AppError(409, 'APROBACION_HASH_NO_CORRESPONDE',
      `La aprobación no corresponde al texto de la versión ${version}: `
      + 'el texto cambió, hay que volver a aprobarlo',
      { version, hash_esperado: versionExistente.texto_hash });
  }

  // 6. Idempotencia: la misma aprobación no se archiva dos veces.
  const existente = db.prepare(`
    SELECT * FROM gh_firma_aprobaciones_publicacion
    WHERE version = ? AND hash = ? AND tipo = ?
    LIMIT 1
  `).get(version, hash, tipo);
  if (existente) {
    logger.info('La aprobación ya estaba registrada: no se duplica', {
      version, tipo, id: existente.id,
    });
    return existente;
  }

  // 7. El registro.
  const fecha_creacion = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO gh_firma_aprobaciones_publicacion
      (version, hash, tipo, aprobado_por, fecha, garantia,
       resultado_verificaciones, responsable_despliegue, notas, fecha_creacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    version, hash, tipo, campos.aprobado_por, campos.fecha,
    garantia, resultado, responsable, notas, fecha_creacion
  );

  logger.info('Aprobación de publicación registrada', {
    version, tipo, id: info.lastInsertRowid,
  });

  return db.prepare(
    'SELECT * FROM gh_firma_aprobaciones_publicacion WHERE id = ?'
  ).get(info.lastInsertRowid);
}

/**
 * Lista las aprobaciones de publicación.
 *
 * @param {string} [version] - si se pasa, solo las de esa versión
 * @returns {Array<object>}
 */
function listar(version) {
  if (!_tablaExiste()) return [];
  if (typeof version === 'string' && version.trim()) {
    return db.prepare(`
      SELECT * FROM gh_firma_aprobaciones_publicacion
      WHERE version = ?
      ORDER BY id ASC
    `).all(version.trim());
  }
  return db.prepare(`
    SELECT * FROM gh_firma_aprobaciones_publicacion
    ORDER BY id ASC
  `).all();
}

/**
 * ¿Hay autorización OPERATIVA para publicar ese texto de esa versión?
 *
 * Es la pregunta que hace la barrera de publicación (agreement.createVersion).
 * El hash va explícito: sin él, una autorización de un texto serviría para
 * publicar otro.
 *
 * @param {string} version
 * @param {string} hash - SHA-256 hex del texto a publicar
 * @returns {boolean}
 */
function tieneAprobacionOperativa(version, hash) {
  if (!_tablaExiste()) return false;
  if (typeof version !== 'string' || !version) return false;
  if (typeof hash !== 'string' || !HASH_REGEX.test(hash.trim().toLowerCase())) return false;
  const fila = db.prepare(`
    SELECT id FROM gh_firma_aprobaciones_publicacion
    WHERE version = ? AND hash = ? AND tipo = 'OPERATIVA'
    LIMIT 1
  `).get(version.trim(), hash.trim().toLowerCase());
  return Boolean(fila);
}

module.exports = {
  TIPOS,
  registrar,
  listar,
  tieneAprobacionOperativa,
};
