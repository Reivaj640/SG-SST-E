/**
 * tests/web/miniapp-medio-confirmado.test.js
 *
 * La decisión 1.a: el medio personal del código, CONFIRMADO por el Trabajador.
 *
 * La Empresa que contrata obtiene del candidato su correo personal de forma
 * verbal y lo registra en la solicitud. El Trabajador no lo escribe de nuevo:
 * lo CONFIRMA en la pantalla de firma (declaración fija: es de su uso
 * exclusivo y la Empresa no administra ese buzón).
 *
 * Qué fija este archivo:
 *
 *   A. La MINI-APP (estático): el bloque, la casilla, el texto de la
 *      declaración, la regla de cuándo la casilla aplica y el payload.
 *      Son archivos que se editan a mano, así que aplico §7.2: además de
 *      afirmar la forma buena, corro mutaciones en memoria y exijo que el
 *      evaluador marque cada una. Un check que no muerde no es un check.
 *
 *   B. El SERVIDOR (con base): la dirección se expone en claro, la
 *      confirmación se EXIGE antes de que el código salga, queda registrada en
 *      la fila y en la bitácora, y el medio pasa a origen
 *      'TRABAJADOR_CONFIRMADO' sin dejar de estar PENDIENTE.
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const WEB_DIR = path.resolve(__dirname, '..', '..', 'web', 'firma');
const HTML_REAL = fs.readFileSync(path.join(WEB_DIR, 'index.html'), 'utf8');
const JS_REAL = fs.readFileSync(path.join(WEB_DIR, 'app.js'), 'utf8');

const db = require('../../src/db/connection');
const empresaService = require('../../src/services/empresa');
const mailer = require('../../src/services/mailer');
const medioPersonal = require('../../src/services/medioPersonal');
const {
  resetDb, seedActiveAgreement, makeApp, createSignRequestWithIdentificacion,
} = require('../helpers');

// =============================================================================
// A. LA MINI-APP (checks estáticos + mutantes)
// =============================================================================

/**
 * Evalúa los checks contra un par (html, js) arbitrario, de modo que el mismo
 * código se pueda correr contra los archivos reales y contra mutantes.
 *
 * @returns {{f: number, fallos: string[]}}
 */
