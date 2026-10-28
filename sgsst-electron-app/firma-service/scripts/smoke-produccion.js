#!/usr/bin/env node
/**
 * scripts/smoke-produccion.js
 *
 * PRUEBA DE HUMO CONTRA UN SERVICIO DE FIRMA EN EJECUCIÓN (producción o staging).
 *
 * POR QUÉ EXISTE
 * --------------
 * El `/health` del servicio devuelve una versión FIJA (`compatible-0.1.189`,
 * hardcodeada en src/routes/health.js), así que NO sirve para saber si el
 * código nuevo ya está corriendo. Este script da la señal que el health no
 * da: el Acuerdo vigente y su huella, y opcionalmente el recorrido completo
 * de creación de una solicitud de firma.
 *
 * QUÉ HACE
 * --------
 * Por defecto SOLO LEE. No crea nada, no escribe nada, no manda correos:
 *
 *   1. `GET /health` -> responde 200, la base esta viva y el SMTP esta
 *      configurado. (Aviso: `checks.smtp` dice "configured", no "ok": el
 *      health NO abre conexion SMTP. Ver MIGRACION-SERVIDOR-FIRMA.md §5.)
 *   2. `GET /internal/acuerdo-activo` -> que version del Acuerdo esta
 *      vigente y cual es su huella; se compara contra el manifiesto sellado
 *      (`scripts/fixtures/acuerdo-ARCHIVO.json`) y contra el archivo legal.
 *   3. `GET /internal/sign-requests` con una lista vacia -> comprueba que la
 *      ruta interna responde (401 = la key esta mal; 200 = la ruta vive).
 *
 * Con `--canal-datos` hace UN POST a `/api/solicitudes`: esa ruta (el 1.3, el
 * canal de datos de K+AIR) SOLO existe en el codigo nuevo, asi que es la
 * prueba de que el despliegue quedo hecho, y se puede hacer desde afuera sin
 * ninguna llave. Crea una fila de prueba.
 *
 * Con `--e2e` ADEMAS crea una solicitud de firma de prueba (ESCRIBE en la base)
 * y MANDA LA INVITACION por correo, que es el primer contacto con el firmante.
 * Por eso exige `--confirmar-e2e` explicito: una prueba que escribe tiene que
 * decir que escribe.
 *
 * OJO CON EL e2e: crear la solicitud NO manda ningun correo. `POST
 * /internal/sign-requests` devuelve el token y la URL y nada mas; el primer
 * contacto con el firmante es un endpoint aparte, `POST
 * /internal/sign-requests/:id/notify-remote`, que es el que llama a
 * `mailer.sendInvite()`. Un e2e que solo crea la solicitud "pasa" sin haber
 * probado el correo, que es justo lo que se quiere probar.
 *
 * USO
 * ---
 *   node scripts/smoke-produccion.js --url=https://firma.kair.fyi \
 *        --interno-file=/ruta/a/internal-key.txt
 *
 *   node scripts/smoke-produccion.js --url=https://firma.kair.fyi --canal-datos
 *
 *   node scripts/smoke-produccion.js --url=https://firma.kair.fyi \
 *        --interno-file=/ruta/a/internal-key.txt \
 *        --e2e --confirmar-e2e --empresa=EMP-001 --trabajador=CC-PRUEBA \
 *        --correo=prueba@example.com
 *
 * Con `--numero-documento=` se indica el numero de documento con el que el
 * firmante se va a identificar en la mini-app (si no, se usa el
 * `--trabajador`). El script calcula la huella con ese mismo numero, asi que
 * tienen que coincidir: la mini-app pide tipo `CC` y ese numero.
 *
 * Con `--categoria-retencion=` (y opcionalmente `--fecha-terminacion=`) la
 * solicitud de prueba se crea con el CATALOGO DE RETENCION POR DOCUMENTO:
 * `SST_CAPACITACION`, `SST_EPP`, `CONTRATO_TRABAJO`, `HISTORIA_LABORAL`...
 * El script verifica que la respuesta traiga la categoria y la fecha de
 * conservacion ya calculada: es la prueba de que la migracion 033 esta
 * aplicada en el servidor. Sin el flag, la solicitud va como legacy.
 *
 * Las llaves se pueden pasar por archivo (`--interno-file`, `--admin-file`) o
 * por el ambiente (`FIRMA_SMOKE_INTERNAL_KEY`, `FIRMA_SMOKE_ADMIN_KEY`).
 * NUNCA se imprimen.
 *
 * Exit codes:
 *   0 = todas las comprobaciones pasaron
 *   1 = falló al menos una comprobacion
 *   2 = argumentos invalidos
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');

// La declaración de que el documento NO contiene datos sensibles de salud es
// OBLIGATORIA para crear una solicitud (ver src/services/declaracionSalud.js).
// El documento de humo es un PDF vacío de prueba: no tiene datos de salud, y
// el script lo declara. Sin esto, el servicio responde 422.
const { DECLARACION_SALUD } = require('../src/services/declaracionSalud');

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const MANIFIEST_PATH = path.join(FIXTURES_DIR, 'acuerdo-ARCHIVO.json');
const ARCHIVO_LEGAL = path.join(FIXTURES_DIR, 'acuerdo-v1.0.txt');

const DEFAULT_URL = 'https://firma.kair.fyi';
const DEFAULT_TIMEOUT_MS = 20000;

// ----------------------------------------------------------------------
// Salida
// ----------------------------------------------------------------------
const resultados = [];

/**
 * Sumidero de salida. Por defecto va a la consola; los tests inyectan uno
 * para capturar SIN parchear `process.stdout` (parchearlo se come la salida
 * del reporter de node:test y rompe el conteo de la suite entera).
 */
let _sink = null;

function emitir(linea) {
  if (typeof _sink === 'function') {
    _sink(linea);
    return;
  }
  console.log(linea);
}

function ok(nombre, detalle) {
  resultados.push({ nombre, estado: 'OK', detalle: detalle || '' });
  emitir(`  [OK]   ${nombre}${detalle ? ' :: ' + detalle : ''}`);
}

function warn(nombre, detalle) {
  resultados.push({ nombre, estado: 'AVISO', detalle: detalle || '' });
  emitir(`  [AVISO] ${nombre}${detalle ? ' :: ' + detalle : ''}`);
}

function fail(nombre, detalle) {
  resultados.push({ nombre, estado: 'FALLA', detalle: detalle || '' });
  emitir(`  [FALLA] ${nombre}${detalle ? ' :: ' + detalle : ''}`);
}

function titulo(t) {
  emitir('\n=== ' + t + ' ===');
}

