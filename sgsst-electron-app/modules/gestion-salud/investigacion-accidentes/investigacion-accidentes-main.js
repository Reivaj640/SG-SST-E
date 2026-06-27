// investigacion-accidentes-main.js - Script principal para la interfaz moderna de investigación de accidentes

document.addEventListener('DOMContentLoaded', function() {
    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Script cargado y DOM listo');

    // Elementos del DOM
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const dropZoneContent = document.getElementById('dropZoneContent');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const selectedFileName = document.getElementById('selectedFileName');
    const selectedFileSize = document.getElementById('selectedFileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const processBtn = document.getElementById('processBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const progressArea = document.getElementById('progressArea');
    const activityLog = document.getElementById('activityLog');
    const dataContent = document.getElementById('dataContent');
    const analysisContent = document.getElementById('analysisContent');
    const backBtn = document.getElementById('backBtn');
    const companyNameElement = document.getElementById('companyName');

    // Variables de estado
    let selectedPdfPath = null;
    let extractedData = null;
    let analysisResult = null;
    let lastReportPath = null;   // ruta del último informe .docx generado
    let isAnalyzing = false;     // guard contra doble-click en Iniciar Análisis

    // ── Estado de revisión del análisis (feature nuevo) ──
    let analysisState = 'idle';     // 'idle' | 'reviewing' | 'approved' | 'dirty'
    let analysisEdits = {};         // {PorQue1: {Mano de Obra: 'edit', ...}, ...} — ediciones inline del usuario
    let analysisOriginalBackup = null;  // copia profunda del análisis para "Deshacer" tras regenerar
    let isRegenerating = false;     // guard contra doble-click en Regenerar
    
    // Obtener empresa desde parámetros de URL o window.currentCompany
    const urlParams = new URLSearchParams(window.location.search);
    const urlCompany = urlParams.get('company');
    const currentEmpresa = urlCompany || window.currentCompany || 'TEMPOACTIVA';
    const urlNombre = urlParams.get('nombre') || '';
    const urlFuratPath = urlParams.get('furatPath') || '';
    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Empresa detectada:', currentEmpresa, '(URL:', urlCompany, ', window:', window.currentCompany, ')');
    if (urlNombre) console.log('[INVESTIGACION-ACCIDENTES-MAIN] Caso desde listado:', urlNombre);
    if (urlFuratPath) console.log('[INVESTIGACION-ACCIDENTES-MAIN] FURAT pre-cargado:', urlFuratPath);

    // Configurar la empresa actual si está disponible
    if (currentEmpresa && companyNameElement) {
        companyNameElement.textContent = currentEmpresa;
    }

    // Cambia el estado visual del dropzone según la fase del PDF.
    // Estados:
    //   'initial'  → "Selecciona un archivo PDF" + icono PDF (estado por defecto)
    //   'selected' → mismo aspecto que initial pero con clase has-file (verde) tras seleccionar
    //   'processed' → "✓ Archivo procesado exitosamente" + icono check, fondo verde, no clickeable
    function setDropzoneState(state) {
        if (!dropZone || !dropZoneContent) return;
        if (state === 'processed') {
            dropZone.classList.remove('has-file');
            dropZone.classList.add('is-processed');
            dropZoneContent.innerHTML =
                '<div class="inv-drop-icon"><i class="fas fa-check-circle"></i></div>' +
                '<p class="inv-drop-title">Archivo procesado exitosamente</p>' +
                '<p class="inv-drop-subtitle">Datos del FURAT extraídos</p>';
        } else if (state === 'selected') {
            dropZone.classList.add('has-file');
            dropZone.classList.remove('is-processed');
            dropZoneContent.innerHTML =
                '<div class="inv-drop-icon"><i class="fas fa-file-pdf"></i></div>' +
                '<p class="inv-drop-title">PDF listo para procesar</p>' +
                '<p class="inv-drop-subtitle">Extrayendo datos…</p>';
        } else {
            // initial / reset
            dropZone.classList.remove('has-file');
            dropZone.classList.remove('is-processed');
            dropZoneContent.innerHTML =
                '<div class="inv-drop-icon"><i class="fas fa-file-pdf"></i></div>' +
                '<p class="inv-drop-title">Selecciona un archivo PDF</p>' +
                '<p class="inv-drop-subtitle">o arrastra y suelta aquí</p>';
        }
    }

    // Evento para abrir el diálogo de selección de archivo
    dropZone.addEventListener('click', function() {
        // No abrir selector si el archivo ya fue procesado (se debe quitar antes con la X)
        if (dropZone.classList.contains('is-processed')) return;
        fileInput.click();
    });

    // Manejar la selección de archivo
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];

            // Validar tipo (MIME o extensión como fallback)
            const isPdfByMime = file.type === 'application/pdf';
            const isPdfByExt = /\.pdf$/i.test(file.name);
            if (!isPdfByMime && !isPdfByExt) {
                showToast('Archivo no válido', 'Solo se aceptan archivos PDF para el FURAT.', 'error');
                fileInput.value = '';
                return;
            }

            // Validar tamaño (50MB máximo, alineado con investigaciones-viewer)
            const MAX_SIZE = 50 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                showToast('Archivo demasiado grande', `El archivo pesa ${sizeMb}MB. Máximo permitido: 50MB.`, 'error');
                fileInput.value = '';
                return;
            }
            if (file.size === 0) {
                showToast('Archivo vacío', 'El archivo PDF no contiene datos.', 'error');
                fileInput.value = '';
                return;
            }

            // Leer el archivo como ArrayBuffer para enviarlo al proceso principal
            const reader = new FileReader();
            reader.onload = async function(event) {
                const arrayBuffer = event.target.result;

                // Enviar el archivo al proceso principal para guardarlo temporalmente
                try {
                    // Usar la comunicación con el padre para guardar el archivo temporalmente
                    const saveResult = await callParentAPI('save-temp-pdf-file', {
                        filename: file.name,
                        data: Array.from(new Uint8Array(arrayBuffer))
                    });

                    // Extraer la ruta del archivo del resultado
                    selectedPdfPath = saveResult.filePath || saveResult;

                    // Mostrar información del archivo seleccionado
                    selectedFileName.textContent = file.name;
                    selectedFileSize.textContent = formatFileSize(file.size);
                    selectedFileInfo.classList.remove('hidden');

                    // Actualizar estado visual del dropzone a "seleccionado" (extrayendo...)
                    setDropzoneState('selected');
                    updateStepStatus(1, 'completed');

                    // Habilitar botón de análisis
                    processBtn.disabled = false;

                    // INICIAR PROCESAMIENTO AUTOMÁTICO DEL PDF
                    showToast('Procesando PDF', 'Extrayendo datos del documento...', 'info');
                    logActivity('info', 'Archivo cargado: ' + file.name + ' (' + formatFileSize(file.size) + ')');
                    await processPdfFile(selectedPdfPath);

                    showToast('Archivo seleccionado', `Datos extraídos de: ${file.name}`, 'success');
                } catch (error) {
                    console.error('Error guardando archivo temporal:', error);
                    showToast('Error', `No se pudo procesar el archivo: ${error.message}`, 'error');
                    logActivity('error', 'Error al procesar PDF: ' + error.message);
                }
            };

            reader.onerror = function() {
                showToast('Error', 'No se pudo leer el archivo del disco.', 'error');
                fileInput.value = '';
            };

            reader.onprogress = function(progressEvent) {
                if (progressEvent.lengthComputable) {
                    // Mostrar feedback durante la lectura del archivo grande
                    const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    if (pct < 100 && progressEvent.total > 1024 * 1024) {
                        selectedFileSize.textContent = formatFileSize(progressEvent.loaded) + ' / ' + formatFileSize(progressEvent.total) + ' (' + pct + '%)';
                    }
                }
            };

            reader.readAsArrayBuffer(file);
        }
    });

    // Arrastrar y soltar archivos
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');

        if (e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];

            // Validar tipo antes de pasar al flujo principal
            const isPdfByMime = file.type === 'application/pdf';
            const isPdfByExt = /\.pdf$/i.test(file.name);
            if (!isPdfByMime && !isPdfByExt) {
                showToast('Archivo no válido', 'Solo se aceptan archivos PDF para el FURAT.', 'error');
                return;
            }

            // Validar tamaño
            const MAX_SIZE = 50 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                showToast('Archivo demasiado grande', `El archivo pesa ${sizeMb}MB. Máximo permitido: 50MB.`, 'error');
                return;
            }

            // Simular evento de cambio en el input para reutilizar todo el flujo
            const event = new Event('change', { bubbles: true });
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(event);
        }
    });

    // Eliminar archivo seleccionado
    removeFileBtn.addEventListener('click', function() {
        fileInput.value = '';
        selectedPdfPath = null;
        selectedFileInfo.classList.add('hidden');
        setDropzoneState('initial');
        processBtn.disabled = true;
        updateStepStatus(1, 'pending');
        
  dataContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-file-medical-alt"></i>
    </div>
    <p>Selecciona un PDF para extraer los datos</p>
  </div>
  `;

  // Limpiar también el análisis
  analysisContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-lightbulb"></i>
    </div>
    <p>El análisis de causa raíz se mostrará aquí</p>
  </div>
  `;
        
        // Resetear variables de estado
        extractedData = null;
        analysisResult = null;
        
        // Resetear pasos
        updateStepStatus(2, 'pending');
        updateStepStatus(4, 'pending');
        updateStepStatus(5, 'pending');
        
        showToast('Archivo removido', 'Selecciona un nuevo archivo para procesar.', 'info');
    });

    // Botón Limpiar - Resetear formulario y resultados
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            // Limpiar archivo seleccionado
            fileInput.value = '';
            selectedPdfPath = null;
            selectedFileInfo.classList.add('hidden');
            setDropzoneState('initial');
            
            // Limpiar datos y análisis
            extractedData = null;
            analysisResult = null;
            
            // Limpiar contenidos
      dataContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-file-medical-alt"></i>
    </div>
    <p>Selecciona un PDF para extraer los datos</p>
  </div>
  `;

      analysisContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-lightbulb"></i>
    </div>
    <p>El análisis de causa raíz se mostrará aquí</p>
  </div>
  `;
            
            // Resetear botones y pasos
            processBtn.disabled = true;
            updateStepStatus(1, 'pending');
            updateStepStatus(2, 'pending');
            updateStepStatus(4, 'pending');
            updateStepStatus(5, 'pending');
            
            // Ocultar barra de progreso si está visible
            progressArea.classList.add('hidden');
            
    showToast('Formulario limpiado', 'Puedes seleccionar un nuevo archivo.', 'info');
  });
  }

  // Log panel toggle
  const logToggle = document.getElementById('logToggle');
  const logPanel = document.getElementById('logPanel');
  const logChevron = document.getElementById('logChevron');
  if (logToggle && logPanel) {
    logToggle.addEventListener('click', function() {
      const isOpen = logPanel.classList.toggle('open');
      logToggle.classList.toggle('open', isOpen);
      if (logChevron) {
        logChevron.style.transform = isOpen ? 'rotate(180deg)' : '';
      }
    });
  }

  // ── Botones header: Visualizar investigación + Imprimir ──────────────
  // Estos listeners solo se registran una vez. La habilitación (disabled=false)
  // se hace recién cuando se genera el informe exitosamente.
  const downloadBtn = document.getElementById('downloadBtn');
  const printBtn = document.getElementById('printBtn');

  function _disableReportButtons() {
    if (downloadBtn) downloadBtn.disabled = true;
    if (printBtn) printBtn.disabled = true;
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', async function() {
      if (!lastReportPath) {
        showToast('Sin informe', 'Primero debes generar un informe para visualizarlo.', 'warning');
        return;
      }
      const api = window.electronAPI && window.electronAPI.showItemInFolder
        ? window.electronAPI
        : {
            showItemInFolder: (p) => callParentAPI('show-item-in-folder', { filePath: p })
          };
      try {
        const result = await api.showItemInFolder(lastReportPath);
        if (result && result.success) {
          logActivity('success', 'Carpeta abierta: ' + lastReportPath);
        } else {
          const msg = (result && result.error) || 'No se pudo abrir la carpeta.';
          showToast('Error', msg, 'error');
          logActivity('error', 'No se pudo visualizar la investigación: ' + msg);
        }
      } catch (err) {
        console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en Visualizar:', err);
        showToast('Error', 'No se pudo visualizar la investigación: ' + err.message, 'error');
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', async function() {
      if (!lastReportPath) {
        showToast('Sin informe', 'Primero debes generar un informe para imprimir.', 'warning');
        return;
      }
      const api = window.electronAPI && window.electronAPI.openPath
        ? window.electronAPI
        : { openPath: (p) => callParentAPI('open-path', { filePath: p }) };
      try {
        const result = await api.openPath(lastReportPath);
        if (result && result.success) {
          logActivity('info', 'Documento abierto para impresión: ' + lastReportPath);
          showToast('Documento abierto', 'Use Ctrl+P para imprimir.', 'info');
        } else {
          const msg = (result && result.error) || 'No se pudo abrir el documento.';
          showToast('Error', msg, 'error');
          logActivity('error', 'No se pudo abrir para impresión: ' + msg);
        }
      } catch (err) {
        console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en Imprimir:', err);
        showToast('Error', 'No se pudo abrir para impresión: ' + err.message, 'error');
      }
    });
  }

  // Botón de procesamiento - Solo ejecuta el análisis si los datos ya están extraídos
    processBtn.addEventListener('click', async function() {
        if (!extractedData) {
            showToast('Error', 'Primero debes seleccionar y procesar un archivo PDF.', 'error');
            return;
        }
        if (isAnalyzing) {
            showToast('Análisis en curso', 'Ya hay un análisis ejecutándose. Espera a que termine.', 'warning');
            return;
        }
        await runAnalysis();
    });

    // ── Listeners del toolbar de revisión del análisis ──
    // IMPORTANTE: se bindean AQUÍ (no en la inicialización) porque los handlers
    // window._onXxx se definen MÁS ABAJO en este mismo archivo. Si se bindearan
    // en la inicialización, serían undefined y el clic no haría nada.
    function _bindReviewToolbarListeners() {
        const btnStartReview = document.getElementById('btnStartReview');
        const btnRegenerateAll = document.getElementById('btnRegenerateAll');
        const btnCancelReview = document.getElementById('btnCancelReview');
        const btnApproveAnalysis = document.getElementById('btnApproveAnalysis');
        const btnReReview = document.getElementById('btnReReview');
        if (btnStartReview) btnStartReview.addEventListener('click', window._onStartReview);
        if (btnRegenerateAll) btnRegenerateAll.addEventListener('click', window._onRegenerateAll);
        if (btnCancelReview) btnCancelReview.addEventListener('click', window._onCancelReview);
        if (btnApproveAnalysis) btnApproveAnalysis.addEventListener('click', window._onApproveAnalysis);
        if (btnReReview) btnReReview.addEventListener('click', window._onReReview);
    }
    // Se llamará al final del archivo (después de definir _onRegenerateAll)

    // Botón de volver
    backBtn.addEventListener('click', function() {
        // Enviar mensaje al iframe padre para volver
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'goBack' }, '*');
        } else {
            // Si no está en iframe, intentar navegar hacia atrás
            window.history.back();
        }
    });

    // Función para procesar el archivo PDF
    async function processPdfFile(pdfPath) {
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Iniciando procesamiento de PDF:', pdfPath);
        
        try {
            // Mostrar barra de progreso
            progressArea.classList.remove('hidden');
            updateProgressBar(0, 'Iniciando procesamiento...');
            
            // Actualizar estado del paso 1
            updateStepStatus(1, 'completed');
            
            // Verificar si electronAPI está disponible directamente
            let api = window.electronAPI;
            
            // Si no está disponible directamente, intentar comunicarse con el padre
            if (!api) {
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] electronAPI no disponible directamente, intentando comunicación con padre');
                
                // Función para llamar a la API del padre
api = {
processAccidentPdf: async (pdfPath) => {
return await callParentAPI('process-accident-pdf', { pdfPath });
},
analyzeAccident: async (extractedData, contextoAdicional) => {
return await callParentAPI('analyze-accident', { extractedData, contextoAdicional });
},
generateAccidentReport: async (combinedData) => {
return await callParentAPI('generate-accident-report', combinedData);
}
};
            }
            
            // Verificar que tengamos acceso a la API
            if (!api || typeof api.processAccidentPdf !== 'function') {
                throw new Error('No se pudo acceder a la API de procesamiento de accidentes');
            }
            
            // Actualizar paso 2
            updateStepStatus(2, 'active');
            
            // Mostrar estado de procesamiento
  dataContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-spinner fa-spin"></i>
    </div>
    <p>Extrayendo datos del PDF...</p>
  </div>
  `;
            
            // Registrar actividad
            logActivity('info', 'Iniciando extracción de datos del PDF');
            
            // Procesar el PDF usando el handler existente
            extractedData = await api.processAccidentPdf(pdfPath);
            
            // LOG DE DEPURACIÓN CRÍTICO
            console.log('[INVESTIGACION-ACCIDENTES-MAIN] Datos recibidos del handler:', JSON.stringify(extractedData, null, 2));
            
            // Actualizar paso 2 como completado
            updateStepStatus(2, 'completed');

            // Marcar el dropzone como "procesado" (icono check verde, no clickeable)
            setDropzoneState('processed');

            // Mostrar datos extraídos
            displayExtractedData(extractedData);
            
            logActivity('success', 'Datos extraídos exitosamente del PDF');
            
            // Habilitar botón de análisis
            processBtn.disabled = false;
            document.getElementById('processBtnText').textContent = 'Iniciar Análisis';
            
            showToast('Datos extraídos', 'Los datos del PDF fueron extraídos. Haz clic en "Iniciar Análisis" para continuar.', 'success');
            
        } catch (error) {
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error durante el procesamiento:', error);
            logActivity('error', `Error durante el procesamiento: ${error.message}`);
            showToast('Error', `Hubo un error durante el procesamiento: ${error.message}`, 'error');
            
            // Solo marcar error en paso 2 si falló la extracción
            updateStepStatus(2, 'error');
        } finally {
            // Ocultar barra de progreso
            progressArea.classList.add('hidden');
        }
    }
    
    // Función separada para ejecutar el análisis
    async function runAnalysis() {
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Iniciando análisis de causa raíz');

        // Guard contra doble-click o clicks múltiples durante análisis largos de IA
        isAnalyzing = true;
        if (processBtn) processBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = true;

        try {
            // Mostrar barra de progreso
            progressArea.classList.remove('hidden');
            updateProgressBar(0, 'Iniciando análisis...');

            // Actualizar paso 4 (análisis)
            updateStepStatus(4, 'active');

            // Mostrar estado de análisis con información de carga del modelo
  analysisContent.innerHTML = `
  <div class="inv-empty-state">
    <div class="inv-empty-icon">
      <i class="fas fa-brain fa-spin"></i>
    </div>
    <p id="analysis-status">Iniciando servidor de IA...</p>
    <p class="inv-empty-subtitle" id="analysis-substatus" style="font-size: 0.9em; margin-top: 8px;">
      La primera ejecución puede tardar 4-5 minutos mientras se carga el modelo
    </p>
    <div class="inv-progress-container" style="max-width: 400px; margin: 15px auto;">
      <div id="model-progress" class="inv-progress-bar inv-progress-bar--indeterminate" style="width: 0%"></div>
    </div>
    <p id="model-progress-text" style="font-size: 0.85em; color: var(--inv-text-muted);"></p>
  </div>
  `;

            logActivity('info', 'Iniciando análisis de causa raíz con IA');

            // Obtener contexto adicional
            const contextoAdicional = document.getElementById('contextInput').value || '';

            // Construir API si no está disponible directamente
            let api = window.electronAPI;
            if (!api) {
                api = {
                    analyzeAccident: async (extractedData, contextoAdicional) => {
                        return await callParentAPI('analyze-accident', { extractedData, contextoAdicional });
                    },
                    generateAccidentReport: async (combinedData) => {
                        // Enviar combinedData directamente como payload
                        return await callParentAPI('generate-accident-report', combinedData);
                    }
                };
            }

            // Variable para tracking del tiempo de carga
            const analysisStartTime = Date.now();
            let modelLoadingCheckInterval;
            
            // Verificar progreso de carga del modelo
            modelLoadingCheckInterval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - analysisStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                
                const statusEl = document.getElementById('analysis-status');
                const substatusEl = document.getElementById('analysis-substatus');
                const progressEl = document.getElementById('model-progress');
                const progressTextEl = document.getElementById('model-progress-text');
                
                if (statusEl) {
                    statusEl.textContent = `Cargando modelo de IA... (${minutes}m ${seconds}s)`;
                }
                
                if (substatusEl) {
                    substatusEl.textContent = 'El servidor se está iniciando. Esto solo ocurre en la primera ejecución.';
                }
                
                // Actualizar barra de progreso (estimado basado en tiempo típico de 5 minutos)
                if (progressEl) {
                    const estimatedProgress = Math.min((elapsed / 300) * 100, 95); // 300s = 5 min
                    progressEl.style.width = `${estimatedProgress}%`;
                }
                
                if (progressTextEl) {
                    const estimatedProgress = Math.min((elapsed / 300) * 100, 95);
                    progressTextEl.textContent = `${Math.round(estimatedProgress)}% completado - Estimado: ${Math.max(0, 5 - minutes)}m ${Math.max(0, 60 - seconds)}s restantes`;
                }
            }, 2000);

            // Analizar los datos extraídos
            analysisResult = await api.analyzeAccident(extractedData, contextoAdicional);

            // Desanidar el wrapper {success, data, validation, ...} para tener
            // SOLO el objeto de análisis ({PorQue1..PorQue5}).
            // Si NO desanidamos, `analysisResult` queda con wrapper y
            // `renderEditableAnalysisTable` no encuentra las claves PorQue,
            // mostrando "No se pudo renderizar el análisis en formato editable."
            if (analysisResult && analysisResult.success === true && analysisResult.data) {
                analysisResult = analysisResult.data;
            }

            // Detener verificación de progreso
            clearInterval(modelLoadingCheckInterval);

            // Calcular tiempo total
            const totalTime = Math.floor((Date.now() - analysisStartTime) / 1000);
            const totalMinutes = Math.floor(totalTime / 60);
            const totalSeconds = totalTime % 60;

            // Actualizar mensaje final
            const statusEl = document.getElementById('analysis-status');
            const substatusEl = document.getElementById('analysis-substatus');
            const progressEl = document.getElementById('model-progress');
            const progressTextEl = document.getElementById('model-progress-text');
            
            if (statusEl) {
                statusEl.textContent = '¡Análisis completado!';
            }
            if (substatusEl) {
                substatusEl.textContent = `Tiempo total: ${totalMinutes}m ${totalSeconds}s`;
            }
            if (progressEl) {
                progressEl.style.width = '100%';
                progressEl.classList.remove('progress-bar-animated');
            }
            if (progressTextEl) {
                progressTextEl.textContent = 'Modelo listo para usar';
            }

            // Actualizar paso 4 como completado
            updateStepStatus(4, 'completed');

            // Mostrar resultados del análisis
            displayAnalysisResults(analysisResult);

            logActivity('success', `Análisis de causa raíz completado en ${totalMinutes}m ${totalSeconds}s`);

// ─────────────────────────────────────────────────────────────
// MOSTRAR TOOLBAR DE REVISIÓN (feature nuevo)
// El usuario debe revisar/editar/aprobar el análisis ANTES de poder generar el informe.
// ─────────────────────────────────────────────────────────────
updateProgressBar(80, 'Análisis completado — revise antes de generar el informe');
logActivity('info', 'Análisis completado. Pendiente de revisión por el usuario.');

showToast('Análisis completado', 'Revisa el análisis y apruébalo antes de generar el informe.', 'success');

progressArea.classList.add('hidden');
analysisState = 'idle';  // Mostrar toolbar en estado inicial
showReviewToolbar();
            
        } catch (analysisError) {
            // Error específico del análisis
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en el análisis:', analysisError);
            logActivity('error', `Error en el análisis: ${analysisError.message}`);
            
	// Mostrar error en la sección de análisis
	const isTimeout = analysisError.message && (
		analysisError.message.includes('agotado') ||
		analysisError.message.includes('Timeout') ||
		analysisError.message.includes('timeout')
	);
	const isConnectionError = analysisError.message && (
		analysisError.message.includes('ECONNREFUSED') ||
		analysisError.message.includes('conexión')
	);
	let errorHint = 'Los datos del accidente fueron extraídos correctamente.';
	if (isTimeout) {
		errorHint += ' El análisis superó el tiempo límite. Esto puede ocurrir si el modelo se ejecuta en CPU (sin GPU) o si la GPU no tiene suficiente memoria VRAM. Verifique que CUDA esté disponible.';
	} else if (isConnectionError) {
		errorHint += ' No se pudo conectar con el servidor de IA. Verifique que Flask y transformers estén instalados en el Python del proyecto.';
	} else {
		errorHint += ' Verifique que el servidor LLM esté funcionando y que CUDA/GPU esté disponible.';
	}
  analysisContent.innerHTML = `
  <div class="inv-empty-state inv-error-state">
    <div class="inv-empty-icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <p>Error en el análisis de causa raíz</p>
    <p class="inv-error-detail">${analysisError.message}</p>
    <p class="inv-error-hint">${errorHint}</p>
  </div>
  `;
            
            updateStepStatus(4, 'error');
            showToast('Error en análisis', `El análisis falló: ${analysisError.message}`, 'error');
        } finally {
            // Restaurar estado de botones y guard
            isAnalyzing = false;
            if (processBtn) processBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
            // Ocultar barra de progreso
            progressArea.classList.add('hidden');
        }
    }

// Función para comunicarse con la ventana padre (iframe)
    function callParentAPI(type, payload) {
        return new Promise((resolve, reject) => {
            // ID único para esta solicitud para emparejarla con la respuesta
            const requestId = `investigacion-accidentes-${Date.now()}-${Math.random()}`;

            // Función para manejar la respuesta
            const handleResponse = (event) => {
                // Verificar que el origen sea seguro (archivo local en este caso)
                if (event.source !== window.parent) {
                    return;
                }

                const response = event.data;
                const responseType = response.type;
                const expectedResponseType = `investigacion-accidentes-${type}-request-response`;
                // El renderer responde con '-response' (no '-request-response') — aceptamos ambos formatos
                const simpleResponseType = `investigacion-accidentes-${type}-response`;

                // Verificar que el requestId coincida con el nuestro
                if (response.requestId && response.requestId.startsWith('investigacion-accidentes-') && response.requestId === requestId) {
                    // Limpiar el timeout si existe
                    if (window._investigacionTimeoutClear && window._investigacionTimeoutClear[requestId]) {
                        window._investigacionTimeoutClear[requestId]();
                        delete window._investigacionTimeoutClear[requestId];
                    }

                    // Aceptar respuesta con cualquier formato (-response, -request-response, save-temp-pdf-file especial)
                    const isValidResponse =
                        responseType === expectedResponseType ||
                        responseType === simpleResponseType ||
                        (type === 'save-temp-pdf-file' && responseType === 'investigacion-accidentes-save-temp-pdf-file-response');

                    if (isValidResponse) {
                        window.removeEventListener('message', handleResponse);

                        if (response.success) {
                            resolve(response.payload);
                        } else {
                            const errObj = response.error;
                            const errorMessage = typeof errObj === 'string' ? errObj : (errObj?.message || errObj?.code || 'Error desconocido desde la ventana padre');
                            reject(new Error(errorMessage));
                        }
                        return;
                    }
                }

                // Fallback: compatibilidad con formato antiguo (sin prefijo, sin requestId)
                if (responseType === `${type}-response` && !response.requestId) {
                    if (window._investigacionTimeoutClear && window._investigacionTimeoutClear[requestId]) {
                        window._investigacionTimeoutClear[requestId]();
                        delete window._investigacionTimeoutClear[requestId];
                    }
                    window.removeEventListener('message', handleResponse);

                    if (response.success) {
                        resolve(response.payload);
                    } else {
                        const errorMessage = response.error || 'Error desconocido desde la ventana padre';
                        reject(new Error(errorMessage));
                    }
                }
            };
            
            // Escuchar la respuesta
            window.addEventListener('message', handleResponse);
            
            // Enviar la solicitud al padre con el sufijo -request como espera el renderer
            window.parent.postMessage({
                type: `investigacion-accidentes-${type}-request`,
                payload: payload,
                requestId: requestId
            }, '*');
            
            // Timeout por si acaso - aumentado a 10 minutos para carga de modelo LLM y generación
            // El modelo puede tardar hasta 90 segundos en cargarse + tiempo de generación con 3000 tokens
            const timeoutId = setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Tiempo de espera agotado para la solicitud'));
            }, 1200000); // 1200 segundos (20 minutos) de timeout
            
            // Función para limpiar el timeout (será llamada desde handleResponse)
            window._investigacionTimeoutClear = window._investigacionTimeoutClear || {};
            window._investigacionTimeoutClear[requestId] = () => clearTimeout(timeoutId);
        });
    }

    // Normaliza el valor de un campo del FURAT para corregir artefactos del script de extracción.
    //
    // Problemas conocidos en datos crudos del PDF (Invest_APP_V_3.PdfProcessor.extract_pdf_data):
    //   - "No. Identificación": el script concatena identificación + parte del teléfono.
    //     Ej: id="114326350408", tel="1143263504" → id real="1143263504"
    //   - "Nombre Completo": el PDF tiene etiqueta "SEGUNDO APELLIDO" como primera línea
    //     y luego las 4 partes (1er apellido, 2do apellido, 1er nombre, 2do nombre)
    //     en orden Apellido1 + Apellido2 + Nombre1 + Nombre2. Se debe mostrar como
    //     "Nombre1 Nombre2 Apellido1 Apellido2".
    //   - "Cargo": el PDF antepone una categoría de zona (URBANA / ADMINISTRATIVO /
    //     OPERATIVO) antes del cargo real. Solo se debe mostrar el cargo real
    //     (última línea).
    function normalizeFieldValue(key, value, allData) {
        if (value == null || value === 'N/A') return value || 'N/A';
        let s = String(value);

        if (key === 'No. Identificación') {
            // El script Python (Invest_APP_V_3.extract_pdf_data) tiene un bug conocido donde
            // la identificación extraída incluye dígitos basura concatenados del campo siguiente.
            // Ejemplo real: PDF id="1143263504" → extraído "114326350408" (12 dígitos).
            // Heurística: las cédulas colombianas tienen 6-10 dígitos. Si el valor extraído
            // tiene más de 10 dígitos, descartar del final hasta tener exactamente 10.
            const idDigits = s.replace(/\D/g, '');
            if (idDigits.length > 10 && /^\d+$/.test(idDigits)) {
                const realId = idDigits.slice(0, 10);
                console.log('[NORMALIZE] Identificación con dígitos basura:', s, '→', realId);
                return realId;
            }
            return s;
        }

        if (key === 'Nombre Completo') {
            // El PDF del FURAT guarda el nombre en líneas separadas, pero a veces varios
            // valores vienen en una sola línea separados por muchos espacios (artefacto del
            // formulario). Estrategia:
            //   1. Separar por saltos de línea Y por secuencias de 3+ espacios
            //   2. Limpiar cada palabra y filtrar vacías
            //   3. Quitar la etiqueta "SEGUNDO APELLIDO" si aparece como primer elemento
            //   4. Asumir formato PDF: [1erApellido, 2doApellido, 1erNombre, 2doNombre]
            //      (puede haber solo 3 si falta un apellido o nombre)
            //   5. Mostrar en español: Nombres primero, luego Apellidos
            const tokens = s
                .split(/\r?\n+|\s{3,}/)
                .map(t => t.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            if (tokens.length === 0) return s;
            const labelPatterns = /^(PRIMER|SEGUNDO|PRIMER\/SEGUNDO)\s+APELLIDO$/i;
            const nameTokens = tokens[0].match(labelPatterns) ? tokens.slice(1) : tokens;
            if (nameTokens.length === 1) return nameTokens[0];
            // Dividir en 2 mitades: apellidos (primera mitad) + nombres (segunda mitad)
            const half = Math.floor(nameTokens.length / 2);
            const apellidos = nameTokens.slice(0, half);
            const nombres = nameTokens.slice(half);
            const reordered = [...nombres, ...apellidos].join(' ');
            console.log('[NORMALIZE] Nombre reordenado:', s, '→', reordered);
            return reordered;
        }

        if (key === 'Cargo') {
            // Quitar categoría de zona (URBANA/ADMINISTRATIVO/OPERATIVO) si es la primera línea
            const lines = s.split(/\r?\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
            if (lines.length <= 1) return s;
            const zonas = /^(URBANA|RURAL|ADMINISTRATIVO?|OPERATIVO?|MIXTA|COMERCIAL|INDUSTRIAL|SERVICIOS?|PRODUCCI[ÓO]N|DIRECCI[ÓO]N|GERENCIA)$/i;
            const filtered = zonas.test(lines[0]) ? lines.slice(1) : lines;
            const result = filtered.join(' ');
            if (result !== s) console.log('[NORMALIZE] Cargo limpiado:', s, '→', result);
            return result;
        }

        // Para cualquier campo con saltos de línea que no sea cargo/nombre/id,
        // unir las líneas en un párrafo (ej: Descripcion del Accidente multi-línea)
        if (s.includes('\n') && key !== 'Nombre Completo' && key !== 'Cargo') {
            const joined = s.split(/\r?\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
            if (joined !== s) console.log('[NORMALIZE] Multi-línea unificado:', key, '→', joined);
            return joined;
        }

        return s;
    }

    // Función para mostrar datos extraídos
    function displayExtractedData(data) {
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Mostrando datos extraídos:', data);
        
        // Verificar que el contenedor existe
        if (!dataContent) {
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] ERROR: dataContent no está definido');
            return;
        }
        
        // Normalizar estructura: el backend puede retornar múltiples niveles de anidamiento
        // Estructura posible: {success: true, data: {success: true, data: {...}}}
        // El script Python retorna: {"type": "result", "payload": {"success": true, "data": extracted_data}}
        // El handler retorna: {success: true, data: payload} = {success: true, data: {success: true, data: extracted_data}}
        let actualData = data;
        
        // Desanidar múltiples niveles de forma robusta
        // Buscar el primer objeto que tenga campos de datos reales (no solo success/data)
        while (actualData && typeof actualData === 'object') {
            // Si tiene success=true y data, intentar desanidar
            if (actualData.success === true && actualData.data && typeof actualData.data === 'object') {
                // Verificar si data tiene campos de datos reales (no solo success/data)
                const dataKeys = Object.keys(actualData.data);
                const hasRealDataFields = dataKeys.some(key => key !== 'success' && key !== 'data' && key !== 'error');
                
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] Desanidando - dataKeys:', dataKeys, 'hasRealDataFields:', hasRealDataFields);
                
                if (hasRealDataFields) {
                    // data tiene campos reales, usarlo directamente
                    actualData = actualData.data;
                    break;
                } else if (actualData.data.success === true && actualData.data.data) {
                    // data tiene otra estructura anidada, seguir desanidando
                    actualData = actualData.data;
                } else {
                    // data no tiene estructura esperada, salir
                    actualData = actualData.data;
                    break;
                }
            } else {
                // No tiene estructura de anidamiento, salir
                break;
            }
        }
        
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Datos normalizados:', actualData);
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Claves de datos:', Object.keys(actualData || {}));
        
        // Verificar si hay error en los datos normalizados (error anidado del script Python)
        if (actualData.success === false || actualData.error) {
            const errorMsg = actualData.error || 'Error desconocido al procesar el PDF';
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en datos:', errorMsg);
            
  dataContent.innerHTML = `<div class="inv-empty-state inv-error-state">
  <div class="inv-empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
  <p>Error al extraer datos del PDF</p>
  <p class="inv-error-detail">${escapeHtml(errorMsg)}</p>
  <p class="inv-error-hint">Verifique que el archivo PDF sea válido y que las dependencias de Python estén instaladas.</p>
</div>`;
  return;
        }
        
        // Verificar si hay datos vacíos
        if (!actualData || Object.keys(actualData).length === 0) {
    dataContent.innerHTML = `<div class="inv-empty-state">
  <div class="inv-empty-icon"><i class="fas fa-file-excel"></i></div>
  <p>No se encontraron datos o el PDF no es compatible.</p>
</div>`;
            return;
        }
        
        // Campos a mostrar (según el backup original y el script Python)
        const fields = [
            { key: 'No. Identificación', label: 'No. Identificación' },
            { key: 'Nombre Completo', label: 'Nombre Completo' },
            { key: 'Fecha del Accidente', label: 'Fecha del Accidente' },
            { key: 'Hora del Accidente', label: 'Hora del Accidente' },
            { key: 'Cargo', label: 'Cargo' },
            { key: 'Tipo de Accidente', label: 'Tipo de Accidente' },
            { key: 'Lugar del Accidente', label: 'Lugar del Accidente' },
            { key: 'Sitio de Ocurrencia', label: 'Sitio de Ocurrencia' },
            { key: 'Tipo de Lesion', label: 'Tipo de Lesión' },
            { key: 'Parte del Cuerpo Afectada', label: 'Parte del Cuerpo Afectada' },
            { key: 'Agente del Accidente', label: 'Agente del Accidente' },
            { key: 'Mecanismo o Forma del Accidente', label: 'Mecanismo del Accidente' }
        ];
        
  let htmlContent = '<div class="inv-data-grid">';

  fields.forEach(field => {
    const rawValue = actualData[field.key];
    const value = rawValue ? normalizeFieldValue(field.key, rawValue, actualData) : 'N/A';
    htmlContent += `
  <div class="inv-data-field">
    <label>${field.label}</label>
    <div class="value">${escapeHtml(value)}</div>
  </div>
  `;
  });

  htmlContent += '</div>';

  const descripcionRaw = actualData['Descripcion del Accidente'] || actualData['Descripcion'] || 'N/A';
  const descripcion = descripcionRaw !== 'N/A' ? normalizeFieldValue('Descripcion del Accidente', descripcionRaw, actualData) : 'N/A';
  if (descripcion && descripcion !== 'N/A') {
    htmlContent += `
  <div class="inv-data-description">
    <label>Descripción del Accidente</label>
    <p>${escapeHtml(descripcion)}</p>
  </div>
  `;
  }
        
        dataContent.innerHTML = htmlContent;
    }
    
    // Función auxiliar para escapar HTML
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    // Función para mostrar resultados del análisis
    function displayAnalysisResults(results) {
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Mostrando resultados del análisis:', results);
        
        // Verificar si hay error en los resultados
        if (results.success === false || results.error) {
            const errorMsg = results.error || 'Error desconocido en el análisis';
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en resultados:', errorMsg);
            
		const isTmout = errorMsg.includes('agotado') || errorMsg.includes('Timeout') || errorMsg.includes('timeout');
		const isConnErr = errorMsg.includes('ECONNREFUSED') || errorMsg.includes('conexión');
		let hint = 'Los datos del accidente fueron extraídos correctamente.';
		if (isTmout) {
			hint += ' El análisis superó el tiempo límite. Puede ocurrir si el modelo se ejecuta en CPU (sin GPU) o si la GPU no tiene suficiente memoria VRAM.';
		} else if (isConnErr) {
			hint += ' No se pudo conectar con el servidor de IA. Verifique que Flask y transformers estén instalados.';
		} else {
			hint += ' Verifique que el servidor LLM esté funcionando y que CUDA/GPU esté disponible.';
		}
    analysisContent.innerHTML = `
      <div class="inv-empty-state inv-error-state">
        <div class="inv-empty-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <p>Error en el análisis de causa raíz</p>
        <p class="inv-error-detail">${escapeHtml(errorMsg)}</p>
        <p class="inv-error-hint">${hint}</p>
      </div>
    `;
    return;
        }
        
        // Desanidar si es necesario
        // El análisis puede venir en results.data o results.analysis
        let analysisData = results;
        
        // Primero verificar results.data (estructura del servidor HTTP)
        if (results.success === true && results.data) {
            console.log('[INVESTIGACION-ACCIDENTES-MAIN] Usando results.data');
            analysisData = results.data;
        }
        // Luego verificar results.analysis (estructura antigua)
        else if (results.success === true && results.analysis) {
            console.log('[INVESTIGACION-ACCIDENTES-MAIN] Usando results.analysis');
            analysisData = results.analysis;
        }
        
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] analysisData:', analysisData);
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] Claves de analysisData:', Object.keys(analysisData));

        let htmlContent = '';

        // Detectar el formato de los datos
        // Formato 1: {"PorQue1": {...}, "PorQue2": {...}, ...} (del servidor Flask)
        // Formato 2: {"Por Qué 1": {...}, "Por Qué 2": {...}, ...} (variante)
        // Formato 3: {"cinco_porques": [...], "analisis_ishikawa": {...}} (formato anterior)

        // Buscar claves tipo "PorQue1", "PorQue2", "Por Qué 1", etc.
        const allKeys = Object.keys(analysisData);
        const hasPorQueKeys = allKeys.some(key => 
            key.includes('PorQue') || 
            key.includes('Por Qu') || 
            key.includes('Porqué') || 
            key.includes('Por que')
        );
        
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] hasPorQueKeys:', hasPorQueKeys);

        if (hasPorQueKeys) {
            // Formato del servidor: {"PorQue1": {...}, "PorQue2": {...}, ...}
    htmlContent += '<div class="five-whys-analysis">';
    htmlContent += '<h3 style="margin-bottom: 20px; color: var(--inv-primary);"><i class="fas fa-brain" style="margin-right: 10px;"></i>Análisis 5 Por Qués</h3>';

    const porQueKeys = allKeys
      .filter(key =>
        key.includes('PorQue') ||
        key.includes('Por Qu') ||
        key.includes('Porqué') ||
        key.includes('Por que')
      )
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
        return numA - numB;
      });

    porQueKeys.forEach((key, index) => {
      const porQueData = analysisData[key];

      const pregunta = porQueData.Pregunta || `¿Por qué? - Nivel ${index + 1}`;

      htmlContent += `
      <div class="inv-why-card" style="margin-bottom: 16px;">
        <div class="inv-why-header">
          <div class="inv-why-number">${index + 1}</div>
          <p>${escapeHtml(pregunta)}</p>
        </div>
        <div class="inv-m-grid">
          <div class="inv-m-cell">
            <div class="inv-m-category">👷 Mano de Obra</div>
            <div class="inv-m-content">${escapeHtml(porQueData['Mano de Obra'] || 'N/A')}</div>
          </div>
          <div class="inv-m-cell">
            <div class="inv-m-category">📋 Método</div>
            <div class="inv-m-content">${escapeHtml(porQueData['Método'] || porQueData['Metodo'] || 'N/A')}</div>
          </div>
          <div class="inv-m-cell">
            <div class="inv-m-category">⚙️ Maquinaria</div>
            <div class="inv-m-content">${escapeHtml(porQueData['Maquinaria'] || 'N/A')}</div>
          </div>
          <div class="inv-m-cell">
            <div class="inv-m-category">🌍 Medio Ambiente</div>
            <div class="inv-m-content">${escapeHtml(porQueData['Medio Ambiente'] || 'N/A')}</div>
          </div>
          <div class="inv-m-cell">
            <div class="inv-m-category">📦 Material</div>
            <div class="inv-m-content">${escapeHtml(porQueData['Material'] || 'N/A')}</div>
          </div>
        </div>
      </div>
      `;
    });

    htmlContent += '</div>';

    if (analysisData.causasRaiz || analysisData.CausasRaiz) {
      const causasRaiz = analysisData.causasRaiz || analysisData.CausasRaiz;
      htmlContent += `
      <div class="inv-root-causes" style="margin-top: 1rem;">
        <h4><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>Causas Raíz Identificadas</h4>
        <div>${escapeHtml(typeof causasRaiz === 'string' ? causasRaiz : JSON.stringify(causasRaiz))}</div>
      </div>
      `;
    }

    if (analysisData.accionesCorrectivas || analysisData.AccionesCorrectivas) {
      const acciones = analysisData.accionesCorrectivas || analysisData.AccionesCorrectivas;
      htmlContent += `
      <div class="inv-corrective-actions" style="margin-top: 1rem;">
        <h4><i class="fas fa-check-circle" style="margin-right: 8px;"></i>Acciones Correctivas Recomendadas</h4>
        <div>${escapeHtml(typeof acciones === 'string' ? acciones : JSON.stringify(acciones))}</div>
      </div>
      `;
    }
        } else if (analysisData.cinco_porques && Array.isArray(analysisData.cinco_porques)) {
            // Formato anterior: {"cinco_porques": [...], "analisis_ishikawa": {...}}
    htmlContent += '<div class="five-whys">';
    htmlContent += '<h3 style="margin-bottom: 20px; color: var(--inv-primary);"><i class="fas fa-search" style="margin-right: 10px;"></i>Análisis 5 Por Qués</h3>';

    analysisData.cinco_porques.forEach((item, index) => {
      htmlContent += `
      <div class="inv-why-card" style="margin-bottom: 16px;">
        <div class="inv-why-header">
          <div class="inv-why-number">${index + 1}</div>
          <p>¿Por qué?</p>
        </div>
        <div style="padding: 0.75rem 1rem; color: var(--inv-text-secondary); font-size: 0.8125rem;">${escapeHtml(item.respuesta || item.porque || item.razon || 'No disponible')}</div>
      </div>
      `;
    });
    htmlContent += '</div>';
        }

        // Mostrar análisis Ishikawa si está disponible (formato anterior)
  if (analysisData.analisis_ishikawa) {
    htmlContent += `
    <div class="inv-fishbone-summary" style="margin-top: 1.5rem;">
      <div class="inv-fishbone-title"><i class="fas fa-fish"></i> Análisis Ishikawa</div>
      <div class="inv-m-grid">
        <div class="inv-m-cell">
          <div class="inv-m-category">👷 Mano de Obra</div>
          <div class="inv-m-content">${escapeHtml(analysisData.analisis_ishikawa.mano_obra || 'No disponible')}</div>
        </div>
        <div class="inv-m-cell">
          <div class="inv-m-category">⚙️ Máquinas</div>
          <div class="inv-m-content">${escapeHtml(analysisData.analisis_ishikawa.maquinas || 'No disponible')}</div>
        </div>
        <div class="inv-m-cell">
          <div class="inv-m-category">📦 Materiales</div>
          <div class="inv-m-content">${escapeHtml(analysisData.analisis_ishikawa.materiales || 'No disponible')}</div>
        </div>
        <div class="inv-m-cell">
          <div class="inv-m-category">📋 Métodos</div>
          <div class="inv-m-content">${escapeHtml(analysisData.analisis_ishikawa.metodos || 'No disponible')}</div>
        </div>
        <div class="inv-m-cell">
          <div class="inv-m-category">🌍 Medio Ambiente</div>
          <div class="inv-m-content">${escapeHtml(analysisData.analisis_ishikawa.medio_ambiente || 'No disponible')}</div>
        </div>
      </div>
    </div>
    `;
  }
        
        // Si no hay contenido estructurado, mostrar el raw_text si existe
        if (!htmlContent) {
            console.log('[INVESTIGACION-ACCIDENTES-MAIN] No se encontró formato estructurado, mostrando raw_text');
            
    if (results.raw_text) {
      htmlContent = `
      <div class="inv-analysis-raw">
        <h3><i class="fas fa-file-alt" style="margin-right: 8px;"></i>Análisis Generado</h3>
        <pre>${escapeHtml(results.raw_text)}</pre>
      </div>
      `;
    } else {
      htmlContent = `
      <div class="inv-empty-state">
        <div class="inv-empty-icon">
          <i class="fas fa-info-circle"></i>
        </div>
        <p>Análisis completado pero sin resultados detallados</p>
        <p class="inv-empty-subtitle">Los datos del análisis no contienen información estructurada.</p>
      </div>
      `;
    }
        }
        
        analysisContent.innerHTML = htmlContent;

        // ── Activar toolbar de revisión (feature nuevo) ──
        showReviewToolbar();
    }

    // ── Feature: Revisión del análisis de causa raíz (3 estados) ──
    //
    // Estados:
    //   'idle'       → muestra botón "Revisar análisis"
    //   'reviewing'  → muestra tabla editable + botones regenerar/aprobar/cancelar
    //   'approved'   → muestra "✓ Aprobado" + botón "Re-revisar"
    //   'dirty'      → usuario editó celda después de aprobar; requiere re-aprobación

    // Categorías 5M que se muestran en la tabla editable
    const FIVE_M_CATEGORIES = [
        { key: 'Mano de Obra', label: '👷 Mano de Obra' },
        { key: 'Método', label: '📋 Método', fallbackKey: 'Metodo' },
        { key: 'Maquinaria', label: '⚙️ Maquinaria' },
        { key: 'Medio Ambiente', label: '🌍 Medio Ambiente' },
        { key: 'Material', label: '📦 Material' }
    ];

    // Construye la representación canónica del análisis (PorQue1..PorQue5)
    function normalizeAnalysisData(rawAnalysis) {
        if (!rawAnalysis || typeof rawAnalysis !== 'object') return null;
        // Si ya viene en formato PorQue1..PorQue5, devolver tal cual
        const keys = Object.keys(rawAnalysis);
        if (keys.some(k => /PorQue\d/.test(k))) {
            return rawAnalysis;
        }
        // Si viene como {Por Qué 1, Por Qué 2, ...}, convertir
        const normalized = {};
        for (let i = 1; i <= 5; i++) {
            const key1 = `PorQue${i}`;
            const key2 = `Por Qué ${i}`;
            if (rawAnalysis[key1]) normalized[key1] = rawAnalysis[key1];
            else if (rawAnalysis[key2]) normalized[key1] = rawAnalysis[key2];
        }
        return Object.keys(normalized).length ? normalized : null;
    }

    // Renderiza la tabla editable de 5 Porqués × 5 categorías
    function renderEditableAnalysisTable(analysisData) {
        const normalized = normalizeAnalysisData(analysisData);
        if (!normalized) {
            return '<p class="inv-error-hint">No se pudo renderizar el análisis en formato editable.</p>';
        }
        const levels = [1, 2, 3, 4, 5].filter(i => normalized[`PorQue${i}`]);
        const headers = FIVE_M_CATEGORIES.map(cat => `<th>${cat.label}</th>`).join('');
        const rows = levels.map(level => {
            const porQue = normalized[`PorQue${level}`];
            const cells = FIVE_M_CATEGORIES.map(cat => {
                const raw = porQue[cat.key] !== undefined ? porQue[cat.key]
                          : (cat.fallbackKey && porQue[cat.fallbackKey] !== undefined ? porQue[cat.fallbackKey]
                          : 'N/A');
                const value = raw || 'N/A';
                const isNa = !value || value === 'N/A' || (typeof value === 'string' && value.trim().toUpperCase() === 'N/A');
                const cellClass = isNa ? 'inv-why-cell-edit inv-why-cell-na' : 'inv-why-cell-edit';
                const display = isNa ? 'N/A' : value;
                return `<td><div class="${cellClass}" contenteditable="plaintext-only" spellcheck="true"
                    data-level="${level}" data-cat="${cat.key}"
                    oninput="window._onAnalysisCellEdit(this)">${escapeHtml(display)}</div></td>`;
            }).join('');
            const regenDisabled = isRegenerating ? 'disabled' : '';
            // El botón ↻ va DENTRO de la celda de nivel para garantizar visibilidad
            // (anteriormente estaba en una columna aparte que se ocultaba por overflow).
            return `<tr>
                <td class="inv-why-cell-nivel">
                    <div class="inv-why-level-header">
                        <span class="inv-why-level-number" data-level="${level}">${level}</span>
                        <button type="button" class="inv-btn-regenerate-level" data-level="${level}"
                            title="Regenerar solo este nivel con el feedback actual"
                            aria-label="Regenerar nivel ${level}"
                            ${regenDisabled} onclick="window._onRegenerateLevel(${level})">
                            <i class="fas fa-sync"></i>
                        </button>
                    </div>
                </td>
                ${cells}
            </tr>`;
        }).join('');
        return `<table class="inv-why-table">
            <thead>
                <tr>
                    <th class="inv-why-col-nivel">Nivel</th>
                    ${headers}
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    // Muestra/oculta el toolbar según el estado
    function showReviewToolbar() {
        const toolbar = document.getElementById('analysisReviewToolbar');
        const idle = document.getElementById('reviewActionsIdle');
        const reviewing = document.getElementById('reviewActionsReviewing');
        const approved = document.getElementById('reviewActionsApproved');
        const badge = document.getElementById('analysisReviewBadge');
        if (!toolbar || !idle || !reviewing || !approved || !badge) return;

        toolbar.classList.remove('hidden');
        badge.classList.remove('hidden');
        idle.classList.add('hidden');
        reviewing.classList.add('hidden');
        approved.classList.add('hidden');
        badge.classList.remove('inv-review-badge--reviewing', 'inv-review-badge--approved', 'inv-review-badge--dirty');

        if (analysisState === 'idle') {
            idle.classList.remove('hidden');
            // No badge en idle (estado inicial)
            badge.classList.add('hidden');
            // Rehabilitar botón "Iniciar Análisis" (puede que venga de un estado approved previo)
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.title = '';
            }
        } else if (analysisState === 'reviewing') {
            reviewing.classList.remove('hidden');
            badge.classList.add('inv-review-badge--reviewing');
            badge.innerHTML = '<i class="fas fa-edit"></i> En revisión';
            // Rehabilitar botón "Iniciar Análisis" (el usuario podría querer re-analizar desde cero)
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.title = '';
            }
        } else if (analysisState === 'approved') {
            approved.classList.remove('hidden');
            badge.classList.add('inv-review-badge--approved');
            badge.innerHTML = '<i class="fas fa-check"></i> Aprobado';
            // Anti-rebote: cuando el análisis ya está aprobado, deshabilitar el botón
            // "Iniciar Análisis" del footer para que el usuario no reinicie el flujo
            // por accidente (el siguiente paso es "Generar Informe", no re-analizar).
            if (processBtn) {
                processBtn.disabled = true;
                processBtn.title = 'Análisis aprobado — usa "Generar Informe" para continuar';
            }
        } else if (analysisState === 'dirty') {
            reviewing.classList.remove('hidden');
            badge.classList.add('inv-review-badge--dirty');
            badge.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cambios sin re-aprobar';
            // Rehabilitar botón "Iniciar Análisis" (estado dirty → permite re-empezar)
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.title = '';
            }
        }

        // Habilitar/deshabilitar botón "Generar Informe" según estado
        updateReportButtonState();
    }

    // Habilita/deshabilita el botón "Guardar Informe" del header según el estado
    function updateReportButtonState() {
        const reportBtn = document.getElementById('downloadBtn') ||
                           document.querySelector('[data-action="generate-report"]');
        if (!reportBtn) return;
        const enabled = analysisState === 'approved';
        reportBtn.disabled = !enabled;
        reportBtn.title = enabled
            ? 'Generar el informe .docx con el análisis aprobado'
            : 'Aprueba el análisis antes de generar el informe';
        reportBtn.classList.toggle('inv-btn--disabled-soft', !enabled);
    }

    // Construye el análisis efectivo: combina analysisResult + analysisEdits del usuario
    function getEffectiveAnalysis() {
        const base = normalizeAnalysisData(analysisResult) || {};
        // Aplica las ediciones inline del usuario (sobrescriben el resultado del modelo)
        const merged = {};
        Object.keys(base).forEach(levelKey => {
            merged[levelKey] = { ...base[levelKey] };
        });
        Object.keys(analysisEdits).forEach(levelKey => {
            if (!merged[levelKey]) merged[levelKey] = {};
            Object.keys(analysisEdits[levelKey]).forEach(catKey => {
                merged[levelKey][catKey] = analysisEdits[levelKey][catKey];
            });
        });
        return merged;
    }

    // ── Handlers del toolbar (expuestos como window.* para onclick inline) ──

    window._onAnalysisCellEdit = function(div) {
        const level = parseInt(div.dataset.level, 10);
        const cat = div.dataset.cat;
        if (!level || !cat) return;
        if (!analysisEdits[`PorQue${level}`]) analysisEdits[`PorQue${level}`] = {};
        const newValue = div.textContent.trim() || 'N/A';
        const wasEdited = (analysisEdits[`PorQue${level}`][cat] !== undefined);
        analysisEdits[`PorQue${level}`][cat] = newValue;
        // Marcar celda visualmente
        if (newValue.toUpperCase() === 'N/A') {
            div.classList.add('inv-why-cell-na');
        } else {
            div.classList.remove('inv-why-cell-na');
        }
        div.classList.add('is-user-edited');
        // Si ya estaba aprobado, marcar como dirty (requiere re-aprobación)
        if (analysisState === 'approved') {
            analysisState = 'dirty';
            showReviewToolbar();
        }
    };

    window._onStartReview = function() {
        if (!analysisResult) return;
        analysisState = 'reviewing';
        // Renderizar tabla editable REEMPLAZANDO las cards originales del análisis.
        // Si las dejábamos (concat), las cards ocupaban el viewport y empujaban la
        // tabla (con los botones ↻ por nivel) fuera de la vista visible.
        const editableHtml = renderEditableAnalysisTable(analysisResult);
        analysisContent.innerHTML = editableHtml;
        showReviewToolbar();
    };

    window._onCancelReview = function() {
        if (!confirm('¿Cancelar la revisión? Se descartarán los cambios inline.')) return;
        analysisState = 'idle';
        analysisEdits = {};
        // Re-renderizar el análisis en modo lectura
        displayAnalysisResults(analysisResult);
    };

    window._onApproveAnalysis = function() {
        analysisState = 'approved';
        // Limpiar highlight de edición al aprobar
        analysisContent.querySelectorAll('.is-user-edited').forEach(c => c.classList.remove('is-user-edited'));
        showReviewToolbar();
        showToast('Análisis aprobado', 'Ya puedes generar el informe.', 'success');
    };

    window._onReReview = function() {
        analysisState = 'reviewing';
        // Volver a mostrar la tabla editable con las ediciones aplicadas.
        // REEMPLAZA las cards originales — no concatenar (ver _onStartReview).
        const merged = getEffectiveAnalysis();
        const editableHtml = renderEditableAnalysisTable(merged);
        analysisContent.innerHTML = editableHtml;
        showReviewToolbar();
    };

    // Helper para hacer POST a /regenerate con auto-recuperación de Flask/Ollama
    async function callRegenerate(params) {
        try {
            // Usar la misma ruta IPC que ya está expuesta via preload
            const api = window.electronAPI;
            if (!api || typeof api.regenerateAnalysis !== 'function') {
                // Fallback: usar callParentAPI (para iframe context)
                return await callParentAPI('regenerate-analysis', params);
            }
            return await api.regenerateAnalysis(params);
        } catch (e) {
            console.error('[REGENERATE] Error:', e);
            return { success: false, error: e.message };
        }
    }

    // Regenerar un nivel específico usando el feedback del usuario
    window._onRegenerateLevel = async function(level) {
        if (isRegenerating) return;
        if (!analysisResult) return;
        const feedback = (document.getElementById('regenerateFeedback') || {}).value || '';
        const btn = document.querySelector(`.inv-btn-regenerate-level[data-level="${level}"]`);
        const btnIcon = btn ? btn.querySelector('i') : null;
        if (btn) btn.disabled = true;
        if (btnIcon) btnIcon.classList.add('regenerating');
        isRegenerating = true;

        try {
            // Extraer la descripción del accidente — `extractedData` puede tener
            // hasta doble wrapper ({success, data: {success, data: {campos}}})
            // dependiendo de cómo lo devolvió el handler.
            const innerData = extractedData?.data?.data || extractedData?.data || extractedData || {};
            const descripcion =
                innerData['Descripcion del Accidente'] ||
                innerData['Descripcion'] ||
                innerData['descripcion del accidente'] ||
                innerData['descripcion'] ||
                '';
            const contexto = (document.getElementById('contextInput') || {}).value || '';
            // Backup del análisis antes de regenerar (para "Deshacer")
            analysisOriginalBackup = JSON.parse(JSON.stringify(getEffectiveAnalysis()));
            // Construir análisis actual pasando las ediciones inline del usuario para los niveles que NO se regeneran
            const merged = getEffectiveAnalysis();
            // Si regenera nivel N, los demás niveles mantienen las ediciones inline del usuario

            const result = await callRegenerate({
                descripcion: descripcion,
                contexto: contexto,
                feedback: feedback,
                level: level,
                currentAnalysis: merged
            });

            if (result && result.success && result.data) {
                // Merge: reemplazar SOLO el nivel regenerado, mantener los demás (con ediciones)
                const regeneratedLevelKey = `PorQue${level}`;
                if (!analysisResult[regeneratedLevelKey]) analysisResult[regeneratedLevelKey] = {};
                Object.keys(result.data[regeneratedLevelKey] || {}).forEach(cat => {
                    analysisResult[regeneratedLevelKey][cat] = result.data[regeneratedLevelKey][cat];
                });
                // Si había una edición inline del usuario en ese nivel, descartarla (el modelo lo regeneró)
                if (analysisEdits[regeneratedLevelKey]) {
                    delete analysisEdits[regeneratedLevelKey];
                }
                // Limpiar backup si todo salió bien
                analysisOriginalBackup = null;
                // Re-renderizar tabla editable REEMPLAZANDO (no concatenar — ver _onStartReview).
                const newMerged = getEffectiveAnalysis();
                const editableHtml = renderEditableAnalysisTable(newMerged);
                analysisContent.innerHTML = editableHtml;

                // [Fix C] Diagnóstico: qué devolvió el modelo y cuánto tardó
                try {
                    const cats = result.data && result.data[regeneratedLevelKey] ? Object.keys(result.data[regeneratedLevelKey]) : [];
                    console.log(`[REGENERATE] Nivel ${level} regenerado OK en ${(result.generation_time || 0).toFixed(1)}s — categorías devueltas: [${cats.join(', ')}]`);
                    const rawLen = (result.raw_text || '').length;
                    console.log(`[REGENERATE] raw_text (${rawLen} chars): ${(result.raw_text || '').slice(0, 220)}${rawLen > 220 ? '…' : ''}`);
                    console.log(`[REGENERATE] data.PorQue${level}:`, result.data && result.data[regeneratedLevelKey]);
                } catch (e) { console.warn('[REGENERATE] Error en logging:', e); }

                // [Fix B] Badge persistente "regenerado por IA" en el número del nivel
                const levelNumberEl = analysisContent.querySelector(
                    `.inv-why-level-number[data-level="${level}"]`
                );
                if (levelNumberEl) levelNumberEl.classList.add('is-regenerated');

                // [Fix A] Flash temporal en las celdas del nivel regenerado (1.6s)
                // Permite al usuario ver QUÉ fila cambió y se quita sola para permitir
                // re-flash si vuelve a regenerar el mismo nivel.
                const regenCells = analysisContent.querySelectorAll(
                    `.inv-why-cell-edit[data-level="${level}"]`
                );
                regenCells.forEach(c => {
                    // Quitar clase primero para permitir re-disparar la animación
                    c.classList.remove('is-just-regenerated');
                    // Forzar reflow para reiniciar la animación
                    void c.offsetWidth;
                    c.classList.add('is-just-regenerated');
                });
                setTimeout(() => {
                    regenCells.forEach(c => c.classList.remove('is-just-regenerated'));
                }, 1700);

                showToast('Nivel regenerado', `El nivel ${level} ha sido regenerado con el feedback aplicado.`, 'success');
                logActivity('success', `Nivel ${level} del análisis regenerado con feedback`);
            } else {
                showToast('Error', result?.error || 'No se pudo regenerar el nivel', 'error');
            }
        } catch (e) {
            showToast('Error', e.message, 'error');
        } finally {
            isRegenerating = false;
            if (btn) btn.disabled = false;
            if (btnIcon) btnIcon.classList.remove('regenerating');
        }
    };

    // Regenerar el análisis completo usando el feedback del usuario
    window._onRegenerateAll = async function() {
        if (isRegenerating) return;
        if (!analysisResult) return;
        const feedback = (document.getElementById('regenerateFeedback') || {}).value || '';
        if (!feedback.trim()) {
            if (!confirm('No has escrito feedback. ¿Regenerar el análisis igualmente (sin guía específica)?')) return;
        }
        isRegenerating = true;
        const btnRegen = document.getElementById('btnRegenerateAll');
        if (btnRegen) btnRegen.disabled = true;

        try {
            // Extraer la descripción del accidente — `extractedData` puede tener
            // hasta doble wrapper ({success, data: {success, data: {campos}}})
            const innerData = extractedData?.data?.data || extractedData?.data || extractedData || {};
            const descripcion =
                innerData['Descripcion del Accidente'] ||
                innerData['Descripcion'] ||
                innerData['descripcion del accidente'] ||
                innerData['descripcion'] ||
                '';
            const contexto = (document.getElementById('contextInput') || {}).value || '';
            // Backup antes de regenerar todo
            analysisOriginalBackup = JSON.parse(JSON.stringify(getEffectiveAnalysis()));
            const merged = getEffectiveAnalysis();

            const result = await callRegenerate({
                descripcion: descripcion,
                contexto: contexto,
                feedback: feedback,
                level: null,  // null = regenerar todo
                currentAnalysis: merged
            });

            if (result && result.success && result.data) {
                // Reemplazar el análisis completo con el regenerado
                // Mantener las ediciones inline de niveles que el modelo regeneró idénticos
                analysisResult = result.data;
                // Limpiar ediciones inline del usuario (todo se regeneró)
                analysisEdits = {};
                analysisOriginalBackup = null;
                // Re-renderizar tabla editable REEMPLAZANDO (no concatenar — ver _onStartReview).
                const editableHtml = renderEditableAnalysisTable(analysisResult);
                analysisContent.innerHTML = editableHtml;
                showToast('Análisis regenerado', 'Los 5 niveles han sido regenerados.', 'success');
                logActivity('success', 'Análisis completo regenerado con feedback');
            } else {
                showToast('Error', result?.error || 'No se pudo regenerar el análisis', 'error');
            }
        } catch (e) {
            showToast('Error', e.message, 'error');
        } finally {
            isRegenerating = false;
            if (btnRegen) btnRegen.disabled = false;
        }
    };

    // Bindear listeners del toolbar de revisión AHORA que todos los handlers existen.
    // (Ver _bindReviewToolbarListeners más arriba — se pospuso para evitar referencias
    //  a window._onXxx cuando aún eran undefined).
    _bindReviewToolbarListeners();

    // Función para actualizar el estado de un paso
  function updateStepStatus(stepNumber, status) {
    const badge = document.getElementById(`step${stepNumber}Badge`);
    if (badge) {
      badge.className = 'inv-step-badge ' + status;
    }

    const stepperBadge = document.getElementById(`stepperBadge${stepNumber}`);
    if (stepperBadge) {
      stepperBadge.className = 'inv-stepper-badge ' + status;
      const stepperStep = stepperBadge.closest('.inv-stepper-step');
      if (stepperStep) {
        stepperStep.className = 'inv-stepper-step ' + status;
      }
    }

    if (status === 'completed') {
      const connIndex = stepNumber - 1;
      const connector = document.getElementById(`stepperConn${connIndex}`);
      if (connector) {
        connector.classList.add('completed');
      }
    }
  }

    // Función para actualizar la barra de progreso
    function updateProgressBar(percent, text) {
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
        if (progressText) {
            progressText.textContent = text;
        }
    }

    // Función para registrar actividad en el log
  function logActivity(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `inv-log-entry ${level}`;
    logEntry.innerHTML = `
    <span class="inv-log-timestamp">[${timestamp}]</span>
    <span class="inv-log-message">${message}</span>
    `;

    activityLog.prepend(logEntry);

    if (activityLog.children.length > 20) {
      activityLog.removeChild(activityLog.lastChild);
    }
  }

