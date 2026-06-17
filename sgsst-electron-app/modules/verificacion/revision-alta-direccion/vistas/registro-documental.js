/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: REGISTRO DOCUMENTAL (GG-FO-005)
 * Correspondencia interna/externa con tipificación oficial 01-07
 * =====================================================================
 */

var RegistroDocumentalView = (function() {
  'use strict';

  function _esc(str) {
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatDate(d) {
    if (!d) return '';
    var months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var parts = String(d).split('-');
    if (parts.length === 3) return parseInt(parts[2], 10) + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
    return String(d);
  }

  /* Tipificación oficial GG-FO-005 */
  var TIPOLOGIAS = {
    '01': { label: 'Facturas',                icon: 'bi-receipt',                color: 'primary' },
    '02': { label: 'Cuentas de cobro',        icon: 'bi-cash-coin',              color: 'success' },
    '03': { label: 'Remisiones',              icon: 'bi-box-seam',               color: 'info' },
    '04': { label: 'Cotizaciones',            icon: 'bi-file-earmark-ruled',     color: 'warning' },
    '05': { label: 'Documentos',              icon: 'bi-file-earmark-text',      color: 'neutral' },
    '06': { label: 'Cartas',                  icon: 'bi-envelope',               color: 'primary' },
    '07': { label: 'Otros',                   icon: 'bi-file-earmark',           color: 'neutral' }
  };

  /* Mock: 5 registros de ejemplo (basado en GG-FO-005) */
  var REGISTROS_MOCK = [
    {
      id: 'REG-2025-001',
      fecha: '2025-11-15',
      tipo: '01',
      numero: 'FAC-2589',
      origen: 'Proveedor ABC S.A.S.',
      destino: 'TEMPOSUM S.A.S.',
      asunto: 'Factura por servicios de calibración de equipos',
      estado: 'Recibido',
      archivo: 'FAC-2589.pdf'
    },
    {
      id: 'REG-2025-002',
      fecha: '2025-11-08',
      tipo: '04',
      numero: 'COT-445',
      origen: 'Seguridad Total Ltda.',
      destino: 'TEMPOSUM S.A.S.',
      asunto: 'Cotización equipos de protección personal Q1 2026',
      estado: 'En evaluación',
      archivo: 'COT-445.pdf'
    },
    {
      id: 'REG-2025-003',
      fecha: '2025-10-30',
      tipo: '06',
      numero: 'CAR-023',
      origen: 'Ministerio del Trabajo',
      destino: 'TEMPOSUM S.A.S.',
      asunto: 'Requerimiento de información sobre accidentalidad',
      estado: 'Respondido',
      archivo: 'CAR-023.pdf'
    },
    {
      id: 'REG-2025-004',
      fecha: '2025-10-22',
      tipo: '05',
      numero: 'DOC-188',
      origen: 'ARL Sura',
      destino: 'TEMPOSUM S.A.S.',
      asunto: 'Informe de seguimiento de casos de enfermedad laboral',
      estado: 'Archivado',
      archivo: 'DOC-188.pdf'
    },
    {
      id: 'REG-2025-005',
      fecha: '2025-10-15',
      tipo: '03',
      numero: 'REM-0921',
      origen: 'Proveedor XYZ S.A.',
      destino: 'TEMPOSUM S.A.S. - Sede Norte',
      asunto: 'Remisión de elementos de protección personal',
      estado: 'Recibido',
      archivo: 'REM-0921.pdf'
    }
  ];

  function render(ctx) {
    var registros = (ctx.data.documentos && ctx.data.documentos.length > 0) ? ctx.data.documentos : REGISTROS_MOCK;

    var viewState = ctx.state.registro || { filterTipo: 'todos', search: '' };

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-registro-documental';

    /* Tipificación oficial · strip horizontal de chips */
    var tipHeader = document.createElement('div');
    tipHeader.className = 'kair-rad-tipificacion-strip';
    var total = registros.length;
    tipHeader.innerHTML =
      '<div class="kair-rad-tipificacion-strip__title">' +
        '<i class="bi bi-archive"></i>' +
        '<span>Tipificación oficial · ' + total + ' registro' + (total !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="kair-rad-tipificacion-strip__chips">' +
        _tipChip('todos', 'Todos', null, viewState.filterTipo) +
        Object.keys(TIPOLOGIAS).map(function(k) {
          var count = registros.filter(function(r) { return r.tipo === k; }).length;
          return _tipChip(k, TIPOLOGIAS[k].label, count, viewState.filterTipo);
        }).join('') +
      '</div>';
    wrap.appendChild(tipHeader);

    /* Search row */
    var searchRow = document.createElement('div');
    searchRow.className = 'kair-rad-search-row';
    searchRow.innerHTML =
      '<div class="kair-rad-search">' +
        '<i class="bi bi-search kair-rad-search__icon"></i>' +
        '<input type="text" id="kair-rad-registro-search" placeholder="Buscar por consecutivo, número, origen, destino o asunto…" value="' + _esc(viewState.search || '') + '">' +
      '</div>' +
      '<button class="kair-rad-header__action kair-rad-header__action--primary" data-registro="new">' +
        '<i class="bi bi-plus-circle"></i> Nuevo registro' +
      '</button>';
    wrap.appendChild(searchRow);

    /* Tabla */
    var tableCard = document.createElement('div');
    tableCard.className = 'kair-rad-table-card';
    tableCard.style.marginTop = 'var(--rad-s4)';
    tableCard.id = 'kair-rad-registro-table-card';
    wrap.appendChild(tableCard);

    var filtered = _applyFilters(registros, viewState);
    _renderTable(tableCard, filtered);

    /* Bind */
    setTimeout(function() {
      var searchInput = document.getElementById('kair-rad-registro-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          viewState.search = searchInput.value;
          ctx.state.registro = viewState;
          var f = _applyFilters(registros, viewState);
          _renderTable(tableCard, f);
        });
      }
      wrap.querySelectorAll('[data-tipo]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          viewState.filterTipo = btn.getAttribute('data-tipo');
          ctx.state.registro = viewState;
          var f = _applyFilters(registros, viewState);
          _renderTable(tableCard, f);
          /* Update active */
          wrap.querySelectorAll('[data-tipo]').forEach(function(b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
        });
      });
      var btnNew = wrap.querySelector('[data-registro="new"]');
      if (btnNew && typeof ctx.toast === 'function') {
        btnNew.addEventListener('click', function() {
          ctx.toast('Nuevo registro', 'Abriendo formulario GG-FO-005', 'info');
        });
      }
    }, 0);

    return wrap;
  }

  function _applyFilters(rows, state) {
    var r = rows.slice();
    if (state.filterTipo && state.filterTipo !== 'todos') {
      r = r.filter(function(reg) { return reg.tipo === state.filterTipo; });
    }
    var s = (state.search || '').toLowerCase().trim();
    if (s) {
      r = r.filter(function(reg) {
        return (reg.id || '').toLowerCase().indexOf(s) >= 0 ||
               (reg.numero || '').toLowerCase().indexOf(s) >= 0 ||
               (reg.origen || '').toLowerCase().indexOf(s) >= 0 ||
               (reg.destino || '').toLowerCase().indexOf(s) >= 0 ||
               (reg.asunto || '').toLowerCase().indexOf(s) >= 0;
      });
    }
    return r;
  }

  function _renderTable(card, rows) {
    if (rows.length === 0) {
      card.innerHTML =
        '<div class="kair-rad-state">' +
          '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
            '<i class="bi bi-archive" style="font-size:1.5rem"></i>' +
          '</div>' +
          '<h3 class="kair-rad-state__title">Sin registros</h3>' +
          '<p class="kair-rad-state__desc">No hay documentos que coincidan con el filtro o búsqueda activos.</p>' +
          '<button class="kair-rad-header__action kair-rad-header__action--primary" data-empty="new">' +
            '<i class="bi bi-plus-circle"></i> Nuevo registro' +
          '</button>' +
        '</div>';
      return;
    }

    var html = '<table class="kair-rad-table"><thead><tr>' +
      '<th>Consecutivo</th>' +
      '<th>Fecha</th>' +
      '<th>Tipo</th>' +
      '<th>Número</th>' +
      '<th>Origen</th>' +
      '<th>Destino</th>' +
      '<th>Asunto</th>' +
      '<th>Estado</th>' +
      '<th>Archivo</th>' +
      '<th style="width: 100px; text-align: right">Acciones</th>' +
    '</tr></thead><tbody>';

    rows.forEach(function(r) {
      var tip = TIPOLOGIAS[r.tipo] || { label: r.tipo, icon: 'bi-file-earmark', color: 'neutral' };
      var estadoCls = r.estado === 'Recibido' || r.estado === 'Respondido' || r.estado === 'Archivado' ? 'success' :
                       r.estado === 'En evaluación' ? 'warning' : 'info';

      html += '<tr>' +
        '<td class="cell-mono">' + _esc(r.id) + '</td>' +
        '<td>' + _esc(formatDate(r.fecha)) + '</td>' +
        '<td>' +
          '<span class="kair-rad-tip-pill kair-rad-tip-pill--' + tip.color + '">' +
            '<span class="kair-rad-tip-pill__code">' + _esc(r.tipo) + '</span>' +
            '<span class="kair-rad-tip-pill__label">' + _esc(tip.label) + '</span>' +
          '</span>' +
        '</td>' +
        '<td class="cell-mono">' + _esc(r.numero) + '</td>' +
        '<td>' + _esc(r.origen) + '</td>' +
        '<td>' + _esc(r.destino) + '</td>' +
        '<td style="max-width: 260px">' +
          '<span style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font:var(--rad-body-sm)">' + _esc(r.asunto) + '</span>' +
        '</td>' +
        '<td><span class="kair-rad-badge kair-rad-badge--' + estadoCls + '"><span class="dot"></span>' + _esc(r.estado) + '</span></td>' +
        '<td>' +
          '<span style="display:inline-flex;align-items:center;gap:4px;font:var(--rad-caption);color:var(--rad-text-muted)">' +
            '<i class="bi bi-paperclip"></i> ' + _esc(r.archivo) +
          '</span>' +
        '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="kair-rad-icon-btn" title="Ver" data-registro-action="view" data-registro-id="' + _esc(r.id) + '"><i class="bi bi-eye"></i></button>' +
          '<button class="kair-rad-icon-btn" title="Editar" data-registro-action="edit" data-registro-id="' + _esc(r.id) + '"><i class="bi bi-pencil"></i></button>' +
          '<button class="kair-rad-icon-btn" title="Descargar" data-registro-action="download" data-registro-id="' + _esc(r.id) + '"><i class="bi bi-download"></i></button>' +
        '</div></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    card.innerHTML = html;

    /* Bind row actions */
    card.querySelectorAll('[data-registro-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-registro-id');
        var act = btn.getAttribute('data-registro-action');
        if (typeof ctx.toast === 'function') {
          ctx.toast('Registro ' + id, 'Acción: ' + act + ' (próximamente)', 'info');
        }
      });
    });
  }

  function _tipChip(value, label, count, current) {
    var active = value === current;
    var countStr = (count !== null && count !== undefined) ? ' <span class="kair-rad-tip-chip__count">' + count + '</span>' : '';
    return '<button class="kair-rad-tip-chip' + (active ? ' is-active' : '') + '" data-tipo="' + _esc(value) + '">' +
      '<span class="kair-rad-tip-chip__code">' + _esc(value === 'todos' ? '·' : value) + '</span>' +
      '<span class="kair-rad-tip-chip__label">' + _esc(label) + '</span>' +
      countStr +
    '</button>';
  }

  return { render: render, TIPOLOGIAS: TIPOLOGIAS };
})();

window.RegistroDocumentalView = RegistroDocumentalView;