/**
 * roles-responsabilidades-viewer.js
 *
 * Lógica de la vista del submódulo 1.1.2 Roles y Responsabilidades.
 * Cumple con Decreto 1072 de 2015 art. 2.2.4.6.8 + Resolución 0312/2019.
 */
'use strict';

var rrState = {
  empresaId: null,
  empresaNombre: null,
  catalogo: [],
  asignaciones: [],
  divulgaciones: [],
  currentTab: 'gestion',
  editingRol: null
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function getQueryParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return iso;
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function init() {
  rrState.empresaId = getQueryParam('company') || getQueryParam('empresa');
  rrState.empresaNombre = rrState.empresaId || '—';
  $('#headerCompany').textContent = rrState.empresaNombre;
  if (rrState.empresaId) {
    $('#headerSubtitle').textContent = 'Cumplimiento 1.1.2 — ' + rrState.empresaNombre + ' · Res. 0312/2019 + Dto. 1072/2015';
  }
  setupTabs();
  setupModalEvents();
  // 📦705-fix2 (2026-08-14) — Comunicación con el parent via postMessage.
  // El approach anterior (inyectar window.electronAPI directamente) falla en
  // Electron con contextIsolation: el proxy del contextBridge no se transfiere
  // correctamente entre contextos. Solución: el iframe le pide al parent
  // que invoque el IPC. El parent ya tiene el contextBridge funcionando
  // (lo usa en sus propios handlers), así que es 100% confiable.
  rrState.bridgeReady = new Promise(function (resolve) {
    rrState._resolveBridgeReady = resolve;
  });
  // 📦705-fix4 (2026-08-14) — El listener DEBE estar en `window` (el iframe
  // mismo), no en `window.parent`. Cuando el parent hace
  // `iframe.contentWindow.postMessage(...)`, el mensaje se entrega al
  // `window` del iframe. Si lo registramos en `window.parent`, el listener
  // queda en el parent del parent (¡el grandparent!), y nunca recibimos nada.
  // Bug detectado en consola: el parent enviaba el ack pero el viewer nunca
  // lo procesaba → bridgeReady quedaba pendiente → "Cargando..." permanente.
  window.addEventListener('message', _onParentMessage);
  // Avisarle al parent que estamos listos para recibir el handshake
  window.parent.postMessage({ type: 'kair-rr-iframe-ready', source: 'roles-resp-viewer' }, '*');
  await rrState.bridgeReady;
  await cargarDatos();
}

function _onParentMessage(event) {
  if (!event.data || !event.data.type) return;
  // Handshake: el parent confirma que tiene el electronAPI y nos lo expone
  if (event.data.type === 'kair-rr-parent-ack' && event.data.electronAPISnapshot) {
    rrState._electronAPISnapshot = event.data.electronAPISnapshot;
    if (rrState._resolveBridgeReady) {
      rrState._resolveBridgeReady();
      rrState._resolveBridgeReady = null;
    }
  }
  // Respuesta de una llamada IPC
  if (event.data.type === 'kair-rr-bridge-result') {
    var pending = rrState._pendingCalls && rrState._pendingCalls[event.data.callId];
    if (pending) {
      delete rrState._pendingCalls[event.data.callId];
      if (event.data.error) {
        pending.reject(new Error(event.data.error));
      } else {
        pending.resolve(event.data.result);
      }
    }
  }
}

// 📦705-fix2 (2026-08-14) — Wrapper sobre el bridge via postMessage.
// En lugar de copiar el proxy de electronAPI (que no funciona entre contextos
// con contextIsolation), el iframe le pide al parent que invoque el IPC.
// 📦705-fix9 (2026-08-14) — Timeout subido a 60s. Los file dialogs nativos
// (showOpenDialog/showSaveDialog) pueden tardar más de 10s mientras el user
// navega carpetas. 60s es suficiente sin bloquear la UI indefinidamente.
function _bridgeCall(channel, payload) {
  return new Promise(function (resolve, reject) {
    var callId = 'call_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    rrState._pendingCalls = rrState._pendingCalls || {};
    rrState._pendingCalls[callId] = { resolve: resolve, reject: reject };
    window.parent.postMessage({
      type: 'kair-rr-bridge-call',
      source: 'roles-resp-viewer',
      callId: callId,
      channel: channel,
      payload: payload
    }, '*');
    // Timeout de seguridad: 60s (los file dialogs pueden tardar)
    setTimeout(function () {
      if (rrState._pendingCalls && rrState._pendingCalls[callId]) {
        delete rrState._pendingCalls[callId];
        reject(new Error('Timeout: el parent no respondió a ' + channel + ' en 60s. El explorador de archivos puede haberse cerrado o no tenido foco.'));
      }
    }, 60000);
  });
}

function setupTabs() {
  $('#tabGestion').addEventListener('click', function() { switchTab('gestion'); });
  $('#tabDocumentos').addEventListener('click', function() { switchTab('documentos'); });
  $('#backBtn').addEventListener('click', function() {
    if (window.parent && typeof window.parent.postMessage === 'function') {
      window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
  });
}

function switchTab(tab) {
  rrState.currentTab = tab;
  $$('.kair-rr-tab').forEach(function(t) {
    t.classList.toggle('is-active', t.getAttribute('data-tab') === tab);
  });
  $$('.kair-rr-tab-panel').forEach(function(p) {
    p.classList.toggle('is-active', p.id === ('panel' + tab.charAt(0).toUpperCase() + tab.slice(1)));
  });
}

function setupModalEvents() {
  $$('[data-action="cerrar-modal-asignar"]').forEach(function(b) {
    b.addEventListener('click', cerrarModalAsignar);
  });
  $$('[data-action="cerrar-modal-trabajador"]').forEach(function(b) {
    b.addEventListener('click', cerrarModalTrabajador);
  });
  $$('[data-action="cerrar-modal-matriz"]').forEach(function(b) {
    b.addEventListener('click', cerrarModalMatriz);
  });
  $$('[data-action="cerrar-modal-soporte"]').forEach(function(b) {
    b.addEventListener('click', cerrarModalSoporte);
  });
  $('#btnGuardarAsignar').addEventListener('click', guardarAsignar);
  $('#btnGuardarTrabajador').addEventListener('click', guardarTrabajador);
  $('#btnGuardarSoporte').addEventListener('click', guardarSoporte);
  $('#btnAnadirTrabajador').addEventListener('click', abrirModalTrabajador);
  $('#btnExportarPDF').addEventListener('click', exportarPDF);
  $('#btnMatrizAsignar').addEventListener('click', function() {
    cerrarModalMatriz();
    if (rrState.editingRol) abrirModalAsignar(rrState.editingRol);
  });
  // 📦705-fix8 (2026-08-14) — Drag&drop + examinar del modal "Subir soporte"
  $('#dropZoneSoporte').addEventListener('click', examinarOrigen);
  $('#dropZoneSoporte').addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneSoporte').classList.add('is-dragover');
  });
  $('#dropZoneSoporte').addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneSoporte').classList.remove('is-dragover');
  });
  $('#dropZoneSoporte').addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneSoporte').classList.remove('is-dragover');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      var file = files[0];
      // En Electron 32+, file.path está disponible directamente
      var filePath = file.path || (file.name && '');
      if (filePath) {
        onOrigenSeleccionado(filePath, file.size, file.name);
      } else {
        alert('No se pudo obtener la ruta del archivo. Usá el botón "Examinar..."');
      }
    }
  });
  $('#btnExaminarOrigen').addEventListener('click', examinarOrigen);
  $('#btnExaminarDestino').addEventListener('click', examinarDestino);
}

