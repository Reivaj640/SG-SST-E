/**
 * CATÁLOGO DE RETENCIÓN POR TIPO DE DOCUMENTO
 * ============================================
 *
 * POR QUÉ EXISTE
 * --------------
 * El numeral 8.6 del Acuerdo deja el plazo de conservación en la tabla de
 * retención documental de la Empresa. Eso funciona para los documentos que la
 * ley no regula, pero no para los que tienen un plazo legal propio:
 *
 *   - El artículo 2.2.4.6.13 del Decreto 1072 de 2015 ordena conservar por un
 *     mínimo de VEINTE (20) AÑOS, contados desde el cese de la relación
 *     laboral, cinco grupos de registros del SG-SST:
 *       1. Perfiles epidemiológicos y conceptos de exámenes médicos.
 *       2. Exámenes médicos especializados y pruebas complementarias.
 *       3. Resultados de mediciones y monitoreo ambiental.
 *       4. Registros de capacitación, formación y entrenamiento.
 *       5. Registros de suministro de elementos y equipos de protección.
 *     Para los demás documentos, el mismo artículo remite al sistema de archivo
 *     o retención documental de la Empresa.
 *
 *   - El artículo 2.2.1.1.12 (adicionado por el Decreto 526 de 2021) obliga a
 *     conservar los contratos de trabajo firmados electrónicamente con
 *     autenticidad, integridad y disponibilidad, SIN fijar un término. Por eso
 *     el contrato no se purga por el vencimiento de la tabla: queda con un HOLD
 *     legal, igual que el deber legal de la Empresa de la migración 029, pero
 *     ahora por documento.
 *
 *   - La historia laboral y la nómina tienen un deber de conservación que la
 *     Corte Constitucional (T-470/2019) vincula con los derechos pensionales.
 *     El Concepto 2-2017-01654 del Archivo General de la Nación sugiere un
 *     rango de 80 a 100 años desde el retiro. Este catálogo aplica el máximo
 *     (100) para no suprimir antes de tiempo; la Empresa puede declarar un
 *     hold si su tabla es más larga.
 *
 * LO QUE ESTE MÓDULO NO HACE
 * --------------------------
 * No lee el PDF. La categoría la elige el operador (o se deriva del tipo y
 * subtipo que manda el cliente). El sistema no puede adivinar el contenido de
 * un documento antes del consentimiento; la clasificación es una decisión
 * humana y queda registrada en la fila.
 *
 * Los plazos sin fecha de cese/retiro NO se inventan: la fila queda con
 * `fecha_conservacion = NULL` y un aviso para que el operador complete la
 * fecha. Sin fecha no hay purga.
 */
'use strict';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const NORMA_SST = '2.2.4.6.13 del Decreto 1072 de 2015';
const NORMA_CONTRATO = '2.2.1.1.12 del Decreto 1072 de 2015';
const NORMA_HISTORIA = 'Corte Constitucional T-470/2019; Concepto AGN 2-2017-01654';
const NORMA_DEBER_LEGAL_EMPRESA = '2.2.1.1.12 del Decreto 1072 de 2015';

/**
 * Las reglas de retención. Una categoría apunta a una regla; varias
 * categorías SST comparten la misma regla de 20 años.
 */
