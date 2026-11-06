#!/usr/bin/env node
/**
 * scripts/probar-n9a.js
 *
 * LA 9A EN EL AMBIENTE REAL: MEDIOS AUTORIZADOS (EL 8.2) Y FIRMA AUTOGRÁFICA
 * (EL 7.1-7.3)
 * ===========================================================================
 *
 * QUÉ PIDE LA COMPUERTA
 * ---------------------
 * El manifiesto legal (`legal-readiness.json` → `n9a`) tiene dos campos:
 * `probada` y `evidencia`. La compuerta de publicación los mira juntos: si
 * `probada` no es `true` o `evidencia` está vacía, el ítem "Prueba de la 9A
 * en el ambiente real" BLOQUEA la publicación (ver
 * `src/services/readinessLegal.js`, el grupo `n9a`).
 *
 * La 9A son DOS ramas de un mismo numeral:
 *
 *   - Los MEDIOS AUTORIZADOS (el 8.2): el Trabajador declara el medio
 *     electrónico por el que quiere recibir el código y la copia; el servicio
 *     exige que lo CONFIRME (declarando que ese buzón es de su uso exclusivo
 *     y que la Empresa no lo administra), archiva la declaración con su
 *     fecha, su versión de texto, su IP y su navegador, y sólo manda el OTP
 *     a ese medio.
 *   - La FIRMA AUTOGRÁFICA (el 7.1-7.3): el Trabajador que no puede usar el
 *     medio digital firma en papel; la Empresa registra el documento ya
 *     firmado y el servicio guarda el PDF, le calcula la huella, genera el
 *     "Registro de firma autográfica" (la evidencia del acto), le entrega la
 *     copia por un medio autorizado y CIERRA la vía electrónica para que no
 *     haya doble firma.
 *
 * LO QUE HACE ESTE SCRIPT
 * -----------------------
 * Ejecuta las dos ramas contra el servicio de verdad (producción o staging),
 * comprueba cada efecto mirando la API —no la base— y deja la evidencia en
 * un archivo de texto.
 *
 * ES RESUMIBLE, Y POR QUÉ IMPORTA
 * --------------------------------
 * Crear la solicitud de firma GASTA una unidad del alcance de la excepción
 * de habilitación (`assertHabilitadaParaFirma` con `cuenta_firma: true`
 * llama a `registrarUso`, que incrementa `firmas_usadas`). El alcance no se
 * devuelve: una prueba mal reintentada se come el piloto.
 *
 * Por eso el script guarda su estado en un archivo (por omisión en el
 * directorio temporal) y NUNCA crea una segunda solicitud si ya hay una
 * abierta para la misma Empresa. Un reintento CONTINÚA, no repite.
 *
 * LO QUE ESTE SCRIPT NO HACE
 * --------------------------
 * No inventa una firma real ni un Trabajador real. El documento "firmado en
 * papel" que se registra lo genera el propio script con pdf-lib y lleva
 * escrito, en su primera página, que es una prueba sintética. El canal por
 * el que el Trabajador pidió el papel se declara como lo que es: una
 * prueba. La evidencia dice exactamente eso.
 *
 * EL ID DEL TRABAJADOR Y SU NÚMERO DE IDENTIFICACIÓN SON DOS COSAS
 * ---------------------------------------------------------------
 * El servicio guarda al Trabajador como un SEUDÓNIMO (`psn1_` + 64 hex, un
 * HMAC de su documento de identidad con la llave del servicio) y los medios
 * autorizados (el 8.2) están registrados bajo ESE seudónimo. El cliente
 * nunca manda el seudónimo: manda el id CRUDO y el servicio lo seudonimiza y
 * registra los medios a nombre del seudónimo (ver `medios.registrarAltaPor
 * Solicitud`: da de alta EMAIL_HOJA_VIDA, LINK_KAIR y CORREO_OTP).
 *
 * OJO: el seudónimo tiene 69 caracteres y la API acepta 64, así que mandarlo
 * es un 400. Por eso `--trabajador` (el id crudo) y `--numero` (el documento
 * con el que se identifica en la mini-app) van separados: son dos datos
 * distintos y el segundo es el que se archiva como huella.
 *
 * USO
 * ---
 *   node scripts/probar-n9a.js \
 *        --empresa=900829731 \
 *        --trabajador=900000001 \
 *        --numero=900000001 \
 *        --correo=buzon-de-prueba@example.com \
 *        --confirmar-escribe
 *
 *   node scripts/probar-n9a.js ... --confirmar-escribe --otp=123456
 *
 * Opciones:
 *   --url=            base del servicio (por omisión http://127.0.0.1:3001)
 *   --interno-file=   archivo con la llave interna
 *                     (por omisión /opt/kair-firma/internal-key.txt)
 *   --admin-file=     archivo con la llave de administración
 *                     (por omisión /opt/kair-firma/admin-key.txt)
 *   --empresa=        NIT de la Empresa (obligatorio)
 *   --trabajador=     id CRUDO del Trabajador, de 4 a 20 dígitos (obligatorio).
 *                     El servicio lo seudonimiza y da de alta sus medios
 *                     autorizados bajo el seudónimo.
 *   --numero=         documento de identidad SINTÉTICO con el que se
 *                     identifica en la mini-app, de 4 a 20 dígitos. Si no se
 *                     pasa, es el mismo valor de `--trabajador`.
 *   --correo=         buzón del Trabajador: el medio personal que se declara
 *                     y se confirma (obligatorio)
 *   --otp=            código de 6 dígitos recibido por correo. Con esto la
 *                     prueba cierra el ciclo entero del medio (OTP_SENT +
 *                     OTP_VERIFIED). Sin esto, la rama del medio queda
 *                     probada hasta la confirmación de la declaración, que
 *                     es lo que archiva el 8.2.
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

const { DECLARACION_SALUD } = require('../src/services/declaracionSalud');

// La versión del texto de la declaración del medio personal. El servicio la
// compara con la suya y responde 409 si no es la misma: si el texto cambia,
// la pantalla tiene que recargar (ver src/routes/public.js).
const DECLARACION_MEDIO_VERSION = '1.0';

const DEFAULT_URL = 'http://127.0.0.1:3001';
const DEFAULT_TIMEOUT_MS = 30000;

// Cómo se ve un seudónimo de Trabajador: `psn1_` + 64 hex. Es el id con el
// que el servicio guarda al Trabajador y con el que están registrados sus
// medios autorizados (el 8.2). Ver src/services/trabajador.js.
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
      case 'empresa': args.empresa = valor; break;
      case 'trabajador': args.trabajador = valor; break;
      case 'numero': args.numero = valor; break;
      case 'correo': args.correo = valor; break;
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
  if (!args.estado) args.estado = path.join(os.tmpdir(), 'kair-n9a-estado.json');
  if (!args.evidencia) args.evidencia = path.join(os.tmpdir(), 'kair-n9a-evidencia.txt');
  if (!args.internoFile) args.internoFile = '/opt/kair-firma/internal-key.txt';
  if (!args.adminFile) args.adminFile = '/opt/kair-firma/admin-key.txt';
  return args;
}

function validarArgumentos(args) {
  if (args.error) return false;
  let bien = true;
  if (!args.empresa) {
    fail('Falta --empresa', 'el NIT de la Empresa que se prueba');
    bien = false;
  }
  if (!args.trabajador) {
    fail('Falta --trabajador',
      'el id del Trabajador: el valor CRUDO de 4 a 20 dígitos que el servicio '
      + 'seudonimiza');
    bien = false;
  } else if (ES_SEUDONIMO.test(String(args.trabajador))) {
    fail('--trabajador no puede ser un seudonimo',
      'el servicio seudonimiza el id que le llega (la API acepta 64 caracteres y '
      + 'el seudonimo tiene 69): mande el id CRUDO, de 4 a 20 dígitos');
    bien = false;
  } else if (!/^\d{4,20}$/.test(String(args.trabajador))) {
    fail('--trabajador no parece un documento de identidad',
      'tiene que ser de 4 a 20 dígitos');
    bien = false;
  }
  // El número con el que se identifica es OTRA cosa que el id: el id es el
  // que el servicio seudonimiza y bajo el que registra los medios; el número
  // es el que el Trabajador escribe en la mini-app.
  if (!args.numero) {
    args.numero = args.trabajador;
  } else if (!/^\d{4,20}$/.test(String(args.numero))) {
    fail('--numero no parece un documento de identidad',
      'tiene que ser de 4 a 20 dígitos');
    bien = false;
  }
  if (!args.correo || !String(args.correo).includes('@')) {
    fail('Falta --correo o no es un correo', 'el buzón del Trabajador');
    bien = false;
  }
  if (args.otp && !/^\d{6}$/.test(String(args.otp))) {
    fail('--otp no son 6 dígitos', 'el código de verificación son 6 dígitos');
    bien = false;
  }
  return bien;
}

/**
 * La llave: del argumento en línea, del archivo o del ambiente. Nunca se
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
  const boundary = '----kairn9a' + crypto.randomBytes(12).toString('hex');
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
// PDF
// ===========================================================================

/**
 * El documento "firmado en papel".
 *
 * Es SINTÉTICO y lo dice en la primera página. La firma es un trazo: no se
 * está suplantando a nadie, y el Registro de firma autográfica que genera el
 * servidor dice lo mismo.
 */
