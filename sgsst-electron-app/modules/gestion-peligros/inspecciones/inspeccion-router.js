/* ============================================================
 * K+AIR · Inspecciones — Router (hash routing vanilla)
 * Parsea #/view/param1/param2 y mapea a vistas registradas.
 * Se expone en window.KairRouter
 * ============================================================ */
(function (global) {
  "use strict";

  var routes = new Map();
  var viewContainer = null;

  function register(name, handler) {
    routes.set(name, handler);
  }

  function parseHash() {
    var raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
    var parts = raw.split("/").filter(Boolean);
    return { name: parts[0] || "dashboard", params: parts.slice(1) };
  }

  function render() {
    if (!viewContainer) return;
    var parsed = parseHash();
    var handler = routes.get(parsed.name) || routes.get("dashboard");
    viewContainer.innerHTML = "";
    try {
      handler(viewContainer, parsed.params);
      if (global.KairTemplates) global.KairTemplates.refreshIcons();
    } catch (e) {
      console.error("[KairRouter] render error", e);
      viewContainer.innerHTML = '<div style="padding:24px;color:#dc3545;">Error renderizando vista: ' + (e.message || "desconocido") + "</div>";
    }
  }

  function start(container) {
    viewContainer = container || document.getElementById("kair-view-inspecciones");
    window.addEventListener("hashchange", render);
    render();
  }

  function navigate(hash) {
    if (location.hash === hash) {
      render();
    } else {
      location.hash = hash;
    }
  }

  global.KairRouter = {
    register: register,
    start: start,
    navigate: navigate,
    parseHash: parseHash,
    render: render
  };
})(typeof window !== "undefined" ? window : this);