// Función para mostrar notificaciones (toast) - soporta múltiples simultáneos
let _toastContainer = null;
let _toastCounter = 0;

// Wrapper que usa el sistema moderno de notificaciones (window.parent.updateNotifier)
// y cae al inv-toast legacy si no está disponible. Compatible con showToast(title, message, type).
function showToast(title, message, type = 'info') {
  // Intentar usar el sistema moderno (estilo 6.1.3) vía window.parent.updateNotifier
  try {
    const notifier = window.parent && window.parent.updateNotifier;
    if (notifier && typeof notifier.show === 'function') {
      notifier.show({
        type: type || 'info',
        title: title,
        subtitle: message,
        autoClose: type === 'error' ? 6000 : 4000,
      });
      return;
    }
  } catch (e) { /* fallback abajo */ }

  // Fallback: inv-toast legacy (compatibilidad si updateNotifier no está)
if (!_toastContainer) {
_toastContainer = document.createElement('div');
_toastContainer.id = 'toastContainer';
    _toastContainer.style.cssText = 'position:fixed;bottom:5rem;right:1.5rem;display:flex;flex-direction:column-reverse;gap:0.5rem;z-index:1000;pointer-events:none;';
document.body.appendChild(_toastContainer);
}

const toastId = 'toast-' + (++_toastCounter);
const toast = document.createElement('div');
toast.id = toastId;
  toast.className = `inv-toast ${type}`;
  toast.style.pointerEvents = 'auto';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  let iconClass = 'fas fa-info-circle';
  if (type === 'error') iconClass = 'fas fa-exclamation-circle';
  else if (type === 'success') iconClass = 'fas fa-check-circle';
  else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';

  toast.innerHTML = `
  <div class="inv-toast-icon ${iconClass}"></div>
  <div class="inv-toast-content">
    <p class="inv-toast-title">${escapeHtml(title)}</p>
    <p class="inv-toast-message">${escapeHtml(message)}</p>
  </div>
  <button class="inv-toast-close" aria-label="Cerrar notificacion"><i class="fas fa-times"></i></button>
  `;

  const closeBtn = toast.querySelector('.inv-toast-close');
  const dismissToast = () => {
    toast.classList.add('exit');
    toast.classList.remove('show');
    setTimeout(() => { toast.remove(); }, 350);
  };
closeBtn.addEventListener('click', dismissToast);

_toastContainer.appendChild(toast);
requestAnimationFrame(() => { toast.classList.add('show'); });

setTimeout(dismissToast, 5000);
}

    // Función para formatear tamaño de archivo
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // ── Save Modal ────────────────────────────────────────────────────
const saveModal = (function() {
const modal = document.getElementById('saveReportModal');
const overlay = document.getElementById('saveModalOverlay');
const closeBtn = document.getElementById('saveModalCloseBtn');
const cancelBtn = document.getElementById('saveModalCancelBtn');
const saveBtn = document.getElementById('saveModalSaveBtn');
const goUpBtn = document.getElementById('saveModalGoUp');
const browseNativeBtn = document.getElementById('saveModalBrowseNative');
const breadcrumbEl = document.getElementById('saveModalBreadcrumb');
const folderListEl = document.getElementById('saveModalFolderList');
const newFolderBtn = document.getElementById('saveModalNewFolderBtn');
const renameBtn = document.getElementById('saveModalRenameBtn');
const deleteBtn = document.getElementById('saveModalDeleteBtn');
const newItemArea = document.getElementById('saveModalNewItemArea');
const newItemInput = document.getElementById('saveModalNewItemInput');
const newItemConfirm = document.getElementById('saveModalNewItemConfirm');
const newItemCancel = document.getElementById('saveModalNewItemCancel');
const filenameInput = document.getElementById('saveModalFilename');

let currentPath = '';
let selectedItem = null;
let isCreatingFolder = false;
let isRenaming = false;

function open() {
modal.classList.remove('hidden');
selectedItem = null;
isCreatingFolder = false;
isRenaming = false;
newItemArea.classList.add('hidden');
renameBtn.disabled = true;
deleteBtn.disabled = true;
updateSaveBtnState();
_buildSuggestedFilename();
_navigateToDefault();
}

function close() {
modal.classList.add('hidden');
selectedItem = null;
}

async function _navigateToDefault() {
  try {
    await navigateTo('DRIVES');
  } catch (err) {
    console.warn('[SaveModal] Default path failed, trying C:', err);
    try { await navigateTo('C:\\'); } catch (e2) {
      folderListEl.innerHTML = '<div class="save-modal-empty"><i class="fas fa-exclamation-circle"></i> No se pudo cargar el directorio</div>';
    }
  }
}

async function navigateTo(dirPath) {
currentPath = dirPath;
selectedItem = null;
renameBtn.disabled = true;
deleteBtn.disabled = true;
folderListEl.innerHTML = '<div class="save-modal-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

try {
const result = await callParentAPI('read-directory', { path: dirPath });
if (!result || !result.success) {
folderListEl.innerHTML = '<div class="save-modal-empty"><i class="fas fa-exclamation-circle"></i> Error al leer directorio</div>';
return;
}
    _renderBreadcrumb(result.path || dirPath);
    _renderFolderList(result.folders || [], result.files || []);
} catch (err) {
console.error('[SaveModal] read-directory error:', err);
folderListEl.innerHTML = '<div class="save-modal-empty"><i class="fas fa-exclamation-circle"></i> Error al leer directorio</div>';
}
}

function _renderBreadcrumb(path) {
  breadcrumbEl.innerHTML = '';

  function appendItem(text, navPath, isActive) {
    const item = document.createElement('span');
    item.className = 'save-modal-breadcrumb-item' + (isActive ? ' active' : '');
    item.textContent = text;
    item.dataset.path = navPath;
    if (!isActive) item.addEventListener('click', () => navigateTo(navPath));
    breadcrumbEl.appendChild(item);
  }

  function appendSep() {
    const sep = document.createElement('span');
    sep.className = 'save-modal-breadcrumb-sep';
    sep.textContent = '›';
    breadcrumbEl.appendChild(sep);
  }

  if (path === 'DRIVES') {
    appendItem('Este PC', 'DRIVES', true);
  } else if (/^[A-Za-z]:/.test(path)) {
    appendItem('Este PC', 'DRIVES', false);
    appendSep();
    const parts = path.split(/[/\\]/).filter(Boolean);
    let accumulated = parts[0] + '\\';
    appendItem(parts[0], accumulated, parts.length === 1);
    for (let i = 1; i < parts.length; i++) {
      accumulated += parts[i] + '\\';
      appendSep();
      appendItem(parts[i], accumulated, i === parts.length - 1);
    }
  } else {
    const parts = path.split(/[/\\]/).filter(Boolean);
    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i];
      appendItem(parts[i], accumulated, i === parts.length - 1);
      if (i < parts.length - 1) appendSep();
    }
  }

  breadcrumbEl.scrollLeft = breadcrumbEl.scrollWidth;
}

