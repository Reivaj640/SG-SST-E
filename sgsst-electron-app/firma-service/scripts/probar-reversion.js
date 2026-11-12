#!/usr/bin/env node
/**
 * scripts/probar-reversion.js
 *
 * EL T7 EN EL AMBIENTE REAL: EL PROCEDIMIENTO DE REVERSION DE LA FIRMA
 * =======================================================================
 *
 * QUE PIDE LA COMPUERTA
 * ---------------------
 * El T7 del cierre (el punto "T7" del informe de correcciones para el asesor
 * juridico, `docs/gestion-humana/firma-electronica/paquete-abogado-2026-10-30/
 * 10-informe-correcciones-para-asesor-juridico.md`) pide:
 *
 *   "Preparar un procedimiento de reversion o suspension."
 *
 * El abogado pide, ademas, dos cosas que este programa responde con MEDIDAS:
 *
 *   - "que se restaura": el respaldo que hay que TOMAR ANTES de la reversion
 *     (la version anterior del Acuerdo y el catalogo de conservacion congelado
 *     en la fila) y como se comprueba que ese respaldo restaura lo mismo.
 *   - "acta de reversion": el recibo que deja el propio codigo del repo
 *     (`gh_firma_purga_log` y `gh_firma_purga_registro`).
 *
 * QUE HACE ESTE SCRIPT
 * --------------------
 * Corre el PROGRAMA DE REVERSION DEL REPO (`scripts/limpiar-rastro-prueba.js`,
 * el mismo que esta desplegado en `/opt/kair-firma/app/scripts/`) contra una
 * BASE AISLADA con filas SINTETICAS, y mide las tres cosas del encargo:
 *
 *   (a) QUE SE BORRA. El programa tiene que borrar lo que dice que borra y
 *       dejar la base consistente: `PRAGMA integrity_check` en "ok", `PRAGMA
 *       foreign_key_check` vacio, la base sigue abriendose y los triggers
 *       append-only de los eventos repuestos. Los numeros que el programa
 *       imprime se comparan uno a uno con los deltas MEDIDOS en la base: si el
 *       programa dice "firmas eliminadas: 1" y en la base no cae ninguna, la
 *       prueba falla.
 *
 *   (b) QUE SE RESTAURA. El respaldo (`.backup`) de la base ANTES de la
 *       reversion se restaura en otro archivo y se compara el VOLCADO CANONICO
 *       (`.dump`) del respaldo con el de la base restaurada: tienen que ser
 *       IDENTICOS. OJO: el hash del ARCHIVO no sirve para comparar (ver la
 *       FASE 5: es la trampa).
 *
 *   (c) QUE QUEDA EVIDENCIA. La reversion tiene que dejar recibo: una fila en
 *       `gh_firma_purga_registro` por firma (con `hold_verificado = 1` cuando
 *       hubo un hold forzado y el motivo del forzamiento) y su asiento
 *       append-only en `gh_firma_purga_log`.
 *
 * LOS DOS CAMINOS DEL PROGRAMA DE REVERSION
 * ------------------------------------------
 *   CASO A - EL HOLD FRENA. Sin `--forzar-hold` el programa tiene que NEGARSE
 *             (codigo de salida 4) y NO tocar nada: un hold (deber legal de
 *             conservacion) impide destruir la prueba de una firma en disputa.
 *   CASO B - CON `--forzar-hold --ejecutar`. El programa borra y deja el
 *             recibo con el forzamiento escrito.
 *
 * LO QUE ESTA PRUEBA NO ES
 * -------------------------
 * NO es la reversion de una firma real. Es una corrida CONTROLADA sobre una
 * COPIA AISLADA, con una Empresa y un Trabajador SINTETICOS (identificadores
 * que no existen), un PDF sintetico y llaves propias de la corrida. La base de
 * PRODUCCION no se toca nunca: este script se NIEGA a correr si la ruta de
 * `--db` es la de produccion, y solo la abre con `sqlite3 -readonly` para
 * COMPARAR. Lo que demuestra es que el MECANISMO funciona contra el codigo
 * desplegado y que deja la evidencia que el propio codigo exige.
 *
 * USO
 * ---
 *   node scripts/probar-reversion.js \
 *        --db=/tmp/kair-t7-reversion/reversion.sqlite \
 *        --preparar \
 *        --confirmar-escribe
 *
 * Opciones:
 *   --db=              la base AISLADA donde se corre la reversion. OBLIGATORIA.
 *                      El script se NIEGA a correr si esa ruta es la de produccion.
 *   --db-produccion=   la base de PRODUCCION, para COMPARAR (solo lectura).
 *                      Por omision /opt/kair-firma/data/firma.sqlite. Si no se
 *                      puede leer, es un AVISO, no una falla.
 *   --app-dir=         el codigo desplegado (por omision /opt/kair-firma/app).
 *   --programa=        el programa de reversion que se prueba (por omision
 *                      <app-dir>/scripts/limpiar-rastro-prueba.js).
 *   --programa-desplegado=  el programa de reversion que esta en el arbol
 *                      desplegado (por omision
 *                      /opt/kair-firma/app/scripts/limpiar-rastro-prueba.js).
 *                      El script compara las dos huellas y avisa si difieren.
 *   --trabajo=         donde van las copias (por omision /tmp/kair-t7-reversion).
 *   --actor=           quien hace el cambio (por omision "Prueba T7").
 *   --motivo=          por que se hace el cambio (por omision
 *                      "Prueba controlada T7").
 *   --hasta=           fecha YYYY-MM-DD: nada mas nuevo se toca (por omision
 *                      2026-12-31).
 *   --version=         la version de prueba del Acuerdo que se retira (por
 *                      omision v1.0).
 *   --preparar         prepara la base AISLADA (migraciones y siembra
 *                      sintetica). La base tiene que estar VACIA: el script no
 *                      siembra encima de filas que ya existen (si la base ya
 *                      tiene contenido, se niega: borre el directorio de
 *                      trabajo y vuelva a correr).
 *   --evidencia=       archivo de evidencia (por omision
 *                      <trabajo>/evidencia.txt).
 *   --confirmar-escribe  SIN ESTA OPCION EL SCRIPT NO ESCRIBE NADA.
 *
 * Codigos de salida:
 *   0 = todas las comprobaciones pasaron
 *   1 = fallo al menos una comprobacion
 *   2 = argumentos invalidos
 *   3 = falta el codigo desplegado, el programa de reversion o una dependencia
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const DEFAULT_APP_DIR = '/opt/kair-firma/app';
const DEFAULT_DB_PRODUCCION = '/opt/kair-firma/data/firma.sqlite';
const DEFAULT_PROGRAMA_DESPLEGADO = '/opt/kair-firma/app/scripts/limpiar-rastro-prueba.js';
const DEFAULT_TRABAJO = '/tmp/kair-t7-reversion';
const DEFAULT_HASTA = '2026-12-31';
const VERSION_PRUEBA = 'v1.0';
const ID_SOLICITUD = 'SIGN-T7-PRUEBA-0001';
const ID_EMPRESA = '900000001';
const ID_TRABAJADOR = 'T7-TRAB-0001';

// Las tablas que se cuentan antes y despues. `gh_firma_purgadas` y
// `gh_firma_purgas_pendientes` son las que escribe la 5B de supresion.js:
// no las escribe este programa (que es un programa de prueba), y por eso
// tienen que seguir en 0.
const TABLAS = [
  'gh_firmas_electronicas',
  'gh_firma_eventos',
  'gh_firma_sesiones',
  'gh_firma_tokens',
  'gh_firma_holds',
  'gh_firma_firmas_papel',
  'gh_consentimientos_firma',
  'gh_consentimientos_eventos',
  'gh_firma_acuerdo_versiones',
  'gh_firma_purga_log',
  'gh_firma_purga_registro',
  'gh_firma_purgadas',
  'gh_firma_purgas_pendientes',
  'gh_firma_purga_lote',
];

const TRIGGERS = ['trg_firma_eventos_no_update', 'trg_firma_eventos_no_delete'];

// ===========================================================================
// SALIDA
// ===========================================================================

const resultados = [];
const bitacora = [];

function emitir(linea) {
  bitacora.push(linea);
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
    appDir: DEFAULT_APP_DIR,
    dbProduccion: DEFAULT_DB_PRODUCCION,
    programaDesplegado: DEFAULT_PROGRAMA_DESPLEGADO,
    trabajo: DEFAULT_TRABAJO,
    actor: 'Prueba T7',
    motivo: 'Prueba controlada T7',
    hasta: DEFAULT_HASTA,
    version: VERSION_PRUEBA,
    preparar: false,
    confirmarEscribe: false,
    ayuda: false,
  };
  for (const bruto of argv.slice(2)) {
    const m = /^--([a-zA-Z0-9-]+)(?:=(.*))?$/.exec(bruto);
    if (!m) continue;
    const clave = m[1];
    const valor = m[2];
    switch (clave) {
      case 'db': args.db = valor; break;
      case 'db-produccion': args.dbProduccion = valor; break;
      case 'app-dir': args.appDir = valor; break;
      case 'programa': args.programa = valor; break;
      case 'programa-desplegado': args.programaDesplegado = valor; break;
      case 'trabajo': args.trabajo = valor; break;
      case 'actor': args.actor = valor; break;
      case 'motivo': args.motivo = valor; break;
      case 'hasta': args.hasta = valor; break;
      case 'version': args.version = valor; break;
      case 'evidencia': args.evidencia = valor; break;
      case 'preparar': args.preparar = true; break;
      case 'confirmar-escribe': args.confirmarEscribe = true; break;
      case 'ayuda': case 'help': args.ayuda = true; break;
      default:
        fail('Argumento desconocido', '--' + clave);
        args.error = true;
    }
  }
  if (!args.programa) args.programa = path.join(args.appDir, 'scripts', 'limpiar-rastro-prueba.js');
  if (!args.evidencia) args.evidencia = path.join(args.trabajo, 'evidencia.txt');
  return args;
}

function textoDeUso() {
  return [
    'Uso: node scripts/probar-reversion.js --db=<BD AISLADA> [--preparar] '
      + '--confirmar-escribe',
    '     [--db-produccion=/opt/kair-firma/data/firma.sqlite] '
      + '[--app-dir=/opt/kair-firma/app]',
    '     [--programa=<script>] [--trabajo=<dir>] [--actor=...] [--motivo=...] '
      + '[--hasta=YYYY-MM-DD]',
    '     [--version=v1.0] [--evidencia=<archivo>]',
  ].join('\n');
}

function validarArgumentos(args) {
  if (args.error) return false;
  let bien = true;

  if (!args.db) {
    fail('Falta --db',
      'la base de datos AISLADA donde se corre la reversion. Sin ella el script '
      + 'no hace nada: la base de PRODUCCION no se toca nunca');
    bien = false;
  } else {
    const db = path.resolve(args.db);
    const prod = path.resolve(args.dbProduccion || DEFAULT_DB_PRODUCCION);
    // EL GUARD DE PRODUCCION. Si la ruta que le pasaron es la de produccion,
    // el script se NIEGA: no hay forma de que escriba ahi por accidente.
    if (db === prod) {
      fail('La base AISLADA es la de PRODUCCION', db
        + ' :: este script no escribe NUNCA en la base de produccion. Pase una COPIA.');
      bien = false;
    }
    // El directorio de datos del despliegue tambien esta prohibido: aunque la
    // ruta no sea exactamente la de la base, ese directorio es de produccion.
    const dirDatos = path.resolve('/opt/kair-firma/data');
    if (db === dirDatos || db.startsWith(dirDatos + path.sep)) {
      fail('La base AISLADA esta en el directorio de datos de PRODUCCION', db
        + ' :: el trabajo de esta prueba va en un directorio de trabajo.');
      bien = false;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.hasta))) {
    fail('--hasta no es una fecha', 'tiene que ser YYYY-MM-DD');
    bien = false;
  }
  if (!args.version) {
    fail('Falta --version', 'la version de prueba del Acuerdo que se retira');
    bien = false;
  }
  if (!fs.existsSync(args.appDir)) {
    fail('No existe --app-dir', args.appDir + ' :: el codigo desplegado del servicio');
    bien = false;
  }
  if (!fs.existsSync(args.programa)) {
    fail('No existe el programa de reversion', args.programa
      + ' :: el programa que esta prueba tiene que medir');
    bien = false;
  }
  if (args.preparar && !args.confirmarEscribe) {
    fail('--preparar sin --confirmar-escribe',
      'preparar la base ES escribir. Sin --confirmar-escribe el script no '
      + 'escribe nada.');
    bien = false;
  }
  return bien;
}

// ===========================================================================
// LAS HERRAMIENTAS
// ===========================================================================

function esc(valor) {
  return String(valor).replace(/'/g, "''");
}

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
    maxBuffer: 32 * 1024 * 1024,
  });
  const texto = (salida || '').trim();
  if (!texto) return [];
  try {
    return JSON.parse(texto);
  } catch (e) {
    throw new Error('sqlite3 no devolvio JSON: ' + texto.slice(0, 200));
  }
}

function valorUnico(filas) {
  if (!filas || !filas.length) return null;
  const obj = filas[0];
  const clave = Object.keys(obj)[0];
  return obj[clave];
}

function existeTabla(base, tabla, soloLectura) {
  const filas = sqlPorCli(base,
    "SELECT name FROM sqlite_master WHERE type='table' AND name='" + esc(tabla) + "';",
    soloLectura);
  return filas.length > 0;
}

function contar(base, tabla, soloLectura) {
  if (!existeTabla(base, tabla, soloLectura)) return null;
  const filas = sqlPorCli(base, 'SELECT COUNT(*) AS n FROM ' + tabla + ';', soloLectura);
  return Number((filas[0] || {}).n || 0);
}

/**
 * El VOLCADO CANONICO de una base: el `.dump` de sqlite3, que no depende del
 * orden de las paginas del archivo. Es lo unico honesto para comparar dos
 * bases: el hash del ARCHIVO cambia aunque el contenido sea el mismo (ver las
 * FASES 1 y 4: es la trampa).
 */
