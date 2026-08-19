/**
 * Rutas administrativas del Servicio de Firma.
 *
 * Endpoints protegidos por X-Admin-API-Key (ver src/middleware/auth.js).
 * Son endpoints de operación humana, NO expuestos a K+AIR.
 *
 * - POST /internal/admin/acuerdo-versiones
 *     Crea una nueva versión del Acuerdo de uso.
 *     El texto_hash se calcula SERVER-SIDE (nunca del cliente).
 *     Si activa=true, se desactivan las anteriores en transacción atómica.
 *
 * Ver API.md §6.12 y SECURITY.md §3.3.
 */
'use strict';

const express = require('express');
const { z } = require('zod');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const agreementService = require('../services/agreement');
const logger = require('../utils/logger');

/**
 * Schema del body de POST /internal/admin/acuerdo-versiones.
 *
 * Reglas:
 *  - version: /^v\d+\.\d+$/ (3-32 chars)
 *  - texto: 1-50000 chars
 *  - activa: bool, default true
 *  - fecha_vigencia_fin: ISO-8601 o null
 *  - creado_por: max 128 chars
 *  - kair_version: max 32 chars
 *  - metadata: objeto JSON o null
 *
 * NUNCA aceptamos texto_hash del cliente — el server lo calcula.
 */
const createAcuerdoVersionBody = z.object({
  version: z.string().min(3).max(32).regex(
    /^v\d+\.\d+$/,
    'version debe tener formato v<major>.<minor> (ej. v1.0)',
  ),
  texto: z.string().min(1).max(50000),
  activa: z.boolean().optional().default(true),
  fecha_vigencia_fin: z.string().datetime().nullable().optional(),
  creado_por: z.string().max(128).optional(),
  kair_version: z.string().max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * POST /internal/admin/acuerdo-versiones
 * Crea una nueva versión del Acuerdo de uso.
 */
router.post('/acuerdo-versiones',
  adminApiAuth(),
  validateBody(createAcuerdoVersionBody),
  (req, res, next) => {
    try {
      const result = agreementService.createVersion({
        version: req.body.version,
        texto: req.body.texto,
        activa: req.body.activa,
        fecha_vigencia_fin: req.body.fecha_vigencia_fin,
        creado_por: req.body.creado_por,
        kair_version: req.body.kair_version,
        metadata: req.body.metadata,
      });

      logger.info('Versión de Acuerdo publicada vía admin', {
        version: result.version,
        activa: result.activa === 1,
        desactivadas: result.desactivadas,
        ip: req.ip,
      });

      res.status(201).json({
        version: result.version,
        texto_hash: result.texto_hash,
        activa: result.activa === 1,
        fecha_vigencia_inicio: result.fecha_vigencia_inicio,
        fecha_vigencia_fin: result.fecha_vigencia_fin,
        creado_por: result.creado_por,
        kair_version: result.kair_version,
        fecha_creacion: result.fecha_creacion,
        desactivadas: result.desactivadas,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