function _renderFolderList(folders, files) {
folderListEl.innerHTML = '';

if (folders.length === 0 && files.length === 0) {
folderListEl.innerHTML = '<div class="save-modal-empty"><i class="fas fa-folder-open"></i> Carpeta vacía</div>';
return;
}

folders.sort((a, b) => a.name.localeCompare(b.name));
files.sort((a, b) => a.name.localeCompare(b.name));

  folders.forEach(f => {
    const el = document.createElement('div');
    el.className = 'save-modal-folder-item';
    el.dataset.path = f.path;
    el.dataset.name = f.name;
    el.dataset.type = 'folder';
    if (f.isDrive) el.dataset.isDrive = 'true';
    const iconClass = f.isDrive ? 'fas fa-hdd' : 'fas fa-folder';
    el.innerHTML = `
      <i class="${iconClass} save-modal-folder-item-icon"></i>
      <span class="save-modal-folder-item-name">${escapeHtml(f.name)}</span>
    `;
    el.addEventListener('click', (e) => _selectItem(el, f));
    el.addEventListener('dblclick', () => navigateTo(f.path));
    folderListEl.appendChild(el);
  });

files.forEach(f => {
const el = document.createElement('div');
el.className = 'save-modal-folder-item';
el.dataset.path = f.path;
el.dataset.name = f.name;
el.dataset.type = 'file';
const sizeStr = f.size ? formatFileSize(f.size) : '';
el.innerHTML = `
<i class="fas fa-file save-modal-folder-item-icon file"></i>
<span class="save-modal-folder-item-name">${escapeHtml(f.name)}</span>
<span class="save-modal-folder-item-meta">${sizeStr}</span>
`;
el.addEventListener('click', (e) => _selectItem(el, f));
folderListEl.appendChild(el);
});
}

