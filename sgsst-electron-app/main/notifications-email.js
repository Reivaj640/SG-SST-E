'use strict';
var bridge = require('./notifications-bridge.js');

// Consulta real (Task 5): schema verificado contra email-schema-sql.js y la
// base real (kair.db). email_threads: id (PK), connection_id, has_unread,
// folder, last_message_date. email_connections NO tiene columna company
// (verificado: id/email/provider/tokens) y la conexión Gmail es GLOBAL
// (config.json googleOAuth) — el mapeo conexión→empresa se documenta en el
// detector: cada correo se atribuye a las empresas habilitadas (el mismo
// buzón se ve desde cualquier empresa). OJO: conservar el par `has_unread` +
// `SELECT` (el fallback lo usa el test de regresión).
var SQL_NO_LEIDOS =
  'SELECT t.id AS thread_id, t.subject, t.snippet, c.email AS connection_email, c.id AS connection_id ' +
  'FROM email_threads t ' +
  'LEFT JOIN email_connections c ON c.id = t.connection_id ' +
  "WHERE t.has_unread = 1 AND t.folder = 'INBOX' " +
  'ORDER BY t.last_message_date DESC LIMIT 50';

// Fallback si el primer SELECT falla (schema sin join esperado)
var SQL_NO_LEIDOS_FALLBACK =
  'SELECT t.id AS thread_id, t.subject, t.snippet ' +
  'FROM email_threads t WHERE t.has_unread = 1 LIMIT 50';

/**
 * Crea el detector de correos. No llama Gmail directamente:
 * lee email_threads con has_unread=1 y, si trySync lo permite,
 * dispara un sync (reutilizar email-sync.syncInbox) antes de leer.
 */
function createEmailDetector(deps) {
  deps = deps || {};
  var getDb = deps.getDb;
  var bandejaEnabledFor = deps.bandejaEnabledFor || function () { return false; };
  var trySync = deps.trySync || async function () { return false; };

  return async function detect(opts) {
    opts = opts || {};
    var companies = opts.companies || [];
    var nuevas = [];
    if (!getDb) return { nuevas: nuevas };
    var db = getDb();
    if (!db) return { nuevas: nuevas };

    // 1) intentar sync SOLO si hay empresas con flag: sin habilitadas, el
    //    trySync (que sincroniza INBOX completo sin mirar el argumento) sería
    //    cuota de Gmail gastada para nada (best-effort, no bloqueante).
    var habilitadas = companies.filter(bandejaEnabledFor);
    if (habilitadas.length > 0) {
      try { await trySync(habilitadas); } catch (e) { /* seguir con cache */ }
    }

    // 2) leer no leídos del cache
    var rows = [];
    try {
      rows = db.prepare(SQL_NO_LEIDOS).all();
    } catch (e) {
      // schema real puede no tener company en threads: join connections si existe
      try {
        rows = db.prepare(SQL_NO_LEIDOS_FALLBACK).all();
      } catch (e2) {
        return { nuevas: nuevas };
      }
    }

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      // Mapeo conexión→empresa (Task 5): si la fila trae empresa (schema
      // futuro con company por conexión) se usa; si no (schema real), el
      // correo se atribuye a TODAS las empresas habilitadas — el buzón es
      // global y el aviso debe ser visible en cada contexto de empresa.
      var empresasDeEste = r.company_key ? [r.company_key] : companies;
      for (var c = 0; c < empresasDeEste.length; c++) {
        var emp = empresasDeEste[c];
        if (!emp) continue;
        if (companies.length && companies.indexOf(emp) === -1) continue;
        if (!bandejaEnabledFor(emp)) continue;
        var key = bridge.buildDedupeKey('correo', emp, r.thread_id, null, 0);
        nuevas.push({
          tipo: 'correo',
          ref_id: String(r.thread_id),
          company_key: emp,
          // companyKey (camel) también: notifications-service lo lee de nuevas[0]
          // para el aviso webContents.send; company_key (snake) va al INSERT.
          companyKey: emp,
          titulo: String(r.subject || '(sin asunto)').slice(0, 200),
          resumen: String(r.snippet || '').slice(0, 80),
          dedupe_key: key
        });
      }
    }
    return { nuevas: nuevas };
  };
}

module.exports = {
  createEmailDetector: createEmailDetector,
  // Task 5 — exportados para el test (SQL alineado con email-schema-sql.js)
  SQL_NO_LEIDOS: SQL_NO_LEIDOS,
  SQL_NO_LEIDOS_FALLBACK: SQL_NO_LEIDOS_FALLBACK
};
