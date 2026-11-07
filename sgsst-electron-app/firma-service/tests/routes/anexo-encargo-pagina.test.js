/**
 * LA PÁGINA DE SUSCRIPCIÓN DEL ANEXO DE ENCARGO Y EL SERVICIO: EL MISMO CONTRATO
 * ============================================================================
 *
 * La pantalla de suscripción (web/anexo-encargo/) es lo ÚNICO que ve la Empresa
 * cuando abre el enlace. Si el script de esa pantalla y el servicio no
 * hablan el mismo idioma, la Empresa ve un error y no puede suscribir.
 *
 * Eso es exactamente lo que pasó el 5-nov-2026 con el Anexo de Nube: el
 * script pedía el contexto en `/api/anexo-nube/<token>` y esa ruta NO
 * existía. La pantalla recibía un 404 y, como además leía mal la envoltura
 * de error, le mostraba a la Empresa "[object Object]".
 *
 * Lo que se ata acá:
 *
 * - La dirección que el script declara tiene que existir en el servicio.
 * - Un error del servicio tiene que llegar a la Empresa como texto legible.
 *
 * Y lo que es propio del Anexo de Encargo:
 *
 * - La pantalla PRELLENA los cinco datos del §11 con la ficha de la Empresa
 *   (para que no tenga que escribirlos de memoria).
 * - La pantalla MANDA esos cinco datos al suscribir: lo que declara la
 *   Empresa es lo que queda en su copia, en la evidencia y en el acta. Si el
 *   script no los mandara, el servicio los pediría y la suscripción nunca
 *   se cerraría.
 * - La pantalla NO dice que el contrato quedó firmado: el instrumento es
 *   bilateral y le falta la contrafirma de K+AIR.
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
const anexoEncargo = require('../../src/services/anexoEncargo');
const mailer = require('../../src/services/mailer');

const DIR_WEB = path.join(__dirname, '..', '..', 'web', 'anexo-encargo');
const SCRIPT = path.join(DIR_WEB, 'app.js');

const ID_EMPRESA = '900777666';
const RAZON_SOCIAL = 'EMPRESA DE PANTALLA SAS';
const CORREO_FIRMANTE = 'representante@empresa-pantalla.test';

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, RAZON_SOCIAL, '900777666-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-pantalla.test',
    'datos@empresa-pantalla.test', 'PERSONA DE PRUEBA');
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

/** Deja que se vacíen las promesas encadenadas. */
function respiro() {
  return new Promise((resolve) => setImmediate(() => setImmediate(resolve)));
}

/**
 * Corre el script de la pantalla como lo correría el navegador, con un
 * `document` y un `fetch` de mentira, y devuelve los elementos que la
 * pantalla tocó y las llamadas que hizo.
 *
 * @param {string} token - el token que viene en la URL.
 * @param {object} respuestas - { get, post }: lo que contesta el `fetch`.
 * @param {object} [valores] - valores con los que arrancan los campos.
 * @returns {object} { elementos, llamadas, disparar, enviar }
 */
function correrPantalla(token, respuestas, valores) {
  const elementos = {};
  const listeners = {};
  const llamadas = [];
  let listo = null;

  function elemento(id) {
    if (!elementos[id]) {
      elementos[id] = {
        textContent: '',
        value: (valores && valores[id] !== undefined) ? valores[id] : '',
        checked: false,
        disabled: false,
        className: '',
        classList: { toggle() {}, add() {} },
        setAttribute() {},
        addEventListener(evento, cb) {
          listeners[id] = listeners[id] || {};
          listeners[id][evento] = cb;
        },
        focus() {},
      };
    }
    return elementos[id];
  }

  const documento = {
    getElementById: elemento,
    addEventListener(evento, cb) {
      if (evento === 'DOMContentLoaded') listo = cb;
    },
  };

  const contexto = vm.createContext({
    document: documento,
    window: { location: { pathname: `/anexo-encargo/${token}` } },
    fetch(ruta, opciones) {
      // El `fetch` de verdad manda el metodo en `method`. Se lee de ahi (y no
      // de `metodo`) porque un mock que no entienda el nombre de la
      // propiedad registra como GET una llamada que fue POST: el test pasa
      // por alto la llamada y no falla donde debería.
      const metodo = (opciones && (opciones.method || opciones.metodo)) || 'GET';
      llamadas.push({
        ruta: String(ruta),
        metodo: metodo,
        // El cuerpo viaja en `body` (que es como lo manda el `fetch` de
        // verdad). Si el mock lo busca con otro nombre, registra una
        // suscripción sin cuerpo y el test no mira lo que se mandó.
        cuerpo: (opciones && (opciones.body || opciones.cuerpo))
          ? JSON.parse(opciones.body || opciones.cuerpo)
          : null,
      });
      const r = metodo === 'POST'
        ? (respuestas.post || respuestas.get)
        : respuestas.get;
      return Promise.resolve(r);
    },
    console,
  });

  vm.runInContext(fs.readFileSync(SCRIPT, 'utf8'), contexto, { filename: 'app.js' });

  return {
    elementos,
    llamadas,
    // El navegador crea los campos que la pantalla pide. Acá se crean cuando
    // el test los necesita: un campo que el script todavía no ha pedido no
    // existe, y el test lo sabe.
    campo: elemento,
    disparar() {
      assert.ok(listo, 'el script tiene que esperar al DOMContentLoaded');
      listo();
    },
    enviar() {
      const l = listeners['form-firma'];
      assert.ok(l && l.submit, 'el formulario tiene que tener su manejador de envío');
      l.submit({ preventDefault() {} });
    },
  };
}

