/**
 * Los anexos que rigen cada firma: identificador y huella SHA-256.
 *
 * Cubre el numeral 1.5 del Acuerdo de uso:
 *
 *   "La version incorporada del Anexo de Encargo y la del Anexo de Nube son
 *    las que constan, con su identificador y huella SHA-256, en el Anexo de
 *    Encargo y en la Constancia de cada firma."
 *
 * Antes de este trabajo no habia NADA de eso: la Constancia no mencionaba
 * ningun anexo y el Anexo de Encargo solo se guardaba como fecha de firma,
 * sin huella.
 *
 * Lo que se verifica acá:
 * - El manifiesto legal se lee y devuelve version + huella de cada anexo.
 * - El Anexo de Nube distingue el MODELO (sin firmar) de la version firmada.
 * - La Constancia lleva la seccion de anexos con version, huella y estado.
 * - Si el anexo NO esta firmado, la Constancia lo dice de forma expresa.
 * - El dato queda CONSULTABLE POR FIRMA (columnas de la fila), no solo impreso.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pdfGen = require('../src/services/pdfGen');
const manifiestoLegal = require('../src/services/manifiestoLegal');
const db = require('../src/db/connection');
const { resetDb, pdfText, createSignRequestWithIdentificacion } = require('./helpers');

// Manifiesto de prueba: valores FIJOS, para que el test no dependa de lo que
// el operador tenga escrito en legal-readiness.json (un test contra un archivo
// que el usuario edita no puede llevar cifras fijas).
const MANIFIESTO_PRUEBA = {
  anexo_encargo: {
    estado: 'no_firmado',
    fecha: null,
    evidencia: null,
    version: '2026-10-27-b',
    hash: '6831f53a' + 'a'.repeat(56),
  },
  anexo_nube: {
    firmado: false,
    fecha: null,
    version: null,
    hash: null,
    evidencia: null,
    modelo: {
      version: '1.0',
      hash: 'b8de5785' + 'b'.repeat(56),
      actualizado: '2026-10-27',
      nota: 'Modelo sin firmar: todavia no hay version firmada.',
    },
  },
};

const ID_EMPRESA = '900999111';

/**
 * Da de alta una Empresa, con o sin el Anexo de Encargo firmado.
 *
 * @param {string|null} firmadoAt fecha ISO de la firma, o null
 * @returns {string} el id_empresa
 */
function sembrarEmpresa(firmadoAt) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, anexo_encargo_firmado_at, activo)
    VALUES (?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, 'EMPRESA DE PRUEBA SAS', '900999111', firmadoAt || null);
  return ID_EMPRESA;
}

/**
 * La Constancia con el bloque de anexos.
 *
 * @param {object} [extra] campos extra del metadata
 * @returns {Promise<string>} el texto del PDF
 */
async function constanciaConAnexos(extra) {
  const anexos = manifiestoLegal.datosAnexos({
    id_empresa: ID_EMPRESA,
    manifiesto: MANIFIESTO_PRUEBA,
  });
  const buf = await pdfGen.generateConstanciaPdf(Object.assign({
    id_solicitud: 'SIGN-2026-000001',
    id_empresa: ID_EMPRESA,
    nombre_empresa: 'EMPRESA DE PRUEBA SAS',
    nombre_trabajador: 'JUAN DE EJEMPLO',
    fecha_firma: new Date().toISOString(),
    anexos,
  }, extra || {}));
  return pdfText(buf);
}

/**
 * El texto del PDF en una sola línea.
 *
 * El PDF envuelve los párrafos: una frase queda partida entre dos líneas y
 * buscarla tal cual en el texto crudo no encuentra nada. Para comparar
 * frases, se aplana el texto.
 */
function plano(texto) {
  return texto.replace(/\s+/g, ' ');
}

// =========================================================================
// EL MANIFIESTO
// =========================================================================

test('datosAnexos: el manifiesto real se lee y trae version y huella del Anexo de Encargo', () => {
  const d = manifiestoLegal.datosAnexos({});
  assert.equal(d.disponible, true,
    'el manifiesto legal tiene que estar disponible: sin el no hay anexos que identificar');
  assert.ok(d.anexo_encargo.version && d.anexo_encargo.version.length > 0,
    'el Anexo de Encargo tiene que tener version');
  assert.match(d.anexo_encargo.hash, /^[0-9a-f]{64}$/i,
    'la huella del Anexo de Encargo tiene que ser un SHA-256 de 64 hexadecimales');
});

