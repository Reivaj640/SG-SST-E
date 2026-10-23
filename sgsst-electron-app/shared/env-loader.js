/**
 * shared/env-loader.js
 *
 * Lector de `.env` para la app de escritorio. Sin librerías externas.
 *
 * 📦931 — Este módulo existe por DOS razones, y las dos importan:
 *
 * 1. POR QUÉ NO ESTÁ EN `utils/`. `package.json` mete `**/utils/**` en
 *    `asarUnpack`: en un build, `utils/emailSender.js` queda en
 *    `resources/app.asar.unpacked/utils/`, y su `__dirname` da
 *    `app.asar.unpacked/utils` — ahí NO hay `.env` (el `.env` viaja DENTRO de
 *    `app.asar`). En cambio `shared/` NO está en `asarUnpack`: su `__dirname`
 *    es `app.asar/shared`, y `..` da `app.asar/.env`, que sí existe.
 *    Un cargador en `utils/` funcionaría en desarrollo y fallaría SOLO en el
 *    instalador: el peor síntoma posible.
 *
 * 2. POR QUÉ SE RE-LEE. La app crea un `EmailSender` nuevo en cada envío
 *    (`main.js` lo instancia por invocación IPC). Si el `.env` se lee en
 *    cada construcción, una contraseña rotada aplica al siguiente envío sin
 *    reiniciar la app.
 *
 * La precedencia es: `process.env` (lo que el sistema operativo impone) gana
 * sobre el `.env`; el `.env` es el respaldo y se re-lee en cada llamada.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * La ruta del `.env` de la app: un nivel arriba de `shared/`.
 * @returns {string}
 */
function rutaEnvPorDefecto() {
  return path.join(__dirname, '..', '.env');
}

/**
 * Lee un archivo `.env` y devuelve sus variables. NO toca `process.env`.
 * @param {string} [ruta]
 * @returns {Object<string,string>}
 */
function leerArchivoEnv(ruta) {
  const salida = {};
  const p = ruta || rutaEnvPorDefecto();
  try {
    if (!fs.existsSync(p)) return salida;
    const contenido = fs.readFileSync(p, 'utf8');
    for (const linea of contenido.split(/\r?\n/)) {
      const t = linea.trim();
      if (!t || t.charAt(0) === '#') continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const clave = t.substring(0, eq).trim();
      let valor = t.substring(eq + 1).trim();
      // Las comillas opcionales (simples o dobles) se quitan. Un valor con
      // espacios SIEMPRE va entre comillas: las app passwords de Google son
      // "xxxx xxxx xxxx xxxx".
      if ((valor.charAt(0) === '"' && valor.charAt(valor.length - 1) === '"') ||
          (valor.charAt(0) === "'" && valor.charAt(valor.length - 1) === "'")) {
        valor = valor.substring(1, valor.length - 1);
      }
      if (clave) salida[clave] = valor;
    }
  } catch (e) {
    // Un `.env` ilegible no se lleva la app: el caller ve el valor vacío y
    // avisa con su propio mensaje.
  }
  return salida;
}

/**
 * Resuelve varias variables de entorno de una sola lectura del archivo.
 *
 * @param {string[]} claves
 * @param {object} [opciones] - { ruta: string }
 * @returns {Object<string,string>} clave -> valor ('' si no esta)
 */
function resolverVariables(claves, opciones) {
  const archivo = leerArchivoEnv(opciones && opciones.ruta);
  const salida = {};
  for (const clave of claves) {
    const delProceso = process.env[clave];
    if (delProceso !== undefined && delProceso !== null && delProceso !== '') {
      salida[clave] = delProceso;
    } else {
      salida[clave] = archivo[clave] !== undefined ? archivo[clave] : '';
    }
  }
  return salida;
}

module.exports = {
  rutaEnvPorDefecto,
  leerArchivoEnv,
  resolverVariables,
};
