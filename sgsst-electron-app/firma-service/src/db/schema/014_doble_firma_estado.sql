-- =============================================================================
-- Migración 014: Extender CHECK constraint de gh_firmas_electronicas.estado
--                para incluir 'DUAL_FIRMADO' (I-FIRMA-DUAL)
-- =============================================================================
-- Motivación:
--   La firma dual (worker + representante legal) implementada en la migration
--   013 requiere que un sign request del representante quede marcado como
--   DUAL_FIRMADO al finalizar. Pero el CHECK constraint actual (definido en
--   migration 005) NO incluye ese valor, así que el UPDATE en
--   publicFlow.commit() falla con CHECK constraint violation (atrapado por
--   un try/catch, así que el commit del rep sigue funcionando pero la
--   auditoría queda incompleta).
--
-- Cambio:
--   Recrear gh_firmas_electronicas con el schema completo (incluyendo las
--   4 columnas nuevas de migration 013) y CHECK extendido a 15 estados
--   (agrega 'DUAL_FIRMADO').
--
--   Recrear los 7 índices de 005 + los 3 índices de 013 (parent,
--   tipo_firmante, UNIQUE parcial sobre parent).
--
-- Patrón 12-step:
--   SQLite no soporta ALTER CHECK directamente. Hay que:
--     1. Crear tabla nueva con el schema deseado
--     2. Copiar filas
--     3. DROP original
--     4. RENAME nueva
--     5. Recrear índices
--
--   Requiere foreign_keys=OFF durante la ejecución (igual que migration 005).
--   El runner (src/db/migrate.js) maneja esto automáticamente.
--
-- Estados en el CHECK (15, +1 vs 005):
--   PENDING, OPENED, IDENTIFICATION_STARTED, IDENTIFIED,
--   OTP_SENT, OTP_VERIFIED, DOCUMENT_VIEWED,
--   SIGNED, DUAL_FIRMADO, REJECTED, EXPIRED,
--   REVOKED, CANCELLED, OTP_LOCKED, IDENTIFICATION_FAILED
-- =============================================================================

-- 1. Crear la nueva tabla con schema completo (52 columnas, incluye las 4 de 013)
--    y CHECK extendido a 15 estados.
CREATE TABLE gh_firmas_electronicas_new (
  id INTEGER,
  id_solicitud TEXT NOT NULL,
  id_documento TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  tipo_firma TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDING',
  document_hash_original TEXT NOT NULL,
  document_hash_firmado TEXT,
  agreement_hash TEXT NOT NULL,
  evidence_hash TEXT,
  token_hash TEXT NOT NULL,
  identificacion_tipo TEXT,
  identificacion_numero_hash TEXT,
  identificacion_coincidio INTEGER,
  correo_verificacion TEXT,
  correo_hash TEXT,
  otp_hash TEXT,
  otp_sal TEXT,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  otp_bloqueado INTEGER NOT NULL DEFAULT 0,
  ip_origen TEXT,
  user_agent TEXT,
  sesion_id TEXT,
  verification_channel TEXT NOT NULL DEFAULT 'email',
  fecha_creacion TEXT NOT NULL,
  fecha_expiracion TEXT NOT NULL,
  fecha_apertura TEXT,
  fecha_otp_enviado TEXT,
  fecha_otp_verificado TEXT,
  fecha_documento_visto TEXT,
  fecha_manifestacion TEXT,
  fecha_firma TEXT,
  fecha_revocacion TEXT,
  motivo_revocacion TEXT,
  motivo_rechazo TEXT,
  version_kair TEXT NOT NULL,
  manifestacion_voluntad_texto TEXT,
  manifestacion_voluntad_hash TEXT,
  pdf_original_path TEXT,
  pdf_firmado_path TEXT,
  constancia_path TEXT,
  metadata TEXT,
  agreement_version TEXT,
  id_constancia TEXT,
  consent_id INTEGER,
  identificacion_numero_sal TEXT,
  tipo_identificacion TEXT,
  -- 4 columnas nuevas de migration 013
  requiere_firma_empresa INTEGER NOT NULL DEFAULT 0,
  tipo_firmante TEXT NOT NULL DEFAULT 'TRABAJADOR',
  parent_id_solicitud TEXT,
  representante_legal_snapshot TEXT,
  PRIMARY KEY (id AUTOINCREMENT),
  -- CHECK extendido (15 estados, +DUAL_FIRMADO)
  CHECK (estado IN (
    'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
    'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_VIEWED',
    'SIGNED', 'DUAL_FIRMADO', 'REJECTED', 'EXPIRED',
    'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'
  )),
  UNIQUE (id_solicitud),
  UNIQUE (token_hash)
);

