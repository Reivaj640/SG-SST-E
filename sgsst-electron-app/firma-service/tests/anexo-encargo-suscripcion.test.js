/**
 * LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO POR LA EMPRESA
 * ============================================================================
 *
 * Lo que se verifica acá:
 *
 * - La versión y la huella del Anexo de Encargo salen del MANIFIESTO, y el
 *   archivo del servidor tiene que tener esa misma huella. Si no, no se abre
 *   ninguna suscripción (es un fallo de despliegue, no un error de la Empresa).
 * - El enlace es de un solo uso, con caducidad, y en la base solo vive su
 *   huella.
 * - El código de verificación sale por la cuenta de K+AIR (nunca por la de la
 *   Empresa) y se valida con el ámbito de la Empresa.
 * - Sin el código correcto, sin la aceptación expresa o sin los cinco datos
 *   del §11, NO se suscribe.
 * - Al suscribir queda: versión, huella, evidencia (fecha, correo, IP,
 *   navegador, los cinco datos del §11) y el rastro append-only.
 * - La fecha del Anexo de Encargo queda en la ficha de la Empresa, con el
 *   rastro de la ficha.
 * - LO MÁS IMPORTANTE: suscribir NO ejecuta el contrato. El instrumento es
 *   bilateral: sin la contrafirma de K+AIR, `contrafirmado_at` sigue vacío y
 *   el manifiesto no puede decir "firmado".
 * - El enlace no se puede reutilizar y el rastro no se puede alterar.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const db = require('../src/db/connection');
const anexoEncargo = require('../src/services/anexoEncargo');
const empresaService = require('../src/services/empresa');
const mailer = require('../src/services/mailer');
const actaEncargo = require('../src/services/actaEncargo');
const storage = require('../src/services/storage');
const { resetDb } = require('./helpers');

const ID_EMPRESA = '900555777';
const CORREO_FIRMANTE = 'representante@empresa-prueba.test';

// El SEGUNDO CANAL del código de verificación: tiene que ser distinto del
// buzón que recibe el enlace (artículo 4 del Decreto 2364).
const CANAL_CODIGO = 'segundo-canal@empresa-prueba.test';
// Cómo lo confirmó K+AIR con la Empresa: queda escrito en el registro.
const CONFIRMACION_CANAL = 'Confirmado por llamada de prueba';
// Quién firma: su documento y la calidad con la que firma.
const REPRESENTANTE = { documento: '900123456', calidad: 'REPRESENTANTE_LEGAL' };

// Los cinco datos del §11, tal como los declara la Empresa.
const DATOS_S11 = {
  razon_social: 'EMPRESA DE PRUEBA SAS',
  nit: '900555777-1',
  domicilio: 'Calle 47 # 43-57 Piso 2, Barranquilla',
  correo: CORREO_FIRMANTE,
  representante: 'PERSONA DE PRUEBA',
};

// ===========================================================================
// HELPERS
// ===========================================================================

function sembrarEmpresa(id = ID_EMPRESA) {
  db.prepare(`
    INSERT INTO gh_firma_empresas
      (id_empresa, razon_social, nit, domicilio, canal_pqrs,
       responsable_tratamiento_correo, representante_legal, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, 'EMPRESA DE PRUEBA SAS', '900555777-1',
    'Calle 47 # 43-57 Piso 2, Barranquilla', 'pqrs@empresa-prueba.test',
    'datos@empresa-prueba.test', 'PERSONA DE PRUEBA');
  return id;
}

/** El último correo de la bandeja de pruebas del tipo pedido. */
function ultimoCorreo(tipo) {
  const inbox = mailer.getDevInbox();
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].tipo === tipo) return inbox[i];
  }
  return null;
}

/** El código de verificación que salió en el último correo de código. */
function ultimoCodigo() {
  const c = ultimoCorreo('anexo_encargo');
  assert.ok(c, 'tiene que haber salido un correo con el código de verificación');
  assert.match(c.otp, /^\d{6}$/);
  return c.otp;
}

// ===========================================================================
// EL TEXTO Y SU HUELLA
// ===========================================================================

