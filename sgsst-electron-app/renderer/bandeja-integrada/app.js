/* ============================================================
 * K+AIR Bandeja Integrada — Lógica vanilla JS
 * ============================================================
 * Sin frameworks. Sin build steps. Sin dependencias externas.
 * Pensado para renderer de Electron.
 *
 * Arquitectura (respeta AGENTS.md K+AIR):
 *   - El renderer SOLO renderiza y maneja estado visual.
 *   - Las operaciones de negocio se delegan a electronAPI.
 *   - Toda comunicación Backend↔Renderer por IPC (contextBridge).
 *
 * En producción, reemplazar las llamadas a KairData por:
 *   await window.kairAPI.mail.list()
 *   await window.kairAPI.calendar.listEvents()
 *   await window.kairAPI.calendar.createEvent(draft)
 * ============================================================ */

(function () {
  "use strict";

  // ====== Estado del renderer (vanilla) ======
  // El correo SIEMPRE está visible (es la base del área principal).
  // El calendario grande es un overlay deslizante que entra desde la izquierda.
  // F4-fix — Default: TRUE. El user quiere ver el calendario al entrar a Bandeja
  // Integrada (para tener una vista general de los eventos del mes, como en el
  // calendario viejo). Antes era false (solo se veía el correo).
  const state = {
    calendarVisible: true,     // true = calendario overlay visible | false = solo correo
    mails: [],
    events: [],
    selectedMailId: null,
    mailFilter: "all",         // "all" | "unread" | "flagged" | "meeting" | "sent"
    mailFolder: "INBOX",       // "INBOX" | "SENT" — carpeta de Gmail que se está mostrando
    searchQuery: "",           // F1.D — query de búsqueda en tiempo real (vacío = sin filtro)
    labels: [],                // F1-Feature1 — labels de Gmail cacheados
    refreshing: false,
    mailLoading: false,
    allCompanies: true,
    searchQuery: "",
    checkedIds: new Set(),
    selectedDate: null,
    activeCategories: new Set(),
    calView: "month",          // "day" | "week" | "month" | "schedule"
    // F4 — Mes visible en el mini-cal (navegable con chevron)
    viewYear: null,            // se inicializa en init() desde D.MONTH_VIEW
    viewMonth: null,           // 0-indexed (0=enero, 6=julio)
    viewMonthLabel: "",        // "Julio 2026"
    dropTarget: null,
    eventModalOpen: false,
    draft: {
      title: "",
      date: "",
      startHour: 10,
      durationHours: 1,
      location: "",
      attendees: "",
      notes: "",
      category: "plan",
      linkedMailId: undefined,
    },
    linkedMailSubject: undefined,
    // F3.A — Estado de conexión Gmail (true si hay tokens válidos en config.json)
    gmailConnected: false,
  };

  // ====== Atajos ======
  const D = window.KairData;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // F2 — Helper para obtener el estilo (color, bg, border) de una categoría.
  // Si la categoría NO está en D.EVENT_CATEGORIES (caso de las categorías
  // dinámicas del IPC como "rapido", "gestacion", "mantenimiento_programado",
  // "recordatorio_copasst", etc.), usa FALLBACK_CATEGORIES. Si tampoco
  // está ahí, usa DEFAULT_CATEGORY_STYLE (gris neutro).
  //
  // Sin este helper, acceder a D.EVENT_CATEGORIES[ev.category].bg falla con
  // "Cannot read properties of undefined" cuando llegan eventos del IPC que
  // no están en las 6 categorías oficiales de K+AIR.
  const FALLBACK_CATEGORIES = {
    rapido:                    { color: "#0d6efd", bg: "#e7f1ff", border: "#b6d4fe" },
    rapido_vencido:            { color: "#dc3545", bg: "#fdeaea", border: "#f5c2c7" },
    gestacion:                 { color: "#d63384", bg: "#fce8f1", border: "#f5b5d3" },
    mantenimiento_programado:  { color: "#fd7e14", bg: "#fff3e6", border: "#ffd9b3" },
    inspeccion:                { color: "#198754", bg: "#e6f4ea", border: "#a3d9b1" },
    inspeccion_vencida:        { color: "#842029", bg: "#f8d7da", border: "#f1aeb5" },
    recordatorio_copasst:      { color: "#dc3545", bg: "#fdeaea", border: "#f5c2c7" },
    recordatorio_convivencia:  { color: "#0891b2", bg: "#e0f7fa", border: "#a5e8f0" },
    recordatorio_presupuesto:  { color: "#10b981", bg: "#d1fae5", border: "#a7f3d0" },
    recordatorio_afiliacion:   { color: "#f59e0b", bg: "#fef3c7", border: "#fde68a" },
    recordatorio_inducciones:  { color: "#6366f1", bg: "#e0e7ff", border: "#c7d2fe" },
    cumplido:                  { color: "#28a745", bg: "#e6f7ec", border: "#b8e6c5" }
  };
  const DEFAULT_CATEGORY_STYLE = { color: "#6c757d", bg: "#eef0f3", border: "#d6dae0", label: "Otro" };

  function getCategoryStyle(cat) {
    if (!cat) return DEFAULT_CATEGORY_STYLE;
    if (D.EVENT_CATEGORIES && D.EVENT_CATEGORIES[cat]) return D.EVENT_CATEGORIES[cat];
    if (FALLBACK_CATEGORIES[cat]) return FALLBACK_CATEGORIES[cat];
    return DEFAULT_CATEGORY_STYLE;
  }
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("data-")) node.setAttribute(k, v);
      else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
      else if (k === "onClick") node.addEventListener("click", v);
      else if (k === "onInput") node.addEventListener("input", v);
      else if (k === "onChange") node.addEventListener("change", v);
      else if (k === "title" || k === "aria-label" || k === "type" || k === "placeholder" || k === "value") node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    });
    return node;
  };
  const fmtHour = (h) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  const formatDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  // F4 — Formatea la fecha de un correo de Gmail (RFC 2822 o ISO).
  // Por defecto muestra "17 jul 2026, 22:00". Si onlyTime=true, solo la hora "22:00".
  function formatGmailDate(dateStr, onlyTime) {
    if (!dateStr) return "";
    try {
      // F1.A-fix3 — Aceptar timestamp en segundos o milisegundos.
      // Si el número es < 1e12 (año 33658), probablemente son segundos → multiplicar x1000.
      // Si es > 1e12, son milisegundos (típico de JS Date.now()).
      var d;
      if (typeof dateStr === "number") {
        d = new Date(dateStr < 1e12 ? dateStr * 1000 : dateStr);
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return String(dateStr);
      if (onlyTime) {
        // Formato HH:MM robusto, sin depender de locale
        var hh = d.getHours().toString().padStart(2, "0");
        var mm = d.getMinutes().toString().padStart(2, "0");
        return hh + ":" + mm;
      }
      // Formato "17 jul 2026, 22:00" — construido a mano, no depende de locale
      var months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      var day = d.getDate();
      var mon = months[d.getMonth()];
      var year = d.getFullYear();
      var hour = d.getHours().toString().padStart(2, "0");
      var min = d.getMinutes().toString().padStart(2, "0");
      return day + " " + mon + " " + year + ", " + hour + ":" + min;
    } catch (e) {
      return String(dateStr);
    }
  }

  // FIX 2026-07-19 — Formato largo con día de la semana (estilo Gmail):
  // "martes, 21 de julio de 2026"
  // Construido a mano (no depende de locale)
  function formatGmailLongDate(dateStr) {
    if (!dateStr) return "";
    try {
      var d;
      if (typeof dateStr === "number") {
        d = new Date(dateStr < 1e12 ? dateStr * 1000 : dateStr);
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return String(dateStr);
      var weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
      var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      var weekday = weekdays[d.getDay()];
      var day = d.getDate();
      var month = months[d.getMonth()];
      var year = d.getFullYear();
      return weekday + ", " + day + " de " + month + " de " + year;
    } catch (e) {
      return String(dateStr);
    }
  }

  // FIX 2026-07-18 — Formato relativo "hace X horas" estilo Gmail.
  // Para fechas < 7 días: "hace X min/horas/días"
  // Para fechas más viejas: usar formatGmailDate (fecha completa)
  function formatRelativeTime(dateStr) {
    if (!dateStr) return "";
    try {
      var d;
      if (typeof dateStr === "number") {
        d = new Date(dateStr < 1e12 ? dateStr * 1000 : dateStr);
      } else {
        d = new Date(dateStr);
      }
      if (isNaN(d.getTime())) return String(dateStr);
      var now = new Date();
      var diffMs = now.getTime() - d.getTime();
      var diffSec = Math.floor(diffMs / 1000);
      var diffMin = Math.floor(diffSec / 60);
      var diffHour = Math.floor(diffMin / 60);
      var diffDay = Math.floor(diffHour / 24);
      if (diffSec < 60) return "hace " + diffSec + " segundo" + (diffSec !== 1 ? "s" : "");
      if (diffMin < 60) return "hace " + diffMin + " min";
      if (diffHour < 24) return "hace " + diffHour + " hora" + (diffHour !== 1 ? "s" : "");
      if (diffDay < 7) return "hace " + diffDay + " día" + (diffDay !== 1 ? "s" : "");
      // Más viejo: formato completo
      return formatGmailDate(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  }
  const initials = (name) =>
    name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  // F1.A-fix2 — Render del body del correo con 3 mejoras:
  //   IMPORTANTE: NO escapamos HTML porque el body es text/plain.
  //   Si escapamos, los links planos como "<https://...>" se ven como "&lt;https...&gt;"
  //   y los placeholders como "[image: Google]" se ven raros.
  //
  //   1. Limpiar headers MIME duplicados ("De: ... Enviado: ... Para: ... Asunto:") cuando
  //      aparecen en el body. Es común en correos de texto plano que el cliente de correo
  //      del remitente los incluyó al final.
  //   2. Detectar URLs (http/https) y volverlas links clickeables. Seguridad:
  //      target="_blank" + rel="noopener noreferrer" para evitar reverse tabnabbing.
  //   3. Detectar quoted text (líneas que empiezan con ">") y ponerlas en bloque colapsable.
  //      Estilo Gmail: el quote se ve en bloque con borde izquierdo gris.
  function renderMailBodyHtml(body) {
    if (!body) return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px 16px;color:var(--kair-text-light);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><p style="margin:0;font-size:0.875rem;font-weight:500;">Sin contenido en este correo</p><p style="margin:0;font-size:0.75rem;color:var(--kair-text-light);">El cuerpo del mensaje está vacío</p></div>';

    // 1. Detectar y remover headers MIME duplicados.
    // Solo removemos un BLOQUE CONTIGUO de headers al INICIO del body (típico de
    // forwards/replies crudos de Gmail). NO eliminamos líneas sueltas en cualquier
    // parte, porque en correos ENVIADOS (SENT) el cuerpo legítimo puede contener
    // líneas que empiezan con "De:", "Para:", "Asunto:", etc. como parte del mensaje.
    var cleaned = body;
    var rawLines = cleaned.split("\n");
    // Regex de header MIME: "De: ...", "Enviado: ...", "Para: ...", etc.
    var mimeHeaderPattern = /^\s*(De|From|Enviado|Sent|Para|To|Asunto|Subject|CC|Cc|CCO|Bcc|Cco|Fecha|Date|Reply-To|Responder|MIME-Version|Content-Type|Content-Transfer-Encoding|X-[A-Za-z0-9-]+):\s*/i;
    // Saltamos SOLO las líneas iniciales que son headers MIME contiguos.
    var startIdx = 0;
    while (startIdx < rawLines.length && mimeHeaderPattern.test(rawLines[startIdx])) {
      startIdx++;
    }
    // Si el bloque de headers inicial es contiguo, también saltamos la 1ª línea
    // vacía que suele seguirlo.
    if (startIdx > 0 && startIdx < rawLines.length && rawLines[startIdx].trim() === "") {
      startIdx++;
    }
    var filteredLines = rawLines.slice(startIdx);
    cleaned = filteredLines.join("\n").trim();
    // También eliminar el separador "---------- Forwarded message ----------" que
    // algunos clientes ponen (Gmail lo usa en forwards)
    cleaned = cleaned.replace(/^-{5,}\s*Forwarded message\s*-{5,}\s*$/gim, '');

    // 2. Limpiar placeholders de Gmail tipo "[image: Google]" que aparecen cuando
    // el correo tenía imágenes inline que el cliente no descargó.
    // Los removemos porque no aportan al contenido visible.
    cleaned = cleaned.replace(/^\[image: [^\]]+\]\s*$/gm, '');

    // 3. Limpiar líneas de guiones/separadores que algunos clientes de correo
    // ponen al final del cuerpo (ej: "________________________________")
    cleaned = cleaned.replace(/^_{20,}\s*$/gm, '');

    // 4. Convertir URLs a links (sin escapar, solo reemplazar).
    // IMPORTANTE: solo URLs http/https. NO escapamos < > porque el body es texto plano.
    // Patrón: captura URLs que NO estén ya dentro de < > (esos son links planos de texto,
    // los dejamos como están).
    var bodyLines = cleaned.split("\n");
    var inQuote = false;
    var result = [];
    var quoteBuffer = [];
    for (var i = 0; i < bodyLines.length; i++) {
      var line = bodyLines[i];
      if (/^\s*>/.test(line)) {
        inQuote = true;
        quoteBuffer.push(line.replace(/^\s*>\s?/, ""));
        continue;
      }
      if (inQuote && line.trim() === "") {
        quoteBuffer.push("");
        continue;
      }
      if (inQuote) {
        // F1-Afinamiento — Quote colapsable con <details> HTML5 (estilo Gmail).
        // Por default colapsado, el user clickea "..." para expandir.
        // Dentro del quote, NO linkear (texto citado, mantener como está).
        var quoteContent = escapeHtml(quoteBuffer.join("\n")).replace(/\n/g, "<br>");
        var quoteCount = quoteBuffer.filter(function (l) { return l.trim(); }).length;
        var quoteLabel = quoteCount > 1
          ? "··· " + quoteCount + " líneas citadas"
          : "··· 1 línea citada";
        result.push('<details class="kair-mail-quote"><summary>' + quoteLabel + '</summary><div class="kair-mail-quote__content">' + quoteContent + '</div></details>');
        quoteBuffer = [];
        inQuote = false;
      }
      // Linkear URLs en la línea (solo http/https). Escapar SOLO el resto de la línea
      // (por seguridad, en caso de HTML inyectado).
      var linked = linkifyLine(line);
      result.push(linked);
    }
    if (inQuote && quoteBuffer.length > 0) {
      var quoteContentEnd = escapeHtml(quoteBuffer.join("\n")).replace(/\n/g, "<br>");
      var quoteCountEnd = quoteBuffer.filter(function (l) { return l.trim(); }).length;
      var quoteLabelEnd = quoteCountEnd > 1
        ? "··· " + quoteCountEnd + " líneas citadas"
        : "··· 1 línea citada";
      result.push('<details class="kair-mail-quote"><summary>' + quoteLabelEnd + '</summary><div class="kair-mail-quote__content">' + quoteContentEnd + '</div></details>');
    }

    return result.join("<br>");
  }

  // F1.A-fix2 — Escapa SOLO los caracteres peligrosos para evitar XSS
  // (en caso de que el body tenga HTML inyectado), pero deja URLs y placeholders legibles.
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // F1.A-fix2 — Detecta URLs en una línea y las convierte en links.
  // Escapa el resto de la línea y luego inserta los <a> alrededor de las URLs.
  function linkifyLine(line) {
    // Escapar toda la línea primero
    var escaped = escapeHtml(line);
    // Buscar URLs (http/https) y envolverlas con <a>
    // La URL capturada NO debe contener < > (ya están escapados)
    return escaped.replace(
      /\b(https?:\/\/[^\s<>"]+[^\s<>".])/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="kair-mail-link">$1</a>'
    );
  }

  // ====== Toasts ======
  function toast(title, desc = "", type = "info") {
    const node = el("div", { class: `kair-toast kair-toast--${type}` });
    const icon = type === "success" ? D.ICONS.checkCircle
               : type === "warning" ? D.ICONS.alertTriangle
               : type === "error" ? D.ICONS.alertTriangle
               : D.ICONS.mail;
    node.innerHTML = `
      <span class="kair-toast__icon" style="color:var(--kair-${type === 'success' ? 'success' : type === 'error' || type === 'warning' ? 'danger' : 'primary'});">${icon}</span>
      <div class="kair-toast__body">
        <p class="kair-toast__title">${title}</p>
        ${desc ? `<p class="kair-toast__desc">${desc}</p>` : ""}
      </div>
    `;
    $("#toast-container").appendChild(node);
    setTimeout(() => {
      node.style.opacity = "0";
      node.style.transition = "opacity 200ms ease";
      setTimeout(() => node.remove(), 200);
    }, 3500);
  }

  // ====== Inicialización ======
  // F2 — Carga de eventos desde IPC real (KairCalendarAdapter) con fallback a mocks.
  // El adapter unifica 12 fuentes: plan de trabajo, capacitaciones, auditoría,
  // eventos rápidos, gestaciones, inspecciones, mantenimiento, recordatorios
  // (COPASST, Convivencia, Presupuesto, Afiliación, Inducciones) + cumplidos.
  // Si electronAPI no está disponible (modo browser standalone), usa D.EVENTS mocks.
  //
  // IMPORTANTE: en Electron los iframes NO heredan automáticamente el contextBridge.
  // Por eso hacemos fallback: window.electronAPI → window.parent.electronAPI → null.
  // Cuando el contextBridge del padre expone electronAPI, el iframe puede acceder
  // a el via window.parent.electronAPI (mismo origen = permitido).
  function getElectronAPI() {
    if (typeof window === "undefined") return null;
    return window.electronAPI
      || (window.parent && window.parent.electronAPI)
      || null;
  }

  function getKairCalendarAdapter() {
    if (typeof window === "undefined") return null;
    return window.KairCalendarAdapter
      || (window.parent && window.parent.KairCalendarAdapter)
      || null;
  }

  function getKairCalendar() {
    if (typeof window === "undefined") return null;
    return window.KairCalendar
      || (window.parent && window.parent.KairCalendar)
      || null;
  }

  async function loadEventsFromIPC() {
    var api = getElectronAPI();
    var adapter = getKairCalendarAdapter();

    if (!api || !adapter) {
      console.warn("[BandejaIntegrada] electronAPI/KairCalendarAdapter no disponible, usando mocks D.EVENTS (api=" + !!api + " adapter=" + !!adapter + ")");
      return D.EVENTS.slice();
    }

    try {
      var range = {
        start: D.MONTH_VIEW.year + "-01-01",  // Rango anual (adapter lo requiere)
        end: D.MONTH_VIEW.year + "-12-31",
        scope: state.allCompanies ? "all" : "company"
      };
      console.log("[BandejaIntegrada] loadEventsFromIPC: range=", range);
      var result = await adapter.list(range);
      console.log("[BandejaIntegrada] adapter.list() result:", result && result.success ? "success, " + (result.data ? result.data.length : 0) + " events" : "failed");
      if (result && result.success && Array.isArray(result.data)) {
        if (result.data.length === 0) {
          console.warn("[BandejaIntegrada] IPC retorno 0 eventos (puede ser que la BD esté vacía o el rango no coincide). Usando mocks.");
          return D.EVENTS.slice();
        }
        // Normalizar shape: el adapter devuelve {id, title, date, start, end, type}
        // pero app.js espera {id, title, date, start, end, category, ...}
        var normalized = result.data.map(function (ev) {
          return Object.assign({}, ev, {
            category: ev.type || ev.category || "plan",
            start: ev.start || ev.startTime || "00:00",
            end: ev.end || ev.endTime || "23:59"
          });
        });
        console.log("[BandejaIntegrada] IPC retorno " + normalized.length + " eventos del mundo real. Fuentes: " + JSON.stringify([...new Set(normalized.map(function(e) { return e.type || e.category; }))]));
        return normalized;
      }
      console.warn("[BandejaIntegrada] adapter.list() no retorno datos válidos, usando mocks");
      return D.EVENTS.slice();
    } catch (e) {
      console.error("[BandejaIntegrada] Error cargando eventos del adapter, usando mocks:", e);
      return D.EVENTS.slice();
    }
  }

  // F3.B — Cargar correos reales de Gmail. Si falla o no está conectado,
  // fallback a los mocks D.MAILS para que la UI no se rompa.
  async function loadMailsFromGmail() {
    var api = getElectronAPI();
    if (!api || !api.googleGmail) {
      console.warn("[BandejaIntegrada] electronAPI.googleGmail no disponible, usando mocks D.MAILS");
      return D.MAILS.slice();
    }
    try {
      var result = await api.googleGmail.listInbox({ maxResults: 25 });
      if (result && result.success && Array.isArray(result.data) && result.data.length > 0) {
        console.log("[BandejaIntegrada] Gmail retorno " + result.data.length + " correos reales");
        return result.data;
      }
      if (result && result.success && Array.isArray(result.data) && result.data.length === 0) {
        console.log("[BandejaIntegrada] Gmail retorno 0 correos, usando mocks");
        return D.MAILS.slice();
      }
      console.warn("[BandejaIntegrada] Gmail listInbox fallo, usando mocks:", result && result.error);
      return D.MAILS.slice();
    } catch (e) {
      console.error("[BandejaIntegrada] Error cargando correos de Gmail, usando mocks:", e);
      return D.MAILS.slice();
    }
  }

  // 📦 FASE 0 — Cargar correos con cache SQLite (instantáneo, sin API call)
  // Patrón Mail-0: leer primero del cache local, mostrar al toque, y
  // disparar sync en background para mantenerlo actualizado.
  // Si falla o no está conectado, fallback a la versión legacy (Gmail directo).
  // F1.B-fix — Acepta opciones { folder, forceSync } para soportar INBOX y SENT
  async function loadMailsFromCache(options) {
    options = options || {};
    var folder = options.folder || state.mailFolder || 'INBOX';
    var forceSync = options.forceSync || false;
    var api = getElectronAPI();
    if (!api || !api.emailCache) {
      console.warn("[BandejaIntegrada] electronAPI.emailCache no disponible, fallback a Gmail directo");
      return loadMailsFromGmail();
    }
    try {
      // 1. Leer del cache SQLite (instantáneo, sin API call)
      var cacheResult = await api.emailCache.getThreads({ folder: folder, maxResults: 50 });
      if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data) && cacheResult.data.length > 0) {
        console.log("[BandejaIntegrada] Cache SQLite retorno " + cacheResult.data.length + " threads (folder=" + folder + ")");
        // F1.B-fix — SIEMPRE actualizar state.mails con el cache del folder actual.
        // Antes solo se hacía en el primer sync, no cuando se cambiaba de folder.
        state.mails = cacheResult.data.map(threadToMail);
        if (forceSync) {
          // Cambio de folder: mostrar YA el cache actual + sync en background para refrescar
          render();
        }
        // 2. Disparar sync en background (no bloquea la UI, mantiene cache fresco)
        syncInboxInBackground();
        // 3. Devolver el cache actual
        return state.mails;
      }
      // 4. Cache vacío → primer sync (esperamos el resultado)
      console.log("[BandejaIntegrada] Cache vacío, sincronizando con Gmail por primera vez (folder=" + folder + ")...");
      var syncResult = await api.emailCache.syncInbox({ folder: folder, maxResults: 50 });
      if (syncResult && syncResult.success && syncResult.data) {
        console.log("[BandejaIntegrada] Primer sync: " + syncResult.data.synced + " threads guardados en SQLite");
        var afterResult = await api.emailCache.getThreads({ folder: folder, maxResults: 50 });
        if (afterResult && afterResult.success && Array.isArray(afterResult.data)) {
          return afterResult.data.map(threadToMail);
        }
      }
      // 5. Si todo falla → fallback a Gmail directo
      console.warn("[BandejaIntegrada] Sync inicial falló, fallback a Gmail directo");
      return loadMailsFromGmail();
    } catch (e) {
      console.error("[BandejaIntegrada] Error cargando desde cache, fallback a Gmail directo:", e);
      return loadMailsFromGmail();
    }
  }

  // Sync en background (no bloquea la UI). Dispara cada vez que se carga
  // el cache, para mantenerlo fresco. Cuando termina, re-lee el cache
  // y re-renderiza para mostrar los datos actualizados (patrón "pull to refresh").
  // Sync en background (no bloquea la UI). Dispara cada vez que se carga
  // el cache, para mantenerlo fresco. Cuando termina, re-lee el cache
  // y re-renderiza para mostrar los datos actualizados (patrón "pull to refresh").
  // F1.B-fix — Usa el folder actual (no siempre INBOX), así si estamos viendo
  // "Enviados" sincroniza SENT, no INBOX.
  function syncInboxInBackground() {
    var api = getElectronAPI();
    if (!api || !api.emailCache) return;
    var currentFolder = state.mailFolder || 'INBOX';
    api.emailCache.syncInbox({ folder: currentFolder, maxResults: 50 }).then(function (r) {
      if (r && r.success) {
        console.log("[BandejaIntegrada] Background sync OK: " + r.data.synced + " threads (folder=" + currentFolder + ")");
        // F4-fix — Re-leer el cache (ahora con datos completos: subject, sender, etc.)
        // y re-renderizar. Sin esto, el user ve los datos vacíos del cache anterior.
        return api.emailCache.getThreads({ folder: currentFolder, maxResults: 50 });
      } else {
        console.warn("[BandejaIntegrada] Background sync failed:", r && r.error);
        return null;
      }
    }).then(function (cacheResult) {
      if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data)) {
        // F1.B-fix — Solo actualizar state.mails si el cache corresponde al folder actual
        // (por si el user cambió de folder mientras se hacía el sync en background)
        if (state.mailFolder === currentFolder) {
          state.mails = cacheResult.data.map(threadToMail);
          console.log("[BandejaIntegrada] Re-cargados " + state.mails.length + " threads (folder=" + currentFolder + ")");
          render();
        } else {
          console.log("[BandejaIntegrada] Sync completó pero el user ya cambió a folder " + state.mailFolder + ", no actualizo state.mails");
        }
      }
    }).catch(function (e) {
      console.warn("[BandejaIntegrada] Background sync error:", e.message);
    });
  }

  // F1-Feature7 — Auto-refresh periódico cada 5 minutos para mantener el cache
  // actualizado sin que el user tenga que hacer click en "Sincronizar".
  // Solo corre si la Bandeja Integrada está abierta y el cache está inicializado.
  var autoRefreshInterval = null;
  function startAutoRefresh() {
    if (autoRefreshInterval) return; // ya está corriendo
    autoRefreshInterval = setInterval(function () {
      var api = getElectronAPI();
      if (!api || !api.emailCache) return;
      // Solo refrescar si la Bandeja Integrada está visible
      var isVisible = document.visibilityState === 'visible';
      if (!isVisible) return;
      console.log("[BandejaIntegrada] Auto-refresh disparado (cada 5 min)");
      syncInboxInBackground();
    }, 5 * 60 * 1000); // 5 minutos
    console.log("[BandejaIntegrada] Auto-refresh cada 5 min activado");
  }
  function stopAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      console.log("[BandejaIntegrada] Auto-refresh detenido");
    }
  }
  // Pausar el auto-refresh cuando la pestaña/página no está visible
  // (ahorrar llamadas a Gmail API cuando el user no está mirando)
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === 'visible') {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  // Convierte formato thread (SQLite cache) → formato mail (Bandeja Integrada).
  // La UI de Bandeja Integrada espera objetos con: id, sender, subject, snippet,
  // date, unread, body, etc. (similar a Gmail API output).
  function threadToMail(thread) {
    // F1.A-fix — Calcular avatarColor/avatarInitials a partir del sender
    // (antes quedaban undefined y el avatar del detalle se veía vacío).
    var senderName = thread.last_sender_name || thread.last_sender_email || '(remitente desconocido)';
    var senderEmail = thread.last_sender_email || '';
    var computedInitials = (senderName || '?')
      .split(' ').map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase() || '?';
    var computedColor = '#' + stringHashColor(senderEmail || senderName);
    var computedTime = formatGmailDate(thread.last_message_date, true) || '';
    // DEBUG — Solo en desarrollo. Borrar después.
    if (!computedTime && thread.last_message_date) {
      console.log('[BandejaIntegrada][DEBUG] threadToMail sin tiempo:', { id: thread.id, last_message_date: thread.last_message_date, type: typeof thread.last_message_date, formatted: formatGmailDate(thread.last_message_date, true) });
    }
    return {
      id: thread.id,
      threadId: thread.id,
      sender: senderName,
      senderEmail: senderEmail,
      subject: thread.subject || '(sin asunto)',
      snippet: thread.snippet || '',
      preview: thread.snippet || '',  // F1.A-fix — antes era "undefined"
      date: thread.last_message_date,
      time: computedTime,  // F1.A-fix — "22:00" para la lista
      unread: thread.has_unread,
      star: thread.is_starred,
      avatarColor: computedColor,
      avatarInitials: computedInitials,
      label_ids: Array.isArray(thread.label_ids) ? thread.label_ids : [],  // F1-Feature1
      body: '',  // Fase 0: vacío. Se carga on-demand al abrir el thread.
      thread: thread,  // Metadatos completos del thread (para el detail panel)
      messageCount: thread.message_count || 1  // F1-Feature6 — para badge "N mensajes"
    };
  }

  // F1.A-fix — Hash determinístico de un string a color hex (estilo Gmail).
  // Mismo algoritmo que google-gmail.js#stringToColor.
  function stringHashColor(str) {
    if (!str) return '5f6368';
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var c = (hash & 0x00FFFFFF).toString(16);
    return ('000000' + c).slice(-6);
  }

  // F2 — Helper para refrescar eventos del IPC. Llamado desde #btn-refresh.
  async function refreshEvents() {
    state.refreshing = true;
    state.mailLoading = true;
    if ($("#refresh-icon")) $("#refresh-icon").classList.add("kair-spin");
    render();
    try {
      // F2 — Refrescar eventos del IPC
      state.events = await loadEventsFromIPC();
      // F3.B — Refrescar correos de Gmail (si está conectado)
      if (state.gmailConnected) {
        state.mails = await loadMailsFromCache();
      }
      toast("Sincronizado", state.events.length + " eventos · " + state.mails.length + " correos", "success");
    } finally {
      state.refreshing = false;
      state.mailLoading = false;
      if ($("#refresh-icon")) $("#refresh-icon").classList.remove("kair-spin");
      render();
    }
  }

  // F4-fix — Recargar eventos cuando cambia el scope (toggle "Todas las empresas").
  // Antes este cambio solo actualizaba el label, pero no recargaba los eventos
  // del IPC → el usuario veía siempre los mismos eventos. Ahora recarga
  // con scope:'all' o scope:'company' según el estado.
  async function reloadEventsForScope() {
    state.refreshing = true;
    state.mailLoading = true;
    if ($("#refresh-icon")) $("#refresh-icon").classList.add("kair-spin");
    render();
    try {
      state.events = await loadEventsFromIPC();
      // Re-armar activeCategories con las categorías de los nuevos eventos
      // (pueden aparecer categorías nuevas de otras empresas)
      state.events.forEach(function (ev) {
        if (ev && ev.category && !state.activeCategories.has(ev.category)) {
          state.activeCategories.add(ev.category);
        }
      });
      var scope = state.allCompanies ? "todas las empresas" : (getActiveCompanyName() || "la empresa actual");
      toast(
        state.allCompanies ? "Mostrando todas las empresas" : "Mostrando solo " + scope,
        state.events.length + " eventos cargados",
        "info"
      );
    } finally {
      state.refreshing = false;
      state.mailLoading = false;
      if ($("#refresh-icon")) $("#refresh-icon").classList.remove("kair-spin");
      render();
    }
  }

  // F4-fix — Handler del botón "Redactar". Si Gmail está conectado, abre
  // un editor de correo (F3.B). Si NO, muestra mensaje para ir a Configuración.
  function onComposeClick() {
    if (state.gmailConnected) {
      // F3.B — Abrir editor de correo
      toast("Redactar nuevo correo", "Editor de correo (próximamente F3.B).", "info");
    } else {
      // F4-fix — El switch de Conectar/Desconectar ahora vive en
      // Configuración > Gestión de Empresas. Acá solo informamos.
      toast("Gmail no conectado", "Conectá Gmail en Configuración > Gestión de Empresas.", "info");
    }
  }

  // F4-fix — Handler del indicador Gmail en el header (read-only).
  // Click → cierra el iframe y abre la Configuración (sección Empresas)
  // para que el user conecte/desconecte Gmail desde el switch correspondiente.
  function onGmailIndicatorClick() {
    if (window.parent && window.parent !== window) {
      // F4-fix — Enviar mensaje al main app para que cierre el iframe y abra Config
      try {
        window.parent.postMessage({ type: 'bandeja-integrada-open-config', section: 'empresas' }, '*');
      } catch (e) { /* ignore */ }
    }
  }

  // F4-fix — Actualiza el indicador Gmail del header (read-only).
  // El switch de Conectar/Desconectar está en Configuración > Gestión de Empresas.
  // Acá solo mostramos el estado actual: verde con email si está conectado,
  // rojo "Gmail desconectado" si no.
  async function updateGmailIndicator() {
    var indicator = $("#gmail-indicator");
    var text = $("#gmail-indicator-text");
    if (!indicator || !text) return;
    var api = getElectronAPI();
    if (!api || !api.google) {
      indicator.setAttribute("data-connected", "false");
      text.textContent = "Gmail: API no disponible";
      return;
    }
    try {
      var statusRes = await api.google.status();
      var connected = !!(statusRes && statusRes.success && statusRes.data && statusRes.data.connected);
      if (connected) {
        // Intentar obtener el email del usuario
        try {
          var profileRes = await api.googleGmail.getProfile();
          var email = (profileRes && profileRes.success && profileRes.data && profileRes.data.email) || "";
          if (email) {
            indicator.setAttribute("data-connected", "true");
            indicator.title = "Conectado como " + email + " · click para ir a Configuración";
            text.textContent = email;
          } else {
            indicator.setAttribute("data-connected", "true");
            indicator.title = "Gmail conectado · click para ir a Configuración";
            text.textContent = "Gmail conectado";
          }
        } catch (e) {
          indicator.setAttribute("data-connected", "true");
          indicator.title = "Gmail conectado · click para ir a Configuración";
          text.textContent = "Gmail conectado";
        }
      } else {
        indicator.setAttribute("data-connected", "false");
        indicator.title = "Gmail no conectado · click para ir a Configuración";
        text.textContent = "Gmail: desconectado";
      }
    } catch (e) {
      indicator.setAttribute("data-connected", "false");
      text.textContent = "Gmail: error";
      indicator.title = "Error verificando Gmail: " + (e.message || e);
    }
  }

  async function init() {
    // F4-fix — Restaurar la preferencia del toggle "Todas las empresas"
    // desde localStorage (mismo mecanismo que el calendario viejo usa para
    // persistir el scope).
    try {
      var storedAll = localStorage.getItem('kair-bandeja.allCompanies');
      if (storedAll !== null) {
        state.allCompanies = (storedAll === '1');
        var toggle = $("#toggle-companies");
        if (toggle) toggle.setAttribute("data-on", state.allCompanies ? "true" : "false");
      }
    } catch (e) { /* ignore */ }

    // F4-fix — Verificar si Gmail está conectado ANTES de cargar nada
    // y actualizar el indicador del header (read-only).
    var api = getElectronAPI();
    if (api && api.google) {
      try {
        var statusRes = await api.google.status();
        if (statusRes && statusRes.success && statusRes.data) {
          state.gmailConnected = !!statusRes.data.connected;
          console.log("[BandejaIntegrada][INIT] Gmail status: connected=" + state.gmailConnected);
        }
      } catch (e) {
        console.warn("[BandejaIntegrada][INIT] Error checking Gmail status:", e);
      }
    }
    // F4-fix — El indicador del header es read-only. El switch vive en Configuración.
    updateGmailIndicator();

    // F3.B — Cargar correos de Gmail si está conectado, sino mocks
    if (state.gmailConnected) {
      state.mails = await loadMailsFromCache();
      // F1-Feature1 — Cargar labels de Gmail del cache SQLite
      var api2 = getElectronAPI();
      if (api2 && api2.emailCache && api2.emailCache.getLabels) {
        try {
          var labelsResult = await api2.emailCache.getLabels();
          if (labelsResult && labelsResult.success && Array.isArray(labelsResult.data)) {
            state.labels = labelsResult.data.map(function (l) {
              return {
                id: l.id,
                name: l.name,
                type: l.type,
                color_background: l.color_background || '#a479e2',
                color_text: l.color_text || '#ffffff',
                message_count: l.message_count || 0,
                unread_count: l.unread_count || 0
              };
            });
            console.log("[BandejaIntegrada] Labels cargados: " + state.labels.length);
          }
        } catch (e) {
          console.warn("[BandejaIntegrada] Error cargando labels:", e.message);
        }
      }
      // F1.B-fix — Pre-cargar SENT en background (sin esperar) para que el click
      // en "Enviados" sea instantáneo. Antes el primer click tardaba porque
      // había que hacer sync de SENT.
      setTimeout(function () {
        var api = getElectronAPI();
        if (api && api.emailCache && api.emailCache.syncInbox) {
          api.emailCache.syncInbox({ folder: "SENT", maxResults: 50 }).then(function (r) {
            if (r && r.success) {
              console.log("[BandejaIntegrada] SENT pre-cargado en background: " + r.data.synced + " threads");
            }
          }).catch(function (e) {
            console.warn("[BandejaIntegrada] Error pre-cargando SENT:", e.message);
          });
        }
      }, 2000);  // 2 segundos después del init, no bloquear el arranque
      // F1-Feature7 — Activar auto-refresh cada 5 minutos
      startAutoRefresh();
    } else {
      state.mails = D.MAILS.slice();
    }
    // F2 — Eventos del IPC (con fallback a mocks)
    state.events = await loadEventsFromIPC();
    console.log("[BandejaIntegrada][INIT] state.events.length=" + state.events.length + ", state.mails.length=" + state.mails.length + ", primera ev: " + (state.events[0] ? JSON.stringify({id: state.events[0].id, title: state.events[0].title, date: state.events[0].date, category: state.events[0].category}) : "none"));
    // F4-fix — Llamar selectMail (en vez de solo setear selectedMailId) para
    // que se dispare el lazy load del body desde email_messages.
    if (state.mails[0]) {
      selectMail(state.mails[0].id);
    } else {
      state.selectedMailId = "m1";
    }
    state.selectedDate = D.MONTH_VIEW.todayIso;
    // F2 — Inicializar activeCategories con las 6 oficiales de K+AIR
    // Y agregar también las categorías únicas encontradas en los eventos del IPC
    // (rapido, gestacion, mantenimiento_programado, recordatorio_*, etc.).
    // Sin esto, el footer y los KPIs filtran y muestran solo los mocks.
    Object.keys(D.EVENT_CATEGORIES).forEach((c) => state.activeCategories.add(c));
    state.events.forEach(function (ev) {
      if (ev && ev.category && !state.activeCategories.has(ev.category)) {
        state.activeCategories.add(ev.category);
      }
    });
    console.log("[BandejaIntegrada][INIT] activeCategories=" + JSON.stringify([...state.activeCategories]));
    state.draft.date = D.MONTH_VIEW.todayIso;
    // F4 — Actualizar el header con el nombre de la empresa activa (del main app)
    updateCompanyDisplay();
    // F4 — Escuchar cambios en window.parent.currentCompany (por si el user cambia
    // de empresa en la app principal mientras la Bandeja Integrada está abierta)
    if (window.parent && window.parent.addEventListener) {
      // Polling cada 2s para detectar cambios (alternativa: storage events)
      setInterval(updateCompanyDisplay, 2000);
    }
    // F4 — Inicializar mes visible del mini-cal (navegable con chevron)
    state.viewYear = D.MONTH_VIEW.year;
    state.viewMonth = D.MONTH_VIEW.month;
    state.viewMonthLabel = D.buildMonthLabel(state.viewYear, state.viewMonth);
    // F4 — Día seleccionado inicial = today (el user puede cambiarlo haciendo click)
    state.selectedDate = D.MONTH_VIEW.todayIso;

    bindHeader();
    render();

    // F4-fix — NO montar el KAirCalendar viejo. renderBigCalendar() ya construye
    // el calendario custom con el mismo data del IPC. Antes se montaban los DOS
    // → el usuario veía el header oscuro "Calendario" del viejo + el grid nuevo
    // abajo (apilados). El KAirCalendar traía su propio header/search/tabs que
    // duplicaban la UI. Las funcionalidades (day popovers, detail panel) las
    // podemos re-implementar después si hace falta.
    // mountKairCalendarOverlay();
  }

  // F2 — Monta el KairCalendar en el overlay #calendar-slide.
  // Misma clase que el calendario viejo, con el adapter IPC real.
  //
  // NOTA: el export viejo de kair-calendar.js expone KairCalendar como un
  // factory {create, version}, NO como clase directa. Por eso usamos
  // KairCalendar.create({...}) en vez de `new KairCalendar({...})`.
  function createFallbackAdapter() {
    // Adapter mínimo: solo lee eventosRapidos del IPC. Si el IPC tampoco
    // está disponible, devuelve los mocks D.EVENTS para que la UI no se rompa.
    var api = getElectronAPI();
    return {
      list: async function (range) {
        if (api && api.eventosRapidos && api.eventosRapidos.list) {
          try { return await api.eventosRapidos.list(range); }
          catch (e) { console.warn("[FallbackAdapter] eventosRapidos.list fallo:", e); }
        }
        return { success: true, data: D.EVENTS.slice() };
      },
      create: async function (ev) {
        if (api && api.eventosRapidos && api.eventosRapidos.create) {
          return api.eventosRapidos.create(ev);
        }
        return { success: false, error: { message: "Adapter fallback sin electronAPI" } };
      },
      update: async function (ev) {
        if (api && api.eventosRapidos && api.eventosRapidos.update) {
          return api.eventosRapidos.update(ev);
        }
        return { success: false };
      },
      remove: async function (id) {
        if (api && api.eventosRapidos && api.eventosRapidos.remove) {
          return api.eventosRapidos.remove(id);
        }
        return { success: false };
      },
      version: "fallback-1.0.0"
    };
  }

  function mountKairCalendarOverlay() {
    var slide = document.getElementById("calendar-slide");
    if (!slide) return;
    if (slide.dataset.kairMounted === "1") return; // ya montado

    // Mapear TODAS las categorías (oficiales K+AIR + fallback IPC) a eventTypes
    // del calendar viejo. Sin esto, las categorías dinámicas del IPC
    // (rapido, gestacion, recordatorio_*) no aparecen en el KairCalendar.
    var allCategories = Object.assign({}, D.EVENT_CATEGORIES || {}, FALLBACK_CATEGORIES);
    var eventTypes = Object.keys(allCategories).map(function (k) {
      var c = allCategories[k];
      return { id: k, label: c.label || k, color: c.color };
    });

    // Usar adapter IPC real si está disponible, sino fallback a eventosRapidos-only,
    // sino fallback a mocks. Garantiza que el calendario SIEMPRE tenga datos.
    var KairCal = getKairCalendar();
    var adapter = getKairCalendarAdapter() || createFallbackAdapter();

    if (!KairCal || typeof KairCal.create !== "function") {
      console.warn("[BandejaIntegrada] KairCalendar no disponible (KairCal=" + !!KairCal + "), overlay deshabilitado.");
      return;
    }

    try {
      var cal = KairCal.create({
        inline: true,
        mountSelector: "#calendar-slide",
        adapter: adapter,
        eventTypes: eventTypes,
        initialView: "month",
        initialDate: new Date(D.MONTH_VIEW.year, D.MONTH_VIEW.month, 21),
        showSidebar: false,  // El sidebar ya está en la Bandeja Integrada (mini-cal propio)
        locale: "es",
        // F4 — Callbacks para hacer el calendario funcional (mismo patrón que el viejo)
        onEventClick: function (ev) {
          // Click en un evento → abrir modal de detalle
          openEventDetailModal(ev, adapter);
        },
        onEventCreate: function (ev) {
          // Click en celda vacía (drag → drop) → abrir modal de crear
          openEventCreateModal(ev, adapter, function () {
            // Callback: cuando se guarda el evento, refrescar el calendario
            cal._loadEvents().then(function () { cal._refresh(); });
            refreshEvents();  // También refrescar el state.events (mini-cal, KPIs)
          });
        }
      });
      slide.dataset.kairMounted = "1";
      // Exponer para debug
      window.__kairBandejaCalendar = cal;
      console.log("[BandejaIntegrada] K+AIR Calendar montado en #calendar-slide (adapter=" + (adapter.version || "?") + ")");
    } catch (e) {
      console.error("[BandejaIntegrada] Error montando KairCalendar:", e);
    }
  }

  // F4 — Modal de detalle de un evento del calendario
  // Muestra la info del evento + botones (Editar / Eliminar / Marcar cumplido)
  function openEventDetailModal(ev, adapter) {
    var cat = getCategoryStyle(ev.category);
    var dateStr = ev.date || "—";
    var timeStr = (ev.start || "") + (ev.end ? " - " + ev.end : "");
    var locationStr = ev.location || "Sin ubicación";
    var titleStr = ev.title || "(sin título)";

    // Crear/actualizar el modal
    var modal = document.getElementById("event-detail-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "event-detail-modal";
      modal.className = "kair-event-modal-overlay";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="kair-event-modal">
        <div class="kair-event-modal__header" style="background:${cat.bg};border-left:4px solid ${cat.color};">
          <span class="kair-event-modal__category" style="background:${cat.color};color:#fff;">${cat.label || ev.category}</span>
          <button class="kair-event-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>
        <div class="kair-event-modal__body">
          <h2 class="kair-event-modal__title">${escapeHtml(titleStr)}</h2>
          <div class="kair-event-modal__meta">
            <div class="kair-event-modal__meta-row">
              <strong>Fecha:</strong> ${dateStr} ${timeStr ? "· " + timeStr : ""}
            </div>
            <div class="kair-event-modal__meta-row">
              <strong>Ubicación:</strong> ${escapeHtml(locationStr)}
            </div>
            ${ev.attendees && ev.attendees.length ? '<div class="kair-event-modal__meta-row"><strong>Asistentes:</strong> ' + ev.attendees.length + '</div>' : ''}
            ${ev.linkedMailId ? '<div class="kair-event-modal__meta-row"><strong>Vinculado a correo:</strong> ' + escapeHtml(ev.linkedMailId) + '</div>' : ''}
          </div>
          ${ev.description || ev.notes ? '<div class="kair-event-modal__description">' + escapeHtml(ev.description || ev.notes) + '</div>' : ''}
        </div>
        <div class="kair-event-modal__actions">
          <button class="kair-event-modal__btn kair-event-modal__btn--secondary" data-action="cumplido">
            ${ev.cumplido ? '✓ Cumplido' : 'Marcar cumplido'}
          </button>
          <button class="kair-event-modal__btn kair-event-modal__btn--primary" data-action="edit">Editar</button>
          <button class="kair-event-modal__btn kair-event-modal__btn--danger" data-action="delete">Eliminar</button>
        </div>
      </div>
    `;
    modal.style.display = "flex";

    // Handlers de los botones
    var closeModal = function () { modal.style.display = "none"; };
    modal.querySelector("[data-action='close']").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector("[data-action='cumplido']").addEventListener("click", function () {
      // F4-fix: marcar como cumplido usa la API de electronAPI (no adapter directo)
      var api = getElectronAPI();
      if (api && api.eventosCumplidos && ev.id) {
        api.eventosCumplidos.marcar({ evento_id: ev.id, empresaId: getActiveCompanyName() || null })
          .then(function (r) {
            if (r && r.success) {
              toast("Marcado como cumplido", ev.title, "success");
              closeModal();
              if (window.__kairBandejaCalendar) {
                window.__kairBandejaCalendar._loadEvents().then(function () {
                  window.__kairBandejaCalendar._refresh();
                });
              }
            } else {
              toast("No se pudo marcar cumplido", (r && r.error) || "Error", "error");
            }
          })
          .catch(function (e) { toast("Error", e.message, "error"); });
      } else {
        toast("Marcar cumplido", "API no disponible (próximamente)", "info");
      }
    });
    modal.querySelector("[data-action='edit']").addEventListener("click", function () {
      closeModal();
      openEventCreateModal(ev, adapter, function () {
        if (window.__kairBandejaCalendar) {
          window.__kairBandejaCalendar._loadEvents().then(function () { window.__kairBandejaCalendar._refresh(); });
        }
        refreshEvents();
      });
    });
    modal.querySelector("[data-action='delete']").addEventListener("click", function () {
      if (!confirm("¿Eliminar este evento?\n\n" + titleStr + "\n\nEsta acción no se puede deshacer.")) return;
      // F4-fix: eliminar via adapter (eventosRapidos solo acepta 'rapido-*')
      if (adapter && adapter.remove) {
        adapter.remove(ev.id).then(function (r) {
          if (r && r.success) {
            toast("Evento eliminado", titleStr, "success");
            closeModal();
            if (window.__kairBandejaCalendar) {
              window.__kairBandejaCalendar._loadEvents().then(function () { window.__kairBandejaCalendar._refresh(); });
            }
            refreshEvents();
          } else {
            toast("No se puede eliminar", (r && r.error && r.error.message) || "Solo eventos personales (rapido) son editables", "info");
          }
        }).catch(function (e) { toast("Error", e.message, "error"); });
      }
    });
  }

  // F4 — Modal de crear/editar evento
  // Usado cuando el user hace click en una celda vacía del calendario
  // o hace click en "Editar" desde el modal de detalle.
  function openEventCreateModal(ev, adapter, onSaved) {
    // Si `ev` es null → crear nuevo. Si tiene id → editar existente.
    var isEdit = ev && ev.id;
    var titleVal = isEdit ? (ev.title || "") : "";
    var dateVal = (isEdit && ev.date) || (ev && ev.date) || D.MONTH_VIEW.todayIso;
    var startVal = (isEdit && ev.start) || "09:00";
    var endVal = (isEdit && ev.end) || "10:00";
    var locationVal = (isEdit && ev.location) || "";
    var notesVal = (isEdit && (ev.notes || ev.description)) || "";
    var categoryVal = (isEdit && ev.category) || "rapido";

    var modal = document.getElementById("event-create-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "event-create-modal";
      modal.className = "kair-event-modal-overlay";
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="kair-event-modal">
        <div class="kair-event-modal__header">
          <h3 style="margin:0;font-size:1rem;color:var(--kair-text-strong);">${isEdit ? 'Editar evento' : 'Nuevo evento'}</h3>
          <button class="kair-event-modal__close" data-action="close" aria-label="Cerrar">×</button>
        </div>
        <form class="kair-event-modal__body" data-form="event">
          <label class="kair-event-modal__field">
            <span>Título</span>
            <input type="text" name="title" required value="${escapeHtml(titleVal)}" placeholder="Reunión con equipo" />
          </label>
          <div class="kair-event-modal__row">
            <label class="kair-event-modal__field">
              <span>Fecha</span>
              <input type="date" name="date" required value="${dateVal}" />
            </label>
            <label class="kair-event-modal__field">
              <span>Hora inicio</span>
              <input type="time" name="start" value="${startVal}" />
            </label>
            <label class="kair-event-modal__field">
              <span>Hora fin</span>
              <input type="time" name="end" value="${endVal}" />
            </label>
          </div>
          <label class="kair-event-modal__field">
            <span>Ubicación</span>
            <input type="text" name="location" value="${escapeHtml(locationVal)}" placeholder="Sala de juntas P3" />
          </label>
          <label class="kair-event-modal__field">
            <span>Categoría</span>
            <select name="category">
              <option value="rapido" ${categoryVal === 'rapido' ? 'selected' : ''}>Personal (rápido)</option>
              <option value="plan" ${categoryVal === 'plan' ? 'selected' : ''}>Plan de Trabajo</option>
              <option value="capacitacion" ${categoryVal === 'capacitacion' ? 'selected' : ''}>Capacitación</option>
              <option value="auditoria" ${categoryVal === 'auditoria' ? 'selected' : ''}>Auditoría</option>
            </select>
          </label>
          <label class="kair-event-modal__field">
            <span>Notas</span>
            <textarea name="notes" rows="2" placeholder="Detalles adicionales...">${escapeHtml(notesVal)}</textarea>
          </label>
        </form>
        <div class="kair-event-modal__actions">
          <button class="kair-event-modal__btn kair-event-modal__btn--secondary" data-action="cancel">Cancelar</button>
          <button class="kair-event-modal__btn kair-event-modal__btn--primary" data-action="save">${isEdit ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    `;
    modal.style.display = "flex";

    var closeModal = function () { modal.style.display = "none"; };
    modal.querySelector("[data-action='close']").addEventListener("click", closeModal);
    modal.querySelector("[data-action='cancel']").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

    modal.querySelector("[data-action='save']").addEventListener("click", function () {
      var form = modal.querySelector("[data-form='event']");
      var data = Object.fromEntries(new FormData(form).entries());
      if (!data.title) { toast("Falta el título", "Agregá un título al evento", "warning"); return; }
      var newEv = Object.assign({}, ev || {}, {
        id: isEdit ? ev.id : ("rapido-" + Date.now()),
        title: data.title,
        date: data.date,
        start: data.start,
        end: data.end,
        location: data.location || "",
        notes: data.notes || "",
        category: data.category,
        type: data.category
      });
      var op = isEdit ? adapter.update(newEv) : adapter.create(newEv);
      op.then(function (r) {
        if (r && r.success) {
          toast(isEdit ? "Evento actualizado" : "Evento creado", newEv.title, "success");
          closeModal();
          if (typeof onSaved === 'function') onSaved();
        } else {
          toast("No se pudo guardar", (r && r.error && r.error.message) || "Error", "error");
        }
      }).catch(function (e) { toast("Error", e.message, "error"); });
    });
  }

  // F4 — Helper: escape HTML para evitar XSS en títulos/ubicaciones
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ====== Header bindings ======
  // F4-fix — Helper compartido por el botón Volver del header (oculto) y el
  // botón flotante "Volver" (visible). También usado por el handler de ESC.
  function navigateBack() {
    // F1-Feature7 — Detener el auto-refresh al salir de la Bandeja Integrada
    if (typeof stopAutoRefresh === 'function') stopAutoRefresh();
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: "bandeja-integrada-back" }, "*"); }
      catch (e) { history.back(); }
    } else {
      history.back();
    }
  }

  function bindHeader() {
    // 📦563 — Botón Volver: si estamos en iframe (bandeja integrada dentro de K+AIR),
    // mandamos postMessage al parent para que cierre el iframe. Si estamos standalone,
    // caemos a history.back() como fallback.
    $("#btn-back").addEventListener("click", navigateBack);
    // F4-fix — Botón flotante "Volver" (visible arriba a la izquierda del iframe).
    // Como el header interno está oculto, este botón es la forma principal de
    // salir de la Bandeja Integrada desde adentro.
    var btnBackFloating = $("#btn-back-floating");
    if (btnBackFloating) {
      btnBackFloating.addEventListener("click", navigateBack);
    }
    // F4-fix — ESC también cierra la Bandeja Integrada (atajo de teclado estándar).
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        // Solo actuar si NO hay un modal abierto encima (ej: detalle evento)
        var openModal = document.querySelector(".kair-modal-overlay:not([hidden])");
        if (!openModal) navigateBack();
      }
    });
    $("#panel-toggle").addEventListener("click", toggleCalendar);
    // F4-fix — Toggle "Todas las empresas" (igual al calendario viejo 📦543).
    // Cuando cambia, hay que RECARGAR los eventos del IPC con el nuevo scope
    // (antes solo cambiaba el label y el data-on, pero NO recargaba → bug).
    $("#toggle-companies").addEventListener("click", () => {
      state.allCompanies = !state.allCompanies;
      $("#toggle-companies").setAttribute("data-on", state.allCompanies);
      // Persistir preferencia (igual que el calendario viejo usa localStorage)
      try { localStorage.setItem('kair-bandeja.allCompanies', state.allCompanies ? '1' : '0'); } catch (e) {}
      updateCompanyDisplay();
      // Recargar eventos con el nuevo scope (la pieza que faltaba)
      reloadEventsForScope();
    });
    $("#btn-refresh").addEventListener("click", refreshEvents);
    $("#btn-compose").addEventListener("click", onComposeClick);
    // F1-Feature4 — Editor de firma. Click → abrir mini modal para editarla.
    $("#btn-signature").addEventListener("click", openSignatureModal);
    // F4-fix — Indicador Gmail en el header: read-only. Click → ir a Configuración.
    var gmailIndicator = $("#gmail-indicator");
    if (gmailIndicator) {
      gmailIndicator.addEventListener("click", onGmailIndicatorClick);
      gmailIndicator.style.cursor = "pointer";
    }
    updateGmailIndicator();
    $("#search-input").addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      // Re-renderizamos la lista de correos (siempre visible en el área principal)
      renderMailList($("#mail-list-container"));
    });
  }

  // Alterna la visibilidad del overlay deslizante del calendario
  function toggleCalendar() {
    state.calendarVisible = !state.calendarVisible;
    render();
  }

  function refresh() {
    state.refreshing = true;
    state.mailLoading = true;
    $("#refresh-icon").classList.add("kair-spin");
    render();
    setTimeout(() => {
      state.refreshing = false;
      state.mailLoading = false;
      $("#refresh-icon").classList.remove("kair-spin");
      const unread = state.mails.filter((m) => m.unread).length;
      toast("Bandeja sincronizada", `${state.mails.length} mensajes · ${unread} no leídos`, "success");
      render();
    }, 1200);
  }

  // ====== Render principal ======
  function render() {
    renderHeaderState();
    renderKpiStrip();
    renderLayout();
    renderFooter();
  }

  function renderHeaderState() {
    // Botón de flecha: actualiza estado y tooltip
    // data-calendar-visible="false" (default): flecha → "abrir calendario"
    // data-calendar-visible="true": flecha ← "cerrar calendario"
    const toggle = $("#panel-toggle");
    toggle.setAttribute("data-calendar-visible", state.calendarVisible);
    toggle.setAttribute("aria-label", state.calendarVisible ? "Ocultar calendario" : "Mostrar calendario");
    toggle.title = state.calendarVisible ? "Ocultar calendario (ver correo)" : "Mostrar calendario";

    // Área de contenido: actualiza data-calendar-visible para atenuar el correo
    const contentArea = $("#content-area");
    if (contentArea) {
      contentArea.setAttribute("data-calendar-visible", state.calendarVisible);
    }

    // Overlay del calendario: actualiza data-visible para deslizar
    const slide = $("#calendar-slide");
    if (slide) {
      slide.setAttribute("data-visible", state.calendarVisible);
    }
  }

  function renderKpiStrip() {
    const unread = state.mails.filter((m) => m.unread).length;
    const todayEvents = state.events.filter((e) => e.date === D.MONTH_VIEW.todayIso).length;
    const pending = state.mails.filter((m) => m.meetingSuggestion && m.unread).length;
    const critical = state.events.filter((e) => e.category === "critico").length;

    // F4 — Calcular "Próxima reunión" dinámicamente desde state.events
    var nextMeeting = null;
    for (var i = 0; i < state.events.length; i++) {
      var ev = state.events[i];
      if (ev.date && ev.start && ev.date >= D.MONTH_VIEW.todayIso) {
        if (!nextMeeting || ev.date < nextMeeting.date) {
          nextMeeting = ev;
        }
      }
    }
    var nextSub = nextMeeting ? "Próxima: " + (nextMeeting.start || "00:00") : "Sin eventos próximos";

    // F4 — Calcular eventos críticos que vencen este mes
    var monthPrefix = D.MONTH_VIEW.year + "-" + String(D.MONTH_VIEW.month + 1).padStart(2, "0");
    var criticalThisMonth = state.events.filter(function (e) {
      return e.category === "critico" && e.date && e.date.indexOf(monthPrefix) === 0;
    }).length;
    var criticalSub = criticalThisMonth > 0 ? "Vencen este mes" : "Todo al día";

    // F4 — Helper para mostrar "—" en vez de 0 cuando es 0
    function kpiValue(v) {
      return v > 0 ? v : "—";
    }

    const items = [
      { icon: D.ICONS.mail, color: "blue", value: kpiValue(unread), label: "Correos no leídos", sub: state.mails.length + " totales" },
      { icon: D.ICONS.calendarPlus, color: "green", value: kpiValue(todayEvents), label: "Reuniones hoy", sub: nextSub },
      { icon: D.ICONS.link, color: "yellow", value: kpiValue(pending), label: "Invitaciones pendientes", sub: "Requieren confirmar" },
      { icon: D.ICONS.checkCircle, color: "red", value: kpiValue(critical), label: "Eventos críticos", sub: criticalSub },
    ];

    const strip = $("#kpi-strip");
    strip.innerHTML = "";
    items.forEach((it, idx) => {
      const item = el("div", { class: "kair-kpi-item" });
      item.innerHTML = `
        <div class="kair-kpi__icon kair-kpi__icon--${it.color}">${it.icon}</div>
        <div>
          <div class="kair-kpi__value">${it.value}</div>
          <div class="kair-kpi__label">${it.label}</div>
          <div class="kair-kpi__subdata">${it.sub}</div>
        </div>
      `;
      strip.appendChild(item);
      if (idx < items.length - 1) {
        strip.appendChild(el("div", { class: "kair-kpi-divider" }));
      }
    });
  }

  function renderLayout() {
    // 1. Sidebar siempre visible
    renderSidebar($("#sidebar"));

    // 2. Correo: SIEMPRE renderizado (lista + detalle Gmail)
    renderMailList($("#mail-list-container"));
    renderMailDetail($("#mail-detail-container"));

    // 3. Calendario overlay: SIEMPRE renderizado (la visibilidad se controla por CSS data-visible)
    renderBigCalendar($("#calendar-slide"));
  }

  // ====== Sidebar ======
  function renderSidebar(container) {
    container.innerHTML = "";
    const visibleEvents = state.events.filter((e) => state.activeCategories.has(e.category));
    const eventDates = new Set(visibleEvents.map((e) => e.date));

    // Mini-calendario
    const mini = el("div", { class: "kair-mini-cal" });
    mini.innerHTML = `
      <div class="kair-mini-cal__header">
        <button class="kair-icon-btn" style="width:22px;height:22px;" title="Mes anterior" id="mini-prev">${D.ICONS.chevronLeft}</button>
        <span>${state.viewMonthLabel}</span>
        <button class="kair-icon-btn" style="width:22px;height:22px;" title="Mes siguiente" id="mini-next">${D.ICONS.chevronRight}</button>
      </div>
      <div class="kair-mini-cal__grid" id="mini-grid"></div>
    `;
    container.appendChild(mini);

    // F4 — Handlers de los chevron para navegar entre meses
    $("#mini-prev", mini).addEventListener("click", () => changeMonth(-1));
    $("#mini-next", mini).addEventListener("click", () => changeMonth(1));

    // F4 — Generar la grilla del mes visible dinámicamente
    const monthGrid = D.buildMonthGrid(state.viewYear, state.viewMonth);
    // F4 — Mapa de colores por categoría para los puntitos de eventos
    const categoryColor = {};
    Object.values(D.EVENT_CATEGORIES).forEach((c) => { categoryColor[c.id] = c.color; });
    if (D.FALLBACK_CATEGORIES) {
      Object.keys(D.FALLBACK_CATEGORIES).forEach((k) => {
        if (!categoryColor[k]) categoryColor[k] = D.FALLBACK_CATEGORIES[k].color;
      });
    }
    const dayColors = {}; // iso -> color del primer evento del día
    visibleEvents.forEach((ev) => {
      if (ev.date && !dayColors[ev.date]) {
        dayColors[ev.date] = categoryColor[ev.category] || "#174ea6";
      }
    });
    const grid = $("#mini-grid", mini);
    D.WEEKDAY_LABELS.forEach((w) => {
      grid.appendChild(el("div", { class: "kair-mini-cal__weekday" }, w.slice(0, 1)));
    });
    monthGrid.flat().forEach((c) => {
      const hasEvents = eventDates.has(c.iso);
      const isSelected = state.selectedDate === c.iso;
      const dayColor = hasEvents ? dayColors[c.iso] : null;
      const btn = el("button", {
        class: "kair-mini-cal__day",
        "data-out": !c.inMonth ? "true" : "false",
        "data-today": c.isToday ? "true" : "false",
        "data-selected": isSelected && !c.isToday ? "true" : "false",
        "data-has-events": hasEvents ? "true" : "false",
        "data-event-color": dayColor || "",
        style: dayColor ? { "--event-color": dayColor } : {},
        title: hasEvents ? `${c.day} — Hay eventos` : `${c.day} — Sin eventos`,
      }, String(c.day));
      btn.addEventListener("click", () => {
        state.selectedDate = c.iso;
        render();
      });
      grid.appendChild(btn);
    });

    // F4-revert — Leyenda: título + círculos pequeños + texto (estilo imagen objetivo)
    // Click en un item → toggle on/off de la categoría
    const legend = el("div", { class: "kair-legend" });
    legend.innerHTML = `<div class="kair-legend__title">Tipos de evento</div>`;
    Object.values(D.EVENT_CATEGORIES).forEach((cat) => {
      const isActive = state.activeCategories.has(cat.id);
      const item = el("button", {
        class: "kair-legend__item",
        "data-active": isActive ? "true" : "false",
        title: isActive ? `Mostrando ${cat.label} — clic para ocultar` : `${cat.label} oculto — clic para mostrar`,
      });
      item.innerHTML = `<span class="kair-legend__dot" style="background:${cat.color};"></span><span>${cat.label}</span>`;
      item.addEventListener("click", () => toggleCategory(cat.id));
      legend.appendChild(item);
    });
    container.appendChild(legend);

    // Integración correo
    const integ = el("div", {
      class: "mt-auto p-3",
      style: { borderTop: "1px solid var(--kair-border-soft)", background: "#fafbfc", marginTop: "auto", padding: "12px" },
    });
    integ.innerHTML = `
      <div class="flex items-center gap-2 mb-2" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--kair-text-muted);">
        ${D.ICONS.mail.replace('width="13" height="13"', 'width="12" height="12"')}
        <span style="color:var(--kair-primary);">Integración correo</span>
      </div>
      <p style="font-size:0.75rem;line-height:1.5;color:var(--kair-text-light);margin:0;">
        Arrastra un correo desde la bandeja hacia cualquier día del calendario para crear un evento rápido.
      </p>
    `;
    container.appendChild(integ);
  }

  function toggleCategory(catId) {
    if (state.activeCategories.has(catId)) state.activeCategories.delete(catId);
    else state.activeCategories.add(catId);
    render();
  }

  // F4 — Lee el nombre de la empresa activa desde la app principal
  // (window.parent.currentCompany, que se setea en renderer.js cuando el user
  // selecciona una empresa). Si no hay empresa seleccionada, usa "Sin empresa".
  function getActiveCompanyName() {
    if (typeof window === "undefined") return null;
    var c = (window.parent && window.parent.currentCompany) || window.currentCompany || null;
    if (c && typeof c === "string" && c !== "default_company" && c.trim() !== "") return c.trim();
    return null;
  }

  // F4 — Actualiza el header (#company-name), el footer (#footer-company)
  // y el label del toggle según la empresa activa + el estado del toggle.
  function updateCompanyDisplay() {
    var company = getActiveCompanyName();
    var nameEl = $("#company-name");
    if (nameEl) {
      if (state.allCompanies) {
        nameEl.textContent = company || "Todas las empresas";
      } else {
        nameEl.textContent = company || "Selecciona una empresa";
      }
    }
    var footer = $("#footer-company");
    if (footer) {
      footer.textContent = "Empresa: " + (state.allCompanies ? "Todas" : (company || "—"));
    }
    var label = $("#toggle-companies .kair-toggle__label");
    if (label) {
      label.textContent = state.allCompanies ? "Todas las empresas" : (company ? "Solo " + company : "Una empresa");
    }
  }

  // F4 — Cambia el mes visible del mini-cal. delta = -1 (anterior) o +1 (siguiente).
  function changeMonth(delta) {
    var m = state.viewMonth + delta;
    var y = state.viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    state.viewMonth = m;
    state.viewYear = y;
    state.viewMonthLabel = D.buildMonthLabel(y, m);
    render();
  }

  // ====== Calendario grande ======
  function renderBigCalendar(container) {
    container.innerHTML = "";

    const wrapper = el("div", { class: "flex h-full overflow-hidden", style: { display: "flex", height: "100%", overflow: "hidden" } });
    container.appendChild(wrapper);

    const main = el("div", { class: "flex-1 flex flex-col min-w-0", style: { flex: "1", display: "flex", flexDirection: "column", minWidth: "0" } });
    wrapper.appendChild(main);

    // Toolbar
    const toolbar = el("div", { class: "kair-cal-toolbar" });
    toolbar.innerHTML = `
      <button class="kair-cal-toolbar__create" id="btn-create-event">${D.ICONS.plus} Crear</button>
      <div class="kair-cal-toolbar__nav">
        <button class="kair-icon-btn" title="Periodo anterior">${D.ICONS.chevronLeft}</button>
        <button class="kair-icon-btn" title="Periodo siguiente">${D.ICONS.chevronRight}</button>
      </div>
      <span class="kair-cal-toolbar__month-label">${state.viewMonthLabel || D.MONTH_VIEW.label}</span>
      <button class="kair-link-btn" id="btn-today" style="font-size:0.75rem;">Hoy</button>
      <div class="kair-cal-toolbar__views">
        ${["day", "week", "month", "schedule"].map((v) => `
          <button class="kair-cal-toolbar__view" data-view="${v}" data-active="${state.calView === v}">${v === "day" ? "Día" : v === "week" ? "Semana" : v === "month" ? "Mes" : "Programar"}</button>
        `).join("")}
      </div>
    `;
    main.appendChild(toolbar);

    // Bindings toolbar
    toolbar.querySelector("#btn-create-event").addEventListener("click", () => openCreateEventModal(state.selectedDate || D.MONTH_VIEW.todayIso, 9));
    toolbar.querySelector("#btn-today").addEventListener("click", () => { state.selectedDate = D.MONTH_VIEW.todayIso; render(); });
    toolbar.querySelectorAll(".kair-cal-toolbar__view").forEach((b) => {
      b.addEventListener("click", () => { state.calView = b.getAttribute("data-view"); render(); });
    });
    // F4-fix — Botones prev/next del calendario grande. Antes NO tenían
    // listeners → clicks no hacían nada. Ahora llaman a changeMonth() que
    // ya existía para el mini-cal (mismo patrón).
    var navBtns = toolbar.querySelectorAll(".kair-cal-toolbar__nav button");
    if (navBtns.length >= 2) {
      navBtns[0].addEventListener("click", () => { changeMonth(-1); render(); });
      navBtns[1].addEventListener("click", () => { changeMonth(1); render(); });
    }

    // Cabecera días de la semana
    const head = el("div", { class: "grid border-b", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "#fafbfc", borderBottom: "1px solid var(--kair-border-soft)" } });
    D.WEEKDAY_LABELS.forEach((w) => {
      head.appendChild(el("div", { class: "kair-month-weekday", style: { borderBottom: "none" } }, w));
    });
    main.appendChild(head);

    // Grilla mensual
    const gridWrapper = el("div", { class: "flex-1 overflow-auto kair-scroll min-h-0", style: { flex: "1", overflow: "auto", minHeight: "0" } });
    const grid = el("div", { class: "grid", style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--kair-border-soft)", gap: "1px", minHeight: "100%" } });

    const visibleEvents = state.events.filter((e) => state.activeCategories.has(e.category));
    // F4-fix — Generar grid dinámicamente según el mes visible (state.viewYear, state.viewMonth).
    // Antes usaba D.MONTH_GRID (fijo) → al cambiar de mes con prev/next, la grilla
    // no se actualizaba y se seguía mostrando el mes inicial.
    const bigMonthGrid = D.buildMonthGrid(state.viewYear, state.viewMonth);
    bigMonthGrid.flat().forEach((cell) => {
      const dayEvents = visibleEvents
        .filter((e) => e.date === cell.iso)
        .sort((a, b) => a.startHour - b.startHour);
      const maxVisible = 3;
      const visible = dayEvents.slice(0, maxVisible);
      const remaining = dayEvents.length - maxVisible;
      const isDropTarget = state.dropTarget && state.dropTarget.date === cell.iso && state.dropTarget.hour === 9;

      const cellEl = el("div", {
        class: "kair-month-cell",
        "data-out": !cell.inMonth,
        "data-today": cell.isToday,
        "data-droppable": cell.inMonth,
        "data-drop-active": isDropTarget,
      });
      cellEl.innerHTML = `<div class="kair-month-cell__day">${cell.day}</div>`;
      visible.forEach((ev) => {
        const cat = getCategoryStyle(ev.category);
        const eventBtn = el("div", {
          class: "kair-month-event",
          style: { background: cat.bg, borderLeftColor: cat.color, color: cat.color },
          title: `${ev.title} · ${fmtHour(ev.startHour)}`,
        });
        eventBtn.innerHTML = `
          <span class="truncate flex-1 text-left" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left;">${ev.title}</span>
          ${ev.linkedMailId ? D.ICONS.mail.replace('width="13" height="13"', 'width="9" height="9"') : ""}
        `;
        eventBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          selectEvent(ev);
        });
        cellEl.appendChild(eventBtn);
      });
      if (remaining > 0) {
        const more = el("div", { class: "kair-month-event__more" }, `+${remaining} más`);
        more.addEventListener("click", (e) => {
          e.stopPropagation();
          state.selectedDate = cell.iso;
          state.calView = "day";
          render();
        });
        cellEl.appendChild(more);
      }

      cellEl.addEventListener("click", () => openCreateEventModal(cell.iso, 9));
      cellEl.addEventListener("dragover", (e) => {
        if (!cell.inMonth) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!isDropTarget) {
          state.dropTarget = { date: cell.iso, hour: 9 };
          render();
        }
      });
      cellEl.addEventListener("dragleave", () => {
        if (isDropTarget) { state.dropTarget = null; render(); }
      });
      cellEl.addEventListener("drop", (e) => {
        e.preventDefault();
        const mailId = e.dataTransfer.getData("text/kair-mail");
        if (mailId) dropMailToCalendar(mailId, cell.iso, 9);
        state.dropTarget = null;
        render();
      });

      grid.appendChild(cellEl);
    });
    gridWrapper.appendChild(grid);
    main.appendChild(gridWrapper);

    // Footer
    const footer = el("div", { class: "kair-cal-footer" });
    footer.innerHTML = `
      <span class="kair-cal-footer__hint">${D.ICONS.mouseClick} Click en día/hora para crear evento...</span>
      <span class="kair-cal-footer__counter">${visibleEvents.length} evento(s) en el rango visible</span>
    `;
    main.appendChild(footer);
  }

  // ====== Lista de correos (Gmail style) ======
  function renderMailList(container) {
    container.innerHTML = "";

    const filtered = state.mails.filter((m) => {
      if (state.mailFilter === "unread") return m.unread;
      if (state.mailFilter === "flagged") return m.flagged;
      if (state.mailFilter === "meeting") return m.category === "meeting";
      if (state.mailFilter === "sent") return true;  // Enviados: ya viene filtrado de Gmail (folder=SENT)
      return true;
    }).filter((m) => {
      if (!state.searchQuery) return true;
      const q = state.searchQuery.toLowerCase();
      return m.sender.toLowerCase().includes(q) ||
             m.subject.toLowerCase().includes(q) ||
             m.preview.toLowerCase().includes(q);
    });

    // AUDITORIA 2026-07-18 — Sort por fecha según preferencia del user
    var sortBy = state.mailSortBy || "recent";
    filtered.sort(function (a, b) {
      var dateA = a.date || 0;
      var dateB = b.date || 0;
      if (sortBy === "oldest") {
        return dateA - dateB;  // Más antiguos primero
      } else if (sortBy === "unread") {
        // No leídos primero, luego por fecha
        if (a.unread && !b.unread) return -1;
        if (!a.unread && b.unread) return 1;
        return dateB - dateA;
      } else if (sortBy === "recent") {
        return dateB - dateA;  // Más recientes primero (default)
      } else {
        return dateB - dateA;  // Fallback
      }
    });

    const counts = {
      all: state.mails.length,
      unread: state.mails.filter((m) => m.unread).length,
      flagged: state.mails.filter((m) => m.flagged).length,
      meeting: state.mails.filter((m) => m.category === "meeting").length,
    };

    // Header
    const header = el("div", { class: "kair-mail-list-header" });
    // Orden actual (default: más recientes primero)
    var sortBy = state.mailSortBy || "recent";
    var sortLabel = sortBy === "oldest" ? "Más antiguos" : sortBy === "unread" ? "No leídos" : "Reciente";
    header.innerHTML = `
      <button class="kair-icon-btn" title="Refrescar" id="mail-refresh">${D.ICONS.refresh}</button>
      <div class="kair-mail-list-header__title">
        Bandeja de Entrada
        <span class="kair-mail-list-header__count">${filtered.length}</span>
      </div>
      <div class="kair-mail-list-header__actions">
        <button class="kair-mail-list-header__sort" id="mail-sort-toggle" title="Cambiar orden">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="9" y2="18"></line></svg>
          ${sortLabel}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
        ${state.checkedIds.size > 0 ? `
          <span style="font-size:0.7rem;color:var(--kair-text-muted);margin-right:8px;">${state.checkedIds.size} seleccionado(s)</span>
          <button class="kair-icon-btn" title="Archivar">${D.ICONS.archive}</button>
          <button class="kair-icon-btn" title="Eliminar">${D.ICONS.trash}</button>
          <button class="kair-icon-btn" title="Marcar no leído">${D.ICONS.mailOpen}</button>
        ` : ""}
      </div>
    `;
    container.appendChild(header);

    // Wire up sort toggle
    setTimeout(function () {
      var sortBtn = $("#mail-sort-toggle", container);
      if (sortBtn) {
        sortBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // Ciclar entre recent / oldest / unread
          if (state.mailSortBy === "recent" || !state.mailSortBy) {
            state.mailSortBy = "oldest";
          } else if (state.mailSortBy === "oldest") {
            state.mailSortBy = "unread";
            // Cuando el user selecciona "No leídos" en el sort, también activamos el filter
            state.mailFilter = "unread";
          } else {
            state.mailSortBy = "recent";
            // Volver al filter "Todos" cuando se sale del modo unread
            state.mailFilter = "all";
          }
          render();
        });
      }
    }, 0);
    header.querySelector("#mail-refresh").addEventListener("click", refresh);

    // F1.D — Input de búsqueda en tiempo real arriba de los filtros
    const searchContainer = el("div", { class: "kair-mail-search", style: { padding: "8px 12px", borderBottom: "1px solid var(--kair-border-soft, #e9ecef)" } });

    // F1-Feature2 — Chips de operadores. Se renderizan en vivo (al inicio y al tipear).
    // La función updateOperatorChips se define más abajo (necesita applySearchFilter).

    const searchInput = el("input", {
      type: "text",
      class: "kair-mail-search__input",
      id: "mail-search-input",
      placeholder: "Buscar en remitente, asunto o contenido...",
      value: state.searchQuery || "",
      style: {
        width: "100%",
        padding: "7px 10px 7px 30px",
        border: "1px solid var(--kair-border, #dee2e6)",
        borderRadius: "6px",
        fontSize: "0.8125rem",
        outline: "none",
        background: "var(--kair-bg-card, #fff)",
        color: "var(--kair-text-body, #333)"
      }
    });
    // Icono de búsqueda (SVG) a la izquierda
    const searchIcon = el("span", {
      style: {
        position: "absolute",
        left: "22px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--kair-text-light, #5f6368)",
        pointerEvents: "none"
      }
    });
    searchIcon.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    // Wrapper para posicionar el icono relativo al input
    const searchWrapper = el("div", { style: { position: "relative" } });
    searchWrapper.appendChild(searchIcon);
    searchWrapper.appendChild(searchInput);
    // Botón X para limpiar búsqueda (aparece solo si hay query)
    if (state.searchQuery) {
      const clearBtn = el("button", {
        class: "kair-mail-search__clear",
        title: "Limpiar búsqueda",
        style: {
          position: "absolute",
          right: "18px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--kair-text-light, #5f6368)",
          padding: "2px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center"
        }
      });
      clearBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      clearBtn.addEventListener("click", function () {
        state.searchQuery = "";
        searchInput.value = "";
        // F1-Feature2 — Limpiar los chips
        var existingChips = searchContainer.querySelector(".kair-mail-search__chips");
        if (existingChips && existingChips.parentNode) {
          existingChips.parentNode.removeChild(existingChips);
        }
        applySearchFilter();
      });
      searchWrapper.appendChild(clearBtn);
    }
    // Filtro en tiempo real: cada vez que el user tipea, filtra las rows por CSS
    // F1.D-fix3 — En vez de re-renderizar la lista (que destruye el input y pierde el foco),
    // uso data-attributes en cada row + display:none para ocultar/mostrar.
    // El input nunca se destruye, así que el foco se mantiene.
    searchInput.addEventListener("input", function (e) {
      state.searchQuery = e.target.value || "";
      applySearchFilter();
      // F1-Feature2 — Actualizar los chips de operadores en vivo
      updateOperatorChips(searchContainer, searchInput, applySearchFilter);
    });

    // F1-Feature2 — Actualiza SOLO el bloque de chips sin tocar el input ni la lista.
    // Esto preserva el foco del input y evita re-renderizar todo.
    function updateOperatorChips(container, inputEl, onChange) {
      var existingChipsContainer = container.querySelector(".kair-mail-search__chips");
      var activeChips = getActiveOperators(state.searchQuery || "");
      // Si no hay chips activos, eliminar el contenedor
      if (activeChips.length === 0) {
        if (existingChipsContainer && existingChipsContainer.parentNode) {
          existingChipsContainer.parentNode.removeChild(existingChipsContainer);
        }
        return;
      }
      // Si hay chips pero no existe el contenedor, crearlo (insertar antes del wrapper del input)
      if (!existingChipsContainer) {
        existingChipsContainer = el("div", { class: "kair-mail-search__chips" });
        // Insertar como primer hijo del searchContainer (antes del wrapper con el icono)
        var wrapper = container.querySelector("div[style*='position: relative']");
        if (wrapper) {
          container.insertBefore(existingChipsContainer, wrapper);
        } else {
          container.appendChild(existingChipsContainer);
        }
      }
      // Limpiar y re-renderizar los chips
      existingChipsContainer.innerHTML = "";
      activeChips.forEach(function (chip) {
        var chipEl = el("span", {
          class: "kair-mail-search__chip",
          "data-operator-text": chip.originalText,
          title: "Click en la X para quitar este filtro"
        });
        chipEl.innerHTML = '<span class="kair-mail-search__chip-label">' + chip.label + '</span>' +
          '<button class="kair-mail-search__chip-remove" type="button" aria-label="Quitar filtro">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          '</button>';
        chipEl.querySelector(".kair-mail-search__chip-remove").addEventListener("click", function (e) {
          e.stopPropagation();
          state.searchQuery = removeOperatorFromQuery(state.searchQuery, chip.originalText);
          if (inputEl) inputEl.value = state.searchQuery;
          if (onChange) onChange();
          updateOperatorChips(container, inputEl, onChange);
        });
        existingChipsContainer.appendChild(chipEl);
      });
    }

    // Renderizar los chips iniciales (si hay query al cargar)
    updateOperatorChips(searchContainer, searchInput, applySearchFilter);
    searchInput.addEventListener("keydown", function (e) {
      // ESC para limpiar la búsqueda
      if (e.key === "Escape" && state.searchQuery) {
        state.searchQuery = "";
        searchInput.value = "";
        // F1-Feature2 — Limpiar los chips
        var existingChips = searchContainer.querySelector(".kair-mail-search__chips");
        if (existingChips && existingChips.parentNode) {
          existingChips.parentNode.removeChild(existingChips);
        }
        applySearchFilter();
      }
    });
    // Función que aplica el filtro visual sin re-renderizar
    function applySearchFilter() {
      var rawQuery = state.searchQuery || "";
      var tokens = parseSearchOperators(rawQuery);
      var rows = container.querySelectorAll(".kair-mail-row");
      var visibleCount = 0;
      rows.forEach(function (row) {
        var subject = (row.getAttribute("data-subject") || "").toLowerCase();
        var sender = (row.getAttribute("data-sender") || "").toLowerCase();
        var preview = (row.getAttribute("data-preview") || "").toLowerCase();
        var hasAttach = row.getAttribute("data-has-attachment") === "true";
        var mailDate = parseInt(row.getAttribute("data-date") || "0", 10);
        var matches = matchesAllOperators(tokens, {
          subject: subject,
          sender: sender,
          preview: preview,
          hasAttachment: hasAttach,
          date: mailDate
        });
        row.style.display = matches ? "" : "none";
        if (matches) visibleCount++;
      });
      // Mostrar "No hay resultados" si no hay matches
      var existingEmpty = container.querySelector(".kair-mail-empty");
      if (q && visibleCount === 0) {
        if (!existingEmpty) {
          var empty = el("div", { class: "kair-mail-empty" });
          empty.innerHTML = '<div class="kair-mail-empty__icon">' + D.ICONS.inbox.replace(/width="\d+" height="\d+"/, 'width="26" height="26"') + '</div><p style="font-size:0.875rem;font-weight:600;color:var(--kair-text-muted);margin:0 0 4px;">No hay resultados para "' + state.searchQuery + '"</p><p style="font-size:0.75rem;color:var(--kair-text-light);margin:0;">Probá con otro texto o limpia la búsqueda</p>';
          var listContainer = container.querySelector(".kair-mail-list-wrap") || container;
          listContainer.appendChild(empty);
        }
      } else if (existingEmpty && existingEmpty.classList.contains("kair-mail-empty--search")) {
        existingEmpty.remove();
      }
    }
    searchContainer.appendChild(searchWrapper);
    container.appendChild(searchContainer);

    // Filtros
    const filters = el("div", { class: "kair-mail-list-filters" });
    const filterDefs = [
      { id: "all", label: "Bandeja de entrada", icon: D.ICONS.inbox, isFolder: true, folder: "INBOX" },
      { id: "unread", label: "No leídos", icon: D.ICONS.mailOpen },
      { id: "flagged", label: "Marcados", icon: D.ICONS.star },
      { id: "meeting", label: "Reuniones", icon: D.ICONS.calendarPlus },
      // F1.B-fix — Filtro "Enviados" — cambia el folder Gmail a SENT y re-sincroniza.
      { id: "sent", label: "Enviados", icon: D.ICONS.send, isFolder: true, folder: "SENT" },
    ];
    filterDefs.forEach((f) => {
      const isActive = state.mailFilter === f.id;
      const count = counts[f.id];
      const btn = el("button", {
        class: "kair-mail-list-filter",
        "data-active": isActive,
      });
      btn.innerHTML = `${f.icon.replace(/width="\d+" height="\d+"/, 'width="11" height="11"')} ${f.label} ${count > 0 ? `<span class="kair-mail-list-filter__badge">${count}</span>` : ""}`;
      btn.addEventListener("click", () => {
        state.mailFilter = f.id;
        // F1.B-fix — Si el filtro cambia de folder (Enviados), re-cargar mails desde SENT
        if (f.isFolder) {
          state.mailFolder = f.folder;
          loadMailsFromCache({ folder: f.folder, forceSync: true });
        } else {
          // Volver a INBOX si no es folder
          if (state.mailFolder !== "INBOX") {
            state.mailFolder = "INBOX";
            loadMailsFromCache({ folder: "INBOX", forceSync: true });
          } else {
            render();
          }
        }
      });
      filters.appendChild(btn);
    });
    container.appendChild(filters);

    // Lista
    const list = el("div", { class: "kair-scroll overflow-y-auto overflow-x-hidden flex-1 min-h-0", style: { flex: "1", overflowY: "auto", overflowX: "hidden", minHeight: "0" } });

    if (state.mailLoading) {
      for (let i = 0; i < 6; i++) {
        list.appendChild(el("div", { class: "h-12 rounded-md kair-pulse", style: { height: "48px", borderRadius: "6px", background: "var(--kair-bg-hover)", margin: "8px 12px" } }));
      }
    } else if (filtered.length === 0) {
      const empty = el("div", { class: "kair-mail-empty" });
      empty.innerHTML = `
        <div class="kair-mail-empty__icon">${D.ICONS.inbox.replace(/width="\d+" height="\d+"/, 'width="26" height="26"')}</div>
        <p style="font-size:0.875rem;font-weight:600;color:var(--kair-text-muted);margin:0 0 4px;">No hay mensajes</p>
        <p style="font-size:0.75rem;color:var(--kair-text-light);margin:0;">No se encontraron mensajes con este filtro.</p>
      `;
      list.appendChild(empty);
    } else {
      filtered.forEach((m) => {
        const isSelected = state.selectedMailId === m.id;
        const isChecked = state.checkedIds.has(m.id);
        // F1.A-refactor — Usar .email-row (BEM Gmail-style) con grid de 5 columnas.
        // Mantener kair-mail-row como legacy para compatibilidad.
        const row = el("div", {
          class: "email-row kair-mail-row",
          "data-selected": isSelected,
          "data-unread": m.unread ? "true" : "false",
          // F1.D-fix3 — Data attributes para que el filtro de búsqueda pueda leer
          // los datos de cada row sin re-renderizar la lista (mantiene el foco del input)
          "data-subject": m.subject || "",
          "data-sender": (m.sender || "") + " " + (m.senderEmail || ""),
          "data-preview": m.preview || m.snippet || "",
          "data-has-attachment": m.hasAttachment ? "true" : "false",  // F1-Feature2
          "data-date": m.date || 0,  // F1-Feature2
          draggable: "true",
        });

        // Columna 1 — Contenedor único (24px) que aloja check + dot superpuestos.
        // El CSS intercambia dot <-> check según data-unread (Gmail-style).
        const selectWrap = el("div", { class: "email-row__select kair-mail-row__select" });

        const check = el("button", {
          class: "email-row__check kair-mail-row__check",
          "data-checked": isChecked,
          "aria-label": "Seleccionar mensaje",
        });
        check.addEventListener("click", (e) => {
          e.stopPropagation();
          if (state.checkedIds.has(m.id)) state.checkedIds.delete(m.id);
          else state.checkedIds.add(m.id);
          render();
        });
        selectWrap.appendChild(check);

        const unreadDot = el("span", {
          class: "email-row__unread-dot kair-mail-row__unread-dot",
          title: "No leído",
          "aria-label": "No leído",
        });
        selectWrap.appendChild(unreadDot);
        row.appendChild(selectWrap);

        // Columna 2 — Avatar (40x40, color de fondo derivado del email)
        const avatar = el("div", {
          class: "email-row__avatar kair-mail-row__avatar",
          style: { background: m.avatarColor || "#5f6368" },
          title: m.sender,
        }, initials(m.sender));
        row.appendChild(avatar);

        // Columna 3 — Content: sender + subject/preview en una línea (estilo Gmail).
        const content = el("div", { class: "email-row__content kair-mail-row__content" });

        const sender = el("div", {
          class: "email-row__sender kair-mail-row__sender",
        }, m.sender);
        content.appendChild(sender);

        const tag = m.category === "meeting" ? '<span class="kair-mail-tag kair-mail-tag--meeting">Reunión</span>'
                  : m.category === "urgent" ? '<span class="kair-mail-tag kair-mail-tag--urgent">Urgente</span>'
                  : "";
        // F1-Feature6 — Badge "N mensajes" cuando el thread tiene varios mensajes
        var messageCountBadge = (m.messageCount && m.messageCount > 1)
          ? '<span class="kair-mail-row__count" title="' + m.messageCount + ' mensajes en el hilo">' + m.messageCount + '</span>'
          : "";
        const subjectPreview = el("div", {
          class: "email-row__subject-preview kair-mail-row__subject",
        });
        subjectPreview.innerHTML = `${tag}${messageCountBadge}<span class="email-row__subject-text kair-mail-row__subject-text">${m.subject}</span><span class="kair-hide-lg email-row__preview kair-mail-row__preview"> — ${m.preview}</span>`;
        content.appendChild(subjectPreview);

        // Indicador de adjunto dentro del content (no rompe el grid)
        if (m.hasAttachment) {
          const att = el("span", {
            class: "email-row__attachment kair-mail-row__attachment",
            title: "Tiene adjuntos",
            "aria-label": "Tiene adjuntos",
          });
          att.innerHTML = D.ICONS.paperclip.replace(/width="\d+" height="\d+"/, 'width="12" height="12"');
          att.style.color = "var(--kair-text-light)";
          content.appendChild(att);
        }
        if (m.meetingSuggestion) {
          const cal = el("span", {
            class: "email-row__meeting kair-mail-row__meeting",
            title: "Sugerencia de reunión",
          });
          cal.innerHTML = D.ICONS.calendarPlus.replace(/width="\d+" height="\d+"/, 'width="12" height="12"');
          cal.style.color = "var(--kair-primary)";
          content.appendChild(cal);
        }
        row.appendChild(content);

        // Columna 4 — Meta: fecha (derecha) + acciones inline de adjunto/sugerencia.
        const meta = el("div", { class: "email-row__meta kair-mail-row__meta" });
        meta.appendChild(el("div", {
          class: "email-row__date kair-mail-row__time",
        }, m.time || "—"));
        row.appendChild(meta);

        // Columna 5 — Star (visible al hover o si está marcado).
        const star = el("button", {
          class: "email-row__star kair-mail-row__star",
          "data-active": m.flagged,
          "aria-label": m.flagged ? "Quitar marca" : "Marcar",
          title: m.flagged ? "Quitar marca" : "Marcar",
          style: { background: "transparent", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" },
        });
        star.innerHTML = D.ICONS.star.replace(/width="\d+" height="\d+"/, 'width="15" height="15"').replace("fill=\"none\"", `fill="${m.flagged ? "currentColor" : "none"}"`);
        star.addEventListener("click", (e) => {
          e.stopPropagation();
          m.flagged = !m.flagged;
          render();
        });
        row.appendChild(star);

        // F1.A — Hover actions (estilo Gmail: aparecen al pasar el mouse por encima).
        // Por ahora son UI solamente — la lógica real se hace en backend cuando
        // implementemos Reply/Forward/Delete reales (Fase 1.B y Fase 5).
        const hoverActions = el("div", { class: "kair-mail-row__hover-actions" });

        const hoverArchive = el("button", {
          class: "kair-mail-row__hover-btn",
          title: "Archivar",
          "aria-label": "Archivar",
        });
        hoverArchive.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>';
        hoverArchive.addEventListener("click", (e) => {
          e.stopPropagation();
          console.log("[BandejaIntegrada] Archivar (UI only): " + m.subject);
        });
        hoverActions.appendChild(hoverArchive);

        const hoverUnread = el("button", {
          class: "kair-mail-row__hover-btn",
          title: m.unread ? "Marcar como leído" : "Marcar como no leído",
          "aria-label": m.unread ? "Marcar como leído" : "Marcar como no leído",
        });
        hoverUnread.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>';
        hoverUnread.addEventListener("click", (e) => {
          e.stopPropagation();
          m.unread = !m.unread;
          render();
        });
        hoverActions.appendChild(hoverUnread);

        const hoverDelete = el("button", {
          class: "kair-mail-row__hover-btn",
          title: "Eliminar",
          "aria-label": "Eliminar",
        });
        hoverDelete.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
        hoverDelete.addEventListener("click", (e) => {
          e.stopPropagation();
          console.log("[BandejaIntegrada] Eliminar (UI only): " + m.subject);
        });
        hoverActions.appendChild(hoverDelete);

        row.appendChild(hoverActions);

        row.addEventListener("click", () => selectMail(m.id));
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/kair-mail", m.id);
          e.dataTransfer.effectAllowed = "copy";
        });

        list.appendChild(row);
      });
    }
    container.appendChild(list);
  }

  // ====== Detalle de correo (Gmail reading pane) ======
  function renderMailDetail(container) {
    container.innerHTML = "";
    const mail = state.mails.find((m) => m.id === state.selectedMailId);

    if (!mail) {
      const empty = el("div", { class: "kair-mail-empty", style: { height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" } });
      empty.innerHTML = `
        <div class="kair-mail-empty__icon">${D.ICONS.mailOpen.replace(/width="\d+" height="\d+"/, 'width="28" height="28"')}</div>
        <p style="font-size:0.875rem;font-weight:600;color:var(--kair-text-muted);margin:0 0 4px;">Seleccione un mensaje para leerlo</p>
        <p style="font-size:0.75rem;color:var(--kair-text-light);margin:0;">La conversación aparecerá aquí</p>
      `;
      container.appendChild(empty);
      return;
    }

    const detail = el("div", { class: "kair-mail-detail" });

    // Toolbar
    const toolbar = el("div", { class: "kair-mail-detail__toolbar" });
    const iconBtn = (icon, title, handler) => {
      const b = el("button", { class: "kair-icon-btn", title, "aria-label": title });
      b.innerHTML = icon;
      if (handler) b.addEventListener("click", handler);
      return b;
    };
    // F1-Feature3 — Archivar: removeLabel INBOX en Gmail + remove thread de la lista INBOX local
    toolbar.appendChild(iconBtn(D.ICONS.archive, "Archivar", () => {
      var api = getElectronAPI();
      if (api && api.googleGmail && api.googleGmail.archiveThread) {
        api.googleGmail.archiveThread({ threadId: mail.id }).then(function (r) {
          if (r && r.success) {
            // Quitar el thread de la lista INBOX local
            state.mails = state.mails.filter(function (m) { return m.id !== mail.id; });
            state.selectedMailId = null;
            render();
            toast("Archivado", "El correo fue movido a Archivados en Gmail", "success");
          } else {
            toast("Error al archivar", (r && r.error) || "Error desconocido", "error");
          }
        }).catch(function (e) {
          toast("Error al archivar", e.message, "error");
        });
      }
    }));
    toolbar.appendChild(iconBtn(D.ICONS.mailOpen, "Marcar como no leído", () => { mail.unread = !mail.unread; render(); }));
    toolbar.appendChild(iconBtn(D.ICONS.folder, "Mover a carpeta"));
    toolbar.appendChild(iconBtn(D.ICONS.trash, "Eliminar"));
    toolbar.appendChild(el("span", { class: "kair-header__divider", style: { margin: "0 4px" } }));
    toolbar.appendChild(iconBtn(D.ICONS.star, mail.flagged ? "Quitar marca" : "Marcar", () => { mail.flagged = !mail.flagged; render(); }));
    toolbar.appendChild(iconBtn(D.ICONS.printer, "Imprimir"));
    toolbar.appendChild(iconBtn(D.ICONS.more, "Más opciones"));

    const nav = el("div", { class: "ml-auto", style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" } });
    // AUDITORIA 2026-07-19 — "1 de N" dinámico con navegación real
    var currentIndex = state.mails.findIndex(function (m) { return m.id === state.selectedMailId; });
    var totalMails = state.mails.length;
    var currentPos = currentIndex >= 0 ? (currentIndex + 1) : 1;
    nav.innerHTML = `<span style="font-size:0.7rem;color:var(--kair-text-light);" aria-label="Correo ${currentPos} de ${totalMails}">${currentPos} de ${totalMails}</span>`;
    nav.appendChild(iconBtn(D.ICONS.chevronUp, "Más reciente"));
    nav.appendChild(iconBtn(D.ICONS.chevronRight.replace(/polyline points="9 18 15 12 9 6"/, 'polyline points="6 9 12 15 18 9"'), "Más antiguo"));
    toolbar.appendChild(nav);
    detail.appendChild(toolbar);

    // Scroll area
    const scroll = el("div", { class: "flex-1 overflow-y-auto kair-scroll", style: { flex: "1", overflowY: "auto", minHeight: "0" } });

    // Header del correo
    const header = el("div", { class: "kair-mail-detail__header" });
    const tag = mail.category === "meeting" ? '<span class="kair-mail-tag kair-mail-tag--meeting">Reunión</span>'
              : mail.category === "urgent" ? '<span class="kair-mail-tag kair-mail-tag--urgent">Urgente</span>'
              : "";
    // F1-Feature1 — Labels de Gmail como chips de colores
    // Solo mostramos los labels USER (no del sistema como INBOX/SENT) en el header,
    // y los SÍ del sistema (STARRED, IMPORTANT) con color.
    var labelsHtml = "";
    if (mail.label_ids && Array.isArray(mail.label_ids) && mail.label_ids.length > 0) {
      var userLabels = mail.label_ids.map(function (lid) {
        var lbl = state.labels.find(function (l) { return l.id === lid; });
        if (!lbl) return null;
        // Solo mostrar labels de usuario y los importantes del sistema
        if (lbl.type === 'user' || lbl.id === 'STARRED' || lbl.id === 'IMPORTANT') {
          return '<span class="kair-mail-label-chip" style="background:' + lbl.color_background + ';color:' + lbl.color_text + ';">' + lbl.name + '</span>';
        }
        return null;
      }).filter(function (x) { return x; }).join(' ');
      labelsHtml = userLabels ? '<div class="kair-mail-detail__labels" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">' + userLabels + '</div>' : '';
    }
    // FIX 2026-07-18 — Label del folder (Recibidos/Enviados) como chip al lado del subject (estilo Gmail)
    var folderLabel = (state.mailFolder === 'SENT') ? 'Enviados' : (state.mailFolder === 'DRAFT') ? 'Borradores' : 'Recibidos';
    var folderChipHtml = '<span class="kair-mail-detail__folder-label" title="Click para quitar el filtro de carpeta">' +
      folderLabel +
      '<button class="kair-mail-detail__folder-remove" type="button" aria-label="Quitar filtro" title="Quitar">' +
      '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
      '</button></span>';
    header.innerHTML = `
      <h2 class="kair-mail-detail__subject">
        <span style="flex:1;">${mail.subject}</span>
        ${folderChipHtml}
        <span class="kair-mail-detail__tags">${tag}</span>
      </h2>
      <div class="kair-mail-detail__sender-row">
        <div class="kair-mail-detail__avatar" style="background:${mail.avatarColor};">${initials(mail.sender)}</div>
        <div class="kair-mail-detail__sender-info">
          <p class="kair-mail-detail__sender-name">${mail.sender}</p>
          <p class="kair-mail-detail__sender-email">${mail.senderEmail || ''}</p>
        </div>
        <div class="kair-mail-detail__time">
          <div class="kair-mail-detail__time-main">${formatGmailLongDate(mail.date)}</div>
          <div class="kair-mail-detail__time-relative">${formatRelativeTime(mail.date)}</div>
        </div>
      </div>
      <div class="kair-mail-detail__actions">
        <button class="kair-mail-detail__action-btn" type="button" title="Archivar" aria-label="Archivar" data-action="archive">${D.ICONS.archive}</button>
        <button class="kair-mail-detail__action-btn" type="button" title="Marcar como no leído" aria-label="Marcar como no leído" data-action="mark-unread">${D.ICONS.mailOpen}</button>
        <button class="kair-mail-detail__action-btn" type="button" title="Eliminar" aria-label="Eliminar" data-action="delete">${D.ICONS.trash}</button>
        <span class="kair-mail-detail__actions-spacer"></span>
        <button class="kair-mail-detail__action-btn" type="button" title="Marcar" aria-label="Marcar" data-action="star" data-active="${mail.flagged ? 'true' : 'false'}">${D.ICONS.star.replace(/fill=\"none\"/, mail.flagged ? 'fill="currentColor"' : 'fill="none"')}</button>
        <button class="kair-mail-detail__action-btn" type="button" title="Más opciones" aria-label="Más opciones" data-action="more">${D.ICONS.more}</button>
      </div>
      ${labelsHtml}
    `;

    // AUDITORÍA 2026-07-19 — Wire up action buttons del thread header
    // Code-reviewer issue: antes el setTimeout(0) creaba listeners que quedaban
    // huerfanos cuando render() sobrescribia el DOM. Fix: usar event delegation
    // directa (los botones se buscan una vez, listeners se agregan una vez).
    // El render() siguiente recrea el DOM pero los listeners siguen en el
    // header (que es un nuevo elemento, pero el addEventListener no se vuelve
    // a llamar — eso es lo que queremos).
    setTimeout(function () {
      var archiveBtn = header.querySelector('[data-action="archive"]');
      var markUnreadBtn = header.querySelector('[data-action="mark-unread"]');
      var deleteBtn = header.querySelector('[data-action="delete"]');
      var starBtn = header.querySelector('[data-action="star"]');
      if (archiveBtn) {
        archiveBtn.addEventListener("click", function () {
          // FIX: usar la misma logica que el toolbar (api.googleGmail.archiveThread)
          var api = getElectronAPI();
          if (api && api.googleGmail && api.googleGmail.archiveThread) {
            api.googleGmail.archiveThread({ threadId: mail.id }).then(function (r) {
              if (r && r.success) {
                state.mails = state.mails.filter(function (m) { return m.id !== mail.id; });
                state.selectedMailId = null;
                render();
                toast("Archivado", "El correo fue movido a Archivados en Gmail", "success");
              } else {
                toast("Error al archivar", (r && r.error) || "Error desconocido", "error");
              }
            }).catch(function (e) {
              toast("Error al archivar", e.message, "error");
            });
          } else {
            toast("Archivar", "Gmail no está conectado", "warning");
          }
        });
      }
      if (markUnreadBtn) {
        markUnreadBtn.addEventListener("click", function () {
          mail.unread = true;
          render();
        });
      }
      if (deleteBtn) {
        deleteBtn.addEventListener("click", function () {
          // FIX: implementar delete con confirm
          if (confirm("¿Eliminar este correo? (solo se quitará de la lista local)")) {
            state.mails = state.mails.filter(function (m) { return m.id !== mail.id; });
            state.selectedMailId = null;
            render();
            toast("Eliminado", "El correo fue removido de la lista local", "success");
          }
        });
      }
      if (starBtn) {
        starBtn.addEventListener("click", function () {
          mail.flagged = !mail.flagged;
          render();
        });
      }
    }, 0);
    scroll.appendChild(header);

    if (mail.category === "urgent") {
      const banner = el("div", { class: "kair-mail-detail__urgent-banner" });
      banner.innerHTML = `${D.ICONS.alertTriangle} Requiere acción inmediata · Vence en 24 horas`;
      scroll.appendChild(banner);
    }

    if (mail.meetingSuggestion) {
      const s = mail.meetingSuggestion;
      const mb = el("div", { class: "kair-mail-detail__meeting-banner" });
      mb.innerHTML = `
        <div class="kair-mail-detail__meeting-icon">${D.ICONS.calendarPlus.replace(/width="\d+" height="\d+"/, 'width="18" height="18"')}</div>
        <div class="kair-mail-detail__meeting-info">
          <p class="kair-mail-detail__meeting-title">Invitación a calendario</p>
          <div class="kair-mail-detail__meeting-meta">
            <strong style="color:var(--kair-text-strong);">${s.title}</strong>
            <span style="display:inline-flex;align-items:center;gap:4px;">${D.ICONS.clock} ${formatDate(s.date)} · ${fmtHour(s.startHour)}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;">${D.ICONS.mapPin} ${s.location}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;">${D.ICONS.users} ${s.attendees.length} asistente(s)</span>
          </div>
          <div class="kair-mail-detail__meeting-actions">
            <button class="kair-header__action--primary" id="detail-add-cal" style="padding:5px 10px;font-size:0.75rem;">${D.ICONS.calendarPlus.replace(/width="\d+" height="\d+"/, 'width="12" height="12"')} Agregar al calendario</button>
            <button class="kair-header__action--ghost" style="padding:5px 10px;font-size:0.75rem;">Responder</button>
          </div>
        </div>
      `;
      scroll.appendChild(mb);
      setTimeout(() => {
        const btn = $("#detail-add-cal", scroll);
        if (btn) btn.addEventListener("click", () => addMailToCalendar(mail));
      }, 0);
    }

    // Cuerpo
    // AUDITORÍA 2026-07-18 — Thread grouping Gmail-style COMPACTO:
    //   - Cada mensaje colapsado a 1 LÍNEA: avatar 32x32 + sender + SUBJECT completo inline + fecha
    //   - Solo el último mensaje expandido por default
    //   - Click en el head → expand/collapse
    //   - Expanded: "para: jrf2011 ▼" colapsable + body completo + "···" si hay más
    //   - Action icons en hover (responder, más ⋮)
    if (mail.messages && mail.messages.length > 1) {
      // Thread con varios mensajes
      mail.messages.forEach(function (msg, idx) {
        // Solo el último mensaje viene expanded por default
        var isLastMessage = idx === mail.messages.length - 1;

        var msgContainer = el("div", {
          class: "kair-mail-message" + (isLastMessage ? " kair-mail-message--expanded" : " kair-mail-message--collapsed"),
          "data-message-id": msg.id
        });

        // Avatar del mensaje (32x32, más pequeño que el del thread header)
        var msgAvatarInitials = (msg.from_name || msg.from_email || "?").split(" ").map(function (p) { return p[0]; }).slice(0, 2).join("").toUpperCase() || "?";
        var msgAvatar = el("div", {
          class: "kair-mail-message__avatar",
          style: { background: "#" + stringHashColor(msg.from_email || msg.from_name || "") }
        }, msgAvatarInitials);
        msgContainer.appendChild(msgAvatar);

        // Head del mensaje: sender + subject + fecha en 1 línea horizontal
        var msgHeader = el("div", { class: "kair-mail-message__head" });

        // Línea 1: sender name (bold) + subject completo (gris) + fecha (derecha)
        var msgLine = el("div", { class: "kair-mail-message__line" });
        msgLine.appendChild(el("span", {
          class: "kair-mail-message__sender"
        }, msg.from_name || msg.from_email || "(remitente desconocido)"));
        // AUDITORÍA 2026-07-18 — Subject completo como snippet (Gmail: NO usa el body)
        // Si NO es el último mensaje, mostramos el subject del thread (que es la metadata del reply)
        var msgSubject = (msg.subject && msg.subject !== mail.subject) ? msg.subject : mail.subject;
        msgLine.appendChild(el("span", {
          class: "kair-mail-message__subject"
        }, msgSubject || ""));
        msgLine.appendChild(el("span", {
          class: "kair-mail-message__date"
        }, formatMsgDate(msg.date)));
        msgHeader.appendChild(msgLine);

        // Línea 2 (snippet): primera línea del body, visible aunque esté expandido
        var bodyText = (msg.body_plain || "").trim();
        var firstLine = bodyText.split("\n")[0] || "";
        if (firstLine.length > 200) firstLine = firstLine.substring(0, 200) + "...";
        if (firstLine && firstLine !== msgSubject) {
          msgHeader.appendChild(el("div", {
            class: "kair-mail-message__snippet"
          }, firstLine || "(sin contenido)"));
        }
        msgContainer.appendChild(msgHeader);

        // Detalles expandidos (oculto por default en mensajes colapsados)
        var msgDetails = el("div", {
          class: "kair-mail-message__details",
          style: { display: isLastMessage ? "block" : "none", marginTop: "8px", paddingLeft: "44px", width: "100%" }
        });

        // AUDITORÍA 2026-07-18 — "para: jrf2011 ▼" colapsable (estilo Gmail)
        // Solo si hay destinatarios. Si no hay, no mostrar la línea.
        var toListParsed = parseToListFromMsg(msg);
        if (toListParsed.length > 0) {
          var firstRecipient = toListParsed[0];
          var firstRecipientLabel = firstRecipient.name || firstRecipient.email || "(sin destinatario)";
          var moreCount = toListParsed.length - 1;

          var recipientsDetails = el("details", { class: "kair-mail-message__recipients" });
          var recipientsSummary = el("summary", {
            style: { cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--kair-text-muted, #5f6368)" }
          });
          // Ocultar marker nativo de <summary>
          recipientsSummary.innerHTML = '<span>para: ' + escapeHtml(firstRecipientLabel) + (moreCount > 0 ? ' <span style="color:var(--kair-text-light,#999);">+' + moreCount + '</span>' : '') + '</span><span class="kair-mail-message__recipients-arrow">▾</span>';
          recipientsDetails.appendChild(recipientsSummary);
          // Contenido expandido con todos los destinatarios
          var recipientsContent = el("div", { class: "kair-mail-message__recipients-details" });
          // Para
          var toRow = el("div", { class: "kair-mail-message__recipients-row" });
          toRow.appendChild(el("span", { class: "kair-mail-message__recipients-label" }, "Para:"));
          toRow.appendChild(el("span", {}, toListParsed.map(function (a) { return a.name || a.email; }).join(", ")));
          recipientsContent.appendChild(toRow);
          // CC si hay
          // (FUTURO: parsear cc_list)
          recipientsDetails.appendChild(recipientsContent);
          msgDetails.appendChild(recipientsDetails);
        }

        // Body del mensaje (cuando expandido)
        var msgBody = el("div", { class: "kair-mail-message__body" });
        msgBody.innerHTML = renderMailBodyHtml(msg.body_plain || "");
        msgDetails.appendChild(msgBody);

        // AUDITORÍA 2026-07-18 — "···" indicator si el body tiene más de 1 línea
        var bodyLines = bodyText.split("\n").filter(function (l) { return l.trim(); });
        if (bodyLines.length > 1 && isLastMessage) {
          var moreIndicator = el("div", {
            class: "kair-mail-message__more",
            title: "Mostrar todo el contenido"
          }, "···");
          msgDetails.appendChild(moreIndicator);
        }

        // AUDITORÍA 2026-07-18 — Action icons del mensaje (responder, más ⋮) en hover
        var msgActions = el("div", { class: "kair-mail-message__actions" });
        var msgReplyBtn = el("button", {
          class: "kair-mail-message__action-btn",
          title: "Responder",
          "aria-label": "Responder"
        });
        msgReplyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>';
        msgReplyBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          openComposeModal("reply", mail);
        });
        msgActions.appendChild(msgReplyBtn);
        var msgMoreBtn = el("button", {
          class: "kair-mail-message__action-btn",
          title: "Más opciones",
          "aria-label": "Más opciones"
        });
        msgMoreBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>';
        msgActions.appendChild(msgMoreBtn);
        msgDetails.appendChild(msgActions);

        msgContainer.appendChild(msgDetails);

        // Toggle expand/collapse al click en el header (no en el body)
        msgHeader.addEventListener("click", function (e) {
          e.stopPropagation();
          var isExpanded = msgDetails.style.display !== "none";
          msgDetails.style.display = isExpanded ? "none" : "block";
          msgContainer.classList.toggle("kair-mail-message--expanded");
          msgContainer.classList.toggle("kair-mail-message--collapsed");
        });

        scroll.appendChild(msgContainer);
      });
    } else {
      // Mensaje único (sin thread grouping) — F1.A render original
      const body = el("div", { class: "kair-mail-detail__body" });
      body.innerHTML = renderMailBodyHtml(mail.body || "");
      scroll.appendChild(body);
    }

    // F1-Feature5 — Adjuntos REALES del último mensaje del thread.
    // Recolecta todos los adjuntos de todos los mensajes del hilo y los muestra
    // al final del detail. Si no hay hilo (mensaje único), usa el último mensaje.
    var allAttachments = [];
    if (mail.messages && mail.messages.length > 0) {
      mail.messages.forEach(function (msg) {
        if (msg.attachments && msg.attachments.length > 0) {
          msg.attachments.forEach(function (a) {
            // Evitar duplicados (mismo attachment_id en el mismo thread)
            if (allAttachments.findIndex(function (x) { return x.attachment_id === a.attachment_id; }) === -1) {
              allAttachments.push(Object.assign({}, a, { _messageId: msg.id }));
            }
          });
        }
      });
    } else if (mail.attachments && mail.attachments.length > 0) {
      allAttachments = mail.attachments.map(function (a) {
        return Object.assign({}, a, { _messageId: mail.id || mail.threadId });
      });
    }

    if (allAttachments.length > 0) {
      const att = el("div", { class: "kair-mail-detail__attachments" });
      const header = el("div", { class: "kair-mail-detail__attachments-header" });
      header.innerHTML = `${D.ICONS.paperclip.replace(/width="\d+" height="\d+"/, 'width="14" height="14"')} <span>${allAttachments.length} adjunto${allAttachments.length > 1 ? 's' : ''}</span>`;
      att.appendChild(header);

      allAttachments.forEach(function (a) {
        var attChip = el("a", {
          href: "#",
          class: "kair-attachment-chip",
          title: a.filename,
          "data-message-id": a._messageId,
          "data-attachment-id": a.attachment_id
        });
        var icon = el("span", { class: "kair-attachment-chip__icon" }, attachmentIcon(a.filename));
        var info = el("span", { class: "kair-attachment-chip__info" });
        info.innerHTML = '<div class="kair-attachment-chip__name">' + (a.filename || '(sin nombre)') + '</div>' +
          '<div class="kair-attachment-chip__size">' + formatAttachmentSize(a.size) + '</div>';
        attChip.appendChild(icon);
        attChip.appendChild(info);
        attChip.addEventListener("click", function (e) {
          e.preventDefault();
          downloadMailAttachment(a._messageId, a.attachment_id, a.filename);
        });
        att.appendChild(attChip);
      });
      scroll.appendChild(att);
    }

    detail.appendChild(scroll);

    // Reply bar
    const reply = el("div", { class: "kair-mail-detail__reply" });
    const replyBtn = (icon, label, handler) => {
      const b = el("button", { class: "kair-header__action--ghost", style: { padding: "6px 10px", fontSize: "0.75rem" } });
      b.innerHTML = `${icon} ${label}`;
      if (handler) b.addEventListener("click", handler);
      return b;
    };
    reply.appendChild(replyBtn(D.ICONS.reply, "Responder", () => openComposeModal("reply", mail)));
    reply.appendChild(replyBtn(D.ICONS.replyAll, "A todos", () => openComposeModal("replyAll", mail)));
    reply.appendChild(replyBtn(D.ICONS.forward, "Reenviar", () => openComposeModal("forward", mail)));

    const input = el("input", { type: "text", class: "kair-mail-detail__reply-input", placeholder: "Escribe una respuesta rápida..." });
    reply.appendChild(input);

    const sendBtn = el("button", { class: "kair-header__action--primary", style: { padding: "6px 12px", fontSize: "0.75rem" } });
    sendBtn.innerHTML = `${D.ICONS.send} Enviar`;
    sendBtn.addEventListener("click", () => {
      // F1.B — "Enviar" del input rápido = Reply simple
      if (!input.value || !input.value.trim()) {
        toast("Error", "Escribí una respuesta primero", "warning");
        return;
      }
      // Abrir el modal de compose con el texto prellenado
      openComposeModal("reply", mail);
      // Esperar a que el modal esté en el DOM y prellenar el body
      setTimeout(function () {
        var bodyEl = document.querySelector("#compose-body");
        if (bodyEl) {
          bodyEl.value = input.value + "\n\n" + bodyEl.value;
        }
        input.value = "";
      }, 50);
    });
    reply.appendChild(sendBtn);

    detail.appendChild(reply);
    container.appendChild(detail);
  }

  // ====== Acciones de correo ======
  function selectMail(id) {
    state.selectedMailId = id;
    const mail = state.mails.find((m) => m.id === id);
    if (mail) mail.unread = false;
    // El correo siempre está visible: no tocamos el overlay del calendario.
    render();
    // F4-fix — Lazy load del body desde email_messages (cache SQLite).
    // Antes el body estaba vacío porque threadToMail no lo cargaba.
    // Ahora: al hacer click, busca el thread en cache y trae el body del último mensaje.
    if (mail && !mail.body) {
      loadMailBodyFromCache(mail);
    }
    // F1-Feature3 — Marcar como leído en Gmail (sync bidireccional)
    // Si el correo está marcado como no leído, marcarlo en Gmail + actualizar cache local
    if (mail && mail.unread) {
      var api = getElectronAPI();
      if (api && api.googleGmail && api.googleGmail.markMessageRead) {
        // Necesitamos el messageId (no threadId). Lo sacamos del thread.
        // Por ahora usamos el threadId como messageId (Gmail trata los threads como un solo mensaje
        // cuando el thread tiene 1 mensaje, que es nuestro caso común)
        api.googleGmail.markMessageRead({ messageId: mail.id, read: true }).then(function (r) {
          if (r && r.success) {
            console.log("[BandejaIntegrada] Marcado como leído en Gmail: " + mail.subject);
          }
        }).catch(function (e) {
          console.warn("[BandejaIntegrada] Error marcando como leído:", e.message);
        });
      }
    }
  }

  // F1-Feature4 — Abre un mini modal para editar la firma de correo.
  // La firma se guarda en localStorage["kair.emailSignature"] y se agrega
  // automáticamente al final de cada correo (excepto forwards).
  function openSignatureModal() {
    // Si ya hay un modal abierto, no abrir otro
    if (document.querySelector(".kair-signature-modal")) return;

    var currentSig = localStorage.getItem("kair.emailSignature") || "";
    var modal = el("div", { class: "kair-signature-modal-overlay" });
    modal.innerHTML = `
      <div class="kair-signature-modal" role="dialog" aria-modal="true" aria-labelledby="sig-modal-title">
        <div class="kair-signature-modal__header">
          <h3 id="sig-modal-title">Firma de correo</h3>
          <button class="kair-signature-modal__close" type="button" aria-label="Cerrar" title="Cerrar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="kair-signature-modal__body">
          <p class="kair-signature-modal__hint">Esta firma se agregará automáticamente al final de cada correo que envíes (no se incluye en los reenvíos).</p>
          <label for="sig-textarea" class="kair-signature-modal__label">Tu firma</label>
          <textarea
            id="sig-textarea"
            class="kair-signature-modal__textarea"
            placeholder="Ej:&#10;Javier Robles&#10;Consultor SG-SST&#10;Tel: +57 300 123 4567&#10;javier@ejemplo.com"
            rows="8"
          >${currentSig.replace(/</g, '&lt;')}</textarea>
          <p class="kair-signature-modal__preview-label">Vista previa:</p>
          <div class="kair-signature-modal__preview" id="sig-preview">${currentSig ? (currentSig.replace(/</g, '&lt;').replace(/\n/g, '<br>')) : '<em style="color:var(--email-text-secondary);">(sin firma)</em>'}</div>
        </div>
        <div class="kair-signature-modal__footer">
          <button class="kair-signature-modal__btn kair-signature-modal__btn--secondary" type="button" id="sig-clear">Borrar firma</button>
          <div style="flex:1;"></div>
          <button class="kair-signature-modal__btn kair-signature-modal__btn--secondary" type="button" id="sig-cancel">Cancelar</button>
          <button class="kair-signature-modal__btn kair-signature-modal__btn--primary" type="button" id="sig-save">Guardar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    var textarea = modal.querySelector("#sig-textarea");
    var preview = modal.querySelector("#sig-preview");
    var closeBtn = modal.querySelector(".kair-signature-modal__close");
    var cancelBtn = modal.querySelector("#sig-cancel");
    var saveBtn = modal.querySelector("#sig-save");
    var clearBtn = modal.querySelector("#sig-clear");

    // Live preview mientras se edita
    textarea.addEventListener("input", function () {
      var v = textarea.value;
      if (v.trim()) {
        preview.innerHTML = v.replace(/</g, '&lt;').replace(/\n/g, '<br>');
      } else {
        preview.innerHTML = '<em style="color:var(--email-text-secondary);">(sin firma)</em>';
      }
    });

    var closeModal = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };
    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
    clearBtn.addEventListener("click", function () {
      textarea.value = "";
      preview.innerHTML = '<em style="color:var(--email-text-secondary);">(sin firma)</em>';
      textarea.focus();
    });
    saveBtn.addEventListener("click", function () {
      var newSig = textarea.value.trim();
      if (newSig) {
        localStorage.setItem("kair.emailSignature", newSig);
        toast("Firma guardada", "Se agregará automáticamente al final de tus correos", "success");
      } else {
        localStorage.removeItem("kair.emailSignature");
        toast("Firma eliminada", "Ya no se agregará firma a tus correos", "info");
      }
      closeModal();
    });

    // ESC para cerrar, Ctrl+Enter para guardar
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveBtn.click();
      }
    });
    // Auto-focus en el textarea
    setTimeout(function () {
      textarea.focus();
      // Poner cursor al final
      var len = textarea.value.length;
      textarea.setSelectionRange(len, len);
    }, 50);
  }

  // F1.B — Abre el modal de compose para Reply / Reply all / Forward.
  // @param {string} mode - 'reply' | 'replyAll' | 'forward' | 'new'
  // @param {Object} [mail] - mail al que responde/reenvía. Si mode='new' puede ser null.
  function openComposeModal(mode, mail) {
    mail = mail || null;
    var isReply = mode === 'reply' || mode === 'replyAll';
    var isForward = mode === 'forward';

    // 1) Construir el HTML del quote (se renderiza ARRIBA del textarea, NO como texto plano).
    // El user escribe su respuesta en el textarea (vacío) y al enviar se concatena con el quote.
    var quoteHtml = '';
    if (mail && (isReply || isForward)) {
      var senderDisplay = (mail.sender || mail.senderEmail || '(remitente)');
      var senderEmail = mail.senderEmail || '';
      var quoteDate = mail.date ? formatGmailDate(mail.date) : '';
      var quoteBodyText = (mail.body || '').replace(/\n/g, '<br>');
      // Limpiar headers MIME duplicados si los hay
      quoteBodyText = quoteBodyText.replace(/^De:.*?<br>/i, '').replace(/^Para:.*?<br>/i, '');
      // Limitar preview a 8 líneas para no saturar el modal
      var quoteSnippet = (mail.body || '').split('\n').slice(0, 8).join('\n');
      if ((mail.body || '').split('\n').length > 8) quoteSnippet += '...';
      var quoteAvatarBg = mail.avatarColor || '#5f6368';
      var quoteInitials = initials(senderDisplay);
      quoteHtml = `
        <div class="compose-panel__quote">
          <div class="compose-panel__quote-header">
            <div class="compose-panel__quote-avatar" style="background:${quoteAvatarBg};">${quoteInitials}</div>
            <div class="compose-panel__quote-info">
              <div class="compose-panel__quote-sender">${senderDisplay}${senderEmail ? ' <span class="compose-panel__quote-email">&lt;' + senderEmail + '&gt;</span>' : ''}</div>
              ${quoteDate ? '<div class="compose-panel__quote-date">' + quoteDate + '</div>' : ''}
            </div>
          </div>
          <blockquote class="compose-panel__quote-body">${quoteSnippet.replace(/</g, '&lt;')}</blockquote>
        </div>
      `;
    }

    // 2) Construir los destinatarios
    var toValue = '';
    var ccValue = '';
    var bccValue = '';
    if (isReply && mail) {
      toValue = mail.senderEmail || mail.sender || '';
      // Reply all: agregar al resto de los destinatarios (los guardados en to_list)
      if (mode === 'replyAll') {
        var toList = (mail.thread && mail.thread.participants) || [];
        var otherRecipients = toList
          .map(function (p) { return p.email; })
          .filter(function (e) { return e && e !== toValue && e !== state.gmailEmail; });
        ccValue = otherRecipients.join(', ');
      }
    } else if (isForward) {
      toValue = '';
    }

    // 3) Construir el subject
    var subjectValue = '';
    if (isReply) {
      var originalSubject = (mail && mail.subject) || '';
      subjectValue = /^Re:/i.test(originalSubject) ? originalSubject : 'Re: ' + originalSubject;
    } else if (isForward) {
      var originalSubjectFwd = (mail && mail.subject) || '';
      subjectValue = /^Fwd:/i.test(originalSubjectFwd) ? originalSubjectFwd : 'Fwd: ' + originalSubjectFwd;
    }

    // 4) Crear el modal
    var modal = el("div", { class: "compose-panel-overlay" });
    modal.innerHTML = `
      <div class="compose-panel" role="dialog" aria-modal="true" aria-labelledby="compose-panel-title">
        <div class="compose-panel__titlebar">
          <h3 class="compose-panel__title" id="compose-panel-title">${isReply ? (mode === 'replyAll' ? 'Responder a todos' : 'Responder') : isForward ? 'Reenviar' : 'Nuevo correo'}</h3>
          <div class="compose-panel__actions">
            <button class="compose-panel__btn compose-panel__btn--minimize" type="button" aria-label="Minimizar" title="Minimizar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="compose-panel__btn compose-panel__btn--maximize" type="button" aria-label="Maximizar" title="Restaurar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1"></rect></svg>
            </button>
            <button class="compose-panel__btn compose-panel__btn--close" aria-label="Cerrar" title="Cerrar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div class="compose-panel__body">
          <div class="compose-panel__field">
            <label>Para</label>
            <input type="email" multiple class="compose-panel__input" id="compose-to" value="${toValue.replace(/"/g, '&quot;')}" placeholder="destinatario@email.com" />
          </div>
          ${mode === 'replyAll' ? `
          <div class="compose-panel__field">
            <label>CC</label>
            <input type="text" class="compose-panel__input" id="compose-cc" value="${ccValue.replace(/"/g, '&quot;')}" placeholder="concopia@email.com" />
          </div>` : ''}
          <div class="compose-panel__field">
            <label>Asunto</label>
            <input type="text" class="compose-panel__input" id="compose-subject" value="${subjectValue.replace(/"/g, '&quot;')}" placeholder="Asunto del correo" />
          </div>
          <div class="compose-panel__field compose-panel__field--body">
            ${quoteHtml}
            <textarea class="compose-panel__textarea" id="compose-body" placeholder="${isReply ? 'Escribí tu respuesta...' : isForward ? 'Agregá un comentario (opcional)...' : 'Escribí tu mensaje...'}"></textarea>
          </div>
        </div>
        <div class="compose-panel__toolbar">
          <button class="compose-panel__toolbar__btn" type="button" title="Adjuntar archivo" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          <button class="compose-panel__toolbar__btn" type="button" title="Insertar link" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </button>
          <button class="compose-panel__toolbar__btn" type="button" title="Emoji" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
          </button>
          <span class="compose-panel__toolbar__sep"></span>
          <button class="compose-panel__toolbar__btn" type="button" title="Firma" disabled>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17c0-1.66 3.58-3 8-3s8 1.34 8 3v3H3v-3z"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </button>
        </div>
        <div class="compose-panel__footer">
          <button class="compose-panel__send" type="button" id="compose-send-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            Enviar
          </button>
          <span class="compose-panel__hint">Ctrl+Enter para enviar · ESC para cerrar</span>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 5) Wire up eventos
    var closeModal = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };
    var panel = modal.querySelector(".compose-panel");
    var minimizeBtn = modal.querySelector(".compose-panel__btn--minimize");
    var maximizeBtn = modal.querySelector(".compose-panel__btn--maximize");
    var closeBtn = modal.querySelector(".compose-panel__btn--close");
    var titlebar = modal.querySelector(".compose-panel__titlebar");

    // Toggle minimizado/maximizado
    var setMinimized = function (minimized) {
      if (minimized) {
        panel.classList.add("compose-panel--minimized");
        modal.classList.add("compose-panel-overlay--hidden");
        // Al minimizar, perder foco del body para que no quede en un campo invisible
        if (document.activeElement && panel.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      } else {
        panel.classList.remove("compose-panel--minimized");
        modal.classList.remove("compose-panel-overlay--hidden");
        // Restaurar foco al body
        setTimeout(function () {
          var bodyEl = modal.querySelector("#compose-body");
          if (bodyEl) bodyEl.focus();
        }, 100);
      }
    };
    minimizeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMinimized(true);
    });
    maximizeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setMinimized(false);
    });
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeModal();
    });
    // Click en el titlebar cuando está minimizado → restaurar
    titlebar.addEventListener("click", function (e) {
      if (panel.classList.contains("compose-panel--minimized") && !e.target.closest(".compose-panel__btn")) {
        setMinimized(false);
      }
    });

    modal.addEventListener("click", function (e) {
      if (e.target === modal && !panel.classList.contains("compose-panel--minimized")) {
        closeModal();
      }
    });

    // 6) Atajos de teclado: ESC para cerrar, Ctrl+Enter para enviar
    modal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        // Si está minimizado, ESC restaura primero
        if (panel.classList.contains("compose-panel--minimized")) {
          setMinimized(false);
        } else {
          closeModal();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        // Ctrl+Enter o Cmd+Enter envía
        e.preventDefault();
        modal.querySelector("#compose-send-btn").click();
      }
    });
    // Auto-focus en el body (si es reply, deja el cursor arriba del quote)
    setTimeout(function () {
      var bodyEl = modal.querySelector("#compose-body");
      if (bodyEl) {
        bodyEl.focus();
        // Poner el cursor al inicio del texto
        bodyEl.setSelectionRange(0, 0);
        // Si es reply/forward, mover el cursor al inicio del texto nuevo (arriba del quote)
        if (isReply || isForward) {
          // Buscar la primera línea (que es donde el user debería escribir)
          var firstNewline = bodyEl.value.indexOf("\n");
          if (firstNewline > 0) {
            bodyEl.setSelectionRange(0, 0);  // cursor al inicio
          }
        }
      }
    }, 50);

    // 7) Acción de enviar
    modal.querySelector("#compose-send-btn").addEventListener("click", function () {
      sendComposedMail({
        to: modal.querySelector("#compose-to").value,
        cc: modal.querySelector("#compose-cc") ? modal.querySelector("#compose-cc").value : "",
        subject: modal.querySelector("#compose-subject").value,
        body: modal.querySelector("#compose-body").value,
        replyToMail: mail,
        isReply: isReply,
        isForward: isForward,
        threadId: mail ? mail.threadId : null,
        closeModal: closeModal
      });
    });
  }

  // F1.B — Envía el correo compuesto via Gmail API.
  async function sendComposedMail(opts) {
    var api = getElectronAPI();
    if (!api || !api.googleGmail || !api.googleGmail.sendMessage) {
      toast("Error", "Gmail no está conectado", "error");
      return;
    }
    if (!opts.to || !opts.to.trim()) {
      toast("Error", "Falta el destinatario", "error");
      return;
    }

    // Mostrar estado de "enviando"
    var sendBtn = document.querySelector("#compose-send-btn");
    var originalText = sendBtn ? sendBtn.innerHTML : "";
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = "Enviando...";
    }

    try {
      // Construir el headers In-Reply-To y References si es reply
      var inReplyTo = '';
      var references = '';
      if (opts.isReply && opts.replyToMail) {
        // Gmail no siempre expone el Message-ID, pero podemos usar el threadId
        // para mantener la conversación agrupada
      }

      // F1-Feature4 — Agregar la firma al body si existe
      // La firma se guarda en localStorage y se carga al abrir la Bandeja Integrada
      var signature = localStorage.getItem("kair.emailSignature") || "";

      // Quote del mensaje original (si es reply/forward) — el bloque HTML se concatena
      // como texto plano al body. NO usamos "De: ... Enviado: ... Para: ... Asunto: ..."
      // porque el header del thread ya muestra esos datos. Solo dejamos el body citado.
      var quotedText = '';
      if (opts.isReply && opts.replyToMail && opts.replyToMail.body) {
        // Formato estándar de reply: cada línea del body original con "> " (Gmail-style)
        var originalBody = opts.replyToMail.body;
        quotedText = '\n\n' + originalBody.split('\n').map(function (line) {
          return '> ' + line;
        }).join('\n');
      } else if (opts.isForward && opts.replyToMail && opts.replyToMail.body) {
        // Forward: separador estándar "-------- Mensaje original --------"
        var fwdSender = (opts.replyToMail.sender || '') + (opts.replyToMail.senderEmail ? ' <' + opts.replyToMail.senderEmail + '>' : '');
        var fwdDate = opts.replyToMail.date ? formatGmailDate(opts.replyToMail.date) : '';
        quotedText = '\n\n-------- Mensaje original --------\n' +
          'De: ' + fwdSender + '\n' +
          'Fecha: ' + fwdDate + '\n' +
          'Asunto: ' + (opts.replyToMail.subject || '') + '\n\n' +
          opts.replyToMail.body;
      }

      var bodyWithQuoteAndSignature = opts.body + quotedText;
      if (signature && !opts.isForward) {
        // No agregar firma a los forwards (estándar de correo)
        // Separador estándar "-- " antes de la firma
        bodyWithQuoteAndSignature = bodyWithQuoteAndSignature + "\n\n--\n" + signature;
      }

      var result = await api.googleGmail.sendMessage({
        from: state.gmailEmail || undefined,  // Opcional: si no se pasa, Gmail usa el from del OAuth
        to: opts.to.trim(),
        cc: opts.cc ? opts.cc.trim() : undefined,
        subject: opts.subject || "(sin asunto)",
        body: bodyWithQuoteAndSignature,
        inReplyTo: inReplyTo,
        references: references,
        threadId: opts.threadId || undefined
      });

      if (result && result.success) {
        toast("Enviado", "Tu correo fue enviado correctamente", "success");
        opts.closeModal();
        // Refrescar el cache para mostrar el nuevo mensaje
        if (api.emailCache && api.emailCache.syncInbox) {
          api.emailCache.syncInbox({ folder: 'INBOX', maxResults: 50 }).then(function () {
            return api.emailCache.getThreads({ folder: 'INBOX', maxResults: 50 });
          }).then(function (cacheResult) {
            if (cacheResult && cacheResult.success && Array.isArray(cacheResult.data)) {
              state.mails = cacheResult.data.map(threadToMail);
              render();
            }
          }).catch(function (e) {
            console.warn("[BandejaIntegrada] Error refrescando cache post-envío:", e.message);
          });
        }
      } else {
        var errorMsg = (result && result.error) || "Error desconocido";
        toast("Error al enviar", errorMsg, "error");
        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = originalText;
        }
      }
    } catch (e) {
      console.error("[BandejaIntegrada] Error en sendComposedMail:", e);
      toast("Error al enviar", e.message || "Error desconocido", "error");
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = originalText;
        sendBtn.style.display = ""; // Restaurar visibilidad
      }
    }
  }

  // F1.C-fix — Carga el body de un correo desde el cache SQLite (email_messages).
  // Se llama lazy (on-demand) cuando el user selecciona un correo.
  // Ahora trae TODOS los mensajes del thread (no solo el último) para soportar
  // thread grouping: si un thread tiene 3 respuestas, se muestran las 3 apiladas.
  async function loadMailBodyFromCache(mail) {
    var api = getElectronAPI();
    if (!api || !api.emailCache) return;
    try {
      // El mail.threadId es el threadId en SQLite
      var threadId = mail.threadId || mail.id;
      var result = await api.emailCache.getThread(threadId);
      if (result && result.success && result.data && result.data.messages && result.data.messages.length > 0) {
        // F1.C — Guardar TODOS los mensajes del thread (no solo el último)
        // Cada mensaje tiene: from_name, from_email, to_list, body_plain, body_html, date, snippet
        mail.messages = result.data.messages;
        // Mantener compatibilidad: mail.body = último mensaje
        var lastMsg = result.data.messages[result.data.messages.length - 1];
        if (lastMsg && lastMsg.body_plain) {
          mail.body = lastMsg.body_plain;
          console.log("[BandejaIntegrada] Thread " + threadId + " cargado: " + result.data.messages.length + " mensaje(s)");
        }
        // F1-Feature5 — Cargar los adjuntos reales de cada mensaje en paralelo
        // y mergearlos en el thread (mostrar el último mensaje con adjuntos como preview)
        try {
          var attachPromises = result.data.messages.map(function (msg) {
            return api.emailCache.getAttachments(msg.id).then(function (attResult) {
              if (attResult && attResult.success && Array.isArray(attResult.data)) {
                msg.attachments = attResult.data;
              } else {
                msg.attachments = [];
              }
            }).catch(function () { msg.attachments = []; });
          });
          await Promise.all(attachPromises);
          // Si el thread tiene adjuntos, setear hasAttachment=true (puede haber sido false por bug de sync)
          var threadHasAttach = result.data.messages.some(function (m) { return m.attachments && m.attachments.length > 0; });
          if (threadHasAttach) {
            mail.hasAttachment = true;
            // Actualizar el row de la lista para que muestre el icon de paperclip
            var rowInList = document.querySelector('.email-row[data-mail-id="' + (mail.id || mail.threadId) + '"]');
            if (rowInList) rowInList.setAttribute('data-has-attachment', 'true');
          }
        } catch (e) {
          console.warn("[BandejaIntegrada] Error cargando adjuntos:", e.message);
        }
        render();
      }
    } catch (e) {
      console.warn("[BandejaIntegrada] Error cargando body del thread " + mail.threadId + ":", e.message);
    }
  }

  // F1-Feature5 — Formatea el tamaño de un attachment en formato legible
  // Ej: 245000 → "239 KB", 1500000 → "1.4 MB"
  function formatAttachmentSize(bytes) {
    if (!bytes || bytes < 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  // F1-Feature5 — Devuelve un emoji/SVG según la extensión del archivo
  function attachmentIcon(filename) {
    if (!filename) return "📎";
    var ext = (filename.split(".").pop() || "").toLowerCase();
    if (["pdf"].indexOf(ext) >= 0) return "📄";
    if (["doc", "docx", "odt", "rtf"].indexOf(ext) >= 0) return "📝";
    if (["xls", "xlsx", "ods", "csv"].indexOf(ext) >= 0) return "📊";
    if (["ppt", "pptx", "odp"].indexOf(ext) >= 0) return "📈";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].indexOf(ext) >= 0) return "🖼️";
    if (["mp4", "mov", "avi", "mkv", "webm"].indexOf(ext) >= 0) return "🎬";
    if (["mp3", "wav", "ogg", "flac", "m4a"].indexOf(ext) >= 0) return "🎵";
    if (["zip", "rar", "7z", "tar", "gz"].indexOf(ext) >= 0) return "🗜️";
    if (["html", "htm", "xml", "json", "txt", "md"].indexOf(ext) >= 0) return "📃";
    return "📎";
  }

  // F1-Feature5 — Descarga un attachment y lo guarda con dialog nativo
  async function downloadMailAttachment(messageId, attachmentId, filename) {
    var api = getElectronAPI();
    if (!api || !api.googleGmail || !api.googleGmail.downloadAttachment) {
      toast("Error", "API de descarga no disponible", "error");
      return;
    }
    toast("Descargando", filename, "info");
    try {
      var result = await api.googleGmail.downloadAttachment({
        messageId: messageId,
        attachmentId: attachmentId
      });
      if (result && result.success) {
        // result.data es { data: base64url, size, filename, mimeType }
        // Convertir a Uint8Array para descargar
        var base64 = result.data.data.replace(/-/g, '+').replace(/_/g, '/');
        // Pad si es necesario
        while (base64.length % 4) base64 += '=';
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        var blob = new Blob([bytes], { type: result.data.mimeType || 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename || filename || 'archivo';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        toast("Descargado", a.download, "success");
      } else {
        toast("Error al descargar", (result && result.error) || "Error desconocido", "error");
      }
    } catch (e) {
      console.error("[BandejaIntegrada] Error descargando attachment:", e);
      toast("Error al descargar", e.message, "error");
    }
  }

  // F1.C-fix — Helper para parsear el "to" string en un array de {name, email}
  // para mostrar en el thread grouping. Si el mensaje tiene to_list (array de objetos),
  // lo usa directamente. Si tiene recipient (string), lo parsea.
  function parseToListFromMsg(msg) {
    if (!msg) return [];
    if (Array.isArray(msg.to_list) && msg.to_list.length > 0) {
      return msg.to_list;
    }
    if (msg.recipient && typeof msg.recipient === 'string' && msg.recipient.trim()) {
      // Parsear string "Nombre <email>, Otro <email>"
      return msg.recipient.split(',').map(function (s) {
        var trimmed = s.trim();
        var m = trimmed.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
        if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
        if (trimmed.indexOf('@') >= 0) return { name: '', email: trimmed.replace(/[<>"]/g, '').trim().toLowerCase() };
        return { name: trimmed, email: '' };
      }).filter(function (a) { return a.email; });
    }
    return [];
  }

  // F1.C-fix — Formatea una fecha de mensaje en formato "17 jul 2026, 22:05"
  // Reutiliza la lógica de formatGmailDate pero con un fallback al string crudo
  function formatMsgDate(dateStr) {
    if (!dateStr) return '';
    if (typeof dateStr === 'number') {
      var d = new Date(dateStr < 1e12 ? dateStr * 1000 : dateStr);
      if (!isNaN(d.getTime())) {
        var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        var day = d.getDate();
        var mon = months[d.getMonth()];
        var year = d.getFullYear();
        var hh = d.getHours().toString().padStart(2, '0');
        var mm = d.getMinutes().toString().padStart(2, '0');
        return day + ' ' + mon + ' ' + year + ', ' + hh + ':' + mm;
      }
    }
    return String(dateStr);
  }

  // F1-Feature2 — Parser de operadores de búsqueda estilo Gmail.
  // Soporta: from:valor, to:valor, subject:texto, has:attachment,
  //          after:YYYY-MM-DD, before:YYYY-MM-DD, y texto libre al final.
  // Ejemplo: "from:javier subject:prueba" filtra por remitente + subject.
  function parseSearchOperators(query) {
    var tokens = {
      from: null,
      to: null,
      subject: null,
      hasAttachment: null,
      after: null,
      before: null,
      text: ""
    };
    if (!query) return tokens;
    // Regex: captura "key:value" donde key es word char y value no contiene espacios
    var operatorRegex = /(\w+):([^\s]+)/g;
    var textParts = [];
    var lastIndex = 0;
    var match;
    while ((match = operatorRegex.exec(query)) !== null) {
      // El texto entre matches es texto libre
      if (match.index > lastIndex) {
        var between = query.substring(lastIndex, match.index).trim();
        if (between) textParts.push(between);
      }
      var key = match[1].toLowerCase();
      var value = match[2];
      if (key === "from") {
        tokens.from = value.toLowerCase();
      } else if (key === "to") {
        tokens.to = value.toLowerCase();
      } else if (key === "subject") {
        tokens.subject = value.toLowerCase();
      } else if (key === "has") {
        tokens.hasAttachment = value.toLowerCase().indexOf("attachment") >= 0;
      } else if (key === "after") {
        var d = new Date(value);
        if (!isNaN(d.getTime())) tokens.after = d.getTime();
      } else if (key === "before") {
        var d2 = new Date(value);
        if (!isNaN(d2.getTime())) tokens.before = d2.getTime();
      } else {
        // Operador desconocido → tratarlo como texto libre
        textParts.push(match[0]);
      }
      lastIndex = match.index + match[0].length;
    }
    // El resto del query después del último operador
    if (lastIndex < query.length) {
      var rest = query.substring(lastIndex).trim();
      if (rest) textParts.push(rest);
    }
    tokens.text = textParts.join(" ").toLowerCase();
    return tokens;
  }

  // F1-Feature2 — Verifica si un mail matchea TODOS los operadores dados.
  // Si no hay operadores, retorna true (mostrar todo).
  function matchesAllOperators(tokens, mail) {
    if (tokens.from && mail.sender.indexOf(tokens.from) < 0) return false;
    if (tokens.to && mail.preview.indexOf(tokens.to) < 0) return false;  // approximation
    if (tokens.subject && mail.subject.indexOf(tokens.subject) < 0) return false;
    if (tokens.hasAttachment === true && !mail.hasAttachment) return false;
    if (tokens.hasAttachment === false && mail.hasAttachment) return false;
    if (tokens.after && mail.date < tokens.after) return false;
    if (tokens.before && mail.date > tokens.before) return false;
    if (tokens.text) {
      // Buscar el texto libre en cualquiera de los campos
      var hayMatch = mail.subject.indexOf(tokens.text) >= 0 ||
                     mail.sender.indexOf(tokens.text) >= 0 ||
                     mail.preview.indexOf(tokens.text) >= 0;
      if (!hayMatch) return false;
    }
    return true;
  }

  // F1-Feature2 — Devuelve los operadores ACTIVOS del query como array de chips.
  // Cada chip: { key, value, label, originalText }
  // - key: "from"/"to"/"subject"/"has"/"after"/"before"
  // - value: el valor del operador (lowercase, sin procesar)
  // - label: lo que se muestra en el chip (con mayúsculas, valores formateados)
  // - originalText: el texto exacto en el query (para poder quitarlo con un click)
  function getActiveOperators(query) {
    if (!query) return [];
    var chips = [];
    var operatorRegex = /(\w+):([^\s]+)/g;
    var match;
    while ((match = operatorRegex.exec(query)) !== null) {
      var key = match[1].toLowerCase();
      var value = match[2];
      var originalText = match[0];
      var label = '';
      if (key === 'from') label = 'De: ' + value;
      else if (key === 'to') label = 'Para: ' + value;
      else if (key === 'subject') label = 'Asunto: ' + value;
      else if (key === 'has') label = value.toLowerCase().indexOf('attachment') >= 0 ? 'Con adjuntos' : value;
      else if (key === 'after') label = 'Después de ' + value;
      else if (key === 'before') label = 'Antes de ' + value;
      else label = key + ':' + value;  // Operador desconocido
      chips.push({ key: key, value: value, label: label, originalText: originalText });
    }
    return chips;
  }

  // F1-Feature2 — Quita un operador del query (helper para el click en X del chip)
  function removeOperatorFromQuery(query, originalText) {
    if (!query || !originalText) return query;
    // Quitar la primera ocurrencia del operador (con espacios alrededor opcionales)
    var escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('\\s*' + escapedText + '\\s*', '');
    return query.replace(regex, ' ').trim();
  }

  function addMailToCalendar(mail) {
    if (!mail.meetingSuggestion) {
      toast("Sin invitación", "Este correo no incluye invitación a calendario.", "warning");
      return;
    }
    const s = mail.meetingSuggestion;
    state.draft = {
      title: s.title,
      date: s.date,
      startHour: s.startHour,
      durationHours: s.durationHours,
      location: s.location,
      attendees: s.attendees.join(", "),
      notes: `Creado desde correo: ${mail.subject}`,
      linkedMailId: mail.id,
      category: s.eventCategory,
    };
    state.linkedMailSubject = mail.subject;
    openEventModal();
  }

  function dropMailToCalendar(mailId, date, hour) {
    const mail = state.mails.find((m) => m.id === mailId);
    if (!mail) return;
    state.draft = {
      title: mail.meetingSuggestion ? mail.meetingSuggestion.title : mail.subject,
      date,
      startHour: hour,
      durationHours: mail.meetingSuggestion ? mail.meetingSuggestion.durationHours : 1,
      location: mail.meetingSuggestion ? mail.meetingSuggestion.location : "",
      attendees: mail.meetingSuggestion ? mail.meetingSuggestion.attendees.join(", ") : "",
      notes: `Creado desde correo: ${mail.subject}`,
      linkedMailId: mail.id,
      category: mail.meetingSuggestion ? mail.meetingSuggestion.eventCategory : "plan",
    };
    state.linkedMailSubject = mail.subject;
    openEventModal();
    toast("Correo soltado en el calendario", "Revisa los datos del evento antes de guardar.", "success");
  }

  function selectEvent(ev) {
    if (ev.linkedMailId) {
      state.selectedMailId = ev.linkedMailId;
      // Ocultamos el calendario overlay para revelar el correo vinculado
      state.calendarVisible = false;
      render();
      toast("Evento vinculado con correo", "Abriste el correo que originó este evento.", "info");
    } else {
      const cat = getCategoryStyle(ev.category);
      toast(ev.title, `${cat.label || ev.category} · ${ev.location || "Sin lugar"} · ${ev.date}`, "info");
    }
  }

  function openCreateEventModal(date, hour) {
    state.draft = {
      title: "",
      date,
      startHour: hour,
      durationHours: 1,
      location: "",
      attendees: "",
      notes: "",
      category: "plan",
      linkedMailId: undefined,
    };
    state.linkedMailSubject = undefined;
    openEventModal();
  }

  // ====== Modal de evento ======
  function openEventModal() {
    state.eventModalOpen = true;
    renderEventModal();
    $("#modal-overlay").hidden = false;
  }

  function closeEventModal() {
    state.eventModalOpen = false;
    $("#modal-overlay").hidden = true;
  }

  function renderEventModal() {
    const modal = $("#event-modal");
    const d = state.draft;
    const cats = Object.values(D.EVENT_CATEGORIES);
    const availableDates = D.MONTH_GRID.flat().filter((c) => c.inMonth).map((c) => c.iso);
    const durations = [0.5, 1, 1.5, 2, 3, 4];

    modal.innerHTML = `
      <div class="kair-modal__header">
        <div class="kair-modal__title">${D.ICONS.calendarPlus} Nuevo evento de calendario</div>
        <button class="kair-icon-btn" id="modal-close" aria-label="Cerrar">${D.ICONS.x}</button>
      </div>
      ${state.linkedMailSubject ? `
        <div style="margin:12px 12px 0;padding:10px 12px;background:var(--kair-bg-soft);border-radius:6px;display:flex;align-items:flex-start;gap:8px;">
          ${D.ICONS.mail.replace('width="13" height="13"', 'width="14" height="14"')}
          <div style="min-width:0;">
            <div style="font-size:0.75rem;font-weight:600;color:var(--kair-primary);">Creado desde correo</div>
            <div style="font-size:0.75rem;color:var(--kair-text-body);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${state.linkedMailSubject}</div>
          </div>
        </div>
      ` : ""}
      <div class="kair-modal__body">
        <div class="kair-field">
          <label class="kair-field__label">Título del evento</label>
          <input type="text" class="kair-input" id="draft-title" value="${d.title}" placeholder="Ej: Reunión de seguimiento SG-SST" />
        </div>
        <div class="kair-field">
          <label class="kair-field__label">Categoría</label>
          <div class="kair-chip-select">
            ${cats.map((c) => `
              <button class="kair-chip-select__option" data-cat="${c.id}" data-active="${d.category === c.id}" style="${d.category === c.id ? `background:${c.bg};border-color:${c.color};color:${c.color};` : ""}">
                <span class="kair-chip-select__dot" style="background:${c.color};"></span>
                ${c.label}
              </button>
            `).join("")}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="kair-field">
            <label class="kair-field__label">${D.ICONS.calendarPlus} Fecha</label>
            <select class="kair-select" id="draft-date">
              ${availableDates.map((iso, i) => `<option value="${iso}" ${d.date === iso ? "selected" : ""}>${D.WEEKDAY_LABELS[i % 7]} ${parseInt(iso.split("-")[2], 10)}</option>`).join("")}
            </select>
          </div>
          <div class="kair-field">
            <label class="kair-field__label">${D.ICONS.clock} Hora</label>
            <select class="kair-select" id="draft-hour">
              ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${d.startHour === h ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="kair-field">
          <label class="kair-field__label">Duración</label>
          <div class="kair-duration-row">
            ${durations.map((dd) => `<button class="kair-duration-row__btn" data-dur="${dd}" data-active="${d.durationHours === dd}">${dd === 0.5 ? "30 min" : dd + "h"}</button>`).join("")}
          </div>
        </div>
        <div class="kair-field">
          <label class="kair-field__label">${D.ICONS.mapPin} Lugar</label>
          <input type="text" class="kair-input" id="draft-location" value="${d.location}" placeholder="Sala de juntas, dirección, enlace..." />
        </div>
        <div class="kair-field">
          <label class="kair-field__label">${D.ICONS.users} Asistentes</label>
          <input type="text" class="kair-input" id="draft-attendees" value="${d.attendees}" placeholder="correos separados por coma" />
        </div>
        <div class="kair-field">
          <label class="kair-field__label">Notas</label>
          <textarea class="kair-textarea" id="draft-notes" rows="2" placeholder="Agenda, materiales, recordatorios...">${d.notes}</textarea>
        </div>
      </div>
      <div class="kair-modal__footer">
        <button class="kair-header__action--ghost" id="modal-cancel">Cancelar</button>
        <button class="kair-header__action--primary" id="modal-save" ${!d.title.trim() ? "disabled" : ""} style="${!d.title.trim() ? "opacity:0.5;cursor:not-allowed;" : ""}">${D.ICONS.save} Guardar evento</button>
      </div>
    `;

    // Bindings
    $("#modal-close").addEventListener("click", closeEventModal);
    $("#modal-cancel").addEventListener("click", closeEventModal);
    $("#modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") closeEventModal();
    });
    $("#draft-title").addEventListener("input", (e) => {
      state.draft.title = e.target.value;
      const saveBtn = $("#modal-save");
      saveBtn.disabled = !e.target.value.trim();
      saveBtn.style.opacity = e.target.value.trim() ? "1" : "0.5";
      saveBtn.style.cursor = e.target.value.trim() ? "pointer" : "not-allowed";
    });
    $("#draft-date").addEventListener("change", (e) => state.draft.date = e.target.value);
    $("#draft-hour").addEventListener("change", (e) => state.draft.startHour = parseInt(e.target.value, 10));
    $("#draft-location").addEventListener("input", (e) => state.draft.location = e.target.value);
    $("#draft-attendees").addEventListener("input", (e) => state.draft.attendees = e.target.value);
    $("#draft-notes").addEventListener("input", (e) => state.draft.notes = e.target.value);

    $$(".kair-chip-select__option", modal).forEach((b) => {
      b.addEventListener("click", () => {
        state.draft.category = b.getAttribute("data-cat");
        renderEventModal();
      });
    });
    $$(".kair-duration-row__btn", modal).forEach((b) => {
      b.addEventListener("click", () => {
        state.draft.durationHours = parseFloat(b.getAttribute("data-dur"));
        renderEventModal();
      });
    });

    $("#modal-save").addEventListener("click", saveEvent);
  }

  function saveEvent() {
    const d = state.draft;
    const newEvent = {
      id: "e-" + Date.now(),
      title: d.title.trim() || "Evento sin título",
      date: d.date,
      startHour: d.startHour,
      durationHours: d.durationHours,
      category: d.category,
      location: d.location || undefined,
      linkedMailId: d.linkedMailId,
      attendees: d.attendees ? d.attendees.split(",").map((s) => s.trim()) : undefined,
    };
    state.events.push(newEvent);
    closeEventModal();
    toast("Evento guardado en el calendario", `${newEvent.title} · ${newEvent.date}`, "success");
    // Tras guardar, ocultamos el calendario overlay para volver al correo
    state.calendarVisible = false;
    render();
  }

  // ====== Footer ======
  function renderFooter() {
    const visible = state.events.filter((e) => state.activeCategories.has(e.category));
    const fromIPC = state.events.filter((e) => e.id && !String(e.id).match(/^e\d+$/)).length;
    const fromMocks = state.events.length - fromIPC;
    console.log("[BandejaIntegrada][FOOTER] state.events.length=" + state.events.length + ", visible=" + visible.length + ", fromIPC=" + fromIPC + ", fromMocks=" + fromMocks + ", activeCategories=" + state.activeCategories.size);
    $("#footer-events-count").textContent = `${visible.length} eventos visibles`;
    $("#footer-view").textContent = "Vista: " + (state.calendarVisible ? "Calendario" : "Correo");
  }

  // ====== Boot ======
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
