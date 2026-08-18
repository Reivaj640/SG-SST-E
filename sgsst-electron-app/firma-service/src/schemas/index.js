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
  agreement_hash: z.string().regex(/^[0-9a-f]{64}$/, 'agreement_hash debe ser SHA-256 hex'),
  document_hash: z.string().regex(/^[0-9a-f]{64}$/, 'document_hash debe ser SHA-256 hex'),
  ttl_horas: z.coerce.number().int().min(1).max(168).optional(),
  version_kair: z.string().min(1).max(32),
  identificacion_tipo: z.enum(['CC', 'CE', 'TI', 'PPT', 'PA']).optional(),
  identificacion_numero_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
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
