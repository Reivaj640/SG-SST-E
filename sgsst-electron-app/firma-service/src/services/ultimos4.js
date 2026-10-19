/**
 * ÚLTIMOS CUATRO DÍGITOS DEL DOCUMENTO DE IDENTIFICACIÓN — SOLO EN MEMORIA
 * =======================================================================
 *
 * PARA QUÉ
 * --------
 * El firmante necesita poder confirmar visualmente que el documento que
 * está firmando es el suyo. Para eso sirve la constancia: mostrar los
 * últimos cuatro dígitos del documento le permite reconocerse sin que el
 * número completo salga de ninguna parte.
 *
 * POR QUÉ EN MEMORIA Y NO EN LA BASE
 * ----------------------------------
 * El numeral 10.5(a) del Acuerdo de uso dice que del número de documento de
 * identidad "se conserva únicamente esa huella, no el número en texto claro".
 * Guardar aunque sea cuatro dígitos en la base de datos sería guardar una
 * parte del número: el 10.5(a) quedaría en letra pequeña, y un truncamiento
 * restringe muchísimo el espacio de búsqueda (diez mil combinaciones contra
 * diez mil millones). Cuatro dígitos SÍ son un dato identificable.
 *
 * Entonces el dato viaja en memoria del `identify()` al `commit()`: el
 * trabajador escribe su documento —que el servicio recibe en claro y
 * descarta de inmediato—, el servicio aparta cuatro dígitos en un mapa de
 * proceso, y al firmar los usa para la constancia. Después se descartan.
 *
 * SI EL PROCESO SE REINICIA
 * -------------------------
 * El mapa se pierde y la constancia se genera con la referencia opaca (los
 * primeros caracteres de la huella archivada), que es el comportamiento de
 * siempre. No se pierde nada que el firmante no pueda rehacer: `identify()`
 * admite la re-identificación hasta el estado `DOCUMENT_VIEWED`, así que
 * volver a escribir el documento vuelve a dejar los cuatro dígitos
 * disponibles. Si el reinicio ocurre entre ver el documento y firmar, la
 * constancia sale sin ellos: degradación, no rotura.
 *
 * NO ES UN ALMACÉN DE DATOS PERSONALES
 * -------------------------------------
 * El mapa vive en el proceso, caduca por TTL, no se respalda y no se
 * consulta desde la base. No es una base de datos paralela: es un área de
 * trabajo. (El TTL se revisa al leer; las entradas vencidas se descartan
 * cuando se vuelven a tocar, y el tamaño está acotado.)
 */
'use strict';

// Cuánto vive una entrada sin tocarse. Cubre el tiempo real entre que el
// trabajador se identifica y firma: lee el Acuerdo, revisa el documento,
// lee la constancia. Seis horas es holgado para eso, y corto frente a la
// vigencia del enlace (24 h presencial / 72 h remoto).
const TTL_MS = 6 * 60 * 60 * 1000;

// Tope de entradas. Si se alcanza, se descarta la más antigua: el mapa es
// un ayuda-memoria de proceso, no un archivo.
const MAX_ENTRADAS = 5000;

/** firmaId (string) -> { digitos, tipo, expira } */
const store = new Map();

/**
 * Extrae los últimos cuatro dígitos de un número de documento.
 *
 * @param {string} numero_documento
 * @returns {string|null} cuatro dígitos, o null si no hay suficientes
 */
function digitosDe(numero_documento) {
  const digitos = String(numero_documento || '').replace(/\D/g, '');
  if (digitos.length < 4) return null;
  return digitos.slice(-4);
}

/**
 * Aparta los últimos cuatro dígitos del documento, en memoria.
 *
 * @param {number|string} firmaId - id de la fila de la firma
 * @param {string} numero_documento - el documento en claro
 * @param {string} [tipo_identificacion]
 * @returns {string|null} los dígitos, o null si no se pudieron extraer
 */
function guardar(firmaId, numero_documento, tipo_identificacion) {
  if (firmaId === null || firmaId === undefined || firmaId === '') return null;
  const digitos = digitosDe(numero_documento);
  if (!digitos) return null;

  if (store.size >= MAX_ENTRADAS && !store.has(String(firmaId))) {
    const masVieja = store.keys().next().value;
    if (masVieja !== undefined) store.delete(masVieja);
  }

  store.set(String(firmaId), {
    digitos,
    tipo: tipo_identificacion || null,
    expira: Date.now() + TTL_MS,
  });
  return digitos;
}

/**
 * Recupera los cuatro dígitos apartados para una firma.
 *
 * @param {number|string} firmaId
 * @returns {{digitos: string, tipo: string|null}|null}
 */
function obtener(firmaId) {
  if (firmaId === null || firmaId === undefined || firmaId === '') return null;
  const clave = String(firmaId);
  const entrada = store.get(clave);
  if (!entrada) return null;
  if (entrada.expira <= Date.now()) {
    store.delete(clave);
    return null;
  }
  return entrada;
}

/**
 * Descarta los dígitos de una firma (tras usarlos, o al cancelar).
 *
 * @param {number|string} firmaId
 */
function olvidar(firmaId) {
  if (firmaId === null || firmaId === undefined || firmaId === '') return;
  store.delete(String(firmaId));
}

/** Vacía el mapa por completo. Para tests y para el arranque del proceso. */
function limpiar() {
  store.clear();
}

/** @returns {number} cuántas entradas hay ahora mismo (para tests). */
function _tamano() {
  return store.size;
}

module.exports = {
  guardar,
  obtener,
  olvidar,
  limpiar,
  digitosDe,
  TTL_MS,
  MAX_ENTRADAS,
  _tamano,
};
