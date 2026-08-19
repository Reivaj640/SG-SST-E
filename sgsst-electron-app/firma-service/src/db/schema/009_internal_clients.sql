-- =============================================================================
-- Migración 009: gh_internal_clients (D-13, I-010 per-company authz)
-- =============================================================================
-- Esta migración crea la tabla de clientes internos que reemplazará el
-- modelo de "1 API key global" por "1 API key por empresa", con un scope
-- explícito de operaciones permitidas.
--
-- Decisiones de diseño (ver docs/kair-firma-integration/I-010-design.md):
--
--   1. api_key_hash como PRIMARY KEY (en vez de un id INTEGER).
--      Razón: el lookup siempre es por hash (lo que llega en el header
--      X-Internal-API-Key se hashea y se busca acá). No necesitamos
--      un surrogate key; el hash ES el identificador.
--
--   2. SHA-256 hex (64 chars) en vez de bcrypt/argon2.
--      Razón: las API keys son strings ≥32 chars con alta entropía
--      (generadas con crypto.randomBytes). No son contraseñas humanas
--      susceptibles a diccionario. SHA-256 es suficiente y rápido.
--      Ver SECURITY.md §8 (decisión D-13) y el design doc.
--
--   3. id_empresa NOT NULL.
--      Razón: cada cliente interno está atado a UNA empresa específica.
--      NO usamos 'id_empresa = *' para representar "legacy global";
--      ese caso se maneja en código con authSource='legacy' y
--      id_empresa=null. Ver I-010 design §3.
--
--   4. allowed_operations como TEXT comma-separated v1.
--      Razón: K+AIR (cliente) necesita un set finito de operaciones
--      bien definidas. La lista es pequeña (5-10 valores), no justifica
--      una tabla aparte ni un JSON parseado. Formato:
--      "sign_request:create,sign_request:read,consent:create,..."
--      En una v2 podría migrarse a JSON si el dominio crece.
--
--   5. description opcional.
--      Razón: para auditoría. Ej: "K+AIR empresa 900123456 - producción".
--      NO se loguea en hot path; solo se muestra en listActiveClients()
--      para operador humano.
--
--   6. revoked_at como NULL = activa, ISO8601 = revocada.
--      Razón: queremos soft-delete. La API key puede ser revocada
--      sin perder el historial (ej. un cliente cambia de empresa y
--      queremos conservar el registro de quién usó esa key).
--      El service internalClient.js#getActiveClientByApiKey filtra
--      por revoked_at IS NULL.
--
--   7. Índice parcial sobre id_empresa WHERE revoked_at IS NULL.
--      Razón: las queries activas filtran por id_empresa (ej. "todos
--      los clientes activos de la empresa X"). El índice parcial es
--      más chico y más rápido que uno full-table.
--
-- Tests:
--   - tests/migration-009.test.js:
--     * El archivo 009_internal_clients.sql existe y contiene CREATE TABLE + índice
--     * La migración aplica sobre BD con 7 migraciones previas sin romper nada
--     * Registry: gh_firma_schema_migrations tiene fila para 009 (C-21)
--     * Idempotencia SQL: re-aplicar el SQL (db.exec) no falla (IF NOT EXISTS)
--     * El hash en BD NO es la API key en plaintext (validación de seguridad)
-- =============================================================================

-- Tabla de clientes internos (per-company authz)
CREATE TABLE IF NOT EXISTS gh_internal_clients (
  api_key_hash TEXT PRIMARY KEY,        -- SHA-256 hex (64 chars). PK = el hash mismo.
  id_empresa TEXT NOT NULL,             -- Empresa a la que está atado el cliente.
  allowed_operations TEXT NOT NULL,     -- CSV de ops permitidas, ej. "sign_request:create,sign_request:read".
  description TEXT,                     -- Auditoría: descripción libre, ej. "K+AIR empresa X - prod".
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT                       -- NULL = activa. ISO8601 (datetime('now')) = revocada.
);

-- Índice parcial sobre clientes activos por empresa.
-- Cubre queries del estilo "todos los clientes activos de la empresa X".
-- El WHERE revoked_at IS NULL mantiene el índice chico: solo filas activas.
CREATE INDEX IF NOT EXISTS idx_internal_clients_empresa_active
  ON gh_internal_clients(id_empresa) WHERE revoked_at IS NULL;
