/**
 * LA FORMA DEL MANIFIESTO LEGAL
 * =============================
 *
 * El manifiesto (`legal-readiness.json`) lo escriben DOS scripts: el del Anexo
 * de Nube y el del Anexo de Encargo. Cada uno edita SU bloque, pero los dos
 * escriben el MISMO archivo. Si cada uno lo deja con una forma distinta, los
 * dos `--check` se contradicen: el del Nube dice "el manifiesto tiene un
 * estado distinto del que se escribiria" sobre un manifiesto cuyo estado es
 * exactamente el que hay. Eso ocurrio el 11-nov-2026 en la copia de prueba,
 * porque el script del Encargo escribia el objeto de la facultad en una sola
 * linea y el del Nube lo escribia en varias. Un check que reporta una
 * diferencia donde no hay ninguna es un check que no se puede usar.
 *
 * LA FORMA CANONICA
 * -----------------
 * `asciiEscape(JSON.stringify(objeto, null, 2)) + '\n'`.
 *
 * EL `asciiEscape` es lo que la hace posible. Sin el, `JSON.stringify`
 * convierte cada escape `\u00f3` en el caracter real, el archivo deja de ser
 * ASCII puro y el diff entero se mueve. Con el, los escapes se conservan tal
 * cual: el manifiesto canonico es byte a byte el mismo archivo que esta
 * (comprobado sobre el manifiesto del repo y sobre el de produccion).
 *
 * LO QUE COMPARA EL `--check`
 * ---------------------------
 * El ESTADO, no los bytes. Dos archivos con el mismo estado y distinta forma
 * son el mismo manifiesto. Por eso la comparacion va sobre el objeto
 * parseado: `mismoEstado(loQueHabria, loQueHay)`.
 */
'use strict';

/**
 * Escapa lo que no es ASCII, para que el manifiesto sea JSON ASCII puro.
 *
 * @param {string} s
 * @returns {string}
 */
function asciiEscape(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c > 0x7f) {
      if (c > 0xffff) {
        const v = c - 0x10000;
        out += '\\u' + (0xd800 + (v >> 10)).toString(16).padStart(4, '0')
          + '\\u' + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0');
      } else {
        out += '\\u' + c.toString(16).padStart(4, '0');
      }
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * La forma canonica del manifiesto: los bytes que hay que escribir.
 *
 * @param {object} objeto
 * @returns {string}
 */
function formaCanonica(objeto) {
  return asciiEscape(JSON.stringify(objeto, null, 2)) + '\n';
}

/**
 * Dos objetos describen el MISMO estado.
 *
 * `JSON.stringify` respeta el orden de las claves, y los dos objetos salen
 * del mismo archivo, asi que la comparacion es de estado y no de forma.
 *
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
function mismoEstado(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  asciiEscape,
  formaCanonica,
  mismoEstado,
};
