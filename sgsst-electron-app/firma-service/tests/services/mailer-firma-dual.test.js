/**
 * Tests del mailer diferenciado al representante legal (Firma Dual, v0.1.180).
 *
 * Cubre la nueva función `mailer.sendInviteForCompany` (Task 1.13) que se usa
 * en `signRequest.createForCompany` para notificar al rep que DEBE firmar como
 * 2da firma (el worker ya firmó).
 *
 * El correo debe ser CLARAMENTE DIFERENCIADO del `sendInvite` del worker:
 *   - Subject: "K+AIR — Firma como representante legal — <id_documento>"
 *     (vs el "K+AIR — Tienes un documento para firmar" del worker).
 *   - Body: explica que el rep es la 2da firma y que el worker ya firmó.
 *   - Body: identifica al rep por nombre.
 *   - Body: incluye la URL pública.
 *
 * Casos cubiertos:
 *  - Camino feliz: sendInviteForCompany guarda en _devInbox con tipo='invite-company',
 *    subject diferenciado, body con rep_nombre y URL.
 *  - Validación: sendInviteForCompany valida `to`, `url_publica`, `id_solicitud`.
 *
 * NOTA sobre scope: este test vive en tests/services/ que SÍ está incluido
 * en el glob de `npm test` (ver package.json script "test").
 */
'use strict';

// Ensure test env before any requires (dotenv may set production from .env)
if (process.env.NODE_ENV !== 'test') process.env.NODE_ENV = 'test';
delete require.cache[require.resolve('../../src/config')];

const test = require('node:test');
const assert = require('node:assert/strict');
const mailer = require('../../src/services/mailer');

// =====================================================================
// Test 1: sendInviteForCompany envía correo diferenciado
// =====================================================================

test('mailer.sendInviteForCompany: envía correo diferenciado al rep con subject y body claros', async () => {
  // Limpiar el dev inbox de cualquier correo de tests anteriores.
  mailer.clearDevInbox();

  const result = await mailer.sendInviteForCompany({
    to: 'juan@empresa.com',
    url_publica: 'https://firma.kair.fyi/s/abc',
    id_solicitud: 'SR-2026-001',
    id_documento: 'doc-1',
    rep_nombre: 'Juan Pérez',
    context: { parent_id_solicitud: 'SR-2026-000', tipo_firmante: 'EMPRESA' },
  });

  // Resultado del mailer
  assert.equal(result.ok, true);
  assert.ok(result.messageId, 'debe retornar messageId');

  // El correo debe estar en el dev inbox
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.length, 1, 'debe haber exactamente 1 correo en el inbox');
  const email = inbox[0];

  // Email basics
  assert.equal(email.to, 'juan@empresa.com');
  assert.equal(email.tipo, 'invite-company',
    'tipo debe ser "invite-company" para distinguirlo del invite del worker');

  // Subject DIFERENCIADO (NO debe ser el genérico del worker)
  assert.notEqual(email.subject, 'K+AIR — Tienes un documento para firmar',
    'subject del rep debe ser DIFERENTE al del worker');
  assert.match(email.subject, /representante|firma dual/i,
    'subject debe mencionar "representante" o "firma dual"');
  assert.ok(email.subject.includes('doc-1'),
    'subject debe incluir el id_documento');

  // Body DIFERENCIADO
  assert.match(email.body, /representante legal/i,
    'body debe mencionar "representante legal"');
  assert.match(email.body, /Juan Pérez/,
    'body debe mencionar el nombre del rep');
  assert.ok(email.body.includes('https://firma.kair.fyi/s/abc'),
    'body debe incluir la URL pública');
  // El body debe explicar que el rep es la 2da firma
  assert.match(email.body, /segunda firma|2da firma|segundo firmante/i,
    'body debe aclarar que el rep es la 2da firma (worker ya firmó)');

  // Contexto se persiste
  assert.deepEqual(email.context, {
    parent_id_solicitud: 'SR-2026-000',
    tipo_firmante: 'EMPRESA',
  });
  // Identificadores se persisten para auditoría
  assert.equal(email.id_solicitud, 'SR-2026-001');
  assert.equal(email.id_documento, 'doc-1');
  assert.equal(email.rep_nombre, 'Juan Pérez');
  assert.equal(email.url_publica, 'https://firma.kair.fyi/s/abc');
});

// =====================================================================
// Test 2: sendInviteForCompany valida inputs
// =====================================================================

test('mailer.sendInviteForCompany: valida inputs requeridos (to, url_publica, id_solicitud)', async () => {
  // Sin `to`
  await assert.rejects(
    () => mailer.sendInviteForCompany({
      url_publica: 'https://firma.kair.fyi/s/abc',
      id_solicitud: 'SR-2026-001',
      id_documento: 'doc-1',
      rep_nombre: 'Juan',
    }),
    (err) => /to.*correo válido/i.test(err.message)
  );

  // Sin `url_publica`
  await assert.rejects(
    () => mailer.sendInviteForCompany({
      to: 'juan@empresa.com',
      id_solicitud: 'SR-2026-001',
      id_documento: 'doc-1',
      rep_nombre: 'Juan',
    }),
    (err) => /url_publica/i.test(err.message)
  );

  // Sin `id_solicitud`
  await assert.rejects(
    () => mailer.sendInviteForCompany({
      to: 'juan@empresa.com',
      url_publica: 'https://firma.kair.fyi/s/abc',
      id_documento: 'doc-1',
      rep_nombre: 'Juan',
    }),
    (err) => /id_solicitud/i.test(err.message)
  );

  // `to` sin @ debe rechazarse
  await assert.rejects(
    () => mailer.sendInviteForCompany({
      to: 'esto-no-es-correo',
      url_publica: 'https://firma.kair.fyi/s/abc',
      id_solicitud: 'SR-2026-001',
      id_documento: 'doc-1',
      rep_nombre: 'Juan',
    }),
    (err) => /to.*correo válido/i.test(err.message)
  );
});
