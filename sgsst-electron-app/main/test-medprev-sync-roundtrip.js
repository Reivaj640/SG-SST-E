// test-medprev-sync-roundtrip.js
// 📦827 (2026-09-30) — Prueba de IDA Y VUELTA del sync para los programas del
// 3.1.2: serializa el programa desde una base y lo deserializa en otra, y
// verifica que LLEGUE TODO.
//
// Por qué esta prueba es la más importante del paquete: el serializer NO copia
// la base, copia una lista explícita de entidades. Si `medprev_programas` no
// estuviera en esa lista, el sync seguiría dando verde en todos los demás tests
// y el dato se quedaría quieto en la PC donde se capturó — sin error, sin aviso.
// Esta prueba simula las DOS máquinas de verdad (dos bases en memoria) y compara.
//
// NOTA de ejecución: better-sqlite3 está compilado con el ABI de Electron:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-medprev-sync-roundtrip.js

'use strict';

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); };

const Database = require('better-sqlite3');
const serializer = require('./sync-serializer.js');
const MP_SCHEMA = require('./medprev-programas-schema-sql.js');
const SVE_SCHEMA = require('./medprev-sve-datos-schema-sql.js');

const EMPRESA = 'tempoactiva';
const PROGRAMA = 'mpp-sve-2024';

function nuevaPc() {
  const db = new Database(':memory:');
  db.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL)");
  db.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c1', ?, 'Tempoactiva Est SAS')").run(EMPRESA);
  db.exec(MP_SCHEMA.MP_PROGRAMAS_SCHEMA_SQL);
  db.exec(SVE_SCHEMA.MP_SVE_SCHEMA_SQL);
  return db;
}

// ══════════════ PC 1: se captura ══════════════
const pc1 = nuevaPc();
const t0 = '2026-01-15T10:00:00.000Z';

pc1.prepare("INSERT INTO mp_programas (id, empresa_id, tipo, nombre, descripcion, estado, fecha_inicio, fecha_fin, plantilla, creado_en, actualizado_en) " +
  "VALUES (?, ?, 'sve', 'SVE COVID-19 2024', 'Vigilancia', 'activo', '2024-01-01', NULL, 'estandar', ?, ?)").run(PROGRAMA, EMPRESA, t0, t0);
pc1.prepare("INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en) " +
  "VALUES ('s1', ?, 'dashboard', 'Dashboard ejecutivo', '', 1, 'completo', ?)").run(PROGRAMA, t0);
pc1.prepare("INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en) " +
  "VALUES ('s3', ?, 'plan', 'Plan PHVA', '', 3, 'en_curso', ?)").run(PROGRAMA, t0);

pc1.prepare("INSERT INTO mp_sve_meta (programa_id, empresa_id, meta_json, actualizado_en) VALUES (?, ?, ?, ?)")
  .run(PROGRAMA, EMPRESA, JSON.stringify({ empresa: 'Tempoactiva', anio: 2024, codigo: 'F-XX-SST-024' }), t0);

const CASO_COLS = ['id', 'programa_id', 'empresa_id', 'orden', 'eliminado_en', 'creado_en', 'actualizado_en', 'creado_por',
  'trabajador', 'documento', 'area', 'cargo', 'estado', 'anio', 'mes'];
pc1.prepare('INSERT INTO mp_sve_casos (' + CASO_COLS.join(', ') + ') VALUES (' + CASO_COLS.map(function () { return '?'; }).join(', ') + ')')
  .run('msc-a', PROGRAMA, EMPRESA, 0, null, t0, t0, null, 'JHONATAN MOLINA', '1044390709', 'SEDE NORTE', 'AUXILIAR', 'confirmado', 2024, 'enero');
pc1.prepare('INSERT INTO mp_sve_casos (' + CASO_COLS.join(', ') + ') VALUES (' + CASO_COLS.map(function () { return '?'; }).join(', ') + ')')
  .run('msc-b', PROGRAMA, EMPRESA, 1, null, t0, t0, null, 'MARIA LOPEZ', '22334455', 'TURIPANA', 'OPERADOR', 'aislamiento', 2024, 'febrero');
// Un caso ARCHIVADO (baja lógica): NO debe viajar — está eliminado.
pc1.prepare('INSERT INTO mp_sve_casos (' + CASO_COLS.join(', ') + ') VALUES (' + CASO_COLS.map(function () { return '?'; }).join(', ') + ')')
  .run('msc-z', PROGRAMA, EMPRESA, 2, t0, t0, t0, null, 'CASO RETIRADO', '999', 'X', 'Y', 'alta', 2024, 'marzo');

