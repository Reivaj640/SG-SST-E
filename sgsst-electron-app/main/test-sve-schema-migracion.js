// =====================================================================
// 📦827-fix-2 — La migración NO puede perder filas. Y el test tiene que
// ser capaz de fallar.
//
// La primera versión de este test se armaba un esquema "viejo" al que le
// quitaba la clave foránea de mp_sve_plan_meses. Con ese esquema, las
// migraciones pasaban 17/17 y en la base real se perdían los meses del
// plan. ¿Por qué? Porque la FK que quitó el test es la que hace el daño:
// `DROP TABLE mp_sve_plan_actividades` dispara su ON DELETE CASCADE y borra
// los meses ANTES de que la migración de meses los copie.
//
// La suposición del código era "las FKs de SQLite no están activas por
// defecto". Es cierto en SQLite... pero better-sqlite3 las PRENDE por
// defecto (medido: `foreign_keys` = 1 al abrir). Por eso la cascada sí
// ocurría.
//
// Este test ahora:
//   1) arma el esquema viejo REAL, con su FK en cascada;
//   2) corre las migraciones por la MISMA función que usa main.js;
//   3) comprueba que las filas siguen;
//   4) y comprueba al revés que, corriendo el SQL suelto con las FKs
//      prendidas (como se hacía antes), las filas SE PIERDEN. Sin esta
//      comprobación el test volvería a ser decorado.
// =====================================================================
'use strict';
const Database = require('better-sqlite3');
const SCHEMA = require('./medprev-sve-datos-schema-sql');

const checks = [];
function ok(n, c, e) { checks.push({ name: n, ok: !!c, extra: e }); }
const T = '2026-01-01T00:00:00.000Z';

/* ---------- El esquema VIEJO, tal como quedó en las bases que ya existen ----------
   Se deriva del DDL actual revirtiendo SOLO lo que cambió en 827-fix:
   - PK global (id) en vez de compuesta;
   - UNIQUE(actividad_id, mes) en vez de (programa_id, actividad_id, mes);
   - FK de una sola columna, LA MISMA que tenía antes y que dispara la cascada;
   - sin anios_json / medidas_json en indicadores.
   La FK NO se quita: quitarla es lo que escondía el fallo. */
function esquemaViejo(db) {
  const ddl = SCHEMA.MP_SVE_SCHEMA_SQL
    .replace(/PRIMARY KEY \(programa_id, id\)/g, 'PRIMARY KEY (id)')
    .replace(/\n\s*anios_json\s+TEXT,[^\n]*/g, '')
    .replace(/\n\s*medidas_json\s+TEXT,[^\n]*/g, '')
    .replace(/UNIQUE\(programa_id, actividad_id, mes\)/, 'UNIQUE(actividad_id, mes)')
    .replace(
      /FOREIGN KEY \(programa_id, actividad_id\) REFERENCES mp_sve_plan_actividades\(programa_id, id\) ON DELETE CASCADE/,
      'FOREIGN KEY (actividad_id) REFERENCES mp_sve_plan_actividades(id) ON DELETE CASCADE'
    );
  db.exec(ddl);
  db.exec("CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL)");
  db.prepare("INSERT INTO companies VALUES ('c1','tempo','Tempoactiva Est SAS')").run();
  db.exec("CREATE TABLE IF NOT EXISTS mp_programas (id TEXT PRIMARY KEY, empresa_id TEXT NOT NULL, tipo TEXT, nombre TEXT, descripcion TEXT, estado TEXT, fecha_inicio TEXT, fecha_fin TEXT, plantilla TEXT, creado_en TEXT, actualizado_en TEXT)");
  db.prepare("INSERT INTO mp_programas VALUES ('pg-A','tempo','sve','SVE 2024','','activo',NULL,NULL,'','','')").run();
  db.prepare("INSERT INTO mp_programas VALUES ('pg-B','tempo','sve','SVE 2026','','activo',NULL,NULL,'','','')").run();
  return db;
}

function llenar(db) {
  const insAct = db.prepare('INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?)');
  const insMes = db.prepare('INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES (?,?,?,?,?)');
  for (let i = 1; i <= 19; i++) {
    insAct.run('act-' + i, 'pg-A', 'tempo', 'planear', 'Actividad ' + i, 'Empresa', i, T, T);
    for (let m = 1; m <= 12; m++) insMes.run('act-' + i, 'pg-A', m, 1, 0);
  }
  const insCaso = db.prepare("INSERT INTO mp_sve_casos (id, programa_id, empresa_id, orden, trabajador, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)");
  for (let i = 1; i <= 14; i++) insCaso.run(String(i), 'pg-A', 'tempo', i, 'CASO ' + i, T, T);
  return db;
}

