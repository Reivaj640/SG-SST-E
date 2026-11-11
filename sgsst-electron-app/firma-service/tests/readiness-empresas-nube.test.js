/**
 * Readiness · el Anexo de Nube de las empresas activas.
 *
 * POR QUE EXISTE ESTE ARCHIVO
 * ---------------------------
 * El item `empresas_nube` de la compuerta de primera firma confundia dos
 * cosas distintas:
 *
 *   - las Empresas que suscribieron el texto VIGENTE, y
 *   - las Empresas que suscribieron el texto vigente y NO tienen la
 *     contrafirma de K+AIR.
 *
 * El mensaje usaba el primer conteo para afirmar lo segundo. El caso real es
 * el del 11-nov-2026, en la copia de prueba: una Empresa con el Anexo de
 * Nube v1.3 suscrito Y contrafirmado, y otra con la v1.1 (un texto que ya
 * no era el vigente). El gate decia "1 empresa(s) tienen el Anexo de Nube del
 * texto vigente (v1.3) suscrito, pero sin la contrafirma de K+AIR": le echaba
 * la culpa a la que SI estaba contrafirmada y escondia a la que tenia el
 * texto viejo. El operador iba a contrafirmar un instrumento que ya estaba
 * ejecutado, y la Empresa que de verdad necesitaba volver a suscribir
 * (la del texto viejo) no aparecia en el mensaje.
 *
 * Un control que senala a la empresa equivocada no es un control que se pueda
 * usar: es peor que no senalar a ninguna.
 *
 * LA REGLA QUE SE FIJA ACA
 * -------------------------
 * El conteo de "suscritas y sin contrafirma" es PROPIO y no una resta: son las
 * Empresas con la huella del texto vigente, con fecha de suscripcion y SIN
 * fecha de ejecucion. Y la accion que el gate propone depende del caso real:
 * contrafirmar lo que ya esta suscrito, o suscribir lo que no lo esta.
 *
 * Los datos son sinteticos.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const db = require('../src/db/connection');
const empresaService = require('../src/services/empresa');
const readiness = require('../src/services/readinessLegal');
const { resetDb } = require('./helpers');

// La huella de un texto que NO es el vigente. La de la v1.1 de ASEPLUS: es la
// que tiene la Empresa que quedo con el texto viejo.
const HASH_VIEJO = 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482';

const TEXTOS = {
  acuerdoV11: 'Versión del Acuerdo: v1.1',
  anexoNube: 'Anexo de Nube.',
  anexoEncargo: 'Anexo de Nube. Cláusula de otrosí.',
};

// La huella del TEXTO VIGENTE: la que el gate calcula sobre el texto que
// inyecta. La ficha tiene que declararla para que la Empresa cuente como
// suscrita del texto vigente.
const HASH_VIGENTE = crypto.createHash('sha256')
  .update(TEXTOS.anexoNube, 'utf8')
  .digest('hex');

const CONFIG_TEST = {
  env: 'test',
  canalProteccionDatos: 'privacidad@example.com',
  canalIncidentes: 'seguridad@example.com',
  plazoTramiteDias: 2,
  exigirMedioPersonalOtp: false,
  exigirAnexoNube: true,
};

/**
 * Crea una empresa y le deja el estado del Anexo de Nube que se le pida.
 *
 * @param {string} id
 * @param {object} estado
 * @param {string} estado.hash la huella que declara la ficha
 * @param {boolean} estado.suscrita si tiene fecha de suscripcion
 * @param {boolean} estado.ejecutada si tiene fecha de ejecucion (contrafirma)
 */
function crearEmpresa(id, estado) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(id);
  empresaService.create({
    id_empresa: id,
    razon_social: 'Empresa ' + id + ' S.A.S.',
    nit: id,
    canal_pqrs: 'pqrs+' + id + '@empresa-prueba.test',
  });
  db.prepare(`
    UPDATE gh_firma_empresas
       SET anexo_nube_firmado_at = ?, anexo_nube_hash = ?, anexo_nube_ejecutado_at = ?
     WHERE id_empresa = ?
  `).run(
    estado.suscrita ? '2026-11-11T22:21:51.046Z' : null,
    estado.hash,
    estado.ejecutada ? '2026-11-11T22:35:11.340Z' : null,
    id,
  );
}

