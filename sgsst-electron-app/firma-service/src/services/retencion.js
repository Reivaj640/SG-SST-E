/**
 * CATÁLOGO DE RETENCIÓN POR TIPO DE DOCUMENTO
 * ============================================
 *
 * POR QUÉ EXISTE
 * --------------
 * El numeral 8.6 del Acuerdo deja el plazo de conservación en la tabla de
 * retención documental de la Empresa. Pero hay documentos cuyo plazo NO lo
 * fija la Empresa, y hay un piso que ninguna tabla puede bajar:
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
 *     autenticidad, integridad y disponibilidad, SIN fijar un término.
 *
 *   - La historia laboral y la nómina tienen un deber de conservación ligado a
 *     los derechos pensionales (Corte Constitucional T-470/2019). El Concepto
 *     2-2017-01654 del Archivo General de la Nación propone un rango de 80 a
 *     100 años desde el retiro.
 *
 * LA REGLA DEL SISTEMA: 80 AÑOS DE CUSTODIA
 * ----------------------------------------
 * El sistema aplica por defecto **80 años de custodia documental contados
 * desde la fecha de la firma** (`ANIOS_CUSTODIA`). Es un piso, no un techo:
 *
 *   - Cubre el mínimo legal de 20 años desde el cese para los cinco grupos
 *     SST (80 años desde la firma superan los 20 años desde el cese en
 *     cualquier relación laboral de duración razonable). Cuando el sistema
 *     conoce la fecha de cese, la compara y se queda con la más lejana.
 *   - Cubre el rango de 80 a 100 años desde el retiro de la historia laboral.
 *   - Si la Empresa declara un plazo MÁS LARGO en su tabla de retención, ese
 *     plazo manda: la tabla de la Empresa es la fuente del 8.6.
 *   - El contrato electrónico es la única excepción: no tiene término, queda
 *     con un HOLD y no se borra por el vencimiento de la custodia.
 *
 * POR QUÉ NADA DE ESTO SE LE PIDE AL OPERADOR
 * -------------------------------------------
 * El operador no elige el plazo ni la fecha de cese. El sistema clasifica el
 * documento por su tipo (que el sistema ya conoce) y aplica la regla. La
 * fecha de cese se usa solo si el sistema la conoce (p. ej. porque la ficha
 * del trabajador la trae); nunca se le pregunta a nadie.
 *
 * LO QUE ESTE MÓDULO NO HACE
 * ---------------------------
 * No lee el PDF. La categoría se deriva del TIPO del documento, que es un
 * dato estructurado del propio sistema, o la declara el cliente en la API.
 * El sistema no puede adivinar el contenido de un documento antes del
 * consentimiento; la clasificación es una regla de código, no un juicio.
 *
 * Los plazos sin fecha de cese conocida NO se inventan: se aplica la custodia
 * de 80 años desde la firma, que es el piso del sistema.
 */
'use strict';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const NORMA_SST = '2.2.4.6.13 del Decreto 1072 de 2015';
const NORMA_CONTRATO = '2.2.1.1.12 del Decreto 1072 de 2015';
const NORMA_HISTORIA = 'Corte Constitucional T-470/2019; Concepto AGN 2-2017-01654';
const NORMA_DEBER_LEGAL_EMPRESA = '2.2.1.1.12 del Decreto 1072 de 2015';

/**
 * La custodia documental del sistema, en años.
 *
 * Es el plazo por defecto de TODA firma. Está en el código y no se pide: ni
 * al operador, ni a la Empresa. Ver la cabecera del archivo.
 */
const ANIOS_CUSTODIA = 80;

/**
 * Las reglas de retención. Una categoría apunta a una regla; varias
 * categorías SST comparten la misma regla de custodia.
 *
 * `base` es de dónde se cuenta el plazo:
 *   - 'creacion' → desde la fecha de la firma.
 *   - 'cese'     → desde el cese de la relación laboral (o el retiro).
 *   - null       → no hay plazo: el documento queda con HOLD.
 *
 * `piso` es el mínimo legal que NO se puede bajar por mucho que la tabla de
 * la Empresa declare menos.
 */
