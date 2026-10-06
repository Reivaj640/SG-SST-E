/**
 * tests/scripts/cleanup-orphan-sign-requests.test.js
 *
 * Tests del script de cleanup de sign requests huérfanos.
 *
 * Aislamiento:
 *   - BD: data/test.sqlite (forzada por tests/setup.js con barrera)
 *   - Storage: storage-test/pdfs (forzado por tests/setup.js)
 *   - NODE_ENV=test (forzado por tests/setup.js)
 *   - Cada test hace resetDb() y luego siembra datos sintéticos
 *
 * El script se invoca directamente (require + main(options)) para tener
 * control sobre argv, env y TARGET_IDS/EXCLUDED_IDS sin spawns.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('node:child_process');

const helpers = require('../helpers');
const { sha256 } = require('../../src/crypto/hash');
const db = require('../../src/db/connection');
const config = require('../../src/config');
const storage = require('../../src/services/storage');
const script = require('../../scripts/cleanup-orphan-sign-requests');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const PDF_DIR = path.join(config.storage.pdfPath, 'originales');
const BACKUP_DIR = path.resolve(SERVICE_ROOT, 'data', 'backup');

// IDs de prueba
const PENDING_A = 'TEST-PENDING-A';
const PENDING_B = 'TEST-PENDING-B';
const OTP_VERIFIED_X = 'TEST-OTPVERIFIED-X';

// Guardar argv y env originales
const originalArgv = process.argv;
const originalNodeEnv = process.env.NODE_ENV;

// Helper: simular invocación del script con args y options específicos
function runScript(args, options = {}) {
  process.argv = ['node', 'cleanup-orphan-sign-requests.js', ...args];
  const origLog = console.log;
  let captured = '';
  console.log = (...msgs) => { captured += msgs.join(' ') + '\n'; };
  let code;
  try {
    code = script.main(options);
  } finally {
    console.log = origLog;
  }
  return { code, output: captured };
}

// Helper: crear un PDF dummy de 77 bytes (estructura mínima válida)
function makeDummy77Pdf() {
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
}

// Helper: insertar un sign request con id_solicitud específico vía SQL directo.
// Esto evita la generación automática de id_solicitud del servicio.
function seedFirmaWithId({
  id_solicitud,
  estado = 'PENDING',
  id_trabajador = '1234567890',
  id_documento = 'doc-0',
  agreement_hash = 'a'.repeat(64),
  metadata = null,
  pdf_buffer = null,
  fecha_creacion = new Date().toISOString(),
}) {
  const pdf = pdf_buffer || makeDummy77Pdf();
  const docHash = sha256(pdf);
  const tokenHash = crypto.randomBytes(32).toString('hex');
  const sesionId = crypto.randomUUID();

  // Guardar PDF en storage (igual que haría el servicio)
  const pdfPath = storage.saveOriginal(`${id_solicitud}.pdf`, pdf);

  // Insertar registro + sesión + evento CREATED
  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO gh_firmas_electronicas
        (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma,
         estado, document_hash_original, agreement_hash, token_hash, sesion_id,
         identificacion_tipo, identificacion_numero_hash, fecha_creacion,
         fecha_expiracion, version_kair, pdf_original_path, metadata,
         verification_channel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id_solicitud, id_documento, id_trabajador, '900123456', 'presencial',
      estado, docHash, agreement_hash, tokenHash, sesionId,
      'CC', sha256(id_trabajador), fecha_creacion,
      new Date(Date.now() + 24 * 3600 * 1000).toISOString(), '0.1.189-test',
      pdfPath, metadata, 'email',
    );
    const firmaId = result.lastInsertRowid;

    db.prepare(`
      INSERT INTO gh_firma_sesiones
        (id, firma_id, estado_sesion, iniciado_en, ultimo_cambio_en)
      VALUES (?, ?, 'PENDING', ?, ?)
    `).run(sesionId, firmaId, fecha_creacion, fecha_creacion);

    db.prepare(`
      INSERT INTO gh_firma_eventos
        (firma_id, evento, fecha_hora, id_actor, metadata)
      VALUES (?, 'CREATED', ?, 'rh:system', ?)
    `).run(firmaId, fecha_creacion, JSON.stringify({ test: true }));

    return firmaId;
  });
  return tx();
}

beforeEach(() => {
  helpers.resetDb();
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  process.argv = originalArgv;
  process.env.NODE_ENV = originalNodeEnv;
});

// =============================================================================
// TESTS
// =============================================================================

test('dry-run: detecta 2 PENDING candidatos y no toca nada', () => {
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });
  seedFirmaWithId({ id_solicitud: OTP_VERIFIED_X, estado: 'OTP_VERIFIED' });

  // Snapshot pre
  const pre = db.prepare(`
    SELECT id_solicitud, estado FROM gh_firmas_electronicas ORDER BY id_solicitud
  `).all();
  assert.equal(pre.length, 3);
  assert.equal(pre.find(r => r.id_solicitud === PENDING_A).estado, 'PENDING');
  assert.equal(pre.find(r => r.id_solicitud === PENDING_B).estado, 'PENDING');
  assert.equal(pre.find(r => r.id_solicitud === OTP_VERIFIED_X).estado, 'OTP_VERIFIED');

  const eventsPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;

  // Run dry-run con options específicas para este test
  const { code, output } = runScript([], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0, `dry-run debe retornar 0, retornó ${code}. Output:\n${output}`);

  // Verificar output
  assert.ok(output.includes(PENDING_A), 'output debe mencionar PENDING_A');
  assert.ok(output.includes(PENDING_B), 'output debe mencionar PENDING_B');
  assert.ok(output.includes(OTP_VERIFIED_X), 'output debe mencionar el OTP_VERIFIED como excluido');
  assert.ok(output.includes('EXCLUIDO') || output.includes('EXCLUID'),
    'output debe usar término EXCLUIDO/EXCLUID para OTP_VERIFIED');

  // BD intacta
  const post = db.prepare(`
    SELECT id_solicitud, estado FROM gh_firmas_electronicas ORDER BY id_solicitud
  `).all();
  assert.deepEqual(post, pre, 'los estados no deben cambiar en dry-run');
  const eventsPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;
  assert.equal(eventsPost, eventsPre, 'no se deben insertar eventos en dry-run');
});

test('ejecución real: cancela 2 PENDING, inserta eventos, preserva PDFs y OTP_VERIFIED', () => {
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });
  seedFirmaWithId({ id_solicitud: OTP_VERIFIED_X, estado: 'OTP_VERIFIED' });

  // Verificar PDFs creados
  const pdfA = path.join(PDF_DIR, PENDING_A + '.pdf');
  const pdfB = path.join(PDF_DIR, PENDING_B + '.pdf');
  assert.ok(fs.existsSync(pdfA), 'PDF A debe existir antes del cleanup');
  assert.ok(fs.existsSync(pdfB), 'PDF B debe existir antes del cleanup');
  const pdfASizeBefore = fs.statSync(pdfA).size;

  const { code, output } = runScript(['--yes'], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0, `ejecución debe retornar 0, retornó ${code}. Output:\n${output}`);

  // Verificar estados
  const a = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(PENDING_A);
  const b = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(PENDING_B);
  const x = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(OTP_VERIFIED_X);

  assert.equal(a.estado, 'CANCELLED', 'PENDING_A debe estar CANCELLED');
  assert.equal(b.estado, 'CANCELLED', 'PENDING_B debe estar CANCELLED');
  assert.equal(x.estado, 'OTP_VERIFIED', 'OTP_VERIFIED debe permanecer intacto');

  // Verificar eventos CANCELLED insertados
  const evA = db.prepare(`
    SELECT * FROM gh_firma_eventos WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?) AND evento = 'CANCELLED'
  `).get(PENDING_A);
  const evB = db.prepare(`
    SELECT * FROM gh_firma_eventos WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?) AND evento = 'CANCELLED'
  `).get(PENDING_B);
  assert.ok(evA, 'evento CANCELLED debe existir para A');
  assert.ok(evB, 'evento CANCELLED debe existir para B');
  assert.equal(evA.id_actor, 'rh:cleanup-script');
  assert.equal(evB.id_actor, 'rh:cleanup-script');
  assert.ok(evA.metadata.includes('artefacto de test'));
  assert.ok(evA.metadata.includes('cleanup-orphan-sign-requests.js'));

  // OTP_VERIFIED NO debe tener evento CANCELLED
  const evX = db.prepare(`
    SELECT * FROM gh_firma_eventos WHERE firma_id = (SELECT id FROM gh_firmas_electronicas WHERE id_solicitud = ?) AND evento = 'CANCELLED'
  `).get(OTP_VERIFIED_X);
  assert.equal(evX, undefined, 'OTP_VERIFIED NO debe tener evento CANCELLED');

  // PDFs preservados
  assert.ok(fs.existsSync(pdfA), 'PDF A debe seguir existiendo');
  assert.ok(fs.existsSync(pdfB), 'PDF B debe seguir existiendo');
  assert.equal(fs.statSync(pdfA).size, pdfASizeBefore, 'PDF A no debe modificarse');

  // Backup creado
  const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('pre-cleanup-') && f.endsWith('.sqlite'));
  assert.ok(backups.length > 0, `debe haber al menos un backup en ${BACKUP_DIR}, hay ${backups.length}`);
});

test('idempotencia: correr dos veces no genera doble cancelación', () => {
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });

  const options = { TARGET_IDS: [PENDING_A, PENDING_B], EXCLUDED_IDS: [OTP_VERIFIED_X] };

  // Primera ejecución
  const r1 = runScript(['--yes'], options);
  assert.equal(r1.code, 0);

  const cnt1 = db.prepare(`
    SELECT COUNT(*) AS n FROM gh_firma_eventos
     WHERE evento = 'CANCELLED' AND id_actor = 'rh:cleanup-script'
  `).get().n;
  assert.equal(cnt1, 2, 'después de 1ra ejecución debe haber 2 eventos CANCELLED');

  // Segunda ejecución
  const r2 = runScript(['--yes'], options);
  assert.equal(r2.code, 0, 'segunda ejecución debe retornar 0');

  const cnt2 = db.prepare(`
    SELECT COUNT(*) AS n FROM gh_firma_eventos
     WHERE evento = 'CANCELLED' AND id_actor = 'rh:cleanup-script'
  `).get().n;
  assert.equal(cnt2, 2, 'después de 2da ejecución debe seguir habiendo 2 eventos (idempotente)');

  const post = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud IN (?, ?)`).all(PENDING_A, PENDING_B);
  for (const r of post) {
    assert.equal(r.estado, 'CANCELLED');
  }
});

test('hard-block producción: NODE_ENV=production aborta inmediatamente', () => {
  process.env.NODE_ENV = 'production';
  seedFirmaWithId({ id_solicitud: PENDING_A });

  const pre = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(PENDING_A);
  const eventsPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;

  const { code, output } = runScript(['--yes'], {
    TARGET_IDS: [PENDING_A],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 1, 'NODE_ENV=production debe retornar exit 1');
  assert.ok(output.includes('HARD-BLOCK') || output.includes('production'),
    'output debe mencionar el hard-block de producción');

  const post = db.prepare(`SELECT estado FROM gh_firmas_electronicas WHERE id_solicitud = ?`).get(PENDING_A);
  assert.equal(post.estado, pre.estado, 'estado no debe cambiar con NODE_ENV=production');
  const eventsPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;
  assert.equal(eventsPost, eventsPre, 'no se deben insertar eventos');
});

test('criterios fallan: si un id cambió de estado, aborta sin tocar nada', () => {
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });

  // Cambiar PENDING_A a OPENED (simula que algo lo tocó)
  db.prepare(`UPDATE gh_firmas_electronicas SET estado = 'OPENED' WHERE id_solicitud = ?`).run(PENDING_A);

  const pre = db.prepare(`
    SELECT id_solicitud, estado FROM gh_firmas_electronicas ORDER BY id_solicitud
  `).all();
  const eventsPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;

  const { code, output } = runScript(['--yes'], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 2, 'criterios fallidos debe retornar exit 2');
  assert.ok(output.includes('RECHAZADO') || output.includes('ABORTANDO'),
    'output debe mencionar rechazo o aborto');

  // Atomicidad: nada se modificó
  const post = db.prepare(`
    SELECT id_solicitud, estado FROM gh_firmas_electronicas ORDER BY id_solicitud
  `).all();
  assert.deepEqual(post, pre, 'ningún estado debe cambiar si los criterios fallan');
  const eventsPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_eventos`).get().n;
  assert.equal(eventsPost, eventsPre, 'ningún evento debe insertarse');
});

test('sin candidatos: TARGET_IDS vacío retorna 0 sin tocar nada', () => {
  const { code, output } = runScript(['--yes'], {
    TARGET_IDS: [],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0, `con TARGET_IDS vacío debe retornar 0, retornó ${code}. Output:\n${output}`);
  assert.ok(output.includes('No hay') || output.includes('nada que hacer'),
    'output debe indicar que no hay nada que hacer');
});

test('no se tocan sesiones, consentimientos ni acuerdos', () => {
  // Seedear los PENDING (crean firmas + sesiones + eventos automáticamente)
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });

  // Insertar un consentimiento de prueba (con todos los NOT NULL columns)
  try {
    db.prepare(`
      INSERT INTO gh_consentimientos_firma
        (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo,
         correo_verificacion, correo_hash, otp_hash, otp_sal,
         kair_version, manifestacion_aceptada, estado, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      '1234567890', '900123456', 'v1.0', 'x'.repeat(64),
      'a@b.com', 'x'.repeat(64), 'x'.repeat(64), 'x'.repeat(64),
      '0.1.189-test', 1, 'ACEPTADO',
    );
  } catch (e) {
    console.log('  [DEBUG] consent insert failed:', e.message);
    throw e;
  }

  const sesPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_sesiones`).get().n;
  const consPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_consentimientos_firma`).get().n;
  const acPre = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones`).get().n;

  // Verificación: las sesiones seedeadas son 2 (una por cada PENDING)
  assert.equal(sesPre, 2, 'debe haber 2 sesiones seedeadas');
  assert.equal(consPre, 1, 'debe haber 1 consentimiento insertado');

  const { code } = runScript(['--yes'], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0);

  const sesPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_sesiones`).get().n;
  const consPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_consentimientos_firma`).get().n;
  const acPost = db.prepare(`SELECT COUNT(*) AS n FROM gh_firma_acuerdo_versiones`).get().n;

  assert.equal(sesPost, sesPre, 'gh_firma_sesiones no debe cambiar');
  assert.equal(consPost, consPre, 'gh_consentimientos_firma no debe cambiar');
  assert.equal(acPost, acPre, 'gh_firma_acuerdo_versiones no debe cambiar');
});

test('PDFs en disco se preservan con su tamaño original', () => {
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });

  const pdfA = path.join(PDF_DIR, PENDING_A + '.pdf');
  const pdfB = path.join(PDF_DIR, PENDING_B + '.pdf');
  const hashABefore = sha256(fs.readFileSync(pdfA));
  const hashBBefore = sha256(fs.readFileSync(pdfB));

  const { code } = runScript(['--yes'], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0);

  assert.ok(fs.existsSync(pdfA));
  assert.ok(fs.existsSync(pdfB));
  const hashAAfter = sha256(fs.readFileSync(pdfA));
  const hashBAfter = sha256(fs.readFileSync(pdfB));
  assert.equal(hashAAfter, hashABefore, 'PDF A no debe modificarse');
  assert.equal(hashBAfter, hashBBefore, 'PDF B no debe modificarse');
});

test('el script expone TARGET_IDS y EXCLUDED_IDS como módulos', () => {
  // Esto protege contra typos en la lista
  assert.ok(Array.isArray(script.TARGET_IDS));
  assert.ok(Array.isArray(script.EXCLUDED_IDS));
  assert.ok(script.TARGET_IDS.length > 0, 'TARGET_IDS no debe estar vacío');
  assert.ok(script.EXCLUDED_IDS.length > 0, 'EXCLUDED_IDS no debe estar vacío');

  // No debe haber solapamiento
  for (const id of script.TARGET_IDS) {
    assert.ok(!script.EXCLUDED_IDS.includes(id), `${id} no debe estar en EXCLUDED_IDS`);
  }
});

test('dry-run NO incrementa archivos en data/backup', () => {
  // Sembrar registros PENDING válidos para que el script proceda al dry-run summary
  seedFirmaWithId({ id_solicitud: PENDING_A });
  seedFirmaWithId({ id_solicitud: PENDING_B });

  // Cuenta archivos pre-cleanup antes del dry-run
  const beforeFiles = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pre-cleanup-') && f.endsWith('.sqlite'));
  const beforeCount = beforeFiles.length;

  // Run dry-run con TARGET_IDS de test (no debe escribir nada)
  const { code, output } = runScript([], {
    TARGET_IDS: [PENDING_A, PENDING_B],
    EXCLUDED_IDS: [OTP_VERIFIED_X],
  });
  assert.equal(code, 0, `dry-run debe retornar 0, retornó ${code}. Output:\n${output}`);

  // Verificar que NO se creó ningún backup nuevo
  const afterFiles = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pre-cleanup-') && f.endsWith('.sqlite'));
  const afterCount = afterFiles.length;

  assert.equal(
    afterCount, beforeCount,
    `dry-run no debe crear archivos de backup. antes=${beforeCount}, después=${afterCount}. Nuevos: ${afterCount - beforeCount}`
  );

  // Bonus: los archivos pre-existentes deben seguir ahí
  for (const f of beforeFiles) {
    assert.ok(afterFiles.includes(f), `Backup preexistente ${f} debe seguir existiendo`);
  }
});

test('ejecutar como CLI real no falla con TypeError (fix module.exports)', () => {
  // Spawn el script como proceso CLI real (no via require).
  // Cubre el fix de module.exports ANTES del if(require.main === module).
  // Sin el fix, el script crasheaba con:
  //   TypeError: Cannot read properties of undefined (reading 'length')
  // en la línea `log(`TARGET_IDS (${TARGET_IDS.length}):`)`
  const scriptPath = path.join(SERVICE_ROOT, 'scripts', 'cleanup-orphan-sign-requests.js');

  const result = spawnSync(
    process.execPath,  // path al binario de node
    [scriptPath],
    {
      cwd: SERVICE_ROOT,
      env: { ...process.env },  // hereda DB_PATH, NODE_ENV, PDF_STORAGE_PATH del setup
      encoding: 'utf8',
      timeout: 15000,
    }
  );

  // El spawn no debe fallar (no ENOENT, no timeout)
  assert.equal(result.error, undefined, `spawnSync no debe fallar: ${result.error?.message}`);
  assert.notEqual(result.status, null, 'CLI debe terminar con código de salida (no colgado)');

  // El CLI no debe abortar con exit 1 (eso sería production block o crash)
  assert.notEqual(
    result.status, 1,
    `CLI no debe terminar con exit 1. status=${result.status}, stderr: ${result.stderr || '(vacío)'}`
  );

  // El output NO debe contener el TypeError que arreglamos
  const allOutput = (result.stdout || '') + (result.stderr || '');
  assert.ok(
    !allOutput.includes('TypeError'),
    `CLI no debe fallar con TypeError. Output:\n${allOutput}`
  );
  assert.ok(
    !allOutput.includes('Cannot read properties of undefined'),
    `CLI no debe tener acceso a undefined (el bug que arreglamos). Output:\n${allOutput}`
  );

  // El CLI debe leer correctamente los TARGET_IDS del módulo
  // (el output debe mencionar los 2 ids reales y el excluido)
  assert.ok(
    result.stdout.includes('SIGN-2026-702349'),
    `CLI debe mencionar TARGET_IDS[0]=SIGN-2026-702349 en output. stdout:\n${result.stdout}`
  );
  assert.ok(
    result.stdout.includes('SIGN-2026-531707'),
    `CLI debe mencionar TARGET_IDS[1]=SIGN-2026-531707 en output. stdout:\n${result.stdout}`
  );
  assert.ok(
    result.stdout.includes('SIGN-2026-823506'),
    `CLI debe mencionar EXCLUDED_IDS[0]=SIGN-2026-823506 en output. stdout:\n${result.stdout}`
  );

  // El modo debe ser DRY-RUN (sin --yes)
  assert.ok(
    result.stdout.includes('DRY-RUN'),
    `CLI debe estar en modo DRY-RUN por defecto. stdout:\n${result.stdout}`
  );
});
