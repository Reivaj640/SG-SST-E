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

module.exports = {
  createConsentBody,
  verifyOtpBody,
};
