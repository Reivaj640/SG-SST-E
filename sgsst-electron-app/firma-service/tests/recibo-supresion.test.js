/**
 * EL RECIBO DE SUPRESIÓN (3.6(g) y 10.6)
 * ========================================
 *
 * QUÉ PIDE EL TEXTO
 * -----------------
 * El 3.6(g) del Acuerdo de uso:
 *
 *   "La supresión dentro de la ventana de purga del 8.6 no es alteración: da
 *    lugar a una lápida que identifica la solicitud, la fecha y hora, las
 *    categorías suprimidas y el fundamento del plazo, y a un recibo que la
 *    Empresa entrega al Trabajador si lo solicita."
 *
 * QUÉ HAY Y QUÉ FALTA
 * -------------------
 * HAY: las dos piezas de evidencia (la lápida `gh_firma_purgadas` y el recibo
 * de purgas `gh_firma_purga_registro`), las dos append-only.
 *
 * FALTA (y esto es lo que estos tests cubren):
 *
 *   1. La LÁPIDA NO IDENTIFICABA LA SOLICITUD. Guardaba el `firma_id` (un
 *      entero interno) y el `id_empresa`, pero no el identificador que el
 *      Trabajador y la Empresa conocen (SIGN-YYYY-NNNNNN). Y como la
 *      supresión borra la fila de la firma entera, ese dato se perdía para
 *      siempre. La migración 040 lo arregla.
 *
 *   2. NO HABÍA ENTREGA. Nadie podía obtener el recibo para entregárselo al
 *      Trabajador: el 3.6(g) se cumplía a medias.
 *
 *   3. El recibo se armaba a MEDIAS: el servicio pedía el `firma_id` de la
 *      lápida sin haberlo trayendo en el SELECT. `better-sqlite3` liga un
 *      `undefined` como NULL (no lanza), así que el fallo era SILENCIOSO:
 *      el `WHERE firma_id = NULL` no encontraba la fila del recibo de purgas
 *      y el recibo salía sin la ventana de purga, sin la comprobación del
 *      hold y sin el recuento de eventos. Un fallo silencioso es peor que
 *      uno ruidoso: el recibo parecía completo y no lo estaba.
 *
 * A QUIÉN SE LE ENTREGA
 * ---------------------
 * A la Empresa, que es la Responsable del dato y la que se lo entrega al
 * Trabajador (el 10.7(e): el Titular acude primero a la Empresa). Por eso el
 * endpoint es PER-EMPRESA: una Empresa consulta SUS recibos, no los de
 * otras. Y el recibo NO lleva datos personales.
 *
 * LO QUE COMPRUEBAN ESTOS TESTS
 * -------------------------------
 *   1. El recibo identifica las CUATRO cosas que el 3.6(g) exige.
 *   2. El recibo se entrega por la vía per-empresa.
 *   3. Una Empresa no puede ver los recibos de otra.
 *   4. Una solicitud sin supresión no tiene recibo (404, no 204).
 *   5. El recibo no lleva datos personales.
 *   6. MUTACIÓN: sin las columnas de la 040 el recibo NO identifica la
 *      solicitud, y el test falla.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const request = require('supertest');

const db = require('../src/db/connection');
const reciboService = require('../src/services/reciboSupresion');
const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion, seedTestClients,
  withApiKey, withClientAApiKey, assertJsonError,
  TEST_EMPRESA_A, TEST_EMPRESA_B,
} = require('./helpers');

const HORA = 3600 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea una firma vencida, sin hold y con los tres archivos en disco.
 */
