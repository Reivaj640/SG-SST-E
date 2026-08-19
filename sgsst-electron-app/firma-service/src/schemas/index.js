/**
 * Schemas de validación con zod.
 *
 * Ver API.md §6.9, §6.10, §6.11.
 */
'use strict';

const { z } = require('zod');

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

module.exports = {
  createConsentBody,
  verifyOtpBody,
  signRequestBody,
  signRequestListQuery,
};
