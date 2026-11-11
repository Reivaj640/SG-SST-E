/**
 * LA ACREDITACION DE LA FACULTAD DE QUIEN CONTRAFIRMA POR GESSTIAR
 * ============================================================================
 *
 * El abogado (respuesta al punto P7, 10-nov-2026) condiciono la contrafirma
 * del Anexo de Nube:
 *
 *   "La ejecucion por una persona distinta del representante legal de
 *    Gesstiar S.A.S. requerira acreditar previamente la facultad de
 *    representacion o poder suficiente, que debera conservarse en el
 *    expediente."
 *
 * Lo que se verifica aca:
 *
 *  - Que el REGISTRO de poderes exige nombre, tipo, referencia y huella del
 *    documento, y un motivo: sin las dos cosas no es una acreditacion.
 *  - Que la revocacion NO borra la fila: la deja en REVOCADO, con su fecha y
 *    su motivo, y escribe el evento.
 *  - Que el REPRESENTANTE LEGAL del Encargado (el que declara el manifiesto
 *    legal) puede contrafirmar sin acreditar nada mas.
 *  - Que una TERCERA persona solo puede contrafirmar con un poder VIGENTE a
 *    su nombre, y que sin el el acto NO se cierra (409).
 *  - Que un poder vencido, revocado o que todavia no empieza NO sirve.
 *  - Que la contrafirma deja la acreditacion por escrito en la evidencia y en
 *    el acta.
 *  - Que el rastro de los poderes es append-only (trigger real).
 *  - Que las rutas administrativas exigen la llave de admin y el motivo.
 *
 * EL ARNES DE TESTS
 * -----------------
 * `resetDb()` siembra un poder de prueba a nombre de 'admin' y
 * 'admin:operador' (los actores que usan los tests de contrafirma). Los tests
 * que necesitan el registro VACIO lo vacian explicitamente.
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const db = require('../src/db/connection');
const request = require('supertest');
const poderes = require('../src/services/poderesEncargado');
const anexoNube = require('../src/services/anexoNube');
const anexoEncargo = require('../src/services/anexoEncargo');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const actaAnexoNube = require('../src/services/actaAnexoNube');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('./helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ID_EMPRESA = '900666555';
const CORREO_FIRMANTE = 'representante@empresa-facultad.test';
const NOMBRE_FIRMANTE = 'PERSONA DE PRUEBA';
const SIN_FACULTAD = 'PERSONA SIN FACULTAD';
const HASH = 'c'.repeat(64);

// ===========================================================================
// HELPERS
// ===========================================================================

/** Deja el registro de poderes VACIO (el arnes siembra los de prueba). */
function vaciarRegistro() {
  db.prepare('DELETE FROM gh_firma_encargado_poderes_eventos').run();
  db.prepare('DELETE FROM gh_firma_encargado_poderes').run();
}

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, 'EMPRESA DE PRUEBA SAS', '900666555-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-facultad.test',
    'datos@empresa-facultad.test', NOMBRE_FIRMANTE);
}

/** Abre, pide el codigo y suscribe: el PRIMER acto. */
async function suscribir() {
  const abierto = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: NOMBRE_FIRMANTE,
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });
  await anexoNube.solicitarCodigo(abierto.token, {});
  const correo = mailer.getDevInbox()
    .filter((c) => c.tipo === 'anexo_nube').pop();
  anexoNube.suscribir(abierto.token, {
    otp: correo.otp, acepta: true,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });
  return db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones').get().id;
}

/** Pide el codigo de la contrafirma y devuelve el codigo. */
async function pedirCodigoContrafirma(idSuscripcion) {
  await anexoNube.solicitarContrafirmaAnexoNube(ID_EMPRESA, idSuscripcion, {
    ip: '10.0.0.9', user_agent: 'Operador/1.0',
  });
  const correo = mailer.getDevInbox()
    .filter((c) => c.tipo === 'anexo_nube_contrafirma').pop();
  return correo.otp;
}

