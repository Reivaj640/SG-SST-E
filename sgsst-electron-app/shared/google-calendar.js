// F3.C — Google Calendar sync (lectura/escritura bidireccional).
// Usa el cliente OAuth2 ya autorizado (mismo que Gmail) para que el user
// pueda ver/crear/eliminar eventos en su Google Calendar desde la Bandeja
// Integrada de K+AIR.
//
// Formato interno K+AIR (compatible con kc_eventos):
//   {
//     id: string,             // ID local (rapido-XXXX) o Google event ID
//     title: string,
//     date: string,           // 'YYYY-MM-DD'
//     start: string,          // 'HH:MM' (string, formato IPC)
//     end: string,            // 'HH:MM'
//     startHour: number,      // 0-23 (con decimales para minutos)
//     durationHours: number,  // > 0
//     category: string,       // 'rapido' | 'capacitacion' | etc.
//     type: string,           // igual a category
//     location: string,
//     notes: string,
//     attendees: string[],    // emails
//     googleEventId: string,  // ← NUEVO: ID del evento en Google Calendar
//     source: 'google' | 'kair'  // ← NUEVO: origen del evento
//   }
//
// Convención para evitar duplicados:
//   - K+AIR → Google: al crear, devuelve googleEventId y lo guarda en kc_eventos
//   - Google → K+AIR: al traer, se busca por googleEventId; si ya existe se actualiza

const { google } = require('googleapis');
const googleAuth = require('./google-auth');

// ── Helpers internos ──────────────────────────────────────────────

// Devuelve un cliente Calendar v3 listo para usar, o { success:false, error }.
async function getCalendarClient(configPath) {
  var auth = await googleAuth.getAuthorizedClient(configPath);
  if (!auth) {
    return {
      ok: false,
      error: 'No hay cliente OAuth autorizado. Conectá Google primero.'
    };
  }
  return { ok: true, client: google.calendar({ version: 'v3', auth: auth }) };
}

// Convierte un evento de K+AIR al formato de Google Calendar.
function toGoogleEvent(ev) {
  var sh = typeof ev.startHour === 'number' ? ev.startHour : 0;
  var dur = typeof ev.durationHours === 'number' ? ev.durationHours : 1;
  var shH = Math.floor(sh);
  var shM = Math.round((sh - shH) * 60);
  var endH = sh + dur;
  var ehH = Math.floor(endH);
  var ehM = Math.round((endH - ehH) * 60);
  // Construir ISO en zona horaria del usuario (Bogotá UTC-5). Sin Z al final = local time.
  // Google Calendar interpreta strings sin zona como zona del calendario (default del user).
  var startIso = ev.date + 'T' + pad(shH) + ':' + pad(shM) + ':00';
  var endIso = ev.date + 'T' + pad(ehH) + ':' + pad(ehM) + ':00';
  var gEvent = {
    summary: ev.title || '(sin título)',
    description: ev.notes || undefined,
    location: ev.location || undefined,
    start: { dateTime: startIso },
    end: { dateTime: endIso }
  };
  if (Array.isArray(ev.attendees) && ev.attendees.length > 0) {
    gEvent.attendees = ev.attendees
      .filter(function (e) { return e && e.indexOf('@') >= 0; })
      .map(function (email) { return { email: email.trim() }; });
  }
  return gEvent;
}

