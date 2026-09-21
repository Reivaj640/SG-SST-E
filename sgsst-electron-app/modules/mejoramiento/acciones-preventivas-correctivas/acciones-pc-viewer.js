/* ═══════════════════════════════════════════════════════════════════
   K+AIR · 7.1.1 — Matriz de Control Operacional
   Viewer · prefijo kair-
   F21.43 (2026-06-21) — Refactor al modelo de la referencia
   ═══════════════════════════════════════════════════════════════════ */

const SUBMODULO = '7.1.1';
const COMPANY = new URLSearchParams(window.location.search).get('company') || 'Tempoactiva Est SAS';

/* ── Estado global ── */
const state = {
  data: [],
  catalogos: { tipos: [], estados: [], fuentes: [], sistemas: [] },
  fuente: '',                  // 'excel' | 'sqlite' | 'vacio'
  excelPath: null,
  excelDisponible: false,
  excelError: null,
  conteos: { excel: 0, sqlite: 0, total: 0, pendientesExportar: 0 },
  cargando: false,
  filterTab: 'TODAS',
  filterTipo: '',
  filterFuente: '',
  searchText: '',

  /* Editor */
  editingId: null,
  editing: null,           // objeto accion siendo editado
  sectionsCollapsed: {}    // mapa sectionId -> bool
};

/* ── IPC helper ── */
function _api() {
  try {
    if (window.parent && window.parent.electronAPI && window.parent.electronAPI.accionesPc) {
      return window.parent.electronAPI.accionesPc;
    }
    if (window.electronAPI && window.electronAPI.accionesPc) return window.electronAPI.accionesPc;
  } catch (e) {}
  return null;
}
function _empresaId() { return COMPANY; }

/* ── Utilidades ── */
function _esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function _fmtDate(s) {
  if (!s) return '—';
  try {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  } catch (e) { return s; }
}
function _todayIso() { return new Date().toISOString().split('T')[0]; }
function _badgeTipo(t) { return `<span class="kair-tipo kair-tipo--${t || 'AM'}">${_esc(t || 'AM')}</span>`; }
function _badgeEstado(e) {
  const cls = 'kair-estado--' + (e || '').replace(/ /g, '_').replace(/Ó/g, 'O');
  const label = ({'ABIERTA':'Abierta','EN PROCESO':'En proceso','CERRADO':'Cerrado','VENCIDA':'Vencida'})[e] || e;
  return `<span class="kair-estado ${cls}">${_esc(label || '—')}</span>`;
}
function _isVencida(a) {
  if (!a.cierre || !a.cierre.cerrada) {
    if (!a.fecha) return false;
    return a.fecha < _todayIso() && a.estado !== 'CERRADO';
  }
  return false;
}
function _truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}

/* ── Notificaciones (estándar updateNotifier del proyecto) ──
   F21.47 (2026-06-21): Usa window.updateNotifier.show({type, title, subtitle, autoClose}).
   Proxy pattern: intenta el parent (donde está registrado el notifier) y luego window. */
function _notify(type, title, subtitle, options) {
  var payload = Object.assign({ type: type || 'info', title: title || '' }, options || {});
  if (subtitle) payload.subtitle = subtitle;
  var notifier = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
  if (notifier && typeof notifier.show === 'function') {
    return notifier.show(payload);
  }
  /* Fallback silencioso si el notifier no está disponible */
  console.log('[' + (type || 'info').toUpperCase() + '] ' + title + (subtitle ? ' — ' + subtitle : ''));
}

/* Backward-compat: alias para no romper llamadas existentes */
function _toast(title, desc, type) { return _notify(type, title, desc); }