pc1.prepare("INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) " +
  "VALUES ('act-1', ?, ?, 'planear', 'Actualizar la matriz', 'Empresa', 0, ?, ?)").run(PROGRAMA, EMPRESA, t0, t0);
const insMes = pc1.prepare('INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES (?, ?, ?, ?, ?)');
[[1, 1], [1, 0], [0, 0], [1, 1]].forEach(function (p, i) { insMes.run('act-1', PROGRAMA, i + 1, p[0], p[1]); });
for (var m = 5; m <= 12; m++) insMes.run('act-1', PROGRAMA, m, 0, 0);

pc1.prepare("INSERT INTO mp_sve_indicadores (id, programa_id, empresa_id, clave, nombre, meta, formulacion, periodicidad, actualizado_en) " +
  "VALUES ('msi-1', ?, ?, 'prevalencia', 'Prevalencia COVID-19', 'Menor al 10%', '', 'ANUAL', ?)").run(PROGRAMA, EMPRESA, t0);
const insVal = pc1.prepare('INSERT INTO mp_sve_indicadores_valores (indicador_id, programa_id, anio, medida, valor) VALUES (?, ?, ?, ?, ?)');
insVal.run('msi-1', PROGRAMA, 2024, 'casos', 3);
insVal.run('msi-1', PROGRAMA, 2024, 'promedio', 148);

pc1.prepare("INSERT INTO mp_sve_morbilidad (programa_id, empresa_id, tipo, anio, casos, dias_it) VALUES (?, ?, 'Accidentes de trabajo', 2024, 3, 20)")
  .run(PROGRAMA, EMPRESA);
pc1.prepare("INSERT INTO mp_sve_analisis (id, programa_id, empresa_id, periodo, hallazgos, propuestas, responsable, orden, actualizado_en) " +
  "VALUES ('mso-1', ?, ?, '1. ENERO - JUNIO', 'Hallazgo', 'Propuesta', 'SG-SST', 0, ?)").run(PROGRAMA, EMPRESA, t0);

// ══════════════ Serializar (subir al hub) ══════════════
const syncJson = serializer.serializeEmpresaToSync(pc1, EMPRESA, 'pc-1', 'jrf20', '0.1.226');

ok('1) la entidad medprev_programas existe en el JSON del hub',
  !!syncJson.entities.medprev_programas && syncJson.entities.medprev_programas.length === 1,
  syncJson.entities.medprev_programas ? syncJson.entities.medprev_programas.length + ' registro(s)' : 'AUSENTE');
ok('1) el JSON sigue siendo serializable (es lo que va al archivo)',
  (function () { try { JSON.stringify(syncJson); return true; } catch (e) { return false; } })());
ok('1) el programa viaja con su shell y su contenido',
  (function () {
    var r = syncJson.entities.medprev_programas[0];
    return r.id === PROGRAMA && r.programa.nombre === 'SVE COVID-19 2024' &&
      r.secciones.length === 2 && r.datos.casos.length === 2 &&
      r.datos.plan.length === 1 && r.datos.plan[0].meses.length === 12 &&
      r.datos.indicadores.length === 1 && r.datos.indicadores[0].valores.length === 2 &&
      r.datos.morbilidad.length === 1 && r.datos.analisis.length === 1;
  })(),
  'secciones=2 casos=2 plan=1 meses=12 indicadores=1 valores=2');
ok('1) el caso con baja logica NO viaja (eliminado_en IS NULL)',
  syncJson.entities.medprev_programas[0].datos.casos.every(function (c) { return c.id !== 'msc-z'; }));

// ══════════════ PC 2: bajar del hub ══════════════
const pc2 = nuevaPc();
const r = serializer.deserializeSyncToDb(pc2, syncJson, {});
ok('2) el merge reporta 1 aplicado y 0 conflictos', r.applied === 1 && r.conflicts === 0,
  'applied=' + r.applied + ' conflicts=' + r.conflicts);
ok('2) el contador de la entidad medprev_programas sube a 1',
  r.byEntity.medprev_programas && r.byEntity.medprev_programas.applied === 1,
  JSON.stringify(r.byEntity.medprev_programas));

ok('2) el programa llego a la PC 2',
  !!pc2.prepare('SELECT id FROM mp_programas WHERE id = ?').get(PROGRAMA));
