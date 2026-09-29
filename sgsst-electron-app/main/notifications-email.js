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
  'SELECT t.id AS thread_id, t.subject, t.snippet, ' +
  '  t.last_sender_name, t.last_sender_email, ' +
  '  c.email AS connection_email, c.id AS connection_id ' +
  'FROM email_threads t ' +
  'LEFT JOIN email_connections c ON c.id = t.connection_id ' +
  "WHERE t.has_unread = 1 AND t.folder = 'INBOX' " +
  'ORDER BY t.last_message_date DESC LIMIT 50';

// Fallback si el primer SELECT falla (schema sin join esperado)
var SQL_NO_LEIDOS_FALLBACK =
  'SELECT t.id AS thread_id, t.subject, t.snippet ' +
  'FROM email_threads t WHERE t.has_unread = 1 LIMIT 50';

/**
 * 📦823 — Arma el texto del remitente para el toast y la lista.
 *
 * El usuario necesita saber QUIÉN le escribió, no solo de qué trata. La BD
 * tiene `last_sender_name` + `last_sender_email` (email-schema-sql.js), pero:
 *   - el nombre suele faltar ( Gmail lo manda vacío para noreply/aliases );
 *   - a veces el "nombre" ES el email crudo ( "juan@acme.com" );
 *   - hay que recortar: los nombres largos rompen el layout del toast.
 *
 * Devuelve '' cuando no hay nada (el caller decide si omite la línea entera).
 */
function formatRemitente(nombre, email, maxLen) {
  var n = String(nombre == null ? '' : nombre).trim().replace(/\s+/g, ' ');
  var e = String(email == null ? '' : email).trim();
  var out;
  if (n && e) {
    // "Nombre (email)" salvo que el nombre ya sea el email.
    out = n.toLowerCase() === e.toLowerCase() ? e : n + ' (' + e + ')';
  } else {
    out = n || e;
  }
  var max = maxLen || 90;
  if (out.length > max) out = out.slice(0, max - 1).replace(/\s+$/, '') + '…';
  return out;
}

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

    // El buzón Gmail es GLOBAL (config.json googleOAuth; email_connections no
    // tiene columna company). Antes cada correo se atribuía a TODAS las
    // empresas habilitadas → una fila por empresa (duplicación visible en el
    // panel y en el badge). Ahora: UNA sola fila global con company_key='*',
    // visible desde cualquier empresa de la sesión (el bridge la incluye
    // siempre en listar/getUnreadCount/marcarLeida).
    if (habilitadas.length === 0) return { nuevas: nuevas };
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var key = bridge.buildDedupeKey('correo', '*', r.thread_id, null, 0);
      var remitente = formatRemitente(r.last_sender_name, r.last_sender_email);
      nuevas.push({
        tipo: 'correo',
        ref_id: String(r.thread_id),
        company_key: '*',
        // companyKey (camel): notifications-service lo lee de nuevas[0] para
        // el aviso webContents.send; company_key (snake) va al INSERT.
        companyKey: '*',
        titulo: String(r.subject || '(sin asunto)').slice(0, 200),
        resumen: String(r.snippet || '').slice(0, 80),
        // 📦823 — remitente ya formateado (nombre + email) para el toast y la
        // lista. Viene '' cuando el hilo no trae remitente: los callers lo
        // omiten en vez de inventar un texto.
        remitente: remitente,
        remitente_nombre: String(r.last_sender_name || '').trim(),
        remitente_email: String(r.last_sender_email || '').trim(),
        dedupe_key: key
      });
    }
    return { nuevas: nuevas };
  };
}

module.exports = {
  createEmailDetector: createEmailDetector,
  // Task 5 — exportados para el test (SQL alineado con email-schema-sql.js)
  SQL_NO_LEIDOS: SQL_NO_LEIDOS,
  SQL_NO_LEIDOS_FALLBACK: SQL_NO_LEIDOS_FALLBACK,
  // 📦823 — exportado para el test del formateo del remitente
  formatRemitente: formatRemitente
};
