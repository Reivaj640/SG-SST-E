/**
 * LA CUENTA DE CORREO DE ENVÍO DE LA EMPRESA (migración 042)
 * =========================================================
 *
 * La decisión 1.b del owner: "la Empresa es quien realiza el envío, con sus
 * propios correos; K+AIR es el puente".
 *
 * Estos tests fijan el comportamiento que NO se puede ver mirando la pantalla:
 *
 *   1. La contraseña se guarda CIFRADA y no sale de la base en claro.
 *   2. La clave solo se descifra con el ámbito de SU Empresa.
 *   3. La vista que se devuelve por HTTP no tiene la clave y enmascara el
 *      usuario.
 *   4. Cada cambio (alta, modificación, activación, borrado) deja un renglón
 *      en el rastro, con actor, motivo, ip y user_agent.
 *   5. La contraseña NUNCA entra al rastro: solo los estados CONFIGURADA /
 *      CAMBIADA / ELIMINADA.
 *   6. El rastro es append-only de verdad (los triggers muerden).
 *   7. La cuenta se cachea por Empresa y la caché se invalida cuando la
 *      cuenta cambia.
 *   8. La invitación sale por la cuenta de la Empresa; el OTP NUNCA sale por
 *      esa cuenta, sale por la de K+AIR.
 *   9. La etiqueta del origen del medio del OTP dice la verdad: quién declaró
 *      el medio.
 *
 * POR QUÉ CADA TEST USA SU PROPIA EMPRESA
 * ---------------------------------------
 * La tabla del rastro es append-only con los triggers puestos: sus renglones
 * no se pueden borrar entre tests. Por eso cada test usa un id de Empresa
 * distinto, y las cuentas (que sí se pueden limpiar) se borran al empezar.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const db = require('../../src/db/connection');
const cuentaEnvio = require('../../src/services/cuentaEnvio');
const mailer = require('../../src/services/mailer');
const { descifrar } = require('../../src/crypto/cifrado');
const { resolveCorreoOtp } = require('../../src/services/publicFlow');
const { resetDb } = require('../helpers');

const SQL_042 = path.join(
  __dirname, '..', '..', 'src', 'db', 'schema', '042_cuenta_envio_empresa.sql'
);

const CLAVE = 'clave-secreta-de-prueba';
const CUENTA = {
  host: 'smtp.empresa.example',
  puerto: 587,
  secure: false,
  usuario: 'smtp-user-de-prueba@empresa.example',
  clave: CLAVE,
  from_nombre: 'Empresa de Prueba S.A.S.',
  from_email: 'notificaciones@empresa.example',
};

const CTX = {
  actor: 'el operador',
  motivo: 'la Empresa registro su cuenta de envio',
  ip: '10.0.0.9',
  user_agent: 'test-suite',
};

let _contador = 0;

/** Un id de Empresa distinto por test: el rastro no se puede limpiar. */
function idNuevo() {
  _contador += 1;
  return '9009' + String(_contador).padStart(6, '0');
}

function limpiar() {
  resetDb();
  // El rastro es append-only: sus renglones no se pueden borrar. Para poder
  // vaciarlo entre tests se bajan los triggers, se limpian las tablas y se
  // vuelve a aplicar el MISMO archivo de migración (que los vuelve a poner).
  // Es el mismo truco que usa tests/helpers.js con los triggers de la 020.
  db.exec('DROP TRIGGER IF EXISTS trg_empresas_cuenta_envio_auditoria_no_update');
  db.exec('DROP TRIGGER IF EXISTS trg_empresas_cuenta_envio_auditoria_no_delete');
  db.prepare('DELETE FROM gh_firma_empresas_cuenta_envio_auditoria').run();
  db.prepare('DELETE FROM gh_firma_empresas_cuenta_envio').run();
  db.exec(fs.readFileSync(SQL_042, 'utf8'));
  // La caché de transporters es del proceso: si no se limpia, un test hereda
  // la cuenta del test anterior.
  cuentaEnvio.limpiarCache();
  mailer.clearDevInbox();
}

function filaDe(id) {
  return db.prepare(
    'SELECT * FROM gh_firma_empresas_cuenta_envio WHERE id_empresa = ?'
  ).get(id);
}

