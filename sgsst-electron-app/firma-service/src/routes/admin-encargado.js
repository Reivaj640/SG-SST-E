/**
 * Rutas admin del REGISTRO DE PODERES DEL ENCARGADO.
 *
 * Endpoints protegidos por X-Admin-API-Key, igual que
 * /internal/admin/empresas. NO son expuestos a K+AIR: son de operador humano.
 *
 * Endpoints:
 *   GET    /internal/admin/encargado/poderes           el registro, con su rastro
 *   POST   /internal/admin/encargado/poderes           alta de un poder
 *   POST   /internal/admin/encargado/poderes/:id/revocar  revocacion
 *
 * QUE SON ESTAS RUTAS Y POR QUE
 * -----------------------------
 * El abogado (respuesta a P7, 10-nov-2026) condiciono la contrafirma del
 * Anexo de Nube: "La ejecucion por una persona distinta del representante legal
 * de Gesstiar S.A.S. requerira acreditar previamente la facultad de
 * representacion o poder suficiente, que debera conservarse en el expediente".
 *
 * Estas rutas son el "previamente": el poder se registra ANTES del acto, con
 * su documento, su huella y su motivo, y queda en el expediente. La
 * contrafirma despues lo coteja y lo deja escrito en su acta.
 *
 * EL MOTIVO ES OBLIGATORIO
 * ------------------------
 * Va en la cabecera `X-Admin-Motivo`, como en el resto de los actos
 * administrativos: registrar un poder habilita a una persona a firmar por la
 * empresa, y un acto sin motivo no dice quien lo hizo ni por que.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const poderesService = require('../services/poderesEncargado');
const { registrarPoderBody } = require('../schemas/admin-encargado');
const { AppError } = require('../middleware/errors');

/**
 * Arma el contexto de auditoria de un request admin.
 *
 * Es el mismo criterio que `routes/admin-empresas.js`: la API key dice que
 * la peticion viene del canal administrativo, y el operador declara QUIEN es
 * (`X-Admin-Actor`) y POR QUE (`X-Admin-Motivo`).
 *
 * @param {object} req
 * @returns {{actor: string|null, motivo: string|null, ip: string|null, user_agent: string|null}}
 */
function _contextoAuditoria(req) {
  const actor = req.get('X-Admin-Actor');
  const motivo = req.get('X-Admin-Motivo');
  return {
    actor: typeof actor === 'string' && actor.trim() ? actor.trim().slice(0, 200) : null,
    motivo: typeof motivo === 'string' && motivo.trim() ? motivo.trim().slice(0, 500) : null,
    ip: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.get('User-Agent') || null,
  };
}

// ============================================================================
// GET /internal/admin/encargado/poderes
// El registro de poderes del Encargado, con su rastro.
//
// Incluye el representante legal declarado en el manifiesto legal: es el caso
// en el que NO hace falta ningun poder, y el operador tiene que verlo para
// saber si lo que busca ya esta resuelto.
// ============================================================================
router.get('/encargado/poderes', adminApiAuth(), (req, res, next) => {
  try {
    const poderes = poderesService.listarPoderes();
    res.json({
      items: poderes.map((p) => ({
        ...p,
        eventos: poderesService.eventosDePoder(p.id),
      })),
      representante_legal_encargado: poderesService.representanteLegalEncargado(),
      registro_disponible: poderesService.hayTabla(),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/encargado/poderes
// Registra un poder (o una delegacion) a nombre de una persona.
//
// NO habilita nada por si solo: habilita a esa persona para el ACTO de
// contrafirma, y solo si el poder esta vigente. Un poder vencido o revocado
// no sirve para nada.
// ============================================================================
router.post('/encargado/poderes', adminApiAuth(), validateBody(registrarPoderBody), (req, res, next) => {
  try {
    const creado = poderesService.registrarPoder(req.body, _contextoAuditoria(req));
    res.status(201).json(creado);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/encargado/poderes/:id/revocar
// Revoca un poder.
//
// NO borra la fila: la deja en REVOCADO con su fecha y su motivo, y escribe el
// evento. El expediente tiene que poder decir que hubo un poder vigente y que
// dejo de estarlo.
// ============================================================================
router.post('/encargado/poderes/:id/revocar', adminApiAuth(), (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError(400, 'INVALID_REQUEST_BODY', 'id de poder invalido');
    }
    const revocado = poderesService.revocarPoder(id, _contextoAuditoria(req));
    res.json(revocado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
