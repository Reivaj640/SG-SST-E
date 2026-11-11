/**
 * LA RE-SUSCRIPCIÓN DEL ANEXO DE ENCARGO POR EL CANAL ADMINISTRATIVO
 * ============================================================================
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * El Anexo de Encargo se versiona POR FECHA: cuando el texto vigente cambia, la
 * Empresa tiene que suscribir DE NUEVO, porque la suscripción anterior describe
 * un texto que ya no rige. `services/anexoEncargo.js` lo dice con todas las
 * letras: si la Empresa ya tiene un Anexo (suscrito o firmado) y la suscripción
 * nueva es de OTRO texto, la suscripción pública se rechaza con 409
 * SUSCRIPCION_EXISTENTE y avisa de que "la corrección se registra por el canal
 * administrativo, con su motivo".
 *
 * Ese canal administrativo NO existía por HTTP. La función que deshace la
 * fase 1 (`empresaService.desmarcarAnexoSuscrito`) estaba escrita, probada y
 * exportada desde hacia rato, pero NINGUNA ruta la llamaba: la ruta de la fase
 * 2 (`anexo-firmado/quitar`) sí, la de la fase 1 no. El resultado era un
 * callejón sin salida: el Anexo de Encargo no se podía re-suscribir, y el
 * manifiesto (bloque `anexo_encargo.nota`) prometía una vía que el API no tenía.
 *
 * Lo que estos tests fijan:
 *
 * - La ruta exige la admin key (401 sin ella).
 * - La ruta exige `X-Admin-Motivo` (400 MOTIVO_REQUERIDO): es un acto que
 *   deshace un registro jurídico de la ficha.
 * - La ruta pone en NULL los CUATRO campos de la fase 1 y NO toca la fecha de
 *   firma (que es el SEGUNDO acto, otra ruta y otro motivo).
 * - Todo queda en el historial append-only, con el actor y el motivo.
 * - Y lo que de verdad importa: con una suscripción ANTERIOR de otro texto, la
 *   vía pública da 409; después del desmarque administrativo, la Empresa
 *   suscribe el texto vigente. Sin esta ruta, ese camino no existe.
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
const anexoEncargo = require('../src/services/anexoEncargo');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const {
  resetDb, makeApp, TEST_ADMIN_API_KEY,
} = require('./helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const CANAL_CODIGO = 'segundo-canal@empresa-prueba.test';
const CONFIRMACION_CANAL = 'Confirmado por llamada de prueba';
const REPRESENTANTE = { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' };
const DATOS_S11 = {
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900555777-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: CORREO_FIRMANTE,
  representante: 'PERSONA DE PRUEBA',
};

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(id = ID_EMPRESA) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, 'EMPRESA DE PRUEBA SAS', '900555777-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-prueba.test',
    'datos@empresa-prueba.test', 'PERSONA DE PRUEBA');
  return id;
}

/** El último código de verificación que salió en la bandeja de pruebas. */
function ultimoCodigo() {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === 'anexo_encargo') {
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
 * Es el caso real: la Empresa suscribió el 2026-11-06 y hoy el texto vigente
 * es el 2026-11-11. La fila queda con su huella y su evidencia: no se toca.
 */
function sembrarSuscripcionAnterior() {
  const info = db.prepare(`
    INSERT INTO gh_firma_anexo_encargo_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       nombre_firmante, cargo_firmante, estado, expira_enlace_at,
       canal_codigo, firmado_at, evidencia, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'FIRMADA', ?, ?, ?, ?, 'admin')
  `).run(
    ID_EMPRESA,
    `token-hash-anterior-${Date.now()}`,
    '2026-11-06',
    'b'.repeat(64),
    CORREO_FIRMANTE,
    'PERSONA DE PRUEBA',
    'Representante legal',
    '2026-11-10T10:00:00.000Z',
    CANAL_CODIGO,
    '2026-11-07T19:30:14.503Z',
    JSON.stringify({ fuente: 'enlace_suscripcion', version: '2026-11-06' }),
  );
  return info.lastInsertRowid;
}

/** Pone en la ficha los registros de las dos fases, como los deja el servicio. */
function sembrarFichaConAnexos() {
  empresaService.marcarAnexoSuscrito(ID_EMPRESA, {
    fecha: '2026-11-07T19:30:14.503Z',
    version: '2026-11-06',
    hash: 'b'.repeat(64),
    evidencia: 'Evidencia de la suscripción anterior.',
  }, { actor: 'empresa:' + ID_EMPRESA, motivo: 'Prueba' });

  empresaService.marcarAnexoFirmado(ID_EMPRESA, '2026-11-07T20:33:22.748Z', {
    actor: 'kair:contrafirma', motivo: 'Prueba',
  });
}

/** Abre la suscripción del texto vigente y pide el código. */
async function abrirSuspensionVigente() {
  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
    nombre_firmante: 'PERSONA DE PRUEBA',
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});
  return r;
}

