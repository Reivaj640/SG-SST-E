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
  ok('3) SVE tiene 6 secciones (spec PDF)', pl.data.plantillas.sve.secciones.length === 6, pl.data.plantillas.sve.secciones.length);
  ok('3) DME tiene 4 secciones', pl.data.plantillas.dme.secciones.length === 4, pl.data.plantillas.dme.secciones.length);
  ok('3) Promoción tiene 5 secciones', pl.data.plantillas.promocion.secciones.length === 5, pl.data.plantillas.promocion.secciones.length);
  ok('3) plantilla SVE trae dashboard/casos/alertas/reportes/admin/auditoria',
    ['dashboard', 'casos', 'alertas', 'reportes', 'admin', 'auditoria'].every(function (c) {
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
  ok('5) siembra 6 secciones pendientes',
    created.data.programa.secciones.length === 6 && created.data.programa.secciones.every(function (s) { return s.estado === 'pendiente'; }));
  ok('5) progreso inicial 0%', created.data.programa.progreso.pct === 0);
  const sveId = created.data.programa.id;

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
  ok('8) get devuelve programa actualizado', get1.success === true && get1.data.programa.nombre === 'SVE COVID-19 2026' && get1.data.programa.secciones.length === 6);
  const getNulo = await H['medprev:programas:get']({}, { companyName: empresaA, programaId: 'mpp-inexistente' });
  ok('8) get inexistente → NOT_FOUND', getNulo.success === false && getNulo.error.code === 'NOT_FOUND');

  // ---------- 9) seccion-estado ----------
  const seccionDashboard = get1.data.programa.secciones.find(function (s) { return s.clave === 'dashboard'; });
  const malEstado = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'terminada', token: 'tok-ok' });
  ok('9) estado de sección inválido → VALIDATION', malEstado.success === false && malEstado.error.code === 'VALIDATION');
  const enCurso = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'en_curso', token: 'tok-ok' });
  ok('9) marcar en_curso ok', enCurso.success === true && enCurso.data.seccion.estado === 'en_curso' && enCurso.data.progreso.enCurso === 1);
  const completa = await H['medprev:programas:seccion-estado']({}, { companyName: empresaA, programaId: sveId, seccionId: seccionDashboard.id, estado: 'completo', token: 'tok-ok' });
  ok('9) marcar completo actualiza progreso (1/6 ≈ 17%)', completa.success === true && completa.data.progreso.completas === 1 && completa.data.progreso.pct === 17, JSON.stringify(completa.data.progreso));
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