function evaluar() {
  return readiness.evaluar({
    gate: 'primera_firma',
    db,
    config: CONFIG_TEST,
    manifiesto: { version: 'test' },
    textos: TEXTOS,
  });
}

function item(reporte, id) {
  const todos = (reporte.grupos || []).flatMap((g) => g.items);
  return todos.find((i) => i.id === id);
}

test('readiness · una empresa SUSCRITA Y CONTRAFIRMADA del texto vigente NO aparece como "sin la contrafirma"', () => {
  resetDb();
  // La empresa con el texto VIGENTE, suscrito y contrafirmado.
  crearEmpresa('900000001', { hash: HASH_VIGENTE, suscrita: true, ejecutada: true });
  // La empresa que quedo con el texto VIEJO: ni suscrita del vigente ni
  // contrafirmada.
  crearEmpresa('900829731', { hash: HASH_VIEJO, suscrita: true, ejecutada: false });

  const r = evaluar();
  const i = item(r, 'empresas_nube');

  assert.equal(r.db.empresas.total, 2);
  assert.equal(r.db.empresas.con_anexo_nube_suscrito_vigente, 1,
    'solo una empresa suscribio el texto vigente');
  assert.equal(r.db.empresas.con_anexo_nube_vigente, 1,
    'y esa misma es la que esta contrafirmada');
  assert.equal(r.db.empresas.con_anexo_nube_suscrito_sin_contrafirma, 0,
    'NINGUNA empresa suscrita del texto vigente esta sin contrafirma');

  assert.equal(i.estado, readiness.ESTADOS.PENDIENTE,
    'el item sigue pendiente: no todas las empresas tienen el texto vigente');
  assert.doesNotMatch(i.detalle, /sin la contrafirma/,
    'el mensaje no puede acusar a la empresa que SI esta contrafirmada');
  assert.match(i.detalle, /1 empresa\(s\)/,
    'el mensaje nombra a la una empresa que de verdad falta');
  assert.match(i.detalle, /no tienen el Anexo de Nube del texto vigente/,
    'la que falta es la que tiene el texto viejo');
});

test('readiness · una empresa suscrita del texto vigente SIN contrafirmar se nombra a si misma', () => {
  resetDb();
  crearEmpresa('900000001', { hash: HASH_VIGENTE, suscrita: true, ejecutada: false });

  const r = evaluar();
  const i = item(r, 'empresas_nube');

  assert.equal(r.db.empresas.con_anexo_nube_suscrito_sin_contrafirma, 1,
    'esta empresa si esta pendiente del segundo acto');
  assert.equal(i.estado, readiness.ESTADOS.PENDIENTE);
  assert.match(i.detalle, /sin la contrafirma de K\+AIR/,
    'el mensaje dice que falta el segundo acto');
  assert.match(i.accion, /contrafirma/,
    'la accion dice contrafirmar, no volver a suscribir: el primer acto ya esta');
});

test('readiness · una empresa suscrita y contrafirmada del texto vigente NO bloquea', () => {
  resetDb();
  crearEmpresa('900000001', { hash: HASH_VIGENTE, suscrita: true, ejecutada: true });

  const r = evaluar();
  const i = item(r, 'empresas_nube');

  assert.equal(r.db.empresas.con_anexo_nube_suscrito_sin_contrafirma, 0);
  assert.equal(i.estado, readiness.ESTADOS.OK,
    'el instrumento esta EJECUTADO: suscrito y contrafirmado');
  assert.match(i.detalle, /EJECUTADO/);
});

test('readiness · sin exigir el Anexo de Nube, el item es un aviso y no bloquea', () => {
  resetDb();
  crearEmpresa('900000001', { hash: HASH_VIGENTE, suscrita: true, ejecutada: false });

  const r = readiness.evaluar({
    gate: 'primera_firma',
    db,
    config: Object.assign({}, CONFIG_TEST, { exigirAnexoNube: false }),
    manifiesto: { version: 'test' },
    textos: TEXTOS,
  });
  const i = item(r, 'empresas_nube');

  assert.equal(i.estado, readiness.ESTADOS.AVISO);
  assert.deepEqual(i.bloquea, [],
    'en un ambiente que no lo exige, el item no bloquea');
});
