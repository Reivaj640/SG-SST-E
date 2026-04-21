// ============================================================
// K+AIR SG-SST - Severidad de la Accidentalidad
// Submódulo 3.3.2 - Index
// ============================================================

const path = require('path');

/**
 * Obtiene la ruta al archivo HTML del submódulo
 * @returns {string} Ruta absoluta al HTML
 */
function getHtmlPath() {
  return path.join(__dirname, 'severidad-accidentalidad.html');
}

/**
 * Obtiene la ruta al archivo CSS del submódulo
 * @returns {string} Ruta absoluta al CSS
 */
function getCssPath() {
  return path.join(__dirname, 'severidad-accidentalidad.css');
}

/**
 * Obtiene la ruta al archivo JS del submódulo
 * @returns {string} Ruta absoluta al JS
 */
function getJsPath() {
  return path.join(__dirname, 'severidad-accidentalidad.js');
}

/**
 * Obtiene información del submódulo
 * @returns {Object} Metadatos del submódulo
 */
function getModuleInfo() {
  return {
    id: '3.3.2',
    name: 'Severidad de la Accidentalidad',
    description: 'Dashboard de indicadores de severidad de accidentes de trabajo',
    category: 'Gestión de la Salud',
    version: '1.0.0',
    excelSync: true,
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