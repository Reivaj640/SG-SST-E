/**
 * LOS CANDIDATOS DE LA v1.4 SE COMPRUEBAN A SI MISMOS
 * ====================================================
 *
 * QUE HACE ESTE TEST
 * ------------------
 * Los candidatos de la v1.4 y del Encargo 2026-11-12 se arman por un programa
 * (`scripts/generar-candidatos-v1.4.js`) en dos fases: C1 a C7, y las
 * determinaciones legales de la mesa L1 a L7. Ese programa **se niega a
 * escribir** si una ancla no casa exactamente una vez, pero un candida que
 * "sale sin error" no es lo mismo que un candida que dice lo que debe decir.
 *
 * LO QUE SE VERIFICA ACA
 * ----------------------
 * - Que el generador en modo `--estado` **no escribe nada** y sale con 0.
 * - Que los **textos vigentes y el manifiesto quedan intactos** (byte a byte).
 * - Que el candidato del Nube dice lo que la determinacion de L1 decidio:
 *   Google LLC, ocho celdas en su fila, transmision y no transferencia, el
 *   art. 26 que no se activa, la auditoria que no se activa, Backblaze.
 * - Que el candidato del Encargo lleva la version 2026-11-12 unificada y el
 *   papel de Google como Encargado.
 * - Que **el texto del candidato es byte a byte el de la determinacion**: no
 *   hay texto inventado entre el dictamen y el candidato.
 * - Que el generador **se niega** cuando una ancla no casa.
 * - Que es **idempotente**: dos corridas dan el mismo resultado.
 *
 * NADA DE ESTO TOCA LOS TEXTOS VIGENTES NI EL MANIFIESTO.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SERVICIO = path.resolve(__dirname, '..', '..');
const APP = path.resolve(SERVICIO, '..');
const GENERADOR = path.join(SERVICIO, 'scripts', 'generar-candidatos-v1.4.js');
const DETERMINACIONES = path.join(SERVICIO, 'scripts', 'determinaciones-v1.4.js');
const CANDIDATOS = path.join(APP, 'docs', 'gestion-humana', 'firma-electronica', 'candidatos-v1.4');
const LEGAL = path.join(APP, 'legal');

const NUBE_CANDIDATO = path.join(CANDIDATOS, 'anexo-nube-v1.4.html');
const ENCARGO_CANDIDATO = path.join(CANDIDATOS, 'anexo-encargo-2026-11-12.html');

/**
 * El hash de un archivo.
 * @param {string} archivo
 * @returns {string}
 */
function sha256(archivo) {
  return require('crypto').createHash('sha256')
    .update(fs.readFileSync(archivo))
    .digest('hex');
}

/**
 * Corre el generador en modo `--estado` (que no escribe) y devuelve su salida.
 * @returns {string}
 */
function correrEnEstado() {
  return execFileSync(process.execPath, [GENERADOR, '--estado'], {
    encoding: 'utf8',
    cwd: SERVICIO,
  });
}

/**
 * El texto sin saltos de linea, para comparar frases que el documento parte
 * en varias lineas.
 * @param {string} texto
 * @returns {string}
 */
function plano(texto) {
  return texto.replace(/\s+/g, ' ');
}

test('el generador en modo --estado no escribe nada y sale con 0', () => {
  const antes = {
    nube: sha256(NUBE_CANDIDATO),
    encargo: sha256(ENCARGO_CANDIDATO),
    v13: sha256(path.join(LEGAL, 'anexo-nube-v1.3.html')),
    encargoVigente: sha256(path.join(LEGAL, 'anexo-encargo.html')),
    manifiesto: sha256(path.join(SERVICIO, 'legal-readiness.json')),
  };
  const salida = correrEnEstado();
  assert.equal(salida.includes('NO SE ESCRIBE NADA'), false, 'no dice que fallo');
  assert.equal(salida.includes('Determinaciones L1/L4/L5'), true,
    'aplica las determinaciones legales');
  const despues = {
    nube: sha256(NUBE_CANDIDATO),
    encargo: sha256(ENCARGO_CANDIDATO),
    v13: sha256(path.join(LEGAL, 'anexo-nube-v1.3.html')),
    encargoVigente: sha256(path.join(LEGAL, 'anexo-encargo.html')),
    manifiesto: sha256(path.join(SERVICIO, 'legal-readiness.json')),
  };
  assert.deepEqual(despues, antes,
    'ni los candidatos, ni los textos vigentes, ni el manifiesto cambian');
});

