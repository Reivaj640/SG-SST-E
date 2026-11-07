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
 * 4. **LA VERDAD POR EMPRESA VIVE EN LA BASE.** La fase 1 se escribe en
 *    `gh_firma_empresas.anexo_encargo_suscrito_at` (con el rastro de la
 *    ficha), que es lo que lee el ítem `empresas_base` del gate. El
 *    manifiesto declara el INSTRUMENTO, no a las Empresas: si el manifiesto
 *    cambiara por cada Empresa que firma, sería un deploy por Empresa.
 *
 * LOS AJUSTES DEL ABOGADO (7-nov-2026)
 * ------------------------------------
 * El abogado respondió las diez preguntas del plan y pidió tres refuerzos:
 * una cláusula expresa del mecanismo en la aceptación, la verificación
 * documental del representante legal y un segundo canal para el código. Los
 * tres están implementados aquí, y el tercero trae una consecuencia que
 * cambia el estado de la Empresa:
 *
 *  - **EL CÓDIGO NO LLEGA AL MISMO BUZÓN QUE EL ENLACE.** El artículo 4 del
 *    Decreto 2364 exige que los datos de creación de la firma correspondan
 *    EXCLUSIVAMENTE al firmante, y un buzón compartido no corresponde a una
 *    persona. El segundo canal lo declara K+AIR al abrir la suscripción (lo
 *    confirma con la Empresa fuera de banda) y no quien hace clic en el
 *    enlace. El servicio lo EXIGE: sin un canal distinto del buzón del
 *    enlace, no se abre la suscripción.
 *  - **QUIEN FIRMA DECLARA SU DOCUMENTO Y SU CALIDAD**, y K+AIR verifica esa
 *    declaración contra el certificado de la cámara de comercio, el RUT o el
 *    poder. El número viaja cifrado (`services/representante.js`), y de él
 *    solo se muestra el final.
 *  - **LA FASE 1 NO HABILITA A LA EMPRESA.** Se escribe
 *    `anexo_encargo_suscrito_at`, no `anexo_encargo_firmado_at`: el nombre del
 *    campo de firma solo puede ser cierto cuando el instrumento está
 *    ejecutado por las dos partes. La contrafirma (fase 2) escribe el campo de
 *    firma, y solo entonces la Empresa queda habilitada para firmar
 *    documentos de sus trabajadores.
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
const {
  generateOTP, hashOTPHmac, verifyOTPHmac, isExpired, PROPOSITO_OTP_CONTRAFIRMA,
} = require('../crypto/otp');
const empresaService = require('./empresa');
const mailer = require('./mailer');
const manifiestoLegal = require('./manifiestoLegal');
const actaEncargo = require('./actaEncargo');
const textosAceptacion = require('./anexoEncargoTextos');
const representanteService = require('./representante');

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

/**
 * EL SEGUNDO CANAL DEL CÓDIGO DE VERIFICACIÓN
 * --------------------------------------------
 *
 * POR QUÉ NO PUEDE SER EL MISMO BUZÓN DEL ENLACE
 * ------------------------------------------------
 * El artículo 4 del Decreto 2364 (hoy 2.2.2.47.4 del Decreto 1074) pide
 * que los datos de creación de la firma correspondan EXCLUSIVAMENTE al
 * firmante. Un buzón compartido —el corporativo de la Empresa, que puede
 * leer más de una persona— no corresponde a una persona. El abogado lo señaló
 * como una de las dos grietas de confiabilidad del método: «el código llega
 * al mismo buzón que el enlace».
 *
 * POR QUÉ LO DECLARA K+AIR Y NO LA PANTALLA
 * ------------------------------------------
 * Si quien tiene el enlace pudiera elegir el canal del código, el control
 * del buzón no probaría nada: bastaría con que un intruso declare una
 * dirección propia y complete la firma. El canal lo declara el operador al
 * abrir la suscripción, lo confirma con la Empresa fuera de banda, y queda
 * anotado QUIÉN lo confirmó y CÓMO.
 *
 * EL CANAL POR TELÉFONO NO EXISTE TODAVÍA
 * ---------------------------------------
 * El abogado lo menciona entre las opciones ("código a un teléfono"). El
 * servicio no tiene pasarela de SMS: el único canal de salida es el correo.
 * Por eso el tipo `telefono` NO está implementado. Declararlo sería prometer
 * una entrega que no ocurre, y un código que "se envió" y nunca llegó es
 * peor que un canal declarado con honestidad.
 */
const CANAL_CODIGO_TIPOS = {
  CORREO: 'correo',
};

/**
 * LOS DOCUMENTOS CONTRA LOS QUE K+AIR VERIFICA AL REPRESENTANTE.
 *
 * El abogado (pregunta 7): contra el certificado de existencia y
 * representación de la cámara de comercio, o contra el RUT de la Empresa. Y
 * si quien firma es un delegado, el poder o la autorización.
 */
