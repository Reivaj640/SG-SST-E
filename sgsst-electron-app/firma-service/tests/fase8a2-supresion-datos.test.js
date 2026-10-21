/**
 * Tests de la Fase 8A.2 — la supresión de datos (la "5B").
 *
 * EL DEFECTO QUE ESTA FASE CORRIGE
 * --------------------------------
 * La capa de conservación (migración 020) borraba el REGISTRO DE AUDITORÍA de
 * las firmas vencidas. Eso destruye la prueba y conserva el dato: exactamente
 * lo contrario de lo que ordenan el 8.6 y el 10.6 del Acuerdo ("Vencido ese
 * plazo y sin que exista un deber legal o contractual de conservación, el dato
 * se suprime"). El propio script lo decía en voz alta: "HASTA QUE EXISTA LA
 * 5B, ESTA OPERACIÓN NO CUMPLE EL 8.6".
 *
 * AHORA
 * -----
 * La capa de datos suprime la fila completa de la firma y los archivos que la
 * acompañaban, dentro del mismo gobierno de ventana y lote, y deja una LÁPIDA
 * por firma para que un enlace ya suprimido responda "no disponible por
 * vencimiento del plazo" en vez de un 404 que no dice por qué.
 *
 * Cubre:
 * - La simulación NO borra nada (ni la fila ni los archivos).
 * - La supresión real borra la fila y los archivos.
 * - La supresión es idempotente: correrla dos veces no rompe nada.
 * - La supresión EXIGE actor y motivo.
 * - La supresión exige ventana abierta y lote armado.
 * - Una firma con hold legal NO se suprime.
 * - La lápida NO guarda la credencial (guarda un HMAC con otro propósito).
 * - La lápida NO tiene datos personales.
 * - La lápida es append-only.
 * - Un enlace suprimido responde CONSERVACION_VENCIDA, no TOKEN_NOT_FOUND.
 * - La PRUEBA DE LA ACEPTACIÓN sobrevive a la supresión (12.7) y ya lleva el
 *   identificador de la solicitud.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const request = require('supertest');
const db = require('../src/db/connection');
const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');
const { hashToken, hashTokenHmac } = require('../src/crypto/token');
const {
  resetDb, makeApp, createSignRequestWithIdentificacion,
} = require('./helpers');

const HORA = 3600 * 1000;

// El ARCHIVO REAL de la migración 025 (los triggers append-only de la lápida).
// La migración lleva `@skip-when-env test`, así que en la BD compartida de
// tests no se aplica: el comportamiento del trigger se prueba contra el
// archivo, en una base aislada. Mismo mecanismo y misma razón que la 020.
const SQL_025 = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'db', 'schema', '025_purga_datos_append_only.sql'),
  'utf8'
);

/**
 * Crea una firma vencida y lista para suprimirse.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.hold] - deber legal de conservación
 * @param {boolean} [opts.conArchivos] - crear los archivos en disco
 */
async function setupVencida({ hold = false, conArchivos = true } = {}) {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
  });

  const storage = require('../src/services/storage');
  const paths = [];
  if (conArchivos) {
    for (const nombre of ['original', 'firmado', 'constancia']) {
      const p = storage.PATHS.pdfs + '/test-supresion-' + nombre + '-' + signRequest.id + '.pdf';
      fs.mkdirSync(require('node:path').dirname(p), { recursive: true });
      fs.writeFileSync(p, '%PDF-1.4\n%%EOF\n');
      paths.push(p);
    }
  }

  const ahora = Date.now();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?,
           hold_legal = ?,
           motivo_hold = ?,
           pdf_original_path = ?,
           pdf_firmado_path = ?,
           constancia_path = ?
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    new Date(ahora - 24 * HORA).toISOString(), // vencida ayer
    new Date(ahora + 48 * HORA).toISOString(),
    hold ? 1 : 0,
    hold ? 'Reclamación en curso' : null,
    paths[0] || null,
    paths[1] || null,
    paths[2] || null,
    signRequest.id
  );

  return { token, signRequest, paths };
}