// Convierte un evento de Google Calendar al formato K+AIR.
function fromGoogleEvent(g) {
  if (!g || !g.start || !g.end) return null;
  // dateTime: '2026-07-24T09:00:00-05:00' o '2026-07-24T09:00:00' (naive)
  var startStr = g.start.dateTime || (g.start.date ? g.start.date + 'T00:00:00' : null);
  var endStr = g.end.dateTime || (g.end.date ? g.end.date + 'T00:00:00' : null);
  if (!startStr || !endStr) return null;
  // Extraer fecha 'YYYY-MM-DD' y hora 'HH:MM'
  var sParts = startStr.split('T');
  var eParts = endStr.split('T');
  var date = sParts[0];
  var sHM = (sParts[1] || '00:00').split(':');
  var eHM = (eParts[1] || '00:00').split(':');
  var startHour = parseInt(sHM[0], 10) + (parseInt(sHM[1], 10) || 0) / 60;
  var endHour = parseInt(eHM[0], 10) + (parseInt(eHM[1], 10) || 0) / 60;
  var durationHours = Math.max(0.5, endHour - startHour);
  return {
    id: 'gcal-' + g.id,
    title: g.summary || '(sin título)',
    date: date,
    start: pad(Math.floor(startHour)) + ':' + pad(Math.round((startHour % 1) * 60)),
    end: pad(Math.floor(endHour)) + ':' + pad(Math.round((endHour % 1) * 60)),
    startHour: startHour,
    durationHours: durationHours,
    category: g.extendedProperties && g.extendedProperties.shared && g.extendedProperties.shared.kairCategory
      ? g.extendedProperties.shared.kairCategory
      : 'rapido',
    type: 'gcal',
    location: g.location || '',
    notes: g.description || '',
    attendees: Array.isArray(g.attendees) ? g.attendees.map(function (a) { return a.email || ''; }).filter(Boolean) : [],
    googleEventId: g.id,
    source: 'google'
  };
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// ── API pública ───────────────────────────────────────────────────

/**
 * Lista eventos del calendario principal del usuario en un rango de tiempo.
 * @param {string} configPath - Path al config.json con los tokens
 * @param {string} timeMin - ISO 8601 (inclusive lower bound)
 * @param {string} timeMax - ISO 8601 (exclusive upper bound)
 * @returns {Promise<{success:boolean, data?:Array, error?:string}>}
 */
async function listEvents(configPath, timeMin, timeMax) {
  try {
    var g = await getCalendarClient(configPath);
    if (!g.ok) return { success: false, error: g.error };

    var res = await g.client.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax || new Date(Date.now() + 30 * 86400000).toISOString(),
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime'
    });
    var items = (res.data && res.data.items) || [];
    var mapped = items.map(fromGoogleEvent).filter(Boolean);
    return { success: true, data: mapped };
  } catch (err) {
    console.error('[google-calendar] listEvents error:', err.message || err);
    return { success: false, error: err.message || 'Error listando eventos' };
  }
}

/**
 * Crea un evento en el calendario principal del usuario.
 * @param {string} configPath
 * @param {object} ev - Evento en formato K+AIR (ver toGoogleEvent)
 * @returns {Promise<{success:boolean, data?:object, error?:string}>}
 *   data.googleEventId: ID del evento en Google Calendar (guardar en kc_eventos)
 */
async function createEvent(configPath, ev) {
  try {
    var g = await getCalendarClient(configPath);
    if (!g.ok) return { success: false, error: g.error };

    var gEvent = toGoogleEvent(ev);
    // Guardamos la categoría K+AIR en extendedProperties para round-trip
    if (ev.category) {
      gEvent.extendedProperties = {
        shared: { kairCategory: ev.category, kairId: ev.id || '' }
      };
    }

    var res = await g.client.events.insert({
      calendarId: 'primary',
      resource: gEvent,
      // 📦599 — 'all' envía invitación por email a TODOS los attendees con
      // botón Sí/No/Quizás. Era 'none' antes y por eso no les llegaban.
      sendUpdates: 'all'
    });
    return {
      success: true,
      data: {
        googleEventId: res.data.id,
        htmlLink: res.data.htmlLink,
        event: fromGoogleEvent(res.data)
      }
    };
  } catch (err) {
    console.error('[google-calendar] createEvent error:', err.message || err);
    return { success: false, error: err.message || 'Error creando evento' };
  }
}

/**
 * Actualiza un evento existente en Google Calendar.
 * @param {string} configPath
 * @param {string} googleEventId
 * @param {object} ev - Datos actualizados del evento en formato K+AIR
 */
async function updateEvent(configPath, googleEventId, ev) {
  try {
    var g = await getCalendarClient(configPath);
    if (!g.ok) return { success: false, error: g.error };

    var gEvent = toGoogleEvent(ev);
    if (ev.category) {
      gEvent.extendedProperties = {
        shared: { kairCategory: ev.category, kairId: ev.id || '' }
      };
    }

    var res = await g.client.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: gEvent,
      // 📦599 — Notificar a los attendees sobre los cambios (fecha, lugar, etc.)
      sendUpdates: 'all'
    });
    return { success: true, data: { event: fromGoogleEvent(res.data) } };
  } catch (err) {
    console.error('[google-calendar] updateEvent error:', err.message || err);
    return { success: false, error: err.message || 'Error actualizando evento' };
  }
}

/**
 * Elimina un evento del calendario principal del usuario.
 */
async function deleteEvent(configPath, googleEventId) {
  try {
    var g = await getCalendarClient(configPath);
    if (!g.ok) return { success: false, error: g.error };

    await g.client.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
      // 📦599 — Notificar a los attendees sobre la cancelación
      sendUpdates: 'all'
    });
    return { success: true };
  } catch (err) {
    // 404 = ya no existe, lo tratamos como éxito
    if (err.code === 404) return { success: true };
    console.error('[google-calendar] deleteEvent error:', err.message || err);
    return { success: false, error: err.message || 'Error eliminando evento' };
  }
}

