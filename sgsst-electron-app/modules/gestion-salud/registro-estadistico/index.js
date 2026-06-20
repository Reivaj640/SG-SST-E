/**
 * Módulo 3.2.3 - Registro y Análisis Estadístico
 * Submódulo de Gestión de la Salud para K+AIR
 */

module.exports = {
  name: 'Registro y Análisis Estadístico',
  code: '3.2.3',
  description: 'Registro y análisis estadístico de incidentes, accidentes de trabajo y enfermedades laborales',
  version: '1.1.0',
  path: 'registro-estadistico',
  files: [
    'registro-estadistico.html',
    'registro-estadistico.css',
    'registro-estadistico.js'
  ],
  dependencies: [
    'chart.js@4' // CDN
  ],
  features: [
    'Carga dinámica de datos vía IPC (empresa activa)',
    'Fallback a datos de muestra si empresa sin datos',
    'Chip de empresa activa en header',
    'Estados de carga, vacío y contenido (loading/empty/data)',
    'Tabla de datos con 19 columnas',
    'Filtros por año, severidad, evento y ciudad',
    'Búsqueda global',
    'Ordenamiento de columnas',
    'Paginación',
    'Modal de detalle al hacer clic en una fila',
    'Exportación CSV con BOM UTF-8',
    'Botón de actualizar datos',
    'Badges de conteo en pestañas',
    'KPIs de eventos',
    'Indicadores SG-SST (IFA, IG, PA)',
    'Panel de alertas',
    '9 gráficos estadísticos',
    'Top 5 mecanismos y lugares',
    'Recomendaciones automáticas',
    'Impresión del tablero estadístico',
    'API pública window.kairRegistroEstadistico'
  ],
  ipcChannels: [
    'registro-estadistico:cargar-datos'
  ]
};
