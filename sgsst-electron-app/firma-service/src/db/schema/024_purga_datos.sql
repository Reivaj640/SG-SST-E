-- =============================================================================
-- Migración 024: la lápida de la supresión de datos y el identificador de la
--                solicitud en la prueba de aceptación
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- EL PROBLEMA QUE RESUELVE
-- -------------------------
-- La capa de auditoría (migración 020) borra el REGISTRO DE AUDITORÍA de las
-- firmas vencidas. Eso destruye la prueba y conserva el dato: exactamente lo
-- contrario de lo que ordena el numeral 8.6 y el 10.6 del Acuerdo de uso
-- ("Vencido ese plazo y sin que exista un deber legal o contractual de
-- conservación, el dato se suprime").
--
-- Esta migración deja preparada la CAPA DE DATOS (la 5B): la fila completa de
-- la firma y los archivos que la acompañaban.
--
-- POR QUÉ UNA LÁPIDA Y NO SOLO UN BORRADO
-- --------------------------------------
-- Si la fila se borra y no queda nada, el enlace de firma vuelve a dar 404 y
-- el sistema responde "No disponible". Eso es honesto pero incompleto: la
-- respuesta correcta, la que el numerl 10.6 pide, es "no disponible por
-- VENCIMIENTO DEL PLAZO". Son dos cosas distintas y el firmante (o la
-- autoridad que consulta) tiene derecho a saber cuál es.
--
-- La lápida responde eso. Y para hacerlo sin conservar la credencial:
--
--   - NO se guarda el `token_hash` de la fila (que es la credencial del
--     enlace y, con la llave del servicio, permitiría resolver la fila).
--   - Se guarda `token_tombstone` = HMAC(proposito='tombstone-purga',
--     token_hash). Es un hash DE un hash, con otro propósito y otra llave
--     derivada: no sirve para autenticarse ni para resolver nada. Solo
--     permite que el sistema diga "esta firma se suprimió por plazo".
--
-- Lo que sobrevive a la supresión
-- -------------------------------
-- El 12.7 del Acuerdo deja en cabeza de la Empresa la conservación de "la
-- prueba de la aceptación de este Acuerdo por el Trabajador, junto con la
-- versión aceptada, la huella digital de su texto, la fecha y hora y el
-- identificador de la solicitud". La fila de la firma se borra; la prueba de
-- la aceptación vive en `gh_consentimientos_firma`, que NO tiene llave
-- foránea contra la firma y por eso sobrevive sola. Lo que le faltaba era
-- el identificador de la solicitud: de ahí la columna de abajo.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La lápida: qué firma se suprimió, por qué, por quién y cuándo.
--
-- SIN datos personales: ni el correo del trabajador, ni su número de
-- documento, ni su nombre. Solo identificadores internos, la marca de
-- supresión y el recuento de lo que se borró.
--
-- Es append-only, como el registro de auditoría y el recibo de purgas: si la
-- supresión borrara su propio rastro, no habría forma de demostrar qué se
-- suprimió. No hay ninguna ventana que la abra.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_purgadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  -- HMAC con propósito propio sobre el hash del token. NO es la credencial.
  token_tombstone TEXT NOT NULL,
  -- 8C: una firma puede tener VARIOS tokens (el original y sus rotaciones).
  -- La lápida tiene que cubrirlos todos, o un enlace rotado respondería "no
  -- disponible" (404) en vez de "no disponible por vencimiento del plazo"
  -- (410): dos respuestas para el mismo hecho, según por dónde se entre.
  -- Es un JSON con las marcas de todos los tokens de la firma, la primera de
  -- las cuales es la de `token_tombstone`.
  token_tombstones TEXT,
  id_empresa TEXT,
  purgado_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  categorias TEXT NOT NULL,
  archivos_eliminados INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_firma_purgadas_tombstone
  ON gh_firma_purgadas(token_tombstone);

CREATE INDEX IF NOT EXISTS idx_firma_purgadas_empresa
  ON gh_firma_purgadas(id_empresa, purgado_at DESC);

-- Los TRIGGERS append-only de esta tabla NO están aquí: viven en la
-- migración 025 (025_purga_datos_append_only.sql), que lleva la directiva
-- `@skip-when-env test` por la misma razón que la 020: en el ambiente de test
-- los tests limpian la tabla entre casos y con el trigger abortarían. Ver el
-- comentario de la 025 y el test tests/fase8a2-supresion-datos.test.js, que
-- aplica el archivo real en una base aislada para comprobar que el trigger
-- aborta.

-- -----------------------------------------------------------------------------
-- El identificador de la solicitud en la prueba de aceptación (12.7).
--
-- La prueba de la aceptación sobrevive a la supresión de la firma (esta tabla
-- no tiene llave foránea contra ella). Para que cumpla el 12.7 completo
-- ("...y el identificador de la solicitud"), hace falta saber a qué solicitud
-- pertenecía cada aceptación.
-- -----------------------------------------------------------------------------
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN id_solicitud TEXT;

CREATE INDEX IF NOT EXISTS idx_consent_id_solicitud
  ON gh_consentimientos_firma(id_solicitud);
