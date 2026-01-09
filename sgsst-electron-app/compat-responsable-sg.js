/**
 * Archivo de compatibilidad para responsable-sg
 *
 * Este archivo mantiene la compatibilidad con el sistema antiguo
 * mientras se implementa la nueva estructura modular.
 */

// En Electron renderer, los módulos se cargan de forma diferente
// Este archivo debe ser cargado en el contexto del renderer (navegador)
// para exponer el componente globalmente

// Cargar el componente lógico del submódulo responsable-sg
// La carga se hará de forma asíncrona o a través de import dinámico
// pero para mantener compatibilidad, lo exponemos globalmente

// Nota: Este archivo debe ser cargado después de que se hayan cargado
// los archivos del módulo responsable-sg en el HTML

// Si estamos en un entorno de navegador (renderer), exponer globalmente
if (typeof window !== 'undefined') {
  // Cargar el componente desde la nueva ubicación
  // Debemos esperar a que el módulo esté disponible
  if (window.modules && window.modules.recursos && window.modules.recursos.responsableSg) {
    window.ResponsableSgComponent = window.modules.recursos.responsableSg.logic;
  } else {
    // Si no está disponible en modules, intentar cargar directamente
    // Suponiendo que el archivo responsable-sg-logic.js ya se haya cargado
    // y haya expuesto su componente globalmente
    console.warn('Advertencia: El módulo estructurado no está disponible, intentando acceso directo');
  }
}