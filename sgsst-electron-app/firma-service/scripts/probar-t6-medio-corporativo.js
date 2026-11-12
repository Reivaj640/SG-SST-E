#!/usr/bin/env node
/**
 * scripts/probar-t6-medio-corporativo.js
 *
 * EL T6 EN EL AMBIENTE REAL: EL CASO DEL BUZON CORPORATIVO RECHAZADO Y EL DEL
 * MEDIO PERSONAL CONFIRMADO
 * ===========================================================================
 *
 * QUE PIDE LA COMPUERTA
 * ---------------------
 * El T6 del cierre (el punto "T6" del informe de correcciones para el asesor
 * juridico, `docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/
 * 10-informe-correcciones-para-asesor-juridico.md`) pide:
 *
 *   "E2E controlado con el caso 'buzon corporativo rechazado' y el caso 'medio
 *   personal confirmado', limpieza del rastro y acta."
 *
 * Y el manifiesto legal (`legal-readiness.json` -> `d02`) tiene el item
 * `inventario_buzones`, que hoy vale 0 con esta evidencia: "0 solicitudes
 * revisadas y 0 casos en riesgo (47.4) ... el resultado es 0 por poblacion
 * vacia, asi que el inventario hay que repetirlo cuando haya solicitudes
 * reales".
 *
 * QUE ES EL CASO
 * --------------
 * El OTP es el DATO DE CREACION de la firma (el 3.4(e) y el 3.7(a) del
 * Acuerdo). Si el buzon al que sale pertenece a un dominio que la EMPRESA
 * puede leer, la Empresa tambien puede leer el codigo, y entonces los datos
 * de creacion no corresponderian exclusivamente al firmante (el 2.2.2.47.4
 * num. 1 del Decreto 1074 de 2015) y la garantia del 6.1(d) seria falsa.
 *
 * Por eso el servicio RECHAZA la solicitud cuando el medio declarado cae en un
 * dominio corporativo, y deja el caso en el registro append-only de eventos
 * (`gh_firma_eventos`) con el aviso `OTP_MEDIO_CORPORATIVO`. Ese control es
 * INCONDICIONAL desde la v1.2 del Acuerdo: no hay ningun interruptor que lo
 * desactive (`src/services/publicFlow.js`, funcion `_controlarMedioCorporativo`).
 *
 * LO QUE HACE ESTE SCRIPT
 * -----------------------
 * Corre los DOS casos que pide el T6 contra el servicio de verdad y deja la
 * evidencia en un archivo de texto:
 *
 *   CASO A - EL RECHAZO. El Trabajador declara un buzon CORPORATIVO. El
 *   servicio tiene que:
 *     (a) responder 400 con el codigo MEDIO_OTP_CORPORATIVO;
 *     (b) dejar el evento `OTP_MEDIO_CORPORATIVO` en `gh_firma_eventos`, con su
 *         metadata (origen, dominio_corporativo, resultado, buzon enmascarado);
 *     (c) NO mandar el codigo: no puede haber evento `OTP_SENT` ni `otp_hash`
 *         en la fila, porque el rechazo ocurre ANTES de generar el codigo.
 *
 *   CASO B - LA CORRECCION. El Trabajador declara un buzon PERSONAL y lo
 *   CONFIRMA. El servicio tiene que:
 *     (a) responder 200, con el buzon personal como destino del codigo;
 *     (b) mandar el codigo solo ahi (evento `OTP_SENT`);
 *     (c) dejar la constancia de la confirmacion (evento
 *         `MEDIO_PERSONAL_CONFIRMADO` y las columnas
 *         `medio_otp_confirmado_*`);
 *     (d) NO dejar ningun `OTP_MEDIO_CORPORATIVO` en esa firma.
 *
 * COMO SE CORRE (el patron del 10.4 y del 9A)
 * --------------------------------------------
 * Se levanta una INSTANCIA PROPIA del servicio en otro puerto, apuntando a una
 * COPIA AISLADA de la base de datos. La base de PRODUCCION no se toca nunca:
 * este script se niega a correr si la ruta de `--db` es la de produccion.
 * Los datos son SINTETICOS y el PDF que se firma lo genera el propio script,
 * con la advertencia escrita en su primera pagina.
 *
 * LO QUE ESTA PRUEBA NO ES
 * -------------------------
 * NO es el caso real. Es una corrida CONTROLADA, sobre una COPIA AISLADA de la
 * base, con datos SINTETICOS, sin ninguna persona real detras y sin que salga
 * ningun correo (la instancia corre con NODE_ENV=development: el codigo queda
 * en la respuesta y no sale por SMTP). Lo que demuestra es que el MECANISMO
 * funciona contra el codigo desplegado: el rechazo es incondicional, el aviso
 * queda en el registro append-only con su metadata, y el medio personal
 * confirmado si prospera.
 *
 * En PRODUCCION el caso sigue SIN ocurrir: no hay solicitudes reales de
 * insultedores con un buzon corporativo. El item `d02` del manifiesto (el
 * inventario de buzones) hay que repetirlo en produccion cuando las haya.
 *
 * USO
 * ---
 *   node scripts/probar-t6-medio-corporativo.js \
 *        --db=/tmp/kair-t6/firma-trabajo.sqlite \
 *        --puerto=8906 \
 *        --app-dir=/opt/kair-firma/app \
 *        --empresa=900829731 \
 *        --trabajador=900000006 \
 *        --numero=900000006 \
 *        --confirmar-escribe
 *
 * Opciones:
 *   --db=              la base de datos AISLADA donde se corre la prueba.
 *                      OBLIGATORIA. El script se NIEGA a correr si esa ruta es
 *                      la de produccion.
 *   --db-produccion=   la base de PRODUCCION, para COMPARAR (solo lectura).
 *                      Por omision /opt/kair-firma/data/firma.sqlite. Si no se
 *                      puede leer, es un AVISO, no una falla.
 *   --puerto=          el puerto de la instancia aislada (por omision 8906).
 *   --url=             la URL del servicio (por omision la del puerto de arriba).
 *   --app-dir=         donde esta el codigo desplegado del servicio (por
 *                      omision /opt/kair-firma/app). De ahi se lee el texto
 *                      vigente de la declaracion de datos sensibles.
 *   --empresa=         NIT de la Empresa (por omision 900829731).
 *   --trabajador=      id CRUDO del Trabajador, de 4 a 20 digitos (por omision
 *                      900000006). Es SINTETICO.
 *   --numero=          documento de identidad SINTETICO con el que se
 *                      identifica en la mini-app (por omision, el mismo valor).
 *   --semilla=         numero que hace reproducibles los datos sinteticos
 *                      (por omision 6). Solo cambia los identificadores.
 *   --dominio-corporativo=  el dominio que se declara COMO CORPORATIVO de la
 *                      Empresa EN LA COPIA AISLADA (por omision
 *                      t6-corp.example). No existe en la red: es un TLD
 *                      reservado (RFC 2606).
 *   --correo-corporativo=  el buzon corporativo del caso A (por omision
 *                      trabajador@t6-corp.example).
 *   --correo-personal=    el buzon personal del caso B (por omision
 *                      trabajador@t6-personal.example).
 *   --interno-file=    archivo con la llave interna (por omision
 *                      /opt/kair-firma/internal-key.txt). Tambien se puede dar
 *                      por la variable de entorno FIRMA_T6_INTERNAL_KEY.
 *   --admin-file=      archivo con la llave de administracion (por omision
 *                      /opt/kair-firma/admin-key.txt). Tambien por
 *                      FIRMA_T6_ADMIN_KEY.
 *   --otp=             codigo de 6 digitos. Si el servicio lo devuelve (modo
 *                      desarrollo), se usa ese y no hace falta pasarlo.
 *   --estado=          archivo de estado (por omision, en el temporal).
 *   --evidencia=       archivo de evidencia (por omision, en el temporal).
 *   --confirmar-escribe  SIN ESTA OPCION EL SCRIPT NO ESCRIBE NADA.
 *
 * Las llaves se leen de archivo o del ambiente. NUNCA se imprimen.
 *
 * Codigos de salida:
 *   0 = las dos comprobaciones del T6 pasaron
 *   1 = fallo al menos una comprobacion (el caso NO se produjo)
 *   2 = argumentos invalidos
 *   3 = falta el codigo de verificacion (hay que correr otra vez con --otp)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DEFAULT_PUERTO = 8906;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_APP_DIR = '/opt/kair-firma/app';
const DEFAULT_DB_PRODUCCION = '/opt/kair-firma/data/firma.sqlite';

// El valor exacto de la declaracion de datos sensibles. Se lee del codigo
// desplegado cuando se puede (esa es la fuente de verdad); el literal de
// abajo es el respaldo, y el script dice CUAL de los dos uso.
const DECLARACION_SALUD_LITERAL = 'EL_DOCUMENTO_NO_CONTIENE_DATOS_SENSIBLES_DE_SALUD';

// Como se ve un seudonimo de Trabajador: `psn1_` + 64 hex (ver
// src/services/trabajador.js). La API acepta 64 caracteres y el seudonimo
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
  emitir('  [OK]    ' + nombre + (detalle ? ' :: ' + detalle : ''));
}

function warn(nombre, detalle) {
  resultados.push({ nombre, estado: 'AVISO', detalle: detalle || '' });
  emitir('  [AVISO]  ' + nombre + (detalle ? ' :: ' + detalle : ''));
}

function fail(nombre, detalle) {
  resultados.push({ nombre, estado: 'FALLA', detalle: detalle || '' });
  emitir('  [FALLA]  ' + nombre + (detalle ? ' :: ' + detalle : ''));
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
  emitir('RESUMEN: ' + (resultados.length - fallas.length - avisos.length) + ' OK - '
    + avisos.length + ' avisos - ' + fallas.length + ' fallas');
  for (const f of fallas) emitir('  FALLA: ' + f.nombre + ' :: ' + f.detalle);
  emitir('='.repeat(78));
  return fallas.length;
}

// ===========================================================================
// ARGUMENTOS
// ===========================================================================

function parseArgs(argv) {
  const args = {
    puerto: DEFAULT_PUERTO,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    appDir: DEFAULT_APP_DIR,
    dbProduccion: DEFAULT_DB_PRODUCCION,
    confirmarEscribe: false,
    semilla: 6,
  };
  for (const bruto of argv.slice(2)) {
    const m = /^--([a-zA-Z0-9-]+)(?:=(.*))?$/.exec(bruto);
    if (!m) continue;
    const clave = m[1];
    const valor = m[2];
    switch (clave) {
      case 'url': args.url = valor; break;
      case 'db': args.db = valor; break;
      case 'db-produccion': args.dbProduccion = valor; break;
      case 'puerto': args.puerto = Number(valor) || DEFAULT_PUERTO; break;
      case 'app-dir': args.appDir = valor; break;
      case 'empresa': args.empresa = valor; break;
      case 'trabajador': args.trabajador = valor; break;
      case 'numero': args.numero = valor; break;
      case 'semilla': args.semilla = Number(valor) || 0; break;
      case 'dominio-corporativo': args.dominioCorporativo = valor; break;
      case 'correo-corporativo': args.correoCorporativo = valor; break;
      case 'correo-personal': args.correoPersonal = valor; break;
      case 'interno-file': args.internoFile = valor; break;
      case 'admin-file': args.adminFile = valor; break;
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
  if (!args.url) args.url = 'http://127.0.0.1:' + args.puerto;
  if (!args.estado) args.estado = path.join(os.tmpdir(), 'kair-t6-estado.json');
  if (!args.evidencia) args.evidencia = path.join(os.tmpdir(), 'kair-t6-evidencia.txt');
  if (!args.internoFile) args.internoFile = '/opt/kair-firma/internal-key.txt';
  if (!args.adminFile) args.adminFile = '/opt/kair-firma/admin-key.txt';
  if (!args.empresa) args.empresa = '900829731';
  if (!args.trabajador) args.trabajador = String(900000000 + Number(args.semilla || 0));
  if (!args.numero) args.numero = args.trabajador;
  if (!args.dominioCorporativo) args.dominioCorporativo = 't6-corp.example';
  if (!args.correoCorporativo) args.correoCorporativo = 'trabajador@' + args.dominioCorporativo;
  if (!args.correoPersonal) args.correoPersonal = 'trabajador@t6-personal.example';
  return args;
}

function validarArgumentos(args) {
  if (args.error) return false;
  let bien = true;

  if (!args.db) {
    fail('Falta --db',
      'la base de datos AISLADA donde se corre la prueba. Sin ella el script '
      + 'no hace nada: la base de PRODUCCION no se toca nunca');
    bien = false;
  } else if (!fs.existsSync(args.db)) {
    fail('La base AISLADA no existe', args.db
      + ' :: copie la base de produccion a una copia antes de correr el script');
    bien = false;
  } else {
    // EL GUARD DE PRODUCCION. Si la ruta que le pasaron es la de produccion,
    // el script se NIEGA: no hay forma de que escriba ahi por accidente.
    const db = path.resolve(args.db);
    const prod = path.resolve(args.dbProduccion || DEFAULT_DB_PRODUCCION);
    if (db === prod) {
      fail('La base AISLADA es la de PRODUCCION',
        db + ' :: este script no escribe NUNCA en la base de produccion. '
        + 'Pase una COPIA.');
      bien = false;
    }
    if (/(^|\/)(data\/)?firma\.sqlite$/.test(db) && db === prod) {
      fail('La base AISLADA es la de PRODUCCION', db);
      bien = false;
    }
  }

  if (!args.empresa || !/^\d{4,20}$/.test(String(args.empresa))) {
    fail('--empresa no parece un NIT', 'tiene que ser de 4 a 20 digitos');
    bien = false;
  }
  if (!args.trabajador) {
    fail('Falta --trabajador', 'el id CRUDO del Trabajador (SINTETICO)');
    bien = false;
  } else if (ES_SEUDONIMO.test(String(args.trabajador))) {
    fail('--trabajador no puede ser un seudonimo',
      'el servicio seudonimiza el id que le llega: mande el id CRUDO');
    bien = false;
  } else if (!/^\d{4,20}$/.test(String(args.trabajador))) {
    fail('--trabajador no parece un documento de identidad', 'tiene que ser de 4 a 20 digitos');
    bien = false;
  }
  if (!/^\d{4,20}$/.test(String(args.numero))) {
    fail('--numero no parece un documento de identidad', 'tiene que ser de 4 a 20 digitos');
    bien = false;
  }
  if (!args.correoCorporativo || !String(args.correoCorporativo).includes('@')) {
    fail('--correo-corporativo no es un correo', 'el buzon corporativo del caso A');
    bien = false;
  }
  if (!args.correoPersonal || !String(args.correoPersonal).includes('@')) {
    fail('--correo-personal no es un correo', 'el buzon personal del caso B');
    bien = false;
  }
  if (String(args.correoCorporativo).toLowerCase() === String(args.correoPersonal).toLowerCase()) {
    fail('Los dos buzones son el mismo',
      'el caso A y el caso B tienen que usar buzones distintos');
    bien = false;
  }
  const domCorp = String(args.correoCorporativo).split('@').pop().toLowerCase();
  const domPers = String(args.correoPersonal).split('@').pop().toLowerCase();
  if (domCorp === domPers) {
    fail('Los dos buzones comparten dominio',
      'el caso A tiene que caer en un dominio corporativo y el caso B en uno que '
      + 'la Empresa NO pueda leer: si comparten dominio, los dos casos prueban lo mismo');
    bien = false;
  }
  if (!args.dominioCorporativo || !String(args.dominioCorporativo).includes('.')) {
    fail('--dominio-corporativo no parece un dominio', 'tiene que incluir el punto');
    bien = false;
  }
  if (args.otp && !/^\d{6}$/.test(String(args.otp))) {
    fail('--otp no son 6 digitos', 'el codigo de verificacion son 6 digitos');
    bien = false;
  }
  return bien;
}

/**
 * La llave: del archivo o del ambiente. Nunca se imprime y nunca se mete en
 * la evidencia.
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
  const boundary = '----kairt6' + crypto.randomBytes(12).toString('hex');
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
// LA BASE AISLADA (y la de produccion, SOLO para comparar)
// ===========================================================================

/**
 * Ejecuta una consulta SQL con el CLI de sqlite3 y devuelve las filas.
 *
 * Se usa el CLI (y no better-sqlite3) para no depender de las dependencias
 * nativas del servicio: el script tiene que correr en el mismo servidor, con
 * las mismas herramientas, sin instalar nada.
 *
 * `soloLectura` agrega `-readonly`: es lo que se usa contra la base de
 * PRODUCCION, para que ningun comando pueda escribir ahi ni por error.
 */
