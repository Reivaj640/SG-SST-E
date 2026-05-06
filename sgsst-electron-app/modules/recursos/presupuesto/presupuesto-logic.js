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
                try {
                    const saveResult = await window.electronAPI.saveBudgetFile(event.data.file.path, event.data.data);
                    const gestionIframe = this.container.querySelector('iframe');
                    if (gestionIframe) {
                        gestionIframe.contentWindow.postMessage({
                            action: 'saveBudgetChanges',
                            ...saveResult
                        }, '*');
                    }
                } catch (error) {
                    this.log('CRITICAL', `Error al guardar: ${error.message}`);
                }
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