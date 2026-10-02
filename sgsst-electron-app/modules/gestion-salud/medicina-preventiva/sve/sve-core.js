/* ============================================================
 * K+AIR · SVE — Núcleo UI (helpers compartidos)
 * Vanilla JS. Se expone en window.SveUI
 * El, iconos lucide, toasts, modales, formatos y utilidades.
 * ============================================================ */
(function (global) {
  "use strict";

  var U = {};

  /* ---------- Months / labels ---------- */
  U.MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
  U.MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  U.MES_LABEL = {
    ENERO: "enero", FEBRERO: "febrero", MARZO: "marzo", ABRIL: "abril", MAYO: "mayo", JUNIO: "junio",
    JULIO: "julio", AGOSTO: "agosto", SEPTIEMBRE: "septiembre", OCTUBRE: "octubre", NOVIEMBRE: "noviembre", DICIEMBRE: "diciembre"
  };

  /* ---------- Element builder ---------- */
  U.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "className") node.className = v;
        else if (k === "textContent") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "style" && typeof v === "object") {
          /* 📦831: setProperty exige el nombre CSS (kebab-case). Una clave camelCase
             (marginTop, gridTemplateColumns, textAlign…) se DESCARTA en silencio en
             Chromium y el estilo nunca aplica — por eso varios grids/espaciados del
             módulo quedaban rotos. Se convierte camelCase → kebab-case; las claves ya
             en kebab o de una sola palabra no cambian. */
          Object.keys(v).forEach(function (p) {
            node.style.setProperty(p.replace(/[A-Z]/g, function (m) { return "-" + m.toLowerCase(); }), v[p]);
          });
        }
        else if (k === "onClick") node.addEventListener("click", v);
        else if (k === "onInput") node.addEventListener("input", v);
        else if (k === "onChange") node.addEventListener("change", v);
        else if (k === "onKeydown") node.addEventListener("keydown", v);
        else if (k === "value" && (tag === "input" || tag === "textarea" || tag === "select")) node.value = v;
        else if (k === "checked") node.checked = !!v;
        else if (k === "disabled") node.disabled = !!v;
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    if (children) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  };

  /* ---------- Icons (lucide vendorizado) ---------- */
  U.icon = function (name, size) {
    var i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    if (size) { i.style.width = size + "px"; i.style.height = size + "px"; }
    return i;
  };
  U.refreshIcons = function () {
    try {
      if (global.lucide && typeof global.lucide.createIcons === "function") global.lucide.createIcons();
    } catch (e) { /* noop */ }
  };

  /* elipsis en el subtítulo del header (una sola vez) */
  try {
    var styleFix = document.createElement("style");
    styleFix.textContent = ".sve-header__sub span{overflow:hidden;text-overflow:ellipsis;min-width:0}";
    document.head.appendChild(styleFix);
  } catch (e) { /* noop */ }

  /* ---------- Formatos ---------- */
  U.fmtDate = function (iso) {
    if (!iso) return "—";
    var s = String(iso);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    return m[3] + " " + U.MONTHS_SHORT[parseInt(m[2], 10) - 1] + " " + m[1];
  };
  U.fmtPct = function (ratio, decimals) {
    if (ratio === null || ratio === undefined || isNaN(ratio)) return "—";
    var d = decimals === undefined ? 1 : decimals;
    return (ratio * 100).toFixed(d) + "%";
  };
  U.fmtNum = function (n) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("es-CO", { maximumFractionDigits: 1 });
  };
  U.edad = function (fechaNacimiento) {
    if (!fechaNacimiento) return null;
    var m = String(fechaNacimiento).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var f = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    var hoy = new Date();
    var e = hoy.getFullYear() - f.getFullYear();
    var mm = hoy.getMonth() - f.getMonth();
    if (mm < 0 || (mm === 0 && hoy.getDate() < f.getDate())) e--;
    return e >= 0 && e < 130 ? e : null;
  };

  /* ---------- Estados epidemiológicos ---------- */
  U.ESTADOS = {
    sospechoso: { label: "Sospechoso", cls: "sve-pill--amber", icon: "search" },
    confirmado: { label: "Confirmado", cls: "sve-pill--red", icon: "thermometer" },
    aislamiento: { label: "En aislamiento", cls: "sve-pill--violet", icon: "house" },
    alta: { label: "Alta epidemiológica", cls: "sve-pill--green", icon: "check-circle-2" },
    descartado: { label: "Descartado", cls: "sve-pill--gray", icon: "x-circle" }
  };
  U.estadoPill = function (estado, small) {
    var e = U.ESTADOS[estado] || U.ESTADOS.sospechoso;
    var p = U.el("span", { className: "sve-pill " + e.cls + (small ? " sve-pill--sm" : "") }, [
      U.icon(e.icon, small ? 10 : 12), e.label
    ]);
    return p;
  };

  /* pill SI/NO para riesgo */
  U.ynPill = function (val, goodColor) {
    var yes = String(val || "NO").toUpperCase() === "SI";
    var cls = yes ? (goodColor ? "sve-pill--green" : "sve-pill--red") : "sve-pill--gray";
    return U.el("span", { className: "sve-pill " + cls }, yes ? "SÍ" : "NO");
  };

  /* ---------- Toast ---------- */
  U.toast = function (title, msg, type) {
    type = type || "info";
    var host = document.querySelector(".sve-toasts");
    if (!host) {
      host = U.el("div", { className: "sve-toasts" });
      document.body.appendChild(host);
    }
    var icoName = type === "success" ? "check-circle-2" : type === "error" ? "alert-triangle" : type === "warn" ? "alert-circle" : "info";
    var t = U.el("div", { className: "sve-toast sve-toast--" + type }, [
      U.el("div", { className: "sve-toast__ico" }, U.icon(icoName, 15)),
      U.el("div", {}, [
        U.el("div", { className: "sve-toast__ttl", textContent: title }),
        msg ? U.el("div", { className: "sve-toast__msg", textContent: msg }) : null
      ])
    ]);
    host.appendChild(t);
    U.refreshIcons();
    setTimeout(function () {
      t.style.transition = "opacity .3s, transform .3s";
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 3800);
  };

  /* ---------- Modal de confirmación ---------- */
  U.confirm = function (opts) {
    opts = opts || {};
    var onOk = opts.onOk || function () {};
    var overlay = U.el("div", { className: "sve-modal-overlay" });
    function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
    overlay.addEventListener("click", function (ev) { if (ev.target === overlay) close(); });
    var modal = U.el("div", { className: "sve-modal" + (opts.wide ? " sve-modal--wide" : "") }, [
      U.el("div", { className: "sve-modal__head" }, [
        U.el("div", { className: "sve-modal__title", textContent: opts.title || "Confirmar acción" }),
        U.el("button", { className: "sve-xbtn", onClick: close, title: "Cerrar" }, U.icon("x", 14))
      ]),
      opts.body
        ? U.el("div", { className: "sve-modal__body" }, opts.body)
        : U.el("div", { className: "sve-modal__msg", textContent: opts.msg || "" }),
      U.el("div", { className: "sve-modal__foot" }, [
        U.el("button", { className: "sve-btn sve-btn--ghost", onClick: close, textContent: opts.cancelLabel || "Cancelar" }),
        U.el("button", {
          className: "sve-btn " + (opts.danger ? "sve-btn--danger" : "sve-btn--primary"),
          textContent: opts.okLabel || "Confirmar",
          onClick: function () { close(); onOk(); }
        })
      ])
    ]);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    U.refreshIcons();
    return { close: close };
  };

  /* ---------- Barras / anillos / stats ---------- */
  U.pctBar = function (ratio, cls) {
    var p = Math.max(0, Math.min(1, ratio || 0));
    var fillCls = cls || (p >= 0.85 ? "is-good" : p >= 0.6 ? "" : "is-warn");
    return U.el("div", { className: "sve-pbar", title: Math.round(p * 100) + "%" }, [
      U.el("span", { className: "sve-pbar__fill " + fillCls, style: { width: Math.round(p * 100) + "%" } })
    ]);
  };

  /* ring SVG oscuro (para hero) */
  U.ringDark = function (ratio, label) {
    var p = Math.max(0, Math.min(1, ratio || 0));
    var r = 52, c = 2 * Math.PI * r;
    var wrap = U.el("div", { className: "sve-ring" });
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.innerHTML =
      '<defs><linearGradient id="sveRingGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#14b8a6"/></linearGradient></defs>' +
      '<circle class="sve-ring__track" cx="60" cy="60" r="' + r + '" stroke-width="9"/>' +
      '<circle class="sve-ring__fill" cx="60" cy="60" r="' + r + '" stroke-width="9" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - p)).toFixed(1) + '"/>';
    wrap.appendChild(svg);
    wrap.appendChild(U.el("div", { className: "sve-ring__center" }, [
      U.el("div", { className: "sve-ring__pct", textContent: Math.round(p * 100) + "%" }),
      label ? U.el("div", { className: "sve-ring__lbl", textContent: label }) : null
    ]));
    return wrap;
  };

  /* barras verticales simples */
  U.bars = function (items, opts) {
    opts = opts || {};
    var max = 0;
    items.forEach(function (it) { if (it.value > max) max = it.value; });
    max = max || 1;
    return U.el("div", { className: "sve-bars" }, items.map(function (it, i) {
      return U.el("div", { className: "sve-bars__item", title: it.label + ": " + it.value, key: i }, [
        U.el("div", { className: "sve-bars__val", textContent: String(it.value) }),
        U.el("div", {
          className: "sve-bars__bar" + (it.color ? " sve-bars__bar--" + it.color : ""),
          style: { height: Math.max(4, Math.round((it.value / max) * 100)) + "%" }
        }),
        U.el("div", { className: "sve-bars__lbl", textContent: it.label })
      ]);
    }));
  };

  /* hbar horizontal */
  U.hbar = function (label, value, max, color) {
    var pct = max ? Math.round((value / max) * 100) : 0;
    return U.el("div", { className: "sve-hbar" }, [
      U.el("div", { className: "sve-hbar__lbl", textContent: label, title: label }),
      U.el("div", { className: "sve-hbar__track" }, [
        U.el("div", {
          className: "sve-hbar__fill",
          style: { width: pct + "%", background: color || "var(--sve-grad-brand)" }
        })
      ]),
      U.el("div", { className: "sve-hbar__num", textContent: String(value) })
    ]);
  };

  /* sección de formulario numerada */
  U.formSection = function (num, title, bodyChildren) {
    return U.el("div", { className: "sve-card sve-form-sec" }, [
      U.el("div", { className: "sve-form-sec__head" }, [
        U.el("div", { className: "sve-form-sec__num", textContent: String(num) }),
        U.el("div", { className: "sve-form-sec__title", textContent: title })
      ]),
      U.el("div", { className: "sve-form-sec__body" }, bodyChildren)
    ]);
  };

  /* campo de formulario */
  U.field = function (labelText, inputEl, opts) {
    opts = opts || {};
    return U.el("div", { className: "sve-field" + (opts.full ? " sve-field--full" : "") + (opts.span2 ? " sve-field--2col" : "") }, [
      U.el("label", {}, [labelText, opts.required ? U.el("span", { className: "req", textContent: "*" }) : null]),
      inputEl,
      opts.err ? U.el("div", { className: "sve-field__err", textContent: opts.err }) : null
    ]);
  };

  /* control sí/no (devuelve node; guarda valor en data-value) */
  U.yesNo = function (initial, onChange) {
    var wrap = U.el("div", { className: "sve-yn" });
    var val = String(initial || "NO").toUpperCase() === "SI" ? "SI" : "NO";
    function paint() {
      Array.prototype.forEach.call(wrap.children, function (b) {
        b.className = "sve-yn__btn" + (b.dataset.v === val ? (val === "SI" ? " is-yes" : " is-no") : "");
      });
    }
    ["SI", "NO"].forEach(function (v) {
      wrap.appendChild(U.el("button", {
        type: "button", "data-v": v, textContent: v,
        onClick: function () { val = v; paint(); if (onChange) onChange(val); }
      }));
    });
    paint();
    wrap.getValue = function () { return val; };
    return wrap;
  };

  global.SveUI = U;
})(typeof window !== "undefined" ? window : this);
