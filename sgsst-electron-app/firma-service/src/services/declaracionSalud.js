/**
 * La declaración de que el documento NO tiene datos sensibles de salud.
 *
 * POR QUÉ EXISTE
 * -------------
 * El servicio de firma electrónica NO necesita recibir documentos con datos
 * sensibles de salud: la Empresa conserva el documento original y lo que se
 * firma es su representación. La política que el abogado definió es que el
 * servicio NO acepta ese tipo de documento.
 *
 * El numeral 10.8 del Acuerdo gobierna el AVISO y el consentimiento
 * expreso del dato sensible (ver services/sensibles.js). Esta declaración es
 * otra cosa, y es más fuerte: no es un aviso, es una PROHIBICIÓN. La Empresa
 * no puede declarar "sí tiene datos de salud" y seguir: tiene que resolver el
 * caso por fuera (firma en papel).
 *
 * POR QUÉ UN TEXTO FIJO Y NO UN BOOLEAN
 * -------------------------------------
 * Un `datos_sensibles: false` no deja registro de QUE se declaró: un boolean
 * no dice quién dijo qué, ni con qué palabras. Con un texto fijo queda escrito
 * en la fila de la firma y en el registro de auditoría que se declaró
 * EXACTAMENTE esto. El valor es una constante de código: el cliente no puede
 * inventar una variante para saltarse el control.
 *
 * LO QUE NO HACE
 * --------------
 * NO detecta datos sensibles dentro del PDF. Detectar eso automáticamente no
 * es fiable (un PDF es un contenedor, no un texto legible), y prometer un
 * control que el código no cumple es exactamente lo que este paquete de
 * trabajo viene a corregir. Lo que hay es: (i) una prohibición expresa en el
 * texto del Anexo de Encargo, y (ii) esta declaración, específica y
 * trazable al documento exacto.
 */
'use strict';

/**
 * El valor exacto que la Empresa tiene que declarar.
 *
 * Sin tildes ni acentos: es un valor de máquina, no un texto para humanos.
 * El texto para humanos va en el mensaje de error.
 */
const DECLARACION_SALUD = 'EL_DOCUMENTO_NO_CONTIENE_DATOS_SENSIBLES_DE_SALUD';

/**
 * Código de error de la API cuando la declaración falta o no coincide.
 */
const CODIGO_ERROR = 'DECLARACION_DATOS_SENSIBLES_REQUERIDA';

/**
 * Mensaje para la Empresa: dice qué está pasando, por qué y qué hacer.
 */
const MENSAJE_ERROR = 'El servicio de firma electronica no recibe documentos que contengan '
  + 'datos sensibles de salud. Para crear la solicitud, la Empresa tiene que declarar que '
  + 'el documento NO contiene ese tipo de datos, mandando el valor exacto '
  + DECLARACION_SALUD + ' en el campo declaracion_datos_sensibles. Si el documento si contiene '
  + 'datos de salud, la firma se tiene que hacer en papel: el servicio no lo procesa.';

/**
 * ¿El valor recibido es la declaración exacta?
 *
 * El trim acepta un salto de línea o un espacio de más: el valor es el mismo.
 * Cualquier otra cosa (otro texto, un boolean, un numero, null) NO es la
 * declaración.
 *
 * @param {*} valor
 * @returns {boolean}
 */
function esDeclaracionValida(valor) {
  return typeof valor === 'string' && valor.trim() === DECLARACION_SALUD;
}

module.exports = {
  DECLARACION_SALUD,
  CODIGO_ERROR,
  MENSAJE_ERROR,
  esDeclaracionValida,
};
