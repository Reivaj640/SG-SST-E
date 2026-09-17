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
 * 📦 P1-2 fix — Rate Limiter GLOBAL para Gmail API.
 * Serializa TODAS las llamadas a Gmail API (listInbox, getMessage, sendMessage, etc.)
 * para no exceder el quota de 250 units/user/min.
 * Patrón: cola FIFO + token bucket (max 20 req/min = margen seguro).
 */
var GmailRateLimiter = (function () {
  var queue = [];
  var processing = false;
  // 📦753-fix2 — Antes 20/min, luego 40/min: el sync pide el detalle de CADA
  // mensaje (1 request c/u), así que con 40/min DOS syncs por minuto ya agotaban
  // la ventana → los syncs se encolaban, vencían a los 120s
  // ("El sync tardó más de 120s sin responder") y Enviados quedaba sin actualizar.
  // El cupo REAL de Gmail es 250 unidades/usuario/segundo y messages.get cuesta 5
  // unidades → ~3000 lecturas/min. 120/min es ~4% del cupo real: sobra margen y
  // alcanza para el sync de 25 hilos + las acciones del user.
  var tokens = 120; // max requests per minute
  var lastRefill = Date.now();
  var REFILL_RATE = 120; // tokens por minuto
  var REFILL_INTERVAL_MS = 60000; // 1 minuto
  // 📦753-fix2 — RESERVA para el tráfico INTERACTIVO (lo que hace el user).
  // El fondo nunca usa los últimos 25 tokens: quedan para abrir un correo (traer
  // su imagen de firma), marcarlo leído o enviar.
  var PRIORITY_RESERVE = 25;

  function refillTokens() {
    var now = Date.now();
    var elapsed = now - lastRefill;
    if (elapsed >= REFILL_INTERVAL_MS) {
      tokens = REFILL_RATE;
      lastRefill = now;
    }
  }

  function takeToken(isPriority) {
    refillTokens();
    // El tráfico de fondo no puede tocar la reserva
    var disponibles = isPriority ? tokens : tokens - PRIORITY_RESERVE;
    if (disponibles > 0) {
      tokens--;
      return true;
    }
    return false;
  }

  function waitForToken(isPriority) {
    return new Promise(function (resolve) {
      function check() {
        if (takeToken(isPriority)) {
          resolve();
        } else {
          // Esperar hasta el siguiente refill (máx 60s, pero usualmente menos)
          var waitMs = Math.max(100, REFILL_INTERVAL_MS - (Date.now() - lastRefill));
          setTimeout(check, waitMs);
        }
      }
      check();
    });
  }

  return {
    /**
     * Ejecuta fn() respetando el rate limit global.
     * @param {Function} fn - async function
     * @param {Object} [opts] - { priority: true } para acciones del user (puede
     *   usar la reserva de tokens). El sync de fondo va sin priority.
     * @returns {Promise<any>}
     */
    run: async function (fn, opts) {
      await waitForToken(!!(opts && opts.priority));
      return fn();
    },
    // Diagnóstico (tests): tokens disponibles y reserva configurada.
    _state: function () { return { tokens: tokens, reserve: PRIORITY_RESERVE }; }
  };
})();

/**
 * Retry con exponential backoff para rate limiting (HTTP 429).
 * Gmail API quota: 250 units/user/sec. Batch requests pueden excederlo.
 * @param {Function} fn - función async a ejecutar
 * @param {Object} options - { maxRetries: 3, baseDelay: 1000, maxDelay: 30000 }
 * @returns {Promise<any>}
 */
async function withRetry(fn, options) {
  options = options || {};
  var maxRetries = options.maxRetries || 3;
  var baseDelay = options.baseDelay || 1000; // 1s
  var maxDelay = options.maxDelay || 30000; // 30s
  var attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (e) {
      var isRateLimit = e && e.code === 429;
      var isQuotaExceeded = e && e.message && e.message.indexOf('Quota exceeded') >= 0;
      var isRetryable = isRateLimit || isQuotaExceeded || (e && e.code >= 500);

      if (!isRetryable || attempt >= maxRetries) {
        throw e;
      }

      attempt++;
      var delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000, maxDelay);
      console.warn('[GoogleGmail] Rate limit/quota hit (attempt ' + attempt + '/' + maxRetries + '), reintentando en ' + Math.round(delay) + 'ms:', e.message);
      await new Promise(function (resolve) { setTimeout(resolve, delay); });
    }
  }
}