function _selectItem(el, itemData) {
const prev = folderListEl.querySelector('.save-modal-folder-item.selected');
if (prev) prev.classList.remove('selected');
el.classList.add('selected');
selectedItem = { el, ...itemData, isDirectory: itemData.isDirectory !== undefined ? itemData.isDirectory : el.dataset.type === 'folder' };
renameBtn.disabled = false;
deleteBtn.disabled = false;
}

function _buildSuggestedFilename() {
let workerName = '';
let fecha = '';

let actualExtractedData = extractedData;
if (extractedData && extractedData.success === true && extractedData.data) {
actualExtractedData = extractedData.data;
if (actualExtractedData && actualExtractedData.success === true && actualExtractedData.data) {
actualExtractedData = actualExtractedData.data;
}
}

if (actualExtractedData) {
workerName = actualExtractedData['Nombre Completo'] || actualExtractedData.nombre_completo || '';
fecha = actualExtractedData['Fecha del Accidente'] || actualExtractedData.fecha_accidente || '';
}

if (workerName) {
workerName = workerName.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '');
}

if (fecha) {
fecha = fecha.replace(/[\/\\-]/g, '').replace(/\s+/g, '_');
}

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const parts = ['INVESTIGACION'];
if (workerName) parts.push(workerName);
parts.push(today);
filenameInput.value = parts.join('_');
updateSaveBtnState();
}

