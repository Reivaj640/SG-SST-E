/**
 * Cuenta de correo de envío de la Empresa (migración 042).
 *
 * QUÉ ES
 * ------
 * La decisión 1.b del owner: "la Empresa es quien realiza el envío, con sus
 * propios correos; K+AIR es el puente". Cada Empresa puede registrar aquí su
 * cuenta de envío (host, puerto, secure, usuario, clave, nombre y correo del
 * remitente) y, desde ese momento, las comunicaciones de la Empresa salen por
 * esa cuenta con SU identidad de remitente.
 *
 * CUÁLES SALEN POR LA CUENTA DE LA EMPRESA
 * -----------------------------------------
 *   - la invitación con el enlace de acceso (sendInvite),
 *   - el aviso posterior a la firma (sendCopiaAviso),
 *   - la copia del documento firmado en papel (sendCopiaFirmadoPapel),
 *   - la invitación al representante legal (sendInviteForCompany).
 *
 * Las dos últimas tienen a la Empresa como destinataria o responsable, así que
 * su cuenta propia es la natural.
 *
 * CUÁL NO SALE NUNCA POR LA CUENTA DE LA EMPRESA
 * ------------------------------------------------
 * El código de verificación (OTP). SIEMPRE va por la cuenta de K+AIR.
 *
 * POR QUÉ: el OTP es el dato de creación de la firma. Si su custodia
 * dependiera de la Empresa, el dato de creación dejaría de corresponder
 * exclusivamente al firmante (3.7(a) y 2.2.2.47.4 num. 1) y la garantía del
 * 6.1(d) sería falsa. Por eso el OTP no se resuelve con esta cuenta: en
 * mailer.js el `sendOTP` ignora el remitente que se le pase.
 *
 * Si la Empresa NO tiene cuenta configurada (o está inactiva), TODO sale por
 * la cuenta de K+AIR: ese es el comportamiento de siempre y no se rompe.
 *
 * LA CONTRASEÑA
 * -------------
 * La clave se guarda CIFRADA con la llave maestra, que vive fuera de la base
 * (src/crypto/cifrado.js): `cifrar(clave, id_empresa, 'cifrado-cuenta-envio',
 * 'clave_cuenta_envio')`. El ámbito es la Empresa, así que una clave no se
 * descifra con el ámbito de otra.
 *
 * La clave NUNCA sale de aquí: no se devuelve en la respuesta HTTP, no se
 * loguea y no entra al rastro. En el rastro solo se anotan los estados
 * CONFIGURADA / CAMBIADA / ELIMINADA.
 *
 * LA TRAMPA DE ESTE MÓDULO
 * ------------------------
 * Un transporter se crea con la contraseña en claro en memoria, y recrearlo en
 * cada envío abre una conexión TLS nueva por correo (lento) y agota el pool del
 * servidor SMTP de la Empresa. Por eso el transporter resuelto se CACHEA por
 * Empresa, y la caché se invalida en el mismo instante en que la cuenta
 * cambia: una caché que no se invalida es una cuenta vieja que sigue
 * enviando.
 *
 * La caché es del proceso (no hay Redis en esta pila): si el servicio se
 * reinicia, se resuelve de nuevo desde la base. No es un problema de
 * consistencia: la fuente de verdad es la tabla.
 */
'use strict';

const db = require('../db/connection');
const logger = require('../utils/logger');
const { cifrar, descifrar } = require('../crypto/cifrado');
const { AppError } = require('../middleware/errors');

const PROPOSITO = 'cifrado-cuenta-envio';
const CAMPO_CLAVE = 'clave_cuenta_envio';

const TABLA = 'gh_firma_empresas_cuenta_envio';
const TABLA_AUDITORIA = 'gh_firma_empresas_cuenta_envio_auditoria';

/**
 * Caché de cuentas resueltas, por Empresa.
 * La clave es el id_empresa; el valor es la cuenta (con su transporter).
 */
const _cacheCuentas = new Map();

/**
 * Los estados que se anotan en el rastro para el campo de la contraseña.
 * NUNCA el valor de la clave: ni la de antes ni la de después.
 */
const CLAVE_CONFIGURADA = 'CONFIGURADA';
const CLAVE_CAMBIADA = 'CAMBIADA';
const CLAVE_ELIMINADA = 'ELIMINADA';

