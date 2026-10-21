-- =============================================================================
-- Migración 028: las solicitudes de los Titulares (el 10.7(b) del Acuerdo)
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes). Crea dos
-- tablas nuevas: el registro de las solicitudes y su historial de eventos.
--
-- EL PROBLEMA QUE RESUELVE
-- -----------------------
-- El numeral 10.7(b) del Acuerdo, en su redacción nueva, dice que K+AIR,
-- como Encargado del Tratamiento, "también atiende las solicitudes de los
-- Titulares que le sean dirigidas", que "registra toda solicitud que recibe",
-- que "la remite a la Empresa dentro de los dos (2) días hábiles siguientes"
-- y que "informa al Titular sobre el estado de su solicitud".
--
-- Eso NO es un texto: es un registro. Sin tabla, no hay forma de saber que
-- una solicitud se recibió, cuándo, por qué canal, si se trasmitió a la
-- Empresa y qué se respondió. Y el Decreto 1377 (arts. 21 y 23 = 2.2.2.25.4.2
-- y 2.2.2.25.4.4) obliga a que el Encargado designe persona o área y tenga
-- mecanismos disponibles: un canal sin registro es un punto ciego con otro
-- nombre.
--
-- POR QUÉ ESTA TABLA NO CUELGA DE LA FIRMA
-- ------------------------------------------
-- Es lo que hace que la 5B (la supresión de datos personales) NO pueda
-- borrarla: la 5B solo borra lo que cuelga de `gh_firmas_electronicas`, y
-- esta tabla no cuelga de ninguna firma. Es el mismo argumento del registro
-- de auditoría de la firma, y por eso su historial tiene triggers
-- append-only (migración 029, aparte, por el mismo motivo que la 020 y la
-- 025).
--
-- EL ROL DE K+AIR (y el que NO tiene)
-- -----------------------------------
-- K+AIR NO resuelve: la respuesta es de la Empresa, que es la Responsable
-- (10.7 literal d). K+AIR recibe, registra, trasmite y da constancia, y
-- pone la evidencia a disposición de la autoridad. La tabla registra las
-- tres cosas por separado: `estado` (dónde está), `trasmitida_at` (cuándo
-- se trasmitió) y `respondida_at` (cuándo llegó la respuesta de la
-- Responsable).
--
-- Tests: tests/solicitudes-titular.test.js
-- =============================================================================

-- 1. El registro de las solicitudes ---------------------------------------
CREATE TABLE IF NOT EXISTS gh_solicitudes_titular (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Folio legible: es lo que el Titular usa para preguntar por su solicitud.
  folio TEXT NOT NULL UNIQUE,
  fecha_registro TEXT NOT NULL,
  -- Por dónde llegó (el canal de K+AIR).
  canal TEXT NOT NULL,
  -- Qué se pide: acceso | correccion | rectificacion | supresion |
  -- revocacion | reclamo | otro.
  tipo TEXT NOT NULL,
  solicitante_nombre TEXT,
  solicitante_correo TEXT,
  -- La identidad del solicitante se guarda como HUELLA, no en claro: el
  -- principio es el mismo de la 10.5(a) para el Trabajador.
  solicitante_documento_hash TEXT,
  -- Lo que el Titular cuenta (texto libre).
  contenido TEXT,
  -- RECIBIDA | TRASMITIDA | RESPONDIDA | CERRADA
  estado TEXT NOT NULL,
  -- A quién se trasmite (la Empresa, que es la Responsable) y por dónde.
  id_empresa TEXT,
  canal_empresa TEXT,
  -- El plazo de trasmisión que la política define (no el código).
  plazo_tramite TEXT,
  trasmitida_at TEXT,
  respondida_at TEXT,
  -- Lo que la Empresa respondió.
  respuesta TEXT,
  -- Evidencia: JSON con lo que K+AIR entrega (constancias, eventos, etc.).
  evidencia TEXT,
  creado_por TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_titular_fecha
  ON gh_solicitudes_titular(fecha_registro);
CREATE INDEX IF NOT EXISTS idx_solicitudes_titular_estado
  ON gh_solicitudes_titular(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_titular_correo
  ON gh_solicitudes_titular(solicitante_correo);

-- 2. El historial de eventos ------------------------------------------------
-- Los eventos NO cuelgan de la firma: la 5B no los alcanza. La inalterabilidad
-- la garantizan los triggers de la migración 029.
CREATE TABLE IF NOT EXISTS gh_solicitudes_titular_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitud_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  id_actor TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (solicitud_id) REFERENCES gh_solicitudes_titular(id)
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_titular_eventos
  ON gh_solicitudes_titular_eventos(solicitud_id, fecha_hora);
