/**
 * Tests del SELLO DE VERSION del despliegue.
 *
 * Que se prueba:
 *  - La logica pura que arma el valor que anuncia /health (`version_sello`).
 *  - Que NO hay sello se diga EXPLICITAMENTE (nunca se inventa una version).
 *  - Que la ruta de salud NO se caiga cuando el modulo del sello no se puede
 *    cargar: el caso "el paquete de despliegue no trae `scripts/`" tiene que
 *    devolver "no hay sello", nunca una excepcion.
 *  - Que el sello se pueda generar SIN `.git` (el commit llega por parametro),
 *    que sea idempotente y que detecte un arbol MIXTO (codigo nuevo con
 *    dependencias viejas).
 *
 * POR QUE ESTE ARCHIVO NO ABRE LA BASE DE DATOS
 * ----------------------------------------------
 * Este archivo NO usa `tests/setup.js` ni `data/test.sqlite`: es un test
 * UNITARIO de la logica del sello, y la logica del sello es pura (texto ->
 * valor). Correrlo no toca la base compartida, asi que puede correr al mismo
 * tiempo que otra suite sin pisarse.
 *
 * Cuando se prueba la RUTA (la ultima seccion), la base y la configuracion
 * se sustituyen por dobles en `require.cache`: la ruta se carga sin tocar
 * NINGUNA base, ni la de pruebas ni la de produccion.
 *
 * NOTA: el `npm test` del proyecto carga `tests/setup.js` para TODOS los
 * archivos (es un `--require` global). Este archivo no depende de eso: se
 * puede correr solo con
 *
 *   node --test tests/routes/health.test.js
 *
 * sin `--require ./tests/setup.js` y sin abrir ninguna base.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const express = require('express');
const request = require('supertest');

const {
  generarSello,
  escribirSello,
  serializarSello,
  leerSello,
  armarSelloPublico,
  leerSelloPublico,
  hashArbol,
  listarArchivos,
  comprobarSello,
  RUTAS_DEL_SERVICIO,
} = require('../../scripts/generar-sello-version');

const RAIZ_REPO = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Utilidades de prueba: un arbol temporal con la forma del servicio
// ---------------------------------------------------------------------------

/**
 * Crea un arbol temporal con la misma forma que el arbol del despliegue.
 * @param {object} [contenidos] mapa de ruta -> contenido (sobrescribe).
 * @returns {string} la raiz del arbol temporal.
 */
function crearArbol(contenidos) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-sello-'));
  for (const r of RUTAS_DEL_SERVICIO) {
    const abs = path.join(raiz, r);
    if (r.includes('.')) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, 'contenido original de ' + r + '\n', 'utf8');
    } else {
      fs.mkdirSync(abs, { recursive: true });
      fs.writeFileSync(path.join(abs, 'archivo.txt'), 'contenido original\n', 'utf8');
    }
  }
  if (contenidos) {
    for (const r of Object.keys(contenidos)) {
      const abs = path.join(raiz, r);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, contenidos[r], 'utf8');
    }
  }
  return raiz;
}

// ---------------------------------------------------------------------------
// El valor que se publica
// ---------------------------------------------------------------------------

test('sello - un archivo valido se publica con commit, fecha y arbol', () => {
  const valor = armarSelloPublico(JSON.stringify({
    servicio: 'kair-firma-service',
    commit: 'a'.repeat(40),
    commit_corto: 'aaaaaaaa',
    fecha: '2026-11-12T19:41:00Z',
    arbol: '0123456789ab',
    arbol_metodo: 'sha256-archivos',
    archivos: 123,
  }));
  assert.equal(valor.estado, 'presente');
  assert.equal(valor.commit, 'a'.repeat(40));
  assert.equal(valor.commit_corto, 'aaaaaaaa');
  assert.equal(valor.fecha, '2026-11-12T19:41:00Z');
  assert.equal(valor.arbol, '0123456789ab');
});

