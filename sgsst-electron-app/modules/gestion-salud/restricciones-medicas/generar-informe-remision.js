// ============================================================================
// generar-informe-remision.js — Generar Informe de Remisión Médica (3.1.6)
// Paso intermedio entre verificar datos y enviar por WhatsApp/Correo
// ============================================================================
(function () {
    'use strict';

    // ─── Estado ─────────────────────────────────────────────────────────
    var companyName = '';
    var moduleName = '';
    var submoduleName = '';
    var extractedData = {};
    var generatedDocumentPath = null;
    var toastTimeout = null;

    // ─── Comunicación con parent ─────────────────────────────────────────
    function callParentAPI(type, payload) {
        return new Promise(function (resolve, reject) {
            var requestId = 'inf-' + Date.now() + '-' + Math.random();

            function handleResponse(event) {
                if (event.source !== window.parent) return;
                var r = event.data;
                if (r && r.type === (type + '-response') && r.requestId === requestId) {
                    window.removeEventListener('message', handleResponse);
                    if (r.payload && r.payload.success) {
                        resolve(r.payload);
                    } else {
                        var msg = (r.payload && r.payload.error) || 'Error desconocido';
                        reject(new Error(typeof msg === 'object' ? msg.message || JSON.stringify(msg) : msg));
                    }
                }
            }

            window.addEventListener('message', handleResponse);
            window.parent.postMessage({ type: type + '-request', payload: payload, requestId: requestId }, '*');

            setTimeout(function () {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Timeout esperando respuesta para: ' + type));
            }, 30000);
        });
    }

    // ─── Inicialización ──────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        var params = new URLSearchParams(window.location.search);
        companyName   = params.get('company')    || '';
        moduleName    = params.get('module')     || '';
        submoduleName = params.get('submodule')  || '';

        // Intentar recibir datos desde URL params (data)
        var dataParam = params.get('data');
        if (dataParam) {
            try {
                extractedData = JSON.parse(decodeURIComponent(dataParam));
                renderSummary(extractedData);
                updateDocPreview(extractedData);
                logEntry('Datos recibidos vía URL. Revise antes de generar el informe.', 'info');
            } catch (e) {
                console.error('[INF-REM] Error parseando datos URL:', e);
            }
        }

        // Escuchar datos del parent (enviados al cargar el iframe)
        window.addEventListener('message', function (e) {
            var data = e.data;
            if (data && data.type === 'informe-data-response' && data.payload && data.payload.extractedData) {
                extractedData = data.payload.extractedData;
                renderSummary(extractedData);
                updateDocPreview(extractedData);
                logEntry('Datos recibidos del módulo padre. Revise antes de generar.', 'info');
                showToast('Datos cargados', 'Revise los datos indexados antes de generar el informe.', 'info');
            }
        });

        // Solicitar datos al parent si no vinieron por URL
        if (!dataParam) {
            requestInitialData();
        }

        setupEventListeners();
    });

    function requestInitialData() {
        var requestId = 'inf-init-' + Date.now();

        function handleInitResponse(event) {
            if (event.source !== window.parent) return;
            var r = event.data;
            if (r && r.type === 'informe-data-response' && r.requestId === requestId) {
                window.removeEventListener('message', handleInitResponse);
                if (r.payload && r.payload.extractedData) {
                    extractedData = r.payload.extractedData;
                    renderSummary(extractedData);
                    updateDocPreview(extractedData);
                    logEntry('Datos recibidos. Revise antes de generar el informe.', 'info');
                }
            }
        }

        window.addEventListener('message', handleInitResponse);
        window.parent.postMessage({ type: 'informe-data-request', requestId: requestId }, '*');
    }

    // ─── Listeners de UI ─────────────────────────────────────────────────
    function setupEventListeners() {
        // Volver
        document.getElementById('backBtn').addEventListener('click', function () {
            window.parent.postMessage({ type: 'back-to-verify-request' }, '*');
        });

        // Generar
        document.getElementById('generateBtn').addEventListener('click', generateDocument);

        // Continuar al envío
        document.getElementById('continueBtn').addEventListener('click', function () {
            window.parent.postMessage({
                type: 'continue-to-send-request',
                payload: { documentPath: generatedDocumentPath, extractedData: extractedData }
            }, '*');
        });

        // Limpiar log
        document.getElementById('logClearBtn').addEventListener('click', clearLog);

        // Toast close
        document.getElementById('toastClose').addEventListener('click', hideToast);
    }

    // ─── Renderizar resumen de datos (3A) ────────────────────────────────
    function renderSummary(data) {
        var grid = document.getElementById('summaryGrid');
        grid.innerHTML = '';

        // Campos críticos que se muestran primero
        var criticalFields = [
            'Nombre Completo',
            'No. Identificación',
            'Fecha de Atención',
            'Cargo',
            'Afiliación',
            'Evaluación Ocupacional'
        ];

        // Campos adicionales
        var additionalFields = [
            'Edad', 'Sexo', 'Fecha Nac', 'Estado civil',
            'Exámenes realizados',
            'Recomendaciones Laborales',
            'Restricciones Laborales',
            'Concepto Medico',
            'Incluir SVE',
            'Concepto Manipulación Alimento',
            'Concepto Altura',
            'Concepto de trabajo en espacios confinados',
            'Motivo de Restricción'
        ];

        // Renderizar campos críticos
        criticalFields.forEach(function (key) {
            if (data[key] !== undefined) {
                grid.appendChild(createSummaryItem(key, data[key], true));
            }
        });

        // Renderizar campos adicionales
        additionalFields.forEach(function (key) {
            if (data[key] !== undefined) {
                grid.appendChild(createSummaryItem(key, data[key], false));
            }
        });
    }

    function createSummaryItem(label, value, isCritical) {
        var item = document.createElement('div');
        item.className = 'env-summary-item' + (isCritical ? ' critical' : '');

        var labelEl = document.createElement('span');
        labelEl.className = 'env-summary-label';
        labelEl.textContent = label;

        var valueEl = document.createElement('span');
        valueEl.className = 'env-summary-value';
        valueEl.textContent = value || 'No disponible';

        item.appendChild(labelEl);
        item.appendChild(valueEl);
        return item;
    }

    // ─── Actualizar vista previa del documento (3B) ──────────────────────
    function updateDocPreview(data) {
        var nombre = (data['Nombre Completo'] || 'sin_nombre').replace(/[^a-zA-Z0-9\s]/g, '');
        var fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        var fileName = 'GI-OD-007 REMISION A EPS ' + nombre + ' ' + fecha + '.docx';

        document.getElementById('docOutputName').textContent = fileName;
    }

    // ─── Generar documento (3C) ──────────────────────────────────────────
    async function generateDocument() {
        var btn = document.getElementById('generateBtn');
        var indicator = document.getElementById('processingIndicator');
        var successMsg = document.getElementById('successMessage');
        var continueSection = document.getElementById('continueSection');
        var generateStatus = document.getElementById('generateStatus');
        var docStatus = document.getElementById('docStatus');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        indicator.classList.remove('hidden');

        try {
            logEntry('Generando informe oficial de remisión...', 'info');

            var result = await callParentAPI('generate-remision-doc', {
                extractedData: extractedData
            });

            indicator.classList.add('hidden');

            if (result.success) {
                generatedDocumentPath = result.documentPath;

                // Actualizar UI
                btn.classList.add('hidden');
                successMsg.classList.remove('hidden');
                
                // Mostrar sección de continuar (remover hidden y agregar animación)
                continueSection.classList.remove('hidden');
                continueSection.classList.remove('revealing');
                continueSection.classList.add('revealing');
                continueSection.addEventListener('animationend', function () {
                    continueSection.classList.remove('revealing');
                }, { once: true });

                // Actualizar statuses
                generateStatus.textContent = 'Generado';
                generateStatus.className = 'env-card-status done';
                docStatus.textContent = 'Listo';
                docStatus.className = 'env-card-status done';

                logEntry('Informe generado: ' + (result.documentPath || ''), 'success');
                if (result.controlPath) {
                    logEntry('Control actualizado: ' + result.controlPath, 'info');
                }

                showToast('Informe generado', 'El documento oficial fue creado exitosamente.', 'success');
            } else {
                var errMsg = (result && result.error) || 'Error al generar documento.';
                logEntry('Error: ' + errMsg, 'error');
                showToast('Error al generar', errMsg, 'error');
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-file-alt"></i> Intentar de Nuevo';
            }
        } catch (err) {
            indicator.classList.add('hidden');
            console.error('[INF-REM] Error generando documento:', err);
            logEntry('Error crítico: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-alt"></i> Intentar de Nuevo';
        }
    }

    // ─── Log de actividad ────────────────────────────────────────────────
    function logEntry(message, type) {
        type = type || 'info';

        var empty = document.getElementById('logEmpty');
        if (empty) empty.classList.add('hidden');

        var icons = {
            info:    'fas fa-info-circle',
            success: 'fas fa-check-circle',
            error:   'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle'
        };

        var now = new Date();
        var time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        var entry = document.createElement('div');
        entry.className = 'env-log-entry ' + type;
        entry.innerHTML =
            '<i class="' + (icons[type] || icons.info) + ' env-log-icon"></i>' +
            '<span class="env-log-text">' + escapeHtml(message) + '</span>' +
            '<small class="env-log-time">' + time + '</small>';

        var container = document.getElementById('logEntries');
        container.insertBefore(entry, container.firstChild);
    }

    function clearLog() {
        var container = document.getElementById('logEntries');
        container.innerHTML =
            '<div class="env-log-empty" id="logEmpty">' +
            '  <i class="fas fa-inbox"></i>' +
            '  <span>Sin actividad registrada</span>' +
            '</div>';
    }

    // ─── Toast ───────────────────────────────────────────────────────────
    function showToast(title, message, type) {
        type = type || 'info';
        var toast   = document.getElementById('toast');
        var icon    = document.getElementById('toastIcon');
        var titleEl = document.getElementById('toastTitle');
        var msgEl   = document.getElementById('toastMessage');

        var icons = {
            success: 'fas fa-check-circle',
            error:   'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info:    'fas fa-info-circle'
        };

        toast.className = 'env-toast ' + type;
        icon.className  = 'env-toast-icon ' + (icons[type] || icons.info);
        titleEl.textContent = title;
        msgEl.textContent   = message;

        if (toastTimeout) clearTimeout(toastTimeout);
        requestAnimationFrame(function () { toast.classList.add('show'); });

        toastTimeout = setTimeout(function () {
            toast.classList.remove('show');
        }, 4500);
    }

    function hideToast() {
        document.getElementById('toast').classList.remove('show');
        if (toastTimeout) clearTimeout(toastTimeout);
    }

    // ─── Utilidades ──────────────────────────────────────────────────────
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

})();
