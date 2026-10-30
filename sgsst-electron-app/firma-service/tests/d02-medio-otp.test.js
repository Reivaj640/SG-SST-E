/**
 * D-2 · EL OTP (DATO DE CREACIÓN) VA A UN MEDIO PERSONAL CONFIRMADO
 * ================================================================
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
 * LAS REGLAS (v1.2, 27-oct-2026)
 * ------------------------------
 *   1. El OTP va al medio PERSONAL que el FIRMANTE confirma en la pantalla de
 *      firma. La confirmación es obligatoria para CUALQUIER destino: es la
 *      condición para que el código salga, no un aviso.
 *   2. El buzón corporativo se RECHAZA SIEMPRE (ya no hay interruptor): si el
 *      destino cae en un dominio que la Empresa puede leer, la solicitud se
 *      rechaza con 400 y el caso queda en la bitácora append-only con el aviso
 *      OTP_MEDIO_CORPORATIVO, que no se puede corregir ni alterar. SÍ se
 *      suprime: conforme al 8.6, dentro de la ventana de purga, y su supresión
 *      deja la lápida y el recibo del 3.6(g).
 *   3. Agotados los cinco (5) intentos, el OTP queda BLOQUEADO DE FORMA DURA:
 *      no se puede reenviar. La salida es una nueva solicitud.
 *
 * Lo que estos tests fijan:
 *   1. El OTP va al medio declarado (o, si no hay, al contacto registrado).
 *   2. La invitación NO cambia de destino.
 *   3. El medio declarado queda CONGELADO en la fila.
 *   4. Los dominios corporativos: los explícitos + los derivados de los
 *      canales de la empresa.
 *   5. El rechazo del buzón corporativo es incondicional, no manda el código
 *      y deja el aviso en el registro de operaciones.
 *   6. La confirmación del medio es obligatoria para cualquier destino.
 *   7. El bloqueo del OTP es duro: no se puede reenviar.
 *   8. Una fila heredada sin marca de envío no puede validar un código.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const db = require('../src/db/connection');
const { signRequestBody } = require('../src/schemas');
const empresaService = require('../src/services/empresa');
const mediosService = require('../src/services/medios');
const medioPersonal = require('../src/services/medioPersonal');
const mailer = require('../src/services/mailer');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
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

/**
 * El cuerpo de la identificación CON la confirmación del medio.
 *
 * La confirmación es obligatoria para cualquier destino (v1.2), así que todos
 * los tests que llegan al envío del código la llevan.
 */
function cuerpoConfirmado(extra = {}) {
  return Object.assign({
    tipo_identificacion: 'CC',
    numero_documento: '1234567890',
    medio_otp_confirmado: true,
    medio_otp_version: medioPersonal.DECLARACION_VERSION,
  }, extra);
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
    .send(cuerpoConfirmado({ correo_otp: CORREO_PERSONAL }))
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
    .send(cuerpoConfirmado())
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const inbox = mailer.getDevInbox();
  const conOtp = inbox.find((m) => m.tipo === 'signature');
  assert.ok(conOtp);
  assert.equal(conOtp.to, 'personal@ejemplo.net');
});

