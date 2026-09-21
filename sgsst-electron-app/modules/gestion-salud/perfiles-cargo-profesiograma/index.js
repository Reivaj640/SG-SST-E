// modules/gestion-salud/perfiles-cargo-profesiograma/index.js
//
// Punto de entrada del submódulo 3.1.3 Perfiles de Cargo y Profesiograma.
// Carga el componente (clase global) y reexporta referencias para tests.

if (typeof window !== 'undefined') {
    // Cargado por <script> en el viewer — expone la clase
    if (window.PerfilesCargoProfesiogramaComponent) {
        module.exports = {
            Component: window.PerfilesCargoProfesiogramaComponent,
        };
    } else {
        // Fallback: si se importa antes de que se haya inyectado el componente
        module.exports = {};
    }
}