ok('2) llegaron sus 2 secciones',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_programa_secciones WHERE programa_id = ?').get(PROGRAMA).n === 2,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_programa_secciones WHERE programa_id = ?').get(PROGRAMA).n + '');
ok('2) el estado de la seccion llego (plan = en_curso)',
  pc2.prepare("SELECT estado FROM mp_programa_secciones WHERE programa_id = ? AND clave = 'plan'").get(PROGRAMA).estado === 'en_curso');
ok('2) llego el meta del documento',
  JSON.parse(pc2.prepare('SELECT meta_json FROM mp_sve_meta WHERE programa_id = ?').get(PROGRAMA).meta_json).codigo === 'F-XX-SST-024');
ok('2) llegaron los 2 casos con sus datos',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n === 2 &&
  pc2.prepare("SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ? AND estado = 'confirmado'").get(PROGRAMA).n === 1,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n + ' caso(s)');
ok('2) el caso archivado NO fue creado en la PC 2',
  !pc2.prepare('SELECT id FROM mp_sve_casos WHERE id = ?').get('msc-z'));
ok('2) llego la actividad del plan con su nombre y responsable',
  (function () {
    var a = pc2.prepare("SELECT * FROM mp_sve_plan_actividades WHERE id = 'act-1'").get();
    return a && a.actividad === 'Actualizar la matriz' && a.responsable === 'Empresa' && a.fase === 'planear';
  })());
ok('2) llegaron los 12 meses del plan con sus ap/ae',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get('act-1').n === 12,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get('act-1').n + ' meses');
ok('2) los ap/ae llegaron intactos (no todos en cero)',
  (function () {
    var m = pc2.prepare("SELECT ap, ae FROM mp_sve_plan_meses WHERE actividad_id = 'act-1' AND mes = 1").get();
    return m && m.ap === 1 && m.ae === 1;
  })());
ok('2) llego el indicador con sus dos valores',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_indicadores WHERE programa_id = ?').get(PROGRAMA).n === 1 &&
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_indicadores_valores WHERE programa_id = ?').get(PROGRAMA).n === 2,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_indicadores_valores WHERE programa_id = ?').get(PROGRAMA).n + ' valores');
ok('2) llego la morbilidad',
  (function () {
    var x = pc2.prepare('SELECT * FROM mp_sve_morbilidad WHERE programa_id = ?').get(PROGRAMA);
    return x && x.casos === 3 && x.dias_it === 20;
  })());
ok('2) llego el analisis con sus 3 campos',
  (function () {
    var x = pc2.prepare('SELECT * FROM mp_sve_analisis WHERE programa_id = ?').get(PROGRAMA);
    return x && x.periodo === '1. ENERO - JUNIO' && x.hallazgos === 'Hallazgo' && x.responsable === 'SG-SST';
  })());
ok('2) la empresa_id se escribio en la PC 2 (aislamiento multi-empresa)',
  pc2.prepare("SELECT COUNT(*) AS n FROM mp_sve_casos WHERE empresa_id = ? AND empresa_id IS NOT NULL").get(EMPRESA).n === 2);

// ══════════════ Idempotencia: bajar dos veces ══════════════
const r2 = serializer.deserializeSyncToDb(pc2, syncJson, {});
ok('3) bajar el mismo archivo dos veces NO duplica casos',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n === 2,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n + ' caso(s)');
ok('3) Tampoco duplica los 12 meses del plan',
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get('act-1').n === 12,
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get('act-1').n + ' meses');

// ══════════════ Un caso eliminado en la PC 1 desaparece en la PC 2 ══════════════
// Es el caso que NO se resuelve con un simple upsert: si la PC 1 archiva un
// caso (baja LÓGICA, que es lo que hace la app), la PC 2 tiene que dejar de
// verlo, o el "borrado" no viaja nunca. Por eso `_reinsertarHijo` borra el
// bloque entero antes de reinsertar, en vez de hacer upsert fila por fila.
pc1.prepare("UPDATE mp_sve_casos SET eliminado_en = ? WHERE id = 'msc-b'").run('2026-02-01T09:00:00.000Z');
const syncJson2 = serializer.serializeEmpresaToSync(pc1, EMPRESA, 'pc-1', 'jrf20', '0.1.226');
ok('3) tras archivar el caso en la PC 1, el caso ya no viaja',
  syncJson2.entities.medprev_programas[0].datos.casos.every(function (c) { return c.id !== 'msc-b'; }),
  syncJson2.entities.medprev_programas[0].datos.casos.map(function (c) { return c.id; }).join(','));
