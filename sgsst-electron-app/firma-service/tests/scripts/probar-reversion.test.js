/**
 * EL SCRIPT DEL T7 NO PUEDE TOCAR PRODUCCION NI ESCRIBIR SIN CONFIRMAR
 * =======================================================================
 *
 * QUE HACE ESTE TEST
 * ------------------
 * `scripts/probar-reversion.js` corre el programa de reversion del repo contra
 * una base AISLADA. El riesgo real de ese script no es que falle: es que
 * **escriba en la base de produccion** por accidente, o que prepare una base
 * sin que nadie lo haya pedido.
 *
 * Por eso este test NO corre la prueba (eso exige el servidor, el codigo
 * desplegado y una copia de la base: es trabajo del acta, no de la suite). El
 * test comprueba lo que se puede comprobar en cualquier maquina y en cualquier
 * momento:
 *
 * - Que el guard de produccion **se niega** a correr sobre la base de
 *   produccion, y tambien sobre el directorio de datos del despliegue.
 * - Que al negarse, **no escribe ni un byte**.
 * - Que `--preparar` (que crea la base y siembra la escena) **exige**
 *   `--confirmar-escribe`: sin esa opcion no se escribe nada.
 * - Que el ambiente que el script pasa al programa de reversion es **sintetico**
 *   y jamas el de produccion.
 * - Que la semilla siembra el **evento del consentimiento**, que es justamente
 *   el caso que hace que la limpieza POR RANGO tenga que borrar el hijo antes
 *   que el padre (la FK de la migracion 010).
 *
 * NADA DE ESTO TOCA NINGUNA BASE REAL: este test **no abre ninguna base de
 * datos** (ni `data/test.sqlite` ni ninguna otra). Lo unico que toca son
 * archivos temporales creados por el propio test, en el directorio temporal del
 * sistema.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

/** La raiz del firma-service: este test vive dos niveles abajo de `scripts`. */
const SERVICE_ROOT = path.resolve(__dirname, '..', '..');

/** El script bajo prueba y el programa de reversion que este invoca. */
const SCRIPT = path.join(SERVICE_ROOT, 'scripts', 'probar-reversion.js');
const PROGRAMA = path.join(SERVICE_ROOT, 'scripts', 'limpiar-rastro-prueba.js');

/**
 * El script, importado. Importarlo NO lo ejecuta: el bloque de arranque solo
 * corre cuando el archivo es el entry point (`require.main === module`).
 */
const modulo = require(SCRIPT);

/**
 * Corre el script como proceso aparte y devuelve el resultado.
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
 * Un directorio temporal con un archivo que hace de base "aislada". El
 * contenido es texto a proposito: el guard tiene que negarse por la RUTA,
 * antes de tocar el archivo.
 * @returns {{dir: string, ruta: string, contenido: string, limpiar: Function}}
 */
function baseTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't7-guard-'));
  const ruta = path.join(dir, 'firma.sqlite');
  const contenido = 'contenido que no se puede tocar\n';
  fs.writeFileSync(ruta, contenido, 'utf8');
  return {
    dir: dir,
    ruta: ruta,
    contenido: contenido,
    limpiar: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Parsea unos argumentos con el script, como lo haria la linea de comandos.
 *
 * OJO: `parseArgs` recibe el `argv` COMPLETO (como `process.argv`) y se salta
 * los dos primeros elementos, que son el interprete y el nombre del script.
 * Si se le pasan solo los argumentos de la prueba, se perderian los dos
 * primeros.
 * @param {string[]} argumentos
 * @returns {object}
 */
function parsear(argumentos) {
  return modulo.parseArgs([process.execPath, SCRIPT].concat(argumentos));
}

/**
 * Los argumentos que un operador tiene que dar SIEMPRE, para que la
 * validacion no falle por otra cosa que no sea la que se quiere probar.
 * @param {string[]} extra
 * @returns {string[]}
 */
function argumentosBase(extra) {
  return ['--app-dir=' + SERVICE_ROOT, '--programa=' + PROGRAMA].concat(extra);
}

/** Los fallos que el script acumulo en la ultima validacion. */
function fallasDeLaValidacion() {
  return modulo.resultados.filter((r) => r.estado === 'FALLA');
}

test('sin --db el script no hace nada y sale con codigo distinto de 0', () => {
  const res = correr([]);
  assert.notEqual(res.codigo, 0, 'sin la base aislada el script no puede correr');
  assert.match(res.salida, /Falta --db/, 'tiene que decir que falta la base aislada');
});

test('el guard de produccion: si la base aislada es la de produccion, el script se niega', () => {
  const tmp = baseTemporal();
  try {
    modulo.reiniciar();
    const args = parsear(argumentosBase([
      '--db=' + tmp.ruta,
      '--db-produccion=' + tmp.ruta,
    ]));
    const ok = modulo.validarArgumentos(args);
    assert.equal(ok, false, 'el script tiene que negarse a correr sobre la base de produccion');
    const fallas = fallasDeLaValidacion();
    assert.equal(fallas.length, 1, 'tiene que fallar por una sola razon');
    assert.match(fallas[0].nombre, /PRODUCCION/, 'tiene que decir que es la base de produccion');
  } finally {
    tmp.limpiar();
  }
});

test('el guard de produccion: el directorio de datos del despliegue tambien esta prohibido', () => {
  modulo.reiniciar();
  const args = parsear(argumentosBase([
    '--db=/opt/kair-firma/data/otra-copia.sqlite',
  ]));
  const ok = modulo.validarArgumentos(args);
  assert.equal(ok, false, 'una base dentro del directorio de datos de produccion se rechaza');
  const fallas = fallasDeLaValidacion();
  assert.ok(
    fallas.some((f) => /directorio de datos de PRODUCCION/.test(f.nombre)),
    'tiene que decir que la base esta en el directorio de datos de produccion'
  );
});

test('al negarse, el script no escribe ni un byte en la base', () => {
  const tmp = baseTemporal();
  try {
    const antes = fs.readFileSync(tmp.ruta);
    const res = correr(argumentosBase([
      '--db=' + tmp.ruta,
      '--db-produccion=' + tmp.ruta,
    ]));
    const despues = fs.readFileSync(tmp.ruta);
    assert.ok(
      antes.equals(despues),
      'el script se nego a correr: la base no puede haber cambiado ni un byte'
    );
    assert.notEqual(res.codigo, 0, 'y el codigo de salida tiene que ser distinto de 0');
    assert.match(res.salida, /PRODUCCION/, 'tiene que decir por que se nego');
  } finally {
    tmp.limpiar();
  }
});

test('preparar la base exige --confirmar-escribe: sin esa opcion no se escribe nada', () => {
  const tmp = baseTemporal();
  try {
    modulo.reiniciar();
    const args = parsear(argumentosBase([
      '--db=' + path.join(tmp.dir, 'reversion.sqlite'),
      '--preparar',
    ]));
    const ok = modulo.validarArgumentos(args);
    assert.equal(ok, false, 'preparar es escribir: sin --confirmar-escribe no se puede');
    const fallas = fallasDeLaValidacion();
    assert.ok(
      fallas.some((f) => /confirmar-escribe/.test(f.nombre + ' ' + f.detalle)),
      'tiene que pedir --confirmar-escribe'
    );

    // Y el final del camino: el proceso ni siquiera crea el archivo.
    const destino = path.join(tmp.dir, 'otra.sqlite');
    const res = correr(argumentosBase(['--db=' + destino, '--preparar']));
    assert.notEqual(res.codigo, 0, 'sin --confirmar-escribe el codigo de salida es distinto de 0');
    assert.match(res.salida, /confirmar-escribe/, 'tiene que pedir --confirmar-escribe');
    assert.equal(
      fs.existsSync(destino),
      false,
      'sin --confirmar-escribe el script no puede haber creado la base'
    );
  } finally {
    tmp.limpiar();
  }
});

test('los argumentos obligatorios por omision son los del servidor', () => {
  const args = parsear([]);
  assert.equal(args.dbProduccion, '/opt/kair-firma/data/firma.sqlite');
  assert.equal(args.appDir, '/opt/kair-firma/app');
  assert.equal(args.hasta, '2026-12-31');
  assert.equal(args.version, 'v1.0');
  assert.equal(args.confirmarEscribe, false);
  assert.equal(args.preparar, false);
});

test('el ambiente que el script pasa al programa de reversion es sintetico', () => {
  const amb = modulo.ambienteSintetico('/tmp/kair-t7-reversion/reversion.sqlite');
  assert.equal(amb.NODE_ENV, 'development');
  assert.equal(amb.DB_PATH, '/tmp/kair-t7-reversion/reversion.sqlite');
  assert.ok(amb.INTERNAL_API_KEY, 'la llave interna de la corrida tiene que existir');
  assert.ok(amb.ADMIN_API_KEY, 'la llave de administracion de la corrida tiene que existir');
  // Son las llaves de la CORRIDA, no las de produccion: ninguna ruta del
  // despliegue puede aparecer en el ambiente que el script arma.
  const texto = JSON.stringify(amb);
  assert.equal(
    /kair-firma\/(admin-key|internal-key|\.env)/.test(texto),
    false,
    'el ambiente del proceso no puede traer rutas de secretos de produccion'
  );
});

test('la semilla siembra el evento del consentimiento (el caso que rompia la limpieza por rango)', () => {
  const sql = modulo.sqlSiembra('/tmp/kair-t7-reversion/pdfs/SIGN-T7-PRUEBA-0001.pdf');
  assert.match(sql, /INSERT INTO gh_consentimientos_firma/);
  assert.match(
    sql,
    /INSERT INTO gh_consentimientos_eventos/,
    'sin el evento del consentimiento, la limpieza por rango no ejercita la FK'
  );
  assert.match(sql, /SIGN-T7-PRUEBA-0001/);
  assert.equal(
    /opt\/kair-firma\/data/.test(sql),
    false,
    'la semilla no puede traer la ruta de la base de produccion'
  );
});

test('la ayuda del script no escribe nada', () => {
  const res = correr(['--ayuda']);
  assert.equal(res.codigo, 0, 'la ayuda es una salida limpia');
  assert.ok(
    res.salida.indexOf('--db') >= 0,
    'la ayuda tiene que explicar como se pasa la base aislada'
  );
  assert.ok(
    res.salida.indexOf('--confirmar-escribe') >= 0,
    'la ayuda tiene que explicar que sin --confirmar-escribe no se escribe'
  );
});
