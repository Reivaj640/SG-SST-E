/**
 * D-2 · EL OTP (DATO DE CREACIÓN) VA A UN MEDIO PERSONAL
 * =====================================================
 *
 * EL PROBLEMA
 * -----------
 * `correo_verificacion` cumple dos papeles: a dónde va la INVITACIÓN (con el
 * token) y a dónde va el OTP (el dato de creación de la firma). Y la app de
 * escritorio lo precarga con el correo del trabajador en el registro de la
 * Empresa: en la práctica, el código le llega a un buzón que la Empresa puede
 * leer.
 *
 * El 2.2.2.47.4 num. 1: "los datos de creación de la firma, en el contexto en
 * que son utilizados, corresponden exclusivamente al firmante".
 *
 * LA DECISIÓN (owner, 2026-10-20)
 * -------------------------------
 * Separar los dos canales:
 *
 *   - La INVITACIÓN sigue yendo al contacto registrado por la Empresa. En el
 *     contexto de uso no es un factor: sin el OTP no se firma.
 *   - El OTP va a un medio PERSONAL que declara el propio Trabajador.
 *
 * Y el rechazo (D2) queda **APAGADO** (`FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`):
 * se enciende cuando exista la 9A (la firma en papel), porque sin esa salida
 * exigir un medio personal sería una barrera de acceso al empleo (2.2.1.1.11).
 *
 * Lo que estos tests fijan:
 *   1. El OTP va al medio declarado (o, si no hay, al contacto registrado).
 *   2. La invitación NO cambia de destino.
 *   3. El medio declarado queda CONGELADO en la fila.
 *   4. Los dominios corporativos: los explícitos + los derivados de los
 *      canales de la empresa.
 *   5. Con el rechazo encendido, un buzón corporativo da 400 con el texto
 *      del 3.7(a) al lado.
 *   6. Con el rechazo apagado, el caso corporativo queda en el log como WARN
 *      (de ahí sale el número del inventario).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const config = require('../src/config');
const { signRequestBody } = require('../src/schemas');
const empresaService = require('../src/services/empresa');
const mediosService = require('../src/services/medios');
const medioPersonal = require('../src/services/medioPersonal');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion, capturarLogs,
} = require('./helpers');

const EMPRESA = '900123456';
const DOMINIO_CORP = 'empresa-corp.com';
const CORREO_CORP = 'trabajador@' + DOMINIO_CORP;
const CORREO_EMPRESA = 'trabajador@empresa-corp.com';
const CORREO_PERSONAL = 'mipersonal@ejemplo.net';

function registrarEmpresa({ dominios = null } = {}) {
  db.prepare('DELETE FROM gh_firma_empresas WHERE id_empresa = ?').run(EMPRESA);
  empresaService.create({
    id_empresa: EMPRESA,
    razon_social: 'Empresa Corporativa de Prueba S.A.S.',
    nit: EMPRESA,
    canal_pqrs: 'rrhh@' + DOMINIO_CORP,
    canal_incidentes: 'seguridad@' + DOMINIO_CORP,
    responsable_tratamiento_correo: 'datos@' + DOMINIO_CORP,
    canal_solicitud_copia: 'copias@' + DOMINIO_CORP,
    plazo_retencion: '5 anos',
    plazo_retencion_dias: 1825,
    ...(dominios ? { dominios_corporativos: dominios } : {}),
  });
  // D-03: sin Anexo de Encargo firmado, la empresa no puede pedir firmas.
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

/** Crea la solicitud con el correo de contacto que se le pida. */
function crearSolicitud(correo) {
  return createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    metadata: JSON.stringify({ correo }),
  });
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
  mailer.clearDevInbox();
}

// ===========================================================================
// 1. El OTP va al medio personal
// ===========================================================================

