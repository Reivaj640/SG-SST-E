// F3.B — Google Gmail reader.
// Lee correos de Gmail usando el cliente OAuth2 ya autorizado.
// Devuelve correos en formato compatible con la Bandeja Integrada:
//
//   {
//     id: string,             // Gmail message ID
//     threadId: string,
//     subject: string,
//     sender: string,         // "Nombre <email>"
//     senderEmail: string,
//     recipient: string,
//     snippet: string,
//     date: string,           // ISO 8601
//     unread: boolean,
//     labels: string[],
//     hasAttachment: boolean,
//     meetingSuggestion: {    // null si no hay invitación
//       title: string,
//       date: string,
//       startHour: number,
//       durationHours: number,
//       location: string,
//       attendees: string[]
//     } | null,
//     body: string,           // texto plano (recortado)
//     attachments: [{ name, size, mimeType }]
//   }

const { google } = require('googleapis');
const googleAuth = require('./google-auth');

/**
 * Lista los últimos N mensajes de la bandeja de entrada.
 * Por defecto solo del inbox principal (label INBOX), excluyendo spam/trash.
 *
 * @param {Object} options
 * @param {string} options.configPath - ruta al config.json
 * @param {number} options.maxResults - cuántos correos traer (default 20)
 * @param {string[]} options.extraQuery - parámetros extra de búsqueda (ej: ['is:unread'])
 * @returns {Promise<{success, data?: Array, error?: string}>}
 */
async function listInbox(options) {
  options = options || {};
  var configPath = options.configPath;
  var maxResults = options.maxResults || 20;
  var extraQuery = options.extraQuery || [];

  var auth = await googleAuth.getAuthorizedClient(configPath);
  if (!auth) {
    return { success: false, error: 'No hay cliente OAuth autorizado. Conectá Gmail primero.' };
  }

  var gmail = google.gmail({ version: 'v1', auth: auth });

  try {
    // 1) Listar IDs de mensajes
    // F1.B-fix — Soporte para folder SENT (correos enviados).
    // Antes solo filtraba por `in:inbox`. Ahora si options.folder === 'SENT' usa `in:sent`.
    var query;
    if (options.folder === 'SENT') {
      query = ['in:sent'].concat(extraQuery).join(' ');
    } else if (options.folder === 'DRAFTS') {
      query = ['in:drafts'].concat(extraQuery).join(' ');
    } else {
      query = ['in:inbox'].concat(extraQuery).join(' ');
    }
    var listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: maxResults
    });

    var messages = listRes.data.messages || [];
    if (messages.length === 0) {
      return { success: true, data: [] };
    }

    // 2) Obtener detalles de cada mensaje en paralelo
    // F4 — Usar format:'full' en vez de 'metadata' para traer el body del correo.
    // El body es necesario para que la Bandeja Integrada muestre el contenido
    // real del correo (no solo headers + snippet).
    var detailPromises = messages.map(function (m) {
      return gmail.users.messages.get({
        userId: 'me',
        id: m.id,
        format: 'full'
      }).catch(function (e) {
        console.warn('[GoogleGmail] Error en message.get ' + m.id + ':', e.message);
        return null;
      });
    });
    var details = await Promise.all(detailPromises);

    // 3) Normalizar al formato Bandeja Integrada
    var normalized = details.filter(function (d) { return d !== null; }).map(function (d) {
      return normalizeMessage(d.data);
    });

    return { success: true, data: normalized };
  } catch (e) {
    console.error('[GoogleGmail] Error en listInbox:', e);
    return { success: false, error: e.message || 'Error leyendo bandeja' };
  }
}

/**
 * Obtiene un mensaje completo por ID (incluye body y attachments).
 */
