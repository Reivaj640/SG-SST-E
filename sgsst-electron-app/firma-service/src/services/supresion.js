/**
 * SUPRESIÓN DE DATOS (la "5B")
 * =============================
 *
 * PARA QUÉ
 * --------
 * La capa de conservación (servicio `conservacion.js`) borra el REGISTRO DE
 * AUDITORÍA de las firmas vencidas. Eso destruye la prueba y conserva el dato:
 * exactamente lo contrario de lo que ordenan el numeral 8.6 y el 10.6 del
 * Acuerdo de uso ("Vencido ese plazo y sin que exista un deber legal o
 * contractual de conservación, el dato se suprime").
 *
 * Este módulo suprime la CAPA DE DATOS: la fila completa de la firma y los
 * archivos que la acompañaban (el PDF original, el PDF firmado y la
 * constancia). Y lo hace dentro del mismo gobierno de la ventana y el lote,
 * de modo que el alcance es exactamente el mismo que el de la capa de
 * auditoría y ninguna firma entra o sale sin que el actor lo haya declarado.
 *
 * EL ORDEN DE LAS COSAS
 * ---------------------
 * 1. SE BORRAN LOS ARCHIVOS PRIMERO. El archivo ES el dato personal: el
 *    documento firmado y la constancia que lo acredita. Si la parte de base de
 *    datos falla después, el archivo ya no está (que es lo que se pedía) y la
 *    fila queda apuntando a un archivo que no existe: la reintento es segura
 *    porque borrar un archivo que no está no falla.
 * 2. DESPUÉS, EN UNA TRANSACCIÓN, se borra la fila, sus eventos hijos (la
 *    llave foránea lo exige) y se escribe la lápida.
 *
 * IDEMPOTENCIA
 * ------------
 * Correr dos veces no rompe nada: la segunda pasada no encuentra la fila (ya
 * está) y no escribe una segunda lápida. Un archivo que ya no está cuenta
 * como cero, no como error.
 *
 * EL HOLD LEGAL
 * -------------
 * Una firma con deber legal o contractual de conservación NO se suprime: se
 * conserva. El trigger de la migración 020 ya se niega a borrarla; el
 * servicio lo comprueba otra vez antes de tocar nada (cinturón y tirantes).
 *
 * LA COPIA PENDIENTE
 * ------------------
 * El 8.6(e)(iii) pone una cuarta condición: la supresión procede solo cuando
 * NO hay solicitud de copia pendiente. Y el 8.6(f) manda que la solicitud "se
 * registra y se atiende antes de cualquier supresión". Mientras la Empresa
 * tenga una copia pendiente, esta supresión no toca nada de esa empresa.
 *
 * QUÉ SOBREVIVE
 * -------------
 * La fila de la firma se borra entera. Sobrevive:
 *
 *   - La PRUEBA DE LA ACEPTACIÓN, que vive en `gh_consentimientos_firma` y no
 *     tiene llave foránea contra la firma. Es donde el 12.7 deja la prueba de
 *     que el trabajador aceptó el Acuerdo (versión, huella del texto, fecha y
 *     hora e identificador de la solicitud).
 *   - La LÁPIDA (`gh_firma_purgadas`), que dice qué se suprimió, por qué, por
 *     quién y cuándo. Sin datos personales.
 *   - El recibo de purgas (`gh_firma_purga_registro`), append-only.
 *
 * La lápida NO guarda el hash del token (que es la credencial del enlace):
 * guarda un HMAC con propósito propio sobre ese hash. No sirve para
 * autenticarse ni para resolver nada; solo permite que el sistema responda
 * "no disponible por vencimiento del plazo" en vez de un 404 que no dice por
 * qué.
 */
'use strict';

const db = require('../db/connection');
const storage = require('./storage');
const logger = require('../utils/logger');
const path = require('path');
const { hashTokenTombstone } = require('../crypto/token');
const { esElegible, ventanaVigente } = require('./conservacion');
// El 8.6(e)(iii): la supresión no procede con una solicitud de copia
// pendiente. La consulta vive en el módulo que es dueño de la tabla.
const { tieneCopiaPendiente } = require('./solicitudes');

/**
 * Las categorías de dato que la supresión se lleva. Es lo que se escribe en
 * el recibo: qué se suprimió, sin decir QUIÉN era el titular.
 */
const CATEGORIAS_DATOS = [
  'fila_firma',
  'pdf_original',
  'pdf_firmado',
  'constancia',
  'registro_auditoria',
  'archivos',
];

/**
 * Las columnas de la fila que son datos personales o derivados de ellos.
 * Se documentan aquí para que la lista y el borrado no se separen nunca.
 */
