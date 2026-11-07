/**
 * EL MANIFIESTO DEL ANEXO DE ENCARGO: "firmado" SOLO CON CONTRAFIRMA
 * ============================================================================
 *
 * El manifiesto (`legal-readiness.json`) es lo que lee la compuerta de
 * publicacion: el item `anexo_encargo::estado_encargo` exige que diga
 * "firmado" con fecha y evidencia. Por eso el script que lo escribe tiene una
 * sola regla que no se puede saltar:
 *
 *   El manifiesto NO dice "firmado" si no hay contrafirma.
 *
 * El Anexo de Encargo es BILATERAL. La suscripcion de la Empresa (fase 1) deja
 * constancia de UN acto; el instrumento queda EJECUTADO cuando las dos partes
 * firman (fase 2, la contrafirma de K+AIR). Un manifiesto que dijera
 * "firmado" con una sola de las dos partes seria una falsificacion.
 *
 * Lo que se verifica aca:
 *
 * - Que sin contrafirma el script SE NIEGA (codigo 4) y no toca el archivo.
 * - Que con los dos actos escribe estado, fecha y evidencia.
 * - Que NO toca `version`, `hash` ni `nota`: son la identidad del TEXTO, no
 *   del acto.
 * - Que la evidencia sale en ASCII puro (el manifiesto es ASCII) y que las
 *   razones sociales con tilde se transcriben sin tilde.
 * - Que la evidencia nombra los DOS actos y las DOS actas, con su huella.
 * - Que una suscripcion contrafirmada sin fecha de ejecucion en la ficha es una
 *   INCONGRUENCIA que se reporta (codigo 5), no un estado que se promedie.
 * - Que `--check` no escribe nada.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const db = require('../../src/db/connection');
const anexoEncargo = require('../../src/services/anexoEncargo');
const mailer = require('../../src/services/mailer');
const storage = require('../../src/services/storage');
const { resetDb, manifiestoSinFirmar } = require('../helpers');
const script = require('../../scripts/actualizar-manifiesto-anexo-encargo');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const CANAL_CODIGO = 'segundo-canal@empresa-prueba.test';

const DATOS_S11 = {
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900555777-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: 'datos@empresa-prueba.test',
  representante: 'PERSONA DE PRUEBA',
};

let tmp;
let copia;
let lineasSalida;

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(razonSocial) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, razonSocial || DATOS_S11.razon_social, DATOS_S11.nit,
    DATOS_S11.domicilio, 'pqrs@empresa-prueba.test', DATOS_S11.correo,
    DATOS_S11.representante);
}

/** El ultimo correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo) return inbox[i];
  }
  return null;
}

/**
 * El flujo REAL: la Empresa se suscribe y K+AIR contrafirma.
 *
 * Se usa el servicio de verdad (no filas escritas a mano) porque lo que se
 * prueba es que el script lee bien lo que el servicio escribe: las dos actas
 * con su huella, las dos fechas y el rastro.
 *
 * @param {object} opciones
 * @param {boolean} opciones.contrafirmar si se llega hasta el segundo acto.
 * @returns {Promise<object>} la suscripcion ya cerrada.
 */
async function sembrarFlujo(opciones = {}) {
  resetDb();
  sembrarEmpresa(opciones.razon_social);
  mailer.clearDevInbox();

  const abierto = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: 'Confirmado por llamada de prueba',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });

  await anexoEncargo.solicitarCodigo(abierto.token, {});
  await anexoEncargo.suscribir(abierto.token, {
    otp: ultimoCorreo('anexo_encargo').otp,
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' },
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones ORDER BY id DESC LIMIT 1',
  ).get().id;

  if (!opciones.contrafirmar) return { idSuscripcion };

  anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
    tipo_documento: 'CERTIFICADO_CAMARA',
    referencia: 'Radicado 2026-11-07-14',
  }, { actor: 'admin', motivo: 'Verificado contra el certificado de la camara' });

  await anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {
    ip: '10.0.0.9', user_agent: 'Operador/1.0',
  });
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: ultimoCorreo('anexo_encargo_contrafirma').otp,
    acepta: true,
  }, { actor: 'admin', motivo: 'prueba del manifiesto' });

  return { idSuscripcion };
}

