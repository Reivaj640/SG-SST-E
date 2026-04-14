// ============================================================================
// enviar-remision.js — Enviar Remisiones Médicas (3.1.6)
// Conecta con backend IPC via postMessage bridge (restricciones-medicas-logic.js)
// Protocolo moderno: field "type" con requestId "env-"
// ============================================================================
(function () {
    'use strict';

    // ─── Estado ─────────────────────────────────────────────────────────
    var companyName = '';
    var moduleName = '';
    var submoduleName = '';
    var extractedData = {};
    var lastDocumentPath = null;
    var toastTimeout = null;
    var currentStep = 1;

    // ─── Comunicación con parent (restricciones-medicas-logic.js) ────────
    function callParentAPI(type, payload) {
        return new Promise(function (resolve, reject) {
            var requestId = 'env-' + Date.now() + '-' + Math.random();

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
            }, 20000);
        });
    }

    // ─── Inicialización ──────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        var params = new URLSearchParams(window.location.search);
        companyName  = params.get('company')    || '';
        moduleName   = params.get('module')     || '';
        submoduleName = params.get('submodule') || '';

        console.log('[ENV-REM] Iniciando. Company:', companyName);
        setupEventListeners();
        logEntry('Listo para seleccionar un archivo PDF de remisión.', 'info');
    });

    // ─── Listeners de UI ─────────────────────────────────────────────────
    function setupEventListeners() {
        // Volver
        document.getElementById('backBtn').addEventListener('click', function () {
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        });

        // Drop zone — click invoca el diálogo nativo del backend
        var dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('click', selectPdfFile);

        // Drag & drop
        dropZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', function (e) {
            e.preventDefault();
            e.stopPropagation();
            this.classList.remove('dragover');
            // Aunque el archivo se arrastra, usamos la ruta nativa vía diálogo
            // ya que el acceso a rutas locales en Electron requiere el canal IPC
            showToast('Selección', 'Por favor usa el botón para seleccionar el archivo.', 'info');
        });

        // Generar
        document.getElementById('generateBtn').addEventListener('click', generateDocument);

        // WhatsApp
        document.getElementById('whatsappBtn').addEventListener('click', sendWhatsApp);

        // Correo
        document.getElementById('emailBtn').addEventListener('click', sendEmail);

        // Limpiar log
        document.getElementById('logClearBtn').addEventListener('click', clearLog);

        // Toast close
        document.getElementById('toastClose').addEventListener('click', hideToast);
    }

    // ─── Paso 1: Seleccionar PDF ─────────────────────────────────────────
    async function selectPdfFile() {
        try {
            logEntry('Abriendo diálogo de selección de archivo...', 'info');
            var result = await callParentAPI('select-pdf-file', null);

            if (!result.filePath) {
                logEntry('Selección cancelada.', 'warning');
                return;
            }

            showFileSelected(result.filePath);
            await processPdf(result.filePath);

        } catch (err) {
            console.error('[ENV-REM] Error seleccionando archivo:', err);
            logEntry('Error al abrir selector: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
        }
    }

    function showFileSelected(filePath) {
        var dropZone   = document.getElementById('dropZone');
        var dropIcon   = document.getElementById('dropIcon');
        var dropTitle  = document.getElementById('dropTitle');
        var pathDisplay = document.getElementById('filePathDisplay');

        dropZone.classList.add('has-file');
        dropIcon.className = 'fas fa-file-pdf env-drop-icon';
        dropTitle.textContent = 'Archivo seleccionado';

        var fileName = filePath.split('\\').pop().split('/').pop();
        pathDisplay.textContent = fileName;
        pathDisplay.title = filePath;
        pathDisplay.classList.remove('hidden');

        logEntry('Archivo: ' + filePath, 'info');
    }

    // ─── Procesar PDF ────────────────────────────────────────────────────
    async function processPdf(filePath) {
        var indicator = document.getElementById('processingIndicator');
        indicator.classList.remove('hidden');

        try {
            logEntry('Procesando PDF y extrayendo datos...', 'info');
            var result = await callParentAPI('process-remision-pdf', { filePath: filePath });

            indicator.classList.add('hidden');

            if (result.success && result.data) {
                extractedData = result.data;
                renderExtractedFields(result.data);
                revealStep(2);
                setStepDone(1);
                logEntry('Datos extraídos correctamente. Verifica y edita si es necesario.', 'success');
                showToast('PDF procesado', 'Datos extraídos. Revisa los campos antes de continuar.', 'success');

                // Tras verificar datos, navegar a la sección de generar informe
                logEntry('Redirigiendo a generación de informe oficial...', 'info');
                setTimeout(function() {
                    navigateToGenerarInforme();
                }, 1500);
            } else {
                var errMsg = (result && result.error) || 'No se pudieron extraer datos del PDF.';
                logEntry('Error en extracción: ' + errMsg, 'error');
                showToast('Error de extracción', errMsg, 'error');
                resetDropZone();
            }
        } catch (err) {
            indicator.classList.add('hidden');
            console.error('[ENV-REM] Error procesando PDF:', err);
            logEntry('Error crítico al procesar PDF: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
            resetDropZone();
        }
    }

    function resetDropZone() {
        var dropZone  = document.getElementById('dropZone');
        var dropIcon  = document.getElementById('dropIcon');
        var dropTitle = document.getElementById('dropTitle');
        var pathDisplay = document.getElementById('filePathDisplay');

        dropZone.classList.remove('has-file');
        dropIcon.className = 'fas fa-cloud-upload-alt env-drop-icon';
        dropTitle.textContent = 'Arrastra un PDF de remisión aquí';
        pathDisplay.classList.add('hidden');
    }

    // ─── Renderizar campos extraídos ─────────────────────────────────────
    function renderExtractedFields(data) {
        var grid = document.getElementById('fieldsGrid');
        grid.innerHTML = '';

        Object.keys(data).forEach(function (key) {
            var row = document.createElement('div');
            row.className = 'env-field-row';

            var label = document.createElement('span');
            label.className = 'env-field-label';
            label.textContent = key;
            label.title = key;

            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'env-field-input';
            input.value = data[key] != null ? String(data[key]) : '';
            input.dataset.field = key;
            input.addEventListener('change', function () {
                extractedData[this.dataset.field] = this.value;
            });

            row.appendChild(label);
            row.appendChild(input);
            grid.appendChild(row);
        });
    }

    function collectFieldValues() {
        var inputs = document.querySelectorAll('#fieldsGrid .env-field-input');
        var data = Object.assign({}, extractedData);
        inputs.forEach(function (input) {
            data[input.dataset.field] = input.value;
        });
        return data;
    }

    // ─── Paso 3: Generar documento ───────────────────────────────────────
    async function generateDocument() {
        var btn = document.getElementById('generateBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

        try {
            var data = collectFieldValues();
            
            // Agregar empresa a los datos
            data['Afiliación'] = companyName;
            data['Empresa'] = companyName;
            
            logEntry('Generando documento de remisión...', 'info');

            var result = await callParentAPI('generate-remision-doc', {
                extractedData: data
            }, companyName);

            if (result.success) {
                lastDocumentPath = result.documentPath;
                logEntry('Documento generado: ' + (result.documentPath || ''), 'success');
                if (result.controlPath) {
                    logEntry('Control actualizado: ' + result.controlPath, 'info');
                }
                enableSendButtons();
                setStepDone(2);
                revealStep(3);

                var hint = document.getElementById('generateHint');
                var hintText = document.getElementById('generateHintText');
                hintText.textContent = 'Documento guardado correctamente';
                hint.classList.remove('hidden');

                showToast('Documento generado', 'El documento fue generado y guardado.', 'success');
            } else {
                var errMsg = (result && result.error) || 'Error al generar documento.';
                logEntry('Error: ' + errMsg, 'error');
                showToast('Error al generar', errMsg, 'error');
            }
        } catch (err) {
            console.error('[ENV-REM] Error generando documento:', err);
            logEntry('Error crítico al generar: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-alt"></i> Generar y Guardar Documento';
        }
    }

    function enableSendButtons() {
        document.getElementById('whatsappBtn').disabled = false;
        document.getElementById('emailBtn').disabled = false;
    }

    // ─── Enviar por WhatsApp ─────────────────────────────────────────────
    async function sendWhatsApp() {
        if (!lastDocumentPath) {
            showToast('Sin documento', 'Primero genera el documento.', 'warning');
            return;
        }

        var btn = document.getElementById('whatsappBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparando...';

        try {
            logEntry('Preparando envío por WhatsApp...', 'info');
            var data = collectFieldValues();

            var result = await callParentAPI('send-remision-whatsapp', {
                documentPath: lastDocumentPath,
                extractedData: data
            });

            if (result.success) {
                logEntry('WhatsApp Web abierto con mensaje preparado.', 'success');
                showToast('WhatsApp listo', 'Se abrió WhatsApp Web. Revisa y envía el mensaje.', 'success');
                setStepDone(3);
            } else {
                var errMsg = (result && result.error) || 'Error al preparar WhatsApp.';
                logEntry('Error WhatsApp: ' + errMsg, 'error');
                showToast('Error WhatsApp', errMsg, 'error');
            }
        } catch (err) {
            console.error('[ENV-REM] Error WhatsApp:', err);
            logEntry('Error crítico WhatsApp: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar por WhatsApp';
        }
    }

    // ─── Enviar por Correo ───────────────────────────────────────────────
    async function sendEmail() {
        if (!lastDocumentPath) {
            showToast('Sin documento', 'Primero genera el documento.', 'warning');
            return;
        }

        var btn = document.getElementById('emailBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            logEntry('Enviando por correo electrónico...', 'info');
            var data = collectFieldValues();

            var result = await callParentAPI('send-remision-email', {
                documentPath: lastDocumentPath,
                extractedData: data
            });

            if (result.success) {
                logEntry('Correo enviado exitosamente.', 'success');
                showToast('Correo enviado', 'El correo fue enviado correctamente.', 'success');
                setStepDone(3);
            } else {
                var errMsg = (result && result.error) || 'Error al enviar correo.';
                logEntry('Error correo: ' + errMsg, 'error');
                showToast('Error al enviar', errMsg, 'error');
            }
        } catch (err) {
            console.error('[ENV-REM] Error correo:', err);
            logEntry('Error crítico correo: ' + err.message, 'error');
            showToast('Error', err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope"></i> Enviar por Correo';
        }
    }

    // ─── Gestión de pasos ────────────────────────────────────────────────
    function revealStep(stepNum) {
        var cardId = 'step' + stepNum + 'Card';
        var card = document.getElementById(cardId);
        if (!card) return;
        card.classList.remove('hidden');
        card.classList.add('revealing');
        card.addEventListener('animationend', function () {
            card.classList.remove('revealing');
        }, { once: true });

        setStepActive(stepNum);

        // Scroll suave hacia la nueva tarjeta
        setTimeout(function () {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    function setStepActive(stepNum) {
        var node = document.getElementById('stepNode' + stepNum);
        if (!node) return;
        node.classList.remove('done');
        node.classList.add('active');
        currentStep = stepNum;
    }

    function setStepDone(stepNum) {
        var node   = document.getElementById('stepNode' + stepNum);
        var circle = document.getElementById('stepCircle' + stepNum);
        var badge  = document.getElementById('step' + stepNum + 'Badge');
        var status = document.getElementById('step' + stepNum + 'Status');
        var card   = document.getElementById('step' + stepNum + 'Card');
        var line   = document.getElementById('stepLine' + stepNum);

        if (node)   { node.classList.remove('active'); node.classList.add('done'); }
        if (circle) { circle.innerHTML = '<i class="fas fa-check"></i>'; }
        if (badge)  { badge.innerHTML  = '<i class="fas fa-check"></i>'; }
        if (status) { status.textContent = 'Completado'; status.className = 'env-card-status done'; }
        if (card)   { card.classList.add('step-done'); }
        if (line)   { line.classList.add('done'); }
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

    // ─── Navegar a generar informe ─────────────────────────────────────
    function navigateToGenerarInforme() {
        window.parent.postMessage({
            type: 'navigate-to-generar-informe-request',
            payload: { extractedData: extractedData }
        }, '*');
    }

})();