const COLUMNAS_PERSONALES = [
  'correo_verificacion',
  'correo_hash',
  'identificacion_numero_hash',
  'otp_hash',
  'otp_sal',
  'manifestacion_voluntad_texto',
  'metadata',
  'pdf_original_path',
  'pdf_firmado_path',
  'constancia_path',
  'ip_origen',
  'user_agent',
];

/**
 * Las firmas que la supresión tocaría: las del lote abierto, revalidando el
 * hold y el plazo en el momento (nada de confiar en el lote: el estado pudo
 * cambiar entre que se armó y ahora).
 *
 * LA COPIA PENDIENTE TAMBIÉN SE REVALIDA AQUÍ (el 8.6(e)(iii))
 * -----------------------------------------------------------
 * "La supresión procede solo cuando concurren: (i) vencimiento del plazo
 * aplicable; (ii) ausencia de deber legal o contractual de conservación;
 * (iii) ausencia de solicitud de copia pendiente; y (iv) ausencia de hold
 * vigente."
 *
 * Se revalida aquí, y no solo al armar el lote, por una razón concreta: una
 * solicitud de copia puede LLEGAR DESPUÉS de que el lote se armó. Si la
 * condición se comprobara solo al armar el lote, una copia registrada a mitad
 * de camino se purgaría igual. `esElegible` ya la mira; el chequeo explícito
 * de abajo es el cinturón y los tirantes: el 8.6(f) manda que la solicitud
 * "se atiende antes de cualquier supresión", y esta es la supresión que
 * borra los datos.
 *
 * @param {number|null} [id_empresa] - filtra por empresa
 * @returns {{lista: object[], bloqueadasPorCopia: number[]}}
 */
function elegiblesConDetalle(id_empresa) {
  const lote = db.prepare('SELECT firma_id FROM gh_firma_purga_lote ORDER BY firma_id').all();
  const lista = [];
  const bloqueadasPorCopia = [];
  for (const { firma_id } of lote) {
    const f = db.prepare(
      'SELECT id, id_solicitud, id_empresa, estado, fecha_conservacion, hold_legal, '
      + 'token_hash, pdf_original_path, pdf_firmado_path, constancia_path '
      + 'FROM gh_firmas_electronicas WHERE id = ?'
    ).get(firma_id);
    if (!f) continue;
    if (id_empresa && f.id_empresa !== id_empresa) continue;
    // El 8.6(e)(iii): con una solicitud de copia pendiente, no se suprime.
    // La firma queda CONTADA aparte para que el informe diga POR QUÉ no se
    // suprimió nada: no suprimir en silencio es media garantía.
    if (tieneCopiaPendiente(f.id_empresa)) {
      bloqueadasPorCopia.push(f.id);
      continue;
    }
    if (!esElegible(f)) continue;
    lista.push(f);
  }
  return { lista, bloqueadasPorCopia };
}

/**
 * Las firmas que la supresión tocaría.
 *
 * @param {number|null} [id_empresa] - filtra por empresa
 * @returns {object[]} filas elegibles
 */
function elegibles(id_empresa) {
  return elegiblesConDetalle(id_empresa).lista;
}

/**
 * Los archivos de una firma que la supresión se llevaría.
 *
 * @param {object} f - fila de la firma
 * @returns {string[]} rutas existentes
 */
function archivosDe(f) {
  const rutas = [f.pdf_original_path, f.pdf_firmado_path, f.constancia_path]
    .filter((p) => typeof p === 'string' && p.length > 0);
  return rutas.filter((p) => storage.exists(p));
}

/**
 * La ruta de un archivo COMO LA GUARDA EL TARBALL DE STORAGE.
 *
 * El numeral 8.7 dice que la supresión "alcanza a los respaldos". Para que el
 * script de purga (que corre como root y descifra las copias) pueda SACAR el
 * PDF del tarball, la fila de la cola tiene que guardar el NOMBRE DEL MIEMBRO
 * del tar, que es la ruta relativa a la raíz del servidor (`storage/pdfs/...`),
 * NO la ruta absoluta del archivo en la base viva.
 *
 * El tar se hace con `tar -C /opt/kair-firma ... storage`, así que sus
 * miembros empiezan por `storage/`. Por eso se busca ese segmento: funciona
 * igual en desarrollo y en produccion, y no depende de como este configurado
 * PDF_STORAGE_PATH. Si el archivo no estuviera bajo un directorio `storage`,
 * se devuelve el nombre suelto: el script tiene un respaldo por nombre base.
 *
 * @param {string} ruta - ruta absoluta del archivo
 * @returns {string} la ruta como miembro del tarball
 */
