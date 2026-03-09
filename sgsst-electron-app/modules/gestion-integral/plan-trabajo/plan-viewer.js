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
let currentPeriod = null; // Se establecerá al seleccionar en el modal
let selectedActivityId = null;
let deleteTargetId = null;
let periodsData = {};
let availableFilesMap = {}; // Mapa de { año: nombreArchivo }
let currentCompany = null;
let currentSubmodulePath = null;

// --- START: Refactored Communication Logic ---

/**
 * Helper function to communicate with the parent window via postMessage.
 * This abstracts the request-response logic for calling Electron APIs from the iframe.
 * @param {string} type - The type of the request (e.g., 'find-submodule-path').
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
    document.getElementById('companyName').textContent = currentCompany;

    // Iniciar detección de archivos disponibles
    detectAvailablePeriods();
}

// NUEVA FUNCIÓN: Detectar períodos basados en los archivos reales
async function detectAvailablePeriods() {
    console.log('[detectAvailablePeriods] Escaneando archivos disponibles...');
    try {
        const submoduleResult = await callParentAPI('find-submodule-path', {
            company: currentCompany,
            module: 'Gestión Integral',
            submodule: '2.4.1 Plan de Trabajo Anual'
        });

        if (submoduleResult.success) {
            currentSubmodulePath = submoduleResult.path;
            const excelFiles = await findExcelFilesInDirectory(currentSubmodulePath);

            availableFilesMap = {};
            excelFiles.forEach(file => {
                // Intentar extraer el año (4 dígitos que empiecen por 20)
                const yearMatch = file.name.match(/20\d{2}/);
                if (yearMatch) {
                    const year = yearMatch[0];
                    availableFilesMap[year] = file.name;
                }
            });

            let foundYears = Object.keys(availableFilesMap);
            console.log('[detectAvailablePeriods] Años detectados en archivos:', foundYears);

            // Si no hay años detectados, ofrecemos el año actual y el anterior como opciones base
            if (foundYears.length === 0) {
                console.warn('[detectAvailablePeriods] No se detectaron años. Ofreciendo años por defecto.');
                const currentYear = new Date().getFullYear();
                foundYears = [currentYear.toString(), (currentYear - 1).toString()];
            }

            renderPeriodSelector(foundYears);
            document.getElementById('periodSelector').style.display = 'flex';
        }
    } catch (error) {
        console.error('Error al detectar períodos:', error);
        initializeDefaultData();
    }
}

// Función para encontrar archivos Excel en un directorio
async function findExcelFilesInDirectory(dirPath) {
    try {
        const result = await callParentAPI('get-documents-in-folder', dirPath);
        if (result.success) {
            const excelExtensions = ['.xls', '.xlsx', '.xlsm'];
            const excelFiles = [];
            if (result.files && Array.isArray(result.files)) {
                result.files.forEach(item => {
                    const ext = item.name.substring(item.name.lastIndexOf('.')).toLowerCase();
                    if (excelExtensions.includes(ext)) {
                        excelFiles.push({ name: item.name, path: item.path });
                    }
                });
            }
            return excelFiles;
        }
        return [];
    } catch (error) {
        return [];
    }
}

// Modificar renderPeriodSelector para usar los años detectados
function renderPeriodSelector(years) {
    const grid = document.getElementById('periodGrid');
    if (!grid) return;

    grid.innerHTML = '';
    // Ordenar años de mayor a menor
    const sortedYears = (years || Object.keys(availableFilesMap)).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const btn = document.createElement('div');
        btn.className = 'year-btn';
        btn.innerHTML = `<i class="fas fa-file-excel" style="margin-bottom: 8px; display: block; font-size: 1.2rem; color: #217346;"></i> ${year}`;
        btn.onclick = () => selectPeriod(year);
        grid.appendChild(btn);
    });
}

// Al seleccionar el período, cargar EL ARCHIVO correspondiente
async function selectPeriod(year) {
    console.log(`[selectPeriod] Año seleccionado: ${year}`);
    currentPeriod = year;
    document.getElementById('periodSelector').style.display = 'none';
    document.getElementById('currentPeriodLabel').innerText = year;

    const fileName = availableFilesMap[year];
    if (fileName) {
        await loadSpecificYearFile(fileName);
    } else {
        // Fallback si no hay archivo (clonación o nuevo)
        periodsData[year] = [
            { id: Date.now(), name: `PLAN ANUAL ${year}`, level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' }
        ];
        renderTree();
        renderGantt();
        updateKPIs();
    }
}

// Cargar un archivo específico seleccionado por el usuario
async function loadSpecificYearFile(fileName) {
    showLoading();
    try {
        const filePathResult = await callParentAPI('get-file-path', {
            directory: currentSubmodulePath,
            fileName: fileName
        });

        if (filePathResult.success) {
            const result = await callParentAPI('read-excel-file', { filePath: filePathResult.path });
            if (result.success) {
                const processedData = await processExcelData(result.data);
                periodsData = processedData;
                renderTree();
                renderGantt();
                updateKPIs();
            }
        }
    } catch (error) {
        console.error('Error al cargar el archivo del año:', error);
    } finally {
        hideLoading();
    }
}

async function processExcelData(excelBuffer) {
    try {
        if (excelBuffer && excelBuffer.length > 0) {
            const result = await callParentAPI('process-excel-data', {
                buffer: excelBuffer,
                company: currentCompany,
                period: currentPeriod
            });

            if (result.success) {
                const processedData = {};
                // Asegurarnos de que el año seleccionado tenga datos, aunque los otros vengan vacíos
                processedData[currentPeriod] = result.data[currentPeriod] || [];
                // Preservar otros años si existieran en el objeto result.data
                Object.keys(result.data).forEach(y => {
                    if (!processedData[y]) processedData[y] = result.data[y];
                });
                return processedData;
            }
        }
        return { [currentPeriod]: [] };
    } catch (error) {
        return { [currentPeriod]: [] };
    }
}

// Inicializar datos por defecto (solo si falla el escaneo de archivos)
function initializeDefaultData() {
    console.log('[initializeDefaultData] Usando datos por defecto...');
    periodsData = {
        2025: [
            { id: 101, name: "SIN ARCHIVOS DETECTADOS", level: 1, type: 'header', expanded: true, months: [], responsible: 'Sistema' },
            { id: 102, name: "Verifique la carpeta del Plan de Trabajo", level: 4, type: 'activity', responsible: 'Admin', months: [] }
        ]
    };
    renderPeriodSelector(['2025']);
    document.getElementById('periodSelector').style.display = 'flex';
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LÓGICA DE VISIBILIDAD & SYNC
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function isItemVisible(item, index, data) {
    if (item.level <= 1) return true; // Nivel 1 siempre visible

    let currentLevel = item.level;
    // Buscar hacia arriba todos los posibles ancestros
    for (let i = index - 1; i >= 0; i--) {
        if (data[i].level < currentLevel) {
            // Si el ancestro no está expandido, el item es invisible
            if (!data[i].expanded) return false;
            // Continuar subiendo en la jerarquía (ej: de Nivel 3 a Nivel 2, de Nivel 2 a Nivel 1)
            currentLevel = data[i].level;
            if (currentLevel <= 1) break;
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

// Modificar renderPeriodSelector para usar los años detectados
function renderPeriodSelector(years) {
    const grid = document.getElementById('periodGrid');
    if (!grid) return;

    grid.innerHTML = '';
    // Ordenar años de mayor a menor
    const sortedYears = (years || Object.keys(availableFilesMap)).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        const btn = document.createElement('div');
        btn.className = 'year-btn';
        btn.innerHTML = `<i class="fas fa-file-excel" style="margin-bottom: 8px; display: block; font-size: 1.2rem; color: #217346;"></i> ${year}`;
        btn.onclick = () => selectPeriod(year);
        grid.appendChild(btn);
    });
}

// Al seleccionar el período, cargar EL ARCHIVO correspondiente
async function selectPeriod(year) {
    console.log(`[selectPeriod] Año seleccionado: ${year}`);
    currentPeriod = year;
    document.getElementById('periodSelector').style.display = 'none';
    document.getElementById('currentPeriodLabel').innerText = year;

    const fileName = availableFilesMap[year];
    if (fileName) {
        await loadSpecificYearFile(fileName);
    } else {
        // Fallback si no hay archivo (clonación o nuevo)
        periodsData[year] = [
            { id: Date.now(), name: `PLAN ANUAL ${year}`, level: 1, type: 'header', expanded: true, months: [], responsible: 'Profesional SST' }
        ];
        renderTree();
        renderGantt();
        updateKPIs();
    }
}

// Cargar un archivo específico seleccionado por el usuario
async function loadSpecificYearFile(fileName) {
    showLoading();
    try {
        const filePathResult = await callParentAPI('get-file-path', {
            directory: currentSubmodulePath,
            fileName: fileName
        });

        if (filePathResult.success) {
            const result = await callParentAPI('read-excel-file', { filePath: filePathResult.path });
            if (result.success) {
                const processedData = await processExcelData(result.data);
                periodsData = processedData;
                renderTree();
                renderGantt();
                updateKPIs();
            }
        }
    } catch (error) {
        console.error('Error al cargar el archivo del año:', error);
    } finally {
        hideLoading();
    }
}

function showPeriodSelector() {
    document.getElementById('periodSelector').style.display = 'flex';
}

async function clonePeriod() {
    console.log('[clonePeriod] Iniciando proceso de clonación independiente...');

    const availableYears = Object.keys(availableFilesMap);

    if (availableYears.length === 0) {
        alert("No se encontraron planes existentes para clonar. Por favor, asegúrese de tener al menos un archivo Excel en la carpeta.");
        return;
    }

    // 1. Seleccionar el año ORIGEN
    let sourceYear = currentPeriod;

    if (availableYears.length > 1) {
        // Si hay múltiples años, usamos el actual seleccionado o el último disponible
        sourceYear = currentPeriod || availableYears[availableYears.length - 1];
    } else {
        // Si solo hay uno, lo usamos automáticamente
        sourceYear = availableYears[0];
        console.log(`[clonePeriod] Solo un año disponible (${sourceYear}), usándolo como origen.`);
    }

    // 2. Calcular el año DESTINO automáticamente (Estilo Módulo Presupuesto 1.1.3)
    // Evitamos usar prompt() porque puede fallar en Electron/Iframes
    const newYear = parseInt(sourceYear) + 1;

    if (availableFilesMap[newYear]) {
        alert(`Ya existe un archivo para el año ${newYear}. No se puede duplicar sobre uno existente.`);
        return;
    }

    const confirmMessage = `¿Desea crear un nuevo Plan de Trabajo para el año ${newYear} basado en el plan del ${sourceYear}?`;

    if (!confirm(confirmMessage)) return;

    const sourceFileName = availableFilesMap[sourceYear];
    console.log(`[clonePeriod] Clonando archivo: ${sourceFileName} (Origen: ${sourceYear}) -> Destino: ${newYear}`);

    try {
        const sourcePathResult = await callParentAPI('get-file-path', {
            directory: currentSubmodulePath,
            fileName: sourceFileName
        });

        if (!sourcePathResult.success) throw new Error("No se pudo encontrar la ruta del archivo origen.");

        showLoading();

        const cloneResult = await callParentAPI('duplicate-budget-file', {
            currentFilePath: sourcePathResult.path,
            newYear: newYear
        });

        if (cloneResult.success) {
            alert(`¡Éxito! El plan ha sido clonado para el año ${newYear}.\nSe ha creado el archivo: ${cloneResult.newFileName}`);

            // Refrescar la lista de periodos inmediatamente
            await detectAvailablePeriods();

            // Forzar que el modal se mantenga abierto para que el usuario vea el nuevo botón
            document.getElementById('periodSelector').style.display = 'flex';
        } else {
            alert("Error al clonar el archivo: " + cloneResult.error);
        }
    } catch (error) {
        console.error("[clonePeriod] Error crítico:", error);
        alert("Ocurrió un error inesperado: " + error.message);
    } finally {
        hideLoading();
    }
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

        // Renderizar fila completa (12 meses) como un grupo
        for(let m=0; m<12; m++) {
            const cell = document.createElement('div');
            cell.className = 'gantt-month-col';

            // Resaltar fila si es la actividad seleccionada
            if (selectedActivityId === item.id) {
                cell.classList.add('selected');
            }

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
            }

            rowsContainer.appendChild(cell);
        }
    });
}

function syncScrolling() {
    const headerScroll = document.getElementById('ganttHeaderScroll');
    const bodyScroll = document.getElementById('ganttBodyScroll');
    const treeContainer = document.getElementById('treeContainer');

    if (headerScroll && bodyScroll) {
        // Sincronización horizontal entre header y body del Gantt
        headerScroll.addEventListener('scroll', () => { bodyScroll.scrollLeft = headerScroll.scrollLeft; });
        bodyScroll.addEventListener('scroll', () => { headerScroll.scrollLeft = bodyScroll.scrollLeft; });
    }

    if (treeContainer && bodyScroll) {
        // Sincronización vertical entre árbol de actividades y cronograma
        treeContainer.addEventListener('scroll', () => { bodyScroll.scrollTop = treeContainer.scrollTop; });
        bodyScroll.addEventListener('scroll', () => { treeContainer.scrollTop = bodyScroll.scrollTop; });
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
    else newVal = '';

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

// Variables para almacenar instancias de gráficos
let chartStatus = null;
let chartMonthlyProgress = null;
let chartByResponsible = null;
let chartMonthlyStatus = null;

// Configuración global de Chart.js para aplicar el estilo K+AIR
Chart.defaults.font.family = "'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif";
Chart.defaults.color = '#6c757d'; // Texto secundario para etiquetas de ejes

// Colores del sistema K+AIR
const K_COLORS = {
    primary: '#174ea6',
    primaryTransparent: 'rgba(23, 78, 166, 0.1)',
    success: '#28a745',
    warning: '#ffc107',
    danger: '#dc3545',
    info: '#17a2b8',
    gray: '#e9ecef', // Para grids
    text: '#212529'
};

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

    // Actualizar gráficos
    updateCharts();
}

// Función para actualizar los gráficos
function updateCharts() {
    if (currentPeriod && periodsData[currentPeriod]) {
        renderChartStatus();
        renderChartMonthlyProgress();
        renderChartByResponsible();
        renderChartMonthlyStatus();
    }
}

// Gráfico: Actividades por Estado
function renderChartStatus() {
    const ctx = document.getElementById('chartStatus').getContext('2d');

    // Destruir instancia anterior si existe
    if (chartStatus) {
        chartStatus.destroy();
    }

    const data = periodsData[currentPeriod];
    const activities = data.filter(item => item.type === 'activity');

    // Contar actividades por estado
    let plannedCount = 0;
    let completedCount = 0;
    let notStartedCount = 0; // Actividades sin estado definido

    activities.forEach(activity => {
        let hasStatus = false;
        activity.months.forEach(month => {
            if (month === 'P') {
                plannedCount++;
                hasStatus = true;
            }
            else if (month === 'C') {
                completedCount++;
                hasStatus = true;
            }
        });
        if (!hasStatus) {
            notStartedCount++; // Contar actividades sin meses programados
        }
    });

    chartStatus = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Sin Iniciar', 'Planificadas', 'Ejecutadas'],
            datasets: [{
                label: 'Cantidad',
                data: [notStartedCount, plannedCount, completedCount],
                backgroundColor: [
                    '#e2e3e5', // Gris suave para neutros
                    K_COLORS.warning,
                    K_COLORS.success
                ],
                borderRadius: 4, // Bordes redondeados en barras
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#333',
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Gráfico: Avance Mensual
function renderChartMonthlyProgress() {
    const ctx = document.getElementById('chartMonthlyProgress').getContext('2d');

    // Destruir instancia anterior si existe
    if (chartMonthlyProgress) {
        chartMonthlyProgress.destroy();
    }

    const data = periodsData[currentPeriod];
    const activities = data.filter(item => item.type === 'activity');

    // Contar actividades completadas por mes
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const completedPerMonth = new Array(12).fill(0);
    const totalPerMonth = new Array(12).fill(0);

    activities.forEach(activity => {
        activity.months.forEach((month, index) => {
            if (month) {
                totalPerMonth[index]++;
                if (month === 'C') {
                    completedPerMonth[index]++;
                }
            }
        });
    });

    // Calcular porcentaje de avance por mes
    const progressPercentage = completedPerMonth.map((completed, idx) => {
        return totalPerMonth[idx] > 0 ? Math.round((completed / totalPerMonth[idx]) * 100) : 0;
    });

    // Crear gradiente para el relleno
    const gradientProgress = ctx.createLinearGradient(0, 0, 0, 300);
    gradientProgress.addColorStop(0, K_COLORS.primaryTransparent);
    gradientProgress.addColorStop(1, 'rgba(255,255,255,0)');

    chartMonthlyProgress = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Avance Mensual (%)',
                data: progressPercentage,
                borderColor: K_COLORS.primary,
                backgroundColor: gradientProgress,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: K_COLORS.primary,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.3 // Curvas suaves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#fff',
                    titleColor: K_COLORS.text,
                    bodyColor: K_COLORS.text,
                    borderColor: '#dee2e6',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y}% Completado`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: K_COLORS.gray,
                        borderDash: [5, 5] // Grid punteada sutil
                    },
                    ticks: {
                        callback: (value) => value + '%'
                    }
                },
                x: {
                    grid: { display: false } // Ocultar grid vertical para limpieza
                }
            }
        }
    });
}

// Gráfico: Distribución por Responsable
function renderChartByResponsible() {
    const ctx = document.getElementById('chartByResponsible').getContext('2d');

    // Destruir instancia anterior si existe
    if (chartByResponsible) {
        chartByResponsible.destroy();
    }

    const data = periodsData[currentPeriod];
    const activities = data.filter(item => item.type === 'activity');

    // Agrupar actividades por responsable
    const responsibleCount = {};

    activities.forEach(activity => {
        const responsible = activity.responsible || 'Sin Asignar';
        responsibleCount[responsible] = (responsibleCount[responsible] || 0) + 1;
    });

    const labels = Object.keys(responsibleCount);
    const values = Object.values(responsibleCount);

    // Generar paleta basada en el color primario y variaciones
    const bgColors = labels.map((_, i) => {
        const hues = [210, 150, 40, 340, 180]; // Azul, Verde, Naranja, Rojo, Cyan
        const hue = hues[i % hues.length];
        return `hsl(${hue}, 70%, 50%)`;
    });

    chartByResponsible = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: bgColors,
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%', // Más fino para estilo moderno
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

// Gráfico: Actividades por Mes y Estado
function renderChartMonthlyStatus() {
    const ctx = document.getElementById('chartMonthlyStatus').getContext('2d');

    // Destruir instancia anterior si existe
    if (chartMonthlyStatus) {
        chartMonthlyStatus.destroy();
    }

    const data = periodsData[currentPeriod];
    const activities = data.filter(item => item.type === 'activity');

    // Contar actividades por mes y estado
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const plannedPerMonth = new Array(12).fill(0);
    const completedPerMonth = new Array(12).fill(0);

    activities.forEach(activity => {
        activity.months.forEach((month, index) => {
            if (month === 'P') {
                plannedPerMonth[index]++;
            } else if (month === 'C') {
                completedPerMonth[index]++;
            }
        });
    });

    chartMonthlyStatus = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Ejecutadas',
                    data: completedPerMonth,
                    backgroundColor: K_COLORS.success,
                    borderRadius: 2,
                },
                {
                    label: 'Planificadas',
                    data: plannedPerMonth,
                    backgroundColor: K_COLORS.warning,
                    borderRadius: 2,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end'
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: {
                        color: K_COLORS.gray,
                        borderDash: [5, 5]
                    },
                    ticks: { precision: 0 }
                }
            }
        }
    });
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
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) loadingDiv.style.display = 'flex';
    const viewerContainer = document.getElementById('viewerContainer');
    if (viewerContainer) viewerContainer.style.display = 'none';
}

function hideLoading() {
    const loadingDiv = document.getElementById('loadingDiv');
    if (loadingDiv) loadingDiv.style.display = 'none';
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