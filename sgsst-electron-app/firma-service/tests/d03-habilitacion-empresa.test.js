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
  VERSION_MODELO: VERSION_MODELO_NUBE,
  huellaModeloVigente,
} = require('../src/services/anexoNubeModelo');
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
    () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA, consent_id: null }),
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

test('D-03 · sin plazo declarado la solicitud SÍ se crea (y el plazo es el de la tabla supletoria)', async () => {
  // La custodia de 20 años YA NO es del sistema, y con la decisión D1 tampoco
  // hay retención indefinida: sin plazo declarado, el plazo es el de la tabla
  // supletoria de conservación de K+AIR. Esa tabla la abrió el OWNER el
  // 13-nov-2026 con un acto expreso y fechado (S-25), así que su plazo por
  // defecto YA SE APLICA.
  //
  // Y el catálogo legado de veinte (20) años desde la firma ya NO se aplica
  // (J8 y J9 del abogado, 30-oct-2026): "la tabla no puede activar los plazos
  // por defecto mientras el sistema conserve el catálogo legado de 20 años
  // desde la firma".
  //
  // El resultado que el texto exige: la firma se puede hacer y el registro
  // conserva la fecha del plazo supletorio, con su fuente y su punto de inicio
  // congelados en la fila. El hold `tabla_supletoria_pendiente_validacion` ya
  // no se pone: ese hold era para cuando la compuerta estaba cerrada.
  limpiar();
  registrarEmpresa({ conAnexo: true, conPlazo: false });

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  assert.ok(signRequest && signRequest.id_solicitud,
    'una empresa sin plazo declarado firma: no hay nada que ella tenga que declarar');
  assert.ok(signRequest.fecha_conservacion,
    'con la compuerta abierta por el acto del owner, el plazo por defecto de la tabla '
    + 'se aplica: el registro conserva su fecha de supresión');
  // La fuente del plazo se lee de la FILA: el plan se aplico a la base
  // despues de crear la solicitud, asi que no esta en el objeto devuelto.
  const fila = db.prepare(
    'SELECT plazo_conservacion_fuente, fecha_conservacion FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(fila.plazo_conservacion_fuente, 'tabla_supletoria',
    'la fuente del plazo es la tabla supletoria, y queda congelada en la fila');
  assert.ok(fila.fecha_conservacion,
    'y la fecha de conservacion queda escrita en la fila');
  assert.notEqual(signRequest.hold_legal, 1,
    'el registro NO queda retenido: ya hay fecha de conservación');
  assert.notEqual(signRequest.motivo_hold, 'tabla_supletoria_pendiente_validacion',
    'ese hold era para cuando la compuerta estaba cerrada');
  assert.notEqual(signRequest.motivo_hold, 'plazo_no_declarado',
    'la retención indefinida por falta de plazo declarado ya no existe');
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

test('D-03 · quitar la fecha del Anexo vuelve a bloquear la Empresa', () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conPlazo: true });
  assert.equal(empresaService.verificarHabilitacionFirma(EMPRESA).ok, true);

  empresaService.desmarcarAnexoFirmado(EMPRESA, {
    actor: 'el owner',
    motivo: 'no existe el PDF firmado; se vuelve a firmar',
  });

  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, false);
  assert.deepEqual(h.pendientes, ['anexo_encargo_firmado']);
  assert.match(h.mensaje, /Anexo de Encargo/i);
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

test('D-03 · el bloqueo NO se puede desactivar con una bandera', async () => {
  // Antes existía `FIRMA_EXIGIR_HABILITACION_EMPRESA`: con ella en 'false' la
  // firma pasaba y solo quedaba un WARN en el log. Se RETIRÓ (decisión B.3
  // del 23-oct-2026): era exactamente el "if silencioso" que el abogado no
  // quiere. La única salida del bloqueo es la EXCEPCIÓN auditable.
  limpiar();
  registrarEmpresa({ conAnexo: false, conPlazo: true });

  assert.equal(config.exigirHabilitacionEmpresa, undefined,
    'la bandera ya no existe en el config');

  await assert.rejects(
    () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA, consent_id: null }),
    (e) => {
      assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
      assert.match(e.message, /excepción/i,
        'el mensaje dice que hay una salida: la excepción auditable');
      return true;
    }
  );
});

test('D-03 · sin canal de atención la solicitud NO se crea (el 7.2-7.3)', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: false });

  let e = null;
  try {
    await createSignRequestWithIdentificacion({ id_empresa: EMPRESA, consent_id: null });
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

// ---------------------------------------------------------------------------
// C-1 DEL ABOGADO (30-oct-2026) · el Anexo de Nube suscrito por la Empresa.
//
// "Si la Empresa no ha suscrito el Anexo de Nube, el servicio no permite crear
// solicitudes de firma y, en consecuencia, no puede emitirse Constancia."
//
// La regla existe, pero va detras de la COMPUERTA `config.exigirAnexoNube`,
// igual que la tabla supletoria de conservacion: mientras el Anexo de Nube
// v1.0 sea un MODELO SIN PUBLICAR, exigir su firma seria exigir un documento
// que el sistema todavia no publica, y dejaria a todas las Empresas sin poder
// firmar.
//
// Esta NO es la bandera que el D-03 retired (`exigirHabilitacionEmpresa`): esa
// apagaba una promesa que el texto ya habia hecho. Esta enciende una
// obligacion que todavia no existe, porque el documento que la crea todavia no
// se publica. El encendido es un acto posterior, con validacion escrita, en el
// mismo orden que fijo el abogado para la compuerta de conservacion.
// ---------------------------------------------------------------------------

test('C-1 · con la compuerta apagada, la falta del Anexo de Nube NO bloquea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  assert.equal(config.exigirAnexoNube, false,
    'la compuerta arranca apagada: el Anexo de Nube todavia no se publica');

  const h = empresaService.verificarHabilitacionFirma(EMPRESA);
  assert.equal(h.ok, true);
  assert.deepEqual(h.pendientes, [],
    'con la compuerta apagada el Anexo de Nube no es un pendiente');

  const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
  assert.ok(signRequest && signRequest.id_solicitud);
});

