/* main/test-anexos-1042.js
   📦1042 · Los anexos (Anexo de Encargo y de Nube) se movieron de Gestion
   Humana a Configuracion.

   POR QUE
   -------
   La gestion de los anexos es de K+AIR, no de personal: usa la credencial
   ADMINISTRATIVA y se hace POR EMPRESA. Estar en el nav de "Gestion Humana"
   era un error de categoria: ese modulo no tiene nada que ver con los
   anexos de encargo ni con los de nube.

   DONDE QUEDARON
   --------------
   Configuracion -> pestana "Gestion de Empresas" -> cada ficha de empresa ->
   boton "Configurar Firma Electronica" -> AL FINAL de ese modal va la
   seccion de los anexos de ESA empresa.

   Que el panel se monte dentro del modal (y no en su propia pagina) trae dos
   consecuencias que hay que cubrir:
     1) Configuracion vive en un IFRAME: ahi `window.electronAPI` no existe
        hasta que el padre se lo inyecta en el `contentWindow`.
     2) El panel no puede traer modal propio: seria un modal dentro de otro.
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const MOD_OPERADOR = path.join(ROOT, 'modules', 'gestion-humana', 'firma-operador', 'index.js');
const CSS_OPERADOR = path.join(ROOT, 'modules', 'gestion-humana', 'firma-operador', 'index.css');
const CONFIG_HTML = path.join(ROOT, 'components', 'config', 'config-viewer.html');
const INDEX_HTML = path.join(ROOT, 'index.html');
const HOME_JS = path.join(ROOT, 'modules', 'gestion-humana', 'gestion-humana-home.js');

const srcConfig = fs.readFileSync(CONFIG_HTML, 'utf8');
const srcIndexHtml = fs.readFileSync(INDEX_HTML, 'utf8');
const srcHome = fs.readFileSync(HOME_JS, 'utf8');
const cssOperador = fs.readFileSync(CSS_OPERADOR, 'utf8');

global.window = global.window || {};
const { FirmaOperadorComponent } = require(MOD_OPERADOR);

test('configuracion · el modal de la empresa tiene el bloque de los anexos', function () {
  assert.match(srcConfig, /id="firma-modal-anexos-block"/,
    'el modal tiene que tener su bloque de anexos');
  assert.match(srcConfig, /id="firma-modal-anexos"/,
    'y el contenedor donde se dibuja el panel');
});

test('configuracion · el bloque va AL FINAL del modal de la empresa', function () {
  // El owner lo pidio asi: la seccion de anexos va al final de la
  // configuracion por empresa, despues de lo demas.
  const iModal = srcConfig.indexOf('id="firma-empresa-modal"');
  const iAnexos = srcConfig.indexOf('id="firma-modal-anexos-block"');
  const iFinModal = srcConfig.indexOf('id="tab-firma"');
  assert.ok(iModal > -1, 'existe el modal de la empresa');
  assert.ok(iAnexos > iModal, 'el bloque de anexos esta dentro del modal');
  assert.ok(iAnexos < iFinModal, 'y antes de que termine la seccion de la pestana');
  // El bloque tiene que ir despues del banner de resultado (lo ultimo que
  // se pinta del formulario) y antes del cierre del modal-body.
  const iResultado = srcConfig.indexOf('id="firma-modal-result"');
  assert.ok(iAnexos > iResultado, 'el bloque de anexos va despues del resultado del formulario');
});

test('configuracion · el modal monta el panel al abrirlo y lo destruye al cerrarlo', function () {
  assert.match(srcConfig, /function _montarAnexosEmpresa\(/,
    'existe la funcion que monta el panel');
  assert.match(srcConfig, /_montarAnexosEmpresa\(companyName, nit\)/,
    'y se llama con la empresa y su NIT (el id_empresa del service)');
  assert.match(srcConfig, /new C\(cont, companyName,[^)]*\{\s*idEmpresa: nit,\s*embebido: true\s*\}\)/,
    'el panel se monta en modo embebido y con el id de la empresa');
  assert.match(srcConfig, /function _destruirAnexosEmpresa\(/,
    'existe la funcion que lo destruye');
  assert.match(srcConfig, /function closeFirmaModal\([\s\S]{0,600}_destruirAnexosEmpresa\(\)/,
    'y se llama al cerrar el modal');
});

test('configuracion · el panel se carga con la ruta relativa correcta', function () {
  // El iframe vive en components/config/, asi que la ruta sube dos niveles.
  assert.match(srcConfig, /\.\.\/\.\.\/modules\/gestion-humana\/firma-operador\/index\.js\?v=/,
    'el script del panel se carga con la ruta relativa desde components/config/');
  assert.match(srcConfig, /\.\.\/\.\.\/modules\/gestion-humana\/firma-operador\/index\.css\?v=/,
    'y su hoja tambien');
});

test('configuracion · la ventana principal ya no carga el panel', function () {
  assert.doesNotMatch(srcIndexHtml, /firma-operador\//,
    'la ventana principal no carga el panel: vive en el iframe de Configuracion');
  assert.doesNotMatch(srcHome, /firma-operador/,
    'y Gestion Humana no lo menciona: no es de ese modulo');
});

test('panel · el modo embebido no trae modal propio ni tabla general', function () {
  const c = new FirmaOperadorComponent(null, 'Aseplus', 'Configuración', 'Anexos', null,
    { idEmpresa: '900829731', embebido: true });
  const html = c._getShellHtml();
  assert.ok(html.includes('fo-wrapper--inline'), 'usa el wrapper embebido');
  assert.equal(html.indexOf('fo-modal'), -1, 'no puede traer un modal propio');
  assert.equal(html.indexOf('fo-table'), -1, 'ni la tabla general');
  assert.equal(html.indexOf('fo-header'), -1, 'ni el header propio');
});

test('panel · en modo embebido el contenido se pinta en la seccion', function () {
  const c = new FirmaOperadorComponent(null, 'Aseplus', 'Configuración', 'Anexos', null,
    { idEmpresa: '900829731', embebido: true });
  c._main = { innerHTML: '' };
  c._abrirModal('Anexos · Aseplus', '<p>contenido</p>');
  assert.equal(c._main.innerHTML, '<p>contenido</p>');
  // Y el modal propio no existe: cerrarlo no rompe nada.
  c._cerrarModal();
});

test('panel · el puente se resuelve en el momento de usarlo (el iframe lo inyecta tarde)', function () {
  const src = fs.readFileSync(MOD_OPERADOR, 'utf8');
  assert.match(src, /function _api\(\)/,
    'existe el resolvedor del puente');
  assert.match(src, /window\.parent\.electronAPI/,
    'y mira en el padre, que es donde Configuracion lo recibe');
  assert.equal((src.match(/window\.electronAPI\./g) || []).length, 0,
    'ninguna llamada usa window.electronAPI directo: todas pasan por el resolvedor');
});

test('panel · el CSS tiene el modo embebido', function () {
  assert.match(cssOperador, /\.fo-wrapper--inline/,
    'el wrapper embebido no es absoluto (el modal ya tiene su propio flujo)');
  assert.match(cssOperador, /\.fo-main--inline/,
    'y el contenido embebido es de flujo');
});

test('panel · el token del ?v= del panel no retrocede (mismo archivo, version mas nueva)', function () {
  // 📦1042 no toco el panel en si: el ?v= era el de 📦1038/1039.
  // 📦1047 SI lo toco (el estado del Anexo de Nube), asi que el token sube.
  // Lo que importa NO es el texto del sello (PROMPT.md, trampa 28: un check
  // que fija el literal se rompe en el proximo bumpeo, y su mutacion queda
  // vacia sin avisar), sino que el token NO retroceda a uno anterior.
  const m = srcConfig.match(/firma-operador\/index\.js\?v=([^\s"']+)/);
  assert.ok(m, 'el panel se carga con su ?v=');
  const fecha = /(\d{8})/.exec(m[1]);
  assert.ok(fecha, 'el token tiene que traer la fecha del paquete: ' + m[1]);
  assert.ok(Number(fecha[1]) >= 20261107,
    'el token del panel no puede retrocede a uno anterior al de 20261107: ' + m[1]);
});
