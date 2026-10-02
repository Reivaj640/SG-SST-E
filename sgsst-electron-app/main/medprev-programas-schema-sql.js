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

  -- 📦827-fix — BAJAS de programa ("tombstones").
  --
  -- El soft-delete (estado='eliminado') NO viaja: el serializer manda la lista
  -- de programas que NO están eliminados, así que al archivar uno en la PC A el
  -- programa simplemente falta en el .kairsync y la PC B lo sigue teniendo
  -- vivo, con todos sus datos. Las dos máquinas quedan distintas sin que nada
  -- lo señale. Probado con dos bases y el serializer real.
  --
  -- Para que la baja se propague, el otro equipo necesita un HECHO explícito
  -- ("este programa se eliminó el día tal"), no la simple ausencia del
  -- registro. Eso es lo que se guarda acá. La fila sobrevive al borrado del
  -- programa justamente por eso: si se borrara con él, no habría forma de
  -- contar la baja.
  --
  -- Se conservan los datos NO personales del programa (nombre, tipo, fechas)
  -- para poder explicarle al usuario qué se eliminó y cuándo. Los datos del
  -- SVE (casos con nombre, documento y teléfono) NO van aquí: se borran.
  CREATE TABLE IF NOT EXISTS mp_programas_bajas (
    programa_id     TEXT NOT NULL,
    empresa_id      TEXT NOT NULL,
    tipo            TEXT,
    nombre          TEXT,
    fecha_inicio    TEXT,
    fecha_fin       TEXT,
    eliminado_en    TEXT NOT NULL,                -- ISO 8601
    eliminado_por   TEXT,                         -- id del usuario
    origen          TEXT NOT NULL DEFAULT 'eliminar', -- eliminar | archivo
    PRIMARY KEY (programa_id, empresa_id)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_programas_bajas_empresa ON mp_programas_bajas(empresa_id, eliminado_en);
`;

// 📦825 — DDL de columnas nuevas para bases YA CREADAS por la v1.
// La v1 acaba de nacer con estas tablas: no hay nada que alterar todavía.
// La infraestructura queda lista para que la primera columna nueva de una
// fase siguiente solo agregue una línea aquí (ver presupuesto-schema-sql.js).
const MP_PROGRAMAS_SCHEMA_ALTERS = [];

// 📦826 — Migración de datos: plantilla SVE v2.
// Los programas sve creados con la plantilla v1 (📦825: dashboard, casos,
// alertas, reportes, admin, auditoria) se ajustan a la plantilla v2 (📦826:
// dashboard, casos, plan, indicadores, areas), que es la que tiene interfaz
// real (prototipo sve/). Solo toca programas tipo 'sve'.
const MP_PROGRAMAS_MIGRATIONS_SQL = [
  `DELETE FROM mp_programa_secciones
    WHERE clave IN ('alertas','reportes','admin','auditoria')
      AND programa_id IN (SELECT id FROM mp_programas WHERE tipo = 'sve')`,

  `UPDATE mp_programa_secciones
      SET nombre = 'Dashboard ejecutivo',
          descripcion = 'KPIs del año, cumplimiento del Plan PHVA, seguimientos por mes y últimos casos.',
          orden = 1
    WHERE clave = 'dashboard'
      AND programa_id IN (SELECT id FROM mp_programas WHERE tipo = 'sve')`,

  `UPDATE mp_programa_secciones
      SET nombre = 'Gestión de casos',
          descripcion = 'Seguimiento epidemiológico: lista con filtros, ficha del caso y formulario de 4 secciones.',
          orden = 2
    WHERE clave = 'casos'
      AND programa_id IN (SELECT id FROM mp_programas WHERE tipo = 'sve')`,

  `INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en)
    SELECT 'mps-sve-plan-' || p.id, p.id, 'plan', 'Plan PHVA',
           '19 actividades × 12 meses con programación (AP) y ejecución (AE) y cumplimiento por trimestre.',
           3, 'pendiente', strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM mp_programas p
     WHERE p.tipo = 'sve'
       AND NOT EXISTS (SELECT 1 FROM mp_programa_secciones s WHERE s.programa_id = p.id AND s.clave = 'plan')`,

  `INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en)
    SELECT 'mps-sve-indicadores-' || p.id, p.id, 'indicadores', 'Indicadores epidemiológicos',
           'Prevalencia, incidencia, ausentismo y eficacia 2020-2024 con metas y análisis por periodos.',
           4, 'pendiente', strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM mp_programas p
     WHERE p.tipo = 'sve'
       AND NOT EXISTS (SELECT 1 FROM mp_programa_secciones s WHERE s.programa_id = p.id AND s.clave = 'indicadores')`,

  `INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en)
    SELECT 'mps-sve-areas-' || p.id, p.id, 'areas', 'Áreas expuestas',
           'Distribución del riesgo por área y pivote Cargo × Área.',
           5, 'pendiente', strftime('%Y-%m-%dT%H:%M:%fZ','now')
      FROM mp_programas p
     WHERE p.tipo = 'sve'
       AND NOT EXISTS (SELECT 1 FROM mp_programa_secciones s WHERE s.programa_id = p.id AND s.clave = 'areas')`
];

const MP_PROGRAMAS_MIGRATION_IDS = [
  '20260930-sve-template-v2'
];

module.exports = {
  MP_PROGRAMAS_SCHEMA_SQL,
  MP_PROGRAMAS_SCHEMA_ALTERS,
  MP_PROGRAMAS_MIGRATIONS_SQL,
  MP_PROGRAMAS_MIGRATION_IDS
};
