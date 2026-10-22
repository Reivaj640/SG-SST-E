// =====================================================================
// 📦927 (2026-10-21) — Tests del bridge local empresa-datos-firma:*
//
// Ejecutar: node --test main/test-empresa-datos-firma.js
//
// NO arranca Electron: mockea ipcMain y usa una base en memoria con la
// misma forma de las consultas que ejecuta el bridge.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  registerEmpresaDatosFirmaHandlers,
  init,
  register
} = require('./empresa-datos-firma-bridge');

// ---------------------------------------------------------------------
// Base en memoria: interpreta las 4 consultas que usa el bridge.
// ---------------------------------------------------------------------
function createFakeDb() {
  const rows = [];
  let nextId = 1;

  return {
    rows,
    prepare(sql) {
      const normal = sql.replace(/\s+/g, ' ').trim();

      return {
        get() {
          const args = Array.prototype.slice.call(arguments);
          if (/^SELECT \* FROM empresa_datos_firma WHERE empresa_id = \?/i.test(normal)) {
            return rows.find(function (r) { return r.empresa_id === args[0]; });
          }
          if (/^SELECT id, declarado_en FROM empresa_datos_firma WHERE empresa_id = \?/i.test(normal)) {
            const r = rows.find(function (x) { return x.empresa_id === args[0]; });
            return r ? { id: r.id, declarado_en: r.declarado_en } : undefined;
          }
          throw new Error('SQL get no soportada: ' + normal);
        },

        run() {
          const args = Array.prototype.slice.call(arguments);

          if (/^UPDATE empresa_datos_firma SET /i.test(normal)) {
            const id = args[args.length - 1];
            const r = rows.find(function (x) { return x.id === id; });
            if (!r) return { changes: 0 };
            r.nit = args[0];
            r.domicilio = args[1];
            r.domicilio_municipio = args[2];
            r.domicilio_departamento = args[3];
            r.responsable_nombre = args[4];
            r.responsable_cargo = args[5];
            r.responsable_correo = args[6];
            r.canal_contacto = args[7];
            r.canal_pqrs = args[8];
            r.canal_incidentes = args[9];
            r.politica_datos_url = args[10];
            r.actualizado_en = args[11];
            return { changes: 1 };
          }

          if (/^INSERT INTO empresa_datos_firma /i.test(normal)) {
            const row = {
              id: nextId++,
              empresa_id: args[0],
              nit: args[1],
              domicilio: args[2],
              domicilio_municipio: args[3],
              domicilio_departamento: args[4],
              responsable_nombre: args[5],
              responsable_cargo: args[6],
              responsable_correo: args[7],
              canal_contacto: args[8],
              canal_pqrs: args[9],
              canal_incidentes: args[10],
              politica_datos_url: args[11],
              declarado_en: args[12],
              actualizado_en: args[13]
            };
            rows.push(row);
            return { lastInsertRowid: row.id };
          }

          throw new Error('SQL run no soportada: ' + normal);
        }
      };
    }
  };
}

// ---------------------------------------------------------------------
// Arnés
// ---------------------------------------------------------------------
let _handlers = {};
let _db = null;
let _validateSession = null;

const _ipcMain = {
  handle(channel, handler) {
    _handlers[channel] = handler;
  }
};

function setup(opts) {
  opts = opts || {};
  _handlers = {};
  _db = opts.db === undefined ? createFakeDb() : opts.db;
  _validateSession = opts.validateSession || null;
  init(_ipcMain);
  register({}, {
    getDb: function () { return _db; },
    validateSession: _validateSession
  });
}

async function call(channel, args) {
  const h = _handlers[channel];
  if (!h) throw new Error('handler no registrado: ' + channel);
  return await h({}, args);
}

const DATOS = {
  empresaId: 'Aseplus',
  nit: '900123456',
  domicilio: '  Calle 1 # 2-3  ',
  domicilioMunicipio: 'Soledad',
  domicilioDepartamento: 'Atlántico',
  responsableNombre: 'ANA PEREZ',
  responsableCargo: 'Representante Legal',
  responsableCorreo: 'ana@example.test',
  canalContacto: 'contacto@example.test',
  canalPqrs: 'pqrs@example.test',
  canalIncidentes: 'seguridad@example.test',
  politicaDatosUrl: 'https://example.test/privacidad'
};

