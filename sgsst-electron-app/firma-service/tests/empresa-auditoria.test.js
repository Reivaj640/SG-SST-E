/**
 * RASTRO DE LOS CAMBIOS DE LA FICHA DE LA EMPRESA (B1)
 * ====================================================
 *
 * El abogado lo pone como bloqueante de la publicacion de la v1.1:
 *
 *   "Canal de PQRS unico (formulario o endpoint) | Si - sin el, el override no
 *    deja rastro"
 *
 * O sea: el problema no es que se pueda cambiar (cambiar el canal de una
 * Empresa es legitimo), es que el cambio SEA INVISIBLE.
 *
 * Estos tests comprueban que:
 *
 *   1. Cada campo que REALMENTE cambia deja un renglon: valor anterior, valor
 *      nuevo, quien, desde donde, cuando y por que.
 *   2. Un guardado que no cambia nada NO deja renglon (no es un cambio).
 *   3. El documento del representante legal NO se copia en claro al rastro.
 *   4. El rastro es append-only de verdad (los triggers de la 038 muerden).
 *   5. El endpoint de consulta responde "de donde salio este canal".
 *
 * Y que nada de esto rompe el proceso de firma: la firma sigue funcionando
 * con la ficha rastreada.
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
const auditoriaService = require('../src/services/empresaAuditoria');
const { resetDb, seedActiveAgreement, makeApp } = require('./helpers');

const EMPRESA = '900123456';
const ADMIN_KEY = 'test-admin-api-key-32-bytes-min!!!!!';

const FICHA_BASE = {
  razon_social: 'Empresa de Prueba S.A.S.',
  nit: EMPRESA,
  domicilio: 'Bogotá D.C.',
  representante_legal: 'Lilia Maria Vasquez Muñoz',
  representante_legal_identificacion: '1129566447',
  responsable_tratamiento: 'Responsable de Prueba',
  responsable_tratamiento_correo: 'privacidad@example.com',
  canal_pqrs: 'pqrs@example.com',
  canal_incidentes: 'seguridad@example.com',
  politica_datos_url: 'https://kair.fyi/privacidad',
  plazo_retencion: '5 años',
  canal_solicitud_copia: 'privacidad@example.com',
  plazo_retencion_dias: 1825,
  conservacion_por_deber_legal: false,
  norma_conservacion: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function registrarEmpresa(extra = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  db.prepare('DELETE FROM gh_firma_empresas_auditoria WHERE id_empresa = ?').run(EMPRESA);
  return empresaService.create(Object.assign({}, FICHA_BASE, { id_empresa: EMPRESA }, extra));
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
}

function renglones() {
  return db.prepare(
    'SELECT * FROM gh_firma_empresas_auditoria WHERE id_empresa = ? ORDER BY id ASC'
  ).all(EMPRESA);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Cada campo que REALMENTE cambia deja un renglon
// ─────────────────────────────────────────────────────────────────────────────

test('rastro · un cambio real deja un renglon con el valor anterior y el nuevo', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    canal_pqrs: 'nuevo-pqrs@example.com',
  }), { actor: 'el operador', motivo: 'la Empresa cambio de canal' });

  const filas = renglones();
  assert.equal(filas.length, 1, 'un solo campo cambio: un solo renglon');
  assert.equal(filas[0].campo, 'canal_pqrs');
  assert.equal(filas[0].valor_anterior, 'pqrs@example.com');
  assert.equal(filas[0].valor_nuevo, 'nuevo-pqrs@example.com');
  assert.equal(filas[0].id_actor, 'el operador');
  assert.equal(filas[0].motivo, 'la Empresa cambio de canal');
  assert.ok(filas[0].fecha_hora, 'el renglon tiene fecha');
});

test('rastro · el motivo y el actor se guardan tal cual', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    domicilio: 'Medellín, Antioquia',
  }), {
    actor: '  Ana Perez  ',
    motivo: '  Actualizacion de la direccion  ',
    ip: '10.0.0.7',
    user_agent: 'K+AIR-Desktop/0.1.190',
  });

  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].id_actor, 'Ana Perez', 'el actor se normaliza (trim)');
  assert.equal(filas[0].motivo, 'Actualizacion de la direccion');
  assert.equal(filas[0].ip, '10.0.0.7');
  assert.equal(filas[0].user_agent, 'K+AIR-Desktop/0.1.190');
});

test('rastro · sin actor declarado el renglon queda con admin', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    nit: '900999',
  }));

  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].id_actor, 'admin');
  assert.equal(filas[0].motivo, null);
});

test('rastro · varios campos que cambian dejan varios renglones, uno por campo', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    canal_pqrs: 'otro@example.com',
    domicilio: 'Cali, Valle',
    plazo_retencion: '10 años',
  }), { actor: 'test' });

  const filas = renglones();
  assert.equal(filas.length, 3);
  assert.deepEqual(
    filas.map((f) => f.campo).sort(),
    ['canal_pqrs', 'domicilio', 'plazo_retencion']
  );
});

test('rastro · un guardado que NO cambia nada no deja renglon', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE), { actor: 'test' });

  assert.equal(renglones().length, 0,
    're-mandar lo mismo no es un cambio: el rastro no se ensucia');
});

test('rastro · el flag de deber legal compara SI/NO y no 0/1', () => {
  limpiar();
  registrarEmpresa();

  // El flag viene como boolean desde la fila y como 0/1 desde la escritura.
  // Sin normalizar, un valor sin cambio pareceria un cambio.
  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    conservacion_por_deber_legal: false,
  }));
  assert.equal(renglones().length, 0, 'false -> false no es un cambio');

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    conservacion_por_deber_legal: true,
  }));
  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].campo, 'conservacion_por_deber_legal');
  assert.equal(filas[0].valor_anterior, 'NO');
  assert.equal(filas[0].valor_nuevo, 'SI');
});

test('rastro · poner un valor en null tambien es un cambio', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    canal_incidentes: null,
  }));

  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].campo, 'canal_incidentes');
  assert.equal(filas[0].valor_anterior, 'seguridad@example.com');
  assert.equal(filas[0].valor_nuevo, null);
});

test('rastro · la firma del Anexo y la baja tambien dejan rastro', () => {
  limpiar();
  registrarEmpresa();

  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-23', {
    actor: 'el owner', motivo: 'Anexo firmado en presencia del representante',
  });
  empresaService.setActivo(EMPRESA, false, { actor: 'el owner', motivo: 'deja de operar' });

  const filas = renglones();
  assert.equal(filas.length, 2);
  const porCampo = {};
  for (const f of filas) porCampo[f.campo] = f;
  assert.ok(porCampo.anexo_encargo_firmado_at, 'la firma del anexo queda rastreada');
  assert.equal(porCampo.anexo_encargo_firmado_at.valor_nuevo, '2026-10-23T00:00:00.000Z');
  assert.ok(porCampo.activo, 'la baja queda rastreada');
  assert.equal(porCampo.activo.valor_anterior, 'SI');
  assert.equal(porCampo.activo.valor_nuevo, 'NO');
});

test('rastro · quitar la firma del Anexo exige motivo y deja rastro', () => {
  limpiar();
  registrarEmpresa();

  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-21', {
    actor: 'el owner', motivo: 'fecha cargada al crear la empresa',
  });

  assert.throws(
    () => empresaService.desmarcarAnexoFirmado(EMPRESA, { actor: 'el owner' }),
    (e) => {
      assert.equal(e.statusCode, 400);
      assert.equal(e.code, 'MOTIVO_REQUERIDO');
      return true;
    },
    'sin motivo no se puede quitar una fecha legal'
  );

  const empresa = empresaService.desmarcarAnexoFirmado(EMPRESA, {
    actor: 'el owner',
    motivo: 'no existe el PDF firmado; se vuelve a firmar',
  });
  assert.equal(empresa.anexo_encargo_firmado_at, null);

  const filas = renglones();
  const ultima = filas[filas.length - 1];
  assert.equal(ultima.campo, 'anexo_encargo_firmado_at');
  assert.equal(ultima.valor_anterior, '2026-10-21T00:00:00.000Z');
  assert.equal(ultima.valor_nuevo, null);
  assert.equal(ultima.id_actor, 'el owner');
  assert.match(String(ultima.motivo), /PDF/i);
});

test('rastro · cambiar una fecha ya registrada exige motivo', () => {
  limpiar();
  registrarEmpresa();

  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-21', {
    motivo: 'alta de la empresa',
  });

  assert.throws(
    () => empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-22'),
    (e) => e.code === 'MOTIVO_REQUERIDO',
    'un reemplazo silencioso de la fecha del Anexo no se acepta'
  );

  // Re-registrar la MISMA fecha es un reintento idempotente: no exige motivo
  // y no escribe un renglon nuevo.
  const antes = renglones().length;
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-21');
  assert.equal(renglones().length, antes, 'la misma fecha no deja rastro nuevo');

  const empresa = empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-22', {
    motivo: 'correccion de la fecha contra el PDF',
  });
  assert.equal(empresa.anexo_encargo_firmado_at, '2026-10-22T00:00:00.000Z');
});

test('rastro · una fecha futura del Anexo se rechaza', () => {
  limpiar();
  registrarEmpresa();

  const futura = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.throws(
    () => empresaService.marcarAnexoFirmado(EMPRESA, futura),
    (e) => {
      assert.equal(e.statusCode, 400);
      assert.match(e.message, /futura/i);
      return true;
    }
  );
  assert.equal(empresaService.getById(EMPRESA).anexo_encargo_firmado_at, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El documento del representante NO se copia en claro
// ─────────────────────────────────────────────────────────────────────────────

test('rastro · el documento del representante NO se copia en claro', () => {
  limpiar();
  registrarEmpresa();

  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    representante_legal_identificacion: '1129566448',
  }));

  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.equal(filas[0].campo, 'representante_legal_identificacion');
  // El numero completo no puede estar en el rastro.
  assert.ok(!String(filas[0].valor_anterior).includes('1129566447'),
    'el valor anterior no es el numero completo');
  assert.ok(!String(filas[0].valor_nuevo).includes('1129566448'),
    'el valor nuevo no es el numero completo');
  // Pero si dice que cambio y por cuanto.
  assert.match(String(filas[0].valor_anterior), /^\*{4}\d{4}$/);
  assert.match(String(filas[0].valor_nuevo), /^\*{4}\d{4}$/);
});

test('rastro · el documento cifrado tampoco se copia en claro', () => {
  limpiar();
  registrarEmpresa();

  const sobre = 'enc:v2:1:abc:def:ghi';
  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    representante_legal_identificacion: sobre,
  }));

  const filas = renglones();
  assert.equal(filas.length, 1);
  assert.ok(!String(filas[0].valor_nuevo).includes('abc'),
    'el sobre cifrado no se copia entero al rastro');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. La bitacora es inalterable
// ─────────────────────────────────────────────────────────────────────────────

test('rastro · la migracion 038 lo vuelve append-only de verdad', () => {
  // La migracion lleva `@skip-when-env test` (si no, resetDb() no podria
  // vaciar la tabla). Aca se aplica el MISMO SQL a una base en memoria para
  // comprobar que los triggers muerden.
  const bd = new Database(':memory:');
  bd.exec(`
    CREATE TABLE gh_firma_empresas_auditoria (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      id_empresa      TEXT    NOT NULL,
      fecha_hora      TEXT    NOT NULL,
      id_actor        TEXT    NOT NULL,
      ip              TEXT,
      user_agent      TEXT,
      campo           TEXT    NOT NULL,
      valor_anterior  TEXT,
      valor_nuevo     TEXT,
      motivo          TEXT
    );
  `);
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'db', 'schema', '038_auditoria_empresa_append_only.sql'),
    'utf8'
  );
  bd.exec(sql);

  bd.prepare(`
    INSERT INTO gh_firma_empresas_auditoria
      (id_empresa, fecha_hora, id_actor, campo, valor_anterior, valor_nuevo)
    VALUES ('900123456', '2026-10-23T00:00:00.000Z', 'test', 'canal_pqrs', 'a', 'b')
  `).run();

  assert.throws(
    () => bd.prepare(
      'UPDATE gh_firma_empresas_auditoria SET motivo = ? WHERE id = 1'
    ).run('otro motivo'),
    /append-only/,
    'no se puede alterar el rastro'
  );
  assert.throws(
    () => bd.prepare('DELETE FROM gh_firma_empresas_auditoria').run(),
    /append-only/,
    'no se puede borrar el rastro'
  );

  const fila = bd.prepare('SELECT * FROM gh_firma_empresas_auditoria').get();
  assert.equal(fila.campo, 'canal_pqrs');
  assert.equal(fila.motivo, null, 'el renglon quedo como estaba');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El endpoint responde "de donde salio este canal"
// ─────────────────────────────────────────────────────────────────────────────

test('rastro · el endpoint admin devuelve el historial de la ficha', async () => {
  limpiar();
  registrarEmpresa();
  const app = makeApp();

  await request(app)
    .put(`/internal/admin/empresas/${EMPRESA}`)
    .set('X-Admin-API-Key', ADMIN_KEY)
    .set('X-Admin-Actor', 'el operador')
    .set('X-Admin-Motivo', 'la Empresa cambio de canal')
    .send(Object.assign({}, FICHA_BASE, { canal_pqrs: 'nuevo@example.com' }))
    .expect(200);

  const res = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial`)
    .set('X-Admin-API-Key', ADMIN_KEY)
    .expect(200);

  assert.equal(res.body.items.length, 1);
  const item = res.body.items[0];
  assert.equal(item.campo, 'canal_pqrs');
  assert.equal(item.valor_anterior, 'pqrs@example.com');
  assert.equal(item.valor_nuevo, 'nuevo@example.com');
  assert.equal(item.id_actor, 'el operador');
  assert.equal(item.motivo, 'la Empresa cambio de canal');
});

test('rastro · el endpoint admin exige la API key', async () => {
  limpiar();
  registrarEmpresa();
  const app = makeApp();

  await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial`)
    .expect(401);
});

test('rastro · el endpoint admin valida el limite', async () => {
  limpiar();
  registrarEmpresa();
  const app = makeApp();

  await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial?limite=0`)
    .set('X-Admin-API-Key', ADMIN_KEY)
    .expect(400);
  await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial?limite=abc`)
    .set('X-Admin-API-Key', ADMIN_KEY)
    .expect(400);
});

test('rastro · el historial sale del mas reciente al mas antiguo', async () => {
  limpiar();
  registrarEmpresa();
  const app = makeApp();

  for (const canal of ['uno@example.com', 'dos@example.com', 'tres@example.com']) {
    await request(app)
      .put(`/internal/admin/empresas/${EMPRESA}`)
      .set('X-Admin-API-Key', ADMIN_KEY)
      .send(Object.assign({}, FICHA_BASE, { canal_pqrs: canal }))
      .expect(200);
  }

  const res = await request(app)
    .get(`/internal/admin/empresas/${EMPRESA}/historial`)
    .set('X-Admin-API-Key', ADMIN_KEY)
    .expect(200);

  assert.equal(res.body.items.length, 3);
  assert.equal(res.body.items[0].valor_nuevo, 'tres@example.com');
  assert.equal(res.body.items[2].valor_nuevo, 'uno@example.com');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. No se rompe nada: la lista de campos trazados es la de la ficha
// ─────────────────────────────────────────────────────────────────────────────

test('rastro · la lista de campos trazados cubre toda la ficha editable', () => {
  // Si `empresa.js` agrega un campo editable y nadie lo agrega a la lista del
  // rastro, ese cambio queda INVISIBLE: que es exactamente el bug que el
  // abogado quiere cerrar. Este test es la red que lo avisa.
  const editables = new Set(empresaService.EDITABLE_FIELDS);
  const trazables = new Set(auditoriaService.CAMPOS_TRAZABLES);
  for (const campo of editables) {
    assert.ok(trazables.has(campo), `el campo ${campo} no esta en CAMPOS_TRAZABLES`);
  }
  // Y los campos que el service escribe aparte (no son editables pero
  // tampoco pueden quedar fuera del rastro).
  for (const campo of [
    'plazo_retencion_dias', 'norma_conservacion',
    'conservacion_por_deber_legal', 'dominios_corporativos',
  ]) {
    assert.ok(trazables.has(campo), `el campo ${campo} no esta en CAMPOS_TRAZABLES`);
  }
});

test('rastro · la ficha de la Empresa se lee igual con el rastro puesto', () => {
  // El rastro NO puede alterar lo que ve el firmante: el snapshot y la fila
  // se calculan igual que antes.
  limpiar();
  registrarEmpresa();

  const antes = empresaService.buildSnapshot(EMPRESA);
  empresaService.update(EMPRESA, Object.assign({}, FICHA_BASE, {
    domicilio: 'Medellín, Antioquia',
  }));
  const despues = empresaService.buildSnapshot(EMPRESA);

  assert.notEqual(antes.huella, despues.huella,
    'cambiar un campo SI cambia la huella (el firmante ve lo nuevo)');
  assert.equal(despues.datos.domicilio, 'Medellín, Antioquia');
  assert.equal(despues.datos.canal_pqrs, 'pqrs@example.com',
    'los demas campos quedan igual');
});
