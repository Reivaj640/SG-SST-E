// =====================================================================
// 📦708 (2026-08-15) — Schema SQL para Presupuesto SG-SST (Fase 0)
// Migración del submódulo 1.1.3 "Asignación de Recursos" a SQLite.
//
// 3 tablas: presupuestos, presupuesto_partidas, presupuesto_valores_mensuales
// Patrón: mismo estilo que GESTACION_SCHEMA_SQL + email-schema-sql.js
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - Migraciones individuales con try/catch (duplicate column = skip)
//
// Decisiones de diseño documentadas en:
//   docs/plans/presupuesto-bd-migration.md
// =====================================================================

const PRESUPUESTO_SCHEMA_SQL = `
  -- 📦708 — Presupuestos (uno por empresa por año)
  -- Si en 2027 se necesita un nuevo año, se crea un row nuevo
  -- (no se sobreescribe el 2026).
  CREATE TABLE IF NOT EXISTS presupuestos (
    id              TEXT PRIMARY KEY,                -- 'p-{timestamp36}-{rand}'
    empresa_id      TEXT NOT NULL,                   -- FK lógica a companies.company_key
    anio            INTEGER NOT NULL,                -- 2026
    nombre          TEXT NOT NULL,                   -- "Presupuesto SG-SST 2026" (editable)
    notas           TEXT,                            -- notas generales
    creado_en       TEXT NOT NULL,                   -- ISO 8601
    actualizado_en  TEXT NOT NULL,                   -- ISO 8601
    creado_por      INTEGER,                         -- user.id del que lo creó
    UNIQUE(empresa_id, anio)
  );

  CREATE INDEX IF NOT EXISTS idx_presupuestos_empresa ON presupuestos(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_presupuestos_anio    ON presupuestos(anio);

  -- 📦708 — Partidas del presupuesto (las "filas" del Excel)
  -- Típicamente ~19 filas por presupuesto (Honorarios, EPPs, Capacitaciones, etc.)
  CREATE TABLE IF NOT EXISTS presupuesto_partidas (
    id              TEXT PRIMARY KEY,                -- 'pp-{timestamp36}-{rand}'
    presupuesto_id  TEXT NOT NULL,
    numero          INTEGER NOT NULL,                -- 1, 2, 3... (id visual, igual al Excel col A)
    concepto        TEXT NOT NULL,                   -- "Honorarios por los servicios del Profesional..."
    descripcion     TEXT,                            -- opcional, texto libre
    activo          INTEGER NOT NULL DEFAULT 1,      -- soft-delete (0 = borrado)
    creado_en       TEXT NOT NULL,
    actualizado_en  TEXT NOT NULL,
    FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
    UNIQUE(presupuesto_id, numero)
  );

  CREATE INDEX IF NOT EXISTS idx_partidas_presupuesto ON presupuesto_partidas(presupuesto_id);
  CREATE INDEX IF NOT EXISTS idx_partidas_activo       ON presupuesto_partidas(presupuesto_id, activo);

  -- 📦708 — Valores mensuales por partida (12 filas por partida por año)
  -- Total típico: 19 partidas × 12 meses = 228 rows/presupuesto.
  -- Mantenemos "ejecutado" como ACUMULADO para paridad 1:1 con el Excel.
  CREATE TABLE IF NOT EXISTS presupuesto_valores_mensuales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id      TEXT NOT NULL,
    anio            INTEGER NOT NULL,                -- 2026
    mes             INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
    asignado        REAL NOT NULL DEFAULT 0,         -- valor planeado/presupuestado
    ejecutado       REAL NOT NULL DEFAULT 0,         -- valor ejecutado (acumulado, ver nota)
    notas           TEXT,
    actualizado_en  TEXT NOT NULL,
    FOREIGN KEY (partida_id) REFERENCES presupuesto_partidas(id) ON DELETE CASCADE,
    UNIQUE(partida_id, anio, mes)
  );

  CREATE INDEX IF NOT EXISTS idx_pvm_partida ON presupuesto_valores_mensuales(partida_id);
  CREATE INDEX IF NOT EXISTS idx_pvm_anio_mes ON presupuesto_valores_mensuales(anio, mes);
`;

// MIGRATIONS vacías en v1 — el bridge es nuevo, no hay schema previo que migrar.
// Estructura lista para evoluciones futuras (mismo patrón que gestacion-bridge.js).
const PRESUPUESTO_MIGRATIONS_SQL = [
  // Placeholder para futuras migraciones. Ejemplos que vendrán:
  // "ALTER TABLE presupuestos ADD COLUMN ... TEXT"
];

module.exports = {
  PRESUPUESTO_SCHEMA_SQL,
  PRESUPUESTO_MIGRATIONS_SQL
};
