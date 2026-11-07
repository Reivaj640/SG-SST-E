/**
 * tests/web/anexo-encargo-ajustes-pantalla.test.js
 *
 * LA PANTALLA DEL ANEXO DE ENCARGO TRAS LOS AJUSTES DEL ABOGADO (7-nov-2026)
 * ============================================================================
 *
 * Lo que pidió el abogado, en la pantalla:
 *
 *   (a) la Empresa NO se habilita hasta la contrafirma de K+AIR;
 *   (b) una cláusula expresa del mecanismo de firma;
 *   (c) que se verifique QUIÉN firma (documento y calidad);
 *   (d) un SEGUNDO CANAL para el código, distinto del buzón del enlace;
 *   (e) el acta es una constancia, no la copia firmada;
 *   (f) el acta con el §11 forma parte integral del Anexo;
 *   (g) una frase informativa de tratamiento de datos.
 *
 * Este archivo mira la PANTALLA (estática): el HTML que se edita a mano y el
 * script que la corre. Son archivos que se editan a mano, así que aplico
 * §7.2 de PROMPT.md: además de afirmar la forma buena, corro mutaciones en
 * memoria y exijo que el evaluador marque cada una. Un check que no muerde no
 * es un check.
 *
 * Lo que mira la pantalla CON el servicio (que los textos que llegan sean los
 * del módulo, que la declaración cambie con la calidad, que el envío frene
 * sin el documento y sin la segunda casilla) está en
 * `tests/routes/anexo-encargo-pagina.test.js`.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WEB_DIR = path.resolve(__dirname, '..', '..', 'web', 'anexo-encargo');
const HTML_REAL = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const JS_REAL = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');

// =============================================================================
// EL EVALUADOR
// =============================================================================

/**
 * El código SIN comentarios.
 *
 * §7.1: un guard que matchea su propio comentario no guarda nada. Por eso los
 * checks miran el código, no el texto que lo explica.
 *
 * @param {string} js
 * @returns {string}
 */
