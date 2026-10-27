/**
 * tests/web/miniapp-constancia.test.js
 *
 * El botón "VER CONSTANCIA" de la mini-app.
 *
 * Antes estaba oculto en el código: la única ruta que servía la Constancia
 * era la interna (/internal/sign-requests/:id/constancia.pdf, que exige API
 * key) y el Trabajador la recibía por correo. Ahora hay una ruta pública con
 * el token, así que el botón se muestra y descarga desde el propio enlace
 * de firma (5.4 del Acuerdo de uso).
 *
 * Lo que se comprueba acá:
 *
 *  1. El botón EXISTE en el markup y tiene su caja de error.
 *  2. El botón ARRANCA OCULTO: no se expone cuando la firma no está hecha.
 *  3. El JS lo MUESTRA en el camino de firmado y no lo vuelve a ocultar.
 *  4. El JS lo cablea a la ruta PÚBLICA de la Constancia (no a la interna,
 *     que el navegador no puede llamar).
 *  5. El JS MANEJA EL ERROR de la descarga y lo muestra en la pantalla, en
 *     vez de abrir una pestaña con un JSON crudo.
 *  6. La pantalla de firmado no promete una copia por correo: el correo ya
 *     no lleva el archivo adjunto.
 *
 * Estos checks son sobre archivos que se editan a mano, así que aplico §7.2:
 * además de afirmar la forma buena, corro mutaciones en memoria y exijo que
 * el evaluador marque cada una. Un check que no muerde no es un check.
 *
 * No abre la base de datos (PROMPT.md §7.7): lee los dos archivos y nada más.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WEB_DIR = path.resolve(__dirname, '..', '..', 'web', 'firma');
const HTML_REAL = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const JS_REAL = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');

/**
 * Evaluía los checks contra un par (html, js) arbitrario, de modo que el
 * mismo código se pueda correr contra los archivos reales y contra mutantes.
 *
 * @returns {{f: number, n: number, fallos: string[]}}
 */
function evaluar(htm, js) {
  const fallos = [];

  const check = (nombre, ok, motivo) => {
    if (!ok) fallos.push(nombre + (motivo ? ' — ' + motivo : ''));
  };

  // --- Markup -------------------------------------------------------------

  check('el botón VER CONSTANCIA existe',
    htm.includes('id="constancia-link"'),
    'sin el botón, la Constancia solo se podría pedir por correo');

  check('el botón arranca oculto',
    /id="constancia-link"[^>]*\bhidden\b/.test(htm),
    'si arranca visible, se ofrece una Constancia que todavía no existe');

  check('el botón tiene su caja de error',
    htm.includes('id="constancia-error"'),
    'sin caja de error, un fallo de descarga se traga en silencio');

  check('la pantalla de firmado no promete una copia por correo',
    !htm.includes('Se enviará una copia a tu correo'),
    'el correo ya no lleva el archivo adjunto: el texto sería falso');

  // --- Cableado en el JS -------------------------------------------------

  check('el botón se cablea a la ruta pública de la Constancia',
    js.includes("/api/sign/' + state.token + '/constancia.pdf"),
    'la ruta interna exige API key: el navegador no puede llamarla');

  check('el JS muestra el botón',
    /showEl\(link\)/.test(js),
    'sin showEl el botón queda oculto para siempre');

  check('el JS no vuelve a ocultarlo con style.display',
    !/\$\('#constancia-link'\)[\s\S]{0,300}?style\.display\s*=\s*'none'/.test(js),
    'es el hiding que tenía antes, y dejaría el botón muerto');

  check('el cableado cuelga de la pantalla de firmado',
    /function wireSignedDownloads\(\)\s*\{[\s\S]{0,900}?wireConstanciaDownload\(\);/.test(js),
    'si se cablea desde otro lado, el botón se ofrece sin que haya firma');

  check('el JS maneja el error de la descarga',
    js.includes("$('#constancia-error')") &&
      /errorEl\.textContent\s*=\s*err\.message/.test(js) &&
      /errorEl\.hidden\s*=\s*false/.test(js),
    'sin esto, un 409/410 se abre como JSON crudo en otra pestaña');

  return { f: fallos.length, n: CHECKS_TOTAL, fallos: fallos };
}

const CHECKS_TOTAL = 9;

// =============================================================================
// Los archivos reales pasan
// =============================================================================

test('la mini-app pasa todos los checks del botón de Constancia', () => {
  const { f, fallos } = evaluar(HTML_REAL, JS_REAL);
  assert.deepEqual(fallos, [], 'checks rotos:\n  ' + fallos.join('\n  '));
  assert.equal(f, 0);
});

// =============================================================================
// Cada mutante tiene que morder (§7.2): si un mutante pasa, el check es flojo
// =============================================================================

const MUTANTES = [
  {
    nombre: 'se borra el botón VER CONSTANCIA del HTML',
    htm: (h) => h.replace(/\s*<a id="constancia-link"[\s\S]*?<\/a>/, ''),
  },
  {
    nombre: 'el botón deja de arrancar oculto',
    htm: (h) => h.replace(/(<a id="constancia-link"[^>]*?)\s+hidden/, '$1'),
  },
  {
    nombre: 'se borra la caja de error de la Constancia',
    htm: (h) => h.replace(/\s*<p id="constancia-error"[\s\S]*?<\/p>/, ''),
  },
  {
    nombre: 'el botón vuelve a prometer una copia por correo',
    htm: (h) => h.replace(
      'Se enviará un aviso a tu correo',
      'Se enviará una copia a tu correo'),
  },
  {
    nombre: 'el botón se cablea a la ruta interna (exige API key)',
    js: (j) => j.replace(
      /\/api\/sign\/' \+ state\.token \+ '\/constancia\.pdf/g,
      "/internal/sign-requests/' + state.token + '/constancia.pdf"),
  },
  {
    nombre: 'el botón se oculta en vez de mostrarse',
    js: (j) => j.replace(
      /showEl\(link\);/,
      "link.style.display = 'none';"),
  },
  {
    nombre: 'se borra el mensaje de error de la descarga',
    js: (j) => j.replace(
      /errorEl\.textContent\s*=\s*err\.message/,
      "errorEl.textContent = '';"),
  },
  {
    nombre: 'se borra el cableado de la Constancia en la pantalla de firmado',
    js: (j) => j.replace(/\n\s*wireConstanciaDownload\(\);/, ''),
  },
];

for (const m of MUTANTES) {
  test('el mutante "' + m.nombre + '" lo detecta un check', () => {
    const htm = m.htm ? m.htm(HTML_REAL) : HTML_REAL;
    const js = m.js ? m.js(JS_REAL) : JS_REAL;
    assert.notEqual(htm === HTML_REAL && js === JS_REAL, true,
      'la mutación no cambió nada: el mutante está mal escrito (§7.5)');
    const { f } = evaluar(htm, js);
    assert.ok(f > 0, 'el mutante pasó limpio: el check que debería morder está flojo');
  });
}
