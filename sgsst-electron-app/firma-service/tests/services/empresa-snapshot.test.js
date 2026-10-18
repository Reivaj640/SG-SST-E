/**
 * Tests del snapshot de identificación de la empresa (migraciones 017/018).
 *
 * Estos tests NO abren la base de datos: inyectan un stub en el cache de
 * módulos de Node antes de que `empresa.js` cargue `db/connection`. Motivo:
 * la suite que sí usa la BD depende de `better-sqlite3`, que en esta máquina
 * esta compilado para otra version de Node y no carga (ver PROMPT.md §9
 * trampa 15). El snapshot es la parte criptograficamente critica del feature
 * (de la depende la huella que se archiva con cada firma), asi que tiene que
 * estar cubierta aunque el resto de la suite no corra.
 *
 * Que se prueba:
 *  - Que la huella sea REPRODUCIBLE: mismos datos -> misma huella.
 *  - Que la huella CAMBIE si cambia un solo dato.
 *  - Que la huella NO dependa de metadatos de gestion (updated_at, anexo).
 *  - Que el orden del JSON sea estable (por eso se construye en SNAPSHOT_FIELDS).
 *  - Que una empresa inactiva o inexistente NO produzca snapshot.
 *  - Que publicViewFor NO exponga los metadatos de gestion.
 *
 * Tests:
 *   - node --test tests/services/empresa-snapshot.test.js
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ────────────────────────────────────────────────────────────────────────────
// Variables de entorno minimas. config.js las exige al cargar (via logger).
// Se setean aqui y no con tests/setup.js para que este archivo corra con un
// `node --test` pelado, sin el setup que carga better-sqlite3.
// Son valores de prueba sin ninguna relacion con produccion.
// ────────────────────────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';
process.env.INTERNAL_API_KEY = 'test-empresa-snapshot-internal';
process.env.ADMIN_API_KEY = 'test-empresa-snapshot-admin';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test-pass';
process.env.SMTP_FROM_EMAIL = 'no-reply@example.com';

// ────────────────────────────────────────────────────────────────────────────
// Stub de la BD. Se inyecta ANTES de requerir empresa.js.
// ────────────────────────────────────────────────────────────────────────────

/** Filas que el stub devuelve, indexadas por id_empresa. */
const _filas = new Map();
/** Ultima consulta ejecutada, para las aserciones sobre el lookup. */
let _ultimaSql = '';
let _ultimosParams = [];

function _installDbStub() {
  const connectionPath = require.resolve(path.join(__dirname, '..', '..', 'src', 'db', 'connection.js'));
  const stub = {
    prepare(sql) {
      _ultimaSql = sql;
      return {
        get(...params) {
          _ultimosParams = params;
          // Solo se consulta por id_empresa en este service.
          const fila = _filas.get(params[0]);
          return fila ? Object.assign({}, fila) : undefined;
        },
        all() {
          return Array.from(_filas.values()).map((f) => Object.assign({}, f));
        },
        run() {
          return { changes: 0, lastInsertRowid: 0 };
        },
      };
    },
  };
  const mod = new module.constructor.Module(connectionPath, null);
  mod.filename = connectionPath;
  mod.loaded = true;
  mod.exports = stub;
  require.cache[connectionPath] = mod;
}

_installDbStub();

const empresa = require('../../src/services/empresa');
const { sha256 } = require('../../src/crypto/hash');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const EMPRESA_COMPLETA = {
  id_empresa: '900829731',
  razon_social: 'Aseplus S.A.S.',
  nit: '900829731',
  domicilio: 'Bogota D.C.',
  representante_legal: 'Persona Representante',
  representante_legal_identificacion: '1010101010',
  responsable_tratamiento: 'Persona Representante',
  responsable_tratamiento_correo: 'privacidad@ejemplo.co',
  canal_pqrs: 'pqrs@ejemplo.co',
  canal_incidentes: 'seguridad@ejemplo.co',
  politica_datos_url: 'https://ejemplo.co/privacidad',
  anexo_encargo_firmado_at: null,
  activo: 1,
  created_at: '2026-10-01 10:00:00',
  updated_at: '2026-10-01 10:00:00',
};

function _sembrar(fila) {
  _filas.clear();
  if (fila) _filas.set(fila.id_empresa, Object.assign({}, fila));
}

// ────────────────────────────────────────────────────────────────────────────
// Reproducibilidad de la huella
// ────────────────────────────────────────────────────────────────────────────

test('buildSnapshot devuelve el mismo texto y la misma huella dos veces seguidas', () => {
  _sembrar(EMPRESA_COMPLETA);
  const a = empresa.buildSnapshot('900829731');
  const b = empresa.buildSnapshot('900829731');
  assert.equal(a.huella, b.huella, 'la huella debe ser estable');
  assert.equal(a.texto, b.texto, 'el texto canonico debe ser identico');
  assert.equal(a.huella.length, 64, 'SHA-256 en hex son 64 chars');
  assert.match(a.huella, /^[0-9a-f]{64}$/);
});

