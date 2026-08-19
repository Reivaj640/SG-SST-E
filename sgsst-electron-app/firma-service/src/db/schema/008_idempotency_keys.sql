-- =============================================================================
-- Migración 008: gh_idempotency_keys (D-1 Fase 1.1, I-003 idempotency)
-- =============================================================================
-- Esta migración crea la tabla de idempotencia para el endpoint
-- POST /v1/internal/sign-requests. La idea es que K+AIR pueda enviar un
-- header "Idempotency-Key" y el firma-service garantice:
--   Misma (id_empresa, idempotency_key) + mismo fingerprint → mismo resultado (REPLAY)
--   Misma (id_empresa, idempotency_key) + fingerprint diferente → 409 IDEMPOTENCY_KEY_CONFLICT
--   In-flight (PENDING) → 409 IDEMPOTENCY_KEY_IN_PROGRESS
--
-- Decisiones de diseño (auditoría cerrada 2026-08-19):
--
--   1. PK compuesta (id_empresa, idempotency_key).
--      Razón: el scope de la idempotencia es por empresa (alineado con I-010).
--      NO usamos surrogate id, NO usamos API key (sería más estricto pero no
--      alineado con la decisión D-13/I-010). Si una empresa quiere otra key
--      con el mismo string, lo hace con OTRA empresa.
--
--   2. request_fingerprint = SHA-256 hex de canonical JSON de
--      { ...metadata, pdf_sha256 }.
--      Razón: G6 refinado durante auditoría. Si el cliente cambia el PDF
--      manteniendo el mismo metadata, el fingerprint cambia → 409 conflict.
--      No almacenamos el PDF completo en la tabla (sería demasiado pesado).
--
--   3. pdf_sha256 = SHA-256 hex del PDF binario (64 chars).
--      Razón: el PDF es parte del request (multipart). Se hashea y se incluye
--      en el fingerprint. NO se almacena el PDF en la tabla.
--
--   4. status: TEXT con CHECK constraint valores ('PENDING','COMPLETED','FAILED','TERMINAL').
--      - PENDING: in-flight, no se ha completado la operación.
--      - COMPLETED: operación exitosa 2xx, response cacheada, REPLAY permitido.
--      - FAILED: error 5xx recuperable, retry permitido.
--      - TERMINAL: rechazo deliberado de negocio, retry bloqueado.
--      Razón: G8 refinado. NO convertir automáticamente cualquier 4xx en TERMINAL.
--      La clasificación TERMINAL es decisión explícita del handler.
--
--   5. response_status (INT NULL) y response_body (TEXT NULL):
--      - NULL mientras PENDING/FAILED.
--      - Populated en COMPLETED (respuesta cacheada para REPLAY).
--      - Populated en TERMINAL (4xx para devolver igual en retry bloqueado).
--      NO se popula en FAILED (5xx, retry debe ser limpio).
--
--   6. created_at: timestamp de creación (PENDING).
--   7. expires_at: created_at + 24h (TTL por diseño INTEGRATION §1 decisión #1).
--      La limpieza es LAZY (en cada request que lee la tabla, no hay timer).
--   8. completed_at: timestamp de COMPLETED/FAILED/TERMINAL (NULL mientras PENDING).
--
--   9. Índice sobre expires_at para que la limpieza lazy sea eficiente.
--      No usamos índice sobre (id_empresa, idempotency_key) porque ya está
--      cubierto por la PK compuesta.
--
-- Tests (C-21 — registry-first, NO re-ejecutar SQL):
--   - tests/migration-008.test.js:
--     * El archivo 008_idempotency_keys.sql existe y contiene CREATE TABLE + CHECK + índice
--     * La migración aplica sobre BD con 7 migraciones previas (001-007) sin romper nada
--     * Las columnas esperadas existen con tipos correctos
--     * El CHECK constraint del status rechaza valores fuera de la whitelist
--     * El PK compuesta es (id_empresa, idempotency_key)
--     * El índice idx_idempotency_expires existe
--     * Registry: gh_firma_schema_migrations tiene fila para 008 (C-21)
--     * Re-aplicar migrate() no duplica la fila en el registry
--     * Re-aplicar el SQL puro (db.exec) no rompe (IF NOT EXISTS / idempotente)
-- =============================================================================

-- Tabla de idempotencia para POST /v1/internal/sign-requests (D-1 Fase 1.1, I-003).
-- PK compuesta (id_empresa, idempotency_key): scope autoritativo por empresa.
CREATE TABLE IF NOT EXISTS gh_idempotency_keys (
  id_empresa TEXT NOT NULL,                    -- Scope de la idempotencia (por empresa, I-010).
  idempotency_key TEXT NOT NULL,               -- UUID v4 validado por regex en service (max 255 chars).
  request_fingerprint TEXT NOT NULL,           -- SHA-256 hex (64 chars) de canonical JSON { metadata, pdf_sha256 }.
  pdf_sha256 TEXT NOT NULL,                    -- SHA-256 hex (64 chars) del PDF binario del request.
  status TEXT NOT NULL DEFAULT 'PENDING',      -- PENDING | COMPLETED | FAILED | TERMINAL.
  response_status INTEGER,                     -- HTTP status code cacheado (NULL mientras PENDING/FAILED).
  response_body TEXT,                          -- JSON serializado de la respuesta cacheada (NULL mientras PENDING/FAILED).
  created_at TEXT NOT NULL DEFAULT (datetime('now')),                                         -- ISO-ish (YYYY-MM-DD HH:MM:SS), igual que el resto del proyecto.
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+24 hours')),     -- TTL 24h, formato ISO 8601 estricto para la limpieza lazy.
  completed_at TEXT,                           -- ISO-ish de COMPLETED/FAILED/TERMINAL (NULL mientras PENDING).
  PRIMARY KEY (id_empresa, idempotency_key),   -- PK compuesta (scope por empresa).
  CHECK (status IN ('PENDING','COMPLETED','FAILED','TERMINAL'))  -- Whitelist explícita (G8 refinado).
);

-- Índice sobre expires_at para la limpieza lazy (DELETE WHERE expires_at < now).
-- No indexamos (id_empresa, idempotency_key) porque ya está cubierto por la PK compuesta.
CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON gh_idempotency_keys(expires_at);
