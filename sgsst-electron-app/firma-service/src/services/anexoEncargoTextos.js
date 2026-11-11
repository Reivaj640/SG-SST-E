/**
 * LOS TEXTOS LEGALES DE LA ACEPTACIÓN DEL ANEXO DE ENCARGO
 * ============================================================================
 *
 * QUÉ HACE
 * --------
 * Guarda, en UN solo lugar, los tres textos que la Empresa tiene que aceptar
 * cuando suscribe el Anexo de Encargo, y calcula su huella.
 *
 * Son los tres ajustes que pidió el abogado el 7-nov-2026:
 *
 *   1. LA CLÁUSULA EXPRESA DEL MECANISMO (pregunta 6 del dictamen). Es la
 *      palanca legal más clara de las tres: el artículo 7 del Decreto 2364
 *      (hoy 2.2.2.47.7 del Decreto 1074) presume que los mecanismos que las
 *      partes acuerdan cumplen los requisitos de firma electrónica. Sin
 *      acuerdo, no hay presunción. Y es lo que resuelve en buena parte la
 *      pregunta 2 (los huecos del §11): el acta con los datos del §11 pasa a
 *      formar parte integral del Anexo.
 *   2. LA DECLARACIÓN DE REPRESENTACIÓN (pregunta 7). El flujo probaba control
 *      de un buzón, no que quien firmara fuera el representante legal ni que
 *      tuviera poder.
 *   3. LA FRASE INFORMATIVA DE TRATAMIENTO DE DATOS (pregunta 10). El artículo
 *      12 de la Ley 1581 obliga a informar al Titular el tratamiento, la
 *      finalidad, sus derechos y la identificación del Responsable.
 *
 * POR QUÉ VIVEN AQUÍ Y NO EN LA PANTALLA NI EN EL ACTA
 * ---------------------------------------------------
 * Si el texto legal estuviera escrito a mano en el HTML de la pantalla y otra
 * vez en el generador del acta, habría dos redacciones que un día dejarían de
 * coincidir: la Empresa aceptaría una cosa y el acta archivaría otra. La
 * huella que se registra es la de ESTE texto, así que tiene que ser el mismo
 * que se le mostró y el que se archivó.
 *
 * El texto viaja al navegador dentro del CONTEXTO de la suscripción (la
 * pantalla lo pinta con `textContent`), y el acta lo imprime desde aquí. Las
 * tres salidas leen el mismo string.
 *
 * POR QUÉ NO SE TOCA EL TEXTO DEL ANEXO
 * ------------------------------------
 * El texto canónico (`legal/anexo-encargo.html`) NO se toca: ni una línea.
 * Su huella es la que declara el manifiesto y la que se registra en cada
 * suscripción, y se calcula sobre los bytes del archivo, en cada ejecución:
 * no hay ninguna huella escrita a mano en el código. (La huella que queda
 * escrita en un comentario se vuelve vieja en cuanto se publica una versión
 * nueva del Anexo: el 9-nov-2026 el texto vigente pasó a la 2026-11-09 y la
 * 2026-11-06 quedó archivada con la suya.) Estos textos son OTRA cosa: son lo
 * que la Empresa acepta en la pantalla, y por eso tienen su propia huella.
 */
'use strict';

const crypto = require('crypto');

/**
 * LA CLÁUSULA EXPRESA DEL MECANISMO.
 *
 * Es la frase que el abogado pidió agregar en la aceptación, palabra por
 * palabra: resuelve la pregunta 6 (la presunción del artículo 7 del Decreto
 * 2364) y buena parte de la pregunta 2 (el acta con el §11 como parte
 * integral).
 */
const MECANISMO = 'Las partes acuerdan que este Anexo se suscribe mediante el '
  + 'mecanismo electrónico descrito en el Acuerdo sobre el uso del mecanismo de '
  + 'firma electrónica K+AIR, que la Empresa declara conocer y aceptar. La '
  + 'Empresa reconoce que el acta de suscripción con los datos del §11 forma '
  + 'parte integral de este Anexo.';

/**
 * LA DECLARACIÓN DE REPRESENTACIÓN, para el representante legal.
 */
const DECLARACION_REPRESENTANTE_LEGAL = 'Declaro que soy el representante legal '
  + 'de la Empresa y que tengo facultades para suscribir este Anexo.';

/**
 * LA DECLARACIÓN DE REPRESENTACIÓN, para el delegado con poder.
 *
 * No es la misma frase: un delegado no es el representante legal, y declarar
 * lo contrario sería una falsidad. El poder es lo que K+AIR verifica
 * documentalmente antes de contrafirmar.
 */
const DECLARACION_DELEGADO = 'Declaro que actúo en nombre de la Empresa como '
  + 'delegado con facultades suficientes para suscribir este Anexo, que me '
  + 'fueron conferidas mediante el poder que K+AIR verificó, y que tengo '
  + 'facultades para suscribir este Anexo.';

/**
 * LAS CALIDADES QUE PUEDE DECLARAR QUIEN FIRMA.
 *
 * `REPRESENTANTE_LEGAL`: se verifica contra el certificado de existencia y
 * representación de la cámara de comercio o contra el RUT de la Empresa.
 * `DELEGADO`: se exige el poder o la autorización, y además el certificado o
 * el RUT para saber a nombre de quién se firma.
 */
const CALIDADES = {
  REPRESENTANTE_LEGAL: 'REPRESENTANTE_LEGAL',
  DELEGADO: 'DELEGADO',
};

