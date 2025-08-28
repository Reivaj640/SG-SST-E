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
    }

    render() {
        this.container.innerHTML = '';

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';
        mainContainer.style.padding = '20px'; // Añadir algo de padding general

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
        mainGrid.style.gridTemplateColumns = '1fr 2fr'; // Izquierda más estrecha
        mainGrid.style.gap = '20px';
        mainGrid.style.marginTop = '20px';

        // --- Columna Izquierda (Config, Datos, Logs) ---
        const leftColumn = document.createElement('div');
        leftColumn.style.display = 'flex';
        leftColumn.style.flexDirection = 'column';
        leftColumn.style.gap = '20px';

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
            <div class="form-group">
                <label class="form-label">Empresa:</label>
                <input type="text" class="form-control" value="${this.currentCompany}" readonly>
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
        actionArea.style.marginTop = '20px';
        actionArea.style.display = 'flex';
        actionArea.style.justifyContent = 'flex-end'; // Alinear a la derecha
        actionArea.style.gap = '10px';
        actionArea.innerHTML = `
            <button type="button" class="btn btn-success" id="process-btn" disabled>PROCESAR Y GENERAR INFORME</button>
            <button type="button" class="btn btn-secondary" id="clear-btn">LIMPIAR</button>
        `;
        const processBtn = actionArea.querySelector('#process-btn');
        const clearBtn = actionArea.querySelector('#clear-btn');
        processBtn.addEventListener('click', () => this.analyzeWithLLM()); // Combinar procesar y generar
        clearBtn.addEventListener('click', () => this.clearAll());

        // --- Ensamblar todo ---
        mainGrid.appendChild(leftColumn);
        mainGrid.appendChild(rightColumn);
        mainContainer.appendChild(mainGrid);
        mainContainer.appendChild(actionArea); // Botones fuera del grid

        this.container.appendChild(mainContainer);

        // Inicialmente deshabilitar botones que requieren PDF
        this.updateButtonStates();
    }

    // Función auxiliar para crear tarjetas estilo 'Card.TFrame'
    createCard(title) {
        const card = document.createElement('div');
        card.className = 'card'; // Usar estilo existente
        card.style.padding = '15px';

        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.marginTop = '0';
        titleElement.style.marginBottom = '15px';
        card.appendChild(titleElement);

        return card;
    }

    logToActivity(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logMessages.push(logEntry);
        if (this.activityLogTextarea) {
            this.activityLogTextarea.value = this.logMessages.join('\n');
            this.activityLogTextarea.scrollTop = this.activityLogTextarea.scrollHeight; // Auto-scroll
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
                this.container.querySelector('#pdf-path-display').value = pdfPath.split('\\').pop(); // Solo nombre
                this.logToActivity(`Archivo seleccionado: ${pdfPath.split('\\').pop()}`);
                await this.processPdf(); // Procesar automáticamente
            }
        } catch (error) {
            console.error('Error al seleccionar PDF:', error);
            this.logToActivity(`Error al seleccionar PDF: ${error.message}`);
        }
    }

    async processPdf() {
        if (!this.selectedPdfPath || !window.electronAPI) return;

        this.isProcessing = true;
        this.updateButtonStates();
        this.logToActivity('Iniciando proceso de extracción de datos...');

        try {
            // Limpiar datos y análisis previos
            this.extractedData = {};
            this.analysisResult = {};
            this.populateExtractedData({});
            this.populateAnalysisResults({});

            const result = await window.electronAPI.processAccidentPdf(
                this.selectedPdfPath,
                this.currentCompany,
                "" // No pasar contexto aún en esta etapa
            );

            if (result.success) {
                this.extractedData = result.data || {};
                this.populateExtractedData(this.extractedData);
                this.logToActivity('Datos extraídos correctamente.');
            } else {
                throw new Error(result.error || 'Error desconocido al procesar el PDF.');
            }
        } catch (error) {
            console.error('Error al procesar el PDF:', error);
            this.logToActivity(`Error al procesar el PDF: ${error.message}`);
            this.populateExtractedData({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.updateButtonStates();
        }
    }

    populateExtractedData(data) {
        this.dataCardContent.innerHTML = ''; // Limpiar contenido

        if (data.error) {
            this.dataCardContent.innerHTML = `<p class="error">Error: ${data.error}</p>`;
            return;
        }

        if (!data || Object.keys(data).length === 0) {
            this.dataCardContent.innerHTML = '<p>No se encontraron datos o el PDF no es compatible.</p>';
            return;
        }

        const fields = [
            'Nombre Completo', 'No Identificacion', 'Fecha del Accidente', 'Hora del Accidente',
            'Cargo', 'Tipo de Accidente', 'Lugar del Accidente', 'Sitio de Ocurrencia',
            'Tipo de Lesion', 'Parte del Cuerpo Afectada', 'Agente del Accidente',
            'Mecanismo o Forma del Accidente'
        ];

        const gridContainer = document.createElement('div');
        gridContainer.className = 'summary-grid';
        gridContainer.style.gridTemplateColumns = '1fr 1fr'; // 2 columnas
        gridContainer.style.gap = '10px';

        fields.forEach(field => {
            const key = field.replace(/\s+/g, '_');
            const value = data[key] || 'N/A';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'summary-item';
            itemDiv.innerHTML = `
                <label style="font-weight:bold; display:block;">${field}:</label>
                <span>${value}</span>
            `;
            gridContainer.appendChild(itemDiv);
        });

        const descripcion = data['Descripcion_del_Accidente'] || data['descripcion_del_accidente'] || 'N/A';
        if (descripcion !== 'N/A') {
            const descDiv = document.createElement('div');
            descDiv.className = 'form-group';
            descDiv.style.gridColumn = '1 / -1'; // Ocupar todo el ancho
            descDiv.innerHTML = `
                <label class="form-label" style="font-weight:bold;">Descripción del Accidente:</label>
                <textarea class="form-control" rows="3" readonly>${descripcion}</textarea>
            `;
            gridContainer.appendChild(descDiv);
        }

        this.dataCardContent.appendChild(gridContainer);
    }

    async analyzeWithLLM() { // Este método ahora combina análisis y generación
        if (!this.selectedPdfPath || !window.electronAPI || this.isProcessing) return;

        this.isProcessing = true;
        this.updateButtonStates();
        this.logToActivity('Iniciando análisis de causa raíz con IA...');

        try {
            const contextoAdicional = this.contextInput.value;

            const result = await window.electronAPI.processAccidentPdf(
                this.selectedPdfPath,
                this.currentCompany,
                contextoAdicional // Pasar el contexto para el análisis
            );

            if (result.success) {
                // Asumir que el resultado ahora incluye el análisis 5 Porqués
                this.analysisResult = result.analysis || {};
                this.populateAnalysisResults(this.analysisResult);
                this.logToActivity('Análisis de causa raíz completado.');

                // --- Generar informe inmediatamente después del análisis ---
                this.logToActivity('Generando informe...');
                // Aquí iría la lógica de generación de informe
                // Por ahora, solo un mensaje
                this.logToActivity('Informe generado exitosamente. (Funcionalidad simulada)');
                alert('Informe generado exitosamente. (Funcionalidad simulada en esta etapa)');

            } else {
                throw new Error(result.error || 'Error desconocido en el análisis.');
            }
        } catch (error) {
            console.error('Error en análisis con LLM:', error);
            this.logToActivity(`Error en el análisis con IA: ${error.message}`);
            this.populateAnalysisResults({ error: error.message });
        } finally {
            this.isProcessing = false;
            this.updateButtonStates();
        }
    }

    populateAnalysisResults(analysisData) {
        this.analysisCardContent.innerHTML = ''; // Limpiar contenido

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
                <div class="cause-text">${pqData.causa || 'Causa no especificada'}</div>
            `;
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
                    <div class="m-content" style="font-size: 0.9em;">${pqData[category] || 'N/A'}</div>
                `;
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

// Hacer la clase disponible globalmente
window.InvestigacionAccidenteComponent = InvestigacionAccidenteComponent;