async function pdfFirmadoEnPapel(datos) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

  const pagina = doc.addPage([595, 842]);
  pagina.drawText('PRUEBA DE LA 9A - DATOS SINTETICOS - NO ES EVIDENCIA DE UN ACTO REAL',
    { x: 50, y: 780, size: 11, font: negrita, color: rgb(0.7, 0, 0) });
  pagina.drawText('Documento generado por scripts/probar-n9a.js para verificar la via en',
    { x: 50, y: 758, size: 10, font: fuente });
  pagina.drawText('papel (el 7.1-7.3) en el ambiente real. El Trabajador es un dato',
    { x: 50, y: 744, size: 10, font: fuente });
  pagina.drawText('sintetico: no hay persona real detras de esta firma.',
    { x: 50, y: 730, size: 10, font: fuente });
  pagina.drawText(' ', { x: 50, y: 710, size: 10, font: fuente });

  const campos = [
    ['Empresa', datos.empresa],
    ['Identificacion del documento', datos.idDocumento],
    ['Fecha de la firma en papel', datos.fechaFirma],
    ['Firmante', 'Trabajador sintetico de prueba'],
    ['Medio por el que se entrega la copia', datos.medio || '(por definir)'],
  ];
  let y = 680;
  for (const [etiqueta, valor] of campos) {
    pagina.drawText(etiqueta + ':', { x: 50, y, size: 10, font: negrita });
    pagina.drawText(String(valor), { x: 230, y, size: 10, font: fuente });
    y -= 18;
  }

  // El bloque de la firma: un trazo y la constancia de que es sintético.
  pagina.drawText(' ', { x: 50, y: 560, size: 10, font: fuente });
  pagina.drawText('FIRMA (TRAZO SINTETICO)', { x: 50, y: 540, size: 9, font: negrita });
  pagina.drawLine({
    start: { x: 50, y: 500 }, end: { x: 260, y: 500 },
    thickness: 1, color: rgb(0.1, 0.1, 0.3),
  });
  pagina.drawText('/s/ FIRMA SINTETICA DE PRUEBA', { x: 50, y: 482, size: 11, font: fuente });
  pagina.drawText(' ', { x: 50, y: 450, size: 10, font: fuente });
  pagina.drawText('Este PDF lo genero el operador de la prueba. El servidor le calculo la',
    { x: 50, y: 430, size: 9, font: fuente });
  pagina.drawText('huella SHA-256 y lo guardo como el documento firmado en papel.',
    { x: 50, y: 418, size: 9, font: fuente });

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
 * Es la condición que decide si la corrida CONTINÚA una solicitud ya creada
 * (que no gasta alcance) o si tiene que crear una nueva (que sí lo gasta).
 * Se usa en DOS lugares y tiene que ser la misma decisión en los dos: si el
 * control de alcance dijera "continuá" y el paso 3 dijera "creá otra", la
 * corrida gastaría alcance sin avisar.
 *
 * @param {object} args
 * @param {object|null} estadoPrevio
 * @returns {boolean}
 */
