// test-profesiograma-ipr.js
//
// Test del flujo de toggle de I/P/R en la matriz y save via cargos:save con payload.examenes.
// Valida que el bridge procesa correctamente el array de examenes.

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

// Mock de DB con tracking de cargo_examen
class MockDb {
  constructor() {
    this.cargos = [];
    this.cargoExamen = []; // {id, cargo_id, tipo_examen_id, ingreso, periodico, retiro}
  }
  prepare(sql) {
    const db = this;
    return {
      run: function (...args) {
        if (sql.includes('INSERT INTO kp_cargo ')) {
          const row = { id: args[0], nombre: args[1], descripcion: args[2], peligros_riesgos: args[3], grupo_ocupacional_id: args[4], profesiograma_id: args[5] };
          db.cargos.push(row);
        } else if (sql.includes('UPDATE kp_cargo')) {
          const row = db.cargos.find(c => c.id === args[5]);
          if (row) { row.nombre = args[0]; row.descripcion = args[1]; row.peligros_riesgos = args[2]; row.grupo_ocupacional_id = args[3]; }
        } else if (sql.includes('DELETE FROM kp_cargo_examen')) {
          db.cargoExamen = db.cargoExamen.filter(e => e.cargo_id !== args[0]);
        } else if (sql.includes('INSERT OR IGNORE INTO kp_cargo_examen') || sql.includes('INSERT INTO kp_cargo_examen')) {
          db.cargoExamen.push({ id: args[0], cargo_id: args[1], tipo_examen_id: args[2], ingreso: args[3], periodico: args[4], retiro: args[5] });
        }
        return { changes: 1 };
      },
      get: function (...args) { return db.cargos.find(c => c.id === args[0]) || null; },
      all: function () { return db.cargos.slice(); }
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
  console.log('TEST: Flujo de toggle I/P/R + save con payload.examenes');
  console.log('================================================================\n');

  let pass = 0, fail = 0;

  // Setup: crear un cargo
  console.log('▶ Setup: crear cargo inicial');
  let r = await handlers['profesiograma:cargos:save']({}, {
    nombre: 'AUXILIAR DE COCINA',
    descripcion: 'Para preparar alimentos',
    profesiogramaId: 'prof_1'
  });
  if (r.success) {
    console.log('  ✅ Cargo creado con id:', r.data.id);
    pass++;
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    process.exit(1);
  }
  const cargoId = r.data.id;

  // Test 1: Save con array de examenes (3 examenes)
  console.log('\n▶ Test 1: Save con 3 examenes (I, P, R)');
  r = await handlers['profesiograma:cargos:save']({}, {
    id: cargoId,
    examenes: [
      { tipoExamenId: 'tipo_audiometria', ingreso: 1, periodico: 1, retiro: 0 },
      { tipoExamenId: 'tipo_optometria', ingreso: 1, periodico: 0, retiro: 0 },
      { tipoExamenId: 'tipo_visiometria', ingreso: 0, periodico: 1, retiro: 1 }
    ]
  });
  if (r.success) {
    console.log('  ✅ Save OK');
    pass++;
    if (db.cargoExamen.length === 3) {
      console.log('  ✅ cargoExamen tiene 3 filas');
      pass++;
    } else {
      console.log('  ❌ FAIL — cargoExamen tiene', db.cargoExamen.length, 'filas (esperaba 3)');
      fail++;
    }
  } else {
    console.log('  ❌ FAIL:', JSON.stringify(r));
    fail++;
  }

  // Test 2: Save con nuevo array de examenes debe REEMPLAZAR los anteriores
  console.log('\n▶ Test 2: Save con nuevo array (debe reemplazar)');
  r = await handlers['profesiograma:cargos:save']({}, {
    id: cargoId,
    examenes: [
      { tipoExamenId: 'tipo_audiometria', ingreso: 0, periodico: 0, retiro: 0 },
      { tipoExamenId: 'tipo_optometria', ingreso: 0, periodico: 0, retiro: 0 }
    ]
  });
  if (r.success && db.cargoExamen.length === 2) {
    console.log('  ✅ OK — reemplazado, ahora hay 2 examenes');
    pass++;
  } else {
    console.log('  ❌ FAIL — save success=' + r.success + ', cargoExamen.length=' + db.cargoExamen.length);
    fail++;
  }

  // Test 3: Save con array vacío debe ELIMINAR todos los examenes
  console.log('\n▶ Test 3: Save con array vacío (debe eliminar todos)');
  r = await handlers['profesiograma:cargos:save']({}, {
    id: cargoId,
    examenes: []
  });
  if (r.success && db.cargoExamen.length === 0) {
    console.log('  ✅ OK — eliminados, cargoExamen.length=0');
    pass++;
  } else {
    console.log('  ❌ FAIL — save success=' + r.success + ', cargoExamen.length=' + db.cargoExamen.length);
    fail++;
  }

  // Test 4: Save sin array de examenes no debe tocarlos
  console.log('\n▶ Test 4: Save sin array de examenes (no debe tocarlos)');
  await handlers['profesiograma:cargos:save']({}, {
    id: cargoId,
    examenes: [{ tipoExamenId: 'tipo_1', ingreso: 1, periodico: 1, retiro: 1 }]
  });
  r = await handlers['profesiograma:cargos:save']({}, {
    id: cargoId,
    nombre: 'AUXILIAR DE COCINA (v2)' // solo nombre
  });
  if (r.success && db.cargoExamen.length === 1) {
    console.log('  ✅ OK — examenes no se tocaron (sigue habiendo 1)');
    pass++;
  } else {
    console.log('  ❌ FAIL — cargoExamen.length=' + db.cargoExamen.length);
    fail++;
  }

  // Test 5: Simulamos el flujo del viewer — toggle multiple + save
  console.log('\n▶ Test 5: Flujo completo del viewer (5 toggles + save)');
  // Setup: cargo con 2 examenes originales
  await handlers['profesiograma:cargos:save']({}, { id: cargoId, examenes: [] });
  const originalExams = [
    { tipoExamenId: 'tipo_audiometria', ingreso: 1, periodico: 0, retiro: 0 },
    { tipoExamenId: 'tipo_optometria', ingreso: 0, periodico: 1, retiro: 0 }
  ];
  await handlers['profesiograma:cargos:save']({}, { id: cargoId, examenes: originalExams });
  console.log('  Setup: cargo con 2 examenes iniciales');

  // Simular 5 toggles en el viewer (3 marcas, 2 desmarcas)
  const toggles = [
    { cargoId, tipoId: 'tipo_audiometria', field: 'P' }, // marcar periodico
    { cargoId, tipoId: 'tipo_audiometria', field: 'R' }, // marcar retiro
    { cargoId, tipoId: 'tipo_optometria', field: 'I' }, // marcar ingreso
    { cargoId, tipoId: 'tipo_optometria', field: 'P' }, // desmarcar periodico
    { cargoId, tipoId: 'tipo_visiometria', field: 'I' }  // marcar nuevo examen
  ];

  // Replicar la lógica de toggleIpr + saveExams
  const pending = new Map();
  for (const t of toggles) {
    const key = t.cargoId + '|' + t.tipoId;
    let p = pending.get(key);
    if (!p) {
      const orig = db.cargoExamen.find(e => e.tipo_examen_id === t.tipoId) || { ingreso: 0, periodico: 0, retiro: 0 };
      p = { ingreso: !!orig.ingreso, periodico: !!orig.periodico, retiro: !!orig.retiro };
    }
    if (t.field === 'I') p.ingreso = !p.ingreso;
    if (t.field === 'P') p.periodico = !p.periodico;
    if (t.field === 'R') p.retiro = !p.retiro;
    pending.set(key, p);
  }

  // Construir payload como saveExams
  const examenesPayload = [];
  pending.forEach((p, key) => {
    const tipoId = key.split('|')[1];
    examenesPayload.push({ tipoExamenId: tipoId, ingreso: p.ingreso ? 1 : 0, periodico: p.periodico ? 1 : 0, retiro: p.retiro ? 1 : 0 });
  });

  r = await handlers['profesiograma:cargos:save']({}, { id: cargoId, examenes: examenesPayload });
  if (r.success && db.cargoExamen.length === 3) {
    // Verificar los valores finales
    const audio = db.cargoExamen.find(e => e.tipo_examen_id === 'tipo_audiometria');
    const opto = db.cargoExamen.find(e => e.tipo_examen_id === 'tipo_optometria');
    const visio = db.cargoExamen.find(e => e.tipo_examen_id === 'tipo_visiometria');
    if (audio && audio.ingreso === 1 && audio.periodico === 1 && audio.retiro === 1) pass++;
    else { console.log('  ❌ audiometria mal:', audio); fail++; }
    if (opto && opto.ingreso === 1 && opto.periodico === 0 && opto.retiro === 0) pass++;
    else { console.log('  ❌ optometria mal:', opto); fail++; }
    if (visio && visio.ingreso === 1 && visio.periodico === 0 && visio.retiro === 0) pass++;
    else { console.log('  ❌ visiometria mal:', visio); fail++; }
    console.log('  ✅ Flujo completo OK — 3 examenes con valores correctos');
    pass++;
  } else {
    console.log('  ❌ FAIL — cargoExamen tiene', db.cargoExamen.length, 'filas');
    fail++;
  }

  console.log('\n================================================================');
  console.log('RESUMEN: ' + pass + ' OK, ' + fail + ' FAIL');
  console.log('================================================================');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
