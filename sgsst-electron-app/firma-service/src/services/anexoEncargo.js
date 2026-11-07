/**
 * LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO POR LA EMPRESA
 * ============================================================================
 *
 * QUÉ HACE
 * --------
 * Abre el canal por el que una Empresa suscribe el Anexo de Encargo (el
 * contrato de encargo de tratamiento de datos entre la Empresa responsable y
 * Gesstiar S.A.S. como encargado, art. 25 del Decreto 1377 de 2013) sin que un
 * operador tenga que registrar la firma a mano y sin que la firma dependa de
 * un acta, de un correo físico ni de una cita.
 *
 * Es el MISMO canal del Anexo de Nube (`services/anexoNube.js`), replicado
 * pieza por pieza: enlace de un solo uso, código de verificación al correo del
 * firmante, aceptación expresa, huella del texto que se firma, y rastro
 * append-only. Lo que cambia son cuatro cosas, y están en §3 del plan de
 * suscripción digital del 6-nov-2026.
 *
 * LAS CUATRO DIFERENCIAS CON EL ANEXO DE NUBE
 * ------------------------------------------
 * 1. **LA VERSIÓN Y LA HUELLA SALEN DEL MANIFIESTO, NO DEL CÓDIGO.** El Anexo
 *    de Nube tiene su versión fija en el código (`VERSION_MODELO = '1.1'`) y su
 *    archivo con nombre versionado. El Anexo de Encargo se versiona POR FECHA
 *    (`2026-11-06`) y la etiqueta la pone un generador
 *    (`scripts/generar-anexo-encargo.js`) desde la fuente de la matriz de
 *    finalidades, para que el documento y el manifiesto no puedan
 *    desalinearse. Una constante en el código podría desincronizarse del
 *    manifiesto sin que nadie lo notara: por eso la versión y la huella se
 *    LEEN del manifiesto (`legal-readiness.json` → `anexo_encargo`) y el
 *    archivo del servidor tiene que tener EXACTAMENTE esa huella.
 * 2. **EL §11 LO DILIGENCIA LA EMPRESA.** El texto canónico se suscribe tal
 *    cual, con sus cinco huecos; los cinco datos (razón social, NIT/C.C.,
 *    domicilio, correo y representante) los declara la Empresa en la pantalla y
 *    quedan en la fila de la suscripción, en el acta y en la evidencia. Es el
 *    precedente ya establecido con el Anexo de Nube: los datos de la Empresa no
 *    se diligencian en el modelo.
 * 3. **SON DOS PARTES.** El §12 tiene dos bloques de firma. Esta fase es la
 *    de la Empresa; la contrafirma de K+AIR es otra fase (y otro commit).
 * 4. **LA VERDAD POR EMPRESA VIVE EN LA BASE.** La firma de la Empresa se
 *    escribe en `gh_firma_empresas.anexo_encargo_firmado_at` (con el rastro de
 *    la ficha), que es lo que lee el ítem `empresas_base` del gate. El
 *    manifiesto declara el INSTRUMENTO, no a las Empresas: si el manifiesto
 *    cambiara por cada Empresa que firma, sería un deploy por Empresa.
 *
 * "FIRMADA" EN ESTA TABLA NO QUIEVE DECIR "EL CONTRATO ESTÁ EJECUTADO"
 * --------------------------------------------------------------------
 * El estado `FIRMADA` de la fila significa **la Empresa suscribió** (fase 1).
 * El Anexo de Encargo es un instrumento BILATERAL: hasta que K+AIR no
 * contrafirme (fase 2, `contrafirmado_at`), el instrumento NO está ejecutado y
 * el manifiesto legal NO puede decir `estado: "firmado"`. Son dos actos y
 * hacen falta los dos.
 *
 * LAS SIETE PROPIEDADES DE SEGURIDAD (las mismas del Anexo de Nube)
 * ------------------------------------------------------------------
 *  1. El enlace es la credencial y es de un solo uso: en la base solo vive su
 *     HMAC (`token_hash`), nunca el enlace en claro. Caduca a las 72 horas y
 *     admite 5 envíos de código como máximo.
 *  2. El enlace NO habilita la firma: hace falta el código de verificación
 *     (que sale por la cuenta de K+AIR, nunca por la de la Empresa) Y la
 *     aceptación expresa.
 *  3. El código no se guarda en claro (HMAC con el ámbito de la Empresa), expira
 *     con el TTL del config y tiene intentos limitados: se bloquea la
 *     suscripción.
 *  4. La aceptación expresa es obligatoria: sin `acepta: true` no hay firma.
 *  5. Lo que la Empresa lee es lo que firma: el texto se sirve desde el
 *     servidor, no desde el sitio público, para que no existan dos copias.
 *  6. `TEXTO_MODIFICADO` (409): si el texto cambió entre abrir la suscripción
 *     y firmar, no se firma.
 *  7. El rastro es inalterable (`gh_firma_anexo_encargo_eventos`, triggers en
 *     su propia migración) y la firma escribe además en el rastro de la ficha
 *     de la Empresa, con el valor anterior, el nuevo, quién, su IP, su
 *     navegador y el motivo.
 *
 * LO QUE ESTE SERVICIO NO HACE
 * ----------------------------
 * - No inventa la versión ni la huella: las lee del manifiesto y las contrasta
 *   con los bytes del archivo del servidor.
 * - No declara el instrumento ejecutado: eso exige los dos actos.
 * - No borra ni reescribe una suscripción. Si hay que corregirla, se registra
 *   otra por el camino administrativo, con motivo, y quedan las dos en el
 *   rastro.
 * - No levanta la excepción de habilitación: el Anexo de Encargo es un
 *   contrato, no una excepción operativa.
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
const manifiestoLegal = require('./manifiestoLegal');

// La raíz del repo que contiene el Servicio (sgsst-electron-app): ahí vive
// la carpeta `legal/` con el texto del Anexo de Encargo.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * El texto del Anexo de Encargo, tal como vive en el servidor.
 *
 * No lleva versión en el nombre: la versión es una FECHA que la pone el
 * generador (`scripts/generar-anexo-encargo.js`), y el manifiesto es quien la
 * declara.
 */