function rutaEnTARBALL(ruta) {
  if (typeof ruta !== 'string' || !ruta) return null;
  const normalizada = ruta.replace(/\\/g, '/');
  const i = normalizada.lastIndexOf('/storage/');
  if (i >= 0) return normalizada.slice(i + 1);
  if (normalizada.startsWith('storage/')) return normalizada;
  return path.basename(normalizada);
}

/**
 * SIMULACIÓN: qué se suprimiría, sin suprimir nada.
 *
 * Es el modo por defecto. Nada se borra, nada se escribe: solo se informa.
 *
 * @param {object} [opts]
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @returns {object} el informe
 */
function simular(opts = {}) {
  const { lista: firmas, bloqueadasPorCopia } = elegiblesConDetalle(opts.id_empresa);
  const sim = simularFirmas(firmas);
  sim.copia_bloqueadas = bloqueadasPorCopia.length;
  return sim;
}

/**
 * La simulación de la capa de datos sobre una lista de firmas dada.
 *
 * QUÉ HACE DISTINTO A `simular()`
 * --------------------------------
 * `simular()` lee el LOTE. El lote existe solo cuando ya se abrió la ventana
 * de purga, así que antes de abrirla `simular()` siempre devolvía cero: el
 * script de purga le mostraba al operador "Simulación de la capa de datos: 0
 * firmas, 0 archivos" y un segundo después suprimía una firma y tres
 * archivos. Una simulación que no dice lo que va a pasar es peor que no
 * tenerla: hace creer que no hay nada que hacer.
 *
 * Esta función simula sobre las mismas firmas que el lote va a contener (las
 * vencidas y elegibles), sin que la ventana tenga que estar abierta.
 *
 * @param {object[]} firmas - las filas de la firma a simular
 * @returns {object} el informe de lo suprimido
 */
function simularFirmas(firmas) {
  const lista = Array.isArray(firmas) ? firmas : [];
  const detalle = lista.map((f) => ({
    firma_id: f.id,
    id_solicitud: f.id_solicitud,
    id_empresa: f.id_empresa,
    archivos: archivosDe(f).length,
    categorias: CATEGORIAS_DATOS.slice(),
  }));
  return {
    simulacion: true,
    firmas: detalle.length,
    archivos: detalle.reduce((n, d) => n + d.archivos, 0),
    detalle,
    categorias: CATEGORIAS_DATOS.slice(),
    // Las frenadas por una copia pendiente no entran en la lista: son las que
    // el 8.6(e)(iii) saca del lote. La cuenta la pone quien arma el lote.
    copia_bloqueadas: 0,
  };
}

/**
 * SUPRESIÓN REAL.
 *
 * Exige ventana abierta y lote armado: sin eso no se suprime nada. Es el
 * mismo gobierno que usa la capa de auditoría.
 *
 * @param {object} opts
 * @param {string} opts.actor - QUIÉN suprime (obligatorio, queda en la lápida)
 * @param {string} opts.motivo - POR QUÉ (obligatorio, queda en la lápida)
 * @param {boolean} [opts.dryRun=true] - si es true, solo informa
 * @param {string} [opts.id_empresa] - filtra por empresa
 * @returns {object} el informe de lo suprimido
 */
