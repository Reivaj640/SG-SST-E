/**
 * main/bandeja-integrada-permissions-bridge.js
 *
 * Bridge IPC para gestionar el flag por usuario que habilita el acceso a la
 * Bandeja Integrada (Correo + Calendario). Hasta ahora el iframe estaba
 * disponible para todos los usuarios logueados. Con este bridge, el admin
 * puede condicionar el acceso por usuario desde Configuración > Ajustes de
 * Usuario > Gestión de Usuario.
 *
 * Esquema (migración idempotente sobre tabla `users` existente en main.js):
 *   users.bandeja_integrada_enabled INTEGER NOT NULL DEFAULT 0
 *     - 0 = sin acceso (default al crear nuevos usuarios)
 *     - 1 = habilitado
 *     - El admin global SIEMPRE retorna 1 en `get` aunque la BD diga 0
 *       (forzado en el handler, igual que con `usersDisableV1`).
 *
 * Handlers:
 *   - users-get-bandeja-integrada-flag → lee el flag del user logueado
 *   - users-set-bandeja-integrada-flag → guarda el flag (solo para sí mismo
 *     o admin global puede cambiar el de otros)
 *
 * Diseño:
 *   - El flag se guarda en `users.bandeja_integrada_enabled` (columna nueva).
 *   - Si es admin global (isAdminGlobal), SIEMPRE retorna `enabled: true` y
 *     NO permite set `false` (forzado en backend).
 *   - No toca los tokens de Gmail (que siguen en `email_connections`).
 */
'use strict';

const { ipcMain } = require('electron');

const MOD = 'BANDEJA-INTEGRADA-PERM';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;
let _validateSession = null;

// ---------- Migrations ----------
// El ALTER TABLE es idempotente: si la columna ya existe, SQLite lanza
// "duplicate column name" y se ignora. Mismo patrón que GESTACION_MIGRATIONS_SQL.
const MIGRATIONS_SQL = [
  "ALTER TABLE users ADD COLUMN bandeja_integrada_enabled INTEGER NOT NULL DEFAULT 0"
];

// ---------- Handler: GET flag ----------
// 📦702-step3 (2026-08-13) — Acepta targetUserId opcional. Sin targetUserId
// (compat con el flujo del renderer), lee el flag del USER LOGUEADO. Con
// targetUserId, lee el flag de ESE user (solo admin puede, el backend
// rechaza si no-admin intenta consultar el flag de otros).
function _handlerGetBandejaIntegradaFlag(token, targetUserId) {
  if (_validateSession && typeof _validateSession === 'function') {
    var sessionCheck = _validateSession(token);
    if (!sessionCheck.ok) {
      return { success: false, error: { code: 'AUTH_REQUIRED', message: sessionCheck.error?.message || 'Sesión requerida' } };
    }
  } else {
    return { success: false, error: { code: 'AUTH_REQUIRED', message: 'validateSession no configurado' } };
  }

  var userId = sessionCheck.user.id;
  var isAdmin = !!sessionCheck.user.isAdmin;
  var localDb = _getDb();

  // Si pide el flag de OTRO user, validar que sea admin
  if (targetUserId && Number(targetUserId) !== userId && !isAdmin) {
    return { success: false, error: { code: 'PERMISSION_DENIED', message: 'Solo el administrador puede consultar el flag de otros usuarios.' } };
  }

  // User efectivo a consultar
  var effectiveUserId = (targetUserId && (isAdmin || Number(targetUserId) === userId))
    ? Number(targetUserId)
    : userId;

  // Admin consultando SU PROPIO flag → forzado a true (no se puede deshabilitar)
  if (isAdmin && effectiveUserId === userId) {
    return { success: true, data: { enabled: true, forced: true, isAdmin: true, userId: userId } };
  }

  // Resto de casos: leer de la BD
  try {
    var row = localDb.prepare('SELECT bandeja_integrada_enabled FROM users WHERE id = ?').get(effectiveUserId);
    if (!row) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } };
    }
    var enabled = !!(row.bandeja_integrada_enabled);
    // Si el target es admin, marcar como forced (un admin nunca queda sin acceso)
    // — pero NO necesariamente: el admin ya consulta su propio flag con el branch
    // de arriba, así que este branch es para "admin consultando a OTRO admin" o
    // "no-admin consultando a sí mismo". Devolvemos forced=false para no mentir.
    return { success: true, data: { enabled: enabled, forced: false, isAdmin: false, userId: effectiveUserId } };
  } catch (e) {
    // Si la columna no existe (migración no aplicada), retornar false
    if (/no such column/i.test(e.message)) {
      return { success: true, data: { enabled: false, forced: false, isAdmin: false, userId: effectiveUserId } };
    }
    console.error('[' + MOD + '][GET]', e.message);
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
}

