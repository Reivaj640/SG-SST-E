/**
 * EL MANIFIESTO DEL ANEXO DE NUBE: "firmado" SOLO CON LA SUSCRIPCION DEL
 * TEXTO VIGENTE
 * ============================================================================
 *
 * El manifiesto (`legal-readiness.json`) es lo que lee la compuerta de
 * publicacion: el item `anexo_nube::firmado_nube` exige que diga "firmado"
 * con fecha, version, huella y evidencia. Por eso el script que lo escribe
 * tiene una sola regla que no se puede saltar:
 *
 *   El manifiesto NO dice "firmado" si no hay una suscripcion FIRMADA del TEXTO
 *   VIGENTE.
 *
 * La comparacion es contra el TEXTO (version y huella), no contra la fecha:
 * la fecha dice cuando, la huella dice QUE. ASEPLUS suscribio la v1.1 el
 * 5-nov-2026; cuando la v1.2 sea la vigente, esa suscripcion NO describe el
 * texto que se sirve: declarar "firmado" por ella seria un verde falso.
 *
 * Lo que se verifica aca:
 *
 * - Que sin suscripcion del texto vigente el manifiesto dice "firmado: false"
 *   y el script sale con 0: no es un error, es el estado real.
 * - Que con la suscripcion del texto vigente escribe estado, fecha, version,
 *   huella y evidencia.
 * - Que una suscripcion de OTRA version NO habilita nada, y que queda
 *   conservada en `versiones_firmadas`.
 * - Que NO toca `modelo`: la identidad del texto vigente es de otro script.
 * - Que una suscripcion FIRMADA cuya ficha de Empresa no coincide es una
 *   INCONGRUENCIA que se reporta (codigo 4), no un estado que se promedie.
 * - Que un texto del servidor con otra huella no se firma (codigo 5).
 * - Que la evidencia sale de la FILA (firmante, IP, rastro) y es ASCII puro.
 * - Que `--check` no escribe nada.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const db = require('../../src/db/connection');
const anexoNube = require('../../src/services/anexoNube');
const modelo = require('../../src/services/anexoNubeModelo');
const mailer = require('../../src/services/mailer');
const { resetDb } = require('../helpers');
const script = require('../../scripts/actualizar-manifiesto-anexo-nube');
const publicador = require('../../scripts/actualizar-manifiesto-1047');
const { ponerEnBloque } = require('../../scripts/actualizar-manifiesto-anexo-encargo');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';

let tmp;
let copia;
let lineasSalida;

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(id = ID_EMPRESA) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, canal_pqrs, activo)
    VALUES (?, ?, ?, ?, 1)
  `).run(id, 'EMPRESA DE PRUEBA SAS', id, 'pqrs@empresa-prueba.test');
  return id;
}

/** El ultimo correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo || (tipo === 'anexo_nube' && inbox[i].tipo === 'signature')) {
      return inbox[i];
    }
  }
  return null;
}

/** El codigo de verificacion que salio en el ultimo correo de codigo. */
function ultimoCodigo() {
  const c = ultimoCorreo('anexo_nube');
  assert.ok(c, 'tiene que haber salido un correo con el codigo de verificacion');
  return c.otp;
}

/**
 * El flujo REAL: la Empresa se suscribe al texto vigente.
 *
 * Se usa el servicio de verdad (no filas escritas a mano) porque lo que se
 * prueba es que el script lee bien lo que el servicio escribe.
 *
 * @param {object} opciones
 * @param {boolean} opciones.firmar si se llega hasta el acto de la Empresa.
 * @returns {Promise<object>} la suscripcion ya cerrada.
 */
async function sembrarFlujo(opciones = {}) {
  resetDb();
  sembrarEmpresa();
  mailer.clearDevInbox();

  const abierto = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: 'PERSONA DE PRUEBA',
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });

  if (!opciones.firmar) return { idSuscripcion: null };

  await anexoNube.solicitarCodigo(abierto.token, {});
  anexoNube.suscribir(abierto.token, {
    otp: ultimoCodigo(),
    acepta: true,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones ORDER BY id DESC LIMIT 1',
  ).get().id;

  return { idSuscripcion };
}

