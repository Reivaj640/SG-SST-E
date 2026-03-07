// presupuesto-home.js - Lógica del Portal de Bienvenida de Asignación de Recursos

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ [PresupuestoHome] Inicializado');
    
    // Escuchar mensajes del padre (opcional por si necesitamos datos iniciales)
    window.addEventListener('message', (event) => {
        if (event.source !== window.parent) return;
        
        if (event.data.files) {
            detectCurrentYearBudget(event.data.files);
        }
    });

    // Solicitar archivos para determinar el año activo
    window.parent.postMessage({ action: 'requestBudgetFiles' }, '*');
});

/**
 * Detecta el presupuesto más reciente para mostrarlo en el Hero
 */
let latestFile = null;

function detectCurrentYearBudget(files) {
    if (!files || files.length === 0) return;

    // Buscar archivo del año actual o el más reciente
    const currentYear = new Date().getFullYear();
    const currentYearFile = files.find(f => f.name.includes(currentYear.toString()));
    
    if (currentYearFile) {
        latestFile = currentYearFile;
        document.getElementById('activeYear').textContent = currentYear;
    } else {
        // Si no hay del año actual, tomar el último modificado
        const sorted = files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        latestFile = sorted[0];
        const yearMatch = latestFile.name.match(/(20\d{2})/);
        document.getElementById('activeYear').textContent = yearMatch ? yearMatch[1] : 'Configurado';
    }
}

/**
 * Acciones de Navegación
 */
function goBackToModule() {
    window.parent.postMessage({ action: 'backToSubmodules' }, '*');
}

function enterBudget() {
    if (latestFile) {
        window.parent.postMessage({ action: 'openBudgetFile', file: latestFile }, '*');
    } else {
        alert('No se encontró un presupuesto activo. Por favor use el "Histórico de Años" para seleccionar o crear uno.');
    }
}

function openSelector() {
    window.parent.postMessage({ action: 'backToSelector' }, '*');
}

/**
 * Acciones Rápidas (Placeholders con feedback visual)
 */
function exportBudget() {
    alert('Función: Informe Financiero\n\nGenerando resumen ejecutivo de ejecución presupuestal en PDF...');
}

function cloneBudget() {
    if (!latestFile) {
        alert('Primero debe existir un presupuesto base para clonar.');
        return;
    }
    
    const yearMatch = latestFile.name.match(/(20\d{2})/);
    const currentYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
    const nextYear = currentYear + 1;

    if(confirm(`¿Desea proyectar el presupuesto para el año ${nextYear} basado en el actual?`)) {
        window.parent.postMessage({
            action: 'duplicate-budget-file',
            currentFilePath: latestFile.path,
            newYear: nextYear
        }, '*');
    }
}

function importExpenses() {
    alert('Función: Importar Gastos\n\nSeleccione el archivo de reporte contable para cruzar con el presupuesto.');
}

function configItems() {
    alert('Función: Configurar Partidas\n\nAbriendo panel de configuración de rubros y límites de gasto.');
}
