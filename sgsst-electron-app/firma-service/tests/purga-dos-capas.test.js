/**
 * LA PURGA EN DOS CAPAS (10.6 · el 8.6)
 * ======================================
 *
 * EL BUG QUE ESTE ARCHIVO EXISTE PARA ATRAPAR
 * --------------------------------------------
 * `scripts/purga-ventana.js` es el ejecutor de la supresión de datos vencidos.
 * Su guion dice, textualmente:
 *
 *   "Capa 1: el registro de auditoría."
 *   "Capa 2: la fila y los archivos. Se hace dentro de la misma ventana y
 *    sobre el mismo lote, y vuelve a comprobar el hold de cada firma."
 *
 * Pero `conservacion.purgar()` (la capa 1) cerraba la ventana de purga y
 * vaciaba el lote al terminar. La capa 2 (`supresion.suprimir()`) exige una
 * ventana vigente y un lote armado: `ventanaVigente()` devolvía null y la
 * operación moría con "No hay ventana de purga abierta", con exit code 3.
 *
 * QUÉ SIGNIFICABA ESO
 * -------------------
 * La capa 2 es la que borra el documento, la constancia y los archivos, y la
 * que escribe la LÁPIDA (`gh_firma_purgadas`) con la que un enlace ya
 * suprimido responde 410 CONSERVACION_VENCIDA. O sea: la capa 2 NUNCA se
 * ejecutó en producción. Las firmas vencidas seguían con su PDF original, su
 * PDF firmado y su constancia en el disco, y la tabla de lápidas estaba
 * vacía.
 *
 * Esto no era un detalle del texto de la v1.1: es un incumplimiento del 8.6
 * y del 10.6 de la v1.0 VIGENTE, la que ya está publicada y sellada.
 *
 * LO QUE COMPRUEBAN ESTOS TESTS
 * -------------------------------
 *   1. La operación corre las DOS capas: la fila y los archivos se suprimen.
 *   2. La MUTACIÓN: con el comportamiento viejo (la capa 1 cierra la
 *      ventana), la capa 2 no puede correr. Si el arreglo se degrada, el
 *      test falla: no es un test que dice "todo bien" sin comprobar nada.
 *   3. El guion de `scripts/purga-ventana.js` (el de verdad, no una copia)
 *      corre las dos capas.
 *   4. La ventana queda cerrada y el lote vacío al terminar.
 *   5. La operación deja la evidencia del 3.6(g): la lápida con la
 *      solicitud y el fundamento del plazo, y el recibo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const db = require('../src/db/connection');
const conservacion = require('../src/services/conservacion');
const supresion = require('../src/services/supresion');
const script = require('../scripts/purga-ventana');
const { resetDb, createSignRequestWithIdentificacion } = require('./helpers');

const HORA = 3600 * 1000;

/**
 * Crea una firma vencida, sin hold y con los tres archivos en disco.
 *
 * @returns {Promise<object>} el token, la fila de la solicitud y las rutas
 */
async function setupVencida() {
  const { token, signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: '1234567890',
    id_empresa: '900123456',
    identificacion_numero: '1234567890',
  });

  const storage = require('../src/services/storage');
  const paths = [];
  for (const nombre of ['original', 'firmado', 'constancia']) {
    const p = storage.PATHS.pdfs + '/test-dos-capas-' + nombre + '-' + signRequest.id + '.pdf';
    fs.mkdirSync(require('node:path').dirname(p), { recursive: true });
    fs.writeFileSync(p, '%PDF-1.4\n%%EOF\n');
    paths.push(p);
  }

  const ahora = Date.now();
  db.prepare(`
    UPDATE gh_firmas_electronicas
       SET estado = 'SIGNED',
           fecha_firma = ?,
           fecha_conservacion = ?,
           fecha_expiracion = ?,
           hold_legal = 0,
           motivo_hold = NULL,
           pdf_original_path = ?,
           pdf_firmado_path = ?,
           constancia_path = ?
     WHERE id = ?
  `).run(
    new Date(ahora).toISOString(),
    new Date(ahora - 24 * HORA).toISOString(),
    new Date(ahora + 48 * HORA).toISOString(),
    paths[0], paths[1], paths[2],
    signRequest.id
  );

  return { token, signRequest, paths };
}

