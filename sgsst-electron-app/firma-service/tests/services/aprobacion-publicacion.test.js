/**
 * Tests del servicio de aprobaciones de publicación (decisión 1.f).
 *
 * Lo que se comprueba acá:
 *   - El registro de la aprobación (validación, hash calculado por el
 *     servidor, idempotencia, campos mínimos por tipo).
 *   - Que la tabla es append-only de verdad (los triggers muerden).
 *   - LA BARRERA: publicar una versión del Acuerdo sin autorización
 *     operativa registrada NO se puede. Ese es el punto de la decisión: sin
 *     esta comprobación, la autorización sería una promesa.
 *
 * Tests: src/services/aprobacionPublicacion.js, src/services/agreement.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { resetDb, makeApp, seedActiveAgreement, TEST_ADMIN_API_KEY } = require('../helpers');
const aprobacionPublicacion = require('../../src/services/aprobacionPublicacion');
const agreementService = require('../../src/services/agreement');
const readinessLegal = require('../../src/services/readinessLegal');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

// Textos y versiones propios de este archivo: la tabla de aprobaciones NO la
// limpia resetDb() (es append-only y es la evidencia de que la publicación
// estaba autorizada), así que cada caso usa su propio texto para que el hash
// no se confunda con el de otro test.
const TEXTO = 'ACUERDO DE PRUEBA PARA LA BARRERA DE PUBLICACION';
const TEXTO_2 = 'ACUERDO DE PRUEBA PARA LA BARRERA DE PUBLICACION, SEGUNDA PARTE';
const TEXTO_3 = 'ACUERDO DE PRUEBA PARA LA BARRERA DE PUBLICACION, TERCERA PARTE';

function operativa(version, texto) {
  return {
    version,
    texto,
    tipo: 'OPERATIVA',
    aprobado_por: 'test:responsable',
    fecha: '2026-10-27',
    garantia: 'Respaldo de la base y reversa probada',
    resultado_verificaciones: 'OK',
    responsable_despliegue: 'test:despliegue',
  };
}

// ---------------------------------------------------------------------------
// El registro
// ---------------------------------------------------------------------------

test('registrar: version con formato inválido → 400', () => {
  resetDb();
  assert.throws(
    () => aprobacionPublicacion.registrar(Object.assign(operativa('1.1', TEXTO))),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_VERSION_INVALIDA',
  );
});

test('registrar: tipo inválido → 400', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  datos.tipo = 'LEGAL';
  assert.throws(
    () => aprobacionPublicacion.registrar(datos),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_TIPO_INVALIDO',
  );
});

test('registrar: sin texto ni hash → 400 (el hash lo calcula el servidor)', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  delete datos.texto;
  assert.throws(
    () => aprobacionPublicacion.registrar(datos),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_HASH_INVALIDO',
  );
});

test('registrar: hash con formato inválido → 400', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  delete datos.texto;
  datos.hash = 'no-es-un-hash';
  assert.throws(
    () => aprobacionPublicacion.registrar(datos),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_HASH_INVALIDO',
  );
});

test('registrar: la OPERATIVA exige la evidencia completa → 400 sin garantía', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  delete datos.garantia;
  assert.throws(
    () => aprobacionPublicacion.registrar(datos),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_CAMPOS_INCOMPLETOS',
  );
});

test('registrar: la OPERATIVA sin responsable del despliegue → 400', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  delete datos.responsable_despliegue;
  assert.throws(
    () => aprobacionPublicacion.registrar(datos),
    (err) => err.statusCode === 400 && err.code === 'APROBACION_CAMPOS_INCOMPLETOS',
  );
});

test('registrar: la JURIDICA no pide la evidencia del despliegue → OK', () => {
  resetDb();
  const aprobacion = aprobacionPublicacion.registrar({
    version: 'v9.1',
    texto: TEXTO,
    tipo: 'JURIDICA',
    aprobado_por: 'test:abogado',
    fecha: '2026-10-27',
  });
  assert.equal(aprobacion.tipo, 'JURIDICA');
  assert.equal(aprobacion.garantia, null);
});

test('registrar: la fecha se normaliza a YYYY-MM-DD', () => {
  resetDb();
  const datos = operativa('v9.1', TEXTO);
  datos.fecha = '2026-10-27T14:40:00.000Z';
  const aprobacion = aprobacionPublicacion.registrar(datos);
  assert.equal(aprobacion.fecha, '2026-10-27');
});

test('registrar: el hash lo calcula el servidor a partir del texto', () => {
  resetDb();
  const aprobacion = aprobacionPublicacion.registrar(operativa('v9.1', TEXTO));
  assert.equal(aprobacion.hash, sha256(TEXTO));
  assert.equal(aprobacion.version, 'v9.1');
  assert.equal(aprobacion.tipo, 'OPERATIVA');
  assert.ok(aprobacion.fecha_creacion);
});

test('registrar: es idempotente (la misma aprobación no se duplica)', () => {
  resetDb();
  const primera = aprobacionPublicacion.registrar(operativa('v9.1', TEXTO));
  const segunda = aprobacionPublicacion.registrar(operativa('v9.1', TEXTO));
  assert.equal(segunda.id, primera.id);
  const filas = db.prepare(
    "SELECT COUNT(*) AS n FROM gh_firma_aprobaciones_publicacion "
    + "WHERE version = ? AND hash = ? AND tipo = 'OPERATIVA'"
  ).get('v9.1', sha256(TEXTO));
  assert.equal(filas.n, 1);
});

test('registrar: si la versión ya existe con otro texto → 409 (el hash no corresponde)', () => {
  resetDb();
  // Se publica la v9.2 con un texto (con la autorización operativa, porque la
  // barrera de publicación lo exige).
  aprobacionPublicacion.registrar(operativa('v9.2', TEXTO));
  agreementService.createVersion({ version: 'v9.2', texto: TEXTO });

  // Ahora se intenta aprobar OTRO texto para esa versión: la aprobación no
  // corresponde al texto publicado, así que se rechaza.
  assert.throws(
    () => aprobacionPublicacion.registrar(operativa('v9.2', TEXTO_2)),
    (err) => err.statusCode === 409 && err.code === 'APROBACION_HASH_NO_CORRESPONDE',
  );
});

// ---------------------------------------------------------------------------
// La consulta
// ---------------------------------------------------------------------------

test('listar: devuelve solo las aprobaciones de la versión pedida', () => {
  resetDb();
  aprobacionPublicacion.registrar(operativa('v9.3', TEXTO));
  aprobacionPublicacion.registrar(operativa('v9.4', TEXTO_2));
  const items = aprobacionPublicacion.listar('v9.3');
  assert.equal(items.length, 1);
  assert.equal(items[0].version, 'v9.3');
});

test('tieneAprobacionOperativa: solo da true con la versión y el hash exactos', () => {
  resetDb();
  const aprobacion = aprobacionPublicacion.registrar(operativa('v9.5', TEXTO));
  assert.equal(
    aprobacionPublicacion.tieneAprobacionOperativa('v9.5', sha256(TEXTO)),
    true,
  );
  // La versión no es la misma.
  assert.equal(
    aprobacionPublicacion.tieneAprobacionOperativa('v9.6', sha256(TEXTO)),
    false,
  );
  // El texto es otro (el hash cambia).
  assert.equal(
    aprobacionPublicacion.tieneAprobacionOperativa('v9.5', sha256(TEXTO_2)),
    false,
  );
  assert.equal(aprobacion.hash, sha256(TEXTO));
});

test('tieneAprobacionOperativa: una aprobación JURIDICA NO habilita la publicación', () => {
  resetDb();
  aprobacionPublicacion.registrar({
    version: 'v9.7',
    texto: TEXTO,
    tipo: 'JURIDICA',
    aprobado_por: 'test:abogado',
    fecha: '2026-10-27',
  });
  assert.equal(
    aprobacionPublicacion.tieneAprobacionOperativa('v9.7', sha256(TEXTO)),
    false,
  );
});

// ---------------------------------------------------------------------------
// Append-only de verdad
// ---------------------------------------------------------------------------

test('la tabla es append-only: UPDATE y DELETE abortan', () => {
  resetDb();
  const aprobacion = aprobacionPublicacion.registrar(operativa('v9.8', TEXTO));
  assert.throws(
    () => db.prepare(
      "UPDATE gh_firma_aprobaciones_publicacion SET notas = 'alterada' WHERE id = ?"
    ).run(aprobacion.id),
    /append-only/,
  );
  assert.throws(
    () => db.prepare(
      'DELETE FROM gh_firma_aprobaciones_publicacion WHERE id = ?'
    ).run(aprobacion.id),
    /append-only/,
  );
  // Y la fila sigue ahí, sin cambios.
  const fila = db.prepare(
    'SELECT * FROM gh_firma_aprobaciones_publicacion WHERE id = ?'
  ).get(aprobacion.id);
  assert.equal(fila.notas, null);
  assert.equal(fila.hash, sha256(TEXTO));
});

// ---------------------------------------------------------------------------
// LA BARRERA DE PUBLICACIÓN
// ---------------------------------------------------------------------------

test('BARRERA: publicar sin autorización operativa → 409', () => {
  resetDb();
  assert.throws(
    () => agreementService.createVersion({ version: 'v9.9', texto: TEXTO_2 }),
    (err) => err.statusCode === 409 && err.code === 'APROBACION_OPERATIVA_REQUERIDA',
  );
  // Y no se creó la versión (la barrera es real: no es un aviso).
  const fila = db.prepare(
    "SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones WHERE version = 'v9.9'"
  ).get();
  assert.equal(fila.n, 0);
});

test('BARRERA: publicar con la autorización operativa registrada → OK', () => {
  resetDb();
  aprobacionPublicacion.registrar(operativa('v9.10', TEXTO_2));
  const creada = agreementService.createVersion({ version: 'v9.10', texto: TEXTO_2 });
  assert.equal(creada.version, 'v9.10');
  assert.equal(creada.activa, 1);
});

test('BARRERA: la autorización es de ESE texto (otro texto → 409)', () => {
  resetDb();
  aprobacionPublicacion.registrar(operativa('v9.11', TEXTO));
  assert.throws(
    () => agreementService.createVersion({ version: 'v9.11', texto: TEXTO_2 }),
    (err) => err.statusCode === 409 && err.code === 'APROBACION_OPERATIVA_REQUERIDA',
  );
});

test('BARRERA: preparar el texto SIN publicarlo no necesita autorización', () => {
  resetDb();
  const creada = agreementService.createVersion({
    version: 'v9.12', texto: TEXTO_2, activa: false,
  });
  assert.equal(creada.version, 'v9.12');
  assert.equal(creada.activa, 0);
});

// ---------------------------------------------------------------------------
// La ruta admin (la única forma de dejar la autorización registrada)
// ---------------------------------------------------------------------------

test('RUTA: sin API key → 401', async () => {
  resetDb();
  const res = await request(makeApp())
    .post('/internal/admin/aprobaciones-publicacion')
    .send({ version: 'v9.13', texto: TEXTO, tipo: 'OPERATIVA', aprobado_por: 'x', fecha: '2026-10-27' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('RUTA: registra la autorización operativa (201) y la lista (GET)', async () => {
  resetDb();
  const res = await request(makeApp())
    .post('/internal/admin/aprobaciones-publicacion')
    .set(ADMIN)
    .send({
      version: 'v9.14',
      texto: TEXTO,
      tipo: 'OPERATIVA',
      aprobado_por: 'test:responsable',
      fecha: '2026-10-27',
      garantia: 'Respaldo de la base y reversa probada',
      resultado_verificaciones: 'OK',
      responsable_despliegue: 'test:despliegue',
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.aprobacion.hash, sha256(TEXTO),
    'el hash lo calcula el servidor, no el cliente');

  const lista = await request(makeApp())
    .get('/internal/admin/aprobaciones-publicacion?version=v9.14')
    .set(ADMIN);
  assert.equal(lista.status, 200);
  assert.equal(lista.body.items.length, 1);
  assert.equal(lista.body.items[0].tipo, 'OPERATIVA');
});

test('RUTA: la OPERATIVA sin la evidencia completa → 400', async () => {
  resetDb();
  const res = await request(makeApp())
    .post('/internal/admin/aprobaciones-publicacion')
    .set(ADMIN)
    .send({
      version: 'v9.15',
      texto: TEXTO,
      tipo: 'OPERATIVA',
      aprobado_por: 'test:responsable',
      fecha: '2026-10-27',
    });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'APROBACION_CAMPOS_INCOMPLETOS');
});

test('RUTA: sin texto ni hash → 400', async () => {
  resetDb();
  const res = await request(makeApp())
    .post('/internal/admin/aprobaciones-publicacion')
    .set(ADMIN)
    .send({
      version: 'v9.16',
      tipo: 'JURIDICA',
      aprobado_por: 'test:abogado',
      fecha: '2026-10-27',
    });
  assert.equal(res.status, 400);
});

test('RUTA: con la autorización registrada por la ruta, la publicación pasa', async () => {
  resetDb();
  const alta = await request(makeApp())
    .post('/internal/admin/aprobaciones-publicacion')
    .set(ADMIN)
    .send({
      version: 'v9.17',
      texto: TEXTO_2,
      tipo: 'OPERATIVA',
      aprobado_por: 'test:responsable',
      fecha: '2026-10-27',
      garantia: 'Respaldo de la base y reversa probada',
      resultado_verificaciones: 'OK',
      responsable_despliegue: 'test:despliegue',
    });
  assert.equal(alta.status, 201, JSON.stringify(alta.body));

  const creada = agreementService.createVersion({ version: 'v9.17', texto: TEXTO_2 });
  assert.equal(creada.version, 'v9.17');
  assert.equal(creada.activa, 1);
});

// ---------------------------------------------------------------------------
// El gate de readiness (el item nuevo de la decisión 1.f)
// ---------------------------------------------------------------------------

/** El item de la autorización operativa de la versión vigente. */
function itemAprobacionOperativa(gate) {
  const reporte = readinessLegal.evaluar({ gate });
  const item = reporte.grupos.flatMap((g) => g.items)
    .find((i) => i.id === 'aprobacion_operativa_vigente');
  assert.ok(item, 'el reporte tiene el item de la autorización operativa');
  return item;
}

