// presupuesto-home.js - Lógica del Portal de Bienvenida de Asignación de Recursos

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ [PresupuestoHome] Inicializado');

    // Escuchar mensajes del padre (opcional por si necesitamos datos iniciales)
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;

        const data = event.data;

        if (data.files) {
            detectCurrentYearBudget(data.files);
        }

        // 📦708 (Fase 2) — Respuestas del bridge vía parent
        if (data.type === 'bd-status') {
            handleBDStatusResponse(data);
        } else if (data.type === 'bd-import-result') {
            handleBDImportResult(data);
        } else if (data.type === 'bd-resumen') {
            handleBDResumenResponse(data);
        } else if (data.type === 'bd-export-result') {
            handleBDExportResult(data);
        } else if (data.type === 'bd-partida-added') {
            handlePartidaAddedResponse(data);
        } else if (data.type === 'bd-partida-deleted') {
            handlePartidaDeletedResponse(data);
        } else if (data.type === 'bd-meta-updated') {
            handleMetaUpdatedResponse(data);
        }
    });

    // Solicitar archivos para determinar el año activo
    window.parent.postMessage({ action: 'requestBudgetFiles' }, '*');
});

/**
 * Detecta el presupuesto más reciente para mostrarlo en el Hero
 */
let latestFile = null;

function detectCurrentYearBudget(files) {
    if (!files || files.length === 0) return;

    // Buscar archivo del año actual o el más reciente
    const currentYear = new Date().getFullYear();
    const currentYearFile = files.find(f => f.name.includes(currentYear.toString()));
    
    if (currentYearFile) {
        latestFile = currentYearFile;
        document.getElementById('activeYear').textContent = currentYear;
    } else {
        // Si no hay del año actual, tomar el último modificado
        const sorted = files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        latestFile = sorted[0];
        const yearMatch = latestFile.name.match(/(20\d{2})/);
        document.getElementById('activeYear').textContent = yearMatch ? yearMatch[1] : 'Configurado';
    }
}

/**
 * Acciones de Navegación
 */
function goBackToModule() {
    window.parent.postMessage({ action: 'backToSubmodules' }, '*');
}

// 📦708 — Helpers para acceder a sistemas del parent (toasts, confirmaciones)
// KairConfirm y KAIRToast se crean en el parent (index.html). El iframe
// los accede via window.parent.* — los objetos renderizan en el DOM del parent.
function _toast() {
    return (window.parent && window.parent.KAIRToast) ? window.parent.KAIRToast : window.KAIRToast;
}
function _confirmDialog() {
    return (window.parent && window.parent.KairConfirm) ? window.parent.KairConfirm : window.KairConfirm;
}
function _showToast(message, type) {
    var t = _toast();
    if (t) t.show(message, type || 'info');
}

/**
 * 📦708 (Fase 6) — Abre el presupuesto activo.
 * Prioridad: BD primero (si tiene data), luego Excel.
 * El usuario NO tiene que pensar de dónde viene la data.
 */
function enterBudget() {
    // 1) Si hay presupuesto en BD, abrir desde BD (Fase 6: BD = source of truth)
    if (_bdState && _bdState.hasData && _bdState.presupuesto) {
        editFromBD();
        return;
    }
    // 2) Fallback a Excel
    if (latestFile) {
        window.parent.postMessage({ action: 'openBudgetFile', file: latestFile }, '*');
        return;
    }
    // 3) No hay ni Excel ni BD → pedir al usuario que importe o cree uno
    _confirmDialog().alert({
        title: 'Sin presupuesto activo',
        message: 'No hay un presupuesto en la base de datos ni en Excel para este año.',
        details: 'Usá "Importar Excel a BD" si tenés un archivo Excel, o "Histórico de Años" para crear uno nuevo.',
        type: 'warning'
    });
}

function openSelector() {
    window.parent.postMessage({ action: 'backToSelector' }, '*');
}

/**
 * Acciones Rápidas (Placeholders con feedback visual)
 */
