/**
 * Cifrado simétrico (AES-256-GCM) con clave derivada de la llave maestra.
 *
 * POR QUÉ EXISTE ESTE MÓDULO
 * -------------------------
 * El H23 de la auditoría del Capítulo X encontró que el número de documento
 * del representante legal quedaba **en texto claro** dentro de
 * `representante_legal_snapshot`, mientras que el del trabajador sí se
 * guardaba solo como huella.
 *
 * La respuesta obvia —hashear el número, igual que al trabajador— es
 * incorrecta para el representante: su número es PRUEBA DE LA REPRESENTACIÓN.
 * Puede necesitarse en una constancia o en un certificado de existencia y
 * representación legal, y una huella no se puede presentar como prueba.
 *
 * Entonces: **cifrar, no hashear**. El número queda reversible solo para quien
 * tenga la llave, y la llave vive FUERA de la base de datos
 * (`TOKEN_ENCRYPTION_KEY` y su anillo), no en la misma tabla que el dato.
 *
 * LO QUE NO ES ESTE MÓDULO
 * -----------------------
 * No es un sustituto del HMAC de huellas (`src/crypto/hmac.js`). Para BUSCAR
 * por un número (verificar la identidad de quien firma) se usa la huella
 * HMAC: es determinista y se puede comparar. Para CONSERVAR un número que
 * después hay que poder mostrar (la prueba de la representación) se usa el
 * cifrado: es aleatorio y reversible. Son dos necesidades distintas y esta
 * base no las mezcla.
 *
 * FORMATO DEL SOBRE
 * -----------------
 *
 *   enc:v2:<version>:<iv>:<tag>:<cifrado>
 *
 * - `enc:v2` : marca el formato vigente. Una fila heredada (número en claro)
 *   NO empieza por esta marca, y por eso se puede distinguir sin ambigüedad.
 *   El formato `enc:v1` (8B) se sigue leyendo: sus sobres no llevan AAD y
 *   hay filas ya cifradas con él. No se produce `v1` nuevo.
 *
 * AAD (DATOS AUTENTICADOS ADICIONALES)
 * ------------------------------------
 * `v2` ata el sobre a la Empresa (`ambito`) y al CAMPO concreto. Sin esto, un
 * sobre del número del representante podía moverse a otro campo de la misma
 * Empresa y GCM lo abría igual: la etiqueta autenticaba el texto, no el lugar
 * donde estaba guardado. El AAD se construye con los mismos valores que el
 * llamador declara al descifrar; si no coinciden, `final()` falla.
 *
 * El ámbito VACÍO ya no se convierte en `global` para los sobres nuevos: un
 * olvido del llamador no puede terminar en una clave compartida por todas las
 * Empresas.
 * - `version`: la versión de llave con la que se cifró (la del anillo). Sin
 *   esto, rotar la llave volvería ilegibles los números ya cifrados: igual
 *   que el marcador `*_alg` de las huellas, la fila dice con qué se hizo.
 * - `iv`     : vector de inicialización aleatorio (96 bits, el tamaño que
 *   recomienda NIST SP 800-38D para GCM).
 * - `tag`    : etiqueta de autenticación (128 bits). GCM es AEAD: si alguien
 *   modifica el cifrado, la etiqueta no cuadra y el descifrado falla. Un
 *   número alterado en la base de datos no se puede presentar como el
 *   original.
 * - `cifrado`: el texto cifrado, en base64url.
 *
 * AMBITO
 * ------
 * La clave se deriva con HKDF del mismo modo que las huellas, pero con un
 * propósito propio (`cifrado-representante`) y con el ÁMBITO de la Empresa:
 * la misma cédula de un representante en dos Empresas distintas produce dos
 * textos cifrados distintos, y el material de una Empresa no sirve para
 * descifrar la de otra.
 *
 * Ver el plan de cierre §8.1 (corrección del owner: "el número del
 * representante: cifra, no hashees") y SECURITY.md.
 */
'use strict';

const crypto = require('crypto');
const { derivedKey } = require('./hmac');
const { getKeyVersionActual, getKeyMaterial } = require('./keys');

// Propósito por defecto: el número del representante legal. El parámetro
// `proposito` existe para que el módulo no quede atado a un solo uso.
const PROPOSITO_REPRESENTANTE = 'cifrado-representante';

// Campo por defecto: el número del representante. Los demás usos (por ejemplo
// el snapshot de la Empresa) pasan su propio nombre de campo para que el AAD
// los distinga.
const CAMPO_REPRESENTANTE = 'numero_identificacion';

const FORMATO = 'v2';
const PREFIJO = 'enc:' + FORMATO + ':';
const PREFIJO_V1 = 'enc:v1:';
const ALGORITMO = 'aes-256-gcm';
const IV_BYTES = 12;   // 96 bits (NIST SP 800-38D)
const TAG_BYTES = 16;  // 128 bits

function _ambitoRequerido(ambito) {
  if (typeof ambito !== 'string' || ambito.trim().length === 0) {
    throw new Error('cifrado: el ambito (id_empresa) es requerido para los sobres v2');
  }
  return ambito.trim();
}

function _campoRequerido(campo) {
  const valor = (campo === undefined || campo === null || campo === '')
    ? CAMPO_REPRESENTANTE
    : String(campo).trim();
  if (valor.length === 0) {
    throw new Error('cifrado: el campo del sobre es requerido');
  }
  return valor;
}