// ----------------------------------------------------------------------
// Argumentos
// ----------------------------------------------------------------------
function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    interno: null,
    internoFile: null,
    admin: null,
    adminFile: null,
    e2e: false,
    confirmarE2e: false,
    canalDatos: false,
    idempotencia: false,
    empresa: null,
    trabajador: null,
    numeroDocumento: null,
    correo: null,
    correoEmpresa: null,
    categoriaRetencion: null,
    fechaTerminacion: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    error: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--e2e') args.e2e = true;
    else if (a === '--confirmar-e2e') args.confirmarE2e = true;
    else if (a === '--canal-datos') args.canalDatos = true;
    else if (a === '--idempotencia') args.idempotencia = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--url=')) args.url = a.split('=').slice(1).join('=');
    else if (a.startsWith('--interno=')) args.interno = a.split('=').slice(1).join('=');
    else if (a.startsWith('--interno-file=')) args.internoFile = a.split('=').slice(1).join('=');
    else if (a.startsWith('--admin=')) args.admin = a.split('=').slice(1).join('=');
    else if (a.startsWith('--admin-file=')) args.adminFile = a.split('=').slice(1).join('=');
    else if (a.startsWith('--empresa=')) args.empresa = a.split('=').slice(1).join('=');
    else if (a.startsWith('--trabajador=')) args.trabajador = a.split('=').slice(1).join('=');
    else if (a.startsWith('--numero-documento=')) args.numeroDocumento = a.split('=').slice(1).join('=');
    else if (a.startsWith('--correo=')) args.correo = a.split('=').slice(1).join('=');
    else if (a.startsWith('--correo-empresa=')) args.correoEmpresa = a.split('=').slice(1).join('=');
    else if (a.startsWith('--categoria-retencion=')) args.categoriaRetencion = a.split('=').slice(1).join('=');
    else if (a.startsWith('--fecha-terminacion=')) args.fechaTerminacion = a.split('=').slice(1).join('=');
    else if (a.startsWith('--timeout-ms=')) args.timeoutMs = parseInt(a.split('=')[1], 10);
    else if (a === '--help' || a === '-h') {
      console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
      args.error = 'HELP';
      return args;
    } else {
      args.error = 'Argumento desconocido: ' + a;
      return args;
    }
  }
  args.url = String(args.url).replace(/\/+$/, '');
  return args;
}

/**
 * ¿La corrida va a ESCRIBIR en el servicio?
 *
 * La regla del script: por defecto SOLO LEE. Escribir tiene que ser explicito
 * y, en el caso del e2e, tiene que estar confirmado por el operador.
 *
 * @param {object} args
 * @returns {{escribe: boolean, motivo: string}}
 */
function modoEscritura(args) {
  if (args.e2e && !args.confirmarE2e) {
    return {
      escribe: false,
      motivo: 'La prueba e2e crea una solicitud y manda un correo: '
        + 'falta --confirmar-e2e.',
    };
  }
  if (args.e2e || args.canalDatos) {
    return { escribe: true, motivo: 'La corrida fue autorizada a escribir.' };
  }
  return { escribe: false, motivo: 'Modo lectura: no se escribe nada.' };
}

/**
 * Los marcadores que se copian y no se cambian.
 *
 * POR QUE EXISTE ESTA LISTA
 * -------------------------
 * El 26-oct-2026 la corrida e2e se ejecuto DOS veces seguidas con estos
 * textos literales (`--correo=CORREO_REAL`, `--numero-documento=NUMERO_DE_CEDULA`).
 * Las dos veces el servidor respondio 400 INVALID_REQUEST_BODY con
 * "Invalid email" en `correo_verificacion`, un mensaje que no dice la causa
 * real: que nadie cambio el marcador. Cada corrida perdio un ciclo entero.
 *
 * La leccion es la misma de siempre: un chequeo que no muerde no es un
 * chequeo. El servidor SI rechaza el dato malo (eso esta bien), pero el
 * operador recibe un error de SCHEMA, no de USO. Este script tiene que
 * detectar el marcador antes de la llamada y decir QUE FALTA.
 *
 * La comparacion es exacta (el valor entero, sin espacios) y sin distincion
 * de mayusculas: un correo de verdad nunca es "CORREO_REAL".
 */
const MARCADORES = {
  correo: [
    'CORREO', 'CORREO_REAL', 'CORREO_PERSONAL', 'TU_CORREO', 'MI_CORREO',
    'EMAIL', 'E_MAIL', 'MAIL', 'X', 'XXX', 'TBD',
  ],
  numero: [
    'NUMERO', 'NUMERO_DE_CEDULA', 'NUMERO_DOCUMENTO', 'CEDULA', 'MI_CEDULA',
    'TU_CEDULA', 'DOCUMENTO', 'NUM_DOCUMENTO', 'NUM', 'N', 'X', 'XXX', 'TBD',
  ],
};

/**
 * ¿El valor es uno de los marcadores de ejemplo?
 *
 * @param {*} valor
 * @param {string[]} lista
 * @returns {boolean}
 */
function _esMarcador(valor, lista) {
  const v = String(valor === null || valor === undefined ? '' : valor).trim().toUpperCase();
  if (!v) return false;
  return lista.indexOf(v) !== -1;
}

/**
 * ¿El texto parece un correo?
 *
 * Es una comprobacion de forma, no de existencia: el unico que puede saber
 * si un buzon existe es el que lo abre. La forma basta para que el servidor
 * no responda 400 con un mensaje de schema.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function _pareceCorreo(valor) {
  const v = String(valor || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * VALIDA LOS ARGUMENTOS ANTES DE TOCAR EL SERVICIO.
 *
 * Devuelve `null` cuando todo esta bien, o un texto que explica QUE FALTA
 * y QUE HACER. El texto es la parte importante: un error que no dice que
 * hacer obliga a leer el codigo, y el codigo esta en el servidor, no en la
 * pantalla del operador.
 *
 * Las tres reglas:
 *
 *   1. `--correo` tiene que parecer un correo. Sin `--correo`, la solicitud
 *      queda con `prueba@example.com` (ver `metadataSignRequest`), que es un
 *      buzon muerto: el OTP no le llega a nadie y la prueba no prueba nada.
 *   2. `--numero-documento` tiene que tener entre 4 y 20 DIGITOS. No es una
 *      regla del script: es la del mini-app (`src/routes/public.js`, la ruta
 *      `identifyBody` exige `regex(/^\\d+$/)` con 4..20 caracteres) y el
 *      front-end borra lo que no sea digito. Un numero con letras nunca
 *      podria identificarse en el celular, aunque el servidor lo aceptara.
 *   3. El numero que va en el comando tiene que ser EXACTAMENTE el que el
 *      firmante escribe en el celular: la comparacion es por huella
 *      (`sha256` -> HMAC), no por contenido. Por eso el script calcula la
 *      huella con el mismo numero que imprime.
 *
 * @param {object} args
 * @returns {string|null}
 */