test('datosAnexos: sin version firmada no hay version firmada (invariante, no cifra fija)', () => {
  const d = manifiestoLegal.datosAnexos({});
  if (d.anexo_nube.firmado === false) {
    assert.equal(d.anexo_nube.version, null,
      'si el Anexo de Nube no esta firmado, no puede anunciar una version firmada');
    assert.equal(d.anexo_nube.hash, null,
      'si el Anexo de Nube no esta firmado, no puede anunciar una huella firmada');
  }
});

test('datosAnexos: el Anexo de Nube distingue el MODELO de la version firmada', () => {
  const d = manifiestoLegal.datosAnexos({ manifiesto: MANIFIESTO_PRUEBA });
  const nube = d.anexo_nube;
  assert.equal(nube.firmado, false);
  assert.equal(nube.version, null, 'la version FIRMADA no existe todavia');
  assert.equal(nube.hash, null, 'la huella FIRMADA no existe todavia');
  assert.ok(nube.modelo, 'el modelo si tiene que estar');
  assert.equal(nube.modelo.version, '1.0');
  assert.match(nube.modelo.hash, /^[0-9a-f]{64}$/i);
  // Lo que realmente rige (y lo que se archiva) es el modelo.
  assert.equal(nube.version_incorporada, '1.0');
  assert.equal(nube.hash_incorporada, nube.modelo.hash);
  assert.equal(nube.origen_incorporada, 'modelo');
});

test('datosAnexos: el Anexo de Encargo no firmado dice NO firmado, sin fecha inventada', () => {
  resetDb();
  sembrarEmpresa(null);
  const d = manifiestoLegal.datosAnexos({ id_empresa: ID_EMPRESA, manifiesto: MANIFIESTO_PRUEBA });
  assert.equal(d.anexo_encargo.firmado, false);
  assert.equal(d.anexo_encargo.estado, 'no_firmado');
  assert.equal(d.anexo_encargo.fecha_firma, null,
    'sin firma no hay fecha: inventarla seria mentir');
  // El texto incorporado si se puede publicar: es lo que exige el 1.5.
  assert.equal(d.anexo_encargo.version, '2026-10-27-b');
  assert.match(d.anexo_encargo.hash, /^[0-9a-f]{64}$/i);
});

test('datosAnexos: si la Empresa firmo el Anexo de Encargo, consta la fecha', () => {
  resetDb();
  const fecha = '2026-10-01T10:00:00.000Z';
  sembrarEmpresa(fecha);
  const d = manifiestoLegal.datosAnexos({ id_empresa: ID_EMPRESA, manifiesto: MANIFIESTO_PRUEBA });
  assert.equal(d.anexo_encargo.firmado, true);
  assert.equal(d.anexo_encargo.estado, 'firmado');
  assert.equal(d.anexo_encargo.fecha_firma, fecha);
});

// =========================================================================
// LA CONSTANCIA
// =========================================================================

test('la Constancia lleva la seccion de anexos con version y huella', async () => {
  resetDb();
  const texto = await constanciaConAnexos();
  assert.ok(texto.includes('Anexos que rigen esta firma'),
    'la Constancia tiene que traer la seccion de anexos');
  assert.ok(texto.includes('2026-10-27-b'),
    'la version del Anexo de Encargo tiene que constar');
  assert.ok(texto.includes('6831f53a' + 'a'.repeat(56)),
    'la huella COMPLETA del Anexo de Encargo tiene que constar');
  assert.ok(texto.includes('Anexo de Nube (modelo)'),
    'el Anexo de Nube tiene que traer el modelo');
  assert.ok(texto.includes('b8de5785' + 'b'.repeat(56)),
    'la huella del modelo del Anexo de Nube tiene que constar');
});

test('la Constancia dice EXPRESAMENTE cuando el anexo no esta firmado', async () => {
  resetDb();
  sembrarEmpresa(null);
  const texto = await constanciaConAnexos();
  assert.ok(texto.includes('No firmado a la fecha de esta firma'),
    'un anexo sin firmar tiene que quedar dicho de forma expresa en la Constancia');
});

