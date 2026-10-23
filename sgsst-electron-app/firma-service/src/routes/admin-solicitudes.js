/**
 * Rutas administrativas de las SOLICITUDES DE LOS TITULARES (el 10.7(b)).
 *
 * - GET    /internal/admin/solicitudes              lista (filtro por estado)
 * - GET    /internal/admin/solicitudes/:id          una solicitud + su historial
 * - POST   /internal/admin/solicitudes/:id/trasmitir  K+AIR la remite a la Empresa
 * - POST   /internal/admin/solicitudes/:id/responder   la Empresa (Responsable)
 *                                                    responde y K+AIR la devuelve
 *
 * Auth: X-Admin-API-Key (operador humano). NO se expone a K+AIR: K+AIR no
 * resuelve derechos, solo los registra y los trasmite.
 *
 * Ver API.md y el numeral 10.7(b) del Acuerdo.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const solicitudes = require('../services/solicitudes');

/**
 * Body de la respuesta de la Empresa.
 *
 * `copia_atendida` es obligatorio para las solicitudes de tipo COPIA: el 8.5
 * dice que la copia se conserva aunque el enlace haya expirado, así que una
 * copia no se cierra sin que la Empresa declare que la atendió.
 */
function _respuestaBody(req) {
  const respuesta = req.body && req.body.respuesta;
  const evidencia = req.body && req.body.evidencia;
  return {
    actor: (req.body && req.body.actor) || 'empresa',
    respuesta,
    evidencia: evidencia && typeof evidencia === 'object' ? evidencia : null,
    copia_atendida: (req.body && req.body.copia_atendida) === true,
  };
}

/**
 * Body del traspaso a la Empresa.
 */
function _trasmitirBody(req) {
  return {
    actor: (req.body && req.body.actor) || 'kair',
    id_empresa: req.body && req.body.id_empresa,
    canal_empresa: req.body && req.body.canal_empresa,
    evidencia: req.body && req.body.evidencia && typeof req.body.evidencia === 'object'
      ? req.body.evidencia
      : null,
  };
}

// GET /solicitudes ---------------------------------------------------------
router.get('/solicitudes', adminApiAuth(), (req, res, next) => {
  try {
    const items = solicitudes.listar({
      estado: req.query.estado,
      limit: req.query.limit,
    });
    logger.info('GET /internal/admin/solicitudes', {
      total: items.length,
      estado: req.query.estado || null,
    });
    res.json({ items, total: items.length });
  } catch (err) {
    next(err);
  }
});

// GET /solicitudes/:id -----------------------------------------------------
router.get('/solicitudes/:id', adminApiAuth(), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const item = solicitudes.obtener(id);
    if (!item) {
      return res.status(404).json({
        error: {
          code: 'SOLICITUD_NOT_FOUND',
          message: 'La solicitud no existe',
          request_id: req.id,
        },
      });
    }
    res.json({ ...item, eventos: solicitudes.eventos(id) });
  } catch (err) {
    next(err);
  }
});

// POST /solicitudes/:id/trasmitir -----------------------------------------
router.post('/solicitudes/:id/trasmitir', adminApiAuth(), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actualizada = solicitudes.trasmitir(id, _trasmitirBody(req));
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// POST /solicitudes/:id/responder -----------------------------------------
router.post('/solicitudes/:id/responder', adminApiAuth(), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actualizada = solicitudes.responder(id, _respuestaBody(req));
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
