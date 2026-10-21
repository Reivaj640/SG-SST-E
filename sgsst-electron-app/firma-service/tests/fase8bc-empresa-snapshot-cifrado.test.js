/**
 * 8B-C · EL SNAPSHOT DE LA EMPRESA NO GUARDA EL DOCUMENTO DEL REPRESENTANTE
 * EN CLARO
 * =========================================================================
 *
 * 8B cifró `gh_firmas_electronicas.representante_legal_snapshot`, pero dejó
 * abierta la otra copia: `gh_consentimientos_firma.empresa_snapshot`. Esa
 * copia se conserva como prueba de la aceptación (12.7) y sobrevive a la
 * supresión de la firma, así que el número en claro seguía vivo ahí.
 *
 * Lo que se prueba aquí:
 *
 *   1. El sobre nuevo es `v2` y ata el cifrado a la Empresa Y al campo (AAD).
 *   2. Un sobre `v1` heredado se sigue pudiendo abrir.
 *   3. Un ámbito vacío NO se convierte en `global`.
 *   4. `snapshotColumnsFor()` cifra el documento y conserva la huella sobre
 *      el JSON canónico EN CLARO.
 *   5. `parseSnapshotParaMostrar()` nunca devuelve el número completo y
 *      enmascara también las filas heredadas.
 *   6. La presentación del PDF no puede imprimir el número completo ni
 *      `CC —`: si no hay dato, dice `No disponible`.
 *   7. El consentimiento persistido no contiene el número en claro.
 */
'use strict';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const {
  cifrar, descifrar, esCifrado, FORMATO, PREFIJO,
} = require('../src/crypto/cifrado');
const { derivedKey } = require('../src/crypto/hmac');
const { getKeyVersionActual } = require('../src/crypto/keys');
const empresaService = require('../src/services/empresa');
const pdfGenConsolidado = require('../src/services/pdfGenConsolidado');
const { resetDb, createAcceptedConsent } = require('./helpers');

const EMPRESA = '900123456';
const TRABAJADOR = '1234567890';
const NUMERO = '79123456';
const ULTIMOS = '3456';

const EMPRESA_DATOS = {
  id_empresa: EMPRESA,
  razon_social: 'Empresa de Prueba S.A.S.',
  nit: EMPRESA,
  domicilio: 'Bogotá D.C.',
  representante_legal: 'Javier Robles',
  representante_legal_identificacion: NUMERO,
  responsable_tratamiento: 'Javier Robles',
  responsable_tratamiento_correo: 'privacidad@example.com',
  canal_pqrs: 'pqrs@example.com',
  canal_incidentes: 'seguridad@example.com',
  politica_datos_url: 'https://example.com/privacidad',
  plazo_retencion: '5 años',
  canal_solicitud_copia: 'privacidad@example.com',
  plazo_retencion_dias: 1825,
};

/**
 * Construye un sobre v1 (sin AAD) con la misma derivación que usaba 8B.
 * Sirve para probar que las filas históricas no quedan ilegibles.
 */
function sobreV1(texto, ambito = EMPRESA, proposito = 'cifrado-representante') {
  const version = getKeyVersionActual();
  const clave = derivedKey(proposito, ambito, version);
  const iv = crypto.randomBytes(12);
  const cifrador = crypto.createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return 'enc:v1:' + version
    + ':' + iv.toString('base64url')
    + ':' + cifrador.getAuthTag().toString('base64url')
    + ':' + datos.toString('base64url');
}

// =========================================================================
// 1. Cifrado v2: AAD por Empresa y por campo
// =========================================================================

test('8B-C · el sobre nuevo es v2 y se abre con el mismo campo', () => {
  const sobre = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  assert.equal(FORMATO, 'v2');
  assert.equal(PREFIJO, 'enc:v2:');
  assert.ok(sobre.startsWith('enc:v2:'), 'el sobre nuevo tiene que declarar v2');
  assert.equal(descifrar(sobre, EMPRESA, undefined, 'campo_a'), NUMERO);
});

test('8B-C · el mismo texto dos veces produce sobres distintos (IV aleatorio)', () => {
  const a = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  const b = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  assert.notEqual(a, b, 'GCM con IV aleatorio no puede ser determinista');
  assert.equal(descifrar(a, EMPRESA, undefined, 'campo_a'), NUMERO);
  assert.equal(descifrar(b, EMPRESA, undefined, 'campo_a'), NUMERO);
});

test('8B-C · un sobre de un campo no se abre como si fuera otro campo', () => {
  const sobre = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  assert.throws(
    () => descifrar(sobre, EMPRESA, undefined, 'campo_b'),
    /no se puede descifrar/,
    'el AAD tiene que atar el sobre al campo, no solo a la Empresa'
  );
});

test('8B-C · un sobre de una Empresa no se abre con otra', () => {
  const sobre = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  assert.throws(
    () => descifrar(sobre, '900999999', undefined, 'campo_a'),
    /no se puede descifrar/
  );
});

