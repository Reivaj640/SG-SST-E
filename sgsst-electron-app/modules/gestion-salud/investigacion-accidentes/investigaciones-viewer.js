(function() {
'use strict';

var investigations = [];
var filteredInvestigations = [];
var currentFilter = 'todas';
var searchQuery = '';
var companyName = '';
var moduleName = '';
var submoduleName = '';
var xrefData = null;
var isGridView = false;
var searchDebounceTimer = null;
var toastIdCounter = 0;
var uploadQueue = [];

var MESES_ES = [
'Enero','Febrero','Marzo','Abril','Mayo','Junio',
'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

var STATUS_MAP = {
pendiente: 'pending',
completada: 'completed'
};

function mapEstado(estado) {
return STATUS_MAP[estado] || estado;
}

function callParentAPI(type, payload) {
return new Promise(function(resolve, reject) {
var requestId = 'req-' + Date.now() + '-' + Math.random();

function handleResponse(event) {
if (event.source !== window.parent) return;
var response = event.data;
if (response.type === (type + '-response') && response.requestId === requestId) {
window.removeEventListener('message', handleResponse);
if (response.payload && response.payload.success) {
resolve(response.payload);
} else {
var errMsg = (response.payload && response.payload.error) || 'Error desconocido';
reject(new Error(typeof errMsg === 'object' ? errMsg.message || JSON.stringify(errMsg) : errMsg));
}
}
}

window.addEventListener('message', handleResponse);

window.parent.postMessage({
type: type + '-request',
payload: payload,
requestId: requestId
}, '*');

setTimeout(function() {
window.removeEventListener('message', handleResponse);
reject(new Error('Timeout esperando respuesta para: ' + type));
}, 15000);
});
}

function getInitials(name) {
if (!name) return '?';
var parts = name.replace(/[_-]+/g, ' ').split(/\s+/).filter(function(p) { return p.length > 0; });
if (parts.length === 0) return '?';
if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getEstadoPriority(estado) {
if (estado === 'pendiente') return 0;
if (estado === 'completada') return 1;
return 2;
}

function getXrefMatchForInv(invNombre, invAno) {
if (!xrefData || !xrefData.matched) return null;
var normalizedName = invNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
return xrefData.matched.find(function(m) {
var mNorm = m.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
var nameMatch = mNorm === normalizedName || _isTokenOverlap(mNorm, normalizedName);
var yearMatch = (invAno != null && m.invYear != null) ? m.invYear === invAno : true;
return nameMatch && yearMatch;
}) || null;
}

function _isTokenOverlap(a, b) {
var tokensA = a.split(/\s+/).filter(function(t) { return t.length > 1; });
var tokensB = b.split(/\s+/).filter(function(t) { return t.length > 1; });
if (tokensA.length === 0 || tokensB.length === 0) return false;
var matchCount = tokensA.filter(function(tA) {
return tokensB.some(function(tB) { return tA === tB; });
}).length;
return matchCount / Math.min(tokensA.length, tokensB.length) >= 0.6;
}

function getUnmatchedXrefForInv(invNombre, invAno) {
if (!xrefData || !xrefData.unmatchedInvestigaciones) return null;
return xrefData.unmatchedInvestigaciones.find(function(u) {
var nameMatch = u.nombre && invNombre && u.nombre.toLowerCase() === invNombre.toLowerCase();
var yearMatch = (invAno != null && u.ano != null) ? u.ano === invAno : true;
return nameMatch && yearMatch;
}) || null;
}

function getYearMismatchForInv(invNombre) {
if (!xrefData || !xrefData.yearMismatchFurats) return null;
var normalizedName = invNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
return xrefData.yearMismatchFurats.find(function(m) {
var mNorm = m.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
return mNorm === normalizedName || _isTokenOverlap(mNorm, normalizedName);
}) || null;
}

document.addEventListener('DOMContentLoaded', function() {
var urlParams = new URLSearchParams(window.location.search);
companyName = urlParams.get('company') || '';
moduleName = urlParams.get('module') || '';
submoduleName = urlParams.get('submodule') || '';

console.log('[INV-MGR] Iniciando. Company:', companyName);

setupEventListeners();
loadAllData();
});

async function loadAllData() {
showLoading();
try {
var results = await Promise.allSettled([
loadStats(),
loadInvestigations(),
loadCrossReferenceData()
]);
results.forEach(function(r, i) {
if (r.status === 'rejected') {
console.warn('[INV-MGR] Error parcial (op ' + i + '):', r.reason);
}
});
} catch (error) {
console.error('[INV-MGR] Error catastrófico:', error);
renderEmpty('Error al cargar datos. Intente refrescar la página.');
} finally {
hideLoading();
}
}

async function loadStats() {
try {
var result = await callParentAPI('investigacion-accidentes-get-stats', { companyName: companyName });
if (result && result.data) {
document.getElementById('statTotal').textContent = result.data.total;
document.getElementById('statPendientes').textContent = result.data.pendientes;
document.getElementById('statCompletadas').textContent = result.data.completadas;
}
} catch (error) {
console.warn('[INV-MGR] No se pudieron cargar estadísticas:', error.message);
}
}

async function loadInvestigations() {
try {
var result = await callParentAPI('investigacion-accidentes-list-investigations', {
companyName: companyName,
filter: 'todas'
});
if (result && result.data) {
investigations = result.data;
} else {
investigations = [];
}
applyFilters();
} catch (error) {
console.error('[INV-MGR] Error cargando investigaciones:', error.message);
investigations = [];
applyFilters();
}
}

async function loadCrossReferenceData() {
try {
var result = await callParentAPI('investigacion-accidentes-cross-reference-data', { companyName: companyName });
if (result && result.data) {
xrefData = result.data;
renderXrefPanel(xrefData);
}
} catch (error) {
console.error('[INV-MGR] Error cargando xref:', error.message);
showToast('Error', 'No se pudieron cargar los datos de referencia cruzada.', 'error');
}
}

function updateStats() {
var pendientes = investigations.filter(function(i) { return i.estado === 'pendiente'; }).length;
var completadas = investigations.filter(function(i) { return i.estado === 'completada'; }).length;
document.getElementById('statTotal').textContent = investigations.length;
document.getElementById('statPendientes').textContent = pendientes;
document.getElementById('statCompletadas').textContent = completadas;
updateFilterCounts();
}

function updateFilterCounts() {
var counts = { todas: investigations.length, pendiente: 0, completada: 0 };
investigations.forEach(function(inv) {
if (inv.estado === 'pendiente') counts.pendiente++;
else if (inv.estado === 'completada') counts.completada++;
});

document.querySelectorAll('.inv-filter-btn[data-filter]').forEach(function(btn) {
var filter = btn.dataset.filter;
var count = counts[filter];
if (count !== undefined) {
var existingBadge = btn.querySelector('.inv-filter-count');
if (existingBadge) existingBadge.remove();
if (filter !== 'todas') {
var badge = document.createElement('span');
badge.className = 'inv-filter-count';
badge.textContent = count;
btn.appendChild(badge);
}
}
});
}

function applyFilters() {
filteredInvestigations = investigations.filter(function(inv) {
if (currentFilter !== 'todas' && inv.estado !== currentFilter) {
return false;
}
if (searchQuery) {
var query = searchQuery.toLowerCase();
var matchName = inv.nombre.toLowerCase().includes(query);
var matchFiles = inv.archivos && inv.archivos.some(function(f) {
return f.name.toLowerCase().includes(query);
});
return matchName || matchFiles;
}
return true;
});
renderInvestigations(filteredInvestigations);
updateStats();
}

function renderInvestigations(items) {
var container = document.getElementById('investigationsList');

if (isGridView) {
container.classList.add('inv-cards-grid');
} else {
container.classList.remove('inv-cards-grid');
}

if (!items || items.length === 0) {
var message = searchQuery
? 'No se encontraron investigaciones que coincidan con la búsqueda.'
: currentFilter !== 'todas'
? 'No hay investigaciones ' + getEstadoLabel(currentFilter, true) + '.'
: 'No hay investigaciones registradas.';
renderEmpty(message);
return;
}

var sortedItems = items.slice().sort(function(a, b) {
return getEstadoPriority(a.estado) - getEstadoPriority(b.estado);
});

var html = '';
sortedItems.forEach(function(inv, index) {
html += renderCard(inv, index);
});

container.innerHTML = html;
}

function renderCard(inv, index) {
var cssEstado = mapEstado(inv.estado);
var statusIcon, statusText, actionBtnClass, actionBtnText, actionBtnIcon;

if (inv.estado === 'pendiente') {
statusIcon = 'fa-clock';
statusText = 'Pendiente';
actionBtnClass = 'inv-card__action-btn--start';
actionBtnText = 'Iniciar Investigación';
actionBtnIcon = 'fa-search-plus';
} else if (inv.estado === 'completada') {
statusIcon = 'fa-check-circle';
statusText = 'Completada';
actionBtnClass = 'inv-card__action-btn--view';
actionBtnText = 'Ver Investigación';
actionBtnIcon = 'fa-eye';
} else {
statusIcon = 'fa-question-circle';
statusText = inv.estado;
actionBtnClass = '';
actionBtnText = '';
actionBtnIcon = '';
}

var fecha = inv.fecha ? formatDate(inv.fecha) : 'N/A';
var totalArchivos = inv.totalArchivos || (inv.archivos ? inv.archivos.length : 0);
var delay = (index * 0.05).toFixed(2);
var initials = getInitials(inv.nombre);
var avatarClass = 'inv-card__avatar--' + cssEstado;
var xrefMatch = getXrefMatchForInv(inv.nombre, inv.ano);
var xrefUnmatched = !xrefMatch ? getUnmatchedXrefForInv(inv.nombre, inv.ano) : null;
var xrefMismatch = !xrefMatch && !xrefUnmatched ? getYearMismatchForInv(inv.nombre) : null;

var actionBtnHtml = '';
if (inv.estado === 'pendiente') {
var furatFile = (inv.archivos || []).find(function(f) {
return f.name.toUpperCase().includes('FURAT') && (f.extension || '').toLowerCase() === 'pdf';
});
if (!furatFile) {
furatFile = (inv.archivos || []).find(function(f) {
return (f.extension || '').toLowerCase() === 'pdf';
});
}
var furatPath = furatFile ? furatFile.path : '';
actionBtnHtml = '<button class="inv-card__action-btn ' + actionBtnClass + '"'
+ ' data-invnombre="' + escapeHtml(inv.nombre) + '"'
+ ' data-furatpath="' + escapeHtml(furatPath) + '"'
+ ' onclick="event.stopPropagation(); window._startInvestigation(this.dataset.invnombre, this.dataset.furatpath)"'
+ '><i class="fas ' + actionBtnIcon + '"></i> ' + actionBtnText + '</button>';
} else if (inv.estado === 'completada') {
var informeCompl = (inv.archivos || []).find(function(f) {
return f.name.toUpperCase().includes('GI-FO-020') || f.name.toUpperCase().includes('INFORMEATE') || f.name.toUpperCase().includes('INFORMEAT ');
});
if (informeCompl) {
actionBtnHtml = '<button class="inv-card__action-btn ' + actionBtnClass + '"'
+ ' data-filepath="' + escapeHtml(informeCompl.path) + '"'
+ ' data-filename="' + escapeHtml(informeCompl.name) + '"'
+ ' data-ext="' + escapeHtml(informeCompl.extension || '') + '"'
+ ' onclick="event.stopPropagation(); window._previewFile(this.dataset.filepath, this.dataset.filename, this.dataset.ext)"'
+ '><i class="fas ' + actionBtnIcon + '"></i> ' + actionBtnText + '</button>';
} else {
actionBtnHtml = '<button class="inv-card__action-btn ' + actionBtnClass + '"'
+ ' data-invnombre="' + escapeHtml(inv.nombre) + '"'
+ ' onclick="event.stopPropagation(); window._startInvestigation(this.dataset.invnombre, \'\')"'
+ '><i class="fas ' + actionBtnIcon + '"></i> ' + actionBtnText + '</button>';
}
}

var html = '';
html += '<div class="inv-card inv-card--' + cssEstado + '" data-id="' + escapeHtml(inv.id) + '" style="animation-delay: ' + delay + 's">';

html += ' <div class="inv-card__main">';
html += '  <div class="inv-card__furat">';
html += '   <div class="inv-card__avatar ' + avatarClass + '" title="' + escapeHtml(inv.nombre) + '">';
html += '    <span class="inv-card__avatar-text">' + escapeHtml(initials) + '</span>';
if (inv.estado === 'pendiente') {
html += '    <span class="inv-card__avatar-pulse"></span>';
}
html += '   </div>';
html += '   <div class="inv-card__person-row">';
html += '    <div class="inv-card__name" title="' + escapeHtml(inv.nombre) + '">' + escapeHtml(inv.nombre) + '</div>';
html += '    <div class="inv-card__type">FURAT — Accidente de Trabajo</div>';
html += '    <div class="inv-card__details">';
html += '     <div class="inv-card__detail-item">';
html += '      <span class="inv-card__detail-label">Fecha</span>';
html += '      <span class="inv-card__detail-value"><i class="fas fa-calendar-alt"></i> ' + fecha + '</span>';
html += '     </div>';
html += '     <div class="inv-card__detail-item">';
html += '      <span class="inv-card__detail-label">Archivos</span>';
html += '      <span class="inv-card__detail-value"><i class="fas fa-file-alt"></i> ' + totalArchivos + ' archivo' + (totalArchivos !== 1 ? 's' : '') + '</span>';
html += '     </div>';
html += '     <div class="inv-card__detail-item">';
html += '      <span class="inv-card__detail-label">Estado</span>';
html += '      <span class="inv-card__detail-value"><span class="inv-status-dot inv-status-dot--' + cssEstado + '"></span> ' + statusText + '</span>';
html += '     </div>';
html += '    </div>';
html += '   </div>';
html += '  </div>';

html += '  <div class="inv-card__status-col">';
html += '   <span class="inv-card__status-badge inv-card__status-badge--' + cssEstado + '">';
html += '    <i class="fas ' + statusIcon + '"></i> ' + statusText;
html += '   </span>';
html += actionBtnHtml;
html += '  </div>';

html += ' </div>';

if (xrefMatch || xrefMismatch || xrefUnmatched) {
html += renderCardXref(inv, xrefMatch, xrefMismatch, xrefUnmatched, cssEstado);
}

var hasFiles = inv.archivos && inv.archivos.length > 0;
html += ' <button class="inv-card__expand-toggle" onclick="window._toggleCardExpand(this)">';
html += '  <i class="fas fa-chevron-down"></i> ';
html += '  <span>' + (hasFiles ? totalArchivos + ' archivo' + (totalArchivos !== 1 ? 's' : '') : 'Sin archivos') + '</span>';
html += ' </button>';

html += ' <div class="inv-card__expanded">';
html += '  <div class="inv-card__files-title">Archivos</div>';
html += renderFileList(inv.archivos || [], cssEstado);
html += ' </div>';

html += '</div>';

return html;
}

function renderCardXref(inv, xrefMatch, xrefMismatch, xrefUnmatched, cssEstado) {
var html = '';

if (xrefMatch) {
var matchTypeClass = xrefMatch.matchType === 'partial' ? 'partial' : '';
var matchBadge = '';
if (xrefMatch.matchType === 'exact') {
matchBadge = ' <span class="inv-xref-match-type inv-xref-match-type--exact">Exacto</span>';
} else if (xrefMatch.matchType === 'partial') {
matchBadge = ' <span class="inv-xref-match-type inv-xref-match-type--partial">Mes diferente</span>';
}

html += '<div class="inv-card__xref' + (matchTypeClass ? ' inv-card__xref--' + matchTypeClass : '') + '">';
html += ' <div class="inv-card__xref-title"><i class="fas fa-exchange-alt"></i> Referencia Cruzada' + matchBadge + '</div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--furat">3.2.1 FURAT</span>';
html += '  <span class="inv-card__xref-row-path" title="' + escapeHtml(xrefMatch.furatPath) + '">' + escapeHtml(truncatePath(xrefMatch.furatPath)) + '</span>';
if (xrefMatch.furatYear) {
html += '  <span class="inv-xref-year-badge">' + xrefMatch.furatYear + (xrefMatch.furatMonth ? '/' + xrefMatch.furatMonth.name : '') + '</span>';
}
html += '  <span class="inv-card__xref-row-status"><i class="fas fa-check-circle" style="color: var(--inv-success);"></i></span>';
html += ' </div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--inv">3.2.2 Investigación</span>';
html += '  <span class="inv-card__xref-row-path" title="' + escapeHtml(xrefMatch.investigacionPath) + '">' + escapeHtml(truncatePath(xrefMatch.investigacionPath)) + '</span>';
if (xrefMatch.invYear) {
html += '  <span class="inv-xref-year-badge">' + xrefMatch.invYear + (xrefMatch.invMonth ? '/' + xrefMatch.invMonth.name : '') + '</span>';
}
var invStatusIcon = cssEstado === 'completed' ? 'fa-check-circle' : cssEstado === 'process' ? 'fa-spinner' : 'fa-clock';
var invStatusColor = cssEstado === 'completed' ? 'var(--inv-success)' : cssEstado === 'process' ? '#1565c0' : '#856404';
html += '  <span class="inv-card__xref-row-status"><i class="fas ' + invStatusIcon + '" style="color: ' + invStatusColor + ';"></i></span>';
html += ' </div>';

html += '</div>';
} else if (xrefMismatch) {
html += '<div class="inv-card__xref inv-card__xref--mismatch">';
html += ' <div class="inv-card__xref-title"><i class="fas fa-exclamation-triangle"></i> Referencia Cruzada — Año Diferente</div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--furat">3.2.1 FURAT</span>';
html += '  <span class="inv-card__xref-row-path" title="' + escapeHtml(xrefMismatch.furatPath) + '">' + escapeHtml(truncatePath(xrefMismatch.furatPath)) + '</span>';
if (xrefMismatch.furatYear) {
html += '  <span class="inv-xref-year-badge inv-xref-year-badge--mismatch">' + xrefMismatch.furatYear + (xrefMismatch.furatMonth ? '/' + xrefMismatch.furatMonth.name : '') + '</span>';
}
html += '  <span class="inv-card__xref-row-status"><i class="fas fa-exclamation-triangle" style="color: #e65100;"></i></span>';
html += ' </div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--inv">3.2.2 Investigación</span>';
var existingInv = xrefMismatch.existingInvPaths && xrefMismatch.existingInvPaths[0];
if (existingInv) {
html += '  <span class="inv-card__xref-row-path" title="' + escapeHtml(existingInv.investigacionPath) + '">' + escapeHtml(truncatePath(existingInv.investigacionPath)) + '</span>';
if (existingInv.invYear) {
html += '  <span class="inv-xref-year-badge inv-xref-year-badge--mismatch">' + existingInv.invYear + (existingInv.invMonth ? '/' + existingInv.invMonth.name : '') + '</span>';
}
} else {
html += '  <span class="inv-card__xref-row-path">—</span>';
}
html += '  <span class="inv-card__xref-row-status"><i class="fas fa-exclamation-triangle" style="color: #e65100;"></i></span>';
html += ' </div>';

html += '</div>';
} else if (xrefUnmatched) {
html += '<div class="inv-card__xref inv-card__xref--unmatched">';
html += ' <div class="inv-card__xref-title"><i class="fas fa-unlink"></i> Sin FURAT en 3.2.1</div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--furat">3.2.1 FURAT</span>';
html += '  <span class="inv-card__xref-row-path" style="color: var(--inv-text-muted); font-style: italic;">No encontrado</span>';
html += '  <span class="inv-card__xref-row-status"><i class="fas fa-unlink" style="color: var(--inv-danger);"></i></span>';
html += ' </div>';

html += ' <div class="inv-card__xref-row">';
html += '  <span class="inv-card__xref-row-label inv-card__xref-row-label--inv">3.2.2 Investigación</span>';
html += '  <span class="inv-card__xref-row-path" title="' + escapeHtml(xrefUnmatched.investigacionPath) + '">' + escapeHtml(truncatePath(xrefUnmatched.investigacionPath)) + '</span>';
var invStatusIcon2 = cssEstado === 'completed' ? 'fa-check-circle' : cssEstado === 'process' ? 'fa-spinner' : 'fa-clock';
var invStatusColor2 = cssEstado === 'completed' ? 'var(--inv-success)' : cssEstado === 'process' ? '#1565c0' : '#856404';
html += '  <span class="inv-card__xref-row-status"><i class="fas ' + invStatusIcon2 + '" style="color: ' + invStatusColor2 + ';"></i></span>';
html += ' </div>';

html += '</div>';
}

return html;
}

function renderXrefPanel(data) {
document.getElementById('xrefFuratCount').textContent = data.furatCount || 0;
document.getElementById('xrefMatchedCount').textContent = data.matchedCount || 0;
document.getElementById('xrefUnmatchedCount').textContent = (data.unmatchedFurats || []).length;
var mismatchCountEl = document.getElementById('xrefMismatchCount');
if (mismatchCountEl) mismatchCountEl.textContent = data.yearMismatchCount || 0;

var listContainer = document.getElementById('xrefList');
var html = '';

(data.unmatchedFurats || []).forEach(function(item) {
html += '<div class="inv-xref-item">';
html += ' <div class="inv-xref-item-icon unmatched"><i class="fas fa-unlink"></i></div>';
html += ' <div class="inv-xref-item-info">';
html += '  <div class="inv-xref-item-name">' + escapeHtml(item.nombre) + '</div>';
html += '  <div class="inv-xref-item-paths">FURAT: ' + escapeHtml(item.furatPath) + (item.furatYear ? ' (' + item.furatYear + ')' : '') + '</div>';
html += ' </div>';
html += ' <div class="inv-xref-item-status">';
html += '  <span class="inv-card__status-badge inv-card__status-badge--pending"><i class="fas fa-exclamation-circle"></i> Sin Investigación</span>';
html += ' </div>';
html += '</div>';
});

(data.yearMismatchFurats || []).forEach(function(item) {
html += '<div class="inv-xref-item inv-xref-item--mismatch">';
html += ' <div class="inv-xref-item-icon mismatch"><i class="fas fa-exclamation-triangle"></i></div>';
html += ' <div class="inv-xref-item-info">';
html += '  <div class="inv-xref-item-name">' + escapeHtml(item.nombre) + '</div>';
html += '  <div class="inv-xref-item-paths">FURAT: ' + escapeHtml(item.furatPath) + (item.furatYear ? ' (' + item.furatYear + ')' : '') + ' → Investigación en año diferente</div>';
html += ' </div>';
html += ' <div class="inv-xref-item-status">';
html += '  <span style="color: #e65100; font-size: 0.75rem; font-weight: 500; background: rgba(230,81,0,0.1); padding: 0.125rem 0.5rem; border-radius: 9999px;"><i class="fas fa-exclamation-triangle"></i> Año Diferente</span>';
html += ' </div>';
html += '</div>';
});

(data.matched || []).forEach(function(item) {
  var cssEstado = mapEstado(item.estado || 'pendiente');
  var statusIcon, statusText;
  if (cssEstado === 'pending') { statusIcon = 'fa-clock'; statusText = 'Pendiente'; }
  else if (cssEstado === 'completed') { statusIcon = 'fa-check-circle'; statusText = 'Completada'; }
  else { statusIcon = 'fa-question-circle'; statusText = item.estado; }

var matchTypeBadge = '';
if (item.matchType === 'exact') {
matchTypeBadge = ' <span class="inv-xref-match-type inv-xref-match-type--exact">Exacto</span>';
} else if (item.matchType === 'partial') {
matchTypeBadge = ' <span class="inv-xref-match-type inv-xref-match-type--partial">Mes diferente</span>';
}

html += '<div class="inv-xref-item' + (item.matchType === 'partial' ? ' inv-xref-item--partial' : '') + '">';
html += ' <div class="inv-xref-item-icon matched"><i class="fas fa-link"></i></div>';
html += ' <div class="inv-xref-item-info">';
html += '  <div class="inv-xref-item-name">' + escapeHtml(item.nombre) + matchTypeBadge + '</div>';
html += '  <div class="inv-xref-item-paths">3.2.1: ' + escapeHtml(item.furatPath) + (item.furatYear ? ' (' + item.furatYear + ')' : '') + ' → 3.2.2: ' + escapeHtml(item.investigacionPath) + (item.invYear ? ' (' + item.invYear + ')' : '') + '</div>';
html += ' </div>';
html += ' <div class="inv-xref-item-status">';
html += '  <span class="inv-card__status-badge inv-card__status-badge--' + cssEstado + '"><i class="fas ' + statusIcon + '"></i> ' + statusText + '</span>';
html += ' </div>';
html += '</div>';
});

if (!html) {
html = '<div class="inv-empty" style="padding:1.5rem;"><p style="font-size:0.875rem;color:var(--inv-text-muted);">No se encontraron datos de referencia cruzada.</p></div>';
}

listContainer.innerHTML = html;
}

function renderFileList(files, cssEstado) {
if (!files || files.length === 0) {
return '<p style="font-size: 0.8125rem; color: var(--inv-text-muted); padding: 0.5rem 0;">Sin archivos</p>';
}

var html = '';
files.forEach(function(file) {
var icon = getFileIcon(file.extension);
var size = file.size ? formatFileSize(file.size) : '';
var isReport = isReportFile(file.name);

html += '<div class="inv-file-item">';
html += ' <i class="fas ' + icon + '"></i>';
html += ' <span class="inv-file-name" title="' + escapeHtml(file.name) + '">' + escapeHtml(file.name) + '</span>';
if (size) html += ' <span class="inv-file-size">' + size + '</span>';
if (isReport) html += ' <span class="inv-report-badge"><i class="fas fa-check-circle"></i> Informe</span>';
html += ' <div class="inv-file-actions">';
html += '  <button class="inv-file-action-btn"'
+ ' data-filepath="' + escapeHtml(file.path) + '"'
+ ' data-filename="' + escapeHtml(file.name) + '"'
+ ' data-ext="' + escapeHtml(file.extension || '') + '"'
+ ' onclick="event.stopPropagation(); window._previewFile(this.dataset.filepath, this.dataset.filename, this.dataset.ext)"'
+ ' title="Previsualizar">';
html += '   <i class="fas fa-eye"></i>';
html += '  </button>';
html += ' </div>';
html += '</div>';
});

return html;
}

function renderEmpty(message) {
var container = document.getElementById('investigationsList');
container.innerHTML = '<div class="inv-empty">'
+ '<div class="inv-empty__icon"><i class="fas fa-inbox"></i></div>'
+ '<h3>Sin investigaciones</h3>'
+ '<p>' + message + '</p>'
+ '</div>';
}

function showLoading() {
var container = document.getElementById('investigationsList');
container.innerHTML = '<div class="inv-loading"><div class="inv-spinner"></div><p>Cargando investigaciones...</p></div>';
}

function hideLoading() {}

function getEstadoLabel(estado, plural) {
var labels = {
pendiente: plural ? 'pendientes' : 'Pendiente',
completada: plural ? 'completadas' : 'Completada'
};
return labels[estado] || estado;
}

function setupEventListeners() {
document.getElementById('backBtn').addEventListener('click', function() {
window.parent.postMessage({ type: 'back-to-module-request' }, '*');
});

document.getElementById('refreshBtn').addEventListener('click', function() {
var icon = document.getElementById('refreshIcon');
icon.classList.add('fa-spin');
document.getElementById('investigationsList').innerHTML = '<div class="inv-loading"><div class="inv-spinner"></div><p>Actualizando...</p></div>';
xrefData = null;
loadAllData().then(function() {
icon.classList.remove('fa-spin');
showToast('Actualizado', 'La lista ha sido actualizada.', 'info');
var xrefPanel = document.getElementById('xrefPanel');
if (xrefPanel.classList.contains('visible')) {
loadCrossReferenceData();
}
}).catch(function() {
icon.classList.remove('fa-spin');
showToast('Error', 'No se pudo actualizar la lista.', 'error');
});
});

document.querySelectorAll('.inv-filter-btn[data-filter]').forEach(function(btn) {
btn.addEventListener('click', function() {
document.querySelectorAll('.inv-filter-btn[data-filter]').forEach(function(b) { b.classList.remove('active'); });
this.classList.add('active');
currentFilter = this.dataset.filter;
applyFilters();
});
});

document.getElementById('xrefToggleBtn').addEventListener('click', function() {
var xrefPanel = document.getElementById('xrefPanel');
if (!xrefPanel.classList.contains('visible')) {
xrefPanel.classList.remove('hidden');
xrefPanel.classList.add('visible');
if (!xrefData) {
loadCrossReferenceData();
}
} else {
xrefPanel.classList.toggle('expanded');
}
});

document.getElementById('xrefCloseBtn').addEventListener('click', function() {
var xrefPanel = document.getElementById('xrefPanel');
xrefPanel.classList.remove('visible', 'expanded');
document.getElementById('xrefToggleBtn').style.display = '';
});

document.getElementById('viewToggleBtn').addEventListener('click', function() {
isGridView = !isGridView;
var icon = document.getElementById('viewToggleIcon');
if (isGridView) {
icon.className = 'fas fa-list';
} else {
icon.className = 'fas fa-th-large';
}
applyFilters();
});

var searchInput = document.getElementById('searchInput');
var clearSearchBtn = document.getElementById('clearSearchBtn');

searchInput.addEventListener('input', function() {
var val = this.value.trim();
clearSearchBtn.classList.toggle('hidden', !val);
if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
searchDebounceTimer = setTimeout(function() {
searchQuery = val;
applyFilters();
}, 300);
});

clearSearchBtn.addEventListener('click', function() {
searchInput.value = '';
searchQuery = '';
this.classList.add('hidden');
searchInput.focus();
applyFilters();
});

document.getElementById('uploadFab').addEventListener('click', function() {
openUploadModal();
});

document.getElementById('closeUploadBtn').addEventListener('click', closeUploadModal);
document.getElementById('uploadCancelBtn').addEventListener('click', closeUploadModal);
document.getElementById('uploadOverlay').addEventListener('click', function(e) {
if (e.target === this) closeUploadModal();
});

document.getElementById('uploadSaveBtn').addEventListener('click', processUploadQueue);

var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');

dropZone.addEventListener('click', function() {
fileInput.click();
});

fileInput.addEventListener('change', function() {
if (this.files && this.files.length > 0) {
addToUploadQueue(this.files[0]);
this.value = '';
}
});

dropZone.addEventListener('dragover', function(e) {
e.preventDefault();
e.stopPropagation();
this.classList.add('dragover');
});

dropZone.addEventListener('dragleave', function(e) {
e.preventDefault();
e.stopPropagation();
this.classList.remove('dragover');
});

dropZone.addEventListener('drop', function(e) {
e.preventDefault();
e.stopPropagation();
this.classList.remove('dragover');
if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
addToUploadQueue(e.dataTransfer.files[0]);
}
});

document.getElementById('closePreviewBtn').addEventListener('click', closePreview);
document.getElementById('previewCloseBtn').addEventListener('click', closePreview);
document.getElementById('previewOverlay').addEventListener('click', function(e) {
if (e.target === this) closePreview();
});

document.getElementById('previewStartBtn').addEventListener('click', function() {
var invNombre = this.dataset.invnombre || '';
var furatPath = this.dataset.furatpath || '';
window._startInvestigation(invNombre, furatPath);
closePreview();
});
}

function openUploadModal() {
uploadQueue = [];
renderUploadQueue();
document.getElementById('uploadSaveBtn').disabled = true;
document.getElementById('uploadProgress').classList.add('hidden');
document.getElementById('uploadSuccess').classList.add('hidden');
document.getElementById('dropZone').classList.remove('has-file');
document.getElementById('uploadOverlay').classList.remove('hidden');
}

function closeUploadModal() {
document.getElementById('uploadOverlay').classList.add('hidden');
uploadQueue = [];
}

function addToUploadQueue(file) {
if (!file.name.toLowerCase().endsWith('.pdf')) {
showToast('Error', 'Solo se permiten archivos PDF para FURATs.', 'error');
return;
}
if (file.size > 50 * 1024 * 1024) {
showToast('Error', 'El archivo es demasiado grande. Máximo 50MB.', 'error');
return;
}

uploadQueue.push({
file: file,
name: file.name,
size: file.size
});

renderUploadQueue();
document.getElementById('uploadSaveBtn').disabled = false;
document.getElementById('dropZone').classList.add('has-file');
}

function removeFromUploadQueue(index) {
uploadQueue.splice(index, 1);
renderUploadQueue();
document.getElementById('uploadSaveBtn').disabled = uploadQueue.length === 0;
if (uploadQueue.length === 0) {
document.getElementById('dropZone').classList.remove('has-file');
}
}

function renderUploadQueue() {
var container = document.getElementById('uploadQueue');
if (uploadQueue.length === 0) {
container.innerHTML = '';
return;
}

var html = '';
uploadQueue.forEach(function(item, idx) {
html += '<div class="inv-upload-queue-item">';
html += ' <i class="fas fa-file-pdf inv-upload-queue-item__icon"></i>';
html += ' <span class="inv-upload-queue-item__name">' + escapeHtml(item.name) + '</span>';
html += ' <span class="inv-upload-queue-item__size">' + formatFileSize(item.size) + '</span>';
html += ' <button class="inv-upload-queue-item__remove" onclick="window._removeFromQueue(' + idx + ')" title="Eliminar"><i class="fas fa-times"></i></button>';
html += '</div>';
});

container.innerHTML = html;
}

async function processUploadQueue() {
if (uploadQueue.length === 0) return;

var saveBtn = document.getElementById('uploadSaveBtn');
saveBtn.disabled = true;
var uploadProgress = document.getElementById('uploadProgress');
var progressFill = document.getElementById('uploadProgressFill');
var progressText = document.getElementById('uploadProgressText');

uploadProgress.classList.remove('hidden');
progressFill.style.width = '0%';
progressFill.classList.add('indeterminate');
progressText.textContent = 'Guardando ' + uploadQueue.length + ' archivo' + (uploadQueue.length !== 1 ? 's' : '') + '...';

try {
for (var i = 0; i < uploadQueue.length; i++) {
var item = uploadQueue[i];
var arrayBuffer = await item.file.arrayBuffer();
var uint8Array = new Uint8Array(arrayBuffer);

var result = await callParentAPI('investigacion-accidentes-save-temp-pdf-file', {
filename: item.name,
data: Array.from(uint8Array)
});

if (!result || !result.success) {
throw new Error((result && result.error) || 'Error al guardar ' + item.name);
}

var pct = Math.round(((i + 1) / uploadQueue.length) * 100);
progressFill.classList.remove('indeterminate');
progressFill.style.width = pct + '%';
progressText.textContent = 'Guardado ' + (i + 1) + ' de ' + uploadQueue.length + '...';
}

progressFill.style.width = '100%';
progressText.textContent = '¡Todos los FURATs guardados exitosamente!';

var uploadSuccess = document.getElementById('uploadSuccess');
document.getElementById('uploadSuccessText').textContent = uploadQueue.length + ' archivo' + (uploadQueue.length !== 1 ? 's' : '') + ' guardado' + (uploadQueue.length !== 1 ? 's' : '') + ' correctamente.';
uploadSuccess.classList.remove('hidden');

showToast('FURAT Guardado', uploadQueue.length + ' archivo' + (uploadQueue.length !== 1 ? 's' : '') + ' guardado' + (uploadQueue.length !== 1 ? 's' : '') + ' correctamente.', 'success');

setTimeout(function() {
closeUploadModal();
loadAllData();
}, 2000);
} catch (error) {
console.error('[INV-MGR] Error al subir FURAT:', error);
showToast('Error al guardar', error.message, 'error');
uploadProgress.classList.add('hidden');
document.getElementById('dropZone').classList.remove('has-file');
saveBtn.disabled = false;
}
}

window._toggleCardExpand = function(btnEl) {
var card = btnEl.closest('.inv-card');
if (!card) return;
card.classList.toggle('expanded');
var span = btnEl.querySelector('span');
if (card.classList.contains('expanded')) {
span.textContent = span.textContent.replace(/archivo/, 'Ocultar');
} else {
var invId = card.dataset.id;
var inv = investigations.find(function(i) { return i.id === invId; });
var total = inv ? (inv.totalArchivos || (inv.archivos ? inv.archivos.length : 0)) : 0;
span.textContent = total + ' archivo' + (total !== 1 ? 's' : '');
}
};

window._removeFromQueue = function(index) {
removeFromUploadQueue(index);
};

window._previewFile = async function(filePath, fileName, extension) {
var overlay = document.getElementById('previewOverlay');
var title = document.getElementById('previewTitle');
var fieldGrid = document.getElementById('previewFieldGrid');
var iframeContainer = document.getElementById('previewIframeContainer');
var startBtn = document.getElementById('previewStartBtn');

overlay.classList.remove('hidden');
title.textContent = fileName || 'Previsualización';
fieldGrid.innerHTML = '';
iframeContainer.innerHTML = '';
startBtn.style.display = 'none';

var inv = investigations.find(function(i) {
return (i.archivos || []).some(function(f) { return f.path === filePath; });
});

if (inv) {
var cssEstado = mapEstado(inv.estado);
var statusText = getEstadoLabel(inv.estado, false);
var fecha = inv.fecha ? formatDate(inv.fecha) : 'N/A';
var totalArchivos = inv.totalArchivos || (inv.archivos ? inv.archivos.length : 0);

fieldGrid.innerHTML =
'<div class="inv-preview-field"><span class="inv-preview-field__label">Trabajador</span><span class="inv-preview-field__value">' + escapeHtml(inv.nombre) + '</span></div>'
+ '<div class="inv-preview-field"><span class="inv-preview-field__label">Tipo</span><span class="inv-preview-field__value">FURAT — Accidente de Trabajo</span></div>'
+ '<div class="inv-preview-field"><span class="inv-preview-field__label">Fecha</span><span class="inv-preview-field__value">' + fecha + '</span></div>'
+ '<div class="inv-preview-field"><span class="inv-preview-field__label">Estado</span><span class="inv-preview-field__value"><span class="inv-status-dot inv-status-dot--' + cssEstado + '"></span> ' + statusText + '</span></div>'
+ '<div class="inv-preview-field"><span class="inv-preview-field__label">Archivos</span><span class="inv-preview-field__value">' + totalArchivos + '</span></div>'
+ '<div class="inv-preview-field"><span class="inv-preview-field__label">Archivo</span><span class="inv-preview-field__value">' + escapeHtml(fileName) + '</span></div>';

if (inv.estado === 'pendiente') {
var furatFile = (inv.archivos || []).find(function(f) {
return f.name.toUpperCase().includes('FURAT') && (f.extension || '').toLowerCase() === 'pdf';
});
if (!furatFile) {
furatFile = (inv.archivos || []).find(function(f) {
return (f.extension || '').toLowerCase() === 'pdf';
});
}
startBtn.style.display = '';
startBtn.dataset.invnombre = inv.nombre;
startBtn.dataset.furatpath = furatFile ? furatFile.path : '';
}
}

iframeContainer.innerHTML = '<div class="inv-loading"><div class="inv-spinner"></div><p>Cargando documento...</p></div>';

try {
var ext = extension.toLowerCase();
var result;

if (ext === 'pdf') {
result = await callParentAPI('get-pdf-preview', { filePath: filePath });
} else if (ext === 'xls' || ext === 'xlsx') {
result = await callParentAPI('get-excel-preview', { filePath: filePath });
} else if (ext === 'doc' || ext === 'docx') {
result = await callParentAPI('get-word-preview', { filePath: filePath });
} else {
iframeContainer.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty__icon"><i class="fas fa-file"></i></div><h3>Vista previa no disponible</h3><p>El archivo .' + ext + ' no se puede previsualizar.</p></div>';
return;
}

if (result && result.data) {
iframeContainer.innerHTML = '<iframe src="data:application/pdf;base64,' + result.data + '" style="width:100%;height:450px;border:none;"></iframe>';
} else {
iframeContainer.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty__icon"><i class="fas fa-exclamation-triangle"></i></div><h3>Error al cargar</h3><p>No se pudo obtener la vista previa del documento.</p></div>';
}
} catch (error) {
console.error('[INV-MGR] Error en preview:', error);
iframeContainer.innerHTML = '<div class="inv-empty" style="padding: 2rem;"><div class="inv-empty__icon"><i class="fas fa-times-circle"></i></div><h3>Error</h3><p>' + escapeHtml(error.message) + '</p></div>';
}
};

window._startInvestigation = function(invNombre, furatPath) {
window.parent.postMessage({
type: 'iniciar-investigacion-desde-viewer',
investigacionNombre: invNombre || '',
furatPath: furatPath || ''
}, '*');
};

function closePreview() {
document.getElementById('previewOverlay').classList.add('hidden');
document.getElementById('previewFieldGrid').innerHTML = '';
document.getElementById('previewIframeContainer').innerHTML = '';
document.getElementById('previewStartBtn').style.display = 'none';
}

function truncatePath(p) {
if (!p) return '—';
var parts = p.replace(/\\/g, '/').split('/');
if (parts.length <= 3) return p;
return '…/' + parts.slice(-3).join('/');
}

function getFileIcon(extension) {
var icons = {
pdf: 'fas fa-file-pdf',
doc: 'fas fa-file-word',
docx: 'fas fa-file-word',
xls: 'fas fa-file-excel',
xlsx: 'fas fa-file-excel',
zip: 'fas fa-file-archive',
jpg: 'fas fa-file-image',
jpeg: 'fas fa-file-image',
png: 'fas fa-file-image'
};
return icons[(extension || '').toLowerCase()] || 'fas fa-file';
}

function isReportFile(filename) {
var lower = filename.toLowerCase();
return lower.includes('informe') || lower.includes('reporte') ||
lower.includes('investigacion') || lower.includes('investigación');
}

function formatFileSize(bytes) {
if (!bytes) return '';
if (bytes === 0) return '0 B';
var k = 1024;
var sizes = ['B', 'KB', 'MB', 'GB'];
var i = Math.floor(Math.log(bytes) / Math.log(k));
return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString) {
try {
var date = new Date(isoString);
return date.toLocaleDateString('es-CO', {
day: '2-digit',
month: 'short',
year: 'numeric'
});
} catch (e) {
return isoString;
}
}

function escapeHtml(unsafe) {
if (!unsafe) return '';
if (typeof unsafe !== 'string') return String(unsafe);
return unsafe
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#039;');
}

function showToast(title, message, type) {
type = type || 'info';
var container = document.getElementById('toastContainer');

var icons = {
success: 'fas fa-check-circle',
error: 'fas fa-times-circle',
warning: 'fas fa-exclamation-triangle',
info: 'fas fa-info-circle'
};

var toastEl = document.createElement('div');
toastEl.className = 'inv-toast ' + type;
toastEl.id = 'toast-' + (++toastIdCounter);

toastEl.innerHTML =
'<div class="inv-toast__icon ' + (icons[type] || icons.info) + '"></div>'
+ '<div class="inv-toast__content">'
+ ' <p class="inv-toast__title">' + escapeHtml(title) + '</p>'
+ ' <p class="inv-toast__message">' + escapeHtml(message) + '</p>'
+ '</div>'
+ '<button class="inv-toast__close" aria-label="Cerrar" onclick="window._dismissToast(\'' + toastEl.id + '\')">'
+ ' <i class="fas fa-times"></i>'
+ '</button>';

container.appendChild(toastEl);

var timeoutId = setTimeout(function() {
window._dismissToast(toastEl.id);
}, 5000);

toastEl._timeoutId = timeoutId;
}

window._startInvestigation = function(invNombre, furatPath) {
window.parent.postMessage({
type: 'iniciar-investigacion-desde-viewer',
investigacionNombre: invNombre || '',
furatPath: furatPath || ''
}, '*');
};

window._dismissToast = function(toastId) {
var toastEl = document.getElementById(toastId);
if (!toastEl) return;
if (toastEl._timeoutId) clearTimeout(toastEl._timeoutId);
toastEl.classList.add('removing');
setTimeout(function() {
if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
}, 300);
};

})();
