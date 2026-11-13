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
 * LAS CUATRO CONDICIONES DE LA VALIDACIÓN (C1 a C4, 12-nov-2026)
 * --------------------------------------------------------------
 * El dictamen legal del 12-nov-2026 (L3) propone cuatro condiciones que la
 * validación del abogado externo tiene que cubrir. Cada una está en el código,
 * en un solo lugar, y tiene su prueba:
 *
 *   C1  el plazo del REGISTRO DE OPERACIONES sigue al del documento asociado
 *       cuando este tiene piso legal o hold sin término
 *       (`plazoRegistroOperaciones`).
 *   C2  el CÓMPUTO de los plazos por defecto es en AÑOS CALENDARIO, y el texto
 *       al Trabajador lo dice sin afirmar una equivalencia falsa en días
 *       (`TEXTO_PLAZO_SISTEMA_ANIOS`).
 *   C3  el PISO LEGAL no puede ser bajado: se aplica la fecha más lejana
 *       (`_fechaMasLejana`), y los años del piso son el mayor entre el catálogo
 *       y la tabla (`_pisoDeLaCategoria`).
 *   C4  la fecha de CESE la informa y valida la Empresa por escrito; la fecha
 *       de la firma no la sustituye (`_puntoInicio`).
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
 * Los marcadores: {anios} (los años del plazo aplicado), {dias} (el plazo
 * exacto, en días) y {inicio} (desde qué fecha corre).
 *
 * LAS DOS FORMAS DEL TEXTO (C2, 12-nov-2026)
 * ------------------------------------------
 * El texto NO puede decir dos verdades. El plazo de la tabla se computa en
 * AÑOS CALENDARIO (es como lo redacta la norma y como lo dice el texto), así
 * que el texto de los plazos en años NO puede añadir una equivalencia en
 * días: "10 años (3650 días)" era falso, porque 3650 días son dos o tres días
 * menos que diez años calendario. Por eso hay dos plantillas y el código
 * elige la que corresponde al cómputo que hizo:
 *
 *   - `TEXTO_PLAZO_SISTEMA_ANIOS`: el plazo se computó en años calendario.
 *     Dice los años y dice que el cómputo es en años calendario.
 *   - `TEXTO_PLAZO_SISTEMA`: el plazo se computó en días (una categoría
 *     cuya duración está en días). Dice los días.
 */
const TEXTO_PLAZO_SISTEMA = 'Se conserva durante {dias} días contados desde {inicio}. '
  + 'Es el plazo de la tabla de conservación del sistema: se aplica porque la Empresa no ha '
  + 'declarado un plazo propio en su tabla de retención documental.';

/** El mismo texto, para los plazos que se computan en años calendario (C2). */
const TEXTO_PLAZO_SISTEMA_ANIOS = 'Se conserva durante {anios} años contados desde {inicio} '
  + '(el plazo se computa en años calendario). '
  + 'Es el plazo de la tabla de conservación del sistema: se aplica porque la Empresa no ha '
  + 'declarado un plazo propio en su tabla de retención documental.';

