/**
 * Punto de entrada único para los services.
 */
'use strict';

module.exports = {
  ...require('./agreement'),
  ...require('./consent'),
  ...require('./internalClient'),  // I-010 (D-13): per-company authz
  ...require('./mailer'),
  ...require('./signRequest'),
  ...require('./storage'),
  ...require('./publicFlow'),
};
