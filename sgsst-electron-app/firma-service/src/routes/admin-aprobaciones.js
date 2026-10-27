/**
 * Rutas admin de las APROBACIONES DE PUBLICACION del Acuerdo (decision 1.f).
 *
 * Endpoints protegidos por X-Admin-API-Key, igual que el resto de
 * /internal/admin. NO son expuestos a K+AIR: son de operador humano.
 *
 * POR QUE EXISTE
 * --------------
 * Con el abogado quedo claro que aprobar el TEXTO y autorizar la PUBLICACION
 * son dos actos distintos. Como la version del Acuerdo se publica con una
 * sola llamada, sin esta ruta el que publicaba terminaba autorizandose a si
 * mismo: la publicacion era una promesa ("se aprobo") y no una barrera ("no se
 * publica sin autorizacion operativa con evidencia").
 *
 * El servicio (src/services/agreement.js) RECHAZA la publicacion si no
 * encuentra una aprobacion OPERATIVA registrada para esa version y para ESE
 * texto (su hash). Esta ruta es el unico camino para dejarla registrada.
 *
 * Endpoints:
 *   POST /internal/admin/aprobaciones-publicacion            registrar
 *   GET  /internal/admin/aprobaciones-publicacion?version=v1.1  listar
 */
'use strict';

const express = require('express');
const router = express.Router();
const { adminApiAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const logger = require('../utils/logger');
const aprobacionPublicacion = require('../services/aprobacionPublicacion');
const agreementService = require('../services/agreement');

const { z } = require('zod');

/**
 * El cuerpo del registro de una aprobacion.
 *
 * `hash` y `texto` son alternativas: si viene el TEXTO, el hash lo calcula el
 * servidor (el cliente nunca decide de que texto se trata). Si viene el hash,
 * tiene que ser el SHA-256 del texto aprobado.
 */
const registrarAprobacionBody = z.object({
  version: z.string().regex(/^v\d+\.\d+$/, 'La versión debe tener el formato v<major>.<minor>'),
  hash: z.string().regex(/^[0-9a-fA-F]{64}$/, 'El hash debe ser un SHA-256 en hexadecimal')
    .optional(),
  texto: z.string().min(1).max(50000).optional(),
  tipo: z.enum(['JURIDICA', 'OPERATIVA']),
  aprobado_por: z.string().min(1).max(128),
  fecha: z.string().min(1).max(40),
  garantia: z.string().max(4000).optional(),
  resultado_verificaciones: z.string().max(4000).optional(),
  responsable_despliegue: z.string().max(128).optional(),
  notas: z.string().max(4000).optional(),
}).refine((d) => Boolean(d.hash || d.texto), {
  message: 'Falta la huella del texto aprobado: mandá el texto o su hash SHA-256',
  path: ['hash'],
});

// ============================================================================
// POST /internal/admin/aprobaciones-publicacion
// ============================================================================
router.post('/aprobaciones-publicacion', adminApiAuth(), validateBody(registrarAprobacionBody), (req, res, next) => {
  try {
    const aprobacion = aprobacionPublicacion.registrar({
      version: req.body.version,
      hash: req.body.hash,
      texto: req.body.texto,
      tipo: req.body.tipo,
      aprobado_por: req.body.aprobado_por,
      fecha: req.body.fecha,
      garantia: req.body.garantia,
      resultado_verificaciones: req.body.resultado_verificaciones,
      responsable_despliegue: req.body.responsable_despliegue,
      notas: req.body.notas,
    });
    logger.info('Aprobación de publicación registrada por la vía admin', {
      version: aprobacion.version, tipo: aprobacion.tipo,
    });
    res.status(201).json({ ok: true, aprobacion });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// GET /internal/admin/aprobaciones-publicacion?version=v1.1
// ============================================================================
router.get('/aprobaciones-publicacion', adminApiAuth(), (req, res, next) => {
  try {
    const version = req.query.version ? String(req.query.version).trim() : null;
    const items = aprobacionPublicacion.listar(version);
    // La huella del texto de la version (si esa version ya existe) va en la
    // respuesta: es lo que el operador necesita para registrar la aprobacion
    // sin calcular el SHA-256 a mano, y es lo que despues se compara al
    // publicar.
    const existente = version ? agreementService.getByVersion(version) : null;
    res.json({
      items,
      texto_hash_de_la_version: existente ? existente.texto_hash : null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