/**
 * Una suscripcion FIRMADA de una version que NO es la vigente.
 *
 * Es el estado real del servidor (ASEPLUS suscribio la v1.1 el 5-nov-2026), y
 * no se puede sembrar con el servicio: el servicio solo firma el texto
 * vigente. Se escribe la fila a mano, con la misma forma que deja el servicio.
 *
 * @param {string} version
 * @param {string} hash
 */
function sembrarSuscripcionHistorica(version, hash) {
  const ahora = new Date().toISOString();
  db.prepare(`
    INSERT INTO gh_firma_anexo_nube_suscripciones
      (id_empresa, token_hash, version, hash_texto, correo_firmante,
       nombre_firmante, cargo_firmante, estado, expira_enlace_at,
       firmado_at, evidencia, ip_firma, user_agent_firma)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'FIRMADA', ?, ?, ?, ?, ?)
  `).run(
    ID_EMPRESA, 'hist-' + hash.slice(0, 16), version, hash, CORREO_FIRMANTE,
    'PERSONA DE PRUEBA', 'Representante legal', ahora, ahora,
    JSON.stringify({ fuente: 'enlace_suscripcion', version, hash }),
    '203.0.113.9', 'Navegador/1.0',
  );
  db.prepare(`
    UPDATE gh_firma_empresas
       SET anexo_nube_firmado_at = ?, anexo_nube_version = ?, anexo_nube_hash = ?
     WHERE id_empresa = ?
  `).run(ahora, version, hash, ID_EMPRESA);
}

/** La suscripcion tal como la ve el script. */
function suscripcion(idSuscripcion) {
  return db.prepare(
    'SELECT * FROM gh_firma_anexo_nube_suscripciones WHERE id = ?',
  ).get(idSuscripcion);
}

/**
 * El SEGUNDO acto: la contrafirma de K+AIR.
 *
 * Se escribe la fila a mano, con la misma forma que deja el servicio. El
 * servicio (y su prueba) son los que muestran que el acto se puede PRODUCIR;
 * lo que se prueba aca es que el manifiesto lo LEE y lo declara.
 *
 * @param {number} idSuscripcion
 * @param {object} extra
 * @returns {string} la fecha del segundo acto.
 */
function sembrarContrafirma(idSuscripcion, extra = {}) {
  const ahora = new Date().toISOString();
  const actor = extra.actor || 'kair';
  const motivo = extra.motivo || 'Contrafirma de prueba sobre el texto vigente.';
  const acta = extra.acta || 'acta-1-contrafirma-anexo-nube.pdf';
  const hashActa = extra.hashActa || 'b'.repeat(64);
  db.prepare(`
    UPDATE gh_firma_anexo_nube_suscripciones
       SET contrafirmado_at = ?, contrafirma_actor = ?, contrafirma_motivo = ?,
           contrafirma_evidencia = ?, contrafirma_acta_archivo = ?,
           contrafirma_acta_hash = ?, contrafirma_acta_bytes = ?,
           contrafirma_estado = 'CONTRAFIRMADA'
     WHERE id = ?
  `).run(
    ahora, actor, motivo,
    JSON.stringify({ fuente: 'contrafirma', actor, motivo, acta, hash: hashActa }),
    acta, hashActa, 1234,
    idSuscripcion,
  );
  db.prepare(`
    UPDATE gh_firma_empresas SET anexo_nube_ejecutado_at = ? WHERE id_empresa = ?
  `).run(ahora, ID_EMPRESA);
  return ahora;
}

/** El manifiesto de la COPIA, parseado. */
function leerCopia() {
  return JSON.parse(fs.readFileSync(copia, 'utf8'));
}