test('la Constancia dice cuando firmó la Empresa el Anexo de Encargo', async () => {
  resetDb();
  // Mediodía UTC: la fecha local es 01/10/2026 en cualquier huso razonable.
  sembrarEmpresa('2026-10-01T12:00:00.000Z');
  const texto = plano(await constanciaConAnexos());
  assert.ok(texto.includes('Firmado por la Empresa'),
    'la Constancia tiene que decir que la Empresa firmó el Anexo de Encargo');
  assert.ok(texto.includes('01/10/2026'),
    'la Constancia tiene que decir CUANDO lo firmó');
  assert.equal(texto.includes('No firmado a la fecha de esta firma'), true,
    'el Anexo de Nube sigue sin firmar: eso también se dice');
});

test('la Constancia dice que la huella es del TEXTO, no de una copia firmada', async () => {
  resetDb();
  const texto = await constanciaConAnexos();
  assert.match(plano(texto), /no es la huella de una copia firmada/,
    'la Constancia tiene que aclarar que la huella es del texto incorporado');
});

test('la Constancia, sin manifiesto, NO inventa version ni huella', async () => {
  resetDb();
  const buf = await pdfGen.generateConstanciaPdf({
    id_solicitud: 'SIGN-2026-000001',
    id_empresa: ID_EMPRESA,
    anexos: {
      disponible: false,
      error: 'manifiesto no disponible',
      anexo_encargo: null,
      anexo_nube: null,
    },
  });
  const texto = plano(pdfText(buf));
  assert.ok(texto.includes('Anexos que rigen esta firma'),
    'la seccion sigue estando: el lector tiene que ver que falta el dato');
  assert.ok(texto.includes('NO puede identificar los anexos'),
    'sin manifiesto, la Constancia tiene que decirlo');
  assert.equal(texto.includes('2026-10-27-b'), false,
    'sin manifiesto no se puede inventar la version de ningun anexo');
});

test('la Constancia lee el manifiesto sola si el llamador no le pasa los anexos', async () => {
  resetDb();
  sembrarEmpresa(null);
  // Sin `metadata.anexos`: la Constancia tiene que leer el manifiesto legal.
  const buf = await pdfGen.generateConstanciaPdf({
    id_solicitud: 'SIGN-2026-000001',
    id_empresa: ID_EMPRESA,
  });
  const texto = pdfText(buf);
  assert.ok(texto.includes('Anexos que rigen esta firma'),
    'el bloque tiene que estar aunque el llamador no cablee la lectura');
});

// =========================================================================
// EL DATO CONSULTABLE POR FIRMA
// =========================================================================

test('registrarAnexosFirma deja los anexos consultables en la fila de la firma', async () => {
  resetDb();
  const sr = await createSignRequestWithIdentificacion({
    id_empresa: ID_EMPRESA,
    id_documento: 'doc-anexos',
  });

  const anexos = manifiestoLegal.datosAnexos({
    id_empresa: ID_EMPRESA,
    manifiesto: MANIFIESTO_PRUEBA,
  });
  const escrito = manifiestoLegal.registrarAnexosFirma(sr.signRequest.id, anexos);
  assert.ok(escrito, 'la escritura tiene que devolver lo que escribio');

  const fila = manifiestoLegal.anexosDeFirma(sr.signRequest.id);
  assert.equal(fila.anexo_encargo_version, '2026-10-27-b');
  assert.equal(fila.anexo_encargo_hash, MANIFIESTO_PRUEBA.anexo_encargo.hash);
  // Del Anexo de Nube solo hay modelo: lo que rige es el modelo.
  assert.equal(fila.anexo_nube_version, '1.0');
  assert.equal(fila.anexo_nube_hash, MANIFIESTO_PRUEBA.anexo_nube.modelo.hash);
});

test('sin manifiesto, registrarAnexosFirma no inventa y no tumba la firma', async () => {
  resetDb();
  const sr = await createSignRequestWithIdentificacion({
    id_empresa: ID_EMPRESA,
    id_documento: 'doc-sin-manifiesto',
  });
  const anexos = manifiestoLegal.datosAnexos({
    id_empresa: ID_EMPRESA,
    manifiesto: {},
    rutaManifiesto: 'no-existe.json',
  });
  // El manifiesto inyectado como objeto vacio no tiene anexos: no hay nada
  // que escribir, y la firma sigue en pie.
  const escrito = manifiestoLegal.registrarAnexosFirma(sr.signRequest.id, anexos);
  assert.equal(escrito.anexo_encargo_version, null);
  assert.equal(escrito.anexo_nube_version, null);
  const fila = db.prepare('SELECT id FROM gh_firmas_electronicas WHERE id = ?')
    .get(sr.signRequest.id);
  assert.ok(fila, 'la firma no puede caerse por esto');
});