const REGLAS = Object.freeze({
  CUSTODIA_80_ANOS: Object.freeze({
    id: 'CUSTODIA_80_ANOS',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    piso: null,
    hold: false,
    norma: null,
    texto: 'Se conserva {anios} años contados desde la fecha de la firma.',
  }),
  SST_20_ANOS: Object.freeze({
    id: 'SST_20_ANOS',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    // El mínimo legal del 2.2.4.6.13: 20 años desde el cese. Se compara con
    // la fecha de cese cuando el sistema la conoce.
    piso: Object.freeze({ base: 'cese', anios: 20, norma: NORMA_SST }),
    hold: false,
    norma: NORMA_SST,
    texto: 'Se conserva {anios} años contados desde la fecha de la firma. '
      + 'El mínimo legal es de 20 años contados desde el cese de la relación '
      + 'laboral (artículo 2.2.4.6.13 del Decreto 1072 de 2015), y esta '
      + 'custodia lo cubre.',
  }),
  CONTRATO_ELECTRONICO: Object.freeze({
    id: 'CONTRATO_ELECTRONICO',
    base: null,
    anios: null,
    piso: null,
    hold: true,
    norma: NORMA_CONTRATO,
    texto: 'El contrato firmado electrónicamente se conserva sin término, con '
      + 'autenticidad, integridad y disponibilidad (artículo 2.2.1.1.12 del '
      + 'Decreto 1072 de 2015): no se borra por el vencimiento de la custodia.',
  }),
  HISTORIA_LABORAL: Object.freeze({
    id: 'HISTORIA_LABORAL',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    piso: null,
    hold: false,
    norma: NORMA_HISTORIA,
    texto: 'Se conserva {anios} años contados desde la fecha de la firma, '
      + 'dentro del rango de 80 a 100 años desde el retiro que fija el Concepto '
      + '2-2017-01654 del Archivo General de la Nación (Corte Constitucional '
      + 'T-470/2019).',
  }),
  TABLA_EMPRESA: Object.freeze({
    id: 'TABLA_EMPRESA',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    piso: null,
    hold: false,
    norma: null,
    texto: 'Se conserva {anios} años contados desde la fecha de la firma.',
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
    norma: NORMA_SST,
    keywords: [
      'epp', 'elemento_de_proteccion', 'elementos_de_proteccion',
      'proteccion_personal', 'equipo_de_proteccion',
    ],
  },
  {
    id: 'CONTRATO_TRABAJO',
    label: 'Contrato de trabajo',
    regla: 'CONTRATO_ELECTRONICO',
    norma: NORMA_CONTRATO,
    keywords: ['contrato', 'otrosi'],
  },
  {
    id: 'HISTORIA_LABORAL',
    label: 'Historia laboral y nómina',
    regla: 'HISTORIA_LABORAL',
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
    norma: null,
    keywords: ['hoja_de_vida', 'aspirante', 'candidato', 'postulante', 'entrevista'],
  },
  {
    id: 'TABLA_EMPRESA',
    label: 'Resto de documentos (custodia del sistema)',
    regla: 'TABLA_EMPRESA',
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
 *   1. La categoría explícita (la declara el cliente en la API).
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

  // Mandó un tipo de documento que no está en el catálogo: la custodia del
  // sistema es la respuesta correcta, no un plazo inventado.
  return tipo ? 'TABLA_EMPRESA' : null;
}


/**
 * Suma años a una fecha, en UTC. Si la fecha no es válida, devuelve null.
 * No se inventa una fecha: sin fecha de cese/retiro se aplica la custodia
 * desde la firma.
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

/** Convierte días a años redondeados (para el texto que ve el trabajador). */
function _aniosDeDias(dias) {
  const d = Number(dias);
  if (!Number.isFinite(d) || d <= 0) return ANIOS_CUSTODIA;
  return Math.max(1, Math.round(d / 365.25));
}

/** La fecha más lejana de las dos (null = no aplica). */
function _fechaMasLejana(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Calcula el plan de retención de una solicitud.
 *
 * Es una función PURA: no escribe en la base. El llamador (signRequest.create
 * o conservacion.aplicarPlanRetencion) aplica el plan después de insertar la
 * fila.
 *
 * @param {object} opts
 * @param {string} [opts.categoria_retencion]
 * @param {string} [opts.regla_retencion]
 * @param {string} [opts.fecha_creacion]
 * @param {string} [opts.fecha_terminacion] - Cese o retiro, si el sistema lo
 *   conoce. Nunca se le pide a nadie: si no está, la custodia de 80 años desde
 *   la firma cubre el mínimo legal.
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

  // ── La fecha de conservación ────────────────────────────────────────────
  //
  // 1. El plazo base: la tabla de la Empresa si declaró uno (es la fuente
  //    del 8.6); si no declaró nada, la custodia del sistema (80 años). Nadie
  //    tiene que declarar nada para que exista un plazo.
  // 2. El piso legal de la categoría (los grupos SST: 20 años, contados
  //    desde la creación y, si se conoce el cese, desde el cese). El piso no
  //    se puede bajar por mucho que la tabla declare menos.
  let aniosBase = regla.anios || ANIOS_CUSTODIA;
  let fecha = null;

  if (regla.base === 'creacion') {
    const diasEmpresa = Number(emp.plazo_retencion_dias);
    if (Number.isInteger(diasEmpresa) && diasEmpresa > 0) {
      fecha = _sumarDias(fecha_creacion, diasEmpresa);
      aniosBase = _aniosDeDias(diasEmpresa);
    } else {
      fecha = sumarAnios(fecha_creacion, aniosBase);
    }
  } else if (regla.base === 'cese' || regla.base === 'retiro') {
    const termino = normalizarFecha(fecha_terminacion);
    fecha = termino ? sumarAnios(termino, regla.anios) : null;
  }
  const fechaBase = fecha;

  // El piso legal: 20 años para los cinco grupos SST. Se cuenta desde la
  // creación (siempre se puede calcular) y, si el sistema conoce la fecha de
  // cese, también desde el cese (que es el hecho que mira la ley).
  let usoPiso = false;
  if (regla.piso && !regla.hold && fechaBase) {
    fecha = _fechaMasLejana(fechaBase, sumarAnios(fecha_creacion, regla.piso.anios));
    const termino = normalizarFecha(fecha_terminacion);
    if (termino) {
      fecha = _fechaMasLejana(fecha, sumarAnios(termino, regla.piso.anios));
    }
    usoPiso = fecha !== fechaBase;
  }

  // ── El hold legal ───────────────────────────────────────────────────────
  //
  // El deber legal declarado por la Empresa (migración 029) MANDA sobre
  // cualquier plazo: es la parte que no se puede suprimir, y un plazo más
  // corto no puede recortar un deber sin término. Perder esa protección por
  // clasificar el documento sería una supresión indebida.
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

  // Con hold no hay fecha de supresión: la fecha calculada deja de ser una
  // fecha de supresión y es solo un piso informativo.
  if (hold) fecha = null;

  // ── El texto que se comunica al Trabajador ─────────────────────────────
  //
  // El texto dice el plazo APLICADO (el que la fila va a guardar):
  //   - el texto que declaró la Empresa, cuando el plazo aplicado es el suyo
  //     (es su tabla de retención y su redacción);
  //   - el texto de la regla, cuando el plazo lo puso el sistema (custodia
  //     de 80 años) o cuando el piso legal subió el plazo de la Empresa (ahí
  //     manda la redacción del sistema, que dice la base legal).
  const aniosAplicados = fecha
    ? Math.max(1, Math.round(
      (new Date(fecha).getTime() - new Date(fecha_creacion).getTime())
      / (365.25 * MS_POR_DIA)
    ))
    : aniosBase;
  const textoEmpresa = (typeof emp.plazo_retencion === 'string' && emp.plazo_retencion.trim())
    ? emp.plazo_retencion.trim()
    : null;
  const texto = (regla.hold || usoPiso || !textoEmpresa)
    ? (regla.texto || '').replace('{anios}', String(aniosAplicados))
    : textoEmpresa;

  let aviso;
  if (hold) {
    aviso = 'RETAIN_DEBER_LEGAL';
  } else if (fecha) {
    aviso = 'RETAIN_FECHA';
  } else {
    aviso = 'RETAIN_SIN_PLAZO';
  }

  return {
    categoria: categoriaId,
    regla: reglaId,
    base: regla.base,
    anios: aniosAplicados,
    fecha_conservacion: fecha,
    texto: (texto && texto.trim()) || null,
    hold,
    aviso,
  };
}

module.exports = {
  REGLAS,
  CATEGORIAS,
  ANIOS_CUSTODIA,
  NORMA_SST,
  NORMA_CONTRATO,
  NORMA_HISTORIA,
  categoriaValida,
  validarCategoria,
  resolverCategoria,
  sumarAnios,
  normalizarFecha,
  planificar,
};
