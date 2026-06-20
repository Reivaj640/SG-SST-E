/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Cronograma view (replica CronogramaView.tsx del tar)
   v3.0 · 2026-06-19
   Vista simplificada: header + KPIs + tabs por fase + lista cronológica + dialog edición
   (drag&drop complejo se omite; el user puede mover vía editar)
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaCronogramaView = (function () {
  'use strict';

  var FASES = [
    { id: 'preparacion',    label: 'Preparación',                  short: 'Prep',  color: '#174ea6', bg: '#e8f0fe' },
    { id: 'realizacion',    label: 'Realización',                 short: 'Real',  color: '#856404', bg: '#fff3cd' },
    { id: 'plan_accion',    label: 'Plan de acción',              short: 'Plan',  color: '#383d41', bg: '#e2e3e5' },
    { id: 'implementacion', label: 'Implementación',              short: 'Impl',  color: '#155724', bg: '#d4edda' }
  ];

  var _state = { year: new Date().getFullYear(), faseFilter: 'todas', editing: null };

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }
  function _shortMonth(mes) { return KairHelpers.MONTHS_SHORT_ES[mes - 1] || '—'; }

  function _getAllItems(audits, year) {
    var all = [];
    audits.forEach(function (a) {
      (a.cronograma || []).forEach(function (c) {
        all.push(Object.assign({}, c, {
          auditCode: a.code,
          auditProcess: a.process,
          auditId: a.id
        }));
      });
    });
    return all.filter(function (i) { return i.anio === year; });
  }

  function _renderHeader(year, years) {
    return '<header class="kair-v3-hub-header">' +
      '<div class="kair-v3-hub-header__left">' +
        '<button class="k-btn k-btn-ghost k-btn-sm" id="kair-v3-cron-back" style="width:auto;height:32px;padding:0 12px;">' +
          '<i class="bi bi-arrow-left"></i> Hub' +
        '</button>' +
        '<div style="margin-left:0.5rem;">' +
          '<h1 class="kair-v3-hub-header__title">Cronograma Anual de Auditorías</h1>' +
          '<p class="kair-v3-hub-header__subtitle">Calendarización de las 4 fases del ciclo — GI-FO-062</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-v3-hub-header__right">' +
        '<div class="kair-v3-row">' +
          '<i class="bi bi-calendar3" style="color:var(--v3-muted-foreground);"></i>' +
          '<select class="kair-v3-select" id="kair-v3-cron-year" style="width:auto;min-width:120px;">' +
            years.map(function (y) {
              return '<option value="' + y + '"' + (_state.year === y ? ' selected' : '') + '>' + y + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        KairUI.Button({ id: 'kair-v3-cron-new', variant: 'primary', size: 'sm', icon: 'plus-lg', label: 'Nuevo hito' }) +
      '</div>' +
    '</header>';
  }

  function _renderKpis(kpis) {
    var items = [
      { label: 'Total hitos', value: kpis.total, color: 'primary', icon: 'calendar-event' },
      { label: 'Pendientes', value: kpis.pendientes, color: 'neutral', icon: 'clock' },
      { label: 'En curso', value: kpis.enCurso, color: 'warning', icon: 'arrow-repeat' },
      { label: 'Completados', value: kpis.completados, color: 'success', icon: 'check-circle' },
      { label: 'Vencidos', value: kpis.vencidos, color: 'danger', icon: 'exclamation-triangle' }
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

  function _renderCalendar(items, audits) {
    /* Vista calendario 4 fases × 12 meses. Cada celda es un stack vertical. */
    return '<section class="kair-v3-section-card" style="overflow-x:auto;">' +
      '<header class="kair-v3-section-card__head">' +
        '<h3 class="kair-v3-section-card__title"><i class="bi bi-calendar3"></i> Vista anual ' + _state.year + '</h3>' +
        KairUI.Badge({ variant: 'info', children: items.length + ' hitos' }) +
      '</header>' +
      '<div class="kair-v3-section-card__body">' +
        '<div class="kair-v3-cron-grid">' +
          '<div class="kair-v3-cron-grid__head">' +
            '<div class="kair-v3-cron-grid__corner"></div>' +
            KairHelpers.MONTHS_SHORT_ES.map(function (m) {
              return '<div class="kair-v3-cron-grid__month">' + m + '</div>';
            }).join('') +
          '</div>' +
          FASES.map(function (fase) {
            var faseItems = items.filter(function (i) { return i.fase === fase.id; });
            return '<div class="kair-v3-cron-grid__row">' +
              '<div class="kair-v3-cron-grid__fase" style="background:' + fase.bg + ';color:' + fase.color + ';">' +
                '<strong>' + fase.short + '</strong>' +
                '<span style="font-size:0.6875rem;font-weight:500;">' + faseItems.length + ' hitos</span>' +
              '</div>' +
              KairHelpers.MONTHS_SHORT_ES.map(function (_, mesIdx) {
                var mes = mesIdx + 1;
                var cellItems = faseItems.filter(function (i) { return i.mes === mes; });
                var cellHtml = cellItems.map(function (i) {
                  var audit = audits.find(function (a) { return a.id === i.auditId; });
                  return '<div class="kair-v3-cron-cell-item" data-edit-hito="' + _esc(i.id) + '" data-audit-id="' + _esc(i.auditId) + '" style="background:' + fase.color + '20;border-left:3px solid ' + fase.color + ';">' +
                    '<div class="kair-v3-cron-cell-item__code">' + _esc(i.auditCode || '—') + '</div>' +
                    '<div class="kair-v3-cron-cell-item__obs" title="' + _esc(i.observaciones || '') + '">' + _esc((i.observaciones || '').substring(0, 40)) + '</div>' +
                  '</div>';
                }).join('');
                return '<div class="kair-v3-cron-grid__cell' + (cellItems.length > 0 ? ' kair-v3-cron-grid__cell--has' : '') + '">' + cellHtml + '</div>';
              }).join('') +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function _renderList(items, audits) {
    /* Lista cronológica agrupada por fase (vista complementaria) */
    return '<section class="kair-v3-section-card">' +
      '<header class="kair-v3-section-card__head">' +
        '<h3 class="kair-v3-section-card__title"><i class="bi bi-list-task"></i> Listado cronológico</h3>' +
        KairUI.Badge({ variant: 'info', children: items.length + ' hitos' }) +
      '</header>' +
      '<div class="kair-v3-section-card__body">' +
        (items.length === 0
          ? KairUI.EmptyState({ icon: 'calendar-event', title: 'Sin hitos', description: 'No hay hitos registrados para este año. Crea uno con el botón "Nuevo hito".' })
          : '<div class="kair-v3-stack">' +
            FASES.map(function (fase) {
              var faseItems = items.filter(function (i) { return i.fase === fase.id; });
              if (faseItems.length === 0) return '';
              return '<div class="kair-v3-stack kair-v3-stack--sm">' +
                '<div class="kair-v3-row">' +
                  '<span class="kair-v3-badge kair-v3-badge--soft-primary" style="background:' + fase.bg + ';color:' + fase.color + ';">' + fase.label + '</span>' +
                  '<span style="font-size:0.8125rem;color:var(--v3-muted-foreground);">' + faseItems.length + ' hitos</span>' +
                '</div>' +
                faseItems.sort(function (a, b) { return a.mes - b.mes; }).map(function (i) {
                  return '<div class="kair-v3-cron-list-item" data-edit-hito="' + _esc(i.id) + '" data-audit-id="' + _esc(i.auditId) + '">' +
                    '<div class="kair-v3-cron-list-item__mes" style="background:' + fase.color + ';">' + _shortMonth(i.mes) + '</div>' +
                    '<div class="kair-v3-cron-list-item__body">' +
                      '<div class="kair-v3-cron-list-item__title">' + _esc(i.auditProcess || '—') + '</div>' +
                      '<div class="kair-v3-cron-list-item__sub">' + _esc(i.auditCode || '—') + (i.observaciones ? ' · ' + _esc(i.observaciones) : '') + '</div>' +
                    '</div>' +
                    KairUI.Badge({ variant: KairHelpers.cronogramaItemStatusBadge[i.estado] || 'neutral', dot: true, children: KairHelpers.cronogramaItemStatusLabel[i.estado] || i.estado }) +
                    '<div class="kair-v3-row">' +
                      KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'pencil', dataAttrs: { 'edit-hito': i.id, 'edit-audit': i.auditId }, title: 'Editar hito' }) +
                      KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'trash', dataAttrs: { 'remove-hito': i.id }, title: 'Eliminar hito' }) +
                    '</div>' +
                  '</div>';
                }).join('') +
              '</div>';
            }).join('') +
          '</div>') +
      '</div>' +
    '</section>';
  }

  function _renderEditingDialog(editing, year) {
    if (!editing) return '';
    var isNew = editing.isNew;
    var i = editing.item || { fase: 'preparacion', mes: 1, anio: year, estado: 'pendiente' };
    var auditOptions = KairStore.selectAudits().map(function (a) {
      return '<option value="' + _esc(a.id) + '"' + (editing.auditId === a.id ? ' selected' : '') + '>' + _esc(a.code + ' · ' + (a.process || '').substring(0, 40)) + '</option>';
    }).join('');
    var faseOptions = FASES.map(function (f) {
      return '<option value="' + f.id + '"' + (i.fase === f.id ? ' selected' : '') + '>' + _esc(f.label) + '</option>';
    }).join('');
    var mesOptions = KairHelpers.MONTHS_ES.map(function (m, idx) {
      return '<option value="' + (idx + 1) + '"' + (i.mes === (idx + 1) ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
    var estadoOptions = ['pendiente', 'en_curso', 'completado', 'vencido'].map(function (e) {
      return '<option value="' + e + '"' + (i.estado === e ? ' selected' : '') + '>' + _esc(KairHelpers.cronogramaItemStatusLabel[e] || e) + '</option>';
    }).join('');

    return '<div class="kair-v3-dialog-overlay kair-v3-dialog-overlay--open" id="kair-v3-hito-dialog">' +
      '<div class="kair-v3-dialog" style="max-width:520px;">' +
        '<div class="kair-v3-dialog__header">' +
          '<div>' +
            '<h3 class="kair-v3-dialog__title"><i class="bi bi-calendar-plus"></i> ' + (isNew ? 'Nuevo hito' : 'Editar hito') + '</h3>' +
            '<p class="kair-v3-dialog__description">' + (isNew ? 'Programa un nuevo hito en el cronograma anual.' : 'Modifica el hito del cronograma.') + '</p>' +
          '</div>' +
          '<button class="kair-v3-dialog__close" data-dialog-close aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="kair-v3-dialog__body">' +
          '<div class="kair-v3-stack">' +
            (isNew
              ? '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Auditoría *</span><select class="kair-v3-select" id="kair-v3-hito-audit">' + auditOptions + '</select></label>'
              : '<input type="hidden" id="kair-v3-hito-audit" value="' + _esc(editing.auditId) + '">' +
                '<div class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Auditoría</span><div style="font-weight:600;">' + _esc(i.auditCode || '') + ' · ' + _esc((i.auditProcess || '').substring(0, 60)) + '</div></div>'
            ) +
            '<div class="kair-v3-form-grid-2">' +
              '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Fase *</span><select class="kair-v3-select" id="kair-v3-hito-fase">' + faseOptions + '</select></label>' +
              '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Mes *</span><select class="kair-v3-select" id="kair-v3-hito-mes">' + mesOptions + '</select></label>' +
            '</div>' +
            '<div class="kair-v3-form-grid-2">' +
              '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Año *</span><input type="number" class="kair-v3-input" id="kair-v3-hito-anio" value="' + (i.anio || year) + '" min="2020" max="2099"></label>' +
              '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Estado</span><select class="kair-v3-select" id="kair-v3-hito-estado">' + estadoOptions + '</select></label>' +
            '</div>' +
            '<label class="kair-v3-stack kair-v3-stack--sm"><span class="kair-v3-field__label">Observaciones</span><textarea class="kair-v3-textarea" id="kair-v3-hito-obs" rows="2" placeholder="Detalles del hito, responsable, etc.">' + _esc(i.observaciones || '') + '</textarea></label>' +
          '</div>' +
        '</div>' +
        '<div class="kair-v3-dialog__footer">' +
          KairUI.Button({ variant: 'ghost', label: 'Cancelar', dataAttrs: { 'dialog-close': '1' } }) +
          KairUI.Button({ variant: 'primary', icon: 'check-lg', label: 'Guardar hito', dataAttrs: { 'save-hito': '1', 'hito-id': i.id || '', 'is-new': isNew ? '1' : '' } }) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render(container) {
    var audits = KairStore.selectAudits();
    var years = (function () {
      var ys = new Set();
      audits.forEach(function (a) { (a.cronograma || []).forEach(function (c) { ys.add(c.anio); }); });
      ys.add(new Date().getFullYear());
      return Array.from(ys).sort(function (a, b) { return b - a; });
    })();
    var items = _getAllItems(audits, _state.year);
    var filtered = _state.faseFilter === 'todas' ? items : items.filter(function (i) { return i.fase === _state.faseFilter; });
    var kpis = KairStore.computeKpisCronograma(_state.year);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader(_state.year, years) +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpis) +
          '<div class="kair-v3-tabs" style="border-top:none;border-bottom:none;background:transparent;padding:0;margin-bottom:0;">' +
            '<button type="button" class="kair-v3-tab' + (_state.faseFilter === 'todas' ? ' kair-v3-tab--active' : '') + '" data-set-fase="todas"><i class="bi bi-grid-3x3-gap"></i> Todas <span class="kair-v3-tab__badge">' + items.length + '</span></button>' +
            FASES.map(function (f) {
              var count = items.filter(function (i) { return i.fase === f.id; }).length;
              var active = _state.faseFilter === f.id;
              return '<button type="button" class="kair-v3-tab' + (active ? ' kair-v3-tab--active' : '') + '" data-set-fase="' + f.id + '" style="' + (active ? 'border-bottom-color:' + f.color + ';' : '') + '">' +
                '<i class="bi bi-circle-fill" style="color:' + f.color + ';font-size:0.5rem;"></i> ' + f.short + ' <span class="kair-v3-tab__badge">' + count + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          _renderCalendar(filtered, audits) +
          _renderList(filtered, audits) +
        '</main>' +
      '</div>' +
      _renderEditingDialog(_state.editing, _state.year);

    _bindEvents(container, audits);
  }

  function _openEditDialog(auditId, item) {
    _state.editing = { auditId: auditId, item: item, isNew: !item };
    render(_currentContainer || document.querySelector('.kair-v3-module, .kair-aud-module') || document.body);
  }

  function _closeDialog() {
    _state.editing = null;
    render(_currentContainer || document.body);
  }

  var _currentContainer = null;

  function _bindEvents(container, audits) {
    _currentContainer = container;

    /* Volver al Hub */
    var backBtn = document.getElementById('kair-v3-cron-back');
    if (backBtn) backBtn.addEventListener('click', function () {
      KairStore.actions.goHub();
      if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
        window.kairAuditoriaAnual._refreshView();
      }
    });

    /* Cambio de año */
    var yearEl = document.getElementById('kair-v3-cron-year');
    if (yearEl) yearEl.addEventListener('change', function (e) {
      _state.year = parseInt(e.target.value, 10);
      render(container);
    });

    /* Filtros de fase (tabs) */
    container.querySelectorAll('[data-set-fase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _state.faseFilter = btn.getAttribute('data-set-fase');
        render(container);
      });
    });

    /* Nuevo hito */
    var newBtn = document.getElementById('kair-v3-cron-new');
    if (newBtn) newBtn.addEventListener('click', function () {
      _openEditDialog(null, null);
    });

    /* Editar hito (desde celda o item de lista) */
    container.querySelectorAll('[data-edit-hito]').forEach(function (el) {
      el.addEventListener('click', function () {
        var hId = el.getAttribute('data-edit-hito');
        var auditId = el.getAttribute('data-audit-id');
        var item = null;
        if (hId && hId !== '') {
          var a = audits.find(function (x) { return x.id === auditId; });
          if (a) item = (a.cronograma || []).find(function (c) { return c.id === hId; });
        }
        _openEditDialog(auditId, item);
      });
    });

    /* Eliminar hito */
    container.querySelectorAll('[data-remove-hito]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var hId = btn.getAttribute('data-remove-hito');
        if (window.Sileo) {
          Sileo.confirm({
            title: '¿Eliminar hito?',
            description: 'Esta acción no se puede deshacer.',
            confirmText: 'Eliminar', danger: true
          }).then(function (ok) {
            if (ok) {
              KairStore.actions.removeCronogramaItem(hId);
              if (window.Sileo) Sileo.success({ title: 'Hito eliminado' });
              if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
                window.kairAuditoriaAnual._refreshView();
              }
            }
          });
        }
      });
    });

    /* Dialog */
    var dialog = document.getElementById('kair-v3-hito-dialog');
    if (dialog) {
      dialog.addEventListener('click', function (e) {
        if (e.target.closest('[data-dialog-close]') || e.target === dialog) {
          _closeDialog();
        }
        if (e.target.closest('[data-save-hito]')) {
          _saveHitoFromDialog(container);
        }
      });
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape' && _state.editing) {
          _closeDialog();
          document.removeEventListener('keydown', escHandler);
        }
      });
    }
  }

  function _saveHitoFromDialog(container) {
    var auditEl = document.getElementById('kair-v3-hito-audit');
    var faseEl = document.getElementById('kair-v3-hito-fase');
    var mesEl = document.getElementById('kair-v3-hito-mes');
    var anioEl = document.getElementById('kair-v3-hito-anio');
    var estadoEl = document.getElementById('kair-v3-hito-estado');
    var obsEl = document.getElementById('kair-v3-hito-obs');
    if (!auditEl || !faseEl || !mesEl || !anioEl) return;

    var auditId = auditEl.value || auditEl.getAttribute('value');
    var fase = faseEl.value;
    var mes = parseInt(mesEl.value, 10);
    var anio = parseInt(anioEl.value, 10);
    var estado = estadoEl ? estadoEl.value : 'pendiente';
    var obs = obsEl ? obsEl.value : '';

    if (!auditId) {
      if (window.Sileo) Sileo.error({ title: 'Selecciona una auditoría' });
      return;
    }

    var saveBtn = document.querySelector('[data-save-hito]');
    var isNew = saveBtn && saveBtn.getAttribute('data-is-new') === '1';
    var hId = saveBtn ? saveBtn.getAttribute('hito-id') : '';

    if (isNew) {
      KairStore.actions.addCronogramaItem({
        id: KairHelpers.genId('CRON'),
        auditId: auditId,
        fase: fase,
        mes: mes,
        anio: anio,
        estado: estado,
        observaciones: obs
      });
      if (window.Sileo) Sileo.success({ title: 'Hito creado' });
    } else {
      KairStore.actions.updateCronogramaItem(hId, {
        fase: fase, mes: mes, anio: anio, estado: estado, observaciones: obs
      });
      if (window.Sileo) Sileo.success({ title: 'Hito actualizado' });
    }

    _state.editing = null;
    if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
      window.kairAuditoriaAnual._refreshView();
    }
  }

  return { render: render };
})();

window.AuditoriaCronogramaView = AuditoriaCronogramaView;
