// test-presupuesto-824-aislamiento.js
// 📦824 — Garantía de que los PERÍODOS no se pisan entre sí.
//
// Esta es la promesa que se le hizo al owner: "cambiar de año y editar no puede
// tocar el otro". Con un solo año cargado en la BD no se puede comprobar, así que
// el test carga DOS años de verdad, edita uno, y compara el otro byte a byte.
//
// Cubre:
//   1. bulk-save sobre 2025 NO cambia ni una cifra de 2026
//   2. set-mes-values sobre 2026 NO cambia 2025
//   3. delete-partida en 2025 NO borra la partida equivalente de 2026
//   4. import overwrite de 2025 NO toca 2026
//   5. El IPC es por período: cambiar el de 2025 no cambia el de 2026
//   6. list-by-empresa devuelve los años separados
//
// Uso: npx electron main/test-presupuesto-824-aislamiento.js

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

const checks = [];
function ok(name, cond, extra) { checks.push({ name, ok: !!cond, extra }); }

function main() {
  const Database = require('better-sqlite3');
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

  // ── Crear dos años con datos DIFERENTES ──────────────────────────────
  console.log('[1] Creando 2025 y 2026 con cifras distintas');
  call('presupuesto:create', { companyName: 'ACME S.A.', anio: 2025, nombre: 'P 2025' });
  call('presupuesto:create', { companyName: 'ACME S.A.', anio: 2026, nombre: 'P 2026' });

  const filas = (anio) => ([
    { id: 1, detalle: 'Honorarios profesionales', asignacion: 1000000 },
    { id: 2, detalle: 'Capacitaciones', asignacion: 500000 }
  ]);
  const r25 = call('presupuesto:bulk-save', {
    presupuestoId: idDe(db, 'ACME S.A.', 2025), data: filas(2025)
  });
  const r26 = call('presupuesto:bulk-save', {
    presupuestoId: idDe(db, 'ACME S.A.', 2026), data: filas(2026)
  });
  ok('se crean 2 presupuestos', r25.success && r26.success);
  ok('cada uno con 2 partidas', r25.data.inserted === 2 && r26.data.inserted === 2);

  // Ejecutado real SOLO en 2026 (para tener una asimetría que|ruba)
  const p26 = idDe(db, 'ACME S.A.', 2026);
  const part26 = db.prepare('SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero').all(p26);
  db.prepare('UPDATE presupuesto_valores_mensuales SET ejecutado = 400000 WHERE partida_id = ? AND mes = 1').run(part26[0].id);
  db.prepare('UPDATE presupuesto_partidas SET asignado_anual = 1000000, ejecutado_acumulado = 400000 WHERE id = ?').run(part26[0].id);
  call('presupuesto:update-meta', { presupuestoId: p26, ipc: 0.052 });

  const p25 = idDe(db, 'ACME S.A.', 2025);
  call('presupuesto:update-meta', { presupuestoId: p25, ipc: 0.03 });

  const foto = (id) => JSON.stringify(db.prepare(
    'SELECT p.numero, p.concepto, p.descripcion, p.asignado_anual, p.ejecutado_acumulado, ' +
    'v.mes, v.asignado, v.ejecutado FROM presupuesto_partidas p ' +
    'LEFT JOIN presupuesto_valores_mensuales v ON v.partida_id = p.id ' +
    'WHERE p.presupuesto_id = ? ORDER BY p.numero, v.mes'
  ).all(id));

  const foto25Antes = foto(p25);
  const foto26Antes = foto(p26);
  const ipc25Antes = db.prepare('SELECT ipc FROM presupuestos WHERE id = ?').get(p25).ipc;
  const ipc26Antes = db.prepare('SELECT ipc FROM presupuestos WHERE id = ?').get(p26).ipc;

  ok('2025 y 2026 tienen datos distintos (ejecución 0 vs 400000)',
    foto25Antes !== foto26Antes);

  // ── 1. bulk-save sobre 2025 no toca 2026 ─────────────────────────────
  console.log('[2] Editando 2025 (bulk-save)');
  call('presupuesto:bulk-save', {
    presupuestoId: p25,
    data: [
      { id: 1, detalle: 'Honorarios profesionales EDITADO', asignacion: 9999999 },
      { id: 2, detalle: 'Capacitaciones', asignacion: 500000 }
    ]
  });
  ok('1) 2025 SÍ cambió (el guardado sí aplica)', foto(p25) !== foto25Antes);
  ok('1) 2026 quedó INTACTO tras editar 2025', foto(p26) === foto26Antes,
    foto(p26) === foto26Antes ? '' : 'DIFIERE');
  ok('1) 2026 sigue con su ejecución de 400000',
    db.prepare('SELECT ejecutado FROM presupuesto_valores_mensuales WHERE partida_id = ? AND mes = 1').get(part26[0].id).ejecutado === 400000);

  // ── 2. set-mes-values sobre 2026 no toca 2025 ────────────────────────
  console.log('[3] Editando 2026 (set-mes-values)');
  const part25 = db.prepare('SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero').all(p25);
  const part26n = db.prepare('SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero').all(p26);
  const foto25b = foto(p25);
  call('presupuesto:set-mes-values', { partidaId: part26n[1].id, anio: 2026, mes: 3, asignado: 777777, ejecutado: 111111 });
  ok('2) 2026 SÍ cambió', foto(p26) !== foto26Antes);
  ok('2) 2025 quedó INTACTO tras editar 2026', foto(p25) === foto25b);

  // ── 3. borrar partida de 2025 no toca 2026 ───────────────────────────
  console.log('[4] Borrando una partida de 2025');
  // Los IDs cambian en cada bulk-save (borra y reinserta), así que hay que
  // reconsultarlos: con los antiguos el handler borraba "NOT_FOUND" y el test
  // pasaba por el motivo equivocado... o fallaba, que es peor.
  const part25b = db.prepare('SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ? ORDER BY numero').all(p25);
  const n26Antes = db.prepare('SELECT COUNT(*) c FROM presupuesto_partidas WHERE presupuesto_id = ?').get(p26).c;
  const del = call('presupuesto:delete-partida', { partidaId: part25b[0].id });
  ok('3) el borrado de 2025 se ejecuta bien', del.success, JSON.stringify(del.error || {}));
  ok('3) 2025 pierde la partida (soft-delete: activo=0, la fila se conserva)',
    db.prepare('SELECT COUNT(*) c FROM presupuesto_partidas WHERE presupuesto_id = ? AND activo = 1').get(p25).c === 1,
    'activas=' + db.prepare('SELECT COUNT(*) c FROM presupuesto_partidas WHERE presupuesto_id = ? AND activo = 1').get(p25).c);
  ok('3) los valores de esa partida también dejan de contar',
    db.prepare('SELECT COUNT(*) c FROM presupuesto_valores_mensuales v JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ? AND p.activo = 1').get(p25).c === 12,
    'meses=' + db.prepare('SELECT COUNT(*) c FROM presupuesto_valores_mensuales v JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ? AND p.activo = 1').get(p25).c);
  ok('3) 2026 conserva todas sus partidas',
    db.prepare('SELECT COUNT(*) c FROM presupuesto_partidas WHERE presupuesto_id = ? AND activo = 1').get(p26).c === n26Antes);

  // ── 4. import overwrite de un año no toca el otro ─────────────────────
  console.log('[5] Reimportando 2025 con overwrite (simula el botón Importar)');
  const xlsxTmp = path.join(__dirname, '__tmp_aislamiento_2025.xlsx');
  fs.writeFileSync(xlsxTmp, Buffer.from(
    'PKdummy', 'utf8'));   // no se va a parsear: se comprueba que NO lo intente sobre 2026
  const foto26c = foto(p26);
  const foto25c = foto(p25);
  const imp = call('presupuesto:import-from-excel', {
    filePath: xlsxTmp, companyName: 'ACME S.A.', anio: 2025, options: { overwrite: true }
  });
  ok('4) un archivo inválido en 2025 falla SOLO en 2025 (2026 intacto)',
    !imp.success && foto(p26) === foto26c, 'err=' + (imp.error && imp.error.code));
  try { fs.unlinkSync(xlsxTmp); } catch (e) { }

  // ── 5. el IPC es por período ─────────────────────────────────────────
  console.log('[6] Cambiando el IPC de 2025');
  // El IPC es un DATO, no un multiplicador: el total NO debe moverse al
  // cambiarlo. Se compara contra el total de ANTES de tocar el IPC (en 2025
  // quedó 9999999 + 500000 por la edición del paso 2, no 1500000).
  const total25PreIpc = db.prepare(
    'SELECT COALESCE(SUM(v.asignado),0) s FROM presupuesto_valores_mensuales v ' +
    'JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ?'
  ).get(p25).s;
  call('presupuesto:update-meta', { presupuestoId: p25, ipc: 0.07 });
  ok('5) el IPC de 2025 se actualiza',
    Math.abs(db.prepare('SELECT ipc FROM presupuestos WHERE id = ?').get(p25).ipc - 0.07) < 1e-9);
  ok('5) el IPC de 2026 NO cambia',
    Math.abs(db.prepare('SELECT ipc FROM presupuestos WHERE id = ?').get(p26).ipc - ipc26Antes) < 1e-9);
  const total25PostIpc = db.prepare(
    'SELECT COALESCE(SUM(v.asignado),0) s FROM presupuesto_valores_mensuales v ' +
    'JOIN presupuesto_partidas p ON p.id = v.partida_id WHERE p.presupuesto_id = ?'
  ).get(p25).s;
  ok('5) el IPC NO altera el total (es un dato, no un multiplicador)',
    Math.abs(total25PreIpc - total25PostIpc) < 1e-6,
    total25PreIpc + ' → ' + total25PostIpc);
  const ipcPct = call('presupuesto:update-meta', { presupuestoId: p25, ipc: '7' });
  ok('5) acepta 7 (porcentaje) y lo normaliza a 0.07',
    ipcPct.success && Math.abs(ipcPct.data.presupuesto.ipc - 0.07) < 1e-9,
    ipcPct.success ? String(ipcPct.data.presupuesto.ipc) : 'error');
  const ipcBad = call('presupuesto:update-meta', { presupuestoId: p25, ipc: 'abc' });
  ok('5) rechaza un IPC que no es número', !ipcBad.success);

  // ── 6. list-by-empresa separa los años ───────────────────────────────
  console.log('[7] Listado por empresa');
  const list = call('presupuesto:list-by-empresa', { companyName: 'ACME S.A.' });
  const lista = (list.data && list.data.presupuestos) || [];
  ok('6) devuelve los 2 años', list.success && lista.length === 2, 'n=' + lista.length);
  const anios = lista.map(x => x.anio).sort();
  ok('6) los años vienen separados (2025, 2026)', anios.join(',') === '2025,2026', anios.join(','));
  const y25 = lista.find(x => x.anio === 2025);
  const y26 = lista.find(x => x.anio === 2026);
  ok('6) cada año trae su propio IPC', y25 && y26 && y25.ipc !== y26.ipc,
    '2025=' + (y25 && y25.ipc) + ' 2026=' + (y26 && y26.ipc));
  // 2026 tiene 400000 (enero) + 111111 (marzo, editado en el paso 2).
  // 2025 quedó sin ejecución y con una partida menos.
  ok('6) cada año trae sus totales independientes',
    y25 && y26 && y25.totalEjecutado === 0 && Math.abs(y26.totalEjecutado - 511111) < 1,
    '2025 ej=' + (y25 && y25.totalEjecutado) + ' / 2026 ej=' + (y26 && y26.totalEjecutado));
  ok('6) cada año trae su conteo de partidas',
    y25 && y26 && y25.partidasCount === 1 && y26.partidasCount === 2,
    '2025=' + (y25 && y25.partidasCount) + ' partidas / 2026=' + (y26 && y26.partidasCount));

  db.close();

  let failed = 0;
  console.log('\n=======================================');
  checks.forEach(c => {
    if (!c.ok) failed++;
    const ex = c.extra ? '  [' + c.extra + ']' : '';
    console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + ex);
  });
  console.log('---');
  console.log((checks.length - failed) + '/' + checks.length + ' OK');
  console.log('=======================================');
  process.exit(failed === 0 ? 0 : 1);
}

function idDe(db, empresa, anio) {
  const row = db.prepare(
    "SELECT p.id FROM presupuestos p JOIN companies c ON c.company_key = p.empresa_id WHERE c.display_name = ? AND p.anio = ?"
  ).get(empresa, anio);
  return row ? row.id : null;
}

main();
