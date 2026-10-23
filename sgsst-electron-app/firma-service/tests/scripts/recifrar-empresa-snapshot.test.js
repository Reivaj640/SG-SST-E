/**
 * Tests del backfill de `gh_consentimientos_firma.empresa_snapshot` (8B-C).
 *
 * Simulan filas históricas: se crea un consentimiento con el código nuevo y
 * después se reemplaza su snapshot por el JSON en claro que existía antes de
 * 8B-C. Lo que se prueba es que el script:
 *
 *   - no escribe sin `--ejecutar`;
 *   - exige backup antes de escribir;
 *   - conserva `empresa_hash` y lo verifica;
 *   - no toca una fila con huella inconsistente o snapshot ilegible;
 *   - es idempotente;
 *   - deja un recibo sin el número completo.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const { sha256 } = require('../../src/crypto/hash');
const { esCifrado } = require('../../src/crypto/cifrado');
const { resetDb, createAcceptedConsent } = require('../helpers');
const { main, parseArgs } = require('../../scripts/recifrar-empresa-snapshot');

const EMPRESA = '900123456';
const TRABAJADOR = '1234567890';
const NUMERO = '79123456';
const ULTIMOS = '3456';

const EMPRESA_DATOS = {
  id_empresa: EMPRESA,
  razon_social: 'Empresa de Prueba S.A.S.',
  nit: EMPRESA,
  domicilio: 'Bogotá D.C.',
  representante_legal: 'Javier Robles',
  representante_legal_identificacion: NUMERO,
  responsable_tratamiento: 'Javier Robles',
  responsable_tratamiento_correo: 'privacidad@example.com',
  canal_pqrs: 'pqrs@example.com',
  canal_incidentes: 'seguridad@example.com',
  politica_datos_url: 'https://example.com/privacidad',
  plazo_retencion: '5 años',
  canal_solicitud_copia: 'privacidad@example.com',
  plazo_retencion_dias: 1825,
};

let tmp;
let consentId;
let snapshotClaro;
let huella;

async function sembrarFilaHistorica() {
  resetDb();
  db.prepare('DELETE FROM gh_firma_empresas').run();
  empresaService.create(EMPRESA_DATOS);
  // D-03 (decisión B.3): la creación del consentimiento exige que la Empresa
  // esté habilitada. Este archivo prueba el BACKFILL del snapshot, no el
  // D-03: la empresa de prueba se habilita para que el bloqueo no se
  // confunda con lo que se prueba.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');

  const { consent_id } = await createAcceptedConsent({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
  });
  consentId = consent_id;

  // La fila que existía antes de 8B-C: snapshot en claro y huella canónica.
  const snap = empresaService.buildSnapshot(EMPRESA);
  snapshotClaro = snap.texto;
  huella = snap.huella;
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET empresa_snapshot = ?, empresa_hash = ?
    WHERE id = ?
  `).run(snapshotClaro, huella, consentId);
}

function fila() {
  return db.prepare(`
    SELECT empresa_snapshot, empresa_hash
    FROM gh_consentimientos_firma
    WHERE id = ?
  `).get(consentId);
}

function args(extra = []) {
  return [
    '--actor=test-8bc',
    '--motivo=prueba de backfill',
    '--empresa=' + EMPRESA,
    '--recibo=' + path.join(tmp, 'recibo.json'),
    ...extra,
  ];
}

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), '8bc-backfill-'));
  await sembrarFilaHistorica();
});

afterEach(() => {
  // `resetDb()` no limpia `gh_firma_empresas` (es una tabla de configuración,
  // no de transacciones). Si esta prueba deja la empresa sembrada, el
  // siguiente archivo que corra en el mismo `data/test.sqlite` ve un contexto
  // público con representante y puede fallar por contaminación. Se limpia acá.
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (_) { /* tabla ausente */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('8B-C backfill · sin --ejecutar no escribe y deja recibo de simulación', () => {
  const rc = main(args());
  assert.equal(rc, 0);

  const guardada = fila();
  assert.equal(guardada.empresa_snapshot, snapshotClaro);
  assert.equal(guardada.empresa_hash, huella);

  const recibo = JSON.parse(fs.readFileSync(path.join(tmp, 'recibo.json'), 'utf8'));
  assert.equal(recibo.ejecutar, false);
  assert.equal(recibo.simuladas, 1);
  assert.equal(recibo.recifradas, 0);
  assert.equal(recibo.filas[0].estado, 'simulada');
  assert.equal(JSON.stringify(recibo).includes(NUMERO), false);
});

