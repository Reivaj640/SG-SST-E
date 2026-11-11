/**
 * LA SUSCRIPCIÓN DEL ANEXO DE NUBE POR LA EMPRESA
 * ============================================================================
 *
 * QUÉ HACE
 * --------
 * Abre el canal por el que una Empresa suscribe el Anexo de Nube, sin que
 * un operador tenga que registrar la firma a mano y sin que la firma dependa
 * de un acta, de un correo físico ni de una cita.
 *
 * El canal tiene tres pasos:
 *
 *   1. El operador (K+AIR) crea una suscripción: dice a qué correo se le
 *      manda el enlace y con qué versión del Anexo de Nube. El servicio
 *      devuelve el enlace de un solo uso y lo envía al correo del firmante.
 *   2. La Empresa abre el enlace, pide su código de verificación y lo recibe
 *      por correo. El enlace y el código salen por la cuenta de K+AIR,
 *      NUNCA por la cuenta de la Empresa: el código no puede depender de un
 *      buzón que la Empresa pueda leer.
 *   3. La Empresa escribe el código, marca que leyó el Anexo, y el servicio
 *      registra la suscripción con versión, huella SHA-256 del texto,
 *      evidencia (fecha, correo, IP, navegador) y el rastro append-only.
 *
 * POR QUÉ EL TEXTO NO SE COPIA EN LA BASE
 * ---------------------------------------
 * Lo que se suscribe es una VERSIÓN con su HUELLA SHA-256. El texto vive en
 * `legal/anexo-nube-v1.1.html` y su huella se calcula sobre los bytes de ese
 * archivo, en el servidor, cada vez que se abre una suscripción. Si el
 * archivo cambia, la huella cambia y la suscripción queda atada a una huella
 * que ya no existe: por eso el archivo NO se puede editar después de
 * suscribirse sin invalidar lo suscrito.
 *
 * POR QUÉ EL CÓDIGO NO ES EL MISMO QUE EL DEL TRABAJADOR
 * ------------------------------------------------------
 * El código del Trabajador es el dato de creación de la firma (3.7(a) del
 * Acuerdo). Este es otro acto, con otra evidencia y otro destinatario: el
 * representante de la Empresa. Se reusan las PRIMITIVAS (HMAC con clave
 * derivada fuera de la base, comparación en tiempo constante, TTL e intento
 * máximo), no el mismo estado.
 *
 * LO QUE ESTE SERVICIO NO HACE
 * ----------------------------
 * - No decide qué versión se suscribe: usa la que está en el disco, con su
 *   huella real.
 * - No inventa el nombre del firmante: lo que el operador declara queda
 *   declarado; si no se declara, queda en blanco.
 * - No borra ni reescribe una suscripción. Si hay que corregirla, se registra
 *   otra por el camino administrativo, con motivo, y queda el rastro de las
 *   dos.
 * - No levanta la excepción de habilitación: el Anexo de Nube es un anexo
 *   suscrito, no una excepción operativa.
 *
 * Ver el §10 del Anexo de Nube v1.1 y el plan de cierre del 5-nov-2026.
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');

const db = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const { generateToken, hashTokenHmac, tokenHashCandidates } = require('../crypto/token');
const {
  generateOTP, hashOTPHmac, verifyOTPHmac, isExpired, PROPOSITO_OTP_CONTRAFIRMA,
} = require('../crypto/otp');
const empresaService = require('./empresa');
const mailer = require('./mailer');
const auditoriaService = require('./empresaAuditoria');
const actaAnexoNube = require('./actaAnexoNube');
// La acreditacion de la facultad de quien contrafirma POR GESSTIAR (condicion
// del abogado a P7, 10-nov-2026). El cotejo de mas abajo demuestra la
// facultad del lado de la EMPRESA; este modulo demuestra la del lado de
// GESSTIAR. Ver `services/poderesEncargado.js`.
const poderesEncargado = require('./poderesEncargado');
// La identidad del texto vigente (que version se suscribe y donde esta el
// archivo) vive en su propio modulo, sin dependencias: asi `empresa.js` puede
// comprobarla sin un ciclo de imports. Ver `anexoNubeModelo.js`.
const { VERSION_MODELO, RUTA_MODELO } = require('./anexoNubeModelo');

/** Cuánto vive el enlace de un solo uso. */
const TTL_ENLACE_HORAS = 72;

/** Cuántos códigos se pueden pedir por el mismo enlace. */
const MAX_ENVIOS_CODIGO = 5;

const ESTADOS = {
  PENDIENTE: 'PENDIENTE',
  CODIGO_ENVIADO: 'CODIGO_ENVIADO',
  FIRMADA: 'FIRMADA',
  EXPIRADA: 'EXPIRADA',
  BLOQUEADA: 'BLOQUEADA',
  ANULADA: 'ANULADA',
};

// =============================================================================
// HELPERS
// =============================================================================

function _sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * El texto vigente del Anexo de Nube y su huella real.
 *
 * Si el archivo no está en el servidor, NO se inventa una versión: el
 * servicio se niega a abrir una suscripción. Es un fallo de despliegue
 * (503), no un error de la Empresa.
 *
 * @param {string} [ruta] - otro archivo a leer. Existe para que los tests
 *   puedan apuntar a una COPIA TEMPORAL y comprobar qué pasa cuando el
 *   texto cambia entre que se abre la suscripción y el momento de
 *   suscribirse, sin tocar el archivo legal. Solo puede hacer la
 *   comprobación MÁS estricta: si la huella no coincide, no se firma.
 * @returns {{version: string, hash: string, bytes: number}}
 */
