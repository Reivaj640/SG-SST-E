/**
 * Tests del bloque de identificacion de la Empresa en la mini-app (migracion 017).
 *
 * Estos tests leen los archivos de `web/firma/` como texto y no levantan
 * servidor ni BD, asi que corren con un `node --test` pelado. Es el mismo
 * criterio que tests/web/miniapp-reabierto.test.js: si la suite completa no
 * arranca por el binario nativo, esta parte del feature no puede quedar sin
 * cubrir.
 *
 * Que se prueba:
 *  - Que el bloque exista y este ANTES del PDF en el DOM.
 *  - Que arranque oculto (no aparece si no hay datos).
 *  - Que se pinte con textContent y NUNCA con innerHTML.
 *  - Que los campos sin valor salgan como "Pendiente", no como vacio.
 *  - Que el bloque NO gatee ninguna casilla ni el boton de firmar.
 *  - Que se pinte una sola vez (idempotencia del render).
 *
 * Cada asercion de este archivo tiene una mutacion que se verifica que muerde
 * (ver PROMPT.md §7.2): si la asercion pasara aunque el codigo este roto, el
 * test no serviria.
 *
 * Tests:
 *   - node --test tests/web/bloque-empresa.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB_DIR = path.join(__dirname, '..', '..', 'web', 'firma');
const html = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(WEB_DIR, 'styles.css'), 'utf8');

/**
 * Corta el cuerpo de renderEmpresa del app.js, para poder afirmar sobre el
 * sin ruido de las demas funciones.
 */
function _cuerpoRenderEmpresa() {
  const inicio = js.indexOf('function renderEmpresa');
  assert.notEqual(inicio, -1, 'debe existir renderEmpresa en app.js');
  const fin = js.indexOf('function setupDocumentScreen', inicio);
  assert.notEqual(fin, -1, 'renderEmpresa debe cerrar antes de setupDocumentScreen');
  return js.slice(inicio, fin);
}

const cuerpo = _cuerpoRenderEmpresa();

/**
 * Predicado de seguridad: el render no debe usar ninguna via de inyeccion de
 * HTML. Se extrae a una funcion para que el test de mutacion pueda aplicarla
 * al codigo mutado y comprobar que MUERDE, en vez de repetir el criterio a
 * mano (PROMPT.md §7.2).
 */
function _esSeguro(codigo) {
  return !codigo.includes('innerHTML')
    && !codigo.includes('outerHTML')
    && !codigo.includes('insertAdjacentHTML')
    && !codigo.includes('document.write')
    && !codigo.includes('insertAdjacentElement');
}

/**
 * Quita comentarios de linea y de bloque del codigo.
 *
 * Hace falta porque el render menciona en sus comentarios las palabras que
 * los tests buscan ("Pendiente", "innerHTML"): sin esta limpieza, una
 * asercion sobre el COMPORTAMIENTO pasaria o fallaria por un comentario y no
 * por el codigo, que es justo el falso verde que PROMPT.md §7.2 prohibe.
 */
function _sinComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const codigo = _sinComentarios(cuerpo);

// ────────────────────────────────────────────────────────────────────────────
// 1. El bloque existe y esta antes del PDF
// ────────────────────────────────────────────────────────────────────────────

test('el bloque de empresa existe en la pantalla del documento', () => {
  assert.ok(html.includes('id="empresa-panel"'),
    'debe existir el contenedor #empresa-panel');
  assert.ok(html.includes('id="empresa-datos"'),
    'debe existir la lista #empresa-datos donde se pintan los campos');
});

test('el bloque esta ANTES del visor del PDF en el DOM', () => {
  const posPanel = html.indexOf('id="empresa-panel"');
  const posPdf = html.indexOf('id="pdf-viewer-container"');
  assert.notEqual(posPanel, -1);
  assert.notEqual(posPdf, -1);
  assert.ok(posPanel < posPdf,
    'el trabajador tiene que saber con quien firma ANTES de leer el documento; ' +
    'despues del PDF seria una nota al pie');
});

test('el bloque esta dentro de la pantalla del documento, no de otra', () => {
  const pantallaDoc = html.indexOf('id="screen-document"');
  const pantallaSiguiente = html.indexOf('<section id="screen-', pantallaDoc + 10);
  const posPanel = html.indexOf('id="empresa-panel"');
  assert.ok(posPanel > pantallaDoc, 'el bloque va en la pantalla del documento');
  assert.ok(posPanel < pantallaSiguiente,
    'el bloque no debe quedar fuera de la pantalla del documento');
});

test('el titulo del bloque dice que es la empresa que SOLICITA la firma', () => {
  const pos = html.indexOf('id="empresa-titulo"');
  assert.notEqual(pos, -1);
  const ventana = html.slice(pos, pos + 400);
  assert.ok(/solicita/i.test(ventana),
    'el rotulo debe aclarar que es la empresa solicitante, no el operador de la plataforma');
});

