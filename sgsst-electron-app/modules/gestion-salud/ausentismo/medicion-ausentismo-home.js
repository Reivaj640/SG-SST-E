// medicion-ausentismo-home.js - Lógica del portal de Medición del Ausentismo

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        await loadStats();
    } catch (error) {
        console.log('[medicion-ausentismo-home] Error inicializando:', error.message);
    }
}

async function loadStats() {
    try {
        // Intentar obtener estadísticas desde la API de Electron si está disponible
        if (window.electronAPI && window.electronAPI.getAusentismoStats) {
            const companyName = getCompanyName();
            const stats = await window.electronAPI.getAusentismoStats(companyName);
            
            if (stats && stats.success) {
                const data = stats.data || {};
                document.getElementById('ausentismoPendientes').textContent = data.pendientes || 0;
                document.getElementById('ausentismoActivos').textContent = data.activos || 0;
            }
        } else {
            // Valores por defecto si no hay API disponible
            document.getElementById('ausentismoPendientes').textContent = '0';
            document.getElementById('ausentismoActivos').textContent = '0';
        }
    } catch (error) {
        console.log('[medicion-ausentismo-home] Error cargando estadísticas:', error.message);
        // En caso de error, mostrar 0
        document.getElementById('ausentismoPendientes').textContent = '0';
        document.getElementById('ausentismoActivos').textContent = '0';
    }
}

function getCompanyName() {
    // Obtener el nombre de la empresa desde diferentes fuentes
    if (window.currentCompany && window.currentCompany !== 'default_company') {
        return window.currentCompany;
    }
    if (window.rendererState && window.rendererState.selectedCompany) {
        return window.rendererState.selectedCompany;
    }
    const domCompany = document.getElementById('company-name');
    if (domCompany && domCompany.textContent && domCompany.textContent !== 'Empresa') {
        return domCompany.textContent.trim();
    }
    return 'default_company';
}

function goBackToModule() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

function registrarAusentismo() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'registrar-ausentismo'
        }, '*');
    }
}

function verAusentismo() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'ver-ausentismo'
        }, '*');
    }
}

function seguimientoIncapacidades() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'seguimiento-incapacidades'
        }, '*');
    }
}

function verEstadisticas() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'ver-estadisticas'
        }, '*');
    }
}

function exportarDatos() {
    alert('Función: Exportar Datos de Ausentismo\n\nSe generará un archivo Excel/PDF con los datos consolidados de ausentismo e incapacidades.');
}

function abrirConfiguracion() {
    alert('Función: Configuración de Ausentismo\n\nSe abrirán las opciones de configuración del módulo de medición del ausentismo.');
}
