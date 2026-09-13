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
        console.log('[medicion-ausentismo-home][📦459-DEBUG] loadStats() entered');
        // 📦459 (2026-07-02) — Fix iframe: este script corre dentro de un iframe.
        // window.electronAPI del iframe es undefined (no se hereda del padre). Fallback
        // a window.parent.electronAPI, que es el contextBridge expuesto en el renderer
        // principal. Es seguro: ambos contextos son locales de Electron, no hay riesgo
        // de seguridad por leer window.parent.electronAPI directamente.
        const electronAPI = (window.electronAPI) ||
                            (window.parent && window.parent.electronAPI) ||
                            (window.top && window.top.electronAPI);

        console.log('[medicion-ausentismo-home][📦459-DEBUG] electronAPI resuelto:', !!electronAPI,
            '| getAusentismoStats typeof:', electronAPI ? typeof electronAPI.getAusentismoStats : 'N/A',
            '| parent tiene electronAPI:', !!(window.parent && window.parent.electronAPI));

        const companyName = getCompanyName();
        console.log('[medicion-ausentismo-home][📦459-DEBUG] companyName:', JSON.stringify(companyName));

        // 📦459 — Estrategia de invocación:
        //   1. Si el iframe tiene acceso directo (electronAPI + getAusentismoStats), usar directo.
        //   2. Si NO, hacer proxy vía postMessage al padre (medicion-ausentismo.js),
        //      que sí tiene el contextBridge y puede invocar el IPC en nuestro nombre.
        // Esto blinda el caso "iframe no hereda electronAPI" sin esperar más verificación.
        let stats;
        const hasDirectAccess = electronAPI && typeof electronAPI.getAusentismoStats === 'function';
        if (hasDirectAccess) {
            console.log('[medicion-ausentismo-home][📦459-DEBUG] Usando IPC directo (electronAPI.getAusentismoStats)');
            stats = await electronAPI.getAusentismoStats(companyName);
        } else if (window.parent && window.parent !== window) {
            console.log('[medicion-ausentismo-home][📦459-DEBUG] electronAPI no accesible, usando postMessage proxy al padre...');
            try {
                stats = await ipcInvokeViaParent('getAusentismoStats', companyName);
            } catch (proxyErr) {
                console.error('[medicion-ausentismo-home][📦459-DEBUG] postMessage proxy falló:', proxyErr.message);
                stats = null;
            }
        } else {
            console.warn('[medicion-ausentismo-home][📦459-DEBUG] Sin acceso al padre — IPC imposible');
            stats = null;
        }

        console.log('[medicion-ausentismo-home][📦459-DEBUG] stats recibidos:',
            stats ? `success=${stats.success}, hasData=${!!stats.data}` : 'NULL',
            stats && stats.data ? `| pendientes=${stats.data.pendientes}, activos=${stats.data.activos}, cerrados=${stats.data.cerrados}` : '');

        if (stats && stats.success) {
            const data = stats.data || {};

            // 📦459 (2026-07-02) — Modo degradado: si el archivo de ausentismo no
            // está disponible, mostrar "—" en vez de "0". "0" es engañoso porque
            // sugiere "no hay casos" cuando en realidad no pudimos leer el archivo.
            if (data._missingFile) {
                console.warn('[medicion-ausentismo-home][📦459] Archivo de ausentismo no disponible:',
                    data._missingFileReason, '|', data._details || '');
                safeSetTextContent('ausentismoPendientes', '—', false);
                safeSetTextContent('ausentismoActivos', '—', false);
                safeSetTextContent('ausentismoCerrados', '—', false);
                // Marcar visualmente para que se sepa que es un "no-data", no un "cero real"
                markKpiAsUnavailable('ausentismoPendientes');
                markKpiAsUnavailable('ausentismoActivos');
                markKpiAsUnavailable('ausentismoCerrados');
            } else {
                // Datos normales: quitar marca de "no disponible" si la tenía
                unmarkKpiAsUnavailable('ausentismoPendientes');
                unmarkKpiAsUnavailable('ausentismoActivos');
                unmarkKpiAsUnavailable('ausentismoCerrados');
                const pVal = data.pendientes != null ? data.pendientes : '0';
                const aVal = data.activos != null ? data.activos : '0';
                const cVal = data.cerrados != null ? data.cerrados : '0';
                safeSetTextContent('ausentismoPendientes', pVal, false);
                safeSetTextContent('ausentismoActivos', aVal, false);
                safeSetTextContent('ausentismoCerrados', cVal, false);
                console.log('[medicion-ausentismo-home][📦459-DEBUG] KPIs pintados:',
                    `Pendientes=${pVal}, Activos=${aVal}, Cerrados=${cVal}`);
            }
        } else if (stats && stats.success === false) {
            // success:false — error grave del handler (no debería pasar con el refactor)
            console.error('[medicion-ausentismo-home] Handler retornó success:false:', stats && stats.error);
            safeSetTextContent('ausentismoPendientes', '—', false);
            safeSetTextContent('ausentismoActivos', '—', false);
            safeSetTextContent('ausentismoCerrados', '—', false);
            markKpiAsUnavailable('ausentismoPendientes');
            markKpiAsUnavailable('ausentismoActivos');
            markKpiAsUnavailable('ausentismoCerrados');
        } else {
            // stats === null (proxy o electronAPI fallaron) — pintar modo degradado
            console.warn('[medicion-ausentismo-home] No se pudieron cargar stats (ni IPC directo ni proxy). Mostrando "—".');
            safeSetTextContent('ausentismoPendientes', '—', false);
            safeSetTextContent('ausentismoActivos', '—', false);
            safeSetTextContent('ausentismoCerrados', '—', false);
            markKpiAsUnavailable('ausentismoPendientes');
            markKpiAsUnavailable('ausentismoActivos');
            markKpiAsUnavailable('ausentismoCerrados');
        }
    } catch (error) {
        console.error('[medicion-ausentismo-home] Error cargando estadisticas:', error.message, error.stack);
        // 📦459 — Error inesperado: mostrar "—" en vez de "0" para no engañar al usuario
        safeSetTextContent('ausentismoPendientes', '—', false);
        safeSetTextContent('ausentismoActivos', '—', false);
        safeSetTextContent('ausentismoCerrados', '—', false);
        markKpiAsUnavailable('ausentismoPendientes');
        markKpiAsUnavailable('ausentismoActivos');
        markKpiAsUnavailable('ausentismoCerrados');
    }
}