function validarArgumentos(args) {
  // 1. El correo del firmante.
  if (args.correo !== null && args.correo !== undefined) {
    if (String(args.correo).trim() === '') {
      return '--correo quedo vacio. Pasa el correo real del firmante (a donde '
        + 'llega el codigo de verificacion). Sin ese dato la solicitud queda '
        + 'con prueba@example.com, que es un buzon muerto: el OTP no llega a '
        + 'nadie y la prueba no prueba nada.';
    }
    if (_esMarcador(args.correo, MARCADORES.correo)) {
      return 'El valor de --correo ("' + args.correo + '") es un marcador de '
        + 'ejemplo, no un correo. Reemplazalo por el correo real del firmante '
        + 'y vuelve a correr.';
    }
    if (!_pareceCorreo(args.correo)) {
      return 'El valor de --correo ("' + args.correo + '") no parece un correo '
        + '(falta el @ o el dominio).';
    }
  }

  // 1b. El canal de copia de la Empresa.
  if (args.correoEmpresa !== null && args.correoEmpresa !== undefined
    && String(args.correoEmpresa).trim() !== '') {
    if (_esMarcador(args.correoEmpresa, MARCADORES.correo)) {
      return 'El valor de --correo-empresa ("' + args.correoEmpresa + '") es un '
        + 'marcador de ejemplo, no un correo.';
    }
    if (!_pareceCorreo(args.correoEmpresa)) {
      return 'El valor de --correo-empresa ("' + args.correoEmpresa + '") no '
        + 'parece un correo (falta el @ o el dominio).';
    }
  }

  // 2 y 3. El numero de documento (solo importa cuando se crea una firma).
  if (args.e2e) {
    const numero = String(args.numeroDocumento || args.trabajador || '').trim();
    if (!numero) {
      return 'La prueba e2e necesita el numero de documento del firmante '
        + '(--numero-documento, o --trabajador si es la cedula).';
    }
    if (_esMarcador(numero, MARCADORES.numero)) {
      return 'El numero de documento ("' + numero + '") es un marcador de '
        + 'ejemplo. Poné el numero real en digitos (por ejemplo 12345678901, '
        + 'sin puntos ni guiones) y vuelve a correr.';
    }
    if (!/^\d{4,20}$/.test(numero)) {
      return 'El numero de documento ("' + numero + '") tiene que tener entre 4 '
        + 'y 20 DIGITOS: la mini-app solo acepta digitos y borra lo demas. El '
        + 'mismo numero, digito por digito, es el que hay que escribir en el '
        + 'celular.';
    }
  }

  return null;
}

function leerLlave(valorInline, archivo, varAmbiente) {
  if (valorInline) return String(valorInline).trim();
  if (archivo) {
    try {
      return fs.readFileSync(archivo, 'utf8').trim();
    } catch (e) {
      console.error(`No se pudo leer la llave de ${archivo}: ${e.message}`);
      process.exit(2);
    }
  }
  if (varAmbiente && process.env[varAmbiente]) return String(process.env[varAmbiente]).trim();
  return null;
}

// ----------------------------------------------------------------------
// HTTP
// ----------------------------------------------------------------------
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

function multipart(campos, archivo) {
  const boundary = '----kairsmoke' + crypto.randomBytes(12).toString('hex');
  const partes = [];
  for (const [k, v] of Object.entries(campos)) {
    partes.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
      'utf8'));
  }
  partes.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${archivo.campo}"; filename="${archivo.nombre}"\r\n`
    + `Content-Type: application/pdf\r\n\r\n`, 'utf8'));
  partes.push(archivo.contenido);
  partes.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
  return {
    body: Buffer.concat(partes),
    contentType: 'multipart/form-data; boundary=' + boundary,
  };
}

async function pdfDePrueba() {
  const { PDFDocument, StandardFonts } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595, 842]);
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  pagina.drawText('PRUEBA DE HUMO K+AIR - NO ES EVIDENCIA', {
    x: 60, y: 760, size: 14, font: fuente,
  });
  pagina.drawText('Documento generado para verificar el flujo de firma.', {
    x: 60, y: 730, size: 10, font: fuente,
  });
  return Buffer.from(await doc.save());
}

// ----------------------------------------------------------------------
// Comprobaciones
// ----------------------------------------------------------------------
async function comprobarHealth(args) {
  titulo('1. Salud del servicio');
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/health', method: 'GET',
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /health', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /health', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300));
    return null;
  }
  const b = res.json || {};
  ok('GET /health responde 200', 'status=' + b.status);
  if (b.checks && b.checks.db === 'ok') ok('La base de datos responde', 'checks.db=ok');
  else fail('La base de datos responde', 'checks.db=' + ((b.checks || {}).db));

  if (b.checks && b.checks.smtp === 'configured') {
    warn('SMTP', 'checks.smtp=configured. OJO: el health NO abre conexion SMTP; '
      + 'eso se prueba aparte (MIGRACION-SERVIDOR-FIRMA.md §5)');
  } else {
    fail('SMTP', 'checks.smtp=' + ((b.checks || {}).smtp));
  }

  warn('La version que anuncia /health NO sirve como prueba de despliegue',
    'kair_version=' + b.kair_version + ' (valor fijo en src/routes/health.js). '
    + 'Para saber que corrio el codigo nuevo, mire el log del servicio: '
    + '"Aplicando migracion" con las 019..032');
  return b;
}

async function comprobarAcuerdo(args, internoKey) {
  titulo('2. Acuerdo de uso vigente');
  if (!internoKey) {
    fail('GET /internal/acuerdo-activo', 'falta la llave interna '
      + '(--interno / --interno-file / FIRMA_SMOKE_INTERNAL_KEY)');
    return null;
  }
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
    fail('GET /internal/acuerdo-activo', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300));
    return null;
  }
  const a = res.json || {};
  ok('Hay una version activa del Acuerdo', 'version=' + a.version + ' hash=' + a.texto_hash);

  // El hash del texto servido tiene que coincidir con el hash que se anuncia.
  const local = crypto.createHash('sha256').update(String(a.texto || ''), 'utf8').digest('hex');
  if (local === a.texto_hash) {
    ok('El texto servido corresponde a su huella', 'sha256(texto)=texto_hash');
  } else {
    fail('El texto servido corresponde a su huella',
      'texto_hash=' + a.texto_hash + ' sha256(texto)=' + local);
  }

  // Contra el manifiesto sellado.
  if (fs.existsSync(MANIFIEST_PATH)) {
    let manifiesto = null;
    try {
      manifiesto = JSON.parse(fs.readFileSync(MANIFIEST_PATH, 'utf8'));
    } catch (e) {
      warn('Manifiesto del Acuerdo', 'ilegible: ' + e.message);
    }
    if (manifiesto && manifiesto.versiones) {
      const sellada = manifiesto.versiones[a.version];
      if (!sellada) {
        warn('La version activa no esta en el manifiesto',
          'version=' + a.version + ' (el manifiesto tiene: '
          + Object.keys(manifiesto.versiones).join(', ') + ')');
      } else if (sellada.sha256 !== a.texto_hash) {
        fail('La huella activa coincide con la archivada',
          'archivada=' + sellada.sha256 + ' activa=' + a.texto_hash
          + ' :: el texto publicado cambio despues de archivarse');
      } else {
        ok('La huella activa coincide con la archivada',
          a.version + ' sellada el ' + (sellada.fecha_archivado || '?'));
      }
    }
  } else {
    warn('Manifiesto del Acuerdo', 'no existe en ' + MANIFIEST_PATH);
  }

  // El archivo legal del repo: si la version activa es v1.0, tiene que ser ESTE texto.
  if (a.version === 'v1.0' && fs.existsSync(ARCHIVO_LEGAL)) {
    const textoLegal = fs.readFileSync(ARCHIVO_LEGAL, 'utf8');
    const hashLegal = crypto.createHash('sha256').update(textoLegal, 'utf8').digest('hex');
    const esLegal = !/ACUERDO DEV/.test(textoLegal);
    if (!esLegal) {
      fail('El archivo v1.0 del repo es el legal', 'tiene la marca "ACUERDO DEV"');
    } else if (hashLegal !== a.texto_hash) {
      fail('El texto publicado es el legal del repo',
        'archivo=' + hashLegal + ' publicado=' + a.texto_hash
        + ' :: OJO: puede ser una v1.0 de PRUEBAS en la base; '
        + 'eso choca con la publicacion del legal (ver el plan de despliegue)');
    } else {
      ok('El texto publicado es el legal del repo', 'sha256=' + hashLegal);
    }
  }

  return a;
}

