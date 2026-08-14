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
  // 📦706-fix19 (2026-08-14) — rrState.documentos eliminado. Los PDFs
  // se cargan on-demand cuando se abre el modal de un trabajador.
  // El badge "+N anteriores" usa d.documento_count del bridge.
  currentTab: 'gestion',
  editingRol: null,
  editingDivulg: null
};

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

// 📦706-fix21 (2026-08-14) — Toast notifications (mismo patrón que 6.1.2
// Política). Reemplazan los `alert()` nativos con algo más profesional.
// API: _showToast(message, type, duration)
//   message: string (puede tener HTML básico como <strong>, <code>, <br>)
//   type: 'success' | 'error' | 'warning' | 'info' (default: 'info')
//   duration: ms (default: 3000). Usar 0 para que no se cierre solo.
function _showToast(message, type, duration) {
  type = type || 'info';
  duration = (duration === undefined) ? 3000 : duration;
  var container = document.getElementById('kToastContainer');
  if (!container) {
    // Fallback si el container no existe (ej: durante el init)
    console.log('[TOAST ' + type.toUpperCase() + ']', message.replace(/<[^>]+>/g, ''));
    return;
  }
  var icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };
  var toast = document.createElement('div');
  toast.className = 'kair-toast kair-toast--' + type;
  toast.innerHTML =
    '<i class="bi ' + (icons[type] || icons.info) + ' kair-toast__icon"></i>' +
    '<span class="kair-toast__message">' + message + '</span>';
  container.appendChild(toast);
  if (duration > 0) {
    setTimeout(function () {
      toast.classList.add('is-closing');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 320);
    }, duration);
  }
}

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
  // 📦705-fix11 (2026-08-14) — Header estandarizado (mismo patrón que 6.1.1).
  // El company chip ahora está a la derecha con divider, y el subtítulo es
  // genérico (siempre "Gestión de roles y responsabilidades del SG-SST").
  $('#headerCompany').textContent = rrState.empresaNombre;
  setupTabs();
  setupModalEvents();
  // 📦706-fix19 (2026-08-14) — El tab "Documentos de soporte" se quitó
  // (v0.1.181). El setupTabs() ahora solo tiene el botón de Gestión + el
  // back button. Ver setupTabs() abajo.
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
  // 📦706-fix19 (2026-08-14) — Tab "Documentos de soporte" eliminado.
  // Solo queda el tab "Gestión de Roles" + el back button.
  $('#tabGestion').addEventListener('click', function() { switchTab('gestion'); });
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
  $$('[data-action="cerrar-modal-documentos-trabajador"]').forEach(function(b) {
    b.addEventListener('click', cerrarModalDocumentosTrabajador);
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
        _showToast('No se pudo obtener la ruta del archivo. Usá el botón "Examinar..."', 'warning', 4000);
      }
    }
  });
  $('#btnExaminarOrigen').addEventListener('click', examinarOrigen);
  $('#btnExaminarDestino').addEventListener('click', examinarDestino);
  // 📦706-fix16 (2026-08-14) — Drag&drop de CARPETA en el dropzone destino
  $('#dropZoneDestino').addEventListener('click', examinarDestino);
  $('#dropZoneDestino').addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneDestino').classList.add('is-dragover');
  });
  $('#dropZoneDestino').addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneDestino').classList.remove('is-dragover');
  });
  $('#dropZoneDestino').addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    $('#dropZoneDestino').classList.remove('is-dragover');
    // En Electron, arrastrar una carpeta expone files[0].path directamente
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      var folderPath = files[0].path;
      if (folderPath) {
        setDestino(folderPath);
      } else {
        _showToast('No se pudo obtener la ruta de la carpeta. Usá el botón "Examinar..."', 'warning', 4000);
      }
    }
  });
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
      // 📦706-fix19 (2026-08-14) — Ya no cargamos la lista de documentos
      // al inicio. El badge "+N anteriores" se calcula desde
      // d.documento_count (que el bridge trae por persona desde el fix18).
      // Los documentos solo se cargan cuando se abre el modal de un
      // trabajador (abrirModalDocumentosTrabajador).
    }
    renderBanner();
    renderTablaRoles();
    renderTablaDivulgacion();
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
    // 📦705-fix13 (2026-08-14) — Solo íconos en la columna Acciones (mismo
    // patrón que Documentos de soporte). El texto va al `title` (tooltip).
    // El label del segundo botón cambia según haya asignación o no.
    var accionLabel = asignacion ? 'Reasignar persona' : 'Asignar persona';
    tr.innerHTML =
      '<td><div class="rol-nombre">' + escapeHtml(rol.nombre) + '</div><div class="rol-codigo">' + escapeHtml(rol.codigo) + '</div></td>' +
      '<td>' + escapeHtml(persona) + '</td>' +
      '<td>' + escapeHtml(cedula) + '</td>' +
      '<td>' + escapeHtml(cargo) + '</td>' +
      '<td>' + fecha + '</td>' +
      '<td>' + estado + '</td>' +
      '<td class="kair-rr-actions-cell">' +
        '<button class="kair-rr-icon-btn" data-action="ver-matriz" data-rol-id="' + escapeHtml(rol.id) + '" title="Ver Matriz (Responsabilidades / Autoridad / Rendición)"><i class="bi bi-table"></i></button>' +
        '<button class="kair-rr-icon-btn" data-action="reasignar" data-rol-id="' + escapeHtml(rol.id) + '" title="' + accionLabel + '"><i class="bi bi-pencil"></i></button>' +
      '</td>';
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
  // 📦706-fix18 (2026-08-14) — Agrupar por persona: 1 sola fila por
  // persona_cedula. Tomamos la divulgacion VIGENTE (fecha_vigencia_hasta IS NULL)
  // si existe, sino la mas reciente. Contamos TODOS los PDFs del trabajador
  // sumando desde rrState.documentos (que ya incluye todas las divulgaciones).
  var divulgacionesPorPersona = {};
  rrState.divulgaciones.forEach(function (d) {
    var key = d.persona_cedula || ('_' + d.id);
    if (!divulgacionesPorPersona[key]) {
      divulgacionesPorPersona[key] = d;
      return;
    }
    var actual = divulgacionesPorPersona[key];
    var dVigente = !d.fecha_vigencia_hasta;
    var aVigente = !actual.fecha_vigencia_hasta;
    if (dVigente && !aVigente) {
      // La nueva es vigente y la actual no → reemplazar
      divulgacionesPorPersona[key] = d;
    } else if (dVigente === aVigente) {
      // Misma condicion de vigencia → quedarnos con la mas reciente
      if (new Date(d.creado_en) > new Date(actual.creado_en)) {
        divulgacionesPorPersona[key] = d;
      }
    }
    // Si la actual es vigente y la nueva no, no la reemplazamos
  });
  // 📦706-fix19 (2026-08-14) — Ya no calculamos pdfCountPorPersona desde
  // rrState.documentos (que no se carga al inicio). Usamos directamente
  // d.documento_count que el bridge trae por persona (calculado en la
  // subquery SQL). El badge "+N anteriores" sigue funcionando.
  // Renderizar 1 fila por persona
  Object.keys(divulgacionesPorPersona).forEach(function (key) {
    var d = divulgacionesPorPersona[key];
    var estadoTexto = d.estado_calculado === 'aceptado' || d.estado === 'aceptado'
      ? '<span class="kair-rr-state kair-rr-state--aceptado">✓ Aceptado</span>'
      : '<span class="kair-rr-state kair-rr-state--pendiente">⏳ Pendiente</span>';
    // 📦706-fix19 — docCount viene del bridge (cuenta por persona, no por
    // divulgación). docActualPath es el path del PDF vigente (es_actual=1).
    var docCount = d.documento_count || 0;
    var docActualPath = d.documento_actual_path || d.documento_soporte_path || null;
    var soporte;
    if (docCount === 0) {
      soporte = '<button class="kair-rr-btn kair-rr-btn--small" data-action="subir-soporte" data-id="' + d.id + '"><i class="bi bi-upload"></i> Subir</button>';
    } else {
      var filename = docActualPath ? docActualPath.split(/[\\/]/).pop() : '—';
      var badgeAnteriores = docCount > 1
        ? ' <span class="kair-rr-anteriores-badge" data-action="ver-historial" data-cedula="' + escapeHtml(d.persona_cedula || '') + '" data-id="' + d.id + '" title="Ver todos los documentos del trabajador">+' + (docCount - 1) + ' anterior' + (docCount - 1 === 1 ? '' : 'es') + '</span>'
        : '';
      soporte = '<div class="kair-rr-soporte-cell">' +
        '<a href="#" data-action="ver-soporte" data-path="' + escapeHtml(docActualPath || '') + '" style="color:#174ea6;font-size:12px;">📄 ' + escapeHtml(filename) + '</a>' +
        badgeAnteriores +
        ' <button class="kair-rr-icon-btn" data-action="subir-soporte" data-id="' + d.id + '" title="Subir otro documento (reemplaza el vigente, conserva el anterior)" style="margin-left:auto;"><i class="bi bi-plus-lg"></i></button>' +
        '</div>';
    }
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
  // 📦706-fix18 (2026-08-14) — Listener del link "📄 filename" en la fila
  // de divulgación: abre el PDF en el file viewer via postMessage al parent.
  // Sin este listener, el link no hace nada (href="#" no tiene handler).
  $$('#tablaDivulgacionBody a[data-action="ver-soporte"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var path = a.getAttribute('data-path');
      if (path) verPDFSoporte(path);
    });
  });
  $$('#tablaDivulgacionBody button[data-action="eliminar-divulg"]').forEach(function(btn) {
    btn.addEventListener('click', function() { eliminarDivulgacion(parseInt(btn.getAttribute('data-id'), 10)); });
  });
  $$('#tablaDivulgacionBody input.kair-rr-date-input').forEach(function(input) {
    input.addEventListener('change', function() {
      actualizarFecha(parseInt(input.getAttribute('data-id'), 10), input.value);
    });
  });
  // 📦706-fix18 (2026-08-14) — Listener del badge "+N anteriores" pasa la
  // cedula del trabajador (no el id de divulgacion) porque el modal ahora
  // lista TODOS los PDFs de la persona, no de una divulgacion puntual.
  $$('#tablaDivulgacionBody span[data-action="ver-historial"]').forEach(function(span) {
    span.addEventListener('click', function() {
      abrirModalDocumentosTrabajador(
        parseInt(span.getAttribute('data-id'), 10),
        span.getAttribute('data-cedula')
      );
    });
  });
}

