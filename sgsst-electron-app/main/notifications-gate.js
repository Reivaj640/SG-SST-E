/**
 * notifications-gate.js
 * Gate real de bandeja para el detector de correos de notificaciones.
 * Mismo criterio que bandeja-integrada-permissions-bridge (📦702):
 *   - admin (validateSession.user.isAdmin) → SIEMPRE true (forzado en backend)
 *   - resto de users → users.bandeja_integrada_enabled = 1
 *
 * El proceso main no tiene sesión propia (el token viaja por IPC): resuelve
 * el user de la sesión ACTIVA más reciente (app de escritorio: un user
 * logueado a la vez, sesiones con expires_at ISO). Sin sesión activa →
 * false (fail-closed, mismo criterio que applyBandejaIntegradaVisibility
 * en renderer.js: si no se puede determinar, mejor ocultar que mostrar).
 *
 * La lógica de admin NO se duplica: se delega en validateSession inyectada
 * (la misma que usa el bridge de permisos).
 */
'use strict';

function createBandejaGate(deps) {
  deps = deps || {};
  var getDb = deps.getDb;
  var validateSession = deps.validateSession || function () { return { ok: false }; };
  var nowMs = deps.nowMs || function () { return Date.now(); };

  return function bandejaEnabledFor() {
    try {
      if (typeof getDb !== 'function') return false;
      var db = getDb();
      if (!db) return false;
      // 1. Sesión activa más reciente (expires_at ISO > ahora)
      var s = db.prepare(
        'SELECT token FROM sessions WHERE expires_at > ? ORDER BY created_at DESC LIMIT 1'
      ).get(new Date(nowMs()).toISOString());
      if (!s || !s.token) return false;
      // 2. Mismo criterio que el bridge de permisos, vía validateSession
      var sess = validateSession(s.token);
      if (!sess || !sess.ok || !sess.user) return false;
      if (sess.user.isAdmin) return true;
      // 3. Resto de users: flag de bandeja
      var row = db.prepare(
        'SELECT bandeja_integrada_enabled FROM users WHERE id = ? LIMIT 1'
      ).get(sess.user.id);
      return !!(row && row.bandeja_integrada_enabled);
    } catch (e) {
      return false;
    }
  };
}

module.exports = { createBandejaGate: createBandejaGate };