async function comprobarRutaInterna(args, internoKey) {
  titulo('3. Ruta interna viva');
  if (!internoKey) {
    warn('GET /internal/sign-requests', 'sin llave interna: comprobacion omitida');
    return;
  }
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/internal/sign-requests?ids=1', method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests', 'no respondio: ' + e.message);
    return;
  }
  if (res.status === 200) ok('La ruta interna responde', 'HTTP 200');
  else if (res.status === 401) fail('La llave interna no sirve', 'HTTP 401 INVALID_API_KEY');
  else if (res.status === 404) ok('La ruta interna responde', 'HTTP 404 (no hay esa firma)');
  else warn('La ruta interna respondio raro', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
}

/**
 * El número de documento de IDENTIFICACION del firmante.
 *
 * Es el número que el firmante tiene que escribir en la mini-app para
 * identificarse. El script calcula la huella con el MISMO número, así que
 * tienen que coincidir exactamente.
 *
 * Si no se pasa `--numero-documento`, se usa el `--trabajador` (que por
 * convención del proyecto es la cédula del trabajador).
 *
 * @param {object} args
 * @returns {string}
 */
function numeroDocumentoDe(args) {
  return String(args.numeroDocumento || args.trabajador || '');
}

/**
 * El objeto `metadata` de la solicitud de firma.
 *
 * El endpoint `POST /internal/sign-requests` NO recibe campos sueltos en el
 * multipart: recibe UN campo `metadata` con un JSON string, y ese objeto se
 * valida contra el schema `signRequestBody`, que es `.strict()`: una clave
 * desconocida se RECHAZA (400 con el nombre de la clave).
 *
 * Adentro, el campo `metadata` de ese objeto es el blob libre que se archiva
 * en la columna `metadata` de la fila, y ese sí tiene lista blanca (las cinco
 * claves de `metadata.CLAVES_METADATA_PERMITIDAS`): lo desconocido ahí también
 * se rechaza, pero con su propio mensaje.
 *
 * `tipo_identificacion` es la CATEGORÍA DEL DOCUMENTO que se firma (no el tipo
 * de identificación del firmante, que va en `identificacion_tipo`). Los valores
 * validos son los de `TIPOS_IDENTIFICACION`: CONTRATO, OTROSI, ACTA,
 * CONSENTIMIENTO, AUTORIZACION, REGLAMENTO, POLITICA, CERTIFICADO...
 * ("OTRO" no existe; el que existe es "OTROSI".)
 *
 * LA IDENTIFICACIÓN DEL FIRMANTE TAMBIÉN VA AQUÍ
 * ---------------------------------------------
 * `identificacion_tipo` (CC, CE, TI, PPT, PA) y `identificacion_numero_hash`
 * son OBLIGATORIOS para que el firmante pueda identificarse: `identify()` los
 * exige y, si faltan, responde 500 MISSING_IDENTIFICATION_DATA. El cliente
 * (K+AIR) manda el SHA-256 del número, nunca el número en claro; el servicio lo
 * convierte en un HMAC con su llave maestra.
 *
 * Con sal, el hash previo es `sha256(sal || numero)`; sin sal (lo que hace
 * este script), es `sha256(numero)`. Por eso el firmante tiene que escribir
 * EXACTAMENTE el mismo número que el script usó para calcular el hash.
 *
 * @param {object} args
 * @param {object} acuerdoActivo
 * @param {string} documentHash
 * @param {number} [consentId] - id del consentimiento del Acuerdo (Bloque E6).
 * @returns {object}
 */
function metadataSignRequest(args, acuerdoActivo, documentHash, consentId) {
  const numero = numeroDocumentoDe(args);
  const metadata = {
    id_documento: 'PRUEBA-HUMO-' + Date.now(),
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    tipo_firma: 'remoto',
    agreement_version: acuerdoActivo.version,
    agreement_hash: acuerdoActivo.texto_hash,
    // La identificación del firmante: el TIPO (CC) y la huella del numero.
    identificacion_tipo: 'CC',
    identificacion_numero_hash: crypto.createHash('sha256').update(String(numero)).digest('hex'),
    document_hash: documentHash,
    version_kair: 'smoke-produccion',
    correo_verificacion: args.correo || 'prueba@example.com',
    tipo_identificacion: 'OTROSI',
    nombre_trabajador: 'Trabajador de Prueba',
    nombre_empresa: 'K+AIR PRUEBA S.A.S.',
    correo_empresa: args.correoEmpresa || 'copia-prueba@example.com',
    // La declaración de que el documento NO tiene datos sensibles de salud.
    // Es obligatoria: sin ella el servicio responde 422
    // DECLARACION_DATOS_SENSIBLES_REQUERIDA. El PDF de humo no tiene datos
    // de salud.
    declaracion_datos_sensibles: DECLARACION_SALUD,
    // OJO: el `metadata` de adentro es un STRING JSON, no un objeto: el schema
    // lo declara como `z.string().max(8192)`. Mandarlo como objeto es un 400
    // ("Expected string, received object").
    metadata: JSON.stringify({ subtipo_identificacion: 'prueba-de-humo' }),
  };
  // EL CONSENTIMIENTO DEL ACUERDO (Bloque E6)
  // -----------------------------------------
  // Sin este vinculo, la mini-app no puede aceptar el Acuerdo: la tercera
  // casilla llama a `POST /api/sign/:token/consent/accept`, que exige
  // `signRequest.consent_id` y responde 409 CONSENT_REQUIRED si no lo hay.
  //
  // OJO con lo que ese 409 le dice al firmante: la mini-app lo traduce como
  // "Esta solicitud NO requiere aceptacion de Acuerdo. Contacta a tu
  // empleador", que es al reves de lo que pasa (falta el consentimiento), y
  // por eso el sintoma parece un error de la solicitud y no del cliente.
  //
  // El consentimiento se crea ANTES (ver `crearConsentimiento`) y su id viaja
  // en la creacion de la solicitud. El servidor enlaza los dos (y deja el
  // `id_solicitud` en la fila del consentimiento).
  if (consentId) {
    metadata.consent_id = consentId;
  }
  // 033 · El catálogo de retención por documento (opcional). Con
  // `--categoria-retencion=SST_CAPACITACION` la solicitud se crea con la regla
  // de 20 años desde el cese: es la prueba de que el servidor ya aplicó la
  // migración 033. Sin el flag, la solicitud va como legacy (tabla de la
  // Empresa).
  if (args.categoriaRetencion) {
    metadata.categoria_retencion = args.categoriaRetencion;
  }
  if (args.fechaTerminacion) {
    metadata.fecha_terminacion = args.fechaTerminacion;
  }
  return metadata;
}

