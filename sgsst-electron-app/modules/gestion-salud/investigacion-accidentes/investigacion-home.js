document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        await loadStats();
    } catch (error) {
        console.log('[investigacion-home] Error inicializando:', error.message);
    }
}

async function loadStats() {
    try {
        const stats = await callParentAPI('get-investigacion-stats', {});
    if (stats && stats.pendientes !== undefined) {
      document.getElementById('investigacionesPendientes').textContent = stats.pendientes;
      document.getElementById('investigacionesCompletadas').textContent = stats.completadas || 0;
    }
    } catch (error) {
        console.log('[investigacion-home] Error cargando estadísticas:', error.message);
    }
}

function goBackToModule() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

function realizarInvestigacion() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ 
            type: 'investigacion-home-action',
            action: 'realizar-investigacion'
        }, '*');
    }
}

function verInvestigaciones() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ 
            type: 'investigacion-home-action',
            action: 'ver-investigaciones'
        }, '*');
    }
}

function abrirEstadisticas() {
    alert('Función: Estadísticas\n\nSe abrirá el módulo de estadísticas y gráficos de accidentes e incidentes.');
}

function abrirPlantillas() {
    alert('Función: Plantillas\n\nSe abrirá el gestor de plantillas de informes de investigación.');
}

function exportarDatos() {
    alert('Función: Exportar Datos\n\nSe generará un archivo Excel/PDF con los datos consolidados de investigaciones.');
}

function abrirConfiguracion() {
    alert('Función: Configuración\n\nSe abrirán las opciones de configuración del módulo de investigación.');
}

function callParentAPI(type, payload) {
    return new Promise((resolve, reject) => {
        const requestId = `req-${Date.now()}-${Math.random()}`;
        
        const handleResponse = (event) => {
            const response = event.data;
            if (response.type === `${type}-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                
                if (response.payload) {
                    resolve(response.payload);
                } else {
                    reject(new Error('No response payload'));
                }
            }
        };
        
        window.addEventListener('message', handleResponse);
        
        window.parent.postMessage({
            type: `${type}-request`,
            payload,
            requestId
        }, '*');
        
        setTimeout(() => {
            window.removeEventListener('message', handleResponse);
            reject(new Error('Timeout'));
        }, 5000);
    });
}
