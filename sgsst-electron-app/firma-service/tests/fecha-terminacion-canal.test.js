/**
 * EL CANAL DE LA FECHA DE TERMINACIÓN (Anexo de Encargo, sección 6)
 * ==================================================================
 *
 * Ejecutar: node --test --require ./tests/setup.js tests/fecha-terminacion-canal.test.js
 *
 * QUÉ SE PRUEBA
 * -------------
 * El canal que el Anexo de Encargo habilita en el servicio, de punta a punta:
 *
 *   1. SIN la fecha de terminación, la fila de una categoría del 8.6(b)
 *      (los grupos SG-SST) queda RETENIDA, sin fecha de supresión, y aparece
 *      en la revisión periódica. La fecha de firma NO sustituye la fecha de
 *      cese (J9).
 *   2. La comunicación (con su EVIDENCIA) registra la fecha, la escribe en las
 *      filas del trabajador y RECALCULA el plazo de ESAS filas: veinte (20)
 *      años desde el cese, que es el piso legal del 2.2.4.6.13.
 *   3. El recálculo es ACOTADO: las filas de otro trabajador no se mueven.
 *   4. Una fecha ya comunicada no se reescribe.
 *   5. Sin evidencia no hay registro.
 *   6. La bitácora de la operación es APPEND-ONLY (trigger de la 053).
 *   7. El documento crudo del trabajador NO queda en la base: solo el seudónimo.
 *   8. El endpoint admin: sin key 401, sin evidencia 400, con todo 201.
 *
 * Todos los datos son sintéticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');
const trabajador = require('../src/services/trabajador');
const fechaTerminacion = require('../src/services/fechaTerminacion');
const { resetDb, makeApp, TEST_ADMIN_API_KEY } = require('./helpers');

const SQL_052 = path.join(__dirname, '..', 'src', 'db', 'schema', '052_fecha_terminacion_canal.sql');
const SQL_053 = path.join(__dirname, '..', 'src', 'db', 'schema', '053_fecha_terminacion_append_only.sql');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };
const EMPRESA = '901555777';
const CEDULA = '80001001';
const OTRA_CEDULA = '80002002';
const FIRMA_BASE = '2026-01-15T10:00:00.000Z';
const CESE = '2026-10-31T00:00:00.000Z';
const VIGENTE = '2046-10-31T00:00:00.000Z';

const EVIDENCIA = 'Correo de la Empresa del 30-oct-2026, radicado 2026-1044.';

/**
 * La Empresa de la prueba: sin deber legal declarado y sin plazo declarado, que
 * es como se despacha (la tabla supletoria está apagada).
 */
function sembrarEmpresa() {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'EMPRESA DEL CANAL SAS',
  });
}

/**
 * Una firma de una categoría del 8.6(b) (grupo SG-SST), retenida porque falta
 * la fecha real del cese. Es el estado en el que queda una fila cuando la
 * Empresa todavía no ha comunicado el cese.
 */
function sembrarFirmaConCesePendiente(cedula) {
  const seudonimo = trabajador.valorParaGuardar(cedula, EMPRESA).valor;
  const idSolicitud = 'SIGN-CAN-' + Math.floor(Math.random() * 900000 + 100000);
  const r = db.prepare(`
    INSERT INTO gh_firmas_electronicas
      (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
       document_hash_original, agreement_hash, token_hash,
       fecha_creacion, fecha_expiracion, version_kair,
       categoria_retencion, regla_retencion, fecha_terminacion,
       fecha_conservacion, hold_legal, motivo_hold)
    VALUES (?, 'doc-1', ?, ?, 'presencial',
            'hash-doc', 'hash-acuerdo', 'hash-token-' || ?,
            ?, datetime('now'), '0.1.0-test',
            'SST_PERFIL_Y_CONCEPTOS_MEDICOS', 'SST_20_ANOS', NULL,
            NULL, 1, 'fecha_cese_pendiente')
  `).run(idSolicitud, seudonimo, EMPRESA, idSolicitud, FIRMA_BASE);
  const idFirma = Number(r.lastInsertRowid);

  // El hold vigente: el que la operación va a levantar.
  db.prepare(`
    INSERT INTO gh_firma_holds (firma_id, actor, motivo, alcance, declarado_at, activo)
    VALUES (?, 'sistema', 'fecha_cese_pendiente',
            'No calcular ni ejecutar supresion hasta que la Empresa informe la fecha real de cese.',
            datetime('now'), 1)
  `).run(idFirma);

  return idFirma;
}