function exportBudget() {
    _confirmDialog().alert({
        title: 'Función en desarrollo',
        message: 'Informe Financiero\n\nGenerando resumen ejecutivo de ejecución presupuestal en PDF...',
        type: 'info'
    });
}

async function cloneBudget() {
    if (!latestFile) {
        _confirmDialog().alert({
            title: 'Sin presupuesto base',
            message: 'Primero debe existir un presupuesto base para clonar.',
            type: 'warning'
        });
        return;
    }

    const yearMatch = latestFile.name.match(/(20\d{2})/);
    const currentYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const nextYear = currentYear + 1;

    const confirmed = await _confirmDialog().confirm({
        title: '¿Clonar presupuesto?',
        message: '¿Desea proyectar el presupuesto para el año ' + nextYear + ' basado en el actual?',
        confirmText: 'Sí, clonar',
        cancelText: 'Cancelar',
        type: 'info'
    });
    if (confirmed) {
        window.parent.postMessage({
            action: 'duplicate-budget-file',
            currentFilePath: latestFile.path,
            newYear: nextYear
        }, '*');
    }
}

function importExpenses() {
    _confirmDialog().alert({
        title: 'Función en desarrollo',
        message: 'Importar Gastos\n\nSeleccione el archivo de reporte contable para cruzar con el presupuesto.',
        type: 'info'
    });
}

function configItems() {
    _confirmDialog().alert({
        title: 'Función en desarrollo',
        message: 'Configurar Partidas\n\nAbriendo panel de configuración de rubros y límites de gasto.',
        type: 'info'
    });
}

// ============================================================
// 📦708 (Fase 2) — Lógica de la sección "Base de Datos Local"
// Esta sección se comunica con el parent (presupuesto-logic.js) que a
// su vez habla con el bridge de Presupuesto (presupuesto-bridge.js).
// El flujo es: home.js → postMessage → logic.js → IPC → bridge → BD
// ============================================================

let _bdState = {
    hasData: false,
    anio: null,
    presupuesto: null,
    resumen: null,
    sourceFile: null  // El Excel que se importó (si hay BD con data, se linkea al Excel original)
};

function _getCurrentAnio() {
    // Intentar sacar el año del latestFile (del Excel) o usar el actual
    if (latestFile) {
        var match = latestFile.name.match(/(20\d{2})/);
        if (match) return parseInt(match[1], 10);
    }
    return new Date().getFullYear();
}

function _setBDStatus(badgeText, badgeClass, statusText) {
    var badge = document.getElementById('bd-badge');
    var text = document.getElementById('bd-status-text');
    if (badge) { badge.textContent = badgeText; badge.className = 'badge ' + badgeClass; }
    if (text) { text.innerHTML = statusText; }
}

function _showBDStats(resumen) {
    var stats = document.getElementById('bd-stats');
    var fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    if (stats) stats.style.display = 'flex';
    document.getElementById('bd-stat-partidas').textContent = resumen.partidasCount || '—';
    document.getElementById('bd-stat-asignado').textContent = resumen.totalAsignado ? fmt.format(resumen.totalAsignado) : '—';
    document.getElementById('bd-stat-ejecutado').textContent = resumen.totalEjecutado ? fmt.format(resumen.totalEjecutado) : '—';
    document.getElementById('bd-stat-pct').textContent = (resumen.porcentaje != null) ? (resumen.porcentaje.toFixed(1) + '%') : '—';
}

/**
 * Inicializa la sección BD: checkea si hay data, muestra stats, configura botones.
 * Se llama automáticamente al cargar el iframe.
 */
function initBDSection() {
    if (!_bdState.anio) {
        _bdState.anio = _getCurrentAnio();
    }
    var anioLabel = document.getElementById('bd-year-label');
    if (anioLabel) anioLabel.textContent = _bdState.anio;

    _setBDStatus('verificando…', 'loading', 'Verificando si hay un presupuesto en la base de datos local para ' + _bdState.anio + '…');

    // Pedir check al parent
    window.parent.postMessage({ action: 'checkBDStatus', anio: _bdState.anio }, '*');
}