test('la versión y la huella del Anexo de Encargo salen del manifiesto, no del código', () => {
  resetDb();
  const m = anexoEncargo.modeloVigente();
  const manifiesto = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'legal-readiness.json'), 'utf8'));
  assert.equal(m.version, manifiesto.anexo_encargo.version,
    'la versión es la del manifiesto: el Anexo de Encargo se versiona por fecha');
  assert.equal(m.hash, manifiesto.anexo_encargo.hash);
});

test('la huella es la de los BYTES del archivo, y el archivo es el que declara el manifiesto', () => {
  resetDb();
  const m = anexoEncargo.modeloVigente();
  const bytes = fs.readFileSync(anexoEncargo.RUTA_MODELO);
  const esperado = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(m.hash_archivo, esperado,
    'la huella del archivo tiene que ser la de sus bytes, no una declarada a mano');
  assert.equal(m.bytes, bytes.length);
  assert.equal(m.coincide, true,
    'el texto del servidor tiene que ser el que declara el manifiesto');
});

test('si el archivo del servidor NO es el que declara el manifiesto, no se abre suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  // Un manifiesto que declara otra huella: es lo que pasa si se despliega el
  // texto sin actualizar el manifiesto (o al revés).
  const manifiestoDesalineado = {
    anexo_encargo: { version: '2026-11-06', hash: 'a'.repeat(64) },
  };

  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: CANAL_CODIGO,
      canal_codigo_confirmacion: CONFIRMACION_CANAL,
    }, { actor: 'admin' }, { manifiesto: manifiestoDesalineado }),
    (e) => e.statusCode === 503 && e.code === 'ANEXO_ENCARGO_NO_DISPONIBLE',
    'con dos textos distintos no se puede abrir una suscripción',
  );

  const filas = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').all();
  assert.equal(filas.length, 0, 'no quedó ninguna suscripción a medias');
});

test('si el manifiesto no declara versión y huella, no se abre suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  await assert.rejects(
    () => anexoEncargo.crearSuscripcion(ID_EMPRESA, {
      correo_firmante: CORREO_FIRMANTE,
      canal_codigo: CANAL_CODIGO,
      canal_codigo_confirmacion: CONFIRMACION_CANAL,
    }, { actor: 'admin' }, { manifiesto: { anexo_encargo: { version: '2026-11-06' } } }),
    (e) => e.statusCode === 503 && e.code === 'ANEXO_ENCARGO_NO_DISPONIBLE',
    'sin huella declarada no hay contra qué comparar',
  );
});

test('el §12 NO exige firma autógrafa: el canal digital es el que el propio texto describe', () => {
  const plano = fs.readFileSync(anexoEncargo.RUTA_MODELO, 'utf8')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Ntilde;/g, 'Ñ').replace(/&mdash;/g, '—').replace(/&sect;/g, '§');

  // EL ALCANCE DEL CHEQUEO ES EL §12, NO TODO EL DOCUMENTO.
  // ----------------------------------------------------
  // El Anexo de Encargo SÍ menciona la "firma autógrafa sobre papel" en la
  // sección 4: es la regla del numeral 8.4(a) del Acuerdo (cuando el código
  // OTP cae en un dominio que la Empresa puede leer, se le ofrece al
  // TRABAJADOR la firma autógrafa). Eso es la firma del documento laboral del
  // Trabajador, NO la firma de este Anexo. Un chequeo sobre todo el documento
  // caería por un motivo equivocado: lo que tiene que ser digital es la
  // firma de las PARTES de este contrato.
  const i = plano.indexOf('<h2>12. Firmas</h2>');
  assert.ok(i > 0, 'el Anexo de Encargo tiene que tener la sección 12 de Firmas');
  const seccion12 = plano.slice(i);

  assert.ok(!/aut[oó]grafa/i.test(seccion12),
    'el §12 no puede exigir firma autógrafa: el flujo digital lo suspendería');
  assert.ok(!/manuscrita/i.test(seccion12));
  assert.ok(!/notarial/i.test(seccion12));

  // Y la prueba POSITIVA: el §12 dice que la firma de la Empresa queda
  // registrada en el servicio con la fecha (y con la huella del texto
  // canónico). Eso es exactamente lo que hace este flujo.
  assert.ok(/anexo_encargo_firmado_at/.test(seccion12),
    'el §12 tiene que decir que la firma queda registrada con la fecha en el servicio');
  assert.ok(/huella SHA-256/.test(seccion12),
    'el §12 tiene que decir que la huella del texto canónico queda en el registro');
});

