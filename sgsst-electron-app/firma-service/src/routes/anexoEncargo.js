/**
 * Rutas públicas de la SUSCRIPCIÓN DEL ANEXO DE ENCARGO.
 *
 * - GET  /anexo-encargo/documento              (el texto que se va a suscribir)
 * - GET  /anexo-encargo/:token                 (abre la pantalla de suscripción)
 * - GET  /api/anexo-encargo/:token             (contexto: empresa, versión, huella, §11)
 * - POST /api/anexo-encargo/:token/codigo      (pide el código de verificación)
 * - POST /api/anexo-encargo/:token/suscribir   (escribe el código, declara el §11 y suscribe)
 *
 * Es el MISMO contrato que las rutas del Anexo de Nube (`routes/anexoNube.js`),
 * con dos diferencias que no son de gusto:
 *
 * 1. **EL TEXTO SE SIRVE CON SU VERSIÓN Y SU HUELLA, Y LAS DOS TIENEN QUE
 *    COINCIDIR.** El Anexo de Nube tiene su versión fija en el código. El
 *    Anexo de Encargo se versiona por fecha y la declara el manifiesto legal
 *    (`legal-readiness.json` → `anexo_encargo`). Si el archivo del servidor no
 *    es EXACTAMENTE el que declara el manifiesto, hay dos textos: el que la
 *    Empresa leería y el que queda registrado. Eso es un fallo de despliegue,
 *    no un error de la Empresa: por eso la ruta se NIEGA a servir (503) en vez
 *    de entregar un texto cuya cabecera no describe sus bytes.
 * 2. **LA EMPRESA DECLARA LOS CINCO DATOS DEL §11 AL SUSCRIBIR.** El texto
 *    canónico se suscribe tal cual, con sus huecos; lo que la Empresa
 *    declara en la pantalla es lo que queda en su copia, en la evidencia y en
 *    el acta. El cuerpo de `suscribir` por eso lleva `datos_empresa`.
 *
 * EL TOKEN DE LA URL ES LA CREDENCIAL
 * -----------------------------------
 * Es un enlace de un solo uso, con caducidad, y en la base solo vive su
 * huella. El enlace NO habilita la firma: hace falta además el código de
 * verificación que llega al correo del firmante y la aceptación expresa.
 *
 * LO QUE ESTA RUTA NO DICE
 * -----------------------
 * Que la Empresa suscribió (fase 1) NO es lo mismo que el contrato esté
 * ejecutado: el Anexo de Encargo es bilateral y le falta la contrafirma de
 * K+AIR (fase 2, otra ruta y otro commit). Por eso la respuesta de
 * `suscribir` dice `contrafirmado: false`.
 */
'use strict';

const path = require('path');
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { validateBody } = require('../middleware/validate');
const { AppError } = require('../middleware/errors');
const anexoEncargoService = require('../services/anexoEncargo');

const PAGINA = path.join(__dirname, '..', '..', 'web', 'anexo-encargo', 'index.html');

// Pedir el código no lleva datos: el token de la URL ya dice a quién
// pertenece. El cuerpo vacío se acepta tal cual.
const codigoBody = z.object({}).strict();

/**
 * Los CINCO datos del §11 ("Datos de contacto de las partes").
 *
 * POR QUÉ NO SON OBLIGATORIOS EN EL ESQUEMA
 * ------------------------------------------
 * El esquema dice CÓMO se ven (texto, con su largo máximo) y el SERVICIO dice
 * SI están (los cinco, o no hay suscripción). Si el esquema exigiera los
 * cinco, un formulario con el NIT vacío devolvería un 400 genérico de zod en
 * vez del `DATOS_S11_INCOMPLETOS` que le dice a la Empresa qué le falta. El
 * servicio es la autoridad del §11; el esquema solo evita que le lleguen
 * cosas que no son texto.
 */
const datosS11Body = z.object({
  razon_social: z.string().trim().max(200).nullish(),
  nit: z.string().trim().max(60).nullish(),
  domicilio: z.string().trim().max(300).nullish(),
  correo: z.string().trim().max(254).nullish(),
  representante: z.string().trim().max(200).nullish(),
}).strict().nullish();

const suscribirBody = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, 'el código son 6 dígitos'),
  acepta: z.boolean({ required_error: 'acepta es requerido' }),
  datos_empresa: datosS11Body,
}).strict();

/**
 * GET /anexo-encargo/documento
 *
 * El texto del Anexo de Encargo, servido por el SERVICIO.
 *
 * POR QUÉ NO SE ENLAZA AL SITIO PÚBLICO
 * -------------------------------------
 * Lo que la Empresa suscribe tiene que ser EXACTAMENTE el archivo cuya huella
 * queda registrada. Si el enlace apuntara al sitio público, existirían dos
 * copias —la del servidor y la del sitio— y la Empresa podría leer una
 * mientras el servicio registra la huella de la otra. Servirlo desde acá
 * elimina esa diferencia: lo que se lee y lo que se suscribe son los MISMOS
 * bytes, cuya huella es la que el servicio calcula.
 *
 * Va ANTES de `/anexo-encargo/:token` a propósito: si fuera después, el
 * segmento "documento" se tomaría por un token de suscripción.
 */