/**
 * Las cabeceras de la creación de la solicitud de firma.
 *
 * OJO con el `Idempotency-Key`: el servicio lo RECHAZA en modo legacy (la
 * llave interna `INTERNAL_API_KEY`), con un 400 explicito
 * (`IDEMPOTENCY_LEGACY_NOT_SUPPORTED`). La razon esta en el propio codigo:
 * la idempotencia exige `req.id_empresa`, y en modo legacy esa empresa es
 * null por diseno (I-005/I-010). Con la llave por empresa si se puede usar.
 *
 * Por eso la llave de idempotencia SOLO se manda cuando se pide explicitamente
 * con `--idempotencia`, y la documentacion lo dice: mandar el header en modo
 * legacy no es un detalle, es un 400 que no dice nada util.
 *
 * @param {object} args
 * @param {string} internoKey
 * @param {string} contentType
 * @returns {object}
 */
function cabecerasSignRequest(args, internoKey, contentType) {
  const cabeceras = {
    'X-Internal-API-Key': internoKey,
    'Content-Type': contentType,
  };
  if (args.idempotencia) {
    cabeceras['Idempotency-Key'] = 'smoke-' + crypto.randomBytes(8).toString('hex');
  }
  return cabeceras;
}

async function comprobarCodigoNuevo(args) {
  titulo('4. El codigo nuevo esta vivo (ESCRIBE una fila)');
  if (!args.canalDatos) {
    emitir('  (omitida: sin --canal-datos)');
    emitir('  Para confirmar que corrio el codigo nuevo desde AFUERA, use');
    emitir('  --canal-datos: hace UN POST a /api/solicitudes, ruta que solo existe');
    emitir('  en el codigo nuevo (1.3). Crea una fila de prueba en el canal de datos.');
    return;
  }
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/api/solicitudes', method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({
      tipo: 'ACCESO',
      correo: 'prueba-humo@example.com',
      nombre: 'PRUEBA DE HUMO K+AIR',
      contenido: 'Fila creada por scripts/smoke-produccion.js para verificar '
        + 'que el servicio desplegado expone el canal de datos (1.3). No es una '
        + 'solicitud real: marcar como prueba y cerrar.',
    }), args.timeoutMs);
  } catch (e) {
    fail('POST /api/solicitudes', 'no respondio: ' + e.message);
    return;
  }
  if (res.status === 201) {
    ok('El canal de datos responde: el codigo NUEVO esta desplegado',
      'HTTP 201 (ruta que solo existe desde el 1.3)');
    warn('Se creo una fila de prueba en el canal de datos',
      'marcarla como PRUEBA y cerrarla desde la consola');
  } else if (res.status === 404) {
    fail('El codigo nuevo NO esta desplegado',
      'POST /api/solicitudes dio 404: esa ruta no existe en el codigo viejo. '
      + 'El servicio sigue corriendo el codigo anterior.');
  } else if (res.status === 400) {
    warn('El codigo nuevo esta desplegado pero el body no valido',
      'HTTP 400 :: ' + res.texto.slice(0, 200));
  } else {
    fail('POST /api/solicitudes', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300));
  }
}

/**
 * Manda la invitación por correo: el PRIMER CONTACTO con el firmante.
 *
 * OJO, esto no es un detalle: `POST /internal/sign-requests` CREA la solicitud
 * y devuelve el token y la URL, pero NO manda ningún correo. El primer
 * contacto es un endpoint aparte, `POST /internal/sign-requests/:id/notify-remote`,
 * que es el que llama a `mailer.sendInvite()`. Sin esa llamada, el servicio
 * responde 201, el firmante no se entera de nada y el e2e "pasa" sin haber
 * probado el correo (que es justo lo que se quiere probar).
 *
 * Si el SMTP falla, la ruta responde 502 INVITE_EMAIL_FAILED y el error trae
 * el motivo del servidor de correo: eso es un AVISO, no un fallo del servicio.
 *
 * EL TOKEN QUE EL CLIENTE YA TENÍA
 * --------------------------------
 * Si el body NO trae `token`, el servicio emite uno nuevo (rotación) y lo
 * manda en el correo. Con el 3.4(c) eso **deja sin efecto el token anterior**:
 * "cada reemisión se registra y deja sin efecto el token anterior. No hay más
 * de un token vigente por solicitud."
 *
 * El smoke, por lo tanto, tiene que MANDAR el token que la creación le
 * devolvió. Sin eso pasa esto: la creación da el token A, la notificación
 * rota y emite el B (y el A queda muerto), y el check de 5c —que comprueba el
 * token de la creación— recibe 404 TOKEN_NOT_FOUND. **El enlace del correo
 * estaba bien y el check miraba el equivocado**: una FALLA por el motivo
 * equivocado. Con el token mandado, la notificación reutiliza el MISMO
 * enlace, el correo lleva el token que el check abre, y 5c vuelve a comprobar
 * lo que dice comprobar: que el enlace que el firmante va a recibir sirve.
 *
 * @param {object} args
 * @param {string} internoKey
 * @param {string} idSolicitud
 * @param {function} [pedirFn] - doble de `pedir` para los tests.
 * @param {string} [token] - el token que la creación ya devolvió. Si viene,
 *   la invitación sale con ESE enlace y no se gasta una rotación.
 * @returns {Promise<{ok: boolean, codigo: string, detalle: string}>}
 */
async function notificarInvitacion(args, internoKey, idSolicitud, pedirFn, token) {
  const pedirReal = pedirFn || pedir;
  titulo('5b. La invitacion sale por correo (ESCRIBE)');
  if (!idSolicitud) {
    fail('POST /internal/sign-requests/:id/notify-remote',
      'la creacion no devolvio id_solicitud');
    return { ok: false, codigo: 'SIN_ID_SOLICITUD', detalle: '' };
  }

  let res;
  try {
    res = await pedirReal({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(idSolicitud) + '/notify-remote',
      method: 'POST',
      headers: {
        'X-Internal-API-Key': internoKey,
        'Content-Type': 'application/json',
      },
    }, JSON.stringify(token ? { correo: args.correo, token } : { correo: args.correo }),
    args.timeoutMs);
  } catch (e) {
    fail('POST /internal/sign-requests/:id/notify-remote', 'no respondio: ' + e.message);
    return { ok: false, codigo: 'SIN_RESPUESTA', detalle: e.message };
  }

  if (res.status === 200) {
    const j = res.json || {};
    ok('La invitacion salio por correo',
      'destino=' + args.correo + ' :: messageId=' + (j.messageId || '(sin messageId)'));
    warn('Se mando un correo real a ' + args.correo,
      'si no lo pedia, la solicitud es de prueba: se puede cancelar desde la consola');
    return { ok: true, codigo: 'OK', detalle: j.messageId || '' };
  }

  const codigo = (res.json && res.json.error && res.json.error.code) || 'UNKNOWN';
  const texto = res.texto.slice(0, 300);
  if (codigo === 'INVITE_EMAIL_FAILED') {
    warn('La invitacion NO salio: fallo el servidor de correo',
      'HTTP ' + res.status + ' ' + codigo + ' :: ' + texto);
  } else {
    fail('POST /internal/sign-requests/:id/notify-remote',
      'HTTP ' + res.status + ' ' + codigo + ' :: ' + texto);
  }
  return { ok: false, codigo, detalle: texto };
}

