// test-profesiograma-edit.js
//
// Test específico del fix de validación de _handlerSaveCargo:
// - UPDATE sin profesiogramaId debe funcionar (el cargo ya está en la DB)
// - INSERT sin profesiogramaId debe fallar
// - INSERT con profesiogramaId debe funcionar

'use strict';

const Module = require('module');
const orig = Module.prototype.require;
const handlers = {};
Module.prototype.require = function(name) {
  if (name === 'electron') {
    return {
      ipcMain: { handle: (ch, fn) => { handlers[ch] = fn; } },
      dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }
    };
  }
  return orig.apply(this, arguments);
};

// Mock que actúa como SQLite mínimo
class MockDb {
  constructor() {
    this.cargos = [];
  }
  prepare(sql) {
    const db = this;
    return {
      run: function (...args) {
        if (sql.includes('INSERT INTO kp_cargo')) {
          const row = { id: args[0], nombre: args[1], descripcion: args[2], peligros_riesgos: args[3], grupo_ocupacional_id: args[4], profesiograma_id: args[5], created_at: args[6], updated_at: args[7] };
          db.cargos.push(row);
        } else if (sql.includes('UPDATE kp_cargo')) {
          const row = db.cargos.find(c => c.id === args[5]);
          if (row) {
            row.nombre = args[0]; row.descripcion = args[1]; row.peligros_riesgos = args[2]; row.grupo_ocupacional_id = args[3]; row.updated_at = args[4];
          }
        }
        return { changes: 1 };
      },
      get: function (...args) { return db.cargos.find(c => c.id === args[0]) || null; },
      all: function () { return db.cargos.slice(); }
    };
  }
  exec() {}
}

const bridge = require('./main/profesiograma-bridge.js');
const db = new MockDb();
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

async function main() {
  console.log('================================================================');
  console.log('TEST: Fix de validación _handlerSaveCargo');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Test 1: INSERT sin profesiogramaId debe FALLAR
  console.log('▶ Test 1: INSERT sin profesiogramaId (debe fallar)');
  let r = await handlers['profesiograma:cargos:save']({}, { nombre: 'TEST_SIN_PROF' });
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — falló como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado, pero:', JSON.stringify(r));
    fail++;
  }

  // Test 2: INSERT con profesiogramaId debe PASAR
  console.log('\n▶ Test 2: INSERT con profesiogramaId (debe pasar)');
  r = await handlers['profesiograma:cargos:save']({}, {
    nombre: 'TEST_CON_PROF',
    descripcion: 'Test',
    profesiogramaId: 'prof_test_123'
  });
  if (r.success && r.data.created) {
    console.log('  ✅ OK — creado con id:', r.data.id);
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber pasado:', JSON.stringify(r));
    fail++;
  }

  // Test 3: UPDATE sin profesiogramaId debe PASAR (no es requerido en updates)
  console.log('\n▶ Test 3: UPDATE sin profesiogramaId (debe pasar)');
  const existingId = db.cargos[0].id;
  r = await handlers['profesiograma:cargos:save']({}, {
    id: existingId,
    nombre: 'TEST_ACTUALIZADO'
  });
  if (r.success && !r.data.created) {
    console.log('  ✅ OK — actualizado, created=false');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber pasado:', JSON.stringify(r));
    fail++;
  }

  // Test 4: Sin nombre debe FALLAR
  console.log('\n▶ Test 4: Sin nombre (debe fallar)');
  r = await handlers['profesiograma:cargos:save']({}, { profesiogramaId: 'prof_test' });
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — falló como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  // Test 5: UPDATE con id inválido no debe crashear
  console.log('\n▶ Test 5: UPDATE con id inexistente (no debe crashear)');
  r = await handlers['profesiograma:cargos:save']({}, {
    id: 'no_existe',
    nombre: 'TEST_NO_ENCONTRADO'
  });
  if (r.success) {
    console.log('  ✅ OK — no crasheó (SQLite UPDATE simplemente no afecta ninguna fila)');
    pass++;
  } else {
    console.log('  ❌ FAIL — error inesperado:', JSON.stringify(r));
    fail++;
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