/**
 * El guion de la operación, tal como lo ejecuta el script.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.cerrarEnCapa1] - el comportamiento VIEJO: la capa 1
 *   cierra la ventana. Con esto, la capa 2 no puede correr.
 */
function purgarComoElScript({ cerrarEnCapa1 = false } = {}) {
  conservacion.abrirVentana({
    actor: 'operador', motivo: 'Vencimiento del plazo declarado', minutos: 15,
  });
  const lote = conservacion.armarLote({
    actor: 'operador', motivo: 'Vencimiento del plazo declarado',
  });
  const auditoria = conservacion.purgar(
    cerrarEnCapa1 ? { actor: 'operador' } : { actor: 'operador', cerrar: false }
  );
  const datos = supresion.suprimir({
    actor: 'operador',
    motivo: 'Vencimiento del plazo declarado',
    dryRun: false,
  });
  if (!cerrarEnCapa1) conservacion.cerrarVentana({ actor: 'operador' });
  return { lote, auditoria, datos };
}

// =========================================================================
// 1. La operación corre las DOS capas
// =========================================================================

test('purga · la capa 2 sí corre: la fila y los archivos se suprimen', async () => {
  resetDb();
  const { signRequest, paths } = await setupVencida();

  const { auditoria, datos } = purgarComoElScript();

  assert.equal(auditoria.firmas, 1, 'la capa 1 suprime el registro de auditoría');
  assert.equal(auditoria.eventos_purgados, 1, 'los eventos de auditoría se borran');

  assert.equal(datos.firmas, 1,
    'la capa 2 DEBE suprimir la fila de la firma: si esto es 0, la ventana se cerró antes');
  assert.equal(datos.archivos, 3, 'los tres archivos se borran');

  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(fila, undefined, 'la fila de la firma no puede quedar');
  for (const p of paths) {
    assert.equal(fs.existsSync(p), false, 'el archivo no puede quedar: ' + p);
  }
});

test('purga · la capa 2 deja la lápida con la solicitud y el fundamento del plazo', async () => {
  resetDb();
  const { signRequest } = await setupVencida();

  purgarComoElScript();

  const lapida = db.prepare(
    'SELECT * FROM gh_firma_purgadas WHERE firma_id = ?'
  ).get(signRequest.id);
  assert.ok(lapida, 'debe haber lápida');
  assert.equal(lapida.id_solicitud, signRequest.id_solicitud,
    'el 3.6(g): la lápida identifica la solicitud');
  assert.ok(lapida.fecha_conservacion,
    'el 3.6(g): la lápida lleva el fundamento del plazo');
  assert.ok(lapida.purgado_at, 'la lápida lleva la fecha y hora');
  assert.ok(lapida.categorias, 'la lápida lleva las categorías suprimidas');

  // Y el recibo de la operación.
  const recibo = db.prepare(
    'SELECT * FROM gh_firma_purga_registro WHERE firma_id = ?'
  ).all(signRequest.id);
  assert.ok(recibo.length >= 1, 'debe haber recibo de purgas');
});

// =========================================================================
// 2. LA MUTACIÓN: el comportamiento viejo rompe la capa 2
// =========================================================================

test('purga · MUTACION: si la capa 1 cierra la ventana, la capa 2 no puede correr', async () => {
  // Este es el bug, escrito como prueba: con el comportamiento viejo, la
  // capa 2 falla. Si algún día el arreglo se degrada (alguien vuelve a
  // cerrar la ventana en la capa 1), este test es el que lo avisa.
  resetDb();
  await setupVencida();

  assert.throws(
    () => purgarComoElScript({ cerrarEnCapa1: true }),
    /ventana/i,
    'sin ventana vigente la capa 2 no puede correr: ese era el bug'
  );

  // Y la consecuencia: la fila y los archivos siguen ahí.
  const firma = db.prepare(
    'SELECT COUNT(*) AS n FROM gh_firmas_electronicas'
  ).get();
  assert.equal(firma.n, 1, 'sin capa 2 la fila de la firma sobrevive: el 8.6 no se cumple');
});

