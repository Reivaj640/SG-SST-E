/**
 * Schemas de validación para la identificación de la empresa (migración 017).
 *
 * Mismo estilo que schemas/admin-clientes.js: zod, mensajes en español, y
 * límites generosos para texto de identificación comercial (razones sociales
 * largas, domicilios con referencias internas, etc.).
 *
 * La validación de formato EXACTO (tipo de dato) la hace zod; la de longitud
 * máxima la hace además services/empresa.js como red de seguridad para quien
 * llame al service sin pasar por el router.
 */
'use strict';

const { z } = require('zod');

/**
 * Texto opcional. Se acepta string o null/undefined; el service lo normaliza
 * (trim y vacío → null). NO se usa .optional().nullable() con default porque
 * el service es quien decide qué hacer con la ausencia.
 */
const textoOpcional = (max) => z
  .string()
  .max(max, `Máximo ${max} caracteres`)
  .transform((s) => (s.trim().length === 0 ? null : s.trim()))
  .nullish();

/**
 * id_empresa: misma restricción que en admin-clientes.js (1-64 chars).
 * No se restringe a dígitos porque el esquema ya admite identificadores no
 * numéricos (p. ej. claves externas de la casa matriz).
 */
const idEmpresa = z
  .string()
  .min(1, 'id_empresa es requerido')
  .max(64, 'id_empresa demasiado largo (max 64 chars)')
  .transform((s) => s.trim());

const razonSocial = z
  .string()
  .min(1, 'razon_social es requerido')
  .max(200, 'razon_social demasiado larga (max 200 chars)')
  .transform((s) => s.trim());

/**
 * NIT. Se valida como texto, no como número: el NIT puede traer guiones o un
 * dígito de chequeo escrito ("900.829.731-1") según cómo lo reporte la
 * empresa, y normalizarlo acá obligaría a la base a aceptar un solo formato.
 * Lo que se valida es que no sea un disparate de longitud.
 */
const nit = z
  .string()
  .max(64, 'nit demasiado largo (max 64 chars)')
  .transform((s) => s.trim())
  .nullish();

const anexoBody = z.object({
  fecha: z
    .string()
    .min(1, 'fecha es requerida')
    .max(40, 'fecha demasiado larga')
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: 'fecha no es una fecha valida',
    }),
});

const anexoNubeBody = z.object({
  fecha: z.string().min(1).max(40).refine((s) => !Number.isNaN(new Date(s).getTime())),
  version: z.string().trim().min(1).max(40),
  hash: z.string().trim().regex(/^[0-9a-f]{64}$/i),
  evidencia: z.string().trim().min(1).max(1000),
});

/**
 * Body de la apertura de una SUSCRIPCIÓN del Anexo de Nube.
 *
 * Lo único que el operador declara es A QUIÉN se manda el enlace y el
 * código. La VERSIÓN y la HUELLA no se mandan: el servicio las saca del
 * archivo del servidor y calcula la huella sobre sus bytes. Si el operador
 * pudiera declarar la huella, podría suspender un texto que no es el que
 * está publicado.
 *
 * `nombre_firmante` y `cargo_firmante` son opcionales: si no vienen, se usan
 * el representante legal y el cargo que ya están en la ficha de la Empresa.
 */
const suscripcionAnexoNubeBody = z.object({
  correo_firmante: z
    .string()
    .min(1, 'correo_firmante es requerido')
    .max(254, 'correo_firmante demasiado largo')
    .email('correo_firmante no parece un correo')
    .transform((s) => s.trim().toLowerCase()),
  nombre_firmante: textoOpcional(200),
  cargo_firmante: textoOpcional(200),
});