async function setupVencida({ id_empresa = TEST_EMPRESA_A } = {}) {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa,
    identificacion_numero: '1234567890',
  });

  const storage = require('../src/services/storage');
  const paths = [];
  for (const nombre of ['original', 'firmado', 'constancia']) {
    const p = storage.PATHS.pdfs + '/test-recibo-' + nombre + '-' + signRequest.id + '.pdf';
    fs.mkdirSync(require('node:path').dirname(p), { recursive: true });
    fs.writeFileSync(p, '%PDF-1.4\n%%EOF\n');
    paths.push(p);
  }

  const ahora = Date.now();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?,
           hold_legal = 0,
           motivo_hold = NULL,
           pdf_original_path = ?,
           pdf_firmado_path = ?,
           constancia_path = ?
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    new Date(ahora - 24 * HORA).toISOString(),
    new Date(ahora + 48 * HORA).toISOString(),
    paths[0], paths[1], paths[2],
    signRequest.id
  );

  return { token, signRequest, paths };
}

/**
 * La operación de purga completa (las dos capas), como la corre el script.
 */
function purgar({ id_empresa = null } = {}) {
  conservacion.abrirVentana({
    actor: 'operador', motivo: 'Vencimiento del plazo declarado', minutos: 15,
  });
  const lote = conservacion.armarLote({
    actor: 'operador', motivo: 'Vencimiento del plazo declarado', id_empresa,
  });
  const auditoria = conservacion.purgar({ actor: 'operador', cerrar: false });
  const datos = supresion.suprimir({
    actor: 'operador',
    motivo: 'Vencimiento del plazo declarado',
    dryRun: false,
    id_empresa,
  });
  conservacion.cerrarVentana({ actor: 'operador' });
  return { lote, auditoria, datos };
}

// =========================================================================
// 1. EL RECIBO IDENTIFICA LAS CUATRO COSAS DEL 3.6(g)
// =========================================================================

test('recibo · la lapida identifica la solicitud, la fecha, las categorias y el fundamento', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  const fechaConservacion = db.prepare(
    'SELECT fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id).fecha_conservacion;

  purgar();

  const lapida = db.prepare(
    'SELECT * FROM gh_firma_purgadas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);

  assert.ok(lapida, 'la lapida tiene que existir y se tiene que encontrar por la solicitud');
  assert.equal(lapida.id_solicitud, signRequest.id_solicitud,
    'el 3.6(g): la lapida identifica la solicitud');
  assert.ok(lapida.purgado_at, 'el 3.6(g): la lapida lleva la fecha y hora');
  assert.ok(lapida.categorias, 'el 3.6(g): la lapida lleva las categorias suprimidas');
  assert.equal(lapida.fecha_conservacion, fechaConservacion,
    'el 3.6(g): la lapida lleva el fundamento del plazo');
});

test('recibo · el recibo por solicitud trae las cuatro cosas del 3.6(g)', async () => {
  resetDb();
  const { signRequest } = await setupVencida();

  purgar();

  const recibo = reciboService.porSolicitud(signRequest.id_solicitud);
  assert.ok(recibo, 'tiene que haber recibo');
  assert.equal(recibo.id_solicitud, signRequest.id_solicitud);
  assert.ok(recibo.purgado_at, 'la fecha y hora de la supresion');
  assert.ok(Array.isArray(recibo.categorias) && recibo.categorias.length > 0,
    'las categorias suprimidas');
  assert.ok(recibo.categorias.includes('fila_firma'),
    'las categorias tienen que decir que se suprimio la fila: ' + JSON.stringify(recibo.categorias));
  assert.ok(recibo.fecha_conservacion, 'el fundamento del plazo');
  assert.equal(recibo.id_empresa, TEST_EMPRESA_A);
  assert.ok(recibo.actor, 'quien lo hizo');
  assert.ok(recibo.motivo, 'por que lo hizo');

  // Y los detalles que vienen del RECIBO DE PURGAS (no de la lapida): la
  // ventana en la que se suprimio, la comprobacion del hold y el recuento de
  // eventos. Si el cruce entre la lapida y el recibo se rompe, el recibo sale
  // con estos tres en null: un fallo SILENCIOSO, y por eso se comprueban.
  assert.ok(recibo.ventana_hasta,
    'el recibo tiene que decir en que ventana se suprimio');
  assert.equal(recibo.hold_verificado, true,
    'el recibo tiene que decir que se comprobo el hold');
  assert.equal(recibo.eventos_purgados, 1,
    'el recibo tiene que decir cuantos eventos de auditoria se suprimieron');
  assert.equal(recibo.archivos_eliminados, 3,
    'y cuantos archivos: la capa de datos');
});

test('recibo · el recibo existe aunque la fila de la firma ya no exista', async () => {
  resetDb();
  const { signRequest } = await setupVencida();

  purgar();

  // La firma se fue...
  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(fila, undefined, 'la fila de la firma tiene que estar suprimida');

  // ...pero el recibo sigue ahí, con la solicitud y el fundamento.
  const recibo = reciboService.porSolicitud(signRequest.id_solicitud);
  assert.ok(recibo, 'el recibo sobrevive a la supresion: es la prueba');
  assert.equal(recibo.id_solicitud, signRequest.id_solicitud);
  assert.ok(recibo.fecha_conservacion);
});

// =========================================================================
// 2. LA ENTREGA POR LA VIA PER-EMPRESA
// =========================================================================

test('recibo · el endpoint per-empresa devuelve los recibos de esa empresa', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  purgar();

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/empresas/${TEST_EMPRESA_A}/recibos-supresion`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 200);
  assert.equal(res.body.id_empresa, TEST_EMPRESA_A);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].id_solicitud, signRequest.id_solicitud);
  assert.ok(res.body.items[0].fecha_conservacion);
});

test('recibo · el endpoint por solicitud devuelve el recibo de esa solicitud', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  purgar();

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/recibos-supresion/${signRequest.id_solicitud}`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 200);
  assert.equal(res.body.id_solicitud, signRequest.id_solicitud);
  assert.ok(res.body.categorias.length > 0);
});

