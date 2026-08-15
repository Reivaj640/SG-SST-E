// main/gestion-humana-schema-sql.js
// Schema del módulo Gestión Humana (v0.1.191) — FASE 0
// 3 tablas: contrataciones (pipeline 6 pasos), base_personal (trabajadores), gh_sedes (referencia)
//
// Patrón: mismo estilo que main/presupuesto-schema-sql.js.
// Se ejecuta con sql.js en tests, better-sqlite3 en producción.
//
// Empresa multi-tenant: TODAS las tablas tienen empresa_id + índice.
// IDs: ct-{nanoid} (contrataciones), bp-{nanoid} (base_personal), se-{nanoid} (gh_sedes)
// Fechas: ISO 8601 strings, nunca Date objects
// Soft delete: activo=0 en base_personal. contrataciones usa estado='cancelado' (decisión validada con usuario 2026-08-15)

const SCHEMA_SQL = `
-- 📦709 · Tabla principal: procesos de contratación en curso (pipeline 6 pasos)
CREATE TABLE IF NOT EXISTS contrataciones (
  id TEXT PRIMARY KEY,                       -- formato ct-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  cargo TEXT NOT NULL,
  salario REAL,
  fecha_ingreso TEXT NOT NULL,               -- ISO 8601
  sede_id TEXT,
  empresa_usuaria TEXT,
  paso_actual INTEGER DEFAULT 1,             -- 1-6 (memo, contacto, examenes, documentos, afiliaciones, s400)
  memo_recibido INTEGER DEFAULT 0,
  memo_fecha TEXT,
  memo_notas TEXT,
  contacto_realizado INTEGER DEFAULT 0,
  contacto_fecha TEXT,
  contacto_notas TEXT,
  examenes_programados INTEGER DEFAULT 0,
  examenes_fecha TEXT,
  examenes_ips TEXT,
  examenes_notas TEXT,
  documentos_firmados INTEGER DEFAULT 0,
  documentos_fecha TEXT,
  documentos_notas TEXT,
  afiliaciones_completadas INTEGER DEFAULT 0,
  afiliaciones_fecha TEXT,
  afiliaciones_notas TEXT,
  s400_activado INTEGER DEFAULT 0,
  s400_fecha TEXT,
  s400_notas TEXT,
  estado TEXT DEFAULT 'en_proceso',          -- en_proceso | completado | cancelado
  trabajador_id TEXT,                        -- link a base_personal cuando completa (v0.2)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contrataciones_empresa ON contrataciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contrataciones_estado ON contrataciones(estado);
CREATE INDEX IF NOT EXISTS idx_contrataciones_paso ON contrataciones(paso_actual);

-- 📦709 · Tabla principal: trabajadores activos/inactivos (Base de Personal)
CREATE TABLE IF NOT EXISTS base_personal (
  id TEXT PRIMARY KEY,                       -- formato bp-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'CC',          -- CC | CE | TI | PAS
  fecha_exp_cedula TEXT,
  lugar_exp_cedula TEXT,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  estado_civil TEXT,                         -- soltero | casado | union_libre | separado | viudo
  nivel_educativo TEXT,                      -- primaria | secundaria | tecnico | tecnologo | profesional | especializacion | maestria
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  cargo TEXT,
  salario REAL,
  tipo_contrato TEXT,                        -- indefinido | fijo | prestacion | obra_labor | aprendizaje
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  estado TEXT DEFAULT 'activo',              -- activo | incapacitado | vacaciones | permiso | maternidad | paternidad | luto | retirado
  eps TEXT,
  pension TEXT,
  arl TEXT,
  caja_compensacion TEXT,
  activo_s400 INTEGER DEFAULT 0,
  empresa_usuaria TEXT,
  banco TEXT,
  numero_cuenta TEXT,
  activo INTEGER DEFAULT 1,                  -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(empresa_id, cedula)
);
CREATE INDEX IF NOT EXISTS idx_base_personal_empresa ON base_personal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_base_personal_estado ON base_personal(estado);
CREATE INDEX IF NOT EXISTS idx_base_personal_activo ON base_personal(activo);
CREATE INDEX IF NOT EXISTS idx_base_personal_cedula ON base_personal(empresa_id, cedula);

-- 📦709 · Tabla auxiliar: sedes (referencia para contrataciones y base_personal)
CREATE TABLE IF NOT EXISTS gh_sedes (
  id TEXT PRIMARY KEY,                       -- formato se-{nanoid}
  empresa_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_gh_sedes_empresa ON gh_sedes(empresa_id);
`;

module.exports = {
  SCHEMA_SQL: SCHEMA_SQL,
  // Conteos esperados para validación en tests
  EXPECTED_TABLES: 3,
  EXPECTED_INDEXES: 7  // 3 contrataciones + 4 base_personal + 1 gh_sedes (UNIQUE no se cuenta como índice separado)
};
