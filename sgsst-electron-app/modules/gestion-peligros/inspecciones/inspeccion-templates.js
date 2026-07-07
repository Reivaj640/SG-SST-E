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
    var sileo = global.Sileo;
    if (sileo && typeof sileo[type || "info"] === "function") {
      sileo[type || "info"]({ title: String(title || ""), description: msg ? String(msg) : "" });
      return;
    }
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

    var header = el("header", { className: "k-module-header no-print" });

    var left = el("div", { className: "k-header-left" });
    var titleGroup = el("div", { className: "k-header-title-group" });

    var mainTitle = el("div", { className: "k-header-main-title" });
    mainTitle.appendChild(icon(opts.titleIcon || "clipboard-check", 18));
    mainTitle.appendChild(document.createTextNode(opts.title || "Inspecciones"));
    titleGroup.appendChild(mainTitle);

    var breadcrumb = el("div", { className: "k-header-breadcrumb" });
    function addCrumb(label, onClick, current) {
      if (!label) return;
      if (breadcrumb.childNodes.length) {
        breadcrumb.appendChild(el("i", { className: "bi bi-chevron-right", "aria-hidden": "true" }));
      }
      if (onClick && !current) {
        breadcrumb.appendChild(el("button", { type: "button", onclick: onClick, textContent: label }));
      } else {
        breadcrumb.appendChild(el("span", { className: current ? "k-breadcrumb-item active" : "", textContent: label }));
      }
    }

    addCrumb(opts.companyName || "Empresa");
    addCrumb(opts.parentLabel || "Gestión de Peligros", opts.onParentClick);
    if (opts.breadcrumb && opts.breadcrumb.length) {
      opts.breadcrumb.forEach(function (item, idx) {
        addCrumb(item.label, item.onClick, idx === opts.breadcrumb.length - 1);
      });
    } else {
      addCrumb(opts.activeLabel || opts.sectionPill || "4.2.4 Inspecciones Sistemáticas", null, true);
    }
    titleGroup.appendChild(breadcrumb);
    left.appendChild(titleGroup);
    header.appendChild(left);

    var right = el("div", { className: "k-header-right" });
    var syncLabel = opts.statusLabel || "Sincronizado";
    var syncIcon = opts.statusIcon || "bi-check-circle-fill";
    var syncClass = opts.statusClass || "k-sync-synced";
    right.appendChild(el("span", { className: "k-sync-badge " + syncClass }, [
      el("i", { className: "bi " + syncIcon, "aria-hidden": "true" }),
      document.createTextNode(" " + syncLabel)
    ]));

    if (opts.onBack) {
      right.appendChild(el("button", {
        type: "button",
        className: "header-back-btn",
        title: opts.backTitle || "Volver",
        "aria-label": "Volver",
        onclick: opts.onBack
      }, [
        el("i", { className: "bi bi-arrow-left", "aria-hidden": "true" }),
        document.createTextNode("Volver")
      ]));
    }

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
    header.appendChild(right);

    var fragment = document.createDocumentFragment();
    fragment.appendChild(header);

    if (opts.tabs && opts.tabs.length) {
      var tabs = el("nav", { className: "kair-insp-tabs no-print", role: "tablist" });
      opts.tabs.forEach(function (t) {
        var tab = el("button", {
          type: "button",
          className: "kair-insp-tab " + (t.active ? "kair-insp-tab--active" : ""),
          onclick: t.onClick
        }, [document.createTextNode(t.label)]);
        if (typeof t.badge === "number") {
          tab.appendChild(el("span", { className: "kair-insp-tab__badge", textContent: String(t.badge) }));
        }
        tabs.appendChild(tab);
      });
      fragment.appendChild(tabs);
    }

    return fragment;
  }

  var TONE_STYLES = {
    primary: { bg: "#e8f0fe", fg: "#174ea6" },
    success: { bg: "#d4edda", fg: "#155724" },
    warning: { bg: "#fff3cd", fg: "#856404" },
    danger:  { bg: "#f8d7da", fg: "#721c24" },
    info:    { bg: "#e2e3e5", fg: "#495057" }
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
      var date = typeof d === "string" ? new Date(d) : d;
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