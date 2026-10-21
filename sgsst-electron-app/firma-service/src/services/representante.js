/**
 * Snapshot del representante legal: cifrado, lectura y enmascarado.
 *
 * QUÉ ES ESTE SNAPSHOT
 * --------------------
 * Cuando el cliente pide la firma de la Empresa (I-FIRMA-DUAL), manda en el
 * cuerpo de la solicitud el snapshot del representante legal: nombre, cargo,
 * tipo y número de identificación y correo. Eso se archiva en la columna
 * `representante_legal_snapshot` de `gh_firmas_electronicas`.
 *
 * POR QUÉ EL NÚMERO SE CIFRA
 * --------------------------
 * El número de documento del representante legal es **prueba de la
 * representación**: puede necesitarse en una constancia o en un certificado de
 * existencia y representación legal. Por eso NO se hashea (una huella no se
 * puede presentar como prueba) y sí se **cifra**: queda reversible solo para
 * quien tenga la llave, y la llave vive fuera de la base de datos.
 *
 * El del TRABAJADOR sí se seudonimiza (no se archiva el número), porque su
 * número no prueba nada: solo se usa para comparar.
 *
 * DOS COSAS DISTINTAS, QUE A VECES SE CONFUNDEN
 * ---------------------------------------------
 * 1. La identificación de la EMPRESA (razón social, NIT, domicilio,
 *    representante legal y SU DOCUMENTO DE IDENTIFICACIÓN) que el numeral 1.2
 *    del Acuerdo ordena mostrar al Firmante en el bloque «Empresa que solicita
 *    tu firma» viene del **registro mercantil** que la Empresa cargó en
 *    `gh_firma_empresas`, NO de este snapshot. Ese bloque no se toca: el texto
 *    legal aprobado manda y no lo cambia este módulo.
 * 2. El snapshot de arriba es lo que el cliente declaró al pedir la firma. Es
 *    un dato personal más (el del representante) y se conserva cifrado.
 *
 * FILAS HEREDADAS
 * ---------------
 * Las filas creadas antes de este cambio guardan el número EN CLARO. No se
 * rompen: `numeroEnClaro` las reconoce (no empiezan por el prefijo del sobre)
 * y las trata como lo que son. La re-cifrado de esas filas es un script
 * aparte, en modo dry-run, porque tocar datos ya archivados es una
 * operación irreversible y no se hace de paso.
 */
'use strict';

const {
  cifrar, esCifrado, descifrar, CAMPO_REPRESENTANTE,
} = require('../crypto/cifrado');
const logger = require('../utils/logger');

const PROPOSITO = 'cifrado-representante';
const CAMPO = CAMPO_REPRESENTANTE;

// Cuántos caracteres del final se muestran. Es la convención que ya usa el
// sistema para el firmante: no se muestra el número completo, ni siquiera en
// el documento que la Empresa se lleva.
const ULTIMOS = 4;
const MASCARA = '****';

/**
 * Parsea un snapshot que viene de la base (columna TEXT con JSON).
 *
 * @param {string|object|null} valor
 * @returns {object|null} el objeto del snapshot, o null si no se puede leer
 */
function leerSnapshot(valor) {
  if (!valor) return null;
  try {
    const obj = typeof valor === 'string' ? JSON.parse(valor) : valor;
    return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : null;
  } catch (e) {
    // Un snapshot corrupto no puede tumbar la lectura de la firma: la
    // llamada decide qué hacer con un null.
    return null;
  }
}

/**
 * El número en claro del representante.
 *
 * - Snapshot nuevo: se descifra.
 * - Snapshot heredado (número en claro): se devuelve tal cual.
 * - Snapshot sin número: null.
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa] - ámbito de la derivación de la llave
 * @returns {string|null}
 */
function numeroEnClaro(snapshot, id_empresa) {
  if (!snapshot) return null;
  const valor = snapshot.numero_identificacion;
  if (typeof valor !== 'string' || valor.length === 0) return null;
  if (!esCifrado(valor)) return valor;   // fila heredada: ya está en claro
  return descifrar(valor, id_empresa, PROPOSITO, CAMPO);
}

/**
 * Los últimos caracteres del número, para mostrar.
 *
 * En los snapshots nuevos viajan guardados junto al sobre cifrado, para que
 * mostrarlo NO exija descifrar (y por tanto NO exija la llave). En los
 * heredados se calculan del número en claro.
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa]
 * @returns {string|null} p. ej. '1234'
 */
function ultimos4(snapshot, id_empresa) {
  if (!snapshot) return null;
  if (typeof snapshot.numero_identificacion_ultimos4 === 'string'
    && snapshot.numero_identificacion_ultimos4.length > 0) {
    return snapshot.numero_identificacion_ultimos4;
  }
  const claro = numeroEnClaro(snapshot, id_empresa);
  if (!claro) return null;
  return ultimosDeTexto(claro);
}

/**
 * Los últimos `ULTIMOS` caracteres de un texto.
 *
 * @param {string} texto
 * @returns {string}
 */
