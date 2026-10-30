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
 *   - La TABLA SUPLETORIA DE CONSERVACIÓN (config/tabla-conservacion.json),
 *     administrada por K+AIR: es la fuente única del plazo POR DEFECTO. Si la
 *     Empresa no declara uno en su tabla de retención documental, el sistema
 *     aplica el de la categoría que corresponda en la tabla supletoria. Es la
 *     decisión del abogado (D1): "eliminar la retención indefinida... una
 *     tabla supletoria de conservación administrada por K+AIR, con plazos
 *     configurables por categoría".
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
 *     2-2017-01654 del Archivo General de la Nación ORIENTA el plazo de la
 *     historia laboral, pero no lo fija: el plazo lo declara la tabla de
 *     retención de la Empresa y, si la Empresa no declara, el del sistema.
 *
 * LA REGLA DEL SISTEMA: LA TABLA SUPLETORIA DE K+AIR
 * -----------------------------------------------
 * El Acuerdo v1.2 reescribió el 8.6(h) y el sistema lo volvió código: sin plazo
 * declarado, el registro quedaba RETENIDO con un hold por plazo no declarado.
 * Eso era mejor que inventar veinte años de custodia, pero dejaba al sistema
 * con una retención INDEFINIDA por una razón que no es legal: que la Empresa no
 * haya configurado su tabla.
 *
 * La decisión del abogado (D1) elimina esa retención indefinida. El plazo sale,
 * en este orden, de:
 *
 *   1. La tabla supletoria de conservación administrada por K+AIR, cuando la
 *      Empresa NO declara un plazo. Es la fuente ÚNICA del plazo por defecto y
 *      es CONFIGURABLE por categoría.
 *   2. La tabla de retención documental de la Empresa, cuando sí declara: ese
 *      plazo manda (es la fuente del 8.6(a)).
 *   3. El mínimo legal de la categoría, que ninguna tabla puede bajar: veinte
 *      (20) años desde el cese para los cinco grupos del SG-SST.
 *   4. El hold sin término del contrato electrónico.
 *
 * EL ORDEN DE PRECEDENCIA (el que aplica `planificar`)
 * -----------------------------------------------------
 *   (a) CONTRATO_SIN_TERMINO: la categoría tiene `hold_siempre`. Hold, sin
 *       fecha y sin plazo: el contrato se conserva sin término.
 *   (b) SST_ESPECIAL: la categoría tiene `piso_legal`. El mínimo legal
 *       (veinte años contados desde el cese; si el sistema no conoce el cese,
 *       desde la firma) se aplica, y la tabla de la Empresa NO puede bajarlo:
 *       si la Empresa declara un plazo, se aplica el MÁXIMO entre el suyo y el
 *       piso.
 *   (c) La Empresa declara un plazo: ese plazo manda (la fuente del 8.6(a)),
 *       contado desde el punto de inicio de la categoría.
 *   (d) La tabla supletoria: el plazo por defecto de la categoría, contado
 *       desde el punto de inicio de la categoría.
 *
 * NUNCA hay fecha nula por falta de plazo: con la tabla supletoria siempre hay
 * un plazo que aplicar. El aviso `RETAIN_SIN_PLAZO` queda como la última
 * defensa (para el caso en que ni la Empresa ni la tabla puedan dar un plazo) y
 * el hold por "plazo no declarado" ya NO se pone en el alta de una firma: queda
 * solo como la maquinaria de liberación de las filas que ya lo tienen en las
 * bases existentes.
 *
 * LO QUE CONGELA LA FILA
 * ----------------------
 * El plazo APLICADO, su FUENTE y la FECHA DE INICIO del cómputo quedan
 * congelados en cada firma (migración 049). Cambiar la tabla supletoria —o el
 * plazo de la Empresa— NO altera los registros ya calculados: un recálculo es
 * una operación EXPLÍCITA, AUTORIZADA y AUDITADA
 * (`conservacion.recalcularPlazosDeclarados`, que se llama desde
 * `empresa.update` con actor y motivo).
 *
 * HISTORIA DE ESTA REGLA
 * ----------------------
 * Hasta la v1.2 el sistema aplicaba por defecto 20 años de custodia contados
 * desde la firma (`ANIOS_CUSTODIA`), que venía del 8.6(h) viejo ("el plazo
 * mínimo necesario para la finalidad... Ese plazo es un MÁXIMO de custodia") y
 * de la respuesta 11A del abogado (23-oct-2026). La v1.2 eliminó ese "menú con
 * un mínimo" y en su lugar obligatoryó a que la Empresa declarara el plazo, con
 * el hold por plazo no declarado. La decisión D1 (30-oct-2026) cierra esa
 * etapa: el plazo por defecto sale de la tabla supletoria de K+AIR, con su
 * fundamento y su punto de inicio, y no de una custodia de reserva sin
 * identificar.
 *
 * LO QUE ESTE MÓDULO NO HACE
 * ---------------------------
 * No lee el PDF. La categoría se deriva del TIPO del documento, que es un
 * dato estructurado del propio sistema, o la declara el cliente en la API.
 * El sistema no puede adivinar el contenido de un documento antes del
 * consentimiento; la clasificación es una regla de código, no un juicio.
 *
 * El operador no elige el plazo ni la fecha de cese. El sistema clasifica el
 * documento por su tipo (que el sistema ya conoce) y aplica la regla. La
 * fecha de cese se usa solo si el sistema la conoce (p. ej. porque la ficha
 * del trabajador la trae); nunca se le pregunta a nadie.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const NORMA_SST = '2.2.4.6.13 del Decreto 1072 de 2015';
const NORMA_CONTRATO = '2.2.1.1.12 del Decreto 1072 de 2015';
const NORMA_HISTORIA = 'Corte Constitucional T-470/2019; Concepto AGN 2-2017-01654';
const NORMA_DEBER_LEGAL_EMPRESA = '2.2.1.1.12 del Decreto 1072 de 2015';

/**
 * La custodia documental del sistema, en años.
 *
 * HISTORIAL DE ESTA CONSTANTE
 *   - 80 años: la política interna original. Sobre-retención: conservar 80 años
 *     un documento sin deber legal de conservación es difícil de sostener
 *     frente al artículo 2.2.2.25.2.8 del Decreto 1074 de 2015.
 *   - 20 años: el plazo de reserva del 8.6(h) ("se aplica el mínimo legal que
 *     corresponda y, en su defecto, veinte (20) años contados desde la firma.
 *     Ese plazo es un máximo de custodia"). Exigido así por la respuesta 11A
 *     del abogado (23-oct-2026): "cambia una constante: ANIOS_CUSTODIA de 80 a
 *     20 (retencion.js)".
 *
 * DÓNDE ESTÁ HOY
 *   El plazo por DEFECTO ya no sale de esta constante: sale de la tabla
 *   supletoria de conservación (config/tabla-conservacion.json), que es la
 *   fuente única y la que el abogado.califica de administrada por K+AIR. La
 *   constante queda como el valor de las REGLAS del catálogo (el mínimo legal
 *   del SG-SST y el respaldo de los textos) y como el fallback del cálculo de
 *   años para un texto. NO es el plazo que se aplica a un documento sin plazo
 *   declarado: ese lo da la tabla supletoria.
 *
 * Lo que NO cambia con esta constante: el HOLD sin término del contrato
 * electrónico, el piso de 20 años desde el cese de los cinco grupos SST, y el
 * deber legal declarado por la Empresa.
 */
const ANIOS_CUSTODIA = 20;

/**
 * Lo que se le comunica al Trabajador cuando NO hay plazo aplicable (el 8.6(g)).
 *
 * El texto NO puede prometer un plazo que el sistema no tiene. Si la Empresa
 * no declaró un plazo, el documento se conserva y no se suprime mientras ella
 * no lo declare: eso es lo que se dice.
 *
 * DESPUÉS DE LA DECISIÓN D1
 * --------------------------
 * Con la tabla supletoria de conservación, SIEMPRE hay un plazo: la tabla
 * aporta el que corresponde a la categoría cuando la Empresa no declaró uno.
 * Este texto queda como la ÚLTIMA DEFENSA (si ni la Empresa ni la tabla
 * pudieron dar un plazo) y como el texto de las filas legacy que siguen
 * esperando un recálculo. En el camino normal no se alcanza: el texto que se
 * comunica es el del plazo APLICADO (ver `TEXTO_PLAZO_SISTEMA`).
 */
const TEXTO_PLAZO_PENDIENTE = 'El plazo de conservación aplicable está pendiente de declaración '
  + 'por la Empresa: mientras ella lo declare en su tabla de retención documental, con su '
  + 'fundamento y con el punto de inicio desde el que corre, este documento se conserva y no se '
  + 'suprime.';

/**
 * Lo que se le comunica al Trabajador cuando el plazo aplicado sale de la
 * TABLA SUPLETORIA de K+AIR (el 8.6(g)).
 *
 * Es el texto que se le comunica cuando la Empresa NO declaró un plazo y el
 * sistema aplica el de la tabla de conservación por defecto. Tiene que ser
 * HONESTO: no puede prometer un plazo que la Empresa no declaró, y no puede
 * callar que el plazo es del sistema. Por eso lo dice.
 *
 * Los marcadores: {anios} (los años redondeados del plazo aplicado), {dias} (el
 * plazo exacto, en días) y {inicio} (desde qué fecha corre).
 */
const TEXTO_PLAZO_SISTEMA = 'Se conserva {anios} años ({dias} días) contados desde {inicio}. '
  + 'Es el plazo de la tabla de conservación del sistema: se aplica porque la Empresa no ha '
  + 'declarado un plazo propio en su tabla de retención documental.';

/**
 * Cómo se nombra el punto de inicio del plazo del CATÁLOGO (la custodia de
 * veinte (20) años). El catálogo lo cuenta desde la firma, y el texto que ve
 * el Trabajador lo dice con esas palabras.
 *
 * No es lo mismo que `punto.nombre`, que es el punto de inicio que declara la
 * CATEGORÍA de la tabla supletoria: con la compuerta cerrada el plazo corre
 * desde la firma, porque el que cuenta es el catálogo.
 */
const NOMBRE_INICIO_FIRMA = 'la fecha de la firma';

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
  CUSTODIA_20_ANOS: Object.freeze({
    id: 'CUSTODIA_20_ANOS',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    piso: null,
    hold: false,
    norma: null,
    texto: 'Se conserva {anios} años contados desde {inicio}.',
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
    texto: 'Se conserva {anios} años contados desde {inicio}. El mínimo legal es de veinte '
      + '(20) años contados desde el cese de la relación laboral (artículo 2.2.4.6.13 del '
      + 'Decreto 1072 de 2015) y ninguna tabla puede bajarlo.',
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
    // Se suma al texto del sistema cuando el plazo aplicado sale de la tabla
    // supletoria: la orientación legal de esta categoría se comunica también
    // cuando el plazo es el del sistema y no el de la Empresa.
    notaSistema: 'El Concepto 2-2017-01654 del Archivo General de la Nación orienta el plazo '
      + 'de la historia laboral y la nómina sin fijarlo (Corte Constitucional T-470/2019).',
    texto: 'Se conserva {anios} años contados desde {inicio}. '
      + 'El Concepto 2-2017-01654 del Archivo General de la Nación orienta el plazo de la '
      + 'historia laboral y la nómina sin fijarlo (Corte Constitucional T-470/2019).',
  }),
  TABLA_EMPRESA: Object.freeze({
    id: 'TABLA_EMPRESA',
    base: 'creacion',
    anios: ANIOS_CUSTODIA,
    piso: null,
    hold: false,
    norma: null,
    texto: 'Se conserva {anios} años contados desde {inicio}.',
  }),
});

