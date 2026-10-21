/**
 * 8B · EL NÚMERO DEL REPRESENTANTE LEGAL VA CIFRADO (H23)
 * ========================================================
 *
 * El H23 de la auditoría encontró que el número de documento del representante
 * legal quedaba EN TEXTO CLARO en `representante_legal_snapshot`, mientras que
 * el del trabajador se guardaba solo como huella.
 *
 * La respuesta obvia —hashear el número, igual que al trabajador— es
 * INCORRECTA para el representante: su número es PRUEBA DE LA REPRESENTACIÓN.
 * Puede necesitarse en una constancia o en un certificado de existencia y
 * representación legal, y una huella no se puede presentar como prueba.
 *
 * Entonces: **cifrar, no hashear** (corrección del owner, plan §8.1). El
 * número queda reversible solo para quien tenga la llave, y la llave vive
 * FUERA de la base de datos. Lo que se muestra es solo el final: los últimos
 * 4, igual que se hace con el firmante.
 *
 * LO QUE COMPRUEBAN ESTOS TESTS
 *
 *   1. El sobre: formato, versión de llave, IV aleatorio.
 *   2. El sobre ALTERADO no se descifra (GCM es AEAD).
 *   3. El ÁMBITO por empresa: el sobre de una empresa no se abre con otra.
 *   4. Una versión de llave fuera del anillo da un error explicito.
 *   5. El servicio: cifra, guarda los últimos 4, no muta el original, y
 *      reconoce las filas heredadas (número en claro).
 *   6. LA FILA NO GUARDA EL NÚMERO EN CLARO (ni el padre ni el hijo).
 *   7. La huella de identificación y el seudónimo del representante siguen
 *      siendo los del NÚMERO REAL (regresión: si se calcularan sobre el
 *      sobre, el representante no podría identificarse ni su consentimiento
 *      sería verificable).
 *   8. La constancia muestra los últimos 4 y NUNCA el número completo.
 *   9. El contexto público no expone el número.
 *  10. MUTACION: los detectores muerden.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const { sha256 } = require('../src/crypto/hash');
const { cifrar, esCifrado, descifrar } = require('../src/crypto/cifrado');
const { _resetKeyCache } = require('../src/crypto/hmac');
const { _setKeyRingForTests } = require('../src/crypto/keys');
const { pseudonimo } = require('../src/services/trabajador');
const { huellaDesdeHashPrevio } = require('../src/services/identificacion');
const representanteService = require('../src/services/representante');
const consentService = require('../src/services/consent');
const signRequestService = require('../src/services/signRequest');
const pdfGenConsolidado = require('../src/services/pdfGenConsolidado');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion, capturarLogs,
} = require('./helpers');

const NUMERO = '79123456';
const ULTIMOS = '3456';
const EMPRESA = '900123456';
const TRABAJADOR = '1234567890';

const SNAPSHOT = {
  nombre: 'Javier Robles',
  cargo: 'Representante Legal',
  tipo_identificacion: 'CC',
  numero_identificacion: NUMERO,
  correo: 'rep@empresa.com',
};

// Mock del generador de la constancia consolidada, para capturar los datos
// que le llegan (mismo patrón que tests/fase8b-metadata-lista-blanca.test.js).
let pdfCallData = null;
const realGenerar = pdfGenConsolidado.generateConstanciaConsolidadaPdf;
pdfGenConsolidado.generateConstanciaConsolidadaPdf = async function (data) {
  pdfCallData = data;
  return Buffer.from(
    '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\n'
    + 'trailer\n<<>>\nstartxref\n0\n%%EOF\n',
    'latin1'
  );
};
test.after(() => {
  pdfGenConsolidado.generateConstanciaConsolidadaPdf = realGenerar;
});
test.beforeEach(() => {
  pdfCallData = null;
});

/**
 * EL DETECTOR: ¿la fila guarda el número del representante EN CLARO?
 *
 * Devuelve true si lo encuentra. Todo lo que de verdad se cifra tiene que
 * dar false; una fila heredada tiene que dar true (si no, el detector no
 * muerde y no sirve para nada).
 */