function soloCodigo(js) {
  return String(js)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/**
 * Evalúa los checks contra un par (html, js) arbitrario, de modo que el mismo
 * código se pueda correr contra los archivos reales y contra mutantes.
 *
 * @param {string} htm
 * @param {string} js
 * @returns {{f: number, fallos: string[]}}
 */
function evaluar(htm, js) {
  const fallos = [];
  const codigo = soloCodigo(js);

  const check = (nombre, ok, motivo) => {
    if (!ok) fallos.push(nombre + (motivo ? ' — ' + motivo : ''));
  };

  // --- El marcado ------------------------------------------------------------

  check('la pantalla tiene la fila del canal del código',
    /<td id="d-canal">/.test(htm),
    'sin la fila la Empresa no sabe dónde esperar el código');

  check('el buzón del enlace no se llama "Correo del código"',
    htm.includes('Correo del enlace') && !htm.includes('Correo del código'),
    'el código NO va a ese buzón: si el encabezado lo dice, la Empresa lo espera ahí');

  check('la pantalla pide el documento de quien firma',
    /<input id="rep-documento"[^>]*>/.test(htm),
    'sin el documento, la representación no se puede verificar');

  check('la pantalla ofrece las dos calidades con las que se puede firmar',
    /<option value="REPRESENTANTE_LEGAL">/.test(htm) && /<option value="DELEGADO">/.test(htm),
    'falta una de las dos calidades: un delegado tiene que poder firmar');

  check('la pantalla tiene la segunda casilla de aceptación',
    /<input id="acepta-tratamiento"[^>]*type="checkbox"/.test(htm),
    'informar del tratamiento de los datos es una obligación distinta de la de '
    + 'acordar el mecanismo: es otra casilla');

  check('la pantalla tiene los tres huecos para los textos legales',
    /id="texto-mecanismo"/.test(htm)
    && /id="texto-declaracion"/.test(htm)
    && /id="texto-tratamiento"/.test(htm),
    'los textos vienen del servicio: la pantalla tiene que tener dónde ponerlos');

  check('la pantalla dice que el acta es una constancia y no la copia firmada',
    htm.includes('no la copia firmada del Anexo'),
    'la Empresa se lleva ese archivo: tiene que saber lo que es');

  // --- El cableado en el script ----------------------------------------------

  check('la pantalla pinta el canal del código que llega del servicio',
    /texto\('d-canal',\s*c\.canal_codigo\)/.test(codigo),
    'la pantalla no puede inventar el canal: tiene que ser el del servicio');

  check('la pantalla pinta los textos legales que llegan del servicio',
    /texto\('texto-mecanismo',\s*t\.mecanismo/.test(codigo)
    && /texto\('texto-tratamiento',\s*t\.tratamiento/.test(codigo),
    'los textos tienen que venir del servicio: el acta y la pantalla tienen que '
    + 'decir EXACTAMENTE lo mismo');

  check('la declaración de representación depende de la calidad elegida',
    /function actualizarDeclaracion\(\)/.test(codigo)
    && /declaracion_delegado/.test(codigo)
    && /cal\.addEventListener\('change',\s*actualizarDeclaracion\)/.test(codigo),
    'un delegado no puede estar firmando la declaración del representante legal');

  check('el envío lleva la aceptación de la información de datos',
    /acepta_tratamiento:\s*el\('acepta-tratamiento'\)\.checked === true/.test(codigo),
    'sin esto el servicio no sabe que la Empresa leyó la información');

  check('el envío lleva el documento y la calidad de quien firma',
    /representante:\s*\{/.test(codigo)
    && /documento:\s*\(el\('rep-documento'\)/.test(codigo)
    && /calidad:\s*\(el\('rep-calidad'\)/.test(codigo),
    'sin esto el método solo probaría control de un buzón');

  check('el cliente frena el envío cuando falta el documento de quien firma',
    /if\s*\(\s*!documento\s*\)\s*\{/.test(codigo),
    'el cliente tiene que frenar el envío, no solo avisar');

  check('el cliente frena el envío cuando no está marcada la segunda casilla',
    /if\s*\(\s*!el\('acepta-tratamiento'\)\s*\|\|\s*el\('acepta-tratamiento'\)\.checked !== true\s*\)\s*\{/.test(codigo),
    'el cliente tiene que frenar el envío, no solo avisar');

  check('la pantalla dice que hasta la contrafirma la Empresa no puede firmar',
    /no puede usar el servicio/.test(codigo),
    'la Empresa tiene que saber que sin la contrafirma no puede firmar');

  return { f: fallos.length, fallos };
}

test('la pantalla pasa todos los checks de los ajustes del abogado', () => {
  const { f, fallos } = evaluar(HTML_REAL, JS_REAL);
  assert.deepEqual(fallos, [], 'checks rotos:\n  ' + fallos.join('\n  '));
  assert.equal(f, 0);
});

// =============================================================================
// LOS MUTANTES
// =============================================================================

const MUTANTES = [
  {
    nombre: 'se borra la fila del canal del código',
    htm: (h) => h.replace(
      /\s*<tr>\s*<th scope="row">Canal del c[oó]digo<\/th>\s*<td id="d-canal">[^<]*<\/td>\s*<\/tr>/,
      ''),
  },
  {
    nombre: 'el buzón del enlace vuelve a llamarse "Correo del código"',
    htm: (h) => h.replace('Correo del enlace', 'Correo del código'),
  },
  {
    nombre: 'se borra el campo del documento de quien firma',
    htm: (h) => h.replace(/<input id="rep-documento"[^>]*>/, ''),
  },
  {
    nombre: 'se borra la opción de delegado',
    htm: (h) => h.replace(/\s*<option value="DELEGADO">[^<]*<\/option>/, ''),
  },
  {
    nombre: 'se borra la segunda casilla de aceptación',
    htm: (h) => h.replace(/<input id="acepta-tratamiento"[^>]*>/, ''),
  },
  {
    nombre: 'se borra el texto legal del mecanismo',
    htm: (h) => h.replace(/<span class="texto-legal" id="texto-mecanismo"><\/span>/, ''),
  },
  {
    nombre: 'el acta deja de decir que no es la copia firmada',
    htm: (h) => h.replace('no la copia firmada del Anexo', 'la copia firmada del Anexo'),
  },
  {
    nombre: 'la pantalla deja de pintar el canal del código',
    js: (j) => j.replace(/^\s*texto\('d-canal', c\.canal_codigo\);\s*$/m, ''),
  },
  {
    nombre: 'la pantalla deja de pintar el texto del mecanismo',
    js: (j) => j.replace(/^\s*texto\('texto-mecanismo', t\.mecanismo \|\| ''\);\s*$/m, ''),
  },
  {
    nombre: 'la pantalla deja de pintar el texto de los datos',
    js: (j) => j.replace(/^\s*texto\('texto-tratamiento', t\.tratamiento \|\| ''\);\s*$/m, ''),
  },
  {
    nombre: 'la declaración deja de cambiar con la calidad',
    js: (j) => j.replace(/if \(cal\) cal\.addEventListener\('change', actualizarDeclaracion\);/, ''),
  },
  {
    nombre: 'la pantalla muestra la misma declaración para las dos calidades',
    js: (j) => j.replace(/declaracion_delegado/g, 'declaracion'),
  },
  {
    nombre: 'el envío no lleva la aceptación de la información de datos',
    js: (j) => j.replace(/acepta_tratamiento: el\('acepta-tratamiento'\)\.checked === true,/, ''),
  },
  {
    nombre: 'el envío no lleva quién firma',
    js: (j) => j.replace(/representante: \{/, 'representante_omitido: {'),
  },
  {
    nombre: 'el cliente no frena el envío sin el documento',
    js: (j) => j.replace('if (!documento) {', 'if (false) {'),
  },
  {
    nombre: 'el cliente no frena el envío sin la segunda casilla',
    js: (j) => j.replace(
      "if (!el('acepta-tratamiento') || el('acepta-tratamiento').checked !== true) {",
      'if (false) {'),
  },
  {
    nombre: 'la pantalla deja de decir que no puede firmar hasta la contrafirma',
    js: (j) => j.replace('no puede usar el servicio', 'ya puede usar el servicio'),
  },
];

for (const m of MUTANTES) {
  test('el mutante "' + m.nombre + '" lo detecta un check', () => {
    const htm = m.htm ? m.htm(HTML_REAL) : HTML_REAL;
    const js = m.js ? m.js(JS_REAL) : JS_REAL;
    assert.notEqual(htm === HTML_REAL && js === JS_REAL, true,
      'la mutación no cambió nada: el mutante está mal escrito (§7.2)');
    const { f } = evaluar(htm, js);
    assert.ok(f > 0, 'el mutante pasó limpio: el check que debería morder está flojo');
  });
}
