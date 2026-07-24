// test-profesiograma-new-tipo.js
//
// Test del flujo de crear nuevo tipo de examen (columna nueva en la matriz).
// Valida que el bridge acepta el save con categoria y que el listado lo incluye.

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
      { id: 'tipo_1', nombre: 'AUDIOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 1, activo: 1, created_at: '2026-07-23', updated_at: '2026-07-23' },
      { id: 'tipo_2', nombre: 'OPTOMETRIA', categoria: 'EVALUACION_MEDICA', descripcion: null, orden: 2, activo: 1, created_at: '2026-07-23', updated_at: '2026-07-23' }
    ];
  }
  prepare(sql) {
    const db = this;
    return {
      run: function (...args) {
        if (sql.includes('INSERT INTO kp_tipo_examen')) {
          const row = { id: args[0], nombre: args[1], categoria: args[2], descripcion: args[3], orden: args[4], activo: args[5], created_at: args[6], updated_at: args[7] };
          db.tipos.push(row);
        } else if (sql.includes('UPDATE kp_tipo_examen')) {
          // Para tests no implementamos update
        }
        return { changes: 1 };
      },
      get: function () { return null; },
      all: function () {
        if (sql.match(/FROM kp_tipo_examen/)) return db.tipos.slice();
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
  console.log('TEST: Crear nuevo tipo de examen');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Test 1: Listar tipos existentes
  console.log('▶ Test 1: Listar tipos existentes');
  let r = await handlers['profesiograma:tipo-examen:list']({}, {});
  if (r.success && r.data.length === 2) {
    console.log('  ✅ OK — 2 tipos existentes');
    pass++;
  } else {
    console.log('  ❌ FAIL — respuesta:', JSON.stringify(r).substring(0, 200));
    fail++;
  }

  // Test 2: Crear nuevo tipo de examen
  console.log('\n▶ Test 2: Crear nuevo tipo de examen');
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    nombre: 'ESPIROMETRIA',
    categoria: 'PRUEBAS_COMPLEMENTARIAS',
    descripcion: 'Prueba de capacidad pulmonar',
    orden: 21
  });
  if (r.success && r.data.created) {
    console.log('  ✅ OK — creado con id:', r.data.id);
    pass++;
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 3: Listar tipos (debe haber 3)
  console.log('\n▶ Test 3: Re-listar tipos (debe haber 3)');
  r = await handlers['profesiograma:tipo-examen:list']({}, {});
  if (r.success && r.data.length === 3) {
    console.log('  ✅ OK — 3 tipos ahora');
    pass++;
    const espiro = r.data.find(t => t.nombre === 'ESPIROMETRIA');
    if (espiro && espiro.categoria === 'PRUEBAS_COMPLEMENTARIAS') {
      console.log('  ✅ ESPIROMETRIA tiene categoria correcta');
      pass++;
    } else {
      console.log('  ❌ FAIL — categoria incorrecta');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL — respuesta:', JSON.stringify(r).substring(0, 200));
    fail++;
  }

  // Test 4: Crear sin nombre (debe fallar)
  console.log('\n▶ Test 4: Crear sin nombre (debe fallar)');
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    categoria: 'LABORATORIO'
  });
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — falló como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  // Test 5: Crear sin categoria (debe fallar)
  console.log('\n▶ Test 5: Crear sin categoria (debe fallar)');
  r = await handlers['profesiograma:tipo-examen:save']({}, {
    nombre: 'TEST_SIN_CAT'
  });
  if (!r.success && r.error.code === 'VALIDATION') {
    console.log('  ✅ OK — falló como esperado');
    pass++;
  } else {
    console.log('  ❌ FAIL — debería haber fallado:', JSON.stringify(r));
    fail++;
  }

  // Test 6: Las 3 categorías válidas
  console.log('\n▶ Test 6: Crear con cada categoria válida');
  const cats = ['EVALUACION_MEDICA', 'PRUEBAS_COMPLEMENTARIAS', 'LABORATORIO'];
  for (const cat of cats) {
    r = await handlers['profesiograma:tipo-examen:save']({}, {
      nombre: 'TEST_' + cat,
      categoria: cat
    });
    if (r.success) {
      console.log('  ✅ ' + cat + ' OK');
      pass++;
    } else {
      console.log('  ❌ ' + cat + ' FAIL:', JSON.stringify(r));
      fail++;
    }
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
