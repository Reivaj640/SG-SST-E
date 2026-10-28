'use strict';
/**
 * 📦985 — Resolver los archivos de una carpeta de la estructura de una empresa.
 *
 * POR QUÉ EXISTE
 * --------------
 * `Portear/src/map_directory.py` (📦866, Fase 3) dejó de guardar la lista de
 * archivos por nodo: el campo `files[]` salió del JSON del mapeo. El motivo
 * que dejaste escrito en el commit fue "mismos 0 consumidores (grep)".
 *
 * ESE GREP ESTABA MAL. `main.js` lee `node.files` en los cuatro handlers de
 * ausentismo (el listado, el PRI.xlsx, editar fila y eliminar fila).
 *
 * Consecuencia real, medida el 28-oct-2026 en el portatil: toda empresa
 * re-mapeada desde el 6-oct-2026 tiene `files: []` en TODAS sus carpetas
 * (Tempoactiva: 364 carpetas, 0 con archivos listados, 269 con archivos en
 * disco). El handler de ausentismo ya no encontraba ningun .xlsx, lanzaba
 * "No hay archivos .xlsx en la carpeta de ausentismo" y la pantalla quedaba
 * vacia con los filtros en "Cargando anios..." para siempre.
 *
 * Las empresas mapeadas antes del 📦866 (Temposum, Aseplus, Asel) siguen con
 * su lista vieja y por eso a ellas les funciona: el bug solo se ve cuando se
 * re-mapea.
 *
 * El resto del repo ya lee el disco (`fsp.readdir(rutaFinal)` en ocho
 * handlers); este modulo centraliza esa lectura para los que dependian de la
 * lista cacheada.
 *
 * REGLAS
 * ------
 * - Si el nodo trae `files[]`, se respeta: son las empresas mapeadas antes del
 *   📦866 y su lista es valida.
 * - Si no trae, se lee la carpeta del disco. `node.path` SI es confiable: el
 *   mapeo siempre lo guarda, y es lo unico que no cambia con la remapeo.
 * - El formato es el mismo que usaba el config: `extension` CON punto y con la
 *   capitalizacion original (`.xlsx`, `.XLSX`), porque los handlers comparan
 *   contra '.xlsx' y no contra 'xlsx'.
 * - Los directorios no son archivos: no entran.
 */

const fsp = require('fs').promises;
const path = require('path');

/**
 * Devuelve los archivos de una carpeta de la estructura.
 *
 * @param {object|null} node Nodo de `structure.structure` (una carpeta).
 * @returns {Promise<Array<{name:string, path:string, extension:string, size:number, modified:*}>>}
 *          Lista vacia si el nodo no existe, no tiene ruta o la carpeta no se
 *          puede leer. NUNCA lanza.
 */
async function resolverArchivosNodo(node) {
  if (!node) return [];

  // 1. La lista del config, si trae algo (empresas mapeadas antes del 📦866).
  const delConfig = Array.isArray(node.files) ? node.files : [];
  if (delConfig.length > 0) return delConfig;

  // 2. Sin lista: se lee la carpeta del disco.
  if (!node.path) return [];

  let entradas;
  try {
    entradas = await fsp.readdir(node.path, { withFileTypes: true });
  } catch (e) {
    console.warn('[STRUCTURE-FILES] No se pudo leer "' + node.path + '": ' + e.message);
    return [];
  }

  const archivos = [];
  for (const e of entradas) {
    if (!e.isFile()) continue;
    const p = path.join(node.path, e.name);
    let size = 0;
    let modified = null;
    try {
      const st = await fsp.stat(p);
      size = st.size;
      modified = st.mtime;
    } catch (err) {
      // El archivo pudo desaparecer entre readdir y stat. No es fatal: se
      // lista igual con size 0, que es lo que se sabe de un archivo que se va.
    }
    archivos.push({
      name: e.name,
      path: p,
      extension: path.extname(e.name),
      size: size,
      modified: modified
    });
  }
  return archivos;
}

module.exports = { resolverArchivosNodo };