/**
 * La copia del manifiesto con el Anexo de Nube SIN FIRMAR.
 *
 * El fixture tiene que ser DETERMINISTA: si el manifiesto del repo declarara
 * una firma, los tests que comprueban "no dice firmado" pasarian por la razón
 * equivocada.
 *
 * `contrafirma_facultad` tambien se limpia (12-nov-2026). El manifiesto real
 * pasó a declarar la firma de ASEPLUS (v1.3, 2026-11-12), así que el campo
 * trae un valor de verdad; si el fixture lo dejaba, el test "sin suscripcion el
 * manifiesto dice firmado: false" fallaba porque el script lo pone en `null`
 * (sin suscripcion del texto vigente no hay contrafirma, y una facultad sin
 * contrafirma es un dato que no describe ningun acto). El fixture tiene que
 * dejar el bloque en la linea base de "nada firmado", no en la de "firmado".
 *
 * @param {string} texto
 * @returns {string}
 */
function manifiestoSinFirmarNube(texto) {
  const man = JSON.parse(texto);
  man.anexo_nube.firmado = false;
  man.anexo_nube.fecha = null;
  man.anexo_nube.version = null;
  man.anexo_nube.hash = null;
  man.anexo_nube.evidencia = null;
  man.anexo_nube.contrafirmado = false;
  man.anexo_nube.contrafirma_fecha = null;
  man.anexo_nube.contrafirma_actor = null;
  man.anexo_nube.contrafirma_motivo = null;
  man.anexo_nube.contrafirma_evidencia = null;
  man.anexo_nube.contrafirma_facultad = null;
  return script.asciiEscape(JSON.stringify(man, null, 2)) + '\n';
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manifiesto-nube-'));
  copia = path.join(tmp, 'legal-readiness.json');
  fs.writeFileSync(
    copia,
    manifiestoSinFirmarNube(fs.readFileSync(MANIFIESTO_REAL, 'utf8')),
    'utf8',
  );
  lineasSalida = [];
  script.fijarSalida((t) => lineasSalida.push(t), (t) => lineasSalida.push(t));
});

afterEach(() => {
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* tabla ausente */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ===========================================================================
// 1. EL ESTADO REAL
// ===========================================================================

test('sin suscripcion el manifiesto dice "firmado: false" y no es un error', async () => {
  await sembrarFlujo({ firmar: false });
  const antes = fs.readFileSync(copia, 'utf8');

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.ok, true);
  assert.equal(salida.firmado, false,
    'la ausencia de suscripcion es un estado, no un error');

  const bloque = leerCopia().anexo_nube;
  assert.equal(bloque.firmado, false);
  assert.equal(bloque.fecha, null);
  assert.equal(bloque.version, null);
  assert.equal(bloque.hash, null);
  assert.equal(bloque.evidencia, null);
  assert.equal(fs.readFileSync(copia, 'utf8'), antes,
    'el estado ya era el que dice el manifiesto: no hay nada que cambiar');
});

test('sin suscripcion NO se agrega nada a versiones_firmadas', async () => {
  await sembrarFlujo({ firmar: false });
  const antes = leerCopia().anexo_nube.versiones_firmadas.length;
  script.main(['--manifiesto', copia]);
  const despues = leerCopia().anexo_nube.versiones_firmadas;
  assert.ok(Array.isArray(despues));
  assert.equal(despues.length, antes,
    'lo que ya constaba se conserva y no se inventa ninguna suscripcion');
});

// ===========================================================================
// 2. LO QUE SE ESCRIBE
// ===========================================================================

test('con la suscripcion del texto vigente escribe estado, fecha, version y huella', async () => {
  const { idSuscripcion } = await sembrarFlujo({ firmar: true });

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.ok, true);
  assert.equal(salida.firmado, true);

  const bloque = leerCopia().anexo_nube;
  const fila = suscripcion(idSuscripcion);
  assert.equal(bloque.firmado, true);
  assert.equal(bloque.fecha, fila.firmado_at);
  assert.equal(bloque.version, modelo.VERSION_MODELO);
  assert.equal(bloque.hash, fila.hash_texto);
  assert.ok(bloque.evidencia.length > 150, 'la evidencia no es un placeholder');
});

