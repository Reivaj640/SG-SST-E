/**
 * Ruta de Constancia GENERAL del expediente.
 *
 * - GET /internal/expedientes/:idTrabajador/constancia-consolidada.pdf
 *
 * A diferencia de GET /internal/sign-requests/:id/constancia.pdf (1 constancia
 * persistida por solicitud, solo si está SIGNED), este endpoint genera AL VUELO
 * un PDF consolidado con TODAS las solicitudes de firma del trabajador
 * (firmadas y pendientes), con su trazabilidad completa por documento.
 *
 * Decisiones de diseño:
 *  - Generación al vuelo (sin persistencia): la consolidada siempre refleja el
 *    estado actual del expediente; no contamina storage.PATHS.constancias
 *    (invariante BD↔FS 1:1 de la constancia individual).
 *  - Identificación del firmante COMPLETA (documento interno de la empresa;
 *    la constancia individual que recibe el firmante la enmascara).
 *  - Aislamiento por empresa: en modo 'client' (API key per-empresa) se filtra
 *    por req.id_empresa y un expediente ajenos devuelve 404 silencioso, igual
 *    que el cross-company del endpoint individual. En modo legacy
 *    (authSource='legacy') no hay empresa en el token y no se filtra — mismo
 *    comportamiento que el resto de rutas internas legacy.
 *
 * Auth: requireEmpresaScopeAndLimit con la misma operación que la constancia
 * individual (sign_request:read).
 */
'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const { requireEmpresaScopeAndLimit } = require('../middleware/authz');
const db = require('../db/connection');
const publicFlow = require('../services/publicFlow');
const pdfGenConsolidado = require('../services/pdfGenConsolidado');
const config = require('../config');
const logger = require('../utils/logger');

function _parseMetaSafe(m) {
  try { return m ? JSON.parse(m) : {}; } catch (e) { return {}; }
}

