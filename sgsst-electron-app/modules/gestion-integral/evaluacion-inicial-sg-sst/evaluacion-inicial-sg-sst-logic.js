// evaluacion-inicial-sg-sst-logic.js - Lógica del submódulo 2.3.1 Evaluación inicial del SG-SST

// Esta función se llama cuando se carga el submódulo
function loadEvaluacionInicialSgSst(container, moduleName, submoduleTitle) {
    // Verificar si el componente ya está definido
    if (typeof EvaluacionInicialSgSst !== 'undefined') {
        // Crear una instancia del componente
        const evaluacionComponent = new EvaluacionInicialSgSst(container, moduleName, submoduleTitle);
        evaluacionComponent.render();
    } else {
        // Si el componente no está disponible, mostrar un mensaje de error
        container.innerHTML = `
            <div class="alert alert-error">
                <h3>Error al cargar el submódulo</h3>
                <p>No se encontró el componente EvaluacionInicialSgSst.</p>
            </div>
        `;
    }
}

// Registrar el submódulo en el sistema global
if (typeof window !== 'undefined') {
    window.registeredSubmodules = window.registeredSubmodules || {};
    window.registeredSubmodules['2.3.1 Evaluación inicial del SG-SST'] = {
        loadFunction: loadEvaluacionInicialSgSst,
        moduleName: 'Gestión Integral',
        submoduleTitle: '2.3.1 Evaluación inicial del SG-SST'
    };
}

// Exportar la función para posibles importaciones en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadEvaluacionInicialSgSst
    };
}