/**
 * Crea (o reutiliza) el CONSENTIMIENTO DEL ACUERDO del firmante.
 *
 * POR QUE ESTE PASO EXISTE
 * ------------------------
 * El 26-oct-2026 la corrida e2e dio 201, la invitacion salio por correo y el
 * firmante llego hasta la TERCERA casilla de la mini-app (la del Acuerdo).
 * Ahi el servidor respondio `409 CONSENT_REQUIRED` y la mini-app le mostro
 * "Esta solicitud no requiere aceptacion de Acuerdo. Contacta a tu
 * empleador": un mensaje que dice al reves de lo que pasa (falta el
 * consentimiento) y que hace que el sintoma parezca un error de la solicitud
 * y no del cliente que la creo.
 *
 * La causa: `POST /internal/sign-requests` acepta `consent_id` en el
 * `metadata` (Bloque E6), y sin ese vinculo la fila queda con
 * `consent_id = NULL`. La mini-app no puede aceptar el Acuerdo sin el
 * consentimiento, y la firma no se puede completar. O sea: **una solicitud de
 * firma sin consentimiento del Acuerdo es una carta sin firma**.
 *
 * En el flujo real de K+AIR el cliente (la app de escritorio) crea el
 * consentimiento y luego la solicitud. El smoke, que es un cliente, tiene que
 * hacer los DOS pasos.
 *
 * En produccion la creacion del consentimiento NO manda ningun correo (el
 * codigo de verificacion de la firma es otro, el de la mini-app).
 *
 * @param {object} args
 * @param {string} internoKey
 * @param {object} acuerdoActivo
 * @param {function} [pedirFn] - doble de `pedir` para los tests.
 * @returns {Promise<{ok: boolean, consent_id: number|null, reusado: boolean, detalle: string}>}
 */
async function crearConsentimiento(args, internoKey, acuerdoActivo, pedirFn) {
  const pedirReal = pedirFn || pedir;
  const cuerpo = JSON.stringify({
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    version_acuerdo: acuerdoActivo.version,
    correo_verificacion: args.correo || 'prueba@example.com',
    kair_version: 'smoke-produccion',
  });

  let res;
  try {
    res = await pedirReal({
      base: args.url, path: '/internal/consentimientos', method: 'POST',
      headers: {
        'X-Internal-API-Key': internoKey,
        'Content-Type': 'application/json',
      },
    }, cuerpo, args.timeoutMs);
  } catch (e) {
    return {
      ok: false, consent_id: null, reusado: false,
      detalle: 'no respondio: ' + e.message,
    };
  }

  const j = res.json || {};

  if (res.status === 201) {
    if (!j.consent_id) {
      return {
        ok: false, consent_id: null, reusado: false,
        detalle: 'HTTP 201 sin consent_id en la respuesta :: ' + res.texto.slice(0, 200),
      };
    }
    return { ok: true, consent_id: j.consent_id, reusado: false, detalle: '' };
  }

  // 200 · ya estaba aceptado (mismo trabajador, misma empresa, misma version).
  if (res.status === 200) {
    if (!j.consent_id) {
      return {
        ok: false, consent_id: null, reusado: true,
        detalle: 'HTTP 200 sin consent_id en la respuesta :: ' + res.texto.slice(0, 200),
      };
    }
    return { ok: true, consent_id: j.consent_id, reusado: true, detalle: 'ya estaba aceptado' };
  }

  if (res.status === 409) {
    const codigo = (j.error && j.error.code) || 'UNKNOWN';
    const detalles = (j.error && j.error.details) || {};
    // 409 CONSENT_PENDING: ya hay un consentimiento PENDIENTE para la misma
    // clave (trabajador, empresa, version). Se reusa: es el mismo
    // consentimiento, y el que lo acepte en la mini-app es el de esta firma.
    if (codigo === 'CONSENT_PENDING' && detalles.consent_id) {
      return {
        ok: true, consent_id: detalles.consent_id, reusado: true, codigo,
        detalle: 'ya habia uno pendiente',
      };
    }
    return {
      ok: false, consent_id: null, reusado: false, codigo,
      detalle: 'HTTP 409 ' + codigo + ' :: ' + res.texto.slice(0, 250),
    };
  }

  return {
    ok: false, consent_id: null, reusado: false, codigo: 'HTTP_' + res.status,
    detalle: 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300),
  };
}

