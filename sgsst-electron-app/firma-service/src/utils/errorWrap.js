/**
 * Util: withAppErrorWrapping
 *
 * Envuelve una función async para que cualquier error no-AppError que
 * lance se convierta en un AppError(500, code, message, {original_error,
 * original_code}). Preserva AppError existente (no doble-wrapping).
 *
 * Propósito: observabilidad operativa. El errorHandler central solo
 * distingue AppError (con código específico) de Error genérico
 * (INTERNAL_ERROR). Con este helper, los servicios pueden declarar
 * códigos específicos para errores esperados (pdfGen falla,
 * registerEvent falla, etc.) sin tener que envolver manualmente cada
 * llamada en try/catch.
 *
 * Comportamiento:
 *   - Si la función resuelve: retorna el valor tal cual, sin alterar.
 *   - Si la función rechaza con AppError: lo re-lanza sin cambios.
 *   - Si la función rechaza con cualquier otro error: lo envuelve como
 *     AppError(500, code, message) y agrega original_error (mensaje
 *     del error original) y original_code (código del error original,
 *     si existe) en details.
 *
 * Uso típico:
 *   const buf = await withAppErrorWrapping(
 *     () => pdfGen.generateSignedPdf(original, meta),
 *     'PDF_GENERATION_FAILED',
 *     'Fallo al generar el PDF firmado',
 *   );
 *
 * I-008.x: HALLAZGO #2 (registerEvent → INTERNAL_ERROR) y #3
 * (pdfGen → INTERNAL_ERROR) usan este helper para que el cliente
 * reciba códigos específicos en lugar de INTERNAL_ERROR genérico.
 */
'use strict';

const { AppError } = require('../middleware/errors');

/**
 * Envuelve una función async. Errores no-AppError se convierten en
 * AppError(500, code, message) con `original_error` y `original_code`
 * en details. AppError existente se preserva.
 *
 * @template T
 * @param {() => Promise<T>} fn - Función async a ejecutar.
 * @param {string} code - Código de error a usar si fn lanza error no-AppError
 *   (e.g. 'PDF_GENERATION_FAILED', 'EVENT_REGISTRATION_FAILED').
 * @param {string} message - Mensaje human-readable para el cliente.
 * @returns {Promise<T>} El valor que retorne fn, o lanza AppError.
 */
async function withAppErrorWrapping(fn, code, message) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      // AppError existente: preservar sin re-envolver.
      throw err;
    }
    // Cualquier otro error: envolver como AppError(500, code, message).
    // Preserva original_error y original_code para observabilidad.
    throw new AppError(500, code, message, {
      original_error: err && err.message ? err.message : String(err),
      original_code: err && err.code ? err.code : null,
    });
  }
}

module.exports = { withAppErrorWrapping };
