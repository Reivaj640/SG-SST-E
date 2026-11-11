/**
 * Schemas de validacion para el REGISTRO DE PODERES DEL ENCARGADO.
 *
 * Mismo estilo que schemas/admin-empresas.js: zod, mensajes en espanol, y la
 * validacion de contenido en el service (que es quien decide si el poder
 * sirve para algo).
 *
 * QUE SE VALIDA AQUI Y QUE NO
 * --------------------------
 * Aqui se valida la FORMA: que el nombre no este vacio, que el tipo sea uno de
 * los tres, que la huella del instrumento sea una huella y que las fechas sean
 * fechas. Lo que NO se valida aqui es si el poder sirve para contrafirmar: eso
 * lo decide `services/poderesEncargado.js`, en el momento del acto, contra el
 * estado real del registro.
 */

'use strict';

const { z } = require('zod');

/**
 * Texto opcional. Se acepta string o null/undefined; el service lo normaliza
 * (trim y vacio -> null).
 */
const textoOpcional = (max) => z
  .string()
  .max(max, `Maximo ${max} caracteres`)
  .transform((s) => (s.trim().length === 0 ? null : s.trim()))
  .nullish();

/**
 * Una fecha ISO 8601. Se valida que PARSEA: lo que no se puede es una fecha
 * que no existe.
 */
const fechaOpcional = z
  .string()
  .trim()
  .min(1, 'la fecha no puede estar vacia')
  .max(40, 'fecha demasiado larga')
  .refine((s) => !Number.isNaN(new Date(s).getTime()), {
    message: 'no es una fecha valida',
  })
  .nullish();

/**
 * Body del ALTA de un poder del Encargado.
 *
 * `instrumento_ref` y `instrumento_sha256` son OBLIGATORIOS: sin referencia no
 * hay contra que contrastar y sin huella el expediente no puede verificar que
 * el documento es el que se guardo. Un poder sin las dos cosas no es una
 * acreditacion: es una anotacion.
 */
const registrarPoderBody = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'nombre es requerido: sin saber a quien se le da la facultad no hay nada que acreditar')
    .max(200, 'nombre demasiado largo (max 200 chars)'),
  cargo: textoOpcional(200),
  tipo: z.enum(['PODER', 'DELEGACION', 'REPRESENTACION'], {
    errorMap: () => ({
      message: 'tipo tiene que ser PODER, DELEGACION o REPRESENTACION',
    }),
  }),
  instrumento_ref: z
    .string()
    .trim()
    .min(1, 'instrumento_ref es requerido: hay que decir contra que documento se acredita la facultad')
    .max(300, 'instrumento_ref demasiado largo (max 300 chars)'),
  instrumento_sha256: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/i, 'instrumento_sha256 tiene que ser una huella SHA-256 en hexadecimal'),
  documento_archivo: textoOpcional(300),
  emitido_at: fechaOpcional,
  vigente_desde: fechaOpcional,
  vigente_hasta: fechaOpcional,
}).strict();

module.exports = {
  registrarPoderBody,
};
