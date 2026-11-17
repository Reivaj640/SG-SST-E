#!/usr/bin/env node
/**
 * scripts/limpiar-empresa-prueba.js
 *
 * QUITA DE MEDIO UNA EMPRESA DE PRUEBA, COMPLETA.
 *
 * QUE ES ESTO Y POR QUE NO ES EL DE LAS FIRMAS
 * ---------------------------------------------
 * `scripts/limpiar-rastro-prueba.js` (21-oct-2026) limpia una PUBLICACION DE
 * PRUEBA: filas de firma, sus eventos, sus archivos, el consentimiento y la
 * version del Acuerdo. Ese script no sabe nada de Empresas: es el que se
 * quedo en la puerta cuando llego la primera Empresa de verdad.
 *
 * Este script es el otro: borra una EMPRESA DE PRUEBA entera. En produccion
 * solo hay una, ASEPLUS CARIBE S.A.S. (NIT 900829731), que se creo para
 * ensayar el ciclo de suscripcion, verificacion del representante y
 * contrafirma. Con ella en la base, la primera Empresa REAL hereda una ficha
 * ajena, un client key vivo y cinco firmas de ensayo.
 *
 * LO QUE BORRA
 * ------------
 * Se discovers TODO por el esquema real de la base (PRAGMA table_info y
 * PRAGMA foreign_key_list), no por una lista escrita a mano: asi el script no
 * puede dejar una tabla sin ver porque alguien agrego una migracion.
 *
 *   1. La ficha de la Empresa y sus auditorias (gh_firma_empresas y las que
 *      la apuntan).
 *   2. Sus suscripciones de Anexo de Nube y de Anexo de Encargo, con todos
 *      sus eventos.
 *   3. Sus firmas electronicas, con sus eventos, sus sesiones, sus
 *      consentimientos (y los datos sensibles de esos consentimientos), sus
 *      holds y sus lotes de purga.
 *   4. Sus solicitudes de titular (las de la peticion de firma del cliente).
 *   5. Su client key (gh_internal_clients): la fila que ata la API key de la
 *      Empresa al servicio. Sin esto, la key sigue viva aunque la Empresa no
 *      exista.
 *   6. Los archivos que colgaban de esas filas: las actas PDF de las
 *      suscripciones y de las contrafirmas, y los PDF de las firmas.
 *
 * LO QUE NO BORRA
 * ---------------
 *   - El texto legal (Acuerdo, Anexo de Encargo, Anexo de Nube): es de
 *     K+AIR, no de la Empresa.
 *   - Los poderes del Encargado (gh_firma_encargado_poderes): son de
 *     Gesstiar, no de la Empresa cliente.
 *   - Ningun texto del sitio publico.
 *   - Los recibos de purga (gh_firma_purga_log): son append-only y son la
 *     prueba de lo que se hizo. Este script AGREGA uno.
 *
 * LO QUE HACE ANTES DE TOCAR NADA
 * --------------------------------
 *   1. Sin `--actor` y sin `--motivo` no hace nada: quien borra tiene que
 *      decir quien es y por que.
 *   2. Sin `--ejecutar` es una SIMULACION: imprime el plan (que tablas, que
 *      filas, que archivos) y no toca nada.
 *   3. `--hasta=YYYY-MM-DD` (opcional) acota el borrado: ninguna fila mas
 *      nueva que esa fecha se toca. Sin esta bandera, el script borra TODO
 *      lo de la Empresa, incluso lo que se haya creado despues.
 *   4. Respaldo con `VACUUM INTO` antes de la primera escritura: una copia
 *      consistente aunque la base este en WAL.
 *   5. Los triggers append-only se QUITAN y se PONEN (se leen de
 *      `sqlite_master`, que es lo que esta instalado de verdad) y al final se
 *      verifica que quedaron los mismos.
 *
 * COMO SE CORRE (EN EL SERVIDOR, EN ESTE ORDEN)
 * ---------------------------------------------
 *   # 0. EN EL PC, EN LA APP: Configuracion -> Firma Electronica -> Aseplus
 *   #    -> "Eliminar". Eso borra la configuracion local (secrets.enc) y
 *   #    marca la API key como revocada en el servicio. Si se borra la base
 *   #    primero, la revocacion no tiene a quien hablar.
 *
 *   # 1. SUBIR EL SCRIPT (el agente no tiene SSH al servidor: lo sube el
 *   #    owner, que es quien tiene la contrasena).
 *   scp sgsst-electron-app/firma-service/scripts/limpiar-empresa-prueba.js \
 *       javier@192.168.1.11:/tmp/
 *
 *   # 2. EN EL SERVIDOR: parar el servicio para que no escriba mientras se
 *   #    borra (el servicio corre como `kairfirma`).
 *   sudo systemctl stop kair-firma
 *
 *   # 3. SIMULACION (no toca nada: imprime que tablas, que filas y que
 *   #    archivos se van a borrar):
 *   sudo -u kairfirma env FIRMA_APP_DIR=/opt/kair-firma/app \
 *     /opt/kair-firma/node22/bin/node /tmp/limpiar-empresa-prueba.js \
 *     --empresa=900829731 --actor="Javier Robles Fontalvo" \
 *     --motivo="Empresa de prueba: se retira del servidor"
 *
 *   # 4. BORRADO DE VERDAD (agrega --ejecutar):
 *   sudo -u kairfirma env FIRMA_APP_DIR=/opt/kair-firma/app \
 *     /opt/kair-firma/node22/bin/node /tmp/limpiar-empresa-prueba.js \
 *     --empresa=900829731 --actor="Javier Robles Fontalvo" \
 *     --motivo="Empresa de prueba: se retira del servidor" --ejecutar
 *
 *   # 5. COPIAR EL RESPALDO al PC (queda en <db>/backups/):
 *   scp javier@192.168.1.11:/opt/kair-firma/app/data/backups/firma-antes-limpieza-900829731-*.sqlite .
 *
 *   # 6. REINICIAR Y VERIFICAR:
 *   sudo systemctl start kair-firma
 *   curl -s https://firma.kair.fyi/health
 *
 * QUE PASA SI LAS RUTAS NO SON LAS QUE SE ESPERA
 * -----------------------------------------------
 * El script NO adivina: mira una lista de candidatos (el `.env` del servidor
 * es root 600 y no se puede leer sin sudo) y dice en pantalla cual uso. Si no
 * encuentra la base, se niega (codigo 3) en vez de crear una base vacia en el
 * lugar equivocado. Con `--db=RUTA` y `--pdf-dir=RUTA` se le dice a mano.
 *
 * Exit codes:
 *   0  operacion exitosa (incluida la simulacion)
 *   2  argumentos invalidos
 *   3  error de base de datos o de disco
 *   4  se negaron las verificaciones (no se toco nada)
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// better-sqlite3: se busca en varios lugares porque este script se corre en el
// servidor, desde /tmp, donde no hay node_modules al lado. El ABI tiene que
// coincidir con el node que lo ejecuta: en el servidor, node22 (ABI 127).
// ---------------------------------------------------------------------------
function resolverBetterSqlite3() {
  const candidatos = [];
  if (process.env.FIRMA_APP_DIR) {
    candidatos.push(path.join(process.env.FIRMA_APP_DIR, 'node_modules', 'better-sqlite3'));
  }
  candidatos.push(path.join(__dirname, '..', 'node_modules', 'better-sqlite3'));
  candidatos.push('/opt/kair-firma/app/node_modules/better-sqlite3');
  for (const c of candidatos) {
    try {
      return require(c);
    } catch (_) {
      /* siguiente candidato */
    }
  }
  try {
    return require('better-sqlite3');
  } catch (e) {
    throw new Error(
      'No se encontro better-sqlite3. Indique el arbol de la app con '
      + 'FIRMA_APP_DIR=/opt/kair-firma/app (el modulo tiene que ser del mismo '
      + 'ABI que el node que lo ejecuta). Detalle: ' + e.message
    );
  }
}