function modeloVigente(ruta = RUTA_MODELO) {
  let buf;
  try {
    buf = fs.readFileSync(ruta);
  } catch (e) {
    logger.error('No se encuentra el texto del Anexo de Nube en el servidor', {
      ruta,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(503, 'ANEXO_NUBE_NO_DISPONIBLE',
      'El texto del Anexo de Nube no está disponible en el servidor: no se puede abrir una suscripción');
  }
  return {
    version: VERSION_MODELO,
    hash: _sha256(buf),
    bytes: buf.length,
  };
}

/**
 * La dirección donde se lee el texto del Anexo de Nube.
 *
 * NO es la del sitio público: es la del propio servicio
 * (`/anexo-nube/documento`). Lo que la Empresa lee tiene que ser EXACTAMENTE
 * el archivo cuya huella se registra: si el enlace apuntara al sitio,
 * habría dos copias y se podría leer una mientras el servicio registra la
 * huella de la otra.
 */
function urlDocumento() {
  const base = String(config.publicUrl || '').replace(/\/+$/, '');
  return `${base}/anexo-nube/documento`;
}

function _correoValido(correo) {
  return typeof correo === 'string'
    && correo.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

function _texto(valor, max) {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/**
 * Enmascara un correo para mostrarlo sin exponerlo entero.
 * `representante@empresa.com` → `re***@empresa.com`
 */
function _enmascararCorreo(correo) {
  const s = String(correo || '');
  const arroba = s.indexOf('@');
  if (arroba <= 0) return '***';
  const usuario = s.slice(0, arroba);
  const visible = usuario.slice(0, 2);
  return `${visible}***${s.slice(arroba)}`;
}

/**
 * Escribe en el rastro append-only de la suscripción.
 */
function _evento(id_suscripcion, id_empresa, evento, detalle, ip, user_agent) {
  db.prepare(`INSERT INTO gh_firma_anexo_nube_eventos
    (id_suscripcion, id_empresa, evento, detalle, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id_suscripcion, id_empresa, evento,
      detalle ? String(detalle).slice(0, 1000) : null,
      ip || null, user_agent || null);
}

/**
 * La fila de la suscripción que corresponde a un enlace.
 *
 * Prueba TODAS las formas de hash que el sistema ha usado (HMAC con cada
 * versión de llave, HMAC v1 y SHA-256 pelado), como hace el servicio de
 * firmas: una fila vieja no puede quedar sin poder resolverse.
 */
function _buscarPorToken(token) {
  if (typeof token !== 'string' || token.length === 0) return null;
  const candidatos = tokenHashCandidates(token);
  const marcar = candidatos.map(() => '?').join(', ');
  return db.prepare(`SELECT * FROM gh_firma_anexo_nube_suscripciones
    WHERE token_hash IN (${marcar}) LIMIT 1`).get(...candidatos) || null;
}

/**
 * La fila de la suscripción, con las validaciones de estado.
 *
 * @param {string} token
 * @param {object} [opciones]
 * @param {boolean} [opciones.permitirFirmada] - no falla si ya está firmada.
 * @returns {object} la fila.
 */
function _fila(token, opciones = {}) {
  const fila = _buscarPorToken(token);
  if (!fila) {
    throw new AppError(404, 'ENLACE_NO_VALIDO',
      'El enlace no corresponde a ninguna suscripción del Anexo de Nube');
  }
  if (fila.estado === ESTADOS.ANULADA) {
    throw new AppError(410, 'ENLACE_ANULADO',
      'Esta suscripción fue anulada por el operador');
  }
  if (fila.estado === ESTADOS.EXPIRADA) {
    throw new AppError(410, 'ENLACE_EXPIRADO',
      'El enlace de suscripción venció: hay que abrir una suscripción nueva');
  }
  if (fila.estado === ESTADOS.BLOQUEADA) {
    throw new AppError(429, 'ENLACE_BLOQUEADO',
      'Esta suscripción quedó bloqueada por intentos fallidos de verificación');
  }
  if (fila.expira_enlace_at && new Date(fila.expira_enlace_at).getTime() < Date.now()) {
    db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
      SET estado = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(ESTADOS.EXPIRADA, fila.id);
    _evento(fila.id, fila.id_empresa, 'ENLACE_EXPIRADO', null, null, null);
    throw new AppError(410, 'ENLACE_EXPIRADO',
      'El enlace de suscripción venció: hay que abrir una suscripción nueva');
  }
  if (fila.estado === ESTADOS.FIRMADA && !opciones.permitirFirmada) {
    throw new AppError(409, 'YA_SUSCRITO',
      'Esta suscripción ya está firmada: no se puede volver a usar');
  }
  return fila;
}

// =============================================================================
// 1. ABRIR LA SUSCRIPCIÓN
// =============================================================================

/**
 * Crea una suscripción y envía el enlace al correo del firmante.
 *
 * @param {string} id_empresa
 * @param {object} datos
 * @param {string} datos.correo_firmante - a quién se manda el enlace y el código.
 * @param {string} [datos.nombre_firmante]
 * @param {string} [datos.cargo_firmante]
 * @param {object} [ctx] - { actor, motivo, ip, user_agent }
 * @returns {object} { token, url, expira_en, version, hash }
 */
async function crearSuscripcion(id_empresa, datos, ctx = {}) {
  const empresa = empresaService.getById(id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${id_empresa}`);
  }
  if (empresa.activo === false || empresa.activo === 0) {
    throw new AppError(409, 'EMPRESA_INACTIVA',
      `La empresa ${id_empresa} está dada de baja: no se pueden abrir suscripciones`);
  }

  const correo = _texto(datos && datos.correo_firmante, 254);
  if (!_correoValido(correo)) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'correo_firmante debe ser un correo válido');
  }

  const nombre = _texto(datos && datos.nombre_firmante, 200)
    || _texto(empresa.representante_legal, 200);
  const cargo = _texto(datos && datos.cargo_firmante, 200)
    || 'Representante legal';

  // La versión y la huella son las del ARCHIVO, no las que declara el
  // operador: lo que se suscribe es lo que está en el disco.
  const modelo = modeloVigente();

  const token = generateToken();
  const tokenHash = hashTokenHmac(token);
  const expira = new Date(Date.now() + (TTL_ENLACE_HORAS * 3600 * 1000)).toISOString();

  const info = db.prepare(`INSERT INTO gh_firma_anexo_nube_suscripciones
    (id_empresa, token_hash, version, hash_texto, correo_firmante, nombre_firmante,
     cargo_firmante, estado, expira_enlace_at, ip_creacion, user_agent_creacion, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id_empresa, tokenHash, modelo.version, modelo.hash, correo.toLowerCase(),
      nombre, cargo, ESTADOS.PENDIENTE, expira,
      ctx.ip || null, ctx.user_agent || null, ctx.actor || null);

  const id = info.lastInsertRowid;
  _evento(id, id_empresa, 'SUSCRIPCION_CREADA',
    `version=${modelo.version} hash=${modelo.hash}`, ctx.ip, ctx.user_agent);

  const url = `${String(config.publicUrl || '').replace(/\/+$/, '')}/anexo-nube/${token}`;

  try {
    await mailer.sendAnexoNubeInvitacion({
      to: correo.toLowerCase(),
      url,
      empresa: empresa.razon_social || id_empresa,
      version: modelo.version,
      hash: modelo.hash,
      nombre_firmante: nombre,
      expira_en: expira,
      documento_url: urlDocumento(),
    });
  } catch (e) {
    db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
      SET estado = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(ESTADOS.ANULADA, id);
    _evento(id, id_empresa, 'ENVIO_FALLIDO',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo enviar el enlace de suscripción del Anexo de Nube', {
      id_empresa, id_suscripcion: id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(502, 'ENVIO_FALLIDO',
      'No se pudo enviar el correo con el enlace de suscripción: no se abrió ninguna suscripción');
  }

  logger.info('Suscripción del Anexo de Nube abierta', {
    id_empresa, id_suscripcion: id, version: modelo.version,
  });

  return {
    token,
    url,
    expira_en: expira,
    version: modelo.version,
    hash: modelo.hash,
    correo_firmante: correo.toLowerCase(),
  };
}

/**
 * Da de baja una suscripción que todavía no se firmó.
 *
 * El enlace queda muerto y el rastro dice por qué. Lo que YA se firmó no se
 * toca por aquí: eso se corrige por el camino administrativo, con motivo.
 *
 * EL MOTIVO ES OBLIGATORIO
 * ------------------------
 * Misma regla que en el resto del módulo: una baja tiene que decir por qué
 * se hizo, porque el rastro es lo que queda después. Sin motivo, el rastro
 * registra que alguien anuló algo y no por qué.
 */
function anularSuscripcion(id_empresa, id_suscripcion, ctx = {}) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_nube_suscripciones
    WHERE id = ? AND id_empresa = ?`).get(id_suscripcion, id_empresa);
  if (!fila) {
    throw new AppError(404, 'SUSCRIPCION_NO_ENCONTRADA',
      'No existe esa suscripción para esa empresa');
  }
  if (fila.estado === ESTADOS.FIRMADA) {
    throw new AppError(409, 'YA_SUSCRITO',
      'La suscripción ya está firmada: no se anula; se corrige por el camino administrativo');
  }
  const motivo = typeof ctx.motivo === 'string' ? ctx.motivo.trim() : '';
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para anular una suscripción');
  }
  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET estado = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(ESTADOS.ANULADA, fila.id);
  _evento(fila.id, id_empresa, 'SUSCRIPCION_ANULADA',
    motivo.slice(0, 1000), ctx.ip, ctx.user_agent);
  return { anulada: true, id: fila.id };
}

