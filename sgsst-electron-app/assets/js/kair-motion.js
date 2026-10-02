/* ═══════════════════════════════════════════════════════════════════
   K+AIR · KairMotion — wrapper de Anime.js v4.5.0 (📦836)
   API mínima para el piloto "premium sutil" del dashboard:
   stagger de tarjetas + contadores numéricos.

   Reglas del wrapper (las que hacen que nada quede roto si falla):
   - Sin la librería (o con prefers-reduced-motion) NO se oculta nada:
     los elementos se pintan con su valor final y listo.
   - El tween va como array [desde, hasta] (la forma {from,to} revienta
     en el build UMD v4.5.0: "i.includes is not a function").
   - Hay timer de respaldo: si la animación no termina a tiempo (relloj
     congelado con la ventana oculta, etc.) se limpia el estilo en línea
     y el contenido vuelve a su estado visible/final.
   ═══════════════════════════════════════════════════════════════════ */

var KairMotion = (function () {
  'use strict';

  var DEFAULTS = { duration: 400, stagger: 60, y: 12, scale: 0.98 };

  function _anime() {
    if (typeof window === 'undefined') return null;
    var a = window.anime;
    return (a && typeof a.animate === 'function') ? a : null;
  }

  function available() { return _anime() !== null; }

  function reduced() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function _ease() {
    var a = _anime();
    if (!a || typeof a.cubicBezier !== 'function') return null;
    try { return a.cubicBezier(0.23, 1, 0.32, 1); } catch (e) { return null; }
  }

  // Red de seguridad: quita los estilos en línea para que el elemento
  // vuelva a su estado visible por CSS (nunca quedarse en opacity 0).
  function _visibilizar(lista) {
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
      if (el && el.style) {
        el.style.opacity = '';
        el.style.transform = '';
      }
    }
  }

  function _respaldo(lista, ms, estado) {
    if (typeof setTimeout !== 'function') return;
    setTimeout(function () {
      if (estado.terminado) return;
      _visibilizar(lista);
    }, ms);
  }

  function staggerIn(selector, opts) {
    opts = opts || {};
    var a = _anime();
    if (!a) return false;
    var lista;
    try { lista = document.querySelectorAll(selector); } catch (e) { return false; }
    if (!lista || !lista.length) return false;

    var suave = reduced();
    var dur = suave ? 150 : (opts.duration || DEFAULTS.duration);
    var gap = suave ? 0 : (opts.stagger || DEFAULTS.stagger);
    var y = suave ? 0 : (opts.y != null ? opts.y : DEFAULTS.y);
    var s = suave ? 1 : (opts.scale != null ? opts.scale : DEFAULTS.scale);

    var estado = { terminado: false };
    var params;
    try {
      params = { opacity: [0, 1], duration: dur };
      if (gap > 0) params.delay = a.stagger(gap);
      if (y) params.translateY = [y, 0];
      if (s !== 1) params.scale = [s, 1];
      var e = _ease();
      if (e) params.ease = e;
      params.onComplete = function () { estado.terminado = true; };
      a.animate(lista, params);
    } catch (err) {
      _visibilizar(lista);
      return false;
    }
    _respaldo(lista, dur + gap * (lista.length - 1) + 600, estado);
    return true;
  }

  // Pinta SOLO el primer nodo de texto: así se conserva el <small> del
  // sufijo (%) que renderDashKpis agrega después del número.
  function _nodoValor(el) {
    var n = el.firstChild;
    if (n && n.nodeType === 3) return n;
    var t = document.createTextNode('');
    if (n) el.insertBefore(t, n);
    else el.appendChild(t);
    return t;
  }

  function _formatear(v, dec) {
    if (dec > 0) return Number(v).toFixed(dec);
    return String(Math.round(Number(v)));
  }

  function _decimalesDe(to) {
    var txt = String(to);
    var dot = txt.indexOf('.');
    if (dot < 0) return 0;
    return Math.min(txt.length - dot - 1, 3);
  }

  function countTo(el, opts) {
    opts = opts || {};
    if (!el || el.nodeType !== 1) return false;
    var to = Number(opts.to);
    if (isNaN(to)) return false;
    var from = Number(opts.from != null ? opts.from : 0);
    if (isNaN(from)) from = 0;
    var dec = (opts.decimals != null) ? opts.decimals : _decimalesDe(to);
    var dur = opts.duration || 700;

    var a = _anime();
    if (!a || reduced()) {
      // Sin animación: pintar el valor final y no tocar nada más.
      try { _nodoValor(el).nodeValue = _formatear(to, dec); } catch (e) { /* noop */ }
      return false;
    }

    var nodo;
    var estado = { terminado: false };
    var obj = { v: from };
    try {
      nodo = _nodoValor(el);
      nodo.nodeValue = _formatear(from, dec);
      var params = {
        v: to,
        duration: dur,
        onUpdate: function () { nodo.nodeValue = _formatear(obj.v, dec); },
        onComplete: function () {
          estado.terminado = true;
          nodo.nodeValue = _formatear(to, dec);
        }
      };
      var e = _ease();
      if (e) params.ease = e;
      a.animate(obj, params);
    } catch (err) {
      if (nodo) nodo.nodeValue = _formatear(to, dec);
      return false;
    }
    if (typeof setTimeout === 'function') {
      setTimeout(function () {
        if (estado.terminado) return;
        try { nodo.nodeValue = _formatear(to, dec); } catch (e2) { /* noop */ }
      }, dur + 600);
    }
    return true;
  }

  // Conveniencia del piloto 📦836: stagger de las 3 grillas del
  // dashboard + contadores de las 4 tarjetas KPI.
  function dashboard(data) {
    try {
      staggerIn('#kpi-slot .kair-kpi');
      staggerIn('#mod-grid .kair-mod');
      staggerIn('#tasks-container .kair-task');
      var k = (data && data.kpis) || {};
      var vals = document.querySelectorAll('#kpi-slot .kair-kpi__value');
      var nums = [k.accidents_year, k.pric_active, k.overdue_docs, k.compliance];
      for (var i = 0; i < vals.length && i < nums.length; i++) {
        if (nums[i] == null || nums[i] === '') continue;
        countTo(vals[i], { to: nums[i] });
      }
      return true;
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[KairMotion] dashboard:', err);
      }
      return false;
    }
  }

  return {
    available: available,
    reduced: reduced,
    staggerIn: staggerIn,
    countTo: countTo,
    dashboard: dashboard
  };
})();

window.KairMotion = KairMotion;
