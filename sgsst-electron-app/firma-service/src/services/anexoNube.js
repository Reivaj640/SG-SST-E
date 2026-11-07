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
const path = require('path');
const crypto = require('crypto');

const db = require('../db/connection');
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errors');
const { generateToken, hashTokenHmac, tokenHashCandidates } = require('../crypto/token');
const { generateOTP, hashOTPHmac, verifyOTPHmac, isExpired } = require('../crypto/otp');
const empresaService = require('./empresa');
const mailer = require('./mailer');

// La raíz del repo que contiene el Servicio (sgsst-electron-app): ahí vive
// la carpeta `legal/` con el texto del Anexo de Nube.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * La versión del Anexo de Nube que se puede suscribir.
 *
 * La v1.0 era un MODELO: su propio texto decía que no se firmaba hasta
 * completar el bloque de pendientes. La v1.1 es la primera susceptible de
 * suscripción. El archivo se lee del disco y su huella se calcula sobre sus
 * bytes: no hay una huella declarada a mano que se pueda desalinear.
 */
const VERSION_MODELO = '1.1';
const RUTA_MODELO = path.join(REPO_ROOT, 'legal', `anexo-nube-v${VERSION_MODELO}.html`);

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
// 5. LECTURA: LAS SUSCRIPCIONES DE UNA EMPRESA Y SU RASTRO
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
  modeloVigente,
  urlDocumento,
  crearSuscripcion,
  anularSuscripcion,
  contextoPublico,
  solicitarCodigo,
  suscribir,
  suscripcionesDeEmpresa,
  eventosDeSuscripcion,
};
