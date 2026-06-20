/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Informes view (replica InformesView.tsx del tar)
   v3.0 · 2026-06-19
   Vista de informes + firmas — sin @mdxeditor, usa textarea con preview básico
   ═══════════════════════════════════════════════════════════════════ */

var AuditoriaInformesView = (function () {
  'use strict';

  var INFORME_ESTADOS = {
    firmado: { label: 'Firmado y entregado', badge: 'success' },
    pendiente_firma: { label: 'Pendiente de firma', badge: 'warning' },
    borrador: { label: 'Borrador en edición', badge: 'info' },
    no_disponible: { label: 'No disponible', badge: 'neutral' }
  };

  var _state = {
    query: '',
    debouncedQuery: '',
    filterEstado: 'all',
    yearFilter: 'all',
    expanded: {},
    editing: null  // {auditId, contenido}
  };
  var _debounceTimer = null;

  function _esc(s) { return KairUI.esc(s); }
  function _fmtDate(iso) { return KairHelpers.formatDate(iso); }
  function _fmtDateTime(iso) { return KairHelpers.formatDateTime(iso); }

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

  function _calcEstado(audit) {
    if (audit.status === 'cancelada') return 'no_disponible';
    if (audit.status === 'programada') return 'no_disponible';
    if (audit.status === 'vencida') return 'no_disponible';
    if (audit.status === 'en_curso') return 'borrador';
    if (audit.status === 'realizada') {
      var todasFirmadas = (audit.firmas || []).length > 0 && audit.firmas.every(function (f) { return f.firmado; });
      return todasFirmadas ? 'firmado' : 'pendiente_firma';
    }
    return 'no_disponible';
  }

  function _renderHeader() {
    /* F16 (2026-06-20): Header estándar K+AIR · mismo patrón que HUB y 6.1.3 */
    var company = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.nombre) || 'Empresa';
    return '<header class="k-module-header">' +
      '<div class="k-header-left">' +
        '<div class="k-header-title-group">' +
          '<div class="k-header-main-title">' +
            '<i class="bi bi-file-earmark-bar-graph"></i> ' +
            'Informes y Firmas' +
          '</div>' +
          '<div class="k-header-breadcrumb">' +
            '<span>' + _esc(company) + '</span>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-back-module="1">Verificación</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<button type="button" data-go-hub="1">6.1.2 Auditoría Anual</button>' +
            '<i class="bi bi-chevron-right"></i>' +
            '<span class="k-breadcrumb-item active">Informes</span>' +
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
        '<button type="button" class="k-btn k-btn-ghost k-btn-sm" data-action="export-list" title="Exportar lista a CSV">' +
          '<i class="bi bi-download"></i> Exportar lista' +
        '</button>' +
      '</div>' +
    '</header>';
  }

  function _renderKpis(kpis) {
    var items = [
      { label: 'Total', value: kpis.total, color: 'primary', icon: 'file-earmark-text' },
      { label: 'Borradores', value: kpis.borradores, color: 'info', icon: 'pencil-square' },
      { label: 'Pendientes firma', value: kpis.pendientesFirma, color: 'warning', icon: 'clock-history' },
      { label: 'Firmados', value: kpis.firmados, color: 'success', icon: 'check-circle-fill' }
    ];
    return '<div class="kair-v3-kpi-strip" style="grid-template-columns:repeat(4,1fr);">' +
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
    var years = Array.from(new Set(audits.map(function (a) { return a.year; }))).sort(function (a, b) { return b - a; });
    return '<div class="kair-v3-card" style="padding:1rem;">' +
      '<div class="kair-v3-row">' +
        '<div class="kair-v3-input-wrap" style="flex:1;min-width:240px;max-width:420px;">' +
          '<i class="bi bi-search"></i>' +
          '<input class="kair-v3-input" id="kair-v3-inf-search" type="text" placeholder="Buscar por código o proceso..." value="' + _esc(_state.query) + '">' +
        '</div>' +
        '<select class="kair-v3-select" id="kair-v3-inf-estado" style="width:auto;min-width:200px;">' +
          '<option value="all"' + (_state.filterEstado === 'all' ? ' selected' : '') + '>Todos los estados</option>' +
          Object.keys(INFORME_ESTADOS).map(function (k) {
            return '<option value="' + k + '"' + (_state.filterEstado === k ? ' selected' : '') + '>' + INFORME_ESTADOS[k].label + '</option>';
          }).join('') +
        '</select>' +
        '<select class="kair-v3-select" id="kair-v3-inf-year" style="width:auto;min-width:140px;">' +
          '<option value="all"' + (_state.yearFilter === 'all' ? ' selected' : '') + '>Todos los años</option>' +
          years.map(function (y) { return '<option value="' + y + '"' + (_state.yearFilter === String(y) ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
        '</select>' +
        '<div style="margin-left:auto;font-size:0.8125rem;color:var(--v3-muted-foreground);" id="kair-v3-inf-counter"></div>' +
      '</div>' +
    '</div>';
  }

  function _filter(audits) {
    var q = _state.debouncedQuery.toLowerCase();
    return audits.filter(function (a) {
      var est = _calcEstado(a);
      if (_state.filterEstado !== 'all' && est !== _state.filterEstado) return false;
      if (_state.yearFilter !== 'all' && String(a.year) !== _state.yearFilter) return false;
      if (q) {
        var hay = [a.code, a.process, a.empresa, a.auditorLider].join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return est !== 'no_disponible' || _state.filterEstado === 'no_disponible' || _state.filterEstado === 'all';
    });
  }

  function _generateInformeContent(audit) {
    var h = (audit.hallazgos || []).length;
    var pa = (audit.planAccion || []).length;
    var hCerr = (audit.hallazgos || []).filter(function (x) { return x.estado === 'cerrada'; }).length;
    return [
      '# INFORME DE AUDITORÍA INTERNA — ' + audit.code,
      '',
      '**Empresa:** ' + (audit.empresa || '—'),
      '**NIT:** ' + (audit.nit || '—'),
      '**Proceso auditado:** ' + (audit.process || '—'),
      '**Tipo:** ' + (KairHelpers.auditTypeLabel[audit.auditType] || audit.auditType),
      '**Año:** ' + audit.year,
      '**Auditor líder:** ' + (audit.auditorLider || '—'),
      '**Fecha programada:** ' + _fmtDate(audit.fechaProgramada),
      audit.fechaEntrega ? '**Fecha de entrega:** ' + _fmtDate(audit.fechaEntrega) : '',
      '',
      '## 1. Objetivo',
      audit.objective || '—',
      '',
      '## 2. Alcance',
      audit.alcance || '—',
      '',
      '## 3. Criterio de cumplimiento',
      audit.criterio || '—',
      '',
      '## 4. Metodología',
      audit.metodologia || '—',
      '',
      '## 5. Resumen de hallazgos',
      'Se identificaron **' + h + ' hallazgos** durante la auditoría, de los cuales **' + hCerr + ' están cerrados**.',
      '',
      '## 6. Plan de acción',
      'El plan de acción derivado contiene **' + pa + ' items** con responsable, fecha de compromiso y evidencia.',
      '',
      '## 7. Conclusiones y recomendaciones',
      '— Complete con las conclusiones del equipo auditor —',
      '',
      '## 8. Firmas',
      '| Rol | Nombre | Cargo | Fecha |',
      '|---|---|---|---|',
      '| Auditor líder | ' + (audit.auditorLider || '—') + ' | Auditor | ' + _fmtDate(new Date().toISOString()) + ' |',
      '| Responsable SG-SST | ' + (audit.encargadoSgsst || '—') + ' | SG-SST | ___ |',
      '| Gerente | ' + (audit.gerente || '—') + ' | Gerencia | ___ |',
      ''
    ].filter(Boolean).join('\n');
  }

  function _renderInformeCard(audit) {
    var est = _calcEstado(audit);
    var meta = INFORME_ESTADOS[est];
    var isOpen = _state.expanded[audit.id];

    var firmasHtml = (audit.firmas || []).map(function (f, idx) {
      return '<tr>' +
        '<td>' + _esc(f.rol || '—') + '</td>' +
        '<td>' + _esc(f.nombre || '—') + '</td>' +
        '<td>' + _esc(f.cargo || '—') + '</td>' +
        '<td>' + (f.firmado ? '<span style="color:var(--v3-success);font-weight:600;"><i class="bi bi-check-circle-fill"></i> ' + _esc(_fmtDate(f.fecha)) + '</span>' : '<span style="color:var(--v3-muted-foreground);">— Pendiente —</span>') + '</td>' +
        '<td style="text-align:right;">' +
          KairUI.Button({
            size: 'sm', variant: f.firmado ? 'ghost' : 'success',
            icon: f.firmado ? 'x-circle' : 'check2-circle',
            label: f.firmado ? 'Revocar' : 'Firmar',
            dataAttrs: { 'toggle-firma': f.id, 'firma-idx': idx }
          }) +
        '</td>' +
      '</tr>';
    }).join('');

    if ((audit.firmas || []).length === 0) {
      firmasHtml = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--v3-muted-foreground);">Sin firmas registradas. Agregue firmas con el botón inferior.</td></tr>';
    }

    return '<div class="kair-v3-informe-card" data-estado="' + est + '">' +
      '<div class="kair-v3-informe-card__head">' +
        '<div class="kair-v3-row">' +
          '<div class="kair-v3-informe-card__icon"><i class="bi bi-file-earmark-text"></i></div>' +
          '<div>' +
            '<h3 class="kair-v3-informe-card__title">' + _esc(audit.code) + '</h3>' +
            '<p class="kair-v3-informe-card__sub">' + _esc((audit.process || '').substring(0, 60)) + '</p>' +
          '</div>' +
        '</div>' +
        KairUI.Badge({ variant: meta.badge, dot: true, children: meta.label }) +
      '</div>' +
      '<div class="kair-v3-informe-card__meta">' +
        '<span><i class="bi bi-building"></i> ' + _esc(audit.empresa || '—') + '</span>' +
        '<span><i class="bi bi-person"></i> ' + _esc(audit.auditorLider || '—') + '</span>' +
        '<span><i class="bi bi-calendar"></i> ' + _esc(_fmtDate(audit.fechaProgramada)) + '</span>' +
        '<span><i class="bi bi-clipboard-check"></i> ' + (audit.hallazgos || []).length + ' hallazgos</span>' +
      '</div>' +
      (isOpen
        ? '<div class="kair-v3-informe-card__expand">' +
            '<div class="kair-v3-section-card" style="margin-bottom:1rem;">' +
              '<header class="kair-v3-section-card__head">' +
                '<h3 class="kair-v3-section-card__title"><i class="bi bi-pencil"></i> Contenido del informe</h3>' +
                KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'pencil-square', label: 'Editar', dataAttrs: { 'edit-informe': audit.id } }) +
              '</header>' +
              '<div class="kair-v3-section-card__body">' +
                '<pre class="kair-v3-informe-content" id="kair-v3-inf-content-' + audit.id + '">' + _esc(_generateInformeContent(audit)) + '</pre>' +
              '</div>' +
            '</div>' +
            '<div class="kair-v3-section-card">' +
              '<header class="kair-v3-section-card__head">' +
                '<h3 class="kair-v3-section-card__title"><i class="bi bi-vector-pen"></i> Registro de firmas</h3>' +
                KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'plus-lg', label: 'Agregar firma', dataAttrs: { 'add-firma': audit.id } }) +
              '</header>' +
              '<div class="kair-v3-section-card__body" style="padding:0;">' +
                '<div class="kair-v3-table-card">' +
                  '<table class="kair-v3-table">' +
                    '<thead><tr><th>Rol</th><th>Nombre</th><th>Cargo</th><th>Fecha</th><th style="text-align:right;">Acción</th></tr></thead>' +
                    '<tbody>' + firmasHtml + '</tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="kair-v3-informe-card__actions">' +
              KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'download', label: 'Descargar DOCX', dataAttrs: { 'download-informe': audit.id } }) +
              KairUI.Button({ size: 'sm', variant: 'ghost', icon: 'printer', label: 'Imprimir', dataAttrs: { 'print-informe': audit.id } }) +
            '</div>' +
          '</div>'
        : '<div class="kair-v3-informe-card__actions">' +
            KairUI.Button({ size: 'sm', variant: 'secondary', icon: 'chevron-down', label: 'Ver informe y firmas', dataAttrs: { 'toggle-expand': audit.id } }) +
          '</div>') +
    '</div>';
  }

  function _renderEditorDialog(editing, audits) {
    if (!editing) return '';
    var audit = audits.find(function (a) { return a.id === editing.auditId; });
    if (!audit) return '';

    return '<div class="kair-v3-dialog-overlay kair-v3-dialog-overlay--open" id="kair-v3-inf-editor">' +
      '<div class="kair-v3-dialog" style="max-width:720px;">' +
        '<div class="kair-v3-dialog__header">' +
          '<div>' +
            '<h3 class="kair-v3-dialog__title"><i class="bi bi-file-earmark-text"></i> Editar informe — ' + _esc(audit.code) + '</h3>' +
            '<p class="kair-v3-dialog__description">Markdown simple. Use # para títulos, **negrita**, etc.</p>' +
          '</div>' +
          '<button class="kair-v3-dialog__close" data-dialog-close aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="kair-v3-dialog__body">' +
          KairUI.Textarea({
            id: 'kair-v3-inf-content-input',
            rows: 18,
            placeholder: 'Contenido del informe en markdown...',
            value: _generateInformeContent(audit)
          }) +
        '</div>' +
        '<div class="kair-v3-dialog__footer">' +
          KairUI.Button({ variant: 'ghost', label: 'Cancelar', dataAttrs: { 'dialog-close': '1' } }) +
          KairUI.Button({ variant: 'primary', icon: 'save', label: 'Guardar borrador', dataAttrs: { 'save-informe': audit.id } }) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function _renderAddFirmaDialog(editing, audits) {
    if (!editing) return '';
    var audit = audits.find(function (a) { return a.id === editing.auditId; });
    if (!audit) return '';

    return '<div class="kair-v3-dialog-overlay kair-v3-dialog-overlay--open" id="kair-v3-inf-firma-dialog">' +
      '<div class="kair-v3-dialog" style="max-width:480px;">' +
        '<div class="kair-v3-dialog__header">' +
          '<div>' +
            '<h3 class="kair-v3-dialog__title"><i class="bi bi-vector-pen"></i> Agregar firma</h3>' +
            '<p class="kair-v3-dialog__description">Registra una nueva firma para ' + _esc(audit.code) + '</p>' +
          '</div>' +
          '<button class="kair-v3-dialog__close" data-dialog-close aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<div class="kair-v3-dialog__body">' +
          '<div class="kair-v3-stack">' +
            KairUI.Select({
              id: 'kair-v3-firma-rol',
              placeholder: 'Seleccionar rol',
              options: [
                { value: 'auditor', label: 'Auditor líder' },
                { value: 'responsable_sgsst', label: 'Responsable SG-SST' },
                { value: 'gerente', label: 'Gerente' }
              ]
            }) +
            KairUI.Input({ id: 'kair-v3-firma-nombre', placeholder: 'Nombre completo', hint: 'Nombre de quien firma' }) +
            KairUI.Input({ id: 'kair-v3-firma-cargo', placeholder: 'Cargo' }) +
          '</div>' +
        '</div>' +
        '<div class="kair-v3-dialog__footer">' +
          KairUI.Button({ variant: 'ghost', label: 'Cancelar', dataAttrs: { 'dialog-close': '1' } }) +
          KairUI.Button({ variant: 'primary', icon: 'check-lg', label: 'Registrar firma', dataAttrs: { 'save-firma': audit.id } }) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function render(container) {
    var audits = KairStore.selectAudits();
    var kpis = KairStore.computeKpisInformes();
    var filtered = _filter(audits);

    container.innerHTML =
      '<div class="kair-v3-hub">' +
        _renderHeader() +
        '<main class="kair-v3-hub-main">' +
          _renderKpis(kpis) +
          _renderFilters(audits) +
          (filtered.length === 0
            ? KairUI.EmptyState({ icon: 'file-earmark-text', title: 'Sin informes', description: 'No hay auditorías con informes disponibles. Las auditorías en curso o realizadas generan informes aquí.' })
            : '<div class="kair-v3-stack">' + filtered.map(function (a) { return _renderInformeCard(a); }).join('') + '</div>') +
        '</main>' +
      '</div>' +
      _renderEditorDialog(_state.editing, audits) +
      _renderAddFirmaDialog(_state.firmaDialog, audits);

    _bindEvents(container, audits);
    _updateCounter(filtered.length, audits.length);
  }

  function _updateCounter(f, t) {
    var el = document.getElementById('kair-v3-inf-counter');
    if (el) el.textContent = f + ' de ' + t + ' auditorías';
  }

  function _bindEvents(container, audits) {
    /* F16: Volver al Hub (data-go-hub) */
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

    var searchEl = document.getElementById('kair-v3-inf-search');
    if (searchEl) searchEl.addEventListener('input', function (e) { _setQuery(e.target.value); });

    var estadoEl = document.getElementById('kair-v3-inf-estado');
    if (estadoEl) estadoEl.addEventListener('change', function (e) {
      _state.filterEstado = e.target.value;
      _rerender();
    });

    var yearEl = document.getElementById('kair-v3-inf-year');
    if (yearEl) yearEl.addEventListener('change', function (e) {
      _state.yearFilter = e.target.value;
      _rerender();
    });

    /* Toggle expand */
    container.querySelectorAll('[data-toggle-expand]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-toggle-expand');
        _state.expanded[id] = !_state.expanded[id];
        _rerender();
      });
    });

    /* Editar informe */
    container.querySelectorAll('[data-edit-informe]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        _state.editing = { auditId: btn.getAttribute('data-edit-informe') };
        _rerender();
      });
    });

    /* Agregar firma */
    container.querySelectorAll('[data-add-firma]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        _state.firmaDialog = { auditId: btn.getAttribute('data-add-firma') };
        _rerender();
      });
    });

    /* Toggle firma */
    container.querySelectorAll('[data-toggle-firma]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var fId = btn.getAttribute('data-toggle-firma');
        KairStore.actions.toggleFirma(fId);
        if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
          window.kairAuditoriaAnual._refreshView();
        }
      });
    });

    /* Download / Print (placeholders) */
    container.querySelectorAll('[data-download-informe], [data-print-informe]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.Sileo) Sileo.info({ title: 'Función no disponible', description: 'En la versión enterprise, este botón exporta/imprime el informe.' });
      });
    });

    /* Dialogs */
    var editorDlg = document.getElementById('kair-v3-inf-editor');
    if (editorDlg) {
      editorDlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-dialog-close]') || e.target === editorDlg) {
          _state.editing = null;
          _rerender();
        }
        if (e.target.closest('[data-save-informe]')) {
          if (window.Sileo) Sileo.success({ title: 'Informe guardado', description: 'Borrador del informe actualizado' });
          _state.editing = null;
          if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
            window.kairAuditoriaAnual._refreshView();
          }
        }
      });
    }

    var firmaDlg = document.getElementById('kair-v3-inf-firma-dialog');
    if (firmaDlg) {
      firmaDlg.addEventListener('click', function (e) {
        if (e.target.closest('[data-dialog-close]') || e.target === firmaDlg) {
          _state.firmaDialog = null;
          _rerender();
        }
        if (e.target.closest('[data-save-firma]')) {
          var auditId = e.target.closest('[data-save-firma]').getAttribute('data-save-firma');
          var rol = document.getElementById('kair-v3-firma-rol');
          var nombre = document.getElementById('kair-v3-firma-nombre');
          var cargo = document.getElementById('kair-v3-firma-cargo');
          if (!rol || !rol.value) {
            if (window.Sileo) Sileo.error({ title: 'Selecciona un rol' });
            return;
          }
          if (!nombre || !nombre.value.trim()) {
            if (window.Sileo) Sileo.error({ title: 'Ingresa el nombre' });
            return;
          }
          KairStore.actions.addFirma(auditId, {
            id: KairHelpers.genId('FIRMA'),
            auditId: auditId,
            rol: rol.value,
            nombre: nombre.value.trim(),
            cargo: (cargo && cargo.value.trim()) || '—',
            fecha: new Date().toISOString().slice(0, 10),
            firmado: false
          });
          if (window.Sileo) Sileo.success({ title: 'Firma registrada' });
          _state.firmaDialog = null;
          if (window.kairAuditoriaAnual && window.kairAuditoriaAnual._refreshView) {
            window.kairAuditoriaAnual._refreshView();
          }
        }
      });
    }
  }

  function setRerenderCallback(fn) { _onRerender = fn; }
  function destroy() {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _state.expanded = {};
    _state.editing = null;
    _state.firmaDialog = null;
  }

  return { render: render, destroy: destroy, setRerenderCallback: setRerenderCallback };
})();

window.AuditoriaInformesView = AuditoriaInformesView;