function filaGuardaNumeroEnClaro(id_solicitud, numero) {
  const fila = db.prepare(
    'SELECT representante_legal_snapshot FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  if (!fila || !fila.representante_legal_snapshot) return false;
  return fila.representante_legal_snapshot.includes(numero);
}

function snapshotDe(id_solicitud) {
  const fila = db.prepare(
    'SELECT representante_legal_snapshot FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(id_solicitud);
  return fila && fila.representante_legal_snapshot
    ? JSON.parse(fila.representante_legal_snapshot)
    : null;
}

// =========================================================================
// 1. El sobre
// =========================================================================

test('8B · el sobre se abre: cifrar y descifrar devuelven el mismo texto', () => {
  const sobre = cifrar(NUMERO, EMPRESA);
  assert.equal(descifrar(sobre, EMPRESA), NUMERO);
});

test('8B · el sobre declara su formato y la versión de llave', () => {
  const sobre = cifrar(NUMERO, EMPRESA);
  assert.ok(sobre.startsWith('enc:v2:'), `formato inesperado: ${sobre}`);
  assert.equal(esCifrado(sobre), true);
  assert.equal(esCifrado(NUMERO), false, 'un número en claro NO es un sobre');
  const partes = sobre.split(':');
  assert.equal(partes.length, 6, 'enc:v2:<version>:<iv>:<tag>:<cifrado>');
  assert.ok(partes[2].length > 0, 'el sobre dice con qué versión de llave se cifró');
});

test('8B · dos cifrados del mismo número son DISTINTOS (el IV es aleatorio)', () => {
  const a = cifrar(NUMERO, EMPRESA);
  const b = cifrar(NUMERO, EMPRESA);
  assert.notEqual(a, b, 'si el sobre fuera determinista, dos bases distintasían al mismo rep');
  assert.equal(descifrar(a, EMPRESA), NUMERO);
  assert.equal(descifrar(b, EMPRESA), NUMERO);
});

test('8B · el número NO aparece en el sobre en claro', () => {
  const sobre = cifrar(NUMERO, EMPRESA);
  assert.equal(sobre.includes(NUMERO), false, 'el número no puede quedar legible en el sobre');
});

// =========================================================================
// 2. El sobre alterado no se abre
// =========================================================================

test('8B · un sobre ALTERADO no se descifra', () => {
  const sobre = cifrar(NUMERO, EMPRESA);
  const partes = sobre.split(':');
  // Se altera un carácter del texto cifrado.
  const ct = partes[5];
  const alterado = ct[0] === 'A' ? 'B' + ct.slice(1) : 'A' + ct.slice(1);
  partes[5] = alterado;
  const sobreAlterado = partes.join(':');

  assert.throws(
    () => descifrar(sobreAlterado, EMPRESA),
    /no se puede descifrar|alterado/,
    'un sobre manipulado tiene que fallar, no devolver algo parecido'
  );
});

test('8B · un sobre con longitudes inválidas se rechaza', () => {
  assert.throws(
    () => descifrar('enc:v1:k1:AAAA:BBBB:CCCC', EMPRESA),
    /alterado|no tiene el formato/,
    'un sobre truncado tiene que rechazarse'
  );
});

// =========================================================================
// 3. El ámbito por empresa
// =========================================================================

test('8B · el sobre de una empresa NO se abre con el ámbito de otra', () => {
  const sobre = cifrar(NUMERO, EMPRESA);
  assert.throws(
    () => descifrar(sobre, '900999999'),
    /no se puede descifrar/,
    'el ámbito por empresa tiene que separar los sobres'
  );
});

// =========================================================================
// 4. La versión de llave que ya no está en el anillo
// =========================================================================

test('8B · una versión de llave que salió del anillo da un error explicito', () => {
  const K1 = Buffer.from('11'.repeat(32), 'hex');
  const K2 = Buffer.from('22'.repeat(32), 'hex');
  _setKeyRingForTests({ versionActual: 'k1', versiones: { k1: K1 } });
  _resetKeyCache();
  let sobre = null;
  try {
    sobre = cifrar(NUMERO, EMPRESA);
  } finally {
    // Se rota el anillo: k1 sale, entra k2.
    _setKeyRingForTests({ versionActual: 'k2', versiones: { k2: K2 } });
    _resetKeyCache();
  }

  assert.throws(
    () => descifrar(sobre, EMPRESA),
    /no esta en el anillo/,
    'el error tiene que decir qué falta: reponer la llave vieja en FIRMA_HMAC_KEYRING'
  );

  // Se deja el anillo como estaba.
  _setKeyRingForTests(null);
  _resetKeyCache();
});

// =========================================================================
// 5. El servicio de representante
// =========================================================================

test('8B · cifrarSnapshot cifra el número, guarda los últimos 4 y NO muta el original', () => {
  const original = { ...SNAPSHOT };
  const cifrado = representanteService.cifrarSnapshot(original, EMPRESA);

  assert.equal(esCifrado(cifrado.numero_identificacion), true);
  assert.equal(cifrado.numero_identificacion_ultimos4, ULTIMOS);
  assert.equal(original.numero_identificacion, NUMERO, 'el objeto original no se toca');
  assert.equal(cifrado.nombre, SNAPSHOT.nombre, 'el resto del snapshot no cambia');
  assert.equal(cifrado.correo, SNAPSHOT.correo);
});

test('8B · numeroEnClaro descifra uno nuevo y devuelve el texto de uno heredado', () => {
  const nuevo = representanteService.cifrarSnapshot({ ...SNAPSHOT }, EMPRESA);
  assert.equal(representanteService.numeroEnClaro(nuevo, EMPRESA), NUMERO);

  // Fila heredada: el número estaba en claro.
  const heredado = { ...SNAPSHOT };
  assert.equal(representanteService.numeroEnClaro(heredado, EMPRESA), NUMERO);
});

test('8B · numeroEnmascarado devuelve solo los últimos 4', () => {
  const nuevo = representanteService.cifrarSnapshot({ ...SNAPSHOT }, EMPRESA);
  assert.equal(representanteService.numeroEnmascarado(nuevo, EMPRESA), '****' + ULTIMOS);
  // Y en una fila heredada también: el enmascarado no depende del cifrado.
  assert.equal(
    representanteService.numeroEnmascarado({ ...SNAPSHOT }, EMPRESA),
    '****' + ULTIMOS
  );
  assert.equal(representanteService.numeroEnmascarado(null, EMPRESA), null);
});

test('8B · leerSnapshot no se cae con un JSON corrupto', () => {
  assert.equal(representanteService.leerSnapshot('{esto no es json'), null);
  assert.equal(representanteService.leerSnapshot(null), null);
  assert.equal(representanteService.leerSnapshot('[]'), null);
  assert.equal(representanteService.leerSnapshot(JSON.stringify(SNAPSHOT)).nombre, SNAPSHOT.nombre);
});

test('8B · cifrarSnapshot NO cifra dos veces un snapshot ya cifrado', () => {
  const una = representanteService.cifrarSnapshot({ ...SNAPSHOT }, EMPRESA);
  const dos = representanteService.cifrarSnapshot(una, EMPRESA);
  assert.equal(dos.numero_identificacion, una.numero_identificacion,
    'un sobre no se puede volver a cifrar: se rompería la fila');
  assert.equal(representanteService.numeroEnClaro(dos, EMPRESA), NUMERO);
});

// =========================================================================
// 6. LA FILA NO GUARDA EL NÚMERO EN CLARO
// =========================================================================

test('8B · la fila del padre NO guarda el número del representante en claro', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  assert.equal(
    filaGuardaNumeroEnClaro(signRequest.id_solicitud, NUMERO),
    false,
    'el número del representante no puede quedar en claro en la base (H23)'
  );
  const snap = snapshotDe(signRequest.id_solicitud);
  assert.equal(esCifrado(snap.numero_identificacion), true);
  assert.equal(snap.numero_identificacion_ultimos4, ULTIMOS);
  // Lo demás del snapshot sigue legible: es lo que se muestra y lo que se usa.
  assert.equal(snap.nombre, SNAPSHOT.nombre);
  assert.equal(snap.correo, SNAPSHOT.correo);
  assert.equal(snap.tipo_identificacion, SNAPSHOT.tipo_identificacion);
});

test('8B · la fila del HIJO (firma de la empresa) tampoco lo guarda en claro', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  const hijo = signRequestService.createForCompany({
    parent_id_solicitud: signRequest.id_solicitud,
    id_empresa: EMPRESA,
    id_documento: signRequest.id_documento,
    // Lo que llega desde el commit del trabajador es el snapshot YA CIFRADO
    // del padre. Es el camino que hay que sostener.
    representante: snapshotDe(signRequest.id_solicitud),
  });

  assert.equal(
    filaGuardaNumeroEnClaro(hijo.id_solicitud, NUMERO),
    false,
    'el número del representante no puede quedar en claro en la fila del hijo'
  );
  assert.equal(esCifrado(snapshotDe(hijo.id_solicitud).numero_identificacion), true);
});

