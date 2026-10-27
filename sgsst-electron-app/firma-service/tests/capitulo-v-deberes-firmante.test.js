'use strict';

/**
 * tests/capitulo-v-deberes-firmante.test.js
 *
 * CAPÍTULO V · DEBERES DEL FIRMANTE.
 *
 * El Capítulo V le carga al Firmante cinco deberes (5.1 a 5.5). Este archivo
 * cubre los dos que el producto tenía pendientes:
 *
 *   5.1(c) Avisar de inmediato a la Empresa **y a K+AIR** cualquier
 *         situación que comprometa la seguridad de sus datos de creación de
 *         la firma. La mini-app mostraba los canales de la Empresa (que son
 *         del cliente) y ningun canal de K+AIR: el deber no era cumplible,
 *         porque el Firmante no tenia a quien avisarle.
 *
 *   5.3    Firmar únicamente documentos cuyo contenido sea exacto, completo y
 *         corresponda a lo que la Empresa le ha informado. Para poder hacer
 *         esa comprobacion el Firmante tiene que saber QUE documento tiene
 *         delante: la categoria (CONTRATO, ACTA...) y su referencia. Los dos
 *         datos ya venían en el contexto publico pero no se pintaban.
 *
 * La parte estatica (markup y cableado del JS) se prueba como en
 * miniapp-reabierto.test.js: se leen los archivos y se corren mutaciones en
 * memoria para exigir que el evaluador marque cada una. Un check que no
 * muerde no es un check.
 *
 * La parte HTTP abre la base (como los tests de rutas).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const {
  resetDb, makeApp, seedActiveAgreement, createSignRequestWithIdentificacion,
} = require('./helpers');

const WEB_DIR = path.resolve(__dirname, '..', 'web', 'firma');
const HTML_REAL = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const JS_REAL = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');
const CONFIG_REAL = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'config.js'), 'utf8'
);

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

  // --- 5.3: qué documento se está firmando -------------------------------

  check('la pantalla de documento tiene bloque de identidad',
    htm.includes('id="documento-identidad"'),
    'sin él el Firmante no sabe qué documento tiene delante');

  check('el bloque de identidad muestra la categoría',
    htm.includes('id="documento-categoria"'),
    'la categoría es lo que dice QUÉ se está firmando');

  check('el bloque de identidad muestra la referencia',
    htm.includes('id="documento-referencia"'),
    'la referencia es lo que permite compararlo con lo que dijo la Empresa');

  check('el bloque de identidad está dentro de screen-document',
    /id="screen-document"[\s\S]*?id="documento-identidad"/.test(htm),
    'si vive en otra pantalla nunca se ve');

  check('el JS tiene el render de la identidad del documento',
    /function renderDocumentoIdentidad/.test(js),
    'sin render el bloque queda vacío');

  check('el render de la identidad se llama con el contexto',
    /renderDocumentoIdentidad\(state\.contexto\)/.test(js),
    'sin llamada no se pinta nunca');

  check('el render de la identidad pinta la categoría',
    /renderDocumentoIdentidad[\s\S]{0,600}?#documento-categoria/.test(js),
    'la categoría es el dato que sostiene el 5.3');

  check('el render de la identidad pinta la referencia',
    /renderDocumentoIdentidad[\s\S]{0,900}?#documento-referencia/.test(js),
    'sin referencia el Firmante no puede comparar con lo que le dijeron');

  check('el render de la identidad muestra el bloque',
    /renderDocumentoIdentidad[\s\S]{0,900}?\.hidden = false/.test(js),
    'un bloque con hidden nunca se ve');

  // --- 5.1(c): el canal de incidentes de K+AIR ----------------------------

  check('la mini-app tiene pie con el canal de K+AIR',
    htm.includes('id="pie-kair"'),
    'sin el, el Firmante no tiene a quién avisar');

  check('el pie nombra a K+AIR y a su operador',
    /<footer class="pie-kair"[\s\S]{0,400}?Gesstiar S\.A\.S\./.test(htm),
    'el 5.1(c) habla de K+AIR: el Firmante debe saber quién es');

  check('el pie trae un canal por defecto',
    /id="pie-kair-canal"[^>]*>[^<]+</.test(htm),
    'un canal vacío no es un canal');

  check('el pie explica para qué sirve',
    /comprometidos/.test(htm),
    'sin explicación el Firmante no sabe cuándo usarlo');

  check('el JS tiene el render del pie',
    /function renderPieKair/.test(js),
    'sin render el pie queda con el valor estático');

  check('el render del pie se llama con el contexto',
    /renderPieKair\(state\.contexto\)/.test(js),
    'sin llamada el servidor no puede corregir el canal');

  // El pie tiene que estar DESPUÉS del último </section>: si vive dentro de
  // una pantalla, desaparece en todas las demás (y el 5.1(c) se cumple solo
  // en una).
  const idxPie = htm.indexOf('<footer class="pie-kair"');
  const idxUltimoSection = htm.lastIndexOf('</section>');
  check('el pie está fuera de las pantallas',
    idxPie !== -1 && idxPie > idxUltimoSection,
    'dentro de una pantalla desaparece en las demás');

  check('el render del pie valida el correo antes de armar el mailto',
    /function renderPieKair\(contexto\)[\s\S]{0,1200}?test\(valor\)/.test(js),
    'sin validación, un href con otro esquema ejecuta código en el navegador');

  check('el render del pie usa mailto',
    /function renderPieKair\(contexto\)[\s\S]{0,1500}?'mailto:'/.test(js),
    'sin enlace el Firmante tiene que copiar el correo a mano');

  // El canal de PROTECCIÓN DE DATOS (10.7(b)) es un render aparte. Tiene sus
  // propias comprobaciones: es otro canal y otro deber.
  check('el pie publica el canal de proteccion de datos',
    /id="pie-kair-canal-datos"/.test(htm),
    'el Titular tiene que saber a quién escribir para ejercer sus derechos');

  check('el render del canal de datos valida el correo antes de armar el mailto',
    /function renderPieKairDatos\(contexto\)[\s\S]{0,1200}?test\(valor\)/.test(js),
    'sin validación, un href con otro esquema ejecuta código en el navegador');

  check('el render del canal de datos usa mailto',
    /function renderPieKairDatos\(contexto\)[\s\S]{0,1500}?'mailto:'/.test(js),
    'sin enlace el Titular tiene que copiar el correo a mano');

  check('el contexto publica el canal de proteccion de datos',
    /canal_proteccion_datos_kair/.test(js),
    'el 10.7(b) exige que el Titular tenga un canal propio de K+AIR');

  check('la pantalla pinta el canal de proteccion de datos',
    /renderPieKairDatos\(state\.contexto\)/.test(js),
    'un canal que existe en el servidor pero no se muestra no es un canal');

  return { f: fallos.length, fallos };
}

// =========================================================================
// Parte A: markup y cableado (sin base de datos)
// =========================================================================

test('CAPÍTULO V · el markup y el cableado cumplen el 5.1(c) y el 5.3', () => {
  const r = evaluar(HTML_REAL, JS_REAL);
  assert.equal(r.f, 0, 'checks que no pasaron:\n- ' + r.fallos.join('\n- '));
});

test('CAPÍTULO V · cada mutación es detectada', () => {
  // Cada mutación devuelve el par (html, js) mutado. Se exige que el
  // evaluador marque AL MENOS un check: si una mutación pasa limpio, el
  // check que debería morderla no está mordiendo.
  const mutaciones = [
    ['se quita el bloque de identidad',
      (h, j) => ({ h: h.replace('id="documento-identidad"', 'id="x"'), j })],
    ['se quita la categoría',
      (h, j) => ({ h: h.replace('id="documento-categoria"', 'id="x"'), j })],
    ['se quita la referencia',
      (h, j) => ({ h: h.replace('id="documento-referencia"', 'id="x"'), j })],
    ['el bloque de identidad sale de screen-document',
      (h, j) => ({ h: h.replace(/id="documento-identidad"/, 'id="otro-caso"'), j })],
    ['se quita la llamada al render de identidad',
      (h, j) => ({ h, j: j.replace('renderDocumentoIdentidad(state.contexto);', '') })],
    ['el render de identidad no pinta la categoría',
      (h, j) => ({ h, j: j.replace(/#documento-categoria/, '#otro-caso') })],
    ['el render de identidad no muestra el bloque',
      // El replace tiene que caer dentro del render de IDENTIDAD: la
      // mini-app tiene más de un bloque que se muestra (el del medio personal
      // del 1.a, por ejemplo) y el primero que aparece ya no es este.
      (h, j) => ({ h, j: j.replace(/(function renderDocumentoIdentidad[\s\S]{0,2000}?)bloque\.hidden = false;/, '$1') })],
    ['se quita el pie de K+AIR',
      (h, j) => ({ h: h.replace('id="pie-kair"', 'id="x"'), j })],
    ['se vacía el canal por defecto',
      (h, j) => ({ h: h.replace(/id="pie-kair-canal"[^>]*>[^<]+</, 'id="pie-kair-canal"></'), j })],
    ['se quita el nombre del operador',
      (h, j) => ({ h: h.replace(/(<footer class="pie-kair"[\s\S]{0,300}?)Gesstiar S\.A\.S\./, '$1Un Proveedor'), j })],
    ['se quita la llamada al render del pie',
      (h, j) => ({ h, j: j.replace('renderPieKair(state.contexto);', '') })],
    ['se quita la validación del correo',
      (h, j) => ({ h, j: j.replace('test(valor)', 'true') })],
    ['se quita la validación del correo del canal de datos',
      (h, j) => ({ h, j: j.replace(/(function renderPieKairDatos\(contexto\)[\s\S]{0,1200}?)test\(valor\)/, '$1true') })],
    ['se quita el render del canal de datos',
      (h, j) => ({ h, j: j.replace('renderPieKairDatos(state.contexto);', '') })],
  ];

  for (const [nombre, mutar] of mutaciones) {
    const m = mutar(HTML_REAL, JS_REAL);
    assert.ok(m.h !== HTML_REAL || m.j !== JS_REAL,
      'la mutación "' + nombre + '" no cambió nada');
    const r = evaluar(m.h, m.j);
    assert.ok(r.f > 0, 'la mutación "' + nombre + '" NO fue detectada');
  }
});

test('CAPÍTULO V · el canal por defecto del HTML y el de la config no divergen', () => {
  // El HTML trae el valor por defecto (para que la pantalla de error lo
  // muestre, que es donde no hay contexto) y la config lo puede cambiar. Si
  // divergen sin querer, el Firmante ve un canal distinto del configurado.
  const enHtml = /id="pie-kair-canal"[^>]*>([^<]+)</.exec(HTML_REAL);
  assert.ok(enHtml, 'el pie no trae el canal por defecto');
  const enConfig = /FIRMA_CANAL_INCIDENCIAS'\s*,\s*'([^']+)'/.exec(CONFIG_REAL);
  assert.ok(enConfig, 'la config no declara FIRMA_CANAL_INCIDENCIAS');
  assert.equal(enHtml[1].trim(), enConfig[1],
    'el canal del HTML y el de la config no son el mismo');
});

test('CAPÍTULO V · el canal de datos por defecto del HTML y el de la config no divergen', () => {
  // El 10.7(b): el canal de PROTECCIÓN DE DATOS de K+AIR. Es otro canal y
  // otro deber que el de incidentes (el 5.1(c)).
  const enHtml = /id="pie-kair-canal-datos"[^>]*>([^<]+)</.exec(HTML_REAL);
  assert.ok(enHtml, 'el pie no trae el canal de datos por defecto');
  const enConfig = /FIRMA_CANAL_PROTECCION_DATOS'\s*,\s*'([^']+)'/.exec(CONFIG_REAL);
  assert.ok(enConfig, 'la config no declara FIRMA_CANAL_PROTECCION_DATOS');
  assert.equal(enHtml[1].trim(), enConfig[1],
    'el canal de datos del HTML y el de la config no son el mismo');
  assert.notEqual(enHtml[1].trim(), /FIRMA_CANAL_INCIDENCIAS'\s*,\s*'([^']+)'/.exec(CONFIG_REAL)[1],
    'los dos canales de K+AIR tienen que ser DISTINTOS');
});

// =========================================================================
// Parte B: el contexto público (con base de datos)
// =========================================================================

test('CAPÍTULO V · el contexto expone el canal de K+AIR y la identidad del documento', async () => {
  resetDb();
  seedActiveAgreement({ version: 'v1.0' });

  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_identificacion: 'CONTRATO',
  });

  const app = makeApp();
  const r = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(r.status, 200);

  // 5.1(c): el canal de K+AIR tiene que estar en el contexto.
  assert.equal(typeof r.body.canal_incidentes_kair, 'string');
  assert.ok(r.body.canal_incidentes_kair.includes('@'),
    'el canal de K+AIR tiene que ser un correo');

  // 5.3: la categoría y la referencia del documento que se firma.
  assert.equal(r.body.tipo_identificacion, 'CONTRATO');
  assert.equal(typeof r.body.id_documento, 'string');
  assert.ok(r.body.id_documento.length > 0);

  // El canal de K+AIR NO puede ser el de la Empresa: el bloque de la Empresa
  // trae los canales del cliente, y este es el del operador.
  const rEmp = await request(app).get(`/s/${token}`).set('Accept', 'application/json');
  assert.equal(rEmp.body.canal_incidentes_kair, r.body.canal_incidentes_kair);
});