/**
 * Lista los últimos N mensajes de la bandeja de entrada.
 * Por defecto solo del inbox principal (label INBOX), excluyendo spam/trash.
 * 📦 P1-1 fix: Soporte de paginación con nextPageToken.
 *
 * @param {Object} options
 * @param {string} options.configPath - ruta al config.json
 * @param {number} options.maxResults - cuántos correos traer por página (default 20, máx 100)
 * @param {string[]} options.extraQuery - parámetros extra de búsqueda (ej: ['is:unread'])
 * @param {string} [options.pageToken] - token de página para paginación (nextPageToken anterior)
 * @param {boolean} [options.fetchAll] - si true, recorre todas las páginas hasta maxTotalResults
 * @param {number} [options.maxTotalResults] - límite total al usar fetchAll (default 500)
 * @returns {Promise<{success, data?: Array, nextPageToken?: string, error?: string}>}
 */
async function listInbox(options) {
  options = options || {};
  var configPath = options.configPath;
  var maxResults = Math.min(options.maxResults || 20, 100); // Gmail API máx 100 por página
  var extraQuery = options.extraQuery || [];
  var pageToken = options.pageToken || null;
  var fetchAll = options.fetchAll === true;
  var maxTotalResults = options.maxTotalResults || 500;

  var auth = await googleAuth.getAuthorizedClient(configPath);
  if (!auth) {
    return { success: false, error: 'No hay cliente OAuth autorizado. Conectá Gmail primero.' };
  }

  var gmail = google.gmail({ version: 'v1', auth: auth });

  try {
    // 1) Listar IDs de mensajes con soporte de paginación
    // F1.B-fix — Soporte para folder SENT, DRAFT, TRASH, SPAM, STARRED, IMPORTANT, ARCHIVE
    // Default seguro: INBOX
    var query = ['in:inbox'].concat(extraQuery).join(' ');
    if (options.folder === 'SENT') {
      query = ['in:sent'].concat(extraQuery).join(' ');
    } else if (options.folder === 'DRAFT') {
      query = ['in:drafts'].concat(extraQuery).join(' ');
    } else if (options.folder === 'TRASH') {
      query = ['in:trash'].concat(extraQuery).join(' ');
    } else if (options.folder === 'SPAM') {
      query = ['in:spam'].concat(extraQuery).join(' ');
    } else if (options.folder === 'STARRED') {
      query = ['is:starred'].concat(extraQuery).join(' ');
    } else if (options.folder === 'IMPORTANT') {
      query = ['is:important'].concat(extraQuery).join(' ');
    } else if (options.folder === 'ARCHIVE') {
      query = ['-in:inbox -in:sent -in:draft -in:trash -in:spam'].concat(extraQuery).join(' ');
    }
    // query YA tiene valor por defecto (INBOX), no necesita else final

    var allMessages = [];
    var nextPageToken = pageToken;
    var totalFetched = 0;

    do {
      // Listar con rate limiter global
      var listRes = await GmailRateLimiter.run(function () {
        return withRetry(function () {
          return gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: maxResults,
            pageToken: nextPageToken
          });
        }, { maxRetries: 3, baseDelay: 1000 });
      });

      var messages = listRes.data.messages || [];
      var messagesArray = Array.isArray(messages) ? messages : [];

      // Acumular mensajes
      for (var i = 0; i < messagesArray.length; i++) {
        allMessages.push(messagesArray[i]);
        totalFetched++;
        if (totalFetched >= maxTotalResults) break;
      }

      // Obtener siguiente token
      nextPageToken = listRes.data.nextPageToken || null;

      // Si no hay más páginas, o alcanzamos el límite, o no estamos en modo fetchAll, salimos
      if (!nextPageToken || totalFetched >= maxTotalResults || !fetchAll) {
        break;
      }

      // Pequeño delay entre páginas para respetar quota
      await new Promise(function (resolve) { setTimeout(resolve, 200); });

    } while (nextPageToken);

    var messages = allMessages;
    if (messages.length === 0) {
      return { success: true, data: [], nextPageToken: null };
    }

    // 2) Obtener detalles de cada mensaje CON RETRY, RATE LIMITER GLOBAL y batching.
    // F4 — Usar format:'full' en vez de 'metadata' para traer el body del correo.
    // El body es necesario para que la Bandeja Integrada muestre el contenido
    // real del correo (no solo headers + snippet).
    // 📦 P1-2 fix: Procesar en lotes pequeños (3 a la vez) con delay entre lotes
    // para no exceder el límite de 250 units/user/min de Gmail API.
    var BATCH_SIZE = 3;
    var BATCH_DELAY_MS = 500; // 500ms entre lotes = ~360 req/min máx (con rate limiter global)
    var allDetails = [];

    for (var batchStart = 0; batchStart < messages.length; batchStart += BATCH_SIZE) {
      var batch = messages.slice(batchStart, batchStart + BATCH_SIZE);
      var batchPromises = batch.map(function (m) {
        return GmailRateLimiter.run(function () {
          return withRetry(function () {
            return gmail.users.messages.get({
              userId: 'me',
              id: m.id,
              format: 'full'
            });
          }, { maxRetries: 3, baseDelay: 1000 });
        }).then(function (res) {
          return res.data;
        }).catch(function (e) {
          console.warn('[GoogleGmail] Error en message.get ' + m.id + ' (tras retries):', e.message);
          return null;
        });
      });
      var batchDetails = await Promise.all(batchPromises);
      allDetails = allDetails.concat(batchDetails);

      // Delay entre lotes para respetar quota (excepto en el último)
      if (batchStart + BATCH_SIZE < messages.length) {
        await new Promise(function (resolve) { setTimeout(resolve, BATCH_DELAY_MS); });
      }
    }

    // 3) Normalizar al formato Bandeja Integrada
    var normalized = allDetails.filter(function (d) { return d !== null; }).map(function (d) {
      return normalizeMessage(d);
    });

    return { success: true, data: normalized, nextPageToken: nextPageToken };
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
    var res = await GmailRateLimiter.run(function () {
      return withRetry(function () {
        return gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full'
        });
      }, { maxRetries: 3, baseDelay: 1000 });
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
    // 📦753 — Solo cuenta como "tiene adjuntos" si hay al menos una parte que NO
    // sea imagen en línea. Antes, un correo con solo la imagen de firma (inline)
    // mostraba el clip de adjunto en la lista.
    hasAttachment: extractAttachments(msg.payload).some(function (a) { return !a.isInline; }),
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
    var profile = await GmailRateLimiter.run(function () {
      return withRetry(function () {
        return gmail.users.getProfile({ userId: 'me' });
      }, { maxRetries: 3, baseDelay: 1000 });
    });
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
    var res = await GmailRateLimiter.run(function () {
      return withRetry(function () {
        return gmail.users.labels.list({ userId: 'me' });
      }, { maxRetries: 3, baseDelay: 1000 });
    });
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
    var res = await GmailRateLimiter.run(function () {
      return withRetry(function () {
        return gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: attachmentId
        });
      }, { maxRetries: 3, baseDelay: 1000 });
      // 📦753-fix2 — Acción del user (imagen de firma / adjunto al abrir un
      // correo): puede usar la reserva de tokens para no esperar al sync.
    }, { priority: true });
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

