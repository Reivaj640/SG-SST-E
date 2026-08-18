/**
 * Punto de entrada único para los services.
 */
'use strict';

module.exports = {
  ...require('./agreement'),
  ...require('./consent'),
  ...require('./mailer'),
  ...require('./signRequest'),
  ...require('./storage'),
  ...require('./publicFlow'),
};