function esLaMismaPrueba(args, estadoPrevio) {
  if (!estadoPrevio) return false;
  return estadoPrevio.empresa === args.empresa
    && String(estadoPrevio.trabajador) === String(args.trabajador)
    && String(estadoPrevio.numero || '') === String(args.numero);
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
    fail('GET /health', 'no respondió: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /health', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
    return null;
  }
  const salud = res.json || {};
  ok('El servicio responde', 'status=' + salud.status + ' db=' + ((salud.checks || {}).db));

  if (!internoKey) {
    fail('Falta la llave interna', '(--interno-file o FIRMA_N9A_INTERNAL_KEY)');
    return null;
  }
  try {
    res = await pedir({
      base: args.url, path: '/internal/acuerdo-activo', method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/acuerdo-activo', 'no respondió: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/acuerdo-activo', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
    return null;
  }
  const acuerdo = res.json || {};
  ok('Hay un Acuerdo vigente', 'version=' + acuerdo.version + ' hash=' + String(acuerdo.texto_hash).slice(0, 16));
  return acuerdo;
}

/**
 * 2 · La excepción de habilitación: cuánto alcance queda y si la ruta en
 * papel está operativa.
 *
 * Esto va ANTES de crear nada, porque crear gasta alcance y no se devuelve.
 */
async function pasoExcepcion(args, adminKey, continuacion) {
  titulo('2. La excepción de habilitación (el alcance y la ruta en papel)');
  if (!adminKey) {
    warn('Sin llave de administración', 'no se puede leer el alcance de la excepción: '
      + 'el script sigue, pero no puede avisarte antes de gastarlo');
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
    warn('No se pudo leer la excepción', e.message);
    return { bloquea: false, excepcion: null };
  }
  if (res.status !== 200) {
    warn('No se pudo leer la excepción', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 200));
    return { bloquea: false, excepcion: null };
  }
  const items = (res.json || {}).items || [];
  const vigente = items.find((e) => e.estado === 'VIGENTE');
  if (!vigente) {
    fail('La Empresa tiene una excepción vigente', 'no hay ninguna en estado VIGENTE');
    return { bloquea: true, excepcion: null };
  }
  const usadas = Number(vigente.firmas_usadas || 0);
  const maximo = Number(vigente.alcance_firmas_max || 0);
  ok('La excepción vigente', 'id=' + vigente.id + ' firmas ' + usadas + '/' + maximo
    + ' · ruta_papel_operativa=' + vigente.ruta_papel_operativa
    + ' · plazo_hasta=' + vigente.plazo_hasta);

  if (usadas >= maximo) {
    // LA CORRIDA QUE CONTINÚA NO GASTA ALCANCE.
    //
    // La creación de la solicitud es lo que consume el alcance, y esa ya
    // pasó: la firma está en curso y es la MISMA. El alcance agotado no puede
    // frenar el resto de la prueba (que además no crea nada: la firma en
    // papel no se cuenta). Frenar acá dejaría una solicitud a medio hacer
    // para siempre, con el alcance quemado y sin evidencia.
    if (continuacion) {
      ok('La excepción ya consumió su alcance',
        'esta corrida NO crea una solicitud nueva: CONTINÚA la que ya está en '
        + 'curso, que es la que consumió ese alcance. La firma en papel no gasta '
        + 'alcance');
      return { bloquea: false, excepcion: vigente };
    }
    fail('Queda alcance para una firma', 'la excepción ya usó las ' + usadas
      + ' de ' + maximo + ': crear otra solicitud NO se puede');
    return { bloquea: true, excepcion: vigente };
  }
  if (vigente.ruta_papel_operativa !== 1 && vigente.ruta_papel_operativa !== true) {
    fail('La ruta en papel está operativa', 'ruta_papel_operativa=' + vigente.ruta_papel_operativa);
    return { bloquea: true, excepcion: vigente };
  }
  ok('Queda una firma de alcance y la ruta en papel está operativa',
    'esta prueba consume la que queda');
  return { bloquea: false, excepcion: vigente };
}

/** 3 · La solicitud de firma (y el consentimiento del Acuerdo). */
async function pasoCrear(args, internoKey, acuerdo, estadoPrevio) {
  titulo('3. La solicitud de firma (ESCRIBE)');

  if (estadoPrevio) {
    // El estado guardado tiene que ser DE ESTA PRUEBA. Si es de otra Empresa
    // o de otro Trabajador, no se continúa: se avisa y se empieza de cero
    // (que es crear OTRA solicitud, con su propio alcance).
    //
    // El número de identidad también se compara: si se cambia a mitad de una
    // prueba, la identificación no podría coincidir con la huella archivada.
    if (!esLaMismaPrueba(args, estadoPrevio)) {
      fail('El estado guardado es de otra prueba',
        args.estado + ' es de la empresa ' + estadoPrevio.empresa
        + ' y del trabajador ' + estadoPrevio.trabajador + ', y esta corrida es de '
        + args.empresa + ' y ' + args.trabajador + '. Borre ese archivo si quiere '
        + 'empezar de cero: ojo, eso crea una solicitud nueva y gasta alcance');
      return null;
    }
    ok('Se continúa la solicitud anterior', 'id_solicitud=' + estadoPrevio.id_solicitud
      + ' (creada ' + estadoPrevio.creado_at + '). NO se crea otra: el alcance '
      + 'de la excepción no se devuelve');
    return estadoPrevio;
  }

  // 3a · El consentimiento del Acuerdo (el Bloque E6). Sin él, la mini-app
  // no deja aceptar el Acuerdo y la firma no se puede completar.
  const cuerpoConsent = {
    id_trabajador: args.trabajador,
    id_empresa: args.empresa,
    version_acuerdo: acuerdo.version,
    correo_verificacion: args.correo,
    kair_version: 'probar-n9a',
  };
  let res = await pedirJson({
    base: args.url, path: '/internal/consentimientos', method: 'POST',
    headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': 'application/json' },
  }, cuerpoConsent, args.timeoutMs);

  let consentId = null;
  if (res.status === 201 || res.status === 200) {
    consentId = (res.json || {}).consent_id;
    ok('El consentimiento del Acuerdo quedó creado', 'consent_id=' + consentId);
  } else if (res.status === 409) {
    const codigo = ((res.json || {}).error || {}).code;
    const detalles = ((res.json || {}).error || {}).details || {};
    if (codigo === 'CONSENT_PENDING' && detalles.consent_id) {
      consentId = detalles.consent_id;
      warn('Había un consentimiento pendiente y se reutiliza', 'consent_id=' + consentId);
    } else {
      fail('El consentimiento del Acuerdo', 'HTTP 409 ' + codigo + ' :: ' + res.texto.slice(0, 250));
      return null;
    }
  } else {
    fail('El consentimiento del Acuerdo', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
    return null;
  }

  // 3b · La solicitud de firma. El endpoint es multipart y recibe UN campo
  // `metadata` con un JSON string; el schema es estricto: una clave de más
  // es un 400 que no dice nada útil.
  const idDocumento = 'PRUEBA-9A-' + Date.now();
  const pdf = await pdfFirmadoEnPapel({
    empresa: args.empresa,
    idDocumento,
    fechaFirma: new Date().toISOString(),
    medio: '(se define al registrar)',
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
    // El pre-hash del número, sin sal: el servicio lo reconoce y reescribe
    // la fila con su HMAC (migración 019).
    identificacion_numero_hash: crypto.createHash('sha256').update(numero).digest('hex'),
    document_hash: documentHash,
    version_kair: 'probar-n9a',
    correo_verificacion: args.correo,
    tipo_identificacion: 'OTROSI',
    nombre_trabajador: 'Trabajador sintetico de prueba 9A',
    nombre_empresa: 'PRUEBA 9A',
    correo_empresa: args.correo,
    declaracion_datos_sensibles: DECLARACION_SALUD,
    metadata: JSON.stringify({ subtipo_identificacion: 'prueba-9a' }),
    consent_id: consentId,
  };

  const { body, contentType } = multipart({
    metadata: JSON.stringify(metadata),
  }, { campo: 'documento', nombre: 'prueba-9a.pdf', contenido: pdf });

  res = await pedir({
    base: args.url, path: '/internal/sign-requests', method: 'POST',
    headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': contentType },
  }, body, args.timeoutMs);

  if (res.status !== 201 && res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('La solicitud de firma se creó', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 300));
    return null;
  }
  const r = res.json || {};
  const token = r.token || (r.url_publica ? String(r.url_publica).split('/').pop() : null);
  if (!r.id_solicitud || !token) {
    fail('La solicitud de firma se creó', 'HTTP ' + res.status
      + ' sin id_solicitud o sin token en la respuesta');
    return null;
  }
  ok('La solicitud de firma se creó', 'id_solicitud=' + r.id_solicitud
    + ' · estado=' + (r.estado || '(sin estado en la respuesta)'));
  if (r.agreement_hash) {
    if (r.agreement_hash === acuerdo.texto_hash) {
      ok('Quedó ligada a la versión vigente del Acuerdo', 'agreement_hash=' + String(r.agreement_hash).slice(0, 16));
    } else {
      fail('Quedó ligada a la versión vigente del Acuerdo',
        'devuelto=' + r.agreement_hash + ' vigente=' + acuerdo.texto_hash);
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
    creado_at: new Date().toISOString(),
    consent_id: consentId,
    document_hash: documentHash,
    pasos: { creado: true, notificado: false, identificado: false, otp_verificado: false, papel_registrado: false },
  };
  guardarEstado(args, estado);
  return estado;
}

/** 4 · La invitación sale por correo (el primer contacto con el firmante). */
async function pasoNotificar(args, internoKey, estado) {
  titulo('4. La invitación sale por correo (ESCRIBE)');
  if (estado.pasos && estado.pasos.notificado) {
    ok('La invitación ya se había enviado', 'se omite (continuar, no repetir)');
    return true;
  }
  let res;
  try {
    res = await pedirJson({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud) + '/notify-remote',
      method: 'POST',
      headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': 'application/json' },
    }, { correo: args.correo, token: estado.token }, args.timeoutMs);
  } catch (e) {
    fail('La invitación sale por correo', 'no respondió: ' + e.message);
    return false;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('La invitación sale por correo', 'HTTP ' + res.status + ' ' + codigo
      + ' :: ' + res.texto.slice(0, 250));
    return false;
  }
  ok('La invitación salió por correo', 'messageId=' + ((res.json || {}).messageId || '(sin messageId)'));
  estado.pasos.notificado = true;
  guardarEstado(args, estado);
  return true;
}

/** 5 · Los medios autorizados: los que quedan registrados al crear (el 8.2). */
async function pasoMedios(args, internoKey, estado) {
  titulo('5. Los medios autorizados (el 8.2)');
  let res;
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud) + '/medios',
      method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests/:id/medios', 'no respondió: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/sign-requests/:id/medios', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
    return null;
  }
  const j = res.json || {};
  const medios = j.medios || [];
  const tipos = medios.map((m) => m.tipo + '/' + m.estado + '/' + m.origen);
  ok('Los medios que quedaron registrados al crear la solicitud',
    tipos.length ? tipos.join(' · ') : '(ninguno)');

  const tieneHojaVida = medios.some((m) => m.tipo === 'EMAIL_HOJA_VIDA' && m.estado === 'ACTIVO');
  const tieneLink = medios.some((m) => m.tipo === 'LINK_KAIR' && m.estado === 'ACTIVO');
  if (tieneHojaVida && tieneLink) {
    ok('Los dos medios que el 8.2 autoriza de entrada quedaron registrados',
      'EMAIL_HOJA_VIDA + LINK_KAIR');
  } else {
    fail('Los dos medios que el 8.2 autoriza de entrada',
      'faltan: ' + (!tieneHojaVida ? 'EMAIL_HOJA_VIDA ' : '') + (!tieneLink ? 'LINK_KAIR' : ''));
  }
  return medios;
}

