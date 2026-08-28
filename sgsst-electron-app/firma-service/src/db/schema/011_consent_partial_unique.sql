-- =============================================================================
-- Migración 011: UNIQUE constraint parcial en gh_consentimientos_firma
--                  (FASE 3 · A1.5.4-B)
-- =============================================================================
-- Esta migración es CORRECTIVA (cambia un constraint, no solo aditiva).
--
-- Motivación:
--   El schema original (001_initial.sql) define:
--     UNIQUE (id_trabajador, id_empresa, version_acuerdo)
--   en gh_consentimientos_firma.
--
--   Esa UNIQUE TOTAL impide crear un nuevo consentimiento para la misma
--   key (trabajador, empresa, version_acuerdo) si ya existe un registro,
--   INCLUSO si ese registro está en un estado terminal como EXPIRED.
--
--   Esto es problemático: si un consentimiento se expira (por OTP vencido,
--   por admin con POST /expire, etc.), la key queda "ocupada" por un
--   registro inútil y NO se puede crear uno nuevo. Esto bloquea
--   permanentemente el flujo de firma.
--
-- Decisión:
--   Reemplazar la UNIQUE constraint TOTAL por un ÍNDICE ÚNICO PARCIAL
--   que aplique SOLO a estados activos (no terminales):
--     CREATE UNIQUE INDEX idx_consentimientos_key_activo
--       ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo)
--       WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED')
--
--   Estados terminales (ACCEPTED, EXPIRED) NO entran en el índice, así
--   que pueden coexistir con nuevos registros activos para la misma key.
--   Para crear un nuevo consent cuando hay uno ACCEPTED: el service ya
--   retorna `alreadyAccepted: true` (no crea duplicado). Para EXPIRED:
--   el service ahora puede crear uno nuevo (transición limpia).
--
-- Patrón 12-step de SQLite:
--   Recrear la tabla sin la UNIQUE constraint y agregar el índice
--   parcial. Es el mismo patrón que migración 005 (reduce_check),
--   ya documentado allí.
--
--   ⚠️ Esta migración REQUIERE foreign_keys=OFF durante su ejecución
--   (gestionada por el runner, ver src/db/migrate.js):
--     - DROP TABLE de gh_consentimientos_firma falla si gh_consentimientos_eventos
--       tiene filas con FK (FOREIGN KEY constraint failed).
--     - El runner hace db.pragma('foreign_keys = OFF') ANTES de la
--       transacción y db.pragma('foreign_keys = ON') DESPUÉS.
--
-- Backfill:
--   - No hay backfill porque la UNIQUE constraint ya estaba en efecto
--     y los datos existentes la respetan. La nueva constraint parcial
--     es MÁS PERMISIVA (no aplica a EXPIRED/ACCEPTED), así que ningún
--     dato existente viola la nueva constraint.
--
-- Tests:
--   - tests/migration-011.test.js verifica que la migración aplica
--     sin romper datos existentes.
--   - tests/routes/consent-expire.test.js cubre el flujo end-to-end
--     de crear un nuevo consent después de EXPIRED.
-- =============================================================================

-- 1. Crear nueva tabla con el mismo schema de columnas (incluyendo
--    fecha_otp_enviado de migración 010) pero SIN la UNIQUE constraint
--    y SIN el índice idx_consentimientos_trabajador (que era redundante
--    con la UNIQUE).
--    Solo la PRIMARY KEY id INTEGER.
CREATE TABLE gh_consentimientos_firma_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  hash_texto_acuerdo TEXT NOT NULL,
  correo_verificacion TEXT NOT NULL,
  correo_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_sal TEXT NOT NULL,
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

-- 2. Copiar todas las filas preservando id AUTOINCREMENT y demás datos.
INSERT INTO gh_consentimientos_firma_new
  SELECT * FROM gh_consentimientos_firma;

-- 3. DROP de la tabla original. Con foreign_keys=OFF, este DROP no falla
--    por las FKs de gh_consentimientos_eventos.
DROP TABLE gh_consentimientos_firma;

-- 4. Renombrar la nueva tabla al nombre original.
ALTER TABLE gh_consentimientos_firma_new
  RENAME TO gh_consentimientos_firma;

-- 5. Crear el índice único PARCIAL (solo para estados activos).
--    Es la pieza clave de esta migración.
CREATE UNIQUE INDEX idx_consentimientos_key_activo
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo)
  WHERE estado IN ('OTP_PENDING', 'OTP_LOCKED');

-- 6. Recrear el índice genérico para lookups por key (no-único).
CREATE INDEX idx_consentimientos_trabajador
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo);