/**
 * Sincronización bidireccional: trae eventos de Google y los devuelve.
 * (Fase 1: solo pull. Push se hace on-demand al crear/editar desde K+AIR).
 * @param {string} configPath
 * @param {object} options - { rangeStart, rangeEnd, existingKAIR }
 *   existingKAIR: array de eventos K+AIR actuales (para detectar duplicados por googleEventId)
 */
async function syncFromGoogle(configPath, options) {
  options = options || {};
  var timeMin = options.rangeStart || new Date().toISOString();
  var timeMax = options.rangeEnd || new Date(Date.now() + 60 * 86400000).toISOString();

  var listRes = await listEvents(configPath, timeMin, timeMax);
  if (!listRes.success) return listRes;

  // Detectar duplicados: si un evento K+AIR ya tiene googleEventId que matchea,
  // no lo devolvemos para evitar duplicación.
  var existingIds = {};
  if (Array.isArray(options.existingKAIR)) {
    options.existingKAIR.forEach(function (e) {
      if (e && e.googleEventId) existingIds[e.googleEventId] = true;
    });
  }

  var newEvents = listRes.data.filter(function (e) {
    return e && e.googleEventId && !existingIds[e.googleEventId];
  });
  return { success: true, data: newEvents, total: listRes.data.length };
}

/**
 * 📦600 — Responde a una invitación de Google Calendar en nombre del usuario
 * actual. Actualiza el responseStatus del attendee que matchea el email del
 * usuario autenticado. Notifica al organizer.
 *
 * @param {string} configPath
 * @param {string} googleEventId
 * @param {string} responseStatus - 'accepted' | 'declined' | 'tentative'
 * @param {string} userEmail - email del usuario autenticado (para encontrarlo en attendees)
 * @returns {Promise<{success:boolean, data?:object, error?:string}>}
 */
async function respondToEvent(configPath, googleEventId, responseStatus, userEmail) {
  if (!googleEventId) return { success: false, error: 'Falta googleEventId' };
  if (!userEmail) return { success: false, error: 'Falta userEmail' };
  var valid = ['accepted', 'declined', 'tentative', 'needsAction'];
  if (valid.indexOf(responseStatus) === -1) {
    return { success: false, error: 'responseStatus inválido. Debe ser: ' + valid.join(', ') };
  }
  try {
    var g = await getCalendarClient(configPath);
    if (!g.ok) return { success: false, error: g.error };

    // 1) Obtener el evento actual para conocer los attendees
    var ev = await g.client.events.get({
      calendarId: 'primary',
      eventId: googleEventId
    });
    var attendees = (ev.data && ev.data.attendees) || [];
    var userEmailLower = String(userEmail).toLowerCase();
    var found = false;
    attendees.forEach(function (a) {
      if (a && a.email && String(a.email).toLowerCase() === userEmailLower) {
        a.responseStatus = responseStatus;
        found = true;
      }
    });
    if (!found) {
      // El user no está en los attendees. Lo agregamos (opcional)
      // Por ahora, devolvemos error claro.
      return {
        success: false,
        error: 'El email ' + userEmail + ' no está en la lista de asistentes de este evento. ' +
               'Quizás ya respondiste desde otro cliente o nunca fuiste invitado.'
      };
    }

    // 2) PATCH con los attendees actualizados
    var res = await g.client.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: { attendees: attendees },
      sendUpdates: 'all'  // notifica al organizer
    });
    return {
      success: true,
      data: {
        responseStatus: responseStatus,
        event: fromGoogleEvent(res.data)
      }
    };
  } catch (err) {
    console.error('[google-calendar] respondToEvent error:', err.message || err);
    return { success: false, error: err.message || 'Error respondiendo al evento' };
  }
}