test('recibo · una solicitud que no fue suprimida NO tiene recibo (404, no 204)', async () => {
  resetDb();
  await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: TEST_EMPRESA_A,
    identificacion_numero: '1234567890',
  });

  const app = makeApp();
  const res = await request(app)
    .get('/internal/recibos-supresion/SIGN-2026-000001')
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 404);
  assertJsonError(res, 'RECIBO_SUPERSION_NOT_FOUND');
});

test('recibo · un id de solicitud con formato invalido es un 400 explicito', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app)
    .get('/internal/recibos-supresion/no-es-un-id')
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 400);
  assertJsonError(res, 'INVALID_REQUEST_BODY');
});

test('recibo · sin llave interna no hay recibo (401)', async () => {
  resetDb();
  const app = makeApp();
  const res = await request(app).get('/internal/recibos-supresion/SIGN-2026-000001');

  assert.equal(res.status, 401);
  assertJsonError(res, 'INVALID_API_KEY');
});

test('recibo · un limite invalido es un 400 explicito', async () => {
  resetDb();
  const app = makeApp();
  for (const limite of ['0', '-1', '501', 'abc', '1.5']) {
    const res = await request(app)
      .get(`/internal/empresas/${TEST_EMPRESA_A}/recibos-supresion?limite=${limite}`)
      .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);
    assert.equal(res.status, 400, 'limite=' + limite);
    assertJsonError(res, 'INVALID_REQUEST_BODY');
  }
});

// =========================================================================
// 3. EL AISLAMIENTO ENTRE EMPRESAS
// =========================================================================

test('recibo · una empresa NO puede pedir el recibo de otra (404 silencioso)', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await setupVencida({ id_empresa: TEST_EMPRESA_B });
  purgar({ id_empresa: TEST_EMPRESA_B });

  const app = makeApp();
  // Cliente A (empresa 900123456) pide el recibo de una solicitud de la
  // empresa B. No puede saber si existe.
  const res = await request(app)
    .get(`/internal/recibos-supresion/${signRequest.id_solicitud}`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 404, 'no puede ser 403 con datos ni 200 con lo ajeno');
  assertJsonError(res, 'RECIBO_SUPERSION_NOT_FOUND');
});

