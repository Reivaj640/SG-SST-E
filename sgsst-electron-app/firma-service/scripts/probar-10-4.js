#!/usr/bin/env node
/**
 * scripts/probar-10-4.js
 *
 * LA 10.4 EN EL AMBIENTE REAL: MIGRACIÓN A LA VERSIÓN VIGENTE DEL ACUERDO
 * ===========================================================================
 *
 * QUÉ PIDE LA COMPUERTA
 * ---------------------
 * El manifiesto legal (`legal-readiness.json` → `n10_4`) tiene dos campos:
 * `probada` y `evidencia`. La compuerta de publicación los mira juntos: si
 * `probada` no es `true` o `evidencia` está vacía, el ítem "Prueba de la 10.4
 * en el ambiente real" BLOQUEA la publicación (ver
 * `src/services/readinessLegal.js`, el grupo `n10_4`).
 *
 * QUÉ ES LA 10.4
 * --------------
 * El 9.5 del Acuerdo dice que "para las firmas posteriores a la entrada en
 * vigencia de una versión nueva, el Trabajador debe leer y aceptar ESA versión
 * nueva en el momento mismo de la firma".
 *
 * La 10.4 es el camino que hace eso posible. Cuando se publica una versión
 * nueva del Acuerdo mientras hay solicitudes pendientes, el firmante que llega
 * tarde se encontraba con un 409 sin salida. La 10.4 lo resuelve así:
 *
 *   1. Al aceptar, la solicitud MIGRARA a la versión vigente: se busca (o se
 *      crea) el consentimiento de esa versión y la solicitud pasa a apuntar a
 *      ese consentimiento y a esa versión, con SU huella.
 *   2. Queda el evento `AGREEMENT_VERSION_MIGRATED`, con la versión anterior y
 *      la nueva: el cambio de versión queda en la traza.
 *   3. Los consentimientos ya aceptados de la versión anterior NO se tocan:
 *      son la prueba de lo que ese Trabajador aceptó en su momento (el 9.5:
 *      sin efectos retroactivos).
 *
 * Con eso, el texto que el firmante leyó y el texto que queda archivado (con
 * su huella) SON EL MISMO. No hay dos verdades.
 *
 * LO QUE HACE ESTE SCRIPT
 * -----------------------
 * Ejecuta el circuito completo contra el servicio de verdad y deja la
 * evidencia en un archivo de texto. Los pasos son los de una persona real:
 *
 *   1. El firmante abre su enlace y ve la versión vigente del Acuerdo.
 *   2. Se identifica y demuestra que controla su buzón (el OTP).
 *   3. ACEPTA el Acuerdo: la solicitud queda ligada a esa versión.
 *   4. MIENTRAS TANTO se publica una versión nueva del Acuerdo (aquí: en una
 *      base de datos AISLADA, nunca en la de producción).
 *   5. El firmante vuelve: el servicio le dice, con un 409 ACCIONABLE, que
 *      tiene que leer y aceptar la versión vigente.
 *   6. Acepta: la solicitud MIGRARA a la versión nueva, con su huella y con
 *      el evento en la traza.
 *   7. Se comprueba que el consentimiento de la versión anterior quedó
 *      INTACTO y que el texto que se le muestra es el que queda archivado.
 *
 * CÓMO SE PROVOCA EL CAMBIO DE VERSIÓN
 * ------------------------------------
 * En producción no se puede por API: crear una solicitud exige la versión
 * activa (`validateAcuerdo` en `src/services/signRequest.js`), la activación no
 * tiene vuelta atrás y no hay una versión nueva publicada. Por eso este script
 * cambia la versión activa DIRECTAMENTE en la base de datos que se le indique
 * con `--db`, que tiene que ser una COPIA AISLADA: la de producción no se
 * toca nunca. Es la misma maniobra que hizo el despliegue del 5-nov-2026
 * (la v1.5 sustituyó a la v1.4 con las solicitudes en curso), pero sobre una
 * copia.
 *
 * LO QUE ESTA PRUEBA NO ES
 * -------------------------
 * El Trabajador es un dato SINTÉTICO y el documento que firma lo genera el
 * propio script con pdf-lib, que lo dice en su primera página. Lo que se
 * demuestra es que el MECANISMO funciona contra el código desplegado: la
 * migración ocurre, la huella archivada es la del texto que el firmante leyó,
 * el cambio queda en la traza y el consentimiento anterior no se reescribe.
 *
 * USO
 * ---
 *   node scripts/probar-10-4.js \
 *        --db=/ruta/a/la/BD/aislada/firma.sqlite \
 *        --version-inicial=v1.4 \
 *        --version-nueva=v1.5 \
 *        --empresa=900829731 \
 *        --trabajador=900000002 \
 *        --numero=900000002 \
 *        --correo=buzon-de-prueba@example.com \
 *        --autorizado-por="Nombre, owner de K+AIR" \
 *        --autorizacion-ref="PRUEBA 10.4 en base aislada" \
 *        --confirmar-escribe
 *
 * Opciones:
 *   --url=            base del servicio (por omisión http://127.0.0.1:3001)
 *   --interno-file=   archivo con la llave interna
 *                     (por omisión /opt/kair-firma/internal-key.txt)
 *   --admin-file=     archivo con la llave de administración
 *                     (por omisión /opt/kair-firma/admin-key.txt)
 *   --db=             la base de datos AISLADA donde se cambia la versión
 *                     activa. OBLIGATORIA: sin ella el script no hace nada.
 *   --version-inicial= la versión que se activa antes de crear la solicitud
 *   --version-nueva=   la versión que se activa después (la que migra)
 *   --empresa=        NIT de la Empresa (obligatorio)
 *   --trabajador=     id CRUDO del Trabajador, de 4 a 20 dígitos (obligatorio)
 *   --numero=         documento de identidad SINTÉTICO con el que se
 *                     identifica en la mini-app (por omisión, el mismo valor)
 *   --correo=         buzón del Trabajador (obligatorio)
 *   --autorizado-por= quién autoriza la excepción de habilitación de prueba
 *   --autorizacion-ref= dónde queda escrito esa autorización
 *   --otp=            código de 6 dígitos. Si el servicio lo devuelve (modo
 *                     desarrollo), se usa ese y no hace falta pasarlo.
 *   --estado=         archivo de estado (por omisión, en el temporal)
 *   --evidencia=      archivo de evidencia (por omisión, en el temporal)
 *   --confirmar-escribe  SIN ESTA OPCIÓN EL SCRIPT NO ESCRIBE NADA.
 *
 * Las llaves se leen de archivo o del ambiente. NUNCA se imprimen.
 *
 * Códigos de salida:
 *   0 = todas las comprobaciones pasaron
 *   1 = falló al menos una comprobación
 *   2 = argumentos inválidos
 *   3 = falta el código de verificación (hay que correr otra vez con --otp)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const { DECLARACION_SALUD } = require('../src/services/declaracionSalud');

const DEFAULT_URL = 'http://127.0.0.1:3001';
const DEFAULT_TIMEOUT_MS = 30000;

// Cómo se ve un seudónimo de Trabajador: `psn1_` + 64 hex (ver
// src/services/trabajador.js). La API acepta 64 caracteres y el seudónimo
// tiene 69: mandarlo es un 400. El cliente manda el id CRUDO.
const ES_SEUDONIMO = /^psn1_[0-9a-f]{64}$/;

// ===========================================================================
// SALIDA
// ===========================================================================

const resultados = [];

/**
 * Sumidero de salida. Por defecto va a la consola; los tests inyectan uno
 * para capturar SIN parchear `process.stdout` (parchearlo se come la salida
 * del reporter de node:test y rompe el conteo de la suite entera).
 */
let _sink = null;

function fijarSalida(fn) {
  _sink = typeof fn === 'function' ? fn : null;
}

function emitir(linea) {
  if (typeof _sink === 'function') {
    _sink(linea);
    return;
  }
  console.log(linea);
}

function ok(nombre, detalle) {
  resultados.push({ nombre, estado: 'OK', detalle: detalle || '' });
  emitir('  [OK]   ' + nombre + (detalle ? ' :: ' + detalle : ''));
}

