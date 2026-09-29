// test-presupuesto-824-real.js
// 📦824 — Verificación contra el Excel REAL de Tempoactiva (G: Drive).
//
// Este test es el que habría atrapado los 3 bugs queادن fuera:
//
//   1. bulk-save ponía ejecutado=0 en cada guardado (pérdida de dato).
//      → aquí se importa de verdad, se guarda de verdad, y se comprueba que el
//        ejecutado sigue ahí.
//   2. El parser ponía descripcion='' fijo, perdiendo la categoría del Excel
//      (col B, que además viene en celdas combinadas).
//      → se comprueba que las 14 partidas tengan categoría.
//   3. El parser descartaba asignado_anual, ejecutado_acumulado y % EJE.
//      → se comprueba que se guarden.
//
//   4. La fila "TOTAL AÑO" del Excel 2026 declara 55.638.568 cuando las 14
//      partidas suman 27.819.284 (bug de fórmula en el archivo).
//      → se comprueba que el import lo DETECTE y lo REPORTE, no que lo copie.
//
// Uso:
//   npx electron main/test-presupuesto-824-real.js
// Requiere Google Drive montado en G: (el test se salta si no está).

'use strict';

const path = require('path');
const fs = require('fs');
const Module = require('module');

// 📦824 — Mismo patrón de mock de 'electron' que usan los otros tests del
// bridge (test-presupuesto-bridge-schema.js). Sin esto, `require('electron')`
// fuera de Electron devuelve la ruta del binario y no el módulo.
const _mockIpcHandlers = {};
Module._resolveFilename = (function (original) {
  return function (request, parent, ...rest) {
    if (request === 'electron') return __filename;   // este mismo archivo hace de módulo
    return original.call(this, request, parent, ...rest);
  };
})(Module._resolveFilename);
module.exports = {
  ipcMain: {
    handle: function (channel, handler) { _mockIpcHandlers[channel] = handler; }
  },
  app: { on: function () {}, getPath: function () { return __dirname; } },
  dialog: { showOpenDialog: function () { return Promise.resolve({ canceled: true }); } }
};

const DB_PATH = 'C:/Users/jrf20/AppData/Roaming/sgsst-electron-app/kair.db';
const DRIVE_DIR = 'G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/1. Recursos/1.1.3 Asignación de Recursos';
const XLSX_2026 = path.join(DRIVE_DIR, 'ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx');

let checks = [];
function ok(name, cond, extra) { checks.push({ name, ok: !!cond, extra }); }