function renglones(id) {
  return cuentaEnvio.historial(id, { limite: 100 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. La clave se guarda cifrada
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el alta guarda la clave CIFRADA, no en claro', () => {
  limpiar();
  const id = idNuevo();

  cuentaEnvio.guardar(id, CUENTA, CTX);

  const fila = filaDe(id);
  assert.ok(fila, 'la cuenta quedo guardada');
  assert.ok(
    String(fila.clave_cuenta_envio).startsWith('enc:v2:'),
    'la clave guardada es un sobre cifrado'
  );
  assert.ok(
    !JSON.stringify(fila).includes(CLAVE),
    'la clave en claro no aparece en la fila'
  );
});

test('cuenta de envio · la clave solo se descifra con el ambito de SU Empresa', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const sobre = filaDe(id).clave_cuenta_envio;
  const enClaro = descifrar(
    sobre, id, 'cifrado-cuenta-envio', 'clave_cuenta_envio'
  );
  assert.equal(enClaro, CLAVE, 'la clave se descifra con su ambito');

  assert.throws(
    () => descifrar(sobre, 'otra-empresa', 'cifrado-cuenta-envio', 'clave_cuenta_envio'),
    /cifrado/,
    'la clave de una Empresa no se descifra con el ambito de otra'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lo que se devuelve por HTTP
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · la vista de admin no devuelve la clave y enmascara el usuario', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const vista = cuentaEnvio.obtenerVista(id);

  assert.equal(vista.clave, undefined, 'la vista no trae la clave');
  assert.equal(vista.clave_presente, true, 'la vista dice si hay clave');
  assert.ok(!JSON.stringify(vista).includes(CLAVE), 'la clave no aparece en la vista');
  assert.ok(
    !String(vista.usuario).includes('smtp-user-de-prueba'),
    'el usuario va enmascarado'
  );
  assert.ok(
    String(vista.usuario).endsWith('@empresa.example'),
    'el enmascarado conserva el dominio (no es el secreto)'
  );
  assert.equal(vista.host, CUENTA.host);
  assert.equal(vista.puerto, CUENTA.puerto);
  assert.equal(vista.secure, false);
  assert.equal(vista.from_nombre, CUENTA.from_nombre);
  assert.equal(vista.from_email, CUENTA.from_email);
  assert.equal(vista.activo, true);
  assert.ok(vista.fecha_creacion, 'la vista dice cuando se creo');
  assert.ok(vista.fecha_actualizacion, 'la vista dice cuando se actualizo');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. El rastro
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · el alta deja rastro con actor, motivo, ip y user_agent', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const filas = renglones(id);
  assert.ok(filas.length > 0, 'el alta dejo renglones');

  const clave = filas.find((f) => f.campo === 'clave_cuenta_envio');
  assert.ok(clave, 'la clave tiene su renglón');
  assert.equal(clave.valor_anterior, null);
  assert.equal(clave.valor_nuevo, 'CONFIGURADA');
  assert.equal(clave.id_actor, CTX.actor);
  assert.equal(clave.motivo, CTX.motivo);
  assert.equal(clave.ip, CTX.ip);
  assert.equal(clave.user_agent, CTX.user_agent);
  assert.ok(clave.fecha_hora, 'el renglón tiene fecha y hora');
});

test('cuenta de envio · la contraseña NUNCA entra al rastro', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, { clave: 'otra-clave-distinta' }), CTX);
  cuentaEnvio.eliminar(id, CTX);

  const filas = renglones(id);
  assert.ok(filas.length > 0);
  assert.ok(
    !JSON.stringify(filas).includes(CLAVE),
    'la clave en claro no aparece en ningun renglon'
  );
  assert.ok(
    !JSON.stringify(filas).includes('otra-clave-distinta'),
    'la clave nueva tampoco'
  );

  // Los unicos valores que se anotan para la clave son los estados.
  const deClave = filas.filter((f) => f.campo === 'clave_cuenta_envio');
  const estados = new Set(deClave.map((f) => f.valor_nuevo));
  for (const e of estados) {
    assert.ok(
      ['CONFIGURADA', 'CAMBIADA', 'ELIMINADA'].includes(e),
      'el valor anotado para la clave es un estado, no la clave'
    );
  }
});

test('cuenta de envio · cambiar la clave se anota como CAMBIADA', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, { clave: 'otra-clave-distinta' }), CTX);

  const filas = renglones(id);
  const cambios = filas.filter((f) => f.campo === 'clave_cuenta_envio');
  assert.equal(cambios.length, 2, 'el alta y el cambio de clave dejan dos renglones');
  assert.equal(cambios[0].valor_anterior, 'CONFIGURADA');
  assert.equal(cambios[0].valor_nuevo, 'CAMBIADA');
});