test('la huella escrita es la del archivo que el servicio sirve', async () => {
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);

  const esperado = crypto.createHash('sha256')
    .update(fs.readFileSync(modelo.RUTA_MODELO)).digest('hex');
  assert.equal(leerCopia().anexo_nube.hash, esperado);
});

test('el manifiesto escrito sigue siendo JSON valido y ASCII puro', async () => {
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);

  const crudo = fs.readFileSync(copia, 'utf8');
  assert.doesNotThrow(() => JSON.parse(crudo));
  const noAscii = (crudo.match(/[^\x00-\x7F]/g) || []).length;
  assert.equal(noAscii, 0, 'el manifiesto es ASCII puro: quedo ' + noAscii + ' caracteres');
});

test('NO toca el modelo: la identidad del texto vigente es de otro script', async () => {
  const antes = JSON.parse(fs.readFileSync(MANIFIESTO_REAL, 'utf8')).anexo_nube.modelo;
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);

  const despues = leerCopia().anexo_nube.modelo;
  assert.equal(despues.version, antes.version);
  assert.equal(despues.hash, antes.hash);
  assert.equal(despues.bytes, antes.bytes);
});

// ===========================================================================
// 3. LA REGLA QUE NO SE PUEDE SALTAR
// ===========================================================================

test('una suscripcion de OTRA version NO habilita nada', async () => {
  resetDb();
  sembrarEmpresa();
  const hashViejo = 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482';
  sembrarSuscripcionHistorica('1.1', hashViejo);

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.firmado, false,
    'la suscripcion de la v1.1 no describe el texto vigente: la v1.2');

  const bloque = leerCopia().anexo_nube;
  assert.equal(bloque.firmado, false);
  assert.equal(bloque.version, null);
  assert.equal(bloque.hash, null);
});

test('la suscripcion de otra version se CONSERVA en versiones_firmadas', async () => {
  resetDb();
  sembrarEmpresa();
  const hashViejo = 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482';
  sembrarSuscripcionHistorica('1.1', hashViejo);

  script.main(['--manifiesto', copia]);

  const previas = leerCopia().anexo_nube.versiones_firmadas;
  const v11 = previas.find((x) => x.version === '1.1');
  assert.ok(v11, 'la version suscrita antes no se borra');
  assert.equal(v11.hash, hashViejo);
  assert.ok(v11.evidencia, 'con su evidencia');
});

test('no duplica una version que ya estaba en versiones_firmadas', async () => {
  resetDb();
  sembrarEmpresa();
  const hashViejo = 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482';
  sembrarSuscripcionHistorica('1.1', hashViejo);

  script.main(['--manifiesto', copia]);
  const primera = leerCopia().anexo_nube.versiones_firmadas.length;
  script.main(['--manifiesto', copia]);
  const segunda = leerCopia().anexo_nube.versiones_firmadas.length;

  assert.equal(primera, segunda, 'el script es idempotente');
});

// ===========================================================================
// 4. LA EVIDENCIA
// ===========================================================================

test('la evidencia sale de la FILA: firmante, huella, IP y rastro', async () => {
  const { idSuscripcion } = await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);

  const fila = suscripcion(idSuscripcion);
  const evidencia = leerCopia().anexo_nube.evidencia;

  assert.ok(evidencia.includes(fila.hash_texto), 'la evidencia lleva la huella');
  assert.ok(evidencia.includes('203.0.113.9'), 'la evidencia lleva la IP de la firma');
  assert.ok(evidencia.includes('PERSONA DE PRUEBA'), 'la evidencia nombra al firmante');
  assert.match(evidencia, /Rastro append-only/);
  assert.match(evidencia, /SUSCRIPCION_FIRMADA/);
});

test('la evidencia dice que el Anexo de Nube no genera acta', async () => {
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);

  const evidencia = leerCopia().anexo_nube.evidencia;
  assert.match(evidencia, /no genera acta/);
});