async function getMessage(messageId, options) {
  options = options || {};
  var configPath = options.configPath;

  var auth = await googleAuth.getAuthorizedClient(configPath);
  if (!auth) {
    return { success: false, error: 'No hay cliente OAuth autorizado' };
  }

  var gmail = google.gmail({ version: 'v1', auth: auth });
  try {
    var res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    return { success: true, data: normalizeMessage(res.data, true) };
  } catch (e) {
    console.error('[GoogleGmail] Error en getMessage:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 📦647-fix2 — Parsea info de seguridad del correo desde los headers.
 * Devuelve un objeto con:
 *   - sentBy: dominio del Return-Path (quién envió realmente el correo)
 *   - signedBy: dominio del DKIM-Signature (quién lo firmó)
 *   - encryptedWith: protocolo TLS usado (de Received o Authentication-Results)
 *   - spf: 'pass' | 'fail' | 'neutral' | 'softfail' | 'none' | null
 *   - dkim: 'pass' | 'fail' | 'neutral' | 'none' | null
 *   - dmarc: 'pass' | 'fail' | 'none' | null
 *   - arc: 'pass' | 'fail' | 'none' | null (opcional)
 *
 * Fuentes:
 *   - Return-Path: <bounce+xyz@gmail.com> → domain = "gmail.com"
 *   - DKIM-Signature: ...; d=gmail.com; ... → domain = "gmail.com"
 *   - Authentication-Results: spf=pass dkim=pass dmarc=pass header.d=gmail.com
 *
 * Si falta algún dato, devuelve null para ese campo.
 */
function parseMailSecurity(rawHeaders, headersLower) {
  if (!rawHeaders || rawHeaders.length === 0) return null;
  var result = { sentBy: null, signedBy: null, encryptedWith: null, spf: null, dkim: null, dmarc: null, arc: null };

  // Return-Path: extraer dominio
  var returnPath = headersLower['return-path'] || '';
  var returnPathMatch = returnPath.match(/@([\w.-]+)/);
  if (returnPathMatch) result.sentBy = returnPathMatch[1].toLowerCase();

  // DKIM-Signature: extraer el parámetro d=
  var dkimSig = headersLower['dkim-signature'] || '';
  var dMatch = dkimSig.match(/\bd=([\w.-]+)/);
  if (dMatch) result.signedBy = dMatch[1].toLowerCase();

  // Authentication-Results: parsear spf, dkim, dmarc
  var authResults = headersLower['authentication-results'] || '';
  if (authResults) {
    // Ejemplo: "mx.google.com; dkim=pass header.i=@gmail.com header.s=20230601 header.b=xxx; spf=pass ...; dmarc=pass ..."
    var spfMatch = authResults.match(/\bspf=(\w+)/);
    if (spfMatch) result.spf = spfMatch[1].toLowerCase();
    var dkimMatch = authResults.match(/\bdkim=(\w+)/);
    if (dkimMatch) result.dkim = dkimMatch[1].toLowerCase();
    var dmarcMatch = authResults.match(/\b\bdmarc=(\w+)/);
    if (dmarcMatch) result.dmarc = dmarcMatch[1].toLowerCase();
    // ARC-Authentication-Results puede venir separado
    var arcResults = headersLower['arc-authentication-results'] || '';
    if (arcResults) {
      var arcMatch = arcResults.match(/\b(?:spf|dkim|dmarc)=(\w+)/);
      if (arcMatch) result.arc = arcMatch[1].toLowerCase();
    }
  }

  // Encrypted: si el último Received tiene "version=TLSv1.X" o "using TLSv1.X"
  // Buscar el ÚLTIMO Received (los de servidores que recibieron)
  var lastReceived = null;
  for (var i = rawHeaders.length - 1; i >= 0; i--) {
    if (String(rawHeaders[i].name || '').toLowerCase() === 'received') {
      lastReceived = String(rawHeaders[i].value || '');
      break;
    }
  }
  if (lastReceived) {
    var tlsMatch = lastReceived.match(/\(version=(TLSv[\d.]+)\s+cipher=([\w_-]+)/i)
                || lastReceived.match(/\busing\s+(TLSv[\d.]+)\b/i)
                || lastReceived.match(/\(using\s+(TLSv[\d.]+)\)/i);
    if (tlsMatch) {
      result.encryptedWith = tlsMatch[1];
    }
  }

  return result;
}

/**
 * Normaliza un mensaje de Gmail API al formato Bandeja Integrada.
 */
function normalizeMessage(msg, includeBody) {
  var headers = {};
  (msg.payload && msg.payload.headers || []).forEach(function (h) {
    headers[h.name.toLowerCase()] = h.value;
  });

  var sender = headers['from'] || '';
  var senderMatch = sender.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  var senderName = senderMatch && senderMatch[1] ? senderMatch[1].trim() : sender;
  var senderEmail = senderMatch && senderMatch[2] ? senderMatch[2].trim() : sender;

  // Extraer "iniciales" del nombre para el avatar
  var initials = senderName
    .split(' ')
    .map(function (p) { return p[0]; })
    .filter(function (c) { return c; })
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  // Determinar si está no leído
  var labelIds = msg.labelIds || [];
  var unread = labelIds.indexOf('UNREAD') !== -1;

  // Detectar invitaciones a calendario (heurística simple)
  var subject = headers['subject'] || '(sin asunto)';
  var meetingSuggestion = null;
  if (/invit|meeting|reunión|convoc|comité/i.test(subject)) {
    // Esto es una heurística muy básica. La Bandeja Integrada puede mejorar
    // parseando el body cuando se abra el detalle (F3.B.2).
    meetingSuggestion = {
      title: subject.replace(/^(re:|fwd:|fw:)\s*/i, ''),
      date: null,    // se llena al abrir detalle
      startHour: null,
      durationHours: null,
      location: null,
      attendees: []
    };
  }

  // Color de avatar derivado del email (consistente)
  var avatarColor = '#' + stringToColor(senderEmail);

  // 📦647-fix2 — Guardar TODOS los headers de Gmail como array crudo.
  // Antes solo se exponían 4 headers (from, to, subject, date). Ahora se
  // guarda la lista completa para que el frontend pueda parsear SPF/DKIM/
  // DMARC/TLS, Return-Path, etc. cuando el user abre "Mostrar detalles".
  var rawHeaders = (msg.payload && msg.payload.headers || []).map(function (h) {
    return { name: String(h.name || ''), value: String(h.value || '') };
  });

  // 📦647-fix2 — Parsear info de seguridad desde los headers de Gmail.
  // Gmail ya hace SPF/DKIM/DMARC en el header "Authentication-Results".
  // El header "Return-Path" tiene el dominio que envió. El header
  // "DKIM-Signature" tiene el dominio firmante (parámetro d=).
  var mailSecurity = parseMailSecurity(rawHeaders, headers);

  var result = {
    id: msg.id,
    threadId: msg.threadId,
    subject: subject,
    sender: senderName,
    senderEmail: senderEmail,
    recipient: headers['to'] || '',
    snippet: msg.snippet || '',
    date: headers['date'] || new Date(parseInt(msg.internalDate || Date.now())).toISOString(),
    unread: unread,
    labels: labelIds,
    hasAttachment: !!(msg.payload && msg.payload.parts && msg.payload.parts.some(function (p) { return p.filename; })),
    meetingSuggestion: meetingSuggestion,
    avatarInitials: initials,
    avatarColor: avatarColor,
    // 📦647-fix2 — Nuevos campos para el panel "Mostrar detalles"
    rawHeaders: rawHeaders,
    mailSecurity: mailSecurity
  };

  if (includeBody || true) {
    // F4 — SIEMPRE extraer body y attachments. La lista inicial usa format:'full'
    // (no 'metadata') para que el body venga en la primera carga. Si en el
    // futuro queremos lazy loading, podemos volver a poner la condición.
    //
    // Loop 40b — Extraer TANTO text/plain COMO text/html por separado. Antes solo
    // se extraía text/plain (o text/html con tags removidos), por lo que el cache
    // nunca tenía HTML rico. Ahora la Bandeja Integrada puede renderizar el HTML
    // con el logo de Google, el botón "Ver actividad", las imágenes inline, etc.
    var bodyParts = extractBodyParts(msg.payload);
    result.body = bodyParts.plain;       // compatibilidad legacy (text/plain)
    result.body_plain = bodyParts.plain; // para saveMessage → cache body_plain
    result.body_html = bodyParts.html;   // para saveMessage → cache body_html
    result.attachments = extractAttachments(msg.payload);
  }

  return result;
}

/**
 * F4-fix — Obtiene el perfil del usuario Gmail conectado.
 * Devuelve el email y métricas básicas. Útil para mostrar en el switch
 * de Configuración ("Conectado como: usuario@gmail.com") y en el header
 * de Bandeja Integrada como indicador visual.
 *
 * @param {string} configPath
 * @returns {Promise<{success, data?: {email, messagesTotal, threadsTotal, historyId}, error?: string}>}
 */
async function getProfile(configPath) {
  try {
    var auth = await googleAuth.getAuthorizedClient(configPath);
    if (!auth) {
      return { success: false, error: 'No hay cliente OAuth autorizado. Conectá Gmail primero.' };
    }
    var gmail = google.gmail({ version: 'v1', auth: auth });
    var profile = await gmail.users.getProfile({ userId: 'me' });
    return {
      success: true,
      data: {
        email: profile.data.emailAddress || '',
        messagesTotal: profile.data.messagesTotal || 0,
        threadsTotal: profile.data.threadsTotal || 0,
        historyId: profile.data.historyId || ''
      }
    };
  } catch (e) {
    return { success: false, error: 'Error obteniendo perfil: ' + (e.message || e) };
  }
}

/**
 * F1-Feature1 — Lista todos los labels de Gmail del usuario autenticado.
 * Devuelve labels del sistema (INBOX, SENT, STARRED, etc.) y labels de usuario.
 * Incluye colores (color.backgroundColor, color.textColor) que la UI usa para
 * mostrar los chips de colores en el thread grouping.
 *
 * @param {string} configPath
 * @returns {Promise<{success, data?: Array<{id, name, type, color}>, error?: string}>}
 */
async function listLabels(configPath) {
  try {
    var auth = await googleAuth.getAuthorizedClient(configPath);
    if (!auth) {
      return { success: false, error: 'No hay cliente OAuth autorizado. Conectá Gmail primero.' };
    }
    var gmail = google.gmail({ version: 'v1', auth: auth });
    var res = await gmail.users.labels.list({ userId: 'me' });
    var labels = (res.data.labels || []).map(function (l) {
      return {
        id: l.id,
        name: l.name,
        type: l.type || 'user',  // 'system' o 'user'
        messageCount: l.messagesTotal || 0,
        unreadCount: l.messagesUnread || 0,
        color: l.color ? {
          background: l.color.backgroundColor || '#a479e2',
          text: l.color.textColor || '#ffffff'
        } : null
      };
    });
    return { success: true, data: labels };
  } catch (e) {
    return { success: false, error: 'Error listando labels: ' + (e.message || e) };
  }
}

/**
 * F1-Feature1 — Lista los adjuntos de un mensaje específico.
 * Usa el endpoint Gmail API: messages.attachments.get para descargar.
 *
 * @param {string} messageId
 * @param {string} attachmentId
 * @param {string} configPath
 * @returns {Promise<{success, data?: {data: base64, size: number}, error?: string}>}
 */
async function downloadAttachment(messageId, attachmentId, configPath) {
  try {
    var auth = await googleAuth.getAuthorizedClient(configPath);
    if (!auth) {
      return { success: false, error: 'No autorizado' };
    }
    var gmail = google.gmail({ version: 'v1', auth: auth });
    var res = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: messageId,
      id: attachmentId
    });
    return {
      success: true,
      data: {
        data: res.data.data,  // base64url
        size: res.data.size || 0
      }
    };
  } catch (e) {
    return { success: false, error: 'Error descargando adjunto: ' + (e.message || e) };
  }
}

/**
 * Loop 40b — Extrae TANTO el body en text/plain COMO en text/html de un payload.
 * Antes (bug): esta función solo retornaba text/plain (o text/html CON TAGS
 * REMOVIDOS via .replace(/<[^>]+>/g, ' ')). Resultado: el cache NUNCA tenía
 * HTML rico, por lo que la Bandeja Integrada no podía renderizar el logo de
 * Google, el botón "Ver actividad" como botón, las imágenes inline, etc.
 *
 * Ahora retorna un objeto { plain, html } donde:
 *   - plain: texto plano (puede venir de text/plain nativo o de text/html con
 *     tags removidos como fallback)
 *   - html: HTML crudo sin modificar (para renderizar con formato Gmail)
 *     Si el correo solo tiene text/plain, html queda como string vacío.
 *
 * Recursivo: maneja estructuras multipart anidadas (multipart/mixed →
 * multipart/alternative). Patrón Mail-0: walk the parts tree.
 */
function extractBodyParts(payload) {
  return {
    plain: walkPartsForBody(payload, 'text/plain', false) ||
           walkPartsForBody(payload, 'text/html', true),  // fallback: HTML con tags removidos
    html: walkPartsForBody(payload, 'text/html', false) || ''  // HTML crudo, sin strippear
  };
}

/**
 * Loop 40b (legacy) — Mantener por compatibilidad con callers viejos.
 * Devuelve solo el text/plain. Si el body solo tiene HTML, lo devuelve con
 * los tags removidos (modo "plain text view").
 */
function extractBody(payload) {
  var parts = extractBodyParts(payload);
  return parts.plain;
}

function walkPartsForBody(payload, mimeType, stripHtml) {
  if (!payload) return '';
  // Caso 1: el body está directamente en este payload
  if (payload.body && payload.body.data) {
    // Si este payload tiene mimeType, verificar que coincida
    if (!payload.mimeType || payload.mimeType === mimeType) {
      var raw = decodeBase64Url(payload.body.data);
      if (stripHtml && mimeType === 'text/html') {
        return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      return raw;
    }
  }
  // Caso 2: recursivo en parts
  if (payload.parts && payload.parts.length > 0) {
    for (var i = 0; i < payload.parts.length; i++) {
      var found = walkPartsForBody(payload.parts[i], mimeType, stripHtml);
      if (found) return found;
    }
  }
  return '';
}

function extractAttachments(payload) {
  var atts = [];
  if (!payload || !payload.parts) return atts;
  payload.parts.forEach(function (p) {
    if (p.filename && p.body && p.body.attachmentId) {
      atts.push({
        name: p.filename,
        size: p.body.size || 0,
        mimeType: p.mimeType || 'application/octet-stream',
        attachmentId: p.body.attachmentId
      });
    }
  });
  return atts;
}

function decodeBase64Url(s) {
  // Gmail usa base64url (sin padding, con - y _ en lugar de + y /)
  var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

function stringToColor(str) {
  if (!str) return '888888';
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var c = (hash & 0x00FFFFFF).toString(16);
  return ('000000' + c).slice(-6);
}

/**
 * F1.B — Envía un email via Gmail API.
 * Construye un raw MIME message y lo envía usando users.messages.send.
 *
 * @param {Object} options
 * @param {string} options.configPath - ruta al config.json
 * @param {string} options.from - email del remitente (ej: 'adminkair@gmail.com')
 * @param {string|string[]} options.to - destinatario(s) (string o array)
 * @param {string} [options.cc] - con copia (opcional)
 * @param {string} [options.bcc] - con copia oculta (opcional)
 * @param {string} options.subject - asunto del correo
 * @param {string} options.body - cuerpo del correo (texto plano)
 * @param {string} [options.inReplyTo] - Message-ID del correo al que responde (para threading)
 * @param {string} [options.references] - References header (para threading)
 * @param {string} [options.threadId] - threadId de Gmail al que responde (mantiene la conversación agrupada)
 * @returns {Promise<{success, data?: {id, threadId, labelIds}, error?: string}>}
 */
async function sendMessage(options) {
  options = options || {};
  var configPath = options.configPath;
  var from = options.from || '';
  var to = Array.isArray(options.to) ? options.to.join(', ') : (options.to || '');
  var cc = Array.isArray(options.cc) ? options.cc.join(', ') : (options.cc || '');
  var bcc = Array.isArray(options.bcc) ? options.bcc.join(', ') : (options.bcc || '');
  var subject = options.subject || '(sin asunto)';
  var body = options.body || '';
  var inReplyTo = options.inReplyTo || '';
  var references = options.references || '';
  var attachments = Array.isArray(options.attachments) ? options.attachments : [];

  if (!to) return { success: false, error: 'Falta el destinatario (to)' };

  // Si no se pasa `from`, lo determinamos del perfil OAuth (cuenta conectada)
  if (!from) {
    try {
      var profileRes = await getProfile(configPath);
      if (profileRes && profileRes.success && profileRes.data && profileRes.data.email) {
        from = profileRes.data.email;
      } else {
        return { success: false, error: 'No se pudo determinar el remitente (from). Conectá Gmail primero.' };
      }
    } catch (e) {
      return { success: false, error: 'Error obteniendo perfil: ' + (e.message || e) };
    }
  }

  try {
    var auth = await googleAuth.getAuthorizedClient(configPath);
    if (!auth) {
      return { success: false, error: 'No hay cliente OAuth autorizado. Conectá Gmail primero.' };
    }
    var gmail = google.gmail({ version: 'v1', auth: auth });

    // 1) Construir el raw MIME message
    // Loop 38 — Soporte para attachments via multipart/mixed
    // 📦655 — Aplicar RFC 2047 encoded-word a los headers con posible texto no-ASCII
    // (Subject, From, To con nombre). Sin esto, escribir `Subject: Registro de
    // ejecución` (con ó) hace que Gmail/clients interpreten los bytes UTF-8 como
    // Latin-1 → aparecen `Ã³` en vez de `ó`. Ver encodeMimeHeader() arriba.
    var headers = [
      from ? 'From: ' + encodeMimeHeader(from) : null,
      to ? 'To: ' + encodeMimeHeader(to) : null,
      cc ? 'Cc: ' + encodeMimeHeader(cc) : null,
      bcc ? 'Bcc: ' + encodeMimeHeader(bcc) : null,
      'Subject: ' + encodeMimeHeader(subject),
      inReplyTo ? 'In-Reply-To: ' + inReplyTo : null,
      references ? 'References: ' + references : null
    ].filter(function (h) { return h; });

    // 📦650-fix3 — multipart/alternative con text/plain + text/html.
    // ANTES: solo text/plain → los múltiples espacios y tabs se colapsaban
    // al renderizar (RFC 5322: "Space and tab characters are not permitted
    // between certain pairs of structured header fields"). El user veía
    // sus párrafos pegados o sus espacios múltiples colapsados.
    // AHORA: mandamos ambos formatos. Gmail/Outlook web muestran el HTML
    // que usa white-space: pre-wrap → preserva TODO (espacios, tabs, \n).
    // El text/plain queda como fallback para clientes que no soporten HTML.
    function buildHtmlFromText(text) {
      // Escapar HTML primero
      var escaped = String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      // Convertir saltos de línea a <br>
      var withBr = escaped.replace(/\r\n|\r|\n/g, '<br>');
      // Envolver en un div con white-space: pre-wrap → preserva espacios múltiples y tabs
      return '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #202124; white-space: pre-wrap;">' + withBr + '</div>';
    }
    var htmlBody = buildHtmlFromText(body);

    var raw;
    if (attachments && attachments.length > 0) {
      // Construir mensaje multipart/mixed con boundary (contiene multipart/alternative adentro)
      var boundary = '----=_KairBandeja_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      var altBoundary = '----=_KairBandeja_Alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      // Override del header Content-Type (no incluirlo arriba, lo agregamos con boundary)
      var headerLines = headers.join('\r\n');
      raw = headerLines + '\r\n';
      raw += 'MIME-Version: 1.0\r\n';
      raw += 'Content-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n';
      // Parte 1: body (multipart/alternative con text/plain + text/html)
      raw += '--' + boundary + '\r\n';
      raw += 'Content-Type: multipart/alternative; boundary="' + altBoundary + '"\r\n\r\n';
      // text/plain
      raw += '--' + altBoundary + '\r\n';
      raw += 'Content-Type: text/plain; charset=UTF-8\r\n\r\n';
      raw += body + '\r\n';
      // text/html
      raw += '--' + altBoundary + '\r\n';
      raw += 'Content-Type: text/html; charset=UTF-8\r\n\r\n';
      raw += htmlBody + '\r\n';
      raw += '--' + altBoundary + '--\r\n';
      // Partes 2..N: cada attachment
      for (var i = 0; i < attachments.length; i++) {
        var att = attachments[i];
        var attName = (att.name || 'archivo').replace(/"/g, '');
        var attMime = att.mimeType || 'application/octet-stream';
        var attData = att.data || '';
        raw += '--' + boundary + '\r\n';
        raw += 'Content-Type: ' + attMime + '; name="' + attName + '"\r\n';
        raw += 'Content-Disposition: attachment; filename="' + attName + '"\r\n';
        raw += 'Content-Transfer-Encoding: base64\r\n\r\n';
        // El base64 viene del renderer sin saltos de línea. Gmail espera
        // linebreaks cada 76 chars (estándar MIME). Lo partimos para que
        // encoding funcione correctamente.
        raw += attData.match(/.{1,76}/g).join('\r\n') + '\r\n';
      }
      raw += '--' + boundary + '--\r\n';
    } else {
      // Sin attachments: multipart/alternative con text/plain + text/html
      var altBoundary2 = '----=_KairBandeja_Alt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      var allHeaders = headers.concat([
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' + altBoundary2 + '"'
      ]);
      raw = allHeaders.join('\r\n') + '\r\n\r\n';
      // text/plain
      raw += '--' + altBoundary2 + '\r\n';
      raw += 'Content-Type: text/plain; charset=UTF-8\r\n\r\n';
      raw += body + '\r\n';
      // text/html
      raw += '--' + altBoundary2 + '\r\n';
      raw += 'Content-Type: text/html; charset=UTF-8\r\n\r\n';
      raw += htmlBody + '\r\n';
      raw += '--' + altBoundary2 + '--\r\n';
    }
    var encoded = encodeBase64Url(raw);

    // 2) Enviar via Gmail API
    var res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encoded,
        threadId: options.threadId || undefined  // Mantiene la conversación agrupada si es reply
      }
    });

    return {
      success: true,
      data: {
        id: res.data.id,
        threadId: res.data.threadId,
        labelIds: res.data.labelIds || []
      }
    };
  } catch (e) {
    console.error('[GoogleGmail] Error en sendMessage:', e);
    return { success: false, error: e.message || 'Error enviando correo' };
  }
}