test('cuenta de envio · una modificacion deja un renglón por campo que cambio', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const antes = renglones(id).length;

  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, {
    host: 'smtp.nuevo.empresa.example',
    from_nombre: 'Otro nombre',
  }), CTX);

  const filas = renglones(id);
  const nuevos = filas.slice(0, filas.length - antes);
  const campos = nuevos.map((f) => f.campo).sort();
  assert.deepEqual(campos, ['from_nombre', 'host'], 'solo los campos que cambiaron');
  const host = nuevos.find((f) => f.campo === 'host');
  assert.equal(host.valor_anterior, CUENTA.host);
  assert.equal(host.valor_nuevo, 'smtp.nuevo.empresa.example');
});

test('cuenta de envio · un guardado que no cambia nada no deja renglón', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const antes = renglones(id).length;

  cuentaEnvio.guardar(id, CUENTA, CTX);

  assert.equal(renglones(id).length, antes, 'no hay cambio, no hay renglón');
});

test('cuenta de envio · desactivar la cuenta deja rastro', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const antes = renglones(id).length;

  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, { activo: false }), CTX);

  const filas = renglones(id);
  assert.equal(filas.length, antes + 1, 'la desactivacion dejo un renglón');
  const fila = filas[0];
  assert.equal(fila.campo, 'activo');
  assert.equal(fila.valor_anterior, 'SI');
  assert.equal(fila.valor_nuevo, 'NO');
});

test('cuenta de envio · el borrado elimina la cuenta y deja rastro', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const borrada = cuentaEnvio.eliminar(id, CTX);
  assert.equal(borrada, true);
  assert.equal(filaDe(id), undefined, 'la cuenta ya no esta');

  const filas = renglones(id);
  const deClave = filas.find((f) => f.campo === 'clave_cuenta_envio');
  assert.equal(deClave.valor_anterior, 'CONFIGURADA');
  assert.equal(deClave.valor_nuevo, 'ELIMINADA');
  const deCuenta = filas.find((f) => f.campo === 'cuenta_envio');
  assert.equal(deCuenta.valor_nuevo, 'ELIMINADA', 'el borrado de la cuenta queda anotado');
});

test('cuenta de envio · el rastro es append-only de verdad', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  assert.throws(
    () => db.prepare(
      'UPDATE gh_firma_empresas_cuenta_envio_auditoria SET motivo = ? WHERE id_empresa = ?'
    ).run('otro motivo', id),
    /append-only/,
    'no se puede alterar el rastro'
  );
  assert.throws(
    () => db.prepare(
      'DELETE FROM gh_firma_empresas_cuenta_envio_auditoria WHERE id_empresa = ?'
    ).run(id),
    /append-only/,
    'no se puede borrar el rastro'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La resolución de la cuenta (y su caché)
// ─────────────────────────────────────────────────────────────────────────────

test('cuenta de envio · sin cuenta no hay cuenta que resolver', () => {
  limpiar();
  assert.equal(cuentaEnvio.resolverCuenta(idNuevo()), null);
});

test('cuenta de envio · una cuenta inactiva no se resuelve', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, { activo: false }), CTX);

  assert.equal(cuentaEnvio.resolverCuenta(id), null, 'la cuenta inactiva no se usa');
});

test('cuenta de envio · una cuenta activa se resuelve con su remitente', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const cuenta = cuentaEnvio.resolverCuenta(id);
  assert.ok(cuenta, 'la cuenta se resuelve');
  assert.equal(cuenta.origen, 'empresa');
  assert.equal(cuenta.from_nombre, CUENTA.from_nombre);
  assert.equal(cuenta.from_email, CUENTA.from_email);
  assert.equal(typeof cuenta.obtenerTransporter, 'function', 'la cuenta trae su transporter');
});

test('cuenta de envio · la cache se invalida cuando la cuenta cambia', () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);

  const primera = cuentaEnvio.resolverCuenta(id);
  assert.equal(primera.host, CUENTA.host);

  // Mismo objeto mientras la cuenta no cambia: la cache sirve.
  const segunda = cuentaEnvio.resolverCuenta(id);
  assert.equal(segunda, primera, 'sin cambios se usa la cache');

  // Cambio de cuenta: la cache se invalida y la nueva manda.
  cuentaEnvio.guardar(id, Object.assign({}, CUENTA, {
    host: 'smtp.nuevo.empresa.example',
    from_email: 'nuevo@empresa.example',
  }), CTX);

  const tercera = cuentaEnvio.resolverCuenta(id);
  assert.notEqual(tercera, primera, 'la cuenta nueva no es la cacheada');
  assert.equal(tercera.host, 'smtp.nuevo.empresa.example');
  assert.equal(tercera.from_email, 'nuevo@empresa.example');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. QUIÉN EMITE QUÉ
// ─────────────────────────────────────────────────────────────────────────────