test('D-2 · la EMPRESA registra el medio personal y el OTP va ahí (opción B)', async () => {
  // Decisión del owner (2026-10-20): QUIÉN registra el medio personal es la
  // Empresa, que es quien tiene la ficha del trabajador. El mini-app lo deja
  // igual (si la Empresa no lo tiene, el Trabajador lo declara al
  // identificarse), pero el camino normal es este.
  //
  // Decisión 1.a (2026-10-27): la Empresa lo obtiene del candidato verbalmente
  // en la contratación y lo registra; el Trabajador lo CONFIRMA en la pantalla
  // de firma, porque la garantía del 3.7(a) es del Trabajador: que ese buzón
  // es de su uso exclusivo y que la Empresa no lo administra. Sin esa
  // confirmación el servidor NO manda el código (422
  // MEDIO_OTP_CONFIRMACION_REQUERIDA).
  limpiar();

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
    .send(cuerpoConfirmado())
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
    .send(cuerpoConfirmado({ correo_otp: CORREO_PERSONAL }))
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
    .send(cuerpoConfirmado())
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
// 3. El rechazo del buzón corporativo es INCONDICIONAL
// ===========================================================================

test('D-2 · un buzón corporativo se rechaza SIEMPRE y el caso queda en la bitácora', async () => {
  // ANTES esto dependía de `FIRMA_EXIGIR_MEDIO_PERSONAL_OTP`: con el
  // interruptor apagado solo se escribía un warn a la consola y el código
  // salía igual. Ahora el rechazo no depende de ninguna configuración: o el
  // código no sale a un buzón que la Empresa pueda leer, o no sale.
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud(CORREO_CORP);

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send(cuerpoConfirmado())
    .timeout({ response: 5000 });

  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'MEDIO_OTP_CORPORATIVO');
  assert.match(res.body.error.message, /3\.7\(a\)/,
    'el mensaje cita el numeral que lo sostiene');
  assert.match(res.body.error.message, /7\.2/, 'y ofrece el papel');

  // El código NO salió.
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.filter((m) => m.tipo === 'signature').length, 0,
    'el código no puede salir a un buzón que la Empresa pueda leer');

  // Y la fila no quedó con un OTP vivo que nadie tiene.
  const fila = db.prepare(
    'SELECT estado FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.notEqual(fila.estado, 'OTP_SENT',
    'el rechazo no puede dejar un código generado en la fila');

  // El caso queda en el registro de operaciones: `gh_firma_eventos` es
  // append-only, así que este aviso no se puede CORREGIR ni ALTERAR (el 3.4(e)
  // lo promete). SÍ se suprime: conforme al 8.6, dentro de la ventana de purga,
  // y su supresión deja la lápida y el recibo del 3.6(g).
  const evento = db.prepare(
    'SELECT evento, metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = ?'
  ).get(signRequest.id, 'OTP_MEDIO_CORPORATIVO');
  assert.ok(evento, 'el aviso OTP_MEDIO_CORPORATIVO queda en la bitácora');
  const metadata = JSON.parse(evento.metadata);
  assert.equal(metadata.resultado, 'rechazado');
  assert.equal(metadata.dominio_corporativo, true);
});

test('D-2 · un medio personal SÍ pasa el control del buzón corporativo', async () => {
  limpiar();
  registrarEmpresa();
  const { token } = await crearSolicitud(CORREO_CORP);

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send(cuerpoConfirmado({ correo_otp: CORREO_PERSONAL }))
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
});

// ===========================================================================
// 4. La confirmación del medio es obligatoria para CUALQUIER destino
// ===========================================================================

test('D-2 · sin la confirmación del medio, el código NO sale', async () => {
  // La regla del 3.4(e) y del 3.7(a) de la v1.2: el OTP sale únicamente al
  // medio que el Firmante confirmó en la pantalla de firma. Antes solo se
  // exigía cuando el destino era el medio que había registrado la Empresa.
  limpiar();
  registrarEmpresa();
  const { token } = await crearSolicitud('personal@ejemplo.net');

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'MEDIO_OTP_CONFIRMACION_REQUERIDA');
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.filter((m) => m.tipo === 'signature').length, 0,
    'sin confirmación no sale el código: es una condición, no un aviso');
});

test('D-2 · la confirmación se exige también cuando el Trabajador declara otro buzón', async () => {
  // Antes, escribir otro buzón deshabilitaba la casilla: el código iba a SU
  // buzón y no había nada que confirmar. Con la v1.2 la declaración es la
  // condición del envío, se vaya donde se vaya el código.
  limpiar();
  registrarEmpresa();
  const { token } = await crearSolicitud('personal@ejemplo.net');

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      correo_otp: 'mio@ejemplo.net',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'MEDIO_OTP_CONFIRMACION_REQUERIDA');
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.filter((m) => m.tipo === 'signature').length, 0);
});