/* ── Vista: Lista ── */
function renderKpis() {
  const total = state.data.length;
  const abiertas = state.data.filter(a => a.estado === 'ABIERTA').length;
  const proceso = state.data.filter(a => a.estado === 'EN PROCESO').length;
  const cerradas = state.data.filter(a => a.estado === 'CERRADO').length;
  const vencidas = state.data.filter(_isVencida).length;

  document.getElementById('kpi-total').textContent = total;
  document.getElementById('kpi-abiertas').textContent = abiertas;
  document.getElementById('kpi-proceso').textContent = proceso;
  document.getElementById('kpi-cerradas').textContent = cerradas;
  document.getElementById('kpi-vencidas').textContent = vencidas;

  document.getElementById('tab-count-todas').textContent = total;
  document.getElementById('tab-count-abiertas').textContent = abiertas;
  document.getElementById('tab-count-proceso').textContent = proceso;
  document.getElementById('tab-count-cerradas').textContent = cerradas;

  /* Badge de fuente (Excel vs SQLite) */
  const badge = document.getElementById('fuente-badge');
  if (badge) {
    const pendientes = state.conteos.pendientesExportar || 0;
    let html = '';
    if (state.fuente === 'excel') {
      html += `<span class="kair-fuente-pill kair-fuente-pill--excel"><i class="bi bi-file-earmark-spreadsheet"></i> Fuente: Excel (${state.conteos.excel})</span>`;
    } else if (state.fuente === 'sqlite') {
      html += `<span class="kair-fuente-pill kair-fuente-pill--sqlite"><i class="bi bi-database"></i> Fuente: Cache local (${state.conteos.sqlite})</span>`;
    } else {
      html += `<span class="kair-fuente-pill kair-fuente-pill--empty"><i class="bi bi-inbox"></i> Sin datos</span>`;
    }
    if (pendientes > 0) {
      html += `<span class="kair-fuente-pill kair-fuente-pill--pending"><i class="bi bi-cloud-upload"></i> ${pendientes} pendiente${pendientes > 1 ? 's' : ''} de sincronizar al Excel</span>`;
    }
    if (state.excelError) {
      html += `<span class="kair-fuente-pill kair-fuente-pill--error" title="${state.excelError}"><i class="bi bi-exclamation-triangle"></i> Error leyendo Excel</span>`;
    }
    badge.innerHTML = html;
  }
}

