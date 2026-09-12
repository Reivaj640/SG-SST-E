// modules/gestion-humana/carpetas/index.js
// I-AUDIT-2026-09-11 (Carpetas v0.2.0) · Módulo "Documentos de Contratación"
// Réplica del prototipo HTML (kair-documentos-contratacion.pdf) integrado en K+AIR.
// - Categorías DINÁMICAS (gestionables por el user, NO hardcoded)
// - Estado del expediente DERIVADO (completo/incompleto/crítico) en SQL
// - Storage filesystem (AppData/gh-carpetas/<empresa>/<trabajador>/<categoria>/<archivo>)
// - Validación: max 10MB, extensiones pdf/doc/docx/xls/xlsx/jpg/jpeg/png
//
// 3 vistas: Lista (KPIs + tabla) + Detalle (4+ categorías) + Modal Subida + Modal Categorías.
// Patrón: misma forma que los otros componentes GH (constructor(container, companyName, moduleName, subName, onBack))

(function () {
  'use strict';

  var EXT_OK = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];
  var MAX_BYTES = 10 * 1024 * 1024;
  var PAGE_SIZE = 8;
  var STORAGE_KEY_STATE = 'kair-carpetas-state';

  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function _fmtBytes(b) {
    if (!b && b !== 0) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    var mb = b / 1024 / 1024;
    return mb.toFixed(1).replace('.0', '') + ' MB';
  }

  function _fmtDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
    } catch (e) { return iso; }
  }

  function _iniciales(nombre) {
    var p = String(nombre || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '') + ((p.length > 1 ? p[p.length - 1][0] : '') || '');
  }

  function _toast() {
    return (window.parent && window.parent.GestionHumanaToast) ? window.parent.GestionHumanaToast : window.GestionHumanaToast;
  }
  function _showToast(title, subtitle, type) {
    var t = _toast();
    if (!t) { console.log('[TOAST]', type || 'info', title, subtitle || ''); return; }
    if (typeof t[type || 'info'] === 'function') { t[type || 'info'](title, subtitle || ''); return; }
    if (typeof t.show === 'function') t.show(title + (subtitle ? ': ' + subtitle : ''), type || 'info');
  }
  function _confirm() {
    return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm;
  }

  // ========== COMPONENTE PRINCIPAL ==========
  function CarpetasComponent(container, companyName, moduleName, subName, onBack) {
    this.container = container;
    this.companyName = companyName;
    this.moduleName = moduleName;
    this.subName = subName;
    this.onBack = onBack || function () {};
    this.view = 'list'; // 'list' | 'detail'
    this.selectedTrabajadorId = null;
    this.list = { items: [], kpis: null, total: 0, page: 1, totalPages: 1, search: '', estado: 'todos' };
    this.detail = null;
    this.categorias = []; // categorías activas (cache)
    this.loading = false;
  }

  CarpetasComponent.prototype.destroy = function () {
    // nada que limpiar por ahora
  };

  CarpetasComponent.prototype.render = async function () {
    var self = this;
    if (!window.electronAPI) {
      self.container.innerHTML = '<div style="padding:2rem;color:#721c24;background:#f8d7da;border-radius:8px;">⚠️ electronAPI no disponible. K+AIR se está cargando.</div>';
      return;
    }
    if (self.view === 'list') {
      await self._renderList();
    } else if (self.view === 'detail') {
      await self._renderDetail();
    }
  };

  // ========== VISTA LISTA ==========
  CarpetasComponent.prototype._renderList = async function () {
    var self = this;
    self.container.innerHTML = '';
    self.loading = true;

    // Header (solo título, sin botón — el botón se movió al toolbar)
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;';
    header.innerHTML =
      '<div style="flex:1;">' +
        '<h1 style="margin:0;font-size:1.25rem;color:#1a1a2e;display:flex;align-items:center;gap:0.5rem;">' +
          '<i class="fas fa-folder-open" style="color:#174ea6;"></i> Carpetas' +
        '</h1>' +
        '<p style="margin:0.125rem 0 0;font-size:0.8125rem;color:#5a6378;">Archivo digital por trabajador · ' + _esc(self.companyName || 'Empresa') + '</p>' +
      '</div>';
    self.container.appendChild(header);

    // Toolbar (search + filtro estado + botón gestionar categorías + contador)
    var toolbar = document.createElement('div');
    toolbar.className = 'kair-toolbar';
    // 📦743 — Estilos inline como workaround: el shell de K+AIR tiene un override
    // que rompe el CSS externo. Aplicamos los estilos críticos directo al elemento
    // para garantizar el layout en una sola línea.
    toolbar.style.cssText =
      'display: grid;' +
      'grid-template-columns: minmax(300px, 1fr) auto auto auto;' +
      'align-items: center;' +
      'gap: 0.75rem;' +
      'background: white;' +
      'border: 1px solid #dee2e6;' +
      'border-radius: 10px;' +
      'padding: 0.75rem 1rem;' +
      'margin-bottom: 0.75rem;';
    toolbar.innerHTML =
      '<div class="kair-search">' +
        '<i class="fas fa-search kair-search__icon" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#5a6378;font-size:14px;pointer-events:none;"></i>' +
        '<input type="search" id="carp-search" placeholder="Buscar por nombre, cédula o cargo…" value="' + _esc(self.list.search) + '" ' +
          'style="width:100%;padding:8px 12px 8px 38px;border:1px solid #dee2e6;border-radius:6px;font-family:inherit;font-size:14px;color:#1a1a2e;background:white;outline:none;box-sizing:border-box;">' +
      '</div>' +
      '<select class="kair-select" id="carp-estado">' +
        '<option value="todos">Estado · Todos</option>' +
        '<option value="completo">Completo</option>' +
        '<option value="incompleto">Incompleto</option>' +
        '<option value="critico">Crítico</option>' +
      '</select>' +
      '<button class="kair-btn kair-btn--outline" id="carp-btn-categorias" style="white-space:nowrap;padding:7px 12px;border:1px solid #dee2e6;border-radius:6px;background:white;color:#5a6378;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-tags"></i> Gestionar categorías</button>' +
      '<span class="kair-toolbar__count" id="carp-count" style="color:#5a6378;font-size:13px;justify-self:end;white-space:nowrap;"></span>';
    self.container.appendChild(toolbar);

    // Tabla
    var tablaCard = document.createElement('div');
    tablaCard.className = 'kair-card';
    tablaCard.style.cssText = 'background:white;border:1px solid #dee2e6;border-radius:10px;overflow:hidden;';
    tablaCard.innerHTML =
      '<div style="overflow-x:auto;">' +
        '<table class="kair-table">' +
          '<thead><tr>' +
            '<th>Empleado</th>' +
            '<th>Cargo</th>' +
            '<th>Contrato</th>' +
            '<th>Documentos</th>' +
            '<th>Estado</th>' +
            '<th>Últ. actualización</th>' +
            '<th class="col--actions" style="text-align:right;"><span class="sr-only">Acciones</span></th>' +
          '</tr></thead>' +
          '<tbody id="carp-tbody"></tbody>' +
        '</table>' +
      '</div>' +
      '<div class="kair-pagination" id="carp-pagination"></div>';
    self.container.appendChild(tablaCard);

    // Restaurar filtro estado visualmente
    var selEstado = self.container.querySelector('#carp-estado');
    if (selEstado) selEstado.value = self.list.estado || 'todos';

    // Wire events
    var inpSearch = self.container.querySelector('#carp-search');
    if (inpSearch) {
      var t = null;
      inpSearch.addEventListener('input', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          self.list.search = inpSearch.value;
          self.list.page = 1;
          self._reloadList();
        }, 300);
      });
      // 📦743 · Focus visible: cambiar border a azul al enfocar (igual que el select)
      inpSearch.addEventListener('focus', function () {
        inpSearch.style.borderColor = '#174ea6';
      });
      inpSearch.addEventListener('blur', function () {
        inpSearch.style.borderColor = '#dee2e6';
      });
    }
    if (selEstado) {
      selEstado.addEventListener('change', function () {
        self.list.estado = selEstado.value;
        self.list.page = 1;
        self._reloadList();
      });
    }
    var btnCat = self.container.querySelector('#carp-btn-categorias');
    if (btnCat) btnCat.addEventListener('click', function () { self._openCategoriasModal(); });

    // Carga inicial
    self._reloadList();
  };

  CarpetasComponent.prototype._reloadList = async function () {
    var self = this;
    self.loading = true;
    var tbody = self.container.querySelector('#carp-tbody');
    var countEl = self.container.querySelector('#carp-count');
    var pagEl = self.container.querySelector('#carp-pagination');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#5a6378;">Cargando…</td></tr>';

    try {
      var r = await window.electronAPI.ghListExpedientes({
        token: null,
        companyName: self.companyName,
        search: self.list.search,
        estado: self.list.estado,
        page: self.list.page,
        pageSize: PAGE_SIZE
      });
      if (!r || !r.success) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#721c24;">⚠️ ' + _esc((r && r.error && r.error.message) || 'Error al cargar') + '</td></tr>';
        return;
      }
      self.list.items = r.data.expedientes || [];
      self.list.total = r.data.count || 0;
      self.list.totalPages = r.data.totalPages || 1;
      self._renderRows();
      self._renderPagination();
      if (countEl) countEl.textContent = self.list.total + ' expediente' + (self.list.total === 1 ? '' : 's');
    } catch (e) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:2rem;text-align:center;color:#721c24;">⚠️ ' + _esc(e.message) + '</td></tr>';
    } finally {
      self.loading = false;
    }
  };

  CarpetasComponent.prototype._renderRows = function () {
    var self = this;
    var tbody = self.container.querySelector('#carp-tbody');
    if (!tbody) return;
    if (!self.list.items.length) {
      tbody.innerHTML =
        '<tr><td colspan="7">' +
          '<div class="kair-empty">' +
            '<i class="fas fa-inbox"></i>' +
            '<div class="kair-empty__title">Sin resultados</div>' +
            '<div class="kair-empty__msg">No hay expedientes que coincidan con la búsqueda o el filtro aplicado.</div>' +
            '<button class="kair-btn kair-btn--outline" id="carp-clear">Limpiar filtros</button>' +
          '</div>' +
        '</td></tr>';
      var btnClear = self.container.querySelector('#carp-clear');
      if (btnClear) btnClear.addEventListener('click', function () {
        self.list.search = ''; self.list.estado = 'todos'; self.list.page = 1;
        self._renderList();
      });
      return;
    }
    var estadoBadge = {
      completo: '<span class="kair-badge kair-badge--success"><span class="kair-badge__dot"></span>Completo</span>',
      incompleto: '<span class="kair-badge kair-badge--warning"><span class="kair-badge__dot"></span>Incompleto</span>',
      critico: '<span class="kair-badge kair-badge--danger"><span class="kair-badge__dot"></span>Crítico</span>'
    };
    tbody.innerHTML = self.list.items.map(function (e) {
      var ini = _iniciales(e.nombreCompleto).toUpperCase();
      var contratoBadge = e.tipoContrato
        ? '<span class="kair-badge kair-badge--primary">' + _esc(e.tipoContrato) + '</span>'
        : '<span class="kair-badge kair-badge--primary">Indefinido</span>';
      var pctFill = 'kair-progress__fill--' + (e.estado === 'completo' ? 'success' : e.estado === 'critico' ? 'danger' : 'warning');
      var ult = e.lastUpdateTs ? 'hace poco' : '—'; // simplificado
      return '<tr>' +
        '<td>' +
          '<div class="kair-emp">' +
            '<div class="kair-avatar">' + _esc(ini) + '</div>' +
            '<div>' +
              '<div class="kair-emp__name">' + _esc(e.nombreCompleto) + '</div>' +
              '<div class="kair-emp__doc">' + _esc(e.cedula) + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' +
          '<div style="font-weight:500;">' + _esc(e.cargo || '—') + '</div>' +
        '</td>' +
        '<td>' + contratoBadge + '</td>' +
        '<td>' +
          '<div class="kair-progress"><div class="kair-progress__track"><div class="kair-progress__fill ' + pctFill + '" style="width:' + (e.pct || 0) + '%;"></div></div><span class="kair-progress__label">' + e.categoriasPresentes + '/' + e.totalCategorias + '</span></div>' +
          '<div style="font-size:0.75rem;color:#5a6378;margin-top:2px;">' + (e.totalDocs || 0) + ' archivo' + ((e.totalDocs || 0) === 1 ? '' : 's') + '</div>' +
        '</td>' +
        '<td>' + (estadoBadge[e.estado] || '') + '</td>' +
        '<td style="color:#5a6378;">' + ult + '</td>' +
        '<td class="col--actions" style="text-align:right;">' +
          '<button class="kair-btn kair-btn--ghost" data-action="ver" data-id="' + _esc(e.trabajadorId) + '">Ver expediente</button>' +
          '<button class="kair-icon-btn" data-action="subir" data-id="' + _esc(e.trabajadorId) + '" title="Subir documento"><i class="fas fa-upload"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');

    // Delegación de eventos
    tbody.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var act = btn.getAttribute('data-action');
        if (act === 'ver') {
          self.selectedTrabajadorId = id;
          self.view = 'detail';
          self.render();
        } else if (act === 'subir') {
          self._openUploadModal(id, null);
        }
      });
    });
  };

  CarpetasComponent.prototype._renderPagination = function () {
    var self = this;
    var pagEl = self.container.querySelector('#carp-pagination');
    if (!pagEl) return;
    var page = self.list.page;
    var totalPages = self.list.totalPages;
    var total = self.list.total;
    var start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    var end = Math.min(page * PAGE_SIZE, total);
    pagEl.innerHTML =
      '<span class="kair-pagination__info">Mostrando ' + start + '-' + end + ' de ' + total + ' expedientes</span>' +
      '<span class="kair-pagination__page">página ' + page + ' / ' + totalPages + '</span>' +
      '<button class="kair-pager-btn" id="carp-prev" ' + (page <= 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>' +
      '<button class="kair-pager-btn" id="carp-next" ' + (page >= totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    var prev = pagEl.querySelector('#carp-prev');
    var next = pagEl.querySelector('#carp-next');
    if (prev) prev.addEventListener('click', function () { if (self.list.page > 1) { self.list.page--; self._reloadList(); } });
    if (next) next.addEventListener('click', function () { if (self.list.page < self.list.totalPages) { self.list.page++; self._reloadList(); } });
  };

  // ========== VISTA DETALLE ==========
  CarpetasComponent.prototype._renderDetail = async function () {
    var self = this;
    self.container.innerHTML = '<div style="padding:2rem;text-align:center;color:#5a6378;">Cargando expediente…</div>';
    try {
      var r = await window.electronAPI.ghGetExpediente({
        token: null,
        companyName: self.companyName,
        trabajadorId: self.selectedTrabajadorId
      });
      if (!r || !r.success) {
        self.container.innerHTML = '<div style="padding:2rem;color:#721c24;">⚠️ ' + _esc((r && r.error && r.error.message) || 'Error') + '</div>';
        return;
      }
      self.detail = r.data;
      self._renderDetailContent();
    } catch (e) {
      self.container.innerHTML = '<div style="padding:2rem;color:#721c24;">⚠️ ' + _esc(e.message) + '</div>';
    }
  };

  CarpetasComponent.prototype._renderDetailContent = function () {
    var self = this;
    var d = self.detail;
    if (!d) return;
    self.container.innerHTML = '';

    // 🆕 WRAPPER para scroll interno (patrón del shell GH, ver 📦770)
    // Sin este wrapper, las 4+ categorías del detail view se desbordan
    // y se cortan visualmente porque .gh-content tiene overflow:hidden.
    var wrapper = document.createElement('div');
    wrapper.className = 'carp-wrapper';
    self.container.appendChild(wrapper);

    // Header con back
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;';
    header.innerHTML =
      '<button class="gh-btn gh-btn--outline" id="carp-back"><i class="fas fa-arrow-left"></i> Volver</button>';
    wrapper.appendChild(header);
    self.container.querySelector('#carp-back').addEventListener('click', function () {
      self.view = 'list';
      self.selectedTrabajadorId = null;
      self.render();
    });

    // Info card
    var ini = _iniciales(d.expediente.nombreCompleto).toUpperCase();
    var estadoBadge = d.estado === 'completo' ? 'kair-badge--success' : d.estado === 'critico' ? 'kair-badge--danger' : 'kair-badge--warning';
    var pctFill = 'kair-progress__fill--' + (d.estado === 'completo' ? 'success' : d.estado === 'critico' ? 'danger' : 'warning');

    var infoCard = document.createElement('div');
    infoCard.className = 'kair-info-card';
    infoCard.innerHTML =
      '<div class="kair-avatar kair-avatar--lg">' + _esc(ini) + '</div>' +
      '<div class="kair-info-card__body">' +
        '<div class="kair-info-card__name">' + _esc(d.expediente.nombreCompleto) + '</div>' +
        '<div class="kair-info-card__role">' + _esc(d.expediente.cargo || '—') + ' · ' + _esc(self.companyName) + '</div>' +
        '<div class="kair-info-card__meta">' +
          '<div><div class="kair-info-card__meta-label">Documento</div><div class="kair-info-card__meta-value">' + _esc(d.expediente.cedula) + '</div></div>' +
          '<div><div class="kair-info-card__meta-label">Ingreso</div><div class="kair-info-card__meta-value">' + _fmtDate(d.expediente.fechaIngreso) + '</div></div>' +
          '<div><div class="kair-info-card__meta-label">Tipo de contrato</div><div class="kair-info-card__meta-value">' + _esc(d.expediente.tipoContrato || 'Indefinido') + '</div></div>' +
          '<div><div class="kair-info-card__meta-label">Estado del expediente</div><div class="kair-info-card__meta-value"><span class="kair-badge ' + estadoBadge + '"><span class="kair-badge__dot"></span>' + (d.estado.charAt(0).toUpperCase() + d.estado.slice(1)) + '</span></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="kair-info-card__side">' +
        '<div class="kair-completitud__head"><span>Completitud del expediente</span><strong>' + d.pct + '%</strong></div>' +
        '<div class="kair-progress"><div class="kair-progress__track"><div class="kair-progress__fill ' + pctFill + '" style="width:' + d.pct + '%;"></div></div></div>' +
        '<span class="kair-badge kair-badge--info"><span class="kair-badge__dot"></span>' + d.categoriasPresentes + ' de ' + d.totalCategorias + ' categorías</span>' +
      '</div>';
    wrapper.appendChild(infoCard);

    // Botón global "Subir documento" (en la info card o en header)
    var headerActions = document.createElement('div');
    headerActions.style.cssText = 'display:flex;justify-content:flex-end;margin:0.75rem 0;';
    headerActions.innerHTML = '<button class="kair-btn kair-btn--primary" id="carp-subir-global"><i class="fas fa-upload"></i> Subir documento</button>';
    wrapper.appendChild(headerActions);
    self.container.querySelector('#carp-subir-global').addEventListener('click', function () {
      self._openUploadModal(self.selectedTrabajadorId, null);
    });

    // Grid de categorías (2 columnas)
    var grid = document.createElement('div');
    grid.className = 'kair-detail-grid';
    grid.innerHTML = d.categorias.map(function (cat) {
      var docsHtml = '';
      var totalCount = cat.countTotal || cat.count || 0;
      if (totalCount > 0) {
        // Mezclar docs propios + importados en el render
        var docsPropiosHtml = (cat.docsPropios || []).map(function (doc) {
          return '<div class="kair-file-row" data-doc-id="' + _esc(doc.id) + '" data-doc-origen="propio">' +
            '<div class="kair-file-row__icon"><i class="far fa-file"></i></div>' +
            '<div class="kair-file-row__body">' +
              '<div class="kair-file-row__name">' + _esc(doc.nombreArchivo) + '</div>' +
              '<div class="kair-file-row__meta">' + _fmtBytes(doc.tamanoBytes) + ' · ' + _fmtDate(doc.fechaSubida) + '</div>' +
            '</div>' +
            '<div class="kair-file-row__actions">' +
              '<button class="kair-icon-btn" data-file-action="ver" title="Ver" aria-label="Ver ' + _esc(doc.nombreArchivo) + '"><i class="fas fa-eye"></i></button>' +
              '<button class="kair-icon-btn" data-file-action="descargar" title="Descargar" aria-label="Descargar ' + _esc(doc.nombreArchivo) + '"><i class="fas fa-download"></i></button>' +
              '<button class="kair-icon-btn kair-icon-btn--danger" data-file-action="eliminar" title="Eliminar" aria-label="Eliminar ' + _esc(doc.nombreArchivo) + '"><i class="fas fa-trash"></i></button>' +
            '</div>' +
          '</div>';
        }).join('');
        var docsImportadosHtml = (cat.docsImportados || []).map(function (doc) {
          var pasoLabel = {1: 'Memo', 2: 'Contacto', 3: 'Examenes', 4: 'Firma', 5: 'Afiliaciones'}[doc.pasoNum] || 'Contratación';
          return '<div class="kair-file-row kair-file-row--imported" data-doc-id="' + _esc(doc.id) + '" data-doc-origen="contratacion" data-soporte-id="' + _esc(doc.id) + '" title="Documento del flujo de Contratación - solo lectura">' +
            '<div class="kair-file-row__icon" style="background:#e8f0fe;color:#174ea6;"><i class="fas fa-link"></i></div>' +
            '<div class="kair-file-row__body">' +
              '<div class="kair-file-row__name">' + _esc(doc.nombreArchivo) + '</div>' +
              '<div class="kair-file-row__meta">' + _fmtBytes(doc.tamanoBytes) + ' · ' + _fmtDate(doc.fechaSubida) + ' · <span style="color:#174ea6;font-weight:500;">Paso ' + doc.pasoNum + ': ' + pasoLabel + '</span></div>' +
            '</div>' +
            '<div class="kair-file-row__actions">' +
              '<button class="kair-icon-btn" data-soporte-action="ver" title="Ver original" aria-label="Ver original ' + _esc(doc.nombreArchivo) + '"><i class="fas fa-external-link-alt"></i></button>' +
            '</div>' +
          '</div>';
        }).join('');
        docsHtml = docsPropiosHtml + docsImportadosHtml;
      } else {
        docsHtml = '<div class="kair-file-empty">' +
          '<i class="far fa-folder-open"></i>' +
          '<div>Sin documentos en esta categoría</div>' +
          '<button class="kair-btn kair-btn--outline" data-load-cat="' + _esc(cat.id) + '"><i class="fas fa-upload"></i> Cargar documento</button>' +
        '</div>';
      }
      return '<div class="kair-cat-card">' +
        '<div class="kair-cat-card__head">' +
          '<div class="kair-cat-card__icon"><i class="far fa-folder"></i></div>' +
          '<div style="flex:1;">' +
            '<div class="kair-cat-card__title">' + _esc(cat.nombre) + '</div>' +
            '<div class="kair-cat-card__count">' + (cat.count > 0 ? cat.count + (cat.count === 1 ? ' archivo · Últ. ' : ' archivos · Últ. ') + _fmtDate(cat.docs[0].fechaSubida) : 'Categoría vacía') + '</div>' +
          '</div>' +
          '<button class="kair-btn kair-btn--outline" data-load-cat="' + _esc(cat.id) + '"><i class="fas fa-upload"></i> Cargar</button>' +
        '</div>' +
        '<div class="kair-cat-card__body">' + docsHtml + '</div>' +
      '</div>';
    }).join('');
    wrapper.appendChild(grid);

    // Eventos: data-load-cat (cargar desde categoría) + data-file-action (ver/descargar/eliminar)
    grid.querySelectorAll('[data-load-cat]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var catId = btn.getAttribute('data-load-cat');
        self._openUploadModal(self.selectedTrabajadorId, catId);
      });
    });
    grid.querySelectorAll('[data-file-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.kair-file-row');
        var docId = row ? row.getAttribute('data-doc-id') : null;
        var action = btn.getAttribute('data-file-action');
        if (!docId) return;
        if (action === 'ver') {
          self._abrirDocumento(docId);
        } else if (action === 'descargar') {
          self._showToast('Descarga', 'La descarga se conectará al backend en una fase posterior.', 'info');
        } else if (action === 'eliminar') {
          self._confirmarEliminarDocumento(docId);
        }
      });
    });
    // 📦743 · Abrir soportes importados del flujo de Contratación (read-only)
    grid.querySelectorAll('[data-soporte-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.kair-file-row');
        var soporteId = row ? row.getAttribute('data-doc-id') : null;
        if (!soporteId) return;
        self._abrirSoporteContratacion(soporteId);
      });
    });
  };

  // ========== MODAL SUBIDA ==========
  CarpetasComponent.prototype._openUploadModal = async function (preselectTrabajadorId, preselectCategoriaId) {
    var self = this;
    // Cargar categorías + trabajadores en paralelo
    var catsR, trabR;
    try {
      catsR = await window.electronAPI.ghListCategoriasCarpetas({ token: null, companyName: self.companyName });
      self.categorias = (catsR && catsR.success) ? catsR.data.categorias : [];
    } catch (e) {
      self.categorias = [];
    }
    try {
      trabR = await window.electronAPI.ghListTrabajadoresDisponibles({ token: null, companyName: self.companyName });
    } catch (e) {
      trabR = { success: false, error: { message: e.message } };
    }
    if (!catsR || !catsR.success || !self.categorias.length) {
      _showToast('Sin categorías', 'No hay categorías activas. Crea una antes de subir documentos.', 'error');
      return;
    }
    if (!trabR || !trabR.success) {
      _showToast('Error', 'No se pudieron cargar los trabajadores.', 'error');
      return;
    }
    var trabajadores = trabR.data.trabajadores || [];

    var modal = document.createElement('div');
    modal.className = 'kair-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'carp-modal-title');
    modal.innerHTML =
      '<div class="kair-modal">' +
        '<div class="kair-modal__head">' +
          '<div>' +
            '<div class="kair-modal__title" id="carp-modal-title">Subir documento</div>' +
            '<div class="kair-modal__subtitle">Los archivos se agregarán a la categoría seleccionada del expediente</div>' +
          '</div>' +
          '<button class="kair-icon-btn" id="carp-modal-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="kair-modal__body">' +
          '<div class="kair-field">' +
            '<label class="kair-field__label">Expediente del empleado</label>' +
            '<select class="kair-select" id="carp-m-emp">' +
              '<option value="">Selecciona un empleado…</option>' +
              trabajadores.map(function (t) {
                return '<option value="' + _esc(t.id) + '"' + (t.id === preselectTrabajadorId ? ' selected' : '') + '>' + _esc(t.nombreCompleto) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="kair-field">' +
            '<label class="kair-field__label">Categoría del documento</label>' +
            '<select class="kair-select" id="carp-m-cat">' +
              '<option value="">Selecciona una categoría…</option>' +
              self.categorias.map(function (c) {
                return '<option value="' + _esc(c.id) + '"' + (c.id === preselectCategoriaId ? ' selected' : '') + '>' + _esc(c.nombre) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="kair-dropzone" id="carp-dropzone" role="button" tabindex="0" aria-label="Seleccionar archivo">' +
            '<i class="fas fa-cloud-upload-alt"></i>' +
            '<div class="kair-dropzone__title">Arrastra archivo aquí o <a href="#" id="carp-select-file">selecciónalo</a></div>' +
            '<div class="kair-dropzone__hint">PDF, Word, Excel o imágenes · Máximo 10 MB por archivo</div>' +
          '</div>' +
          '<div id="carp-uplist" class="kair-uplist"></div>' +
        '</div>' +
        '<div class="kair-modal__foot">' +
          '<span class="kair-modal__hint" id="carp-modal-hint">Selecciona expediente y categoría para habilitar la subida</span>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<button class="kair-btn kair-btn--outline" id="carp-m-cancel">Cancelar</button>' +
            '<button class="kair-btn kair-btn--primary" id="carp-m-confirm" disabled><i class="fas fa-upload"></i> Subir</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    self.container.appendChild(modal);

    var selEmp = modal.querySelector('#carp-m-emp');
    var selCat = modal.querySelector('#carp-m-cat');
    var btnConfirm = modal.querySelector('#carp-m-confirm');
    var hint = modal.querySelector('#carp-modal-hint');

    function updateFoot() {
      var okEmp = !!selEmp.value;
      var okCat = !!selCat.value;
      btnConfirm.disabled = !(okEmp && okCat);
      hint.textContent = (okEmp && okCat) ? 'Listo para subir' : 'Selecciona expediente y categoría para habilitar la subida';
    }
    selEmp.addEventListener('change', updateFoot);
    selCat.addEventListener('change', updateFoot);
    updateFoot();

    function closeModal() {
      modal.remove();
    }
    modal.querySelector('#carp-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#carp-m-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

    // Acción: subir (el bridge abre el dialog del SO)
    btnConfirm.addEventListener('click', async function () {
      btnConfirm.disabled = true;
      hint.textContent = 'Subiendo…';
      try {
        var r = await window.electronAPI.ghSubirDocumentoCarpeta({
          token: null,
          companyName: self.companyName,
          trabajadorId: selEmp.value,
          categoriaId: selCat.value
        });
        if (r && r.success) {
          if (r.data && r.data.canceled) {
            hint.textContent = 'Cancelado por el usuario';
            btnConfirm.disabled = false;
            return;
          }
          _showToast('Documento subido', (r.data.expedienteCreado ? 'Expediente creado · ' : '') + (r.data.documento ? r.data.documento.nombreArchivo : ''), 'success');
          closeModal();
          // Refrescar vista actual
          if (self.view === 'detail') self.render();
          else self._reloadList();
        } else {
          _showToast('Error al subir', (r && r.error && r.error.message) || 'Intenta de nuevo', 'error');
          btnConfirm.disabled = false;
          updateFoot();
        }
      } catch (e) {
        _showToast('Error', e.message, 'error');
        btnConfirm.disabled = false;
        updateFoot();
      }
    });

    // El link "selecciónalo" abre directamente el flujo (lo mismo que el botón Subir si ya hay contexto)
    modal.querySelector('#carp-select-file').addEventListener('click', function (e) {
      e.preventDefault();
      if (!btnConfirm.disabled) btnConfirm.click();
    });
  };

  // ========== ACCIONES DOCUMENTO ==========
  CarpetasComponent.prototype._abrirDocumento = async function (docId) {
    var self = this;
    try {
      var r = await window.electronAPI.ghAbrirDocumentoCarpeta({ token: null, documentoId: docId });
      if (!r || !r.success) {
        _showToast('Error al abrir', (r && r.error && r.error.message) || 'No se pudo abrir', 'error');
      }
    } catch (e) {
      _showToast('Error', e.message, 'error');
    }
  };

  // 📦743 · Abrir un soporte del flujo de Contratación (read-only — fuente de verdad sigue ahí)
  CarpetasComponent.prototype._abrirSoporteContratacion = async function (soporteId) {
    var self = this;
    try {
      var r = await window.electronAPI.ghAbrirSoporteContratacion({ token: null, soporteId: soporteId });
      if (!r || !r.success) {
        _showToast('Error al abrir', (r && r.error && r.error.message) || 'No se pudo abrir', 'error');
      }
    } catch (e) {
      _showToast('Error', e.message, 'error');
    }
  };

  CarpetasComponent.prototype._confirmarEliminarDocumento = function (docId) {
    var self = this;
    var c = _confirm();
    if (c && typeof c.show === 'function') {
      c.show('Eliminar documento', '¿Estás seguro? Esta acción no se puede deshacer.', function (ok) {
        if (ok) self._eliminarDocumento(docId);
      });
    } else {
      if (window.confirm('¿Eliminar este documento?')) self._eliminarDocumento(docId);
    }
  };

  CarpetasComponent.prototype._eliminarDocumento = async function (docId) {
    var self = this;
    try {
      var r = await window.electronAPI.ghEliminarDocumentoCarpeta({ token: null, documentoId: docId });
      if (!r || !r.success) {
        _showToast('Error', (r && r.error && r.error.message) || 'No se pudo eliminar', 'error');
        return;
      }
      _showToast('Eliminado', 'Documento eliminado correctamente', 'success');
      if (self.view === 'detail') self.render();
    } catch (e) {
      _showToast('Error', e.message, 'error');
    }
  };

  // ========== MODAL CATEGORÍAS (CRUD) ==========
  CarpetasComponent.prototype._openCategoriasModal = async function () {
    var self = this;
    var r;
    try {
      r = await window.electronAPI.ghListCategoriasCarpetas({ token: null, companyName: self.companyName });
    } catch (e) { r = { success: false, error: { message: e.message } }; }
    if (!r || !r.success) {
      _showToast('Error', 'No se pudieron cargar las categorías', 'error');
      return;
    }
    var cats = r.data.categorias || [];

    var modal = document.createElement('div');
    modal.className = 'kair-modal-overlay';
    modal.innerHTML =
      '<div class="kair-modal" style="max-width:560px;">' +
        '<div class="kair-modal__head">' +
          '<div>' +
            '<div class="kair-modal__title">Gestionar categorías</div>' +
            '<div class="kair-modal__subtitle">Crea, renombra o desactiva categorías del expediente</div>' +
          '</div>' +
          '<button class="kair-icon-btn" id="carp-cat-close"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="kair-modal__body">' +
          '<div class="kair-field" style="display:flex;gap:0.5rem;">' +
            '<input class="kair-select" id="carp-cat-new" placeholder="Nueva categoría (ej: Certificaciones técnicas)" style="flex:1;">' +
            '<button class="kair-btn kair-btn--primary" id="carp-cat-add"><i class="fas fa-plus"></i> Agregar</button>' +
          '</div>' +
          '<div id="carp-cat-list" class="kair-uplist"></div>' +
        '</div>' +
        '<div class="kair-modal__foot">' +
          '<span class="kair-modal__hint">' + cats.length + ' categoría' + (cats.length === 1 ? '' : 's') + '</span>' +
          '<button class="kair-btn kair-btn--outline" id="carp-cat-cerrar">Cerrar</button>' +
        '</div>' +
      '</div>';
    self.container.appendChild(modal);

    function renderList() {
      var list = modal.querySelector('#carp-cat-list');
      if (!list) return;
      if (!cats.length) {
        list.innerHTML = '<div style="padding:1rem;color:#5a6378;text-align:center;">Sin categorías</div>';
        return;
      }
      list.innerHTML = cats.map(function (c) {
        return '<div class="kair-cat-row" data-id="' + _esc(c.id) + '" style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem;border:1px solid #e9ecef;border-radius:6px;margin-bottom:0.5rem;">' +
          '<i class="far fa-folder" style="color:#174ea6;"></i>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:500;">' + _esc(c.nombre) + '</div>' +
            '<div style="font-size:0.75rem;color:#5a6378;">código: ' + _esc(c.codigo) + (c.activo ? '' : ' · inactiva') + '</div>' +
          '</div>' +
          '<button class="kair-icon-btn" data-toggle="' + _esc(c.id) + '" title="' + (c.activo ? 'Desactivar' : 'Activar') + '"><i class="fas fa-power-off"></i></button>' +
        '</div>';
      }).join('');
      list.querySelectorAll('[data-toggle]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var id = b.getAttribute('data-toggle');
          var target = cats.find(function (c) { return c.id === id; });
          if (!target) return;
          try {
            var ur = await window.electronAPI.ghUpdateCategoriaCarpeta({ token: null, categoriaId: id, activo: target.activo ? 0 : 1 });
            if (ur && ur.success) {
              target.activo = ur.data.categoria.activo;
              _showToast('Categoría actualizada', target.nombre + (target.activo ? ' activada' : ' desactivada'), 'success');
              renderList();
            } else {
              _showToast('Error', (ur && ur.error && ur.error.message) || 'No se pudo actualizar', 'error');
            }
          } catch (e) { _showToast('Error', e.message, 'error'); }
        });
      });
    }
    renderList();

    function close() { modal.remove(); }
    modal.querySelector('#carp-cat-close').addEventListener('click', close);
    modal.querySelector('#carp-cat-cerrar').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

    var inp = modal.querySelector('#carp-cat-new');
    var btnAdd = modal.querySelector('#carp-cat-add');
    async function add() {
      var nombre = (inp.value || '').trim();
      if (nombre.length < 2) { _showToast('Nombre muy corto', 'Mínimo 2 caracteres', 'warning'); return; }
      btnAdd.disabled = true;
      try {
        var cr = await window.electronAPI.ghCreateCategoriaCarpeta({ token: null, companyName: self.companyName, nombre: nombre });
        if (cr && cr.success) {
          cats.push(cr.data.categoria);
          inp.value = '';
          _showToast('Categoría creada', cr.data.categoria.nombre, 'success');
          renderList();
        } else {
          _showToast('Error', (cr && cr.error && cr.error.message) || 'No se pudo crear', 'error');
        }
      } catch (e) { _showToast('Error', e.message, 'error'); }
      btnAdd.disabled = false;
    }
    btnAdd.addEventListener('click', add);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
  };

  // Exponer
  window.CarpetasComponent = CarpetasComponent;
})();