// =============================================================================
// 2. EL CONTEXTO PÚBLICO
// =============================================================================

/**
 * Lo que la Empresa ve al abrir el enlace.
 *
 * NO se expone: el hash del enlace, el hash del código, el contador de
 * intentos, el correo completo (va enmascarado) ni nada del servidor.
 */
function contextoPublico(token, ip, user_agent) {
  const fila = _fila(token, { permitirFirmada: true });
  const empresa = empresaService.getById(fila.id_empresa);

  if (!fila.enlace_abierto_at) {
    db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
      SET enlace_abierto_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(new Date().toISOString(), fila.id);
    _evento(fila.id, fila.id_empresa, 'ENLACE_ABIERTO', null, ip, user_agent);
  }

  // ¿El texto que se va a suscribir sigue siendo el que está en el servidor?
  // La pantalla lo dice, para que la Empresa no firme sobre una huella que
  // ya no corresponde a lo publicado.
  let vigente = false;
  try {
    const actual = modeloVigente();
    vigente = actual.hash === fila.hash_texto && actual.version === fila.version;
  } catch (e) {
    vigente = false;
  }

  return {
    estado: fila.estado,
    version: fila.version,
    hash: fila.hash_texto,
    vigente,
    empresa: empresa ? (empresa.razon_social || fila.id_empresa) : fila.id_empresa,
    correo_firmante: _enmascararCorreo(fila.correo_firmante),
    nombre_firmante: fila.nombre_firmante,
    cargo_firmante: fila.cargo_firmante,
    expira_en: fila.expira_enlace_at,
    documento_url: urlDocumento(),
    codigo_enviado: Boolean(fila.otp_enviado_at),
    firmado_at: fila.firmado_at,
  };
}

// =============================================================================
// 3. EL CÓDIGO DE VERIFICACIÓN
// =============================================================================

/**
 * Manda el código de verificación al correo del firmante.
 *
 * @param {string} token
 * @param {object} ctx - { ip, user_agent }
 * @returns {object} { expira_en_segundos }
 */
async function solicitarCodigo(token, ctx = {}) {
  const fila = _fila(token, { permitirFirmada: true });
  if (fila.estado === ESTADOS.FIRMADA) {
    throw new AppError(409, 'YA_SUSCRITO',
      'Esta suscripción ya está firmada: no se manda un código nuevo');
  }
  if (fila.otp_envios >= MAX_ENVIOS_CODIGO) {
    throw new AppError(429, 'LIMITE_ENVIOS',
      'Se agotaron los envíos de código de esta suscripción: hay que abrir una suscripción nueva');
  }

  // Si el texto ya no es el del servidor, esta suscripción está muerta:
  // mandar un código sería pedirle a la Empresa que firme un texto que no
  // se le puede mostrar. Se dice antes, no después de escribir el código.
  const vigente = modeloVigente();
  if (vigente.hash !== fila.hash_texto || vigente.version !== fila.version) {
    _evento(fila.id, fila.id_empresa, 'TEXTO_MODIFICADO',
      `suscrito=${fila.hash_texto} vigente=${vigente.hash}`, ctx.ip, ctx.user_agent);
    throw new AppError(409, 'TEXTO_MODIFICADO',
      'El texto del Anexo de Nube cambió después de abrir esta suscripción: '
      + 'hay que abrir una suscripción nueva con la versión vigente');
  }

  const otp = generateOTP();
  const otpHash = hashOTPHmac(otp, fila.id_empresa);
  const enviadoAt = new Date().toISOString();

  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET otp_hash = ?, otp_intentos = 0, otp_envios = otp_envios + 1,
        otp_enviado_at = ?, estado = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(otpHash, enviadoAt, ESTADOS.CODIGO_ENVIADO, fila.id);

  _evento(fila.id, fila.id_empresa, 'CODIGO_ENVIADO',
    `intento=${fila.otp_envios + 1}`, ctx.ip, ctx.user_agent);

  try {
    await mailer.sendOTP({
      to: fila.correo_firmante,
      otp,
      tipo: 'anexo_nube',
      context: {
        id_suscripcion: fila.id,
        empresa: fila.id_empresa,
        version: fila.version,
      },
    });
  } catch (e) {
    // El envío falló: la Empresa no tiene código. Se le dice con claridad
    // para que pueda reintentar, y queda el fallo en el rastro. El hash del
    // código NO se borra: si el proveedor lo alcanzó a entregar, ese código
    // es válido y borrarlo dejaría a la Empresa con un correo inservible.
    _evento(fila.id, fila.id_empresa, 'ENVIO_FALLIDO',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo enviar el código de suscripción del Anexo de Nube', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(502, 'ENVIO_FALLIDO',
      'No se pudo enviar el correo con el código de verificación: inténtelo otra vez');
  }

  return { expira_en_segundos: config.ttl.otpSeconds };
}

// =============================================================================
// 4. LA SUSCRIPCIÓN
// =============================================================================

/**
 * Suscribe el Anexo de Nube y lo registra en la ficha de la Empresa.
 *
 * @param {string} token
 * @param {object} datos
 * @param {string} datos.otp - el código de verificación.
 * @param {boolean} datos.acepta - que la Empresa leyó y acepta.
 * @param {object} ctx
 * @param {string} ctx.ip
 * @param {string} ctx.user_agent
 * @param {object} [opciones]
 * @param {string} [opciones.rutaModelo] - ver `modeloVigente()`. Solo para
 *   tests; en producción es el archivo del servidor.
 * @returns {object} el registro de la suscripción.
 */