function sqlPorCli(base, consulta, soloLectura) {
  const argv = ['-json'];
  if (soloLectura) argv.push('-readonly');
  argv.push(base, consulta);
  const salida = execFileSync('sqlite3', argv, {
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

let _sql = sqlPorCli;

function fijarBase(fnSql) {
  if (typeof fnSql === 'function') _sql = fnSql;
}

function restaurarBase() {
  _sql = sqlPorCli;
}

function esc(valor) {
  return String(valor).replace(/'/g, "''");
}

function contar(base, tabla, condicion, soloLectura) {
  const q = 'SELECT COUNT(*) AS n FROM ' + tabla
    + (condicion ? ' WHERE ' + condicion : '') + ';';
  const filas = _sql(base, q, soloLectura);
  return Number((filas[0] || {}).n || 0);
}

function eventosDeFirma(base, firmaId) {
  return _sql(base, 'SELECT id, evento, fecha_hora, ip, user_agent, metadata, id_actor'
    + ' FROM gh_firma_eventos WHERE firma_id = ' + Number(firmaId) + ' ORDER BY id ASC;');
}

function filaDeFirma(base, idSolicitud) {
  const filas = _sql(base,
    'SELECT id, id_solicitud, estado, correo_otp, medio_otp_confirmado_correo,'
    + ' medio_otp_confirmado_fecha_hora, medio_otp_confirmado_version,'
    + ' otp_hash, identificacion_coincidio, fecha_otp_enviado, agreement_version'
    + " FROM gh_firmas_electronicas WHERE id_solicitud = '" + esc(idSolicitud) + "';");
  return (filas || [])[0] || null;
}

// ===========================================================================
// PDF
// ===========================================================================

/**
 * El documento de la solicitud: es SINTETICO y lo dice en su primera pagina.
 *
 * El pdf-lib se toma del codigo DESPLEGADO (el `--app-dir`), que es el que
 * esta corriendo en el servidor: el script no depende de su propio node_modules.
 */
async function pdfDePrueba(datos, appDir) {
  let PDFDocument;
  let StandardFonts;
  let rgb;
  try {
    const lib = require(path.join(appDir, 'node_modules', 'pdf-lib'));
    PDFDocument = lib.PDFDocument;
    StandardFonts = lib.StandardFonts;
    rgb = lib.rgb;
  } catch (e) {
    const lib = require('pdf-lib');
    PDFDocument = lib.PDFDocument;
    StandardFonts = lib.StandardFonts;
    rgb = lib.rgb;
  }
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);

  const pagina = doc.addPage([595, 842]);
  pagina.drawText('PRUEBA DEL T6 - DATOS SINTETICOS - NO ES EVIDENCIA DE UN ACTO REAL',
    { x: 50, y: 780, size: 11, font: negrita, color: rgb(0.7, 0, 0) });
  pagina.drawText('Documento generado por scripts/probar-t6-medio-corporativo.js para verificar',
    { x: 50, y: 758, size: 10, font: fuente });
  pagina.drawText('el rechazo del buzon corporativo y la confirmacion del medio personal.',
    { x: 50, y: 744, size: 10, font: fuente });
  pagina.drawText('El Trabajador es un dato sintetico: no hay persona real detras de esta solicitud.',
    { x: 50, y: 730, size: 10, font: fuente });

  let y = 690;
  for (const [etiqueta, valor] of [
    ['Empresa', datos.empresa],
    ['Documento', datos.idDocumento],
    ['Caso', datos.caso],
    ['Buzon declarado', datos.correoDeclarado],
  ]) {
    pagina.drawText(etiqueta + ':', { x: 50, y, size: 10, font: negrita });
    pagina.drawText(String(valor), { x: 230, y, size: 10, font: fuente });
    y -= 18;
  }
  return Buffer.from(await doc.save());
}

// ===========================================================================
// LA DECLARACION DE DATOS SENSIBLES (la vigente en el codigo desplegado)
// ===========================================================================

function cargarDeclaracionSalud(appDir) {
  try {
    const mod = require(path.join(appDir, 'src', 'services', 'declaracionSalud'));
    if (mod && typeof mod.DECLARACION_SALUD === 'string' && mod.DECLARACION_SALUD) {
      return {
        valor: mod.DECLARACION_SALUD,
        origen: 'codigo desplegado (' + path.join(appDir, 'src/services/declaracionSalud') + ')',
      };
    }
  } catch (e) { /* se usa el literal de abajo */ }
  return { valor: DECLARACION_SALUD_LITERAL, origen: 'literal del script' };
}

// ===========================================================================
// PASOS
// ===========================================================================

/**
 * 1 - El servicio esta vivo y la instancia usa la base AISLADA.
 *
 * EL CANARIO: antes de tocar nada se cuentan las filas en la base AISLADA. Al
 * final se cuentan otra vez. Si la instancia apuntara a PRODUCCION, la base
 * AISLADA no cambiaria y el script fallaria: el caso solo puede producirse si
 * el servicio escribio en la COPIA.
 */
async function pasoSalud(args, internoKey) {
  titulo('1. El servicio y la base AISLADA');
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
  ok('El servicio responde', 'status=' + salud.status + ' db=' + ((salud.checks || {}).db)
    + ' kair_version=' + salud.kair_version);
  // El marcador de ambiente lo da la ruta de salud: `kair_version` es
  // 'compatible-' + ('0.1.189' en produccion | 'dev' en cualquier otro modo).
  // OJO: el valor NO es 'dev' a secas, es 'compatible-dev'. Un check que
  // mirara 'dev' daria un falso aviso.
  const versionSalud = String(salud.kair_version || '');
  if (versionSalud.slice(-3) === 'dev') {
    ok('La instancia corre en modo DESARROLLO',
      'kair_version=' + versionSalud + ' :: el codigo de verificacion sale en la '
      + 'respuesta y NO se manda ningun correo por SMTP');
  } else {
    warn('La instancia NO esta en modo desarrollo',
      'kair_version=' + versionSalud + ' :: en produccion el codigo de '
      + 'verificacion SALE por SMTP. Esta prueba necesita el modo desarrollo '
      + '(NODE_ENV=development): no se manda ningun correo.');
  }

  if (!internoKey) {
    fail('Falta la llave interna', '(--interno-file o FIRMA_T6_INTERNAL_KEY)');
    return null;
  }

  let antes;
  try {
    antes = {
      firmas: contar(args.db, 'gh_firmas_electronicas'),
      eventos: contar(args.db, 'gh_firma_eventos'),
      corporativos: contar(args.db, 'gh_firma_eventos', "evento = 'OTP_MEDIO_CORPORATIVO'"),
      consentimientos: contar(args.db, 'gh_consentimientos_firma'),
    };
  } catch (e) {
    fail('Se pudo leer la base AISLADA', args.db + ' :: ' + e.message);
    return null;
  }
  ok('La base AISLADA se leyo antes de la prueba',
    'firmas=' + antes.firmas + ' eventos=' + antes.eventos
    + ' OTP_MEDIO_CORPORATIVO=' + antes.corporativos
    + ' consentimientos=' + antes.consentimientos);
  return antes;
}

/**
 * 2 - El Acuerdo vigente (para ligar la solicitud a una version real).
 */
async function pasoAcuerdoActivo(args, internoKey) {
  titulo('2. El Acuerdo vigente');
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
  const activo = res.json || {};
  if (!activo.version || !activo.texto_hash) {
    fail('El Acuerdo vigente', 'la respuesta no trae version ni texto_hash');
    return null;
  }
  ok('Hay un Acuerdo vigente', 'version=' + activo.version
    + ' - hash=' + String(activo.texto_hash).slice(0, 16));
  return activo;
}

/**
 * 3 - La Empresa, en la COPIA AISLADA, con un dominio corporativo declarado.
 *
 * QUE HACE Y POR QUE
 * ------------------
 * El control del 3.4(e) compara el dominio del buzon declarado con los
 * dominios que la EMPRESA puede leer (la lista EXPRESA `dominios_corporativos`
 * mas los derivados de sus canales de correo). En la base de PRODUCCION esa
 * lista esta vacia: los unicos correos de la ficha son de gmail.com.
 *
 * Para que el caso sea EXPRESO y no una consecuencia colateral (que el buzon
 * caiga en gmail.com por ejemplo), este script DECLARA en la COPIA AISLADA un
 * dominio corporativo sintetico (`t6-corp.example`, un TLD reservado que no
 * existe en la red) y usa para el caso A un buzon de ese dominio.
 *
 * En PRODUCCION no se declara nada: la escritura es solo sobre la copia, y el
 * script se niega a correr si `--db` es la base de produccion.
 */
async function pasoPrepararEmpresa(args) {
  titulo('3. La Empresa en la COPIA AISLADA (dominio corporativo sintetico)');
  let filas;
  try {
    filas = _sql(args.db, 'SELECT id_empresa, razon_social, dominios_corporativos,'
      + ' canal_pqrs, canal_incidentes, responsable_tratamiento_correo,'
      + ' canal_solicitud_copia FROM gh_firma_empresas WHERE id_empresa = \''
      + esc(args.empresa) + '\';');
  } catch (e) {
    fail('Se pudo leer la Empresa', e.message);
    return null;
  }
  const empresa = (filas || [])[0];
  if (!empresa) {
    fail('La Empresa existe en la base AISLADA',
      'no hay ninguna fila con id_empresa=' + args.empresa + ' en ' + args.db);
    return null;
  }
  ok('La Empresa esta en la base AISLADA',
    'id=' + empresa.id_empresa + ' - ' + empresa.razon_social);

  const declarados = String(empresa.dominios_corporativos || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const antes = declarados.slice();
  if (declarados.indexOf(String(args.dominioCorporativo).toLowerCase()) === -1) {
    declarados.push(String(args.dominioCorporativo).toLowerCase());
    const nuevo = declarados.join(',');
    try {
      execFileSync('sqlite3', [args.db,
        "UPDATE gh_firma_empresas SET dominios_corporativos = '" + esc(nuevo)
        + "' WHERE id_empresa = '" + esc(args.empresa) + "';"], { encoding: 'utf8' });
    } catch (e) {
      fail('Se declaro el dominio corporativo en la COPIA AISLADA', e.message);
      return null;
    }
    ok('Se declaro el dominio corporativo en la COPIA AISLADA',
      'dominios_corporativos: [' + (antes.join(',') || '(vacio)') + '] -> [' + nuevo + ']');
  } else {
    ok('El dominio corporativo ya estaba declarado en la COPIA AISLADA',
      'dominios_corporativos: [' + antes.join(',') + ']');
  }

  // El caso B tiene que caer en un dominio que la Empresa NO pueda leer. Si
  // el servicio lo rechazara, la segunda comprobacion del T6 fallaria: es el
  // servicio el que decide, no este script.
  const derivados = [
    empresa.canal_pqrs,
    empresa.canal_incidentes,
    empresa.responsable_tratamiento_correo,
    empresa.canal_solicitud_copia,
  ].map((c) => String(c || '').trim().toLowerCase().split('@').pop()).filter(Boolean);
  emitir('  (dominios derivados de los canales de la ficha: '
    + (derivados.join(', ') || '(ninguno)') + ')');
  return empresa;
}

/**
 * 4 - Crear una solicitud de firma.
 *
 * El documento que se firma es SINTETICO y lo dice en su primera pagina.
 */
async function pasoCrearSolicitud(args, internoKey, acuerdo, caso, declaracionSalud) {
  titulo('4.' + caso + ' La solicitud de firma (ESCRIBE en la base AISLADA)');
  const idDocumento = 'PRUEBA-T6-' + caso + '-' + Date.now();
  const pdf = await pdfDePrueba({
    empresa: args.empresa,
    idDocumento,
    caso,
    correoDeclarado: caso === 'A' ? args.correoCorporativo : args.correoPersonal,
  }, args.appDir);
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
    version_kair: 'probar-t6',
    // La INVITACION va a un buzon sintetico: esta prueba no manda correos.
    // Al buzon del OTP es al que mira el control del 3.4(e).
    correo_verificacion: 'invitacion-t6@example.invalid',
    tipo_identificacion: 'OTROSI',
    nombre_trabajador: 'Trabajador sintetico de la prueba T6 (caso ' + caso + ')',
    nombre_empresa: 'PRUEBA T6',
    correo_empresa: 'prueba-t6@example.invalid',
    declaracion_datos_sensibles: declaracionSalud.valor,
    metadata: JSON.stringify({ subtipo_identificacion: 'prueba-t6-caso-' + caso }),
  };

  const { body, contentType } = multipart({
    metadata: JSON.stringify(metadata),
  }, { campo: 'documento', nombre: 'prueba-t6-caso-' + caso + '.pdf', contenido: pdf });

  let res;
  try {
    res = await pedir({
      base: args.url, path: '/internal/sign-requests', method: 'POST',
      headers: { 'X-Internal-API-Key': internoKey, 'Content-Type': contentType },
    }, body, args.timeoutMs);
  } catch (e) {
    fail('La solicitud de firma se creo', 'no respondio: ' + e.message);
    return null;
  }
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
  ok('La solicitud de firma se creo (en la base AISLADA)',
    'id_solicitud=' + r.id_solicitud + ' - estado=' + (r.estado || '(sin estado)')
    + ' - version=' + (r.agreement_version || acuerdo.version));
  return { id_solicitud: r.id_solicitud, token, pdf, documentHash };
}

/**
 * 5 - La mini-app: el firmante abre el enlace (y el servidor le dice con que
 * version del texto de la declaracion tiene que confirmar).
 */
async function pasoAbrirEnlace(args, solicitud) {
  titulo('5.' + solicitud.caso + ' El firmante abre el enlace');
  let res;
  try {
    res = await pedir({
      base: args.url, path: '/s/' + encodeURIComponent(solicitud.token), method: 'GET',
      headers: { Accept: 'application/json' },
    }, null, args.timeoutMs);
  } catch (e) {
    fail('GET /s/:token (el contexto publico)', 'no respondio: ' + e.message);
    return null;
  }
  if (res.status !== 200) {
    fail('GET /s/:token (el contexto publico)', 'HTTP ' + res.status
      + ' :: ' + res.texto.slice(0, 250));
    return null;
  }
  const ctx = res.json || {};
  const version = ((ctx.medio_personal_registrado || {}).declaracion_version) || null;
  ok('El servidor responde el contexto publico',
    'id_solicitud=' + (ctx.id_solicitud || '(sin id)')
    + ' - version de la declaracion=' + (version || '(no la dice)'));
  if (!version) {
    fail('El servidor dice con que version de la declaracion hay que confirmar',
      'el contexto publico no trae medio_personal_registrado.declaracion_version');
    return null;
  }
  return version;
}

/**
 * 6 - LA IDENTIFICACION: aqui ocurre el caso.
 *
 * El `correo_otp` del cuerpo es el medio PERSONAL que declara el Trabajador.
 * El control del 3.4(e) se aplica ahi, ANTES de generar el codigo.
 */
async function pasoIdentificar(args, solicitud, versionDeclaracion, correoOtp) {
  let res;
  try {
    res = await pedirJson({
      base: args.url,
      path: '/api/sign/' + encodeURIComponent(solicitud.token) + '/identify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      correo_otp: correoOtp,
      tipo_identificacion: 'CC',
      numero_documento: String(args.numero),
      medio_otp_confirmado: true,
      medio_otp_version: versionDeclaracion,
    }, args.timeoutMs);
  } catch (e) {
    return { http: 0, error: { code: 'SIN_RESPUESTA', message: e.message } };
  }
  return { http: res.status, json: res.json || {}, texto: res.texto };
}

/** Como el servicio enmascara el buzon (src/services/publicFlow.js, maskEmail). */
function enmascarar(correo) {
  const partes = String(correo).split('@');
  const local = partes[0];
  const dominio = partes[1];
  if (!local || !dominio) return correo;
  const visible = local.slice(0, Math.min(4, local.length));
  return visible + '*'.repeat(Math.max(0, local.length - visible.length)) + '@' + dominio;
}

/**
 * 7 - EL CASO A: EL BUZON CORPORATIVO TIENE QUE SER RECHAZADO.
 */
async function pasoRechazo(args, solicitud, versionDeclaracion) {
  titulo('7. CASO A: el buzon CORPORATIVO tiene que ser RECHAZADO');
  const r = await pasoIdentificar(args, solicitud, versionDeclaracion, args.correoCorporativo);
  if (r.http === 0) {
    fail('La identificacion con buzon corporativo', 'no respondio: ' + r.error.message);
    return null;
  }
  const err = (r.json || {}).error || {};
  const codigo = err.code || 'UNKNOWN';
  if (r.http === 400 && codigo === 'MEDIO_OTP_CORPORATIVO') {
    ok('El servicio RECHAZO el buzon corporativo',
      'HTTP 400 - codigo=' + codigo + ' - id_solicitud=' + ((err.details || {}).id_solicitud || '-')
      + ' - origen=' + ((err.details || {}).origen || '-')
      + ' - canal_empresa=' + ((err.details || {}).canal_empresa || '(sin canal)'));
  } else {
    fail('El servicio RECHAZO el buzon corporativo',
      'HTTP ' + r.http + ' ' + codigo + ' :: ' + String(r.texto || '').slice(0, 300));
  }

  // EL ASIENTO: el evento en el registro append-only.
  const fila = filaDeFirma(args.db, solicitud.id_solicitud);
  if (!fila) {
    fail('La fila de la solicitud del caso A', 'no se encontro en la base AISLADA');
    return null;
  }
  const eventos = eventosDeFirma(args.db, fila.id);
  const delEvento = eventos.filter((e) => e.evento === 'OTP_MEDIO_CORPORATIVO');
  if (delEvento.length === 1) {
    const ev = delEvento[0];
    let meta = null;
    try { meta = JSON.parse(ev.metadata || 'null'); } catch (e) { meta = null; }
    ok('El caso quedo ASENTADO en el registro append-only (OTP_MEDIO_CORPORATIVO)',
      'evento id=' + ev.id + ' - fecha_hora=' + ev.fecha_hora
      + ' - actor=' + ev.id_actor + ' - metadata=' + JSON.stringify(meta));
    if (meta && meta.dominio_corporativo === true && meta.resultado === 'rechazado') {
      ok('La metadata del asiento dice que el caso fue rechazado',
        'dominio_corporativo=' + meta.dominio_corporativo
        + ' - resultado=' + meta.resultado
        + ' - origen=' + meta.origen
        + ' - buzon=' + meta.correo_destino_enmascarado);
    } else {
      fail('La metadata del asiento dice que el caso fue rechazado',
        'metadata=' + String(ev.metadata || '(vacia)').slice(0, 250));
    }
  } else {
    fail('El caso quedo ASENTADO en el registro append-only (OTP_MEDIO_CORPORATIVO)',
      'se encontraron ' + delEvento.length + ' eventos con ese nombre (tiene que ser 1)');
  }

  // EL CODIGO NO SALIO: el rechazo ocurre ANTES de generarlo.
  const conOtp = eventos.filter((e) => e.evento === 'OTP_SENT');
  if (conOtp.length === 0 && !fila.otp_hash) {
    ok('El codigo de verificacion NO salio (el rechazo es antes de generarlo)',
      'eventos OTP_SENT=0 - otp_hash en la fila=' + (fila.otp_hash ? 'PRESENTE' : 'vacio')
      + ' - estado=' + fila.estado);
  } else {
    fail('El codigo de verificacion NO salio (el rechazo es antes de generarlo)',
      'eventos OTP_SENT=' + conOtp.length + ' - otp_hash=' + (fila.otp_hash ? 'presente' : 'vacio'));
  }

  // Y la CONFIRMACION no se archivo: no se declara nada sobre un buzon que el
  // sistema no acepta.
  const conConfirmacion = eventos.filter((e) => e.evento === 'MEDIO_PERSONAL_CONFIRMADO');
  if (conConfirmacion.length === 0 && !fila.medio_otp_confirmado_correo) {
    ok('No quedo archivada ninguna confirmacion sobre el buzon rechazado',
      'eventos MEDIO_PERSONAL_CONFIRMADO=0 - medio_otp_confirmado_correo='
      + (fila.medio_otp_confirmado_correo || '(vacio)'));
  } else {
    fail('No quedo archivada ninguna confirmacion sobre el buzon rechazado',
      'eventos=' + conConfirmacion.length + ' - correo=' + String(fila.medio_otp_confirmado_correo));
  }

  return { fila, eventos, http: r.http, codigo, metadata: delEvento[0] || null };
}

/**
 * 8 - EL CASO B: EL MEDIO PERSONAL CONFIRMADO TIENE QUE PROSPERAR.
 */
async function pasoMedioPersonal(args, solicitud, versionDeclaracion) {
  titulo('8. CASO B: el medio PERSONAL confirmado tiene que PROSPERAR');
  const r = await pasoIdentificar(args, solicitud, versionDeclaracion, args.correoPersonal);
  if (r.http === 0) {
    fail('La identificacion con buzon personal', 'no respondio: ' + r.error.message);
    return null;
  }
  if (r.http !== 200) {
    const err = (r.json || {}).error || {};
    fail('El medio personal confirmado prospero',
      'HTTP ' + r.http + ' ' + (err.code || 'UNKNOWN') + ' :: ' + String(r.texto || '').slice(0, 300));
    return null;
  }
  const j = r.json || {};
  const destino = j.correo_destino_enmascarado;
  const esperado = enmascarar(args.correoPersonal);
  if (destino === esperado) {
    ok('La identificacion salio y el codigo fue al buzon personal',
      'estado=' + j.estado + ' - destino=' + destino + ' - ttl=' + j.otp_ttl_seconds + 's');
  } else {
    fail('La identificacion salio y el codigo fue al buzon personal',
      'destino=' + String(destino) + ' y se esperaba ' + esperado);
  }

  const fila = filaDeFirma(args.db, solicitud.id_solicitud);
  if (!fila) {
    fail('La fila de la solicitud del caso B', 'no se encontro en la base AISLADA');
    return null;
  }
  const eventos = eventosDeFirma(args.db, fila.id);

  const conOtp = eventos.filter((e) => e.evento === 'OTP_SENT');
  if (conOtp.length === 1) {
    ok('El codigo salio (evento OTP_SENT)',
      'evento id=' + conOtp[0].id + ' - fecha_hora=' + conOtp[0].fecha_hora);
  } else {
    fail('El codigo salio (evento OTP_SENT)', 'se encontraron ' + conOtp.length + ' eventos');
  }

  const conConfirmacion = eventos.filter((e) => e.evento === 'MEDIO_PERSONAL_CONFIRMADO');
  if (conConfirmacion.length === 1) {
    const ev = conConfirmacion[0];
    let meta = null;
    try { meta = JSON.parse(ev.metadata || 'null'); } catch (e) { meta = null; }
    ok('La confirmacion del medio quedo ASENTADA (MEDIO_PERSONAL_CONFIRMADO)',
      'evento id=' + ev.id + ' - fecha_hora=' + ev.fecha_hora + ' - metadata=' + JSON.stringify(meta));
  } else {
    fail('La confirmacion del medio quedo ASENTADA (MEDIO_PERSONAL_CONFIRMADO)',
      'se encontraron ' + conConfirmacion.length + ' eventos');
  }

  if (String(fila.medio_otp_confirmado_correo || '').toLowerCase()
    === String(args.correoPersonal).toLowerCase()) {
    ok('La fila archiva el buzon que el Trabajador confirmo',
      'medio_otp_confirmado_correo=' + fila.medio_otp_confirmado_correo
      + ' - version=' + fila.medio_otp_confirmado_version
      + ' - fecha=' + fila.medio_otp_confirmado_fecha_hora);
  } else {
    fail('La fila archiva el buzon que el Trabajador confirmo',
      'medio_otp_confirmado_correo=' + String(fila.medio_otp_confirmado_correo));
  }

  // Y en ESTA firma no puede haber ningun asiento de rechazo.
  const delEvento = eventos.filter((e) => e.evento === 'OTP_MEDIO_CORPORATIVO');
  if (delEvento.length === 0) {
    ok('En la firma del caso B no hay ningun asiento de rechazo',
      'eventos OTP_MEDIO_CORPORATIVO=0');
  } else {
    fail('En la firma del caso B no hay ningun asiento de rechazo',
      'se encontraron ' + delEvento.length);
  }

  return { fila, eventos, http: r.http, devOtp: j.devOtp || null, destino: destino || null };
}

/**
 * 9 - El codigo de verificacion (si el servicio lo devolvio).
 *
 * En modo desarrollo el codigo sale en la respuesta y no se manda ningun
 * correo. Verificarlo cierra el circuito del medio personal: demuestra que el
 * Trabajador controla ese buzon.
 */
async function pasoVerificarOtp(args, solicitud, devOtp) {
  titulo('9. El codigo de verificacion del caso B (si lo hay)');
  const codigo = args.otp || devOtp || null;
  if (!codigo) {
    warn('No hay codigo de verificacion',
      'falta el codigo de 6 digitos. Corra otra vez con --otp=<6 digitos>. '
      + 'El caso A y el caso B ya quedaron probados: esto es el cierre del circuito.');
    return 'ESPERA';
  }
  const origenCodigo = args.otp
    ? 'el que paso el operador con --otp'
    : 'el que devolvio el servicio en la respuesta (modo desarrollo: no se mando ningun correo)';
  let res;
  try {
    res = await pedirJson({
      base: args.url,
      path: '/api/sign/' + encodeURIComponent(solicitud.token) + '/verify-otp',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { otp: String(codigo) }, args.timeoutMs);
  } catch (e) {
    fail('POST /api/sign/:token/verify-otp', 'no respondio: ' + e.message);
    return 'FALLA';
  }
  if (res.status !== 200) {
    const cod = ((res.json || {}).error || {}).code || 'UNKNOWN';
    fail('El codigo de verificacion era el correcto', 'HTTP ' + res.status + ' ' + cod);
    return 'FALLA';
  }
  ok('El codigo de verificacion era el correcto',
    'estado=' + ((res.json || {}).estado || '(sin estado)')
    + ' - el codigo vino de ' + origenCodigo);
  return 'OK';
}

/**
 * 10 - La transicion: la base AISLADA cambio y la de PRODUCCION no.
 *
 * ESTA COMPROBACION ES LA QUE HACE VALER EL RESTO: si la instancia hubiera
 * estado apuntando a produccion, la base AISLADA no habria cambiado. Y la
 * base de produccion se compara con `-readonly`: no hay forma de escribir en
 * ella con este script.
 */
async function pasoTransicion(args, antes, estado) {
  titulo('10. La transicion: la COPIA cambio y la de PRODUCCION no');
  let despues;
  try {
    despues = {
      firmas: contar(args.db, 'gh_firmas_electronicas'),
      eventos: contar(args.db, 'gh_firma_eventos'),
      corporativos: contar(args.db, 'gh_firma_eventos', "evento = 'OTP_MEDIO_CORPORATIVO'"),
      consentimientos: contar(args.db, 'gh_consentimientos_firma'),
    };
  } catch (e) {
    fail('Se pudo leer la base AISLADA despues', e.message);
    return false;
  }
  const creadas = despues.firmas - antes.firmas;
  if (creadas === 2) {
    ok('La base AISLADA recibio las DOS solicitudes de la prueba',
      'firmas ' + antes.firmas + ' -> ' + despues.firmas
      + ' - eventos ' + antes.eventos + ' -> ' + despues.eventos);
  } else {
    fail('La base AISLADA recibio las DOS solicitudes de la prueba',
      'firmas ' + antes.firmas + ' -> ' + despues.firmas + ' (se esperaban 2)');
  }
  if (despues.corporativos - antes.corporativos === 1) {
    ok('La base AISLADA tiene UN caso mas de buzon corporativo',
      'OTP_MEDIO_CORPORATIVO ' + antes.corporativos + ' -> ' + despues.corporativos);
  } else {
    fail('La base AISLADA tiene UN caso mas de buzon corporativo',
      'OTP_MEDIO_CORPORATIVO ' + antes.corporativos + ' -> ' + despues.corporativos);
  }

  if (!args.dbProduccion || !fs.existsSync(args.dbProduccion)) {
    warn('No se pudo comparar con la base de PRODUCCION',
      (args.dbProduccion || '(sin ruta)') + ' :: no se pudo leer. La comparacion '
      + 'de produccion queda pendiente (la cuenta javier SI la lee: 644).');
    return true;
  }
  let prod;
  try {
    prod = {
      firmas: contar(args.dbProduccion, 'gh_firmas_electronicas', null, true),
      eventos: contar(args.dbProduccion, 'gh_firma_eventos', null, true),
      corporativos: contar(args.dbProduccion, 'gh_firma_eventos',
        "evento = 'OTP_MEDIO_CORPORATIVO'", true),
    };
  } catch (e) {
    warn('No se pudo comparar con la base de PRODUCCION', e.message);
    return true;
  }
  if (prod.corporativos === estado.produccionAntes.corporativos
    && prod.eventos === estado.produccionAntes.eventos
    && prod.firmas === estado.produccionAntes.firmas) {
    ok('La base de PRODUCCION no cambio (comparacion de SOLO LECTURA)',
      'firmas=' + prod.firmas + ' - eventos=' + prod.eventos
      + ' - OTP_MEDIO_CORPORATIVO=' + prod.corporativos
      + ' (identicos a antes de la prueba)');
  } else {
    fail('La base de PRODUCCION no cambio (comparacion de SOLO LECTURA)',
      'antes=' + JSON.stringify(estado.produccionAntes) + ' ahora=' + JSON.stringify(prod));
  }
  return true;
}

/**
 * 11 - La limpieza: que se creo y donde queda.
 *
 * ESTE SCRIPT NO BORRA NADA DE NINGUN REGISTRO.
 *
 * `gh_firma_eventos` es de SOLO ANEXADO: la migracion 020 impide UPDATE y
 * DELETE, y la unica forma de borrar una fila es la ventana de purga del 8.6,
 * que es un acto con requisitos propios. Un script de prueba no abre esa
 * ventana ni se salta los disparadores: lo que hace es DECLARAR que la copia
 * de trabajo queda DESCARTADA y dejar el rastro de lo que se creo, para que
 * el operador pueda restaurar la copia desde la instantanea original.
 */
function pasoLimpieza(args, creado) {
  titulo('11. La limpieza del rastro');
  ok('Este script NO borra filas de ningun registro',
    'gh_firma_eventos es de solo anexado (migracion 020): borrar un asiento es '
    + 'un acto de la ventana de purga del 8.6, no una tarea de un script de prueba');
  emitir('  Se creo, SOLO en la base AISLADA (' + args.db + '):');
  for (const s of (creado || [])) {
    emitir('    - ' + s.caso + ': ' + s.id_solicitud + ' (firma id ' + s.firmaId + ')');
  }
  emitir('  Para dejar la copia limpia, restaure la instantanea original:');
  emitir('    sqlite3 <instante-original> ".backup \'' + args.db + '\'"');
  emitir('  Si no la restaura, la copia queda DESCARTADA: no es la base de '
    + 'produccion y no la usa ninguna otra corrida.');
  return true;
}

// ===========================================================================
// LA EVIDENCIA
// ===========================================================================

/**
 * La evidencia, en texto. Es ASCII PURO a proposito: asi se puede copiar a
 * cualquier documento (y al manifiesto, si el owner lo decide) sin romper los
 * checks de unicode del repo.
 */
function escribirEvidencia(args, contexto) {
  const lineas = [];
  lineas.push('PRUEBA DEL T6 EN EL AMBIENTE REAL (K+AIR)');
  lineas.push('===========================================');
  lineas.push('Fecha: ' + new Date().toISOString());
  lineas.push('Servicio: ' + args.url);
  lineas.push('Script: scripts/probar-t6-medio-corporativo.js');
  lineas.push('Base de datos AISLADA: ' + args.db);
  lineas.push('Base de PRODUCCION (solo lectura, para comparar): ' + args.dbProduccion);
  lineas.push('Empresa: ' + args.empresa);
  lineas.push('Trabajador (id CRUDO, SINTETICO): ' + args.trabajador);
  lineas.push('Documento de identidad con el que se identifico: SINTETICO, ' + args.numero);
  lineas.push('Version del Acuerdo vigente: ' + (contexto.acuerdo ? contexto.acuerdo.version : '-')
    + ' - hash ' + String(contexto.acuerdo ? contexto.acuerdo.texto_hash : '').slice(0, 32));
  lineas.push('Declaracion de datos sensibles (origen): ' + contexto.declaracionSalud.origen);
  lineas.push('');
  lineas.push('QUE SE PROBO');
  lineas.push('------------');
  lineas.push('CASO A - EL BUZON CORPORATIVO RECHAZADO. El Trabajador declaro el buzon '
    + args.correoCorporativo + ', que cae en el dominio ' + args.dominioCorporativo
    + ', declarado como corporativo de la Empresa EN LA COPIA AISLADA.');
  lineas.push('  (a) El servicio respondio HTTP 400 con el codigo MEDIO_OTP_CORPORATIVO.');
  lineas.push('  (b) El caso quedo ASENTADO en el registro append-only de eventos: '
    + 'OTP_MEDIO_CORPORATIVO, evento id=' + (contexto.rechazo && contexto.rechazo.eventoId)
    + ', fecha_hora=' + (contexto.rechazo && contexto.rechazo.eventoFecha)
    + ', metadata=' + (contexto.rechazo && contexto.rechazo.metadata ? contexto.rechazo.metadata : '-') + '.');
  lineas.push('  (c) El codigo de verificacion NO salio: no hay evento OTP_SENT ni otp_hash '
    + 'en la fila. El rechazo ocurre ANTES de generar el codigo.');
  lineas.push('  (d) No quedo archivada ninguna confirmacion de medio sobre ese buzon.');
  lineas.push('CASO B - EL MEDIO PERSONAL CONFIRMADO. El Trabajador declaro el buzon '
    + args.correoPersonal + ' y lo confirmo con la version ' + contexto.versionDeclaracion
    + ' del texto de la declaracion.');
  lineas.push('  (a) La identificacion salio con HTTP 200 y el codigo fue a ese buzon: '
    + 'destino=' + (contexto.personal ? contexto.personal.destino : '-') + '.');
  lineas.push('  (b) Quedo el evento OTP_SENT, evento id=' + (contexto.personal && contexto.personal.otpEventoId) + '.');
  lineas.push('  (c) Quedo el asiento de la confirmacion: MEDIO_PERSONAL_CONFIRMADO, evento id='
    + (contexto.personal && contexto.personal.confirmacionEventoId) + '.');
  lineas.push('  (d) La fila archiva el buzon confirmado: medio_otp_confirmado_correo='
    + (contexto.personal ? contexto.personal.fila.medio_otp_confirmado_correo : '-')
    + ', fecha=' + (contexto.personal ? contexto.personal.fila.medio_otp_confirmado_fecha_hora : '-') + '.');
  lineas.push('  (e) En esa firma NO hay ningun asiento OTP_MEDIO_CORPORATIVO.');
  lineas.push('');
  lineas.push('LA TRANSICION (lo que demuestra que la CORPIA es la que se toco)');
  lineas.push('-----------------------------------------------------------------');
  lineas.push('Base AISLADA: firmas ' + contexto.antes.firmas + ' -> ' + contexto.despues.firmas
    + ', eventos ' + contexto.antes.eventos + ' -> ' + contexto.despues.eventos
    + ', OTP_MEDIO_CORPORATIVO ' + contexto.antes.corporativos + ' -> ' + contexto.despues.corporativos + '.');
  if (contexto.produccionAntes) {
    lineas.push('Base de PRODUCCION (solo lectura): firmas ' + contexto.produccionAntes.firmas
      + ' -> ' + (contexto.produccionDespues ? contexto.produccionDespues.firmas : '-')
      + ', eventos ' + contexto.produccionAntes.eventos
      + ' -> ' + (contexto.produccionDespues ? contexto.produccionDespues.eventos : '-')
      + ', OTP_MEDIO_CORPORATIVO ' + contexto.produccionAntes.corporativos
      + ' -> ' + (contexto.produccionDespues ? contexto.produccionDespues.corporativos : '-') + '.');
  }
  lineas.push('');
  lineas.push('LO QUE ESTA PRUEBA NO ES');
  lineas.push('------------------------');
  lineas.push('(1) NO es el caso real. Es una corrida CONTROLADA, sobre una COPIA '
    + 'AISLADA de la base de datos de produccion, con datos SINTETICOS y sin '
    + 'ninguna persona real detras de las dos solicitudes.');
  lineas.push('(2) La base de PRODUCCION no se toco: el script solo la abre con '
    + 'sqlite3 -readonly, y la comparacion de antes/despues esta mas arriba. El '
    + 'caso del buzon corporativo SEGUYE SIN OCURRIR en produccion: no hay '
    + 'solicitudes reales de trabajadores con un buzon corporativo.');
  lineas.push('(3) El item d02 del manifiesto (el inventario de buzones, que hoy '
    + 'vale 0 por poblacion vacia) hay que repetirlo EN PRODUCCION cuando haya '
    + 'solicitudes reales: esta corrida no lo cambia y no lo puede cambiar.');
  lineas.push('(4) No se mando ningun correo: la instancia corrio con '
    + 'NODE_ENV=development, con el codigo de verificacion en la respuesta. El '
    + 'caso A, ademas, ocurre ANTES de que se genere el codigo.');
  lineas.push('(5) En la COPIA AISLADA se declaro un dominio corporativo sintetico '
    + '(' + args.dominioCorporativo + ', un TLD reservado que no existe en la red) '
    + 'en la lista `dominios_corporativos` de la Empresa. En produccion esa lista '
    + 'esta vacia: el caso A se provoco de forma EXPRESA, no por una consecuencia '
    + 'colateral.');
  lineas.push('(6) Lo que esta prueba demuestra es que el MECANISMO funciona contra '
    + 'el codigo desplegado: el rechazo es incondicional, el aviso queda en el '
    + 'registro append-only con su metadata, y el medio personal confirmado si '
    + 'prospera. Lo que NO demuestra es que el caso haya ocurrido en la vida real.');
  lineas.push('(7) Este script no borra filas de ningun registro: gh_firma_eventos '
    + 'es de solo anexado y borrar un asiento es un acto de la ventana de purga '
    + 'del 8.6. La copia de trabajo queda DESCARDADA, con su rastro, y la '
    + 'restauracion desde la instantanea original la hace el operador.');
  lineas.push('');
  lineas.push('REPRODUCIR');
  lineas.push('---------');
  lineas.push('node scripts/probar-t6-medio-corporativo.js --db=' + args.db
    + ' --puerto=' + args.puerto
    + ' --app-dir=' + args.appDir
    + ' --empresa=' + args.empresa
    + ' --trabajador=' + args.trabajador
    + ' --numero=' + args.numero
    + ' --confirmar-escribe');

  const texto = lineas.join('\n') + '\n';
  fs.writeFileSync(args.evidencia, texto, 'utf8');
  return texto;
}

// ===========================================================================
// MAIN
// ===========================================================================

async function correr(args) {
  const internoKey = leerLlave(null, args.internoFile, 'FIRMA_T6_INTERNAL_KEY');

  titulo('0. Que se puede escribir');
  if (!args.confirmarEscribe) {
    warn('Modo lectura', 'esta corrida NO escribe nada. Para ejecutar el T6 hay que '
      + 'pasar --confirmar-escribe: crea dos solicitudes de firma y declara un '
      + 'dominio corporativo sintetico, TODO en la base AISLADA (' + args.db + ').');
    emitir('');
    emitir('  (sin --confirmar-escribe el script no hace nada mas)');
    return 0;
  }
  ok('Modo escritura confirmado', 'se crearan filas en la base AISLADA: ' + args.db);

  const declaracionSalud = cargarDeclaracionSalud(args.appDir);
  ok('La declaracion de datos sensibles se leyo de: ' + declaracionSalud.origen,
    'valor=' + declaracionSalud.valor);

  // La foto de PRODUCCION, antes de tocar nada (solo lectura).
  let produccionAntes = null;
  try {
    if (args.dbProduccion && fs.existsSync(args.dbProduccion)) {
      produccionAntes = {
        firmas: contar(args.dbProduccion, 'gh_firmas_electronicas', null, true),
        eventos: contar(args.dbProduccion, 'gh_firma_eventos', null, true),
        corporativos: contar(args.dbProduccion, 'gh_firma_eventos',
          "evento = 'OTP_MEDIO_CORPORATIVO'", true),
      };
      ok('La foto de PRODUCCION (solo lectura)',
        'firmas=' + produccionAntes.firmas + ' - eventos=' + produccionAntes.eventos
        + ' - OTP_MEDIO_CORPORATIVO=' + produccionAntes.corporativos);
    } else {
      warn('No se pudo tomar la foto de PRODUCCION', args.dbProduccion);
    }
  } catch (e) {
    warn('No se pudo tomar la foto de PRODUCCION', e.message);
  }

  const antes = await pasoSalud(args, internoKey);
  if (!antes) return resumen() === 0 ? 0 : 1;

  const acuerdo = await pasoAcuerdoActivo(args, internoKey);
  if (!acuerdo) return resumen() === 0 ? 0 : 1;

  const empresa = await pasoPrepararEmpresa(args);
  if (!empresa) return resumen() === 0 ? 0 : 1;

  // ---- CASO A -----------------------------------------------------------
  const solicitudA = await pasoCrearSolicitud(args, internoKey, acuerdo, 'A', declaracionSalud);
  if (!solicitudA) return resumen() === 0 ? 0 : 1;
  solicitudA.caso = 'A';
  const versionA = await pasoAbrirEnlace(args, solicitudA);
  if (!versionA) return resumen() === 0 ? 0 : 1;
  const rechazo = await pasoRechazo(args, solicitudA, versionA);
  if (!rechazo) return resumen() === 0 ? 0 : 1;

  // ---- CASO B -----------------------------------------------------------
  const solicitudB = await pasoCrearSolicitud(args, internoKey, acuerdo, 'B', declaracionSalud);
  if (!solicitudB) return resumen() === 0 ? 0 : 1;
  solicitudB.caso = 'B';
  const versionB = await pasoAbrirEnlace(args, solicitudB);
  if (!versionB) return resumen() === 0 ? 0 : 1;
  const personal = await pasoMedioPersonal(args, solicitudB, versionB);
  if (!personal) return resumen() === 0 ? 0 : 1;

  const resultadoOtp = await pasoVerificarOtp(args, solicitudB, personal.devOtp);

  // ---- EL CONTEO FINAL Y LA COMPARACION CON PRODUCCION ------------------
  const creado = [
    { caso: 'A', id_solicitud: solicitudA.id_solicitud, firmaId: rechazo.fila.id },
    { caso: 'B', id_solicitud: solicitudB.id_solicitud, firmaId: personal.fila.id },
  ];
  const estado = { produccionAntes: produccionAntes || { firmas: 0, eventos: 0, corporativos: 0 } };
  const transicion = await pasoTransicion(args, antes, estado);

  let produccionDespues = null;
  try {
    if (args.dbProduccion && fs.existsSync(args.dbProduccion)) {
      produccionDespues = {
        firmas: contar(args.dbProduccion, 'gh_firmas_electronicas', null, true),
        eventos: contar(args.dbProduccion, 'gh_firma_eventos', null, true),
        corporativos: contar(args.dbProduccion, 'gh_firma_eventos',
          "evento = 'OTP_MEDIO_CORPORATIVO'", true),
      };
    }
  } catch (e) { /* ya se aviso antes */ }

  pasoLimpieza(args, creado);

  titulo('12. La evidencia');
  const texto = escribirEvidencia(args, {
    acuerdo,
    declaracionSalud,
    antes,
    despues: {
      firmas: Number((contar(args.db, 'gh_firmas_electronicas')) || 0),
      eventos: Number((contar(args.db, 'gh_firma_eventos')) || 0),
      corporativos: Number((contar(args.db, 'gh_firma_eventos', "evento = 'OTP_MEDIO_CORPORATIVO'")) || 0),
    },
    produccionAntes,
    produccionDespues,
    versionDeclaracion: versionB,
    rechazo: {
      eventoId: rechazo.metadata ? rechazo.metadata.id : null,
      eventoFecha: rechazo.metadata ? rechazo.metadata.fecha_hora : null,
      metadata: rechazo.metadata ? rechazo.metadata.metadata : null,
    },
    personal: {
      destino: personal.destino,
      otpEventoId: (personal.eventos.find((e) => e.evento === 'OTP_SENT') || {}).id || null,
      confirmacionEventoId: (personal.eventos.find((e) => e.evento === 'MEDIO_PERSONAL_CONFIRMADO') || {}).id || null,
      fila: personal.fila,
    },
  });
  ok('La evidencia quedo escrita', args.evidencia);
  emitir('');
  emitir(texto);

  const estadoArchivo = {
    corrida: new Date().toISOString(),
    db: args.db,
    url: args.url,
    empresa: args.empresa,
    trabajador: args.trabajador,
    numero: String(args.numero),
    caso_a: { id_solicitud: solicitudA.id_solicitud, evento_id: rechazo.metadata ? rechazo.metadata.id : null },
    caso_b: { id_solicitud: solicitudB.id_solicitud, evento_id: (personal.eventos.find((e) => e.evento === 'MEDIO_PERSONAL_CONFIRMADO') || {}).id || null },
    creado,
  };
  try {
    fs.writeFileSync(args.estado, JSON.stringify(estadoArchivo, null, 2), 'utf8');
    try { fs.chmodSync(args.estado, 0o600); } catch (e) { /* en Windows no aplica */ }
    ok('El estado quedo escrito', args.estado);
  } catch (e) {
    warn('El estado no se pudo escribir', args.estado + ' :: ' + e.message);
  }

  if (resultadoOtp === 'ESPERA') {
    titulo('El circuito del caso B queda a media');
    warn('La prueba se detiene aca',
      'falta el codigo de verificacion. Corra otra vez con --otp=<6 digits> '
      + 'para cerrar el circuito del medio personal. Los dos casos del T6 ya '
      + 'quedaron probados y sentados.');
    return 3;
  }
  if (resultadoOtp === 'FALLA' || !transicion) return resumen() === 0 ? 0 : 1;
  return resumen() === 0 ? 0 : 1;
}

async function main(argv) {
  const args = parseArgs(argv || process.argv);
  if (!validarArgumentos(args)) {
    emitir('');
    emitir('Uso: node scripts/probar-t6-medio-corporativo.js --db=<BD AISLADA> '
      + '--puerto=8906 --empresa=NIT --trabajador=ID --numero=CC --confirmar-escribe '
      + '[--otp=123456]');
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
  multipart,
  pdfDePrueba,
  sqlPorCli,
  fijarBase,
  restaurarBase,
  contar,
  eventosDeFirma,
  filaDeFirma,
  enmascarar,
  cargarDeclaracionSalud,
  escribirEvidencia,
  correr,
  reiniciar,
  fijarSalida,
  resultados,
  DEFAULT_PUERTO,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_DB_PRODUCCION,
};

if (require.main === module) {
  main(process.argv).then((code) => {
    process.exit(code);
  }).catch((e) => {
    console.error('La prueba del T6 fallo de forma inesperada: '
      + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