test('8B-C backfill · con --ejecutar cifra, conserva la huella y deja recibo', () => {
  const backup = path.join(tmp, 'backup.sqlite');
  fs.writeFileSync(backup, 'copia de prueba');

  const rc = main(args(['--ejecutar', '--backup=' + backup]));
  assert.equal(rc, 0);

  const guardada = fila();
  assert.equal(guardada.empresa_hash, huella, 'la huella no se toca');
  assert.equal(guardada.empresa_snapshot.includes(NUMERO), false);

  const snap = JSON.parse(guardada.empresa_snapshot);
  assert.equal(esCifrado(snap.representante_legal_identificacion), true);
  assert.equal(snap.representante_legal_identificacion_ultimos4, ULTIMOS);

  const mostrado = empresaService.parseSnapshotParaMostrar(
    guardada.empresa_snapshot,
    EMPRESA
  );
  assert.equal(mostrado.representante_legal_identificacion, '****' + ULTIMOS);

  const recibo = JSON.parse(fs.readFileSync(path.join(tmp, 'recibo.json'), 'utf8'));
  assert.equal(recibo.ejecutar, true);
  assert.equal(recibo.recifradas, 1);
  assert.equal(recibo.errores, 0);
  assert.equal(recibo.filas[0].estado, 'recifrada');
  assert.equal(JSON.stringify(recibo).includes(NUMERO), false);
});

test('8B-C backfill · D-14 · el re-cifrado queda como evento en la base', () => {
  const backup = path.join(tmp, 'backup.sqlite');
  fs.writeFileSync(backup, 'copia de prueba');

  const rc = main(args(['--ejecutar', '--backup=' + backup]));
  assert.equal(rc, 0);

  const eventos = db.prepare(`
    SELECT * FROM gh_consentimientos_eventos
    WHERE consent_id = ? AND evento = 'CONSENT_SNAPSHOT_RECIFRADO'
    ORDER BY id
  `).all(consentId);

  assert.equal(eventos.length, 1, 'un evento por fila re-cifrada');
  const ev = eventos[0];
  assert.equal(ev.consent_id, consentId);
  assert.equal(ev.id_actor, 'test-8bc', 'el evento dice QUIÉN lo hizo');
  assert.ok(ev.fecha_hora, 'el evento dice CUÁNDO');

  const meta = JSON.parse(ev.metadata);
  assert.equal(meta.motivo, 'prueba de backfill');
  assert.equal(meta.empresa_hash, huella, 'la huella del JSON en claro no cambia');
  assert.equal(meta.version_llave, 'k1', 'el evento dice con qué llave quedó el sobre');
  assert.equal(meta.script, 'recifrar-empresa-snapshot');

  // El evento NO lleva el número del representante: ni en claro ni de forma
  // que se pueda recuperar.
  assert.equal(ev.metadata.includes(NUMERO), false);
  assert.equal(ev.metadata.includes(ULTIMOS), false);
});