test('una razon social con tilde sale en ASCII, sin tilde', async () => {
  resetDb();
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, canal_pqrs, activo)
    VALUES (?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, 'Vásquez Muñoz S.A.S.', ID_EMPRESA, 'pqrs@empresa-prueba.test');
  mailer.clearDevInbox();

  const abierto = await anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });
  await anexoNube.solicitarCodigo(abierto.token, {});
  anexoNube.suscribir(abierto.token, { otp: ultimoCodigo(), acepta: true },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  script.main(['--manifiesto', copia]);

  const evidencia = leerCopia().anexo_nube.evidencia;
  assert.ok(evidencia.includes('Vasquez Munoz S.A.S.'),
    'la razon social se transcribe sin tilde');
  assert.ok(!/[^\x00-\x7F]/.test(evidencia));
});

// ===========================================================================
// 5. LAS INCONGRUENCIAS
// ===========================================================================

test('FIRMADA pero sin fecha en la ficha es una incongruencia: codigo 4', async () => {
  await sembrarFlujo({ firmar: true });
  db.prepare('UPDATE gh_firma_empresas SET anexo_nube_firmado_at = NULL').run();
  const antes = fs.readFileSync(copia, 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => e.codigo === 4,
    'no se promedian las dos escrituras',
  );
  assert.equal(fs.readFileSync(copia, 'utf8'), antes);
});

test('FIRMADA pero con otra huella en la ficha es una incongruencia: codigo 4', async () => {
  await sembrarFlujo({ firmar: true });
  db.prepare('UPDATE gh_firma_empresas SET anexo_nube_hash = ?')
    .run('a'.repeat(64));
  const antes = fs.readFileSync(copia, 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => e.codigo === 4,
  );
  assert.equal(fs.readFileSync(copia, 'utf8'), antes);
});

test('un texto del servidor con otra huella no se firma: codigo 5', async () => {
  await sembrarFlujo({ firmar: true });
  const antes = fs.readFileSync(copia, 'utf8');
  const otroTexto = path.join(tmp, 'anexo-nube-otro.html');
  fs.writeFileSync(otroTexto, '<html>otro texto</html>', 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia, '--texto', otroTexto]),
    (e) => e.codigo === 5,
    'no se firma un texto que nadie ha verificado',
  );
  assert.equal(fs.readFileSync(copia, 'utf8'), antes);
});

// ===========================================================================
// 6. LOS ARGUMENTOS Y LOS ERRORES
// ===========================================================================

test('un argumento desconocido se rechaza con codigo 2', () => {
  assert.throws(() => script.main(['--inventado']), (e) => e.codigo === 2);
});

test('--manifiesto sin ruta se rechaza con codigo 2', () => {
  assert.throws(() => script.main(['--manifiesto']), (e) => e.codigo === 2);
});

test('un manifiesto que no es JSON se rechaza con codigo 3', () => {
  fs.writeFileSync(copia, '{esto no es json', 'utf8');
  assert.throws(() => script.main(['--manifiesto', copia]), (e) => e.codigo === 3);
});

// ===========================================================================
// 7. --CHECK
// ===========================================================================

test('--check NO escribe y dice que el estado es otro', async () => {
  await sembrarFlujo({ firmar: true });
  const antes = fs.readFileSync(copia, 'utf8');

  const salida = script.main(['--manifiesto', copia, '--check']);
  assert.equal(salida.ok, true);
  assert.equal(salida.solo_check, true);
  assert.equal(salida.coincide, false, 'el manifiesto todavia no dice "firmado"');
  assert.equal(salida.firmado, false, 'informa del estado que HAY');
  assert.equal(fs.readFileSync(copia, 'utf8'), antes, '--check no escribe');
});

test('--check, despues de escribir, dice que coincide', async () => {
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);
  const despues = fs.readFileSync(copia, 'utf8');

  const salida = script.main(['--manifiesto', copia, '--check']);
  assert.equal(salida.coincide, true);
  assert.equal(salida.firmado, true);
  assert.equal(fs.readFileSync(copia, 'utf8'), despues, '--check no escribe');
});

