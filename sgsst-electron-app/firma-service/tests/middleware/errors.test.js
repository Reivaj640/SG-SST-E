/**
 * tests/middleware/errors.test.js
 *
 * Cubre la negociación de contenido del errorHandler.
 *
 * Contexto: un firmante que reabre el enlace del correo después de ya haber
 * firmado se encontraba con un JSON crudo. Ahora, en la superficie pública
 * (/s/* y /api/sign/*), si el cliente prefiere HTML recibe una página legible
 * con salida hacia la verificación de autenticidad.
 *
 * Este test NO abre la base de datos (PROMPT.md §7.7): monta una app express
 * con rutas que lanzan AppError y nada más.
 *
 * No usa supertest a propósito: se apoya en fetch nativo contra un puerto
 * efímero, con lo que no añade una dependencia al servicio.
 *
 * Regla de §7.4: un rojo aquí es un rojo NUEVO. Si falla, se corrige el
 * código, no el test.
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// config.js exige estas variables al cargarse (vía utils/logger). Mismo patrón
// de guardas que tests/setup.js, para que el archivo también se pueda correr
// aislado sin levantar la base de tests.
if (!process.env.INTERNAL_API_KEY) process.env.INTERNAL_API_KEY = 'test-errors-internal';
if (!process.env.ADMIN_API_KEY) process.env.ADMIN_API_KEY = 'test-errors-admin';
if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'localhost';
if (!process.env.SMTP_USER) process.env.SMTP_USER = 'test@example.com';
if (!process.env.SMTP_PASS) process.env.SMTP_PASS = 'test-pass';
if (!process.env.SMTP_FROM_EMAIL) process.env.SMTP_FROM_EMAIL = 'no-reply@example.com';

const { AppError, errorHandler } = require('../../src/middleware/errors');

// Cabecera de un navegador real. Si se usara '*/*', Express resolvería 'html'
// primero y la prueba de JSON no probaría nada.
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function makeApp() {
  const app = express();

  // Réplica de las formas de fallo reales de publicFlow.resolveToken.
  app.get('/s/:token', (req, res, next) => {
    switch (req.params.token) {
      case 'usado':
        return next(new AppError(410, 'TOKEN_ALREADY_USED',
          "La solicitud está en estado terminal 'SIGNED'"));
      case 'vencido':
        return next(new AppError(410, 'TOKEN_EXPIRED',
          'El token ha expirado', { expired_at: '2026-10-20T00:00:00.000Z' }));
      case 'falla':
        return next(new Error('detalle interno que no debe salir'));
      default:
        return next(new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe'));
    }
  });

  app.get('/api/sign/:token/verify', (req, res, next) => {
    return next(new AppError(404, 'TOKEN_NOT_FOUND', 'El token no existe'));
  });

  app.get('/api/sign/:token/identificar', (req, res, next) => {
    return next(new AppError(429, 'RATE_LIMITED', 'Demasiados intentos'));
  });

  // Fuera de la superficie pública: esto lo consume K+AIR con fetch.
  app.post('/internal/x', (req, res, next) => next(new Error('detalle interno')));

  app.use(errorHandler());
  return app;
}

let server;
let base;

before(async () => {
  server = makeApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

/** GET con Accept explícito. Devuelve { status, headers, text, json }. */
async function get(pathname, accept) {
  const res = await fetch(base + pathname, { headers: { Accept: accept } });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* no es JSON */ }
  return { status: res.status, headers: res.headers, text: text, json: json };
}

const post = (pathname, accept) =>
  fetch(base + pathname, { method: 'POST', headers: { Accept: accept } })
    .then(async (res) => ({ status: res.status, headers: res.headers, text: await res.text() }));

/** GET SIN header Accept (como un cliente que no dice nada). */
async function getSinAccept(pathname) {
  const res = await fetch(base + pathname);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* no es JSON */ }
  return { status: res.status, headers: res.headers, text: text, json: json };
}

// =============================================================================
// 1. Superficie pública + navegador → página HTML
// =============================================================================

test('GET /s/<token> ya usado con Accept de navegador responde 410 en HTML', async () => {
  const r = await get('/s/usado', BROWSER);
  assert.equal(r.status, 410);
  assert.match(r.headers.get('content-type'), /^text\/html/);
});

test('la página de error explica en español qué pasó', async () => {
  const r = await get('/s/usado', BROWSER);
  assert.ok(r.text.includes('Este enlace ya se usó'),
    'debe explicar el caso ya usado, no mostrar un mensaje genérico');
});

test('enlace vencido y enlace ya usado no muestran el mismo texto', async () => {
  // §7.3: si dos check afirmaran lo mismo, se invierten los dos. Aquí se
  // comprueba que los dos copy siguen siendo distinguibles.
  const usado = await get('/s/usado', BROWSER);
  const vencido = await get('/s/vencido', BROWSER);
  assert.ok(usado.text.includes('Este enlace ya se usó'));
  assert.ok(vencido.text.includes('Este enlace ya venció'));
  assert.ok(!usado.text.includes('Este enlace ya venció'));
  assert.ok(!vencido.text.includes('Este enlace ya se usó'));
});

test('enlace vencido ofrece verificar con URL relativa ?verificar=1', async () => {
  const r = await get('/s/vencido', BROWSER);
  assert.ok(r.text.includes('href="?verificar=1"'),
    'la salida a verificación es el cierre del ciclo para el firmante');
});

test('enlace inexistente no ofrece verificar', async () => {
  // Con TOKEN_NOT_FOUND el endpoint /verify también da 404: prometer una
  // verificación que va a fallar es peor que no ofrecerla.
  const r = await get('/s/loquesea', BROWSER);
  assert.equal(r.status, 404);
  assert.ok(r.text.includes('No encontramos este enlace'));
  assert.ok(!r.text.includes('verificar=1'),
    'no debe ofrecer verificación cuando no hay documento');
});

// =============================================================================
// 2. No se filtra nada interno
// =============================================================================

test('el mensaje interno del AppError no llega al HTML', async () => {
  // "estado terminal 'SIGNED'" es un string interno de publicFlow, pensado
  // para logs, no para la pantalla de un trabajador.
  const r = await get('/s/usado', BROWSER);
  assert.ok(!r.text.includes('SIGNED'));
  assert.ok(!r.text.includes('estado terminal'));
});

test('el mensaje de un error no controlado no llega al HTML', async () => {
  const r = await get('/s/falla', BROWSER);
  assert.equal(r.status, 500);
  assert.ok(!r.text.includes('detalle interno que no debe salir'));
  assert.ok(r.text.includes('No pudimos mostrarte esta información'));
});

test('el token no se refleja en el HTML, ni siquiera escapado', async () => {
  // La página usa una URL relativa justamente para esto: el token ya está en
  // la barra de direcciones y no hace falta reimprimirlo en el cuerpo.
  const nasty = '"><script>alert(1)</script>';
  const r = await get('/s/' + encodeURIComponent(nasty), BROWSER);
  assert.ok(!r.text.includes('<script'), 'ningún tag sin escapar');
  assert.ok(!r.text.includes('alert(1)'), 'el token no debe aparecer');
});

test('un token que no es base64url no se inyecta en el href', async () => {
  // Allowlist TOKEN_PATTERN: sin ella, un token con comillas produciría un
  // href inyectado en la página de error.
  const nasty = '"><script>alert(1)</script>';
  const r = await get('/api/sign/' + encodeURIComponent(nasty) + '/identificar', BROWSER);
  assert.ok(!r.text.includes('<script'));
  assert.ok(!r.text.includes('alert(1)'));
});

test('la página no se ofrece a sí misma desde /verify (anti-bucle)', async () => {
  const r = await get('/api/sign/abcDEF_123/verify', BROWSER);
  assert.ok(!r.text.includes('verificar=1'),
    'un botón que lleva a sí mismo repetiría el fallo en bucle');
});

// =============================================================================
// 3. Cabeceras: el token es una credencial de un solo uso
// =============================================================================

test('la página de error no se deja cachear', async () => {
  const r = await get('/s/usado', BROWSER);
  assert.match(r.headers.get('cache-control'), /no-store/);
});

test('la página de error no filtra el token por Referer', async () => {
  // La URL abierta contiene el token. Sin esta cabecera, seguir el botón de
  // verificación se lo mandaría al sitio de destino.
  const r = await get('/s/usado', BROWSER);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

test('el JSON de error del firmante tampoco se cachea', async () => {
  // Verificado en producción: un 410 de /s/<token> sin Cache-Control quedaba
  // en el caché del navegador y el trabajador seguía viendo JSON crudo aunque
  // el servidor ya devolviera la mini-app. La URL lleva el token, que es una
  // credencial de un solo uso, y no debería quedar en disco.
  const r = await get('/s/usado', 'application/json');
  assert.match(r.headers.get('cache-control'), /no-store/);
});

test('fuera de la superficie pública no se tocan las cabeceras de caché', async () => {
  // K+AIR consume /internal/* con fetch: cambiar sus cabeceras no aporta nada
  // y podría sorprender a un cliente que sí cachea.
  const r = await post('/internal/x', BROWSER);
  assert.equal(r.headers.get('cache-control'), null);
});

test('la página de error se sirve con nosniff', async () => {
  const r = await get('/s/usado', BROWSER);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('la página de error es autocontenida (sin recursos externos)', async () => {
  // El errorHandler puede dispararse en /api/*, donde un link relativo a
  // styles.css apuntaría a un archivo inexistente.
  const r = await get('/s/usado', BROWSER);
  assert.ok(!r.text.includes('<link'), 'sin hojas de estilo externas');
  assert.ok(!r.text.includes('<script'), 'sin scripts');
  assert.ok(r.text.includes('<style'), 'los estilos van inline');
});

// =============================================================================
// 4. Fuera de la superficie pública, JSON siempre
// =============================================================================

test('un cliente que pide JSON recibe JSON, no HTML', async () => {
  const r = await get('/s/usado', 'application/json');
  assert.equal(r.status, 410);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(r.json.error.code, 'TOKEN_ALREADY_USED');
  assert.ok(r.json.error.request_id, 'el JSON conserva request_id');
});

test('/internal/* sigue respondiendo JSON aunque el cliente pida HTML', async () => {
  // El criterio es por ruta, no solo por Accept: K+AIR consume estos
  // endpoints con fetch y un Accept comodín se llevaría HTML donde espera JSON.
  const r = await post('/internal/x', BROWSER);
  assert.equal(r.status, 500);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(JSON.parse(r.text).error.code, 'INTERNAL_ERROR');
});

test('/api/sign/* con navegador también negocia HTML', async () => {
  const r = await get('/api/sign/abc/identificar', BROWSER);
  assert.match(r.headers.get('content-type'), /^text\/html/);
});

// =============================================================================
// 4b. Superficie pública + cliente de PROGRAMA → JSON
// =============================================================================
//
// La superficie pública sirve el error como página HTML para el navegador.
// Para un cliente de programa tiene que ser JSON, y el caso más común es
// el que no dice nada: `curl` y `fetch` mandan `Accept: */*` por defecto, y
// muchos clientes ni siquiera mandan la cabecera.
//
// Antes, con la lista de tipos en el orden `['html', 'json']`, un `*/*` se
// resolvía a HTML (el primero de la lista gana el desempate) y el cliente
// se llevaba una página donde esperaba un sobre JSON: el parseo fallaba en
// silencio y lejos de la causa real. 47 pruebas de la suite caían justo
// ahí.
//
// Ahora el comodín se resuelve a JSON, y la página queda para quien la pide
// explícitamente.

test('la superficie pública con Accept comodín responde JSON, no la página', async () => {
  const r = await get('/s/usado', '*/*');
  assert.equal(r.status, 410);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(r.json.error.code, 'TOKEN_ALREADY_USED');
});

test('la superficie pública SIN header Accept responde JSON', async () => {
  const r = await getSinAccept('/s/usado');
  assert.equal(r.status, 410);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.equal(r.json.error.code, 'TOKEN_ALREADY_USED');
});

test('/api/sign/* con Accept comodín responde JSON', async () => {
  const r = await get('/api/sign/abc/identificar', '*/*');
  assert.match(r.headers.get('content-type'), /application\/json/);
});

test('/api/sign/* SIN header Accept responde JSON', async () => {
  const r = await getSinAccept('/api/sign/abc/identificar');
  assert.match(r.headers.get('content-type'), /application\/json/);
});

test('MUTACION: si la lista vuelve a empezar por html, el comodín se lleva la pagina', async () => {
  // Este test es el ancla del comportamiento: si alguien vuelve a poner
  // 'html' primero, el `*/*` vuelve a resolverse a HTML y este falla.
  const r = await get('/s/usado', '*/*');
  assert.doesNotMatch(r.headers.get('content-type'), /^text\/html/,
    'un cliente de programa no puede recibirse una pagina HTML');
});

// =============================================================================
// 4c. La PÁGINA sigue saliendo para quien la pide explícitamente
// =============================================================================
//
// El default de los tests es `Accept: application/json` (ver tests/setup.js),
// así que el camino HTML ya no se ejerce por accidente. Estos dos tests lo
// fijan para que la página del firmante no se rompa sin que nadie se entere:
// si el HTML dejara de servirse, el navegador mostraría JSON crudo en vez de
// una página, y ningún test de los de programa lo detectaría.

test('la superficie pública con Accept: text/html explícito responde HTML', async () => {
  const r = await get('/s/usado', 'text/html');
  assert.equal(r.status, 410);
  assert.match(r.headers.get('content-type'), /^text\/html/);
  assert.doesNotMatch(r.text, /^\s*\{/, 'la respuesta no debe ser JSON');
});

test('/api/sign/* con Accept: text/html explícito responde HTML', async () => {
  const r = await get('/api/sign/abc/identificar', 'text/html');
  assert.match(r.headers.get('content-type'), /^text\/html/);
});

// =============================================================================
// 5. Mutación del ancla: si el criterio de ruta se afloja, esto se cae
// =============================================================================

test('el filtro de superficie pública cubre /s y /api/sign y nada más', async () => {
  const publico = await get('/s/usado', BROWSER);
  const interno = await post('/internal/x', BROWSER);
  assert.ok(publico.text.startsWith('<!DOCTYPE html>'));
  assert.ok(!interno.text.startsWith('<!DOCTYPE html>'));
});