/**
 * ORÁCULO DE VERIFICACIÓN DE IDENTIDAD (ruta interna)
 * ===================================================
 *
 * POST /internal/verificacion-identidad
 *
 * La Empresa que registró un documento de identidad puede preguntar si ese
 * documento es el mismo con el que firmó el trabajador, SIN apartar el
 * número en claro: se lo manda al servicio, que ya tiene la huella
 * archivada, y recibe un sí o un no.
 *
 * Ver `src/services/verificacion.js` para el detalle de las propiedades
 * (booleano puro, no persistencia del documento, 404 silencioso entre
 * empresas, respuesta en tiempo constante).
 *
 * Auth: `requireEmpresaScopeAndLimit` con la operación `verificacion:identidad`
 * (X-Internal-API-Key per-empresa, I-010/D-13) más el rate limit propio del
 * oráculo.
 *
 * El modo legacy (llave global, sin `id_empresa`) NO puede usar el oráculo:
 * el ámbito de la empresa es parte de la derivación de la huella, así que
 * sin empresa no hay nada que comparar. Se responde 403 con un código
 * explícito en vez de un 404 que no significaría nada.
 */
'use strict';

const express = require('express');
const { z } = require('zod');
const router = express.Router();

const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../middleware/errors');
const { oracleLimiter } = require('../middleware/rateLimit');
const verificacionService = require('../services/verificacion');
const signRequestService = require('../services/signRequest');
const logger = require('../utils/logger');

// Tipos de documento de IDENTIFICACIÓN del firmante. Es la misma lista que
// usa el alta de la firma (`identificacion_tipo`).
const TIPOS_DOCUMENTO_IDENTIDAD = ['CC', 'CE', 'TI', 'PPT', 'PA'];

const verificacionBody = z.object({
  id_solicitud: z.string()
    .regex(/^SIGN-\d{4}-\d{6}$/, 'id_solicitud debe tener el formato SIGN-YYYY-NNNNNN'),
  tipo_identificacion: z.enum(TIPOS_DOCUMENTO_IDENTIDAD),
  numero_documento: z.string()
    .min(4, 'numero_documento es demasiado corto')
    .max(32, 'numero_documento es demasiado largo')
    // Solo caracteres de documento de identidad. Esto no es un capricho
    // cosmético: el valor viaja a los logs, y un documento con saltos de
    // línea o caracteres de control puede romper el log o inyectar líneas
    // falsas. El documento se descarta después; lo que queda es su huella.
    .regex(/^[A-Za-z0-9.\-]+$/, 'numero_documento contiene caracteres no válidos'),
}).strict();

/**
 * POST /internal/verificacion-identidad
 *
 * - 401 si falta o es incorrecta la X-Internal-API-Key
 * - 403 si el cliente no tiene la operación `verificacion:identidad`, o si
 *      está en modo legacy (sin empresa: no hay ámbito con el que derivar)
 * - 400 si el body no cumple el esquema
 * - 404 si la firma no existe para esa empresa (mismo 404 si es de otra)
 * - 429 si se excede el rate limit del oráculo
 * - 200 `{ ok: true, id_solicitud, coincide }` — el booleano es todo
 */
router.post('/verificacion-identidad',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['verificacion:identidad'],
  }),
  oracleLimiter,
  validateBody(verificacionBody),
  (req, res, next) => {
    try {
      const { id_solicitud, tipo_identificacion, numero_documento } = req.body;

      // El modo legacy no tiene empresa. Como el ámbito de la empresa es
      // parte de la derivación de la huella, la comparación no se puede
      // hacer: responder 404 sería mentir (la fila puede existir).
      if (!req.id_empresa) {
        throw new AppError(
          403,
          'EMPRESA_SCOPE_REQUIRED',
          'El oráculo de verificación requiere una API key per-empresa (modo legacy no soportado)',
          { auth_source: req.authSource }
        );
      }

      const id_empresa = req.id_empresa;
      const ip = req.ip;
      const user_agent = req.get('User-Agent') || null;

      // El fingerprint se calcula ANTES de consultar: si la fila no existe,
      // el 404 también queda registrado en el log de anomalías (alguien
      // preguntando por firmas que no son suyas es exactamente lo que hay
      // que ver).
      const fingerprint = verificacionService.fingerprintDocumento(
        numero_documento,
        id_empresa
      );

      let resultado;
      try {
        resultado = verificacionService.verificarIdentidad({
          id_solicitud,
          tipo_identificacion,
          numero_documento,
          id_empresa,
        });
      } catch (err) {
        // 404 silencioso: la firma no existe PARA ESTA EMPRESA. Puede no
        // existir en absoluto o ser de otra: el cliente no puede
        // distinguirlas, y este log tampoco lo dice.
        logger.warn('Oráculo de verificación: firma no encontrada para la empresa', {
          request_id: req.id,
          id_solicitud,
          id_empresa,
          documento_fingerprint: fingerprint,
          ip,
        });
        throw err;
      }

      // ─────────────────────────────────────────────────────────────────────
      // Registro del evento. El documento NO va en el metadata: solo el
      // resultado y el fingerprint, que sirve para detectar anomalías
      // (el mismo documento consultado contra muchas firmas).
      // ─────────────────────────────────────────────────────────────────────
      signRequestService.registerEvent(
        resultado.firma_id,
        'IDENTIDAD_VERIFICADA',
        {
          coincide: resultado.coincide,
          tipo_identificacion,
          documento_fingerprint: fingerprint,
          version_llave: resultado.version_llave,
          formato_coincidencia: resultado.formato_coincidencia,
        },
        `empresa:${id_empresa}`,
        ip,
        user_agent
      );

      // Log de operación. Sin el documento: solo su fingerprint.
      logger.info('Oráculo de verificación consultado', {
        request_id: req.id,
        id_solicitud,
        id_empresa,
        coincide: resultado.coincide,
        documento_fingerprint: fingerprint,
        ip,
      });

      // La respuesta es un booleano. Nada más: ni la huella, ni el estado
      // de la firma, ni el nombre, ni las fechas.
      res.status(200).json({
        ok: true,
        id_solicitud,
        coincide: resultado.coincide,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