// 📦706-fix19 (2026-08-14) — Tab "Documentos de soporte" ELIMINADO.
// Antes: lista plana de TODOS los PDFs con badge Vigente/Anterior/Corrección.
// Ahora: el modal "Documentos del trabajador" (abrirModalDocumentosTrabajador)
// muestra los PDFs agrupados por persona con cards visuales. Redundante.
// Las funciones verPDFSoporte / descargarPDFSoporte se mantienen porque
// las usa el modal.

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
      _showToast('✅ PDF descargado en:<br><code>' + res.data.path + '</code><br>(' + formatBytes(res.data.bytes) + ')', 'success', 5000);
    } else if (res && res.error && res.error.code === 'CANCELED') {
      // User canceló el save dialog, no hacer nada
    } else {
      _showToast('Error: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    _showToast('Error descargando: ' + e.message, 'error', 5000);
  }
}

// 📦706-fix18 (2026-08-14) — Modal de selección de PDFs del trabajador.
// Refactor: ahora lista TODOS los PDFs del trabajador (de TODAS sus
// divulgaciones, vigentes o archivadas), ordenados por fecha DESC.
// Pasa personaCedula al backend para que devuelva los PDFs históricos
// también. El user puede elegir cuál abrir haciendo click en "Ver".
async function abrirModalDocumentosTrabajador(divulgacionId, personaCedula) {
  if (!divulgacionId && !personaCedula) return;
  // Buscar la divulgacion (la pasamos para mostrar el contexto del
  // trabajador en el header del modal)
  var div = divulgacionId
    ? rrState.divulgaciones.find(function (d) { return d.id === divulgacionId; })
    : null;
  if (!div && personaCedula) {
    // Si no hay divulgacion visible, buscar cualquier divulgacion de la persona
    div = rrState.divulgaciones.find(function (d) { return d.persona_cedula === personaCedula; });
  }
  var personaNombre = div ? div.persona_nombre : '—';
  var personaCargo = div ? div.persona_cargo : '';
  $('#modalDocumentosTrabajadorPersona').textContent =
    personaNombre + ' (C.C. ' + (personaCedula || '—') + ')' +
    (personaCargo ? ' · ' + personaCargo : '');
  $('#modalDocumentosTrabajador').removeAttribute('hidden');
  // Cargar los PDFs del trabajador via bridge (filtra por persona_cedula)
  try {
    var res = await _bridgeCall('roles-resp:divulgacion-documento-listar', {
      empresaId: rrState.empresaId,
      personaCedula: personaCedula
    });
    if (res && res.success && res.data) {
      renderModalDocumentos(res.data);
    } else {
      $('#modalDocumentosTrabajadorList').innerHTML = '<p class="kair-rr-help">No se pudieron cargar los documentos.</p>';
    }
  } catch (e) {
    $('#modalDocumentosTrabajadorList').innerHTML = '<p class="kair-rr-help">Error: ' + escapeHtml(e.message) + '</p>';
  }
}