/** La suscripcion tal como la ve el script. */
function suscripcion(idSuscripcion) {
  return db.prepare(
    'SELECT * FROM gh_firma_anexo_encargo_suscripciones WHERE id = ?',
  ).get(idSuscripcion);
}

/** El manifiesto de la COPIA, parseado. */
function leerCopia() {
  return JSON.parse(fs.readFileSync(copia, 'utf8'));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'manifiesto-encargo-'));
  copia = path.join(tmp, 'legal-readiness.json');
  // El fixture NO hereda el estado vivo del manifiesto: el Anexo de Encargo
  // esta firmado en el repo desde el piloto, y estos tests necesitan el
  // estado SIN FIRMAR para poder comprobar lo que dicen comprobar.
  fs.writeFileSync(copia, manifiestoSinFirmar(fs.readFileSync(MANIFIESTO_REAL, 'utf8')), 'utf8');
  lineasSalida = [];
  script.fijarSalida((t) => lineasSalida.push(t), (t) => lineasSalida.push(t));
});

afterEach(() => {
  try { db.prepare('DELETE FROM gh_firma_empresas').run(); } catch (e) { /* tabla ausente */ }
  // Las actas del Anexo de Encargo viven en su propia carpeta: `resetDb()` no
  // la limpia (la carpeta es nueva y los tests la necesitan).
  try {
    for (const f of fs.readdirSync(storage.PATHS.actas)) {
      if (f.startsWith('acta-') && f.includes('anexo-encargo')) {
        fs.unlinkSync(path.join(storage.PATHS.actas, f));
      }
    }
  } catch (e) { /* la carpeta puede no existir */ }
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ===========================================================================
// 1. LA REGLA QUE NO SE PUEDE SALTAR
// ===========================================================================

test('sin contrafirma el script se NIEGA a escribir "firmado"', async () => {
  await sembrarFlujo({ contrafirmar: false });
  const antes = fs.readFileSync(copia, 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => e.codigo === 4,
    'sin contrafirma no hay ejecucion del instrumento',
  );

  assert.equal(fs.readFileSync(copia, 'utf8'), antes,
    'el manifiesto no se toca cuando no hay contrafirma');
  assert.equal(leerCopia().anexo_encargo.estado, 'no_firmado');
});

test('el mensaje de la negativa explica por que el Anexo es bilateral', async () => {
  await sembrarFlujo({ contrafirmar: false });
  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => /bilateral/.test(e.message) && /contrafirma/.test(e.message),
  );
});

// ===========================================================================
// 2. LO QUE SE ESCRIBE
// ===========================================================================

test('con los dos actos escribe estado, fecha y evidencia', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });

  const salida = script.main(['--manifiesto', copia]);
  assert.equal(salida.ok, true);
  assert.equal(salida.estado, 'firmado');

  const man = leerCopia();
  assert.equal(man.anexo_encargo.estado, 'firmado');
  assert.equal(man.anexo_encargo.fecha, suscripcion(idSuscripcion).contrafirmado_at,
    'la fecha del manifiesto es la de la CONTRAFIRMA (la ejecucion)');
  assert.ok(man.anexo_encargo.evidencia.length > 200, 'la evidencia no es un placeholder');
});

test('el manifiesto dice "firmado" con fecha y evidencia, o no lo dice', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const bloque = leerCopia().anexo_encargo;
  assert.equal(bloque.estado, 'firmado');
  assert.ok(bloque.fecha, 'con estado "firmado" tiene que haber fecha');
  assert.ok(bloque.evidencia, 'con estado "firmado" tiene que haber evidencia');
});

test('NO toca la version, la huella ni la nota del texto', async () => {
  const antes = JSON.parse(fs.readFileSync(MANIFIESTO_REAL, 'utf8')).anexo_encargo;
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const despues = leerCopia().anexo_encargo;
  assert.equal(despues.version, antes.version, 'la version es la identidad del TEXTO');
  assert.equal(despues.hash, antes.hash, 'la huella es la identidad del TEXTO');
  assert.equal(despues.nota, antes.nota, 'la nota explica el estado del TEXTO');
});