/**
 * 📦459 (2026-07-02) — IPC proxy vía postMessage al padre.
 *
 * El iframe home corre en isolated world y NO hereda el contextBridge del preload.
 * Si `window.electronAPI` no está disponible en el iframe (ni en window.parent),
 * podemos pedirle al renderer padre (medicion-ausentismo.js) que invoque el IPC
 * en nuestro nombre. El padre SÍ tiene el contextBridge (cargado por su preload).
 *
 * Protocolo:
 *   iframe → parent:  { type: 'ipc-invoke', requestId, channel, args }
 *   parent → iframe:  { type: 'ipc-response', requestId, result | error }
 *
 * Timeout de 30s para no colgar la UI si el padre nunca responde.
 */
function ipcInvokeViaParent(channel, ...args) {
    return new Promise((resolve, reject) => {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const listener = (event) => {
            const msg = event.data;
            if (!msg || msg.type !== 'ipc-response' || msg.requestId !== requestId) return;
            window.removeEventListener('message', listener);
            clearTimeout(timeoutHandle);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
        };
        window.addEventListener('message', listener);
        window.parent.postMessage({ type: 'ipc-invoke', requestId, channel, args }, '*');
        const timeoutHandle = setTimeout(() => {
            window.removeEventListener('message', listener);
            reject(new Error(`Timeout (30s) esperando respuesta de ${channel} vía parent`));
        }, 30000);
    });
}

/**
 * 📦459 (2026-07-02) — Marca visualmente un KPI como "datos no disponibles" para
 * que el usuario no lo confunda con un "0" real (cero casos). Aplica opacidad
 * reducida y un título (tooltip) explicando el motivo.
 */
function markKpiAsUnavailable(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('kpi-unavailable');
    el.setAttribute('title', 'Archivo de ausentismo no disponible. Los datos no se pudieron cargar.');
    el.parentElement && el.parentElement.classList.add('kpi-card-unavailable');
}

/**
 * 📦459 — Quita la marca visual de "no disponible" (cuando los datos vuelven OK).
 */
function unmarkKpiAsUnavailable(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove('kpi-unavailable');
    el.removeAttribute('title');
    el.parentElement && el.parentElement.classList.remove('kpi-card-unavailable');
}

function getCompanyName() {
    // Obtener el nombre de la empresa desde diferentes fuentes
    // 📦459 (2026-07-02) — Este script corre dentro de un iframe. El contexto del
    // iframe tiene su propio window que NO hereda window.currentCompany ni
    // window.rendererState del padre. Por eso tenemos que consultar primero
    // window.parent (el renderer principal, donde está el estado real) y caer
    // a fallbacks locales solo si el padre no tiene el dato.
    if (window.parent && window.parent.currentCompany && window.parent.currentCompany !== 'default_company') {
        return window.parent.currentCompany;
    }
    if (window.parent && window.parent.rendererState && window.parent.rendererState.selectedCompany) {
        return window.parent.rendererState.selectedCompany;
    }
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

/**
 * 📦461 (2026-07-03) — Abre la vista de Seguimiento de Gestación (Salud Materna).
 * Envía mensaje al padre para que cargue la nueva vista. Por ahora, mientras se
 * desarrolla la vista completa, el padre mostrará un toast indicando que el
 * módulo está en construcción.
 */
function seguimientoGestacion() {
    console.log('[HOME] Abriendo seguimiento de gestación...');

    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({
            type: 'ausentismo-home-action',
            action: 'seguimiento-gestacion'
        }, '*');
    }
}