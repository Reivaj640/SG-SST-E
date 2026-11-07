/**
 * EL ACTA DE SUSCRIPCIÓN DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * El acta es el documento que deja constancia de que la Empresa se suscribió
 * al Anexo de Encargo. Este test comprueba:
 *
 * - Que es un PDF y que SU HUELLA ES LA DE SUS BYTES (que es lo que se
 *   registra y lo que se puede verificar después).
 * - Que lleva lo que tiene que llevar: la versión y la huella del texto
 *   canónico, la fecha, el firmante, la IP, el navegador y los CINCO datos
 *   del §11 tal como los declaró la Empresa.
 * - QUE NO DICE QUE EL CONTRATO ESTÁ FIRMADO: es la fase 1 de un
 *   instrumento bilateral y el acta lo dice.
 * - Que NO lleva el código de verificación en claro (es un secreto con
 *   caducidad) ni el correo del firmante entero.
 * - Que el nombre del archivo sale del id de la suscripción y que no se
 *   puede escribir fuera de la carpeta de las actas.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const actaEncargo = require('../../src/services/actaEncargo');
const storage = require('../../src/services/storage');

const HASH_TEXTO = '5cc7a34603ea2e300e6c82ed695454eb705363345a3165ae2e75b5733960aa72';

const DATOS = {
  id_suscripcion: 123,
  id_empresa: '900555777',
  empresa: 'EMPRESA DE PRUEBA SAS',
  version: '2026-11-06',
  hash_texto: HASH_TEXTO,
  firmado_at: '2026-11-06T20:15:30.000Z',
  nombre_firmante: 'PERSONA DE PRUEBA',
  cargo_firmante: 'Representante legal',
  correo_firmante: 'representante@empresa-prueba.test',
  codigo_enviado_at: '2026-11-06T20:14:00.000Z',
  codigo_verificado_at: '2026-11-06T20:15:30.000Z',
  enlace_abierto_at: '2026-11-06T20:10:00.000Z',
  ip: '203.0.113.9',
  user_agent: 'Navegador/1.0',
  datos_empresa: {
    razon_social: 'EMPRESA DE PRUEBA SAS',
    nit: '900555777-1',
    domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
    // El correo DECLARADO en el §11 (el canal de avisos de protección de
    // datos). Es distinto del buzón del firmante a propósito: el §11 es un
    // dato de la Empresa y va completo; el buzón del firmante es el canal
    // por el que salió el código, y va enmascarado.
    correo: 'datos@empresa-prueba.test',
    representante: 'PERSONA DE PRUEBA',
  },
  // ─── Los ajustes del abogado (7-nov-2026) ─────────────────────────────────
  // El segundo canal del código: distinto del buzón del enlace. El acta lo
  // enmascara, como todo buzón que sale en un documento.
  canal_codigo: 'segundo-canal@empresa-prueba.test',
  // Quién firmó y con qué poder. El documento va con su final nada más.
  representante_nombre: 'PERSONA DE PRUEBA',
  representante_documento: '****3456',
  representante_calidad: 'REPRESENTANTE_LEGAL',
  // Los TRES textos que la Empresa aceptó, con sus huellas. Van enteros: el
  // acta es la constancia de lo que se aceptó.
  texto_mecanismo: 'Las partes acuerdan que este Anexo se suscribe mediante el mecanismo '
    + 'electronico descrito en el Acuerdo sobre el uso del mecanismo de firma electronica '
    + 'K+AIR, que la Empresa declara conocer y aceptar.',
  texto_declaracion: 'Declaro que soy el representante legal de la Empresa y que tengo '
    + 'facultades para suscribir este Anexo.',
  texto_tratamiento: 'K+AIR trata los datos personales de la Empresa para cumplir el '
    + 'encargo de tratamiento de datos pactado en este Anexo. El plazo de conservacion es '
    + 'de diez anos para el documento original y firmado, y de cinco anos para el registro '
    + 'de operaciones y autenticacion.',
  aceptacion_hash: 'a1b2c3d4'.repeat(8),
  aceptacion_tratamiento_hash: 'e5f6a7b8'.repeat(8),
};

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * El texto que se puede LEER en el PDF.
 *
 * Los flujos de contenido van comprimidos (FlateDecode) y el texto va en
 * hexadecimal (pdf-lib lo escribe así). Por eso hay que inflar y decodificar:
 * si el test leyera el PDF crudo, encontraría el texto partido y no
 * probaría nada.
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function textoDelPdf(buffer) {
  const crudo = buffer.toString('latin1');
  const flujos = [];
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(crudo)) !== null) {
    const inicio = m.index + m[0].length;
    const fin = crudo.indexOf('endstream', inicio);
    if (fin < 0) continue;
    try {
      flujos.push(zlib.inflateSync(buffer.slice(inicio, fin)).toString('latin1'));
    } catch (e) { /* no es un flujo comprimido */ }
  }
  const contenido = flujos.join('\n');
  const textos = [];
  const reTexto = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let t;
  while ((t = reTexto.exec(contenido)) !== null) {
    textos.push(Buffer.from(t[1], 'hex').toString('latin1'));
  }
  return textos.join('\n');
}

