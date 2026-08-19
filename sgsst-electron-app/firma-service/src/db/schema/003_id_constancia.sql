-- =============================================================================
-- Migración 003: id_constancia UUID en sign requests
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- Cambios:
--   1. Agrega columna id_constancia TEXT a gh_firmas_electronicas.
--      El id_constancia se genera server-side como crypto.randomUUID() en el
--      momento del commit. Es el identificador único de la Constancia PDF
--      entregada al firmante. También se incrusta en el PDF firmado.
--   2. Crea índice UNIQUE parcial (id_constancia NOT NULL) para garantizar
--      unicidad. La columna no puede ser UNIQUE directamente porque SQLite
--      no permite ALTER TABLE ADD COLUMN con UNIQUE en tablas con datos
--      existentes (limitación documentada).
--
-- Backfill:
--   - Los sign requests históricos (estado=SIGNED anteriores a este cambio)
--     quedan con id_constancia = NULL. No se hace backfill porque:
--       (a) El id_constancia anterior se derivaba del timestamp fecha_firma
--           (formato GEN-YYYY-MM-DDTHH-mm-ss-fffZ), que NO es único bajo
--           colisiones de milisegundo y NO es recuperable sin reconstruirlo.
--       (b) Los sign requests SIGNED previos no tienen una Constancia PDF
--           asociada a este id (la Constancia ya está en disco con el
--           nombre de archivo derivado del id_solicitud, no del id_constancia).
--
-- Tests:
--   - El test e2e verifica que un commit nuevo genera id_constancia UUID v4.
--   - El test de compatibilidad verifica que los sign requests históricos
--     siguen funcionando (id_constancia=NULL no rompe la lectura).
-- =============================================================================

ALTER TABLE gh_firmas_electronicas
  ADD COLUMN id_constancia TEXT;

-- Índice UNIQUE para garantizar unicidad de los id_constancia no-NULL.
-- Usamos WHERE id_constancia IS NOT NULL para no chocar con los históricos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_firmas_id_constancia_unica
  ON gh_firmas_electronicas(id_constancia)
  WHERE id_constancia IS NOT NULL;

