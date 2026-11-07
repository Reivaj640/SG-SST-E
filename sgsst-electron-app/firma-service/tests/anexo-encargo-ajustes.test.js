/**
 * LOS AJUSTES DEL ABOGADO EN LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * Son los tres refuerzos que pidió el abogado el 7-nov-2026, más la
 * consecuencia de fondo del tercero:
 *
 *   1. EL SEGUNDO CANAL DEL CÓDIGO. El artículo 4 del Decreto 2364 pide que
 *      los datos de creación de la firma correspondan exclusivamente al
 *      firmante. Con el enlace y el código en el mismo buzón, no se cumple.
 *   2. LA VERIFICACIÓN DOCUMENTAL DEL REPRESENTANTE. El flujo probaba control
 *      de un buzón, no que quien firmara fuera el representante legal ni que
 *      tuviera poder.
 *   3. LA FASE 1 NO HABILITA A LA EMPRESA. El Anexo de Encargo es bilateral:
 *      hasta que K+AIR contrafirme, el instrumento no está ejecutado y la
 *      Empresa no puede firmar documentos de sus trabajadores.
 *
 * Y además, los tres textos que la Empresa tiene que aceptar: la cláusula
 * expresa del mecanismo (art. 7 del Decreto 2364), la declaración de
 * representación y la información sobre el tratamiento de datos (art. 12 de
 * la Ley 1581).
 *
 * Cada prueba de aquí tiene que fallar si se deshace el ajuste que vigila.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/connection');
const anexoEncargo = require('../src/services/anexoEncargo');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const representanteService = require('../src/services/representante');
const textosAceptacion = require('../src/services/anexoEncargoTextos');
const { resetDb } = require('./helpers');

const ID_EMPRESA = '900444333';
const CORREO_FIRMANTE = 'representante@empresa-ajustes.test';
const CANAL_CODIGO = 'segundo-canal@empresa-ajustes.test';
const CONFIRMACION_CANAL = 'Confirmado por llamada al teléfono de la Empresa';
const DOCUMENTO_REPRESENTANTE = '900123456';

const DATOS_S11 = {
  razon_social: 'EMPRESA DE LOS AJUSTES S.A.S.',
  nit: '900.444.333-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: CORREO_FIRMANTE,
  representante: 'PERSONA DE PRUEBA',
};

const REPRESENTANTE = { documento: DOCUMENTO_REPRESENTANTE, calidad: 'REPRESENTANTE_LEGAL' };

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
    'pqrs@empresa-ajustes.test', CORREO_FIRMANTE, DATOS_S11.representante);
}

/** El último código de verificación que salió. */
function ultimoCodigo() {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === 'anexo_encargo' && inbox[i].otp) return inbox[i].otp;
  }
  return null;
}

/** Abre una suscripción con el segundo canal. */
function abrir(extra = {}) {
  return anexoEncargo.crearSuscripcion(ID_EMPRESA, Object.assign({
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, extra), { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });
}

/** Abre, pide el código y suscribe. Devuelve la respuesta. */
async function suscribir(extra = {}) {
  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});
  const res = await anexoEncargo.suscribir(abierto.token, Object.assign({
    otp: ultimoCodigo(),
    acepta: true,
    acepta_tratamiento: true,
    datos_empresa: DATOS_S11,
    representante: REPRESENTANTE,
  }, extra), { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });
  return { abierto, res };
}

// ===========================================================================
// 1. EL SEGUNDO CANAL DEL CÓDIGO
// ===========================================================================

test('sin un segundo canal NO se abre la suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'CANAL_CODIGO_REQUERIDO',
    'sin segundo canal no hay suscripción: el código no puede ir al buzón del enlace',
  );

  const filas = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').all();
  assert.equal(filas.length, 0, 'no quedó ninguna suscripción a medias');
});

test('el segundo canal NO puede ser el mismo buzón del enlace', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: CORREO_FIRMANTE,
      canal_codigo_confirmacion: CONFIRMACION_CANAL,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'CANAL_CODIGO_IGUAL',
    'el código y el enlace no pueden llegar al mismo buzón',
  );

  // Tampoco vale el mismo buzón escrito de otra forma (mayúsculas, espacios).
  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: '  ' + CORREO_FIRMANTE.toUpperCase() + ' ',
      canal_codigo_confirmacion: CONFIRMACION_CANAL,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'CANAL_CODIGO_IGUAL',
    'el canal se compara normalizado: un buzón no se disfraza con mayúsculas',
  );
});

test('sin la confirmación del canal NO se abre la suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: CANAL_CODIGO,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'CANAL_CODIGO_SIN_CONFIRMAR',
    'sin dejar constancia de cómo se confirmó el canal, no hay prueba de que sea de la Empresa',
  );
});