function getFiltered() {
  return state.data.filter(a => {
    /* Tab */
    if (state.filterTab !== 'TODAS' && a.estado !== state.filterTab) {
      /* Para tabs, también contar vencidas dentro de su categoría */
      if (state.filterTab === 'ABIERTA' && a.estado !== 'ABIERTA') return false;
      if (state.filterTab === 'EN PROCESO' && a.estado !== 'EN PROCESO') return false;
      if (state.filterTab === 'CERRADO' && a.estado !== 'CERRADO') return false;
    }
    /* Tipo */
    if (state.filterTipo && a.tipo !== state.filterTipo) return false;
    /* Fuente */
    if (state.filterFuente && a.fuente !== state.filterFuente) return false;
    /* Texto */
    if (state.searchText) {
      const t = state.searchText.toLowerCase();
      const hay = (a.descripcion || '').toLowerCase().indexOf(t) !== -1
        || (a.procesoPertenece || '').toLowerCase().indexOf(t) !== -1
        || (a.procesoSolicita || '').toLowerCase().indexOf(t) !== -1
        || (a.responsableEjecucion || '').toLowerCase().indexOf(t) !== -1
        || (a.fuente || '').toLowerCase().indexOf(t) !== -1;
      if (!hay) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = getFiltered();
  const tbody = document.getElementById('tableBody');

  document.getElementById('resultCount').textContent = `${rows.length} de ${state.data.length} acciones`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="kair-empty">
      <i class="bi bi-clipboard-list kair-empty__icon"></i>
      <div class="kair-empty__title">No se encontraron acciones</div>
      <div class="kair-empty__desc">${state.data.length === 0 ? 'Aún no hay acciones registradas. Crea una con el botón "Nueva acción".' : 'No hay acciones que coincidan con los filtros aplicados.'}</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((a, idx) => {
    const num = state.data.indexOf(a) + 1;
    const descCorta = _truncate(a.descripcion || '', 140);
    const sub = '';
    const fechaProp = a.cierre && a.cierre.fecha ? a.cierre.fecha : a.fecha;
    const vencida = _isVencida(a);
    return `
      <tr data-id="${_esc(a.id)}">
        <td class="kair-td-num">${num}</td>
        <td class="kair-td-fecha">${_fmtDate(a.fecha)}</td>
        <td class="kair-td-desc">
          <div class="kair-td-desc__title" title="${_esc(a.descripcion)}">${_esc(descCorta)}</div>
        </td>
        <td class="kair-td-tipo">${_badgeTipo(a.tipo)}</td>
        <td>${_esc(a.procesoPertenece || '—')}</td>
        <td class="kair-td-fuente">${_esc(a.fuente || '—')}</td>
        <td class="kair-td-resp">${_esc(a.responsableEjecucion || '—')}</td>
        <td class="kair-td-fechaprop">
          ${_fmtDate(fechaProp)}
          ${vencida ? '<div class="kair-td-fechaprop__vencida">vencida</div>' : ''}
        </td>
        <td class="kair-td-fechacierre">${_fmtDate(a.cierre && a.cierre.fecha)}</td>
        <td>${_badgeEstado(a.estado)}</td>
        <td class="kair-td-acc">
          <button title="Ver detalle" data-act="edit"><i class="bi bi-pencil"></i></button>
          <button title="Eliminar" data-act="del" class="kair-btn--danger-ghost"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

function populateCatalogos() {
  /* Tipo */
  const selTipo = document.getElementById('filterTipo');
  if (selTipo) {
    selTipo.innerHTML = '<option value="">Todos los tipos</option>'
      + state.catalogos.tipos.map(t => `<option value="${_esc(t.value)}">${_esc(t.label)}</option>`).join('');
  }
  /* Fuente */
  const selFuente = document.getElementById('filterFuente');
  if (selFuente) {
    selFuente.innerHTML = '<option value="">Todas las fuentes</option>'
      + state.catalogos.fuentes.map(f => `<option value="${_esc(f)}">${_esc(f)}</option>`).join('');
  }
}

function render() {
  renderKpis();
  renderTable();
}

/* ── Editor (modal) ── */
function openEditor(accion) {
  state.editingId = accion ? accion.id : null;
  state.editing = accion ? JSON.parse(JSON.stringify(accion)) : _nuevaAccionVacia();

  /* Mostrar editor, ocultar lista */
  document.getElementById('main-view').style.display = 'none';
  document.getElementById('editor-view').hidden = false;

  /* Header: cambiar a modo edición con breadcrumb */
  _setHeaderMode('edit', accion);

  /* Inicializar sidebar nav */
  document.querySelectorAll('.kair-side-nav__item').forEach(b => b.classList.remove('is-active'));
  document.querySelector('.kair-side-nav__item[data-section="datos-basicos"]').classList.add('is-active');

  /* Cargar catálogos en selects del editor */
  _populateEditorCatalogos();
  _populateEditorValues();

  /* Reset secciones: abiertas por defecto */
  state.sectionsCollapsed = {};
  document.querySelectorAll('\.kair-form-section').forEach(s => s.classList.remove('is-collapsed'));

  updateEditorSidebar();
  updateBannerEstado();
  updateCompletitud();
}

/* F21.46 (2026-06-21): Cambia el header entre vista de lista y edición.
   - Lista: title="Matriz de Control Operacional", subtitle visible, sin breadcrumb, botón="Volver"
   - Edición: title="Nueva acción"/"Editar AP-XXX", subtitle oculto, breadcrumb visible, botón="Cerrar" */
function _setHeaderMode(mode, accion) {
  const titleEl = document.getElementById('header-title');
  const subtitleEl = document.getElementById('header-subtitle');
  const breadcrumbEl = document.getElementById('header-breadcrumb');
  const breadcrumbCurrent = document.getElementById('header-breadcrumb-current');
  const backBtn = document.getElementById('btn-back');
  const backText = document.getElementById('btn-back-text');
  const importarBtn = document.getElementById('btn-importar');
  const exportarBtn = document.getElementById('btn-exportar');

  if (mode === 'edit') {
    const isNew = !accion;
    const codigo = (accion && accion.codigo) || (accion && accion.id) || 'Nueva';
    if (titleEl) titleEl.textContent = isNew ? 'Nueva acción' : 'Editar ' + codigo;
    if (subtitleEl) subtitleEl.hidden = true;
    if (breadcrumbEl) breadcrumbEl.hidden = false;
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = isNew ? 'Nueva acción' : codigo;
    if (backBtn) backBtn.title = 'Cerrar editor y volver a la lista';
    if (backText) backText.textContent = 'Cerrar';
    /* En modo edición ocultamos importar/exportar (no aplican al editor) */
    if (importarBtn) importarBtn.hidden = true;
    if (exportarBtn) exportarBtn.hidden = true;
  } else {
    if (titleEl) titleEl.textContent = 'Matriz de Control Operacional';
    if (subtitleEl) subtitleEl.hidden = false;
    if (breadcrumbEl) breadcrumbEl.hidden = true;
    if (backBtn) backBtn.title = 'Volver al módulo Mejoramiento';
    if (backText) backText.textContent = 'Volver';
    if (importarBtn) importarBtn.hidden = false;
    if (exportarBtn) exportarBtn.hidden = false;
  }
}

function _nuevaAccionVacia() {
  return {
    id: 'AP-' + Date.now(),
    codigo: '',
    fecha: _todayIso(),
    tipo: 'AC',
    estado: 'ABIERTA',
    procesoPertenece: '',
    procesoSolicita: '',
    responsableEjecucion: '',
    responsableCierre: '',
    fuente: '',
    sistemasGestion: [],
    descripcion: '',
    observaciones: '',
    causas: ['', '', '', '', ''],
    planAccion: [],
    verificacionEficacia: '',
    cierre: { cerrada: false, responsable: '', fecha: '' }
  };
}

function _populateEditorCatalogos() {
  /* Tipo */
  const selTipo = document.getElementById('edit-tipo');
  if (selTipo) {
    selTipo.innerHTML = state.catalogos.tipos.map(t => `<option value="${_esc(t.value)}">${_esc(t.label)}</option>`).join('');
  }
  /* Estado */
  const selEstado = document.getElementById('edit-estado');
  if (selEstado) {
    selEstado.innerHTML = state.catalogos.estados.map(e => `<option value="${_esc(e.value)}">${_esc(e.label)}</option>`).join('');
  }
  /* Fuente */
  const selFuente = document.getElementById('edit-fuente');
  if (selFuente) {
    selFuente.innerHTML = '<option value="">Selecciona una fuente...</option>'
      + state.catalogos.fuentes.map(f => `<option value="${_esc(f)}">${_esc(f)}</option>`).join('');
  }
  /* Sistemas */
  const sg = document.getElementById('edit-sistemas');
  if (sg) {
    sg.innerHTML = state.catalogos.sistemas.map(s => `
      <label class="kair-check"><input type="checkbox" data-sistema="${_esc(s)}"><span>${_esc(s)}</span></label>
    `).join('');
  }
}

function _populateEditorValues() {
  const a = state.editing;
  document.querySelectorAll('#editor-view [data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (a[key] !== undefined && a[key] !== null) {
      el.value = a[key];
    } else {
      el.value = '';
    }
  });
  /* Sistemas (checkboxes) */
  document.querySelectorAll('#edit-sistemas input[data-sistema]').forEach(cb => {
    cb.checked = (a.sistemasGestion || []).indexOf(cb.getAttribute('data-sistema')) !== -1;
  });
  /* Causas */
  renderPorques();
  /* Plan de acción */
  renderPlanAccion();
  /* Cierre */
  document.querySelectorAll('#editor-view [data-cierre-field]').forEach(el => {
    const key = el.getAttribute('data-cierre-field');
    if (key === 'cerrada') {
      const val = a.cierre && (a.cierre.cerrada === true || a.cierre.cerrada === 'true');
      const radio = document.querySelector(`input[data-cierre-field="cerrada"][value="${val ? 'true' : 'false'}"]`);
      if (radio) radio.checked = true;
    } else if (a.cierre) {
      el.value = a.cierre[key] || '';
    }
  });
  /* Side info */
  document.getElementById('side-id').textContent = 'ID: ' + (a.codigo || a.id || '—');
  document.getElementById('side-fecha').textContent = 'Fecha: ' + (_fmtDate(a.fecha) || '—');
  document.getElementById('side-resp').textContent = a.responsableEjecucion || '—';
}

function renderPorques() {
  const cont = document.getElementById('porques-list');
  cont.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const v = (state.editing.causas && state.editing.causas[i]) || '';
    const item = document.createElement('div');
    item.className = 'kair-5porques__item';
    item.innerHTML = `
      <span class="kair-5porques__num">${i + 1}</span>
      <div class="kair-5porques__body">
        <label class="kair-field__label">¿Por qué ocurrió? — Nivel ${i + 1}</label>
        <textarea class="kair-field__textarea" data-causa="${i}" rows="2" placeholder="Respuesta al porqué número ${i + 1}...">${_esc(v)}</textarea>
      </div>
    `;
    cont.appendChild(item);
  }
}

function renderPlanAccion() {
  const tbody = document.getElementById('plan-body');
  tbody.innerHTML = '';
  (state.editing.planAccion || []).forEach((act, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-plan="descripcion" data-idx="${idx}" value="${_esc(act.descripcion || '')}"></td>
      <td><input type="date" data-plan="fecha" data-idx="${idx}" value="${_esc(act.fecha || '')}"></td>
      <td><input type="text" data-plan="responsable" data-idx="${idx}" value="${_esc(act.responsable || '')}"></td>
      <td><input type="number" data-plan="costo" data-idx="${idx}" value="${act.costo || 0}"></td>
      <td style="text-align:center;"><input type="checkbox" data-plan="realizada" data-idx="${idx}" ${act.realizada ? 'checked' : ''}></td>
      <td><input type="text" data-plan="verifico" data-idx="${idx}" value="${_esc(act.verifico || '')}"></td>
      <td><input type="date" data-plan="fechaVerif" data-idx="${idx}" value="${_esc(act.fechaVerif || '')}"></td>
      <td><button class="kair-plan-del" data-plan-del="${idx}" title="Eliminar"><i class="bi bi-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateEditorSidebar() {
  const a = state.editing;
  document.getElementById('side-id').textContent = 'ID: ' + (a.codigo || a.id || '—');
  document.getElementById('side-fecha').textContent = 'Fecha: ' + (_fmtDate(a.fecha) || '—');
  document.getElementById('side-resp').textContent = a.responsableEjecucion || '—';
  document.getElementById('side-estado').textContent = ({ 'ABIERTA': 'Abierta', 'EN PROCESO': 'En proceso', 'CERRADO': 'Cerrado' })[a.estado] || a.estado || '—';
}

function updateBannerEstado() {
  const a = state.editing;
  const banner = document.getElementById('banner-estado');
  if (!a.estado) {
    banner.className = 'kair-banner kair-banner--info';
    banner.innerHTML = '<i class="bi bi-info-circle-fill"></i><div><strong>Nueva acción.</strong> Completa los datos básicos para empezar.</div>';
    return;
  }
  if (a.estado === 'ABIERTA') {
    banner.className = 'kair-banner kair-banner--info';
    banner.innerHTML = '<i class="bi bi-info-circle-fill"></i><div><strong>Acción abierta.</strong> Pendiente de ejecutar el plan de acción.</div>';
  } else if (a.estado === 'EN PROCESO') {
    banner.className = 'kair-banner kair-banner--warning';
    banner.innerHTML = '<i class="bi bi-arrow-repeat"></i><div><strong>Acción en proceso.</strong> Plan de acción ejecutándose. Pendiente de verificación y cierre.</div>';
  } else if (a.estado === 'CERRADO') {
    banner.className = 'kair-banner kair-banner--success';
    banner.innerHTML = '<i class="bi bi-check-circle-fill"></i><div><strong>Acción cerrada.</strong> Se verificó la eficacia y se documentó el cierre formal.</div>';
  } else {
    banner.className = 'kair-banner kair-banner--info';
    banner.innerHTML = '<i class="bi bi-info-circle-fill"></i><div><strong>Estado:</strong> ' + _esc(a.estado) + '</div>';
  }
}

function updateCompletitud() {
  const a = state.editing;
  let score = 0;
  if ((a.procesoPertenece || '').trim() && (a.responsableEjecucion || '').trim() && a.fuente && a.fecha) score++;
  if ((a.descripcion || '').trim().length >= 10) score++;
  if ((a.causas || []).some(c => (c || '').trim())) score++;
  if ((a.planAccion || []).some(p => (p.descripcion || '').trim())) score++;
  if ((a.verificacionEficacia || '').trim()) score++;
  if (a.cierre && a.cierre.cerrada) score++;

  const total = 6;
  document.getElementById('completitud-val').textContent = score + '/' + total;
  document.getElementById('completitud-bar').style.width = ((score / total) * 100) + '%';
}

function collectFromForm() {
  const a = state.editing;
  document.querySelectorAll('#editor-view [data-field]').forEach(el => {
    const key = el.getAttribute('data-field');
    if (a[key] !== undefined) a[key] = el.value;
  });
  /* Sistemas */
  a.sistemasGestion = [];
  document.querySelectorAll('#edit-sistemas input[data-sistema]:checked').forEach(cb => {
    a.sistemasGestion.push(cb.getAttribute('data-sistema'));
  });
  /* Causas */
  const causas = [];
  document.querySelectorAll('#porques-list [data-causa]').forEach(ta => {
    causas.push(ta.value);
  });
  a.causas = causas;
  /* Plan acción */
  document.querySelectorAll('#plan-body [data-plan]').forEach(el => {
    const key = el.getAttribute('data-plan');
    const idx = parseInt(el.getAttribute('data-idx'), 10);
    if (!a.planAccion[idx]) a.planAccion[idx] = {};
    if (key === 'realizada') a.planAccion[idx][key] = el.checked;
    else if (key === 'costo') a.planAccion[idx][key] = parseFloat(el.value) || 0;
    else a.planAccion[idx][key] = el.value;
  });
  /* Cierre */
  const cerradaRadio = document.querySelector('input[data-cierre-field="cerrada"]:checked');
  if (cerradaRadio) a.cierre.cerrada = cerradaRadio.value === 'true';
  document.querySelectorAll('#editor-view [data-cierre-field]').forEach(el => {
    const key = el.getAttribute('data-cierre-field');
    if (key !== 'cerrada') a.cierre[key] = el.value;
  });
  return a;
}

function validateAccion(a) {
  if (!a.fecha) return 'La fecha es obligatoria.';
  if (!a.procesoPertenece || !a.procesoPertenece.trim()) return 'El proceso al que pertenece es obligatorio.';
  if (!a.responsableEjecucion || !a.responsableEjecucion.trim()) return 'El responsable de ejecución es obligatorio.';
  if (!a.fuente) return 'Debes seleccionar una fuente.';
  if (!a.descripcion || a.descripcion.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres.';
  return null;
}

async function saveAccion(cerrarDespues) {
  const a = collectFromForm();
  if (cerrarDespues) {
    a.estado = 'CERRADO';
    a.cierre.cerrada = true;
    if (!a.cierre.fecha) a.cierre.fecha = _todayIso();
  }
  const err = validateAccion(a);
  if (err) {
    _toast('Validación', err, 'error');
    return;
  }
  const api = _api();
  if (!api || !api.guardarAccion) {
    _toast('Sin persistencia', 'Bridge IPC no disponible. Datos en memoria.', 'warning');
    /* Fallback memoria */
    const idx = state.data.findIndex(x => x.id === a.id);
    if (idx >= 0) state.data[idx] = a; else state.data.unshift(a);
    render();
    closeEditor();
    return;
  }
  try {
    const resp = await api.guardarAccion(_empresaId(), a);
    if (resp && resp.success) {
      a.__fuente = 'sqlite';
      a.updatedAt = new Date().toISOString();
      _toast(
        cerrarDespues ? 'Acción cerrada' : 'Acción guardada',
        state.excelDisponible
          ? 'Guardada en cache local. Usa "Sincronizar al Excel" para escribir al archivo.'
          : (a.codigo || a.id),
        state.excelDisponible ? 'info' : 'success'
      );
      /* Actualizar o insertar en state */
      const idx = state.data.findIndex(x => x.id === a.id);
      if (idx >= 0) state.data[idx] = a;
      else state.data.unshift(a);
      /* Actualizar conteos */
      if (state.conteos.pendientesExportar === undefined) state.conteos.pendientesExportar = 0;
      if (!state.data.some(x => x.id === a.id && x.__fuente === 'excel')) {
        state.conteos.pendientesExportar++;
      }
      state.conteos.sqlite++;
      state.conteos.total = state.data.length;
      render();
      closeEditor();
    } else {
      _toast('Error', (resp && resp.error && resp.error.message) || 'No se pudo guardar', 'error');
    }
  } catch (e) {
    _toast('Error', e.message, 'error');
  }
}

function closeEditor() {
  state.editingId = null;
  state.editing = null;
  document.getElementById('editor-view').hidden = true;
  document.getElementById('main-view').style.display = '';
  /* Volver el header a modo lista */
  _setHeaderMode('list');
}

function deleteAccion(id) {
  const a = state.data.find(x => x.id === id);
  if (!a) return;
  /* F21.45 (2026-06-21): Sin confirm() bloqueante del navegador — se elimina directo y se notifica por toast.
     El usuario puede recrear la acción si fue un error (no hay undo por ahora). */
  const api = _api();
  if (!api || !api.eliminarAccion) {
    state.data = state.data.filter(x => x.id !== id);
    if (state.conteos) {
      state.conteos.total = state.data.length;
      if (a.__fuente === 'sqlite' && state.conteos.pendientesExportar > 0) state.conteos.pendientesExportar--;
    }
    render();
    _toast('Acción eliminada', (a.codigo || a.id) + (a.__fuente === 'excel' ? ' (solo del cache local — el Excel la conserva)' : ''), 'success');
    return;
  }
  api.eliminarAccion(_empresaId(), id).then(resp => {
    state.data = state.data.filter(x => x.id !== id);
    if (state.conteos) {
      state.conteos.total = state.data.length;
      if (a.__fuente === 'sqlite' && state.conteos.pendientesExportar > 0) state.conteos.pendientesExportar--;
    }
    render();
    _toast('Acción eliminada', (a.codigo || a.id) + (a.__fuente === 'excel' ? ' (solo del cache local — el Excel la conserva)' : ''), 'success');
  }).catch(err => {
    _toast('Error', err.message, 'error');
  });
}

/* F21.46 (2026-06-21): Importar desde Excel (botón del header k-section-card) */
function importarDesdeExcel() {
  const api = _api();
  if (!api || !api.seleccionarArchivoImportar) {
    _toast('Sin IPC', 'Bridge IPC no disponible para importar.', 'error');
    return;
  }
  api.seleccionarArchivoImportar().then(sel => {
    if (!sel || !sel.success || !sel.data) {
      _toast('Cancelado', 'Importación cancelada por el usuario.', 'info');
      return;
    }
    return api.importarXlsx(_empresaId(), sel.data.archivoPath);
  }).then(resp => {
    if (!resp) return;
    if (resp.success) {
      _toast('Importación completa', `${resp.data.importados} acciones importadas de ${resp.data.archivo}`, 'success');
      cargarTodo();
    } else {
      _toast('Error al importar', (resp.error && resp.error.message) || 'No se pudo importar', 'error');
    }
  }).catch(err => {
    _toast('Error', err.message, 'error');
  });
}

/* F21.46 (2026-06-21): Exportar a Excel (botón del header k-section-card) */
function exportarAExcel() {
  const api = _api();
  if (!api || !api.exportarXlsx) {
    _toast('Sin IPC', 'Bridge IPC no disponible para exportar.', 'error');
    return;
  }
  _toast('Exportando...', 'Generando archivo Excel...', 'info');
  api.exportarXlsx(_empresaId()).then(resp => {
    if (resp && resp.success) {
      _toast('Exportación completa', `${resp.data.acciones} acciones → ${resp.data.archivo}`, 'success');
    } else {
      _toast('Error al exportar', (resp && resp.error && resp.error.message) || 'No se pudo exportar', 'error');
    }
  }).catch(err => {
    _toast('Error', err.message, 'error');
  });
}

/* ── Carga inicial ── */
function cargarTodo() {
  const api = _api();
  if (!api || !api.cargarTodo) {
    console.warn('[7.1.1] Bridge IPC no disponible — modo standalone');
    state.catalogos = {
      tipos: [{value:'AC',label:'Acción Correctiva'},{value:'AP',label:'Acción Preventiva'},{value:'AM',label:'Acción de Mejora'}],
      estados: [{value:'ABIERTA',label:'Abierta'},{value:'EN PROCESO',label:'En proceso'},{value:'CERRADO',label:'Cerrado'}],
      fuentes: ['Auditoria Interna','Auditoria Externa','Revision Gerencial','Accidente','Indicadores','Manejo de Emergencias','Inspecciones','Observacion de Procesos','Reporte de Condiciones/ Actos inseguros','Investigacion de Accidentes','No Conforme','Resultado de Reuniones, Comites','Manejo del Cambio','Requisitos Legales','Otros'],
      sistemas: ['ISO 9001','ISO 14001','OHSAS 18001','BASC','Otro']
    };
    state.fuente = 'vacio';
    state.conteos = { excel: 0, sqlite: 0, total: 0, pendientesExportar: 0 };
    populateCatalogos();
    render();
    return;
  }
  api.cargarTodo(_empresaId()).then(resp => {
    if (resp && resp.success && resp.data) {
      state.data = resp.data.acciones || [];
      state.fuente = resp.data.fuente || 'vacio';
      state.excelPath = resp.data.excelPath || null;
      state.excelDisponible = !!resp.data.excelDisponible;
      state.excelError = resp.data.excelError || null;
      state.conteos = resp.data.conteos || { excel: 0, sqlite: 0, total: state.data.length, pendientesExportar: 0 };
      if (resp.data.catalogos) state.catalogos = resp.data.catalogos;
      console.log('[7.1.1] Cargadas ' + state.data.length + ' acciones | fuente=' + state.fuente +
        ' excel=' + state.conteos.excel +
        ' sqlite=' + state.conteos.sqlite +
        ' pendientes=' + state.conteos.pendientesExportar +
        (state.excelPath ? ' | archivo=' + state.excelPath : ' | sin-Excel'));
      if (state.excelError) {
        _toast('Excel con errores', state.excelError, 'warning');
      }
    } else {
      state.data = [];
      state.fuente = 'vacio';
      state.conteos = { excel: 0, sqlite: 0, total: 0, pendientesExportar: 0 };
      console.warn('[7.1.1] Respuesta sin éxito');
    }
    populateCatalogos();
    render();
  }).catch(err => {
    console.error('[7.1.1] Error cargando:', err);
    state.data = [];
    state.fuente = 'vacio';
    render();
  });
}

/* ── Bindings ── */
function bindEvents() {
  /* Tabs */
  document.getElementById('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.kair-tab');
    if (!tab) return;
    document.querySelectorAll('.kair-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    state.filterTab = tab.getAttribute('data-filter');
    renderTable();
  });

  /* Filtros */
  document.getElementById('searchInput').addEventListener('input', e => {
    state.searchText = e.target.value;
    renderTable();
  });
  document.getElementById('filterTipo').addEventListener('change', e => {
    state.filterTipo = e.target.value;
    renderTable();
  });
  document.getElementById('filterFuente').addEventListener('change', e => {
    state.filterFuente = e.target.value;
    renderTable();
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    state.filterTab = 'TODAS';
    state.filterTipo = '';
    state.filterFuente = '';
    state.searchText = '';
    document.getElementById('searchInput').value = '';
    document.getElementById('filterTipo').value = '';
    document.getElementById('filterFuente').value = '';
    document.querySelectorAll('.kair-tab').forEach(t => t.classList.remove('is-active'));
    document.querySelector('.kair-tab[data-filter="TODAS"]').classList.add('is-active');
    renderTable();
    _toast('Filtros restablecidos', '', 'info');
  });

  /* Botones principales */
  document.getElementById('btn-new').addEventListener('click', () => openEditor(null));
  document.getElementById('btn-back').addEventListener('click', () => {
    /* Si el editor está abierto, cerrarlo. Si no, pedir al parent que vuelva al home del módulo. */
    if (!document.getElementById('editor-view').hidden) {
      closeEditor();
      _toast('Editor cerrado', 'Los cambios no guardados se perdieron.', 'warning');
    } else {
      try {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
      } catch (e) {
        console.warn('[7.1.1] No se pudo enviar mensaje al parent:', e);
      }
    }
  });

  /* F21.46: botones del header k-section-card — Importar / Exportar */
  document.getElementById('btn-importar').addEventListener('click', () => importarDesdeExcel());
  document.getElementById('btn-exportar').addEventListener('click', () => exportarAExcel());

  /* Breadcrumb (visible en modo edición) — clic en crumbs cierra el editor */
  document.querySelectorAll('#header-breadcrumb button[data-crumb]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!document.getElementById('editor-view').hidden) {
        closeEditor();
        _toast('Editor cerrado', '', 'info');
      }
    });
  });

  /* Tabla: click en fila = editar */
  document.getElementById('tableBody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.getAttribute('data-id');
    const btn = e.target.closest('button');
    if (btn) {
      const act = btn.getAttribute('data-act');
      if (act === 'del') {
        e.stopPropagation();
        deleteAccion(id);
        return;
      }
    }
    const a = state.data.find(x => x.id === id);
    if (a) openEditor(a);
  });

  /* Sidebar nav */
  document.getElementById('side-nav').addEventListener('click', e => {
    const btn = e.target.closest('.kair-side-nav__item');
    if (!btn) return;
    document.querySelectorAll('.kair-side-nav__item').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    const target = btn.getAttribute('data-section');
    /* Scroll a la sección */
    const sec = document.querySelector(`.kair-form-section[data-section-card="${target}"]`);
    if (sec) {
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      /* Asegurar que esté expandida */
      sec.classList.remove('is-collapsed');
    }
  });

  /* Secciones colapsables */
  document.querySelectorAll('.kair-form-section__head').forEach(h => {
    h.addEventListener('click', () => {
      const sec = h.closest('\.kair-form-section');
      sec.classList.toggle('is-collapsed');
    });
  });

  /* Botones del editor */
  document.getElementById('btn-cancelar').addEventListener('click', () => {
    /* Sin confirm() — cerramos directo. El toast avisa si hay cambios sin guardar. */
    closeEditor();
    _toast('Edición cancelada', '', 'info');
  });
  document.getElementById('btn-guardar').addEventListener('click', () => saveAccion(false));
  document.getElementById('btn-cerrar-accion').addEventListener('click', () => {
    /* Sin confirm() — ejecutamos directo. El usuario ya hizo clic en "Cerrar acción". */
    saveAccion(true);
  });

  /* Agregar actividad */
  document.getElementById('btn-add-actividad').addEventListener('click', () => {
    if (!state.editing.planAccion) state.editing.planAccion = [];
    state.editing.planAccion.push({ descripcion: '', fecha: '', responsable: '', costo: 0, realizada: false, verifico: '', fechaVerif: '' });
    renderPlanAccion();
  });

  /* Eliminar actividad */
  document.getElementById('plan-body').addEventListener('click', e => {
    const btn = e.target.closest('[data-plan-del]');
    if (!btn) return;
    const idx = parseInt(btn.getAttribute('data-plan-del'), 10);
    state.editing.planAccion.splice(idx, 1);
    renderPlanAccion();
  });

  /* Actualizar sidebar/banner en cada cambio de campo */
  document.getElementById('editor-view').addEventListener('input', e => {
    if (e.target.matches('[data-field]')) {
      collectFromForm();
      updateEditorSidebar();
      updateCompletitud();
    }
  });
  document.getElementById('editor-view').addEventListener('change', e => {
    if (e.target.matches('[data-field="estado"]')) {
      collectFromForm();
      updateBannerEstado();
      updateEditorSidebar();
      updateCompletitud();
    }
    if (e.target.matches('input[data-cierre-field="cerrada"]')) {
      collectFromForm();
      updateCompletitud();
    }
  });

  /* Escuchar mensajes del parent (iframe) */
  window.addEventListener('message', e => {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'refresh-acciones') cargarTodo();
  });
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  const headerCompany = document.getElementById('header-company-text');
  if (headerCompany) headerCompany.textContent = COMPANY;

  /* Header en modo lista por defecto */
  _setHeaderMode('list');

  bindEvents();
  cargarTodo();
});
