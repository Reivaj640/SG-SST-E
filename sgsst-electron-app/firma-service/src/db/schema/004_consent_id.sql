-- =============================================================================
-- Migración 004: consent_id en sign requests (Bloque E6)
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- Cambios:
--   1. Agrega columna consent_id INTEGER a gh_firmas_electronicas.
--      Vincula cada sign request con su consentimiento del Acuerdo
--      (gh_consentimientos_firma.id).
--
--      La relación es LÓGICA (no FK física) por las mismas razones que
--      agreement_version:
--        (a) Preservar sign requests legacy (Bloque A — agreement_version=NULL).
--        (b) Evitar migración destructiva de filas existentes.
--        (c) Permitir que la tabla gh_consentimientos_firma se limpie/regenere
--            sin afectar la trazabilidad histórica de firmas.
--
--      La integridad se valida a nivel aplicación en commit() (Bloque E6):
--        - Si signRequest.agreement_version IS NULL → no se valida (legacy)
--        - Si signRequest.agreement_version IS NOT NULL →
--            · signRequest.consent_id IS NOT NULL (requerido)
--            · El consentimiento existe y tiene manifestacion_aceptada=1
--            · Coincide con (id_trabajador, id_empresa, version_acuerdo)
--
--   2. Crea idx_firmas_consent_id (lookup por consentimiento).
--      Útil para queries tipo "todas las firmas vinculadas al consentimiento N".
--
-- Backfill:
--   - Los sign requests existentes quedan con consent_id = NULL.
--   - Los 3 sign requests históricos (2 CANCELLED + 1 OTP_VERIFIED)
--     tienen agreement_version=NULL, por lo que NO requieren consent_id
--     (compatibilidad legacy).
--   - No se hace backfill retroactivo: no se puede saber qué consentimiento
--     correspondió a cada sign request legacy (los consentimientos también
--     pueden haber sido eliminados en limpiezas).
--
-- Tests:
--   - El test E2E verifica que con consent_id válido se firma exitosamente.
--   - Los tests negativos verifican los 5 códigos de error
--     (CONSENT_NOT_FOUND, CONSENT_NOT_ACCEPTED, CONSENT_WORKER_MISMATCH,
--      CONSENT_COMPANY_MISMATCH, CONSENT_VERSION_MISMATCH).
--   - El test de compatibilidad verifica que sign requests legacy
--     (agreement_version=NULL) saltan la validación.
-- =============================================================================

-- 1. Nueva columna en sign requests
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN consent_id INTEGER;

-- 2. Índice sobre consent_id (lookup por consentimiento)
CREATE INDEX IF NOT EXISTS idx_firmas_consent_id
  ON gh_firmas_electronicas(consent_id);
