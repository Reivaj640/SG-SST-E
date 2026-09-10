-- =============================================================================
-- Migración 016: consentimiento propio del representante legal (I-FIRMA-DUAL)
-- =============================================================================
--
-- Motivación:
--   El sign request hijo (tipo_firmante='EMPRESA') se insertaba con el
--   consent_id DEL TRABAJADOR (heredado del padre). Al aceptar, el rep
--   "aceptaba" el consentimiento ajeno (idempotente) y NO quedaba ningún
--   registro propio de su manifestación (fecha, IP, identidad). La
--   constancia mostraba ID/fecha del trabajador como si fueran del rep:
--   dato objetivamente falso en documento de evidencia.
--
-- Decisión:
--   Agregar rol_firmante ('TRABAJADOR' | 'EMPRESA', default TRABAJADOR) +
--   datos del aceptante (nombre/cargo/identificación) a
--   gh_consentimientos_firma, y extender el índice único parcial para que
--   el rep tenga SU consentimiento por (trabajador, empresa, versión).
--   Filas existentes quedan como TRABAJADOR (sin cambio de conducta).
--   Los DUAL históricos conservan el consent compartido y se rotulan
--   "régimen anterior" en la constancia (no se inventa evidencia pasada).
--
-- Patrón 12-step de SQLite (igual que 005/011/014):
--   Recrear la tabla (ADD COLUMN no alcanza: hay que extender el índice
--   parcial). foreign_keys=OFF lo gestiona el runner (ver migrate.js).
--
-- Backfill: ninguno (defaults cubren filas existentes).
--
-- Tests:
--   - tests/migration-016.test.js verifica que aplica, que conviven un
--     consent TRABAJADOR + uno EMPRESA para la misma key, y que el registry
--     tiene la fila 016.
-- =============================================================================

-- 1. Nueva tabla = columnas actuales + 4 nuevas al final.
CREATE TABLE gh_consentimientos_firma_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  hash_texto_acuerdo TEXT NOT NULL,
  correo_verificacion TEXT NOT NULL,
  correo_hash TEXT NOT NULL,
  otp_hash TEXT,
  otp_sal TEXT,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  fecha_aceptacion TEXT,
  kair_version TEXT NOT NULL,
  manifestacion_aceptada INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'OTP_PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  fecha_otp_enviado TEXT,
  rol_firmante TEXT NOT NULL DEFAULT 'TRABAJADOR',
  nombre_aceptante TEXT,
  cargo_aceptante TEXT,
  identificacion_aceptante TEXT
);

-- 2. Copiar todas las filas (columnas explícitas; las nuevas toman defaults/NULL).
INSERT INTO gh_consentimientos_firma_new
  (id, id_trabajador, id_empresa, version_acuerdo,
   hash_texto_acuerdo, correo_verificacion, correo_hash,
   otp_hash, otp_sal, otp_intentos,
   ip, user_agent, fecha_aceptacion,
   kair_version, manifestacion_aceptada, estado,
   created_at, updated_at, fecha_otp_enviado)
  SELECT id, id_trabajador, id_empresa, version_acuerdo,
   hash_texto_acuerdo, correo_verificacion, correo_hash,
   otp_hash, otp_sal, otp_intentos,
   ip, user_agent, fecha_aceptacion,
   kair_version, manifestacion_aceptada, estado,
   created_at, updated_at, fecha_otp_enviado
  FROM gh_consentimientos_firma;

-- 3. DROP de la original (foreign_keys=OFF gestionado por el runner).
DROP TABLE gh_consentimientos_firma;

-- 4. Renombrar.
ALTER TABLE gh_consentimientos_firma_new
  RENAME TO gh_consentimientos_firma;

-- 5. Índice único parcial extendido con rol_firmante (se perdió en el DROP).
CREATE UNIQUE INDEX idx_consentimientos_key_activo
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo, rol_firmante)
  WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED');

-- 6. Índice no-único para lookups por key + rol (se perdió en el DROP).
CREATE INDEX idx_consentimientos_trabajador
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo, rol_firmante);