// 📦753 — Lee el valor de un header de una parte MIME (Content-ID, Content-Disposition…).
function partHeader(part, headerName) {
  var headers = (part && part.headers) || [];
  var want = String(headerName).toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i].name || '').toLowerCase() === want) {
      return String(headers[i].value || '');
    }
  }
  return '';
}

function extractAttachments(payload) {
  var atts = [];
  if (!payload || !payload.parts) return atts;

  function walkParts(part) {
    if (!part) return;
    // Si esta parte tiene un archivo adjunto, agregarlo
    if (part.filename && part.body && part.body.attachmentId) {
      // 📦753 — Distinguir imágenes EN LÍNEA (van dentro del cuerpo, el HTML las
      // referencia con src="cid:…") de los adjuntos reales. Sin esto, la firma con
      // imagen se listaba como "1 archivo adjunto" y además no se veía en el body.
      var contentId = partHeader(part, 'Content-ID').replace(/[<>]/g, '').trim();
      var dispositionRaw = partHeader(part, 'Content-Disposition').toLowerCase();
      var isInline = dispositionRaw.indexOf('inline') === 0 ||
                     (!!contentId && dispositionRaw.indexOf('attachment') !== 0);
      atts.push({
        name: part.filename,
        size: part.body.size || 0,
        mimeType: part.mimeType || 'application/octet-stream',
        attachmentId: part.body.attachmentId,
        contentId: contentId || null,
        disposition: isInline ? 'inline' : 'attachment',
        isInline: isInline
      });
    }
    // Recursivamente procesar sub-partes (multipart anidados)
    if (part.parts && part.parts.length > 0) {
      part.parts.forEach(walkParts);
    }
  }

  payload.parts.forEach(walkParts);
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
 * 📦753 — Construye el mensaje MIME crudo (raw) de un correo saliente.
 * Se separó de sendMessage() para poder testear la estructura sin OAuth.
 *
 * Estructura resultante:
 *   - sin adjuntos ni imagen → multipart/alternative
 *   - con imagen de firma    → multipart/related (alternative + imagen inline CID)
 *   - con adjuntos           → multipart/mixed (related|alternative + adjuntos)
 *
 * La imagen de firma va INLINE con `Content-ID: <kair-firma@kair>` y el HTML la
 * referencia con `src="cid:kair-firma@kair"`. Así el destinatario la ve dentro
 * del correo y no como un archivo adjunto suelto.
 *
 * @param {Object} o
 * @param {string[]} o.headers - headers ya codificados (From/To/Subject/…)
 * @param {string} o.body - cuerpo en texto plano (alternativa para clientes sin HTML)
 * @param {string} o.htmlBody - cuerpo en HTML (mismo contenido, con formato)
 * @param {Array} [o.attachments] - [{name, mimeType, data}] con data en base64 sin saltos
 * @param {Object} [o.signatureImage] - {name, mimeType, data} con data en base64 sin saltos
 * @returns {string} mensaje MIME completo (líneas CRLF)
 */
function buildRawMessage(o) {
  o = o || {};
  var headers = Array.isArray(o.headers) ? o.headers : [];
  var body = o.body || '';
  var htmlBody = o.htmlBody || '';
  var attachments = Array.isArray(o.attachments) ? o.attachments : [];
  var signatureImage = o.signatureImage || null;
  var hasAttachments = attachments.length > 0;

  var hasSigImage = !!(signatureImage && signatureImage.data && signatureImage.mimeType &&
                       String(signatureImage.mimeType).indexOf('image/') === 0);
  var SIG_CID = 'kair-firma@kair';
  if (hasSigImage) {
    // El HTML del cuerpo ya preserva el formato del texto (white-space: pre-wrap);
    // acá solo se le agrega el bloque de la imagen, separado por una línea.
    htmlBody += '<div style="margin-top:18px;padding-top:12px;border-top:1px solid #e8ebee;">' +
      '<img src="cid:' + SIG_CID + '" alt="Firma" style="max-width:420px;height:auto;display:block;">' +
      '</div>';
  }

  var nl = '\r\n';
  var stamp = Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  // El base64 llega del renderer SIN saltos de línea: hay que partirlo cada 76
  // chars (estándar MIME) para que el encoding no se corrompa.
  var b64Body = function (data) {
    var s = String(data || '');
    var chunks = s.match(/.{1,76}/g);
    return (chunks ? chunks.join(nl) : s) + nl;
  };
  // multipart/alternative (texto plano + HTML) con su propio boundary.
  var buildAlternative = function (boundary) {
    var altB = boundary + '_alt';
    return '--' + boundary + nl +
      'Content-Type: multipart/alternative; boundary="' + altB + '"' + nl + nl +
      '--' + altB + nl + 'Content-Type: text/plain; charset=UTF-8' + nl + nl +
      body + nl +
      '--' + altB + nl + 'Content-Type: text/html; charset=UTF-8' + nl + nl +
      htmlBody + nl +
      '--' + altB + '--' + nl;
  };
  // Parte de la imagen de firma (inline + Content-ID para el src="cid:").
  var buildInlineImage = function (boundary) {
    var sigName = String(signatureImage.name || 'firma.png').replace(/"/g, '');
    return '--' + boundary + nl +
      'Content-Type: ' + signatureImage.mimeType + '; name="' + sigName + '"' + nl +
      'Content-Disposition: inline; filename="' + sigName + '"' + nl +
      'Content-Transfer-Encoding: base64' + nl +
      'Content-ID: <' + SIG_CID + '>' + nl + nl +
      b64Body(signatureImage.data);
  };
  var buildAttachments = function (boundary) {
    var out = '';
    for (var i = 0; i < attachments.length; i++) {
      var att = attachments[i];
      var attName = String(att.name || 'archivo').replace(/"/g, '');
      var attMime = att.mimeType || 'application/octet-stream';
      out += '--' + boundary + nl +
        'Content-Type: ' + attMime + '; name="' + attName + '"' + nl +
        'Content-Disposition: attachment; filename="' + attName + '"' + nl +
        'Content-Transfer-Encoding: base64' + nl + nl +
        b64Body(att.data);
    }
    return out;
  };

  if (hasAttachments && hasSigImage) {
    // mixed( related( alternative + imagen ) + adjuntos )
    var mixB = '----=_KairMix_' + stamp;
    var relB = '----=_KairRel_' + stamp;
    return headers.join(nl) + nl +
      'MIME-Version: 1.0' + nl +
      'Content-Type: multipart/mixed; boundary="' + mixB + '"' + nl + nl +
      '--' + mixB + nl +
      'Content-Type: multipart/related; boundary="' + relB + '"; type="multipart/alternative"' + nl + nl +
      buildAlternative(relB) +
      buildInlineImage(relB) +
      '--' + relB + '--' + nl +
      buildAttachments(mixB) +
      '--' + mixB + '--' + nl;
  }
  if (hasAttachments) {
    // mixed( alternative + adjuntos ) — comportamiento original
    var mixB2 = '----=_KairMix_' + stamp;
    return headers.join(nl) + nl +
      'MIME-Version: 1.0' + nl +
      'Content-Type: multipart/mixed; boundary="' + mixB2 + '"' + nl + nl +
      buildAlternative(mixB2) +
      buildAttachments(mixB2) +
      '--' + mixB2 + '--' + nl;
  }
  if (hasSigImage) {
    // related( alternative + imagen )
    var relB2 = '----=_KairRel_' + stamp;
    return headers.concat([
      'MIME-Version: 1.0',
      'Content-Type: multipart/related; boundary="' + relB2 + '"; type="multipart/alternative"'
    ]).join(nl) + nl + nl +
      buildAlternative(relB2) +
      buildInlineImage(relB2) +
      '--' + relB2 + '--' + nl;
  }
  // Sin adjuntos ni imagen: multipart/alternative
  var altB2 = '----=_KairBandeja_Alt_' + stamp;
  return headers.concat([
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + altB2 + '"'
  ]).join(nl) + nl + nl +
    buildAlternative(altB2) +
    '--' + altB2 + '--' + nl;
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

    // 📦753 — El armado del MIME vive en buildRawMessage() (nivel de módulo)
    // para poder testear su estructura sin OAuth.
    var raw = buildRawMessage({
      headers: headers,
      body: body,
      htmlBody: htmlBody,
      attachments: attachments,
      signatureImage: options.signatureImage
    });
    var encoded = encodeBase64Url(raw);

    // 2) Enviar via Gmail API con rate limiter global + retry
    // 📦753-fix2 — priority: enviar es una acción del user, no debe esperar
    // a que el sync de fondo libere tokens.
    var res = await GmailRateLimiter.run(function () {
      return withRetry(function () {
        return gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encoded,
            threadId: options.threadId || undefined  // Mantiene la conversación agrupada si es reply
          }
        });
      }, { maxRetries: 3, baseDelay: 1000 });
    }, { priority: true });

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
  buildRawMessage: buildRawMessage,
  extractAttachments: extractAttachments,
  listInbox: listInbox,
  getMessage: getMessage,
  getProfile: getProfile,
  sendMessage: sendMessage,
  // F1-Feature1
  listLabels: listLabels,
  // F1-Feature5
  downloadAttachment: downloadAttachment,
  // Rate limiter global (para uso en main.js handlers)
  GmailRateLimiter: GmailRateLimiter,
  withRetry: withRetry
};
