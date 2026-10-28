/**
 * Rutas de Sign Request.
 *
 * - POST /internal/sign-requests                                 (multipart, crea)
 * - GET  /internal/sign-requests/:id                             (consulta por id_solicitud o id interno)
 * - GET  /internal/sign-requests                                 (lista con filtros)
 * - GET  /internal/sign-requests?ids=id1,id2,id3                 (I-008: batch, internalServerLimiter 4 capas)
 * - GET  /internal/sign-requests/:id/document.pdf                (I-103: PDF descargable autenticado)
 * - GET  /internal/sign-requests/:id/constancia.pdf              (I-104: Constancia descargable autenticada)
 * - GET  /internal/sign-requests/:id/link                        (I-013b: link recovery, DEPRECADO en la 8C)
 * - POST /internal/sign-requests/:id/link/rotate                 (8C: rotación del enlace)
 * - POST /internal/sign-requests/:id/resend-otp                  (I-103.A1.6.B: reenvío OTP desde K+AIR)
 *
 * Auth (I-010, D-13, I-008): los 7 endpoints usan `requireEmpresaScopeAndLimit`
 * para scope per-empresa + rate limit interno (4 capas, I-008 / C-20 v5).
 *
 * Ver API.md §6.1, §6.2, §6.8 y docs/kair-firma-integration/I-010-design.md,
 * docs/kair-firma-integration/READY-TO-IMPLEMENT.md (I-007, I-008, I-103,
 * I-104, I-013b).
 */
'use strict';

const express = require('express');
const router = express.Router();
const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const { requireIdempotencyKey } = require('../middleware/idempotency');
const { uploadPdf } = require('../middleware/upload');
const pdfValidation = require('../middleware/pdfValidation');
const { validateBody } = require('../middleware/validate');
const {
  signRequestBody, signRequestListQuery, signRequestIdsQuery,
  signRequestNotifyBody,  // I-103.A1.5.1
  signRequestRotateBody,  // 8C: link/rotate
  suministroAutoridadBody,  // 9A: el 8.4 (suministro a autoridades)
} = require('../schemas');
const signRequestService = require('../services/signRequest');
const metadataService = require('../services/metadata');  // 8B: lista blanca de `metadata`
const declaracionSalud = require('../services/declaracionSalud');  // 045: el documento NO tiene datos de salud
const publicFlow = require('../services/publicFlow');
const mediosService = require('../services/medios');   // 9A: los medios autorizados (el 8.2)
const papelService = require('../services/papel');   // 9A: la firma autográfica (el 7.1-7.3)
const storage = require('../services/storage');
const { AppError } = require('../middleware/errors');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Resuelve la solicitud de una ruta interna y aplica el silencio
 * cross-empresa.
 *
 * Devuelve null si YA respondió (400 o 404): el que llama tiene que
 * salir en ese caso.
 *
 * @param {object} req
 * @param {object} res
 * @returns {object|null} la fila de la solicitud
 */
function _resolverInterno(req, res) {
  const { id } = req.params;
  let signRequest;
  if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
    signRequest = signRequestService.getByIdSolicitud(id);
  } else if (/^\d+$/.test(id)) {
    signRequest = signRequestService.getById(parseInt(id, 10));
  } else {
    res.status(400).json({
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
        request_id: req.id,
      },
    });
    return null;
  }

  if (!signRequest) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Solicitud ${id} no encontrada`,
        request_id: req.id,
      },
    });
    return null;
  }

  // Cross-company: 404 silencioso (no se confirma la existencia de una
  // solicitud de otra empresa).
  if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Solicitud ${id} no encontrada`,
        request_id: req.id,
      },
    });
    return null;
  }

  return signRequest;
}

/**
 * POST /internal/sign-requests
 * Crea una nueva solicitud de firma.
 *
 * multipart/form-data:
 *   - documento: archivo PDF
 *   - metadata: JSON string con id_documento, id_trabajador, etc.
 */
