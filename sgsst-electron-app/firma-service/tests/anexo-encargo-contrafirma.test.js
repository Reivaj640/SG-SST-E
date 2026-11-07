/**
 * LA CONTRAFIRMA DEL ANEXO DE ENCARGO (FASE 2)
 * ============================================================================
 *
 * La fase 1 deja constancia de que la Empresa SUSCRIBIÓ. Esta fase es el
 * segundo acto: la contrafirma de K+AIR. Con los dos actos, el instrumento
 * queda EJECUTADO y la Empresa puede firmar documentos de sus trabajadores.
 *
 * Lo que se verifica acá:
 *
 * - Que NO se contrafirma lo que la Empresa no suscribió.
 * - Que NO se contrafirma sin la verificación documental de quien firmó por
 *   la Empresa: es lo que el abogado señaló como la grieta del método.
 * - Que el código de la contrafirma sale al buzón de K+AIR (fijo en la
 *   configuración) y NO a uno que elija quien lo pide.
 * - Que el código de la suscripción NO sirve para contrafirmar, ni al revés:
 *   son dos dominios de derivación distintos.
 * - Que la contrafirma exige el código, la aceptación expresa y el motivo.
 * - Que la contrafirma genera SU acta, que cita la de la suscripción, y que
 *   el acta de la suscripción NO se toca (la Empresa ya tiene su huella).
 * - Que el acta de contrafirma dice, sin adornos, que NO hay certificado de
 *   terceros ni sello de tiempo de terceros.
 * - Que la contrafirma escribe la fecha de EJECUCIÓN en la ficha de la
 *   Empresa y que esa fecha es la que la habilita.
 * - Que si la escritura falla, el acta se borra: no puede quedar un archivo
 *   sin registro ni un registro sin archivo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const db = require('../src/db/connection');
const anexoEncargo = require('../src/services/anexoEncargo');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const actaEncargo = require('../src/services/actaEncargo');
const storage = require('../src/services/storage');
const config = require('../src/config');
const {
  verifyOTPHmac, PROPOSITO_OTP_CONTRAFIRMA,
} = require('../src/crypto/otp');
const { resetDb } = require('./helpers');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const CANAL_CODIGO = 'segundo-canal@empresa-prueba.test';
const CONFIRMACION_CANAL = 'Confirmado por llamada de prueba';
const REPRESENTANTE = { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' };

const DATOS_S11 = {
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900555777-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: 'datos@empresa-prueba.test',
  representante: 'PERSONA DE PRUEBA',
};

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, DATOS_S11.razon_social, DATOS_S11.nit, DATOS_S11.domicilio,
    'pqrs@empresa-prueba.test', DATOS_S11.correo, DATOS_S11.representante);
}

/** El último correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo) return inbox[i];
  }
  return null;
}

/** El código de la suscripción (el del tipo 'anexo_encargo'). */
function codigoDeSuscripcion() {
  const c = ultimoCorreo('anexo_encargo');
  assert.ok(c, 'tiene que haber salido el correo con el código de la suscripción');
  return c.otp;
}

/** El código de la contrafirma (el del tipo 'anexo_encargo_contrafirma'). */
function codigoDeContrafirma() {
  const c = ultimoCorreo('anexo_encargo_contrafirma');
  assert.ok(c, 'tiene que haber salido el correo con el código de la contrafirma');
  return c.otp;
}

/** Abre una suscripción con el segundo canal. */
async function abrir() {
  return anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });
}

/** Abre, pide el código y suscribe. */
async function suscribir() {
  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});
  const res = await anexoEncargo.suscribir(abierto.token, {
    otp: codigoDeSuscripcion(),
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: REPRESENTANTE,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });
  return { abierto, res };
}

/** Suscribe y verifica al representante: lo mínimo para poder contrafirmar. */
async function suscribirYVerificar() {
  const { abierto, res } = await suscribir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;
  anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
    tipo_documento: 'CERTIFICADO_CAMARA',
    referencia: 'Radicado 2026-11-07-14',
  }, { actor: 'admin', motivo: 'Verificado contra el certificado de la cámara' });
  return { abierto, res, idSuscripcion };
}

/** Pide el código de la contrafirma. */
async function pedirCodigoContrafirma(idSuscripcion) {
  return anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {
    ip: '10.0.0.9', user_agent: 'Operador/1.0',
  });
}

/** El texto del PDF en una sola línea (para comprobar FRASES). */
function textoPlano(buffer) {
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
  return textos.join('\n').replace(/\s+/g, ' ');
}