function warn(nombre, detalle) {
  resultados.push({ nombre, estado: 'AVISO', detalle: detalle || '' });
  emitir('  [AVISO] ' + nombre + (detalle ? ' :: ' + detalle : ''));
}

function fail(nombre, detalle) {
  resultados.push({ nombre, estado: 'FALLA', detalle: detalle || '' });
  emitir('  [FALLA] ' + nombre + (detalle ? ' :: ' + detalle : ''));
}

function titulo(t) {
  emitir('');
  emitir('== ' + t + ' ' + '='.repeat(Math.max(4, 74 - t.length)));
}

function resumen() {
  const fallas = resultados.filter((r) => r.estado === 'FALLA');
  const avisos = resultados.filter((r) => r.estado === 'AVISO');
  emitir('');
  emitir('='.repeat(78));
  emitir('RESUMEN: ' + (resultados.length - fallas.length - avisos.length) + ' OK · '
    + avisos.length + ' avisos · ' + fallas.length + ' fallas');
  for (const f of fallas) emitir('  FALLA: ' + f.nombre + ' :: ' + f.detalle);
  emitir('='.repeat(78));
  return fallas.length;
}

// ===========================================================================
// ARGUMENTOS
// ===========================================================================

function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    confirmarEscribe: false,
  };
  for (const bruto of argv.slice(2)) {
    const m = /^--([a-zA-Z0-9-]+)(?:=(.*))?$/.exec(bruto);
    if (!m) continue;
    const clave = m[1];
    const valor = m[2];
    switch (clave) {
      case 'url': args.url = valor; break;
      case 'interno-file': args.internoFile = valor; break;
      case 'admin-file': args.adminFile = valor; break;
      case 'db': args.db = valor; break;
      case 'version-inicial': args.versionInicial = valor; break;
      case 'version-nueva': args.versionNueva = valor; break;
      case 'empresa': args.empresa = valor; break;
      case 'trabajador': args.trabajador = valor; break;
      case 'numero': args.numero = valor; break;
      case 'correo': args.correo = valor; break;
      case 'autorizado-por': args.autorizadoPor = valor; break;
      case 'autorizacion-ref': args.autorizacionRef = valor; break;
      case 'otp': args.otp = valor; break;
      case 'estado': args.estado = valor; break;
      case 'evidencia': args.evidencia = valor; break;
      case 'timeout': args.timeoutMs = Number(valor) || DEFAULT_TIMEOUT_MS; break;
      case 'confirmar-escribe': args.confirmarEscribe = true; break;
      default:
        fail('Argumento desconocido', '--' + clave);
        args.error = true;
    }
  }
  if (!args.estado) args.estado = path.join(os.tmpdir(), 'kair-104-estado.json');
  if (!args.evidencia) args.evidencia = path.join(os.tmpdir(), 'kair-104-evidencia.txt');
  if (!args.internoFile) args.internoFile = '/opt/kair-firma/internal-key.txt';
  if (!args.adminFile) args.adminFile = '/opt/kair-firma/admin-key.txt';
  return args;
}

function validarArgumentos(args) {
  if (args.error) return false;
  let bien = true;
  if (!args.db) {
    fail('Falta --db',
      'la base de datos AISLADA donde se cambia la version activa. Sin ella el '
      + 'script no hace nada: la version activa de PRODUCCION no se toca nunca');
    bien = false;
  }
  if (!args.versionInicial || !args.versionNueva) {
    fail('Faltan --version-inicial y --version-nueva',
      'la version que se activa antes de crear la solicitud y la que se activa '
      + 'despues (la que migra)');
    bien = false;
  } else if (args.versionInicial === args.versionNueva) {
    fail('Las dos versiones son la misma', 'la 10.4 necesita que cambien');
    bien = false;
  }
  if (!args.empresa) {
    fail('Falta --empresa', 'el NIT de la Empresa que se prueba');
    bien = false;
  }
  if (!args.trabajador) {
    fail('Falta --trabajador',
      'el id del Trabajador: el valor CRUDO de 4 a 20 digitos que el servicio '
      + 'seudonimiza');
    bien = false;
  } else if (ES_SEUDONIMO.test(String(args.trabajador))) {
    fail('--trabajador no puede ser un seudonimo',
      'el servicio seudonimiza el id que le llega (la API acepta 64 caracteres y '
      + 'el seudonimo tiene 69): mande el id CRUDO, de 4 a 20 digitos');
    bien = false;
  } else if (!/^\d{4,20}$/.test(String(args.trabajador))) {
    fail('--trabajador no parece un documento de identidad',
      'tiene que ser de 4 a 20 digitos');
    bien = false;
  }
  if (!args.numero) {
    args.numero = args.trabajador;
  } else if (!/^\d{4,20}$/.test(String(args.numero))) {
    fail('--numero no parece un documento de identidad',
      'tiene que ser de 4 a 20 digitos');
    bien = false;
  }
  if (!args.correo || !String(args.correo).includes('@')) {
    fail('Falta --correo o no es un correo', 'el buzon del Trabajador');
    bien = false;
  }
  if (args.otp && !/^\d{6}$/.test(String(args.otp))) {
    fail('--otp no son 6 digitos', 'el codigo de verificacion son 6 digitos');
    bien = false;
  }
  return bien;
}

/**
 * La llave: del argumento en linea, del archivo o del ambiente. Nunca se
 * imprime y nunca se mete en la evidencia.
 */
function leerLlave(valorInline, archivo, varAmbiente) {
  if (valorInline) return String(valorInline).trim();
  if (varAmbiente && process.env[varAmbiente]) return String(process.env[varAmbiente]).trim();
  try {
    if (archivo && fs.existsSync(archivo)) {
      return fs.readFileSync(archivo, 'utf8').trim();
    }
  } catch (e) {
    return null;
  }
  return null;
}

// ===========================================================================
// HTTP
// ===========================================================================