test('purga · la capa 1 con cerrar:false deja la ventana viva y el lote armado', async () => {
  resetDb();
  await setupVencida();
  conservacion.abrirVentana({
    actor: 'operador', motivo: 'prueba', minutos: 15,
  });
  const lote = conservacion.armarLote({ actor: 'operador', motivo: 'prueba' });
  assert.equal(lote.firmas, 1, 'el lote tiene que tener la firma vencida');

  conservacion.purgar({ actor: 'operador', cerrar: false });

  assert.ok(conservacion.ventanaVigente(),
    'la ventana tiene que seguir viva: la capa 2 corre en ella');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n, 1,
    'el lote tiene que seguir armado: la capa 2 corre sobre él'
  );

  // Y sin la opción, el comportamiento de siempre: la ventana se cierra.
  conservacion.purgar({ actor: 'operador' });
  assert.equal(conservacion.ventanaVigente(), null,
    'sin la opción, la capa 1 cierra la ventana como antes');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n, 0,
    'y el lote se vacía'
  );
});

// =========================================================================
// 3. EL GUION REAL DEL SCRIPT
// =========================================================================

test('purga · el guion del script suprime las dos capas y sale con codigo 0', async () => {
  resetDb();
  const { signRequest, paths } = await setupVencida();

  let salida = '';
  const codigo = script.main(
    ['--actor=operador', '--motivo=Vencimiento del plazo declarado', '--ejecutar'],
    { write: (t) => { salida += String(t); } }
  );

  assert.equal(codigo, 0, 'el guion tiene que salir con 0: ' + salida);
  // Se busca el fragmento sin acentos: el texto del script escribe
  // "SUPPRESIÓN" con doble P y comparar acentos es una fuente tonta de
  // falsos negativos. Lo que importa son las cifras de abajo.
  assert.match(salida, /EJECUTADA/);
  assert.match(salida, /filas suprimidas:\s+1/,
    'la capa 2 tiene que haber corrido: ' + salida);
  assert.match(salida, /archivos eliminados:\s+3/);
  assert.match(salida, /Simulación de la capa de datos: 1 firmas, 3 archivos/,
    'la simulación tiene que decir lo que va a pasar: ' + salida);

  // El efecto real.
  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id);
  assert.equal(fila, undefined, 'la fila de la firma no puede quedar');
  for (const p of paths) {
    assert.equal(fs.existsSync(p), false, 'el archivo no puede quedar: ' + p);
  }

  // Y la evidencia.
  const lapida = db.prepare(
    'SELECT * FROM gh_firma_purgadas WHERE firma_id = ?'
  ).get(signRequest.id);
  assert.ok(lapida, 'debe haber lápida');
  assert.equal(lapida.id_solicitud, signRequest.id_solicitud);
});

test('purga · el guion sin --ejecutar no borra nada', async () => {
  resetDb();
  const { signRequest, paths } = await setupVencida();

  let salida = '';
  const codigo = script.main(
    ['--actor=operador', '--motivo=prueba'],
    { write: (t) => { salida += String(t); } }
  );

  assert.equal(codigo, 0);
  assert.match(salida, /SIMULACIÓN: no se borró nada/);
  assert.ok(
    db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?').get(signRequest.id),
    'la simulación no puede borrar la fila'
  );
  for (const p of paths) {
    assert.ok(fs.existsSync(p), 'la simulación no puede borrar los archivos');
  }
});

test('purga · sin --actor el guion se rechaza con codigo 2', () => {
  resetDb();
  const codigo = script.main(['--motivo=prueba'], { write: () => {} });
  assert.equal(codigo, 2);
});

test('purga · el guion cierra la ventana y deja el lote vacío', async () => {
  resetDb();
  await setupVencida();

  script.main(
    ['--actor=operador', '--motivo=Vencimiento del plazo declarado', '--ejecutar'],
    { write: () => {} }
  );

  assert.equal(conservacion.ventanaVigente(), null, 'la ventana tiene que quedar cerrada');
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM gh_firma_purga_lote').get().n, 0,
    'el lote tiene que quedar vacío'
  );
});