function suscribir(token, datos, ctx = {}, opciones = {}) {
  const fila = _fila(token, { permitirFirmada: true });
  if (fila.estado === ESTADOS.FIRMADA) {
    // Reintento de quien ya firmó: se devuelve lo mismo, no se vuelve a
    // registrar nada.
    return {
      firmado: true,
      ya_firmada: true,
      version: fila.version,
      hash: fila.hash_texto,
      firmado_at: fila.firmado_at,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EL TEXTO NO CAMBIÓ DESDE QUE SE ABRIÓ ESTA SUSCRIPCIÓN
  // ───────────────────────────────────────────────────────────────────────────
  // Lo que se suscribe es UNA VERSIÓN CON SU HUELLA. Si el archivo del
  // servidor cambió después de que se abrió el enlace, la Empresa estaría
  // firmando un texto que no es el que se le mostró ni el que se le declaró
  // por correo. En ese caso la suscripción NO se completa: se rechaza con
  // 409 y queda el motivo en el rastro. La Empresa tiene que abrir una
  // suscripción nueva contra la versión vigente.
  const vigente = modeloVigente(opciones.rutaModelo || RUTA_MODELO);
  if (vigente.hash !== fila.hash_texto || vigente.version !== fila.version) {
    _evento(fila.id, fila.id_empresa, 'TEXTO_MODIFICADO',
      `suscrito=${fila.hash_texto} vigente=${vigente.hash}`, ctx.ip, ctx.user_agent);
    logger.warn('El texto del Anexo de Nube cambió después de abrir la suscripción', {
      id_empresa: fila.id_empresa,
      id_suscripcion: fila.id,
      hash_suscrito: fila.hash_texto,
      hash_vigente: vigente.hash,
    });
    throw new AppError(409, 'TEXTO_MODIFICADO',
      'El texto del Anexo de Nube cambió después de abrir esta suscripción: '
      + 'hay que abrir una suscripción nueva con la versión vigente');
  }

  if (datos.acepta !== true) {
    throw new AppError(400, 'ACEPTACION_REQUERIDA',
      'La Empresa debe marcar que leyó el Anexo de Nube y que acepta sus condiciones');
  }
  if (!fila.otp_hash || !fila.otp_enviado_at) {
    throw new AppError(400, 'CODIGO_NO_SOLICITADO',
      'Primero hay que pedir el código de verificación');
  }
  if (isExpired(fila.otp_enviado_at, config.ttl.otpSeconds)) {
    throw new AppError(400, 'CODIGO_EXPIRADO',
      'El código venció: pida uno nuevo');
  }

  const otp = typeof datos.otp === 'string' ? datos.otp.trim() : '';
  if (!verifyOTPHmac(otp, fila.otp_hash, fila.id_empresa)) {
    const intentos = fila.otp_intentos + 1;
    const bloqueo = intentos >= config.ttl.otpMaxAttempts;
    db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
      SET otp_intentos = ?, estado = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(intentos, bloqueo ? ESTADOS.BLOQUEADA : fila.estado, fila.id);
    _evento(fila.id, fila.id_empresa, 'CODIGO_INVALIDO',
      `intento=${intentos}`, ctx.ip, ctx.user_agent);
    if (bloqueo) {
      throw new AppError(429, 'CODIGO_BLOQUEADO',
        'Se agotaron los intentos de verificación de esta suscripción');
    }
    throw new AppError(400, 'CODIGO_INVALIDO', 'El código no es correcto');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // LA FIRMA
  // ───────────────────────────────────────────────────────────────────────────
  const empresa = empresaService.getById(fila.id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${fila.id_empresa}`);
  }
  if (empresa.anexo_nube_firmado_at
      && empresa.anexo_nube_hash !== fila.hash_texto) {
    // No se pisa una suscripción de otro texto: eso se corrige por el camino
    // administrativo, con motivo, y quedan las dos en el rastro.
    throw new AppError(409, 'SUSCRIPCION_EXISTENTE',
      'Esta Empresa tiene el Anexo de Nube suscrito en otra versión: '
      + 'la corrección se registra por el canal administrativo, con su motivo');
  }

  const firmadoAt = new Date().toISOString();
  const evidencia = {
    fuente: 'enlace_suscripcion',
    id_suscripcion: fila.id,
    version: fila.version,
    hash: fila.hash_texto,
    correo_firmante: fila.correo_firmante,
    nombre_firmante: fila.nombre_firmante,
    cargo_firmante: fila.cargo_firmante,
    codigo_enviado_at: fila.otp_enviado_at,
    codigo_verificado_at: firmadoAt,
    enlace_abierto_at: fila.enlace_abierto_at,
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
  };
  const evidenciaTexto = JSON.stringify(evidencia);

  empresaService.marcarAnexoNubeFirmado(fila.id_empresa, {
    fecha: firmadoAt,
    version: fila.version,
    hash: fila.hash_texto,
    evidencia: evidenciaTexto,
  }, {
    actor: `empresa:${fila.id_empresa}`,
    motivo: 'Suscripción del Anexo de Nube por el enlace de un solo uso',
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
  });

  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET estado = ?, firmado_at = ?, evidencia = ?, ip_firma = ?, user_agent_firma = ?,
        otp_hash = NULL, updated_at = datetime('now')
    WHERE id = ?`)
    .run(ESTADOS.FIRMADA, firmadoAt, evidenciaTexto,
      ctx.ip || null, ctx.user_agent || null, fila.id);

  _evento(fila.id, fila.id_empresa, 'SUSCRIPCION_FIRMADA',
    `version=${fila.version} hash=${fila.hash_texto}`, ctx.ip, ctx.user_agent);

  logger.info('Anexo de Nube suscrito por la Empresa', {
    id_empresa: fila.id_empresa, id_suscripcion: fila.id, version: fila.version,
  });

  return {
    firmado: true,
    version: fila.version,
    hash: fila.hash_texto,
    firmado_at: firmadoAt,
    evidencia,
  };
}

// =============================================================================
// 5. LA CONTRAFIRMA (FASE 2)
// =============================================================================
//
// QUE ES ESTA FASE
// ----------------
// El Anexo de Nube es BILATERAL: el parrafo 10 del texto vigente dice que la
// suscripcion de la Empresa es el PRIMER acto y la contrafirma de K+AIR el
// SEGUNDO, y que el instrumento queda EJECUTADO cuando los dos actos se han
// producido. Hasta ahora el servicio solo registraba el primero: eso es un
// verde falso, porque el manifiesto dira "firmado" con la mitad del
// instrumento.
//
// LO QUE NO SE PUEDE SALTAR
// --------------------------
//  - Que la Empresa haya suscrito (si no, no hay nada que contrafirmar).
//  - Que se sepa QUIEN firmó por la Empresa: es lo que el parrafo 10 exige
//    antes de contrafirmar. Si la suscripcion no dice quien firmó, no hay
//    contrafirma.
//  - El codigo, que sale al buzon de proteccion de datos de K+AIR (FIJO en la
//    configuracion del servicio), nunca a un buzon que la Empresa pueda leer.
//  - La aceptacion expresa de quien contrafirma.
//  - El motivo (`X-Admin-Motivo`): es un acto que ejecuta el instrumento.
//
// EL CODIGO ES DISTINTO
// ---------------------
// El codigo de la contrafirma tiene su propio proposito de derivacion
// (`otp-contrafirma`): los mismos seis digitos no sirven para los dos actos.
// El codigo de la suscripcion no verifica contra la huella de la contrafirma,
// ni al reves.
//
// EL CANAL NO LO DECLARA QUIEN PIDE LA CONTRAFIRMA
// -------------------------------------------------
// Sale al buzon de proteccion de datos de K+AIR, que esta FIJO en la
// configuracion. Es la misma razon por la que el codigo de la suscripcion no
// sale al buzon de la Empresa: un canal elegido por quien pide el acto no
// probaria nada.
//
// EL ESTADO DE LA CONTRAFIRMA ES EL SUYO
// --------------------------------------
// El estado de la suscripcion (`estado`) es el del PRIMER acto y no se toca:
// sigue en FIRMADA. El estado del SEGUNDO acto vive en `contrafirma_estado`
// (PENDIENTE, CODIGO_ENVIADO, BLOQUEADA, CONTRAFIRMADA), para que el
// manifiesto siga viendo la suscripcion como firmada aunque el codigo de la
// contrafirma se haya bloqueado.
//
// EL ACTA: UN ACTA PROPIA, QUE NO REESCRIBE NADA
// -----------------------------------------------
// El Anexo de Nube no deja acta en la suscripcion (la constancia de la
// Empresa es la pantalla). La contrafirma genera SU acta, con su huella
// SHA-256, que cita el primer acto (fecha, version y huella del texto).

/**
 * Los estados del SEGUNDO acto (la contrafirma).
 *
 * NO son los de `ESTADOS`: aquellos son los del primer acto (la suscripcion),
 * y ese estado no se toca cuando la contrafirma avanza.
 */
const ESTADOS_CONTRAFIRMA = {
  PENDIENTE: 'PENDIENTE',
  CODIGO_ENVIADO: 'CODIGO_ENVIADO',
  BLOQUEADA: 'BLOQUEADA',
  CONTRAFIRMADA: 'CONTRAFIRMADA',
};

/**
 * La suscripcion que se puede contrafirmar, con todas las condiciones
 * cumplidas.
 *
 * @param {string} id_empresa
 * @param {number|string} id_suscripcion
 * @returns {object} la fila de la suscripcion.
 */
function _filaContrafirmable(id_empresa, id_suscripcion) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_nube_suscripciones
    WHERE id = ? AND id_empresa = ?`).get(id_suscripcion, id_empresa);
  if (!fila) {
    throw new AppError(404, 'SUSCRIPCION_NO_ENCONTRADA',
      'No existe esa suscripcion para esa empresa');
  }
  if (fila.estado !== ESTADOS.FIRMADA) {
    throw new AppError(409, 'SUSCRIPCION_NO_FIRMADA',
      'Esta suscripcion no esta firmada por la Empresa: no hay nada que contrafirmar');
  }
  if (fila.contrafirmado_at) {
    throw new AppError(409, 'YA_CONTRAFIRMADO',
      'Esta suscripcion ya esta contrafirmada: el instrumento ya esta ejecutado');
  }
  return fila;
}

/**
 * Coteja el firmante de la suscripcion con el representante legal de la
 * ficha de la Empresa.
 *
 * QUE ES Y QUE NO ES
 * ------------------
 * El parrafo 10 del texto vigente exige contrafirmar "una vez verificado
 * quien firmo por la Empresa". En este Anexo la suscripcion identifica al
 * firmante (nombre y cargo) y el PRIMER acto pruebo el control del correo de
 * ese firmante: eso es lo que permite saber quien firmo. El cotejo con la
 * ficha de la Empresa (su representante legal) es el contraste que se deja
 * por escrito.
 *
 * POR QUE FALLA CERRADO
 * ---------------------
 * Si la suscripcion no dice quien firmo, o si la ficha de la Empresa no
 * declara su representante legal, no hay contrafirma: K+AIR no puede
 * ejecutar un instrumento cuyo firmante no puede identificar.
 *
 * Y si el firmante de la suscripcion NO es el representante legal de la
 * ficha, tampoco: eso es exactamente la grieta que el abogado señalo (el
 * firmante podria no tener poder). La salida es administrativa y auditada:
 * que el operador corrija la ficha de la Empresa o registre otra
 * suscripcion, con su motivo y su rastro. No es un problema que se resuelva
 * contrafirmando.
 *
 * @param {object} fila - la fila de la suscripcion.
 * @param {object} empresa - la ficha de la Empresa.
 * @returns {{resultado: string, firmante: string, cargo: string|null, ficha: string|null}}
 */
function _cotejarFirmante(fila, empresa) {
  const firmante = _texto(fila.nombre_firmante, 200);
  if (!firmante) {
    throw new AppError(409, 'REPRESENTANTE_NO_VERIFICADO',
      'No se sabe quien firmo por la Empresa: el Anexo de Nube no se contrafirma '
      + 'sin esa verificacion');
  }
  const ficha = _texto(empresa && empresa.representante_legal, 200);
  if (!ficha) {
    throw new AppError(409, 'REPRESENTANTE_NO_VERIFICADO',
      'La ficha de la Empresa no declara su representante legal: no se puede '
      + 'verificar quien firmo por ella');
  }
  // Se quitan las marcas combinantes (los codepoints 0x300-0x36F) por
  // comparacion de codepoint: el archivo queda en ASCII puro y el cotejo de
  // nombres no depende de como se escriban las tildes.
  const sinMarcas = (s) => String(s || '').normalize('NFD')
    .split('').filter((ch) => ch.charCodeAt(0) < 0x300).join('');
  const normalizar = (s) => sinMarcas(s)
    .replace(/\s+/g, ' ').trim().toUpperCase();
  if (normalizar(ficha) !== normalizar(firmante)) {
    throw new AppError(409, 'FIRMANTE_NO_COINCIDE',
      'El firmante de la suscripcion no es el representante legal de la ficha de la '
      + 'Empresa: no se puede contrafirmar. La correccion se registra por el canal '
      + 'administrativo, con su motivo y su rastro.');
  }
  return {
    resultado: 'COINCIDE_CON_LA_FICHA',
    firmante,
    cargo: _texto(fila.cargo_firmante, 200),
    ficha,
  };
}

/**
 * Manda el codigo de la contrafirma al buzon de proteccion de datos de K+AIR.
 *
 * @param {string} id_empresa
 * @param {number|string} id_suscripcion
 * @param {object} [ctx] - { ip, user_agent }.
 * @returns {Promise<object>} { expira_en_segundos, canal }
 */
async function solicitarContrafirmaAnexoNube(id_empresa, id_suscripcion, ctx = {}) {
  const fila = _filaContrafirmable(id_empresa, id_suscripcion);

  // El canal es FIJO: lo declara la configuracion de K+AIR, no quien pide la
  // contrafirma. Si el que pide el acto pudiera elegir el canal, el control
  // del buzon no probaria nada.
  const canal = String(config.canalProteccionDatos || '').trim();
  if (!canal) {
    throw new AppError(503, 'CANAL_CONTRAFIRMA_NO_DEFINIDO',
      'El canal de proteccion de datos de K+AIR no esta configurado: no se puede contrafirmar');
  }
  const envios = Number(fila.contrafirma_otp_envios || 0);
  if (envios >= MAX_ENVIOS_CODIGO) {
    throw new AppError(429, 'LIMITE_ENVIOS',
      'Se agotaron los envios de codigo de contrafirma de esta suscripcion: '
      + 'hable con el responsable legal antes de continuar');
  }

  const empresa = empresaService.getById(fila.id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${fila.id_empresa}`);
  }
  // Sin saber quien firmo por la Empresa no hay contrafirma (parrafo 10 del
  // texto vigente). Se comprueba ANTES de mandar el codigo: es mejor que el
  // operador reciba un codigo que no va a poder usar.
  _cotejarFirmante(fila, empresa);

  const otp = generateOTP();
  const otpHash = hashOTPHmac(otp, fila.id_empresa, PROPOSITO_OTP_CONTRAFIRMA);
  const enviadoAt = new Date().toISOString();

  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET contrafirma_otp_hash = ?, contrafirma_otp_intentos = 0,
        contrafirma_otp_envios = contrafirma_otp_envios + 1,
        contrafirma_codigo_enviado_at = ?, contrafirma_canal = ?,
        contrafirma_estado = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(otpHash, enviadoAt, canal, ESTADOS_CONTRAFIRMA.CODIGO_ENVIADO, fila.id);

  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_CODIGO_ENVIADO',
    `intento=${envios + 1}`, ctx.ip, ctx.user_agent);

  try {
    await mailer.sendOTP({
      to: canal,
      otp,
      tipo: 'anexo_nube_contrafirma',
      context: {
        id_suscripcion: fila.id,
        empresa: fila.id_empresa,
        version: fila.version,
      },
    });
  } catch (e) {
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ENVIO_FALLIDO',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo enviar el codigo de contrafirma del Anexo de Nube', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(502, 'ENVIO_FALLIDO',
      'No se pudo enviar el correo con el codigo de contrafirma: intentalo otra vez');
  }

  return {
    expira_en_segundos: config.ttl.otpSeconds,
    // Enmascarado: el canal se muestra, no se imprime entero.
    canal: actaAnexoNube.enmascararCorreo(canal),
  };
}

