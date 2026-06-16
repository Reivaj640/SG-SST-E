/* ═══════════════════════════════════════════════════════════════════
   K+AIR · Módulo 7.1.2 — Acciones de Mejora — Alta Gerencia
   Viewer Logic
   ═══════════════════════════════════════════════════════════════════ */

const SUBMODULO = '7.1.2';
const COMPANY = new URLSearchParams(window.location.search).get('company') || 'Constructora ABC S.A.S';
const ORIGEN_OPTIONS = {
  'revision-direccion': 'Revisión de Dirección',
  'comite-sst': 'Comité SST',
  'evaluacion-sgsst': 'Evaluación del SG-SST'
};

const state = { editingId: null, deleteTarget: null, data: [] };

function syncStore() {
  if (window.MejoramientoStore) window.MejoramientoStore.update('712', state.data);
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function badge(cls, text) { return `<span class="k-badge ${cls}">${text}</span>`; }
function badgeEstado(e) { return badge(`k-badge--estado-${e}`, e.replace(/-/g, ' ')); }
function badgeRiesgo(r) { return badge(`k-badge--riesgo-${r}`, r); }
function badgePrioridad(p) { return badge(`k-badge--prioridad-${p}`, p); }
function getOrigenLabel(o) { return ORIGEN_OPTIONS[o] || o; }

function renderKpis() {
  const total = state.data.length;
  const pendientes = state.data.filter(d => d.estado === 'pendiente').length;
  const enProceso = state.data.filter(d => d.estado === 'en-proceso').length;
  const implementadas = state.data.filter(d => d.estado === 'implementada').length;
  const vencidas = state.data.filter(d => d.estado === 'vencida').length;
  const pct = total > 0 ? Math.round((implementadas / total) * 100) : 0;

  document.getElementById('kpiStrip').innerHTML = `
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon primary"><i class="bi bi-clipboard-check"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value">${total}</span>
        <span class="k-stats-ribbon__label">Total</span>
      </div>
      <span class="k-stats-ribbon__pct">${pct}%</span>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon warning"><i class="bi bi-clock-history"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value">${pendientes}</span>
        <span class="k-stats-ribbon__label">Pendientes</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon primary"><i class="bi bi-arrow-repeat"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value">${enProceso}</span>
        <span class="k-stats-ribbon__label">En Proceso</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon success"><i class="bi bi-check-circle"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value">${implementadas}</span>
        <span class="k-stats-ribbon__label">Implementadas</span>
      </div>
    </div>
    <div class="k-stats-ribbon__divider"></div>
    <div class="k-stats-ribbon__item">
      <span class="k-stats-ribbon__icon danger"><i class="bi bi-exclamation-triangle"></i></span>
      <div class="k-stats-ribbon__data">
        <span class="k-stats-ribbon__value">${vencidas}</span>
        <span class="k-stats-ribbon__label">Vencidas</span>
      </div>
    </div>
  `;
}

function getFiltered() {
  const text = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  return state.data.filter(d => {
    const matchText = !text || d.codigo.toLowerCase().includes(text) || d.descripcion.toLowerCase().includes(text) || d.responsable.toLowerCase().includes(text);
    const matchStatus = !status || d.estado === status;
    return matchText && matchStatus;
  });
}

function renderTable() {
  const rows = getFiltered();
  const tbody = document.getElementById('tableBody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="kair-empty"><i class="fas fa-clipboard-list"></i><div class="kair-empty__title">No se encontraron acciones</div><div class="kair-empty__desc">No hay acciones que coincidan con los filtros.</div></div></td></tr>`;
  } else {
    tbody.innerHTML = rows.map(d => `
      <tr>
        <td><strong>${d.codigo}</strong></td>
        <td>${getOrigenLabel(d.origen)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.descripcion}">${d.descripcion}</td>
        <td>${d.responsable}</td>
        <td>${badgeRiesgo(d.nivelRiesgo)}</td>
        <td>${badgePrioridad(d.prioridad)}</td>
        <td>${badgeEstado(d.estado)}</td>
        <td>${fmtDate(d.fechaCompromiso)}</td>
        <td><div class="kair-table-actions">
          <button class="k-btn k-btn--ghost k-btn--icon" onclick="openDetail('${d.id}')"><i class="fas fa-eye"></i></button>
          <button class="k-btn k-btn--ghost k-btn--icon" onclick="editAction('${d.id}')"><i class="fas fa-pen"></i></button>
          <button class="k-btn k-btn--danger-ghost k-btn--icon" onclick="deleteAction('${d.id}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`).join('');
  }
  document.getElementById('pagination').innerHTML = `<span>Mostrando ${rows.length} de ${state.data.length} registros</span><span>Página 1 de 1</span>`;
}

function openForm(accion) {
  state.editingId = accion ? accion.id : null;
  document.getElementById('formTitle').textContent = accion ? 'Editar Acción' : 'Nueva Acción';
  document.getElementById('formFields').innerHTML = `
    <div class="kair-form__group kair-form__group--full"><label>Descripción *</label><textarea id="fDescripcion" rows="2">${accion ? accion.descripcion : ''}</textarea></div>
    <div class="kair-form__group"><label>Hallazgo *</label><input type="text" id="fHallazgo" value="${accion ? accion.hallazgo : ''}"></div>
    <div class="kair-form__group"><label>Origen *</label><select id="fOrigen">${Object.entries(ORIGEN_OPTIONS).map(([k, v]) => `<option value="${k}" ${accion && accion.origen === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="kair-form__group"><label>Nivel de Riesgo *</label><select id="fRiesgo">${['alto', 'medio', 'bajo'].map(r => `<option value="${r}" ${accion && accion.nivelRiesgo === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="kair-form__group"><label>Prioridad *</label><select id="fPrioridad">${['critica', 'alta', 'media', 'baja'].map(p => `<option value="${p}" ${accion && accion.prioridad === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <div class="kair-form__group"><label>Responsable *</label><input type="text" id="fResponsable" value="${accion ? accion.responsable : ''}"></div>
    <div class="kair-form__group"><label>Área</label><input type="text" id="fArea" value="${accion ? accion.area : ''}"></div>
    <div class="kair-form__group"><label>Fecha de Hallazgo *</label><input type="date" id="fFechaHallazgo" value="${accion ? accion.fechaHallazgo : new Date().toISOString().split('T')[0]}"></div>
    <div class="kair-form__group"><label>Fecha Compromiso *</label><input type="date" id="fFechaCompromiso" value="${accion ? accion.fechaCompromiso : ''}"></div>
    <div class="kair-form__group kair-form__group--full"><label>Observaciones</label><textarea id="fObservaciones" rows="2">${accion ? (accion.observaciones || '') : ''}</textarea></div>`;
  document.getElementById('formOverlay').classList.add('kair-overlay--visible');
}

function closeForm() { document.getElementById('formOverlay').classList.remove('kair-overlay--visible'); state.editingId = null; }
function editAction(id) { const a = state.data.find(d => d.id === id); if (a) openForm(a); }

function submitForm() {
  const desc = document.getElementById('fDescripcion').value.trim();
  const hallazgo = document.getElementById('fHallazgo').value.trim();
  const responsable = document.getElementById('fResponsable').value.trim();
  const fechaCompromiso = document.getElementById('fFechaCompromiso').value;
  if (!desc || !hallazgo || !responsable || !fechaCompromiso) { showToast('Campos requeridos', 'Complete todos los campos obligatorios.', 'error'); return; }
  const now = new Date().toISOString().split('T')[0];
  if (state.editingId) {
    const a = state.data.find(d => d.id === state.editingId);
    if (a) { Object.assign(a, { descripcion: desc, hallazgo, origen: document.getElementById('fOrigen').value, nivelRiesgo: document.getElementById('fRiesgo').value, prioridad: document.getElementById('fPrioridad').value, responsable, area: document.getElementById('fArea').value, fechaHallazgo: document.getElementById('fFechaHallazgo').value, fechaCompromiso, observaciones: document.getElementById('fObservaciones').value, fechaActualizacion: now }); a.historial.push({ fecha: now, usuario: 'Sistema', accion: 'Actualización', detalle: 'Acción actualizada' }); }
    showToast('Acción actualizada', 'Cambios guardados.', 'success');
  } else {
    const newId = 'mg-' + Date.now();
    const codigo = 'MG-' + new Date().getFullYear() + '-' + String(state.data.length + 1).padStart(3, '0');
    state.data.unshift({ id: newId, codigo, submodulo: SUBMODULO, empresa: COMPANY, tipo: 'mejora', origen: document.getElementById('fOrigen').value, nivelRiesgo: document.getElementById('fRiesgo').value, prioridad: document.getElementById('fPrioridad').value, estado: 'pendiente', descripcion: desc, hallazgo, observaciones: document.getElementById('fObservaciones').value, responsable, area: document.getElementById('fArea').value, fechaHallazgo: document.getElementById('fFechaHallazgo').value, fechaCompromiso, fechaImplementacion: null, fechaVerificacion: null, fechaActualizacion: now, requisitoLegal: '', normaCircular: '', evidencia: '', resultadoVerificacion: '', historial: [{ fecha: now, usuario: 'Sistema', accion: 'Creación', detalle: 'Acción creada' }] });
    showToast('Acción creada', `Código: ${codigo}`, 'success');
  }
  closeForm(); renderKpis(); renderTable(); syncStore();
}

function openDetail(id) {
  const d = state.data.find(x => x.id === id);
  if (!d) return;
  document.getElementById('detailTitle').textContent = d.codigo;
  document.getElementById('detailBody').innerHTML = `
    <div class="kair-detail-section"><div class="kair-detail-section__title">Información General</div>
      <div class="kair-detail-row"><i class="fas fa-layer-group"></i><span class="kair-detail-row__label">Origen</span><span class="kair-detail-row__value">${getOrigenLabel(d.origen)}</span></div>
      <div class="kair-detail-row"><i class="fas fa-flag"></i><span class="kair-detail-row__label">Estado</span><span class="kair-detail-row__value">${badgeEstado(d.estado)}</span></div>
      <div class="kair-detail-row"><i class="fas fa-exclamation-triangle"></i><span class="kair-detail-row__label">Riesgo</span><span class="kair-detail-row__value">${badgeRiesgo(d.nivelRiesgo)}</span></div>
      <div class="kair-detail-row"><i class="fas fa-sort-amount-up"></i><span class="kair-detail-row__label">Prioridad</span><span class="kair-detail-row__value">${badgePrioridad(d.prioridad)}</span></div>
    </div>
    <div class="kair-detail-section"><div class="kair-detail-section__title">Descripción</div>
      <div class="kair-detail-row"><i class="fas fa-align-left"></i><span class="kair-detail-row__value">${d.descripcion}</span></div>
      <div class="kair-detail-row"><i class="fas fa-search"></i><span class="kair-detail-row__label">Hallazgo</span><span class="kair-detail-row__value">${d.hallazgo}</span></div>
      ${d.observaciones ? `<div class="kair-detail-row"><i class="fas fa-sticky-note"></i><span class="kair-detail-row__label">Observaciones</span><span class="kair-detail-row__value">${d.observaciones}</span></div>` : ''}
    </div>
    <div class="kair-detail-section"><div class="kair-detail-section__title">Responsabilidades</div>
      <div class="kair-detail-row"><i class="fas fa-user"></i><span class="kair-detail-row__label">Responsable</span><span class="kair-detail-row__value">${d.responsable}</span></div>
      <div class="kair-detail-row"><i class="fas fa-building"></i><span class="kair-detail-row__label">Área</span><span class="kair-detail-row__value">${d.area}</span></div>
    </div>
    <div class="kair-detail-section"><div class="kair-detail-section__title">Fechas</div>
      <div class="kair-detail-row"><i class="fas fa-calendar"></i><span class="kair-detail-row__label">Hallazgo</span><span class="kair-detail-row__value">${fmtDate(d.fechaHallazgo)}</span></div>
      <div class="kair-detail-row"><i class="fas fa-calendar-check"></i><span class="kair-detail-row__label">Compromiso</span><span class="kair-detail-row__value">${fmtDate(d.fechaCompromiso)}</span></div>
      ${d.fechaImplementacion ? `<div class="kair-detail-row"><i class="fas fa-check-circle"></i><span class="kair-detail-row__label">Implementación</span><span class="kair-detail-row__value">${fmtDate(d.fechaImplementacion)}</span></div>` : ''}
      ${d.fechaVerificacion ? `<div class="kair-detail-row"><i class="fas fa-clipboard-check"></i><span class="kair-detail-row__label">Verificación</span><span class="kair-detail-row__value">${fmtDate(d.fechaVerificacion)}</span></div>` : ''}
    </div>
    <div class="kair-detail-section"><div class="kair-detail-section__title">Historial</div>
      <div class="kair-timeline">${d.historial.map(h => `<div class="kair-timeline__item"><div class="kair-timeline__date">${fmtDate(h.fecha)}</div><div class="kair-timeline__text"><strong>${h.accion}</strong> — ${h.detalle}</div><div class="kair-timeline__user">${h.usuario}</div></div>`).join('')}</div>
    </div>`;
  const next = getNextStatus(d.estado);
  document.getElementById('detailFooter').innerHTML = `
    <button class="k-btn k-btn--ghost" onclick="closeDetail()">Cerrar</button>
    <button class="k-btn k-btn--primary" onclick="editFromDetail('${d.id}')"><i class="fas fa-pen"></i> Editar</button>
    ${next ? `<button class="k-btn k-btn--primary" style="background:var(--kair-success);border-color:var(--kair-success);" onclick="changeStatus('${d.id}','${next}')"><i class="fas fa-arrow-right"></i> Avanzar</button>` : ''}`;
  document.getElementById('detailOverlay').classList.add('kair-sheet-overlay--visible');
}

function closeDetail() { document.getElementById('detailOverlay').classList.remove('kair-sheet-overlay--visible'); }
function editFromDetail(id) { closeDetail(); setTimeout(() => editAction(id), 250); }
function getNextStatus(c) { return { pendiente: 'en-proceso', 'en-proceso': 'implementada', implementada: 'verificada', verificada: 'cerrada' }[c] || null; }

function changeStatus(id, ns) {
  const d = state.data.find(x => x.id === id);
  if (!d) return;
  const now = new Date().toISOString().split('T')[0];
  d.estado = ns;
  if (ns === 'implementada') d.fechaImplementacion = now;
  if (ns === 'verificada') d.fechaVerificacion = now;
  d.fechaActualizacion = now;
  d.historial.push({ fecha: now, usuario: 'Sistema', accion: 'Cambio de estado', detalle: `Estado cambiado a ${ns.replace(/-/g, ' ')}` });
  showToast('Estado actualizado', `Nuevo estado: ${ns.replace(/-/g, ' ')}`, 'success');
  closeDetail(); renderKpis(); renderTable(); syncStore();
}

function deleteAction(id) {
  state.deleteTarget = id;
  const d = state.data.find(x => x.id === id);
  document.getElementById('deleteDesc').textContent = `¿Eliminar acción "${d ? d.codigo : ''}"?`;
  document.getElementById('deleteOverlay').classList.add('kair-overlay--visible');
}

function closeDelete() { document.getElementById('deleteOverlay').classList.remove('kair-overlay--visible'); state.deleteTarget = null; }

function confirmDelete() {
  if (!state.deleteTarget) return;
  state.data = state.data.filter(d => d.id !== state.deleteTarget);
  showToast('Acción eliminada', 'Eliminada correctamente.', 'success');
  closeDelete(); renderKpis(); renderTable(); syncStore();
}

function showToast(title, desc, type) {
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-info-circle-fill';
  const toast = document.createElement('div');
  toast.className = `k-toast k-toast--${type}`;
  toast.innerHTML = `<i class="bi ${icon}"></i><div class="k-toast__text"><div class="k-toast__title">${title}</div><div class="k-toast__desc">${desc}</div></div>`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  const companyEl = document.getElementById('header-company-text');
  if (companyEl) companyEl.textContent = COMPANY;
  renderKpis();
  renderTable();
  syncStore();
});
