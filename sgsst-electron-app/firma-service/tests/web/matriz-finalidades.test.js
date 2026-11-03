/**
 * C-2 · La mini-app pone la MATRIZ DE FINALIDADES a disposición del Firmante
 * antes de habilitar la casilla de aceptación.
 *
 * Estos tests leen los archivos de `web/firma/` como texto y no levantan
 * servidor ni BD, así que corren con un `node --test` pelado. Es el mismo
 * criterio que tests/web/bloque-empresa.test.js: si la suite completa no
 * arranca por el binario nativo, esta parte del feature no puede quedar sin
 * cubrir.
 *
 * Que se prueba:
 *  - Que el panel de la matriz exista y esté ANTES de las casillas.
 *  - Que se pinte con textContent y NUNCA con innerHTML.
 *  - Que la casilla de aceptación NO se habilite con el Acuerdo solo: hacen
 *    falta los DOS textos leídos.
 *  - Que el Firmante declare el medio por el que se le pusieron a disposición
 *    las políticas.
 *
 * Cada asercion tiene una mutacion que se verifica que muerde
 * (ver PROMPT.md §7.2).
 *
 * Tests:
 *   - node --test tests/web/matriz-finalidades.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB_DIR = path.join(__dirname, '..', '..', 'web', 'firma');
const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');

/**
 * Quita comentarios de linea y de bloque del codigo.
 *
 * Hace falta porque los comentarios mencionan las mismas palabras que los
 * tests buscan: sin esta limpieza, una asercion pasaria por un comentario y
 * no por el codigo, que es justo el falso verde que PROMPT.md §7.2 prohibe.
 */
function _sinComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Corta el cuerpo de una funcion del app.js, para poder afirmar sobre el sin
 * ruido de las demas funciones.
 */
function _cuerpo(nombre) {
  const inicio = js.indexOf('function ' + nombre);
  assert.notEqual(inicio, -1, `debe existir ${nombre} en app.js`);
  const fin = js.indexOf('\n  function ', inicio);
  return js.slice(inicio, fin === -1 ? js.length : fin);
}

const codigoJs = _sinComentarios(js);
const cuerpoRenderAcuerdo = _sinComentarios(_cuerpo('renderAcuerdo'));
const cuerpoRenderMatriz = _sinComentarios(_cuerpo('renderMatrizFinalidades'));
const cuerpoHabilitacion = _sinComentarios(_cuerpo('actualizarHabilitacionAceptacion'));

// =========================================================================
// 1. EL PANEL EXISTE Y ESTÁ ANTES DE LAS CASILLAS
// =========================================================================

test('C-2: el panel de la matriz de finalidades existe en la pantalla de firma', () => {
  assert.ok(html.includes('id="matriz-panel"'),
    'debe existir el contenedor #matriz-panel');
  assert.ok(html.includes('id="matriz-texto"'),
    'debe existir el recuadro #matriz-texto donde se pinta la matriz');
  assert.ok(html.includes('id="matriz-version"'),
    'debe existir el lugar donde se muestra la versión de la matriz');
  assert.ok(html.includes('id="matriz-huella"'),
    'debe existir el lugar donde se muestra la huella de la matriz');
});

test('C-2: el panel de la matriz está antes de las casillas de manifestación', () => {
  const iPanel = html.indexOf('id="matriz-panel"');
  const iCasillas = html.indexOf('id="consentimiento_aceptado"');
  assert.notEqual(iPanel, -1);
  assert.notEqual(iCasillas, -1);
  assert.ok(iPanel < iCasillas,
    'la matriz tiene que estar antes de la casilla que habilita la aceptación');
});

test('C-2: la matriz se pinta con textContent y nunca con innerHTML', () => {
  assert.ok(cuerpoRenderMatriz.includes('textContent'),
    'la matriz tiene que pintarse con textContent');
  for (const prohibido of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write']) {
    assert.ok(!cuerpoRenderMatriz.includes(prohibido),
      `la matriz no se puede pintar con ${prohibido}`);
  }
});

// =========================================================================
// 2. LA CASILLA SOLO SE HABILITA CON LOS DOS TEXTOS LEÍDOS
// =========================================================================

test('C-2: la casilla de aceptación exige el Acuerdo Y la matriz leídos', () => {
  assert.ok(cuerpoHabilitacion.includes('#acuerdo-panel'),
    'la habilitación tiene que mirar el panel del Acuerdo');
  assert.ok(cuerpoHabilitacion.includes('#matriz-panel'),
    'la habilitación tiene que mirar el panel de la matriz');
  assert.ok(cuerpoHabilitacion.includes("dataset.leido === '1'"),
    'la habilitación tiene que exigir que el texto quedara leido');
  assert.ok(cuerpoHabilitacion.includes('check.disabled'),
    'la habilitación tiene que decidir el estado de la casilla');
});

test('C-2: leer el Acuerdo solo NO habilita la casilla', () => {
  // El Agreement marca su panel como leido y delega en la habilitacion
  // compartida: NO puede habilitar la casilla por su cuenta.
  assert.ok(cuerpoRenderAcuerdo.includes("dataset.leido = '1'"),
    'el Acuerdo tiene que marcar que su texto quedo leido');
  assert.ok(cuerpoRenderAcuerdo.includes('actualizarHabilitacionAceptacion()'),
    'el Acuerdo tiene que delegar en la habilitacion compartida');
  assert.ok(!/check\.disabled\s*=\s*false/.test(cuerpoRenderAcuerdo),
    'el Acuerdo no puede habilitar la casilla por su cuenta: falta la matriz');
});

test('C-2: leer la matriz sola NO habilita la casilla', () => {
  assert.ok(cuerpoRenderMatriz.includes("dataset.leido = '1'"),
    'la matriz tiene que marcar que su texto quedo leido');
  assert.ok(cuerpoRenderMatriz.includes('actualizarHabilitacionAceptacion()'),
    'la matriz tiene que delegar en la habilitacion compartida');
  assert.ok(!/check\.disabled\s*=\s*false/.test(cuerpoRenderMatriz),
    'la matriz no puede habilitar la casilla por su cuenta: falta el Acuerdo');
});

test('C-2: la matriz se pinta al montar la pantalla del documento', () => {
  assert.ok(codigoJs.includes('renderMatrizFinalidades(state.contexto)'),
    'la pantalla del documento tiene que pintar la matriz');
  const i = codigoJs.indexOf('renderMatrizFinalidades(state.contexto)');
  const j = codigoJs.indexOf('renderAcuerdo(state.contexto)');
  assert.ok(i !== -1 && j !== -1);
});

// =========================================================================
// 3. EL FIRMANTE DECLARA EL MEDIO
// =========================================================================

test('J3: el Firmante declara el medio por el que se le pusieron a disposición las políticas', () => {
  assert.ok(codigoJs.includes("medio_disposicion: 'pantalla_firma'"),
    'el POST de aceptación tiene que declarar el medio');
  const i = codigoJs.indexOf("medio_disposicion: 'pantalla_firma'");
  const j = codigoJs.indexOf('/consent/accept');
  assert.ok(j !== -1 && i > j,
    'el medio tiene que declararse en la llamada de aceptación');
});