// ===========================================================================
// 1. LO QUE NO SE PUEDE SALTAR
// ===========================================================================

test('no se contrafirma lo que la Empresa no suscribió', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  await assert.rejects(
    () => anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'SUSCRIPCION_NO_FIRMADA',
    'no se contrafirma una suscripción que la Empresa no firmó',
  );
});

test('no se contrafirma sin la verificación documental del representante', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await suscribir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  await assert.rejects(
    () => anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'REPRESENTANTE_NO_VERIFICADO',
    'K+AIR no contrafirma sin saber quién firmó por la Empresa',
  );
});

test('no se contrafirma sin motivo, sin aceptación o sin código', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();

  // Sin código pedido.
  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: '123456', acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_NO_SOLICITADO',
    'sin código no hay contrafirma',
  );

  await pedirCodigoContrafirma(idSuscripcion);

  // Sin motivo.
  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(), acepta: true,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
    'la contrafirma habilita a la Empresa: tiene que decir por qué',
  );

  // Sin aceptación expresa.
  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(),
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
    'la contrafirma es un acto: tiene que aceptarse',
  );

  // Con `acepta: false` tampoco.
  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(), acepta: false,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
    'marcar que no se acepta no es aceptar',
  );
});

// ===========================================================================
// 2. EL CÓDIGO DE LA CONTRAFIRMA
// ===========================================================================

test('el código de la contrafirma sale al buzón de K+AIR, no a uno que se elija', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  const r = await pedirCodigoContrafirma(idSuscripcion);

  const correo = ultimoCorreo('anexo_encargo_contrafirma');
  assert.ok(correo, 'tiene que salir el correo con el código de contrafirma');
  assert.equal(correo.to, config.canalProteccionDatos,
    'el canal es el de la configuración de K+AIR: quien pide la contrafirma no lo elige');
  assert.notEqual(correo.to, CORREO_FIRMANTE,
    'el código de la contrafirma no puede salir al buzón de la Empresa');
  assert.equal(r.canal, 'pr***@gmail.com',
    'la respuesta muestra el canal enmascarado');
});

test('el código de la suscripción NO sirve para contrafirmar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  const codigoSuscripcion = codigoDeSuscripcion();

  await pedirCodigoContrafirma(idSuscripcion);

  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: codigoSuscripcion, acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
    'los dos actos tienen códigos distintos: con el de la suscripción no se contrafirma',
  );
});

test('los dos códigos son dominios de derivación distintos', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  // Se pide el código de la suscripción y se guarda su huella ANTES de
  // suscribir: al suscribir, el código se consume y su huella se borra de la
  // base (un código de un solo uso).
  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});
  const hashSuscripcion = db.prepare(
    'SELECT otp_hash FROM gh_firma_anexo_encargo_suscripciones').get().otp_hash;
  const codigoSuscripcion = codigoDeSuscripcion();
  assert.ok(hashSuscripcion, 'la huella del código de la suscripción tiene que estar');

  await anexoEncargo.suscribir(abierto.token, {
    otp: codigoSuscripcion,
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: REPRESENTANTE,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;
  anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
    tipo_documento: 'CERTIFICADO_CAMARA',
    referencia: 'Radicado 2026-11-07-14',
  }, { actor: 'admin', motivo: 'Verificado contra el certificado de la cámara' });

  await pedirCodigoContrafirma(idSuscripcion);

  const hashContrafirma = db.prepare(
    'SELECT contrafirma_otp_hash FROM gh_firma_anexo_encargo_suscripciones')
    .get().contrafirma_otp_hash;
  assert.ok(hashContrafirma, 'la huella del código de la contrafirma tiene que estar');
  assert.notEqual(hashContrafirma, hashSuscripcion,
    'las dos huellas son distintas: son dos actos distintos');

  // El código de la contrafirma NO verifica contra la huella de la
  // suscripción: ni con el propósito de la contrafirma ni con el de la
  // suscripción.
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashSuscripcion, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    false,
    'el propósito de la contrafirma no puede ser el de la suscripción',
  );
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashSuscripcion, ID_EMPRESA),
    false,
  );
  // Y el de la suscripción tampoco verifica contra la de la contrafirma.
  assert.equal(
    verifyOTPHmac(codigoSuscripcion, hashContrafirma, ID_EMPRESA),
    false,
  );
  assert.equal(
    verifyOTPHmac(codigoSuscripcion, hashContrafirma, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    false,
  );
  // Con su propósito, cada uno sí valida contra su huella.
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashContrafirma, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    true,
    'el código de la contrafirma tiene que validar contra su propia huella',
  );
});

