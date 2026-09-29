// test-presupuesto-824-export-plantilla.js
// 📦824 — Exportar usando la plantilla real del Drive en vez de generar un
// Excel pelado.
//
// Qué comprueba, contra el archivo real de Tempoactiva:
//   1. Se abre la PLANTILLA y se conserva lo que la hace presentable:
//      encabezado, código ACT-FO-043, merges de categoría, hoja con su nombre.
//   2. Se escriben los datos de la BD encima, sin romper los merges.
//   3. La ejecución mensual va en G-R (la v1 ponía el ASIGNADO ahí).
//   4. La fila TOTAL sale CORRECTA (suma real), aunque la plantilla tenga la
//      fórmula duplicada del Excel original.
//   5. Sin plantilla sigue funcionando (fallback a generar desde cero).
//   6. Duplicar período: partidas sí, ejecución en cero, IPC vacío.
//
// Uso: npx electron main/test-presupuesto-824-export-plantilla.js

'use strict';
const path = require('path');
const fs = require('fs');
const Module = require('module');

const _h = {};
Module._resolveFilename = (function (o) {
  return function (r, p, ...rest) { return r === 'electron' ? __filename : o.call(this, r, p, ...rest); };
})(Module._resolveFilename);
module.exports = {
  ipcMain: { handle: function (c, fn) { _h[c] = fn; } },
  app: { on: function () { }, getPath: function () { return __dirname; } },
  dialog: { showOpenDialog: function () { return Promise.resolve({ canceled: true }); } }
};

const PLANTILLA = 'G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/1. Recursos/1.1.3 Asignación de Recursos/ACT-FO-043 Presupuesto SG-SST 2026 Tempoactiva.xlsx';
const OUT = path.join(require('os').tmpdir(), 'presup-export-test.xlsx');

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }

async function main() {
  if (!fs.existsSync(PLANTILLA)) {
    console.log('⏭   Saltando: no se encontró la plantilla en G: (Drive no montado)');
    process.exit(0);
  }

  const Database = require('better-sqlite3');
  const XLSX = require('xlsx');
  const ExcelJS = require('exceljs');
  const schemaMod = require('./presupuesto-schema-sql');
  const bridge = require('./presupuesto-bridge');

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)');
  db.exec(schemaMod.PRESUPUESTO_SCHEMA_SQL);
  for (const a of schemaMod.PRESUPUESTO_SCHEMA_ALTERS) { try { db.exec(a); } catch (e) { } }
  db.prepare("INSERT INTO companies (company_key, display_name) VALUES (?, ?)").run('acme', 'ACME S.A.');

  bridge.registerPresupuestoHandlers(null, {
    getDb: () => db,
    validateSession: (t) => (t === 'tok' ? { ok: true, user: { id: 1 } } : { ok: false })
  });
  const call = (c, p) => _h[c](null, Object.assign({ token: 'tok' }, p));

  // ── Periodo de prueba ────────────────────────────────────────────────
  // 14 partidas, como el Excel real de Tempoactiva. Importa que sean las
  // mismas: con menos partidas, la fila TOTAL/IPC cae DENTRO de los merges de
  // categoría de la plantilla y el caso de uso real no se parece.
  const cr = call('presupuesto:create', { companyName: 'ACME S.A.', anio: 2026, nombre: 'P 2026' });
  const pid = cr.data.presupuestoId;
  const CATS = ['ASESORIAS SST', 'SISTEMA INTEGRAL', 'PAPELERIA SG-SST'];
  const filas = [];
  for (let i = 0; i < 14; i++) {
    filas.push({
      id: i + 1,
      detalle: 'Partida de prueba ' + (i + 1),
      descripcion: CATS[Math.floor(i / 6)],   // bloques de ~6, como el Excel real
      asignacion: i === 0 ? 1000000 : 25000
    });
  }
  call('presupuesto:bulk-save', { presupuestoId: pid, data: filas });
  const parts = db.prepare('SELECT id, numero FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero').all(pid);
  db.prepare('UPDATE presupuesto_valores_mensuales SET ejecutado = 100000 WHERE partida_id = ? AND mes = 1').run(parts[0].id);
  db.prepare('UPDATE presupuesto_valores_mensuales SET ejecutado = 50000 WHERE partida_id = ? AND mes = 3').run(parts[1].id);
  db.prepare('UPDATE presupuesto_partidas SET asignado_anual = 1000000, ejecutado_acumulado = 100000 WHERE id = ?').run(parts[0].id);
  call('presupuesto:update-meta', { presupuestoId: pid, ipc: 0.052 });
  const TOTAL_ESPERADO = 1000000 + 13 * 25000;   // 1.325.000

  // ── 1) Export SIN plantilla (fallback) ───────────────────────────────
  const r1 = await call('presupuesto:export-excel', { presupuestoId: pid, outputPath: OUT });
  ok('1) export sin plantilla funciona', r1.success, r1.success ? '' : JSON.stringify(r1.error));
  ok('1) el archivo existe', fs.existsSync(OUT));
  const wbSin = XLSX.readFile(OUT);
  const wsSin = wbSin.Sheets[wbSin.SheetNames[0]];
  const filasSin = XLSX.utils.sheet_to_json(wsSin, { header: 1, raw: true, defval: null });
  const totalFila = filasSin.find(r => (r && r[0]) === 'TOTAL AÑO');
  ok('1) el fallback pone el TOTAL correcto', totalFila && Math.abs(totalFila[3] - TOTAL_ESPERADO) < 1, totalFila ? totalFila[3] : 'no');
  ok('1) el fallback pone la EJECUCIÓN en la fila TOTAL ($150.000)', totalFila && Math.abs(totalFila[4] - 150000) < 1, totalFila ? totalFila[4] : 'no');
  ok('1) las columnas de mes llevan EJECUCIÓN, no asignado',
    Math.abs((totalFila[6] || 0) - 100000) < 1 && Math.abs((totalFila[8] || 0) - 50000) < 1,
    'E=' + (totalFila[6]) + ' M=' + (totalFila[8]));

  // ── 2) Export CON plantilla ──────────────────────────────────────────
  //
  // 📦824 Estructura REAL de la plantilla de Tempoactiva (leída del archivo):
  //   filas  8-9  encabezado (celdas combinadas A8:A9 … F8:F9)
  //   fila  10    los datos empiezan aquí
  //   B11:B22     un merge de categoría que cubre 12 partidas
  //   fila  24    TOTAL AÑO
  //   fila  25    IPC
  // Con 14 partidas el TOTAL cae en 10+14 = 24. Ojo: los merges del archivo
  // oficial están calibrados a SU distribución de partidas; si la BD tiene
  // otra, hay que deshacerlos y rehacerlos — si no, ExcelJS escribe dentro
  // del master y 12 filas quedan mostrando la categoría equivocada.
  const N_PART = filas.length;                 // 14
  const FILA_INI = 10;
  const FILA_TOTAL = FILA_INI + N_PART;        // 24
  const FILA_IPC = FILA_TOTAL + 1;             // 25
  const r2 = await call('presupuesto:export-excel', { presupuestoId: pid, outputPath: OUT, plantillaPath: PLANTILLA });
  ok('2) export con plantilla funciona', r2.success, r2.success ? '' : JSON.stringify(r2.error));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(OUT);
  const ws = wb.worksheets.find(s => /PRESUP/i.test(s.name)) || wb.worksheets[0];
  ok('2) conserva el nombre de la hoja del archivo oficial', /PRESUP/i.test(ws.name), ws.name);

  // Encabezado del sistema = el ACT-FO-043 y el nombre del SG-SST
  let txt = '';
  for (let r = 1; r <= 6; r++) for (let c = 1; c <= 12; c++) {
    const v = ws.getRow(r).getCell(c).value;
    if (v) txt += String(v) + ' ';
  }
  ok('2) conserva el encabezado del sistema de gestión', /Seguridad y Salud/i.test(txt), txt.slice(0, 60));
  ok('2) conserva el código ACT-FO-043', /ACT-FO-043/.test(txt));

  // Merges de categoría: reconstruidos según los bloques REALES de la BD
  // (la plantilla traía B11:B22, que no corresponde a bloques de 6).
  // Solo se miran los de las filas de DATOS; B8:B9 es el del encabezado y debe
  // seguir ahí.
  const mergesB = (ws.model.merges || [])
    .filter(m => { const x = m.match(/^B(\d+):B(\d+)$/); return x && +x[1] >= FILA_INI; })
    .sort();
  const mergesBEsperados = ['B10:B15', 'B16:B21', 'B22:B23'];
  ok('2) rehace las combinaciones de categoría según los bloques de la BD',
    JSON.stringify(mergesB) === JSON.stringify(mergesBEsperados), JSON.stringify(mergesB));
  ok('2) ya no queda el merge original B11:B22 (rompía 12 filas)',
    !mergesB.includes('B11:B22'), JSON.stringify(mergesB));
  ok('2) conserva el merge del encabezado (B8:B9)', (ws.model.merges || []).includes('B8:B9'));
  ok('2) el encabezado (A8:A9) NO se tocó', (ws.model.merges || []).includes('A8:A9'),
    JSON.stringify((ws.model.merges || []).filter(m => /^A\d/.test(m))));

  // Datos escritos encima — primera partida
  const fila10 = ws.getRow(FILA_INI);
  ok('2) escribe el concepto en la columna C', String(fila10.getCell(3).value || '').length > 0, fila10.getCell(3).value);
  ok('2) escribe el asignado anual en D', Math.abs((fila10.getCell(4).value || 0) - 1000000) < 1, fila10.getCell(4).value);
  ok('2) escribe la ejecución acumulada en E', Math.abs((fila10.getCell(5).value || 0) - 100000) < 1, fila10.getCell(5).value);
  ok('2) escribe la ejecución de ENERO en G (no el asignado)', Math.abs((fila10.getCell(7).value || 0) - 100000) < 1, fila10.getCell(7).value);

  // Categorías: leídas como las vería alguien abriendo el Excel. ExcelJS
  // devuelve en cada esclava el valor de su master, así que las 14 filas deben
  // mostrar la categoría que les toca — no la de otra fila.
  const catsLeidas = [];
  for (let i = 0; i < N_PART; i++) catsLeidas.push(ws.getRow(FILA_INI + i).getCell(2).value);
  const catsEsperadas = filas.map(f => f.descripcion);
  ok('2) cada fila muestra SU categoría (los bloques no se desalinean)',
    JSON.stringify(catsLeidas) === JSON.stringify(catsEsperadas), JSON.stringify(catsLeidas));

  // 14 filas de datos seguidas, numeradas, y la última justo antes del TOTAL
  let detalleOk = true; const detalle = [];
  for (let i = 0; i < N_PART; i++) {
    const r = ws.getRow(FILA_INI + i);
    const a = r.getCell(1).value, c = r.getCell(3).value;
    if (a !== i + 1 || String(c || '') !== 'Partida de prueba ' + (i + 1)) detalleOk = false;
    detalle.push(a + ':' + c);
  }
  ok('2) escribe las 14 partidas seguidas y numeradas', detalleOk, detalle.join(' | '));
  ok('2) la fila siguiente al último dato es el TOTAL',
    ws.getRow(FILA_TOTAL).getCell(1).value === 'TOTAL AÑO', ws.getRow(FILA_TOTAL).getCell(1).value);

  // TOTAL corregido — sale de la SUMA REAL, no de la fórmula del Excel
  const fTotal = ws.getRow(FILA_TOTAL);
  ok('2) el TOTAL sale de la SUMA REAL, no de la fórmula del Excel',
    Math.abs((fTotal.getCell(4).value || 0) - TOTAL_ESPERADO) < 1, fTotal.getCell(4).value + ' (esperado ' + TOTAL_ESPERADO + ')');
  ok('2) el TOTAL de ejecución también', Math.abs((fTotal.getCell(5).value || 0) - 150000) < 1, fTotal.getCell(5).value);
  ok('2) los meses del TOTAL llevan EJECUCIÓN ($100k enero / $50k marzo)',
    Math.abs((fTotal.getCell(7).value || 0) - 100000) < 1 && Math.abs((fTotal.getCell(9).value || 0) - 50000) < 1,
    'E=' + fTotal.getCell(7).value + ' M=' + fTotal.getCell(9).value);

  // Fila IPC: dato del período, no altera el total, y no se pierde en un merge
  const fIpc = ws.getRow(FILA_IPC);
  ok('2) la fila IPC se escribe con el valor real (5,2%)',
    String(fIpc.getCell(2).value || '') === 'IPC' && String(fIpc.getCell(3).value || '').indexOf('5,2') !== -1,
    fIpc.getCell(2).value + ' / ' + fIpc.getCell(3).value);
  ok('2) la fila IPC NO se pierde dentro de una combinación de la plantilla',
    fIpc.getCell(2).isMerged !== true, 'isMerged=' + fIpc.getCell(2).isMerged);
  ok('2) el IPC no altera el TOTAL (vive en su propia fila)',
    Math.abs((fTotal.getCell(4).value || 0) - TOTAL_ESPERADO) < 1, fTotal.getCell(4).value);

  // ── 3) Duplicar período ──────────────────────────────────────────────
  const dup = await call('presupuesto:duplicar-periodo', { presupuestoIdOrigen: pid, anioDestino: 2027 });
  ok('3) duplicar período responde ok', dup.success, dup.success ? '' : JSON.stringify(dup.error));
  if (!dup.success) {
    console.log('   → abortando la sección 3 (duplicar). Respuesta: ' + JSON.stringify(dup));
  }
  ok('3) crea el 2027 con las 14 partidas', dup.success && dup.data && dup.data.partidas === 14, dup.success ? (dup.data && dup.data.partidas) : '');
  const p27 = dup.data && dup.data.presupuestoId;
  const ej27 = db.prepare(
    'SELECT COALESCE(SUM(v.ejecutado),0) e FROM presupuesto_valores_mensuales v ' +
    'JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ?'
  ).get(p27).e;
  ok('3) el período nuevo arranca con ejecución en CERO', ej27 === 0, 'ejecutado=' + ej27);
  const ipc27 = db.prepare('SELECT ipc FROM presupuestos WHERE id = ?').get(p27).ipc;
  ok('3) NO hereda el IPC (cambia cada año, lo define el owner)', ipc27 === null, 'ipc=' + ipc27);
  const asig27 = db.prepare(
    'SELECT COALESCE(SUM(v.asignado),0) a FROM presupuesto_valores_mensuales v ' +
    'JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ?'
  ).get(p27).a;
  ok('3) conserva el asignado del período origen', Math.abs(asig27 - TOTAL_ESPERADO) < 1, 'asignado=' + asig27);
  const cat27 = db.prepare('SELECT COUNT(*) c FROM presupuesto_partidas WHERE presupuesto_id = ? AND descripcion IS NOT NULL').get(p27).c;
  ok('3) conserva las categorías', cat27 === 14, 'cat=' + cat27);

  const dupAgain = await call('presupuesto:duplicar-periodo', { presupuestoIdOrigen: pid, anioDestino: 2027 });
  ok('3) no deja pisar un período que ya existe', !dupAgain.success && dupAgain.error.code === 'ALREADY_EXISTS');

  const ipc27set = await call('presupuesto:update-meta', { presupuestoId: p27, ipc: 0.04 });
  ok('3) el IPC del 2027 se define aparte del 2026', ipc27set.success && Math.abs(ipc27set.data.presupuesto.ipc - 0.04) < 1e-9);

  try { fs.unlinkSync(OUT); } catch (e) { }
  db.close();

  let failed = 0;
  console.log('\n=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error('EXCEPCIÓN:', e && e.stack); process.exit(1); });
