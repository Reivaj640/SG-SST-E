-- =============================================================================
-- Migración 026: los tokens emitidos de cada firma (la rotación, decisión D1)
-- =============================================================================
--
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- EL PROBLEMA QUE RESUELVE
-- -------------------------
-- El numeral 3.6(e) del Acuerdo de uso promete que el token de acceso "se
-- conserva únicamente en forma de huella digital". El código no cumplía esa
-- promesa: además de la huella (HMAC-SHA-256 con clave secreta, que es lo
-- correcto), guardaba el token **cifrado** en
-- `metadata._server_metadata.token_encrypted`, y un endpoint interno lo
-- devolvía en texto claro. Cifrado sigue siendo reversible con la llave: el
-- token existía en la base en una forma que se podía recuperar.
--
-- La salida no es una excepción declarada en el texto, sino un mecanismo: la
-- **rotación**. Cuando la Empresa necesita el enlace otra vez (perdió la
-- respuesta de creación, o va a reenviar la invitación), se emite un token
-- NUEVO, se guarda su huella y se devuelve **una sola vez**. Los anteriores
-- siguen validos hasta su vencimiento, de modo que un enlace que ya está en
-- manos del trabajador no se rompe.
--
-- QUÉ GUARDA ESTA TABLA
-- ----------------------
-- Un registro por token emitido:
--
--   - `token_hash`: el HMAC-SHA-256 con clave secreta. ES la credencial. No
--     es reversible y no está en la misma base que la llave.
--   - `emision`: 1 es el token original (el que nació con la firma); 2, 3...
--     son las rotaciones.
--   - `emitido_at`, `expira_en`: cuándo se emitió y hasta cuándo sirve.
--   - `revocado_at`, `revocado_por`, `motivo_revocacion`: la revocación
--     explícita.
--   - `origen`: por qué se emitió (`create`, `rotate`, `notify`, `legacy`).
--
-- El tope son 3 tokens vivos por solicitud. Es un límite de credenciales
-- vivas para una misma firma, no un capricho: cada token es una puerta de
-- entrada al flujo de firma.
--
-- POR QUÉ LA FIRMA NO PUEDE QUEDAR SIN TOKENS
-- --------------------------------------------
-- La llave foránea con `ON DELETE CASCADE`: cuando la 5B suprime la fila de
-- la firma, sus tokens se van con ella. Un token sin firma no resuelve nada,
-- y dejarlo sería guardar credenciales de algo que ya no existe.
--
-- La columna `token_hash` de `gh_firmas_electronicas` NO se toca: es la
-- huella del token original, y las firmas anteriores a esta migración solo
-- la tienen ahí. La búsqueda prueba primero esta tabla y después la columna,
-- para que ninguna fila quede sin poder resolverse.
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  -- HMAC-SHA-256 con clave secreta. ES la credencial del enlace.
  token_hash TEXT NOT NULL UNIQUE,
  -- 1 = token original; 2, 3... = rotaciones.
  emision INTEGER NOT NULL,
  emitido_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Fin de la ventana del enlace (la de la firma: la rotación no extiende el
  -- plazo, solo emite otro acceso al mismo plazo).
  expira_en TEXT,
  -- Revocación explícita. Un token revocado NO resuelve: el enlace queda
  -- muerto a propósito y no por accidente.
  revocado_at TEXT,
  revocado_por TEXT,
  motivo_revocacion TEXT,
  -- create | rotate | notify | legacy
  origen TEXT NOT NULL DEFAULT 'create',
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_firma_tokens_firma
  ON gh_firma_tokens(firma_id, emision);

CREATE UNIQUE INDEX IF NOT EXISTS idx_firma_tokens_firma_emision
  ON gh_firma_tokens(firma_id, emision);