test('8B-C · el ámbito vacío se rechaza, no se convierte en global', () => {
  assert.throws(() => cifrar(NUMERO, ''), /ambito/i);
  assert.throws(() => cifrar(NUMERO, '   '), /ambito/i);
  const sobre = cifrar(NUMERO, EMPRESA, undefined, 'campo_a');
  assert.throws(() => descifrar(sobre, ''), /ambito/i);
});

test('8B-C · un sobre v1 heredado se sigue abriendo', () => {
  const heredado = sobreV1(NUMERO);
  assert.equal(esCifrado(heredado), true);
  assert.equal(descifrar(heredado, EMPRESA), NUMERO,
    'la compatibilidad con v1 no se puede romper: hay filas ya cifradas');
});

test('8B-C · esCifrado reconoce v1 y v2, y no confunde un número en claro', () => {
  assert.equal(esCifrado(sobreV1(NUMERO)), true);
  assert.equal(esCifrado(cifrar(NUMERO, EMPRESA, undefined, 'campo_a')), true);
  assert.equal(esCifrado(NUMERO), false);
  assert.equal(esCifrado(null), false);
});

// =========================================================================
// 2. Snapshot de la empresa: cifrado, huella sobre el claro
// =========================================================================

test('8B-C · snapshotColumnsFor cifra el documento y guarda los últimos 4', () => {
  const snap = empresaService.buildSnapshot(EMPRESA);
  const cols = empresaService.snapshotColumnsFor(EMPRESA);

  assert.ok(snap, 'la empresa de prueba tiene que existir');
  assert.equal(cols.hash, snap.huella, 'la huella sigue siendo la del JSON canónico en claro');
  assert.equal(cols.snapshot.includes(NUMERO), false,
    'el número completo no puede quedar en el snapshot persistido');

  const guardado = JSON.parse(cols.snapshot);
  assert.equal(esCifrado(guardado.representante_legal_identificacion), true);
  assert.equal(guardado.representante_legal_identificacion_ultimos4, ULTIMOS);
  assert.equal(guardado.razon_social, EMPRESA_DATOS.razon_social);
});

test('8B-C · la huella se puede recalcular descifrando el snapshot', () => {
  const cols = empresaService.snapshotColumnsFor(EMPRESA);
  const guardado = JSON.parse(cols.snapshot);
  const claro = empresaService.descifrarSnapshotEmpresa(guardado, EMPRESA);

  assert.equal(claro.representante_legal_identificacion, NUMERO);
  assert.equal(
    empresaService.hashSnapshotEmpresa(claro),
    cols.hash,
    'el hash tiene que seguir siendo verificable sobre el claro'
  );
});

test('8B-C · la huella de un snapshot histórico de 11 campos sigue cuadrando', () => {
  const actual = empresaService.buildSnapshot(EMPRESA).datos;
  const historico = {};
  for (const campo of empresaService.SNAPSHOT_FIELDS.slice(0, 11)) {
    historico[campo] = actual[campo];
  }
  const texto = JSON.stringify(historico);
  const huella = sha256(texto);

  assert.equal(
    empresaService.hashSnapshotEmpresa(historico),
    huella,
    'no se pueden agregar como null los campos que el snapshot histórico no tenía'
  );
  assert.equal(empresaService.hashSnapshotEmpresa(texto), huella);

  const mostrado = empresaService.parseSnapshotParaMostrar(
    texto,
    EMPRESA,
    { hashEsperado: huella }
  );
  assert.equal(mostrado.representante_legal_identificacion, '****' + ULTIMOS);
  assert.equal(mostrado.empresa_hash_verificado, true);
});

test('8B-C · hashSnapshotEmpresa no acepta un sobre ni una máscara', () => {
  const cols = empresaService.snapshotColumnsFor(EMPRESA);
  const guardado = JSON.parse(cols.snapshot);
  assert.equal(empresaService.hashSnapshotEmpresa(guardado), null);

  const enmascarado = Object.assign({}, empresaService.buildSnapshot(EMPRESA).datos, {
    representante_legal_identificacion: '****' + ULTIMOS,
  });
  assert.equal(empresaService.hashSnapshotEmpresa(enmascarado), null);
});

test('8B-C · descifrarSnapshotEmpresa no muta el objeto guardado', () => {
  const guardado = JSON.parse(empresaService.snapshotColumnsFor(EMPRESA).snapshot);
  const copia = JSON.parse(JSON.stringify(guardado));
  empresaService.descifrarSnapshotEmpresa(guardado, EMPRESA);
  assert.deepEqual(guardado, copia, 'descifrar no puede cambiar la fila en memoria');
});

test('8B-C · parseSnapshotParaMostrar nunca devuelve el número completo', () => {
  const cols = empresaService.snapshotColumnsFor(EMPRESA);
  const mostrado = empresaService.parseSnapshotParaMostrar(cols.snapshot, EMPRESA);

  assert.equal(mostrado.representante_legal_identificacion, '****' + ULTIMOS);
  assert.equal(mostrado.representante_legal_identificacion_enmascarada, '****' + ULTIMOS);
  assert.equal(JSON.stringify(mostrado).includes(NUMERO), false,
    'el objeto que va al PDF no puede contener el número completo');
  assert.equal(mostrado.razon_social, EMPRESA_DATOS.razon_social);
  assert.equal(mostrado.empresa_hash_verificado, null,
    'sin huella esperada no se puede fingir que se verificó');
});

