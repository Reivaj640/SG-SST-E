/**
 * Rutas admin para per-company clients (D-13, I-010, AUD-04).
 *
 * Endpoints protegidos por X-Admin-API-Key (mismo mecanismo que
 * /internal/admin/acuerdo-versiones).
 *
 * Ver storage-backup/specs/backend-auth-spec.md §3 para el contrato
 * exacto, y §16 para las decisiones ratificadas (DR-1 a DR-6).
 *
 * Decisiones de implementación (DR-1 a DR-6, binding):
 *  - DR-1: estos endpoints los llama el BRIDGE de K+AIR (no el renderer,
 *    no el operador humano). El backend expone el endpoint.
 *  - DR-2: auth con X-Admin-API-Key contra config.auth.adminApiKey.
 *  - DR-5: prefijo `kair_live_/kair_test_` elegido según config.env
 *    (NO configurable).
 *  - DR-6.A: el bridge envía `description` ya formateado. El backend solo
 *    lo persiste tal cual llega.
 *  - DR-6.B: el bridge siempre envía los 5 ops. Si llegan menos, WARN
 *    loggeado y aceptar.
 *  - DR-6.C: si la empresa ya tiene cliente activo → 409 CLIENT_EXISTS_FOR_EMPRESA.
 *  - DR-6.D: GET filtra exacto por id_empresa, y la rotación limpia el
 *    cache de getActiveClientByApiKey.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const logger = require('../utils/logger');
const internalClient = require('../services/internalClient');
const {
  createClientBody,
  listClientsQuery,
  idEmpresaParam,
  rotateClientBody,
  ALLOWED_OPS,
} = require('../schemas/admin-clientes');
const { AppError } = require('../middleware/errors');

/**
 * Validador de query params reutilizable. Envuelve zod.safeParse en
 * un try/catch para que errores de validación produzcan 400 con el
 * formato estándar de error.
 */
function _parseQuery(schema, raw) {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issues = r.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    throw new AppError(400, 'INVALID_REQUEST_BODY',
      'Los query params no cumplen el schema', { issues });
  }
  return r.data;
}

