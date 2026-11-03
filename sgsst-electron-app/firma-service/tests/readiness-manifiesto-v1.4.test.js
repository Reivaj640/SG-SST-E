/**
 * tests/readiness-manifiesto-v1.4.test.js
 *
 * J14-5 · TRAZABILIDAD DEL MANIFIESTO
 * ------------------------------------
 * El abogado escribio: "Las claves v1_1_archivo y v1_1_hash contienen el valor
 * de la v1.3. No es un defecto de fondo, pero la Constancia §3 exige que la
 * huella del texto publicado coincida con la del aprobado 'en el manifiesto del
 * servicio': con ese nombre de clave la comprobacion es ambigua."
 *
 * Lo que pedia: "Manifiesto con version y hash del texto publicado, y prueba de
 * la comprobacion automatica."
 *
 * Este archivo es la segunda mitad: la prueba. Sin ella, el manifiesto puede
 * volver a quedar apuntando a una version vieja (que es exactamente lo que
 * paso: el manifiesto decia v1.3 mientras el texto era la v1.4) y nada lo
 * detecta. Un control que compara el documento contra una constante no
 * comprueba el documento: comprueba la constante.
 *
 * Que se fija aca:
 *   - El manifiesto declara la v1.4 con el nombre de clave inequivoco.
 *   - La huella que declara es la del ARCHIVO REAL, no una constante.
 *   - Las dos copias de cada HTML (legal/ y sitio/) son identicas: una sola
 *     huella no puede describir dos textos distintos.
 *   - El manifiesto sigue siendo ASCII puro.
 *   - Nada declara una firma que no existe.
 *   - El reporte de readiness da por buena la huella con el manifiesto real.
 *
 * Los textos son los del repo. No se usan datos de trabajadores ni de empresas.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const readiness = require('../src/services/readinessLegal');

const SERVICE = path.join(__dirname, '..');
const APP = path.join(SERVICE, '..');
const REPO = path.join(APP, '..');
const RUTA_MANIFIESTO = path.join(SERVICE, 'legal-readiness.json');

const CONFIG_TEST = {
  env: 'test',
  canalProteccionDatos: 'privacidad@example.com',
  canalIncidentes: 'seguridad@example.com',
  plazoTramiteDias: 2,
  exigirMedioPersonalOtp: false,
  exigirAnexoNube: false,
};

function sha256De(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function leerManifiestoCrudo() {
  return fs.readFileSync(RUTA_MANIFIESTO, 'utf8');
}

function manifiesto() {
  return JSON.parse(leerManifiestoCrudo());
}

test('manifiesto · declara el Acuerdo v1.4 con la clave inequivoca y su huella real', () => {
  const man = manifiesto();
  assert.equal(man.acuerdo.version, 'v1.4', 'el manifiesto no declara la v1.4');
  assert.equal(
    man.acuerdo.archivo,
    'scripts/fixtures/acuerdo-v1.4.txt',
    'el archivo del Acuerdo no es el de la v1.4',
  );
  assert.equal(
    man.acuerdo.hash,
    sha256De(path.join(SERVICE, 'scripts', 'fixtures', 'acuerdo-v1.4.txt')),
    'la huella del Acuerdo no es la del archivo real',
  );
});

test('manifiesto · no quedan las claves ambiguas v1_1_*', () => {
  const man = manifiesto();
  for (const clave of ['v1_1_archivo', 'v1_1_hash', 'v1_1_fecha']) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(man.acuerdo, clave),
      false,
      `el bloque acuerdo todavia declara ${clave}`,
    );
  }
  assert.ok(man.acuerdo.archivo, 'falta acuerdo.archivo');
  assert.ok(man.acuerdo.hash, 'falta acuerdo.hash');
  assert.ok(man.acuerdo.fecha, 'falta acuerdo.fecha');
});

test('manifiesto · la huella de cada documento es la del archivo real', () => {
  const man = manifiesto();
  assert.equal(
    man.anexo_encargo.hash,
    sha256De(path.join(APP, 'legal', 'anexo-encargo.html')),
    'la huella del Anexo de Encargo no es la del archivo real',
  );
  assert.equal(
    man.anexo_nube.modelo.hash,
    sha256De(path.join(APP, 'legal', 'anexo-nube-v1.0.html')),
    'la huella del Anexo de Nube no es la del archivo real',
  );
  assert.equal(
    man.constancia.hash,
    sha256De(path.join(APP, 'legal', 'constancia-aprobacion-acuerdo.html')),
    'la huella de la Constancia no es la del archivo real',
  );
  assert.equal(
    man.matriz_finalidades.hash,
    sha256De(path.join(SERVICE, 'config', 'matriz-finalidades.json')),
    'la huella de la matriz de finalidades no es la del archivo real',
  );
});

test('manifiesto · las dos copias de cada HTML son identicas', () => {
  // Se publica en legal/ (la app) y en sitio/ (la pagina web). Si las dos
  // copias difieren, hay dos textos y una sola huella no describe los dos.
  const pares = [
    ['anexo-encargo.html'],
    ['anexo-nube-v1.0.html'],
    ['constancia-aprobacion-acuerdo.html'],
  ];
  for (const [nombre] of pares) {
    const a = fs.readFileSync(path.join(APP, 'legal', nombre));
    const b = fs.readFileSync(path.join(REPO, 'sitio', nombre));
    assert.ok(
      a.equals(b),
      `las copias de ${nombre} difieren: legal/ y sitio/ no son el mismo texto`,
    );
  }
});

test('manifiesto · sigue siendo ASCII puro', () => {
  // Re-serializar el manifiesto con JSON.stringify lo convierte en UTF-8 con
  // acentos crudos y el diff se vuelve ilegible. Las notas van escapadas.
  const crudo = leerManifiestoCrudo();
  const noAscii = (crudo.match(/[^\x00-\x7F]/g) || []).length;
  assert.equal(noAscii, 0, `el manifiesto tiene ${noAscii} caracteres no ASCII`);
});

test('manifiesto · no declara ninguna firma que no exista', () => {
  const man = manifiesto();
  assert.equal(man.acuerdo.publicado, false, 'el Acuerdo no esta aprobado ni publicado');
  assert.equal(man.anexo_nube.firmado, false, 'no hay Anexo de Nube firmado por ninguna Empresa');
  assert.equal(man.anexo_nube.hash, null, 'no hay copia firmada del Anexo de Nube');
  assert.equal(man.anexo_encargo.estado, 'no_firmado', 'el Anexo de Encargo sigue sin firmar');
  assert.equal(man.constancia.estado, 'no_firmada', 'la Constancia sigue sin firmar');
});

test('readiness · con el manifiesto real, la huella del Acuerdo queda verificada', () => {
  // Esta es la comprobacion automatica que pide la Constancia §3: el reporte
  // compara la huella del manifiesto contra el TEXTO y dice si coinciden.
  const man = manifiesto();
  const r = readiness.evaluar({
    gate: 'primera_firma',
    db: null,
    config: CONFIG_TEST,
    manifiesto: man,
  });
  const idsPendientes = r.pendientes.map((p) => p.id);
  assert.ok(
    !idsPendientes.includes('hash_v1_1'),
    `hash_v1_1 quedo pendiente: ${JSON.stringify(idsPendientes)}`,
  );
});