function evaluar(htm, js) {
  const fallos = [];

  const check = (nombre, ok, motivo) => {
    if (!ok) fallos.push(nombre + (motivo ? ' — ' + motivo : ''));
  };

  // --- Markup ---------------------------------------------------------------
  check('existe el bloque del medio personal',
    htm.includes('id="medio-personal-bloque"'),
    'sin el bloque no hay dónde mostrar la dirección que registró la Empresa');

  check('el bloque del medio personal arranca oculto',
    /id="medio-personal-bloque"[^>]*hidden/.test(htm),
    'sin medio registrado no hay nada que mostrar: el bloque no puede salir siempre');

  check('existe la casilla de confirmación',
    htm.includes('id="medio_otp_confirmado"'),
    'sin casilla no hay declaración que confirmar');

  check('la casilla está dentro del bloque del medio personal',
    /id="medio-personal-bloque"[\s\S]*?id="medio_otp_confirmado"/.test(htm),
    'si vive en otra pantalla el Trabajador nunca la ve');

  check('el texto de la declaración está en el HTML',
    htm.includes('Confirmo que esta dirección de correo es de mi uso exclusivo'),
    'el texto de la declaración es fijo: si falta, el Trabajador no sabe qué declara');

  // --- Cableado en el JS ----------------------------------------------------
  check('la mini-app pinta el medio personal que registró la Empresa',
    /function renderMedioPersonal\(/.test(js) &&
    /renderMedioPersonal\(contexto\);/.test(js),
    'sin pintar la dirección el Trabajador no puede reconocerla');

  check('la mini-app lee el medio del contexto público',
    js.includes('medio_personal_registrado'),
    'la dirección tiene que venir del servidor: el cliente no la inventa');

  check('la declaración que se muestra es la del servidor',
    /texto\.textContent\s*=\s*medio\.declaracion_texto/.test(js),
    'el texto que se muestra tiene que ser el que queda archivado con su versión');

  check('la dirección se muestra en claro',
    /registro\.textContent\s*=\s*[\s\S]{0,160}?\+\s*medio\.correo\s*;/.test(js),
    'enmascarada el Trabajador no puede reconocer su propio buzón');

  check('la casilla se exige cuando el código va al medio registrado',
    /check\.required\s*=\s*aplica/.test(js),
    'si no se exige, la confirmación es un adorno');

  check('la casilla se deshabilita si el Trabajador escribe otro buzón',
    /check\.disabled\s*=\s*!aplica/.test(js),
    'el código va a SU buzón: no hay nada que confirmar del de la Empresa');

  check('el payload viaja con la confirmación y su versión',
    /body\.medio_otp_confirmado\s*=\s*true/.test(js) &&
    /body\.medio_otp_version\s*=/.test(js),
    'sin la versión el servidor no puede saber con qué texto confirmó');

  check('el envío se frena si la casilla exigida no está marcada',
    /check\.required\s*&&\s*!confirmado/.test(js),
    'el cliente tiene que frenar el envío, no solo avisar');

  return { f: fallos.length, fallos };
}

const CHECKS_TOTAL = 13;

test('la mini-app pasa todos los checks del medio personal confirmado', () => {
  const { f, fallos } = evaluar(HTML_REAL, JS_REAL);
  assert.deepEqual(fallos, [], 'checks rotos:\n  ' + fallos.join('\n  '));
  assert.equal(f, 0);
});

const MUTANTES = [
  {
    nombre: 'se borra el bloque del medio personal',
    htm: (h) => h.replace(/\s*<div class="form-group" id="medio-personal-bloque"[\s\S]*?\n\s*<\/div>\n/, '\n'),
  },
  {
    nombre: 'el bloque del medio personal deja de estar oculto',
    htm: (h) => h.replace('id="medio-personal-bloque" hidden', 'id="medio-personal-bloque"'),
  },
  {
    nombre: 'se borra la casilla de confirmación',
    htm: (h) => h.replace(/\s*<input type="checkbox" id="medio_otp_confirmado"[^>]*>/, ''),
  },
  {
    nombre: 'se borra el texto de la declaración',
    htm: (h) => h.replace(/Confirmo que esta dirección de correo es de mi uso exclusivo[^<]*/, ''),
  },
  {
    nombre: 'la mini-app deja de pintar el medio personal',
    js: (j) => j.replace(/renderMedioPersonal\(contexto\);/, '/* ya no se pinta */'),
  },
  {
    nombre: 'la mini-app deja de leer el medio del contexto',
    js: (j) => j.replace('medio_personal_registrado', 'otro_campo'),
  },
  {
    nombre: 'la declaración se inventa en el cliente',
    js: (j) => j.replace(/medio\.declaracion_texto/g, "'texto inventado'"),
  },
  {
    nombre: 'la dirección se muestra enmascarada',
    js: (j) => j.replace(
      /registro\.textContent\s*=\s*\n?\s*'Tu empresa registró esta dirección para enviarte el código de verificación: '\s*\n?\s*\+\s*medio\.correo;/,
      "registro.textContent = 'Tu empresa registró una direccion';"),
  },
  {
    nombre: 'la casilla nunca se exige',
    js: (j) => j.replace('check.required = aplica;', 'check.required = false;'),
  },
  {
    nombre: 'la casilla nunca se deshabilita',
    js: (j) => j.replace('check.disabled = !aplica;', 'check.disabled = false;'),
  },
  {
    nombre: 'el payload no lleva la confirmación',
    js: (j) => j.replace('body.medio_otp_confirmado = true;', '/* sin confirmación */'),
  },
  {
    nombre: 'el payload no lleva la versión de la declaración',
    js: (j) => j.replace('body.medio_otp_version = state.declaracionVersion;', '/* sin versión */'),
  },
  {
    nombre: 'el cliente no frena el envío',
    js: (j) => j.replace('check.required && !confirmado', 'false'),
  },
];

for (const m of MUTANTES) {
  test('el mutante "' + m.nombre + '" lo detecta un check', () => {
    const htm = m.htm ? m.htm(HTML_REAL) : HTML_REAL;
    const js = m.js ? m.js(JS_REAL) : JS_REAL;
    assert.notEqual(htm === HTML_REAL && js === JS_REAL, true,
      'la mutación no cambió nada: el mutante está mal escrito (§7.5)');
    const { f } = evaluar(htm, js);
    assert.ok(f > 0, 'el mutante pasó limpio: el check que debería morder está flojo');
  });
}

// =============================================================================
// B. EL SERVIDOR
// =============================================================================

const EMPRESA = '900123456';
const DOMINIO_CORP = 'empresa-corp.com';
const CORREO_PERSONAL = 'mipersonal@ejemplo.net';

function registrarEmpresa() {
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
  });
  empresaService.marcarAnexoFirmado(EMPRESA, '2026-10-20');
}

function limpiar() {
  resetDb();
  seedActiveAgreement();
  mailer.clearDevInbox();
  registrarEmpresa();
}

/** Crea la solicitud con el medio personal que registró la Empresa. */
async function crearSolicitud({ correo_otp = null } = {}) {
  return createSignRequestWithIdentificacion({
    id_empresa: EMPRESA,
    id_trabajador: 'psn1_prueba',
    correo_verificacion: 'contacto@' + DOMINIO_CORP,
    metadata: JSON.stringify({ correo: 'contacto@' + DOMINIO_CORP }),
    ...(correo_otp ? { correo_otp } : {}),
  });
}

test('SERVIDOR · el contexto expone la dirección que registró la Empresa, en claro', async () => {
  limpiar();
  const { token } = await crearSolicitud({ correo_otp: CORREO_PERSONAL });

  const res = await request(makeApp()).get(`/s/${token}`);

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const medio = res.body.medio_personal_registrado;
  assert.ok(medio, 'el contexto tiene que decir cuál es el medio registrado');
  assert.equal(medio.correo, CORREO_PERSONAL,
    'la dirección va en claro: es el buzón del Trabajador y la Empresa ya lo tenía');
  assert.equal(medio.requiere_confirmacion, true);
  assert.equal(medio.declaracion_texto, medioPersonal.DECLARACION_TEXTO);
  assert.equal(medio.declaracion_version, medioPersonal.DECLARACION_VERSION);
});

