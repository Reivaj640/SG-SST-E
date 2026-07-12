/**
 * main/evaluacion-action-plans-bridge.js
 *
 * Bridge IPC para persistir los planes de acción del submódulo 2.3.1
 * Evaluación Inicial del SG-SST. Antes se almacenaban solo en memoria
 * (this.actionPlans en la clase) y se perdían al cerrar el módulo.
 *
 * Esquema:
 *   evaluacion_action_plans:
 *     id          TEXT PRIMARY KEY  (UUID v4 generado por crypto.randomUUID)
 *     empresa_id  TEXT NOT NULL     (currentCompany; planes son por empresa)
 *     year        TEXT NOT NULL     (año de la evaluación; el módulo carga el del header)
 *     source      TEXT NOT NULL     ('ministerio' | 'arl' | 'manual')
 *     plan_json   TEXT NOT NULL     (el objeto plan completo serializado)
 *     updated_at  TEXT NOT NULL     (ISO timestamp)
 *
 * Diseño:
 *   - Un plan se guarda COMPLETO en plan_json (incluye seguimientos y
 *     responsables). Esto evita joins y permite cambiar el shape del plan
 *     sin migraciones. Trade-off: queries agregadas (ej: "todos los planes
 *     pendientes del 2026") requieren parsear JSON. Aceptable para el
 *     volumen esperado (decenas de planes por empresa por año).
 *   - UPSERT por id: si el plan ya existe, actualiza plan_json y updated_at.
 *   - Empresa + year como filtro principal para listar. Un usuario solo ve
 *     los planes de su empresa activa del año activo.
 *   - No se eliminan planes automaticamente — el usuario decide via
 *     electronAPI.evaluacionActionPlans.eliminar({id}).
 */
'use strict';

const { ipcMain } = require('electron');

const MOD = 'EVAL-ACTION-PLANS';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;

// ---------- SQL Schema ----------
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS evaluacion_action_plans (
    id          TEXT PRIMARY KEY,
    empresa_id  TEXT NOT NULL,
    year        TEXT NOT NULL,
    source      TEXT NOT NULL,
    plan_json   TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_evaluacion_action_plans_empresa_year
    ON evaluacion_action_plans(empresa_id, year);
`;

// ---------- Handlers internos (reusables, testeables) ----------

/**
 * Lista los planes de acción de una empresa+año.
 * Devuelve array de planes parseados (no el JSON crudo).
 * Si no se pasa year, devuelve TODOS los años de la empresa.
 */
function _handlerListar(empresaId, year) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId requerido' } };
  }
  try {
    var db = _getDb();
    var rows;
    if (year) {
      rows = db.prepare(
        'SELECT id, source, plan_json, updated_at FROM evaluacion_action_plans WHERE empresa_id = ? AND year = ? ORDER BY updated_at DESC'
      ).all(empresaId, year);
    } else {
      rows = db.prepare(
        'SELECT id, source, plan_json, updated_at FROM evaluacion_action_plans WHERE empresa_id = ? ORDER BY year DESC, updated_at DESC'
      ).all(empresaId);
    }
    var planes = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      try {
        var plan = JSON.parse(row.plan_json);
        // Inyectamos el id (puede ser que el JSON no lo tenga) y metadata
        plan.id = row.id;
        plan._source = row.source;
        plan._updatedAt = row.updated_at;
        planes.push(plan);
      } catch (parseErr) {
        // Plan con JSON corrupto — logueamos y seguimos
        console.error('[' + MOD + '][LISTAR] Plan con JSON invalido (id=' + row.id + '): ' + parseErr.message);
      }
    }
    return { success: true, data: planes };
  } catch (e) {
    console.error('[' + MOD + '][LISTAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

/**
 * Guarda (UPSERT) un plan de acción.
 * params: { id, empresaId, year, source, plan }
 * Si id no se pasa, se genera uno con timestamp+random (fallback si el
 * frontend no genera UUID).
 */
function _handlerGuardar(params) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  var empresaId = params && params.empresaId;
  var year = params && params.year;
  var source = params && params.source;
  var plan = params && params.plan;
  if (!empresaId || !year || !source || !plan) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'empresaId, year, source y plan son requeridos' }
    };
  }
  var id = plan.id || (params && params.id) || _generateId();
  // El id va en el objeto plan también para mantener consistencia
  plan.id = id;
  try {
    var db = _getDb();
    var now = new Date().toISOString();
    var planJson = JSON.stringify(plan);
    db.prepare(`
      INSERT INTO evaluacion_action_plans (id, empresa_id, year, source, plan_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        plan_json  = excluded.plan_json,
        source     = excluded.source,
        year       = excluded.year,
        empresa_id = excluded.empresa_id,
        updated_at = excluded.updated_at
    `).run(id, empresaId, year, source, planJson, now);
    console.log('[' + MOD + '][GUARDAR] ' + id + ' en ' + empresaId + '/' + year);
    return { success: true, data: { id: id, updatedAt: now } };
  } catch (e) {
    console.error('[' + MOD + '][GUARDAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

/**
 * Elimina un plan por id.
 * Verifica que pertenezca a la empresa indicada (defensa contra IDs
 * cross-tenant).
 */
function _handlerEliminar(empresaId, id) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId || !id) {
    return {
      success: false,
      error: { code: 'VALIDATION', message: 'empresaId e id son requeridos' }
    };
  }
  try {
    var db = _getDb();
    var result = db.prepare(
      'DELETE FROM evaluacion_action_plans WHERE id = ? AND empresa_id = ?'
    ).run(id, empresaId);
    console.log('[' + MOD + '][ELIMINAR] ' + id + ' (cambios=' + result.changes + ')');
    return { success: true, deleted: result.changes > 0 };
  } catch (e) {
    console.error('[' + MOD + '][ELIMINAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

// Generador de ID fallback (UUID-like sin libreria externa)
// Formato: timestamp-base36 + 6 chars random hex
function _generateId() {
  var ts = Date.now().toString(36);
  var rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  return 'eap-' + ts + '-' + rand;
}

// ---------- Registro de handlers IPC ----------
function registerEvaluacionActionPlansHandlers(app, deps) {
  _getDb = deps && deps.getDb ? deps.getDb : null;

  console.log('[' + MOD + '][INIT][INFO] Registrando handlers de planes de acción de evaluación...');

  // Listar
  ipcMain.handle('evaluacion-action-plans:listar', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return _handlerListar(params.empresaId, params.year);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-LISTAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // Guardar
  ipcMain.handle('evaluacion-action-plans:guardar', async function (event, payload) {
    try {
      return _handlerGuardar(payload);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-GUARDAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // Eliminar
  ipcMain.handle('evaluacion-action-plans:eliminar', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      return _handlerEliminar(params.empresaId, params.id);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-ELIMINAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] 3 handlers de planes de acción registrados');
}

module.exports = {
  registerEvaluacionActionPlansHandlers: registerEvaluacionActionPlansHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  // Exportar handlers internos para tests / debug
  _handlerListar: _handlerListar,
  _handlerGuardar: _handlerGuardar,
  _handlerEliminar: _handlerEliminar,
  _generateId: _generateId
};
