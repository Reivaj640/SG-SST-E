-- ============================================================================
-- 052 · CANAL DE LA FECHA DE TERMINACION (Anexo de Encargo, seccion 6)
-- ============================================================================
--
-- QUE ES
-- ------
-- El Anexo de Encargo, en su seccion 6, obliga a la Empresa a comunicar al
-- Encargado "la fecha de terminacion de la relacion laboral de cada
-- trabajador respecto de quien se firmen documentos de las categorias del
-- literal (b) del numeral 8.6 del Acuerdo, por el canal que el Encargado
-- habilite en el servicio, con el fin de iniciar el computo del plazo legal".
-- Y define que hace el Encargado con esa fecha:
--
--   "El Encargado registra la fecha con la evidencia de la comunicacion y
--    recalcula el plazo de las filas afectadas, dejando registro de la
--    operacion. Mientras la fecha no se reciba, la fila permanece retenida, no
--    se calcula fecha de supresion y se revisa periodicamente."
--
-- Esta migracion es ese canal. Son DOS tablas:
--
--   gh_firma_fecha_terminacion
--       El REGISTRO: una comunicacion recibida, con su evidencia, con el canal
--       por el que llego y con el pseudonimo del trabajador. Es una fila de
--       control: no se reescribe.
--
--   gh_firma_fecha_terminacion_eventos
--       La BITACORA: append-only, con los triggers en la 053. Cada operacion
--       queda escrita con quien la hizo, cuando, por que y que recalculo dio.
--
-- POR QUE NO SE GUARDA EL DOCUMENTO CRUDO
-- ---------------------------------------
-- `id_trabajador` se guarda como el PSEUDONIMO (psn1_...), con el ambito de
-- la Empresa (ver src/services/trabajador.js). El documento crudo que la
-- Empresa envia por el canal viaja en la peticion y no queda en la base: la
-- base del Encargado no guarda el documento de identidad del Titular.
--
-- POR QUE NO HAY FK A gh_firmas_electronicas
-- ------------------------------------------
-- El registro de una comunicacion sobrevive a las firmas: es la evidencia de
-- que la Empresa comunico una fecha. Si la fila de la firma se suprime, la
-- comunicacion sigue existiendo como hecho. Por eso la FK no es hacia las
-- firmas.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- El REGISTRO de la comunicacion
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_fecha_terminacion (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,

  -- La Empresa que comunica. Es la ambito del pseudonimo del trabajador.
  id_empresa           TEXT    NOT NULL,

  -- El PSEUDONIMO del trabajador (psn1_ + 64 hex), con el ambito de la
  -- Empresa. Nunca el documento crudo.
  id_trabajador        TEXT    NOT NULL,

  -- La fecha de terminacion comunicada (ISO). Es un hecho de la relacion
  -- laboral: la misma fecha sirve para todas las filas de ese trabajador.
  fecha_terminacion    TEXT    NOT NULL,

  -- LA EVIDENCIA de la comunicacion: donde queda el documento (radicado,
  -- correo, acta) que la respalda. Sin evidencia no hay registro.
  evidencia            TEXT    NOT NULL,

  -- El CANAL por el que llego la comunicacion.
  canal                TEXT    NOT NULL,

  -- Quien la registro y por que. El motivo trae el texto de la peticion.
  actor                TEXT    NOT NULL,
  motivo               TEXT    NOT NULL,

  -- Cuando se registro.
  fecha_registro       TEXT    NOT NULL,

  -- Cuantas filas recibieron la fecha y cuantas quedaron con plazo recalculado.
  firmas_afectadas     INTEGER NOT NULL DEFAULT 0,
  firmas_recalculadas  INTEGER NOT NULL DEFAULT 0,

  -- Lo que el operador quiera dejar dicho (el detalle del recalculo, etc.).
  metadata             TEXT
);

CREATE INDEX IF NOT EXISTS idx_fecha_terminacion_empresa
  ON gh_firma_fecha_terminacion(id_empresa, fecha_registro);

-- ─────────────────────────────────────────────────────────────────────────────
-- La BITACORA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_fecha_terminacion_eventos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  registro_id         INTEGER NOT NULL,
  evento              TEXT    NOT NULL,
  fecha_hora          TEXT    NOT NULL,
  id_actor            TEXT    NOT NULL,
  ip                  TEXT,
  user_agent          TEXT,
  id_empresa          TEXT    NOT NULL,
  motivo              TEXT,
  metadata            TEXT,
  FOREIGN KEY (registro_id) REFERENCES gh_firma_fecha_terminacion(id)
);

CREATE INDEX IF NOT EXISTS idx_fecha_terminacion_eventos_registro
  ON gh_firma_fecha_terminacion_eventos(registro_id, fecha_hora);