// ---------------------------------------------------------------------
// Contrato del módulo
// ---------------------------------------------------------------------
test('exporta la función registradora con .init y alias retrocompatibles', function () {
  assert.equal(typeof registerEmpresaDatosFirmaHandlers, 'function');
  assert.equal(typeof registerEmpresaDatosFirmaHandlers.init, 'function');
  assert.equal(registerEmpresaDatosFirmaHandlers.register, registerEmpresaDatosFirmaHandlers);
  assert.equal(init, registerEmpresaDatosFirmaHandlers.init);
  assert.equal(register, registerEmpresaDatosFirmaHandlers);
});

test('init rechaza ipcMain inválido', function () {
  assert.throws(function () { init(null); }, /ipcMain es requerido/);
});

test('register exige deps.getDb', function () {
  init(_ipcMain);
  assert.throws(function () {
    register({}, {});
  }, /deps.getDb es requerido/);
});

test('registra los 2 canales esperados', function () {
  setup();
  assert.deepEqual(Object.keys(_handlers).sort(), [
    'empresa-datos-firma:get',
    'empresa-datos-firma:upsert'
  ]);
});

// ---------------------------------------------------------------------
// Auth soft
// ---------------------------------------------------------------------
test('soft auth: funciona sin token aunque validateSession exista', async function () {
  let called = 0;
  setup({
    validateSession: function (token) {
      called++;
      assert.equal(token, 'token-valido');
      return { ok: true, user: { id: 1 } };
    }
  });
  const r = await call('empresa-datos-firma:get', { empresaId: 'Aseplus' });
  assert.equal(r.success, true);
  assert.equal(called, 0, 'sin token no se llama validateSession');
});

test('soft auth: token con validateSession {ok:true} pasa', async function () {
  setup({
    validateSession: function () { return { ok: true, user: { id: 1 } }; }
  });
  const r = await call('empresa-datos-firma:get', { token: 'tok', empresaId: 'Aseplus' });
  assert.equal(r.success, true);
});

test('soft auth: validateSession con forma vieja {valid:true} NO bloquea el guardado local', async function () {
  setup({
    validateSession: function () { return { valid: true, user: { id: 1 } }; }
  });
  const r = await call('empresa-datos-firma:upsert', { token: 'tok', data: DATOS });
  assert.equal(r.success, true, 'la forma {valid:true} no debe usarse como única condición');
  assert.equal(_db.rows.length, 1);
});

test('soft auth: token inválido se registra pero no bloquea el guardado local', async function () {
  const originalWarn = console.warn;
  let warnings = 0;
  console.warn = function () { warnings++; };
  try {
    setup({
      validateSession: function () { return { ok: false, error: 'INVALID_TOKEN' }; }
    });
    const r = await call('empresa-datos-firma:upsert', { token: 'malo', data: DATOS });
    assert.equal(r.success, true);
    assert.ok(warnings >= 1, 'debe dejar rastro del token inválido');
  } finally {
    console.warn = originalWarn;
  }
});

test('soft auth: validateSession que lanza no rompe el guardado local', async function () {
  const originalWarn = console.warn;
  console.warn = function () {};
  try {
    setup({
      validateSession: function () { throw new Error('sesión rota'); }
    });
    const r = await call('empresa-datos-firma:upsert', { token: 'tok', data: DATOS });
    assert.equal(r.success, true);
  } finally {
    console.warn = originalWarn;
  }
});

// ---------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------
test('get: sin fila devuelve datos:null (no inventa identificación)', async function () {
  setup();
  const r = await call('empresa-datos-firma:get', { empresaId: 'Aseplus' });
  assert.equal(r.success, true);
  assert.equal(r.data.datos, null);
});

test('get: exige empresaId', async function () {
  setup();
  const r = await call('empresa-datos-firma:get', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_INPUT');
});

test('get: sin base devuelve NO_DB', async function () {
  setup({ db: null });
  const r = await call('empresa-datos-firma:get', { empresaId: 'Aseplus' });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'NO_DB');
});

// ---------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------
test('upsert: inserta, recorta espacios y convierte vacíos en null', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, {
      nit: '  900123456  ',
      responsableCargo: '',
      canalIncidentes: '   '
    })
  });
  assert.equal(r.success, true);
  assert.equal(r.data.updated, false);
  assert.equal(typeof r.data.id, 'number');
  assert.equal(_db.rows.length, 1);
  assert.equal(_db.rows[0].empresa_id, 'Aseplus');
  assert.equal(_db.rows[0].nit, '900123456');
  assert.equal(_db.rows[0].domicilio, 'Calle 1 # 2-3');
  assert.equal(_db.rows[0].responsable_cargo, null);
  assert.equal(_db.rows[0].canal_incidentes, null);
  assert.ok(_db.rows[0].declarado_en);
  assert.ok(_db.rows[0].actualizado_en);
});