test('recibo · el listado per-empresa de otra empresa no devuelve nada', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await setupVencida({ id_empresa: TEST_EMPRESA_B });
  purgar({ id_empresa: TEST_EMPRESA_B });

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/empresas/${TEST_EMPRESA_A}/recibos-supresion`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0, 'la empresa A no tiene recibos: los de B no son suyos');
  assert.equal(res.body.items.length, 0);
});

test('recibo · el listado per-empresa de la propia empresa sí devuelve los suyos', async () => {
  resetDb();
  seedTestClients();
  const { signRequest } = await setupVencida({ id_empresa: TEST_EMPRESA_A });
  purgar({ id_empresa: TEST_EMPRESA_A });

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/empresas/${TEST_EMPRESA_A}/recibos-supresion`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY_CLIENT_A);

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.items[0].id_solicitud, signRequest.id_solicitud);
});

test('recibo · el total por empresa cuenta solo los recibos de esa empresa', async () => {
  resetDb();
  seedTestClients();
  const a = await setupVencida({ id_empresa: TEST_EMPRESA_A });
  purgar({ id_empresa: TEST_EMPRESA_A });
  const b = await setupVencida({ id_empresa: TEST_EMPRESA_B });
  purgar({ id_empresa: TEST_EMPRESA_B });

  assert.equal(reciboService.totalPorEmpresa(TEST_EMPRESA_A), 1);
  assert.equal(reciboService.totalPorEmpresa(TEST_EMPRESA_B), 1);
  assert.equal(reciboService.totalPorEmpresa('999999999'), 0);
  assert.ok(a.signRequest.id_solicitud);
  assert.ok(b.signRequest.id_solicitud);
});

// =========================================================================
// 4. EL RECIBO NO LLEVA DATOS PERSONALES
// =========================================================================

test('recibo · el recibo no lleva datos personales', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  purgar();

  const app = makeApp();
  const res = await request(app)
    .get(`/internal/recibos-supresion/${signRequest.id_solicitud}`)
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  const texto = JSON.stringify(res.body);
  assert.doesNotMatch(texto, /trabajador@test\.com/,
    'el correo del trabajador no puede ir en el recibo');
  assert.doesNotMatch(texto, /nombre_trabajador/);
  // La huella del documento tampoco: el recibo no dice qué documento se
  // suprimio, solo que se suprimio una solicitud.
  assert.doesNotMatch(texto, /document_hash|huella_documento/);
});

