// test-medprev-programas-bridge.js
// 📦825 (2026-09-29) — Tests FUNCIONALES del bridge de programas del 3.1.2
// (main/medprev-programas-bridge.js) contra better-sqlite3 en memoria.
//
// Patrón del repo: mock de `electron` antes del require (Module._resolveFilename,
// como test-notificaciones-bridge.js) + db en memoria + validateSession simulado.
//
// NOTA de ejecución: better-sqlite3 está compilado con el ABI de Electron, así
// que este test se corre con electron-as-node:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/electron/dist/electron.exe main/test-medprev-programas-bridge.js
//
// Que cubre:
//   1. Exportación del schema + aplicación idempotente en sqlite.
//   2. Registro de los 7 canales.
//   3. Catálogo de plantillas (SVE=6 secciones de la spec, DME=4, Promoción=5).
//   4. 🔒 Auth dura: mutaciones sin token / con token inválido → rechazadas.
//   5. create con plantilla siembra secciones; 'blanco' no siembra ninguna.
//   6. UNIQUE(empresa_id, tipo, nombre) → ALREADY_EXISTS; mismo nombre en otra línea → OK.
//   7. list con filtro por tipo y progreso calculado.
//   8. update (nombre/estado/fechas) con validaciones (estado inválido, fechas cruzadas).
//   9. seccion-estado actualiza progreso; estado inválido → VALIDATION.
//  10. delete soft: desaparece de list/get, segunda vez NOT_FOUND.
//  11. Aislamiento multi-empresa.

'use strict';

const checks = [];
function ok(name, cond, extra) { checks.push({ name: name, ok: !!cond, extra: extra }); }

// ---------- Mock de electron ANTES de require del bridge ----------
const handlers = {};
global._mockIpcMain = {
  handle: function (ch, fn) { handlers[ch] = fn; },
  removeHandler: function (ch) { delete handlers[ch]; }
};
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === 'electron') return 'electron-mock';
  return origResolve.call(this, request, ...args);
};
require.cache['electron-mock'] = { id: 'electron-mock', filename: 'electron-mock', loaded: true, exports: { ipcMain: global._mockIpcMain } };

const bridge = require('./medprev-programas-bridge.js');

// ---------- 1) Schema exportado e idempotente ----------
const Database = require('better-sqlite3');
const db = new Database(':memory:');
try {
  db.exec(bridge.SCHEMA_SQL);
  db.exec(bridge.SCHEMA_SQL); // segunda pasada: idempotente, no revienta
  ok('1) schema aplica dos veces (idempotente)', true);
} catch (e) {
  console.error('FAIL SCHEMA:', e.message);
  process.exit(1);
}

// 📦827-fix — Se crea el schema del SVE también. Sin esto, "eliminar borra el
// contenido" se probaría contra tablas que no existen: `contarSve()` daría 0
// antes y después, y la aserción pasaría sin comprobar nada.
try {
  db.exec(require('./medprev-sve-datos-schema-sql').MP_SVE_SCHEMA_SQL);
  ok('1) el schema de SVE tambien se crea (sin el, el borrado se prueba contra nada)', true);
} catch (e) {
  console.error('FAIL SCHEMA SVE:', e.message);
  process.exit(1);
}

// Empresas mínimas para _getCompanyByName (companies del main.js real).
db.exec("CREATE TABLE companies (id TEXT PRIMARY KEY, company_key TEXT NOT NULL, display_name TEXT NOT NULL)");
db.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c1','tempoactiva','Tempoactiva Est SAS')").run();
db.prepare("INSERT INTO companies (id, company_key, display_name) VALUES ('c2','temposum','Temposum Est SAS')").run();

// ---------- 2) Canales registrados ----------
const CANALES = [
  'medprev:programas:plantillas', 'medprev:programas:list', 'medprev:programas:get',
  'medprev:programas:create', 'medprev:programas:update', 'medprev:programas:delete',
  'medprev:programas:seccion-estado'
];

