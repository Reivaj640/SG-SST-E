/**
 * EL SCRIPT 1047 NO BORRA LA ACEPTACION DEL CDPA
 * ============================================================================
 *
 * `scripts/actualizar-manifiesto-1047.js` es la SALIDA del manifiesto: reescribe
 * el bloque `subencargados.mail_provider` entero con el estado del canal de
 * correo. Eso incluye el bloque `aceptacion`, que es el registro del ACTO del
 * owner (P1).
 *
 * Si el script lo sobrescribe con `aceptada: false`, entonces:
 *
 *   - correr el script borra el registro de la aceptacion, y
 *   - correr el script DE NUEVO, con el manifiesto ya corregido, lo vuelve a
 *     borrar.
 *
 * O sea: un script que declara "el CDPA no esta aceptado" es un script que
 * puede reventar un cierre ya hecho. Por eso el bloque `aceptacion` NO lo
 * escribe el 1047: lo escribe
 * `scripts/actualizar-manifiesto-aceptacion-cdpa.js`, desde un acta, y el 1047
 * lo CONSERVA.
 *
 * Lo que se verifica aca:
 *
 *   - Que una aceptacion registrada sobrevive al 1047.
 *   - Que, sin aceptacion registrada, el 1047 escribe el estado pendiente.
 *   - Que la fecha del CDPA es la de la captura verificada, y no una fecha
 *     que Google no declara: la pagina publicada no dice ninguna fecha.
 *   - Que correrlo dos veces con la aceptacion registrada deja el archivo
 *     identico.
 */
'use strict';

const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = require('../../scripts/actualizar-manifiesto-1047');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');
const TEXTO_ENCARGO_REAL = path.join(SERVICE_ROOT, '..', 'legal', 'anexo-encargo.html');

let tmp;
let copia;

/** Una aceptacion completa del CDPA, como la deja el script hermano. */
function aceptacionRegistrada() {
  return {
    aceptada: true,
    modo: 'incorporado_por_referencia',
    fecha: '2026-11-10',
    fecha_efectividad_addendum: null,
    evidencia: 'Evidencia de prueba.',
    responsable: 'owner',
    cuenta: 'gesstiar.com (Google Workspace)',
    at_testacion: 'Atestacion de prueba.',
    acuerdo: { url: 'https://workspace.google.com/terms/premier_terms/?hl=en', hash: 'a'.repeat(64) },
    cdpa: { url: 'https://admin.google.com/terms/apps/8/1/en/dpa_terms.html', hash: 'b'.repeat(64) },
    captura: null,
    observaciones: null,
    registrado_por: 'scripts/actualizar-manifiesto-aceptacion-cdpa.js',
    nota: 'Nota de prueba.',
  };
}

function escribir(man) {
  fs.writeFileSync(copia, script.asciiEscape(JSON.stringify(man, null, 2)) + '\n', 'utf8');
}

function leer() {
  return JSON.parse(fs.readFileSync(copia, 'utf8'));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-1047-'));
  copia = path.join(tmp, 'legal-readiness.json');
  escribir(JSON.parse(fs.readFileSync(MANIFIESTO_REAL, 'utf8')));
});

afterEach(() => {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) { /* la carpeta temporal no se limpia: no es un fallo del test */ }
});

test('1047 · la aceptacion del CDPA registrada NO se borra al correr el script', () => {
  const man = leer();
  man.subencargados.mail_provider.aceptacion = aceptacionRegistrada();
  escribir(man);

  script.main(['--manifiesto', copia]);

  const acc = leer().subencargados.mail_provider.aceptacion;
  assert.equal(acc.aceptada, true, 'la aceptacion se borro: el 1047 la sobrescribio');
  assert.equal(acc.modo, 'incorporado_por_referencia');
  assert.equal(acc.fecha, '2026-11-10');
  assert.equal(acc.evidencia, 'Evidencia de prueba.');
});

test('1047 · sin aceptacion registrada, el script escribe el estado pendiente', () => {
  const man = leer();
  delete man.subencargados.mail_provider.aceptacion;
  escribir(man);

  script.main(['--manifiesto', copia]);

  const acc = leer().subencargados.mail_provider.aceptacion;
  assert.equal(acc.aceptada, false);
  assert.ok(acc.nota.length > 0, 'el estado pendiente tiene que decir que falta');
});

