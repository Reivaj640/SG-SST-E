// test-ausentismo-sync-roundtrip.js
// 📦1095 (2026-11-23) — Prueba de IDA Y VUELTA del sync para el ausentismo
// (3.3.6): serializa los registros de incapacidad desde una base y los
// deserializa en otra, y verifica que LLEGUEN.
//
// Por qué esta prueba: el serializer NO copia la base, copia una lista
// explicita de entidades. Si `ausentismo_registros` no estuviera en esa
// lista, el sync seguiria dando verde en todos los demas tests y el dato
// se quedaria quieto en la PC donde se capturo — sin error, sin aviso.
// Esta prueba simula las DOS maquinas de verdad (dos bases en memoria).
//
// Tambien fija el ALCANCE de lo que viaja (ver la nota de alcance del
// cabecera de sync-serializer.js):
//   - viajan las filas que alguien digito (origen='app');
//   - NO viajan las importadas del Excel oficial (origen='import_excel');
//   - NO viaja `exportado_excel_en` (es un hecho de esta maquina).
//
// NOTA de ejecucion: better-sqlite3 esta compilado con el ABI de Electron:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-ausentismo-sync-roundtrip.js

'use strict';

const fs = require('fs');
const path = require('path');

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

const Database = require('better-sqlite3');
const serializer = require('./sync-serializer.js');

// El schema del bridge: se usa el real, no una copia (si el bridge cambia
// las columnas, este test debe avisar).
const bridgeSrc = fs.readFileSync(path.join(__dirname, 'ausentismo-bridge.js'), 'utf8');
const SCHEMA = (function () {
  const m = bridgeSrc.match(/const SCHEMA_SQL = `([\s\S]*?)`;/);
  if (!m) throw new Error('No se encontro SCHEMA_SQL en ausentismo-bridge.js');
  return m[1];
})();

const EMPRESA = 'Aseplus';
const OTRA = 'Temposum';

function nuevaPc() {
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  return db;
}

function insertar(db, id, empresa, cedula, nombre, origen, actualizado, extra) {
  const cols = ['id', 'empresa_id', 'cedula', 'nombre', 'cargo', 'area', 'empresa_usuaria', 'genero',
    'fecha_inicio', 'fecha_fin', 'dias_incapacidad', 'tipo_incapacidad', 'clase_incapacidad', 'entidad',
    'codigo', 'diagnostico', 'descripcion', 'observaciones', 'concepto', 'mas_10_dias',
    'anio_incapacidad', 'mes_incapacidad', 'anio', 'mes', 'origen', 'excel_fila', 'excel_archivo',
    'excel_hoja', 'excel_row_json', 'exportado_excel_en', 'exportado_excel_fila', 'creado_en', 'actualizado_en'];
  const vals = cols.map(function (c) {
    if (extra && Object.prototype.hasOwnProperty.call(extra, c)) return extra[c];
    if (c === 'id') return id;
    if (c === 'empresa_id') return empresa;
    if (c === 'cedula') return cedula;
    if (c === 'nombre') return nombre;
    if (c === 'origen') return origen;
    if (c === 'creado_en') return actualizado;
    if (c === 'actualizado_en') return actualizado;
    if (c === 'dias_incapacidad') return 12;
    if (c === 'mas_10_dias') return 1;
    if (c === 'anio' || c === 'anio_incapacidad') return 2026;
    if (c === 'mes' || c === 'mes_incapacidad') return 1;
    if (c === 'fecha_inicio') return '2026-01-10';
    if (c === 'fecha_fin') return '2026-01-21';
    if (c === 'tipo_incapacidad') return 'ENFERMEDAD GENERAL';
    if (c === 'clase_incapacidad') return 'EPS';
    if (c === 'entidad') return 'SURA';
    if (c === 'codigo') return 'J00X';
    if (c === 'cargo') return 'Operativo';
    if (c === 'area') return 'Turipana';
    return null;
  });
  const ins = db.prepare('INSERT INTO ausentismo_registros (' + cols.join(', ') + ') VALUES (' +
    cols.map(function () { return '?'; }).join(', ') + ')');
  ins.run.apply(ins, vals);
}

// ══════════════ PC 1: se captura ══════════════
const pc1 = nuevaPc();
const t0 = '2026-01-15T10:00:00.000Z';
const t1 = '2026-02-20T10:00:00.000Z';

