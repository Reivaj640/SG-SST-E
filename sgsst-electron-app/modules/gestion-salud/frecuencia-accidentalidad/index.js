// ============================================================
// K+AIR SG-SST - Frecuencia de la Accidentalidad
// Submódulo 3.3.1 - Index
// ============================================================

const path = require('path');

/**
 * Obtiene la ruta al archivo HTML del submódulo
 * @returns {string} Ruta absoluta al HTML
 */
function getHtmlPath() {
  return path.join(__dirname, 'frecuencia-accidentalidad.html');
}

/**
 * Obtiene la ruta al archivo CSS del submódulo
 * @returns {string} Ruta absoluta al CSS
 */
function getCssPath() {
  return path.join(__dirname, 'frecuencia-accidentalidad.css');
}

/**
 * Obtiene la ruta al archivo JS del submódulo
 * @returns {string} Ruta absoluta al JS
 */
function getJsPath() {
  return path.join(__dirname, 'frecuencia-accidentalidad.js');
}

/**
 * Obtiene información del submódulo
 * @returns {Object} Metadatos del submódulo
 */
function getModuleInfo() {
  return {
    id: '3.3.1',
    name: 'Frecuencia de la Accidentalidad',
    description: 'Dashboard de indicadores de frecuencia y severidad de accidentes de trabajo',
    category: 'Gestión de la Salud',
    version: '1.0.0',
    excelSync: true, // Indica que tiene sincronización bidireccional con Excel
    files: {
      html: getHtmlPath(),
      css: getCssPath(),
      js: getJsPath()
    }
  };
}

module.exports = {
  getHtmlPath,
  getCssPath,
  getJsPath,
  getModuleInfo
};