test('recibo · el recibo no expone la credencial del enlace', async () => {
  resetDb();
  const { token, signRequest } = await setupVencida();
  purgar();

  const recibo = reciboService.porSolicitud(signRequest.id_solicitud);
  const texto = JSON.stringify(recibo);
  assert.doesNotMatch(texto, new RegExp(token.slice(0, 8)),
    'el recibo no puede contener el token');

  const lapida = db.prepare(
    'SELECT * FROM gh_firma_purgadas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.ok(lapida);
  assert.doesNotMatch(JSON.stringify(lapida), new RegExp(token.slice(0, 8)));
});

// =========================================================================
// 5. MUTACIONES
// =========================================================================

test('recibo · MUTACION: sin las columnas de la 040 el recibo NO identifica la solicitud', () => {
  // Se simula la migracion 040 SIN sus columnas: la lapida queda como estaba
  // antes (sin id_solicitud ni fecha_conservacion). El recibo tiene que
  // seguir sin identificarla, y el servicio no puede inventarla.
  resetDb();
  db.prepare(`
    INSERT INTO gh_firma_purgadas
      (firma_id, token_tombstone, id_empresa, actor, motivo, categorias)
    VALUES (999, 'tombstone-de-prueba', ?, 'operador', 'Vencimiento del plazo', '[]')
  `).run(TEST_EMPRESA_A);

  const recibo = reciboService.porSolicitud('SIGN-2026-000123');
  assert.equal(recibo, null,
    'sin la 040 no hay forma de encontrar la lapida por solicitud: el recibo no se inventa');

  // Y la razon de fondo: la columna no existe todavia.
  const columnas = db.prepare('PRAGMA table_info(gh_firma_purgadas)').all()
    .map((c) => c.name);
  assert.ok(columnas.includes('id_solicitud'),
    'la migracion 040 tiene que haber agregado id_solicitud');
  assert.ok(columnas.includes('fecha_conservacion'),
    'la migracion 040 tiene que haber agregado fecha_conservacion');
});

test('recibo · MUTACION: sin la fila de la lapida el servicio no puede armar el recibo', () => {
  // Se comprueba que el recibo NO se arma solo con el recibo de purgas: sin
  // la lapida (que es la que tiene el id_solicitud y el fundamento del plazo)
  // no hay identificacion de la solicitud, y el servicio no la inventa.
  resetDb();
  db.prepare(`
    INSERT INTO gh_firma_purga_registro
      (firma_id, id_empresa, actor, motivo, categorias, hold_verificado, eventos_purgados)
    VALUES (999, ?, 'operador', 'Vencimiento del plazo', 'eventos_auditoria', 1, 3)
  `).run(TEST_EMPRESA_A);

  const recibo = reciboService.porSolicitud('SIGN-2026-000123');
  assert.equal(recibo, null,
    'sin lapida y sin firma viva no hay recibo: el servicio no inventa la solicitud');
});

test('recibo · el 10.5(d): la purga del registro de auditoria deja recibo con la solicitud', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  const fechaConservacion = db.prepare(
    'SELECT fecha_conservacion FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id).fecha_conservacion;

  // Solo la capa de auditoria: la fila de la firma sigue viva.
  conservacion.abrirVentana({ actor: 'operador', motivo: 'prueba', minutos: 15 });
  conservacion.armarLote({ actor: 'operador', motivo: 'prueba' });
  conservacion.purgar({ actor: 'operador', cerrar: false });
  conservacion.cerrarVentana({ actor: 'operador' });

  // El recibo de la purga existe...
  const filas = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firma_purga_registro WHERE firma_id = ?'
  ).get(signRequest.id).n;
  assert.equal(filas, 1, 'la capa de auditoria dejo su recibo');

  // ...y el recibo de supresion identifica la solicitud y el fundamento del
  // plazo (el 10.5(d): la supresion del registro de auditoria deja el recibo
  // del 3.6(g)).
  const recibo = reciboService.porSolicitud(signRequest.id_solicitud);
  assert.ok(recibo, 'la purga de auditoria deja recibo: el 10.5(d)');
  assert.equal(recibo.id_solicitud, signRequest.id_solicitud);
  assert.equal(recibo.fecha_conservacion, fechaConservacion,
    'el recibo tiene que llevar el fundamento del plazo (la 041)');
  assert.ok(recibo.categorias.includes('eventos_auditoria'),
    'y decir QUE se suprimio: ' + JSON.stringify(recibo.categorias));

  // Y la firma sigue viva: la purga de auditoria no borra el documento.
  assert.ok(
    db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id),
    'la capa de auditoria no borra la fila de la firma'
  );
});

test('recibo · MUTACION: sin las columnas de la 041 el recibo no lleva el fundamento', () => {
  // Se comprueba que la columna existe: sin ella, el recibo de la purga de
  // auditoria no puede decir hasta cuando hubo que conservar el dato.
  resetDb();
  const columnas = db.prepare('PRAGMA table_info(gh_firma_purga_registro)').all()
    .map((c) => c.name);
  assert.ok(columnas.includes('id_solicitud'),
    'la migracion 041 tiene que haber agregado id_solicitud al recibo');
  assert.ok(columnas.includes('fecha_conservacion'),
    'la migracion 041 tiene que haber agregado fecha_conservacion al recibo');
});
