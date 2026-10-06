// test-profesiograma-only-exams.js
//
// Test del fix: save con solo examenes (sin campos de cargo) no debe
// intentar UPDATE del cargo y setear nombre a NULL.

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

class MockDb {
  constructor() {
    this.cargos = [{
      id: 'cargo_1',
      nombre: 'AUXILIAR DE COCINA',
      descripcion: 'Para preparar alimentos',
      peligros_riesgos: null,
      profesiograma_id: 'prof_1',
      grupo_ocupacional_id: 'grupo_1',
      created_at: '2026-07-23',
      updated_at: '2026-07-23'
    }];
    this.cargoExamen = [];
    this.updateCalled = false;
    this.lastUpdate = null;
  }
  prepare(sql) {
    const db = this;
    return {
      run: function (...args) {
        if (sql.includes('UPDATE kp_cargo') && sql.includes('COALESCE')) {
          db.updateCalled = true;
          db.lastUpdate = { sql: sql.trim(), args: args };
          // Simular COALESCE: si el arg es null, mantener el valor actual
          const row = db.cargos.find(c => c.id === args[5]);
          if (row) {
            row.nombre = args[0] !== null && args[0] !== undefined ? args[0] : row.nombre;
            row.descripcion = args[1] !== null && args[1] !== undefined ? args[1] : row.descripcion;
            row.peligros_riesgos = args[2] !== null && args[2] !== undefined ? args[2] : row.peligros_riesgos;
            row.grupo_ocupacional_id = args[3] !== null && args[3] !== undefined ? args[3] : row.grupo_ocupacional_id;
          }
        } else if (sql.includes('DELETE FROM kp_cargo_examen')) {
          db.cargoExamen = db.cargoExamen.filter(e => e.cargo_id !== args[0]);
        } else if (sql.includes('INSERT') && sql.includes('kp_cargo_examen')) {
          db.cargoExamen.push({ id: args[0], cargo_id: args[1], tipo_examen_id: args[2], ingreso: args[3], periodico: args[4], retiro: args[5] });
        }
        return { changes: 1 };
      },
      get: function () { return null; },
      all: function () { return []; }
    };
  }
  exec() {}
}

const bridge = require('../../main/profesiograma-bridge.js');
const db = new MockDb();
bridge.registerProfesiogramaHandlers(null, {
  getDb: () => db,
  getCompanyRoot: () => null
});

async function main() {
  console.log('================================================================');
  console.log('TEST: Save solo con examenes (sin campos de cargo)');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Test 1: Save con solo examenes (caso del bug)
  console.log('▶ Test 1: Save con solo examenes (debe funcionar)');
  db.updateCalled = false;
  let r = await handlers['profesiograma:cargos:save']({}, {
    id: 'cargo_1',
    examenes: [
      { tipoExamenId: 'tipo_audiometria', ingreso: 1, periodico: 0, retiro: 0 },
      { tipoExamenId: 'tipo_optometria', ingreso: 0, periodico: 1, retiro: 0 }
    ]
  });
  if (r.success) {
    console.log('  ✅ OK — guardado sin error');
    pass++;
    if (db.cargoExamen.length === 2) {
      console.log('  ✅ 2 examenes guardados');
      pass++;
    } else {
      console.log('  ❌ FAIL — esperaba 2 examenes, hay ' + db.cargoExamen.length);
      fail++;
    }
    if (!db.updateCalled) {
      console.log('  ✅ UPDATE del cargo NO fue llamado (correcto)');
      pass++;
    } else {
      console.log('  ❌ FAIL — UPDATE fue llamado cuando no debería');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — error:', JSON.stringify(r));
    fail++;
  }

  // Test 2: Save con nombre + examenes (debe hacer UPDATE del cargo)
  console.log('\n▶ Test 2: Save con nombre + examenes (debe hacer UPDATE)');
  db.updateCalled = false;
  r = await handlers['profesiograma:cargos:save']({}, {
    id: 'cargo_1',
    nombre: 'AUXILIAR DE COCINA ACTUALIZADO',
    examenes: []
  });
  if (r.success) {
    console.log('  ✅ OK — guardado');
    pass++;
    if (db.updateCalled) {
      console.log('  ✅ UPDATE del cargo SÍ fue llamado');
      pass++;
    } else {
      console.log('  ❌ FAIL — UPDATE no fue llamado');
      fail++;
    }
    if (db.cargos[0].nombre === 'AUXILIAR DE COCINA ACTUALIZADO') {
      console.log('  ✅ Nombre actualizado correctamente');
      pass++;
    } else {
      console.log('  ❌ FAIL — nombre no se actualizó');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — error:', JSON.stringify(r));
    fail++;
  }

  // Test 3: Save con descripcion unicamente
  console.log('\n▶ Test 3: Save con solo descripcion (debe hacer UPDATE parcial)');
  db.updateCalled = false;
  r = await handlers['profesiograma:cargos:save']({}, {
    id: 'cargo_1',
    descripcion: 'Nueva descripcion'
  });
  if (r.success) {
    console.log('  ✅ OK — guardado');
    pass++;
    if (db.updateCalled) {
      console.log('  ✅ UPDATE del cargo SÍ fue llamado');
      pass++;
    } else {
      console.log('  ❌ FAIL — UPDATE no fue llamado');
      fail++;
    }
    if (db.cargos[0].descripcion === 'Nueva descripcion') {
      console.log('  ✅ Descripcion actualizada');
      pass++;
    } else {
      console.log('  ❌ FAIL — descripcion no actualizada');
      fail++;
    }
    if (db.cargos[0].nombre === 'AUXILIAR DE COCINA ACTUALIZADO') {
      console.log('  ✅ Nombre preservado (no se tocó)');
      pass++;
    } else {
      console.log('  ❌ FAIL — nombre se perdió');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — error:', JSON.stringify(r));
    fail++;
  }

  // Test 4: Save sin campos de cargo NI examenes (debe fallar)
  console.log('\n▶ Test 4: Save sin nada (debe fallar)');
  r = await handlers['profesiograma:cargos:save']({}, { id: 'cargo_1' });
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — rechazado como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
