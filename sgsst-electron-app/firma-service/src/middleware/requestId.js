/**
 * Middleware: X-Request-Id.
 *
 * - Si el cliente envía `X-Request-Id`, lo usa.
 * - Si no, genera uno (UUID v4 simplificado).
 * - Lo expone en `req.id` y en los headers de respuesta.
 */
'use strict';

const crypto = require('crypto');

function newRequestId() {
  return 'req_' + crypto.randomBytes(12).toString('hex');
}

function requestId() {
  return function (req, res, next) {
    const incoming = req.get('X-Request-Id');
    const id = (incoming && /^[A-Za-z0-9_\-]{6,64}$/.test(incoming))
      ? incoming
      : newRequestId();
    req.id = id;
    res.set('X-Request-Id', id);
    next();
  };
}

module.exports = requestId;