test('--check compara el ESTADO y no los bytes', async () => {
  // El caso real del 11-nov-2026: el manifiesto lo habian escrito los DOS
  // scripts y cada uno lo habia dejado con una forma distinta (el objeto de
  // la facultad en una sola linea en el del Encargo, en varias lineas en el
  // del Nube). Los dos `--check` comparaban BYTES, asi que se contradecian y
  // el del Nube reportaba "el manifiesto tiene un estado distinto del que se
  // escribiria" sobre un manifiesto cuyo estado era exactamente el que habia.
  //
  // El check compara el ESTADO: una diferencia de forma no es una diferencia
  // de estado.
  await sembrarFlujo({ firmar: true });
  script.main(['--manifiesto', copia]);
  const despues = fs.readFileSync(copia, 'utf8');

  // Se reproduce lo que dejaba el script del Anexo de Encargo: el objeto de la
  // facultad en UNA SOLA LINEA. El estado es el mismo; la forma no.
  const conFacultad = ponerEnBloque(
    despues,
    'anexo_encargo',
    'contrafirma_facultad',
    { resultado: 'REPRESENTANTE_LEGAL_ENCARGADO', nombre: 'Javier Robles Fontalvo' },
  );
  assert.notEqual(conFacultad, despues, 'la forma del archivo cambio');
  fs.writeFileSync(copia, conFacultad, 'utf8');

  const salida = script.main(['--manifiesto', copia, '--check']);
  assert.equal(salida.coincide, true,
    'el estado es el mismo: el check no puede reportar una diferencia de estado');
  assert.equal(salida.firmado, true);
});

// ===========================================================================
// 8. EL ORDEN DE LOS DOS SCRIPTS
// ===========================================================================

/**
 * La firma de una version anterior, tal como la declara el manifiesto.
 *
 * @returns {object}
 */
function versionSuscritaPrevia() {
  const man = JSON.parse(fs.readFileSync(MANIFIESTO_REAL, 'utf8'));
  const v = (man.anexo_nube.versiones_firmadas || []).find((x) => x && x.version === '1.1');
  assert.ok(v, 'el manifiesto declara la version que ASEPLUS suscribio antes');
  return v;
}

test('el script que publica el texto NO borra una firma del texto vigente', () => {
  const hashVigente = crypto.createHash('sha256')
    .update(fs.readFileSync(modelo.RUTA_MODELO)).digest('hex');

  const man = JSON.parse(fs.readFileSync(copia, 'utf8'));
  man.anexo_nube.firmado = true;
  man.anexo_nube.version = modelo.VERSION_MODELO;
  man.anexo_nube.hash = hashVigente;
  man.anexo_nube.fecha = '2026-11-09T12:00:00.000Z';
  man.anexo_nube.evidencia = 'Prueba: la firma describe el texto vigente.';
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');

  publicador.main(['--manifiesto', copia]);

  const bloque = JSON.parse(fs.readFileSync(copia, 'utf8')).anexo_nube;
  assert.equal(bloque.firmado, true,
    'los dos scripts se pueden correr en cualquier orden: publicar el texto no borra la firma');
  assert.equal(bloque.version, modelo.VERSION_MODELO);
  assert.equal(bloque.hash, hashVigente);
  assert.equal(bloque.fecha, '2026-11-09T12:00:00.000Z');
});

test('el script que publica el texto mueve a la historia una firma de otro texto', () => {
  const previa = versionSuscritaPrevia();

  const man = JSON.parse(fs.readFileSync(copia, 'utf8'));
  man.anexo_nube.firmado = true;
  man.anexo_nube.version = previa.version;
  man.anexo_nube.hash = previa.hash;
  man.anexo_nube.fecha = previa.fecha;
  man.anexo_nube.evidencia = previa.evidencia;
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');

  publicador.main(['--manifiesto', copia]);

  const bloque = JSON.parse(fs.readFileSync(copia, 'utf8')).anexo_nube;
  assert.equal(bloque.firmado, false,
    'una firma de otra version no describe el texto vigente');
  assert.equal(bloque.version, null);
  assert.equal(bloque.hash, null);

  const enHistoria = bloque.versiones_firmadas.filter((x) => x.version === previa.version);
  assert.equal(enHistoria.length, 1,
    'la version firmada se conserva UNA vez: ni se borra ni se duplica');
  assert.equal(enHistoria[0].hash, previa.hash);
});

