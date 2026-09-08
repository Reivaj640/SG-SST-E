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
 *   10. Recordatorio Actualizacion de Presupuesto (electronAPI.recordatorios.presupuestoGetEvents) — 📦524
 *      → Recordatorio OPERATIVO con 2 eventos por mes: dia 5 (cierre de los
 *        "5 primeros dias") y dia 20 (cierre de los "20 primeros dias").
 *        Mismo patron de ajuste de fin de semana que COPASST/Convivencia
 *        (sabado/domingo se mueve al lunes). Color emerald #10b981 (verde
 *        monetario) para distinguirse del naranja COPASST y cyan Convivencia.
 *        24 eventos por anio (2/mes x 12).
 *   11. Recordatorio Afiliacion al SSSI (electronAPI.recordatorios.afiliacionGetEvents) — 📦525
 *      → Recordatorio LEGAL-OPERATIVO con 1 evento por mes: dia 10 (cierre
 *        de los "10 primeros dias" para reportar novedades de personal al
 *        Sistema de Seguridad Social Integral — EPS/AFP/ARL). Mismo patron
 *        de ajuste de fin de semana (sabado/domingo se mueve al lunes). Color
 *        amber #f59e0b para distinguirse del resto. 12 eventos por anio (1/mes).
 *        Base legal: Ley 100/1993, Decreto 1295/1994, Decreto 806/1998 art. 16.
 *   12. Recordatorio Actualizacion Inducciones (electronAPI.recordatorios.induccionesGetEvents) — 📦525
 *      → Recordatorio LEGAL-OPERATIVO con 1 evento por mes: dia 2 (cierre de
 *        los "2 primeros dias" para actualizar el registro de inducciones del
 *        mes anterior). Mismo patron de ajuste de fin de semana. Color indigo
 *        #6366f1 para distinguirse del resto. 12 eventos por anio (1/mes).
 *        Base legal: Decreto 1072/2015 art. 2.2.4.6.11 (induccion obligatoria
 *        antes de iniciar tareas).
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
    // F2 — Defensivo: si fn() lanza síncronamente o retorna algo que no es
    // Promise (incluido undefined cuando una API no existe), devolver un
    // resultado neutro sin romper el .list() completo. Esto permite usar el
    // adapter desde iframes donde algunas APIs de electronAPI no están
    // expuestas via contextBridge (ejecutándose en renderer padre via
    // window.parent.electronAPI). Antes, un undefined.fn() lanzaba
    // "Cannot read properties of undefined (reading 'catch')".
    var p;
    try { p = fn(); }
    catch (syncErr) {
      _warn('SOURCE_SYNC_FAIL', (syncErr && syncErr.message) || String(syncErr));
      return Promise.resolve({ success: false, data: fallback || [] });
    }
    if (p && typeof p.then === 'function') {
      return p.catch(function (e) {
        _warn('SOURCE_FAIL', (e && e.message) || String(e));
        return { success: false, data: fallback || [] };
      });
    }
    return Promise.resolve({ success: false, data: fallback || [] });
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
  // range = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', scope: 'company' | 'all' }
  // scope (📦543):
  //   - 'company' (default): fuentes por empresa reciben currentCompany = empresa actual
  //   - 'all'               : fuentes por empresa reciben currentCompany = null
  //                          y devuelven eventos de TODAS las empresas
  async function list(range) {
    // F2 — Fallback a window.parent.electronAPI para que el adapter funcione
    // dentro de iframes de Bandeja Integrada. El contextBridge de Electron
    // no se hereda automáticamente a iframes, pero el renderer padre sí lo
    // tiene y es accesible via window.parent (mismo origen = permitido).
    var api = (global.electronAPI)
      || (global.parent && global.parent.electronAPI)
      || {};
    // F2 — currentCompany también puede vivir solo en el renderer padre.
    // Sin esto, el iframe no sabe qué empresa está activa y las fuentes
    // por empresa devuelven array vacío.
    var currentCompany = (global.currentCompany && global.currentCompany !== 'default_company')
      ? global.currentCompany
      : (global.parent && global.parent.currentCompany && global.parent.currentCompany !== 'default_company'
          ? global.parent.currentCompany
          : null);
    // 📦543 — Si el scope es 'all', pasar null a las fuentes por empresa para
    // que el backend devuelva eventos de TODAS las empresas. Las fuentes
    // globales (recordatorios, plan de trabajo) siempre se incluyen.
    var scope = (range && range.scope) || 'company';
    // P0-CRO-1 fix — Si el scope es 'company' pero no hay empresa activa
    // (currentCompany es null/'default_company'), el código antiguo pasaba
    // null al backend, que por el soporte de scope='all' (📦543) devolvía
    // eventos de TODAS las empresas → el switch "Todas las empresas" se
    // volvía un no-op silencioso. Ahora devolvemos [] y loggeamos warning
    // para que sea explícito. La UI muestra el toast "Mostrando solo la
    // empresa actual" sin tener empresa real, lo cual es confuso.
    if (scope === 'company' && !currentCompany) {
      _warn('SCOPE_NO_COMPANY', 'scope=company pero currentCompany es null. Devolviendo [] (no hay empresa activa, no se puede filtrar).');
      return { success: true, data: [] };
    }
    var companyForBackend = (scope === 'all') ? null : currentCompany;
    // 📦495 — Pasar currentCompany al backend de capacitaciones para que sepa
    // cuál Excel leer (el calendario es global pero las capacitaciones son
    // por empresa).
    var capPayload = Object.assign({}, range || {}, { currentCompany: companyForBackend });
    // 📦 Fase 2 — Sidecar del mapa de horas persistido en localStorage.
    // El componente CapacitacionesComponent mantiene `window.kairCapHoras`
    // (espejo de su `_horas`) y el adapter lo inyecta en cada llamada para
    // que el backend `_leerCapacitacionesDeEmpresa` pueda aplicar la hora
    // a cada evento antes de devolverlo. Si no hay horas, `horas: {}` y
    // el backend mantiene el comportamiento default (start: null).
    //
    // 🐛bug-fix — CapacitacionesComponent corre dentro de un IFRAME, así que
    // `window.kairCapHoras` que setea está en el window del iframe, NO en el
    // window del renderer padre donde corre este adapter. Por eso usamos
    // localStorage como fuente de verdad (mismo origen → compartido entre
    // iframe y parent). También intentamos `window.kairCapHoras` por si el
    // adapter se ejecuta dentro del mismo window que el componente.
    var horasSidecar = {};
    try {
      if (typeof window !== 'undefined' && window.kairCapHoras
          && typeof window.kairCapHoras === 'object'
          && Object.keys(window.kairCapHoras).length > 0) {
        horasSidecar = window.kairCapHoras;
      } else {
        // Fallback: leer directo de localStorage (compartido iframe ↔ parent)
        var _stored = localStorage.getItem('kair-cap-horas');
        if (_stored) {
          var _parsed = JSON.parse(_stored);
          if (_parsed && typeof _parsed === 'object') horasSidecar = _parsed;
        }
      }
    } catch (e) { /* silent: sidecar vacío mantiene compatibilidad */ }
    capPayload.horas = horasSidecar;
    // 📦497 — Pasar currentCompany al backend de gestaciones (BD por empresa).
    var gestPayload = Object.assign({}, range || {}, { currentCompany: companyForBackend });
    // 📦498 — Cumplimientos: por empresa, sin rango (es estado persistente)
    var cumPayload = { empresaId: companyForBackend };
    // 📦506 — Inspecciones planificadas: por empresa + rango ampliado al año completo.
    // El handler genera 1 evento por actividad por mes (round-robin entre los
    // primeros 5 días hábiles). Ampliamos el rango a año completo para que el
    // KairCalendar tenga los eventos de todos los meses en memoria al navegar.
    var inspRange = _expandRangeToFullYear(range);
    var inspPayload = Object.assign({}, inspRange, { currentCompany: companyForBackend });
    // 📦509 — Mantenimientos programados: misma lógica de rango anual. Solo MPP
    // (pendientes). Distribución en días hábiles de las semanas 2 y 3 del mes.
    var mantRange = _expandRangeToFullYear(range);
    var mantPayload = Object.assign({}, mantRange, { currentCompany: companyForBackend });
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
    // 📦524 — Recordatorio Presupuesto: idem. Comparte el mismo rango anual.
    var presupuestoPayload = Object.assign({}, recRange);
    // 📦525 — Recordatorio Afiliacion: idem. Comparte el mismo rango anual.
    var afiliacionPayload = Object.assign({}, recRange);
    // 📦525 — Recordatorio Inducciones: idem. Comparte el mismo rango anual.
    var induccionesPayload = Object.assign({}, recRange);
    // P0-FILTER-2 (2026-09-07) — Payload de eventos rápidos con currentCompany.
    // ANTES: pasaba solo `range` al bridge → el handler no sabía qué empresa
    // filtrar y devolvía TODOS los eventos rápidos (bug del switch).
    // AHORA: pasamos currentCompany para que el bridge filtre correctamente.
    var rapidosPayload = Object.assign({}, range || {}, { currentCompany: companyForBackend });
    var results = await Promise.all([
      _safe(function () { return api.planTrabajo && api.planTrabajo.getEvents(range); }),
      _safe(function () { return api.capacitaciones && api.capacitaciones.getEvents(capPayload); }),
      _safe(function () { return api.auditoria && api.auditoria.getFases(range); }),
      // P0-FILTER-2 — Ahora pasa currentCompany al handler de eventos rápidos.
      _safe(function () { return api.eventosRapidos && api.eventosRapidos.list(rapidosPayload); }),
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
      // 📦524 — Recordatorio "Actualizacion de Presupuesto" (2 eventos por mes:
      // dia 5 y dia 20, ajustados al lunes si caen en fin de semana). Operativo,
      // no legal. Comparte el rango anual con COPASST/Convivencia.
      _safe(function () {
        return api.recordatorios && api.recordatorios.presupuestoGetEvents
          ? api.recordatorios.presupuestoGetEvents(presupuestoPayload)
          : { success: true, data: [] };
      }),
      // 📦525 — Recordatorio "Afiliacion al SSSI" (1 evento por mes: dia 10,
      // ajustado al lunes si cae en fin de semana). Legal-operativo. Comparte
      // el rango anual con el resto de recordatorios.
      _safe(function () {
        return api.recordatorios && api.recordatorios.afiliacionGetEvents
          ? api.recordatorios.afiliacionGetEvents(afiliacionPayload)
          : { success: true, data: [] };
      }),
      // 📦525 — Recordatorio "Actualizacion de Inducciones" (1 evento por mes:
      // dia 2, ajustado al lunes si cae en fin de semana). Legal-operativo.
      // Comparte el rango anual con el resto de recordatorios.
      _safe(function () {
        return api.recordatorios && api.recordatorios.induccionesGetEvents
          ? api.recordatorios.induccionesGetEvents(induccionesPayload)
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
    // 📦702-fix4 (2026-08-13) — Exponer el cumMap en la respuesta para que
    // loadEventsFromIPC pueda enriquecer los eventos de Google Calendar que
    // se cargan DESPUÉS via loadEventsFromGoogle. El adapter SÍ tiene el cumMap
    // correcto (filtrado por empresaId), pero los gcalEvents que llegan
    // aparte del adapter NO se enriquecen → el renderBigCalendar los muestra
    // sin ✓. Ahora loadEventsFromIPC usa result.cumMap para enriquecer esos
    // eventos antes de concatenarlos.
    //
    // Compatibilidad: si un caller no necesita el cumMap, simplemente ignora
    // el campo nuevo. No rompe nada.
    return { success: true, data: merged, cumMap: cumplidosMap };
  }

  // 📦646 (2026-08-03) — Fix iframe: el adapter ahora se usa desde la Bandeja
  // Integrada (un iframe sin preload propio). `global.electronAPI` es `undefined`
  // dentro del iframe, pero `global.parent.electronAPI` SÍ está disponible
  // (el renderer padre tiene el preload). El mismo fallback que ya existía en
  // `list()` ahora se aplica a create/update/remove.
  function getApi() {
    return (global.electronAPI)
      || (global.parent && global.parent.electronAPI)
      || {};
  }

  // ── create ───────────────────────────────────────────────────────────
  // Solo type === 'rapido' se persiste. Otros se rechazan con error claro.
  async function create(ev) {
    var api = getApi();
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
    var api = getApi();
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
    var api = getApi();
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
    version: '1.3.0'
  };
})(typeof window !== 'undefined' ? window : this);