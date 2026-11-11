// =====================================================================
// Test smoke — Constancia general del expediente + constancia por
// documento (2026-09-03).
//
// Verifica, sin levantar Electron:
//   1. Backend: ruta GET /internal/expedientes/:idTrabajador/constancia-consolidada.pdf
//      (registro en server.js, scope por empresa, al vuelo sin persistir).
//   2. Generador pdfGenConsolidado (resumen, tabla de docs, hitos,
//      trazabilidad, identificación ENMASCARADA, estados legibles).
//   3. Cadena main: firma-client -> firma-bridge (IPC + handler) -> preload.
//   4. Renderer: botón "Constancia" por documento firmado + botón de
//      constancia general + handler + contador coherente.
//   5. Regresión: helpers puras exportadas por pdfGen sin romper la
//      constancia individual (generación real incluida).
//
// Ejecutar (Electron como Node, que es como lo corre tools/run-all-tests.js):
//   $env:ELECTRON_RUN_AS_NODE="1"
//   & ".\node_modules\electron\dist\electron.exe" --test main/test-firma-constancia-consolidada.js
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

// ── Utilidades del propio test ─────────────────────────────────────────
// Quita los comentarios para que los guards miren CÓDIGO y no sus propios
// comentarios (PROMPT §7.1). Es el mismo helper que duplican varios tests
// del repo: no hay módulo común.
function soloCodigo(x) {
  return String(x).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}
const routeCode = soloCodigo(routeSrc);
const consGenCode = soloCodigo(consGenSrc);

// ── Derivación de las dos ramas de la consulta de la ruta ──────────────
// El aislamiento por empresa se deriva del CÓDIGO y no de un literal:
// el literal de la consulta ya cambió (`id_trabajador = ?` ->
// `id_trabajador IN (...)`, por la búsqueda multi-candidato de seudónimos)
// y un check amarrado a esa redacción se vuelve viejo sin que el producto
// cambie (PROMPT §7.4). Ver PROMPT §7.5.
const _ramasConsulta = (function () {
  const ifIdx = routeCode.indexOf("if (req.authSource === 'client') {");
  if (ifIdx < 0) return null;
  const elseIdx = routeCode.indexOf('} else {', ifIdx);
  if (elseIdx < 0) return null;
  function bloque(desde) {
    const ini = routeCode.indexOf('db.prepare(`', desde);
    if (ini < 0) return null;
    const fin = routeCode.indexOf('`', ini + 'db.prepare(`'.length);
    if (fin < 0) return null;
    const semi = routeCode.indexOf(';', fin);
    const sql = routeCode.slice(ini + 'db.prepare(`'.length, fin);
    const bind = routeCode.slice(fin, semi < 0 ? undefined : semi);
    const w = sql.match(/WHERE\b([\s\S]*?)(?:ORDER BY|$)/);
    return { sql: sql, where: w ? w[1] : '', bind: bind };
  }
  const client = bloque(ifIdx);
  const legacy = bloque(elseIdx);
  if (!client || !legacy) return null;
  return { client: client, legacy: legacy };
})();

const checks = [];

// ── Backend: ruta y registro ────────────────────────────────────────────
[
  ['server: registra el router de constancia', /require\('\.\/routes\/constancia'\)/],
  ['server: monta /internal antes del 404', /app\.use\('\/internal', constanciaRouter\)/],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1].test(serverSrc) }); });

