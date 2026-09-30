// =====================================================================
// 📦825 (2026-09-29) — Schema SQL para los programas del submódulo
// 3.1.2 "Actividades de medicina preventiva y promoción de la salud".
//
// 2 tablas: mp_programas, mp_programa_secciones
//
// El esqueleto de gestión de programas permite N programas por línea
// (sve / dme / promocion) y por empresa. Cada programa se crea desde una
// PLANTILLA (ver medprev-programas-bridge.js: MEDPREV_PLANTILLAS) que
// siembra sus secciones; el contenido real de cada sección (dashboard,
// casos, alertas...) llega en fases siguientes — esta v1 solo administra
// el ciclo de vida del programa y el progreso de sus secciones.
//
// Patrón: mismo estilo que presupuesto-schema-sql.js (📦708/824)
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - ALTERS array aplicado con try/catch por sentencia
//   - MIGRATIONS_SQL + MIGRATION_IDS con control de versión
// =====================================================================

const MP_PROGRAMAS_SCHEMA_SQL = `
  -- 📦825 — Programas del 3.1.2 (varios por línea y por empresa).
  -- tipo: 'sve' (Sistema de Vigilancia Epidemiológica, spec del PDF de
  --       Documentación Técnica SVE), 'dme' (Diagnóstico Médico
  --       Epidemiológico) o 'promocion' (promoción y prevención).
  -- estado: 'activo' | 'pausado' | 'cerrado' | 'eliminado' (soft-delete).
  CREATE TABLE IF NOT EXISTS mp_programas (
    id              TEXT PRIMARY KEY,                -- 'mpp-{timestamp36}-{rand}'
    empresa_id      TEXT NOT NULL,                   -- FK lógica a companies.company_key
    tipo            TEXT NOT NULL,                   -- 'sve' | 'dme' | 'promocion'
    nombre          TEXT NOT NULL,                   -- "SVE COVID-19"
    descripcion     TEXT,
    estado          TEXT NOT NULL DEFAULT 'activo',
    fecha_inicio    TEXT,                            -- ISO yyyy-mm-dd
    fecha_fin       TEXT,                            -- ISO yyyy-mm-dd
    plantilla       TEXT NOT NULL DEFAULT 'estandar',-- 'estandar' | 'blanco'
    creado_en       TEXT NOT NULL,                   -- ISO 8601
    actualizado_en  TEXT NOT NULL,                   -- ISO 8601
    creado_por      INTEGER,                         -- user.id del que lo creó

    UNIQUE(empresa_id, tipo, nombre)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_programas_empresa ON mp_programas(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_mp_programas_tipo    ON mp_programas(empresa_id, tipo);

  -- 📦825 — Secciones del programa. Nacen de la plantilla al crear el
  -- programa (o vacías si se crea 'blanco'). El progreso (pendiente /
  -- en_curso / completo) es lo que el esqueleto v1 deja marcar; la
  -- interfaz real de cada sección se construye en fases siguientes.
  CREATE TABLE IF NOT EXISTS mp_programa_secciones (
    id              TEXT PRIMARY KEY,                -- 'mps-{timestamp36}-{rand}'
    programa_id     TEXT NOT NULL,
    clave           TEXT NOT NULL,                   -- 'dashboard', 'casos', ...
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    orden           INTEGER NOT NULL DEFAULT 0,
    estado          TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | en_curso | completo
    actualizado_en  TEXT NOT NULL,

    FOREIGN KEY (programa_id) REFERENCES mp_programas(id) ON DELETE CASCADE,
    UNIQUE(programa_id, clave)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_secciones_programa ON mp_programa_secciones(programa_id);
`;

// 📦825 — DDL de columnas nuevas para bases YA CREADAS por la v1.
// La v1 acaba de nacer con estas tablas: no hay nada que alterar todavía.
// La infraestructura queda lista para que la primera columna nueva de una
// fase siguiente solo agregue una línea aquí (ver presupuesto-schema-sql.js).
const MP_PROGRAMAS_SCHEMA_ALTERS = [];

// 📦825 — Migraciones de datos para bases YA CREADAS por la v1: ninguna.
const MP_PROGRAMAS_MIGRATIONS_SQL = [];

const MP_PROGRAMAS_MIGRATION_IDS = [];

module.exports = {
  MP_PROGRAMAS_SCHEMA_SQL,
  MP_PROGRAMAS_SCHEMA_ALTERS,
  MP_PROGRAMAS_MIGRATIONS_SQL,
  MP_PROGRAMAS_MIGRATION_IDS
};
