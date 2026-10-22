/**
 * Rutas públicas del flujo de firma.
 *
 * - GET  /s/:token                          (carga contexto público)
 * - POST /api/sign/:token/identify
 * - POST /api/sign/:token/verify-otp
 * - POST /api/sign/:token/consent/accept    (Bloque E6.5: 3ª casilla UI)
 * - POST /api/sign/:token/view-document
 * - GET  /api/sign/:token/document.pdf
 * - POST /api/sign/:token/commit
 * - POST /api/sign/:token/reject
 * - POST /api/solicitudes                     (10.7(b): el canal de datos de K+AIR)
 *
 * El token en la URL es la credencial (no se usa API key).
 *
 * Ver API.md §5.
 */
'use strict';

const path = require('path');
const express = require('express');
const router = express.Router();
const { validateBody } = require('../middleware/validate');
const { verifyLimiter } = require('../middleware/rateLimit');  // I-AUDIT-2026-09-10
const publicFlow = require('../services/publicFlow');
const signRequestService = require('../services/signRequest');
// La resolución del Acuerdo de uso vive en el servicio (publicFlow), para
// que la pantalla y la descarga (5.4) muestren SIEMPRE el mismo texto.
const empresaService = require('../services/empresa');
const storage = require('../services/storage');
const logger = require('../utils/logger');
const config = require('../config');
const { AppError } = require('../middleware/errors');

const { z } = require('zod');
const { resendOtpBody, consentSensibleBody } = require('../schemas');
const solicitudesService = require('../services/solicitudes');

// Ruta al HTML estático de la mini-app (resuelta desde SERVICE_ROOT)
const MINI_APP_HTML = path.resolve(__dirname, '..', '..', 'web', 'firma', 'index.html');

/**
 * Enmascara un correo para exposición pública: "jrf2011@live.com" → "jrf****@live.com".
 * Helper local (presentación); NO se importa de publicFlow.js para evitar
 * acoplamiento entre la ruta y la lógica de negocio.
 * Retorna '' si el correo es null/undefined/inválido.
 */
function _maskEmailPublico(email) {
  if (typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return local[0] + '****@' + domain;
  return local.slice(0, 2) + '****@' + domain;
}

const identifyBody = z.object({
  // D-2: el medio PERSONAL donde el Trabajador quiere recibir el código de
  // verificación (el dato de creación de la firma). Opcional: si no se
  // declara, el servicio usa el contacto registrado por la Empresa.
  correo_otp: z.string().max(254).optional(),
  // D-1 (I-002): rename tipo_documento → tipo_identificacion.
  // Es el tipo de documento de IDENTIFICACIÓN del firmante (CC, CE, TI,
  // PPT, PA). NO se debe confundir con el campo del sign request
  // `tipo_identificacion` (categoría del doc que se firma: CONTRATO, etc.).
  tipo_identificacion: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']),
  numero_documento: z.string().min(4).max(20).regex(/^\d+$/, 'Solo dígitos'),
});

const verifyOtpBody = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP debe ser 6 dígitos numéricos'),
});

const viewDocumentBody = z.object({
  segundos_en_pagina: z.number().int().min(0).max(3600).optional(),
  scroll_al_final: z.boolean(),
});

const commitBody = z.object({
  manifestacion_aceptada: z.literal(true),
  // NO se acepta `firma_visual_png`.
  //
  // Antes el esquema lo admitía y el servicio lo IGNORABA (no se guardaba, no
  // se incrustaba en el PDF, no entraba en la huella de evidencia): una
  // promesa falsa al cliente, y un dato que el Acuerdo no autoriza tratar.
  //
  // Motivo (dictamen legal del 2026-10-20): el 10.2 del Acuerdo es una lista
  // CERRADA de los datos que se tratan, y la firma autográfica es un dato de
  // carácter especial (art. 5 Ley 1581): su tratamiento exigiría aviso
  // previo, consentimiento expreso, categoría de retención y supresión
  // propias, y no aporta nada al 2.2.2.47.4 (el 47.4 exige que los DATOS DE
  // CREACIÓN sean del firmante y que se detecten alteraciones; eso lo hacen
  // las huellas SHA-256 del documento y de la constancia).
  //
  // Si algún día se quiere, el camino es: 10.2(i) + un 10.10 con el aviso y
  // el consentimiento expreso, y recién después el código.
  //
  // `.strict()`: sin él, zod BORRA la clave desconocida en silencio y el
  // cliente cree que envió su firma visual. Es el mismo modo de falla que
  // costó el `correo_empresa` del 8B. Con strict, el 400 nombra la clave.
}).strict();