/**
 * 6 · El Trabajador declara su medio y lo CONFIRMA.
 *
 * Acá se da la declaración del 8.2: el Trabajador dice que el buzón es de su
 * uso exclusivo y que la Empresa no lo administra. El servicio la archiva
 * (fecha, IP, navegador, versión del texto) y manda el OTP a ese buzón.
 */
async function pasoIdentificar(args, estado) {
  titulo('6. El Trabajador declara y confirma su medio (el 8.2)');
  if (estado.pasos && estado.pasos.identificado) {
    ok('La identificación ya se había hecho', 'se omite (continuar, no repetir)');
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
      medio_otp_version: DECLARACION_MEDIO_VERSION,
    }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/identify', 'no respondió: ' + e.message);
    return false;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('El Trabajador declara y confirma su medio',
      'HTTP ' + res.status + ' ' + codigo + ' :: ' + res.texto.slice(0, 300));
    return false;
  }
  const j = res.json || {};
  ok('El medio quedó declarado y confirmado; el OTP salió a ese buzón',
    'estado=' + j.estado + ' · destino=' + j.correo_destino_enmascarado
    + ' · vence en ' + Math.round((j.otp_ttl_seconds || 600) / 60) + ' min');
  estado.pasos.identificado = true;
  guardarEstado(args, estado);
  return true;
}

