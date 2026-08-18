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
const { errorHandler } = require('../src/middleware/errors');
const agreementService = require('../src/services/agreement');
const mailer = require('../src/services/mailer');

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
  app.use('/internal', agreementRouter);
  app.use('/internal', consentRouter);
  app.use(errorHandler());
  return app;
}

function withApiKey(req) {
  return req.set('X-Internal-API-Key', TEST_API_KEY);
}

module.exports = {
  resetDb,
  seedActiveAgreement,
  makeApp,
  withApiKey,
  TEST_API_KEY,
};