const rejectBody = z.object({
  motivo: z.string().max(1000).optional(),
});

/**
 * Body de la SOLICITUD de un Titular (el 10.7(b)).
 *
 * Es el canal de datos de K+AIR: el mecanismo "sencillo, ágil y
 * permanentemente disponible" que el 2.2.2.25.4.2 del Decreto 1377 obliga
 * a mantener también al Encargado. No es el canal de la Empresa (que sigue
 * siendo el del 10.7 literal b): K+AIR NO resuelve, pero no puede ser un
 * punto ciego.
 */
// 9A (el 8.2): la modificacion de los medios autorizados.
const mediosBody = z.object({
  accion: z.enum(['ALTA', 'BAJA']).default('ALTA'),
  tipo: z.enum(['CORREO_OTP']).default('CORREO_OTP'),
  correo: z.string().max(254).optional(),
}).strict();

const solicitudBody = z.object({
  tipo: z.enum(solicitudesService.TIPOS),
  nombre: z.string().max(200).optional(),
  correo: z.string().email().max(254),
  // El documento del solicitante: se guarda como HUELLA, no en claro.
  documento: z.string().max(64).optional(),
  contenido: z.string().max(4000).optional(),
}).strict();

/**
 * GET /s/:token
 *
 * Bifurcación por Accept:
 *   - text/html: sirve la mini-app (index.html). El JS extrae el token del path
 *     y luego hace fetch con Accept: application/json para obtener el contexto.
 *   - application/json (o cualquier otro): devuelve el contexto público.
 *
 * Registrar OPENED solo cuando se devuelve el contexto JSON, NO en cada recarga
 * del HTML (sería ruido de auditoría).
 */
