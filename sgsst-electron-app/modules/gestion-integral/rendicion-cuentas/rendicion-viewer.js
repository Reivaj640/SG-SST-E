/**
 * Visualizador del submódulo de Rendición de Cuentas
 *
 * Este archivo maneja la visualización del formulario de rendición de cuentas
 */

// Variables globales (con prefijo para evitar colisiones)
let rendicionCurrentData = null;
let rendicionCurrentCompany = null;
let rendicionCurrentPeriod = null;
let rendicionExcelData = null; // Almacenar los datos del archivo Excel

// --- START: Refactored Communication Logic ---

/**
 * Helper function to communicate with the parent window via postMessage.
 * This abstracts the request-response logic for calling Electron APIs from the iframe.
 * @param {string} type - The type of the request (e.g., 'find-submodule-path').
 * @param {*} payload - The data to send with the request.
 * @returns {Promise<any>} - A promise that resolves with the payload from the parent's response.
 */
function callParentAPI(type, payload) {
    console.log(`[rendicion-viewer.js][callParentAPI] Enviando solicitud al padre. Tipo: ${type}, Payload:`, payload);
    return new Promise((resolve, reject) => {
        // Unique ID for this request to match it with a response
        const requestId = `req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            // Security: only accept messages from the parent window on file protocol
            if (event.origin !== 'file://' || event.source !== window.parent) {
                return;
            }

            const response = event.data;
            // Check if the response corresponds to our request
            if (response.type === `${type}-response` && response.requestId === requestId) {
                // Clean up the event listener
                window.removeEventListener('message', handleResponse);
                console.log(`[rendicion-viewer.js][callParentAPI] Respuesta recibida del padre para requestId ${requestId}. Success: ${response.payload && response.payload.success}`);

                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    const errorMessage = (response.payload && response.payload.error) || 'Unknown error from parent process';
                    console.error(`[rendicion-viewer.js][callParentAPI] Error recibido para la solicitud '${type}':`, errorMessage);
                    reject(new Error(errorMessage));
                }
            }
        };

        window.addEventListener('message', handleResponse);

        // Send the request to the parent window
        console.log(`VIEWER: 🗣️ Sending message to parent: ${type}-request`, { payload, requestId });
        window.parent.postMessage({
            type: `${type}-request`,
            payload,
            requestId
        }, 'file://');
    });
}

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    initializeRendicion();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Asegurar que las funciones estén disponibles globalmente
    window.switchSection = switchSection;
    window.saveReport = saveReport;
    window.finalizeReport = finalizeReport;
    window.loadExcelData = loadExcelData;
    window.saveExcelData = saveExcelData;

    // Evento para volver al módulo
    document.getElementById('backBtn')?.addEventListener('click', () => {
        if (window.parent && window.parent.postMessage) {
            // Use a standardized message format for all communications
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        }
    });
}

// Inicializar la rendición de cuentas
function initializeRendicion() {
    loadURLParameters();
}

// Cargar parámetros de la URL
function loadURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    rendicionCurrentCompany = urlParams.get('company') || 'Empresa Desconocida';
    rendicionCurrentPeriod = urlParams.get('period') || '2024';

    // Actualizar la información de la empresa en el encabezado
    const companyElements = document.querySelectorAll('#companyName');
    companyElements.forEach(element => {
        element.textContent = rendicionCurrentCompany;
    });

    // Actualizar el periodo actual
    const periodLabels = document.querySelectorAll('#currentPeriodLabel');
    periodLabels.forEach(label => {
        label.textContent = rendicionCurrentPeriod;
    });
}

/**
 * Renderiza el submódulo de rendición de cuentas
 * @param {HTMLElement} container - Contenedor donde se va a renderizar
 * @param {Object} context - Contexto con información adicional
 */
async function render(container, context = {}) {
    try {
        // Extraer información del contexto
        rendicionCurrentCompany = context.company || 'Empresa Desconocida';
        rendicionCurrentPeriod = context.period || '2024';

        // Cargar datos iniciales
        await loadData();

        // Cargar el contenido HTML
        const response = await fetch('./modules/gestion-integral/rendicion-cuentas/rendicion-cuentas.html');
        const htmlContent = await response.text();

        // Insertar el contenido en el contenedor
        container.innerHTML = htmlContent;

        // Cargar datos del Excel si existen
        await loadExcelData();

        // Inicializar eventos después de que se haya cargado el HTML
        setTimeout(initializeEvents, 200);

    } catch (error) {
        console.error('Error al renderizar el submódulo de rendición de cuentas:', error);
        container.innerHTML = '<div class="error-message">Error al cargar el submódulo de Rendición de Cuentas</div>';
    }
}

/**
 * Carga los datos iniciales
 */
async function loadData() {
    try {
        // Simular carga de datos o conectar con la lógica real
        rendicionCurrentData = {
            general: {
                companyName: rendicionCurrentCompany || 'TEMPOACTIVA EST S.A.S.',
                nit: '900511178-1',
                period: rendicionCurrentPeriod || '2024',
                legalRepresentative: 'Freedy Enrique Torrez Madariaga',
                sstResponsible: 'Javier Robles Fontalvo',
                legalBasis: 'Decreto 1072/2015, Res. 0312/2019, Res. 2341/2021'
            },
            team: {
                coordinator: '',
                vigilator: ''
            },
            status: {
                compliance: '91%',
                workers: 154
            }
        };
    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

/**
 * Carga los datos del archivo Excel
 */
async function loadExcelData() {
    try {
        console.log(`Cargando datos del archivo Excel para ${rendicionCurrentCompany} periodo ${rendicionCurrentPeriod}`);

        // Obtener la ruta del submódulo
        const submodulePathResult = await callParentAPI('find-submodule-path', {
            company: rendicionCurrentCompany,
            module: 'Gestión Integral',
            submodule: '2.6.1 Rendición de cuentas'
        });

        if (submodulePathResult.success) {
            // Buscar archivos Excel en la carpeta del submódulo
            const excelFilesResult = await callParentAPI('get-documents-in-folder', submodulePathResult.path);

            if (excelFilesResult.success && excelFilesResult.files && excelFilesResult.files.length > 0) {
                // Buscar archivo Excel del periodo actual
                const excelFile = excelFilesResult.files.find(file =>
                    file.name.toLowerCase().includes(rendicionCurrentPeriod) &&
                    (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))
                );

                if (excelFile) {
                    // Leer el archivo Excel
                    const filePath = excelFile.path;
                    const excelDataResult = await callParentAPI('read-excel-file', { filePath });

                    if (excelDataResult.success) {
                        rendicionExcelData = excelDataResult.data;
                        console.log('Datos del Excel cargados exitosamente:', rendicionExcelData);

                        // Actualizar la interfaz con los datos del Excel
                        updateInterfaceWithExcelData(rendicionExcelData);
                    } else {
                        console.error('Error al leer el archivo Excel:', excelDataResult.error);
                    }
                } else {
                    console.log(`No se encontró archivo Excel para el periodo ${rendicionCurrentPeriod} en la carpeta ${submodulePathResult.path}`);
                }
            } else {
                console.log('No se encontraron archivos en la carpeta del submódulo');
            }
        } else {
            console.error('Error al obtener la ruta del submódulo:', submodulePathResult.error);
        }
    } catch (error) {
        console.error('Error al cargar datos del Excel:', error);
    }
}

/**
 * Actualiza la interfaz con los datos del Excel
 */
function updateInterfaceWithExcelData(excelData) {
    try {
        // Actualizar campos de texto con datos del Excel
        const companyNameInput = document.querySelector('input[value="TEMPOACTIVA EST S.A.S."]');
        if (companyNameInput && excelData.general && excelData.general.companyName) {
            companyNameInput.value = excelData.general.companyName;
        }

        // Actualizar otras secciones según los datos del Excel
        // Por ejemplo, resultados SG-SST, indicadores, etc.
        if (excelData.results && excelData.results.standards) {
            // Actualizar tabla de resultados del SG-SST
            updateResultsTable(excelData.results.standards);
        }

        if (excelData.indicators) {
            // Actualizar campos de indicadores
            updateIndicatorsFields(excelData.indicators);
        }

        console.log('Interfaz actualizada con datos del Excel');
    } catch (error) {
        console.error('Error al actualizar la interfaz con datos del Excel:', error);
    }
}

/**
 * Actualiza la tabla de resultados del SG-SST
 */
function updateResultsTable(standards) {
    try {
        if (!standards || !Array.isArray(standards)) return;

        const tableBody = document.querySelector('#resultados tbody');
        if (!tableBody) return;

        // Limpiar tabla existente
        tableBody.innerHTML = '';

        // Agregar filas de estándares
        standards.forEach(standard => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${standard.id || ''}</strong></td>
                <td>${standard.name || ''}</td>
                <td><span class="badge badge-${standard.status === 'Sí' ? 'success' : standard.status === 'Parcial' ? 'warning' : 'danger'}">${standard.status || ''}</span></td>
                <td>${standard.compliance || ''}</td>
                <td>${standard.observations || ''}</td>
                <td><button class="btn btn-outline" style="padding: 0.2rem 0.5rem;"><i class="fas fa-edit"></i></button></td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al actualizar tabla de resultados:', error);
    }
}

/**
 * Actualiza campos de indicadores
 */
function updateIndicatorsFields(indicators) {
    try {
        if (!indicators) return;

        // Actualizar campos de indicadores de desempeño
        const accidentRateInput = document.querySelector('#resultados input[value="1.8%"]');
        if (accidentRateInput && indicators.accidentRate) {
            accidentRateInput.value = indicators.accidentRate;
        }

        const absenteeismRateInput = document.querySelector('#resultados input[value="0.8%"]');
        if (absenteeismRateInput && indicators.absenteeismRate) {
            absenteeismRateInput.value = indicators.absenteeismRate;
        }

        const trainingExecutedInput = document.querySelector('#resultados input[value="92%"]');
        if (trainingExecutedInput && indicators.trainingExecuted) {
            trainingExecutedInput.value = indicators.trainingExecuted;
        }
    } catch (error) {
        console.error('Error al actualizar campos de indicadores:', error);
    }
}

/**
 * Guarda los datos en el archivo Excel
 */
async function saveExcelData() {
    try {
        console.log('Guardando datos en archivo Excel...');

        // Recolectar datos de la interfaz
        const interfaceData = collectInterfaceData();

        // Obtener la ruta del submódulo
        const submodulePathResult = await callParentAPI('find-submodule-path', {
            company: rendicionCurrentCompany,
            module: 'Gestión Integral',
            submodule: '2.6.1 Rendición de cuentas'
        });

        if (submodulePathResult.success) {
            // Construir nombre del archivo Excel
            const fileName = `Rendicion-Cuentas-${rendicionCurrentCompany}-${rendicionCurrentPeriod}.xlsx`;
            const filePath = `${submodulePathResult.path}/${fileName}`;

            // Enviar datos al proceso principal para guardar en Excel
            const saveResult = await callParentAPI('save-excel-data', {
                filePath,
                data: interfaceData,
                company: rendicionCurrentCompany,
                period: rendicionCurrentPeriod
            });

            if (saveResult.success) {
                console.log('Datos guardados exitosamente en Excel:', saveResult.filePath);

                // Mostrar notificación de éxito
                const toast = document.getElementById("toast");
                if (toast) {
                    toast.textContent = "Datos guardados exitosamente en archivo Excel";
                    toast.className = "show";
                    setTimeout(function(){
                        toast.className = toast.className.replace("show", "");
                    }, 3000);
                }
            } else {
                console.error('Error al guardar datos en Excel:', saveResult.error);
            }
        } else {
            console.error('Error al obtener la ruta del submódulo:', submodulePathResult.error);
        }
    } catch (error) {
        console.error('Error al guardar datos en Excel:', error);
    }
}

/**
 * Recolecta datos de la interfaz para guardar en Excel
 */
function collectInterfaceData() {
    const data = {
        general: {},
        results: { standards: [] },
        indicators: {},
        legalMatrix: [],
        findings: {},
        incidents: [],
        improvementPlan: [],
        conclusions: {}
    };

    // Recolectar datos generales
    const generalSection = document.getElementById('general');
    if (generalSection) {
        const companyNameInput = generalSection.querySelector('input[value*="TEMPOACTIVA"]');
        const nitInput = generalSection.querySelector('input[value*="900511178"]');
        const periodSelect = generalSection.querySelector('select');
        const legalRepInput = generalSection.querySelectorAll('input')[3]; // Representante Legal
        const sstResponsibleInput = generalSection.querySelectorAll('input')[4]; // Responsable SG-SST

        data.general = {
            companyName: companyNameInput ? companyNameInput.value : '',
            nit: nitInput ? nitInput.value : '',
            period: periodSelect ? periodSelect.value : '',
            legalRepresentative: legalRepInput ? legalRepInput.value : '',
            sstResponsible: sstResponsibleInput ? sstResponsibleInput.value : ''
        };
    }

    // Recolectar datos de resultados SG-SST
    const resultsSection = document.getElementById('resultados');
    if (resultsSection) {
        const tableRows = resultsSection.querySelectorAll('tbody tr');
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                data.results.standards.push({
                    id: cells[0].textContent.replace(/\D/g, ''), // Solo números
                    name: cells[1].textContent,
                    status: cells[2].querySelector('.badge') ? cells[2].querySelector('.badge').textContent : '',
                    compliance: cells[3].textContent,
                    observations: cells[4] ? cells[4].textContent : ''
                });
            }
        });
    }

    // Recolectar indicadores
    const indicatorsSection = document.getElementById('resultados');
    if (indicatorsSection) {
        const indicatorInputs = indicatorsSection.querySelectorAll('.form-grid-3 input');
        if (indicatorInputs.length >= 3) {
            data.indicators = {
                accidentRate: indicatorInputs[0].value,
                absenteeismRate: indicatorInputs[1].value,
                trainingExecuted: indicatorInputs[2].value
            };
        }
    }

    return data;
}

/**
 * Inicializa los eventos después de cargar el HTML
 */
function initializeEvents() {
    // Asegurarse de que las funciones globales estén disponibles
    window.switchSection = switchSection;
    window.saveReport = saveReport;
    window.finalizeReport = finalizeReport;
    window.loadExcelData = loadExcelData;
    window.saveExcelData = saveExcelData;

    // Actualizar la información de la empresa si es necesario
    const companyElements = document.querySelectorAll('#companyName');
    companyElements.forEach(element => {
        if (!element.textContent || element.textContent === '...') {
            element.textContent = rendicionCurrentCompany;
        }
    });

    // Actualizar el periodo actual
    const periodLabels = document.querySelectorAll('#currentPeriodLabel');
    periodLabels.forEach(label => {
        if (!label.textContent || label.textContent === '...') {
            label.textContent = rendicionCurrentPeriod;
        }
    });

    const breadcrumbPeriod = document.getElementById('breadcrumb-period');
    if (breadcrumbPeriod) {
        breadcrumbPeriod.textContent = rendicionCurrentPeriod;
    }

    // Evento para el botón Volver
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            console.log('Botón volver clickeado');
            // Solo enviamos el mensaje al padre para evitar bucle infinito
            const message = { type: 'back-to-module-request' };
            if (window.parent !== window) {
                window.parent.postMessage(message, '*');
            }
        };
    }

    // Agregar botón para cargar datos desde Excel
    const actionsDiv = document.querySelector('div[style*="justify-content: flex-end"]');
    if (actionsDiv && !document.getElementById('load-excel-btn')) {
        const loadExcelBtn = document.createElement('button');
        loadExcelBtn.id = 'load-excel-btn';
        loadExcelBtn.className = 'btn btn-outline';
        loadExcelBtn.innerHTML = '<i class="fas fa-file-excel"></i> Cargar desde Excel';
        loadExcelBtn.style.marginRight = '1rem';
        loadExcelBtn.onclick = loadExcelData;

        actionsDiv.insertBefore(loadExcelBtn, actionsDiv.firstChild);
    }

    // Agregar botón para guardar en Excel
    const saveExcelBtn = document.createElement('button');
    saveExcelBtn.id = 'save-excel-btn';
    saveExcelBtn.className = 'btn btn-outline';
    saveExcelBtn.innerHTML = '<i class="fas fa-file-excel"></i> Guardar en Excel';
    saveExcelBtn.onclick = saveExcelData;

    actionsDiv.appendChild(saveExcelBtn);
}

/**
 * Cambia la sección activa
 * @param {string} sectionId - ID de la sección a mostrar
 * @param {HTMLElement} navElement - Elemento de navegación activo
 */
function switchSection(sectionId, navElement) {
    // Ocultar todas las secciones
    document.querySelectorAll('.section-view').forEach(el => el.classList.remove('active'));
    // Quitar clase active de botones
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Mostrar sección seleccionada
    document.getElementById(sectionId).classList.add('active');
    // Activar botón
    navElement.classList.add('active');
}

/**
 * Guarda el informe
 */
function saveReport() {
    // Simulación de guardado
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = "Información guardada exitosamente en borrador";
        toast.className = "show";
        setTimeout(function(){
            toast.className = toast.className.replace("show", "");
        }, 3000);
    }

    // Aquí iría la lógica real para guardar los datos
    console.log('Guardando informe de rendición de cuentas');

    // Enviar mensaje al padre para guardar
    window.parent.postMessage({
        type: 'save-report-request',
        payload: { data: rendicionCurrentData, company: rendicionCurrentCompany, period: rendicionCurrentPeriod }
    }, 'file://');
}

/**
 * Finaliza el informe
 */
function finalizeReport() {
    const confirmed = confirm("¿Está seguro de cerrar el periodo de Rendición de Cuentas? Esta acción generará el informe oficial PDF.");
    if (confirmed) {
        const toast = document.getElementById("toast");
        if (toast) {
            toast.textContent = "Generando Informe PDF Oficial...";
            toast.className = "show";
            setTimeout(function(){
                toast.className = toast.className.replace("show", "");
            }, 3000);
        }

        // Enviar mensaje al padre para generar PDF
        window.parent.postMessage({
            type: 'generate-pdf-request',
            payload: { data: rendicionCurrentData, company: rendicionCurrentCompany, period: rendicionCurrentPeriod }
        }, 'file://');
    }
}

// Registrar el viewer globalmente para que pueda ser usado por el componente
if (typeof window !== 'undefined') {
    window.rendicionViewer = {
        render,
        switchSection,
        saveReport,
        finalizeReport,
        loadExcelData,
        saveExcelData
    };
}