// =========================================================================
// 7. REGRESIÓN: la huella y el seudónimo siguen siendo del número REAL
// =========================================================================

test('8B · la huella de identificación del hijo es la del NÚMERO REAL, no la del sobre', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  const hijo = signRequestService.createForCompany({
    parent_id_solicitud: signRequest.id_solicitud,
    id_empresa: EMPRESA,
    id_documento: signRequest.id_documento,
    representante: snapshotDe(signRequest.id_solicitud),
  });

  const fila = db.prepare(
    'SELECT identificacion_numero_hash FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(hijo.id_solicitud);

  const esperado = huellaDesdeHashPrevio(sha256(NUMERO), EMPRESA);
  assert.equal(fila.identificacion_numero_hash, esperado,
    'si la huella se calculara sobre el sobre, el representante no podría identificarse');
});

test('8B · el seudónimo del consentimiento del rep es el del NÚMERO REAL', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  // Lo que hace publicFlow al aceptar el rep: pasa el snapshot tal como
  // está en la base (cifrado).
  const snapCifrado = snapshotDe(signRequest.id_solicitud);
  const { consent } = consentService.ensureRepConsent({
    id_trabajador: signRequest.id_trabajador,
    id_empresa: EMPRESA,
    version_acuerdo: signRequest.agreement_version,
    hash_texto_acuerdo: signRequest.agreement_hash,
    rep: {
      nombre: snapCifrado.nombre,
      cargo: snapCifrado.cargo,
      numero_identificacion: snapCifrado.numero_identificacion,
      correo: snapCifrado.correo,
    },
    ip: '127.0.0.1',
    user_agent: 'test',
    kair_version: '0.1.189-test',
  });

  const fila = db.prepare(
    'SELECT identificacion_aceptante FROM gh_consentimientos_firma WHERE id = ?'
  ).get(consent.id);

  assert.equal(
    fila.identificacion_aceptante,
    pseudonimo(NUMERO, EMPRESA),
    'el seudónimo tiene que ser el del número real: si fuera el del sobre, '
    + 'la fila guardaría la huella de un valor que no es el número de nadie'
  );
  assert.notEqual(fila.identificacion_aceptante, NUMERO);
});

