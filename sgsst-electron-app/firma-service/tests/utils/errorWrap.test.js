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