/**
 * Cómo se nombra la punto de inicio "la fecha de la firma".
 *
 * OJO: el catálogo legado de veinte (20) años desde la firma se RETIRO el
 * 30-oct-2026 (J8 y J9 del abogado: "la fecha de la firma NO sustituye la fecha
 * de cese" y "la tabla no puede activar los plazos por defecto mientras el
 * sistema conserve el catálogo legado de 20 años desde la firma"). La
 * constante queda porque es parte de la API del módulo y porque el nombre del
 * punto de inicio "la fecha de la firma" sigue siendo el de las categorías que
 * lo declaran así, pero YA NO es el punto de inicio de un plazo del catálogo.
 *
 * No es lo mismo que `punto.nombre`, que es el punto de inicio que declara la
 * CATEGORÍA de la tabla supletoria.
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
 *   - una Empresa que NO declara plazo NO recibe el plazo legado de veinte
 *     (20) años desde la firma: ese catálogo se retiró. Lo que recibe es un
 *     HOLD (`tabla_supletoria_pendiente_validacion`), sin fecha de supresión
 *     calculada, hasta que la tabla esté validada y la compuerta se abra;
 *   - las excepciones legales siguen aplicando: el piso del SG-SST y el hold
 *     del contrato sin término. No dependen de la tabla: son deberes.
 *
 * ESTO ES LO QUE ORDENÓ EL ABOGADO (30-oct-2026, J8 y J9): "la tabla no
 * puede activar los plazos por defecto mientras el sistema conserve el
 * catálogo legado de 20 años desde la firma [...] Orden correcto: (i)
 * validar los plazos; (ii) alinear el catálogo legado al orden de
 * precedencia del 8.6(a) [...] (iii) reejecutar pruebas; (iv) recién entonces
 * abrir la compuerta, con validación escrita." Y sobre la fecha de cese:
 * "la fecha de la firma NO sustituye la fecha de cese; el registro queda
 * pendiente y sin fecha de supresión calculada".
 *
 * La razón es jurídica: los plazos de diez (10) y cinco (5) años de esta tabla
 * todavía no los validó el abogado, y el Acuerdo que los describe (la v1.4)
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
  // configuracion falta o no se puede leer, no se aplican los plazos de la
  // tabla supletoria ni se calcula fecha de supresion: el registro queda
  // retenido con el hold tabla_supletoria_pendiente_validacion.
  // Un respaldo con la compuerta abierta aplicaria los plazos de la tabla
  // supletoria por la sola falla de leer el archivo.
  aplicacion: Object.freeze({
    activada: false,
    estado: 'PROPUESTA',
    validado_por: null,
    validado_at: null,
  }),
  categorias: [
    // El respaldo declara tambien `plazo_anos` (C2, 12-nov-2026): el cómputo
    // es en años calendario, igual que en el archivo de configuración. Los
    // días siguen siendo la expresión nominal del plazo.
    { id: 'DOCUMENTO_FIRMADO', plazo_anos: 10, plazo_dias: 3650, punto_inicio: 'fecha_firma', piso_legal: false, hold_siempre: false },
    { id: 'SST_ESPECIAL', plazo_anos: 20, plazo_dias: 7305, punto_inicio: 'fecha_cese', piso_legal: true, hold_siempre: false },
    { id: 'CONTRATO_SIN_TERMINO', plazo_anos: null, plazo_dias: null, punto_inicio: null, piso_legal: false, hold_siempre: true },
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
 * mecanismo (la v1.4) no está aprobado. Mientras la compuerta está cerrada:
 *
 *   - el plazo por defecto de la tabla NO se aplica;
 *   - una Empresa que NO declara plazo NO recibe el plazo legado del catálogo
 *     (veinte (20) años desde la firma): ese catálogo se retiró por orden del
 *     abogado (30-oct-2026, J8 y J9). Lo que queda es un HOLD
 *     (`tabla_supletoria_pendiente_validacion`), sin fecha de supresión;
 *   - las EXCEPCIONES LEGALES siguen aplicando: el piso del SG-SST y el hold del
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
 * LO QUE SE EXIGE ADEMAS DE `activada` (12-nov-2026)
 * ---------------------------------------------------
 * Antes, cambiar `activada` a `true` bastaba para aplicar los plazos de diez
 * (10) y cinco (5) años: el archivo declara su propia activacion y el codigo
 * la leia, sin preguntar quien la habia validado. Eso dejaba la compuerta
 * como un acto de disciplina humana, y no como un acto que la maquina pueda
 * auditar: `validado_por` y `validado_at` estaban en el archivo y NO los leia
 * ningun codigo.
 *
 * La tabla dice que abrirla es un acto del owner *con la validacion escrita
 * del abogado*. Ahora el codigo es fiel a esa frase: sin `validado_por` y
 * `validado_at` la compuerta NO se abre, por mucho que `activada` diga que si.
 * Es una linea, y evita el falso verde: un archivo con `activada: true` y sin
 * validacion aplica el retencion por defecto de categorias que nadie ha
 * validado.
 *
 * Y ADEMAS, EL MARCADOR DE PENDIENTE NO CUENTA COMO VALIDACION (12-nov-2026).
 * ---------------------------------------------------------------------
 * La tabla que se despacha trae `validado_por` con un MARCADOR legible
 * ("PENDIENTE: lo llena el abogado externo..."), para que quede a la vista que
 * la validacion falta, y `validado_at` en null. Un texto de esos no es una
 * validacion: es la ausencia de ella escrita. Si el owner abriera la compuerta
 * sin reemplazar el marcador, el codigo tendria que seguir tratandola como
 * cerrada: por eso el marcador se rechaza por nombre y no solo por estar
 * vacio.
 *
 * @param {object|null} tabla - la tabla supletoria
 * @returns {boolean}
 */
