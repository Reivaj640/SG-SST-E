// plan-viewer.js - Updated version to fix syntax error

// Variables globales
let currentDocument = null;
let currentViewer = null;
let currentZoom = 'auto';
let currentOrientation = 'vertical';
let totalPages = 0;
let currentPage = 1;
let folderPath = '';

// Variables específicas para el Plan de Trabajo
let currentPeriod = 2025;
let selectedActivityId = null;
let deleteTargetId = null;
let periodsData = {};
let currentCompany = null;

// --- START: Refactored Communication Logic ---

/**
 * Helper function to communicate with the parent window via postMessage.
 * This abstracts the request-response logic for calling Electron APIs from the iframe.
 * @param {string} type - The type of the request (e.g., 'get-documents-in-folder').
 * @param {*} payload - The data to send with the request.
 * @returns {Promise<any>} - A promise that resolves with the payload from the parent's response.
 */
function callParentAPI(type, payload) {
    console.log(`[plan-viewer.js][callParentAPI] Enviando solicitud al padre. Tipo: ${type}, Payload:`, payload);
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
                console.log(`[plan-viewer.js][callParentAPI] Respuesta recibida del padre para requestId ${requestId}. Success: ${response.payload && response.payload.success}`);

                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    const errorMessage = (response.payload && response.payload.error) || 'Unknown error from parent process';
                    console.error(`[plan-viewer.js][callParentAPI] Error recibido para la solicitud '${type}':`, errorMessage);
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
    initializePlanWork();
    setupEventListeners();
    loadInitialData();
});

// Configurar event listeners
function setupEventListeners() {
    document.getElementById('backBtn')?.addEventListener('click', () => {
        if (window.parent && window.parent.postMessage) {
            // Use a standardized message format for all communications
            window.parent.postMessage({ type: 'back-to-module-request' }, '*');
        }
    });
    document.getElementById('downloadBtn')?.addEventListener('click', downloadDocument);
    document.getElementById('printBtn')?.addEventListener('click', printDocument);
    document.getElementById('zoomLevel')?.addEventListener('change', (e) => {
        currentZoom = e.target.value;
        applyZoom();
    });
    document.getElementById('pageOrientation')?.addEventListener('change', (e) => {
        currentOrientation = e.target.value;
        applyOrientation();
    });
}

// Inicializar el plan de trabajo
function initializePlanWork() {
    initResizer();
    loadURLParameters();
    // renderPeriodSelector() se llama después de cargar los datos en loadPlanDataFromExcel()
}

// Cargar parámetros de la URL
function loadURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    currentCompany = urlParams.get('company') || 'Empresa Desconocida';
    const moduleName = urlParams.get('module') || 'Módulo Desconocido';
    const submoduleName = urlParams.get('submodule') || 'Submódulo Desconocido';

    // Actualizar la información de la empresa en el header
    document.getElementById('companyName').textContent = currentCompany;

    // Cargar datos iniciales del plan de trabajo
    loadPlanDataFromExcel();
}

