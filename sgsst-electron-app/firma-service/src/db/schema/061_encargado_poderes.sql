-- =============================================================================
-- 061 · LA ACREDITACION DE LA FACULTAD DE QUIEN CONTRAFIRMA POR GESSTIAR
-- =============================================================================
--
-- POR QUE ESTA MIGRACION
-- ----------------------
-- El abogado (respuesta al punto P7, 10-nov-2026) condiciono la contrafirma
-- del Anexo de Nube: "La ejecucion por una persona distinta del representante
-- legal de Gesstiar S.A.S. requerira acreditar previamente la facultad de
-- representacion o poder suficiente, que debera conservarse en el expediente".
--
-- El codigo SI demuestra la facultad del lado de la EMPRESA: el cotejo de
-- `_cotejarFirmante` contrasta quien firmo contra el representante legal de la
-- ficha de la Empresa, y sin ese cotejo no hay contrafirma. Del lado de
-- GESSTIAR no habia nada: el segundo acto se cerraba con el nombre que
-- venía en la cabecera `X-Admin-Actor` y sin ninguna acreditacion. Un acta
-- que no dice CON QUE PODER se firmo esta a medias, y un manifiesto que
-- declara el instrumento ejecutado sin ese dato es un verde falso por la via
-- del papel.
--
-- QUE GUARDA CADA TABLA
-- ---------------------
-- `gh_firma_encargado_poderes`: una fila por poder, delegacion o
-- representacion acreditados a una persona:
--
--   nombre .............. Quien tiene la facultad. Es el dato que se coteja
--                          con el actor del acto de contrafirma.
--   cargo ............... El cargo que declara el instrumento.
--   tipo ................ PODER | DELEGACION | REPRESENTACION. Lo declara el
--                          operador; el servicio no lo inventa.
--   instrumento_ref ..... La referencia del documento (numero y fecha del
--                          poder, por ejemplo). Es obligatoria: sin
--                          referencia no hay contra que contrastar.
--   instrumento_sha256 .. La huella SHA-256 del documento acreditativo. Es
--                          obligatoria: el expediente tiene que poder
--                          verificar que el documento es el que se guardo.
--   documento_archivo ... El NOMBRE del archivo del expediente (no la ruta
--                          del servidor: la evidencia sale del servidor).
--   emitido_at ......... Cuando se emitio el instrumento.
--   vigente_desde ...... Desde cuando tiene la facultad (ISO 8601).
--   vigente_hasta ...... Hasta cuando la tiene (ISO 8601). NULL = sin
--                          termino declarado.
--   estado ............. VIGENTE | REVOCADO.
--   revocado_at ....... Cuando se revoco (NULL mientras esta vigente).
--   revocado_motivo ... Por que se revoco.
--   registrado_por ..... Quien registro el poder (el operador, con su
--                          motivo: es un acto de K+AIR).
--   motivo ............. Por que se registra. Es obligatorio.
--   ip / user_agent .... Desde donde se registro.
--
-- `gh_firma_encargado_poderes_eventos`: el rastro append-only de esos
-- poderes (alta, revocacion). Es el mismo criterio que el rastro de la
-- suscripcion del Anexo de Nube (055) y el de la ficha de la Empresa (038):
-- lo que se escribe una vez, no se altera. La revocacion no borra la fila:
-- la deja en REVOCADO con su fecha y su motivo, y escribe el evento. Asi el
-- expediente dice que hubo un poder vigente y que dejo de estarlo, sin que
-- nadie pueda reescribir ese historia.
--
-- POR QUE NO ES UNA TABLA DE LAS EMPRESAS
-- ---------------------------------------
-- El poder acredita a alguien para firmar POR GESSTIAR, no por una Empresa
-- cliente. Es del Encargado, no del Cliente: por eso vive aparte y no se
-- mezcla con `gh_firma_empresas`.
--
-- IDEMPOTENCIA Y APLICACION
-- --------------------------
-- La migracion es ADITIVA: no toca ninguna tabla existente ni reescribe
-- datos. Las dos tablas se crean con `IF NOT EXISTS`, y el runner de
-- migraciones (src/db/migrate.js) aplica cada archivo dentro de una
-- transaccion. Los triggers de inmutabilidad del rastro viven en la 062, que
-- lleva `@skip-when-env test` (misma razon que la 055): la inmutabilidad se
-- comprueba en un test que aplica ese SQL a una base en memoria.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_encargado_poderes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  cargo TEXT,
  tipo TEXT NOT NULL,
  instrumento_ref TEXT NOT NULL,
  instrumento_sha256 TEXT NOT NULL,
  documento_archivo TEXT,
  emitido_at TEXT,
  vigente_desde TEXT,
  vigente_hasta TEXT,
  estado TEXT NOT NULL DEFAULT 'VIGENTE',
  revocado_at TEXT,
  revocado_motivo TEXT,
  registrado_por TEXT,
  motivo TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_encargado_poderes_nombre
  ON gh_firma_encargado_poderes(nombre);

CREATE INDEX IF NOT EXISTS idx_encargado_poderes_estado
  ON gh_firma_encargado_poderes(estado);

-- =============================================================================
-- EL RASTRO APPEND-ONLY DE LOS PODERES
-- =============================================================================
CREATE TABLE IF NOT EXISTS gh_firma_encargado_poderes_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_poder INTEGER NOT NULL,
  evento TEXT NOT NULL,
  detalle TEXT,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_encargado_poderes_eventos_poder
  ON gh_firma_encargado_poderes_eventos(id_poder);
