// =====================================================================
// 📦827 (2026-09-30) — Schema SQL para los DATOS del programa SVE
// (submódulo 3.1.2, sección "Sistema de Vigilancia Epidemiológica").
//
// Por qué este archivo existe: 📦825 creó `mp_programas` /
// `mp_programa_secciones`, que guardan el ESQUELETO del programa (qué
// programas hay, qué secciones tienen, en qué estado están). 📦826 trajo la
// INTERFAZ del prototipo SVE. Pero el contenido —los casos de seguimiento,
// el plan PHVA, los indicadores— se guardaba en `localStorage` del renderer,
// dentro de la app y de ESA PC.
//
// Eso no es una base de datos:
//   - no entra en el archivo .kairsync, así que no viaja entre tus máquinas;
//   - no se puede consultar con SQL ni relacionar con presupuesto/ausentismo;
//   - se pierde si se reinstala o se limpian los datos de la app.
//
// Estas 8 tablas son el contenido. Todas cuelgan de `programa_id` (FK lógica
// a mp_programas.id) y de `empresa_id` (FK lógica a companies.company_key),
// igual que el resto del schema del repo.
//
// DISEÑO — por qué replican 1:1 la forma del `state` del prototipo:
//   El store de SVE expone { meta, fases, plan, seguimientos, indicadores,
//   morbilidad, analisis, catalogos } y las 1.300 líneas de sve-views.js leen
//   esa forma de memoria. Normalizar es lo correcto para consultar; pero
//   si el read devolviera otra forma, habría que reescribir todas las vistas.
//   Por eso el bridge devuelve EXACTAMENTE la misma forma y estas tablas son
//   la forma relational de ese mismo objeto. Las vistas no cambian.
//
//   - "Áreas expuestas" NO tiene tabla: se deriva de `cargo` y `area` de los
//     casos, y ya se calcula al vuelo en la vista.
//   - `catalogos` (áreas, cargos, EPS, AFP) tampoco: son listas de autocompletado
//     que se derivan de los casos ya registrados.
//
// Patrón: mismo estilo que presupuesto-schema-sql.js (📦708/824) y que
// medprev-programas-schema-sql.js (📦825):
//   - CREATE TABLE IF NOT EXISTS (idempotente)
//   - ALTERS array aplicado con try/catch por sentencia
//   - MIGRATIONS_SQL + MIGRATION_IDS con control de versión
// =====================================================================

