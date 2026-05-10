/* ==========================================================================
K+AIR — Módulo 4.1.2 Identificación de Peligros
Vista Matriz — Accordion 4-level (SedeCard > ProcesoBlock > CargoBlock > PeligroRow)
Click-to-edit cells · Sede filter · Stats bar · Expand/Collapse · Keyboard shortcuts
Patrón: window.MatrizView = { load, destroy } — Direct DOM
========================================================================== */
(function () {
  'use strict';

  var COLS = [
    { key: 'tipo', label: 'Tipo de\nPeligro', type: 'select-tipo', editable: true },
    { key: 'peligro', label: 'Peligro', type: 'text', editable: true },
    { key: 'efectosPosibles', label: 'Efectos\nPosibles', type: 'text', editable: true },
 { key: 'expuestos', label: 'Expuestos', type: 'number', editable: true },
  { key: 'peorConsecuencia', label: 'Peor\nConsecuencia', type: 'text', editable: true },
    { key: 'nd', label: 'ND', type: 'select-nd', editable: true },
    { key: 'ne', label: 'NE', type: 'select-ne', editable: true },
    { key: 'np', label: 'NP', type: 'computed', editable: false },
    { key: 'npInterpretacion', label: 'Interpretación\nNP', type: 'computed', editable: false },
    { key: 'nc', label: 'NC', type: 'select-nc', editable: true },
    { key: 'nr', label: 'NR', type: 'computed', editable: false },
    { key: 'nrNivel', label: 'Nivel de\nRiesgo', type: 'computed', editable: false },
    { key: 'nrLabel', label: 'Aceptabilidad', type: 'computed', editable: false },
    { key: 'criterioEstablecido', label: 'Criterio\nEstablecido', type: 'text', editable: true },
    { key: 'fuente', label: 'Fuente', type: 'text', editable: true },
    { key: 'medio', label: 'Medio', type: 'text', editable: true },
    { key: 'individuo', label: 'Individuo', type: 'text', editable: true },
    { key: 'medidasExistenteFuente', label: 'Medida\nFuente', type: 'text', editable: true },
    { key: 'medidasExistenteMedio', label: 'Medida\nMedio', type: 'text', editable: true },
    { key: 'medidasExistenteIndividuo', label: 'Medida\nIndividuo', type: 'text', editable: true },
    { key: 'medidasIntervencion', label: 'Medida\nIntervención', type: 'text', editable: true },
    { key: 'responsable', label: 'Responsable', type: 'text', editable: true },
    { key: 'plazo', label: 'Plazo', type: 'text', editable: true },
    { key: 'observaciones', label: 'Observaciones', type: 'text', editable: true }
  ];

  var DEBOUNCE_MS = 600;
var XLSX_SYNC_MS = 3000;

  var _companyName = null;
  var _matriz = null;
  var _stats = null;
  var _gtc45Options = null;
  var _saveTimer = null;
var _xlsxSyncTimer = null;
  var _pendingChanges = {};
  var _editingCellId = null;
  var _filterSede = '__all__';
  var _expandState = { sedes: {}, procesos: {}, cargos: {} };
  var _docClickHandler = null;
  var _keyHandler = null;

  /* ─── GTC-45 Color Palette ────────────────────────────────────────────── */
  var GTC45_COLORS = {
    'IV': { bg: '#b71c1c', fg: '#ffffff', light: '#fecaca', label: 'No Aceptable' },
    'III': { bg: '#e65100', fg: '#ffffff', light: '#ffedd5', label: 'No Aceptable N1' },
    'II': { bg: '#f57f17', fg: '#000000', light: '#fef9c3', label: 'Aceptable con control' },
    'I': { bg: '#1b5e20', fg: '#ffffff', light: '#dcfce7', label: 'Aceptable' },
    'V': { bg: '#4a148c', fg: '#ffffff', light: '#e9d5ff', label: 'No Aceptable N3' }
  };

  /* ─── Save engine ─────────────────────────────────────────────────────── */
  function _debouncedSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(function () {
      _flushPendingChanges();
    }, DEBOUNCE_MS);
  }

  function _flushPendingChanges() {
    var changes = _pendingChanges;
    _pendingChanges = {};
    var keys = Object.keys(changes);
    if (!keys.length) return;

    var grouped = {};
    keys.forEach(function (k) {
      var parts = k.split('@@');
      var peligroId = parts[0];
      var field = parts[1];
      if (!grouped[peligroId]) grouped[peligroId] = {};
      grouped[peligroId][field] = changes[k];
    });

  var peligroIds = Object.keys(grouped);
  peligroIds.forEach(function (pid) {
    IdentificacionPeligrosService.updatePeligro(_companyName, pid, grouped[pid])
      .then(function (result) {
        if (result && result.success && result.data) {
          var pel = _findPeligroById(pid);
          if (pel) {
            var keys2 = Object.keys(result.data);
            for (var ki = 0; ki < keys2.length; ki++) {
              pel[keys2[ki]] = result.data[keys2[ki]];
            }
          }
          _updateComputedCells(pid, result.data);
        _debouncedXlsxSync();
        } else {
          IdentificacionPeligrosService.toast('Error al guardar cambios', 'error');
        }
      })
      .catch(function (err) {
        IdentificacionPeligrosService.toast('Error de guardado: ' + (err.message || ''), 'error');
      });
  });
}

/* ─── XLSX Auto-Sync (fire-and-forget, debounced 3s) ────────────────── */
function _debouncedXlsxSync() {
  if (_xlsxSyncTimer) clearTimeout(_xlsxSyncTimer);
  _xlsxSyncTimer = setTimeout(function () {
    _xlsxSyncTimer = null;
    if (!_companyName) return;
    IdentificacionPeligrosService.syncXlsx(_companyName)
      .then(function (result) {
        if (!result || !result.success) {
          IdentificacionPeligrosService.toast('Sync XLSX: ' + (result && result.error && result.error.message || 'sin ruta'), 'warning');
        }
      })
      .catch(function () {});
  }, XLSX_SYNC_MS);
}

/* ─── Computed cell update (in-place, no full re-render) ──────────────── */

/* --- Cargo field save engine --- */
var _cargoSaveTimers = {};
var _pendingCargoChanges = {};

function _debouncedCargoSave(cargoId, field, value) {
 if (!_pendingCargoChanges[cargoId]) _pendingCargoChanges[cargoId] = {};
 _pendingCargoChanges[cargoId][field] = value;
 if (_cargoSaveTimers[cargoId]) clearTimeout(_cargoSaveTimers[cargoId]);
 _cargoSaveTimers[cargoId] = setTimeout(function() {
 _flushCargoChanges(cargoId);
 }, DEBOUNCE_MS);
}

function _flushCargoChanges(cargoId) {
 var changes = _pendingCargoChanges[cargoId] || {};
 delete _pendingCargoChanges[cargoId];
 delete _cargoSaveTimers[cargoId];
 var keys = Object.keys(changes);
 if (!keys.length) return;
 IdentificacionPeligrosService.updateCargo(_companyName, cargoId, changes)
 .then(function(result) {
      if (!result || !result.success) {
        IdentificacionPeligrosService.toast('Error al guardar datos del cargo', 'error');
      } else {
        _debouncedXlsxSync();
      }
 })
 .catch(function(err) {
 IdentificacionPeligrosService.toast('Error de guardado cargo: ' + (err.message || ''), 'error');
 });
}

  function _updateComputedCells(peligroId, data) {
    var wrapper = document.querySelector('.kair-mp-wrapper');
    if (!wrapper) return;
    var row = wrapper.querySelector('[data-peligro-id="' + peligroId + '"]');
    if (!row) return;

    _setCellText(row, 'np', data.np != null ? data.np : '');
    _setCellText(row, 'npInterpretacion', data.npInterpretacion || '');
    _setCellText(row, 'nr', data.nr != null ? data.nr : '');
    _setCellText(row, 'nrNivel', data.nrNivel || '');
    _setCellText(row, 'nrLabel', data.nrLabel || '');

    var nivelClass = data.nrNivel ? 'kair-mp-acc__cell--nivel-' + data.nrNivel : '';
    ['nr', 'nrNivel', 'nrLabel'].forEach(function (f) {
      var td = row.querySelector('[data-col="' + f + '"]');
      if (!td) return;
      td.className = 'kair-mp-acc__cell kair-mp-acc__cell--computed';
      if (f === 'nr') td.classList.add('kair-mp-acc__cell--nr');
      td.classList.remove('kair-mp-acc__cell--nivel-I', 'kair-mp-acc__cell--nivel-II',
        'kair-mp-acc__cell--nivel-III', 'kair-mp-acc__cell--nivel-IV', 'kair-mp-acc__cell--nivel-V');
      if (nivelClass) td.classList.add(nivelClass);
    });
  }

  function _setCellText(row, colKey, text) {
    var td = row.querySelector('[data-col="' + colKey + '"]');
    if (td) td.textContent = text;
  }

  /* ─── Counting helpers ────────────────────────────────────────────────── */
  function _countPeligros(matriz) {
    var count = 0;
    if (!matriz || !matriz.sedes) return 0;
    for (var s = 0; s < matriz.sedes.length; s++) {
      count += _countPeligrosInSede(matriz.sedes[s]);
    }
    return count;
  }

  function _countPeligrosInSede(sede) {
    var count = 0;
    if (!sede || !sede.procesos) return 0;
    for (var p = 0; p < sede.procesos.length; p++) {
      count += _countPeligrosInProceso(sede.procesos[p]);
    }
    return count;
  }

  function _countPeligrosInProceso(proceso) {
    var count = 0;
    if (!proceso || !proceso.cargos) return 0;
    for (var c = 0; c < proceso.cargos.length; c++) {
      count += _countPeligrosInCargo(proceso.cargos[c]);
    }
    return count;
  }

  function _countPeligrosInCargo(cargo) {
    return (cargo && cargo.peligros) ? cargo.peligros.length : 0;
  }

  function _countInaceptables(matriz) {
    var count = 0;
    if (!matriz || !matriz.sedes) return 0;
    for (var s = 0; s < matriz.sedes.length; s++) {
      var sede = matriz.sedes[s];
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          var cargo = proc.cargos[c];
          if (!cargo.peligros) continue;
          for (var pe = 0; pe < cargo.peligros.length; pe++) {
            var nivel = cargo.peligros[pe].nrNivel;
            if (nivel === 'IV' || nivel === 'V' || nivel === 'III') count++;
          }
        }
      }
    }
    return count;
  }

  /* ─── Expand / Collapse ───────────────────────────────────────────────── */
  function _isExpanded(type, id) {
    if (_expandState[type] === undefined) return true;
    if (_expandState[type][id] === undefined) return true;
    return _expandState[type][id];
  }

  function _setExpanded(type, id, val) {
    if (!_expandState[type]) _expandState[type] = {};
    _expandState[type][id] = val;
  }

  function _expandAll() {
    if (!_matriz || !_matriz.sedes) return;
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      _setExpanded('sedes', sede.id, true);
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        _setExpanded('procesos', proc.id, true);
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          _setExpanded('cargos', proc.cargos[c].id, true);
        }
      }
    }
    _applyAccordionState();
  }

  function _collapseAll() {
    if (!_matriz || !_matriz.sedes) return;
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      _setExpanded('sedes', sede.id, false);
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        _setExpanded('procesos', proc.id, false);
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          _setExpanded('cargos', proc.cargos[c].id, false);
        }
      }
    }
    _applyAccordionState();
  }

  function _applyAccordionState() {
    var wrapper = document.querySelector('.kair-mp-wrapper');
    if (!wrapper) return;

    wrapper.querySelectorAll('.kair-mp-acc__sede').forEach(function (el) {
      var id = el.getAttribute('data-sede-id');
      var open = _isExpanded('sedes', id);
      el.classList.toggle('kair-mp-acc__sede--collapsed', !open);
      var body = el.querySelector('.kair-mp-acc__sede-body');
      if (body) body.style.display = open ? '' : 'none';
      var chevron = el.querySelector('.kair-mp-acc__sede-chevron');
      if (chevron) chevron.style.transform = open ? '' : 'rotate(-90deg)';
    });

    wrapper.querySelectorAll('.kair-mp-acc__proceso').forEach(function (el) {
      var id = el.getAttribute('data-proceso-id');
      var open = _isExpanded('procesos', id);
      el.classList.toggle('kair-mp-acc__proceso--collapsed', !open);
      var body = el.querySelector('.kair-mp-acc__proceso-body');
      if (body) body.style.display = open ? '' : 'none';
      var chevron = el.querySelector('.kair-mp-acc__proceso-chevron');
      if (chevron) chevron.style.transform = open ? '' : 'rotate(-90deg)';
    });

    wrapper.querySelectorAll('.kair-mp-acc__cargo').forEach(function (el) {
      var id = el.getAttribute('data-cargo-id');
      var open = _isExpanded('cargos', id);
      el.classList.toggle('kair-mp-acc__cargo--collapsed', !open);
      var body = el.querySelector('.kair-mp-acc__cargo-body');
      if (body) body.style.display = open ? '' : 'none';
      var chevron = el.querySelector('.kair-mp-acc__cargo-chevron');
      if (chevron) chevron.style.transform = open ? '' : 'rotate(-90deg)';
    });
  }

  /* ─── HTML Escaping ───────────────────────────────────────────────────── */
  function _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ─── Select option builders ──────────────────────────────────────────── */
  function _buildSelectOptions(options, selectedValue) {
    var html = '<option value="">—</option>';
    if (!options) return html;
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var sel = (selectedValue != null && String(opt.value) === String(selectedValue)) ? ' selected' : '';
      var shortLabel = opt.label.indexOf('(') > -1 ? opt.label.substring(0, opt.label.indexOf('(')).trim() : opt.label;
      html += '<option value="' + opt.value + '"' + sel + '>' + shortLabel + '</option>';
    }
    return html;
  }

  function _buildTipoOptions(tipos, selected) {
    var html = '<option value="">—</option>';
    if (!tipos) return html;
    for (var i = 0; i < tipos.length; i++) {
      var sel = (tipos[i] === selected) ? ' selected' : '';
      html += '<option value="' + tipos[i] + '"' + sel + '>' + tipos[i] + '</option>';
    }
    return html;
  }

  /* ─── Stats Bar ───────────────────────────────────────────────────────── */
  function _renderStatsBar() {
    var total = _stats ? _stats.total : (_matriz ? _countPeligros(_matriz) : 0);
    var inaceptables = _stats ? _stats.inaceptables : (_matriz ? _countInaceptables(_matriz) : 0);
    var numSedes = _matriz && _matriz.sedes ? _matriz.sedes.length : 0;
    var evalRate = total > 0 ? Math.round(((total - _countUnevaluated()) / total) * 100) : 0;

    var html = '<div class="kair-mp-acc__stats-bar">';
    html += '<div class="kair-mp-acc__stat"><span class="kair-mp-acc__stat-value">' + total + '</span><span class="kair-mp-acc__stat-label">Peligros</span></div>';
    html += '<div class="kair-mp-acc__stat"><span class="kair-mp-acc__stat-value">' + numSedes + '</span><span class="kair-mp-acc__stat-label">Sedes</span></div>';
    html += '<div class="kair-mp-acc__stat kair-mp-acc__stat--danger"><span class="kair-mp-acc__stat-value">' + inaceptables + '</span><span class="kair-mp-acc__stat-label">Inaceptables</span></div>';
    html += '<div class="kair-mp-acc__stat"><span class="kair-mp-acc__stat-value">' + evalRate + '%</span><span class="kair-mp-acc__stat-label">Evaluados</span></div>';
    html += '</div>';
    return html;
  }

  function _countUnevaluated() {
    var count = 0;
    if (!_matriz || !_matriz.sedes) return 0;
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          var cargo = proc.cargos[c];
          if (!cargo.peligros) continue;
          for (var pe = 0; pe < cargo.peligros.length; pe++) {
            var pel = cargo.peligros[pe];
            if (pel.nd == null || pel.ne == null || pel.nc == null) count++;
          }
        }
      }
    }
    return count;
  }

  /* ─── Sede Filter Tabs ────────────────────────────────────────────────── */
  function _renderFilterTabs() {
    if (!_matriz || !_matriz.sedes || _matriz.sedes.length <= 1) return '';

    var html = '<div class="kair-mp-acc__filter-tabs">';
    html += '<button class="kair-mp-acc__filter-tab' + (_filterSede === '__all__' ? ' kair-mp-acc__filter-tab--active' : '') + '" data-filter-sede="__all__">Todas</button>';
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      var active = _filterSede === sede.id ? ' kair-mp-acc__filter-tab--active' : '';
      html += '<button class="kair-mp-acc__filter-tab' + active + '" data-filter-sede="' + sede.id + '">' + _escHtml(sede.nombre) + '</button>';
    }
    html += '</div>';
    return html;
  }

  /* ─── Toolbar ─────────────────────────────────────────────────────────── */
  function _renderToolbar() {
    var html = '<div class="kair-mp-acc__toolbar">';
    html += '<span class="kair-mp-acc__toolbar-title"><i class="bi bi-table"></i> Matriz de Peligros GTC-45</span>';
    html += '<div class="kair-mp-acc__toolbar-actions">';
    html += '<button class="kair-mp-acc__toolbar-btn" data-action="expand-all" title="Expandir todo"><i class="bi bi-arrows-expand"></i></button>';
    html += '<button class="kair-mp-acc__toolbar-btn" data-action="collapse-all" title="Colapsar todo"><i class="bi bi-arrows-collapse"></i></button>';
    html += '<button class="kair-mp-btn kair-mp-btn--primary" data-action="add-sede"><i class="bi bi-plus-lg"></i> Sede</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  /* ─── Click-to-edit cell rendering ────────────────────────────────────── */
  function _renderPeligroCell(peligro, col) {
    if (col.type === 'computed') {
      var extraClass = '';
      if (col.key === 'np') extraClass = ' kair-mp-acc__cell--np';
      if (col.key === 'nr') extraClass = ' kair-mp-acc__cell--nr';
      var nivelClass = '';
      if (['nr', 'nrNivel', 'nrLabel'].indexOf(col.key) >= 0 && peligro.nrNivel) {
        nivelClass = ' kair-mp-acc__cell--nivel-' + peligro.nrNivel;
      }
      var val = peligro[col.key];
      if (val == null) val = '';
      return '<td class="kair-mp-acc__cell kair-mp-acc__cell--computed' + extraClass + nivelClass + '" data-col="' + col.key + '">' + val + '</td>';
    }

    if (!col.editable) {
      var val2 = peligro[col.key] != null ? peligro[col.key] : '';
      return '<td class="kair-mp-acc__cell" data-col="' + col.key + '">' + _escHtml(val2) + '</td>';
    }

    var cellId = peligro.id + '@@' + col.key;
    var isEditing = _editingCellId === cellId;

  if (col.type === 'select-nd' || col.type === 'select-ne' || col.type === 'select-nc' || col.type === 'select-tipo') {
    var selVal = (_pendingChanges[cellId] !== undefined) ? _pendingChanges[cellId] : peligro[col.key];
    var options = '';
    if (col.type === 'select-nd') options = _buildSelectOptions(_gtc45Options ? _gtc45Options.nd : [], selVal);
    else if (col.type === 'select-ne') options = _buildSelectOptions(_gtc45Options ? _gtc45Options.ne : [], selVal);
    else if (col.type === 'select-nc') options = _buildSelectOptions(_gtc45Options ? _gtc45Options.nc : [], selVal);
    else if (col.type === 'select-tipo') options = _buildTipoOptions(_gtc45Options ? _gtc45Options.tipos : [], selVal);

      return '<td class="kair-mp-acc__cell kair-mp-acc__cell--select" data-col="' + col.key + '" data-cell-id="' + cellId + '">' +
        '<select class="kair-mp-acc__cell-select" data-peligro-id="' + peligro.id + '" data-field="' + col.key + '">' + options + '</select>' +
        '</td>';
    }

  var val3 = (_pendingChanges[cellId] !== undefined) ? _pendingChanges[cellId] : (peligro[col.key] != null ? peligro[col.key] : '');
  if (isEditing) {
    return '<td class="kair-mp-acc__cell kair-mp-acc__cell--editing" data-col="' + col.key + '" data-cell-id="' + cellId + '">' +
      '<input class="kair-mp-acc__cell-input" type=' + (col.type === 'number' ? 'number' : 'text') + ' value="' + _escHtml(val3) + '" data-peligro-id="' + peligro.id + '" data-field="' + col.key + '" data-auto-focus>' +
      '</td>';
  }

  var displayVal = (val3 != null && val3 !== '') ? _escHtml(val3) : '<span class="kair-mp-acc__cell-placeholder">—</span>';
    return '<td class="kair-mp-acc__cell kair-mp-acc__cell--editable" data-col="' + col.key + '" data-cell-id="' + cellId + '" data-peligro-id="' + peligro.id + '" data-field="' + col.key + '">' + displayVal + '</td>';
  }

  /* ─── Peligro Row ─────────────────────────────────────────────────────── */
  function _renderPeligroRow(peligro) {
    var html = '<tr class="kair-mp-acc__peligro-row" data-peligro-id="' + peligro.id + '">';
    html += '<td class="kair-mp-acc__cell kair-mp-acc__cell--delete" data-action="delete-peligro" data-peligro-id="' + peligro.id + '" title="Eliminar peligro"><i class="bi bi-trash3"></i></td>';
    for (var ci = 0; ci < COLS.length; ci++) {
      html += _renderPeligroCell(peligro, COLS[ci]);
    }
    html += '</tr>';
    return html;
  }

  /* ─── Cargo Block (accordion level 3) ─────────────────────────────────── */
  function _renderCargoBlock(cargo) {
    var isCollapsed = !_isExpanded('cargos', cargo.id);
    var pelCount = _countPeligrosInCargo(cargo);
    var cargoClass = 'kair-mp-acc__cargo' + (isCollapsed ? ' kair-mp-acc__cargo--collapsed' : '');

    var html = '<div class="' + cargoClass + '" data-cargo-id="' + cargo.id + '">';

    html += '<div class="kair-mp-acc__cargo-header">';
    html += '<i class="bi bi-chevron-down kair-mp-acc__cargo-chevron" style="transform:' + (isCollapsed ? 'rotate(-90deg)' : '') + '"></i>';
    html += '<span class="kair-mp-acc__cargo-icon"><i class="bi bi-person-badge"></i></span>';
    html += '<span class="kair-mp-acc__cargo-name">' + _escHtml(cargo.nombre) + '</span>';
    html += '<span class="kair-mp-acc__cargo-badge">' + pelCount + ' peligro' + (pelCount !== 1 ? 's' : '') + '</span>';
    html += '<div class="kair-mp-acc__cargo-actions">';
    html += '<button class="kair-mp-acc__action-btn" data-action="add-peligro" data-cargo-id="' + cargo.id + '" title="Agregar peligro"><i class="bi bi-plus-circle"></i></button>';
    html += '<button class="kair-mp-acc__action-btn kair-mp-acc__action-btn--danger" data-action="delete-cargo" data-cargo-id="' + cargo.id + '" title="Eliminar cargo"><i class="bi bi-trash3"></i></button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="kair-mp-acc__cargo-body" style="display:' + (isCollapsed ? 'none' : '') + '">';

    
 html += '<div class="kair-mp-acc__cargo-meta">';
 html += '<div class="kair-mp-acc__cargo-meta-field"><label>Zona</label><input class="kair-mp-acc__cargo-input" data-cargo-id="' + cargo.id + '" data-cargo-field="zona" value="' + _escHtml(cargo.zona || '') + '" placeholder="Zona"></div>';
 html += '<div class="kair-mp-acc__cargo-meta-field"><label>Actividades</label><input class="kair-mp-acc__cargo-input" data-cargo-id="' + cargo.id + '" data-cargo-field="actividades" value="' + _escHtml(cargo.actividades || '') + '" placeholder="Actividades"></div>';
 html += '<div class="kair-mp-acc__cargo-meta-field"><label>Tareas</label><input class="kair-mp-acc__cargo-input" data-cargo-id="' + cargo.id + '" data-cargo-field="tareas" value="' + _escHtml(cargo.tareas || '') + '" placeholder="Tareas"></div>';
 html += '<div class="kair-mp-acc__cargo-meta-field kair-mp-acc__cargo-meta-field--rutinaria"><label>Rutinaria</label><select class="kair-mp-acc__cargo-select" data-cargo-id="' + cargo.id + '" data-cargo-field="rutinaria">';
 html += '<option value=""' + (cargo.rutinaria == null ? ' selected' : '') + '>Sin asignar</option>';
 html += '<option value="true"' + (cargo.rutinaria === true ? ' selected' : '') + '>Si</option>';
 html += '<option value="false"' + (cargo.rutinaria === false ? ' selected' : '') + '>No</option>';
 html += '</select></div>';
 html += '</div>';

 if (!cargo.peligros || !cargo.peligros.length) {
      html += '<div class="kair-mp-acc__empty"><i class="bi bi-shield-check"></i><p>Sin peligros identificados</p>';
      html += '<button class="kair-mp-acc__add-btn" data-action="add-peligro" data-cargo-id="' + cargo.id + '"><i class="bi bi-plus-circle"></i> Agregar peligro</button>';
      html += '</div>';
    } else {
      html += '<div class="kair-mp-acc__table-wrapper">';
      html += '<table class="kair-mp-acc__table">';
      html += '<thead><tr>';
      html += '<th class="kair-mp-acc__th--delete"></th>';
      for (var ci = 0; ci < COLS.length; ci++) {
        html += '<th>' + COLS[ci].label.replace(/\n/g, '<br>') + '</th>';
      }
      html += '</tr></thead>';
      html += '<tbody>';
      for (var pe = 0; pe < cargo.peligros.length; pe++) {
        html += _renderPeligroRow(cargo.peligros[pe]);
      }
      html += '</tbody></table></div>';

      html += '<div class="kair-mp-acc__add-row">';
      html += '<button class="kair-mp-acc__add-btn" data-action="add-peligro" data-cargo-id="' + cargo.id + '"><i class="bi bi-plus-circle"></i> Agregar peligro a ' + _escHtml(cargo.nombre) + '</button>';
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  /* ─── Proceso Block (accordion level 2) ───────────────────────────────── */
  function _renderProcesoBlock(proceso) {
    var isCollapsed = !_isExpanded('procesos', proceso.id);
    var pelCount = _countPeligrosInProceso(proceso);
    var procClass = 'kair-mp-acc__proceso' + (isCollapsed ? ' kair-mp-acc__proceso--collapsed' : '');

    var html = '<div class="' + procClass + '" data-proceso-id="' + proceso.id + '">';

    html += '<div class="kair-mp-acc__proceso-header">';
    html += '<i class="bi bi-chevron-down kair-mp-acc__proceso-chevron" style="transform:' + (isCollapsed ? 'rotate(-90deg)' : '') + '"></i>';
    html += '<span class="kair-mp-acc__proceso-icon"><i class="bi bi-gear"></i></span>';
    html += '<span class="kair-mp-acc__proceso-name">' + _escHtml(proceso.nombre) + '</span>';
    html += '<span class="kair-mp-acc__proceso-badge">' + pelCount + ' peligro' + (pelCount !== 1 ? 's' : '') + '</span>';
    html += '<div class="kair-mp-acc__proceso-actions">';
    html += '<button class="kair-mp-acc__action-btn" data-action="add-cargo" data-proceso-id="' + proceso.id + '" title="Agregar cargo"><i class="bi bi-plus-circle"></i> Cargo</button>';
    html += '<button class="kair-mp-acc__action-btn kair-mp-acc__action-btn--danger" data-action="delete-proceso" data-proceso-id="' + proceso.id + '" title="Eliminar proceso"><i class="bi bi-trash3"></i></button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="kair-mp-acc__proceso-body" style="display:' + (isCollapsed ? 'none' : '') + '">';

    if (!proceso.cargos || !proceso.cargos.length) {
      html += '<div class="kair-mp-acc__empty"><i class="bi bi-person-badge"></i><p>Sin cargos asignados</p>';
      html += '<button class="kair-mp-acc__add-btn" data-action="add-cargo" data-proceso-id="' + proceso.id + '"><i class="bi bi-plus-circle"></i> Agregar cargo</button>';
      html += '</div>';
    } else {
      for (var c = 0; c < proceso.cargos.length; c++) {
        html += _renderCargoBlock(proceso.cargos[c]);
      }
    }

    html += '</div></div>';
    return html;
  }

  /* ─── Sede Card (accordion level 1) ───────────────────────────────────── */
  function _renderSedeCard(sede) {
    var isCollapsed = !_isExpanded('sedes', sede.id);
    var pelCount = _countPeligrosInSede(sede);
    var sedeClass = 'kair-mp-acc__sede' + (isCollapsed ? ' kair-mp-acc__sede--collapsed' : '');

    var html = '<div class="' + sedeClass + '" data-sede-id="' + sede.id + '">';

    html += '<div class="kair-mp-acc__sede-header">';
    html += '<i class="bi bi-chevron-down kair-mp-acc__sede-chevron" style="transform:' + (isCollapsed ? 'rotate(-90deg)' : '') + '"></i>';
    html += '<span class="kair-mp-acc__sede-icon"><i class="bi bi-building"></i></span>';
    html += '<span class="kair-mp-acc__sede-name">' + _escHtml(sede.nombre) + '</span>';
    html += '<span class="kair-mp-acc__sede-badge">' + pelCount + ' peligro' + (pelCount !== 1 ? 's' : '') + '</span>';
    html += '<div class="kair-mp-acc__sede-actions">';
    html += '<button class="kair-mp-acc__action-btn" data-action="add-proceso" data-sede-id="' + sede.id + '" title="Agregar proceso"><i class="bi bi-plus-circle"></i> Proceso</button>';
    html += '<button class="kair-mp-acc__action-btn kair-mp-acc__action-btn--danger" data-action="delete-sede" data-sede-id="' + sede.id + '" title="Eliminar sede"><i class="bi bi-trash3"></i></button>';
    html += '</div>';
    html += '</div>';

    html += '<div class="kair-mp-acc__sede-body" style="display:' + (isCollapsed ? 'none' : '') + '">';

    if (!sede.procesos || !sede.procesos.length) {
      html += '<div class="kair-mp-acc__empty"><i class="bi bi-gear"></i><p>Sin procesos asignados</p>';
      html += '<button class="kair-mp-acc__add-btn" data-action="add-proceso" data-sede-id="' + sede.id + '"><i class="bi bi-plus-circle"></i> Agregar proceso</button>';
      html += '</div>';
    } else {
      for (var p = 0; p < sede.procesos.length; p++) {
        html += _renderProcesoBlock(sede.procesos[p]);
      }
    }

    html += '</div></div>';
    return html;
  }

  /* ─── Main render ─────────────────────────────────────────────────────── */
function _render(container) {
  if (!_matriz || !_matriz.sedes || !_matriz.sedes.length) {
    container.innerHTML = _renderEmpty();
    _bindDocumentEvents();
    return;
  }

  var html = _renderToolbar();
  html += _renderStatsBar();
  html += _renderFilterTabs();
  html += '<div class="kair-mp-acc__container">';

  for (var s = 0; s < _matriz.sedes.length; s++) {
    var sede = _matriz.sedes[s];
    if (_filterSede !== '__all__' && _filterSede !== sede.id) continue;
    html += _renderSedeCard(sede);
  }

  html += '</div>';
  container.innerHTML = html;
  _bindDocumentEvents();
  _focusEditingCell();
}

  function _renderEmpty() {
    return '<div class="kair-mp-acc__empty-state">' +
      '<i class="bi bi-exclamation-triangle"></i>' +
      '<h3>Matriz vacía</h3>' +
      '<p>No hay peligros identificados. Agregue una sede para comenzar.</p>' +
      '<button class="kair-mp-btn kair-mp-btn--primary" data-action="add-sede"><i class="bi bi-plus-lg"></i> Agregar Sede</button>' +
      '</div>';
  }

  /* ─── Focus editing cell after re-render ──────────────────────────────── */
  function _focusEditingCell() {
    if (!_editingCellId) return;
    var input = document.querySelector('.kair-mp-acc__cell-input[data-auto-focus]');
    if (input) {
      input.focus();
      input.select();
      input.removeAttribute('data-auto-focus');
    }
  }

/* ─── Event binding: container (delegated, se llama UNA VEZ en load()) ── */
function _bindContainerEvents(container) {
  container.addEventListener('click', function (e) {
    var target = e.target;

    var actionEl = target.closest('[data-action]');
    if (actionEl) {
      var action = actionEl.getAttribute('data-action');
      _handleAction(action, actionEl, e);
      return;
    }

    var filterTab = target.closest('[data-filter-sede]');
    if (filterTab) {
      _filterSede = filterTab.getAttribute('data-filter-sede');
      _render(container);
      return;
    }

    var sedeHeader = target.closest('.kair-mp-acc__sede-header');
    if (sedeHeader && !target.closest('[data-action]')) {
      var sedeEl = sedeHeader.closest('.kair-mp-acc__sede');
      if (sedeEl) _toggleSede(sedeEl.getAttribute('data-sede-id'));
      return;
    }

    var procHeader = target.closest('.kair-mp-acc__proceso-header');
    if (procHeader && !target.closest('[data-action]')) {
      var procEl = procHeader.closest('.kair-mp-acc__proceso');
      if (procEl) _toggleProceso(procEl.getAttribute('data-proceso-id'));
      return;
    }

    var cargoHeader = target.closest('.kair-mp-acc__cargo-header');
    if (cargoHeader && !target.closest('[data-action]')) {
      var cargoEl = cargoHeader.closest('.kair-mp-acc__cargo');
      if (cargoEl) _toggleCargo(cargoEl.getAttribute('data-cargo-id'));
      return;
    }

    var editableCell = target.closest('.kair-mp-acc__cell--editable');
    if (editableCell) {
      _startEditing(editableCell);
      return;
    }
  });

  container.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel.classList.contains('kair-mp-acc__cell-select')) return;
    var peligroId = sel.getAttribute('data-peligro-id');
    var field = sel.getAttribute('data-field');
    if (!peligroId || !field) return;
    var val = sel.value;
    if (field === 'nd' || field === 'ne' || field === 'nc' || field === 'expuestos') {
      val = val !== '' ? Number(val) : null;
    }
    _pendingChanges[peligroId + '@@' + field] = val;
    _debouncedSave();
  });

  container.addEventListener('input', function (e) {
    var inp = e.target;
    if (!inp.classList.contains('kair-mp-acc__cell-input')) return;
    var peligroId = inp.getAttribute('data-peligro-id');
    var field = inp.getAttribute('data-field');
    if (!peligroId || !field) return;
    var _inpVal = inp.value;
    var _colDef = COLS.find(function(c) { return c.key === field; });
    if (_colDef && _colDef.type === 'number' && _inpVal !== '') _inpVal = Number(_inpVal);
    if (_colDef && _colDef.type === 'number' && _inpVal === '') _inpVal = null;
    _pendingChanges[peligroId + '@@' + field] = _inpVal;
    _debouncedSave();
  });

  container.addEventListener('input', function(e) {
    var inp = e.target;
    if (!inp.classList.contains('kair-mp-acc__cargo-input')) return;
    var cargoId = inp.getAttribute('data-cargo-id');
    var field = inp.getAttribute('data-cargo-field');
    if (!cargoId || !field) return;
    _debouncedCargoSave(cargoId, field, inp.value);
  });

  container.addEventListener('change', function(e) {
    var sel = e.target;
    if (!sel.classList.contains('kair-mp-acc__cargo-select')) return;
    var cargoId = sel.getAttribute('data-cargo-id');
    var field = sel.getAttribute('data-cargo-field');
    if (!cargoId || !field) return;
    var val = sel.value;
    if (field === 'rutinaria') {
      val = val === '' ? null : (val === 'true');
    }
    _debouncedCargoSave(cargoId, field, val);
  });
}

