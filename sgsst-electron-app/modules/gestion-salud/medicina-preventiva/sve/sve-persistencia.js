/* ============================================================
 * K+AIR · SVE — Capa de persistencia (📦827)
 *
 * ÚNICO punto del prototipo SVE que sabe que existe una base de datos.
 * `sve-app.js` (el store) y `sve-views.js` (1.300 líneas de vistas) no lo
 * saben: el store hidrata desde acá y escribe a través, y las vistas ni se
 * enteran. Si mañana el SVE se muda a otro almacén, se cambia este archivo.
 *
 * Por qué existía antes un localStorage (hasta 📦826):
 *   Los casos de seguimiento, el plan PHVA y los indicadores vivían en
 *   localStorage del renderer. Eso está DENTRO de la app y de ESA PC: fuera
 *   del archivo .kairsync, así que no viajaba entre máquinas, no se
 *   respaldaba y se perdía al reinstalar.
 *
 * Tres modos, y solo uno usa la base:
 *   1.hay puente + programa    -> SQLite (kair.db, viaja en .kairsync)
 *   2.no hay puente            -> localStorage (prototipo suelto en el
 *                                 navegador, o vista sin el preload)
 *   3.hay puente + error duro  -> se muestra el error y NO se escribe en
 *                                 ningún lado. Caer al localStorage acá
 *                                 sería peor que no mostrar nada: el
 *                                 usuario capturaría datos que después no
 *                                 se sincronizan y no se enteran.
 *
 * 📦827 — Ids de TEXTO ('msc-…', 'act-N'): con varias máquinas y merge
 * last-write-wins POR ID, dos PCs que crearan el caso 25 se pisarían en
 * silencio. El prototipo usaba enteros (maxId + 1).
 * ============================================================ */