async function cargarDatos() {
  try {
    var catRes = await _bridgeCall('roles-resp:catalogo-listar', null);
    if (catRes && catRes.success) {
      rrState.catalogo = catRes.data || [];
    } else if (catRes && catRes.error) {
      console.error('[RolesResp] catalogo error:', catRes.error.message);
    }
    if (rrState.empresaId) {
      var asigRes = await _bridgeCall('roles-resp:asignacion-listar', { empresaId: rrState.empresaId });
      if (asigRes && asigRes.success) {
        rrState.asignaciones = asigRes.data || [];
      }
      var divRes = await _bridgeCall('roles-resp:divulgacion-listar', { empresaId: rrState.empresaId });
      if (divRes && divRes.success) {
        rrState.divulgaciones = divRes.data || [];
      }
    }
    renderBanner();
    renderTablaRoles();
    renderTablaDivulgacion();
    renderTablaSoportes();
  } catch (e) {
    console.error('[RolesResp] Error cargando datos:', e.message);
    // Si falla el bridge, mostramos un mensaje claro en el banner
    var bannerEl = $('#bannerSummary');
    if (bannerEl) bannerEl.textContent = 'Error cargando datos: ' + e.message;
  }
}

function renderBanner() {
  var rolesObligatorios = rrState.catalogo.filter(function(c) { return c.obligatorio === 1; });
  var totalRoles = rolesObligatorios.length;
  var rolesAsignados = rrState.asignaciones.length;
  var trabAceptados = rrState.divulgaciones.filter(function(d) {
    return d.estado_calculado === 'aceptado' || d.estado === 'aceptado';
  }).length;
  var totalDivulg = rrState.divulgaciones.length;
  var pctAsign = totalRoles > 0 ? Math.round((rolesAsignados / totalRoles) * 100) : 0;
  var pctDiv = totalDivulg > 0 ? Math.round((trabAceptados / totalDivulg) * 100) : 0;
  var pctGlobal = totalRoles + totalDivulg > 0 ? Math.round((pctAsign + pctDiv) / 2) : 0;
  $('#bannerSummary').innerHTML =
    '<strong>' + rolesAsignados + '/' + totalRoles + '</strong> roles obligatorios asignados · ' +
    '<strong>' + trabAceptados + '/' + totalDivulg + '</strong> trabajadores con soporte PDF · ' +
    '<strong>' + pctGlobal + '%</strong> de cumplimiento global';
  $('#bannerProgressBar').style.width = pctGlobal + '%';
}

