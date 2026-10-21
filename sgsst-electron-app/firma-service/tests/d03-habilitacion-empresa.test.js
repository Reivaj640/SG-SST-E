/**
 * D-03: la Empresa tiene que estar habilitada para pedir firmas.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * El 1.4 del Acuerdo hace depender de un **Anexo de Encargo firmado** la
 * relación entre la Empresa (Responsable) y K+AIR (Encargado), y el 8.6
 * obliga a la Empresa a comunicar el **plazo de conservación** antes de
 * pedirle la firma al Trabajador.
 *
 * Antes de D-03, el sistema dejaba pedir firmas de empresas que no tenían
 * ninguna de las dos cosas: se firmaba apoyándose en promesas que el
 * sistema no podía cumplir (el 10.6 sin fecha, el 12.7 conservando la
 * prueba de una autorización sin encargo detrás).
 *
 * Lo que se comprueba aquí:
 *   1. Sin Anexo firmado: la solicitud NO se crea (409 explicable).
 *   2. Sin plazo declarado: la solicitud NO se crea (409 explicable).
 *   3. Con las dos cosas: la solicitud se crea.
 *   4. El mensaje dice QUÉ falta y DÓNDE se resuelve.
 *   5. La transición: con la bandera apagada, la firma pasa pero queda un
 *      WARN con código (no hay default silencioso).
 *   6. Una empresa NO registrada no se bloquea (es otro problema).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/connection');
const config = require('../src/config');
const empresaService = require('../src/services/empresa');
const {
  resetDb, seedActiveAgreement, createSignRequestWithIdentificacion, capturarLogs,
} = require('./helpers');

const EMPRESA = '900123456';

const DATOS_EMPRESA = {
  id_empresa: EMPRESA,
  razon_social: 'Empresa de Prueba S.A.S.',
  nit: '900123456',
  domicilio: 'Bogota D.C.',
  responsable_tratamiento: 'Responsable de Prueba',
  responsable_tratamiento_correo: 'privacidad@example.com',
  canal_pqrs: 'pqrs@example.com',
  canal_incidentes: 'seguridad@example.com',
  plazo_retencion: '5 anos',
  canal_solicitud_copia: 'privacidad@example.com',
  plazo_retencion_dias: 1825,
};

/** Registra la empresa y le marca (o no) el Anexo de Encargo. */
function registrarEmpresa({ conAnexo = false, conPlazo = true, conCanal = true } = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  let datos = Object.assign({}, DATOS_EMPRESA);
  if (!conPlazo) datos.plazo_retencion_dias = null;
  // El canal de atención es un requisito de habilitación (decisión del
  // owner, 2026-10-20): sin él, el 400 del D-2 le dice al Trabajador
  // «pedile a tu Empresa la firma en papel» y no hay puerta por dónde
  // pedirla.
  if (!conCanal) datos.canal_pqrs = null;
  const creada = empresaService.create(datos);
  if (conAnexo) empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
  return creada;
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
}

test('D-03 · sin Anexo de Encargo firmado la solicitud NO se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: false, conPlazo: true });

  await assert.rejects(
    () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA }),
    (e) => {
      assert.equal(e.statusCode, 409);
      assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
      assert.match(e.message, /Anexo de Encargo/i);
      assert.match(e.message, /anexo-firmado/,
        'el mensaje tiene que decir dónde se resuelve');
      return true;
    }
  );

  const n = db.prepare('SELECT COUNT(*) AS n FROM gh_firmas_electronicas').get().n;
  assert.equal(n, 0, 'no queda ninguna fila a medias');
});

test('D-03 · sin plazo declarado la solicitud NO se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conPlazo: false });

  await assert.rejects(
    () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA }),
    (e) => {
      assert.equal(e.statusCode, 409);
      assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
      assert.match(e.message, /plazo de conservaci/i);
      return true;
    }
  );
});

test('D-03 · con Anexo y plazo la solicitud se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conPlazo: true });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  assert.ok(signRequest && signRequest.id_solicitud,
    'una empresa habilitada firma sin problema');
});

test('D-03 · verificarHabilitacionFirma dice qué falta', () => {
  limpiar();
  registrarEmpresa({ conAnexo: false, conPlazo: true });

  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, false);
  assert.equal(h.registrada, true);
  assert.deepEqual(h.pendientes, ['anexo_encargo_firmado']);
  assert.match(h.mensaje, /Anexo/);

  // Con el Anexo firmado y el plazo declarado, habilitada.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
  const ok = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.pendientes, []);
});

test('D-03 · una empresa NO registrada no se bloquea', async () => {
  // Es otro problema (identificación incompleta) y se atiende por el alta.
  // Bloquearlo aquí rompería a los clientes que no usan el directorio.
  limpiar();

  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, true);
  assert.equal(h.registrada, false);

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  assert.ok(signRequest.id_solicitud);
});

test('D-03 · con la bandera apagada la firma pasa pero queda en el log', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: false, conPlazo: true });

  const antes = config.exigirHabilitacionEmpresa;
  config.exigirHabilitacionEmpresa = false;
  try {
    const { objetos } = await capturarLogs(async () => {
      const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
      assert.ok(signRequest.id_solicitud, 'con la bandera apagada la firma pasa');
    });

    const aviso = objetos.find((o) => o.aviso === 'EMPRESA_NO_HABILITADA');
    assert.ok(aviso, 'el default no es silencioso: queda en el log');
    assert.equal(aviso.level, 'warn');
  } finally {
    config.exigirHabilitacionEmpresa = antes;
  }
});

test('D-03 · sin canal de atención la solicitud NO se crea (el 7.2-7.3)', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: false });

  let e = null;
  try {
    await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  } catch (err) { e = err; }
  assert.ok(e, 'la solicitud tiene que rechazarse');
  assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
  assert.ok(e.details.pendientes.includes('canal_pqrs'),
    'el pendiente dice que falta el canal de atención');
  assert.match(e.message, /canal de atención/);
});

test('D-03 · con Anexo, plazo y canal la solicitud se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  assert.ok(signRequest && signRequest.id_solicitud);
});

test('D-03 · el mensaje del 409 dice dónde se resuelve el canal', () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: false });
  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, false);
  assert.deepEqual(h.pendientes, ['canal_pqrs']);
  assert.match(h.mensaje, /PUT \/internal\/admin\/empresas/);
});
