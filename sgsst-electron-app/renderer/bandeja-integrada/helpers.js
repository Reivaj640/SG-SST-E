/* ============================================================
 * K+AIR Bandeja Integrada — Helpers / Utilidades
 * ============================================================ */

(function () {
  "use strict";

  const D = window.KairData;

  // ====== Selectores ======
  window.BandejaHelpers = {
    $: function (sel, root) {
      return (root || document).querySelector(sel);
    },
    $$: function (sel, root) {
      return Array.from((root || document).querySelectorAll(sel));
    },
    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      Object.entries(attrs || {}).forEach(function (kv) {
        var k = kv[0], v = kv[1];
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("data-")) node.setAttribute(k, v);
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k === "onClick") node.addEventListener("click", v);
        else if (k === "onInput") node.addEventListener("input", v);
        else if (k === "onChange") node.addEventListener("change", v);
        else if (["title", "aria-label", "type", "placeholder", "value"].indexOf(k) >= 0) node.setAttribute(k, v);
      });
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
      return node;
    },

    // ====== Formato de fechas ======
    fmtHour: function (h) {
      var hh = Math.floor(h);
      var mm = Math.round((h - hh) * 60);
      return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
    },

    formatGmailDate: function (dateVal, withTime) {
      if (!dateVal) return "";
      var d = typeof dateVal === "number" ? new Date(dateVal) : new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      var months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
      var day = d.getDate();
      var mon = months[d.getMonth()];
      var year = d.getFullYear();
      var out = day + " " + mon + " " + year;
      if (withTime) {
        var hh = d.getHours();
        var mm = d.getMinutes();
        out += ", " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
      }
      return out;
    },

    formatGmailLongDate: function (dateVal) {
      if (!dateVal) return "";
      var d = typeof dateVal === "number" ? new Date(dateVal) : new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      var months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      var day = d.getDate();
      var mon = months[d.getMonth()];
      var year = d.getFullYear();
      var hh = d.getHours();
      var mm = d.getMinutes();
      return day + " de " + mon + " de " + year + ", " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
    },

    formatRelativeTime: function (dateVal) {
      if (!dateVal) return "";
      var d = typeof dateVal === "number" ? new Date(dateVal) : new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      var diff = Date.now() - d.getTime();
      var sec = Math.floor(diff / 1000);
      if (sec < 60) return "hace un momento";
      var min = Math.floor(sec / 60);
      if (min < 60) return "hace " + min + " min";
      var hrs = Math.floor(min / 60);
      if (hrs < 24) return "hace " + hrs + " h";
      var days = Math.floor(hrs / 24);
      if (days < 7) return "hace " + days + " d";
      var wks = Math.floor(days / 7);
      if (wks < 5) return "hace " + wks + " sem";
      var mths = Math.floor(days / 30);
      return "hace " + mths + " mes" + (mths > 1 ? "es" : "");
    },

    // ====== Escape HTML ======
    esc: function (s) {
      if (!s) return "";
      return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'");
    },

    // ====== Categoría / Color ======
    getCategoryStyle: function (cat) {
      if (!cat) return { color: "#6c757d", bg: "#eef0f3", border: "#d6dae0", label: "Otro" };
      if (D.EVENT_CATEGORIES && D.EVENT_CATEGORIES[cat]) return D.EVENT_CATEGORIES[cat];
      var FALLBACK_CATEGORIES = {
        rapido: { color: "#0d6efd", bg: "#e7f1ff", border: "#b6d4fe" },
        rapido_vencido: { color: "#dc3545", bg: "#fdeaea", border: "#f5c2c7" },
        gestacion: { color: "#d63384", bg: "#fce8f1", border: "#f5b5d3" },
        mantenimiento_programado: { color: "#fd7e14", bg: "#fff3e6", border: "#ffd9b3" },
        inspeccion: { color: "#198754", bg: "#e6f4ea", border: "#a3d9b1" },
        inspeccion_vencida: { color: "#842029", bg: "#f8d7da", border: "#f1aeb5" },
        recordatorio_copasst: { color: "#dc3545", bg: "#fdeaea", border: "#f5c2c7" },
        recordatorio_convivencia: { color: "#0891b2", bg: "#e0f7fa", border: "#a5e8f0" },
        recordatorio_presupuesto: { color: "#10b981", bg: "#d1fae5", border: "#a7f3d0" },
        recordatorio_afiliacion: { color: "#f59e0b", bg: "#fef3c7", border: "#fde68a" },
        recordatorio_inducciones: { color: "#6366f1", bg: "#e0e7ff", border: "#c7d2fe" },
        cumplido: { color: "#28a745", bg: "#e6f7ec", border: "#b8e6c5" }
      };
      if (FALLBACK_CATEGORIES[cat]) return FALLBACK_CATEGORIES[cat];
      return { color: "#6c757d", bg: "#eef0f3", border: "#d6dae0", label: "Otro" };
    },

    initials: function (name) {
      if (!name) return "?";
      return name.split(" ").map(function (p) { return p[0]; }).filter(function (c) { return c; }).slice(0, 2).join("").toUpperCase() || "?";
    },

    stringHashColor: function (str) {
      if (!str) return "5f6368";
      var hash = 0;
      for (var i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
      var c = (hash & 0x00FFFFFF).toString(16);
      return ("000000" + c).slice(-6);
    },

    // ====== Coerce address list ======
    _coerceAddressList: function (value) {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      try { return JSON.parse(value); } catch (e) { return []; }
    },

    // ====== Toast ======
    toast: function (title, subtitle, type) {
      var container = document.getElementById("toast-container");
      if (!container) return;
      var toast = document.createElement("div");
      toast.className = "kair-toast kair-toast--" + (type || "info");
      toast.innerHTML = "<div class='kair-toast__title'>" + title + "</div>" +
        (subtitle ? "<div class='kair-toast__subtitle'>" + subtitle + "</div>" : "");
      container.appendChild(toast);
      setTimeout(function () {
        toast.style.opacity = "0";
        setTimeout(function () { toast.remove(); }, 300);
      }, 4000);
    },

    // ====== Electron API getter ======
    getElectronAPI: function () {
      if (typeof window === "undefined") return null;
      return window.electronAPI || (window.parent && window.parent.electronAPI) || null;
    },

    getKairCalendarAdapter: function () {
      if (typeof window === "undefined") return null;
      return window.KairCalendarAdapter || (window.parent && window.parent.KairCalendarAdapter) || null;
    },

    getKairCalendar: function () {
      if (typeof window === "undefined") return null;
      return window.KairCalendar || (window.parent && window.parent.KairCalendar) || null;
    },

    getGoogleCalendarApi: function () {
      try {
        var api = window.BandejaHelpers.getElectronAPI();
        if (api && api.googleCalendar && typeof api.googleCalendar.create === "function") return api.googleCalendar;
      } catch (e) { }
      return null;
    }
  };
})();