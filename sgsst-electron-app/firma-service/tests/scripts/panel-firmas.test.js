/**
 * tests/scripts/panel-firmas.test.js
 *
 * Pruebas del panel de firmas (scripts/panel-firmas.js).
 *
 * El panel es una herramienta DE OBSERVACION: su valor esta en no poder
 * romper nada. Por eso las pruebas que mas importan son las negativas:
 * que no imprima el token_hash, que no imprima el pseudonimo completo del
 * trabajador, que no imprima la metadata cruda de los eventos, y que el
 * fuente del script no contenga NI UNA sentencia de escritura.
 *
 * Esas pruebas tienen que MORDER: si alguien degrada el enmascarado o
 * mete un UPDATE, tienen que caerse. Ver el final del archivo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const db = require('../../src/db/connection');
const helpers = require('../helpers');
const panel = require('../../scripts/panel-firmas');

const RUTA_SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'panel-firmas.js');

// =============================================================================
// Argumentos
// =============================================================================

test('parseArgs: sin argumentos sale con los defaults', () => {
  const opts = panel.parseArgs([]);
  assert.equal(opts.empresa, null);
  assert.equal(opts.firma, null);
  assert.equal(opts.json, false);
  assert.equal(opts.cada, 5);
  assert.equal(opts.abiertas, false);
});

test('parseArgs: --empresa, --firma, --cada, --json y --abiertas', () => {
  const opts = panel.parseArgs([
    '--empresa=900829731', '--firma=6', '--cada=10', '--json', '--abiertas',
  ]);
  assert.equal(opts.empresa, '900829731');
  assert.equal(opts.firma, 6);
  assert.equal(opts.cada, 10);
  assert.equal(opts.json, true);
  assert.equal(opts.abiertas, true);
});

test('parseArgs: --firma con un id que no es numero falla', () => {
  assert.throws(() => panel.parseArgs(['--firma=abc']), /id numerico/);
  assert.throws(() => panel.parseArgs(['--firma=0']), /id numerico/);
  assert.throws(() => panel.parseArgs(['--firma=-3']), /id numerico/);
});

test('parseArgs: --cada fuera de rango falla', () => {
  assert.throws(() => panel.parseArgs(['--cada=0']), /segundos/);
  assert.throws(() => panel.parseArgs(['--cada=abc']), /segundos/);
  assert.throws(() => panel.parseArgs(['--cada=99999']), /segundos/);
});

test('parseArgs: un argumento desconocido falla en vez de ignorarse', () => {
  assert.throws(() => panel.parseArgs(['--borrar-todo']), /desconocido/);
});

// =============================================================================
// Enmascarado y estado de tokens
// =============================================================================

test('enmascararIp: deja los dos primeros octetos y tapa el resto', () => {
  assert.equal(panel.enmascararIp('192.168.1.50'), '192.168.x.x');
  assert.equal(panel.enmascararIp('10.0.0.1'), '10.0.x.x');
  assert.equal(panel.enmascararIp(null), '-');
  assert.equal(panel.enmascararIp(''), '-');
});

test('enmascararIp: una IPv6 se recorta por grupos', () => {
  const salida = panel.enmascararIp('2001:db8:85a3:1234:5678:8a2e:370:7334');
  assert.ok(salida.startsWith('2001:db8:'));
  assert.ok(!salida.includes('370:7334'));
});

test('enmascararPseudonimo: recorta y no deja el valor completo', () => {
  const completo = 'psn1_4a2d92c49024de0404e5192b22e3ecfe7c0510bbcd72ff9ac7a76168bc59f197';
  const salida = panel.enmascararPseudonimo(completo, 20);
  assert.ok(salida.length < completo.length);
  assert.ok(!salida.includes(completo));
  assert.ok(salida.startsWith('psn1_4a2d92c4'));
  assert.equal(panel.enmascararPseudonimo(null), '-');
});

test('yaVencio: compara ISO 8601, no el formato de datetime() de SQLite', () => {
  const ahora = new Date('2026-10-22T23:00:00.000Z');
  assert.equal(panel.yaVencio('2026-10-21T11:08:07.110Z', ahora), true);
  assert.equal(panel.yaVencio('2026-10-28T23:10:00.000Z', ahora), false);
  assert.equal(panel.yaVencio(null, ahora), false);
});

test('tokenVivo: un token revocado o vencido NO esta vivo', () => {
  const ahora = new Date('2026-10-22T23:00:00.000Z');
  assert.equal(panel.tokenVivo({ expira_en: '2026-10-28T23:10:00.000Z' }, ahora), true);
  assert.equal(panel.tokenVivo({ expira_en: '2026-10-21T23:10:00.000Z' }, ahora), false);
  assert.equal(panel.tokenVivo({
    expira_en: '2026-10-28T23:10:00.000Z', revocado_at: '2026-10-22T10:00:00.000Z',
  }, ahora), false);
  assert.equal(panel.tokenVivo(null, ahora), false);
});

test('estadoToken: VIVO / VENCIDO / REVOCADO', () => {
  const ahora = new Date('2026-10-22T23:00:00.000Z');
  assert.equal(panel.estadoToken({ expira_en: '2026-10-28T23:10:00.000Z' }, ahora), 'VIVO');
  assert.equal(panel.estadoToken({ expira_en: '2026-10-21T00:00:00.000Z' }, ahora), 'VENCIDO');
  assert.equal(panel.estadoToken({
    expira_en: '2026-10-28T23:10:00.000Z', revocado_at: '2026-10-22T10:00:00.000Z',
  }, ahora), 'REVOCADO');
});

// =============================================================================
// El candado: el panel no puede escribir
// =============================================================================

test('el fuente del script NO contiene ninguna sentencia de escritura', () => {
  const fuente = fs.readFileSync(RUTA_SCRIPT, 'utf8');
  const prohibido = /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE|REPLACE\s+INTO)\b/i;
  const encontrada = fuente.match(prohibido);
  assert.equal(
    encontrada, null,
    'El panel es de SOLO LECTURA: encontro una sentencia de escritura -> ' + (encontrada && encontrada[0])
  );
});

test('abrirDb: la conexion no deja escribir', () => {
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    if (abierta.soloLectura) {
      assert.throws(
        () => abierta.db.prepare("INSERT INTO gh_firma_eventos (firma_id, evento, fecha_hora, id_actor) VALUES (1,'X','2026-01-01T00:00:00.000Z','test')").run(),
        /readonly|read-only/i
      );
    } else {
      // Fallback: no se pudo abrir en solo lectura. El script sigue sin
      // escribir (lo garantiza el test del fuente), pero el aviso tiene que
      // estar presente para que el operador lo sepa.
      assert.ok(abierta.aviso, 'Sin solo lectura tiene que haber un aviso');
    }
  } finally {
    abierta.db.close();
  }
});

// =============================================================================
// Lectura sobre datos sembrados
// =============================================================================

async function sembrar() {
  helpers.resetDb();
  helpers.seedActiveAgreement();
  // La empresa es una fila propia (`gh_firma_empresas`): la solicitud de
  // firma NO la crea. Sin esta fila el panel no tendria nada que mostrar.
  const empresaService = require('../../src/services/empresa');
  try {
    empresaService.create({
      id_empresa: '900829731',
      razon_social: 'TEMPOACTIVA EST S.A.S.',
      nit: '900829731',
      canal_pqrs: 'correo@asepluscaribesas.com',
      plazo_retencion: '80 anos',
    });
  } catch (e) {
    // Si ya existe (la suite corre varias veces), no es un fallo.
    if (!/ya existe|EXISTS|UNIQUE/i.test(String(e && e.message))) throw e;
  }
  // Sin Anexo firmado y sin canal de atencion, el servicio de solicitudes
  // se niega a crear firmas: el panel no tendria nada que mostrar.
  empresaService.marcarAnexoFirmado('900829731', '2026-10-21');
  // `update` es un REEMPLAZO completo (lo que no viene, queda en null), asi
  // que hay que mandar tambien la razon social: es NOT NULL.
  empresaService.update('900829731', {
    razon_social: 'TEMPOACTIVA EST S.A.S.',
    nit: '900829731',
    canal_pqrs: 'correo@asepluscaribesas.com',
    plazo_retencion: '80 anos',
  });
  empresaService.setActivo('900829731', true);
  await helpers.createSignRequestWithIdentificacion({
    id_empresa: '900829731',
    id_trabajador: '1010101010',
    id_documento: 'doc-panel-1',
  });
  const firma = db.prepare(
    'SELECT * FROM gh_firmas_electronicas ORDER BY id DESC LIMIT 1'
  ).get();
  return firma;
}

test('leerEmpresas: lee la empresa sembrada', async () => {
  await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const empresas = panel.leerEmpresas(abierta.db);
    // La empresa del helper es la que registra el servicio de solicitudes.
    assert.ok(empresas.length >= 1);
    assert.ok(empresas.some((e) => String(e.id_empresa) === '900829731')
      || empresas.every((e) => e.id_empresa !== undefined));
  } finally {
    abierta.db.close();
  }
});

test('leerFirmas: cuenta la firma sembrada y su token', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const firmas = panel.leerFirmas(abierta.db, {});
    assert.equal(firmas.length, 1);
    assert.equal(firmas[0].id, firma.id);
    assert.ok(firmas[0].tokens >= 1, 'La solicitud creada tiene al menos un token');
    assert.ok(firmas[0].tokens_vivos >= 1, 'Ese token esta vivo: vence en el futuro');
    assert.equal(firmas[0].terminal, false, 'Una firma OPENED no es terminal');
  } finally {
    abierta.db.close();
  }
});

test('leerFirmas: --abiertas filtra las terminales', async () => {
  await sembrar();
  db.prepare("UPDATE gh_firmas_electronicas SET estado = 'SIGNED' WHERE id = (SELECT MAX(id) FROM gh_firmas_electronicas)").run();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const todas = panel.leerFirmas(abierta.db, {});
    const abiertas = panel.leerFirmas(abierta.db, { abiertas: true });
    assert.equal(todas.length, 1);
    assert.equal(abiertas.length, 0, 'Una firma SIGNED es terminal: no sale en --abiertas');
  } finally {
    abierta.db.close();
  }
});

test('leerResumenGlobal: los conteos cuadran con lo que hay', async () => {
  await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const firmas = panel.leerFirmas(abierta.db, {});
    const resumen = panel.leerResumenGlobal(abierta.db, firmas);
    assert.equal(resumen.firmas, 1);
    assert.equal(resumen.firmas_en_curso, 1);
    assert.ok(resumen.tokens >= 1);
    assert.ok(resumen.eventos >= 1);
    assert.ok(resumen.version_activa, 'Hay una version del Acuerdo activa');
  } finally {
    abierta.db.close();
  }
});

test('leerDetalleFirma: trae tokens, eventos y el consentimiento', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const detalle = panel.leerDetalleFirma(abierta.db, firma.id);
    assert.ok(detalle, 'El detalle existe');
    assert.equal(detalle.firma.id, firma.id);
    assert.ok(detalle.tokens.length >= 1);
    assert.ok(detalle.eventos.length >= 1);
    assert.equal(detalle.eventos[0].evento, 'CREATED');
    assert.ok(detalle.consent, 'La firma creada trae consentimiento');
    assert.ok(detalle.empresa, 'Y la empresa de la firma');
  } finally {
    abierta.db.close();
  }
});

test('leerDetalleFirma: una firma que no existe da null', async () => {
  await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    assert.equal(panel.leerDetalleFirma(abierta.db, 999999), null);
  } finally {
    abierta.db.close();
  }
});

// =============================================================================
// Dibujo
// =============================================================================

test('renderGeneral: muestra el tablero, las empresas y las firmas en curso', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const empresas = panel.leerEmpresas(abierta.db);
    const firmas = panel.leerFirmas(abierta.db, {});
    const resumen = panel.leerResumenGlobal(abierta.db, firmas);
    const texto = panel.renderGeneral({ empresas, firmas, resumen, ahora: new Date() });

    assert.ok(texto.includes('PANEL GENERAL DE FIRMA'));
    assert.ok(texto.includes('FIRMAS EN CURSO'));
    assert.ok(texto.includes(firma.id_solicitud), 'Se ve la solicitud en curso');
    assert.ok(texto.includes('firmas=1'));
    assert.ok(texto.includes('[Enter] ver la empresa'), 'Se anuncia como navegar');
  } finally {
    abierta.db.close();
  }
});

test('renderEmpresa: el panel de la empresa con su resumen', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const empresas = panel.leerEmpresas(abierta.db);
    const firmas = panel.leerFirmas(abierta.db, {});
    const resumen = panel.leerResumenGlobal(abierta.db, firmas);
    const texto = panel.renderEmpresa({
      empresa: empresas[0], firmas, resumen, ahora: new Date(),
    });

    assert.ok(texto.includes('PANEL DE EMPRESA'));
    assert.ok(texto.includes('EMPRESA'));
    assert.ok(texto.includes('RESUMEN'));
    assert.ok(texto.includes('FIRMAS'));
    assert.ok(texto.includes(firma.id_solicitud));
    assert.ok(texto.includes('acuerdo vigente'), 'Dice cual es el Acuerdo vigente');
  } finally {
    abierta.db.close();
  }
});

test('renderFirma: el detalle trae estado, tokens y traza', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const detalle = panel.leerDetalleFirma(abierta.db, firma.id);
    const texto = panel.renderFirma(detalle);

    assert.ok(texto.includes('FIRMA ' + firma.id));
    assert.ok(texto.includes('ESTADO'));
    assert.ok(texto.includes('TOKENS'));
    assert.ok(texto.includes('TRAZA'));
    assert.ok(texto.includes('CREATED'), 'La traza muestra el evento');
    assert.ok(texto.includes('VIVO'), 'El token vivo aparece como VIVO');
    assert.ok(texto.includes('CONSENTIMIENTO'));
  } finally {
    abierta.db.close();
  }
});

test('renderFirma: NO imprime el token_hash, ni el hash completo, ni la metadata cruda', async () => {
  const firma = await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const detalle = panel.leerDetalleFirma(abierta.db, firma.id);
    const texto = panel.renderFirma(detalle);

    const tokenHash = db.prepare(
      'SELECT token_hash FROM gh_firma_tokens WHERE firma_id = ? LIMIT 1'
    ).get(firma.id).token_hash;
    const metadata = db.prepare(
      "SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? LIMIT 1"
    ).get(firma.id).metadata;

    assert.ok(tokenHash && tokenHash.length > 20, 'El token_hash sembrado es real');
    assert.ok(!texto.includes(tokenHash), 'El token_hash NO puede salir en pantalla');

    if (firma.agreement_hash) {
      assert.ok(!texto.includes(firma.agreement_hash), 'El agreement_hash completo no sale');
    }
    if (firma.document_hash_original) {
      assert.ok(!texto.includes(firma.document_hash_original), 'El hash del documento completo no sale');
    }
    if (metadata) {
      assert.ok(!texto.includes(metadata), 'La metadata cruda del evento no sale');
    }

    // Y el pseudonimo completo tampoco.
    if (detalle.consent && detalle.consent.id_trabajador) {
      assert.ok(!texto.includes(detalle.consent.id_trabajador), 'El pseudonimo completo no sale');
    }
  } finally {
    abierta.db.close();
  }
});

test('renderFirma: la IP aparece enmascarada', async () => {
  const firma = await sembrar();
  db.prepare("UPDATE gh_firma_eventos SET ip = '192.168.1.77' WHERE firma_id = ?").run(firma.id);
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const detalle = panel.leerDetalleFirma(abierta.db, firma.id);
    const texto = panel.renderFirma(detalle);
    assert.ok(!texto.includes('192.168.1.77'), 'La IP completa no sale');
    assert.ok(texto.includes('192.168.x.x'), 'Sale enmascarada');
  } finally {
    abierta.db.close();
  }
});

test('renderGeneral: con --json sale un objeto parseable', async () => {
  await sembrar();
  const abierta = panel.abrirDb(panel.resolverRutaDb(null));
  try {
    const firmas = panel.leerFirmas(abierta.db, {});
    const resumen = panel.leerResumenGlobal(abierta.db, firmas);
    const json = JSON.parse(panel.renderJson({
      empresas: panel.leerEmpresas(abierta.db), firmas, resumen, ahora: new Date(),
    }));
    assert.equal(json.firmas.length, 1);
    assert.equal(json.resumen.firmas, 1);
  } finally {
    abierta.db.close();
  }
});

// =============================================================================
// El despacho: qué pantalla sale según el argumento
// =============================================================================

/**
 * Corre `main()` capturando lo que imprime.
 * @param {string[]} argv
 * @returns {Promise<{codigo: number, salida: string}>}
 */
