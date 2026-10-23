/**
 * Utilidades de texto legal compartidas por el servicio de firma y los scripts.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * La guarda de publicación y la auditoría de readiness tienen que mirar el
 * MISMO texto con la MISMA regla. Si cada una tuviera su propia lista de
 * corchetes, una podría dejar pasar lo que la otra rechaza. Acá viven las dos
 * cosas: qué es un placeholder y qué versiones están sujetas a la guarda.
 *
 * No depende de Express, de la base ni de la config: es texto puro.
 */
'use strict';

/**
 * Un placeholder es un corchete con cualquier contenido, incluido el corchete
 * vacío `[ ]` y los corchetes con una lista de opciones. Se limita a 200
 * caracteres y a una sola línea para no comerse un bloque entero cuando el
 * texto trae un corchete sin cerrar.
 */
const RE_PLACEHOLDER = /\[[^\]\n]{0,200}\]/g;

/**
 * Marcadores que no son corchetes pero hacen que un texto legal no se pueda
 * publicar: son marcas de borrador o de revisión pendiente.
 */
const MARCADORES_PROHIBIDOS = [
  {
    codigo: 'ACUERDO_DEV',
    etiqueta: 'texto de desarrollo (ACUERDO DEV)',
    re: /ACUERDO\s+DEV/i,
  },
  {
    codigo: 'PENDIENTE_COMPLETAR',
    etiqueta: 'marca PENDIENTE DE COMPLETAR',
    re: /PENDIENTE\s+DE\s+COMPLETAR/i,
  },
  {
    codigo: 'REVISION_PENDIENTE',
    etiqueta: 'marca Revisión profesional pendiente',
    re: /Revisi[oó]n\s+profesional\s+pendiente/i,
  },
  {
    codigo: 'POR_DILIGENCIAR',
    etiqueta: 'texto "por diligenciar"',
    re: /por\s+diligenciar/i,
  },
];

/**
 * Lista los placeholders de un texto.
 *
 * @param {string} texto
 * @returns {{total: number, unicos: string[], muestras: string[]}}
 *   `total` cuenta ocurrencias; `unicos` no repite; `muestras` es una lista
 *   corta para mostrar en un reporte sin volcar 40 corchetes.
 */
function listarPlaceholders(texto) {
  if (typeof texto !== 'string' || texto.length === 0) {
    return { total: 0, unicos: [], muestras: [] };
  }
  const matches = texto.match(RE_PLACEHOLDER) || [];
  const unicos = [...new Set(matches.map((s) => s.trim()))];
  return {
    total: matches.length,
    unicos,
    muestras: unicos.slice(0, 12),
  };
}

/**
 * Analiza si un texto legal está en condiciones de publicarse.
 *
 * @param {string} texto
 * @returns {{ok: boolean, placeholders: object, marcadores: Array<{codigo: string, etiqueta: string}>}}
 */
function analizarTextoLegal(texto) {
  const placeholders = listarPlaceholders(texto);
  const marcadores = [];
  if (typeof texto === 'string') {
    for (const marcador of MARCADORES_PROHIBIDOS) {
      if (marcador.re.test(texto)) {
        marcadores.push({ codigo: marcador.codigo, etiqueta: marcador.etiqueta });
      }
    }
  }
  return {
    ok: placeholders.total === 0 && marcadores.length === 0,
    placeholders,
    marcadores,
  };
}

/**
 * Parsea una versión con el formato que acepta el API (`v1.0`, `v1.1`…).
 *
 * @param {string} version
 * @returns {{major: number, minor: number}|null}
 */
function parseVersion(version) {
  const m = /^v(\d+)\.(\d+)$/.exec(String(version || '').trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]) };
}

/**
 * ¿La versión es posterior a la v1.0?
 *
 * La v1.0 está publicada y sellada. No se le aplica la guarda de placeholders
 * porque ya pasó por su propio proceso y porque los fixtures de desarrollo la
 * usan con textos sintéticos. La guarda empieza en la v1.1, que es la primera
 * versión nueva después del cierre.
 *
 * @param {string} version
 * @returns {boolean}
 */
function esVersionPosteriorA10(version) {
  const v = parseVersion(version);
  if (!v) return false;
  return v.major > 1 || (v.major === 1 && v.minor > 0);
}

/**
 * Alias con el nombre que usa la guarda de publicación. Se mantiene separado
 * para que el llamador lea la intención, no la comparación de versiones.
 *
 * @param {string} version
 * @returns {boolean}
 */
function esVersionSujetaAGuarda(version) {
  return esVersionPosteriorA10(version);
}

module.exports = {
  RE_PLACEHOLDER,
  MARCADORES_PROHIBIDOS,
  listarPlaceholders,
  analizarTextoLegal,
  parseVersion,
  esVersionPosteriorA10,
  esVersionSujetaAGuarda,
};
