/* main/test-anexos-1041.js
   📦1041 · El panel del operador reventaba al abrir el detalle de una Empresa.

   QUÉ PASÓ
   --------
   `_htmlSuscripcionEncargo` y `_htmlSuscripcionNube` usaban `self.` sin
   declarar `var self = this;`. En el navegador `self` es el global `window`,
   así que `self._htmlEventos` era `undefined` y la llamada reventaba con
   "self._htmlEventos is not a function". Como el error pasaba dentro de un
   `async` sin `await`, quedaba como un rechazo sin capturar: el modal se
   quedaba en "Cargando…" para siempre, en silencio.

   POR QUÉ NO LO CAZARON LOS TESTS DE 📦1038
   -----------------------------------------
   Esos tests son ESTÁTICOS: leen el archivo y buscan strings. Ninguno ejecuta
   el render. Este archivo ejecuta el componente de verdad.

   POR QUÉ NO LO CAZÓ EL SERVICIO
   -------------------------------
   El service responde bien: el bug es de la app, no del API.
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const MOD_OPERADOR = path.join(__dirname, '..', 'modules', 'gestion-humana', 'firma-operador', 'index.js');
const srcOperador = fs.readFileSync(MOD_OPERADOR, 'utf8');

// La vista se carga como script en el renderer, no como módulo de Node: para
// poder requirearla hay que darle el `window` que ella misma espera.
global.window = global.window || {};

const { FirmaOperadorComponent } = require(MOD_OPERADOR);

function instancia() {
  return new FirmaOperadorComponent(null, 'Aseplus', 'Gestion Humana', 'Anexos', null);
}

const SUSCRIPCION_NUBE = {
  id: 1,
  estado: 'FIRMADA',
  version: '1.1',
  hash: 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482',
  correo_firmante: 'jrf2011@live.com',
  nombre_firmante: 'Lilia Maria Vasquez Munoz',
  cargo_firmante: 'Representante legal',
  firmado_at: '2026-11-05T22:51:34.349Z',
  contrafirmado_at: null,
  representante_verificacion: null,
  contrafirma_canal: null
};

const SUSCRIPCION_ENCARGO = {
  id: 7,
  estado: 'SUSCRITA',
  version: '1.0',
  hash: '5cc7a34603ea2e300e6c82ed695454eb705363345a3165ae2e75b5733960aa72',
  correo_firmante: 'jrf2011@live.com',
  canal_codigo: 'asepluscaribesas@gmail.com',
  nombre_firmante: 'Lilia Maria Vasquez Munoz',
  cargo_firmante: 'Representante legal',
  firmado_at: null,
  contrafirmado_at: null,
  representante_verificacion: { tipo_documento: 'CC', referencia: '1129566447' },
  representante_verificado_at: '2026-11-07T18:00:00.000Z',
  contrafirma_canal: null
};

const EVENTOS = [
  { evento: 'SUSCRIPCION_CREADA', detalle: 'version=1.1', fecha_hora: '2026-11-05 18:54:18' },
  { evento: 'SUSCRIPCION_FIRMADA', detalle: null, fecha_hora: '2026-11-05 22:51:34' }
];

test('render · la suscripcion del Anexo de Nube se dibuja sin reventar', function () {
  const html = instancia()._htmlSuscripcionNube(SUSCRIPCION_NUBE, EVENTOS);
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 0);
  assert.ok(html.includes('Rastro'), 'tiene que dibujar el rastro de eventos');
  assert.ok(html.includes('2 eventos'), 'el rastro cuenta los eventos');
});

test('render · la suscripcion del Anexo de Encargo se dibuja sin reventar', function () {
  const html = instancia()._htmlSuscripcionEncargo(SUSCRIPCION_ENCARGO, EVENTOS);
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 0);
  assert.ok(html.includes('Rastro'), 'tiene que dibujar el rastro de eventos');
});

test('render · el detalle completo de una Empresa con los DOS anexos no reventar', function () {
  // El caso real de produccion: Anexo de Encargo sin suscripcion y Anexo de
  // Nube suscrito. Antes esto tiraba TypeError y dejaba el modal en
  // "Cargando…" para siempre.
  const c = instancia();
  c._seleccion = '900829731';
  c._empresas = [{ id_empresa: '900829731', razon_social: 'ASEPLUS CARIBE S.A.S.' }];
  c._detalle = {
    id_empresa: '900829731',
    anexo_encargo: { suscripcion: null, eventos: [] },
    anexo_nube: { suscripcion: SUSCRIPCION_NUBE, eventos: EVENTOS }
  };
  // `_renderDetalle` termina en `_abrirModal`, que necesita el DOM: se le
  // da un doble mínimo para poder ejecutarla entera.
  let titulo = null;
  let cuerpo = null;
  c._abrirModal = function (t, html) { titulo = t; cuerpo = html; };
  c._renderDetalle();
  assert.equal(titulo, 'Anexos · ASEPLUS CARIBE S.A.S.');
  assert.ok(cuerpo.includes('Anexo de Encargo'));
  assert.ok(cuerpo.includes('Anexo de Nube'));
  assert.ok(cuerpo.includes('Rastro'));
});

test('render · el detalle con la suscripcion del Encargo ya abierta tampoco revienta', function () {
  const c = instancia();
  c._seleccion = '900829731';
  c._empresas = [{ id_empresa: '900829731', razon_social: 'ASEPLUS CARIBE S.A.S.' }];
  c._detalle = {
    id_empresa: '900829731',
    anexo_encargo: { suscripcion: SUSCRIPCION_ENCARGO, eventos: EVENTOS },
    anexo_nube: { suscripcion: SUSCRIPCION_NUBE, eventos: EVENTOS }
  };
  let cuerpo = null;
  c._abrirModal = function (t, html) { cuerpo = html; };
  c._renderDetalle();
  assert.ok(cuerpo.includes('Anexo de Encargo'));
  assert.ok(cuerpo.includes('Anexo de Nube'));
});

test('render · NINGUNA funcion usa `self.` sin declarar `var self = this;`', function () {
  // El `self` del navegador es `window`: sin la declaracion, `self._algo`
  // resuelve a `window._algo` y es `undefined`. Este es el guard que
  // faltaba cuando se introdujo la vista.
  const re = /FirmaOperadorComponent\.prototype\.(\w+)\s*=\s*(?:async\s+)?function/g;
  const funciones = [];
  let m;
  while ((m = re.exec(srcOperador)) !== null) {
    const siguiente = srcOperador.indexOf('FirmaOperadorComponent.prototype.', m.index + 10);
    const fin = siguiente === -1 ? srcOperador.length : siguiente;
    funciones.push({ nombre: m[1], cuerpo: srcOperador.slice(m.index, fin) });
  }
  // 30 metodos en el prototipo (22 sincronos y 8 async). El numero es una
  // red de seguridad: si el guard deja de ver metodos, esta guardingando
  // sobre el archivo equivocado.
  assert.ok(funciones.length >= 28, 'se encontraron las funciones del componente: ' + funciones.length);
  const sinDeclarar = funciones
    .filter((f) => /\bself\./.test(f.cuerpo) && !/var\s+self\s*=\s*this/.test(f.cuerpo))
    .map((f) => f.nombre);
  assert.deepEqual(sinDeclarar, [], 'estas funciones usan self. sin declarar "var self = this": ' + sinDeclarar.join(', '));
});

test('render · `_htmlEventos` existe y es una funcion en el prototipo', function () {
  assert.equal(typeof FirmaOperadorComponent.prototype._htmlEventos, 'function');
});