test('el segundo canal queda registrado con QUIÉN lo confirmó y CÓMO', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();

  assert.equal(fila.canal_codigo, CANAL_CODIGO);
  assert.equal(fila.canal_codigo_tipo, 'correo');
  assert.equal(fila.canal_codigo_confirmacion, CONFIRMACION_CANAL);
  assert.equal(fila.canal_codigo_confirmado_por, 'admin');
  assert.ok(fila.canal_codigo_confirmado_at, 'tiene que quedar cuándo se confirmó');
  assert.equal(abierto.token.length > 0, true);
});

test('el código sale por el segundo canal, y el contexto lo muestra enmascarado', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});

  const inbox = mailer.getDevInbox();
  const codigo = inbox.filter((m) => m.tipo === 'anexo_encargo').pop();
  assert.equal(codigo.to, CANAL_CODIGO,
    'el código no puede salir al buzón que recibió el enlace');

  const ctx = anexoEncargo.contextoPublico(abierto.token, '1.1.1.1', 'navegador');
  assert.equal(ctx.canal_codigo, 'se***@empresa-ajustes.test',
    'la pantalla ve el canal enmascarado, no la dirección entera');
  assert.ok(!ctx.canal_codigo.includes('segundo-canal'));
  assert.equal(ctx.canal_codigo_confirmado, true);
});

// ===========================================================================
// 2. LA VERIFICACIÓN DOCUMENTAL DEL REPRESENTANTE
// ===========================================================================

test('sin el documento de quien firma NO se suscribe', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});

  await assert.rejects(
    () => anexoEncargo.suscribir(abierto.token, {
      otp: ultimoCodigo(),
      acepta: true,
      acepta_tratamiento: true,
      datos_empresa: DATOS_S11,
      // sin representante
    }, {}),
    (e) => e.statusCode === 400 && e.code === 'REPRESENTANTE_NO_IDENTIFICADO',
    'sin saber quién firmó, el método solo probaría control de un buzón',
  );
});

test('la calidad de quien firma tiene que ser una de las dos', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});

  await assert.rejects(
    () => anexoEncargo.suscribir(abierto.token, {
      otp: ultimoCodigo(),
      acepta: true,
      acepta_tratamiento: true,
      datos_empresa: DATOS_S11,
      representante: { documento: DOCUMENTO_REPRESENTANTE, calidad: 'DIRECTOR' },
    }, {}),
    (e) => e.statusCode === 400 && e.code === 'REPRESENTANTE_NO_IDENTIFICADO',
  );
});

test('el documento de quien firma se guarda CIFRADO, y se puede abrir con la llave', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await suscribir();

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  const snapshot = representanteService.leerSnapshot(fila.representante_documento);
  assert.ok(snapshot, 'el documento tiene que quedar como un snapshot cifrado');
  assert.notEqual(snapshot.numero_identificacion, DOCUMENTO_REPRESENTANTE,
    'el número no puede quedar en claro en la base');
  assert.equal(representanteService.numeroEnClaro(snapshot, ID_EMPRESA), DOCUMENTO_REPRESENTANTE,
    'el número sí tiene que poder abrirse con la llave: sin eso no se puede verificar');
  assert.equal(fila.representante_calidad, 'REPRESENTANTE_LEGAL');
});

test('la verificación del representante queda registrada con quién, cuándo y contra qué', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { abierto } = await suscribir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  const r = anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
    tipo_documento: 'CERTIFICADO_CAMARA',
    referencia: 'Radicado 2026-11-07-14, Cámaras de Barranquilla',
    nota: 'El nombre y el documento coinciden con el certificado',
  }, { actor: 'admin', motivo: 'Verificado contra el certificado de la cámara' });

  assert.equal(r.verificado, true);
  assert.equal(r.tipo_documento, 'CERTIFICADO_CAMARA');

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  const verificacion = JSON.parse(fila.representante_verificacion);
  assert.equal(verificacion.tipo_documento, 'CERTIFICADO_CAMARA');
  assert.equal(verificacion.referencia, 'Radicado 2026-11-07-14, Cámaras de Barranquilla');
  assert.equal(verificacion.verificado_por, 'admin');
  assert.ok(verificacion.verificado_at);

  // Y queda en el rastro inalterable de la suscripción.
  const evento = db.prepare(
    'SELECT * FROM gh_firma_anexo_encargo_eventos WHERE id_suscripcion = ? AND evento = ?',
  ).get(idSuscripcion, 'REPRESENTANTE_VERIFICADO');
  assert.ok(evento, 'la verificación tiene que quedar en el rastro');
  assert.equal(abierto.token.length > 0, true);
});