// ===========================================================================
// 9. LAS PIEZAS SUELTAS
// ===========================================================================

test('aAscii quita tildes y enes', () => {
  assert.equal(script.aAscii('Vásquez Muñoz'), 'Vasquez Munoz');
  assert.equal(script.aAscii('Ñoño'), 'Nono');
  assert.equal(script.aAscii('ÁÉÍÓÚ'), 'AEIOU');
  assert.equal(script.aAscii(null), '');
  assert.equal(script.aAscii(undefined), '');
});

test('aAscii saca lo que no es ASCII (un signo raro no es informacion)', () => {
  assert.equal(script.aAscii('ACME 100% \u{1F4E6} Ltd'), 'ACME 100%  Ltd');
});

test('asciiEscape escapa lo que no es ASCII', () => {
  assert.equal(script.asciiEscape('a\u00e1'), 'a\\u00e1');
  assert.equal(script.asciiEscape('a'), 'a');
});

// ===========================================================================
// 10. LOS DOS ACTOS: LA SUSCRIPCION Y LA CONTRAFIRMA
// ===========================================================================
//
// El Anexo de Nube v1.2 es BILATERAL (su parrafo 10): lo susceptibility la
// Empresa (primer acto) y lo contrafirma K+AIR (segundo acto). El manifiesto
// tiene que DECIR CUAL DE LOS DOS FALTA, porque "firmado" sin el segundo acto
// describe la mitad del instrumento.

test('con la suscripcion pero SIN contrafirma, el manifiesto dice que falta el segundo acto', async () => {
  const { idSuscripcion } = await sembrarFlujo({ firmar: true });

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.firmado, true, 'el primer acto esta');
  assert.equal(salida.contrafirmado, false, 'el segundo acto NO esta');

  const bloque = leerCopia().anexo_nube;
  assert.equal(bloque.firmado, true);
  assert.equal(bloque.contrafirmado, false);
  assert.equal(bloque.contrafirma_fecha, null);
  assert.equal(bloque.contrafirma_actor, null);
  assert.equal(bloque.contrafirma_evidencia, null);
  assert.match(bloque.evidencia, /falta el SEGUNDO acto/,
    'la evidencia dice POR QUE el instrumento no esta ejecutado');
  assert.match(bloque.evidencia, /bilateral/);
});

test('con la contrafirma, el manifiesto declara el segundo acto', async () => {
  const { idSuscripcion } = await sembrarFlujo({ firmar: true });
  const fecha = sembrarContrafirma(idSuscripcion);

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.firmado, true);
  assert.equal(salida.contrafirmado, true);

  const bloque = leerCopia().anexo_nube;
  assert.equal(bloque.contrafirmado, true);
  assert.equal(bloque.contrafirma_fecha, fecha);
  assert.equal(bloque.contrafirma_actor, 'kair');
  assert.ok(bloque.contrafirma_motivo, 'el motivo del segundo acto');
  assert.ok(bloque.contrafirma_evidencia, 'la evidencia del segundo acto');
  assert.match(bloque.contrafirma_evidencia, /SEGUNDO ACTO/);
  assert.match(bloque.contrafirma_evidencia, /acta-1-contrafirma-anexo-nube\.pdf/,
    'la evidencia cita el acta con su nombre');
  assert.match(bloque.contrafirma_evidencia, /b{64}/,
    'la evidencia cita la huella del acta');
  assert.match(bloque.evidencia, /SEGUNDO acto/,
    'la evidencia del primer acto dice que el segundo ya esta');
});