/**
 * Body de la apertura de una SUSCRIPCIÓN del Anexo de Encargo.
 *
 * Es el mismo contrato que el del Anexo de Nube, con una diferencia: la
 * VERSIÓN y la HUELLA tampoco se mandan (el servicio las lee del manifiesto
 * legal y las contrasta con los bytes del archivo del servidor). El Anexo de
 * Encargo se versiona POR FECHA y su texto canónico lo produce un generador,
 * así que una constante en el código —o un valor declarado por el operador—
 * podría desincronizarse del manifiesto sin que nadie lo notara.
 *
 * `datos_empresa` es el PRELLENADO de los cinco datos del §11: si el operador
 * los declara, sustituyen a los de la ficha. Lo que MANDAN son los que
 * declare la Empresa en la pantalla: el operador solo puede adelantar lo que
 * ella ya tiene, no escribir en su nombre.
 *
 * EL SEGUNDO CANAL DEL CÓDIGO
 * --------------------------
 * `canal_codigo` es por dónde sale el código de verificación, y tiene que ser
 * DISTINTO de `correo_firmante`: el artículo 4 del Decreto 2364 pide que los
 * datos de creación de la firma correspondan exclusivamente al firmante, y un
 * buzón compartido no corresponde a una persona. Lo declara K+AIR (lo
 * confirma con la Empresa fuera de banda) y no quien está haciendo clic en
 * el enlace: si lo declarara la pantalla, un intruso con el buzón podría
 * apuntar el código a su propia dirección.
 *
 * `canal_codigo_confirmacion` es CÓMO se confirmó ese canal con la Empresa.
 * Es obligatoria porque es la prueba de que el canal es de la Empresa.
 */
const suscripcionAnexoEncargoBody = z.object({
  correo_firmante: z
    .string()
    .min(1, 'correo_firmante es requerido')
    .max(254, 'correo_firmante demasiado largo')
    .email('correo_firmante no parece un correo')
    .transform((s) => s.trim().toLowerCase()),
  canal_codigo: z
    .string()
    .min(1, 'canal_codigo es requerido: el código no puede salir al mismo buzón del enlace')
    .max(254, 'canal_codigo demasiado largo')
    .email('canal_codigo no parece un correo')
    .transform((s) => s.trim().toLowerCase()),
  canal_codigo_confirmacion: z
    .string()
    .min(1, 'canal_codigo_confirmacion es requerido: hay que decir cómo se confirmó el canal')
    .max(300, 'canal_codigo_confirmacion demasiado largo')
    .transform((s) => s.trim()),
  nombre_firmante: textoOpcional(200),
  cargo_firmante: textoOpcional(200),
  datos_empresa: z.object({
    razon_social: textoOpcional(200),
    nit: textoOpcional(60),
    domicilio: textoOpcional(300),
    correo: textoOpcional(254),
    representante: textoOpcional(200),
  }).strict().nullish(),
});

/**
 * Body de la verificación documental de quien firmó el Anexo de Encargo.
 *
 * Es un acto de K+AIR: alguien de la operación contrasta el documento que la
 * Empresa declaró contra el certificado de existencia y representación de la
 * cámara de comercio, contra el RUT de la Empresa o contra el poder, y deja
 * constancia de contra qué lo contrastó y de dónde quedó radicado.
 */
const verificarRepresentanteBody = z.object({
  tipo_documento: z
    .enum(['CERTIFICADO_CAMARA', 'RUT', 'PODER'], {
      errorMap: () => ({ message: 'tipo_documento tiene que ser CERTIFICADO_CAMARA, RUT o PODER' }),
    }),
  referencia: z
    .string()
    .min(1, 'referencia es requerida: hay que decir dónde quedó el documento')
    .max(300, 'referencia demasiado larga')
    .transform((s) => s.trim()),
  nota: textoOpcional(500),
}).strict();

/**
 * Body de alta. Solo identidad: el anexo y el estado activo tienen endpoints
 * propios para que no se puedan cambiar por accidente.
 */