test('la verificación del representante exige el motivo y un documento real', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await suscribir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones').get().id;

  await assert.rejects(
    // `async` es obligatorio: assert.rejects solo consulta el validador si la
    // funcion devuelve una promesa rechazada. Una funcion sincronica que lanza
    // escapa antes y el validador nunca llega a verse.
    async () => anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
      tipo_documento: 'CERTIFICADO_CAMARA',
      referencia: 'Radicado 1',
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
  );

  await assert.rejects(
    async () => anexoEncargo.verificarRepresentante(ID_EMPRESA, idSuscripcion, {
      tipo_documento: 'PAREJAS',
      referencia: 'Radicado 1',
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'VERIFICACION_INCOMPLETA',
  );
});

// ===========================================================================
// 3. LA FASE 1 NO HABILITA A LA EMPRESA
// ===========================================================================

test('la suscripción NO habilita a la Empresa: la contrafirma va aparte', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await suscribir();

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at,
    'la suscripción sí queda registrada en la ficha');
  assert.equal(empresa.anexo_encargo_firmado_at, null,
    'la fecha de firma la pone la contrafirma de K+AIR, no la suscripción');

  const habilitacion = empresaService.verificarHabilitacionFirma(ID_EMPRESA);
  assert.equal(habilitacion.ok, false,
    'una Empresa que solo suscribió no puede firmar documentos de sus trabajadores');
  assert.ok(habilitacion.pendientes.includes('anexo_encargo_firmado'));
  assert.match(habilitacion.mensaje, /contrafirm/i,
    'el mensaje tiene que decir que lo que falta es la contrafirma de K+AIR');
});

test('la suscripción escribe la versión y la huella del texto suscrito', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await suscribir();

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.equal(empresa.anexo_encargo_suscrito_version, '2026-11-06');
  assert.equal(empresa.anexo_encargo_suscrito_hash, anexoEncargo.modeloVigente().hash);
  assert.ok(empresa.anexo_encargo_suscrito_evidencia);
});

// ===========================================================================
// 4. LOS TEXTOS QUE LA EMPRESA ACEPTA
// ===========================================================================

test('sin la aceptación de la información de datos NO se suscribe', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  await anexoEncargo.solicitarCodigo(abierto.token, {});

  await assert.rejects(
    () => anexoEncargo.suscribir(abierto.token, {
      otp: ultimoCodigo(),
      acepta: true,
      // sin acepta_tratamiento
      datos_empresa: DATOS_S11,
      representante: REPRESENTANTE,
    }, {}),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
  );
});

test('el contexto lleva los textos legales que la Empresa tiene que aceptar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  const ctx = anexoEncargo.contextoPublico(abierto.token, '1.1.1.1', 'navegador');

  assert.equal(ctx.textos.mecanismo, textosAceptacion.MECANISMO);
  assert.equal(ctx.textos.tratamiento, textosAceptacion.TRATAMIENTO_DATOS);
  assert.ok(ctx.textos.mecanismo.includes('mecanismo electrónico descrito en el Acuerdo'),
    'la cláusula del mecanismo tiene que estar');
  assert.ok(ctx.textos.mecanismo.includes('forma parte integral de este Anexo'),
    'el acta con el §11 tiene que quedar incorporada al Anexo');
  assert.ok(ctx.textos.declaracion.includes('representante legal'));
  assert.ok(ctx.textos.declaracion_delegado.includes('delegado'));
  assert.ok(ctx.textos.tratamiento.includes('privacidad.kair@gmail.com'),
    'la información de datos tiene que decir cómo ejercer los derechos');
  assert.ok(ctx.textos.tratamiento.includes('diez (10) años'),
    'la información de datos tiene que decir por cuánto se conserva');
});

test('la evidencia lleva la huella de los textos que la Empresa aceptó', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { res } = await suscribir();

  assert.equal(res.evidencia.aceptacion_hash, textosAceptacion.hashAceptacion('REPRESENTANTE_LEGAL'));
  assert.equal(res.evidencia.aceptacion_tratamiento_hash, textosAceptacion.hashTratamiento());

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.aceptacion_hash, textosAceptacion.hashAceptacion('REPRESENTANTE_LEGAL'));
  assert.equal(fila.aceptacion_tratamiento_hash, textosAceptacion.hashTratamiento());
});

test('la declaración de representación cambia con la calidad declarada', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { res } = await suscribir({
    representante: { documento: DOCUMENTO_REPRESENTANTE, calidad: 'DELEGADO' },
  });

  assert.equal(res.evidencia.representante.calidad, 'DELEGADO');
  assert.equal(res.evidencia.aceptacion_hash, textosAceptacion.hashAceptacion('DELEGADO'),
    'el delegado declara con OTRAS palabras: no puede firmar la del representante legal');
  assert.notEqual(textosAceptacion.hashAceptacion('DELEGADO'),
    textosAceptacion.hashAceptacion('REPRESENTANTE_LEGAL'));
});
