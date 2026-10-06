// =====================================================================
// 📦708 (2026-08-15) — Schema SQL para Presupuesto SG-SST (Fase 0)
// Migración del submódulo 1.1.3 "Asignación de Recursos" a SQLite.
//
// 3 tablas: presupuestos, presupuesto_partidas, presupuesto_valores_mensuales
// Patrón: mismo estilo que GESTACION_SCHEMA_SQL + email-schema-sql.js
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - Migraciones individuales con try/catch (duplicate column = skip)
//
// 📦824 (2026-09-29) — El modelo v1 NO podía representar el Excel ACT-FO-043.
// El Excel trae 3 datos por partida que la tabla no tenía dónde meter:
//   - col D ASIGNACION PRESUPUESTO ANUAL  (el anual; la v1 solo guardaba anual/12)
//   - col E EJECUTADO ACUMULADO           (la v1 lo descartaba por completo)
//   - col F % EJE.                        (la v1 lo descartaba)
// Y el Excel trae datos a nivel de presupuesto que tampoco existían:
//   - la fila "TOTAL AÑO" (que además viene con un bug: cuenta cada partida
//     dos veces, ver notas de `presupuesto_totales_declarados`)
//   - el factor IPC que se aplica después a esa fila.
// Se conservan los valores DECLARADOS por el Excel aparte de los CALCULADOS
// para poder detectar esa clase de bug en vez de propagarla a la BD.
//
// El resto de notas de diseño, en AGENTS.md → "Presupuesto: BD como fuente".
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

    -- 📦824 — Rastro del Excel del que se importó. Sin esto no se puede
    -- responder "¿de dónde salió este presupuesto?" ni detectar que el
    -- archivo de origen cambió.
    archivo_origen        TEXT,                      -- ruta completa del .xlsx
    archivo_importado_en  TEXT,                      -- ISO 8601
    archivo_nombre        TEXT,                      -- solo el nombre, para mostrar

    -- 📦824 — Totales que DECLARA el Excel, guardados aparte de los CALCULADOS.
    -- El Excel 2026 de Tempoactiva trae una fila "TOTAL AÑO" que cuenta cada
    -- partida dos veces (declara 55.638.568 cuando las 14 partidas suman
    -- 27.819.284). Sin guardar el valor declarado no hay forma de detectar ese
    -- bug: la BD se vería "correcta" mientras muestra el doble del presupuesto.
    total_declarado_asignado  REAL,                 -- col D de la fila TOTAL AÑO
    total_declarado_ejecutado REAL,                 -- col E de la fila TOTAL AÑO
    ipc                        REAL,                 -- factor IPC (0.052 en el 2026)
    avisos_importacion         TEXT,                 -- JSON array de inconsistencias

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
    descripcion     TEXT,                            -- col B del Excel: la CATEGORÍA ("ASESORIAS SST", "PAPELERIA SG-SST")
    activo          INTEGER NOT NULL DEFAULT 1,      -- soft-delete (0 = borrado)
    creado_en       TEXT NOT NULL,
    actualizado_en  TEXT NOT NULL,

    -- 📦824 — Los 3 datos del Excel que la v1 NO tenía dónde guardar.
    -- v1 guardaba solo el anual/12 como "asignado" mensual y descartaba por
    -- completo el ejecutado acumulado y el % de ejecución.
    asignado_anual      REAL,                        -- col D: ASIGNACION PRESUPUESTO ANUAL
    ejecutado_acumulado REAL,                        -- col E: EJECUTADO ACUMULADO
    porcentaje_eje      REAL,                        -- col F: % EJE.
    numero_excel        INTEGER,                     -- col A: BLOQUE de categoría (1,2,3...), NO el número de partida

    FOREIGN KEY (presupuesto_id) REFERENCES presupuestos(id) ON DELETE CASCADE,
    UNIQUE(presupuesto_id, numero)
  );

  CREATE INDEX IF NOT EXISTS idx_partidas_presupuesto ON presupuesto_partidas(presupuesto_id);
  CREATE INDEX IF NOT EXISTS idx_partidas_activo       ON presupuesto_partidas(presupuesto_id, activo);

  -- 📦708 — Valores mensuales por partida (12 filas por partida por año)
  -- Total típico: 19 partidas × 12 meses = 228 rows/presupuesto.
  --
  -- 📦824 CORRECCIÓN DE LA NOTA ORIGINAL: "ejecutado" es MENSUAL, no acumulado.
  -- La v1 decía "acumulado para paridad 1:1 con el Excel" y estaba mal: el Excel
  -- trae la ejecución mes a mes en ENE..DIC y el acumulado aparte en la col E
  -- (que ahora vive en presupuesto_partidas.ejecutado_acumulado). Sumando los 12
  -- meses de 'ejecutado' se obtiene exactamente el acumulado, que es la
  -- comprobación que usa el importador para detectar files inconsistentes.
  CREATE TABLE IF NOT EXISTS presupuesto_valores_mensuales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id      TEXT NOT NULL,
    anio            INTEGER NOT NULL,                -- 2026
    mes             INTEGER NOT NULL CHECK(mes BETWEEN 1 AND 12),
    asignado        REAL NOT NULL DEFAULT 0,         -- valor planeado/presupuestado MENSUAL
    ejecutado       REAL NOT NULL DEFAULT 0,         -- valor ejecutado MENSUAL (ver nota)
    notas           TEXT,
    actualizado_en  TEXT NOT NULL,
    FOREIGN KEY (partida_id) REFERENCES presupuesto_partidas(id) ON DELETE CASCADE,
    UNIQUE(partida_id, anio, mes)
  );

  CREATE INDEX IF NOT EXISTS idx_pvm_partida ON presupuesto_valores_mensuales(partida_id);
  CREATE INDEX IF NOT EXISTS idx_pvm_anio_mes ON presupuesto_valores_mensuales(anio, mes);