test('SERVIDOR · sin medio registrado, el contexto no inventa uno', async () => {
  limpiar();
  const { token } = await crearSolicitud();

  const res = await request(makeApp()).get(`/s/${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.medio_personal_registrado.correo, null);
  assert.equal(res.body.medio_personal_registrado.requiere_confirmacion, false);
});

test('SERVIDOR · sin confirmar, la identificación se rechaza y el código NO sale', async () => {
  limpiar();
  const { token } = await crearSolicitud({ correo_otp: CORREO_PERSONAL });

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 422, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'MEDIO_OTP_CONFIRMACION_REQUERIDA');
  const inbox = mailer.getDevInbox();
  assert.equal(inbox.filter((m) => m.tipo === 'signature').length, 0,
    'sin confirmación no se manda el código: la casilla es una condición, no un aviso');
});

test('SERVIDOR · confirmada, la declaración queda en la fila y en la bitácora', async () => {
  limpiar();
  const { token, signRequest } = await crearSolicitud({ correo_otp: CORREO_PERSONAL });

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      medio_otp_confirmado: true,
      medio_otp_version: medioPersonal.DECLARACION_VERSION,
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));

  // 1. La fila de la solicitud.
  const fila = db.prepare(
    'SELECT medio_otp_confirmado_fecha_hora, medio_otp_confirmado_correo,'
    + ' medio_otp_confirmado_version FROM gh_firmas_electronicas WHERE id = ?'
  ).get(signRequest.id);
  assert.ok(fila.medio_otp_confirmado_fecha_hora, 'la fecha y la hora quedan registradas');
  assert.ok(!Number.isNaN(Date.parse(fila.medio_otp_confirmado_fecha_hora)));
  assert.equal(fila.medio_otp_confirmado_correo, CORREO_PERSONAL);
  assert.equal(fila.medio_otp_confirmado_version, medioPersonal.DECLARACION_VERSION);

  // 2. La bitácora de eventos.
  const evento = db.prepare(
    "SELECT metadata FROM gh_firma_eventos WHERE firma_id = ? AND evento = ?"
  ).get(signRequest.id, medioPersonal.EVENTO_CONFIRMACION);
  assert.ok(evento, 'la confirmación queda en la bitácora de eventos');
  const metadata = JSON.parse(evento.metadata);
  assert.equal(metadata.correo, CORREO_PERSONAL);
  assert.equal(metadata.version_declaracion, medioPersonal.DECLARACION_VERSION);

  // 3. El medio: origen 'TRABAJADOR_CONFIRMADO' y SIGUE PENDIENTE (confirmar
  //    no es verificar el código).
  const medio = db.prepare(
    "SELECT origen, estado FROM gh_firma_medios_trabajador WHERE id_empresa = ?"
    + " AND id_trabajador = ? AND tipo = 'CORREO_OTP' AND valor = ?"
  ).get(EMPRESA, signRequest.id_trabajador, CORREO_PERSONAL);
  assert.ok(medio, 'el medio está en el registro');
  assert.equal(medio.origen, 'TRABAJADOR_CONFIRMADO');
  assert.equal(medio.estado, 'PENDIENTE',
    'confirmar NO es verificar: hasta que no llegue el código, no se puede entregar copia');
});

test('SERVIDOR · la confirmación con una versión vieja se rechaza', async () => {
  limpiar();
  const { token } = await crearSolicitud({ correo_otp: CORREO_PERSONAL });

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      medio_otp_confirmado: true,
      medio_otp_version: '0.0',
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 409, JSON.stringify(res.body));
  assert.equal(res.body.error.code, 'MEDIO_OTP_DECLARACION_DESACTUALIZADA');
});

test('SERVIDOR · sin medio registrado, la identificación sigue siendo como antes', async () => {
  limpiar();
  const { token } = await crearSolicitud();

  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({ tipo_identificacion: 'CC', numero_documento: '1234567890' })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
});

test('SERVIDOR · el Trabajador escribe otro buzón: ese manda y no hay nada que confirmar', async () => {
  limpiar();
  const { token } = await crearSolicitud({ correo_otp: CORREO_PERSONAL });

  const otro = 'miotro@ejemplo.net';
  const res = await request(makeApp())
    .post(`/api/sign/${token}/identify`)
    .send({
      tipo_identificacion: 'CC',
      numero_documento: '1234567890',
      correo_otp: otro,
    })
    .timeout({ response: 5000 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  const inbox = mailer.getDevInbox();
  const conOtp = inbox.find((m) => m.tipo === 'signature');
  assert.ok(conOtp);
  assert.equal(conOtp.to, otro, 'el código va al buzón que declaró el Trabajador');
});
