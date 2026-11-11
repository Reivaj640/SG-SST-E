'use strict';
/**
 * LA IDENTIDAD DEL ANEXO DE NUBE VIGENTE
 * ============================================================================
 *
 * QUÉ HACE
 * --------
 * Declara, en un solo lugar, cuál es la versión del Anexo de Nube que el
 * servicio suscribe y dónde está su archivo. Es la fuente de verdad de esa
 * identidad, y la usan:
 *
 *   - `services/anexoNube.js` (el que abre la suscripción y calcula la huella)
 *   - `services/readinessLegal.js` (la compuerta que audita)
 *   - `services/empresa.js` (la habilitación de la Empresa)
 *   - `scripts/preflight-anexo-nube.js` (el preflight de la compuerta)
 *
 * POR QUÉ ES UN MÓDULO APARTE Y NO UNA CONSTANTE EN CADA ARCHIVO
 * --------------------------------------------------------------
 * Porque una versión escrita a mano en dos sitios se desalinea en cuanto se
 * publica una nueva. Ya pasó: la compuerta de readiness miraba
 * `legal/anexo-nube-v1.1.html` con la ruta escrita a mano mientras el módulo
 * que suscribe firmaba la versión que declaraba su propia constante. Con la
 * v1.2 publicada, los dos controles habrían hablado de textos distintos y
 * ninguno se habría enterado (PROMPT.md, trampa 138).
 *
 * Y no puede vivir dentro de `anexoNube.js` porque ese módulo requiere
 * `services/empresa.js`, y `empresa.js` necesita la identidad del modelo para
 * comprobar que la Empresa suscribió el texto vigente: importarlo desde ahí
 * sería un ciclo. Este módulo no requiere nada más que `path`, así que no
 * puede entrar en ningún ciclo.
 *
 * LO QUE NO HACE
 * --------------
 * No calcula la huella ni lee el archivo: eso es trabajo de quien necesita el
 * contenido. Aquí solo vive la identidad, que es lo que tiene que ser una.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * La raíz del repo que contiene el Servicio (sgsst-electron-app): ahí vive
 * la carpeta `legal/` con el texto del Anexo de Nube.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * La versión del Anexo de Nube que se puede suscribir.
 *
 * La v1.0 era un MODELO: su propio texto decía que no se firmaba hasta
 * completar el bloque de pendientes. La v1.1 fue la primera susceptible de
 * suscripción (la suscribió ASEPLUS el 5-nov-2026). La v1.2 no llegó a
 * suscribirse: declaraba como pendientes P1, P2, P4 y P5, que se cerraron el
 * 10-nov-2026. La v1.3 es la vigente: corrige ese bloque de pendientes,
 * declara el envío real con el dominio @gesstiar.com que ya existe, remite
 * al Anexo de Encargo versión 2026-11-11 y conserva el papel de Subencargado
 * del proveedor del canal de correo.
 */
const VERSION_MODELO = '1.3';

/**
 * El archivo del texto vigente. El nombre lleva la versión: las versiones
 * anteriores se conservan, cada una con su propia huella.
 */
const RUTA_MODELO = path.join(REPO_ROOT, 'legal', `anexo-nube-v${VERSION_MODELO}.html`);

/**
 * La huella REAL del texto vigente, calculada sobre los BYTES del archivo.
 *
 * Es la misma que registra el modulo que suscribe (`services/anexoNube.js`) y
 * la que contrasta la compuerta de readiness. Vive aqui para que la
 * habilitacion de la Empresa pueda compararla sin un ciclo de imports.
 *
 * Si el archivo no esta (fallo de despliegue), NO se inventa una huella: se
 * devuelve null, y el que la necesita tiene que fallar CERRADO.
 *
 * @returns {string|null}
 */
function huellaModeloVigente() {
  try {
    return crypto.createHash('sha256')
      .update(fs.readFileSync(RUTA_MODELO))
      .digest('hex');
  } catch (_) {
    return null;
  }
}

module.exports = {
  VERSION_MODELO,
  RUTA_MODELO,
  huellaModeloVigente,
};