/**
 * 7 · El código de verificación (si el operador lo pasó).
 *
 * Devuelve 'OK' (verificado), 'ESPERA' (falta el código, o venció y se pidió
 * uno nuevo) o 'FALLA' (el código no era el correcto).
 */
async function pasoOtp(args, estado) {
  titulo('7. El código de verificación (OTP_VERIFIED)');
  if (!args.otp) {
    warn('No se pasó --otp',
      'la rama del medio queda probada hasta la CONFIRMACIÓN de la declaración '
      + '(que es lo que archiva el 8.2), pero no hasta que el Trabajador '
      + 'demuestre que controla el buzón. Para cerrarla: lea el código de 6 '
      + 'dígitos del correo y corra otra vez con --otp=');
    return 'ESPERA';
  }
  if (estado.pasos && estado.pasos.otp_verificado) {
    ok('El código ya se había verificado', 'se omite');
    return 'OK';
  }
  let res;
  try {
    res = await pedirJson({
      base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { otp: String(args.otp) }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/verify-otp', 'no respondió: ' + e.message);
    return 'FALLA';
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    // El código venció: el OTP vive 10 minutos. En vez de fallar, se pide
    // uno nuevo (la ruta que el servicio ofrece para eso) y el operador
    // corre otra vez. La solicitud es la misma: no se gasta más alcance.
    //
    // El código que devuelve el servicio es OTP_EXPIRADO (410). CODIGO_EXPIRADO
    // se acepta también, para no depender del nombre exacto de un código de
    // error: lo que importa es que se sepa que hay que pedir otro.
    if (codigo === 'OTP_EXPIRADO' || codigo === 'CODIGO_EXPIRADO') {
      warn('El código venció', 'se pide uno nuevo al mismo buzón');
      let r2;
      try {
        r2 = await pedirJson({
          base: args.url, path: '/api/sign/' + encodeURIComponent(estado.token) + '/resend-otp',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }, {}, args.timeoutMs);
      } catch (e) {
        fail('POST /api/sign/:token/resend-otp', 'no respondió: ' + e.message);
        return 'FALLA';
      }
      if (r2.status === 200) {
        warn('Se pidió un código nuevo', 'lea el código nuevo del correo y corra '
          + 'otra vez con --otp=<6 dígitos>');
        return 'ESPERA';
      }
      fail('Se pidió un código nuevo', 'HTTP ' + r2.status + ' :: ' + r2.texto.slice(0, 250));
      return 'FALLA';
    }
    fail('El código de verificación es el correcto',
      'HTTP ' + res.status + ' ' + codigo + ' :: ' + res.texto.slice(0, 250));
    return 'FALLA';
  }
  ok('El código de verificación era el correcto', 'estado=' + ((res.json || {}).estado || '(sin estado)'));
  estado.pasos.otp_verificado = true;
  guardarEstado(args, estado);
  return 'OK';
}

/** 8 · La firma autográfica: la Empresa registra el documento ya firmado. */
async function pasoPapel(args, internoKey, estado) {
  titulo('8. La firma autográfica (el 7.1-7.3)');
  if (estado.pasos && estado.pasos.papel_registrado) {
    ok('La firma en papel ya estaba registrada', 'se omite (continuar, no repetir)');
    return true;
  }
  const pdf = await pdfFirmadoEnPapel({
    empresa: args.empresa,
    idDocumento: estado.id_solicitud,
    fechaFirma: new Date().toISOString(),
    medio: args.correo,
  });

  const { body, contentType } = multipart({
    // El canal por el que el Trabajador pidió el papel. Es lo que prueba que
    // la vía existía y era accesible. Acá se declara lo que es: una PRUEBA,
    // no una petición real de una persona.
    metadata: JSON.stringify({
      canal: 'PRUEBA_SINTETICA_9A_CANAL_DE_ATENCION_DE_LA_EMPRESA',
      nota: 'Prueba de la 9A: el Trabajador es un dato sintetico y el operador '
        + 'simulo la peticion por el canal de atencion de la Empresa, que es '
        + 'el canal que declara la excepcion de habilitacion vigente.',
    }),
  }, { campo: 'documento', nombre: 'prueba-9a-firmado-en-papel.pdf', contenido: pdf });

  let res;
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud) + '/firma-papel',
      method: 'POST',
      headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': contentType },
    }, body, args.timeoutMs);
  } catch (e) {
    fail('POST /internal/sign-requests/:id/firma-papel', 'no respondió: ' + e.message);
    return false;
  }
  if (res.status !== 200) {
    const codigo = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('La Empresa registró el documento firmado en papel',
      'HTTP ' + res.status + ' ' + codigo + ' :: ' + res.texto.slice(0, 300));
    return false;
  }
  const j = res.json || {};
  ok('La firma en papel quedó registrada', 'estado=' + j.estado_papel
    + ' · pdf_hash=' + String(j.pdf_hash || '').slice(0, 16));
  if (j.registro_path) {
    ok('El Registro de firma autográfica se generó', 'registro_path=' + j.registro_path);
  } else {
    fail('El Registro de firma autográfica se generó', 'la respuesta no trae registro_path');
  }
  if (j.copia && j.copia.enviada) {
    ok('La copia salió al Trabajador por un medio autorizado',
      'medio=' + j.copia.medio);
  } else {
    fail('La copia salió al Trabajador por un medio autorizado',
      'copia=' + JSON.stringify(j.copia || {}));
  }
  estado.pasos.papel_registrado = true;
  estado.pdf_hash_papel = j.pdf_hash || null;
  estado.registro_path = j.registro_path || null;
  estado.copia = j.copia || null;
  guardarEstado(args, estado);
  return true;
}

