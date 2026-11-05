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

/**
 * El path de un problema, como texto.
 *
 * POR QUE NO ES `i.path.join('.')` A SECAS
 * -----------------------------------------
 * El 5-nov-2026, en produccion, un POST con una clave que no estaba en el
 * esquema devolvio 500 "Error interno del servidor" en vez de 400: el
 * problema de "clave no reconocida" llegaba SIN `path` y `i.path.join('.')`
 * lanzaba un TypeError que se comia el 400. Con el MISMO codigo, en local,
 * los dos casos dan 400.
 *
 * La diferencia no es el codigo: es la version de zod instalada en el
 * servidor, porque el deploy NO reinstala `node_modules` ("el package.json no
 * cambio"). Con la version del servidor la forma del problema es otra.
 *
 * Por eso el path se arma aqui y no inline: el 400 tiene que salir con la
 * lista de problemas, diga lo que diga la libreria que los reporta.
 *
 * @param {*} path - el path que reporta el problema.
 * @returns {string}
 */
function _pathDe(path) {
  if (Array.isArray(path)) return path.join('.');
  if (typeof path === 'string') return path;
  return '';
}

/**
 * La lista de problemas del esquema, siempre en la misma forma.
 *
 * @param {object} error - el error del schema.
 * @returns {Array<{path: string, message: string, code: string}>}
 */
function _issuesDe(error) {
  const lista = (error && Array.isArray(error.issues)) ? error.issues : [];
  return lista.map((i) => ({
    path: _pathDe(i && i.path),
    message: (i && typeof i.message === 'string' && i.message) ? i.message : 'Dato inválido',
    code: (i && typeof i.code === 'string' && i.code) ? i.code : 'INVALID',
  }));
}

function validateBody(schema) {
  return function (req, res, next) {
    if (!schema) return next();
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = _issuesDe(result.error);
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
