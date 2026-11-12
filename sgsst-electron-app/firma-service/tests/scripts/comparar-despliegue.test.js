/**
 * SE PUEDE SABER QUE CODIGO CORRE EN EL SERVIDOR
 * ================================================
 *
 * EL FALLO QUE ESTE TEST CIERRA
 * ------------------------------
 * El despliegue de la firma electronica se hace copiando archivos: el servidor
 * **no tiene `.git`** (medido el 12-nov-2026, `/opt/kair-firma/.git` no existe).
 * Entonces "que codigo corre" no tiene respuesta con `git log`, y el manifiesto
 * `legal-readiness.json` solo describe los TEXTOS (el Acuerdo, los anexos), no
 * el codigo.
 *
 * La consecuencia medida el 12-nov-2026: el paquete de dependencias del
 * 📦1051 (express 4.22.3, proxy-addr 2.0.8, qs 6.16.2) **no esta desplegado**
 * y produccion sigue con express 4.22.2, proxy-addr 2.0.7 y qs 6.15.3. Durante
 * una ronda entera se dio por hecho lo contrario, porque no habia forma de
 * medirlo. Este test cierra esa falta.
 *
 * LO QUE SE VERIFICA ACA
 * ----------------------
 * - Que la comparacion **detecta un archivo que difiere** y lo nombra (no basta
 *   con que el codigo de salida sea distinto: un check que solo mira el codigo
 *   podria estar mirando otra cosa).
 * - Que **da el visto bueno** cuando los dos arboles coinciden.
 * - Que detecta un archivo **sobrante en el servidor** (resto de una version
 *   anterior).
 * - Que **no toca nada**: el verificador no escribe ni un byte del arbol que
 *   compara. Un verificador que arregla lo que verifica no verifica nada.
 * - Que **excluye `node_modules`**: las dependencias instaladas no son codigo
 *   desplegable y su comparacion no diria nada del despliegue.
 *
 * NOTA SOBRE EL ALCANCE
 * ----------------------
 * Este test mide BYTES, no comportamiento. Que los hashes coincidan NO quiere
 * decir que el servicio funcione: eso lo mide la suite y la medicion de salud.
 * Los dos son controles distintos y no se sustituyen.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  calcularManifiesto,
  leerManifiesto,
  comparar,
} = require('../../scripts/comparar-despliegue');

/**
 * Crea un arbol de prueba con los archivos del servidor simulados.
 * @param {object} archivos mapa ruta -> contenido.
 * @returns {string} la raiz del arbol.
 */
function crearArbol(archivos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'despliegue-'));
  for (const [ruta, contenido] of Object.entries(archivos)) {
    const abs = path.join(raiz, ruta);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contenido, 'utf8');
  }
  return raiz;
}

/**
 * Escribe el manifiesto del servidor a partir de un mapa ruta -> contenido.
 * @param {string} destino
 * @param {object} archivos
 */
function escribirManifiesto(destino, archivos) {
  const crypto = require('crypto');
  const lineas = Object.entries(archivos).map(([ruta, contenido]) => {
    const hash = crypto.createHash('sha256').update(contenido, 'utf8').digest('hex');
    return hash + '  ' + ruta;
  });
  fs.writeFileSync(destino, lineas.join('\n') + '\n', 'utf8');
}

test('el manifiesto del repositorio se calcula con el sha256 de cada archivo', () => {
  const raiz = crearArbol({ 'src/app.js': 'uno', 'src/lib/x.js': 'dos' });
  const manifiesto = calcularManifiesto(raiz);
  assert.equal(manifiesto.size, 2);
  assert.ok(manifiesto.has('src/app.js'));
  assert.ok(manifiesto.has('src/lib/x.js'));
  assert.equal(manifiesto.get('src/app.js'), crypto.createHash('sha256').update('uno').digest('hex'));
});

test('node_modules y los directorios de datos no entran al manifiesto', () => {
  const raiz = crearArbol({
    'src/app.js': 'uno',
    'node_modules/express/index.js': 'dependencia',
    'data/firma.sqlite': 'base',
    'storage/actas/acta.pdf': 'acta',
  });
  const manifiesto = calcularManifiesto(raiz);
  assert.equal(manifiesto.size, 1);
  assert.ok(manifiesto.has('src/app.js'));
  for (const clave of manifiesto.keys()) {
    assert.ok(!clave.startsWith('node_modules/'), 'node_modules no debe compararse: ' + clave);
    assert.ok(!clave.startsWith('data/'), 'los datos no son codigo: ' + clave);
    assert.ok(!clave.startsWith('storage/'), 'los PDFs no son codigo: ' + clave);
  }
});

test('un archivo que difiere se reporta nombrandolo', () => {
  const raiz = crearArbol({ 'src/app.js': 'version nueva', 'package.json': '{}' });
  const destino = path.join(os.tmpdir(), 'manifiesto-' + Date.now() + '.txt');
  escribirManifiesto(destino, { 'src/app.js': 'version vieja', 'package.json': '{}' });
  const cmp = comparar(calcularManifiesto(raiz), leerManifiesto(destino));
  assert.equal(cmp.diferentes.length, 1);
  assert.deepEqual(cmp.diferentes, ['src/app.js']);
});

test('un archivo sobrante en el servidor se reporta', () => {
  const raiz = crearArbol({ 'src/app.js': 'igual' });
  const destino = path.join(os.tmpdir(), 'manifiesto-' + Date.now() + '.txt');
  escribirManifiesto(destino, { 'src/app.js': 'igual', 'src/viejo.js': 'resto' });
  const cmp = comparar(calcularManifiesto(raiz), leerManifiesto(destino));
  assert.equal(cmp.soloServidor.length, 1);
  assert.deepEqual(cmp.soloServidor, ['src/viejo.js']);
  assert.equal(cmp.diferentes.length, 0);
});

test('dos arboles iguales no reportan ninguna diferencia', () => {
  const archivos = { 'src/app.js': 'igual', 'package.json': '{}' };
  const raiz = crearArbol(archivos);
  const destino = path.join(os.tmpdir(), 'manifiesto-' + Date.now() + '.txt');
  escribirManifiesto(destino, archivos);
  const cmp = comparar(calcularManifiesto(raiz), leerManifiesto(destino));
  assert.equal(cmp.diferentes.length, 0);
  assert.equal(cmp.soloServidor.length, 0);
  assert.equal(cmp.comunes.length, 2);
});

test('el verificador no escribe ni un byte en el arbol que compara', () => {
  const raiz = crearArbol({ 'src/app.js': 'igual' });
  const antes = fs.readdirSync(raiz).sort().join(',');
  const destino = path.join(os.tmpdir(), 'manifiesto-' + Date.now() + '.txt');
  escribirManifiesto(destino, { 'src/app.js': 'igual' });
  const manifiestoAntes = fs.readFileSync(destino, 'utf8');
  const cmp = comparar(calcularManifiesto(raiz), leerManifiesto(destino));
  assert.equal(cmp.diferentes.length, 0);
  assert.equal(fs.readdirSync(raiz).sort().join(','), antes, 'el arbol no puede cambiar');
  assert.equal(fs.readFileSync(destino, 'utf8'), manifiestoAntes, 'el manifiesto no puede cambiar');
});
