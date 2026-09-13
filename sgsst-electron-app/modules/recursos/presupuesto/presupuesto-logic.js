class PresupuestoGestionComponent {
    constructor(container, currentCompany, moduleName, onBack) {
        this.container = container;
        this.currentCompany = currentCompany;
        this.moduleName = moduleName;
        this.onBack = onBack;
        this.currentView = 'home'; // 'home' (nuevo), 'selector' o 'gestion'
        this.currentFile = null; 
        this.messageHandlers = new Map();

        this.log('INFO', 'PresupuestoGestionComponent inicializado');
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${level}] [${timestamp.split('T')[1].split('.')[0]}] ${message}`, data || '');
    }

    render() {
        this.log('INFO', `Iniciando render para la vista: ${this.currentView}`);
        this.clearMessageHandlers();
        this.container.innerHTML = '';
        window.currentPresupuestoGestionComponent = this;

        const mainContainer = document.createElement('div');
        mainContainer.className = 'submodule-content';

        switch (this.currentView) {
            case 'home':
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-home.html', 'home');
                break;
            case 'selector':
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-selector.html', 'selector');
                break;
            case 'gestion':
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-gestion.html', 'gestion');
                break;
            default:
                this.log('WARN', `Vista desconocida: ${this.currentView}, usando home.`);
                this.renderIframeView(mainContainer, 'modules/recursos/presupuesto/presupuesto-home.html', 'home');
        }

        this.container.appendChild(mainContainer);
        this.log('INFO', 'Render completado.');
    }

    renderIframeView(container, src, viewType) {
        this.log('INFO', `Renderizando iframe para vista '${viewType}' con src: ${src}`);
        try {
            const iframe = document.createElement('iframe');
            iframe.src = src;
            iframe.style.cssText = `width: 100%; height: 100%; border: none;`;

            const loadingDiv = this.createLoadingElement(`Cargando ${viewType}...`);
            container.appendChild(loadingDiv);

            this.setupIframeEvents(iframe, loadingDiv, viewType);

            container.appendChild(iframe);
        } catch (error) {
            this.log('CRITICAL', `Error en renderIframeView(): ${error.message}`, error.stack);
            this.showErrorUI(error);
        }
    }

  setupIframeEvents(iframe, loadingDiv, viewType) {
    iframe.onload = () => {
      this.log('INFO', `✅ Iframe cargado (${viewType})`);
      if (loadingDiv.parentNode) loadingDiv.style.display = 'none';

      if (viewType === 'selector' || viewType === 'gestion') {
        iframe.contentWindow.postMessage({ company: this.currentCompany }, '*');
      }

      if (viewType === 'selector' || viewType === 'home') {
        this.sendFilesToSelectorIframe(iframe);
      }

      if (viewType === 'gestion' && this.currentFile) {
        iframe.contentWindow.postMessage({ file: this.currentFile }, '*');
      }
    };
        iframe.onerror = (error) => this.log('CRITICAL', `❌ Error al cargar iframe: ${error.message}`);

        const messageHandler = (event) => this.handleIframeMessage(event);
        this.registerMessageHandler(viewType, messageHandler);
    }

    async handleIframeMessage(event) {
        const { action, file } = event.data;
        if (!action) return;

        this.log('INFO', `Manejando acción: ${action}`, event.data);

        switch (action) {
            case 'openBudgetFile':
                if (file) {
                    this.currentFile = file;
                    this.currentView = 'gestion';
                    this.render();
                }
                break;

            case 'requestBudgetFiles':
                const iframe = this.container.querySelector('iframe');
                if (iframe) {
                    this.sendFilesToSelectorIframe(iframe);
                }
                break;

            case 'backToHome':
                this.currentFile = null;
                this.currentView = 'home';
                this.render();
                break;

            case 'backToSelector':
                this.currentFile = null;
                this.currentView = 'selector';
                this.render();
                break;

            case 'backToSubmodules':
                if (this.onBack) this.onBack();
                break;

            // 📦708 (Fase 2) — Handlers para la UI que usa BD
            case 'checkBDStatus':
                await this._handleCheckBDStatus(event);
                break;

            case 'importBudgetToBD':
                await this._handleImportBudgetToBD(event);
                break;

            case 'viewBDResumen':
                await this._handleViewBDResumen(event);
                break;

            // 📦708 (Fase 5) — Handlers para export a Excel
            case 'exportBudgetToExcel':
                await this._handleExportBudgetToExcel(event);
                break;

            // 📦708 (Fase 3) — Handlers para edición sobre BD
            case 'requestBudgetFromDB':
                await this._handleRequestBudgetFromDB(event);
                break;

            case 'openBudgetFromBD':
                await this._handleOpenBudgetFromBD(event);
                break;

            // 📦708 (Fase 3.5) — Handlers granulares (add/delete/update)
            case 'addPartidaToBD':
                await this._handleAddPartidaToBD(event);
                break;

            case 'deletePartidaFromBD':
                await this._handleDeletePartidaFromBD(event);
                break;

            case 'updatePresupuestoMeta':
                await this._handleUpdatePresupuestoMeta(event);
                break;

case 'requestBudgetData':
          if (file && file.path) {
            try {
              this.log('DEBUG', `Solicitando datos procesados para: ${file.path}`);
              const result = await window.electronAPI.readPresupuestoData(file.path);
              if (result.success) {
                const gestionIframe = this.container.querySelector('iframe');
                if (gestionIframe) {
                  gestionIframe.contentWindow.postMessage({
                    budgetData: result.data.processedData,
                    calculationData: result.data.filteredData,
                    formulaCells: result.data.formulaCells,
                    headers: result.data.headers
                  }, '*');
                }
              } else {
                throw new Error(result.error);
              }
            } catch (error) {
              this.log('CRITICAL', `Error en requestBudgetData: ${error.message}`, error.stack);
              this.showErrorUI(error);
            }
          }
          break;

            case 'duplicate-budget-file':
                try {
                    const duplicateResult = await window.electronAPI.duplicateBudgetFile(event.data);
                    const currentIframe = this.container.querySelector('iframe');
                    if (currentIframe) {
                        currentIframe.contentWindow.postMessage({
                            action: 'duplicateBudgetFile',
                            ...duplicateResult
                        }, '*');
                        if (duplicateResult.success) this.sendFilesToSelectorIframe(currentIframe);
                    }
                } catch (error) {
                    this.log('CRITICAL', `Error al duplicar: ${error.message}`);
                }
                break;

            case 'saveBudgetChanges':
                await this._handleSaveBudgetChanges(event);
                break;
        }
    }

createLoadingElement(message) {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; align-items: center; justify-content: center; height: 100%;`;
        div.innerHTML = `<h3>${message}</h3>`;
        return div;
    }

    showErrorUI(error) {
        this.container.innerHTML = `
            <div style="padding: 20px; background: #ffebee; border: 1px solid #f8bbd9; height: 100%;">
                <h3 style="color: #c62828;">❌ Error Crítico</h3>
                <p>${error.message}</p>
                <pre style="white-space: pre-wrap; background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error.stack}</pre>
            </div>`;
    }

    // ============================================================
    // 📦708 (Fase 2) — Handlers de la UI que usa BD
    // Estos handlers son el "puente" entre el iframe (presupuesto-home.html)
    // y los canales nuevos del bridge (window.electronAPI.presupuestoXxx).
    // El iframe habla via postMessage; este logic los traduce a IPC.
    // ============================================================

    /**
     * Check si hay un presupuesto en BD para esta empresa/año.
     * Responde al iframe con { type: 'bd-status', data: { exists, presupuesto, resumen } }
     */
    async _handleCheckBDStatus(event) {
        const anio = event.data.anio || new Date().getFullYear();
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoGetByEmpresaAnio) {
                throw new Error('API presupuestoGetByEmpresaAnio no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Check BD status para ${this.currentCompany} ${anio}`);
            const result = await window.electronAPI.presupuestoGetByEmpresaAnio({
                companyName: this.currentCompany,
                anio: anio
            });

            if (result.success) {
                targetIframe.contentWindow.postMessage({
                    type: 'bd-status',
                    anio: anio,
                    exists: !!result.data.presupuesto,
                    presupuesto: result.data.presupuesto,
                    resumen: result.data.resumen,
                    message: result.data.message
                }, '*');
            } else {
                targetIframe.contentWindow.postMessage({
                    type: 'bd-status',
                    anio: anio,
                    exists: false,
                    error: result.error
                }, '*');
            }
        } catch (error) {
            this.log('CRITICAL', `Error en checkBDStatus: ${error.message}`, error.stack);
            targetIframe.contentWindow.postMessage({
                type: 'bd-status',
                anio: anio,
                exists: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    /**
     * Importa un Excel a la BD.
     * Espera: { file: { path, name }, anio }
     * Responde al iframe con { type: 'bd-import-result', data: { ... } }
     */
    async _handleImportBudgetToBD(event) {
        const file = event.data.file;
        const anio = event.data.anio || new Date().getFullYear();
        const overwrite = !!event.data.overwrite;
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        if (!file || !file.path) {
            targetIframe.contentWindow.postMessage({
                type: 'bd-import-result',
                success: false,
                error: { code: 'INVALID_INPUT', message: 'Falta el archivo a importar' }
            }, '*');
            return;
        }

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoImportFromExcel) {
                throw new Error('API presupuestoImportFromExcel no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Importando a BD: ${file.name} para ${this.currentCompany} ${anio} (overwrite=${overwrite})`);
            const result = await window.electronAPI.presupuestoImportFromExcel({
                filePath: file.path,
                companyName: this.currentCompany,
                anio: anio,
                options: { overwrite: overwrite }
            });

            targetIframe.contentWindow.postMessage({
                type: 'bd-import-result',
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');

            if (result.success) {
                this.log('INFO', `[FUENTE=BD] Import OK: ${result.data.inserted} partidas, ${result.data.valores} valores`);
            } else {
                this.log('WARN', `[FUENTE=BD] Import FALLO: ${result.error.code} - ${result.error.message}`);
            }
        } catch (error) {
            this.log('CRITICAL', `Error en importBudgetToBD: ${error.message}`, error.stack);
            targetIframe.contentWindow.postMessage({
                type: 'bd-import-result',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    /**
     * Devuelve el resumen del presupuesto en BD (KPIs del ribbon).
     * Espera: { anio }
     * Responde al iframe con { type: 'bd-resumen', data: { resumen, partidas } }
     */
    async _handleViewBDResumen(event) {
        const anio = event.data.anio || new Date().getFullYear();
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoGetByEmpresaAnio) {
                throw new Error('API presupuestoGetByEmpresaAnio no disponible');
            }
            this.log('INFO', `[FUENTE=BD] View resumen de BD para ${this.currentCompany} ${anio}`);
            const result = await window.electronAPI.presupuestoGetByEmpresaAnio({
                companyName: this.currentCompany,
                anio: anio
            });

            targetIframe.contentWindow.postMessage({
                type: 'bd-resumen',
                anio: anio,
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en viewBDResumen: ${error.message}`, error.stack);
            targetIframe.contentWindow.postMessage({
                type: 'bd-resumen',
                anio: anio,
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    // ============================================================
    // 📦708 (Fase 3) — Handlers para edición sobre BD
    // La UI ahora puede pedir datos desde BD (no Excel) y guardar a BD.
    // El formato devuelto es el MISMO que Excel, así la gestion view
    // no necesita cambios estructurales — solo saber el "source".
    // ============================================================

    /**
     * Abre la vista de gestión con un presupuesto cargado desde BD.
     * Espera: { presupuestoId, anio }
     * Crea un "currentFile" sintético con la info del presupuesto en BD.
     */
    async _handleOpenBudgetFromBD(event) {
        const presupuestoId = event.data.presupuestoId;
        const anio = event.data.anio || new Date().getFullYear();
        if (!presupuestoId) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoGet) {
                throw new Error('API presupuestoGet no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Open presupuesto from BD: ${presupuestoId}`);
            const result = await window.electronAPI.presupuestoGet({ presupuestoId: presupuestoId });
            if (!result.success) {
                this.log('ERROR', `[FUENTE=BD] Error abriendo presupuesto: ${result.error.message}`);
                return;
            }
            // Sintetizar un currentFile para que la gestion view funcione
            this.currentFile = {
                name: result.data.presupuesto.nombre + ' (BD)',
                path: '__BD__',  // sentinel — la gestion view no debería leerlo
                source: 'BD',
                presupuestoId: presupuestoId,
                anio: result.data.presupuesto.anio
            };
            this.currentView = 'gestion';
            this.render();
        } catch (error) {
            this.log('CRITICAL', `Error en openBudgetFromBD: ${error.message}`, error.stack);
            this.showErrorUI(error);
        }
    }

    /**
     * Devuelve los datos del presupuesto en BD en el MISMO shape que Excel.
     * La gestion view (iframe) no necesita cambios — recibe los datos y los
     * muestra como si vinieran del Excel.
     * Espera: { presupuestoId }
     * Responde al iframe con: { budgetData, calculationData, formulaCells, headers, source: 'BD' }
     */
    async _handleRequestBudgetFromDB(event) {
        const presupuestoId = event.data.presupuestoId;
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;
        if (!presupuestoId) {
            targetIframe.contentWindow.postMessage({
                source: 'BD',
                error: 'presupuestoId requerido'
            }, '*');
            return;
        }

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoGet) {
                throw new Error('API presupuestoGet no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Request data for ${presupuestoId}`);
            const result = await window.electronAPI.presupuestoGet({ presupuestoId: presupuestoId });
            if (!result.success) {
                throw new Error(result.error ? result.error.message : 'Error desconocido');
            }

            // Convertir el shape de BD al shape de Excel
            const excelData = this._bdPartidasToExcelShape(result.data.partidas);

            targetIframe.contentWindow.postMessage({
                source: 'BD',
                presupuestoId: presupuestoId,
                budgetData: excelData.processedData,
                calculationData: excelData.filteredData,
                formulaCells: excelData.formulaCells,
                headers: excelData.headers
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en requestBudgetFromDB: ${error.message}`, error.stack);
            targetIframe.contentWindow.postMessage({
                source: 'BD',
                error: error.message
            }, '*');
        }
    }

    /**
     * Convierte el shape de BD (partidas + valores) al shape que espera
     * la gestion view (igual al de readPresupuestoData de Excel).
     */
    _bdPartidasToExcelShape(partidas) {
        var processedData = [];
        var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

        var totalAsignado = 0;
        var totalEjecutado = 0;
        var mensualesAsignado = new Array(12).fill(0);
        var mensualesEjecutado = new Array(12).fill(0);

        for (var i = 0; i < partidas.length; i++) {
            var p = partidas[i];
            var row = {
                id: p.numero,
                detalle: p.concepto,
                asignacion: p.asignado,
                ejecutado_acumulado: p.ejecutado,
                porcentaje_ejecutado: (p.porcentaje || 0).toFixed(2) + '%'
            };
            // Valores mensuales
            for (var m = 0; m < 12; m++) {
                var val = p.valores && p.valores[m] ? p.valores[m] : { mes: m + 1, asignado: 0, ejecutado: 0 };
                row[COLUMN_MESES[m]] = val.asignado || 0;
            }
            processedData.push(row);

            totalAsignado += p.asignado || 0;
            totalEjecutado += p.ejecutado || 0;
            for (var m2 = 0; m2 < 12; m2++) {
                var v = p.valores && p.valores[m2] ? p.valores[m2] : { asignado: 0, ejecutado: 0 };
                mensualesAsignado[m2] += v.asignado || 0;
                mensualesEjecutado[m2] += v.ejecutado || 0;
            }
        }

        // Fila TOTAL AÑO
        var totalRow = {
            id: 'TOTAL AÑO',
            detalle: 'TOTAL AÑO',
            asignacion: totalAsignado,
            ejecutado_acumulado: totalEjecutado,
            porcentaje_ejecutado: totalAsignado > 0 ? ((totalEjecutado / totalAsignado) * 100).toFixed(2) + '%' : '0,00%'
        };
        for (var m3 = 0; m3 < 12; m3++) {
            totalRow[COLUMN_MESES[m3]] = mensualesAsignado[m3];
        }
        processedData.push(totalRow);

        var headers = ['ID', '', 'Detalle', 'Asignación', 'Ejecutado', '%'].concat(COLUMN_MESES);

        return {
            processedData: processedData,
            filteredData: processedData,
            formulaCells: [],
            headers: headers
        };
    }

    /**
     * 📦708 (Fase 5) — Exporta un presupuesto de la BD a un .xlsx.
     * Espera: { presupuestoId }
     * Si no se pasa outputPath, el main process muestra un dialog "Save As".
     * Responde al iframe con: { type: 'bd-export-result', success, data/error }
     */
    async _handleExportBudgetToExcel(event) {
        const presupuestoId = event.data.presupuestoId;
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        if (!presupuestoId) {
            targetIframe.contentWindow.postMessage({
                type: 'bd-export-result',
                success: false,
                error: { code: 'INVALID_INPUT', message: 'presupuestoId requerido' }
            }, '*');
            return;
        }

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoExportExcel) {
                throw new Error('API presupuestoExportExcel no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Export to Excel: ${presupuestoId}`);
            const result = await window.electronAPI.presupuestoExportExcel({
                presupuestoId: presupuestoId
            });

            targetIframe.contentWindow.postMessage({
                type: 'bd-export-result',
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en exportBudgetToExcel: ${error.message}`, error.stack);
            targetIframe.contentWindow.postMessage({
                type: 'bd-export-result',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    /**
     * Maneja el guardado de cambios — rutea a BD o Excel según source.
     * Espera: { source: 'BD' | 'EXCEL', file, presupuestoId, data }
     * Responde al iframe con: { action: 'saveBudgetChanges', success, data/error }
     */
    async _handleSaveBudgetChanges(event) {
        const source = event.data.source || 'EXCEL';
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (source === 'BD') {
                // Guardar a BD
                const presupuestoId = event.data.presupuestoId;
                if (!presupuestoId) throw new Error('presupuestoId requerido para guardar en BD');
                if (!window.electronAPI || !window.electronAPI.presupuestoBulkSave) {
                    throw new Error('API presupuestoBulkSave no disponible');
                }
                this.log('INFO', `[FUENTE=BD] Save bulk ${presupuestoId} (${event.data.data ? event.data.data.length : 0} filas)`);
                const result = await window.electronAPI.presupuestoBulkSave({
                    presupuestoId: presupuestoId,
                    data: event.data.data
                });
                targetIframe.contentWindow.postMessage({
                    action: 'saveBudgetChanges',
                    success: result.success,
                    data: result.data,
                    error: result.error
                }, '*');
            } else {
                // Guardar a Excel (comportamiento viejo)
                const file = event.data.file;
                if (!file || !file.path) throw new Error('file.path requerido para guardar en Excel');
                this.log('INFO', `[FUENTE=EXCEL] Save to ${file.path}`);
                const saveResult = await window.electronAPI.saveBudgetFile(file.path, event.data.data);
                targetIframe.contentWindow.postMessage({
                    action: 'saveBudgetChanges',
                    ...saveResult
                }, '*');
            }
        } catch (error) {
            this.log('CRITICAL', `Error al guardar (${source}): ${error.message}`);
            targetIframe.contentWindow.postMessage({
                action: 'saveBudgetChanges',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    // ============================================================
    // 📦708 (Fase 3.5) — Handlers granulares
    // Permiten add/delete/update desde la UI sin pasar por bulk-save.
    // ============================================================

    /**
     * Crea una partida nueva en un presupuesto.
     * Espera: { presupuestoId, concepto, descripcion?, asignadoTotal? }
     * Responde al iframe con: { type: 'bd-partida-added', success, data/error }
     */
    async _handleAddPartidaToBD(event) {
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoAddPartida) {
                throw new Error('API presupuestoAddPartida no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Add partida: "${event.data.concepto}" a ${event.data.presupuestoId}`);
            const result = await window.electronAPI.presupuestoAddPartida({
                presupuestoId: event.data.presupuestoId,
                concepto: event.data.concepto,
                descripcion: event.data.descripcion,
                asignadoTotal: event.data.asignadoTotal
            });
            targetIframe.contentWindow.postMessage({
                type: 'bd-partida-added',
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en addPartidaToBD: ${error.message}`);
            targetIframe.contentWindow.postMessage({
                type: 'bd-partida-added',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    /**
     * Soft-delete una partida.
     * Espera: { partidaId }
     * Responde al iframe con: { type: 'bd-partida-deleted', success, data/error }
     */
    async _handleDeletePartidaFromBD(event) {
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoDeletePartida) {
                throw new Error('API presupuestoDeletePartida no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Delete partida: ${event.data.partidaId}`);
            const result = await window.electronAPI.presupuestoDeletePartida({
                partidaId: event.data.partidaId
            });
            targetIframe.contentWindow.postMessage({
                type: 'bd-partida-deleted',
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en deletePartidaFromBD: ${error.message}`);
            targetIframe.contentWindow.postMessage({
                type: 'bd-partida-deleted',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    /**
     * Update meta (nombre/notas) del presupuesto.
     * Espera: { presupuestoId, nombre?, notas? }
     * Responde al iframe con: { type: 'bd-meta-updated', success, data/error }
     */
    async _handleUpdatePresupuestoMeta(event) {
        const targetIframe = this.container.querySelector('iframe');
        if (!targetIframe) return;

        try {
            if (!window.electronAPI || !window.electronAPI.presupuestoUpdateMeta) {
                throw new Error('API presupuestoUpdateMeta no disponible');
            }
            this.log('INFO', `[FUENTE=BD] Update meta: ${event.data.presupuestoId}`);
            const result = await window.electronAPI.presupuestoUpdateMeta({
                presupuestoId: event.data.presupuestoId,
                nombre: event.data.nombre,
                notas: event.data.notas
            });
            targetIframe.contentWindow.postMessage({
                type: 'bd-meta-updated',
                success: result.success,
                data: result.data,
                error: result.error
            }, '*');
        } catch (error) {
            this.log('CRITICAL', `Error en updatePresupuestoMeta: ${error.message}`);
            targetIframe.contentWindow.postMessage({
                type: 'bd-meta-updated',
                success: false,
                error: { code: 'INTERNAL', message: error.message }
            }, '*');
        }
    }

    clearMessageHandlers() {
        this.messageHandlers.forEach(handler => window.removeEventListener('message', handler));
        this.messageHandlers.clear();
    }

    registerMessageHandler(key, handler) {
        if (this.messageHandlers.has(key)) window.removeEventListener('message', this.messageHandlers.get(key));
        window.addEventListener('message', handler);
        this.messageHandlers.set(key, handler);
    }

    async sendFilesToSelectorIframe(iframe) {
        try {
            if (!window.electronAPI || !window.electronAPI.getPresupuestoFiles) {
                throw new Error('API getPresupuestoFiles no disponible');
            }
            this.log('DEBUG', `Llamando a getPresupuestoFiles para la empresa: ${this.currentCompany}`);
            const result = await window.electronAPI.getPresupuestoFiles(this.currentCompany);

            if (result.success) {
                this.log('DEBUG', `Archivos de presupuesto recibidos: ${result.files.length}`, result.files);
                iframe.contentWindow.postMessage({ files: result.files }, '*');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.log('CRITICAL', 'Error crítico al cargar archivos de presupuesto:', error.message, error.stack);
            iframe.contentWindow.postMessage({ error: error.message }, '*');
        }
    }
}

window.PresupuestoGestionComponent = PresupuestoGestionComponent;