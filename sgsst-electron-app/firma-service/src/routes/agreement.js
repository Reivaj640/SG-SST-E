/**
 * Rutas del Acuerdo de uso de firma electrónica.
 *
 * - GET /internal/acuerdo-activo  (protegida por requireEmpresaScope)
 *
 * Ver API.md §6.9.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScope } = require('../middleware/authz');
const { AppError } = require('../middleware/errors');
const agreementService = require('../services/agreement');

router.get('/acuerdo-activo', requireEmpresaScope(), (req, res, next) => {
  try {
    const acuerdo = agreementService.getActive();
    if (!acuerdo) {
      throw new AppError(404, 'ACUERDO_NOT_FOUND',
        'No hay versión activa del Acuerdo de uso');
    }
    res.json({
      version: acuerdo.version,
      texto: acuerdo.texto,
      texto_hash: acuerdo.texto_hash,
      fecha_vigencia_inicio: acuerdo.fecha_vigencia_inicio,
      activa: acuerdo.activa === 1,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
