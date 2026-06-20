/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Hallazgos view (replica HallazgosView.tsx del tar)
   v3.0 · 2026-06-19
   Vista transversal 6.1.4 — todos los hallazgos de todas las auditorías
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaHallazgosView = (function () {
  'use strict';

  var _state = {
    query: '',
    debouncedQuery: '',
    filterTipo: 'all',
    filterCriticidad: 'all',
    filterEstado: 'all',
    filterAudit: 'all',
    expanded: {} // id -> bool
  };
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

  var _onRerender = null;
  function _rerender() { if (typeof _onRerender === 'function') _onRerender(); }

  function _getAll(audits) {
    var all = [];
    audits.forEach(function (a) {
      (a.hallazgos || []).forEach(function (h) {
        all.push(Object.assign({}, h, {
          auditId: a.id,
          auditCode: a.code,
          auditProcess: a.process,
          empresa: a.empresa
        }));
      });
    });
    return all;
  }

  function _filter(items, audits) {
    var q = _state.debouncedQuery.toLowerCase();
    return items.filter(function (h) {
      if (_state.filterTipo !== 'all' && h.tipo !== _state.filterTipo) return false;
      if (_state.filterCriticidad !== 'all' && h.criticidad !== _state.filterCriticidad) return false;
      if (_state.filterEstado !== 'all' && h.estado !== _state.filterEstado) return false;
      if (_state.filterAudit !== 'all' && h.auditId !== _state.filterAudit) return false;
      if (q) {
        var hay = [h.componente, h.descripcion, h.auditCode, h.auditProcess, h.evidencia].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function _renderHeader() {
    return '<header class="kair-v3-hub-header">' +
      '<div class="kair-v3-hub-header__left">' +
        '<button class="k-btn k-btn-ghost k-btn-sm" id="kair-v3-hal-back" style="width:auto;height:32px;padding:0 12px;">' +
          '<i class="bi bi-arrow-left"></i> Hub' +
        '</button>' +
        '<div style="margin-left:0.5rem;">' +
          '<h1 class="kair-v3-hub-header__title">Hallazgos y Planes de Acción</h1>' +
          '<p class="kair-v3-hub-header__subtitle">Seguimiento transversal de no conformidades — Submódulo 6.1.4</p>' +
        '</div>' +
      '</div>' +
      '<div class="kair-v3-hub-header__right">' +
        KairUI.Button({ id: 'kair-v3-hal-export', variant: 'ghost', size: 'sm', icon: 'download', label: 'Exportar CSV' }) +
      '</div>' +
    '</header>';
  }

  function _renderKpis(kpis) {
    var items = [
      { label: 'Total', value: kpis.total, color: 'primary', icon: 'exclamation-triangle' },
      { label: 'Abiertas', value: kpis.abiertas, color: 'danger', icon: 'exclamation-circle' },
      { label: 'En tratamiento', value: kpis.enTratamiento, color: 'warning', icon: 'arrow-repeat' },
      { label: 'Verificadas', value: kpis.verificadas, color: 'info', icon: 'shield-check' },
      { label: 'Cerradas', value: kpis.cerradas, color: 'success', icon: 'check-circle' },
      { label: 'Vencidas', value: kpis.vencidas, color: 'danger', icon: 'alarm' }
    ];
    return '<div class="kair-v3-kpi-strip" style="grid-template-columns:repeat(6,1fr);">' +
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

  function _renderFilters(allItems, audits) {
    var tipos = ['NC', 'OM', 'OE'];
    var crits = ['baja', 'media', 'alta', 'critica'];
    var ests = ['abierta', 'en_tratamiento', 'verificada', 'cerrada', 'vencida'];
    return '<div class="kair-v3-card" style="padding:1rem;">' +
      '<div class="kair-v3-row">' +
        '<div class="kair-v3-input-wrap" style="flex:1;min-width:240px;max-width:420px;">' +
          '<i class="bi bi-search"></i>' +
          '<input class="kair-v3-input" id="kair-v3-hal-search" type="text" placeholder="Buscar por descripción, componente, código..." value="' + _esc(_state.query) + '">' +
        '</div>' +
        '<select class="kair-v3-select" id="kair-v3-hal-tipo" style="width:auto;min-width:140px;">' +
          '<option value="all"' + (_state.filterTipo === 'all' ? ' selected' : '') + '>Todos los tipos</option>' +
          tipos.map(function (t) { return '<option value="' + t + '"' + (_state.filterTipo === t ? ' selected' : '') + '>' + _esc(KairHelpers.hallazgoTipoLabel[t] || t) + '</option>'; }).join('') +
        '</select>' +
        '<select class="kair-v3-select" id="kair-v3-hal-crit" style="width:auto;min-width:140px;">' +
          '<option value="all"' + (_state.filterCriticidad === 'all' ? ' selected' : '') + '>Toda criticidad</option>' +
          crits.map(function (c) { return '<option value="' + c + '"' + (_state.filterCriticidad === c ? ' selected' : '') + '>' + _esc(KairHelpers.hallazgoCriticidadLabel[c] || c) + '</option>'; }).join('') +
        '</select>' +
        '<select class="kair-v3-select" id="kair-v3-hal-estado" style="width:auto;min-width:160px;">' +
          '<option value="all"' + (_state.filterEstado === 'all' ? ' selected' : '') + '>Todos los estados</option>' +
          ests.map(function (e) { return '<option value="' + e + '"' + (_state.filterEstado === e ? ' selected' : '') + '>' + _esc(KairHelpers.hallazgoEstadoLabel[e] || e) + '</option>'; }).join('') +
        '</select>' +
        '<select class="kair-v3-select" id="kair-v3-hal-audit" style="width:auto;min-width:200px;">' +
          '<option value="all"' + (_state.filterAudit === 'all' ? ' selected' : '') + '>Todas las auditorías</option>' +
          audits.map(function (a) { return '<option value="' + _esc(a.id) + '"' + (_state.filterAudit === a.id ? ' selected' : '') + '>' + _esc(a.code + ' · ' + (a.process || '').substring(0, 30)) + '</option>'; }).join('') +
        '</select>' +
        '<div style="margin-left:auto;font-size:0.8125rem;color:var(--v3-muted-foreground);" id="kair-v3-hal-counter"></div>' +
      '</div>' +
    '</div>';
  }

  function _renderList(filtered) {
    if (filtered.length === 0) {
      return KairUI.EmptyState({
        icon: 'inbox',
        title: 'Sin hallazgos que coincidan',
        description: 'Ajusta los filtros para ver más resultados.'
      });
    }

    return '<div class="kair-v3-stack">' +
      filtered.map(function (h) {
        var sevClass = h.criticidad === 'critica' ? 'kair-v3-hallazgo-card--critica' :
                       h.criticidad === 'alta' ? 'kair-v3-hallazgo-card--alta' :
                       h.criticidad === 'media' ? 'kair-v3-hallazgo-card--media' :
                       'kair-v3-hallazgo-card--baja';
        var isOpen = _state.expanded[h.id];
        return '<div class="kair-v3-hallazgo-card ' + sevClass + '">' +
          '<div class="kair-v3-hallazgo-card__head">' +
            '<div class="kair-v3-hallazgo-card__title-block">' +
              '<div class="kair-v3-hallazgo-card__codigo">' + _esc(h.componente || '—') + ' · ' + _esc(h.id) + '</div>' +
              '<h4 class="kair-v3-hallazgo-card__title">' + _esc(KairHelpers.hallazgoTipoLabel[h.tipo] || h.tipo) + '</h4>' +
            '</div>' +
            '<div class="kair-v3-row">' +
              KairUI.Badge({ variant: KairHelpers.hallazgoCriticidadBadge[h.criticidad] || 'neutral', children: KairHelpers.hallazgoCriticidadLabel[h.criticidad] || h.criticidad }) +
              KairUI.Badge({ variant: KairHelpers.hallazgoEstadoBadge[h.estado] || 'neutral', dot: true, children: KairHelpers.hallazgoEstadoLabel[h.estado] || h.estado }) +
            '</div>' +
          '</div>' +
          '<p class="kair-v3-hallazgo-card__desc">' + _esc(h.descripcion) + '</p>' +
          '<div class="kair-v3-hallazgo-card__meta">' +
            '<span><i class="bi bi-folder"></i> ' + _esc(h.auditCode || '—') + ' · ' + _esc((h.auditProcess || '').substring(0, 50)) + '</span>' +
            '<span><i class="bi bi-calendar"></i> Detectado: ' + _esc(_fmtDate(h.fechaDeteccion)) + '</span>' +
            (h.fechaCompromisoCierre ? '<span><i class="bi bi-flag"></i> Compromiso: ' + _esc(_fmtDate(h.fechaCompromisoCierre)) + '</span>' : '') +
            (h.fechaCierreReal ? '<span><i class="bi bi-check-circle"></i> Cerrado: ' + _esc(_fmtDate(h.fechaCierreReal)) + '</span>' : '') +
          '</div>' +
          (isOpen
            ? '<div class="kair-v3-hallazgo-card__expand">' +
                (h.evidencia ? '<div class="kair-v3-hallazgo-card__evidencia"><strong>Evidencia:</strong> ' + _esc(h.evidencia) + '</div>' : '') +
                '<div class="kair-v3-hallazgo-card__actions">' +
                  KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'arrow-right-circle', label: 'Ir a auditoría', dataAttrs: { 'go-audit': h.auditId, 'go-tab': 'hallazgos' } }) +
                  (h.estado !== 'verificada' && h.estado !== 'cerrada'
                    ? KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'shield-check', label: 'Marcar verificado', dataAttrs: { 'set-estado': h.id, 'estado': 'verificada' } })
                    : '') +
                  (h.estado !== 'cerrada'
                    ? KairUI.Button({ size: 'sm', variant: 'success', icon: 'check2-circle', label: 'Cerrar hallazgo', dataAttrs: { 'set-estado': h.id, 'estado': 'cerrada' } })
                    : '') +
                '</div>' +
              '</div>'
            : '<div class="kair-v3-hallazgo-card__actions">' +
                KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'chevron-down', label: 'Ver detalle', dataAttrs: { 'toggle-expand': h.id } }) +
              '</div>') +
        '</div>';
      }).join('') +
    '</div>';
  }

  function render(container) {
    var audits = KairStore.selectAudits();
    var all = _getAll(audits);
    var kpis = KairStore.computeKpisHallazgos();
    var filtered = _filter(all, audits);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader() +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpis) +
          _renderFilters(all, audits) +
          _renderList(filtered) +
        '</main>' +
      '</div>';

    _bindEvents(container, audits);
    _updateCounter(filtered.length, all.length);
  }

  function _updateCounter(f, t) {
    var el = document.getElementById('kair-v3-hal-counter');
    if (el) el.textContent = f + ' de ' + t + ' hallazgos';
  }

  function _bindEvents(container, audits) {
    /* Volver al Hub */
    var backBtn = document.getElementById('kair-v3-hal-back');
    if (backBtn) backBtn.addEventListener('click', function () {
      KairStore.actions.goHub();
      if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
        window.kairAuditoriaAnual._refreshView();
      }
    });

    /* Exportar CSV */
    var exportBtn = document.getElementById('kair-v3-hal-export');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      if (window.Sileo) Sileo.info({ title: 'Exportar CSV', description: 'En la versión enterprise, este botón exporta los hallazgos a CSV.' });
    });

    /* Búsqueda */
    var searchEl = document.getElementById('kair-v3-hal-search');
    if (searchEl) searchEl.addEventListener('input', function (e) { _setQuery(e.target.value); });

    /* Filtros */
    ['tipo', 'crit', 'estado', 'audit'].forEach(function (key) {
      var el = document.getElementById('kair-v3-hal-' + key);
      if (el) el.addEventListener('change', function (e) {
        var prop = 'filter' + (key === 'crit' ? 'Criticidad' : key === 'tipo' ? 'Tipo' : key === 'estado' ? 'Estado' : 'Audit');
        _state[prop] = e.target.value;
        _rerender();
      });
    });

    /* Toggle expand */
    container.querySelectorAll('[data-toggle-expand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle-expand');
        _state.expanded[id] = !_state.expanded[id];
        _rerender();
      });
    });

    /* Cambiar estado */
    container.querySelectorAll('[data-set-estado]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var hId = btn.getAttribute('data-set-estado');
        var estado = btn.getAttribute('data-estado');
        KairStore.actions.updateHallazgoEstado(hId, estado);
        if (window.Sileo) Sileo.success({ title: 'Hallazgo ' + (estado === 'cerrada' ? 'cerrado' : 'verificado') });
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });

    /* Ir a auditoría */
    container.querySelectorAll('[data-go-audit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-go-audit');
        var tab = btn.getAttribute('data-go-tab') || 'hallazgos';
        KairStore.actions.goEditor(id, tab);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });
  }

  function setRerenderCallback(fn) { _onRerender = fn; }
  function destroy() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _state.expanded = {};
  }

  return { render: render, destroy: destroy, setRerenderCallback: setRerenderCallback };
})();

window.AuditoriaHallazgosView = AuditoriaHallazgosView;