async function comprobarE2e(args, internoKey, acuerdoActivo, deps) {
  const pedirFn = (deps && deps.pedir) || pedir;
  const notificarFn = (deps && deps.notificar) || notificarInvitacion;
  titulo('5. Prueba de extremo a extremo (ESCRIBE)');
  if (!args.e2e) {
    emitir('  (omitida: sin --e2e)');
    return;
  }
  if (!args.confirmarE2e) {
    fail('La prueba e2e se pidio sin --confirmar-e2e',
      'esta opcion crea una solicitud de firma y manda un correo');
    return;
  }
  if (!internoKey) {
    fail('La prueba e2e necesita la llave interna', '');
    return;
  }
  if (!acuerdoActivo) {
    fail('La prueba e2e necesita el Acuerdo vigente', 'no se pudo leer');
    return;
  }
  if (!args.empresa || !args.trabajador) {
    fail('La prueba e2e necesita --empresa y --trabajador', '');
    return;
  }

  const pdf = await pdfDePrueba();
  const documentHash = crypto.createHash('sha256').update(pdf).digest('hex');

  // 5a. EL CONSENTIMIENTO DEL ACUERDO (Bloque E6).
  //
  // Este paso NO es un detalle: sin el consentimiento vinculado, la mini-app
  // no deja aceptar el Acuerdo y la firma no se puede completar. Es lo que
  // paso el 26-oct-2026: el alta dio 201 y el firmante llego hasta la tercera
  // casilla, donde el servidor respondio 409 CONSENT_REQUIRED.
  const consent = await crearConsentimiento(args, internoKey, acuerdoActivo, pedirFn);
  if (!consent.ok) {
    // El D-03 bloquea en CUATRO puntos, y la creacion del consentimiento es
    // uno de ellos: si la Empresa no esta habilitada, el bloqueo aparece
    // aqui, antes que en la creacion de la solicitud. Se reporta igual que
    // el otro (AVISO, no FALLA): un control que se comporta como debe no es
    // un fallo del servicio.
    if (consent.codigo === 'EMPRESA_NO_HABILITADA') {
      warn('POST /internal/consentimientos', '409 EMPRESA_NO_HABILITADA: la Empresa '
        + 'no tiene Anexo de Encargo firmado ni canal de PQRS. '
        + 'El bloqueo es INCONDICIONAL (D-03): no hay bandera que lo apague. '
        + 'La unica salida es la excepcion auditable '
        + '(POST /internal/admin/excepciones-habilitacion). '
        + 'NO es un fallo del servicio: es el control del D-03. Detalle: '
        + consent.detalle);
    } else {
      fail('El consentimiento del Acuerdo se creo', consent.detalle);
    }
    return;
  }
  ok('El consentimiento del Acuerdo quedo vinculado a la solicitud',
    'consent_id=' + consent.consent_id + (consent.reusado ? ' (reusado: ya habia uno pendiente)' : ''));

  const { body, contentType } = multipart({
    metadata: JSON.stringify(metadataSignRequest(args, acuerdoActivo, documentHash, consent.consent_id)),
  }, { campo: 'documento', nombre: 'prueba-humo.pdf', contenido: pdf });

  let res;
  try {
    res = await pedirFn({
      base: args.url, path: '/internal/sign-requests', method: 'POST',
      headers: cabecerasSignRequest(args, internoKey, contentType),
    }, body, args.timeoutMs);
  } catch (e) {
    fail('POST /internal/sign-requests', 'no respondio: ' + e.message);
    return;
  }

  if (res.status === 201 || res.status === 200) {
    const r = res.json || {};
    ok('La solicitud de firma se creo', 'id=' + (r.id_solicitud || r.id));
    if (r.agreement_hash) {
      if (r.agreement_hash === acuerdoActivo.texto_hash) {
        ok('Quedo ligada a la version vigente del Acuerdo',
          'agreement_hash=' + r.agreement_hash);
      } else {
        fail('Quedo ligada a la version vigente del Acuerdo',
          'devolvido=' + r.agreement_hash + ' vigente=' + acuerdoActivo.texto_hash);
      }
    }
    if (r.url_publica) {
      emitir('  URL de la prueba: ' + r.url_publica);
      emitir('  (NO se puede reutilizar el token: se devuelve una sola vez)');
      emitir('  Para identificarte en la mini-app: tipo CC y numero '
        + numeroDocumentoDe(args));
    }
    // 5a-bis. LA SOLICITUD QUEDO VINCULADA AL CONSENTIMIENTO.
    //
    // La respuesta de la creacion NO trae `consent_id`, asi que hay que
    // releer la fila. Este es el check que habria atrapado el 409
    // CONSENT_REQUIRED del 26-oct-2026: una solicitud sin consentimiento del
    // Acuerdo no se puede firmar, y el sintoma (un error en el celular del
    // firmante) no dice nada de la causa real.
    if (r.id_solicitud) {
      let fila = null;
      try {
        const resFila = await pedirFn({
          base: args.url,
          path: '/internal/sign-requests/' + encodeURIComponent(r.id_solicitud),
          method: 'GET',
          headers: { 'X-Internal-API-Key': internoKey },
        }, null, args.timeoutMs);
        if (resFila.status === 200) fila = resFila.json || {};
      } catch (e) {
        fila = null;
      }
      if (fila && fila.consent_id) {
        ok('La solicitud quedo vinculada al consentimiento del Acuerdo',
          'consent_id=' + fila.consent_id);
      } else {
        fail('La solicitud quedo vinculada al consentimiento del Acuerdo',
          'consent_id=' + (fila ? String(fila.consent_id) : '(no se pudo leer la fila)')
          + ' · sin este vinculo la mini-app no deja aceptar el Acuerdo '
          + '(409 CONSENT_REQUIRED) y la firma no se puede completar');
      }
    }
    // El token de la creación, en texto claro: es la credencial del enlace.
    //
    // Se calcula ANTES de notificar, porque el 3.4(c) hace que la reemisión
    // deje sin efecto el token anterior: si la notificación no recibe el
    // token, se emite otro y el de aquí queda muerto. Con el token entregado,
    // la invitación sale con el MISMO enlace y el 5c abre exactamente el
    // enlace que el firmante va a recibir.
    const token = r.token || (r.url_publica ? String(r.url_publica).split('/').pop() : null);
    // 033 · La retention por documento. Si se pidio una categoria, la
    // respuesta tiene que traerla con la fecha de conservacion ya calculada:
    // es la prueba de que la migracion 033 esta aplicada y de que el servidor
    // ya aplica la regla legal del documento.
    if (args.categoriaRetencion) {
      if (r.categoria_retencion === args.categoriaRetencion) {
        ok('La retencion por documento se aplico',
          'categoria=' + r.categoria_retencion
          + ' fecha_conservacion=' + (r.fecha_conservacion || '(sin fecha: pendiente)'));
      } else {
        fail('La retencion por documento se aplico',
          'pedida=' + args.categoriaRetencion + ' devuelta=' + (r.categoria_retencion || '(null)'));
      }
    }
    // Crear la solicitud NO manda ningun correo: el primer contacto con el
    // firmante es un endpoint aparte. Sin esta llamada, el e2e "pasa" sin
    // haber probado que el correo sale.
    //
    // El token se manda para que la invitación salga con el MISMO enlace que
    // devuelve la creación (ver la nota de `notificarInvitacion`): sin eso,
    // el 3.4(c) rota el token y el 5c comprueba un enlace que ya no existe.
    if (args.correo) {
      await notificarFn(args, internoKey, r.id_solicitud, pedirFn, token);
    }

    // 5c. Y el token tiene que RESOLVER. Sin esta comprobacion el e2e puede
    // dar verde con un servicio donde ningun enlace sirve: el alta dio 201,
    // el correo salio, y el firmante abre un 404.
    await comprobarTokenResuelve(args, token, pedirFn);
  } else if (res.status === 409) {
    const codigo = (res.json && res.json.error && res.json.error.code) || 'UNKNOWN';
    if (codigo === 'EMPRESA_NO_HABILITADA') {
      // AVISO y no FALLA. El 409 EMPRESA_NO_HABILITADA es el control del D-03
      // FUNCIONANDO: la Empresa que se probó no tiene Anexo de Encargo firmado
      // ni canal de PQRS, y el sistema se lo dice en vez de dejarla firmar.
      // Contarlo como FALLA haría que el smoke exitara con codigo 1 por un
      // control que se comportó como debe, y el aviso que sigue dice qué
      // hacer.
      //
      // Lo que SÍ es una falla es que el servicio no responda, o que el 409
      // sea por otro motivo (aun está en el `else` de abajo).
      warn('POST /internal/sign-requests', '409 EMPRESA_NO_HABILITADA: la Empresa '
        + 'no tiene Anexo de Encargo firmado ni canal de PQRS. '
        + 'El bloqueo es INCONDICIONAL (📦933): no hay bandera que lo apague. '
        + 'La unica salida es la excepcion auditable '
        + '(POST /internal/admin/excepciones-habilitacion). '
        + 'NO es un fallo del servicio: es el control del D-03. Detalle: '
        + JSON.stringify((res.json && res.json.error && res.json.error.details) || {}));
    } else {
      fail('POST /internal/sign-requests', 'HTTP 409 ' + codigo + ' :: ' + res.texto.slice(0, 300));
    }
  } else {
    fail('POST /internal/sign-requests', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 300));
  }
}