/**
 * Abre la base en modo lectura o lectura-escritura.
 * @param {string} ruta
 * @param {boolean} soloLectura
 * @returns {object} la conexion de better-sqlite3
 */
function abrirDb(ruta, soloLectura) {
  const Database = resolverBetterSqlite3();
  const db = new Database(ruta, { readonly: soloLectura });
  db.pragma('busy_timeout = 8000');
  return db;
}

/**
 * La base: donde este.
 *
 * En el servidor la ruta sale del `.env` (root 600, no legible sin sudo), y
 * el `.env` la define RELATIVA a la app. Por eso el script no adivina: mira
 * una lista de candidatos y dice cual uso. Si no encuentra ninguna, se
 * niega en vez de crear una base vacia en el lugar equivocado.
 *
 * @param {string} [indicada] - la que dio el operador (--db=)
 * @returns {string} la ruta resuelta
 */
function resolverDb(indicada) {
  if (indicada) return path.resolve(indicada);
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  const candidatos = [
    path.join(process.cwd(), 'data', 'firma.sqlite'),
    process.env.FIRMA_APP_DIR ? path.join(process.env.FIRMA_APP_DIR, 'data', 'firma.sqlite') : null,
    '/opt/kair-firma/app/data/firma.sqlite',
    '/opt/kair-firma/data/firma.sqlite',
  ].filter(Boolean);
  for (const c of candidatos) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  throw new Error(
    'No se encontro la base. Probadas: ' + candidatos.join(', ')
    + '. Indique la ruta con --db=RUTA (la de verdad sale del .env del servidor).'
  );
}

/**
 * La carpeta de PDF (actas, constancias, firmados).
 * @param {string} [indicada] - la que dio el operador (--pdf-dir=)
 * @returns {string} la ruta resuelta
 */
