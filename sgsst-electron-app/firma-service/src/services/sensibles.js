'use strict';
/**
 * 8B · LOS DOCUMENTOS CON INFORMACIÓN DE SALUD (numeral 10.8)
 * =============================================================================
 *
 * El numeral 10.8 del Acuerdo de uso:
 *
 *   a) Cuando un documento objeto de firma contenga información relativa a la
 *      salud, el Titular debe ser informado de manera EXPLÍCITA Y PREVIA de
 *      que el dato es SENSIBLE, de CUÁLES SON LOS DATOS que serán objeto de
 *      tratamiento y de la FINALIDAD de éste, y debe otorgar su CONSENTIMIENTO
 *      EXPRESO (art. 6 Ley 1581; art. 6 Decreto 1377 = 2.2.2.25.2.3). En
 *      dicho evento debe informársele igualmente que, por tratarse de datos
 *      sensibles, NO ESTÁ OBLIGADO a autorizar su tratamiento.
 *
 *   c) BASE LEGAL. La base legal es la autorización expresa del Titular. Si
 *      la Empresa fundara el tratamiento en una base legal DISTINTA, debe
 *      informárselo de forma expresa y anticipada antes de recoger el dato, y
 *      esa base debe constar en su política de tratamiento.
 *
 * LA REGLA QUE RESUME TODO
 * -------------------------
 * El 10.8(a) pide un aviso **anterior** y un consentimiento **expreso**,
 * separado del consentimiento general del Acuerdo. El 10.8(b) recuerda que
 * ninguna actividad puede condicionarse a que el Titular SUMINISTRE datos
 * sensibles: el sistema no le pide datos de salud, le pide autorización sobre
 * un documento que ya los trae.
 *
 * LA CONSTATACIÓN DEL DATO
 * ------------------------
 * El sistema NO puede saber qué contiene un PDF. Podría escanear el texto en
 * busca de términos ("diagnóstico", "paciente"), pero eso sería tratar el
 * dato sensible ANTES del consentimiento: exactamente lo que el 10.8
 * prohíbe. Y un PDF puede ser una imagen, donde no hay texto que escanear.
 *
 * Por eso la clasificación tiene dos fuentes, y la segunda es el suelo:
 *
 *   1. Lo que DECLARA la Empresa (`datos_sensibles` + las categorías).
 *   2. Lo que se INFIERE del TIPO de documento: los tipos cuya finalidad en
 *      un SG-SST es el dato de salud.
 *
 * La Empresa puede subir la clasificación, no bajarla. Es deliberado: no
 * declarar algo sensible es la forma habitual de que un dato sensible se
 * trate sin base legal, y el sistema no puede verificar el contenido del
 * PDF.
 */

const { sha256 } = require('../crypto/hash');

/**
 * La versión del texto del aviso. Se muestra al Titular y su huella se
 * guarda con la prueba del consentimiento: sin las dos, no se puede probar
 * QUÉ se le dijo.
 */
const VERSION_AVISO = 'v1.0';

/**
 * Los tipos de documento cuya finalidad, en el contexto de un SG-SST, ES el
 * dato de salud. Se infieren como sensibles aunque la Empresa no lo declare.
 *
 * | Tipo | Por qué |
 * |---|---|
 * | `ACTA` | El acta de estilo y salud (examen médico ocupacional). |
 * | `CERTIFICADO` | El certificado de aptitud física o mental. |
 * | `CONSENTIMIENTO` | El consentimiento de tratamiento de datos de salud. |
 * | `AUTORIZACION` | La autorización de tratamiento de datos de salud. |
 *
 * Los demás (`CONTRATO`, `OTROSI`, `REGLAMENTO`, `POLITICA`, `FORMATO`,
 * `OTRO`) NO se infieren: un contrato laboral menciona la salud en cláusulas
 * sin ser un documento de salud. La Empresa puede declararlos sensibles.
 *
 * @type {readonly string[]}
 */