// ----------------------------------------------------------------------
async function main(argv, opciones) {
  const salida = (opciones && opciones.sink) || null;
  const args = parseArgs(argv || process.argv);
  if (args.error) {
    if (args.error !== 'HELP') console.error(args.error);
    return args.error === 'HELP' ? 0 : 2;
  }
  // Los argumentos se validan ANTES de la primera llamada: un marcador sin
  // cambiar tiene que fallar en la consola del operador, no con un 400 de
  // schema del servidor (ver validarArgumentos).
  const problema = validarArgumentos(args);
  if (problema) {
    console.error(problema);
    args.error = problema;
    return 2;
  }
  resultados.length = 0; // Cada corrida arranca limpio.
  _sink = salida;
  try {
    return await correr(args);
  } finally {
    _sink = null;
  }
}

/**
 * EL TOKEN RESUELVE: el enlace que el firmante va a abrir tiene que servir.
 *
 * ESTE CHECK FALTABA, Y SU AUSENCIA COSTÓ UNA JORNADA ENTERA
 * -----------------------------------------------------------
 * El 21 de octubre el e2e dio "RESULTADO: OK" con 13 comprobaciones mientras
 * NINGUN token resolvia: el servicio contestaba 404 TOKEN_NOT_FOUND en todas
 * las rutas de datos (`/api/sign/<token>/verify`, `/acuerdo.txt`, `/medios`,
 * `/identify`) y el unico 200 era el HTML estatico de la mini-app. El correo
 * si habia salido, el alta si habia dado 201, y el enlace seguia muerto.
 *
 * El hueco no era del codigo del servicio: era del CODIGO QUE COMPRUEBA.
 * Una corrida de humo que no abre el enlace que ella misma creo no prueba
 * que el firmante pueda firmar. Y un check que no muerde no es un check.
 *
 * La creacion devuelve el token en texto claro (es la unica vez que sale, por
 * el 3.6(e)). Ese token es la credencial: si no resuelve, la firma es
 * inalcanzable para el firmante, por mas que todo lo demas este en verde.
 *
 * @param {object} args
 * @param {string} token - el token en texto claro de la creacion.
 * @param {function} [pedirFn] - doble de `pedir` para los tests.
 * @returns {Promise<{ok: boolean, codigo: string, detalle: string}>}
 */
async function comprobarTokenResuelve(args, token, pedirFn) {
  const pedirReal = pedirFn || pedir;
  titulo('5c. El token resuelve (sin esto el firmante no puede firmar)');
  if (!token) {
    fail('El token de la prueba resuelve', 'la creacion no devolvio token');
    return { ok: false, codigo: 'SIN_TOKEN', detalle: '' };
  }

  let res;
  try {
    res = await pedirReal({
      base: args.url,
      path: '/api/sign/' + encodeURIComponent(token) + '/verify',
      method: 'GET',
    }, null, args.timeoutMs);
  } catch (e) {
    fail('El token de la prueba resuelve', 'no respondio: ' + e.message);
    return { ok: false, codigo: 'SIN_RESPUESTA', detalle: e.message };
  }

  if (res.status === 200) {
    const j = res.json || {};
    ok('El token de la prueba resuelve',
      'id_solicitud=' + (j.id_solicitud || '(sin id)'));
    return { ok: true, codigo: 'OK', detalle: j.id_solicitud || '' };
  }

  const codigo = (res.json && res.json.error && res.json.error.code) || 'UNKNOWN';
  const texto = res.texto.slice(0, 300);
  fail('El token de la prueba NO resuelve',
    'HTTP ' + res.status + ' ' + codigo + ' :: ' + texto
    + ' | Si es 404 TOKEN_NOT_FOUND, el servicio no esta resolviendo la credencial: '
    + 'revisar que el proceso que corre sea el del codigo desplegado '
    + '(un proceso con el codigo anterior escribe y lee con otro esquema).');
  return { ok: false, codigo, detalle: texto };
}

/**
 * La corrida propriamente dicha (ya con los argumentos validados).
 */
async function correr(args) {
  const internoKey = leerLlave(args.interno, args.internoFile, 'FIRMA_SMOKE_INTERNAL_KEY');
  const adminKey = leerLlave(args.admin, args.adminFile, 'FIRMA_SMOKE_ADMIN_KEY');
  void adminKey; // La llave admin no se usa todavia: queda para publicar Acuerdo.

  const escritura = modoEscritura(args);
  emitir('Prueba de humo contra: ' + args.url);
  emitir('Modo: ' + (escritura.escribe ? 'LECTURA + ESCRITURA' : 'SOLO LECTURA')
    + (args.e2e ? ' (e2e)' : '') + (args.canalDatos ? ' (canal de datos)' : ''));

  await comprobarHealth(args);
  const acuerdo = await comprobarAcuerdo(args, internoKey);
  await comprobarRutaInterna(args, internoKey);
  await comprobarCodigoNuevo(args);
  await comprobarE2e(args, internoKey, acuerdo);

  const fallas = resultados.filter(r => r.estado === 'FALLA');
  const avisos = resultados.filter(r => r.estado === 'AVISO');
  titulo('Resumen');
  emitir('  comprobaciones: ' + resultados.length
    + ' | fallas: ' + fallas.length + ' | avisos: ' + avisos.length);

  if (args.json) {
    emitir(JSON.stringify({
      url: args.url,
      modo: escritura.escribe ? 'lectura+escritura' : 'lectura',
      resultados,
      exit: fallas.length ? 1 : 0,
    }, null, 2));
  }

  if (fallas.length) {
    emitir('\nRESULTADO: FALLA');
    return 1;
  }
  emitir('\nRESULTADO: OK');
  return 0;
}

module.exports = {
  main,
  parseArgs,
  modoEscritura,
  validarArgumentos,
  multipart,
  pdfDePrueba,
  cabecerasSignRequest,
  metadataSignRequest,
  crearConsentimiento,
  comprobarE2e,
  notificarInvitacion,
  comprobarTokenResuelve,
  resultados,
  // Exportadas para los tests.
  DEFAULT_URL,
  DEFAULT_TIMEOUT_MS,
  MANIFIEST_PATH,
  ARCHIVO_LEGAL,
};

if (require.main === module) {
  main(process.argv).then((code) => {
    process.exit(code);
  }).catch((e) => {
    console.error('La prueba de humo fallo de forma inesperada: '
      + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