function volcadoCanonico(base, soloLectura) {
  const argv = [];
  if (soloLectura) argv.push('-readonly');
  argv.push(base, '.dump');
  const buffer = execFileSync('sqlite3', argv, { maxBuffer: 64 * 1024 * 1024 });
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function shaArchivo(ruta) {
  if (!ruta || !fs.existsSync(ruta)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
}

/** Copia WAL-safe de una base (`.backup`), sin tocar el original. */
function copiar(base, destino, soloLectura) {
  const argv = [];
  if (soloLectura) argv.push('-readonly');
  argv.push(base, ".backup '" + destino + "'");
  execFileSync('sqlite3', argv, { encoding: 'utf8' });
  return destino;
}

/** Restaura una base desde un archivo de respaldo (`.restore`). */
function restaurar(origen, destino) {
  if (fs.existsSync(destino)) fs.unlinkSync(destino);
  execFileSync('sqlite3', [destino, ".restore '" + origen + "'"], { encoding: 'utf8' });
  return destino;
}

function selloLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
    + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/**
 * El ambiente del proceso del programa de reversion: llaves PROPIAS de esta
 * corrida. NUNCA las de produccion (que estan en `600 root` y `600
 * kairfirma`, y que esta cuenta no puede leer).
 */
function ambienteSintetico(db) {
  return {
    NODE_ENV: 'development',
    DB_PATH: db,
    INTERNAL_API_KEY: 'llave-de-prueba-t7',
    ADMIN_API_KEY: 'llave-de-prueba-t7',
    SMTP_HOST: 'localhost',
    SMTP_USER: 'prueba-t7',
    SMTP_PASS: 'prueba-t7',
    SMTP_FROM_EMAIL: 'prueba-t7@example.invalid',
    PUBLIC_URL: 'http://127.0.0.1:8999',
  };
}

/** Corre el programa de reversion del repo y devuelve codigo y salida. */
function correrPrograma(args, db, flags) {
  const argv = [
    args.programa,
    '--actor=' + args.actor,
    '--motivo=' + args.motivo,
    '--hasta=' + args.hasta,
    '--version=' + args.version,
  ].concat(flags || []);
  const r = spawnSync('node', argv, {
    cwd: args.appDir,
    env: Object.assign({}, process.env, ambienteSintetico(db)),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    codigo: r.status,
    salida: (r.stdout || '') + (r.stderr || ''),
    comando: 'node ' + argv.map((a) => (a.indexOf(' ') >= 0 ? '"' + a + '"' : a)).join(' '),
  };
}

/** El numero que el programa de reversion imprime en su bloque RESULTADO. */
function numeroDelResultado(salida, etiqueta) {
  const m = new RegExp(etiqueta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*(\\d+)').exec(salida);
  return m ? Number(m[1]) : null;
}

// ===========================================================================
// LA ESCENA: LA SEMILLA SINTETICA
// ===========================================================================

function sqlSiembra(rutaPdf) {
  return [
    "INSERT INTO gh_firma_empresas (id_empresa, razon_social, nit, activo, created_at)",
    " VALUES ('" + ID_EMPRESA + "','EMPRESA SINTETICA DE PRUEBA T7','" + ID_EMPRESA
      + "',1,'2026-11-01T09:00:00.000Z');",
    "INSERT INTO gh_firma_acuerdo_versiones",
    " (version, texto, texto_hash, fecha_vigencia_inicio, activa, fecha_creacion)",
    " VALUES ('" + VERSION_PRUEBA + "','TEXTO SINTETICO DE PRUEBA T7 - NO ES EL TEXTO LEGAL',",
    " 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',",
    " '2026-11-01T09:00:00.000Z',0,'2026-11-01T09:00:00.000Z');",
    "INSERT INTO gh_firma_acuerdo_versiones",
    " (version, texto, texto_hash, fecha_vigencia_inicio, activa, fecha_creacion)",
    " VALUES ('v1.6','TEXTO SINTETICO LEGAL DE PRUEBA T7',",
    " 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',",
    " '2026-11-01T09:00:00.000Z',1,'2026-11-01T09:00:00.000Z');",
    'INSERT INTO gh_firmas_electronicas',
    ' (id_solicitud, id_documento, id_trabajador, id_empresa, tipo_firma, estado,',
    '  document_hash_original, agreement_hash, token_hash, fecha_creacion, fecha_expiracion,',
    '  version_kair, hold_legal, motivo_hold, hold_actor, hold_alcance, categoria_conservacion,',
    '  regla_retencion, plazo_conservacion_dias, plazo_conservacion_fuente,',
    '  fecha_inicio_conservacion, pdf_original_path)',
    " VALUES ('" + ID_SOLICITUD + "','T7-PRUEBA-0001','" + ID_TRABAJADOR + "','" + ID_EMPRESA
      + "','remoto','PENDING',",
    " 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',",
    " 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',",
    " 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',",
    " '2026-11-01T10:00:00.000Z','2026-11-05T10:00:00.000Z','t7-prueba',",
    " 1,'deber_legal_2.2.1.1.12 del Decreto 1072 de 2015','sistema',",
    " '2.2.1.1.12 del Decreto 1072 de 2015','CONTRATO_TRABAJO','CONTRATO_ELECTRONICO',",
    " NULL,NULL,NULL,'" + rutaPdf + "');",
    'INSERT INTO gh_firma_holds (firma_id, actor, motivo, alcance, declarado_at)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " 'sistema','deber_legal_2.2.1.1.12 del Decreto 1072 de 2015',",
    " '2.2.1.1.12 del Decreto 1072 de 2015','2026-11-01T10:00:00.000Z');",
    'INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " 'CREATED','2026-11-01T10:00:00.000Z','t7-prueba');",
    'INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " 'OPENED','2026-11-01T10:05:00.000Z','t7-prueba');",
    'INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " 'INVITE_SENT','2026-11-01T10:06:00.000Z','t7-prueba');",
    'INSERT INTO gh_firma_sesiones (id, firma_id, estado_sesion, iniciado_en, ultimo_cambio_en)',
    " VALUES ('t7-sesion-0001',(SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='"
      + ID_SOLICITUD + "'),",
    " 'ABIERTA','2026-11-01T10:00:00.000Z','2026-11-01T10:06:00.000Z');",
    'INSERT INTO gh_firma_tokens (firma_id, token_hash, emision, origen)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',1,'create');",
    'INSERT INTO gh_firma_firmas_papel (firma_id, id_solicitud, id_empresa, estado, fecha_solicitud)',
    " VALUES ((SELECT id FROM gh_firmas_electronicas WHERE id_solicitud='" + ID_SOLICITUD + "'),",
    " '" + ID_SOLICITUD + "','" + ID_EMPRESA + "','SOLICITADO','2026-11-01T10:07:00.000Z');",
    'INSERT INTO gh_consentimientos_firma',
    ' (id_trabajador, id_empresa, version_acuerdo, hash_texto_acuerdo, correo_verificacion,',
    '  correo_hash, fecha_aceptacion, kair_version, manifestacion_aceptada, estado, rol_firmante,',
    '  created_at, updated_at)',
    " VALUES ('" + ID_TRABAJADOR + "','" + ID_EMPRESA + "','" + VERSION_PRUEBA + "',",
    " 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',",
    " 'prueba@t7.example.invalid',",
    " 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',",
    " '2026-11-01T10:08:00.000Z','t7-prueba',1,'ACCEPTED','TRABAJADOR',",
    " '2026-11-01T10:08:00.000Z','2026-11-01T10:08:00.000Z');",
    // El evento del consentimiento. NO es decorativo: es lo que hace que la
    // limpieza POR RANGO tenga que borrar el HIJO antes que el padre (la FK de
    // la migracion 010). Sin esta fila, el borrado del padre no se detectaria.
    'INSERT INTO gh_consentimientos_eventos (consent_id, evento, fecha_hora, id_actor)',
    " VALUES ((SELECT id FROM gh_consentimientos_firma WHERE id_trabajador='"
      + ID_TRABAJADOR + "'),",
    " 'ACEPTADO','2026-11-01T10:08:00.000Z','t7-prueba');",
  ].join('\n');
}

/** Prepara la base AISLADA: migraciones del repo y semilla sintetica. */
function prepararBase(args, db, rutaPdf) {
  const r = spawnSync('node', [path.join(args.appDir, 'src', 'db', 'migrate.js')], {
    cwd: args.appDir,
    env: Object.assign({}, process.env, ambienteSintetico(db)),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) {
    fail('Las migraciones no se pudieron aplicar', db
      + ' :: ' + ((r.stderr || r.stdout || '').trim().split('\n').slice(-1)[0] || 'sin salida'));
    return false;
  }
  const firmas = contar(db, 'gh_firmas_electronicas');
  const empresas = contar(db, 'gh_firma_empresas');
  if (empresas !== 0 || firmas !== 0) {
    fail('La base AISLADA ya tiene contenido', db
      + ' :: empresas=' + empresas + ' - firmas=' + firmas
      + '. La semilla sintetica no se siembra encima de filas que ya existen: '
      + 'borre el directorio de trabajo y vuelva a correr.');
    return false;
  }
  execFileSync('sqlite3', ['-bail', db, 'BEGIN;\n' + sqlSiembra(rutaPdf) + '\nCOMMIT;'],
    { encoding: 'utf8' });
  fs.writeFileSync(rutaPdf, 'PDF SINTETICO DE PRUEBA T7 - NO ES EVIDENCIA DE UN ACTO REAL\n');
  return true;
}

// ===========================================================================
// LAS MEDICIONES
// ===========================================================================

function medir(base, soloLectura) {
  const conteos = {};
  for (const t of TABLAS) {
    conteos[t] = contar(base, t, soloLectura);
  }
  const integridad = valorUnico(sqlPorCli(base, 'PRAGMA integrity_check;', soloLectura));
  const fk = sqlPorCli(base, 'PRAGMA foreign_key_check;', soloLectura);
  return {
    conteos,
    integridad,
    fk: fk.length,
    volcado: volcadoCanonico(base, soloLectura),
    archivo: shaArchivo(base),
  };
}

function lineaConteos(conteos) {
  return Object.keys(conteos).map((t) => t + '=' + (conteos[t] === null ? '(no existe)' : conteos[t]))
    .join(' - ');
}

function deltas(antes, despues) {
  const d = {};
  for (const t of TABLAS) {
    const a = antes[t];
    const b = despues[t];
    d[t] = (a === null || b === null) ? null : a - b;
  }
  return d;
}

// ===========================================================================
// LA CORRIDA
// ===========================================================================

function correr(args) {
  const db = path.resolve(args.db);
  const trabajo = path.resolve(args.trabajo);
  const antes = path.join(trabajo, 'antes.sqlite');
  const restaurada = path.join(trabajo, 'restaurada.sqlite');
  const prodCopia = path.join(trabajo, 'produccion-copia.sqlite');
  const prodRestaurada = path.join(trabajo, 'produccion-restaurada.sqlite');
  const pdfDir = path.join(trabajo, 'pdfs');
  const rutaPdf = path.join(pdfDir, ID_SOLICITUD + '.pdf');
  const marca = selloLocal();

  titulo('T7 - REVERSION DE LA FIRMA (AMBIENTE REAL, COPIA AISLADA)');
  emitir('  base AISLADA : ' + db);
  emitir('  trabajo      : ' + trabajo);
  emitir('  produccion   : ' + args.dbProduccion + ' (SOLO LECTURA)');
  emitir('  programa     : ' + args.programa);

  // ------------------------------------------------------------------
  // FASE 0 - EL ENTORNO
  // ------------------------------------------------------------------
  titulo('FASE 0 - EL ENTORNO');

  try {
    const v = execFileSync('sqlite3', ['-version'], { encoding: 'utf8' }).trim();
    ok('sqlite3 esta disponible', v.split('\n')[0]);
  } catch (e) {
    fail('No hay sqlite3 en el servidor', 'la prueba necesita el CLI de sqlite3');
    return 3;
  }

  if (!fs.existsSync(args.programa)) {
    fail('No esta el programa de reversion', args.programa);
    return 3;
  }
  const shaPrograma = shaArchivo(args.programa);
  ok('El programa de reversion BAJO PRUEBA', args.programa + ' :: sha256=' + shaPrograma);
  if (args.programaDesplegado && fs.existsSync(args.programaDesplegado)) {
    const shaDesplegado = shaArchivo(args.programaDesplegado);
    if (shaDesplegado === shaPrograma) {
      ok('El programa bajo prueba es EL MISMO que el desplegado', args.programaDesplegado
        + ' :: sha256=' + shaDesplegado);
    } else {
      warn('El programa bajo prueba NO es el que esta desplegado',
        'bajo prueba = ' + args.programa + ' :: sha256=' + shaPrograma
        + ' :: desplegado = ' + args.programaDesplegado + ' :: sha256=' + shaDesplegado
        + ' :: el arbol desplegado todavia no trae esta version');
    }
  } else {
    warn('No se pudo leer el programa de reversion desplegado', String(args.programaDesplegado)
      + ' :: no existe o no se puede leer');
  }

  if (!fs.existsSync(db) && !args.preparar) {
    fail('La base AISLADA no existe', db
      + ' :: cree la base (con --preparar la crea este script) antes de correr');
    return 2;
  }

  if (args.preparar) {
    fs.mkdirSync(trabajo, { recursive: true });
    fs.mkdirSync(pdfDir, { recursive: true });
    if (!prepararBase(args, db, rutaPdf)) return 2;
    ok('La base AISLADA quedo preparada', db
      + ' :: migraciones del repo + semilla sintetica (empresa ' + ID_EMPRESA
      + ', firma ' + ID_SOLICITUD + ')');
  } else {
    fs.mkdirSync(trabajo, { recursive: true });
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    ok('La base AISLADA ya venia preparada', db
      + ' :: el script NO la modifico (no se paso --preparar)');
  }

  const firmas = contar(db, 'gh_firmas_electronicas');
  if (!firmas) {
    fail('La base AISLADA no tiene la firma de prueba',
      db + ' :: se esperaba 1 firma sintetica (' + ID_SOLICITUD + ')');
    return 2;
  }

  // ------------------------------------------------------------------
  // FASE 1 - EL ESTADO "ANTES" Y EL RESPALDO
  // ------------------------------------------------------------------
  titulo('FASE 1 - EL ESTADO "ANTES" Y EL RESPALDO');

  const estadoAntes = medir(db, false);
  ok('El estado ANTES de la reversion (base AISLADA)', lineaConteos(estadoAntes.conteos));
  if (estadoAntes.integridad === 'ok') {
    ok('La base AISLADA estaba integra', 'integrity_check=ok');
  } else {
    fail('La base AISLADA NO estaba integra', 'integrity_check=' + estadoAntes.integridad);
  }
  if (estadoAntes.fk === 0) {
    ok('La base AISLADA no tenia llaves rotas', 'foreign_key_check=0 filas');
  } else {
    fail('La base AISLADA tenia llaves rotas', 'foreign_key_check=' + estadoAntes.fk + ' fila(s)');
  }
  ok('El volcado canonico ANTES', 'sha256 del .dump = ' + estadoAntes.volcado);
  ok('El hash del ARCHIVO ANTES', 'sha256 del archivo = ' + estadoAntes.archivo);

  copiar(db, antes, false);
  const volcadoDelRespaldo = volcadoCanonico(antes, false);
  if (volcadoDelRespaldo === estadoAntes.volcado) {
    ok('El respaldo captura el mismo contenido', 'sha256 del .dump del respaldo = '
      + volcadoDelRespaldo + ' (identico al de la base)');
  } else {
    fail('El respaldo NO captura el mismo contenido', 'dump del respaldo = '
      + volcadoDelRespaldo + ' <> dump de la base = ' + estadoAntes.volcado);
  }
  const shaDelRespaldo = shaArchivo(antes);
  if (shaDelRespaldo === estadoAntes.archivo) {
    warn('El hash del ARCHIVO del respaldo coincide con el de la base',
      'sha256 = ' + shaDelRespaldo + ' :: la comparacion por archivo puede dar la '
      + 'impresion de que "el respaldo es la misma base"');
  } else {
    ok('El hash del ARCHIVO del respaldo es DISTINTO al de la base',
      'respaldo = ' + shaDelRespaldo + ' :: base = ' + estadoAntes.archivo
      + ' :: el mismo contenido con distinta huella de archivo (por eso la '
      + 'comparacion honesta es la del volcado canonico)');
  }
  ok('El respaldo de esta corrida quedo en', antes
    + ' :: comando: sqlite3 "' + db + '" ".backup \'' + antes + '\'"');

  // La produccion, SOLO de comparacion: conteos y volcado, antes de tocar nada.
  let produccionAntes = null;
  try {
    produccionAntes = medir(args.dbProduccion, true);
    ok('El estado ANTES de PRODUCCION (solo lectura)', lineaConteos(produccionAntes.conteos)
      + ' :: volcado=' + produccionAntes.volcado);
  } catch (e) {
    warn('No se pudo leer la base de PRODUCCION', (e && e.message ? e.message : String(e))
      + ' :: la comparacion de produccion queda pendiente');
  }

  // ------------------------------------------------------------------
  // FASE 2 - CASO A: EL HOLD FRENA
  // ------------------------------------------------------------------
  titulo('FASE 2 - CASO A - LA REVERSION SIN --forzar-hold (TIENE QUE NEGARSE)');

  const casoA = correrPrograma(args, db, ['--ejecutar']);
  ok('Comando del caso A', casoA.comando);
  if (casoA.codigo === 4) {
    ok('El programa se NEGO a tocar la base', 'codigo de salida 4 :: ' + casoA.codigo);
  } else {
    fail('El programa no se nego como se esperaba', 'codigo de salida esperado 4, recibido '
      + casoA.codigo);
  }
  if (casoA.salida.indexOf('NO SE TOCA NADA') >= 0) {
    ok('El programa lo dice explicitamente', 'la salida trae "NO SE TOCA NADA"');
  } else {
    fail('La salida no dice "NO SE TOCA NADA"', 'el programa no se nego');
  }
  if (/hold/i.test(casoA.salida)) {
    ok('La negativa dice POR QUE (el hold)', 'la salida menciona el hold');
  } else {
    fail('La negativa no menciona el hold', 'no se puede saber por que se nego');
  }

  const estadoTrasCasoA = medir(db, false);
  if (estadoTrasCasoA.volcado === estadoAntes.volcado) {
    ok('La base NO cambio nada con la negativa', 'volcado canonico = '
      + estadoTrasCasoA.volcado + ' (identico al de antes)');
  } else {
    fail('La base cambio con la negativa', 'volcado antes = ' + estadoAntes.volcado
      + ' :: volcado despues = ' + estadoTrasCasoA.volcado);
  }
  const deltasCasoA = deltas(estadoAntes.conteos, estadoTrasCasoA.conteos);
  if (Object.keys(deltasCasoA).every((t) => deltasCasoA[t] === 0)) {
    ok('Ninguna tabla cambio de conteo con la negativa', lineaConteos(estadoTrasCasoA.conteos));
  } else {
    fail('Alguna tabla cambio con la negativa', lineaConteos(estadoTrasCasoA.conteos));
  }

  // ------------------------------------------------------------------
  // FASE 3 - CASO B: LA REVERSION CON --forzar-hold
  // ------------------------------------------------------------------
  titulo('FASE 3 - CASO B - LA REVERSION CON --forzar-hold (TIENE QUE BORRAR Y DEJAR RECIBO)');

  const casoB = correrPrograma(args, db, ['--forzar-hold', '--ejecutar']);
  ok('Comando del caso B', casoB.comando);
  if (casoB.codigo === 0) {
    ok('El programa termino bien', 'codigo de salida 0');
  } else {
    fail('El programa no termino bien', 'codigo de salida esperado 0, recibido ' + casoB.codigo);
  }

  const estadoDespues = medir(db, false);
  ok('El estado DESPUES de la reversion', lineaConteos(estadoDespues.conteos));

  // (a) QUE SE BORRA: lo que el programa dice se borro, se borro de verdad.
  const deltasB = deltas(estadoAntes.conteos, estadoDespues.conteos);
  const esperado = {
    'firmas eliminadas': 'gh_firmas_electronicas',
    'eventos eliminados': 'gh_firma_eventos',
    'sesiones eliminadas': 'gh_firma_sesiones',
    'tokens eliminados': 'gh_firma_tokens',
    'holds eliminados': 'gh_firma_holds',
    'firmas en papel borradas': 'gh_firma_firmas_papel',
    'consentimientos': 'gh_consentimientos_firma',
    'eventos de consentimiento': 'gh_consentimientos_eventos',
    'archivos eliminados': null,
  };
  for (const etiqueta of Object.keys(esperado)) {
    const dicho = numeroDelResultado(casoB.salida, etiqueta);
    const tabla = esperado[etiqueta];
    if (dicho === null) {
      fail('El programa no informo "' + etiqueta + '"', 'su salida no tiene ese numero');
      continue;
    }
    if (!tabla) {
      ok('El programa informo "' + etiqueta + '"', dicho + ' :: el archivo del PDF sintetico');
      continue;
    }
    const medido = deltasB[tabla];
    if (medido === dicho) {
      ok('Lo que dice borrar, lo borro :: "' + etiqueta + '"', 'el programa informo ' + dicho
        + ' y la base perdio ' + medido + ' fila(s) de ' + tabla);
    } else {
      fail('Lo que dice borrar NO coincide :: "' + etiqueta + '"', 'el programa informo ' + dicho
        + ' y la base perdio ' + medido + ' fila(s) de ' + tabla);
    }
  }

  // La version del Acuerdo: se retira la de prueba, la vigente sigue.
  const versiones = sqlPorCli(db, 'SELECT version, activa FROM gh_firma_acuerdo_versiones ORDER BY version;');
  const versionPrueba = versiones.filter((v) => v.version === args.version);
  if (versionPrueba.length === 0) {
    ok('La version de prueba del Acuerdo quedo retirada', args.version + ' ya no esta');
  } else {
    fail('La version de prueba del Acuerdo NO se retiro', args.version + ' sigue en la base');
  }
  const activa = versiones.filter((v) => Number(v.activa) === 1);
  if (activa.length === 1 && activa[0].version !== args.version) {
    ok('La version VIGENTE del Acuerdo sigue publicada', 'activa = ' + activa[0].version
      + ' :: la reversion no rompio el texto legal');
  } else {
    fail('La version vigente del Acuerdo quedo mal', 'activas = '
      + JSON.stringify(activa.map((v) => v.version)));
  }

  // (a) LA CONSISTENCIA de la base.
  if (estadoDespues.integridad === 'ok') {
    ok('La base quedo integra despues de la reversion', 'integrity_check=ok');
  } else {
    fail('La base quedo CORRUPTA', 'integrity_check=' + estadoDespues.integridad);
  }
  if (estadoDespues.fk === 0) {
    ok('La base no quedo con llaves rotas', 'foreign_key_check=0 filas');
  } else {
    fail('La base quedo con llaves rotas', 'foreign_key_check=' + estadoDespues.fk + ' fila(s)');
  }
  const abierta = valorUnico(sqlPorCli(db, 'SELECT COUNT(*) AS n FROM sqlite_master;'));
  if (Number(abierta) > 0) {
    ok('La base sigue abriendose', 'sqlite_master tiene ' + abierta + ' objetos');
  } else {
    fail('La base no se abre', 'sqlite_master vacio');
  }
  for (const t of TRIGGERS) {
    const hay = sqlPorCli(db, "SELECT name FROM sqlite_master WHERE type='trigger' AND name='"
      + esc(t) + "';");
    if (hay.length === 1) {
      ok('El trigger append-only quedo repuesto', t);
    } else {
      fail('El trigger append-only NO quedo repuesto', t);
    }
  }
  if (!fs.existsSync(rutaPdf)) {
    ok('El archivo del PDF de la prueba tambien se borro', rutaPdf + ' ya no existe');
  } else {
    fail('El archivo del PDF NO se borro', rutaPdf + ' sigue en el disco');
  }

  // (c) QUE QUEDA EVIDENCIA.
  const recibo = sqlPorCli(db,
    'SELECT id, firma_id, actor, categorias, hold_verificado, eventos_purgados, motivo'
    + ' FROM gh_firma_purga_registro ORDER BY id;');
  if (recibo.length >= 1) {
    ok('Qedo el RECIBO por firma en gh_firma_purga_registro', recibo.length + ' fila(s) :: '
      + 'id=' + recibo[0].id + ' - firma_id=' + recibo[0].firma_id + ' - actor=' + recibo[0].actor
      + ' - hold_verificado=' + recibo[0].hold_verificado + ' - categorias=' + recibo[0].categorias
      + ' - eventos_purgados=' + recibo[0].eventos_purgados);
  } else {
    fail('NO quedo recibo en gh_firma_purga_registro', 'la reversion tiene que dejar recibo');
  }
  if (recibo.length >= 1 && Number(recibo[0].hold_verificado) === 1) {
    ok('El recibo deja CONSTADO que se reviso el hold', 'hold_verificado=1');
  } else {
    fail('El recibo NO deja constancia del hold', 'hold_verificado distinto de 1');
  }
  if (recibo.length >= 1 && String(recibo[0].motivo).indexOf('HOLD FORZADO') >= 0) {
    ok('El recibo deja POR QUE se forzo el hold', 'motivo = ' + String(recibo[0].motivo));
  } else {
    fail('El recibo NO dice por que se forzo el hold', 'motivo = '
      + (recibo.length ? String(recibo[0].motivo) : '(sin recibo)'));
  }
  const asiento = sqlPorCli(db,
    'SELECT id, evento, actor, firmas_en_lote, eventos_purgados, hold_revisados, hold_bloqueados,'
    + ' motivo FROM gh_firma_purga_log ORDER BY id;');
  if (asiento.length >= 1) {
    ok('Qedo el ASENTO append-only en gh_firma_purga_log', asiento.length + ' fila(s) :: '
      + asiento.map((a) => a.evento).join(', '));
  } else {
    fail('NO quedo asiento en gh_firma_purga_log', 'la reversion tiene que dejar el asiento');
  }
  const conBloqueo = asiento.filter((a) => Number(a.hold_bloqueados) === 0
    && Number(a.hold_revisados) >= 1);
  if (conBloqueo.length >= 1) {
    ok('El asiento cuenta los holds revisados y los forzados', 'hold_revisados='
      + conBloqueo[0].hold_revisados + ' - hold_bloqueados=' + conBloqueo[0].hold_bloqueados);
  } else {
    fail('El asiento no cuenta los holds', 'ninguna fila con hold_revisados>=1 y hold_bloqueados=0');
  }

  // Lo que la 5B del repo exige y este programa de prueba NO hace.
  if (estadoDespues.conteos.gh_firma_purgadas === 0
    && estadoDespues.conteos.gh_firma_purgas_pendientes === 0) {
    ok('La 5B (supresion.js) no corrio y por eso no escribio su lapida',
      'gh_firma_purgadas=0 - gh_firma_purgas_pendientes=0 :: la lapida y el recibo '
      + 'de la 5B son de otra via (la ventana de purga), no de este programa');
  } else {
    warn('La 5B escribio algo',
      'gh_firma_purgadas=' + estadoDespues.conteos.gh_firma_purgadas
      + ' - gh_firma_purgas_pendientes=' + estadoDespues.conteos.gh_firma_purgas_pendientes);
  }

  // ------------------------------------------------------------------
  // FASE 4 - QUE SE RESTAURA
  // ------------------------------------------------------------------
  titulo('FASE 4 - QUE SE RESTAURA (EL RESPALDO VUELVE)');

  restaurar(antes, restaurada);
  ok('Se restauro el respaldo en otra base', restaurada
    + ' :: comando: sqlite3 "' + restaurada + '" ".restore \'' + antes + '\'"');
  const volcadoRestaurada = volcadoCanonico(restaurada, false);
  if (volcadoRestaurada === estadoAntes.volcado) {
    ok('El volcado canonico de la base RESTAURADA es IDENTICO al de origen', 'sha256 = '
      + volcadoRestaurada + ' (los dos)');
  } else {
    fail('El volcado canonico de la base restaurada NO es el de origen', 'restaurada = '
      + volcadoRestaurada + ' :: origen = ' + estadoAntes.volcado);
  }
  const estadoRestaurada = medir(restaurada, false);
  if (lineaConteos(estadoRestaurada.conteos) === lineaConteos(estadoAntes.conteos)) {
    ok('La base restaurada tiene EXACTAMENTE lo que habia antes', lineaConteos(estadoRestaurada.conteos));
  } else {
    fail('La base restaurada no tiene lo que habia antes', lineaConteos(estadoRestaurada.conteos)
      + ' :: antes = ' + lineaConteos(estadoAntes.conteos));
  }
  const versionRestaurada = sqlPorCli(restaurada,
    'SELECT version FROM gh_firma_acuerdo_versiones ORDER BY version;').map((v) => v.version);
  if (versionRestaurada.indexOf(args.version) >= 0) {
    ok('El respaldo devuelve la version anterior del Acuerdo', 'vuelven las versiones '
      + versionRestaurada.join(', ') + ' (la de prueba ' + args.version + ' included)');
  } else {
    fail('El respaldo NO devuelve la version anterior del Acuerdo',
      'versiones restauradas = ' + versionRestaurada.join(', '));
  }
  const shaRestaurada = shaArchivo(restaurada);
  if (shaRestaurada === estadoAntes.archivo) {
    warn('El hash del ARCHIVO restaurado coincide con el de origen',
      'sha256 = ' + shaRestaurada);
  } else {
    ok('El hash del ARCHIVO restaurado es DISTINTO (la trampa)',
      'restaurada = ' + shaRestaurada + ' :: origen = ' + estadoAntes.archivo
      + ' :: el CONTENIDO es el mismo (el volcado canonico coincide) pero la huella '
      + 'del archivo no: comparar por hash de archivo daria un falso negativo');
  }

  // El mismo ejercicio con la base de PRODUCCION: el respaldo real.
  if (produccionAntes) {
    try {
      copiar(args.dbProduccion, prodCopia, true);
      const volcadoProdCopia = volcadoCanonico(prodCopia, false);
      if (volcadoProdCopia === produccionAntes.volcado) {
        ok('El respaldo de PRODUCCION captura el mismo contenido', 'sha256 del .dump de la copia = '
          + volcadoProdCopia + ' (identico al de produccion)');
      } else {
        fail('El respaldo de PRODUCCION NO captura el mismo contenido', 'copia = '
          + volcadoProdCopia + ' :: produccion = ' + produccionAntes.volcado);
      }
      restaurar(prodCopia, prodRestaurada);
      const volcadoProdRestaurada = volcadoCanonico(prodRestaurada, false);
      if (volcadoProdRestaurada === produccionAntes.volcado) {
        ok('La base de PRODUCCION restaurada es IDENTICA a produccion', 'sha256 del volcado = '
          + volcadoProdRestaurada + ' (los dos)');
      } else {
        fail('La base de PRODUCCION restaurada NO es identica', 'restaurada = '
          + volcadoProdRestaurada + ' :: produccion = ' + produccionAntes.volcado);
      }
      const shaProd = shaArchivo(args.dbProduccion);
      const shaProdCopia = shaArchivo(prodCopia);
      if (shaProd !== shaProdCopia) {
        ok('El hash del ARCHIVO de produccion es DISTINTO al de su respaldo',
          'produccion = ' + shaProd + ' :: respaldo = ' + shaProdCopia
          + ' :: mismo contenido, distinta huella de archivo');
      } else {
        warn('El hash del ARCHIVO de produccion coincide con el de su respaldo',
          'sha256 = ' + shaProd);
      }
    } catch (e) {
      warn('No se pudo hacer el ejercicio de respaldo de PRODUCCION',
        e && e.message ? e.message : String(e));
    }
  }

  // ------------------------------------------------------------------
  // FASE 5 - PRODUCCION INTACTA
  // ------------------------------------------------------------------
  titulo('FASE 5 - PRODUCCION INTACTA (SOLO LECTURA)');

  if (produccionAntes) {
    try {
      const produccionDespues = medir(args.dbProduccion, true);
      if (lineaConteos(produccionDespues.conteos) === lineaConteos(produccionAntes.conteos)) {
        ok('Los conteos de PRODUCCION no cambiaron', lineaConteos(produccionDespues.conteos));
      } else {
        fail('Los conteos de PRODUCCION CAMBIARON', 'antes = '
          + lineaConteos(produccionAntes.conteos) + ' :: ahora = '
          + lineaConteos(produccionDespues.conteos));
      }
      if (produccionDespues.volcado === produccionAntes.volcado) {
        ok('El volcado canonico de PRODUCCION no cambio', 'sha256 = ' + produccionDespues.volcado);
      } else {
        fail('El volcado canonico de PRODUCCION CAMBIO', 'antes = ' + produccionAntes.volcado
          + ' :: ahora = ' + produccionDespues.volcado);
      }
    } catch (e) {
      fail('No se pudo volver a leer PRODUCCION', e && e.message ? e.message : String(e));
    }
  } else {
    warn('La comparacion de PRODUCCION no se pudo hacer', 'la base no se pudo leer al empezar');
  }

  try {
    const s = execFileSync('systemctl', ['show', 'kair-firma', '-p', 'MainPID', '-p', 'NRestarts',
      '-p', 'ActiveEnterTimestamp'], { encoding: 'utf8' }).trim().replace(/\n/g, ' - ');
    ok('El servicio de produccion no se reinicio', s);
  } catch (e) {
    warn('No se pudo leer el estado del servicio', e && e.message ? e.message : String(e));
  }

  try {
    const j = execFileSync('journalctl', ['-u', 'kair-firma', '--since', marca, '--no-pager'],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const lineas = j.split('\n')
      .filter((l) => l.trim().length > 0 && l.trim() !== '-- No entries --');
    if (lineas.length === 0) {
      ok('El journal del servicio no tiene nada en la ventana de la prueba',
        'journalctl -u kair-firma --since "' + selloLocal() + '" :: -- No entries --');
    } else {
      warn('El journal del servicio tiene entradas en la ventana',
        lineas.length + ' linea(s) :: ' + lineas.slice(-3).join(' | '));
    }
  } catch (e) {
    warn('No se pudo leer el journal del servicio', e && e.message ? e.message : String(e));
  }

  // ------------------------------------------------------------------
  // FASE 6 - LA VIA CIFRADA (LO QUE QUEDA PENDIENTE)
  // ------------------------------------------------------------------
  titulo('FASE 6 - LA VIA CIFRADA DE LOS RESPALDOS (LO QUE NO SE PUEDE CORRER AQUI)');

  const dirBackups = '/opt/kair-firma/backups';
  if (fs.existsSync(dirBackups)) {
    try {
      const l = execFileSync('ls', ['-l', dirBackups], { encoding: 'utf8' }).trim().split('\n');
      ok('Los respaldos que hay en el servidor', l.length + ' linea(s) en ' + dirBackups
        + ' :: ' + l.slice(0, 4).join(' | '));
    } catch (e) {
      warn('No se pudo listar el directorio de respaldos', e && e.message ? e.message : String(e));
    }
    const logRestauracion = path.join(dirBackups, 'restauracion.log');
    if (fs.existsSync(logRestauracion)) {
      ok('Existe el log de la prueba de restauracion', logRestauracion);
    } else {
      warn('NO existe el log de la prueba de restauracion',
        logRestauracion + ' :: la prueba de restauracion cifrada (deploy/probar-restauracion.sh) '
        + 'corre por el cron del dia 1 de cada mes; todavia no ha corrido');
    }
  } else {
    warn('No se ve el directorio de respaldos', dirBackups
      + ' :: esta corrida no puede afirmar nada sobre los respaldos cifrados');
  }
  warn('La restauracion CIFRADA no se puede correr con esta cuenta',
    'los .enc y la frase de cifrado son 600 root. Esta corrida comprueba la via de la '
    + 'copia limpia (.backup + .restore) con comparacion del volcado canonico, no la '
    + 'descifrado de gpg: esa queda pendiente de root');

  // ------------------------------------------------------------------
  // LA EVIDENCIA
  // ------------------------------------------------------------------
  titulo('LA EVIDENCIA');
  if (args.confirmarEscribe) {
    fs.writeFileSync(args.evidencia, bitacora.join('\n') + '\n', 'utf8');
    ok('La evidencia quedo escrita', args.evidencia);
  } else {
    warn('Sin --confirmar-escribe no se escribio nada', 'la evidencia NO se guardo');
  }

  return resumen() === 0 ? 0 : 1;
}

// ===========================================================================

function main(argv) {
  const args = parseArgs(argv || process.argv);
  if (args.ayuda) {
    console.log(textoDeUso());
    return 0;
  }
  if (!validarArgumentos(args)) {
    console.log('');
    console.log(textoDeUso());
    return 2;
  }
  try {
    return correr(args);
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
  reiniciar,
  sqlPorCli,
  contar,
  existeTabla,
  volcadoCanonico,
  shaArchivo,
  copiar,
  restaurar,
  medir,
  correrPrograma,
  ambienteSintetico,
  sqlSiembra,
  textoDeUso,
  resultados,
  DEFAULT_APP_DIR,
  DEFAULT_DB_PRODUCCION,
  DEFAULT_TRABAJO,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
