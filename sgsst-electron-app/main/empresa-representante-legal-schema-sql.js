// main/empresa-representante-legal-schema-sql.js
// Schema del módulo Representante Legal por empresa (📦2.1 · v0.1.180 · K+AIR Firma Dual)
//
// 1 tabla: empresa_representante_legal
// Patrón: mismo estilo que main/gestion-humana-schema-sql.js (SCHEMA_SQL + MIGRATIONS_SQL).
// 1 fila activa por empresa (soft delete via activo=0). Tabla "huérfana" — no tiene FK
// porque la empresa vive en la tabla `companies` (multi-tenant por empresa_id = company_key).
//
// Empresa multi-tenant: empresa_id es el `company_key` (mismo patrón que todas las
// tablas de gestion-humana). Por eso NO hay FK a companies — el filtro multi-tenant se
// hace por empresa_id en cada query.
//
// Decisión 2026-09-08 (Sprint 2 UI K+AIR): una sola fila activa por empresa
// (no histórico). Si en el futuro se necesita histórico, agregar columna
// `version` o crear tabla `empresa_representante_legal_historial`.
//
// Fechas: ISO 8601 strings, nunca Date objects (consistente con resto del proyecto).
// IDs: INTEGER AUTOINCREMENT (no se expone al usuario; es PK interno).

const SCHEMA_SQL = `
-- 📦2.1 · Representante legal por empresa (K+AIR Firma Dual)
-- 1 fila activa por empresa. Es el firmante dual cuando se requiere
-- firma dual: representante legal + trabajador. Sin correo válido,
-- el envío de la firma dual se bloquea (handler validateForFirma).
CREATE TABLE IF NOT EXISTS empresa_representante_legal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT NOT NULL,                       -- company_key (mismo que companies.company_key)
  nombre TEXT NOT NULL,
  tipo_identificacion TEXT NOT NULL DEFAULT 'CC',  -- CC | CE | TI | PAS | NIT
  numero_identificacion TEXT NOT NULL,
  correo TEXT NOT NULL,                            -- usado para verificación de firma dual
  telefono TEXT,
  cargo TEXT,                                      -- "Representante Legal", "Gerente", etc.
  activo INTEGER NOT NULL DEFAULT 1,               -- soft delete
  creado_en TEXT NOT NULL,                         -- ISO 8601
  actualizado_en TEXT                              -- ISO 8601
);
CREATE INDEX IF NOT EXISTS idx_rep_legal_empresa ON empresa_representante_legal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rep_legal_activo  ON empresa_representante_legal(empresa_id, activo);
`;

// Migrations v1 — vacío (todo en el CREATE TABLE inicial).
// Reservado para ALTERs futuros (ej: agregar columna `firma_dual_requerida INTEGER DEFAULT 1`).
const MIGRATIONS_SQL = [];

module.exports = {
  SCHEMA_SQL: SCHEMA_SQL,
  MIGRATIONS_SQL: MIGRATIONS_SQL,
  // Conteos esperados para validación en tests
  EXPECTED_TABLES: 1,    // empresa_representante_legal
  EXPECTED_INDEXES: 2    // idx_rep_legal_empresa + idx_rep_legal_activo
};
