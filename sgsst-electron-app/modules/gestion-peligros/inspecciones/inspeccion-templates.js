/* ============================================================
 * K+AIR · Inspecciones — Templates / Constructores DOM
 * Vanilla JS. Sin dependencias. Se expone en window.KairTemplates
 * Helpers: el(tag, attrs, children), icon, refreshIcons, toast,
 *          buildHeader, buildKpiStrip, statusPill, buildCard,
 *          emptyState, loadingBlock, formatDate.
 * ============================================================ */
(function (global) {
  "use strict";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "textContent") node.textContent = attrs[k];
        else if (k === "innerHTML") node.innerHTML = attrs[k];
        else if (k === "disabled" && attrs[k]) node.setAttribute("disabled", "disabled");
        else if (k === "selected" && attrs[k]) node.setAttribute("selected", "selected");
        else if (k === "checked" && attrs[k]) node.setAttribute("checked", "checked");
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === "dataset" && attrs.dataset) {
          Object.keys(attrs.dataset).forEach(function (d) { node.dataset[d] = attrs.dataset[d]; });
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      });
    }
    return node;
  }

  function icon(name, size) {
    var s = size || 16;
    return el("i", { "data-lucide": name, style: "width:" + s + "px;height:" + s + "px;display:inline-block;" });
  }

  function refreshIcons() {
    if (global.lucide && typeof global.lucide.createIcons === "function") {
      try { global.lucide.createIcons(); } catch (e) { /* ignore */ }
    }
  }

  function toast(title, msg, type) {
    var notifier = global.updateNotifier;
    if (notifier && typeof notifier.show === "function") {
      notifier.show({
        type: type || "info",
        title: String(title || ""),
        subtitle: msg ? String(msg) : "",
        autoClose: type === "error" ? 6000 : type === "warning" ? 4000 : 3500
      });
      return;
    }
    // 📦532 — Si en el futuro se quiere otro fallback de notificación,
    // agregar acá (ej: window.KAIRToast). Por ahora cae directo al toast
    // manual.
    var container = document.getElementById("kair-toasts");
    if (!container) return;
    var t = el("div", { className: "kair-toast kair-toast--" + (type || "info") }, [
      el("div", { className: "kair-toast__title", textContent: title }),
      msg ? el("div", { className: "kair-toast__msg", textContent: msg }) : null
    ]);
    container.appendChild(t);
    setTimeout(function () {
      t.style.transition = "opacity 200ms ease, transform 200ms ease";
      t.style.opacity = "0";
      t.style.transform = "translateX(20px)";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 220);
    }, 3200);
  }

  function buildHeader(opts) {
    opts = opts || {};

    var fragment = document.createDocumentFragment();

    /* Header premium v7: chip 44 + título Manrope 800 + migas + estado/acciones/volver */
    var header = el("header", { className: "kmi-header no-print" });
    var row = el("div", { className: "kmi-header__row" });

    var left = el("div", { className: "kmi-header__left" });
    left.appendChild(el("span", { className: "kmi-header__chip" }, [icon(opts.titleIcon || "clipboard-check", 22)]));

    var titles = el("div", { className: "kmi-header__titles" });
    titles.appendChild(el("h1", { className: "kmi-header__title", textContent: opts.title || "Inspecciones" }));

    var meta = el("div", { className: "kmi-header__meta" });
    var crumbs = el("nav", { className: "kmi-header__crumbs", "aria-label": "Miga de pan" });
    function addCrumb(label, onClick, current) {
      if (!label) return;
      if (crumbs.childNodes.length) {
        crumbs.appendChild(el("span", { className: "kmi-header__crumb-sep", "aria-hidden": "true" }, [icon("chevron-right", 12)]));
      }
      if (onClick && !current) {
        crumbs.appendChild(el("button", { type: "button", onclick: onClick, textContent: label }));
      } else {
        crumbs.appendChild(el("span", { className: current ? "kmi-header__crumb is-current" : "kmi-header__crumb", textContent: label }));
      }
    }

    addCrumb(opts.companyName || "Empresa");
    addCrumb(opts.parentLabel || "Gestión de Peligros", opts.onParentClick);
    if (opts.breadcrumb && opts.breadcrumb.length) {
      opts.breadcrumb.forEach(function (item, idx) {
        addCrumb(item.label, item.onClick, idx === opts.breadcrumb.length - 1);
      });
    } else {
      addCrumb(opts.activeLabel || "4.2.4 Inspecciones Sistemáticas", null, true);
    }
    meta.appendChild(crumbs);
    if (opts.subtitle) {
      meta.appendChild(el("span", { className: "kmi-header__subtitle", textContent: opts.subtitle }));
    }
    titles.appendChild(meta);
    left.appendChild(titles);
    row.appendChild(left);

    var right = el("div", { className: "kmi-header__right" });
    var syncLabel = opts.statusLabel || "Sincronizado";
    var syncIcon = opts.statusIcon || "check-circle-2";
    var syncClass = opts.statusClass || "k-sync-synced";
    right.appendChild(el("span", { className: "k-sync-badge " + syncClass }, [icon(syncIcon, 13), document.createTextNode(syncLabel)]));

    (opts.actions || []).slice(0, 3).forEach(function (a) {
      var btn = el("button", {
        type: "button",
        className: "k-btn k-btn-" + (a.variant || "primary") + " k-btn-sm",
        onclick: a.onClick,
        disabled: a.disabled || false
      });
      if (a.icon) btn.appendChild(a.icon);
      btn.appendChild(document.createTextNode(a.label));
      right.appendChild(btn);
    });

    if (opts.onBack) {
      right.appendChild(el("button", {
        type: "button",
        className: "kmi-header__back",
        title: opts.backTitle || "Volver",
        "aria-label": "Volver",
        onclick: opts.onBack
      }, [icon("arrow-left", 14), document.createTextNode("Volver")]));
    }
    row.appendChild(right);
    header.appendChild(row);
    fragment.appendChild(header);

    if (opts.tabs && opts.tabs.length) {
      var tabs = el("nav", { className: "kmi-tabs no-print", role: "tablist" });
      opts.tabs.forEach(function (t) {
        var tab = el("button", {
          type: "button",
          role: "tab",
          className: "kmi-tabs__tab" + (t.active ? " kmi-tabs__tab--active" : ""),
          onclick: t.onClick
        }, [document.createTextNode(t.label)]);
        if (typeof t.badge === "number") {
          tab.appendChild(el("span", { className: "kmi-tabs__badge", textContent: String(t.badge) }));
        }
        tabs.appendChild(tab);
      });
      fragment.appendChild(tabs);
    }

    return fragment;
  }

  var TONE_STYLES = {
    primary: { bg: "var(--kair-hover-soft)", fg: "var(--kair-primary)" },
    success: { bg: "rgba(40, 167, 69, 0.12)", fg: "var(--kair-success)" },
    warning: { bg: "rgba(255, 193, 7, 0.16)", fg: "var(--kair-warning-ink)" },
    danger:  { bg: "rgba(220, 53, 69, 0.12)", fg: "var(--kair-danger)" },
    info:    { bg: "var(--kair-muted-bg)", fg: "var(--kair-info-ink)" }
  };

  function buildKpiStrip(items) {
    var strip = el("div", { className: "kair-kpi-strip" });
    items.forEach(function (item, idx) {
      var tone = TONE_STYLES[item.tone] || TONE_STYLES.info;
      var kpi = el("div", { className: "kair-kpi-item" }, [
        el("span", {
          className: "kair-kpi-item__icon",
          style: "background-color:" + tone.bg + ";color:" + tone.fg + ";"
        }, [item.icon]),
        el("div", { className: "kair-kpi-item__body" }, [
          el("span", { className: "kair-kpi-item__value", textContent: String(item.value) }),
          el("span", { className: "kair-kpi-item__label", textContent: item.label }),
          item.subdata ? el("span", { className: "kair-kpi-item__subdata", textContent: item.subdata }) : null
        ])
      ]);
      strip.appendChild(kpi);
      if (idx < items.length - 1) {
        strip.appendChild(el("span", { className: "kair-kpi-divider" }));
      }
    });
    return strip;
  }

  var STATUS_CLASS = {
    "Sin Iniciar": "kair-status--sin-iniciar",
    "En Proceso": "kair-status--en-proceso",
    "Ejecutado": "kair-status--ejecutado",
    "Completada": "kair-status--completada",
    "Borrador": "kair-status--borrador",
    "Programada": "kair-status--programada",
    "Cumplida": "kair-status--cumplida",
    "Pendiente": "kair-status--pendiente",
    "Vencida": "kair-status--vencida"
  };

  function statusPill(status) {
    var cls = STATUS_CLASS[status] || "kair-status--sin-iniciar";
    return el("span", { className: "kair-status " + cls, textContent: status });
  }

  function buildCard(title, bodyContent, headerExtra) {
    var card = el("div", { className: "kair-card" });
    if (title || headerExtra) {
      var head = el("div", { className: "kair-card__header" }, [
        title ? el("h2", { className: "kair-card__title", textContent: title }) : null,
        headerExtra || null
      ]);
      card.appendChild(head);
    }
    var body = el("div", { className: "kair-card__body" });
    if (Array.isArray(bodyContent)) {
      bodyContent.forEach(function (c) { if (c) body.appendChild(c); });
    } else if (bodyContent) {
      body.appendChild(bodyContent);
    }
    card.appendChild(body);
    return card;
  }

  function emptyState(iconName, title, desc, actionBtn) {
    return el("div", { className: "kair-empty" }, [
      iconName ? el("div", {}, [icon(iconName, 32)]) : null,
      el("div", { className: "kair-empty__title", textContent: title }),
      desc ? el("div", { className: "kair-empty__desc", textContent: desc }) : null,
      actionBtn || null
    ]);
  }

  function loadingBlock(text) {
    return el("div", { className: "kair-loading" }, [
      el("span", { className: "kair-spinner" }),
      el("span", { textContent: text || "Cargando..." })
    ]);
  }

  function formatDate(d, opts) {
    try {
      var date = d;
      if (typeof d === "string") {
        /* Las fechas ISO sin hora ("2026-09-15") se parsean como UTC y en
           husos negativos (Colombia UTC-5) se muestran un día atrás.
           Se construye como fecha LOCAL para mostrar el día correcto. */
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
        date = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
      }
      if (isNaN(date.getTime())) return String(d);
      if (opts && opts.short) {
        return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
      }
      return date.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) { return String(d); }
  }

  global.KairTemplates = {
    el: el,
    icon: icon,
    refreshIcons: refreshIcons,
    toast: toast,
    buildHeader: buildHeader,
    buildKpiStrip: buildKpiStrip,
    statusPill: statusPill,
    buildCard: buildCard,
    emptyState: emptyState,
    loadingBlock: loadingBlock,
    formatDate: formatDate
  };
})(typeof window !== "undefined" ? window : this);