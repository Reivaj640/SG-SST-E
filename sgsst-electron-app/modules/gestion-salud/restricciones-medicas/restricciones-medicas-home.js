/**
 * restricciones-medicas-home.js
 * Navegación del portal moderno 3.1.6 Restricciones y Recomendaciones Médicas
 *
 * Este archivo delega todas las acciones en la instancia del componente
 * almacenada en window.restriccionesMedicasPortalComponent
 */

/* ── Navegación Principal ─────────────────────────────────── */

/** Volver al módulo principal (Gestión de la Salud) */
function rmGoBackToModule() {
    if (window.restriccionesMedicasPortalComponent &&
        typeof window.restriccionesMedicasPortalComponent.onBackToModuleHome === 'function') {
        window.restriccionesMedicasPortalComponent.onBackToModuleHome();
    }
}

/** Entrar al visor de documentos (Ver Remisiones Médicas) */
function rmEnterViewer() {
    if (window.restriccionesMedicasPortalComponent &&
        typeof window.restriccionesMedicasPortalComponent.showNewDocumentViewer === 'function') {
        window.restriccionesMedicasPortalComponent.showNewDocumentViewer();
    }
}

/** Entrar a la sección de Enviar Remisiones */
function rmEnterSendRemisiones() {
    if (window.restriccionesMedicasPortalComponent &&
        typeof window.restriccionesMedicasPortalComponent.showEnviarRemisionPage === 'function') {
        window.restriccionesMedicasPortalComponent.showEnviarRemisionPage();
    }
}

/** Entrar a la sección de Control de Remisiones */
function rmEnterControlRemisiones() {
    if (window.restriccionesMedicasPortalComponent &&
        typeof window.restriccionesMedicasPortalComponent._renderControlRemisionesView === 'function') {
        window.restriccionesMedicasPortalComponent._renderControlRemisionesView();
    }
}

/** Placeholder para funciones en desarrollo */
function rmPlaceholder(featureName) {
    const name = featureName || 'Esta función';
    alert(`${name} estará disponible próximamente.`);
}