/**
 * Contrafirma el Anexo de Nube: el SEGUNDO acto.
 *
 * Con este acto el instrumento queda EJECUTADO. Por eso el motivo es
 * obligatorio y el acto queda con su rastro completo.
 *
 * @param {string} id_empresa
 * @param {number|string} id_suscripcion
 * @param {object} datos
 * @param {string} datos.otp - el codigo de contrafirma.
 * @param {boolean} datos.acepta - que quien contrafirma lo acepta de forma expresa.
 * @param {object} ctx - { actor, motivo, ip, user_agent }.
 * @returns {Promise<object>}
 */
async function contrafirmarAnexoNube(id_empresa, id_suscripcion, datos, ctx = {}) {
  const fila = _filaContrafirmable(id_empresa, id_suscripcion);

  // EL MOTIVO: es un acto de K+AIR con efecto sobre el expediente. Sin motivo
  // no hay quien lo hizo ni por que.
  const motivo = typeof ctx.motivo === 'string' ? ctx.motivo.trim() : '';
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para contrafirmar el Anexo de Nube');
  }

  // LA ACEPTACION EXPRESA: quien contrafirma tiene que marcar que la acepta.
  if (!datos || datos.acepta !== true) {
    throw new AppError(400, 'ACEPTACION_REQUERIDA',
      'La contrafirma tiene que ser expresa: el que la hace tiene que marcar que la acepta');
  }

  // EL CODIGO, ANTES QUE NADA
  if (!fila.contrafirma_otp_hash || !fila.contrafirma_codigo_enviado_at) {
    throw new AppError(400, 'CODIGO_NO_SOLICITADO',
      'Primero hay que pedir el codigo de contrafirma');
  }
  if (isExpired(fila.contrafirma_codigo_enviado_at, config.ttl.otpSeconds)) {
    throw new AppError(400, 'CODIGO_EXPIRADO', 'El codigo vencio: pida uno nuevo');
  }
  const otp = typeof datos.otp === 'string' ? datos.otp.trim() : '';
  if (!verifyOTPHmac(otp, fila.contrafirma_otp_hash, fila.id_empresa, PROPOSITO_OTP_CONTRAFIRMA)) {
    const intentos = Number(fila.contrafirma_otp_intentos || 0) + 1;
    const bloqueo = intentos >= config.ttl.otpMaxAttempts;
    db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
      SET contrafirma_otp_intentos = ?, contrafirma_estado = ?, updated_at = datetime('now')
      WHERE id = ?`)
      .run(intentos, bloqueo ? ESTADOS_CONTRAFIRMA.BLOQUEADA : fila.contrafirma_estado, fila.id);
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_CODIGO_INVALIDO',
      `intento=${intentos}`, ctx.ip, ctx.user_agent);
    if (bloqueo) {
      _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_CODIGO_BLOQUEADO',
        `intentos=${intentos}`, ctx.ip, ctx.user_agent);
      throw new AppError(429, 'CODIGO_BLOQUEADO',
        'Se agotaron los intentos de verificacion del codigo de contrafirma');
    }
    throw new AppError(400, 'CODIGO_INVALIDO', 'El codigo no es correcto');
  }

  const empresa = empresaService.getById(id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${id_empresa}`);
  }

  // QUIEN FIRMO POR LA EMPRESA (parrafo 10 del texto vigente).
  const cotejo = _cotejarFirmante(fila, empresa);

  // QUIEN CONTRAFIRMA POR GESSTIAR, Y CON QUE FACULTAD.
  //
  // El cotejo anterior demuestra la facultad del lado de la EMPRESA: que
  // quien suscribio es el representante legal de su ficha. Este demuestra la
  // del lado de GESSTIAR: que quien hace el segundo acto puede firmarlo por
  // la empresa. Son los dos lados opuestos del mismo instrumento y hacen
  // falta los dos: sin el primero el Anexo no se contrafirma, y sin el
  // segundo la contrafirma no dice CON QUE PODER se firmo.
  //
  // La condicion la puso el abogado (respuesta a P7, 10-nov-2026): "La
  // ejecucion por una persona distinta del representante legal de Gesstiar
  // S.A.S. requerira acreditar previamente la facultad de representacion o
  // poder suficiente, que debera conservarse en el expediente". Si la
  // facultad no esta acreditada, el servicio responde 409
  // FACULTAD_NO_ACREDITADA y NO se cierra el acto.
  const actor = ctx.actor || null;
  const facultad = poderesEncargado.verificarFacultadContrafirmante(actor);
  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FACULTAD_VERIFICADA',
    `resultado=${facultad.resultado} instrumento=${facultad.instrumento_ref}`,
    ctx.ip, ctx.user_agent);

  // La evidencia del PRIMER acto: la suscripcion de la Empresa.
  let evidenciaSuscripcion = {};
  try {
    evidenciaSuscripcion = fila.evidencia ? JSON.parse(fila.evidencia) : {};
  } catch (e) {
    evidenciaSuscripcion = {};
  }

  const contrafirmadoAt = new Date().toISOString();

  const evidencia = {
    fuente: 'contrafirma_kair',
    id_suscripcion: fila.id,
    version: fila.version,
    hash: fila.hash_texto,
    // EL PRIMER ACTO: la suscripcion de la Empresa.
    suscrito_at: fila.firmado_at,
    // EL SEGUNDO ACTO: la contrafirma.
    contrafirmado_at: contrafirmadoAt,
    actor,
    motivo,
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
    // El canal por el que salio el codigo: enmascarado. El completo vive en la
    // columna de la suscripcion, no en la evidencia que se resume al manifiesto.
    canal_codigo: actaAnexoNube.enmascararCorreo(fila.contrafirma_canal),
    // La verificacion de quien firmo por la Empresa: es lo que sostiene esta
    // contrafirma.
    verificacion_firmante: cotejo,
    // La acreditacion de la facultad de quien contrafirma POR GESSTIAR: con
    // que poder se hizo el segundo acto. Sin este dato, el acta diria quien
    // firmo pero no con que poder, y el manifiesto declararia ejecutado un
    // instrumento sin el contraste que lo sostiene.
    facultad,
    fase: 2,
  };

  // EL ACTA DE LA CONTRAFIRMA: EL DOCUMENTO QUE QUEDA
  // Mismo criterio que en el gemelo del Anexo de Encargo: el archivo se
  // escribe ANTES de tocar la base. Si el acta no se puede generar o
  // escribir, la contrafirma NO se cierra. Y si la transaccion falla despues,
  // el acta se borra: no puede quedar un archivo sin registro ni un registro
  // sin archivo.
  let acta = null;
  try {
    acta = await actaAnexoNube.generarActaContrafirma({
      id_suscripcion: fila.id,
      id_empresa: fila.id_empresa,
      empresa: empresa.razon_social || fila.id_empresa,
      version: fila.version,
      hash_texto: fila.hash_texto,
      suscrito_at: fila.firmado_at,
      nombre_firmante: cotejo.firmante,
      cargo_firmante: cotejo.cargo,
      correo_firmante: fila.correo_firmante,
      codigo_enviado_at: evidenciaSuscripcion.codigo_enviado_at || null,
      codigo_verificado_at: evidenciaSuscripcion.codigo_verificado_at || null,
      ip_suscripcion: evidenciaSuscripcion.ip || null,
      user_agent_suscripcion: evidenciaSuscripcion.user_agent || null,
      contrafirmado_at: contrafirmadoAt,
      canal_codigo: fila.contrafirma_canal,
      contrafirma_codigo_enviado_at: fila.contrafirma_codigo_enviado_at,
      contrafirma_codigo_verificado_at: contrafirmadoAt,
      actor,
      motivo,
      ip: ctx.ip || null,
      user_agent: ctx.user_agent || null,
      representante_legal_ficha: cotejo.ficha,
      verificacion_firmante: cotejo.resultado,
      // La facultad acreditada de quien contrafirma por Gesstiar: es la
      // seccion 5 del acta.
      facultad_contrafirmante: facultad,
    });
    actaAnexoNube.guardarActa(acta.filename, acta.buffer);
  } catch (e) {
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ACTA_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo generar el acta de contrafirma del Anexo de Nube', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(500, 'ACTA_NO_GENERADA',
      'No se pudo generar el acta de contrafirma: la contrafirma no se cerro. '
      + 'Intentelo otra vez con el mismo codigo.');
  }

  evidencia.acta_hash = acta.hash;
  evidencia.acta_bytes = acta.bytes;
  evidencia.acta_archivo = acta.filename;
  const evidenciaTexto = JSON.stringify(evidencia);

  // LAS DOS ESCRITURAS, EN UNA SOLA TRANSACCION
  // La suscripcion (el segundo acto) y la ficha de la Empresa (la fecha de
  // EJECUCION del instrumento). Si una de las dos falla, las dos se deshacen.
  const anterior = db.prepare(`SELECT anexo_nube_ejecutado_at FROM gh_firma_empresas
    WHERE id_empresa = ?`).get(id_empresa);
  try {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
        SET contrafirmado_at = ?, contrafirma_actor = ?, contrafirma_motivo = ?,
            contrafirma_evidencia = ?, contrafirma_acta_hash = ?,
            contrafirma_acta_bytes = ?, contrafirma_acta_archivo = ?,
            contrafirma_ip = ?, contrafirma_user_agent = ?,
            contrafirma_otp_hash = NULL,
            contrafirma_estado = ?, updated_at = datetime('now')
        WHERE id = ?`)
        // EL ORDEN DE LOS ARGUMENTOS ES EL DE LOS SIGNOS DE INTERROGACION.
        .run(contrafirmadoAt, actor, motivo, evidenciaTexto, acta.hash, acta.bytes,
          acta.filename, ctx.ip || null, ctx.user_agent || null,
          ESTADOS_CONTRAFIRMA.CONTRAFIRMADA, fila.id);

      // LA FECHA DE EJECUCION DEL INSTRUMENTO. Es OTRO campo que
      // `anexo_nube_firmado_at`: ese es el PRIMER acto (la suscripcion de la
      // Empresa) y no se toca. Este es el SEGUNDO.
      db.prepare(`UPDATE gh_firma_empresas
        SET anexo_nube_ejecutado_at = ?, updated_at = datetime('now')
        WHERE id_empresa = ?`)
        .run(contrafirmadoAt, id_empresa);

      // El rastro append-only de la ficha de la Empresa: quien lo cambio,
      // desde donde y por que.
      auditoriaService.registrarCampo({
        id_empresa,
        campo: 'anexo_nube_ejecutado_at',
        valor_anterior: anterior ? anterior.anexo_nube_ejecutado_at : null,
        valor_nuevo: contrafirmadoAt,
        actor: actor || 'kair:contrafirma',
        ip: ctx.ip || null,
        user_agent: ctx.user_agent || null,
        motivo,
      });
    });
    tx();
  } catch (e) {
    try {
      fs.unlinkSync(actaAnexoNube.rutaActa(acta.filename));
    } catch (_) { /* el archivo nunca llego a escribirse */ }
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo cerrar la contrafirma del Anexo de Nube', {
      id_empresa: id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw e;
  }

  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FIRMADA',
    `version=${fila.version} hash=${fila.hash_texto}`, ctx.ip, ctx.user_agent);
  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ACTA_GENERADA',
    `hash=${acta.hash} bytes=${acta.bytes}`, ctx.ip, ctx.user_agent);

  logger.info('Anexo de Nube contrafirmado por K+AIR (fase 2)', {
    id_empresa: id_empresa, id_suscripcion: fila.id, version: fila.version,
    acta_hash: acta.hash,
  });

  return {
    contrafirmado: true,
    version: fila.version,
    hash: fila.hash_texto,
    suscrito_at: fila.firmado_at,
    contrafirmado_at: contrafirmadoAt,
    evidencia,
    acta: {
      hash: acta.hash,
      bytes: acta.bytes,
      archivo: acta.filename,
    },
  };
}

// =============================================================================
// 6. LA CERTIFICACION DE LA FACULTAD DE UNA CONTRAFIRMA YA HECHA
// =============================================================================
//
// CUANDO SE USA
// -------------
// Cuando la contrafirma se hizo con un despliegue ANTERIOR a la exigencia del
// abogado (P7, 10-nov-2026): el segundo acto quedo registrado sin la
// acreditacion de la facultad. En ese caso el manifiesto declara
// `contrafirma_facultad: null` y el item `contrafirma_nube` del gate NO puede
// quedar ok, porque el segundo acto no dice con que poder se firmo.
//
// QUE HACE Y QUE NO HACE
// ----------------------
// Comprobacion: comprueba que la persona que HIZO EL ACTO (el
// `contrafirma_actor` que quedo registrado) tenga la facultad acreditada, y
// escribe esa acreditacion en la evidencia del acto y en el rastro
// append-only.
//
// NO toca: `contrafirmado_at`, la huella del acta, ni
// `anexo_nube_ejecutado_at`. El segundo acto ya ocurrio y no se reescribe: lo
// que se anade es el dato que le faltaba, con su fecha y su responsable. Por
// eso el acta (que ya tiene su huella registrada) NO se regenera: el dato
// vive en la evidencia, que es donde el manifiesto lo lee.
//
// ES UN ACTO ADMINISTRATIVO, COMO TODOS LOS DE ESTE SERVICIO
// ----------------------------------------------------------
// Exige actor y motivo, y queda en el rastro. Quien certifica es un TESTIGO:
// la facultad que se certifica es la de quien hizo el acto, no la de quien
// certifica.
//
// @param {string} id_empresa
// @param {number|string} id_suscripcion
// @param {object} ctx - { actor, motivo, ip, user_agent }.
// @returns {object}
// ============================================================================

/**
 * Certifica la facultad de una contrafirma ya registrada.
 *
 * @param {string} id_empresa
 * @param {number|string} id_suscripcion
 * @param {object} ctx - { actor, motivo, ip, user_agent }.
 * @returns {object}
 */
function registrarFacultadEnContrafirma(id_empresa, id_suscripcion, ctx = {}) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_nube_suscripciones
    WHERE id = ? AND id_empresa = ?`).get(id_suscripcion, id_empresa);
  if (!fila) {
    throw new AppError(404, 'SUSCRIPCION_NO_ENCONTRADA',
      'No existe esa suscripcion para esa empresa');
  }
  if (!fila.contrafirmado_at) {
    throw new AppError(409, 'CONTRAFIRMA_NO_REGISTRADA',
      'Esa suscripcion todavia no esta contrafirmada: no hay nada que certificar');
  }

  const actor = typeof ctx.actor === 'string' ? ctx.actor.trim() : '';
  if (!actor) {
    throw new AppError(400, 'ACTOR_REQUERIDO',
      'X-Admin-Actor es obligatorio: la certificacion tiene que quedar atribuida a una persona');
  }
  const motivo = typeof ctx.motivo === 'string' ? ctx.motivo.trim() : '';
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para certificar la facultad de una contrafirma');
  }

  let evidencia = {};
  try {
    evidencia = fila.contrafirma_evidencia ? JSON.parse(fila.contrafirma_evidencia) : {};
  } catch (e) {
    evidencia = {};
  }
  if (evidencia.facultad) {
    throw new AppError(409, 'FACULTAD_YA_REGISTRADA',
      'La contrafirma ya tiene acreditada su facultad: no se toca');
  }

  // La facultad es la de QUIEN HIZO EL ACTO, no la de quien certifica.
  const facultad = poderesEncargado.verificarFacultadContrafirmante(fila.contrafirma_actor);
  const certificadoAt = new Date().toISOString();
  evidencia.facultad = Object.assign({}, facultad, {
    certificado_por: actor,
    certificado_at: certificadoAt,
    certificado_motivo: motivo,
  });

  db.prepare(`UPDATE gh_firma_anexo_nube_suscripciones
    SET contrafirma_evidencia = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(JSON.stringify(evidencia), fila.id);

  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FACULTAD_CERTIFICADA',
    `actor=${fila.contrafirma_actor} resultado=${facultad.resultado} `
    + `instrumento=${facultad.instrumento_ref} certificado_por=${actor}`,
    ctx.ip, ctx.user_agent);

  logger.info('Facultad de la contrafirma del Anexo de Nube certificada', {
    id_empresa, id_suscripcion: fila.id, actor: fila.contrafirma_actor,
    certificado_por: actor,
  });

  return {
    id_suscripcion: fila.id,
    id_empresa: fila.id_empresa,
    contrafirmado_at: fila.contrafirmado_at,
    actor: fila.contrafirma_actor,
    facultad: evidencia.facultad,
    certificado_por: actor,
    certificado_at: certificadoAt,
  };
}

// =============================================================================
// 7. LECTURA: LAS SUSCRIPCIONES DE UNA EMPRESA Y SU RASTRO
// =============================================================================
//
// Son las dos mismas funciones que tiene el gemelo del Anexo de Encargo
// (`services/anexoEncargo.js`), sobre las tablas de este anexo. Viven en los
// dos servicios y no en uno compartido porque cada tabla tiene su nombre y su
// forma: una función compartida con el nombre de la tabla inyectado sería más
// corta de escribir y más fácil de equivocar.

/**
 * Las suscripciones de una Empresa, de la más reciente a la más antigua.
 *
 * El orden es `id DESC` porque el id es un AUTOINCREMENT: el id más alto es
 * el más nuevo. La más reciente es la que manda para el operador (la que está
 * viva); las anteriores quedan para el expediente.
 *
 * @param {string} id_empresa
 * @returns {object[]} las filas de la tabla, de la más reciente a la más antigua.
 */
function suscripcionesDeEmpresa(id_empresa) {
  if (typeof id_empresa !== 'string' || id_empresa.length === 0) return [];
  return db.prepare(`SELECT * FROM gh_firma_anexo_nube_suscripciones
    WHERE id_empresa = ? ORDER BY id DESC`).all(id_empresa);
}

/**
 * El rastro de una suscripción: los eventos, del primero al último.
 *
 * Devuelve SOLO los cinco campos del evento. Lo que tiene que poder leer el
 * operador es QUÉ pasó, CUÁNDO, desde QUÉ IP y con QUÉ navegador.
 *
 * @param {number|string} id_suscripcion
 * @returns {object[]} { evento, detalle, fecha_hora, ip, user_agent }, en orden.
 */
function eventosDeSuscripcion(id_suscripcion) {
  const id = parseInt(id_suscripcion, 10);
  if (!Number.isInteger(id) || id <= 0) return [];
  return db.prepare(`SELECT evento, detalle, fecha_hora, ip, user_agent
    FROM gh_firma_anexo_nube_eventos
    WHERE id_suscripcion = ? ORDER BY id ASC`).all(id);
}

module.exports = {
  VERSION_MODELO,
  RUTA_MODELO,
  TTL_ENLACE_HORAS,
  MAX_ENVIOS_CODIGO,
  ESTADOS,
  ESTADOS_CONTRAFIRMA,
  modeloVigente,
  urlDocumento,
  crearSuscripcion,
  anularSuscripcion,
  contextoPublico,
  solicitarCodigo,
  suscribir,
  solicitarContrafirmaAnexoNube,
  contrafirmarAnexoNube,
  registrarFacultadEnContrafirma,
  // Alias con el nombre del diseno y del gemelo del Anexo de Encargo. Mismo
  // servicio, mismos dos actos: que el operador no tenga que recordar dos
  // nombres para la misma cosa.
  solicitarCodigoContrafirma: solicitarContrafirmaAnexoNube,
  contrafirmar: contrafirmarAnexoNube,
  suscripcionesDeEmpresa,
  eventosDeSuscripcion,
};