// Cargar datos del plan de trabajo desde Excel
async function loadPlanDataFromExcel() {
    console.log('[loadPlanDataFromExcel] Iniciando carga de datos para la empresa:', currentCompany, 'y año:', currentPeriod);
    try {
        // Usar el mecanismo estándar para encontrar la ruta del submódulo
        // El nombre del submódulo debe coincidir con el que se usa en la estructura de carpetas
        const submoduleResult = await callParentAPI('find-submodule-path', {
            company: currentCompany,
            module: 'Gestión Integral',  // Nombre del módulo tal como aparece en la estructura
            submodule: '2.4.1 Plan de Trabajo Anual'  // Nombre exacto del submódulo con el código
        });

        console.log('[loadPlanDataFromExcel] Resultado de find-submodule-path:', submoduleResult);

        if (submoduleResult.success) {
            const submodulePath = submoduleResult.path;
            console.log('[loadPlanDataFromExcel] Ruta del submódulo encontrada:', submodulePath);

            // Buscar archivos Excel en la carpeta del submódulo
            const excelFiles = await findExcelFilesInDirectory(submodulePath);
            if (excelFiles.length === 0) {
                console.log('[loadPlanDataFromExcel] No se encontraron archivos Excel en la ruta:', submodulePath);
                initializeDefaultData();
                return;
            }

            // Buscar el archivo específico del año (por ejemplo, "GI-FO-045 PLAN DE TRABAJO ANUAL 2025 SST.xls")
            const targetFileName = `PLAN DE TRABAJO ANUAL ${currentPeriod} SST`;
            let targetFile = excelFiles.find(file =>
                file.name.toUpperCase().includes(targetFileName.toUpperCase())
            );

            // Si no encontramos el archivo con el nombre exacto, buscar uno que contenga "plan de trabajo" y el año
            if (!targetFile) {
                const fallbackFile = excelFiles.find(file =>
                    file.name.toUpperCase().includes('PLAN DE TRABAJO') &&
                    file.name.includes(currentPeriod.toString())
                );

                if (fallbackFile) {
                    console.log('[loadPlanDataFromExcel] Usando archivo encontrado como alternativa:', fallbackFile.name);
                    targetFile = fallbackFile;
                }
            }

            if (!targetFile) {
                console.log(`[loadPlanDataFromExcel] No se encontró el archivo específico para el año ${currentPeriod} en: ${submodulePath}`);
                initializeDefaultData();
                return;
            }

            // Obtener la ruta completa del archivo a través del proceso principal
            const filePathResult = await callParentAPI('get-file-path', {
                directory: submodulePath,
                fileName: targetFile.name
            });

            if (!filePathResult.success) {
                console.error('[loadPlanDataFromExcel] Error al obtener la ruta del archivo:', filePathResult.error);
                initializeDefaultData();
                return;
            }

            const filePath = filePathResult.path;
            console.log('[loadPlanDataFromExcel] Leyendo archivo Excel del plan de trabajo:', filePath);

            // Leer el archivo Excel
            const result = await callParentAPI('read-excel-file', { filePath });
            if (result.success) {
                // Procesar los datos del archivo Excel
                const processedData = processExcelData(result.data);
                periodsData = processedData;
                console.log('[loadPlanDataFromExcel] Datos procesados exitosamente. PeriodsData:', periodsData);
                renderTree();
                renderGantt();
                updateKPIs();
            } else {
                console.log('[loadPlanDataFromExcel] Falló la lectura del archivo Excel, usando datos por defecto');
                initializeDefaultData();
            }
        } else {
            console.log('[loadPlanDataFromExcel] Falló la búsqueda de la ruta del submódulo, usando datos por defecto');
            initializeDefaultData();
        }
    } catch (error) {
        console.error('Error al cargar datos del plan de trabajo:', error);
        console.log('[loadPlanDataFromExcel] Error capturado, usando datos por defecto');
        initializeDefaultData();
    }
}

// Función para encontrar archivos Excel en un directorio
async function findExcelFilesInDirectory(dirPath) {
    try {
        // Enviar solicitud al proceso principal para leer el directorio
        const result = await callParentAPI('read-directory', { directoryPath: dirPath });

        if (result.success) {
            const excelExtensions = ['.xls', '.xlsx', '.xlsm'];
            const excelFiles = [];

            result.contents.forEach(item => {
                if (item.type === 'file') {
                    const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
                    if (excelExtensions.includes(ext)) {
                        excelFiles.push({ name: item.name, path: item.path });
                    }
                }
            });

            return excelFiles;
        } else {
            console.error('Error al leer directorio:', result.error);
            return [];
        }
    } catch (error) {
        console.error('Error al buscar archivos Excel en directorio:', error);
        return [];
    }
}

// Función para procesar datos desde un archivo Excel
function processExcelData(excelBuffer) {
    try {
        // En una implementación real, usaríamos una librería como xlsx para procesar el buffer
        // Por ahora, devolvemos una estructura vacía que será rellenada con datos por defecto
        console.log('[processExcelData] Procesando datos desde buffer Excel...');

        // Simular la lectura y procesamiento del archivo Excel
        // En la implementación real, esto usaría xlsx o similar para leer el buffer
        const processedData = {};

        // Por defecto, crear estructura para cada año
        for (let year = 2024; year <= 2026; year++) {
            processedData[year] = [];
        }

        return processedData;
    } catch (error) {
        console.error('Error al procesar datos del Excel:', error);
        // Devolver estructura vacía en caso de error
        return {
            2024: [],
            2025: [],
            2026: []
        };
    }
}