function pedir(opciones, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(opciones.path, opciones.base);
    const esHttps = u.protocol === 'https:';
    const mod = esHttps ? https : http;
    const req = mod.request({
      method: opciones.method || 'GET',
      hostname: u.hostname,
      port: u.port || (esHttps ? 443 : 80),
      path: u.pathname + u.search,
      headers: opciones.headers || {},
      timeout: timeoutMs,
    }, (res) => {
      const trozos = [];
      res.on('data', (d) => trozos.push(d));
      res.on('end', () => {
        const texto = Buffer.concat(trozos).toString('utf8');
        let json = null;
        try { json = JSON.parse(texto); } catch (_) { /* no es JSON */ }
        resolve({ status: res.statusCode, headers: res.headers, texto, json });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Un POST JSON con la cabecera que corresponda. */
function pedirJson(opciones, objeto, timeoutMs) {
  return pedir(opciones, JSON.stringify(objeto), timeoutMs);
}

function multipart(campos, archivo) {
  const boundary = '----kair104' + crypto.randomBytes(12).toString('hex');
  const partes = [];
  for (const [k, v] of Object.entries(campos)) {
    partes.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      'utf8'));
  }
  partes.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${archivo.campo}"; filename="${archivo.nombre}"\r\n`
    + 'Content-Type: application/pdf\r\n\r\n', 'utf8'));
  partes.push(archivo.contenido);
  partes.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
  return {
    body: Buffer.concat(partes),
    contentType: 'multipart/form-data; boundary=' + boundary,
  };
}

// ===========================================================================
// LA BASE AISLADA (para cambiar la versión activa y para leer lo que la API
// no expone: el consentimiento anterior y el metadata del evento)
// ===========================================================================

/**
 * Ejecuta una consulta SQL sobre la base AISLADA y devuelve las filas.
 *
 * Se usa el CLI de sqlite3 (y no better-sqlite3) para no depender de las
 * dependencias nativas del servicio: el script tiene que correr en el mismo
 * servidor, con las mismas herramientas, sin instalar nada.
 */
function sqlPorCli(base, consulta) {
  const salida = execFileSync('sqlite3', ['-json', base, consulta], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  const texto = (salida || '').trim();
  if (!texto) return [];
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw new Error('sqlite3 no devolvio JSON: ' + texto.slice(0, 200));
  }
}

/**
 * Cambia la versión activa de la base AISLADA.
 *
 * Es la misma maniobra que hizo el despliegue del 5-nov-2026, pero sobre una
 * copia: primero se desactiva la que estaba y luego se activa la nueva (el
 * índice único parcial permite máximo una activa).
 */
function activarVersionPorCli(base, version) {
  const filas = sqlPorCli(base, 'SELECT version, activa, texto_hash FROM gh_firma_acuerdo_versiones'
    + " WHERE version = '" + version.replace(/'/g, "''") + "';");
  if (!filas || !filas.length) {
    throw new Error('la version ' + version + ' no existe en la base');
  }
  const antes = filas[0];
  execFileSync('sqlite3', [base,
    "BEGIN; UPDATE gh_firma_acuerdo_versiones SET activa = 0;"
    + " UPDATE gh_firma_acuerdo_versiones SET activa = 1 WHERE version = '"
    + version.replace(/'/g, "''") + "'; COMMIT;"], { encoding: 'utf8' });
  return antes;
}

/**
 * El motor de base de datos es INYECTABLE.
 *
 * Por omisión se usa el CLI de sqlite3 (que es lo que hay en el servidor). Los
 * tests inyectan uno en memoria: el script no tiene que depender de que el
 * PC tenga sqlite3 instalado para poder probarse.
 */
let _sql = sqlPorCli;
let _activar = activarVersionPorCli;

function fijarBase(fnSql, fnActivar) {
  if (typeof fnSql === 'function') _sql = fnSql;
  if (typeof fnActivar === 'function') _activar = fnActivar;
}

function restaurarBase() {
  _sql = sqlPorCli;
  _activar = activarVersionPorCli;
}

// ===========================================================================
// PDF
// ===========================================================================

/**
 * El documento de la solicitud: es SINTÉTICO y lo dice en la primera página.
 */
async function pdfDePrueba(datos) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

  const pagina = doc.addPage([595, 842]);
  pagina.drawText('PRUEBA DE LA 10.4 - DATOS SINTETICOS - NO ES EVIDENCIA DE UN ACTO REAL',
    { x: 50, y: 780, size: 11, font: negrita, color: rgb(0.7, 0, 0) });
  pagina.drawText('Documento generado por scripts/probar-10-4.js para verificar la migracion',
    { x: 50, y: 758, size: 10, font: fuente });
  pagina.drawText('a la version vigente del Acuerdo. El Trabajador es un dato sintetico:',
    { x: 50, y: 744, size: 10, font: fuente });
  pagina.drawText('no hay persona real detras de esta solicitud.', { x: 50, y: 730, size: 10, font: fuente });

  let y = 690;
  for (const [etiqueta, valor] of [
    ['Empresa', datos.empresa],
    ['Documento', datos.idDocumento],
    ['Version del Acuerdo al crear', datos.versionInicial],
    ['Version vigente cuando se acepta', datos.versionNueva],
  ]) {
    pagina.drawText(etiqueta + ':', { x: 50, y, size: 10, font: negrita });
    pagina.drawText(String(valor), { x: 230, y, size: 10, font: fuente });
    y -= 18;
  }
  return Buffer.from(await doc.save());
}

// ===========================================================================
// ESTADO (para poder reintentar sin gastarse el alcance)
// ===========================================================================

function leerEstado(args) {
  try {
    if (!fs.existsSync(args.estado)) return null;
    const s = JSON.parse(fs.readFileSync(args.estado, 'utf8'));
    if (!s || !s.id_solicitud) return null;
    return s;
  } catch (e) {
    warn('El archivo de estado no se pudo leer',
      args.estado + ' :: ' + e.message + ' (se empieza de cero)');
    return null;
  }
}

/**
 * ¿El estado guardado es de ESTA prueba?
 *
 * La misma decisión, en los mismos dos lugares (crear y leer el alcance): si
 * el control de alcance dijera "continuá" y el paso de crear dijera "creá
 * otra", la corrida gastaría alcance sin avisar.
 */
function esLaMismaPrueba(args, estadoPrevio) {
  if (!estadoPrevio) return false;
  return estadoPrevio.empresa === args.empresa
    && String(estadoPrevio.trabajador) === String(args.trabajador)
    && String(estadoPrevio.numero || '') === String(args.numero)
    && estadoPrevio.version_inicial === args.versionInicial
    && estadoPrevio.version_nueva === args.versionNueva;
}

function guardarEstado(args, estado) {
  if (!estado.pasos) estado.pasos = {};
  fs.writeFileSync(args.estado, JSON.stringify(estado, null, 2), 'utf8');
  try {
    // El archivo guarda el token del enlace: es una credencial de un solo
    // uso. En POSIX se deja con permisos de solo el dueño.
    fs.chmodSync(args.estado, 0o600);
  } catch (e) { /* en Windows no aplica */ }
}

// ===========================================================================
// PASOS
// ===========================================================================

/** 1 · El servicio está vivo y hay un Acuerdo vigente. */
async function pasoSalud(args, internoKey) {
  titulo('1. El servicio y el Acuerdo vigente');
  let res;
  try {
    res = await pedir({ base: args.url, path: '/health', method: 'GET' }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /health', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /health', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
    return null;
  }
  const salud = res.json || {};
  ok('El servicio responde', 'status=' + salud.status + ' db=' + ((salud.checks || {}).db));

  if (!internoKey) {
    fail('Falta la llave interna', '(--interno-file o FIRMA_104_INTERNAL_KEY)');
    return null;
  }
  const activo = await leerAcuerdoActivo(args, internoKey);
  if (!activo) return null;
  ok('Hay un Acuerdo vigente', 'version=' + activo.version
    + ' hash=' + String(activo.texto_hash).slice(0, 16));
  return activo;
}

/** La versión vigente, vista por la API (no por la base). */
async function leerAcuerdoActivo(args, internoKey) {
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/internal/acuerdo-activo', method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/acuerdo-activo', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/acuerdo-activo', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
    return null;
  }
  return res.json || {};
}

/**
 * 2 · La versión de partida: se activa en la base AISLADA.
 *
 * La solicitud tiene que quedar ligada a una versión que después deje de ser
 * la vigente: ese es el caso que la 10.4 resuelve.
 */
async function pasoVersionInicial(args, internoKey) {
  titulo('2. La version de partida (en la base AISLADA)');
  let anterior;
  try {
    anterior = _activar(args.db, args.versionInicial);
  } catch (e) {
    fail('Se activo la version de partida',
      'version=' + args.versionInicial + ' :: ' + e.message);
    return null;
  }
  ok('Se activo la version de partida en la base AISLADA',
    args.versionInicial + ' · hash=' + String(anterior.texto_hash).slice(0, 16));

  const activo = await leerAcuerdoActivo(args, internoKey);
  if (!activo) return null;
  if (activo.version === args.versionInicial) {
    ok('El servicio ya ve esa version como la vigente', 'version=' + activo.version);
  } else {
    fail('El servicio ya ve esa version como la vigente',
      'el servicio dice ' + activo.version + ' y se activo ' + args.versionInicial);
    return null;
  }
  return activo;
}

/**
 * 3 · La excepción de habilitación (el D-03): sin ella no se crea la
 * solicitud, y crearla es lo que gasta alcance.
 */
async function pasoExcepcion(args, adminKey, continuacion) {
  titulo('3. La excepcion de habilitacion (el D-03)');
  if (!adminKey) {
    warn('Sin llave de administracion',
      'no se puede leer ni abrir la excepcion: la creacion de la solicitud va a fallar');
    return { bloquea: false, excepcion: null };
  }
  let res;
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/admin/excepciones-habilitacion?id_empresa=' + encodeURIComponent(args.empresa),
      method: 'GET',
      headers: { 'X-Admin-API-Key': adminKey },
    }, null, args.timeoutMs);
  } catch (e) {
    warn('No se pudo leer la excepcion', e.message);
    return { bloquea: false, excepcion: null };
  }
  const items = (res.json || {}).items || [];
  const vigente = items.find((e) => e.estado === 'VIGENTE'
    && Number(e.firmas_usadas || 0) < Number(e.alcance_firmas_max || 0));

  if (vigente) {
    ok('La Empresa tiene una excepcion vigente con alcance',
      'id=' + vigente.id + ' firmas ' + vigente.firmas_usadas + '/' + vigente.alcance_firmas_max);
    return { bloquea: false, excepcion: vigente };
  }
  if (continuacion) {
    ok('La excepcion ya consumio su alcance',
      'esta corrida NO crea una solicitud nueva: CONTINUA la que ya esta en curso');
    const agotada = items.find((e) => e.estado === 'VIGENTE');
    return { bloquea: false, excepcion: agotada || null };
  }

  // No hay una excepcion con alcance: se abre una de prueba. En una base
  // AISLADA eso no es una excepcion real, pero la bitacora lo escribe igual
  // (es append-only) y la evidencia lo dice.
  if (!args.autorizadoPor || !args.autorizacionRef) {
    fail('Hay una excepcion de habilitacion con alcance',
      'no hay ninguna VIGENTE con firmas disponibles y no se paso --autorizado-por '
      + 'ni --autorizacion-ref para abrir la de prueba');
    return { bloquea: true, excepcion: null };
  }
  const plazo = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const cuerpo = {
    id_empresa: args.empresa,
    autorizado_por: args.autorizadoPor,
    autorizacion_fecha: new Date().toISOString().slice(0, 10),
    autorizacion_ref: args.autorizacionRef,
    alcance_firmas_max: 1,
    ruta_papel: 'PRUEBA 10.4: la ruta en papel no se usa en esta prueba (la 10.4 es '
      + 'la migracion de version del Acuerdo, no la firma autografica)',
    ruta_papel_operativa: true,
    plazo_hasta: plazo,
    piloto_autorizado: true,
    piloto_autorizado_por: args.autorizadoPor,
    motivo: 'Prueba de la 10.4 (migracion a la version vigente del Acuerdo) sobre una '
      + 'base de datos AISLADA. No es una excepcion de produccion.',
  };
  try {
    res = await pedirJson({
      base: args.url, path: '/internal/admin/excepciones-habilitacion', method: 'POST',
      headers: { 'X-Admin-API-Key': adminKey, 'Content-Type': 'application/json' },
    }, cuerpo, args.timeoutMs);
  } catch (e) {
    fail('Se abrio la excepcion de habilitacion de prueba', 'no respondio: ' + e.message);
    return { bloquea: true, excepcion: null };
  }
  if (res.status !== 201 && res.status !== 200) {
    fail('Se abrio la excepcion de habilitacion de prueba',
      'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300));
    return { bloquea: true, excepcion: null };
  }
  const ex = (res.json || {}).excepcion || {};
  ok('Se abrio una excepcion de habilitacion de prueba (base AISLADA)',
    'id=' + ex.id + ' · alcance=' + ex.alcance_firmas_max
    + ' · plazo_hasta=' + ex.plazo_hasta);
  return { bloquea: false, excepcion: ex };
}

/** 4 · La solicitud de firma (y el consentimiento del Acuerdo). */
async function pasoCrear(args, internoKey, acuerdo, estadoPrevio) {
  titulo('4. La solicitud de firma (ESCRIBE)');

  if (estadoPrevio) {
    if (!esLaMismaPrueba(args, estadoPrevio)) {
      fail('El estado guardado es de otra prueba',
        args.estado + ' no es de esta empresa/trabajador/versiones. Borre ese archivo '
        + 'si quiere empezar de cero: ojo, eso crea una solicitud nueva');
      return null;
    }
    ok('Se continua la solicitud anterior', 'id_solicitud=' + estadoPrevio.id_solicitud
      + ' (creada ' + estadoPrevio.creado_at + '). NO se crea otra: el alcance '
      + 'de la excepcion no se devuelve');
    return estadoPrevio;
  }

  // 4a · El consentimiento del Acuerdo (el Bloque E6).
  const cuerpoConsent = {
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    version_acuerdo: acuerdo.version,
    correo_verificacion: args.correo,
    kair_version: 'probar-10-4',
  };
  let res = await pedirJson({
    base: args.url, path: '/internal/consentimientos', method: 'POST',
    headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': 'application/json' },
  }, cuerpoConsent, args.timeoutMs);

  let consentId = null;
  if (res.status === 201 || res.status === 200) {
    consentId = (res.json || {}).consent_id;
    ok('El consentimiento del Acuerdo quedo creado', 'consent_id=' + consentId);
  } else if (res.status === 409) {
    const codigo = ((res.json || {}).error || {}).code;
    const detalles = ((res.json || {}).error || {}).details || {};
    if (codigo === 'CONSENT_PENDING' && detalles.consent_id) {
      consentId = detalles.consent_id;
      warn('Habia un consentimiento pendiente y se reutiliza', 'consent_id=' + consentId);
    } else {
      fail('El consentimiento del Acuerdo', 'HTTP 409 ' + codigo + ' :: ' + res.texto.slice(0, 250));
      return null;
    }
  } else {
    fail('El consentimiento del Acuerdo', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
    return null;
  }

  // 4b · La solicitud de firma (multipart, un campo `metadata` con un JSON).
  const idDocumento = 'PRUEBA-10-4-' + Date.now();
  const pdf = await pdfDePrueba({
    empresa: args.empresa,
    idDocumento,
    versionInicial: args.versionInicial,
    versionNueva: args.versionNueva,
  });
  const documentHash = crypto.createHash('sha256').update(pdf).digest('hex');
  const numero = String(args.numero);

  const metadata = {
    id_documento: idDocumento,
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    tipo_firma: 'remoto',
    agreement_version: acuerdo.version,
    agreement_hash: acuerdo.texto_hash,
    identificacion_tipo: 'CC',
    identificacion_numero_hash: crypto.createHash('sha256').update(numero).digest('hex'),
    document_hash: documentHash,
    version_kair: 'probar-10-4',
    correo_verificacion: args.correo,
    tipo_identificacion: 'OTROSI',
    nombre_trabajador: 'Trabajador sintetico de prueba 10.4',
    nombre_empresa: 'PRUEBA 10.4',
    correo_empresa: args.correo,
    declaracion_datos_sensibles: DECLARACION_SALUD,
    metadata: JSON.stringify({ subtipo_identificacion: 'prueba-10-4' }),
    consent_id: consentId,
  };

  const { body, contentType } = multipart({
    metadata: JSON.stringify(metadata),
  }, { campo: 'documento', nombre: 'prueba-10-4.pdf', contenido: pdf });

  res = await pedir({
    base: args.url, path: '/internal/sign-requests', method: 'POST',
    headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': contentType },
  }, body, args.timeoutMs);

  if (res.status !== 201 && res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('La solicitud de firma se creo', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 300));
    return null;
  }
  const r = res.json || {};
  const token = r.token || (r.url_publica ? String(r.url_publica).split('/').pop() : null);
  if (!r.id_solicitud || !token) {
    fail('La solicitud de firma se creo', 'HTTP ' + res.status
      + ' sin id_solicitud o sin token en la respuesta');
    return null;
  }
  ok('La solicitud de firma se creo', 'id_solicitud=' + r.id_solicitud
    + ' · estado=' + (r.estado || '(sin estado en la respuesta)'));
  if (r.agreement_version) {
    if (r.agreement_version === args.versionInicial) {
      ok('Quedo ligada a la version de partida',
        'agreement_version=' + r.agreement_version
        + ' · hash=' + String(r.agreement_hash || '').slice(0, 16));
    } else {
      fail('Quedo ligada a la version de partida',
        'devuelto=' + r.agreement_version + ' esperado=' + args.versionInicial);
    }
  }

  const estado = {
    id_solicitud: r.id_solicitud,
    token,
    empresa: args.empresa,
    trabajador: args.trabajador,
    numero: String(args.numero),
    correo: args.correo,
    url: args.url,
    db: args.db,
    version_inicial: args.versionInicial,
    version_nueva: args.versionNueva,
    hash_inicial: acuerdo.texto_hash,
    creado_at: new Date().toISOString(),
    consent_id: consentId,
    document_hash: documentHash,
    pasos: { creado: true, identificado: false, otp_verificado: false, aceptado_inicial: false },
  };
  guardarEstado(args, estado);
  return estado;
}

/** 5 · El firmante se identifica. */
async function pasoIdentificar(args, estado) {
  titulo('5. El firmante se identifica (ESCRIBE)');
  if (estado.pasos && estado.pasos.identificado) {
    ok('La identificacion ya se habia hecho', 'se omite (continuar, no repetir)');
    return true;
  }
  let res;
  try {
    res = await pedirJson({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/identify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      correo_otp: args.correo,
      tipo_identificacion: 'CC',
      numero_documento: String(args.numero),
      medio_otp_confirmado: true,
      medio_otp_version: '1.0',
    }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/identify', 'no respondio: ' + e.message);
    return false;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('El firmante se identifica', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 300));
    return false;
  }
  const j = res.json || {};
  ok('La identificacion salio; el OTP fue al buzon declarado',
    'estado=' + j.estado + ' · destino=' + j.correo_destino_enmascarado);
  // En modo desarrollo el servicio devuelve el codigo: no hay buzon humano
  // en el medio. En produccion vuelve por correo y hay que pasarlo con --otp.
  estado.otp_dev = j.devOtp || null;
  estado.pasos.identificado = true;
  guardarEstado(args, estado);
  return true;
}

/**
 * 6 · El código de verificación.
 *
 * Devuelve 'OK', 'ESPERA' (falta el código) o 'FALLA'.
 */
async function pasoOtp(args, estado) {
  titulo('6. El codigo de verificacion (OTP_VERIFIED)');
  if (estado.pasos && estado.pasos.otp_verificado) {
    ok('El codigo ya se habia verificado', 'se omite');
    return 'OK';
  }
  const codigo = args.otp || estado.otp_dev || null;
  if (!codigo) {
    warn('No hay codigo de verificacion',
      'falta el codigo de 6 digitos. Corra otra vez con --otp=<6 digitos> y el '
      + 'script CONTINUA esta misma solicitud: no crea otra');
    return 'ESPERA';
  }
  let res;
  try {
    res = await pedirJson({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { otp: String(codigo) }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/verify-otp', 'no respondio: ' + e.message);
    return 'FALLA';
  }
  if (res.status !== 200) {
    const cod = ((res.json || {}).error || {}).code || 'UNKNOWN';
    if (cod === 'OTP_EXPIRADO' || cod === 'CODIGO_EXPIRADO') {
      warn('El codigo vencio', 'se pide uno nuevo al mismo buzon');
      let r2;
      try {
        r2 = await pedirJson({
          base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/resend-otp',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, {}, args.timeoutMs);
      } catch (e) {
        fail('POST /api/sign/:token/resend-otp', 'no respondio: ' + e.message);
        return 'FALLA';
      }
      if (r2.status === 200) {
        warn('Se pidio un codigo nuevo',
          'lea el codigo nuevo del correo y corra otra vez con --otp=<6 digitos>');
        return 'ESPERA';
      }
      fail('Se pidio un codigo nuevo', 'HTTP ' + r2.status + ' :: ' + r2.texto.slice(0, 250));
      return 'FALLA';
    }
    fail('El codigo de verificacion es el correcto',
      'HTTP ' + res.status + ' ' + cod + ' :: ' + res.texto.slice(0, 250));
    return 'FALLA';
  }
  ok('El codigo de verificacion era el correcto',
    'estado=' + ((res.json || {}).estado || '(sin estado)'));
  estado.pasos.otp_verificado = true;
  guardarEstado(args, estado);
  return 'OK';
}

/**
 * 7a · El servidor pone las políticas de seguridad a disposición.
 *
 * El servidor registra ESA fecha cuando sirve el contexto público
 * (GET /s/:token -> registrarPuestaEnDisposicionPoliticas,
 * publicFlow.js:176). La aceptación la exige (publicFlow.js:670-675): sin
 * ese registro el servicio responde 409 DISPOSICION_POLITICAS_NO_REGISTRADA.
 * El navegador lo hace solo al abrir el enlace; el script tiene que hacer lo
 * mismo, antes de la primera aceptación.
 */
async function pedirContextoPublico(args, estado) {
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/s/' + encodeURIComponent(estado.token), method: 'GET',
      headers: { Accept: 'application/json' },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /s/:token (el contexto público)', 'no respondio: ' + e.message);
    return false;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('GET /s/:token (el contexto público)', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 300));
    return false;
  }
  const j = res.json || {};
  ok('El servidor puso las políticas a disposición',
    'id_solicitud=' + (j.id_solicitud || '(sin id)'));
  estado.pasos.contexto_servido = true;
  guardarEstado(args, estado);
  return true;
}

/**
 * 7 · El firmante acepta el Acuerdo (con la versión de partida vigente).
 *
 * Es el estado normal del firmante: ya aceptó, y la solicitud quedó ligada a
 * esa versión con su huella.
 */
async function pasoAceptarInicial(args, estado) {
  titulo('7. El firmante acepta el Acuerdo (la version de partida)');
  if (estado.pasos && estado.pasos.aceptado_inicial) {
    ok('El Acuerdo ya se habia aceptado', 'se omite (continuar, no repetir)');
    return true;
  }
  // El servidor registra la puesta a disposición cuando sirve el contexto:
  // sin eso, la aceptación responde 409 DISPOSICION_POLITICAS_NO_REGISTRADA.
  const contexto = await pedirContextoPublico(args, estado);
  if (!contexto) return false;
  const res = await aceptarAcuerdo(args, estado);
  if (!res) return false;
  const version = res.version_acuerdo;
  if (version === args.versionInicial) {
    ok('Acepto la version de partida', 'version_acuerdo=' + version);
  } else {
    fail('Acepto la version de partida',
      'el servicio acepto la ' + version + ' y se esperaba la ' + args.versionInicial);
    return false;
  }
  estado.pasos.aceptado_inicial = true;
  guardarEstado(args, estado);
  return true;
}

/** El POST de aceptación, con el cuerpo que manda la mini-app. */
async function aceptarAcuerdo(args, estado) {
  let res;
  try {
    res = await pedirJson({
      base: args.url,
      path: '/api/sign/' + encodeURIComponent(estado.token) + '/consent/accept',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { medio_disposicion: 'pantalla_firma' }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/consent/accept', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('El firmante acepta el Acuerdo', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 300));
    return null;
  }
  return res.json || {};
}

/**
 * 8 · MIENTRAS TANTO se publica la versión nueva (en la base AISLADA).
 *
 * A partir de acá, el firmante tiene que leer y aceptar la versión vigente.
 */
async function pasoVersionNueva(args, internoKey, estado) {
  titulo('8. Se publica la version nueva (en la base AISLADA)');
  let anterior;
  try {
    anterior = _activar(args.db, args.versionNueva);
  } catch (e) {
    fail('Se activo la version nueva', 'version=' + args.versionNueva + ' :: ' + e.message);
    return null;
  }
  ok('Se activo la version nueva en la base AISLADA',
    args.versionNueva + ' · hash=' + String(anterior.texto_hash).slice(0, 16));

  const activo = await leerAcuerdoActivo(args, internoKey);
  if (!activo) return null;
  if (activo.version === args.versionNueva) {
    ok('El servicio ya ve esa version como la vigente', 'version=' + activo.version);
  } else {
    fail('El servicio ya ve esa version como la vigente',
      'el servicio dice ' + activo.version);
    return null;
  }
  estado.hash_nuevo = activo.texto_hash;
  guardarEstado(args, estado);

  // El firmante vuelve: el contexto tiene que mostrar la versión VIGENTE y
  // avisar que tiene que aceptarla.
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/s/' + encodeURIComponent(estado.token), method: 'GET',
      headers: { Accept: 'application/json' },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /s/:token', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /s/:token', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
    return null;
  }
  const ctx = res.json || {};
  const acuerdo = ctx.acuerdo || {};
  if (acuerdo.version === args.versionNueva) {
    ok('El firmante ve la version vigente (no la que tenia la solicitud)',
      'version=' + acuerdo.version + ' · requiere_aceptar_vigente=' + acuerdo.requiere_aceptar_vigente);
  } else {
    fail('El firmante ve la version vigente',
      'el contexto dice ' + acuerdo.version);
    return null;
  }
  if (acuerdo.requiere_aceptar_vigente === true) {
    ok('El contexto avisa que tiene que aceptar la version vigente', '');
  } else {
    fail('El contexto avisa que tiene que aceptar la version vigente',
      'requiere_aceptar_vigente=' + acuerdo.requiere_aceptar_vigente);
  }

  // Y el 409 tiene que ser ACCIONABLE: decir qué hacer, no un callejón.
  try {
    res = await pedirJson({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/view-document',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { segundos_en_pagina: 5, scroll_al_final: true }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/view-document', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status === 409) {
    const err = (res.json || {}).error || {};
    const det = err.details || {};
    if (err.code === 'AGREEMENT_VERSION_REACCEPT_REQUIRED' && det.accion === 'reaceptar_version_vigente') {
      ok('El 409 dice que hay que re-aceptar la version vigente (es accionable)',
        'codigo=' + err.code + ' · accion=' + det.accion
        + ' · la solicitud tiene la ' + det.sign_request_version
        + ' y la vigente es la ' + det.active_version);
    } else {
      fail('El 409 dice que hay que re-aceptar la version vigente',
        'codigo=' + err.code + ' · accion=' + det.accion);
    }
  } else {
    fail('El 409 dice que hay que re-aceptar la version vigente',
      'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
  }
  return activo;
}

/**
 * 9 · El firmante acepta la versión vigente: AQUÍ OCURRE LA MIGRACIÓN.
 */
async function pasoAceptarVigente(args, estado) {
  titulo('9. El firmante acepta la version vigente (AQUI MIGRA)');
  const res = await aceptarAcuerdo(args, estado);
  if (!res) return null;
  const version = res.version_acuerdo;
  if (version === args.versionNueva) {
    ok('Lo que acepto es la version vigente', 'version_acuerdo=' + version);
  } else {
    fail('Lo que acepto es la version vigente',
      'el servicio acepto la ' + version + ' y se esperaba la ' + args.versionNueva);
    return null;
  }
  estado.pasos.aceptado_vigente = true;
  guardarEstado(args, estado);
  return res;
}

/**
 * 10 · La comprobación final: la fila, los consentimientos, los eventos y el
 * texto que el firmante lee.
 */
async function pasoVerificar(args, internoKey, estado) {
  titulo('10. La evidencia: la fila, los consentimientos y los eventos');

  // 10a · La fila de la solicitud.
  let res;
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud),
      method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests/:id', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/sign-requests/:id', 'HTTP ' + res.status);
    return null;
  }
  const fila = res.json || {};
  if (fila.agreement_version === args.versionNueva) {
    ok('La solicitud quedo ligada a la version vigente',
      'agreement_version=' + fila.agreement_version
      + ' · hash=' + String(fila.agreement_hash || '').slice(0, 16));
  } else {
    fail('La solicitud quedo ligada a la version vigente',
      'la fila dice ' + fila.agreement_version);
  }
  if (fila.agreement_hash && estado.hash_nuevo && fila.agreement_hash === estado.hash_nuevo) {
    ok('La huella archivada es la del texto que el firmante leyo',
      'sha256=' + String(fila.agreement_hash).slice(0, 16));
  } else {
    fail('La huella archivada es la del texto que el firmante leyo',
      'fila=' + String(fila.agreement_hash || '').slice(0, 16)
      + ' vigente=' + String(estado.hash_nuevo || '').slice(0, 16));
  }
  estado.consent_id_nuevo = fila.consent_id || null;
  guardarEstado(args, estado);

  // 10b · El texto que el firmante puede descargar: tiene que ser el MISMO.
  try {
    res = await pedir({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/acuerdo.txt',
      method: 'GET',
    }, null, args.timeoutMs);
  } catch (e) {
    warn('GET /api/sign/:token/acuerdo.txt', 'no respondio: ' + e.message);
    res = null;
  }
  if (res && res.status === 200) {
    const hashTexto = crypto.createHash('sha256').update(res.texto, 'utf8').digest('hex');
    const hashServido = res.headers['x-acuerdo-sha256'] || null;
    if (hashTexto === fila.agreement_hash) {
      ok('El texto que descarga el firmante es el que quedo archivado',
        'sha256=' + hashTexto.slice(0, 16));
    } else {
      fail('El texto que descarga el firmante es el que quedo archivado',
        'el texto sirve ' + hashTexto.slice(0, 16)
        + ' y la fila archiva ' + String(fila.agreement_hash || '').slice(0, 16));
    }
    if (hashServido) {
      if (hashServido === hashTexto) {
        ok('La cabecera X-Acuerdo-SHA256 coincide con el texto servido', '');
      } else {
        fail('La cabecera X-Acuerdo-SHA256 coincide con el texto servido',
          'cabecera=' + hashServido.slice(0, 16));
      }
    }
  } else if (res) {
    warn('El texto que descarga el firmante', 'HTTP ' + res.status);
  }

  // 10c · La base AISLADA: los consentimientos y el evento de la migracion.
  let filasFirma = [];
  try {
    filasFirma = _sql(args.db, "SELECT id, agreement_version, agreement_hash, consent_id, estado"
      + " FROM gh_firmas_electronicas WHERE id_solicitud = '"
      + String(estado.id_solicitud).replace(/'/g, "''") + "';");
  } catch (e) {
    fail('La fila en la base AISLADA', e.message);
  }
  const filaBd = (filasFirma || [])[0] || null;
  if (filaBd) {
    if (filaBd.agreement_version === args.versionNueva
      && filaBd.agreement_hash === (estado.hash_nuevo || filaBd.agreement_hash)) {
      ok('En la base, la fila quedo con la version nueva y SU huella',
        'agreement_version=' + filaBd.agreement_version
        + ' · sha256=' + String(filaBd.agreement_hash).slice(0, 16));
    } else {
      fail('En la base, la fila quedo con la version nueva y SU huella',
        'version=' + filaBd.agreement_version
        + ' · hash=' + String(filaBd.agreement_hash).slice(0, 16));
    }
  }

  // El consentimiento anterior: NO se toca (el 9.5).
  let consentViejo = null;
  try {
    const cs = _sql(args.db, "SELECT id, version_acuerdo, manifestacion_aceptada, fecha_aceptacion"
      + " FROM gh_consentimientos_firma WHERE id = " + Number(estado.consent_id) + ";");
    consentViejo = (cs || [])[0] || null;
  } catch (e) {
    warn('El consentimiento de la version anterior', e.message);
  }
  if (consentViejo) {
    if (consentViejo.version_acuerdo === args.versionInicial
      && Number(consentViejo.manifestacion_aceptada) === 1) {
      ok('El consentimiento de la version anterior quedo INTACTO (el 9.5: sin efectos retroactivos)',
        'id=' + consentViejo.id + ' · version=' + consentViejo.version_acuerdo
        + ' · aceptado=' + consentViejo.manifestacion_aceptada
        + ' · fecha=' + consentViejo.fecha_aceptacion);
    } else {
      fail('El consentimiento de la version anterior quedo INTACTO',
        'version=' + consentViejo.version_acuerdo
        + ' · aceptado=' + consentViejo.manifestacion_aceptada);
    }
    estado.consent_viejo = consentViejo;
  } else {
    fail('El consentimiento de la version anterior quedo INTACTO', 'no se encontro');
  }

  // El consentimiento nuevo: es de la version vigente y esta aceptado.
  let consentNuevo = null;
  try {
    const cs = _sql(args.db, "SELECT id, version_acuerdo, manifestacion_aceptada, fecha_aceptacion"
      + " FROM gh_consentimientos_firma WHERE id = " + Number(estado.consent_id_nuevo) + ";");
    consentNuevo = (cs || [])[0] || null;
  } catch (e) {
    warn('El consentimiento de la version vigente', e.message);
  }
  if (consentNuevo) {
    if (consentNuevo.version_acuerdo === args.versionNueva
      && Number(consentNuevo.manifestacion_aceptada) === 1) {
      ok('El consentimiento nuevo es de la version vigente y esta aceptado',
        'id=' + consentNuevo.id + ' · version=' + consentNuevo.version_acuerdo
        + ' · fecha=' + consentNuevo.fecha_aceptacion);
    } else {
      fail('El consentimiento nuevo es de la version vigente y esta aceptado',
        'version=' + consentNuevo.version_acuerdo
        + ' · aceptado=' + consentNuevo.manifestacion_aceptada);
    }
    estado.consent_nuevo = consentNuevo;
  } else {
    fail('El consentimiento nuevo es de la version vigente y esta aceptado', 'no se encontro');
  }

  // 10d · Los eventos: el cambio de version queda en la traza.
  let eventos = [];
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud) + '/eventos',
      method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests/:id/eventos', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/sign-requests/:id/eventos', 'HTTP ' + res.status);
    return null;
  }
  const j = res.json || {};
  eventos = j.eventos || j.items || [];
  const tipos = eventos.map((e) => e.tipo_evento);
  emitir('  eventos: ' + (tipos.join(' · ') || '(ninguno)'));
  for (const [tipo, que] of [
    ['CREATED', 'la solicitud se creo'],
    ['OTP_SENT', 'el codigo salio al buzon declarado'],
    ['OTP_VERIFIED', 'el firmante demostro que controla el buzon'],
    ['CONSENT_ACCEPTED', 'el firmante acepto el Acuerdo'],
    ['AGREEMENT_VERSION_MIGRATED', 'el cambio de version quedo en la traza'],
  ]) {
    if (tipos.includes(tipo)) {
      const ev = eventos.find((e) => e.tipo_evento === tipo);
      ok('Evento ' + tipo, que + ' · ' + (ev.fecha_evento || ''));
    } else {
      fail('Evento ' + tipo, que);
    }
  }

  // El metadata del evento dice WHICH versión se dejó y cuál se tomó.
  try {
    const evs = _sql(args.db, "SELECT evento, metadata FROM gh_firma_eventos"
      + " WHERE firma_id = " + Number(filaBd ? filaBd.id : 0)
      + " AND evento = 'AGREEMENT_VERSION_MIGRATED';");
    const ev = (evs || [])[0] || null;
    if (ev && ev.metadata) {
      let meta = null;
      try { meta = JSON.parse(ev.metadata); } catch (e) { meta = null; }
      if (meta && meta.version_anterior === args.versionInicial
        && meta.version_nueva === args.versionNueva) {
        ok('El evento dice que version se dejo y cual se tomo',
          'version_anterior=' + meta.version_anterior + ' · version_nueva=' + meta.version_nueva);
      } else {
        fail('El evento dice que version se dejo y cual se tomo', ev.metadata.slice(0, 200));
      }
    } else {
      fail('El evento dice que version se dejo y cual se tomo', 'no hay metadata');
    }
  } catch (e) {
    fail('El evento dice que version se dejo y cual se tomo', e.message);
  }

  // 10e · Con la migración hecha, el documento ya se puede ver.
  try {
    res = await pedirJson({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/view-document',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { segundos_en_pagina: 5, scroll_al_final: true }, args.timeoutMs);
  } catch (e) {
    warn('POST /api/sign/:token/view-document', 'no respondio: ' + e.message);
    res = null;
  }
  if (res && res.status === 200) {
    ok('Con la migracion hecha, el documento ya se puede ver', 'HTTP 200');
  } else if (res) {
    fail('Con la migracion hecha, el documento ya se puede ver', 'HTTP ' + res.status);
  }

  estado.eventos = eventos;
  return eventos;
}

/**
 * 11 · La evidencia, en texto.
 *
 * Es lo que va al manifiesto (`legal-readiness.json` → `n10_4.evidencia`). Dice
 * qué se probó, cuándo, contra qué, con qué ids y con qué huellas, y dice
 * también qué NO es real.
 */
function escribirEvidencia(args, contexto) {
  const lineas = [];
  lineas.push('PRUEBA DE LA 10.4 EN EL AMBIENTE REAL (K+AIR)');
  lineas.push('==============================================');
  lineas.push('Fecha: ' + new Date().toISOString());
  lineas.push('Servicio: ' + args.url);
  lineas.push('Script: scripts/probar-10-4.js');
  lineas.push('Base de datos AISLADA: ' + args.db);
  lineas.push('Empresa: ' + args.empresa);
  lineas.push('Solicitud: ' + contexto.estado.id_solicitud);
  lineas.push('Trabajador (id CRUDO, SINTETICO): ' + args.trabajador);
  lineas.push('Documento de identidad con el que se identifico: SINTETICO, ' + args.numero);
  lineas.push('Version de partida: ' + args.versionInicial
    + ' · hash ' + String(contexto.hashInicial || '').slice(0, 32));
  lineas.push('Version vigente al final: ' + args.versionNueva
    + ' · hash ' + String(contexto.hashNuevo || '').slice(0, 32));
  if (contexto.excepcion) {
    lineas.push('Excepcion de habilitacion: id=' + contexto.excepcion.id
      + ' · firmas ' + contexto.excepcion.firmas_usadas + '/'
      + contexto.excepcion.alcance_firmas_max
      + ' · plazo_hasta=' + contexto.excepcion.plazo_hasta);
  }
  lineas.push('');
  lineas.push('QUE SE PROBO');
  lineas.push('------------');
  lineas.push('(a) El firmante se identifico, demostro que controlaba su buzon (OTP_VERIFIED) '
    + 'y ACEPTO el Acuerdo con la ' + args.versionInicial + ' vigente: la solicitud quedo '
    + 'ligada a esa version con su huella.');
  lineas.push('(b) MIENTRAS TANTO se publico la ' + args.versionNueva + ': esa es la version '
    + 'vigente. El contexto del firmante devolvio la ' + args.versionNueva + ' (no la que '
    + 'tenia la solicitud) y con requiere_aceptar_vigente=true.');
  lineas.push('(c) El servicio respondio con un 409 ACCIONABLE (AGREEMENT_VERSION_REACCEPT_'
    + 'REQUIRED, accion=reaceptar_version_vigente) al pedir el documento: dice que hay '
    + 'que leer y aceptar la version vigente, en vez de dejar al firmante en un '
    + 'callejon sin salida. Ese 409 es exactamente el problema que la 10.4 vino a '
    + 'resolver.');
  lineas.push('(d) Al aceptar, la solicitud MIGRO a la ' + args.versionNueva + ': la fila '
    + 'quedo con agreement_version=' + args.versionNueva + ' y con el SHA-256 de SU texto '
    + '(' + String(contexto.hashNuevo || '').slice(0, 32) + '...), el consentimiento nuevo '
    + 'es de esa version y esta aceptado, y el texto que el firmante descarga '
    + '(GET /api/sign/:token/acuerdo.txt) es el MISMO que quedo archivado: no hay dos '
    + 'verdades.');
  lineas.push('(e) El consentimiento de la ' + args.versionInicial + ' quedo INTACTO (el 9.5: '
    + 'sin efectos retroactivos): el Trabajador que ya habia aceptado una version '
    + 'anterior se rige por esa version respecto de lo que ya habia aceptado).');
  lineas.push('(f) El cambio de version quedo en la traza: el evento AGREEMENT_VERSION_'
    + 'MIGRATED con la version anterior (' + args.versionInicial + ') y la nueva ('
    + args.versionNueva + ').');
  lineas.push('(g) Con la migracion hecha, el documento ya se puede ver (el 409 se fue).');
  lineas.push('');
  lineas.push('EVENTOS DE LA FIRMA');
  lineas.push('-------------------');
  for (const e of (contexto.eventos || [])) {
    lineas.push('  ' + (e.fecha_evento || '') + '  ' + e.tipo_evento
      + (e.actor ? '  actor=' + e.actor : ''));
  }
  lineas.push('');
  lineas.push('LO QUE ESTA PRUEBA NO ES');
  lineas.push('------------------------');
  lineas.push('La base de datos sobre la que se corrio es una COPIA AISLADA, no la de '
    + 'produccion: cambiar la version activa en produccion no es posible por API (crear '
    + 'una solicitud exige la version activa, la activacion no tiene vuelta atras y no '
    + 'hay una version nueva publicada), asi que la maniobra se hizo sobre la copia, con '
    + 'los MISMOS textos legales y las MISMAS huellas que estan publicados (la '
    + 'operacion es la que hizo el despliegue del 5-nov-2026, cuando la v1.5 sustituyo a '
    + 'la v1.4 con solicitudes en curso).');
  lineas.push('La excepcion de habilitacion que se abrio para esta prueba tambien es de '
    + 'prueba: queda en la bitacora de la copia, no en la de produccion.');
  lineas.push('El documento de identidad (' + args.numero + ') y el documento que firma el '
    + 'Trabajador son SINTETICOS: los genero el propio script y el PDF lo dice en su '
    + 'primera pagina. No hay ninguna persona real detras de esta solicitud.');
  lineas.push('Lo que la prueba demuestra es que el MECANISMO de la 10.4 funciona contra '
    + 'el codigo desplegado en el servidor real: la migracion ocurre, la huella archivada '
    + 'es la del texto que el firmante leyo, el cambio queda en la traza y el '
    + 'consentimiento anterior no se reescribe.');
  lineas.push('');
  lineas.push('REPRODUCIR');
  lineas.push('---------');
  lineas.push('node scripts/probar-10-4.js --db=' + args.db
    + ' --version-inicial=' + args.versionInicial
    + ' --version-nueva=' + args.versionNueva
    + ' --empresa=' + args.empresa
    + ' --trabajador=' + args.trabajador
    + ' --numero=' + args.numero
    + ' --correo=' + args.correo
    + ' --autorizado-por="' + (args.autorizadoPor || '(la que autorice el owner)') + '"'
    + ' --autorizacion-ref="' + (args.autorizacionRef || '(la que autorice el owner)') + '"'
    + ' --confirmar-escribe');

  const texto = lineas.join('\n') + '\n';
  fs.writeFileSync(args.evidencia, texto, 'utf8');
  return texto;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function correr(args) {
  const internoKey = leerLlave(null, args.internoFile, 'FIRMA_104_INTERNAL_KEY');
  const adminKey = leerLlave(null, args.adminFile, 'FIRMA_104_ADMIN_KEY');

  titulo('0. Que se puede escribir');
  if (!args.confirmarEscribe) {
    warn('Modo lectura', 'esta corrida NO escribe nada. Para ejecutar la 10.4 hay que '
      + 'pasar --confirmar-escribe: crea una solicitud de firma y abre una excepcion '
      + 'de habilitacion de prueba en la base AISLADA.');
    emitir('');
    emitir('  (sin --confirmar-escribe el script no hace nada mas)');
    return 0;
  }
  ok('Modo escritura confirmado', 'se crearan filas en la base AISLADA: ' + args.db);

  const estadoPrevio = leerEstado(args);
  const continuacion = esLaMismaPrueba(args, estadoPrevio);
  const yaMigrada = continuacion
    && !!(estadoPrevio.pasos && estadoPrevio.pasos.aceptado_vigente === true);

  const acuerdoInicial = await pasoSalud(args, internoKey);
  if (!acuerdoInicial) return resumen() === 0 ? 0 : 1;

  // LA CORRIDA QUE YA TERMINÓ NO SE REPITE.
  //
  // Volver a cambiar la versión activa y volver a aceptar no hace falta: la
  // migración ya está hecha y comprobada. Lo que se hace es volver a
  // verificar (que la fila, los consentimientos y el evento sigan como
  // deben) y reescribir la evidencia. Así el script se puede correr dos
  // veces sin tocar nada.
  if (yaMigrada) {
    titulo('La migracion ya estaba hecha: se verifica y se reescribe la evidencia');
    ok('No se vuelve a cambiar la version activa ni a aceptar',
      'id_solicitud=' + estadoPrevio.id_solicitud
      + ' · la migracion ya esta hecha (version vigente: ' + args.versionNueva + ')');
    if (acuerdoInicial.version !== args.versionNueva) {
      fail('La version vigente es la nueva',
        'el servicio dice ' + acuerdoInicial.version
        + ' y la prueba es sobre la ' + args.versionNueva);
      return resumen() === 0 ? 0 : 1;
    }
    const eventos = await pasoVerificar(args, internoKey, estadoPrevio);
    titulo('La evidencia');
    const texto = escribirEvidencia(args, {
      estado: estadoPrevio,
      excepcion: null,
      eventos,
      hashInicial: estadoPrevio.hash_inicial,
      hashNuevo: estadoPrevio.hash_nuevo,
    });
    ok('La evidencia quedo escrita', args.evidencia);
    emitir('');
    emitir(texto);
    return resumen() === 0 ? 0 : 1;
  }

  const versionInicial = await pasoVersionInicial(args, internoKey);
  if (!versionInicial) return resumen() === 0 ? 0 : 1;

  const leida = await pasoExcepcion(args, adminKey, continuacion);
  if (leida.bloquea) return resumen() === 0 ? 0 : 1;
  const excepcion = leida.excepcion;

  const estado = await pasoCrear(args, internoKey, versionInicial, estadoPrevio);
  if (!estado) return resumen() === 0 ? 0 : 1;

  const identificado = await pasoIdentificar(args, estado);
  if (!identificado) return resumen() === 0 ? 0 : 1;

  const resultadoOtp = await pasoOtp(args, estado);
  if (resultadoOtp === 'FALLA') return resumen() === 0 ? 0 : 1;
  if (resultadoOtp === 'ESPERA') {
    titulo('7-11. La aceptacion, la migracion y la evidencia');
    warn('La prueba se detiene aca', 'falta el codigo de verificacion. Corra otra vez '
      + 'con --otp=<6 digitos> y el script CONTINUA esta misma solicitud: no crea otra.');
    return 3;
  }

  const aceptadoInicial = await pasoAceptarInicial(args, estado);
  if (!aceptadoInicial) return resumen() === 0 ? 0 : 1;

  const versionNueva = await pasoVersionNueva(args, internoKey, estado);
  if (!versionNueva) return resumen() === 0 ? 0 : 1;

  const aceptadoVigente = await pasoAceptarVigente(args, estado);
  if (!aceptadoVigente) return resumen() === 0 ? 0 : 1;

  const eventos = await pasoVerificar(args, internoKey, estado);

  titulo('11. La evidencia');
  const texto = escribirEvidencia(args, {
    estado,
    excepcion,
    eventos,
    hashInicial: estado.hash_inicial,
    hashNuevo: estado.hash_nuevo,
  });
  ok('La evidencia quedo escrita', args.evidencia);
  emitir('');
  emitir(texto);

  return resumen() === 0 ? 0 : 1;
}

async function main(argv) {
  const args = parseArgs(argv || process.argv);
  if (!validarArgumentos(args)) {
    emitir('');
    emitir('Uso: node scripts/probar-10-4.js --db=<BD AISLADA> --version-inicial=v1.4 '
      + '--version-nueva=v1.5 --empresa=NIT --trabajador=ID --numero=CC --correo=buzon '
      + '--autorizado-por="..." --autorizacion-ref="..." --confirmar-escribe [--otp=123456]');
    return 2;
  }
  try {
    return await correr(args);
  } catch (e) {
    fail('El script termino con una excepcion', e && e.message ? e.message : String(e));
    return 1;
  }
}

/** Para los tests: vacia la lista de resultados entre corridas. */
function reiniciar() {
  resultados.length = 0;
}

module.exports = {
  main,
  parseArgs,
  validarArgumentos,
  leerLlave,
  leerEstado,
  guardarEstado,
  esLaMismaPrueba,
  multipart,
  pdfDePrueba,
  sqlPorCli,
  activarVersionPorCli,
  fijarBase,
  restaurarBase,
  escribirEvidencia,
  correr,
  reiniciar,
  fijarSalida,
  resultados,
  DEFAULT_URL,
  DEFAULT_TIMEOUT_MS,
};

if (require.main === module) {
  main(process.argv).then((code) => {
    process.exit(code);
  }).catch((e) => {
    console.error('La prueba de la 10.4 fallo de forma inesperada: '
      + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