test('el manifiesto escrito sigue siendo JSON valido y ASCII puro', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const crudo = fs.readFileSync(copia, 'utf8');
  assert.doesNotThrow(() => JSON.parse(crudo));
  const noAscii = (crudo.match(/[^\x00-\x7F]/g) || []).length;
  assert.equal(noAscii, 0, 'el manifiesto es ASCII puro: quedo ' + noAscii + ' caracteres');
});

// ===========================================================================
// 3. LO QUE DICE LA EVIDENCIA
// ===========================================================================

test('la evidencia nombra los DOS actos y las DOS actas con su huella', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const fila = suscripcion(idSuscripcion);
  const evidenciaSuscripcion = JSON.parse(fila.evidencia);
  const evidencia = leerCopia().anexo_encargo.evidencia;

  assert.match(evidencia, /PRIMER ACTO/);
  assert.match(evidencia, /SEGUNDO ACTO/);
  assert.ok(evidencia.includes(evidenciaSuscripcion.acta_archivo),
    'la evidencia nombra el acta de la suscripcion');
  assert.ok(evidencia.includes(evidenciaSuscripcion.acta_hash),
    'la evidencia lleva la huella del acta de la suscripcion');
  assert.ok(evidencia.includes(fila.contrafirma_acta_archivo),
    'la evidencia nombra el acta de la contrafirma');
  assert.ok(evidencia.includes(fila.contrafirma_acta_hash),
    'la evidencia lleva la huella del acta de la contrafirma');
});

test('la evidencia dice que la copia firmada la conserva cada parte', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const evidencia = leerCopia().anexo_encargo.evidencia;
  assert.match(evidencia, /copia firmada/);
  assert.match(evidencia, /cada parte/);
});

test('una razon social con tilde sale en ASCII, sin tilde', async () => {
  await sembrarFlujo({ contrafirmar: true, razon_social: 'Vásquez Muñoz S.A.S.' });
  script.main(['--manifiesto', copia]);

  const evidencia = leerCopia().anexo_encargo.evidencia;
  assert.ok(evidencia.includes('Vasquez Munoz S.A.S.'),
    'la razon social se transcribe sin tilde, como la evidencia del Anexo de Nube');
  assert.ok(!/[^\x00-\x7F]/.test(evidencia));
});

test('la evidencia dice quien firmo por la Empresa y con que poder', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const evidencia = leerCopia().anexo_encargo.evidencia;
  assert.match(evidencia, /representante/i);
  assert.match(evidencia, /verifico documentalmente/i);
});

test('la evidencia deja la fecha de EJECUCION en la ficha de la Empresa', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);

  const empresa = db.prepare(
    'SELECT anexo_encargo_firmado_at FROM gh_firma_empresas WHERE id_empresa = ?',
  ).get(ID_EMPRESA);
  const evidencia = leerCopia().anexo_encargo.evidencia;
  assert.ok(evidencia.includes(empresa.anexo_encargo_firmado_at),
    'la evidencia dice la fecha con la que la Empresa queda habilitada');
});

// ===========================================================================
// 4. LAS INCONGRUENCIAS
// ===========================================================================

test('contrafirmada pero sin fecha en la ficha es una incongruencia: codigo 5', async () => {
  const { idSuscripcion } = await sembrarFlujo({ contrafirmar: true });
  // Las dos escrituras van en una sola transaccion: simular que solo una
  // quedo es la incongruencia que el script tiene que reportar.
  db.prepare('UPDATE gh_firma_empresas SET anexo_encargo_firmado_at = NULL')
    .run();
  const antes = fs.readFileSync(copia, 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => e.codigo === 5,
    'no se promedian las dos escrituras',
  );
  assert.equal(fs.readFileSync(copia, 'utf8'), antes);
  assert.ok(suscripcion(idSuscripcion).contrafirmado_at, 'la suscripcion sigue contrafirmada');
});

// ===========================================================================
// 5. LOS ARGUMENTOS Y LOS ERRORES
// ===========================================================================

test('un argumento desconocido se rechaza con codigo 2', () => {
  assert.throws(
    () => script.main(['--inventado']),
    (e) => e.codigo === 2,
  );
});

test('--manifiesto sin ruta se rechaza con codigo 2', () => {
  assert.throws(
    () => script.main(['--manifiesto']),
    (e) => e.codigo === 2,
  );
});