/**
 * Handler de la respuesta checkBDStatus
 */
function handleBDStatusResponse(data) {
    if (data.error && data.error.code === 'INTERNAL') {
        _setBDStatus('error', 'missing', '❌ Error verificando BD: ' + data.error.message);
        return;
    }

    if (!data.exists) {
        _bdState.hasData = false;
        _setBDStatus('no en bd', 'missing', '❌ No hay presupuesto en la base de datos local para ' + data.anio + '.');
        // Habilitar botón de importar (si hay Excel disponible)
        var btnImport = document.getElementById('bd-btn-import');
        if (btnImport) {
            btnImport.disabled = !latestFile; // Solo si hay un Excel seleccionado
            btnImport.title = latestFile ? 'Importar el Excel activo a la BD' : 'Selecciona primero un archivo de Excel (arriba)';
        }
        var btnResumen = document.getElementById('bd-btn-resumen');
        if (btnResumen) btnResumen.disabled = true;
        var btnReimport = document.getElementById('bd-btn-reimport');
        if (btnReimport) btnReimport.style.display = 'none';
        _updateMainButtonSource('excel');
    } else {
        _bdState.hasData = true;
        _bdState.presupuesto = data.presupuesto;
        _bdState.resumen = data.resumen;
        _setBDStatus('✓ en bd', 'ok',
            '✅ Presupuesto <strong>' + (data.presupuesto.nombre || 'sin nombre') + '</strong> en BD' +
            (data.presupuesto.actualizadoEn ? ' (actualizado: ' + new Date(data.presupuesto.actualizadoEn).toLocaleString('es-CO') + ')' : '') +
            '.'
        );
        if (data.resumen) {
            // Re-armar el shape esperado por _showBDStats
            var resumenShow = {
                partidasCount: data.resumen.partidasCount,
                totalAsignado: data.resumen.totalAsignado,
                totalEjecutado: data.resumen.totalEjecutado,
                porcentaje: data.resumen.porcentaje
            };
            _showBDStats(resumenShow);
        }
        var btnImport = document.getElementById('bd-btn-import');
        if (btnImport) btnImport.style.display = 'none';
        var btnResumen = document.getElementById('bd-btn-resumen');
        if (btnResumen) btnResumen.disabled = false;
        var btnReimport = document.getElementById('bd-btn-reimport');
        if (btnReimport) btnReimport.style.display = '';
        var btnEditBD = document.getElementById('bd-btn-edit-bd');
        if (btnEditBD) btnEditBD.style.display = '';
        var btnExport = document.getElementById('bd-btn-export');
        if (btnExport) btnExport.style.display = '';
        var btnAdd = document.getElementById('bd-btn-add');
        if (btnAdd) btnAdd.style.display = '';
        _updateMainButtonSource('bd');
    }
}

/**
 * 📦708 (Fase 6) — Actualiza el botón principal "Gestionar Presupuesto"
 * según la fuente preferida:
 *   - source='bd'    → muestra "📦 desde BD" + descripción indicando BD
 *   - source='excel' → muestra "📄 desde Excel" + descripción normal
 * Le dice al usuario de un vistazo qué fuente va a usar al hacer click.
 */
function _updateMainButtonSource(source) {
    var icon = document.getElementById('main-action-icon-gestionar');
    var title = document.getElementById('main-action-title-gestionar');
    var desc = document.getElementById('main-action-desc-gestionar');
    if (!title || !desc) return;
    if (source === 'bd') {
        if (icon) icon.className = 'fas fa-database';
        title.innerHTML = 'Gestionar Presupuesto <span style="font-size: 0.7rem; background: #d4edda; color: #155724; padding: 0.15rem 0.5rem; border-radius: 0.5rem; margin-left: 0.5rem; vertical-align: middle;">📦 BD</span>';
        desc.textContent = 'Abre el presupuesto desde la base de datos local (fuente principal). Incluye los cambios que hayas hecho en esta PC.';
    } else {
        if (icon) icon.className = 'fas fa-chart-line';
        title.innerHTML = 'Gestionar Presupuesto';
        desc.textContent = 'Ver y editar el presupuesto del año actual desde Excel (no hay datos en la base de datos local todavía).';
    }
}