const fila = (id) => db.prepare(`
  SELECT fecha_terminacion, fecha_conservacion, hold_legal, motivo_hold,
         plazo_conservacion_dias, plazo_conservacion_fuente,
         fecha_inicio_conservacion, categoria_conservacion
    FROM gh_firmas_electronicas WHERE id = ?
`).get(id);

const holdVigente = (id) => db.prepare(
  'SELECT id, motivo, activo, liberado_at FROM gh_firma_holds WHERE firma_id = ? ORDER BY id DESC LIMIT 1'
).get(id);

test.beforeEach(() => {
  resetDb();
  sembrarEmpresa();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1 · MIENTRAS NO LLEGA LA FECHA
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · sin la fecha, la fila sigue retenida y sin fecha de supresion', () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);

  const f = fila(idFirma);
  assert.equal(f.fecha_terminacion, null, 'no hay fecha de terminacion');
  assert.equal(f.fecha_conservacion, null, 'no hay fecha de conservacion: sin fecha no hay supresion');
  assert.equal(f.hold_legal, 1, 'la fila sigue retenida');
  assert.equal(f.motivo_hold, 'fecha_cese_pendiente');

  // Y la revision periodica la lista.
  const revision = fechaTerminacion.pendientes({ id_empresa: EMPRESA });
  assert.equal(revision.pendientes_de_cese.length, 1, 'la fila espera la fecha de cese');
  assert.equal(revision.pendientes_de_cese[0].id, idFirma);
  assert.equal(revision.recalculo_pendiente.length, 0);
});

test('canal de fecha de terminacion · la fecha de firma NO sustituye la fecha de cese', () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);
  const f = fila(idFirma);
  assert.equal(f.fecha_inicio_conservacion, null);
  assert.notEqual(f.fecha_conservacion, FIRMA_BASE);
  // El punto de inicio del 8.6(b) es la fecha real del cese, no la de la firma.
  assert.ok(f.fecha_conservacion === null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · LA COMUNICACIÓN
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · la comunicacion registra la fecha y recalcula el plazo de esa fila', () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);

  const r = fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
    actor: 'operador@kair',
    motivo: 'La Empresa comunica el cese del trabajador',
  });

  assert.equal(r.filas.encontradas, 1);
  assert.equal(r.filas.con_fecha_registrada, 1);
  assert.equal(r.filas.recalculadas, 1);

  const f = fila(idFirma);
  assert.equal(f.fecha_terminacion, CESE, 'la fecha comunicada queda en la fila');
  assert.equal(f.fecha_conservacion, VIGENTE, 'veinte (20) anos desde el cese');
  assert.equal(f.fecha_inicio_conservacion, CESE, 'el computo corre desde el cese, no desde la firma');
  assert.equal(f.plazo_conservacion_fuente, 'piso_legal', 'el plazo es el piso legal del 8.6(b)');
  assert.equal(f.hold_legal, 0, 'el hold de "falta la fecha" se levanto');

  const h = holdVigente(idFirma);
  assert.equal(h.activo, 0, 'el hold quedo liberado');
  assert.ok(h.liberado_at, 'el hold quedo liberado con fecha');

  // El registro: con su evidencia y con su canal.
  const registro = db.prepare(
    'SELECT * FROM gh_firma_fecha_terminacion WHERE id = ?'
  ).get(r.registro.id);
  assert.equal(registro.evidencia, EVIDENCIA);
  assert.equal(registro.canal, 'correo');
  assert.equal(registro.actor, 'operador@kair');
  assert.equal(registro.fecha_terminacion, CESE);
  assert.equal(registro.firmas_afectadas, 1);
  assert.equal(registro.firmas_recalculadas, 1);
});

test('canal de fecha de terminacion · la bitacora deja registro de la operacion', () => {
  sembrarFirmaConCesePendiente(CEDULA);
  const r = fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
    actor: 'operador@kair',
  });

  const eventos = db.prepare(
    'SELECT * FROM gh_firma_fecha_terminacion_eventos WHERE registro_id = ? ORDER BY id'
  ).all(r.registro.id);
  assert.equal(eventos.length, 2, 'la operacion deja dos rastros: el registro y el recalculo');
  assert.equal(eventos[0].evento, 'FECHA_TERMINACION_REGISTRADA');
  assert.equal(eventos[1].evento, 'FECHA_TERMINACION_PLAZO_RECALCULADO');
  assert.equal(eventos[0].id_actor, 'operador@kair');
  assert.equal(eventos[0].id_empresa, EMPRESA);
  const meta = JSON.parse(eventos[0].metadata);
  assert.equal(meta.evidencia, EVIDENCIA);
  assert.equal(meta.canal, 'correo');
});