/**
 * Codifica un string a base64url (formato que usa Gmail API).
 * Buffer → base64 → replace + y / → strip padding.
 */
function encodeBase64Url(s) {
  var b64 = Buffer.from(s, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 📦655 — Codifica un header MIME con RFC 2047 encoded-word si tiene caracteres
 * no-ASCII (tildes, eñes, etc.). Si es ASCII puro, lo devuelve tal cual.
 *
 * Sin esto, escribir `Subject: Registro de ejecución` (con ó) en el raw MIME
 * hace que algunos clientes (Gmail web incluido a veces) interpreten los bytes
 * UTF-8 como Latin-1 → aparecen los Ã³ en lugar de ó.
 *
 * Formato RFC 2047: =?UTF-8?B?<base64>?=
 * Más info: https://datatracker.ietf.org/doc/html/rfc2047
 */
function encodeMimeHeader(str) {
  if (!str) return '';
  // Si es ASCII puro, devolver tal cual (más legible)
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  // Si tiene caracteres no-ASCII, codificar con RFC 2047 Base64
  var b64 = Buffer.from(str, 'utf8').toString('base64');
  return '=?UTF-8?B?' + b64 + '?=';
}

module.exports = {
  listInbox: listInbox,
  getMessage: getMessage,
  getProfile: getProfile,
  sendMessage: sendMessage,
  // F1-Feature1
  listLabels: listLabels,
  // F1-Feature5
  downloadAttachment: downloadAttachment
};
