// cap-home.js - Lógica del Portal de Bienvenida Programa de Capacitaciones
// Este script se carga dinámicamente desde capacitaciones-portal-logic.js

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        // Cargar el año activo
        await loadActiveYear();
    } catch (error) {
        console.log('[cap-home] Error inicializando:', error.message);
        document.getElementById('activeYear').textContent = new Date().getFullYear();
    }
}

async function loadActiveYear() {
    // Usar el año actual o el que esté disponible en el componente padre
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    // Intentar obtener el año del componente padre si está disponible
    if (window.capPortalComponent && window.capPortalComponent.companyName) {
        // El año se mostrará correctamente
        document.getElementById('activeYear').textContent = currentYear;
    } else {
        document.getElementById('activeYear').textContent = currentYear;
    }
}

/**
 * Navegar hacia atrás al módulo principal
 */
function goBackToModule() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

/**
 * Entrar al cronograma de capacitaciones (llamar al componente padre)
 */
function enterCronograma() {
    // Llamar al método del CapacitacionesPortalComponent
    if (window.capPortalComponent) {
        window.capPortalComponent.enterViewer();
    } else {
        alert('Error: No se pudo acceder al cronograma de capacitaciones.');
    }
}

/**
 * Importar desde Excel
 */
function importFromExcel() {
    alert('Función: Importar desde Excel\n\nEsta acción abrirá un selector de archivos para cargar el cronograma de capacitaciones desde una plantilla Excel compatible.');
}

/**
 * Exportar Cronograma
 */
function exportCronograma() {
    const activeYear = document.getElementById('activeYear').textContent;
    alert(`Función: Exportar Cronograma ${activeYear}\n\nSe generará un archivo Excel/PDF con el cronograma de capacitaciones vigente.`);
}

/**
 * Abrir Matriz de Formación
 */
function openMatrizFormacion() {
    alert('Función: Matriz de Formación\n\nEsta acción abrirá el módulo de gestión de matriz de formación por cargos y áreas.');
}

/**
 * Clonar Cronograma
 */
