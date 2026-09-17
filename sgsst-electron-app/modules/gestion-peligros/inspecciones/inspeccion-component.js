/* ==========================================================================
 * K+AIR — Módulo 4.2.4 Inspecciones Sistemáticas (NUEVO)
 * Componente principal — Vanilla JS, renderiza dentro del container.
 *
 * Firma compatible con renderer.js:4457:
 *   new InspeccionComponent(container, currentCompany, moduleName,
 *                           submoduleTitle, backToModuleCallback)
 *
 * Internamente monta <div id="kair-app-inspecciones"> con #kair-view-inspecciones
 * y <div id="kair-toasts">, carga CSS si hace falta, setea el store con la
 * company actual, y arranca KairApp.init(viewContainer).
 *
 * Patrón: Type C — header v2.0 + router hash interno.
 * ========================================================================== */
(function () {
  "use strict";

  var _cssLoaded = false;

  function _loadCss(cb) {
    if (_cssLoaded) { cb(); return; }
    var href = "modules/gestion-peligros/inspecciones/inspeccion.css";
    var existing = document.querySelector('link[href="' + href + '"]');
    if (existing) { _cssLoaded = true; cb(); return; }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = function () { _cssLoaded = true; cb(); };
    link.onerror = function () { _cssLoaded = true; cb(); };
    document.head.appendChild(link);
  }

  function InspeccionComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
    this.container = container;
    this.currentCompany = currentCompany || "default";
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.backToModuleCallback = typeof backToModuleCallback === "function" ? backToModuleCallback : null;
    this.viewContainer = null;
  }

  InspeccionComponent.prototype.render = function () {
    var self = this;
    this.container.innerHTML = "";
    _loadCss(function () { self._mount(); });
  };

  InspeccionComponent.prototype._mount = function () {
    var self = this;

    // Wrapper principal: app + view + toasts
    var wrap = document.createElement("div");
    wrap.className = "kair-app-inspecciones";
    wrap.style.cssText = "display:flex;flex-direction:column;min-height:100vh;";

    var view = document.createElement("div");
    view.id = "kair-view-inspecciones";
    view.style.cssText = "flex:1 1 auto;display:flex;flex-direction:column;";

    var toasts = document.createElement("div");
    toasts.id = "kair-toasts";
    toasts.className = "kair-toast-container";
    toasts.setAttribute("aria-live", "polite");

    wrap.appendChild(view);
    wrap.appendChild(toasts);
    this.container.appendChild(wrap);
    this.viewContainer = view;

    // Sincronizar company con el store
    if (window.KairStore) {
      var companyName = (this.currentCompany && this.currentCompany !== "default_company")
        ? this.currentCompany
        : "K+AIR Demo S.A.S.";
      window.KairStore.setCompany(this.currentCompany || "default", companyName);
    }

    // Arrancar la app del módulo
    if (window.KairApp && typeof window.KairApp.init === "function") {
      window.KairApp.init(this.viewContainer, { onExit: this.backToModuleCallback });
    } else {
      console.error("[InspeccionComponent] KairApp no disponible");
    }

    // BackToModule: se pasa al app controller para que el dashboard pueda
    // volver al módulo padre (Gestión de Peligros) usando el header estándar.
    this._backCallback = this.backToModuleCallback;
  };

  InspeccionComponent.prototype.destroy = function () {
    if (this.viewContainer) {
      try {
        // Limpia el router (remueve listener hashchange)
        if (window.KairRouter && typeof window.KairRouter._cleanup === "function") {
          window.KairRouter._cleanup();
        }
      } catch (e) { /* ignore */ }
    }
    if (this.container) this.container.innerHTML = "";
  };

  // Compatibilidad con window.InspeccionesComponent (alias del módulo viejo)
  window.InspeccionComponent = InspeccionComponent;
  window.InspeccionesComponent = InspeccionComponent; // backward-compat con renderer.js:4458
})();