const RUTA_MODELO = path.join(REPO_ROOT, 'legal', 'anexo-encargo.html');

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

/**
 * Los CINCO datos del §11 ("Datos de contacto de las partes"), con su largo
 * máximo.
 *
 * Son los huecos que el texto canónico deja: el modelo se suscribe con ellos
 * vacíos y es la Empresa quien los declara. Un Anexo de Encargo sin ellos es
 * débil: el §11 es donde se identifica al Responsable del tratamiento.
 */
const DATOS_S11 = [
  { clave: 'razon_social', max: 200 },
  { clave: 'nit', max: 60 },
  { clave: 'domicilio', max: 300 },
  { clave: 'correo', max: 254 },
  { clave: 'representante', max: 200 },
];

// =============================================================================
// HELPERS
// =============================================================================

function _sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
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
 * El texto vigente del Anexo de Encargo: su versión y su huella.
 *
 * LA VERSIÓN Y LA HUELLA SALEN DEL MANIFIESTO. El archivo del servidor tiene
 * que tener EXACTAMENTE esa huella: si no, hay dos textos distintos (el que
 * declara el manifiesto y el que leería la Empresa) y eso es un fallo de
 * despliegue, no un error de la Empresa.
 *
 * Si el archivo no está en el servidor, NO se inventa una versión: el servicio
 * se niega a abrir una suscripción (503). Es un fallo de despliegue, no un
 * error de la Empresa.
 *
 * @param {string} [ruta] - otro archivo a leer. Existe para que los tests
 *   puedan apuntar a una COPIA TEMPORAL y comprobar qué pasa cuando el texto
 *   cambia entre que se abre la suscripción y el momento de suscribirse, sin
 *   tocar el archivo legal.
 * @param {object} [opciones]
 * @param {object} [opciones.manifiesto] - manifiesto inyectado (tests).
 * @returns {{version: string, hash: string, hash_archivo: string, bytes: number, coincide: boolean}}
 */