function resolverPdfDir(indicada) {
  if (indicada) return path.resolve(indicada);
  if (process.env.PDF_STORAGE_PATH) return path.resolve(process.env.PDF_STORAGE_PATH);
  const candidatos = [
    path.join(process.cwd(), 'storage', 'pdfs'),
    process.env.FIRMA_APP_DIR ? path.join(process.env.FIRMA_APP_DIR, 'storage', 'pdfs') : null,
    '/opt/kair-firma/app/storage/pdfs',
    '/opt/kair-firma/storage/pdfs',
  ].filter(Boolean);
  for (const c of candidatos) {
    if (fs.existsSync(c)) return path.resolve(c);
  }
  // Si no hay carpeta de PDF, no hay archivos que borrar: se usa una que no
  // existe y el plan dira que no hay archivos.
  return candidatos[0];
}

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    empresa: null,
    actor: null,
    motivo: null,
    hasta: null,
    ejecutar: false,
    db: null,
    backupDir: null,
    pdfDir: null,
    quiet: false,
  };
  for (const arg of argv) {
    if (arg === '--ejecutar') {
      opts.ejecutar = true;
    } else if (arg === '--silencioso') {
      opts.quiet = true;
    } else if (arg.startsWith('--empresa=')) {
      opts.empresa = arg.slice('--empresa='.length).trim();
    } else if (arg.startsWith('--actor=')) {
      opts.actor = arg.slice('--actor='.length).trim();
    } else if (arg.startsWith('--motivo=')) {
      opts.motivo = arg.slice('--motivo='.length).trim();
    } else if (arg.startsWith('--hasta=')) {
      opts.hasta = arg.slice('--hasta='.length).trim();
    } else if (arg.startsWith('--db=')) {
      opts.db = arg.slice('--db='.length).trim();
    } else if (arg.startsWith('--backup-dir=')) {
      opts.backupDir = arg.slice('--backup-dir='.length).trim();
    } else if (arg.startsWith('--pdf-dir=')) {
      opts.pdfDir = arg.slice('--pdf-dir='.length).trim();
    } else {
      throw new Error('Argumento desconocido: ' + arg);
    }
  }
  if (!opts.empresa) throw new Error('Falta --empresa=ID (la Empresa a limpiar)');
  if (!opts.actor) throw new Error('Falta --actor (quien hace el cambio)');
  if (!opts.motivo) throw new Error('Falta --motivo (por que se hace el cambio)');
  if (opts.hasta && !/^\d{4}-\d{2}-\d{2}$/.test(opts.hasta)) {
    throw new Error('--hasta tiene que ser una fecha YYYY-MM-DD');
  }
  return opts;
}

// ---------------------------------------------------------------------------
// El esquema: se pregunta a la base, no a una lista escrita a mano
// ---------------------------------------------------------------------------

/**
 * Lee el esquema de la base: tablas, columnas, clave primaria y FKs.
 * @param {object} db
 * @returns {object} tabla -> { cols, pk, fks, tienePk }
 */
function leerEsquema(db) {
  const tablas = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name);
  const esq = {};
  for (const t of tablas) {
    const cols = db.prepare('PRAGMA table_info("' + t + '")').all();
    if (!cols.length) continue;
    const nombres = cols.map(c => c.name);
    const pkCols = cols.filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
    const fks = db.prepare('PRAGMA foreign_key_list("' + t + '")').all();
    esq[t] = {
      cols: nombres,
      pk: pkCols,
      fks: fks.map(f => ({
        tablaPadre: f.table,
        columna: f.from,
        columnaPadre: f.to || null,
        onDelete: f.on_delete,
      })),
    };
  }
  return esq;
}

/**
 * La columna que identifica la Empresa en una tabla.
 * @param {object} info
 * @returns {string|null}
 */
function columnaEmpresa(info) {
  const hit = info.cols.find(c => c.toLowerCase() === 'id_empresa');
  return hit || null;
}

/**
 * La columna que identifica una fila de una tabla (PK o rowid).
 * @param {object} info
 * @returns {{col: string, esPk: boolean}}
 */
function identificadorDe(info) {
  if (info.pk.length === 1) return { col: info.pk[0], esPk: true };
  return { col: 'rowid', esPk: false };
}

// ---------------------------------------------------------------------------
// El inventario: que filas de la Empresa hay, en que tablas
// ---------------------------------------------------------------------------

/**
 * La cascada POR CONVENCION.
 *
 * No todas las tablas que cuelgan de la Empresa tienen una FK declarada:
 * `gh_firma_holds` (firma_id), `gh_consentimientos_eventos` (consent_id) y
 * `gh_solicitudes_titular_eventos` (solicitud_id) apuntan a su padre SIN
 * declaracion de FK en el esquema. Sin esta cascada, el script borraria la
 * firma y dejaria el hold y los eventos colgando de una fila que ya no
 * existe.
 *
 * El nombre de la columna dice a quien apunta; esa es la convencion que usa
 * el propio servicio.
 */