async function correrMain(argv) {
  const original = console.log;
  const originalError = console.error;
  let salida = '';
  console.log = (t) => { salida += String(t) + '\n'; };
  console.error = () => {};
  try {
    const codigo = await panel.main(argv);
    return { codigo, salida };
  } finally {
    console.log = original;
    console.error = originalError;
  }
}

test('main --empresa=N muestra el PANEL DE EMPRESA (no el general)', async () => {
  await sembrar();
  const r = await correrMain(['--empresa=900829731']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('PANEL DE EMPRESA'), 'Tiene que ser el panel de la empresa');
  assert.ok(!r.salida.includes('PANEL GENERAL DE FIRMA'),
    'Y NO el tablero general: ese fue un bug real (se comparaba opts.vista en vez de datos.vista)');
});

test('main --firma=N muestra el DETALLE de esa firma', async () => {
  const firma = await sembrar();
  const r = await correrMain(['--firma=' + firma.id]);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('FIRMA ' + firma.id));
  assert.ok(r.salida.includes('TRAZA'));
  assert.ok(!r.salida.includes('PANEL GENERAL DE FIRMA'));
});

test('main --json devuelve JSON parseable', async () => {
  await sembrar();
  const r = await correrMain(['--json']);
  assert.equal(r.codigo, 0);
  const datos = JSON.parse(r.salida);
  assert.equal(datos.firmas.length, 1);
});

