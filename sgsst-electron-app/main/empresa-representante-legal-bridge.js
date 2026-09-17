// main/empresa-representante-legal-bridge.js
// Bridge IPC del módulo Representante Legal por empresa (📦2.2 · v0.1.180 · K+AIR Firma Dual)
//
// Patrón: mismo que main/gestion-humana-bridge.js
// Firma: registerRepLegalHandlers.init(ipcMain) + registerRepLegalHandlers(app, { getDb, validateSession })
//
// 4 canales IPC:
//   - rep-legal:get               → retorna el representante legal activo de una empresa (o null)
//   - rep-legal:upsert            → crea o actualiza el rep legal activo de una empresa
//   - rep-legal:delete            → soft delete (activo=0) del rep legal activo de una empresa
//   - rep-legal:validateForFirma  → valida que tenga correo válido (lanza error si no) — bloquea firma dual
//
// Multi-tenant: TODOS los handlers reciben `empresaId` = company_key (mismo que en gestion-humana).
// Soft delete: activo=0. Solo puede haber 1 fila activa por empresa a la vez.

const MOD = 'REP-LEGAL';

let _ipcMain = null;
let _getDb = null;
let _validateSession = null;

function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}
function _ok(data) {
  return { success: true, data: data || {} };
}

// ========== AUTH (soft — mismo patrón que gestion-humana) ==========
function _checkAuth(token) {
  if (!token) return { ok: true, user: null, softAuth: true };
  if (!_validateSession || typeof _validateSession !== 'function') {
    return { ok: true, user: null, softAuth: true };
  }
  var session = _validateSession(token);
  if (!session || !session.ok) {
    console.warn('[' + MOD + '] Token inválido en handler, continuando con soft auth');
    return { ok: true, user: null, softAuth: true };
  }
  return { ok: true, user: session.user };
}

// ========== VALIDACIÓN DE CORREO ==========
// Validación simple: contiene '@' y al menos un punto después del '@'.
// Suficiente para el caso de uso de "firma dual requiere correo" — la verificación
// real (OTP) se hace en el flujo de firma-service, no acá.
function _isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  var s = String(email).trim();
  if (s.length < 3) return false;
  var at = s.indexOf('@');
  if (at < 1) return false;
  var dot = s.indexOf('.', at);
  if (dot < at + 2) return false;
  if (dot === s.length - 1) return false;
  return true;
}

// ========== ROW → OBJECT CONVERTER (snake_case → camelCase) ==========
function _rowToRepLegal(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombre: row.nombre,
    tipoIdentificacion: row.tipo_identificacion,
    numeroIdentificacion: row.numero_identificacion,
    correo: row.correo,
    telefono: row.telefono,
    cargo: row.cargo,
    activo: row.activo,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en
  };
}

// ========== HANDLERS ==========

/**
 * rep-legal:get
 * Input:  { token, empresaId }
 * Output: { success, data: { representante } }   (representante = null si no hay activo)
 */