/**
 * Abre la ventana y arma el lote: el gobierno que la supresión exige.
 */
function abrirYLotear(actor = 'test') {
  conservacion.abrirVentana({ actor, motivo: 'Vencimiento del plazo declarado', minutos: 15 });
  return conservacion.armarLote({ actor, motivo: 'Vencimiento del plazo declarado' });
}

/**
 * Abre una BD aislada con la tabla de la lápida y aplica el ARCHIVO REAL de
 * la migración 025 (los triggers, con su nombre real).
 */
function abrirBdAislada() {
  const ruta = path.join(
    os.tmpdir(),
    'kair-lapida-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.sqlite'
  );
  const bd = new Database(ruta);
  bd.exec(`
    CREATE TABLE gh_firma_purgadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firma_id INTEGER NOT NULL,
      token_tombstone TEXT NOT NULL,
      id_empresa TEXT,
      purgado_at TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT NOT NULL,
      motivo TEXT NOT NULL,
      categorias TEXT NOT NULL,
      archivos_eliminados INTEGER NOT NULL DEFAULT 0
    );
  `);
  return { bd, ruta };
}

/**
 * Inserta una lápida en la BD aislada.
 */
function sembrarLapidaAislada(bd, id = 1) {
  bd.prepare(`
    INSERT INTO gh_firma_purgadas
      (firma_id, token_tombstone, id_empresa, actor, motivo, categorias)
    VALUES (?, 'tombstone-de-prueba', '900123456', 'test', 'Vencimiento del plazo declarado', 'datos_personales')
  `).run(id);
}

// =========================================================================
// 1. La simulación no borra nada
// =========================================================================

test('8A.2 · la simulación no borra ni la fila ni los archivos', async () => {
  resetDb();
  const { signRequest, paths } = await setupVencida();
  abrirYLotear();

  const sim = supresion.simular();

  assert.equal(sim.simulacion, true);
  assert.equal(sim.firmas, 1);
  assert.equal(sim.archivos, 3);

  // La fila sigue ahí y los archivos también.
  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.ok(fila, 'la simulación no puede borrar la fila');
  for (const p of paths) {
    assert.ok(fs.existsSync(p), 'la simulación no puede borrar los archivos');
  }
  // Y no se escribió ninguna lápida.
  const lapidas = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purgadas').get();
  assert.equal(lapidas.n, 0);
});

// =========================================================================
// 2. La supresión real
// =========================================================================

test('8A.2 · la supresión real borra la fila y los archivos', async () => {
  resetDb();
  const { token, signRequest, paths } = await setupVencida();
  abrirYLotear();

  const r = supresion.suprimir({
    actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false,
  });

  assert.equal(r.simulacion, false);
  assert.equal(r.firmas, 1);
  assert.equal(r.archivos, 3);

  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(fila, undefined, 'la fila de la firma debe estar suprimida');
  for (const p of paths) {
    assert.equal(fs.existsSync(p), false, 'los archivos deben estar suprimidos');
  }

  // El enlace ya no resuelve a una firma...
  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
});

test('8A.2 · la supresión es idempotente', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  abrirYLotear();

  const r1 = supresion.suprimir({
    actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false,
  });
  assert.equal(r1.firmas, 1);

  // La segunda pasada: la ventana ya se cerró y el lote está vacío, así que
  // el servicio dice que no hay nada. Y si se reintentara con ventana nueva,
  // la fila ya no está y no se escribe una segunda lápida.
  const lapidas = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purgadas').get();
  assert.equal(lapidas.n, 1);

  conservacion.abrirVentana({ actor: 'test', motivo: 'reintento', minutos: 15 });
  const lote = conservacion.armarLote({ actor: 'test', motivo: 'reintento' });
  assert.equal(lote.firmas, 0, 'la fila suprimida ya no es elegible');

  const r2 = supresion.suprimir({
    actor: 'test', motivo: 'reintento', dryRun: false,
  });
  assert.equal(r2.firmas, 0);

  const lapidas2 = db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purgadas').get();
  assert.equal(lapidas2.n, 1, 'no se puede escribir una segunda lápida de la misma firma');
});