test('sello - SIN archivo de sello se dice explicitamente que no hay', () => {
  for (const vacio of [null, undefined, '']) {
    const valor = armarSelloPublico(vacio);
    assert.equal(valor.estado, 'ausente', 'no hay sello: debe decirlo');
    assert.ok(valor.detalle, 'el motivo va escrito');
    assert.equal(valor.commit, undefined, 'no se inventa un commit');
    assert.equal(valor.arbol, undefined, 'no se inventa un arbol');
  }
});

test('sello - un archivo ilegible NO se convierte en una version inventada', () => {
  const valor = armarSelloPublico('{esto no es json');
  assert.equal(valor.estado, 'ausente');
  assert.equal(valor.commit, undefined);
  assert.match(valor.detalle, /JSON/i);
});

test('sello - un sello sin commit ni arbol NO se publica como version', () => {
  const valor = armarSelloPublico(JSON.stringify({ servicio: 'kair-firma-service' }));
  assert.equal(valor.estado, 'ausente');
  assert.equal(valor.commit, undefined);
  assert.equal(valor.arbol, undefined);
});

test('sello - leerSelloPublico de un archivo que no existe dice ausente', () => {
  const valor = leerSelloPublico(path.join(os.tmpdir(), 'no-existe-' + Date.now() + '.json'));
  assert.equal(valor.estado, 'ausente');
  assert.equal(valor.commit, undefined);
});

test('sello - leerSelloPublico de un archivo real lo publica', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kair-sello-'));
  const ruta = path.join(dir, 'VERSION');
  fs.writeFileSync(ruta, JSON.stringify({
    commit: 'b'.repeat(40),
    commit_corto: 'bbbbbbbb',
    fecha: '2026-11-12T19:41:00Z',
    arbol: 'fedcba987654',
  }), 'utf8');
  const valor = leerSelloPublico(ruta);
  assert.equal(valor.estado, 'presente');
  assert.equal(valor.commit, 'b'.repeat(40));
  assert.equal(valor.arbol, 'fedcba987654');
});

// ---------------------------------------------------------------------------
// Generar el sello sin .git
// ---------------------------------------------------------------------------

test('sello - sin .git y sin commit NO se inventa uno: el script falla', () => {
  const raiz = crearArbol();
  assert.throws(
    () => generarSello({ raiz: raiz }),
    /commit/i,
    'sin .git y sin --commit tiene que fallar, no inventar un commit'
  );
});

