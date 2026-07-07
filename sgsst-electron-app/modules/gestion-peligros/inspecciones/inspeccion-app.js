/* ============================================================
 * K+AIR · Inspecciones — App controller (registra vistas y arranca)
 * Vanilla JS. Sin dependencias. Se expone en window.KairApp
 *
 * Vistas registradas:
 *   dashboard → KairViews.Dashboard
 *   hub       → KairViews.Hub
 *   historial → KairViews.Historial
 *   detalle   → KairViews.Detalle
 *   nueva/:type → KairViews.Form{...} según type (mode: nueva)
 *   editar/:type/:id → KairViews.Form{...} (mode: editar)
 * ============================================================ */
(function (global) {
  "use strict";

  function go(view) {
    var hash = "#/" + view.name;
    if (view.name === "nueva" || view.name === "editar") {
      hash += "/" + view.inspectionType;
      if (view.name === "editar") hash += "/" + view.inspectionId;
    } else if (view.name === "detalle") {
      hash += "/" + view.inspectionId;
    }
    if (global.KairStore) global.KairStore.setView(view);
    global.KairRouter.navigate(hash);
  }

  function init(container, options) {
    var appOptions = options || {};
    var Router = global.KairRouter;
    if (!Router || !global.KairViews) {
      console.error("[KairApp] Router o KairViews no disponibles");
      return;
    }

    function makeCtx(extra) {
      var ctx = { go: go };
      if (typeof appOptions.onExit === "function") ctx.backToModule = appOptions.onExit;
      if (extra) {
        Object.keys(extra).forEach(function (k) { ctx[k] = extra[k]; });
      }
      return ctx;
    }

    Router.register("dashboard", function (root) {
      global.KairViews.Dashboard(root, makeCtx());
    });
    Router.register("hub", function (root) {
      global.KairViews.Hub(root, makeCtx());
    });
    Router.register("historial", function (root) {
      global.KairViews.Historial(root, makeCtx());
    });
    Router.register("detalle", function (root, params) {
      global.KairViews.Detalle(root, makeCtx({ inspectionId: params[0] }));
    });
    Router.register("nueva", function (root, params) {
      var type = params[0];
      var V = global.KairViews;
      if (type === "botiquin") return V.FormBotiquin(root, makeCtx({ mode: "nueva" }));
      if (type === "extintores") return V.FormExtintores(root, makeCtx({ mode: "nueva" }));
      if (type === "instalaciones") return V.FormInstalaciones(root, makeCtx({ mode: "nueva" }));
      if (type === "equipos_emergencia") return V.FormEmergencia(root, makeCtx({ mode: "nueva" }));
      V.Hub(root, makeCtx());
    });
    Router.register("editar", function (root, params) {
      var type = params[0];
      var id = params[1];
      var V = global.KairViews;
      if (type === "botiquin") return V.FormBotiquin(root, makeCtx({ mode: "editar", inspectionId: id }));
      if (type === "extintores") return V.FormExtintores(root, makeCtx({ mode: "editar", inspectionId: id }));
      if (type === "instalaciones") return V.FormInstalaciones(root, makeCtx({ mode: "editar", inspectionId: id }));
      if (type === "equipos_emergencia") return V.FormEmergencia(root, makeCtx({ mode: "editar", inspectionId: id }));
      V.Hub(root, makeCtx());
    });

    Router.start(container);

    var env = (global.KairAPI && global.KairAPI.isElectron) ? "electron" : "browser";
    console.log("[K+AIRSST][APP][INIT][SUCCESS] entorno=" + env);
  }

  global.KairApp = { go: go, init: init };
})(typeof window !== "undefined" ? window : this);