function suprimir(opts = {}) {
  const actor = String(opts.actor || '').trim();
  const motivo = String(opts.motivo || '').trim();
  const dryRun = opts.dryRun !== false;

  if (!actor) throw new Error('La supresión necesita un actor.');
  if (!motivo) throw new Error('La supresión necesita un motivo.');

  if (dryRun) {
    const sim = simular({ id_empresa: opts.id_empresa });
    logger.info('Supresión de datos SIMULADA', {
      actor, firmas: sim.firmas, archivos: sim.archivos,
    });
    return sim;
  }

  const ventana = ventanaVigente();
  if (!ventana) throw new Error('No hay ventana de purga abierta.');
  const lote = db.prepare('SELECT firma_id FROM gh_firma_purga_lote ORDER BY firma_id').all();

  // Lote vacío no es un error: es que no hay nada elegible. Puede pasar por
  // dos razones equivalentes: nunca se armó el lote, o todas las firmas
  // candidatas están en hold legal (y el hold las frena). En los dos casos
  // la respuesta es la misma y es la correcta: no se suprime nada.
  if (!lote.length) {
    return {
      simulacion: false,
      firmas: 0,
      archivos: 0,
      hold_bloqueados: 0,
      copia_bloqueadas: 0,
      nada_que_suprimir: true,
      categorias: CATEGORIAS_DATOS.slice(),
    };
  }

  const { lista: firmas, bloqueadasPorCopia } = elegiblesConDetalle(opts.id_empresa);
  const bloqueadas = lote.length - firmas.length;

  let archivosEliminados = 0;
  let firmasSuprimidas = 0;

  for (const f of firmas) {
    // 1. LOS ARCHIVOS PRIMERO. El archivo es el dato.
    const rutas = archivosDe(f);
    for (const ruta of rutas) {
      if (storage.deletePdf(ruta)) archivosEliminados++;
    }

    // 2. LA BASE, EN UNA TRANSACCIÓN.
    const tx = db.transaction(() => {
      // Los tokens de la firma (8C). Se leen ANTES de borrar la fila: la
      // llave foránea se los lleva con ella (ON DELETE CASCADE), y la lápida
      // los necesita para cubrirlos a todos.
      const tokensFirma = db.prepare(
        'SELECT token_hash FROM gh_firma_tokens WHERE firma_id = ?'
      ).all(f.id).map(t => t.token_hash);
      const hashes = [...new Set([f.token_hash, ...tokensFirma].filter(Boolean))];

      // Las llaves foráneas exigen borrar a los hijos antes que al padre.
      // Los tres: los eventos (la prueba), las sesiones (ip, user-agent y
      // metadatos de sesión) y la entrada del lote (la propia ventana).
      db.prepare('DELETE FROM gh_firma_eventos WHERE firma_id = ?').run(f.id);
      db.prepare('DELETE FROM gh_firma_sesiones WHERE firma_id = ?').run(f.id);
      db.prepare('DELETE FROM gh_firma_purga_lote WHERE firma_id = ?').run(f.id);

      // La firma dual tiene una fila hija que apunta a la misma solicitud.
      db.prepare('DELETE FROM gh_firmas_electronicas WHERE parent_id_solicitud = ?').run(f.id_solicitud);

      const r = db.prepare('DELETE FROM gh_firmas_electronicas WHERE id = ?').run(f.id);
      if (r.changes === 0) return false; // ya no estaba: idempotencia

      // EL 8.7: LA SUPRESION ALCANZA A LOS RESPALDOS (migracion 046).
      //
      // El servicio corre como `kairfirma` y el script que descifra y
      // re-cifra las copias corre como root: el uno no puede tocar las copias
      // y el otro no sabe que hay que purgar. Esta cola es el paso intermedio.
      //
      // Va DENTRO de esta transaccion, y no en un archivo aparte, a proposito:
      // si la escritura de la solicitud de purga quedara FUERA de la
      // transaccion, una caida entre el COMMIT (la fila ya borrada) y la
      // escritura dejaria el dato suprimido en los respaldos para siempre, y
      // en silencio. Con la tabla, o se borra la fila y queda la solicitud, o
      // no se borra nada.
      //
      // `archivos` guarda la ruta como la tiene el tarball de storage
      // (`storage/pdfs/...`), que es como el script puede sacar el PDF del
      // tar sin adivinar.
      const archivosEnTARBALL = rutas
        .map((p) => rutaEnTARBALL(p))
        .filter((p) => typeof p === 'string' && p.length > 0);
      db.prepare(`
        INSERT INTO gh_firma_purgas_pendientes
          (firma_id, id_empresa, id_solicitud, categorias, archivos,
           purgado_at, actor, motivo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        f.id,
        f.id_empresa || null,
        f.id_solicitud || null,
        JSON.stringify(CATEGORIAS_DATOS),
        JSON.stringify(archivosEnTARBALL),
        new Date().toISOString(),
        actor,
        motivo
      );

      // La lápida. Sin datos personales y sin la credencial: un HMAC con
      // propósito propio sobre el hash de cada token.
      //
      // Se guarda la marca de TODOS los tokens de la firma (8C): el original
      // y sus rotaciones. Si solo se guardara el original, un enlace rotado
      // respondería "no disponible" (404) en vez de "no disponible por
      // vencimiento del plazo" (410), y la respuesta dependería de por dónde
      // se entrara. Una lápida, una respuesta.
      const tombstones = hashes.map(h => hashTokenTombstone(h));
      // `token_hash` es NOT NULL en el esquema, así que siempre hay al menos
      // una marca. El respaldo (la marca de una cadena vacía) no puede
      // coincidir con ningún candidato real: es solo para que la transacción
      // no reviente por un NOT NULL.
      const principal = tombstones[0] || hashTokenTombstone('');
      db.prepare(`
        INSERT INTO gh_firma_purgadas
          (firma_id, token_tombstone, token_tombstones, id_empresa, purgado_at,
           actor, motivo, categorias, archivos_eliminados,
           id_solicitud, fecha_conservacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        f.id,
        principal,
        JSON.stringify(tombstones),
        f.id_empresa,
        new Date().toISOString(),
        actor,
        motivo,
        JSON.stringify(CATEGORIAS_DATOS),
        rutas.length,
        // El 3.6(g): la lápida "identifica la solicitud ... y el fundamento
        // del plazo". Sin estas dos columnas, una vez borrada la fila de la
        // firma la lápida no decía a qué solicitud pertenecía ni hasta qué
        // fecha estaba obligado a conservarse (migración 040).
        f.id_solicitud || null,
        f.fecha_conservacion || null
      );

      // El recibo de purgas (append-only): qué firma, qué empresa, cuándo,
      // quién, por qué, en qué ventana y qué categorías. Sin datos personales.
      //
      // El 3.6(g) y el 10.5(d): el recibo identifica la solicitud y el
      // fundamento del plazo (migración 041).
      db.prepare(`
        INSERT INTO gh_firma_purga_registro
          (firma_id, id_empresa, purgado_at, actor, motivo, ventana_hasta,
           categorias, hold_verificado, eventos_purgados,
           id_solicitud, fecha_conservacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        f.id,
        f.id_empresa,
        new Date().toISOString(),
        actor,
        motivo,
        ventana.abierta_hasta,
        'datos:' + JSON.stringify(CATEGORIAS_DATOS),
        0,
        f.id_solicitud || null,
        f.fecha_conservacion || null
      );
      return true;
    });
    if (tx()) firmasSuprimidas++;
  }

  logger.info('Supresión de datos ejecutada', {
    actor,
    firmas: firmasSuprimidas,
    archivos_eliminados: archivosEliminados,
    hold_bloqueados: bloqueadas - bloqueadasPorCopia.length,
    copia_bloqueadas: bloqueadasPorCopia.length,
  });

  return {
    simulacion: false,
    firmas: firmasSuprimidas,
    archivos: archivosEliminados,
    hold_bloqueados: bloqueadas - bloqueadasPorCopia.length,
    // El 8.6(e)(iii): cuántas quedaron afuera por una solicitud de copia
    // pendiente. El informe dice POR QUÉ no se suprimió nada.
    copia_bloqueadas: bloqueadasPorCopia.length,
    categorias: CATEGORIAS_DATOS.slice(),
  };
}

/**
 * ¿Esta marca de lápida corresponde a un token?
 *
 * @param {string} tokenTombstone - la marca guardada en la lápida
 * @param {string[]} candidatos - marcas candidatas del token
 * @returns {boolean}
 */
function esTombstone(tokenTombstone, candidatos) {
  if (!tokenTombstone || !Array.isArray(candidatos)) return false;
  return candidatos.includes(tokenTombstone);
}

/**
 * Busca la lápida de un token: si existe, esta firma se suprimió.
 *
 * @param {string[]} candidatos - marcas de lápida candidatas
 * @returns {object|null} la fila de la lápida, o null
 */
function buscarLapidada(candidatos) {
  if (!Array.isArray(candidatos) || !candidatos.length) return null;
  const marcadores = candidatos.map(() => '?').join(', ');
  const columnas = 'firma_id, id_empresa, purgado_at, actor, motivo, categorias';

  // 1. La marca principal (el token original de la firma).
  const directo = db.prepare(
    'SELECT ' + columnas + ' FROM gh_firma_purgadas WHERE token_tombstone IN (' + marcadores + ') LIMIT 1'
  ).get(...candidatos);
  if (directo) return directo;

  // 2. 8C: las marcas de los tokens rotados. La lápida guarda en
  // `token_tombstones` (JSON) la marca de TODOS los tokens de la firma, para
  // que un enlace rotado reciba la misma respuesta que el original: "no
  // disponible por vencimiento del plazo".
  try {
    return db.prepare(
      'SELECT p.firma_id, p.id_empresa, p.purgado_at, p.actor, p.motivo, p.categorias '
      + 'FROM gh_firma_purgadas p, json_each(p.token_tombstones) j '
      + 'WHERE j.value IN (' + marcadores + ') LIMIT 1'
    ).get(...candidatos) || null;
  } catch (e) {
    // Sin soporte de JSON1 o sin la columna: la marca principal basta.
    return null;
  }
}

module.exports = {
  CATEGORIAS_DATOS,
  COLUMNAS_PERSONALES,
  simular,
  simularFirmas,
  suprimir,
  esTombstone,
  buscarLapidada,
  elegibles,
};
