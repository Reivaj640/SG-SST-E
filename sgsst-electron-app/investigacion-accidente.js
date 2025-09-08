// investigacion-accidente.js - Componente para la vista de realizar investigación con IA (Estilo Tkinter)

class InvestigacionAccidenteComponent {
    constructor(container, currentCompany, moduleName, submoduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany || "TEMPOACTIVA";
        this.moduleName = moduleName;
        this.submoduleName = submoduleName;
        this.onBack = onBack;
        this.selectedPdfPath = null;
        this.extractedData = {};
        this.analysisResult = {};
        this.isProcessing = false;
        this.logMessages = []; // Para almacenar mensajes de log internos
        this.progressListener = null;
    }

    render() {
        this.container.innerHTML = '';
        // Iniciar la carga del modelo en segundo plano
        if (window.electronAPI && typeof window.electronAPI.startModelLoading === 'function') {
            window.electronAPI.startModelLoading().catch(err => {
                console.error('Error al iniciar carga del modelo en segundo plano:', err);
                this.logToActivity('Advertencia: No se pudo iniciar la carga del modelo en segundo plano.');
            });
        }
        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';
        mainContainer.style.padding = '10px'; // Añadir algo de padding general

        // Encabezado
        const header = document.createElement('div');
        header.className = 'submodule-header';
        const title = document.createElement('h2');
        title.textContent = 'Realizar Investigación de Accidente con IA';
        const backButton = document.createElement('button');
        backButton.className = 'btn';
        backButton.textContent = '← Volver';
        backButton.addEventListener('click', this.onBack);
        header.appendChild(title);
        header.appendChild(backButton);
        mainContainer.appendChild(header);

        // --- Grid Principal (2 Columnas) ---
        const mainGrid = document.createElement('div');
        mainGrid.style.display = 'grid';
        mainGrid.style.gridTemplateColumns = '3fr 4fr'; // Izquierda más estrecha
        mainGrid.style.gap = '10px';
        mainGrid.style.marginTop = '10px';

        // --- Columna Izquierda (Config, Datos, Logs) ---
        const leftColumn = document.createElement('div');
        leftColumn.style.display = 'flex';
        leftColumn.style.flexDirection = 'column';
        leftColumn.style.gap = '30px';

        // 1. Tarjeta de Configuración
        this.configCard = this.createCard('1. Configuración');
        const configContent = document.createElement('div');
        configContent.innerHTML = `
            <div class="form-group">
                <label class="form-label">Archivo PDF:</label>
                <div style="display: flex; gap: 10px;">
                    <input type="text" class="form-control" id="pdf-path-display" readonly placeholder="Ningún archivo seleccionado">
                    <button type="button" class="btn btn-primary" id="select-pdf-btn">Buscar...</button>
                </div>
            </div>
        `;
        configContent.querySelector('#select-pdf-btn').addEventListener('click', () => this.selectPdfFile());
        this.configCard.appendChild(configContent);
        leftColumn.appendChild(this.configCard);

        // 2. Tarjeta de Datos del Accidente
        this.dataCard = this.createCard('2. Datos del Accidente');
        this.dataCardContent = document.createElement('div');
        this.dataCardContent.innerHTML = '<p>Selecciona un PDF para extraer los datos.</p>';
        this.dataCard.appendChild(this.dataCardContent);
        leftColumn.appendChild(this.dataCard);

        // 5. Tarjeta de Registro de Actividad (Logs)
        this.logCard = this.createCard('5. Registro de Actividad');
        const logContent = document.createElement('div');
        logContent.innerHTML = `
            <textarea class="form-control" id="activity-log" rows="8" readonly style="font-family: monospace; font-size: 0.9em;"></textarea>
        `;
        this.activityLogTextarea = logContent.querySelector('#activity-log');
        this.logToActivity('Inicializando...');
        this.logCard.appendChild(logContent);
        leftColumn.appendChild(this.logCard);

        // --- Columna Derecha (Contexto, Análisis) ---
        const rightColumn = document.createElement('div');
        rightColumn.style.display = 'flex';
        rightColumn.style.flexDirection = 'column';
        rightColumn.style.gap = '20px';

        // 3. Tarjeta de Contexto Adicional
        this.contextCard = this.createCard('3. Contexto Adicional (Opcional)');
        const contextContent = document.createElement('div');
        contextContent.innerHTML = `
            <textarea class="form-control" id="context-input" rows="4" placeholder="Añade aquí cualquier detalle no presente en el FURAT...">Añade aquí cualquier detalle no presente en el FURAT...</textarea>
        `;
        this.contextInput = contextContent.querySelector('#context-input');
        this.contextCard.appendChild(contextContent);
        rightColumn.appendChild(this.contextCard);

        // 4. Tarjeta de Análisis de Causa Raíz
        this.analysisCard = this.createCard('4. Análisis de Causa Raíz');
        this.analysisCardContent = document.createElement('div');
        this.analysisCardContent.innerHTML = '<p>Los resultados del análisis se mostrarán aquí.</p>';
        this.analysisCard.appendChild(this.analysisCardContent);
        rightColumn.appendChild(this.analysisCard);

        // --- Botones de Acción (Fuera del grid, abajo) ---
        const actionArea = document.createElement('div');
        actionArea.className = 'form-group';
        actionArea.style.marginTop = '15px';
        actionArea.style.display = 'flex';
        actionArea.style.justifyContent = 'space-between';
        actionArea.style.alignItems = 'center';
        actionArea.style.gap = '15px';

        const progressContainer = document.createElement('div');
        progressContainer.id = 'progress-container';
        progressContainer.style.flexGrow = '1';
        actionArea.appendChild(progressContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.innerHTML = `
            <button type="button" class="btn btn-success" id="process-btn" disabled>PROCESAR Y GENERAR INFORME</button>
            <button type="button" class="btn btn-secondary" id="clear-btn">LIMPIAR</button>
        `;
        actionArea.appendChild(buttonContainer);

        const processBtn = actionArea.querySelector('#process-btn');
        const clearBtn = actionArea.querySelector('#clear-btn');
        processBtn.addEventListener('click', () => this.analyzeAndGenerateReport());
        clearBtn.addEventListener('click', () => this.clearAll());

        // --- Ensamblar todo ---
        mainGrid.appendChild(leftColumn);
        mainGrid.appendChild(rightColumn);
        mainContainer.appendChild(mainGrid);
        mainContainer.appendChild(actionArea);

        this.container.appendChild(mainContainer);

        this.updateButtonStates();
    }

    createCard(title) {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '10px';

        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.marginTop = '0';
        titleElement.style.marginBottom = '10px';
        card.appendChild(titleElement);

        return card;
    }

    toggleProgressIndicator(show, message = "Iniciando...") {
        const progressContainer = this.container.querySelector('#progress-container');
        if (!progressContainer) return;

        if (show) {
            progressContainer.innerHTML = `
                <div class="progress-bar">
                    <span class="bar">
                        <span class="progress" style="width: 0%;"></span>
                    </span>
                </div>
                <div class="progress-bar-text">${message}</div>
            `;
        } else {
            progressContainer.innerHTML = '';
        }
    }

    updateProgress(percentage, message) {
        const progressBar = this.container.querySelector('.progress');
        const progressText = this.container.querySelector('.progress-bar-text');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = message;
        }
    }