/**
 * Normaliza un valor para escribirlo en el rastro.
 * Los booleanos van como SI/NO, igual que en el rastro de la ficha.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function _texto(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'boolean') return valor ? 'SI' : 'NO';
  if (typeof valor === 'number') return String(valor);
  return String(valor);
}

/**
 * El estado de la cuenta en el rastro: SI / NO.
 *
 * En la base `activo` es 1/0 (un entero de SQLite). Escribir el 1 y el 0 en
 * el rastro lo haría ilegible ("¿1 significa activo o inactivo?").
 *
 * @param {*} valor
 * @returns {string}
 */
function _siNo(valor) {
  return (valor === true || valor === 1 || valor === '1' || valor === 'true') ? 'SI' : 'NO';
}

/**
 * Enmascara el usuario de la cuenta de envío.
 *
 * POR QUÉ: el usuario es la mitad de la credencial. La respuesta de admin lo
 * devuelve enmascarado y el rastro también, para que la respuesta HTTP y el
 * rastro coincidan en qué se considera sensible.
 *
 * El dominio NO se oculta: sin él el operador no puede saber a qué cuenta
 * corresponde el registro, y el dominio no es el secreto (la clave sí).
 *
 * @param {string} usuario
 * @returns {string|null}
 */
function enmascararUsuario(usuario) {
  const v = typeof usuario === 'string' ? usuario.trim() : '';
  if (!v) return null;
  const arroba = v.indexOf('@');
  if (arroba > 0) {
    const local = v.slice(0, arroba);
    const domain = v.slice(arroba + 1);
    const visible = local.slice(0, Math.min(4, local.length));
    return `${visible}${'*'.repeat(Math.max(0, local.length - visible.length))}@${domain}`;
  }
  const visible = v.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(0, v.length - visible.length))}`;
}

/**
 * La fila cruda de la cuenta de envío (con la clave cifrada).
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function obtenerFila(id_empresa) {
  if (!id_empresa) return null;
  const fila = db.prepare(
    `SELECT * FROM ${TABLA} WHERE id_empresa = ?`
  ).get(id_empresa);
  return fila || null;
}

/**
 * La vista que se devuelve por HTTP: sin la clave y con el usuario enmascarado.
 *
 * @param {object} fila - la fila cruda.
 * @returns {object|null}
 */
function vistaEnmascarada(fila) {
  if (!fila) return null;
  return {
    host: fila.host,
    puerto: fila.puerto,
    secure: !!fila.secure,
    usuario: enmascararUsuario(fila.usuario),
    from_nombre: fila.from_nombre,
    from_email: fila.from_email,
    activo: !!fila.activo,
    fecha_creacion: fila.fecha_creacion,
    fecha_actualizacion: fila.fecha_actualizacion,
    // Nunca la clave: solo si hay clave configurada.
    clave_presente: !!fila.clave_cuenta_envio,
  };
}

/**
 * La vista enmascarada de la cuenta de una Empresa, o null si no tiene.
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function obtenerVista(id_empresa) {
  return vistaEnmascarada(obtenerFila(id_empresa));
}

/**
 * Escribe UN renglón de rastro.
 *
 * @param {object} r
 * @param {string} r.id_empresa
 * @param {string} r.campo
 * @param {*} r.valor_anterior
 * @param {*} r.valor_nuevo
 * @param {object} r.ctx - { actor, motivo, ip, user_agent }
 */
function _rastro({ id_empresa, campo, valor_anterior, valor_nuevo, ctx = {} }) {
  const quien = (typeof ctx.actor === 'string' && ctx.actor.trim().length > 0)
    ? ctx.actor.trim().slice(0, 200)
    : 'admin';
  const porque = (typeof ctx.motivo === 'string' && ctx.motivo.trim().length > 0)
    ? ctx.motivo.trim().slice(0, 500)
    : null;
  db.prepare(`
    INSERT INTO ${TABLA_AUDITORIA}
      (id_empresa, fecha_hora, id_actor, ip, user_agent,
       campo, valor_anterior, valor_nuevo, motivo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id_empresa, new Date().toISOString(), quien,
    ctx.ip || null, ctx.user_agent || null,
    campo, _texto(valor_anterior), _texto(valor_nuevo), porque
  );
}

/**
 * Invalida la caché de una Empresa.
 *
 * Se llama SIEMPRE que la cuenta cambie. Sin esto, la cuenta nueva no se
 * usaría hasta que el proceso se reinicie, y la vieja seguiría mandando.
 *
 * @param {string} id_empresa
 */
