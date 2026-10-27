-- =============================================================================
-- 043 · LA CONFIRMACIÓN DEL MEDIO PERSONAL DEL CÓDIGO POR EL TRABAJADOR
-- =============================================================================
--
-- Decisión del owner (1.a, 2026-10-27): la Empresa que contrata obtiene del
-- candidato su correo personal DE FORMA VERBAL y lo registra en la solicitud.
-- El Trabajador no tiene que escribirlo de nuevo: CONFIRMA en la pantalla de
-- firma que esa dirección es de su uso exclusivo y que la Empresa no administra
-- ese buzón.
--
-- POR QUÉ ESTA MIGRACIÓN EXISTE
-- -----------------------------
--   1. La CONFIRMACIÓN es un dato de la solicitud: la fecha y la hora, la
--      dirección confirmada y la VERSIÓN del texto de la declaración que se
--      le mostró al Trabajador. Sin columnas no hay evidencia de qué declaró ni
--      con qué redacción: si mañana se cambia el texto, no se podría saber con
--      cuál confirmó.
--
--   2. El medio CORREO_OTP que registró la Empresa cambia de ORIGEN cuando el
--      Trabajador lo confirma: 'EMPRESA' → 'TRABAJADOR_CONFIRMADO'. El CHECK
--      de la columna `origen` (migración 032) no admite ese valor, y SQLite NO
--      altera CHECKs: hay que reconstruir la tabla con el patrón 12-step (el
--      mismo de la 005).
--
-- LO QUE NO CAMBIA (y es lo importante)
-- --------------------------------------
--   - El control de dominio corporativo (MEDIO_OTP_CORPORATIVO) sigue siendo el
--     de siempre: la confirmación NO lo salta. El servicio aplica ese control
--     (que vive en publicFlow.resolveCorreoOtp) ANTES de registrar la
--     confirmación, así que una dirección que la Empresa puede leer nunca queda
--     confirmada.
--   - La fila del medio sigue PENDIENTE: hasta que el Trabajador verifique el
--     código no demostró que controla el buzón (ahí `medios.activar` la pasa a
--     ACTIVO). Confirmar NO es verificar.
--   - La dirección se guarda EN CLARO: es el buzón del propio Trabajador, que
--     lo conoce y que la Empresa ya tenía (lo obtuvo en la contratación).
--
-- Tests: tests/web/miniapp-medio-confirmado.test.js
-- =============================================================================

-- 1. La confirmación del Trabajador, en la fila de la solicitud.
--    NULL = el Trabajador todavía no confirmó (o no había medio registrado).
--    La fecha_hora es un ISO 8601 (fecha Y hora en el mismo dato).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN medio_otp_confirmado_fecha_hora TEXT;

--    La dirección que el Trabajador confirmó: la que va a recibir el código.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN medio_otp_confirmado_correo TEXT;

--    La versión del TEXTO de la declaración que se le mostró.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN medio_otp_confirmado_version TEXT;

-- -----------------------------------------------------------------------------
-- 2. El origen 'TRABAJADOR_CONFIRMADO' (patrón 12-step, ver la 005)
-- -----------------------------------------------------------------------------
-- Por qué NO se agrega el valor con un INSERT en la tabla original: el CHECK
-- de `origen` la rechazaría. Y por qué NO se agrega una columna suelta: el
-- origen es el que dice QUIÉN registró cada medio, y el registro de medios es
-- la evidencia que se muestra en el 8.2.
--
-- La tabla NO tiene FK que apunten a ella (verificado: solo hay un índice
-- explícito), así que el DROP del patrón 12-step no rompe nada. El runner
-- (src/db/migrate.js) apaga las FKs antes de la transacción y las restaura
-- después, por el mismo motivo que la 005.
CREATE TABLE gh_firma_medios_trabajador_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empresa TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'EMAIL_HOJA_VIDA', 'CORREO_OTP', 'LINK_KAIR'
  )),
  valor TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE', 'ACTIVO', 'BAJA'
  )),
  -- Quién lo registró:
  --   TRABAJADOR           = él mismo (lo declara).
  --   TRABAJADOR_CONFIRMADO = lo registró la Empresa y el Trabajador confirmó
  --                           en la pantalla de firma que es de su uso exclusivo
  --                           y que la Empresa no administra ese buzón.
  --   EMPRESA              = lo registró la Empresa y el Trabajador todavía no
  --                           lo confirmó.
  --   SISTEMA              = el alta automática al crear la solicitud.
  origen TEXT NOT NULL CHECK (origen IN (
    'TRABAJADOR', 'TRABAJADOR_CONFIRMADO', 'EMPRESA', 'SISTEMA'
  )),
  fecha_registro TEXT NOT NULL,
  fecha_modificacion TEXT NOT NULL,
  fecha_baja TEXT,
  UNIQUE (id_empresa, id_trabajador, tipo, valor)
);

INSERT INTO gh_firma_medios_trabajador_new (
  id, id_empresa, id_trabajador, tipo, valor, estado, origen,
  fecha_registro, fecha_modificacion, fecha_baja
)
SELECT
  id, id_empresa, id_trabajador, tipo, valor, estado, origen,
  fecha_registro, fecha_modificacion, fecha_baja
FROM gh_firma_medios_trabajador;

DROP TABLE gh_firma_medios_trabajador;

ALTER TABLE gh_firma_medios_trabajador_new
  RENAME TO gh_firma_medios_trabajador;

CREATE INDEX IF NOT EXISTS idx_medios_trabajador
  ON gh_firma_medios_trabajador(id_empresa, id_trabajador, estado);