async function cloneCronograma() {
    const activeYear = document.getElementById('activeYear').textContent;
    const confirmClone = confirm(`¿Desea crear un nuevo Cronograma de Capacitaciones para el año ${parseInt(activeYear) + 1} basado en el cronograma de ${activeYear}?`);

    if (!confirmClone) return;

    try {
        showLoading('Clonando cronograma de capacitaciones...');

        // Obtener la ruta del submódulo usando la API correcta
        const pathResult = await callParentAPI('find-submodule-path', {
            company: window.capPortalComponent?.companyName || 'Temposum',
            module: 'Recursos',
            submodule: '1.2.1 Programa de capacitación Anual'
        });
        
        if (!pathResult.success) {
            hideLoading();
            alert('Error al acceder a los archivos: ' + (pathResult.error || 'Error desconocido'));
            return;
        }

        const submodulePath = pathResult.path;
        console.log('[cap-home] Ruta del submódulo:', submodulePath);

        // Buscar el archivo de cronograma de capacitaciones
        const filesResult = await callParentAPI('read-directory', { path: submodulePath });
        if (!filesResult.success) {
            hideLoading();
            alert('Error al leer el directorio.');
            return;
        }

        // Encontrar archivo de cronograma
        const cronogramaFile = filesResult.files?.find(f => {
            // Los archivos pueden ser objetos con propiedad 'name' o 'path'
            const fileName = typeof f === 'string' ? f : (f.name || f.path || '');
            const fileNameLower = fileName.toLowerCase();
            const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
            const isCronograma = fileNameLower.includes('cronograma');
            const isNotTemp = !fileNameLower.startsWith('~$');
            return isCronograma && isExcel && isNotTemp;
        });

        if (!cronogramaFile) {
            hideLoading();
            alert('No se encontró un archivo de cronograma en la carpeta.');
            return;
        }

        // Obtener el nombre del archivo (puede ser objeto o string)
        const cronogramaFileName = typeof cronogramaFile === 'string' ? cronogramaFile : (cronogramaFile.name || cronogramaFile.path);
        const sourcePath = `${submodulePath}/${cronogramaFileName}`;
        console.log('[cap-home] Archivo fuente:', sourcePath);

        // Primero obtener las hojas disponibles
        const sheetsResult = await callParentAPI('get-capacitaciones-sheets', {
            filePath: sourcePath
        });

        if (!sheetsResult.success) {
            hideLoading();
            alert('Error al leer las hojas del archivo: ' + (sheetsResult.error || 'Error desconocido'));
            return;
        }

        const availableSheets = sheetsResult.sheets || [];
        console.log('[cap-home] Hojas disponibles:', availableSheets);

        // Crear nuevo año
        const newYear = parseInt(activeYear) + 1;
        console.log('[cap-home] Clonando hoja para el año:', newYear);

        // Buscar la hoja actual que coincida con el año activo
        // Patrones posibles: "Matriz Cap. 2025", "Matriz Cap 2025", "2025", etc.
        let currentSheetName = availableSheets.find(sheet => 
            sheet.includes('Matriz Cap') && sheet.includes(activeYear.toString())
        ) || availableSheets.find(sheet => 
            sheet.includes(activeYear.toString())
        );

        if (!currentSheetName) {
            hideLoading();
            alert(`No se encontró una hoja para el año ${activeYear}.\n\nHojas disponibles: ${availableSheets.join(', ')}`);
            return;
        }

        console.log('[cap-home] Hoja origen encontrada:', currentSheetName);

        // Usar la función duplicate-capacitaciones-sheet para clonar la hoja
        const duplicateResult = await callParentAPI('duplicate-capacitaciones-sheet', {
            filePath: sourcePath,
            currentSheetName: currentSheetName,
            newYear: newYear.toString()
        });

        hideLoading();

        if (duplicateResult.success) {
            alert(`✅ Hoja clonada exitosamente para el año ${newYear}.\n\nNueva hoja: ${duplicateResult.newSheetName || 'Matriz Cap. ' + newYear}`);
            loadActiveYear();
        } else {
            alert('Error al clonar la hoja: ' + (duplicateResult.error || 'Error desconocido'));
        }

    } catch (error) {
        hideLoading();
        console.error('[cap-home] Error clonando cronograma:', error);
        alert('Error al clonar el cronograma. Por favor intente nuevamente.');
    }
}

/**
 * Abrir Registro de Asistencia
 */
function openRegistroAsistencia() {
    alert('Función: Registro de Asistencia\n\nEsta acción abrirá el módulo de gestión de listas de asistencia y seguimiento de participantes.');
}

/**
 * Generar Informe de Cumplimiento
 */
function generateInformeCumplimiento() {
    const activeYear = document.getElementById('activeYear').textContent;
    alert(`Función: Informe de Cumplimiento\n\nSe generará un resumen ejecutivo en PDF del estado actual del Programa de Capacitaciones ${activeYear}.`);
}

/**
 * Abrir Certificados
 */
function openCertificados() {
    alert('Función: Certificados\n\nEsta acción abrirá el módulo de generación y gestión de certificados de capacitación.');
}

/**
 * Mostrar pantalla de carga
 */
function showLoading(message) {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    overlay.innerHTML = `
        <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: #174ea6; margin-bottom: 1rem;"></i>
        <h2 style="font-family: 'Lexend', sans-serif; color: #212529;">${message}</h2>
        <p style="color: #6c757d;">Por favor espere...</p>
    `;
    document.body.appendChild(overlay);
}

/**
 * Ocultar pantalla de carga
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Comunicarse con API del padre
 */
function callParentAPI(type, payload) {
    return new Promise((resolve, reject) => {
        const requestId = `req-${Date.now()}-${Math.random()}`;
        const requestType = `${type}-request`;
        const responseType = `${type}-response`;

        const handleResponse = (event) => {
            // Aceptar mensajes de file:// y del padre
            if (event.origin !== 'file://' && event.source !== window.parent && event.source !== window) {
                return;
            }

            const response = event.data;
            if (response.type === responseType && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);

                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    reject(new Error(response.payload?.error || 'Unknown error'));
                }
            }
        };

        window.addEventListener('message', handleResponse);

        // Enviar mensaje al padre
        window.parent.postMessage({
            type: requestType,
            payload,
            requestId
        }, '*');
    });
}
