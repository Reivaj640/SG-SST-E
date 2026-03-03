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

// Función auxiliar segura para establecer textContent
function safeSetTextContent(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        return true;
    }
    console.warn(`[medicion-ausentismo-home] Elemento con ID '${elementId}' no encontrado en el DOM`);
    return false;
}

async function loadStats() {
    try {
        // Intentar obtener estadísticas desde la API de Electron si está disponible
        if (window.electronAPI && window.electronAPI.getAusentismoStats) {
            const companyName = getCompanyName();
            const stats = await window.electronAPI.getAusentismoStats(companyName);

            if (stats && stats.success) {
                const data = stats.data || {};
                safeSetTextContent('ausentismoPendientes', data.pendientes || 0);
                safeSetTextContent('ausentismoActivos', data.activos || 0);
            }
        } else {
            // Valores por defecto si no hay API disponible
            safeSetTextContent('ausentismoPendientes', '0');
            safeSetTextContent('ausentismoActivos', '0');
        }
    } catch (error) {
        console.log('[medicion-ausentismo-home] Error cargando estadísticas:', error.message);
        // En caso de error, mostrar 0
        safeSetTextContent('ausentismoPendientes', '0');
        safeSetTextContent('ausentismoActivos', '0');
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

/**
 * 🆕 Abre el constructor de informes PRI multicaso DENTRO de la misma ventana
 */
function generarInforme() {
    console.log('[HOME] Abriendo constructor de informes PRI en la misma ventana...');

    // Enviar mensaje a la ventana padre para que cargue la vista del informe
    if (window.parent && window.parent.postMessage) {
        console.log('[HOME] Enviando solicitud para cargar informe-pri-builder.html');
        window.parent.postMessage({
            type: 'load-module-view',
            payload: {
                path: 'modules/gestion-salud/ausentismo/informe-pri-builder.html'
            }
        }, '*');
    } else {
        // Fallback: intentar cargar directamente si estamos en el contexto principal
        loadInformePriBuilder();
    }
}

/**
 * Carga el constructor de informes PRI en el área de contenido principal
 */
function loadInformePriBuilder() {
    console.log('[HOME] Cargando informe PRI builder directamente...');
    
    // Buscar el content-area
    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        console.error('[HOME] No se encontró content-area');
        alert('❌ Error: No se pudo cargar la vista del informe');
        return;
    }
    
    // Cargar el HTML del constructor
    fetch('modules/gestion-salud/ausentismo/informe-pri-builder.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo del informe');
            }
            return response.text();
        })
        .then(html => {
            contentArea.innerHTML = html;
            console.log('[HOME] Informe PRI builder cargado exitosamente');
        })
        .catch(error => {
            console.error('[HOME] Error cargando informe:', error);
            alert('❌ Error al cargar el constructor de informes: ' + error.message);
        });
}

function abrirConfiguracion() {
    alert('Función: Configuración de Ausentismo\n\nSe abrirán las opciones de configuración del módulo de medición del ausentismo.');
}
