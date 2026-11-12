/**
 * EL SCRIPT DEL T6 NO PUEDE TOCAR PRODUCCION
 * ==========================================
 *
 * QUE HACE ESTE TEST
 * ------------------
 * `scripts/probar-t6-medio-corporativo.js` levanta una instancia del servicio
 * sobre una COPIA AISLADA de base de datos y ejercita el caso del buzon
 * corporativo. El riesgo real de ese script no es que falle: es que **escriba
 * en la base de produccion** por accidente, y que el caso se de por probado
 * sin que el asiento exista.
 *
 * Por eso este test no corre la prueba (eso exige un servidor, un puerto y
 * una copia de la base: es trabajo del acta, no de la suite). El test
 * comprueba lo que se puede comprobar en cualquier maquina y en cualquier
 * momento:
 *
 * - Que sin `--db` el script **no hace nada** y sale con codigo distinto de 0.
 * - Que con una base que no existe pasa lo mismo.
 * - Que si la base "aislada" es **la de produccion**, el script **se niega**
 *   a correr.
 * - Que al negarse, **no escribe ni un byte** en esa base.
 *
 * NADA DE ESTO TOCA NINGUNA BASE REAL: el unico archivo que se toca es uno
 * temporal, creado por el propio test.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

/** El script, relativo a este test. */
const SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'probar-t6-medio-corporativo.js');

/**
 * Corre el script con los argumentos dados y devuelve el resultado.
 * @param {string[]} argumentos
 * @returns {{codigo: number, salida: string}}
 */
function correr(args) {
  const res = spawnSync(process.execPath, [SCRIPT].concat(args), {
    encoding: 'utf8',
    timeout: 60000,
  });
  return {
    codigo: res.status,
    salida: String(res.stdout || '') + String(res.stderr || ''),
  };
}

/**
 * Crea un archivo temporal con un contenido conocido.
 * @returns {{ruta: string, contenido: string, limpiar: Function}}
 */
function archivoTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't6-guard-'));
  const ruta = path.join(dir, 'firma.sqlite');
  const contenido = 'contenido que no se puede tocar\n';
  fs.writeFileSync(ruta, contenido, 'utf8');
  return {
    ruta: ruta,
    contenido: contenido,
    limpiar: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('sin --db el script no hace nada y sale con codigo distinto de 0', () => {
  const res = correr([]);
  assert.notEqual(res.codigo, 0, 'sin la base aislada el script no puede correr');
  assert.match(res.salida, /Falta --db/, 'tiene que decir que falta la base aislada');
});

test('con una base aislada que no existe, el script no corre', () => {
  const res = correr(['--db=' + path.join(os.tmpdir(), 'no-existe-jamas.sqlite')]);
  assert.notEqual(res.codigo, 0, 'una base que no existe no puede ser la base aislada');
  assert.match(res.salida, /no existe/i, 'tiene que decir que la base no existe');
});

test('el guard de produccion: si la base aislada es la de produccion, el script se niega', () => {
  const tmp = archivoTemporal();
  try {
    const res = correr(['--db=' + tmp.ruta, '--db-produccion=' + tmp.ruta]);
    assert.notEqual(res.codigo, 0, 'el script tiene que negarse a correr sobre la base de produccion');
    assert.match(
      res.salida,
      /PRODUCCION/,
      'tiene que decir que la base aislada es la de produccion'
    );
  } finally {
    tmp.limpiar();
  }
});

test('al negarse, el script no escribe ni un byte en la base', () => {
  const tmp = archivoTemporal();
  try {
    const antes = fs.readFileSync(tmp.ruta);
    const res = correr(['--db=' + tmp.ruta, '--db-produccion=' + tmp.ruta]);
    const despues = fs.readFileSync(tmp.ruta);
    assert.ok(
      antes.equals(despues),
      'el script se nego a correr: la base no puede haber cambiado ni un byte'
    );
    assert.notEqual(res.codigo, 0, 'y el codigo de salida tiene que ser distinto de 0');
  } finally {
    tmp.limpiar();
  }
});

test('la ayuda del script no escribe nada', () => {
  const res = correr(['--ayuda']);
  assert.ok(
    res.salida.indexOf('--db') >= 0,
    'la ayuda tiene que explicar como se pasa la base aislada'
  );
});
