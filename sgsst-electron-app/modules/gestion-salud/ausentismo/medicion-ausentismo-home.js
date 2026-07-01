// medicion-ausentismo-home.js - Logica del portal de Medicion del Ausentismo

/**
 * Espera a que un elemento exista en el DOM con retry logic y backoff exponencial
 * @param {string} selector - Selector CSS del elemento a esperar (ID, clase, etc.)
 * @param {number} timeout - Tiempo maximo de espera en ms (default: 5000)
 * @param {number} maxRetries - Numero maximo de reintentos (default: 10)
 * @param {number} baseDelay - Retraso base en ms para backoff exponencial (default: 100)
 * @returns {Promise<Element|null>} - El elemento encontrado o null si se agoto el tiempo
 */
function waitForElement(selector, timeout = 5000, maxRetries = 10, baseDelay = 100) {
    return new Promise(async (resolve) => {
        const startTime = Date.now();
        let retries = 0;
        
        // Funcion para verificar si el elemento existe
        const checkElement = () => {
            const element = typeof selector === 'string' 
                ? document.querySelector(selector) 
                : document.getElementById(selector);
            
            if (element) {
                return element;
            }
            return null;
        };
        
        // Verificar inmediatamente
        const initialElement = checkElement();
        if (initialElement) {
            console.log(`[waitForElement] Elemento '${selector}' encontrado inmediatamente`);
            resolve(initialElement);
            return;
        }
        
        // Crear observer para monitorear cambios en el DOM
        const observer = new MutationObserver((mutations, obs) => {
            const element = checkElement();
            if (element) {
                obs.disconnect();
                console.log(`[waitForElement] Elemento '${selector}' encontrado despues de ${Date.now() - startTime}ms`);
                resolve(element);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Timeout con retry logic
        const checkWithRetry = async () => {
            while (retries < maxRetries) {
                await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, retries))); // Backoff exponencial
                retries++;
                
                const element = checkElement();
                if (element) {
                    observer.disconnect();
                    console.log(`[waitForElement] Elemento '${selector}' encontrado en retry ${retries} despues de ${Date.now() - startTime}ms`);
                    resolve(element);
                    return;
                }
                
                // Verificar si excedimos el timeout
                if (Date.now() - startTime >= timeout) {
                    observer.disconnect();
                    console.warn(`[waitForElement] Timeout despues de ${timeout}ms y ${retries} reintentos para '${selector}'`);
                    resolve(null);
                    return;
                }
            }
            
            // Ultimo intento
            const finalElement = checkElement();
            observer.disconnect();
            if (finalElement) {
                console.log(`[waitForElement] Elemento '${selector}' encontrado en ultimo intento`);
            } else {
                console.warn(`[waitForElement] Elemento '${selector}' no encontrado despues de ${maxRetries} reintentos`);
            }
            resolve(finalElement);
        };
        
        checkWithRetry();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        console.log('[medicion-ausentismo-home] Iniciando portal, esperando elementos del DOM...');
        
        // Esperar a que los elementos del DOM esten disponibles con retry logic
        const pendientesElement = await waitForElement('#ausentismoPendientes', 8000, 15, 100);
        const activosElement = await waitForElement('#ausentismoActivos', 8000, 15, 100);

        if (!pendientesElement || !activosElement) {
            console.warn('[medicion-ausentismo-home] Algunos elementos no se encontraron despues de 8 segundos');
            console.warn('[medicion-ausentismo-home] pendientes:', !!pendientesElement, 'activos:', !!activosElement);
        } else {
            console.log('[medicion-ausentismo-home] Elementos del DOM encontrados, cargando stats...');
        }

        await loadStats();
    } catch (error) {
        console.error('[medicion-ausentismo-home] Error critico inicializando:', error);
    }
}

/**
 * Funcion auxiliar segura para establecer textContent
 * @param {string} elementId - ID del elemento
 * @param {string} value - Valor a establecer
 * @param {boolean} warnOnMissing - Si true, muestra warning si no existe (default: true)
 * @returns {boolean} - true si se establecio, false si no se encontro
 */
function safeSetTextContent(elementId, value, warnOnMissing = true) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        return true;
    }
    if (warnOnMissing) {
        console.warn(`[medicion-ausentismo-home] Elemento con ID '${elementId}' no encontrado en el DOM`);
    }
    return false;
}

async function loadStats() {
    try {
        // Intentar obtener estadisticas desde la API de Electron si esta disponible
        if (window.electronAPI && window.electronAPI.getAusentismoStats) {
            const companyName = getCompanyName();
            const stats = await window.electronAPI.getAusentismoStats(companyName);

            if (stats && stats.success) {
                const data = stats.data || {};
                safeSetTextContent('ausentismoPendientes', data.pendientes || 0, false);
                safeSetTextContent('ausentismoActivos', data.activos || 0, false);
            }
        } else {
            // Valores por defecto si no hay API disponible
            safeSetTextContent('ausentismoPendientes', '0', false);
            safeSetTextContent('ausentismoActivos', '0', false);
        }
    } catch (error) {
        console.log('[medicion-ausentismo-home] Error cargando estadisticas:', error.message);
        // En caso de error, mostrar 0
        safeSetTextContent('ausentismoPendientes', '0', false);
        safeSetTextContent('ausentismoActivos', '0', false);
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
 * Abre el constructor de informes PRI multicaso DENTRO de la misma ventana
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
 * Carga el constructor de informes PRI en el area de contenido principal
 */
function loadInformePriBuilder() {
    console.log('[HOME] Cargando informe PRI builder directamente...');
    
    // Buscar el content-area
    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        console.error('[HOME] No se encontro content-area');
        // [📦453 2026-07-01] Migrado de alert() nativo a window.updateNotifier
        // (sistema de notificaciones estandar 6.1.3 — feedback no bloqueante).
        const notifier1 = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
        if (notifier1 && typeof notifier1.show === 'function') {
            notifier1.show({
                type: 'error',
                title: 'Error cargando informe',
                subtitle: 'No se encontro content-area. Vuelve al menu y reintenta.',
                autoClose: 6000
            });
        } else {
            alert('Error: No se pudo cargar la vista del informe');
        }
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
            // [📦453 2026-07-01] Migrado de alert() nativo a window.updateNotifier
            // (sistema de notificaciones estandar 6.1.3 — feedback no bloqueante).
            const notifier2 = (window.parent && window.parent.updateNotifier) || window.updateNotifier;
            if (notifier2 && typeof notifier2.show === 'function') {
                notifier2.show({
                    type: 'error',
                    title: 'Error cargando constructor',
                    subtitle: 'No se pudo cargar el constructor de informes: ' + error.message,
                    autoClose: 6000
                });
            } else {
                alert('Error al cargar el constructor de informes: ' + error.message);
            }
        });
}

/**
 * Abre la Consulta de Trabajadores
 * Envia mensaje al padre para que cargue la vista de consulta
 */
function consultaTrabajadores() {
    console.log('[HOME] Abriendo consulta de trabajadores...');

    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'consulta-trabajadores'
        }, '*');
    }
}