// 📦706-fix18 (2026-08-14) — Render NUEVO del modal desde cero:
// lista visual con cards (borde lateral de color por estado: verde=actual,
// gris=anterior, amarillo=correccion). Cada card es clickable y abre el
// PDF directamente. Botones Ver / Descargar como acciones secundarias.
function renderModalDocumentos(docs) {
  var container = $('#modalDocumentosTrabajadorList');
  if (!docs || docs.length === 0) {
    container.innerHTML = '<p class="kair-rr-help">Este trabajador todavía no tiene documentos de soporte.</p>';
    return;
  }
  // Subtitle: "N PDFs · el más reciente primero"
  var subtitle = container.parentElement.querySelector('.kair-rr-modal__subtitle');
  if (subtitle) {
    subtitle.textContent = docs.length + (docs.length === 1 ? ' PDF · más reciente primero' : ' PDFs · más reciente primero');
  }
  container.innerHTML = docs.map(function (doc) {
    var stateClass = '';
    var stateLabel = '';
    if (doc.es_actual === 1) {
      stateClass = 'kair-rr-doc-card--vigente';
      stateLabel = '<span class="kair-rr-doc-state kair-rr-doc-state--vigente">Vigente</span>';
    } else if (doc.es_correccion === 1) {
      stateClass = 'kair-rr-doc-card--correccion';
      stateLabel = '<span class="kair-rr-doc-state kair-rr-doc-state--correccion">Corrección</span>';
    } else {
      stateClass = 'kair-rr-doc-card--anterior';
      stateLabel = '<span class="kair-rr-doc-state kair-rr-doc-state--anterior">Anterior</span>';
    }
    var filename = doc.filename || (doc.file_path ? doc.file_path.split(/[\\/]/).pop() : '—');
    var fechaCarga = doc.fecha_carga ? formatDate(doc.fecha_carga) : '—';
    var fechaDoc = doc.fecha_documento ? formatDate(doc.fecha_documento) : null;
    var bytes = doc.bytes ? formatBytes(doc.bytes) : '';
    return '<div class="kair-rr-doc-card ' + stateClass + '" data-action="abrir-doc" data-path="' + escapeHtml(doc.file_path || '') + '">' +
      '<div class="kair-rr-doc-card__icon"><i class="bi bi-file-earmark-pdf"></i></div>' +
      '<div class="kair-rr-doc-card__body">' +
        '<div class="kair-rr-doc-card__top">' +
          '<span class="kair-rr-doc-card__name" title="' + escapeHtml(doc.file_path || '') + '">' + escapeHtml(filename) + '</span>' +
          stateLabel +
        '</div>' +
        '<div class="kair-rr-doc-card__meta">' +
          '<span><i class="bi bi-calendar3"></i> Cargado: ' + fechaCarga + '</span>' +
          (fechaDoc ? '<span><i class="bi bi-file-earmark-text"></i> Doc: ' + fechaDoc + '</span>' : '') +
          (bytes ? '<span><i class="bi bi-hdd"></i> ' + bytes + '</span>' : '') +
        '</div>' +
        (doc.observaciones ? '<div class="kair-rr-doc-card__obs">' + escapeHtml(doc.observaciones) + '</div>' : '') +
      '</div>' +
      '<div class="kair-rr-doc-card__actions">' +
        '<button class="kair-rr-icon-btn" data-action="ver-doc" data-path="' + escapeHtml(doc.file_path || '') + '" title="Ver PDF"><i class="bi bi-eye"></i></button>' +
        '<button class="kair-rr-icon-btn" data-action="descargar-doc" data-path="' + escapeHtml(doc.file_path || '') + '" title="Descargar"><i class="bi bi-download"></i></button>' +
      '</div>' +
    '</div>';
  }).join('');
  // Listeners: click en la card abre el PDF; iconos son shortcuts
  container.querySelectorAll('[data-action="abrir-doc"]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      // Si el click fue en un botón, no abrir la card (el botón ya tiene su handler)
      if (e.target.closest('button')) return;
      var path = el.getAttribute('data-path');
      if (path) window.parent.postMessage({ type: 'open-file-viewer-modal', filePath: path }, '*');
    });
  });
  container.querySelectorAll('button[data-action="ver-doc"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var path = btn.getAttribute('data-path');
      if (path) window.parent.postMessage({ type: 'open-file-viewer-modal', filePath: path }, '*');
    });
  });
  container.querySelectorAll('button[data-action="descargar-doc"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      descargarPDFSoporte(btn.getAttribute('data-path'));
    });
  });
}

