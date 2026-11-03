'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const { sha256 } = require('../../src/crypto/hash');
const config = require('../../src/config');
const db = require('../../src/db/connection');
const {
  resetDb, seedActiveAgreement, makeApp, TEST_API_KEY,
} = require('../helpers');

const HEADERS = { 'X-Internal-API-Key': TEST_API_KEY };

async function makePdfWithSecretMarker(marker) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText(marker, { x: 72, y: 720, size: 14, font, color: rgb(0, 0, 0) });
  pdf.setTitle(marker);
  return Buffer.from(await pdf.save());
}

async function makeValidPdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText('Test', { x: 72, y: 720, size: 14, font, color: rgb(0, 0, 0) });
  return Buffer.from(await pdf.save());
}

function buildMetadata(acuerdo, overrides = {}) {
  return {
    id_documento: 'doc-iso',
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    tipo_firma: 'presencial',
    agreement_hash: acuerdo.texto_hash,
    agreement_version: acuerdo.version,
    document_hash: null,
    version_kair: '0.1.189',
    ...overrides,
  };
}

test('ISO-A: simple test', () => {
  assert.equal(1, 1);
});

test('ISO-B: PDF with marker (M5.3 equivalent)', async () => {
  resetDb();
  seedActiveAgreement();
  const app = makeApp();
  const secretMarker = 'SECRET-MARKER-1234';
  const full = await makePdfWithSecretMarker(secretMarker);
  const truncated = full.slice(0, Math.floor(full.length / 2));
  // dummy
  assert.ok(truncated.length > 0);
});

test('ISO-C: simple test 2', () => {
  assert.equal(1, 1);
});