router.get('/anexo-encargo/documento', (req, res, next) => {
  let modelo;
  try {
    // Si el archivo no está en el servidor, o el manifiesto no declara una
    // versión y una huella, esto lanza 503 con un mensaje claro: es un fallo
    // de despliegue, no un error de la Empresa.
    modelo = anexoEncargoService.modeloVigente();
  } catch (err) {
    return next(err);
  }

  // El archivo del servidor tiene que ser EXACTAMENTE el que declara el
  // manifiesto. Si no, la cabecera describiría un texto que no es el que se
  // está mandando: mejor no mandar nada (503) que mandar algo con la huella
  // de otro.
  if (!modelo.coincide) {
    return next(new AppError(503, 'ANEXO_ENCARGO_NO_DISPONIBLE',
      'El texto del Anexo de Encargo del servidor no corresponde al que declara el '
      + 'manifiesto legal: no se puede abrir una suscripción'));
  }

  res.set({
    'X-Content-Type-Options': 'nosniff',
    // El texto es el de la versión vigente: si cambia, el servicio lo dice
    // en la cabecera y la suscripción queda anulada (TEXTO_MODIFICADO).
    'X-Anexo-Encargo-Version': modelo.version,
    'X-Anexo-Encargo-Hash': modelo.hash,
    'Cache-Control': 'no-cache',
  });
  res.sendFile(anexoEncargoService.RUTA_MODELO, (err) => {
    if (err) next(err);
  });
});

/**
 * El CONTEXTO de la suscripción, en JSON.
 *
 * Es lo que le da a la pantalla los datos que muestra antes de pedir el
 * código: Empresa, versión, huella, firmante, correo, caducidad y los cinco
 * datos del §11 prellenados con la ficha.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function _contextoJson(req, res, next) {
  try {
    const ctx = anexoEncargoService.contextoPublico(
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
 * GET /anexo-encargo/:token
 *
 * El navegador pide HTML: se sirve la pantalla. El JS pide JSON con Accept
 * explícito y recibe el contexto.
 */
router.get('/anexo-encargo/:token', (req, res, next) => {
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
 * GET /api/anexo-encargo/:token
 *
 * La MISMA respuesta que la de arriba, pero SIEMPRE en JSON.
 *
 * POR QUÉ EXISTE ESTA RUTA Y NO SOLO LA OTRA
 * -----------------------------------------
 * El script de la pantalla (web/anexo-encargo/app.js) pide el contexto en
 * `/api/anexo-encargo/<token>`. La ruta `/anexo-encargo/<token>` decide entre
 * HTML y JSON según la cabecera `Accept`, así que depende de cómo llame el
 * cliente. Con dos rutas, cada una con una sola respuesta, el cliente deja
 * de tener que acertar la cabecera y el contrato queda escrito en un solo
 * lado.
 */
router.get('/api/anexo-encargo/:token', _contextoJson);

/** POST /api/anexo-encargo/:token/codigo */
router.post('/api/anexo-encargo/:token/codigo', validateBody(codigoBody), async (req, res, next) => {
  try {
    const r = await anexoEncargoService.solicitarCodigo(
      req.params.token, { ip: req.ip, user_agent: req.get('User-Agent') },
    );
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ ok: true, expira_en_segundos: r.expira_en_segundos });
  } catch (err) {
    next(err);
  }
});

/** POST /api/anexo-encargo/:token/suscribir */
router.post('/api/anexo-encargo/:token/suscribir', validateBody(suscribirBody), async (req, res, next) => {
  try {
    const r = await anexoEncargoService.suscribir(
      req.params.token,
      {
        otp: req.body.otp,
        acepta: req.body.acepta,
        // Los cinco datos del §11 que declara la Empresa. Lo que ella
        // declara es lo que queda: por eso van en el cuerpo de la
        // suscripción y no se leen de la ficha.
        datos_empresa: req.body.datos_empresa || undefined,
      },
      { ip: req.ip, user_agent: req.get('User-Agent') },
    );
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      ok: true,
      // Fase 1: la Empresa suscribió. El instrumento todavía NO está
      // ejecutado: le falta la contrafirma de K+AIR.
      firmado: true,
      version: r.version,
      hash: r.hash,
      firmado_at: r.firmado_at,
      contrafirmado: r.contrafirmado === true,
      ya_firmada: r.ya_firmada === true,
      // El acta: el documento que la Empresa descarga y K+AIR archiva en el
      // expediente. Su huella es la de SUS bytes, no la del texto firmado.
      acta: r.acta ? {
        hash: r.acta.hash,
        bytes: r.acta.bytes,
        url: `/api/anexo-encargo/${encodeURIComponent(req.params.token)}/acta`,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/anexo-encargo/:token/acta
 *
 * El acta de suscripción, en PDF. Es el documento que la Empresa guarda y
 * que K+AIR archiva en el expediente.
 *
 * Va por API (y no como un archivo de la carpeta estática) porque el token
 * es la credencial: sin él no se baja nada, y el archivo en el disco no se
 * expone por una ruta que se pueda adivinar.
 */
router.get('/api/anexo-encargo/:token/acta', (req, res, next) => {
  try {
    const acta = anexoEncargoService.obtenerActa(req.params.token);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${acta.filename}"`,
      'Content-Length': String(acta.bytes),
      // La huella del acta va en la cabecera: quien la descarga puede
      // contrastarla contra el registro sin abrir el archivo.
      'X-Anexo-Encargo-Acta-Hash': acta.hash || '',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(acta.buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