// =========================================================================
// 3. El gobierno: actor, motivo, ventana y lote
// =========================================================================

test('8A.2 · la supresión exige actor y motivo', () => {
  resetDb();
  assert.throws(
    () => supresion.suprimir({ motivo: 'x', dryRun: false }),
    /actor/i
  );
  assert.throws(
    () => supresion.suprimir({ actor: 'x', dryRun: false }),
    /motivo/i
  );
});

test('8A.2 · la supresión exige ventana abierta', () => {
  resetDb();
  assert.throws(
    () => supresion.suprimir({ actor: 'x', motivo: 'y', dryRun: false }),
    /ventana/i
  );
});

test('8A.2 · sin lote no se suprime nada', () => {
  resetDb();
  // Con ventana abierta pero sin lote (o con todo en hold) no se suprime nada:
  // es la respuesta correcta, no un error.
  conservacion.abrirVentana({ actor: 'x', motivo: 'y', minutos: 15 });
  const r = supresion.suprimir({ actor: 'x', motivo: 'y', dryRun: false });
  assert.equal(r.firmas, 0);
  assert.equal(r.nada_que_suprimir, true);
});

// =========================================================================
// 4. El hold legal frena la supresión
// =========================================================================

test('8A.2 · una firma con hold legal NO se suprime', async () => {
  resetDb();
  const { signRequest, paths } = await setupVencida({ hold: true });
  abrirYLotear();

  const r = supresion.suprimir({
    actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false,
  });

  assert.equal(r.firmas, 0, 'una firma con hold no se puede suprimir');
  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.ok(fila, 'la fila con hold debe seguir ahí');
  for (const p of paths) {
    assert.ok(fs.existsSync(p), 'los archivos de una firma con hold no se tocan');
  }
});

// =========================================================================
// 5. La lápida
// =========================================================================

test('8A.2 · la lápida no guarda la credencial del enlace', async () => {
  resetDb();
  const { token, signRequest } = await setupVencida();
  abrirYLotear();
  supresion.suprimir({ actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false });

  const lapida = db.prepare('SELECT * FROM gh_firma_purgadas WHERE firma_id = ?').get(signRequest.id);
  assert.ok(lapida, 'debe haber lápida');

  // Lo que se guardó NO es el hash del token (que es la credencial) ni el
  // token en claro: es un HMAC con otro propósito.
  const credenciales = [hashToken(token), hashTokenHmac(token)];
  for (const cred of credenciales) {
    assert.notEqual(
      lapida.token_tombstone, cred,
      'la lápida no puede guardar el hash de la credencial'
    );
  }
  assert.doesNotMatch(lapida.token_tombstone, new RegExp(token.slice(0, 8)));
});

test('8A.2 · la lápida no lleva datos personales', async () => {
  resetDb();
  const { signRequest } = await setupVencida();
  abrirYLotear();
  supresion.suprimir({ actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false });

  const fila = db.prepare('SELECT * FROM gh_firma_purgadas WHERE firma_id = ?').get(signRequest.id);
  const texto = JSON.stringify(fila);
  // Ni el correo del trabajador, ni su número de documento, ni su nombre.
  assert.doesNotMatch(texto, /trabajador@test\.com/);
  assert.doesNotMatch(texto, /1234567890/);
  assert.doesNotMatch(texto, /nombre_trabajador/);
});