/**
 * Importa el Excel activo a la BD
 */
async function importCurrentBudgetToBD() {
    if (!latestFile) {
        _showToast('No hay un archivo de Excel activo para importar. Abre uno desde "Histórico de Años".', 'warning');
        return;
    }
    var anio = _getCurrentAnio();
    var confirmed = await _confirmDialog().confirm({
        title: '¿Importar Excel a la BD?',
        message: 'Vas a importar el Excel "' + latestFile.name + '" a la base de datos local para ' + anio + '.',
        details: 'Esto crea un nuevo registro en la BD. Si ya existe, te preguntaremos si querés reemplazarlo.',
        confirmText: 'Importar',
        cancelText: 'Cancelar',
        type: 'info'
    });
    if (!confirmed) return;
    _setBDStatus('importando…', 'loading', 'Importando Excel a la base de datos…');
    window.parent.postMessage({
        action: 'importBudgetToBD',
        file: latestFile,
        anio: anio,
        overwrite: false
    }, '*');
}

/**
 * Re-importa (reemplaza) el Excel activo a la BD
 */
async function reimportBudgetToBD() {
    if (!latestFile) {
        _showToast('No hay un archivo de Excel activo para re-importar.', 'warning');
        return;
    }
    var anio = _getCurrentAnio();
    var confirmed = await _confirmDialog().confirm({
        title: '⚠️ ¿Reemplazar presupuesto en BD?',
        message: 'Esta acción va a REEMPLAZAR el presupuesto en BD con los datos del Excel "' + latestFile.name + '".',
        details: '<strong>Esta acción no se puede deshacer.</strong> El presupuesto actual se perderá (se mantiene como histórico en la tabla con activo=0).',
        confirmText: 'Sí, reemplazar',
        cancelText: 'Cancelar',
        type: 'warning'
    });
    if (!confirmed) return;
    _setBDStatus('reimportando…', 'loading', 'Reemplazando presupuesto en BD con datos del Excel…');
    window.parent.postMessage({
        action: 'importBudgetToBD',
        file: latestFile,
        anio: anio,
        overwrite: true
    }, '*');
}

/**
 * Handler de la respuesta importBudgetToBD
 */
async function handleBDImportResult(data) {
    if (data.success) {
        _showToast('✅ Importado a BD: ' + data.data.inserted + ' partidas, ' + data.data.valores + ' valores mensuales', 'success');
        // Refrescar el estado
        initBDSection();
    } else {
        var code = data.error ? data.error.code : 'INTERNAL';
        var msg = data.error ? data.error.message : 'Error desconocido';
        if (code === 'ALREADY_EXISTS') {
            var confirmed = await _confirmDialog().confirm({
                title: '⚠️ Ya existe un presupuesto',
                message: msg,
                details: '¿Querés REEMPLAZARLO con los datos del Excel actual? El presupuesto actual se reemplazará completamente.',
                confirmText: 'Sí, reemplazar',
                cancelText: 'Cancelar',
                type: 'warning'
            });
            if (confirmed) {
                _setBDStatus('reimportando…', 'loading', 'Reemplazando presupuesto en BD con datos del Excel…');
                var anio = _getCurrentAnio();
                window.parent.postMessage({
                    action: 'importBudgetToBD',
                    file: latestFile,
                    anio: anio,
                    overwrite: true
                }, '*');
                return;
            }
        }
        _setBDStatus('error', 'missing', '❌ Error importando: ' + msg);
        _showToast('❌ ' + code + ': ' + msg, 'error');
    }
}

/**
 * Pide al parent el resumen desde BD y lo muestra en un modal simple
 */
function viewBDResumen() {
    var anio = _getCurrentAnio();
    window.parent.postMessage({ action: 'viewBDResumen', anio: anio }, '*');
}

