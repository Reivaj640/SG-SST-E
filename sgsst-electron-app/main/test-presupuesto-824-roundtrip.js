// test-presupuesto-824-roundtrip.js
// 📦824 — Un GUARDADO desde la grilla no puede perder lo que el import puso.
//
// Qué pasó en producción: el 2026 de Tempoactiva quedó con 0 de 14 categorías,
// los agregados en NULL y asignado = 9.366.043 en vez de 27.819.284, después de
// que el usuario editara el período. La causa: `bulk-save` borra TODAS las
// partidas y las reinserta con lo que llega de la grilla, pero la grilla no
// viaja la categoría (col B del Excel) ni el número de bloque; y la "preservación"
// consultaba la tabla ya vacía, así que nunca encontraba nada.
//
// Este test hace el viaje completo: importa el Excel real de Drive, guarda
// como lo haría el usuario al tocar una celda, y exige que NO se pierda nada.
// Es el escenario que ningún otro test cubría: los demás importaban y ya.
//
// Uso: npx electron main/test-presupuesto-824-roundtrip.js

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

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }

async function main() {
  if (!fs.existsSync(PLANTILLA)) {
    console.log('⏭   Saltando: no se encontró el Excel en G: (Drive no montado)');
    process.exit(0);
  }

  const Database = require('better-sqlite3');
  const schemaMod = require('./presupuesto-schema-sql');
  const bridge = require('./presupuesto-bridge');

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL)');
  db.exec(schemaMod.PRESUPUESTO_SCHEMA_SQL);
  for (const a of schemaMod.PRESUPUESTO_SCHEMA_ALTERS) { try { db.exec(a); } catch (e) { } }
  db.prepare('INSERT INTO companies (company_key, display_name) VALUES (?, ?)').run('acme', 'ACME S.A.');

  bridge.registerPresupuestoHandlers(null, {
    getDb: () => db,
    validateSession: () => ({ ok: true, user: { id: 1 } })
  });
  const call = (c, p) => _h[c](null, Object.assign({ token: 'tok' }, p));

  // ── 1) Importar el Excel real ───────────────────────────────────────
  const imp = await call('presupuesto:import-from-excel', {
    companyName: 'ACME S.A.', anio: 2026, filePath: PLANTILLA, dryRun: false
  });
  ok('1) el import del Excel real funciona', imp.success, imp.success ? '' : JSON.stringify(imp.error));
  if (!imp.success) { imprimir(); return; }
  const pid = imp.data.presupuestoId;

  const leer = () => db.prepare(
    'SELECT id, numero, concepto, descripcion, activo, asignado_anual, ejecutado_acumulado, porcentaje_eje, numero_excel ' +
    'FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero'
  ).all(pid);
  const totales = () => db.prepare(
    'SELECT COALESCE(SUM(v.asignado),0) a, COALESCE(SUM(v.ejecutado),0) e ' +
    'FROM presupuesto_valores_mensuales v JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ?'
  ).get(pid);

  const antes = leer();
  const totAntes = totales();
  const catsAntes = antes.filter(p => p.descripcion && p.descripcion.trim() !== '').length;
  const exAntes = antes.filter(p => p.numero_excel !== null && p.numero_excel !== undefined).length;
  const conAsig = antes.filter(p => p.asignado_anual !== null && p.asignado_anual > 0).length;
  const conEje = antes.filter(p => p.ejecutado_acumulado !== null && p.ejecutado_acumulado > 0).length;

  ok('1) el import trae 14 partidas', antes.length === 14, antes.length);
  ok('1) el import trae las 14 categorías', catsAntes === 14, catsAntes + '/14');
  ok('1) el asignado total cuadra (~27.8M)', Math.abs(totAntes.a - 27819284) < 2, Math.round(totAntes.a));
  ok('1) el ejecutado total cuadra (~19.7M)', Math.abs(totAntes.e - 19696874) < 2, Math.round(totAntes.e));

  // ── 2) Guardar como lo haría el usuario al editar UNA celda ─────────
  //
  // Este es el payload REAL de la grilla (ver `_bdPartidasToExcelShape`):
  //   - `asignacion` = la columna D del ACT-FO-043 (anual).
  //   - `enero..diciembre` = las columnas G-R, que el formato titula
  //     "EJECUCION PRESUPUESTAL": el dinero gastado cada mes.
  // NO viaja la categoría, el número_excel ni los agregados — la grilla no los
  // conoce, y el handler tiene que conservarlos.
  const COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const payload = antes.map(p => {
    const v = db.prepare('SELECT mes, ejecutado FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes').all(p.id);
    const fila = { id: p.numero, detalle: p.concepto, asignacion: p.asignado_anual || 0 };
    COLUMN_MESES.forEach((m, i) => { fila[m] = v[i] ? v[i].ejecutado : 0; });
    return fila;
  });
  // El usuario registra $1.000 más de ejecución en enero de la primera partida.
  payload[0].enero = (payload[0].enero || 0) + 1000;

  const save = await call('presupuesto:bulk-save', { presupuestoId: pid, data: payload });
  ok('2) el guardado desde la grilla funciona', save.success, save.success ? '' : JSON.stringify(save.error));

  const despues = leer();
  const totDespues = totales();
  const catsDespues = despues.filter(p => p.descripcion && p.descripcion.trim() !== '').length;
  const exDespues = despues.filter(p => p.numero_excel !== null && p.numero_excel !== undefined).length;

  // ── 3) Lo que NO debe perderse ──────────────────────────────────────
  ok('3) sigue habiendo 14 partidas', despues.length === 14, despues.length);
  ok('3) NO se pierden las CATEGORÍAS al guardar (el bug encontrado)',
    catsDespues === catsAntes, catsDespues + '/14 (antes ' + catsAntes + '/14)');
  ok('3) las categorías siguen en su partida correcta',
    despues.every((p, i) => (p.descripcion || '') === (antes[i].descripcion || '')),
    despues.map(p => p.descripcion).filter((v, i, a) => a.indexOf(v) === i).join(' | '));
  ok('3) NO se pierde el número de bloque del Excel',
    exDespues === exAntes, exDespues + ' (antes ' + exAntes + ')');
  ok('3) NO se pierde el EJECUTADO al guardar',
    Math.abs(totDespues.e - (totAntes.e + 1000)) < 2,
    Math.round(totDespues.e) + ' (antes ' + Math.round(totAntes.e) + ', esperado ' + Math.round(totAntes.e + 1000) + ')');
  ok('3) el ANUAL (columna D) no se mueve por editar un mes de ejecución',
    Math.abs(totDespues.a - totAntes.a) < 2,
    Math.round(totDespues.a) + ' vs ' + Math.round(totAntes.a));
  ok('3) la suma de los 12 meses ASIGNADOS da exactamente el anual (sin centavos perdidos)',
    despues.every(p => {
      const s = db.prepare('SELECT COALESCE(SUM(asignado),0) a FROM presupuesto_valores_mensuales WHERE partida_id = ?').get(p.id);
      return Math.abs(s.a - (p.asignado_anual || 0)) < 0.01;
    }),
    despues.map(p => Math.round(p.asignado_anual || 0) + '=' + Math.round(db.prepare('SELECT COALESCE(SUM(asignado),0) a FROM presupuesto_valores_mensuales WHERE partida_id = ?').get(p.id).a)).join(' '));

  // ── 4) Los agregados cuadran con el detalle (lo que ve el usuario) ───
  const conAg = despues.filter(p => p.asignado_anual !== null && p.ejecutado_acumulado !== null).length;
  ok('4) los agregados ya NO quedan en NULL (tarjetas sin cuadrar)',
    conAg === 14, conAg + '/14 con agregado');

  // 📦824 — El ANUAL es la columna D del ACT-FO-043, la verdad del documento.
  // No se puede derivar sumando los 12 meses: esos son un reparto inventado
  // (anual/12) y cualquier hueco se come el total. Se compara contra el D real
  // leído del archivo.
  const XLSX = require('xlsx');
  const wbX = XLSX.readFile(PLANTILLA);
  const filasX = XLSX.utils.sheet_to_json(wbX.Sheets[wbX.SheetNames[0]], { header: 1, raw: true, defval: null });
  const dDelExcel = [];
  for (let r = 9; r <= 40; r++) {
    const f = filasX[r];
    if (!f) continue;
    if (f[0] === 'TOTAL AÑO' || f[0] === 'IPC') break;
    if (f[2] && String(f[2]).trim() !== '') dDelExcel.push(typeof f[3] === 'number' ? f[3] : 0);
  }
  const anualOk = despues.every((p, i) => Math.abs((p.asignado_anual || 0) - (dDelExcel[i] || 0)) < 1);
  ok('4) el ANUAL de cada partida sigue siendo la columna D del Excel', anualOk,
    despues.map((p, i) => Math.round(p.asignado_anual || 0) + '/' + Math.round(dDelExcel[i] || 0)).join(' '));

  const cuadra = despues.every(p => {
    const s = db.prepare('SELECT COALESCE(SUM(ejecutado),0) e FROM presupuesto_valores_mensuales WHERE partida_id = ?').get(p.id);
    return Math.abs((p.ejecutado_acumulado || 0) - s.e) < 1;
  });
  ok('4) el ejecutado de cada partida cuadra con la suma de sus meses', cuadra);
  const pct = despues.every(p => {
    const esperado = (p.asignado_anual > 0) ? Math.round((p.ejecutado_acumulado / p.asignado_anual) * 100 * 100) / 100 : 0;
    return Math.abs((p.porcentaje_eje || 0) - esperado) < 0.01;
  });
  ok('4) el % de ejecución es coherente', pct);
  ok('4) ninguna partida quedó inactiva sin querer',
    despues.every(p => p.activo === 1), despues.filter(p => p.activo !== 1).length + ' inactivas');

  // 📦824 — Si la grilla NO manda el anual, se conserva el de la BD.
  const sinAnual = despues.map(p => {
    const v = db.prepare('SELECT mes, ejecutado FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes').all(p.id);
    const fila = { id: p.numero, detalle: p.concepto };   // sin `asignacion`
    COLUMN_MESES.forEach((m, i) => { fila[m] = v[i] ? v[i].ejecutado : 0; });
    return fila;
  });
  await call('presupuesto:bulk-save', { presupuestoId: pid, data: sinAnual });
  const sinAnualRes = leer();
  ok('4) sin `asignacion` en el payload, el anual NO se pierde',
    sinAnualRes.every((p, i) => Math.abs((p.asignado_anual || 0) - (despues[i].asignado_anual || 0)) < 1),
    sinAnualRes.map((p, i) => Math.round(p.asignado_anual || 0) + '/' + Math.round(despues[i].asignado_anual || 0)).join(' '));
  const catsSinAnual = sinAnualRes.filter(p => p.descripcion && p.descripcion.trim() !== '').length;
  ok('4) sin `asignacion`, las categorías tampoco se pierden', catsSinAnual === 14, catsSinAnual + '/14');

  // ── 5) Un SEGUNDO guardado no degrada más ────────────────────────────
  const payload2 = despues.map(p => {
    const v = db.prepare('SELECT mes, ejecutado FROM presupuesto_valores_mensuales WHERE partida_id = ? ORDER BY mes').all(p.id);
    const fila = { id: p.numero, detalle: p.concepto, asignacion: p.asignado_anual || 0 };
    COLUMN_MESES.forEach((m, i) => { fila[m] = v[i] ? v[i].ejecutado : 0; });
    return fila;
  });
  await call('presupuesto:bulk-save', { presupuestoId: pid, data: payload2 });
  const final = leer();
  ok('5) guardar dos veces no degrada las categorías',
    final.filter(p => p.descripcion && p.descripcion.trim() !== '').length === 14,
    final.filter(p => p.descripcion && p.descripcion.trim() !== '').length + '/14');

  db.close();
  imprimir();
}

function imprimir() {
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