test('el generador es idempotente: dos corridas dan lo mismo', () => {
  const primera = correrEnEstado();
  const segunda = correrEnEstado();
  const linea = (s) => s.split('\n').filter((l) => l.indexOf('sha256') >= 0).join('\n');
  assert.equal(linea(primera), linea(segunda),
    'las dos corridas imprimen los mismos hashes');
});

test('el Anexo de Nube v1.4 dice lo que la determinacion de L1 decidio', () => {
  const texto = fs.readFileSync(NUBE_CANDIDATO, 'utf8');
  const planoTexto = plano(texto);

  // La fila de Google tiene EXACTAMENTE ocho celdas (la novena era un
  // residuo que abria una columna que el encabezado no declara).
  const ini = texto.indexOf('<td>Google LLC (Google Workspace)</td>');
  assert.ok(ini > 0, 'esta la fila de Google');
  const fila = texto.slice(texto.lastIndexOf('<tr>', ini), texto.indexOf('</tr>', ini));
  assert.equal((fila.match(/<td>/g) || []).length, 8,
    'la fila de Google tiene ocho celdas');

  assert.ok(planoTexto.includes('transmisi&oacute;n internacional a un Encargado'),
    'la comunicacion al exterior es una transmision, no una transferencia');
  assert.ok(planoTexto.includes('no se activa la prohibici&oacute;n de transferencia del art&iacute;culo 26'),
    'el art. 26 no se activa');
  assert.ok(planoTexto.includes('art&iacute;culo 24, numeral 2'), 'rige el art. 24 num. 2');
  assert.ok(planoTexto.includes('Subencargado es una figura contractual'),
    'Subencargado es figura contractual, no categoria legal');
  assert.ok(planoTexto.includes('est&aacute; condicionado a que se aplique la Ley Europea'),
    'el derecho de auditoria del 7.5.2(a) esta condicionado');
  assert.ok(planoTexto.includes('cualquier pa&iacute;s en que Google o sus subencargados tengan instalaciones'),
    'Estados Unidos es uno de los paises posibles, no el unico');
  assert.ok(planoTexto.includes('el texto oficial no declara fecha de versi&oacute;n'),
    'el CDPA se identifica por huella, no por fecha');
  assert.ok(planoTexto.includes('<td>Backblaze, Inc.</td>'), 'Backblaze entro como subencargado');
  assert.ok(planoTexto.includes('Los dos instrumentos anteriores s&iacute; quedaron suscritos y contrafirmados'),
    'se declaran los actos del 12-nov');
  assert.ok(planoTexto.includes('Esta versi&oacute;n 1.4'),
    'se declara que esta version 1.4 no esta suscrita');
  assert.ok(planoTexto.includes('Decreto 1377 de 2013, art&iacute;culo 2, numerales 4 y 5'),
    'el §11 cita el Decreto 1377');

  // Y NO puede quedar lo que la determinacion corrigio.
  assert.equal(texto.includes('determinado en el &sect;5 del Anexo de Encargo:'), false,
    'la linea huerfana no queda');
  assert.equal(texto.includes('no crea, no declara ni presupone'), false,
    'el parrafo del contrato de transmision quedo sustituido');
  assert.equal(texto.includes('hasta que el owner decida el destino'), false,
    'el destino ya se decidio: el C2 quedo corregido');
  assert.equal(texto.includes('transferencia internacional a Estados Unidos'), false,
    'no queda la clasificacion de transferencia que la determinacion corrigio');
});

test('el Anexo de Encargo 2026-11-12 lleva la version unificada', () => {
  const texto = fs.readFileSync(ENCARGO_CANDIDATO, 'utf8');
  const lineas = texto.split('\n');
  assert.equal(lineas[7], '<meta name="version" content="2026-11-12">',
    'la meta dice 2026-11-12');
  assert.ok(lineas[33].includes('12 de noviembre de 2026') && lineas[33].includes('2026-11-12'),
    'la cabecera dice 12 de noviembre de 2026, version 2026-11-12');
  assert.ok(plano(texto).includes('Determinaci&oacute;n del papel del proveedor de correo (Google LLC)'),
    'el §5 determina el papel del proveedor');
  assert.ok(plano(texto).includes('las certificaciones y revisiones y los subencargados'),
    'la remision dice certificaciones y revisiones, no auditoria');
  assert.ok(plano(texto).includes('los dos instrumentos anteriores no son pasos pendientes'),
    'la prevalencia declara los actos ya ejecutados');
});