test('canal de fecha de terminacion · el documento crudo NO queda en la base', () => {
  sembrarFirmaConCesePendiente(CEDULA);
  const r = fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
  });

  const registro = db.prepare(
    'SELECT * FROM gh_firma_fecha_terminacion WHERE id = ?'
  ).get(r.registro.id);
  assert.equal(registro.id_trabajador, trabajador.valorParaGuardar(CEDULA, EMPRESA).valor);
  assert.ok(registro.id_trabajador.startsWith('psn1_'), 'se guarda el seudonimo');
  assert.ok(
    !JSON.stringify(registro).includes(CEDULA),
    'el documento crudo del trabajador no queda en la base'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · EL RECÁLCULO ES ACOTADO
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · el recalculo es ACOTADO: las filas de otro trabajador no se tocan', () => {
  const idMio = sembrarFirmaConCesePendiente(CEDULA);
  const idOtro = sembrarFirmaConCesePendiente(OTRA_CEDULA);

  fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
  });

  const mio = fila(idMio);
  const otro = fila(idOtro);
  assert.equal(mio.fecha_conservacion, VIGENTE, 'la fila del trabajador comunicado si se recalculo');
  assert.equal(otro.fecha_conservacion, null, 'la fila del otro trabajador NO se toco');
  assert.equal(otro.fecha_terminacion, null, 'la fila del otro trabajador NO recibio la fecha');
  assert.equal(otro.hold_legal, 1, 'la fila del otro trabajador sigue retenida');
});

test('canal de fecha de terminacion · una fecha ya comunicada no se reescribe', () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);

  fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
  });
  // Una segunda comunicacion, con OTRA fecha (anterior): no puede mover lo ya
  // calculado.
  fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-09-30',
    evidencia: 'Correo de la Empresa del 02-nov-2026, radicado 2026-1102.',
    canal: 'correo',
  });

  const f = fila(idFirma);
  assert.equal(f.fecha_terminacion, CESE, 'la fecha comunicada no se reescribe');
  assert.equal(f.fecha_conservacion, VIGENTE, 'el plazo calculado queda congelado');

  // Pero las dos comunicaciones quedan registradas: la bitacora es el historico.
  const comunicaciones = fechaTerminacion.comunicaciones(EMPRESA);
  assert.equal(comunicaciones.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · LO QUE NO SE ACEPTA
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · sin evidencia NO hay registro', () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);
  assert.throws(() => fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: '',
    canal: 'correo',
  }), /evidencia/i);

  const registros = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_fecha_terminacion').get();
  assert.equal(registros.n, 0, 'no se registro nada');
  assert.equal(fila(idFirma).fecha_conservacion, null, 'la fila sigue como estaba');
});

test('canal de fecha de terminacion · una fecha invalida o futura no se registra', () => {
  sembrarFirmaConCesePendiente(CEDULA);
  assert.throws(() => fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: 'no-es-una-fecha',
    evidencia: EVIDENCIA,
    canal: 'correo',
  }), /fecha/i);

  const futuro = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.throws(() => fechaTerminacion.registrar({
    id_empresa: EMPRESA,
    id_trabajador: CEDULA,
    fecha_terminacion: futuro,
    evidencia: EVIDENCIA,
    canal: 'correo',
  }), /futuro/i);
});

