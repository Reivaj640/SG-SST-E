// cap-home.js - Lógica del Portal de Bienvenida Programa de Capacitaciones
// Este script se carga dinámicamente desde capacitaciones-portal-logic.js

// NO usar DOMContentLoaded porque el HTML se carga vía fetch

async function initializePortal() {
    console.log('════════════════════════════════════════');
    console.log('[cap-home] 🚀 initializePortal() INICIADO');
    console.log('════════════════════════════════════════');
    
    // Verificar si el elemento existe
    const yearEl = document.getElementById('activeYear');
    console.log('[cap-home] 📍 Elemento activeYear:', yearEl ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO');
    
    if (!yearEl) {
        console.error('[cap-home] ❌ ERROR: No se encontró el elemento activeYear en el DOM');
        return;
    }
    
    try {
        console.log('[cap-home] 🔄 Llamando a loadActiveYear()...');
        await loadActiveYear();
        console.log('[cap-home] ✅ loadActiveYear() completado');
    } catch (error) {
        console.log('[cap-home] ❌ Error inicializando:', error.message);
        console.error('[cap-home] Stack trace:', error.stack);
        yearEl.textContent = new Date().getFullYear();
        console.log('[cap-home] ⚠️ Año establecido a fallback:', yearEl.textContent);
    }
}

async function loadActiveYear() {
    console.log('────────────────────────────────────────');
    console.log('[cap-home] 📅 loadActiveYear() INICIADO');
    console.log('────────────────────────────────────────');
    
    try {
        if (!window.capPortalComponent) {
            console.log('[cap-home] ⚠️ capPortalComponent no disponible');
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }
        console.log('[cap-home] ✅ capPortalComponent disponible');
        console.log('[cap-home] 🏢 companyName:', window.capPortalComponent.companyName);

        console.log('[cap-home] 📍 Obteniendo ruta del submódulo...');
        const pathResult = await callParentAPI('find-submodule-path', {
            company: window.capPortalComponent.companyName,
            module: 'Recursos',
            submodule: '1.2.1 Programa de capacitación Anual'
        });

        if (!pathResult.success) {
            console.log('[cap-home] ❌ Error obteniendo ruta:', pathResult.error);
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }

        const submodulePath = pathResult.path;
        console.log('[cap-home] ✅ Ruta:', submodulePath);

        console.log('[cap-home] 📂 Leyendo directorio...');
        const filesResult = await callParentAPI('read-directory', { path: submodulePath });
        if (!filesResult.success) {
            console.log('[cap-home] ❌ Error leyendo directorio:', filesResult.error);
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }

        console.log('[cap-home] 📁 Archivos encontrados:', filesResult.files?.length || 0);

        const cronogramaFile = filesResult.files?.find(f => {
            const fileName = typeof f === 'string' ? f : (f.name || f.path || '');
            const fileNameLower = fileName.toLowerCase();
            const isExcel = fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls');
            const isCronograma = fileNameLower.includes('cronograma');
            const isNotTemp = !fileNameLower.startsWith('~$');
            return isCronograma && isExcel && isNotTemp;
        });

        if (!cronogramaFile) {
            console.log('[cap-home] ❌ No se encontró cronograma');
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }

        const cronogramaFileName = typeof cronogramaFile === 'string' ? cronogramaFile : (cronogramaFile.name || cronogramaFile.path);
        const sourcePath = `${submodulePath}/${cronogramaFileName}`;
        console.log('[cap-home] ✅ Archivo:', cronogramaFileName);

        console.log('[cap-home] 📋 Obteniendo hojas...');
        const sheetsResult = await callParentAPI('get-capacitaciones-sheets', {
            filePath: sourcePath
        });

        if (!sheetsResult.success) {
            console.log('[cap-home] ❌ Error leyendo hojas:', sheetsResult?.error);
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }

        const availableSheets = sheetsResult.sheets || [];
        console.log('[cap-home] ✅ Hojas disponibles:', availableSheets);
        console.log('[cap-home] 📊 Total hojas:', availableSheets.length);

        const years = availableSheets
            .map(sheetName => {
                const match = sheetName.match(/\d{4}/);
                const year = match ? parseInt(match[0]) : null;
                console.log(`[cap-home]   📄 "${sheetName}" → ${year}`);
                return year;
            })
            .filter(y => y !== null && !isNaN(y));

        console.log('[cap-home] 📅 Años extraídos:', years);

        if (years.length === 0) {
            console.log('[cap-home] ❌ No se encontraron años');
            const yearEl = document.getElementById('activeYear');
            if (yearEl) yearEl.textContent = new Date().getFullYear();
            return;
        }

        const maxYear = Math.max(...years);
        const currentSystemYear = new Date().getFullYear();
        const displayYear = maxYear > currentSystemYear + 1 ? currentSystemYear : maxYear;

        console.log('[cap-home] 🔢 maxYear:', maxYear);
        console.log('[cap-home] 🔢 currentSystemYear:', currentSystemYear);
        console.log('[cap-home] 🎯 displayYear:', displayYear);

        const yearEl = document.getElementById('activeYear');
        if (yearEl) {
            yearEl.textContent = displayYear;
            console.log('[cap-home] ✅✅✅ Año ESTABLECIDO:', displayYear);
            console.log('[cap-home] 📍 Elemento:', yearEl);
            console.log('[cap-home] 📍 textContent:', yearEl.textContent);
        } else {
            console.log('[cap-home] ❌ ERROR: No se encontró activeYear');
        }

        console.log('────────────────────────────────────────');
        console.log('[cap-home] ✅ loadActiveYear() COMPLETADO');
        console.log('────────────────────────────────────────');

    } catch (error) {
        console.error('[cap-home] ❌ ERROR:', error);
        console.error('[cap-home] Stack:', error.stack);
        const yearEl = document.getElementById('activeYear');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
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
            showNotification(`No se encontró hoja para el año ${activeYear}`, 'warning');
            console.log('[cap-home] Hojas disponibles:', availableSheets.join(', '));
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
            showNotification(`✅ Hoja clonada exitosamente para ${newYear}`, 'success');
            console.log('[cap-home] Nueva hoja creada:', duplicateResult.newSheetName || 'Matriz Cap. ' + newYear);
            loadActiveYear();
        } else {
            showNotification(duplicateResult.error || 'Error al clonar la hoja', 'danger');
        }

    } catch (error) {
        hideLoading();
        console.error('[cap-home] Error clonando cronograma:', error);
        showNotification('Error al clonar el cronograma', 'danger');
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
 * Mostrar notificación toast moderna
 */
function showNotification(message, type = 'info') {
    // Verificar si el contenedor de toasts existe en el portal
    let container = document.getElementById('toastContainer');
    
    // Si no existe, crearlo
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'k-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }
    
    // Colores por tipo
    const colors = {
        success: '#28a745',
        danger: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    // Crear el toast
    const toast = document.createElement('div');
    toast.className = 'k-toast';
    toast.style.cssText = `
        background: white;
        border-left: 4px solid ${colors[type]};
        padding: 1rem 1.5rem;
        border-radius: 0.375rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 300px;
        max-width: 500px;
        animation: slideInRight 0.3s ease;
        transition: all 0.3s ease;
    `;
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 1.25rem;"></i>
        <span style="color: #212529; font-size: 0.9rem; font-weight: 500;">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remover después de 4 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
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