// ============================================================================
// 1. POST /internal/admin/clientes
//    Crea un per-company client.
//    Spec §3.1.
// ============================================================================
router.post('/clientes',
  adminApiAuth(),
  validateBody(createClientBody),
  (req, res, next) => {
    try {
      const result = internalClient.createPerCompanyClient({
        id_empresa: req.body.id_empresa,
        allowed_operations: req.body.allowed_operations,
        description: req.body.description,
      });

      logger.info('POST /internal/admin/clientes OK', {
        id_empresa: result.id_empresa,
        api_key_hash_prefix: result.api_key_hash_prefix,
        allowed_operations: result.allowed_operations,
      });

      // Devolver 201 con el api_key EN PLAINTEXT (única vez).
      res.status(201).json({
        id_empresa: result.id_empresa,
        api_key: result.api_key,
        api_key_hash_prefix: result.api_key_hash_prefix,
        allowed_operations: result.allowed_operations,
        description: result.description,
        created_at: result.created_at,
        message: 'API key generada. Guárdala AHORA: no se mostrará de nuevo.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// 2. GET /internal/admin/clientes
//    Lista per-company clients (con filtros).
//    Spec §3.2.
// ============================================================================
router.get('/clientes',
  adminApiAuth(),
  (req, res, next) => {
    try {
      const parsed = _parseQuery(listClientsQuery, req.query);
      const result = internalClient.listClients({
        id_empresa: parsed.id_empresa || null,
        include_revoked: parsed.include_revoked,
        limit: parsed.limit,
        offset: parsed.offset,
      });

      logger.info('GET /internal/admin/clientes', {
        filters: {
          id_empresa: parsed.id_empresa || null,
          include_revoked: parsed.include_revoked,
          limit: parsed.limit,
          offset: parsed.offset,
        },
        count: result.items.length,
      });

      res.status(200).json({
        total: result.total,
        limit: parsed.limit,
        offset: parsed.offset,
        items: result.items,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// 3. GET /internal/admin/clientes/:id
//    Devuelve el cliente ACTIVO de la empresa `:id`.
//    NUNCA expone el hash completo. Si no hay cliente activo → 404.
// ============================================================================
router.get('/clientes/:id',
  adminApiAuth(),
  (req, res, next) => {
    try {
      const idParse = idEmpresaParam.safeParse(req.params.id);
      if (!idParse.success) {
        const issues = idParse.error.issues.map(i => ({
          path: 'id', message: i.message, code: i.code,
        }));
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'Path param id inválido', { issues });
      }
      const id_empresa = idParse.data;
      const include_revoked = req.query.include_revoked === 'true';

      // Si include_revoked=true, devolver todos los del id_empresa.
      // Si no, solo el activo.
      const result = internalClient.listClients({
        id_empresa,
        include_revoked,
        limit: 200,
        offset: 0,
      });

      if (result.items.length === 0) {
        // Distinguir entre "no hay clientes nunca" vs "solo hay revocados".
        const all = internalClient.listClients({
          id_empresa, include_revoked: true, limit: 1, offset: 0,
        });
        if (all.total === 0) {
          throw new AppError(404, 'CLIENT_NOT_FOUND',
            'No existe un cliente para esta empresa.',
            { id_empresa, hint: 'Use POST /internal/admin/clientes para crear uno.' },
          );
        }
        // Hay historial pero ninguno activo.
        throw new AppError(404, 'CLIENT_NOT_FOUND',
          'No hay un cliente activo para esta empresa (solo historial de revocados).',
          {
            id_empresa,
            hint: 'Use POST /internal/admin/clientes/:id/rotate para rotar uno nuevo.',
          },
        );
      }

      // Si el cliente activo es único, devolver el primero (siempre será
      // el activo por orden created_at DESC).
      // Con include_revoked=true podría haber varios; en ese caso
      // devolvemos todos (history).
      logger.info('GET /internal/admin/clientes/:id', {
        id_empresa,
        count: result.items.length,
      });

      // Convención: si el cliente activo es único y no se pidió
      // include_revoked, devolver el objeto solo (no envuelto en items).
      // Si include_revoked=true, devolver {total, items}.
      if (!include_revoked) {
        res.status(200).json(result.items[0]);
      } else {
        res.status(200).json({
          total: result.total,
          items: result.items,
        });
      }
    } catch (err) {
      next(err);
    }
  },
);

// ============================================================================
// 4. POST /internal/admin/clientes/:id/rotate
//    Rota la API key del cliente activo de la empresa `:id`.
//    Spec §3.3. Transacción atómica, sin grace period en v1.
// ============================================================================
router.post('/clientes/:id/rotate',
  adminApiAuth(),
  (req, res, next) => {
    try {
      // Validar path param.
      const idParse = idEmpresaParam.safeParse(req.params.id);
      if (!idParse.success) {
        const issues = idParse.error.issues.map(i => ({
          path: 'id', message: i.message, code: i.code,
        }));
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'Path param id inválido', { issues });
      }
      // Validar body (opcional, defaults via zod).
      const bodyParse = rotateClientBody.safeParse(req.body || {});
      if (!bodyParse.success) {
        const issues = bodyParse.error.issues.map(i => ({
          path: i.path.join('.'), message: i.message, code: i.code,
        }));
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'El body de la request no cumple el schema', { issues });
      }
      const id_empresa = idParse.data;
      const { motivo, actor } = bodyParse.data;

      const result = internalClient.rotateClientByEmpresa(id_empresa, {
        motivo,
        actor,
      });

      logger.info('POST /internal/admin/clientes/:id/rotate OK', {
        id_empresa: result.id_empresa,
        old_api_key_hash_prefix: result.old_api_key_hash_prefix,
        new_api_key_hash_prefix: result.api_key_hash_prefix,
        motivo,
        actor,
      });

      res.status(200).json({
        id_empresa: result.id_empresa,
        old_api_key_hash_prefix: result.old_api_key_hash_prefix,
        new_api_key: result.api_key,
        new_api_key_hash_prefix: result.api_key_hash_prefix,
        allowed_operations: result.allowed_operations,
        description: result.description,
        rotated_at: result.rotated_at,
        motivo: result.motivo,
        actor: result.actor,
        message:
          'API key rotada. La key anterior fue revocada. Guarda la nueva: no se mostrará de nuevo.',
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
// Exportado para tests si lo necesitan.
module.exports._ALLOWED_OPS = ALLOWED_OPS;