test('1047 · la fecha del CDPA es la de la captura verificada: la pagina de Google no declara fecha', () => {
  script.main(['--manifiesto', copia]);

  const mp = leer().subencargados.mail_provider;
  assert.equal(mp.fecha, '2026-11-10',
    'la fecha del CDPA tiene que ser la de la descarga verificada');
  assert.equal(mp.fecha_declarada_por_google, null,
    'la pagina publicada no declara ninguna fecha: no se escribe una');
  assert.match(mp.version, /NO declara fecha/i);
});

test('1047 · correrlo dos veces con la aceptacion registrada deja el archivo identico', () => {
  const man = leer();
  man.subencargados.mail_provider.aceptacion = aceptacionRegistrada();
  escribir(man);

  script.main(['--manifiesto', copia]);
  const primera = fs.readFileSync(copia);
  script.main(['--manifiesto', copia]);
  assert.deepEqual(fs.readFileSync(copia), primera);
});

// ===========================================================================
// LA HISTORIA DEL ANEXO DE NUBE
// ===========================================================================
//
// `versiones_firmadas` son las suscripciones ANTERIORES: las que se
// suscribieron en su dia y ya no son el texto vigente. El texto vigente se
// describe en el bloque principal (`firmado`, `fecha`, `version`, `hash`,
// `evidencia`, `contrafirmado`).
//
// DEFECTO CORREGIDO EL 12-NOV-2026: el script empujaba a la historia la
// firma que el manifiesto declaraba, sin comprobar si describia el texto
// vigente. Al correrlo sin cambiar de texto, la v1.3 (suscrita y
// contrafirmada el 12-nov-2026) quedaba registrada DOS veces: una como
// vigente y otra como si fuera una version anterior ya superada, y la
// entrada de la historia llevaba la evidencia del PRIMER acto, sin la del
// segundo. Estos dos tests fijan la regla: a la historia solo pasa una firma
// que NO describe el texto vigente.

test('1047 · la firma del TEXTO VIGENTE no pasa a la historia', () => {
  const man = leer();
  const vigente = man.anexo_nube;

  // El estado "firmado" del texto vigente se arma ACA, a partir del bloque
  // `modelo` (que es la identidad del texto vigente: su version y su huella).
  // El manifiesto real puede declarar el texto vigente como NO firmado
  // (mientras la Empresa no se suscribe), y un test no puede dar por cierto
  // eso: lo que se prueba es la REGLA, no el estado de un dia.
  const versionVigente = vigente.modelo.version;
  const hashVigente = vigente.modelo.hash;
  assert.ok(versionVigente && hashVigente,
    'el bloque modelo declara la version y la huella del texto vigente');
  man.anexo_nube.firmado = true;
  man.anexo_nube.version = versionVigente;
  man.anexo_nube.hash = hashVigente;
  man.anexo_nube.fecha = '2026-11-12T15:38:27.990Z';

  // Se simula el estado defectuoso: el texto vigente firmado, y su version
  // ausente de la historia.
  man.anexo_nube.versiones_firmadas = (man.anexo_nube.versiones_firmadas || [])
    .filter((x) => !(x && x.version === versionVigente));
  escribir(man);

  script.main(['--manifiesto', copia]);

  const despues = leer().anexo_nube;
  const repetida = (despues.versiones_firmadas || []).filter((x) => x
    && x.version === versionVigente
    && String(x.hash || '').toLowerCase() === String(hashVigente).toLowerCase());
  assert.equal(repetida.length, 0,
    'la firma del texto vigente quedo registrada dos veces: una como vigente y otra en la historia');
  assert.equal(despues.firmado, true,
    'la firma del texto vigente se perdio: el texto vigente no cambio');
  assert.equal(despues.version, versionVigente,
    'el texto vigente cambio de version al correr el script');
});

test('1047 · la firma de un texto ANTERIOR si pasa a la historia', () => {
  const man = leer();
  // Un texto que ya NO es el vigente: la v1.1, con su huella de prueba.
  man.anexo_nube.firmado = true;
  man.anexo_nube.version = '1.1';
  man.anexo_nube.hash = 'e'.repeat(64);
  man.anexo_nube.fecha = '2026-11-05T22:51:34.349Z';
  man.anexo_nube.versiones_firmadas = [];
  escribir(man);

  script.main(['--manifiesto', copia]);

  const despues = leer().anexo_nube;
  const v11 = (despues.versiones_firmadas || []).find((x) => x && x.version === '1.1');
  assert.ok(v11, 'la firma de un texto anterior no paso a la historia');
  assert.equal(despues.firmado, false,
    'una firma que no describe el texto vigente no puede quedar declarada: '
    + 'seria un verde falso');
  assert.equal(despues.hash, null,
    'la huella que no describe el texto vigente no puede quedar declarada');
});