const cuenta = (db, t) => db.prepare('SELECT COUNT(*) n FROM ' + t).get().n;

// =====================================================================
// 1) El camino de la app: la función compartida, con el esquema viejo real
// =====================================================================
const db = esquemaViejo(new Database(':memory:'));
ok('0) better-sqlite3 PRENDE las claves foráneas (por eso la cascada occurria)',
  db.pragma('foreign_keys', { simple: true }) === 1);
llenar(db);
ok('0) la base vieja tiene 19 actividades, 228 meses y 14 casos',
  cuenta(db, 'mp_sve_plan_actividades') === 19 &&
  cuenta(db, 'mp_sve_plan_meses') === 228 &&
  cuenta(db, 'mp_sve_casos') === 14,
  cuenta(db, 'mp_sve_plan_actividades') + '/' + cuenta(db, 'mp_sve_plan_meses') + '/' + cuenta(db, 'mp_sve_casos'));

const res = SCHEMA.aplicarMigracionesMedprevSve(db, { log: (m) => console.log('   (aviso) ' + m) });
ok('1) todas las migraciones se aplican (por la función que usa main.js)',
  res.aplicadas === SCHEMA.MP_SVE_MIGRATIONS_SQL.length && res.fallidas.length === 0,
  res.aplicadas + '/' + SCHEMA.MP_SVE_MIGRATIONS_SQL.length + (res.fallidas.length ? ' · fallaron: ' + res.fallidas.join(', ') : ''));

// ---- ESTA es la comprobación que faltaba ----
ok('2) NO se perdio ninguna actividad (19)', cuenta(db, 'mp_sve_plan_actividades') === 19, cuenta(db, 'mp_sve_plan_actividades') + '');
ok('2) NO se perdio ningun mes del plan (228)', cuenta(db, 'mp_sve_plan_meses') === 228, cuenta(db, 'mp_sve_plan_meses') + '');
ok('2) NO se perdio ningun caso (14)', cuenta(db, 'mp_sve_casos') === 14, cuenta(db, 'mp_sve_casos') + '');
ok('2) el contenido sigue igual (actividad 7, caso 3)',
  db.prepare('SELECT actividad a FROM mp_sve_plan_actividades WHERE programa_id=? AND id=?').get('pg-A', 'act-7').a === 'Actividad 7' &&
  db.prepare('SELECT trabajador t FROM mp_sve_casos WHERE programa_id=? AND id=?').get('pg-A', '3').t === 'CASO 3');
ok('2) los meses siguen alineados a su actividad (act-3, mes 5)',
  db.prepare('SELECT ap FROM mp_sve_plan_meses WHERE programa_id=? AND actividad_id=? AND mes=?').get('pg-A', 'act-3', 5).ap === 1);
ok('2) y las claves foráneas volvieron a quedar prendidas',
  db.pragma('foreign_keys', { simple: true }) === 1);

function pkDe(d, t) { return d.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(t).sql; }
ok('3) la PK de actividades ahora es (programa_id, id)',
  /PRIMARY KEY\s*\(\s*programa_id\s*,\s*id\s*\)/i.test(pkDe(db, 'mp_sve_plan_actividades')));
ok('3) la PK de casos ahora es (programa_id, id)',
  /PRIMARY KEY\s*\(\s*programa_id\s*,\s*id\s*\)/i.test(pkDe(db, 'mp_sve_casos')));
ok('3) los indicadores tienen anios_json y medidas_json',
  /anios_json/.test(pkDe(db, 'mp_sve_indicadores')) && /medidas_json/.test(pkDe(db, 'mp_sve_indicadores')));

