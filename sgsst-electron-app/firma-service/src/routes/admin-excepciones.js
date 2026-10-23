/**
 * Rutas admin de las excepciones de habilitacion (D-03, decision B.3).
 *
 * Endpoints protegidos por X-Admin-API-Key, igual que el resto de
 * /internal/admin. NO son expuestos a K+AIR: son de operador humano.
 *
 * POR QUE EXISTE
 * --------------
 * La Empresa tiene que estar habilitada para pedir firmas (el Anexo de
 * Encargo firmado y el canal de PQRS). Si falta una de las dos, la firma se
 * BLOQUEA. La unica salida es una excepcion, y la excepcion no puede ser un
 * `if` silencioso: es una fila con la autorizacion escrita, el alcance, el
 * plazo y una bitacora que no se altera.
 *
 * Estas rutas son el modo de crear esa excepcion. Cada creacion y cada uso
 * quedan en `gh_firma_excepciones_habilitacion_eventos` (append-only,
 * migracion 036).
 *
 * Endpoints:
 *   GET    /internal/admin/excepciones-habilitacion          lista
 *   GET    /internal/admin/excepciones-habilitacion/:id      una + bitacora
 *   POST   /internal/admin/excepciones-habilitacion          crear
 *   POST   /internal/admin/excepciones-habilitacion/:id/cerrar  cerrar
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const logger = require('../utils/logger');
const excepcionService = require('../services/excepcionHabilitacion');
const { AppError } = require('../middleware/errors');
const { crearExcepcionBody, cerrarExcepcionBody } = require('../schemas/admin-excepciones');

/**
 * El id de la excepcion. Es un entero autoincremental; se valida aqui para
 * no pasarle un NaN al service.
 */
function _parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'INVALID_REQUEST_BODY', 'id de excepcion invalido');
  }
  return id;
}

// ============================================================================
// GET /internal/admin/excepciones-habilitacion
// ============================================================================
router.get('/excepciones-habilitacion', adminApiAuth(), (req, res, next) => {
  try {
    const id_empresa = req.query.id_empresa ? String(req.query.id_empresa).trim() : null;
    res.json({ items: excepcionService.listar({ id_empresa }) });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/excepciones-habilitacion/:id
// La excepcion CON su bitacora: sin la bitacora, la excepcion no es
// auditable, y la excepcion sin auditoria no es la salida del bloqueo.
// ============================================================================
router.get('/excepciones-habilitacion/:id', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const excepcion = excepcionService.listar().find((e) => e.id === id);
    if (!excepcion) {
      throw new AppError(404, 'NOT_FOUND', 'La excepcion no existe', { id });
    }
    res.json({
      excepcion,
      eventos: excepcionService.eventosDe(id),
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/excepciones-habilitacion
// Crea la excepcion. El service valida las seis condiciones del abogado y
// REChaza la que no las cumple: el endpoint no es el que decide.
// ============================================================================
router.post('/excepciones-habilitacion', adminApiAuth(), validateBody(crearExcepcionBody), (req, res, next) => {
  try {
    const { excepcion, evento } = excepcionService.crear({
      id_empresa: req.body.id_empresa,
      autorizado_por: req.body.autorizado_por,
      autorizacion_fecha: req.body.autorizacion_fecha,
      autorizacion_ref: req.body.autorizacion_ref,
      alcance_firmas_max: req.body.alcance_firmas_max,
      ruta_papel: req.body.ruta_papel,
      ruta_papel_operativa: req.body.ruta_papel_operativa,
      plazo_hasta: req.body.plazo_hasta,
      piloto_autorizado: req.body.piloto_autorizado,
      piloto_autorizado_por: req.body.piloto_autorizado_por || null,
      motivo: req.body.motivo,
      actor: 'admin',
      ip: req.ip,
      user_agent: req.get('User-Agent') || null,
    });
    logger.warn('Excepcion de habilitacion creada por admin', {
      excepcion_id: excepcion.id,
      id_empresa: excepcion.id_empresa,
      alcance_firmas_max: excepcion.alcance_firmas_max,
      plazo_hasta: excepcion.plazo_hasta,
    });
    res.status(201).json({ excepcion, evento });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/excepciones-habilitacion/:id/cerrar
// ============================================================================
router.post('/excepciones-habilitacion/:id/cerrar', adminApiAuth(), validateBody(cerrarExcepcionBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const { excepcion, evento } = excepcionService.cerrar({
      id,
      actor: 'admin',
      motivo: req.body.motivo,
      ip: req.ip,
      user_agent: req.get('User-Agent') || null,
    });
    res.json({ excepcion, evento });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