function cerrarModalDocumentosTrabajador() {
  $('#modalDocumentosTrabajador').setAttribute('hidden', '');
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
  if (!nombre) { _showToast('El nombre es obligatorio', 'warning'); return; }
  var fecha = $('#inputAsignarFecha').value;
  if (!fecha) { _showToast('La fecha es obligatoria', 'warning'); return; }
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
      _showToast('Error guardando: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    console.error('[RolesResp] Error upsert asignacion:', e.message);
    _showToast('Error: ' + e.message, 'error', 5000);
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
  if (!cedula || !nombre) { _showToast('Cédula y nombre son obligatorios', 'warning'); return; }
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
      // 📦706-fix20 (2026-08-14) — Mostrar al user la carpeta creada.
      // Si la divulgación era nueva, el bridge creó la carpeta y devuelve el
      // path. Si fue actualización, carpetaPath es null y solo decimos OK.
      var msg = '✅ Trabajador agregado para divulgación.';
      if (res.data && res.data.carpetaPath) {
        msg += '<br><br>📁 Carpeta creada:<br><code>' + res.data.carpetaPath + '</code>';
        _showToast(msg, 'success', 6000);
      } else if (res.data && res.data.carpetaError) {
        msg += '<br><br>⚠️ No se pudo crear la carpeta:<br><code>' + res.data.carpetaError + '</code>';
        _showToast(msg, 'warning', 6000);
      } else {
        _showToast('✅ Trabajador agregado para divulgación.', 'success', 3000);
      }
    } else {
      _showToast('Error guardando: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    console.error('[RolesResp] Error upsert divulgacion:', e.message);
    _showToast('Error: ' + e.message, 'error', 5000);
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
  // 📦706-fix20 — Resolver la carpeta del trabajador via bridge y usarla
  // como destino default. Si el bridge falla, caemos a Desktop.
  try {
    var carpetaRes = await _bridgeCall('roles-resp:carpeta-trabajador-resolver', {
      empresaId: rrState.empresaId,
      personaCedula: div.persona_cedula,
      personaNombre: div.persona_nombre
    });
    if (carpetaRes && carpetaRes.success && carpetaRes.data && carpetaRes.data.path) {
      setDestino(carpetaRes.data.path);
    } else {
      setDestino('C:\\Users\\usuario\\Desktop');
    }
  } catch (eCarpeta) {
    console.warn('[RolesResp] No se pudo resolver carpeta del trabajador:', eCarpeta.message);
    setDestino('C:\\Users\\usuario\\Desktop');
  }
  $('#btnGuardarSoporte').setAttribute('disabled', '');
  // 📦706 (2026-08-14) — Resetear campos extra del modal
  $('#inputEsNuevaContratacion').checked = false;
  $('#inputEsCorreccion').checked = false;
  $('#inputFechaDocumento').value = new Date().toISOString().substring(0, 10);
  $('#inputObservaciones').value = '';
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
  // 📦706-fix16 (2026-08-14) — Dropzone origen refleja que hay PDF seleccionado
  $('#dropZoneSoporte').setAttribute('data-state', 'has-file');
  $('#dropZoneSoporte .kair-rr-dropzone__text').textContent = '✓ PDF seleccionado';
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
    // 📦706-fix16 — Dropzone destino refleja que NO hay carpeta
    $('#dropZoneDestino').setAttribute('data-state', 'empty');
    $('#dropZoneDestino .kair-rr-dropzone__text').textContent = 'Carpeta destino';
    $('#dropZoneDestino .kair-rr-dropzone__subtext').textContent('arrastrá una carpeta o usá "Examinar..."');
  } else {
    $('#chipDestino').removeAttribute('data-empty');
    $('#chipDestino').setAttribute('title', path);  // tooltip con la ruta completa
    // Mostrar solo el último segmento de la ruta (la carpeta)
    var parts = path.split(/[\\/]/).filter(function (p) { return p; });
    var lastPart = parts.length > 0 ? parts[parts.length - 1] : path;
    $('#chipDestinoName').textContent = lastPart;
    // 📦706-fix16 — Dropzone destino refleja que hay carpeta seleccionada
    $('#dropZoneDestino').setAttribute('data-state', 'has-folder');
    $('#dropZoneDestino .kair-rr-dropzone__text').textContent = '✓ Destino: ' + lastPart;
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
      _showToast('Error: ' + res.error.message, 'error', 4000);
    }
  } catch (e) {
    _showToast('Error abriendo explorador: ' + e.message, 'error', 4000);
  }
}

