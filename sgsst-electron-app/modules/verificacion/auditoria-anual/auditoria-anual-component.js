/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Submódulo 6.1.2 — Auditoría Anual
   Component Orchestrator — Tabs + KPI Strip + Header
   ═══════════════════════════════════════════════════════════════════ */

var VIEWS_AUD = [
  { key: 'cronograma', label: 'Cronograma', icon: 'bi-calendar3' },
  { key: 'plan',       label: 'Plan de Auditoría', icon: 'bi-file-earmark-text' },
  { key: 'hallazgos',  label: 'Hallazgos', icon: 'bi-exclamation-triangle' },
  { key: 'informe',    label: 'Informe', icon: 'bi-file-earmark-bar-graph' }
];

function AuditoriaAnualComponent(container, currentCompany, moduleName, submoduleTitle, backToModuleCallback) {
  this.container = container;
  this.currentCompany = currentCompany || 'Empresa';
  this.moduleName = moduleName || 'Verificación';
  this.submoduleTitle = submoduleTitle || '6.1.2 Auditoría Anual';
  this.backToModuleCallback = backToModuleCallback;
  this.currentView = 'cronograma';
  this.cssLoaded = false;
}

// ── Load CSS ────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._loadCSS = function (callback) {
  var self = this;
  if (this.cssLoaded) { callback(); return; }

  function loadCss(href, done) {
    var existing = document.querySelector('link[href="' + href + '"]');
    if (existing) { done(); return; }
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = done;
    l.onerror = done;
    document.head.appendChild(l);
  }

  function loadScript(src, done) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) { done(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
  }

  /* Cascada: CSS único + design system + 6 vistas v3 */
  loadCss('modules/verificacion/auditoria-anual/auditoria-anual.css', function () {
    loadScript('modules/verificacion/auditoria-anual/kair-icons.js', function () {
      loadScript('modules/verificacion/auditoria-anual/kair-ui.js', function () {
        loadScript('modules/verificacion/auditoria-anual/kair-types.js', function () {
          loadScript('modules/verificacion/auditoria-anual/kair-helpers.js', function () {
            loadScript('modules/verificacion/auditoria-anual/kair-mock-data.js', function () {
              loadScript('modules/verificacion/auditoria-anual/kair-store.js', function () {
                loadScript('modules/verificacion/auditoria-anual/kair-store-bridge.js', function () {
                  loadScript('modules/verificacion/auditoria-anual/auditoria-hub-view.js', function () {
                    loadScript('modules/verificacion/auditoria-anual/auditoria-list-view.js', function () {
                      loadScript('modules/verificacion/auditoria-anual/auditoria-editor-view.js', function () {
                        loadScript('modules/verificacion/auditoria-anual/auditoria-cronograma-view.js', function () {
                          loadScript('modules/verificacion/auditoria-anual/auditoria-hallazgos-view.js', function () {
                            loadScript('modules/verificacion/auditoria-anual/auditoria-informes-view.js', function () {
                              if (window.KairUI && window.KairStore) {
                                var kpisAud = window.KairStore.computeKpisAuditorias();
                                var kpisHal = window.KairStore.computeKpisHallazgos();
                                console.log('[K+AIRSST][6.1.2][V3] Design system v3 cargado · ' +
                                  Object.keys(window.KairUI).length + ' componentes · ' +
                                  (window.KairIcons ? Object.keys(window.KairIcons).length : 0) + ' iconos · ' +
                                  window.KairStore.getState().audits.length + ' auditorías mock · ' +
                                  'KPIs aud: ' + kpisAud.programadas + 'P ' + kpisAud.enCurso + 'EC ' + kpisAud.realizadas + 'R ' + kpisAud.vencidas + 'V · ' +
                                  'KPIs hal: ' + kpisHal.abiertas + ' abiertas, ' + kpisHal.vencidas + ' vencidas');
                                /* F9 (2026-06-19): hidratar desde el service real (si está disponible) */
                                if (window.KairStoreBridge) {
                                  window.KairStoreBridge.hydrate().then(function () {
                                    var src = window.KairStoreBridge.isUsingService() ? 'service' : 'mock';
                                    console.log('[K+AIRSST][6.1.2][V3] Store hidratado desde ' + src + ' · ' +
                                      window.KairStore.getState().audits.length + ' auditorías finales');
                                    _installBridgePersistence();
                                    self.cssLoaded = true;
                                    callback();
                                  }).catch(function () {
                                    self.cssLoaded = true;
                                    callback();
                                  });
                                } else {
                                  self.cssLoaded = true;
                                  callback();
                                }
                              } else {
                                console.warn('[K+AIRSST][6.1.2][V3] Carga incompleta · KairUI=' + !!window.KairUI + ' KairStore=' + !!window.KairStore);
                                self.cssLoaded = true;
                                callback();
                              }
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
};

/* F9 (2026-06-19): Suscribe al store para persistir mutaciones al service */
/* F10 (2026-06-19): detecta diffs no solo en audits sino también en hallazgos/planAccion/firmas dentro de cada audit */
function _installBridgePersistence() {
  if (!window.KairStore || !window.KairStore.subscribe || !window.KairStoreBridge) return;
  if (window._kairV3PersistenceUnsub) return; // ya instalado
  var prevAuditsJson = JSON.stringify(window.KairStore.getState().audits);
  window._kairV3PersistenceUnsub = window.KairStore.subscribe(function (state) {
    if (!window.KairStoreBridge.isUsingService()) return;
    var cur = JSON.stringify(state.audits);
    if (cur === prevAuditsJson) return;
    /* Detectar diff simple: si la última mutación fue addAudit, persistirla */
    var prev = JSON.parse(prevAuditsJson || '[]');
    prevAuditsJson = cur;
    var curr = state.audits;
    if (curr.length > prev.length) {
      var nueva = curr.find(function (a) { return !prev.find(function (p) { return p.id === a.id; }); });
      if (nueva) window.KairStoreBridge.persist('addAudit', { audit: nueva });
    } else {
      /* F10: diff refinado por audit. Detecta cambios en hallazgos/planAccion/firmas/cronograma
         dentro del mismo audit (mismo id) y persiste el audit completo.
         El service actual solo actualiza campos básicos; el resto se conserva en localStorage. */
      curr.forEach(function (a) {
        var p = prev.find(function (x) { return x.id === a.id; });
        if (!p) return; // ya manejado en addAudit
        var changed =
          p.updatedAt !== a.updatedAt ||
          p.hallazgos.length !== a.hallazgos.length ||
          p.planAccion.length !== a.planAccion.length ||
          p.firmas.length !== a.firmas.length ||
          p.cronograma.length !== a.cronograma.length;
        /* Detectar cambio en estado/severidad de un hallazgo o plan existente */
        if (!changed) {
          for (var i = 0; i < a.hallazgos.length; i++) {
            var h = a.hallazgos[i];
            var ph = p.hallazgos.find(function (x) { return x.id === h.id; });
            if (!ph || ph.estado !== h.estado || ph.criticidad !== h.criticidad) { changed = true; break; }
          }
        }
        if (!changed) {
          for (var j = 0; j < a.planAccion.length; j++) {
            var pi = a.planAccion[j];
            var ppi = p.planAccion.find(function (x) { return x.id === pi.id; });
            if (!ppi || ppi.estado !== pi.estado) { changed = true; break; }
          }
        }
if (changed) window.KairStoreBridge.persist('syncAudit', { audit: a });
      });
    }
  });
}

// ── Escape HTML ─────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._esc = function (str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
};

// ── Render UI ───────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._renderUI = function () {
  var self = this;

  /* F3 (2026-06-19): si la vista activa es 'hub' y el HUB v3 está disponible,
     renderizamos el HUB en lugar del layout de tabs v2. El HUB es la nueva
     pantalla principal (Patrón B Submodule Home, replica HubView del tar).
     F4 (2026-06-19): si la vista es 'list', renderiza la ListView v3. */
  if (window.AuditoriaHubView && window.KairStore) {
    var view = window.KairStore.getState().view;
    if (view === 'hub') {
      window.AuditoriaHubView.render(this.container);
      return;
    }
    if (view === 'list' && window.AuditoriaListView) {
      window.AuditoriaListView.render(this.container);
      return;
    }
    if (view === 'editor' && window.AuditoriaEditorView) {
      window.AuditoriaEditorView.render(this.container);
      return;
    }
    if (view === 'cronograma' && window.AuditoriaCronogramaView) {
      window.AuditoriaCronogramaView.render(this.container);
      return;
    }
    if (view === 'hallazgos' && window.AuditoriaHallazgosView) {
      window.AuditoriaHallazgosView.render(this.container);
      return;
    }
    if (view === 'informes' && window.AuditoriaInformesView) {
      window.AuditoriaInformesView.render(this.container);
      return;
    }
  }

  var stats = AuditoriaService.getKpiStats();

  // Header card (Patrón 6.1.3 — header estándar K+AIR con clases k-*)
  var headerHtml =
    '<header class="k-module-header" id="kair-aud-header-card">' +
      '<div class="k-header-left">' +
        '<button class="k-back-btn" id="kair-aud-back" title="Volver a Verificación">' +
          '<i class="bi bi-arrow-left"></i>' +
        '</button>' +
        '<div class="k-header-title-group">' +
          '<h1 class="k-header-main-title">Auditoría Anual</h1>' +
          '<div class="k-header-breadcrumb">' +
            '<i class="bi bi-clipboard-check"></i> ' +
            'Submódulo 6.1.2 · Programa anual de auditorías SG-SST' +
          '</div>' +
        '</div>' +
        '<span class="k-sync-badge" title="Empresa activa">' +
          '<span class="dot"></span>' +
          '<span id="header-company-text">' + this._esc(this.currentCompany) + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="k-header-right">' +
        '<button class="k-btn k-btn-ghost k-btn-sm" id="kair-aud-hub" title="Volver al Hub principal">' +
          '<i class="bi bi-grid-3x3-gap"></i> Hub' +
        '</button>' +
        '<button class="k-btn k-btn-ghost k-btn-sm" id="kair-aud-import" title="Importar desde archivo Excel">' +
          '<i class="bi bi-upload"></i> Importar' +
        '</button>' +
        '<button class="k-btn k-btn-secondary k-btn-sm" id="kair-aud-export" title="Exportar a archivo Excel">' +
          '<i class="bi bi-download"></i> Exportar XLSX' +
        '</button>' +
      '</div>' +
    '</header>' +
    '<nav class="kair-aud-tabs" id="kair-aud-tabs" role="tablist">';

  // Tabs
  headerHtml += VIEWS_AUD.map(function (v) {
    return '<button class="kair-aud-tab' + (v.key === self.currentView ? ' kair-aud-tab--active' : '') +
      '" data-view="' + v.key + '">' +
      '<i class="bi ' + v.icon + '"></i> ' + v.label +
      '</button>';
  }).join('');

  headerHtml += '</nav>';

  // KPI Strip (tokens semánticos — sin colores hardcoded)
  var calif = stats.calificacionProm || 0;
  var kpis = [
    { key: 'total',        icon: 'bi-clipboard-check',     value: stats.total,           label: 'Total Auditorías',   color: 'primary', sub: 'Programa anual' },
    { key: 'completadas',  icon: 'bi-check-circle',        value: stats.completadas,     label: 'Completadas',         color: 'success', sub: stats.total > 0 ? Math.round(stats.completadas * 100 / stats.total) + '% del total' : '0% del total', subCls: 'success' },
    { key: 'enProgreso',   icon: 'bi-arrow-repeat',        value: stats.enProgreso,      label: 'En Progreso',         color: 'primary', sub: 'En ejecución' },
    { key: 'programadas',  icon: 'bi-calendar-event',      value: stats.programadas,     label: 'Programadas',         color: 'warning', sub: 'Pendientes por iniciar', subCls: 'warning' },
    { key: 'hallazgos',    icon: 'bi-exclamation-triangle',value: stats.totalHallazgos,  label: 'Hallazgos',           color: 'danger',  sub: (stats.hallazgosCriticos || 0) + ' críticos', subCls: 'danger' },
    { key: 'calificacion', icon: 'bi-trophy',              value: calif + '%',           label: 'Calificación Prom.',  color: calif >= 80 ? 'success' : (calif >= 60 ? 'warning' : 'danger'), sub: calif >= 80 ? 'Excelente' : (calif >= 60 ? 'Aceptable' : 'Por mejorar'), subCls: calif >= 80 ? 'success' : (calif >= 60 ? 'warning' : 'danger') }
  ];

  var kpiHtml = kpis.map(function (kpi) {
    return '<div class="kair-aud-kpi" data-kpi="' + kpi.key + '">' +
      '<div class="kair-aud-kpi__icon kair-aud-kpi__icon--' + kpi.color + '">' +
        '<i class="bi ' + kpi.icon + '"></i>' +
      '</div>' +
      '<div class="kair-aud-kpi__content">' +
        '<div class="kair-aud-kpi__value">' + kpi.value + '</div>' +
        '<div class="kair-aud-kpi__label">' + kpi.label + '</div>' +
        (kpi.sub ? '<div class="kair-aud-kpi__sub ' + (kpi.subCls ? 'kair-aud-kpi__sub--' + kpi.subCls : '') + '">' + kpi.sub + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // View containers
  var viewContainers = VIEWS_AUD.map(function (v) {
    return '<div class="kair-aud-view' + (v.key === self.currentView ? ' kair-aud-view--active' : '') + '" id="kair-aud-view-' + v.key + '"></div>';
  }).join('');

  // Assemble
  this.container.innerHTML =
    '<section class="kair-aud-module">' +
      headerHtml +
      '<main class="kair-aud-main">' +
        '<div class="kair-aud-kpi-strip" id="kair-aud-kpi-strip">' + kpiHtml + '</div>' +
        viewContainers +
      '</main>' +
    '</section>';
};

// ── Init Navigation ─────────────────────────────────────────────
AuditoriaAnualComponent.prototype._initNavigation = function () {
  var self = this;
  var wrapper = this.container.querySelector('.kair-aud-module');
  if (!wrapper) return;

  // Back button
  var backBtn = wrapper.querySelector('#kair-aud-back');
  if (backBtn) {
    backBtn.onclick = function () {
      if (typeof self.backToModuleCallback === 'function') self.backToModuleCallback();
    };
  }

  // F4 — Exportar XLSX
  var exportBtn = wrapper.querySelector('#kair-aud-export');
  if (exportBtn) {
    exportBtn.onclick = function () {
      self._exportarXlsx();
    };
  }

  // F3 (2026-06-19): Botón "Hub" del header → navega al HUB v3
  var hubBtn = wrapper.querySelector('#kair-aud-hub');
  if (hubBtn) {
    hubBtn.onclick = function () {
      if (window.KairStore) window.KairStore.actions.goHub();
      self._refreshView();
    };
  }

  // F4 — Importar XLSX
  var importBtn = wrapper.querySelector('#kair-aud-import');
  if (importBtn) {
    importBtn.onclick = function () {
      self._importarXlsx();
    };
  }

  // Tab navigation
  var tabs = wrapper.querySelectorAll('.kair-aud-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var viewKey = tab.getAttribute('data-view');
      if (viewKey) self._navigate(viewKey);
    });
  });
};

// ── Navigate ────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype._navigate = function (viewKey) {
  var self = this;
  this.currentView = viewKey;

  // Update tab active state
  var tabs = this.container.querySelectorAll('.kair-aud-tab');
  tabs.forEach(function (tab) {
    if (tab.getAttribute('data-view') === viewKey) {
      tab.classList.add('kair-aud-tab--active');
    } else {
      tab.classList.remove('kair-aud-tab--active');
    }
  });

  // Show/hide view containers
  VIEWS_AUD.forEach(function (v) {
    var el = document.getElementById('kair-aud-view-' + v.key);
    if (el) el.style.display = v.key === viewKey ? 'flex' : 'none';
  });

  // Load view content
  setTimeout(function () {
    self._loadCurrentView();
  }, 50);
};

// ── Load Current View ───────────────────────────────────────────
AuditoriaAnualComponent.prototype._loadCurrentView = function () {
  var viewKey = this.currentView;
  var container = document.getElementById('kair-aud-view-' + viewKey);
  if (!container) return;

  switch (viewKey) {
    case 'cronograma':
      AuditoriaCronogramaView.load(container);
      break;
    case 'plan':
      AuditoriaPlanView.load(container);
      break;
    case 'hallazgos':
      AuditoriaHallazgosView.load(container);
      break;
    case 'informe':
      AuditoriaInformeView.load(container);
      break;
  }
};

// ── Render ──────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype.render = function () {
  var self = this;
  /* F3: exponer instancia global para que las vistas disparen modales */
  window.__kairAudInstance = self;

  this._loadCSS(function () {
    /* F2 (2026-06-19): Cargar datos reales del backend antes de renderizar.
       cargarTodo() hidrata el cache del service. Si falla, el fallback a mocks
       mantiene la app funcional en modo dev sin Electron.
       F11 (2026-06-20): unificar empresaId con el bridge (KairMockData.ACTIVE_COMPANY.id).
       Antes el componente usaba self.currentCompany ('Tempoactiva' con T mayúscula)
       y el bridge usaba 'tempoactiva' → 2 cargarTodo por carga del módulo con IDs
       distintos y resultados potencialmente diferentes en BD case-sensitive. */
    var empresaId = (window.KairMockData && window.KairMockData.ACTIVE_COMPANY && window.KairMockData.ACTIVE_COMPANY.id)
      || self.currentCompany
      || (window.currentCompany && window.currentCompany.nombre)
      || 'default_company';
    var loadPromise = (typeof AuditoriaService.cargarTodo === 'function')
      ? AuditoriaService.cargarTodo(empresaId)
      : Promise.resolve();

    loadPromise.then(function (loadResp) {
      if (loadResp && loadResp.success) {
        console.log('[AUD-ANUAL] Datos cargados desde: ' + (loadResp.data && loadResp.data.fuente || '?'));
      }
      self._renderUI();
      self._initNavigation();
      self._loadCurrentView();
    }).catch(function (err) {
      console.warn('[AUD-ANUAL] cargarTodo() falló, usando mocks locales:', err && err.message);
      self._renderUI();
      self._initNavigation();
      self._loadCurrentView();
    });
  });
};

// ── Destroy ─────────────────────────────────────────────────────
AuditoriaAnualComponent.prototype.destroy = function () {
  /* F21.14 (2026-06-20): limpieza exhaustiva para evitar overlays/listeners huérfanos
     que bloqueen la interacción con el home del módulo al regresar. */
  try { this.container.innerHTML = ''; } catch (e) { /* noop */ }
  var modal = document.getElementById('kair-aud-modal-auditoria');
  if (modal) modal.remove();
  var modalH = document.getElementById('kair-aud-modal-hallazgo');
  if (modalH) modalH.remove();
  var toast = document.getElementById('kair-aud-toast');
  if (toast) toast.remove();

  /* Limpiar dialog del cronograma si quedó abierto */
  var dialogCron = document.getElementById('kair-v3-hito-dialog');
  if (dialogCron) dialogCron.remove();

  /* Limpiar overlays deprecados o zombies que pudieran estar en body */
  document.querySelectorAll('.kair-v3-dialog-overlay, .kair-aud-modal-overlay, .modal-backdrop').forEach(function (el) {
    try { el.remove(); } catch (e) { /* noop */ }
  });

  /* Resetear estado global del cronograma para forzar recarga limpia en próximo mount */
  if (window.AuditoriaCronogramaView && typeof window.AuditoriaCronogramaView.resetState === 'function') {
    try { window.AuditoriaCronogramaView.resetState(); } catch (e) { /* noop */ }
  }

  /* Llamar destroy de la vista activa si existe */
  if (this.activeView && typeof this.activeView.destroy === 'function') {
    try { this.activeView.destroy(); } catch (e) { /* noop */ }
  }

  /* Forzar reflow para que el navegador limpie eventos pendientes */
  try {
    void this.container.offsetHeight;
  } catch (e) { /* noop */ }
};

/* ═══════════════════════════════════════════════════════════════════════
   F3 (2026-06-19) — CRUD MÍNIMO VIABLE
   Modales para crear/editar/eliminar auditoría y hallazgo.
   Toasts + confirmación inline (sin librería externa).
   ═══════════════════════════════════════════════════════════════════════ */

AuditoriaAnualComponent.prototype._getEmpresaId = function () {
  return this.currentCompany || (window.currentCompany && (window.currentCompany.nombre || window.currentCompany)) || 'default_company';
};

AuditoriaAnualComponent.prototype._escape = function (str) {
  var div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
};

AuditoriaAnualComponent.prototype._ensureToastStack = function () {
  if (document.getElementById('kair-aud-toast-stack')) return;
  var stack = document.createElement('div');
  stack.id = 'kair-aud-toast-stack';
  stack.className = 'kair-aud-toast-stack';
  document.body.appendChild(stack);
};

AuditoriaAnualComponent.prototype._showToast = function (msg, type) {
  if (window.updateNotifier && typeof window.updateNotifier.show === 'function') {
    window.updateNotifier.show({
      type: type || 'info',
      title: type === 'success' ? 'Éxito' : type === 'error' ? 'Error' : type === 'warning' ? 'Atención' : 'Información',
      subtitle: msg || '',
      autoClose: type === 'error' ? 6000 : type === 'warning' ? 4000 : 5000
    });
    return;
  }
  /* Fallback al sistema legacy si updateNotifier no está disponible */
  this._ensureToastStack();
  var stack = document.getElementById('kair-aud-toast-stack');
  var t = (type || 'info').toLowerCase();
  var icons = {
    success: 'check-circle-fill',
    error:   'exclamation-circle-fill',
    warning: 'exclamation-triangle-fill',
    info:    'info-circle-fill'
  };
  var toast = document.createElement('div');
  toast.className = 'kair-aud-toast kair-aud-toast--' + t;
  toast.innerHTML =
    '<i class="bi bi-' + (icons[t] || icons.info) + '"></i>' +
    '<div><div class="kair-aud-toast__title">' + this._escape(t === 'success' ? 'Éxito' : t === 'error' ? 'Error' : t === 'warning' ? 'Atención' : 'Información') + '</div>' +
    '<div class="kair-aud-toast__msg">' + this._escape(msg) + '</div></div>';
  stack.appendChild(toast);
  setTimeout(function () { toast.classList.add('kair-aud-toast--show'); }, 10);
  setTimeout(function () {
    toast.classList.remove('kair-aud-toast--show');
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
  }, 3500);
};

AuditoriaAnualComponent.prototype._showConfirm = function (opts, onConfirm) {
  if (typeof opts === 'string') {
    opts = { message: opts, title: 'Confirmar acción', danger: false };
  }
  var self = this;
  return new Promise(function (resolve) {
    var overlay = document.createElement('div');
    overlay.className = 'kair-aud-confirm-overlay';
    overlay.innerHTML =
      '<div class="kair-aud-confirm-modal" role="dialog" aria-modal="true">' +
        '<div class="kair-aud-confirm-modal__icon' + (opts.danger ? ' kair-aud-confirm-modal__icon--danger' : '') + '">' +
          '<i class="bi bi-' + (opts.danger ? 'exclamation-triangle-fill' : 'question-circle-fill') + '"></i>' +
        '</div>' +
        '<h3 class="kair-aud-confirm-modal__title">' + self._escape(opts.title || 'Confirmar') + '</h3>' +
        '<p class="kair-aud-confirm-modal__msg">' + self._escape(opts.message || '¿Estás seguro?').replace(/\n/g, '<br>') + '</p>' +
        '<div class="kair-aud-confirm-modal__actions">' +
          '<button class="k-btn k-btn-ghost" data-action="cancel">Cancelar</button>' +
          '<button class="k-btn ' + (opts.danger ? 'k-btn-danger' : 'k-btn-primary') + '" data-action="accept">' +
            self._escape(opts.acceptLabel || 'Confirmar') +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    function close(result) {
      overlay.remove();
      if (result && typeof onConfirm === 'function') onConfirm();
      resolve(result);
    }
    overlay.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      close(t.getAttribute('data-action') === 'accept');
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', escHandler); }
    });
  });
};

/* F4 — Exportar XLSX: genera archivo con 3 hojas (Auditorías, Hallazgos, Resumen) */
AuditoriaAnualComponent.prototype._exportarXlsx = function () {
  var self = this;
  var btn = this.container.querySelector('#kair-aud-export');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exportando...'; }
  AuditoriaService.exportarXlsx(this._getEmpresaId()).then(function (resp) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-download"></i> Exportar XLSX'; }
    if (resp && resp.success) {
      self._showToast('Exportado: ' + (resp.data.archivo || 'archivo.xlsx') + ' (' + resp.data.auditorias + ' auditorías, ' + resp.data.hallazgos + ' hallazgos)', 'success');
    } else {
      self._showToast('Error al exportar: ' + ((resp && resp.error && resp.error.message) || 'desconocido'), 'error');
    }
  }).catch(function (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-download"></i> Exportar XLSX'; }
    self._showToast('Error: ' + (err && err.message ? err.message : 'desconocido'), 'error');
  });
};

/* F4 — Importar XLSX: diálogo nativo, lectura, INSERT en BD */
AuditoriaAnualComponent.prototype._importarXlsx = function () {
  var self = this;
  AuditoriaService.seleccionarArchivoImportar().then(function (sel) {
    if (!sel || !sel.success) {
      if (sel && sel.error && sel.error.code !== 'CANCELLED') {
        self._showToast('Error abriendo selector: ' + sel.error.message, 'error');
      }
      return;
    }
    var archivoPath = sel.data.archivoPath;
    var archivoNombre = archivoPath.split(/[\\/]/).pop();
    self._showConfirm({
      title: 'Importar archivo Excel',
      message: '¿Deseas importar el archivo "' + archivoNombre + '"?\n\nLas auditorías y hallazgos se agregarán a la base de datos. Si hay IDs duplicados, se actualizarán los registros existentes.',
      acceptLabel: 'Importar',
      danger: false
    }, function () {
    self._showToast('Importando ' + archivoNombre + '...', 'info');
    AuditoriaService.importarXlsx(self._getEmpresaId(), archivoPath).then(function (resp) {
      if (resp && resp.success) {
        var data = resp.data || {};
        var msg = 'Importación completa: ' + (data.auditorias || 0) + ' auditoría(s), ' + (data.hallazgos || 0) + ' hallazgo(s)';
        if (data.errores && data.errores.length > 0) {
          msg += ' (' + data.errores.length + ' error(es))';
        }
        self._showToast(msg, 'success');
        self._refreshCurrentView();
      } else {
        self._showToast('Error al importar: ' + ((resp && resp.error && resp.error.message) || 'desconocido'), 'error');
      }
    }).catch(function (err) {
      self._showToast('Error: ' + (err && err.message ? err.message : 'desconocido'), 'error');
    });
    }); /* cierre _showConfirm import */
  });
};

/* ── Modal de Auditoría ── */

AuditoriaAnualComponent.prototype._ensureAuditoriaModal = function () {
  if (document.getElementById('kair-aud-modal-auditoria')) return;
  var self = this;
  var modal = document.createElement('div');
  modal.id = 'kair-aud-modal-auditoria';
  modal.className = 'kair-aud-modal';
  modal.innerHTML =
    '<div class="kair-aud-modal__backdrop" data-modal-close></div>' +
    '<div class="kair-aud-modal__panel">' +
      '<div class="kair-aud-modal__head">' +
        '<h3 id="kair-aud-modal-aud-title">Nueva auditoría</h3>' +
        '<button class="kair-aud-modal__close" data-modal-close>&times;</button>' +
      '</div>' +
      '<div class="kair-aud-modal__body">' +
        '<form id="kair-aud-form-auditoria" autocomplete="off">' +
          '<input type="hidden" name="id" />' +
          '<div class="kair-aud-form-row">' +
            '<label>Nombre *<input type="text" name="nombre" required maxlength="120" /></label>' +
            '<label>Tipo *' +
              '<select name="tipo" required>' +
                '<option value="Interna">Interna</option>' +
                '<option value="Especializada">Especializada</option>' +
                '<option value="Externa">Externa</option>' +
              '</select>' +
            '</label>' +
          '</div>' +
          '<label>Alcance<input type="text" name="alcance" maxlength="200" placeholder="Ej: Todos los departamentos, Planta Industrial..." /></label>' +
          '<div class="kair-aud-form-row">' +
            '<label>Fecha inicio *<input type="date" name="fechaInicio" required /></label>' +
            '<label>Fecha fin *<input type="date" name="fechaFin" required /></label>' +
          '</div>' +
          '<div class="kair-aud-form-row">' +
            '<label>Estado *' +
              '<select name="estado" required>' +
                '<option value="programada">Programada</option>' +
                '<option value="en-progreso">En Progreso</option>' +
                '<option value="completada">Completada</option>' +
                '<option value="cancelada">Cancelada</option>' +
              '</select>' +
            '</label>' +
            '<label>Auditor líder<input type="text" name="auditorLider" maxlength="80" /></label>' +
          '</div>' +
          '<div class="kair-aud-form-row">' +
            '<label>Trimestre' +
              '<select name="trimestre">' +
                '<option value="">—</option>' +
                '<option value="Q1">Q1 (Ene-Mar)</option>' +
                '<option value="Q2">Q2 (Abr-Jun)</option>' +
                '<option value="Q3">Q3 (Jul-Sep)</option>' +
                '<option value="Q4">Q4 (Oct-Dic)</option>' +
              '</select>' +
            '</label>' +
            '<label>Calificación (0-100)<input type="number" name="calificacion" min="0" max="100" step="1" /></label>' +
          '</div>' +
          '<label>Equipo (nombres separados por coma)<input type="text" name="equipoTexto" maxlength="300" placeholder="Ej: Carlos Ruiz, Ana Martínez" /></label>' +
          '<div class="kair-aud-modal__error" id="kair-aud-form-aud-error"></div>' +
        '</form>' +
      '</div>' +
      '<div class="kair-aud-modal__foot">' +
        '<button class="kair-aud-btn kair-aud-btn--ghost" data-modal-close>Cancelar</button>' +
        '<button class="kair-aud-btn kair-aud-btn--primary" id="kair-aud-save-auditoria">Guardar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  modal.addEventListener('click', function (e) {
    if (e.target.matches('[data-modal-close]')) self._closeAuditoriaModal();
  });
  document.getElementById('kair-aud-save-auditoria').addEventListener('click', function () {
    self._saveAuditoriaFromForm();
  });
};

AuditoriaAnualComponent.prototype._openAuditoriaForm = function (auditoria) {
  this._ensureAuditoriaModal();
  var modal = document.getElementById('kair-aud-modal-auditoria');
  var form = document.getElementById('kair-aud-form-auditoria');
  var title = document.getElementById('kair-aud-modal-aud-title');
  var errorEl = document.getElementById('kair-aud-form-aud-error');

  form.reset();
  errorEl.textContent = '';

  if (auditoria) {
    title.textContent = 'Editar auditoría · ' + auditoria.id;
    form.id.value = auditoria.id || '';
    form.nombre.value = auditoria.nombre || '';
    form.tipo.value = auditoria.tipo || 'Interna';
    form.alcance.value = auditoria.alcance || '';
    form.fechaInicio.value = auditoria.fechaInicio || '';
    form.fechaFin.value = auditoria.fechaFin || '';
    form.estado.value = auditoria.estado || 'programada';
    form.auditorLider.value = auditoria.auditorLider || '';
    form.trimestre.value = auditoria.trimestre || '';
    form.calificacion.value = (auditoria.calificacion !== null && auditoria.calificacion !== undefined) ? auditoria.calificacion : '';
    form.equipoTexto.value = Array.isArray(auditoria.equipo) ? auditoria.equipo.join(', ') : '';
  } else {
    title.textContent = 'Nueva auditoría';
    form.estado.value = 'programada';
    form.tipo.value = 'Interna';
  }

  modal.classList.add('kair-aud-modal--open');
};

AuditoriaAnualComponent.prototype._closeAuditoriaModal = function () {
  var modal = document.getElementById('kair-aud-modal-auditoria');
  if (modal) modal.classList.remove('kair-aud-modal--open');
};

AuditoriaAnualComponent.prototype._saveAuditoriaFromForm = function () {
  var self = this;
  var form = document.getElementById('kair-aud-form-auditoria');
  var errorEl = document.getElementById('kair-aud-form-aud-error');
  errorEl.textContent = '';

  var fd = new FormData(form);
  var data = {
    id: fd.get('id') || null,
    nombre: (fd.get('nombre') || '').toString().trim(),
    tipo: (fd.get('tipo') || 'Interna').toString(),
    alcance: (fd.get('alcance') || '').toString().trim(),
    fechaInicio: fd.get('fechaInicio') || '',
    fechaFin: fd.get('fechaFin') || '',
    estado: (fd.get('estado') || 'programada').toString(),
    auditorLider: (fd.get('auditorLider') || '').toString().trim(),
    trimestre: (fd.get('trimestre') || '').toString(),
    calificacion: fd.get('calificacion') === '' ? null : parseInt(fd.get('calificacion'), 10),
    equipo: (fd.get('equipoTexto') || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean)
  };

  /* Validaciones */
  if (!data.nombre) return setError('El nombre es obligatorio.');
  if (!data.fechaInicio || !data.fechaFin) return setError('Las fechas son obligatorias.');
  if (data.fechaInicio > data.fechaFin) return setError('La fecha de inicio no puede ser posterior a la fecha de fin.');

  /* Auto-asignar trimestre según fechaInicio si está vacío */
  if (!data.trimestre && data.fechaInicio) {
    var m = parseInt(data.fechaInicio.split('-')[1], 10);
    if (m >= 1 && m <= 3) data.trimestre = 'Q1';
    else if (m >= 4 && m <= 6) data.trimestre = 'Q2';
    else if (m >= 7 && m <= 9) data.trimestre = 'Q3';
    else data.trimestre = 'Q4';
  }

  var saveBtn = document.getElementById('kair-aud-save-auditoria');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  AuditoriaService.guardarAuditoria(self._getEmpresaId(), data).then(function (resp) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
    if (resp && resp.success) {
      self._closeAuditoriaModal();
      self._showToast(data.id ? 'Auditoría actualizada' : 'Auditoría creada', 'success');
      self._refreshCurrentView();
    } else {
      setError((resp && resp.error && resp.error.message) || 'Error desconocido al guardar.');
    }
  }).catch(function (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
    setError('Error: ' + (err && err.message ? err.message : 'desconocido'));
  });

  function setError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
};

AuditoriaAnualComponent.prototype._deleteAuditoria = function (id) {
  var self = this;
  this._showConfirm({
    title: 'Eliminar auditoría',
    message: '¿Eliminar la auditoría ' + id + '?\n\nEsto también borrará todos sus hallazgos asociados. Esta acción no se puede deshacer.',
    acceptLabel: 'Eliminar',
    danger: true
  }, function () {
    AuditoriaService.eliminarAuditoria(self._getEmpresaId(), id).then(function (resp) {
      if (resp && resp.success) {
        self._showToast('Auditoría eliminada', 'success');
        self._refreshCurrentView();
      } else {
        self._showToast('Error al eliminar: ' + ((resp && resp.error && resp.error.message) || 'desconocido'), 'error');
      }
    });
  });
};

AuditoriaAnualComponent.prototype._refreshCurrentView = function () {
  /* Re-render la vista actual para mostrar cambios */
  var viewKey = this.currentView;
  var container = document.getElementById('kair-aud-view-' + viewKey);
  if (container) container.innerHTML = '';
  this._loadCurrentView();
  /* Re-renderizar UI para refrescar KPIs y contadores de tabs */
  this._renderUI();
  this._initNavigation();
};

/* ── Modal de Hallazgo ── */

AuditoriaAnualComponent.prototype._ensureHallazgoModal = function () {
  if (document.getElementById('kair-aud-modal-hallazgo')) return;
  var self = this;
  var modal = document.createElement('div');
  modal.id = 'kair-aud-modal-hallazgo';
  modal.className = 'kair-aud-modal';
  modal.innerHTML =
    '<div class="kair-aud-modal__backdrop" data-modal-close></div>' +
    '<div class="kair-aud-modal__panel">' +
      '<div class="kair-aud-modal__head">' +
        '<h3 id="kair-aud-modal-hal-title">Nuevo hallazgo</h3>' +
        '<button class="kair-aud-modal__close" data-modal-close>&times;</button>' +
      '</div>' +
      '<div class="kair-aud-modal__body">' +
        '<form id="kair-aud-form-hallazgo" autocomplete="off">' +
          '<input type="hidden" name="id" />' +
          '<div class="kair-aud-form-row">' +
            '<label>Auditoría *<select name="auditoriaId" required></select></label>' +
            '<label>Código<input type="text" name="codigo" maxlength="30" placeholder="HJ-2026-001" /></label>' +
          '</div>' +
          '<label>Descripción *<textarea name="descripcion" required rows="3" maxlength="500"></textarea></label>' +
          '<div class="kair-aud-form-row">' +
            '<label>Severidad *' +
              '<select name="severidad" required>' +
                '<option value="critico">Crítico</option>' +
                '<option value="mayor">Mayor</option>' +
                '<option value="menor">Menor</option>' +
              '</select>' +
            '</label>' +
            '<label>Estado *' +
              '<select name="estado" required>' +
                '<option value="abierto">Abierto</option>' +
                '<option value="en-progreso">En Progreso</option>' +
                '<option value="cerrado">Cerrado</option>' +
              '</select>' +
            '</label>' +
          '</div>' +
          '<div class="kair-aud-form-row">' +
            '<label>Responsable<input type="text" name="responsable" maxlength="80" /></label>' +
            '<label>Fecha detección<input type="date" name="fechaDeteccion" /></label>' +
          '</div>' +
          '<div class="kair-aud-form-row">' +
            '<label>Acción correctiva<textarea name="accionCorrectiva" rows="2" maxlength="300"></textarea></label>' +
            '<label>Fecha cierre (si cerrado)<input type="date" name="fechaCierre" /></label>' +
          '</div>' +
          '<div class="kair-aud-modal__error" id="kair-aud-form-hal-error"></div>' +
        '</form>' +
      '</div>' +
      '<div class="kair-aud-modal__foot">' +
        '<button class="kair-aud-btn kair-aud-btn--ghost" data-modal-close>Cancelar</button>' +
        '<button class="kair-aud-btn kair-aud-btn--primary" id="kair-aud-save-hallazgo">Guardar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  modal.addEventListener('click', function (e) {
    if (e.target.matches('[data-modal-close]')) self._closeHallazgoModal();
  });
  document.getElementById('kair-aud-save-hallazgo').addEventListener('click', function () {
    self._saveHallazgoFromForm();
  });
};

AuditoriaAnualComponent.prototype._openHallazgoForm = function (hallazgo, defaultAuditoriaId) {
  this._ensureHallazgoModal();
  var modal = document.getElementById('kair-aud-modal-hallazgo');
  var form = document.getElementById('kair-aud-form-hallazgo');
  var title = document.getElementById('kair-aud-modal-hal-title');
  var errorEl = document.getElementById('kair-aud-form-hal-error');

  form.reset();
  errorEl.textContent = '';

  /* Llenar select de auditorías */
  var select = form.auditoriaId;
  select.innerHTML = '<option value="">— Seleccionar —</option>' +
    AuditoriaService.getAuditorias().map(function (a) {
      return '<option value="' + self._escape(a.id) + '">' + self._escape(a.id + ' · ' + a.nombre) + '</option>';
    }).join('');

  if (hallazgo) {
    title.textContent = 'Editar hallazgo · ' + hallazgo.id;
    form.id.value = hallazgo.id || '';
    form.auditoriaId.value = hallazgo.auditoriaId || '';
    form.codigo.value = hallazgo.codigo || '';
    form.descripcion.value = hallazgo.descripcion || '';
    form.severidad.value = hallazgo.severidad || 'menor';
    form.estado.value = hallazgo.estado || 'abierto';
    form.responsable.value = hallazgo.responsable || '';
    form.fechaDeteccion.value = hallazgo.fechaDeteccion || '';
    form.accionCorrectiva.value = hallazgo.accionCorrectiva || '';
    form.fechaCierre.value = hallazgo.fechaCierre || '';
  } else {
    title.textContent = 'Nuevo hallazgo';
    form.severidad.value = 'menor';
    form.estado.value = 'abierto';
    if (defaultAuditoriaId) form.auditoriaId.value = defaultAuditoriaId;
  }

  modal.classList.add('kair-aud-modal--open');
};

AuditoriaAnualComponent.prototype._closeHallazgoModal = function () {
  var modal = document.getElementById('kair-aud-modal-hallazgo');
  if (modal) modal.classList.remove('kair-aud-modal--open');
};

AuditoriaAnualComponent.prototype._saveHallazgoFromForm = function () {
  var self = this;
  var form = document.getElementById('kair-aud-form-hallazgo');
  var errorEl = document.getElementById('kair-aud-form-hal-error');

  var fd = new FormData(form);
  var data = {
    id: fd.get('id') || null,
    auditoriaId: (fd.get('auditoriaId') || '').toString(),
    codigo: (fd.get('codigo') || '').toString().trim(),
    descripcion: (fd.get('descripcion') || '').toString().trim(),
    severidad: (fd.get('severidad') || 'menor').toString(),
    estado: (fd.get('estado') || 'abierto').toString(),
    responsable: (fd.get('responsable') || '').toString().trim(),
    fechaDeteccion: fd.get('fechaDeteccion') || '',
    accionCorrectiva: (fd.get('accionCorrectiva') || '').toString().trim(),
    fechaCierre: fd.get('fechaCierre') || ''
  };

  if (!data.auditoriaId) return setError('Debes seleccionar la auditoría.');
  if (!data.descripcion) return setError('La descripción es obligatoria.');
  if (data.estado === 'cerrado' && !data.fechaCierre) {
    data.fechaCierre = new Date().toISOString().split('T')[0];
  }

  var saveBtn = document.getElementById('kair-aud-save-hallazgo');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  AuditoriaService.guardarHallazgo(self._getEmpresaId(), data).then(function (resp) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
    if (resp && resp.success) {
      self._closeHallazgoModal();
      self._showToast(data.id ? 'Hallazgo actualizado' : 'Hallazgo creado', 'success');
      self._refreshCurrentView();
    } else {
      setError((resp && resp.error && resp.error.message) || 'Error desconocido al guardar.');
    }
  }).catch(function (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
    setError('Error: ' + (err && err.message ? err.message : 'desconocido'));
  });

  function setError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
};

AuditoriaAnualComponent.prototype._deleteHallazgo = function (id) {
  var self = this;
  this._showConfirm({
    title: 'Eliminar hallazgo',
    message: '¿Eliminar el hallazgo ' + id + '? Esta acción no se puede deshacer.',
    acceptLabel: 'Eliminar',
    danger: true
  }, function () {
    AuditoriaService.eliminarHallazgo(self._getEmpresaId(), id).then(function (resp) {
      if (resp && resp.success) {
        self._showToast('Hallazgo eliminado', 'success');
        self._refreshCurrentView();
      } else {
        self._showToast('Error al eliminar', 'error');
      }
    });
  });
};

/* Helpers expuestos para que las vistas disparen el modal */
window.kairAuditoriaAnual = {
  openAuditoriaForm: function (auditoria) {
    if (window.__kairAudInstance) window.__kairAudInstance._openAuditoriaForm(auditoria);
  },
  openHallazgoForm: function (hallazgo, defaultAuditoriaId) {
    if (window.__kairAudInstance) window.__kairAudInstance._openHallazgoForm(hallazgo, defaultAuditoriaId);
  },
  deleteAuditoria: function (id) {
    if (window.__kairAudInstance) window.__kairAudInstance._deleteAuditoria(id);
  },
  deleteHallazgo: function (id) {
    if (window.__kairAudInstance) window.__kairAudInstance._deleteHallazgo(id);
  },
  showConfirm: function (opts, onConfirm) {
    if (window.__kairAudInstance) return window.__kairAudInstance._showConfirm(opts, onConfirm);
    return Promise.resolve(false);
  },
  showToast: function (msg, type) {
    if (window.__kairAudInstance) window.__kairAudInstance._showToast(msg, type);
  },
  /* F11 (2026-06-20): refresh disparado por las vistas v3 tras navegar.
     Antes este método no existía → las 6 vistas (hub/list/editor/cronograma/
     hallazgos/informes) lo buscaban con `&& window.kairAuditoriaAnual._refreshView`
     y nunca encontraban, así que tras un goList/goHub/etc. el contenedor
     quedaba con la vista anterior sin re-renderizar. */
  _refreshView: function () {
    if (window.__kairAudInstance && typeof window.__kairAudInstance._renderUI === 'function') {
      window.__kairAudInstance._renderUI();
    }
  }
};

// Export globally
window.AuditoriaAnualComponent = AuditoriaAnualComponent;