function updateSaveBtnState() {
  const hasFilename = filenameInput.value.trim().length > 0;
  const hasPath = currentPath.length > 0 && currentPath !== 'DRIVES';
  saveBtn.disabled = !(hasFilename && hasPath);
}

async function _handleGoUp() {
  if (!currentPath) return;
  if (currentPath === 'DRIVES') return;
  if (/^[A-Za-z]:\\$/.test(currentPath)) {
    await navigateTo('DRIVES');
    return;
  }
  const sep = currentPath.includes('/') ? '/' : '\\';
  const parts = currentPath.replace(/[/\\]+$/, '').split(sep);
  if (parts.length <= 1) {
    await navigateTo('DRIVES');
    return;
  }
  parts.pop();
  const parentPath = parts.join(sep);
  if (/^[A-Za-z]:$/.test(parentPath)) {
    await navigateTo(parentPath + '\\');
    return;
  }
  if (parentPath.length < 3) {
    await navigateTo('DRIVES');
    return;
  }
  await navigateTo(parentPath + (parentPath.match(/^[A-Za-z]:$/) ? '\\' : ''));
}

async function _handleBrowseNative() {
  try {
    const result = await callParentAPI('select-directory', {});
    if (result && typeof result === 'string' && result.length > 0) {
      await navigateTo(result);
    }
  } catch (err) {
    showToast('Error', 'No se pudo abrir el selector de carpeta.', 'error');
  }
}

