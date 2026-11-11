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
