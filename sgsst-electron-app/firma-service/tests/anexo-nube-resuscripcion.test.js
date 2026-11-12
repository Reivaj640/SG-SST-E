/**
 * LA RE-SUSCRIPCIÓN DEL ANEXO DE NUBE POR EL CANAL ADMINISTRATIVO
 * ============================================================================
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * El Anexo de Nube también se versiona: cuando el texto vigente cambia, la
 * Empresa tiene que suscribir DE NUEVO, porque la suscripción anterior
 * describe un texto que ya no rige. `services/anexoNube.js` lo dice con todas
 * las letras: si la ficha tiene `anexo_nube_firmado_at` y su huella es
 * DISTINTA de la del texto que la Empresa está suscribiendo, la suscripción
 * pública se rechaza con 409 SUSCRIPCION_EXISTENTE y avisa de que "la
 * corrección se registra por el canal administrativo, con su motivo".
 *
 * Ese canal administrativo NO existía por HTTP para el Anexo de Nube (para el
 * Anexo de Encargo sí: `anexo-suscrito/quitar`, del 11-nov-2026). El resultado
 * era un callejón sin salida: una Empresa suscrita no podía volver a
 * suscribir el texto vigente, y la única salida era la PREMARCA
 * (`anexo-nube-firmado`), que escribe una fecha de suscripción ANTES de que la
 * suscripción exista — un registro falso en la ficha y un conteo falso en el
 * gate.
 *
 * Y lo mismo con la fase 2: `anexo_nube_ejecutado_at` (la contrafirma de
 * K+AIR) NO se valida contra el texto vigente, así que sin una ruta de baja el
 * operador sigue viendo "ejecutado" un instrumento que ya no existe.
 *
 * Lo que estos tests fijan:
 *
 * - La ruta exige la admin key (401 sin ella).
 * - La ruta exige `X-Admin-Motivo` (400 MOTIVO_REQUERIDO): es un acto que
 *   deshace un registro jurídico de la ficha.
 * - La ruta de la fase 1 pone en NULL los CUATRO campos de la suscripción y NO
 *   toca la fecha de ejecución (que es el SEGUNDO acto, otra ruta y otro
 *   motivo).
 * - La ruta de la fase 2 pone en NULL la fecha de ejecución y NO toca la
 *   suscripción.
 * - Todo queda en el historial append-only, con el actor y el motivo.
 * - Y lo que de verdad importa: con una suscripción ANTERIOR de otro texto, la
 *   vía pública da 409; después del desmarque administrativo, la Empresa
 *   suscribe el texto vigente. Sin estas rutas, ese camino no existe.
 * - La suscripción anterior NO se reescribe: su fila queda FIRMADA, con su
 *   huella y su evidencia. Lo que se deshace es el puntero de la ficha, no el
 *   hecho.
 *
 * Todos los datos son sintéticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const anexoNube = require('../src/services/anexoNube');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('./helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ID_EMPRESA = '900666888';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const MOTIVO = 'Re-suscripción del texto vigente tras la errata del 11-nov-2026';

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(id = ID_EMPRESA) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, 'EMPRESA DE PRUEBA SAS', '900666888-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-prueba.test',
    'datos@empresa-prueba.test', 'PERSONA DE PRUEBA');
  return id;
}

/** El último código de verificación que salió en la bandeja de pruebas. */
function ultimoCodigo() {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === 'anexo_nube') {
      assert.match(inbox[i].otp, /^\d{6}$/);
      return inbox[i].otp;
    }
  }
  assert.fail('tiene que haber salido un correo con el código de verificación');
  return null;
}

/**
 * Siembra una suscripción ANTERIOR, de OTRO texto, ya FIRMADA.
 *
 * Es el caso real: la Empresa suscribió la v1.1 y hoy el texto vigente es la
 * v1.3. La fila queda con su huella y su evidencia: no se toca.
 */
function sembrarSuscripcionAnterior() {
  const info = db.prepare(`
    INSERT INTO gh_firma_anexo_nube_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       nombre_firmante, cargo_firmante, estado, expira_enlace_at,
       firmado_at, evidencia, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'FIRMADA', ?, ?, ?, 'admin')
  `).run(
    ID_EMPRESA,
    `token-hash-anterior-${Date.now()}`,
    '1.1',
    'b'.repeat(64),
    CORREO_FIRMANTE,
    'PERSONA DE PRUEBA',
    'Representante legal',
    '2026-11-10T10:00:00.000Z',
    '2026-11-05T22:51:34.349Z',
    JSON.stringify({ fuente: 'enlace_suscripcion', version: '1.1' }),
  );
  return info.lastInsertRowid;
}