test('canal de fecha de terminacion · una Empresa que no existe no se registra', () => {
  assert.throws(() => fechaTerminacion.registrar({
    id_empresa: '999999999',
    id_trabajador: CEDULA,
    fecha_terminacion: '2026-10-31',
    evidencia: EVIDENCIA,
    canal: 'correo',
  }), /empresa/i);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · LA BITÁCORA ES APPEND-ONLY
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · la bitacora es append-only (trigger de la 053)', () => {
  // La migracion 053 lleva `@skip-when-env test`, asi que se aplica aqui a una
  // base en memoria para comprobar que los triggers muerden de verdad.
  const mem = new Database(':memory:');
  try {
    mem.exec(fs.readFileSync(SQL_052, 'utf8'));
    mem.exec(fs.readFileSync(SQL_053, 'utf8'));
    mem.prepare(`
      INSERT INTO gh_firma_fecha_terminacion
        (id_empresa, id_trabajador, fecha_terminacion, evidencia, canal, actor, motivo, fecha_registro)
      VALUES ('1', 'psn1_x', '2026-10-31', 'evidencia', 'correo', 'actor', 'motivo', '2026-10-31T00:00:00.000Z')
    `).run();
    mem.prepare(`
      INSERT INTO gh_firma_fecha_terminacion_eventos
        (registro_id, evento, fecha_hora, id_actor, id_empresa)
      VALUES (1, 'FECHA_TERMINACION_REGISTRADA', '2026-10-31T00:00:00.000Z', 'actor', '1')
    `).run();

    assert.throws(() => mem.prepare(
      "UPDATE gh_firma_fecha_terminacion_eventos SET evento = 'otra' WHERE id = 1"
    ).run(), /append-only/);
    assert.throws(() => mem.prepare(
      'DELETE FROM gh_firma_fecha_terminacion_eventos WHERE id = 1'
    ).run(), /append-only/);

    const quedan = mem.prepare('SELECT COUNT(*) AS n FROM gh_firma_fecha_terminacion_eventos').get();
    assert.equal(quedan.n, 1, 'el evento sigue ahi');
  } finally {
    mem.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 · EL ENDPOINT
// ─────────────────────────────────────────────────────────────────────────────

test('canal de fecha de terminacion · el POST sin key devuelve 401', async () => {
  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .send({
      id_trabajador: CEDULA,
      fecha_terminacion: '2026-10-31',
      evidencia: EVIDENCIA,
      canal: 'correo',
    })
    .timeout({ response: 3000 });

  assert.equal(res.status, 401);
});

test('canal de fecha de terminacion · el POST sin evidencia devuelve 400', async () => {
  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .set(ADMIN)
    .send({
      id_trabajador: CEDULA,
      fecha_terminacion: '2026-10-31',
      canal: 'correo',
    })
    .timeout({ response: 3000 });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_REQUEST_BODY');
});

test('canal de fecha de terminacion · el POST registra y devuelve el resumen', async () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);

  const res = await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'operador@kair')
    .set('X-Admin-Motivo', 'Cese comunicado por la Empresa')
    .send({
      id_trabajador: CEDULA,
      fecha_terminacion: '2026-10-31',
      evidencia: EVIDENCIA,
      canal: 'correo',
    })
    .timeout({ response: 3000 });

  assert.equal(res.status, 201);
  assert.equal(res.body.registro.evidencia, EVIDENCIA);
  assert.equal(res.body.registro.canal, 'correo');
  assert.equal(res.body.filas.recalculadas, 1);
  assert.equal(fila(idFirma).fecha_conservacion, VIGENTE);
});

test('canal de fecha de terminacion · el GET de pendientes lista lo que falta', async () => {
  const idFirma = sembrarFirmaConCesePendiente(CEDULA);

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion/pendientes`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.pendientes_de_cese.length, 1);
  assert.equal(res.body.pendientes_de_cese[0].id, idFirma);
  assert.equal(res.body.recalculo_pendiente.length, 0);

  // Y la revision ya no lo lista cuando la fecha llego.
  await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .set(ADMIN)
    .send({
      id_trabajador: CEDULA,
      fecha_terminacion: '2026-10-31',
      evidencia: EVIDENCIA,
      canal: 'correo',
    })
    .timeout({ response: 3000 });

  const despues = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion/pendientes`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(despues.body.pendientes_de_cese.length, 0);
  assert.equal(despues.body.recalculo_pendiente.length, 0);
});

test('canal de fecha de terminacion · el GET de comunicaciones devuelve el historial con su bitacora', async () => {
  sembrarFirmaConCesePendiente(CEDULA);
  await request(makeApp())
    .post(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .set(ADMIN)
    .send({
      id_trabajador: CEDULA,
      fecha_terminacion: '2026-10-31',
      evidencia: EVIDENCIA,
      canal: 'correo',
    })
    .timeout({ response: 3000 });

  const res = await request(makeApp())
    .get(`/internal/admin/empresas/${EMPRESA}/fecha-terminacion`)
    .set(ADMIN)
    .timeout({ response: 3000 });

  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].evidencia, EVIDENCIA);
  assert.equal(res.body.items[0].eventos.length, 2);
});
