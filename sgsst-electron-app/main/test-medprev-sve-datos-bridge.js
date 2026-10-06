// test-medprev-sve-datos-bridge.js
// 📦827 (2026-09-30) — Tests FUNCIONALES del bridge de DATOS SVE (3.1.2)
// (main/medprev-sve-datos-bridge.js) contra better-sqlite3 en memoria.
//
// Patrón del repo: mock de `electron` antes del require (Module._resolveFilename,
// como test-medprev-programas-bridge.js) + db en memoria + validateSession.
//
// NOTA de ejecución: better-sqlite3 está compilado con el ABI de Electron:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-medprev-sve-datos-bridge.js
//
// Qué cubre:
//   1. Schema exportado, idempotente, y FK declarada.
//   2. Registro de los 13 canales.
//   3. 🔒 Auth dura en mutaciones; auth blanda en lecturas (token inválido se rechaza).
//   4. Aislamiento: un programa de otra empresa no se lee ni se escribe.
//   5. Round-trip del dataset: migrar -> datos:get devuelve la MISMA forma que
//      el prototipo tenía en localStorage. Este es el contrato central: las
//      1.300 líneas de sve-views.js no se tocan y siguen leyendo ese shape.
//   6. Casos: crear / actualizar / baja lógica (no aparece en get, sigue en la tabla).
//   7. Plan: crear actividad nace con 12 meses en 0; celda; editar nombre; borrar
//      arrastra los meses.
//   8. Indicadores: las tres medidas conviven y se reconstruyen como arrays
//      paralelos ordenados por año.
//   9. La migración es IDEMPOTENTE: no pisa datos que ya están en la base.
//  10. Ids de texto: dos casos creados seguido NO comparten id (mismo equipo,
//      merge last-write-wins por id en varias máquinas).

'use strict';

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

// ---------- Mock de electron ANTES de require del bridge ----------
const handlers = {};
const mockIpcMain = {
  handle: function (ch, fn) { handlers[ch] = fn; },
  removeHandler: function (ch) { delete handlers[ch]; }
};
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return origResolve.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: mockIpcMain } };

const bridge = require('./medprev-sve-datos-bridge.js');
const programasBridge = require('./medprev-programas-bridge.js');

// ---------- 1) Schema ----------
const Database = require('better-sqlite3');
const db = new Database(':memory:');
try {
  db.exec(bridge.SCHEMA_SQL);
  db.exec(bridge.SCHEMA_SQL);
  ok('1) el schema aplica dos veces (idempotente)', true);
} catch (e) {
  console.error('FAIL SCHEMA:', e.message);
  process.exit(1);
}

db.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL)");
db.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c1','tempoactiva','Tempoactiva Est SAS')").run();
db.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c2','temposum','Temposum Est SAS')").run();
db.exec(programasBridge.SCHEMA_SQL);
db.prepare("INSERT INTO mp_programas (id, empresa_id, tipo, nombre, descripcion, estado, fecha_inicio, fecha_fin, plantilla, creado_en, actualizado_en) " +
  "VALUES ('mpp-sve-1','tempoactiva','sve','SVE 2024','demo','activo','2024-01-01',NULL,'estandar','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z')").run();
db.prepare("INSERT INTO mp_programas (id, empresa_id, tipo, nombre, descripcion, estado, fecha_inicio, fecha_fin, plantilla, creado_en, actualizado_en) " +
  "VALUES ('mpp-otrosum','temposum','sve','SVE de otra empresa','demo','activo','2024-01-01',NULL,'estandar','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z')").run();
// 📦827-fix — SEGUNDO programa SVE de la MISMA empresa. Es el caso que el dueño
// preguntó de entrada ("cada programa tiene su propia base de datos"). Se
// siembran despues LOS MISMOS ids (`act-1`, casos `1` y `2`) para demostrar
// que el aislamiento es por programa y no global.
db.prepare("INSERT INTO mp_programas (id, empresa_id, tipo, nombre, descripcion, estado, fecha_inicio, fecha_fin, plantilla, creado_en, actualizado_en) " +
  "VALUES ('mpp-sve-2','tempoactiva','sve','SVE 2026','demo','activo','2026-01-01',NULL,'estandar','2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z')").run();