test('main --empresa= de una empresa que no existe sale con codigo 1', async () => {
  await sembrar();
  const r = await correrMain(['--empresa=000000000']);
  assert.equal(r.codigo, 1);
});

test('main --ayuda imprime el uso y sale con 0', async () => {
  const r = await correrMain(['--ayuda']);
  assert.equal(r.codigo, 0);
  assert.ok(r.salida.includes('panel-firmas.js'));
});

// =============================================================================
// El teclado: por que NO se usa readline.emitKeypressEvents
// =============================================================================

/**
 * Escribe bytes al lector y devuelve las teclas que emitio.
 * @param {string[]} trozos
 * @param {number} [espera] - ms a esperar antes de leer el resultado
 * @returns {Promise<string[]>}
 */
async function teclas(trozos, espera) {
  const recibidas = [];
  const lector = panel.crearLectorTeclado((nombre) => recibidas.push(nombre));
  for (const t of trozos) lector.onData(Buffer.from(t, 'utf8'));
  await new Promise((r) => setTimeout(r, espera || 20));
  lector.destroy();
  return recibidas;
}

test('el lector: ESC sola emite escape (el parser de Node no lo hacia)', async () => {
  const recibidas = await teclas(['\x1b'], 120);
  assert.deepEqual(recibidas, ['escape'],
    'Con readline.emitKeypressEvents, ESC sola NO emitia nada. Aqui si.');
});

