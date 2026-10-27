-- =============================================================================
-- 044 · LAS APROBACIONES DE PUBLICACIÓN DEL ACUERDO (JURÍDICA Y OPERATIVA)
-- =============================================================================
--
-- Decisión del owner (1.f, 2026-10-27), con el abogado: APROBAR EL TEXTO NO
-- AUTORIZA A PUBLICAR. La publicación queda condicionada a una autorización
-- operativa EXPRESA y verificable, con evidencia.
--
-- POR QUÉ ESTA TABLA EXISTE
-- ------------------------
-- Antes, la única evidencia de la versión del Acuerdo era la fila de
-- gh_firma_acuerdo_versiones (quién la creó y con qué texto). Con eso, la
-- aprobación JURÍDICA del texto y la AUTORIZACIÓN OPERATIVA para publicarlo
-- quedaban mezcladas en un mismo acto: el que publicaba ya había aprobado.
--
-- Aquí quedan separadas, y las dos se archivan:
--   JURIDICA = el abogado aprobó el TEXTO.
--   OPERATIVA = hay evidencia técnica y hay un responsable del despliegue:
--                la garantía exigida, el resultado de las verificaciones y el
--                responsable del despliegue.
--
-- El hash es el SHA-256 del TEXTO APROBADO: por eso la aprobación no se puede
-- "trasladar" a otro texto. Si el texto cambia un caracter, el hash cambia y
-- la autorización deja de servir para esa versión (el servicio lo comprueba).
--
-- POR QUÉ ES APPEND-ONLY
-- ----------------------
-- Es el mismo criterio de la bitácora de eventos (020) y del rastro de las
-- excepciones (036): lo que se escribe una vez, no se altera. Una aprobación
-- corregida es una aprobación NUEVA, no una edición de la anterior.
--
-- POR QUÉ NO lleva @skip-when-env test
-- ------------------------------------
-- La tabla NO la limpia resetDb() (tests/helpers.js): el registro de una
-- autorización no es un dato de prueba, es la evidencia de que la publicación
-- estaba autorizada. Como la tabla no se vacía, los triggers se pueden instalar
-- también en el ambiente de test: el test de inmutabilidad
-- (tests/services/aprobacion-publicacion.test.js) los comprueba contra la
-- tabla real, sin simular nada.
--
-- Tests: tests/services/aprobacion-publicacion.test.js
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_aprobaciones_publicacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- La versión del Acuerdo a la que se refiere la aprobación (v1.0, v1.1...).
  version TEXT NOT NULL,
  -- El SHA-256 (hex, minúsculas) del TEXTO aprobado. El hash lo calcula el
  -- servidor; el cliente nunca lo manda.
  hash TEXT NOT NULL,
  -- JURIDICA = el abogado aprobó el texto.
  -- OPERATIVA = hay autorización operativa para publicar esa versión.
  tipo TEXT NOT NULL CHECK (tipo IN ('JURIDICA', 'OPERATIVA')),
  -- Quién aprobó (nombre o rol de quien autoriza).
  aprobado_por TEXT NOT NULL,
  -- La fecha de la aprobación (YYYY-MM-DD).
  fecha TEXT NOT NULL,
  -- El texto de la garantía técnica exigida (obligatoria en la OPERATIVA).
  garantia TEXT,
  -- El resultado de las verificaciones (obligatorio en la OPERATIVA).
  resultado_verificaciones TEXT,
  -- Quién responde del despliegue (obligatorio en la OPERATIVA).
  responsable_despliegue TEXT,
  -- Notas libres.
  notas TEXT,
  -- Cuándo se escribió el registro (ISO 8601).
  fecha_creacion TEXT NOT NULL,
  -- Una aprobación por (versión, texto, tipo): la que se registró primero es la
  -- que vale. Registrar la misma de nuevo es idempotente, no duplica la fila.
  UNIQUE (version, hash, tipo)
);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_publicacion
  ON gh_firma_aprobaciones_publicacion(version, hash, tipo);

CREATE TRIGGER IF NOT EXISTS trg_aprobaciones_publicacion_no_update
BEFORE UPDATE ON gh_firma_aprobaciones_publicacion
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_aprobaciones_publicacion es append-only: una aprobacion no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_aprobaciones_publicacion_no_delete
BEFORE DELETE ON gh_firma_aprobaciones_publicacion
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_aprobaciones_publicacion es append-only: una aprobacion no se borra');
END;