function invalidarCache(id_empresa) {
  _cacheCuentas.delete(id_empresa);
}

/**
 * Vacía toda la caché (tests).
 */
function limpiarCache() {
  _cacheCuentas.clear();
}

/**
 * Resuelve la cuenta de envío de una Empresa, con su transporter.
 *
 * Lanza si la cuenta existe pero no se puede resolver (clave que no descifra,
 * host inválido): el que llama decide si eso es un error o un motivo para
 * seguir por la cuenta de K+AIR.
 *
 * @param {string} id_empresa
 * @returns {object|null} la cuenta, o null si no hay cuenta configurada o está
 *   inactiva.
 */
function resolverCuentaEstricta(id_empresa) {
  if (!id_empresa) return null;

  const cacheada = _cacheCuentas.get(id_empresa);
  if (cacheada) return cacheada;

  const fila = obtenerFila(id_empresa);
  if (!fila) return null;
  if (!fila.activo) return null;

  // El transporter se crea LA PRIMERA VEZ que se usa y queda en memoria.
  //
  // POR QUÉ no en la resolución: (a) recrearlo en cada envío abre una
  // conexión TLS nueva por correo y agota el pool del servidor SMTP de la
  // Empresa; (b) la contraseña en claro solo existe mientras se crea el
  // transporter, en vez de quedar en memoria durante toda la vida del proceso;
  // (c) resolver una cuenta no tiene por qué depender de que el cliente SMTP
  // se pueda cargar (en los ambientes de prueba y desarrollo no se envía nada
  // por la red, así que no hace falta).
  let transporter = null;
  const cuenta = {
    origen: 'empresa',
    id_empresa,
    host: fila.host,
    puerto: fila.puerto,
    secure: !!fila.secure,
    usuario: fila.usuario,
    from_nombre: fila.from_nombre,
    from_email: fila.from_email,
    /**
     * El transporter de esta cuenta (se crea una vez y se reutiliza).
     * @returns {object} transporter de nodemailer
     */
    obtenerTransporter: () => {
      if (!transporter) {
        const clave = descifrar(
          fila.clave_cuenta_envio, id_empresa, PROPOSITO, CAMPO_CLAVE
        );
        const nodemailer = require('nodemailer');
        transporter = nodemailer.createTransport({
          host: fila.host,
          port: fila.puerto,
          secure: !!fila.secure,
          auth: {
            user: fila.usuario,
            pass: clave,
          },
        });
      }
      return transporter;
    },
  };
  _cacheCuentas.set(id_empresa, cuenta);
  return cuenta;
}

/**
 * Resuelve la cuenta de envío de una Empresa sin fallar nunca.
 *
 * Si la cuenta está mal (no descifra, no se puede crear el transporter), se
 * registra un WARN y se devuelve null: el correo sale por la cuenta de K+AIR.
 *
 * POR QUÉ no se propaga el error: una cuenta de envío mal configurada no puede
 * dejar de enviar la invitación ni el aviso. Es preferible que el correo salga
 * por K+AIR (que sí es del Responsable del tratamiento) a que la firma se
 * quede sin su comunicación.
 *
 * @param {string} id_empresa
 * @returns {object|null}
 */
function resolverCuenta(id_empresa) {
  if (!id_empresa) return null;
  try {
    return resolverCuentaEstricta(id_empresa);
  } catch (e) {
    logger.warn('No se pudo resolver la cuenta de envío de la Empresa: el correo sale por K+AIR', {
      id_empresa,
      error: e.message,
    });
    return null;
  }
}

/**
 * Da de alta o actualiza la cuenta de envío de una Empresa.
 *
 * En el ALTA la clave es obligatoria. En la ACTUALIZACIÓN es opcional: si no
 * viene, se conserva la que hay (cambiarla es un acto, no una consecuencia de
 * tocar otro campo). Lo mismo con `activo`: si no viene, se conserva.
 *
 * @param {string} id_empresa
 * @param {object} datos - { host, puerto, secure, usuario, clave, from_nombre,
 *   from_email, activo? }
 * @param {object} [ctx] - Contexto de auditoría: { actor, motivo, ip, user_agent }.
 * @returns {{vista: object, creado: boolean}}
 * @throws AppError 400 si falta la clave en el alta o los datos no sirven.
 */
