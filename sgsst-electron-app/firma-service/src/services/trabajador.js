/**
 * Seudónimo del trabajador.
 *
 * POR QUÉ EXISTE
 * --------------
 * `id_trabajador` es la LLAVE DE UNIÓN del sistema: se usa para recuperar
 * la fila de una firma, para listar, para la constancia consolidada y para
 * el consentimiento. Por convención del proyecto, `id_trabajador` ES la
 * cédula del trabajador: K+AIR la envía así y el servicio la guardaba tal
 * cual en `gh_firmas_electronicas.id_trabajador` y dentro del JSON de
 * `metadata`.
 *
 * Eso dejaba la cédula en TEXTO CLARO en la base de datos del servicio, que
 * es la base de datos de un ENCARGADO (Capítulo X del Acuerdo). La
 * comparación con la información registrada por la Empresa se hace por
 * "huella digital con sal" (numeral 3.4(d)), y el servicio no necesita
 * guardar el documento crudo para comparar: necesita guardar algo de lo que
 * solo él puede sacar la conclusión.
 *
 * DECISIÓN
 * --------
 * `id_trabajador` pasa a ser un SEUDÓNIMO determinístico: el HMAC-SHA256
 * del documento de identidad, con clave derivada de la llave maestra del
 * servicio. El pseudónimo:
 *   - no se puede revertir sin la llave (que no está en la base de datos);
 *   - no permite correlacionar al mismo trabajador entre empresas que
 *     usen el servicio, porque la llave se deriva con el ÁMBITO de la
 *     Empresa (ver src/crypto/hmac.js);
 *   - es estable: el mismo documento produce siempre el mismo seudónimo
 *     dentro de la misma Empresa, así que el valor que el cliente envía y el
 *     que el servidor guarda siempre coinciden.
 *
 * El cliente NO cambia: sigue enviando la cédula por el canal interno
 * autenticado. Lo que cambia es lo que el servicio GUARDA. El servidor
 * calcula el seudónimo al recibir la solicitud y, al buscar, compara contra
 * el seudónimo Y contra el valor crudo (para las filas anteriores a este
 * cambio, que todavía guardan la cédula).
 *
 * EL MARCADOR `psn1_`
 * -------------------
 * El seudónimo se guarda con un prefijo que lo hace AUTO-IDENTIFICABLE:
 * `psn1_` + 64 hex. Tres cosas se ganan con eso:
 *
 * 1. IDEMPOTENCIA. `pseudonimo()` es idempotente: aplicado a un valor que
 *    ya es un seudónimo, lo devuelve sin cambios. Sin el marcador, una cadena
 *    de llamadas que le pase un valor YA GUARDADO (que es exactamente lo que
 *    pasa con el consentimiento del representante: el sign request solo tiene
 *    el seudónimo, no el documento) lo hashearía por segunda vez y
 *    produciría un valor que ya no coincide con nada. El marcador vuelve
 *    imposible escribir esa clase de bug.
 *
 * 2. LA BASE SE EXPLICA SOLA. Quien lea la base ve `id_trabajador =
 *    'psn1_...'` y sabe que es un seudónimo y no un documento. Una columna
 *    llena de cadenas hex de 64 caracteres es ambigua; una columna llena de
 *    `psn1_...` no lo es.
 *
 * 3. SE PUEDE AUDITAR. `id_trabajador_alg` dice con qué algoritmo y con qué
 *    versión de llave se calculó; el marcador dice si el valor ES un
 *    seudónimo.
 *
 * EL ÁMBITO
 * ---------
 * El seudónimo se deriva con el `id_empresa` como ámbito. Consecuencia: el
 * mismo trabajador que firma para dos Empresas distintas tiene dos
 * seudónimos distintos, y quien lea la base no puede enlazar ambos. El
 * alcance de la búsqueda NO depende de esto (las consultas siempre filtran
 * también por `id_empresa`): depende de la llave, y por eso se rompe el
 * enlace entre empresas.
 *
 * ROTACIÓN DE LA LLAVE
 * --------------------
 * Las huellas se derivan con una VERSIÓN de llave concreta, que queda
 * registrada en la fila (`id_trabajador_alg`). Al verificar se prueba esa
 * versión y, si no coincide, las demás del anillo (ver src/crypto/keys.js).
 * La versión vieja se conserva mientras viva la evidencia que la usó, así
 * que rotar la llave no invalida las firmas anteriores.
 *
 * LA BÚSQUEDA TAMBIÉN PRUEBA TODAS LAS VERSIONES
 * ---------------------------------------------
 * Verificar no es lo mismo que encontrar. Una fila puede seguir siendo
 * verificable y, al mismo tiempo, ser INVISIBLE para el `SELECT ... WHERE
 * id_trabajador IN (...)` si la búsqueda solo probara la versión vigente.
 *
 * Ese fue el defecto que quedó: la verificación probaba el anillo entero,
 * la búsqueda no. Al rotar la llave, las filas calculadas con la versión
 * anterior se volvían invisibles y las firmas en curso quedaban varadas
 * sin que ningún error lo explicara.
 *
 * Por eso `candidatosBusqueda` y `mismoTrabajador` calculan el seudónimo
 * con CADA versión del anillo, no solo con la vigente. La versión vieja se
 * conserva mientras viva la evidencia que la usó: ese es el requisito
 * para que la rotación no destruya nada.
 */