test('un código incorrecto se cuenta y no contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);

  await assert.rejects(
    () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
      otp: '000000', acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
  );

  const fila = db.prepare(
    'SELECT contrafirma_otp_intentos FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.contrafirma_otp_intentos, 1,
    'el intento fallido queda contado');
});

// ===========================================================================
// 3. LA CONTRAFIRMA
// ===========================================================================

test('la contrafirma ejecuta el instrumento y habilita a la Empresa', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();

  // ANTES: la Empresa NO puede firmar (aunque ya se haya suscrito).
  const antes = empresaService.verificarHabilitacionFirma(ID_EMPRESA);
  assert.equal(antes.ok, false,
    'una Empresa que solo se suscribió no puede firmar documentos de sus trabajadores');
  assert.ok(antes.pendientes.includes('anexo_encargo_firmado'));

  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'Verificado el certificado de la cámara', ip: '10.0.0.9', user_agent: 'Operador/1.0' });

  assert.equal(r.contrafirmado, true);
  assert.ok(r.contrafirmado_at);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_firmado_at,
    'la contrafirma escribe la fecha de ejecución del instrumento');
  assert.equal(empresa.anexo_encargo_firmado_at, r.contrafirmado_at);
  // Y la suscripción sigue con su fecha de suscripción: son DOS actos.
  assert.ok(empresa.anexo_encargo_suscrito_at);
  assert.notEqual(empresa.anexo_encargo_suscrito_at, empresa.anexo_encargo_firmado_at,
    'la suscripción y la contrafirma son dos actos distintos');

  // DESPUÉS: ya puede firmar.
  const despues = empresaService.verificarHabilitacionFirma(ID_EMPRESA);
  assert.ok(despues.ok, 'con la contrafirma, la Empresa queda habilitada');
});

test('la contrafirma deja el rastro de los dos actos', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'Verificado el certificado de la cámara' });

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_encargo_eventos WHERE id_suscripcion = ?')
    .all(idSuscripcion).map((e) => e.evento);

  assert.ok(eventos.includes('CONTRAFIRMA_CODIGO_ENVIADO'),
    'el envío del código queda en el rastro');
  assert.ok(eventos.includes('CONTRAFIRMA_FIRMADA'),
    'la contrafirma queda en el rastro');
  assert.ok(eventos.includes('CONTRAFIRMA_ACTA_GENERADA'),
    'el acta de contrafirma queda en el rastro');
  assert.ok(eventos.includes('REPRESENTANTE_VERIFICADO'),
    'la verificación documental queda en el rastro');
});

test('contrafirmar dos veces no hace nada la segunda', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  await assert.rejects(
    () => anexoEncargo.solicitarCodigoContrafirma(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'YA_CONTRAFIRMADO',
    'un instrumento ya ejecutado no se contrafirma otra vez',
  );
});

test('la contrafirma borra el código de la base y la versión no cambia', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  const antes = db.prepare(
    'SELECT version, hash_texto, otp_hash FROM gh_firma_anexo_encargo_suscripciones').get();

  await pedirCodigoContrafirma(idSuscripcion);
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const despues = db.prepare(
    'SELECT version, hash_texto, contrafirma_otp_hash, contrafirmado_at, contrafirma_actor, contrafirma_motivo FROM gh_firma_anexo_encargo_suscripciones').get();

  assert.equal(despues.version, antes.version,
    'la contrafirma no cambia la versión: es el MISMO instrumento');
  assert.equal(despues.hash_texto, antes.hash_texto);
  assert.equal(despues.contrafirma_otp_hash, null,
    'el código de la contrafirma no queda en la base');
  assert.ok(despues.contrafirmado_at);
  assert.equal(despues.contrafirma_actor, 'admin:operador');
  assert.equal(despues.contrafirma_motivo, 'prueba');
});

test('la versión y la huella de la ficha no cambian con la contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  const antes = empresaService.getById(ID_EMPRESA);
  assert.ok(antes.anexo_encargo_suscrito_hash);

  await pedirCodigoContrafirma(idSuscripcion);
  await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const despues = empresaService.getById(ID_EMPRESA);
  assert.equal(despues.anexo_encargo_suscrito_hash, antes.anexo_encargo_suscrito_hash);
  assert.equal(despues.anexo_encargo_suscrito_version, antes.anexo_encargo_suscrito_version);
});

// ===========================================================================
// 4. EL ACTA DE LA CONTRAFIRMA
// ===========================================================================

