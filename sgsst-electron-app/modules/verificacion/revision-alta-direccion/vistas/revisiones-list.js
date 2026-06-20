/**
 * =====================================================================
 * SUBMÓDULO 6.1.3 — Vista: REVISIONES GERENCIALES (List)
 * Patrón A Dashboard · 4 summary cards + 4 tabs + search + tabla 9 cols
 * =====================================================================
 */

var RevisionesListView = (function() {
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

  function badgeFor(value) {
    var map = {
      'Realizada': 'success', 'Borrador': 'info', 'Vencida': 'danger',
      'En Proceso': 'warning', 'Cerrado': 'success', 'Abierto': 'warning',
      'Finalizada': 'success', 'Programada': 'warning', 'Cancelada': 'danger'
    };
    var cls = map[value] || 'neutral';
    return '<span class="kair-rad-badge kair-rad-badge--' + cls + '"><span class="dot"></span>' + _esc(value) + '</span>';
  }

  /* Sub-puntos por sección (mock para vista rápida) */
  function _subPuntosForSeccion(key) {
    var m = {
      'lectura': ['Lectura del acta anterior RG-2024-01', 'Verificación de acciones pendientes'],
      'componentes': ['Política SST vigente', 'Responsables asignados', 'Recursos asignados', 'Comunicación interna'],
      'auditorias': ['Plan de auditoría 2025', 'Hallazgos abiertos', 'Cierre de no conformidades'],
      'requisitos': ['Matriz legal actualizada', 'Cumplimiento Decreto 1072', 'Resolución 0312 de 2019'],
      'participacion': ['Funcionarios capacitados', 'COPASST activo', 'Actas de reunión'],
      'incidentes': ['Investigaciones cerradas', 'Accidentalidad del periodo', 'Planes de acción'],
      'acciones': ['Cumplimiento de compromisos previos'],
      'cambios': ['Cambios normativos', 'Cambios organizacionales', 'Cambios tecnológicos'],
      'supervision': ['Inspecciones planeadas', 'Inspecciones ejecutadas'],
      'evaluacion': ['Evaluación inicial del año', 'Plan de mejora'],
      'preventivas': ['Acciones preventivas ejecutadas', 'Acciones correctivas cerradas'],
      'conclusiones': ['Conclusiones generales']
    };
    return m[key] || [];
  }

  /* Vista principal del list */
  function render(ctx) {
    /* ctx: { data, state, host, navigate, toast } */
    var data = ctx.data || {};
    var revisiones = data.revisiones || [];
    var viewState = ctx.state.revisionesList || { activeTab: 'todas', search: '' };

    var wrap = document.createElement('div');
    wrap.className = 'kair-rad-view-revisiones-list';

    /* Cálculos de summary cards */
    var total = revisiones.length;
    var realizadas = revisiones.filter(function(r) {
      return r.estado === 'Realizada' || r.estado === 'Cerrado' || r.estado === 'Finalizada';
    }).length;
    var borrador = revisiones.filter(function(r) {
      return r.estado === 'Borrador' || r.estado === 'En Proceso';
    }).length;
    var vencidas = revisiones.filter(function(r) {
      return r.estado === 'Vencida' || r.estado === 'Cancelada';
    }).length;

    /* 1. KPI strip · Mismo patrón que el HUB (kair-rad-kpi-strip + kair-rad-kpi)
       para mantener consistencia visual entre submódulo y vistas internas. */
    var summary = document.createElement('div');
    summary.className = 'kair-rad-kpi-strip kair-rad-kpi-strip--flush';

    var kpis = [
      { value: total,     label: 'Revisiones Registradas', icon: 'bi-collection', color: 'primary',
        sub: total + ' en el sistema' },
      { value: realizadas, label: 'Realizadas',            icon: 'bi-clipboard-check', color: 'success',
        sub: realizadas > 0 ? 'Histórico cerrado' : 'Sin histórico aún',
        subClass: realizadas > 0 ? 'kair-rad-kpi__sub--success' : '' },
      { value: borrador,   label: 'En Borrador',            icon: 'bi-clock-history',   color: 'warning',
        sub: 'En preparación', subClass: 'kair-rad-kpi__sub--warning' },
      { value: vencidas,   label: 'Vencidas',               icon: 'bi-exclamation-triangle', color: vencidas > 0 ? 'danger' : 'success',
        sub: vencidas > 0 ? 'Requieren atención' : 'Sin alertas',
        subClass: vencidas > 0 ? 'kair-rad-kpi__sub--danger' : 'kair-rad-kpi__sub--success' }
    ];

    kpis.forEach(function(kpi) {
      var item = document.createElement('div');
      item.className = 'kair-rad-kpi';
      item.innerHTML =
        '<div class="kair-rad-kpi__icon kair-rad-kpi__icon--' + kpi.color + '">' +
          '<i class="bi ' + kpi.icon + '" style="font-size:1.125rem"></i>' +
        '</div>' +
        '<div class="kair-rad-kpi__content">' +
          '<div class="kair-rad-kpi__value">' + kpi.value + '</div>' +
          '<div class="kair-rad-kpi__label">' + kpi.label + '</div>' +
          '<div class="kair-rad-kpi__sub ' + (kpi.subClass || '') + '">' + kpi.sub + '</div>' +
        '</div>';
      summary.appendChild(item);
    });
    wrap.appendChild(summary);

    /* 2. Tabs bar */
    var tabDefs = [
      { id: 'todas', label: 'Todas', count: total },
      { id: 'realizadas', label: 'Realizadas', count: realizadas },
      { id: 'borrador', label: 'Borrador', count: borrador },
      { id: 'vencidas', label: 'Vencidas', count: vencidas }
    ];

    var tabsBar = document.createElement('div');
    tabsBar.className = 'kair-rad-tabs-bar';
    tabDefs.forEach(function(t) {
      var btn = document.createElement('button');
      btn.className = 'kair-rad-tabs-bar__btn' + (t.id === viewState.activeTab ? ' is-active' : '');
      btn.setAttribute('data-tab', t.id);
      btn.innerHTML = t.label + ' <span class="kair-rad-tabs-bar__badge">' + t.count + '</span>';
      btn.addEventListener('click', function() {
        viewState.activeTab = t.id;
        ctx.state.revisionesList = viewState;
        ctx.refresh();
      });
      tabsBar.appendChild(btn);
    });
    wrap.appendChild(tabsBar);

    /* 3. Search row */
    var searchRow = document.createElement('div');
    searchRow.className = 'kair-rad-search-row';
    var search = document.createElement('div');
    search.className = 'kair-rad-search';
    search.innerHTML =
      '<i class="bi bi-search kair-rad-search__icon"></i>' +
      '<input type="text" id="kair-rad-search-revisiones" placeholder="Buscar por consecutivo, período, preside o empresa..." value="' + _esc(viewState.search || '') + '">';
    searchRow.appendChild(search);
    var count = document.createElement('span');
    count.className = 'kair-rad-search-count';
    count.id = 'kair-rad-search-count';
    searchRow.appendChild(count);
    /* Botón "Nueva Revisión" · siempre visible para crear borrador desde la lista */
    var btnNew = document.createElement('button');
    btnNew.className = 'kair-rad-header__action kair-rad-header__action--primary';
    btnNew.setAttribute('data-list-new', '1');
    btnNew.innerHTML = '<i class="bi bi-plus-circle"></i> Nueva Revisión';
    btnNew.style.marginLeft = 'auto';
    searchRow.appendChild(btnNew);
    /* Bind del botón "Nueva Revisión" */
    btnNew.addEventListener('click', function() {
      if (typeof ctx.navigate === 'function') {
        ctx.navigate('revisiones-editor', { id: null });
      }
    });
    wrap.appendChild(searchRow);

    /* 4. Tabla */
    var tableCard = document.createElement('div');
    tableCard.className = 'kair-rad-table-card';
    tableCard.style.marginTop = 'var(--rad-s4)';
    tableCard.id = 'kair-rad-list-table-card';
    wrap.appendChild(tableCard);

    /* Render inicial de la tabla con los filtros activos */
    var filtered = _applyFilters(revisiones, viewState);
    count.textContent = filtered.length + ' resultado' + (filtered.length !== 1 ? 's' : '');
    _renderTable(tableCard, filtered, ctx);

    /* Bind search input */
    setTimeout(function() {
      var searchInput = document.getElementById('kair-rad-search-revisiones');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          viewState.search = searchInput.value;
          ctx.state.revisionesList = viewState;
          var f = _applyFilters(revisiones, viewState);
          count.textContent = f.length + ' resultado' + (f.length !== 1 ? 's' : '');
          _renderTable(tableCard, f, ctx);
        });
      }
    }, 0);

    return wrap;
  }

  function _applyFilters(revisiones, viewState) {
    var rows = revisiones.slice();
    if (viewState.activeTab === 'realizadas') {
      rows = rows.filter(function(r) { return r.estado === 'Realizada' || r.estado === 'Cerrado' || r.estado === 'Finalizada'; });
    } else if (viewState.activeTab === 'borrador') {
      rows = rows.filter(function(r) { return r.estado === 'Borrador' || r.estado === 'En Proceso'; });
    } else if (viewState.activeTab === 'vencidas') {
      rows = rows.filter(function(r) { return r.estado === 'Vencida' || r.estado === 'Cancelada'; });
    }
    var s = (viewState.search || '').toLowerCase().trim();
    if (s) {
      rows = rows.filter(function(r) {
        return (r.id || '').toLowerCase().indexOf(s) >= 0 ||
               (r.periodo || '').toLowerCase().indexOf(s) >= 0 ||
               (r.preside || '').toLowerCase().indexOf(s) >= 0 ||
               (r.elabora || '').toLowerCase().indexOf(s) >= 0 ||
               (r.empresa || '').toLowerCase().indexOf(s) >= 0;
      });
    }
    return rows;
  }

  function _renderTable(card, rows, ctx) {
    if (rows.length === 0) {
      card.innerHTML =
        '<div class="kair-rad-state">' +
          '<div class="kair-rad-state__icon kair-rad-state__icon--muted">' +
            '<i class="bi bi-inbox" style="font-size:1.5rem"></i>' +
          '</div>' +
          '<h3 class="kair-rad-state__title">Sin resultados</h3>' +
          '<p class="kair-rad-state__desc">No hay revisiones que coincidan con el filtro o búsqueda activos.</p>' +
          '<button class="kair-rad-header__action kair-rad-header__action--primary" data-empty="new">' +
            '<i class="bi bi-plus-circle"></i> Iniciar primera revisión' +
          '</button>' +
        '</div>';
      var btn = card.querySelector('[data-empty="new"]');
      if (btn) {
        btn.addEventListener('click', function() {
          ctx.navigate('revisiones-editor', { id: null });
        });
      }
      return;
    }

    var html = '<table class="kair-rad-table kair-rad-table--9col"><thead><tr>' +
      '<th>Consecutivo</th>' +
      '<th>Período</th>' +
      '<th>Empresa</th>' +
      '<th>Fecha realizada</th>' +
      '<th>Preside</th>' +
      '<th>Elabora</th>' +
      '<th>Estado</th>' +
      '<th style="min-width:160px">Progreso</th>' +
      '<th style="width:120px; text-align:right">Acciones</th>' +
    '</tr></thead><tbody>';

    rows.forEach(function(r) {
      var prog = r.progreso || 0;
      var fillCls = prog >= 100 ? 'kair-rad-table-progress__fill--success' : (prog >= 50 ? '' : 'kair-rad-table-progress__fill--warning');
      html += '<tr>' +
        '<td>' +
          '<div class="col-doc">' +
            '<div class="col-doc-icon"><i class="bi bi-file-earmark-text"></i></div>' +
            '<div>' +
              '<div class="col-doc-id">' + _esc(r.id || '') + '</div>' +
              '<div class="col-doc-sub">' + (r.participantes || 0) + ' participantes</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><strong>' + _esc(r.periodo || '') + '</strong></td>' +
        '<td>' + _esc(r.empresa || '—') + '</td>' +
        '<td>' + _esc(formatDate(r.fecha || r.fechaProgramada || '')) + '</td>' +
        '<td>' + _esc(r.preside || '—') + '</td>' +
        '<td>' + _esc(r.elabora || '—') + '</td>' +
        '<td>' + badgeFor(r.estado || 'Borrador') + '</td>' +
        '<td>' +
          '<div class="kair-rad-table-progress">' +
            '<div class="kair-rad-table-progress__bar">' +
              '<div class="kair-rad-table-progress__fill ' + fillCls + '" style="width:' + prog + '%"></div>' +
            '</div>' +
            '<span class="kair-rad-table-progress__label">' + prog + '%</span>' +
          '</div>' +
        '</td>' +
        '<td><div class="cell-actions">' +
          '<button class="kair-rad-icon-btn" title="Ver acta" data-row-action="view" data-row-id="' + _esc(r.id || '') + '"><i class="bi bi-eye"></i></button>' +
          '<button class="kair-rad-icon-btn" title="Editar" data-row-action="edit" data-row-id="' + _esc(r.id || '') + '"><i class="bi bi-pencil"></i></button>' +
          '<button class="kair-rad-icon-btn kair-rad-icon-btn--danger" title="Eliminar borrador" data-row-action="delete" data-row-id="' + _esc(r.id || '') + '" data-row-estado="' + _esc(r.estado || '') + '"><i class="bi bi-trash"></i></button>' +
        '</div></td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    card.innerHTML = html;

    /* Bind row actions */
    card.querySelectorAll('[data-row-action="view"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        ctx.navigate('revisiones-viewer', { id: btn.getAttribute('data-row-id') });
      });
    });
    card.querySelectorAll('[data-row-action="edit"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        ctx.navigate('revisiones-editor', { id: btn.getAttribute('data-row-id') });
      });
    });

    /* Eliminar revisión (con confirmación via ctx.eliminarRevision) */
    card.querySelectorAll('[data-row-action="delete"]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        /* DEBUG: confirmar que el click llega al handler */
        try { console.log('[K+AIRSST][6.1.3][DELETE-CLICK] handler disparado', btn); } catch (e) {}

        var id = btn.getAttribute('data-row-id');
        var estado = btn.getAttribute('data-row-estado') || '';
        var isBorrador = estado === 'Borrador' || estado === 'En Proceso' || estado === 'Programada';

        if (typeof ctx.eliminarRevision === 'function') {
          var eliminado = await ctx.eliminarRevision(id, isBorrador);
          if (eliminado) {
            /* Re-render la tabla para reflejar el cambio */
            var refreshed = _applyFilters(ctx.data.revisiones || [], ctx.state.revisionesList || { activeTab: 'todas' });
            _renderTable(card, refreshed, ctx);
          }
        } else {
          try { console.error('[K+AIRSST][6.1.3][DELETE-CLICK] ctx.eliminarRevision no es función'); } catch (e) {}
          if (typeof ctx.toast === 'function') {
            ctx.toast('Función no disponible', 'No se puede eliminar en este momento', 'error');
          }
        }
      });
    });
  }

  return { render: render };
})();

window.RevisionesListView = RevisionesListView;