const TIPOS_SENSIBLES_INFERIDOS = Object.freeze([
  'ACTA',
  'CERTIFICADO',
  'CONSENTIMIENTO',
  'AUTORIZACION',
]);

/**
 * Las categorías por defecto, según el tipo de documento.
 *
 * Son una PRESUNCIÓN: el sistema no leyó el documento, así que no puede saber
 * qué datos trae. La Empresa puede declarar las suyas, que mandan sobre
 * estas. Lo que el Titular ve en el aviso es lo que se guarda en la prueba,
 * así que no puede ser un texto vacío ni genérico sin decir nada.
 */
const CATEGORIAS_POR_TIPO = Object.freeze({
  ACTA: [
    'estado de salud y resultados de las pruebas de ingreso',
    'aptitud física o mental',
    'restricciones y recomendaciones laborales',
  ],
  CERTIFICADO: [
    'estado de salud',
    'aptitud física o mental',
  ],
  CONSENTIMIENTO: [
    'los datos de salud cuya tratamiento el Titular autoriza en este documento',
  ],
  AUTORIZACION: [
    'los datos de salud cuya tratamiento el Titular autoriza en este documento',
  ],
});

/**
 * Las categorías por defecto cuando el documento es de un tipo no inferido
 * pero la Empresa lo declara sensible.
 */
const CATEGORIAS_GENERICAS = Object.freeze([
  'los datos de salud que contenga el documento',
]);

/**
 * La finalidad por defecto: la que el sistema conoce y no puede cambiar.
 */
const FINALIDAD_POR_DEFECTO = 'levantar la firma electrónica del documento';

/**
 * La base legal por defecto: la del 10.8(c).
 */
const BASE_LEGAL_AUTORIZACION = 'autorizacion_expresa';

/**
 * Clasifica un documento: ¿es de dato sensible?
 *
 * @param {object} opts
 * @param {string} [opts.tipoIdentificacion] - la categoría del documento.
 * @param {boolean} [opts.declarado] - lo que declaró la Empresa.
 * @param {string[]} [opts.categoriasDeclaradas] - las categorías que declaró.
 * @param {string} [opts.baseLegalDeclarada] - 'autorizacion_expresa' | 'otra'.
 * @param {string} [opts.baseLegalDescripcion] - la descripción, si es 'otra'.
 * @param {string} [opts.finalidadDeclarada] - la finalidad, si la declaró.
 * @returns {{sensible: boolean, origen: string|null, categorias: string[], base_legal: string|null, base_legal_descripcion: string|null, finalidad: string|null}}
 */
function clasificar({
  tipoIdentificacion = null,
  declarado = false,
  categoriasDeclaradas = null,
  baseLegalDeclarada = null,
  baseLegalDescripcion = null,
  finalidadDeclarada = null,
} = {}) {
  const inferido = TIPOS_SENSIBLES_INFERIDOS.includes(tipoIdentificacion);
  const sensible = declarado === true || inferido;

  if (!sensible) {
    return {
      sensible: false,
      origen: null,
      categorias: [],
      base_legal: null,
      base_legal_descripcion: null,
      finalidad: null,
    };
  }

  const origen = declarado === true && inferido
    ? 'declarado_e_inferido'
    : (declarado === true ? 'declarado' : 'inferido');

  // Las categorías declaradas mandan sobre las del tipo. Si la Empresa
  // declara un conjunto vacío, se usa el del tipo: un aviso sin categorías
  // no cumple el 10.8(a) ("de cuáles son los datos").
  let categorias = Array.isArray(categoriasDeclaradas) && categoriasDeclaradas.length > 0
    ? categoriasDeclaradas.map(c => String(c).trim()).filter(Boolean)
    : (CATEGORIAS_POR_TIPO[tipoIdentificacion] || CATEGORIAS_GENERICAS).slice();
  if (categorias.length === 0) categorias = CATEGORIAS_GENERICAS.slice();

  // La base legal: la del 10.8(c) por defecto. La 'otra' solo vale si viene
  // con su descripción, porque el 10.8(c) exige informar de ella: una base
  // legal sin describir no se puede informar.
  let baseLegal = BASE_LEGAL_AUTORIZACION;
  let descripcion = null;
  if (baseLegalDeclarada === 'otra' && typeof baseLegalDescripcion === 'string' && baseLegalDescripcion.trim()) {
    baseLegal = 'otra';
    descripcion = baseLegalDescripcion.trim();
  }

  const finalidad = (typeof finalidadDeclarada === 'string' && finalidadDeclarada.trim())
    ? finalidadDeclarada.trim()
    : FINALIDAD_POR_DEFECTO;

  return {
    sensible: true,
    origen,
    categorias,
    base_legal: baseLegal,
    base_legal_descripcion: descripcion,
    finalidad,
  };
}