function renderTablaRoles() {
  var tbody = $('#tablaRolesBody');
  tbody.innerHTML = '';
  rrState.catalogo.forEach(function(rol) {
    var asignacion = rrState.asignaciones.find(function(a) { return a.rol_id === rol.id; });
    var tr = document.createElement('tr');
    var persona = asignacion ? asignacion.persona_nombre : '—';
    var cedula = asignacion ? (asignacion.persona_cedula || '—') : '—';
    var cargo = asignacion ? (asignacion.persona_cargo || '—') : '—';
    var fecha = asignacion ? formatDate(asignacion.fecha_asignacion) : '—';
    var estado = asignacion
      ? '<span class="kair-rr-state kair-rr-state--vigente">✓ Vigente</span>'
      : (rol.obligatorio === 1
        ? '<span class="kair-rr-state kair-rr-state--pendiente">⚠ Pte</span>'
        : '<span class="kair-rr-state kair-rr-state--na">○ N/A</span>');
    tr.innerHTML =
      '<td><div class="rol-nombre">' + escapeHtml(rol.nombre) + '</div><div class="rol-codigo">' + escapeHtml(rol.codigo) + '</div></td>' +
      '<td>' + escapeHtml(persona) + '</td>' +
      '<td>' + escapeHtml(cedula) + '</td>' +
      '<td>' + escapeHtml(cargo) + '</td>' +
      '<td>' + fecha + '</td>' +
      '<td>' + estado + '</td>' +
      '<td><button class="kair-rr-btn kair-rr-btn--small" data-action="ver-matriz" data-rol-id="' + escapeHtml(rol.id) + '"><i class="bi bi-table"></i> Matriz</button> <button class="kair-rr-btn kair-rr-btn--small" data-action="reasignar" data-rol-id="' + escapeHtml(rol.id) + '"><i class="bi bi-pencil"></i> ' + (asignacion ? 'Reasignar' : 'Asignar') + '</button></td>';
    tbody.appendChild(tr);
  });
  $$('#tablaRolesBody button[data-action="ver-matriz"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      abrirModalMatriz(btn.getAttribute('data-rol-id'));
    });
  });
  $$('#tablaRolesBody button[data-action="reasignar"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      abrirModalAsignar(btn.getAttribute('data-rol-id'));
    });
  });
}

