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
    { key: 'datos',     icon: 'info-circle',         label: 'Datos básicos',           required: ['sedeId', 'procesoId', 'cargoId', 'tareas', 'expuestos'] },
    { key: 'peligro',   icon: 'exclamation-triangle',label: 'Peligro y efectos',       required: ['tipo', 'peligro', 'efectosPosibles'] },
    { key: 'controles', icon: 'shield-check',        label: 'Controles existentes',    required: [] },
    { key: 'evaluacion',icon: 'speedometer2',        label: 'Evaluación (auto)',       required: ['nd', 'ne', 'nc'] },
    { key: 'medidas',   icon: 'hammer',              label: 'Medidas de intervención', required: [] }
  ];

  /* Opcionales por sección (para status "complete" de secciones sin required) */
  var OPTIONAL_BY_SECTION = {
    controles: ['fuente', 'medio', 'individuo'],
    medidas:   ['eliminacion', 'sustitucion', 'controlIngenieria', 'senalizacion', 'epp']
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
    if (reqFilled === sec.required.length) return 'complete';
    if (reqFilled === 0) {
      var opt = OPTIONAL_BY_SECTION[sectionKey] || [];
      var hasAny = opt.some(function (k) { return d[k] && String(d[k]).trim() !== ''; });
      return hasAny ? 'partial' : 'empty';
    }
    return 'partial';
  }

  function _statusBadge(s) {
    var label = 'Nuevo';
    var variant = 'info';
    if (s === 'complete')   { label = 'Completo';   variant = 'success'; }
    if (s === 'partial')    { label = 'Pendiente';  variant = 'warning'; }
    if (s === 'sin-sede')   { label = 'Sin sede';   variant = 'neutral'; }
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

  function _renderSidebar() {
    var completitud = 0;
    var items = SECTIONS.map(function (sec) {
      var st = _sectionStatus(sec.key);
      if (st === 'complete') completitud++;
      return (
        '<li class="km-editor-side-item" data-jump="' + sec.key + '">' +
          '<span class="km-editor-side-icon"><i class="bi bi-' + sec.icon + '"></i></span>' +
          '<span class="km-editor-side-label">' + _esc(sec.label) + '</span>' +
          _statusBadge(st) +
        '</li>'
      );
    }).join('');

    return (
      '<div class="km-editor-sidebar__title">SECCIONES</div>' +
      '<ul class="km-editor-side-nav">' + items + '</ul>' +
      '<div class="km-editor-sidebar__progress">' +
        '<div class="km-editor-sidebar__progress-label">COMPLETITUD</div>' +
        '<div class="km-editor-sidebar__progress-count">' + completitud + '/' + SECTIONS.length + '</div>' +
        '<div class="km-editor-progress"><div class="km-editor-progress__bar" style="width:' + Math.round((completitud / SECTIONS.length) * 100) + '%"></div></div>' +
      '</div>'
    );
  }

  function _renderBanner() {
    return (
      '<div class="km-editor-banner">' +
        '<i class="bi bi-info-circle"></i>' +
        '<span>Completa todas las secciones para registrar el peligro en la matriz.</span>' +
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

    return (
      '<div class="km-editor-footer__hint"><i class="bi bi-calculator"></i> ' + _esc(hint) + '</div>' +
      '<div class="km-editor-footer__actions">' +
        '<button type="button" class="km-btn km-btn--ghost" data-footer-action="cancel">' +
          '<i class="bi bi-x"></i> Cancelar</button>' +
        '<button type="button" class="km-btn km-btn--outline" data-footer-action="save">' +
          '<i class="bi bi-save"></i> Guardar</button>' +
        '<button type="button" class="km-btn km-btn--primary" data-footer-action="save-close">' +
          '<i class="bi bi-check2-circle"></i> Crear y cerrar</button>' +
      '</div>'
    );
  }

  /* ---------------- Render: section cards ---------------- */

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
    return (
      '<div class="km-editor-field">' +
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
    var procesosOpts = sede ? (sede.procesos || []).map(function (p) { return { value: p.id, label: p.nombre }; }) : [];
    var proc = sede && (sede.procesos || []).filter(function (p) { return p.id === _state.data.procesoId; })[0];
    var cargosOpts = proc ? (proc.cargos || []).map(function (c) { return { value: c.id, label: c.nombre }; }) : [];

    var d = _state.data;
    return _sectionCardOpen('datos', 'Datos básicos', 'info-circle') +
      '<div class="km-editor-grid">' +
        _selectWithAdd('Sede', 'sedeId', d.sedeId, sedesOpts, { required: true, addable: true }) +
        _selectWithAdd('Proceso', 'procesoId', d.procesoId, procesosOpts, { required: true, addable: false }) +
        _field('Zona / Lugar', 'zona', d.zona, { placeholder: 'Ej: Piso 2, área de producción' }) +
        _selectWithAdd('Actividad', 'actividad', d.actividad, cargosOpts.length ? cargosOpts : [], { required: false, addable: false, placeholder: d.cargoId ? 'Actividad del cargo' : 'Selecciona sede y proceso' }) +
      '</div>' +
      _field('Tareas específicas', 'tareas', d.tareas, { type: 'textarea', rows: 3, required: true, full: true, placeholder: 'Describe las tareas...' }) +
      '<div class="km-editor-grid">' +
        _field('Es rutinaria?', 'rutinaria', d.rutinaria, {
          type: 'select', required: true,
          options: [{ value: 'Si', label: 'Sí' }, { value: 'No', label: 'No' }],
          placeholder: 'Selecciona...'
        }) +
        _field('N° de expuestos', 'expuestos', d.expuestos, { type: 'number', min: 0 }) +
      '</div>' +
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
      _field('Control en la fuente', 'fuente', d.fuente, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Pasamanos, protección partes rotativas...' }) +
      _field('Control en el medio', 'medio', d.medio, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Ventilación, aislamiento acústico...' }) +
      _field('Control en el individuo', 'individuo', d.individuo, { type: 'textarea', rows: 2, full: true, placeholder: 'Ej: Capacitación, EPP, procedimientos...' }) +
      _sectionCardClose();
  }

  /* --- Section 4: Evaluación (auto) --- */
  function _renderSectionEvaluacion() {
    var opts = _state.gtc45Options || { nd: [], ne: [], nc: [] };
    var ndOpts = (opts.nd || []).map(function (o) { return { value: o.value, label: o.label }; });
    var neOpts = (opts.ne || []).map(function (o) { return { value: o.value, label: o.label }; });
    var ncOpts = (opts.nc || []).map(function (o) { return { value: o.value, label: o.label }; });

    var d = _state.data;
    return _sectionCardOpen('evaluacion', 'Evaluación (auto)', 'speedometer2') +
      '<div class="km-editor-grid">' +
        _field('Nivel de deficiencia (ND)', 'nd', d.nd, { type: 'select', required: true, options: ndOpts }) +
        _field('Nivel de exposición (NE)', 'ne', d.ne, { type: 'select', required: true, options: neOpts }) +
        _field('Nivel de consecuencia (NC)', 'nc', d.nc, { type: 'select', required: true, options: ncOpts }) +
      '</div>' +
      '<div class="km-editor-eval-preview" data-eval-preview></div>' +
      _sectionCardClose();
  }

  function _renderEvalPreviewContent() {
    var d = _state.data;
    var nd = d.nd, ne = d.ne, nc = d.nc;
    var np = KM.calcNP(nd, ne);
    var nr = KM.calcNR(np, nc);
    var interpNp = KM.interpNP(np);
    var interpNr = KM.interpNR(nr);
    return (
      '<div class="km-editor-eval-preview__row">' +
        '<div class="km-editor-eval-preview__item">' +
          '<div class="km-editor-eval-preview__label">NP = ND × NE</div>' +
          '<div class="km-editor-eval-preview__value">' + (np != null ? np : '—') + '</div>' +
          '<div class="km-editor-eval-preview__sub">' + _esc(interpNp.label || '—') + '</div>' +
        '</div>' +
        '<div class="km-editor-eval-preview__item km-editor-eval-preview__item--nr">' +
          '<div class="km-editor-eval-preview__label">NR = NP × NC</div>' +
          '<div class="km-editor-eval-preview__value">' + (nr != null ? nr : '—') + '</div>' +
          '<div class="km-editor-eval-preview__sub">' +
            (interpNr.nivel ? ('Nivel ' + interpNr.nivel + ' · ') : '') +
            _esc(interpNr.label || '—') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* --- Section 5: Medidas de intervención --- */
  function _renderSectionMedidas() {
    var d = _state.data;
    return _sectionCardOpen('medidas', 'Medidas de intervención', 'hammer') +
      _field('Eliminación', 'eliminacion', d.eliminacion, { type: 'textarea', rows: 2, full: true, placeholder: '¿Se puede eliminar el peligro?' }) +
      _field('Sustitución', 'sustitucion', d.sustitucion, { type: 'textarea', rows: 2, full: true, placeholder: '¿Se puede sustituir por algo menos peligroso?' }) +
      _field('Controles de ingeniería', 'controlIngenieria', d.controlIngenieria, { type: 'textarea', rows: 2, full: true, placeholder: 'Guardas, barreras, ventilación, aislamiento...' }) +
      _field('Controles administrativos', 'senalizacion', d.senalizacion, { type: 'textarea', rows: 2, full: true, placeholder: 'Procedimientos, señalización, capacitación, rotación...' }) +
      _field('EPP', 'epp', d.epp, { type: 'textarea', rows: 2, full: true, placeholder: 'Elementos de protección personal requeridos...' }) +
      _sectionCardClose();
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
    var preview = _state.container.querySelector('[data-eval-preview]');
    if (preview) preview.innerHTML = _renderEvalPreviewContent();
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
        var preview = _state.container.querySelector('[data-eval-preview]');
        if (preview) preview.innerHTML = _renderEvalPreviewContent();
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

    /* Botones "+" → toast "Próximamente" */
    var addBtns = _state.container.querySelectorAll('[data-add]');
    addBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.getAttribute('data-add');
        var labels = { sedeId: 'sede', procesoId: 'proceso', tipo: 'clasificación', actividad: 'actividad' };
        KM.notify('Próximamente', 'Crear inline de ' + (labels[field] || field) + ' en próxima iteración', 'info', 3500);
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
    _inputChangeHandler = function () { _updateSidebarBadges(); };
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
    /* Re-render del sidebar sin tocar el resto (optimización ligera) */
    var sidebar = _state.container.querySelector('.km-editor-sidebar');
    if (!sidebar) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = _renderSidebar();
    var newSidebar = tmp.firstChild;
    if (newSidebar) sidebar.replaceWith(newSidebar);
  }

  /* ---------------- Save / Cancel ---------------- */

  function _save(closeAfter) {
    if (!_state || !_state.companyName) { KM.notify('Sin empresa', 'No hay empresa activa', 'error', 6000); return; }
    _collectForm();
    var d = _state.data;

    /* Required mínimos */
    if (!d.sedeId || !d.procesoId || !d.cargoId) {
      KM.notify('Sección "Datos básicos" incompleta', 'Selecciona sede, proceso y cargo', 'warning', 5000);
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