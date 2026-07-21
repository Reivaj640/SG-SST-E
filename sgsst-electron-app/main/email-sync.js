// =====================================================================
// 📦 Bandeja Integrada — Servicio de sincronización Gmail → SQLite
// Trae threads + messages de Gmail y los guarda en el cache local.
// Inspirado en el patrón sync-threads-workflow de Mail-0/Zero pero
// simplificado para nuestro caso (sin workflows, sin colas, sin
// notificaciones push — solo sync manual o por polling).
//
// Patrón: usa googleapis (ya instalado) + shared/google-auth.js +
//          shared/google-gmail.js (lectura cruda del API).
//       Después normaliza con shared/email-normalizer.js
//       Y persiste con main/email-db.js (CRUD SQLite).
// =====================================================================

const path = require('path');
const { google } = require('googleapis');
const googleAuth = require('../shared/google-auth');
const googleGmail = require('../shared/google-gmail');
const emailDb = require('./email-db');

// =====================================================================
// Helpers
// =====================================================================

/**
 * Parsea un header RFC 2822 (From, To, etc.) a { name, email }.
 * Ej:  "María Camila Reyes <mreyes@kair-sst.co>" → { name: "María Camila Reyes", email: "mreyes@kair-sst.co" }
 *       "mreyes@kair-sst.co"                       → { name: "", email: "mreyes@kair-sst.co" }
 */
