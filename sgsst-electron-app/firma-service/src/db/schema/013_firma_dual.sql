-- 📦 I-FIRMA-DUAL · Migración 013: firma dual (trabajador + empresa)
-- Agrega soporte para que un sign request pueda tener 2 firmas en el mismo PDF.
-- Default OFF (requiere_firma_empresa=0) para mantener compatibilidad con v0.1.179.

-- 1. Flag opt-in (default false → no afecta sign requests existentes)
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN requiere_firma_empresa INTEGER NOT NULL DEFAULT 0;

-- 2. Discriminador del tipo de firmante
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN tipo_firmante TEXT NOT NULL DEFAULT 'TRABAJADOR';

-- 3. Link al sign request padre (NULL para sign requests del worker, NOT NULL para hijos)
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN parent_id_solicitud TEXT;

-- 4. Snapshot del representante legal al momento de crear el sign request padre
--    (solo se popula cuando requiere_firma_empresa=1; formato JSON)
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN representante_legal_snapshot TEXT;

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_gh_firmas_parent
  ON gh_firmas_electronicas(parent_id_solicitud);

CREATE INDEX IF NOT EXISTS idx_gh_firmas_tipo_firmante
  ON gh_firmas_electronicas(tipo_firmante);

-- Constraint: máximo 1 hijo por padre (evita duplicados si commit corre 2 veces)
CREATE UNIQUE INDEX IF NOT EXISTS idx_gh_firmas_unico_hijo
  ON gh_firmas_electronicas(parent_id_solicitud)
  WHERE parent_id_solicitud IS NOT NULL;