/**
 * AAD canónico. Se serializa como arreglo para que un `|` dentro de un
 * identificador no pueda confundir dos campos distintos.
 */
function _aad(purpose, ambito, campo) {
  return Buffer.from(
    JSON.stringify(['kair-firma-cifrado', FORMATO, purpose, ambito, campo]),
    'utf8'
  );
}

/**
 * Cifra un texto con AES-256-GCM y devuelve el sobre.
 *
 * @param {string} texto - el valor a cifrar (número de identificación)
 * @param {string} ambito - id_empresa. NO se acepta vacío.
 * @param {string} [proposito] - propósito de la derivación
 * @param {string} [campo] - nombre del campo; por defecto, el número del rep
 * @returns {string} sobre `enc:v2:<version>:<iv>:<tag>:<cifrado>`
 */
function cifrar(texto, ambito, proposito, campo) {
  if (typeof texto !== 'string' || texto.length === 0) {
    throw new Error('cifrado: el texto a cifrar es requerido');
  }
  const scope = _ambitoRequerido(ambito);
  const purpose = proposito || PROPOSITO_REPRESENTANTE;
  const field = _campoRequerido(campo);
  const version = getKeyVersionActual();
  const clave = derivedKey(purpose, scope, version);

  const iv = crypto.randomBytes(IV_BYTES);
  const cifrador = crypto.createCipheriv(ALGORITMO, clave, iv);
  cifrador.setAAD(_aad(purpose, scope, field));
  const datos = Buffer.concat([
    cifrador.update(texto, 'utf8'),
    cifrador.final(),
  ]);
  const tag = cifrador.getAuthTag();

  return PREFIJO + version
    + ':' + iv.toString('base64url')
    + ':' + tag.toString('base64url')
    + ':' + datos.toString('base64url');
}

/**
 * ¿Este valor es un sobre cifrado por este módulo?
 *
 * Sirve para distinguir una fila nueva (cifrada) de una heredada (número en
 * claro) sin ambigüedad: el prefijo es exclusivo de este formato.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esCifrado(valor) {
  return typeof valor === 'string'
    && (valor.startsWith(PREFIJO) || valor.startsWith(PREFIJO_V1));
}

/**
 * Abre un sobre y devuelve el texto en claro.
 *
 * Falla (y no devuelve un valor "parecido") cuando:
 * - el sobre está mal formado,
 * - la versión de llave que declara ya no está en el anillo (el operador
 *   tiene que volver a poner la llave vieja en `FIRMA_HMAC_KEYRING`),
 * - la etiqueta de autenticación no cuadra (el cifrado fue ALTERADO).
 *
 * @param {string} sobre
 * @param {string} ambito - id_empresa. Requerido para v2.
 * @param {string} [proposito]
 * @param {string} [campo] - nombre del campo; por defecto, el número del rep
 * @returns {string} el texto en claro
 */
function descifrar(sobre, ambito, proposito, campo) {
  if (!esCifrado(sobre)) {
    throw new Error('cifrado: el valor no es un sobre cifrado');
  }
  const partes = String(sobre).split(':');
  // enc : v1|v2 : version : iv : tag : cifrado
  if (partes.length !== 6) {
    throw new Error('cifrado: el sobre no tiene el formato esperado');
  }
  const formato = partes[1];
  if (formato !== 'v1' && formato !== FORMATO) {
    throw new Error('cifrado: el formato del sobre no es reconocido');
  }
  const version = partes[2];
  const iv = Buffer.from(partes[3], 'base64url');
  const tag = Buffer.from(partes[4], 'base64url');
  const datos = Buffer.from(partes[5], 'base64url');

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('cifrado: el sobre esta alterado (longitudes invalidas)');
  }
  if (!getKeyMaterial(version)) {
    throw new Error(
      'cifrado: la version de llave ' + version + ' ya no esta en el anillo; '
      + 'no se puede descifrar el valor'
    );
  }

  const purpose = proposito || PROPOSITO_REPRESENTANTE;
  // v1 es el formato heredado: se deriva con el ámbito tal como se cifró y
  // NO se valida AAD (no lo tiene). v2 exige ámbito y campo, y los ata al
  // sobre con setAAD ANTES de procesar el texto.
  const scope = formato === FORMATO ? _ambitoRequerido(ambito) : ambito;
  const field = formato === FORMATO ? _campoRequerido(campo) : null;
  const clave = derivedKey(purpose, scope, version);
  try {
    const descifrador = crypto.createDecipheriv(ALGORITMO, clave, iv);
    if (formato === FORMATO) {
      descifrador.setAAD(_aad(purpose, scope, field));
    }
    descifrador.setAuthTag(tag);
    return Buffer.concat([
      descifrador.update(datos),
      descifrador.final(),
    ]).toString('utf8');
  } catch (e) {
    // El `final()` de GCM es donde se verifica la etiqueta. Si falla, el
    // cifrado fue modificado (o la llave no corresponde): en los dos casos NO
    // se puede devolver un texto en claro.
    throw new Error('cifrado: el sobre no se puede descifrar (alterado o llave distinta)');
  }
}

module.exports = {
  cifrar,
  esCifrado,
  descifrar,
  PROPOSITO_REPRESENTANTE,
  CAMPO_REPRESENTANTE,
  FORMATO,
  PREFIJO,
  PREFIJO_V1,
  ALGORITMO,
};