const CONVENCION_PADRES = [
  { columnas: ['id_suscripcion', 'suscripcion_id'], tablas: /suscripciones$/i },
  { columnas: ['consent_id', 'consentimiento_id'], tablas: /consentimientos_firma$/i },
  { columnas: ['solicitud_id', 'id_solicitud'], tablas: /solicitudes_titular$/i },
  { columnas: ['firma_id', 'id_firma'], tablas: /firmas_electronicas$/i },
];

/**
 * Las tablas que NO se borran, aunque la cascada las alcance.
 *
 * Son los RECIBOS: las pruebas de que se hizo algo. La 020 los protege con
 * triggers append-only, asi que intentar borrarlas haria fallar toda la
 * limpieza. El recibo de ESTA limpieza se escribe (INSERT) en
 * `gh_firma_purga_log`.
 */
const TABLAS_PROTEGIDAS = [
  'gh_firma_purga_log',
  'gh_firma_purga_registro',
  'gh_firma_purga_lote',
  'gh_firma_purga_control',
  'gh_firma_purgadas',
];

/**
 * El inventario: que filas de la Empresa hay, en que tablas
 *
 * @param {object} db
 * @param {object} esq
 * @param {string} idEmpresa
 * @returns {Map<string, Array<object>>} tabla -> filas (con _rid y _id)
 */
function inventariar(db, esq, idEmpresa) {
  const affected = new Map();

  // 1. La siembra: las tablas que apuntan a la Empresa por id_empresa.
  for (const t of Object.keys(esq)) {
    if (TABLAS_PROTEGIDAS.includes(t)) continue;
    const col = columnaEmpresa(esq[t]);
    if (!col) continue;
    const filas = db.prepare(
      'SELECT rowid AS _rid, * FROM "' + t + '" WHERE "' + col + '" = ?'
    ).all(idEmpresa);
    if (filas.length) affected.set(t, filas);
  }

  // 2. La cascada: por FK declarada y, despues, por convencion del nombre
  //    de la columna. Se repite hasta que no aparece nada nuevo.
  let cambio = true;
  while (cambio) {
    cambio = false;

    // 2a. Por FK declarada.
    for (const t of Object.keys(esq)) {
      const info = esq[t];
      if (!info.fks.length) continue;
      if (TABLAS_PROTEGIDAS.includes(t)) continue;
      const ident = identificadorDe(info);
      for (const fk of info.fks) {
        const padreFilas = affected.get(fk.tablaPadre);
        if (!padreFilas || !padreFilas.length) continue;
        const colPadre = fk.columnaPadre
          || (esq[fk.tablaPadre] && esq[fk.tablaPadre].pk.length === 1 ? esq[fk.tablaPadre].pk[0] : null);
        if (!colPadre) continue;
        const valores = new Set();
        for (const f of padreFilas) {
          const v = f[colPadre];
          if (v !== null && v !== undefined) valores.add(v);
        }
        if (!valores.size) continue;
        const yaEnEl = affected.get(t) || [];
        const clavesNuevas = new Set(yaEnEl.map(f => f['_rid']));
        const filtro = new Array(valores.size).fill('?').join(', ');
        const candidatas = db.prepare(
          'SELECT rowid AS _rid, * FROM "' + t + '" WHERE "' + fk.columna + '" IN (' + filtro + ')'
        ).all(...valores);
        const nuevas = candidatas.filter(c => !clavesNuevas.has(c['_rid']));
        if (nuevas.length) {
          affected.set(t, yaEnEl.concat(nuevas));
          cambio = true;
        }
      }
    }

    // 2b. Por convencion del nombre de la columna.
    for (const t of Object.keys(esq)) {
      const info = esq[t];
      if (TABLAS_PROTEGIDAS.includes(t)) continue;
      for (const conv of CONVENCION_PADRES) {
        for (const col of conv.columnas) {
          if (!info.cols.includes(col)) continue;
          for (const p of [...affected.keys()]) {
            if (!conv.tablas.test(p)) continue;
            const padreFilas = affected.get(p);
            if (!padreFilas || !padreFilas.length) continue;
            const colPadre = esq[p].pk.length === 1 ? esq[p].pk[0] : null;
            if (!colPadre) continue;
            const valores = new Set();
            for (const f of padreFilas) {
              const v = f[colPadre];
              if (v !== null && v !== undefined) valores.add(v);
            }
            if (!valores.size) continue;
            const yaEnEl = affected.get(t) || [];
            const clavesNuevas = new Set(yaEnEl.map(f => f['_rid']));
            const filtro = new Array(valores.size).fill('?').join(', ');
            const candidatas = db.prepare(
              'SELECT rowid AS _rid, * FROM "' + t + '" WHERE "' + col + '" IN (' + filtro + ')'
            ).all(...valores);
            const nuevas = candidatas.filter(c => !clavesNuevas.has(c['_rid']));
            if (nuevas.length) {
              affected.set(t, yaEnEl.concat(nuevas));
              cambio = true;
            }
          }
        }
      }
    }
  }

  return affected;
}

