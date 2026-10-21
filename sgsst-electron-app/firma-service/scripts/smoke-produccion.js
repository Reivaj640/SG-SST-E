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
 * Con `--e2e` ADEMAS crea una solicitud de firma de prueba (ESCRIBE en la base
 * y ENVIA un correo). Por eso exige `--confirmar-e2e` explicito: una prueba
 * que escribe tiene que decir que escribe.
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
    empresa: null,
    trabajador: null,
    correo: null,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    error: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--e2e') args.e2e = true;
    else if (a === '--confirmar-e2e') args.confirmarE2e = true;
    else if (a === '--canal-datos') args.canalDatos = true;
    else if (a === '--json') args.json = true;
    else if (a.startsWith('--url=')) args.url = a.split('=').slice(1).join('=');
    else if (a.startsWith('--interno=')) args.interno = a.split('=').slice(1).join('=');
    else if (a.startsWith('--interno-file=')) args.internoFile = a.split('=').slice(1).join('=');
    else if (a.startsWith('--admin=')) args.admin = a.split('=').slice(1).join('=');
    else if (a.startsWith('--admin-file=')) args.adminFile = a.split('=').slice(1).join('=');
    else if (a.startsWith('--empresa=')) args.empresa = a.split('=').slice(1).join('=');
    else if (a.startsWith('--trabajador=')) args.trabajador = a.split('=').slice(1).join('=');
    else if (a.startsWith('--correo=')) args.correo = a.split('=').slice(1).join('=');
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

async function comprobarE2e(args, internoKey, acuerdoActivo) {
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
  const { body, contentType } = multipart({
    id_documento: 'PRUEBA-HUMO-' + Date.now(),
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    tipo_firma: 'remoto',
    agreement_version: acuerdoActivo.version,
    agreement_hash: acuerdoActivo.texto_hash,
    document_hash: documentHash,
    version_kair: 'smoke-produccion',
    correo_verificacion: args.correo || 'prueba@example.com',
    tipo_identificacion: 'OTRO',
  }, { campo: 'documento', nombre: 'prueba-humo.pdf', contenido: pdf });

  let res;
  try {
    res = await pedir({
      base: args.url, path: '/internal/sign-requests', method: 'POST',
      headers: {
        'X-Internal-API-Key': internoKey,
        'Content-Type': contentType,
        'Idempotency-Key': 'smoke-' + crypto.randomBytes(8).toString('hex'),
      },
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
    }
    if (args.correo) {
      warn('Se mando un correo real a ' + args.correo,
        'si no lo pedia, la solicitud es de prueba: se puede cancelar desde la consola');
    }
  } else if (res.status === 409) {
    const codigo = (res.json && res.json.error && res.json.error.code) || 'UNKNOWN';
    if (codigo === 'EMPRESA_NO_HABILITADA') {
      fail('POST /internal/sign-requests', '409 EMPRESA_NO_HABILITADA: la Empresa '
        + 'no tiene Anexo firmado, plazo de conservacion declarado o canal PQRS. '
        + 'Es la bandera FIRMA_EXIGIR_HABILITACION_EMPRESA (que viene en true). '
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
  resultados.length = 0; // Cada corrida arranca limpio.
  _sink = salida;
  try {
    return await correr(args);
  } finally {
    _sink = null;
  }
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
  multipart,
  pdfDePrueba,
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