function renderTablaDivulgacion() {
  var tbody = $('#tablaDivulgacionBody');
  tbody.innerHTML = '';
  if (rrState.divulgaciones.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:#94a3b8;">' +
      'No hay divulgaciones registradas. Use <strong>+ Añadir trabajador</strong> para empezar.</td></tr>';
    return;
  }
  rrState.divulgaciones.forEach(function(d) {
    var estadoTexto = d.estado_calculado === 'aceptado' || d.estado === 'aceptado'
      ? '<span class="kair-rr-state kair-rr-state--aceptado">✓ Aceptado</span>'
      : '<span class="kair-rr-state kair-rr-state--pendiente">⏳ Pendiente</span>';
    var soporte = d.documento_soporte_path
      ? '<a href="#" data-action="ver-soporte" data-path="' + escapeHtml(d.documento_soporte_path) + '" style="color:#174ea6;font-size:12px;">📄 ' + escapeHtml(d.documento_soporte_path.split(/[\\/]/).pop()) + '</a>'
      : '<button class="kair-rr-btn kair-rr-btn--small" data-action="subir-soporte" data-id="' + d.id + '"><i class="bi bi-upload"></i> Subir</button>';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(d.persona_nombre) + '</td>' +
      '<td>' + escapeHtml(d.persona_cedula || '—') + '</td>' +
      '<td>' + escapeHtml(d.persona_cargo || '—') + '</td>' +
      '<td>' + estadoTexto + '</td>' +
      '<td><input type="date" value="' + (d.fecha_divulgacion || '').substring(0, 10) + '" data-id="' + d.id + '" class="kair-rr-date-input" /></td>' +
      '<td>' + soporte + '</td>' +
      '<td><button class="kair-rr-btn kair-rr-btn--small" data-action="eliminar-divulg" data-id="' + d.id + '"><i class="bi bi-trash"></i></button></td>';
    tbody.appendChild(tr);
  });
  $$('#tablaDivulgacionBody button[data-action="subir-soporte"]').forEach(function(btn) {
    btn.addEventListener('click', function() { subirSoporte(parseInt(btn.getAttribute('data-id'), 10)); });
  });
  $$('#tablaDivulgacionBody button[data-action="eliminar-divulg"]').forEach(function(btn) {
    btn.addEventListener('click', function() { eliminarDivulgacion(parseInt(btn.getAttribute('data-id'), 10)); });
  });
  $$('#tablaDivulgacionBody input.kair-rr-date-input').forEach(function(input) {
    input.addEventListener('change', function() {
      actualizarFecha(parseInt(input.getAttribute('data-id'), 10), input.value);
    });
  });
}