(function (global) {
  "use strict";

  var MOD = '[SVE][SQLITE]';

  /* ---------- contexto de la sesión ---------- */
  var _ctx = null;   // { api, token, empresa, programaId }

  /* Los iframes sandbox no heredan el preload: mismo patrón que el host
     (medicina-preventiva-programa.js `_pgApi`) y que la bandeja integrada. */
  function _api() {
    return global.electronAPI || (global.parent && global.parent.electronAPI) || null;
  }

  function _token() {
    try { return global.localStorage.getItem('kair-auth-token') || ''; } catch (e) { return ''; }
  }

  /* El prototipo SVE se inyecta DENTRO del iframe del programa, no en un
     iframe propio: la empresa y el programa viajan en el query de ESE
     iframe, que arma medicina-preventiva-logic.js. */
  function _queryParam(nombre) {
    try {
      var q = (global.location && global.location.search) || '';
      var m = new RegExp('[?&]' + nombre + '=([^&#]*)').exec(q);
      if (!m) return '';
      return decodeURIComponent(String(m[1]).replace(/\+/g, ' ')).trim();
    } catch (e) { return ''; }
  }

  function _log(nivel, msg, extra) {
    var fn = nivel === 'error' ? console.error : (nivel === 'warn' ? console.warn : console.log);
    try { fn.call(console, MOD + '[' + nivel + '] ' + msg, extra === undefined ? '' : extra); } catch (e) { /* noop */ }
  }

  /* Los 13 canales. Si falta uno, esta vista no puede hablar con la base:
     se avisa y se degrada a localStorage en vez de fallar a medias. */
  var _CANALES = [
    'medprevSveDatosGet', 'medprevSveCasosCrear', 'medprevSveCasosActualizar',
    'medprevSveCasosEliminar', 'medprevSvePlanActividadCrear', 'medprevSvePlanActividadGuardar',
    'medprevSvePlanActividadEliminar', 'medprevSvePlanCeldaGuardar', 'medprevSveMetaGuardar',
    'medprevSveIndicadoresGuardar', 'medprevSveMorbilidadGuardar', 'medprevSveAnalisisGuardar',
    'medprevSveMigrar'
  ];

  /* ---------- id de texto ---------- */
  /* Mismo formato que el bridge. El renderer propone el id y lo necesita en el
     MISMO tick (las vistas son sincrónicas: `addSeguimiento` devuelve el id y
     la vista navega a `#/caso/<id>` sin esperar respuesta). El bridge valida
     que esté libre y, ante una colisión improbable, deriva otro y lo devuelve:
     el store lo reconcilia. */
  function nuevoId(prefijo) {
    return prefijo + '-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }

  /* ---------- cola: las escrituras van en orden ---------- */
  /* Sin esto, marcar dos celdas seguidas del mismo plan podría llegar en el
     orden inverso al que se hicieron y dejar guardada la anterior. */
  var _cola = Promise.resolve();
  function _encolar(fn) {
    _cola = _cola.then(function () { return fn(); }, function () { return fn(); });
    return _cola;
  }

  function _payload(extra) {
    var p = {
      companyName: _ctx.empresa,
      programaId: _ctx.programaId,
      token: _token()
    };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  /* Normaliza la respuesta del bridge. El bridge SIEMPRE devuelve
     { success: true, data } o { success: false, error: { code, message } }:
     nunca lanza. Un throw real (puente caído, base bloqueada) se cuela por
     acá y se marca como 'puente' para que el store sepa que es transitorio. */
  function _normalizar(r) {
    if (!r || r.success !== true) {
      var e = (r && r.error) || {};
      return {
        ok: false,
        code: e.code || 'DESCONOCIDO',
        mensaje: e.message || 'Respuesta inválida del puente de datos SVE',
        recuperable: false
      };
    }
    return { ok: true, data: r.data || {} };
  }

  function _invocar(canal, extra) {
    if (!_ctx) return Promise.resolve({ ok: false, code: 'SIN_CONTEXTO', mensaje: 'Sin contexto de persistencia', recuperable: true });
    var fn = _ctx.api[canal];
    if (typeof fn !== 'function') {
      return Promise.resolve({ ok: false, code: 'CANAL AUSENTE', mensaje: 'El puente no expone ' + canal, recuperable: true });
    }
    return Promise.resolve()
      .then(function () { return fn(_payload(extra)); })
      .then(_normalizar)
      .catch(function (e) {
        return { ok: false, code: 'PUENTE', mensaje: (e && e.message) || String(e), recuperable: true };
      });
  }

  /* =====================================================================
   * API pública
   * ===================================================================== */
  var SvePersistencia = {

    nuevoId: nuevoId,

    /**
     * Fija empresa + programa y decide si esta vista tiene base de datos.
     * `opciones.empresa` es el fallback: si el query del iframe no la trae, se
     * usa la del propio programa (el host la inyecta en SveSeed.meta.empresa).
     * Devuelve { disponible, motivo } — `motivo` explica por qué no, y el host
     * lo muestra en vez de dejar un SVE vacío sin explicación.
     */
    configurar: function (opciones) {
      var o = opciones || {};
      var api = _api();
      if (!api) {
        _ctx = null;
        return { disponible: false, motivo: 'Este prototipo se está abriendo fuera de la app: los datos se guardan en este navegador y NO se sincronizan entre equipos.' };
      }
      var faltan = _CANALES.filter(function (c) { return typeof api[c] !== 'function'; });
      if (faltan.length) {
        _ctx = null;
        return { disponible: false, motivo: 'La versión de la base no trae el puente de datos SVE (' + faltan.length + ' canales). Actualiza la aplicación.' };
      }
      var programaId = String(o.programaId || global.SVE_PROGRAMA_KEY || '').trim();
      if (!programaId || programaId === 'default') {
        _ctx = null;
        return { disponible: false, motivo: 'Este programa todavía no está guardado en la base, así que no hay dónde asegurar sus datos.' };
      }
      var empresa = String(_queryParam('empresa') || o.empresa || '').trim();
      if (!empresa) {
        _ctx = null;
        return { disponible: false, motivo: 'No se pudo determinar la empresa del programa, que es el dueño de estos datos.' };
      }
      _ctx = { api: api, token: _token(), empresa: empresa, programaId: programaId };
      _log('info', 'conectado a SQLite · empresa="' + empresa + '" · programa=' + programaId);
      return { disponible: true, motivo: '' };
    },

    conectado: function () { return !!_ctx; },

    /** Dataset completo del programa, en la forma que el store ya usa. */
    leer: function () { return _invocar('medprevSveDatosGet'); },

    /**
     * Vuelca un dataset entero (el localStorage viejo, o el seed de demo) a
     * SQLite. Idempotente por diseño: si el programa ya tiene contenido, el
     * bridge no toca nada. Devuelve qué pasó para que el store decida.
     */
    migrar: function (datos) { return _invocar('medprevSveMigrar', { datos: datos }); },

    casosCrear: function (caso, idPropuesto) { return _invocar('medprevSveCasosCrear', { caso: caso, idOpcional: idPropuesto }); },
    casosActualizar: function (id, caso) { return _invocar('medprevSveCasosActualizar', { casoId: id, caso: caso }); },
    casosEliminar: function (id) { return _invocar('medprevSveCasosEliminar', { casoId: id }); },

    actividadCrear: function (fase, idPropuesto) { return _invocar('medprevSvePlanActividadCrear', { fase: fase, idOpcional: idPropuesto }); },
    actividadGuardar: function (id, patch) {
      return _invocar('medprevSvePlanActividadGuardar', {
        actividadId: id,
        actividad: patch.actividad,
        responsable: patch.responsable,
        fase: patch.fase
      });
    },
    actividadEliminar: function (id) { return _invocar('medprevSvePlanActividadEliminar', { actividadId: id }); },
    celdaGuardar: function (actividadId, mes, ap, ae) {
      return _invocar('medprevSvePlanCeldaGuardar', { actividadId: actividadId, mes: mes, ap: ap, ae: ae });
    },

    metaGuardar: function (meta) { return _invocar('medprevSveMetaGuardar', { meta: meta }); },
    indicadoresGuardar: function (ind) { return _invocar('medprevSveIndicadoresGuardar', { indicadores: ind }); },
    morbilidadGuardar: function (m) { return _invocar('medprevSveMorbilidadGuardar', { morbilidad: m }); },
    analisisGuardar: function (a) { return _invocar('medprevSveAnalisisGuardar', { analisis: a }); },

    /* Las escrituras se serializan; las lecturas no hace falta encolarlas. */
    encolar: function (fn) { return _encolar(fn); }
  };

  global.SvePersistencia = SvePersistencia;
})(typeof window !== "undefined" ? window : this);
