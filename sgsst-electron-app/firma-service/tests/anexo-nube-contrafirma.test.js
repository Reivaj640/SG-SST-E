/**
 * LA CONTRAFIRMA DEL ANEXO DE NUBE (FASE 2)
 * ============================================================================
 *
 * El Anexo de Nube v1.2 es BILATERAL (parrafo 10): la suscripcion de la
 * Empresa es el PRIMER acto y la contrafirma de K+AIR el SEGUNDO. El
 * instrumento queda EJECUTADO cuando los dos actos se han producido.
 *
 * Lo que se verifica aca:
 *
 * - Que NO se contrafirma lo que la Empresa no suscribio.
 * - Que NO se contrafirma sin saber quien firmo por la Empresa.
 * - Que el codigo de la contrafirma sale al buzon de K+AIR (fijo en la
 *   configuracion) y NO a uno que elija quien lo pide.
 * - Que el codigo de la suscripcion NO sirve para contrafirmar, ni al reves:
 *   son dos dominios de derivacion distintos.
 * - Que la contrafirma exige el codigo, la aceptacion expresa y el motivo.
 * - Que la contrafirma genera SU acta, con su huella SHA-256, y que el
 *   primer acto NO se reescribe.
 * - Que el acta dice, sin adornos, que NO hay certificado digital de terceros
 *   ni sello de tiempo de terceros.
 * - Que la contrafirma escribe `anexo_nube_ejecutado_at` (la fecha del
 *   SEGUNDO acto) y que NO toca `anexo_nube_firmado_at` (el PRIMER acto).
 * - Que el rastro append-only tiene los tres eventos de la contrafirma.
 * - Que si la escritura falla, el acta se borra: no puede quedar un archivo
 *   sin registro ni un registro sin archivo.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const zlib = require('zlib');

const db = require('../src/db/connection');
const request = require('supertest');
const anexoNube = require('../src/services/anexoNube');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const actaAnexoNube = require('../src/services/actaAnexoNube');
const config = require('../src/config');
const {
  verifyOTPHmac, PROPOSITO_OTP_CONTRAFIRMA,
} = require('../src/crypto/otp');
const { resetDb, makeApp, TEST_ADMIN_API_KEY } = require('./helpers');

const ADMIN = { 'X-Admin-API-Key': TEST_ADMIN_API_KEY };

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';
const NOMBRE_FIRMANTE = 'PERSONA DE PRUEBA';

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa() {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(ID_EMPRESA, 'EMPRESA DE PRUEBA SAS', '900555777-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-prueba.test',
    'datos@empresa-prueba.test', NOMBRE_FIRMANTE);
}

/** El ultimo correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo) return inbox[i];
  }
  return null;
}

/** El codigo de la suscripcion (el del tipo 'anexo_nube'). */
function codigoDeSuscripcion() {
  const c = ultimoCorreo('anexo_nube');
  assert.ok(c, 'tiene que haber salido el correo con el codigo de la suscripcion');
  return c.otp;
}

/** El codigo de la contrafirma (el del tipo 'anexo_nube_contrafirma'). */
function codigoDeContrafirma() {
  const c = ultimoCorreo('anexo_nube_contrafirma');
  assert.ok(c, 'tiene que haber salido el correo con el codigo de la contrafirma');
  return c.otp;
}

/** Abre una suscripcion del Anexo de Nube. */
async function abrir() {
  return anexoNube.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    nombre_firmante: NOMBRE_FIRMANTE,
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });
}

