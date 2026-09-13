-- =============================================================================
-- Migración 002: agreement_version en sign requests + índice único parcial
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- Cambios:
--   1. Agrega columna agreement_version TEXT a gh_firmas_electronicas
--      (nullable a nivel SQL; validación en service es la fuente de verdad,
--      porque SQLite < 3.35 no soporta ALTER COLUMN SET NOT NULL).
--   2. Crea idx_firmas_agreement_version (lookup por versión).
--   3. Crea idx_acuerdo_activa_unica (índice único parcial que garantiza
--      máximo 1 Acuerdo con activa=1 a nivel BD, no solo a nivel aplicación).
--
-- IMPORTANTE: Esta migración NO incluye backfill.
--   - Los sign requests existentes quedan con agreement_version = NULL.
--   - La limpieza de los registros huérfanos se hace con un script
--     dedicado (scripts/cleanup-orphan-sign-requests.js) que se
--     implementará en un commit posterior.
--   - Decidir el valor de agreement_version para sign requests
--     históricos requiere análisis de cada caso por estado, no una
--     regla automática.
--
-- Validación de la relación agreement_version ↔ agreement_hash:
--   - agreement_version identifica la versión (FK lógica, sin constraint).
--   - agreement_hash debe coincidir con el texto_hash de esa versión.
--   - Validación completa se hace en services/signRequest.js#create()
--     (en commit posterior).
-- =============================================================================

-- 1. Nueva columna en sign requests
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN agreement_version TEXT;

-- 2. Índice sobre agreement_version
--    (para queries de admin: listar sign requests por versión)
CREATE INDEX IF NOT EXISTS idx_firmas_agreement_version
  ON gh_firmas_electronicas(agreement_version);

-- 3. Índice único parcial: garantiza "máximo 1 activa" a nivel BD
--    (SQLite soporta índices parciales con WHERE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_acuerdo_activa_unica
  ON gh_firma_acuerdo_versiones(activa)
  WHERE activa = 1;