test('un manifiesto que no es JSON se rechaza con codigo 3', () => {
  fs.writeFileSync(copia, '{esto no es json', 'utf8');
  assert.throws(
    () => script.main(['--manifiesto', copia]),
    (e) => e.codigo === 3,
  );
});

test('si el texto del servidor no tiene la huella del manifiesto, no se escribe', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const antes = fs.readFileSync(copia, 'utf8');
  const otroTexto = path.join(tmp, 'anexo-encargo-otro.html');
  fs.writeFileSync(otroTexto, '<html>otro texto</html>', 'utf8');

  assert.throws(
    () => script.main(['--manifiesto', copia, '--texto', otroTexto]),
    (e) => e.codigo === 3,
    'no se firma un texto que nadie ha verificado',
  );
  assert.equal(fs.readFileSync(copia, 'utf8'), antes);
});

// ===========================================================================
// 6. --CHECK
// ===========================================================================

test('--check NO escribe y dice que el estado es otro', async () => {
  await sembrarFlujo({ contrafirmar: true });
  const antes = fs.readFileSync(copia, 'utf8');

  const salida = script.main(['--manifiesto', copia, '--check']);
  assert.equal(salida.ok, true);
  assert.equal(salida.solo_check, true);
  assert.equal(salida.coincide, false, 'el manifiesto todavia no dice "firmado"');
  assert.equal(salida.estado, 'no_firmado', 'informa del estado que HAY');
  assert.equal(fs.readFileSync(copia, 'utf8'), antes, '--check no escribe');
});

test('--check, despues de escribir, dice que coincide', async () => {
  await sembrarFlujo({ contrafirmar: true });
  script.main(['--manifiesto', copia]);
  const despues = fs.readFileSync(copia, 'utf8');

  const salida = script.main(['--manifiesto', copia, '--check']);
  assert.equal(salida.coincide, true);
  assert.equal(salida.estado, 'firmado');
  assert.equal(fs.readFileSync(copia, 'utf8'), despues, '--check no escribe');
});

// ===========================================================================
// 7. LAS PIEZAS SUELTAS
// ===========================================================================

test('aAscii quita tildes y eñes', () => {
  assert.equal(script.aAscii('Vásquez Muñoz'), 'Vasquez Munoz');
  assert.equal(script.aAscii('Ñoño'), 'Nono');
  assert.equal(script.aAscii('ÁÉÍÓÚ'), 'AEIOU');
  assert.equal(script.aAscii(null), '');
  assert.equal(script.aAscii(undefined), '');
});

test('aAscii saca lo que no es ASCII (un signo raro no es informacion)', () => {
  assert.equal(script.aAscii('ACME 100% \u{1F4E6} Ltd'), 'ACME 100%  Ltd');
});

test('ponerEnBloque escribe sobre un valor null', () => {
  const texto = '{\n  "bloque": {\n    "clave": null,\n    "otra": "x"\n  },\n  "fin": 1\n}';
  const salida = script.ponerEnBloque(texto, 'bloque', 'clave', 'valor');
  assert.match(salida, /"clave": "valor"/);
  assert.doesNotThrow(() => JSON.parse(salida));
});

test('ponerEnBloque escribe sobre un valor que ya era string', () => {
  const texto = '{\n  "bloque": {\n    "clave": "viejo"\n  },\n  "fin": 1\n}';
  const salida = script.ponerEnBloque(texto, 'bloque', 'clave', 'nuevo');
  assert.match(salida, /"clave": "nuevo"/);
  assert.doesNotThrow(() => JSON.parse(salida));
});

test('ponerEnBloque escapa las comillas del valor nuevo', () => {
  const texto = '{\n  "bloque": {\n    "clave": null\n  },\n  "fin": 1\n}';
  const salida = script.ponerEnBloque(texto, 'bloque', 'clave', 'con "comilla"');
  assert.doesNotThrow(() => JSON.parse(salida));
  assert.equal(JSON.parse(salida).bloque.clave, 'con "comilla"');
});

test('ponerEnBloque se niega si el bloque o la clave no existen', () => {
  const texto = '{\n  "bloque": {\n    "clave": null\n  }\n}';
  assert.throws(() => script.ponerEnBloque(texto, 'otro', 'clave', 'x'));
  assert.throws(() => script.ponerEnBloque(texto, 'bloque', 'otra', 'x'));
});