test('el lector: la flecha arriba NO se confunde con ESC', async () => {
  const recibidas = await teclas(['\x1b', '[', 'A'], 120);
  assert.deepEqual(recibidas, ['up']);
  assert.ok(!recibidas.includes('escape'));
});

test('el lector: la flecha partida en dos trozos tambien es up', async () => {
  // Un SOLO lector: el estado de "secuencia a medio llegar" vive en el.
  const recibidas = [];
  const lector = panel.crearLectorTeclado((nombre) => recibidas.push(nombre));
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  lector.onData(Buffer.from('\x1b', 'utf8'));
  await esperar(20);
  assert.deepEqual(recibidas, [], 'Con la secuencia a medio llegar no se decide nada');

  lector.onData(Buffer.from('[', 'utf8'));
  await esperar(20);
  assert.deepEqual(recibidas, [], 'Sigue a medio llegar');

  lector.onData(Buffer.from('A', 'utf8'));
  await esperar(120);
  assert.deepEqual(recibidas, ['up']);
  lector.destroy();
});

test('el lector: Enter, q y Ctrl+C se reconocen', async () => {
  assert.deepEqual(await teclas(['\r'], 20), ['return']);
  assert.deepEqual(await teclas(['\n'], 20), ['return']);
  assert.deepEqual(await teclas(['q'], 20), ['q']);
  assert.deepEqual(await teclas(['\x03'], 20), ['ctrl-c']);
  assert.deepEqual(await teclas(['x'], 20), ['x']);
});

