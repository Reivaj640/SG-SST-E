/**
 * Util: withAppErrorWrapping (async) + withAppErrorWrappingSync (sync)
 *
 * Envuelven una función (async o sync) para que cualquier error
 * no-AppError que lance se convierta en un AppError(500, code, message,
 * {original_error, original_code}). Preservan AppError existente (no
 * doble-wrapping).
 *
 * Propósito: observabilidad operativa. El errorHandler central solo
 * distingue AppError (con código específico) de Error genérico
 * (INTERNAL_ERROR). Con estos helpers, los servicios pueden declarar
 * códigos específicos para errores esperados (pdfGen falla,
 * registerEvent falla, etc.) sin tener que envolver manualmente cada
 * llamada en try/catch.
 *
 * Comportamiento (idéntico en ambas versiones):
 *   - Si la función resuelve/retorna: retorna el valor tal cual, sin alterar.
 *   - Si la función rechaza con AppError: lo re-lanza sin cambios.
 *   - Si la función rechaza con cualquier otro error: lo envuelve como
 *     AppError(500, code, message) y agrega original_error (mensaje
 *     del error original) y original_code (código del error original,
 *     si existe) en details.
 *
 * Uso típico (async):
 *   const buf = await withAppErrorWrapping(
 *     () => pdfGen.generateSignedPdf(original, meta),
 *     'PDF_GENERATION_FAILED',
 *     'Fallo al generar el PDF firmado',
 *   );
 *
 * Uso típico (sync, dentro de db.transaction):
 *   withAppErrorWrappingSync(
 *     () => signRequestService.registerEvent(id, 'EVENT', meta, 'actor', ip, ua),
 *     'EVENT_REGISTRATION_FAILED',
 *     'No se pudo registrar el evento',
 *   );
 *
 * I-008.x: HALLAZGO #2 (registerEvent → INTERNAL_ERROR) y #3
 * (pdfGen → INTERNAL_ERROR) usan estos helpers para que el cliente
 * reciba códigos específicos en lugar de INTERNAL_ERROR genérico.
 * HALLAZGO #2 usa la versión SYNC porque las llamadas viven dentro
 * de la callback de db.transaction (que es sync en better-sqlite3 v11
 * y no soporta await).
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

/**
 * Versión SÍNCRONA de withAppErrorWrapping. Misma semántica, pero
 * pensada para callbacks sync que NO pueden usar `await` (ej. la
 * callback de `db.transaction(() => { ... })` en better-sqlite3 v11,
 * que rechaza callbacks que retornan Promise).
 *
 * Caso de uso (I-008.3): envolver las llamadas a
 * `signRequestService.registerEvent()` DENTRO de la tx de commit en
 * publicFlow.js. Como la callback de `db.transaction` es sync y no
 * puede ser `async`, `await withAppErrorWrapping(...)` no compila
 * (SyntaxError). `withAppErrorWrappingSync` resuelve esto sin perder
 * la garantía de observabilidad: cualquier error no-AppError se
 * convierte en AppError(500, code, message) con `original_error` y
 * `original_code` en details.
 *
 * Comportamiento: idéntico a la versión async — solo cambia la firma
 * (sync vs async). Preserva AppError existente (no doble-wrapping).
 *
 * @template T
 * @param {() => T} fn - Función sync a ejecutar.
 * @param {string} code - Código de error si fn lanza error no-AppError
 *   (e.g. 'EVENT_REGISTRATION_FAILED').
 * @param {string} message - Mensaje human-readable para el cliente.
 * @returns {T} El valor que retorne fn, o lanza AppError.
 * @throws {AppError} Si fn lanza error no-AppError, se envuelve como
 *   AppError(500, code, message). Si fn lanza AppError, se re-lanza
 *   sin cambios.
 */
function withAppErrorWrappingSync(fn, code, message) {
  try {
    return fn();
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

module.exports = { withAppErrorWrapping, withAppErrorWrappingSync };
