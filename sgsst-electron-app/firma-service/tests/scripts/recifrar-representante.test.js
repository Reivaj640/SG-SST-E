/**
 * tests/scripts/recifrar-representante.test.js
 *
 * Tests del script que re-cifra el número del representante legal en las filas
 * que lo guardaron en claro (8B / H23).
 *
 * Lo que se comprueba:
 *
 *   1. Sin `--ejecutar` NO se escribe nada (simulación).
 *   2. Con `--ejecutar`, la fila queda cifrada y el número sigue ahí.
 *   3. Cada fila re-cifrada deja su evento (traza).
 *   4. Una fila ya cifrada NO se toca (no se cifra dos veces).
 *   5. El número no se imprime en la salida.
 *   6. Sin `--actor` o sin `--motivo` el script no corre.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const helpers = require('../helpers');
const db = require('../../src/db/connection');
const representanteService = require('../../src/services/representante');
const script = require('../../scripts/recifrar-representante');

const NUMERO = '79123456';
const EMPRESA = '900123456';
const TRABAJADOR = '1234567890';

const SNAPSHOT = {
  nombre: 'Javier Robles',
  cargo: 'Representante Legal',
  tipo_identificacion: 'CC',
  numero_identificacion: NUMERO,
  correo: 'rep@empresa.com',
};

const originalArgv = process.argv;
const originalWrite = process.stdout.write;

/**
 * Corre el script con los argumentos dados y captura lo que imprime.
 */
function runScript(args) {
  process.argv = ['node', 'recifrar-representante.js', ...args];
  let captured = '';
  process.stdout.write = (chunk) => { captured += String(chunk); return true; };
  let code;
  try {
    code = script.main();
  } finally {
    process.stdout.write = originalWrite;
    process.argv = originalArgv;
  }
  return { code, output: captured };
}

/**
 * Crea una fila de firma y la deja como una fila HEREDADA: con el snapshot
 * del representante en texto claro.
 *
 * Ojo: `createSignRequestWithIdentificacion` ya cifra el snapshot (8B), así
 * que una fila creada por ahí NO es candidata. Para probar el script hay que
 * escribir el snapshot en claro, que es exactamente lo que quedó en las
 * bases antes de la 8B.
 */
async function crearFila(snapshot) {
  const { signRequest } = await helpers.createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: snapshot,
  });
  db.prepare(
    'UPDATE gh_firmas_electronicas SET representante_legal_snapshot = ? WHERE id = ?'
  ).run(JSON.stringify(snapshot), signRequest.id);
  return signRequest.id_solicitud;
}

function snapshotEnClaroDe(idSolicitud) {
  const fila = db.prepare(
    'SELECT representante_legal_snapshot FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(idSolicitud);
  return fila && fila.representante_legal_snapshot
    ? JSON.parse(fila.representante_legal_snapshot)
    : null;
}

beforeEach(() => {
  helpers.resetDb();
  helpers.seedActiveAgreement();
});

afterEach(() => {
  process.stdout.write = originalWrite;
  process.argv = originalArgv;
});

test('8B · el script sin --ejecutar NO escribe nada', async () => {
  const id1 = await crearFila({ ...SNAPSHOT });

  const res = runScript(['--actor=Tester', '--motivo=prueba']);

  assert.equal(res.code, 0);
  assert.ok(res.output.includes('SIMULACION'), 'tiene que decir que fue una simulación');
  const snap = snapshotEnClaroDe(id1);
  assert.equal(snap.numero_identificacion, NUMERO,
    'sin --ejecutar la fila tiene que quedar como estaba');
});

test('8B · el script con --ejecutar re-cifra la fila y el número sigue ahí', async () => {
  const id2 = await crearFila({ ...SNAPSHOT });

  const res = runScript(['--actor=Tester', '--motivo=prueba', '--ejecutar']);

  assert.equal(res.code, 0);
  const snap = snapshotEnClaroDe(id2);
  assert.equal(representanteService.esCifrado(snap.numero_identificacion), true,
    'el número tiene que quedar cifrado');
  assert.equal(snap.numero_identificacion_ultimos4, '3456');
  assert.equal(
    representanteService.numeroEnClaro(snap, EMPRESA),
    NUMERO,
    'el número tiene que seguir siendo el mismo cuando se abre'
  );
  // Lo demás del snapshot no se toca.
  assert.equal(snap.nombre, SNAPSHOT.nombre);
  assert.equal(snap.correo, SNAPSHOT.correo);
});

test('8B · cada fila re-cifrada deja su evento de traza', async () => {
  await crearFila({ ...SNAPSHOT });

  runScript(['--actor=Tester', '--motivo=prueba', '--ejecutar']);

  const eventos = db.prepare(
    "SELECT evento, id_actor, metadata FROM gh_firma_eventos WHERE evento = 'REPRESENTANTE_RECIFRADO'"
  ).all();
  assert.equal(eventos.length, 1, 'tiene que quedar un evento por fila re-cifrada');
  assert.equal(eventos[0].id_actor, 'Tester');
  assert.ok(eventos[0].metadata.includes('prueba'), 'el motivo queda en la traza');
});

test('8B · una fila YA cifrada no se toca (no se cifra dos veces)', async () => {
  const id4 = await crearFila({ ...SNAPSHOT });
  // Se re-cifra primero.
  runScript(['--actor=Tester', '--motivo=prueba', '--ejecutar']);
  const antes = snapshotEnClaroDe(id4).numero_identificacion;

  // Se corre de nuevo: no debe haber nada que hacer.
  const res = runScript(['--actor=Tester', '--motivo=prueba', '--ejecutar']);

  assert.equal(res.code, 0);
  assert.ok(res.output.includes('Nada que hacer'),
    'una fila ya cifrada no es candidata: ' + res.output);
  const despues = snapshotEnClaroDe(id4).numero_identificacion;
  assert.equal(despues, antes, 'el sobre no puede cambiar');
});

test('8B · el script NO imprime el número del representante', async () => {
  await crearFila({ ...SNAPSHOT });

  const res = runScript(['--actor=Tester', '--motivo=prueba', '--ejecutar']);

  assert.equal(res.output.includes(NUMERO), false,
    'la salida del script no puede contener el número en claro: ' + res.output);
  assert.ok(res.output.includes('****3456'), 'muestra el final, que es lo permitido');
});

test('8B · sin --actor o sin --motivo el script no corre', () => {
  const sinActor = runScript(['--motivo=prueba']);
  assert.equal(sinActor.code, 2);

  const sinMotivo = runScript(['--actor=Tester']);
  assert.equal(sinMotivo.code, 2);
});