    logToActivity(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logMessages.push(logEntry);
        if (this.activityLogTextarea) {
            this.activityLogTextarea.value = this.logMessages.join('\n');
            this.activityLogTextarea.scrollTop = this.activityLogTextarea.scrollHeight;
        }
    }

    async selectPdfFile() {
        if (!window.electronAPI) {
            this.logToActivity('API de Electron no disponible.');
            return;
        }

        try {
            this.logToActivity('Seleccionando archivo PDF...');
            const pdfPath = await window.electronAPI.selectAccidentPdf();
            if (pdfPath) {
                this.selectedPdfPath = pdfPath;
                this.container.querySelector('#pdf-path-display').value = pdfPath.split('\\').pop();
                this.logToActivity(`Archivo seleccionado: ${pdfPath.split('\\').pop()}`);
                await this.processPdf();
            }
        } catch (error) {
            console.error('Error al seleccionar PDF:', error);
            this.logToActivity(`Error al seleccionar PDF: ${error.message}`);
        }
    }

    async processPdf() {
        if (!this.selectedPdfPath || !window.electronAPI) return;

        this.isProcessing = true;
        this.toggleProgressIndicator(true, 'Extrayendo datos del PDF...');
        this.updateButtonStates();
        this.logToActivity('Iniciando proceso de extracción de datos...');

        this.progressListener = (progress) => {
            this.updateProgress(progress.percentage, progress.message);
        };
        window.electronAPI.onIpcMessage('accident-processing-progress', this.progressListener);

        try {
            const result = await window.electronAPI.processAccidentPdf(this.selectedPdfPath);

            if (result.success) {
                this.extractedData = result.data || {};
                this.populateExtractedData(this.extractedData);
                this.logToActivity('Extracción de datos completada.');
            } else {
                throw new Error(result.error || 'Error desconocido al procesar el PDF.');
            }
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            this.logToActivity(`Error al procesar el PDF: ${error.message}`);
            this.populateExtractedData({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.toggleProgressIndicator(false);
            this.updateButtonStates();
            if (this.progressListener) {
                window.electronAPI.removeIpcMessageListener('accident-processing-progress', this.progressListener);
                this.progressListener = null;
            }
        }
    }

    populateExtractedData(data) {
        this.dataCardContent.innerHTML = '';

        if (data.error) {
            this.dataCardContent.innerHTML = `<p class="error">Error: ${data.error}</p>`;
            return;
        }

        if (!data || Object.keys(data).length === 0) {
            this.dataCardContent.innerHTML = '<p>No se encontraron datos o el PDF no es compatible.</p>';
            return;
        }

        const fields = [
            'No Identificacion',
            'Nombre Completo',
            'Fecha del Accidente',
            'Hora del Accidente',
            'Cargo',
            'Tipo de Accidente',
            'Lugar del Accidente',
            'Sitio de Ocurrencia',
            'Tipo de Lesion',
            'Parte del Cuerpo Afectada',
            'Agente del Accidente',
            'Mecanismo o Forma del Accidente'
        ];

        const gridContainer = document.createElement('div');
        gridContainer.className = 'summary-grid';
        gridContainer.style.gridTemplateColumns = '1fr 1fr';
        gridContainer.style.gap = '10px';

        fields.forEach(field => {
            const value = data[field] || 'N/A';
            const itemDiv = document.createElement('div');
            itemDiv.className = 'summary-item';
            itemDiv.innerHTML = 
                `<label style="font-weight:bold; display:block;">${field}:</label>
                <span>${this.escapeHtml(value)}</span>`;
            gridContainer.appendChild(itemDiv);
        });

        const descripcionKey = 'Descripcion del Accidente';
        const descripcion = data[descripcionKey] || 'N/A';
        if (descripcion && descripcion !== 'N/A') {
            const descDiv = document.createElement('div');
            descDiv.className = 'form-group';
            descDiv.style.gridColumn = '1 / -1';
            descDiv.innerHTML = 
                `<label class="form-label" style="font-weight:bold;">${descripcionKey}:</label>
                <textarea class="form-control" rows="4" readonly>${this.escapeHtml(descripcion)}</textarea>`;
            gridContainer.appendChild(descDiv);
        }

        this.dataCardContent.appendChild(gridContainer);
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return String(unsafe);
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "<")
            .replace(/>/g, ">")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");
    }

    async analyzeAndGenerateReport() {
        if (!this.extractedData || Object.keys(this.extractedData).length === 0 || !window.electronAPI || this.isProcessing) {
            this.logToActivity('No hay datos extraídos para analizar. Por favor, procese un PDF primero.', 'WARN');
            return;
        }

        this.isProcessing = true;
        this.toggleProgressIndicator(true, "Iniciando análisis...");
        this.updateButtonStates();
        this.logToActivity('Iniciando análisis de causa raíz con IA...');

        try {
            const contextoAdicional = this.contextInput.value;
            const analysisResult = await window.electronAPI.analyzeAccident(this.extractedData, contextoAdicional);

            if (analysisResult.success) {
                this.analysisResult = analysisResult.analysis || {};
                this.populateAnalysisResults(this.analysisResult);
                this.logToActivity('Análisis de causa raíz completado.');

                // Mapeo manual de claves extraídas a placeholders de la plantilla
                const keyMapping = {
                    'Nombre Completo': 'nombre_completo',
                    'No Identificacion': 'no_identificacion',
                    'Edad': 'edad',
                    'Estado Civil': 'estado_civil',
                    'Telefono/Celular': 'telefono_celular',
                    'Tiempo en el Contrato': 'tiempo_en_el_contrato',
                    'Experiencia en el Cargo': 'experiencia_en_el_cargo',
                    'Dia de Turno': 'dia_de_turno',
                    'Equipo que Operaba/Reparaba': 'equipo_que_operaba_reparaba',
                    'Supervisor Inmediato': 'supervisor_inmediato',
                    'Fecha del Accidente': 'fecha_accidente',
                    'Hora del Accidente': 'hora_del_accidente',
                    'Lugar del Accidente': 'lugar_accidente',
                    'Sitio de Ocurrencia': 'sitio_ocurrencia',
                    'Agente del Accidente': 'agente_accidente',
                    'Tipo de Accidente': 'tipo_accidente',
                    'Mecanismo o Forma del Accidente': 'mecanismo_accidente',
                    'Tipo de Lesion': 'tipo_lesion',
                    'Parte del Cuerpo Afectada': 'parte_cuerpo_afectada',
                    'Descripcion del Accidente': 'descripcion_accidente',
                    'Cargo': 'cargo'
                };

                const normalizedExtracted = {};
                Object.keys(this.extractedData).forEach(key => {
                    const mappedKey = keyMapping[key] || key.toLowerCase().replace(/ /g, '_').replace(/[áéíóú]/g, m => ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' })[m] || m).replace(/[^a-z0-9_]/g, '');
                    normalizedExtracted[mappedKey] = this.extractedData[key].replace(/\n/g, ' '); // Limpiar saltos de línea
                });

                // Transformación de recomendaciones
                const recommendations = [];
                for (let i = 1; i <= 5; i++) {
                    const pqKey = `Por Qué ${i}`;
                    const pqData = this.analysisResult[pqKey] || {};
                    if (pqData.causa) {
                        recommendations.push(pqData.causa);
                    }
                }
                const normalizedAnalysis = {
                    'recomendacion_1': recommendations[0] || 'Implementar medidas de seguridad adicionales.',
                    'recomendacion_2': recommendations[1] || 'Capacitar al personal en procedimientos seguros.',
                    'recomendacion_3': recommendations[2] || 'Revisar mantenimiento de equipos.',
                };

                // Inferir checkboxes
                const hasLesion = normalizedExtracted['tipo_lesion'] && normalizedExtracted['tipo_lesion'] !== '';
                const isGrave = hasLesion && normalizedExtracted['tipo_lesion'].toLowerCase().includes('grave');
                const isMortal = hasLesion && normalizedExtracted['tipo_lesion'].toLowerCase().includes('mortal');
                const hasDano = normalizedExtracted['agente_accidente']?.toLowerCase().includes('equipo') || false;

                normalizedExtracted['incidente_con_lesion'] = hasLesion ? 'X' : '';
                normalizedExtracted['incidente_grave'] = isGrave ? 'X' : '';
                normalizedExtracted['casi_accidente'] = !hasLesion ? 'X' : '';
                normalizedExtracted['genero_muerte'] = isMortal ? 'X' : '';
                normalizedExtracted['dano_a_la_propiedad'] = hasDano ? 'X' : '';

                // Combinar y loggear
                const combinedData = { ...normalizedExtracted, ...normalizedAnalysis, ...this.analysisResult };
                this.logToActivity(`Datos combinados antes de enviar: ${JSON.stringify(combinedData)}`);

                await this.generateAccidentReport(combinedData);

            } else {
                throw new Error(analysisResult.error || 'Error desconocido en el análisis.');
            }
        } catch (error) {
            console.error('Error en análisis/generación con LLM:', error);
            this.logToActivity(`Error en el proceso: ${error.message}`);
            this.populateAnalysisResults({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.toggleProgressIndicator(false);
            this.updateButtonStates();
            if (this.progressListener) {
                window.electronAPI.removeIpcMessageListener('accident-processing-progress', this.progressListener);
                this.progressListener = null;
            }
        }
    }

    async generateAccidentReport(combinedData) {
        try {
            this.logToActivity('Solicitando generación del informe al proceso principal...');
            
            const generationResult = await window.electronAPI.generateAccidentReport({
                ...combinedData,
                empresa: this.currentCompany
            });

            if (generationResult && generationResult.success) {
                const documentPath = generationResult.documentPath;
                this.logToActivity(`Informe generado exitosamente: ${documentPath}`);
                alert(`Informe generado exitosamente:\n${documentPath}\n\n(Nota: La funcionalidad para abrir/ver el archivo puede agregarse aquí)`);
            } else {
                const errorMsg = generationResult ? generationResult.error : 'Error desconocido al generar el informe.';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('Error al generar el informe:', error);
            this.logToActivity(`Error al generar el informe: ${error.message}`, 'ERROR');
            alert(`Error al generar el informe:\n${error.message}`);
        }
    }

    populateAnalysisResults(analysisData) {
        this.analysisCardContent.innerHTML = '';

        if (analysisData.error) {
            this.analysisCardContent.innerHTML = `<p class="error">Error en el análisis: ${analysisData.error}</p>`;
            return;
        }

        if (!analysisData || Object.keys(analysisData).length === 0) {
            this.analysisCardContent.innerHTML = '<p>No se recibió un análisis válido del servidor.</p>';
            return;
        }

        const analysisContainer = document.createElement('div');

        for (let i = 1; i <= 5; i++) {
            const pqKey = `Por Qué ${i}`;
            const pqData = analysisData[pqKey];

            if (!pqData) continue;

            const card = document.createElement('div');
            card.className = 'five-whys-card';
            card.style.marginBottom = '15px';
            card.style.padding = '10px';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'cause-header';
            headerDiv.innerHTML = `
                <div class="cause-number" style="font-weight:bold; margin-right: 10px;">${i}.</div>
                <div class="cause-text">${pqData.causa || 'Causa no especificada'}</div>`;
            card.appendChild(headerDiv);

            const mGrid = document.createElement('div');
            mGrid.className = 'm-grid';
            mGrid.style.display = 'grid';
            mGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
            mGrid.style.gap = '10px';
            mGrid.style.marginTop = '10px';

            const mCategories = ["Mano de Obra", "Método", "Maquinaria", "Medio Ambiente", "Material"];
            mCategories.forEach(category => {
                const mCell = document.createElement('div');
                mCell.className = 'm-cell';
                mCell.style.padding = '8px';
                mCell.style.backgroundColor = '#f9f9f9';
                mCell.style.border = '1px solid #eee';
                mCell.innerHTML = `
                    <div class="m-category" style="font-weight:bold; color: #206A5D; font-size: 0.85em;">${category}</div>
                    <div class="m-content" style="font-size: 0.9em;">${pqData[category] || 'N/A'}</div>`;
                mGrid.appendChild(mCell);
            });

            card.appendChild(mGrid);
            analysisContainer.appendChild(card);
        }

        this.analysisCardContent.appendChild(analysisContainer);
    }

    updateButtonStates() {
        const processBtn = this.container.querySelector('#process-btn');
        if (processBtn) {
            processBtn.disabled = !this.selectedPdfPath || this.isProcessing;
            if (this.isProcessing) {
                processBtn.textContent = 'PROCESANDO...';
            } else {
                processBtn.textContent = 'PROCESAR Y GENERAR INFORME';
            }
        }
    }

    clearAll() {
        this.logToActivity('Limpiando datos...');
        this.selectedPdfPath = null;
        this.extractedData = {};
        this.analysisResult = {};
        this.contextInput.value = 'Añade aquí cualquier detalle no presente en el FURAT...';
        this.container.querySelector('#pdf-path-display').value = '';
        this.populateExtractedData({});
        this.populateAnalysisResults({});
        this.logMessages = [];
        if (this.activityLogTextarea) {
            this.activityLogTextarea.value = '';
        }
        this.logToActivity('Datos limpiados.');
        this.updateButtonStates();
    }
}

window.InvestigacionAccidenteComponent = InvestigacionAccidenteComponent;
