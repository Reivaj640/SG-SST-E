// =====================================================================
// Test smoke — Constancia general del expediente + constancia por
// documento (2026-09-03).
//
// Verifica, sin levantar Electron:
//   1. Backend: ruta GET /internal/expedientes/:idTrabajador/constancia-consolidada.pdf
//      (registro en server.js, scope por empresa, al vuelo sin persistir).
//   2. Generador pdfGenConsolidado (resumen, tabla de docs, hitos,
//      trazabilidad, cédula COMPLETA, estados legibles).
//   3. Cadena main: firma-client -> firma-bridge (IPC + handler) -> preload.
//   4. Renderer: botón "Constancia" por documento firmado + botón de
//      constancia general + handler + contador coherente.
//   5. Regresión: helpers puras exportadas por pdfGen sin romper la
//      constancia individual (generación real incluida).
//
// Ejecutar: node main/test-firma-constancia-consolidada.js
// =====================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const R = function (p) { return fs.readFileSync(path.join(root, p), 'utf8'); };

const serverSrc = R(path.join('firma-service', 'src', 'server.js'));
const routeSrc = R(path.join('firma-service', 'src', 'routes', 'constancia.js'));
const consGenSrc = R(path.join('firma-service', 'src', 'services', 'pdfGenConsolidado.js'));
const pdfGenSrc = R(path.join('firma-service', 'src', 'services', 'pdfGen.js'));
const publicFlowSrc = R(path.join('firma-service', 'src', 'services', 'publicFlow.js'));
const clientSrc = R(path.join('main', 'firma-client.js'));
const bridgeSrc = R(path.join('main', 'firma-bridge.js'));
const preloadSrc = R('preload.js');
const rendererSrc = R(path.join('modules', 'gestion-humana', 'firma-electronica', 'index.js'));
const rendererCssSrc = R(path.join('modules', 'gestion-humana', 'firma-electronica', 'index.css'));

const checks = [];

// ── Backend: ruta y registro ────────────────────────────────────────────
[
  ['server: registra el router de constancia', /require\('\.\/routes\/constancia'\)/],
  ['server: monta /internal antes del 404', /app\.use\('\/internal', constanciaRouter\)/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(serverSrc) }); });

