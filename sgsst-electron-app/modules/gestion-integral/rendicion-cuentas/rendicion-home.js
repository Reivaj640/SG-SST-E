// rendicion-home.js - Lógica del Portal de Bienvenida Rendición de Cuentas
// Este script se carga dinámicamente desde rendicion-logic.js

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        // Cargar el periodo activo
        await loadActivePeriod();
        
        // Cargar información adicional
        await loadPortalData();
    } catch (error) {
        console.log('[rendicion-home] Error inicializando:', error.message);
        document.getElementById('activePeriod').textContent = new Date().getFullYear();
    }
}

async function loadActivePeriod() {
    // Intentar detectar el periodo desde los archivos disponibles
    try {
        const periodResult = await detectAvailablePeriods();
        if (periodResult && periodResult.activePeriod) {
            document.getElementById('activePeriod').textContent = periodResult.activePeriod;
        } else {
            document.getElementById('activePeriod').textContent = new Date().getFullYear();
        }
    } catch (error) {
        document.getElementById('activePeriod').textContent = new Date().getFullYear();
    }
}

async function detectAvailablePeriods() {
    return new Promise((resolve) => {
        const requestId = `req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            if (event.origin !== 'file://' && event.source !== window.parent) {
                return;
            }

            const response = event.data;
            if (response.type === `detect-periods-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                resolve(response.payload);
            }
        };

        window.addEventListener('message', handleResponse);

        window.parent.postMessage({
            type: `detect-periods-request`,
            payload: {},
            requestId
        }, 'file://');
    });
}

async function loadPortalData() {
    // Cargar datos del portal (trabajadores, estado, etc.)
    try {
        const requestId = `req-${Date.now()}-${Math.random()}`;

        const handleResponse = (event) => {
            if (event.origin !== 'file://' && event.source !== window.parent) {
                return;
            }

            const response = event.data;
            if (response.type === `get-rendicion-stats-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                
                if (response.payload && response.payload.success) {
                    const stats = response.payload.stats;
                    
                    // Actualizar UI con los datos
                    if (stats.workersCount) {
                        document.getElementById('workersCount').textContent = stats.workersCount;
                    }
                    
                    if (stats.reportStatus) {
                        document.getElementById('reportStatus').textContent = stats.reportStatus;
                        
                        // Actualizar color del estado
                        const statusElement = document.getElementById('reportStatus');
                        const statusIcon = statusElement.parentElement.querySelector('.info-card-icon');
                        
                        if (stats.reportStatus.toLowerCase().includes('completado') || 
                            stats.reportStatus.toLowerCase().includes('finalizado')) {
                            statusIcon.className = 'info-card-icon success';
                            statusIcon.innerHTML = '<i class="bi bi-check-circle"></i>';
                        } else if (stats.reportStatus.toLowerCase().includes('elaboración')) {
                            statusIcon.className = 'info-card-icon warning';
                            statusIcon.innerHTML = '<i class="bi bi-pencil-square"></i>';
                        }
                    }
                }
            }
        };

        window.addEventListener('message', handleResponse);

        window.parent.postMessage({
            type: `get-rendicion-stats-request`,
            payload: {},
            requestId
        }, 'file://');
        
    } catch (error) {
        console.log('[rendicion-home] Error cargando datos:', error);
    }
}

/**
 * Navegar hacia atrás al módulo principal
 */
function goBackToModule() {
    console.log('[rendicion-home] Volviendo al módulo principal');
    
    if (window.rendicionModuleBackCallback && typeof window.rendicionModuleBackCallback === 'function') {
        // Usar callback directo si está disponible
        window.rendicionModuleBackCallback();
    } else if (window.parent && window.parent.postMessage) {
        // Fallback a postMessage
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

/**
 * Entrar a la rendición de cuentas (llamar al componente padre)
 */
function enterRendicion() {
    console.log('[rendicion-home] Entrando a rendición de cuentas');
    
    if (window.rendicionPortalComponent) {
        window.rendicionPortalComponent.enterRendicion();
    } else {
        alert('Error: No se pudo acceder al formulario de rendición de cuentas.');
    }
}

/**
 * Importar desde Excel
 */
async function importFromExcel() {
    console.log('[rendicion-home] Importar desde Excel');
    
    try {
        showLoading('Buscando archivos Excel...');
        
        const requestId = `req-${Date.now()}-${Math.random()}`;
        
        const handleResponse = (event) => {
            if (event.origin !== 'file://' && event.source !== window.parent) {
                return;
            }
            
            const response = event.data;
            if (response.type === `select-excel-file-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                hideLoading();
                
                if (response.payload && response.payload.success) {
                    alert(`✅ Archivo seleccionado: ${response.payload.fileName}\n\nLos datos se cargarán en el formulario.`);
                    // Aquí se podría cargar automáticamente el archivo
                }
            }
        };
        
        window.addEventListener('message', handleResponse);
        
        window.parent.postMessage({
            type: `select-excel-file-request`,
            payload: { filter: 'Excel Files' },
            requestId
        }, 'file://');
        
    } catch (error) {
        hideLoading();
        console.error('[rendicion-home] Error importando Excel:', error);
        alert('Error al importar el archivo Excel.');
    }
}

/**
 * Exportar informe
 */
function exportReport() {
    const activePeriod = document.getElementById('activePeriod').textContent;
    
    console.log('[rendicion-home] Exportar informe', activePeriod);
    
    const confirmExport = confirm(`¿Desea exportar el informe de rendición de cuentas del periodo ${activePeriod}?`);
    
    if (!confirmExport) return;
    
    showLoading(`Generando informe ${activePeriod}...`);
    
    // Simular exportación
    setTimeout(() => {
        hideLoading();
        alert(`✅ Informe exportado exitosamente.\n\nEl archivo se guardará en la carpeta de la empresa.`);
    }, 1500);
}

/**
 * Ver historial de periodos anteriores
 */
function viewHistory() {
    console.log('[rendicion-home] Ver historial');
    
    alert('Función: Ver Historial\n\nEsta acción mostrará los informes de rendición de cuentas de periodos anteriores.');
}

/**
 * Mostrar overlay de carga
 */
function showLoading(message = 'Cargando...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    
    if (text) text.textContent = message;
    if (overlay) overlay.classList.add('active');
}

/**
 * Ocultar overlay de carga
 */
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
}