// ===========================================================================
// ABRIR LA SUSCRIPCIÓN
// ===========================================================================

test('crearSuscripcion abre la suscripción, manda el enlace y devuelve la huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
    nombre_firmante: 'PERSONA DE PRUEBA',
    cargo_firmante: 'Representante legal',
  }, { actor: 'admin', ip: '10.0.0.1', user_agent: 'test' });

  assert.match(r.url, /\/anexo-encargo\/[A-Za-z0-9_-]+$/,
    'el enlace tiene que llevar el token');
  assert.equal(r.version, '2026-11-06');
  assert.equal(r.hash, anexoEncargo.modeloVigente().hash);

  // El correo de invitación SALE, y lo manda K+AIR.
  const correo = ultimoCorreo('anexo_encargo_invitacion');
  assert.ok(correo, 'tiene que haber salido la invitación');
  assert.equal(correo.to, CORREO_FIRMANTE);
  assert.ok(correo.body.includes(r.token),
    'el correo tiene que llevar el enlace con el token');
  assert.ok(correo.body.includes(r.hash),
    'el correo tiene que declarar la huella del texto que se suscribe');
  assert.match(correo.subject, /Anexo de Encargo/);
});

test('la base NO guarda el enlace en claro: solo su huella', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.ok(fila);
  assert.notEqual(fila.token_hash, r.token,
    'el token en claro no puede estar en la base');
  assert.match(fila.token_hash, /^[0-9a-f]{64}$/i,
    'lo que se guarda es una huella');
  assert.ok(!JSON.stringify(fila).includes(r.token),
    'el token no puede aparecer en ninguna columna de la fila');
});

test('un enlace que no existe se rechaza con ENLACE_NO_VALIDO', () => {
  resetDb();
  assert.throws(
    () => anexoEncargo.contextoPublico('este-token-no-existe', '1.1.1.1', 'test'),
    (e) => e.statusCode === 404 && e.code === 'ENLACE_NO_VALIDO',
  );
});

test('el contexto público enmascara el correo y no expone el enlace', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  const ctx = anexoEncargo.contextoPublico(r.token, '1.1.1.1', 'navegador');
  assert.equal(ctx.empresa, 'EMPRESA DE PRUEBA SAS');
  assert.equal(ctx.version, '2026-11-06');
  assert.ok(ctx.correo_firmante.includes('***'),
    'el correo va enmascarado');
  assert.ok(!ctx.correo_firmante.includes('representante'),
    'el correo no puede salir entero');
  assert.equal(ctx.token, undefined);
  assert.equal(ctx.token_hash, undefined);
  assert.equal(ctx.otp_hash, undefined);
  assert.equal(ctx.vigente, true,
    'el texto de la fila es el que está en el servidor: la suscripción sirve');
});

test('el contexto público lleva los cinco datos del §11 prellenados con la ficha', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  const ctx = anexoEncargo.contextoPublico(r.token, '1.1.1.1', 'navegador');
  assert.deepEqual(Object.keys(ctx.datos_empresa).sort(),
    ['correo', 'domicilio', 'nit', 'razon_social', 'representante'],
    'los datos del §11 son cinco');
  assert.equal(ctx.datos_empresa.razon_social, 'EMPRESA DE PRUEBA SAS');
  assert.equal(ctx.datos_empresa.nit, '900555777-1');
  assert.equal(ctx.datos_empresa.domicilio, 'Calle 47 # 43-57 Piso 2, Barranquilla');
  assert.equal(ctx.datos_empresa.representante, 'PERSONA DE PRUEBA');
  assert.equal(ctx.datos_empresa.correo, 'datos@empresa-prueba.test',
    'el correo se prellena con el de la responsable del tratamiento');
});

