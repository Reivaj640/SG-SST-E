/**
 * Servicio del Acuerdo de uso de firma electrónica.
 *
 * Maneja el versionado del Acuerdo y la consulta de la versión activa.
 *
 * Ver DATA_MODEL.md §3.1 (tabla gh_firma_acuerdo_versiones).
 * Ver API.md §6.9 (GET /internal/acuerdo-activo).
 */
'use strict';

const db = require('../db/connection');
const { sha256 } = require('../crypto/hash');
const logger = require('../utils/logger');

/**
 * Obtiene la versión activa del Acuerdo.
 *
 * @returns {object|null} La versión activa, o null si no existe ninguna.
 */
function getActive() {
  const row = db.prepare(`
    SELECT id, version, texto, texto_hash, fecha_vigencia_inicio,
           fecha_vigencia_fin, activa, creado_por, kair_version,
           fecha_creacion
    FROM gh_firma_acuerdo_versiones
    WHERE activa = 1
    LIMIT 1
  `).get();
  return row || null;
}

/**
 * Obtiene una versión del Acuerdo por su identificador.
 *
 * @param {string} version - Identificador de versión (ej. 'v1.0')
 * @returns {object|null}
 */
function getByVersion(version) {
  if (typeof version !== 'string' || version.length === 0) return null;
  return db.prepare(`
    SELECT id, version, texto, texto_hash, fecha_vigencia_inicio,
           fecha_vigencia_fin, activa, creado_por, kair_version,
           fecha_creacion
    FROM gh_firma_acuerdo_versiones
    WHERE version = ?
    LIMIT 1
  `).get(version);
}

/**
 * Crea una nueva versión del Acuerdo.
 *
 * - Si se marca como activa, desactiva la versión activa anterior
 *   (transacción).
 * - Calcula texto_hash automáticamente.
 *
 * @param {object} opts
 * @param {string} opts.version - ej. 'v1.0'
 * @param {string} opts.texto - Texto completo
 * @param {string} [opts.creado_por]
 * @param {string} [opts.kair_version]
 * @param {boolean} [opts.activa=true]
 * @returns {object} La versión creada
 */
function createVersion({ version, texto, creado_por, kair_version, activa = true }) {
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('createVersion: version requerida');
  }
  if (typeof texto !== 'string' || texto.length === 0) {
    throw new Error('createVersion: texto requerido');
  }

  const texto_hash = sha256(texto);
  const fecha_vigencia_inicio = new Date().toISOString();
  const fecha_creacion = fecha_vigencia_inicio;

  const tx = db.transaction(() => {
    if (activa) {
      // Desactivar la versión activa anterior
      db.prepare('UPDATE gh_firma_acuerdo_versiones SET activa = 0').run();
    }
    db.prepare(`
      INSERT INTO gh_firma_acuerdo_versiones
        (version, texto, texto_hash, fecha_vigencia_inicio,
         activa, creado_por, kair_version, fecha_creacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      version, texto, texto_hash, fecha_vigencia_inicio,
      activa ? 1 : 0, creado_por || null, kair_version || null,
      fecha_creacion,
    );
  });
  tx();

  logger.info('Versión de Acuerdo creada', { version, activa });
  return getByVersion(version);
}

module.exports = {
  getActive,
  getByVersion,
  createVersion,
};