test('1047 · la firma anterior del Anexo de Encargo si pasa a la historia', () => {
  // DEFECTO CORREGIDO EL 14-NOV-2026: el bloque del Anexo de Encargo no
  // empujaba la suscripcion anterior al historial (el del Anexo de Nube si lo
  // hacia, desde el 12-nov-2026). Al publicar la version 2026-11-12, la
  // suscripcion del 2026-11-11 (la que ASEPLUS suscribio y K+AIR contrafirmo el
  // 12-nov-2026) se perdia del manifiesto: un instrumento ejecutado no puede
  // desaparecer del expediente.
  const man = leer();
  const versionAnterior = '2026-11-11';
  const hashAnterior = 'f'.repeat(64);
  man.anexo_encargo.estado = 'firmado';
  man.anexo_encargo.version = versionAnterior;
  man.anexo_encargo.hash = hashAnterior;
  man.anexo_encargo.fecha = '2026-11-12T16:14:31.105Z';
  man.anexo_encargo.evidencia = 'Evidencia de prueba.';
  man.anexo_encargo.versiones_firmadas = [];
  escribir(man);

  script.main(['--manifiesto', copia]);

  const despues = leer().anexo_encargo;
  const anterior = (despues.versiones_firmadas || [])
    .find((x) => x && x.version === versionAnterior);
  assert.ok(anterior, 'la firma de un texto anterior del Anexo de Encargo no paso a la historia');
  assert.equal(anterior.hash, hashAnterior, 'la entrada de la historia trae su huella');
  assert.equal(despues.estado, 'no_firmado',
    'una firma que no describe el texto vigente no puede quedar declarada: '
    + 'seria un verde falso');
  assert.equal(despues.version, '2026-11-12',
    'el texto vigente del Anexo de Encargo es el nuevo');
});

test('1047 · la suscripcion del Anexo de Encargo NO se reescribe al publicar', () => {
  // Lo que ya se suscribio queda en `versiones_firmadas` con su evidencia: la
  // bitacora es append-only. Este test mira el manifiesto REAL, que ya lleva
  // la suscripcion del 2026-11-11 en la historia (la publico el 14-nov-2026).
  const man = leer();
  const historial = (man.anexo_encargo.versiones_firmadas || []);
  const v1111 = historial.find((x) => x && x.version === '2026-11-11');
  assert.ok(v1111, 'la suscripcion del 2026-11-11 no quedo en la historia');
  assert.equal(
    String(v1111.hash || '').toLowerCase(),
    '6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948',
    'con la huella del texto que la Empresa suscribio el 12-nov-2026',
  );
  assert.ok(v1111.evidencia, 'con su evidencia');

  // EL ESTADO DEL TEXTO VIGENTE NO SE FIJA AQUI: SE FIJA SU COHERENCIA.
  //
  // El texto vigente (el 2026-11-12) no estaba suscrito cuando se escribio este
  // test, y el 14-nov-2026 quedo suscrito y contrafirmado. Un test que congela
  // el estado del mundo se rompe con cada acto, y uno que solo mira el estado
  // no prueba nada. Lo que se prueba es la REGLA: si el manifiesto declara una
  // firma, esa firma tiene que describir el texto vigente de verdad (misma
  // version, misma huella del archivo real) y traer su fecha y su evidencia.
  const hashVigente = crypto.createHash('sha256')
    .update(fs.readFileSync(TEXTO_ENCARGO_REAL)).digest('hex');
  if (man.anexo_encargo.estado === 'firmado') {
    assert.equal(man.anexo_encargo.version, '2026-11-12',
      'la firma declarada tiene que describir el texto vigente');
    assert.equal(String(man.anexo_encargo.hash || '').toLowerCase(), hashVigente,
      'la firma declarada tiene que traer la huella del texto vigente: si el archivo '
      + 'cambio, la firma ya no lo describe y no puede quedar declarada');
    assert.ok(man.anexo_encargo.fecha, 'una firma declarada tiene que traer su fecha');
    assert.ok(man.anexo_encargo.evidencia, 'una firma declarada tiene que traer su evidencia');
  } else {
    assert.equal(man.anexo_encargo.estado, 'no_firmado',
      'sin los dos actos, el estado del texto vigente es "no_firmado"');
  }
});
