/* ============================================================
 * K+AIR · Inspecciones — Store de estado UI (observer pattern)
 * Vanilla JS. Sin dependencias. Se expone en window.KairStore
 *
 * Estado:
 *   - view: { name, inspectionType?, inspectionId? }   ruta actual
 *   - companyId, companyName                            contexto empresa
 *   - program, inspections                              data en memoria
 * ============================================================ */
(function (global) {
  "use strict";

  var state = {
    view: { name: "dashboard" },
    companyId: "default",
    companyName: "K+AIR Demo S.A.S.",
    program: null,
    inspections: []
  };

  var listeners = new Set();

  function getState() {
    return state;
  }

  function setState(patch) {
    Object.assign(state, patch);
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { console.error("[KairStore] listener error", e); }
    });
  }

  function setView(view) {
    setState({ view: view });
    var hash = "#/" + view.name;
    if (view.name === "nueva" || view.name === "editar") {
      hash += "/" + view.inspectionType;
      if (view.name === "editar") hash += "/" + view.inspectionId;
    } else if (view.name === "detalle") {
      hash += "/" + view.inspectionId;
    }
    if (typeof location !== "undefined" && location.hash !== hash) {
      try { history.replaceState(null, "", hash); } catch (e) { /* file:// puede fallar */ }
    }
  }

  function setCompany(id, name) {
    setState({ companyId: id, companyName: name });
  }

  function setProgram(program) {
    setState({ program: program });
  }

  function setInspections(insps) {
    setState({ inspections: insps || [] });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return function () { listeners.delete(fn); };
  }

  global.KairStore = {
    getState: getState,
    setState: setState,
    setView: setView,
    setCompany: setCompany,
    setProgram: setProgram,
    setInspections: setInspections,
    subscribe: subscribe
  };
})(typeof window !== "undefined" ? window : this);