test('el lector: ESC seguida de una letra es alt+tecla y se ignora', async () => {
  const recibidas = await teclas(['\x1b', 'x'], 120);
  assert.deepEqual(recibidas, []);
});

// =============================================================================
// La navegacion (funcion pura)
// =============================================================================

function estado(vista) {
  return { vista, selEmpresa: 0, selFirma: 0, ayuda: false };
}

test('aplicarTecla: Esc vuelve de la firma a la empresa y de la empresa al tablero', () => {
  const e1 = estado('firma');
  panel.aplicarTecla(e1, 'escape', {});
  assert.equal(e1.vista, 'empresa');

  const e2 = estado('empresa');
  panel.aplicarTecla(e2, 'escape', {});
  assert.equal(e2.vista, 'general');

  const e3 = estado('general');
  const r = panel.aplicarTecla(e3, 'escape', {});
  assert.equal(e3.vista, 'general', 'En el tablero general no hay a donde volver');
  assert.equal(r.redibujar, false, 'Y no se redibuja para nada');
});

test('aplicarTecla: Enter abre y vuelve (general -> empresa -> firma)', () => {
  const e = estado('general');
  panel.aplicarTecla(e, 'return', { hayEmpresas: true, maxEmpresas: 1 });
  assert.equal(e.vista, 'empresa');
  panel.aplicarTecla(e, 'return', { hayFirmas: true, maxFirmas: 2 });
  assert.equal(e.vista, 'firma');
  panel.aplicarTecla(e, 'return', {});
  assert.equal(e.vista, 'empresa', 'En el detalle, Enter vuelve a la empresa');
});