test('8B-C backfill · una fila histórica de 11 campos se cifra sin tocar la huella', () => {
  const actual = empresaService.buildSnapshot(EMPRESA).datos;
  const historico = {};
  for (const campo of empresaService.SNAPSHOT_FIELDS.slice(0, 11)) {
    historico[campo] = actual[campo];
  }
  const texto = JSON.stringify(historico);
  const hashHistorico = sha256(texto);
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET empresa_snapshot = ?, empresa_hash = ?
    WHERE id = ?
  `).run(texto, hashHistorico, consentId);

  const backup = path.join(tmp, 'backup.sqlite');
  fs.writeFileSync(backup, 'copia de prueba');
  const rc = main(args(['--ejecutar', '--backup=' + backup]));
  assert.equal(rc, 0);

  const guardada = fila();
  assert.equal(guardada.empresa_hash, hashHistorico,
    'la huella histórica tiene que quedar intacta');
  const snap = JSON.parse(guardada.empresa_snapshot);
  assert.equal(esCifrado(snap.representante_legal_identificacion), true);
  assert.equal('plazo_retencion' in snap, false,
    'no se pueden inventar campos que el snapshot histórico no tenía');
  assert.equal('canal_solicitud_copia' in snap, false);

  const abierto = empresaService.descifrarSnapshotEmpresa(snap, EMPRESA);
  assert.equal(abierto.representante_legal_identificacion, NUMERO);
  assert.equal(empresaService.hashSnapshotEmpresa(abierto), hashHistorico);
});

test('8B-C backfill · un sobre de otra Empresa no se salta como "ya cifrado"', () => {
  const otro = '900999999';
  const cifrado = empresaService.cifrarSnapshotEmpresa(
    empresaService.buildSnapshot(EMPRESA).datos,
    otro
  );
  db.prepare(`
    UPDATE gh_consentimientos_firma
    SET empresa_snapshot = ?, empresa_hash = ?
    WHERE id = ?
  `).run(JSON.stringify(cifrado), huella, consentId);

  const rc = main(args());
  assert.equal(rc, 3);

  const recibo = JSON.parse(fs.readFileSync(path.join(tmp, 'recibo.json'), 'utf8'));
  assert.equal(recibo.errores, 1);
  assert.match(recibo.filas[0].problema, /no se abre|huella/i);
});

test('8B-C backfill · es idempotente: la segunda pasada no toca la fila cifrada', () => {
  const backup = path.join(tmp, 'backup.sqlite');
  fs.writeFileSync(backup, 'copia de prueba');

  assert.equal(main(args(['--ejecutar', '--backup=' + backup])), 0);
  const primera = fila();

  const recibo2 = path.join(tmp, 'recibo2.json');
  const rc = main([
    '--actor=test-8bc',
    '--motivo=segunda pasada',
    '--empresa=' + EMPRESA,
    '--recibo=' + recibo2,
    '--ejecutar',
    '--backup=' + backup,
  ]);
  assert.equal(rc, 0);
  assert.deepEqual(fila(), primera, 'la fila ya cifrada no se vuelve a cifrar');

  const recibo = JSON.parse(fs.readFileSync(recibo2, 'utf8'));
  assert.equal(recibo.omitidas, 1);
  assert.equal(recibo.recifradas, 0);
  assert.equal(recibo.filas[0].problema, 'ya está cifrado y verifica');
});

test('8B-C backfill · una huella inconsistente no se toca', () => {
  db.prepare('UPDATE gh_consentimientos_firma SET empresa_hash = ? WHERE id = ?')
    .run('00'.repeat(32), consentId);
  const backup = path.join(tmp, 'backup.sqlite');
  fs.writeFileSync(backup, 'copia de prueba');

  const rc = main(args(['--ejecutar', '--backup=' + backup]));
  assert.equal(rc, 3);

  const guardada = fila();
  assert.equal(guardada.empresa_snapshot, snapshotClaro, 'la fila original queda intacta');
  assert.equal(guardada.empresa_hash, '00'.repeat(32));

  const recibo = JSON.parse(fs.readFileSync(path.join(tmp, 'recibo.json'), 'utf8'));
  assert.equal(recibo.errores, 1);
  assert.match(recibo.filas[0].problema, /huella/i);
});

test('8B-C backfill · un snapshot ilegible no se toca', () => {
  db.prepare('UPDATE gh_consentimientos_firma SET empresa_snapshot = ? WHERE id = ?')
    .run('{no es json', consentId);

  const rc = main(args());
  assert.equal(rc, 3);

  const guardada = fila();
  assert.equal(guardada.empresa_snapshot, '{no es json');

  const recibo = JSON.parse(fs.readFileSync(path.join(tmp, 'recibo.json'), 'utf8'));
  assert.equal(recibo.errores, 1);
  assert.match(recibo.filas[0].problema, /ilegible/i);
});

test('8B-C backfill · --ejecutar sin --backup se rechaza antes de tocar la base', () => {
  assert.throws(
    () => parseArgs(['--actor=a', '--motivo=m', '--ejecutar']),
    /backup/i
  );

  const rc = main([
    '--actor=a',
    '--motivo=m',
    '--recibo=' + path.join(tmp, 'recibo.json'),
    '--ejecutar',
  ]);
  assert.equal(rc, 2);
  assert.equal(fila().empresa_snapshot, snapshotClaro);
});