// Inicializar datos por defecto
function initializeDefaultData() {
    console.log('[initializeDefaultData] Inicializando datos por defecto...');
    periodsData = {
        2024: [
            { id: 1, name: "MEDICINA PREVENTIVA 2024", level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' },
            { id: 2, name: "Revisión procedimiento...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['C','C',''] },
            { id: 3, name: "SVE - COVID 2024", level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' },
            { id: 4, name: "Capacitaciones...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['C','C',''] }
        ],
        2025: [
            { id: 101, name: "MEDICINA PREVENTIVA Y DEL TRABAJO", level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' },
            { id: 102, name: "Revisión y actualización procedimiento...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['', 'C', '', 'C', '', ''] },
            { id: 103, name: "Actualización de formatos medicina...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['', '', 'C', '', '', ''] },
            { id: 104, name: "SVE - Desorden Musculo Esqueletico", level: 1, type: 'header', expanded: false, months: [], responsible: 'Profesional SST' },
            { id: 105, name: "Planear", level: 3, type: 'subtitle', months: [], responsible: 'Profesional SST' },
            { id: 106, name: "Revisión resultados exámenes...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['C', 'C', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'] },
            { id: 107, name: "Análisis estadísticas...", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['C', 'C', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'] },
            { id: 108, name: "SVE - Covid", level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' },
            { id: 109, name: "Capacitaciones en Bioseguridad", level: 4, type: 'activity', responsible: 'Profesional SST', months: ['C', 'C', 'P', '', '', '', '', 'P', 'P', '', '', ''] }
        ],
        2026: []
    };

    console.log('[initializeDefaultData] Datos por defecto establecidos. periodsData:', periodsData);

    // Mostrar el selector de periodos inicialmente para que el usuario pueda elegir
    setTimeout(() => {
        console.log('[initializeDefaultData] Mostrando selector de periodos...');
        renderPeriodSelector();
        document.getElementById('periodSelector').style.display = 'flex';
        console.log('[initializeDefaultData] Selector de periodos mostrado');
    }, 100); // Pequeño retraso para asegurar que el DOM esté listo

    renderTree();
    renderGantt();
    updateKPIs();
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LÓGICA DE VISIBILIDAD (SYNC TREE/GANTT)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function isItemVisible(item, index, data) {
    if (item.level <= 1) return true; // Headers raíz siempre visibles

    // Buscar el padre inmediatamente superior en nivel
    for(let i=index-1; i>=0; i--) {
        if(data[i].level < item.level) {
            return data[i].expanded; // Si el padre no está expandido, soy invisible
        }
    }
    return true;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INICIALIZACIÓN & RESIZER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function initResizer() {
    const resizer = document.getElementById('dragMe');
    if (!resizer) return;

    const leftSide = document.getElementById('leftPanel');
    const rightSide = resizer.nextElementSibling;

    let x = 0, leftWidth = 0;

    const mouseDownHandler = function(e) {
        x = e.clientX;
        const rect = leftSide.getBoundingClientRect();
        leftWidth = rect.width;

        resizer.classList.add('resizing');
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        const dx = e.clientX - x;
        const newWidth = (leftWidth + dx) + "px";
        leftSide.style.width = newWidth;
    };

    const mouseUpHandler = function() {
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
}

/* --- PERIOD SELECTOR --- */
function renderPeriodSelector() {
    const grid = document.getElementById('periodGrid');
    if (!grid) return;

    grid.innerHTML = '';
    const years = Object.keys(periodsData).sort();

    years.forEach(year => {
        const btn = document.createElement('div');
        btn.className = 'year-btn';
        btn.innerText = year;
        btn.onclick = () => selectPeriod(year);
        grid.appendChild(btn);
    });
}

function selectPeriod(year) {
    currentPeriod = year;
    document.getElementById('periodSelector').style.display = 'none';
    document.getElementById('currentPeriodLabel').innerText = year;

    if(!periodsData[year] || periodsData[year].length === 0) {
        periodsData[year] = [
            { id: Date.now(), name: `PLAN ANUAL ${year}`, level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' }
        ];
    }

    renderTree();
    renderGantt();
    updateKPIs();

    document.getElementById('inspectorContent').innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin-top: 2rem;">
            <i class="fas fa-mouse-pointer" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>Seleccione una actividad.</p>
        </div>
    `;
}

function showPeriodSelector() {
    document.getElementById('periodSelector').style.display = 'flex';
}

function clonePeriod() {
    if(!periodsData[currentPeriod]) return;

    const nextYear = parseInt(currentPeriod) + 1;
    const newData = JSON.parse(JSON.stringify(periodsData[currentPeriod]));

    newData.forEach(item => {
        item.id = Date.now() + Math.random();
        item.months = new Array(12).fill('');
    });

    periodsData[nextYear] = newData;

    renderPeriodSelector();
    alert(`Plan clonado exitosamente al año ${nextYear}.`);
}

/* --- 1. RENDER TREE --- */
function renderTree() {
    const container = document.getElementById('treeContainer');
    if (!container) return;

    container.innerHTML = '';
    const data = periodsData[currentPeriod];

    data.forEach((item, index) => {
        if(!isItemVisible(item, index, data)) return;

        const el = document.createElement('div');
        el.className = 'tree-node';

        if(item.level === 1) el.classList.add('is-header');
        if(item.level === 2) el.classList.add('is-sec-header');
        if(item.level === 3) el.classList.add('is-subtitle');
        if(item.level === 4) el.classList.add('is-activity');
        if(selectedActivityId === item.id) el.classList.add('active');

        el.style.paddingLeft = `${item.level * 1.5}rem`;

        let iconHtml = '';
        if(item.level === 1 || item.level === 2) {
            iconHtml = `<i class="fas ${item.expanded ? 'fa-chevron-down' : 'fa-chevron-right'}" onclick="toggleExpand(${item.id}, event)"></i> <i class="fas fa-folder"></i>`;
        } else if (item.level === 3) {
            iconHtml = `<i class="fas fa-bullseye"></i>`;
        } else {
            iconHtml = `<i class="fas fa-tasks"></i>`;
        }

        el.innerHTML = `${iconHtml} ${item.name}`;

        if(item.type === 'activity') {
            el.onclick = (e) => { e.stopPropagation(); selectActivity(item.id); };
        } else if (item.level === 1 || item.level === 2) {
            el.onclick = (e) => { toggleExpand(item.id, e); }
        }

        container.appendChild(el);
    });
}

function toggleExpand(id, event) {
    if(event) event.stopPropagation();
    const item = periodsData[currentPeriod].find(i => i.id === id);
    if(item) {
        item.expanded = !item.expanded;
        renderTree();
        renderGantt(); // IMPORTANTE: Re-renderizar Gantt para ocultar filas
    }
}

/* --- 2. RENDER GANTT (SIN COLUMNA NOMBRES + SYNC) --- */
function renderGantt() {
    const rowsContainer = document.getElementById('ganttRows');
    if (!rowsContainer) return;

    rowsContainer.innerHTML = '';
    const data = periodsData[currentPeriod];

    data.forEach((item, index) => {
        // USAR MISMA LÓGICA DE VISIBILIDAD QUE EL ÁRBOL
        if(!isItemVisible(item, index, data)) return;

        // Renderizar Fila
        for(let m=0; m<12; m++) {
            const cell = document.createElement('div');
            cell.className = 'gantt-month-col';

            // Celdas de cabecera de grupo (Nivel 1) se marcan visualmente
            if(item.level === 1) {
                 cell.style.backgroundColor = '#f8f9fa';
            } else if (item.level === 3) {
                 cell.style.backgroundColor = '#fcfcfc';
            }

            if(item.type === 'activity') {
                cell.id = `cell_${item.id}_${m}`;
                const status = item.months[m];

                if(status) {
                    const bar = document.createElement('div');
                    bar.className = `gantt-bar bar-${status === 'C' ? 'ejecutado' : 'programado'}`;
                    bar.innerText = status;
                    bar.onclick = () => selectActivity(item.id);
                    cell.appendChild(bar);
                }

                // CORRECCIÓN BUG: Eliminado el else if que ponía borde azul
            }

            rowsContainer.appendChild(cell);
        }
    });
}

function syncScrolling() {
    const headerScroll = document.getElementById('ganttHeaderScroll');
    const bodyScroll = document.getElementById('ganttBodyScroll');
    if (headerScroll && bodyScroll) {
        headerScroll.addEventListener('scroll', () => { bodyScroll.scrollLeft = headerScroll.scrollLeft; });
        bodyScroll.addEventListener('scroll', () => { headerScroll.scrollLeft = bodyScroll.scrollLeft; });
    }
}

/* --- 3. SELECTION & INSPECTOR (CRUD) --- */
function selectActivity(id) {
    selectedActivityId = id;
    renderTree();
    renderGantt();

    const activity = periodsData[currentPeriod].find(i => i.id === id);
    if(!activity) return;

    const monthsNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const activeMonths = activity.months.map((val, idx) => val ? idx : -1).filter(idx => idx !== -1);
    const periodString = activeMonths.length > 0 ? activeMonths.map(idx => monthsNames[idx]).join(', ') : "Sin programar";

    const inspector = document.getElementById('inspectorContent');
    inspector.innerHTML = `
        <div class="detail-header">
            <span style="font-size: 0.8rem; color: #888;">ACTIVIDAD ID: ${id}</span>
            <h3>${activity.name}</h3>
        </div>

        <div class="form-group">
            <label>Responsable</label>
            <select class="form-control" id="responsibleSelect">
                <option value="${activity.responsible || ''}">${activity.responsible || 'Sin asignar'}</option>
                <option value="Profesional SST">Profesional SST</option>
                <option value="Coordinador SST">Coordinador SST</option>
                <option value="Jefe de Seguridad">Jefe de Seguridad</option>
                <option value="Encargado Ambiental">Encargado Ambiental</option>
            </select>
        </div>

        <div class="form-group">
            <label>Periodo (Visualizado)</label>
            <div style="font-size: 0.9rem; font-weight: 600; color: var(--primary); padding: 0.5rem; background: var(--primary-light); border-radius: 4px;">
                ${periodString}
            </div>
        </div>

        <div class="form-group">
            <label>Estado por Mes (Click para editar)</label>
            <div class="months-editor-grid">
                ${activity.months.map((val, idx) => {
                    let className = 'empty';
                    if(val === 'P') className = 'p';
                    if(val === 'C') className = 'c';
                    return `<div class="month-check ${className}" onclick="toggleMonthStatus(${id}, ${idx})">${monthsNames[idx]}<br><span style="font-size:0.7rem">${val||'-'}</span></div>`
                }).join('')}
            </div>
        </div>

        <div class="form-group">
            <label>Evidencias</label>
            <button class="evidence-btn" onclick="openEvidenceFolder('${activity.name.replace(/'/g, String.fromCharCode(92) + "'")}', ${id})">
                <i class="fas fa-folder-open"></i> Abrir Carpeta de Evidencias
            </button>
        </div>

        <div class="form-group">
            <label>Observaciones</label>
            <textarea class="form-control" id="observationsText" placeholder="Agregar observaciones...">${activity.observations || ''}</textarea>
        </div>

        <button class="delete-btn" onclick="openDeleteModal(${id})">
            <i class="fas fa-trash"></i> Eliminar Actividad
        </button>
    `;

    // Agregar evento para guardar cambios en responsable
    document.getElementById('responsibleSelect').addEventListener('change', function() {
        activity.responsible = this.value;
    });

    // Agregar evento para guardar observaciones
    document.getElementById('observationsText').addEventListener('blur', function() {
        activity.observations = this.value;
    });
}

function toggleMonthStatus(actId, monthIdx) {
    const idx = periodsData[currentPeriod].findIndex(i => i.id === actId);
    if(idx === -1) return;

    const currentVal = periodsData[currentPeriod][idx].months[monthIdx];
    let newVal = '';
    if(currentVal === '') newVal = 'P';
    else if(currentVal === 'P') newVal = 'C';

    periodsData[currentPeriod][idx].months[monthIdx] = newVal;
    selectActivity(actId);
    updateKPIs();
}

function openEvidenceFolder(activityName, activityId) {
    // En la implementación real, esto abriría la carpeta de evidencias
    alert(`Abriendo carpeta de evidencias para: ${activityName}\nID: ${activityId}`);
}

/* --- 4. MODALS: CREAR & ELIMINAR --- */
function openCreateModal() {
    const modal = document.getElementById('createModal');
    const select = document.getElementById('newActParent');
    if (!select) return;

    select.innerHTML = '';

    periodsData[currentPeriod].forEach(item => {
        if(item.level === 1 || item.level === 2) {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.innerText = item.name;
            select.appendChild(opt);
        }
    });

    modal.classList.add('open');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('open');
    document.getElementById('newActName').value = '';
    document.getElementById('newActResp').value = '';
}

function saveNewActivity() {
    const name = document.getElementById('newActName').value;
    const parentId = parseInt(document.getElementById('newActParent').value);
    const resp = document.getElementById('newActResp').value;

    if(!name) {
        alert("Ingrese un nombre");
        return;
    }

    const parentIndex = periodsData[currentPeriod].findIndex(i => i.id === parentId);
    if(parentIndex === -1) {
        alert("Padre no encontrado");
        return;
    }

    const newAct = {
        id: Date.now(),
        name: name,
        level: 4,
        type: 'activity',
        responsible: resp,
        months: new Array(12).fill(''),
        observations: ''
    };

    periodsData[currentPeriod].splice(parentIndex + 1, 0, newAct);

    closeCreateModal();
    renderTree();
    renderGantt();
    updateKPIs();
    alert("Actividad creada exitosamente.");
}

function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('open');
    deleteTargetId = null;
}

function confirmDelete() {
    if(!deleteTargetId) return;

    periodsData[currentPeriod] = periodsData[currentPeriod].filter(i => i.id !== deleteTargetId);

    closeDeleteModal();
    selectedActivityId = null;

    document.getElementById('inspectorContent').innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin-top: 2rem;">
            <i class="fas fa-mouse-pointer" style="font-size: 2rem; margin-bottom: 10px;"></i>
            <p>Seleccione una actividad.</p>
        </div>
    `;
    renderTree();
    renderGantt();
    updateKPIs();
}

/* --- UTILS --- */
function switchMainView(view) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`button[onclick="switchMainView('${view}')"]`).classList.add('active');
    document.getElementById('view-dashboard').classList.remove('active');
    document.getElementById('view-plan').classList.remove('active');
    document.getElementById(`view-${view}`).classList.add('active');
}

// Actualizar KPIs
function updateKPIs() {
    const data = periodsData[currentPeriod];
    const activities = data.filter(item => item.type === 'activity');

    // Total de actividades
    document.getElementById('kpiTotal').textContent = activities.length;

    // Calcular avance general
    let totalMonths = 0;
    let completedMonths = 0;
    let scheduledCount = 0;
    let overdueCount = 0; // En este contexto, podríamos considerar como vencidas las que están programadas pero no completadas

    activities.forEach(activity => {
        activity.months.forEach(month => {
            if (month) {
                totalMonths++;
                if (month === 'C') {
                    completedMonths++;
                } else if (month === 'P') {
                    scheduledCount++;
                }
            }
        });
    });

    const progressPercentage = totalMonths > 0 ? Math.round((completedMonths / totalMonths) * 100) : 0;
    document.getElementById('kpiProgress').textContent = `${progressPercentage}%`;
    document.getElementById('kpiScheduled').textContent = scheduledCount;

    // Para calcular vencidas, necesitamos lógica adicional basada en fechas
    // Por ahora, simplemente mostramos 0
    document.getElementById('kpiOverdue').textContent = '0';
}

// Cargar datos iniciales
function loadInitialData() {
    // Esta función se llama después de que se haya establecido la comunicación con el padre
    // y se hayan obtenido los parámetros de la URL
    console.log('Cargando datos iniciales para el plan de trabajo...');

    // Iniciar la sincronización de scroll
    setTimeout(syncScrolling, 100);
}

// Funciones de utilidad para comunicación con el módulo principal
function showLoading() {
    document.getElementById('loadingDiv')?.style.display = 'flex';
    document.getElementById('viewerContainer')?.style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingDiv')?.style.display = 'none';
}

function showNotification(message, type = 'success') {
    // Implementar notificación si es necesario
    console.log(`[plan-viewer.js] Notificación (${type}):`, message);
}

async function downloadDocument() {
    // Implementar descarga de documentos si es necesario
    console.log('Descargando documento...');
}

function applyZoom() {
    // Implementar zoom si es necesario
    console.log('Aplicando zoom...');
}

function applyOrientation() {
    // Implementar orientación si es necesario
    console.log('Aplicando orientación...');
}

function printDocument() {
    // Implementar impresión si es necesario
    console.log('Imprimiendo documento...');
}

// Exponer funciones globales para que puedan ser llamadas desde HTML
window.switchMainView = switchMainView;
window.toggleExpand = toggleExpand;
window.selectActivity = selectActivity;
window.toggleMonthStatus = toggleMonthStatus;
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.saveNewActivity = saveNewActivity;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
window.showPeriodSelector = showPeriodSelector;
window.selectPeriod = selectPeriod;
window.clonePeriod = clonePeriod;

// Marca de tiempo para forzar recarga del archivo
// Última actualización: 2026-01-19T16:20:00