function run() {
  if (!fs.existsSync(XLSX_2026)) {
    console.log('⏭   Saltando: no se encontró el Excel en G: (Drive no montado)');
    console.log('    Ruta esperada: ' + XLSX_2026);
    process.exit(0);
  }

  const Database = require('better-sqlite3');
  const schemaMod = require('./presupuesto-schema-sql');

  // BD en :memory: con el schema real (nunca tocamos kair.db)
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)');
  db.exec(schemaMod.PRESUPUESTO_SCHEMA_SQL);
  for (const alt of schemaMod.PRESUPUESTO_SCHEMA_ALTERS) {
    try { db.exec(alt); } catch (e) { /* ya existe */ }
  }
  for (const mig of schemaMod.PRESUPUESTO_MIGRATIONS_SQL) {
    try { db.exec(mig); } catch (e) { /* noop */ }
  }

  // Empresa ficticia (el import real exige una company registrada)
  db.prepare("INSERT INTO companies (company_key, display_name) VALUES (?, ?)").run('tempo-test', 'Tempoactiva Test');

  const bridge = require('./presupuesto-bridge');
  bridge.registerPresupuestoHandlers(null, {
    getDb: () => db,
    validateSession: (token) => {
      if (token !== 'tok') return { ok: false };
      return { ok: true, user: { id: 1 } };
    }
  });

  const call = (channel, payload) => {
    const fn = _mockIpcHandlers[channel];
    if (!fn) throw new Error('Handler no registrado: ' + channel);
    return fn(null, payload);
  };

  console.log('\n[1] dryRun — vista previa del Excel 2026');
  const dry = call('presupuesto:import-from-excel', {
    token: 'tok', filePath: XLSX_2026, companyName: 'Tempoactiva Test', anio: 2026,
    options: { dryRun: true }
  });
  ok('dryRun responde ok', dry.success === true, JSON.stringify(dry.error || {}));
  if (!dry.success) return report();

  const p = dry.data.parsed;   // los handlers envuelven en { success, data }
  ok('detecta 14 partidas', p.partidasCount === 14, 'partidas=' + p.partidasCount);
  ok('total calculado viene del Excel', p.totalAsignado > 0, 'total=' + p.totalAsignado);
  ok('trae el TOTAL declarado del Excel', p.totalDeclarado > 0, 'declarado=' + p.totalDeclarado);
  ok('trae el factor IPC', p.ipc !== null && p.ipc !== undefined, 'ipc=' + p.ipc);
  ok('AVISA que el TOTAL AÑO no cuadra con la suma', (p.avisos || []).length > 0,
    'avisos=' + (p.avisos || []).length + ' :: ' + (p.avisos || [])[0]);

  // El bug conocido del Excel 2026: declara el doble de la suma real.
  const esperadoReal = 27819284;
  ok('el total real es la suma de las 14 partidas ($27.819.284)',
    Math.abs(p.totalAsignado - esperadoReal) < 2, 'total=' + p.totalAsignado);
  ok('el Excel declara $55.638.568 (el doble, bug de fórmula)',
    Math.abs(p.totalDeclarado - 55638568) < 2, 'declarado=' + p.totalDeclarado);

  console.log('\n[2] import real en :memory:');
  const imp = call('presupuesto:import-from-excel', {
    token: 'tok', filePath: XLSX_2026, companyName: 'Tempoactiva Test', anio: 2026,
    options: { overwrite: true }
  });
  ok('import responde ok', imp.success === true, JSON.stringify(imp.error || {}));
  if (!imp.success) return report();

  ok('inserta 14 partidas', imp.data.inserted === 14, 'inserted=' + imp.data.inserted);
  ok('inserta 168 valores mensuales', imp.data.valores === 168, 'valores=' + imp.data.valores);
  ok('el import reporta los avisos del Excel', (imp.data.avisos || []).length > 0,
    'avisos=' + (imp.data.avisos || []).length);

  const pres = db.prepare("SELECT * FROM presupuestos WHERE anio = 2026").get();
  ok('guarda el archivo de origen', !!pres.archivo_origen, pres.archivo_origen);
  ok('guarda el nombre del archivo', /2026/.test(pres.archivo_nombre || ''), pres.archivo_nombre);
  ok('guarda el total declarado', Math.abs(pres.total_declarado_asignado - 55638568) < 2, String(pres.total_declarado_asignado));
  // El Excel pone 0,052 (IPC 5,2%) — no 0,05.
  ok('guarda el IPC (5,2%)', Math.abs(pres.ipc - 0.052) < 0.0001, String(pres.ipc));
  ok('guarda los avisos como JSON', typeof pres.avisos_importacion === 'string' && pres.avisos_importacion.indexOf('TOTAL') !== -1);

  const partidas = db.prepare("SELECT * FROM presupuesto_partidas ORDER BY numero").all();
  ok('las 14 partidas tienen categoría (descripcion)', partidas.every(function (x) { return !!x.descripcion && x.descripcion.length > 0; }),
    partidas.filter(function (x) { return !x.descripcion; }).length + ' sin categoría');
  ok('la primera partida es "ASESORIAS SST"', /ASESORIAS/i.test(partidas[0].descripcion || ''), partidas[0].descripcion);
  ok('la categoría se propaga por las celdas combinadas', /SISTEMA INTEGRAL/i.test(partidas[1].descripcion || ''), partidas[1].descripcion);
  ok('la última es "PAPELERIA SG-SST"', /PAPELERIA/i.test(partidas[13].descripcion || ''), partidas[13].descripcion);
  ok('el bloque del Excel se guarda aparte (numero_excel)', partidas[0].numero_excel === 1 && partidas[1].numero_excel === 2,
    'b1=' + partidas[0].numero_excel + ' b2=' + partidas[1].numero_excel);
  ok('numero sigue siendo la posición de la partida (1..14)', partidas[13].numero === 14, 'numero14=' + partidas[13].numero);

  ok('guarda asignado_anual (col D del Excel)', Math.abs(partidas[0].asignado_anual - 9314724) < 2, String(partidas[0].asignado_anual));
  ok('guarda ejecutado_acumulado (col E del Excel)', Math.abs(partidas[0].ejecutado_acumulado - 6209816) < 2, String(partidas[0].ejecutado_acumulado));
  ok('guarda porcentaje_eje (col F del Excel)', partidas[0].porcentaje_eje !== null);

  // El ejecutado mensual REAL del Excel 2026 son 19.696.874,33 (las 3 filas con
  // ejecución: Honorarios 8 meses, Diagnóstico Psicosocial abril, Exámenes
  // ene/feb/abr/jul). NO son los 33.694.321,66 de la fila TOTAL AÑO, que está mal.
  const totEjec = db.prepare("SELECT SUM(ejecutado) e FROM presupuesto_valores_mensuales").get().e;
  ok('el ejecutado mensual se importa REAL del Excel ($19.696.874,33)',
    Math.abs(totEjec - 19696874.33) < 2, 'ejecutado=' + totEjec);
  ok('el ejecutado NO es 0 (ese era el bug del bulk-save)', totEjec > 19000000);
  ok('el ejecutado acumulado de las partidas también se guarda ($19.696.874,33)',
    Math.abs(partidas.reduce(function (a, x) { return a + (x.ejecutado_acumulado || 0); }, 0) - 19696874.33) < 2);

  console.log('\n[3] bulk-save NO debe destruir el ejecutado');
  // Se re-manda lo mismo que la UI mandaría: sin ejecutado (viene de una
  // tabla read-only). Antes de 📦824 esto ponía las 168 filas en 0.
  const filas = partidas.map(function (x) {
    const meses = {};
    const nombres = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    db.prepare("SELECT mes, asignado FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes").all(x.id)
      .forEach(function (v, i) { meses[nombres[i]] = v.asignado; });
    return { id: x.numero, detalle: x.concepto, asignacion: x.asignado_anual, descripcion: x.descripcion };
  });
  const save = call('presupuesto:bulk-save', { token: 'tok', presupuestoId: pres.id, data: filas });
  ok('bulk-save responde ok', save.success === true, JSON.stringify(save.error || {}));
  ok('bulk-save reporta cuántos ejecutados salvó', save.data.ejecutadosRestaurados > 0,
    'restaurados=' + save.data.ejecutadosRestaurados);

  const totEjec2 = db.prepare("SELECT SUM(ejecutado) e FROM presupuesto_valores_mensuales").get().e;
  ok('EL EJECUTADO SIGUE VIVO tras guardar (el bug lo ponía en 0)',
    Math.abs(totEjec2 - 19696874.33) < 2, 'ejecutado=' + totEjec2);

  const p2 = db.prepare("SELECT * FROM presupuesto_partidas ORDER BY numero").all();
  ok('la categoría sobrevive al guardado', p2.every(function (x) { return !!x.descripcion; }));
  ok('el asignado_anual sobrevive al guardado', Math.abs(p2[0].asignado_anual - 9314724) < 2, String(p2[0].asignado_anual));

  console.log('\n[4] migraciones');
  ok('PRESUPUESTO_MIGRATIONS_SQL ya no está vacío',
    Array.isArray(schemaMod.PRESUPUESTO_MIGRATIONS_SQL) && schemaMod.PRESUPUESTO_MIGRATIONS_SQL.length > 0,
    'n=' + (schemaMod.PRESUPUESTO_MIGRATIONS_SQL || []).length);
  ok('hay un MIGRATION_ID por cada migración',
    Array.isArray(schemaMod.PRESUPUESTO_MIGRATION_IDS) &&
    schemaMod.PRESUPUESTO_MIGRATION_IDS.length === schemaMod.PRESUPUESTO_MIGRATIONS_SQL.length);
  ok('hay ALTER TABLE para bases existentes',
    Array.isArray(schemaMod.PRESUPUESTO_SCHEMA_ALTERS) && schemaMod.PRESUPUESTO_SCHEMA_ALTERS.length >= 10,
    'n=' + (schemaMod.PRESUPUESTO_SCHEMA_ALTERS || []).length);
  ok('el bridge exporta SCHEMA_ALTERS', Array.isArray(bridge.SCHEMA_ALTERS));

  report();
}

function report() {
  let failed = 0;
  console.log('');
  console.log('=======================================');
  checks.forEach(function (c) {
    if (!c.ok) failed++;
    const extra = (c.extra !== undefined && c.extra !== null) ? '  [' + c.extra + ']' : '';
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + extra);
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

run();