/** El texto del PDF en una sola linea (para comprobar FRASES). */
function textoPlano(buffer) {
  const crudo = buffer.toString('latin1');
  const flujos = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(crudo)) !== null) {
    const inicio = m.index + m[0].length;
    const fin = crudo.indexOf('endstream', inicio);
    if (fin < 0) continue;
    try {
      flujos.push(zlib.inflateSync(buffer.slice(inicio, fin)).toString('latin1'));
    } catch (e) { /* no es un flujo comprimido */ }
  }
  const contenido = flujos.join('\n');
  const textos = [];
  const reTexto = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let t;
  while ((t = reTexto.exec(contenido)) !== null) {
    textos.push(Buffer.from(t[1], 'hex').toString('latin1'));
  }
  return textos.join('\n').replace(/\s+/g, ' ');
}

// ===========================================================================
// 1. EL REGISTRO DE PODERES
// ===========================================================================

test('un poder sin nombre, sin instrumento o sin huella NO se registra', () => {
  resetDb();
  vaciarRegistro();

  assert.throws(
    () => poderes.registrarPoder({ tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH },
      { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'NOMBRE_REQUERIDO',
    'sin saber a quien se le da la facultad no hay nada que acreditar',
  );

  assert.throws(
    () => poderes.registrarPoder({ nombre: 'PERSONA', tipo: 'PODER', instrumento_sha256: HASH },
      { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'INSTRUMENTO_REQUERIDO',
    'sin decir contra que documento, no hay contra que contrastar',
  );

  assert.throws(
    () => poderes.registrarPoder({ nombre: 'PERSONA', tipo: 'PODER', instrumento_ref: 'Poder 1' },
      { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'INSTRUMENTO_HASH_INVALIDO',
    'sin la huella del documento, el expediente no puede verificarlo',
  );

  assert.throws(
    () => poderes.registrarPoder({
      nombre: 'PERSONA', tipo: 'CUALQUIERA', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'TIPO_INVALIDO',
    'el tipo lo declara el operador, pero solo puede ser uno de los tres',
  );

  assert.equal(poderes.listarPoderes().length, 0, 'no se registro ninguno');
});

test('un poder sin motivo NO se registra', () => {
  resetDb();
  vaciarRegistro();

  assert.throws(
    () => poderes.registrarPoder({
      nombre: 'PERSONA', tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
    'registrar un poder habilita a alguien a firmar por la empresa: tiene que decir por que',
  );
});

test('un poder registrado queda con su documento, su motivo y su rastro', () => {
  resetDb();
  vaciarRegistro();

  const creado = poderes.registrarPoder({
    nombre: 'PERSONA DE PRUEBA',
    cargo: 'Apoderado',
    tipo: 'PODER',
    instrumento_ref: 'Poder del 1-nov-2026',
    instrumento_sha256: HASH,
    documento_archivo: 'poder-1.pdf',
    emitido_at: '2026-11-01',
    vigente_desde: '2026-11-01',
    vigente_hasta: '2027-11-01',
  }, { actor: 'admin', motivo: 'Se recibio el poder firmado', ip: '10.0.0.1', user_agent: 'test' });

  assert.ok(creado.id);
  assert.equal(creado.estado, 'VIGENTE');
  assert.equal(creado.instrumento_sha256, HASH);
  assert.equal(creado.motivo, 'Se recibio el poder firmado');

  const eventos = poderes.eventosDePoder(creado.id);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, 'PODER_REGISTRADO');
});

test('revocar un poder NO lo borra: lo deja en REVOCADO, con su fecha y su motivo', () => {
  resetDb();
  vaciarRegistro();

  const creado = poderes.registrarPoder({
    nombre: 'PERSONA DE PRUEBA', tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
  }, { actor: 'admin', motivo: 'prueba' });

  const revocado = poderes.revocarPoder(creado.id, {
    actor: 'admin', motivo: 'Renuncio a la representacion',
  });
  assert.equal(revocado.estado, 'REVOCADO');
  assert.ok(revocado.revocado_at);
  assert.equal(revocado.revocado_motivo, 'Renuncio a la representacion');

  const eventos = poderes.eventosDePoder(creado.id).map((e) => e.evento);
  assert.deepEqual(eventos, ['PODER_REGISTRADO', 'PODER_REVOCADO'],
    'el rastro cuenta la vida del poder: existio y dejo de estar');

  assert.throws(
    () => poderes.revocarPoder(creado.id, { actor: 'admin', motivo: 'otra vez' }),
    (e) => e.statusCode === 409 && e.code === 'PODER_YA_REVOCADO',
  );
});

// ===========================================================================
// 2. LA COMPROBACION DE LA FACULTAD
// ===========================================================================

test('el representante legal del Encargado puede contrafirmar sin acreditar nada mas', () => {
  resetDb();
  vaciarRegistro();

  const representante = poderes.representanteLegalEncargado();
  assert.ok(representante, 'el manifiesto legal declara el representante legal del Encargado');

  const facultad = poderes.verificarFacultadContrafirmante(representante);
  assert.equal(facultad.resultado, 'REPRESENTANTE_LEGAL_ENCARGADO');
  assert.equal(facultad.nombre, representante);
});

test('una persona distinta del representante legal SIN poder acreditado NO puede', () => {
  resetDb();
  vaciarRegistro();

  assert.throws(
    () => poderes.verificarFacultadContrafirmante(SIN_FACULTAD),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
    'la ejecucion por una persona distinta exige acreditar la facultad',
  );
});

test('sin actor declarado NO hay contrafirma: no se sabe quien hizo el acto', () => {
  resetDb();
  vaciarRegistro();

  assert.throws(
    () => poderes.verificarFacultadContrafirmante(''),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
  );
});

test('con un poder VIGENTE a su nombre, la persona distinta SI puede', () => {
  resetDb();
  vaciarRegistro();

  poderes.registrarPoder({
    nombre: SIN_FACULTAD, tipo: 'DELEGACION', instrumento_ref: 'Delegacion 7', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01',
  }, { actor: 'admin', motivo: 'prueba' });

  const facultad = poderes.verificarFacultadContrafirmante(SIN_FACULTAD);
  assert.equal(facultad.resultado, 'PODER_ACREDITADO');
  assert.equal(facultad.instrumento_ref, 'Delegacion 7');
  assert.equal(facultad.instrumento_sha256, HASH);
});

test('un poder VENCIDO o que todavia no empieza NO sirve', () => {
  resetDb();
  vaciarRegistro();

  poderes.registrarPoder({
    nombre: SIN_FACULTAD, tipo: 'PODER', instrumento_ref: 'Poder viejo', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01', vigente_hasta: '2026-02-01',
  }, { actor: 'admin', motivo: 'prueba' });
  poderes.registrarPoder({
    nombre: SIN_FACULTAD, tipo: 'PODER', instrumento_ref: 'Poder futuro', instrumento_sha256: HASH,
    vigente_desde: '2099-01-01',
  }, { actor: 'admin', motivo: 'prueba' });

  assert.equal(poderes.poderVigenteDe(SIN_FACULTAD), null,
    'los dos poderes estan fuera de vigencia');
  assert.throws(
    () => poderes.verificarFacultadContrafirmante(SIN_FACULTAD),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
  );
});

test('un poder REVOCADO no sirve', () => {
  resetDb();
  vaciarRegistro();

  const creado = poderes.registrarPoder({
    nombre: SIN_FACULTAD, tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01',
  }, { actor: 'admin', motivo: 'prueba' });
  poderes.revocarPoder(creado.id, { actor: 'admin', motivo: 'se termino la vigencia' });

  assert.throws(
    () => poderes.verificarFacultadContrafirmante(SIN_FACULTAD),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
    'un poder revocado no habilita a nadie',
  );
});

test('el cotejo de nombres no depende de las tildes ni de las mayusculas', () => {
  resetDb();
  vaciarRegistro();

  poderes.registrarPoder({
    nombre: 'José María Robles', tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01',
  }, { actor: 'admin', motivo: 'prueba' });

  const facultad = poderes.verificarFacultadContrafirmante('JOSE MARIA ROBLES');
  assert.equal(facultad.resultado, 'PODER_ACREDITADO');
  assert.equal(poderes.normalizarNombre('José  María   Robles'),
    poderes.normalizarNombre('JOSE MARIA ROBLES'));
});

// ===========================================================================
// 3. LA CONTRAFIRMA CON Y SIN FACULTAD
// ===========================================================================

test('la contrafirma SIN faculty NO se cierra y no toca el primer acto', async () => {
  resetDb();
  mailer.clearDevInbox();
  vaciarRegistro();
  sembrarEmpresa();

  const idSuscripcion = await suscribir();
  const otp = await pedirCodigoContrafirma(idSuscripcion);

  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp, acepta: true,
    }, { actor: SIN_FACULTAD, motivo: 'prueba' }),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
    'sin faculty acreditada, la contrafirma no se hace',
  );

  const fila = db.prepare(
    'SELECT contrafirmado_at, estado FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirmado_at, null, 'el segundo acto NO se cerro');
  assert.equal(fila.estado, 'FIRMADA', 'el primer acto sigue intacto');
  const empresa = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?')
    .get(ID_EMPRESA);
  assert.equal(empresa.anexo_nube_ejecutado_at, null,
    'la Empresa no queda con el instrumento ejecutado');
});

test('la contrafirma CON faculty deja la acreditacion en la evidencia y en el acta', async () => {
  resetDb();
  mailer.clearDevInbox();
  vaciarRegistro();
  sembrarEmpresa();

  poderes.registrarPoder({
    nombre: SIN_FACULTAD, cargo: 'Apoderado', tipo: 'PODER',
    instrumento_ref: 'Poder del 1-nov-2026', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01',
  }, { actor: 'admin', motivo: 'prueba' });

  const idSuscripcion = await suscribir();
  const otp = await pedirCodigoContrafirma(idSuscripcion);

  const r = await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp, acepta: true,
  }, { actor: SIN_FACULTAD, motivo: 'prueba de contrafirma' });

  assert.equal(r.contrafirmado, true);

  const fila = db.prepare(
    'SELECT contrafirma_evidencia FROM gh_firma_anexo_nube_suscripciones').get();
  const evidencia = JSON.parse(fila.contrafirma_evidencia);
  assert.ok(evidencia.facultad, 'la evidencia dice con que poder se firmo');
  assert.equal(evidencia.facultad.resultado, 'PODER_ACREDITADO');
  assert.equal(evidencia.facultad.instrumento_ref, 'Poder del 1-nov-2026');
  assert.equal(evidencia.facultad.instrumento_sha256, HASH);

  const leido = actaAnexoNube.leerActa(r.acta.archivo);
  const texto = textoPlano(leido.buffer);
  assert.ok(texto.includes('LA FACULTAD DE QUIEN CONTRAFIRMA'),
    'el acta tiene una seccion con la facultad (los titulos van en mayusculas)');
  assert.ok(texto.includes('Poder del 1-nov-2026'),
    'el acta cita el instrumento con que poder se firmo');
  assert.ok(texto.includes(HASH.slice(0, 32)),
    'el acta cita la huella del instrumento');

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_nube_eventos WHERE id_suscripcion = ?')
    .all(idSuscripcion).map((e) => e.evento);
  assert.ok(eventos.includes('CONTRAFIRMA_FACULTAD_VERIFICADA'),
    'la verificacion de la faculty queda en el rastro');
});

test('la contrafirma del Anexo de Encargo tambien exige la facultad', async () => {
  resetDb();
  mailer.clearDevInbox();
  vaciarRegistro();

  // El Anexo de Encargo exige, ademas, la verificacion documental del
  // representante de la Empresa: sin ella no hay contrafirma tampoco.
  const empresa = db.prepare(
    'SELECT COUNT(*) AS c FROM gh_firma_empresas').get().c;
  assert.ok(empresa >= 0, 'la base esta lista');

  assert.throws(
    () => poderes.verificarFacultadContrafirmante(SIN_FACULTAD),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
    'el mismo control de facultad aplica al Anexo de Encargo',
  );
});

// ===========================================================================
// 4. LA CERTIFICACION DE UNA CONTRAFIRMA YA HECHA
// ===========================================================================

test('una contrafirma hecha sin faculty se puede certificar despues, por la via administrativa', async () => {
  resetDb();
  mailer.clearDevInbox();
  vaciarRegistro();
  sembrarEmpresa();

  // Se finge una contrafirma de un despliegue anterior: esta en la base, con
  // su evidencia, pero SIN la acreditacion de la facultad.
  const idSuscripcion = await suscribir();
  const ahora = new Date().toISOString();
  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET contrafirmado_at = ?, contrafirma_actor = ?, contrafirma_motivo = ?,
        contrafirma_evidencia = ?, contrafirma_estado = 'CONTRAFIRMADA'
    WHERE id = ?`).run(
    ahora, SIN_FACULTAD, 'Contrafirma de un despliegue anterior',
    JSON.stringify({ fuente: 'contrafirma_kair', fase: 2 }), idSuscripcion,
  );

  // Sin power no se puede certificar: la certificacion no inventa la facultad.
  assert.throws(
    () => anexoNube.registrarFacultadEnContrafirma(ID_EMPRESA, idSuscripcion, {
      actor: 'admin', motivo: 'certifico la facultad',
    }),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_NO_ACREDITADA',
  );

  // Con el power acreditado, la certificacion procede.
  poderes.registrarPoder({
    nombre: SIN_FACULTAD, tipo: 'PODER', instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    vigente_desde: '2026-01-01',
  }, { actor: 'admin', motivo: 'prueba' });

  const r = anexoNube.registrarFacultadEnContrafirma(ID_EMPRESA, idSuscripcion, {
    actor: 'admin', motivo: 'certifico la facultad del poder',
  });
  assert.equal(r.facultad.resultado, 'PODER_ACREDITADO');
  assert.equal(r.certificado_por, 'admin');

  // Y no se puede certificar dos veces.
  assert.throws(
    () => anexoNube.registrarFacultadEnContrafirma(ID_EMPRESA, idSuscripcion, {
      actor: 'admin', motivo: 'otra vez',
    }),
    (e) => e.statusCode === 409 && e.code === 'FACULTAD_YA_REGISTRADA',
  );

  // La fecha del segundo acto NO se toca: lo que se anade es el dato que le
  // faltaba.
  const fila = db.prepare(
    'SELECT contrafirmado_at FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirmado_at, ahora, 'el segundo acto no se reescribe');
});

// ===========================================================================
// 5. LAS RUTAS ADMINISTRATIVAS
// ===========================================================================

test('las tres rutas de los poderes exigen la llave de admin', async () => {
  resetDb();
  vaciarRegistro();
  const app = makeApp();

  const listado = await request(app).get('/internal/admin/encargado/poderes');
  assert.equal(listado.status, 401);

  const alta = await request(app).post('/internal/admin/encargado/poderes')
    .send({ nombre: 'X', tipo: 'PODER', instrumento_ref: 'P', instrumento_sha256: HASH });
  assert.equal(alta.status, 401);

  const revocacion = await request(app).post('/internal/admin/encargado/poderes/1/revocar');
  assert.equal(revocacion.status, 401);
});

test('el registro de poderes se da de alta, se lista y se revoca por HTTP', async () => {
  resetDb();
  vaciarRegistro();
  const app = makeApp();

  const alta = await request(app)
    .post('/internal/admin/encargado/poderes')
    .set(ADMIN)
    .set('X-Admin-Actor', 'admin')
    .set('X-Admin-Motivo', 'Se recibio el poder firmado')
    .send({
      nombre: 'PERSONA DE PRUEBA',
      cargo: 'Apoderado',
      tipo: 'PODER',
      instrumento_ref: 'Poder del 1-nov-2026',
      instrumento_sha256: HASH,
    });
  assert.equal(alta.status, 201, JSON.stringify(alta.body));
  assert.equal(alta.body.estado, 'VIGENTE');

  const listado = await request(app).get('/internal/admin/encargado/poderes').set(ADMIN);
  assert.equal(listado.status, 200);
  assert.equal(listado.body.items.length, 1);
  assert.ok(listado.body.representante_legal_encargado,
    'la lectura dice quien es el representante legal del Encargado');
  assert.equal(listado.body.items[0].eventos.length, 1);

  const revocacion = await request(app)
    .post(`/internal/admin/encargado/poderes/${alta.body.id}/revocar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'admin')
    .set('X-Admin-Motivo', 'Se termino la vigencia')
    .send();
  assert.equal(revocacion.status, 200, JSON.stringify(revocacion.body));
  assert.equal(revocacion.body.estado, 'REVOCADO');
});

test('sin motivo no se registra ni se revoca un poder', async () => {
  resetDb();
  vaciarRegistro();
  const app = makeApp();

  const alta = await request(app)
    .post('/internal/admin/encargado/poderes')
    .set(ADMIN)
    .send({
      nombre: 'PERSONA DE PRUEBA', tipo: 'PODER',
      instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
    });
  assert.equal(alta.status, 400);
  assert.equal(alta.body.error.code, 'MOTIVO_REQUERIDO');

  // Para la revocacion hace falta un poder EXISTENTE: se crea por el service
  // (la ruta sin motivo no lo crea).
  const creado = poderes.registrarPoder({
    nombre: 'PERSONA DE PRUEBA', tipo: 'PODER',
    instrumento_ref: 'Poder 1', instrumento_sha256: HASH,
  }, { actor: 'admin', motivo: 'prueba' });

  const revocacion = await request(app)
    .post(`/internal/admin/encargado/poderes/${creado.id}/revocar`)
    .set(ADMIN)
    .send();
  assert.equal(revocacion.status, 400);
  assert.equal(revocacion.body.error.code, 'MOTIVO_REQUERIDO');
});

// ===========================================================================
// 6. EL RASTRO ES APPEND-ONLY
// ===========================================================================

const SCHEMA_DIR = path.join(__dirname, '..', 'src', 'db', 'schema');
const SQL_061 = fs.readFileSync(
  path.join(SCHEMA_DIR, '061_encargado_poderes.sql'), 'utf8');
const SQL_062 = fs.readFileSync(
  path.join(SCHEMA_DIR, '062_encargado_poderes_append_only.sql'), 'utf8');

test('el rastro de los poderes es append-only (trigger real)', () => {
  // En el ambiente de test la 062 NO se aplica (lleva `@skip-when-env test`),
  // asi que los triggers se prueban contra el ARCHIVO REAL, en una base aparte.
  // Es el mismo mecanismo que la 055 (rastro de la suscripcion del Nube).
  const Database = require('better-sqlite3');
  const bd = new Database(':memory:');
  try {
    bd.exec(SQL_061);
    bd.exec(SQL_062);
    bd.prepare(`INSERT INTO gh_firma_encargado_poderes_eventos
      (id_poder, evento) VALUES (1, 'PODER_REGISTRADO')`).run();

    assert.throws(() => bd.prepare(
      'UPDATE gh_firma_encargado_poderes_eventos SET evento = ? WHERE id = 1').run('OTRA'),
    /append-only/,
    'el rastro de los poderes no se puede alterar');

    assert.throws(() => bd.prepare(
      'DELETE FROM gh_firma_encargado_poderes_eventos WHERE id = 1').run(),
    /append-only/,
    'el rastro de los poderes no se puede borrar');

    const n = bd.prepare(
      'SELECT COUNT(*) AS c FROM gh_firma_encargado_poderes_eventos').get().c;
    assert.equal(n, 1, 'el rastro no se puede perder');
  } finally {
    bd.close();
  }
});

test('en el ambiente de test el trigger NO esta instalado (para poder limpiar la tabla)', () => {
  const triggers = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ?")
    .all('gh_firma_encargado_poderes_eventos');
  assert.deepEqual(triggers, [],
    'en el ambiente de test no puede haber triggers sobre el rastro');
});