/**
 * LA FRASE INFORMATIVA DE TRATAMIENTO DE DATOS.
 *
 * Qué datos se recogen, para qué, por cuánto tiempo y cómo ejercer los
 * derechos: es lo que pide el artículo 12 de la Ley 1581 de 2012, y lo que
 * el abogado puso como cuarto de sus tres refuerzos.
 *
 * LOS PLAZOS NO SON INVENTADOS
 * ----------------------------
 * Salen de la tabla de conservación del párrafo 8 del Anexo de Encargo:
 *   - «Constancia y manifestación de aceptación»: el mismo plazo del documento
 *     asociado y, si ese documento no tiene plazo propio, el de «Documento
 *     original y firmado»: diez (10) años por defecto.
 *   - «Registro de operaciones y autenticación»: cinco (5) años por defecto.
 * En los dos casos, con la precedencia de la tabla de retención documental que
 * declare la Empresa (numeral 8.6(a) del Acuerdo).
 */
const TRATAMIENTO_DATOS = 'Tratamiento de mis datos personales. K+AIR '
  + '(Gesstiar S.A.S.), como Encargado, recoge el nombre y el número de '
  + 'documento de quien suscribe, el nombre del representante legal de la '
  + 'Empresa, el correo al que se envían el enlace y el código de verificación, '
  + 'la dirección IP y el navegador desde el que se abre el enlace y se '
  + 'suscribe este Anexo, y los cinco datos del párrafo 11 que declara la '
  + 'Empresa. La finalidad es ejecutar este Anexo de Encargo y conservar la '
  + 'prueba de la suscripción y de la contrafirma. El plazo de conservación es '
  + 'el de la categoría «Constancia y manifestación de aceptación» de la tabla '
  + 'de conservación del párrafo 8 del Anexo de Encargo —el mismo plazo del '
  + 'documento asociado y, si ese documento no tiene plazo propio, el de '
  + '«Documento original y firmado»: diez (10) años por defecto— y, para el '
  + 'registro de operaciones y autenticación, cinco (5) años por defecto; en '
  + 'los dos casos con la precedencia de la tabla de retención documental que '
  + 'declare la Empresa. Esos datos no se usan para finalidades distintas. '
  + 'Quien suscribe puede ejercer los derechos de acceso, rectificación, '
  + 'supresión, limitación y oposición escribiendo a privacidad.kair@gmail.com; '
  + 'K+AIR, como Encargado, recibe la solicitud y la trasmite a la Empresa, '
  + 'que es la Responsable.';

/**
 * La declaración de representación que corresponde a la calidad declarada.
 *
 * @param {string} calidad - 'REPRESENTANTE_LEGAL' | 'DELEGADO'
 * @returns {string}
 */
function declaracionRepresentacion(calidad) {
  return calidad === CALIDADES.DELEGADO
    ? DECLARACION_DELEGADO
    : DECLARACION_REPRESENTANTE_LEGAL;
}

/**
 * El texto de aceptación completo: la cláusula del mecanismo y la declaración
 * de representación, en el orden en que la Empresa los ve.
 *
 * @param {string} calidad - 'REPRESENTANTE_LEGAL' | 'DELEGADO'
 * @returns {string}
 */
function textoAceptacion(calidad) {
  return MECANISMO + '\n\n' + declaracionRepresentacion(calidad);
}

/**
 * La huella SHA-256 de un texto.
 *
 * @param {string} texto
 * @returns {string} 64 chars hex.
 */
function _sha256(texto) {
  return crypto.createHash('sha256').update(String(texto), 'utf8').digest('hex');
}

/**
 * La huella del texto de aceptación que la Empresa marcó.
 *
 * @param {string} calidad
 * @returns {string}
 */
function hashAceptacion(calidad) {
  return _sha256(textoAceptacion(calidad));
}

/**
 * La huella de la frase informativa de tratamiento de datos.
 *
 * @returns {string}
 */
function hashTratamiento() {
  return _sha256(TRATAMIENTO_DATOS);
}

/**
 * Los textos que se le mandan a la pantalla.
 *
 * Se devuelven como OBJETO y no como un string suelto para que la pantalla no
 * tenga que partirlo: si mañana el texto cambia, la pantalla recibe las
 * piezas nuevas y no un texto que alguien tendría que volver a cortar a mano.
 *
 * @param {string} [calidad] - la calidad declarada; si no, la del representante
 *   legal (que es la que el contexto público muestra antes de que la Empresa
 *   elija).
 * @returns {object}
 */
function textosPublicos(calidad) {
  return {
    mecanismo: MECANISMO,
    declaracion: declaracionRepresentacion(calidad),
    // Las DOS declaraciones, para que la pantalla pueda cambiar la que
    // muestra cuando la Empresa elige la calidad con la que firma. Si solo
    // mandara una, la Empresa que firma como delegado vería la declaración
    // de representante legal.
    declaracion_representante_legal: DECLARACION_REPRESENTANTE_LEGAL,
    declaracion_delegado: DECLARACION_DELEGADO,
    tratamiento: TRATAMIENTO_DATOS,
    calidades: Object.keys(CALIDADES),
  };
}

module.exports = {
  MECANISMO,
  DECLARACION_REPRESENTANTE_LEGAL,
  DECLARACION_DELEGADO,
  CALIDADES,
  TRATAMIENTO_DATOS,
  declaracionRepresentacion,
  textoAceptacion,
  hashAceptacion,
  hashTratamiento,
  textosPublicos,
};
