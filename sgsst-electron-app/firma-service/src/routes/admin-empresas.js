/**
 * Rutas admin para la identificación de las empresas cliente (migración 017).
 *
 * Endpoints protegidos por X-Admin-API-Key, igual que
 * /internal/admin/acuerdo-versiones y /internal/admin/clientes. NO son
 * expuestos a K+AIR: son de operador humano.
 *
 * POR QUÉ EXISTE UN CRUD ADMIN Y NO LO PIDE EL CLIENTE
 * ----------------------------------------------------
 * El `id_empresa` ya lo manda el cliente autenticado (`req.id_empresa`, ver
 * middleware/authz.js). Lo que el cliente NO puede mandar son los datos que
 * le muestran al trabajador: si el puente pudiera declarar "la empresa X se
 * llama Y, tiene domicilio Z", un cliente comprometido podría suplantar la
 * identificación de otra empresa en la pantalla de firma. Por eso la
 * escritura es solo por admin.
 *
 * Endpoints:
 *   GET    /internal/admin/empresas            lista con pendientes
 *   GET    /internal/admin/empresas/:id        una empresa
 *   POST   /internal/admin/empresas            alta
 *   PUT    /internal/admin/empresas/:id        actualizar identidad
 *   POST   /internal/admin/empresas/:id/anexo-firmado
 *   POST   /internal/admin/empresas/:id/estado  alta/baja lógica
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const logger = require('../utils/logger');
const empresaService = require('../services/empresa');
const {
  idEmpresa,
  createEmpresaBody,
  updateEmpresaBody,
  anexoBody,
  setActivoBody,
} = require('../schemas/admin-empresas');
const { AppError } = require('../middleware/errors');

/**
 * Lee y valida el path param id_empresa con el mismo schema que se usa para
 * el body. Devuelve el string ya normalizado (trim).
 */
function _parseId(req) {
  const r = idEmpresa.safeParse(req.params.id_empresa);
  if (!r.success) {
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'id_empresa inválido', {
        issues: r.error.issues.map((i) => ({
          path: i.path.join('.'), message: i.message, code: i.code,
        })),
      });
  }
  return r.data;
}

// ============================================================================
// GET /internal/admin/empresas
// Devuelve todas las empresas con el detalle de qué les falta, para que el
// operador no de de alta una con la identificación a medias sin notarlo.
// ============================================================================
router.get('/empresas', adminApiAuth(), (req, res, next) => {
  try {
    res.json({ items: empresaService.listConPendientes() });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id
// ============================================================================
router.get('/empresas/:id_empresa', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.getById(id);
    if (!empresa) {
      throw new AppError(404, 'EMPRESA_NOT_FOUND',
        `No existe la empresa ${id}`, { id_empresa: id });
    }
    // Se incluye la huella que se archivará en cada firma, para que el
    // operador pueda confirmar que lo que está viendo es lo que se archiva.
    const snap = empresaService.buildSnapshot(id);
    res.json({
      ...empresa,
      huella_snapshot: snap ? snap.huella : null,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas
// ============================================================================
router.post('/empresas', adminApiAuth(), validateBody(createEmpresaBody), (req, res, next) => {
  try {
    const creada = empresaService.create(req.body);
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// PUT /internal/admin/empresas/:id_empresa
// ============================================================================
router.put('/empresas/:id_empresa', adminApiAuth(), validateBody(updateEmpresaBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const actualizada = empresaService.update(id, req.body);
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/anexo-firmado
// Registra la fecha de firma del Anexo de Encargo (art. 25 Decreto 1377/2013).
// Endpoint separado para que ese dato, que sustenta el cumplimiento legal,
// no se modifique en una actualización de rutina.
// ============================================================================
router.post('/empresas/:id_empresa/anexo-firmado', adminApiAuth(), validateBody(anexoBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.marcarAnexoFirmado(id, req.body.fecha);
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// POST /internal/admin/empresas/:id_empresa/estado
// Alta/baja lógica. Una empresa inactiva NO muestra bloque en la mini-app,
// pero sus consentimientos y firmas históricas se conservan intactos.
// ============================================================================
router.post('/empresas/:id_empresa/estado', adminApiAuth(), validateBody(setActivoBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const empresa = empresaService.setActivo(id, req.body.activo);
    logger.warn('Estado de empresa cambiado por admin', {
      id_empresa: id,
      activo: req.body.activo,
    });
    res.json(empresa);
  } catch (err) {
    next(err);
  }
});

module.exports = router;