const TIPOS_DOCUMENTO_VERIFICACION = [
  'CERTIFICADO_CAMARA',
  'RUT',
  'PODER',
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
 *
 * La función vive en `services/actaEncargo.js` y se usa en los dos lados: el
 * contexto público de la pantalla y el acta de suscripción. Si fueran dos
 * implementaciones distintas, la Empresa vería un correo diferente en la
 * pantalla y en el acta, y el registro dejaría de cuadrar con lo que ella
 * leyó.
 *
 * `representante@empresa.com` → `re***@empresa.com`
 */

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
 * El segundo canal por donde sale el código de verificación.
 *
 * Ver la nota de `CANAL_CODIGO_TIPOS` para el porqué. Aquí solo está la regla:
 * tiene que ser un correo válido y tiene que ser DISTINTO del buzón que
 * recibe el enlace.
 *
 * @param {object} datos - lo que declaró el operador al abrir la suscripción.
 * @param {string} correoFirmante - el buzón que recibe el enlace.
 * @returns {string} el canal, en minúsculas.
 * @throws AppError 400 si falta, no es un correo, o es el mismo del enlace.
 */
function _canalCodigo(datos, correoFirmante) {
  const canal = _texto(datos && datos.canal_codigo, 254);
  if (!canal || !_correoValido(canal)) {
    throw new AppError(400, 'CANAL_CODIGO_REQUERIDO',
      'La suscripción necesita un segundo canal para el código de verificación: '
      + 'un correo válido y distinto del que recibe el enlace');
  }
  if (canal.toLowerCase() === String(correoFirmante || '').trim().toLowerCase()) {
    throw new AppError(400, 'CANAL_CODIGO_IGUAL',
      'El canal del código de verificación tiene que ser distinto del correo '
      + 'que recibe el enlace: el código no puede llegar al mismo buzón');
  }
  return canal.toLowerCase();
}

/**
 * QUIEN FIRMA: su documento y la calidad con la que firma.
 *
 * EL NÚMERO VIAJA CIFRADO
 * -----------------------
 * Es la misma regla que el representante legal de la ficha: el número se
 * guarda cifrado con `services/representante.js` y de él solo se muestra el
 * final. En el expediente queda el documento cifrado y, al lado, el tipo de
 * documento contra el que K+AIR lo verificó.
 *
 * LA CALIDAD IMPORTA PORQUE CAMBIA EL TEXTO
 * ------------------------------------------
 * Un delegado no es el representante legal: declarar lo contrario sería una
 * falsidad. Por eso hay dos declaraciones, y la que se imprime es la que
 * corresponde a la calidad declarada.
 *
 * @param {object} declarado - { documento, calidad }.
 * @param {string} id_empresa - el ámbito de la llave de cifrado.
 * @returns {{documento: string, calidad: string, ultimos4: string}}
 * @throws AppError 400 si falta el documento o la calidad no es válida.
 */
function _datosRepresentante(declarado, id_empresa) {
  const documento = _texto(declarado && declarado.documento, 60);
  if (!documento) {
    throw new AppError(400, 'REPRESENTANTE_NO_IDENTIFICADO',
      'Falta el número de documento de quien suscribe: la Empresa debe declararlo');
  }
  const calidades = Object.values(textosAceptacion.CALIDADES);
  const calidad = String((declarado && declarado.calidad) || '').trim().toUpperCase();
  if (!calidades.includes(calidad)) {
    throw new AppError(400, 'REPRESENTANTE_NO_IDENTIFICADO',
      'La calidad de quien suscribe tiene que ser ' + calidades.join(' o '));
  }
  const cifrado = representanteService.snapshotParaGuardar(
    { numero_identificacion: documento }, id_empresa,
  );
  if (!cifrado) {
    throw new AppError(500, 'REPRESENTANTE_NO_CIFRADO',
      'No se pudo guardar el documento de quien suscribe: la suscripción no se cierra');
  }
  return {
    documento: cifrado,
    calidad,
    ultimos4: representanteService.ultimosDeTexto(documento),
  };
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

  // EL SEGUNDO CANAL DEL CÓDIGO. Se valida ANTES de tocar la base: si el
  // código fuera a salir al mismo buzón que el enlace, el método no probaría
  // que quien firma sea la persona que dice ser (art. 4 del Decreto 2364), y
  // no tiene sentido abrir una suscripción así.
  const canalCodigo = _canalCodigo(datos, correo);
  const canalConfirmacion = _texto(datos && datos.canal_codigo_confirmacion, 300);
  if (!canalConfirmacion) {
    throw new AppError(400, 'CANAL_CODIGO_SIN_CONFIRMAR',
      'Hay que declarar CÓMO se confirmó el segundo canal con la Empresa '
      + '(canal_codigo_confirmacion): es la prueba de que ese canal es de la '
      + 'Empresa y no el de quien abrió el enlace');
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
     ip_creacion, user_agent_creacion, creado_por,
     canal_codigo, canal_codigo_tipo, canal_codigo_confirmacion,
     canal_codigo_confirmado_por, canal_codigo_confirmado_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id_empresa, tokenHash, modelo.version, modelo.hash, JSON.stringify(prellenado),
      correo.toLowerCase(), nombre, cargo, ESTADOS.PENDIENTE, expira,
      ctx.ip || null, ctx.user_agent || null, ctx.actor || null,
      canalCodigo, CANAL_CODIGO_TIPOS.CORREO, canalConfirmacion,
      ctx.actor || null, new Date().toISOString());

  const id = info.lastInsertRowid;
  _evento(id, id_empresa, 'SUSCRIPCION_CREADA',
    `version=${modelo.version} hash=${modelo.hash} canal_codigo=${actaEncargo.enmascararCorreo(canalCodigo)}`,
    ctx.ip, ctx.user_agent);

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

/**
 * Registra la VERIFICACIÓN DOCUMENTAL de quien firmó.
 *
 * POR QUÉ ESTE PASO EXISTE
 * ------------------------
 * El método de firma probaba control de un buzón, no que quien firmara fuera
 * el representante legal ni que tuviera poder. Para un contrato sobre datos de
 * salud, eso es insuficiente: la Empresa podría alegar que el firmante no
 * tenía poder y que el acto no la obliga (pregunta 7 del abogado).
 *
 * La verificación es un ACTO DE K+AIR, no de la Empresa: alguien de la
 * operación contrasta el documento que la Empresa declaró contra el
 * certificado de la cámara de comercio, el RUT o el poder, y deja constancia
 * de contra qué documento lo contrastó y de dónde quedó radicado.
 *
 * CUÁNDO SE HACE
 * --------------
 * Después de la suscripción: el documento declarado lo escribe la Empresa en
 * la pantalla, así que antes de ese momento no hay nada que verificar. Y el
 * paso siguiente —la contrafirma de K+AIR— NO se puede hacer sin esta
 * verificación: es la que cierra la brecha.
 *
 * @param {string} id_empresa
 * @param {number} id_suscripcion
 * @param {object} datos
 * @param {string} datos.tipo_documento - 'CERTIFICADO_CAMARA' | 'RUT' | 'PODER'.
 * @param {string} datos.referencia - el radicado o la referencia del documento.
 * @param {string} [datos.nota] - lo que hizo falta para verificarlo.
 * @param {object} ctx - { actor, motivo, ip, user_agent }; el motivo es obligatorio.
 * @returns {object}
 */
function verificarRepresentante(id_empresa, id_suscripcion, datos, ctx = {}) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_encargo_suscripciones
    WHERE id = ? AND id_empresa = ?`).get(id_suscripcion, id_empresa);
  if (!fila) {
    throw new AppError(404, 'SUSCRIPCION_NO_ENCONTRADA',
      'No existe esa suscripción para esa empresa');
  }
  if (fila.estado !== ESTADOS.FIRMADA) {
    throw new AppError(409, 'SUSCRIPCION_NO_FIRMADA',
      'Esta suscripción no está firmada: todavía no hay a quién verificar');
  }

  const tipo = String((datos && datos.tipo_documento) || '').trim().toUpperCase();
  if (!TIPOS_DOCUMENTO_VERIFICACION.includes(tipo)) {
    throw new AppError(400, 'VERIFICACION_INCOMPLETA',
      'El tipo de documento con el que se verificó tiene que ser uno de: '
      + TIPOS_DOCUMENTO_VERIFICACION.join(', '));
  }
  const referencia = _texto(datos && datos.referencia, 300);
  if (!referencia) {
    throw new AppError(400, 'VERIFICACION_INCOMPLETA',
      'Hay que decir contra qué documento se verificó y dónde quedó radicado '
      + '(referencia): sin eso no hay prueba en el expediente');
  }
  const motivo = typeof ctx.motivo === 'string' ? ctx.motivo.trim() : '';
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para registrar la verificación del representante');
  }

  const verificacion = {
    tipo_documento: tipo,
    referencia,
    nota: _texto(datos && datos.nota, 500),
    verificado_por: ctx.actor || null,
    verificado_at: new Date().toISOString(),
  };
  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET representante_verificacion = ?, representante_verificado_por = ?,
        representante_verificado_at = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(JSON.stringify(verificacion), ctx.actor || null, verificacion.verificado_at, fila.id);

  _evento(fila.id, id_empresa, 'REPRESENTANTE_VERIFICADO',
    `tipo=${tipo} referencia=${referencia}`, ctx.ip, ctx.user_agent);
  logger.info('Representante verificado documentalmente', {
    id_empresa, id_suscripcion: fila.id, tipo_documento: tipo,
  });

  return {
    verificado: true,
    id_suscripcion: fila.id,
    tipo_documento: tipo,
    referencia,
    verificado_por: verificacion.verificado_por,
    verificado_at: verificacion.verificado_at,
  };
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
    correo_firmante: actaEncargo.enmascararCorreo(fila.correo_firmante),
    // EL SEGUNDO CANAL DEL CÓDIGO, enmascarado. La Empresa lo ve para saber
    // dónde lo espera: el código no llega a este buzón, sino a este otro.
    canal_codigo: actaEncargo.enmascararCorreo(fila.canal_codigo),
    canal_codigo_confirmado: Boolean(fila.canal_codigo_confirmado_at),
    nombre_firmante: fila.nombre_firmante,
    cargo_firmante: fila.cargo_firmante,
    // LOS TEXTOS LEGALES QUE LA EMPRESA TIENE QUE ACEPTAR. Van en el
    // contexto (y no escritos en el HTML) para que la pantalla y el acta
    // digan EXACTAMENTE lo mismo: si el texto viviera en los dos lados, un
    // día dejarían de coincidir y la Empresa aceptaría una cosa mientras el
    // acta archivaría otra.
    textos: textosAceptacion.textosPublicos(),
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

  // El código sale por el SEGUNDO CANAL. Una suscripción sin segundo canal
  // no debería existir (se exige al abrirla), pero si una fila vieja se
  // colara, aquí se dice con claridad en vez de mandar el código al buzón
  // del enlace: ese envío sería exactamente la grieta que el abogado señaló.
  if (!fila.canal_codigo) {
    throw new AppError(409, 'CANAL_CODIGO_NO_DEFINIDO',
      'Esta suscripción no tiene un segundo canal definido para el código: '
      + 'hay que abrir una suscripción nueva');
  }

  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET otp_hash = ?, otp_intentos = 0, otp_envios = otp_envios + 1,
        otp_enviado_at = ?, estado = ?, updated_at = datetime('now')
    WHERE id = ?`)
    .run(otpHash, enviadoAt, ESTADOS.CODIGO_ENVIADO, fila.id);

  _evento(fila.id, fila.id_empresa, 'CODIGO_ENVIADO',
    `intento=${fila.otp_envios + 1}`, ctx.ip, ctx.user_agent);

  try {
    await mailer.sendOTP({
      to: fila.canal_codigo,
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
 * Suscribe el Anexo de Encargo, genera su acta y lo registra en la ficha de
 * la Empresa.
 *
 * ESTA ES LA FASE 1: LA FIRMA DE LA EMPRESA. El instrumento es bilateral y
 * todavía le falta la contrafirma de K+AIR (fase 2).
 *
 * POR QUÉ ES ASÍNCRONA
 * --------------------
 * Porque genera el ACTA DE SUSCRIPCIÓN (un PDF con pdf-lib) y la escribe en
 * disco. El acta se genera y se escribe ANTES de tocar la base: si no se
 * puede, la suscripción no se cierra. Es el mismo criterio del commit de las
 * firmas (archivos primero, base después).
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
 * @returns {Promise<object>} el registro de la suscripción.
 */
async function suscribir(token, datos, ctx = {}, opciones = {}) {
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
      'La Empresa debe marcar que leyó el Anexo de Encargo, que acepta la cláusula '
      + 'del mecanismo electrónico y que declara su representación');
  }
  if (datos.acepta_tratamiento !== true) {
    throw new AppError(400, 'ACEPTACION_REQUERIDA',
      'La Empresa debe marcar que leyó la información sobre el tratamiento de sus '
      + 'datos personales para la ejecución de este Anexo');
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

  // QUIEN FIRMA: su documento y la calidad con la que firma. Sin esto, el
  // método solo probaría control de un buzón (pregunta 7 del abogado).
  const representante = _datosRepresentante(datos.representante, fila.id_empresa);

  // ───────────────────────────────────────────────────────────────────────────
  // LA FIRMA DE LA EMPRESA (fase 1)
  // ───────────────────────────────────────────────────────────────────────────
  const empresa = empresaService.getById(fila.id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${fila.id_empresa}`);
  }
  // ¿La Empresa ya tiene un Anexo de Encargo? Se miran LOS DOS campos:
  //
  //   - `anexo_encargo_suscrito_at`: lo que escribe la fase 1 (la Empresa
  //     suscribió). Es el campo que escribe ESTE flujo.
  //   - `anexo_encargo_firmado_at`: lo que escribe el circuito físico (un
  //     operador registró un Anexo ya firmado en papel) y, desde la fase 2,
  //     la contrafirma de K+AIR.
  //
  // Los dos significan lo mismo para esta pregunta: que la Empresa ya tiene
  // un Anexo y esta suscripción no puede pisarlo.
  if (empresa.anexo_encargo_suscrito_at || empresa.anexo_encargo_firmado_at) {
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
    // El SEGUNDO CANAL del código, enmascarado como el correo. El completo
    // vive en la columna de la suscripción, no en la evidencia que se
    // resume al manifiesto.
    canal_codigo: actaEncargo.enmascararCorreo(fila.canal_codigo),
    canal_codigo_tipo: fila.canal_codigo_tipo,
    nombre_firmante: fila.nombre_firmante,
    cargo_firmante: fila.cargo_firmante,
    // Los cinco datos del §11 tal como los declaró la Empresa.
    datos_empresa: datosS11,
    // QUIEN FIRMA. El documento va cifrado en la fila de la suscripción; aquí
    // solo queda el final, que es lo que se puede mostrar.
    representante: {
      nombre: datosS11.representante,
      documento_ultimos4: representante.ultimos4,
      calidad: representante.calidad,
    },
    // LA ACEPTACIÓN: la huella de las PALABRAS que la Empresa marcó. Es la
    // prueba de qué aceptó, no solo de que marcó una casilla.
    aceptacion_hash: textosAceptacion.hashAceptacion(representante.calidad),
    aceptacion_tratamiento_hash: textosAceptacion.hashTratamiento(),
    codigo_enviado_at: fila.otp_enviado_at,
    codigo_verificado_at: firmadoAt,
    enlace_abierto_at: fila.enlace_abierto_at,
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
    // Esto es la FASE 1: la firma de la Empresa. El instrumento es bilateral
    // y todavía le falta la contrafirma de K+AIR.
    fase: 1,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EL ACTA DE SUSCRIPCIÓN: EL DOCUMENTO QUE QUEDA
  // ───────────────────────────────────────────────────────────────────────────
  // El acta se genera y se escribe ANTES de tocar la base (el mismo orden del
  // commit de las firmas: archivos primero, base después). Si el acta no se
  // puede generar o no se puede escribir, la suscripción NO se cierra: es
  // preferible que la Empresa reintente a que quede una suscripción sin el
  // documento que la acredita. El código de verificación sigue siendo válido
  // hasta que vence, así que el reintento no obliga a pedir otro código.
  let acta = null;
  // El documento del representante, listo para imprimir: solo el final.
  const documentoEnmascarado = representanteService.numeroEnmascarado(
    representanteService.leerSnapshot(representante.documento), fila.id_empresa,
  );
  try {
    acta = await actaEncargo.generarActa({
      id_suscripcion: fila.id,
      id_empresa: fila.id_empresa,
      empresa: empresa.razon_social || fila.id_empresa,
      version: fila.version,
      hash_texto: fila.hash_texto,
      firmado_at: firmadoAt,
      nombre_firmante: fila.nombre_firmante,
      cargo_firmante: fila.cargo_firmante,
      correo_firmante: fila.correo_firmante,
      // El segundo canal del código: el acta dice que el código NO salió por
      // el buzón del enlace, y lo dice sin nombrar la dirección entera.
      canal_codigo: fila.canal_codigo,
      // Quién firmó y con qué poder.
      representante_nombre: datosS11.representante,
      representante_documento: documentoEnmascarado,
      representante_calidad: representante.calidad,
      // LOS TEXTOS QUE LA EMPRESA ACEPTÓ. Van enteros en el acta: el acta es
      // la constancia de lo que se aceptó, y una constancia que solo dice
      // "aceptó" no prueba nada.
      texto_mecanismo: textosAceptacion.MECANISMO,
      texto_declaracion: textosAceptacion.declaracionRepresentacion(representante.calidad),
      texto_tratamiento: textosAceptacion.TRATAMIENTO_DATOS,
      aceptacion_hash: textosAceptacion.hashAceptacion(representante.calidad),
      aceptacion_tratamiento_hash: textosAceptacion.hashTratamiento(),
      codigo_enviado_at: fila.otp_enviado_at,
      codigo_verificado_at: firmadoAt,
      enlace_abierto_at: fila.enlace_abierto_at,
      ip: ctx.ip || null,
      user_agent: ctx.user_agent || null,
      datos_empresa: datosS11,
    });
    actaEncargo.guardarActa(acta.filename, acta.buffer);
  } catch (e) {
    _evento(fila.id, fila.id_empresa, 'ACTA_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo generar el acta de suscripción del Anexo de Encargo', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(500, 'ACTA_NO_GENERADA',
      'No se pudo generar el acta de suscripción: la suscripción no se cerró. '
      + 'Inténtelo otra vez con el mismo código.');
  }

  // La huella del acta (la de SUS bytes) y su nombre. NO la ruta absoluta: la
  // evidencia de esta suscripción se copia al manifiesto legal, y una ruta del
  // servidor no puede aparecer en un documento que sale del servidor. El
  // nombre sale del id de la suscripción, y de ahí se rehace la ruta.
  evidencia.acta_hash = acta.hash;
  evidencia.acta_bytes = acta.bytes;
  evidencia.acta_archivo = acta.filename;
  const evidenciaTexto = JSON.stringify(evidencia);

  // ───────────────────────────────────────────────────────────────────────────
  // LAS DOS ESCRITURAS, EN UNA SOLA TRANSACCIÓN
  // ───────────────────────────────────────────────────────────────────────────
  // La fecha del Anexo de Encargo en la ficha de la Empresa (con el rastro de
  // la ficha: valor anterior, valor nuevo, quién, su IP, su navegador y el
  // motivo) y el estado de la suscripción. Si una de las dos falla, las dos
  // se deshacen: no puede quedar la fecha de la ficha sin la suscripción, ni
  // al revés. Y si la transacción falla, el acta se borra del disco: no puede
  // quedar un archivo sin registro ni un registro sin archivo.
  try {
    const tx = db.transaction(() => {
      // LA FASE 1 ESCRIBE `anexo_encargo_suscrito_at`, NO LA FECHA DE FIRMA.
      //
      // El campo de firma significa "el instrumento está ejecutado": las dos
      // partes firmaron. Escribirlo aquí haría que el sistema afirmara que el
      // contrato está firmado cuando solo firmó una parte, y además
      // habilitaría a la Empresa a firmar documentos de sus trabajadores
      // antes de la contrafirma de K+AIR. Es la opción conservadora que
      // eligió el owner el 7-nov-2026, sobre el análisis del abogado del
      // mismo día ("la empresa no debería empezar a usar el servicio hasta
      // que K+AIR firme la otra parte").
      empresaService.marcarAnexoSuscrito(fila.id_empresa, {
        fecha: firmadoAt,
        version: fila.version,
        hash: fila.hash_texto,
        evidencia: evidenciaTexto,
      }, {
        actor: `empresa:${fila.id_empresa}`,
        motivo: 'Suscripción del Anexo de Encargo por el enlace de un solo uso',
        ip: ctx.ip || null,
        user_agent: ctx.user_agent || null,
      });

      db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
        SET estado = ?, firmado_at = ?, evidencia = ?, datos_empresa = ?,
            ip_firma = ?, user_agent_firma = ?, otp_hash = NULL,
            representante_documento = ?, representante_calidad = ?,
            aceptacion_hash = ?, aceptacion_tratamiento_hash = ?,
            updated_at = datetime('now')
        WHERE id = ?`)
        // EL ORDEN DE LOS ARGUMENTOS ES EL DE LOS SIGNOS DE INTERROGACIÓN.
        // `fila.id` va AL FINAL: es el del `WHERE`. Con un `?` de más o de
        // menos, better-sqlite3 avisa; con el MISMO número pero cambiados de
        // sitio, no avisa de nada y la sentencia no actualiza ninguna fila
        // (ni falla). Por eso el orden está anotado aquí.
        .run(ESTADOS.FIRMADA, firmadoAt, evidenciaTexto, JSON.stringify(datosS11),
          ctx.ip || null, ctx.user_agent || null,
          representante.documento, representante.calidad,
          evidencia.aceptacion_hash, evidencia.aceptacion_tratamiento_hash,
          fila.id);
    });
    tx();
  } catch (e) {
    try {
      fs.unlinkSync(actaEncargo.rutaActa(acta.filename));
    } catch (_) { /* el archivo nunca llegó a escribirse */ }
    _evento(fila.id, fila.id_empresa, 'SUSCRIPCION_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo cerrar la suscripción del Anexo de Encargo', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw e;
  }

  _evento(fila.id, fila.id_empresa, 'SUSCRIPCION_FIRMADA',
    `version=${fila.version} hash=${fila.hash_texto}`, ctx.ip, ctx.user_agent);
  _evento(fila.id, fila.id_empresa, 'ACTA_GENERADA',
    `hash=${acta.hash} bytes=${acta.bytes}`, ctx.ip, ctx.user_agent);

  logger.info('Anexo de Encargo suscrito por la Empresa (fase 1)', {
    id_empresa: fila.id_empresa, id_suscripcion: fila.id, version: fila.version,
    acta_hash: acta.hash,
  });

  return {
    firmado: true,
    version: fila.version,
    hash: fila.hash_texto,
    firmado_at: firmadoAt,
    evidencia,
    // El acta: el documento que la Empresa descarga y K+AIR archiva.
    acta: {
      hash: acta.hash,
      bytes: acta.bytes,
      archivo: acta.filename,
    },
    // La contrafirma de K+AIR es otro commit: sin ella el instrumento no está
    // ejecutado y el manifiesto no puede decir "firmado".
    contrafirmado: false,
  };
}

/**
 * El acta de una suscripción, para que la Empresa la descargue (y para que
 * K+AIR la sirva en el expediente).
 *
 * POR QUÉ AQUÍ NO SE APLICA LA CADUCIDAD DEL ENLACE
 * --------------------------------------------------
 * La caducidad protege el ACTO DE FIRMAR: pasadas las 72 horas, el enlace
 * deja de servir para firmar. El acta es el documento de un acto YA HECHO: si
 * la Empresa la descarga al día siguiente, cuando el enlace ya venció, tiene
 * que poder volver a bajarla. El token sigue siendo la credencial (es un
 * enlace secreto, con la huella en la base), y la suscripción tiene que
 * estar FIRMADA: un enlace que no firmó nada no tiene acta.
 *
 * LA HUELLA SE COMPRUEBA AL SERVIR
 * -------------------------------
 * Los bytes que hay en el disco se comparan con la huella que quedó
 * registrada al suscribir. Si no son los mismos, el archivo fue alterado
 * después de escrito: no se sirve como si fuera el original (409
 * ACTA_ALTERADA). Un acta cuya huella no cuadra no es un acta.
 *
 * @param {string} token
 * @returns {{buffer: Buffer, hash: string, bytes: number, filename: string}}
 */
function obtenerActa(token) {
  const fila = _buscarPorToken(token);
  if (!fila) {
    throw new AppError(404, 'ENLACE_NO_VALIDO',
      'El enlace no corresponde a ninguna suscripción del Anexo de Encargo');
  }
  if (fila.estado !== ESTADOS.FIRMADA) {
    throw new AppError(409, 'ACTA_NO_DISPONIBLE',
      'Esta suscripción no está firmada: todavía no hay acta de suscripción');
  }

  let evidencia = {};
  try {
    evidencia = fila.evidencia ? JSON.parse(fila.evidencia) : {};
  } catch (e) {
    evidencia = {};
  }
  const archivo = evidencia.acta_archivo;
  if (!archivo) {
    throw new AppError(404, 'ACTA_NO_DISPONIBLE',
      'No se encontró el acta de esta suscripción');
  }

  const leido = actaEncargo.leerActa(archivo);
  if (!leido.found) {
    throw new AppError(404, 'ACTA_NO_DISPONIBLE',
      'El acta de esta suscripción no está en el servidor');
  }

  const hash = evidencia.acta_hash || null;
  if (hash) {
    const actual = crypto.createHash('sha256').update(leido.buffer).digest('hex');
    if (actual !== String(hash).toLowerCase()) {
      logger.error('El acta en disco no es la que se registró al suscribir', {
        id_empresa: fila.id_empresa, id_suscripcion: fila.id,
        hash_registrado: hash, hash_archivo: actual,
      });
      throw new AppError(409, 'ACTA_ALTERADA',
        'El acta de esta suscripción no coincide con la huella registrada: '
        + 'no se sirve. Escríbanos a adminkair@gmail.com');
    }
  }

  return {
    buffer: leido.buffer,
    hash: hash,
    bytes: evidencia.acta_bytes || leido.buffer.length,
    filename: path.basename(String(archivo)),
  };
}

// =============================================================================
// 5. LA CONTRAFIRMA (FASE 2)
// =============================================================================
//
// QUÉ ES ESTA FASE
// ----------------
// El Anexo de Encargo es bilateral: el §12 tiene dos bloques de firma. La
// fase 1 (la que está arriba) deja constancia de la SÚCRIPCIÓN de la Empresa;
// esta fase deja constancia de la CONTRAFIRMA de K+AIR. Solo con los dos
// actos el instrumento está EJECUTADO, y solo entonces la Empresa queda
// habilitada para firmar documentos de sus trabajadores.
//
// EL CÓDIGO ES DISTINTO
// ---------------------
// El código de la contrafirma tiene su propio propósito de derivación
// (`otp-contrafirma`): los mismos seis dígitos no sirven para los dos actos.
// El código de la suscripción no verifica contra la huella de la contrafirma,
// ni al revés.
//
// EL CANAL NO LO DECLARA QUIEN PIDE LA CONTRAFIRMA
// -------------------------------------------------
// Sale al buzón de protección de datos de K+AIR, que está FIJO en la
// configuración. Es la misma razón por la que el segundo canal de la
// suscripción lo declara K+AIR y no la Empresa: un canal elegido por quien
// pide el acto no probaría nada.
//
// LO QUE NO SE PUEDE SALTAR
// --------------------------
//  - Que la Empresa haya suscrito (si no, no hay nada que contrafirmar).
//  - Que K+AIR haya verificado DOCUMENTALMENTE a quien firmó por la
//    Empresa (el punto 7 del abogado: verificar quién es el representante).
//  - El código (que sale al buzón de K+AIR).
//  - La aceptación expresa de quien contrafirma.
//  - El motivo (`X-Admin-Motivo`): es un acto que habilita a la Empresa.
//
// EL ACTA: UN SEGUNDO ACTA, NO UNA COPIA DEL PRIMERO
// --------------------------------------------------
// El acta de la suscripción ya salió del servidor y la Empresa la conserva con
// su huella: no se puede reescribir. La contrafirma genera SU acta, que cita
// la primera (fecha y huella) y deja por escrito los dos actos.

/**
 * La suscripción que se puede contrafirmar, con todas las condiciones
 * cumplidas.
 *
 * @param {string} id_empresa
 * @param {number} id_suscripcion
 * @returns {object} la fila de la suscripción.
 */
function _filaContrafirmable(id_empresa, id_suscripcion) {
  const fila = db.prepare(`SELECT * FROM gh_firma_anexo_encargo_suscripciones
    WHERE id = ? AND id_empresa = ?`).get(id_suscripcion, id_empresa);
  if (!fila) {
    throw new AppError(404, 'SUSCRIPCION_NO_ENCONTRADA',
      'No existe esa suscripción para esa empresa');
  }
  if (fila.estado !== ESTADOS.FIRMADA) {
    throw new AppError(409, 'SUSCRIPCION_NO_FIRMADA',
      'Esta suscripción no está firmada por la Empresa: no hay nada que contrafirmar');
  }
  if (fila.contrafirmado_at) {
    throw new AppError(409, 'YA_CONTRAFIRMADO',
      'Esta suscripción ya está contrafirmada: el instrumento ya está ejecutado');
  }
  if (!fila.representante_verificacion) {
    throw new AppError(409, 'REPRESENTANTE_NO_VERIFICADO',
      'K+AIR no contrafirma el Anexo sin verificar quién firmó por la Empresa: '
      + 'primero hay que registrar la verificación documental del representante');
  }
  return fila;
}

/**
 * Manda el código de la contrafirma al buzón de protección de datos de K+AIR.
 *
 * @param {string} id_empresa
 * @param {number} id_suscripcion
 * @param {object} [ctx] - { ip, user_agent }.
 * @returns {Promise<object>} { expira_en_segundos, canal }
 */
async function solicitarCodigoContrafirma(id_empresa, id_suscripcion, ctx = {}) {
  const fila = _filaContrafirmable(id_empresa, id_suscripcion);

  // El canal es FIJO: lo declara la configuración de K+AIR, no quien pide la
  // contrafirma. Si el que pide el acto pudiera elegir el canal, el control
  // del buzón no probaría nada.
  const canal = String(config.canalProteccionDatos || '').trim();
  if (!canal) {
    throw new AppError(503, 'CANAL_CONTRAFIRMA_NO_DEFINIDO',
      'El canal de protección de datos de K+AIR no está configurado: no se puede contrafirmar');
  }
  if (fila.contrafirma_otp_envios >= MAX_ENVIOS_CODIGO) {
    throw new AppError(429, 'LIMITE_ENVIOS',
      'Se agotaron los envíos de código de contrafirma de esta suscripción: '
      + 'hable con el responsable legal antes de continuar');
  }

  const otp = generateOTP();
  const otpHash = hashOTPHmac(otp, fila.id_empresa, PROPOSITO_OTP_CONTRAFIRMA);
  const enviadoAt = new Date().toISOString();

  db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
    SET contrafirma_otp_hash = ?, contrafirma_otp_intentos = 0,
        contrafirma_otp_envios = contrafirma_otp_envios + 1,
        contrafirma_otp_enviado_at = ?, contrafirma_canal = ?,
        updated_at = datetime('now')
    WHERE id = ?`)
    .run(otpHash, enviadoAt, canal, fila.id);

  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_CODIGO_ENVIADO',
    `intento=${fila.contrafirma_otp_envios + 1}`, ctx.ip, ctx.user_agent);

  try {
    await mailer.sendOTP({
      to: canal,
      otp,
      tipo: 'anexo_encargo_contrafirma',
      context: {
        id_suscripcion: fila.id,
        empresa: fila.id_empresa,
        version: fila.version,
      },
    });
  } catch (e) {
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ENVIO_FALLIDO',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo enviar el código de contrafirma del Anexo de Encargo', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(502, 'ENVIO_FALLIDO',
      'No se pudo enviar el correo con el código de contrafirma: inténtelo otra vez');
  }

  return {
    expira_en_segundos: config.ttl.otpSeconds,
    // Enmascarado: el canal se muestra, no se imprime entero.
    canal: actaEncargo.enmascararCorreo(canal),
  };
}

/**
 * Contrafirma el Anexo de Encargo: el segundo acto.
 *
 * Con este acto el instrumento queda EJECUTADO y la Empresa queda habilitada
 * para firmar documentos de sus trabajadores. Por eso el motivo es
 * obligatorio y el acto queda con su rastro completo.
 *
 * @param {string} id_empresa
 * @param {number} id_suscripcion
 * @param {object} datos
 * @param {string} datos.otp - el código de contrafirma.
 * @param {boolean} datos.acepta - que quien contrafirma lo acepta de forma expresa.
 * @param {object} ctx - { actor, motivo, ip, user_agent }.
 * @returns {Promise<object>}
 */
async function contrafirmar(id_empresa, id_suscripcion, datos, ctx = {}) {
  const fila = _filaContrafirmable(id_empresa, id_suscripcion);

  // EL MOTIVO: es un acto de K+AIR con efecto sobre el expediente y habilita a
  // la Empresa. Sin motivo no hay quién lo hizo ni por qué.
  const motivo = typeof ctx.motivo === 'string' ? ctx.motivo.trim() : '';
  if (!motivo) {
    throw new AppError(400, 'MOTIVO_REQUERIDO',
      'X-Admin-Motivo es obligatorio para contrafirmar el Anexo de Encargo');
  }

  // LA ACEPTACIÓN EXPRESA: quien contrafirma tiene que marcar que la acepta.
  if (!datos || datos.acepta !== true) {
    throw new AppError(400, 'ACEPTACION_REQUERIDA',
      'La contrafirma tiene que ser expresa: el que la hace tiene que marcar que la acepta');
  }

  // ───────────────────────────────────────────────────────────────────────────
  // EL CÓDIGO, ANTES QUE NADA
  // ───────────────────────────────────────────────────────────────────────────
  if (!fila.contrafirma_otp_hash || !fila.contrafirma_otp_enviado_at) {
    throw new AppError(400, 'CODIGO_NO_SOLICITADO',
      'Primero hay que pedir el código de contrafirma');
  }
  if (isExpired(fila.contrafirma_otp_enviado_at, config.ttl.otpSeconds)) {
    throw new AppError(400, 'CODIGO_EXPIRADO', 'El código venció: pida uno nuevo');
  }
  const otp = typeof datos.otp === 'string' ? datos.otp.trim() : '';
  if (!verifyOTPHmac(otp, fila.contrafirma_otp_hash, fila.id_empresa, PROPOSITO_OTP_CONTRAFIRMA)) {
    const intentos = fila.contrafirma_otp_intentos + 1;
    const bloqueo = intentos >= config.ttl.otpMaxAttempts;
    db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
      SET contrafirma_otp_intentos = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(intentos, fila.id);
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_CODIGO_INVALIDO',
      `intento=${intentos}`, ctx.ip, ctx.user_agent);
    if (bloqueo) {
      throw new AppError(429, 'CODIGO_BLOQUEADO',
        'Se agotaron los intentos de verificación del código de contrafirma');
    }
    throw new AppError(400, 'CODIGO_INVALIDO', 'El código no es correcto');
  }

  const empresa = empresaService.getById(id_empresa);
  if (!empresa) {
    throw new AppError(404, 'EMPRESA_NOT_FOUND', `No existe la empresa ${id_empresa}`);
  }

  let verificacion = {};
  try {
    verificacion = fila.representante_verificacion
      ? JSON.parse(fila.representante_verificacion) : {};
  } catch (e) {
    verificacion = {};
  }
  let datosS11 = {};
  try {
    datosS11 = fila.datos_empresa ? JSON.parse(fila.datos_empresa) : {};
  } catch (e) {
    datosS11 = {};
  }
  // La evidencia del PRIMER acto: el acta de la suscripción, con su huella.
  // La contrafirma la CITA (no la reescribe).
  let evidenciaSuscripcion = {};
  try {
    evidenciaSuscripcion = fila.evidencia ? JSON.parse(fila.evidencia) : {};
  } catch (e) {
    evidenciaSuscripcion = {};
  }

  const contrafirmadoAt = new Date().toISOString();
  const actor = ctx.actor || null;

  const evidencia = {
    fuente: 'contrafirma_kair',
    id_suscripcion: fila.id,
    version: fila.version,
    hash: fila.hash_texto,
    // EL PRIMER ACTO: la suscripción de la Empresa.
    suscrito_at: fila.firmado_at,
    acta_suscripcion_hash: evidenciaSuscripcion.acta_hash || null,
    acta_suscripcion_archivo: evidenciaSuscripcion.acta_archivo || null,
    // EL SEGUNDO ACTO: la contrafirma.
    contrafirmado_at: contrafirmadoAt,
    actor,
    motivo,
    ip: ctx.ip || null,
    user_agent: ctx.user_agent || null,
    // El canal por el que salió el código: enmascarado. El completo vive en la
    // columna de la suscripción, no en la evidencia que se resume al manifiesto.
    canal_codigo: actaEncargo.enmascararCorreo(fila.contrafirma_canal),
    // La verificación documental de quien firmó por la Empresa: es lo que
    // sostiene esta contrafirma.
    representante_verificacion: verificacion,
    fase: 2,
  };

  // ───────────────────────────────────────────────────────────────────────────
  // EL ACTA DE LA CONTRAFIRMA: EL DOCUMENTO QUE QUEDA
  // ───────────────────────────────────────────────────────────────────────────
  // Mismo criterio que en la fase 1: el archivo se escribe ANTES de tocar la
  // base. Si el acta no se puede generar o escribir, la contrafirma NO se
  // cierra. Y si la transacción falla después, el acta se borra: no puede
  // quedar un archivo sin registro ni un registro sin archivo.
  let acta = null;
  try {
    acta = await actaEncargo.generarActaContrafirma({
      id_suscripcion: fila.id,
      id_empresa: fila.id_empresa,
      empresa: empresa.razon_social || fila.id_empresa,
      version: fila.version,
      hash_texto: fila.hash_texto,
      suscrito_at: fila.firmado_at,
      acta_suscripcion_hash: evidenciaSuscripcion.acta_hash || null,
      acta_suscripcion_archivo: evidenciaSuscripcion.acta_archivo || null,
      acta_suscripcion_bytes: evidenciaSuscripcion.acta_bytes || null,
      contrafirmado_at: contrafirmadoAt,
      canal_codigo: fila.contrafirma_canal,
      codigo_enviado_at: fila.contrafirma_otp_enviado_at,
      codigo_verificado_at: contrafirmadoAt,
      actor,
      motivo,
      ip: ctx.ip || null,
      user_agent: ctx.user_agent || null,
      verificacion_representante: verificacion,
      datos_empresa: datosS11,
    });
    actaEncargo.guardarActa(acta.filename, acta.buffer);
  } catch (e) {
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ACTA_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo generar el acta de contrafirma del Anexo de Encargo', {
      id_empresa: fila.id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw new AppError(500, 'ACTA_NO_GENERADA',
      'No se pudo generar el acta de contrafirma: la contrafirma no se cerró. '
      + 'Inténtelo otra vez con el mismo código.');
  }

  evidencia.acta_hash = acta.hash;
  evidencia.acta_bytes = acta.bytes;
  evidencia.acta_archivo = acta.filename;
  const evidenciaTexto = JSON.stringify(evidencia);

  // ───────────────────────────────────────────────────────────────────────────
  // LAS DOS ESCRITURAS, EN UNA SOLA TRANSACCIÓN
  // ───────────────────────────────────────────────────────────────────────────
  // La suscripción (el segundo acto) y la ficha de la Empresa (la fecha de
  // EJECUCIÓN del instrumento, que es la que la habilita). Si una de las dos
  // falla, las dos se deshacen.
  try {
    const tx = db.transaction(() => {
      db.prepare(`UPDATE gh_firma_anexo_encargo_suscripciones
        SET contrafirmado_at = ?, contrafirma_evidencia = ?, contrafirma_acta_hash = ?,
            contrafirma_acta_bytes = ?, contrafirma_acta_archivo = ?,
            contrafirma_actor = ?, contrafirma_motivo = ?, contrafirma_ip = ?,
            contrafirma_user_agent = ?, contrafirma_otp_hash = NULL,
            updated_at = datetime('now')
        WHERE id = ?`)
        // EL ORDEN DE LOS ARGUMENTOS ES EL DE LOS SIGNOS DE INTERROGACIÓN.
        // Con un `?` de más o de menos, better-sqlite3 avisa; con el MISMO
        // número pero cambiados de sitio, no avisa de nada y la sentencia no
        // actualiza ninguna fila (ni falla). Por eso el orden está anotado.
        .run(contrafirmadoAt, evidenciaTexto, acta.hash, acta.bytes, acta.filename,
          actor, motivo, ctx.ip || null, ctx.user_agent || null, fila.id);

      // LA FECHA DE EJECUCIÓN DEL INSTRUMENTO. Este es el campo que
      // `verificarHabilitacionFirma` exige: con él, la Empresa puede firmar
      // documentos de sus trabajadores.
      //
      // Si la fecha venía del circuito FÍSICO (un operador la registró a mano),
      // se reemplaza por la de la contrafirma: desde este momento el
      // instrumento tiene una ejecución digital con evidencia completa, que es
      // más fuerte que un registro de una fecha. La anterior NO se pierde: la
      // escritura va con su rastro (valor anterior, valor nuevo, quién y por
      // qué), y el motivo queda en la evidencia de la contrafirma.
      if (empresa.anexo_encargo_firmado_at) {
        logger.warn('La contrafirma reemplaza una fecha de Anexo de Encargo ya registrada', {
          id_empresa: id_empresa,
          fecha_anterior: empresa.anexo_encargo_firmado_at,
          fecha_nueva: contrafirmadoAt,
        });
      }
      empresaService.marcarAnexoFirmado(id_empresa, contrafirmadoAt, {
        actor: actor || 'kair:contrafirma',
        motivo,
        ip: ctx.ip || null,
        user_agent: ctx.user_agent || null,
      });
    });
    tx();
  } catch (e) {
    try {
      fs.unlinkSync(actaEncargo.rutaActa(acta.filename));
    } catch (_) { /* el archivo nunca llegó a escribirse */ }
    _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FALLIDA',
      e && e.message ? e.message : String(e), ctx.ip, ctx.user_agent);
    logger.error('No se pudo cerrar la contrafirma del Anexo de Encargo', {
      id_empresa: id_empresa, id_suscripcion: fila.id,
      error: e && e.message ? e.message : String(e),
    });
    throw e;
  }

  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_FIRMADA',
    `version=${fila.version} hash=${fila.hash_texto}`, ctx.ip, ctx.user_agent);
  _evento(fila.id, fila.id_empresa, 'CONTRAFIRMA_ACTA_GENERADA',
    `hash=${acta.hash} bytes=${acta.bytes}`, ctx.ip, ctx.user_agent);

  logger.info('Anexo de Encargo contrafirmado por K+AIR (fase 2)', {
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

module.exports = {
  RUTA_MODELO,
  TTL_ENLACE_HORAS,
  MAX_ENVIOS_CODIGO,
  ESTADOS,
  DATOS_S11,
  TIPOS_DOCUMENTO_VERIFICACION,
  modeloVigente,
  urlDocumento,
  datosDeFicha,
  crearSuscripcion,
  anularSuscripcion,
  verificarRepresentante,
  contextoPublico,
  solicitarCodigo,
  suscribir,
  obtenerActa,
  solicitarCodigoContrafirma,
  contrafirmar,
};