test('la contrafirma genera SU acta y NO toca la de la suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { res: resSuscripcion, idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  // El acta de la suscripción sigue ahí, con la MISMA huella: la Empresa ya
  // se la llevó, no se puede reescribir.
  const actaSuscripcion = actaEncargo.leerActa(resSuscripcion.acta.archivo);
  assert.equal(actaSuscripcion.found, true);
  const hashSuscripcion = require('crypto').createHash('sha256')
    .update(actaSuscripcion.buffer).digest('hex');
  assert.equal(hashSuscripcion, resSuscripcion.acta.hash,
    'el acta de la suscripción no puede cambiar: la Empresa tiene su huella');

  // Y hay un acta NUEVA, con otro nombre y otra huella.
  assert.notEqual(r.acta.archivo, resSuscripcion.acta.archivo);
  assert.equal(r.acta.archivo, `acta-${idSuscripcion}-contrafirma-anexo-encargo.pdf`);
  assert.notEqual(r.acta.hash, resSuscripcion.acta.hash);

  const actaContrafirma = actaEncargo.leerActa(r.acta.archivo);
  assert.equal(actaContrafirma.found, true);
});

test('el acta de contrafirma cita la de la suscripción y dice lo que NO es', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { res: resSuscripcion, idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const leido = actaEncargo.leerActa(r.acta.archivo);
  const texto = textoPlano(leido.buffer);

  // CITA EL PRIMER ACTA.
  assert.ok(texto.includes(resSuscripcion.acta.archivo),
    'el acta de contrafirma cita el acta de la suscripción');
  assert.ok(texto.includes(resSuscripcion.acta.hash.slice(0, 32)),
    'y cita su huella');

  // DICE QUE EL INSTRUMENTO QUEDA EJECUTADO.
  assert.ok(texto.includes('FASE 2 DE 2'),
    'dice que es la segunda de las dos fases');
  assert.ok(texto.includes('EJECUTADO'),
    'dice que el instrumento queda ejecutado');

  // Y DICE LO QUE NO ES. Esto es lo más importante del acta: si el mecanismo
  // se presentara como una firma calificada, el expediente estaría mintiendo.
  assert.ok(texto.includes('NO es una firma electrónica con certificado digital'),
    'el acta tiene que decir que no hay certificado digital');
  assert.ok(texto.includes('sello de tiempo de un tercero'),
    'el acta tiene que decir que no hay sello de tiempo de terceros');
  assert.ok(texto.includes('firma electrónica REFORZADA'),
    'y tiene que decir lo que sí hay');

  // Y que es una constancia, no la copia firmada.
  assert.ok(texto.includes('CONSTANCIA, NO LA COPIA FIRMADA'));
});

test('el acta de contrafirma no puede llevar su propia huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const leido = actaEncargo.leerActa(r.acta.archivo);
  const texto = textoPlano(leido.buffer);
  assert.ok(!texto.includes(r.acta.hash),
    'la huella del acta se calcula sobre sus bytes: no puede estar dentro');
});

test('el acta de contrafirma nombra el archivo por el id de la suscripción', () => {
  assert.equal(actaEncargo.nombreActaContrafirma(123),
    'acta-123-contrafirma-anexo-encargo.pdf');
});

// ===========================================================================
// 5. SI LA ESCRITURA FALLA, EL ACTA SE BORRA
// ===========================================================================

test('si la escritura de la ficha falla, el acta de contrafirma se borra', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribirYVerificar();
  await pedirCodigoContrafirma(idSuscripcion);

  const nombre = actaEncargo.nombreActaContrafirma(idSuscripcion);
  const ruta = actaEncargo.rutaActa(nombre);
  if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

  // Se rompe la escritura de la ficha (la que habilita a la Empresa).
  const original = empresaService.marcarAnexoFirmado;
  empresaService.marcarAnexoFirmado = () => {
    throw new Error('fallo simulado al escribir la ficha');
  };
  try {
    await assert.rejects(
      () => anexoEncargo.contrafirmar(ID_EMPRESA, idSuscripcion, {
        otp: codigoDeContrafirma(), acepta: true,
      }, { actor: 'admin:operador', motivo: 'prueba' }),
      /fallo simulado/,
    );
  } finally {
    empresaService.marcarAnexoFirmado = original;
  }

  assert.equal(fs.existsSync(ruta), false,
    'no puede quedar un archivo sin registro: el acta se borra');
  const fila = db.prepare(
    'SELECT contrafirmado_at FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.contrafirmado_at, null,
    'y tampoco puede quedar un registro sin archivo: la contrafirma no se cierra');
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.equal(empresa.anexo_encargo_firmado_at, null,
    'la Empresa no queda habilitada');
});