// =========================================================================
// 8. La constancia
// =========================================================================

test('8B · la constancia consolidada muestra los últimos 4 y NUNCA el número completo', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  const res = await request(makeApp())
    .get('/internal/expedientes/' + TRABAJADOR + '/constancia-consolidada.pdf')
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 200);
  assert.ok(pdfCallData, 'la constancia consolidada debe generarse');
  // El bloque de firmante va por documento (cada firma archivó su propio
  // snapshot), no en la cabecera de la constancia.
  const firmante = pdfCallData.documentos[0].firmante_empresa;
  assert.ok(firmante, 'debe haber un bloque de firmante empresa');
  assert.equal(firmante.identificacion_enmascarada, '****' + ULTIMOS);
  assert.equal(firmante.numero_identificacion, null,
    'el número en claro no puede viajar en los datos de la constancia');
  assert.equal(
    JSON.stringify(pdfCallData).includes(NUMERO),
    false,
    'el número completo del representante no puede aparecer en la constancia'
  );
});

test('8B · una fila HEREDADA (número en claro) se enmascara igual y no rompe', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  // Se simula una fila creada antes del cifrado: el número en claro.
  db.prepare(
    'UPDATE gh_firmas_electronicas SET representante_legal_snapshot = ? WHERE id_solicitud = ?'
  ).run(JSON.stringify(SNAPSHOT), signRequest.id_solicitud);

  const res = await request(makeApp())
    .get('/internal/expedientes/' + TRABAJADOR + '/constancia-consolidada.pdf')
    .set('X-Internal-API-Key', require('./helpers').TEST_API_KEY);

  assert.equal(res.status, 200, 'una fila heredada no puede romper la constancia');
  assert.ok(pdfCallData);
  assert.equal(
    pdfCallData.documentos[0].firmante_empresa.identificacion_enmascarada,
    '****' + ULTIMOS
  );
  assert.equal(
    JSON.stringify(pdfCallData).includes(NUMERO),
    false,
    'ni siquiera en las filas heredadas sale el número completo en la constancia'
  );
});

// =========================================================================
// 9. El contexto público no lo expone
// =========================================================================

test('8B · el contexto público NO expone el número del representante', async () => {
  resetDb();
  seedActiveAgreement();
  const { token } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  const res = await request(makeApp()).get('/s/' + token);

  assert.equal(res.status, 200);
  assert.equal(
    JSON.stringify(res.body).includes(NUMERO),
    false,
    'el número del representante no puede viajar al contexto público'
  );
});

// =========================================================================
// 10. MUTACION: los detectores muerden
// =========================================================================