/**
 * 📦708 (Fase 3) — Abre la gestion view leyendo desde BD
 * El parent abre la vista de gestión con currentFile.source='BD' y
 * currentFile.presupuestoId. La gestion view pide datos vía
 * requestBudgetFromDB en vez de requestBudgetData.
 */
function editFromBD() {
    if (!_bdState.presupuesto) {
        _showToast('No hay presupuesto en BD para editar', 'warn');
        return;
    }
    window.parent.postMessage({
        action: 'openBudgetFromBD',
        presupuestoId: _bdState.presupuesto.id,
        anio: _bdState.presupuesto.anio
    }, '*');
}

/**
 * Handler de la respuesta viewBDResumen — muestra un modal con los datos
 */
function handleBDResumenResponse(data) {
    if (!data.success) {
        _showToast('No se pudo obtener el resumen: ' + (data.error ? data.error.message : 'error'), 'error');
        return;
    }
    if (!data.data.presupuesto) {
        _showToast('No hay presupuesto en BD para ' + data.anio, 'warning');
        return;
    }

    var p = data.data.presupuesto;
    var r = data.data.resumen;
    var partidas = data.data.partidas || [];
    var fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

    // Construir tabla de partidas
    var rows = '';
    if (partidas.length === 0) {
        rows = '<tr><td colspan="5" style="padding: 1rem; text-align: center; color: #6c757d;">No hay partidas.</td></tr>';
    } else {
        partidas.forEach(function(partida) {
            // 📦708 (Fase 3.5) — Cada fila tiene un botón 🗑️ para eliminar (soft delete)
            var safeLabel = escapeHtml(partida.concepto).replace(/'/g, "\\'");
            rows += '<tr style="border-bottom: 1px solid #f1f3f5;">' +
                '<td style="padding: 0.5rem 0.75rem; color: #6c757d;">' + partida.numero + '</td>' +
                '<td style="padding: 0.5rem 0.75rem;">' + escapeHtml(partida.concepto) + '</td>' +
                '<td style="padding: 0.5rem 0.75rem; text-align: right;">' + fmt.format(partida.asignado) + '</td>' +
                '<td style="padding: 0.5rem 0.75rem; text-align: right;">' +
                    '<span style="color: ' + (partida.porcentaje >= 80 ? '#28a745' : (partida.porcentaje >= 50 ? '#ffc107' : '#dc3545')) + ';">' +
                    partida.porcentaje.toFixed(1) + '%' +
                    '</span>' +
                '</td>' +
                '<td style="padding: 0.5rem 0.75rem; text-align: center;">' +
                    '<button class="bd-btn bd-btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" ' +
                    'onclick="eliminarPartidaFromBD(' + partida.id + ', \'' + safeLabel + '\')" ' +
                    'title="Eliminar (soft delete)">' +
                    '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</td>' +
            '</tr>';
        });
    }

    // Modal simple (overlay)
    var overlay = document.createElement('div');
    overlay.className = 'bd-resumen-modal';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;';
    overlay.innerHTML =
        '<div style="background: white; border-radius: 12px; max-width: 900px; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%;">' +
            '<div style="padding: 1.5rem 2rem; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">' +
                '<h2 style="margin: 0; font-size: 1.25rem; color: #174ea6;">' + escapeHtml(p.nombre || 'Presupuesto') + ' (' + p.anio + ')</h2>' +
                '<div style="display: flex; gap: 0.5rem; align-items: center;">' +
                    '<button class="bd-btn bd-btn-secondary" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" onclick="updatePresupuestoMeta()" title="Editar nombre y notas">' +
                        '<i class="fas fa-edit"></i> Editar' +
                    '</button>' +
                    '<button class="bd-btn bd-btn-primary" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;" onclick="addPartidaToBD()" title="Agregar partida">' +
                        '<i class="fas fa-plus"></i> + Partida' +
                    '</button>' +
                    '<button id="modal-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6c757d; padding: 0 0.5rem;">&times;</button>' +
                '</div>' +
            '</div>' +
            '<div style="padding: 1.5rem 2rem;">' +
                '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">' +
                    '<div style="background: #f8f9fa; padding: 0.75rem; border-radius: 6px;">' +
                        '<div style="font-size: 0.7rem; text-transform: uppercase; color: #6c757d;">Asignado</div>' +
                        '<div style="font-size: 1.1rem; font-weight: 700; color: #174ea6;">' + fmt.format(r.totalAsignado) + '</div>' +
                    '</div>' +
                    '<div style="background: #f8f9fa; padding: 0.75rem; border-radius: 6px;">' +
                        '<div style="font-size: 0.7rem; text-transform: uppercase; color: #6c757d;">Ejecutado</div>' +
                        '<div style="font-size: 1.1rem; font-weight: 700; color: #28a745;">' + fmt.format(r.totalEjecutado) + '</div>' +
                    '</div>' +
                    '<div style="background: #f8f9fa; padding: 0.75rem; border-radius: 6px;">' +
                        '<div style="font-size: 0.7rem; text-transform: uppercase; color: #6c757d;">% Cumplimiento</div>' +
                        '<div style="font-size: 1.1rem; font-weight: 700; color: ' + (r.porcentaje >= 80 ? '#28a745' : (r.porcentaje >= 50 ? '#ffc107' : '#dc3545')) + ';">' + r.porcentaje.toFixed(1) + '%</div>' +
                    '</div>' +
                    '<div style="background: #f8f9fa; padding: 0.75rem; border-radius: 6px;">' +
                        '<div style="font-size: 0.7rem; text-transform: uppercase; color: #6c757d;">Saldo</div>' +
                        '<div style="font-size: 1.1rem; font-weight: 700; color: #174ea6;">' + fmt.format(r.saldo) + '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="overflow-x: auto;">' +
                    '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">' +
                        '<thead>' +
                            '<tr style="background: #f1f3f5;">' +
                                '<th style="padding: 0.5rem 0.75rem; text-align: left;">#</th>' +
                                '<th style="padding: 0.5rem 0.75rem; text-align: left;">Concepto</th>' +
                                '<th style="padding: 0.5rem 0.75rem; text-align: right;">Asignado</th>' +
                                '<th style="padding: 0.5rem 0.75rem; text-align: right;">% Ejec.</th>' +
                                '<th style="padding: 0.5rem 0.75rem; text-align: center;">Acciones</th>' +
                            '</tr>' +
                        '</thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<p style="margin-top: 1rem; font-size: 0.75rem; color: #6c757d;">' +
                    '📦708 (Fase 3.5) · Datos leídos desde la base de datos local (presupuesto-bridge.js). ' +
                    'Podés agregar partidas con el botón <strong>+ Partida</strong>, editar nombre/notas con <strong>Editar</strong>, o eliminar con 🗑️ (soft delete).' +
                '</p>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    document.getElementById('modal-close').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

// ============================================================
// 📦708 (Fase 5) — Exportar a Excel
// Genera un .xlsx desde la BD usando el formato ACT-FO-043 que ya conocés.
// ============================================================

function exportBudgetToExcel() {
    if (!_bdState.presupuesto) {
        _showToast('No hay presupuesto en BD para exportar', 'warn');
        return;
    }
    var anio = _bdState.presupuesto.anio || _getCurrentAnio();
    var defaultName = 'ACT-FO-043 Presupuesto SG-SST ' + anio + ' ' + (_bdState.presupuesto.empresaId || '') + '.xlsx';
    _setBDStatus('exportando…', 'loading', 'Generando archivo Excel desde la base de datos…');
    // Llamamos al parent con outputPath vacío → el main process muestra
    // un dialog "Save As" automáticamente.
    window.parent.postMessage({
        action: 'exportBudgetToExcel',
        presupuestoId: _bdState.presupuesto.id,
        anio: anio
    }, '*');
}

function handleBDExportResult(data) {
    if (data.success) {
        _showToast('Excel exportado: ' + data.data.path, 'success');
        _setBDStatus('✓ en bd', 'ok',
            '✅ Presupuesto <strong>' + (_bdState.presupuesto.nombre || 'sin nombre') + '</strong> en BD. ' +
            'Última exportación: ' + new Date().toLocaleString('es-CO') + '.'
        );
    } else {
        var msg = data.error ? data.error.message : 'Error desconocido';
        var code = data.error ? data.error.code : 'INTERNAL';
        if (code === 'CANCELLED') {
            _setBDStatus('✓ en bd', 'ok', 'Exportación cancelada. El presupuesto sigue en BD sin cambios.');
            return;
        }
        _setBDStatus('error', 'missing', '❌ Error exportando: ' + msg);
        _showToast(code + ': ' + msg, 'error');
    }
}

// ============================================================
// 📦708 (Fase 3.5) — Handlers granulares (add/delete/update)
// Permiten add/delete/update desde la UI sin pasar por bulk-save.
// La UI muestra KairConfirm.input() moderno y el flujo:
//   home.js → postMessage → logic.js → IPC → bridge → BD
// ============================================================

/**
 * Abre un dialog moderno para crear una partida nueva.
 * Usa KairConfirm.input() (estilo 6.1.2). Pide concepto + asignado anual
 * (opcional descripción).
 */
async function addPartidaToBD() {
    if (!_bdState.presupuesto || !_bdState.presupuesto.id) {
        _showToast('No hay presupuesto en BD para agregar partidas', 'warning');
        return;
    }
    var p = _bdState.presupuesto;
    var values = await _confirmDialog().input({
        title: '+ Nueva Partida',
        message: 'Agregá una partida al presupuesto "' + (p.nombre || 'sin nombre') + '" (' + p.anio + ').',
        details: 'El asignado anual se distribuye uniformemente en los 12 meses. El ejecutado arranca en 0.',
        fields: [
            { key: 'concepto', label: 'Concepto', type: 'text', required: true, placeholder: 'Ej: Capacitación SG-SST' },
            { key: 'asignadoTotal', label: 'Asignado anual (COP)', type: 'number', placeholder: '0' },
            { key: 'descripcion', label: 'Descripción (opcional)', type: 'textarea', placeholder: 'Detalle o notas de la partida' }
        ],
        confirmText: 'Crear partida',
        cancelText: 'Cancelar',
        type: 'info'
    });
    if (!values) return; // canceló
    if (!values.concepto) {
        _showToast('El concepto es obligatorio', 'warning');
        return;
    }
    _setBDStatus('creando…', 'loading', 'Creando partida "' + values.concepto + '" en BD…');
    window.parent.postMessage({
        action: 'addPartidaToBD',
        presupuestoId: p.id,
        concepto: values.concepto,
        descripcion: values.descripcion || null,
        asignadoTotal: values.asignadoTotal || 0
    }, '*');
}

/**
 * Confirma y elimina (soft delete) una partida del presupuesto activo.
 * @param {number} partidaId - ID de la partida en BD
 * @param {string} label - Texto a mostrar en la confirmación (ej: "Capacitación SG-SST")
 */
async function eliminarPartidaFromBD(partidaId, label) {
    if (!_bdState.presupuesto) {
        _showToast('No hay presupuesto activo en BD', 'warning');
        return;
    }
    var display = label || ('partida #' + partidaId);
    var confirmed = await _confirmDialog().confirm({
        title: '¿Eliminar partida?',
        message: 'Vas a eliminar la partida "' + display + '" del presupuesto ' + _bdState.presupuesto.anio + '.',
        details: 'Esto hace un soft delete (la partida queda con activo=0 pero se preserva para histórico). Los valores mensuales también se ocultan.',
        confirmText: 'Sí, eliminar',
        cancelText: 'Cancelar',
        type: 'warning'
    });
    if (!confirmed) return;
    _setBDStatus('eliminando…', 'loading', 'Eliminando partida "' + display + '"…');
    window.parent.postMessage({
        action: 'deletePartidaFromBD',
        partidaId: partidaId
    }, '*');
}

/**
 * Edita el nombre y las notas del presupuesto activo.
 */
async function updatePresupuestoMeta() {
    if (!_bdState.presupuesto) {
        _showToast('No hay presupuesto en BD para editar', 'warning');
        return;
    }
    var p = _bdState.presupuesto;
    var values = await _confirmDialog().input({
        title: '✏️ Editar presupuesto',
        message: 'Cambiá el nombre y las notas del presupuesto ' + p.anio + '.',
        fields: [
            { key: 'nombre', label: 'Nombre', type: 'text', required: true, value: p.nombre || '', placeholder: 'Ej: Presupuesto SG-SST 2026' },
            { key: 'notas', label: 'Notas', type: 'textarea', value: p.notas || '', placeholder: 'Notas u observaciones del presupuesto' }
        ],
        confirmText: 'Guardar cambios',
        cancelText: 'Cancelar',
        type: 'info'
    });
    if (!values) return;
    if (!values.nombre) {
        _showToast('El nombre es obligatorio', 'warning');
        return;
    }
    _setBDStatus('guardando…', 'loading', 'Actualizando nombre y notas del presupuesto…');
    window.parent.postMessage({
        action: 'updatePresupuestoMeta',
        presupuestoId: p.id,
        nombre: values.nombre,
        notas: values.notas || null
    }, '*');
}

/**
 * Helper: cierra el modal de resumen si está abierto
 */
function _closeBDResumenModal() {
    var modals = document.querySelectorAll('.bd-resumen-modal');
    modals.forEach(function(m) { m.remove(); });
}

/**
 * Handler de la respuesta addPartidaToBD — toast + refresh + cerrar modal
 */
function handlePartidaAddedResponse(data) {
    if (data.success) {
        var label = (data.data && data.data.concepto) ? '"' + data.data.concepto + '"' : 'OK';
        _showToast('✅ Partida creada: ' + label, 'success');
        // Cerrar modal si está abierto y refrescar
        _closeBDResumenModal();
        // Refrescar el estado (recarga stats y muestra los nuevos botones)
        initBDSection();
    } else {
        var msg = data.error ? data.error.message : 'Error desconocido';
        var code = data.error ? data.error.code : 'INTERNAL';
        _setBDStatus('error', 'missing', '❌ Error creando partida: ' + msg);
        _showToast(code + ': ' + msg, 'error');
    }
}

/**
 * Handler de la respuesta deletePartidaFromBD — toast + refresh + cerrar modal
 */
function handlePartidaDeletedResponse(data) {
    if (data.success) {
        _showToast('✅ Partida eliminada', 'success');
        // Cerrar modal si está abierto y refrescar
        _closeBDResumenModal();
        // Refrescar el estado
        initBDSection();
    } else {
        var msg = data.error ? data.error.message : 'Error desconocido';
        var code = data.error ? data.error.code : 'INTERNAL';
        _setBDStatus('error', 'missing', '❌ Error eliminando: ' + msg);
        _showToast(code + ': ' + msg, 'error');
    }
}

/**
 * Handler de la respuesta updatePresupuestoMeta — toast + refresh + cerrar modal
 */
function handleMetaUpdatedResponse(data) {
    if (data.success) {
        _showToast('✅ Presupuesto actualizado', 'success');
        // Cerrar modal si está abierto y refrescar
        _closeBDResumenModal();
        // Refrescar el estado
        initBDSection();
    } else {
        var msg = data.error ? data.error.message : 'Error desconocido';
        var code = data.error ? data.error.code : 'INTERNAL';
        _setBDStatus('error', 'missing', '❌ Error actualizando: ' + msg);
        _showToast(code + ': ' + msg, 'error');
    }
}

// Hook: después de detectar el año activo, inicializar la sección BD
// (se hace con un pequeño delay para que el DOM esté listo)
// El `latestFile` se setea en detectCurrentYearBudget cuando llega la lista de archivos
(function() {
    var originalDetect = detectCurrentYearBudget;
    detectCurrentYearBudget = function(files) {
        originalDetect(files);
        // Después de detectar el año, inicializar la sección BD
        setTimeout(initBDSection, 200);
    };
})();
