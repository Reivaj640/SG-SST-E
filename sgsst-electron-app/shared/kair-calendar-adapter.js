/**
 * shared/kair-calendar-adapter.js
 *
 * Adapter SG-SST para el K+AIR Calendar Component.
 * Une las 5 fuentes de eventos que muestra el calendario:
 *   1. Plan de Trabajo Anual (electronAPI.planTrabajo.getEvents)
 *   2. Capacitaciones (electronAPI.capacitaciones.getEvents)
 *   3. Auditoría Anual — fases (electronAPI.auditoria.getFases)
 *   4. Eventos rápidos del usuario (electronAPI.eventosRapidos)
 *   5. Seguimientos de Gestación (electronAPI.gestaciones.getEvents) — 📦497
 *
 * Contrato implementado (consumido por KairCalendar):
 *   list(range)   -> { success, data: [...] }  (data = array unificado de eventos)
 *   create(ev)    -> { success, data } | error
 *   update(ev)    -> { success, data } | error
 *   remove(id)    -> { success, data } | error
 *
 * Notas:
 *   - Si una fuente falla (ej: Excel del plan no se puede leer), se loggea y se devuelve
 *     array vacío para esa fuente. Las demás siguen funcionando (degradación elegante).
 *   - Solo eventos con type='rapido' se pueden crear/editar/eliminar desde el calendario.
 *     Los eventos de plan/cap/aud/gest se editan en su módulo origen.
 */

(function (global) {
  'use strict';

  function _warn(tag, msg) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[KairCalendarAdapter][' + tag + '] ' + msg);
    }
  }

  function _safe(fn, fallback) {
    return fn().catch(function (e) {
      _warn('SOURCE_FAIL', (e && e.message) || String(e));
      return { success: false, data: fallback || [] };
    });
  }

  // ── list ──────────────────────────────────────────────────────────────
  // range = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  async function list(range) {
    var api = (global.electronAPI) || {};
    var currentCompany = (global.currentCompany && global.currentCompany !== 'default_company')
      ? global.currentCompany
      : null;
    // 📦495 — Pasar currentCompany al backend de capacitaciones para que sepa
    // cuál Excel leer (el calendario es global pero las capacitaciones son
    // por empresa).
    var capPayload = Object.assign({}, range || {}, { currentCompany: currentCompany });
    // 📦497 — Pasar currentCompany al backend de gestaciones (BD por empresa).
    var gestPayload = Object.assign({}, range || {}, { currentCompany: currentCompany });
    var results = await Promise.all([
      _safe(function () { return api.planTrabajo && api.planTrabajo.getEvents(range); }),
      _safe(function () { return api.capacitaciones && api.capacitaciones.getEvents(capPayload); }),
      _safe(function () { return api.auditoria && api.auditoria.getFases(range); }),
      _safe(function () { return api.eventosRapidos && api.eventosRapidos.list(range); }),
      _safe(function () { return api.gestaciones && api.gestaciones.getEvents(gestPayload); })
    ]);
    var merged = [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      if (r && r.success && Array.isArray(r.data)) {
        for (var j = 0; j < r.data.length; j++) merged.push(r.data[j]);
      }
    }
    return { success: true, data: merged };
  }

  // ── create ───────────────────────────────────────────────────────────
  // Solo type === 'rapido' se persiste. Otros se rechazan con error claro.
  async function create(ev) {
    var api = global.electronAPI;
    if (!api || !api.eventosRapidos) {
      return { success: false, error: { message: 'eventosRapidos no disponible en electronAPI' } };
    }
    if (!ev || ev.type !== 'rapido') {
      return {
        success: false,
        error: { message: 'Solo se pueden crear eventos rápidos desde el calendario. Los demás se editan en su módulo origen.' }
      };
    }
    return api.eventosRapidos.create(ev);
  }

  // ── update ───────────────────────────────────────────────────────────
  async function update(ev) {
    var api = global.electronAPI;
    if (!api || !api.eventosRapidos) {
      return { success: false, error: { message: 'eventosRapidos no disponible' } };
    }
    if (!ev || !ev.id || String(ev.id).indexOf('rapido-') !== 0) {
      return {
        success: false,
        error: { message: 'Solo se pueden editar eventos rápidos desde el calendario.' }
      };
    }
    return api.eventosRapidos.update(ev);
  }

  // ── remove ───────────────────────────────────────────────────────────
  async function remove(id) {
    var api = global.electronAPI;
    if (!api || !api.eventosRapidos) {
      return { success: false, error: { message: 'eventosRapidos no disponible' } };
    }
    if (!id || String(id).indexOf('rapido-') !== 0) {
      return {
        success: false,
        error: { message: 'Solo se pueden eliminar eventos rápidos desde el calendario.' }
      };
    }
    return api.eventosRapidos.remove(id);
  }

  global.KairCalendarAdapter = {
    list: list,
    create: create,
    update: update,
    remove: remove,
    version: '1.1.0'
  };
})(typeof window !== 'undefined' ? window : this);