/**
 * Control de huellas internas del paquete al abogado.
 *
 * Por que existe: comparar el manifiesto contra los archivos dice si los bytes
 * son los correctos, pero no dice si lo que los documentos ESCRIBEN sobre esos
 * bytes es cierto. El defecto que lo motiva: el Anexo de Nube se diligencio y su
 * archivo cambio de huella, pero diez lugares del paquete siguieron citando la
 * huella vieja, y el abogado las encontro al leer la seccion que firma.
 *
 * Reglas que se comprueban:
 *   - Una huella vigente dentro de un documento: no dice nada.
 *   - Una huella que no es vigente: solo pasa si el MISMO parrafo (o la MISMA
 *     celda de tabla) la declara como historica.
 *   - En una tabla, cada fila y cada celda se juzga por separado: si se juzgara
 *     la tabla entera, una celda que dice "historico" absolveria a las demas.
 *   - Una huella que el texto AFIRMA que es la vigente (la huella vigente del
 *     Anexo es X) no se puede absolver con una mencion a una huella vieja: si
 *     no es la vigente, el documento esta mintiendo.
 *   - Los dos documentos que son texto literal del abogado no se juzgan: no se
 *     reescriben y sus huellas son las que el mismo vio.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  referenciasNoDeclaradas,
  DECLARADO_HISTORICO,
} = require('../scripts/armar-paquete-abogado');

const VIGENTE = 'a'.repeat(64);
const VIGENTE_2 = 'b'.repeat(64);
const VIEJA = 'c'.repeat(64);
const VIEJA_2 = 'd'.repeat(64);
const VIGENTES = new Set([VIGENTE, VIGENTE_2]);

test('control de huellas · una huella vigente no se reporta', () => {
  const texto = '| Anexo de Nube v1.0 | 60 075 | `' + VIGENTE + '` |';
  assert.deepEqual(referenciasNoDeclaradas(texto, VIGENTES), []);
});

test('control de huellas · una huella vieja sin declaracion se reporta', () => {
  const texto = '| Anexo de Nube v1.0 | 49 193 | `' + VIEJA + '` |';
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  assert.equal(malas.length, 1);
  assert.equal(malas[0].huella, VIEJA);
});

test('control de huellas · una huella vieja declarada como historica en el mismo parrafo pasa', () => {
  const texto = 'La huella anterior `' + VIEJA + '` queda como historica y no es la del texto que se entrega.';
  assert.deepEqual(referenciasNoDeclaradas(texto, VIGENTES), []);
});

test('control de huellas · en una tabla, la declaracion de una fila no absuelve a las otras', () => {
  // Esta es la trampa del defecto real: una fila dice "historico" y la fila de
  // al lado, que es la que el abogado marca, trae la huella vieja.
  const texto = [
    '| Documento | Bytes | SHA-256 |',
    '|---|---|---|',
    '| A1 | 73 208 | `' + VIGENTE + '` |',
    '| A3 | 49 193 | `' + VIEJA + '` |',
    '| v1.3 (histórico) | 71 555 | `' + VIEJA_2 + '` |',
  ].join('\n');
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  // La de la v1.3 es historica (la fila lo dice); la del A3 no, y se reporta.
  assert.equal(malas.length, 1);
  assert.equal(malas[0].huella, VIEJA);
});

test('control de huellas · una forma corta que armonia con una vigente pasa', () => {
  const texto = 'El Anexo de Nube quedo en `' + VIGENTE.slice(0, 8) + '\u2026' + VIGENTE.slice(-6) + '`.';
  assert.deepEqual(referenciasNoDeclaradas(texto, VIGENTES), []);
});

test('control de huellas · una forma corta que no armonia con ninguna vigente se reporta', () => {
  const texto = 'El Anexo de Nube quedo en `' + VIEJA.slice(0, 8) + '\u2026' + VIEJA.slice(-6) + '`.';
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  assert.equal(malas.length, 1);
});

test('control de huellas · la marca de historico reconoce las redacciones que usa el expediente', () => {
  const redacciones = [
    'queda como hist\u00f3rico',
    'de la ronda anterior',
    'no emito aprobaci\u00f3n sobre esta huella',
    'fue la candidata sometida a revisi\u00f3n',
    'no es la del texto que se entrega',
  ];
  redacciones.forEach(function (r) {
    assert.ok(DECLARADO_HISTORICO.test(r), 'no reconoce: ' + r);
  });
});

// ---------------------------------------------------------------------------
// El defecto que el control todavia dejaba pasar (31-oct-2026, noche):
// la fila D3 del checklist 11 decia "La huella vigente del Anexo de Encargo es
// `ebc294ac...`" (86 382 B), que era la huella VIEJA del A2, y la fila entera se
// excusaba con la palabra "historica", que estaba en OTRA celda. El control la
// daba por buena y el abogado leeria una huella que no era la del archivo.
//
// El arreglo: la declaracion de historica se lee por CELDA, y una AFIRMACION de
// vigencia ("la huella vigente es X") no se deja absolver por una mencion a una
// huella vieja que este en la misma celda.
// ---------------------------------------------------------------------------

test('control de huellas · una huella que el texto declara vigente se reporta', () => {
  const texto = '**Aplicada.** La huella vigente del Anexo de Encargo es `' + VIEJA + '` (86 382 B).';
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  assert.equal(malas.length, 1);
  assert.equal(malas[0].huella, VIEJA);
  assert.ok(/declara vigente/.test(malas[0].motivo), 'el motivo debe decir que la declara vigente');
});

test('control de huellas · decir "historica" en la celda de al lado no absuelve a la vigente', () => {
  // El caso real, celda por celda: celda 2 dice "historica", celda 3 afirma que
  // la huella vigente es la VIEJA.
  const texto = [
    '| Requisito | Que paso | Que hacer | Estado |',
    '|---|---|---|---|',
    '| D3 | La nota sugirio `' + VIEJA_2 + '`, que es una huella **historica** | Retirar el hash antiguo | **Aplicada.** La huella vigente del Anexo de Encargo es `' + VIEJA + '` (86 382 B). |',
  ].join('\n');
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  assert.equal(malas.length, 1);
  assert.equal(malas[0].huella, VIEJA);
});

test('control de huellas · una version archivada "vigente en produccion" no se confunde con la vigente', () => {
  // La v1.0 del Acuerdo es la que corre en produccion, y el expediente la
  // llama "la vigente en produccion". No es la vigente del manifiesto: es una
  // version archivada, declarada como historica. Tiene que pasar, y no porque
  // el control la absolva por ser "la vigente", sino porque se declara vieja.
  const texto = [
    '**1.8 · Conservar las versiones anteriores como hist\u00f3rico, sin sobrescribir — CERRADO.**',
    '- **v1.0** (la vigente en producci\u00f3n, sellada): hash',
    '  `' + VIEJA + '`, registrada en el archivo de archivo.',
  ].join('\n');
  assert.deepEqual(referenciasNoDeclaradas(texto, VIGENTES), []);
});

test('control de huellas · la afirmacion de vigencia no alcanza a la huella de otra oracion', () => {
  const texto = 'La huella vigente del Anexo es `' + VIGENTE + '`. La anterior `' + VIEJA + '` queda como historica.';
  assert.deepEqual(referenciasNoDeclaradas(texto, VIGENTES), []);
});

test('control de huellas · una forma corta declarada vigente tambien se reporta', () => {
  const texto = 'La huella vigente es `' + VIEJA.slice(0, 8) + '\u2026' + VIEJA.slice(-6) + '`.';
  const malas = referenciasNoDeclaradas(texto, VIGENTES);
  assert.equal(malas.length, 1);
  assert.ok(/declara vigente/.test(malas[0].motivo));
});