function ultimosDeTexto(texto) {
  const s = String(texto).trim();
  if (s.length <= ULTIMOS) return s;
  return s.slice(-ULTIMOS);
}

/**
 * El número listo para mostrar, CON EL MOTIVO de su ausencia.
 *
 * Por qué hace falta: `numeroEnmascarado()` devolvía `null` en dos
 * situaciones que no son la misma:
 *
 *   - 'sin_dato': la empresa no declaró documento del representante. No hay
 *     nada que mostrar y no es un problema.
 *   - 'error': el sobre no se pudo abrir (la llave saiu del anillo, el
 *     sobre fue alterado, el ámbito no corresponde). Esto es un INCIDENTE:
 *     se está perdiendo evidencia, y con el `null` indistinguible nadie se
 *     enteraba.
 *
 * El valor devuelto es el mismo que devuelve `numeroEnmascarado` (para no
 * romper a quien lo use) y el estado dice por qué no hay valor.
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa]
 * @returns {{estado: 'dato'|'sin_dato'|'error', valor: string|null, error: string|null}}
 */
function estadoEnmascarado(snapshot, id_empresa) {
  if (!snapshot || typeof snapshot !== 'object') {
    return { estado: 'sin_dato', valor: null, error: null };
  }
  const valor = snapshot.numero_identificacion;
  if (typeof valor !== 'string' || valor.length === 0) {
    return { estado: 'sin_dato', valor: null, error: null };
  }
  try {
    const u4 = ultimos4(snapshot, id_empresa);
    if (!u4) {
      // Había un número pero no se pudo obtener ninguno: eso es un fallo.
      return {
        estado: 'error',
        valor: null,
        error: 'el snapshot tiene documento pero no se pudieron obtener sus últimos 4',
      };
    }
    return { estado: 'dato', valor: MASCARA + u4, error: null };
  } catch (e) {
    return { estado: 'error', valor: null, error: e.message };
  }
}

/**
 * El número listo para mostrar: '****1234'.
 *
 * NO incluye el tipo de identificación: quien lo arma (la constancia) ya
 * tiene el tipo a mano y lo pone delante, como hace con el firmante.
 *
 * A diferencia de `numeroEnClaro`, aquí un fallo NO se propaga: si el número
 * no se puede abrir (llave vieja fuera del anillo, sobre alterado) se
 * devuelve null y se avisa por log. La razón: esto es una capa de
 * PRESENTACIÓN. Un documento de salida no puede dejar de emitirse porque un
 * dato secundario no se pudo desenmascarar; lo que no puede pasar es
 * inventar un número.
 *
 * Cuando el fallo es real (no "no hay dato"), el log es de ERROR y lleva
 * código: un `null` silencioso escondía incidentes de llave.
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa]
 * @returns {string|null}
 */
function numeroEnmascarado(snapshot, id_empresa) {
  const est = estadoEnmascarado(snapshot, id_empresa);
  if (est.estado === 'error') {
    logger.error('No se pudo enmascarar el numero del representante legal', {
      codigo: 'REPRESENTANTE_NO_DESCIFRABLE',
      id_empresa: id_empresa || null,
      error: est.error,
    });
    return null;
  }
  return est.valor;
}

/**
 * Prepara el snapshot para PERSISTIR: el número viaja cifrado.
 *
 * No muta el objeto que recibe: devuelve una copia. Si el snapshot ya venía
 * cifrado, se devuelve tal cual (cifrar dos veces rompería la fila).
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa] - ámbito de la derivación de la llave
 * @returns {object|null}
 */
function cifrarSnapshot(snapshot, id_empresa) {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const copia = Object.assign({}, snapshot);
  const valor = copia.numero_identificacion;
  if (typeof valor !== 'string' || valor.length === 0) return copia;
  if (esCifrado(valor)) return copia;   // ya cifrado: no se cifra dos veces
  copia.numero_identificacion = cifrar(valor, id_empresa, PROPOSITO, CAMPO);
  copia.numero_identificacion_ultimos4 = ultimosDeTexto(valor);
  return copia;
}

/**
 * El snapshot tal como debe quedar en la columna: cifrado, en JSON.
 *
 * @param {object|null} snapshot
 * @param {string} [id_empresa]
 * @returns {string|null}
 */
function snapshotParaGuardar(snapshot, id_empresa) {
  if (!snapshot) return null;
  const cifrado = cifrarSnapshot(snapshot, id_empresa);
  if (!cifrado) return null;
  return JSON.stringify(cifrado);
}

module.exports = {
  leerSnapshot,
  numeroEnClaro,
  ultimos4,
  ultimosDeTexto,
  numeroEnmascarado,
  estadoEnmascarado,
  cifrarSnapshot,
  snapshotParaGuardar,
  esCifrado,          // re-exportado: quien lea el snapshot necesita saber
                      // si el número que ve es un sobre o está en claro.
  PROPOSITO,
  CAMPO,
  ULTIMOS,
  MASCARA,
};