/** Abre, pide el codigo y suscribe: el PRIMER acto. */
async function suscribir() {
  const abierto = await abrir();
  await anexoNube.solicitarCodigo(abierto.token, {});
  const res = anexoNube.suscribir(abierto.token, {
    otp: codigoDeSuscripcion(),
    acepta: true,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones').get().id;
  return { abierto, res, idSuscripcion };
}

/** Pide el codigo de la contrafirma. */
async function pedirCodigoContrafirma(idSuscripcion) {
  return anexoNube.solicitarContrafirmaAnexoNube(ID_EMPRESA, idSuscripcion, {
    ip: '10.0.0.9', user_agent: 'Operador/1.0',
  });
}

/** El texto del PDF en una sola linea (para comprobar FRASES). */
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

test('no se contrafirma lo que la Empresa no suscribio', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const abierto = await abrir();
  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones').get().id;

  await assert.rejects(
    () => anexoNube.solicitarContrafirmaAnexoNube(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'SUSCRIPCION_NO_FIRMADA',
    'no se contrafirma una suscripcion que la Empresa no firmo',
  );
});

test('no se contrafirma sin saber quien firmo por la Empresa', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();

  // Se borra el firmante declarado: la suscripcion queda sin saber quien
  // firmo, y sin eso no hay contrafirma (parrafo 10 del texto vigente).
  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET nombre_firmante = NULL WHERE id = ?`).run(idSuscripcion);

  await assert.rejects(
    () => anexoNube.solicitarContrafirmaAnexoNube(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'REPRESENTANTE_NO_VERIFICADO',
    'K+AIR no contrafirma sin saber quien firmo por la Empresa',
  );
});

test('no se contrafirma sin motivo, sin aceptacion o sin codigo', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();

  // Sin codigo pedido.
  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: '123456', acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_NO_SOLICITADO',
    'sin codigo no hay contrafirma',
  );

  await pedirCodigoContrafirma(idSuscripcion);

  // Sin motivo.
  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(), acepta: true,
    }, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
    'la contrafirma ejecuta el instrumento: tiene que decir por que',
  );

  // Sin aceptacion expresa.
  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(),
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
    'la contrafirma es un acto: tiene que aceptarse',
  );

  // Con `acepta: false` tampoco.
  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: codigoDeContrafirma(), acepta: false,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
    'marcar que no se acepta no es aceptar',
  );
});

// ===========================================================================
// 2. EL CODIGO DE LA CONTRAFIRMA
// ===========================================================================

test('el codigo de la contrafirma sale al buzon de K+AIR, no a uno que se elija', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  const r = await pedirCodigoContrafirma(idSuscripcion);

  const correo = ultimoCorreo('anexo_nube_contrafirma');
  assert.ok(correo, 'tiene que salir el correo con el codigo de contrafirma');
  assert.equal(correo.to, config.canalProteccionDatos,
    'el canal es el de la configuracion de K+AIR: quien pide la contrafirma no lo elige');
  assert.notEqual(correo.to, CORREO_FIRMANTE,
    'el codigo de la contrafirma no puede salir al buzon de la Empresa');
  assert.equal(r.canal, 'pr***@gmail.com',
    'la respuesta muestra el canal enmascarado');
});

test('el codigo de la suscripcion NO sirve para contrafirmar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  const codigoSuscripcion = codigoDeSuscripcion();

  await pedirCodigoContrafirma(idSuscripcion);

  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: codigoSuscripcion, acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
    'los dos actos tienen codigos distintos: con el de la suscripcion no se contrafirma',
  );
});

test('los dos codigos son dominios de derivacion distintos', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  // Se pide el codigo de la suscripcion y se guarda su huella ANTES de
  // suscribir: al suscribir, el codigo se consume y su huella se borra de la
  // base (un codigo de un solo uso).
  const abierto = await abrir();
  await anexoNube.solicitarCodigo(abierto.token, {});
  const hashSuscripcion = db.prepare(
    'SELECT otp_hash FROM gh_firma_anexo_nube_suscripciones').get().otp_hash;
  const codigoSuscripcion = codigoDeSuscripcion();
  assert.ok(hashSuscripcion, 'la huella del codigo de la suscripcion tiene que estar');

  anexoNube.suscribir(abierto.token, {
    otp: codigoSuscripcion,
    acepta: true,
  }, { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const idSuscripcion = db.prepare(
    'SELECT id FROM gh_firma_anexo_nube_suscripciones').get().id;

  await pedirCodigoContrafirma(idSuscripcion);

  const hashContrafirma = db.prepare(
    'SELECT contrafirma_otp_hash FROM gh_firma_anexo_nube_suscripciones')
    .get().contrafirma_otp_hash;
  assert.ok(hashContrafirma, 'la huella del codigo de la contrafirma tiene que estar');
  assert.notEqual(hashContrafirma, hashSuscripcion,
    'las dos huellas son distintas: son dos actos distintos');

  // El codigo de la contrafirma NO verifica contra la huella de la
  // suscripcion: ni con el proposito de la contrafirma ni con el de la
  // suscripcion.
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashSuscripcion, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    false,
    'el proposito de la contrafirma no puede ser el de la suscripcion',
  );
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashSuscripcion, ID_EMPRESA),
    false,
  );
  // Y el de la suscripcion tampoco verifica contra el de la contrafirma.
  assert.equal(
    verifyOTPHmac(codigoSuscripcion, hashContrafirma, ID_EMPRESA),
    false,
  );
  assert.equal(
    verifyOTPHmac(codigoSuscripcion, hashContrafirma, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    false,
  );
  // Con su proposito, cada uno si valida contra su huella.
  assert.equal(
    verifyOTPHmac(codigoDeContrafirma(), hashContrafirma, ID_EMPRESA, PROPOSITO_OTP_CONTRAFIRMA),
    true,
    'el codigo de la contrafirma tiene que validar contra su propia huella',
  );
});

test('un codigo incorrecto se cuenta y no contrafirma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);

  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: '000000', acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
  );

  const fila = db.prepare(
    'SELECT contrafirma_otp_intentos FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirma_otp_intentos, 1,
    'el intento fallido queda contado');
});

test('agotar los intentos bloquea el codigo de contrafirma sin tocar el primer acto', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);

  const max = config.ttl.otpMaxAttempts;
  for (let i = 1; i < max; i++) {
    await assert.rejects(
      () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
        otp: '000000', acepta: true,
      }, { actor: 'admin', motivo: 'prueba' }),
      (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
    );
  }
  await assert.rejects(
    () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
      otp: '000000', acepta: true,
    }, { actor: 'admin', motivo: 'prueba' }),
    (e) => e.statusCode === 429 && e.code === 'CODIGO_BLOQUEADO',
    'agotados los intentos, el codigo de contrafirma queda bloqueado',
  );

  const fila = db.prepare(
    'SELECT estado, contrafirma_estado, contrafirmado_at FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirma_estado, 'BLOQUEADA',
    'el estado del segundo acto queda bloqueado');
  assert.equal(fila.estado, 'FIRMADA',
    'el estado del PRIMER acto no se toca: la suscripcion sigue firmada');
  assert.equal(fila.contrafirmado_at, null,
    'y la contrafirma no se cerro');
});

// ===========================================================================
// 3. LA CONTRAFIRMA
// ===========================================================================

test('la contrafirma ejecuta el instrumento y deja la fecha del segundo acto', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, {
    actor: 'admin:operador',
    motivo: 'Verificado el certificado de la camara',
    ip: '10.0.0.9',
    user_agent: 'Operador/1.0',
  });

  assert.equal(r.contrafirmado, true);
  assert.ok(r.contrafirmado_at);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at,
    'la suscripcion de la Empresa sigue con su fecha: es el PRIMER acto');
  const ejecucion = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?')
    .get(ID_EMPRESA);
  assert.ok(ejecucion.anexo_nube_ejecutado_at,
    'la contrafirma escribe la fecha de ejecucion del instrumento');
  assert.equal(ejecucion.anexo_nube_ejecutado_at, r.contrafirmado_at);
  assert.notEqual(ejecucion.anexo_nube_ejecutado_at, empresa.anexo_nube_firmado_at,
    'son dos actos distintos: la suscripcion y la contrafirma');
});

test('la contrafirma escribe el actor, el motivo y la evidencia', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba de contrafirma' });

  const fila = db.prepare(
    `SELECT contrafirmado_at, contrafirma_actor, contrafirma_motivo,
            contrafirma_evidencia, contrafirma_acta_hash, contrafirma_acta_bytes,
            contrafirma_acta_archivo, version, hash_texto, contrafirma_otp_hash
     FROM gh_firma_anexo_nube_suscripciones`).get();

  assert.ok(fila.contrafirmado_at);
  assert.equal(fila.contrafirma_actor, 'admin:operador');
  assert.equal(fila.contrafirma_motivo, 'prueba de contrafirma');
  assert.equal(fila.contrafirma_otp_hash, null,
    'el codigo de la contrafirma no queda en la base');
  assert.ok(fila.contrafirma_acta_hash);
  assert.ok(fila.contrafirma_acta_bytes > 0);
  assert.ok(fila.contrafirma_acta_archivo);

  const evidencia = JSON.parse(fila.contrafirma_evidencia);
  assert.equal(evidencia.fuente, 'contrafirma_kair');
  assert.equal(evidencia.fase, 2);
  assert.equal(evidencia.version, fila.version);
  assert.equal(evidencia.hash, fila.hash_texto,
    'la evidencia cita el MISMO texto que se suscribio');
  assert.ok(evidencia.suscrito_at, 'la evidencia cita el primer acto');
  assert.ok(evidencia.contrafirmado_at, 'la evidencia dice el segundo acto');
  assert.ok(evidencia.verificacion_firmante,
    'la evidencia deja por escrito quien firmo por la Empresa');
  assert.equal(evidencia.verificacion_firmante.resultado, 'COINCIDE_CON_LA_FICHA');
});

test('la contrafirma deja el rastro de los dos actos', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_nube_eventos WHERE id_suscripcion = ?')
    .all(idSuscripcion).map((e) => e.evento);

  assert.ok(eventos.includes('CONTRAFIRMA_CODIGO_ENVIADO'),
    'el envio del codigo queda en el rastro');
  assert.ok(eventos.includes('CONTRAFIRMA_FIRMADA'),
    'la contrafirma queda en el rastro');
  assert.ok(eventos.includes('CONTRAFIRMA_ACTA_GENERADA'),
    'el acta de contrafirma queda en el rastro');
  assert.ok(eventos.includes('SUSCRIPCION_FIRMADA'),
    'el PRIMER acto sigue en el rastro: no se reescribe');
});

test('contrafirmar dos veces no hace nada la segunda', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  await assert.rejects(
    () => anexoNube.solicitarContrafirmaAnexoNube(ID_EMPRESA, idSuscripcion, {}),
    (e) => e.statusCode === 409 && e.code === 'YA_CONTRAFIRMADO',
    'un instrumento ya ejecutado no se contrafirma otra vez',
  );
});

// ===========================================================================
// 4. EL ACTA DE LA CONTRAFIRMA
// ===========================================================================

test('la contrafirma genera SU acta, con su huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  assert.equal(r.acta.archivo, `acta-${idSuscripcion}-contrafirma-anexo-nube.pdf`);

  const leido = actaAnexoNube.leerActa(r.acta.archivo);
  assert.equal(leido.found, true, 'el acta queda en el servidor');

  const hash = require('crypto').createHash('sha256')
    .update(leido.buffer).digest('hex');
  assert.equal(hash, r.acta.hash,
    'la huella del acta es la de SUS bytes');
  assert.equal(leido.buffer.length, r.acta.bytes);
});

test('el acta de contrafirma cita el primer acto y dice lo que NO es', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { res, idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const leido = actaAnexoNube.leerActa(r.acta.archivo);
  const texto = textoPlano(leido.buffer);

  // CITA EL TEXTO DEL INSTRUMENTO (el primer acto).
  assert.ok(texto.includes(res.hash.slice(0, 32)),
    'el acta cita la huella del texto que se suscribio');
  assert.ok(texto.includes(res.version),
    'y cita la version del texto');

  // DICE QUE EL INSTRUMENTO QUEDA EJECUTADO.
  assert.ok(texto.includes('SEGUNDO ACTO DE 2'),
    'dice que es la segunda de las dos partes');
  assert.ok(texto.includes('EJECUTADO'),
    'dice que el instrumento queda ejecutado');

  // Y DICE LO QUE NO ES. Esto es lo mas importante del acta: si el mecanismo
  // se presentara como una firma calificada, el expediente estaria mintiendo.
  assert.ok(texto.includes('NO es una firma electronica con certificado digital'),
    'el acta tiene que decir que no hay certificado digital');
  assert.ok(texto.includes('sello de tiempo de un tercero'),
    'el acta tiene que decir que no hay sello de tiempo de terceros');
  assert.ok(texto.includes('firma electronica REFORZADA'),
    'y tiene que decir lo que si hay');

  // Y que es una constancia, no la copia firmada.
  assert.ok(texto.includes('CONSTANCIA, NO LA COPIA FIRMADA'));
});

test('el acta de contrafirma no puede llevar su propia huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);
  const r = await anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
    otp: codigoDeContrafirma(), acepta: true,
  }, { actor: 'admin:operador', motivo: 'prueba' });

  const leido = actaAnexoNube.leerActa(r.acta.archivo);
  const texto = textoPlano(leido.buffer);
  assert.ok(!texto.includes(r.acta.hash),
    'la huella del acta se calcula sobre sus bytes: no puede estar dentro');
});

test('el nombre del acta sale del id de la suscripcion', () => {
  assert.equal(actaAnexoNube.nombreActaContrafirma(123),
    'acta-123-contrafirma-anexo-nube.pdf');
});

// ===========================================================================
// 5. SI LA ESCRITURA FALLA, EL ACTA SE BORRA
// ===========================================================================

test('si la escritura de la ficha falla, el acta de contrafirma se borra', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const { idSuscripcion } = await suscribir();
  await pedirCodigoContrafirma(idSuscripcion);

  const nombre = actaAnexoNube.nombreActaContrafirma(idSuscripcion);
  const ruta = actaAnexoNube.rutaActa(nombre);
  if (fs.existsSync(ruta)) fs.unlinkSync(ruta);

  // Se rompe la escritura de la ficha de la Empresa (la que registra la
  // fecha de ejecucion del instrumento) con un trigger: la base se niega a
  // aceptar esa columna, como si la escritura fallara.
  db.exec(`CREATE TRIGGER trg_prueba_contrafirma_falla
    BEFORE UPDATE ON gh_firma_empresas
    WHEN NEW.anexo_nube_ejecutado_at IS NOT NULL
    BEGIN SELECT RAISE(ABORT, 'fallo simulado al escribir la ficha'); END;`);
  try {
    await assert.rejects(
      () => anexoNube.contrafirmarAnexoNube(ID_EMPRESA, idSuscripcion, {
        otp: codigoDeContrafirma(), acepta: true,
      }, { actor: 'admin:operador', motivo: 'prueba' }),
      /fallo simulado/,
    );
  } finally {
    db.exec('DROP TRIGGER IF EXISTS trg_prueba_contrafirma_falla');
  }

  assert.equal(fs.existsSync(ruta), false,
    'no puede quedar un archivo sin registro: el acta se borra');
  const fila = db.prepare(
    'SELECT contrafirmado_at FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirmado_at, null,
    'y tampoco puede quedar un registro sin archivo: la contrafirma no se cierra');
  const empresa = db.prepare(
    'SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?')
    .get(ID_EMPRESA);
  assert.equal(empresa.anexo_nube_ejecutado_at, null,
    'la Empresa no queda con el instrumento ejecutado');
});

// ===========================================================================
// 6. LAS DOS RUTAS DE ADMINISTRACION (POR HTTP)
// ===========================================================================

test('las dos rutas de admin hacen el segundo acto completo por HTTP', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();

  // 1. El operador pide el código de la contrafirma.
  const { idSuscripcion } = await suscribir();
  const codigo = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar/codigo`)
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion });
  assert.equal(codigo.status, 200, JSON.stringify(codigo.body));
  assert.ok(codigo.body.expira_en_segundos > 0);
  assert.equal(codigo.body.canal, 'pr***@gmail.com',
    'la respuesta muestra el canal enmascarado');

  // 2. Contrafirma: con el código, la aceptación y el motivo.
  const firma = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar`)
    .set(ADMIN)
    .set('X-Admin-Actor', 'admin:operador')
    .set('X-Admin-Motivo', 'Contrafirma sobre el texto vigente')
    .send({ id_suscripcion: idSuscripcion, otp: codigoDeContrafirma(), acepta: true });
  assert.equal(firma.status, 200, JSON.stringify(firma.body));
  assert.equal(firma.body.contrafirmado, true);

  // 3. El instrumento queda EJECUTADO y el primer acto sigue intacto.
  const empresa = db.prepare(
    'SELECT anexo_nube_firmado_at, anexo_nube_ejecutado_at FROM gh_firma_empresas WHERE id_empresa = ?')
    .get(ID_EMPRESA);
  assert.ok(empresa.anexo_nube_firmado_at,
    'la suscripcion de la Empresa sigue con su fecha: es el PRIMER acto');
  assert.equal(empresa.anexo_nube_ejecutado_at, firma.body.contrafirmado_at,
    'la contrafirma escribe la fecha de ejecucion del instrumento');

  // 4. Y la ficha deja RASTRO del cambio: el campo, de que valor a que valor,
  // quien lo cambio y por que. Lo que se escribe una vez, no se altera.
  const rastro = db.prepare(
    `SELECT campo, valor_anterior, valor_nuevo, id_actor, motivo
     FROM gh_firma_empresas_auditoria
     WHERE id_empresa = ? AND campo = 'anexo_nube_ejecutado_at'`)
    .all(ID_EMPRESA);
  assert.equal(rastro.length, 1, 'el cambio de la ficha queda en el rastro');
  assert.equal(rastro[0].valor_anterior, null);
  assert.equal(rastro[0].valor_nuevo, firma.body.contrafirmado_at);
  assert.equal(rastro[0].id_actor, 'admin:operador');
  assert.equal(rastro[0].motivo, 'Contrafirma sobre el texto vigente');

  // 4. Y el actor y el motivo que salieron de los headers quedan escritos.
  const fila = db.prepare(
    'SELECT contrafirma_actor, contrafirma_motivo FROM gh_firma_anexo_nube_suscripciones').get();
  assert.equal(fila.contrafirma_actor, 'admin:operador');
  assert.equal(fila.contrafirma_motivo, 'Contrafirma sobre el texto vigente');
});

test('contrafirmar por HTTP sin el motivo se rechaza', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const { idSuscripcion } = await suscribir();
  await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar/codigo`)
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion });

  const firma = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar`)
    .set(ADMIN)
    .send({ id_suscripcion: idSuscripcion, otp: codigoDeContrafirma(), acepta: true });
  assert.equal(firma.status, 400);
  assert.equal(firma.body.error.code, 'MOTIVO_REQUERIDO');
});

test('las rutas de contrafirma del Nube exigen la llave de admin', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const app = makeApp();
  const { idSuscripcion } = await suscribir();

  const codigo = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar/codigo`)
    .send({ id_suscripcion: idSuscripcion });
  assert.equal(codigo.status, 401);

  const firma = await request(app)
    .post(`/internal/admin/empresas/${ID_EMPRESA}/anexo-nube/contrafirmar`)
    .send({ id_suscripcion: idSuscripcion, otp: '123456', acepta: true });
  assert.equal(firma.status, 401);
});
