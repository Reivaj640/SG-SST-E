/**
 * Rutas administrativas del REPORTE DE CARGA ACCIDENTAL DE DATOS DE SALUD
 * (el 10.8(d) del Acuerdo de uso).
 *
 * - POST /internal/admin/sign-requests/:id_solicitud/incidente-datos-sensibles
 *       Registra el reporte: bloquea la solicitud, la retiene, avisa a la
 *       Empresa por su canal de incidentes y deja el evento con la
 *       trazabilidad minima (el 3.6(g)).
 *
 * - POST /internal/admin/sign-requests/:id_solicitud/incidente-datos-sensibles/resolver
 *       Resuelve el reporte: libera el hold y deja el documento disponible
 *       para la via de supresion del 8.6.
 *
 * Auth: X-Admin-API-Key (operador humano). NO se expone a K+AIR: K+AIR no
 * resuelve derechos ni incidentes, los registra y los trasmite.
 *
 * POR QUE ES UNA RUTA ADMIN Y NO UNA DE LA EMPRESA
 * -------------------------------------------------
 * El 10.8(d)(iv) dice que K+AIR avisa a la Empresa por su canal de
 * incidentes: el aviso va de K+AIR a la Empresa. Quien registra el reporte
 * es el operador que lo detecta, y ese camino es el de la administracion
 * interna del servicio. Exponerlo por la API de la Empresa (que es la del
 * puente de escritorio) seria una decision de producto que no esta tomada:
 * por ahora el reporte entra por aqui.
 *
 * Ver API.md y el numeral 10.8(d) del Acuerdo.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const incidentes = require('../services/incidenteSalud');
const logger = require('../utils/logger');

/**
 * Body del reporte.
 *
 * - `reporta`: QUIEN reporta. Es lo que el 10.8(d)(iii) exige que quede en
 *   el evento. Si no viene, se usa el header `X-Admin-Actor` (el operador).
 * - `causa`: la causa invocada. Tambien va al evento.
 * - `medidas`: medidas que declara quien reporta (opcional).
 */
const reportarBody = z.object({
  reporta: z.string().min(1).max(200).optional(),
  causa: z.string().min(1).max(2000),
  medidas: z.array(z.string().min(1).max(500)).max(20).optional(),
}).strict();

/**
 * Body de la resolucion.
 *
 * - `resuelve`: QUIEN resuelve el reporte.
 * - `causa`: como se resolvio.
 */
const resolverBody = z.object({
  resuelve: z.string().min(1).max(200).optional(),
  causa: z.string().min(1).max(2000),
  medidas: z.array(z.string().min(1).max(500)).max(20).optional(),
}).strict();

/**
 * El operador que esta haciendo la operacion.
 *
 * Mismo criterio que `admin-empresas.js`: el header `X-Admin-Actor` declara
 * quien firma el cambio. Si no viene, queda `admin`: el cambio sigue siendo
 * visible, pero no se le atribuye a una persona.
 *
 * @param {object} req
 * @returns {string}
 */
function _actor(req) {
  const header = req.get('X-Admin-Actor');
  if (typeof header === 'string' && header.trim()) return header.trim().slice(0, 200);
  return 'admin';
}

// POST /sign-requests/:id_solicitud/incidente-datos-sensibles --------------
router.post('/sign-requests/:id_solicitud/incidente-datos-sensibles',
  adminApiAuth(),
  validateBody(reportarBody),
  async (req, res, next) => {
    try {
      const resultado = await incidentes.reportar({
        id_solicitud: req.params.id_solicitud,
        reporta: (req.body && req.body.reporta) || _actor(req),
        causa: req.body.causa,
        medidas: req.body.medidas,
        ip: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent') || null,
      });

      logger.warn('Reporte de carga accidental de datos de salud registrado via admin', {
        id_solicitud: resultado.id_solicitud,
        estado: resultado.estado,
        notificacion_enviada: resultado.notificacion.enviada,
        ip: req.ip,
      });

      res.status(201).json(resultado);
    } catch (err) {
      next(err);
    }
  },
);

// POST /sign-requests/:id_solicitud/incidente-datos-sensibles/resolver -----
router.post('/sign-requests/:id_solicitud/incidente-datos-sensibles/resolver',
  adminApiAuth(),
  validateBody(resolverBody),
  (req, res, next) => {
    try {
      const resultado = incidentes.resolver({
        id_solicitud: req.params.id_solicitud,
        resuelve: (req.body && req.body.resuelve) || _actor(req),
        causa: req.body.causa,
        medidas: req.body.medidas,
        ip: req.ip || req.socket?.remoteAddress || null,
        user_agent: req.get('User-Agent') || null,
      });

      logger.info('Reporte de carga accidental de datos de salud resuelto via admin', {
        id_solicitud: resultado.id_solicitud,
        hold_liberado: resultado.liberacion.liberado,
        ip: req.ip,
      });

      res.json(resultado);
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