function _showCreateFolderInput() {
isCreatingFolder = true;
isRenaming = false;
newItemArea.classList.remove('hidden');
newItemInput.value = '';
newItemInput.placeholder = 'Nombre de la nueva carpeta';
newItemInput.focus();
}

function _hideNewItemArea() {
isCreatingFolder = false;
newItemArea.classList.add('hidden');
newItemInput.value = '';
}

async function _confirmCreateFolder() {
const folderName = newItemInput.value.trim();
if (!folderName) {
showToast('Error', 'El nombre de la carpeta no puede estar vacío.', 'error');
return;
}
try {
const result = await callParentAPI('create-folder', { parentPath: currentPath, folderName });
if (result && result.success) {
showToast('Carpeta creada', `"${folderName}" creada exitosamente.`, 'success');
_hideNewItemArea();
await navigateTo(currentPath);
} else {
const errMsg = (result && result.error && result.error.message) || 'No se pudo crear la carpeta.';
showToast('Error', errMsg, 'error');
}
} catch (err) {
showToast('Error', `No se pudo crear la carpeta: ${err.message}`, 'error');
}
}

function _startRename() {
if (!selectedItem || !selectedItem.el) return;
isRenaming = true;
isCreatingFolder = false;
newItemArea.classList.add('hidden');

const nameSpan = selectedItem.el.querySelector('.save-modal-folder-item-name');
if (!nameSpan) return;

const currentName = selectedItem.name || nameSpan.textContent;
const input = document.createElement('input');
input.type = 'text';
input.className = 'save-modal-rename-input';
input.value = currentName;

nameSpan.replaceWith(input);
input.focus();
input.select();

const finishRename = async () => {
const newName = input.value.trim();
if (!newName || newName === currentName) {
_cancelRename(input, currentName);
return;
}
try {
const result = await callParentAPI('rename-item', { itemPath: selectedItem.path, newName });
if (result && result.success) {
showToast('Renombrado', `"${currentName}" → "${newName}"`, 'success');
await navigateTo(currentPath);
} else if (result && result.error) {
const code = result.error.code;
if (code === 'EEXIST') {
showToast('Error', `Ya existe un elemento llamado "${newName}".`, 'error');
} else {
showToast('Error', result.error.message || 'No se pudo renombrar.', 'error');
}
_cancelRename(input, currentName);
}
} catch (err) {
showToast('Error', `No se pudo renombrar: ${err.message}`, 'error');
_cancelRename(input, currentName);
}
isRenaming = false;
};

const cancelRename = () => {
_cancelRename(input, currentName);
isRenaming = false;
};

input.addEventListener('keydown', (e) => {
if (e.key === 'Enter') { e.preventDefault(); finishRename(); }
else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
});
input.addEventListener('blur', finishRename);
}