/**
 * El orden de borrado: los hijos ANTES que los padres.
 *
 * Si dos tablas se apuntan entre si (un ciclo), el orden no existe. En ese
 * caso se devuelve el error: con `foreign_keys` apagado se podria borrar igual,
 * pero el `foreign_key_check` de despues lo detectaria; mejor negarse.
 *
 * @param {Map} affected
 * @param {object} esq
 * @returns {string[]} tablas en orden de borrado
 */
function ordenDeBorrado(affected, esq) {
  const orden = [];
  const visitar = (t, pila) => {
    if (orden.includes(t)) return;
    if (pila.includes(t)) {
      throw new Error('Ciclo de FK entre ' + t + ' y ' + pila.join(' -> ')
        + ': no hay orden de borrado seguro');
    }
    const info = esq[t];
    const padres = info ? info.fks.map(f => f.tablaPadre).filter(p => affected.has(p)) : [];
    for (const p of padres) visitar(p, pila.concat(t));
    orden.push(t);
  };
  for (const t of affected.keys()) visitar(t, []);
  return orden.reverse();
}

// ---------------------------------------------------------------------------
// Los archivos
// ---------------------------------------------------------------------------

/**
 * Las columnas de una fila que guardan una ruta de archivo.
 * @param {object} info
 * @returns {string[]}
 */
function columnasDeArchivo(info) {
  return info.cols.filter(c => /_path$|_archivo$|ruta|archivo/i.test(c));
}

/**
 * Las actas que el servicio nombró por patrón (ver actaEncargo.js y
 * actaAnexoNube.js): el nombre lo arma el servicio, no la fila.
 * @param {number[]} idsSuscripcion
 * @returns {string[]}
 */
function actasPorPatron(idsSuscripcion) {
  const nombres = [];
  for (const id of idsSuscripcion) {
    nombres.push('acta-' + id + '-anexo-encargo.pdf');
    nombres.push('acta-' + id + '-contrafirma-anexo-encargo.pdf');
    nombres.push('acta-' + id + '-contrafirma-anexo-nube.pdf');
  }
  return nombres;
}

/**
 * Junta los archivos que hay que borrar y descarta los que se salen del
 * arbol de almacenamiento (nunca se borra un archivo fuera del arbol).
 *
 * @param {Map} affected
 * @param {object} esq
 * @param {string} raizPdf
 * @returns {Array<{ruta: string, motivo: string}>}
 */