// 📦602 — Helper para el renderer: parsea un .ics, crea el evento en Calendar
// (o lo actualiza si ya existe por UID) y responde al organizador con el
// responseStatus del usuario actual. Usado cuando el user hace click en
// Sí/No/Tal vez desde el banner dentro del email viewer.
async function upsertFromIcs(configPath, icsText, responseStatus, userEmail) {
  if (!icsText) return { success: false, error: 'Falta icsText' };
  if (!userEmail) return { success: false, error: 'Falta userEmail' };
  if (!responseStatus) return { success: false, error: 'Falta responseStatus' };

  var g = await getCalendarClient(configPath);
  if (!g.ok) return { success: false, error: g.error };

  var ics = parseIcsText(icsText);
  if (!ics || !ics.summary || !ics.start) {
    return { success: false, error: 'ICS inválido o sin SUMMARY/DTSTART' };
  }

  var startIso = ics.start.iso;
  var endIso = (ics.end && ics.end.iso) || ics.start.iso;
  var sh = ics.start.dateObj;
  var eh = (ics.end && ics.end.dateObj) || ics.start.dateObj;

  var gEvent = {
    summary: ics.summary,
    description: ics.description || undefined,
    location: ics.location || undefined,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    attendees: (ics.attendees || []).map(function (a) {
      return { email: a.email, displayName: a.cn || undefined };
    })
  };

  try {
    var insertRes = await g.client.events.insert({
      calendarId: 'primary',
      resource: gEvent,
      sendUpdates: 'all'
    });
    return {
      success: true,
      data: {
        googleEventId: insertRes.data.id,
        event: fromGoogleEvent(insertRes.data)
      }
    };
  } catch (err) {
    if (err.code === 409 && ics.uid) {
      try {
        var getRes = await g.client.events.get({ calendarId: 'primary', eventId: ics.uid });
        var existing = getRes.data;
        var atts = (existing.attendees || []).slice();
        var userEmailLower = String(userEmail).toLowerCase();
        var found = atts.some(function (a) {
          return a && a.email && String(a.email).toLowerCase() === userEmailLower;
        });
        if (!found) atts.push({ email: userEmail });
        atts.forEach(function (a) {
          if (a && a.email && String(a.email).toLowerCase() === userEmailLower) {
            a.responseStatus = responseStatus;
          }
        });
        var updateRes = await g.client.events.patch({
          calendarId: 'primary',
          eventId: existing.id,
          resource: { attendees: atts },
          sendUpdates: 'all'
        });
        return {
          success: true,
          data: {
            googleEventId: updateRes.data.id,
            event: fromGoogleEvent(updateRes.data)
          }
        };
      } catch (err2) {
        return { success: false, error: 'No se pudo crear ni actualizar: ' + (err2.message || err.message) };
      }
    }
    return { success: false, error: err.message || 'Error creando evento' };
  }
}

// Parser mínimo de ICS (RFC 5545) — mismo formato que el del renderer.
function parseIcsText(icsText) {
  if (!icsText || typeof icsText !== 'string') return null;
  var unfolded = icsText.replace(/\r?\n[ \t]/g, '');
  var lines = unfolded.split(/\r?\n/);
  var ev = {
    method: null, uid: null, summary: null, description: null, location: null,
    organizer: null, attendees: [], start: null, end: null
  };
  var inEvent = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === 'BEGIN:VEVENT') { inEvent = true; continue; }
    if (line === 'END:VEVENT') { inEvent = false; break; }
    if (!inEvent) {
      if (line.indexOf('METHOD:') === 0) ev.method = line.substring(7).trim();
      continue;
    }
    var colonIdx = line.indexOf(':');
    if (colonIdx < 0) continue;
    var header = line.substring(0, colonIdx);
    var value = line.substring(colonIdx + 1);
    var prop = header.split(';')[0];
    switch (prop) {
      case 'UID': ev.uid = value; break;
      case 'SUMMARY':
        ev.summary = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        break;
      case 'DESCRIPTION':
        ev.description = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        break;
      case 'LOCATION':
        ev.location = value.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
        break;
      case 'ORGANIZER':
        var cnM = /CN=([^;:]+)/.exec(header);
        ev.organizer = {
          cn: cnM ? cnM[1].trim() : null,
          email: value.indexOf('mailto:') === 0 ? value.substring(7) : value
        };
        break;
      case 'ATTENDEE':
        var aCn = /CN=([^;:]+)/.exec(header);
        ev.attendees.push({
          cn: aCn ? aCn[1].trim() : null,
          email: value.indexOf('mailto:') === 0 ? value.substring(7) : value
        });
        break;
      case 'DTSTART': ev.start = parseIcsDateNode(value); break;
      case 'DTEND': ev.end = parseIcsDateNode(value); break;
    }
  }
  return ev;
}

function parseIcsDateNode(value) {
  var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value);
  if (!m) return null;
  var iso = m[1] + '-' + m[2] + '-' + m[3];
  if (m[4]) iso += 'T' + m[4] + ':' + m[5] + ':' + (m[6] || '00');
  if (m[7]) iso += 'Z';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return { iso: iso, date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] ? m[4] + ':' + m[5] : null, dateObj: d };
}

module.exports = {
  listEvents: listEvents,
  createEvent: createEvent,
  updateEvent: updateEvent,
  deleteEvent: deleteEvent,
  syncFromGoogle: syncFromGoogle,
  respondToEvent: respondToEvent,
  upsertFromIcs: upsertFromIcs
};
