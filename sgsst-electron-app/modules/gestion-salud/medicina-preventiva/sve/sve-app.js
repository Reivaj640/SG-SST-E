/* ============================================================
 * K+AIR · SVE — Store + Router + Componente (app controller)
 * Vanilla JS. Se expone en window.SveStore / window.SveRouter /
 * window.SveApp / window.SveComponent
 *
 * 📦827 — Persistencia: SQLite (kair.db) vía window.SvePersistencia.
 * El store es la CACHÉ de la vista, no la dueña del dato:
 *   · al montar, HIDRATA desde la base (o migra el localStorage viejo);
 *   · al mutar, muta en memoria y ESCRIBE A TRAVÉS;
 *   · las 1.300 líneas de sve-views.js no cambian: siguen leyendo el store
 *     y llamando sus mismos métodos.
 *
 * Modos (ver SvePersistencia.configurar):
 *   'sqlite' — programa guardado en la app: la base es la dueña y los datos
 *              viajan en el .kairsync.
 *   'local'  — prototipo abierto fuera de la app (navegador): localStorage,
 *              igual que antes. Sin sincronización, y la interfaz lo avisa.
 *   'error'  — hay puente pero la base respondió mal: NO se cae a
 *              localStorage (el usuario capturaría datos que no se
 *              sincronizan sin saberlo); se muestra el error y reintenta.
 *
 * Rutas: #/dashboard  #/seguimiento  #/caso/:id  #/caso/:id/editar
 *        #/nuevo  #/plan  #/indicadores  #/areas
 * ============================================================ */
