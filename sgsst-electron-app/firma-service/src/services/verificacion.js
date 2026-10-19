/**
 * ORÁCULO DE VERIFICACIÓN DE IDENTIDAD
 * ===================================
 *
 * QUÉ PROBLEMA RESUELVE
 * ----------------------
 * La Empresa necesita poder preguntar "¿el documento de identidad que yo
 * registré es el mismo con el que firmó el trabajador?". Esa pregunta es
 * la que sostiene el numeral 3.4(d) del Acuerdo de uso (la comparación con
 * la información registrada por la Empresa se hace "mediante una comparación
 * de huellas digitales con sal").
 *
 * El problema es que esa pregunta, contestada por email, se resuelve
 * APARTANDO el documento en claro: la Empresa le manda al trabajador el
 * número por correo, o se lo pide por teléfono, o lo escribe en un
 * formulario. Ese número termina en buzones, en chats y en cuadernos
 * Papeles. Y si lo aparta, la Empresa deja de poder cumplir el 3.4(d).
 *
 * El oráculo resuelve las dos cosas a la vez: la Empresa NO aparta el
 * documento. Se lo manda al SERVICIO, que ya tiene la huella archivada, y
 * el servicio le contesta sí o no.
 *
 * LAS PROPIEDADES (por qué está hecho así y no de otra forma)
 * ----------------------------------------------------------
 *
 * 1. BOOLEANO PURO.
 *    La respuesta es un sí o un no. No devuelve la huella, ni el estado de
 *    la firma, ni las fechas, ni el nombre. Un canal de verificación que
 *    devuelve más de lo que pregunta es un canal de fuga.
 *
 * 2. NO PERSISTE EL DOCUMENTO.
 *    El documento consultado se usa para calcular una huella y se descarta.
 *    Lo que queda es un HMAC de 16 hex, que sirve para detectar anomalías
 *    (alguien usando el oráculo como oráculo de documentos) y que no
 *    permite recuperar el número.
 *
 * 3. 404 SILENCIOSO ENTRE EMPRESAS.
 *    La consulta va filtrada por `id_empresa`. Una solicitud que no es de
 *    la empresa autenticada no se distingue de una que no existe: mismo
 *    404, mismo cuerpo, misma consulta. La empresa no puede usar el
 *    oráculo para averiguar qué firmas existen en otras empresas.
 *
 * 4. RESPUESTA EN TIEMPO CONSTANTE.
 *    La comparación de huellas recorre TODOS los candidatos (uno por
 *    versión del anillo de llaves, más el formato v1 y el pre-hash
 *    heredado) sin salir temprano. El tiempo de la respuesta no depende de
 *    si el documento coincide: si saliera en la primera coincidencia, el
 *    tiempo SERÍA la respuesta.
 *
 *    El trabajo criptográfico se hace en todos los caminos, incluso cuando
 *    la firma no existe de la empresa: si se hiciera solo en el camino
 *    "existe", el 404 sería instantáneo y el 200 tardaría, y esa
 *    diferencia delataría en qué caso está la consulta.
 *
 * 5. SIN SALIDA TEMPRANA EN LA COMPARACIÓN.
 *    Ver punto 4. La comparación usa `constantTimeEqual` sobre el par de
 *    bytes, no `===`.
 *
 * 6. RATE LIMIT PROPIO.
 *    El límite genérico de /internal/* (720/h por empresa) es demasiado
 *    generoso para un canal que devuelve sí/no sobre documentos. Este
 *    endpoint tiene su propio límite, más corto.
 *
 * 7. AUDITABLE.
 *    Cada consulta deja un evento `IDENTIDAD_VERIFICADA` en el registro
 *    append-only (`gh_firma_eventos`), con el resultado y sin el
 *    documento. La Empresa puede después demostrar que consultó.
 *
 * LO QUE NO HACE
 * --------------
 * - No devuelve la huella archivada, ni la enmascarada: eso ya está en la
 *   constancia y en la página de verificación pública.
 * - No reescribe la fila, ni siquiera cuando la fila usa un formato
 *   heredado. El oráculo es una consulta, no una migración.
 * - No dice si la firma está firmada, pendiente o vencida. La Empresa ya
 *   tiene su propio registro de eso.
 */
'use strict';

const db = require('../db/connection');
const { constantTimeEqual } = require('../crypto/compare');
const { hmacHex } = require('../crypto/hmac');
const { candidatosHuella } = require('./identificacion');
const { AppError } = require('../middleware/errors');

// Propósito de la derivación del fingerprint de anomalía. ES DISTINTO del
// propósito 'identificacion': un mismo documento produce dos valores
// distintos, así que la huella que se guarda en el log del oráculo no
// sirve para compararse con la huella archivada de la firma.
const PROPOSITO_ORACULO = 'verificacion_oraculo';

// Valor fijo contra el que se compara cuando la fila NO existe. Sirve para
// que la comparación recorra siempre el mismo número de candidatos: el
// trabajo criptográfico no puede depender de si la fila apareció.
const VALOR_FIJO = '0'.repeat(64);

/**
 * Fingerprint corto del documento consultado, para el log de anomalías.
 *
 * Es un HMAC (con la llave maestra, que vive fuera de la base) del
 * documento, recortado a 16 hex. Quien lea el log no puede recuperar el
 * número, pero puede detectar que se consultó el mismo documento otra vez.
 *
 * @param {string} numero_documento
 * @param {string} id_empresa
 * @returns {string} 16 chars hex
 */
