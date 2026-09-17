/**
 * Middleware: validación de body con zod.
 *
 * Uso:
 *   const { validateBody } = require('./middleware/validate');
 *   const schema = z.object({ id: z.string(), ... });
 *   router.post('/x', validateBody(schema), handler);
 *
 * Si la validación falla, retorna 400 INVALID_REQUEST_BODY con detalle.
 */
'use strict';

const { AppError } = require('./errors');

function validateBody(schema) {
  return function (req, res, next) {
    if (!schema) return next();
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      return next(new AppError(400, 'INVALID_REQUEST_BODY',
        'El body de la request no cumple el schema',
        { issues }));
    }
    // Reemplazar req.body con los datos validados (strip unknown, defaults aplicados)
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