const REGLAS = Object.freeze({
  SST_20_ANOS: Object.freeze({
    id: 'SST_20_ANOS',
    base: 'cese',
    anios: 20,
    requiere_fecha: true,
    hold: false,
    norma: NORMA_SST,
    texto: 'Mínimo 20 años contados desde el cese de la relación laboral '
      + '(artículo 2.2.4.6.13 del Decreto 1072 de 2015).',
    avisoPendiente: 'RETAIN_PENDIENTE_CESE',
    textoPendiente: 'La fecha de cese aún no está registrada; la fecha de '
      + 'conservación queda pendiente.',
  }),
  CONTRATO_ELECTRONICO: Object.freeze({
    id: 'CONTRATO_ELECTRONICO',
    base: null,
    anios: null,
    requiere_fecha: false,
    hold: true,
    norma: NORMA_CONTRATO,
    texto: 'Conservación permanente mientras exista la relación laboral y '
      + 'después, con autenticidad, integridad y disponibilidad; no se suprime '
      + 'automáticamente por la tabla de retención (artículo 2.2.1.1.12 del '
      + 'Decreto 1072 de 2015).',
    aviso: 'RETAIN_DEBER_LEGAL',
  }),
  HISTORIA_LABORAL: Object.freeze({
    id: 'HISTORIA_LABORAL',
    base: 'retiro',
    anios: 100,
    anios_min: 80,
    anios_max: 100,
    requiere_fecha: true,
    hold: false,
    norma: NORMA_HISTORIA,
    texto: 'Entre 80 y 100 años desde el retiro, según la tabla de retención '
      + 'documental (Corte Constitucional T-470/2019; Concepto AGN '
      + '2-2017-01654). Se aplica el máximo de 100 años.',
    avisoPendiente: 'RETAIN_PENDIENTE_RETIRO',
    textoPendiente: 'La fecha de retiro aún no está registrada; la fecha de '
      + 'conservación queda pendiente.',
  }),
  TABLA_EMPRESA: Object.freeze({
    id: 'TABLA_EMPRESA',
    base: 'creacion',
    anios: null,
    requiere_fecha: false,
    hold: false,
    norma: null,
    texto: null,
    textoEmpresa: true,
    aviso: 'RETAIN_FECHA',
  }),
});

/**
 * El catálogo. El `id` es el valor que viaja por la API y se guarda en la
 * fila. El `label` es el texto que ve el operador.
 *
 * `keywords` se usa SOLO para derivar la categoría cuando el cliente manda
 * `tipo_identificacion` + `subtipo_identificacion` y no manda la categoría
 * explícita. La elección explícita siempre gana.
 */
const CATEGORIAS = Object.freeze([
  {
    id: 'SST_PERFIL_Y_CONCEPTOS_MEDICOS',
    label: 'SST · Perfiles epidemiológicos y conceptos de exámenes médicos',
    regla: 'SST_20_ANOS',
    requiere_fecha: true,
    norma: NORMA_SST,
    keywords: [
      'perfil_epidemiologico', 'concepto_medico', 'concepto_ocupacional',
      'examen_medico', 'examen_de_ingreso', 'examen_periodico',
      'examen_de_retiro', 'medico_ocupacional',
    ],
  },
  {
    id: 'SST_EXAMENES_ESPECIALIZADOS',
    label: 'SST · Exámenes médicos especializados y pruebas complementarias',
    regla: 'SST_20_ANOS',
    requiere_fecha: true,
    norma: NORMA_SST,
    keywords: [
      'especializado', 'complementario', 'paraclinico', 'audiometria',
      'espirometria', 'optometria', 'radiografia', 'laboratorio_clinico',
    ],
  },
  {
    id: 'SST_MONITOREO_AMBIENTAL',
    label: 'SST · Monitoreo y mediciones ambientales',
    regla: 'SST_20_ANOS',
    requiere_fecha: true,
    norma: NORMA_SST,
    keywords: [
      'monitoreo', 'medicion_ambiental', 'higienico', 'ruido',
      'iluminacion', 'vibracion', 'quimico',
    ],
  },
  {
    id: 'SST_CAPACITACION',
    label: 'SST · Capacitación, inducción y entrenamiento',
    regla: 'SST_20_ANOS',
    requiere_fecha: true,
    norma: NORMA_SST,
    keywords: [
      'induccion', 'capacitacion', 'entrenamiento', 'formacion', 'charla',
      'educacion',
    ],
  },
  {
    id: 'SST_EPP',
    label: 'SST · Entrega de elementos de protección personal',
    regla: 'SST_20_ANOS',
    requiere_fecha: true,
    norma: NORMA_SST,
    keywords: [
      'epp', 'elemento_de_proteccion', 'elementos_de_proteccion',
      'proteccion_personal', 'equipo_de_proteccion',
    ],
  },
  {
    id: 'CONTRATO_TRABAJO',
    label: 'Contrato de trabajo electrónico',
    regla: 'CONTRATO_ELECTRONICO',
    requiere_fecha: false,
    norma: NORMA_CONTRATO,
    keywords: ['contrato', 'otrosi'],
  },
  {
    id: 'HISTORIA_LABORAL',
    label: 'Historia laboral y nómina',
    regla: 'HISTORIA_LABORAL',
    requiere_fecha: true,
    norma: NORMA_HISTORIA,
    keywords: [
      'historia_laboral', 'historial_laboral', 'nomina', 'certificado_laboral',
      'certificado_de_trabajo', 'liquidacion',
    ],
  },
  {
    id: 'ASPIRANTE',
    label: 'Hoja de vida de aspirante',
    regla: 'TABLA_EMPRESA',
    requiere_fecha: false,
    norma: null,
    keywords: ['hoja_de_vida', 'aspirante', 'candidato', 'postulante', 'entrevista'],
  },
  {
    id: 'TABLA_EMPRESA',
    label: 'Según la tabla de retención de la empresa',
    regla: 'TABLA_EMPRESA',
    requiere_fecha: false,
    norma: null,
    keywords: [],
  },
]);

const POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));

/**
 * El ORDEN en que se buscan las palabras clave para derivar la categoría.
 *
 * No es el orden del catálogo: es el de "más específico primero". Un
 * "examen médico especializado" tiene que caer en EXAMENES_ESPECIALIZADOS, no
 * en el grupo general de conceptos, y una "capacitación en EPP" es un registro
 * de capacitación, no una entrega de EPP.
 */
const ORDEN_BUSQUEDA = Object.freeze([
  'SST_EXAMENES_ESPECIALIZADOS',
  'SST_MONITOREO_AMBIENTAL',
  'SST_CAPACITACION',
  'SST_EPP',
  'SST_PERFIL_Y_CONCEPTOS_MEDICOS',
  'HISTORIA_LABORAL',
  'ASPIRANTE',
]);

/**
 * Normaliza un texto para comparar palabras clave: minúsculas, sin acentos y
 * con los separadores convertidos a `_`.
 */
function _norm(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function categoriaValida(id) {
  return typeof id === 'string' && POR_ID.has(id);
}

/**
 * Valida una categoría y devuelve su definición. Lanza un error con código
 * propio para que el servicio HTTP lo convierta en un 400 explicable.
 */
function validarCategoria(id) {
  const categoria = POR_ID.get(id);
  if (!categoria) {
    const error = new Error(
      `categoria_retencion debe ser una de: ${CATEGORIAS.map((c) => c.id).join(', ')}`
    );
    error.code = 'CATEGORIA_RETENCION_INVALIDA';
    error.categorias = CATEGORIAS.map((c) => c.id);
    throw error;
  }
  return categoria;
}

/**
 * Resuelve la categoría de retención de una solicitud.
 *
 * Orden:
 *   1. La categoría explícita (la elige el operador).
 *   2. El tipo de documento + el subtipo (contrato, SST, historia laboral...).
 *   3. `TABLA_EMPRESA` si el cliente mandó un tipo que no está catalogado.
 *   4. `null` si no mandó nada: es una solicitud legacy y se conserva el
 *      comportamiento anterior (tabla de la Empresa, texto vivo).
 *
 * @param {object} opts
 * @param {string} [opts.categoria_retencion]
 * @param {string} [opts.tipo_identificacion]
 * @param {string} [opts.subtipo_identificacion]
 * @param {string} [opts.metadata] - JSON string; de ahí sale el subtipo si no
 *   vino como parámetro.
 * @returns {string|null}
 */
function resolverCategoria({
  categoria_retencion,
  tipo_identificacion,
  subtipo_identificacion,
  metadata,
} = {}) {
  if (categoriaValida(categoria_retencion)) return categoria_retencion;

  let subtipo = subtipo_identificacion;
  if (!subtipo && typeof metadata === 'string' && metadata.length > 0) {
    try {
      const obj = JSON.parse(metadata);
      if (obj && typeof obj === 'object') subtipo = obj.subtipo_identificacion;
    } catch (_) {
      // Un metadata malformado no puede tumbar la clasificación: se sigue con
      // lo que haya. La ruta ya validó el JSON antes de llegar acá.
    }
  }

  const tipo = _norm(tipo_identificacion);
  if (tipo === 'contrato' || tipo === 'otrosi') return 'CONTRATO_TRABAJO';

  const texto = _norm(`${subtipo || ''} ${tipo_identificacion || ''}`);
  if (!texto) return null;

  for (const id of ORDEN_BUSQUEDA) {
    const categoria = POR_ID.get(id);
    for (const keyword of categoria.keywords) {
      if (texto.includes(keyword)) return categoria.id;
    }
  }

  // Mandó un tipo de documento que no está en el catálogo: la tabla de la
  // Empresa es la respuesta correcta, no un plazo inventado.
  return tipo ? 'TABLA_EMPRESA' : null;
}

/**
 * Devuelve la definición de la regla de una categoría. Si la categoría no
 * existe, devuelve la regla de la tabla de la Empresa.
 */
function reglaDe(categoriaId) {
  const categoria = POR_ID.get(categoriaId);
  return categoria ? REGLAS[categoria.regla] : REGLAS.TABLA_EMPRESA;
}

/**
 * Suma años a una fecha, en UTC. Si la fecha no es válida, devuelve null.
 * No se inventa una fecha: sin fecha de cese/retiro no hay plazo computable.
 */
function sumarAnios(fecha, anios) {
  if (!fecha) return null;
  const base = new Date(fecha);
  if (Number.isNaN(base.getTime())) return null;
  const n = Number(anios);
  if (!Number.isInteger(n) || n <= 0) return null;
  const resultado = new Date(base.getTime());
  resultado.setUTCFullYear(resultado.getUTCFullYear() + n);
  return resultado.toISOString();
}

/**
 * Normaliza una fecha de terminación. Acepta ISO completo o `YYYY-MM-DD`.
 * Devuelve null si no es una fecha válida.
 */
function normalizarFecha(fecha) {
  if (fecha === null || fecha === undefined || fecha === '') return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function _sumarDias(fecha, dias) {
  if (!fecha) return null;
  const d = Number(dias);
  if (!Number.isInteger(d) || d <= 0) return null;
  const base = new Date(fecha);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + d * MS_POR_DIA).toISOString();
}

/**
 * Calcula el plan de retención de una solicitud.
 *
 * Es una función PURA: no escribe en la base. El llamador (signRequest.create
 * o conservacion.asignarFechaConservacion) aplica el plan después de insertar
 * la fila.
 *
 * @param {object} opts
 * @param {string} [opts.categoria_retencion]
 * @param {string} [opts.regla_retencion]
 * @param {string} [opts.fecha_creacion]
 * @param {string} [opts.fecha_terminacion]
 * @param {object} [opts.empresa] - fila de gh_firma_empresas (con
 *   plazo_retencion, plazo_retencion_dias, conservacion_por_deber_legal y
 *   norma_conservacion).
 * @returns {{
 *   categoria: string|null,
 *   regla: string,
 *   base: string|null,
 *   anios: number|null,
 *   fecha_conservacion: string|null,
 *   texto: string|null,
 *   hold: object|null,
 *   aviso: string
 * }}
 */
function planificar({
  categoria_retencion,
  regla_retencion,
  fecha_creacion,
  fecha_terminacion,
  empresa,
} = {}) {
  const categoriaId = categoriaValida(categoria_retencion)
    ? categoria_retencion
    : null;
  const categoria = categoriaId ? POR_ID.get(categoriaId) : null;
  const reglaId = regla_retencion && REGLAS[regla_retencion]
    ? regla_retencion
    : (categoria ? categoria.regla : 'TABLA_EMPRESA');
  const regla = REGLAS[reglaId];
  const emp = empresa || {};

  // Texto que se comunica al Trabajador. La tabla de la Empresa usa el texto
  // vivo de la Empresa; las reglas legales usan su texto fijo. Las solicitudes
  // legacy (sin categoría) devuelven null a propósito: la vista pública sigue
  // leyendo la Empresa viva, como antes de este catálogo.
  let texto = null;
  if (!categoriaId && reglaId === 'TABLA_EMPRESA') {
    // Solicitud legacy: la vista pública sigue leyendo la Empresa viva.
    texto = null;
  } else if (regla.textoEmpresa) {
    texto = (typeof emp.plazo_retencion === 'string' && emp.plazo_retencion.trim())
      ? emp.plazo_retencion.trim()
      : null;
  } else {
    texto = regla.texto;
  }

  // Fecha de conservación.
  let fecha = null;
  if (regla.base === 'cese' || regla.base === 'retiro') {
    const termino = normalizarFecha(fecha_terminacion);
    if (termino) fecha = sumarAnios(termino, regla.anios);
  } else if (regla.base === 'creacion') {
    fecha = _sumarDias(fecha_creacion, emp.plazo_retencion_dias);
  }

  // Hold legal.
  //
  // El deber legal declarado por la Empresa (migración 029) MANDA sobre
  // cualquier plazo: es la parte que no se puede suprimir, y un plazo más
  // corto no puede recortar un deber sin término. Perder esa protección por
  // clasificar el documento sería una supresión indebida, así que aquí el
  // hold de la Empresa gana siempre.
  //
  // Si la Empresa NO declaró deber legal, el hold lo trae la propia regla
  // (el contrato electrónico del 2.2.1.1.12).
  let hold = null;
  const normaEmpresa = emp.norma_conservacion || NORMA_DEBER_LEGAL_EMPRESA;
  if (emp.conservacion_por_deber_legal) {
    hold = {
      actor: 'sistema',
      motivo: 'deber_legal_' + normaEmpresa,
      alcance: normaEmpresa,
    };
  } else if (regla.hold) {
    hold = {
      actor: 'sistema',
      motivo: 'deber_legal_' + regla.norma,
      alcance: regla.norma,
    };
  }

  // Con hold no hay fecha de supresión: la fecha que el catálogo calculó
  // deja de ser una fecha de supresión y es solo un piso informativo.
  if (hold) fecha = null;

  let aviso;
  if (hold) {
    aviso = 'RETAIN_DEBER_LEGAL';
  } else if (fecha) {
    aviso = 'RETAIN_FECHA';
  } else if (regla.base === 'cese') {
    aviso = 'RETAIN_PENDIENTE_CESE';
  } else if (regla.base === 'retiro') {
    aviso = 'RETAIN_PENDIENTE_RETIRO';
  } else {
    aviso = 'RETAIN_SIN_PLAZO';
  }

  // Si la regla exige una fecha y no la hay, se dice en el texto que se
  // comunica. No se inventa la fecha ni se simula un hold.
  if (regla.requiere_fecha && !fecha && texto) {
    texto = `${texto} ${regla.textoPendiente}`;
  }

  return {
    categoria: categoriaId,
    regla: reglaId,
    base: regla.base,
    anios: regla.anios,
    fecha_conservacion: fecha,
    texto,
    hold,
    aviso,
  };
}

module.exports = {
  REGLAS,
  CATEGORIAS,
  NORMA_SST,
  NORMA_CONTRATO,
  NORMA_HISTORIA,
  categoriaValida,
  validarCategoria,
  resolverCategoria,
  reglaDe,
  sumarAnios,
  normalizarFecha,
  planificar,
};
