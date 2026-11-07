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

test('manifiesto · declara el Acuerdo vigente con la clave inequivoca y su huella real', () => {
  const man = manifiesto();
  // El Acuerdo se compara contra el archivo de SU VERSION, no contra una
  // constante: el manifiesto es el que dice cuál es. Un control que compara
  // el documento contra una constante no comprueba el documento: comprueba la
  // constante (y cuando el texto cambia de versión, el control se rompe sin
  // que nadie haya tocado nada).
  assert.ok(man.acuerdo.version, 'el manifiesto no declara la version del Acuerdo');
  assert.ok(man.acuerdo.archivo, 'el manifiesto no declara el archivo del Acuerdo');
  const rutaAcuerdo = path.join(SERVICE, man.acuerdo.archivo);
  assert.ok(
    fs.existsSync(rutaAcuerdo),
    `el archivo del Acuerdo no existe: ${man.acuerdo.archivo}`,
  );
  assert.equal(
    man.acuerdo.hash,
    sha256De(rutaAcuerdo),
    'la huella del Acuerdo no es la del archivo real',
  );
  // Y la version que declara el manifiesto tiene que ser la que el texto
  // nombra en su encabezado: el texto se sella en los dos lugares donde dice
  // cual es (el encabezado y la Manifestacion de Voluntad).
  const encabezado = fs.readFileSync(rutaAcuerdo, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('Versión del Acuerdo:'));
  assert.ok(encabezado, 'el texto del Acuerdo no tiene la linea de version');
  assert.equal(
    man.acuerdo.version,
    encabezado.slice('Versión del Acuerdo:'.length).trim(),
    'el manifiesto declara una version que el texto del Acuerdo no dice',
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
  // El Anexo de Nube se compara contra el archivo de SU VERSION, no contra
  // una constante: el manifiesto es el que dice cuál es. Un control que
  // compara el documento contra una constante no comprueba el documento:
  // comprueba la constante (y cuando el texto cambia de versión, el control
  // se rompe sin que nadie haya tocado nada).
  const versionNube = man.anexo_nube.modelo.version;
  assert.ok(versionNube, 'el manifiesto no declara la versión del Anexo de Nube');
  assert.equal(
    man.anexo_nube.modelo.hash,
    sha256De(path.join(APP, 'legal', `anexo-nube-v${versionNube}.html`)),
    'la huella del Anexo de Nube no es la del archivo real',
  );
  assert.equal(
    man.anexo_nube.modelo.bytes,
    fs.statSync(path.join(APP, 'legal', `anexo-nube-v${versionNube}.html`)).size,
    'el tamaño declarado del Anexo de Nube no es el del archivo real',
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

test('manifiesto · la version del Anexo de Encargo es la que declara el documento', () => {
  // El manifiesto dice qué texto se firma; el texto dice cuál es su versión.
  // Si los dos no dicen lo mismo, hay dos Anexos de Encargo y una sola huella
  // no describe los dos. El 5-nov-2026 pasó exactamente eso: el manifiesto
  // declaraba 2026-11-05 y el documento seguía diciendo 2026-10-30 en su
  // encabezado. Por eso la versión se contrasta contra el TEXTO, y no contra
  // una constante.
  const man = manifiesto();
  const texto = fs.readFileSync(path.join(APP, 'legal', 'anexo-encargo.html'), 'utf8');
  const declarado = texto.match(/<meta name="version" content="([^"]+)">/);
  assert.ok(declarado, 'el Anexo de Encargo no declara su versión en el encabezado');
  assert.equal(
    man.anexo_encargo.version,
    declarado[1],
    'el manifiesto declara una versión que el Anexo de Encargo no dice',
  );

  // Y la línea de fecha y el pie del documento dicen lo mismo que el
  // encabezado: un documento con dos etiquetas distintas se publica igual de
  // roto.
  const lineaFecha = texto.split('\n').find((l) => l.includes('<p class="fecha">'));
  assert.ok(lineaFecha, 'el Anexo de Encargo no tiene la línea de fecha');
  assert.ok(
    lineaFecha.includes(`Versi&oacute;n ${declarado[1]}`),
    `la línea de fecha no declara la versión del encabezado: ${lineaFecha}`,
  );

  // La fuente de la que sale esa etiqueta es la misma matriz del manifiesto.
  const matriz = JSON.parse(
    fs.readFileSync(path.join(SERVICE, 'config', 'matriz-finalidades.json'), 'utf8'),
  );
  assert.equal(
    matriz.instruccion.version,
    declarado[1],
    'la fuente de la matriz declara otra versión que el Anexo de Encargo',
  );
});

test('manifiesto · la matriz de finalidades que declara coincide con la fuente', () => {
  const man = manifiesto();
  const matriz = JSON.parse(
    fs.readFileSync(path.join(SERVICE, 'config', 'matriz-finalidades.json'), 'utf8'),
  );
  assert.equal(
    man.matriz_finalidades.version,
    matriz.version,
    'el manifiesto declara una versión de la matriz que la fuente no tiene',
  );
  assert.equal(
    man.matriz_finalidades.actualizado_at,
    matriz.actualizado_at,
    'el manifiesto declara una fecha de la matriz que la fuente no tiene',
  );
});

test('manifiesto · el Anexo de Nube que declara es el que el servicio suscribe', () => {
  // El acoplamiento que importa: el manifiesto y la compuerta de readiness
  // tienen que describir el MISMO texto que `services/anexoNube.js` firma.
  // Si no, el sistema dice una cosa y firma otra.
  const man = manifiesto();
  const anexoNube = require('../src/services/anexoNube');

  assert.equal(
    man.anexo_nube.modelo.version,
    anexoNube.VERSION_MODELO,
    'el manifiesto declara un Anexo de Nube distinto del que el servicio suscribe',
  );
  assert.equal(
    man.anexo_nube.modelo.hash,
    anexoNube.modeloVigente().hash,
    'la huella del manifiesto no es la del archivo que el servicio suscribe',
  );
  assert.equal(
    path.basename(readiness.RUTAS_DEFAULT.anexoNube),
    `anexo-nube-v${anexoNube.VERSION_MODELO}.html`,
    'la compuerta de readiness analiza un Anexo de Nube distinto del que se suscribe',
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

test('manifiesto · el Anexo de Nube vigente, si está publicado, es el mismo texto', () => {
  // La v1.1 todavía NO está publicada en `sitio/` (falta la confirmación del
  // owner). La comprobación se activa SOLO cuando el archivo aparece: en
  // cuanto se publique, tiene que ser byte a byte el de `legal/`, porque la
  // huella que se registra es la de `legal/`.
  const man = manifiesto();
  const nombre = `anexo-nube-v${man.anexo_nube.modelo.version}.html`;
  const enSitio = path.join(REPO, 'sitio', nombre);
  if (!fs.existsSync(enSitio)) {
    assert.ok(true, `${nombre} todavía no está publicado en sitio/ (esperado hasta la confirmación del owner)`);
    return;
  }
  const a = fs.readFileSync(path.join(APP, 'legal', nombre));
  const b = fs.readFileSync(enSitio);
  assert.ok(
    a.equals(b),
    `las copias de ${nombre} difieren: legal/ y sitio/ no son el mismo texto`,
  );
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
  // El Acuerdo: si el manifiesto dice que esta publicado, tiene que declarar
  // la version, la huella y el archivo, y el archivo tiene que existir. QUE
  // el texto este vivo en la base no lo comprueba este archivo: lo comprueba
  // el gate, contra la base.
  if (man.acuerdo.publicado) {
    assert.ok(man.acuerdo.version, 'un Acuerdo publicado tiene que declarar su version');
    assert.ok(man.acuerdo.hash, 'un Acuerdo publicado tiene que declarar su huella');
    assert.ok(
      fs.existsSync(path.join(SERVICE, man.acuerdo.archivo)),
      'un Acuerdo publicado tiene que apuntar a un archivo que existe',
    );
  }
  // El Anexo de Nube: si el manifiesto declara una firma, tiene que estar
  // COMPLETA. No se exige aquí un valor concreto: la firma la registra el
  // owner cuando ocurre y el gate la contrasta contra la base. Lo que este
  // test impide es declarar media firma (firmado=true sin fecha, versión,
  // huella o evidencia) o una firma fantasma con los campos en null.
  if (man.anexo_nube.firmado) {
    assert.ok(
      typeof man.anexo_nube.fecha === 'string'
        && !Number.isNaN(new Date(man.anexo_nube.fecha).getTime()),
      'un Anexo de Nube firmado tiene que declarar una fecha válida',
    );
    assert.ok(man.anexo_nube.version, 'un Anexo de Nube firmado tiene que declarar su versión');
    assert.match(
      man.anexo_nube.hash || '',
      /^[0-9a-f]{64}$/,
      'un Anexo de Nube firmado tiene que declarar su huella SHA-256',
    );
    assert.ok(
      typeof man.anexo_nube.evidencia === 'string' && man.anexo_nube.evidencia.trim() !== '',
      'un Anexo de Nube firmado tiene que declarar su evidencia',
    );
  } else {
    assert.equal(man.anexo_nube.fecha, null, 'sin firma no puede haber fecha');
    assert.equal(man.anexo_nube.version, null, 'sin firma no puede haber versión');
    assert.equal(man.anexo_nube.hash, null, 'sin firma no puede haber huella');
    assert.equal(man.anexo_nube.evidencia, null, 'sin firma no puede haber evidencia');
  }
  // El Anexo de Encargo: el estado lo declara el owner cuando ocurre la
  // firma, asi que aqui no se exige un valor concreto. Lo que este test
  // impide es declarar MEDIA firma (estado "firmado" sin fecha o sin
  // evidencia) o una firma fantasma (estado "firmado" con la fecha y la
  // evidencia en null). Es el mismo criterio del Anexo de Nube, arriba.
  if (man.anexo_encargo.estado === 'firmado') {
    assert.ok(
      typeof man.anexo_encargo.fecha === 'string'
        && !Number.isNaN(new Date(man.anexo_encargo.fecha).getTime()),
      'un Anexo de Encargo firmado tiene que declarar una fecha válida',
    );
    assert.ok(
      typeof man.anexo_encargo.evidencia === 'string' && man.anexo_encargo.evidencia.trim() !== '',
      'un Anexo de Encargo firmado tiene que declarar su evidencia',
    );
  } else {
    assert.equal(man.anexo_encargo.estado, 'no_firmado',
      'un Anexo de Encargo sin firmar dice "no_firmado"');
    assert.equal(man.anexo_encargo.fecha, null, 'sin firma no puede haber fecha');
    assert.equal(man.anexo_encargo.evidencia, null, 'sin firma no puede haber evidencia');
  }
  // La Constancia: el mismo criterio. El owner la firma cuando procede.
  if (man.constancia.estado === 'firmada') {
    assert.ok(man.constancia.fecha, 'una Constancia firmada tiene que declarar su fecha');
    assert.ok(man.constancia.evidencia, 'una Constancia firmada tiene que declarar su evidencia');
  } else {
    assert.equal(man.constancia.estado, 'no_firmada',
      'una Constancia sin firmar dice "no_firmada"');
    assert.equal(man.constancia.fecha, null, 'sin firma no puede haber fecha');
    assert.equal(man.constancia.evidencia, null, 'sin firma no puede haber evidencia');
  }
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
