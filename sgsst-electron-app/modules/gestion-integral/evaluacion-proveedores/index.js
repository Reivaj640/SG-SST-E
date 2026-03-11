/**
 * Index - Registro del Submódulo 2.9.1
 * Evaluación de Proveedores
 */

// Importar lógica del componente
if (typeof window !== 'undefined') {
    // El archivo JS principal se carga directamente en index.html
    console.log('[2.9.1] Módulo de Evaluación de Proveedores registrado');
}

// Exportar para sistema modular
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        name: '2.9.1 Identificación y evaluación para la adquisición de bienes y servicios',
        code: '2.9.1',
        category: 'Gestión Integral',
        component: 'EvaluacionProveedores'
    };
}