/** La respuesta de mentira del `fetch`, con lo que el servicio respondería. */
function respuestaOk(datos) {
  return { ok: true, status: 200, json: () => Promise.resolve(datos) };
}

/** La respuesta de mentira de un error del servicio. */
function respuestaError(status, cuerpo) {
  return { ok: false, status: status, json: () => Promise.resolve(cuerpo) };
}

// ===========================================================================
// LA DIRECCIÓN QUE PIDE LA PANTALLA TIENE QUE EXISTIR
// ===========================================================================

test('la dirección que declara el script de la pantalla existe en el servicio', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'Representante de Prueba',
  });

  const base = baseDeLaApi();
  const res = await request(app)
    .get(base + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');

  assert.equal(res.status, 200,
    `la pantalla pide ${base}<token> y esa ruta tiene que existir en el servicio`);
  assert.equal(res.body.version, '2026-11-06');
  assert.equal(res.body.empresa, RAZON_SOCIAL);
  assert.equal(res.body.vigente, true,
    'el texto que la Empresa va a ver tiene que ser el vigente');
});

test('el contexto que recibe la pantalla lleva la huella del archivo del servidor', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');

  assert.equal(res.status, 200);
  assert.equal(res.body.hash, sub.hash);
  assert.equal(res.body.hash, anexoEncargo.modeloVigente().hash,
    'la huella que muestra la pantalla tiene que ser la del texto que se suscribe');
});

test('la ruta del enlace sigue sirviendo la pantalla en HTML', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(`/anexo-encargo/${encodeURIComponent(sub.token)}`)
    .set('Accept', 'text/html');

  assert.equal(res.status, 200);
  assert.ok(/text\/html/.test(res.headers['content-type']));
  assert.ok(/Suscripci/.test(res.text), 'la pantalla tiene que ser la del Anexo de Encargo');
  assert.ok(/Anexo de Encargo/.test(res.text),
    'la pantalla tiene que dejar claro qué instrumento se está suscribiendo');
});

test('un enlace que no existe responde 404 y no un error interno', async () => {
  const app = makeApp();
  const res = await request(app)
    .post('/api/anexo-encargo/token-que-no-existe/suscribir')
    .send({ otp: '000000', acepta: true });

  assert.equal(res.status, 404,
    'un enlace inexistente es un 404 con su codigo, no un 500: el 500 esconde el motivo');
  assert.equal(res.body.error.code, 'ENLACE_NO_VALIDO');
});

// ===========================================================================
// LOS CINCO DATOS DEL §11
// ===========================================================================

test('la pantalla prellena los cinco datos del §11 con la ficha de la Empresa', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  // El contexto de VERDAD: el que la Empresa va a recibir.
  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');
  assert.equal(res.status, 200);

  const { elementos, disparar } = correrPantalla(sub.token, {
    get: respuestaOk(res.body),
  });
  disparar();
  await respiro();

  assert.equal(elementos['s11-razon_social'].value, RAZON_SOCIAL);
  assert.equal(elementos['s11-nit'].value, '900777666-1');
  assert.equal(elementos['s11-domicilio'].value, 'Calle 47 # 43-57 Piso 2, Barranquilla');
  assert.equal(elementos['s11-correo'].value, 'datos@empresa-pantalla.test');
  assert.equal(elementos['s11-representante'].value, 'PERSONA DE PRUEBA');
});