test('la huella es el SHA-256 del texto canonico (verificable por fuera)', () => {
  _sembrar(EMPRESA_COMPLETA);
  const snap = empresa.buildSnapshot('900829731');
  assert.equal(snap.huella, sha256(snap.texto),
    'cualquiera con el texto debe poder recalcular la huella');
});

test('el texto canonico tiene las claves en el orden de SNAPSHOT_FIELDS', () => {
  _sembrar(EMPRESA_COMPLETA);
  const snap = empresa.buildSnapshot('900829731');
  const orden = Object.keys(JSON.parse(snap.texto));
  assert.deepEqual(orden, empresa.SNAPSHOT_FIELDS,
    'el orden importa: es lo que hace reproducible la huella');
});

test('cambiar UN solo dato de identificacion cambia la huella', () => {
  _sembrar(EMPRESA_COMPLETA);
  const antes = empresa.buildSnapshot('900829731').huella;

  const modificada = Object.assign({}, EMPRESA_COMPLETA, { domicilio: 'Medellin' });
  _sembrar(modificada);
  const despues = empresa.buildSnapshot('900829731').huella;

  assert.notEqual(antes, despues,
    'si cambiar el domicilio no mueve la huella, la huella no identifica nada');
});

test('cada campo de identificacion cambia la huella', () => {
  _sembrar(EMPRESA_COMPLETA);
  const base = empresa.buildSnapshot('900829731').huella;

  for (const campo of empresa.SNAPSHOT_FIELDS) {
    if (campo === 'id_empresa') continue;
    const fila = Object.assign({}, EMPRESA_COMPLETA);
    fila[campo] = fila[campo] === null ? 'valor nuevo' : String(fila[campo]) + ' cambiado';
    _sembrar(fila);
    const nueva = empresa.buildSnapshot('900829731').huella;
    assert.notEqual(base, nueva, `cambiar ${campo} debe cambiar la huella`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// La huella NO debe depender de metadatos de gestion
// ────────────────────────────────────────────────────────────────────────────

test('la huella NO cambia si solo cambia updated_at', () => {
  _sembrar(EMPRESA_COMPLETA);
  const antes = empresa.buildSnapshot('900829731').huella;
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, { updated_at: '2026-12-31 23:59:59' }));
  assert.equal(antes, empresa.buildSnapshot('900829731').huella,
    'una correccion administrativa no debe invalidar lo que el firmante vio');
});

test('la huella NO cambia si solo cambia anexo_encargo_firmado_at', () => {
  _sembrar(EMPRESA_COMPLETA);
  const antes = empresa.buildSnapshot('900829731').huella;
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, {
    anexo_encargo_firmado_at: '2026-11-01T00:00:00.000Z',
  }));
  assert.equal(antes, empresa.buildSnapshot('900829731').huella,
    'firmar el anexo es un hito administrativo, no parte de la identificacion');
});

test('la huella NO cambia si cambia created_at', () => {
  _sembrar(EMPRESA_COMPLETA);
  const antes = empresa.buildSnapshot('900829731').huella;
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, { created_at: '2020-01-01 00:00:00' }));
  assert.equal(antes, empresa.buildSnapshot('900829731').huella);
});

test('el snapshot NO incluye metadatos de gestion en el JSON', () => {
  _sembrar(EMPRESA_COMPLETA);
  const claves = Object.keys(JSON.parse(empresa.buildSnapshot('900829731').texto));
  for (const prohibido of ['created_at', 'updated_at', 'anexo_encargo_firmado_at', 'activo']) {
    assert.ok(!claves.includes(prohibido),
      `${prohibido} no debe quedar dentro de la huella`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Empresas que no deben producir snapshot
// ────────────────────────────────────────────────────────────────────────────

test('una empresa inexistente NO produce snapshot', () => {
  _sembrar(null);
  assert.equal(empresa.buildSnapshot('999999999'), null);
  assert.equal(empresa.snapshotColumnsFor('999999999').snapshot, null);
  assert.equal(empresa.snapshotColumnsFor('999999999').hash, null);
});

test('una empresa dada de baja NO produce snapshot', () => {
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, { activo: 0 }));
  assert.equal(empresa.buildSnapshot('900829731'), null,
    'una empresa retirada no debe anunciarse como si siguiera operando');
});

test('un id vacio o de tipo incorrecto NO produce snapshot ni lanza', () => {
  _sembrar(EMPRESA_COMPLETA);
  assert.equal(empresa.buildSnapshot(''), null);
  assert.equal(empresa.buildSnapshot(null), null);
  assert.equal(empresa.buildSnapshot(undefined), null);
  assert.equal(empresa.buildSnapshot(12345), null);
});

// ────────────────────────────────────────────────────────────────────────────
// Lo que ve el firmante
// ────────────────────────────────────────────────────────────────────────────

test('publicViewFor expone los datos de identificacion y la huella', () => {
  _sembrar(EMPRESA_COMPLETA);
  const view = empresa.publicViewFor('900829731');
  assert.equal(view.razon_social, 'Aseplus S.A.S.');
  assert.equal(view.nit, '900829731');
  assert.equal(view.huella, empresa.buildSnapshot('900829731').huella);
});

test('publicViewFor NO expone metadatos de gestion al firmante', () => {
  _sembrar(EMPRESA_COMPLETA);
  const view = empresa.publicViewFor('900829731');
  for (const prohibido of ['created_at', 'updated_at', 'anexo_encargo_firmado_at', 'activo']) {
    assert.ok(!(prohibido in view),
      `${prohibido} no debe enviarse al navegador del firmante`);
  }
});

test('publicViewFor de una empresa dada de baja es null', () => {
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, { activo: 0 }));
  assert.equal(empresa.publicViewFor('900829731'), null);
});

