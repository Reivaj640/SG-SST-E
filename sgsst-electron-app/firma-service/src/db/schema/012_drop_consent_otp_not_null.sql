-- =============================================================================
-- Migración 012: Permitir NULL en otp_hash y otp_sal de gh_consentimientos_firma
--                  (FASE 4 · A1.5.4-B · REDISEÑO DEL FLUJO DE CONSENTIMIENTO)
-- =============================================================================
-- Esta migración es CORRECTIVA (relaja constraints, no es breaking).
--
-- Motivación:
--   En el rediseño del flujo de firma electrónica (FASE 4), el consentimiento
--   del Acuerdo v1.0 deja de tener su propio OTP. La aceptación se hace en
--   la mini-app como un acto de voluntad del firmante (3ª casilla "He leído
--   y acepto el Acuerdo de Firma Electrónica v1.0") → POST /api/sign/:token/
--   consent/accept → consentService.accept().
--
--   Antes: consent.create() generaba OTP, lo hasheaba con sal, lo guardaba en
--          otp_hash/otp_sal/fecha_otp_enviado, y lo enviaba por email.
--   Ahora: consent.create() solo crea la fila con manifestacion_aceptada=0.
--          El firmante acepta directamente en la mini-app sin OTP previo.
--
--   Las columnas otp_hash y otp_sal son NOT NULL en el schema actual (001_initial).
--   Sin OTP, no tienen valor. Las hacemos NULL-able.
--
--   Compatibilidad:
--   - Los consentimientos legacy (pre-012) siguen funcionando: tienen valores
--     en otp_hash/otp_sal que no se usan pero no molestan.
--   - El UNIQUE INDEX parcial (idx_consentimientos_key_activo, migración 011)
--     no se ve afectado.
--   - El estado default 'OTP_PENDING' se mantiene por ahora (legacy). Un día
--     futuro podemos renombrar a 'PENDING' en otra migración. Mantener el
--     nombre evita una migración costosa de recreación de tabla.
--
-- Patrón:
--   SQLite 3.49.2 (versión de better-sqlite3 12.x) NO soporta
--   `ALTER TABLE ALTER COLUMN ... DROP NOT NULL` en columnas normales
--   (solo en columnas GENERATED). Usamos el patrón 12-step:
--     1. CREATE TABLE new con el schema actualizado
--     2. INSERT INTO new SELECT * FROM old
--     3. DROP TABLE old
--     4. RENAME new TO old
--     5. Re-crear índices que se hayan perdido
--
--   foreign_keys=OFF es manejado por el runner de migraciones (ver
--   src/db/migrate.js) para no romper la FK de gh_consentimientos_eventos.
--
-- Tests:
--   - tests/migration-012.test.js (a crear) verifica que la migración aplica
--     sin romper consentimientos legacy.
--   - tests/routes/consent.test.js requiere actualización: ya no se generan
--     OTP en create(). Los tests deben verificar manifestacion_aceptada=0 y
--     ausencia de mailer.sendOTP() call.
-- =============================================================================

-- 1. Crear nueva tabla con el schema actualizado (otp_hash y otp_sal NULL-able)
CREATE TABLE gh_consentimientos_firma_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  hash_texto_acuerdo TEXT NOT NULL,
  correo_verificacion TEXT NOT NULL,
  correo_hash TEXT NOT NULL,
  otp_hash TEXT,                -- ahora NULL-able
  otp_sal TEXT,                 -- ahora NULL-able
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  fecha_aceptacion TEXT,
  kair_version TEXT NOT NULL,
  manifestacion_aceptada INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'OTP_PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  fecha_otp_enviado TEXT
);

-- 2. Copiar todas las filas (preserva id AUTOINCREMENT y demás datos)
INSERT INTO gh_consentimientos_firma_new
  SELECT * FROM gh_consentimientos_firma;

-- 3. DROP de la tabla original (con foreign_keys=OFF, este DROP no falla
--    por las FKs de gh_consentimientos_eventos)
DROP TABLE gh_consentimientos_firma;

-- 4. Renombrar la nueva tabla al nombre original
ALTER TABLE gh_consentimientos_firma_new
  RENAME TO gh_consentimientos_firma;

-- 5. Re-crear el índice UNIQUE parcial (se perdió en el DROP)
CREATE UNIQUE INDEX idx_consentimientos_key_activo
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo)
  WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED');

-- 6. Re-crear el índice no-único (se perdió en el DROP)
CREATE INDEX idx_consentimientos_trabajador
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo);