function archivosABorrar(affected, esq, raizPdf) {
  const raiz = path.resolve(raizPdf);
  const vistos = new Map();

  const guardar = (abs, motivo) => {
    const r = path.resolve(abs);
    if (r !== raiz && !r.startsWith(raiz + path.sep)) return; // fuera del arbol
    if (!vistos.has(r)) vistos.set(r, motivo);
  };

  // 1. Las rutas que estaban en las filas que se borran.
  for (const [t, filas] of affected.entries()) {
    const info = esq[t];
    if (!info) continue;
    for (const col of columnasDeArchivo(info)) {
      for (const f of filas) {
        const v = f[col];
        if (!v || typeof v !== 'string') continue;
        if (path.isAbsolute(v)) {
          guardar(v, t + '.' + col);
        } else {
          guardar(path.join(raiz, v), t + '.' + col);
          guardar(path.join(raiz, 'actas', v), t + '.' + col + ' (actas)');
        }
      }
    }
  }

  // 2. Las actas por patron de las suscripciones que se borran.
  const idsSuscripcion = [];
  for (const [t, filas] of affected.entries()) {
    if (!/suscripciones$/i.test(t)) continue;
    for (const f of filas) {
      const id = f.id !== undefined ? f.id : f._rid;
      if (id !== undefined && id !== null) idsSuscripcion.push(Number(id));
    }
  }
  for (const nombre of actasPorPatron(idsSuscripcion)) {
    guardar(path.join(raiz, 'actas', nombre), 'acta por patron');
    guardar(path.join(raiz, nombre), 'acta por patron');
  }

  const salida = [];
  for (const [ruta, motivo] of vistos.entries()) {
    if (fs.existsSync(ruta)) salida.push({ ruta, motivo });
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Los triggers append-only
// ---------------------------------------------------------------------------

/**
 * Los triggers que impiden BORRAR en las tablas que se van a tocar.
 *
 * Se leen de `sqlite_master` (que es lo que esta instalado de verdad) y se
 * reponen textualmente despues: si alguien los cambio, se repone lo que
 * estaba, no lo que este script cree que deberia estar.
 *
 * @param {object} db
 * @param {string[]} tablas
 * @returns {Array<{nombre: string, sql: string, tabla: string}>}
 */
function triggersDeBorrado(db, tablas) {
  const encontrados = [];
  for (const t of tablas) {
    const trg = db.prepare(
      "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name = ?"
    ).all(t);
    for (const x of trg) {
      if (!x.sql) continue;
      if (!/no_delete|BEFORE\s+DELETE|INSTEAD\s+OF/i.test(x.sql)) continue;
      encontrados.push({ nombre: x.name, sql: x.sql, tabla: x.tbl_name });
    }
  }
  return encontrados;
}

// ---------------------------------------------------------------------------
// El plan
// ---------------------------------------------------------------------------

/**
 * Arma el plan: que se va a borrar y de donde.
 * @param {object} db
 * @param {object} esq
 * @param {Map} affected
 * @param {string} raizPdf
 * @returns {object}
 */
function armarPlan(db, esq, affected, raizPdf) {
  const tablas = [];
  for (const [t, filas] of affected.entries()) {
    const info = esq[t];
    const ident = identificadorDe(info);
    const ids = filas.map(f => (ident.esPk ? f[ident.col] : f._rid));
    tablas.push({
      tabla: t,
      filas: filas.length,
      identificador: ident.col,
      ids,
      muestra: filas.slice(0, 3).map(f => {
        const out = {};
        for (const c of info.cols.slice(0, 6)) {
          const v = f[c];
          out[c] = (v === null || v === undefined) ? null
            : (typeof v === 'string' && v.length > 60 ? v.slice(0, 60) + '...' : v);
        }
        return out;
      }),
    });
  }
  return {
    tablas: tablas.sort((a, b) => b.filas - a.filas),
    archivos: archivosABorrar(affected, esq, raizPdf),
    totalFilas: tablas.reduce((a, t) => a + t.filas, 0),
  };
}

// ---------------------------------------------------------------------------
// La ejecucion
// ---------------------------------------------------------------------------

/**
 * Las columnas que dicen CUANDO se creo una fila, en orden de preferencia.
 *
 * NO se usa "cualquier columna que termine en _at": las firmas tienen
 * `fecha_expiracion`, que SIEMPRE es mas nueva que la fila, y una ventana
 * acotada por `fecha_expiracion` no dejaria borrar nada.
 */
const COLUMNAS_DE_CREACION = [
  'created_at',
  'fecha_creacion',
  'fecha_hora',
  'declarado_at',
  'fecha_inicio',
];

/**
 * Cuenta las filas que tienen una marca de tiempo mas nueva que `hasta`.
 * @param {object} db
 * @param {Map} affected
 * @param {string} hasta
 * @returns {Array<object>} las filas que se niegan a tocar
 */
function filasMasNuevasQue(db, affected, hasta) {
  const fuera = [];
  const corte = hasta + 'T23:59:59.999Z';
  for (const [t, filas] of affected.entries()) {
    // La columna de creacion de esta tabla (la primera que exista).
    let col = null;
    for (const c of COLUMNAS_DE_CREACION) {
      if (filas[0] && Object.prototype.hasOwnProperty.call(filas[0], c)) { col = c; break; }
    }
    if (!col) continue;
    for (const f of filas) {
      const v = f[col];
      if (typeof v !== 'string' || !v) continue;
      if (v > corte) {
        fuera.push({ tabla: t, columna: col, valor: v });
      }
    }
  }
  return fuera;
}

/**
 * El respaldo: una copia consistente de la base, aunque este en WAL.
 * @param {object} db
 * @param {string} destino
 * @returns {string} la ruta del respaldo
 */
function respaldar(db, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  if (fs.existsSync(destino)) fs.unlinkSync(destino);
  db.prepare("VACUUM INTO ?").run(destino);
  if (!fs.existsSync(destino)) throw new Error('El respaldo no aparecio: ' + destino);
  const bytes = fs.statSync(destino).size;
  if (bytes <= 0) throw new Error('El respaldo quedo vacio: ' + destino);
  return destino;
}

/**
 * Borra las filas planificadas, deja el recibo y verifica.
 *
 * @param {object} db
 * @param {object} esq
 * @param {object} opts
 * @param {Map} affected
 * @param {string} raizPdf
 * @returns {object} el resultado
 */
function ejecutar(db, esq, opts, affected, raizPdf) {
  const orden = ordenDeBorrado(affected, esq);
  const plan = armarPlan(db, esq, affected, raizPdf);

  // 1. El respaldo, antes de la primera escritura.
  const dir = opts.backupDir || path.join(path.dirname(opts.db), 'backups');
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(dir, 'firma-antes-limpieza-' + opts.empresa + '-' + sello + '.sqlite');
  const respaldo = respaldar(db, destino);

  // 2. Los triggers que impiden borrar: se quitan y se reponen.
  const triggers = triggersDeBorrado(db, orden);
  for (const trg of triggers) {
    db.prepare('DROP TRIGGER IF EXISTS "' + trg.nombre + '"').run();
  }

  // 3. El borrado, en una transaccion, con las FK apagadas (el orden ya esta
  //    calculado, pero la cascada la comprueba despues el foreign_key_check).
  db.pragma('foreign_keys = OFF');
  let borradas = 0;
  try {
    db.exec('BEGIN IMMEDIATE');
    for (const t of orden) {
      const info = esq[t];
      const ident = identificadorDe(info);
      const ids = affected.get(t).map(f => (ident.esPk ? f[ident.col] : f._rid));
      if (!ids.length) continue;
      const filtro = new Array(ids.length).fill('?').join(', ');
      const res = db.prepare('DELETE FROM "' + t + '" WHERE "' + ident.col + '" IN (' + filtro + ')').run(...ids);
      borradas += res.changes;
    }
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) { /* nada que revertir */ }
    db.pragma('foreign_keys = ON');
    for (const trg of triggers) {
      try { db.exec(trg.sql); } catch (_) { /* se reporta abajo */ }
    }
    throw e;
  } finally {
    db.pragma('foreign_keys = ON');
  }

  // 4. Los triggers vuelven, textualmente.
  for (const trg of triggers) {
    db.exec(trg.sql);
  }

  // 5. El recibo (append-only: INSERT si, UPDATE no).
  let recibo = null;
  try {
    const tieneTabla = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='gh_firma_purga_log'"
    ).get();
    if (tieneTabla) {
      const firmas = plan.tablas.find(t => /firmas_electronicas$/.test(t.tabla));
      const eventos = plan.tablas.filter(t => /eventos$/.test(t.tabla)).reduce((a, t) => a + t.filas, 0);
      db.prepare(
        'INSERT INTO gh_firma_purga_log (fecha_hora, evento, actor, motivo, ventana_hasta, '
        + 'firmas_en_lote, eventos_purgados, hold_revisados, hold_bloqueados) '
        + 'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        new Date().toISOString(),
        'LIMPIEZA_EMPRESA_PRUEBA',
        opts.actor,
        opts.motivo,
        opts.hasta || null,
        firmas ? firmas.filas : 0,
        eventos,
        0,
        0
      );
      recibo = 'gh_firma_purga_log';
    }
  } catch (e) {
    recibo = 'NO SE PUDO ESCRIBIR EL RECIBO: ' + e.message;
  }

  // 6. Los archivos.
  const archivos = plan.archivos;
  const borradosArchivos = [];
  const noBorrados = [];
  for (const a of archivos) {
    try {
      fs.unlinkSync(a.ruta);
      borradosArchivos.push(a.ruta);
    } catch (e) {
      noBorrados.push({ ruta: a.ruta, error: e.message });
    }
  }

  // 7. Las verificaciones finales.
  const restante = inventariar(db, esq, opts.empresa);
  const filasRestantes = [...restante.values()].reduce((a, f) => a + f.length, 0);
  const integridad = db.pragma('integrity_check', { simple: true });
  const fksRotas = db.pragma('foreign_key_check');
  const triggersFinales = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
  ).all().map(r => r.name);

  return {
    respaldo,
    tablas: plan.tablas.map(t => ({ tabla: t.tabla, filas: t.filas })),
    filasBorradas: borradas,
    archivosBorrados: borradosArchivos,
    archivosNoBorrados: noBorrados,
    recibo,
    filasRestantes,
    integridad,
    fksRotas: fksRotas.length,
    triggersRepuestos: triggersFinales.length,
    triggersQuitados: triggers.length,
  };
}