// 📦705-fix10 (2026-08-14) — Tab "Documentos de soporte": lista los PDFs
// subidos (divulgaciones con documento_soporte_path no nulo). Botones Ver y
// Descargar por fila.
function renderTablaSoportes() {
  var tbody = $('#tablaDocumentosBody');
  tbody.innerHTML = '';
  var soportes = (rrState.divulgaciones || []).filter(function (d) {
    return d.documento_soporte_path && String(d.documento_soporte_path).trim();
  });
  $('#documentosCount').textContent = soportes.length + (soportes.length === 1 ? ' PDF' : ' PDFs');
  if (soportes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#94a3b8;">' +
      'Todavía no hay PDFs de soporte. Andá al tab <strong>Gestión de Roles</strong>, agregá un trabajador en la sección ' +
      '"Divulgación a Trabajadores" y hacé click en <strong>Subir</strong> en la fila correspondiente.</td></tr>';
    return;
  }
  soportes.forEach(function (d) {
    var filename = String(d.documento_soporte_path).split(/[\\/]/).pop();
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><div class="rol-nombre">' + escapeHtml(d.persona_nombre) + '</div></td>' +
      '<td>' + escapeHtml(d.persona_cedula || '—') + '</td>' +
      '<td>' + escapeHtml(d.persona_cargo || '—') + '</td>' +
      '<td>' + formatDate(d.fecha_divulgacion) + '</td>' +
      '<td><div class="kair-rr-doc-icon" title="' + escapeHtml(d.documento_soporte_path) + '"><i class="bi bi-file-earmark-pdf"></i><span class="kair-rr-doc-icon__name">' + escapeHtml(filename) + '</span></div></td>' +
      '<td>' +
        '<button class="kair-rr-btn kair-rr-btn--small" data-action="ver-pdf-soporte" data-path="' + escapeHtml(d.documento_soporte_path) + '"><i class="bi bi-eye"></i> Ver</button> ' +
        '<button class="kair-rr-btn kair-rr-btn--small" data-action="descargar-pdf-soporte" data-path="' + escapeHtml(d.documento_soporte_path) + '"><i class="bi bi-download"></i> Descargar</button>' +
      '</td>';
    tbody.appendChild(tr);
  });
  $$('#tablaDocumentosBody button[data-action="ver-pdf-soporte"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      verPDFSoporte(btn.getAttribute('data-path'));
    });
  });
  $$('#tablaDocumentosBody button[data-action="descargar-pdf-soporte"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      descargarPDFSoporte(btn.getAttribute('data-path'));
    });
  });
}

function verPDFSoporte(filePath) {
  if (!filePath) return;
  // 📦705-fix10 (2026-08-14) — El parent (roles-responsabilidades-logic.js)
  // ya tiene un handler para `open-file-viewer-modal` que abre el kairFV.
  // Le pedimos al parent que lo abra.
  window.parent.postMessage({
    type: 'open-file-viewer-modal',
    filePath: filePath
  }, '*');
}

