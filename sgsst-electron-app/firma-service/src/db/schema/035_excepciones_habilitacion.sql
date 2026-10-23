-- ============================================================================
-- 035 · EXCEPCION DE HABILITACION (D-03, decision B.3)
-- ============================================================================
--
-- Que la Empresa este habilitada para pedir firmas se bloquea, no se avisa.
-- El bloqueo aplica en los cuatro puntos que ordena la respuesta 11A del
-- abogado (23-oct-2026):
--
--   (i)   creacion de la solicitud
--   (ii)  commit
--   (iii) creacion del consentimiento
--   (iv)  doble firma
--
-- "La excepcion solo procede si cumple todas estas condiciones":
--
--   Autorizacion  | Escrita, del owner o representante legal, con fecha y
--                 | alcance.
--   Alcance       | Una Empresa y un numero maximo de firmas.
--   Ruta en papel | Disponible y operativa el mismo dia.
--   Plazo         | Fecha cierta para firmar el Anexo (maximo 30 dias).
--   Rastro        | Bitacora inmutable: usuario, fecha, motivo, Empresa,
--                 | numero de firmas.
--   Limite        | No se usa para una Empresa nueva sin ningun Anexo, salvo
--                 | piloto autorizado.
--
-- Por eso la excepcion NO es un `if` silencioso: es una fila con los datos de
-- la autorizacion, un contador de firmas gastadas, un plazo cierto y una
-- bitacora que no se altera (migracion 036).
--
-- DOS TABLAS
--   gh_firma_excepciones_habilitacion
--       La EXCEPCION: una Empresa, una autorizacion, un alcance, un plazo.
--       Es una fila de control: cambia de estado (firmas gastadas, cierre).
--
--   gh_firma_excepciones_habilitacion_eventos
--       La BITACORA: append-only, con triggers en la 036. Cada uso de la
--       excepcion queda escrito aqui con usuario, fecha, motivo, Empresa y
--       numero de firmas.
--
-- La bitacora NO tiene FK a gh_firmas_electronicas a proposito: el primer
-- punto de bloqueo (la creacion de la solicitud) ocurre ANTES de que exista
-- la fila de la firma, y esa primera utilizacion de la excepcion tambien
-- tiene que quedar escrita.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- La excepcion
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_excepciones_habilitacion (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Una sola Empresa por excepcion: el alcance es "una Empresa".
  id_empresa             TEXT    NOT NULL,

  -- VIGENTE | CERRADA. La VENCIDA no es un estado: se deduce de plazo_hasta.
  estado                 TEXT    NOT NULL DEFAULT 'VIGENTE',

  -- La autorizacion escrita (el abogado la pide con fecha y alcance).
  autorizado_por         TEXT    NOT NULL,
  autorizacion_fecha     TEXT    NOT NULL,
  autorizacion_ref       TEXT    NOT NULL,

  -- El alcance: una Empresa y un numero maximo de firmas.
  alcance_firmas_max     INTEGER NOT NULL,
  firmas_usadas          INTEGER NOT NULL DEFAULT 0,

  -- La ruta en papel: tiene que estar disponible y operativa el mismo dia.
  ruta_papel             TEXT    NOT NULL,
  ruta_papel_operativa   INTEGER NOT NULL DEFAULT 0,

  -- La fecha cierta para firmar el Anexo. Maximo 30 dias desde la creacion
  -- (lo valida el service, no la base).
  plazo_hasta            TEXT    NOT NULL,

  -- El limite: una Empresa nueva sin ningun Anexo solo puede usar una
  -- excepcion si es un piloto autorizado.
  piloto_autorizado      INTEGER NOT NULL DEFAULT 0,
  piloto_autorizado_por  TEXT,

  -- El rastro de la excepcion misma.
  motivo                 TEXT    NOT NULL,
  creada_por             TEXT    NOT NULL,
  fecha_creacion         TEXT    NOT NULL,

  cerrada_at             TEXT,
  cerrada_por            TEXT,
  cierre_motivo          TEXT
);

CREATE INDEX IF NOT EXISTS idx_excepciones_habilitacion_empresa
  ON gh_firma_excepciones_habilitacion(id_empresa, estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- La bitacora
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_excepciones_habilitacion_eventos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  excepcion_id   INTEGER NOT NULL,
  evento         TEXT    NOT NULL,
  fecha_hora     TEXT    NOT NULL,
  id_actor       TEXT    NOT NULL,
  ip             TEXT,
  user_agent     TEXT,
  id_empresa     TEXT    NOT NULL,
  firmas_usadas  INTEGER,
  motivo         TEXT,
  metadata       TEXT,
  FOREIGN KEY (excepcion_id) REFERENCES gh_firma_excepciones_habilitacion(id)
);

CREATE INDEX IF NOT EXISTS idx_excepciones_habilitacion_eventos_excepcion
  ON gh_firma_excepciones_habilitacion_eventos(excepcion_id, fecha_hora);