-- 2. Copiar todas las filas (preserva id AUTOINCREMENT y todos los campos).
--    Esta copia incluye las 4 columnas nuevas de 013 — los defaults
--    (requiere_firma_empresa=0, tipo_firmante='TRABAJADOR', parent_id_solicitud=NULL,
--    representante_legal_snapshot=NULL) se aplican automáticamente a filas legacy.
INSERT INTO gh_firmas_electronicas_new
  SELECT * FROM gh_firmas_electronicas;

-- 3. DROP de la tabla original. Con foreign_keys=OFF (gestionado por el runner),
--    este DROP no falla por las FKs de gh_firma_eventos y gh_firma_sesiones.
DROP TABLE gh_firmas_electronicas;

-- 4. Renombrar la nueva tabla al nombre original.
--    SQLite actualiza las referencias de sqlite_sequence automáticamente
--    (la entrada AUTOINCREMENT sigue al renombre).
ALTER TABLE gh_firmas_electronicas_new
  RENAME TO gh_firmas_electronicas;

-- 5. Recrear los 7 índices originales de migration 005.
CREATE INDEX idx_firmas_agreement_version
  ON gh_firmas_electronicas(agreement_version);
CREATE INDEX idx_firmas_consent_id
  ON gh_firmas_electronicas(consent_id);
CREATE INDEX idx_firmas_documento
  ON gh_firmas_electronicas(id_documento);
CREATE INDEX idx_firmas_empresa_estado_fecha
  ON gh_firmas_electronicas(id_empresa, estado, fecha_creacion DESC);
CREATE UNIQUE INDEX idx_firmas_id_constancia_unica
  ON gh_firmas_electronicas(id_constancia)
  WHERE id_constancia IS NOT NULL;
CREATE INDEX idx_firmas_token_hash
  ON gh_firmas_electronicas(token_hash);
CREATE INDEX idx_firmas_trabajador
  ON gh_firmas_electronicas(id_trabajador, fecha_creacion DESC);

-- 6. Recrear los 3 índices de migration 013.
CREATE INDEX idx_gh_firmas_parent
  ON gh_firmas_electronicas(parent_id_solicitud);
CREATE INDEX idx_gh_firmas_tipo_firmante
  ON gh_firmas_electronicas(tipo_firmante);
CREATE UNIQUE INDEX idx_gh_firmas_unico_hijo
  ON gh_firmas_electronicas(parent_id_solicitud)
  WHERE parent_id_solicitud IS NOT NULL;

-- I-AUDIT-2026-09-10 (C-21 fix): la migración 014 usa el patrón 12-step
-- (CREATE TABLE _new + INSERT SELECT + DROP + RENAME) que recrea la tabla
-- pero pierde los índices definidos por migraciones ANTERIORES. El test
-- C-21 de migration-007.test.js fallaba porque al re-aplicar migrate() los
-- 2 índices de 007 desaparecían. Los agregamos explícitamente aquí con
-- IF NOT EXISTS (idempotente). Si 014 se vuelve a aplicar sobre una BD
-- que ya tiene estos índices, el IF NOT EXISTS evita duplicados.
-- (Cubre la query Q1/Q2 de A2: "firmas por tipo" y "firmas por empresa+tipo+estado".)
CREATE INDEX IF NOT EXISTS idx_firmas_tipo_identificacion
  ON gh_firmas_electronicas(tipo_identificacion);
CREATE INDEX IF NOT EXISTS idx_firmas_empresa_tipo_estado
  ON gh_firmas_electronicas(id_empresa, tipo_identificacion, estado, fecha_creacion DESC);