function _cancelRename(inputEl, originalName) {
const span = document.createElement('span');
span.className = 'save-modal-folder-item-name';
span.textContent = originalName;
inputEl.replaceWith(span);
}

async function _handleDelete() {
if (!selectedItem) return;
const name = selectedItem.name || 'este elemento';
const typeLabel = selectedItem.isDirectory ? 'la carpeta' : 'el archivo';
showToast('Eliminando', `Moviendo ${typeLabel} "${name}" a la papelera...`, 'warning');

try {
const apiType = selectedItem.isDirectory ? 'delete-folder' : 'delete-document';
const payload = selectedItem.isDirectory
? { folderPath: selectedItem.path }
: { documentPath: selectedItem.path };

const result = await callParentAPI(apiType, payload);
if (result && result.success) {
showToast('Eliminado', `"${name}" movido a la papelera.`, 'success');
selectedItem = null;
renameBtn.disabled = true;
deleteBtn.disabled = true;
await navigateTo(currentPath);
} else {
showToast('Error', 'No se pudo eliminar el elemento.', 'error');
}
} catch (err) {
showToast('Error', `No se pudo eliminar: ${err.message}`, 'error');
}
}

async function _handleSave() {
const filename = filenameInput.value.trim();
if (!filename) {
showToast('Error', 'Ingresa un nombre para el informe.', 'error');
return;
}

saveBtn.disabled = true;
saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
progressArea.classList.remove('hidden');
updateProgressBar(80, 'Generando informe de investigación...');
logActivity('info', 'Generando informe en: ' + currentPath + ' → ' + filename + '.docx');

try {
let actualExtractedData = extractedData;
if (extractedData && extractedData.success === true && extractedData.data) {
actualExtractedData = extractedData.data;
if (actualExtractedData && actualExtractedData.success === true && actualExtractedData.data) {
actualExtractedData = actualExtractedData.data;
}
}

let actualAnalysis = analysisResult;
if (analysisResult && analysisResult.success === true && analysisResult.analysis) {
actualAnalysis = analysisResult.analysis;
}

const combinedData = {
...actualExtractedData,
analysis: actualAnalysis,
empresa: currentEmpresa,
_outputDir: currentPath,
_outputFilename: filename
};

console.log('[SaveModal] combinedData with output:', { _outputDir: currentPath, _outputFilename: filename });

let api = window.electronAPI;
if (!api) {
api = {
generateAccidentReport: async (combinedData) => {
return await callParentAPI('generate-accident-report', combinedData);
}
};
}

const reportResult = await api.generateAccidentReport(combinedData);

if (reportResult && reportResult.documentPath) {
logActivity('success', `Informe generado: ${reportResult.documentPath}`);
showToast('Informe generado', `Guardado en: ${reportResult.documentPath}`, 'success');

// Guardar ruta y habilitar botones de header para acceder al informe
lastReportPath = reportResult.documentPath;
if (downloadBtn) downloadBtn.disabled = false;
if (printBtn) printBtn.disabled = false;

updateStepStatus(5, 'completed');
close();
} else {
logActivity('warn', 'El informe se generó pero no se recibió la ruta del documento');
showToast('Advertencia', 'El informe se generó pero no se recibió la ruta.', 'warning');
updateStepStatus(5, 'completed');
close();
}
} catch (reportError) {
console.error('[SaveModal] Error generando informe:', reportError);
logActivity('error', `Error generando informe: ${reportError.message}`);
showToast('Error en informe', `Error al generar: ${reportError.message}`, 'error');
} finally {
saveBtn.disabled = false;
saveBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Informe';
updateSaveBtnState();
progressArea.classList.add('hidden');
}
}