test('upsert: la segunda vez actualiza la MISMA fila y conserva declarado_en', async function () {
  setup();
  const first = await call('empresa-datos-firma:upsert', { data: DATOS });
  assert.equal(first.success, true);
  const declarado = _db.rows[0].declarado_en;

  const segunda = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, {
      responsableNombre: 'CARLOS RUIZ',
      responsableCorreo: 'carlos@example.test'
    })
  });
  assert.equal(segunda.success, true);
  assert.equal(segunda.data.updated, true);
  assert.equal(segunda.data.id, first.data.id);
  assert.equal(_db.rows.length, 1);
  assert.equal(_db.rows[0].responsable_nombre, 'CARLOS RUIZ');
  assert.equal(_db.rows[0].declarado_en, declarado);
});

test('upsert: get devuelve el mapeo camelCase exacto', async function () {
  setup();
  await call('empresa-datos-firma:upsert', { data: DATOS });
  const r = await call('empresa-datos-firma:get', { empresaId: 'Aseplus' });
  assert.equal(r.success, true);
  assert.deepEqual(r.data.datos, {
    empresaId: 'Aseplus',
    nit: '900123456',
    domicilio: 'Calle 1 # 2-3',
    domicilioMunicipio: 'Soledad',
    domicilioDepartamento: 'Atlántico',
    responsableNombre: 'ANA PEREZ',
    responsableCargo: 'Representante Legal',
    responsableCorreo: 'ana@example.test',
    canalContacto: 'contacto@example.test',
    canalPqrs: 'pqrs@example.test',
    canalIncidentes: 'seguridad@example.test',
    politicaDatosUrl: 'https://example.test/privacidad',
    declaradoEn: _db.rows[0].declarado_en,
    actualizadoEn: _db.rows[0].actualizado_en
  });
});

test('upsert: sin empresaId devuelve INVALID_INPUT sin tocar la base', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', { data: { nit: '900123456' } });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_INPUT');
  assert.equal(_db.rows.length, 0);
});

test('upsert: sin data devuelve INVALID_INPUT', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {});
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_INPUT');
});

test('upsert: correo del responsable inválido no escribe', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, { responsableCorreo: 'sin-arroba' })
  });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INVALID_INPUT');
  assert.match(r.error.message, /correo del responsable/i);
  assert.equal(_db.rows.length, 0);
});

test('upsert: canal de contacto inválido no escribe', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, { canalContacto: 'sin-arroba' })
  });
  assert.equal(r.success, false);
  assert.match(r.error.message, /canal de contacto/i);
  assert.equal(_db.rows.length, 0);
});

test('upsert: URL de política inválida no escribe (rechaza javascript: y data:)', async function () {
  setup();
  for (const url of ['javascript:alert(1)', 'data:text/html,hola', 'ftp://example.test/x']) {
    const r = await call('empresa-datos-firma:upsert', {
      data: Object.assign({}, DATOS, { politicaDatosUrl: url })
    });
    assert.equal(r.success, false, url);
    assert.match(r.error.message, /http:\/\/ o https:\/\//i);
  }
  assert.equal(_db.rows.length, 0);
});

test('upsert: campo que excede el máximo no escribe', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, { nit: 'X'.repeat(65) })
  });
  assert.equal(r.success, false);
  assert.match(r.error.message, /nit excede 64/);
  assert.equal(_db.rows.length, 0);
});

test('upsert: un campo no textual no escribe', async function () {
  setup();
  const r = await call('empresa-datos-firma:upsert', {
    data: Object.assign({}, DATOS, { nit: 123456 })
  });
  assert.equal(r.success, false);
  assert.match(r.error.message, /nit debe ser texto/);
});

test('upsert: sin base devuelve NO_DB', async function () {
  setup({ db: null });
  const r = await call('empresa-datos-firma:upsert', { data: DATOS });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'NO_DB');
});

test('upsert: un error de SQL se reporta como INTERNAL, no como éxito', async function () {
  setup({
    db: {
      prepare: function () {
        throw new Error('disco lleno');
      }
    }
  });
  const r = await call('empresa-datos-firma:upsert', { data: DATOS });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INTERNAL');
  assert.match(r.error.message, /disco lleno/);
});

test('get: un error de SQL se reporta como INTERNAL', async function () {
  setup({
    db: {
      prepare: function () {
        throw new Error('tabla ausente');
      }
    }
  });
  const r = await call('empresa-datos-firma:get', { empresaId: 'Aseplus' });
  assert.equal(r.success, false);
  assert.equal(r.error.code, 'INTERNAL');
  assert.match(r.error.message, /tabla ausente/);
});
