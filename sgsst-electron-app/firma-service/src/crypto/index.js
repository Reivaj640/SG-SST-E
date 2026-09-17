/**
 * Punto de entrada único para todas las funciones criptográficas.
 *
 * Uso: const crypto = require('./crypto');
 */
'use strict';

module.exports = {
  ...require('./hash'),
  ...require('./compare'),
  ...require('./token'),
  ...require('./otp'),
};