test('D-2 · el OTP va al medio personal que declara el Trabajador', async () => {
  limpiar();
  registrarEmpresa();
  const { token } = await crearSolicitud(CORREO_CORP);

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      correo_otp: CORREO_PERSONAL,
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.correo_destino_enmascarado, 'mipe******@ejemplo.net',
    'el código fue al medio personal, no al buzón de la empresa');

  const inbox = mailer.getDevInbox();
  const conOtp = inbox.find((m) => m.tipo === 'signature');
  assert.ok(conOtp, 'se envió un OTP');
  assert.equal(conOtp.to, CORREO_PERSONAL);
});

test('D-2 · sin medio declarado, el OTP va al contacto registrado (lo de hoy)', async () => {
  limpiar();
  registrarEmpresa();
  const { token } = await crearSolicitud('personal@ejemplo.net');

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200);
  const inbox = mailer.getDevInbox();
  const conOtp = inbox.find((m) => m.tipo === 'signature');
  assert.equal(conOtp.to, 'personal@ejemplo.net');
});

test('D-2 · la EMPRESA registra el medio personal y el OTP va ahí (opción B)', async () => {
  // Decisión del owner (2026-10-20): QUIÉN registra el medio personal es la
  // Empresa, que es quien tiene la ficha del trabajador. El mini-app lo deja
  // igual (si la Empresa no lo tiene, el Trabajador lo declara al
  // identificarse), pero el camino normal es este.
  //
  // Decisión 1.a (2026-10-27): la Empresa lo obtiene del candidato verbalmente
  // en la contratación y lo registra; elTrabajador lo CONFIRMA en la pantalla
  // de firma, porque la garantía del 3.7(a) es del Trabajador: que ese buzón
  // es de su uso exclusivo y que la Empresa no lo administra. Sin esa
  // confirmación el servidor NO manda el código a ese buzón (422
  // MEDIO_OTP_CONFIRMACION_REQUERIDA).
  limpiar();
  const { token, signRequest } = await crearSolicitud({ correo: CORREO_EMPRESA });

  // La Empresa registra el medio personal al crear la solicitud.
  const creada = await createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    correo_verificacion: CORREO_EMPRESA,
    correo_otp: CORREO_PERSONAL,
    metadata: JSON.stringify({ correo: CORREO_EMPRESA }),
  });

  // El OTP va al medio registrado por la Empresa, no al contacto: el
  // Trabajador confirma la declaración y el código sale a ese buzón.
  const res = await request(makeApp())
    .post(`/api/sign/${creada.token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      medio_otp_confirmado: true,
      medio_otp_version: medioPersonal.DECLARACION_VERSION,
    })
    .timeout({ response: 5000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const inbox = mailer.getDevInbox();
  const conOtp = inbox.find((m) => m.tipo === 'signature');
  assert.ok(conOtp, 'se envó un OTP');
  assert.equal(conOtp.to, CORREO_PERSONAL,
    'el código va al medio personal, no al buzón de la empresa');

  // Y queda en el registro de medios, con origen TRABAJADOR_CONFIRMADO: lo
  // registró la Empresa, pero lo confirmó el Trabajador (decisión 1.a).
  const medios = mediosService.listarTodos(EMPRESA, creada.signRequest.id_trabajador);
  const declarado = medios.find((m) => m.tipo === 'CORREO_OTP');
  assert.ok(declarado, 'el medio registrado queda en el registro');
  assert.equal(declarado.origen, 'TRABAJADOR_CONFIRMADO');
  assert.equal(declarado.estado, 'PENDIENTE',
    'nace pendiente: hasta que el Trabajador no demuestre que lo controla, no');

  // Al verificar el código, el Trabajador demostró que lo controla.
  const dev = await request(makeApp())
    .post(`/api/sign/${creada.token}/verify-otp`)
    .send({ otp: res.body.devOtp })
    .timeout({ response: 5000 });
  assert.equal(dev.status, 200, JSON.stringify(dev.body));

  const activos = mediosService.listarActivos(EMPRESA, creada.signRequest.id_trabajador);
  assert.ok(activos.some((m) => m.tipo === 'CORREO_OTP'),
    'verificado el código, el medio queda activo y es un medio autorizado');
});

test('D-2 · la invitación NO cambia de destino', async () => {
  // La invitación lleva el token: sin el OTP no se firma, así que en el
  // contexto de uso no es un factor (decisión del owner, 2026-10-20).
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud(CORREO_CORP);

  await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      correo_otp: CORREO_PERSONAL,
    })
    .timeout({ response: 5000 });

  const fila = db.prepare(
    'SELECT correo_verificacion, correo_otp, metadata FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  // El contacto de la invitacion puede venir en la columna o en el metadata
  // (compatibilidad): lo que importa es que NO cambio.
  const contacto = fila.correo_verificacion
    || (JSON.parse(fila.metadata || '{}').correo || null);
  assert.equal(contacto, CORREO_CORP,
    'el contacto de la empresa sigue siendo el de la invitación');
  assert.equal(fila.correo_otp, CORREO_PERSONAL,
    'y el medio personal queda aparte, congelado en la fila');
});

test('D-2 · el medio declarado queda congelado', async () => {
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud(CORREO_CORP);

  // Se declara antes de identificarse.
  const decl = await request(makeApp())
    .post(`/api/sign/${token}/medio`)
    .send({ correo: CORREO_PERSONAL })
    .timeout({ response: 5000 });
  assert.equal(decl.status, 200);
  assert.equal(decl.body.correo_otp, CORREO_PERSONAL);
  assert.equal(decl.body.congelado, false);

  // Se identifica (sale el OTP).
  await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
    .timeout({ response: 5000 });

  // Ahora el medio NO se puede cambiar: el código ya viajó.
  const otra = await request(makeApp())
    .post(`/api/sign/${token}/medio`)
    .send({ correo: 'otro@ejemplo.net' })
    .timeout({ response: 5000 });
  assert.equal(otra.status, 200);
  assert.equal(otra.body.congelado, true);
  assert.equal(otra.body.correo_otp, CORREO_PERSONAL,
    'el medio congelado no se cambia');

  const fila = db.prepare(
    'SELECT correo_otp FROM gh_firmas_electronicas WHERE id_solicitud = ?'
  ).get(signRequest.id_solicitud);
  assert.equal(fila.correo_otp, CORREO_PERSONAL);
});

// ===========================================================================
// 2. Los dominios corporativos
// ===========================================================================

test('D-2 · los dominios corporativos son los declarados + los derivados', () => {
  limpiar();
  registrarEmpresa({ dominios: 'otro-corp.com' });

  const d = empresaService.dominiosCorporativos(EMPRESA);
  assert.ok(d.has(DOMINIO_CORP), 'derivado del canal de PQRS');
  assert.ok(d.has(DOMINIO_CORP), 'derivado del responsable de tratamiento');
  assert.ok(d.has('otro-corp.com'), 'declarado explícitamente');

  assert.equal(empresaService.esDominioCorporativo(CORREO_CORP, EMPRESA), true);
  assert.equal(empresaService.esDominioCorporativo(CORREO_PERSONAL, EMPRESA), false);
});

// ===========================================================================
// 3. El rechazo (D2) — apagado y encendido
// ===========================================================================

test('D-2 · con el rechazo APAGADO, un buzón corporativo pasa pero queda avisado', async () => {
  limpiar();
  registrarEmpresa();
  const antes = config.exigirMedioPersonalOtp;
  config.exigirMedioPersonalOtp = false;
  try {
    const { token } = await crearSolicitud(CORREO_CORP);
    const { objetos } = await capturarLogs(async () => {
      const res = await request(makeApp())
        .post(`/api/sign/${token}/identify`)
        .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
        .timeout({ response: 5000 });
      assert.equal(res.status, 200, 'con el rechazo apagado, no se rompe el flujo');
    });
    const aviso = objetos.find((o) => o.aviso === 'OTP_MEDIO_CORPORATIVO');
    assert.ok(aviso, 'pero el caso queda registrado: de ahí sale el inventario');
  } finally {
    config.exigirMedioPersonalOtp = antes;
  }
});

test('D-2 · con el rechazo ENCENDIDO, un buzón corporativo da 400 con el 3.7(a)', async () => {
  limpiar();
  registrarEmpresa();
  const antes = config.exigirMedioPersonalOtp;
  config.exigirMedioPersonalOtp = true;
  try {
    const { token } = await crearSolicitud(CORREO_CORP);

    // (a) El contacto registrado es corporativo.
    const r1 = await request(makeApp())
      .post(`/api/sign/${token}/identify`)
      .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
      .timeout({ response: 5000 });
    assert.equal(r1.status, 400);
    assert.equal(r1.body.error.code, 'MEDIO_OTP_CORPORATIVO');
    assert.match(r1.body.error.message, /3\.7\(a\)/,
      'el mensaje cita el numeral que lo sostiene');
    assert.match(r1.body.error.message, /7\.2/, 'y ofrece el papel');

    // (b) El medio declarado es corporativo.
    const { token: token2 } = await crearSolicitud('personal@ejemplo.net');
    const r2 = await request(makeApp())
      .post(`/api/sign/${token2}/identify`)
      .send({
        tipo_identificacion: 'CC',
        numero_documento: '1234567890',
        correo_otp: 'otro@' + DOMINIO_CORP,
      })
      .timeout({ response: 5000 });
    assert.equal(r2.status, 400);
    assert.equal(r2.body.error.code, 'MEDIO_OTP_CORPORATIVO');
  } finally {
    config.exigirMedioPersonalOtp = antes;
  }
});

test('D-2 · con el rechazo ENCENDIDO, un medio personal SI pasa', async () => {
  limpiar();
  registrarEmpresa();
  const antes = config.exigirMedioPersonalOtp;
  config.exigirMedioPersonalOtp = true;
  try {
    const { token } = await crearSolicitud(CORREO_CORP);
    const res = await request(makeApp())
      .post(`/api/sign/${token}/identify`)
      .send({
        tipo_identificacion: 'CC',
        numero_documento: '1234567890',
        correo_otp: CORREO_PERSONAL,
      })
      .timeout({ response: 5000 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  } finally {
    config.exigirMedioPersonalOtp = antes;
  }
});

// ===========================================================================
// 9. El schema de la ruta acepta el medio OTP de la app de escritorio
// ===========================================================================
test('D-2 · signRequestBody acepta correo_otp (mismo correo, vacío o inválido)', () => {
  const h = 'a'.repeat(64);
  const base = {
    id_documento: 'doc-d2',
    id_trabajador: '1234567890',
    id_empresa: EMPRESA,
    tipo_firma: 'remoto',
    agreement_version: 'v1.0',
    agreement_hash: h,
    document_hash: h,
    version_kair: '0.1.190-test',
    correo_verificacion: CORREO_PERSONAL,
  };

  // El caso de la app: un solo correo, el personal, para la invitación y el OTP.
  const mismo = signRequestBody.safeParse({ ...base, correo_otp: CORREO_PERSONAL });
  assert.equal(mismo.success, true, JSON.stringify(mismo.error && mismo.error.issues));

  // Compatibilidad con versiones anteriores que mandaban el campo vacío.
  const vacio = signRequestBody.safeParse({ ...base, correo_otp: '' });
  assert.equal(vacio.success, true, JSON.stringify(vacio.error && vacio.error.issues));

  // Las solicitudes legacy que no mandan el campo siguen pasando.
  const ausente = signRequestBody.safeParse(base);
  assert.equal(ausente.success, true, JSON.stringify(ausente.error && ausente.error.issues));

  // Un valor que no es correo no puede pasar.
  const invalido = signRequestBody.safeParse({ ...base, correo_otp: 'no-es-correo' });
  assert.equal(invalido.success, false);
});