/**
 * El texto del aviso que ve el Titular.
 *
 * Es el texto EXACTO que se le muestra: su huella se guarda con la prueba
 * del consentimiento, así que el aviso no se puede cambiar sin que se note.
 *
 * @param {object} opts
 * @param {string[]} opts.categorias
 * @param {string} opts.finalidad
 * @param {string} opts.baseLegal
 * @param {string|null} [opts.baseLegalDescripcion]
 * @returns {string}
 */
function construirAviso({ categorias, finalidad, baseLegal, baseLegalDescripcion = null }) {
  const l = [];
  l.push('AVISO DE TRATAMIENTO DE DATOS PERSONALES SENSIBLES');
  l.push('');
  l.push('El documento que va a firmar contiene información relativa a la salud.');
  l.push('La información de salud es un dato personal SENSIBLE: tratarla exige su');
  l.push('autorización expresa, salvo que la Empresa le informe de otra base legal');
  l.push('(numeral 10.8 del Acuerdo de uso).');
  l.push('');
  l.push('DATOS QUE SERÁN OBJETO DE TRATAMIENTO:');
  for (const c of categorias) l.push(`  - ${c}`);
  l.push('');
  l.push(`FINALIDAD: ${finalidad}`);
  l.push('');
  if (baseLegal === 'otra') {
    l.push('BASE LEGAL: la Empresa te informa que la base legal de este tratamiento');
    l.push(`es la siguiente, declarada por ella: ${baseLegalDescripcion}`);
    l.push('En este caso no estás GRANTIZANDO: la base legal es la que declara la');
    l.push('Empresa, y debe constar en su política de tratamiento de datos.');
  } else {
    l.push('BASE LEGAL: tu autorización expresa como Titular (numeral 10.8(c)).');
  }
  l.push('');
  l.push('NO ESTÁ OBLIGADO A AUTORIZAR SU TRATAMIENTO. Si no autoriza, no podrá');
  l.push('firmar este documento por medios electrónicos; en ese caso puede solicitar');
  l.push('a la Empresa la firma en papel (numeral 7 del Acuerdo de uso).');
  return l.join('\n');
}

/**
 * El aviso con su versión y su huella.
 *
 * @param {object} clasificacion - lo que devuelve `clasificar()`.
 * @returns {{version: string, texto: string, hash: string}}
 */
function avisoDe(clasificacion) {
  const texto = construirAviso({
    categorias: clasificacion.categorias,
    finalidad: clasificacion.finalidad,
    baseLegal: clasificacion.base_legal,
    baseLegalDescripcion: clasificacion.base_legal_descripcion,
  });
  return {
    version: VERSION_AVISO,
    texto,
    hash: sha256(texto),
  };
}

module.exports = {
  VERSION_AVISO,
  TIPOS_SENSIBLES_INFERIDOS,
  CATEGORIAS_POR_TIPO,
  CATEGORIAS_GENERICAS,
  FINALIDAD_POR_DEFECTO,
  BASE_LEGAL_AUTORIZACION,
  clasificar,
  construirAviso,
  avisoDe,
};