(function (global) {
  "use strict";

  var MOD = '[SVE][STORE]';

  // 📦826 — Persistencia POR PROGRAMA: el host (medicina-preventiva-programa.js)
  // define window.SVE_PROGRAMA_KEY = <programaId> antes de cargar este script.
  // Desde 📦827 esa clave identifica el programa DENTRO de SQLite (se combina
  // con empresa_id); el sufijo solo aplica al modo local.
  var PROGRAMA = global.SVE_PROGRAMA_KEY ? String(global.SVE_PROGRAMA_KEY) : '';
  var STORAGE_KEY = 'kair.sve.data.v1' + (PROGRAMA ? ':' + PROGRAMA : '');
  // El estado de VISTA (el año que elegiste en el dashboard) no es un dato
  // del programa: no va a la base ni viaja entre equipos. Va aparte, en local.
  var UI_KEY = 'kair.sve.ui.v1' + (PROGRAMA ? ':' + PROGRAMA : '');

  /* ================= Estado ================= */
  var state = null;
  var modo = 'local';          // 'sqlite' | 'local'
  var carga = 0;               // token de carga: descarta respuestas viejas
  var sombraPlan = null;       // plan tal como está en la base (para el diff)
  var _pendAct = {};           // id -> patch de actividad aún no enviado

  function _log(nivel, msg, extra) {
    var fn = nivel === 'error' ? console.error : (nivel === 'warn' ? console.warn : console.log);
    try { fn.call(console, MOD + '[' + nivel + '] ' + msg, extra === undefined ? '' : extra); } catch (e) { /* noop */ }
  }

  function _clonar(o) { return JSON.parse(JSON.stringify(o)); }

  /* ================= Modo local (prototipo suelto) ================= */
  function _leerLocal() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.meta && Array.isArray(parsed.plan) && Array.isArray(parsed.seguimientos)) return parsed;
    } catch (e) { /* fallback a seed */ }
    return null;
  }

  function _guardarLocal(que) {
    try {
      var dato = que || state;
      if (dato && global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(dato));
    } catch (e) { /* noop */ }
  }

  function _borrarLocal() {
    try { if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  function _leerUi() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(UI_KEY);
      if (raw) {
        var u = JSON.parse(raw);
        if (u && typeof u === 'object') return u;
      }
    } catch (e) { /* noop */ }
    return { anioDash: state && state.meta ? state.meta.anio : new Date().getFullYear() };
  }

  function _guardarUi() {
    try {
      if (global.localStorage) global.localStorage.setItem(UI_KEY, JSON.stringify(state.ui || {}));
    } catch (e) { /* noop */ }
  }

  /* ================= Normalización ================= */
  /* La base devuelve la forma del store, pero el store además tiene `fases`
     y `catalogos` (configuración del ciclo PHVA y listas de autocompletado,
     que viven en el seed: no son datos del usuario) y `ui`. El `meta` se
     mezcla sobre el del seed para que un campo nuevo del seed no aparezca
     en blanco en un programa que ya tiene su encabezado guardado. */
  function _normalizar(d) {
    var seed = global.SveSeed || {};
    var st = {
      meta: Object.assign({}, seed.meta || {}, d.meta || {}),
      fases: seed.fases || [],
      plan: Array.isArray(d.plan) ? d.plan : [],
      seguimientos: Array.isArray(d.seguimientos) ? d.seguimientos : [],
      indicadores: d.indicadores || {},
      morbilidad: d.morbilidad || { anios: [], filas: [] },
      analisis: Array.isArray(d.analisis) ? d.analisis : [],
      catalogos: seed.catalogos || { areas: [], cargos: [], eps: [], afp: [] },
      ui: { anioDash: (d.meta && d.meta.anio) || (seed.meta && seed.meta.anio) || new Date().getFullYear() }
    };
    var u = null;
    try {
      var raw = global.localStorage && global.localStorage.getItem(UI_KEY);
      if (raw) u = JSON.parse(raw);
    } catch (e) { u = null; }
    if (u && typeof u === 'object') st.ui = Object.assign(st.ui, u);
    /* En modo sqlite los ids de actividad YA vienen de la base (son la clave
       primaria), así que esto no tiene nada que asignar: es la red de
       seguridad del modo local y de los datasets viejos. */
    asegurarIdsPlan(st.plan);
    return st;
  }

  /* ¿El programa ya fue inicializado en la base?
     El marcador es la fila de `mp_sve_meta`: existe desde el primer sembrado
     y NO se borra cuando el usuario deja el programa vacío. Preguntar
     "¿tiene casos o actividades?" no sirve: un programa al que el usuario le
     borró todo se vería vacío y se volvería a sembrar con la demo. */
  function _inicializado(d) {
    if (!d) return false;
    if (d.meta) return true;
    if (Array.isArray(d.plan) && d.plan.length) return true;
    if (Array.isArray(d.seguimientos) && d.seguimientos.length) return true;
    if (Array.isArray(d.analisis) && d.analisis.length) return true;
    if (d.morbilidad && Array.isArray(d.morbilidad.filas) && d.morbilidad.filas.length) return true;
    if (d.indicadores && Object.keys(d.indicadores).length) return true;
    return false;
  }

  function _seedComoState() {
    var s = global.SveSeed || {};
    return {
      meta: s.meta || {},
      plan: s.plan || [],
      seguimientos: s.seguimientos || [],
      indicadores: s.indicadores || {},
      morbilidad: s.morbilidad || { anios: [], filas: [] },
      analisis: s.analisis || []
    };
  }

  /* 📦826 — Id estable por actividad del plan.
     Las actividades se referenciaban por posición, que cambia en cuanto se
     borra una fila: el `id` evita que "editar la fila 3" termine escribiendo
     sobre la actividad 4.

     📦827 — Recibe el plan como argumento y NO lee `state`: se llama desde
     `_normalizar()`, que arma el estado nuevo y todavía no lo ha asignado.
     Leer la variable global ahí era un TypeError que tiraba la hidratación
     entera (pantalla de error) la primera vez que se abría un programa. */
  function asegurarIdsPlan(plan) {
    var usados = {};
    var cambio = false;
    (plan || []).forEach(function (a) {
      if (!a.id || usados[a.id]) {
        var n = 1;
        while (usados['act-' + n]) n++;
        a.id = 'act-' + n;
        cambio = true;
      }
      usados[a.id] = true;
    });
    return cambio;
  }

  function buscarActividad(id) {
    for (var i = 0; i < state.plan.length; i++) {
      if (String(state.plan[i].id) === String(id)) return state.plan[i];
    }
    return null;
  }

  /* ================= Escritura a través ================= */
  /* Una escritura fallida no se reintenta sola a ciegas: se avisa y se
     recarga el estado desde la base, que es la única fuente de verdad. Así
     la pantalla nunca queda mostrando un cambio que no se guardó. */
  function _fallo(operacion, r) {
    _log('error', 'falló ' + operacion + ' (' + (r && r.code) + '): ' + (r && r.mensaje), r);
    _avisar('No se pudo guardar en la base. Se recargó la información para no mostrarte cambios perdidos.');
    SveStore.recargar();
  }

  function _avisar(msg) {
    try {
      if (global.KAIRToast && typeof global.KAIRToast.show === 'function') global.KAIRToast.show(msg, 'error');
    } catch (e) { /* noop */ }
  }

  /* ================= Store ================= */
  var SveStore = {
    modo: function () { return modo; },

    getState: function () { return state; },

    /**
     * Hidrata el store. SIEMPRE vuelve a leer: entrar de nuevo al programa
     * debe recoger lo que otra pestaña o el sync cambiaron, no servir un
     * estado viejo que quedó en memoria.
     * @returns {Promise<{ok:boolean, modo:string, motivo:string, error:?object}>}
     */
    init: function () {
      var mio = ++carga;
      return _hidratar().then(function (res) {
        if (mio !== carga) return { ok: false, modo: modo, motivo: 'carga descartada', error: null };
        if (res.estado === 'error') {
          modo = 'error';
          return { ok: false, modo: modo, motivo: '', error: res.error };
        }
        state = res.state;
        modo = res.modo;
        sombraPlan = _clonarPlan(state.plan);
        _pendAct = {};
        if (res.migrado) {
          _log('info', 'contenido anterior migrado a SQLite: ' + JSON.stringify(res.resumen || {}));
        }
        if (res.motivo) _log('warn', res.motivo);
        return { ok: true, modo: modo, motivo: res.motivo || '', error: null };
      });
    },

    /** Vuelve a leer el estado completo desde la base. */
    recargar: function () {
      return SveStore.init().then(function (r) {
        if (r.ok && global.SveApp) global.SveApp.refresh();
        return r;
      });
    },

    /* ---------- estado de vista (nunca va a la base) ---------- */
    setUi: function (patch) {
      state.ui = Object.assign({}, state.ui || {}, patch);
      _guardarUi();
    },

    /* ---------- casos de seguimiento ---------- */
    addSeguimiento: function (data) {
      /* 📦827 — Id de TEXTO, no maxId + 1: con varias máquinas y merge
         last-write-wins POR ID, dos PCs creando el caso 25 se pisarían en
         silencio. La vista lo necesita en el mismo tick (navega a
         `#/caso/<id>` sin esperar), así que se genera acá y se propone. */
      var id = global.SvePersistencia.nuevoId('msc');
      var rec = Object.assign({}, data, { id: id });
      state.seguimientos.push(rec);
      if (modo !== 'sqlite') { _guardarLocal(); return id; }

      global.SvePersistencia.casosCrear(rec, id).then(function (r) {
        if (!r.ok) {
          state.seguimientos = state.seguimientos.filter(function (s) { return String(s.id) !== String(id); });
          _fallo('casos:crear', r);
          return;
        }
        /* El id devuelto solo difiere si el propuesto estaba ocupado
           (colisión). Se reconcilia en sitio para no perder la posición. */
        var real = r.data && r.data.caso && r.data.caso.id;
        if (real && String(real) !== String(id)) {
          _log('warn', 'el id propuesto estaba ocupado; se usó ' + real);
          rec.id = real;
          if (global.SveApp) global.SveApp.refresh();
        }
      });
      return id;
    },

    updateSeguimiento: function (id, data) {
      var rec = null;
      for (var i = 0; i < state.seguimientos.length; i++) {
        if (String(state.seguimientos[i].id) === String(id)) {
          rec = Object.assign({}, state.seguimientos[i], data, { id: state.seguimientos[i].id });
          state.seguimientos[i] = rec;
          break;
        }
      }
      if (!rec) return;
      if (modo !== 'sqlite') { _guardarLocal(); return; }
      global.SvePersistencia.casosActualizar(id, data).then(function (r) {
        if (!r.ok) _fallo('casos:actualizar', r);
      });
    },

    removeSeguimiento: function (id) {
      var i = -1;
      for (var j = 0; j < state.seguimientos.length; j++) {
        if (String(state.seguimientos[j].id) === String(id)) { i = j; break; }
      }
      if (i === -1) return;
      var antes = state.seguimientos[i];
      state.seguimientos.splice(i, 1);
      if (modo !== 'sqlite') { _guardarLocal(); return; }
      global.SvePersistencia.casosEliminar(id).then(function (r) {
        if (!r.ok) {
          /* Baja LÓGICA: si falló, el caso sigue vivo en la base. Se devuelve
             a su lugar para no mostrar un borrado que no ocurrió. */
          state.seguimientos.splice(Math.min(i, state.seguimientos.length), 0, antes);
          _fallo('casos:eliminar', r);
        }
      });
    },

    /* ---------- informe ---------- */
    /* 📦833 — alta de análisis nuevo: entra al final de la lista y se
       persiste con el MISMO guardado de reemplazo total que usa
       updateAnalisis (el bridge borra y reinserta la tabla entera). Si la
       base falla, el elemento se retira del estado: no se puede mostrar en
       pantalla algo que no quedó guardado. */
    addAnalisis: function (item) {
      state.analisis = state.analisis || [];
      var pos = state.analisis.length;
      state.analisis.push(Object.assign(
        { periodo: '', hallazgos: '', propuestas: '', responsable: '' },
        item || {}
      ));
      if (modo !== 'sqlite') { _guardarLocal(); return; }
      global.SvePersistencia.analisisGuardar(state.analisis).then(function (r) {
        if (!r.ok) {
          state.analisis.splice(pos, 1);
          _fallo('analisis:guardar', r);
        }
      });
    },

    updateAnalisis: function (idx, patch) {
      if (state.analisis && state.analisis[idx]) {
        state.analisis[idx] = Object.assign({}, state.analisis[idx], patch);
        if (modo !== 'sqlite') { _guardarLocal(); return; }
        /* El bridge reemplaza el bloque completo: se manda el arreglo entero
           con el elemento ya fusionado. */
        global.SvePersistencia.analisisGuardar(state.analisis).then(function (r) {
          if (!r.ok) _fallo('analisis:guardar', r);
        });
      }
    },

    /* ---------- indicadores (📦830) ---------- */
    /* Mismo espejo que updateAnalisis: el bridge de indicadores reemplaza el
       bloque completo, así que se manda el mapa entero con el indicador ya
       fusionado. El patch puede traer nombre/meta/formulacion/periodicidad,
       metaCorta/umbral (extras de la card), anios y las medidas. */
    updateIndicador: function (clave, patch) {
      if (!state.indicadores || !state.indicadores[clave]) return;
      state.indicadores[clave] = Object.assign({}, state.indicadores[clave], patch || {});
      if (modo !== 'sqlite') { _guardarLocal(); return; }
      global.SvePersistencia.indicadoresGuardar(state.indicadores).then(function (r) {
        if (!r.ok) _fallo('indicadores:guardar', r);
      });
    },

    /* ---------- plan PHVA ---------- */
    /* Actividad nueva, sin programar. Nace con los 12 meses en [0,0]: no entra
       al denominador del cumplimiento hasta que se marque AP, que es
       justamente lo que se quiere para no inflar ni el porcentaje ni el total
       con una fila que todavía no tiene plan. */
    addActividad: function (faseId, data) {
      var usados = {};
      state.plan.forEach(function (a) { usados[a.id] = true; });
      var n = 1;
      while (usados['act-' + n]) n++;
      var meses = [];
      for (var i = 0; i < 12; i++) meses.push([0, 0]);
      var rec = Object.assign({
        id: 'act-' + n, fase: faseId,
        actividad: '', responsable: '', meses: meses
      }, data || {});
      var pos = state.plan.length;
      state.plan.push(rec);
      if (sombraPlan) sombraPlan.push(_clonar(rec));
      if (modo !== 'sqlite') { _guardarLocal(); return rec.id; }

      global.SvePersistencia.actividadCrear(faseId, rec.id).then(function (r) {
        if (!r.ok) {
          state.plan.splice(pos, 1);
          if (sombraPlan) sombraPlan.splice(sombraPlan.findIndex(function (x) { return String(x.id) === String(rec.id); }), 1);
          _fallo('plan:actividad:crear', r);
          return;
        }
        var real = r.data && r.data.id;
        if (real && String(real) !== String(rec.id)) {
          _log('warn', 'el id de actividad propuesto estaba ocupado; se usó ' + real);
          rec.id = real;
          if (sombraPlan) sombraPlan[pos].id = real;
          if (global.SveApp) global.SveApp.refresh();
          return;
        }
        /* El alta en la base nace vacía (el bridge crea la fila con los 12
           meses en cero y sin texto). Si el llamador trajo nombre o
           responsable de una vez —`addActividad(fase, { actividad: 'x' })`—
           hay que guardarlos acá: aceptarlos en la firma y perderlos en
           silencio es peor que no aceptarlos. La grilla del prototipo llama
           con `{}` y el texto llega después por `updateActividad`, así que
           esta rama casi nunca corre, pero es la que hace honesta la API. */
        var textos = {};
        if (data && data.actividad) textos.actividad = data.actividad;
        if (data && data.responsable) textos.responsable = data.responsable;
        if (!Object.keys(textos).length) return;
        var destino = rec.id;
        global.SvePersistencia.encolar(function () {
          return global.SvePersistencia.actividadGuardar(destino, textos);
        }).then(function (r2) {
          if (r2 && !r2.ok) _fallo('plan:actividad:guardar (alta)', r2);
        });
      });
      return rec.id;
    },

    /* Se muta EN SITIO a propósito: las celdas AP/AE y los inputs de la grilla
       guardan una referencia al objeto actividad. Reemplazarlo en el store
       dejaría esas referencias apuntando a un objeto viejo. */
    updateActividad: function (id, patch) {
      var a = buscarActividad(id);
      if (!a) return false;
      Object.keys(patch).forEach(function (k) { a[k] = patch[k]; });
      if (modo !== 'sqlite') { _guardarLocal(); return true; }
      _pendAct[id] = Object.assign({}, _pendAct[id], patch);
      _encolarActividad(id);
      return true;
    },

    removeActividad: function (id) {
      var i = -1;
      for (var j = 0; j < state.plan.length; j++) {
        if (String(state.plan[j].id) === String(id)) { i = j; break; }
      }
      if (i === -1) return false;
      var antes = state.plan[i];
      var jSombra = sombraPlan ? sombraPlan.findIndex(function (x) { return String(x.id) === String(id); }) : -1;
      var antesSombra = jSombra >= 0 ? sombraPlan[jSombra] : null;
      state.plan.splice(i, 1);
      if (sombraPlan && jSombra >= 0) sombraPlan.splice(jSombra, 1);
      if (modo !== 'sqlite') { _guardarLocal(); return true; }
      global.SvePersistencia.actividadEliminar(id).then(function (r) {
        if (!r.ok) {
          state.plan.splice(Math.min(i, state.plan.length), 0, antes);
          if (sombraPlan && antesSombra) sombraPlan.splice(Math.min(jSombra, sombraPlan.length), 0, antesSombra);
          _fallo('plan:actividad:eliminar', r);
        }
      });
      return true;
    },

    /**
     * 📦827 — Persiste el PLAN comparándolo con la copia de lo que está en la
     * base y mandando SOLO las celdas que cambiaron.
     *
     * Las celdas AP/AE del prototipo mutan `actividad.meses[mi][x]` en sitio y
     * llaman a `save()` sin argumentos, sin decir qué tocaron. Diffar contra la
     * sombra es lo que permite no tocar esa vista y, de paso, no escribir 12
     * meses enteros por cada clic.
     */
    save: function () {
      if (modo !== 'sqlite') { _guardarLocal(); return; }
      _diffPlan();
    },

    reset: function () {
      /* Solo tiene sentido en modo local. En SQLite, "reiniciar" no es una
         operación trivial ni deseable: los casos se archivan con baja lógica
         (debe quedar la traza de un registro SG-SST) y el resto del plan se
         borra en cascada. Que lo decida el producto, no este archivo. */
      if (modo === 'sqlite') {
        _log('warn', 'reset() no hace nada en modo SQLite: los casos se archivan, no se borran.');
        return;
      }
      state = null;
      _borrarLocal();
      _guardarLocal();
    }
  };

  function _clonarPlan(plan) { return (plan || []).map(function (a) { return _clonar(a); }); }

  /* Envío coalescado de una actividad.
     Cada tecla encola una tarea, pero la tarea lee el patch ACUMULADO en el
     momento de ejecutarse: como la cola es micro-tarea + IPC, diez pulsaciones
     rápidas se resuelven en un solo UPDATE. No hay ventana de pérdida (a
     diferencia de un debounce con setTimeout) y las 12 celdas de una fila no
     se reescriben. */
  function _encolarActividad(id) {
    global.SvePersistencia.encolar(function () {
      var patch = _pendAct[id];
      if (!patch) return null;
      delete _pendAct[id];
      return global.SvePersistencia.actividadGuardar(id, patch);
    }).then(function (r) {
      if (r && !r.ok) _fallo('plan:actividad:guardar', r);
    });
  }

  /* Compara el plan en memoria contra la sombra y encola las celdas que
     cambiaron. La sombra se actualiza de forma optimista (para no reenviar lo
     mismo) y se revierte si el guardado falla. */
  function _diffPlan() {
    if (!sombraPlan) { sombraPlan = _clonarPlan(state.plan); return; }
    var envios = [];
    state.plan.forEach(function (a) {
      var antes = null;
      for (var i = 0; i < sombraPlan.length; i++) {
        if (String(sombraPlan[i].id) === String(a.id)) { antes = sombraPlan[i]; break; }
      }
      if (!antes) {
        /* Actividad que alguien metió al array sin pasar por addActividad.
           Se intenta un UPDATE (que no la crea) en vez de un INSERT: ante la
           duda es preferible avisar que no escribir un duplicado. */
        _log('warn', 'actividad ' + a.id + ' no está registrada en la base; se reintentan sus textos.');
        _encolarActividad(a.id);
        return;
      }
      for (var mi = 0; mi < 12; mi++) {
        var par = a.meses[mi] || [0, 0];
        var viejo = antes.meses[mi] || [0, 0];
        var ap = par[0] ? 1 : 0;
        var ae = par[1] ? 1 : 0;
        if (ap === (viejo[0] ? 1 : 0) && ae === (viejo[1] ? 1 : 0)) continue;
        antes.meses[mi] = [ap, ae];
        envios.push({ id: a.id, mes: mi + 1, ap: ap, ae: ae, antes: viejo });
      }
    });
    envios.forEach(function (c) {
      global.SvePersistencia.encolar(function () {
        return global.SvePersistencia.celdaGuardar(c.id, c.mes, c.ap, c.ae);
      }).then(function (r) {
        if (r && !r.ok) {
          /* Se revierte la sombra: si no, el diff daría el cambio por aplicado
             y no se volvería a intentar nunca. */
          var a = buscarActividad(c.id);
          var s = sombraPlan && sombraPlan.filter(function (x) { return String(x.id) === String(c.id); })[0];
          if (s) s.meses[c.mes - 1] = c.antes;
          if (a) a.meses[c.mes - 1] = c.antes;
          _fallo('plan:celda:guardar (' + c.id + ' mes ' + c.mes + ')', r);
        }
      });
    });
  }

  /* ================= Hidratación ================= */
  function _hidratar() {
    var pers = global.SvePersistencia;
    if (!pers) return Promise.resolve({ estado: 'local', modo: 'local', state: _desdeSeed(), motivo: 'Sin capa de persistencia cargada.' });

    var cfg = pers.configurar({ empresa: (global.SveSeed && global.SveSeed.meta && global.SveSeed.meta.empresa) || '' });
    if (!cfg.disponible) return Promise.resolve({ estado: 'local', modo: 'local', state: _desdeLocal(), motivo: cfg.motivo });

    return pers.leer().then(function (r) {
      if (!r.ok) return { estado: 'error', error: r };

      if (_inicializado(r.data)) {
        return { estado: 'listo', modo: 'sqlite', state: _normalizar(r.data) };
      }

      /* Programa nuevo: entra lo que haya. Primero el localStorage del
         prototipo (son datos ya capturados por el usuario), y solo si no hay
         nada, la demo del seed. */
      var local = _leerLocal();
      var aMigrar = local ? local : _seedComoState();
      var origen = local ? 'el contenido anterior de este equipo' : 'la plantilla de demostración';

      return pers.migrar(aMigrar).then(function (m) {
        if (!m.ok) return { estado: 'error', error: m };
        if (!m.data.migrado) {
          /* La base ya tenía datos (otra pestaña ganó la carrera): se relee. */
          return pers.leer().then(function (r2) {
            if (!r2.ok) return { estado: 'error', error: r2 };
            return { estado: 'listo', modo: 'sqlite', state: _normalizar(r2.data) };
          });
        }
        /* Migrado: la base es la dueña. El localStorage se borra para que el
           próximo arranque no vuelva a ofrecer los mismos datos. */
        if (local) _borrarLocal();
        return pers.leer().then(function (r2) {
          if (!r2.ok) return { estado: 'error', error: r2 };
          return {
            estado: 'listo', modo: 'sqlite', migrado: true, resumen: m.data.resumen,
            state: _normalizar(r2.data),
            motivo: 'Se cargó ' + origen + ' en la base de datos del programa.'
          };
        });
      });
    });
  }

  /* Modo local: conserva exactamente el comportamiento anterior 📦826. */
  function _desdeLocal() {
    var st = _leerLocal();
    if (!st) {
      st = JSON.parse(JSON.stringify(global.SveSeed || { meta: {}, plan: [], seguimientos: [] }));
      st.ui = { anioDash: st.meta.anio || new Date().getFullYear() };
      asegurarIdsPlan(st.plan);
      /* La migración de ids se persiste acá: si no, el id se regeneraría
         distinto en cada arranque. */
      _borrarLocal();
      _guardarLocal(st);
    }
    if (asegurarIdsPlan(st.plan)) _guardarLocal(st);
    return st;
  }

  function _desdeSeed() {
    var st = JSON.parse(JSON.stringify(global.SveSeed || { meta: {}, plan: [], seguimientos: [] }));
    st.ui = { anioDash: st.meta.anio || new Date().getFullYear() };
    asegurarIdsPlan(st.plan);
    return st;
  }

  /* ================= Router (hash) ================= */
  var routes = {};
  var currentRoot = null;

  function parseHash() {
    var h = (global.location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'dashboard', params: parts.slice(1) };
  }

  var SveRouter = {
    register: function (name, fn) { routes[name] = fn; },
    navigate: function (hash) {
      if (global.location.hash === hash) render();
      else global.location.hash = hash;
    },
    start: function (root) {
      currentRoot = root;
      global.removeEventListener('hashchange', render);
      global.addEventListener('hashchange', render);
      render();
    }
  };

  function render() {
    if (!currentRoot) return;
    var r = parseHash();
    var fn = routes[r.name] || routes.dashboard;
    currentRoot.innerHTML = '';
    try {
      fn(currentRoot, r.params);
    } catch (e) {
      console.error('[SVE] Error renderizando vista "' + r.name + '":', e);
      currentRoot.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#475569">' +
        '<h2 style="font-size:16px">Error al cargar la vista</h2><p style="font-size:13px">' + String(e && e.message || e) + '</p></div>';
    }
    if (global.SveUI) global.SveUI.refreshIcons();
  }

  /* ================= Pantalla de error de base ================= */
  /* No se cae al localStorage a propósito: el usuario seguiría capturando
     datos que después no se sincronizan y no se enteraría. Se dice qué pasó y
     se ofrece reintentar. */
  function _pintarError(container, r) {
    _log('error', 'no se pudo leer el programa de la base: ' + ((r && r.code) || '?') + ' ' + ((r && r.mensaje) || ''), r);
    if (!container) return;
    container.innerHTML =
      '<div class="sve-db-error" style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:10px;min-height:260px;padding:32px;text-align:center;font-family:var(--kair-font-ui,system-ui,sans-serif)">' +
      '<div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(180,83,9,.12);color:#b45309;font-size:20px">!</div>' +
      '<h2 style="margin:0;font-size:1rem;font-weight:700;color:#22333a">No se pudo abrir la información del programa</h2>' +
      '<p style="margin:0;max-width:38rem;font-size:.85rem;line-height:1.5;color:#5b6f75">' +
      'Los datos de este programa viven en la base de datos de la aplicación. No se pudo leer, así que no se ' +
      'abrió la vista: no se escribió nada para no mostrarte información que no está guardada.</p>' +
      '<p style="margin:0;max-width:38rem;font-size:.78rem;color:#7a8c92">' +
      'Detalle: ' + _esc((r && r.mensaje) || 'error desconocido') + '</p>' +
      '<button type="button" id="sve-db-retry" style="margin-top:6px;padding:8px 18px;border-radius:8px;border:1px solid #2f6fd6;' +
      'background:#2f6fd6;color:#fff;font-size:.85rem;font-weight:600;cursor:pointer">Reintentar</button>' +
      '</div>';
    var btn = container.querySelector('#sve-db-retry');
    if (btn) {
      btn.addEventListener('click', function () {
        container.innerHTML = _esperando();
        SveApp.init(container, _ultimasOpciones).then(function (r2) {
          if (!r2.ok && r2.error) _pintarError(container, r2.error);
        });
      });
    }
  }

  function _esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _esperando() {
    return '<div style="display:flex;align-items:center;justify-content:center;min-height:220px;gap:10px;' +
      'font-family:var(--kair-font-ui,system-ui,sans-serif);font-size:.85rem;color:#7a8c92">' +
      '<span style="width:14px;height:14px;border:2px solid rgba(47,111,214,.25);border-top-color:#2f6fd6;' +
      'border-radius:50%;display:inline-block"></span> Cargando la información del programa…</div>';
  }

  /* ================= App controller ================= */
  function go(view) {
    var hash = '#/' + view.name;
    if (view.name === 'caso') {
      hash += '/' + view.id + (view.editar ? '/editar' : '');
    }
    if (global.SveStore) global.SveStore.getState(); /* asegura estado */
    SveRouter.navigate(hash);
  }

  function refresh() { render(); }

  var _ultimasOpciones = {};

  function init(container, options) {
    _ultimasOpciones = options || {};
    var opts = _ultimasOpciones;
    if (container) container.innerHTML = _esperando();

    return SveStore.init().then(function (r) {
      if (!r.ok) {
        if (r.error) _pintarError(container, r.error);
        return r;
      }
      if (r.motivo) _avisoModo(container, r.motivo);

      SveRouter.register('dashboard', function (root) { global.SveViews.Dashboard(root, makeCtx()); });
      SveRouter.register('seguimiento', function (root) { global.SveViews.Seguimiento(root, makeCtx()); });
      SveRouter.register('caso', function (root, params) {
        var id = params[0];
        if (params[1] === 'editar') return global.SveViews.FormCaso(root, makeCtx(), 'editar', id);
        global.SveViews.Caso(root, makeCtx(), id);
      });
      SveRouter.register('nuevo', function (root) { global.SveViews.FormCaso(root, makeCtx(), 'nueva'); });
      SveRouter.register('plan', function (root) { global.SveViews.Plan(root, makeCtx()); });
      SveRouter.register('indicadores', function (root) { global.SveViews.Indicadores(root, makeCtx()); });
      SveRouter.register('areas', function (root) { global.SveViews.Areas(root, makeCtx()); });

      SveRouter.start(container);

      function makeCtx() {
        var ctx = { go: go };
        if (typeof opts.onExit === 'function') ctx.backToModule = opts.onExit;
        return ctx;
      }

      var env = 'browser';
      try { env = global.process && global.process.versions && global.process.versions.electron ? 'electron' : 'browser'; } catch (e) { /* noop */ }
      console.log('[K+AIRSST][SVE][INIT][SUCCESS] entorno=' + env +
        ' modo=' + modo +
        ' seguimientos=' + SveStore.getState().seguimientos.length +
        ' actividades=' + SveStore.getState().plan.length);
      return r;
    }).catch(function (e) {
      _log('error', 'falló la hidratación: ' + ((e && e.message) || e), e);
      _pintarError(container, { code: 'EXCEPCION', mensaje: (e && e.message) || String(e) });
      return { ok: false, modo: modo, motivo: '', error: { code: 'EXCEPCION', mensaje: (e && e.message) || String(e) } };
    });
  }

  /* Aviso de una sola línea, arriba de la vista, cuando los datos NO viajan
     (prototipo suelto). No bloquea: se puede seguir trabajando. */
  var avisoVisible = false;
  function _avisoModo(container, motivo) {
    if (!container || !motivo || avisoVisible) return;
    avisoVisible = true;
    var barra = document.createElement('div');
    barra.setAttribute('data-sve-aviso', 'modo-local');
    barra.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:.78rem;' +
      'background:rgba(180,83,9,.08);color:#8a5208;border-bottom:1px solid rgba(180,83,9,.2);' +
      'font-family:var(--kair-font-ui,system-ui,sans-serif)';
    barra.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>' + _esc(motivo) + '</span>';
    if (container.firstChild) container.insertBefore(barra, container.firstChild);
    else container.appendChild(barra);
  }

  global.SveApp = { go: go, refresh: refresh, init: init };
  global.SveStore = SveStore;
  global.SveRouter = SveRouter;

  /* ================= Componente (contrato igual a InspeccionComponent) ================= */
  function SveComponent(container, company, moduleName, submoduleTitle, onExit) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.company = company;
    this.moduleName = moduleName;
    this.submoduleTitle = submoduleTitle;
    this.onExit = onExit;
  }

  SveComponent.prototype.render = function () {
    if (!this.container) {
      console.error('[SveComponent] Contenedor no disponible');
      return;
    }
    /* identifica la empresa demo igual que el módulo de inspecciones */
    try {
      var companyName = global.SveSeed.meta.empresa;
      if (this.company === 'default' || !this.company) companyName = 'Tempoactiva S.A.S. (demo)';
      global.SveSeed.meta.empresa = companyName;
    } catch (e) { /* noop */ }

    return global.SveApp.init(this.container, { onExit: this.onExit });
  };

  global.SveComponent = SveComponent;
})(typeof window !== 'undefined' ? window : this);