test('la pantalla MANDA los cinco datos que declaró la Empresa', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');
  assert.equal(res.status, 200);

  const { elementos, llamadas, campo, disparar, enviar } = correrPantalla(sub.token, {
    get: respuestaOk(res.body),
    post: respuestaOk({
      firmado: true,
      version: res.body.version,
      hash: res.body.hash,
      firmado_at: '2026-11-06T15:00:00.000Z',
      contrafirmado: false,
    }),
  });
  disparar();
  await respiro();

  // La Empresa corrige un dato de la ficha (el NIT) y deja los demás.
  elementos['s11-nit'].value = '900.777.666-1';
  campo('otp').value = '123456';
  campo('acepta').checked = true;

  enviar();
  await respiro();

  const envio = llamadas.find((c) => c.metodo === 'POST');
  assert.ok(envio, 'la pantalla tiene que mandar la suscripción');
  assert.ok(/\/api\/anexo-encargo\/.*\/suscribir$/.test(envio.ruta),
    `la pantalla tiene que suspender por la ruta de suscripción, no por ${envio.ruta}`);

  assert.equal(envio.cuerpo.otp, '123456');
  assert.equal(envio.cuerpo.acepta, true);
  assert.ok(envio.cuerpo.datos_empresa,
    'la pantalla tiene que mandar los cinco datos del §11: sin ellos el servicio no suscribe');
  assert.equal(envio.cuerpo.datos_empresa.razon_social, RAZON_SOCIAL);
  assert.equal(envio.cuerpo.datos_empresa.nit, '900.777.666-1',
    'lo que la Empresa corrige es lo que tiene que llegar');
  assert.equal(envio.cuerpo.datos_empresa.domicilio, 'Calle 47 # 43-57 Piso 2, Barranquilla');
  assert.equal(envio.cuerpo.datos_empresa.correo, 'datos@empresa-pantalla.test');
  assert.equal(envio.cuerpo.datos_empresa.representante, 'PERSONA DE PRUEBA');
});

test('sin los cinco datos del §11 la pantalla no manda nada y dice cuál falta', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');
  assert.equal(res.status, 200);

  const { elementos, llamadas, campo, disparar, enviar } = correrPantalla(sub.token, {
    get: respuestaOk(res.body),
    post: respuestaOk({}),
  });
  disparar();
  await respiro();

  // La Empresa borra el NIT (queda vacío).
  elementos['s11-nit'].value = '';
  campo('otp').value = '123456';
  campo('acepta').checked = true;

  enviar();
  await respiro();

  assert.equal(llamadas.filter((c) => c.metodo === 'POST').length, 0,
    'sin los cinco datos no se manda nada: el servicio los exige de todos modos');
  assert.match(elementos['mensaje'].textContent, /NIT/,
    'el mensaje tiene que decir qué dato falta');
});

test('la pantalla no dice que el contrato quedó firmado: falta la contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const sub = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  });

  const res = await request(app)
    .get(baseDeLaApi() + encodeURIComponent(sub.token))
    .set('Accept', 'application/json');
  assert.equal(res.status, 200);

  const { elementos, campo, disparar, enviar } = correrPantalla(sub.token, {
    get: respuestaOk(res.body),
    post: respuestaOk({
      firmado: true,
      version: res.body.version,
      hash: res.body.hash,
      firmado_at: '2026-11-06T15:00:00.000Z',
      contrafirmado: false,
    }),
  });
  disparar();
  await respiro();

  campo('otp').value = '123456';
  campo('acepta').checked = true;
  enviar();
  await respiro();

  const msg = elementos['mensaje'].textContent;
  assert.match(msg, /contrafirma/i,
    'la pantalla tiene que decir que el instrumento es bilateral');
  assert.ok(!/Anexo de Encargo firmado/.test(msg),
    'la pantalla no puede decir que el contrato quedó firmado: solo se suscribió');
});

// ===========================================================================
// UN ERROR DEL SERVICIO LLEGA A LA EMPRESA COMO TEXTO
// ===========================================================================

test('un error del servicio le llega a la Empresa como texto, no como "[object Object]"', async () => {
  const mensaje = 'Ruta no encontrada: GET /api/anexo-encargo/el-token';
  const { elementos, disparar } = correrPantalla('el-token', {
    get: respuestaError(404, {
      error: { code: 'NOT_FOUND', message: mensaje, request_id: 'req_prueba' },
    }),
  });
  disparar();
  await respiro();

  const mostrado = elementos['error-texto'].textContent;
  assert.notEqual(mostrado, '[object Object]',
    'la Empresa no puede leer "[object Object]": tiene que leer el mensaje del servicio');
  assert.equal(mostrado, mensaje);
});

test('un error sin envoltura tampoco se muestra como "[object Object]"', async () => {
  const { elementos, disparar } = correrPantalla('el-token', {
    get: respuestaError(500, {}),
  });
  disparar();
  await respiro();

  const mostrado = elementos['error-texto'].textContent;
  assert.notEqual(mostrado, '[object Object]');
  assert.ok(mostrado && mostrado.length > 0, 'tiene que haber un mensaje');
});