async function descargarPDFSoporte(filePath) {
  if (!filePath) return;
  try {
    var res = await _bridgeCall('roles-resp:archivo-descargar', { sourcePath: filePath });
    if (res && res.success && res.data) {
      alert('✅ PDF descargado en:\n' + res.data.path + '\n(' + formatBytes(res.data.bytes) + ')');
    } else if (res && res.error && res.error.code === 'CANCELED') {
      // User canceló el save dialog, no hacer nada
    } else {
      alert('Error: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    alert('Error descargando: ' + e.message);
  }
}

function abrirModalAsignar(rolId) {
  var rol = rrState.catalogo.find(function(c) { return c.id === rolId; });
  if (!rol) return;
  rrState.editingRol = rolId;
  var asignacion = rrState.asignaciones.find(function(a) { return a.rol_id === rolId; });
  $('#modalAsignarRol').textContent = rol.nombre + ' (' + rol.codigo + ')';
  $('#modalAsignarTitle').textContent = asignacion ? 'Reasignar persona a rol' : 'Asignar persona a rol';
  $('#inputAsignarNombre').value = asignacion ? asignacion.persona_nombre : '';
  $('#inputAsignarCedula').value = asignacion ? (asignacion.persona_cedula || '') : '';
  $('#inputAsignarCargo').value = asignacion ? (asignacion.persona_cargo || '') : '';
  $('#inputAsignarFecha').value = (asignacion ? asignacion.fecha_asignacion : new Date().toISOString()).substring(0, 10);
  $('#modalAsignar').removeAttribute('hidden');
}

function cerrarModalAsignar() {
  $('#modalAsignar').setAttribute('hidden', '');
  rrState.editingRol = null;
}

async function guardarAsignar() {
  if (!rrState.editingRol) return;
  var nombre = $('#inputAsignarNombre').value.trim();
  if (!nombre) { alert('El nombre es obligatorio'); return; }
  var fecha = $('#inputAsignarFecha').value;
  if (!fecha) { alert('La fecha es obligatoria'); return; }
  try {
    var res = await _bridgeCall('roles-resp:asignacion-upsert', {
      empresaId: rrState.empresaId,
      rolId: rrState.editingRol,
      personaNombre: nombre,
      personaCedula: $('#inputAsignarCedula').value.trim() || null,
      personaCargo: $('#inputAsignarCargo').value.trim() || null,
      fechaAsignacion: fecha,
      creadoPor: 'admin'
    });
    if (res && res.success) {
      cerrarModalAsignar();
      await cargarDatos();
    } else {
      alert('Error guardando: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    console.error('[RolesResp] Error upsert asignacion:', e.message);
    alert('Error: ' + e.message);
  }
}

function abrirModalTrabajador() {
  $('#inputTrabCedula').value = '';
  $('#inputTrabNombre').value = '';
  $('#inputTrabCargo').value = '';
  $('#modalTrabajador').removeAttribute('hidden');
}

function cerrarModalTrabajador() {
  $('#modalTrabajador').setAttribute('hidden', '');
}

// 📦705-fix3 (2026-08-14) — Modal Matriz del Excel G-OD-006 (4 columnas:
// Responsabilidades / Autoridad / Rendición de Cuentas / Base legal).
// Se abre al hacer click en el botón "Matriz" de la tabla de roles.
function abrirModalMatriz(rolId) {
  var rol = rrState.catalogo.find(function (c) { return c.id === rolId; });
  if (!rol) {
    console.warn('[RolesResp] abrirModalMatriz: rol no encontrado', rolId);
    return;
  }
  rrState.editingRol = rolId;
  $('#modalMatrizNombre').textContent = rol.nombre || '—';
  $('#modalMatrizCodigo').textContent = rol.codigo || '—';
  $('#modalMatrizResponsabilidades').textContent = rol.responsabilidades || '— (sin definir)';
  $('#modalMatrizAutoridad').textContent = rol.autoridad || '— (sin definir)';
  $('#modalMatrizRendicion').textContent = rol.rendicion_cuentas || '— (sin definir)';
  $('#modalMatrizBaseLegal').textContent = rol.base_legal || '';
  $('#modalMatriz').removeAttribute('hidden');
}

function cerrarModalMatriz() {
  $('#modalMatriz').setAttribute('hidden', '');
  rrState.editingRol = null;
}

async function guardarTrabajador() {
  var cedula = $('#inputTrabCedula').value.trim();
  var nombre = $('#inputTrabNombre').value.trim();
  if (!cedula || !nombre) { alert('Cédula y nombre son obligatorios'); return; }
  try {
    var res = await _bridgeCall('roles-resp:divulgacion-upsert', {
      empresaId: rrState.empresaId,
      personaCedula: cedula,
      personaNombre: nombre,
      personaCargo: $('#inputTrabCargo').value.trim() || null,
      fechaDivulgacion: new Date().toISOString()
    });
    if (res && res.success) {
      cerrarModalTrabajador();
      await cargarDatos();
    } else {
      alert('Error guardando: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    console.error('[RolesResp] Error upsert divulgacion:', e.message);
    alert('Error: ' + e.message);
  }
}

async function subirSoporte(divulgId) {
  // 📦705-fix8 (2026-08-14) — Modal completo con drag&drop + examinar + copia
  // a destino. El user selecciona el PDF origen (drag/drop o explorador) y la
  // carpeta destino. La app COPIA el archivo y guarda la divulgación con el
  // path destino (para tener una copia controlada en la carpeta de la empresa).
  // 📦705-fix9 (2026-08-14) — Mejor visual: chips con nombre corto + tooltip
  // con la ruta completa. Default destino: carpeta de la empresa en Google Drive.
  var div = rrState.divulgaciones.find(function(d) { return d.id === divulgId; });
  if (!div) return;
  rrState.editingDivulg = divulgId;
  rrState.origenPath = null;
  rrState.origenBytes = null;
  rrState.destinoPath = null;
  $('#modalSubirSoportePersona').textContent = 'Trabajador: ' + (div.persona_nombre || '—') + ' (C.C. ' + (div.persona_cedula || '—') + ')';
  // Reset origen chip
  $('#chipOrigen').setAttribute('data-empty', 'true');
  $('#chipOrigen').setAttribute('title', '');
  $('#chipOrigenName').textContent = 'Ningún archivo seleccionado';
  $('#chipOrigenSize').textContent = '';
  // Default destino: Desktop (el user puede cambiarlo con "Examinar...")
  setDestino('C:\\Users\\usuario\\Desktop');
  $('#btnGuardarSoporte').setAttribute('disabled', '');
  $('#modalSubirSoporte').removeAttribute('hidden');
}

function cerrarModalSoporte() {
  $('#modalSubirSoporte').setAttribute('hidden', '');
  rrState.editingDivulg = null;
  rrState.origenPath = null;
  rrState.origenBytes = null;
  rrState.destinoPath = null;
}

function onOrigenSeleccionado(filePath, bytes, name) {
  rrState.origenPath = filePath;
  rrState.origenBytes = bytes;
  var filename = name || filePath.split(/[\\/]/).pop();
  $('#chipOrigen').removeAttribute('data-empty');
  $('#chipOrigen').setAttribute('title', filePath);  // tooltip con la ruta completa
  $('#chipOrigenName').textContent = filename;
  $('#chipOrigenSize').textContent = bytes ? formatBytes(bytes) : '';
  // Si el destino está vacío, sugerimos la carpeta del origen
  if (!rrState.destinoPath) {
    var sep = filePath.indexOf('\\') >= 0 ? '\\' : '/';
    setDestino(filePath.substring(0, filePath.lastIndexOf(sep)));
  }
  actualizarBotonGuardar();
}

function setDestino(path) {
  rrState.destinoPath = path;
  if (!path) {
    $('#chipDestino').setAttribute('data-empty', 'true');
    $('#chipDestino').setAttribute('title', '');
    $('#chipDestinoName').textContent = 'Sin carpeta destino';
  } else {
    $('#chipDestino').removeAttribute('data-empty');
    $('#chipDestino').setAttribute('title', path);  // tooltip con la ruta completa
    // Mostrar solo el último segmento de la ruta (la carpeta)
    var parts = path.split(/[\\/]/).filter(function (p) { return p; });
    $('#chipDestinoName').textContent = parts.length > 0 ? parts[parts.length - 1] : path;
  }
  actualizarBotonGuardar();
}

function actualizarBotonGuardar() {
  if (rrState.origenPath && rrState.destinoPath) {
    $('#btnGuardarSoporte').removeAttribute('disabled');
  } else {
    $('#btnGuardarSoporte').setAttribute('disabled', '');
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

async function examinarOrigen() {
  try {
    var res = await _bridgeCall('roles-resp:archivo-seleccionar-origen', null);
    if (res && res.success && res.data) {
      onOrigenSeleccionado(res.data.path, res.data.bytes, res.data.filename);
    } else if (res && res.error && res.error.code !== 'CANCELED') {
      alert('Error: ' + res.error.message);
    }
  } catch (e) {
    alert('Error abriendo explorador: ' + e.message);
  }
}

async function examinarDestino() {
  try {
    var currentPath = rrState.destinoPath || undefined;
    var res = await _bridgeCall('roles-resp:archivo-seleccionar-destino', { defaultPath: currentPath });
    if (res && res.success && res.data) {
      setDestino(res.data.path);
    } else if (res && res.error && res.error.code !== 'CANCELED') {
      alert('Error: ' + res.error.message);
    }
  } catch (e) {
    alert('Error abriendo explorador: ' + e.message);
  }
}

async function guardarSoporte() {
  if (!rrState.editingDivulg) return;
  var div = rrState.divulgaciones.find(function(d) { return d.id === rrState.editingDivulg; });
  if (!div) { cerrarModalSoporte(); return; }
  var origen = rrState.origenPath;
  var destino = rrState.destinoPath;
  if (!origen) { alert('Seleccioná un PDF de origen (arrastrando o con "Examinar...")'); return; }
  if (!destino) { alert('Indicá la carpeta destino'); return; }
  if (!origen.toLowerCase().endsWith('.pdf')) { alert('El archivo origen debe ser un PDF (*.pdf)'); return; }
  // 1) Copiar el archivo al destino
  var btn = $('#btnGuardarSoporte');
  btn.setAttribute('disabled', '');
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Copiando...';
  try {
    var copyRes = await _bridgeCall('roles-resp:archivo-copiar', { origen: origen, destino: destino });
    if (!copyRes || !copyRes.success) {
      btn.removeAttribute('disabled');
      btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
      alert('Error copiando: ' + (copyRes && copyRes.error && copyRes.error.message));
      return;
    }
    // 2) Guardar la divulgación con el path destino
    var res = await _bridgeCall('roles-resp:divulgacion-upsert', {
      empresaId: rrState.empresaId,
      personaCedula: div.persona_cedula,
      personaNombre: div.persona_nombre,
      personaCargo: div.persona_cargo,
      fechaDivulgacion: div.fecha_divulgacion,
      documentoSoportePath: copyRes.data.path,
      fechaAceptacion: new Date().toISOString()
    });
    if (res && res.success) {
      cerrarModalSoporte();
      await cargarDatos();
      alert('✅ Soporte PDF copiado y divulgado.\n\nOrigen: ' + origen + '\nDestino: ' + copyRes.data.path + '\nEstado: ' + (res.data && res.data.estado ? res.data.estado : 'aceptado'));
    } else {
      btn.removeAttribute('disabled');
      btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
      alert('Error guardando divulgación: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    btn.removeAttribute('disabled');
    btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
    alert('Error: ' + e.message);
  }
}

async function eliminarDivulgacion(divulgId) {
  if (!confirm('¿Eliminar esta divulgación? Esta acción no se puede deshacer.')) return;
  try {
    var res = await _bridgeCall('roles-resp:divulgacion-eliminar', { id: divulgId });
    if (res && res.success) {
      await cargarDatos();
    } else {
      alert('Error: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function actualizarFecha(divulgId, fecha) {
  var div = rrState.divulgaciones.find(function(d) { return d.id === divulgId; });
  if (!div) return;
  try {
    await _bridgeCall('roles-resp:divulgacion-upsert', {
      empresaId: rrState.empresaId,
      personaCedula: div.persona_cedula,
      personaNombre: div.persona_nombre,
      personaCargo: div.persona_cargo,
      fechaDivulgacion: fecha + 'T00:00:00.000Z',
      documentoSoportePath: div.documento_soporte_path,
      fechaAceptacion: div.fecha_aceptacion
    });
  } catch (e) {
    console.error('[RolesResp] Error actualizando fecha:', e.message);
  }
}

async function exportarPDF() {
  if (!rrState.empresaId) { alert('Selecciona una empresa primero'); return; }
  // 📦705-fix6 (2026-08-14) — No usar `process.env.USERNAME` porque este código
  // corre en el iframe del renderer, donde `process` no existe (eso es del
  // main process de Node). Usamos un placeholder genérico + le pedimos al user
  // que confirme/ajuste la ruta en el prompt.
  var defaultName = 'C:\\Users\\usuario\\Desktop\\1.1.2_Cumplimiento_' + rrState.empresaId + '_' + new Date().toISOString().substring(0, 10) + '.pdf';
  var outputPath = prompt('Ruta donde guardar el PDF (ajustá el "usuario" si querés):', defaultName);
  if (!outputPath) return;
  if (!outputPath.toLowerCase().endsWith('.pdf')) outputPath += '.pdf';
  try {
    var res = await _bridgeCall('roles-resp:reporte-pdf', {
      empresaId: rrState.empresaId,
      outputPath: outputPath
    });
    if (res && res.success) {
      alert('✅ Reporte generado correctamente:\n' + res.data.path + '\n(' + res.data.bytes + ' bytes)');
    } else {
      alert('Error generando PDF: ' + (res && res.error && res.error.message));
    }
  } catch (e) {
    console.error('[RolesResp] Error generando PDF:', e.message);
    alert('Error: ' + e.message);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