function limpiar() {
  resetDb();
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* no existe */ }
  mailer.clearDevInbox();
}

// ===========================================================================
// LA RUTA
// ===========================================================================

test('sin la admin key, quitar la suscripción no hace nada', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaConAnexos();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'INVALID_API_KEY');
});

test('quitar la suscripción exige motivo', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaConAnexos();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'MOTIVO_REQUERIDO');

  // Y nada se movió.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at,
    'sin motivo no se toca la suscripción de la ficha');
});

test('una empresa sin suscripción registrada no tiene nada que quitar', async () => {
  limpiar();
  sembrarEmpresa();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Prueba: la empresa no tiene suscripción registrada')
    .timeout({ response: 3000 });

  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'ANEXO_NO_REGISTRADO');
});

test('quitar la suscripción pone en NULL los cuatro campos de la fase 1 y NO toca la fecha de firma', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaConAnexos();

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente tras la errata del 11-nov-2026')
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.anexo_encargo_suscrito_at, null);
  assert.equal(res.body.anexo_encargo_suscrito_version, null);
  assert.equal(res.body.anexo_encargo_suscrito_hash, null);
  assert.equal(res.body.anexo_encargo_suscrito_evidencia, null);

  // La fecha de firma es el SEGUNDO acto: otra ruta, otro motivo.
  assert.ok(res.body.anexo_encargo_firmado_at,
    'quitar la suscripción NO puede tocar la fecha de firma: es otro acto');
});

test('el desmarque queda en el historial append-only, con el actor y el motivo', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarFichaConAnexos();

  await request(makeApp())
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente tras la errata')
    .timeout({ response: 3000 });

  const historial = await request(makeApp())
    .get(`/internal/admin/empresas/${ID_EMPRESA}/historial`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  const campos = ['anexo_encargo_suscrito_at', 'anexo_encargo_suscrito_version',
    'anexo_encargo_suscrito_hash', 'anexo_encargo_suscrito_evidencia'];
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
// EL EFECTO: LA RE-SUSCRIPCIÓN YA ES POSIBLE
// ===========================================================================

test('con una suscripción anterior de otro texto, la vía pública da 409', async () => {
  limpiar();
  sembrarEmpresa();
  sembrarSuscripcionAnterior();
  sembrarFichaConAnexos();

  const r = await abrirSuspensionVigente();

  await assert.rejects(
    () => anexoEncargo.suscribir(r.token, {
      otp: ultimoCodigo(),
      acepta: true,
      acepta_tratamiento: true,
      datos_empresa: DATOS_S11,
      representante: REPRESENTANTE,
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
  sembrarFichaConAnexos();

  const app = makeApp();
  const r = await abrirSuspensionVigente();

  // El primer intento choca con la suscripción anterior.
  await assert.rejects(
    () => anexoEncargo.suscribir(r.token, {
      otp: ultimoCodigo(),
      acepta: true,
      acepta_tratamiento: true,
      datos_empresa: DATOS_S11,
      representante: REPRESENTANTE,
    }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' }),
    (e) => e.code === 'SUSCRIPCION_EXISTENTE',
  );

  // El canal administrativo: primero la fase 2, después la fase 1.
  const fase2 = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-firmado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente tras la errata del 11-nov-2026')
    .timeout({ response: 3000 });
  assert.equal(fase2.status, 200);

  const fase1 = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'Operador de prueba')
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente tras la errata del 11-nov-2026')
    .timeout({ response: 3000 });
  assert.equal(fase1.status, 200);

  // Y ahora sí: el MISMO enlace y el MISMO código sirven.
  const res = await anexoEncargo.suscribir(r.token, {
    otp: ultimoCodigo(),
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: REPRESENTANTE,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  assert.equal(res.firmado, true);
  assert.equal(res.version, anexoEncargo.modeloVigente().version);
  assert.equal(res.hash, anexoEncargo.modeloVigente().hash);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at);
  assert.equal(empresa.anexo_encargo_suscrito_hash, anexoEncargo.modeloVigente().hash);
});

test('la suscripción anterior NO se reescribe: su fila queda FIRMADA con su huella', async () => {
  limpiar();
  sembrarEmpresa();
  const idAnterior = sembrarSuscripcionAnterior();
  sembrarFichaConAnexos();

  const app = makeApp();
  await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-firmado/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente')
    .timeout({ response: 3000 });
  await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-suscrito/quitar`)
    .set(ADMIN)
    .set('X-Admin-Motivo', 'Re-suscripción del texto vigente')
    .timeout({ response: 3000 });

  const fila = db.prepare(
    'SELECT * FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?',
  ).get(idAnterior);

  assert.ok(fila, 'la fila anterior sigue ahí');
  assert.equal(fila.estado, 'FIRMADA',
    'lo que se deshace es el puntero de la ficha, no el hecho');
  assert.equal(fila.version, '2026-11-06');
  assert.equal(fila.hash_texto, 'b'.repeat(64));
});