test('8B-C · la presentación verifica la huella y falla cerrada si no cuadra', () => {
  const cols = empresaService.snapshotColumnsFor(EMPRESA);

  const ok = empresaService.parseSnapshotParaMostrar(
    cols.snapshot,
    EMPRESA,
    { hashEsperado: cols.hash }
  );
  assert.equal(ok.representante_legal_identificacion, '****' + ULTIMOS);
  assert.equal(ok.empresa_hash_verificado, true);

  const alterada = empresaService.parseSnapshotParaMostrar(
    cols.snapshot,
    EMPRESA,
    { hashEsperado: '0'.repeat(64) }
  );
  assert.equal(alterada.representante_legal_identificacion, null);
  assert.equal(alterada.empresa_hash_verificado, false,
    'una huella que no corresponde no puede mostrar un número aparentemente válido');
});

test('8B-C · parseSnapshotParaMostrar enmascara también una fila heredada en claro', () => {
  const heredada = JSON.stringify({
    ...empresaService.buildSnapshot(EMPRESA).datos,
    representante_legal_identificacion: NUMERO,
  });
  const mostrado = empresaService.parseSnapshotParaMostrar(heredada, EMPRESA);

  assert.equal(mostrado.representante_legal_identificacion, '****' + ULTIMOS);
  assert.equal(JSON.stringify(mostrado).includes(NUMERO), false);
});

test('8B-C · un sobre alterado no se muestra como número inventado', () => {
  const cols = empresaService.snapshotColumnsFor(EMPRESA);
  const guardado = JSON.parse(cols.snapshot);
  const sobre = guardado.representante_legal_identificacion;
  guardado.representante_legal_identificacion = sobre.slice(0, -2) + 'AA';

  const mostrado = empresaService.parseSnapshotParaMostrar(
    JSON.stringify(guardado),
    EMPRESA,
    { hashEsperado: cols.hash }
  );
  assert.equal(mostrado.representante_legal_identificacion, null);
  assert.equal(mostrado.representante_legal_identificacion_enmascarada, null);
  assert.equal(mostrado.empresa_hash_verificado, false);
});

// =========================================================================
// 3. Presentación: ni número completo ni "CC —"
// =========================================================================

test('8B-C · el PDF simple no puede imprimir el número completo', () => {
  const mostrado = empresaService.parseSnapshotParaMostrar(
    empresaService.snapshotColumnsFor(EMPRESA).snapshot,
    EMPRESA
  );
  assert.equal(empresaService.documentoRepresentanteParaMostrar(mostrado), '****' + ULTIMOS);

  // Defensa en profundidad: aunque el llamador pase el dato crudo, el
  // presentador no lo imprime.
  assert.equal(
    empresaService.documentoRepresentanteParaMostrar({
      representante_legal_identificacion: NUMERO,
    }),
    'No disponible'
  );
});

test('8B-C · la constancia consolidada no imprime "CC —"', () => {
  assert.equal(
    pdfGenConsolidado.identificacionFirmanteEmpresa(null),
    'No disponible'
  );
  assert.equal(
    pdfGenConsolidado.identificacionFirmanteEmpresa({ numero_identificacion: NUMERO }),
    'No disponible'
  );
  assert.equal(
    pdfGenConsolidado.identificacionFirmanteEmpresa({
      identificacion_enmascarada: '****' + ULTIMOS,
    }),
    '****' + ULTIMOS
  );
});

// =========================================================================
// 4. El consentimiento persistido
// =========================================================================

beforeEach(() => {
  resetDb();
  // `resetDb()` limpia las tablas de firma, pero no la tabla de empresas:
  // se borra aquí para que cada caso arranque con la empresa de prueba.
  db.prepare('DELETE FROM gh_firma_empresas').run();
  empresaService.create(EMPRESA_DATOS);
});

test('8B-C · el consentimiento del trabajador no guarda el número en claro', async () => {
  const { consent_id } = await createAcceptedConsent({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
  });

  const fila = db.prepare(
    'SELECT empresa_snapshot, empresa_hash FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent_id);

  assert.ok(fila, 'el consentimiento tiene que existir');
  assert.equal(fila.empresa_snapshot.includes(NUMERO), false,
    'el número del representante no puede quedar en claro en el consentimiento');
  assert.equal(fila.empresa_hash, empresaService.buildSnapshot(EMPRESA).huella);

  const guardado = JSON.parse(fila.empresa_snapshot);
  assert.equal(esCifrado(guardado.representante_legal_identificacion), true);
  assert.equal(guardado.representante_legal_identificacion_ultimos4, ULTIMOS);
});