test('8A.2 · la lápida es append-only (trigger real de la migración 025)', () => {
  // La migración 025 lleva `@skip-when-env test`, así que en la BD compartida
  // de tests NO se aplica: `resetDb()` borra la tabla entre casos y con el
  // trigger activo ese DELETE abortaría. El comportamiento se prueba acá
  // contra el ARCHIVO REAL de la migración, en una base de datos aparte.
  const { bd, ruta } = abrirBdAislada();
  try {
    bd.exec(SQL_025);
    sembrarLapidaAislada(bd);

    assert.throws(
      () => bd.prepare('UPDATE gh_firma_purgadas SET motivo = ? WHERE firma_id = 1').run('otro motivo'),
      /append-only/,
      'la lápida no se puede alterar'
    );
    assert.throws(
      () => bd.prepare('DELETE FROM gh_firma_purgadas WHERE firma_id = 1').run(),
      /append-only/,
      'la lápida no se puede borrar'
    );

    // Y la lápida sigue ahí, con su motivo original.
    const fila = bd.prepare('SELECT * FROM gh_firma_purgadas WHERE firma_id = 1').get();
    assert.equal(fila.motivo, 'Vencimiento del plazo declarado');
    assert.equal(fila.actor, 'test');
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('8A.2 · MUTACION: sin el trigger, la lápida sí se podría alterar y borrar', () => {
  // Si el trigger no existiera, el UPDATE y el DELETE pasarían sin error: esa
  // es exactamente la debilidad que la lápida inalterable no puede tener. Si
  // la supresión borrara su propio rastro, no habría forma de demostrar qué
  // se suprimió.
  const { bd, ruta } = abrirBdAislada();
  try {
    // SIN aplicar la migración 025: la tabla existe, los triggers no.
    sembrarLapidaAislada(bd);
    bd.prepare('UPDATE gh_firma_purgadas SET motivo = ? WHERE firma_id = 1').run('otro motivo');
    assert.equal(
      bd.prepare('SELECT motivo FROM gh_firma_purgadas WHERE firma_id = 1').get().motivo,
      'otro motivo'
    );
    bd.prepare('DELETE FROM gh_firma_purgadas WHERE firma_id = 1').run();
    assert.equal(bd.prepare('SELECT COUNT(*) AS n FROM gh_firma_purgadas').get().n, 0);
  } finally {
    bd.close();
    try { fs.unlinkSync(ruta); } catch (e) { /* ya no está */ }
  }
});

test('8A.2 · la migración 025 lleva la directiva de salto para el ambiente de test', () => {
  assert.match(SQL_025, /@skip-when-env\s+test/);
});

// =========================================================================
// 6. El enlace suprimido
// =========================================================================

test('8A.2 · un enlace suprimido responde CONSERVACION_VENCIDA, no TOKEN_NOT_FOUND', async () => {
  resetDb();
  const { token } = await setupVencida();
  abrirYLotear();
  supresion.suprimir({ actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false });

  const app = makeApp();
  const res = await request(app).get(`/api/sign/${token}/verify`);
  assert.equal(res.status, 410);
  assert.equal(res.body.error.code, 'CONSERVACION_VENCIDA');
  assert.match(res.body.error.message, /vencimiento del plazo/i);

  // Un token que nunca existió sigue siendo un 404 neutro: la lápida solo
  // habla de las firmas que sí se suprimieron.
  const res2 = await request(app).get('/api/sign/token-que-nunca-existio/verify');
  assert.equal(res2.status, 404);
  assert.equal(res2.body.error.code, 'TOKEN_NOT_FOUND');
});

// =========================================================================
// 7. La prueba de la aceptación sobrevive (12.7)
// =========================================================================

test('8A.2 · la prueba de la aceptación sobrevive a la supresión y lleva la solicitud', async () => {
  resetDb();
  const { signRequest } = await setupVencida();

  // El consentimiento que creó la solicitud (el helper lo acepta por
  // defecto, por la vía OTP) tiene que llevar el identificador de la
  // solicitud.
  const consent = db.prepare(
    'SELECT id, id_solicitud, version_acuerdo, hash_texto_acuerdo, fecha_aceptacion, manifestacion_aceptada '
    + 'FROM gh_consentimientos_firma WHERE id = ?'
  ).get(signRequest.consent_id);

  assert.ok(consent, 'debe existir el consentimiento');
  assert.equal(consent.manifestacion_aceptada, 1);
  assert.ok(consent.version_acuerdo, 'la versión del Acuerdo debe estar');
  assert.ok(consent.hash_texto_acuerdo, 'la huella del texto debe estar');
  assert.ok(consent.fecha_aceptacion, 'la fecha de aceptación debe estar');
  assert.ok(consent.id_solicitud, 'el 12.7 exige el identificador de la solicitud');
  assert.equal(
    consent.id_solicitud, signRequest.id_solicitud,
    'el identificador debe ser el de la solicitud a la que pertenece la aceptación'
  );

  // Y sobrevive a la supresión de la firma: es la prueba de que el
  // trabajador aceptó el Acuerdo, y no depende de la fila de la firma.
  abrirYLotear();
  supresion.suprimir({ actor: 'test', motivo: 'Vencimiento del plazo declarado', dryRun: false });

  const despues = db.prepare(
    'SELECT id, id_solicitud, version_acuerdo, hash_texto_acuerdo, fecha_aceptacion '
    + 'FROM gh_consentimientos_firma WHERE id = ?'
  ).get(signRequest.consent_id);
  assert.ok(despues, 'la prueba de la aceptación debe sobrevivir a la supresión');
  assert.equal(despues.id_solicitud, consent.id_solicitud);
  assert.equal(despues.version_acuerdo, consent.version_acuerdo);
  assert.equal(despues.hash_texto_acuerdo, consent.hash_texto_acuerdo);
  assert.equal(despues.fecha_aceptacion, consent.fecha_aceptacion);
});

test('8A.2 · el identificador de la solicitud se enlaza aunque la aceptación preceda a la firma', async () => {
  // Este es el caso que se rompió: el consentimiento se acepta por OTP
  // ANTES de que exista la fila de la firma (así es en el flujo de la
  // Empresa: crea el consentimiento, el trabajador lo acepta y después se
  // emite el enlace). En ese momento no hay ningún identificador de
  // solicitud que escribir, así que el enlace se cierra al crear la firma.
  resetDb();
  const { signRequest } = await setupVencida();

  const consent = db.prepare(
    'SELECT id_solicitud FROM gh_consentimientos_firma WHERE id = ?'
  ).get(signRequest.consent_id);

  assert.equal(
    consent.id_solicitud, signRequest.id_solicitud,
    'la aceptación por OTP debe quedar enlazada a la solicitud cuando la firma se cree'
  );

  // Y no se pisa: si el identificador ya estaba escrito (por la vía de la
  // mini-app), gana el primero, que es el que corresponde a la aceptación
  // que se probó.
  db.prepare('UPDATE gh_consentimientos_firma SET id_solicitud = ? WHERE id = ?')
    .run('SIGN-2026-OTRO', signRequest.consent_id);

  const { signRequest: segunda } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
  });
  // El consentimiento es idempotente por (empresa, trabajador): es el mismo.
  assert.equal(segunda.consent_id, signRequest.consent_id);

  const despues = db.prepare(
    'SELECT id_solicitud FROM gh_consentimientos_firma WHERE id = ?'
  ).get(signRequest.consent_id);
  assert.equal(despues.id_solicitud, 'SIGN-2026-OTRO', 'no se debe pisar el identificador ya escrito');
});

// =========================================================================
// 8. El script dice la verdad
// =========================================================================

test('8A.2 · el script de purga ofrece las dos capas y no promete más de lo que hace', () => {
  const fs2 = require('node:fs');
  const path = require('node:path');
  const script = fs2.readFileSync(
    path.join(__dirname, '..', 'scripts', 'purga-ventana.js'), 'utf8'
  );

  // La simulación es el modo por defecto: sin --ejecutar no se borra nada.
  assert.match(script, /if \(!opts\.ejecutar\)[\s\S]{0,200}SIMULACI/);
  assert.match(script, /dryRun: false/, 'la ejecución debe pasar dryRun: false explícitamente');

  // Y el encabezado ya no dice "PURGA DEL REGISTRO DE AUDITORÍA (8.6 / 10.6)":
  // el 8.6 es comunicar el plazo; el deber de conservar y suprimir es el 10.6.
  assert.doesNotMatch(script, /PURGA DEL REGISTRO DE AUDITORÍA \(8\.6/);
  assert.match(script, /SUPERSIÓN DE DATOS VENCIDOS|SUPPRESIÓN DE DATOS VENCIDOS/);
});