router.get('/expedientes/:idTrabajador/constancia-consolidada.pdf',
  requireEmpresaScopeAndLimit({
    allowedOperations: ['sign_request:read'],
    rateLimit: { tier: 'standard' },
  }),
  async (req, res, next) => {
    try {
      const idTrabajador = String(req.params.idTrabajador || '').trim();
      if (!idTrabajador) {
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST_BODY',
            message: 'idTrabajador requerido',
            request_id: req.id,
          },
        });
      }

      // 1. Todas las solicitudes del trabajador (scope por empresa en modo client)
      let rows;
      if (req.authSource === 'client') {
        rows = db.prepare(`
          SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
                 estado, document_hash_original, document_hash_firmado,
                 evidence_hash, identificacion_tipo, correo_verificacion,
                 consent_id, metadata, fecha_creacion, fecha_firma
          FROM gh_firmas_electronicas
          WHERE id_trabajador = ? AND id_empresa = ?
          ORDER BY fecha_creacion ASC, id ASC
        `).all(idTrabajador, req.id_empresa);
      } else {
        // Modo legacy: sin empresa en el token, mismo comportamiento que el
        // resto de rutas internas legacy (sin filtro por empresa).
        rows = db.prepare(`
          SELECT id, id_solicitud, id_documento, id_trabajador, id_empresa,
                 estado, document_hash_original, document_hash_firmado,
                 evidence_hash, identificacion_tipo, correo_verificacion,
                 consent_id, metadata, fecha_creacion, fecha_firma
          FROM gh_firmas_electronicas
          WHERE id_trabajador = ?
          ORDER BY fecha_creacion ASC, id ASC
        `).all(idTrabajador);
      }

      if (!rows || rows.length === 0) {
        // 404 silencioso (no revela si el expediente existe en otra empresa)
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Expediente sin solicitudes de firma',
            request_id: req.id,
          },
        });
      }

      // 2. Nombres con la misma cadena de fallback que publicFlow.commit():
      //    metadata de cada SR → primer SR (del mismo set) que los tenga.
      let nombreEmpresa = null;
      let nombreTrabajador = null;
      let correoEmpresa = null;          // metadata.correo_empresa (opcional)
      let correoTrabajadorInvitacion = null; // primer correo_verificacion no nulo
      for (const sr of rows) {
        const m = _parseMetaSafe(sr.metadata);
        if (!nombreEmpresa && m.nombre_empresa) nombreEmpresa = m.nombre_empresa;
        if (!nombreTrabajador && m.nombre_trabajador) nombreTrabajador = m.nombre_trabajador;
        if (!correoEmpresa && m.correo_empresa) correoEmpresa = m.correo_empresa;
        if (!correoTrabajadorInvitacion && sr.correo_verificacion) {
          correoTrabajadorInvitacion = sr.correo_verificacion;
        }
        if (nombreEmpresa && nombreTrabajador && correoEmpresa && correoTrabajadorInvitacion) break;
      }

      // 2b. Mapa de títulos reales de documento enviado por K+AIR como query
      //     param: { "<idSolicitud>": "Contrato Laboral", "<idDoc>": "..." }.
      //     firma-service solo conoce el id interno (do-...); el nombre humano
      //     vive en K+AIR. Se tolera ausencia/mal formato (fallback a metadata).
      let titulosPorSolicitud = {};
      let titulosPorDocId = {};
      try {
        const t = req.query.titulos ? JSON.parse(String(req.query.titulos)) : null;
        if (t && typeof t === 'object') {
          titulosPorSolicitud = t.porSolicitud || {};
          titulosPorDocId = t.porDocId || {};
        }
      } catch (e) { /* noop — los títulos son cosméticos, no bloquean */ }

      // 3. Detalle por solicitud: eventos, hitos, consentimiento.
      const stmtEventos = db.prepare(`
        SELECT evento, fecha_hora, ip, id_actor
        FROM gh_firma_eventos
        WHERE firma_id = ?
        ORDER BY fecha_hora ASC, id ASC
      `);

      const documentos = rows.map((sr) => {
        const meta = _parseMetaSafe(sr.metadata);
        let eventos = [];
        try {
          eventos = stmtEventos.all(sr.id);
        } catch (e) {
          logger.warn('No se pudieron leer eventos para la constancia consolidada', {
            id_solicitud: sr.id_solicitud,
            error: e.message,
          });
        }
        const hitos = publicFlow._buildHitosFirma(eventos, sr, sr.fecha_firma);
        const consentResumen = publicFlow._getConsentResumen(sr.consent_id);

        // Nombre humano del documento: mapa de K+AIR > metadata del SR > null
        // (el generador cae al id_solicitud solo si nada más existe).
        const nombreDocumento =
          titulosPorSolicitud[sr.id_solicitud]
          || titulosPorDocId[sr.id_documento]
          || meta.asunto_documento
          || meta.titulo_documento
          || null;

        return {
          nombre_documento: nombreDocumento,
          asunto_documento: nombreDocumento || sr.id_documento,
          id_documento: sr.id_documento,
          id_solicitud: sr.id_solicitud,
          estado: sr.estado,
          // Correo del firmante: el suyo propio; si esta SR vieja no lo
          // guardó, usamos el de otra solicitud del mismo trabajador.
          correo_trabajador: sr.correo_verificacion || correoTrabajadorInvitacion || null,
          correo_emisor: (config.smtp && config.smtp.fromEmail) || null,
          fecha_creacion: sr.fecha_creacion,
          fecha_firma: sr.fecha_firma,
          document_hash_original: sr.document_hash_original,
          document_hash_firmado: sr.document_hash_firmado,
          evidence_hash: sr.evidence_hash,
          id_constancia: sr.estado === 'SIGNED' ? (sr.id_solicitud + ' (ver constancia individual)') : null,
          consent_id: consentResumen ? consentResumen.id : null,
          fecha_aceptacion_acuerdo: consentResumen ? consentResumen.fecha_aceptacion : null,
          hitos_firma: hitos,
          eventos,
          eventos_total: eventos.length,
        };
      });

      const firmados = documentos.filter(function (d) { return d.estado === 'SIGNED'; }).length;

      // 4. Generación al vuelo (no se persiste en disco).
      const pdfBuffer = await pdfGenConsolidado.generateConstanciaConsolidadaPdf({
        id_consolidada: crypto.randomUUID(),
        nombre_empresa: nombreEmpresa,
        nit_empresa: rows[0].id_empresa || null,
        correo_empresa: correoEmpresa,
        correo_emisor: (config.smtp && config.smtp.fromEmail) || null,
        trabajador: {
          nombre: nombreTrabajador,
          identificacion_tipo: rows[0].identificacion_tipo || 'CC',
          identificacion: idTrabajador, // completa: documento interno
          correo_invitacion: correoTrabajadorInvitacion,
        },
        zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        generado_en: new Date().toISOString(),
        documentos,
        totales: {
          documentos: documentos.length,
          firmados,
          pendientes: documentos.length - firmados,
        },
      });

      const filename = `expediente-${idTrabajador}-constancia-consolidada.pdf`;
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'private, no-cache');
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