test('8B · MUTACION: el detector de "número en claro" muerde', async () => {
  resetDb();
  seedActiveAgreement();
  const { signRequest } = await createSignRequestWithIdentificacion({
    id_trabajador: TRABAJADOR,
    id_empresa: EMPRESA,
    requiere_firma_empresa: 1,
    representante_legal_snapshot: { ...SNAPSHOT },
  });

  // Con el cifrado puesto: el detector da false.
  assert.equal(
    filaGuardaNumeroEnClaro(signRequest.id_solicitud, NUMERO),
    false,
    'una fila bien cifrada no debe contener el número'
  );

  // Sin el cifrado (la fila heredada): el detector da true. Si este test
  // pasara con false, el detector no serviría para nada.
  db.prepare(
    'UPDATE gh_firmas_electronicas SET representante_legal_snapshot = ? WHERE id_solicitud = ?'
  ).run(JSON.stringify(SNAPSHOT), signRequest.id_solicitud);

  assert.equal(
    filaGuardaNumeroEnClaro(signRequest.id_solicitud, NUMERO),
    true,
    'el detector tiene que ENCONTRAR el número cuando la fila lo guarda en claro'
  );
});

test('8B · MUTACION: sin cifrar, el sobre no sería un sobre', () => {
  // La aserción central de esta fase es "la fila no guarda el número en
  // claro". Si alguien dejara de cifrar y guardara el número tal cual, el
  // sobre dejaría de tener el formato y el descifrado dejaría de funcionar:
  // las dos señales tienen que caerse juntas.
  const sinCifrar = String(NUMERO);
  assert.equal(esCifrado(sinCifrar), false);
  assert.throws(
    () => descifrar(sinCifrar, EMPRESA),
    /no es un sobre cifrado/,
    'un número en claro no se puede tomar por un sobre: eso es lo que distingue '
    + 'una fila nueva de una heredada'
  );
});

// ===========================================================================
// D-18: "NO HAY DATO" Y "FALLÓ EL DESCIFRADO" NO SON LO MISMO
// ===========================================================================

test('8B · D-18 · estadoEnmascarado distingue sin dato de fallo', () => {
  // 1. No hay documento: no es un problema.
  const sinDato = representanteService.estadoEnmascarado(
    { nombre: 'Javier Robles' }, EMPRESA
  );
  assert.equal(sinDato.estado, 'sin_dato');
  assert.equal(sinDato.valor, null);
  assert.equal(sinDato.error, null);

  // 2. Documento en claro (fila heredada): se enmascara.
  const enClaro = representanteService.estadoEnmascarado(
    { ...SNAPSHOT }, EMPRESA
  );
  assert.equal(enClaro.estado, 'dato');
  assert.equal(enClaro.valor, '****' + ULTIMOS);

  // 3. Documento cifrado: se enmascara.
  const cifrado = representanteService.cifrarSnapshot({ ...SNAPSHOT }, EMPRESA);
  const delSobre = representanteService.estadoEnmascarado(cifrado, EMPRESA);
  assert.equal(delSobre.estado, 'dato');
  assert.equal(delSobre.valor, '****' + ULTIMOS);
});

test('8B · D-18 · un sobre que no se abre es un ERROR, no una ausencia', () => {
  // El sobre de otra empresa: no se abre con este ámbito.
  const deOtra = representanteService.cifrarSnapshot(
    { ...SNAPSHOT }, '900999999'
  );
  // Se quitan los últimos 4 guardados para obligar a descifrar.
  const sinRastro = Object.assign({}, deOtra);
  delete sinRastro.numero_identificacion_ultimos4;

  const est = representanteService.estadoEnmascarado(sinRastro, EMPRESA);
  assert.equal(est.estado, 'error',
    'un sobre que no abre es un incidente de llave, no "la empresa no declaró nada"');
  assert.equal(est.valor, null);
  assert.ok(est.error, 'el motivo queda dicho');
});

test('8B · D-18 · numeroEnmascarado deja de ser un null silencioso', async () => {
  const deOtra = representanteService.cifrarSnapshot(
    { ...SNAPSHOT }, '900999999'
  );
  const sinRastro = Object.assign({}, deOtra);
  delete sinRastro.numero_identificacion_ultimos4;

  const { objetos, stderr } = await capturarLogs(async () => {
    assert.equal(representanteService.numeroEnmascarado(sinRastro, EMPRESA), null);
  });

  const delError = objetos.find(
    (o) => o.codigo === 'REPRESENTANTE_NO_DESCIFRABLE'
  );
  assert.ok(delError, 'el fallo tiene que quedar en el log');
  assert.equal(delError.level, 'error', 'un fallo de descifrado no es un warning');
  assert.ok(stderr.includes('REPRESENTANTE_NO_DESCIFRABLE'));
});