// Un SEGUNDO programa puede usar los mismos ids.
let colision = null;
try {
  db.prepare('INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('act-1', 'pg-B', 'tempo', 'hacer', 'Actividad 1 del 2026', 'Empresa', 1, T, T);
  db.prepare("INSERT INTO mp_sve_casos (id, programa_id, empresa_id, orden, trabajador, creado_en, actualizado_en) VALUES (?,?,?,?,?,?,?)")
    .run('1', 'pg-B', 'tempo', 1, 'CASO 1 del 2026', T, T);
} catch (e) { colision = e.message; }
ok('4) un SEGUNDO programa puede usar "act-1" y el caso "1" sin chocar', colision === null, colision || 'sin colision');
ok('4) y cada programa ve solo lo suyo (19 y 1)',
  db.prepare('SELECT COUNT(*) n FROM mp_sve_plan_actividades WHERE programa_id=?').get('pg-A').n === 19 &&
  db.prepare('SELECT COUNT(*) n FROM mp_sve_plan_actividades WHERE programa_id=?').get('pg-B').n === 1 &&
  db.prepare('SELECT COUNT(*) n FROM mp_sve_casos WHERE programa_id=?').get('pg-B').n === 1);

// Correrla dos veces no rompe nada (base a medias).
let segunda = 'ok';
try { SCHEMA.aplicarMigracionesMedprevSve(db, {}); } catch (e) { segunda = e.message; }
ok('5) se puede volver a correr sin romper (base a medias)', segunda === 'ok', segunda);
ok('5) y sigue habiendo lo mismo de pg-A (19 actividades y 228 meses)',
  db.prepare('SELECT COUNT(*) n FROM mp_sve_plan_actividades WHERE programa_id=?').get('pg-A').n === 19 &&
  db.prepare('SELECT COUNT(*) n FROM mp_sve_plan_meses WHERE programa_id=?').get('pg-A').n === 228,
  db.prepare('SELECT COUNT(*) n FROM mp_sve_plan_meses WHERE programa_id=?').get('pg-A').n + '');

// =====================================================================
// 2) La espina de los indicadores se rellena desde los valores
// =====================================================================
const db2 = esquemaViejo(new Database(':memory:'));
db2.prepare("INSERT INTO mp_sve_indicadores (id, programa_id, empresa_id, clave, nombre, meta, formulacion, periodicidad, actualizado_en) " +
  "VALUES ('msi-1','pg-A','tempo','prevalencia','Prevalencia COVID-19','<10%','F','ANUAL',?)").run(T);
const insVal = db2.prepare('INSERT INTO mp_sve_indicadores_valores (indicador_id, programa_id, anio, medida, valor) VALUES (?,?,?,?,?)');
[[2020, 'casos', 4], [2020, 'promedio', 159.5], [2021, 'casos', 6], [2021, 'promedio', 136],
 [2022, 'casos', 3], [2022, 'promedio', 160.2], [2023, 'casos', 2], [2023, 'promedio', 170],
 [2024, 'casos', 2], [2024, 'promedio', 148]].forEach(v => insVal.run('msi-1', 'pg-A', v[0], v[1], v[2]));
SCHEMA.aplicarMigracionesMedprevSve(db2, {});
const filaInd = db2.prepare('SELECT anios_json, medidas_json FROM mp_sve_indicadores WHERE id=?').get('msi-1');
let aniosInd = [], medidasInd = [];
try { aniosInd = JSON.parse(filaInd.anios_json); } catch (e) { /* se reporta abajo */ }
try { medidasInd = JSON.parse(filaInd.medidas_json); } catch (e) { /* se reporta abajo */ }
ok('6) la migracion rellena la espina de anios del indicador',
  aniosInd.length === 5 && aniosInd[0] === 2020 && aniosInd[4] === 2024, JSON.stringify(aniosInd));
ok('6) y la lista de medidas (las dos que tenia)',
  medidasInd.length === 2 && medidasInd.indexOf('casos') !== -1 && medidasInd.indexOf('promedio') !== -1,
  JSON.stringify(medidasInd));

// =====================================================================
// 3) LA GUARDA CONTRA SÍ MISMA: el camino viejo perdía filas
//    Si esto dejara de perdirlas, el test de arriba volvería a ser decorado.
// =====================================================================
const db3 = esquemaViejo(new Database(':memory:'));
llenar(db3);
const mesesAntes = cuenta(db3, 'mp_sve_plan_meses');
SCHEMA.MP_SVE_MIGRATIONS_SQL.forEach(sql => db3.exec(sql));   // FKs prendidas, sin apagar
const mesesDespues = cuenta(db3, 'mp_sve_plan_meses');
ok('7) SIN apagar las FKs, el SQL suelto BORRA los meses (por eso hace falta apagarlas)',
  mesesAntes === 228 && mesesDespues === 0,
  'antes=' + mesesAntes + ' despues=' + mesesDespues);
ok('7) y con la función compartida NO se borran (mismo SQL, FKs apagadas)',
  (function () {
    const d = esquemaViejo(new Database(':memory:'));
    llenar(d);
    SCHEMA.aplicarMigracionesMedprevSve(d, {});
    return cuenta(d, 'mp_sve_plan_meses') === 228;
  })(), 'control');

let failed = 0;
console.log('\n=======================================');
console.log('  📦827-fix-2 · La migracion no puede perder datos');
console.log('=======================================');
checks.forEach(c => {
  if (!c.ok) failed++;
  console.log((c.ok ? 'OK   ' : 'FAIL ') + c.name + (c.extra ? '  [' + c.extra + ']' : ''));
});
console.log('---');
console.log((checks.length - failed) + '/' + checks.length + ' OK');
console.log('=======================================');
process.exit(failed === 0 ? 0 : 1);
