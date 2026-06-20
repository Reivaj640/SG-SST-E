/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.1 — Vista: Indicadores de PROCESO
   ═══════════════════════════════════════════════════════════════════ */

var IndicadoresProcesoView = (function () {
  'use strict';

  var _container = null;
  var _searchQuery = '';
  var _sortField = 'name';
  var _sortDir = 'asc';

  function _esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function _getFiltered() {
    var items = IndicadoresService.getIndicadoresByType('PROCESO');

    if (_searchQuery) {
      var q = _searchQuery.toLowerCase();
      items = items.filter(function (i) {
        return i.name.toLowerCase().indexOf(q) !== -1 ||
               i.definition.toLowerCase().indexOf(q) !== -1 ||
               i.responsible.toLowerCase().indexOf(q) !== -1;
      });
    }

    items.sort(function (a, b) {
      var cmp = 0;
      switch (_sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
        case 'frequency': cmp = a.frequency.localeCompare(b.frequency); break;
        case 'target': cmp = (a.target || 0) - (b.target || 0); break;
        default: cmp = 0;
      }
      return _sortDir === 'asc' ? cmp : -cmp;
    });

    return items;
  }

  function _toggleSort(field) {
    if (_sortField === field) {
      _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortField = field;
      _sortDir = 'asc';
    }
    _render();
  }

  function _renderSortIcon(field) {
    var active = _sortField === field;
    var icon = active ? (_sortDir === 'asc' ? 'bi-sort-up' : 'bi-sort-down') : 'bi-arrow-down-up';
    return '<i class="bi ' + icon + ' kair-ind-sort-icon' + (active ? ' kair-ind-sort-icon--active' : '') + '"></i>';
  }

  function _renderRow(ind, idx) {
    var targetDisplay = IndicadoresService.formatTarget(ind);
    var valueDisplay = IndicadoresService.formatValue(ind);
    var isAbove = ind.currentValue !== null && ind.currentValue >= ind.target;

    return '<tr class="kair-ind-table__row">' +
      '<td class="kair-ind-table__cell--num">' + (idx + 1) + '</td>' +
      '<td>' +
        '<div class="kair-ind-table__indicator-name">' + _esc(ind.name) + '</div>' +
        '<div class="kair-ind-table__indicator-def">' + _esc(ind.definition) + '</div>' +
      '</td>' +
      '<td><span class="kair-ind-freq-badge" style="color:' + IndicadoresService.getFreqColor(ind.frequency) +
        ';background:' + IndicadoresService.getFreqColor(ind.frequency) + '15">' + _esc(ind.frequency) + '</span></td>' +
      '<td class="kair-ind-table__cell--num">' + targetDisplay + '</td>' +
      '<td class="kair-ind-table__cell--num">' +
        '<span style="font-weight:600;color:' +
          (ind.status === 'critico' ? '#dc3545' : isAbove ? '#28a745' : 'inherit') + '">' +
          valueDisplay + '</span></td>' +
      '<td><span class="kair-ind-badge" style="background:' + IndicadoresService.getStatusBg(ind.status) +
        ';color:' + IndicadoresService.getStatusColor(ind.status) + '">' +
        IndicadoresService.getStatusLabel(ind.status) + '</span></td>' +
      '<td>' +
        '<div class="kair-ind-table__actions">' +
          '<button class="kair-ind-action-btn kair-ind-action-btn--view" data-view-id="' + ind.id + '" title="Ver detalle"><i class="bi bi-eye"></i></button>' +
          '<button class="kair-ind-action-btn kair-ind-action-btn--edit" data-edit-id="' + ind.id + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  function _render() {
    if (!_container) return;
    var items = _getFiltered();

    if (items.length === 0) {
      _container.innerHTML =
        '<div class="kair-ind-empty">' +
          '<i class="bi bi-search" style="font-size:2rem;color:#dee2e6"></i>' +
          '<p class="kair-ind-empty__title">No se encontraron indicadores</p>' +
          '<p class="kair-ind-empty__desc">' + (_searchQuery ? 'Intenta ajustar los términos de búsqueda' : 'No hay indicadores de proceso definidos') + '</p>' +
        '</div>';
      return;
    }

    var tbody = items.map(function (ind, idx) { return _renderRow(ind, idx); }).join('');

    _container.innerHTML =
      '<div class="kair-ind-table-wrapper">' +
        '<table class="kair-ind-table">' +
          '<thead><tr>' +
            '<th style="width:48px">#</th>' +
            '<th onclick="IndicadoresProcesoView._toggleSort(\'name\')" style="cursor:pointer">Indicador ' + _renderSortIcon('name') + '</th>' +
            '<th>Frecuencia</th>' +
            '<th onclick="IndicadoresProcesoView._toggleSort(\'target\')" style="cursor:pointer">Meta ' + _renderSortIcon('target') + '</th>' +
            '<th>Resultado Actual</th>' +
            '<th onclick="IndicadoresProcesoView._toggleSort(\'status\')" style="cursor:pointer">Estado ' + _renderSortIcon('status') + '</th>' +
            '<th style="width:100px">Acciones</th>' +
          '</tr></thead>' +
          '<tbody>' + tbody + '</tbody>' +
        '</table>' +
      '</div>';

    _bindActions();
  }

  function _bindActions() {
    _container.querySelectorAll('[data-view-id]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-view-id');
        var ind = IndicadoresService.getIndicadorById(id);
        if (ind) IndicadoresDetalleModal.open(ind);
      };
    });
    _container.querySelectorAll('[data-edit-id]').forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-edit-id');
        var ind = IndicadoresService.getIndicadorById(id);
        if (ind) IndicadoresDetalleModal.open(ind);
      };
    });
  }

  function load(container, searchQuery) {
    _container = container;
    _searchQuery = searchQuery || '';
    _render();
  }

  function setSearch(q) {
    _searchQuery = q;
    _render();
  }

  return {
    load: load,
    setSearch: setSearch,
    _toggleSort: _toggleSort
  };
})();