/** Pone en la ficha la suscripción anterior (fase 1), como los deja el servicio. */
function sembrarFichaSuscrita() {
  empresaService.marcarAnexoNubeFirmado(ID_EMPRESA, {
    fecha: '2026-11-05T22:51:34.349Z',
    version: '1.1',
    hash: 'b'.repeat(64),
    evidencia: 'Evidencia de la suscripción anterior.',
  }, { actor: 'empresa:' + ID_EMPRESA, motivo: 'Prueba' });
}

/**
 * Pone en la ficha la fecha de EJECUCIÓN (fase 2).
 *
 * La escribe el servicio al contrafirmar; acá se pone directo porque la
 * contrafirma exige un acta y un código, y lo que se prueba es la ruta de
 * baja, no la contrafirma.
 */
function sembrarFichaEjecutada() {
  db.prepare(`
    UPDATE gh_firma_empresas
    SET anexo_nube_ejecutado_at = '2026-11-06T20:33:22.748Z'
    WHERE id_empresa = ?
  `).run(ID_EMPRESA);
}

/** Abre la suscripción del texto vigente y pide el código. */
async function abrirSuscripcionVigente() {
  const r = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'PERSONA DE PRUEBA',
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin' });
  await anexoNube.solicitarCodigo(r.token, {});
  return r;
}

function limpiar() {
  resetDb();
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* no existe */ }
  mailer.clearDevInbox();
}

// ===========================================================================
// LA RUTA DE LA FASE 1: anexo-nube-suscrito/quitar
// ===========================================================================

test('sin la admin key, quitar la suscripción del Anexo de Nube no hace nada', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaSuscrita();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('quitar la suscripción del Anexo de Nube exige motivo', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaSuscrita();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'MOTIVO_REQUERIDO');

  // Y nada se movió.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at,
    'sin motivo no se toca la suscripción de la ficha');
});

test('una empresa sin suscripción de Anexo de Nube no tiene nada que quitar', async () => {
  limpiar();
  sembrarEmpresa();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Prueba: la empresa no tiene suscripción registrada')
    .timeout({ response: 3000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ANEXO_NO_REGISTRADO');
});

test('quitar la suscripción del Anexo de Nube pone en NULL los cuatro campos y NO toca la ejecución', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaSuscrita();
  sembrarFichaEjecutada();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_nube_firmado_at, null);
  assert.equal(res.body.anexo_nube_version, null);
  assert.equal(res.body.anexo_nube_hash, null);
  assert.equal(res.body.anexo_nube_evidencia, null);

  // La fecha de EJECUCIÓN es el SEGUNDO acto: otra ruta, otro motivo.
  const empresa = empresaService.getById(ID_EMPRESA);
  const ejecutada = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?',
  ).get(ID_EMPRESA);
  assert.ok(ejecutada.anexo_nube_ejecutado_at,
    'quitar la suscripción NO puede tocar la fecha de ejecución: es otro acto');
});

