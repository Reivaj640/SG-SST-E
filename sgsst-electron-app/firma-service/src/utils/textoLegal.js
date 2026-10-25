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
 * También vive aquí la única excepción a la regla: los campos que registra el
 * sistema (`[registrada por el sistema]`), que se listan pero no bloquean.
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
 * Campos que registra el sistema: NO son huecos por diligencear.
 *
 * La v1.0 del Acuerdo —publicada, sellada y viva en producción— cierra su
 * bloque de Manifestación de Voluntad con cuatro líneas de este tipo:
 *
 *   Fecha y hora de aceptación: [registrada por el sistema]
 *   Versión del Acuerdo aceptada: [registrada por el sistema]
 *   Huella digital del texto: [registrada por el sistema]
 *   Firma del Trabajador: [registrada por el sistema]
 *
 * El sistema NO sustituye esos campos dentro del texto que se le muestra al
 * trabajador (`web/firma/app.js` pinta el texto tal cual): los valores quedan
 * en la base y en la constancia PDF. El corchete declara, en el propio texto,
 * que ese campo lo llena el sistema: no es un dato que falte.
 *
 * La excepción es de CONTENIDO EXACTO. Solo el texto entre corchetes que sea
 * exactamente "registrada por el sistema" deja de contar como hueco; cualquier
 * variación ("registrada por la empresa", "registrada por el sistema más
 * adelante") sigue contando como hueco y bloquea la publicación.
 */
const PLACEHOLDERS_DEL_SISTEMA = [
  {
    valor: 'registrada por el sistema',
    etiqueta: 'campo que registra el sistema',
  },
];

/**
 * Campos que diligencia la Empresa en la copia que firma: NO son huecos que
 * el Encargado pueda llenar.
 *
 * El Anexo de Nube es un MODELO: describe la nube de K+AIR (que es una sola) y
 * lo firma cada Empresa con sus propios datos. Los tres campos de la parte
 * responsable —nombre, NIT y representante legal de la Empresa— cambian en cada
 * copia, asi que no se pueden diligenciar en el archivo del repo: se diligencian
 * a mano, en cada copia, al firmar.
 *
 * Si esos tres campos fueran huecos que bloquean, el check del repo pediria
 * quitarlos y el Anexo no podria publicarse nunca: un requisito que la
 * arquitectura no puede satisfacer. Si NO fueran huecos, el aviso de que el
 * documento esta a medias dejaria de tener sentido. Por eso son una tercera
 * clase: se LISTAN (nada queda escondido) pero no bloquean, igual que los
 * campos que registra el sistema.
 *
 * La excepcion es de CONTENIDO EXACTO y aplica SOLO al Anexo de Nube: el
 * modulo legal dice cuales son, y el consumidor decide donde las aplica.
 */
const PLACEHOLDERS_DE_LA_EMPRESA = [
  {
    valor: 'nombre de la Empresa',
    etiqueta: 'nombre de la Empresa que firma',
  },
  {
    valor: 'NIT de la Empresa',
    etiqueta: 'NIT de la Empresa que firma',
  },
  {
    valor: 'representante legal de la Empresa',
    etiqueta: 'representante legal de la Empresa que firma',
  },
];

/**
 * Normaliza el contenido de un placeholder para compararlo: sin corchetes, sin
 * espacios sobrantes y en minúsculas.
 *
 * @param {string} contenido
 * @returns {string}
 */
function _normalizarContenido(contenido) {
  return String(contenido == null ? '' : contenido)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * ¿Este placeholder es un campo que registra el sistema?
 *
 * @param {string} placeholder el corchete completo, con sus corchetes
 * @returns {boolean}
 */
function esPlaceholderDelSistema(placeholder) {
  const m = /^\[([^\]\n]*)\]$/.exec(String(placeholder == null ? '' : placeholder).trim());
  if (!m) return false;
  const contenido = _normalizarContenido(m[1]);
  return PLACEHOLDERS_DEL_SISTEMA.some(
    (campo) => contenido === _normalizarContenido(campo.valor),
  );
}

/**
 * ¿Este placeholder es un campo que diligencia la Empresa al firmar?
 *
 * Misma regla que `esPlaceholderDelSistema`: contenido EXACTO. Cualquier
 * variacion ("NIT de la Empresa cliente", "NIT de la empresa") sigue contando
 * como hueco y bloquea.
 *
 * @param {string} placeholder el corchete completo, con sus corchetes
 * @returns {boolean}
 */
function esPlaceholderDeLaEmpresa(placeholder) {
  const m = /^\[([^\]\n]*)\]$/.exec(String(placeholder == null ? '' : placeholder).trim());
  if (!m) return false;
  const contenido = _normalizarContenido(m[1]);
  return PLACEHOLDERS_DE_LA_EMPRESA.some(
    (campo) => contenido === _normalizarContenido(campo.valor),
  );
}

