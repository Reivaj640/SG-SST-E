/**
 * Schemas zod para los endpoints admin de per-company clients
 * (D-13, I-010, AUD-04).
 *
 * Cubre:
 *  - POST /internal/admin/clientes                  → createClientBody
 *  - GET  /internal/admin/clientes                  → listClientsQuery
 *  - GET  /internal/admin/clientes/:id              → idEmpresaParam
 *  - POST /internal/admin/clientes/:id/rotate       → rotateClientBody
 *
 * Ver:
 *  - storage-backup/specs/backend-auth-spec.md §3.1, §3.2, §3.3
 *  - DR-6.A, DR-6.B (binding)
 */
'use strict';

const { z } = require('zod');

/**
 * Set de operaciones permitidas (enum I-010).
 *
 * Es la única fuente de verdad del enum; cualquier otro archivo
 * (incluido el service internalClient.js) debe importarlo desde acá.
 *
 * DR-6.B: el bridge de K+AIR SIEMPRE envía los 5 valores. El schema
 * acepta 1-10 (forward-compat) pero loggeamos WARN si llegan menos
 * de 5 (señal de bug en el bridge).
 */
const ALLOWED_OPS = Object.freeze([
  'sign_request:create',
  'sign_request:read',
  'consent:create',
  'consent:verify',
  'audit:read',
]);

/**
 * Validador del array de operaciones. Garantiza que cada item es del enum.
 */
const allowedOperationsField = z.array(z.enum(ALLOWED_OPS), {
  errorMap: () => ({
    message:
      'Cada item de allowed_operations debe ser uno de: ' +
      ALLOWED_OPS.join(', '),
  }),
})
  .min(1, 'allowed_operations no puede estar vacío')
  .max(10, 'allowed_operations máximo 10 items');

/**
 * Body de POST /internal/admin/clientes.
 *
 * Reglas:
 *  - id_empresa: 1-64 chars (NIT, EXT-XXX, o cualquier string libre).
 *    NO se enforcea formato; la responsabilidad de validar NIT es del
 *    cliente que llama (K+AIR o humano).
 *  - allowed_operations: 1-10 items, todos del enum ALLOWED_OPS.
 *  - description: opcional, 1-200 chars. Se persiste tal cual llega
 *    (DR-6.A: el bridge ya lo construye formateado).
 *  - expires_at: OPCIONAL, ISO-8601. Aceptado en schema por forward-compat
 *    pero NO se persiste (no hay columna en BD); se ignora silenciosamente.
 *
 * NOTA: usamos .strict() en la raíz para rechazar campos no listados
 * con un error claro, lo cual ayuda a detectar typos en el cliente.
 * Sin embargo, `expires_at` SÍ está en el schema (ignorado), así que
 * NO se rechaza. Si en el futuro se quiere rechazar `expires_at` también,
 * se cambia acá.
 */
const createClientBody = z.object({
  id_empresa: z.string()
    .min(1, 'id_empresa es requerido')
    .max(64, 'id_empresa demasiado largo (max 64 chars)'),
  allowed_operations: allowedOperationsField,
  description: z.string()
    .min(1, 'description no puede estar vacío')
    .max(200, 'description demasiado largo (max 200 chars)')
    .optional(),
  expires_at: z.string()
    .datetime({ message: 'expires_at debe ser ISO-8601' })
    .optional(),
}).strict();

/**
 * Query params de GET /internal/admin/clientes.
 *
 * Reglas:
 *  - id_empresa: 1-64 chars opcional. Filtro exacto.
 *  - include_revoked: 'true' | 'false' opcional. Default false.
 *    Si 'true' incluye revocados (historial de rotaciones).
 *  - limit: 1-200, default 100.
 *  - offset: ≥0, default 0.
 */
const listClientsQuery = z.object({
  id_empresa: z.string()
    .min(1)
    .max(64)
    .optional(),
  include_revoked: z.union([z.literal('true'), z.literal('false')])
    .optional()
    .transform(v => v === 'true'),
  limit: z.coerce.number()
    .int('limit debe ser entero')
    .min(1, 'limit mínimo 1')
    .max(200, 'limit máximo 200')
    .optional()
    .default(100),
  offset: z.coerce.number()
    .int('offset debe ser entero')
    .min(0, 'offset mínimo 0')
    .optional()
    .default(0),
}).strict();

/**
 * Path param `:id` para GET /:id y POST /:id/rotate.
 *
 * Validación: 1-64 chars. NO se enforcea formato (NIT/EXT/otros).
 *
 * @see backend-auth-spec.md §3.3.1
 */
const idEmpresaParam = z.string()
  .min(1, 'id_empresa es requerido')
  .max(64, 'id_empresa demasiado largo (max 64 chars)');

/**
 * Body de POST /internal/admin/clientes/:id/rotate.
 *
 * El body es opcional. Si no se envía o si los campos faltan, se usan
 * los defaults documentados en §3.3.1:
 *  - motivo: 'Rotación programada'
 *  - actor: 'admin'
 *
 * NO se permite `allowed_operations` aquí — la rotación hereda las ops
 * de la key anterior (DR-6 / spec §3.3.1 "no se pueden cambiar en
 * rotación — para eso es DELETE + POST").
 */
const rotateClientBody = z.object({
  motivo: z.string()
    .min(1, 'motivo no puede estar vacío')
    .max(500, 'motivo demasiado largo (max 500 chars)')
    .optional()
    .default('Rotación programada'),
  actor: z.string()
    .min(1, 'actor no puede estar vacío')
    .max(100, 'actor demasiado largo (max 100 chars)')
    .optional()
    .default('admin'),
}).strict();

module.exports = {
  ALLOWED_OPS,
  createClientBody,
  listClientsQuery,
  idEmpresaParam,
  rotateClientBody,
};
