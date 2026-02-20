// investigacion-accidentes-main.js - Script principal para la interfaz moderna de investigación de accidentes

document.addEventListener('DOMContentLoaded', function() {
    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Script cargado y DOM listo');

    // Elementos del DOM
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
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
    
    // Obtener empresa desde parámetros de URL o window.currentCompany
    const urlParams = new URLSearchParams(window.location.search);
    const urlCompany = urlParams.get('company');
    const currentEmpresa = urlCompany || window.currentCompany || 'TEMPOACTIVA';
    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Empresa detectada:', currentEmpresa, '(URL:', urlCompany, ', window:', window.currentCompany, ')');

    // Configurar la empresa actual si está disponible
    if (currentEmpresa && companyNameElement) {
        companyNameElement.textContent = currentEmpresa;
    }

    // Evento para abrir el diálogo de selección de archivo
    dropZone.addEventListener('click', function() {
        fileInput.click();
    });

    // Manejar la selección de archivo
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            
            // Validar que sea un PDF
            if (file.type !== 'application/pdf') {
                showToast('Error', 'Por favor selecciona un archivo PDF válido.', 'error');
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
                    
                    // Actualizar estado visual
                    dropZone.classList.add('has-file');
                    updateStepStatus(1, 'completed');
                    
                    // Habilitar botón de análisis
                    processBtn.disabled = false;
                    
                    // INICIAR PROCESAMIENTO AUTOMÁTICO DEL PDF
                    showToast('Procesando PDF', 'Extrayendo datos del documento...', 'info');
                    await processPdfFile(selectedPdfPath);
                    
                    showToast('Archivo seleccionado', `Datos extraídos de: ${file.name}`, 'success');
                } catch (error) {
                    console.error('Error guardando archivo temporal:', error);
                    showToast('Error', `No se pudo procesar el archivo: ${error.message}`, 'error');
                }
            };
            
            reader.onerror = function() {
                showToast('Error', 'No se pudo leer el archivo.', 'error');
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
            
            if (file.type === 'application/pdf') {
                // Simular evento de cambio en el input
                const event = new Event('change', { bubbles: true });
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(event);
            } else {
                showToast('Error', 'Solo se aceptan archivos PDF.', 'error');
            }
        }
    });

    // Eliminar archivo seleccionado
    removeFileBtn.addEventListener('click', function() {
        fileInput.value = '';
        selectedPdfPath = null;
        selectedFileInfo.classList.add('hidden');
        dropZone.classList.remove('has-file');
        processBtn.disabled = true;
        updateStepStatus(1, 'pending');
        
        dataContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-file-medical-alt"></i>
                </div>
                <p>Selecciona un PDF para extraer los datos</p>
            </div>
        `;
        
        // Limpiar también el análisis
        analysisContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-brain"></i>
                </div>
                <p>Los resultados del análisis aparecerán aquí</p>
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
            dropZone.classList.remove('has-file');
            
            // Limpiar datos y análisis
            extractedData = null;
            analysisResult = null;
            
            // Limpiar contenidos
            dataContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-file-medical-alt"></i>
                    </div>
                    <p>Selecciona un PDF para extraer los datos</p>
                </div>
            `;
            
            analysisContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-brain"></i>
                    </div>
                    <p>Los resultados del análisis aparecerán aquí</p>
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

    // Botón de procesamiento - Solo ejecuta el análisis si los datos ya están extraídos
    processBtn.addEventListener('click', async function() {
        if (!extractedData) {
            showToast('Error', 'Primero debes seleccionar y procesar un archivo PDF.', 'error');
            return;
        }
        
        // Ejecutar solo el análisis con los datos ya extraídos
        await runAnalysis();
    });

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
                <div class="empty-state">
                    <div class="empty-icon">
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

        try {
            // Mostrar barra de progreso
            progressArea.classList.remove('hidden');
            updateProgressBar(0, 'Iniciando análisis...');

            // Actualizar paso 4 (análisis)
            updateStepStatus(4, 'active');

            // Mostrar estado de análisis con información de carga del modelo
            analysisContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-brain fa-spin"></i>
                    </div>
                    <p id="analysis-status">Iniciando servidor de IA...</p>
                    <p class="text-muted" id="analysis-substatus" style="font-size: 0.9em; margin-top: 8px;">
                        La primera ejecución puede tardar 4-5 minutos mientras se carga el modelo
                    </p>
                    <div class="progress mt-3" style="max-width: 400px; margin: 15px auto;">
                        <div class="progress-bar progress-bar-striped progress-bar-animated" 
                             role="progressbar" 
                             id="model-progress"
                             style="width: 0%"></div>
                    </div>
                    <p class="text-muted" id="model-progress-text" style="font-size: 0.85em;"></p>
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
            // GENERACIÓN AUTOMÁTICA DEL INFORME
            // ─────────────────────────────────────────────────────────────
            updateProgressBar(80, 'Generando informe de investigación...');
            logActivity('info', 'Iniciando generación del informe...');
            
            try {
                // Desanidar datos extraídos (pueden tener estructura {success, data: {success, data: {...}}})
                let actualExtractedData = extractedData;
                if (extractedData && extractedData.success === true && extractedData.data) {
                    // Desanidar primer nivel
                    actualExtractedData = extractedData.data;
                    // Desanidar segundo nivel si existe
                    if (actualExtractedData && actualExtractedData.success === true && actualExtractedData.data) {
                        actualExtractedData = actualExtractedData.data;
                    }
                }
                
                // Desanidar análisis (puede tener estructura {success, analysis: {...}})
                let actualAnalysis = analysisResult;
                if (analysisResult && analysisResult.success === true && analysisResult.analysis) {
                    actualAnalysis = analysisResult.analysis;
                }
                
                // Usar la empresa detectada al inicio del script (desde URL o window.currentCompany)
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] Empresa para informe:', currentEmpresa);
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] Datos extraídos desanidados:', actualExtractedData);
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] Análisis desanidado:', actualAnalysis);
                
                // Combinar datos extraídos con resultados del análisis
                const combinedData = {
                    ...actualExtractedData,
                    analysis: actualAnalysis,
                    empresa: currentEmpresa
                };
                
                console.log('[INVESTIGACION-ACCIDENTES-MAIN] combinedData final:', combinedData);
                
                // Llamar a la generación del informe
                const reportResult = await api.generateAccidentReport(combinedData);
                
                if (reportResult && reportResult.documentPath) {
                    logActivity('success', `Informe generado: ${reportResult.documentPath}`);
                    showToast('Informe generado', `El informe de investigación ha sido guardado exitosamente.`, 'success');
                    
                    // Habilitar botones de descarga e impresión
                    const downloadBtn = document.getElementById('downloadBtn');
                    const printBtn = document.getElementById('printBtn');
                    if (downloadBtn) downloadBtn.disabled = false;
                    if (printBtn) printBtn.disabled = false;
                } else {
                    logActivity('warn', 'El informe se generó pero no se recibió la ruta del documento');
                }
            } catch (reportError) {
                console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error generando informe:', reportError);
                logActivity('error', `Error generando informe: ${reportError.message}`);
                showToast('Error en informe', `El análisis se completó pero hubo un error al generar el informe: ${reportError.message}`, 'warning');
            }
            
            // Actualizar paso 5 (registro de actividad)
            updateStepStatus(5, 'completed');
            
            showToast('Proceso completado', 'El análisis de causa raíz y la generación del informe han sido completados.', 'success');
            
        } catch (analysisError) {
            // Error específico del análisis
            console.error('[INVESTIGACION-ACCIDENTES-MAIN] Error en el análisis:', analysisError);
            logActivity('error', `Error en el análisis: ${analysisError.message}`);
            
            // Mostrar error en la sección de análisis
            analysisContent.innerHTML = `
                <div class="empty-state error-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <p>Error en el análisis de causa raíz</p>
                    <p class="error-detail">${analysisError.message}</p>
                    <p class="error-hint">Los datos del accidente fueron extraídos correctamente. El análisis requiere GPU con suficiente memoria VRAM.</p>
                </div>
            `;
            
            updateStepStatus(4, 'error');
            showToast('Error en análisis', `El análisis falló: ${analysisError.message}`, 'error');
        } finally {
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
                // Verificar si la respuesta corresponde a nuestra solicitud
                const responseType = response.type;
                const expectedResponseType = `investigacion-accidentes-${type}-request-response`;
                
                // Verificar que el requestId coincida con el nuestro para evitar conflictos con otros módulos
                if (response.requestId && response.requestId.startsWith('investigacion-accidentes-') && response.requestId === requestId) {
                    // Limpiar el timeout si existe
                    if (window._investigacionTimeoutClear && window._investigacionTimeoutClear[requestId]) {
                        window._investigacionTimeoutClear[requestId]();
                        delete window._investigacionTimeoutClear[requestId];
                    }
                    
                    // Manejar el caso especial para save-temp-pdf-file
                    if (type === 'save-temp-pdf-file' && responseType === 'investigacion-accidentes-save-temp-pdf-file-request-response') {
                        // Limpiar el listener de eventos
                        window.removeEventListener('message', handleResponse);
                        
                        if (response.success) {
                            resolve(response.payload);
                        } else {
                            const errorMessage = response.error || 'Error desconocido desde la ventana padre';
                            reject(new Error(errorMessage));
                        }
                    } else if (responseType === expectedResponseType) {
                        // Limpiar el listener de eventos
                        window.removeEventListener('message', handleResponse);
                        
                        if (response.success) {
                            resolve(response.payload);
                        } else {
                            const errorMessage = response.error || 'Error desconocido desde la ventana padre';
                            reject(new Error(errorMessage));
                        }
                    }
                } else if (responseType === `${type}-response`) {
                    // Limpiar el timeout si existe
                    if (window._investigacionTimeoutClear && window._investigacionTimeoutClear[requestId]) {
                        window._investigacionTimeoutClear[requestId]();
                        delete window._investigacionTimeoutClear[requestId];
                    }
                    
                    // Compatibilidad con el formato anterior por si acaso
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
            }, 600000); // 600 segundos (10 minutos) de timeout
            
            // Función para limpiar el timeout (será llamada desde handleResponse)
            window._investigacionTimeoutClear = window._investigacionTimeoutClear || {};
            window._investigacionTimeoutClear[requestId] = () => clearTimeout(timeoutId);
        });
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
            
            dataContent.innerHTML = `<div class="empty-state error-state">
                <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <p>Error al extraer datos del PDF</p>
                <p class="error-detail">${escapeHtml(errorMsg)}</p>
                <p class="error-hint">Verifique que el archivo PDF sea válido y que las dependencias de Python estén instaladas.</p>
            </div>`;
            return;
        }
        
        // Verificar si hay datos vacíos
        if (!actualData || Object.keys(actualData).length === 0) {
            dataContent.innerHTML = `<div class="empty-state">
                <div class="empty-icon"><i class="fas fa-file-excel"></i></div>
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
        
        let htmlContent = '<div class="data-grid">';
        
        // Mostrar cada campo
        fields.forEach(field => {
            const value = actualData[field.key] || 'N/A';
            htmlContent += `
                <div class="data-field">
                    <label>${field.label}</label>
                    <div class="value">${escapeHtml(value)}</div>
                </div>
            `;
        });
        
        htmlContent += '</div>';
        
        // Mostrar descripción del accidente (campo especial, más grande)
        const descripcion = actualData['Descripcion del Accidente'] || actualData['Descripcion'] || 'N/A';
        if (descripcion && descripcion !== 'N/A') {
            htmlContent += `
                <div class="data-description">
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
            
            analysisContent.innerHTML = `
                <div class="empty-state error-state">
                    <div class="empty-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <p>Error en el análisis de causa raíz</p>
                    <p class="error-detail">${escapeHtml(errorMsg)}</p>
                    <p class="error-hint">El análisis requiere una GPU con suficiente memoria VRAM (mínimo 8GB para Mistral-7B 4-bit).</p>
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
            htmlContent += '<h3 style="margin-bottom: 20px; color: #174ea6;"><i class="fas fa-brain" style="margin-right: 10px;"></i>Análisis 5 Por Qués</h3>';

            // Iterar sobre las claves ordenadas (PorQue1, PorQue2, etc.)
            const porQueKeys = allKeys
                .filter(key => 
                    key.includes('PorQue') || 
                    key.includes('Por Qu') || 
                    key.includes('Porqué') || 
                    key.includes('Por que')
                )
                .sort((a, b) => {
                    // Extraer números de las claves (PorQue1 -> 1, PorQue2 -> 2, etc.)
                    const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                    const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                    return numA - numB;
                });

            console.log('[INVESTIGACION-ACCIDENTES-MAIN] porQueKeys:', porQueKeys);

            porQueKeys.forEach((key, index) => {
                const porQueData = analysisData[key];
                console.log(`[INVESTIGACION-ACCIDENTES-MAIN] ${key}:`, porQueData);
                
                // Obtener la pregunta si existe
                const pregunta = porQueData.Pregunta || `¿Por qué? - Nivel ${index + 1}`;
                
                htmlContent += `
                    <div class="why-card" style="margin-bottom: 20px; border-left: 4px solid #174ea6; background: #f8f9fa; border-radius: 8px; padding: 15px;">
                        <div class="why-header" style="margin-bottom: 15px;">
                            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                                <div style="background: #174ea6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0;">${index + 1}</div>
                                <h4 style="margin: 0; color: #174ea6; font-size: 1.1em;">${escapeHtml(pregunta)}</h4>
                            </div>
                        </div>
                        <div class="m-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                            <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                                <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px; font-size: 0.9em;">👷 Mano de Obra</div>
                                <div class="m-content" style="color: #6c757d; font-size: 0.9em;">${escapeHtml(porQueData['Mano de Obra'] || 'N/A')}</div>
                            </div>
                            <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                                <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px; font-size: 0.9em;">📋 Método</div>
                                <div class="m-content" style="color: #6c757d; font-size: 0.9em;">${escapeHtml(porQueData['Método'] || porQueData['Metodo'] || 'N/A')}</div>
                            </div>
                            <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                                <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px; font-size: 0.9em;">⚙️ Maquinaria</div>
                                <div class="m-content" style="color: #6c757d; font-size: 0.9em;">${escapeHtml(porQueData['Maquinaria'] || 'N/A')}</div>
                            </div>
                            <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                                <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px; font-size: 0.9em;">🌍 Medio Ambiente</div>
                                <div class="m-content" style="color: #6c757d; font-size: 0.9em;">${escapeHtml(porQueData['Medio Ambiente'] || 'N/A')}</div>
                            </div>
                            <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                                <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px; font-size: 0.9em;">📦 Material</div>
                                <div class="m-content" style="color: #6c757d; font-size: 0.9em;">${escapeHtml(porQueData['Material'] || 'N/A')}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            htmlContent += '</div>';
            
            // Agregar causas raíz si existen
            if (analysisData.causasRaiz || analysisData.CausasRaiz) {
                const causasRaiz = analysisData.causasRaiz || analysisData.CausasRaiz;
                htmlContent += `
                    <div class="root-causes" style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                        <h4 style="color: #856404; margin-bottom: 15px;"><i class="fas fa-exclamation-triangle" style="margin-right: 10px;"></i>Causas Raíz Identificadas</h4>
                        <div style="color: #856404;">${escapeHtml(typeof causasRaiz === 'string' ? causasRaiz : JSON.stringify(causasRaiz))}</div>
                    </div>
                `;
            }
            
            // Agregar acciones correctivas si existen
            if (analysisData.accionesCorrectivas || analysisData.AccionesCorrectivas) {
                const acciones = analysisData.accionesCorrectivas || analysisData.AccionesCorrectivas;
                htmlContent += `
                    <div class="corrective-actions" style="margin-top: 20px; padding: 20px; background: #d4edda; border-radius: 8px; border-left: 4px solid #28a745;">
                        <h4 style="color: #155724; margin-bottom: 15px;"><i class="fas fa-check-circle" style="margin-right: 10px;"></i>Acciones Correctivas Recomendadas</h4>
                        <div style="color: #155724;">${escapeHtml(typeof acciones === 'string' ? acciones : JSON.stringify(acciones))}</div>
                    </div>
                `;
            }
        } else if (analysisData.cinco_porques && Array.isArray(analysisData.cinco_porques)) {
            // Formato anterior: {"cinco_porques": [...], "analisis_ishikawa": {...}}
            htmlContent += '<div class="five-whys">';
            htmlContent += '<h3 style="margin-bottom: 20px; color: #174ea6;"><i class="fas fa-search" style="margin-right: 10px;"></i>Análisis 5 Por Qués</h3>';
            
            analysisData.cinco_porques.forEach((item, index) => {
                htmlContent += `
                    <div class="why-card" style="margin-bottom: 20px; border-left: 4px solid #174ea6; background: #f8f9fa; border-radius: 8px; padding: 15px;">
                        <div class="why-header" style="display: flex; align-items: center; margin-bottom: 15px;">
                            <div style="background: #174ea6; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px;">${index + 1}</div>
                            <h4 style="margin: 0; color: #174ea6;">¿Por qué?</h4>
                        </div>
                        <div style="color: #6c757d;">${escapeHtml(item.respuesta || item.porque || item.razon || 'No disponible')}</div>
                    </div>
                `;
            });
            htmlContent += '</div>';
        }

        // Mostrar análisis Ishikawa si está disponible (formato anterior)
        if (analysisData.analisis_ishikawa) {
            htmlContent += `
                <div class="ishikawa-analysis" style="margin-top: 30px;">
                    <h3 style="margin-bottom: 20px; color: #174ea6;"><i class="fas fa-fish" style="margin-right: 10px;"></i>Análisis Ishikawa</h3>
                    <div class="m-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                            <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px;">👷 Mano de Obra</div>
                            <div class="m-content" style="color: #6c757d;">${escapeHtml(analysisData.analisis_ishikawa.mano_obra || 'No disponible')}</div>
                        </div>
                        <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                            <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px;">⚙️ Máquinas</div>
                            <div class="m-content" style="color: #6c757d;">${escapeHtml(analysisData.analisis_ishikawa.maquinas || 'No disponible')}</div>
                        </div>
                        <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                            <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px;">📦 Materiales</div>
                            <div class="m-content" style="color: #6c757d;">${escapeHtml(analysisData.analisis_ishikawa.materiales || 'No disponible')}</div>
                        </div>
                        <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                            <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px;">📋 Métodos</div>
                            <div class="m-content" style="color: #6c757d;">${escapeHtml(analysisData.analisis_ishikawa.metodos || 'No disponible')}</div>
                        </div>
                        <div class="m-cell" style="background: white; padding: 10px; border-radius: 6px; border: 1px solid #dee2e6;">
                            <div class="m-category" style="font-weight: bold; color: #495057; margin-bottom: 5px;">🌍 Medio Ambiente</div>
                            <div class="m-content" style="color: #6c757d;">${escapeHtml(analysisData.analisis_ishikawa.medio_ambiente || 'No disponible')}</div>
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
                    <div class="analysis-raw" style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
                        <h3 style="margin-bottom: 20px; color: #174ea6;"><i class="fas fa-file-alt" style="margin-right: 10px;"></i>Análisis Generado</h3>
                        <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">${escapeHtml(results.raw_text)}</div>
                    </div>
                `;
            } else {
                htmlContent = `
                    <div class="empty-state">
                        <div class="empty-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <p>Análisis completado pero sin resultados detallados</p>
                        <p class="empty-subtitle">Los datos del análisis no contienen información estructurada.</p>
                    </div>
                `;
            }
        }
        
        analysisContent.innerHTML = htmlContent;
    }

    // Función para actualizar el estado de un paso
    function updateStepStatus(stepNumber, status) {
        const badge = document.getElementById(`step${stepNumber}Badge`);
        if (badge) {
            badge.className = 'step-badge ' + status;
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
        logEntry.className = `log-entry ${level}`;
        logEntry.innerHTML = `
            <span class="log-timestamp">[${timestamp}]</span>
            <span class="log-message">${message}</span>
        `;
        
        activityLog.prepend(logEntry);
        
        // Limitar el número de entradas en el log
        if (activityLog.children.length > 20) {
            activityLog.removeChild(activityLog.lastChild);
        }
    }

    // Función para mostrar notificaciones (toast)
    function showToast(title, message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastTitle = document.getElementById('toastTitle');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');
        
        if (toast && toastTitle && toastMessage && toastIcon) {
            toastTitle.textContent = title;
            toastMessage.textContent = message;
            
            // Establecer ícono según el tipo
            let iconClass = 'fas fa-info-circle';
            if (type === 'error') iconClass = 'fas fa-exclamation-circle';
            else if (type === 'success') iconClass = 'fas fa-check-circle';
            else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
            
            toastIcon.className = `toast-icon ${iconClass}`;
            
            // Establecer clase según el tipo
            toast.className = `toast show ${type}`;
            
            // Auto-ocultar después de 5 segundos
            setTimeout(() => {
                toast.classList.remove('show');
            }, 5000);
        }
    }

    // Función para formatear tamaño de archivo
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    console.log('[INVESTIGACION-ACCIDENTES-MAIN] Inicialización completada');
});