const createEmpresaBody = z.object({
  id_empresa: idEmpresa,
  razon_social: razonSocial,
  nit,
  domicilio: textoOpcional(300),
  representante_legal: textoOpcional(200),
  representante_legal_identificacion: textoOpcional(64),
  responsable_tratamiento: textoOpcional(200),
  responsable_tratamiento_correo: textoOpcional(200),
  canal_pqrs: textoOpcional(300),
  canal_incidentes: textoOpcional(300),
  politica_datos_url: textoOpcional(500),
  // Plazo de conservación que declara la Empresa y canal para pedir copia.
  // Numeral 8.6 del Acuerdo: la Empresa debe comunicárselo al Trabajador
  // antes de solicitarle la firma. K+AIR solo lo transporta y lo muestra.
  plazo_retencion: textoOpcional(500),
  canal_solicitud_copia: textoOpcional(300),
  // El plazo COMPUTABLE, en días (migración 023). Es el número que permite
  // calcular la fecha de conservación y, con ella, la supresión del dato
  // vencido (8.6 y 10.6). Si la Empresa no lo declara, sus firmas no tienen
  // fecha de conservación y no se suprimen: el sistema no inventa plazos.
  plazo_retencion_dias: z
    .number()
    .int()
    .positive()
    .max(36500)
    .nullish(),
  // El deber legal de conservación SIN TÉRMINO (migración 029). Lo declara
  // la EMPRESA, a nivel de empresa y no de documento: es una cualidad de la
  // relación laboral, y el sistema no puede clasificar un PDF con acierto
  // (el mismo argumento del 10.8). Con el flag en 1, las firmas de esa
  // empresa no son elegibles para supresión automática (se levanta un hold
  // legal automático) y el Trabajador recibe el aviso.
  conservacion_por_deber_legal: z.boolean().nullish(),
  // La norma que impone el deber (p. ej. "2.2.1.1.12 del Decreto 1072 de
  // 2015"). Se comunica al Trabajador y se archiva con la solicitud.
  norma_conservacion: textoOpcional(300),
});

/**
 * Body de actualización. `id_empresa` NO se acepta (es la clave primaria).
 * `razon_social` es obligatoria en el update porque es el campo que el
 * firmante lee primero; dejarla en null mostraría un bloque sin nombre.
 */
const updateEmpresaBody = z.object({
  razon_social: razonSocial,
  nit,
  domicilio: textoOpcional(300),
  representante_legal: textoOpcional(200),
  representante_legal_identificacion: textoOpcional(64),
  responsable_tratamiento: textoOpcional(200),
  responsable_tratamiento_correo: textoOpcional(200),
  canal_pqrs: textoOpcional(300),
  canal_incidentes: textoOpcional(300),
  politica_datos_url: textoOpcional(500),
  plazo_retencion: textoOpcional(500),
  canal_solicitud_copia: textoOpcional(300),
  plazo_retencion_dias: z
    .number()
    .int()
    .positive()
    .max(36500)
    .nullish(),
  // El deber legal de conservación sin término (migración 029). Ver la nota
  // del body de alta. OJO: si el campo NO viene, NO se toca (levantarlo es
  // un acto, con actor y motivo); para levantarlo hay que mandar `false`.
  conservacion_por_deber_legal: z.boolean().nullish(),
  norma_conservacion: textoOpcional(300),
});

const setActivoBody = z.object({
  activo: z.boolean({
    required_error: 'activo es requerido',
  }),
});

/**
 * Body de la cuenta de correo de envío de la Empresa (migración 042).
 *
 * `puerto` y `secure` tienen default (587 / false): son los valores con los
 * que arranca un servidor SMTP de verdad, y que el operador tenga que
 * recordarlos para probar la cuenta es una barrera sin motivo.
 *
 * `clave` es la contraseña del buzón. Viaja en el body (no en un header) y
 * NO se devuelve nunca: el `GET` de admin devuelve la vista enmascarada.
 *
 * `activo` es opcional: si no viene, el service conserva el valor que haya.
 * Levantar o bajar la cuenta es un acto, con actor y motivo en el rastro.
 */
