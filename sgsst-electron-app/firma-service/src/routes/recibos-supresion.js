/**
 * Rutas del RECIBO DE SUPRESIÓN (3.6(g) y 10.6).
 *
 * - GET /internal/empresas/:id_empresa/recibos-supresion
 *     Los recibos de supresión de la Empresa, del más reciente al más
 *     antiguo. Para que la Empresa se los entregue al Trabajador.
 * - GET /internal/recibos-supresion/:id_solicitud
 *     El recibo de UNA solicitud.
 *
 * POR QUÉ EXISTE
 * --------------
 * El 3.6(g): "da lugar a una lápida que identifica la solicitud, la fecha y
 * hora, las categorías suprimidas y el fundamento del plazo, y a un recibo
 * que la Empresa entrega al Trabajador si lo solicita".
 *
 * La evidencia (lápida + recibo) ya se guardaba; lo que NO existía era la
 * VÍA DE ENTREGA: nadie podía obtener el recibo para entregarlo. Sin esto, el
 * 3.6(g) se cumplía a medias: la supresión dejaba rastro, pero el Trabajador
 * no tenía cómo pedirlo y obtenerlo.
 *
 * A QUIÉN SE LE ENTREGA
 * ---------------------
 * A la Empresa. Es la Responsable del dato y la que se lo entrega al
 * Trabajador (el 10.7(e): el Titular acude primero a la Empresa). Por eso
 * las rutas son PER-EMPRESA: una Empresa consulta SUS recibos, no los de
 * otras. Cross-company devuelve 404 silencioso, como el resto del sistema:
 * no se revela la existencia de un recurso de otra empresa.
 *
 * QUÉ NO HAY EN EL RECIBO
 * -----------------------
 * Ningún dato personal: ni el correo del Trabajador, ni su documento, ni su
 * nombre, ni su firma. Solo identificadores internos, fechas, categorías y el
 * fundamento del plazo. Es la misma regla de la lápida y del recibo de
 * purgas, y por eso el service expone una lista EXPRESA de columnas.
 *
 * Ver API.md y el 3.6(g) del Acuerdo de uso.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { AppError } = require('../middleware/errors');
const reciboService = require('../services/reciboSupresion');
const logger = require('../utils/logger');

/**
 * La forma de `id_solicitud`. Misma expresión que usa el resto del servicio
 * para las solicitudes (routes/signRequest.js), para no tener dos formatos
 * de id en el mismo sistema.
 */
const RE_ID_SOLICITUD = /^SIGN-\d{4}-\d{6}$/;

// =============================================================================
// GET /internal/empresas/:id_empresa/recibos-supresion
// Los recibos de supresión de la Empresa.
// =============================================================================
router.get('/empresas/:id_empresa/recibos-supresion',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    // El id_empresa viene en el path: el check per-empresa lo puede hacer el
    // middleware (params.id_empresa).
    checkIdEmpresa: true,
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const idEmpresa = req.params.id_empresa;

      // El id_empresa viene en el PATH. El middleware (`checkIdEmpresa`)
      // ya responde 403 EMPRESA_MISMATCH si un cliente per-empresa pide el
      // path de otra. Esta guarda es la red de seguridad para el modo
      // legacy, donde el middleware no chequea: sin ella, una clave legacy
      // podría leer los recibos de otra empresa. No dice qué hay en la otra
      // empresa: dice que esa empresa no existe para quien pregunta.
      if (req.authSource === 'client' && idEmpresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'La empresa no existe',
            request_id: req.id,
          },
        });
      }

      const limiteRaw = req.query.limite;
      let limite = 100;
      if (limiteRaw !== undefined) {
        const n = Number(limiteRaw);
        if (!Number.isInteger(n) || n <= 0 || n > 500) {
          throw new AppError(400, 'INVALID_REQUEST_BODY',
            'limite debe ser un entero entre 1 y 500');
        }
        limite = n;
      }

      const items = reciboService.porEmpresa(idEmpresa, { limite });

      logger.info('Recibos de supresión consultados', {
        id_empresa: idEmpresa,
        total: items.length,
      });

      res.json({
        id_empresa: idEmpresa,
        total: items.length,
        items,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// GET /internal/recibos-supresion/:id_solicitud
// El recibo de UNA solicitud.
// =============================================================================
router.get('/recibos-supresion/:id_solicitud',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const { id_solicitud } = req.params;

      if (!RE_ID_SOLICITUD.test(id_solicitud)) {
        throw new AppError(400, 'INVALID_REQUEST_BODY',
          'id_solicitud debe tener el formato SIGN-YYYY-NNNNNN');
      }

      const recibo = reciboService.porSolicitud(id_solicitud);

      // No hay recibo: la solicitud no fue suprimida (todavía está viva, o
      // nunca se suprimió). Es un 404 como el de cualquier recurso que no
      // existe, y NO un 204: el que llama tiene que poder distinguir "no
      // hay recibo" de "sí lo hay" para poder decirlo al Trabajador.
      if (!recibo) {
        return res.status(404).json({
          error: {
            code: 'RECIBO_SUPERSION_NOT_FOUND',
            message: `No hay recibo de supresión para la solicitud ${id_solicitud}`,
            request_id: req.id,
          },
        });
      }

      // Cross-company: 404 silencioso.
      if (req.authSource === 'client' && recibo.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'RECIBO_SUPERSION_NOT_FOUND',
            message: `No hay recibo de supresión para la solicitud ${id_solicitud}`,
            request_id: req.id,
          },
        });
      }

      res.json(recibo);
    } catch (err) {
      next(err);
    }
  });

module.exports = router;