test('sello - sin .git pero con commit por parametro, el sello se arma', () => {
  const raiz = crearArbol();
  const sello = generarSello({ raiz: raiz, commit: 'c'.repeat(40) });
  assert.equal(sello.commit, 'c'.repeat(40));
  assert.equal(sello.commit_corto, 'cccccccc');
  assert.equal(sello.servicio, 'kair-firma-service');
  assert.ok(sello.fecha, 'la fecha va');
  assert.match(sello.fecha, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.match(sello.arbol, /^[0-9a-f]{12}$/, 'el hash corto del arbol');
  assert.ok(sello.archivos > 0);
});

test('sello - el sello es IDEMPOTENTE: dos corridas dan el mismo contenido', () => {
  const raiz = crearArbol();
  const salida = path.join(raiz, 'VERSION');
  const commit = 'd'.repeat(40);

  const primero = generarSello({ raiz: raiz, commit: commit });
  const escritura = escribirSello(salida, primero);
  assert.equal(escritura.cambiado, true, 'la primera corrida escribe');

  const segundo = generarSello({
    raiz: raiz,
    commit: commit,
    previo: leerSello(salida),
  });
  assert.deepEqual(segundo, primero, 'con el mismo commit, el sello no cambia');

  const reescritura = escribirSello(salida, segundo);
  assert.equal(reescritura.cambiado, false, 'la segunda corrida no toca el archivo');
  assert.equal(
    fs.readFileSync(salida, 'utf8'),
    serializarSello(primero),
    'el archivo queda byte a byte igual'
  );
});

test('sello - sin .git, la fecha del sello NO cambia entre corridas', () => {
  const raiz = crearArbol();
  const salida = path.join(raiz, 'VERSION');
  const commit = 'e'.repeat(40);

  escribirSello(salida, generarSello({ raiz: raiz, commit: commit }));
  const mtime1 = fs.statSync(salida).mtimeMs;

  const segundo = generarSello({
    raiz: raiz,
    commit: commit,
    previo: leerSello(salida),
  });
  escribirSello(salida, segundo);

  assert.equal(fs.statSync(salida).mtimeMs, mtime1, 'el archivo no se reescribe');
  assert.equal(segundo.fecha, JSON.parse(fs.readFileSync(salida, 'utf8')).fecha);
});

// ---------------------------------------------------------------------------
// El hash del arbol: la mezcla se ve
// ---------------------------------------------------------------------------

test('sello - el hash del arbol cambia si cambia UN byte de un archivo', () => {
  const raiz = crearArbol();
  const antes = hashArbol(raiz);

  fs.writeFileSync(
    path.join(raiz, 'package-lock.json'),
    'contenido original de package-lock.json\nuna linea mas\n',
    'utf8'
  );
  const despues = hashArbol(raiz);

  assert.notEqual(antes.hash, despues.hash, 'el hash tiene que cambiar');
  assert.equal(antes.archivos, despues.archivos, 'los archivos son los mismos');
});

test('sello - un arbol MIXTO (codigo nuevo con lock viejo) tiene otro hash', () => {
  const raiz = crearArbol();
  const delArbolCompleto = hashArbol(raiz).hash;

  // Se cambia SOLO el lock (el caso real: codigo de la punta con las
  // dependencias anteriores al 1051).
  fs.writeFileSync(
    path.join(raiz, 'package-lock.json'),
    'lock viejo\n',
    'utf8'
  );
  const delArbolMixto = hashArbol(raiz).hash;

  assert.notEqual(
    delArbolCompleto,
    delArbolMixto,
    'el sello tiene que distinguir un arbol mixto de uno completo'
  );
});

test('sello - el hash del arbol es el mismo con los mismos archivos', () => {
  const raizA = crearArbol();
  const raizB = crearArbol();
  assert.equal(hashArbol(raizA).hash, hashArbol(raizB).hash);
});

test('sello - un arbol incompleto se rechaza en vez de inventar un hash', () => {
  const raiz = crearArbol();
  fs.rmSync(path.join(raiz, 'config'), { recursive: true, force: true });
  assert.throws(() => listarArchivos(raiz), /config/, 'falta una parte del servicio');
});

// ---------------------------------------------------------------------------
// Comprobar
// ---------------------------------------------------------------------------

test('sello - comprobar dice OK cuando el arbol es el sellado', () => {
  const raiz = crearArbol();
  const salida = path.join(raiz, 'VERSION');
  escribirSello(salida, generarSello({ raiz: raiz, commit: 'f'.repeat(40) }));

  const r = comprobarSello(raiz, salida);
  assert.equal(r.ok, true, r.linea);
});

test('sello - comprobar dice que NO cuando el arbol cambio', () => {
  const raiz = crearArbol();
  const salida = path.join(raiz, 'VERSION');
  escribirSello(salida, generarSello({ raiz: raiz, commit: 'f'.repeat(40) }));

  fs.writeFileSync(path.join(raiz, 'package-lock.json'), 'lock viejo\n', 'utf8');
  const r = comprobarSello(raiz, salida);
  assert.equal(r.ok, false);
  assert.match(r.linea, /NO CORRESPONDE AL SELLO/i);
});

test('sello - comprobar sin archivo de sello lo dice (no dice OK)', () => {
  const raiz = crearArbol();
  const r = comprobarSello(raiz, path.join(raiz, 'VERSION'));
  assert.equal(r.ok, false);
  assert.match(r.linea, /NO HAY SELLO/i);
});

// ---------------------------------------------------------------------------
// El /health publica el sello (sin abrir la base)
// ---------------------------------------------------------------------------

test('sello - la ruta de salud publica el campo version_sello', () => {
  const fuente = fs.readFileSync(
    path.join(RAIZ_REPO, 'src', 'routes', 'health.js'),
    'utf8'
  );
  assert.match(fuente, /version_sello/, 'la respuesta de salud tiene que publicar el sello');
  assert.match(
    fuente,
    /leerSelloPublico/,
    'el valor sale de la logica probada en este archivo'
  );
});

// ---------------------------------------------------------------------------
// La RUTA: el /health no se cae por el sello
// ---------------------------------------------------------------------------
//
// Estos tests cargan la ruta REAL de salud, pero con la base de datos y la
// configuracion sustituidas por dobles: no se abre NINGUNA base (ni la de
// pruebas ni la de produccion) y el archivo no depende de `tests/setup.js`.
//
// El caso que se prueba es el que tumbo el /health: si el modulo del sello
// no se puede cargar (el paquete de despliegue sin `scripts/`), la variable
// queda en null y llamarla LANZA. El /health tiene que responder igual y
// decir "no hay sello".

const RUTA_HEALTH = require.resolve('../../src/routes/health');
const RUTA_MODULO_SELLO = require.resolve('../../scripts/generar-sello-version');
const RUTA_DB = require.resolve('../../src/db/connection');
const RUTA_CONFIG = require.resolve('../../src/config');
const RUTA_LOGGER = require.resolve('../../src/utils/logger');

/**
 * Carga la ruta de salud con dobles, sin abrir ninguna base.
 *
 * @param {'real'|'ausente'|'sin-export'|'lanza'} modo como se comporta el
 *   modulo del sello: 'real' = el de verdad; 'ausente' = el `require` LANZA
 *   (el paquete sin `scripts/`); 'sin-export' = el modulo carga pero no
 *   exporta la funcion; 'lanza' = la funcion revienta al llamarse.
 * @returns {import('express').Router}
 */
function cargarHealth(modo) {
  const guardados = {};
  const claves = [RUTA_HEALTH, RUTA_DB, RUTA_CONFIG, RUTA_LOGGER, RUTA_MODULO_SELLO];
  for (const c of claves) guardados[c] = require.cache[c];

  // La base: un doble que siempre esta bien. NO se abre ningun archivo.
  require.cache[RUTA_DB] = {
    id: RUTA_DB,
    filename: RUTA_DB,
    loaded: true,
    exports: { prepare: () => ({ get: () => ({ ok: 1 }) }) },
  };
  // La configuracion: un doble completo (el `env` decide el `kair_version`
  // y el SMTP decide si el servicio esta sano).
  require.cache[RUTA_CONFIG] = {
    id: RUTA_CONFIG,
    filename: RUTA_CONFIG,
    loaded: true,
    exports: {
      env: 'production',
      smtp: { host: 'localhost', user: 'u', pass: 'p' },
    },
  };

  delete require.cache[RUTA_HEALTH];
  delete require.cache[RUTA_LOGGER];

  const cargaOriginal = Module._load;
  try {
    if (modo === 'ausente') {
      // El `require` del modulo del sello LANZA: es el caso real de un
      // paquete de despliegue sin `scripts/`.
      Module._load = function (request, parent, isMain) {
        if (typeof request === 'string'
            && request.indexOf('generar-sello-version') >= 0) {
          throw new Error('MODULE_NOT_FOUND (simulado): el modulo no esta');
        }
        return cargaOriginal.apply(this, arguments);
      };
    } else if (modo === 'sin-export') {
      require.cache[RUTA_MODULO_SELLO] = {
        id: RUTA_MODULO_SELLO,
        filename: RUTA_MODULO_SELLO,
        loaded: true,
        exports: {},
      };
    } else if (modo === 'lanza') {
      require.cache[RUTA_MODULO_SELLO] = {
        id: RUTA_MODULO_SELLO,
        filename: RUTA_MODULO_SELLO,
        loaded: true,
        exports: {
          leerSelloPublico: () => { throw new Error('fallo simulado al leer'); },
        },
      };
    }

    return require(RUTA_HEALTH);
  } finally {
    Module._load = cargaOriginal;
    // Se restaura el cache: este archivo no puede dejar el arbol de
    // modulos modificado para el resto de la suite.
    for (const c of claves) {
      delete require.cache[c];
      if (guardados[c]) require.cache[c] = guardados[c];
    }
  }
}

/**
 * Arma una app minima con la ruta de salud y la consulta.
 * @param {import('express').Router} router
 * @returns {Promise<{status: number, body: object}>}
 */
async function pedirHealth(router) {
  const app = express();
  app.use(router);
  const res = await request(app).get('/health').set('Accept', 'application/json');
  return { status: res.status, body: res.body };
}

test('sello - el /health NO se cae si el modulo del sello no se puede cargar', async () => {
  const router = cargarHealth('ausente');
  const r = await pedirHealth(router);
  assert.notEqual(r.status, 500, 'el /health no puede responder 500 por el sello');
  assert.equal(r.status, 200, 'el servicio esta sano: tiene que responder 200');
  assert.ok(r.body, 'la respuesta tiene que ser JSON');
  assert.equal(
    r.body.version_sello.estado,
    'ausente',
    'sin el modulo, el sello dice que NO hay sello'
  );
  assert.ok(r.body.version_sello.detalle, 'el motivo va escrito');
});

test('sello - el /health NO se cae si el modulo carga pero sin la funcion', async () => {
  const router = cargarHealth('sin-export');
  const r = await pedirHealth(router);
  assert.equal(r.status, 200, 'el /health tiene que seguir respondiendo');
  assert.equal(r.body.version_sello.estado, 'ausente');
});

test('sello - el /health NO se cae si la lectura del sello revienta', async () => {
  const router = cargarHealth('lanza');
  const r = await pedirHealth(router);
  assert.equal(r.status, 200, 'el /health tiene que seguir respondiendo');
  assert.equal(r.body.version_sello.estado, 'ausente');
  assert.ok(r.body.version_sello.detalle, 'el motivo va escrito');
});

test('sello - el /health con el modulo real responde 200 y con el sello', async () => {
  const router = cargarHealth('real');
  const r = await pedirHealth(router);
  assert.equal(r.status, 200);
  assert.ok(r.body.version_sello, 'el campo version_sello tiene que estar');
  assert.ok(
    ['presente', 'ausente'].indexOf(r.body.version_sello.estado) >= 0,
    'el estado del sello tiene que ser uno de los dos'
  );
});

test('sello - el /health sigue anunciando kair_version como antes', async () => {
  const router = cargarHealth('real');
  const r = await pedirHealth(router);
  assert.equal(
    r.body.kair_version,
    'compatible-0.1.189',
    'kair_version NO se toca: el gate depende de el'
  );
});

test('sello - el /health no cambia los demas campos de la respuesta', async () => {
  const router = cargarHealth('real');
  const r = await pedirHealth(router);
  assert.equal(r.body.status, 'ok');
  assert.equal(r.body.version, '0.1.0');
  assert.equal(r.body.checks.db, 'ok');
  assert.equal(r.body.checks.smtp, 'configured');
  assert.equal(typeof r.body.uptime_seconds, 'number');
  assert.ok(r.body.timestamp, 'el timestamp sigue ahi');
});

test('sello - la ruta de salud NO cambia kair_version (el gate depende de el)', () => {
  const fuente = fs.readFileSync(
    path.join(RAIZ_REPO, 'src', 'routes', 'health.js'),
    'utf8'
  );
  assert.match(
    fuente,
    /kair_version:\s*'compatible-'\s*\+\s*\(config\.env\s*===\s*'production'\s*\?\s*'0\.1\.189'\s*:\s*'dev'\)/,
    'kair_version tiene que quedar EXACTO como estaba'
  );
});

test('sello - el campo publicado NO puede filtrar secretos', () => {
  const valor = armarSelloPublico(JSON.stringify({
    commit: 'a'.repeat(40),
    fecha: '2026-11-12T19:41:00Z',
    arbol: '0123456789ab',
  }));
  const claves = Object.keys(valor).sort();
  assert.deepEqual(
    claves,
    ['arbol', 'commit', 'commit_corto', 'estado', 'fecha'],
    'el campo publico solo lleva el commit, la fecha y el hash del arbol'
  );
  for (const k of claves) {
    assert.equal(typeof valor[k], 'string', 'todos los valores son texto');
  }
});