serializer.deserializeSyncToDb(pc2, syncJson2, {});
ok('3) el caso archivado DESAPARECE de la PC 2 (el borrado tambien viaja)',
  !pc2.prepare('SELECT id FROM mp_sve_casos WHERE id = ?').get('msc-b'),
  pc2.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n + ' caso(s) quedan');

// ══════════════ Un programa de otra empresa no se pisa ══════════════
const syncAjeno = JSON.parse(JSON.stringify(syncJson));
syncAjeno.entities.medprev_programas[0].programa.empresa_id = 'otra-empresa';
serializer.deserializeSyncToDb(pc2, syncAjeno, {});
ok('4) un programa remoto de OTRA empresa se ignora',
  pc2.prepare('SELECT empresa_id FROM mp_programas WHERE id = ?').get(PROGRAMA).empresa_id === EMPRESA,
  pc2.prepare('SELECT empresa_id FROM mp_programas WHERE id = ?').get(PROGRAMA).empresa_id);

// ══════════════ 📦827-fix — La BAJA de un programa SÍ viaja ══════════════
// El hueco que se encontró: el soft-delete marcaba estado='eliminado' y el
// serializer filtra `estado != 'eliminado'`, así que el programa dejaba
// de viajar en el payload… y el otro equipo, que solo procesa lo que llega, lo
// seguía teniendo VIVO con todos sus datos. Dos máquinas distintas sin que nada
// lo señale. Las bajas viajan ahora como tombstones.
{
  // PC 3 y 4 de prueba, con el programa ya sembrado, como si las dos tuvieran
  // la misma base sincronizada.
  const pc3 = nuevaPc();
  const pc4 = nuevaPc();
  const seed = serializer.serializeEmpresaToSync(pc1, EMPRESA, 'pc-1', 'jrf20', '0.1.226');
  serializer.deserializeSyncToDb(pc3, seed, {});
  serializer.deserializeSyncToDb(pc4, seed, {});
  const casosEn = db => db.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n;
  ok('5) las dos PCs arrancan con el programa vivo y sus casos',
    !!pc3.prepare('SELECT id FROM mp_programas WHERE id = ?').get(PROGRAMA) && casosEn(pc3) > 0 && casosEn(pc4) > 0,
    'pc3=' + casosEn(pc3) + ' pc4=' + casosEn(pc4));

  // --- 5a) ELIMINAR de verdad en la PC 3: borra todo y deja tombstone ---
  pc3.prepare('DELETE FROM mp_sve_casos WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_plan_meses WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_plan_actividades WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_meta WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_indicadores_valores WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_indicadores WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_morbilidad WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_sve_analisis WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_programa_secciones WHERE programa_id = ?').run(PROGRAMA);
  pc3.prepare('DELETE FROM mp_programas WHERE id = ?').run(PROGRAMA);
  pc3.prepare("INSERT INTO mp_programas_bajas (programa_id, empresa_id, tipo, nombre, fecha_inicio, fecha_fin, eliminado_en, eliminado_por, origen) " +
    "VALUES (?,?,?,?,?,?,?,?,?)").run(PROGRAMA, EMPRESA, 'sve', 'SVE 2024', null, null, '2026-09-30T12:00:00.000Z', '7', 'eliminar');

  ok('5) tras eliminar, el programa ya no viaja como programa vivo',
    (serializer.serializeEmpresaToSync(pc3, EMPRESA, 'pc-1', 'jrf20', '0.1.226').entities.medprev_programas || [])
      .every(r => r.id !== PROGRAMA),
    'el payload ya no lo lista');
  ok('5) pero la BAJA si viaja (sin ella, el otro equipo no se entera)',
    (serializer.serializeEmpresaToSync(pc3, EMPRESA, 'pc-1', 'jrf20', '0.1.226').entities.medprev_programas_bajas || []).length === 1,
    JSON.stringify((serializer.serializeEmpresaToSync(pc3, EMPRESA, 'pc-1', 'jrf20', '0.1.226').entities.medprev_programas_bajas || []).map(b => b.programa_id + ':' + b.origen)));

  serializer.deserializeSyncToDb(pc4, serializer.serializeEmpresaToSync(pc3, EMPRESA, 'pc-1', 'jrf20', '0.1.226'), {});
  ok('5) en la OTRA PC el programa desaparece (esto es lo que faltaba antes)',
    !pc4.prepare('SELECT id FROM mp_programas WHERE id = ?').get(PROGRAMA),
    'estado=' + (pc4.prepare('SELECT estado FROM mp_programas WHERE id = ?').get(PROGRAMA) || { estado: '(no existe)' }).estado);
  ok('5) y sus datos personales tambien: 0 casos, 0 actividades, 0 meses',
    casosEn(pc4) === 0 &&
    pc4.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get(PROGRAMA).n === 0 &&
    pc4.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE programa_id = ?').get(PROGRAMA).n === 0,
    'casos=' + casosEn(pc4));
  ok('5) y la PC 4 registra la baja para no volver a crearlo',
    (pc4.prepare('SELECT * FROM mp_programas_bajas WHERE programa_id = ?').get(PROGRAMA) || {}).origen === 'eliminar');
}

