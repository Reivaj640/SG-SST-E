/**
 * Schemas de validación con zod.
 *
 * Ver API.md §6.9, §6.10, §6.11.
 */
'use strict';

const { z } = require('zod');
const { TIPOS_IDENTIFICACION } = require('../services/signRequest');  // I-002: single source of truth

/**
 * Schema del body de POST /internal/consentimientos.
 *
 * Ver API.md §6.10.
 */
const createConsentBody = z.object({
  id_trabajador: z.string().min(1).max(64),
  id_empresa: z.string().min(1).max(64),
  version_acuerdo: z.string().min(1).max(32),
  correo_verificacion: z.string().email().max(254),
  kair_version: z.string().min(1).max(32),
});

/**
 * Schema del body de POST /internal/consentimientos/:id/verify-otp.
 *
 * Ver API.md §6.11.
 */
const verifyOtpBody = z.object({
  otp: z.string().regex(/^\d{6}$/, 'OTP debe ser 6 dígitos numéricos'),
  kair_version: z.string().min(1).max(32).optional(),
});

/**
 * Schema del campo 'metadata' (JSON) en POST /internal/sign-requests.
 * Se valida como JSON string; el service lo parsea.
 *
 * Ver API.md §6.1.
 */
const signRequestMetadata = z.string()
  .max(8192)
  .optional()
  .refine(
    (v) => {
      if (!v) return true;
      try {
        JSON.parse(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'metadata debe ser JSON válido' },
  );

/**
 * Schema de los campos no-file en POST /internal/sign-requests.
 *
 * Ver API.md §6.1.
 */
const signRequestBody = z.object({
  id_documento: z.string().min(1).max(128),
  id_trabajador: z.string().min(1).max(64),
  id_empresa: z.string().min(1).max(64),
  tipo_firma: z.enum(['presencial', 'remoto']),
  // agreement_version: identifica la versión del Acuerdo que el cliente afirma usar.
  // Es OBLIGATORIO: cada sign request debe quedar vinculado server-side a una
  // versión publicada en gh_firma_acuerdo_versiones. La validación de existencia,
  // activación, vigencia y coincidencia de hash se hace en services/signRequest.js.
  agreement_version: z.string().min(1).max(32),
  agreement_hash: z.string().regex(/^[0-9a-f]{64}$/, 'agreement_hash debe ser SHA-256 hex'),
  document_hash: z.string().regex(/^[0-9a-f]{64}$/, 'document_hash debe ser SHA-256 hex'),
  ttl_horas: z.coerce.number().int().min(1).max(168).optional(),
  version_kair: z.string().min(1).max(32),
  identificacion_tipo: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']).optional(),
  identificacion_numero_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  // P1-2: sal aleatoria por sign request para hashear la cédula.
  //   hash = SHA-256(sal || numero_documento)
  // Si el cliente no la envía, el servicio genera una automáticamente.
  // 32 bytes hex = 64 chars.
  identificacion_numero_sal: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  // consent_id (Bloque E6): vínculo con gh_consentimientos_firma.id.
  // Opcional a nivel schema; la obligatoriedad REAL depende de
  // signRequest.agreement_version: si está presente, el sign request
  // debe estar vinculado a un consentimiento ACEPTADO del mismo
  // (trabajador, empresa, version_acuerdo). La validación se hace en
  // commit() (services/publicFlow.js).
  consent_id: z.coerce.number().int().positive().optional(),
  // I-002 (D-1, A1/A2, migration 007): categoría del documento que se firma.
  // DISTINTO de `identificacion_tipo` (CC, CE, TI, PPT, PA) que es el
  // tipo de documento de IDENTIFICACIÓN del firmante. Esta columna es
  // sobre el documento que se está FIRMANDO (categoría legal/administrativa).
  // Valores en TIPOS_IDENTIFICACION (single source of truth en signRequest.js).
  // Opcional en v1: si K+AIR no lo envía, queda NULL (compatibilidad con
  // sign requests legacy pre-migration 007).
  tipo_identificacion: z.enum(TIPOS_IDENTIFICACION).optional(),
  metadata: signRequestMetadata,
});

/**
 * Schema de query params para GET /internal/sign-requests.
 */
const signRequestListQuery = z.object({
  id_empresa: z.string().max(64).optional(),
  estado: z.union([z.string(), z.array(z.string())]).optional(),
  id_trabajador: z.string().max(64).optional(),
  id_documento: z.string().max(128).optional(),
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Schema del body de POST /internal/sign-requests/:id/notify-remote
 * (I-103.A1.5.1: enviar invitación al firmante).
 *
 * Ver docs/gestion-humana/firma-electronica/API.md §6.X.
 */
const signRequestNotifyBody = z.object({
  // Correo del firmante. Validado como email (RFC 5322 simplificado por zod).
  // z.string().email() rechaza 'foo@bar' (sin TLD) y similares — suficiente
  // para v1. Si el SMTP rebota, publicFlow.identify() caerá al placeholder
  // 'trabajador@ejemplo.com' (ver §"Por ahora, usamos un placeholder" en
  // publicFlow.js). La UI debe pre-validar antes de enviar.
  correo: z.string().email().max(254),
  // Metadata libre: lo que el caller quiera pasar para auditoría
  // (ej. { ip_origen: '...', user_agent: '...' }). NO se loggea en plaintext.
  // Cap de 20 keys y 4KB total para evitar abuse.
  context: z.record(z.string().max(256), z.unknown())
    .refine(
      (v) => Object.keys(v).length <= 20,
      { message: 'context tiene más de 20 keys' },
    )
    .optional(),
});

/**
 * Schema de query params para GET /internal/sign-requests?ids=batch (I-008).
 *
 * Acepta `ids` como string separado por comas. Cada id puede ser
 * `SIGN-YYYY-NNNNNN` o entero positivo. Máximo 200 ids (control de carga
 * para no permitir batches gigantes que agoten la BD).
 *
 * Si `ids` no viene → 400 INVALID_REQUEST_BODY.
 * Si después de trim/filter la lista está vacía → 400 INVALID_REQUEST_BODY.
 * Si algún id no matchea los formatos permitidos → 400 INVALID_REQUEST_BODY
 *   con details.invalid_ids para que K+AIR sepa cuáles rechazó.
 */
const signRequestIdsQuery = z.object({
  ids: z.string()
    .min(1, 'ids es requerido')
    .max(20000, 'ids demasiado largo (máx 20000 chars)')
    .refine(
      (v) => {
        const parts = v.split(',').map(s => s.trim()).filter(Boolean);
        return parts.length > 0;
      },
      { message: 'ids no puede estar vacío' },
    )
    .refine(
      (v) => {
        const parts = v.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length > 200) return false;
        return parts.every(p => /^SIGN-\d{4}-\d{6}$/.test(p) || /^\d+$/.test(p));
      },
      { message: 'ids contiene entradas inválidas o más de 200 ids' },
    ),
});

module.exports = {
  createConsentBody,
  verifyOtpBody,
  signRequestBody,
  signRequestListQuery,
  signRequestIdsQuery,  // I-008: batch query
  signRequestNotifyBody,  // I-103.A1.5.1: notify-remote
};
