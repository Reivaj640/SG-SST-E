-- =============================================================================
-- 054 · LA SUSCRIPCIÓN DEL ANEXO DE NUBE POR LA EMPRESA
-- =============================================================================
--
-- POR QUÉ ESTA MIGRACIÓN
-- ----------------------
-- El Anexo de Nube v1.0 (modelo) se prohibía a sí mismo: decía «este Anexo no
-- se firma hasta que se haya completado la lista del bloque de pendientes».
-- Con ese texto, ninguna Empresa podía suscribirlo y el servicio no tenía
-- ningún canal para registrar esa suscripción: solo existía un endpoint
-- administrativo que obligaba a un operador a registrar la firma a mano.
--
-- La v1.1 del Anexo de Nube (5-nov-2026) quita la prohibición y declara el
-- estado del servicio a la vista. Esta migración deja el CANAL por el que la
-- Empresa lo suscribe.
--
-- QUÉ GUARDA CADA TABLA
-- ---------------------
--   gh_firma_anexo_nube_suscripciones
--       UNA fila por intento de suscripción. Guarda el enlace (solo su
--       huella), a quién se le envía el código, el estado, los intentos y la
--       EVIDENCIA del acto. El texto del Anexo NO se copia aquí: lo que se
--       suscribe es una VERSIÓN con su HUELLA SHA-256, y el texto vive en
--       `legal/anexo-nube-v1.1.html`, con la misma huella.
--
--       `token_hash` es el HMAC del enlace de un solo uso (misma derivación
--       que los tokens de firma, ver src/crypto/token.js). En la base nunca
--       está el enlace en claro: sin él, el enlace no se puede abrir.
--
--       `otp_hash` es el HMAC del código de verificación, con el ámbito de la
--       Empresa (src/crypto/otp.js). NUNCA se guarda el código en claro.
--
--   gh_firma_anexo_nube_eventos
--       El rastro append-only de la suscripción: qué pasó, cuándo, desde qué
--       IP y con qué navegador. Es la auditoría que promete el §10 del Anexo
--       de Nube v1.1. Es inalterable, igual que la bitácora de eventos (020)
--       y la de la ficha de la Empresa (038).
--
-- POR QUÉ NO SE BORRA NADA
-- -------------------------
-- Una suscripción es un acto de voluntad de una Empresa sobre un documento
-- con efectos jurídicos. Si se pudiera borrar, el registro de "quién
-- suscrito qué y cuándo" dejaría de ser creíble. La única forma de
-- corregir una suscripción es registrar OTRA con su motivo, que queda en el
-- rastro de la ficha de la Empresa (migración 037).
--
-- COMPATIBILIDAD
-- --------------
-- Es aditiva: no toca ninguna tabla existente. Las columnas del Anexo de
-- Nube en `gh_firma_empresas` (migración 050) siguen siendo la verdad de
-- "esta Empresa tiene el Anexo suscrito"; esta tabla guarda el cómo y el
-- cuándo de cada intento.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_anexo_nube_suscripciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empresa TEXT NOT NULL,
  -- Huella del enlace de un solo uso. NUNCA el enlace en claro.
  token_hash TEXT NOT NULL UNIQUE,
  -- La versión del Anexo de Nube que se suscribe y la huella de su texto.
  version TEXT NOT NULL,
  hash_texto TEXT NOT NULL,
  -- A quién se le envía el código de verificación.
  correo_firmante TEXT NOT NULL,
  nombre_firmante TEXT,
  cargo_firmante TEXT,
  -- PENDIENTE | CODIGO_ENVIADO | FIRMADA | EXPIRADA | BLOQUEADA | ANULADA
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  otp_hash TEXT,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  otp_envios INTEGER NOT NULL DEFAULT 0,
  otp_enviado_at TEXT,
  enlace_abierto_at TEXT,
  expira_enlace_at TEXT NOT NULL,
  firmado_at TEXT,
  evidencia TEXT,
  ip_creacion TEXT,
  user_agent_creacion TEXT,
  ip_firma TEXT,
  user_agent_firma TEXT,
  creado_por TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anexo_nube_suscripciones_empresa
  ON gh_firma_anexo_nube_suscripciones(id_empresa);

CREATE INDEX IF NOT EXISTS idx_anexo_nube_suscripciones_estado
  ON gh_firma_anexo_nube_suscripciones(estado);

-- =============================================================================
-- EL RASTRO APPEND-ONLY DE LA SUSCRIPCIÓN
-- =============================================================================
CREATE TABLE IF NOT EXISTS gh_firma_anexo_nube_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_suscripcion INTEGER NOT NULL,
  id_empresa TEXT NOT NULL,
  evento TEXT NOT NULL,
  detalle TEXT,
  ip TEXT,
  user_agent TEXT,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anexo_nube_eventos_suscripcion
  ON gh_firma_anexo_nube_eventos(id_suscripcion);

CREATE INDEX IF NOT EXISTS idx_anexo_nube_eventos_empresa
  ON gh_firma_anexo_nube_eventos(id_empresa);

-- Los triggers que hacen inalterable el rastro van en su propia migración
-- (055_anexo_nube_eventos_append_only.sql), porque esa migración se salta en
-- el ambiente de test: el trigger de no-borrar impide que `resetDb()` vacíe
-- la tabla entre tests. El test de inmutabilidad aplica ese MISMO archivo a
-- una base en memoria para comprobar que los triggers muerden de verdad.