function parseAddress(s) {
  if (!s) return { name: '', email: '' };
  var str = String(s).trim();
  // Formato "Nombre <email>"
  var m = str.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) {
    return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  }
  // Formato "email" o solo "email@x.com"
  if (str.indexOf('@') >= 0) {
    return { name: '', email: str.replace(/[<>"]/g, '').trim().toLowerCase() };
  }
  return { name: str, email: '' };
}

/**
 * Parsea una lista de direcciones separadas por coma (To, Cc, Bcc).
 */
function parseAddressList(s) {
  if (!s) return [];
  return String(s).split(',').map(function (item) {
    return parseAddress(item);
  }).filter(function (a) { return a.email; });
}

/**
 * Parsea un header RFC 2822 Date a timestamp ms.
 * Si falla, devuelve Date.now() como fallback.
 */
function parseDate(s) {
  if (!s) return Date.now();
  var d = new Date(s);
  if (isNaN(d.getTime())) return Date.now();
  return d.getTime();
}

/**
 * Extrae un header específico de la lista de headers del Gmail API.
 */
function getHeader(headers, name) {
  if (!Array.isArray(headers)) return '';
  name = name.toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if ((headers[i].name || '').toLowerCase() === name) {
      return headers[i].value || '';
    }
  }
  return '';
}

// =====================================================================
// Normalización: Gmail API → objeto thread/message para SQLite
// =====================================================================

/**
 * Convierte un thread de Gmail API a nuestro formato de thread (cache).
 * @param {Object} gThread - thread de Gmail API (formato: { id, snippet, historyId, messages: [...] })
 * @param {string} connectionId - id de email_connections
 * @param {string} folder - 'INBOX' | 'SENT' | etc.
 */
function normalizeThread(gThread, connectionId, folder) {
  if (!gThread || !gThread.id) return null;
  var messages = gThread.messages || [];
  var latest = messages[messages.length - 1] || {};
  var labels = latest.labelIds || [];

  // Detectar flags
  var hasUnread = labels.indexOf('UNREAD') >= 0;
  var isStarred = labels.indexOf('STARRED') >= 0;
  var isImportant = labels.indexOf('IMPORTANT') >= 0;
  var hasAttachment = (latest.payload && latest.payload.parts &&
    latest.payload.parts.some(function (p) { return !!p.filename; })) || false;

  // From del último mensaje
  var fromStr = getHeader(latest.payload && latest.payload.headers, 'From');
  var fromParsed = parseAddress(fromStr);

  // Participantes únicos
  var participantsSet = {};
  messages.forEach(function (m) {
    var h = m.payload && m.payload.headers || [];
    ['From', 'To', 'Cc'].forEach(function (hdr) {
      var list = parseAddressList(getHeader(h, hdr));
      list.forEach(function (a) { participantsSet[a.email] = a.name || a.email; });
    });
  });

  // Subject (del último mensaje, limpiando "Re: " / "Fwd: ")
  var subject = getHeader(latest.payload && latest.payload.headers, 'Subject') || '(sin asunto)';
  subject = subject.replace(/^(\s*(Re|Fwd)\s*:\s*)+/i, '');

  return {
    id: gThread.id,
    connection_id: connectionId,
    subject: subject,
    snippet: gThread.snippet || '',
    participants: Object.keys(participantsSet).map(function (email) {
      return { email: email, name: participantsSet[email] };
    }),
    message_count: messages.length,
    has_unread: hasUnread,
    has_attachment: hasAttachment,
    is_starred: isStarred,
    is_important: isImportant,
    is_snoozed: false,
    snooze_until: null,
    folder: folder,
    label_ids: labels,
    last_message_date: parseDate(getHeader(latest.payload && latest.payload.headers, 'Date')),
    last_sender_email: fromParsed.email,
    last_sender_name: fromParsed.name,
    created_at: Date.now(),
    updated_at: Date.now()
  };
}

/**
 * Convierte un mensaje de Gmail API a nuestro formato (cache).
 */
function normalizeMessage(gMsg, threadId, connectionId) {
  if (!gMsg || !gMsg.id) return null;
  var headers = gMsg.payload && gMsg.payload.headers || [];
  var fromParsed = parseAddress(getHeader(headers, 'From'));

  // Determinar si es draft o sent
  var labelIds = gMsg.labelIds || [];
  var isDraft = labelIds.indexOf('DRAFT') >= 0;
  var isSent = labelIds.indexOf('SENT') >= 0;

  return {
    id: gMsg.id,
    thread_id: threadId,
    connection_id: connectionId,
    from_name: fromParsed.name,
    from_email: fromParsed.email,
    to_list: parseAddressList(getHeader(headers, 'To')),
    cc_list: parseAddressList(getHeader(headers, 'Cc')),
    bcc_list: parseAddressList(getHeader(headers, 'Bcc')),
    subject: getHeader(headers, 'Subject') || '(sin asunto)',
    body_plain: '', // Fase 0: dejamos vacío. Fase 1: cargar con getMessage.
    body_html: '',
    snippet: gMsg.snippet || '',
    date: parseDate(getHeader(headers, 'Date')),
    in_reply_to: getHeader(headers, 'In-Reply-To') || null,
    references: getHeader(headers, 'References') || null,
    has_attachments: !!(gMsg.payload && gMsg.payload.parts &&
      gMsg.payload.parts.some(function (p) { return !!p.filename; })),
    label_ids: labelIds,
    is_draft: isDraft,
    is_sent: isSent,
    created_at: Date.now(),
    updated_at: Date.now()
  };
}

// =====================================================================
// Sincronización Gmail → SQLite
// =====================================================================

/**
 * Sincroniza el inbox (o un folder específico) desde Gmail al cache SQLite.
 * @param {Object} options
 * @param {string} options.configPath - ruta al config.json (default: app.getPath('userData')/config.json)
 * @param {string} options.folder - folder de Gmail (default: 'INBOX')
 * @param {number} options.maxResults - máximo de threads a sincronizar (default: 50)
 * @returns {Promise<{success, data?: {synced, total, folder}, error?: string}>}
 */
async function syncInbox(options) {
  options = options || {};
  var configPath = options.configPath || (function() {
    // Fallback: intentar derivar de app.getPath si está disponible
    try { return path.join(require('electron').app.getPath('userData'), 'config.json'); }
    catch (e) { return null; }
  })();
  var folder = options.folder || 'INBOX';
  var maxResults = options.maxResults || 50;

  if (!configPath) {
    return { success: false, error: 'configPath es requerido (no se pudo derivar del app.getPath)' };
  }

  // 1. Obtener cliente OAuth autorizado
  var auth = await googleAuth.getAuthorizedClient(configPath);
  if (!auth) {
    return { success: false, error: 'No hay tokens válidos. Reconectar Gmail.' };
  }

  // 2. Obtener perfil del usuario (email + messageCount)
  var profileResult = await googleGmail.getProfile(configPath);
  if (!profileResult.success || !profileResult.data || !profileResult.data.email) {
    return { success: false, error: 'No se pudo obtener el perfil de Gmail' };
  }
  var userEmail = profileResult.data.email;

  // 3. Guardar/actualizar la conexión
  emailDb.saveConnection({
    id: userEmail,
    email: userEmail,
    provider: 'gmail',
    access_token: null, // No guardamos el access_token aquí — googleAuth lo maneja
    refresh_token: null,
    expires_at: null
  });

  // 4. Listar threads de Gmail
  var labelIds = folder === 'INBOX' ? ['INBOX'] : (folder === 'SENT' ? ['SENT'] : null);
  var listResult = await googleGmail.listInbox({
    configPath: configPath,
    folder: folder,  // F1.B-fix — Pasar folder al listInbox para que use el query correcto
    maxResults: maxResults,
    extraQuery: labelIds ? ['label:' + folder.toLowerCase()] : []
  });

  if (!listResult.success || !Array.isArray(listResult.data)) {
    return { success: false, error: 'listInbox falló: ' + (listResult.error || 'unknown') };
  }

  // 5. Limpiar threads stale del folder antes de re-insertar.
  // Razón: el UPSERT solo actualiza threads que están en el resultado del API.
  // Si un thread ya no está en Gmail (borrado, archivado en otro folder),
  // quedaría "huérfano" en el cache con datos vacíos.
  // Por eso Mail-0 hace TRUNCATE antes de re-sync — replicamos esa idea.
  try {
    var deleted = emailDb.deleteThreadsByFolder(userEmail, folder);
    if (deleted.changes > 0) {
      console.log('[email-sync] Limpiados ' + deleted.changes + ' threads stale del cache (folder=' + folder + ')');
    }
  } catch (e) {
    console.warn('[email-sync] Error limpiando threads stale:', e.message);
  }

  // 6. Por cada mensaje, construir un thread sintético con headers fake.
  // Razón: listInbox() devuelve mensajes normalizados (subject, sender, date ya extraídos),
  // pero normalizeThread() espera el formato crudo de Gmail API (payload.headers).
  // Construimos los headers a partir de los datos normalizados para reutilizar el código.
  var synced = 0;
  for (var i = 0; i < listResult.data.length; i++) {
    var normalizedMsg = listResult.data[i];
    var threadId = normalizedMsg.threadId || normalizedMsg.id;
    if (!threadId) continue;

    try {
      // Construir headers fake que normalizeThread() sabe leer
      var fakeHeaders = [
        { name: 'From', value: (normalizedMsg.sender || '') +
                              (normalizedMsg.senderEmail ? ' <' + normalizedMsg.senderEmail + '>' : '') },
        { name: 'Subject', value: normalizedMsg.subject || '(sin asunto)' },
        { name: 'Date', value: normalizedMsg.date || new Date().toUTCString() }
      ];
      var fakeThread = {
        id: threadId,
        snippet: normalizedMsg.snippet || '',
        messages: [{
          id: normalizedMsg.id,
          threadId: threadId,
          labelIds: normalizedMsg.labels || [],
          snippet: normalizedMsg.snippet || '',
          payload: { headers: fakeHeaders }
        }]
      };
      var threadObj = normalizeThread(fakeThread, userEmail, folder);
      if (threadObj) {
        // Guardar thread
        emailDb.saveThread(threadObj);
        // F4-fix — También guardar el mensaje en email_messages.
        // normalizedMsg.date viene como ISO 8601 string → convertir a ms timestamp.
        var msgDateMs = normalizedMsg.date ? new Date(normalizedMsg.date).getTime() : Date.now();
        // F4-fix2 — Extraer to_list del campo "recipient" que trae google-gmail.js.
        // Antes quedaba vacío, por eso en la UI se veía "para: ---" cuando había destinatario.
        // Loop1-fix — Para mensajes RECIBIDOS, el destinatario es la cuenta del user.
        // Para ENVIADOS, es el normalizedMsg.recipient.
        var toListParsed;
        if (normalizedMsg.recipient) {
          // Mensaje enviado: el To es el recipient
          toListParsed = parseAddressList(normalizedMsg.recipient);
        } else {
          // Mensaje recibido: el To es la cuenta del user
          toListParsed = [{ name: '', email: userEmail }];
        }
        // F1-Feature5 — Extraer attachments del mensaje para guardarlos en email_attachments
        // google-gmail.js ya devuelve attachments en normalizedMsg.attachments
        var attachments = normalizedMsg.attachments || [];
        var msgForDb = {
          id: normalizedMsg.id,
          thread_id: threadId,
          connection_id: userEmail,
          from_name: normalizedMsg.sender || '',
          from_email: normalizedMsg.senderEmail || '',
          to_list: toListParsed,
          cc_list: [],
          bcc_list: [],
          subject: normalizedMsg.subject || '',
          // Loop 40b — Usar body_plain y body_html que google-gmail.js ahora exporta.
          // Antes body_html quedaba vacío, por lo que el cache nunca tenía HTML rico
          // y la Bandeja Integrada renderizaba solo texto plano.
          body_plain: normalizedMsg.body_plain || normalizedMsg.body || '',
          body_html: normalizedMsg.body_html || '',
          snippet: normalizedMsg.snippet || '',
          date: msgDateMs,
          in_reply_to: null,
          references_header: null,
          has_attachments: !!normalizedMsg.hasAttachment,
          label_ids: normalizedMsg.labels || [],
          is_draft: false,
          is_sent: false
        };
        try {
          emailDb.saveMessage(msgForDb);
          // F1-Feature5 — Guardar los attachments de este mensaje en email_attachments
          if (attachments.length > 0) {
            // Primero borrar attachments viejos de este mensaje (por si es un update)
            try {
              emailDb.deleteAttachmentsByMessage(normalizedMsg.id);
            } catch (e) {}
            attachments.forEach(function (att) {
              try {
                emailDb.saveAttachment({
                  message_id: normalizedMsg.id,
                  filename: att.name,
                  mime_type: att.mimeType,
                  size: att.size,
                  attachment_id: att.attachmentId
                });
              } catch (attErr) {
                console.warn('[email-sync] Error guardando attachment:', attErr.message);
              }
            });
          }
        } catch (msgErr) {
          console.warn('[email-sync] Error guardando message ' + normalizedMsg.id + ':', msgErr.message);
        }
        synced++;
      }
    } catch (e) {
      console.error('[email-sync] Error guardando thread ' + threadId + ':', e.message);
    }
  }

  // 6. Guardar labels (F1-Feature1: ahora trae los labels REALES de Gmail, no solo system)
  // Primero intentar traer los labels reales del API de Gmail
  try {
    var labelsResult = await googleGmail.listLabels(configPath);
    if (labelsResult.success && Array.isArray(labelsResult.data)) {
      labelsResult.data.forEach(function (l) {
        emailDb.saveLabel({
          id: l.id,
          connection_id: userEmail,
          name: l.name,
          type: l.type,
          color_background: l.color ? l.color.background : '#a479e2',
          color_text: l.color ? l.color.text : '#ffffff',
          message_count: l.messageCount || 0,
          unread_count: l.unreadCount || 0
        });
      });
    }
  } catch (e) {
    console.warn('[email-sync] No se pudieron traer labels de Gmail:', e.message);
    // Fallback: solo labels del sistema
    var systemLabels = [
      { id: 'INBOX', name: 'INBOX', type: 'system', color_background: '#a479e2', color_text: '#ffffff', message_count: 0, unread_count: 0 },
      { id: 'SENT', name: 'SENT', type: 'system', color_background: '#16a085', color_text: '#ffffff', message_count: 0, unread_count: 0 },
      { id: 'STARRED', name: 'STARRED', type: 'system', color_background: '#fbe200', color_text: '#000000', message_count: 0, unread_count: 0 },
      { id: 'IMPORTANT', name: 'IMPORTANT', type: 'system', color_background: '#f0c674', color_text: '#000000', message_count: 0, unread_count: 0 },
      { id: 'UNREAD', name: 'UNREAD', type: 'system', color_background: '#cccccc', color_text: '#ffffff', message_count: 0, unread_count: 0 }
    ];
    systemLabels.forEach(function (l) {
      emailDb.saveLabel(Object.assign({ connection_id: userEmail }, l));
    });
  }

  return {
    success: true,
    data: {
      synced: synced,
      total: listResult.data.length,
      folder: folder,
      connectionId: userEmail
    }
  };
}

module.exports = {
  // Normalización
  normalizeThread, normalizeMessage,
  parseAddress, parseAddressList, parseDate, getHeader,
  // Sync
  syncInbox
};
