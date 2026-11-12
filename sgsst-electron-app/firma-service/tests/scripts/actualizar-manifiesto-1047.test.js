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
const fs = require('fs');
const os = require('os');
const path = require('path');

const script = require('../../scripts/actualizar-manifiesto-1047');

const SERVICE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO_REAL = path.join(SERVICE_ROOT, 'legal-readiness.json');

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
  assert.equal(vigente.firmado, true,
    'el manifiesto real declara firmado el texto vigente: este test lo da por cierto');
  assert.ok(vigente.version && vigente.hash,
    'el manifiesto real declara la version y la huella del texto vigente');

  // Se simula el estado defectuoso: el texto vigente firmado, y su version
  // ausente de la historia.
  man.anexo_nube.versiones_firmadas = (man.anexo_nube.versiones_firmadas || [])
    .filter((x) => !(x && x.version === vigente.version));
  escribir(man);

  script.main(['--manifiesto', copia]);

  const despues = leer().anexo_nube;
  const repetida = (despues.versiones_firmadas || []).filter((x) => x
    && x.version === vigente.version
    && String(x.hash || '').toLowerCase() === String(vigente.hash || '').toLowerCase());
  assert.equal(repetida.length, 0,
    'la firma del texto vigente quedo registrada dos veces: una como vigente y otra en la historia');
  assert.equal(despues.firmado, true,
    'la firma del texto vigente se perdio: el texto vigente no cambio');
  assert.equal(despues.version, vigente.version,
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