function _handlerGet(token, empresaId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!empresaId || typeof empresaId !== 'string') {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare(
      "SELECT id, empresa_id, nombre, tipo_identificacion, numero_identificacion, " +
      "correo, telefono, cargo, activo, creado_en, actualizado_en " +
      "FROM empresa_representante_legal " +
      "WHERE empresa_id = ? AND activo = 1 LIMIT 1"
    ).get(empresaId);
    return _ok({ representante: _rowToRepLegal(row) });
  } catch (e) {
    console.error('[' + MOD + '][get]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * rep-legal:upsert
 * Si ya existe fila activa para la empresa → UPDATE.
 * Si NO existe fila activa para la empresa → INSERT.
 * Input:  { token, data: { empresaId, nombre, tipoId, numId, correo, telefono?, cargo? } }
 * Output: { success, data: { id, updated: bool } }
 */
function _handlerUpsert(token, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.empresaId || typeof data.empresaId !== 'string') {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }
  if (!data.nombre || typeof data.nombre !== 'string' || !data.nombre.trim()) {
    return _err('INVALID_INPUT', 'nombre es requerido');
  }
  if (!data.correo || typeof data.correo !== 'string') {
    return _err('INVALID_INPUT', 'correo es requerido');
  }
  if (!_isValidEmail(data.correo)) {
    return _err('INVALID_INPUT', 'correo no tiene formato válido');
  }
  if (!data.numId || typeof data.numId !== 'string' || !data.numId.trim()) {
    return _err('INVALID_INPUT', 'numId (número de identificación) es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var now = new Date().toISOString();
    var existing = localDb.prepare(
      "SELECT id FROM empresa_representante_legal WHERE empresa_id = ? AND activo = 1 LIMIT 1"
    ).get(data.empresaId);

    if (existing) {
      localDb.prepare(
        "UPDATE empresa_representante_legal SET " +
        "nombre = ?, tipo_identificacion = ?, numero_identificacion = ?, " +
        "correo = ?, telefono = ?, cargo = ?, actualizado_en = ? " +
        "WHERE id = ?"
      ).run(
        data.nombre.trim(),
        data.tipoId || 'CC',
        data.numId.trim(),
        data.correo.trim(),
        data.telefono || null,
        data.cargo || null,
        now,
        existing.id
      );
      return _ok({ id: existing.id, updated: true });
    } else {
      var result = localDb.prepare(
        "INSERT INTO empresa_representante_legal " +
        "(empresa_id, nombre, tipo_identificacion, numero_identificacion, " +
        " correo, telefono, cargo, activo, creado_en) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)"
      ).run(
        data.empresaId,
        data.nombre.trim(),
        data.tipoId || 'CC',
        data.numId.trim(),
        data.correo.trim(),
        data.telefono || null,
        data.cargo || null,
        now
      );
      return _ok({ id: result.lastInsertRowid, updated: false });
    }
  } catch (e) {
    console.error('[' + MOD + '][upsert]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * rep-legal:delete
 * Soft delete: marca activo=0 para TODAS las filas de la empresa (caso borde de duplicados).
 * Input:  { token, empresaId }
 * Output: { success, data: { ok: true, affected: number } }
 */
function _handlerDelete(token, empresaId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!empresaId || typeof empresaId !== 'string') {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var result = localDb.prepare(
      "UPDATE empresa_representante_legal SET activo = 0 WHERE empresa_id = ?"
    ).run(empresaId);
    return _ok({ ok: true, affected: result.changes });
  } catch (e) {
    console.error('[' + MOD + '][delete]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * rep-legal:validateForFirma
 * 📦2.2 · CRÍTICO: bloquea el envío de firma dual si el rep legal no tiene correo válido.
 * Usado por el bridge de Firma Electrónica (firma-bridge) antes de crear un sign request dual.
 * Input:  { token, empresaId }
 * Output: { success, data: { ok: true, correo } }
 * Errores:
 *   - REP_NOT_CONFIGURED (409): no hay rep legal activo para la empresa
 *   - REP_NO_EMAIL (409): el rep legal activo no tiene correo (debería ser imposible
 *     porque la columna es NOT NULL, pero validamos por seguridad)
 *   - REP_INVALID_EMAIL (409): el correo no tiene formato válido
 */
function _handlerValidateForFirma(token, empresaId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!empresaId || typeof empresaId !== 'string') {
    return _err('INVALID_INPUT', 'empresaId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare(
      "SELECT correo FROM empresa_representante_legal WHERE empresa_id = ? AND activo = 1 LIMIT 1"
    ).get(empresaId);

    if (!row) {
      return _err('REP_NOT_CONFIGURED',
        'La empresa no tiene representante legal configurado. Agregalo en Gestión de Empresas.');
    }
    if (!row.correo || !String(row.correo).trim()) {
      return _err('REP_NO_EMAIL',
        'El representante legal no tiene correo. La firma dual requiere correo.');
    }
    if (!_isValidEmail(row.correo)) {
      return _err('REP_INVALID_EMAIL',
        'El correo del representante legal no tiene formato válido. Actualizalo en Gestión de Empresas.');
    }
    return _ok({ ok: true, correo: String(row.correo).trim() });
  } catch (e) {
    console.error('[' + MOD + '][validateForFirma]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== DIAG (consistente con otros bridges K+AIR) ==========
function _handlerDiag() {
  var localDb = null;
  try { localDb = _getDb && _getDb(); } catch (e) { /* DB no lista */ }
  var status = {
    module: MOD,
    version: 'v0.1.180',
    handlers: 4,
    ipcMainInjected: !!_ipcMain,
    dbAvailable: !!localDb,
    timestamp: new Date().toISOString()
  };
  if (localDb) {
    try {
      var row = localDb.prepare(
        "SELECT COUNT(*) AS total FROM empresa_representante_legal WHERE activo = 1"
      ).get();
      status.activeRepLegalCount = row.total;
    } catch (e) {
      status.tableError = e.message;
    }
  }
  return _ok(status);
}

// ========== REGISTER ==========
function registerRepLegalHandlers(app, deps) {
  if (!_ipcMain) {
    throw new Error('[' + MOD + '] ipcMain no inyectado. Llamá registerRepLegalHandlers.init(ipcMain) primero.');
  }
  if (!deps || typeof deps.getDb !== 'function') {
    throw new Error('[' + MOD + '] deps.getDb es requerido');
  }
  _getDb = deps.getDb;
  _validateSession = deps.validateSession || null;

  // ========== GET: representante legal activo de una empresa ==========
  _ipcMain.handle('rep-legal:get', async function (_event, args) {
    return _handlerGet(args && args.token, args && args.empresaId);
  });

  // ========== UPSERT: crear o actualizar ==========
  _ipcMain.handle('rep-legal:upsert', async function (_event, args) {
    return _handlerUpsert(args && args.token, args && args.data);
  });

  // ========== DELETE: soft delete ==========
  _ipcMain.handle('rep-legal:delete', async function (_event, args) {
    return _handlerDelete(args && args.token, args && args.empresaId);
  });

  // ========== VALIDATE FOR FIRMA: bloquea firma dual si no hay correo ==========
  _ipcMain.handle('rep-legal:validateForFirma', async function (_event, args) {
    return _handlerValidateForFirma(args && args.token, args && args.empresaId);
  });

  // ========== DIAG: estado del módulo ==========
  _ipcMain.handle('rep-legal:diag', async function () {
    return _handlerDiag();
  });

  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 4 handlers (get / upsert / delete / validateForFirma) + 1 diag · v0.1.180');
}

registerRepLegalHandlers.init = function (ipcMain) {
  _ipcMain = ipcMain;
};

module.exports = {
  registerRepLegalHandlers: registerRepLegalHandlers
};