// ===========================================================================
// EL CÓDIGO DE VERIFICACIÓN
// ===========================================================================

test('el código se manda al SEGUNDO CANAL, no al buzón del enlace, y sale por K+AIR', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  const res = await anexoEncargo.solicitarCodigo(r.token, { ip: '1.1.1.1', user_agent: 'navegador' });
  assert.ok(res.expira_en_segundos > 0);

  const correo = ultimoCorreo('anexo_encargo');
  assert.ok(correo, 'tiene que haber salido el correo con el código');
  assert.equal(correo.to, CANAL_CODIGO,
    'el código sale por el segundo canal, NO por el buzón que recibió el enlace');
  assert.notEqual(correo.to, CORREO_FIRMANTE,
    'si el código llegara al mismo buzón del enlace, el enlace bastaría por sí solo');
  assert.match(correo.subject, /Anexo de Encargo/);
  assert.ok(correo.body.includes('Anexo de Encargo'),
    'el correo del código tiene que decir de qué instrumento es');
  // El remitente es la cuenta de K+AIR, NO la de la Empresa.
  assert.equal(correo.remitente.origen, 'kair',
    'el correo del código lo manda K+AIR');
  assert.ok(correo.remitente.from_email.includes('@'),
    'el remitente tiene que ser una dirección de correo');
});

test('sin código no se puede suscribir', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  await assert.rejects(
    () => anexoEncargo.suscribir(r.token, { otp: '123456', acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {}),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_NO_SOLICITADO',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null);
});

test('un código incorrecto no firma y deja intento registrado', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  const codigo = ultimoCodigo();
  const malo = codigo === '000000' ? '111111' : '000000';

  await assert.rejects(
    () => anexoEncargo.suscribir(r.token, { otp: malo, acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {}),
    (e) => e.statusCode === 400 && e.code === 'CODIGO_INVALIDO',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null,
    'un código incorrecto no puede dejar la suscripción a medias');

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.otp_intentos, 1);
  assert.notEqual(fila.estado, 'FIRMADA');
});

test('sin la aceptación expresa tampoco se firma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  await assert.rejects(
    () => anexoEncargo.suscribir(r.token,
      { otp: ultimoCodigo(), acepta: false, datos_empresa: DATOS_S11 }, {}),
    (e) => e.statusCode === 400 && e.code === 'ACEPTACION_REQUERIDA',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null);
});

test('sin los CINCO datos del §11 tampoco se firma', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  // El texto canónico se suscribe con sus huecos, pero la Empresa tiene que
  // decir quién es: sin el NIT no hay un Anexo de Encargo identificable.
  for (const clave of Object.keys(DATOS_S11)) {
    const incompletos = Object.assign({}, DATOS_S11);
    delete incompletos[clave];
    await assert.rejects(
      () => anexoEncargo.suscribir(r.token,
        { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: incompletos , representante: REPRESENTANTE }, {}),
      (e) => e.statusCode === 400 && e.code === 'DATOS_S11_INCOMPLETOS',
      'sin ' + clave + ' no se puede suspender',
    );
  }
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null);
});

// ===========================================================================
// LA FIRMA DE LA EMPRESA (FASE 1)
// ===========================================================================