[
  ['ruta: path /expedientes/:idTrabajador/constancia-consolidada.pdf', /router\.get\('\/expedientes\/:idTrabajador\/constancia-consolidada\.pdf'/],
  ['ruta: protegida con requireEmpresaScopeAndLimit', /requireEmpresaScopeAndLimit\(\{\s*allowedOperations: \['sign_request:read'\]/s],
  ['ruta: filtra por empresa en modo client', /id_trabajador = \? AND id_empresa = \?/],
  ['ruta: maneja modo legacy sin filtro de empresa', /req\.authSource === 'client'/],
  ['ruta: 404 silencioso si no hay solicitudes', /Expediente sin solicitudes de firma/],
  ['ruta: genera al vuelo (no escribe a disco)', /generateConstanciaConsolidadaPdf\(\{/],
  ['ruta: cédula COMPLETA en la consolidada', /identificacion: idTrabajador, \/\/ completa: documento interno/],
  ['ruta: NIT desde id_empresa de las solicitudes', /nit_empresa: rows\[0\]\.id_empresa/],
  ['ruta: correo de la empresa desde metadata (correo_empresa)', /correoEmpresa = m\.correo_empresa/],
  ['ruta: correo del trabajador con fallback entre solicitudes', /correo_trabajador: sr\.correo_verificacion \|\| correoTrabajadorInvitacion/],
  ['ruta: parsea mapa de títulos del query param', /req\.query\.titulos/],
  ['ruta: nombre del documento con cadena de fallback', /nombreDocumento =\s*[\s\S]*titulosPorSolicitud\[sr\.id_solicitud\]/],
  ['ruta: Content-Disposition attachment con nombre del expediente', /attachment; filename="\$\{filename\}"/],
  ['ruta: reutiliza _buildHitosFirma de publicFlow', /publicFlow\._buildHitosFirma/],
  ['ruta: reutiliza _getConsentResumen de publicFlow', /publicFlow\._getConsentResumen/],
  ['ruta: hash SHA-256 de la constancia en header', /X-Constancia-SHA256/],
  ['ruta: lee snapshot del representante', /representante_legal_snapshot/],
  ['ruta: enlace de verificación por documento', /url_verificacion/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(routeSrc) }); });

// ── publicFlow: helpers exportados ──────────────────────────────────────
[
  ['publicFlow: exporta _buildHitosFirma', /_buildHitosFirma: _buildHitosFirma/],
  ['publicFlow: exporta _getConsentResumen', /_getConsentResumen: _getConsentResumen/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(publicFlowSrc) }); });

// ── pdfGen: helpers puras movidas a top-level y exportadas ──────────────
[
  ['pdfGen: wrapText a top-level', /^function wrapText\(/m],
  ['pdfGen: fmtIdentificacionParcial a top-level', /^function fmtIdentificacionParcial\(/m],
  ['pdfGen: fmtFechaHora a top-level', /^function fmtFechaHora\(/m],
  ['pdfGen: exporta EVENTO_LABEL', /EVENTO_LABEL,/],
  ['pdfGen: exporta MARCO_LEGAL_LINEAS', /MARCO_LEGAL_LINEAS,/],
  ['pdfGen: exporta wrapText', /wrapText,/],
  ['pdfGen: exporta truncHash', /truncHash,/],
  ['pdfGen: exporta fmtIdentificacionParcial', /fmtIdentificacionParcial,/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(pdfGenSrc) }); });

// ── Generador consolidado ────────────────────────────────────────────────
[
  ['consolidado: exporta generateConstanciaConsolidadaPdf', /module\.exports = \{\s*generateConstanciaConsolidadaPdf/],
  ['consolidado: tiene sección Resumen del expediente', /seccion\('Resumen del expediente'\)/],
  ['consolidado: muestra Empresa y su NIT', /campo\('Empresa'.*campo\('NIT'/s],
  ['consolidado: muestra correo de la empresa', /campo\('Correo de la empresa'/],
  ['consolidado: muestra correo del emisor (invitaciones)', /campo\('Correo del emisor \(invitaciones\)'/],
  ['consolidado: muestra correo del trabajador (invitación)', /campo\('Correo del trabajador \(invitación\)'/],
  ['consolidado: muestra totales firmados/pendientes', /campo\('Firmados'.*campo\('Pendientes de firma'/s],
  ['consolidado: ID de esta constancia general', /campo\('ID de esta constancia general'/],
  ['consolidado: tabla/documentos por expediente', /seccion\('Documentos del expediente \('\s*\+\s*documentos\.length\s*\+\s*'\)'\)/],
  ['consolidado: listado usa nombre real del documento', /doc\.nombre_documento \|\| doc\.asunto_documento \|\| doc\.id_solicitud/],
  ['consolidado: banda por documento', /'DOCUMENTO '\s*\+\s*idx\s*\+\s*' de '/],
  ['consolidado: sección de doc muestra Documento + ID interno', /campo\('Documento'.*campo\('ID interno del documento'/s],
  ['consolidado: correo del firmante por documento', /campo\('Correo del firmante \(invitación\)'/],
  ['consolidado: hitos por documento', /seccion\('Hitos de la firma'\)/],
  ['consolidado: evidencia criptográfica si firmado (SIGNED o DUAL_FIRMADO)', /if \(esFirmado\(doc\.estado\)\) \{\s*seccion\('Evidencia criptográfica'\)/],
  ['consolidado: DUAL_FIRMADO cuenta como firmado', /DUAL_FIRMADO/],
  ['consolidado: etiqueta legible doble firma', /DUAL_FIRMADO: 'Firmado \(doble firma\)'/],
  ['consolidado: bloque Firmante empresa desde snapshot', /Firmante empresa/],
  ['consolidado: consent con rol del firmante', /consent_rol/],
  ['consolidado: nota régimen anterior compartido', /régimen anterior/],
  ['consolidado: enlace de verificación por documento', /url_verificacion/],
  ['consolidado: pie encargado en nombre de (Ley 1581)', /encargado del tratamiento en nombre de/],
  ['consolidado: trazabilidad con total', /seccion\('Trazabilidad de eventos'/],
  ['consolidado: marco legal incluido', /MARCO_LEGAL_LINEAS\.forEach/],
  ['consolidado: declaración de integridad', /seccion\('Declaración de integridad'\)/],
  ['consolidado: estados legibles (Firmado)', /SIGNED: 'Firmado'/],
  ['consolidado: estado pendiente legible', /PENDING: 'Pendiente de envío al firmante'/],
  ['consolidado: reutiliza helpers de pdfGen', /require\('\.\/pdfGen'\)/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(consGenSrc) }); });

// ── Cliente / bridge / preload ───────────────────────────────────────────
[
  ['client: método getExpedienteConstanciaConsolidada', /function getExpedienteConstanciaConsolidada\(idTrabajador, opts\)/],
  ['client: URL del endpoint consolidado', /\/internal\/expedientes\/' \+ encodeURIComponent\(idTrabajador\) \+ '\/constancia-consolidada\.pdf'/],
  ['client: pasa títulos como query param', /\?titulos=' \+ encodeURIComponent\(JSON\.stringify\(opts\.titulos\)\)/],
  ['client: exportado en la factory', /getExpedienteConstanciaConsolidada: getExpedienteConstanciaConsolidada/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(clientSrc) }); });

[
  ['bridge: handler _handlerExpedienteConstanciaSaveAs', /function _handlerExpedienteConstanciaSaveAs\(args\)/],
  ['bridge: registra IPC firma:expediente:constancia-save-as', /handle\('firma:expediente:constancia-save-as'/],
  ['bridge: reenvía títulos al client', /getExpedienteConstanciaConsolidada\(args\.id, \{ titulos: args\.titulos \|\| null \}\)/],
  ['bridge: usa dialog.showSaveDialog (no bytes al renderer)', /dialog\.showSaveDialog/],
  ['bridge: nombre por defecto expediente-<cedula>', /'expediente-' \+ args\.id \+ '-constancia-consolidada\.pdf'/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(bridgeSrc) }); });

[
  ['preload: expone firmaExpedienteConstanciaSaveAs', /firmaExpedienteConstanciaSaveAs: \(id, args\) => ipcRenderer\.invoke\('firma:expediente:constancia-save-as'/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(preloadSrc) }); });

// ── Renderer ─────────────────────────────────────────────────────────────
[
  ['renderer: botón Constancia por documento (SIGNED)', /data-action="descargar-constancia-doc" data-sr-id="/],
  ['renderer: botón por doc solo si sr.data.estado === SIGNED', /srFirmado = !!\(sr && sr\.ok && sr\.data && sr\.data\.estado === 'SIGNED'\)/],
  ['renderer: dispatch descargar-constancia-doc', /action === 'descargar-constancia-doc'/],
  ['renderer: dispatch descargar-constancia-expediente', /action === 'descargar-constancia-expediente'/],
  ['renderer: handler _actionDescargarConstanciaExpediente', /prototype\._actionDescargarConstanciaExpediente = async function \(\)/],
  ['renderer: obtiene cédula del trabajador', /trabajador\.cedula \|\| trabajador\.id/],
  ['renderer: llama firmaExpedienteConstanciaSaveAs', /window\.electronAPI\.firmaExpedienteConstanciaSaveAs\(cedula/],
  ['renderer: arma mapa de títulos porSolicitud/porDocId', /titulos = \{ porSolicitud: \{\}, porDocId: \{\} \}/],
  ['renderer: pasa títulos a la IPC', /\{ companyName: self\.companyName, titulos: titulos \}/],
  ['renderer: botón constancia general con acción nueva', /data-action="descargar-constancia-expediente"/],
  ['renderer: habilitada si hay solicitudes', /haySolicitudes = data\.signRequests\.some/],
  ['renderer: contador incluye constancia general', /if \(haySolicitudes\) accionesHabilitadas\+\+/],
  ['renderer: contador de ver firmado solo +1', /if \(puedeVerPdf\) accionesHabilitadas\+\+/],
  ['renderer: mantiene manejo de r.canceled', /r\.canceled[\s\S]{0,200}Descarga cancelada/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(rendererSrc) }); });

[
  ['css: modificador fe-exp-action--enabled', /\.fe-exp-action--enabled\s*\{/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(rendererCssSrc) }); });

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

// ── Regresión real: la constancia individual y la consolidada generan ────
if (failed === 0) {
  (async function () {
    try {
      const pdfGen = require(path.join(root, 'firma-service', 'src', 'services', 'pdfGen.js'));
      const pdfGenConsolidado = require(path.join(root, 'firma-service', 'src', 'services', 'pdfGenConsolidado.js'));
      const publicFlow = require(path.join(root, 'firma-service', 'src', 'services', 'publicFlow.js'));

      // 1) helpers exportadas disponibles y funcionales
      const fns = ['wrapText', 'truncHash', 'truncUA', 'fmtIdentificacionParcial', 'fmtFechaHora'];
      fns.forEach(function (f) {
        if (typeof pdfGen[f] !== 'function') { console.log('FAIL runtime: pdfGen.' + f); failed++; }
      });
      if (typeof publicFlow._buildHitosFirma !== 'function') { console.log('FAIL runtime: publicFlow._buildHitosFirma'); failed++; }

      // 2) consolidada con datos mixtos (firmada + pendiente) genera PDF válido
      const buf = await pdfGenConsolidado.generateConstanciaConsolidadaPdf({
        id_consolidada: 'test-uuid-0000',
        nombre_empresa: 'Empresa Test',
        trabajador: { nombre: 'Trabajador Test', identificacion_tipo: 'CC', identificacion: '2222222222' },
        zona_horaria: 'America/Bogota',
        generado_en: new Date().toISOString(),
        documentos: [
          {
            asunto_documento: 'Contrato Laboral', id_solicitud: 'SIGN-2026-000001',
            estado: 'SIGNED', correo_trabajador: 't@x.com', correo_emisor: 'e@x.com',
            fecha_creacion: new Date().toISOString(), fecha_firma: new Date().toISOString(),
            hitos_firma: [{ label: 'Solicitud enviada', fecha_hora: new Date().toISOString(), estado: 'Registrada' }],
            eventos: [{ evento: 'CREATED', fecha_hora: new Date().toISOString(), ip: '1.2.3.4', id_actor: 'empresa' }],
            eventos_total: 1,
            document_hash_original: 'a'.repeat(64), document_hash_firmado: 'b'.repeat(64),
            evidence_hash: 'c'.repeat(64), id_constancia: 'cid-1',
            consent_id: 'cons-1', fecha_aceptacion_acuerdo: new Date().toISOString(),
          },
          {
            asunto_documento: 'Documento Pendiente', id_solicitud: 'SIGN-2026-000002',
            estado: 'PENDING', fecha_creacion: new Date().toISOString(),
            hitos_firma: [], eventos: [], eventos_total: 0,
          },
        ],
        totales: { documentos: 2, firmados: 1, pendientes: 1 },
      });
      if (!buf || buf.length < 500) { console.log('FAIL runtime: consolidada pequeña/vacía'); failed++; }
      if (buf.slice(0, 5).toString() !== '%PDF-') { console.log('FAIL runtime: no es PDF'); failed++; }
      const pages = await pdfGen.getPdfPageCount(buf);
      if (!(pages >= 1)) { console.log('FAIL runtime: 0 páginas'); failed++; }
      console.log('\nRuntime: consolidada generada OK (' + buf.length + ' bytes, ' + pages + ' páginas)');
    } catch (e) {
      console.log('FAIL runtime: ' + e.message);
      failed++;
    }
    console.log('\n' + (checks.length - failed) + '/' + (checks.length + 0) + ' checks estáticos + runtime OK');
    process.exit(failed === 0 ? 0 : 1);
  })();
} else {
  process.exit(1);
}