test('envio · la invitacion sale por la cuenta de la Empresa', async () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const cuenta = cuentaEnvio.resolverCuenta(id);

  await mailer.sendInvite({
    to: 'trabajador@ejemplo.com',
    url_publica: 'http://localhost:3737/s/token-de-prueba',
    id_solicitud: 'SIGN-2026-000001',
    cuenta_envio: cuenta,
  });

  const entrada = mailer.getDevInbox().find((e) => e.tipo === 'invite');
  assert.ok(entrada, 'la invitacion salio');
  assert.equal(entrada.remitente.origen, 'empresa');
  assert.equal(entrada.remitente.from_email, CUENTA.from_email);
  assert.equal(entrada.remitente.from_nombre, CUENTA.from_nombre);
});

test('envio · sin cuenta de la Empresa todo sale por K+AIR', async () => {
  limpiar();

  await mailer.sendInvite({
    to: 'trabajador@ejemplo.com',
    url_publica: 'http://localhost:3737/s/token-de-prueba',
    id_solicitud: 'SIGN-2026-000001',
  });

  const entrada = mailer.getDevInbox().find((e) => e.tipo === 'invite');
  assert.ok(entrada);
  assert.equal(entrada.remitente.origen, 'kair');
});

test('envio · el OTP sale SIEMPRE por K+AIR, aunque se le pase la cuenta de la Empresa', async () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const cuenta = cuentaEnvio.resolverCuenta(id);

  // Se le pasa la cuenta de la Empresa a propósito: el OTP la ignora.
  await mailer.sendOTP({
    to: 'trabajador@ejemplo.com',
    otp: '123456',
    tipo: 'signature',
    context: { id_solicitud: 'SIGN-2026-000001' },
    cuenta_envio: cuenta,
  });

  const entrada = mailer.getDevInbox().find((e) => e.tipo === 'signature');
  assert.ok(entrada, 'el OTP salio');
  assert.equal(
    entrada.remitente.origen, 'kair',
    'el OTP no sale por la cuenta de la Empresa: el dato de creación de la firma no puede tener su custodia en la Empresa'
  );
});

test('envio · el aviso y la copia en papel salen por la cuenta de la Empresa', async () => {
  limpiar();
  const id = idNuevo();
  cuentaEnvio.guardar(id, CUENTA, CTX);
  const cuenta = cuentaEnvio.resolverCuenta(id);

  await mailer.sendCopiaAviso({
    to: 'trabajador@ejemplo.com',
    url_publica: 'http://localhost:3737/s/token-de-prueba',
    id_solicitud: 'SIGN-2026-000001',
    cuenta_envio: cuenta,
  });

  const aviso = mailer.getDevInbox().find((e) => e.tipo === 'copy_aviso');
  assert.ok(aviso);
  assert.equal(aviso.remitente.origen, 'empresa');
  assert.equal(aviso.remitente.from_email, CUENTA.from_email);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. LA ETIQUETA DEL ORIGEN DEL MEDIO DEL OTP
// ─────────────────────────────────────────────────────────────────────────────

test('etiqueta del OTP · el medio que llega en el body es del Trabajador', () => {
  limpiar();
  const signRequest = {
    id_solicitud: 'SIGN-2026-000002',
    id_empresa: '900900001',
    id_trabajador: null,
    correo_verificacion: 'contacto@empresa.example',
    correo_otp: null,
  };

  const r = resolveCorreoOtp(signRequest, 'personal@ejemplo.com');
  assert.equal(r.correo, 'personal@ejemplo.com');
  assert.equal(r.origen, 'declarado_por_el_trabajador');
});

test('etiqueta del OTP · el medio que registro la Empresa al crear la solicitud NO es del Trabajador', () => {
  limpiar();
  const signRequest = {
    id_solicitud: 'SIGN-2026-000003',
    id_empresa: '900900002',
    id_trabajador: null,
    correo_verificacion: 'contacto@empresa.example',
    correo_otp: 'personal@ejemplo.com',
  };

  const r = resolveCorreoOtp(signRequest, null);
  assert.equal(r.correo, 'personal@ejemplo.com');
  assert.equal(
    r.origen, 'registrado_por_la_empresa',
    'el medio vino de signRequest.correo_otp, que registro la Empresa'
  );
});

test('etiqueta del OTP · sin medio personal se usa el contacto registrado', () => {
  limpiar();
  const signRequest = {
    id_solicitud: 'SIGN-2026-000004',
    id_empresa: '900900003',
    id_trabajador: null,
    correo_verificacion: 'contacto@empresa.example',
    correo_otp: null,
  };

  const r = resolveCorreoOtp(signRequest, null);
  assert.equal(r.correo, 'contacto@empresa.example');
  assert.equal(r.origen, 'contacto_registrado');
});