test('con el código correcto la Empresa suscribe y queda registrado con versión, huella y evidencia', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
    nombre_firmante: 'PERSONA DE PRUEBA',
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  const res = await anexoEncargo.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  assert.equal(res.firmado, true);
  assert.equal(res.version, '2026-11-06');
  assert.equal(res.hash, anexoEncargo.modeloVigente().hash);

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at,
    'la fecha de la suscripción tiene que quedar en la ficha');
  assert.equal(empresa.anexo_encargo_firmado_at, null,
    'la suscripción NO habilita a la Empresa: la fecha de firma solo la pone la '
    + 'contrafirma de K+AIR, que es otro acto');

  const evidencia = JSON.parse(res.evidencia ? JSON.stringify(res.evidencia) : '{}');
  assert.equal(evidencia.fuente, 'enlace_suscripcion');
  assert.equal(evidencia.version, '2026-11-06');
  assert.equal(evidencia.hash, anexoEncargo.modeloVigente().hash);
  assert.equal(evidencia.correo_firmante, CORREO_FIRMANTE);
  assert.equal(evidencia.canal_codigo, 'se***@empresa-prueba.test',
    'la evidencia lleva el segundo canal enmascarado');
  assert.ok(evidencia.aceptacion_hash,
    'la evidencia lleva la huella de los textos que la Empresa aceptó');
  assert.ok(evidencia.aceptacion_tratamiento_hash,
    'la evidencia lleva la huella del texto de tratamiento de datos');
  assert.equal(evidencia.representante.calidad, 'REPRESENTANTE_LEGAL');
  assert.equal(evidencia.representante.documento_ultimos4, '3456');
  assert.equal(evidencia.ip, '203.0.113.9');
  assert.equal(evidencia.user_agent, 'Navegador/1.0');
  assert.ok(evidencia.codigo_enviado_at);
  assert.ok(evidencia.codigo_verificado_at);
});

test('los cinco datos del §11 quedan en la fila, en la evidencia y con lo que declaró la Empresa', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  // La Empresa CORRIGE un dato de la ficha: lo que ella declara es lo que
  // queda (precedente del Anexo de Nube: los datos de la Empresa no se
  // diligencian en el modelo).
  const declarados = Object.assign({}, DATOS_S11, {
    domicilio: 'Carrera 43 # 43-57, Edificio Norte, Barranquilla',
  });

  const res = await anexoEncargo.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: declarados , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  const enFila = JSON.parse(fila.datos_empresa);
  assert.equal(enFila.domicilio, declarados.domicilio,
    'la fila guarda lo que declaró la Empresa, no lo que estaba en la ficha');
  assert.equal(enFila.nit, DATOS_S11.nit);

  const evidencia = JSON.parse(fila.evidencia);
  assert.deepEqual(evidencia.datos_empresa, declarados,
    'la evidencia lleva los mismos datos que la fila');
  assert.equal(res.evidencia.datos_empresa.domicilio, declarados.domicilio);
});

test('la fecha del Anexo queda en la ficha de la Empresa CON el rastro de la ficha', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  const antes = db.prepare(
    'SELECT COUNT(*) AS c FROM gh_firma_empresas_auditoria WHERE id_empresa = ?',
  ).get(ID_EMPRESA).c;

  await anexoEncargo.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at,
    'la fecha de la suscripción del Anexo de Encargo tiene que quedar en la ficha');

  const renglones = db.prepare(
    'SELECT * FROM gh_firma_empresas_auditoria WHERE id_empresa = ? AND campo = ?',
  ).all(ID_EMPRESA, 'anexo_encargo_suscrito_at');
  assert.ok(renglones.length > antes,
    'el cambio de la fecha tiene que quedar en el rastro de la ficha');
  const ultimo = renglones[renglones.length - 1];
  assert.equal(ultimo.valor_anterior, null);
  assert.equal(ultimo.valor_nuevo, empresa.anexo_encargo_suscrito_at);
  assert.equal(ultimo.id_actor, 'empresa:' + ID_EMPRESA);
  assert.ok(ultimo.motivo && ultimo.motivo.length > 0,
    'el rastro tiene que decir por qué se registró');
});

test('suscribir NO ejecuta el contrato: la contrafirma de K+AIR va aparte', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  const res = await anexoEncargo.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.equal(fila.estado, 'FIRMADA',
    'el estado FIRMADA es el de la fase 1: la Empresa suscribió');
  assert.equal(fila.contrafirmado_at, null,
    'sin contrafirma el instrumento NO está ejecutado');
  assert.equal(res.contrafirmado, false);

  const ctx = anexoEncargo.contextoPublico(r.token, '1.1.1.1', 'navegador');
  assert.equal(ctx.contrafirmado_at, null,
    'la pantalla tampoco puede dar por ejecutada la suscripción');
});

