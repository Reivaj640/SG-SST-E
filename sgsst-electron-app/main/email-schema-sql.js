// =====================================================================
// 📦 Bandeja Integrada — Schema SQL para emails
// Inspirado en el modelo de datos de Mail-0/Zero
// (https://github.com/Mail-0/Zero) pero adaptado a nuestra estructura
// vanilla.js + SQLite + Electron + sin React.
//
// 5 tablas: connections, threads, messages, labels, attachments
// Patrón: mismo estilo que GESTACION_SCHEMA_SQL + GESTACION_MIGRATIONS_SQL
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - Migraciones individuales con try/catch (duplicate column = skip)
// =====================================================================

const EMAIL_SCHEMA_SQL = `
  -- 📦 Bandeja Integrada — Conexiones (multi-cuenta futuro)
  -- Por ahora solo Gmail, pero el schema soporta múltiples proveedores
  CREATE TABLE IF NOT EXISTS email_connections (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'gmail',  -- 'gmail' | 'outlook' (futuro)
    access_token TEXT,
    refresh_token TEXT,
    expires_at INTEGER,
    history_id TEXT,                          -- Gmail watch cursor (Fase 5)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- 📦 Bandeja Integrada — Threads (conversaciones)
  -- Un thread agrupa N mensajes de la misma conversación.
  -- Inspirado en Gmail threadId (varios mensajes con mismo Subject + In-Reply-To).
  CREATE TABLE IF NOT EXISTS email_threads (
    id TEXT PRIMARY KEY,                        -- Gmail threadId
    connection_id TEXT,
    subject TEXT,
    snippet TEXT,                                -- preview del último mensaje
    participants TEXT,                           -- JSON array de emails
    message_count INTEGER NOT NULL DEFAULT 0,
    has_unread INTEGER NOT NULL DEFAULT 0,
    has_attachment INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_important INTEGER NOT NULL DEFAULT 0,
    is_snoozed INTEGER NOT NULL DEFAULT 0,
    snooze_until INTEGER,
    folder TEXT NOT NULL DEFAULT 'INBOX',       -- INBOX, SENT, DRAFT, TRASH, SPAM, etc.
    label_ids TEXT,                             -- JSON array
    last_message_date INTEGER NOT NULL,         -- timestamp ms
    last_sender_email TEXT,
    last_sender_name TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_threads_date ON email_threads(last_message_date DESC);
  CREATE INDEX IF NOT EXISTS idx_threads_folder ON email_threads(folder);
  CREATE INDEX IF NOT EXISTS idx_threads_unread ON email_threads(has_unread);
  CREATE INDEX IF NOT EXISTS idx_threads_connection ON email_threads(connection_id);

  -- 📦 Bandeja Integrada — Mensajes individuales
  -- Cada mensaje pertenece a 1 thread. body_plain y body_html se cachean
  -- localmente para que abrir un email no requiera otra llamada al API.
  CREATE TABLE IF NOT EXISTS email_messages (
    id TEXT PRIMARY KEY,                        -- Gmail messageId
    thread_id TEXT NOT NULL,
    connection_id TEXT,
    from_name TEXT,
    from_email TEXT,
    to_list TEXT,                               -- JSON array de emails
    cc_list TEXT,                               -- JSON array
    bcc_list TEXT,                              -- JSON array
    subject TEXT,
    body_plain TEXT,                            -- texto plano (cache local)
    body_html TEXT,                             -- HTML original (cache local)
    snippet TEXT,                               -- Gmail snippet
    date INTEGER NOT NULL,                      -- timestamp ms (RFC 2822 parsed)
    in_reply_to TEXT,                           -- RFC 2822 In-Reply-To header
    references_header TEXT,                     -- RFC 2822 References header (renombrado porque "references" es reserved word en SQL)
    has_attachments INTEGER NOT NULL DEFAULT 0,
    label_ids TEXT,                             -- JSON array
    is_draft INTEGER NOT NULL DEFAULT 0,
    is_sent INTEGER NOT NULL DEFAULT 0,
    -- 📦647-fix2 — Headers crudos + info de seguridad parseada, para
    -- el panel "Mostrar detalles" (SPF/DKIM/DMARC/TLS, Return-Path, etc).
    -- rawHeaders: array [{name, value}] de TODOS los headers del mensaje.
    -- mailSecurity: {sentBy, signedBy, encryptedWith, spf, dkim, dmarc, arc}.
    -- Se guardan como JSON stringified. Para mensajes viejos (sin estos
    -- datos), el frontend tiene un safety net que los trae on-the-fly
    -- desde Gmail al abrir el panel.
    raw_headers TEXT,
    mail_security TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON email_messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_date ON email_messages(date DESC);
  CREATE INDEX IF NOT EXISTS idx_messages_from ON email_messages(from_email);

  -- 📦 Bandeja Integrada — Labels (cache local de Gmail labels)
  -- Permite ver colores y nombres de labels sin llamar al API.
  CREATE TABLE IF NOT EXISTS email_labels (
    id TEXT PRIMARY KEY,                        -- Gmail labelId (Label_1, Label_2, etc.)
    connection_id TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'user',          -- 'system' | 'user'
    color_background TEXT,                      -- hex color de fondo
    color_text TEXT,                            -- hex color de texto
    message_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_labels_connection ON email_labels(connection_id);

  -- 📦 Bandeja Integrada — Adjuntos
  -- Metadatos de los adjuntos. Los archivos binarios se cachean en
  -- app.getPath('userData')/email-attachments/<messageId>/<filename>
  CREATE TABLE IF NOT EXISTS email_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    attachment_id TEXT,                         -- Gmail attachmentId
    downloaded_path TEXT,                       -- ruta local del archivo cacheado
    downloaded_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_message ON email_attachments(message_id);
`;

// =====================================================================
// Migraciones idempotentes (se ejecutan DESPUÉS del CREATE TABLE).
// Cada ALTER TABLE se ejecuta individualmente con try/catch: si la columna
// ya existe, SQLite lanza "duplicate column" que se ignora silenciosamente.
// Esto permite evolucionar el schema sin sistema de versiones formal.
//
// Mismo patrón que GESTACION_MIGRATIONS_SQL en main.js.
// =====================================================================
const EMAIL_MIGRATIONS_SQL = [
  // 📦647-fix2 — Columnas para "Mostrar detalles" (headers + seguridad).
  // Idempotentes: si la columna ya existe, SQLite lanza "duplicate column"
  // que se ignora silenciosamente.
  'ALTER TABLE email_messages ADD COLUMN raw_headers TEXT;',
  'ALTER TABLE email_messages ADD COLUMN mail_security TEXT;',
];

module.exports = {
  EMAIL_SCHEMA_SQL,
  EMAIL_MIGRATIONS_SQL
};
