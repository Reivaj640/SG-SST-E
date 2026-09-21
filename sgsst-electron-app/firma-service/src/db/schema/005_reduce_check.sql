-- =============================================================================
-- Migración 005: Reducción del CHECK constraint de gh_firmas_electronicas.estado
--               de 16 → 14 estados (Bloque E8.4 — proper)
-- =============================================================================
-- Motivación:
--   El CHECK constraint definido en 001_initial.sql permitía 16 estados, pero
--   la realidad de los flujos implementados (Bloques A–E8) solo usa 14:
--     · DOCUMENT_OPENED nunca se asigna (la apertura de documento se modela
--       con el evento 'DOCUMENT_OPENED' en gh_firma_eventos, no como estado
--       del sign request).
--     · MANIFESTATION_RECORDED se reemplazó por un evento de auditoría con el
--       mismo nombre, pero nunca se asigna como estado (la manifestación de
--       voluntad se firma directamente, transicionando a SIGNED).
--
-- Decisión consciente:
--   El commit df7cc787 (Bloque E8.4) intentó hacer esta misma reducción
--   modificando directamente 001_initial.sql — lo que producía schema drift
--   (código con 14, BD con 16) al levantar una BD existente. Esa estrategia
--   fue revertida en d3a5e64c.
--
--   Esta migración 005 es la forma correcta: cambiar el schema de una BD
--   existente sin tocar 001_initial.sql (que refleja la historia del schema
--   inicial) ni requerir reset de la BD.
--
-- Cambio:
--   1. Recrear gh_firmas_electronicas con el mismo schema de columnas pero
--      CHECK reducido a 14 estados (elimina DOCUMENT_OPENED y
--      MANIFESTATION_RECORDED).
--   2. Copiar todas las filas existentes (preservando id AUTOINCREMENT).
--   3. Recrear los 7 índices explícitos (los 2 auto-index de UNIQUE se
--      regeneran automáticamente al crear la tabla).
--
-- Estados eliminados del CHECK:
--   - DOCUMENT_OPENED
--   - MANIFESTATION_RECORDED
--
-- Estados mantenidos (14):
--   PENDING, OPENED, IDENTIFICATION_STARTED, IDENTIFIED,
--   OTP_SENT, OTP_VERIFIED, DOCUMENT_VIEWED,
--   SIGNED, REJECTED, EXPIRED,
--   REVOKED, CANCELLED, OTP_LOCKED, IDENTIFICATION_FAILED
--
-- NOTA sobre la transacción:
--   Esta migración NO incluye BEGIN/COMMIT explícito. Siguiendo la
--   convención del proyecto (ver 001_initial.sql, 002_agreement_version.sql,
--   003_id_constancia.sql, 004_consent_id.sql — ninguno usa BEGIN/COMMIT),
--   la transacción la provee el runner (src/db/migrate.js) que envuelve
--   cada llamada a db.exec() en db.transaction(). Esto es necesario porque
--   better-sqlite3 no soporta transacciones anidadas (BEGIN dentro de una
--   transacción falla con "cannot start a transaction within a transaction").
--
-- Por qué esta migración REQUIERE foreign_keys=OFF durante su ejecución
-- (decisión técnica forzada — gestionada por el runner):
--   El patrón 12-step de SQLite (recreate table con CHECK nuevo) requiere
--   DROP TABLE de la tabla original. Pero gh_firma_eventos.firma_id y
--   gh_firma_sesiones.firma_id tienen FK REFERENCES
--   gh_firmas_electronicas(id). Con foreign_keys=ON, SQLite rechaza el
--   DROP TABLE ("FOREIGN KEY constraint failed"), incluso dentro de una
--   transacción y con defer_foreign_keys=ON (verificado empíricamente en
--   C:\Temp\test-12step-no-fk-off.js — DDL FK checks no son deferrables).
--
--   ⚠️  PERO: PRAGMA foreign_keys es un "no-op" DENTRO de una transacción
--   (https://www.sqlite.org/pragma.html#pragma_foreign_keys):
--     > "This pragma is a no-op within a transaction; foreign key
--     >  constraint enforcement may only be enabled or disabled when
--     >  there is no pending BEGIN or SAVEPOINT."
--
--   Por eso el runner (src/db/migrate.js) maneja el PRAGMA FUERA de la
--   transacción: db.pragma('foreign_keys = OFF') ANTES del db.transaction()
--   y db.pragma('foreign_keys = ON') DESPUÉS. El runner también restaura
--   el estado original si FK estaba en algo distinto de 1 antes de empezar.
--
--   Si esta migración se ejecuta DIRECTAMENTE (sin el runner), el caller
--   es responsable de setear FK=OFF antes de abrir la transacción.
--   Ver tests/migration-005.test.js para el patrón correcto.
--
--   Esto NO es un relajamiento de la convención en runtime: connection.js
--   sigue activando FK=ON en cada conexión nueva, y el runner las restaura
--   tras cada migración.
--
-- Idempotencia:
--   Esta migración NO es idempotente por sí sola. El runner (migrate.js) la
--   registra en gh_firma_schema_migrations y la salta en corridas
--   subsecuentes. No es seguro correrla dos veces (el DROP fallaría en la
--   segunda corrida porque la tabla ya tiene el nuevo CHECK).
-- =============================================================================

-- 1. Crear la nueva tabla con el schema completo y CHECK reducido a 14 estados.
--    (Mismas columnas, defaults, NOT NULL, UNIQUE que la tabla original;
--     solo cambia el CHECK de estado.)
--    NOTA: PRAGMA foreign_keys = OFF debe estar activo ANTES de la
--    transacción (lo gestiona el runner). Ver comentario de cabecera.
CREATE TABLE gh_firmas_electronicas_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_documento TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  tipo_firma TEXT NOT NULL CHECK (tipo_firma IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'PENDING',
  document_hash_original TEXT NOT NULL,
  document_hash_firmado TEXT,
  agreement_hash TEXT NOT NULL,
  evidence_hash TEXT,
  token_hash TEXT NOT NULL UNIQUE,
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
  CHECK (estado IN (
    'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
    'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_VIEWED',
    'SIGNED', 'REJECTED', 'EXPIRED',
    'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'
  ))
);

-- 3. Copiar todas las filas (preserva id AUTOINCREMENT, fecha_creacion, etc.).
--    Esta copia incluye cualquier fila existente con DOCUMENT_OPENED o
--    MANIFESTATION_RECORDED — si las hubiera, la migración FALLARÍA en este
--    INSERT (CHECK constraint failed). En la BD dev actual no hay tales filas
--    (verificado en auditoría: 2 CANCELLED, 2 DOCUMENT_VIEWED, 1 OTP_VERIFIED).
--    Como salvaguarda adicional, si existieran, este INSERT fallaría y toda
--    la transacción haría ROLLBACK automáticamente.
INSERT INTO gh_firmas_electronicas_new
  SELECT * FROM gh_firmas_electronicas;

-- 4. DROP de la tabla original. Con foreign_keys=OFF, este DROP no falla
--    por las FKs de gh_firma_eventos y gh_firma_sesiones.
DROP TABLE gh_firmas_electronicas;

-- 5. Renombrar la nueva tabla al nombre original.
--    SQLite actualiza las referencias de sqlite_sequence automáticamente
--    (la entrada AUTOINCREMENT sigue al renombre).
ALTER TABLE gh_firmas_electronicas_new
  RENAME TO gh_firmas_electronicas;

-- 6. Recrear los 7 índices explícitos. Los 2 auto-index (id_solicitud UNIQUE
--    y token_hash UNIQUE) se regeneran automáticamente al crear la tabla.
--    (Verificado en auditoría: idx_firmas_agreement_version,
--     idx_firmas_consent_id, idx_firmas_documento,
--     idx_firmas_empresa_estado_fecha, idx_firmas_id_constancia_unica,
--     idx_firmas_token_hash, idx_firmas_trabajador.)
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

-- (PRAGMA foreign_keys = ON es restaurado por el runner fuera de la
--  transacción. Esta migración NO lo incluye porque sería no-op aquí.)