test('el enlace es de un solo uso: firmado, no se pide otro código', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});
  await anexoEncargo.suscribir(r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {});

  await assert.rejects(
    () => anexoEncargo.solicitarCodigo(r.token, {}),
    (e) => e.code === 'YA_SUSCRITO',
  );

  // Reintento de quien ya firmó: no vuelve a registrar nada.
  const otra = await anexoEncargo.suscribir(r.token,
    { otp: '000000', acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {});
  assert.equal(otra.ya_firmada, true);
});

test('el rastro de la suscripción queda escrito y en orden', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});
  await anexoEncargo.suscribir(r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' });

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_encargo_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((x) => x.evento);

  assert.ok(eventos.includes('SUSCRIPCION_CREADA'));
  assert.ok(eventos.includes('CODIGO_ENVIADO'));
  assert.ok(eventos.includes('SUSCRIPCION_FIRMADA'));
  assert.ok(eventos.indexOf('SUSCRIPCION_CREADA') < eventos.indexOf('CODIGO_ENVIADO'));
  assert.ok(eventos.indexOf('CODIGO_ENVIADO') < eventos.indexOf('SUSCRIPCION_FIRMADA'));
});

test('el rastro de la suscripción es append-only: el trigger muerde de verdad', () => {
  resetDb();
  const ruta = path.join(__dirname, '..', 'src', 'db', 'schema',
    '057_anexo_encargo_eventos_append_only.sql');
  const sql = fs.readFileSync(ruta, 'utf8');
  const D = require('better-sqlite3');
  const memoria = new D(':memory:');
  memoria.exec(`CREATE TABLE gh_firma_anexo_encargo_eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_suscripcion INTEGER, id_empresa TEXT, evento TEXT, detalle TEXT,
    ip TEXT, user_agent TEXT, fecha_hora DEFAULT (datetime('now')));`);
  memoria.exec(sql);
  memoria.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
    (id_suscripcion, id_empresa, evento) VALUES (1, 'X', 'PRUEBA')`).run();

  assert.throws(() => memoria.prepare(
    'UPDATE gh_firma_anexo_encargo_eventos SET evento = ? WHERE id = 1').run('OTRA'),
  /append-only/);
  assert.throws(() => memoria.prepare(
    'DELETE FROM gh_firma_anexo_encargo_eventos WHERE id = 1').run(),
  /append-only/);
  memoria.close();
});

test('no se puede suspender un texto distinto del que está en el archivo', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  // Se falsea la huella en la fila: la suscripción tiene que fallar.
  // OJO: no se usa `WHERE id = 1` porque el contador de la tabla no se
  // reinicia entre tests; se toma la fila de esa Empresa.
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET hash_texto = ?
    WHERE id_empresa = ? AND estado != 'FIRMADA'`)
    .run('a'.repeat(64), ID_EMPRESA);

  await assert.rejects(
    () => anexoEncargo.suscribir(r.token,
      { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {}),
    (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
    'no se puede suspender un texto que no es el del archivo',
  );
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null);
});

