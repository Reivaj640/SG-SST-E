/**
 * Helpers compartidos por los tests.
 *
 * - resetDb: limpia todas las tablas gh_* (entre tests).
 * - seedActiveAgreement: crea una versión activa del Acuerdo.
 * - makeApp: crea una app Express con todas las rutas (para tests E2E).
 */
'use strict';

const express = require('express');
const request = require('supertest');
const db = require('../src/db/connection');
const config = require('../src/config');
const agreementRouter = require('../src/routes/agreement');
const consentRouter = require('../src/routes/consent');
const signRequestRouter = require('../src/routes/signRequest');
const publicRouter = require('../src/routes/public');
const { errorHandler } = require('../src/middleware/errors');
const agreementService = require('../src/services/agreement');
const mailer = require('../src/services/mailer');
const storage = require('../src/services/storage');

const TEST_API_KEY = 'test-internal-api-key-32-bytes-min!!';

// Sobrescribir la API key en config (objeto mutable) para que el
// middleware de auth use la key de test.
config.auth.internalApiKey = TEST_API_KEY;

const TABLES = [
  'gh_consentimientos_firma',
  'gh_firma_acuerdo_versiones',
  'gh_firma_eventos',
  'gh_firma_sesiones',
  'gh_firmas_electronicas',
  'gh_firma_schema_migrations',
];

function resetDb() {
  for (const t of TABLES) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  mailer.clearDevInbox();
  // Borrar PDFs del storage
  for (const dir of [storage.PATHS.originales, storage.PATHS.firmados, storage.PATHS.constancias]) {
    try {
      const fs = require('fs');
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.pdf') || f.endsWith('.bin')) {
          fs.unlinkSync(require('path').join(dir, f));
        }
      }
    } catch (e) { /* ignore */ }
  }
}

function seedActiveAgreement({ version = 'v1.0', texto = 'ACUERDO DE PRUEBA\nVersión v1.0' } = {}) {
  return agreementService.createVersion({
    version,
    texto,
    creado_por: 'test',
    kair_version: '0.1.189-test',
    activa: true,
  });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/', publicRouter);
  app.use('/internal', agreementRouter);
  app.use('/internal', consentRouter);
  app.use('/internal', signRequestRouter);
  app.use(errorHandler());
  return app;
}

const { sha256 } = require('../src/crypto/hash');

/**
 * Crea un Sign Request con datos de identificación.
 * Helper para tests del flujo público.
 */
async function createSignRequestWithIdentificacion({
  id_documento = 'doc-001',
  id_trabajador = '1234567890',
  id_empresa = '900123456',
  tipo_firma = 'presencial',
  identificacion_tipo = 'CC',
  identificacion_numero = '1234567890',
  ...overrides
} = {}) {
  const signRequestService = require('../src/services/signRequest');
  const { PDFDocument } = require('pdf-lib');
  // Crear PDF válido con pdf-lib
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([300, 200]);
  page.drawText('Documento de prueba');
  const pdf = Buffer.from(await pdfDoc.save());
  return signRequestService.create({
    id_documento, id_trabajador, id_empresa, tipo_firma,
    agreement_hash: 'a'.repeat(64),
    document_hash: sha256(pdf),
    pdf_buffer: pdf,
    pdf_filename: 'test.pdf',
    version_kair: '0.1.189-test',
    identificacion_tipo,
    identificacion_numero_hash: sha256(identificacion_numero),
    ...overrides,
  });
}

function withApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY);
}

module.exports = {
  resetDb,
  seedActiveAgreement,
  makeApp,
  withApiKey,
  createSignRequestWithIdentificacion,
  TEST_API_KEY,
};