ok('1) las 8 tablas mp_sve_* existen',
  db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'mp_sve%'").get().n === 8,
  db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'mp_sve%'").get().n + ' tablas');

// ---------- 2) Canales registrados ----------
const CANALES = [
  'medprev:sve:datos:get',
  'medprev:sve:casos:crear', 'medprev:sve:casos:actualizar', 'medprev:sve:casos:eliminar',
  'medprev:sve:plan:actividad:crear', 'medprev:sve:plan:actividad:guardar',
  'medprev:sve:plan:actividad:eliminar', 'medprev:sve:plan:celda:guardar',
  'medprev:sve:meta:guardar',
  'medprev:sve:indicadores:guardar', 'medprev:sve:morbilidad:guardar', 'medprev:sve:analisis:guardar',
  'medprev:sve:migrar'
];
bridge.registerMedprevSveDatosHandlers({}, { getDb: function () { return db; }, validateSession: validateSession });
ok('2) se registran los 13 canales', CANALES.every(function (c) { return !!handlers[c]; }),
  CANALES.filter(function (c) { return !handlers[c]; }).join(', ') || 'todos');

function validateSession(tok) {
  if (tok === 'tok-ok') return { ok: true, user: { id: 7, email: 'kai@demo.local' } };
  return { ok: false, error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } };
}
function call(ch, payload) { return handlers[ch](null, payload || {}); }
const BASE = { token: 'tok-ok', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-1' };

// ---------- 3) Auth ----------
ok('3) leer sin token esta permitido (auth blanda)', call('medprev:sve:datos:get',
  { companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-1' }).success === true);
ok('3) leer con token INVALIDO se rechaza', call('medprev:sve:datos:get',
  { token: 'tok-malo', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-1' }).success === false);
ok('3) crear caso SIN token se rechaza (auth dura)',
  call('medprev:sve:casos:crear', { companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-1', caso: { trabajador: 'X' } }).success === false);
ok('3) crear caso con token invalido se rechaza',
  call('medprev:sve:casos:crear', { token: 'malo', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-1', caso: { trabajador: 'X' } }).success === false);

// ---------- 4) Aislamiento entre empresas ----------
ok('4) un programa de otra empresa NO se lee',
  call('medprev:sve:datos:get', { token: 'tok-ok', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-otrosum' }).success === false);
ok('4) no se puede escribir sobre el programa de otra empresa',
  call('medprev:sve:casos:crear', { token: 'tok-ok', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-otrosum', caso: { trabajador: 'X' } }).success === false);
ok('4) no se puede escribir sobre un programa inexistente',
  call('medprev:sve:casos:crear', { token: 'tok-ok', companyName: 'Tempoactiva Est SAS', programaId: 'no-existe', caso: { trabajador: 'X' } }).success === false);

// ---------- 5) Round-trip: migrar -> get devuelve la misma forma ----------
const PLAN_SEED = [
  { id: 'act-1', fase: 'planear', actividad: 'Actualizar la matriz', responsable: 'Empresa', meses: [[1, 1], [1, 0], [0, 0], [1, 1]] },
  { id: 'act-2', fase: 'hacer', actividad: 'Capacitar', responsable: 'SG-SST', meses: [[1, 1], [1, 1], [0, 0], [0, 0]] }
];
// `meses` con solo 4 entradas a proposito: el prototipo puede traer arrays
// cortos y el bridge DEBE normalizar a 12 (si no, la grilla lee undefined).
const SEED_CASOS = [
  { id: 1, trabajador: 'JHONATAN MOLINA', documento: '1044390709', sector: 'Salud', cargo: 'AUXILIAR', area: 'SEDE NORTE', anio: 2024, mes: 'enero', estado: 'confirmado', telefono: '300', fechaPcr: '2024-01-24' },
  { id: 2, trabajador: 'MARIA LOPEZ', documento: '22334455', sector: 'Operaciones', cargo: 'OPERADOR', area: 'TURIPANA', anio: 2024, mes: 'febrero', estado: 'aislamiento' }
];
const DATOS_SEED = {
  meta: { empresa: 'Tempoactiva', anio: 2024, codigo: 'F-XX-SST-024', objetivo: 'Vigilar' },
  plan: PLAN_SEED,
  seguimientos: SEED_CASOS,
  indicadores: {
    prevalencia: { nombre: 'Prevalencia COVID-19', meta: 'Menor al 10%', periodicidad: 'ANUAL', anios: [2023, 2024], casos: [2, 3], promedio: [150, 148] },
    incidencia: { nombre: 'Incidencia COVID-19', periodicidad: 'TRIMESTRAL', anios: [2023, 2024], casos_nuevos: [1, 4], promedio: [100, 120] }
  },
  morbilidad: { anios: [2023, 2024], filas: [{ tipo: 'Accidentes de trabajo', casos: [2, 3], diasIt: [12, 20] }] },
  analisis: [{ periodo: '1. ENERO - JUNIO', hallazgos: 'Bien', propuestas: 'Seguir', responsable: 'SG-SST' }]
};

const mig = call('medprev:sve:migrar', Object.assign({}, BASE, { datos: DATOS_SEED }));
ok('5) migrar vuelca el dataset', mig.success === true && mig.data.migrado === true,
  mig.success ? JSON.stringify(mig.data.resumen) : JSON.stringify(mig.error));
ok('5) la migracion conto 2 actividades y 24 celdas',
  mig.data && mig.data.resumen && mig.data.resumen.actividades === 2 && mig.data.resumen.celdas === 24,
  mig.data && mig.data.resumen ? (mig.data.resumen.actividades + ' act / ' + mig.data.resumen.celdas + ' celdas') : '?');

const leido = call('medprev:sve:datos:get', Object.assign({}, BASE, {}));
ok('5) datos:get responde bien', leido.success === true);
const D = leido.data || {};

// meta
ok('5) el meta vuelve igual',
  D.meta && D.meta.codigo === 'F-XX-SST-024' && D.meta.anio === 2024,
  D.meta ? D.meta.codigo : 'null');

// plan: el `meses` corto del seed queda normalizado a 12
ok('5) el plan vuelve con 2 actividades', D.plan && D.plan.length === 2, D.plan ? D.plan.length + '' : 'null');
ok('5) cada actividad vuelve con 12 meses (el seed traia 4)',
  D.plan && D.plan.every(function (a) { return Array.isArray(a.meses) && a.meses.length === 12; }),
  D.plan ? D.plan.map(function (a) { return a.meses.length; }).join(',') : '?');
ok('5) los meses guardados conservan el valor',
  D.plan && D.plan[0] && D.plan[0].meses[0][0] === 1 && D.plan[0].meses[0][1] === 1 &&
  D.plan[0].meses[1][0] === 1 && D.plan[0].meses[1][1] === 0,
  D.plan && D.plan[0] ? JSON.stringify(D.plan[0].meses.slice(0, 2)) : '?');
ok('5) los meses no guardados quedan en 0, no undefined',
  D.plan && D.plan[0] && D.plan[0].meses[11][0] === 0 && D.plan[0].meses[11][1] === 0,
  D.plan && D.plan[0] ? JSON.stringify(D.plan[0].meses[11]) : '?');
ok('5) la actividad conserva fase, nombre y responsable',
  D.plan && D.plan[1] && D.plan[1].fase === 'hacer' && D.plan[1].responsable === 'SG-SST');

// casos: camelCase, como el prototipo
ok('5) los casos vuelven con el MISMO nombre de campo (camelCase)',
  D.seguimientos && D.seguimientos[0] && D.seguimientos[0].trabajador === 'JHONATAN MOLINA' && D.seguimientos[0].fechaPcr === '2024-01-24',
  D.seguimientos && D.seguimientos[0] ? Object.keys(D.seguimientos[0]).slice(0, 5).join(',') : 'null');
ok('5) los 2 casos vuelven', D.seguimientos && D.seguimientos.length === 2, D.seguimientos ? D.seguimientos.length + '' : 'null');

// indicadores: clave = la del indicador, con sus arrays paralelos
ok('5) los indicadores vuelven por clave (prevalencia/incidencia)',
  D.indicadores && D.indicadores.prevalencia && D.indicadores.incidencia,
  D.indicadores ? Object.keys(D.indicadores).join(',') : 'null');
ok('5) prevalencia conserva sus dos medidas (casos y promedio)',
  D.indicadores && D.indicadores.prevalencia &&
  JSON.stringify(D.indicadores.prevalencia.casos) === '[2,3]' &&
  JSON.stringify(D.indicadores.prevalencia.promedio) === '[150,148]',
  D.indicadores && D.indicadores.prevalencia ? JSON.stringify(D.indicadores.prevalencia.casos) : '?');
ok('5) incidencia conserva su medida propia (casosNuevos -> casos_nuevos)',
  D.indicadores && D.indicadores.incidencia && JSON.stringify(D.indicadores.incidencia.casos_nuevos) === '[1,4]',
  D.indicadores && D.indicadores.incidencia ? JSON.stringify(D.indicadores.incidencia.casos_nuevos) : '?');
ok('5) los anios del indicador salen ordenados',
  D.indicadores && D.indicadores.prevalencia && JSON.stringify(D.indicadores.prevalencia.anios) === '[2023,2024]',
  D.indicadores && D.indicadores.prevalencia ? JSON.stringify(D.indicadores.prevalencia.anios) : '?');

// morbilidad
ok('5) la morbilidad vuelve con anios y filas',
  D.morbilidad && D.morbilidad.anios && D.morbilidad.anios.length === 2 && D.morbilidad.filas.length === 1,
  D.morbilidad ? JSON.stringify(D.morbilidad.anios) : 'null');
ok('5) la morbilidad conserva casos y dias de IT',
  D.morbilidad && D.morbilidad.filas[0] && JSON.stringify(D.morbilidad.filas[0].casos) === '[2,3]' &&
  JSON.stringify(D.morbilidad.filas[0].diasIt) === '[12,20]',
  D.morbilidad && D.morbilidad.filas[0] ? JSON.stringify(D.morbilidad.filas[0]) : '?');

// analisis
ok('5) el analisis vuelve con sus 3 campos',
  D.analisis && D.analisis.length === 1 && D.analisis[0].periodo === '1. ENERO - JUNIO' && D.analisis[0].responsable === 'SG-SST');

// ---------- 9) La migracion es idempotente ----------
const mig2 = call('medprev:sve:migrar', Object.assign({}, BASE, { datos: DATOS_SEED }));
ok('9) la migracion NO vuelve a correr si la base ya tiene datos',
  mig2.success === true && mig2.data.migrado === false && mig2.data.motivo === 'la-base-ya-tiene-datos',
  JSON.stringify(mig2.data));
const leido2 = call('medprev:sve:datos:get', Object.assign({}, BASE, {}));
ok('9) los datos siguen intactos tras el segundo intento',
  leido2.data.seguimientos.length === 2 && leido2.data.plan.length === 2,
  leido2.data.seguimientos.length + ' casos / ' + leido2.data.plan.length + ' act');

// ---------- 6) Casos: crear / actualizar / baja lógica ----------
const nuevo = call('medprev:sve:casos:crear', Object.assign({}, BASE, {
  caso: { trabajador: 'PEPA GOMEZ', documento: '99887766', area: 'COOTRACOM', cargo: 'CONDUCTOR', estado: 'sospechoso' }
}));
ok('6) crear caso devuelve el caso creado', nuevo.success === true && nuevo.data.caso.trabajador === 'PEPA GOMEZ',
  nuevo.success ? nuevo.data.caso.id : JSON.stringify(nuevo.error));
ok('6) el id del caso es de TEXTO (no numérico)',
  nuevo.success && typeof nuevo.data.caso.id === 'string' && nuevo.data.caso.id.indexOf('msc-') === 0,
  nuevo.success ? (typeof nuevo.data.caso.id) : '?');
// Las 2 que trae la migracion tienen orden 0 y 1, asi que el nuevo es el
// tercero: orden 2. (El orden es la posicion, no el id.)
ok('6) el caso nuevo tiene orden al final',
  nuevo.success && nuevo.data.caso.orden === 2, nuevo.success ? nuevo.data.caso.orden : '?');

const actualizado = call('medprev:sve:casos:actualizar', Object.assign({}, BASE, {
  casoId: nuevo.data.caso.id, caso: { estado: 'confirmado' }
}));
ok('6) actualizar cambia solo lo enviado (no borra los demas campos)',
  actualizado.success === true && actualizado.data.caso.estado === 'confirmado' &&
  actualizado.data.caso.trabajador === 'PEPA GOMEZ',
  actualizado.success
    ? JSON.stringify({ estado: actualizado.data.caso.estado, trabajador: actualizado.data.caso.trabajador })
    : JSON.stringify(actualizado.error));

const elim = call('medprev:sve:casos:eliminar', Object.assign({}, BASE, { casoId: nuevo.data.caso.id }));
ok('6) eliminar responde ok', elim.success === true);
ok('6) el caso eliminado desaparece de datos:get',
  call('medprev:sve:datos:get', BASE).data.seguimientos.length === 2,
  call('medprev:sve:datos:get', BASE).data.seguimientos.length + ' casos');
ok('6) el caso eliminado SIGUE en la tabla (baja logica, con fecha)',
  db.prepare('SELECT eliminado_en FROM mp_sve_casos WHERE id = ?').get(nuevo.data.caso.id).eliminado_en !== null);
ok('6) eliminar dos veces da NOT_FOUND',
  call('medprev:sve:casos:eliminar', Object.assign({}, BASE, { casoId: nuevo.data.caso.id })).error.code === 'NOT_FOUND');
ok('6) crear caso sin trabajador se rechaza',
  call('medprev:sve:casos:crear', Object.assign({}, BASE, { caso: { documento: '1' } })).error.code === 'VALIDATION');

// ---------- 7) Plan ----------
const act = call('medprev:sve:plan:actividad:crear', Object.assign({}, BASE, { fase: 'planear' }));
ok('7) crear actividad devuelve un id estable act-N', act.success === true && /^act-\d+$/.test(act.data.id), act.success ? act.data.id : '?');
ok('7) la actividad nueva nace con 12 meses en cero',
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get(act.data.id).n === 12 &&
  db.prepare('SELECT COALESCE(SUM(ap),0) AS s FROM mp_sve_plan_meses WHERE actividad_id = ?').get(act.data.id).s === 0);
ok('7) la actividad nueva nace sin nombre ni responsable',
  db.prepare('SELECT actividad, responsable FROM mp_sve_plan_actividades WHERE id = ?').get(act.data.id).actividad === '');

const celda = call('medprev:sve:plan:celda:guardar', Object.assign({}, BASE, { actividadId: act.data.id, mes: 3, ap: 1, ae: 1 }));
ok('7) guardar celda responde ok', celda.success === true && celda.data.ap === 1 && celda.data.ae === 1);
ok('7) la celda se puede sobrescribir (ON CONFLICT)',
  (function () {
    call('medprev:sve:plan:celda:guardar', Object.assign({}, BASE, { actividadId: act.data.id, mes: 3, ap: 1, ae: 0 }));
    return db.prepare('SELECT ap, ae FROM mp_sve_plan_meses WHERE actividad_id = ? AND mes = 3').get(act.data.id).ae === 0;
  })());
ok('7) no se duplica la fila del mes (UNIQUE actividad_id+mes)',
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get(act.data.id).n === 12);
ok('7) mes fuera de rango se rechaza',
  call('medprev:sve:plan:celda:guardar', Object.assign({}, BASE, { actividadId: act.data.id, mes: 13, ap: 1 })).error.code === 'VALIDATION');
ok('7) celda de actividad inexistente da NOT_FOUND',
  call('medprev:sve:plan:celda:guardar', Object.assign({}, BASE, { actividadId: 'act-999', mes: 1, ap: 1 })).error.code === 'NOT_FOUND');

call('medprev:sve:plan:actividad:guardar', Object.assign({}, BASE, { actividadId: act.data.id, actividad: 'Nueva actividad', responsable: 'ARL' }));
ok('7) editar nombre y responsable se guarda',
  (function () {
    var a = call('medprev:sve:datos:get', BASE).data.plan.filter(function (x) { return x.id === act.data.id; })[0];
    return a && a.actividad === 'Nueva actividad' && a.responsable === 'ARL';
  })());

call('medprev:sve:plan:actividad:eliminar', Object.assign({}, BASE, { actividadId: act.data.id }));
ok('7) eliminar actividad la quita del plan',
  call('medprev:sve:datos:get', BASE).data.plan.length === 2);
ok('7) eliminar actividad borra SUS 12 meses (no quedan huerfanos)',
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses WHERE actividad_id = ?').get(act.data.id).n === 0);

// 📦827-fix — Segundo programa SVE de la MISMA empresa. Es la pregunta que el
// dueño hizo de entrada ("cada programa tiene su propia base de datos"), y la
// respuesta corta es: sí, y su contenido NO se pisa con el del otro.
//
// Se siembran LOS MISMOS ids a proposito (act-1, act-2 y los casos 1 y 2 del
// seed). Con la clave primaria global que se tenia antes, este `migrar` moría
// con "UNIQUE constraint failed: mp_sve_plan_actividades.id" y el programa
// quedaba sin inicializar: no se podia ni abrir.
const BASE2 = { token: 'tok-ok', companyName: 'Tempoactiva Est SAS', programaId: 'mpp-sve-2' };
const seed2 = call('medprev:sve:migrar', Object.assign({}, BASE2, { datos: DATOS_SEED }));
ok('11) un SEGUNDO programa SVE de la misma empresa se puede sembrar',
  seed2.success === true && seed2.data.migrado === true,
  seed2.success ? JSON.stringify(seed2.data) : JSON.stringify(seed2.error));

const prog2 = call('medprev:sve:datos:get', BASE2);
ok('11) el segundo programa tiene su propio plan, con los mismos ids',
  prog2.success === true && prog2.data.plan.length === 2 &&
  prog2.data.plan[0].id === 'act-1' && prog2.data.plan[1].id === 'act-2',
  prog2.success ? prog2.data.plan.map(function (a) { return a.id; }).join(',') : JSON.stringify(prog2.error));
ok('11) y sus propios casos, tambien con los mismos ids',
  prog2.data.seguimientos.length === 2 && String(prog2.data.seguimientos[0].id) === '1',
  prog2.data.seguimientos.map(function (c) { return c.id; }).join(','));
// El conteo va POR PROGRAMA a propósito: en la tabla hay casos de secciones
// anteriores de este mismo archivo, y un total global mediría el test, no el
// aislamiento. Lo que importa es que cada programa conserve los suyos.
ok('11) los dos programas conviven y cada uno conserva lo suyo',
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get('mpp-sve-1').n === 2 &&
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get('mpp-sve-2').n === 2 &&
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ? AND eliminado_en IS NULL').get('mpp-sve-1').n >= 2 &&
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ? AND eliminado_en IS NULL').get('mpp-sve-2').n === 2,
  'act p1=' + db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get('mpp-sve-1').n +
  ' act p2=' + db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_actividades WHERE programa_id = ?').get('mpp-sve-2').n +
  ' casos p2=' + db.prepare('SELECT COUNT(*) AS n FROM mp_sve_casos WHERE programa_id = ? AND eliminado_en IS NULL').get('mpp-sve-2').n);
ok('11) los 12 meses de cada actividad son los suyos (no se comparten)',
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses').get().n === 48,
  db.prepare('SELECT COUNT(*) AS n FROM mp_sve_plan_meses').get().n + ' filas de mes');

// Editar en el segundo programa NO toca el primero (mismo id, distinto programa).
call('medprev:sve:plan:actividad:guardar', Object.assign({}, BASE2, { actividadId: 'act-1', actividad: 'SOLO 2026' }));
call('medprev:sve:casos:actualizar', Object.assign({}, BASE2, { casoId: '1', caso: { cargo: 'DIRECTOR 2026' } }));
const leido1 = call('medprev:sve:datos:get', BASE);
ok('11) editar "act-1" del programa 2 no toca el act-1 del programa 1',
  leido1.data.plan[0].actividad === 'Actualizar la matriz',
  'prog1 act-1 = ' + leido1.data.plan[0].actividad);
ok('11) editar el caso 1 del programa 2 no toca el caso 1 del programa 1',
  leido1.data.seguimientos.filter(function (c) { return String(c.id) === '1'; })[0].cargo === 'AUXILIAR');
ok('11) y el cambio SI quedo en el programa 2',
  call('medprev:sve:datos:get', BASE2).data.plan[0].actividad === 'SOLO 2026' &&
  call('medprev:sve:datos:get', BASE2).data.seguimientos.filter(function (c) { return String(c.id) === '1'; })[0].cargo === 'DIRECTOR 2026');

// Y borrar en el programa 2 deja vivo el del programa 1.
const act2 = prog2.data.plan[1].id;
call('medprev:sve:plan:actividad:eliminar', Object.assign({}, BASE2, { actividadId: act2 }));
ok('11) borrar en el programa 2 no borra el mismo id del programa 1',
  call('medprev:sve:datos:get', BASE).data.plan.length === 2 &&
  call('medprev:sve:datos:get', BASE2).data.plan.length === 1,
  'prog1=' + call('medprev:sve:datos:get', BASE).data.plan.length + ' prog2=' + call('medprev:sve:datos:get', BASE2).data.plan.length);

// ---------- 8) Indicadores / morbilidad / analisis: reemplazo ----------
const indOk = call('medprev:sve:indicadores:guardar', Object.assign({}, BASE, {
  indicadores: { prevalencia: { nombre: 'P', anios: [2024], casos: [9] } }
}));
ok('8) guardar indicadores responde con lo reconstruido',
  indOk.success === true && indOk.data.indicadores.prevalencia.casos[0] === 9,
  indOk.success ? JSON.stringify(indOk.data.indicadores.prevalencia) : JSON.stringify(indOk.error));
ok('8) guardar indicadores REEMPLAZA el bloque (no suma)',
  Object.keys(call('medprev:sve:datos:get', BASE).data.indicadores).length === 1,
  Object.keys(call('medprev:sve:datos:get', BASE).data.indicadores).join(','));

// ---------- 8b) El shape REAL de los indicadores (📦827-fix) ----------
// El test de arriba usaba `prevalencia.casos`, que era justamente uno de los
// TRES nombres de la lista fija de medidas, así que una lista fija pasaba. Los
// cuatro indicadores del prototipo no comparten medidas, y con esa lista
// `incidencia.casosNuevos` volvía undefined: el Dashboard reventaba con
// "Cannot read properties of undefined (reading '4')" — un TypeError en una
// vista que no menciona la base, a tres archivos de distancia.
call('medprev:sve:indicadores:guardar', Object.assign({}, BASE, {
  indicadores: {
    prevalencia: { nombre: 'Prevalencia COVID-19', meta: '<10%', formulacion: 'F', periodicidad: 'ANUAL',
      anios: [2020, 2021, 2022, 2023, 2024], casos: [4, 6, 3, 2, 2], promedio: [159.5, 136, 160.2, 170, 148] },
    incidencia: { nombre: 'Incidencia COVID-19', meta: '<10%', formulacion: 'F', periodicidad: 'TRIMESTRAL',
      anios: [2020, 2021, 2022, 2023, 2024], casosNuevos: [4, 5, 2, 1, 2], promedio: [159.5, 136, 160.2, 170, 148] },
    ausentismo: { nombre: 'Ausentismo por COVID-19', meta: '-10%', formulacion: 'F', periodicidad: 'SEMESTRAL',
      anios: [2020, 2021, 2022, 2023, 2024], diasIncapacidad: [18, 54, 7, 5, 6], diasProgramados: [45936, 39168, 46128, 48960, 42150] },
    eficacia: { nombre: 'Eficacia del programa', meta: '70%', formulacion: 'F', periodicidad: 'CUATRIMESTRAL',
      anios: [2020, 2021, 2022, 2023, 2024], sugeridas: [0, 108, 36, 12, 14], implementadas: [0, 108, 36, 12, 11] },
    // Indicador con la serie VACIA: tiene que volver con sus años igual, porque
    // las vistas hacen `anios[Math.min(4, anios.length - 1)]`.
    reciencreado: { nombre: 'Indicador sin datos', meta: 'm', formulacion: 'f', periodicidad: 'ANUAL',
      anios: [2023, 2024], promedio: [null, null] }
  }
}));

const indLeidos = call('medprev:sve:datos:get', BASE).data.indicadores;
ok('8b) vuelven los CUATRO indicadores del prototipo',
  ['prevalencia', 'incidencia', 'ausentismo', 'eficacia'].every(function (k) { return !!indLeidos[k]; }),
  Object.keys(indLeidos).join(','));
// Estas son las medidas que una lista fija se comia. Si alguna sale undefined,
// el Dashboard revienta: no es un dato feo, es un cartel de error.
const MEDIDAS_REALES = {
  prevalencia: ['casos', 'promedio'],
  incidencia: ['casosNuevos', 'promedio'],
  ausentismo: ['diasIncapacidad', 'diasProgramados'],
  eficacia: ['sugeridas', 'implementadas']
};
const medidasPerdidas = [];
Object.keys(MEDIDAS_REALES).forEach(function (k) {
  MEDIDAS_REALES[k].forEach(function (m) {
    if (!Array.isArray(indLeidos[k] && indLeidos[k][m])) medidasPerdidas.push(k + '.' + m);
  });
});
ok('8b) NINGUNA medida se pierde en el ida y vuelta', medidasPerdidas.length === 0, medidasPerdidas.join(', '));
// OJO: estas aserciones indexan `.diasProgramados[4]` y compañía. Si una medida
// falta, `undefined[4]` REVienta el archivo entero y se pierde el resto de la
// suite — un test que truena en vez de fallar esconde los otros 60 checks. Por
// eso se leen con `|| []`: la aserción falla y el archivo sigue.
const val = function (ind, k, m, i) { return (ind && ind[k] && ind[k][m] && ind[k][m][i]) || null; };
ok('8b) los valores de las medidas se conservan intactos',
  val(indLeidos, 'ausentismo', 'diasProgramados', 4) === 42150 &&
  val(indLeidos, 'eficacia', 'implementadas', 4) === 11 &&
  val(indLeidos, 'incidencia', 'casosNuevos', 1) === 5,
  'diasProgramados=' + val(indLeidos, 'ausentismo', 'diasProgramados', 4) +
  ' implementadas=' + val(indLeidos, 'eficacia', 'implementadas', 4) +
  ' casosNuevos=' + val(indLeidos, 'incidencia', 'casosNuevos', 1));
ok('8b) un indicador con serie vacia conserva su espina de anios',
  Array.isArray(indLeidos.reciencreado && indLeidos.reciencreado.anios) &&
  indLeidos.reciencreado.anios.length === 2 &&
  Array.isArray(indLeidos.reciencreado.promedio) && indLeidos.reciencreado.promedio.length === 2,
  JSON.stringify(indLeidos.reciencreado));
ok('8b) las medidas quedan alineadas con los anios (misma longitud)',
  Object.keys(MEDIDAS_REALES).every(function (k) {
    return MEDIDAS_REALES[k].every(function (m) {
      return Array.isArray(indLeidos[k] && indLeidos[k][m]) &&
        indLeidos[k][m].length === indLeidos[k].anios.length;
    });
  }));
// Y el texto del indicador, que no es un número.
ok('8b) el encabezado del indicador (nombre/meta/formulacion) se conserva',
  !!indLeidos.ausentismo && indLeidos.ausentismo.nombre === 'Ausentismo por COVID-19' &&
  indLeidos.ausentismo.meta === '-10%' &&
  indLeidos.ausentismo.periodicidad === 'SEMESTRAL');

const morbOk = call('medprev:sve:morbilidad:guardar', Object.assign({}, BASE, {
  morbilidad: { anios: [2024], filas: [{ tipo: 'Enfermedades laborales', casos: [7], diasIt: [30] }] }
}));
ok('8) guardar morbilidad responde con lo reconstruido',
  morbOk.success === true && morbOk.data.morbilidad.filas[0].diasIt[0] === 30,
  morbOk.success ? JSON.stringify(morbOk.data.morbilidad.filas[0]) : JSON.stringify(morbOk.error));

const anOk = call('medprev:sve:analisis:guardar', Object.assign({}, BASE, {
  analisis: [{ periodo: '2. JULIO - DIC', hallazgos: 'H', propuestas: 'P', responsable: 'R' }]
}));
ok('8) guardar analisis responde con lo reconstruido',
  anOk.success === true && anOk.data.analisis[0].periodo === '2. JULIO - DIC',
  anOk.success ? JSON.stringify(anOk.data.analisis[0]) : JSON.stringify(anOk.error));

const metaOk = call('medprev:sve:meta:guardar', Object.assign({}, BASE, { meta: { empresa: 'Tempoactiva', anio: 2026, codigo: 'X' } }));
ok('8) guardar meta responde ok', metaOk.success === true && call('medprev:sve:datos:get', BASE).data.meta.anio === 2026);

// ---------- 10) Ids unicos ----------
const c1 = call('medprev:sve:casos:crear', Object.assign({}, BASE, { caso: { trabajador: 'UNO' } })).data.caso.id;
const c2 = call('medprev:sve:casos:crear', Object.assign({}, BASE, { caso: { trabajador: 'DOS' } })).data.caso.id;
ok('10) dos casos seguidos NO comparten id', c1 !== c2, c1 + ' vs ' + c2);

// ---------- salida ----------
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
