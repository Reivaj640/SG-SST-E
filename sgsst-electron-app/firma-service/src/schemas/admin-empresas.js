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