const MP_SVE_SCHEMA_SQL = `
  -- 📦827 — Encabezado del documento SVE (una fila por programa).
  -- Se guarda como JSON a propósito: son campos de TEXTO de un documento
  -- (objetivo, alcance, código, versión) que no se filtran ni se relacionan.
  -- Desnormalizarlo acá evita una tabla de 8 columnas que nadie consulta por
  -- columna, y deja el mismo objeto meta que el prototipo ya usa.
  CREATE TABLE IF NOT EXISTS mp_sve_meta (
    programa_id     TEXT PRIMARY KEY,                -- FK a mp_programas.id
    empresa_id      TEXT NOT NULL,
    meta_json       TEXT NOT NULL,                   -- JSON con {empresa, programa, anio, codigo, version, fechaVersion, objetivo, alcance, responsable}
    actualizado_en  TEXT NOT NULL
  );

  -- 📦827 — CASOS de seguimiento epidemiológico (la "sección de seguimiento").
  -- Un caso por fila. Es el registro de uso diario y el que más riesgo genera
  -- si se pierde: un caso sin seguimiento es un hallazgo en una auditoría.
  -- Los campos son los del formulario del prototipo, con el MISMO nombre en
  -- snake_case (fechaIngreso -> fecha_ingreso) para que el mapeo sea legible.
  --
  -- Borrado LÓGICO (eliminado_en), no físico: es un registro de SG-SST y tiene
  -- que quedar la traza de que existió. La columna estado es el estado
  -- epidemiológico (sospechoso/confirmado/aislamiento/alta/descartado), no el
  -- estado de borrado: por eso son dos columnas y no una.
  -- Clave primaria COMPUESTA: el id es único DENTRO del programa, no en toda
  -- la base. Con id sola, dos programas SVE de la misma empresa no podrían
  -- coexistir: el segundo chocaría con el msc-… del primero. Es el caso de
  -- "una empresa con varios programas SVE (2024 y 2026)", que es lo natural.
  CREATE TABLE IF NOT EXISTS mp_sve_casos (
    id                    TEXT NOT NULL,              -- 'msc-{timestamp36}-{rand}', único por programa
    programa_id           TEXT NOT NULL,
    empresa_id            TEXT NOT NULL,
    orden                 INTEGER NOT NULL DEFAULT 0,

    fecha_ingreso         TEXT,                      -- ISO yyyy-mm-dd
    mes                   TEXT,                      -- 'enero'..'diciembre'
    anio                  INTEGER,
    empresa               TEXT,

    trabajador            TEXT NOT NULL,
    documento             TEXT,
    telefono              TEXT,
    email                 TEXT,
    genero                TEXT,
    fecha_nacimiento      TEXT,
    eps                   TEXT,
    afp                   TEXT,
    sector                TEXT,
    cargo                 TEXT,
    area                  TEXT,
    ciudad                TEXT,

    antecedentes          TEXT,                      -- 'SI' | 'NO'
    tipo_antecedente      TEXT,
    vulnerable            TEXT,                      -- 'SI' | 'NO'
    sintomas              TEXT,                      -- 'SI' | 'NO'
    cuales_sintomas       TEXT,
    contacto_positivo     TEXT,                      -- 'SI' | 'NO'
    contacto_sintomatico  TEXT,                      -- 'SI' | 'NO'
    prueba_rapida         TEXT,                      -- 'SI' | 'NO'
    fecha_prueba_rapida   TEXT,
    pcr                   TEXT,                      -- 'SI' | 'NO'
    fecha_pcr             TEXT,
    modalidad             TEXT,                      -- 'Presencial' | 'Remoto' | ...
    fecha_aislamiento     TEXT,
    estado                TEXT,                      -- epidemiológico, NO de borrado
    observaciones         TEXT,

    eliminado_en          TEXT,                      -- ISO 8601; NULL = vigente
    creado_en             TEXT NOT NULL,
    actualizado_en        TEXT NOT NULL,
    creado_por            INTEGER,

    PRIMARY KEY (programa_id, id)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_programa ON mp_sve_casos(programa_id, eliminado_en);
  CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_documento ON mp_sve_casos(programa_id, documento);
  CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_estado    ON mp_sve_casos(programa_id, estado);
  CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_anio      ON mp_sve_casos(programa_id, anio);

  -- 📦827 — ACTIVIDADES del Plan PHVA (una fila por actividad).
  --
  -- La clave primaria es COMPUESTA (programa_id, id) y no solo id. Con
  -- id sola, el segundo programa SVE de una empresa moría al inicializarse:
  -- el migrar sembraba act-1, que ya existía del programa anterior, y
  -- SQLite tiraba "UNIQUE constraint failed: mp_sve_plan_actividades.id".
  -- Los ids son POR PROGRAMA: cada programa puede (debe) arrancar en act-1.
  -- Esto es justamente el caso de "varios programas SVE en la misma empresa".
  CREATE TABLE IF NOT EXISTS mp_sve_plan_actividades (
    id              TEXT NOT NULL,                    -- 'act-N', unico DENTRO del programa
    programa_id     TEXT NOT NULL,
    empresa_id      TEXT NOT NULL,
    fase            TEXT NOT NULL,                   -- 'planear'|'hacer'|'verificar'|'actuar'
    actividad       TEXT NOT NULL DEFAULT '',
    responsable     TEXT NOT NULL DEFAULT '',
    orden           INTEGER NOT NULL DEFAULT 0,
    creado_en       TEXT NOT NULL,
    actualizado_en  TEXT NOT NULL,

    PRIMARY KEY (programa_id, id)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_plan_act_programa ON mp_sve_plan_actividades(programa_id, orden);

  -- 📦827 — Programación/ejecución mes a mes del Plan PHVA.
  -- Una fila por (actividad, mes). Es la misma forma que
  -- presupuesto_valores_mensuales de 📦824: el detalle va aparte de la
  -- cabecera para que el agregado SIEMPRE se pueda derivar del detalle
  -- (el % de cumplimiento nunca se guarda: se calcula, y por eso el anillo y
  -- la fila TOTALES no pueden discrepar).
  --   ap = Programada (AE en el original del prototipo)
  --   ae = Ejecutada
  --
  -- La FK es compuesta, por el mismo motivo que la PK de arriba: actividad_id
  -- solo es único dentro de un programa. La CASCADE borrada la usa el bridge
  -- para limpiar los 12 meses, pero el bridge igual los borra explícitamente:
  -- las FKs de SQLite no están activas por defecto y depender de que cada
  -- conexión las haya prendido es frágil.
  CREATE TABLE IF NOT EXISTS mp_sve_plan_meses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad_id    TEXT NOT NULL,
    programa_id     TEXT NOT NULL,                   -- desnormalizado: consulta por programa sin JOIN
    mes             INTEGER NOT NULL,                -- 1..12
    ap              INTEGER NOT NULL DEFAULT 0,      -- 0/1
    ae              INTEGER NOT NULL DEFAULT 0,      -- 0/1

    UNIQUE(programa_id, actividad_id, mes),
    FOREIGN KEY (programa_id, actividad_id) REFERENCES mp_sve_plan_actividades(programa_id, id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_plan_meses_programa ON mp_sve_plan_meses(programa_id, mes);

  -- 📦827 — DEFINICIÓN de cada indicador (prevalencia, incidencia,
  -- ausentismo, eficacia). Los valores por año van en la tabla de al lado.
  --
  -- El id es único por programa (text) y la clave es la del indicador
  -- ('prevalencia', 'incidencia'...). NO se usa la clave como PRIMARY KEY: dos
  -- programas SVE de la misma empresa (p. ej. uno 2024 y otro 2026) tendrían
  -- los mismos indicadores y la clave se pisaría entre ellos.
  CREATE TABLE IF NOT EXISTS mp_sve_indicadores (
    id              TEXT PRIMARY KEY,                -- 'msi-{ts}-{rand}'
    programa_id     TEXT NOT NULL,
    empresa_id      TEXT NOT NULL,
    clave           TEXT NOT NULL,                   -- 'prevalencia' | 'incidencia' | ...
    nombre          TEXT NOT NULL,
    meta            TEXT,                           -- texto de la meta ("Mantener la prevalencia menor al 10%")
    formulacion     TEXT,
    periodicidad    TEXT,                           -- 'ANUAL' | 'TRIMESTRAL' | ...
    anios_json      TEXT,                           -- '[2020,2021,...]' spine de la serie
    medidas_json    TEXT,                           -- '["casos","promedio"]'
    -- 📦830 — Extras de la card que NO son columnas propias: meta corta
    -- ("< 10%") y umbral del semáforo (0.1 / 0.7). Van en un solo JSON para
    -- no agregar dos columnas de un solo consumidor; la vista de indicadores
    -- las lee como { metaCorta, umbral }.
    extra_json      TEXT,
    actualizado_en  TEXT NOT NULL,

    UNIQUE(programa_id, clave)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_indicadores_programa ON mp_sve_indicadores(programa_id);

  -- 📦827 — VALORES de un indicador por año.
  -- La columna medida existe porque los indicadores no comparten columnas:
  -- prevalencia usa casos, incidencia usa casosNuevos, y todos usan promedio.
  -- Con una columna medida las tres conviven sin columna muerta.
  CREATE TABLE IF NOT EXISTS mp_sve_indicadores_valores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    indicador_id    TEXT NOT NULL,
    programa_id     TEXT NOT NULL,
    anio            INTEGER NOT NULL,
    medida          TEXT NOT NULL,                   -- 'casos'|'casosNuevos'|'diasProgramados'|...
    valor           REAL,

    UNIQUE(indicador_id, anio, medida),
    FOREIGN KEY (indicador_id) REFERENCES mp_sve_indicadores(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_ind_val_programa ON mp_sve_indicadores_valores(programa_id, anio);

  -- 📦827 — MORBILIDAD: serie por tipo de evento y año, con dos medidas
  -- (casos y días de incapacidad temporal, que es lo que el prototipo llama
  -- diasIt del prototipo).
  CREATE TABLE IF NOT EXISTS mp_sve_morbilidad (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    programa_id     TEXT NOT NULL,
    empresa_id      TEXT NOT NULL,
    tipo            TEXT NOT NULL,                   -- 'Accidentes de trabajo', 'Enfermedades laborales', ...
    anio            INTEGER NOT NULL,
    casos           INTEGER,
    dias_it         INTEGER,                         -- días de IT

    UNIQUE(programa_id, tipo, anio)
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_morb_programa ON mp_sve_morbilidad(programa_id, anio);

  -- 📦827 — ANÁLISIS por periodo (hallazgos / propuestas / responsable).
  CREATE TABLE IF NOT EXISTS mp_sve_analisis (
    id              TEXT PRIMARY KEY,                -- 'mso-{timestamp36}-{rand}'
    programa_id     TEXT NOT NULL,
    empresa_id      TEXT NOT NULL,
    periodo         TEXT NOT NULL,                   -- '1. ENERO - JUNIO'
    hallazgos       TEXT,
    propuestas      TEXT,
    responsable     TEXT,
    orden           INTEGER NOT NULL DEFAULT 0,
    actualizado_en  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mp_sve_analisis_programa ON mp_sve_analisis(programa_id, orden);
`;