/**
 * Los ids de regla que el sistema usó antes y que todavía pueden estar
 * GUARDADOS en la fila (columna `regla_retencion`, migración 033).
 *
 * La migración 034 los actualiza, pero una base que no la corrió —o una fila
 * escrita por otra versión— no puede quedar reinterpretada: el id viejo se
 * traduce al nuevo y la fila dice la verdad. Sin este mapa, una fila con el id
 * viejo caería en el `TABLA_EMPRESA` por el fallback de `planificar()` y su
 * `regla_retencion` quedaría mintiendo.
 */
const REGLAS_LEGACY = Object.freeze({
  CUSTODIA_80_ANOS: 'CUSTODIA_20_ANOS',
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
 * LA TABLA SUPLETORIA DE CONSERVACIÓN
 * ===================================
 *
 * QUÉ ES
 * ------
 * `config/tabla-conservacion.json` es la fuente ÚNICA de la conservación por
 * defecto. La administra K+AIR y sus plazos son configurables por categoría.
 * De ella salen:
 *
 *   - el plazo que aplica el sistema cuando la Empresa NO declara uno;
 *   - el piso legal de las categorías que lo tienen (los grupos SG-SST);
 *   - la categoría de conservación de cada firma, que queda congelada en la
 *     fila (migración 049).
 *
 * El archivo es de SOLO LECTURA para el código: se lee, no se escribe.
 *
 * LA COMPUERTA DE ACTIVACIÓN
 * --------------------------
 * La tabla declara su propia activación (`aplicacion.activada`) y el código la
 * respeta. Con la compuerta CERRADA (que es como viene):
 *
 *   - el plazo por defecto de la tabla NO se aplica;
 *   - el sistema conserva el plazo de custodia del catálogo (veinte (20) años),
 *     que es el que estaba en vigor antes de que la tabla existiera;
 *   - las excepciones legales siguen aplicando: el piso del SG-SST y el hold
 *     del contrato sin término. No dependen de la tabla: son deberes.
 *
 * La razón es jurídica: los plazos de diez (10) y cinco (5) años de esta tabla
 * todavía no los validó el abogado, y el Acuerdo que los describe (la v1.3)
 * no está aprobado. Aplicarlos sin la validación sería aplicar un plazo que el
 * Acuerdo vigente no dice. Abrir la compuerta es un acto expreso del owner,
 * con la validación escrita del abogado: no lo hace el código ni una
 * actualización automática.
 *
 * CÓMO SE LEE
 * -----------
 * Se lee del disco y se cachea con la clave (mtime + tamaño): si el archivo
 * cambia, la siguiente lectura lo vuelve a tomar. `recargarTablaConservacion()`
 * fuerza la relectura. El caché es solo una optimización: la tabla es un
 * archivo de configuración chico y leerlo una vez por firma no cuesta nada.
 *
 * SI EL ARCHIVO NO SE PUEDE LEER
 * -----------------------------
 * Se registra un ERROR y se usa el respaldo interno (`_TABLA_RESPALDO`), que
 * es la tabla entregada congelada en el código. No es una segunda fuente: es la
 * red que evita que un archivo de configuración faltante tumbe el alta de todas
 * las firmas. El respaldo se avisa en el log, no se esconde.
 */
const TABLA_CONSERVACION_PATH = path.join(
  __dirname, '..', '..', 'config', 'tabla-conservacion.json'
);

// La tabla entregada, congelada en el código. Solo se usa si el archivo no se
// puede leer (ver la cabecera de esta sección).
const _TABLA_RESPALDO = Object.freeze({
  version: 'respaldo-en-codigo',
  // El respaldo tambien arranca con la compuerta CERRADA: si el archivo de
  // configuracion falta o no se puede leer, el sistema conserva el plazo de
  // custodia del catalogo (veinte (20) anos), que es el que estaba en vigor.
  // Un respaldo con la compuerta abierta aplicaria los plazos de la tabla
  // supletoria por la sola falla de leer el archivo.
  aplicacion: Object.freeze({
    activada: false,
    estado: 'PROPUESTA',
    validado_por: null,
    validado_at: null,
  }),
  categorias: [
    { id: 'DOCUMENTO_FIRMADO', plazo_dias: 3650, punto_inicio: 'fecha_firma', piso_legal: false, hold_siempre: false },
    { id: 'SST_ESPECIAL', plazo_dias: 7305, punto_inicio: 'fecha_cese', piso_legal: true, hold_siempre: false },
    { id: 'CONTRATO_SIN_TERMINO', plazo_dias: null, punto_inicio: null, piso_legal: false, hold_siempre: true },
  ],
  mapeo_codigo: {
    SST_PERFIL_Y_CONCEPTOS_MEDICOS: 'SST_ESPECIAL',
    SST_EXAMENES_ESPECIALIZADOS: 'SST_ESPECIAL',
    SST_MONITOREO_AMBIENTAL: 'SST_ESPECIAL',
    SST_CAPACITACION: 'SST_ESPECIAL',
    SST_EPP: 'SST_ESPECIAL',
    CONTRATO_TRABAJO: 'CONTRATO_SIN_TERMINO',
    HISTORIA_LABORAL: 'DOCUMENTO_FIRMADO',
    ASPIRANTE: 'DOCUMENTO_FIRMADO',
    TABLA_EMPRESA: 'DOCUMENTO_FIRMADO',
  },
});

let _tablaCache = null;
let _tablaCacheClave = null;

/**
 * La tabla supletoria de conservación, tal como está en el archivo.
 *
 * @param {object} [opts]
 * @param {object} [opts.tabla] - una tabla concreta, en vez de la del archivo.
 *   Es el punto de inyección que usan los tests para simular un cambio de la
 *   tabla sin tocar el archivo de configuración.
 * @returns {object} la tabla (con `categorias` y `mapeo_codigo`)
 */
function tablaConservacion(opts = {}) {
  if (opts && opts.tabla) return opts.tabla;

  try {
    const stat = fs.statSync(TABLA_CONSERVACION_PATH);
    const clave = `${stat.mtimeMs}:${stat.size}`;
    if (_tablaCache && _tablaCacheClave === clave) return _tablaCache;
    const tabla = JSON.parse(fs.readFileSync(TABLA_CONSERVACION_PATH, 'utf8'));
    _tablaCache = tabla;
    _tablaCacheClave = clave;
    return tabla;
  } catch (e) {
    // Un archivo de configuración faltante o ilegible NO puede tumbar el alta
    // de las firmas: se usa el respaldo y se deja rastro.
    logger.error('Retencion: no se pudo leer la tabla supletoria de conservacion', {
      ruta: TABLA_CONSERVACION_PATH,
      error: e.message,
      aviso: 'TABLA_CONSERVACION_NO_DISPONIBLE',
    });
    return _TABLA_RESPALDO;
  }
}

/**
 * Fuerza la relectura de la tabla supletoria del disco.
 * @returns {object} la tabla recien leida
 */
function recargarTablaConservacion() {
  _tablaCache = null;
  _tablaCacheClave = null;
  return tablaConservacion();
}

/**
 * Si la tabla supletoria tiene la COMPUERTA ABIERTA (su plazo por defecto
 * aplica) o cerrada (no aplica).
 *
 * @param {object} [opts]
 * @param {object} [opts.tabla] - una tabla concreta, en vez de la del archivo.
 * @returns {boolean}
 */
function tablaActivada(opts = {}) {
  return _tablaActivada(tablaConservacion(opts));
}

/**
 * ¿Está ACTIVADA la tabla supletoria de conservación?
 *
 * LA COMPUERTA
 * ------------
 * La tabla declara su propia activación (`aplicacion.activada`). El código no
 * la deduce ni la deduce por defecto: la lee.
 *
 * Por qué existe: la tabla administra plazos que el abogado todavía no validó
 * (los de diez (10) y cinco (5) años), y el Acuerdo que describe este
 * mecanismo (la v1.3) no está aprobado. Mientras la compuerta está cerrada:
 *
 *   - el plazo por defecto de la tabla NO se aplica;
 *   - el sistema conserva el plazo de custodia del catálogo (veinte (20) años),
 *     que es el que estaba en vigor antes de que la tabla existiera;
 *   - las EXCEPCIONES LEGALES siguen applying: el piso del SG-SST y el hold del
 *     contrato sin término. No dependen de la tabla: son deberes.
 *
 * Con la compuerta abierta, el plazo por defecto de la categoría entra a
 * aplicar, con su fuente y su punto de inicio, y la trazabilidad (migración
 * 049) lo deja registrado en la fila.
 *
 * La compuerta es un dato de la fuente legal, no una variable de entorno: lo
 * que decide cuándo se aplica un plazo es el documento que la administra, y
 * ese documento se versiona y se puede auditar.
 *
 * @param {object|null} tabla - la tabla supletoria
 * @returns {boolean}
 */
function _tablaActivada(tabla) {
  const aplicacion = tabla && typeof tabla.aplicacion === 'object' ? tabla.aplicacion : null;
  return Boolean(aplicacion && aplicacion.activada === true);
}

/**
 * La categoría de la tabla supletoria que le corresponde a una categoría del
 * catálogo.
 *
 * El mapeo vive en la tabla (`mapeo_codigo`), no en el código: cambiar la
 * tabla cambia el mapeo. Una categoría que no está mapeada cae en
 * DOCUMENTO_FIRMADO (el documento original y firmado), que es la categoría
 * base de la tabla.
 *
 * @param {string|null} categoriaId - la categoría del catálogo
 * @param {object} tabla - la tabla supletoria
 * @returns {{id: string, def: object|null}}
 */
function _categoriaConservacion(categoriaId, tabla) {
  const mapeo = (tabla && typeof tabla.mapeo_codigo === 'object' && tabla.mapeo_codigo) || {};
  const categorias = (tabla && Array.isArray(tabla.categorias)) ? tabla.categorias : [];
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const mapeado = categoriaId ? mapeo[categoriaId] : null;
  const id = (mapeado && porId.has(mapeado)) ? mapeado : 'DOCUMENTO_FIRMADO';
  return { id, def: porId.get(id) || null };
}

/**
 * La fecha desde la que CORRE el plazo de una categoría.
 *
 * La tabla declara el punto de inicio de cada categoría (`punto_inicio`):
 *
 *   fecha_firma → la fecha de la firma.
 *   fecha_cese  → la fecha del cese de la relación laboral; si el sistema no la
 *                  conoce, la fecha de la firma, que siempre es calculable.
 *
 * El resto de puntos de inicio de la tabla (fecha_registro, fecha_solicitud,
 * fecha_supresion, fecha_respaldo) son de otros subsistemas (registro de
 * operaciones, solicitudes, lápidas y respaldos), no del catálogo de
 * retención de firmas: acá no aplican y se caen a la firma.
 *
 * Devuelve la fecha Y cómo se nombra en el texto que ve el Trabajador: el
 * texto dice de dónde corrió el plazo, y no puede decir "desde la firma" si el
 * plazo corrió desde el cese.
 *
 * @param {object|null} def - la categoría de la tabla
 * @param {string} fecha_creacion
 * @param {string} fecha_terminacion
 * @returns {{fecha: string|null, nombre: string}}
 */
function _puntoInicio(def, fecha_creacion, fecha_terminacion) {
  const tipo = (def && typeof def.punto_inicio === 'string') ? def.punto_inicio : 'fecha_firma';
  if (tipo === 'fecha_cese') {
    const cese = normalizarFecha(fecha_terminacion);
    if (cese) return { fecha: cese, nombre: 'la fecha del cese de la relación laboral' };
  }
  return { fecha: normalizarFecha(fecha_creacion), nombre: 'la fecha de la firma' };
}

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

/**
 * El mínimo legal de una categoría.
 *
 * Lo declaran los dos lados, y tienen que concordar:
 *
 *   - la TABLA SUPLETORIA: la categoría tiene `piso_legal` y su plazo en días
 *     (SST_ESPECIAL: 7305 días, que son veinte años);
 *   - el CATÁLOGO: la regla tiene `piso` con los años (la unidad de la ley:
 *     "veinte (20) años contados desde el cese").
 *
 * El mínimo legal del SG-SST está en los dos, y no puede haber un piso sin
 * sus años: si la tabla cambia el mapeo de una categoría, el piso viaja con
 * ella.
 *
 * OJO CON LA UNIDAD
 * -----------------
 * La FECHA del piso se calcula en años de calendario (veinte años desde el
 * cese), que es como está redactada la norma; los días son la expresión de
 * ese plazo en la tabla y lo que se congela en la fila. Coinciden salvo en el
 * día del cambio de año bisiesto: la fila guarda la regla (7305 días), no una
 * cuenta que se puede rehacer.
 *
 * @param {object} regla - la regla del catálogo
 * @param {object|null} def - la categoría de la tabla
 * @returns {{anios: number|null, dias: number|null}|null}
 */
function _pisoDeLaCategoria(regla, def) {
  const porRegla = Boolean(regla && regla.piso);
  const porTabla = Boolean(def && def.piso_legal);
  if (!porRegla && !porTabla) return null;

  const anios = (regla && regla.piso && Number(regla.piso.anios)) || null;
  const diasTabla = Number(def && def.plazo_dias);
  const dias = (Number.isInteger(diasTabla) && diasTabla > 0)
    ? diasTabla
    : (anios ? Math.round(anios * 365.25) : null);

  return { anios, dias };
}

/**
 * Los años que se comunican al Trabajador.
 *
 * Son los años que CORRIÓ el plazo, contados desde SU punto de inicio (no
 * desde la firma): con un cese conocido, el piso de veinte años del SG-SST
 * corre desde el cese, y decir "veinte años desde la firma" sería falso.
 *
 * @param {string|null} fecha - la fecha de conservación calculada
 * @param {string|null} inicio - el punto de inicio del cómputo
 * @param {number|null} diasAplicados - el plazo aplicado, en días
 * @param {object} regla - la regla del catálogo
 * @returns {number|null}
 */
function _aniosAplicados(fecha, inicio, diasAplicados, regla) {
  if (fecha && inicio) {
    const diff = (new Date(fecha).getTime() - new Date(inicio).getTime())
      / (365.25 * MS_POR_DIA);
    if (Number.isFinite(diff)) return Math.max(1, Math.round(diff));
  }
  if (diasAplicados) return _aniosDeDias(diasAplicados);
  return (regla && regla.anios) || null;
}

/**
 * El texto de la regla, con los marcadores resueltos.
 *
 * @param {object} regla - la regla del catálogo
 * @param {number|null} anios - los años aplicados
 * @param {string} nombreInicio - cómo se nombra el punto de inicio
 * @returns {string}
 */
function _textoRegla(regla, anios, nombreInicio) {
  return (regla.texto || '')
    .replace('{anios}', String(anios))
    .replace('{inicio}', nombreInicio);
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
 * No escribe en la base: el llamador (signRequest.create o
 * conservacion.aplicarPlanRetencion) aplica el plan después de insertar la
 * fila. Lo único que lee es la tabla supletoria de conservación (un archivo de
 * configuración), y esa lectura se puede sustituir por parámetro
 * (`tabla_conservacion`) para poder probarla sin tocar el archivo.
 *
 * LO QUE DEVUELVE, ADEMÁS DE LA FECHA
 * ------------------------------------
 * La trazabilidad de la regla que se aplicó (migración 049): el plazo, su
 * fuente y la fecha de inicio del cómputo. Con eso, el §4 se puede demostrar
 * documento por documento: qué regla corrió y de dónde salió.
 *
 * @param {object} opts
 * @param {string} [opts.categoria_retencion]
 * @param {string} [opts.regla_retencion]
 * @param {string} [opts.fecha_creacion]
 * @param {string} [opts.fecha_terminacion] - Cese o retiro, si el sistema lo
 *   conoce. Nunca se le pide a nadie: si no está, el plazo corre desde la
 *   firma.
 * @param {object} [opts.empresa] - fila de gh_firma_empresas (con
 *   plazo_retencion, plazo_retencion_dias, conservacion_por_deber_legal y
 *   norma_conservacion).
 * @param {object} [opts.tabla_conservacion] - la tabla supletoria a usar, en
 *   vez de la del archivo. Es el punto de inyección que usan los tests.
 * @returns {{
 *   categoria: string|null,
 *   regla: string,
 *   base: string|null,
 *   anios: number|null,
 *   fecha_conservacion: string|null,
 *   texto: string|null,
 *   hold: object|null,
 *   aviso: string,
 *   categoria_conservacion: string,
 *   plazo_conservacion_dias: number|null,
 *   plazo_conservacion_fuente: string|null,
 *   fecha_inicio_conservacion: string|null
 * }}
 */
function planificar({
  categoria_retencion,
  regla_retencion,
  fecha_creacion,
  fecha_terminacion,
  empresa,
  tabla_conservacion,
} = {}) {
  const categoriaId = categoriaValida(categoria_retencion)
    ? categoria_retencion
    : null;
  const categoria = categoriaId ? POR_ID.get(categoriaId) : null;
  // El id puede venir legacy (guardado antes de la migración 034): se traduce
  // al id vigente ANTES de buscar la regla, para que la fila guarde la verdad
  // y no quede reinterpretada por el fallback de abajo.
  const reglaPedida = REGLAS_LEGACY[regla_retencion] || regla_retencion;
  const reglaId = reglaPedida && REGLAS[reglaPedida]
    ? reglaPedida
    : (categoria ? categoria.regla : 'TABLA_EMPRESA');
  const regla = REGLAS[reglaId];
  const emp = empresa || {};

  // La categoría de la tabla supletoria que le corresponde a esta firma. El
  // mapeo vive en la tabla, no en el código.
  const tabla = tablaConservacion({ tabla: tabla_conservacion });
  const tablaActiva = _tablaActivada(tabla);
  const catCons = _categoriaConservacion(categoriaId, tabla);
  const defCat = catCons.def;

  // El plazo declarado por la Empresa (la fuente del 8.6(a)).
  const diasEmpresa = Number(emp.plazo_retencion_dias);
  const empresaDeclara = Number.isInteger(diasEmpresa) && diasEmpresa > 0;

  // El punto de inicio del cómputo: el que declara la categoría en la tabla.
  const punto = _puntoInicio(defCat, fecha_creacion, fecha_terminacion);
  const inicio = punto.fecha;
  // El punto de inicio REALMENTE aplicado. Es el mismo que `inicio` en todos
  // los caminos salvo en el de la compuerta cerrada, donde el plazo corre
  // desde la firma (que es lo que hace el catálogo).
  let inicioAplicado = inicio;

  // ── (a) El hold sin término ─────────────────────────────────────────────
  //
  // CONTRATO_SIN_TERMINO: la categoría de la tabla tiene `hold_siempre`. No
  // hay plazo y no hay fecha: el contrato se conserva sin término.
  const holdSiempre = Boolean((defCat && defCat.hold_siempre) || regla.hold);

  // El mínimo legal de la categoría (el piso), si lo tiene.
  const piso = _pisoDeLaCategoria(regla, defCat);

  // ── El plazo que aplica y su fuente ─────────────────────────────────────
  //
  //   (b) PISO LEGAL         · la categoría tiene piso legal (los grupos SST).
  //   (c) PLAZO DE LA EMPRESA · la Empresa declaró un plazo (la fuente del
  //                            8.6(a)).
  //   (d) TABLA SUPLETORIA   · el plazo por defecto de la categoría.
  //
  // Nunca hay fecha nula por falta de plazo: con la tabla supletoria siempre
  // hay un plazo que aplicar.
  let fecha = null;
  let diasAplicados = null;
  let fuente = null;

  if (!holdSiempre) {
    if (piso) {
      // (b) EL PISO LEGAL (los grupos SG-SST del 2.2.4.6.13): veinte años
      // contados desde el cese. La tabla de la Empresa NO lo baja: si declara
      // un plazo, se aplica el MÁXIMO entre el suyo y el piso, y el plazo se
      // queda con la fecha más lejana.
      const fechaPiso = piso.anios
        ? sumarAnios(inicio, piso.anios)
        : _sumarDias(inicio, piso.dias);
      const fechaEmpresa = empresaDeclara ? _sumarDias(inicio, diasEmpresa) : null;
      fecha = _fechaMasLejana(fechaPiso, fechaEmpresa);
      if (fecha && fechaPiso && fecha === fechaPiso) {
        fuente = 'piso_legal';
        diasAplicados = piso.dias;
      } else if (fecha) {
        fuente = 'empresa';
        diasAplicados = diasEmpresa;
      }
    } else if (empresaDeclara) {
      // (c) EL PLAZO DE LA EMPRESA: manda (es la fuente del 8.6(a)) y corre
      // desde el punto de inicio de la categoría.
      fecha = _sumarDias(inicio, diasEmpresa);
      diasAplicados = diasEmpresa;
      fuente = 'empresa';
    } else if (tablaActiva) {
      // (d) LA TABLA SUPLETORIA: el plazo por defecto de la categoría. Se
      // aplica porque la Empresa no declaró uno, y por eso el texto que se le
      // comunica al Trabajador lo dice de forma honesta (TEXTO_PLAZO_SISTEMA).
      const diasTabla = Number(defCat && defCat.plazo_dias);
      if (Number.isInteger(diasTabla) && diasTabla > 0) {
        fecha = _sumarDias(inicio, diasTabla);
        diasAplicados = diasTabla;
        fuente = 'tabla_supletoria';
      }
      // Si la categoría de la tabla no trae un plazo computable, la fecha
      // queda nula: es la última defensa (aviso RETAIN_SIN_PLAZO) y NO es el
      // camino normal.
    } else {
      // (d-bis) LA COMPUERTA CERRADA: el plazo por defecto NO es el de la
      // tabla, sino el del catálogo: la custodia de veinte (20) años, que es
      // lo que el sistema aplicaba antes de que la tabla existiera y lo que
      // el Acuerdo vigente describe.
      //
      // La tabla no se descarta: la categoría y su punto de inicio se siguen
      // registrando, y el día que la compuerta se abra, las filas ya
      // calculadas quedan congeladas con el plazo que se les aplicó
      // (migración 049). Lo que cambia con la compuerta cerrada es de dónde
      // sale el plazo, y queda dicho en la fila: la fuente es
      // 'catalogo_sistema'.
      const aniosCatalogo = Number(regla.anios) || ANIOS_CUSTODIA;
      if (regla.base === 'creacion') {
        fecha = sumarAnios(fecha_creacion, aniosCatalogo);
        inicioAplicado = normalizarFecha(fecha_creacion);
      } else {
        const termino = normalizarFecha(fecha_terminacion);
        fecha = termino ? sumarAnios(termino, aniosCatalogo) : null;
        inicioAplicado = termino;
      }
      if (fecha) {
        diasAplicados = Math.round(aniosCatalogo * 365.25);
        fuente = 'catalogo_sistema';
      }
    }
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
  } else if (holdSiempre) {
    hold = {
      actor: 'sistema',
      motivo: 'deber_legal_' + (regla.norma || NORMA_CONTRATO),
      alcance: regla.norma || NORMA_CONTRATO,
    };
  }

  // Con hold no hay fecha de supresión: la fecha calculada deja de ser una
  // fecha de supresión y es solo un piso informativo. El plazo, su fuente y su
  // punto de inicio SÍ se conservan: son la regla que se aplicó, y un hold no
  // borra la trazabilidad.
  if (hold) fecha = null;

  // ── El texto que se comunica al Trabajador ─────────────────────────────
  //
  // El texto dice el plazo APLICADO (el que la fila va a guardar):
  //   - el texto que declaró la Empresa, cuando el plazo aplicado es el suyo
  //     (es su tabla de retención y su redacción);
  //   - el texto de la regla, cuando el plazo lo puso el piso legal;
  //   - el texto del sistema, cuando el plazo salió de la tabla supletoria:
  //     ahí se dice, de forma honesta, que el plazo es del sistema porque la
  //     Empresa no declaró uno;
  //   - el texto de la regla, cuando el plazo salió del catálogo porque la
  //     compuerta de la tabla supletoria está cerrada: el plazo es el de
  //     custodia del sistema, y su texto es el de la regla.
  const aniosAplicados = _aniosAplicados(fecha, inicioAplicado, diasAplicados, regla);
  const textoEmpresa = (typeof emp.plazo_retencion === 'string' && emp.plazo_retencion.trim())
    ? emp.plazo_retencion.trim()
    : null;

  let texto;
  if (!fecha && !hold) {
    // Última defensa: ni la Empresa ni la tabla pudieron dar un plazo.
    texto = TEXTO_PLAZO_PENDIENTE;
  } else if (holdSiempre) {
    // El contrato: se conserva sin término, con su fundamento.
    texto = _textoRegla(regla, aniosAplicados, punto.nombre);
  } else if (fuente === 'tabla_supletoria') {
    texto = TEXTO_PLAZO_SISTEMA
      .replace('{anios}', String(aniosAplicados))
      .replace('{dias}', String(diasAplicados))
      .replace('{inicio}', punto.nombre)
      + (regla.notaSistema ? ' ' + regla.notaSistema : '');
  } else if (fuente === 'catalogo_sistema') {
    // La compuerta cerrada: el plazo es el de custodia del catálogo, y corre
    // desde la firma (que es de donde lo cuenta el catálogo).
    texto = _textoRegla(regla, aniosAplicados, NOMBRE_INICIO_FIRMA)
      + (regla.notaSistema ? ' ' + regla.notaSistema : '');
  } else if (fuente === 'empresa' && textoEmpresa) {
    texto = textoEmpresa;
  } else {
    texto = _textoRegla(regla, aniosAplicados, punto.nombre);
  }

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
    // 049 · LA TRAZABILIDAD DE LA REGLA APLICADA. Con hold sin plazo (el
    // contrato) el plazo, su fuente y su punto de inicio son NULL: no hay
    // plazo que registrar.
    categoria_conservacion: catCons.id,
    plazo_conservacion_dias: diasAplicados,
    plazo_conservacion_fuente: fuente,
    fecha_inicio_conservacion: diasAplicados === null ? null : inicioAplicado,
  };
}

module.exports = {
  REGLAS,
  REGLAS_LEGACY,
  CATEGORIAS,
  ANIOS_CUSTODIA,
  TEXTO_PLAZO_PENDIENTE,
  TEXTO_PLAZO_SISTEMA,
  NOMBRE_INICIO_FIRMA,
  NORMA_SST,
  NORMA_CONTRATO,
  NORMA_HISTORIA,
  TABLA_CONSERVACION_PATH,
  TABLA_RESPALDO: _TABLA_RESPALDO,
  categoriaValida,
  validarCategoria,
  resolverCategoria,
  sumarAnios,
  normalizarFecha,
  tablaConservacion,
  recargarTablaConservacion,
  tablaActivada,
  planificar,
};
