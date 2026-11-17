// =====================================================================
// 📦1083 — El cache-bust de la vista de anexos (los tres `?v=`)
// Ejecutar: node --test main/test-cache-bust-anexos-1083.js
//
// QUE PROTEGE ESTE ARCHIVO
// ------------------------
//
// La vista del operador de anexos se carga en el IFRAME de Configuración, y
// esa cadena tiene TRES cache-bust, no uno:
//
//   1. `renderer.js`  → el `?v=` del IFRAME: el cache-bust del DOCUMENTO
//                        (`components/config/config-viewer.html`).
//   2. `config-viewer.html` → el `?v=` de la HOJA del panel.
//   3. `config-viewer.html` → el `?v=` del SCRIPT del panel.
//
// LOS TRES TIENEN QUE IR AL COMPAS. Por qué:
//
//   - Si el del documento se queda viejo, el iframe sirve la versión vieja de
//     `config-viewer.html` y el panel del operador NO APARECE: el síntoma es
//     "no hay nada", y la causa está en un archivo que nadie tocó.
//   - Si la hoja y el script llevan tokens distintos, la página carga dos
//     versiones de la misma vista: es la clase de bug que se persigue como si
//     fuera de estilos (HTML nuevo con CSS viejo).
//
// El token del panel lleva el prefijo `GH-` y el del iframe no (el del iframe
// lo exige el formato `\d{8}-[\w-]+` del test del 📦751). Por eso el guard
// compara el token del panel SIN el prefijo con el del iframe.
//
// 📦1083 · Este guard nació de un defecto REAL del 📦1082: el 📦1082 bumpeó el
// `?v=` del script del panel y dejó el de la hoja y el del iframe con los
// tokens viejos. El botón del Nube estaba escrito y el panel, en el navegador
// con la cache, seguía mostrando la versión anterior.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CONFIG_HTML = path.join(ROOT, 'components', 'config', 'config-viewer.html');
const RENDERER = path.join(ROOT, 'renderer.js');

const srcConfig = fs.readFileSync(CONFIG_HTML, 'utf8');
const srcRenderer = fs.readFileSync(RENDERER, 'utf8');

function tokenDe(texto, re) {
  const m = texto.match(re);
  return m ? m[1] : null;
}

test('cache-bust · los tres tokens de la vista de anexos estan', function () {
  const iframe = tokenDe(srcRenderer, /config-viewer\.html\?v=([^\s"']+)/);
  const css = tokenDe(srcConfig, /firma-operador\/index\.css\?v=([^\s"']+)/);
  const js = tokenDe(srcConfig, /firma-operador\/index\.js\?v=([^\s"']+)/);

  assert.ok(iframe, 'el iframe de Configuracion tiene que llevar su ?v=');
  assert.ok(css, 'la hoja del panel tiene que llevar su ?v=');
  assert.ok(js, 'el script del panel tiene que llevar su ?v=');
});

test('cache-bust · la hoja y el script del panel comparten el MISMO token', function () {
  const css = tokenDe(srcConfig, /firma-operador\/index\.css\?v=([^\s"']+)/);
  const js = tokenDe(srcConfig, /firma-operador\/index\.js\?v=([^\s"']+)/);
  assert.equal(css, js,
    'la hoja y el script de la MISMA vista tienen que llevar el mismo token: ' +
    'si no, la pagina carga dos versiones de la vista');
});

test('cache-bust · el token del iframe es el del panel (sin el prefijo GH-)', function () {
  const iframe = tokenDe(srcRenderer, /config-viewer\.html\?v=([^\s"']+)/);
  const js = tokenDe(srcConfig, /firma-operador\/index\.js\?v=([^\s"']+)/);
  assert.equal(iframe, js.replace(/^GH-/, ''),
    'el cache-bust del documento y el del panel tienen que ir al compas: ' +
    'el iframe tiene que pedir el documento de esta tanda');
});

test('cache-bust · el token del iframe tiene el formato que exige el test del 751', function () {
  // Mismo criterio que `test-config-premium-v2.js`: se valida el FORMATO del
  // token, no su valor exacto (fijar el valor rompe el test en cada bumpe).
  const iframe = tokenDe(srcRenderer, /config-viewer\.html\?v=([^\s"']+)/);
  assert.match(iframe, /^\d{8}-[\w-]+$/,
    'el token del iframe tiene que ser fecha-sufijo: ' + iframe);
});

test('cache-bust · el token del panel no retrocede', function () {
  const js = tokenDe(srcConfig, /firma-operador\/index\.js\?v=([^\s"']+)/);
  const fecha = /(\d{8})/.exec(js);
  assert.ok(fecha, 'el token tiene que traer la fecha del paquete: ' + js);
  assert.ok(Number(fecha[1]) >= 20261107,
    'el token del panel no puede retroceder a uno anterior al de 20261107: ' + js);
});

test('cache-bust · renderer.js conserva su EOL CRLF y config-viewer.html su LF', function () {
  // El EOL de cada archivo esta fijado por su test: cambiarlo rompe el diff
  // entero del archivo.
  const ren = fs.readFileSync(RENDERER);
  const cfg = fs.readFileSync(CONFIG_HTML);
  assert.equal(/\r\n/.test(ren), true, 'renderer.js es CRLF');
  assert.equal(/(?<!\r)\n/.test(ren), false, 'renderer.js no puede tener LF solo');
  assert.equal(/\r\n/.test(cfg), false, 'config-viewer.html es LF puro');
  assert.equal(cfg[0] === 0xef && cfg[1] === 0xbb && cfg[2] === 0xbf, false,
    'config-viewer.html no puede tener BOM');
});
