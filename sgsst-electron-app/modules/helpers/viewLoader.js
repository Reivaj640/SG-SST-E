/**
 * Helper para carga de vistas
 * 
 * Este módulo proporciona funciones seguras para cargar vistas
 * en el entorno Electron, evitando problemas comunes con rutas
 * relativas y protocolos.
 */

const fs = require('fs');
const path = require('path');

/**
 * Carga una vista HTML desde el sistema de archivos
 * @param {string} modulePath - Ruta relativa al módulo
 * @param {string} viewFile - Nombre del archivo de vista
 * @returns {string} Contenido HTML de la vista
 */
function loadView(modulePath, viewFile) {
  const fullPath = path.join(__dirname, '..', modulePath, viewFile);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Carga una vista HTML de forma asíncrona
 * @param {string} modulePath - Ruta relativa al módulo
 * @param {string} viewFile - Nombre del archivo de vista
 * @returns {Promise<string>} Promesa con el contenido HTML de la vista
 */
function loadViewAsync(modulePath, viewFile) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, '..', modulePath, viewFile);
    fs.readFile(fullPath, 'utf-8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

module.exports = { 
  loadView, 
  loadViewAsync 
};