'use strict';
/**
 * 📦986 (2026-10-28) — Verificar que un interprete de Python tenga las
 * dependencias que necesitan los scripts de Portear.
 *
 * POR QUE EXISTE
 * --------------
 * `getPython()` en `main.js` solo comprobaba `python --version`. Eso deja pasar
 * cualquier Python del PATH: el 3.14 de esta maquina responde `--version` pero
 * no tiene pandas. El fallo NO aparecia al arrancar, sino a mitad de uso, como
 * `ModuleNotFoundError: No module named 'pandas'` al registrar una incapacidad,
 * sin ninguna pista de que faltara el runtime.
 *
 * Lo que se vio el 28-oct-2026 en el portatil: `Portear/python-embed/` tenia las
 * 143 librerias instaladas (pandas 2.2.3, openpyxl 3.1.5, numpy 2.4.3, todas
 * cp311) pero LE FALTABA el runtime: ni `python.exe`, ni `python311.dll`, ni
 * `python311.zip`, ni el `python311._pth`. Como `python-embed/` esta en
 * `.gitignore`, el runtime nunca estuvo en el repo y hay que instalarlo por
 * maquina (`scripts/prepare-python-embed.bat`).
 *
 * REGLAS
 * ------
 * - `pandas` y `openpyxl` son las minimas: sin ellas no funcionan ni el
 *   registro de ausentismo ni las actas ni el mapeo de indicadores.
 * - La funcion NUNCA lanza: responde true/false. Para un chequeo de arranque
 *   interesa saber "no sirve", no recibir una excepcion.
 */

const { execFile } = require('child_process');

/** Dependencias minimas para que los scripts de Portear funcionen. */
const PYTHON_DEPS_REQUERIDAS = ['pandas', 'openpyxl'];

function _execFilePromise(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true, timeout: 120000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        } else {
          resolve({ stdout: stdout, stderr: stderr });
        }
      });
  });
}

/**
 * ¿Este interprete puede importar las dependencias que necesita Portear?
 *
 * @param {string|null} pythonPath Ruta a python.exe.
 * @param {string[]} [deps] Dependencias a comprobar (por defecto, las minimas).
 * @returns {Promise<boolean>} true si puede importarlas; false si no, si el
 *          interprete no existe o si el import falla por cualquier motivo.
 */
async function pythonTieneDependencias(pythonPath, deps) {
  const requeridas = Array.isArray(deps) && deps.length ? deps : PYTHON_DEPS_REQUERIDAS;
  if (!pythonPath) return false;
  try {
    await _execFilePromise(pythonPath, ['-c', 'import ' + requeridas.join(', ')]);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { pythonTieneDependencias, PYTHON_DEPS_REQUERIDAS };