// ---------- Handler: SET flag ----------
// 📦702-step3 (2026-08-13) — Acepta targetUserId opcional. Sin targetUserId
// (compat), setea el flag del USER LOGUEADO. Con targetUserId, admin puede
// setear el flag de OTRO user (no-admin). Si el target es admin, el backend
// rechaza (los admins siempre tienen acceso forzado).
function _handlerSetBandejaIntegradaFlag(token, enabled, targetUserId) {
  if (_validateSession && typeof _validateSession === 'function') {
    var sessionCheck = _validateSession(token);
    if (!sessionCheck.ok) {
      return { success: false, error: { code: 'AUTH_REQUIRED', message: sessionCheck.error?.message || 'Sesión requerida' } };
    }
  } else {
    return { success: false, error: { code: 'AUTH_REQUIRED', message: 'validateSession no configurado' } };
  }

  var userId = sessionCheck.user.id;
  var isAdmin = !!sessionCheck.user.isAdmin;

  // 🔒 Determinar el user efectivo a modificar
  var effectiveUserId = (targetUserId && Number(targetUserId) !== userId)
    ? Number(targetUserId)
    : userId;

  // Si está modificando a OTRO user, validar que sea admin
  if (effectiveUserId !== userId && !isAdmin) {
    return { success: false, error: { code: 'PERMISSION_DENIED', message: 'Solo el administrador puede modificar el flag de otros usuarios.' } };
  }

  // 🔒 El admin global NO puede deshabilitarse a sí mismo.
  // (Si el user es admin, el flag es "forced: true" siempre, no se puede cambiar).
  if (isAdmin && effectiveUserId === userId) {
    return { success: true, data: { enabled: true, forced: true, isAdmin: true, userId: userId } };
  }

  // Si es admin modificando a otro user, verificar que el target NO sea admin
  // (los admins ya tienen acceso forzado, no se les puede deshabilitar)
  if (isAdmin && effectiveUserId !== userId) {
    try {
      var localDb = _getDb();
      var targetRow = localDb.prepare('SELECT email FROM users WHERE id = ?').get(effectiveUserId);
      if (!targetRow) {
        return { success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario objetivo no encontrado.' } };
      }
      // Check si el target tiene rol "Administrador" en alguna empresa
      // (mismo criterio que validateSession: roles.some(role === 'administrador'))
      var adminRole = localDb.prepare(
        "SELECT 1 FROM user_company_roles ucr " +
        "JOIN roles r ON ucr.role_id = r.id " +
        "WHERE ucr.user_id = ? AND (LOWER(r.name) = 'administrador' OR LOWER(r.name) = 'administrador del sistema') " +
        "LIMIT 1"
      ).get(effectiveUserId);
      if (adminRole) {
        return { success: false, error: { code: 'CANNOT_MODIFY_ADMIN', message: 'Los administradores siempre tienen acceso a la Bandeja Integrada.' } };
      }
    } catch (e) {
      console.error('[' + MOD + '][SET][ADMIN-CHECK]', e.message);
      // Continuar si falla el check (no bloquear el guardado)
    }
  }

  // Para usuarios no-admin (o admin modificando a no-admin), validar el input y guardar
  var newValue = enabled ? 1 : 0;
  var localDb = _getDb();

  try {
    localDb.prepare('UPDATE users SET bandeja_integrada_enabled = ? WHERE id = ?')
      .run(newValue, effectiveUserId);
    console.log('[' + MOD + '][SET] byUserId=' + userId + ' targetUserId=' + effectiveUserId + ' enabled=' + newValue);
    return { success: true, data: { enabled: !!newValue, forced: false, isAdmin: false, userId: effectiveUserId } };
  } catch (e) {
    if (/no such column/i.test(e.message)) {
      // La columna no existe todavía, la migración no se aplicó.
      // Retornar error claro para que el admin sepa qué hacer.
      return {
        success: false,
        error: { code: 'MIGRATION_PENDING', message: 'La columna bandeja_integrada_enabled aún no existe. Reiniciar la app para aplicar la migración.' }
      };
    }
    console.error('[' + MOD + '][SET]', e.message);
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
}

// ---------- Registro de handlers IPC ----------
// 📦702-fix (2026-08-13) — La firma ahora es (app, deps) consistente con
// eventos-cumplidos-bridge.js, gestacion-bridge.js y los demás bridges del
// proyecto. Antes era (getDb, validateSession) que NO matcheaba con la
// convención, por lo que main.js llamaba con (app, { getDb, validateSession })
// y el bridge asignaba _getDb = app (objeto) y _validateSession = { ... }
// (objeto) — ambos no-funciones, por lo que el chequeo `typeof === 'function'`
// fallaba y SIEMPRE retornaba AUTH_REQUIRED. Bug reportado: admin global
// veía el alert "no tienes acceso" al abrir Bandeja Integrada.
function registerBandejaIntegradaPermissionsHandlers(app, deps) {
  _getDb = (deps && typeof deps.getDb === 'function') ? deps.getDb : null;
  _validateSession = (deps && typeof deps.validateSession === 'function') ? deps.validateSession : null;

  // GET: leer el flag del user logueado (o de un user específico si admin)
  ipcMain.handle('users-get-bandeja-integrada-flag', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      var token = params.token || '';
      var targetUserId = params.userId || params.targetUserId || null;
      if (!token) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Token requerido.' } };
      }
      return _handlerGetBandejaIntegradaFlag(token, targetUserId);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-GET]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  // SET: guardar el flag (admin global no puede deshabilitarse, pero puede
  // setear el flag de otros users no-admin)
  ipcMain.handle('users-set-bandeja-integrada-flag', async function (event, payload) {
    try {
      var params = (payload && typeof payload === 'object') ? payload : {};
      var token = params.token || '';
      var enabled = params.enabled === true || params.enabled === 1 || params.enabled === 'true';
      var targetUserId = params.userId || params.targetUserId || null;
      if (!token) {
        return { success: false, error: { code: 'INVALID_INPUT', message: 'Token requerido.' } };
      }
      return _handlerSetBandejaIntegradaFlag(token, enabled, targetUserId);
    } catch (e) {
      console.error('[' + MOD + '][HANDLER-SET]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] 2 handlers de permisos de Bandeja Integrada registrados');
}

module.exports = {
  registerBandejaIntegradaPermissionsHandlers: registerBandejaIntegradaPermissionsHandlers,
  MIGRATIONS_SQL: MIGRATIONS_SQL,
  // Exportar handlers internos para tests / debug
  _handlerGetBandejaIntegradaFlag: _handlerGetBandejaIntegradaFlag,
  _handlerSetBandejaIntegradaFlag: _handlerSetBandejaIntegradaFlag
};
