/* ═══════════════════════════════════════════════════════════════════
   K+AIR · List view (replica ListView.tsx del tar)
   v3.0 · 2026-06-19
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaListView = (function () {
  'use strict';

  var TABS = [
    { id: 'todas', label: 'Todas' },
    { id: 'programada', label: 'Programadas' },
    { id: 'en_curso', label: 'En curso' },
    { id: 'realizada', label: 'Realizadas' },
    { id: 'vencida', label: 'Vencidas' }
  ];

  var _state = { activeTab: 'todas', query: '', debouncedQuery: '', yearFilter: 'all' };
  var _debounceTimer = null;

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }

  function _setQuery(value) {
    _state.query = value;
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function () {
      _state.debouncedQuery = value;
      _rerender();
    }, 200);
  }

  function _setTab(tab) {
    _state.activeTab = tab;
    _rerender();
  }

  function _setYearFilter(y) {
    _state.yearFilter = y;
    _rerender();
  }

  var _onRerender = null;
  function _rerender() {
    if (typeof _onRerender === 'function') _onRerender();
  }

  function _renderHeader() {
    /* F16 (2026-06-20): Header estándar K+AIR · mismo patrón que HUB y 6.1.3 */
    var company = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.nombre) || 'Empresa';
    return '<header class="k-module-header">' +
      '<div class="k-header-left">' +
        '<div class="k-header-title-group">' +
          '<div class="k-header-main-title">' +
            '<i class="bi bi-clipboard-check-fill"></i> ' +
            'Gestión de Auditorías' +
          '</div>' +
          '<div class="k-header-breadcrumb">' +
            '<span>' + _esc(company) + '</span>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-back-module="1">Verificación</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-go-hub="1">6.1.2 Auditoría Anual</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<span class="k-breadcrumb-item active">Gestión de Auditorías</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="k-header-right">' +
        '<span class="k-sync-badge k-sync-synced" title="Datos cargados">' +
          '<i class="bi bi-check-circle-fill"></i> Sincronizado' +
        '</span>' +
        '<button type="button" class="header-back-btn" data-go-hub="1" title="Volver al Hub del submódulo">' +
          '<i class="bi bi-arrow-left"></i> Hub' +
        '</button>' +
        '<button type="button" class="k-btn k-btn-ghost k-btn-sm" data-action="reset-seed" title="Restablecer datos de demostración">' +
          '<i class="bi bi-arrow-counterclockwise"></i> Restablecer demo' +
        '</button>' +
        '<button type="button" class="k-btn k-btn-primary k-btn-sm" data-action="new-audit" title="Crear nueva auditoría">' +
          '<i class="bi bi-plus-lg"></i> Nueva auditoría' +
        '</button>' +
      '</div>' +
    '</header>';
  }

  function _renderKpis(kpis) {
    var items = [
      { key: 'programadas', label: 'Programadas', value: kpis.programadas, color: 'primary', icon: 'clipboard-check' },
      { key: 'encurso', label: 'En curso', value: kpis.enCurso, color: 'warning', icon: 'graph-up-arrow' },
      { key: 'realizadas', label: 'Realizadas', value: kpis.realizadas, color: 'success', icon: 'shield-check' },
      { key: 'vencidas', label: 'Vencidas', value: kpis.vencidas, color: 'danger', icon: 'exclamation-triangle' },
      { key: 'total', label: 'Total', value: kpis.total, color: 'primary', icon: 'calendar-event' }
    ];
    return '<div class="kair-v3-kpi-strip">' +
      items.map(function (k) {
        return '<div class="kair-v3-kpi kair-v3-kpi--' + k.color + '">' +
          '<div class="kair-v3-kpi__icon"><i class="bi bi-' + k.icon + '"></i></div>' +
          '<div class="kair-v3-kpi__content">' +
            '<div class="kair-v3-kpi__value">' + k.value + '</div>' +
            '<div class="kair-v3-kpi__label">' + k.label + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function _renderFilters(audits) {
    var tabCounts = {
      todas: audits.length,
      programada: audits.filter(function (a) { return a.status === 'programada'; }).length,
      en_curso: audits.filter(function (a) { return a.status === 'en_curso'; }).length,
      realizada: audits.filter(function (a) { return a.status === 'realizada'; }).length,
      vencida: audits.filter(function (a) { return a.status === 'vencida'; }).length
    };
    var years = Array.from(new Set(audits.map(function (a) { return a.year; }))).sort(function (a, b) { return b - a; });

    var tabsHtml = TABS.map(function (t) {
      var active = _state.activeTab === t.id;
      return '<button type="button" class="kair-v3-tab' + (active ? ' kair-v3-tab--active' : '') +
        '" data-set-tab="' + t.id + '">' +
        '<span>' + t.label + '</span>' +
        '<span class="kair-v3-tab__badge' + (active ? ' kair-v3-tab__badge--active' : '') + '">' + tabCounts[t.id] + '</span>' +
        '</button>';
    }).join('');

    var yearOptions = '<option value="all">Todos los años</option>' +
      years.map(function (y) {
        return '<option value="' + y + '"' + (_state.yearFilter === String(y) ? ' selected' : '') + '>' + y + '</option>';
      }).join('');

    return '<div class="kair-v3-card" style="padding:1rem;">' +
      '<div class="kair-v3-tabs" role="tablist" style="border-top:none;border-bottom:none;background:transparent;padding:0;margin-bottom:0.75rem;">' + tabsHtml + '</div>' +
      '<div class="kair-v3-row">' +
        '<div class="kair-v3-input-wrap" style="flex:1;min-width:240px;max-width:420px;">' +
          '<i class="bi bi-search"></i>' +
          '<input class="kair-v3-input" id="kair-v3-list-search" type="text" placeholder="Buscar por código, proceso, empresa o auditor..." value="' + _esc(_state.query) + '">' +
        '</div>' +
        '<div class="kair-v3-row">' +
          '<i class="bi bi-funnel" style="color:var(--v3-muted-foreground);"></i>' +
          '<select class="kair-v3-select" id="kair-v3-list-year" style="width:auto;min-width:120px;">' + yearOptions + '</select>' +
        '</div>' +
        '<div style="margin-left:auto;font-size:0.8125rem;color:var(--v3-muted-foreground);" id="kair-v3-list-counter"></div>' +
      '</div>' +
    '</div>';
  }

  function _filter(audits) {
    var q = _state.debouncedQuery.toLowerCase();
    return audits.filter(function (a) {
      if (_state.activeTab !== 'todas' && a.status !== _state.activeTab) return false;
      if (_state.yearFilter !== 'all' && String(a.year) !== _state.yearFilter) return false;
      if (q) {
        var haystack = [a.code, a.process, a.empresa, a.auditorLider, a.nit].concat(a.auditados || []).join(' ').toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function _renderTable(filtered) {
    if (filtered.length === 0) {
      return KairUI.EmptyState({
        icon: 'clipboard-check',
        title: 'No hay auditorías que coincidan',
        description: 'Ajusta los filtros o crea una nueva auditoría para comenzar.'
      });
    }
    return '<div class="kair-v3-table-card" style="overflow-x:auto;">' +
      '<table class="kair-v3-table" style="min-width:1100px;">' +
        '<thead><tr>' +
          '<th>Código</th>' +
          '<th>Proceso auditado</th>' +
          '<th>Tipo</th>' +
          '<th>Auditor líder</th>' +
          '<th>Empresa</th>' +
          '<th>F. programada</th>' +
          '<th>F. realización</th>' +
          '<th>Hallazgos</th>' +
          '<th>Estado</th>' +
          '<th style="text-align:right;">Acciones</th>' +
        '</tr></thead>' +
        '<tbody>' +
          filtered.map(function (a) {
            var hallazgoCount = (a.hallazgos || []).length;
            var hallazgoVariant = hallazgoCount === 0 ? 'neutral' :
              (a.hallazgos.some(function (h) { return h.estado === 'vencida'; }) ? 'danger' :
               a.hallazgos.some(function (h) { return h.estado === 'abierta' || h.estado === 'en_tratamiento'; }) ? 'warning' : 'success');

            return '<tr data-row-id="' + _esc(a.id) + '" style="cursor:pointer;">' +
              '<td><span style="font-family:ui-monospace,monospace;font-size:0.75rem;font-weight:600;color:var(--v3-primary);">' + _esc(a.code) + '</span></td>' +
              '<td>' +
                '<div style="font:600 0.8125rem/1.4 var(--v3-font-sans);color:var(--v3-foreground);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + _esc(a.process) + '">' + _esc(a.process) + '</div>' +
                '<div style="font-size:0.75rem;color:var(--v3-muted-foreground);">' + a.year + '</div>' +
              '</td>' +
              '<td><span style="font-size:0.75rem;color:var(--v3-muted-foreground);">' + _esc(KairHelpers.auditTypeLabel[a.auditType] || a.auditType) + '</span></td>' +
              '<td><div style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + _esc(a.auditorLider) + '">' + _esc(a.auditorLider) + '</div></td>' +
              '<td>' +
                '<div style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + _esc(a.empresa) + '">' + _esc(a.empresa) + '</div>' +
                '<div style="font-size:0.75rem;color:var(--v3-muted-foreground);">NIT ' + _esc(a.nit) + '</div>' +
              '</td>' +
              '<td>' + _esc(_fmtDate(a.fechaProgramada)) + '</td>' +
              '<td style="color:var(--v3-muted-foreground);">' + _esc(a.fechaVisitaDocumental ? _fmtDate(a.fechaVisitaDocumental) : '—') + '</td>' +
              '<td>' + (
                hallazgoCount > 0
                  ? KairUI.Badge({ variant: hallazgoVariant, children: hallazgoCount + ' hallazgos' })
                  : '<span style="color:#adb5bd;">—</span>'
              ) + '</td>' +
              '<td>' + KairUI.Badge({ variant: KairHelpers.auditStatusBadge[a.status] || 'neutral', dot: true, children: KairHelpers.auditStatusLabel[a.status] || a.status }) + '</td>' +
              '<td style="text-align:right;">' +
                '<button type="button" class="kair-v3-icon-btn" data-open-audit="' + _esc(a.id) + '" title="Abrir auditoría">' +
                  '<i class="bi bi-eye"></i>' +
                '</button>' +
              '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';
  }

  function render(container) {
    var audits = KairStore.selectAudits();
    var kpis = KairStore.computeKpisAuditorias();
    var filtered = _filter(audits);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader() +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpis) +
          _renderFilters(audits) +
          _renderTable(filtered) +
        '</main>' +
      '</div>';

    _bindEvents(container);
    _updateCounter(filtered.length, audits.length);
  }

  function _updateCounter(filteredCount, totalCount) {
    var el = document.getElementById('kair-v3-list-counter');
    if (el) el.textContent = filteredCount + ' de ' + totalCount + ' auditorías';
  }

  function _bindEvents(container) {
    // Tabs
    container.querySelectorAll('[data-set-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _setTab(btn.getAttribute('data-set-tab'));
      });
    });

    // Búsqueda
    var searchEl = document.getElementById('kair-v3-list-search');
    if (searchEl) {
      searchEl.addEventListener('input', function (e) { _setQuery(e.target.value); });
    }

    // Filtro año
    var yearEl = document.getElementById('kair-v3-list-year');
    if (yearEl) {
      yearEl.addEventListener('change', function (e) { _setYearFilter(e.target.value); });
    }

    // Click en fila → abre el editor
    container.querySelectorAll('[data-row-id]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-row-id');
        KairStore.actions.goEditor(id);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });

    // Botón abrir
    container.querySelectorAll('[data-open-audit]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-open-audit');
        KairStore.actions.goEditor(id);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });

    // Botón volver al Hub (F16: data-go-hub)
    var goHubBtns = container.querySelectorAll('[data-go-hub]');
    goHubBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        KairStore.actions.goHub();
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
    /* F17: breadcrumb "Verificación" → regresa al módulo padre */
    var backModuleBtns = container.querySelectorAll('[data-back-module]');
    backModuleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var inst = window.__kairAudInstance;
        if (inst && typeof inst.backToModuleCallback === 'function') {
          inst.backToModuleCallback();
        }
      });
    });

    // Botón reset demo
    var resetBtn = container.querySelector('[data-action="reset-seed"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual.showConfirm) {
          window.kairAuditoriaAnual.showConfirm({
            title: 'Restablecer demo',
            message: '¿Restablecer los datos de demostración? Se perderán los cambios locales.',
            acceptLabel: 'Restablecer', danger: true
          }).then(function (ok) {
            if (ok) {
              KairStore.actions.resetSeed();
              if (window.updateNotifier) window.updateNotifier.show({ type: 'success', title: 'Datos restablecidos' });
              _rerender();
            }
          });
        }
      });
    }

    // Botón nueva auditoría
    var newBtn = container.querySelector('[data-action="new-audit"]');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        if (window.updateNotifier) {
          window.updateNotifier.show({ type: 'info', title: 'Nueva auditoría', subtitle: 'En la versión enterprise, este botón abre el formulario de nueva auditoría.' });
        }
      });
    }
  }

  function destroy() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _state = { activeTab: 'todas', query: '', debouncedQuery: '', yearFilter: 'all' };
    _onRerender = null;
  }

  function setRerenderCallback(fn) { _onRerender = fn; }

  return {
    render: render,
    destroy: destroy,
    setRerenderCallback: setRerenderCallback
  };
})();

window.AuditoriaListView = AuditoriaListView;