test('C-1 · con la compuerta encendida y sin Anexo de Nube, la solicitud NO se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  config.exigirAnexoNube = true;
  try {
    const h = empresaService.verificarHabilitacionFirma(EMPRESA);
    assert.equal(h.ok, false);
    assert.deepEqual(h.pendientes, ['anexo_nube_firmado']);
    assert.match(h.mensaje, /Anexo de Nube/);

    await assert.rejects(
      () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA, consent_id: null }),
      (e) => {
        assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
        assert.ok(e.details.pendientes.includes('anexo_nube_firmado'));
        assert.doesNotMatch(e.message, /excepción/i,
          'una excepcion operativa no sustituye un anexo suscrito');
        return true;
      }
    );
  } finally {
    config.exigirAnexoNube = false;
  }
});

test('C-1 · con la compuerta encendida y el Anexo de Nube EJECUTADO, la solicitud se crea', async () => {
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  // La suscripcion tiene que ser del TEXTO VIGENTE: la compuerta contrasta la
  // version y la huella con el archivo que el servicio firma (PROMPT.md,
  // trampa 137). Una huella inventada ya no habilita: eso es lo que hace
  // falso positivo al gate.
  empresaService.marcarAnexoNubeFirmado(EMPRESA, {
    fecha: '2026-10-30',
    version: VERSION_MODELO_NUBE,
    hash: huellaModeloVigente(),
    evidencia: 'PDF firmado por la Empresa, en el expediente',
  }, { actor: 'el owner', motivo: 'firma registrada' });
  // 📦1047 · punto 3 Y tiene que estar EJECUTADO: el Anexo de Nube es
  // bilateral (el texto vigente, §10), y el segundo acto (la contrafirma de
  // K+AIR) es lo que ejecuta el instrumento. Es el espejo del Anexo de
  // Encargo, cuya habilitación ya exigía la fecha de la contrafirma.
  db.prepare('UPDATE gh_firma_empresas SET anexo_nube_ejecutado_at = ? WHERE id_empresa = ?')
    .run('2026-10-31', EMPRESA);

  config.exigirAnexoNube = true;
  try {
    const h = empresaService.verificarHabilitacionFirma(EMPRESA);
    assert.equal(h.ok, true);
    assert.deepEqual(h.pendientes, []);

    const { signRequest } = await createSignRequestWithIdentificacion({ id_empresa: EMPRESA });
    assert.ok(signRequest && signRequest.id_solicitud);
  } finally {
    config.exigirAnexoNube = false;
  }
});

test('C-1 · con la compuerta encendida y el Anexo de Nube SIN contrafirmar, la solicitud NO se crea', async () => {
  // El caso que este test ata: la Empresa YA SUSCRIBIO el texto vigente, pero
  // K+AIR no ha contrafirmado. El instrumento esta suscrito a medias y NO
  // esta ejecutado: habilitar aqui seria un verde falso.
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  empresaService.marcarAnexoNubeFirmado(EMPRESA, {
    fecha: '2026-10-30',
    version: VERSION_MODELO_NUBE,
    hash: huellaModeloVigente(),
    evidencia: 'PDF firmado por la Empresa, en el expediente',
  }, { actor: 'el owner', motivo: 'firma registrada' });

  config.exigirAnexoNube = true;
  try {
    const h = empresaService.verificarHabilitacionFirma(EMPRESA);
    assert.equal(h.ok, false);
    assert.deepEqual(h.pendientes, ['anexo_nube_firmado']);

    await assert.rejects(
      () => createSignRequestWithIdentificacion({ id_empresa: EMPRESA, consent_id: null }),
      (e) => {
        assert.equal(e.code, 'EMPRESA_NO_HABILITADA');
        assert.ok(e.details.pendientes.includes('anexo_nube_firmado'));
        return true;
      },
    );
  } finally {
    config.exigirAnexoNube = false;
  }
});

test('C-1 · con la compuerta encendida, una suscripcion de OTRA version NO habilita', async () => {
  // El caso que la compuerta nueva cierra: la Empresa suscribio una version
  // anterior del Anexo de Nube. La fecha de suscripcion no dice que version se
  // firmo: la huella si. Con la comparacion contra el texto vigente, una
  // suscripcion vieja queda como pendiente en vez de pasar.
  limpiar();
  registrarEmpresa({ conAnexo: true, conCanal: true });
  empresaService.marcarAnexoNubeFirmado(EMPRESA, {
    fecha: '2026-10-30',
    version: 'v0.9',
    hash: 'a'.repeat(64),
    evidencia: 'PDF firmado por la Empresa, en el expediente',
  }, { actor: 'el owner', motivo: 'firma registrada' });

  config.exigirAnexoNube = true;
  try {
    const h = empresaService.verificarHabilitacionFirma(EMPRESA);
    assert.equal(h.ok, false);
    assert.deepEqual(h.pendientes, ['anexo_nube_firmado']);
  } finally {
    config.exigirAnexoNube = false;
  }
});