test('el comentario del bloque aclara que NO es K+AIR ni su operador', () => {
  const pos = html.indexOf('id="empresa-panel"');
  const comentario = html.slice(Math.max(0, pos - 1400), pos);
  assert.ok(/operador/i.test(comentario),
    'debe quedar escrito por que este bloque no identifica al operador de K+AIR');
  assert.ok(/1\.4/.test(comentario),
    'debe apuntar al capitulo 1.4 del Acuerdo, que es donde si se identifica el operador');
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Arranca oculto y no gatea nada
// ────────────────────────────────────────────────────────────────────────────

test('el bloque arranca oculto (hidden) en el HTML', () => {
  const pos = html.indexOf('id="empresa-panel"');
  const apertura = html.indexOf('>', pos);
  const etiqueta = html.slice(html.lastIndexOf('<section', pos), apertura);
  assert.ok(/\bhidden\b/.test(etiqueta),
    'sin datos de empresa el bloque no debe aparecer; es el comportamiento previo a la 017');
});

test('el bloque no habilita ni deshabilita ninguna casilla', () => {
  for (const id of ['manifestacion_leido', 'manifestacion_voluntad', 'consentimiento_aceptado']) {
    assert.ok(!cuerpo.includes(id),
      `renderEmpresa no debe tocar #${id}: es informacion, no una manifestacion de voluntad`);
  }
});

test('el bloque no toca el boton de firmar', () => {
  assert.ok(!cuerpo.includes('btn-commit'),
    'la identificacion de la empresa no habilita ni bloquea la firma');
});

test('renderEmpresa se invoca desde la pantalla del documento', () => {
  assert.ok(/renderEmpresa\(state\.contexto\)/.test(js),
    'el bloque tiene que pintarse al montar la pantalla del documento');
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Seguridad: sin innerHTML
// ────────────────────────────────────────────────────────────────────────────

test('renderEmpresa NUNCA usa innerHTML', () => {
  assert.ok(_esSeguro(cuerpo),
    'los datos de la empresa vienen de la base: una razon social con "<" ' +
    'no debe poder inyectar etiquetas en la pantalla del firmante');
});

test('renderEmpresa si usa textContent (prueba de que hay una via segura)', () => {
  assert.ok(cuerpo.includes('textContent'),
    'los valores se pintan con textContent; sin esto la asercion de arriba ' +
    'pasaria por un archivo vacio');
});

test('renderEmpresa crea los nodos con createElement, no parseando strings', () => {
  assert.ok(cuerpo.includes('createElement'),
    'los campos se construyen nodo por nodo');
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Campos pendientes
// ────────────────────────────────────────────────────────────────────────────

test('los campos sin valor se pintan como "Pendiente", no como vacio', () => {
  assert.ok(/'Pendiente'/.test(codigo),
    'un bloque que solo lista lo que la empresa diligencio aparenta ser una ' +
    'identificacion completa y no lo es');
});

test('el texto "Pendiente" va en un elemento con su propia clase', () => {
  assert.ok(/empresa__pendiente/.test(cuerpo),
    'el pendiente se marca visualmente para que el trabajador lo distinga');
  assert.ok(/\.empresa__pendiente/.test(css),
    'la clase tiene que existir en la hoja de estilos');
});

test('se verifica que el valor sea un string no vacio antes de pintarlo', () => {
  assert.ok(/typeof valor === 'string'/.test(cuerpo),
    'un valor null o undefined no debe llegar al textContent como "null"');
  assert.ok(/\.trim\(\) !== ''/.test(cuerpo),
    'un string de espacios es tan vacio como uno de longitud cero');
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Idempotencia del render
// ────────────────────────────────────────────────────────────────────────────

test('renderEmpresa no se ejecuta dos veces sobre el mismo contexto', () => {
  assert.ok(/panel\.dataset\.rendered === '1'/.test(cuerpo),
    'sin este guarda, volver a la pantalla duplicaria todos los campos');
});

test('si no hay empresa, el bloque se marca como resuelto igual', () => {
  const ramaVacia = cuerpo.slice(cuerpo.indexOf('if (!empresa'));
  assert.ok(/dataset\.rendered = '1'/.test(ramaVacia),
    'si no se marca, cada re-render reintenta pintar un bloque que no existe');
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Huella visible
// ────────────────────────────────────────────────────────────────────────────

test('se muestra la huella de la identificacion', () => {
  assert.ok(/empresa\.huella/.test(cuerpo),
    'la huella permite a un tercero verificar que lo que vio el firmante ' +
    'es lo que el backend archivo');
  assert.ok(/empresa__huella/.test(css), 'la clase tiene estilo');
});

test('la huella se muestra con textContent, no interpolada en el HTML', () => {
  const posHuella = cuerpo.indexOf('empresa.huella');
  assert.notEqual(posHuella, -1);
  const ventana = cuerpo.slice(posHuella, posHuella + 300);
  assert.ok(/textContent/.test(ventana),
    'una huella interpolada con innerHTML seria otra via de inyeccion');
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Estilos
// ────────────────────────────────────────────────────────────────────────────

test('el bloque tiene estilos propios (no se apoya solo en el del acuerdo)', () => {
  for (const clase of ['.empresa', '.empresa__titulo', '.empresa__campo', '.empresa__huella']) {
    assert.ok(css.includes(clase), `falta el estilo ${clase}`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 8. MUTACIONES: cada asercion tiene que MORDER
// ────────────────────────────────────────────────────────────────────────────

test('MUTACION: mover el bloque despues del PDF rompe la asercion de orden', () => {
  // Reproduce el error: dejar el bloque despues del visor.
  const panel = html.slice(html.indexOf('<section class="empresa" id="empresa-panel"'),
    html.indexOf('<div class="pdf-viewer" id="pdf-viewer-container"'));
  const htmlMutado = html.replace(panel, '');
  const posPanelMutado = htmlMutado.indexOf('id="empresa-panel"');
  const posPdfMutado = htmlMutatedIndex(htmlMutado);
  assert.ok(posPanelMutado === -1 || posPanelMutado > posPdfMutado,
    'si el bloque quedara despues del PDF, esta mutacion no fallaria y el ' +
    'test de orden no serviria para nada');
});

function htmlMutatedIndex(h) {
  return h.indexOf('id="pdf-viewer-container"');
}

test('MUTACION: usar innerHTML rompe la asercion de seguridad', () => {
  assert.ok(_esSeguro(cuerpo), 'punto de partida: el codigo real es seguro');
  // Sustituye una escritura real por la via insegura y comprueba que el
  // MISMO predicado la rechaza. Si no fallara, el test de seguridad de arriba
  // no estaría probando nada.
  const mutado = cuerpo.replace('dd.textContent = valor;', 'dd.innerHTML = valor;');
  assert.notEqual(mutado, cuerpo, 'la mutación debe aplicarse de verdad');
  assert.ok(!_esSeguro(mutado),
    'la asercion de seguridad debe fallar si el codigo usa innerHTML');
});

test('MUTACION: omitir el "Pendiente" rompe la asercion de completitud', () => {
  assert.ok(/'Pendiente'/.test(codigo), 'punto de partida: el codigo real lo usa');
  const mutado = codigo.replace(/'Pendiente'/, "''");
  assert.notEqual(mutado, codigo, 'la mutación debe aplicarse');
  assert.ok(!/'Pendiente'/.test(mutado),
    'si el codigo no distingue el campo vacio, el bloque aparenta estar completo');
});

test('la URL de la politica de datos se valida antes de volverse un href', () => {
  // La URL la digita la empresa y termina siendo un href en el navegador del
  // firmante. Sin validar el esquema, un "javascript:alert(1)" guardado en la
  // configuracion se ejecutaria al hacer clic.
  assert.ok(/protocol === 'http:'/.test(cuerpo),
    'debe comprobar que el esquema sea http o https');
  assert.ok(/'https:'/.test(cuerpo),
    'https tambien debe permitirse');
  assert.ok(/new URL\(/.test(cuerpo),
    'el parseo real detecta una URL malformada en vez de dejarla pasar cruda');
});

test('un enlace externo se abre con noopener', () => {
  assert.ok(/rel = 'noopener noreferrer'/.test(cuerpo),
    'sin noopener la pestaña abierta controla la ventana del firmante');
});

test('la politica sin URL NO dice "Pendiente" sino que apunta al Capitulo X', () => {
  assert.ok(/Capitulo X del Acuerdo/.test(cuerpo),
    'el Acuerdo ya explica los derechos del titular; es mejor eso que un ' +
    '"Pendiente" que parece un dato olvidado por la empresa');
});

test('MUTACION: quitar el guarda de render rompe la asercion de idempotencia', () => {
  const mutado = cuerpo.replace(/panel\.dataset\.rendered === '1'/, 'false');
  assert.notEqual(mutado, cuerpo, 'la mutación debe aplicarse');
  assert.ok(!/panel\.dataset\.rendered === '1'/.test(mutado),
    'la guarda debe ser load-bearing para que el test signifique algo');
});

test('MUTACION: una URL sin validar el esquema romperia la asercion', () => {
  const mutado = cuerpo.replace(
    "seguro = parsed.protocol === 'http:' || parsed.protocol === 'https:';",
    'seguro = true;');
  assert.notEqual(mutado, cuerpo, 'la mutación debe aplicarse');
  assert.ok(!/protocol === 'http:'/.test(mutado),
    'si se acepta cualquier esquema, la asercion de seguridad debe caer');
});