'use strict';

const {
  hmacHex, algHmac, esAlgHmac, getKeyVersionActual, listKeyVersions,
} = require('../crypto/hmac');

const PROPOSITO = 'trabajador';

// Prefijo auto-identificable del seudónimo. Cambiarlo invalida todos los
// seudónimos calculados: es parte del formato almacenado, no un detalle.
const MARCA = 'psn1_';
const RE_SEUDONIMO = /^psn1_[0-9a-f]{64}$/;

/**
 * ¿Este valor YA es un seudónimo del servicio?
 *
 * @param {string} valor
 * @returns {boolean}
 */
function esPseudonimo(valor) {
  return typeof valor === 'string' && RE_SEUDONIMO.test(valor);
}

/**
 * Calcula el seudónimo de un trabajador a partir de su documento de
 * identidad (el valor crudo que envía el cliente).
 *
 * IDEMPOTENTE: si la entrada ya es un seudónimo, se devuelve tal cual.
 * Ver la nota sobre el marcador `psn1_` en la cabecera del módulo.
 *
 * @param {string} id_trabajador - documento crudo (cédula) o id local
 * @param {string} id_empresa - ámbito de la derivación
 * @param {string} [version] - versión de llave (por defecto, la vigente)
 * @returns {string|null} `psn1_` + hex de 64 chars, o null si la entrada es vacía
 */
function pseudonimo(id_trabajador, id_empresa, version) {
  if (id_trabajador === null || id_trabajador === undefined || id_trabajador === '') {
    return null;
  }
  const valor = String(id_trabajador);
  if (esPseudonimo(valor)) return valor;
  return MARCA + hmacHex(PROPOSITO, valor, id_empresa, version);
}

/**
 * El seudónimo de un trabajador, y con qué versión de llave se calculó.
 *
 * @param {string} id_trabajador
 * @param {string} id_empresa
 * @returns {{seudonimo: string, alg: string}}
 */
function pseudonimoConAlg(id_trabajador, id_empresa) {
  const version = getKeyVersionActual();
  return {
    seudonimo: pseudonimo(id_trabajador, id_empresa, version),
    alg: algHmac(version),
  };
}

/**
 * El seudónimo del trabajador calculado con CADA versión del anillo de
 * llaves.
 *
 * POR QUÉ HAY QUE PROBAR VARIAS VERSIONES
 * ---------------------------------------
 * La verificación de huellas ya prueba todo el anillo (ver
 * `identificacion.candidatosHuella` y `token.tokenHashCandidates`). La
 * BÚSQUEDA tenía que hacer lo mismo, y no lo hacía: `candidatosBusqueda`
 * calculaba el seudónimo solo con la versión vigente.
 *
 * El efecto de esa omisión era silencioso y grave: en el momento en que la
 * llave rotaba, las filas calculadas con la versión anterior se volvieron
 * INVISIBLES. No fallaba la verificación — fallaba el `SELECT ... WHERE
 * id_trabajador IN (...)`, que no encontraba la fila. Una firma en curso
 * quedaba varada sin explicación.
 *
 * Con este arreglo, una fila escrita con cualquier versión del anillo
 * sigue encontrándose, siempre que su versión siga en el anillo (que es
 * justo la condición de conservación de la evidencia).
 *
 * @param {string} id_trabajador - valor crudo que envía el cliente
 * @param {string} id_empresa - ámbito de la derivación
 * @returns {string[]} seudónimos, uno por versión del anillo
 */
function pseudonimosDeTodasLasVersiones(id_trabajador, id_empresa) {
  if (id_trabajador === null || id_trabajador === undefined || id_trabajador === '') {
    return [];
  }
  const valor = String(id_trabajador);
  if (esPseudonimo(valor)) return [valor];
  const vistos = new Set();
  const salida = [];
  for (const version of listKeyVersions()) {
    const p = pseudonimo(valor, id_empresa, version);
    if (vistos.has(p)) continue;
    vistos.add(p);
    salida.push(p);
  }
  return salida;
}