function modeloVigente(ruta = RUTA_MODELO, opciones = {}) {
  const opcionesManifiesto = {};
  if (opciones.manifiesto) opcionesManifiesto.manifiesto = opciones.manifiesto;
  const man = manifiestoLegal.manifiesto(opcionesManifiesto);
  if (!man.existe) {
    logger.error('No se puede leer el manifiesto legal en el servidor', {
      ruta: man.ruta, error: man.error,
    });
    throw new AppError(503, 'ANEXO_ENCARGO_NO_DISPONIBLE',
      'El manifiesto legal no está disponible en el servidor: no se puede abrir una suscripción');
  }

  const enc = (man.datos && man.datos.anexo_encargo) || {};
  const version = _texto(enc.version, 40);
  const hash = _texto(enc.hash, 64);
  if (!version || !hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    logger.error('El manifiesto no declara una versión y una huella válidas del Anexo de Encargo', {
      version: enc.version, hash: enc.hash,
    });
    throw new AppError(503, 'ANEXO_ENCARGO_NO_DISPONIBLE',
      'El manifiesto legal no declara la versión y la huella del Anexo de Encargo: '
      + 'no se puede abrir una suscripción');
  }

  let buf;
  try {
    buf = fs.readFileSync(ruta);
  } catch (e) {
    logger.error('No se encuentra el texto del Anexo de Encargo en el servidor', {
      ruta,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(503, 'ANEXO_ENCARGO_NO_DISPONIBLE',
      'El texto del Anexo de Encargo no está disponible en el servidor: no se puede abrir una suscripción');
  }

  const hashArchivo = _sha256(buf);
  return {
    version,
    hash: hash.toLowerCase(),
    hash_archivo: hashArchivo,
    bytes: buf.length,
    coincide: hashArchivo === hash.toLowerCase(),
  };
}

/**
 * La dirección donde se lee el texto del Anexo de Encargo.
 *
 * NO es la del sitio público: es la del propio servicio
 * (`/anexo-encargo/documento`). Lo que la Empresa lee tiene que ser EXACTAMENTE
 * el archivo cuya huella registra el servicio: si el enlace apuntara al sitio,
 * habría dos copias y se podría leer una mientras el servicio registra la
 * huella de la otra.
 */
function urlDocumento() {
  const base = String(config.publicUrl || '').replace(/\/+$/, '');
  return `${base}/anexo-encargo/documento`;
}

/**
 * Escribe en el rastro append-only de la suscripción.
 */
function _evento(id_suscripcion, id_empresa, evento, detalle, ip, user_agent) {
  db.prepare(`INSERT INTO gh_firma_anexo_encargo_eventos
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
  return db.prepare(`SELECT * FROM gh_firma_anexo_encargo_suscripciones
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
      'El enlace no corresponde a ninguna suscripción del Anexo de Encargo');
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
    db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
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

/**
 * Los cinco datos del §11 que la Empresa declara, ya normalizados.
 *
 * @param {object} declarado - lo que declaró la Empresa.
 * @returns {object} los cinco, con sus claves siempre presentes.
 * @throws AppError 400 si falta alguno o si el correo no es válido.
 */
function _datosS11(declarado) {
  const salida = {};
  const faltan = [];
  for (const { clave, max } of DATOS_S11) {
    const valor = _texto(declarado && declarado[clave], max);
    if (!valor) faltan.push(clave);
    salida[clave] = valor;
  }
  if (faltan.length) {
    throw new AppError(400, 'DATOS_S11_INCOMPLETOS',
      'Faltan datos del §11 del Anexo de Encargo: ' + faltan.join(', ')
      + '. El texto se suscribe con sus huecos, pero la Empresa debe declarar sus datos');
  }
  if (!_correoValido(salida.correo)) {
    throw new AppError(400, 'DATOS_S11_INCOMPLETOS',
      'El correo declarado en el §11 del Anexo de Encargo no es un correo válido');
  }
  return salida;
}

/**
 * Los cinco datos del §11 tal como salen de la ficha de la Empresa.
 *
 * Es el PRELLENADO de la pantalla: la Empresa puede confirmarlos o
 * corregirlos. Los datos que mandan son los que ella declara.
 */
function datosDeFicha(empresa) {
  if (!empresa) return {};
  return {
    razon_social: _texto(empresa.razon_social, 200),
    nit: _texto(empresa.nit, 60),
    domicilio: _texto(empresa.domicilio, 300),
    correo: _texto(empresa.responsable_tratamiento_correo, 254)
      || _texto(empresa.canal_pqrs, 254),
    representante: _texto(empresa.representante_legal, 200),
  };
}

/**
 * La suscripción anterior de la misma Empresa, si ya firmó.
 *
 * Se usa para NO pisar una firma: si la Empresa ya suscribió un texto y esta
 * suscripción es de otro texto, el error es 409 y la corrección se registra por
 * el canal administrativo, con su motivo.
 */
function _firmaPrevia(id_empresa) {
  return db.prepare(`SELECT * FROM gh_firma_anexo_encargo_suscripciones
    WHERE id_empresa = ? AND estado = ?
    ORDER BY id DESC LIMIT 1`).get(id_empresa, ESTADOS.FIRMADA) || null;
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
 * @param {object} [datos.datos_empresa] - prellenado de los cinco datos del §11.
 * @param {object} [ctx] - { actor, motivo, ip, user_agent }
 * @param {object} [opciones]
 * @param {object} [opciones.manifiesto] - manifiesto inyectado (tests).
 * @returns {object} { token, url, expira_en, version, hash }
 */
async function crearSuscripcion(id_empresa, datos, ctx = {}, opciones = {}) {
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

  // El prellenado de los cinco datos del §11: lo que hay en la ficha, con lo
  // que el operador haya declarado por encima.
  const prellenado = Object.assign(datosDeFicha(empresa), datos && datos.datos_empresa || {});

  // La versión y la huella son las del MANIFIESTO, y el archivo del servidor
  // tiene que tener esa misma huella: si no, hay dos textos y el que leería la
  // Empresa no es el que declara el manifiesto. Es un fallo de despliegue.
  const modelo = modeloVigente(RUTA_MODELO, opciones);
  if (!modelo.coincide) {
    logger.error('El texto del Anexo de Encargo del servidor no es el que declara el manifiesto', {
      hash_manifiesto: modelo.hash, hash_archivo: modelo.hash_archivo,
    });
    throw new AppError(503, 'ANEXO_ENCARGO_NO_DISPONIBLE',
      'El texto del Anexo de Encargo del servidor no corresponde al que declara el manifiesto: '
      + 'no se puede abrir una suscripción');
  }

  const token = generateToken();
  const tokenHash = hashTokenHmac(token);
  const expira = new Date(Date.now() + (TTL_ENLACE_HORAS * 3600 * 1000)).toISOString();

  const info = db.prepare(`INSERT INTO gh_firma_anexo_encargo_suscripciones
    (id_empresa, token_hash, version, hash_texto, datos_empresa, correo_firmante,
     nombre_firmante, cargo_firmante, estado, expira_enlace_at,
     ip_creacion, user_agent_creacion, creado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id_empresa, tokenHash, modelo.version, modelo.hash, JSON.stringify(prellenado),
      correo.toLowerCase(), nombre, cargo, ESTADOS.PENDIENTE, expira,
      ctx.ip || null, ctx.user_agent || null, ctx.actor || null);

  const id = info.lastInsertRowid;
  _evento(id, id_empresa, 'SUSCRIPCION_CREADA',
    `version=${modelo.version} hash=${modelo.hash}`, ctx.ip, ctx.user_agent);

  const url = `${String(config.publicUrl || '').replace(/\/+$/, '')}/anexo-encargo/${token}`;

  try {
    await mailer.sendAnexoEncargoInvitacion({
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
    db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
      SET estado = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(ESTADOS.ANULADA, id);
    _evento(id, id_empresa, 'ENVIO_FALLIDO',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo enviar el enlace de suscripción del Anexo de Encargo', {
      id_empresa, id_suscripcion: id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(502, 'ENVIO_FALLIDO',
      'No se pudo enviar el correo con el enlace de suscripción: no se abrió ninguna suscripción');
  }

  logger.info('Suscripción del Anexo de Encargo abierta', {
    id_empresa, id_suscripcion: id, version: modelo.version,
  });

  return {
    token,
    url,
    expira_en: expira,
    version: modelo.version,
    hash: modelo.hash,
    correo_firmante: correo.toLowerCase(),
    datos_empresa: prellenado,
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
 * se hizo, porque el rastro es lo que queda después.
 */
function anularSuscripcion(id_empresa, id_suscripcion, ctx = {}) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_encargo_suscripciones
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
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
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
    db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
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
    vigente = actual.coincide
      && actual.hash === fila.hash_texto
      && actual.version === fila.version;
  } catch (e) {
    vigente = false;
  }

  let datos = {};
  try {
    datos = fila.datos_empresa ? JSON.parse(fila.datos_empresa) : {};
  } catch (e) {
    datos = {};
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
    // Los cinco datos del §11, prellenados con la ficha. La Empresa los
    // confirma o los corrige: los que ella declare son los que quedan.
    datos_empresa: datos,
    expira_en: fila.expira_enlace_at,
    documento_url: urlDocumento(),
    codigo_enviado: Boolean(fila.otp_enviado_at),
    firmado_at: fila.firmado_at,
    // La contrafirma de K+AIR es OTRO acto: sin ella el instrumento no está
    // ejecutado, aunque la Empresa ya haya suscrito.
    contrafirmado_at: fila.contrafirmado_at || null,
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
  // mandar un código sería pedirle a la Empresa que firme un texto que no se
  // le puede mostrar. Se dice antes, no después de escribir el código.
  //
  // Se comparan DOS cosas contra la huella de la fila: la del manifiesto (que
  // es la que declara el instrumento) y la del archivo del servidor (que es la
  // que leería la Empresa). Si cualquiera de las dos cambió, el texto cambió.
  const vigente = modeloVigente();
  if (!vigente.coincide || vigente.hash !== fila.hash_texto
      || vigente.version !== fila.version) {
    _evento(fila.id, fila.id_empresa, 'TEXTO_MODIFICADO',
      `suscrito=${fila.hash_texto} manifiesto=${vigente.hash} archivo=${vigente.hash_archivo}`,
      ctx.ip, ctx.user_agent);
    throw new AppError(409, 'TEXTO_MODIFICADO',
      'El texto del Anexo de Encargo cambió después de abrir esta suscripción: '
      + 'hay que abrir una suscripción nueva con la versión vigente');
  }

  const otp = generateOTP();
  const otpHash = hashOTPHmac(otp, fila.id_empresa);
  const enviadoAt = new Date().toISOString();

  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
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
      tipo: 'anexo_encargo',
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
    logger.error('No se pudo enviar el código de suscripción del Anexo de Encargo', {
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
 * Suscribe el Anexo de Encargo y lo registra en la ficha de la Empresa.
 *
 * ESTA ES LA FASE 1: LA FIRMA DE LA EMPRESA. El instrumento es bilateral y
 * todavía le falta la contrafirma de K+AIR (fase 2).
 *
 * @param {string} token
 * @param {object} datos
 * @param {string} datos.otp - el código de verificación.
 * @param {boolean} datos.acepta - que la Empresa leyó y acepta.
 * @param {object} [datos.datos_empresa] - los CINCO datos del §11 que declara.
 * @param {object} ctx
 * @param {string} ctx.ip
 * @param {string} ctx.user_agent
 * @param {object} [opciones]
 * @param {string} [opciones.rutaModelo] - ver `modeloVigente()`. Solo para
 *   tests; en producción es el archivo del servidor.
 * @param {object} [opciones.manifiesto] - manifiesto inyectado (tests).
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
  // Lo que se suscribe es UNA VERSIÓN CON SU HUELLA. Si el manifiesto o el
  // archivo del servidor cambiaron después de que se abrió el enlace, la
  // Empresa estaría firmando un texto que no es el que se le mostró ni el que
  // se le declaró por correo. En ese caso la suscripción NO se completa: se
  // rechaza con 409 y queda el motivo en el rastro.
  const vigente = modeloVigente(opciones.rutaModelo || RUTA_MODELO, opciones);
  if (!vigente.coincide || vigente.hash !== fila.hash_texto
      || vigente.version !== fila.version) {
    _evento(fila.id, fila.id_empresa, 'TEXTO_MODIFICADO',
      `suscrito=${fila.hash_texto} manifiesto=${vigente.hash} archivo=${vigente.hash_archivo}`,
      ctx.ip, ctx.user_agent);
    logger.warn('El texto del Anexo de Encargo cambió después de abrir la suscripción', {
      id_empresa: fila.id_empresa,
      id_suscripcion: fila.id,
      hash_suscrito: fila.hash_texto,
      hash_manifiesto: vigente.hash,
      hash_archivo: vigente.hash_archivo,
    });
    throw new AppError(409, 'TEXTO_MODIFICADO',
      'El texto del Anexo de Encargo cambió después de abrir esta suscripción: '
      + 'hay que abrir una suscripción nueva con la versión vigente');
  }

  if (datos.acepta !== true) {
    throw new AppError(400, 'ACEPTACION_REQUERIDA',
      'La Empresa debe marcar que leyó el Anexo de Encargo y que acepta sus condiciones');
  }
  if (!fila.otp_hash || !fila.otp_enviado_at) {
    throw new AppError(400, 'CODIGO_NO_SOLICITADO',
      'Primero hay que pedir el código de verificación');
  }
  if (isExpired(fila.otp_enviado_at, config.ttl.otpSeconds)) {
    throw new AppError(400, 'CODIGO_EXPIRADO',
      'El código venció: pida uno nuevo');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EL CÓDIGO PRIMERO, LOS DATOS DESPUÉS
  // ───────────────────────────────────────────────────────────────────────────
  // Se autentica antes de mirar lo que la Empresa declaró: si el código está
  // mal, el error es el del código (y el intento queda contado). Validar los
  // datos del §11 antes de autenticar haría que un enlace sin código valido
  // recibiera un error de datos, que no es lo que pasó.
  const otp = typeof datos.otp === 'string' ? datos.otp.trim() : '';
  if (!verifyOTPHmac(otp, fila.otp_hash, fila.id_empresa)) {
    const intentos = fila.otp_intentos + 1;
    const bloqueo = intentos >= config.ttl.otpMaxAttempts;
    db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
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

  // Los cinco datos del §11: sin ellos no hay suscripción. El texto canónico
  // se suscribe con sus huecos, pero la Empresa tiene que decir quién es.
  const datosS11 = _datosS11(datos.datos_empresa);

  // ───────────────────────────────────────────────────────────────────────────
  // LA FIRMA DE LA EMPRESA (fase 1)
  // ───────────────────────────────────────────────────────────────────────────
  const empresa = empresaService.getById(fila.id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${fila.id_empresa}`);
  }
  if (empresa.anexo_encargo_firmado_at) {
    // No se pisa una suscripción de otro texto: eso se corrige por el camino
    // administrativo, con motivo, y quedan las dos en el rastro.
    //
    // SI LA FECHA VIENE DEL CIRCUITO FÍSICO (un operador la registró con
    // `POST /internal/admin/empresas/:id/anexo-firmado`), no hay hash en la
    // ficha contra el cual comparar: no se puede probar que sea el mismo
    // instrumento. En ese caso la fecha se re-registra con la de la
    // suscripción digital, y el cambio queda con el valor ANTERIOR, el nuevo,
    // el actor y el motivo en el rastro de la ficha (migraciones 037 y 038).
    // No es una corrección silenciosa: queda escrito qué pasó.
    const previa = _firmaPrevia(fila.id_empresa);
    if (previa && previa.hash_texto !== fila.hash_texto) {
      throw new AppError(409, 'SUSCRIPCION_EXISTENTE',
        'Esta Empresa tiene el Anexo de Encargo suscrito en otra versión: '
        + 'la corrección se registra por el canal administrativo, con su motivo');
    }
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
    // Los cinco datos del §11 tal como los declaró la Empresa.
    datos_empresa: datosS11,
    codigo_enviado_at: fila.otp_enviado_at,
    codigo_verificado_at: firmadoAt,
    enlace_abierto_at: fila.enlace_abierto_at,
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
    // Esto es la FASE 1: la firma de la Empresa. El instrumento es bilateral
    // y todavía le falta la contrafirma de K+AIR.
    fase: 1,
  };
  const evidenciaTexto = JSON.stringify(evidencia);

  // La fecha del Anexo de Encargo en la ficha de la Empresa, con el rastro de
  // la ficha (migraciones 037 y 038): valor anterior, valor nuevo, quién, su
  // IP, su navegador y el motivo.
  empresaService.marcarAnexoFirmado(fila.id_empresa, firmadoAt, {
    actor: `empresa:${fila.id_empresa}`,
    motivo: 'Suscripción del Anexo de Encargo por el enlace de un solo uso',
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
  });

  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET estado = ?, firmado_at = ?, evidencia = ?, datos_empresa = ?,
        ip_firma = ?, user_agent_firma = ?, otp_hash = NULL, updated_at = datetime('now')
    WHERE id = ?`)
    .run(ESTADOS.FIRMADA, firmadoAt, evidenciaTexto, JSON.stringify(datosS11),
      ctx.ip || null, ctx.user_agent || null, fila.id);

  _evento(fila.id, fila.id_empresa, 'SUSCRIPCION_FIRMADA',
    `version=${fila.version} hash=${fila.hash_texto}`, ctx.ip, ctx.user_agent);

  logger.info('Anexo de Encargo suscrito por la Empresa (fase 1)', {
    id_empresa: fila.id_empresa, id_suscripcion: fila.id, version: fila.version,
  });

  return {
    firmado: true,
    version: fila.version,
    hash: fila.hash_texto,
    firmado_at: firmadoAt,
    evidencia,
    // La contrafirma de K+AIR es otro commit: sin ella el instrumento no está
    // ejecutado y el manifiesto no puede decir "firmado".
    contrafirmado: false,
  };
}

module.exports = {
  RUTA_MODELO,
  TTL_ENLACE_HORAS,
  MAX_ENVIOS_CODIGO,
  ESTADOS,
  DATOS_S11,
  modeloVigente,
  urlDocumento,
  datosDeFicha,
  crearSuscripcion,
  anularSuscripcion,
  contextoPublico,
  solicitarCodigo,
  suscribir,
};
