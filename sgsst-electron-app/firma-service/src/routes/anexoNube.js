/**
 * Rutas públicas de la SUSCRIPCIÓN DEL ANEXO DE NUBE.
 *
 * - GET  /anexo-nube/documento                 (el texto que se va a suscribir)
 * - GET  /anexo-nube/:token                    (abre la pantalla de suscripción)
 * - GET  /api/anexo-nube/:token                (contexto: empresa, versión, huella)
 * - POST /api/anexo-nube/:token/codigo         (pide el código de verificación)
 * - POST /api/anexo-nube/:token/suscribir      (escribe el código y suscribe)
 *
 * El token de la URL es la credencial: es un enlace de un solo uso, con
 * caducidad, y en la base solo vive su huella. A diferencia de la firma del
 * Trabajador, aquí el enlace NO habilita la firma: hace falta además el
 * código de verificación que llega al correo del firmante.
 *
 * Ver API.md §5 (firma) y el §10 del Anexo de Nube v1.1.
 */
'use strict';

const path = require('path');
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { validateBody } = require('../middleware/validate');
const anexoNubeService = require('../services/anexoNube');

const PAGINA = path.join(__dirname, '..', '..', 'web', 'anexo-nube', 'index.html');

// Pedir el código no lleva datos: el token de la URL ya dice a quién
// pertenece. El cuerpo vacío se acepta tal cual.
const codigoBody = z.object({}).strict();

const suscribirBody = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'el código son 6 dígitos'),
  acepta: z.boolean({ required_error: 'acepta es requerido' }),
}).strict();

/**
 * GET /anexo-nube/documento
 *
 * El texto del Anexo de Nube, servido por el SERVICIO.
 *
 * POR QUÉ NO SE ENLAZA AL SITIO PÚBLICO
 * -------------------------------------
 * Lo que la Empresa firma tiene que ser EXACTAMENTE el archivo cuya huella
 * queda registrada. Si el enlace apuntara al sitio público, existirían dos
 * copias —la del servidor y la del sitio— y la Empresa podría leer una
 * mientras el servicio registra la huella de la otra. Servirlo desde acá
 * elimina esa diferencia: lo que se lee y lo que se firma son los MISMOS
 * bytes, cuya huella es la que el servicio calcula.
 *
 * Va ANTES de `/anexo-nube/:token` a propósito: si fuera después, el
 *Segmento "documento" se tomaría por un token de suscripción.
 */
router.get('/anexo-nube/documento', (req, res, next) => {
  let modelo;
  try {
    // Si el archivo no está en el servidor, esto lanza 503 con un mensaje
    // claro: es un fallo de despliegue, no un error de la Empresa.
    modelo = anexoNubeService.modeloVigente();
  } catch (err) {
    return next(err);
  }
  res.set({
    'X-Content-Type-Options': 'nosniff',
    // El texto es el de la versión vigente: si cambia, el servicio lo dice
    // en la cabecera y la suscripción queda anulada (TEXTO_MODIFICADO).
    'X-Anexo-Nube-Version': modelo.version,
    'X-Anexo-Nube-Hash': modelo.hash,
    'Cache-Control': 'no-cache',
  });
  res.sendFile(anexoNubeService.RUTA_MODELO, (err) => {
    if (err) next(err);
  });
});

/**
 * El CONTEXTO de la suscripción, en JSON.
 *
 * Es lo que le da a la pantalla los datos que muestra antes de pedir el
 * código: Empresa, versión, huella, firmante, correo y caducidad.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function _contextoJson(req, res, next) {
  try {
    const ctx = anexoNubeService.contextoPublico(
      req.params.token, req.ip, req.get('User-Agent'),
    );
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });
    res.json(ctx);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /anexo-nube/:token
 *
 * El navegador pide HTML: se sirve la pantalla. El JS pide JSON con Accept
 * explícito y recibe el contexto.
 */
router.get('/anexo-nube/:token', (req, res, next) => {
  if (req.accepts(['html', 'json']) === 'html') {
    return res.sendFile(PAGINA, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  }
  return _contextoJson(req, res, next);
});

/**
 * GET /api/anexo-nube/:token
 *
 * La MISMA respuesta que la de arriba, pero SIEMPRE en JSON.
 *
 * POR QUÉ EXISTE ESTA RUTA Y NO SOLO LA OTRA
 * -----------------------------------------
 * El script de la pantalla (web/anexo-nube/app.js) pide el contexto en
 * `/api/anexo-nube/<token>`. La ruta `/anexo-nube/<token>` decide entre HTML
 * y JSON según la cabecera `Accept`, así que depende de cómo llame el
 * cliente. Con dos rutas, cada una con una sola respuesta, el cliente deja
 * de tener que acertar la cabecera y el contrato queda escrito en un solo
 * lado.
 *
 * Sin esta ruta, la pantalla recibía un 404 y le mostraba a la Empresa
 * "[object Object]" en vez del mensaje del servicio.
 */
router.get('/api/anexo-nube/:token', _contextoJson);

/** POST /api/anexo-nube/:token/codigo */
router.post('/api/anexo-nube/:token/codigo', validateBody(codigoBody), async (req, res, next) => {
  try {
    const r = await anexoNubeService.solicitarCodigo(
      req.params.token, { ip: req.ip, user_agent: req.get('User-Agent') },
    );
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ ok: true, expira_en_segundos: r.expira_en_segundos });
  } catch (err) {
    next(err);
  }
});

/** POST /api/anexo-nube/:token/suscribir */
router.post('/api/anexo-nube/:token/suscribir', validateBody(suscribirBody), (req, res, next) => {
  try {
    const r = anexoNubeService.suscribir(
      req.params.token,
      { otp: req.body.otp, acepta: req.body.acepta },
      { ip: req.ip, user_agent: req.get('User-Agent') },
    );
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      ok: true,
      firmado: true,
      version: r.version,
      hash: r.hash,
      firmado_at: r.firmado_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