const cuentaEnvioBody = z.object({
  host: z
    .string()
    .min(1, 'host es requerido')
    .max(255, 'host demasiado largo (max 255 chars)')
    .transform((s) => s.trim()),
  puerto: z
    .number()
    .int()
    .min(1, 'puerto inválido')
    .max(65535, 'puerto inválido')
    .optional()
    .default(587),
  secure: z.boolean().optional().default(false),
  usuario: z
    .string()
    .min(1, 'usuario es requerido')
    .max(254, 'usuario demasiado largo (max 254 chars)')
    .transform((s) => s.trim()),
  clave: z
    .string()
    .min(1, 'clave es requerida')
    .max(512, 'clave demasiado larga (max 512 chars)'),
  from_nombre: z
    .string()
    .min(1, 'from_nombre es requerido')
    .max(200, 'from_nombre demasiado largo (max 200 chars)')
    .transform((s) => s.trim()),
  from_email: z
    .string()
    .max(254, 'from_email demasiado largo (max 254 chars)')
    .email('from_email no parece un correo')
    .transform((s) => s.trim().toLowerCase()),
  activo: z.boolean().nullish(),
});

/**
 * Body de la prueba de la cuenta de envío: a quién se le manda el correo de
 * prueba. La dirección es la que se le pase, no la de la cuenta: la prueba
 * tiene que poder mandarse a un buzón que el operador controle.
 */
const probarCuentaEnvioBody = z.object({
  to: z
    .string()
    .min(1, 'to es requerido')
    .max(254, 'to demasiado largo (max 254 chars)')
    .email('to no parece un correo')
    .transform((s) => s.trim().toLowerCase()),
});

/**
 * Body del CANAL DE LA FECHA DE TERMINACION (Anexo de Encargo, seccion 6).
 *
 * La Empresa comunica la fecha de terminacion de la relacion laboral de un
 * trabajador, por el canal que el Encargado habilita en el servicio.
 *
 * La EVIDENCIA es obligatoria: el Anexo exige registrar "la fecha con la
 * evidencia de la comunicacion". Sin evidencia no hay registro.
 *
 * El canal tambien es obligatorio: la comunicacion tiene que decir por donde
 * llego, para que la bitacora sea la de una comunicacion y no la de una
 * instruccion sin origen.
 */
const fechaTerminacionBody = z.object({
  id_trabajador: z
    .string()
    .min(1, 'id_trabajador es requerido')
    .max(64, 'id_trabajador demasiado largo (max 64 chars)')
    .transform((s) => s.trim()),
  fecha_terminacion: z
    .string()
    .min(1, 'fecha_terminacion es requerida')
    .max(40, 'fecha_terminacion demasiado larga')
    .refine((s) => !Number.isNaN(new Date(s).getTime()), {
      message: 'fecha_terminacion no es una fecha valida',
    }),
  evidencia: z
    .string()
    .min(1, 'evidencia es requerida')
    .max(1000, 'evidencia demasiado larga (max 1000 chars)')
    .transform((s) => s.trim()),
  canal: z
    .string()
    .min(1, 'canal es requerido')
    .max(100, 'canal demasiado largo (max 100 chars)')
    .transform((s) => s.trim()),
  motivo: z
    .string()
    .max(500, 'motivo demasiado largo (max 500 chars)')
    .transform((s) => s.trim())
    .nullish(),
});

module.exports = {
  idEmpresa,
  createEmpresaBody,
  updateEmpresaBody,
  anexoBody,
  anexoNubeBody,
  suscripcionAnexoNubeBody,
  suscripcionAnexoEncargoBody,
  verificarRepresentanteBody,
  setActivoBody,
  cuentaEnvioBody,
  probarCuentaEnvioBody,
  fechaTerminacionBody,
};