/**
 * Devuelve las ocurrencias de placeholder de un texto, en orden.
 *
 * Usa una copia del patrón para no depender del `lastIndex` de un regex global
 * compartido: dos llamadas seguidas siempre devuelven lo mismo.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function buscarPlaceholders(texto) {
  if (typeof texto !== 'string' || texto.length === 0) return [];
  return texto.match(new RegExp(RE_PLACEHOLDER.source, 'g')) || [];
}

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
    // El aviso de "no firmar" del Anexo de Nube. La MISMA frase es la que el
    // readiness exige como cláusula del Anexo (`banner`): una sola fuente de
    // verdad, para que la exijencia y el bloqueo no se desincronicen.
    //
    // Sin esto, un Anexo que dice "no firmar hasta completar los datos" y no
    // tiene corchetes pasaría el check: el documento se publicaría y se
    // firmaría con el aviso de que no se firme dentro. Un check que no muerde
    // en la dirección peligrosa.
    codigo: 'NO_FIRMAR',
    etiqueta: 'aviso de no firmar hasta completar los datos',
    re: /NO\s+FIRMAR\s+HASTA\s+COMPLETAR\s+LOS\s+DATOS/i,
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
 * Lista los placeholders de un texto y los separa en dos clases.
 *
 * `huecos` son los que alguien tiene que llenar: son los que bloquean la
 * publicación. `sistema` son los campos que registra el propio sistema: se
 * listan (nada queda escondido) pero no bloquean.
 *
 * @param {string} texto
 * @returns {{total: number, unicos: string[], muestras: string[],
 *            huecos: {total: number, unicos: string[], muestras: string[]},
 *            sistema: {total: number, unicos: string[], muestras: string[]}}}
 *   `total` cuenta ocurrencias; `unicos` no repite; `muestras` es una lista
 *   corta para mostrar en un reporte sin volcar 40 corchetes.
 */
function listarPlaceholders(texto) {
  if (typeof texto !== 'string' || texto.length === 0) {
    return {
      total: 0,
      unicos: [],
      muestras: [],
      huecos: { total: 0, unicos: [], muestras: [] },
      sistema: { total: 0, unicos: [], muestras: [] },
    };
  }
  const matches = buscarPlaceholders(texto);
  const unicos = [...new Set(matches.map((s) => s.trim()))];
  const delSistema = unicos.filter(esPlaceholderDelSistema);
  const huecosUnicos = unicos.filter((u) => !esPlaceholderDelSistema(u));
  const totalSistema = matches.filter(esPlaceholderDelSistema).length;
  return {
    total: matches.length,
    unicos,
    muestras: unicos.slice(0, 12),
    huecos: {
      total: matches.length - totalSistema,
      unicos: huecosUnicos,
      muestras: huecosUnicos.slice(0, 12),
    },
    sistema: {
      total: totalSistema,
      unicos: delSistema,
      muestras: delSistema.slice(0, 12),
    },
  };
}

/**
 * Analiza si un texto legal está en condiciones de publicarse.
 *
 * Bloquea por los huecos y por las marcas de borrador. Los campos que
 * registra el sistema no bloquean: el texto legal de la v1.0, que ya está
 * publicada y sellada, los usa en su bloque de Manifestación de Voluntad.
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
    ok: placeholders.huecos.total === 0 && marcadores.length === 0,
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

/**
 * Devuelve la expresión regular de un marcador prohibido, por su codigo.
 *
 * Existe para que el consumidor NO copie el patrón: el modulo legal es el
 * unico que sabe que frase significa "esto no se firma". Una copia del regex
 * se desincroniza y el check miente.
 *
 * @param {string} codigo
 * @returns {RegExp|null}
 */
function reDeMarcador(codigo) {
  const marcador = MARCADORES_PROHIBIDOS.find((m) => m.codigo === codigo);
  return marcador ? marcador.re : null;
}

module.exports = {
  RE_PLACEHOLDER,
  MARCADORES_PROHIBIDOS,
  PLACEHOLDERS_DEL_SISTEMA,
  PLACEHOLDERS_DE_LA_EMPRESA,
  listarPlaceholders,
  analizarTextoLegal,
  parseVersion,
  esVersionPosteriorA10,
  esVersionSujetaAGuarda,
  esPlaceholderDelSistema,
  esPlaceholderDeLaEmpresa,
  buscarPlaceholders,
  reDeMarcador,
};