[
  ['ruta: path /expedientes/:idTrabajador/constancia-consolidada.pdf', /router\.get\('\/expedientes\/:idTrabajador\/constancia-consolidada\.pdf'/],
  ['ruta: protegida con requireEmpresaScopeAndLimit', /requireEmpresaScopeAndLimit\(\{\s*allowedOperations: \['sign_request:read'\]/s],
  ['ruta: 404 silencioso si no hay solicitudes', /Expediente sin solicitudes de firma/],
  ['ruta: genera al vuelo (no escribe a disco)', /generateConstanciaConsolidadaPdf\(\{/],
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

// ── Aislamiento por empresa (derivado del código, no de un literal) ────
// En modo 'client' (API key por empresa) la consulta filtra por la empresa
// del token: un expediente de otra empresa devuelve 404 silencioso. En modo
// legacy no hay empresa en el token y NO se filtra, igual que el resto de
// rutas internas legacy. Ver firma-service/src/routes/constancia.js:100-128.
[
  ['ruta: la consulta se decide por authSource', !!_ramasConsulta],
  ['ruta: filtra por empresa en modo client', !!_ramasConsulta && /id_empresa\s*=\s*\?/.test(_ramasConsulta.client.where)],
  ['ruta: liga req.id_empresa al filtro de empresa', !!_ramasConsulta && /req\.id_empresa/.test(_ramasConsulta.client.bind)],
  ['ruta: la rama legacy NO filtra por empresa', !!_ramasConsulta && !/id_empresa/.test(_ramasConsulta.legacy.where)],
  ['ruta: la rama legacy NO liga req.id_empresa', !!_ramasConsulta && !/req\.id_empresa/.test(_ramasConsulta.legacy.bind)],
].forEach(function (c) { checks.push({ name: c[0], ok: c[1] }); });

// ── Identificación del firmante: ENMASCARADA, nunca el documento ───────
// Desde la migración 019 `id_trabajador` es el seudónimo HMAC del
// trabajador y el documento ya no está en la base de datos: lo que se
// archiva es la huella. La consolidada muestra los primeros 6 caracteres
// de esa huella (misma convención que la constancia individual y que la
// página de verificación pública). Ver routes/constancia.js:304-316.
// El tercer elemento `true` INVIERTE el check: exige que el literal NO
// aparezca (mismo idioma que el check invertido de
// test-firma-constancia-p0-p1.js: "no imprime la identificación en claro").
[
  ['ruta: identifica al firmante con la huella archivada enmascarada', /identificacion:\s*identificacion\.enmascarar\(\s*rows\[0\]\.identificacion_tipo,\s*rows\[0\]\.identificacion_numero_hash\s*\)/],
  ['ruta: NO pone el documento completo en la consolidada', /identificacion:\s*idTrabajador/, true],
  ['ruta: NO muestra la huella completa, la enmascara', /identificacion:\s*rows\[0\]\.identificacion_numero_hash/, true],
].forEach(function (c) {
  var ok = c[2] ? !c[1].test(routeCode) : c[1].test(routeCode);
  checks.push({ name: c[0], ok: ok });
});

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

// La Identificación que se imprime es la huella ENMASCARADA que llega en
// `trabajador.identificacion` (la ruta ya la enmascara). El check mira el
// CÓDIGO sin comentarios: el comentario de pdfGenConsolidado.js:192-194
// menciona `trabajador.identificacion` y un guard que mirara los
// comentarios pasaría siempre (PROMPT §7.1).
checks.push({
  name: 'consolidado: muestra la Identificación con la huella enmascarada',
  ok: /campo\(\s*'Identificación',[\s\S]{0,200}?trabajador\.identificacion/.test(consGenCode),
});

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

// ── Extractor de texto del PDF ─────────────────────────────────────────
// Mismo patrón que firma-service/tests/helpers.js:916-944 (no hay módulo
// común). TRAMPA: el hex se toma del GRUPO CAPTURADO, nunca de la
// coincidencia entera: si se hace `match.replace(/[<>\s]Tj/g, '')` los
// ángulos se quedan, el hex queda desalineado un byte y TODO el texto sale
// como basura.
function textoPdf(buffer) {
  const zlib = require('zlib');
  const raw = Buffer.from(buffer).toString('latin1');
  let streams = '';
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const chunk = Buffer.from(m[1], 'latin1');
    let inflado;
    try {
      inflado = zlib.inflateSync(chunk).toString('latin1');
    } catch (e) {
      inflado = m[1];
    }
    streams += inflado;
  }
  const partes = [];
  const reTj = /<([0-9A-Fa-f]*)>\s*Tj/g;
  let t;
  while ((t = reTj.exec(streams)) !== null) {
    const hex = t[1];
    let s = '';
    for (let i = 0; i + 1 < hex.length; i += 2) {
      s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    partes.push(s);
  }
  return partes.join('\n');
}

// ── Regresión real: la constancia consolidada se genera y solo lleva la ──
// huella enmascarada del firmante.
// Este bloque corre SIEMPRE. Antes solo entraba con `failed === 0`, o sea
// NUNCA (los checks estáticos estaban viejos y fallaban): un check de
// runtime que no se ejecuta no es un check.
//
// Para poder ejecutarlo hacen falta dos cosas que este archivo no puede dar
// por supuestas:
//  - `better-sqlite3` con el ABI de ESTE runtime: el build de
//    firma-service/node_modules está compilado para Node 22 (ABI 127) y no
//    carga en Electron 37 (ABI 136). Se prueban los dos builds y gana el
//    que cargue.
//  - una BD propia: DB_PATH apunta a un sqlite temporal, para no tocar
//    data/test.sqlite, que es compartido con la suite del firma-service.
const os = require('os');
const Module = require('module');

// Llave de PRUEBA (64 hex). Solo sirve para derivar la huella sintética
// del firmante de este test: no protege nada real y no sale del proceso.
const LLAVE_PRUEBA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const BD_TEMPORAL = path.join(os.tmpdir(), 'kair-consolidada-' + process.pid + '-' + Date.now() + '.sqlite');

process.env.NODE_ENV = 'development';
process.env.TOKEN_ENCRYPTION_KEY = LLAVE_PRUEBA;
process.env.FIRMA_HMAC_KEYRING = JSON.stringify({ k1: LLAVE_PRUEBA });
process.env.FIRMA_HMAC_KEY_VERSION = 'k1';
process.env.INTERNAL_API_KEY = LLAVE_PRUEBA;
process.env.ADMIN_API_KEY = LLAVE_PRUEBA;
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_USER = 'prueba';
process.env.SMTP_PASS = 'prueba';
process.env.SMTP_FROM_EMAIL = 'prueba@localhost';
process.env.DB_PATH = BD_TEMPORAL;

function driverSqlite() {
  const candidatos = [
    path.join(root, 'node_modules', 'better-sqlite3'),
    path.join(root, 'firma-service', 'node_modules', 'better-sqlite3'),
  ];
  const errores = [];
  for (const c of candidatos) {
    try {
      require(c);
      return c;
    } catch (e) {
      errores.push(path.basename(path.dirname(c)) + ': ' + String(e.message).split('\n')[0]);
    }
  }
  throw new Error('better-sqlite3: ningun build carga en ABI ' + process.versions.modules + ' (' + errores.join(' | ') + ')');
}
const RUTA_DRIVER = driverSqlite();
const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'better-sqlite3') {
    return resolverOriginal.call(this, RUTA_DRIVER, parent, isMain, options);
  }
  return resolverOriginal.call(this, request, parent, isMain, options);
};

(async function () {
  let runtimeFailed = 0;
  try {
    // El logger del servicio escribe JSON por stdout: se silencia con su
    // propio sink (no parcheando process.stdout) para no ensuciar la salida
    // del runner. Ver firma-service/src/utils/logger.js:77-98.
    require(path.join(root, 'firma-service', 'src', 'utils', 'logger.js'))._setSink(function () {});

    const pdfGen = require(path.join(root, 'firma-service', 'src', 'services', 'pdfGen.js'));
    const pdfGenConsolidado = require(path.join(root, 'firma-service', 'src', 'services', 'pdfGenConsolidado.js'));
    const publicFlow = require(path.join(root, 'firma-service', 'src', 'services', 'publicFlow.js'));
    const identificacion = require(path.join(root, 'firma-service', 'src', 'services', 'identificacion.js'));

    // 1) helpers exportadas disponibles y funcionales
    const fns = ['wrapText', 'truncHash', 'truncUA', 'fmtIdentificacionParcial', 'fmtFechaHora'];
    fns.forEach(function (f) {
      if (typeof pdfGen[f] !== 'function') { console.log('FAIL runtime: pdfGen.' + f); runtimeFailed++; }
    });
    if (typeof publicFlow._buildHitosFirma !== 'function') { console.log('FAIL runtime: publicFlow._buildHitosFirma'); runtimeFailed++; }

    // 2) huella del firmante: DATO REAL del servicio (HMAC), no un literal
    //    escrito a mano. Este documento no existe en ninguna base de datos.
    const documento = '80987654';
    const huella = identificacion.huella(documento, null, 'empresa-prueba');
    const enmascarada = identificacion.enmascarar('CC', huella);
    if (!/^[0-9a-f]{64}$/.test(huella)) { console.log('FAIL runtime: la huella no es un HMAC-SHA256'); runtimeFailed++; }
    if (enmascarada.indexOf(documento) !== -1) { console.log('FAIL runtime: la máscara contiene el documento'); runtimeFailed++; }
    if (enmascarada.indexOf(huella) !== -1) { console.log('FAIL runtime: la máscara contiene la huella completa'); runtimeFailed++; }

    // 3) consolidada con datos mixtos (firmada + pendiente) genera PDF válido
    const buf = await pdfGenConsolidado.generateConstanciaConsolidadaPdf({
      id_consolidada: 'test-uuid-0000',
      nombre_empresa: 'Empresa Test',
      trabajador: { nombre: 'Trabajador Test', identificacion_tipo: 'CC', identificacion: enmascarada },
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
    if (!buf || buf.length < 500) { console.log('FAIL runtime: consolidada pequeña/vacía'); runtimeFailed++; }
    if (buf.slice(0, 5).toString() !== '%PDF-') { console.log('FAIL runtime: no es PDF'); runtimeFailed++; }
    const pages = await pdfGen.getPdfPageCount(buf);
    if (!(pages >= 1)) { console.log('FAIL runtime: 0 páginas'); runtimeFailed++; }

    // 4) la consolidada lleva la huella ENMASCARADA y ni el documento ni la
    //    huella completa. El PDF usa WinAnsi: el prefijo es ASCII y se
    //    busca tal cual (la elipsis sale como 0x85).
    const texto = textoPdf(buf);
    const prefijo = 'CC ' + huella.substring(0, 6);
    if (texto.indexOf(prefijo) === -1) { console.log('FAIL runtime: la consolidada no muestra la huella enmascarada'); runtimeFailed++; }
    if (texto.indexOf(documento) !== -1) { console.log('FAIL runtime: la consolidada filtra el documento del firmante'); runtimeFailed++; }
    if (texto.indexOf(huella) !== -1) { console.log('FAIL runtime: la consolidada filtra la huella completa'); runtimeFailed++; }

    console.log('\nRuntime: consolidada generada OK (' + buf.length + ' bytes, ' + pages + ' páginas, identificación ' + prefijo + '…)');
  } catch (e) {
    console.log('FAIL runtime: ' + e.message);
    runtimeFailed++;
  } finally {
    Module._resolveFilename = resolverOriginal;
    // En Windows no se puede borrar un archivo que SQLite tiene abierto:
    // se cierra la BD antes de borrarla, si llegó a abrirla.
    try {
      const bd = require(path.join(root, 'firma-service', 'src', 'db', 'connection.js'));
      if (bd && bd.open) bd.close();
    } catch (e) { /* la BD puede no haberse abierto */ }
    [BD_TEMPORAL, BD_TEMPORAL + '-wal', BD_TEMPORAL + '-shm'].forEach(function (p) {
      try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* mejor esfuerzo */ }
    });
  }
  failed += runtimeFailed;
  console.log('\n' + (checks.length - failed) + '/' + checks.length + ' checks estáticos + runtime OK');
  process.exit(failed === 0 ? 0 : 1);
})();
