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
const auditoriaService = require('../services/empresaAuditoria');
const {
  idEmpresa,
  createEmpresaBody,
  updateEmpresaBody,
  anexoBody,
  setActivoBody,
} = require('../schemas/admin-empresas');
const { AppError } = require('../middleware/errors');

/**
 * Arma el contexto de auditoria de un request admin.
 *
 * `adminApiAuth()` SOLO dice "esta peticion viene con la API key administrativa":
 * no dice quien la hizo. Para que el rastro de la ficha tenga un "quien" real,
 * el operador puede declarar el actor con el header `X-Admin-Actor` (quien
 * firma el cambio) y el motivo con `X-Admin-Motivo`. Si no se declara nada,
 * el rastro queda con `admin` como actor: el cambio sigue siendo visible (que
 * es lo que el abogado exige: "sin el, el override no deja rastro"), pero no
 * se le atribuye a una persona.
 *
 * El motivo va en HEADER y no en el body a proposito: el body de `PUT
 * /empresas/:id` es un REEMPLAZO de la ficha, y meter el motivo ahi lo
 * contaminaria (el service no lo reconoceria como campo de la Empresa).
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
// Actualiza la identificacion. Cada campo que REALMENTE cambia queda
// rastreado (migraciones 037 y 038): como este PUT es un reemplazo completo,
// un guardado de escritorio puede pisar un canal de PQRS declarado por via
// administrativa, y el abogado exige que ese override deje rastro.
// ============================================================================
router.put('/empresas/:id_empresa', adminApiAuth(), validateBody(updateEmpresaBody), (req, res, next) => {
  try {
    const id = _parseId(req);
    const actualizada = empresaService.update(id, req.body, _contextoAuditoria(req));
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/empresas/:id_empresa/historial
// El rastro de los cambios de la ficha, del mas reciente al mas antiguo.
//
// Es el endpoint que responde "de donde salio este canal": quien lo cambio,
// cuando, desde donde, por que, y de que valor a que valor.
// ============================================================================
router.get('/empresas/:id_empresa/historial', adminApiAuth(), (req, res, next) => {
  try {
    const id = _parseId(req);
    const limiteRaw = req.query.limite;
    let limite = 200;
    if (limiteRaw !== undefined) {
      const n = Number(limiteRaw);
      if (!Number.isInteger(n) || n <= 0 || n > 1000) {
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'limite debe ser un entero entre 1 y 1000');
      }
      limite = n;
    }
    res.json({ items: auditoriaService.historial(id, { limite }) });
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
    const empresa = empresaService.marcarAnexoFirmado(id, req.body.fecha, _contextoAuditoria(req));
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
    const empresa = empresaService.setActivo(id, req.body.activo, _contextoAuditoria(req));
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