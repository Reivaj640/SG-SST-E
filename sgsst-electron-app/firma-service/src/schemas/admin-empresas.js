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

module.exports = {
  idEmpresa,
  createEmpresaBody,
  updateEmpresaBody,
  anexoBody,
  setActivoBody,
};