test('si el texto del servidor cambia, no se firma: hay que abrir otra suscripción', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  // El texto del servidor cambia. Se usa una COPIA temporal con un byte
  // distinto, para no tocar el archivo legal del repo.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anexo-encargo-'));
  const copia = path.join(dir, 'anexo-encargo.html');
  fs.writeFileSync(copia,
    fs.readFileSync(anexoEncargo.RUTA_MODELO).toString('utf8') + '\n<!-- cambio -->');

  try {
    await assert.rejects(
      () => anexoEncargo.suscribir(r.token,
        { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {},
        { rutaModelo: copia }),
      (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
      'la Empresa no puede firmar un texto que ya no es el que se le mostró',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null,
    'un texto que cambió no puede dejar la suscripción a medias');

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_encargo_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((x) => x.evento);
  assert.ok(eventos.includes('TEXTO_MODIFICADO'),
    'el cambio de texto queda en el rastro');
});

test('si el texto ya cambió, no se manda un código: no hay nada que firmar', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  // Se falsea la huella: el texto del servidor ya no es el de la suscripción.
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET hash_texto = ? WHERE id_empresa = ? AND estado != 'FIRMADA'`)
    .run('a'.repeat(64), ID_EMPRESA);

  await assert.rejects(
    () => anexoEncargo.solicitarCodigo(r.token, {}),
    (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
    'no se pide un código para una suscripción cuyo texto ya no existe',
  );
  assert.equal(ultimoCorreo('anexo_encargo'), null,
    'no se mandó ningún código');
});

test('si el correo del código no sale, se dice con claridad y queda en el rastro', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });

  // Se simula que el SMTP no responde.
  const original = mailer.sendOTP;
  mailer.sendOTP = async () => { throw new Error('SMTP no responde'); };
  try {
    await assert.rejects(
      () => anexoEncargo.solicitarCodigo(r.token, {}),
      (e) => e.statusCode === 502 && e.code === 'ENVIO_FALLIDO',
      'un fallo de correo tiene que ser un error entendible, no un 500',
    );
  } finally {
    mailer.sendOTP = original;
  }

  const eventos = db.prepare(
    'SELECT evento FROM gh_firma_anexo_encargo_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA).map((x) => x.evento);
  assert.ok(eventos.includes('ENVIO_FALLIDO'),
    'el fallo de envío queda en el rastro');
});

test('anular una suscripción exige el motivo, deja el rastro y mata el enlace', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  const fila = db.prepare(
    'SELECT id FROM gh_firma_anexo_encargo_suscripciones WHERE id_empresa = ?',
  ).get(ID_EMPRESA);

  // Sin motivo, no se anula: una baja tiene que decir por qué.
  assert.throws(
    () => anexoEncargo.anularSuscripcion(ID_EMPRESA, fila.id, { actor: 'admin' }),
    (e) => e.statusCode === 400 && e.code === 'MOTIVO_REQUERIDO',
  );

  const res = anexoEncargo.anularSuscripcion(ID_EMPRESA, fila.id, {
    actor: 'admin', motivo: 'Se mandó al correo equivocado',
  });
  assert.equal(res.anulada, true);

  // Y el enlace queda muerto.
  assert.throws(
    () => anexoEncargo.contextoPublico(r.token, '1.1.1.1', 'test'),
    (e) => e.statusCode === 410 && e.code === 'ENLACE_ANULADO',
  );

  const eventos = db.prepare(
    'SELECT evento, detalle FROM gh_firma_anexo_encargo_eventos WHERE id_empresa = ? ORDER BY id',
  ).all(ID_EMPRESA);
  const anul = eventos.find((e) => e.evento === 'SUSCRIPCION_ANULADA');
  assert.ok(anul, 'la anulación queda en el rastro');
  assert.ok(anul.detalle.includes('correo equivocado'),
    'el rastro dice por qué se anuló');
});

test('no se pisa una suscripción de otro texto: la Empresa ya firmó otra versión', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  // Primera suscripción: se firma.
  const r1 = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r1.token, {});
  await anexoEncargo.suscribir(r1.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {});

  // Segunda suscripción, de OTRO texto: no se puede volver a firmar encima.
  const r2 = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r2.token, {});
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET hash_texto = ? WHERE id_empresa = ? AND estado != 'FIRMADA'`)
    .run('b'.repeat(64), ID_EMPRESA);

  await assert.rejects(
    () => anexoEncargo.suscribir(r2.token,
      { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {}),
    (e) => e.statusCode === 409 && e.code === 'TEXTO_MODIFICADO',
    'una suscripción de otro texto no puede firmarse encima de la anterior',
  );

  // Y la fecha que ya estaba NO se tocó.
  const empresa = empresaService.getById(ID_EMPRESA);
  assert.ok(empresa.anexo_encargo_suscrito_at);
  assert.equal(empresa.anexo_encargo_firmado_at, null,
    'suscribirse no es firmar: la contrafirma de K+AIR va aparte');
});

// ===========================================================================
// EL ACTA DE SUSCRIPCIÓN
// ===========================================================================

test('suscribir genera el acta y su huella queda en la evidencia', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
    nombre_firmante: 'PERSONA DE PRUEBA',
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  const res = await anexoEncargo.suscribir(
    r.token,
    { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE },
    { ip: '203.0.113.9', user_agent: 'Navegador/1.0' },
  );

  // El acta tiene su propia huella, y es la de SUS bytes.
  assert.ok(res.acta, 'al suscribir tiene que quedar el acta');
  assert.match(res.acta.hash, /^[0-9a-f]{64}$/);
  assert.ok(res.acta.bytes > 0);

  const ruta = actaEncargo.rutaActa(res.acta.archivo);
  assert.ok(fs.existsSync(ruta), 'el acta tiene que quedar en el disco');
  const bytes = fs.readFileSync(ruta);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, res.acta.hash,
    'la huella del acta tiene que ser la de los bytes que quedaron en el disco');
  assert.equal(bytes.length, res.acta.bytes);

  // Y la huella queda en la evidencia de la fila.
  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  const evidencia = JSON.parse(fila.evidencia);
  assert.equal(evidencia.acta_hash, res.acta.hash);
  assert.equal(evidencia.acta_archivo, res.acta.archivo);
  assert.equal(evidencia.acta_bytes, res.acta.bytes);

  // La evidencia NO lleva la ruta absoluta: se copia al manifiesto legal, y
  // una ruta del servidor no puede aparecer en un documento que sale de él.
  assert.ok(!JSON.stringify(evidencia).includes(storage.PATHS.root),
    'la evidencia no puede filtrar la raíz del servidor');
  assert.ok(!evidencia.acta_archivo.includes('/'), 'el nombre del acta es un nombre, no una ruta');

  // El rastro dice que el acta se generó.
  const evento = db.prepare(
    'SELECT * FROM gh_firma_anexo_encargo_eventos WHERE evento = ?').get('ACTA_GENERADA');
  assert.ok(evento, 'el rastro tiene que decir que el acta se generó');
  assert.ok(evento.detalle.includes(res.acta.hash));

  fs.unlinkSync(ruta);
});

