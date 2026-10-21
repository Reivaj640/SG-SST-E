/**
 * tests/web/miniapp-reabierto.test.js
 *
 * Cubre el caso real que motiva el cambio: el firmante vuelve a abrir el
 * enlace del correo DESPUÉS de ya haber firmado y se encuentra con
 * "Enlace no disponible", sin salida y sin saber si su documento existe.
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
 * Evaluúa los checks contra un par (html, js) arbitrario, de modo que el
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
  check('la pantalla de error declara un botón de salida',
    htm.includes('id="btn-error-go-verify"'),
    'sin él, el firmante se queda sin salida');

  check('la pantalla de error explica la verificación',
    htm.includes('id="error-verify-hint"'),
    'un botón sin explicación es un botón que da miedo');

  check('la pantalla de error ofrece contactar a RRHH',
    htm.includes('id="error-contact-hint"'),
    'el caso "no llegué a firmar" necesita una acción');

  check('el botón de salida está dentro de screen-error',
    /id="screen-error"[\s\S]*?id="btn-error-go-verify"/.test(htm),
    'si vive en otra pantalla nunca se ve');

  // --- Cableado en el JS -------------------------------------------------
  check('el botón de salida tiene listener',
    /\$\('#btn-error-go-verify'\)[\s\S]{0,200}?addEventListener/.test(js),
    'un botón sin listener es adorno');

  check('el deep-link se detecta con el parámetro verificar=1',
    /get\('verificar'\)\s*===\s*'1'/.test(js),
    'es la URL que genera el errorHandler y el botón');

  check('el deep-link salta la máquina de estados',
    /isVerifyDeepLink\(\)\s*\)\s*\{\s*return showVerifyScreen\(\);/.test(js),
    'sin esto, ?verificar=1 seguiría la ruta normal y no abriría la verificación');

  check('el deep-link se evalúa antes de pedir el contexto',
    js.indexOf('isVerifyDeepLink()') < js.indexOf("apiFetch('/s/' + token)"),
    'si se consulta /s/<token> primero, un enlace vencido muere en el 410 antes de llegar a verificar');

  check('existe un caso explícito sin salida de verificación',
    /allowVerify:\s*false/.test(js),
    'TOKEN_NOT_FOUND y la URL sin token no tienen nada que verificar');

  check('volver desde verificar re-despacha el estado real',
    /btn-back-to-signed[\s\S]{0,300}?init\(\)/.test(js) &&
    !/btn-back-to-signed[\s\S]{0,200}?showScreen\('signed'\)/.test(js),
    'regresar a ciegas puede mostrar "documento firmado" sobre algo sin firmar');

  check('los casos de enlace tienen copy distinguible',
    js.includes('Este enlace ya se usó') &&
    js.includes('Este enlace venció') &&
    js.includes('Este enlace no está disponible'),
    'un mismo texto para "vencido" y "ya usado" esconde el problema real');

  check('el 404 no afirma que el enlace no existe',
    !js.includes('no corresponde a ninguna solicitud de firma'),
    'afirmar que no existe confirma la existencia: la misma respuesta debe servir '
    + 'para un token que nunca existió y para uno que ya no se puede mostrar');

  check('el vencimiento del plazo de conservación tiene su propio copy',
    js.includes('CONSERVACION_VENCIDA') &&
    js.includes('No está disponible por vencimiento del plazo'),
    'vencido el plazo (num. 10.6) no es lo mismo que un enlace vencido: '
    + 'el dato se suprime y no se puede ofrecer la verificación');

  check('reabrir el enlace no promete que el documento se perdió',
    js.includes('puedes verificar su autenticidad') || js.includes('Tu documento sigue aquí'),
    'el mensaje tiene que tranquilizar sin mentir');

  return { f: fallos.length, n: CHECKS_TOTAL, fallos: fallos };
}

const CHECKS_TOTAL = 14;

// =============================================================================
// Los archivos reales pasan
// =============================================================================

test('la mini-app pasa todos los checks de enlace reabierto', () => {
  const { f, fallos } = evaluar(HTML_REAL, JS_REAL);
  assert.deepEqual(fallos, [], 'checks rotos:\n  ' + fallos.join('\n  '));
  assert.equal(f, 0);
});

// =============================================================================
// Cada mutante tiene que morder (§7.2): si un mutante pasa, el check es flojo
// =============================================================================

const MUTANTES = [
  {
    nombre: 'se borra el botón de salida del HTML',
    htm: (h) => h.replace(/\s*<button[^>]*id="btn-error-go-verify"[\s\S]*?<\/button>/, ''),
  },
  {
    nombre: 'se borra el listener del botón',
    js: (j) => j.replace(
      /var btnErr = \$\('#btn-error-go-verify'\);[\s\S]*?\n\s*\}\n/, ''),
  },
  {
    nombre: 'el deep-link compara contra otro valor',
    js: (j) => j.replace(/get\('verificar'\)\s*===\s*'1'/, "get('verificar') === '0'"),
  },
  {
    nombre: 'el deep-link deja de saltar la máquina de estados',
    js: (j) => j.replace(
      /if \(isVerifyDeepLink\(\)\) \{\s*return showVerifyScreen\(\);\s*\}/,
      'if (isVerifyDeepLink()) { /* ya no salta */ }'),
  },
  {
    nombre: 'allowVerify se queda siempre en true',
    js: (j) => j.replace(/allowVerify:\s*false/g, 'allowVerify: true'),
  },
  {
    nombre: 'volver regresa a ciegas a screen-signed',
    js: (j) => j.replace(
      /btnBack\.addEventListener\('click', function \(\) \{[\s\S]*?\}\);/,
      "btnBack.addEventListener('click', function () { showScreen('signed'); });"),
  },
  {
    nombre: 'vencido y ya usado comparten el mismo texto',
    js: (j) => j.replace('Este enlace venció, pero eso no afecta', 'Este enlace ya se usó, pero eso no afecta'),
  },
  {
    nombre: 'se borra la explicación de la verificación',
    htm: (h) => h.replace(/\s*<p class="instructions" id="error-verify-hint">[\s\S]*?<\/p>/, ''),
  },
  {
    nombre: 'se borra la salida a RRHH',
    htm: (h) => h.replace(/\s*<p class="instructions" id="error-contact-hint">[\s\S]*?<\/p>/, ''),
  },
  {
    nombre: 'el 404 y el enlace ya usado comparten el mismo texto',
    js: (j) => j.replace('Este enlace no está disponible', 'Este enlace ya se usó'),
  },
  {
    nombre: 'se pierde el caso de vencimiento del plazo de conservación',
    js: (j) => j.replace(/CONSERVACION_VENCIDA/g, 'OTRO_CODIGO'),
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