// ── Event bindings ──
if (closeBtn) closeBtn.addEventListener('click', close);
if (cancelBtn) cancelBtn.addEventListener('click', close);
if (overlay) overlay.addEventListener('click', close);
if (goUpBtn) goUpBtn.addEventListener('click', _handleGoUp);
if (browseNativeBtn) browseNativeBtn.addEventListener('click', _handleBrowseNative);
if (newFolderBtn) newFolderBtn.addEventListener('click', _showCreateFolderInput);
if (renameBtn) renameBtn.addEventListener('click', _startRename);
if (deleteBtn) deleteBtn.addEventListener('click', _handleDelete);
if (saveBtn) saveBtn.addEventListener('click', _handleSave);
if (newItemConfirm) newItemConfirm.addEventListener('click', _confirmCreateFolder);
if (newItemCancel) newItemCancel.addEventListener('click', _hideNewItemArea);
if (filenameInput) filenameInput.addEventListener('input', updateSaveBtnState);

if (newItemInput) {
    newItemInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); _confirmCreateFolder(); }
      else if (e.key === 'Escape') { e.preventDefault(); _hideNewItemArea(); }
    });
  }

  // ── Paso 3 (Contexto): actualizar stepper al escribir ────────────
  const contextInput = document.getElementById('contextInput');
  const contextHint = document.getElementById('contextHint');
  if (contextInput) {
    contextInput.addEventListener('input', function() {
      const len = contextInput.value.trim().length;
      if (len >= 20) {
        updateStepStatus(3, 'completed');
        if (contextHint) contextHint.style.display = 'none';
      } else if (len > 0) {
        updateStepStatus(3, 'active');
        if (contextHint) {
          contextHint.style.display = '';
          contextHint.textContent = `Faltan ${20 - len} caracteres para considerarlo en el análisis.`;
        }
      } else {
        updateStepStatus(3, 'pending');
        if (contextHint) {
          contextHint.style.display = '';
          contextHint.textContent = 'Mínimo 20 caracteres para que el análisis lo considere.';
        }
      }
    });
  }

document.addEventListener('keydown', (e) => {
if (modal.classList.contains('hidden')) return;
if (e.key === 'Escape' && !isRenaming && !isCreatingFolder) { close(); }
});

// Botón "Generar Informe" del toolbar de aprobación (HTML id=btnGenerateReportFromApproval).
// Antes de este cambio, no había forma de abrir el saveModal desde la UI tras aprobar —
// el approved toolbar solo tenía "Re-revisar". Ahora el botón dispara open() que hace
// el setup completo (filename sugerido, navegación al dir por defecto, reset de estado).
const btnGenerateReportFromApproval = document.getElementById('btnGenerateReportFromApproval');
if (btnGenerateReportFromApproval) {
    btnGenerateReportFromApproval.addEventListener('click', () => {
        open();
    });
}

return { open, close, navigateTo };
  })();

  // ── Auto-carga desde "Iniciar Investigación" en el listado ──────────────
  // Si se llegó aquí desde investigaciones-viewer.js con un caso y/o FURAT
  // pre-seleccionado, pre-poblar el formulario y disparar el procesamiento.
    if (urlFuratPath) {
        const autoFilename = urlFuratPath.split('\\').pop().split('/').pop();
        selectedPdfPath = urlFuratPath;
        if (selectedFileName) selectedFileName.textContent = autoFilename;
        if (selectedFileInfo) selectedFileInfo.classList.remove('hidden');
        if (dropZone) setDropzoneState('selected');
        if (processBtn) processBtn.disabled = false;
        updateStepStatus(1, 'completed');
        showToast(
            urlNombre ? ('Investigación: ' + urlNombre) : 'FURAT cargado',
            'Procesando: ' + autoFilename,
            'info'
        );
        processPdfFile(urlFuratPath).catch(function(err) {
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error al auto-cargar FURAT:', err);
            showToast('Error', 'No se pudo procesar el FURAT: ' + err.message, 'error');
        });
    } else if (urlNombre) {
        // FALLBACK: el viewer no envió furatPath. Intentar encontrar el archivo
        // en el módulo 3.2.1 buscando por nombre normalizado.
        console.log('[INVESTIGACION-ACCIDENTES-MAIN] urlFuratPath vacío, buscando FURAT por nombre:', urlNombre);
        showToast('Buscando FURAT...', 'Localizando el archivo en el sistema.', 'info');

        // Usar directamente window.electronAPI.findFuratByName (preload expone el IPC).
        // Si no está disponible por caché, hacer fallback a callParentAPI SIN prefijo
        // (callParentAPI ya agrega 'investigacion-accidentes-' al inicio del tipo).
        function _findFuratDirect(companyName, caseName) {
            if (window.electronAPI && typeof window.electronAPI.findFuratByName === 'function') {
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] Usando window.electronAPI.findFuratByName directo');
                return window.electronAPI.findFuratByName(companyName, caseName);
            }
            console.log('[INVESTIGACION-ACCIDENTES-MAIN] Fallback: usando callParentAPI con prefijo automático');
            return callParentAPI('find-furat-by-name', { companyName, caseName });
        }

        _findFuratDirect(currentEmpresa, urlNombre).then(function(result) {
            if (result && result.success && result.data && result.data.furatPath) {
                const furatPath = result.data.furatPath;
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] FURAT encontrado por fallback:', furatPath);
                const autoFilename = result.data.furatName || furatPath.split('\\').pop().split('/').pop();
                selectedPdfPath = furatPath;
                if (selectedFileName) selectedFileName.textContent = autoFilename;
                if (selectedFileInfo) selectedFileInfo.classList.remove('hidden');
                if (dropZone) setDropzoneState('selected');
                if (processBtn) processBtn.disabled = false;
                updateStepStatus(1, 'completed');
                showToast('FURAT localizado', 'Procesando: ' + autoFilename, 'success');
                logActivity('info', 'FURAT localizado por fallback: ' + autoFilename);
                return processPdfFile(furatPath);
            } else {
                console.warn('[INVESTIGACION-ACCIDENTES-MAIN] FURAT no encontrado por fallback:', result);
                showToast(
                    'Caso: ' + urlNombre,
                    'No se encontró el FURAT. Súbelo manualmente desde la dropzone.',
                    'warning'
                );
                logActivity('warn', 'FURAT no encontrado en 3.2.1. Usuario debe subirlo manualmente.');
            }
        }).catch(function(err) {
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en fallback findFuratByName:', err);
            showToast(
                'Caso: ' + urlNombre,
                'No se pudo localizar el FURAT. Súbelo manualmente.',
                'warning'
            );
        });
    }

    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Inicialización completada');
});