test('el desmarque de la suscripción del Anexo de Nube queda en el historial append-only', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaSuscrita();

  await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });

  const historial = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/historial`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  const campos = ['anexo_nube_firmado_at', 'anexo_nube_version',
    'anexo_nube_hash', 'anexo_nube_evidencia'];
  for (const campo of campos) {
    const fila = historial.body.items.find(
      (i) => i.campo === campo && i.valor_nuevo === null,
    );
    assert.ok(fila, 'el desmarque de ' + campo + ' queda en el historial');
    assert.equal(fila.id_actor, 'Operador de prueba');
    assert.match(String(fila.motivo), /Re-suscripción/);
  }
});

// ===========================================================================
// LA RUTA DE LA FASE 2: anexo-nube-ejecutado/quitar
// ===========================================================================

test('sin la admin key, quitar la ejecución del Anexo de Nube no hace nada', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaEjecutada();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('quitar la ejecución del Anexo de Nube exige motivo', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaEjecutada();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'MOTIVO_REQUERIDO');

  const fila = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?',
  ).get(ID_EMPRESA);
  assert.ok(fila.anexo_nube_ejecutado_at,
    'sin motivo no se toca la fecha de ejecución de la ficha');
});

test('una empresa sin ejecución del Anexo de Nube no tiene nada que quitar', async () => {
  limpiar();
  sembrarEmpresa();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Prueba: la empresa no tiene ejecución registrada')
    .timeout({ response: 3000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ANEXO_NO_REGISTRADO');
});

test('quitar la ejecución del Anexo de Nube borra esa fecha y NO toca la suscripción', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaSuscrita();
  sembrarFichaEjecutada();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);

  const fila = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?',
  ).get(ID_EMPRESA);
  assert.equal(fila.anexo_nube_ejecutado_at, null);

  // La fase 1 sigue intacta: es otra ruta y otro motivo.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at,
    'quitar la ejecución NO puede tocar la suscripción: es otro acto');
});

test('el desmarque de la ejecución del Anexo de Nube queda en el historial append-only', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaEjecutada();

  await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });

  const historial = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/historial`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  const fila = historial.body.items.find(
    (i) => i.campo === 'anexo_nube_ejecutado_at' && i.valor_nuevo === null,
  );
  assert.ok(fila, 'el desmarque de la ejecución queda en el historial');
  assert.equal(fila.id_actor, 'Operador de prueba');
  assert.match(String(fila.motivo), /Re-suscripción/);
});

// ===========================================================================
// EL EFECTO: LA RE-SUSCRIPCIÓN YA ES POSIBLE
// ===========================================================================

test('con una suscripción anterior de otro texto, la vía pública da 409', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarSuscripcionAnterior();
  sembrarFichaSuscrita();

  const r = await abrirSuscripcionVigente();

  // `suscribir` es SINCRONO en el Anexo de Nube (a diferencia del de Encargo):
  // el error sale lanzado, no como promesa rechazada.
  assert.throws(
    () => anexoNube.suscribir(r.token, {
      otp: ultimoCodigo(),
      acepta: true,
    }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' }),
    (e) => {
      assert.equal(e.statusCode, 409);
      assert.equal(e.code, 'SUSCRIPCION_EXISTENTE');
      return true;
    },
  );
});

test('después del desmarque administrativo, la Empresa suscribe el texto vigente', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarSuscripcionAnterior();
  sembrarFichaSuscrita();
  // El caso completo: la Empresa suscribió Y K+AIR contrafirmó el texto
  // anterior. Para re-suscribir hay que deshacer las DOS fases.
  sembrarFichaEjecutada();

  const app = makeApp();
  const r = await abrirSuscripcionVigente();

  // El primer intento choca con la suscripción anterior.
  assert.throws(
    () => anexoNube.suscribir(r.token, {
      otp: ultimoCodigo(),
      acepta: true,
    }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' }),
    (e) => e.code === 'SUSCRIPCION_EXISTENTE',
  );

  // El canal administrativo: primero la fase 2, después la fase 1.
  const fase2 = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-ejecutado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });
  assert.equal(fase2.status, 200);

  const fase1 = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });
  assert.equal(fase1.status, 200);

  // Y ahora sí: el MISMO enlace y el MISMO código sirven.
  const res = anexoNube.suscribir(r.token, {
    otp: ultimoCodigo(),
    acepta: true,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  assert.equal(res.firmado, true);
  assert.equal(res.version, anexoNube.modeloVigente().version);
  assert.equal(res.hash, anexoNube.modeloVigente().hash);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at);
  assert.equal(empresa.anexo_nube_hash, anexoNube.modeloVigente().hash);
});

test('la suscripción anterior NO se reescribe: su fila queda FIRMADA con su huella', async () => {
  limpiar();
  sembrarEmpresa();
  const idAnterior = sembrarSuscripcionAnterior();
  sembrarFichaSuscrita();

  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', MOTIVO)
    .timeout({ response: 3000 });

  const fila = db.prepare(
    'SELECT * FROM gh_firma_anexo_nube_suscripciones WHERE id = ?',
  ).get(idAnterior);

  assert.ok(fila, 'la fila anterior sigue ahí');
  assert.equal(fila.estado, 'FIRMADA',
    'lo que se deshace es el puntero de la ficha, no el hecho');
  assert.equal(fila.version, '1.1');
  assert.equal(fila.hash_texto, 'b'.repeat(64));
});
