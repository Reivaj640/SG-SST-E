// plan-home.js - Lógica del Portal de Bienvenida Plan de Trabajo
// Este script se carga dinámicamente desde plan-trabajo-logic.js

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

async function initializePortal() {
    try {
        // Cargar el año activo
        await loadActiveYear();
    } catch (error) {
        console.log('[plan-home] Error inicializando:', error.message);
        document.getElementById('activeYear').textContent = new Date().getFullYear();
    }
}

async function loadActiveYear() {
    // Intentar detectar el año desde los archivos disponibles
    try {
        const yearResult = await detectAvailableYears();
        if (yearResult && yearResult.activeYear) {
            document.getElementById('activeYear').textContent = yearResult.activeYear;
        } else {
            document.getElementById('activeYear').textContent = new Date().getFullYear();
        }
    } catch (error) {
        document.getElementById('activeYear').textContent = new Date().getFullYear();
    }
}

async function detectAvailableYears() {
    return new Promise((resolve) => {
        const requestId = `req-${Date.now()}-${Math.random()}`;
        
        const handleResponse = (event) => {
            if (event.origin !== 'file://' && event.source !== window.parent) {
                return;
            }
            
            const response = event.data;
            if (response.type === `detect-years-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                resolve(response.payload);
            }
        };
        
        window.addEventListener('message', handleResponse);
        
        window.parent.postMessage({
            type: `detect-years-request`,
            payload: {},
            requestId
        }, 'file://');
    });
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
 * Entrar al cronograma (llamar al componente padre)
 */
function enterCronograma() {
    // Llamar al método del PlanTrabajoComponent
    if (window.planPortalComponent) {
        window.planPortalComponent.enterCronograma();
    } else {
        alert('Error: No se pudo acceder al cronograma.');
    }
}

/**
 * Importar desde Excel
 */
function importFromExcel() {
    alert('Función: Importar desde Excel\n\nEsta acción abrirá un selector de archivos para cargar un nuevo plan de trabajo.');
}

/**
 * Exportar Plan
 */
function exportPlan() {
    const activeYear = document.getElementById('activeYear').textContent;
    alert(`Función: Exportar Plan ${activeYear}\n\nSe generará un archivo Excel/PDF con el plan de trabajo vigente.`);
}

/**
 * Abrir presupuesto
 */
function openPresupuesto() {
    alert('Función: Presupuesto Asignado\n\nEsta acción abrirá el módulo de gestión presupuestal.');
}

/**
 * Clonar Plan
 */
async function clonePlan() {
    const activeYear = document.getElementById('activeYear').textContent;
    const confirmClone = confirm(`¿Desea crear un nuevo Plan de Trabajo para el año ${parseInt(activeYear) + 1} basado en el plan de ${activeYear}?`);
    
    if (!confirmClone) return;
    
    try {
        showLoading('Clonando plan de trabajo...');
        
        // Obtener información del padre
        const pathResult = await callParentAPI('get-submodule-path', {});
        if (!pathResult.success) {
            hideLoading();
            alert('Error al acceder a los archivos.');
            return;
        }

        const readResult = await callParentAPI('read-excel-file', {
            path: `${pathResult.path}/Plan_Trabajo_${activeYear}.xlsx`
        });

        if (!readResult.success) {
            hideLoading();
            alert('Error al leer el archivo fuente.');
            return;
        }

        const newYear = parseInt(activeYear) + 1;
        const writeResult = await callParentAPI('write-excel-file', {
            path: `${pathResult.path}/Plan_Trabajo_${newYear}.xlsx`,
            data: readResult.data
        });

        hideLoading();
        
        if (writeResult.success) {
            alert(`✅ Plan clonado exitosamente para el año ${newYear}.`);
            loadActiveYear();
        } else {
            alert('Error al crear el nuevo archivo.');
        }
        
    } catch (error) {
        hideLoading();
        console.error('[plan-home] Error clonando plan:', error);
        alert('Error al clonar el plan. Por favor intente nuevamente.');
    }
}

/**
 * Configuración de período
 */
function openConfigPeriodo() {
    alert('Función: Configuración de Período\n\nEsta acción abrirá las opciones para configurar:\n• Días festivos\n• Horarios laborales\n• Ciclos de planificación');
}

/**
 * Generar informe gerencial
 */
function generateInforme() {
    const activeYear = document.getElementById('activeYear').textContent;
    alert(`Función: Informe Gerencial\n\nSe generará un resumen ejecutivo en PDF del estado actual del Plan de Trabajo ${activeYear}.`);
}

/**
 * Abrir responsables
 */
function openResponsables() {
    alert('Función: Gestión de Responsables\n\nEsta acción abrirá el módulo de asignación de responsables por áreas.');
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
        
        const handleResponse = (event) => {
            if (event.origin !== 'file://' && event.source !== window.parent) {
                return;
            }
            
            const response = event.data;
            if (response.type === `${type}-response` && response.requestId === requestId) {
                window.removeEventListener('message', handleResponse);
                
                if (response.payload && response.payload.success) {
                    resolve(response.payload);
                } else {
                    reject(new Error(response.payload?.error || 'Unknown error'));
                }
            }
        };
        
        window.addEventListener('message', handleResponse);
        
        window.parent.postMessage({
            type: `${type}-request`,
            payload,
            requestId
        }, 'file://');
    });
}
