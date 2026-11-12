/**
 * EL MAPA DE LA META SE COMPRUEBA A SI MISMO
 * ==========================================
 *
 * QUE HACE ESTE TEST
 * ------------------
 * El mapa de la meta (`meta-para-abrir-a-empresas-reales-2026-11-12.md`) es
 * un documento que declara el estado de los bloques que el verificador exige.
 * Un documento asi solo sirve si **alguien puede comprobarlo**: de lo contrario
 * es una afirmacion sobre lo que falta, escrita a mano, que se pudre.
 *
 * El mecanismo es `scripts/contar-estados-meta-apertura.js`: el estado va en la
 * clave del encabezado, con una palabra (PROMPT.md §5.30), y la tabla resumen
 * se REGENERA desde el conteo real. Si el documento no cuadra con su propio
 * conteo, el script sale con codigo distinto de 0.
 *
 * LO QUE SE VERIFICA ACA
 * ----------------------
 * - Que el mapa real cuadra (codigo 0) y que el conteo coincide con lo que el
 *   documento declara.
 * - Que se DETECTA un estado que no es una de las cuatro palabras.
 * - Que se DETECTA un bloque que falta.
 * - Que se DETECTA una tabla editada a mano (los numeros que no cuadran con el
 *   conteo).
 * - Que `--escribir` regenera la tabla y que la segunda corrida **no cambia
 *   nada** (es idempotente).
 * - Que **todos** los bloques declaran su origen: un bloque sin origen no es
 *   trazable, y este mapa existe para ser trazado.
 *
 * NADA DE ESTO TOCA EL DOCUMENTO REAL: todas las pruebas trabajan sobre una
 * COPIA en un directorio temporal.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  correr,
  SECCIONES,
} = require('../../scripts/contar-estados-meta-apertura');

/** El mapa real, relativo a este test. */
const MAPA_REAL = path.resolve(
  __dirname, '..', '..', '..', 'docs', 'gestion-humana', 'firma-electronica',
  'meta-para-abrir-a-empresas-reales-2026-11-12.md'
);

/**
 * Copia el mapa a un directorio temporal para poder romperlo sin tocar el
 * documento real.
 * @returns {string} la ruta de la copia.
 */
function copiarMapa() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-apertura-'));
  const destino = path.join(dir, path.basename(MAPA_REAL));
  fs.copyFileSync(MAPA_REAL, destino);
  return destino;
}

/**
 * Cuenta los bloques declarados por el script.
 * @returns {number}
 */
function totalDeclarado() {
  return SECCIONES.reduce((a, s) => a + s.requisitos, 0);
}

/**
 * Cambia el numero de cerrados de la fila TOTAL por uno imposible.
 *
 * La fila se deriva del propio documento, no se escribe a mano: si el mapa
 * cambia de tamaño, el test sigue probando lo que dice probar. Antes
 * llevaba los numeros fijos y, cuando el mapa cambio, el `replace` no
 * encontraba nada: el test de "tabla editada a mano" pasaba en falso y el de
 * idempotencia comprobaba una cadena que nunca se habia escrito.
 *
 * @param {string} texto
 * @returns {{texto: string, alterado: boolean}} el texto alterado y si se
 *   pudo alterar de verdad.
 */
function alterarTotal(texto) {
  const m = /^\| \*\*TOTAL\*\* \| \*\*(\d+)\*\* \|.*$/m.exec(texto);
  if (!m) return { texto: texto, alterado: false };
  const fila = m[0];
  const nueva = fila.replace('**' + m[1] + '**', '**99**');
  return { texto: texto.replace(fila, nueva), alterado: nueva !== fila };
}

test('el mapa real cuadra: el codigo de salida es 0', () => {
  const codigo = correr(MAPA_REAL, false);
  assert.equal(codigo, 0, 'el mapa real debe cuadrar con su propio conteo');
});

test('el mapa tiene todos los bloques que el verificador declara', () => {
  const texto = fs.readFileSync(MAPA_REAL, 'utf8');
  const encontrados = (texto.match(/^###\s+M\.\d+\s+-\s+/gm) || []).length;
  assert.equal(
    encontrados,
    totalDeclarado(),
    'el documento tiene ' + encontrados + ' bloques y el verificador declara ' + totalDeclarado()
  );
});

test('detecta un estado que no es una de las cuatro palabras', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    fs.writeFileSync(
      copia,
      texto.replace('— PENDIENTE', '— CASI LISTO', 1),
      'utf8'
    );
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'un estado inventado tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('detecta un bloque que falta', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    // Se borra un encabezado y su bloque entero.
    const i = texto.indexOf('### M.1 ');
    const j = texto.indexOf('### M.2 ');
    fs.writeFileSync(copia, texto.slice(0, i) + texto.slice(j), 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'un bloque faltante tiene que hacer fallar la verificacion');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('detecta una tabla editada a mano', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    const r = alterarTotal(texto);
    assert.ok(r.alterado, 'el mapa tiene que traer una fila TOTAL que se pueda alterar');
    fs.writeFileSync(copia, r.texto, 'utf8');
    const codigo = correr(copia, false);
    assert.notEqual(codigo, 0, 'una tabla con numeros escritos a mano tiene que hacer fallar');
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('--escribir regenera la tabla y es idempotente', () => {
  const copia = copiarMapa();
  try {
    const texto = fs.readFileSync(copia, 'utf8');
    const r = alterarTotal(texto);
    assert.ok(r.alterado, 'el mapa tiene que traer una fila TOTAL que se pueda alterar');
    fs.writeFileSync(copia, r.texto, 'utf8');
    // La alteracion tiene que estar de verdad en el archivo: si no, la
    // regeneracion no se estaria probando sobre una tabla rota.
    assert.ok(
      fs.readFileSync(copia, 'utf8').indexOf('**99**') >= 0,
      'la tabla de la copia quedo alterada a mano antes de regenerarla'
    );

    correr(copia, true);
    const despues = fs.readFileSync(copia, 'utf8');
    assert.ok(
      despues.indexOf('| **TOTAL** | **99**') < 0,
      'la tabla se regenera desde el conteo real, no desde lo que estaba escrito'
    );
    assert.ok(
      /\| \*\*TOTAL\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \| \*\*\d+\*\* \|/.test(despues),
      'la fila de total tiene la forma que el verificador genera'
    );

    const bytesAntes = fs.readFileSync(copia);
    correr(copia, true);
    assert.ok(
      bytesAntes.equals(fs.readFileSync(copia)),
      'la segunda corrida no cambia nada: el verificador es idempotente'
    );
  } finally {
    fs.rmSync(path.dirname(copia), { recursive: true, force: true });
  }
});

test('todos los bloques declaran su origen', () => {
  const texto = fs.readFileSync(MAPA_REAL, 'utf8');
  const partes = texto.split(/^###\s+M\.\d+\s+-\s+/m).slice(1);
  assert.ok(partes.length > 0, 'el mapa tiene bloques');
  partes.forEach((bloque, i) => {
    assert.ok(
      /^\s*\n?[\s\S]*?\*\*Origen\.\*\*/.test(bloque),
      'el bloque ' + (i + 1) + ' no declara su linea de **Origen.**'
    );
  });
});
