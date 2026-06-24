/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
editor.js — Vista "Nuevo/Editar peligro" con 5 secciones (layout seccionado
            según imagen de referencia: sidebar nav + section cards + sticky footer).

API pública (window.KMEditor):
  - render(container, opts)  → monta la vista dentro del contenedor
  - destroy()                → desmonta y limpia listeners
  - refresh()                → re-renderiza (tras cambiar data externa)

Convenciones:
  - Mantiene el contrato con KMService (addPeligro / updatePeligro) intacto.
  - Los nombres de campos en _state.data son los mismos que usa el bridge
    parser XLSX (tipo, peligro, efectosPosibles, peorConsecuencia, nd, ne,
    nc, np, nr, npInterpretacion, nrNivel, nrLabel, expuestos, fuente,
    medio, individuo, eliminacion, sustitucion, controlIngenieria,
    senalizacion, epp, sedeId, procesoId, cargoId, sede, proceso, cargo).
  - El status de cada sección se calcula en tiempo real desde los datos.
  - Los botones del footer: "Cancelar" (ghost), "Guardar" (outline, persiste
    y permanece), "Crear y cerrar" (primary, persiste y vuelve a la matriz).
========================================================================== */
(function (global) {
  'use strict';
  var KM = global.KM;
  var Editor = {};

  var _state = null;
  var _docKeyHandler = null;
  var _inputChangeHandler = null;

  function _esc(s) { return KM.esc(s); }

  /* Definición canónica de las 5 secciones (orden, icono, label, required fields) */
  var SECTIONS = [
    { key: 'datos',     icon: 'info-circle',         label: 'Datos básicos',           required: ['sedeId', 'procesoId', 'cargoId', 'tareas', 'rutinaria', 'expuestos'] },
    { key: 'peligro',   icon: 'exclamation-triangle',label: 'Peligro y efectos',       required: ['tipo', 'peligro', 'efectosPosibles'] },
    { key: 'controles', icon: 'shield-check',        label: 'Controles existentes',    required: [] },
    { key: 'evaluacion',icon: 'speedometer2',        label: 'Evaluación (auto)',       required: ['nd', 'ne', 'nc'] },
    { key: 'medidas',   icon: 'hammer',              label: 'Medidas de intervención', required: [] }
  ];

  /* F21.61 (2026-06-23) — Opcionales por seccion. Antes tenia los nombres
     de campos mal: decia 'fuente', 'medio', 'individuo' (cortos) pero el
     formulario realmente usa 'controlFuente', 'controlMedio', 'controlPersona'
     (largos, con prefijo control). Igual para medidas: la lista decia
     'eliminacion' etc. pero el form usa 'medidaEliminacion' etc. Resultado:
     el sistema JAMAS rastreaba esos campos como opcionales, asi que las
     secciones Controles existentes y Medidas de intervencion siempre
     quedaban con status raro. Tambien anadi los pocos campos opcionales
     que existian en el form pero no estaban en esta lista:
     - 'zona' (Datos basicos, entre proceso y cargo)
     - 'peorConsecuencia' (Peligro y efectos) */
  var OPTIONAL_BY_SECTION = {
    datos:     ['zona'],
    peligro:   ['peorConsecuencia'],
    controles: ['controlFuente', 'controlMedio', 'controlPersona'],
    medidas:   ['medidaEliminacion', 'medidaSustitucion', 'medidaIngenieria', 'medidaAdministrativos', 'medidaEpp']
  };

  function _sectionStatus(sectionKey) {
    if (!_state) return 'empty';
    var sec = SECTIONS.filter(function (s) { return s.key === sectionKey; })[0];
    if (!sec) return 'empty';
    var d = _state.data || {};
    /* Sección 1 (datos): estado especial "sin-sede" cuando sedeId vacío */
    if (sectionKey === 'datos' && !d.sedeId) return 'sin-sede';
    /* Required fields */
    var reqFilled = 0;
    sec.required.forEach(function (k) {
      var v = d[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') reqFilled++;
    });
    /* F21.60 (2026-06-23) — Logica de status re-escrita para que:
       1) Secciones CON campos requeridos: vacio=empty, parcial=partial, todo=complete
          (sin cambios).
       2) Secciones SIN requeridos (Controles existentes, Medidas de
          intervencion): el status debe basarse en los campos OPCIONALES.
          Antes siempre daba 'complete' (porque reqFilled=0 === required.length=0
          → retornaba 'complete' en la primera condicion), aunque la seccion
          estuviera totalmente vacia. Eso era incorrecto: veiamos "Completo"
          en verde sin haber llenado nada.
          Ahora: 0 opcionales llenos = 'empty' (badge "Opcional"),
                 algunos = 'partial' (badge "Pendiente"),
                 todos = 'complete' (badge "Completo"). */
    if (sec.required.length > 0) {
      if (reqFilled === sec.required.length) return 'complete';
      if (reqFilled === 0) return 'empty';
      return 'partial';
    }
    /* Sin required → mirar solo los opcionales */
    var opt = OPTIONAL_BY_SECTION[sectionKey] || [];
    if (opt.length === 0) return 'empty';
    var optFilled = 0;
    opt.forEach(function (k) {
      var v = d[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') optFilled++;
    });
    if (optFilled === 0) return 'optional';
    if (optFilled === opt.length) return 'complete';
    return 'partial';
  }

  function _statusBadge(s) {
    var label = 'Nuevo';
    var variant = 'info';
    if (s === 'complete')   { label = 'Completo';   variant = 'success'; }
    if (s === 'partial')    { label = 'Pendiente';  variant = 'warning'; }
    if (s === 'sin-sede')   { label = 'Sin sede';   variant = 'neutral'; }
    /* F21.60 — Nuevo estado 'optional' para secciones sin requeridos
       que estan totalmente vacias. Se muestra como "Opcional" con
       variant neutral (gris) para que sea visualmente distinto de
       'Nuevo' (azul) que es para secciones con requeridos pendientes. */
    if (s === 'optional')   { label = 'Opcional';   variant = 'neutral'; }
    if (s === 'empty')      { label = 'Nuevo';      variant = 'info'; }
    return '<span class="km-editor-side-badge km-badge km-badge--' + variant + '">' + label + '</span>';
  }

  function _sectionAnchorId(key) { return 'km-editor-section-' + key; }

  function _buildSelect(name, options, current, placeholder) {
    var html = '<option value="">' + _esc(placeholder || 'Selecciona...') + '</option>';
    (options || []).forEach(function (o) {
      var v = o.value != null ? String(o.value) : o.label;
      var sel = (v === String(current)) ? ' selected' : '';
      html += '<option value="' + _esc(v) + '"' + sel + '>' + _esc(o.label) + '</option>';
    });
    return html;
  }

  /* ---------------- Data loading ---------------- */

  function _loadMatriz() {
    if (!_state || !_state.companyName) return Promise.resolve({ sedes: [] });
    return global.KMService.read(_state.companyName).then(function (r) {
      if (r && r.success && r.data && r.data.matriz) return r.data.matriz;
      return { sedes: [] };
    });
  }

  function _loadGtc45Options() {
    if (_state && _state.gtc45Options) return Promise.resolve(_state.gtc45Options);
    return global.KMService.gtc45Options().then(function (r) {
      var data = (r && r.success && r.data) ? r.data : { nd: [], ne: [], nc: [], tipos: [] };
      if (_state) _state.gtc45Options = data;
      return data;
    });
  }

  /* Cuando sede cambia → reset proceso y cargo */
  function _onSedeChange(newSedeId) {
    _state.data.sedeId = newSedeId || '';
    _state.data.procesoId = '';
    _state.data.cargoId = '';
    var sede = (_state.matriz.sedes || []).filter(function (s) { return s.id === newSedeId; })[0];
    _state.data.sede = sede ? sede.nombre : '';
    _state.data.proceso = '';
    _state.data.cargo = '';
    _refresh();
  }
  function _onProcesoChange(newProcesoId) {
    _state.data.procesoId = newProcesoId || '';
    _state.data.cargoId = '';
    var sede = (_state.matriz.sedes || []).filter(function (s) { return s.id === _state.data.sedeId; })[0];
    var proc = sede && (sede.procesos || []).filter(function (p) { return p.id === newProcesoId; })[0];
    /* F21.56 — Si el proceso seleccionado es uno de los defaults
       (pro_def_*), no existe en la matriz; caemos al PROCESOS_DEFAULT
       para mantener el nombre sincronizado con el id. */
    if (!proc && newProcesoId) {
      proc = PROCESOS_DEFAULT.filter(function (p) { return p.id === newProcesoId; })[0];
    }
    _state.data.proceso = proc ? proc.nombre : '';
    _state.data.cargo = '';
    _refresh();
  }
  function _onCargoChange(newCargoId) {
    _state.data.cargoId = newCargoId || '';
    var sede = (_state.matriz.sedes || []).filter(function (s) { return s.id === _state.data.sedeId; })[0];
    var proc = sede && (sede.procesos || []).filter(function (p) { return p.id === _state.data.procesoId; })[0];
    var cargo = proc && (proc.cargos || []).filter(function (c) { return c.id === newCargoId; })[0];
    _state.data.cargo = cargo ? cargo.nombre : '';
    if (cargo) {
      /* Pre-rellenar desde el cargo si el peligro no tiene esos datos aún */
      if (!_state.data.tareas && cargo.tareas) _state.data.tareas = cargo.tareas;
      if (!_state.data.zona && cargo.zona) _state.data.zona = cargo.zona;
      if (_state.data.rutinaria == null || _state.data.rutinaria === '') {
        _state.data.rutinaria = cargo.rutinaria === true ? 'Si' : (cargo.rutinaria === false ? 'No' : '');
      }
    }
    _refresh();
  }

  /* ---------------- Render: shell ---------------- */

  /* F21.61 (2026-06-23) — Progreso GRANULAR por seccion (0 a 1). A diferencia
     de _sectionStatus (que solo dice empty/partial/complete), esta funcion
     devuelve una fraccion para alimentar la barra de COMPLETITUD con un
     avance suave: cuenta campos llenos (requeridos + opcionales) sobre el
     total de campos de la seccion. Asi si lleno 4 de 6 requeridos de
     "Datos basicos", la barra avanza 4/6 = 66% de esa seccion, no 0 como
     antes. Si la seccion no tiene campos (caso raro), devuelve 0. */
  function _sectionProgress(sectionKey) {
    var sec = SECTIONS.filter(function (s) { return s.key === sectionKey; })[0];
    if (!sec) return 0;
    var d = _state.data || {};
    var reqFilled = 0;
    sec.required.forEach(function (k) {
      var v = d[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') reqFilled++;
    });
    var opt = OPTIONAL_BY_SECTION[sectionKey] || [];
    var optFilled = 0;
    opt.forEach(function (k) {
      var v = d[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') optFilled++;
    });
    var total = sec.required.length + opt.length;
    if (total === 0) return 0;
    return (reqFilled + optFilled) / total;
  }

  function _renderSidebar() {
    var completitud = 0;
    /* F21.61 — Ahora la barra se alimenta del progreso GRANULAR
       (suma de _sectionProgress de cada seccion / N secciones), no de
       un contador de "completas". Asi la barra avanza suavemente a
       medida que el usuario llena campos, en vez de dar saltos de
       20% en 20% (0, 20, 40, 60, 80, 100) como antes. Tambien se
       muestra el porcentaje explicito al lado del contador X/N. */
    var totalProgress = 0;
    var items = SECTIONS.map(function (sec) {
      var st = _sectionStatus(sec.key);
      if (st === 'complete') completitud++;
      var prog = _sectionProgress(sec.key);
      totalProgress += prog;
      var checkCls = 'km-editor-side-check km-editor-side-check--' + st;
      var checkIcon = st === 'complete' ? 'bi-check-circle-fill' : 'bi-circle';
      return (
        '<li class="km-editor-side-item" data-jump="' + sec.key + '">' +
          '<span class="km-editor-side-icon"><i class="bi bi-' + sec.icon + '"></i></span>' +
          '<span class="km-editor-side-label">' + _esc(sec.label) + '</span>' +
          '<span class="' + checkCls + '"><i class="bi ' + checkIcon + '"></i></span>' +
          _statusBadge(st) +
        '</li>'
      );
    }).join('');

    var avgProgress = SECTIONS.length > 0 ? (totalProgress / SECTIONS.length) : 0;
    var percent = Math.round(avgProgress * 100);

    /* F21.53 (2026-06-23) — Quitado el bloque keydata (ID / SEDE / NR) del
       sidebar. Generaba un espacio vacio enorme entre los items y
       COMPLETITUD (que va al fondo via margin-top:auto). Ahora el sidebar
       queda compacto: lista de secciones arriba + COMPLETITUD al fondo.
       Los estilos .km-editor-sidebar__keydata* se mantienen en CSS por si
       se quieren reutilizar en otra vista. */

    return (
      '<div class="km-editor-sidebar__title">SECCIONES</div>' +
      '<ul class="km-editor-side-nav">' + items + '</ul>' +
      '<div class="km-editor-sidebar__progress">' +
        '<div class="km-editor-sidebar__progress-label">COMPLETITUD</div>' +
        '<div class="km-editor-sidebar__progress-count">' +
          '<span>' + completitud + '/' + SECTIONS.length + '</span>' +
          '<span class="km-editor-sidebar__progress-percent">' + percent + '%</span>' +
        '</div>' +
        '<div class="km-editor-progress"><div class="km-editor-progress__bar" style="width:' + percent + '%"></div></div>' +
      '</div>'
    );
  }

  /* Banner dinámico: 4 variantes según NR (según doc técnico)
     - Sin NR calculado → azul info
     - NR >= 800 → rojo (Nivel I - NO ACEPTABLE, intervención inmediata)
     - NR >= 180 → amarillo (Nivel II - ACEPTABLE CON CONTROL ESPECIFICO)
     - NR >= 40  → azul/info (Nivel III - MEJORABLE)
     - NR < 40   → verde (Nivel IV - ACEPTABLE) */
  function _renderBanner() {
    var d = _state.data || {};
    var nd = d.nd, ne = d.ne, nc = d.nc;
    var hasAll = (nd != null && nd !== '') && (ne != null && ne !== '') && (nc != null && nc !== '');
    var variant = 'info';
    var icon = 'info-circle';
    var title = 'Completa todas las secciones para registrar el peligro en la matriz.';
    var subtitle = '';

    if (hasAll) {
      var np = KM.calcNP(nd, ne);
      var nr = KM.calcNR(np, nc);
      var interpNr = KM.interpNR(nr);
      var npInterp = KM.interpNP(np);
      if (nr >= 800) {
        variant = 'danger';
        icon = 'exclamation-octagon-fill';
        title = 'Nivel I — No aceptable. Requiere intervención inmediata.';
        subtitle = 'NP = ' + np + ' (' + npInterp.label + ') · NR = ' + nr + ' · Aceptabilidad: NO ACEPTABLE';
      } else if (nr >= 180) {
        variant = 'warning';
        icon = 'exclamation-triangle-fill';
        title = 'Nivel II — Alto. Implementar controles específicos.';
        subtitle = 'NP = ' + np + ' (' + npInterp.label + ') · NR = ' + nr + ' · Aceptabilidad: ACEPTABLE CON CONTROL ESPECIFICO';
      } else if (nr >= 40) {
        variant = 'info';
        icon = 'info-circle-fill';
        title = 'Nivel III — Mejorable. Riesgo medio, documentar controles.';
        subtitle = 'NP = ' + np + ' (' + npInterp.label + ') · NR = ' + nr + ' · Aceptabilidad: MEJORABLE';
      } else {
        variant = 'success';
        icon = 'check-circle-fill';
        title = 'Nivel IV — Aceptable. Riesgo bajo, mantener controles existentes.';
        subtitle = 'NP = ' + np + ' (' + npInterp.label + ') · NR = ' + nr + ' · Aceptabilidad: ACEPTABLE';
      }
    }

    return (
      '<div class="km-editor-banner km-editor-banner--' + variant + '" data-banner>' +
        '<i class="bi bi-' + icon + '"></i>' +
        '<div class="km-editor-banner__text">' +
          '<div class="km-editor-banner__title">' + _esc(title) + '</div>' +
          (subtitle ? '<div class="km-editor-banner__sub">' + _esc(subtitle) + '</div>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function _renderFooter() {
    var np = KM.calcNP(_state.data.nd, _state.data.ne);
    var nr = KM.calcNR(np, _state.data.nc);
    var showHint = (_state.data.nd != null && _state.data.nd !== '') &&
                   (_state.data.ne != null && _state.data.ne !== '') &&
                   (_state.data.nc != null && _state.data.nc !== '');
    var hint = showHint
      ? 'NP = ' + np + ' · NR = ' + nr
      : 'Selecciona ND, NE y NC para ver el cálculo';
    var isNew = _state.mode === 'new';
    var primaryLabel = isNew ? 'Crear y cerrar' : 'Guardar y cerrar';
    var primaryIcon = isNew ? 'bi-check2-circle' : 'bi-save';

    return (
      '<div class="km-editor-footer__hint"><i class="bi bi-calculator"></i> ' + _esc(hint) + '</div>' +
      '<div class="km-editor-footer__actions">' +
        '<button type="button" class="km-btn km-btn--ghost" data-footer-action="cancel">' +
          '<i class="bi bi-x"></i> Cancelar</button>' +
        '<button type="button" class="km-btn km-btn--outline" data-footer-action="save">' +
          '<i class="bi bi-save"></i> Guardar</button>' +
        '<button type="button" class="km-btn km-btn--primary" data-footer-action="save-close">' +
          '<i class="bi ' + primaryIcon + '"></i> ' + primaryLabel + '</button>' +
      '</div>'
    );
  }

  /* ---------------- Render: section cards ---------------- */

  /* F21.56 (2026-06-23) — Procesos por defecto que siempre aparecen en el
     selector de Proceso, aunque la matriz no los tenga. Sirven como atajo
     para no tener que crearlos cada vez (Administrativo y Operativo son
     los dos macro-procesos tipicos del SG-SST colombiano). Usamos IDs
     estables con prefijo "pro_def_" para que:
       1) Sean faciles de reconocer al inspeccionar el estado
       2) No colisionen con IDs reales del backend (sed_/pro_/car_/pel_)
       3) Si en el futuro se migran a la matriz real, sea trivial mapearlos
     Los procesos default se ocultan si la matriz ya tiene uno con el mismo
     nombre (case-insensitive), para evitar duplicados visuales. */
  var PROCESOS_DEFAULT = [
    { id: 'pro_def_administrativo', nombre: 'Administrativo' },
    { id: 'pro_def_operativo',      nombre: 'Operativo' }
  ];

  function _buildProcesosOpts(sede) {
    var fromMatriz = sede ? (sede.procesos || []).map(function (p) {
      return { value: p.id, label: p.nombre, source: 'matriz' };
    }) : [];
    var existentes = {};
    fromMatriz.forEach(function (o) {
      existentes[String(o.label || '').toLowerCase().trim()] = true;
    });
    var defaults = PROCESOS_DEFAULT
      .filter(function (d) { return !existentes[String(d.nombre).toLowerCase().trim()]; })
      .map(function (d) { return { value: d.id, label: d.nombre, source: 'default' }; });
    return defaults.concat(fromMatriz);
  }

  function _sectionCardHeader(sec, title) {
    return (
      '<header class="km-editor-section__head">' +
        '<span class="km-editor-section__icon"><i class="bi bi-' + sec.icon + '"></i></span>' +
        '<h3 class="km-editor-section__title">' + _esc(title) + '</h3>' +
      '</header>'
    );
  }

  function _sectionCardOpen(key, title, icon) {
    var sec = { icon: icon };
    return '<section class="km-editor-section" id="' + _sectionAnchorId(key) + '">' +
      _sectionCardHeader(sec, title) +
      '<div class="km-editor-section__body">';
  }
  function _sectionCardClose() {
    return '</div></section>';
  }

  function _field(label, name, value, opts) {
    opts = opts || {};
    var req = opts.required ? ' <span class="km-editor-required">*</span>' : '';
    var input = '';
    if (opts.type === 'select') {
      input = '<select class="km-editor-field__select" name="' + name + '"' + (opts.required ? ' required' : '') + '>' +
        _buildSelect(name, opts.options || [], value, opts.placeholder) + '</select>';
    } else if (opts.type === 'textarea') {
      input = '<textarea class="km-editor-field__textarea" name="' + name + '" rows="' + (opts.rows || 2) + '" placeholder="' + _esc(opts.placeholder || '') + '">' + _esc(value || '') + '</textarea>';
    } else {
      var t = opts.type || 'text';
      input = '<input class="km-editor-field__input" type="' + t + '" name="' + name + '" value="' + _esc(value || '') + '"' +
        (opts.placeholder ? ' placeholder="' + _esc(opts.placeholder) + '"' : '') +
        (opts.min != null ? ' min="' + opts.min + '"' : '') +
        (opts.max != null ? ' max="' + opts.max + '"' : '') +
        ' />';
    }
    var cls = 'km-editor-field' + (opts.full ? ' km-editor-field--full' : '');
    return (
      '<div class="' + cls + '">' +
        '<label class="km-editor-field__label">' + _esc(label) + req + '</label>' +
        input +
      '</div>'
    );
  }

  function _selectWithAdd(label, name, value, options, opts) {
    opts = opts || {};
    var req = opts.required ? ' <span class="km-editor-required">*</span>' : '';
    var placeholder = opts.placeholder || 'Selecciona...';
    var addable = opts.addable !== false;
    var input =
      '<div class="km-editor-field__select-wrap">' +
        '<select class="km-editor-field__select" name="' + name + '"' + (opts.required ? ' required' : '') + '>' +
          _buildSelect(name, options, value, placeholder) +
        '</select>' +
        (addable ? '<button type="button" class="km-editor-add-btn" data-add="' + name + '" title="Agregar nuevo"><i class="bi bi-plus"></i></button>' : '') +
      '</div>';
    var cls = 'km-editor-field' + (opts.full ? ' km-editor-field--full' : '');
    return (
      '<div class="' + cls + '">' +
        '<label class="km-editor-field__label">' + _esc(label) + req + '</label>' +
        input +
      '</div>'
    );
  }

  /* --- Section 1: Datos básicos --- */
  function _renderSectionDatos() {
    var matriz = _state.matriz || { sedes: [] };
    var sedesOpts = (matriz.sedes || []).map(function (s) { return { value: s.id, label: s.nombre }; });
    var sede = (matriz.sedes || []).filter(function (s) { return s.id === _state.data.sedeId; })[0];
    /* F21.56 — Selector de Proceso ahora mezcla: defaults (Administrativo,
       Operativo) + procesos reales de la matriz de la sede seleccionada.
       Si el usuario ya tiene un proceso con el mismo nombre en la matriz,
       el default se oculta automaticamente para no duplicar. */
    var procesosOpts = _buildProcesosOpts(sede);
    /* F21.56 — Para el sub-select de Cargo, si el procesoId actual es un
       default (no existe en la matriz), no hay cargos para mostrar. */
    var proc = sede && (sede.procesos || []).filter(function (p) { return p.id === _state.data.procesoId; })[0];
    var cargosOpts = proc ? (proc.cargos || []).map(function (c) { return { value: c.id, label: c.nombre }; }) : [];

    var d = _state.data;
    return _sectionCardOpen('datos', 'Datos básicos', 'info-circle') +
      _selectWithAdd('Sede', 'sedeId', d.sedeId, sedesOpts, { required: true, addable: true }) +
      _selectWithAdd('Proceso', 'procesoId', d.procesoId, procesosOpts, { required: true, addable: false }) +
      _field('Zona / Lugar', 'zona', d.zona, { placeholder: 'Ej: Piso 2, área de producción' }) +
      _selectWithAdd('Cargo / Actividad', 'cargoId', d.cargoId, cargosOpts, { required: true, addable: true, placeholder: d.procesoId ? 'Selecciona cargo...' : 'Selecciona sede y proceso' }) +
      _field('Tareas específicas', 'tareas', d.tareas, { type: 'textarea', rows: 3, required: true, full: true, placeholder: 'Describe las tareas...' }) +
      _field('Es rutinaria?', 'rutinaria', d.rutinaria, {
        type: 'select', required: true,
        options: [{ value: 'Si', label: 'Sí' }, { value: 'No', label: 'No' }],
        placeholder: 'Selecciona...'
      }) +
      _field('N° de expuestos', 'expuestos', d.expuestos, { type: 'number', min: 0 }) +
      _sectionCardClose();
  }

  /* --- Section 2: Peligro y efectos --- */
  function _renderSectionPeligro() {
    var opts = _state.gtc45Options || { tipos: [] };
    var tiposOpts = (opts.tipos || []).map(function (t) { return { value: t, label: t }; });
    var d = _state.data;
    return _sectionCardOpen('peligro', 'Peligro y efectos', 'exclamation-triangle') +
      _selectWithAdd('Clasificación del peligro', 'tipo', d.tipo, tiposOpts, { required: true, addable: true, placeholder: 'Selecciona...' }) +
      _field('Descripción del peligro', 'peligro', d.peligro, { type: 'textarea', rows: 2, required: true, full: true, placeholder: 'Ej: Postura habitual, caída de escaleras...' }) +
      _field('Efectos posibles', 'efectosPosibles', d.efectosPosibles, { type: 'textarea', rows: 2, required: true, full: true, placeholder: 'Ej: Lesiones, fatiga visual...' }) +
      _field('Peor consecuencia', 'peorConsecuencia', d.peorConsecuencia, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Muerte, incapacidad permanente...' }) +
      _sectionCardClose();
  }

  /* --- Section 3: Controles existentes --- */
  function _renderSectionControles() {
    var d = _state.data;
    return _sectionCardOpen('controles', 'Controles existentes', 'shield-check') +
      _field('Control en la fuente', 'controlFuente', d.controlFuente, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Pasamanos, protección partes rotativas...' }) +
      _field('Control en el medio', 'controlMedio', d.controlMedio, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Ventilación, aislamiento acústico...' }) +
      _field('Control en la persona', 'controlPersona', d.controlPersona, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Capacitación, EPP, procedimientos...' }) +
      _sectionCardClose();
  }

  /* --- Section 4: Evaluación del riesgo (auto-cálculo GTC 45) --- */
  function _renderSectionEvaluacion() {
    var opts = _state.gtc45Options || { nd: [], ne: [], nc: [] };
    var ndOpts = (opts.nd || []).map(function (o) { return { value: o.value, label: o.label }; });
    var neOpts = (opts.ne || []).map(function (o) { return { value: o.value, label: o.label }; });
    var ncOpts = (opts.nc || []).map(function (o) { return { value: o.value, label: o.label }; });

    var d = _state.data;
    return _sectionCardOpen('evaluacion', 'Evaluación del riesgo (auto-cálculo GTC 45)', 'speedometer2') +
      '<div class="km-editor-eval-internal-banner">' +
        '<i class="bi bi-info-circle"></i>' +
        '<span>Selecciona ND, NE y NC. El sistema calcula automáticamente NP, NR, interpretaciones y aceptabilidad.</span>' +
      '</div>' +
      '<div class="km-editor-grid km-editor-grid--three km-editor-field--full">' +
        _field('ND', 'nd', d.nd, { type: 'select', required: true, options: ndOpts }) +
        _field('NE', 'ne', d.ne, { type: 'select', required: true, options: neOpts }) +
        _field('NC', 'nc', d.nc, { type: 'select', required: true, options: ncOpts }) +
      '</div>' +
      '<div class="km-editor-resultado" data-eval-preview>' +
        '<div class="km-editor-resultado__title">RESULTADO (AUTOMATICO)</div>' +
        '<div class="km-editor-resultado__grid" data-eval-preview-content></div>' +
      '</div>' +
      _sectionCardClose();
  }

  /* RESULTADO panel unificado (4 columnas: NP / NC / NR / Aceptabilidad) */
  function _renderEvalPreviewContent() {
    var d = _state.data;
    var nd = d.nd, ne = d.ne, nc = d.nc;
    var np = KM.calcNP(nd, ne);
    var nr = KM.calcNR(np, nc);
    var interpNp = KM.interpNP(np);
    var interpNr = KM.interpNR(nr);
    return (
      '<div class="km-editor-resultado__col">' +
        '<div class="km-editor-resultado__value">' + (np != null ? np : '0') + '</div>' +
        '<div class="km-editor-resultado__formula">NP=NDxNE</div>' +
        '<span class="km-editor-resultado__chip km-badge km-badge--' + (interpNp.tone || 'info') + '">' + _esc(interpNp.label || '—') + '</span>' +
      '</div>' +
      '<div class="km-editor-resultado__col">' +
        '<div class="km-editor-resultado__value">' + (nc != null ? nc : '0') + '</div>' +
        '<div class="km-editor-resultado__formula">NC</div>' +
        '<span class="km-editor-resultado__chip">&nbsp;</span>' +
      '</div>' +
      '<div class="km-editor-resultado__col">' +
        '<div class="km-editor-resultado__value">' + (nr != null ? nr : '0') + '</div>' +
        '<div class="km-editor-resultado__formula">NR=NPxNC</div>' +
        (interpNr.nivel
          ? '<span class="km-editor-resultado__chip km-badge km-badge--' + interpNr.tone + '">Nivel ' + _esc(interpNr.nivel) + '</span>'
          : '<span class="km-editor-resultado__chip">&nbsp;</span>') +
      '</div>' +
      '<div class="km-editor-resultado__col km-editor-resultado__col--acept">' +
        '<div class="km-editor-resultado__formula">Aceptabilidad</div>' +
        (interpNr.label
          ? '<span class="km-editor-resultado__chip km-badge km-badge--' + interpNr.tone + '">' + _esc(interpNr.label) + '</span>'
          : '<span class="km-editor-resultado__chip">&nbsp;</span>') +
      '</div>'
    );
  }

  /* --- Section 5: Medidas de intervención (jerarquía 1-5 según GTC-45) --- */
  function _renderSectionMedidas() {
    var d = _state.data;
    return _sectionCardOpen('medidas', 'Medidas de intervención', 'hammer') +
      _field('1. Eliminación', 'medidaEliminacion', d.medidaEliminacion, { type: 'textarea', rows: 2, full: true, placeholder: 'Eliminar el peligro...' }) +
      _field('2. Sustitución', 'medidaSustitucion', d.medidaSustitucion, { type: 'textarea', rows: 2, full: true, placeholder: 'Reemplazar por algo menos peligroso...' }) +
      _field('3. Ingeniería', 'medidaIngenieria', d.medidaIngenieria, { type: 'textarea', rows: 2, full: true, placeholder: 'Modificar instalaciones o equipos...' }) +
      _field('4. Administrativos', 'medidaAdministrativos', d.medidaAdministrativos, { type: 'textarea', rows: 2, full: true, placeholder: 'Procedimientos, capacitación...' }) +
      _field('5. EPP', 'medidaEpp', d.medidaEpp, { type: 'textarea', rows: 2, full: true, placeholder: 'Casco, gafas, guantes...' }) +
      _sectionCardClose();
  }

  /* ---------------- Modal rápido para agregar entidades (botones "+") ---------------- */

  var _quickAddState = { field: null, overlay: null };

  function _quickAddConfig(field) {
    var configs = {
      sedeId: {
        title: 'Agregar sede',
        icon: 'bi-building',
        fields: [
          { name: 'nombre', label: 'Nombre de la sede', required: true, placeholder: 'Ej: Sede Principal' }
        ],
        save: function(data) {
          if (!global.KMService || !global.KMService.addSede) return Promise.reject(new Error('Servicio no disponible'));
          return global.KMService.addSede(_state.companyName, data.nombre);
        },
        onSuccess: function(res, data) {
          if (res && res.success && res.data && res.data.id) {
            /* F21.55 (2026-06-23) — El bug original: solo se actualizaba
               _state.data.sedeId pero no se insertaba la nueva sede en
               _state.matriz.sedes, asi que al hacer _refresh() el <select>
               se reconstruia sin la opcion nueva y el value quedaba huerfano
               (select visualmente vacio). Ahora tambien empujamos la sede al
               arbol de la matriz para que el select la muestre y la marque. */
            var newSede = {
              id: res.data.id,
              nombre: res.data.nombre || data.nombre,
              procesos: []
            };
            _state.data.sedeId = newSede.id;
            _state.data.sede = newSede.nombre;
            if (!_state.matriz) _state.matriz = { sedes: [] };
            if (!_state.matriz.sedes) _state.matriz.sedes = [];
            var dup = _state.matriz.sedes.filter(function (s) { return s.id === newSede.id; })[0];
            if (!dup) _state.matriz.sedes.push(newSede);
          }
        }
      },
      procesoId: {
        title: 'Agregar proceso',
        icon: 'bi-diagram-3',
        fields: [
          { name: 'nombre', label: 'Nombre del proceso', required: true, placeholder: 'Ej: Operativo' }
        ],
        save: function(data) {
          if (!global.KMService || !global.KMService.addProceso) return Promise.reject(new Error('Servicio no disponible'));
          var sedeId = _state.data.sedeId;
          if (!sedeId) return Promise.reject(new Error('Selecciona una sede primero'));
          return global.KMService.addProceso(_state.companyName, sedeId, data.nombre);
        },
        onSuccess: function(res, data) {
          if (res && res.success && res.data && res.data.id) {
            /* F21.55 — Mismo patron que sedeId: actualizar el arbol matriz
               ademas de _state.data para que el <select> muestre el nuevo
               proceso. El proceso se cuelga de la sede actualmente
               seleccionada (_state.data.sedeId). */
            var newProceso = {
              id: res.data.id,
              nombre: res.data.nombre || data.nombre,
              cargos: []
            };
            _state.data.procesoId = newProceso.id;
            _state.data.proceso = newProceso.nombre;
            if (_state.matriz && _state.matriz.sedes) {
              var sede = _state.matriz.sedes.filter(function (s) { return s.id === _state.data.sedeId; })[0];
              if (sede) {
                if (!sede.procesos) sede.procesos = [];
                var dup = sede.procesos.filter(function (p) { return p.id === newProceso.id; })[0];
                if (!dup) sede.procesos.push(newProceso);
              }
            }
          }
        }
      },
      cargoId: {
        title: 'Agregar cargo / actividad',
        icon: 'bi-person-workspace',
        /* F21.58 (2026-06-23) — El modal de cargo ahora SOLO pide el nombre.
           Antes tenia 4 campos (nombre, zona, actividades, tareas) con la
           idea de pre-rellenar el form del peligro, pero el backend
           (addCargo) solo persiste el nombre, asi que los otros 3 se
           quedaban en variables locales y se perdian al cerrar la sesion.
           Era placebo visual: el usuario llenaba 3 casillas que nunca
           se guardaban. Ahora se quitan — el usuario llena zona y tareas
           directamente en el formulario del peligro, que es donde tienen
           sentido en el flujo GTC-45. actividades se elimina del
           formulario del cargo porque ademas nunca existio como campo
           en el form del peligro (seria metadata huerfana). */
        fields: [
          { name: 'nombre', label: 'Nombre del cargo', required: true, placeholder: 'Ej: Operario' }
        ],
        save: function(data) {
          if (!global.KMService || !global.KMService.addCargo) return Promise.reject(new Error('Servicio no disponible'));
          var procesoId = _state.data.procesoId;
          if (!procesoId) return Promise.reject(new Error('Selecciona un proceso primero'));
          /* F21.59 (2026-06-23) — Auto-promover proceso default a proceso
             real. Si el usuario selecciono un proceso de PROCESOS_DEFAULT
             (id pro_def_*), ese id es virtual y no existe en la matriz del
             backend, asi que addCargo fallaba con "Proceso no encontrado".
             Solucion: detectar el default, crear el proceso real con
             addProceso, actualizar el id en _state.data, y solo entonces
             llamar addCargo con el id real. Asi el primer cargo bajo un
             proceso default "materializa" el proceso en la empresa. */
          if (procesoId.indexOf('pro_def_') === 0) {
            var defProc = PROCESOS_DEFAULT.filter(function (p) { return p.id === procesoId; })[0];
            if (!defProc) return Promise.reject(new Error('Proceso default no encontrado'));
            var sedeIdForProc = _state.data.sedeId;
            if (!sedeIdForProc) return Promise.reject(new Error('Selecciona una sede primero'));
            return global.KMService.addProceso(_state.companyName, sedeIdForProc, defProc.nombre).then(function (pr) {
              if (!pr || !pr.success || !pr.data || !pr.data.id) {
                return Promise.reject(new Error((pr && pr.error && pr.error.message) || 'No se pudo crear el proceso'));
              }
              /* Actualizar state con el id real del proceso para que
                 onSuccess lo use al insertar el cargo en _state.matriz */
              _state.data.procesoId = pr.data.id;
              _state.data.proceso = pr.data.nombre || defProc.nombre;
              /* Insertar el proceso real en _state.matriz local para que
                 el dropdown de Proceso deje de mostrar el default y muestre
                 el proceso ya materializado */
              if (_state.matriz && _state.matriz.sedes) {
                var sedeForProc = _state.matriz.sedes.filter(function (s) { return s.id === sedeIdForProc; })[0];
                if (sedeForProc) {
                  if (!sedeForProc.procesos) sedeForProc.procesos = [];
                  var dupP = sedeForProc.procesos.filter(function (p) { return p.id === pr.data.id; })[0];
                  if (!dupP) sedeForProc.procesos.push({ id: pr.data.id, nombre: pr.data.nombre || defProc.nombre, cargos: [] });
                }
              }
              /* Ahora si, crear el cargo con el id real del proceso */
              return global.KMService.addCargo(_state.companyName, pr.data.id, data.nombre);
            });
          }
          return global.KMService.addCargo(_state.companyName, procesoId, data.nombre);
        },
        onSuccess: function(res, data) {
          if (res && res.success && res.data && res.data.id) {
            /* F21.55 + F21.58 — Ademas de pintar el cargo en _state.data,
               lo insertamos en el arbol _state.matriz (dentro del proceso
               actualmente seleccionado) para que el <select> lo refleje.
               Ahora newCargo solo lleva id+nombre (lo unico que persiste
               el backend); zona/actividades/tareas se llenan despues en
               el form del peligro si el usuario los necesita. */
            var newCargo = {
              id: res.data.id,
              nombre: res.data.nombre || data.nombre
            };
            _state.data.cargoId = newCargo.id;
            _state.data.cargo = newCargo.nombre;
            if (_state.matriz && _state.matriz.sedes) {
              var sede = _state.matriz.sedes.filter(function (s) { return s.id === _state.data.sedeId; })[0];
              if (sede && sede.procesos) {
                var proc = sede.procesos.filter(function (p) { return p.id === _state.data.procesoId; })[0];
                if (proc) {
                  if (!proc.cargos) proc.cargos = [];
                  var dup = proc.cargos.filter(function (c) { return c.id === newCargo.id; })[0];
                  if (!dup) proc.cargos.push(newCargo);
                }
              }
            }
          }
        }
      },
      tipo: {
        title: 'Agregar clasificación de peligro',
        icon: 'bi-tags',
        fields: [
          { name: 'nombre', label: 'Nombre de la clasificación', required: true, placeholder: 'Ej: Físico-Químico' }
        ],
        save: function(data) {
          return new Promise(function(resolve) {
            if (!global.KM || !global.KM.GTC45 || !global.KM.GTC45.tipos) {
              resolve({ success: false, error: { message: 'No se puede agregar clasificación' } });
              return;
            }
            var tipos = global.KM.GTC45.tipos;
            if (tipos.indexOf(data.nombre) === -1) tipos.push(data.nombre);
            resolve({ success: true, data: { nombre: data.nombre } });
          });
        },
        onSuccess: function(res, data) {
          _state.data.tipo = data.nombre;
          if (_state.gtc45Options && _state.gtc45Options.tipos) {
            if (_state.gtc45Options.tipos.indexOf(data.nombre) === -1) {
              _state.gtc45Options.tipos.push(data.nombre);
            }
          }
        }
      }
    };
    return configs[field] || null;
  }

  function _renderQuickAddModal(field) {
    var cfg = _quickAddConfig(field);
    if (!cfg) return '';
    var fieldsHtml = cfg.fields.map(function(f) {
      return (
        '<div class="km-editor-field">' +
          '<label class="km-editor-field__label">' + _esc(f.label) + (f.required ? ' <span class="km-editor-required">*</span>' : '') + '</label>' +
          '<input type="text" class="km-editor-field__input" name="quickadd-' + f.name + '" value="" placeholder="' + _esc(f.placeholder || '') + '"' + (f.required ? ' required' : '') + ' />' +
        '</div>'
      );
    }).join('');
    return (
      '<div class="km-modal-overlay" id="km-quickadd-overlay" style="z-index:10000">' +
        '<div class="km-modal" style="max-width:440px">' +
          '<div class="km-modal__header">' +
            '<h3 class="km-modal__title"><i class="bi ' + cfg.icon + '"></i> ' + _esc(cfg.title) + '</h3>' +
            '<button type="button" class="km-modal__close" id="km-quickadd-close" aria-label="Cerrar"><i class="bi bi-x-lg"></i></button>' +
          '</div>' +
          '<div class="km-modal__body">' + fieldsHtml + '</div>' +
          '<div class="km-modal__footer">' +
            '<button type="button" class="km-btn km-btn--ghost" id="km-quickadd-cancel">Cancelar</button>' +
            '<button type="button" class="km-btn km-btn--primary" id="km-quickadd-save">Crear</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _openQuickAdd(field) {
    if (_quickAddState.overlay) { _quickAddState.overlay.remove(); _quickAddState.overlay = null; }
    var html = _renderQuickAddModal(field);
    if (!html) return;
    _quickAddState.field = field;
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    _quickAddState.overlay = tmp.firstChild;
    /* F21.54 (2026-06-23) — El bug: position:fixed se rompe en Edge/Chromium
       cuando un contenedor ancestro (body, #main-content, .km-wrapper, etc)
       tiene overflow:hidden/auto. Esos contenedores se convierten en scroll
       containers y position:fixed se comporta como absolute relativo al padre.
       Mitigacion: cuando abrimos el modal, guardamos el overflow del body y
       lo cambiamos a 'visible' para que body deje de ser scroll container.
       Tambien anadimos overflow:visible al html y al #main-content por si
       alguno de ellos esta rompiendo el fixed. Al cerrar restauramos todo. */
    _quickAddState._savedOverflow = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
      mainContent: (document.getElementById('main-content') || {}).style
        ? document.getElementById('main-content').style.overflow : null
    };
    document.body.style.overflow = 'visible';
    document.documentElement.style.overflow = 'visible';
    var mainContentEl = document.getElementById('main-content');
    if (mainContentEl) mainContentEl.style.overflow = 'visible';
    document.body.appendChild(_quickAddState.overlay);
    _bindQuickAddModal(field);
  }

  function _closeQuickAdd() {
    if (_quickAddState.overlay) { _quickAddState.overlay.remove(); _quickAddState.overlay = null; }
    _quickAddState.field = null;
    /* F21.54 — Restaurar overflow que guardamos al abrir el modal */
    if (_quickAddState._savedOverflow) {
      document.body.style.overflow = _quickAddState._savedOverflow.body;
      document.documentElement.style.overflow = _quickAddState._savedOverflow.html;
      var mainContentEl = document.getElementById('main-content');
      if (mainContentEl && _quickAddState._savedOverflow.mainContent != null) {
        mainContentEl.style.overflow = _quickAddState._savedOverflow.mainContent;
      }
      _quickAddState._savedOverflow = null;
    }
  }

  function _bindQuickAddModal(field) {
    var overlay = _quickAddState.overlay;
    if (!overlay) return;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) _closeQuickAdd(); });
    var closeBtn = overlay.querySelector('#km-quickadd-close');
    if (closeBtn) closeBtn.addEventListener('click', _closeQuickAdd);
    var cancelBtn = overlay.querySelector('#km-quickadd-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', _closeQuickAdd);
    var saveBtn = overlay.querySelector('#km-quickadd-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        var cfg = _quickAddConfig(field);
        if (!cfg) return;
        var data = {};
        var missing = false;
        cfg.fields.forEach(function(f) {
          var input = overlay.querySelector('[name="quickadd-' + f.name + '"]');
          var val = input ? input.value.trim() : '';
          data[f.name] = val;
          if (f.required && !val) missing = true;
        });
        if (missing) {
          KM.notify('Campos incompletos', 'Completa los campos obligatorios', 'warning', 4000);
          return;
        }
        saveBtn.disabled = true;
        cfg.save(data).then(function(res) {
          saveBtn.disabled = false;
          if (res && res.success) {
            KM.notify(cfg.title + ' creado', '', 'success', 3000);
            cfg.onSuccess(res, data);
            _closeQuickAdd();
            _refresh();
          } else {
            KM.notify('Error', (res && res.error && res.error.message) || 'No se pudo crear', 'error', 5000);
          }
        }).catch(function(err) {
          saveBtn.disabled = false;
          KM.notify('Error', (err && err.message) || 'Error inesperado', 'error', 5000);
        });
      });
    }
  }

  /* ---------------- Render: top-level ---------------- */

  function _render() {
    if (!_state || !_state.container) return;
    var html = (
      '<div class="km-editor-view">' +
        '<aside class="km-editor-sidebar">' + _renderSidebar() + '</aside>' +
        '<main class="km-editor-main">' +
          _renderBanner() +
          '<div class="km-editor-content">' +
            _renderSectionDatos() +
            _renderSectionPeligro() +
            _renderSectionControles() +
            _renderSectionEvaluacion() +
            _renderSectionMedidas() +
          '</div>' +
        '</main>' +
        '<footer class="km-editor-footer">' + _renderFooter() + '</footer>' +
      '</div>'
    );
    _state.container.innerHTML = html;
    /* Pintar preview NP/NR dentro del bloque de evaluación */
    var previewContent = _state.container.querySelector('[data-eval-preview-content]');
    if (previewContent) previewContent.innerHTML = _renderEvalPreviewContent();
  }

  function _refresh() {
    _render();
    _bind();
  }

  /* ---------------- Bind events ---------------- */

  function _collectForm() {
    if (!_state || !_state.container) return;
    var inputs = _state.container.querySelectorAll('[name]');
    inputs.forEach(function (el) {
      if (!el.name) return;
      _state.data[el.name] = el.value;
    });
  }

  function _bind() {
    if (!_state || !_state.container) return;

    /* Cascading selects */
    var sedeSel = _state.container.querySelector('[name="sedeId"]');
    if (sedeSel) sedeSel.addEventListener('change', function () {
      _collectForm();
      _onSedeChange(sedeSel.value);
    });
    var procSel = _state.container.querySelector('[name="procesoId"]');
    if (procSel) procSel.addEventListener('change', function () {
      _collectForm();
      _onProcesoChange(procSel.value);
    });
    var cargoSel = _state.container.querySelector('[name="cargoId"]');
    if (cargoSel) cargoSel.addEventListener('change', function () {
      _collectForm();
      _onCargoChange(cargoSel.value);
    });

    /* Live update para ND/NE/NC (preview NP/NR) */
    ['nd', 'ne', 'nc'].forEach(function (k) {
      var el = _state.container.querySelector('[name="' + k + '"]');
      if (el) el.addEventListener('change', function () {
        _state.data[k] = el.value;
        var previewContent = _state.container.querySelector('[data-eval-preview-content]');
        if (previewContent) previewContent.innerHTML = _renderEvalPreviewContent();
        _updateBanner();
        _updateFooterHint();
        _updateSidebarBadges();
      });
    });

    /* Sidebar nav: scroll a la sección */
    var sideItems = _state.container.querySelectorAll('[data-jump]');
    sideItems.forEach(function (li) {
      li.addEventListener('click', function () {
        var key = li.getAttribute('data-jump');
        var target = _state.container.querySelector('#' + _sectionAnchorId(key));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* Botones "+" → modal rápido de creación */
    var addBtns = _state.container.querySelectorAll('[data-add]');
    addBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.getAttribute('data-add');
        _openQuickAdd(field);
      });
    });

    /* Footer actions */
    var footerBtns = _state.container.querySelectorAll('[data-footer-action]');
    footerBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-footer-action');
        if (action === 'cancel') return _cancel();
        if (action === 'save') return _save(false);
        if (action === 'save-close') return _save(true);
      });
    });

    /* Live status badges para sidebar (cuando cambian inputs) */
    if (_inputChangeHandler) _state.container.removeEventListener('input', _inputChangeHandler);
    /* F21.60 — Bug critico: antes este handler solo llamaba a
       _updateSidebarBadges() (que re-pinta el sidebar), pero no sincronizaba
       _state.data con los valores actuales del formulario. Resultado: el
       usuario llenaba "Datos basicos" completo (Sede, Proceso, Cargo, Zona,
       Tareas, Rutinaria, Expuestos) pero el sidebar seguia mostrando
       "Pendiente" porque _state.data estaba desactualizado (solo se actualiza
       en los handlers explicitos de sede/proceso/cargo via _collectForm).
       Fix: llamar _collectForm() PRIMERO para refrescar _state.data desde
       los inputs actuales, y LUEGO repintar el sidebar. Asi el status se
       calcula con la realidad del formulario, no con datos viejos. */
    _inputChangeHandler = function () { _collectForm(); _updateSidebarBadges(); };
    _state.container.addEventListener('input', _inputChangeHandler);
    _state.container.addEventListener('change', _inputChangeHandler);

    /* ESC = cancelar (solo si no hay focus en textarea/input) */
    if (_docKeyHandler) document.removeEventListener('keydown', _docKeyHandler);
    _docKeyHandler = function (e) {
      if (e.key !== 'Escape') return;
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      _cancel();
    };
    document.addEventListener('keydown', _docKeyHandler);
  }

  function _updateFooterHint() {
    if (!_state || !_state.container) return;
    var hint = _state.container.querySelector('.km-editor-footer__hint');
    if (!hint) return;
    var d = _state.data;
    var np = KM.calcNP(d.nd, d.ne);
    var nr = KM.calcNR(np, d.nc);
    var showHint = (d.nd != null && d.nd !== '') && (d.ne != null && d.ne !== '') && (d.nc != null && d.nc !== '');
    var txt = showHint ? 'NP = ' + np + ' · NR = ' + nr : 'Selecciona ND, NE y NC para ver el cálculo';
    hint.innerHTML = '<i class="bi bi-calculator"></i> ' + _esc(txt);
  }

  function _updateSidebarBadges() {
    if (!_state || !_state.container) return;
    /* F21.57 (2026-06-23) — Bug critico que descubrimos al ver la captura:
       _renderSidebar() devuelve 3 elementos hermanos (title, ul con items,
       progress con COMPLETITUD), no un contenedor unico. El codigo anterior
       hacia tmp.firstChild para obtener "el sidebar nuevo", pero firstChild
       es SOLO el title (<div>SECCIONES</div>), y sidebar.replaceWith(title)
       reemplazaba el <aside> ENTERO por un unico div de titulo, borrando
       la lista de secciones y el bloque de completitud. Resultado visible:
       sidebar mostraba solo "SECCIONES" y el resto quedaba en blanco.

       Fix: en vez de replaceWith el <aside>, setear sidebar.innerHTML con
       el render. Asi el <aside> se preserva y solo cambian sus hijos. */
    var sidebar = _state.container.querySelector('.km-editor-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = _renderSidebar();
  }

  function _updateBanner() {
    if (!_state || !_state.container) return;
    var banner = _state.container.querySelector('[data-banner]');
    if (!banner) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = _renderBanner();
    var newBanner = tmp.firstChild;
    if (newBanner) banner.replaceWith(newBanner);
  }

  /* ---------------- Save / Cancel ---------------- */

  function _save(closeAfter) {
    if (!_state || !_state.companyName) { KM.notify('Sin empresa', 'No hay empresa activa', 'error', 6000); return; }
    _collectForm();
    var d = _state.data;

    /* Required mínimos */
    if (!d.sedeId || !d.procesoId || !d.cargoId || !d.tareas || String(d.tareas).trim() === '' || !d.rutinaria) {
      KM.notify('Sección "Datos básicos" incompleta', 'Selecciona sede, proceso, cargo, tareas y rutinaria', 'warning', 5000);
      var sec = _state.container.querySelector('#' + _sectionAnchorId('datos'));
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!d.tipo || !d.peligro || !d.efectosPosibles) {
      KM.notify('Sección "Peligro y efectos" incompleta', 'Faltan campos obligatorios', 'warning', 5000);
      var sec2 = _state.container.querySelector('#' + _sectionAnchorId('peligro'));
      if (sec2) sec2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (d.nd == null || d.nd === '' || d.ne == null || d.ne === '' || d.nc == null || d.nc === '') {
      KM.notify('Sección "Evaluación" incompleta', 'Selecciona ND, NE y NC', 'warning', 5000);
      var sec3 = _state.container.querySelector('#' + _sectionAnchorId('evaluacion'));
      if (sec3) sec3.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    var np = KM.calcNP(d.nd, d.ne);
    var nr = KM.calcNR(np, d.nc);
    var interpNp = KM.interpNP(np);
    var interpNr = KM.interpNR(nr);
    var payload = Object.assign({}, d, {
      np: np,
      nr: nr,
      npInterpretacion: interpNp.label,
      nrNivel: interpNr.nivel,
      nrLabel: interpNr.label,
      updatedAt: new Date().toISOString()
    });

    var p;
    if (_state.mode === 'edit' && payload.id) {
      p = global.KMService.updatePeligro(_state.companyName, payload.id, payload);
    } else {
      payload.createdAt = new Date().toISOString();
      p = global.KMService.addPeligro(_state.companyName, d.cargoId, payload);
    }

    p.then(function (r) {
      if (r && r.success) {
        var savedId = (r.data && r.data.id) || payload.id || '';
        KM.notify(
          _state.mode === 'edit' ? 'Peligro actualizado' : 'Peligro creado',
          savedId ? ('ID: ' + savedId) : '',
          'success'
        );
        try { document.dispatchEvent(new CustomEvent('km:peligros-changed')); } catch (e) {}
        if (closeAfter) {
          if (typeof _state.onSaved === 'function') _state.onSaved(r.data);
          else try { document.dispatchEvent(new CustomEvent('km:close-editor')); } catch (e) {}
        } else {
          _state.mode = 'edit';
          if (r.data && r.data.id) _state.data.id = r.data.id;
          _updateSidebarBadges();
        }
      } else {
        KM.notify('Error al guardar', (r && r.error && r.error.message) || 'Error desconocido', 'error', 6000);
      }
    }).catch(function (err) {
      KM.notify('Error inesperado', (err && err.message) || 'Sin detalles', 'error', 6000);
    });
  }

  function _cancel() {
    if (typeof _state.onCancel === 'function') _state.onCancel();
    else try { document.dispatchEvent(new CustomEvent('km:close-editor')); } catch (e) {}
  }

  /* ---------------- Public API ---------------- */

  Editor.render = function (container, opts) {
    opts = opts || {};
    _state = {
      container: container,
      companyName: opts.companyName || null,
      mode: opts.mode || 'new',
      data: Object.assign({}, opts.data || {}),
      gtc45Options: opts.gtc45Options || null,
      matriz: opts.matriz || { sedes: [] },
      onSaved: opts.onSaved || null,
      onCancel: opts.onCancel || null
    };

    var work = Promise.resolve();
    if (!_state.gtc45Options) work = work.then(_loadGtc45Options);
    work = work.then(_loadMatriz).then(function (matriz) {
      _state.matriz = matriz;
      _render();
      _bind();
    });
    return work;
  };

  Editor.refresh = function () {
    if (!_state) return;
    _loadMatriz().then(function (m) {
      _state.matriz = m;
      _refresh();
    });
  };

  Editor.destroy = function () {
    _closeQuickAdd();
    if (_state && _state.container) _state.container.innerHTML = '';
    if (_docKeyHandler) { document.removeEventListener('keydown', _docKeyHandler); _docKeyHandler = null; }
    if (_inputChangeHandler && _state && _state.container) {
      _state.container.removeEventListener('input', _inputChangeHandler);
      _state.container.removeEventListener('change', _inputChangeHandler);
    }
    _state = null;
  };

  /* Compatibilidad: API legacy modal sigue existiendo pero delega a render().
     Cualquier caller existente que use Editor.open() recibirá un warning
     y delegará a la nueva vista seccionada. */
  Editor.open = function (opts) {
    if (global.console && console.warn) {
      console.warn('[KMEditor] Editor.open() está deprecated. Usar Editor.render(container, opts).');
    }
    /* Fallback: si el caller aún pasa companyName + data, intentar montar */
    var c = document.createElement('div');
    c.id = 'km-editor-modal-overlay-fallback';
    c.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;overflow:auto;';
    document.body.appendChild(c);
    document.body.style.overflow = 'hidden';
    var cleanup = function () { c.remove(); document.body.style.overflow = ''; };
    return Editor.render(c, Object.assign({}, opts, { onCancel: cleanup })).then(cleanup);
  };

  Editor.close = function () { Editor.destroy(); };

  global.KMEditor = Editor;
  KM.log('PELIGROS', 'EDITOR_INIT', 'SUCCESS', 'vista seccionada cargada');
})(window);