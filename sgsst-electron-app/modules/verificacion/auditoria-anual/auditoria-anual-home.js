// auditoria-anual-home.js - Lógica del Portal de Bienvenida Auditoría Anual

document.addEventListener('DOMContentLoaded', function() {
    initializePortal();
});

function initializePortal() {
    var yearEl = document.getElementById('activeYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function goBackToModule() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'back-to-module-request' }, '*');
    }
}

function enterCronograma() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'navigate-submodule-request', payload: { view: 'cronograma' } }, '*');
    }
}

function openPlanAuditoria() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'navigate-submodule-request', payload: { view: 'plan' } }, '*');
    }
}

function openHallazgos() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'navigate-submodule-request', payload: { view: 'hallazgos' } }, '*');
    }
}

function openInforme() {
    if (window.parent && window.parent.postMessage) {
        window.parent.postMessage({ type: 'navigate-submodule-request', payload: { view: 'informe' } }, '*');
    }
}

function importFromExcel() {
    alert('Importar Programa de Auditorías\n\nSeleccione un archivo Excel con el programa de auditorías del año.');
}

function exportAuditorias() {
    alert('Exportar Datos de Auditoría\n\nSe generará un archivo con el listado completo de auditorías y hallazgos.');
}

function openHistorial() {
    alert('Historial de Auditorías\n\nConsulte auditorías de años anteriores.');
}

function openConfigPeriodo() {
    alert('Configuración del Programa\n\nAjuste los parámetros del programa de auditorías anual.');
}