test('el texto del candidato es byte a byte el de la determinacion', () => {
  const det = require(DETERMINACIONES);
  const dict = det.leerBloques(det.DICTAMEN);
  const ped = det.leerBloques(det.PEDIDO);
  const resueltos = (piezas) => piezas.map((p) => {
    if (p.t === 'txt') return null;
    const fuente = p.t === 'dict' ? dict : ped;
    const lista = fuente[p.k];
    assert.ok(lista, 'la determinacion tiene la seccion ' + p.k);
    return lista[p.i || 0];
  }).filter((x) => x !== null);

  const nube = fs.readFileSync(NUBE_CANDIDATO, 'utf8');
  const encargo = fs.readFileSync(ENCARGO_CANDIDATO, 'utf8');
  let comprobados = 0;
  for (const r of det.NUBE_RANGOS) {
    for (const texto of resueltos(r.dest)) {
      assert.ok(nube.includes(texto), 'el texto de ' + r.id + ' esta en el candidato, byte a byte');
      comprobados += 1;
    }
  }
  for (const r of det.ENCARGO_RANGOS) {
    for (const texto of resueltos(r.dest)) {
      assert.ok(encargo.includes(texto), 'el texto de ' + r.id + ' esta en el candidato, byte a byte');
      comprobados += 1;
    }
  }
  assert.ok(comprobados >= 15, 'se comprobaron al menos quince textos literales');
});

test('el generador se niega cuando una ancla no casa exactamente una vez', () => {
  const det = require(DETERMINACIONES);

  // (a) Un fragmento que NO esta en el texto: casaria cero veces.
  const texto = 'linea uno\nlinea dos\nlinea tres\n';
  const porFragmento = det.aplicar(
    texto,
    [],
    [{ id: 'PRUEBA-FRAGMENTO', antes: 'esta linea no existe', despues: 'x' }],
    {},
    {}
  );
  assert.equal(porFragmento.problemas.length, 1, 'reporta el problema');
  assert.ok(porFragmento.problemas[0].includes('PRUEBA-FRAGMENTO'), 'dice que ancla es');
  assert.equal(porFragmento.texto, texto, 'no cambia el texto');

  // (b) Un ancla que esta DE MAS: casaria dos veces, y a ciegas se
  // reemplazaria una de las dos sin que nadie lo note.
  const repetido = 'linea uno\nlinea dos\nlinea uno\n';
  const porRango = det.aplicar(
    repetido,
    [{ id: 'PRUEBA-RANGO', donde: 'una linea repetida', desde: 1, hasta: 1, dest: [{ t: 'txt', s: 'x' }] }],
    [],
    {},
    {}
  );
  assert.equal(porRango.problemas.length, 1, 'reporta el problema');
  assert.ok(porRango.problemas[0].includes('PRUEBA-RANGO'), 'dice que ancla es');
  assert.equal(porRango.texto, repetido, 'no cambia el texto');
});

test('los textos vigentes y el manifiesto siguen intactos', () => {
  const v13 = fs.readFileSync(path.join(LEGAL, 'anexo-nube-v1.3.html'));
  const encargo = fs.readFileSync(path.join(LEGAL, 'anexo-encargo.html'));
  assert.equal(
    require('crypto').createHash('sha256').update(v13).digest('hex'),
    'fdd10551c2106e186d62a2b70922530ff9494a8538fc67816f6f5ad5ca2b585d',
    'el Anexo de Nube v1.3 es el que estaba, byte a byte'
  );
  assert.equal(
    require('crypto').createHash('sha256').update(encargo).digest('hex'),
    '6308b1f7a51007cb1e973de0210d1e5659d3b3ceb8e3e3b7a3ee52a7275b8948',
    'el Anexo de Encargo vigente es el que estaba, byte a byte'
  );
});
