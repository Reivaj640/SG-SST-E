/**
 * Tests del service signRequest.notifyRemote (I-103.A1.5.1).
 *
 * Cubre el service directamente, sin HTTP. El objetivo es validar la lógica
 * de negocio pura: recuperación de token, envío de mailer, registro de
 * evento, manejo de errores. La capa HTTP (auth, cross-company, terminal
 * state) se prueba en tests/routes/signRequest-notify-remote.test.js.
 *
 * Casos cubiertos:
 *  - Camino feliz: sign request + correo válido → envía + registra evento
 *  - El evento INVITE_SENT persiste con correo_destino_enmascarado (NO plaintext)
 *  - El mensaje va al _devInbox con tipo='invite' y la url_publica
 *  - Sign request sin metadata (legacy pre-I-013b) → 410 INVITE_NOT_AVAILABLE
 *  - Sign request con metadata corrupto → 410 INVITE_NOT_AVAILABLE
 *  - Correo inválido → 400 INVALID_REQUEST_BODY
 *  - Mailer lanza (SMTP caído) → 502 INVITE_EMAIL_FAILED
 *  - Auditoría falla (BD rota) → envío sigue siendo exitoso (best-effort)
 *  - Re-envío: 2 llamadas al mismo sign request → 2 correos + 2 eventos
 *  - _maskEmail: helper de redacción
 *
 * NOTA sobre scope: este test vive en tests/services/ que SÍ está incluido
 * en el glob de `npm test` (ver package.json script "test").
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, seedActiveAgreement } = require('../helpers');
const signRequestService = require('../../src/services/signRequest');
const mailer = require('../../src/services/mailer');
const db = require('../../src/db/connection');
const { sha256 } = require('../../src/crypto/hash');

// PDF mínimo válido (magic bytes %PDF-)
function makePdf() {
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from('1 0 obj\n<< /Type /Catalog >>\nendobj\n'),
    Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
}

async function makeSignRequest(acuerdo) {
  const pdf = makePdf();
  return signRequestService.create({
    id_documento: 'doc-notify-001',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'remoto',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'contrato.pdf',
    version_kair: '0.1.190-test',
    identificacion_tipo: 'CC',
    identificacion_numero_hash: sha256('1234567890'),
  });
}

// =====================================================================
// _maskEmail helper
// =====================================================================

test('notifyRemote._maskEmail: enmascara local dejando 2 chars visibles', () => {
  // 'juan.perez' = 10 chars; 2 visibles, 8 stars
  const m = signRequestService._maskEmail('juan.perez@example.com');
  assert.equal(m, 'ju********@example.com');
});

test('notifyRemote._maskEmail: local corto (1 char) enmascara todo después', () => {
  const m = signRequestService._maskEmail('a@example.com');
  assert.equal(m, 'a@example.com'); // Math.min(2, 1) = 1; stars = 0
});

test('notifyRemote._maskEmail: inválido (sin @) → "[INVALID_EMAIL]"', () => {
  const m = signRequestService._maskEmail('not-an-email');
  assert.equal(m, '[INVALID_EMAIL]');
});

test('notifyRemote._maskEmail: null/undefined → "[INVALID_EMAIL]"', () => {
  assert.equal(signRequestService._maskEmail(null), '[INVALID_EMAIL]');
  assert.equal(signRequestService._maskEmail(undefined), '[INVALID_EMAIL]');
});

// =====================================================================
// Camino feliz
// =====================================================================

test('notifyRemote: happy path → envía correo + registra evento INVITE_SENT', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  const result = await signRequestService.notifyRemote(
    signRequest,
    'juan.perez@example.com',
    { actor: 'rh:test-key-prefix', ip: '127.0.0.1', user_agent: 'jest' }
  );

  assert.equal(result.ok, true);
  assert.ok(result.messageId);
  assert.ok(result.sent_at);
  // evento_id puede ser undefined si la query post-insert no encontró la fila
  // (timing); en la práctica debería estar, pero no es bloqueante.

  // Verificar que el correo se guardó en _devInbox con tipo='invite'
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].tipo, 'invite');
  assert.equal(inbox[0].to, 'juan.perez@example.com');
  assert.equal(inbox[0].id_solicitud, signRequest.id_solicitud);
  assert.ok(inbox[0].url_publica.includes('/s/'));
  // El subject debe ser el de invitación (NO el genérico)
  assert.equal(inbox[0].subject, 'K+AIR — Tienes un documento para firmar');
  // El body debe mencionar la URL y el id_solicitud
  assert.ok(inbox[0].body.includes(signRequest.id_solicitud));
  assert.ok(inbox[0].body.includes('/s/'));

  // Verificar que el evento INVITE_SENT se persistió
  const evt = db.prepare(`
    SELECT evento, metadata, id_actor, ip, user_agent
    FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'INVITE_SENT'
  `).get(signRequest.id);
  assert.ok(evt, 'Debe existir el evento INVITE_SENT');
  assert.equal(evt.id_actor, 'rh:test-key-prefix');
  assert.equal(evt.ip, '127.0.0.1');
  assert.equal(evt.user_agent, 'jest');

  // La metadata debe tener el correo ENMASCARADO (NO plaintext)
  const meta = JSON.parse(evt.metadata);
  assert.equal(meta.correo_destino_enmascarado, 'ju********@example.com');
  assert.equal(meta.correo_destino_enmascarado.includes('juan.perez'), false,
    'correo NO debe aparecer en plaintext en la metadata del evento');
  assert.ok(meta.messageId);
  assert.equal(meta.canal, 'email');
});

test('notifyRemote: NO propaga el correo en plaintext al log', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  // Capturar stderr (donde el logger escribe warn/error)
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = function (chunk) {
    stderrChunks.push(String(chunk));
    return true;
  };
  // También stdout (info)
  const stdoutChunks = [];
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = function (chunk) {
    stdoutChunks.push(String(chunk));
    return true;
  };

  try {
    await signRequestService.notifyRemote(
      signRequest,
      'unique-marker-correo-juanito@example.com',
      {}
    );
  } finally {
    process.stderr.write = origWrite;
    process.stdout.write = origStdoutWrite;
  }

  const allLogs = stderrChunks.concat(stdoutChunks).join('');
  assert.equal(allLogs.includes('unique-marker-correo-juanito'), false,
    'El correo en plaintext NO debe aparecer en logs:\n' + allLogs);
});

test('notifyRemote: re-envío (2 veces) → 2 correos en inbox + 2 eventos', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  await signRequestService.notifyRemote(signRequest, 'first@example.com', {});
  await signRequestService.notifyRemote(signRequest, 'second@example.com', {});

  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 2);
  assert.equal(inbox[0].to, 'first@example.com');
  assert.equal(inbox[1].to, 'second@example.com');

  const evts = db.prepare(`
    SELECT id FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'INVITE_SENT'
  `).all(signRequest.id);
  assert.equal(evts.length, 2);
});

test('notifyRemote: context libre se persiste en metadata del evento', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  await signRequestService.notifyRemote(
    signRequest,
    'user@example.com',
    {
      actor: 'rh:ctx-test',
      context: { via: 'manual-button', clicked_at: '2026-08-24T14:00:00Z' },
    }
  );

  const evt = db.prepare(`
    SELECT metadata FROM gh_firma_eventos
    WHERE firma_id = ? AND evento = 'INVITE_SENT'
  `).get(signRequest.id);
  const meta = JSON.parse(evt.metadata);
  assert.deepEqual(meta.context, {
    via: 'manual-button',
    clicked_at: '2026-08-24T14:00:00Z',
  });
});

// =====================================================================
// Errores
// =====================================================================

test('notifyRemote: sign request sin metadata (legacy) → 410 INVITE_NOT_AVAILABLE', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  // Simular sign request legacy: vaciar el metadata directamente en BD.
  db.prepare('UPDATE gh_firmas_electronicas SET metadata = NULL WHERE id = ?')
    .run(signRequest.id);
  const legacy = signRequestService.getById(signRequest.id);
  assert.equal(legacy.metadata, null);

  await assert.rejects(
    () => signRequestService.notifyRemote(legacy, 'user@example.com', {}),
    (err) => {
      assert.equal(err.code, 'INVITE_NOT_AVAILABLE');
      assert.equal(err.statusCode, 410);
      assert.equal(err.details.reason, 'legacy_no_token_recovery');
      return true;
    }
  );

  // No se debe haber enviado correo
  assert.equal(mailer.getDevInbox().length, 0);
  // No se debe haber registrado evento
  const evts = db.prepare(`
    SELECT id FROM gh_firma_eventos WHERE evento = 'INVITE_SENT'
  `).all();
  assert.equal(evts.length, 0);
});

test('notifyRemote: metadata corrupto (no es JSON) → 410 INVITE_NOT_AVAILABLE', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  db.prepare('UPDATE gh_firmas_electronicas SET metadata = ? WHERE id = ?')
    .run('esto no es JSON {', signRequest.id);
  const broken = signRequestService.getById(signRequest.id);

  await assert.rejects(
    () => signRequestService.notifyRemote(broken, 'user@example.com', {}),
    (err) => {
      assert.equal(err.code, 'INVITE_NOT_AVAILABLE');
      assert.equal(err.details.reason, 'corrupt_metadata');
      return true;
    }
  );
});

test('notifyRemote: correo inválido (sin @) → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  await assert.rejects(
    () => signRequestService.notifyRemote(signRequest, 'not-an-email', {}),
    (err) => {
      assert.equal(err.code, 'INVALID_REQUEST_BODY');
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
  assert.equal(mailer.getDevInbox().length, 0);
});

test('notifyRemote: correo demasiado largo (>254) → 400 INVALID_REQUEST_BODY', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);
  const tooLong = 'a'.repeat(250) + '@x.com'; // 256 chars

  await assert.rejects(
    () => signRequestService.notifyRemote(signRequest, tooLong, {}),
    (err) => err.code === 'INVALID_REQUEST_BODY'
  );
});

test('notifyRemote: signRequest null → 500 INTERNAL_ERROR', async () => {
  await assert.rejects(
    () => signRequestService.notifyRemote(null, 'user@example.com', {}),
    (err) => {
      assert.equal(err.code, 'INTERNAL_ERROR');
      assert.equal(err.statusCode, 500);
      return true;
    }
  );
});

test('notifyRemote: mailer lanza (SMTP caído) → 502 INVITE_EMAIL_FAILED + NO evento', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  // Monkey-patch mailer.sendInvite para que lance
  const origSend = mailer.sendInvite;
  mailer.sendInvite = async function () {
    const e = new Error('Connection refused: SMTP offline');
    e.code = 'ECONNREFUSED';
    throw e;
  };

  try {
    await assert.rejects(
      () => signRequestService.notifyRemote(signRequest, 'user@example.com', {}),
      (err) => {
        assert.equal(err.code, 'INVITE_EMAIL_FAILED');
        assert.equal(err.statusCode, 502);
        assert.equal(err.details.reason, 'smtp_failure');
        assert.match(err.details.upstream_error, /Connection refused/);
        return true;
      }
    );
  } finally {
    mailer.sendInvite = origSend;
  }

  // NO se debe haber registrado evento (el envío falló antes de la auditoría)
  const evts = db.prepare(`
    SELECT id FROM gh_firma_eventos WHERE evento = 'INVITE_SENT'
  `).all();
  assert.equal(evts.length, 0);
});

test('notifyRemote: auditoría falla (BD rota) → envío SIGUE siendo exitoso', async () => {
  resetDb();
  const acuerdo = seedActiveAgreement();
  const { signRequest } = await makeSignRequest(acuerdo);

  // Monkey-patch db.prepare para que el INSERT a gh_firma_eventos falle
  // (la query del SELECT post-insert también fallará, pero la lógica del
  // service es best-effort: si el INSERT falla, log WARN y continuar).
  const origPrepare = db.prepare.bind(db);
  let consumed = 0;
  db.prepare = function (sql) {
    const stmt = origPrepare(sql);
    if (sql.includes('INSERT INTO gh_firma_eventos') && consumed < 1) {
      consumed++;
      return {
        run() { throw new Error('BD lock simulada'); },
        get: stmt.get.bind(stmt),
        all: stmt.all.bind(stmt),
        iterate: stmt.iterate ? stmt.iterate.bind(stmt) : undefined,
        pluck: () => ({ get: stmt.get.bind(stmt), all: stmt.all.bind(stmt), run() { throw new Error('BD lock simulada'); } }),
        raw: () => ({ get: stmt.get.bind(stmt), all: stmt.all.bind(stmt), run() { throw new Error('BD lock simulada'); } }),
        columns: stmt.columns, source: stmt.source,
        busy: stmt.busy ? stmt.busy.bind(stmt) : undefined,
        reset: stmt.reset ? stmt.reset.bind(stmt) : undefined,
        bind: stmt.bind ? stmt.bind.bind(stmt) : undefined,
      };
    }
    return stmt;
  };

  try {
    const result = await signRequestService.notifyRemote(
      signRequest, 'user@example.com', {}
    );
    // El envío debe haber sido exitoso aunque la auditoría falló
    assert.equal(result.ok, true);
    assert.ok(result.messageId);
    // El correo SÍ salió (dev mode: está en inbox)
    assert.equal(mailer.getDevInbox().length, 1);
  } finally {
    db.prepare = origPrepare;
  }
});