function fingerprintDocumento(numero_documento, id_empresa) {
  return hmacHex(PROPOSITO_ORACULO, String(numero_documento), id_empresa).slice(0, 16);
}

/**
 * Compara una lista de candidatos contra el valor almacenado, SIN salir
 * temprano en la coincidencia.
 *
 * El resultado es el mismo si la coincidencia está al principio o al final
 * de la lista, y el tiempo también.
 *
 * @param {Array<{hex: string, formato: string, version: string|null}>} candidatos
 * @param {string} almacenado - hex de 64 chars
 * @returns {{coincide: boolean, version: string|null, formato: string|null}}
 */
function coincideSinSalidaTemprana(candidatos, almacenado) {
  let coincide = false;
  let version = null;
  let formato = null;
  for (const c of candidatos) {
    // Sin `break`: se comparan TODOS los candidatos.
    if (constantTimeEqual(c.hex, almacenado)) {
      coincide = true;
      // Se guarda la PRIMERA coincidencia, pero el recorrido no se corta:
      // el tiempo de la respuesta es el mismo en todos los casos.
      if (formato === null) {
        version = c.version;
        formato = c.formato;
      }
    }
  }
  return { coincide, version, formato };
}

/**
 * Verifica si un documento de identidad es el que quedó registrado en una
 * firma.
 *
 * @param {object} opts
 * @param {string} opts.id_solicitud - id de la firma (SIGN-YYYY-NNNNNN)
 * @param {string} opts.tipo_identificacion - CC, CE, TI, PPT, PA
 * @param {string} opts.numero_documento - el documento en claro
 * @param {string} opts.id_empresa - empresa autenticada (ámbito del HMAC)
 * @returns {{coincide: boolean, firma_id: number, version_llave: string|null}}
 * @throws {AppError} 404 si la firma no existe para esa empresa.
 */
function verificarIdentidad(opts) {
  const { id_solicitud, tipo_identificacion, numero_documento, id_empresa } = opts;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Lookup ACOTADO a la empresa del llamador.
  //
  //    El filtro por `id_empresa` es lo que hace que el 404 sea silencioso:
  //    una firma de otra empresa no aparece, y la consulta es exactamente
  //    la misma que para un id inexistente. Ni el cuerpo de la respuesta
  //    ni el status los distinguen.
  // ─────────────────────────────────────────────────────────────────────────
  const fila = db.prepare(`
    SELECT id, id_solicitud, id_empresa,
           identificacion_tipo, identificacion_numero_hash,
           identificacion_numero_sal, identificacion_numero_alg
    FROM gh_firmas_electronicas
    WHERE id_solicitud = ? AND id_empresa = ?
  `).get(id_solicitud, id_empresa);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Derivación de los candidatos.
  //
  //    La sal (si la hay) está en la fila: es la que el cliente usó para
  //    calcular el hash previo `sha256(sal || documento)`. Sin ella, el
  //    candidato no coincidiría con una fila que sí tiene sal.
  //
  //    Cuando la fila no existe, la derivación se hace igual (sin sal):
  //    el trabajo criptográfico no puede depender del resultado de la
  //    consulta.
  // ─────────────────────────────────────────────────────────────────────────
  const sal = fila ? (fila.identificacion_numero_sal || null) : null;
  const candidatos = candidatosHuella(numero_documento, sal, id_empresa);

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Comparación en tiempo constante.
  //
  //    Con la fila: contra la huella archivada.
  //    Sin fila: contra un valor fijo, para recorrer los mismos candidatos.
  // ─────────────────────────────────────────────────────────────────────────
  const almacenado = fila ? fila.identificacion_numero_hash : VALOR_FIJO;
  const comparacion = coincideSinSalidaTemprana(
    candidatos.map((c) => ({ hex: c.hex, formato: c.formato, version: c.version })),
    almacenado || VALOR_FIJO
  );
  const coincideDocumento = comparacion.coincide;

  // ─────────────────────────────────────────────────────────────────────────
  // 4. El tipo de documento también tiene que ser el mismo.
  //
  //    La huella cubre el NÚMERO, no el tipo: un CC y una CE con el mismo
  //    número darían la misma huella. El tipo se compara aparte, y su
  //    resultado se combina con el de la huella.
  //
  //    Si la fila no tiene tipo registrado (fila heredada), no se impone
  //    ninguna restricción: no se puede afirmar una diferencia que el
  //    registro no contiene.
  //
  //    La combinación NO usa `&&` (que cortocircuita): las dos
  //    comparaciones se hacen siempre.
  // ─────────────────────────────────────────────────────────────────────────
  const coincideTipo = !fila || !fila.identificacion_tipo
    ? true
    : (fila.identificacion_tipo === tipo_identificacion);

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Si la firma no es de esta empresa → 404 silencioso.
  // ─────────────────────────────────────────────────────────────────────────
  if (!fila) {
    throw new AppError(
      404,
      'NOT_FOUND',
      `Solicitud ${id_solicitud} no encontrada`,
      { id_solicitud }
    );
  }

  const coincide = coincideDocumento && coincideTipo;

  return {
    coincide,
    firma_id: fila.id,
    // La versión de llave con la que coincidió: la del candidato que
    // calzó. Es información de auditoría, NO va en la respuesta al cliente.
    version_llave: comparacion.version,
    formato_coincidencia: comparacion.formato,
  };
}

module.exports = {
  verificarIdentidad,
  fingerprintDocumento,
  coincideSinSalidaTemprana,
  PROPOSITO_ORACULO,
};