insertar(pc1, 'aus-1', EMPRESA, '1044392755', 'JUAN TEST', 'app', t0);
insertar(pc1, 'aus-2', EMPRESA, '32840309', 'MARIA TEST', 'app', t1);
// Una fila importada del Excel oficial: NO debe viajar.
insertar(pc1, 'aus-imp', EMPRESA, '111', 'IMPORTADO', 'import_excel', t0, { excel_archivo: 'PI-FO-076.xlsx', excel_fila: 8 });
// Una fila de OTRA empresa: NO debe viajar.
insertar(pc1, 'aus-otr', OTRA, '222', 'DE OTRAS', 'app', t0);

// ══════════════ Serializar (subir al hub) ══════════════
const payload = serializer.serializeEmpresaToSync(pc1, EMPRESA, 'pc-1', 'jrf20', '0.1.253');

ok('1) la entidad ausentismo_registros existe en el payload',
  !!payload.entities.ausentismo_registros && payload.entities.ausentismo_registros.length === 2,
  payload.entities.ausentismo_registros ? payload.entities.ausentismo_registros.length + ' registro(s)' : 'AUSENTE');

ok('1) el payload sigue siendo serializable (es lo que va al archivo)',
  (function () { try { JSON.stringify(payload); return true; } catch (e) { return false; } })());

ok('1) la fila importada del Excel oficial NO viaja',
  payload.entities.ausentismo_registros.every(function (r) { return r.id !== 'aus-imp'; }));

ok('1) la fila de otra empresa NO viaja',
  payload.entities.ausentismo_registros.every(function (r) { return r.id !== 'aus-otr'; }));

ok('1) viaja con el id y el sello de tiempo',
  payload.entities.ausentismo_registros[0].id === 'aus-1' &&
  payload.entities.ausentismo_registros[0].updatedAt === t0);

ok('1) el sello de tiempo NO viaja como `empresa_id` (se pone local)',
  payload.entities.ausentismo_registros[0].registro.empresa_id === undefined);

ok('1) la marca de exportado NO viaja',
  payload.entities.ausentismo_registros[0].registro.exportado_excel_en === undefined &&
  payload.entities.ausentismo_registros[0].registro.excel_archivo === undefined);

// ══════════════ PC 2: recibe ══════════════
const pc2 = nuevaPc();
const res = serializer.deserializeSyncToDb(pc2, payload, {});
const enPc2 = pc2.prepare('SELECT * FROM ausentismo_registros WHERE id = ?').get('aus-1');

ok('2) el registro llega a la otra PC', !!enPc2, JSON.stringify(enPc2 && enPc2.nombre));
ok('2) llega con TODOS los datos de la incapacidad',
  enPc2 && enPc2.cedula === '1044392755' && enPc2.nombre === 'JUAN TEST' &&
  enPc2.cargo === 'Operativo' && enPc2.area === 'Turipana' &&
  enPc2.fecha_inicio === '2026-01-10' && enPc2.fecha_fin === '2026-01-21' &&
  enPc2.dias_incapacidad === 12 && enPc2.tipo_incapacidad === 'ENFERMEDAD GENERAL' &&
  enPc2.clase_incapacidad === 'EPS' && enPc2.entidad === 'SURA' && enPc2.codigo === 'J00X' &&
  enPc2.anio === 2026 && enPc2.mes === 1 && enPc2.mas_10_dias === 1,
  JSON.stringify(enPc2 && enPc2.cedula) + '/' + (enPc2 && enPc2.nombre));

ok('2) el empresa_id local es el del payload (no el del remoto)',
  enPc2 && enPc2.empresa_id === EMPRESA, enPc2 && enPc2.empresa_id);

ok('2) el origen queda en "app"',
  enPc2 && enPc2.origen === 'app', enPc2 && enPc2.origen);

ok('2) NO llega la fila importada ni la de otra empresa',
  !pc2.prepare('SELECT id FROM ausentismo_registros WHERE id = ?').get('aus-imp') &&
  !pc2.prepare('SELECT id FROM ausentismo_registros WHERE id = ?').get('aus-otr'));

ok('2) el contador de la entidad cuenta lo aplicado',
  res.byEntity.ausentismo_registros && res.byEntity.ausentismo_registros.applied === 2 &&
  res.byEntity.ausentismo_registros.skipped === 0,
  JSON.stringify(res.byEntity.ausentismo_registros));

