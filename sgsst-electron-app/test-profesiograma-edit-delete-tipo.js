// test-profesiograma-edit-delete-tipo.js
//
// Test del flujo de edit y delete de tipos de examen.

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
    this.tipos = [
      { id: 'tipo_1', nombre: 'AUDIOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 1, activo: 1 },
      { id: 'tipo_2', nombre: 'OPTOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 2, activo: 1 },
      { id: 'tipo_3', nombre: 'ESPIROMETRIA', categoria: 'PRUEBAS_COMPLEMENTARIAS', descripcion: 'Capacidad pulmonar', orden: 5, activo: 1 }
    ];
    this.cargoExamen = [
      { id: 'ce_1', cargo_id: 'cargo_1', tipo_examen_id: 'tipo_1', ingreso: 1, periodico: 0, retiro: 0 },
      { id: 'ce_2', cargo_id: 'cargo_1', tipo_examen_id: 'tipo_2', ingreso: 1, periodico: 1, retiro: 0 },
      { id: 'ce_3', cargo_id: 'cargo_2', tipo_examen_id: 'tipo_1', ingreso: 0, periodico: 0, retiro: 1 }
    ];
  }
  prepare(sql) {
    const db = this;
    return {
      run: function (...args) {
        if (sql.includes('INSERT INTO kp_tipo_examen')) {
          const row = { id: args[0], nombre: args[1], categoria: args[2], descripcion: args[3], orden: args[4], activo: args[5] };
          db.tipos.push(row);
        } else if (sql.includes('UPDATE kp_tipo_examen')) {
          // Args: [nombre, categoria, descripcion, orden, activo, updated_at, id]
          const id = args[6];
          const row = db.tipos.find(t => t.id === id);
          if (row) { row.nombre = args[0]; row.categoria = args[1]; row.descripcion = args[2]; row.orden = args[3]; row.activo = args[4]; }
        } else if (sql.includes('DELETE FROM kp_tipo_examen')) {
          db.tipos = db.tipos.filter(t => t.id !== args[0]);
          // Cascade delete de cargo_examen
          db.cargoExamen = db.cargoExamen.filter(e => e.tipo_examen_id !== args[0]);
        } else if (sql.includes('DELETE FROM kp_cargo_examen')) {
          db.cargoExamen = db.cargoExamen.filter(e => e.cargo_id !== args[0]);
        }
        return { changes: 1 };
      },
      get: function () { return null; },
      all: function () {
        if (sql.match(/FROM kp_tipo_examen/)) return db.tipos.slice();
        if (sql.match(/FROM kp_cargo_examen/)) return db.cargoExamen.slice();
        return [];
      }
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
  console.log('TEST: Edit y Delete de tipos de examen');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Test 1: Listar tipos existentes
  console.log('▶ Test 1: Listar tipos existentes (3)');
  let r = await handlers['profesiograma:tipo-examen:list']({}, {});
  if (r.success && r.data.length === 3) {
    console.log('  ✅ OK — 3 tipos');
    pass++;
  } else {
    console.log('  ❌ FAIL');
    fail++;
  }

  // Test 2: Editar nombre de un tipo
  console.log('\n▶ Test 2: Editar tipo_1 (cambiar nombre y descripcion)');
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    id: 'tipo_1',
    nombre: 'AUDIOMETRIA TONAL',
    categoria: 'EVALUACION_MEDICA',
    descripcion: 'Audiometría tonal y vocal',
    orden: 1,
    activo: 1
  });
  if (r.success) {
    console.log('  ✅ OK — actualizado');
    pass++;
    const updated = db.tipos.find(t => t.id === 'tipo_1');
    if (updated.nombre === 'AUDIOMETRIA TONAL') {
      console.log('  ✅ Nombre actualizado correctamente');
      pass++;
    } else {
      console.log('  ❌ FAIL — nombre no se actualizó:', updated.nombre);
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 3: Eliminar un tipo SIN referencias
  console.log('\n▶ Test 3: Eliminar tipo_3 (sin cargo_examen asociados)');
  const tiposBefore = db.tipos.length;
  const cargoExamenBefore = db.cargoExamen.length;
  r = await handlers['profesiograma:tipo-examen:delete']({}, { id: 'tipo_3' });
  if (r.success) {
    console.log('  ✅ OK — eliminado');
    pass++;
    if (db.tipos.length === tiposBefore - 1) {
      console.log('  ✅ Tabla tipos tiene 1 menos');
      pass++;
    } else {
      console.log('  ❌ FAIL — tipos no decrementó');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 4: Eliminar un tipo CON referencias (cascade)
  console.log('\n▶ Test 4: Eliminar tipo_1 (CON cargo_examen asociados)');
  r = await handlers['profesiograma:tipo-examen:delete']({}, { id: 'tipo_1' });
  if (r.success) {
    console.log('  ✅ OK — eliminado con CASCADE');
    pass++;
    const refs = db.cargoExamen.filter(e => e.tipo_examen_id === 'tipo_1');
    if (refs.length === 0) {
      console.log('  ✅ cargo_examen asociados también eliminados (CASCADE)');
      pass++;
    } else {
      console.log('  ❌ FAIL — quedan refs:', refs.length);
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 5: Eliminar tipo inexistente
  console.log('\n▶ Test 5: Eliminar tipo inexistente (no debe fallar)');
  r = await handlers['profesiograma:tipo-examen:delete']({}, { id: 'tipo_inexistente' });
  if (r.success) {
    console.log('  ✅ OK — no falla con id inexistente');
    pass++;
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 6: Eliminar sin id
  console.log('\n▶ Test 6: Eliminar sin id (debe fallar)');
  r = await handlers['profesiograma:tipo-examen:delete']({}, {});
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — rechazado como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  // Test 7: Editar sin id (debe crear uno nuevo)
  console.log('\n▶ Test 7: Save sin id (crea nuevo)');
  const tiposBefore7 = db.tipos.length;
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    nombre: 'HEMOGRAMA',
    categoria: 'LABORATORIO',
    descripcion: 'Conteo sanguineo completo',
    orden: 30
  });
  if (r.success && r.data.created) {
    console.log('  ✅ OK — creado nuevo');
    pass++;
    if (db.tipos.length === tiposBefore7 + 1) {
      console.log('  ✅ Tabla tiene 1 tipo más');
      pass++;
    } else {
      console.log('  ❌ FAIL — tabla no creció');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 8: Edit sin nombre (debe fallar)
  console.log('\n▶ Test 8: Edit sin nombre (debe fallar)');
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    id: 'tipo_2',
    categoria: 'EVALUACION_MEDICA'
  });
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
