// =====================================================================
// 📦658 — FURAT (Reportes de Accidentes) — Schema SQL para metadata
// Patrón: mismo estilo que email-schema-sql.js
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - Migraciones individuales (separadas, con try/catch)
// La metadata se guarda en una tabla aparte del filesystem:
// el archivo PDF/xlsx vive en la carpeta del año (ej: /2024/FURAT.pdf),
// y los metadatos (fecha accidente, tipo, gravedad, área, descripción)
// viven en esta tabla indexados por la ruta absoluta del archivo.
// Esto permite queries analíticos (ej: "todos los accidentes graves
// del área X en los últimos 12 meses") sin parsear PDFs.
// =====================================================================

const FURAT_SCHEMA_SQL = `
  -- 📦658 — Metadata de Reportes de Accidentes de Trabajo (FURAT)
  -- Una fila por archivo PDF/xlsx/docx. file_path es la clave única.
  -- Se popula al subir un FURAT nuevo (con metadata del modal) o
  -- al editar manualmente (futuro).
  CREATE TABLE IF NOT EXISTS furat_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,              -- ruta absoluta del archivo
    company_name TEXT NOT NULL,                  -- empresa dueña del FURAT
    accident_date TEXT,                          -- fecha del accidente (ISO 8601: YYYY-MM-DD)
    accident_type TEXT,                          -- tipo (caída, golpe, atrapamiento, etc)
    severity TEXT,                               -- leve | moderado | grave | mortal
    area TEXT,                                   -- área donde ocurrió (texto libre)
    description TEXT,                            -- descripción breve del accidente
    reported_by TEXT,                            -- nombre de quien lo reportó
    upload_date TEXT NOT NULL,                   -- cuándo se subió al sistema (ISO 8601)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_furat_company ON furat_metadata(company_name);
  CREATE INDEX IF NOT EXISTS idx_furat_date ON furat_metadata(accident_date);
  CREATE INDEX IF NOT EXISTS idx_furat_type ON furat_metadata(accident_type);
  CREATE INDEX IF NOT EXISTS idx_furat_severity ON furat_metadata(severity);
  CREATE INDEX IF NOT EXISTS idx_furat_area ON furat_metadata(area);
`;

const FURAT_MIGRATIONS_SQL = [
  // Futuras migraciones idempotentes van acá.
  // Ejemplo de patrón (no descomentar):
  // 'ALTER TABLE furat_metadata ADD COLUMN new_field TEXT;',
];

module.exports = {
  FURAT_SCHEMA_SQL,
  FURAT_MIGRATIONS_SQL
};