test('READINESS: sin autorización operativa, el item de la versión vigente está PENDIENTE', () => {
  resetDb();
  // Una versión activa SIN autorización operativa: es el caso de la v1.0, que
  // ya estaba publicada cuando la decisión 1.f entró en vigor. Se arma con la
  // versión preparada (activa: false) y el mismo UPDATE que usa el reporte
  // para las fechas.
  //
  // El texto es propio de este test: la tabla de aprobaciones NO la limpia
  // resetDb(), así que un texto compartido con otro caso dejaría una
  // autorización vieja que haría pasar el item sin querer.
  agreementService.createVersion({ version: 'v9.20', texto: TEXTO_3, activa: false });
  db.prepare('UPDATE gh_firma_acuerdo_versiones SET activa = 1 WHERE version = ?').run('v9.20');
  const item = itemAprobacionOperativa('publicacion');
  assert.equal(item.estado, 'pendiente');
  assert.ok(item.accion, 'el item dice lo que falta');
  assert.ok(item.bloquea.includes('publicacion'));
  assert.ok(item.bloquea.includes('primera_firma'));
});

test('READINESS: con la autorización operativa, el item queda OK', () => {
  resetDb();
  seedActiveAgreement({ version: 'v9.19', texto: TEXTO });
  const item = itemAprobacionOperativa('publicacion');
  assert.equal(item.estado, 'ok');
  assert.equal(item.accion, '', 'si no falta nada, no hay acción que pedir');
});
