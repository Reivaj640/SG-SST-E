/**
 * Servicio de almacenamiento de PDFs.
 *
 * Rutas siempre absolutas, derivadas de FIRMA_SERVICE_ROOT.
 * No depende del CWD del proceso.
 *
 * Ver ARCHITECTURE.md §20 (Almacenamiento).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

// Raíz del Servicio (donde está package.json).
// Resuelta en tiempo de carga del módulo, no del CWD.
const SERVICE_ROOT = path.resolve(__dirname, '..', '..');

// Resolver un path respecto a SERVICE_ROOT, garantizando absoluto.
function resolveUnderRoot(p) {
  if (path.isAbsolute(p)) return p;
  return path.resolve(SERVICE_ROOT, p);
}

const PATHS = {
  root: SERVICE_ROOT,
  pdfs: resolveUnderRoot(config.storage.pdfPath),
  originales: resolveUnderRoot(path.join(config.storage.pdfPath, 'originales')),
  firmados: resolveUnderRoot(path.join(config.storage.pdfPath, 'firmados')),
  constancias: resolveUnderRoot(path.join(config.storage.pdfPath, 'constancias')),
};

// Asegurar que los directorios existen al cargar el módulo.
function ensureDirs() {
  for (const dir of [PATHS.pdfs, PATHS.originales, PATHS.firmados, PATHS.constancias]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info('Directorio creado', { dir });
    }
  }
}
ensureDirs();

/**
 * Guarda un PDF original (congelado) en storage.
 *
 * @param {string} filename - Nombre del archivo (sin path).
 *   Se recomienda usar el id_solicitud como nombre: SIGN-2026-000123.pdf
 * @param {Buffer} buffer - Bytes del PDF.
 * @returns {string} Ruta absoluta al archivo guardado.
 */
function saveOriginal(filename, buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('saveOriginal: buffer debe ser un Buffer');
  }
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('saveOriginal: filename requerido');
  }
  // Sanear filename: solo nombre, sin ../ ni caracteres raros
  const safe = path.basename(filename);
  const filepath = path.join(PATHS.originales, safe);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

/**
 * Lee un PDF del storage.
 *
 * @param {string} filepath - Ruta absoluta al archivo.
 * @returns {Buffer}
 */
function readPdf(filepath) {
  if (typeof filepath !== 'string' || !fs.existsSync(filepath)) {
    throw new Error(`readPdf: archivo no encontrado: ${filepath}`);
  }
  return fs.readFileSync(filepath);
}

/**
 * Verifica que un archivo existe.
 */
function exists(filepath) {
  if (typeof filepath !== 'string') return false;
  try {
    return fs.existsSync(filepath);
  } catch {
    return false;
  }
}

/**
 * Borra un PDF del storage. NO se usa en producción normalmente
 * (los PDFs se conservan), pero está disponible para limpieza.
 */
function deletePdf(filepath) {
  if (typeof filepath !== 'string') return false;
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn('No se pudo borrar PDF', { filepath, error: err.message });
    return false;
  }
}

/**
 * Tamaño de un archivo en bytes.
 */
function size(filepath) {
  if (typeof filepath !== 'string' || !fs.existsSync(filepath)) return 0;
  return fs.statSync(filepath).size;
}

module.exports = {
  PATHS,
  saveOriginal,
  readPdf,
  exists,
  deletePdf,
  size,
};