router.get('/s/:token', (req, res, next) => {
  // Si el cliente quiere HTML (navegador), servir la mini-app estática.
  // Importante: el JS hace fetch con Accept: application/json explícito.
  if (req.accepts(['html', 'json']) === 'html') {
    return res.sendFile(MINI_APP_HTML, {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    });
  }

  try {
    const { signRequest, estado } = publicFlow.resolveToken(req.params.token);
    publicFlow.registerOpenedIfFirst(signRequest, req.ip, req.get('User-Agent'));


    // Contexto mínimo para la mini-app. NO se exponen:
    //   - token_hash
    //   - identificacion_numero_hash
    //   - paths internos (pdf_original_path, etc.)
    //   - API keys
    //
    // El contexto NUNCA se cachea. Lleva datos del Firmante (seudónimo,
    // correo enmascarado) y cambia de estado en cada paso del flujo. Sin
    // estas cabeceras, el navegador guarda la respuesta JSON y al volver a
    // abrir el enlace entrega ese JSON crudo en vez de la mini-app: es el
    // mismo síntoma que corrigió I-LINK-REABIERTO para el enlace ya
    // firmado, y se repite cada vez que el Firmante vuelve al enlace.
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });
    res.json({
      id_solicitud: signRequest.id_solicitud,
      id_documento: signRequest.id_documento,
      id_trabajador: signRequest.id_trabajador,
      tipo_firma: signRequest.tipo_firma,
      estado: estado,
      fecha_expiracion: signRequest.fecha_expiracion,
      // Tipo de documento de IDENTIFICACIÓN del firmante (CC, CE, TI, PPT, PA).
      // Es lo que la mini-app muestra/usa para la pantalla de identify.
      identificacion_tipo: signRequest.identificacion_tipo,
      // I-002: categoría del documento QUE SE FIRMA (CONTRATO, OTROSI, ACTA, etc.).
      // La mini-app lo muestra como contexto ("Estás firmando un CONTRATO").
      // Puede ser null para sign requests legacy pre-migration 007.
      tipo_identificacion: signRequest.tipo_identificacion,
      // Texto del Acuerdo de uso que la mini-app debe MOSTRAR antes de que el
      // firmante marque la 3a casilla. Sin esto el backend archiva un
      // hash_texto_acuerdo de un documento que el firmante nunca pudo leer:
      // se registra una aceptacion sin que hubiera informacion.
      //
      // La resolución vive en el servicio (publicFlow.resolverAcuerdo) para
      // que la pantalla y la descarga del Acuerdo (5.4) muestren SIEMPRE el
      // mismo texto, no dos copias que pueden divergir.
      acuerdo: publicFlow.resolverAcuerdoVigente(signRequest),
      // FASE 6 · orden (g)/(h): si el Firmante YA aceptó el Acuerdo en una
      // visita anterior, la mini-app lo necesita para poder mostrar el
      // documento sin volver a pedir la aceptación. Con el Acuerdo sin
      // aceptar, el documento no se sirve (3.4(g) va antes de (h)).
      acuerdo_aceptado: publicFlow.acuerdoAceptado(signRequest),
      // 8B · El 10.8: si el documento contiene información de salud, el
      // Titular tiene que ser informado de manera EXPRESA Y PREVIA (qué
      // datos, con qué finalidad, con qué base legal) y otorgar su
      // consentimiento expreso en una casilla SEPARADA de la del Acuerdo.
      //
      // El texto del aviso viene FIJADO en la fila (con su huella): es
      // exactamente el que se le va a mostrar, y el que se archivará con la
      // prueba del consentimiento.
      dato_sensible: publicFlow.resolverDatoSensible(signRequest),
      // CAPÍTULO V · 5.1(c): el Firmante debe poder avisar a K+AIR si cree que
      // sus datos de creación de la firma (el OTP y el enlace de firma)
      // quedaron en entredicho. Los canales que muestra el bloque de la
      // Empresa son del cliente; este es el de K+AIR (Gesstiar S.A.S.).
      canal_incidentes_kair: config.canalIncidentes,
      // El canal de PROTECCIÓN DE DATOS de K+AIR (el 10.7(b)). Es DISTINTO
      // del de incidentes: uno es para avisar que se comprometieron los datos
      // de creación de la firma (5.1(c)); el otro es para ejercer los
      // derechos del Titular. K+AIR no los resuelve, pero no puede ser un
      // punto ciego: los recibe, los registra y los trasmite a la Empresa.
      canal_proteccion_datos_kair: config.canalProteccionDatos,
      // Identificación de la empresa que SOLICITA esta firma (migración 017).
      // Se resuelve por signRequest.id_empresa, NUNCA por algo que mande el
      // cliente: id_empresa viene de la API key autenticada y ya está
      // guardado en la fila de la solicitud.
      //
      // null = la empresa no está dada de alta en gh_firma_empresas. La
      // mini-app omite el bloque en ese caso, que es exactamente el
      // comportamiento previo a la 017.
      // 033 · Si la solicitud tiene un plazo propio (el que el sistema le
      // aplicó y congeló en la fila), el bloque muestra ESE plazo y no el
      // vivo de la tabla de la Empresa: es lo que se le comunicó al firmante
      // cuando se le pidió la firma. Las solicitudes anteriores a este
      // catálogo (sin plazo congelado) siguen mostrando el de la Empresa.
      //
      // El deber legal de la Empresa (sin término) NO se pisa: si la fila
      // tiene hold, se dice.
      empresa: empresaService.publicViewFor(
        signRequest.id_empresa,
        signRequest.plazo_retencion_aplicable
          ? Object.assign(
            { plazo_retencion: signRequest.plazo_retencion_aplicable },
            signRequest.hold_legal === 1
              ? {
                conservacion_por_deber_legal: true,
                norma_conservacion: signRequest.motivo_hold
                  ? String(signRequest.motivo_hold).replace(/^deber_legal_/, '')
                  : null,
              }
              : {}
          )
          : undefined
      ),
      // I-103.A1.6 · Correo enmascarado del firmante, para mostrar en la
      // pantalla OTP cuando el firmante re-abre el enlace y ya pasó por
      // identificación. Solo se expone si estado >= IDENTIFIED (después
      // de identificar); antes de eso, el firmante aún no ha confirmado
      // a qué correo se envió el OTP, así que no lo exponemos.
      correo_enmascarado: (estado === 'IDENTIFIED' ||
                           estado === 'OTP_SENT' ||
                           estado === 'OTP_VERIFIED' ||
                           estado === 'DOCUMENT_OPENED' ||
                           estado === 'DOCUMENT_VIEWED' ||
                           estado === 'SIGNED')
        ? _maskEmailPublico(signRequest.correo_verificacion)
        : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/identify
 * Identifica al trabajador por tipo + número de documento.
 */
router.post('/api/sign/:token/identify', validateBody(identifyBody), async (req, res, next) => {
  try {
    const result = await publicFlow.identify(
      req.params.token,
      req.body.tipo_identificacion,  // D-1 (I-002): antes tipo_documento
      req.body.numero_documento,
      req.ip,
      req.get('User-Agent'),
      req.body.correo_otp,   // D-2: medio personal del OTP
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/verify-otp
 * Verifica el OTP. Si es correcto, marca estado=OTP_VERIFIED.
 */
router.post('/api/sign/:token/verify-otp', validateBody(verifyOtpBody), (req, res, next) => {
  try {
    const result = publicFlow.verifyOtp(
      req.params.token,
      req.body.otp,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/resend-otp
 * Reenvía OTP a una solicitud que ya pasó por identify().
 *
 * Estados permitidos: OTP_SENT (OTP expirado) o OTP_LOCKED (desbloquear).
 * Body vacío — el token en la URL es la credencial.
 */
router.post('/api/sign/:token/resend-otp', validateBody(resendOtpBody), (req, res, next) => {
  try {
    const result = publicFlow.resendOtp(
      req.params.token,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/consent/accept
 * Acepta el consentimiento del Acuerdo vinculado al sign request.
 * Disparado por la 3ª casilla de la mini-app después del OTP.
 *
 * Precondiciones (validadas por publicFlow.consentAccept):
 * - Token válido y NO terminal
 * - signRequest.estado ∈ {OTP_VERIFIED, DOCUMENT_VIEWED}
 * - signRequest.consent_id IS NOT NULL
 * - El consentimiento existe y coincide en (trabajador, empresa, version)
 * - El consentimiento está en estado OTP_PENDING
 *
 * Idempotente: la 1ª aceptación marca consent + crea evento
 * CONSENT_ACCEPTED. Las siguientes retornan 200 con idempotente: true
 * sin crear otro evento.
 */
router.post('/api/sign/:token/consent/accept', async (req, res, next) => {
  try {
    // Es `async` porque la 10.4 puede migrar la solicitud a la versión
    // vigente del Acuerdo, y eso implica escribir en la base.
    const result = await publicFlow.consentAccept(
      req.params.token,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/consent/sensible
 *
 * 8B · El consentimiento EXPRESO del dato sensible (numeral 10.8).
 *
 * El Titular marca una casilla SEPARADA de la del Acuerdo: la del Acuerdo es
 * "acepto el Acuerdo de uso", y esta es "autorizo el tratamiento de la
 * información de salud de este documento". Son cosas distintas y el 10.8(a)
 * las separa: el primero es aceptar las reglas del servicio, el segundo es
 * autorizar el tratamiento de un dato sensible.
 *
 * `autoriza: false` también se registra: el Titular NO está obligado a
 * autorizar (el 10.8(a) le informa de eso), y que no lo haya autorizado es
 * un hecho que tiene que quedar probado.
 */
router.post('/api/sign/:token/consent/sensible', validateBody(consentSensibleBody), (req, res, next) => {
  try {
    const result = publicFlow.consentirDatoSensible(
      req.params.token,
      {
        autoriza: req.body.autoriza,
        ip: req.ip,
        user_agent: req.get('User-Agent') || null,
      }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/view-document
 * Registra que el trabajador vio el documento (scroll al final).
 * Transiciona a DOCUMENT_VIEWED.
 */
router.post('/api/sign/:token/view-document', validateBody(viewDocumentBody), (req, res, next) => {
  try {
    const result = publicFlow.viewDocument(
      req.params.token,
      {
        segundosEnPagina: req.body.segundos_en_pagina,
        scrollAlFinal: req.body.scroll_al_final,
      },
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sign/:token/document.pdf
 * Devuelve el PDF del documento.
 *
 * NOTA sobre CSP: para este endpoint especifico, relajamos la directiva
 * `frame-ancestors` de 'none' a 'self'. Esto permite que la mini-app
 * (mismo origen) incruste el PDF en su visor iframe. La CSP global de
 * server.js mantiene 'none', por lo que las demas respuestas siguen
 * protegidas contra incrustacion externa (anti-clickjacking).
 * Solo sobreescribimos la directiva `frame-ancestors`; las demas
 * directivas de la CSP (default-src, script-src, etc.) permanecen
 * identicas a las del helmet global.
 */
router.get('/api/sign/:token/document.pdf', (req, res, next) => {
  try {
    const { buffer, filename } = publicFlow.getPdfForToken(req.params.token);

    // Override quirurgico: solo cambiamos `frame-ancestors` de 'none' a 'self'.
    // Conservamos el resto de directivas CSP de helmet intactas.
    const currentCsp = res.getHeader('Content-Security-Policy');
    if (typeof currentCsp === 'string' && currentCsp.includes("frame-ancestors 'none'")) {
      const newCsp = currentCsp.replace(
        /frame-ancestors 'none'/,
        "frame-ancestors 'self'"
      );
      res.set('Content-Security-Policy', newCsp);
    }

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sign/:token/signed-document.pdf
 * Devuelve el PDF FIRMADO (5.4 del Acuerdo de uso).
 *
 * "El Firmante puede imprimir o descargar copia de este Acuerdo y del
 * documento firmado desde el propio enlace de firma, sin costo alguno."
 *
 * Diferencias con `document.pdf`:
 *   - `document.pdf` es el paso (h) del 3.4: el documento OBJETO de la firma,
 *     y solo se sirve después de que el Firmante aceptó el Acuerdo.
 *   - `signed-document.pdf` es el 5.4: el documento ya firmado, que solo
 *     existe cuando la firma ocurrió.
 *
 * El enlace es de un solo uso (3.4(c)), así que esto NO reabre el flujo:
 * solo baja lo que ya está firmado, y solo mientras el enlace siga vigente.
 * Un enlace que no pasó por OTP y aceptación del Acuerdo no descarga nada:
 * la respuesta es 409 SIGNED_DOCUMENT_NOT_AVAILABLE.
 *
 * Se sirve como adjunto (`attachment`), no en línea: es una descarga, no un
 * visor. La CSP global de helmet se deja intacta (no hay iframe aquí).
 */
router.get('/api/sign/:token/signed-document.pdf', (req, res, next) => {
  try {
    const { buffer, filename } = publicFlow.getSignedPdfForToken(req.params.token);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sign/:token/acuerdo.txt
 * Devuelve el TEXTO del Acuerdo de uso que el Firmante aceptó (5.4).
 *
 * Es el texto exacto de la versión ligada a la solicitud: el mismo cuyo
 * SHA-256 quedó archivado como `hash_texto_acuerdo` en el consentimiento.
 * La cabecera `X-Acuerdo-SHA256` lleva ese hash, para que el Firmante pueda
 * comprobar que la copia que descarga es la que aceptó.
 */
router.get('/api/sign/:token/acuerdo.txt', (req, res, next) => {
  try {
    const copia = publicFlow.getAgreementCopyForToken(req.params.token);

    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${copia.filename}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Acuerdo-Version', copia.version);
    res.set('X-Acuerdo-SHA256', copia.texto_hash || '');
    res.send(copia.texto);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// 9A · LOS MEDIOS AUTORIZADOS (el 8.2)
// =============================================================================
// Rutas públicas (las usa la mini-app).
//
// - GET  /api/sign/:token/medios    → sus medios autorizados y su estado.
// - POST /api/sign/:token/medios    → agrega o retira un medio (el 8.2).
//
// La vía en papel (el 7.2) NO tiene ruta pública: el Trabajador le pide el
// papel a su Empresa por el canal de atención de la Empresa y la Empresa lo
// registra desde K+AIR (`POST /internal/sign-requests/:id/firma-papel`).
// La mini-app no menciona el papel: el 7.2 es un deber de la Empresa, y el
// producto no puede prometer en nombre de la Empresa lo que la Empresa hará
// (veracidad, Ley 1581 art. 4(d)(e) y D.1377 art. 4).
// =============================================================================

/**
 * GET /api/sign/:token/medios
 * Los medios electrónicos que el Trabajador autorizó (el 8.2).
 */
router.get('/api/sign/:token/medios', (req, res, next) => {
  try {
    const resultado = publicFlow.listarMediosTrabajador(
      req.params.token,
      req.ip,
      req.get('User-Agent')
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/medios
 * Agregar o retirar un medio autorizado (el 8.2: "en cualquier momento y sin
 * costo alguno").
 */
router.post('/api/sign/:token/medios', validateBody(mediosBody), (req, res, next) => {
  try {
    const resultado = publicFlow.gestionarMediosTrabajador(
      req.params.token,
      req.body,
      req.ip,
      req.get('User-Agent')
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/commit
 * Cierra la firma (transición atómica a SIGNED).
 */
/**
 * 1.2 · LA FIRMA VISUAL (PNG) NO SE ADMITE, Y SE DICE POR QUÉ.
 *
 * Va ANTES del `validateBody` para que el 400 diga la razón, no solo el
 * nombre de la clave. Con `.strict()` el error de zod ya nombraría la clave
 * desconocida, pero un mensaje que solo dice "unrecognized key" deja al
 * cliente sin saber qué hacer.
 *
 * El 10.2 del Acuerdo es una lista CERRADA de los datos que se tratan, y la
 * firma autográfica es un dato de carácter especial (art. 5 de la Ley 1581):
 * su tratamiento exigiría aviso previo, consentimiento expreso y su propia
 * categoría de retención y supresión. Hoy el sistema NO lo guarda: lo acepta y
 * lo tira. Un cliente que no se entere cree que su firma visual quedó
 * firmada. Eso es exactamente el modo de falla que costó el `correo_empresa`
 * del 8B, así que aquí se cierra con un error que lo dice.
 */
function rechazarFirmaVisual(req, res, next) {
  const cuerpo = req.body || {};
  if (cuerpo.firma_visual_png === undefined) return next();
  return res.status(400).json({
    error: {
      code: 'FIRMA_VISUAL_NO_ADMITIDA',
      message:
        'La firma visual en PNG no se admite: el sistema no la conserva y el '
        + 'Acuerdo de uso (numeral 10.2) no autoriza tratar ese dato. Si la '
        + 'Empresa necesita registrar la rúbrica, el camino es la firma '
        + 'autográfica sobre papel del numeral 7.2.',
      details: {
        clave: 'firma_visual_png',
        motivo: 'dato de carácter especial fuera de la lista cerrada del 10.2',
        alternativa: 'firma autográfica sobre papel (numeral 7.2 del Acuerdo)',
      },
      request_id: req.id,
    },
  });
}

/**
 * POST /api/sign/:token/medio
 *
 * D-2: el Trabajador declara el medio PERSONAL donde quiere recibir el código
 * de verificación (el dato de creación de la firma).
 *
 * Se puede llamar ANTES de identificarse (es lo normal: la pantalla de
 * identificación lo pide) o dentro del identify. El medio queda CONGELADO en
 * la fila en cuanto se envía un código: después de eso, el código ya
 * viajó y cambiar el destino sería romper la trazabilidad del 3.4(e).
 *
 * Auth: ninguna (el token en la URL es la credencial).
 */
const medioBody = z.object({
  correo: z.string().email().max(254),
}).strict();

router.post('/api/sign/:token/medio', validateBody(medioBody), (req, res, next) => {
  try {
    const resultado = publicFlow.declararMedioPublico(
      req.params.token,
      req.body.correo
    );
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

router.post('/api/sign/:token/commit',
  rechazarFirmaVisual,
  validateBody(commitBody),
  async (req, res, next) => {
    try {
      const result = await publicFlow.commit(
        req.params.token,
        req.body,
        req.ip,
        req.get('User-Agent'),
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

/**
 * POST /api/sign/:token/reject
 * Registra rechazo explícito del documento.
 */
router.post('/api/sign/:token/reject', validateBody(rejectBody), (req, res, next) => {
  try {
    const result = publicFlow.reject(
      req.params.token,
      req.body.motivo,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// EL CANAL DE DATOS DE K+AIR (el 10.7(b))
// =============================================================================
//
// El numeral 10.7(b) del Acuerdo, en su redacción nueva, obliga a K+AIR a
// atender las solicitudes de los Titulares que le sean dirigidas: las
// recibe, las REGISTRA, las TRASMITE a la Empresa (que es la Responsable y
// la que responde) e informa al Titular del estado.
//
// Esto NO es el canal de la Empresa: ese sigue siendo el del 10.7 literal
// b (canal_pqrs). K+AIR es el Encargado, y el 2.2.2.25.4.4 del Decreto 1377
// le obliga a tener un mecanismo propio.
//
// El límite global de peticiones (globalLimiter) ya cubre esta ruta.
router.post('/api/solicitudes', validateBody(solicitudBody), (req, res, next) => {
  try {
    const resultado = solicitudesService.registrar({
      tipo: req.body.tipo,
      nombre: req.body.nombre,
      correo: req.body.correo,
      documento: req.body.documento,
      contenido: req.body.contenido,
      canal: config.canalProteccionDatos,
      creado_por: 'titular',
      ip: req.ip,
      user_agent: req.get('User-Agent') || null,
    });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// I-VERIFICACION-PUBLICA: vista de solo lectura
// =============================================================================
//
// Distinto del flujo de firma: este endpoint es READ-ONLY. NO permite
// identificar, pedir OTP, firmar ni rechazar. Solo expone metadata
// verificable (estado, hashes, firmante con cédula enmascarada) para
// que el destinatario del link confirme la autenticidad del documento.
//
// Cada consulta queda registrada en gh_firma_eventos como VERIFY_CONSULTED
// (auditoría: "el contrato fue verificado N veces por la empresa X").
// =============================================================================

/**
 * GET /api/sign/:token/verify
 * Devuelve metadata de solo lectura para la pantalla de verificación.
 * Acepta cualquier estado del SR (incluso PENDING, para que el firmante
 * pueda ver el estado del documento mientras espera el OTP).
 */
router.get('/api/sign/:token/verify', verifyLimiter, (req, res, next) => {
  try {
    // Resolver el token como operación HISTÓRICA autorizada: la consulta es
    // de solo lectura y debe funcionar para siempre, aunque la ventana para
    // firmar ya haya vencido. Lo que NO se salta es el vencimiento del plazo
    // de conservación (numeral 10.6): vencido el plazo, la respuesta es "no
    // disponible por vencimiento del plazo", no "firma válida".
    const { signRequest } = publicFlow.resolveToken(req.params.token, { permitirHistorico: true });
    publicFlow.registerVerifyConsulted(signRequest, req.ip, req.get('User-Agent'));
    const context = publicFlow.getVerificationContext(req.params.token);
    res.json(context);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sign/:token/verify-pdf
 * Recibe un PDF (multipart/form-data, campo "pdf"), calcula su SHA-256
 * y lo compara con el document_hash_firmado del SR.
 * Devuelve { matches, server_hash, computed_hash, message }.
 *
 * Registra evento PDF_VERIFIED con el resultado (match/mismatch) para
 * auditoría. NO expone el contenido del PDF, solo el hash.
 *
 * Límite: 50MB. Magic bytes: %PDF-.
 */
router.post(
  '/api/sign/:token/verify-pdf',
  // I-AUDIT-2026-09-10: rate limiter específico (30/min por IP+token)
  // anti-enumeración y anti-DoS con PDFs grandes.
  verifyLimiter,
  // Body parser específico con límite alto (50MB) para aceptar PDFs
  // base64-encoded. El global en server.js es 100KB para no permitir DoS
  // en el resto de endpoints. Sin este middleware local, el verify-pdf
  // devuelve 413 PayloadTooLargeError que el error handler genérico
  // convierte en "Error interno del servidor" — bug real encontrado
  // en validación 2026-09-10 con PDF de 0.1 MB (~140KB en base64).
  express.json({ limit: '50mb' }),
  (req, res, next) => {
  try {
    // multipart/form-data parsing nativo de Express. No usamos multer para
    // mantener el bundle limpio. El frontend envía el PDF como un Blob
    // con Content-Type application/pdf en un FormData, así que req.body
    // es undefined y el body crudo está en req.rawBody o hay que leerlo
    // del stream. Para simplificar, exigimos que el cliente envíe el PDF
    // como un buffer base64 en un JSON body.
    if (!req.body || !req.body.pdf_base64) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Se requiere el campo pdf_base64 (string base64 del PDF)',
          request_id: req.id,
        },
      });
    }
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(req.body.pdf_base64, 'base64');
    } catch (e) {
      return res.status(400).json({
        error: {
          code: 'INVALID_BASE64',
          message: 'El campo pdf_base64 no es base64 válido',
          request_id: req.id,
        },
      });
    }
    const result = publicFlow.verifyPdfHash(
      req.params.token,
      pdfBuffer,
      req.ip,
      req.get('User-Agent'),
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
