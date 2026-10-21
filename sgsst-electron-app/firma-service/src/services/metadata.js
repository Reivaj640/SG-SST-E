'use strict';
/**
 * 8B · LA LISTA BLANCA DE LO QUE SE ARCHIVA EN `metadata`
 * =============================================================================
 *
 * El campo `metadata` de POST /internal/sign-requests es un **string JSON
 * libre** (≤ 8192 caracteres). Lo que va ahí queda archivado en la columna
 * `metadata` de la fila de la firma, y lo que se archiva es DATO: puede ser
 * PII y, en el peor caso, dato de salud (el 10.8 exige un consentimiento
 * expreso para tratarlo, y el 10.6 exige suprimirlo cuando vence).
 *
 * Antes de esta fase, el blob libre se archivaba **entero**, sin filtro:
 * cualquier clave que un cliente mandara quedaba guardada, y nadie se
 * enteraba. El caso que lo demuestra es `correo_empresa`: la app de
 * escritorio la mandaba desde hace meses, el esquema no la declaraba, zod la
 * eliminaba en silencio, nunca llegaba a la base, y la constancia salía sin
 * el canal de copia del 8.4. El silencio ya costó datos una vez.
 *
 * LA LISTA
 * --------
 * Es corta y explícita. Cada clave tiene una razón:
 *
 * | Clave | Por qué |
 * |---|---|
 * | `subtipo_identificacion` | La convención documentada del proyecto: el sub-tipo del documento que se firma (`autorizacion_datos`, `contrato_fijo`...). String libre. |
 * | `nombre_trabajador` | Campo visible de la Constancia (el nombre de quien firma). |
 * | `nombre_empresa` | Campo visible de la Constancia. |
 * | `correo_empresa` | El canal de copia del 8.4: a dónde se pide la copia del documento firmado. La app ya lo mandaba y se perdía. |
 * | `correo` | El fallback histórico del correo del firmante (`publicFlow.commit()`: `metadata.correo` → `consent.correo_verificacion`). |
 *
 * Lo que NO está en la lista **no se archiva**. Dos comportamientos, según
 * dónde se detects:
 *
 *   - En la **ruta** (la frontera HTTP): se RECHAZA con un 400 que dice qué
 *     claves sobraron. Silenciar lo desconocido es lo que costó
 *     `correo_empresa`.
 *   - En el **servicio** (el punto donde se escribe la fila): se descarta y se
 *     deja rastro en el log. El servicio también se llama directo (firma dual,
 *   tests), y una fila escrita por ahí no puede saltarse la lista.
 */

/**
 * Las claves que se pueden archivar en la columna `metadata` de la fila.
 *
 * @type {readonly string[]}
 */
const CLAVES_METADATA_PERMITIDAS = Object.freeze([
  'subtipo_identificacion',
  'nombre_trabajador',
  'nombre_empresa',
  'correo_empresa',
  'correo',
]);

/**
 * ¿Es una clave permitida?
 *
 * @param {string} clave
 * @returns {boolean}
 */
function clavePermitida(clave) {
  return CLAVES_METADATA_PERMITIDAS.includes(clave);
}

/**
 * Parsea y filtra el blob libre de `metadata`.
 *
 * NO lanza: devuelve el resultado y las claves que no se permitían, para que
 * cada llamador decida qué hacer (la ruta rechaza, el servicio descarta).
 *
 * @param {string|object|null|undefined} entrada - el string JSON o el objeto ya parseado.
 * @returns {{ok: boolean, valor: object, desconocidas: string[], error: string|null}}
 */
function filtrarMetadata(entrada) {
  if (entrada === null || entrada === undefined || entrada === '') {
    return { ok: true, valor: {}, desconocidas: [], error: null };
  }

  let objeto = entrada;
  if (typeof entrada === 'string') {
    try {
      objeto = JSON.parse(entrada);
    } catch (e) {
      return {
        ok: false,
        valor: {},
        desconocidas: [],
        error: 'El metadata no es JSON válido',
      };
    }
  }

  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return {
      ok: false,
      valor: {},
      desconocidas: [],
      error: 'El metadata debe ser un objeto JSON',
    };
  }

  const desconocidas = Object.keys(objeto).filter(k => !clavePermitida(k));
  const valor = {};
  for (const [k, v] of Object.entries(objeto)) {
    if (clavePermitida(k)) valor[k] = v;
  }

  return { ok: desconocidas.length === 0, valor, desconocidas, error: null };
}

module.exports = {
  CLAVES_METADATA_PERMITIDAS,
  clavePermitida,
  filtrarMetadata,
};