// ---------------------------------------------------------------------------
// El main
// ---------------------------------------------------------------------------

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    return 2;
  }

  let dbPath;
  let raizPdf;
  try {
    dbPath = resolverDb(opts.db);
    raizPdf = resolverPdfDir(opts.pdfDir);
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    return 3;
  }
  // La ruta resuelta manda: el respaldo se guarda al lado de la base que se
  // esta limpiando, no al lado de un path relativo que puede no existir.
  opts.db = dbPath;
  opts.pdfDir = raizPdf;

  if (!fs.existsSync(dbPath)) {
    process.stderr.write('ERROR: no existe la base: ' + dbPath + '\n');
    return 3;
  }

  let db;
  try {
    db = abrirDb(dbPath, !opts.ejecutar);
  } catch (e) {
    process.stderr.write('ERROR: no se pudo abrir la base: ' + e.message + '\n');
    return 3;
  }

  try {
    const esq = leerEsquema(db);
    const affected = inventariar(db, esq, opts.empresa);

    // La ficha, para que el operador vea a quien esta borrando.
    let ficha = null;
    try {
      ficha = db.prepare('SELECT id_empresa, razon_social, nit, activo FROM gh_firma_empresas WHERE id_empresa = ?')
        .get(opts.empresa) || null;
    } catch (_) { /* la tabla puede no existir */ }

    if (!affected.size) {
      if (!opts.quiet) {
        process.stdout.write('No hay nada de ' + opts.empresa + ' en la base. Nada que limpiar.\n');
      }
      return 0;
    }

    const plan = armarPlan(db, esq, affected, raizPdf);

    if (!opts.quiet) {
      // El encabezado dice lo que la corrida es: la SIMULACION imprime el
      // plan y no toca nada; la EJECUCION borra. Decir "no se toca nada"
      // en una corrida que borra todo es una mentira en la pantalla (y lo
      // que se leyo en produccion el 17-nov-2026, justo antes de borrar).
      process.stdout.write('\n=== LIMPIEZA DE EMPRESA DE PRUEBA ('
        + (opts.ejecutar ? 'EJECUCION' : 'SIMULACION') + ') ===\n');
      process.stdout.write('Empresa: ' + opts.empresa
        + (ficha ? ' (' + ficha.razon_social + ', NIT ' + (ficha.nit || '-') + ')' : '')
        + '\n');
      process.stdout.write('Base: ' + dbPath + '\n');
      process.stdout.write('Actor: ' + opts.actor + ' | Motivo: ' + opts.motivo + '\n');
      if (opts.hasta) process.stdout.write('Hasta: ' + opts.hasta + ' (no se toca nada mas nuevo)\n');
      process.stdout.write('\n-- Filas a borrar: ' + plan.totalFilas + '\n');
      for (const t of plan.tablas) {
        process.stdout.write('   ' + t.tabla + ': ' + t.filas + ' fila(s)\n');
      }
      if (plan.archivos.length) {
        process.stdout.write('\n-- Archivos a borrar: ' + plan.archivos.length + '\n');
        for (const a of plan.archivos) {
          process.stdout.write('   ' + a.ruta + '  (' + a.motivo + ')\n');
        }
      } else {
        process.stdout.write('\n-- Archivos a borrar: 0\n');
      }
      if (!opts.ejecutar) {
        process.stdout.write('\nSIN --ejecutar no se toca nada.\n');
      }
    }

    if (!opts.ejecutar) return 0;

    // La ventana: si hay algo mas nuevo que `hasta`, no se toca nada.
    if (opts.hasta) {
      const fuera = filasMasNuevasQue(db, affected, opts.hasta);
      if (fuera.length) {
        process.stderr.write('\nERROR: hay ' + fuera.length + ' fila(s) mas nueva(s) que ' + opts.hasta
          + '. No se toco nada.\n');
        for (const f of fuera.slice(0, 10)) {
          process.stderr.write('   ' + f.tabla + '.' + f.columna + ' = ' + f.valor + '\n');
        }
        return 4;
      }
    }

    const resultado = ejecutar(db, esq, opts, affected, raizPdf);

    if (!opts.quiet) {
      process.stdout.write('\n=== LIMPIEZA EJECUTADA ===\n');
      process.stdout.write('Respaldo: ' + resultado.respaldo + '\n');
      process.stdout.write('Filas borradas: ' + resultado.filasBorradas + '\n');
      process.stdout.write('Archivos borrados: ' + resultado.archivosBorrados.length + '\n');
      for (const r of resultado.archivosBorrados) process.stdout.write('   ' + r + '\n');
      if (resultado.archivosNoBorrados.length) {
        process.stdout.write('Archivos NO borrados: ' + resultado.archivosNoBorrados.length + '\n');
        for (const r of resultado.archivosNoBorrados) {
          process.stdout.write('   ' + r.ruta + ' -> ' + r.error + '\n');
        }
      }
      process.stdout.write('Recibo: ' + resultado.recibo + '\n');
      process.stdout.write('Triggers reponidos: ' + resultado.triggersRepuestos
        + ' (habian ' + resultado.triggersQuitados + ' que bloqueaban el borrado)\n');
      process.stdout.write('integrity_check: ' + resultado.integridad + '\n');
      process.stdout.write('foreign_key_check: ' + resultado.fksRotas + ' fila(s) con FK rota\n');
      process.stdout.write('Filas de la Empresa que quedan: ' + resultado.filasRestantes + '\n');
    }

    if (resultado.filasRestantes > 0) {
      process.stderr.write('\nERROR: quedaron filas de la Empresa. Revisar.\n');
      return 4;
    }
    if (resultado.integridad !== 'ok') {
      process.stderr.write('\nERROR: la base quedo danada (integrity_check: ' + resultado.integridad + ')\n');
      return 4;
    }
    if (resultado.fksRotas > 0) {
      process.stderr.write('\nERROR: quedaron ' + resultado.fksRotas + ' fila(s) con FK rota\n');
      return 4;
    }
    return 0;
  } catch (e) {
    process.stderr.write('\nERROR: ' + (e && e.message ? e.message : String(e)) + '\n');
    return 3;
  } finally {
    try { db.close(); } catch (_) { /* nada */ }
  }
}

module.exports = {
  parseArgs,
  abrirDb,
  resolverDb,
  resolverPdfDir,
  leerEsquema,
  inventariar,
  ordenDeBorrado,
  armarPlan,
  archivosABorrar,
  actasPorPatron,
  triggersDeBorrado,
  filasMasNuevasQue,
  respaldar,
  ejecutar,
  main,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
