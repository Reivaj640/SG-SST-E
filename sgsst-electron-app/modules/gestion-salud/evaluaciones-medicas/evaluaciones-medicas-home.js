// evaluaciones-medicas-home.js
// Lógica del portal de bienvenida — Evaluaciones Médicas 3.1.4
// Cargado dinámicamente desde evaluaciones-medicas-logic.js

/**
 * Volver al menú del módulo Gestión de la Salud
 */
function emGoBackToModule() {
    if (window.evaluacionesMedicasPortalComponent &&
        typeof window.evaluacionesMedicasPortalComponent.onBackToModuleHome === 'function') {
        window.evaluacionesMedicasPortalComponent.onBackToModuleHome();
    }
}

/**
 * Acceder al repositorio de evaluaciones (visor de documentos)
 */
function emEnterViewer() {
    if (window.evaluacionesMedicasPortalComponent &&
        typeof window.evaluacionesMedicasPortalComponent.showNewDocumentViewer === 'function') {
        window.evaluacionesMedicasPortalComponent.showNewDocumentViewer();
    } else {
        console.error('[evaluaciones-medicas-home] No se encontró el componente portal.');
    }
}

/**
 * Registrar nueva evaluación — placeholder
 */
function emRegistrarEvaluacion() {
    alert('Función: Registrar Nueva Evaluación\n\nEsta acción permitirá cargar un nuevo certificado o examen médico ocupacional al sistema.');
}

/**
 * Estadísticas de aptitud — placeholder
 */
function emEstadisticas() {
    alert('Función: Estadísticas de Aptitud\n\nAquí se mostrarán gráficas de distribución de resultados: aptos, con restricción y no aptos.');
}

/**
 * Próximos vencimientos — placeholder
 */
function emVencimientos() {
    alert('Función: Próximos Vencimientos\n\nEsta vista identificará a los trabajadores con evaluaciones médicas próximas a vencer o ya vencidas.');
}

/**
 * Exportar informe — placeholder
 */
function emExportarInforme() {
    alert('Función: Exportar Informe\n\nSe generará un reporte consolidado de evaluaciones médicas en PDF o Excel.');
}

/**
 * Custodia médica — placeholder
 */
function emCustodiaMedica() {
    alert('Función: Custodia Médica\n\nEsta sección permitirá gestionar la custodia de historias clínicas ocupacionales conforme a la normativa.');
}