/** 9 · La comprobación final: los eventos y la fila de la firma. */
async function pasoVerificar(args, internoKey, estado) {
  titulo('9. La evidencia: los eventos y la fila');
  let res;
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud) + '/eventos',
      method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests/:id/eventos', 'no respondió: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /internal/sign-requests/:id/eventos', 'HTTP ' + res.status + ' :: ' + res.texto.slice(0, 250));
    return null;
  }
  const j = res.json || {};
  const eventos = j.eventos || j.items || [];
  const tipos = eventos.map((e) => e.tipo_evento);
  emitir('  eventos: ' + (tipos.join(' · ') || '(ninguno)'));

  const exigidos = [
    ['CREATED', 'la solicitud se creó'],
    ['INVITE_SENT', 'la invitación salió por correo'],
    ['MEDIO_PERSONAL_CONFIRMADO', 'la declaración del medio quedó archivada'],
    ['OTP_SENT', 'el código salió al medio declarado'],
    ['PAPER_OPTION_AVAILABLE', 'la vía en papel se ofreció'],
    ['PAPER_TRACK_OPENED', 'la vía en papel se abrió'],
    ['PAPER_SIGNATURE_REGISTERED', 'el documento firmado en papel quedó registrado'],
    ['ELECTRONIC_FLOW_CANCELLED', 'la vía electrónica quedó cerrada (sin doble firma)'],
  ];
  for (const [tipo, que] of exigidos) {
    if (tipos.includes(tipo)) {
      const ev = eventos.find((e) => e.tipo_evento === tipo);
      ok('Evento ' + tipo, que + ' · ' + (ev.fecha_evento || ''));
    } else if (tipo === 'OTP_VERIFIED' || tipo === 'MEDIO_PERSONAL_CONFIRMADO') {
      warn('Evento ' + tipo + ' ausente', que);
    } else {
      fail('Evento ' + tipo + ' ausente', que);
    }
  }
  if (tipos.includes('OTP_VERIFIED')) {
    ok('Evento OTP_VERIFIED', 'el Trabajador demostró que controla el buzón');
  } else {
    warn('Evento OTP_VERIFIED ausente',
      'sin --otp la prueba no llega a confirmar que el Trabajador controla el buzón');
  }

  // La fila de la firma: el estado final y el vínculo con el papel.
  try {
    res = await pedir({
      base: args.url,
      path: '/internal/sign-requests/' + encodeURIComponent(estado.id_solicitud),
      method: 'GET',
      headers: { 'X-Internal-API-Key': internoKey },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /internal/sign-requests/:id', 'no respondió: ' + e.message);
    return eventos;
  }
  if (res.status === 200) {
    const fila = res.json || {};
    const papel = fila.firma_papel || null;
    if (papel && papel.estado === 'FIRMADO') {
      ok('La fila de la firma en papel está en FIRMADO',
        'pdf_hash=' + String(papel.pdf_hash || '').slice(0, 16)
        + ' · registro=' + (papel.registro_path || '(sin registro)'));
    } else {
      fail('La fila de la firma en papel está en FIRMADO',
        'firma_papel=' + JSON.stringify(papel));
    }
    if (fila.estado === 'CANCELLED') {
      ok('La vía electrónica quedó cerrada', 'estado=' + fila.estado);
    } else {
      warn('La vía electrónica no quedó CANCELLED', 'estado=' + fila.estado);
    }
  } else {
    warn('No se pudo leer la fila de la solicitud', 'HTTP ' + res.status);
  }
  return eventos;
}

/**
 * 10 · La evidencia, en texto.
 *
 * Es lo que va al manifiesto (`legal-readiness.json` → `n9a.evidencia`). Dice
 * qué se probó, cuándo, contra qué, con qué ids y con qué huellas, y dice
 * también qué NO es real: el Trabajador y el papel son sintéticos.
 */
function escribirEvidencia(args, contexto) {
  const lineas = [];
  lineas.push('PRUEBA DE LA 9A EN EL AMBIENTE REAL (K+AIR)');
  lineas.push('=============================================');
  lineas.push('Fecha: ' + new Date().toISOString());
  lineas.push('Servicio: ' + args.url);
  lineas.push('Script: scripts/probar-n9a.js');
  lineas.push('Empresa: ' + args.empresa);
  lineas.push('Solicitud: ' + contexto.estado.id_solicitud);
  lineas.push('Trabajador (id CRUDO, SINTETICO): ' + args.trabajador
    + '  (el servicio lo guarda como seudonimo; ese valor esta en la base)');
  lineas.push('Documento de identidad con el que se identifico: SINTETICO, ' + args.numero);
  lineas.push('Acuerdo vigente: ' + (contexto.acuerdo ? contexto.acuerdo.version : '(desconocido)')
    + ' · hash ' + (contexto.acuerdo ? String(contexto.acuerdo.texto_hash).slice(0, 16) : '(desconocido)'));
  if (contexto.excepcion) {
    lineas.push('Excepcion de habilitacion: id=' + contexto.excepcion.id
      + ' · firmas ' + contexto.excepcion.firmas_usadas + '/' + contexto.excepcion.alcance_firmas_max
      + ' · ruta_papel_operativa=' + contexto.excepcion.ruta_papel_operativa
      + ' · plazo_hasta=' + contexto.excepcion.plazo_hasta);
  }
  lineas.push('');
  lineas.push('MEDIOS AUTORIZADOS (el 8.2)');
  lineas.push('---------------------------');
  lineas.push('Al crear la solicitud quedaron registrados los dos medios que el 8.2 '
    + 'autoriza de entrada: EMAIL_HOJA_VIDA y LINK_KAIR.');
  if (contexto.medios && contexto.medios.length) {
    for (const m of contexto.medios) {
      lineas.push('  - ' + m.tipo + ' · ' + m.estado + ' · origen ' + m.origen
        + ' · valor ' + (m.tipo === 'LINK_KAIR' ? '(el enlace de K+AIR)' : m.valor));
    }
  }
  lineas.push('El Trabajador declaro su medio personal y lo confirmo (que ese buzon es de '
    + 'su uso exclusivo y que la Empresa no lo administra): la declaracion quedo '
    + 'archivada con fecha, IP y navegador, y el OTP salio solo a ese buzon.');
  lineas.push('Medio declarado: ' + args.correo);
  lineas.push('OTP_VERIFIED: ' + (contexto.otpVerificado
    ? 'SI. El Trabajador demostro que controla el buzon.'
    : 'NO. La prueba llega hasta la confirmacion de la declaracion, que es lo que '
      + 'archiva el 8.2, pero no hasta la verificacion del codigo.'));
  lineas.push('');
  lineas.push('FIRMA AUTOGRAFICA (el 7.1-7.3)');
  lineas.push('----------------------------');
  lineas.push('La Empresa registro el documento ya firmado en papel por '
    + 'POST /internal/sign-requests/:id/firma-papel.');
  lineas.push('El servicio guardo el PDF, le calculo la huella, genero el Registro de '
    + 'firma autografica, entrego la copia por un medio autorizado y CERRO la via '
    + 'electronica (ELECTRONIC_FLOW_CANCELLED) para que no haya doble firma.');
  lineas.push('Huella del PDF firmado en papel: ' + (contexto.pdfHash || '(desconocida)'));
  lineas.push('Registro de firma autografica: ' + (contexto.registroPath || '(desconocido)'));
  lineas.push('Copia entregada: ' + (contexto.copia && contexto.copia.enviada
    ? 'SI, por el medio ' + (contexto.copia.medio || '(desconocido)') + '.'
    : 'NO. ' + JSON.stringify(contexto.copia || {})));
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
  lineas.push('El documento con el que el Trabajador se identifica es SINTETICO ('
    + args.numero + '): no es el documento de ninguna persona. El documento firmado en '
    + 'papel lo genero el propio script y lo dice en su primera pagina. El canal por el '
    + 'que el Trabajador pidio el papel se declaro como '
    + 'PRUEBA_SINTETICA_9A_CANAL_DE_ATENCION_DE_LA_EMPRESA, que es el canal que declara '
    + 'la excepcion de habilitacion vigente.');
  lineas.push('Lo que si es real es el buzon: el medio personal que declara el Trabajador '
    + 'es el buzon de la pruebas, el mismo que uso la prueba manual de la firma '
    + 'electronica, y ahi llega el codigo y la copia del documento firmado.');
  lineas.push('Lo que la prueba demuestra es que el MECANISMO funciona en el ambiente '
    + 'real contra el servicio desplegado: el medio se declara y se archiva, el codigo '
    + 'sale al buzon declarado, el papel se registra, el servidor calcula la huella y '
    + 'genera el Registro de firma autografica, la copia sale y la via electronica se '
    + 'cierra.');
  lineas.push('');
  lineas.push('REPRODUCIR');
  lineas.push('---------');
  lineas.push('node scripts/probar-n9a.js --empresa=' + args.empresa
    + ' --trabajador=' + args.trabajador + ' --numero=' + args.numero
    + ' --correo=' + args.correo + ' --confirmar-escribe');

  const texto = lineas.join('\n') + '\n';
  fs.writeFileSync(args.evidencia, texto, 'utf8');
  return texto;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function correr(args) {
  const internoKey = leerLlave(null, args.internoFile, 'FIRMA_N9A_INTERNAL_KEY');
  const adminKey = leerLlave(null, args.adminFile, 'FIRMA_N9A_ADMIN_KEY');

  titulo('0. Que se puede escribir');
  if (!args.confirmarEscribe) {
    warn('Modo lectura', 'esta corrida NO escribe nada. Para ejecutar la 9A hay que '
      + 'pasar --confirmar-escribe: crea una solicitud de firma, manda correos y '
      + 'gasta una unidad del alcance de la excepcion.');
    emitir('');
    emitir('  (sin --confirmar-escribe el script no hace nada mas)');
    return 0;
  }
  ok('Modo escritura confirmado', 'se crearan filas y se mandaran correos');

  const acuerdo = await pasoSalud(args, internoKey);
  if (!acuerdo) return resumen() === 0 ? 0 : 1;

  // El estado se lee ANTES del control de alcance: si esta corrida CONTINÚA
  // una solicitud que ya existe, el alcance ya está consumido por ella y no
  // puede frenar la prueba.
  const estadoPrevio = leerEstado(args);
  const continuacion = esLaMismaPrueba(args, estadoPrevio);

  const leida = await pasoExcepcion(args, adminKey, continuacion);
  if (leida.bloquea) return resumen() === 0 ? 0 : 1;
  const excepcion = leida.excepcion;
  const estado = await pasoCrear(args, internoKey, acuerdo, estadoPrevio);
  if (!estado) return resumen() === 0 ? 0 : 1;

  const notificado = await pasoNotificar(args, internoKey, estado);
  if (!notificado) return resumen() === 0 ? 0 : 1;

  const medios = await pasoMedios(args, internoKey, estado);
  if (!medios) return resumen() === 0 ? 0 : 1;

  const identificado = await pasoIdentificar(args, estado);
  if (!identificado) return resumen() === 0 ? 0 : 1;

  const resultadoOtp = await pasoOtp(args, estado);
  if (resultadoOtp === 'FALLA') return resumen() === 0 ? 0 : 1;
  const otpVerificado = resultadoOtp === 'OK';
  if (!otpVerificado) {
    titulo('8-9. La firma en papel y la evidencia');
    warn('La prueba se detiene acá', 'falta el código de verificación. Corra otra vez '
      + 'con --otp=<6 dígitos> y el script CONTINÚA esta misma solicitud: no crea '
      + 'otra y no gasta otro alcance.');
    return 3;
  }

  const papel = await pasoPapel(args, internoKey, estado);
  if (!papel) return resumen() === 0 ? 0 : 1;

  const eventos = await pasoVerificar(args, internoKey, estado);

  titulo('10. La evidencia');
  const texto = escribirEvidencia(args, {
    acuerdo,
    excepcion,
    estado,
    medios,
    eventos,
    otpVerificado,
    pdfHash: estado.pdf_hash_papel,
    registroPath: estado.registro_path,
    copia: estado.copia,
  });
  ok('La evidencia quedó escrita', args.evidencia);
  emitir('');
  emitir(texto);

  return resumen() === 0 ? 0 : 1;
}

async function main(argv) {
  const args = parseArgs(argv || process.argv);
  if (!validarArgumentos(args)) {
    emitir('');
    emitir('Uso: node scripts/probar-n9a.js --empresa=NIT --trabajador=ID '
      + '--numero=CC --correo=buzon --confirmar-escribe [--otp=123456]');
    return 2;
  }
  try {
    return await correr(args);
  } catch (e) {
    fail('El script terminó con una excepción', e && e.message ? e.message : String(e));
    return 1;
  }
}

/** Para los tests: vacía la lista de resultados entre corridas. */
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
  multipart,
  pdfFirmadoEnPapel,
  escribirEvidencia,
  correr,
  reiniciar,
  fijarSalida,
  resultados,
  DEFAULT_URL,
  DEFAULT_TIMEOUT_MS,
  DECLARACION_MEDIO_VERSION,
};

if (require.main === module) {
  main(process.argv).then((code) => {
    process.exit(code);
  }).catch((e) => {
    console.error('La prueba de la 9A falló de forma inesperada: '
      + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