function guardar(id_empresa, datos, ctx = {}) {
  if (!id_empresa || typeof id_empresa !== 'string') {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id_empresa es requerido');
  }

  const anterior = obtenerFila(id_empresa);
  const creado = !anterior;

  const host = String(datos.host || '').trim();
  const usuario = String(datos.usuario || '').trim();
  const fromNombre = String(datos.from_nombre || '').trim();
  const fromEmail = String(datos.from_email || '').trim().toLowerCase();
  const puerto = Number.isInteger(datos.puerto) ? datos.puerto : 587;
  const secure = datos.secure ? 1 : 0;

  if (!host) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'host es requerido');
  }
  if (!usuario) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'usuario es requerido');
  }
  if (!fromNombre) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'from_nombre es requerido');
  }
  if (!fromEmail || !fromEmail.includes('@')) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'from_email no parece un correo');
  }

  // La clave llega en claro y se cifra antes de tocar la base. En el ALTA es
  // obligatoria; en la ACTUALIZACIÓN, si no viene, se conserva la que hay.
  const claveNueva = typeof datos.clave === 'string' ? datos.clave : '';
  if (creado && !claveNueva) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'clave es requerida en el alta');
  }

  // ¿La clave CAMBIÓ de verdad?
  //
  // El sobre es AES-GCM con IV aleatorio: dos cifrados del mismo texto son
  // sobres DISTINTOS, así que no se pueden comparar los sobres para saber si
  // la clave es la misma. Se descifra la que había y se compara el texto
  // claro. Si la anterior no se puede descifrar (llave rotada), se trata como
  // cambio: no se puede afirmar que sea la misma.
  let claveGuardada;
  let claveCambia = false;
  if (creado) {
    claveGuardada = cifrar(claveNueva, id_empresa, PROPOSITO, CAMPO_CLAVE);
    claveCambia = true;
  } else if (!claveNueva) {
    claveGuardada = anterior.clave_cuenta_envio;
  } else {
    let anteriorEnClaro = null;
    let sePudoComparar = false;
    try {
      anteriorEnClaro = descifrar(
        anterior.clave_cuenta_envio, id_empresa, PROPOSITO, CAMPO_CLAVE
      );
      sePudoComparar = true;
    } catch (e) {
      // No se puede descifrar la anterior: se trata como cambio.
    }
    if (sePudoComparar && anteriorEnClaro === claveNueva) {
      claveGuardada = anterior.clave_cuenta_envio;
    } else {
      claveGuardada = cifrar(claveNueva, id_empresa, PROPOSITO, CAMPO_CLAVE);
      claveCambia = true;
    }
  }

  // `activo` no viene siempre: si no viene, se conserva el valor que hay.
  const activo = (typeof datos.activo === 'boolean')
    ? (datos.activo ? 1 : 0)
    : (anterior ? anterior.activo : 1);

  const tx = db.transaction(() => {
    if (creado) {
      db.prepare(`
        INSERT INTO ${TABLA}
          (id_empresa, host, puerto, secure, usuario, clave_cuenta_envio,
           from_nombre, from_email, activo, fecha_creacion, fecha_actualizacion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id_empresa, host, puerto, secure, usuario, claveGuardada,
        fromNombre, fromEmail, activo
      );
    } else {
      db.prepare(`
        UPDATE ${TABLA}
        SET host = ?, puerto = ?, secure = ?, usuario = ?, clave_cuenta_envio = ?,
            from_nombre = ?, from_email = ?, activo = ?,
            fecha_actualizacion = datetime('now')
        WHERE id_empresa = ?
      `).run(
        host, puerto, secure, usuario, claveGuardada,
        fromNombre, fromEmail, activo, id_empresa
      );
    }

    // El rastro: un renglón por campo que REALMENTE cambió. Un guardado que
    // re-manda lo mismo no es un cambio y no deja renglón.
    if (creado) {
      _rastro({ id_empresa, campo: 'host', valor_anterior: null, valor_nuevo: host, ctx });
      _rastro({ id_empresa, campo: 'puerto', valor_anterior: null, valor_nuevo: puerto, ctx });
      _rastro({ id_empresa, campo: 'secure', valor_anterior: null, valor_nuevo: secure, ctx });
      _rastro({
        id_empresa, campo: 'usuario',
        valor_anterior: null, valor_nuevo: enmascararUsuario(usuario), ctx,
      });
      _rastro({ id_empresa, campo: 'from_nombre', valor_anterior: null, valor_nuevo: fromNombre, ctx });
      _rastro({ id_empresa, campo: 'from_email', valor_anterior: null, valor_nuevo: fromEmail, ctx });
      _rastro({ id_empresa, campo: 'activo', valor_anterior: null, valor_nuevo: _siNo(activo), ctx });
      // La clave: nunca el valor, solo el estado.
      _rastro({
        id_empresa, campo: CAMPO_CLAVE,
        valor_anterior: null, valor_nuevo: CLAVE_CONFIGURADA, ctx,
      });
    } else {
      const pares = [
        ['host', anterior.host, host],
        ['puerto', anterior.puerto, puerto],
        ['secure', anterior.secure, secure],
        ['usuario', enmascararUsuario(anterior.usuario), enmascararUsuario(usuario)],
        ['from_nombre', anterior.from_nombre, fromNombre],
        ['from_email', anterior.from_email, fromEmail],
        ['activo', _siNo(anterior.activo), _siNo(activo)],
      ];
      for (const [campo, antes, despues] of pares) {
        if (_texto(antes) === _texto(despues)) continue;
        _rastro({ id_empresa, campo, valor_anterior: antes, valor_nuevo: despues, ctx });
      }
      if (claveCambia) {
        _rastro({
          id_empresa, campo: CAMPO_CLAVE,
          valor_anterior: CLAVE_CONFIGURADA, valor_nuevo: CLAVE_CAMBIADA, ctx,
        });
      }
    }
  });
  tx();

  invalidarCache(id_empresa);

  logger.info('Cuenta de envío de la Empresa ' + (creado ? 'creada' : 'actualizada'), {
    id_empresa,
    host,
    puerto,
    secure: !!secure,
    // El usuario va enmascarado al log: no es una credencial, pero tampoco
    // hace falta que quede escrito en claro.
    usuario: enmascararUsuario(usuario),
    from_email: fromEmail,
    activo: !!activo,
    clave_cambiada: claveCambia,
  });

  return { vista: obtenerVista(id_empresa), creado };
}

/**
 * Elimina la cuenta de envío de una Empresa y deja rastro.
 *
 * @param {string} id_empresa
 * @param {object} [ctx] - Contexto de auditoría: { actor, motivo, ip, user_agent }.
 * @returns {boolean} true si había cuenta y se eliminó.
 */
function eliminar(id_empresa, ctx = {}) {
  const anterior = obtenerFila(id_empresa);
  if (!anterior) return false;

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM ${TABLA} WHERE id_empresa = ?`).run(id_empresa);
    _rastro({
      id_empresa, campo: 'cuenta_envio',
      valor_anterior: CLAVE_CONFIGURADA, valor_nuevo: CLAVE_ELIMINADA, ctx,
    });
    // La clave: nunca el valor, solo el estado.
    _rastro({
      id_empresa, campo: CAMPO_CLAVE,
      valor_anterior: CLAVE_CONFIGURADA, valor_nuevo: CLAVE_ELIMINADA, ctx,
    });
  });
  tx();

  invalidarCache(id_empresa);

  logger.warn('Cuenta de envío de la Empresa eliminada', {
    id_empresa,
    host: anterior.host,
    from_email: anterior.from_email,
  });

  return true;
}

/**
 * El rastro de los cambios de la cuenta de envío, del más reciente al más
 * antiguo.
 *
 * @param {string} id_empresa
 * @param {object} [opts] - { limite }
 * @returns {Array<object>}
 */
function historial(id_empresa, opts = {}) {
  const limite = Number.isInteger(opts.limite) && opts.limite > 0 ? opts.limite : 200;
  return db.prepare(`
    SELECT id, id_empresa, fecha_hora, id_actor, ip, user_agent,
           campo, valor_anterior, valor_nuevo, motivo
    FROM ${TABLA_AUDITORIA}
    WHERE id_empresa = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(id_empresa, limite);
}

module.exports = {
  obtenerFila,
  obtenerVista,
  vistaEnmascarada,
  enmascararUsuario,
  guardar,
  eliminar,
  resolverCuenta,
  resolverCuentaEstricta,
  invalidarCache,
  limpiarCache,
  historial,
  PROPOSITO,
  CAMPO_CLAVE,
};