// validateSession simulado con la forma real de main.js ({ ok, user }).
function validateSession(tok) {
  if (tok === 'tok-ok') return { ok: true, user: { id: 7, email: 'kai@demo.local' } };
  return { ok: false, error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } };
}
bridge.registerMedprevProgramasHandlers({}, { getDb: function () { return db; }, validateSession: validateSession });

CANALES.forEach(function (ch) {
  ok('2) canal registrado: ' + ch, typeof handlers[ch] === 'function');
});

const H = handlers;

(async function main() {
  // ---------- 3) Plantillas ----------
  const pl = await H['medprev:programas:plantillas']({}, { token: 'tok-ok' });
  ok('3) plantillas ok', pl.success === true);
  // 📦826 — plantilla SVE v2: 5 secciones alineadas con la interfaz real.
  ok('3) SVE tiene 5 secciones (v2, interfaz del prototipo)', pl.data.plantillas.sve.secciones.length === 5, pl.data.plantillas.sve.secciones.length);
  ok('3) DME tiene 4 secciones', pl.data.plantillas.dme.secciones.length === 4, pl.data.plantillas.dme.secciones.length);
  ok('3) Promoción tiene 5 secciones', pl.data.plantillas.promocion.secciones.length === 5, pl.data.plantillas.promocion.secciones.length);
  ok('3) plantilla SVE v2 trae dashboard/casos/plan/indicadores/areas',
    ['dashboard', 'casos', 'plan', 'indicadores', 'areas'].every(function (c) {
      return pl.data.plantillas.sve.secciones.some(function (s) { return s.clave === c; });
    }));
  ok('3) plantilla SVE v2 ya NO trae alertas/reportes/admin/auditoria',
    !['alertas', 'reportes', 'admin', 'auditoria'].some(function (c) {
      return pl.data.plantillas.sve.secciones.some(function (s) { return s.clave === c; });
    }));

  // ---------- 4) Auth dura en mutaciones ----------
  const sinTok = await H['medprev:programas:create']({}, { companyName: 'Tempoactiva Est SAS', tipo: 'sve', nombre: 'X' });
  ok('4) create sin token rechazado', sinTok.success === false && String(sinTok.error.code).indexOf('AUTH_') === 0, sinTok.error && sinTok.error.code);
  const tokMalo = await H['medprev:programas:create']({}, { companyName: 'Tempoactiva Est SAS', tipo: 'sve', nombre: 'X', token: 'tok-malo' });
  ok('4) create con token inválido rechazado', tokMalo.success === false && String(tokMalo.error.code).indexOf('AUTH_') === 0, tokMalo.error && tokMalo.error.code);
  const delMalo = await H['medprev:programas:delete']({}, { companyName: 'Tempoactiva Est SAS', programaId: 'mpp-x', token: 'tok-malo' });
  ok('4) delete con token inválido rechazado', delMalo.success === false && String(delMalo.error.code).indexOf('AUTH_') === 0);
  const secMalo = await H['medprev:programas:seccion-estado']({}, { companyName: 'Tempoactiva', programaId: 'a', seccionId: 'b', estado: 'completo' });
  ok('4) seccion-estado sin token rechazado', secMalo.success === false && String(secMalo.error.code).indexOf('AUTH_') === 0);
  const upMalo = await H['medprev:programas:update']({}, { companyName: 'Tempoactiva', programaId: 'a', cambios: { estado: 'pausado' } });
  ok('4) update sin token rechazado', upMalo.success === false && String(upMalo.error.code).indexOf('AUTH_') === 0);

  // ---------- 5) create con plantilla / en blanco ----------
  const empresaA = 'Tempoactiva Est SAS';
  const malEmpresa = await H['medprev:programas:create']({}, { companyName: 'No Existe SA', tipo: 'sve', nombre: 'X', token: 'tok-ok' });
  ok('5) create con empresa desconocida → COMPANY_NOT_FOUND', malEmpresa.success === false && malEmpresa.error.code === 'COMPANY_NOT_FOUND');
  const malTipo = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'otro', nombre: 'X', token: 'tok-ok' });
  ok('5) create con tipo desconocido → VALIDATION', malTipo.success === false && malTipo.error.code === 'VALIDATION');
  const malFecha = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'X', fechaInicio: '01/2026', token: 'tok-ok' });
  ok('5) create con fecha malformada → VALIDATION', malFecha.success === false && malFecha.error.code === 'VALIDATION');
  const fechasCruzadas = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'X', fechaInicio: '2026-06-01', fechaFin: '2026-01-01', token: 'tok-ok' });
  ok('5) create con fechas cruzadas → VALIDATION', fechasCruzadas.success === false && fechasCruzadas.error.code === 'VALIDATION');

  const created = await H['medprev:programas:create']({}, {
    companyName: empresaA, tipo: 'sve', nombre: 'SVE COVID-19',
    descripcion: 'Vigilancia COVID', fechaInicio: '2026-01-01', fechaFin: '2026-12-31',
    usarPlantilla: true, token: 'tok-ok'
  });
  ok('5) create con plantilla ok', created.success === true, created.error && created.error.message);
  ok('5) programa queda activo con plantilla estandar', created.data.programa.estado === 'activo' && created.data.programa.plantilla === 'estandar');
  ok('5) siembra 5 secciones pendientes (plantilla v2)',
    created.data.programa.secciones.length === 5 && created.data.programa.secciones.every(function (s) { return s.estado === 'pendiente'; }));
  ok('5) progreso inicial 0%', created.data.programa.progreso.pct === 0);
  const sveId = created.data.programa.id;

  // ---------- 3b) Migración 20260930-sve-template-v2 ----------
  // Simular un programa sve con la plantilla v1 (alertas/reportes/admin/auditoria,
  // sin plan/indicadores/areas), aplicar MIGRATIONS_SQL como hace initDbOnce,
  // y verificar que queda con las 5 secciones de la plantilla v2.
  db.prepare("DELETE FROM mp_programa_secciones WHERE programa_id = ?").run(sveId);
  const stmtV1 = db.prepare("INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en) VALUES (?,?,?,?,?,?,?,?)");
  ['dashboard', 'casos', 'alertas', 'reportes', 'admin', 'auditoria'].forEach(function (c, i) {
    stmtV1.run('mps-v1-' + i, sveId, c, c, '', i + 1, 'pendiente', '2026-09-29T00:00:00.000Z');
  });
  // Estado marcado en dashboard debe SOBREVIVIR a la migración.
  db.prepare("UPDATE mp_programa_secciones SET estado = 'completo' WHERE programa_id = ? AND clave = 'dashboard'").run(sveId);

  db.exec('CREATE TABLE IF NOT EXISTS _medprev_programas_migrations (id TEXT PRIMARY KEY, aplicada_en TEXT NOT NULL)');
  bridge.MIGRATIONS_SQL.forEach(function (sql, i) {
    db.exec(sql);
    db.prepare('INSERT OR IGNORE INTO _medprev_programas_migrations (id, aplicada_en) VALUES (?, ?)').run(bridge.MIGRATION_IDS[i] || ('mig-' + i), '2026-09-30T00:00:00.000Z');
  });

  const trasMig = db.prepare("SELECT clave, nombre, orden, estado FROM mp_programa_secciones WHERE programa_id = ? ORDER BY orden ASC").all(sveId);
  ok('3b) migración v2: quedan 5 secciones', trasMig.length === 5, JSON.stringify(trasMig.map(s => s.clave)));
  ok('3b) migración v2: claves correctas en orden',
    JSON.stringify(trasMig.map(s => s.clave)) === JSON.stringify(['dashboard', 'casos', 'plan', 'indicadores', 'areas']),
    trasMig.map(s => s.clave).join(','));
  ok('3b) migración v2: secciones obsoletas eliminadas',
    !trasMig.some(s => ['alertas', 'reportes', 'admin', 'auditoria'].indexOf(s.clave) !== -1));
  ok('3b) migración v2: el progreso marcado sobrevive (dashboard completo)',
    trasMig[0].estado === 'completo');
  ok('3b) migración v2: idempotente (segunda pasada no duplica)', (function () {
    bridge.MIGRATIONS_SQL.forEach(function (sql) { db.exec(sql); });
    return db.prepare("SELECT COUNT(*) c FROM mp_programa_secciones WHERE programa_id = ?").get(sveId).c === 5;
  })());
  // Reinsertar las secciones estándar para no afectar los checks siguientes
  // (el programa sve queda con la plantilla v2 aplicada — igual que en prod).

  const blanco = await H['medprev:programas:create']({}, {
    companyName: empresaA, tipo: 'promocion', nombre: 'Seguridad Vial 2026', usarPlantilla: false, token: 'tok-ok'
  });
  ok('5) create en blanco ok sin secciones', blanco.success === true && blanco.data.programa.secciones.length === 0 && blanco.data.programa.plantilla === 'blanco');
  const promocionId = blanco.data.programa.id;

  // ---------- 6) UNIQUE por empresa/tipo/nombre ----------
  const dup = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'SVE COVID-19', token: 'tok-ok' });
  ok('6) nombre duplicado en la misma línea → ALREADY_EXISTS', dup.success === false && dup.error.code === 'ALREADY_EXISTS', dup.error && dup.error.code);
  const otroTipo = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'dme', nombre: 'SVE COVID-19', token: 'tok-ok' });
  ok('6) mismo nombre en OTRA línea → permitido', otroTipo.success === true, otroTipo.error && otroTipo.error.message);
  const dmeId = otroTipo.data.programa.id;

  // ---------- 7) list con filtro y progreso ----------
  const listaSve = await H['medprev:programas:list']({}, { companyName: empresaA, tipo: 'sve', token: 'tok-ok' });
  ok('7) list sve devuelve solo sve', listaSve.success === true && listaSve.data.programas.length === 1 && listaSve.data.programas[0].tipo === 'sve');
  const listaTodo = await H['medprev:programas:list']({}, { companyName: empresaA, token: 'tok-ok' });
  ok('7) list sin filtro devuelve los 3', listaTodo.data.programas.length === 3, listaTodo.data.programas.length);
  const listMalTipo = await H['medprev:programas:list']({}, { companyName: empresaA, tipo: 'zzz' });
  ok('7) list con tipo desconocido → VALIDATION', listMalTipo.success === false && listMalTipo.error.code === 'VALIDATION');

  // ---------- 8) update ----------
  const renombrado = await H['medprev:programas:update']({}, { companyName: empresaA, programaId: sveId, cambios: { nombre: 'SVE COVID-19 2026', estado: 'pausado' }, token: 'tok-ok' });
  ok('8) update nombre+estado ok', renombrado.success === true && renombrado.data.programa.nombre === 'SVE COVID-19 2026' && renombrado.data.programa.estado === 'pausado');
  const estadoMalo = await H['medprev:programas:update']({}, { companyName: empresaA, programaId: sveId, cambios: { estado: 'pausadisimo' }, token: 'tok-ok' });
  ok('8) update estado inválido → VALIDATION', estadoMalo.success === false && estadoMalo.error.code === 'VALIDATION');
  const vacio = await H['medprev:programas:update']({}, { companyName: empresaA, programaId: sveId, cambios: {}, token: 'tok-ok' });
  ok('8) update sin cambios → VALIDATION', vacio.success === false && vacio.error.code === 'VALIDATION');
  const cruce = await H['medprev:programas:update']({}, { companyName: empresaA, programaId: sveId, cambios: { fechaFin: '2025-01-01' }, token: 'tok-ok' });
  ok('8) update con fechas cruzadas → VALIDATION', cruce.success === false && cruce.error.code === 'VALIDATION');
  const get1 = await H['medprev:programas:get']({}, { companyName: empresaA, programaId: sveId, token: 'tok-ok' });
  ok('8) get devuelve programa actualizado', get1.success === true && get1.data.programa.nombre === 'SVE COVID-19 2026' && get1.data.programa.secciones.length === 5);
  const getNulo = await H['medprev:programas:get']({}, { companyName: empresaA, programaId: 'mpp-inexistente' });
  ok('8) get inexistente → NOT_FOUND', getNulo.success === false && getNulo.error.code === 'NOT_FOUND');

  // ---------- 9) seccion-estado ----------
  const seccionDashboard = get1.data.programa.secciones.find(function (s) { return s.clave === 'dashboard'; });
  const malEstado = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'terminada', token: 'tok-ok' });
  ok('9) estado de sección inválido → VALIDATION', malEstado.success === false && malEstado.error.code === 'VALIDATION');
  const enCurso = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'en_curso', token: 'tok-ok' });
  ok('9) marcar en_curso ok', enCurso.success === true && enCurso.data.seccion.estado === 'en_curso' && enCurso.data.progreso.enCurso === 1);
  const completa = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'completo', token: 'tok-ok' });
  ok('9) marcar completo actualiza progreso (1/5 = 20%)', completa.success === true && completa.data.progreso.completas === 1 && completa.data.progreso.pct === 20, JSON.stringify(completa.data.progreso));
  const secAjena = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: promocionId, seccionId: seccionDashboard.id, estado: 'completo', token: 'tok-ok' });
  ok('9) sección de otro programa → NOT_FOUND', secAjena.success === false && secAjena.error.code === 'NOT_FOUND');

  // ---------- 10) delete soft ----------
  const del = await H['medprev:programas:delete']({}, { companyName: empresaA, programaId: dmeId, token: 'tok-ok' });
  ok('10) delete ok y devuelve estado eliminado', del.success === true && del.data.estado === 'eliminado');
  const listaTras = await H['medprev:programas:list']({}, { companyName: empresaA, token: 'tok-ok' });
  ok('10) list ya no muestra el eliminado', listaTras.data.programas.length === 2 && !listaTras.data.programas.some(function (p) { return p.id === dmeId; }));
  const getTras = await H['medprev:programas:get']({}, { companyName: empresaA, programaId: dmeId });
  ok('10) get del eliminado → NOT_FOUND', getTras.success === false && getTras.error.code === 'NOT_FOUND');
  const del2 = await H['medprev:programas:delete']({}, { companyName: empresaA, programaId: dmeId, token: 'tok-ok' });
  ok('10) delete doble → NOT_FOUND', del2.success === false && del2.error.code === 'NOT_FOUND');
  // El row sigue en BD (soft-delete) para auditoría/recuperación.
  const row = db.prepare('SELECT estado FROM mp_programas WHERE id = ?').get(dmeId);
  ok('10) el row sigue en BD con estado eliminado', row && row.estado === 'eliminado');

  // ---------- 11) Aislamiento multi-empresa ----------
  const b = await H['medprev:programas:create']({}, { companyName: 'Temposum Est SAS', tipo: 'sve', nombre: 'SVE COVID-19', token: 'tok-ok' });
  ok('11) misma línea+nombre en OTRA empresa → permitido', b.success === true, b.error && b.error.message);
  const listaA = await H['medprev:programas:list']({}, { companyName: empresaA, tipo: 'sve' });
  ok('11) list de A no trae programas de B', listaA.data.programas.length === 1 && listaA.data.programas[0].empresaId === 'tempoactiva');

  // ---------- 12) 📦827-fix — Archivar vs eliminar de verdad ----------
  // Un solo botón "Eliminar" obligaba a adivinar qué quedaba guardado. Ahora
  // son dos intenciones distintas y esta es la diferencia observable.
  const SVE_TABLAS = ['mp_sve_casos', 'mp_sve_plan_actividades', 'mp_sve_plan_meses', 'mp_sve_meta',
    'mp_sve_indicadores', 'mp_sve_indicadores_valores', 'mp_sve_morbilidad', 'mp_sve_analisis'];

  function existeTabla(t) {
    try { return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t); }
    catch (e) { return false; }
  }
  function sembrarSve(pid) {
    SVE_TABLAS.filter(existeTabla).forEach(t => { try { db.prepare('DELETE FROM ' + t + ' WHERE programa_id = ?').run(pid); } catch (e) { /* */ } });
    if (!existeTabla('mp_sve_casos')) return;
    db.prepare("INSERT INTO mp_sve_casos (id, programa_id, empresa_id, orden, trabajador, documento, creado_en, actualizado_en) VALUES ('c1',?,'tempoactiva',1,'JUAN','111','2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z')").run(pid);
    db.prepare("INSERT INTO mp_sve_plan_actividades (id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en) VALUES ('act-1',?,'tempoactiva','planear','A1','X',1,'2024-01-01T00:00:00.000Z','2024-01-01T00:00:00.000Z')").run(pid);
    db.prepare("INSERT INTO mp_sve_plan_meses (actividad_id, programa_id, mes, ap, ae) VALUES ('act-1',?,1,1,0)").run(pid);
    db.prepare("INSERT INTO mp_sve_meta (programa_id, empresa_id, meta_json, actualizado_en) VALUES (?,'tempoactiva','{}','2024-01-01T00:00:00.000Z')").run(pid);
    db.prepare("INSERT INTO mp_sve_analisis (id, programa_id, empresa_id, periodo, hallazgos, propuestas, responsable, orden, actualizado_en) VALUES (?,?,'tempoactiva','1','h','p','r',0,'2024-01-01T00:00:00.000Z')").run('an-' + pid, pid);
    db.prepare("INSERT INTO mp_sve_morbilidad (programa_id, empresa_id, tipo, anio, casos, dias_it) VALUES (?,'tempoactiva','Accidentes',2024,1,2)").run(pid);
  }
  function contarSve(pid) {
    let n = 0;
    SVE_TABLAS.filter(existeTabla).forEach(t => {
      try { n += db.prepare('SELECT COUNT(*) AS n FROM ' + t + ' WHERE programa_id = ?').get(pid).n; } catch (e) { /* */ }
    });
    return n;
  }
  const bajas = (pid) => {
    if (!existeTabla('mp_programas_bajas')) return null;
    return db.prepare('SELECT * FROM mp_programas_bajas WHERE programa_id = ?').get(pid);
  };

  const nuevo1 = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'Para archivar', token: 'tok-ok' });
  const pidArchivar = nuevo1.data.programa.id;
  sembrarSve(pidArchivar);
  const archivar = await H['medprev:programas:delete']({}, { token: 'tok-ok', companyName: empresaA, programaId: pidArchivar, modo: 'archivar' });
  ok('12) archivar responde ok y dice el modo', archivar.success === true && archivar.data.modo === 'archivar',
    JSON.stringify(archivar.data || archivar.error));
  ok('12) archivar deja el programa en la base con estado eliminado (no lo borra)',
    db.prepare('SELECT estado FROM mp_programas WHERE id = ?').get(pidArchivar).estado === 'eliminado');
  ok('12) archivar NO borra los datos del SVE (siguen recuperables)', contarSve(pidArchivar) > 0, contarSve(pidArchivar) + ' filas');
  ok('12) archivar deja constancia con origen "archivo"', bajas(pidArchivar) && bajas(pidArchivar).origen === 'archivo',
    JSON.stringify(bajas(pidArchivar) || 'sin fila'));
  ok('12) un programa archivado no sale de la lista',
    (await H['medprev:programas:list']({}, { token: 'tok-ok', companyName: empresaA, tipo: 'sve' }))
      .data.programas.every(p => p.id !== pidArchivar));

  const nuevo2 = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'Para borrar', token: 'tok-ok' });
  const pidBorrar = nuevo2.data.programa.id;
  sembrarSve(pidBorrar);
  const sinConfirmar = await H['medprev:programas:delete']({}, { token: 'tok-ok', companyName: empresaA, programaId: pidBorrar, modo: 'eliminar' });
  ok('12) eliminar SIN confirmacion explicita se rechaza (guarda contra el clic perdido)',
    sinConfirmar.success === false, JSON.stringify(sinConfirmar.error || {}));
  ok('12) y el programa sigue intacto tras el rechazo',
    !!db.prepare('SELECT id FROM mp_programas WHERE id = ?').get(pidBorrar) && contarSve(pidBorrar) > 0);

  const antesBorrar = contarSve(pidBorrar);
  const borrar = await H['medprev:programas:delete']({}, {
    token: 'tok-ok', companyName: empresaA, programaId: pidBorrar, modo: 'eliminar', confirmacion: 'eliminar'
  });
  ok('12) eliminar de verdad responde ok y dice el modo', borrar.success === true && borrar.data.modo === 'eliminar',
    JSON.stringify(borrar.data || borrar.error));
  ok('12) eliminar borra la fila del programa', !db.prepare('SELECT id FROM mp_programas WHERE id = ?').get(pidBorrar));
  ok('12) eliminar borra TODO el contenido del SVE (datos personales incluidos)',
    contarSve(pidBorrar) === 0, 'antes=' + antesBorrar + ' despues=' + contarSve(pidBorrar));
  ok('12) eliminar deja la baja registrada para que viaje al sync',
    bajas(pidBorrar) && bajas(pidBorrar).origen === 'eliminar' && !!bajas(pidBorrar).eliminado_en,
    JSON.stringify(bajas(pidBorrar) || 'sin fila'));
  ok('12) la baja NO guarda datos personales (solo metadatos del programa)',
    !bajas(pidBorrar) || Object.keys(bajas(pidBorrar)).every(c =>
      ['programa_id', 'empresa_id', 'tipo', 'nombre', 'fecha_inicio', 'fecha_fin', 'eliminado_en', 'eliminado_por', 'origen'].indexOf(c) !== -1),
    bajas(pidBorrar) ? Object.keys(bajas(pidBorrar)).join(',') : 'sin fila');
  ok('12) eliminar sin token se rechaza igual que archivar',
    (await H['medprev:programas:delete']({}, { companyName: empresaA, programaId: pidArchivar, modo: 'eliminar', confirmacion: 'eliminar' })).success === false);
  ok('12) un programa ya borrado no se puede volver a eliminar',
    (await H['medprev:programas:delete']({}, { token: 'tok-ok', companyName: empresaA, programaId: pidBorrar, modo: 'eliminar', confirmacion: 'eliminar' })).success === false);
  const nuevo3 = await H['medprev:programas:create']({}, { companyName: empresaA, tipo: 'sve', nombre: 'Modo por defecto', token: 'tok-ok' });
  const porDefecto = await H['medprev:programas:delete']({}, { token: 'tok-ok', companyName: empresaA, programaId: nuevo3.data.programa.id });
  ok('12) el modo por defecto (sin `modo`) sigue siendo archivar, no borrar',
    porDefecto.success === true && porDefecto.data.modo === 'archivar', JSON.stringify(porDefecto.data || porDefecto.error));
  ok('12) y archivar por defecto tampoco borra los datos',
    !!db.prepare('SELECT id FROM mp_programas WHERE id = ?').get(nuevo3.data.programa.id));

  // ---------- Resultado ----------
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
})().catch(function (e) {
  console.error('FAIL INESPERADO:', e);
  process.exit(1);
});