/**
 * El texto del PDF en una sola línea.
 *
 * El acta ajusta las frases al ancho de la página, así que una frase puede
 * quedar partida entre dos renglones. Para comprobar una FRASE hay que
 * mirar el texto corrido: si no, el test fallaría por la maquetación y no
 * por lo que quiere comprobar.
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
function textoPlano(buffer) {
  return textoDelPdf(buffer).replace(/\s+/g, ' ');
}

// ===========================================================================
// EL ACTA Y SU HUELLA
// ===========================================================================

test('el acta es un PDF y su huella es la de sus bytes', async () => {
  const acta = await actaEncargo.generarActa(DATOS);

  assert.ok(Buffer.isBuffer(acta.buffer));
  assert.equal(acta.buffer.slice(0, 5).toString('latin1'), '%PDF-',
    'el acta tiene que ser un PDF de verdad');

  const hash = crypto.createHash('sha256').update(acta.buffer).digest('hex');
  assert.equal(acta.hash, hash,
    'la huella del acta tiene que ser la de SUS bytes: es lo que se registra');
  assert.equal(acta.bytes, acta.buffer.length);
});

test('el acta lleva la versión y la huella del texto canónico', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes(DATOS.version),
    'el acta tiene que decir la versión del texto que se firmó');
  // La huella va partida en dos renglones (en uno no cabe): se comprueban
  // las dos mitades.
  assert.ok(texto.includes(HASH_TEXTO.slice(0, 32)));
  assert.ok(texto.includes(HASH_TEXTO.slice(32)));
});

test('el acta lleva los cinco datos del §11 tal como los declaró la Empresa', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('900555777-1'), 'el NIT declarado');
  assert.ok(texto.includes('Calle 47 # 43-57'), 'el domicilio declarado');
  assert.ok(texto.includes('PERSONA DE PRUEBA'), 'el representante declarado');
  assert.ok(texto.includes('EMPRESA DE PRUEBA SAS'), 'la razón social declarada');
  assert.ok(texto.includes('@empresa-prueba.test'),
    'el correo declarado del §11 va completo: son los datos de la Empresa');
});

test('el acta lleva la fecha, el firmante, la IP y el navegador', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('2026-11-06T20:15:30.000Z'), 'la fecha y hora exactas');
  assert.ok(texto.includes('203.0.113.9'), 'la direccion IP');
  assert.ok(texto.includes('Navegador/1.0'), 'el navegador');
  assert.ok(texto.includes('Representante legal'), 'el cargo del firmante');
});

// ===========================================================================
// LO QUE EL ACTA NO PUEDE DECIR
// ===========================================================================

test('el acta dice que es la fase 1 y que el instrumento NO está ejecutado', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('FASE 1 DE 2'),
    'el acta tiene que decir que es la primera de las dos fases');
  assert.ok(texto.includes('NO ESTÁ EJECUTADO'),
    'el acta tiene que decir que el contrato no está ejecutado');
  assert.ok(texto.includes('NO lo declara firmado'),
    'el acta no puede declarar el contrato firmado: falta la contrafirma');

  // Y tampoco puede haber una frase que diga lo contrario.
  assert.ok(!/CONTRATO FIRMADO/.test(texto));
  assert.ok(!/ACTA DE FIRMA/.test(texto));
});

test('el acta NO lleva el código de verificación en claro', async () => {
  // Se le pasa un código que el servicio nunca le daría, para comprobar que
  // el generador no lo imprime aunque se lo manden.
  const acta = await actaEncargo.generarActa(Object.assign({}, DATOS, {
    otp: '654321',
    codigo: '654321',
  }));
  const texto = textoPlano(acta.buffer);

  assert.ok(!texto.includes('654321'),
    'los seis dígitos del código no pueden aparecer en un documento');
  assert.ok(texto.includes('Verificado'),
    'lo que queda es que el código SE VERIFICÓ, y cuándo');
});

test('el acta enmascara el correo del firmante', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('re***@empresa-prueba.test'),
    'el correo del firmante va enmascarado, como en la pantalla');
  assert.ok(!texto.includes('representante@empresa-prueba.test'),
    'el correo completo es el canal del código: no se imprime');
});

test('el acta no puede llevar su propia huella', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(!texto.includes(acta.hash),
    'la huella del acta se calcula sobre sus bytes: no puede estar dentro');
});

// ===========================================================================
// LOS AJUSTES DEL ABOGADO (7-nov-2026)
// ===========================================================================
//
// Lo que el abogado pidió que el acta dijera y que antes no decía. Ninguno de
// estos requisitos es cosmético: son las tres cosas que hacen que el acta
// sirva como prueba de lo que la Empresa aceptó.

test('el acta dice que es una constancia y no la copia firmada', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('ESTA ACTA ES UNA CONSTANCIA, NO LA COPIA FIRMADA'),
    'el aviso tiene que estar en el acta, no solo en la pantalla');
  assert.ok(texto.includes('No sustituye la copia firmada del Anexo'),
    'la frase tiene que ser la literal');
  assert.ok(texto.includes('cada parte conserva'),
    'tiene que decir que la copia firmada la conserva cada parte');
});

test('el acta dice quién firmó, con su documento y con su calidad', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('4. QUIEN FIRMÓ'), 'la sección de quién firmó');
  assert.ok(texto.includes('PERSONA DE PRUEBA'), 'el nombre del firmante');
  assert.ok(texto.includes('****3456'),
    'el documento va con su final nada más: el acta es un documento que la '
    + 'Empresa puede compartir con quien quiera');
  assert.ok(texto.includes('REPRESENTANTE_LEGAL'), 'la calidad con la que firmó');
  assert.ok(texto.includes('no contrafirma el Anexo sin esa verificacion')
    || texto.includes('no contrafirma el Anexo sin esa verificación'),
    'el acta tiene que decir que la contrafirma depende de la verificación');
});

test('el acta dice que el código NO salió por el buzón del enlace', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('Canal del código'), 'la fila del canal del código');
  assert.ok(texto.includes('se***@empresa-prueba.test'),
    'el segundo canal va enmascarado, como el buzón del enlace');
  assert.ok(!texto.includes('segundo-canal@empresa-prueba.test'),
    'la dirección entera del segundo canal no se imprime');
  assert.ok(texto.includes('Distinto del buzón del enlace'),
    'tiene que quedar dicho que el código no salió por el buzón del enlace');
});

test('el acta imprime los tres textos que la Empresa aceptó, con sus huellas', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('6. LO QUE LA EMPRESA ACEPTÓ'),
    'la sección de lo que aceptó');
  assert.ok(texto.includes('mecanismo electronico'),
    'la cláusula del mecanismo, con sus palabras');
  assert.ok(texto.includes('Declaro que soy el representante legal de la Empresa'),
    'la declaración de representación');
  assert.ok(texto.includes('para cumplir el encargo de tratamiento de datos'),
    'la frase informativa de tratamiento de datos');

  // Las huellas de lo aceptado: sin ellas el acta diría "aceptó" sin probar
  // QUÉ aceptó.
  assert.ok(texto.includes(DATOS.aceptacion_hash), 'la huella del texto aceptado');
  assert.ok(texto.includes(DATOS.aceptacion_tratamiento_hash),
    'la huella del texto de datos');
});

test('el acta dice que la fecha de la ficha es de SUSCRIPCIÓN y no de firma', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const texto = textoPlano(acta.buffer);

  assert.ok(texto.includes('dice SUSCRIPCIÓN, no firma')
    || texto.includes('dice SUSCRIPCION, no firma'),
    'la sección del registro tiene que distinguir la suscripción de la firma');
});

// ===========================================================================
// EL ARCHIVO
// ===========================================================================

test('el acta se guarda y se lee con los mismos bytes', async () => {
  const acta = await actaEncargo.generarActa(DATOS);
  const ruta = actaEncargo.guardarActa(acta.filename, acta.buffer);

  assert.ok(fs.existsSync(ruta));
  assert.equal(path.dirname(path.resolve(ruta)), path.resolve(storage.PATHS.actas),
    'el acta tiene que quedar en la carpeta de las actas');

  const leido = actaEncargo.leerActa(acta.filename);
  assert.equal(leido.found, true);
  assert.ok(leido.buffer.equals(acta.buffer),
    'el archivo tiene que ser byte a byte el que se generó');

  const hash = crypto.createHash('sha256').update(leido.buffer).digest('hex');
  assert.equal(hash, acta.hash);

  fs.unlinkSync(ruta);
});

test('el nombre del acta sale del id y no puede salir de la carpeta', () => {
  assert.equal(actaEncargo.nombreActa(123), 'acta-123-anexo-encargo.pdf');

  const ruta = actaEncargo.rutaActa('../../etc/passwd');
  assert.ok(path.resolve(ruta).startsWith(path.resolve(storage.PATHS.actas)),
    'una ruta con ../ no puede salirse de la carpeta de las actas');
});

test('enmascararCorreo deja el dominio y esconde el resto', () => {
  assert.equal(actaEncargo.enmascararCorreo('representante@empresa.com'), 're***@empresa.com');
  assert.equal(actaEncargo.enmascararCorreo('a@b.com'), 'a***@b.com');
  assert.equal(actaEncargo.enmascararCorreo(''), '***');
  assert.equal(actaEncargo.enmascararCorreo(null), '***');
});