test('si el acta no se puede generar, la suscripción NO se cierra', async () => {
  resetDb();
  mailer.clearDevInbox();
  sembrarEmpresa();

  const r = await anexoEncargo.crearSuscripcion(ID_EMPRESA, {
    correo_firmante: CORREO_FIRMANTE,
    canal_codigo: CANAL_CODIGO,
    canal_codigo_confirmacion: CONFIRMACION_CANAL,
  }, { actor: 'admin' });
  await anexoEncargo.solicitarCodigo(r.token, {});

  // El acta no se puede generar (lo que pasa si pdf-lib falla o si el disco
  // está lleno). La suscripción no se cierra: es preferible que la Empresa
  // reintente a que quede una suscripción sin el documento que la acredita.
  const original = actaEncargo.generarActa;
  actaEncargo.generarActa = async () => { throw new Error('disco lleno (simulado)'); };
  try {
    await assert.rejects(
      () => anexoEncargo.suscribir(r.token,
        { otp: ultimoCodigo(), acepta: true, acepta_tratamiento: true, datos_empresa: DATOS_S11 , representante: REPRESENTANTE }, {}),
      (e) => e.statusCode === 500 && e.code === 'ACTA_NO_GENERADA',
    );
  } finally {
    actaEncargo.generarActa = original;
  }

  // La fila NO quedó firmada y la ficha de la Empresa NO se tocó.
  const fila = db.prepare('SELECT * FROM gh_firma_anexo_encargo_suscripciones').get();
  assert.notEqual(fila.estado, 'FIRMADA', 'la suscripción no puede quedar firmada sin acta');
  assert.equal(fila.firmado_at, null);
  assert.equal(empresaService.getById(ID_EMPRESA).anexo_encargo_firmado_at, null,
    'la fecha de la ficha no puede quedar si la suscripción no se cerró');

  // Y el fallo queda en el rastro.
  const evento = db.prepare(
    'SELECT * FROM gh_firma_anexo_encargo_eventos WHERE evento = ?').get('ACTA_FALLIDA');
  assert.ok(evento, 'el fallo tiene que quedar en el rastro');
});