test('la contrafirma de una version que NO es la vigente no habilita nada', async () => {
  resetDb();
  sembrarEmpresa();
  const hashViejo = 'e95175368dcb8aed7227ab35522a55db065da0f9620b52555d16254ae4591482';
  sembrarSuscripcionHistorica('1.1', hashViejo);
  const idVieja = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones ORDER BY id DESC LIMIT 1',
  ).get().id;
  sembrarContrafirma(idVieja);

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.firmado, false,
    'la v1.1 contrafirmada no describe el texto vigente');
  assert.equal(salida.contrafirmado, false);

  const bloque = leerCopia().anexo_nube;
  assert.equal(bloque.contrafirmado, false);
  const enHistoria = bloque.versiones_firmadas.find((x) => x.version === '1.1');
  assert.ok(enHistoria, 'la version sigue en la historia');
  assert.equal(enHistoria.contrafirmado, true,
    'la historia dice que esa version SI fue contrafirmada');
});

test('sin el segundo acto visible el script NO declara la firma', () => {
  // La regla es una FUNCION, no una condicion escondida en el cuerpo: sin
  // las columnas de la contrafirma (migracion 060) no se puede saber si el
  // instrumento esta ejecutado, y un manifiesto que declara firmado sin
  // poder mirar el segundo acto es un verde falso.
  assert.equal(script.puedeDeclararFirma(false, true), false,
    'con suscripcion y sin el segundo acto visible: no se declara');
  assert.equal(script.puedeDeclararFirma(true, true), true);
  assert.equal(script.puedeDeclararFirma(false, false), true,
    'sin suscripcion no hay nada que declarar: eso no depende del segundo acto');
});

test('la base de pruebas tiene las columnas del segundo acto', () => {
  assert.equal(script.hayColumnasDeContrafirma(), true,
    'la migracion 060 esta aplicada: el segundo acto es visible');
});

test('el script que publica el texto CONSERVA la contrafirma del texto vigente', () => {
  const hashVigente = crypto.createHash('sha256')
    .update(fs.readFileSync(modelo.RUTA_MODELO)).digest('hex');

  const man = JSON.parse(fs.readFileSync(copia, 'utf8'));
  man.anexo_nube.firmado = true;
  man.anexo_nube.version = modelo.VERSION_MODELO;
  man.anexo_nube.hash = hashVigente;
  man.anexo_nube.fecha = '2026-11-09T12:00:00.000Z';
  man.anexo_nube.evidencia = 'Prueba: la firma describe el texto vigente.';
  man.anexo_nube.contrafirmado = true;
  man.anexo_nube.contrafirma_fecha = '2026-11-09T13:00:00.000Z';
  man.anexo_nube.contrafirma_actor = 'kair';
  man.anexo_nube.contrafirma_motivo = 'Motivo de prueba.';
  man.anexo_nube.contrafirma_evidencia = 'Prueba: el segundo acto.';
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');

  publicador.main(['--manifiesto', copia]);

  const bloque = JSON.parse(fs.readFileSync(copia, 'utf8')).anexo_nube;
  assert.equal(bloque.contrafirmado, true,
    'publicar el texto no borra el segundo acto del texto vigente');
  assert.equal(bloque.contrafirma_fecha, '2026-11-09T13:00:00.000Z');
  assert.equal(bloque.contrafirma_actor, 'kair');
  assert.equal(bloque.contrafirma_motivo, 'Motivo de prueba.');
  assert.equal(bloque.contrafirma_evidencia, 'Prueba: el segundo acto.');
});

test('el script que publica el texto NO declara una contrafirma sin firma', () => {
  const man = JSON.parse(fs.readFileSync(copia, 'utf8'));
  man.anexo_nube.contrafirmado = true;
  man.anexo_nube.contrafirma_fecha = '2026-11-09T13:00:00.000Z';
  man.anexo_nube.contrafirma_evidencia = 'Prueba: el segundo acto.';
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');

  publicador.main(['--manifiesto', copia]);

  const bloque = JSON.parse(fs.readFileSync(copia, 'utf8')).anexo_nube;
  assert.equal(bloque.firmado, false,
    'sin suscripcion del texto vigente no hay nada que contrafirmar');
  assert.equal(bloque.contrafirmado, false);
  assert.equal(bloque.contrafirma_fecha, null);
  assert.equal(bloque.contrafirma_evidencia, null);
});