/* ─── Event binding: document (se llama en _render() con cleanup previo) ── */
var _containerEventsBound = false;

function _bindDocumentEvents() {
  _cleanup();

  _docClickHandler = function (e) {
    if (_editingCellId && !e.target.closest('.kair-mp-acc__cell--editing')) {
      _stopEditing();
    }
  };
  document.addEventListener('mousedown', _docClickHandler);

  _keyHandler = function (e) {
    if (e.key === 'Escape' && _editingCellId) {
      _stopEditing();
    }
    if (e.key === 'Tab' && _editingCellId) {
      _tabToNextCell(e);
    }
  };
  document.addEventListener('keydown', _keyHandler);
}

  /* ─── Click-to-edit: start / stop ─────────────────────────────────────── */
  function _startEditing(cellEl) {
    var peligroId = cellEl.getAttribute('data-peligro-id');
    var field = cellEl.getAttribute('data-field');
    if (!peligroId || !field) return;

    var cellId = peligroId + '@@' + field;
    if (_editingCellId === cellId) return;

    _stopEditing();
    _editingCellId = cellId;

  var currentVal = '';
  var pendingKey = peligroId + '@@' + field;
  if (_pendingChanges[pendingKey] !== undefined) {
    currentVal = _pendingChanges[pendingKey];
  } else if (_matriz && _matriz.sedes) {
    var peligro = _findPeligroById(peligroId);
    if (peligro) currentVal = peligro[field] != null ? peligro[field] : '';
  }

    var input = document.createElement('input');
    input.className = 'kair-mp-acc__cell-input';
    var _startEditCol = COLS.find(function(c) { return c.key === field; });
 input.type = (_startEditCol && _startEditCol.type === 'number') ? 'number' : 'text';
    input.value = currentVal;
    input.setAttribute('data-peligro-id', peligroId);
    input.setAttribute('data-field', field);

    cellEl.className = 'kair-mp-acc__cell kair-mp-acc__cell--editing';
    cellEl.innerHTML = '';
    cellEl.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        _stopEditing();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        _editingCellId = null;
        var container = document.getElementById('kair-mp-matriz-content');
        if (container) _render(container);
      }
    });

    input.addEventListener('input', function () {
      _pendingChanges[_editingCellId] = input.value;
      _debouncedSave();
    });
  }

  function _stopEditing() {
    if (!_editingCellId) return;
    var cellId = _editingCellId;
    _editingCellId = null;

    var parts = cellId.split('@@');
    var peligroId = parts[0];
    var field = parts[1];

  var peligro = _findPeligroById(peligroId);
  if (!peligro) return;

  var cellEl = document.querySelector('[data-cell-id="' + cellId + '"]');
  if (cellEl) {
    var val = (_pendingChanges[cellId] !== undefined) ? _pendingChanges[cellId] : (peligro[field] != null ? peligro[field] : '');
    cellEl.className = 'kair-mp-acc__cell kair-mp-acc__cell--editable';
    cellEl.setAttribute('data-peligro-id', peligroId);
    cellEl.setAttribute('data-field', field);
    cellEl.innerHTML = (val != null && val !== '') ? _escHtml(val) : '<span class="kair-mp-acc__cell-placeholder">—</span>';
  }
}

  function _tabToNextCell(e) {
    if (!_editingCellId) return;
    var parts = _editingCellId.split('@@');
    var peligroId = parts[0];
    var field = parts[1];

    var colIndex = -1;
    for (var i = 0; i < COLS.length; i++) {
      if (COLS[i].key === field && COLS[i].editable && (COLS[i].type === 'text' || COLS[i].type === 'number')) {
        colIndex = i;
        break;
      }
    }
    if (colIndex < 0) return;

    var nextIndex = e.shiftKey ? colIndex - 1 : colIndex + 1;
    while (nextIndex >= 0 && nextIndex < COLS.length) {
      if (COLS[nextIndex].editable && (COLS[nextIndex].type === 'text' || COLS[nextIndex].type === 'number')) {
        e.preventDefault();
        _stopEditing();
        var nextCellId = peligroId + '@@' + COLS[nextIndex].key;
        var nextCell = document.querySelector('[data-cell-id="' + nextCellId + '"]');
        if (nextCell) _startEditing(nextCell);
        return;
      }
      nextIndex = e.shiftKey ? nextIndex - 1 : nextIndex + 1;
    }
  }

  /* ─── Accordion toggle helpers ────────────────────────────────────────── */
  function _toggleSede(sedeId) {
    var current = _isExpanded('sedes', sedeId);
    _setExpanded('sedes', sedeId, !current);
    _applyAccordionState();
  }

  function _toggleProceso(procesoId) {
    var current = _isExpanded('procesos', procesoId);
    _setExpanded('procesos', procesoId, !current);
    _applyAccordionState();
  }

  function _toggleCargo(cargoId) {
    var current = _isExpanded('cargos', cargoId);
    _setExpanded('cargos', cargoId, !current);
    _applyAccordionState();
  }

  /* ─── Action handler ──────────────────────────────────────────────────── */
  function _handleAction(action, el, e) {
    switch (action) {
      case 'add-sede':
        _promptAddSede();
        break;
      case 'add-proceso':
        var sedeId = el.getAttribute('data-sede-id');
        if (sedeId) _promptAddProceso(sedeId);
        break;
      case 'add-cargo':
        var procId = el.getAttribute('data-proceso-id');
        if (procId) _promptAddCargo(procId);
        break;
      case 'add-peligro':
        var cargoId = el.getAttribute('data-cargo-id');
        if (cargoId) _addPeligro(cargoId);
        break;
      case 'delete-sede':
        var delSedeId = el.getAttribute('data-sede-id');
        if (delSedeId) _confirmDelete('sede', delSedeId);
        break;
      case 'delete-proceso':
        var delProcId = el.getAttribute('data-proceso-id');
        if (delProcId) _confirmDelete('proceso', delProcId);
        break;
      case 'delete-cargo':
        var delCarId = el.getAttribute('data-cargo-id');
        if (delCarId) _confirmDelete('cargo', delCarId);
        break;
      case 'delete-peligro':
        var delPelId = el.getAttribute('data-peligro-id');
        if (delPelId) _deletePeligro(delPelId);
        break;
      case 'expand-all':
        _expandAll();
        break;
      case 'collapse-all':
        _collapseAll();
        break;
    }
  }

  /* ─── Find peligro by ID ──────────────────────────────────────────────── */
  function _findPeligroById(peligroId) {
    if (!_matriz || !_matriz.sedes) return null;
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          var cargo = proc.cargos[c];
          if (!cargo.peligros) continue;
          for (var pe = 0; pe < cargo.peligros.length; pe++) {
            if (cargo.peligros[pe].id === peligroId) return cargo.peligros[pe];
          }
        }
      }
    }
    return null;
  }

  function _findNameById(type, id) {
    if (!_matriz || !_matriz.sedes) return '';
    for (var s = 0; s < _matriz.sedes.length; s++) {
      var sede = _matriz.sedes[s];
      if (type === 'sede' && sede.id === id) return sede.nombre;
      if (!sede.procesos) continue;
      for (var p = 0; p < sede.procesos.length; p++) {
        var proc = sede.procesos[p];
        if (type === 'proceso' && proc.id === id) return proc.nombre;
        if (!proc.cargos) continue;
        for (var c = 0; c < proc.cargos.length; c++) {
          var cargo = proc.cargos[c];
          if (type === 'cargo' && cargo.id === id) return cargo.nombre;
        }
      }
    }
    return '';
  }

  function _countChildren(type, id) {
    if (!_matriz || !_matriz.sedes) return 0;
    if (type === 'sede') {
      var sede = _matriz.sedes.find(function (s) { return s.id === id; });
      return sede ? _countPeligrosInSede(sede) : 0;
    }
    if (type === 'proceso') {
      for (var s = 0; s < _matriz.sedes.length; s++) {
        if (!_matriz.sedes[s].procesos) continue;
        var proc = _matriz.sedes[s].procesos.find(function (p) { return p.id === id; });
        if (proc) return _countPeligrosInProceso(proc);
      }
    }
    if (type === 'cargo') {
      for (var s2 = 0; s2 < _matriz.sedes.length; s2++) {
        if (!_matriz.sedes[s2].procesos) continue;
        for (var p2 = 0; p2 < _matriz.sedes[s2].procesos.length; p2++) {
          if (!_matriz.sedes[s2].procesos[p2].cargos) continue;
          var cargo = _matriz.sedes[s2].procesos[p2].cargos.find(function (c) { return c.id === id; });
          if (cargo) return _countPeligrosInCargo(cargo);
        }
      }
    }
    return 0;
  }

  /* ─── Modal helpers ───────────────────────────────────────────────────── */
  function _showModal(title, bodyHtml, onConfirm) {
    var wrapper = document.querySelector('.kair-mp-wrapper');
    if (!wrapper) return;

    var overlay = wrapper.querySelector('.kair-mp-modal-overlay');
    if (!overlay) return;

    var titleEl = overlay.querySelector('.kair-mp-modal__title');
    var bodyEl = overlay.querySelector('.kair-mp-modal__body');
    var confirmBtn = overlay.querySelector('#kair-mp-modal-confirm');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;

    var newConfirm = confirmBtn.cloneNode(true);
    if (confirmBtn && confirmBtn.parentNode) {
      confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    }
    newConfirm.id = 'kair-mp-modal-confirm';
    newConfirm.addEventListener('click', function () {
      if (typeof onConfirm === 'function') onConfirm();
      overlay.classList.remove('visible');
    });

    overlay.classList.add('visible');

    var input = bodyEl ? bodyEl.querySelector('input') : null;
    if (input) {
      setTimeout(function () { input.focus(); input.select(); }, 100);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          newConfirm.click();
        }
      });
    }
  }

  /* ─── CRUD operations ─────────────────────────────────────────────────── */
  function _promptAddSede() {
    _showModal('Agregar Sede',
      '<label style="display:block;margin-bottom:0.5rem;font-size:var(--kair-mp-font-size-sm);color:var(--kair-mp-text-secondary);">Nombre de la sede:</label>' +
      '<input class="kair-mp-modal__input" id="kair-mp-modal-input" type="text" placeholder="Ej: Sede Principal">',
      function () {
        var input = document.querySelector('.kair-mp-wrapper #kair-mp-modal-input');
        var nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        IdentificacionPeligrosService.addSede(_companyName, nombre).then(function (result) {
          if (result && result.success) {
      IdentificacionPeligrosService.toast('Sede "' + nombre + '" creada', 'success');
        _debouncedXlsxSync();
        _reload();
          } else {
            IdentificacionPeligrosService.toast('Error al crear sede', 'error');
          }
        });
      }
    );
  }

  function _promptAddProceso(sedeId) {
    _showModal('Agregar Proceso',
      '<label style="display:block;margin-bottom:0.5rem;font-size:var(--kair-mp-font-size-sm);color:var(--kair-mp-text-secondary);">Nombre del proceso:</label>' +
      '<input class="kair-mp-modal__input" id="kair-mp-modal-input" type="text" placeholder="Ej: Administrativo">',
      function () {
        var input = document.querySelector('.kair-mp-wrapper #kair-mp-modal-input');
        var nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        IdentificacionPeligrosService.addProceso(_companyName, sedeId, nombre).then(function (result) {
          if (result && result.success) {
IdentificacionPeligrosService.toast('Proceso "' + nombre + '" creado', 'success');
          _setExpanded('sedes', sedeId, true);
          _debouncedXlsxSync();
          _reload();
          } else {
            IdentificacionPeligrosService.toast('Error al crear proceso', 'error');
          }
        });
      }
    );
  }

  function _promptAddCargo(procesoId) {
    _showModal('Agregar Cargo',
      '<label style="display:block;margin-bottom:0.5rem;font-size:var(--kair-mp-font-size-sm);color:var(--kair-mp-text-secondary);">Nombre del cargo:</label>' +
      '<input class="kair-mp-modal__input" id="kair-mp-modal-input" type="text" placeholder="Ej: Auxiliar Administrativo">',
      function () {
        var input = document.querySelector('.kair-mp-wrapper #kair-mp-modal-input');
        var nombre = input ? input.value.trim() : '';
        if (!nombre) return;
        IdentificacionPeligrosService.addCargo(_companyName, procesoId, nombre).then(function (result) {
          if (result && result.success) {
IdentificacionPeligrosService.toast('Cargo "' + nombre + '" creado', 'success');
          _setExpanded('procesos', procesoId, true);
          _debouncedXlsxSync();
          _reload();
          } else {
            IdentificacionPeligrosService.toast('Error al crear cargo', 'error');
          }
        });
      }
    );
  }

  function _confirmDelete(type, id) {
    var typeName = type.charAt(0).toUpperCase() + type.slice(1);
    var name = _findNameById(type, id);
    var childCount = _countChildren(type, id);

    var warnHtml = '';
    if (childCount > 0) {
      warnHtml = '<p style="color:var(--kair-mp-danger);font-size:var(--kair-mp-font-size-sm);margin-top:0.5rem;"><i class="bi bi-exclamation-triangle"></i> ' +
        'Se eliminarán ' + childCount + ' elemento' + (childCount !== 1 ? 's' : '') + ' asociado' + (childCount !== 1 ? 's' : '') + '.</p>';
    }

    _showModal('Eliminar ' + typeName,
      '<p style="font-size:var(--kair-mp-font-size-sm);">¿Está seguro de eliminar <strong>' + _escHtml(name) + '</strong>?</p>' + warnHtml,
      function () {
        var method = type === 'sede' ? 'deleteSede' : (type === 'proceso' ? 'deleteProceso' : 'deleteCargo');
        IdentificacionPeligrosService[method](_companyName, id).then(function (result) {
          if (result && result.success) {
IdentificacionPeligrosService.toast(typeName + ' eliminado/a', 'success');
          _debouncedXlsxSync();
          _reload();
          } else {
            IdentificacionPeligrosService.toast('Error al eliminar', 'error');
          }
        });
      }
    );
  }

  function _addPeligro(cargoId) {
    IdentificacionPeligrosService.addPeligro(_companyName, cargoId, {}).then(function (result) {
      if (result && result.success) {
IdentificacionPeligrosService.toast('Peligro agregado', 'success');
      _setExpanded('cargos', cargoId, true);
      _debouncedXlsxSync();
      _reload();
      } else {
        IdentificacionPeligrosService.toast('Error al agregar peligro', 'error');
      }
    });
  }

  function _deletePeligro(peligroId) {
    IdentificacionPeligrosService.deletePeligro(_companyName, peligroId).then(function (result) {
      if (result && result.success) {
IdentificacionPeligrosService.toast('Peligro eliminado', 'success');
      _debouncedXlsxSync();
      _reload();
      } else {
        IdentificacionPeligrosService.toast('Error al eliminar peligro', 'error');
      }
    });
  }

  /* ─── Reload ──────────────────────────────────────────────────────────── */