// ══════════════ La marca de exportado es LOCAL ══════════════
// La PC 2 ya habia exportado esa fila a SU copia: el merge remoto no la borra.
pc2.prepare('UPDATE ausentismo_registros SET exportado_excel_en = ? WHERE id = ?').run('2026-02-01T09:00:00.000Z', 'aus-1');
serializer.deserializeSyncToDb(pc2, payload, {});
const trasMerge = pc2.prepare('SELECT exportado_excel_en FROM ausentismo_registros WHERE id = ?').get('aus-1');
ok('3) la marca de exportado de esta maquina NO se pisa con la remota',
  trasMerge && trasMerge.exportado_excel_en === '2026-02-01T09:00:00.000Z', trasMerge && trasMerge.exportado_excel_en);

// ══════════════ Last-write-wins ══════════════
// 4) La PC 2 tiene una version MAS NUEVA: el remoto no debe pisarla.
const pc3 = nuevaPc();
insertar(pc3, 'aus-1', EMPRESA, '1044392755', 'VERSION LOCAL MAS NUEVA', 'app', '2026-09-01T10:00:00.000Z');
const r4 = serializer.deserializeSyncToDb(pc3, payload, {});
const tras4 = pc3.prepare('SELECT nombre, actualizado_en FROM ausentismo_registros WHERE id = ?').get('aus-1');
ok('4) el local mas nuevo gana (no se pisa con el remoto)',
  tras4 && tras4.nombre === 'VERSION LOCAL MAS NUEVA' && tras4.actualizado_en === '2026-09-01T10:00:00.000Z',
  tras4 && tras4.nombre);
ok('4) el remoto mas viejo se cuenta como omitido',
  r4.byEntity.ausentismo_registros.skipped >= 1, JSON.stringify(r4.byEntity.ausentismo_registros));

// 5) La PC 4 tiene una version mas vieja: el remoto DEBE ganar y avisar del conflicto.
const pc4 = nuevaPc();
insertar(pc4, 'aus-1', EMPRESA, '1044392755', 'VERSION LOCAL MAS VIEJA', 'app', '2020-01-01T10:00:00.000Z');
const conflictos = [];
const r5 = serializer.deserializeSyncToDb(pc4, payload, { conflictLog: function (a, b) { conflictos.push([a, b]); } });
const tras5 = pc4.prepare('SELECT nombre, actualizado_en FROM ausentismo_registros WHERE id = ?').get('aus-1');
ok('5) el remoto mas nuevo gana (last-write-wins)',
  tras5 && tras5.nombre === 'JUAN TEST' && tras5.actualizado_en === t0, tras5 && tras5.nombre);
ok('5) el cambio se reporta como conflicto',
  r5.byEntity.ausentismo_registros.conflicts === 1 && conflictos.length === 1,
  JSON.stringify(r5.byEntity.ausentismo_registros));

// ══════════════ La entidad esta CONECTADA (no solo definida) ══════════════
// Con la funcion definida pero sin asignar, el guard pasaba y el dato no
// viajaba. Se probo con mutacion en el paquete del 3.1.2.
const syncSrc = fs.readFileSync(path.join(__dirname, 'sync-serializer.js'), 'utf8');
ok('6) la entidad esta conectada al payload (no solo definida)',
  /ausentismo_registros: _serializeAusentismos\(db, companyKey\)/.test(syncSrc) &&
  /_deserializeAusentismos\(db, entities\.ausentismo_registros/.test(syncSrc) &&
  /function _serializeAusentismos/.test(syncSrc) &&
  /function _deserializeAusentismos/.test(syncSrc) &&
  /ausentismo_registros: \{ applied: 0, conflicts: 0, skipped: 0 \}/.test(syncSrc));

// ══════════════ Payload viejo (sin la entidad) no rompe ══════════════
const pc5 = nuevaPc();
const payloadViejo = { version: serializer.SYNC_VERSION, companyKey: EMPRESA, lastWriteAt: t0, lastWriter: {}, entities: {} };
let r6 = null;
try { r6 = serializer.deserializeSyncToDb(pc5, payloadViejo, {}); } catch (e) { r6 = { error: e.message }; }
ok('7) un .kairsync viejo (sin ausentismo) NO rompe el merge',
  r6 && !r6.error && r6.byEntity.ausentismo_registros.applied === 0, r6 && r6.error);

// ══════════════ Resumen ══════════════
let failed = 0;
console.log('\n=======================================');
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK  ' : 'FAIL') + '  ' + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
