// =====================================================================
// Test smoke — Constancia de firma P0/P1 (2026-09-02)
// Verifica que el PDF tenga las secciones tipo DocuSign y que publicFlow
// alimente los datos necesarios.
// Ejecutar: node main/test-firma-constancia-p0-p1.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pdfGenPath = path.join(root, 'firma-service', 'src', 'services', 'pdfGen.js');
const publicFlowPath = path.join(root, 'firma-service', 'src', 'services', 'publicFlow.js');
const signRequestSchemaPath = path.join(root, 'firma-service', 'src', 'schemas', 'index.js');
const signRequestRoutePath = path.join(root, 'firma-service', 'src', 'routes', 'signRequest.js');
const documentosPath = path.join(root, 'modules', 'gestion-humana', 'documentos', 'index.js');

const pdfGenSrc = fs.readFileSync(pdfGenPath, 'utf8');
const publicFlowSrc = fs.readFileSync(publicFlowPath, 'utf8');
const signRequestSchemaSrc = fs.readFileSync(signRequestSchemaPath, 'utf8');
const signRequestRouteSrc = fs.readFileSync(signRequestRoutePath, 'utf8');
const documentosSrc = fs.readFileSync(documentosPath, 'utf8');

const checks = [];

[
  ['pdfGen: Resumen incluye Asunto', /campo\(\'Asunto\'/],
  ['pdfGen: Resumen incluye Páginas del documento original', /campo\(\'Páginas del documento original\'/],
  ['pdfGen: Resumen incluye Páginas de esta constancia', /campoValorPaginas\(\'Páginas de esta constancia\'/],
  ['pdfGen: Resumen incluye Zona horaria de referencia', /campo\(\'Zona horaria de referencia\'/],
  ['pdfGen: tiene sección Hitos de la firma', /seccion\(\'Hitos de la firma\'\)/],
  ['pdfGen: tiene helper hito()', /function hito\(label, fechaIso, estado\)/],
  ['pdfGen: tiene sección Control del registro', /seccion\(\'Control del registro\'\)/],
  ['pdfGen: Firmante incluye Nivel de seguridad', /campo\(\'Nivel de seguridad\'/],
  ['pdfGen: tiene Consentimiento y manifestación', /seccion\(\'Consentimiento y manifestación del firmante\'\)/],
  ['pdfGen: consentimiento muestra ID', /campo\(\'ID de consentimiento\'/],
  ['pdfGen: consentimiento muestra fecha de aceptación', /campo\(\'Aceptado el\'/],
  ['pdfGen: exporta getPdfPageCount', /getPdfPageCount/],
  ['pdfGen: mantiene constancia en una sola generación con valor diferido', /paginasConstanciaSlot/],
  ['pdfGen: muestra identificación con últimos 4 dígitos', /fmtIdentificacionParcial/],
  ['pdfGen: firmante usa identificación parcial', /campo\(\'Identificación\', fmtIdentificacionParcial/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(pdfGenSrc) }); });

[
  ['schema: acepta nombre_trabajador', /nombre_trabajador:\s*z\.string\(\)\.max\(255\)\.optional\(\)/],
  ['schema: acepta nombre_empresa', /nombre_empresa:\s*z\.string\(\)\.max\(255\)\.optional\(\)/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(signRequestSchemaSrc) }); });

[
  ['route: preserva nombre_trabajador en metadata persistida', /metadataExtra\.nombre_trabajador/],
  ['route: preserva nombre_empresa en metadata persistida', /metadataExtra\.nombre_empresa/],
  ['route: pasa correo_verificacion top-level al service', /correo_verificacion:\s*meta\.correo_verificacion/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(signRequestRouteSrc) }); });

[
  ['documentos: envía nombre_trabajador', /nombre_trabajador:\s*\(\(t && t\.nombres \|\| ''\) \+ ' ' \+ \(t && t\.apellidos \|\| ''\)\)\.trim\(\)/],
  ['documentos: envía nombre_empresa', /nombre_empresa:\s*self\.companyName/],
  ['documentos: envía correo_verificacion top-level', /correo_verificacion:\s*correoFirmante/],
  ['documentos: ya no usa metadata anidada solo para correo', /metadata:\s*JSON\.stringify\(\{ correo: correoFirmante \}\)/, true],
].forEach(function (c) {
  var ok = c[2] ? !c[1].test(documentosSrc) : c[1].test(documentosSrc);
  checks.push({ name: c[0], ok: ok });
});

[
  ['publicFlow: calcula páginas del PDF original', /paginasDocumentoOriginal/],
  ['publicFlow: construye hitos con _buildHitosFirma', /_buildHitosFirma\(_rows, signRequest, fecha_firma\)/],
  ['publicFlow: lee consentimiento con _getConsentResumen', /_getConsentResumen\(signRequest\.consent_id\)/],
  ['publicFlow: pasa hitos_firma a pdfGen', /hitos_firma:\s*hitosFirma/],
  ['publicFlow: pasa consent_id a pdfGen', /consent_id:\s*consentResumen/],
  ['publicFlow: pasa fecha_aceptacion_acuerdo a pdfGen', /fecha_aceptacion_acuerdo:/],
  ['publicFlow: genera constancia una sola vez', /const constanciaBuf = await withAppErrorWrapping/],
  ['publicFlow: pasa control_registro a pdfGen', /control_registro:/],
  ['publicFlow: pasa nivel_seguridad a pdfGen', /nivel_seguridad:/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(publicFlowSrc) }); });

let failed = 0;
checks.forEach(function (c) {
  if (c.ok) {
    console.log('OK   ' + c.name);
  } else {
    failed++;
    console.log('FAIL ' + c.name);
  }
});

console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks OK');
process.exit(failed === 0 ? 0 : 1);