// 📦830 — ALTERs idempotentes (el bucle de main.js los aplica con try/catch por
// sentencia y cuenta "nuevas" vs "ya existentes"). `anios_json`/`medidas_json`
// NO están acá: las agrega la migración versionada de abajo, porque una
// migración se puede reintentar y un ALTER suelto en un bucle se pierde el
// error. `extra_json` sí va acá: es una columna nueva sobre una tabla que ya
// existe, y el rebuild de la migración 2 la preserva igual (la declara en su
// DDL) — en las bases que ya corrieron esa migración, solo este ALTER la agrega.
const MP_SVE_SCHEMA_ALTERS = [
  `ALTER TABLE mp_sve_indicadores ADD COLUMN extra_json TEXT`
];

// 📦827-fix — MIGRACIONES de datos.
//
// 1) La clave primaria de `mp_sve_casos` y `mp_sve_plan_actividades` pasó de
//    `id` a `(programa_id, id)`. SQLite no puede alterar una PK, y
//    `CREATE TABLE IF NOT EXISTS` no recrea una tabla que ya existe con otra
//    forma: sin esto, cualquier base que hubiera corrido una version previa de
//    📦827 (la tuya incluida) se queda con la PK global y el segundo programa
//    SVE de la empresa no puede inicializarse.
//
//    Se reconstruye la tabla y se copian las filas. No se puede perder nada:
//    con la PK global no existían dos filas con el mismo id, así que todas
//    sobreviven al cambio a PK compuesta.
//
// 2) `anios_json` y `medidas_json` se agregan como columnas (ALTER, no rebuild).
const MP_SVE_MIGRATIONS_SQL = [
  // --- 1a) casos: PK compuesta ---
  `CREATE TABLE IF NOT EXISTS mp_sve_casos_v2 (
     id TEXT NOT NULL,
     programa_id TEXT NOT NULL,
     empresa_id TEXT NOT NULL,
     orden INTEGER NOT NULL DEFAULT 0,
     fecha_ingreso TEXT, mes TEXT, anio INTEGER, empresa TEXT,
     trabajador TEXT NOT NULL, documento TEXT, telefono TEXT, email TEXT, genero TEXT,
     fecha_nacimiento TEXT, eps TEXT, afp TEXT, sector TEXT, cargo TEXT, area TEXT, ciudad TEXT,
     antecedentes TEXT, tipo_antecedente TEXT, vulnerable TEXT, sintomas TEXT, cuales_sintomas TEXT,
     contacto_positivo TEXT, contacto_sintomatico TEXT, prueba_rapida TEXT, fecha_prueba_rapida TEXT,
     pcr TEXT, fecha_pcr TEXT, modalidad TEXT, fecha_aislamiento TEXT, estado TEXT, observaciones TEXT,
     eliminado_en TEXT, creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL, creado_por INTEGER,
     PRIMARY KEY (programa_id, id)
   );
   INSERT OR IGNORE INTO mp_sve_casos_v2
     SELECT id, programa_id, empresa_id, orden, fecha_ingreso, mes, anio, empresa,
            trabajador, documento, telefono, email, genero, fecha_nacimiento, eps, afp, sector,
            cargo, area, ciudad, antecedentes, tipo_antecedente, vulnerable, sintomas, cuales_sintomas,
            contacto_positivo, contacto_sintomatico, prueba_rapida, fecha_prueba_rapida,
            pcr, fecha_pcr, modalidad, fecha_aislamiento, estado, observaciones,
            eliminado_en, creado_en, actualizado_en, creado_por
     FROM mp_sve_casos;
   DROP TABLE mp_sve_casos;
   ALTER TABLE mp_sve_casos_v2 RENAME TO mp_sve_casos;
   CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_programa ON mp_sve_casos(programa_id, eliminado_en);
   CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_documento ON mp_sve_casos(programa_id, documento);
   CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_estado    ON mp_sve_casos(programa_id, estado);
   CREATE INDEX IF NOT EXISTS idx_mp_sve_casos_anio      ON mp_sve_casos(programa_id, anio);`,

  // --- 1b) actividades: PK compuesta ---
  `CREATE TABLE IF NOT EXISTS mp_sve_plan_actividades_v2 (
     id TEXT NOT NULL,
     programa_id TEXT NOT NULL,
     empresa_id TEXT NOT NULL,
     fase TEXT NOT NULL,
     actividad TEXT NOT NULL DEFAULT '',
     responsable TEXT NOT NULL DEFAULT '',
     orden INTEGER NOT NULL DEFAULT 0,
     creado_en TEXT NOT NULL,
     actualizado_en TEXT NOT NULL,
     PRIMARY KEY (programa_id, id)
   );
   INSERT OR IGNORE INTO mp_sve_plan_actividades_v2
     SELECT id, programa_id, empresa_id, fase, actividad, responsable, orden, creado_en, actualizado_en
     FROM mp_sve_plan_actividades;
   DROP TABLE mp_sve_plan_actividades;
   ALTER TABLE mp_sve_plan_actividades_v2 RENAME TO mp_sve_plan_actividades;
   CREATE INDEX IF NOT EXISTS idx_mp_sve_plan_act_programa ON mp_sve_plan_actividades(programa_id, orden);`,

  // --- 1c) meses: UNIQUE y FK compuestas (van DESPUES de 1b) ---
  `CREATE TABLE IF NOT EXISTS mp_sve_plan_meses_v2 (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     actividad_id TEXT NOT NULL,
     programa_id TEXT NOT NULL,
     mes INTEGER NOT NULL,
     ap INTEGER NOT NULL DEFAULT 0,
     ae INTEGER NOT NULL DEFAULT 0,
     UNIQUE(programa_id, actividad_id, mes),
     FOREIGN KEY (programa_id, actividad_id) REFERENCES mp_sve_plan_actividades(programa_id, id) ON DELETE CASCADE
   );
   INSERT OR IGNORE INTO mp_sve_plan_meses_v2 (actividad_id, programa_id, mes, ap, ae)
     SELECT actividad_id, programa_id, mes, ap, ae FROM mp_sve_plan_meses;
   DROP TABLE mp_sve_plan_meses;
   ALTER TABLE mp_sve_plan_meses_v2 RENAME TO mp_sve_plan_meses;
   CREATE INDEX IF NOT EXISTS idx_mp_sve_plan_meses_programa ON mp_sve_plan_meses(programa_id, mes);`,

  // --- 2) Indicadores: anios_json y medidas_json, con RELLENO ---
  // Se reconstruye en vez de usar ALTER TABLE ADD COLUMN porque SQLite no
  // tiene "ADD COLUMN IF NOT EXISTS": un ALTER no es idempotente, y esta
  // migracion tiene que poder volver a correr (base a medias, intento
  // interrumpido) sin romper.
  //
  // El relleno importa: sin el, la serie de cada indicador quedaria sin espina
  // de anios y sin nombres de medida, y las vistas leen
  // anios[Math.min(4, anios.length - 1)] — o sea, el Dashboard reventaba con
  // "Cannot read properties of undefined" HASTA que se guardara de nuevo.
  `CREATE TABLE IF NOT EXISTS mp_sve_indicadores_v2 (
     id TEXT PRIMARY KEY,
     programa_id TEXT NOT NULL,
     empresa_id TEXT NOT NULL,
     clave TEXT NOT NULL,
     nombre TEXT NOT NULL,
     meta TEXT,
     formulacion TEXT,
     periodicidad TEXT,
     anios_json TEXT,
     medidas_json TEXT,
     extra_json TEXT,
     actualizado_en TEXT NOT NULL,
     UNIQUE(programa_id, clave)
   );
   INSERT OR IGNORE INTO mp_sve_indicadores_v2
     (id, programa_id, empresa_id, clave, nombre, meta, formulacion, periodicidad, anios_json, medidas_json, actualizado_en)
     SELECT i.id, i.programa_id, i.empresa_id, i.clave, i.nombre, i.meta, i.formulacion, i.periodicidad,
       COALESCE((SELECT json_group_array(anio) FROM (
                   SELECT DISTINCT anio FROM mp_sve_indicadores_valores v
                   WHERE v.programa_id = i.programa_id AND v.indicador_id = i.id ORDER BY anio)), '[]'),
       COALESCE((SELECT json_group_array(medida) FROM (
                   SELECT DISTINCT medida FROM mp_sve_indicadores_valores v
                   WHERE v.programa_id = i.programa_id AND v.indicador_id = i.id)), '[]'),
       i.actualizado_en
     FROM mp_sve_indicadores i;
   DROP TABLE mp_sve_indicadores;
   ALTER TABLE mp_sve_indicadores_v2 RENAME TO mp_sve_indicadores;
   CREATE INDEX IF NOT EXISTS idx_mp_sve_indicadores_programa ON mp_sve_indicadores(programa_id);`
];
const MP_SVE_MIGRATION_IDS = [
  '20260930-sve-pk-compuesta-casos',
  '20260930-sve-pk-compuesta-actividades',
  '20260930-sve-pk-compuesta-meses',
  '20260930-sve-ind-espina-json'
];

