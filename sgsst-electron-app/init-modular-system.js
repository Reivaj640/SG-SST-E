/**
 * Archivo de inicialización del sistema modular
 * 
 * Este archivo debe cargarse antes que renderer.js para que
 * la estructura de módulos esté disponible globalmente.
 */

// Inicializar la estructura global de módulos
window.modules = window.modules || {};

// Cargar módulos individuales
try {
  // Cargar el módulo de recursos
  if (typeof require !== 'undefined') {
    // En el contexto de Node.js o con CommonJS disponible
    window.modules.recursos = require('./modules/recursos');
  } else {
    // En el contexto del navegador, los módulos deben cargarse individualmente
    // o se debe usar un sistema de módulos diferente
    console.info('Sistema de módulos CommonJS no disponible, usando estructura global');
    
    // La estructura de módulos se construirá a medida que se carguen los scripts individuales
    window.modules.recursos = window.modules.recursos || {};
    
    // Registrar el componente responsable-sg si está disponible
    if (window.ResponsableSgComponent) {
      window.modules.recursos.responsableSg = {
        logic: window.ResponsableSgComponent,
        // Otros componentes del submódulo responsable-sg
      };
    }
  }
} catch (error) {
  console.warn('No se pudo cargar el sistema de módulos completo:', error.message);
  console.info('Los componentes estarán disponibles globalmente como antes');
}

console.log('Sistema modular inicializado. Módulos disponibles:', window.modules);