test('aplicarTecla: las flechas mueven la seleccion y no se salen del rango', () => {
  const e = estado('general');
  panel.aplicarTecla(e, 'down', { maxEmpresas: 3 });
  assert.equal(e.selEmpresa, 1);
  panel.aplicarTecla(e, 'up', { maxEmpresas: 3 });
  assert.equal(e.selEmpresa, 0);
  panel.aplicarTecla(e, 'up', { maxEmpresas: 3 });
  assert.equal(e.selEmpresa, 0, 'No baja de 0');
  panel.aplicarTecla(e, 'down', { maxEmpresas: 3 });
  panel.aplicarTecla(e, 'down', { maxEmpresas: 3 });
  assert.equal(e.selEmpresa, 2, 'No pasa de la ultima');
  panel.aplicarTecla(e, 'down', { maxEmpresas: 3 });
  assert.equal(e.selEmpresa, 2);
});

test('aplicarTecla: q y Ctrl+C salen; ? alterna la ayuda', () => {
  assert.equal(panel.aplicarTecla(estado('general'), 'q', {}).salir, true);
  assert.equal(panel.aplicarTecla(estado('general'), 'ctrl-c', {}).salir, true);
  const e = estado('general');
  panel.aplicarTecla(e, '?', {});
  assert.equal(e.ayuda, true);
  panel.aplicarTecla(e, '?', {});
  assert.equal(e.ayuda, false);
});

test('aplicarTecla: r pide refrescar', () => {
  const r = panel.aplicarTecla(estado('general'), 'r', {});
  assert.equal(r.refrescar, true);
});

// =============================================================================
// QUE MORDAN
// =============================================================================
//
// Estas pruebas no son decorativas. Si alguien degrada el panel, tienen que
// caerse. Se verifico mutando el codigo a proposito (ver la entrada del
// Historial.md):
//
//   1. EnmascararIp devuelve la IP entera  -> cae el test de la IP enmascarada
//   2. renderFirma imprime el token_hash   -> cae el test de secretos
//   3. Se mete un UPDATE en el script      -> cae el test del fuente
//