router.post('/sign-requests',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:create'],
    // checkIdEmpresa NO se puede usar acá: el body es multipart y multer
    // lo parsea DESPUÉS de este middleware. El handler hace el check
    // post-parse (ver bloque "I-010 check body id_empresa" más abajo).
    rateLimit: { tier: 'standard' },
  }),
  uploadPdf(),
  // I-012.2: validacion estructural del PDF (servicio services/pdfValidator.js,
  // I-012.1). Calcula SHA-256 server-side y rechaza PDFs invalidos /
  // encriptados / demasiado grandes / con muchas paginas / parseo
  // excedido / metadata bomb → 422. El hash se expone en req.pdfValidation.sha256
  // y es el que se persiste (NO el que el cliente envio en metadata).
  pdfValidation(),
  // I-005: cableado de requireIdempotencyKey (I-003.3). Insertado DESPUES
  // de pdfValidation() porque el extractor de pdf_sha256 necesita
  // req.pdfValidation.sha256 (server-computed). El metadata se parsea del
  // mismo modo que el handler (JSON.parse del campo multipart) para que
  // el fingerprint sea consistente. Sin header Idempotency-Key el
  // middleware hace next() inmediatamente (G3, backward compat).
  requireIdempotencyKey({
    extractMetadata: (req) => {
      try { return JSON.parse(req.body.metadata || '{}'); }
      catch { return {}; }
    },
    extractPdfSha256: (req) => (req.pdfValidation && req.pdfValidation.sha256),
  }),
  (req, res, next) => {
  try {
    // Parsear el campo 'metadata' (viene como JSON string en multipart)
    const metadataRaw = req.body.metadata;
    if (typeof metadataRaw !== 'string' || metadataRaw.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'Falta el campo "metadata" en el form-data',
          request_id: req.id,
        },
      });
    }

    let metaObj;
    try {
      metaObj = JSON.parse(metadataRaw);
    } catch (e) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'El campo "metadata" debe ser JSON válido',
          details: { parse_error: e.message },
          request_id: req.id,
        },
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    // LA DECLARACIÓN DE QUE EL DOCUMENTO NO TIENE DATOS SENSIBLES DE SALUD
    // ───────────────────────────────────────────────────────────────────────────
    // El servicio de firma electrónica NO recibe documentos con datos
    // sensibles de salud: la Empresa conserva el original. Para que el
    // servicio no los reciba, la Empresa tiene que DECLARAR que el documento
    // no los contiene, con un texto fijo (no un boolean genérico: así queda
    // escrito QUÉ se declaró).
    //
    // Se puede mandar en DOS lugares, y los dos son el cuerpo de la petición:
    //   - como campo propio del multipart (`declaracion_datos_sensibles`), o
    //   - dentro del JSON del campo `metadata`.
    //
    // La clave del metadata se QUITA antes de validar contra el schema: el
    // schema es `.strict()` (una clave desconocida se rechaza con 400) y esta
    // no es una clave de negocio, es un control de la frontera.
    const declaracionRecibida =
      (typeof req.body.declaracion_datos_sensibles === 'string'
        ? req.body.declaracion_datos_sensibles
        : (typeof metaObj.declaracion_datos_sensibles === 'string'
          ? metaObj.declaracion_datos_sensibles
          : null));
    if (Object.prototype.hasOwnProperty.call(metaObj, 'declaracion_datos_sensibles')) {
      delete metaObj.declaracion_datos_sensibles;
    }

    // I-010 (D-13): per-company authz post-parse del body multipart.
    // El middleware requireEmpresaScopeAndLimit corrió ANTES de multer, así que
    // no pudo checkar body.id_empresa. Lo hacemos acá, ya con metaObj.
    // En client mode + meta.id_empresa !== req.id_empresa → 403 EMPRESA_MISMATCH.
    // En legacy mode (deprecation), se permite cualquier id_empresa.
    if (req.authSource === 'client' &&
        typeof metaObj.id_empresa === 'string' &&
        metaObj.id_empresa.length > 0 &&
        metaObj.id_empresa !== req.id_empresa) {
      return res.status(403).json({
        error: {
          code: 'EMPRESA_MISMATCH',
          message: 'El id_empresa de la solicitud no coincide con la identidad autenticada',
          details: {
            auth_id_empresa: req.id_empresa,
            requested_id_empresa: metaObj.id_empresa,
          },
          request_id: req.id,
        },
      });
    }

    // Validar el objeto parseado
    const validation = signRequestBody.safeParse(metaObj);
    if (!validation.success) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'El metadata no cumple el schema',
          details: { issues: validation.error.issues },
          request_id: req.id,
        },
      });
    }
    const meta = validation.data;

    // ───────────────────────────────────────────────────────────────────────────
    // LA DECLARACIÓN DE QUE EL DOCUMENTO NO TIENE DATOS SENSIBLES DE SALUD
    // ───────────────────────────────────────────────────────────────────────────
    // El servicio de firma electrónica NO recibe documentos con datos sensibles
    // de salud: la Empresa conserva el original. Para que el servicio no los
    // reciba, la Empresa tiene que DECLARAR que el documento no los contiene,
    // con un texto fijo (no un boolean genérico: así queda escrito QUÉ se
    // declaró).
    //
    // Se puede mandar en DOS lugares, y los dos son el cuerpo de la petición:
    //   - como campo propio del multipart (`declaracion_datos_sensibles`), o
    //   - dentro del JSON del campo `metadata`.
    //
    // La clave del metadata se QUITA antes de validar contra el schema (arriba,
    // el schema es `.strict()` y esa clave no es un dato de negocio, es un
    // control de la frontera), pero la EXIGENCIA se comprueba acá: primero la
    // forma del pedido (400 si el metadata no cumple el schema), después el
    // control (422 si no declaró).
    if (!declaracionSalud.esDeclaracionValida(declaracionRecibida)) {
      return res.status(422).json({
        error: {
          code: declaracionSalud.CODIGO_ERROR,
          message: declaracionSalud.MENSAJE_ERROR,
          details: {
            campo: 'declaracion_datos_sensibles',
            valor_esperado: declaracionSalud.DECLARACION_SALUD,
          },
          request_id: req.id,
        },
      });
    }

    // I-FIRMA-DUAL: si el cliente pidió firma de empresa, debe traer el
    // snapshot del representante. Validación inline para devolver 400 limpio
    // con código semántico en vez de fallar después en createForCompany().
    if (meta.requiere_firma_empresa === 1 && !meta.representante_legal_snapshot) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'requiere_firma_empresa=1 exige representante_legal_snapshot',
          details: { missing: 'representante_legal_snapshot' },
          request_id: req.id,
        },
      });
    }

    // 8B · LA LISTA BLANCA DE LO QUE SE ARCHIVA.
    //
    // El campo `metadata` es un string JSON libre (≤ 8192) y lo que va ahí
    // queda archivado en la columna `metadata` de la fila. Lo que se
    // archiva es DATO: puede ser PII y, en el peor caso, dato de salud (el
    // 10.8 exige consentimiento expreso y el 10.6 exige suprimirlo).
    //
    // Antes se archivaba entero. `correo_empresa` es la prueba de que
    // archivar lo que uno manda sin filtro cuesta datos: la app la mandaba
    // desde hace meses, zod la eliminaba en silencio, nunca llegó a la base
    // y la constancia salió sin el canal de copia del 8.4.
    //
    // Ahora lo desconocido se RECHAZA con un 400 que dice qué claves
    // sobraron, en vez de perderse en silencio.
    const filtrado = metadataService.filtrarMetadata(meta.metadata);
    if (!filtrado.ok) {
      if (filtrado.error) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: filtrado.error,
            request_id: req.id,
          },
        });
      }
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST_BODY',
          message: 'El metadata contiene claves que no se pueden archivar',
          details: {
            claves_no_permitidas: filtrado.desconocidas,
            permitidas: metadataService.CLAVES_METADATA_PERMITIDAS,
          },
          request_id: req.id,
        },
      });
    }

    // Los campos visibles de la Constancia no deben perderse: zod quita
    // campos desconocidos del body raíz, así que los guardamos explícitamente
    // dentro del metadata persistido del sign request.
    const metadataExtra = Object.assign({}, filtrado.valor);
    if (meta.nombre_trabajador) metadataExtra.nombre_trabajador = meta.nombre_trabajador;
    if (meta.nombre_empresa) metadataExtra.nombre_empresa = meta.nombre_empresa;
    // 8B: el canal de copia del 8.4. La app lo mandaba y se perdía.
    if (meta.correo_empresa) metadataExtra.correo_empresa = meta.correo_empresa;
    const metadataToPersist = Object.keys(metadataExtra).length > 0
      ? JSON.stringify(metadataExtra)
      : null;

    const result = signRequestService.create({
      id_documento: meta.id_documento,
      id_trabajador: meta.id_trabajador,
      id_empresa: meta.id_empresa,
      tipo_firma: meta.tipo_firma,
      agreement_version: meta.agreement_version,
      agreement_hash: meta.agreement_hash,
      // I-012.2: el hash del documento se calcula server-side en
      // pdfValidation() a partir de los bytes que multer nos entrego.
      // El cliente envia `meta.document_hash` para mantener compatibilidad
      // de schema, pero NO se usa: el cliente podria mentir sobre el hash
      // para bypassear el control de idempotencia (e.g. forzar colisiones
      // o evadir conflictos). El contrato de signRequest.create() exige
      // que document_hash coincida con el calculado, asi que pasarle el
      // server-computed garantiza que el check pasa y que document_hash
      // persistido es realmente el fingerprint del PDF recibido.
      document_hash: req.pdfValidation.sha256,
      pdf_buffer: req.file.buffer,
      pdf_filename: req.file.originalname,
      version_kair: meta.version_kair,
      identificacion_tipo: meta.identificacion_tipo,
      identificacion_numero_hash: meta.identificacion_numero_hash,
      consent_id: meta.consent_id,  // Bloque E6
      // I-002 (D-1): categoría del documento que se firma. DISTINTA de
      // `identificacion_tipo` (CC, CE, etc. del firmante). Hasta I-002 el
      // route no propagaba este campo; zod lo validaba y el service lo
      // aceptaba, pero terminaba en `undefined` → `null` en BD silencioso.
      tipo_identificacion: meta.tipo_identificacion,
      // 033 · Catálogo de retención por documento. La categoría decide el
      // plazo (20 años desde el cese, contrato sin término, historia laboral
      // 80-100 años) y la fecha de terminación es la base del cómputo. Si no
      // vienen, el servidor deriva la categoría del tipo + subtipo, y si
      // tampoco hay datos la solicitud queda legacy (tabla de la Empresa).
      categoria_retencion: meta.categoria_retencion || null,
      fecha_terminacion: meta.fecha_terminacion || null,
      subtipo_identificacion: meta.subtipo_identificacion || null,
      // I-103.A1.6.C · El correo del firmante viaja top-level; si K+AIR no lo
      // envía, cae al fallback histórico de metadata.correo / consent.
      correo_verificacion: meta.correo_verificacion,
      // D-2: el medio PERSONAL que la Empresa declara para el código de
      // verificación (el dato de creación de la firma, el 47.4 num. 1).
      correo_otp: meta.correo_otp,
      // I-FIRMA-DUAL (migration 013, v0.1.180): opt-in para que commit() del
      // worker cree automáticamente un sign request hijo (tipo_firmante='EMPRESA')
      // con el snapshot del representante legal. Si K+AIR no los envía, caen
      // al default 0/null (legacy compat).
      requiere_firma_empresa: meta.requiere_firma_empresa || 0,
      representante_legal_snapshot: meta.representante_legal_snapshot || null,
      // 8B · La declaración de la Empresa sobre el dato sensible (10.8).
      // El service la combina con lo que se infiere del tipo de documento.
      datos_sensibles: meta.datos_sensibles,
      categorias_datos_sensibles: meta.categorias_datos_sensibles || null,
      base_legal_sensible: meta.base_legal_sensible || null,
      base_legal_sensible_descripcion: meta.base_legal_sensible_descripcion || null,
      finalidad_sensible: meta.finalidad_sensible || null,
      // 045 · La declaración de que el documento NO contiene datos sensibles
      // de salud. Ya validada arriba: si no fuera exacta, la ruta habría
      // respondido 422 y no habría llegado acá.
      declaracion_datos_sensibles: declaracionRecibida,
      metadata: metadataToPersist,
      ip: req.ip,
      user_agent: req.get('User-Agent') || null,
      // Quién pide la creación. Si la firma sale con una EXCEPCIÓN de
      // habilitación, la bitácora tiene que decir quién la pidió.
      actor: req.api_key_hash_prefix
        ? `rh:${req.api_key_hash_prefix}`
        : 'sistema',
    });

    // IMPORTANTE: el token SOLO se retorna en esta respuesta.
    // Después, solo se almacena token_hash en BD.
    res.status(201).json({
      id_solicitud: result.signRequest.id_solicitud,
      id_interno: result.signRequest.id,
      tipo_firma: result.signRequest.tipo_firma,
      token: result.token,
      url_publica: result.url_publica,
      qr_payload: result.url_publica,
      document_hash_original: result.signRequest.document_hash_original,
      agreement_hash: result.signRequest.agreement_hash,
      fecha_creacion: result.signRequest.fecha_creacion,
      fecha_expiracion: result.signRequest.fecha_expiracion,
      estado: result.signRequest.estado,
      // I-002: confirmamos al cliente que el campo fue persistido (o null
      // si no se envió, en sign requests legacy pre-007).
      tipo_identificacion: result.signRequest.tipo_identificacion,
      // 033: la categoría de retención y la fecha de conservación ya
      // calculada, para que el cliente pueda mostrarlas sin volver a preguntar.
      categoria_retencion: result.signRequest.categoria_retencion || null,
      fecha_conservacion: result.signRequest.fecha_conservacion || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests/:id
 * Consulta por id_solicitud (SIGN-YYYY-NNNNNN) o por id interno numérico.
 */
router.get('/sign-requests/:id',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;

      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        signRequest = null;
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // I-010 (D-13): per-company authz post-lookup.
      // Si el cliente es per-empresa (authSource='client') y la solicitud
      // pertenece a OTRA empresa, retornar 404 (silent) en vez de 403
      // para no filtrar la existencia del recurso.
      // En legacy mode (deprecation), se permite el acceso sin check.
      if (req.authSource === 'client' &&
          signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      res.json({
      id_solicitud: signRequest.id_solicitud,
      id_interno: signRequest.id,
      id_documento: signRequest.id_documento,
      id_trabajador: signRequest.id_trabajador,
      id_empresa: signRequest.id_empresa,
      tipo_firma: signRequest.tipo_firma,
      estado: signRequest.estado,
      fecha_creacion: signRequest.fecha_creacion,
      fecha_expiracion: signRequest.fecha_expiracion,
      fecha_apertura: signRequest.fecha_apertura,
      fecha_otp_enviado: signRequest.fecha_otp_enviado,
      fecha_otp_verificado: signRequest.fecha_otp_verificado,
      fecha_documento_visto: signRequest.fecha_documento_visto,
      fecha_manifestacion: signRequest.fecha_manifestacion,
      fecha_firma: signRequest.fecha_firma,
      version_kair: signRequest.version_kair,
      agreement_version: signRequest.agreement_version,
      consent_id: signRequest.consent_id,  // Bloque E6
      // 9A (el 7.2): si la firma es en papel, el estado electrónico queda
      // CANCELLED. Sin este dato, la Empresa vería "cancelada" y
      // creería que no pasó nada: el estado de la vía en papel va aparte.
      firma_papel: (() => {
        const fila = papelService.obtenerPorSolicitud(signRequest.id_solicitud);
        if (!fila) return null;
        return {
          estado: fila.estado,
          fecha_solicitud: fila.fecha_solicitud,
          fecha_entrega: fila.fecha_entrega,
          fecha_firma: fila.fecha_firma,
          pdf_hash: fila.pdf_hash,
        };
      })(),
      // I-002: categoría del documento firmado. Null para legacy pre-007.
      tipo_identificacion: signRequest.tipo_identificacion,
      // I-007: campos para UI. Se exponen en el response body pero el
      // token real NUNCA se reconstruye (está hasheado en BD, ver C-22).
      //   - qr_payload, link: null en GET /:id. Si K+AIR los necesita,
      //     debe llamar I-013b (GET /:id/link) que retorna el token
      //     descifrado de metadata._server_metadata con auditoría.
      //   - tiene_pdf_firmado / tiene_constancia: flags booleanos que
      //     indican si los archivos están disponibles para descarga vía
      //     I-103 / I-104. NO exponemos los paths internos (riesgo de
      //     fuga de info sobre el filesystem del servidor).
      qr_payload: null,
      link: null,
      tiene_pdf_original: !!signRequest.pdf_original_path,
      tiene_pdf_firmado: !!signRequest.pdf_firmado_path,
      tiene_constancia: !!signRequest.constancia_path,
      // I-007: hashes de evidencia forense (post-SIGNED).
      // Solo se exponen si están calculados (estado SIGNED).
      // En estados anteriores son null (no se han calculado todavía).
      ...(signRequest.document_hash_firmado
          ? { document_hash_firmado: signRequest.document_hash_firmado } : {}),
      ...(signRequest.evidence_hash
          ? { evidence_hash: signRequest.evidence_hash } : {}),
      ...(signRequest.id_constancia
          ? { id_constancia: signRequest.id_constancia } : {}),
      ...(signRequest.manifestacion_voluntad_hash
          ? { manifestacion_voluntad_hash: signRequest.manifestacion_voluntad_hash } : {}),
      // motivo_rechazo solo si estado=REJECTED (relevante para UI).
      ...(signRequest.estado === 'REJECTED' && signRequest.motivo_rechazo
          ? { motivo_rechazo: signRequest.motivo_rechazo } : {}),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /internal/sign-requests
 * Lista con filtros.
 *
 * I-010 (D-13): per-company authz.
 *  - En `client` mode: se PISA `q.id_empresa` con `req.id_empresa`. No hay
 *    forma de escapar el scope via query (?id_empresa=B es ignorado).
 *  - En `legacy` mode (deprecation): se respeta el `?id_empresa=` del query
 *    para mantener compatibilidad con K+AIR durante la migración.
 */
router.get('/sign-requests',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      // Parsear manualmente porque express.query es todo string
      const result = signRequestListQuery.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'Query params inválidos',
            details: { issues: result.error.issues },
            request_id: req.id,
          },
        });
      }
      const q = result.data;

      // I-010: forzar id_empresa desde la identidad autenticada en client mode.
      // En legacy mode, respetar el query (compat con K+AIR pre-I-010).
      let effectiveEmpresa = q.id_empresa;
      if (req.authSource === 'client') {
        effectiveEmpresa = req.id_empresa;
      }

      const { items, total, limit, offset } = signRequestService.list({
        id_empresa: effectiveEmpresa,
        estado: q.estado,
        id_trabajador: q.id_trabajador,
        id_documento: q.id_documento,
        desde: q.desde,
        hasta: q.hasta,
        limit: q.limit,
        offset: q.offset,
      });

      res.json({
        total,
        limit,
        offset,
        items: items.map(it => ({
          id_solicitud: it.id_solicitud,
          id_interno: it.id,
          id_documento: it.id_documento,
          id_trabajador: it.id_trabajador,
          id_empresa: it.id_empresa,
          tipo_firma: it.tipo_firma,
          estado: it.estado,
          fecha_creacion: it.fecha_creacion,
          fecha_expiracion: it.fecha_expiracion,
          fecha_firma: it.fecha_firma,
          // 9A: la vía en papel (el 7.2), cuando la hay.
          firma_papel: (() => {
            const fila = papelService.obtenerPorSolicitud(it.id_solicitud);
            if (!fila) return null;
            return { estado: fila.estado, fecha_solicitud: fila.fecha_solicitud };
          })(),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-008: GET /internal/sign-requests?ids=id1,id2,id3 (batch)
// =============================================================================
// Polling optimizado para K+AIR (cada 30s con todos los sign requests activos
// en UN solo request). Reemplaza el polling individual que haría N requests
// por tanda y agotaría la Capa 1 (720/h por id_empresa).
//
// Comportamiento:
//   - Acepta `ids` como CSV. Cada id puede ser `SIGN-YYYY-NNNNNN` o entero.
//   - Retorna 200 con { total, items, missing, forbidden }.
//     - items: sign requests encontrados Y autorizados (pertenecen al cliente).
//     - missing: ids que no existen en BD (404 silent).
//     - forbidden: ids que existen pero pertenecen a OTRA empresa. K+AIR
//       recibe este feedback para mostrar UI coherente sin revelar la
//       existencia del recurso cross-company (404 silent del lado server).
//   - El batch cuenta como UN solo hit en el rate limit (4 capas).
//
// Casos de error:
//   - 400 INVALID_REQUEST_BODY si ids falta, está vacío o tiene >200 entradas.
//   - 401, 403, 429: manejados por el middleware.

router.get('/sign-requests-batch',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      // 1. Validar query
      const result = signRequestIdsQuery.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'Query params inválidos para batch',
            details: { issues: result.error.issues },
            request_id: req.id,
          },
        });
      }
      const ids = result.data.ids.split(',').map(s => s.trim()).filter(Boolean);

      // 2. Batch lookup (service layer)
      const byId = signRequestService.getByIds(ids);

      // 3. Separar en items / missing / forbidden
      //    Regla cross-company: en client mode, los sign requests de otra
      //    empresa van a `forbidden` (no se filtra la existencia al cliente
      //    de otra empresa). En legacy mode, todos van a `items` (compat).
      const items = [];
      const missing = [];
      const forbidden = [];
      const seen = new Set();

      for (const rawId of ids) {
        if (seen.has(rawId)) continue;  // dedup en el response
        seen.add(rawId);

        const row = byId.get(rawId);
        if (!row) {
          missing.push(rawId);
          continue;
        }
        if (req.authSource === 'client' && row.id_empresa !== req.id_empresa) {
          forbidden.push(rawId);
          continue;
        }
        items.push(row);
      }

      // 4. Response
      res.json({
        total: items.length,
        missing_count: missing.length,
        forbidden_count: forbidden.length,
        items: items.map(it => ({
          id_solicitud: it.id_solicitud,
          id_interno: it.id,
          id_documento: it.id_documento,
          id_trabajador: it.id_trabajador,
          id_empresa: it.id_empresa,
          tipo_firma: it.tipo_firma,
          estado: it.estado,
          fecha_creacion: it.fecha_creacion,
          fecha_expiracion: it.fecha_expiracion,
          fecha_firma: it.fecha_firma,
        })),
        missing,
        forbidden,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-103: GET /internal/sign-requests/:id/document.pdf
// =============================================================================
// Descarga autenticada del PDF (firmado post-SIGNED, original pre-SIGNED).
// Sustituye el placeholder `pdf_firmado_url` que el commit() retorna pero
// que NO apuntaba a un endpoint real (ver INTEGRATION.md §2.2, gap I-103).
//
// Lógica:
//   - Si signRequest.estado === 'SIGNED' y pdf_firmado_path existe:
//     devuelve el PDF firmado.
//   - Si signRequest NO está en SIGNED y pdf_original_path existe:
//     devuelve el PDF original (preview sin firmar). Útil para que K+AIR
//     muestre el documento antes de la firma.
//   - Si no hay PDF disponible: 404 PDF_NOT_FOUND.
//
// Auth: requiereEmpresaScopeAndLimit con sign_request:read. Cross-company → 404.

router.get('/sign-requests/:id/document.pdf',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Determinar qué PDF servir
      // 9A (el 8.3): el documento firmado se mantiene disponible para
      // posterior consulta. `DUAL_FIRMADO` tambien esta firmado: servirle el
      // ORIGINAL seria mostrarle a la Empresa un documento que nadie firmo.
      const isSigned = ['SIGNED', 'DUAL_FIRMADO'].includes(signRequest.estado);
      const pathToServe = isSigned ? signRequest.pdf_firmado_path : signRequest.pdf_original_path;
      const fileLabel = isSigned ? 'firmado' : 'original';

      if (!pathToServe) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: `El PDF (${fileLabel}) no está disponible para esta solicitud`,
            request_id: req.id,
          },
        });
      }

      const result = storage.readPdfIfExists(pathToServe);
      if (!result.found) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: `El archivo del PDF (${fileLabel}) no existe en disco`,
            request_id: req.id,
          },
        });
      }

      const filename = isSigned
        ? `${signRequest.id_solicitud}.pdf`
        : `${signRequest.id_solicitud}-original.pdf`;

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `${isSigned ? 'inline' : 'attachment'}; filename="${filename}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-cache');
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-104: GET /internal/sign-requests/:id/constancia.pdf
// =============================================================================
// Descarga autenticada de la Constancia. Solo disponible si el sign request
// está en estado SIGNED (la constancia se genera en commit()).
//
// Lógica:
//   - Si signRequest.estado !== 'SIGNED' → 409 CONSTANCIA_NOT_AVAILABLE.
//   - Si constancia_path está null o el archivo no existe en disco → 404.
//   - Cross-company → 404 silent.

router.get('/sign-requests/:id/constancia.pdf',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // FIX I-FIRMA-DUAL: la constancia individual SÍ existe para DUAL_FIRMADO
      // (se genera en commit() junto con el PDF firmado, y el constancia_path
      // se persiste igual que para SIGNED). Antes del fix, este endpoint
      // rechazaba DUAL_FIRMADO con 409 aunque el archivo existiera en disco.
      if (signRequest.estado !== 'SIGNED' && signRequest.estado !== 'DUAL_FIRMADO') {
        return res.status(409).json({
          error: {
            code: 'CONSTANCIA_NOT_AVAILABLE',
            message: `La constancia solo está disponible cuando la solicitud está en estado SIGNED o DUAL_FIRMADO`,
            details: { current_state: signRequest.estado, allowed_states: ['SIGNED', 'DUAL_FIRMADO'] },
            request_id: req.id,
          },
        });
      }

      if (!signRequest.constancia_path) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: 'La ruta de la constancia no está registrada en BD',
            request_id: req.id,
          },
        });
      }

      const result = storage.readPdfIfExists(signRequest.constancia_path);
      if (!result.found) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: 'El archivo de la constancia no existe en disco',
            request_id: req.id,
          },
        });
      }

      const filename = `${signRequest.id_solicitud}-constancia.pdf`;

      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${filename}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-cache');
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-013b: GET /internal/sign-requests/:id/link (recuperación) — DEPRECADO (8C)
// =============================================================================
//
// DEPRECADO desde la 8C. Recuperaba el token perdido (C-22) descifrándolo de
// `metadata._server_metadata.token_encrypted`. La 8C dejó de guardar el token
// de forma recuperable (el 3.6(e) promete que se conserva "únicamente en
// forma de huella digital"), así que este endpoint solo sigue sirviendo para
// las solicitudes ANTERIORES a la 8C, que conservan el token cifrado.
//
// Para las nuevas, la respuesta es 410 con `reason: 'rotacion_requerida'` y
// el puntero al endpoint de rotación.
//
// Comportamiento:
//   - 200 con { id_solicitud, token, url_publica, qr_payload,
//     fecha_expiracion, estado } si la solicitud es anterior a la 8C.
//   - 410 GONE con code LINK_NOT_AVAILABLE si estado terminal.
//   - 410 GONE con code LINK_NOT_AVAILABLE y reason='rotacion_requerida'
//     si la solicitud es posterior a la 8C (no hay nada que recuperar).
//   - 404 NOT_FOUND si no existe o cross-company (silent).
//   - Registra evento LINK_RETRIEVED en gh_firma_eventos (auditoría Bloque E7).
//   - Cabeceras Deprecation / Sunset / Link hacia el endpoint successor.

router.get('/sign-requests/:id/link',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Estado terminal → 410
      const terminalStates = ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED'];
      if (terminalStates.includes(signRequest.estado)) {
        return res.status(410).json({
          error: {
            code: 'LINK_NOT_AVAILABLE',
            message: `El link no está disponible en estado terminal '${signRequest.estado}'`,
            details: { current_state: signRequest.estado, reason: 'terminal_state' },
            request_id: req.id,
          },
        });
      }

      // 8C · Deprecado. El token ya no se guarda de forma recuperable: la
      // necesidad que cubría este endpoint ("la Empresa perdió la respuesta
      // de creación") la cubre la ROTACIÓN
      // (`POST /internal/sign-requests/:id/link/rotate`).
      //
      // Solo siguen funcionando las solicitudes ANTERIORES a la 8C, que
      // todavía tienen el token cifrado en su metadata. Para las nuevas no
      // hay nada que recuperar, y la respuesta dice cuál es el camino.
      const recovery = signRequestService.getTokenForRecovery(signRequest);
      if (!recovery.found) {
        // 8C: sin token cifrado no hay nada que devolver, y la respuesta
        // dice cuál es el camino.
        //
        // La razón se distingue solo cuando hay una anomalía real
        // (`decrypt_failed`: el metadata tiene un token cifrado que no se
        // puede descifrar, y eso hay que revisarlo). En los demás casos
        // —una solicitud nueva, o una vieja sin token cifrado— la respuesta
        // es la misma: no se recupera, se rota.
        const reason = recovery.reason === 'decrypt_failed'
          ? recovery.reason
          : 'rotacion_requerida';
        return res.status(410).json({
          error: {
            code: 'LINK_NOT_AVAILABLE',
            message: 'El link ya no se recupera: use la rotación para emitir uno nuevo',
            details: {
              reason,
              rotacion_endpoint: 'POST /internal/sign-requests/:id/link/rotate',
            },
            request_id: req.id,
          },
        });
      }

      // Cabeceras de deprecación: el endpoint se va a quitar cuando los
      // clientes estén migrados a la rotación.
      res.set('Deprecation', 'true');
      res.set('Sunset', 'Wed, 30 Sep 2026 00:00:00 GMT');
      res.set('Link', '</internal/sign-requests/:id/link/rotate>; rel="successor-version"');

      // Auditoría: registrar evento LINK_RETRIEVED
      try {
        signRequestService.registerEvent(
          signRequest.id,
          'LINK_RETRIEVED',
          {
            via: 'I-013b',
            api_key_hash_prefix: req.api_key_hash_prefix || null,
          },
          `rh:${req.api_key_hash_prefix || 'system'}`,
          req.ip,
          req.get('User-Agent') || null,
        );
      } catch (e) {
        // Loguear pero no fallar — la recuperación es exitosa aunque la
        // auditoría falle.
        logger.warn('I-013b: no se pudo registrar evento LINK_RETRIEVED', {
          id_solicitud: signRequest.id_solicitud,
          error: e.message,
        });
      }

      logger.info('Link recuperado (endpoint deprecado)', {
        id_solicitud: signRequest.id_solicitud,
        actor: req.api_key_hash_prefix || 'system',
        ip: req.ip,
      });

      res.json({
        id_solicitud: signRequest.id_solicitud,
        token: recovery.token,
        url_publica: recovery.url_publica,
        qr_payload: recovery.url_publica,
        fecha_expiracion: signRequest.fecha_expiracion,
        estado: signRequest.estado,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// 8C: POST /internal/sign-requests/:id/link/rotate (rotación del enlace)
// =============================================================================
//
// Emite un token NUEVO para la solicitud y lo devuelve UNA SOLA VEZ.
//
// Es el mecanismo que reemplaza a la recuperación del token cifrado (el
// endpoint GET /link, deprecado). El motivo es el 3.6(e) del Acuerdo de uso:
// el token "se conserva únicamente en forma de huella digital". Con la
// rotación, la necesidad operativa que cubría la recuperación —"la Empresa
// perdió la respuesta de creación"— se cubre sin guardar el token en una
// forma reversible.
//
// LO QUE SE INVALIDA
// --------------------
// La reemisión deja SIN EFECTO el token anterior: el que se emite es el único
// que sirve. Es el 3.4(c) del Acuerdo v1.1: "cada reemisión se registra y deja
// sin efecto el token anterior. No hay más de un token vigente por solicitud",
// con la condición de código textual: "si el sistema mantiene válidos los
// tokens anteriores, se cambia el código antes de publicar".
//
// La rotación no extiende el plazo: emite otro acceso al mismo plazo.
//
// EL TOPE
// -------
// UN token vigente por solicitud (`MAX_TOKENS_VIGENTES = 1`). No hay tope que
// se alcance: la reemisión siempre revoca, y después de emitir se VERIFICA la
// invariante. Si quedara algún token vigente (fallo del sistema), la
// transacción se revierte y sale 500 TOKEN_INVARIANTE_ROTA: no queda nada
// escrito.
//
// `revocar_anteriores` quedó OBSOLETO: se acepta para no romper clientes que lo
// manden, pero ya no decide. Mandar `false` NO evita la revocación; su valor
// queda en la auditoría (`revocar_anteriores_pedido`).
//
// Status codes:
//   - 200: token emitido { id_solicitud, token, url_publica, qr_payload,
//     emision, expira_en, fecha_expiracion, estado, tokens_activos,
//     revocados }
//   - 400: id malformado o body inválido (zod)
//   - 401/403/429: middleware
//   - 404 NOT_FOUND: no existe o cross-company (silent)
//   - 410 LINK_NOT_AVAILABLE: la solicitud está en estado terminal
//   - 500 TOKEN_INVARIANTE_ROTA: se rompió la invariante del 3.4(c)
//
// Side effects:
//   - INSERT en gh_firma_tokens
//   - UPDATE de revocación de los tokens vivos anteriores (siempre)
//   - INSERT en gh_firma_eventos (evento=LINK_ROTATED)

router.post('/sign-requests/:id/link/rotate',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  validateBody(signRequestRotateBody),
  (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404 (no revelar existencia de recurso cross-company).
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      const actor = req.api_key_hash_prefix
        ? `rh:${req.api_key_hash_prefix}`
        : 'sistema';

      // El service lanza AppError si la solicitud está terminal (410).
      //
      // La reemisión deja sin efecto el token anterior SIEMPRE (3.4(c)): el
      // `revocar_anteriores` del cuerpo ya no decide, solo queda en el
      // registro de auditoría de lo que pidió el cliente.
      const emitido = signRequestService.emitirToken({
        firmaId: signRequest.id,
        actor,
        motivo: req.body.motivo || null,
        origen: 'rotate',
        revocarAnteriores: true,
      });

      // Auditoría: la emisión de un token es un hecho que queda registrado.
      try {
        signRequestService.registerEvent(
          signRequest.id,
          'LINK_ROTATED',
          {
            emision: emitido.emision,
            origen: 'rotate',
            revoco_anteriores: true,
            revocar_anteriores_pedido: req.body.revocar_anteriores ?? null,
            revocados: emitido.revocados,
            api_key_hash_prefix: req.api_key_hash_prefix || null,
          },
          actor,
          req.ip,
          req.get('User-Agent') || null,
        );
      } catch (e) {
        // El token ya se emitió: la auditoría es best-effort (igual que
        // LINK_RETRIEVED). El token queda registrado en gh_firma_tokens de
        // todas formas, que es el registro que importa.
        logger.warn('8C: no se pudo registrar el evento LINK_ROTATED', {
          id_solicitud: signRequest.id_solicitud,
          error: e.message,
        });
      }

      logger.info('Enlace rotado', {
        id_solicitud: signRequest.id_solicitud,
        emision: emitido.emision,
        actor,
        ip: req.ip,
      });

      const activos = signRequestService.tokensActivosDe(signRequest.id);

      res.json({
        id_solicitud: signRequest.id_solicitud,
        // El token en texto claro, UNA sola vez: no se guarda en ninguna
        // forma recuperable.
        token: emitido.token,
        url_publica: emitido.url_publica,
        qr_payload: emitido.url_publica,
        emision: emitido.emision,
        expira_en: emitido.expira_en,
        fecha_expiracion: signRequest.fecha_expiracion,
        estado: signRequest.estado,
        tokens_activos: activos.length,
        revocados: emitido.revocados,
      });
    } catch (err) {
      next(err);
    }
  });

// =============================================================================
// I-103.A1.5.1: POST /internal/sign-requests/:id/notify-remote
// =============================================================================
// Envía (o re-envía) la invitación al firmante por correo. Es el "primer
// contacto" con el firmante después de que K+AIR creó el sign request. NO
// genera ni envía OTP (eso ocurre en publicFlow.identify cuando el firmante
// abre la URL).
//
// Auth: requireEmpresaScopeAndLimit con sign_request:read (mismo que /link).
// Re-uso de operation porque semánticamente es "leer el sign request para
// obtener su enlace y enviarlo". NO requiere nueva operation.
//
// 8C: el enlace sale de un token que el cliente aporta (`token` en el body) o
// de uno nuevo que el service emite (rotación). Ya no se recupera de una
// copia cifrada del metadata.
//
// Status codes:
//   - 200: invitación enviada (con messageId + sent_at)
//   - 400: body inválido (sin correo, formato inválido, etc.) — zod
//   - 401/403/429: manejados por el middleware
//   - 404 NOT_FOUND: sign request no existe O cross-company (silent)
//   - 410 GONE INVITE_NOT_AVAILABLE:
//       - sign request en estado terminal (SIGNED/REJECTED/REVOKED/EXPIRED/CANCELLED)
//       - sign request sin token cifrado (legacy pre-I-013b)
//   - 502 BAD_GATEWAY INVITE_EMAIL_FAILED: mailer lanzó (SMTP caído, red, etc.)
//
// Side effects:
//   - INSERT en gh_firma_eventos (evento=INVITE_SENT)
//   - SMTP send (dev: jsonTransport, prod: nodemailer real)
//
// Idempotencia: NO se implementa explícita (cada llamada genera un nuevo
// INVITE_SENT en auditoría + potencialmente un correo nuevo). Rate limit
// del middleware (4 capas) previene abuse.

router.post('/sign-requests/:id/notify-remote',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  validateBody(signRequestNotifyBody),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      let signRequest;

      // Mismo patrón que /link: aceptar SIGN-YYYY-NNNNNN o entero positivo.
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404 (no revelar existencia de recurso cross-company).
      if (req.authSource === 'client' &&
          signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Estado terminal: 410. Mismo set que /link (no se re-envía invitación
      // a un sign request que ya firmó, rechazó, expiró, fue revocado o
      // cancelado).
      const terminalStates = ['SIGNED', 'REJECTED', 'REVOKED', 'EXPIRED', 'CANCELLED'];
      if (terminalStates.includes(signRequest.estado)) {
        return res.status(410).json({
          error: {
            code: 'INVITE_NOT_AVAILABLE',
            message: `No se puede enviar invitación en estado terminal '${signRequest.estado}'`,
            details: { current_state: signRequest.estado, reason: 'terminal_state' },
            request_id: req.id,
          },
        });
      }

      // Llamar al service. Él se encarga de:
      //   - Recuperar el token vía getTokenForRecovery (lanza 410 si legacy)
      //   - Enviar el correo vía mailer.sendInvite (lanza 502 si SMTP falla)
      //   - Registrar evento INVITE_SENT (best-effort)
      const result = await signRequestService.notifyRemote(
        signRequest,
        req.body.correo,
        {
          actor: req.api_key_hash_prefix
            ? `rh:${req.api_key_hash_prefix}`
            : 'sistema',
          ip: req.ip,
          user_agent: req.get('User-Agent') || null,
          context: req.body.context || null,
          // 8C: si el cliente manda el token que ya tenía, la invitación sale
          // con ESE enlace (no se emite otro y no se gasta un cupo de
          // rotación). Si no, el service emite uno nuevo.
          token: req.body.token || null,
        }
      );

      res.json({
        ok: true,
        id_solicitud: signRequest.id_solicitud,
        messageId: result.messageId,
        sent_at: result.sent_at,
        evento_id: result.evento_id,
      });
    } catch (err) {
      // AppError: el service lo lanza con códigos ricos (410, 502, etc.).
      // Dejamos que el errorHandler central los traduzca.
      next(err);
    }
  }
);

/**
 * POST /internal/sign-requests/:id/resend-otp
 * Wrapper per-empresa de publicFlow.resendOtp() para que K+AIR pueda
 * reenviar el OTP al firmante desde el panel de Firma Electrónica.
 *
 * Patrón espejo de POST /api/sign/:token/resend-otp (mini-app, auth por
 * token en URL). Aquí la auth es per-empresa (X-Internal-API-Key) y se
 * resuelve el token server-side vía getTokenForRecovery (mismo mecanismo
 * que GET /:id/link, I-013b).
 *
 * Reutiliza 100% de la lógica de publicFlow.resendOtp():
 *   - Validación de estado ∈ {OTP_SENT, OTP_LOCKED}
 *   - Rate-limit in-memory 5/h por SR
 *   - Verificación de OTP_NOT_EXPIRED para OTP_SENT
 *   - Generación de OTP nuevo + UPDATE atómico + invalidación del anterior
 *   - Envío por mailer + eventos de auditoría
 *
 * No modifica la semántica de resendOtp(). El wrapper solo resuelve el
 * token a partir del id y delega.
 *
 * Respuestas:
 *   - 200 {ok, id_solicitud, estado, otp_ttl_seconds, correo_destino_enmascarado, evento_id}
 *   - 400 INVALID_REQUEST_BODY (id malformado)
 *   - 401 INVALID_API_KEY (falta o es inválido X-Internal-API-Key)
 *   - 403 FORBIDDEN (operación no permitida)
 *   - 404 NOT_FOUND (SR no existe o cross-company)
 *   - 410 LINK_NOT_AVAILABLE (SR sin token cifrado / legacy pre-I-013b)
 *   - 409 INVALID_STATE_TRANSITION (estado no permite resend)
 *   - 400 OTP_NOT_EXPIRED (OTP vigente aún no expiró)
 *   - 422 OTP_LOCKED (resuelto automáticamente por resendOtp; ver 200)
 *   - 429 RATE_LIMIT_EXCEEDED con retry_after_seconds
 *   - 502 OTP_EMAIL_FAILED (mailer lanzó)
 */
router.post('/sign-requests/:id/resend-otp',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:resend_otp'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      // 1. Resolver id (SIGN-YYYY-NNNNNN o entero positivo)
      const { id } = req.params;
      let signRequest;
      if (/^SIGN-\d{4}-\d{6}$/.test(id)) {
        signRequest = signRequestService.getByIdSolicitud(id);
      } else if (/^\d+$/.test(id)) {
        signRequest = signRequestService.getById(parseInt(id, 10));
      } else {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'id debe ser SIGN-YYYY-NNNNNN o entero positivo',
            request_id: req.id,
          },
        });
      }

      if (!signRequest) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // Cross-company silent 404 (mismo patrón que GET /:id/link)
      if (req.authSource === 'client' && signRequest.id_empresa !== req.id_empresa) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: `Solicitud ${id} no encontrada`,
            request_id: req.id,
          },
        });
      }

      // 2. 8C: ya no se recupera el token.
      //
      // Antes este endpoint descifraba el token del metadata para pasarlo a
      // publicFlow.resendOtp(), que solo lo usaba para encontrar la solicitud.
      // La 8C dejó de guardar el token de forma recuperable, así que el
      // reenvío se hace sobre la solicitud que este endpoint ya resolvió por
      // id: el token nunca hizo falta para reenviar un OTP.
      //
      // 3. Delegar a publicFlow.resendOtpDeSignRequest() (reutiliza 100% de
      //    la lógica: estado, rate-limit, OTP_NOT_EXPIRED, generación, UPDATE
      //    atómico, mailer, eventos de auditoría).
      const result = publicFlow.resendOtpDeSignRequest(
        signRequest,
        req.ip,
        req.get('User-Agent') || null,
      );

      logger.info('OTP reenviado via K+AIR', {
        id_solicitud: signRequest.id_solicitud,
        actor: req.api_key_hash_prefix
          ? `rh:${req.api_key_hash_prefix}`
          : 'sistema',
        ip: req.ip,
      });

      res.json({
        ok: true,
        id_solicitud: signRequest.id_solicitud,
        estado: result.estado,
        otp_ttl_seconds: result.otp_ttl_seconds,
        correo_destino_enmascarado: result.correo_destino_enmascarado,
      });
    } catch (err) {
      // AppError: resendOtp lanza códigos ricos (409 INVALID_STATE_TRANSITION,
      // 400 OTP_NOT_EXPIRED, 422 OTP_LOCKED, 429 RATE_LIMIT_EXCEEDED).
      // Dejamos que el errorHandler central los traduzca.
      next(err);
    }
  }
);

// =============================================================================
// 9A · LA FIRMA EN PAPEL, LOS MEDIOS Y EL SUMINISTRO A AUTORIDADES
// =============================================================================
// Rutas internas (las usa K+AIR, el cliente de escritorio).
//
// - POST /internal/sign-requests/:id/firma-papel     → la Empresa registra el
//   documento ya firmado en papel (el 7.2).
// - GET  /internal/sign-requests/:id/medios          → los medios autorizados
//   del Trabajador (el 8.2): por dónde se le puede entregar la copia.
// - POST /internal/sign-requests/:id/suministro-autoridad → el asiento del
//   suministro del documento a una autoridad (el 8.4).
// =============================================================================

/**
 * POST /internal/sign-requests/:id/firma-papel
 *
 * La Empresa entrega el documento en papel, el Trabajador lo firma y la
 * Empresa registra aquí el documento ya firmado (el PDF escaneado).
 *
 * multipart/form-data:
 *   - documento: el PDF del documento firmado en papel
 *
 * Qué hace el servicio (ver services/publicFlow.registrarFirmaEnPapel):
 *   - guarda el PDF y le calcula la huella (la calcula el servidor);
 *   - genera el "Registro de firma autográfica" (la evidencia del acto);
 *   - deja el asiento y el evento;
 *   - le entrega la copia al Trabajador por un medio que él autorizó.
 *
 * La vía en papel la abre la Empresa (el Trabajador le pide el papel por su
 * canal de atención). Si no estaba abierta, se abre con el asiento
 * `PAPER_TRACK_OPENED`, que guarda el canal por el que llegó la petición.
 *
 * La vía electrónica de la solicitud queda cerrada (CANCELLED): el documento
 * se firmó a mano. Cerrarla es lo que impide la doble firma.
 */
router.post('/sign-requests/:id/firma-papel',
  requireEmpresaScopeAndLimit({
    // `sign_request:write` es la operación propia de esta ruta. Se acepta
    // también `sign_request:create` para no dejar sin camino a los clientes
    // que hoy solo tienen esa: el registro en papel ES la creación de la
    // firma, del mismo modo que lo es la firma electrónica.
    allowedOperations: ['sign_request:write', 'sign_request:create'],
    rateLimit: { tier: 'standard' },
  }),
  uploadPdf(),
  pdfValidation(),
  async (req, res, next) => {
    try {
      const signRequest = _resolverInterno(req, res);
      if (!signRequest) return;

      // El `metadata` (multipart, JSON) es opcional: ahí va el canal por el
      // que el Trabajador pidió el papel, que es lo que prueba que la vía
      // existía y era accesible.
      let meta = {};
      if (typeof req.body.metadata === 'string' && req.body.metadata.length > 0) {
        try {
          meta = JSON.parse(req.body.metadata);
        } catch (e) {
          return res.status(400).json({
            error: {
              code: 'INVALID_REQUEST_BODY',
              message: 'El campo "metadata" debe ser JSON válido',
              request_id: req.id,
            },
          });
        }
      }

      const resultado = await publicFlow.registrarFirmaEnPapel(
        signRequest.id_solicitud,
        {
          pdfBuffer: req.file.buffer,
          pdfHash: req.pdfValidation.sha256,
          actor: (req.client && req.client.id_cliente) || 'empresa',
          ip: req.ip,
          user_agent: req.get('User-Agent'),
          canal: meta.canal || null,
          motivo: meta.nota || null,
          metadata: {
            nombre_archivo: req.file.originalname || null,
          },
        }
      );
      res.json(resultado);
    } catch (err) {
      next(err);
    }
  });

/**
 * GET /internal/sign-requests/:id/medios
 *
 * Los medios electrónicos que el Trabajador autorizó (el 8.2).
 *
 * La Empresa lo necesita para entregar las copias: el 8.2 dice que el
 * documento se suministra "siempre al Trabajador a través de un medio
 * electrónico autorizado por el mismo". Sin esta vista, la Empresa no sabe
 * a qué buzón puede entregarle la copia.
 */
router.get('/sign-requests/:id/medios',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  (req, res, next) => {
    try {
      const signRequest = _resolverInterno(req, res);
      if (!signRequest) return;

      const medios = mediosService.listarTodos(
        signRequest.id_empresa,
        signRequest.id_trabajador
      );
      res.json({
        id_solicitud: signRequest.id_solicitud,
        id_trabajador: signRequest.id_trabajador,
        medios: medios.map((m) => ({
          tipo: m.tipo,
          valor: m.valor,
          estado: m.estado,
          origen: m.origen,
          fecha_registro: m.fecha_registro,
        })),
        // Solo por estos medios se entrega la copia (el 8.2).
        medios_activos: medios
          .filter((m) => m.estado === 'ACTIVO')
          .map((m) => ({ tipo: m.tipo, valor: m.valor })),
      });
    } catch (err) {
      next(err);
    }
  });

/**
 * POST /internal/sign-requests/:id/suministro-autoridad
 *
 * El 8.4: "Cuando sea necesario, la Empresa suministrará a las autoridades
 * judiciales y a las de inspección, vigilancia y control en asuntos laborales
 * y administrativas los documentos firmados electrónicamente que sean
 * requeridos."
 *
 * Lo que el sistema hace es dejar el ASIENTO del suministro: quién lo pidió,
 * a qué autoridad, con qué radicado y con qué huella del documento. El
 * documento lo entrega la Empresa (es su deber, el 8.4 lo dice de ella).
 *
 * El asiento va al registro de eventos, que es append-only: el suministro a
 * una autoridad es de las cosas que más se auditan.
 */
router.post('/sign-requests/:id/suministro-autoridad',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:write', 'sign_request:create'],
    rateLimit: { tier: 'standard' },
  }),
  validateBody(suministroAutoridadBody),
  (req, res, next) => {
    try {
      const signRequest = _resolverInterno(req, res);
      if (!signRequest) return;

      // El documento que se suministra: el firmado (o el de papel, si la
      // firma fue autográfica).
      const firmaPapel = papelService.obtenerPorSolicitud(signRequest.id_solicitud);
      let ruta = null;
      let etiqueta = null;
      if (firmaPapel && firmaPapel.estado === papelService.ESTADOS.FIRMADO) {
        ruta = firmaPapel.pdf_firmado_path;
        etiqueta = 'firmado_en_papel';
      } else if (signRequest.pdf_firmado_path) {
        ruta = signRequest.pdf_firmado_path;
        etiqueta = 'firmado';
      } else {
        return res.status(409).json({
          error: {
            code: 'DOCUMENT_NOT_SIGNED',
            message: 'Esta solicitud todavía no tiene un documento firmado para suministrar',
            request_id: req.id,
          },
        });
      }

      const archivo = storage.readPdfIfExists(ruta);
      if (!archivo.found) {
        return res.status(404).json({
          error: {
            code: 'PDF_NOT_FOUND',
            message: 'El archivo del documento firmado no existe en disco',
            request_id: req.id,
          },
        });
      }

      const actor = (req.client && req.client.id_cliente) || 'empresa';
      const metadata = {
        autoridad: req.body.autoridad,
        radicado: req.body.radicado || null,
        destinatario: req.body.destinatario || null,
        tipo_documento_suministrado: etiqueta,
        pdf_sha256: req.body.pdf_sha256 || null,
        id_solicitud: signRequest.id_solicitud,
      };
      signRequestService.registerEvent(
        signRequest.id,
        'DOCUMENT_SUPPLIED_TO_AUTHORITY',
        metadata,
        actor,
        req.ip,
        req.get('User-Agent')
      );

      res.json({
        ok: true,
        id_solicitud: signRequest.id_solicitud,
        documento: {
          etiqueta,
          nombre_archivo: signRequest.id_solicitud + '.pdf',
          bytes: archivo.buffer.length,
        },
        asiento: metadata,
        aviso: 'El suministro quedó asentado. Entregá el documento a la '
          + 'autoridad por el canal que corresponda.',
      });
    } catch (err) {
      next(err);
    }
  });


module.exports = router;