`;

// 📦824 — DDL de columnas nuevas para bases YA CREADAS por la v1.
//
// Van aparte de PRESUPUESTO_SCHEMA_SQL a propósito: `CREATE TABLE IF NOT
// EXISTS` no altera tablas existentes, y un `ALTER TABLE` repetido revienta
// con "duplicate column name". El bridge aplica cada sentencia de este array
// por separado dentro de un try/catch, así que el fallo esperado (ya existe)
// no interrumpe el resto. Una BD vieja y una nueva quedan con el mismo shape.
const PRESUPUESTO_SCHEMA_ALTERS = [
  'ALTER TABLE presupuestos ADD COLUMN archivo_origen TEXT',
  'ALTER TABLE presupuestos ADD COLUMN archivo_importado_en TEXT',
  'ALTER TABLE presupuestos ADD COLUMN archivo_nombre TEXT',
  'ALTER TABLE presupuestos ADD COLUMN total_declarado_asignado REAL',
  'ALTER TABLE presupuestos ADD COLUMN total_declarado_ejecutado REAL',
  'ALTER TABLE presupuestos ADD COLUMN ipc REAL',
  'ALTER TABLE presupuestos ADD COLUMN avisos_importacion TEXT',

  'ALTER TABLE presupuesto_partidas ADD COLUMN asignado_anual REAL',
  'ALTER TABLE presupuesto_partidas ADD COLUMN ejecutado_acumulado REAL',
  'ALTER TABLE presupuesto_partidas ADD COLUMN porcentaje_eje REAL',

  // La columna N del Excel numera BLOQUES de categoría, no partidas (1 =
  // ASESORIAS SST, 2 = SISTEMA INTEGRAL, 3 = PAPELERIA). Se guarda aparte de
  // `numero` (que es la posición de la partida) para poder reconstruir el
  // bloque original al exportar.
  'ALTER TABLE presupuesto_partidas ADD COLUMN numero_excel INTEGER'
];

// 📦824 — Migraciones para bases YA CREADAS por la v1.
//
// Este array estaba vacío desde la v1 con la nota "no hay schema previo que
// migrar". Eso era cierto el día del 📦708, pero dejó la infraestructura sin
// probar: la primera columna nueva (esta) revienta en toda base existente.
//
// Formato: ARRAY de sentencias (no un string unido). main.js recorre el array
// y ejecuta cada elemento por separado con try/catch, y PRESUPUESTO_MIGRATION_IDS
// las indexa 1:1 para registrar cuáles ya corrieron.
const PRESUPUESTO_MIGRATIONS_SQL = [
  // 📦824 — bulk-save escribía descripcion='' fijo en cada guardado, por lo que
  // las 14 partidas de la base real quedaron sin la categoría del Excel
  // ("ASESORIAS SST", "PAPELERIA SG-SST"...). El dato no existe en otro lado de
  // la BD, así que esto solo detiene el daño; la recuperación real es
  // reimportar el Excel.
  `UPDATE presupuesto_partidas
      SET descripcion = NULL
    WHERE TRIM(COALESCE(descripcion, '')) = ''`,

  // Huérfanos: sin PRAGMA foreign_keys=ON los ON DELETE CASCADE nunca corrieron
  // (main.js solo activaba journal_mode=WAL). Limpieza de lo que quedó.
  `DELETE FROM presupuesto_valores_mensuales
    WHERE partida_id NOT IN (SELECT id FROM presupuesto_partidas)`,
  `DELETE FROM presupuesto_partidas
    WHERE presupuesto_id NOT IN (SELECT id FROM presupuestos)`
];

// 📦824 — IDs de migración, para correr cada limpieza UNA sola vez.
const PRESUPUESTO_MIGRATION_IDS = [
  '20260929-descripcion-vacia-a-null',
  '20260929-limpar-valores-huerfanos',
  '20260929-limpar-partidas-huerfanas'
];

module.exports = {
  PRESUPUESTO_SCHEMA_SQL,
  PRESUPUESTO_SCHEMA_ALTERS,
  PRESUPUESTO_MIGRATIONS_SQL,
  PRESUPUESTO_MIGRATION_IDS
};