function _tablaActivada(tabla) {
  const aplicacion = tabla && typeof tabla.aplicacion === 'object' ? tabla.aplicacion : null;
  if (!aplicacion || aplicacion.activada !== true) return false;
  const validadoPor = typeof aplicacion.validado_por === 'string' ? aplicacion.validado_por.trim() : '';
  const validadoAt = typeof aplicacion.validado_at === 'string' ? aplicacion.validado_at.trim() : '';
  if (validadoPor === '' || validadoAt === '') return false;
  // El marcador de "lo falta el abogado externo" no es una validacion: es la
  // ausencia de ella escrita. La compuerta sigue cerrada.
  if (/^PENDIENTE\b/i.test(validadoPor)) return false;
  return true;
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
 *   fecha_cese  → exclusivamente la fecha real del cese. Si falta, el cómputo
 *                  queda pendiente; nunca se sustituye por la fecha de firma.
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
    return { fecha: null, nombre: 'la fecha real del cese de la relación laboral (pendiente de informar)' };
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
 * C3 · EL PISO NO SE BAJA (12-nov-2026)
 * -------------------------------------
 * Los años del piso los declaran DOS lados: el catálogo (la norma, en
 * `regla.piso.anios`) y la tabla (en `plazo_anos`). Se aplica el MAYOR de los
 * dos: el piso es un piso, y ni la tabla de la Empresa ni esta tabla pueden
 * bajarlo. Lo que NO puede pasar es lo contrario: si la tabla declarara menos
 * años que la norma, el piso sigue siendo el de la norma.
 *
 * @param {object} regla - la regla del catálogo
 * @param {object|null} def - la categoría de la tabla
 * @returns {{anios: number|null, dias: number|null}|null}
 */
function _pisoDeLaCategoria(regla, def) {
  const porRegla = Boolean(regla && regla.piso);
  const porTabla = Boolean(def && def.piso_legal);
  if (!porRegla && !porTabla) return null;

  const aniosRegla = (regla && regla.piso && Number(regla.piso.anios)) || null;
  const aniosDeclarados = def ? Number(def.plazo_anos) : null;
  const aniosTabla = (Number.isInteger(aniosDeclarados) && aniosDeclarados > 0)
    ? aniosDeclarados
    : null;
  const anios = (aniosRegla && aniosTabla)
    ? Math.max(aniosRegla, aniosTabla)
    : (aniosRegla || aniosTabla);

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
 * La categoría de la tabla supletoria con ese id (o null).
 *
 * @param {object|null} tabla - la tabla supletoria
 * @param {string} id - el id de la categoría
 * @returns {object|null}
 */
function _categoriaPorId(tabla, id) {
  const categorias = (tabla && Array.isArray(tabla.categorias)) ? tabla.categorias : [];
  const encontrada = categorias.find((c) => c && c.id === id);
  return encontrada || null;
}

/**
 * C1 · EL PLAZO DEL REGISTRO DE OPERACIONES SIGUE AL DOCUMENTO ASOCIADO.
 *
 * QUÉ ES EL REGISTRO DE OPERACIONES
 * ---------------------------------
 * Los eventos de la firma (`gh_firma_eventos`): los que dicen QUIÉN firmó,
 * con qué medio y desde dónde. Son el MEDIO DE PRUEBA de la autenticidad del
 * documento conservado, y por eso no pueden morir antes que el documento que
 * acreditan: un documento conservado sin el asiento que prueba quién lo firmó
 * es un documento que nadie puede auditar.
 *
 * LA REGLA (C1, 12-nov-2026)
 * -------------------------
 *   (a) El documento se conserva SIN TÉRMINO (el contrato): su registro de
 *       operaciones tampoco tiene término.
 *   (b) El documento tiene PISO LEGAL (los registros del SG-SST): su registro
 *       sigue al PISO (veinte años desde el cese) y NO al plazo de cinco (5)
 *       años de la categoría del registro de operaciones.
 *   (c) Los demás: el registro sigue al documento asociado, y en todo caso no
 *       puede ser menor que él. El plazo de cinco (5) años de la categoría
 *       REGISTRO_OPERACIONES es el del registro que no cuelga de un documento
 *       conservado.
 *
 * POR QUÉ ESTÁ EN UN SOLO LUGAR
 * -----------------------------
 * Los eventos se suprimen CON la firma (ver `conservacion.js`: la capa de
 * auditoría borra los eventos de las firmas del lote, y el lote solo incluye
 * las vencidas y sin hold). El plazo efectivo del registro ya sigue al
 * documento. Esta función deja DICHA la regla en un solo lugar —la que la
 * tabla declara en `aplicacion.condiciones`— y la que se puede auditar: es
 * la que permite demostrar que el registro de operaciones de un documento con
 * piso legal no se purga a los cinco (5) años.
 *
 * @param {object} [opts]
 * @param {object|null} [opts.def] - la categoría de la tabla del documento
 * @param {object|null} [opts.plan] - el plan del documento (su fecha y su plazo)
 * @param {string} [opts.fecha_registro] - la fecha del registro de operaciones
 * @param {object} [opts.tabla] - la tabla supletoria
 * @returns {{fecha: string|null, dias: number|null, fuente: string, sigue_al_documento: boolean}}
 */
function plazoRegistroOperaciones(opts = {}) {
  const def = opts.def || null;
  const plan = opts.plan || null;
  const tabla = opts.tabla || null;
  const fechaRegistro = normalizarFecha(opts.fecha_registro);
  const fechaDocumento = (plan && plan.fecha_conservacion) || null;
  const diasDocumento = (plan && plan.plazo_conservacion_dias !== undefined
    && plan.plazo_conservacion_dias !== null)
    ? plan.plazo_conservacion_dias
    : null;

  // (a) El documento se conserva SIN TÉRMINO: su registro tampoco vence.
  if (def && def.hold_siempre) {
    return {
      fecha: null,
      dias: null,
      fuente: 'documento_sin_termino',
      sigue_al_documento: true,
    };
  }

  // (b) C1: el documento tiene PISO LEGAL. Su registro sigue al piso (veinte
  // años desde el cese), no al plazo de cinco (5) años de la categoría del
  // registro de operaciones.
  if (def && def.piso_legal) {
    return {
      fecha: fechaDocumento,
      dias: diasDocumento,
      fuente: 'piso_legal',
      sigue_al_documento: true,
    };
  }

  // Y con la compuerta cerrada no hay plazo que aplicar: el registro de
  // operaciones tampoco puede tener un plazo propio.
  if (plan && plan.fuente === 'tabla_supletoria_pendiente') {
    return {
      fecha: null,
      dias: null,
      fuente: 'tabla_supletoria_pendiente',
      sigue_al_documento: false,
    };
  }

  // (c) Los demás. El plazo del documento manda: el registro no puede morir
  // antes que el documento que acredita.
  if (fechaDocumento) {
    return {
      fecha: fechaDocumento,
      dias: diasDocumento,
      fuente: 'documento_asociado',
      sigue_al_documento: true,
    };
  }

  // Y si el documento no tiene plazo (la compuerta cerrada, o una firma sin
  // término propio), el plazo del registro es el de su categoría.
  const defRegistro = _categoriaPorId(tabla, 'REGISTRO_OPERACIONES');
  const aniosRegistro = defRegistro ? Number(defRegistro.plazo_anos) : NaN;
  const diasRegistro = defRegistro ? Number(defRegistro.plazo_dias) : NaN;
  const inicio = fechaRegistro || null;
  let fecha = null;
  let dias = null;
  if (inicio && Number.isInteger(aniosRegistro) && aniosRegistro > 0) {
    fecha = sumarAnios(inicio, aniosRegistro);
    dias = (Number.isInteger(diasRegistro) && diasRegistro > 0)
      ? diasRegistro
      : Math.round(aniosRegistro * 365.25);
  } else if (inicio && Number.isInteger(diasRegistro) && diasRegistro > 0) {
    fecha = _sumarDias(inicio, diasRegistro);
    dias = diasRegistro;
  }
  return {
    fecha,
    dias,
    fuente: 'tabla_supletoria',
    sigue_al_documento: false,
  };
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
  // Como se computo el plazo: 'anos_calendario' o 'dias'. Decide que texto ve
  // el Trabajador (C2): el texto tiene que decir lo mismo que la fecha.
  let computo = null;
  // Los años DECLARADOS por la categoría (no el redondeo de la diferencia):
  // es el número que dice el texto.
  let aniosDeclarados = null;

  const cesePendiente = Boolean(piso && !inicio);
  if (cesePendiente) {
    // La regla legal queda trazada, pero sin el punto de inicio no se calcula
    // una fecha de supresión ni se sustituye el cese por la fecha de firma.
    fuente = 'piso_legal';
    diasAplicados = piso.dias;
  }

  if (!holdSiempre && !cesePendiente) {
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
      //
      // C2 (12-nov-2026): EL COMPUTO ES EN AÑOS CALENDARIO.
      // -------------------------------------------------------------------
      // Antes se sumaban DIAS: la categoría traía `plazo_dias` (3650 por diez
      // años) y la fecha salía de ahí. Con eso el texto al Trabajador decía
      // «10 años (3650 días)», que es una equivalencia FALSA: 3650 días son
      // dos o tres días menos que diez años calendario, y el piso legal ya se
      // computaba en años. No puede quedar dos verdades en el mismo mensaje.
      //
      // Ahora, cuando la categoría declara `plazo_anos`, la fecha se calcula
      // en años calendario desde el punto de inicio (igual que el piso), y el
      // texto dice los años. `plazo_dias` queda como la EXPRESIÓN NOMINAL del
      // plazo y es lo que se congela en la fila: la fila guarda la regla, no
      // una cuenta de días que se pueda rehacer (misma convención del piso).
      const aniosTabla = Number(defCat && defCat.plazo_anos);
      const diasTabla = Number(defCat && defCat.plazo_dias);
      if (Number.isInteger(aniosTabla) && aniosTabla > 0) {
        fecha = sumarAnios(inicio, aniosTabla);
        diasAplicados = (Number.isInteger(diasTabla) && diasTabla > 0)
          ? diasTabla
          : Math.round(aniosTabla * 365.25);
        fuente = 'tabla_supletoria';
        computo = 'anos_calendario';
        aniosDeclarados = aniosTabla;
      } else if (Number.isInteger(diasTabla) && diasTabla > 0) {
        // Una categoría cuya duración está en días (un respaldo de treinta
        // días): aquí sí se suman días, y el texto los dice.
        fecha = _sumarDias(inicio, diasTabla);
        diasAplicados = diasTabla;
        fuente = 'tabla_supletoria';
        computo = 'dias';
      }
      // Si la categoría de la tabla no trae un plazo computable, la fecha
      // queda nula: es la última defensa (aviso RETAIN_SIN_PLAZO) y NO es el
      // camino normal.
    } else {
      // La tabla supletoria no está activada. Se conserva temporalmente con
      // fecha de supresión nula; no se inventa el fallback histórico de 20
      // años desde la firma ni se adelanta la tabla pendiente de aprobación.
      fuente = 'tabla_supletoria_pendiente';
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
  } else if (cesePendiente) {
    hold = {
      actor: 'sistema',
      motivo: 'fecha_cese_pendiente',
      alcance: 'No calcular ni ejecutar supresión de esta categoría SG-SST hasta que la Empresa informe y valide la fecha real de cese.',
    };
  } else if (!piso && !holdSiempre && !empresaDeclara && !tablaActiva) {
    // El hold de la tabla supletoria SOLO aplica a lo que la tabla supletoria
    //iba a resolver: "el resto" (el 8.6(a)(ii)), cuando la Empresa no declara
    // un plazo. Si la categoría tiene PISO LEGAL (las cinco del 8.6(b)), el
    // plazo ya salio del DEBER legal y de la fecha real de cese: ese deber no
    // depende de que la tabla supletoria este validada ni activada (es lo que
    // dicen el 8.6(a)(iii) y la condicion (ii) del orden que fijo el abogado
    // el 30-oct-2026: "20 anos desde el cese para las cinco categorias del
    // 8.6(b), hold sin termino para el contrato, y el plazo de la Empresa o el
    // supletorio para el resto").
    //
    // Sin esta guarda, el hold borraba la fecha del piso (la linea de abajo
    // pone fecha en null cuando hay hold) y el registro del SG-SST se
    // quedaba retenido sin fecha, cuando su plazo legal si se puede calcular.
    hold = {
      actor: 'sistema',
      motivo: 'tabla_supletoria_pendiente_validacion',
      alcance: 'No calcular ni ejecutar supresión hasta que la tabla supletoria esté validada y activada expresamente por el owner.',
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
  //   - el texto de la PENDIENTE, cuando la tabla supletoria todavía no está
  //     validada: ahí NO se promete ningún plazo, porque el sistema no tiene
  //     ninguno que prometer (el catálogo legado de veinte (20) años desde la
  //     firma se retiró el 30-oct-2026, por J8 y J9 del abogado).
  const aniosAplicados = _aniosAplicados(fecha, inicioAplicado, diasAplicados, regla);
  const textoEmpresa = (typeof emp.plazo_retencion === 'string' && emp.plazo_retencion.trim())
    ? emp.plazo_retencion.trim()
    : null;

  let texto;
  if (cesePendiente) {
    texto = 'El plazo mínimo de veinte (20) años para esta categoría SG-SST se cuenta desde la fecha real de cese. La Empresa debe informar y validar esa fecha; hasta entonces no se calcula una fecha de supresión y el registro queda pendiente.';
  } else if (!fecha && !hold) {
    // Última defensa: ni la Empresa ni la tabla pudieron dar un plazo.
    texto = TEXTO_PLAZO_PENDIENTE;
  } else if (holdSiempre) {
    // El contrato: se conserva sin término, con su fundamento.
    texto = _textoRegla(regla, aniosAplicados, punto.nombre);
  } else if (fuente === 'tabla_supletoria') {
    // La plantilla la decide el CÓMPUTO (C2): si el plazo se calculó en años
    // calendario, el texto dice años calendario y NO añade una equivalencia
    // en días, que sería falsa («10 años (3650 días)» no es lo mismo que
    // diez años calendario). Los años que dice el texto son los DECLARADOS
    // por la categoría, no un redondeo de la diferencia.
    const plantilla = computo === 'anos_calendario'
      ? TEXTO_PLAZO_SISTEMA_ANIOS
      : TEXTO_PLAZO_SISTEMA;
    texto = plantilla
      .replace('{anios}', String(aniosDeclarados !== null ? aniosDeclarados : aniosAplicados))
      .replace('{dias}', String(diasAplicados))
      .replace('{inicio}', punto.nombre)
      + (regla.notaSistema ? ' ' + regla.notaSistema : '');
  } else if (fuente === 'tabla_supletoria_pendiente') {
    // La COMPUERTA de la tabla supletoria está CERRADA: los plazos por
    // defecto (diez (10) y cinco (5) años) todavía no los validó el abogado,
    // y el catálogo legado de veinte (20) años desde la firma se RETIRÓ
    // (J8 y J9 del abogado, 30-oct-2026).
    //
    // El texto que ve el Trabajador NO puede prometer un plazo que el sistema
    // no tiene. Antes este caso caia en la rama general y producia "Se
    // conserva 20 años contados desde la fecha de la firma": el plazo que se
    // retiró, para una categoria a la que ni siquiera le corresponde. Ahora
    // dice la verdad: no hay fecha de supresión calculada y el registro queda
    // retenido.
    texto = 'La Empresa no ha declarado un plazo en su tabla de retención documental y la tabla de '
      + 'conservación por defecto del sistema todavía no ha sido validada, de modo que este documento '
      + 'no tiene una fecha de supresión calculada: queda retenido y no se suprime mientras esa '
      + 'declaración o esa validación se formalicen.';
  } else if (fuente === 'empresa' && textoEmpresa) {
    texto = textoEmpresa;
  } else {
    texto = _textoRegla(regla, aniosAplicados, punto.nombre);
  }

  let aviso;
  if (cesePendiente && !emp.conservacion_por_deber_legal) {
    aviso = 'RETAIN_PENDIENTE_CESE';
  } else if (hold && hold.motivo === 'tabla_supletoria_pendiente_validacion') {
    aviso = 'RETAIN_TABLA_PENDIENTE';
  } else if (hold) {
    aviso = 'RETAIN_DEBER_LEGAL';
  } else if (fecha) {
    aviso = 'RETAIN_FECHA';
  } else {
    aviso = 'RETAIN_SIN_PLAZO';
  }

  // C1 · El plazo del REGISTRO DE OPERACIONES (los eventos de la firma) sigue
  // al del documento asociado. Se deja DICHO aquí, en un solo lugar: es lo que
  // la tabla declara en `aplicacion.condiciones` y lo que se puede auditar.
  const plazoRegistro = plazoRegistroOperaciones({
    def: defCat,
    plan: {
      fecha_conservacion: fecha,
      plazo_conservacion_dias: diasAplicados,
      fecha_inicio_conservacion: inicioAplicado,
      fuente,
    },
    fecha_registro: inicioAplicado,
    tabla,
  });

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
    // C1 · El plazo del registro de operaciones de esta firma.
    plazo_registro_operaciones: plazoRegistro,
  };
}

module.exports = {
  REGLAS,
  REGLAS_LEGACY,
  CATEGORIAS,
  ANIOS_CUSTODIA,
  TEXTO_PLAZO_PENDIENTE,
  TEXTO_PLAZO_SISTEMA,
  TEXTO_PLAZO_SISTEMA_ANIOS,
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
  plazoRegistroOperaciones,
  planificar,
};
