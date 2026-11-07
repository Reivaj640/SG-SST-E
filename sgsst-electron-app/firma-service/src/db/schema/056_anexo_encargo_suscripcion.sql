-- =============================================================================
-- 056 · LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO POR LA EMPRESA
-- =============================================================================
--
-- POR QUÉ ESTA MIGRACIÓN
-- ----------------------
-- El Anexo de Encargo (el contrato de encargo de tratamiento de datos entre la
-- Empresa responsable y Gesstiar S.A.S. como encargado) solo se podía firmar
-- por la vía física: un operador tenía que registrar la fecha a mano con
-- `POST /internal/admin/empresas/:id_empresa/anexo-firmado`. No existía ningún
-- canal por el que la Empresa lo suscribiera sola, como sí lo tenía el Anexo
-- de Nube desde la migración 054.
--
-- A diferencia del Anexo de Nube, este Anexo es BILATERAL: el §12 tiene dos
-- bloques de firma, "por el responsable (empresa cliente)" y "por el encargado
-- (Gesstiar S.A.S.)". Por eso esta fila guarda los DOS actos, y por eso el
-- estado "firmado" del instrumento (el del manifiesto legal) NO se deriva de
-- esta tabla: se deriva de que estén los dos actos.
--
-- Ver el plan de suscripción digital del 6-nov-2026 (DECISIÓN 1: dos fases).
--
-- QUÉ GUARDA CADA TABLA
-- ---------------------
--   gh_firma_anexo_encargo_suscripciones
--       UNA fila por intento de suscripción. Guarda el enlace (solo su
--       huella), a quién se le envía el código, el estado, los intentos, los
--       CINCO datos del §11 que declaró la Empresa y la EVIDENCIA del acto.
--       El texto del Anexo NO se copia aquí: lo que se suscribe es una VERSIÓN
--       con su HUELLA SHA-256, y el texto vive en `legal/anexo-encargo.html`,
--       con la misma huella.
--
--       `datos_empresa` guarda los cinco datos del §11 TAL COMO los declaró la
--       Empresa en la pantalla (razón social, NIT/C.C., domicilio, correo y
--       representante), en JSON. El texto canónico se suscribe con sus huecos
--       (el precedente ya establecido con el Anexo de Nube: los datos de la
--       Empresa no se diligencian en el modelo); lo que la Empresa completó es
--       lo que queda en su copia y en el acta.
--
--       `token_hash` es el HMAC del enlace de un solo uso (misma derivación
--       que los tokens de firma, ver src/crypto/token.js). En la base nunca
--       está el enlace en claro: sin él, el enlace no se puede abrir.
--
--       `otp_hash` es el HMAC del código de verificación, con el ámbito de la
--       Empresa (src/crypto/otp.js). NUNCA se guarda el código en claro.
--
--       `contrafirmado_at` y `contrafirma_evidencia` son el SEGUNDO acto: la
--       contrafirma de K+AIR. Mientras `contrafirmado_at` sea NULL, el Anexo NO
--       está ejecutado y el manifiesto no puede decir "firmado".
--
--   gh_firma_anexo_encargo_eventos
--       El rastro append-only de la suscripción: qué pasó, cuándo, desde qué
--       IP y con qué navegador. Es la auditoría que promete el §12 del Anexo
--       de Encargo. Es inalterable, igual que la bitácora de eventos (020) y
--       la de la ficha de la Empresa (038).
--
-- POR QUÉ NO SE BORRA NADA
-- -------------------------
-- Una suscripción es un acto de voluntad de una Empresa sobre un contrato con
-- efectos jurídicos. Si se pudiera borrar, el registro de "quién suscrito
-- qué y cuándo" dejaría de ser creíble. La única forma de corregir una
-- suscripción es registrar OTRA con su motivo, que queda en el rastro de la
-- ficha de la Empresa (migración 037).
--
-- COMPATIBILIDAD
-- --------------
-- Es aditiva: no toca ninguna tabla existente. La columna del Anexo de
-- Encargo en `gh_firma_empresas` (migración 017) sigue siendo la verdad de
-- "esta Empresa tiene el Anexo firmado"; esta tabla guarda el cómo y el
-- cuándo de cada intento.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_anexo_encargo_suscripciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empresa TEXT NOT NULL,
  -- Huella del enlace de un solo uso. NUNCA el enlace en claro.
  token_hash TEXT NOT NULL UNIQUE,
  -- La versión del Anexo de Encargo que se suscribe y la huella de su texto.
  version TEXT NOT NULL,
  hash_texto TEXT NOT NULL,
  -- Los CINCO datos del §11 tal como los declaró la Empresa, en JSON:
  -- razon_social, nit, domicilio, correo, representante.
  datos_empresa TEXT,
  -- A quién se le envía el código de verificación.
  correo_firmante TEXT NOT NULL,
  nombre_firmante TEXT,
  cargo_firmante TEXT,
  -- PENDIENTE | CODIGO_ENVIADO | FIRMADA | EXPIRADA | BLOQUEADA | ANULADA
  --
  -- OJO CON "FIRMADA": significa que la EMPRESA suscribió (fase 1). NO
  -- significa que el instrumento esté ejecutado: para eso hace falta además
  -- `contrafirmado_at` (fase 2, la contrafirma de K+AIR). Es la DECISIÓN 1
  -- del plan de suscripción digital del 6-nov-2026: el manifiesto solo dice
  -- "firmado" cuando están los dos actos.
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
  -- La contrafirma de K+AIR (fase 2). NULL = todavía no contrafirmado.
  contrafirmado_at TEXT,
  contrafirma_evidencia TEXT,
  creado_por TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anexo_encargo_suscripciones_empresa
  ON gh_firma_anexo_encargo_suscripciones(id_empresa);

CREATE INDEX IF NOT EXISTS idx_anexo_encargo_suscripciones_estado
  ON gh_firma_anexo_encargo_suscripciones(estado);

-- =============================================================================
-- EL RASTRO APPEND-ONLY DE LA SUSCRIPCIÓN
-- =============================================================================
CREATE TABLE IF NOT EXISTS gh_firma_anexo_encargo_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_suscripcion INTEGER NOT NULL,
  id_empresa TEXT NOT NULL,
  evento TEXT NOT NULL,
  detalle TEXT,
  ip TEXT,
  user_agent TEXT,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anexo_encargo_eventos_suscripcion
  ON gh_firma_anexo_encargo_eventos(id_suscripcion);

CREATE INDEX IF NOT EXISTS idx_anexo_encargo_eventos_empresa
  ON gh_firma_anexo_encargo_eventos(id_empresa);

-- Los triggers que hacen inalterable el rastro van en su propia migración
-- (057_anexo_encargo_eventos_append_only.sql), porque esa migración se salta en
-- el ambiente de test: el trigger de no-borrar impide que `resetDb()` vacíe
-- la tabla entre tests. El test de inmutabilidad aplica ese MISMO archivo a
-- una base en memoria para comprobar que los triggers muerden de verdad.
