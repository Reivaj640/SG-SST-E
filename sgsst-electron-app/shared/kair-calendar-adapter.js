/**
 * shared/kair-calendar-adapter.js
 *
 * Adapter SG-SST para el K+AIR Calendar Component.
 * Une las 7 fuentes de eventos que muestra el calendario:
 *   1. Plan de Trabajo Anual (electronAPI.planTrabajo.getEvents)
 *   2. Capacitaciones (electronAPI.capacitaciones.getEvents)
 *   3. Auditoría Anual — fases (electronAPI.auditoria.getFases)
 *   4. Eventos rápidos del usuario (electronAPI.eventosRapidos)
 *   5. Seguimientos de Gestación (electronAPI.gestaciones.getEvents) — 📦497
 *   6. Inspecciones planificadas del programa anual (electronAPI.inspeccionPrograma.getEventsCalendario) — 📦506
 *      → Por cada actividad con monthlySchedule[Mes]="p" genera 1 evento
 *        en uno de los primeros 5 días hábiles del mes (round-robin entre
 *        actividades del mes).
 *   7. Mantenimientos programados pendientes (electronAPI.mantenimiento.calendarioGetEvents) — 📦509
 *      → Por cada item con MPP marcado en un mes genera 1 evento en uno de
 *        los 10 días hábiles de las semanas 2 y 3 (round-robin). Solo MPP.
 *   8. Recordatorio Acta COPASST (electronAPI.recordatorios.copasstGetEvents) — 📦522
 *      → Genera 1 evento el dia 1 de cada mes del rango. Recordatorio LEGAL
 *        (Decreto 614/1984, Res. 0312/2019 estandar 1.1.6): "Realizar Acta del
 *        COPASST dentro de los primeros 5 dias habiles del mes". Global, no
 *        depende de empresa.
 *   9. Recordatorio Acta Comite de Convivencia (electronAPI.recordatorios.convivenciaGetEvents) — 📦523
 *      → Recordatorio TRIMESTRAL alineado con el ciclo de auto-llenado del
 *        acta: Feb(2), May(5), Ago(8), Nov(11) — 4 reuniones al año. Mismo
 *        patron de ajuste de fin de semana que COPASST (si día 1 cae sábado
 *        o domingo se mueve al lunes), color cyan #0891b2 para distinguirse
 *        del naranja COPASST. Refleja la configuracion del autofill en
 *        main.js (CONVIVENCIA_CYCLE_MONTHS), no el maximo legal mensual.
 *   10. Estados de cumplimiento (electronAPI.eventosCumplidos.listar) — 📦498
 *      → Enriquece cada evento con {cumplido:true/false, cumplidoEn:ISO}.
 *      → NO agrega eventos, solo decora los existentes.
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
 *     Los eventos de plan/cap/aud/gest/insp se editan en su módulo origen.
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

  /* Amplía el rango visible al año completo (enero-dic de cada año en el rango).
     Necesario para la fuente de inspecciones porque el KairCalendar no recarga
     eventos al navegar de mes (bug pre-existente). Si solo pasáramos el mes
     visible, el usuario no vería las inspecciones planificadas al navegar a
     otro mes. Pre-cargamos los 12 meses del año para que estén en memoria. */
  function _expandRangeToFullYear(range) {
    if (!range || !range.start || !range.end) return range;
    var startD = new Date(range.start + 'T00:00:00');
    var endD = new Date(range.end + 'T00:00:00');
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return range;
    var yStart = startD.getFullYear();
    var yEnd = endD.getFullYear();
    return { start: yStart + '-01-01', end: yEnd + '-12-31' };
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
    // 📦498 — Cumplimientos: por empresa, sin rango (es estado persistente)
    var cumPayload = { empresaId: currentCompany };
    // 📦506 — Inspecciones planificadas: por empresa + rango ampliado al año completo.
    // El handler genera 1 evento por actividad por mes (round-robin entre los
    // primeros 5 días hábiles). Ampliamos el rango a año completo para que el
    // KairCalendar tenga los eventos de todos los meses en memoria al navegar.
    var inspRange = _expandRangeToFullYear(range);
    var inspPayload = Object.assign({}, inspRange, { currentCompany: currentCompany });
    // 📦509 — Mantenimientos programados: misma lógica de rango anual. Solo MPP
    // (pendientes). Distribución en días hábiles de las semanas 2 y 3 del mes.
    var mantRange = _expandRangeToFullYear(range);
    var mantPayload = Object.assign({}, mantRange, { currentCompany: currentCompany });
    // 📦522 — Recordatorio COPASST: no necesita currentCompany (es global).
    // BUG-FIX: usar rango anual (mismo truco que inspecciones/mantenimientos)
    // porque el KairCalendar NO recarga eventos al navegar de mes — si pasáramos
    // solo el mes visible, los recordatorios de los otros 11 meses desaparecerían
    // al navegar (el usuario abria el calendario en Julio y no veia los eventos
    // de Enero-Junio). Ampliamos a año completo para que esten en memoria.
    var recRange = _expandRangeToFullYear(range);
    var copasstPayload = Object.assign({}, recRange);
    // 📦523 — Recordatorio Convivencia: idem. Comparte el mismo rango anual.
    var convivenciaPayload = Object.assign({}, recRange);
    var results = await Promise.all([
      _safe(function () { return api.planTrabajo && api.planTrabajo.getEvents(range); }),
      _safe(function () { return api.capacitaciones && api.capacitaciones.getEvents(capPayload); }),
      _safe(function () { return api.auditoria && api.auditoria.getFases(range); }),
      _safe(function () { return api.eventosRapidos && api.eventosRapidos.list(range); }),
      _safe(function () { return api.gestaciones && api.gestaciones.getEvents(gestPayload); }),
      // 📦506 — Inspecciones planificadas del programa anual
      _safe(function () {
        return api.inspeccionPrograma && api.inspeccionPrograma.getEventsCalendario
          ? api.inspeccionPrograma.getEventsCalendario(inspPayload)
          : { success: true, data: [] };
      }),
      // 📦509 — Mantenimientos programados pendientes del cronograma anual
      _safe(function () {
        return api.mantenimiento && api.mantenimiento.calendarioGetEvents
          ? api.mantenimiento.calendarioGetEvents(mantPayload)
          : { success: true, data: [] };
      }),
      // 📦522 — Recordatorio mensual "Acta del COPASST" (1 evento por mes, dia 1).
      // No falla si la API no esta expuesta: devuelve [] silenciosamente para no
      // romper el calendario en builds donde aun no se actualizo preload.js.
      _safe(function () {
        return api.recordatorios && api.recordatorios.copasstGetEvents
          ? api.recordatorios.copasstGetEvents(copasstPayload)
          : { success: true, data: [] };
      }),
      // 📦523 — Recordatorio mensual "Acta del Comite de Convivencia" (mismo patron).
      _safe(function () {
        return api.recordatorios && api.recordatorios.convivenciaGetEvents
          ? api.recordatorios.convivenciaGetEvents(convivenciaPayload)
          : { success: true, data: [] };
      }),
      // 📦498 — Esta fuente NO devuelve eventos: devuelve Map de cumplidos
      _safe(function () { return api.eventosCumplidos && api.eventosCumplidos.listar(cumPayload); })
    ]);
    // El último resultado (cumPayload) NO son eventos sino estados de cumplimiento.
    // Lo separamos para enriquecer los eventos en lugar de mergearlos.
    var cumplidosResult = results[results.length - 1];
    var cumplidosMap = {};
    if (cumplidosResult && cumplidosResult.success && Array.isArray(cumplidosResult.data)) {
      cumplidosResult.data.forEach(function (c) {
        cumplidosMap[c.evento_id] = { cumplidoEn: c.cumplido_en, nota: c.nota || '' };
      });
    }
    var eventsResults = results.slice(0, results.length - 1);
    var merged = [];
    for (var i = 0; i < eventsResults.length; i++) {
      var r = eventsResults[i];
      if (r && r.success && Array.isArray(r.data)) {
        for (var j = 0; j < r.data.length; j++) {
          var ev = r.data[j];
          // 📦498 — Enriquecer con estado de cumplimiento
          if (ev && ev.id && cumplidosMap[ev.id]) {
            ev.cumplido = true;
            ev.cumplidoEn = cumplidosMap[ev.id].cumplidoEn;
            ev.cumplidoNota = cumplidosMap[ev.id].nota;
          }
          merged.push(ev);
        }
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
    version: '1.2.0'
  };
})(typeof window !== 'undefined' ? window : this);