/**
 * Los candidatos con los que hay que buscar una fila de un trabajador:
 * el seudónimo (filas nuevas) y el valor crudo (filas heredadas, que
 * todavía guardan la cédula).
 *
 * El seudónimo se prueba con TODAS las versiones del anillo de llaves
 * (ver `pseudonimosDeTodasLasVersiones`): rotar la llave no puede volver
 * invisible la evidencia anterior.
 *
 * Si la entrada ya es un seudónimo, el único candidato es él mismo: no hay
 * documento crudo que probar.
 *
 * @param {string} id_trabajador - valor crudo que envía el cliente
 * @param {string} id_empresa - ámbito de la derivación
 * @returns {string[]} lista de candidatos para un `IN (...)`
 */
function candidatosBusqueda(id_trabajador, id_empresa) {
  if (id_trabajador === null || id_trabajador === undefined || id_trabajador === '') {
    return [];
  }
  const valor = String(id_trabajador);
  if (esPseudonimo(valor)) return [valor];
  return pseudonimosDeTodasLasVersiones(valor, id_empresa).concat([valor]);
}

/**
 * ¿Son el MISMO trabajador estos dos valores?
 *
 * Cada lado puede venir de un contexto distinto: el seudónimo guardado
 * (columna `id_trabajador`) o el documento crudo (lo que envía el cliente,
 * o lo que guardaban las filas anteriores a la migración 019). La
 * comparación tiene que dar el mismo resultado en los cuatro casos.
 *
 * @param {string} a
 * @param {string} b
 * @param {string} id_empresa - ámbito de la derivación
 * @returns {boolean}
 */
function mismoTrabajador(a, b, id_empresa) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (a === b) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;
  // Un lado es seudónimo y el otro no: se compara contra el seudónimo del
  // lado crudo, en TODAS las versiones del anillo (el seudónimo guardado
  // puede haberse calculado con una versión anterior a la vigente).
  if (esPseudonimo(a)) return pseudonimosDeTodasLasVersiones(b, id_empresa).indexOf(a) !== -1;
  if (esPseudonimo(b)) return pseudonimosDeTodasLasVersiones(a, id_empresa).indexOf(b) !== -1;
  // Ninguno de los dos es seudónimo: son documentos crudos distintos.
  // Dos documentos crudos iguales ya se compararon con `a === b`.
  return false;
}

/**
 * El seudónimo de un trabajador tal como debe quedar en la base, con su
 * marcador de algoritmo.
 *
 * Si el valor de entrada ya es un seudónimo, se respeta (no se re-hashea) y
 * el algoritmo se marca como NULL: el valor no se calculó aquí, así que no
 * se puede afirmar con qué versión de llave se hizo. Marcar la versión
 * vigente sería MENTIR, y una fila con el marcador equivocado manda a
 * reponer una llave que no es la que hace falta.
 *
 * La búsqueda no depende de este marcador: `candidatosBusqueda` prueba
 * todas las versiones del anillo. El marcador es para la auditoría.
 *
 * @param {string} id_trabajador
 * @param {string} id_empresa
 * @returns {{valor: string, alg: string|null}}
 */
function valorParaGuardar(id_trabajador, id_empresa) {
  if (id_trabajador === null || id_trabajador === undefined || id_trabajador === '') {
    return { valor: id_trabajador, alg: null };
  }
  if (esPseudonimo(id_trabajador)) {
    return { valor: String(id_trabajador), alg: null };
  }
  const { seudonimo: valor, alg } = pseudonimoConAlg(id_trabajador, id_empresa);
  return { valor, alg };
}

/**
 * Los candidatos de búsqueda con VARIOS ámbitos a la vez.
 *
 * Hace falta cuando la consulta no filtra por empresa: el seudónimo depende
 * del ámbito, así que sin saber la empresa no se sabe qué seudónimo buscar.
 * En ese caso se prueban los de todas las empresas que tengan firmas (son
 * pocas) más el valor crudo de las filas heredadas.
 *
 * @param {string} id_trabajador - valor crudo que envía el cliente
 * @param {string[]} ambitos - ids de empresa
 * @returns {string[]} lista de candidatos, sin repetir
 */
function candidatosBusquedaConAmbitos(id_trabajador, ambitos) {
  const vistos = new Set();
  const salida = [];
  for (const ambito of ambitos || []) {
    for (const c of candidatosBusqueda(id_trabajador, ambito)) {
      if (vistos.has(c)) continue;
      vistos.add(c);
      salida.push(c);
    }
  }
  return salida;
}

module.exports = {
  pseudonimo,
  pseudonimoConAlg,
  pseudonimosDeTodasLasVersiones,
  valorParaGuardar,
  esPseudonimo,
  candidatosBusqueda,
  candidatosBusquedaConAmbitos,
  mismoTrabajador,
  PROPOSITO,
  MARCA,
  esAlgHmac,
};