function _reload() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  _flushPendingChanges();
  _editingCellId = null;

    IdentificacionPeligrosService.read(_companyName).then(function (result) {
      if (result && result.success && result.data) {
        _matriz = result.data.matriz;
        _stats = result.data.stats;
      } else {
        _matriz = null;
        _stats = null;
      }
      var container = document.getElementById('kair-mp-matriz-content');
      if (container) _render(container);
    }).catch(function () {
      var container = document.getElementById('kair-mp-matriz-content');
      if (container) {
        container.innerHTML = '<div class="kair-mp-acc__empty-state"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3><p>No se pudo cargar la matriz de peligros.</p></div>';
      }
    });
  }

  /* ─── Cleanup ─────────────────────────────────────────────────────────── */
function _cleanup() {
  if (_xlsxSyncTimer) { clearTimeout(_xlsxSyncTimer); _xlsxSyncTimer = null; }
  if (_docClickHandler) {
      document.removeEventListener('mousedown', _docClickHandler);
      _docClickHandler = null;
    }
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      _keyHandler = null;
    }
  }

  /* ─── Public API ──────────────────────────────────────────────────────── */
  var MatrizView = {
  load: function (companyName) {
    _companyName = companyName;
    _pendingChanges = {};
    _editingCellId = null;
    _filterSede = '__all__';
    _expandState = { sedes: {}, procesos: {}, cargos: {} };

    var container = document.getElementById('kair-mp-matriz-content');
    if (!container) return;

    if (!_containerEventsBound) {
      _bindContainerEvents(container);
      _containerEventsBound = true;
    }

    container.innerHTML = '<div class="kair-mp-loading"><div class="kair-mp-spinner"></div><p>Cargando matriz...</p></div>';

      var optionsPromise = IdentificacionPeligrosService.gtc45Options();
      var readPromise = IdentificacionPeligrosService.read(companyName);

      Promise.all([optionsPromise, readPromise]).then(function (results) {
        var optResult = results[0];
        var readResult = results[1];

        if (optResult && optResult.success && optResult.data) {
          _gtc45Options = optResult.data;
        }

        if (readResult && readResult.success && readResult.data) {
          _matriz = readResult.data.matriz;
          _stats = readResult.data.stats;
        } else {
          _matriz = null;
          _stats = null;
        }

        _render(container);
      }).catch(function () {
        container.innerHTML = '<div class="kair-mp-acc__empty-state"><i class="bi bi-x-circle"></i><h3>Error al cargar</h3><p>No se pudo cargar la matriz de peligros.</p></div>';
      });
    },

  destroy: function () {
    _cleanup();
    _containerEventsBound = false;
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      _saveTimer = null;
      _flushPendingChanges();
    }
    if (_xlsxSyncTimer) { clearTimeout(_xlsxSyncTimer); _xlsxSyncTimer = null; }
    _pendingChanges = {};
    _matriz = null;
    _stats = null;
    _gtc45Options = null;
    _companyName = null;
    _editingCellId = null;
  },

    getMatriz: function () { return _matriz; },
    getStats: function () { return _stats; },

    refresh: function () {
      if (_companyName) _reload();
    }
  };

  window.MatrizView = MatrizView;
})();
