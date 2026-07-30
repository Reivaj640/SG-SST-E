// =====================================================================
// 📦 Bandeja Integrada — Operaciones SQLite para emails
// Capa de acceso a datos. Patrón estilo Repository.
// Se ejecuta en el main process (Node.js), NO en el renderer.
//
// Inspirado en el patrón de Mail-0/Zero (apps/server/src/db/schema.ts +
// lib/server-utils.ts) pero adaptado a vanilla.js + better-sqlite3.
// =====================================================================

const { getDb } = require('./db-instance');

// Helper: obtiene la instancia de DB. La llama en cada operación
// (no en module-load) porque main.js puede llamar a setDb() DESPUÉS
// de que este módulo se cargue. Patrón de inicialización tardía.
function db() {
  var instance = getDb();
  if (!instance) {
    throw new Error('[email-db] db-instance.js no provee una conexión SQLite. Verifica que main.js haya llamado initDbOnce() antes de usar este módulo.');
  }
  return instance;
}

// =====================================================================
// 📦 CONEXIONES (multi-cuenta futuro)
// =====================================================================

/**
 * Guarda o actualiza una conexión (tokens OAuth de Gmail/Outlook).
 * Upsert por `id` (que es el email normalizado).
 */
function saveConnection(conn) {
  const stmt = db().prepare(`
    INSERT INTO email_connections
      (id, email, provider, access_token, refresh_token, expires_at, history_id, created_at, updated_at)
    VALUES
      (@id, @email, @provider, @access_token, @refresh_token, @expires_at, @history_id, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      history_id = excluded.history_id,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  return stmt.run({
    id: conn.id,
    email: conn.email,
    provider: conn.provider || 'gmail',
    access_token: conn.access_token || null,
    refresh_token: conn.refresh_token || null,
    expires_at: conn.expires_at || null,
    history_id: conn.history_id || null,
    created_at: conn.created_at || now,
    updated_at: now
  });
}

function getConnection(email) {
  return db().prepare('SELECT * FROM email_connections WHERE id = ? OR email = ? LIMIT 1').get(email, email);
}

function getAllConnections() {
  return db().prepare('SELECT * FROM email_connections ORDER BY created_at ASC').all();
}

// =====================================================================
// 📦 THREADS (conversaciones)
// =====================================================================

/**
 * Upsert un thread. Si el thread ya existe, actualiza los campos
 * (especialmente last_message_date, has_unread, has_attachment).
 */
function saveThread(thread) {
  const stmt = db().prepare(`
    INSERT INTO email_threads
      (id, connection_id, subject, snippet, participants, message_count,
       has_unread, has_attachment, is_starred, is_important, is_snoozed, snooze_until,
       folder, label_ids, last_message_date, last_sender_email, last_sender_name,
       created_at, updated_at)
    VALUES
      (@id, @connection_id, @subject, @snippet, @participants, @message_count,
       @has_unread, @has_attachment, @is_starred, @is_important, @is_snoozed, @snooze_until,
       @folder, @label_ids, @last_message_date, @last_sender_email, @last_sender_name,
       @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      subject = excluded.subject,
      snippet = excluded.snippet,
      participants = excluded.participants,
      message_count = excluded.message_count,
      has_unread = excluded.has_unread,
      has_attachment = excluded.has_attachment,
      is_starred = excluded.is_starred,
      is_important = excluded.is_important,
      is_snoozed = excluded.is_snoozed,
      snooze_until = excluded.snooze_until,
      folder = excluded.folder,
      label_ids = excluded.label_ids,
      last_message_date = excluded.last_message_date,
      last_sender_email = excluded.last_sender_email,
      last_sender_name = excluded.last_sender_name,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  return stmt.run({
    id: thread.id,
    connection_id: thread.connection_id || null,
    subject: thread.subject || '',
    snippet: thread.snippet || '',
    participants: JSON.stringify(thread.participants || []),
    message_count: thread.message_count || 0,
    has_unread: thread.has_unread ? 1 : 0,
    has_attachment: thread.has_attachment ? 1 : 0,
    is_starred: thread.is_starred ? 1 : 0,
    is_important: thread.is_important ? 1 : 0,
    is_snoozed: thread.is_snoozed ? 1 : 0,
    snooze_until: thread.snooze_until || null,
    folder: thread.folder || 'INBOX',
    label_ids: JSON.stringify(thread.label_ids || []),
    last_message_date: thread.last_message_date || now,
    last_sender_email: thread.last_sender_email || null,
    last_sender_name: thread.last_sender_name || null,
    created_at: thread.created_at || now,
    updated_at: now
  });
}

/**
 * Lee los threads del cache local, ordenados por last_message_date DESC.
 * Filtros opcionales: folder (default 'INBOX'), maxResults, searchQuery.
 */
function getThreadsFromCache(options) {
  options = options || {};
  const folder = options.folder || 'INBOX';
  const maxResults = options.maxResults || 50;
  const onlyUnread = options.onlyUnread || false;
  const searchQuery = (options.searchQuery || '').toLowerCase().trim();

  // Filtro de búsqueda básico: subject, snippet, last_sender_email, last_sender_name
  // Para Fase 4 (búsqueda con operadores) lo extendemos.
  let where = 'folder = @folder';
  const params = { folder: folder, maxResults: maxResults };
  if (onlyUnread) {
    where += ' AND has_unread = 1';
  }
  if (searchQuery) {
    where += ' AND (LOWER(subject) LIKE @sq OR LOWER(snippet) LIKE @sq OR LOWER(last_sender_email) LIKE @sq OR LOWER(last_sender_name) LIKE @sq)';
    params.sq = '%' + searchQuery + '%';
  }

  const rows = db().prepare(`
    SELECT * FROM email_threads
    WHERE ${where}
    ORDER BY last_message_date DESC
    LIMIT @maxResults
  `).all(params);

  // Deserializar JSON fields
  return rows.map(deserializeThread);
}

function getThreadFromCache(threadId) {
  const row = db().prepare('SELECT * FROM email_threads WHERE id = ? LIMIT 1').get(threadId);
  return row ? deserializeThread(row) : null;
}

function deserializeThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    connection_id: row.connection_id,
    subject: row.subject,
    snippet: row.snippet,
    participants: safeJSON(row.participants, []),
    message_count: row.message_count,
    has_unread: !!row.has_unread,
    has_attachment: !!row.has_attachment,
    is_starred: !!row.is_starred,
    is_important: !!row.is_important,
    is_snoozed: !!row.is_snoozed,
    snooze_until: row.snooze_until,
    folder: row.folder,
    label_ids: safeJSON(row.label_ids, []),
    last_message_date: row.last_message_date,
    last_sender_email: row.last_sender_email,
    last_sender_name: row.last_sender_name,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Borra todos los threads de un folder específico.
 * Se usa en sync para limpiar entries stale antes de re-insertar.
 * Inspirado en el patrón de Mail-0/Zero que hace TRUNCATE antes de re-sync.
 */
function deleteThreadsByFolder(connectionId, folder) {
  const stmt = db().prepare(`
    DELETE FROM email_threads
    WHERE connection_id = ? AND folder = ?
  `);
  return stmt.run(connectionId, folder);
}

/**
 * Borra threads específicos por ID.
 * Usado en sync para eliminar solo los threads HUÉRFANOS (los que ya no
 * están en Gmail: fueron borrados, archivados en otro folder, etc).
 * A diferencia de deleteThreadsByFolder, este NO borra los threads activos
 * que están en el resultado del API.
 */
function deleteThreadsByIds(connectionId, threadIds) {
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return { changes: 0 };
  }
  const placeholders = threadIds.map(() => '?').join(',');
  const stmt = db().prepare(`
    DELETE FROM email_threads
    WHERE connection_id = ? AND id IN (${placeholders})
  `);
  return stmt.run(connectionId, ...threadIds);
}

// =====================================================================
// 📦 MENSAJES (pertenecen a un thread)
// =====================================================================

/**
 * Upsert un mensaje. Si ya existe, actualiza.
 */
function saveMessage(msg) {
  // IMPORTANTE: la columna en SQLite es `references_header` (no `references`)
  // porque "references" es palabra reservada en SQLite. Lo renombramos
  // tanto en el schema como en este INSERT para evitar "syntax error".
  const stmt = db().prepare(`
    INSERT INTO email_messages
      (id, thread_id, connection_id, from_name, from_email, to_list, cc_list, bcc_list,
       subject, body_plain, body_html, snippet, date, in_reply_to, references_header,
       has_attachments, label_ids, is_draft, is_sent, created_at, updated_at)
    VALUES
      (@id, @thread_id, @connection_id, @from_name, @from_email, @to_list, @cc_list, @bcc_list,
       @subject, @body_plain, @body_html, @snippet, @date, @in_reply_to, @references_header,
       @has_attachments, @label_ids, @is_draft, @is_sent, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      body_plain = excluded.body_plain,
      body_html = excluded.body_html,
      snippet = excluded.snippet,
      label_ids = excluded.label_ids,
      has_attachments = excluded.has_attachments,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  return stmt.run({
    id: msg.id,
    thread_id: msg.thread_id,
    connection_id: msg.connection_id || null,
    from_name: msg.from_name || '',
    from_email: msg.from_email || '',
    to_list: JSON.stringify(msg.to_list || []),
    cc_list: JSON.stringify(msg.cc_list || []),
    bcc_list: JSON.stringify(msg.bcc_list || []),
    subject: msg.subject || '',
    body_plain: msg.body_plain || '',
    body_html: msg.body_html || '',
    snippet: msg.snippet || '',
    date: msg.date || now,
    in_reply_to: msg.in_reply_to || null,
    references_header: msg.references || null,
    has_attachments: msg.has_attachments ? 1 : 0,
    label_ids: JSON.stringify(msg.label_ids || []),
    is_draft: msg.is_draft ? 1 : 0,
    is_sent: msg.is_sent ? 1 : 0,
    created_at: msg.created_at || now,
    updated_at: now
  });

  // Loop2-fix — Marcar el thread como NO LEÍDO si el mensaje NO es del user.
  // Si el user recibió un correo nuevo (o le respondieron), el thread debe
  // marcarse como no leído para que aparezca con el dot azul.
  // Si el mensaje es del user (is_sent=true), NO marcar como no leído.
  if (msg.thread_id && !msg.is_sent) {
    try {
      db().prepare('UPDATE email_threads SET has_unread = 1 WHERE id = ?').run(msg.thread_id);
    } catch (e) {
      // No crítico, solo es un flag
    }
  }
}

/**
 * Lee todos los mensajes de un thread, ordenados por date ASC (más viejo primero).
 */
function getMessagesFromCache(threadId) {
  const rows = db().prepare(`
    SELECT * FROM email_messages
    WHERE thread_id = ?
    ORDER BY date ASC
  `).all(threadId);
  return rows.map(deserializeMessage);
}

/**
 * Propaga un cambio de label 'UNREAD' a un thread completo (has_unread + label_ids).
 * Se usa desde los handlers de main.js (mark-read / mark-thread-read) para
 * mantener el cache SQLite consistente con Gmail.
 *
 * CRITICO: el parametro suele ser un threadId (no un messageId), porque el
 * renderer envia mail.id que viene de threadToMail(thread) (ver
 * renderer/bandeja-integrada/app.js:1251). El render del mail lee
 * `unread` desde `thread.has_unread` (línea 1260), asi que actualizar
 * email_threads.has_unread es OBLIGATORIO para que el cambio persista.
 *
 * Tambien actualiza email_messages.label_ids para mantener sincronizados
 * los labels a nivel de message (usados en getMessagesFromCache).
 *
 * Resolucion del threadId: se prueba primero como threadId (caso comun
 * desde el renderer), y como fallback se busca como messageId.
 *
 * @param {string} messageOrThreadId - threadId (caso comun) o messageId
 * @param {boolean} add - true para agregar 'UNREAD', false para remover
 */
function propagateUnreadChange(messageOrThreadId, add) {
  // Resolver threadId: probar primero como threadId (mas probable desde renderer)
  let threadId = null;
  const thread = db().prepare('SELECT id FROM email_threads WHERE id = ? LIMIT 1').get(messageOrThreadId);
  if (thread) {
    threadId = thread.id;
  } else {
    // Fallback: tratar como messageId y derivar el threadId
    const msg = db().prepare('SELECT thread_id FROM email_messages WHERE id = ? LIMIT 1').get(messageOrThreadId);
    if (msg) threadId = msg.thread_id;
  }
  if (!threadId) return;

  const now = Date.now();

  // 1. Actualizar has_unread del thread (esto es lo que ve el render)
  db().prepare('UPDATE email_threads SET has_unread = ? WHERE id = ?').run(add ? 1 : 0, threadId);

  // 2. Actualizar label_ids de todos los messages del thread (sincronizacion completa)
  const rows = db().prepare('SELECT id, label_ids FROM email_messages WHERE thread_id = ?').all(threadId);
  for (const row of rows) {
    let labels = safeJSON(row.label_ids, []);
    if (add) {
      if (!labels.includes('UNREAD')) labels.push('UNREAD');
    } else {
      labels = labels.filter(l => l !== 'UNREAD');
    }
    db().prepare('UPDATE email_messages SET label_ids = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(labels), now, row.id);
  }
}

function deserializeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    thread_id: row.thread_id,
    connection_id: row.connection_id,
    from_name: row.from_name,
    from_email: row.from_email,
    to_list: safeJSON(row.to_list, []),
    cc_list: safeJSON(row.cc_list, []),
    bcc_list: safeJSON(row.bcc_list, []),
    subject: row.subject,
    body_plain: row.body_plain,
    body_html: row.body_html,
    snippet: row.snippet,
    date: row.date,
    in_reply_to: row.in_reply_to,
    references: row.references,
    has_attachments: !!row.has_attachments,
    label_ids: safeJSON(row.label_ids, []),
    is_draft: !!row.is_draft,
    is_sent: !!row.is_sent,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// =====================================================================
// 📦 LABELS (cache local de Gmail labels)
// =====================================================================

function saveLabel(label) {
  const stmt = db().prepare(`
    INSERT INTO email_labels
      (id, connection_id, name, type, color_background, color_text,
       message_count, unread_count, created_at, updated_at)
    VALUES
      (@id, @connection_id, @name, @type, @color_background, @color_text,
       @message_count, @unread_count, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      color_background = excluded.color_background,
      color_text = excluded.color_text,
      message_count = excluded.message_count,
      unread_count = excluded.unread_count,
      updated_at = excluded.updated_at
  `);
  const now = Date.now();
  return stmt.run({
    id: label.id,
    connection_id: label.connection_id || null,
    name: label.name,
    type: label.type || 'user',
    color_background: label.color_background || null,
    color_text: label.color_text || null,
    message_count: label.message_count || 0,
    unread_count: label.unread_count || 0,
    created_at: label.created_at || now,
    updated_at: now
  });
}

function getLabelsFromCache(connectionId) {
  const rows = db().prepare(`
    SELECT * FROM email_labels
    WHERE connection_id = ? OR connection_id IS NULL
    ORDER BY type DESC, name ASC
  `).all(connectionId);
  return rows;
}

// =====================================================================
// 📦 ADJUNTOS (attachments de cada mensaje)
// =====================================================================

function saveAttachment(att) {
  const stmt = db().prepare(`
    INSERT INTO email_attachments
      (message_id, filename, mime_type, size, attachment_id, created_at)
    VALUES
      (@message_id, @filename, @mime_type, @size, @attachment_id, @created_at)
  `);
  return stmt.run({
    message_id: att.message_id,
    filename: att.filename || 'archivo_sin_nombre',
    mime_type: att.mime_type || 'application/octet-stream',
    size: att.size || 0,
    attachment_id: att.attachment_id || null,
    created_at: Date.now()
  });
}

function deleteAttachmentsByMessage(messageId) {
  const stmt = db().prepare('DELETE FROM email_attachments WHERE message_id = ?');
  return stmt.run(messageId);
}

function getAttachmentsByMessage(messageId) {
  return db().prepare(`
    SELECT * FROM email_attachments WHERE message_id = ? ORDER BY filename ASC
  `).all(messageId);
}

// =====================================================================
// 📦 UTILIDADES
// =====================================================================

function safeJSON(s, fallback) {
  if (!s) return fallback;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

/**
 * Estadísticas del cache local (para mostrar "157 correos" en el footer).
 */
function getCacheStats(connectionId) {
  const conn = connectionId || null;
  const where = conn ? 'WHERE connection_id = ?' : '';
  const params = conn ? [conn] : [];
  const total = db().prepare(`SELECT COUNT(*) AS c FROM email_threads ${where}`).get(...params).c;
  const unread = db().prepare(`SELECT COUNT(*) AS c FROM email_threads ${where} ${conn ? 'AND' : 'WHERE'} has_unread = 1`).get(...params).c;
  const labels = db().prepare(`SELECT COUNT(*) AS c FROM email_labels ${where}`).get(...params).c;
  return { threads: total, unread: unread, labels: labels };
}

module.exports = {
  // Conexiones
  saveConnection, getConnection, getAllConnections,
  // Threads
  saveThread, getThreadsFromCache, getThreadFromCache, deleteThreadsByFolder, deleteThreadsByIds,
  // Mensajes
  saveMessage, getMessagesFromCache, propagateUnreadChange,
  // Labels
  saveLabel, getLabelsFromCache,
  // Adjuntos (F1-Feature5)
  saveAttachment, deleteAttachmentsByMessage, getAttachmentsByMessage,
  // Utilidades
  getCacheStats
};