test('campos sin valor llegan como null, no como string vacio', () => {
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, {
    nit: null, domicilio: null, canal_pqrs: null,
  }));
  const view = empresa.publicViewFor('900829731');
  assert.equal(view.nit, null);
  assert.equal(view.domicilio, null);
  assert.equal(view.canal_pqrs, null);
});

// ────────────────────────────────────────────────────────────────────────────
// parseSnapshot: lo que corre cuando ya se está generando el PDF
// ────────────────────────────────────────────────────────────────────────────

test('parseSnapshot devuelve exactamente los datos que se archivaron', () => {
  _sembrar(EMPRESA_COMPLETA);
  const snap = empresa.buildSnapshot('900829731');
  const back = empresa.parseSnapshot(snap.texto);
  assert.deepEqual(back, snap.datos,
    'la constancia imprime lo que se parsea; si no coincide con lo archivado, ' +
    'el PDF estaria mostrando una empresa distinta a la que firmo');
});

test('parseSnapshot NO es fooled por texto que no es JSON', () => {
  assert.equal(empresa.parseSnapshot('{no es json'), null);
  assert.equal(empresa.parseSnapshot('<script>alert(1)</script>'), null);
});

test('parseSnapshot devuelve null en vez de revirar la generacion del PDF', () => {
  // Un snapshot corrupto no puede tumbar la constancia: es preferible un PDF
  // sin esa seccion que quedarse sin constancia.
  assert.equal(empresa.parseSnapshot(null), null);
  assert.equal(empresa.parseSnapshot(undefined), null);
  assert.equal(empresa.parseSnapshot(''), null);
  assert.equal(empresa.parseSnapshot(12345), null);
  assert.equal(empresa.parseSnapshot({}), null);
  assert.equal(empresa.parseSnapshot('[]'), null, 'un array no es una identificacion');
  assert.equal(empresa.parseSnapshot('"texto"'), null);
  assert.equal(empresa.parseSnapshot('null'), null);
});

test('parseSnapshot de una empresa sin snapshot archivado es null', () => {
  _sembrar(null);
  assert.equal(empresa.parseSnapshot(empresa.snapshotColumnsFor('900829731').snapshot), null);
});

// ────────────────────────────────────────────────────────────────────────────
// Mutaciones: cada asercion tiene que MORDER
// Sin esto, un test que pasa porque el codigo no hace nada es peor que no
// tener test (PROMPT.md §7.2).
// ────────────────────────────────────────────────────────────────────────────

test('MUTACION: si se lee por otro campo, los tests de huella lo detectan', () => {
  // Reproduce el error tipico: resolver la empresa por razon_social en vez
  // de por id_empresa, lo que haria que la huella fuera la de otra empresa.
  _sembrar(EMPRESA_COMPLETA);
  _filas.set('OTRA', Object.assign({}, EMPRESA_COMPLETA, {
    id_empresa: 'OTRA', razon_social: 'Otra S.A.S.',
  }));
  const correcta = empresa.buildSnapshot('900829731');
  const equivocada = empresa.buildSnapshot('OTRA');
  assert.notEqual(correcta.huella, equivocada.huella,
    'si esto fuera igual, la huella no distinguiria una empresa de otra');
  assert.equal(correcta.datos.razon_social, 'Aseplus S.A.S.');
});

test('MUTACION: si se include updated_at en el snapshot, la huella queda expuesta', () => {
  _sembrar(EMPRESA_COMPLETA);
  const conMeta = JSON.stringify(Object.assign({}, empresa.buildSnapshot('900829731').datos, {
    updated_at: EMPRESA_COMPLETA.updated_at,
  }));
  assert.notEqual(conMeta, empresa.buildSnapshot('900829731').texto,
    'agregar un metadato al objeto cambia el texto y por tanto la huella');
});

test('MUTACION: quitar el filtro de activo haria aparecer empresas retiradas', () => {
  _sembrar(Object.assign({}, EMPRESA_COMPLETA, { activo: 0 }));
  assert.equal(empresa.getActiva('900829731'), null,
    'getActiva debe filtrar por activo');
  assert.ok(empresa.getById('900829731'),
    'getById si debe ver la fila, para que el admin pueda consultarla');
});