/* =====================================================================
 * 📦827-fix-2 — Aplicar las migraciones (ÚNICO camino, lo usan main.js y el test)
 *
 * No basta con exponer el SQL: la migración tiene que correr de una forma
 * concreta. Estas reconstruyen tablas y, con `foreign_keys` activo, el
 * `DROP TABLE` de la tabla padre dispara el `ON DELETE CASCADE` de la hija:
 * los meses del plan desaparecían ANTES de que su propia migración los
 * copiara. Medido sobre la base real: 32 filas de `mp_sve_plan_meses` -> 0.
 *
 * Por eso el apagado de claves foráneas va AQUÍ y no suelto en el llamador:
 * así el test corre exactamente el mismo camino que la app, y si alguien
 * quita el apagado, el test se pone rojo de verdad.
 * ===================================================================== */
function aplicarMigracionesMedprevSve(db, opciones) {
  var opts = opciones || {};
  var log = opts.log || function () { };
  if (!Array.isArray(MP_SVE_MIGRATIONS_SQL) || MP_SVE_MIGRATIONS_SQL.length === 0) {
    return { aplicadas: 0, fallidas: [], yaAplicadas: 0 };
  }

  db.exec('CREATE TABLE IF NOT EXISTS _medprev_sve_migrations (id TEXT PRIMARY KEY, aplicada_en TEXT NOT NULL)');
  var yaAplicadas = {};
  try {
    var filas = db.prepare('SELECT id FROM _medprev_sve_migrations').all();
    for (var i = 0; i < filas.length; i++) yaAplicadas[filas[i].id] = true;
  } catch (e) { /* tabla recién creada */ }

  var fkOn = false;
  try { fkOn = !!db.pragma('foreign_keys', { simple: true }); } catch (e2) { /* sin soporte */ }
  if (fkOn) { try { db.pragma('foreign_keys = OFF'); } catch (e3) { log('no se pudieron apagar las claves foráneas: ' + e3.message); } }

  var aplicadas = 0;
  var fallidas = [];
  try {
    for (var mi = 0; mi < MP_SVE_MIGRATIONS_SQL.length; mi++) {
      var id = (MP_SVE_MIGRATION_IDS && MP_SVE_MIGRATION_IDS[mi]) || ('medprev-sve-mig-' + mi);
      if (yaAplicadas[id]) continue;
      try {
        db.exec(MP_SVE_MIGRATIONS_SQL[mi]);
        db.prepare('INSERT OR IGNORE INTO _medprev_sve_migrations (id, aplicada_en) VALUES (?, ?)').run(id, new Date().toISOString());
        aplicadas++;
      } catch (err) {
        fallidas.push(id);
        log('migración de datos SVE "' + id + '" falló: ' + err.message);
      }
    }
  } finally {
    if (fkOn) { try { db.pragma('foreign_keys = ON'); } catch (e4) { /* se deja como quedó */ } }
  }

  return { aplicadas: aplicadas, fallidas: fallidas, yaAplicadas: Object.keys(yaAplicadas).length };
}

module.exports = {
  MP_SVE_SCHEMA_SQL,
  MP_SVE_SCHEMA_ALTERS,
  MP_SVE_MIGRATIONS_SQL,
  MP_SVE_MIGRATION_IDS,
  aplicarMigracionesMedprevSve
};
