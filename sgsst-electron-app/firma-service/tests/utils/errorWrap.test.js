/**
 * Tests unitarios del helper withAppErrorWrapping (I-008.1).
 *
 * Cobertura:
 *   1. Error normal → AppError
 *   2. Se conserva el código específico
 *   3. Se conserva el mensaje
 *   4. Se incluyen datos del error original
 *   5. AppError existente → no se vuelve a envolver
 *   6. Error sin message
 *   7. Error con code
 *   8. Función async que resuelve correctamente
 *   9. Función async que rechaza
 *  10. No altera el resultado exitoso
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { withAppErrorWrapping } = require('../../src/utils/errorWrap');
const { AppError } = require('../../src/middleware/errors');

// Helper para construir un AppError de prueba
function makeAppError(status, code, message, details) {
  return new AppError(status, code, message, details);
}

// 1. Error normal → AppError
test('withAppErrorWrapping: error genérico → envuelve como AppError(500, code, message)', async () => {
  const originalErr = new Error('algo falló');
  await assert.rejects(
    withAppErrorWrapping(
      () => Promise.reject(originalErr),
      'TEST_CODE',
      'Test failed'
    ),
    (err) => {
      assert.ok(err instanceof AppError, 'debe ser AppError');
      assert.equal(err.statusCode, 500);
      assert.equal(err.code, 'TEST_CODE');
      assert.equal(err.message, 'Test failed');
      return true;
    }
  );
});

// 2. Se conserva el código específico
test('withAppErrorWrapping: preserva el code pasado al helper', async () => {
  const codes = ['PDF_GENERATION_FAILED', 'EVENT_REGISTRATION_FAILED', 'CUSTOM_CODE_1'];
  for (const code of codes) {
    await assert.rejects(
      withAppErrorWrapping(
        () => Promise.reject(new Error('fail')),
        code,
        'msg'
      ),
      (err) => {
        assert.equal(err.code, code, `code debe ser ${code}`);
        return true;
      }
    );
  }
});

// 3. Se conserva el mensaje
test('withAppErrorWrapping: preserva el message pasado al helper', async () => {
  const messages = ['msg 1', 'fallo crítico', 'long message with special chars: ñáéíóú 🚀'];
  for (const message of messages) {
    await assert.rejects(
      withAppErrorWrapping(
        () => Promise.reject(new Error('original')),
        'CODE',
        message
      ),
      (err) => {
        assert.equal(err.message, message);
        return true;
      }
    );
  }
});

// 4. Se incluyen datos del error original (original_error, original_code)
test('withAppErrorWrapping: incluye original_error y original_code en details', async () => {
  const originalErr = new Error('detalle técnico');
  originalErr.code = 'SQLITE_BUSY';
  await assert.rejects(
    withAppErrorWrapping(
      () => Promise.reject(originalErr),
      'DB_ERROR',
      'Fallo de BD'
    ),
    (err) => {
      assert.equal(err.details.original_error, 'detalle técnico');
      assert.equal(err.details.original_code, 'SQLITE_BUSY');
      return true;
    }
  );
});

// 5. AppError existente → no se vuelve a envolver
test('withAppErrorWrapping: AppError existente se preserva sin re-envolver', async () => {
  const originalAppErr = makeAppError(404, 'NOT_FOUND', 'recurso no existe', { id: 42 });
  await assert.rejects(
    withAppErrorWrapping(
      () => Promise.reject(originalAppErr),
      'WRAP_CODE', // Este code NO debe sobrescribir el original
      'WRAP_MSG'  // Este msg NO debe sobrescribir el original
    ),
    (err) => {
      assert.equal(err, originalAppErr, 'debe ser el MISMO objeto (no copia)');
      assert.equal(err.statusCode, 404, 'preserva statusCode original');
      assert.equal(err.code, 'NOT_FOUND', 'preserva code original');
      assert.equal(err.message, 'recurso no existe', 'preserva message original');
      assert.deepEqual(err.details, { id: 42 }, 'preserva details original');
      return true;
    }
  );
});

// 6. Error sin message (string vacío, null, undefined)
test('withAppErrorWrapping: error sin message → original_error usa String(err) fallback', async () => {
  // Error con message = ''
  const errEmpty = new Error('');
  await assert.rejects(
    withAppErrorWrapping(() => Promise.reject(errEmpty), 'C', 'M'),
    (err) => {
      assert.equal(err.details.original_error, 'Error', 'fallback a "Error" para message vacío');
      return true;
    }
  );

  // Error con message = null
  const errNull = new Error();
  errNull.message = null;
  await assert.rejects(
    withAppErrorWrapping(() => Promise.reject(errNull), 'C', 'M'),
    (err) => {
      // String(null) === 'null', así que el fallback incluye 'null'
      assert.ok(err.details.original_error.length > 0);
      return true;
    }
  );
});

// 7. Error con code (debe preservarse como original_code)
test('withAppErrorWrapping: error con .code → preserva como original_code', async () => {
  const cases = [
    { code: 'ENOENT', desc: 'Node fs error code' },
    { code: 'SQLITE_CONSTRAINT_UNIQUE', desc: 'better-sqlite3 error code' },
    { code: 'EACCES', desc: 'permiso denegado' },
  ];
  for (const c of cases) {
    const err = new Error('test error');
    err.code = c.code;
    await assert.rejects(
      withAppErrorWrapping(() => Promise.reject(err), 'C', 'M'),
      (appErr) => {
        assert.equal(appErr.details.original_code, c.code, `case ${c.desc}: ${c.code}`);
        return true;
      }
    );
  }
});

// 8. Función async que resuelve correctamente
test('withAppErrorWrapping: función async que resuelve → retorna el valor tal cual', async () => {
  const result = await withAppErrorWrapping(
    async () => 'success value',
    'WRAP_CODE',
    'WRAP_MSG'
  );
  assert.equal(result, 'success value', 'debe retornar el valor sin alterar');
});

// 9. Función async que rechaza (sin throw explícito) → envuelve correctamente
test('withAppErrorWrapping: función async que rechaza con throw → envuelve correctamente', async () => {
  // Simula una función async que internamente hace throw
  const failingAsync = async () => {
    // Cualquier operación que falle, e.g. parsing
    JSON.parse('not valid json{');
  };
  await assert.rejects(
    withAppErrorWrapping(failingAsync, 'PARSE_ERROR', 'Fallo al parsear'),
    (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.code, 'PARSE_ERROR');
      assert.ok(err.details.original_error.includes('JSON'));
      return true;
    }
  );
});

// 10. No altera el resultado exitoso (preserva tipos complejos)
test('withAppErrorWrapping: no altera el resultado exitoso (objetos, arrays, etc.)', async () => {
  // Object
  const obj = { a: 1, b: { c: 'nested' } };
  const resultObj = await withAppErrorWrapping(async () => obj, 'C', 'M');
  assert.deepEqual(resultObj, obj);
  assert.equal(resultObj, obj, 'debe ser el mismo objeto (referencia)');

  // Array
  const arr = [1, 2, [3, 4]];
  const resultArr = await withAppErrorWrapping(async () => arr, 'C', 'M');
  assert.deepEqual(resultArr, arr);

  // null
  const resultNull = await withAppErrorWrapping(async () => null, 'C', 'M');
  assert.equal(resultNull, null);

  // undefined
  const resultUndef = await withAppErrorWrapping(async () => undefined, 'C', 'M');
  assert.equal(resultUndef, undefined);

  // Buffer
  const buf = Buffer.from('hello');
  const resultBuf = await withAppErrorWrapping(async () => buf, 'C', 'M');
  assert.equal(resultBuf, buf, 'Buffer preservado por referencia');
  assert.equal(resultBuf.toString(), 'hello');
});

// ============================================================================
// Tests de withAppErrorWrappingSync (I-008.3)
// ============================================================================
// Variante síncrona del helper, para callbacks sync como la callback de
// `db.transaction(() => { ... })` en better-sqlite3 v11 (que no soporta
// callbacks que retornan Promise). Misma semántica que la versión async,
// pero pensada para envolver registerEvent() dentro de la tx de commit.
const { withAppErrorWrappingSync } = require('../../src/utils/errorWrap');

test('withAppErrorWrappingSync: error genérico → envuelve como AppError(500, code, message)', () => {
  const genericErr = new Error('Boom sync');
  let caught;
  try {
    withAppErrorWrappingSync(() => { throw genericErr; }, 'EVENT_REGISTRATION_FAILED', 'No se pudo registrar el evento');
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, 'debe lanzar');
  assert.ok(caught instanceof AppError, 'debe ser AppError');
  assert.equal(caught.statusCode, 500);
  assert.equal(caught.code, 'EVENT_REGISTRATION_FAILED');
  assert.equal(caught.message, 'No se pudo registrar el evento');
  assert.equal(caught.details.original_error, 'Boom sync');
  assert.equal(caught.details.original_code, null);
});

test('withAppErrorWrappingSync: preserva el code pasado al helper', () => {
  let caught;
  try {
    withAppErrorWrappingSync(() => { throw new Error('X'); }, 'CUSTOM_SYNC_CODE_1', 'M1');
  } catch (err) {
    caught = err;
  }
  assert.equal(caught.code, 'CUSTOM_SYNC_CODE_1');
});

test('withAppErrorWrappingSync: AppError existente se preserva sin re-envolver (mismo objeto)', () => {
  const originalAppErr = new AppError(503, 'ORIGINAL_CODE', 'Original message', { foo: 'bar' });
  let caught;
  try {
    withAppErrorWrappingSync(() => { throw originalAppErr; }, 'WRAP_CODE', 'WRAP_MESSAGE');
  } catch (err) {
    caught = err;
  }
  assert.equal(caught, originalAppErr, 'debe ser el mismo objeto (no copia)');
  assert.equal(caught.code, 'ORIGINAL_CODE', 'NO se re-envuelve: code preservado del original');
  assert.equal(caught.statusCode, 503);
  assert.deepEqual(caught.details, { foo: 'bar' }, 'details NO se modifican');
});

test('withAppErrorWrappingSync: error con .code → preserva como original_code', () => {
  const sqliteErr = new Error('UNIQUE constraint failed');
  sqliteErr.code = 'SQLITE_CONSTRAINT_UNIQUE';
  let caught;
  try {
    withAppErrorWrappingSync(() => { throw sqliteErr; }, 'EVENT_REGISTRATION_FAILED', 'M');
  } catch (err) {
    caught = err;
  }
  assert.equal(caught.details.original_code, 'SQLITE_CONSTRAINT_UNIQUE');
  assert.equal(caught.details.original_error, 'UNIQUE constraint failed');
});

test('withAppErrorWrappingSync: función sync que retorna → retorna valor tal cual', () => {
  // Caso típico: registerEvent() retorna undefined cuando OK.
  const result = withAppErrorWrappingSync(() => 'ok', 'C', 'M');
  assert.equal(result, 'ok');

  // Función que retorna un objeto (como registerEvent, que no retorna nada
  // útil pero la firma del helper lo permite).
  const obj = { a: 1 };
  const resultObj = withAppErrorWrappingSync(() => obj, 'C', 'M');
  assert.equal(resultObj, obj, 'mismo objeto por referencia');
});

test('withAppErrorWrappingSync: no altera el resultado exitoso (objetos, primitivos, undefined)', () => {
  // object
  const obj = { x: [1, 2] };
  assert.equal(withAppErrorWrappingSync(() => obj, 'C', 'M'), obj);
  // array
  const arr = [1, 2, 3];
  assert.deepEqual(withAppErrorWrappingSync(() => arr, 'C', 'M'), arr);
  // null
  assert.equal(withAppErrorWrappingSync(() => null, 'C', 'M'), null);
  // undefined
  assert.equal(withAppErrorWrappingSync(() => undefined, 'C', 'M'), undefined);
  // number
  assert.equal(withAppErrorWrappingSync(() => 42, 'C', 'M'), 42);
  // string
  assert.equal(withAppErrorWrappingSync(() => 'hello', 'C', 'M'), 'hello');
  // boolean
  assert.equal(withAppErrorWrappingSync(() => true, 'C', 'M'), true);
});
