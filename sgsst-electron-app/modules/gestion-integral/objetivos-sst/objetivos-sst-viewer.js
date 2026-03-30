// objetivos-sst-viewer.js
// Componente para el submódulo "2.2.1 Objetivos SST" - Versión con Política Vinculada

class ObjetivosSSTViewer {
    constructor() {
        this.companyName = null;
        this.moduleName = null;
        this.submoduleName = null;
        this.excelFilePath = null;
        this.policyText = '';
        this.policyData = [];  // Nueva estructura: principios con objetivos
        this.isDataLoaded = false;
        this.activePrinciple = null;

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

        console.log('[objetivos-sst-viewer.js] Parámetros recibidos:', {
            company: this.companyName,
            module: this.moduleName,
            submodule: this.submoduleName
        });
    }

    async init() {
        try {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.loadData());
            } else {
                await this.loadData();
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error inicializando:', error);
            this.showError('Error inicializando el componente de Objetivos SST');
        }
    }

    async loadData() {
        try {
            console.log('[objetivos-sst-viewer.js] Iniciando carga de datos...');

            // Solicitar la ruta del archivo Excel
            const excelPathResponse = await this.requestExcelPath();
            if (!excelPathResponse.success) {
                throw new Error(excelPathResponse.error || 'No se pudo obtener la ruta del archivo Excel');
            }

            this.excelFilePath = excelPathResponse.filePath;
            console.log('[objetivos-sst-viewer.js] Ruta del archivo Excel:', this.excelFilePath);

            // Cargar datos del archivo Excel
            const data = await this.loadExcelData();
            this.policyText = data.policyText || '';
            this.policyData = this.transformDataToPolicyStructure(data.objectivesData || []);

            // Actualizar la interfaz con los datos cargados
            this.updateUIWithData();

            this.isDataLoaded = true;
            console.log('[objetivos-sst-viewer.js] Datos cargados exitosamente');
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error cargando datos:', error);
            this.showError(`Error cargando datos: ${error.message}`);
        }
    }

    /**
     * Transforma datos planos del Excel a estructura de principios
     */
    transformDataToPolicyStructure(objectivesData) {
        // Estructura base de principios SST
        const policyStructure = [
            {
                id: 1,
                principle: "Prevención",
                title: "Prevenir lesiones, enfermedades laborales y daños",
                text: "A partir de la identificación de peligros y control de actos inseguros.",
                cssClass: "k-p1",
                objectives: []
            },
            {
                id: 2,
                principle: "Requisitos Legales",
                title: "Promover satisfacción de requisitos legales",
                text: "Cumplir requisitos en calidad, seguridad, salud y medio ambiente.",
                cssClass: "k-p2",
                objectives: []
            },
            {
                id: 3,
                principle: "Satisfacción Cliente",
                title: "Proyectar calidad total y satisfacción del cliente",
                text: "Mantener relación mutuamente beneficiosa con el cliente.",
                cssClass: "k-p3",
                objectives: []
            },
            {
                id: 4,
                principle: "Recursos y Mejora",
                title: "Proporcionar recursos y personal competente",
                text: "Recursos financieros y personal calificado para mejora continua.",
                cssClass: "k-p4",
                objectives: []
            }
        ];

        // Agrupar objetivos por principio (asignación simplificada)
        objectivesData.forEach((obj, index) => {
            // Asignar cíclicamente a los 4 principios
            const principleIndex = index % 4;
            policyStructure[principleIndex].objectives.push({
                objective: obj.objective || 'Objetivo sin nombre',
                indicators: [{
                    indicator: obj.indicator || 'Indicador',
                    formula: obj.formula || '',
                    goal: obj.goal || '0',
                    frequency: obj.frequency || 'Mensual',
                    responsible: obj.responsible || 'Coordinador SST'
                }]
            });
        });

        return policyStructure;
    }

    async requestExcelPath() {
        return new Promise((resolve) => {
            const requestId = `get-excel-path-${Date.now()}`;

            const handleMessage = (event) => {
                if (event.data && event.data.action === 'get-excel-path-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };

            window.addEventListener('message', handleMessage);

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
        // Actualizar estadísticas
        this.updateStats();

        // Renderizar política
        this.renderPolicy();

        // Renderizar tabla de objetivos
        this.renderTable();
    }

    updateStats() {
        const totalObjectives = this.policyData.reduce((sum, p) => sum + p.objectives.length, 0);
        const totalIndicators = this.policyData.reduce((sum, p) => {
            return sum + p.objectives.reduce((s, o) => s + o.indicators.length, 0);
        }, 0);

        document.getElementById('stat-objectives').textContent = totalObjectives;
        document.getElementById('stat-indicators').textContent = totalIndicators;
    }

    renderPolicy() {
        const container = document.getElementById('policyBody');
        if (!container) return;

        container.innerHTML = '';

        this.policyData.forEach(p => {
            const totalIndicators = p.objectives.reduce((s, o) => s + o.indicators.length, 0);

            const block = document.createElement('div');
            block.className = `k-principle-block ${p.cssClass}`;
            block.dataset.pid = p.id;
            block.onclick = () => this.highlightPrinciple(p.id);

            block.innerHTML = `
                <div class="k-principle-header">
                    <span class="k-principle-badge">
                        <i class="bi bi-${this.getIcon(p.principle)}"></i>
                        ${p.principle}
                    </span>
                    <span class="k-principle-count">
                        <i class="bi bi-list-check"></i>
                        ${totalIndicators} indicadores
                    </span>
                </div>
                <div class="k-principle-title">${p.title}</div>
                <div class="k-principle-text">${p.text}</div>
                <div class="k-principle-objectives">
                    ${p.objectives.map(o => `
                        <span class="k-objective-tag">
                            <i class="bi bi-arrow-return-right"></i>
                            ${o.indicators.length} indic.
                        </span>
                    `).join('')}
                </div>
            `;

            container.appendChild(block);
        });
    }

    renderTable() {
        const tbody = document.getElementById('objectivesBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.policyData.forEach(p => {
            p.objectives.forEach(obj => {
                obj.indicators.forEach((ind, idx) => {
                    const tr = document.createElement('tr');
                    tr.className = `k-objective-row k-row-p${p.id}`;
                    if (idx > 0) tr.classList.add('k-indicator-row');
                    tr.dataset.pid = p.id;

                    if (idx === 0) {
                        tr.innerHTML = `
                            <td>
                                <div class="k-cell-objective">
                                    <span class="k-cell-principle-tag">${p.principle}</span>
                                    ${obj.objective}
                                    ${obj.indicators.length > 1 ? `<span style="font-size:0.6rem;color:var(--k-text-muted)">(${obj.indicators.length} indicadores)</span>` : ''}
                                </div>
                            </td>
                            <td><span class="k-cell-indicator">${ind.indicator}</span></td>
                            <td><span class="k-cell-formula" title="${ind.formula}">${ind.formula}</span></td>
                            <td><span class="k-cell-goal">${ind.goal}</span></td>
                            <td><span class="k-cell-frequency">${ind.frequency}</span></td>
                            <td><span class="k-cell-responsible">${ind.responsible}</span></td>
                            <td class="k-col-actions">
                                <button class="k-btn-icon" onclick="editRow(${p.id}, '${obj.objective}')"><i class="bi bi-pencil"></i></button>
                            </td>
                        `;
                    } else {
                        tr.innerHTML = `
                            <td>
                                <div class="k-indent-marker">
                                    <i class="bi bi-arrow-return-right"></i>
                                    ${idx + 1} de ${obj.indicators.length}
                                </div>
                            </td>
                            <td><span class="k-cell-indicator">${ind.indicator}</span></td>
                            <td><span class="k-cell-formula" title="${ind.formula}">${ind.formula}</span></td>
                            <td><span class="k-cell-goal">${ind.goal}</span></td>
                            <td><span class="k-cell-frequency">${ind.frequency}</span></td>
                            <td><span class="k-cell-responsible">${ind.responsible}</span></td>
                            <td class="k-col-actions">
                                <button class="k-btn-icon" onclick="editRow(${p.id}, '${obj.objective}')"><i class="bi bi-pencil"></i></button>
                            </td>
                        `;
                    }

                    tbody.appendChild(tr);
                });
            });
        });
    }

    getIcon(principle) {
        const icons = {
            'Prevención': 'shield-check',
            'Requisitos Legales': 'clipboard-check',
            'Satisfacción Cliente': 'people',
            'Recursos y Mejora': 'gear'
        };
        return icons[principle] || 'circle';
    }

    highlightPrinciple(pid) {
        if (this.activePrinciple === pid) {
            this.activePrinciple = null;
            document.querySelectorAll('.k-principle-block').forEach(el => {
                el.style.opacity = '1';
                el.classList.remove('k-active');
            });
            document.querySelectorAll('.k-objective-row').forEach(el => {
                el.style.opacity = '1';
            });
            return;
        }

        this.activePrinciple = pid;

        document.querySelectorAll('.k-principle-block').forEach(el => {
            if (parseInt(el.dataset.pid) === pid) {
                el.style.opacity = '1';
                el.classList.add('k-active');
            } else {
                el.style.opacity = '0.35';
                el.classList.remove('k-active');
            }
        });

        document.querySelectorAll('.k-objective-row').forEach(el => {
            el.style.opacity = parseInt(el.dataset.pid) === pid ? '1' : '0.25';
        });

        const principle = this.policyData.find(p => p.id === pid);
        this.showToast(`${principle.principle} destacado`);
    }

    async syncToExcel() {
        if (!this.isDataLoaded) {
            this.showError('Aún no se han cargado los datos. Espere un momento.');
            return;
        }

        const badge = document.getElementById('syncStatus');
        const btn = document.querySelector('.k-btn-primary');

        const originalText = btn.innerHTML;
        btn.innerHTML = '<span>⏳</span> Procesando...';
        btn.disabled = true;

        try {
            // Convertir estructura de principios a datos planos para Excel
            const flatData = [];
            this.policyData.forEach(p => {
                p.objectives.forEach(obj => {
                    obj.indicators.forEach(ind => {
                        flatData.push({
                            objective: obj.objective,
                            indicator: ind.indicator,
                            formula: ind.formula,
                            goal: ind.goal,
                            frequency: ind.frequency,
                            responsible: ind.responsible
                        });
                    });
                });
            });

            // Enviar solicitud de guardado
            const saveResponse = await this.saveExcelData({
                policyText: this.policyText,
                objectivesData: flatData
            });

            if (saveResponse.success) {
                if (badge) {
                    badge.className = 'k-sync-badge k-sync-synced';
                    badge.innerHTML = '<i class="bi bi-check-circle-fill"></i> Sincronizado';
                }
                this.showToast('Archivo Excel actualizado exitosamente');
            } else {
                throw new Error(saveResponse.error || 'Error desconocido al guardar');
            }
        } catch (error) {
            console.error('[objetivos-sst-viewer.js] Error al sincronizar:', error);
            this.showError(`Error al actualizar Excel: ${error.message}`);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    async saveExcelData(data) {
        return new Promise((resolve) => {
            const requestId = `save-excel-data-${Date.now()}`;

            const handleMessage = (event) => {
                if (event.data && event.data.action === 'save-excel-data-response' && event.data.requestId === requestId) {
                    window.removeEventListener('message', handleMessage);
                    resolve(event.data);
                }
            };

            window.addEventListener('message', handleMessage);

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
        // Agregar al último principio por defecto
        const lastPrinciple = this.policyData[this.policyData.length - 1];
        
        const newItem = {
            objective: "Nuevo Objetivo...",
            indicators: [{
                indicator: "Nuevo Indicador",
                formula: "Fórmula",
                goal: "0",
                frequency: "Mensual",
                responsible: "Coordinador SST"
            }]
        };

        lastPrinciple.objectives.push(newItem);
        this.renderTable();
        this.renderPolicy();
        this.updateStats();
        this.markPending();
    }

    markPending() {
        const badge = document.getElementById('syncStatus');
        if (badge) {
            badge.className = 'k-sync-badge k-sync-pending';
            badge.innerHTML = '<i class="bi bi-clock"></i> Cambios pendientes';
        }
    }

    showToast(message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'k-toast k-toast-success';
        toast.innerHTML = `<i class="bi bi-check-circle-fill"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    showError(message) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = 'k-toast';
        toast.innerHTML = `<i class="bi bi-exclamation-circle-fill"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
        console.error('[objetivos-sst-viewer.js] Error:', message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES GLOBALES
// ═══════════════════════════════════════════════════════════════════════════

let objetivosSSTViewer;

document.addEventListener('DOMContentLoaded', () => {
    objetivosSSTViewer = new ObjetivosSSTViewer();
});

function syncToExcel() {
    if (objetivosSSTViewer) objetivosSSTViewer.syncToExcel();
}

function addNewObjective() {
    if (objetivosSSTViewer) objetivosSSTViewer.addNewObjective();
}

function highlightPrinciple(pid) {
    if (objetivosSSTViewer) objetivosSSTViewer.highlightPrinciple(pid);
}

function editRow(pid, objective) {
    // Función placeholder para edición
    console.log('Editar:', pid, objective);
    showToast('Función de edición en desarrollo');
}

function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'k-toast k-toast-success';
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function backToModule() {
    // Enviar mensaje al padre para volver al módulo
    window.parent.postMessage({
        action: 'backToModule'
    }, '*');
}
