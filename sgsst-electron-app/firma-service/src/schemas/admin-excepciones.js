/**
 * Schemas de las excepciones de habilitacion (D-03, decision B.3).
 *
 * La excepcion es la UNICA salida del bloqueo de habilitacion, asi que su
 * forma es parte del control, no un detalle de la API. El service (services/
 * excepcionHabilitacion.js) vuelve a validar las seis condiciones del
 * abogado: aca se valida el FORMA, alla la EXISTENCIA.
 *
 * Los seis requisitos del abogado y donde se comprueban:
 *
 *   Autorizacion escrita  |zod: autorizado_por, autorizacion_fecha,
 *                         |    autorizacion_ref obligatorios.
 *   Alcance               |zod: alcance_firmas_max entero >= 1.
 *                         |    service: una sola Empresa por excepcion.
 *   Ruta en papel         |zod: ruta_papel y ruta_papel_operativa.
 *                         |    service: la ruta tiene que estar operativa
 *                         |    HOY (no basta con declararla).
 *   Plazo                 |zod: plazo_hasta. service: no puede pasar de 30
 *                         |    dias ni estar en el pasado.
 *   Rastro                |    service: la bitacora append-only (035/036).
 *   Limite (piloto)       |zod: piloto_autorizado opcional.
 *                         |    service: una Empresa sin ningun Anexo solo
 *                         |    entra como piloto, y con quien lo autoriza.
 */
'use strict';

const { z } = require('zod');

const idEmpresa = z
  .string()
  .min(1, 'id_empresa es requerido')
  .max(64, 'id_empresa demasiado largo (max 64 chars)')
  .transform((s) => s.trim());

const fecha = z
  .string()
  .min(1, 'la fecha es requerida')
  .max(40, 'la fecha es demasiado larga (max 40 chars)')
  .transform((s) => s.trim());

/**
 * El cuerpo de POST /internal/admin/excepciones-habilitacion.
 *
 * `ruta_papel_operativa` es OBLIGATORIA y booleana: la excepcion exige una
 * ruta en papel disponible y operativa el mismo dia, asi que el operador
 * tiene que afirmar eso de forma explicita (y queda escrito).
 */
const crearExcepcionBody = z.object({
  id_empresa: idEmpresa,
  autorizado_por: z
    .string()
    .min(1, 'autorizado_por es requerido (el owner o el representante legal)')
    .max(200, 'autorizado_por demasiado largo (max 200 chars)')
    .transform((s) => s.trim()),
  autorizacion_fecha: fecha,
  autorizacion_ref: z
    .string()
    .min(1, 'autorizacion_ref es requerido (donde queda el documento escrito)')
    .max(500, 'autorizacion_ref demasiado largo (max 500 chars)')
    .transform((s) => s.trim()),
  alcance_firmas_max: z
    .number({ invalid_type_error: 'alcance_firmas_max tiene que ser un numero' })
    .int('alcance_firmas_max tiene que ser un entero')
    .min(1, 'alcance_firmas_max tiene que ser al menos 1')
    .max(1000, 'alcance_firmas_max no puede pasar de 1000'),
  ruta_papel: z
    .string()
    .min(1, 'ruta_papel es requerida (como se firma en papel mientras tanto)')
    .max(500, 'ruta_papel demasiado largo (max 500 chars)')
    .transform((s) => s.trim()),
  ruta_papel_operativa: z.boolean({
    invalid_type_error: 'ruta_papel_operativa tiene que ser true o false',
  }),
  plazo_hasta: fecha,
  piloto_autorizado: z.boolean().optional().default(false),
  piloto_autorizado_por: z
    .string()
    .max(200, 'piloto_autorizado_por demasiado largo (max 200 chars)')
    .transform((s) => s.trim())
    .nullish(),
  motivo: z
    .string()
    .min(1, 'motivo es requerido (queda en la bitacora)')
    .max(1000, 'motivo demasiado largo (max 1000 chars)')
    .transform((s) => s.trim()),
});

/** El cuerpo de POST /internal/admin/excepciones-habilitacion/:id/cerrar. */
const cerrarExcepcionBody = z.object({
  motivo: z
    .string()
    .min(1, 'motivo es requerido')
    .max(500, 'motivo demasiado largo (max 500 chars)')
    .transform((s) => s.trim()),
});

module.exports = {
  idEmpresa,
  crearExcepcionBody,
  cerrarExcepcionBody,
};