// ══════════════ 📦827-fix — Archivar NO borra en la otra PC ══════════════
// La contra-prueba: si archivar se comportara como eliminar, el usuario que
// archiva un programa perdería la historia en todos los equipos. Archivar es
// local a propósito.
{
  const pc5 = nuevaPc();
  const pc6 = nuevaPc();
  const seed = serializer.serializeEmpresaToSync(pc1, EMPRESA, 'pc-1', 'jrf20', '0.1.226');
  serializer.deserializeSyncToDb(pc5, seed, {});
  serializer.deserializeSyncToDb(pc6, seed, {});

  pc5.prepare("UPDATE mp_programas SET estado = 'eliminado' WHERE id = ?").run(PROGRAMA);
  pc5.prepare("INSERT OR REPLACE INTO mp_programas_bajas (programa_id, empresa_id, tipo, nombre, fecha_inicio, fecha_fin, eliminado_en, eliminado_por, origen) " +
    "VALUES (?,?,?,?,?,?,?,?,?)").run(PROGRAMA, EMPRESA, 'sve', 'SVE 2024', null, null, '2026-09-30T12:00:00.000Z', '7', 'archivo');

  const payloadArchivo = serializer.serializeEmpresaToSync(pc5, EMPRESA, 'pc-1', 'jrf20', '0.1.226');
  ok('5) archivar viaja como "archivo" (para que el otro equipo lo sepa sin borrar nada)',
    (payloadArchivo.entities.medprev_programas_bajas || []).length === 1 &&
    payloadArchivo.entities.medprev_programas_bajas[0].origen === 'archivo');
  ok('5) el programa archivado no viaja como programa vivo',
    (payloadArchivo.entities.medprev_programas || []).every(r => r.id !== PROGRAMA));

  serializer.deserializeSyncToDb(pc6, payloadArchivo, {});
  const casos6 = pc6.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ?').get(PROGRAMA).n;
  ok('5) en la otra PC el programa se marca eliminado PERO conserva sus datos',
    (pc6.prepare('SELECT estado FROM mp_programas WHERE id = ?').get(PROGRAMA) || {}).estado === 'eliminado' && casos6 > 0,
    'estado=' + ((pc6.prepare('SELECT estado FROM mp_programas WHERE id = ?').get(PROGRAMA) || {}).estado) + ' casos=' + casos6);
}

// ══════════════ Una base sin las tablas mp_sve_* no se rompe ══════════════
// Es el caso de una PC con una versión vieja de la app: el sync no puede
// reventar por tablas que no conoce.
const pcVieja = new Database(':memory:');
pcVieja.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL)");
pcVieja.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c1', ?, 'Tempoactiva Est SAS')").run(EMPRESA);
pcVieja.exec(MP_SCHEMA.MP_PROGRAMAS_SCHEMA_SQL);
// SIN las tablas mp_sve_*
let rVieja = null, errorVieja = null;
try { rVieja = serializer.deserializeSyncToDb(pcVieja, syncJson, {}); }
catch (e) { errorVieja = e.message; }
ok('4) una base SIN las tablas mp_sve_* no rompe el sync (compatibilidad hacia atras)',
  errorVieja === null && rVieja !== null,
  errorVieja || ('applied=' + rVieja.applied + ' skipped=' + rVieja.skipped));
ok('4) en esa base vieja el programa y sus secciones si seapplycan',
  !!pcVieja.prepare('SELECT id FROM mp_programas WHERE id = ?').get(PROGRAMA) &&
  pcVieja.prepare('SELECT COUNT(*) AS n FROM mp_programa_secciones WHERE programa_id = ?').get(PROGRAMA).n === 2);

// ══════════════ salida ══════════════
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