test('D-2 · con la confirmación, la dirección que se archiva es la que recibió el código', async () => {
  // Si el Trabajador declara otro buzón, la declaración se archiva con ESE
  // buzón: es el que recibió el código. Antes se archivaba el de la fila, que
  // podía ser otro.
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud('personal@ejemplo.net');

  const otro = 'mio@ejemplo.net';
  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send(cuerpoConfirmado({ correo_otp: otro }))
    .timeout({ response: 5000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const fila = db.prepare(
    'SELECT medio_otp_confirmado_correo FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.medio_otp_confirmado_correo, otro);
});

// ===========================================================================
// 5. El bloqueo del OTP es DURO
// ===========================================================================

test('D-2 · agotados los cinco intentos, el OTP queda bloqueado y NO se puede reenviar', async () => {
  // Antes el bloqueo era blando: el reenvío desbloqueaba y ponía los
  // contadores en cero, así que el límite de cinco del 3.4(e) no era un
  // límite. Ahora el bloqueo es terminal y la salida es una nueva solicitud.
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud('personal@ejemplo.net');

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send(cuerpoConfirmado())
    .timeout({ response: 5000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  // Un código que NO es el bueno (determinista: nunca depende del azar).
  const malo = res.body.devOtp === '000000' ? '000001' : '000000';

  for (let intento = 1; intento <= 5; intento++) {
    const dev = await request(makeApp())
      .post(`/api/sign/${token}/verify-otp`)
      .send({ otp: malo })
      .timeout({ response: 5000 });
    if (intento < 5) {
      assert.equal(dev.status, 422, JSON.stringify(dev.body));
      assert.equal(dev.body.error.code, 'OTP_INVALID');
    } else {
      assert.equal(dev.status, 422, JSON.stringify(dev.body));
      assert.equal(dev.body.error.code, 'OTP_LOCKED');
    }
  }

  // Y el reenvío NO lo desbloquea.
  const reenvio = await request(makeApp())
    .post(`/api/sign/${token}/resend-otp`)
    .send({})
    .timeout({ response: 5000 });
  assert.equal(reenvio.status, 422, JSON.stringify(reenvio.body));
  assert.equal(reenvio.body.error.code, 'OTP_LOCKED');
  assert.equal(reenvio.body.error.details.se_puede_reenviar, false);

  // La fila queda bloqueada.
  const fila = db.prepare(
    'SELECT estado, otp_bloqueado FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.equal(fila.estado, 'OTP_LOCKED');
  assert.equal(fila.otp_bloqueado, 1);
});

// ===========================================================================
// 6. La caducidad también alcanza a las filas heredadas
// ===========================================================================

test('D-2 · una fila heredada sin marca de envío no puede validar el código', async () => {
  // Sin `fecha_otp_enviado` NO se puede probar que el código sea vigente, y
  // un código del que no se puede probar la vigencia no se valida. Se falla
  // cerrado. El Trabajador no queda atrapado: puede pedir uno nuevo.
  limpiar();
  registrarEmpresa();
  const { token, signRequest } = await crearSolicitud('personal@ejemplo.net');

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send(cuerpoConfirmado())
    .timeout({ response: 5000 });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  db.prepare(
    'UPDATE gh_firmas_electronicas SET fecha_otp_enviado = NULL WHERE id = ?'
  ).run(signRequest.id);

  const dev = await request(makeApp())
    .post(`/api/sign/${token}/verify-otp`)
    .send({ otp: res.body.devOtp })
    .timeout({ response: 5000 });

  assert.equal(dev.status, 410, JSON.stringify(dev.body));
  assert.equal(dev.body.error.code, 'OTP_EXPIRADO');
  assert.equal(dev.body.error.details.se_puede_reenviar, true);
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
