/**
 * LA PÁGINA DE SUSCRIPCIÓN Y EL SERVICIO: EL MISMO CONTRATO
 * ============================================================================
 *
 * La pantalla de suscripción (web/anexo-nube/) es lo ÚNICO que ve la Empresa
 * cuando abre el enlace. Si el script de esa pantalla y el servicio no
 * hablan el mismo idioma, la Empresa ve un error y no puede suscribir.
 *
 * Eso es exactamente lo que pasó el 5-nov-2026: el script pedía el contexto
 * en `/api/anexo-nube/<token>` y esa ruta NO existía. La pantalla recibía un
 * 404 y, como además leía mal la envoltura de error, le mostraba a la
 * Empresa "[object Object]".
 *
 * Ni el 404 ni el "[object Object]" aparecieron en 2.120 pruebas: el test de
 * suscripción ejercitaba el SERVICIO (sin HTTP) y el test de rutas solo
 * cubría `/anexo-nube/documento`. Faltaba la unión entre lo que el script
 * pide y lo que el servicio responde. Este archivo es esa unión.
 *
 * Lo que se ata acá:
 *
 * - La dirección que el script declara tiene que existir en el servicio.
 * - Un error del servicio tiene que llegar a la Empresa como texto legible.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const request = require('supertest');
const { makeApp, resetDb } = require('../helpers');
const db = require('../../src/db/connection');
const anexoNube = require('../../src/services/anexoNube');
const mailer = require('../../src/services/mailer');

const DIR_WEB = path.join(__dirname, '..', '..', 'web', 'anexo-nube');
const SCRIPT = path.join(DIR_WEB, 'app.js');

const ID_EMPRESA = '900666888';
const RAZON_SOCIAL = 'EMPRESA DE PANTALLA SAS';
const CORREO_FIRMANTE = 'representante@empresa-pantalla.test';

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, canal_pqrs, activo)
    VALUES (?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, RAZON_SOCIAL, ID_EMPRESA, 'pqrs@empresa-pantalla.test');
}

/**
 * La base de la API que declara el script de la pantalla.
 *
 * Se LEE del archivo y no se escribe a mano: si alguien cambia el prefijo
 * en el script, este test sigue preguntándole al servicio por la dirección
 * que la Empresa va a usar de verdad.
 */
function baseDeLaApi() {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const m = src.match(/var\s+API\s*=\s*'([^']+)'/);
  assert.ok(m, 'el script de la pantalla tiene que declarar la base de la API');
  return m[1];
}

/**
 * Corre el script de la pantalla como lo correría el navegador, con un
 * `document` y un `fetch` de mentira, y devuelve los elementos que la
 * pantalla tocó.
 *
 * @param {string} token - el token que viene en la URL.
 * @param {object} respuesta - lo que contesta el `fetch` de mentira.
 * @returns {object} { elementos, disparar }
 */
function correrPantalla(token, respuesta) {
  const elementos = {};
  let listo = null;

  const documento = {
    getElementById(id) {
      if (!elementos[id]) {
        elementos[id] = {
          textContent: '',
          value: '',
          checked: false,
          disabled: false,
          className: '',
          classList: { toggle() {}, add() {} },
          setAttribute() {},
          addEventListener() {},
          focus() {},
        };
      }
      return elementos[id];
    },
    addEventListener(evento, cb) {
      if (evento === 'DOMContentLoaded') listo = cb;
    },
  };

  const contexto = vm.createContext({
    document: documento,
    window: { location: { pathname: `/anexo-nube/${token}` } },
    fetch: () => Promise.resolve(respuesta),
    console,
  });

  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), contexto, { filename: 'app.js' });

  return {
    elementos,
    disparar() {
      assert.ok(listo, 'el script tiene que esperar al DOMContentLoaded');
      listo();
    },
  };
}

/** Deja que se vacíen las promesas encadenadas. */
function respiro() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ===========================================================================
// LA DIRECCIÓN QUE PIDE LA PANTALLA TIENE QUE EXISTIR
// ===========================================================================

test('la dirección que declara el script de la pantalla existe en el servicio', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'Representante de Prueba',
  });

  const base = baseDeLaApi();
  const res = await request(app)
    .get(base + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');

  assert.equal(res.status, 200,
    `la pantalla pide ${base}<token> y esa ruta tiene que existir en el servicio`);
  assert.equal(res.body.version, anexoNube.VERSION_MODELO);
  assert.equal(res.body.empresa, RAZON_SOCIAL);
  assert.equal(res.body.vigente, true,
    'el texto que la Empresa va a ver tiene que ser el vigente');
});

test('el contexto que recibe la pantalla lleva la huella del archivo del servidor', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');

  assert.equal(res.status, 200);
  assert.equal(res.body.hash, sub.hash);
  assert.equal(res.body.hash, anexoNube.modeloVigente().hash,
    'la huella que muestra la pantalla tiene que ser la del texto que se firma');
});

test('la ruta del enlace sigue sirviendo la pantalla en HTML', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(`/anexo-nube/${encodeURIComponent(sub.token)}`)
    .set('Accept', 'text/html');

  assert.equal(res.status, 200);
  assert.ok(/text\/html/.test(res.headers['content-type']));
  assert.ok(/Suscripci/.test(res.text), 'la pantalla tiene que ser la del Anexo de Nube');
});

test('un enlace que no existe responde 404 y no un error interno', async () => {
  const app = makeApp();
  const res = await request(app)
    .post('/api/anexo-nube/token-que-no-existe/suscribir')
    .send({ otp: '000000', acepta: true });

  assert.equal(res.status, 404,
    'un enlace inexistente es un 404 con su codigo, no un 500: el 500 esconde el motivo');
  assert.equal(res.body.error.code, 'ENLACE_NO_VALIDO');
});

// ===========================================================================
// UN ERROR DEL SERVICIO LLEGA A LA EMPRESA COMO TEXTO
// ===========================================================================

test('un error del servicio le llega a la Empresa como texto, no como "[object Object]"', async () => {
  const mensaje = 'Ruta no encontrada: GET /api/anexo-nube/el-token';
  const respuesta = {
    ok: false,
    status: 404,
    json: () => Promise.resolve({
      error: { code: 'NOT_FOUND', message: mensaje, request_id: 'req_prueba' },
    }),
  };

  const { elementos, disparar } = correrPantalla('el-token', respuesta);
  disparar();
  await respiro();

  const mostrado = elementos['error-texto'].textContent;
  assert.notEqual(mostrado, '[object Object]',
    'la Empresa no puede leer "[object Object]": tiene que leer el mensaje del servicio');
  assert.equal(mostrado, mensaje);
});

test('un error sin envoltura tampoco se muestra como "[object Object]"', async () => {
  const respuesta = {
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  };

  const { elementos, disparar } = correrPantalla('el-token', respuesta);
  disparar();
  await respiro();

  const mostrado = elementos['error-texto'].textContent;
  assert.notEqual(mostrado, '[object Object]');
  assert.ok(mostrado && mostrado.length > 0, 'tiene que haber un mensaje');
});