async function examinarDestino() {
  try {
    var currentPath = rrState.destinoPath || undefined;
    var res = await _bridgeCall('roles-resp:archivo-seleccionar-destino', { defaultPath: currentPath });
    if (res && res.success && res.data) {
      setDestino(res.data.path);
    } else if (res && res.error && res.error.code !== 'CANCELED') {
      _showToast('Error: ' + res.error.message, 'error', 4000);
    }
  } catch (e) {
    _showToast('Error abriendo explorador: ' + e.message, 'error', 4000);
  }
}

async function guardarSoporte() {
  if (!rrState.editingDivulg) return;
  var div = rrState.divulgaciones.find(function(d) { return d.id === rrState.editingDivulg; });
  if (!div) { cerrarModalSoporte(); return; }
  var origen = rrState.origenPath;
  var destino = rrState.destinoPath;
  if (!origen) { _showToast('Seleccioná un PDF de origen (arrastrando o con "Examinar...")', 'warning'); return; }
  if (!destino) { _showToast('Indicá la carpeta destino', 'warning'); return; }
  if (!origen.toLowerCase().endsWith('.pdf')) { _showToast('El archivo origen debe ser un PDF (*.pdf)', 'warning'); return; }
  // 1) Copiar el archivo al destino
  var btn = $('#btnGuardarSoporte');
  btn.setAttribute('disabled', '');
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Copiando...';
  try {
    var copyRes = await _bridgeCall('roles-resp:archivo-copiar', { origen: origen, destino: destino });
    if (!copyRes || !copyRes.success) {
      btn.removeAttribute('disabled');
      btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
      _showToast('Error copiando: ' + (copyRes && copyRes.error && copyRes.error.message), 'error', 5000);
      return;
    }
    // 2) Guardar la divulgación con el path destino + campos extra (📦706)
    var esNueva = $('#inputEsNuevaContratacion').checked;
    var esCorreccion = $('#inputEsCorreccion').checked;
    var fechaDoc = $('#inputFechaDocumento').value;
    var obs = $('#inputObservaciones').value.trim();
    var res = await _bridgeCall('roles-resp:divulgacion-upsert', {
      empresaId: rrState.empresaId,
      personaCedula: div.persona_cedula,
      personaNombre: div.persona_nombre,
      personaCargo: div.persona_cargo,
      fechaDivulgacion: new Date().toISOString(),
      documentoSoportePath: copyRes.data.path,
      fechaAceptacion: new Date().toISOString(),
      esNuevaContratacion: esNueva,
      esCorreccion: esCorreccion,
      fechaDocumento: fechaDoc || null,
      observaciones: obs || null,
      creadoPor: 'admin'
    });
    if (res && res.success) {
      cerrarModalSoporte();
      await cargarDatos();
      _showToast('✅ Soporte PDF copiado y divulgado.<br><br>Origen: <code>' + origen + '</code><br>Destino: <code>' + copyRes.data.path + '</code><br>Estado: ' + (res.data && res.data.estado ? res.data.estado : 'aceptado'), 'success', 6000);
    } else {
      btn.removeAttribute('disabled');
      btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
      _showToast('Error guardando divulgación: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    btn.removeAttribute('disabled');
    btn.innerHTML = '<i class="bi bi-upload"></i> Copiar y marcar aceptado';
    _showToast('Error: ' + e.message, 'error', 5000);
  }
}

async function eliminarDivulgacion(divulgId) {
  if (!confirm('¿Eliminar esta divulgación? Esta acción no se puede deshacer.')) return;
  try {
    var res = await _bridgeCall('roles-resp:divulgacion-eliminar', { id: divulgId });
    if (res && res.success) {
      await cargarDatos();
    } else {
      _showToast('Error: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    _showToast('Error: ' + e.message, 'error', 5000);
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
  if (!rrState.empresaId) { _showToast('Selecciona una empresa primero', 'warning'); return; }
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
      _showToast('✅ Reporte generado correctamente:<br><code>' + res.data.path + '</code><br>(' + res.data.bytes + ' bytes)', 'success', 6000);
    } else {
      _showToast('Error generando PDF: ' + (res && res.error && res.error.message), 'error', 5000);
    }
  } catch (e) {
    console.error('[RolesResp] Error generando PDF:', e.message);
    _showToast('Error: ' + e.message, 'error', 5000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
