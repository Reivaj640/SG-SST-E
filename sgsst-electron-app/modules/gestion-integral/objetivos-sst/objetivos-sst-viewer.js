// objetivos-sst-viewer.js
// Componente para el submódulo "2.2.1 Objetivos SST"

class ObjetivosSSTViewer {
    constructor() {
        this.companyName = null;
        this.moduleName = null;
        this.submoduleName = null;
        this.excelFilePath = null;
        this.policyText = '';
        this.objectivesData = [];
        this.isDataLoaded = false;
        
        // Obtener parámetros de la URL
        this.extractParamsFromURL();
        
        // Inicializar la interfaz
        this.init();
    }

    extractParamsFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        this.companyName = urlParams.get('company');
        this.moduleName = urlParams.get('module');
        this.submoduleName = urlParams.get('submodule');
        
        console.log(`[objetivos-sst-viewer.js] Parámetros recibidos - Empresa: ${this.companyName}, Módulo: ${this.moduleName}, Submódulo: ${this.submoduleName}`);
    }

    async init() {
        try {
            // Esperar a que el DOM esté completamente cargado
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.loadData());
            } else {
                await this.loadData();
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error inicializando el componente:', error);
            this.showError('Error inicializando el componente de Objetivos SST');
        }
    }

    async loadData() {
        try {
            console.log('[objetivos-sst-viewer.js] Iniciando carga de datos...');
            
            // Solicitar la ruta del archivo Excel al backend
            const excelPathResponse = await this.requestExcelPath();
            if (!excelPathResponse.success) {
                throw new Error(excelPathResponse.error || 'No se pudo obtener la ruta del archivo Excel');
            }
            
            this.excelFilePath = excelPathResponse.filePath;
            console.log('[objetivos-sst-viewer.js] Ruta del archivo Excel:', this.excelFilePath);
            
            // Cargar datos del archivo Excel
            const data = await this.loadExcelData();
            this.policyText = data.policyText || '';
            this.objectivesData = data.objectivesData || [];
            
            // Actualizar la interfaz con los datos cargados
            this.updateUIWithData();
            
            this.isDataLoaded = true;
            console.log('[objetivos-sst-viewer.js] Datos cargados exitosamente');
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error cargando datos:', error);
            this.showError(`Error cargando datos: ${error.message}`);
        }
    }

    async requestExcelPath() {
        return new Promise((resolve) => {
            const requestId = `get-excel-path-${Date.now()}`;
            
            // Escuchar la respuesta
            const handleMessage = (event) => {
                if (event.data && event.data.action === 'get-excel-path-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };
            
            window.addEventListener('message', handleMessage);
            
            // Enviar solicitud al componente padre
            window.parent.postMessage({
                action: 'get-excel-path-request',
                requestId: requestId,
                payload: {
                    company: this.companyName,
                    module: this.moduleName,
                    submodule: this.submoduleName
                }
            }, '*');
        });
    }

    async loadExcelData() {
        return new Promise((resolve, reject) => {
            const requestId = `load-excel-data-${Date.now()}`;
            
            // Escuchar la respuesta
            const handleMessage = (event) => {
                if (event.data && event.data.action === 'load-excel-data-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    
                    if (event.data.success) {
                        resolve(event.data.data);
                    } else {
                        reject(new Error(event.data.error || 'Error desconocido al cargar datos'));
                    }
                }
            };
            
            window.addEventListener('message', handleMessage);
            
            // Enviar solicitud al componente padre
            window.parent.postMessage({
                action: 'load-excel-data-request',
                requestId: requestId,
                payload: {
                    filePath: this.excelFilePath
                }
            }, '*');
        });
    }

    updateUIWithData() {
        // Actualizar el campo de texto de la política
        const policyTextArea = document.getElementById('policyText');
        if (policyTextArea) {
            policyTextArea.value = this.policyText;
        }
        
        // Renderizar la tabla de objetivos
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        this.objectivesData.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.id = `row-${item.id}`;
            
            tr.innerHTML = `
                <td>
                    <span class="objetivos-display-field">${item.objective || ''}</span>
                    <input type="text" class="objetivos-editable-field" value="${item.objective || ''}" onchange="objetivosSSTViewer.markPending()">
                </td>
                <td>
                    <span class="objetivos-display-field">${item.indicator || ''}</span>
                    <input type="text" class="objetivos-editable-field" value="${item.indicator || ''}" onchange="objetivosSSTViewer.markPending()">
                </td>
                <td>
                    <span class="objetivos-display-field" style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted);">${item.formula || ''}</span>
                    <input type="text" class="objetivos-editable-field" value="${item.formula || ''}" onchange="objetivosSSTViewer.markPending()">
                </td>
                <td>
                    <span class="objetivos-display-field" style="font-weight:bold; color:var(--primary);">${item.goal || ''}</span>
                    <input type="text" class="objetivos-editable-field" value="${item.goal || ''}" onchange="objetivosSSTViewer.markPending()">
                </td>
                <td>
                    <span class="objetivos-display-field">${item.frequency || ''}</span>
                    <select class="objetivos-editable-field" onchange="objetivosSSTViewer.markPending()">
                        <option ${item.frequency === 'Mensual' ? 'selected' : ''}>Mensual</option>
                        <option ${item.frequency === 'Anual' ? 'selected' : ''}>Anual</option>
                        <option ${item.frequency === 'Bimensual' ? 'selected' : ''}>Bimensual</option>
                        <option ${item.frequency === 'Semestral' ? 'selected' : ''}>Semestral</option>
                    </select>
                </td>
                <td>
                    <span class="objetivos-display-field">${item.responsible || ''}</span>
                    <input type="text" class="objetivos-editable-field" value="${item.responsible || ''}" onchange="objetivosSSTViewer.markPending()">
                </td>
                <td style="text-align: center;">
                    <button class="objetivos-btn-icon" onclick="objetivosSSTViewer.toggleEdit(${item.id})" title="Editar Fila">✏️</button>
                    <button class="objetivos-btn-icon delete" onclick="objetivosSSTViewer.deleteRow(${item.id})" title="Eliminar">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    toggleEdit(id) {
        const row = document.getElementById(`row-${id}`);
        const isEditing = row.classList.contains('tr-editing');
        
        if (isEditing) {
            row.classList.remove('tr-editing');
            this.updateDataFromRow(id);
            this.showToast("Cambios guardados localmente");
        } else {
            row.classList.add('tr-editing');
        }
    }

    updateDataFromRow(id) {
        const row = document.getElementById(`row-${id}`);
        const inputs = row.querySelectorAll('.objetivos-editable-field');
        const itemIndex = this.objectivesData.findIndex(i => i.id === id);
        
        if (itemIndex > -1 && inputs.length >= 6) {
            this.objectivesData[itemIndex].objective = inputs[0].value;
            this.objectivesData[itemIndex].indicator = inputs[1].value;
            this.objectivesData[itemIndex].formula = inputs[2].value;
            this.objectivesData[itemIndex].goal = inputs[3].value;
            this.objectivesData[itemIndex].frequency = inputs[4].value;
            this.objectivesData[itemIndex].responsible = inputs[5].value;
            
            // Actualizar también los campos de visualización
            row.querySelector('td:nth-child(1) .objetivos-display-field').textContent = this.objectivesData[itemIndex].objective;
            row.querySelector('td:nth-child(2) .objetivos-display-field').textContent = this.objectivesData[itemIndex].indicator;
            row.querySelector('td:nth-child(3) .objetivos-display-field').textContent = this.objectivesData[itemIndex].formula;
            row.querySelector('td:nth-child(4) .objetivos-display-field').textContent = this.objectivesData[itemIndex].goal;
            row.querySelector('td:nth-child(5) .objetivos-display-field').textContent = this.objectivesData[itemIndex].frequency;
            row.querySelector('td:nth-child(6) .objetivos-display-field').textContent = this.objectivesData[itemIndex].responsible;
        }
    }

    markPending() {
        const badge = document.getElementById('syncStatus');
        if (badge) {
            badge.className = 'objetivos-sync-badge pending';
            badge.textContent = 'Cambios pendientes de sincronizar';
        }
    }

    async syncToExcel() {
        if (!this.isDataLoaded) {
            this.showError('Aún no se han cargado los datos. Espere un momento e intente nuevamente.');
            return;
        }
        
        const policyText = document.getElementById('policyText').value;
        const badge = document.getElementById('syncStatus');
        const btn = document.querySelector('.excel-sync-btn');
        
        if (!btn) {
            console.error('[objetivos-sst-viewer.js] Botón de sincronización no encontrado');
            return;
        }
        
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>⏳</span> Procesando...';
        btn.disabled = true;

        try {
            // Actualizar el texto de la política
            this.policyText = policyText;
            
            // Enviar solicitud de guardado al backend
            const saveResponse = await this.saveExcelData({
                policyText: this.policyText,
                objectivesData: this.objectivesData
            });
            
            if (saveResponse.success) {
                if (badge) {
                    badge.className = 'objetivos-sync-badge synced';
                    badge.textContent = 'Sincronizado con Excel';
                }
                
                this.showToast('Archivo Excel actualizado exitosamente');
            } else {
                throw new Error(saveResponse.error || 'Error desconocido al guardar');
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error al sincronizar con Excel:', error);
            this.showError(`Error al actualizar el archivo Excel: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async saveExcelData(data) {
        return new Promise((resolve) => {
            const requestId = `save-excel-data-${Date.now()}`;
            
            // Escuchar la respuesta
            const handleMessage = (event) => {
                if (event.data && event.data.action === 'save-excel-data-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };
            
            window.addEventListener('message', handleMessage);
            
            // Enviar solicitud al componente padre
            window.parent.postMessage({
                action: 'save-excel-data-request',
                requestId: requestId,
                payload: {
                    filePath: this.excelFilePath,
                    data: data
                }
            }, '*');
        });
    }

    addNewObjective() {
        const newId = this.objectivesData.length > 0 
            ? Math.max(...this.objectivesData.map(item => item.id)) + 1 
            : 1;
            
        const newItem = {
            id: newId,
            objective: "Nuevo Objetivo...",
            indicator: "Nuevo Indicador",
            formula: "Fórmula",
            goal: "0",
            frequency: "Mensual",
            responsible: "Coordinador SST"
        };
        
        this.objectivesData.push(newItem);
        this.renderTable();
        
        // Activar edición para la nueva fila después de que se haya renderizado
        setTimeout(() => this.toggleEdit(newId), 100);
        this.markPending();
    }

    deleteRow(id) {
        if (confirm("¿Está seguro de eliminar este objetivo del archivo Excel?")) {
            this.objectivesData = this.objectivesData.filter(i => i.id !== id);
            this.renderTable();
            this.markPending();
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'show success';
            setTimeout(() => {
                toast.className = toast.className.replace('show', '');
            }, 3000);
        }
    }

    showError(message) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.className = 'show';
            setTimeout(() => {
                toast.className = toast.className.replace('show', '');
            }, 5000);
        }
        console.error('[objetivos-sst-viewer.js] Error:', message);
    }
}

// Inicializar el componente cuando se cargue el script
let objetivosSSTViewer;
document.addEventListener('DOMContentLoaded', () => {
    objetivosSSTViewer = new ObjetivosSSTViewer();
});

// Funciones globales para ser llamadas desde el HTML
function syncToExcel() {
    if (objetivosSSTViewer) {
        objetivosSSTViewer.syncToExcel();
    }
}

function addNewObjective() {
    if (objetivosSSTViewer) {
        objetivosSSTViewer.addNewObjective();
    }
}

function markPending() {
    if (objetivosSSTViewer) {
        objetivosSSTViewer.markPending();
    }
}