-- @skip-when-env test
-- =============================================================================
-- Migración 029: el historial de las solicitudes de los Titulares es inalterable
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA. Solo crea dos triggers.
--
-- POR QUÉ ESTÁ SEPARADA DE LA 028
-- -------------------------------
-- La 028 crea las tablas y tiene que aplicarse en TODOS los ambientes
-- (también en test). Los triggers, en cambio, abortan el DELETE: y
-- `resetDb()` borra las tablas entre tests para que cada uno arranque desde
-- cero. Con el trigger instalado, esa limpieza abortaría.
--
-- Es exactamente el mismo motivo por el que la 020 (registro de auditoría de
-- la firma) y la 025 (lápida de la purga) están separadas de la 024: la
-- garantía se salta SOLO en el ambiente que la necesita, y en CI se prueba
-- aparte, aplicando el ARCHIVO REAL contra una base en memoria.
--
-- LA GARANTÍA
-- ------------
-- El 3.6(g) del Acuerdo dice que "el registro de auditoría de los eventos del
-- proceso de firma... no puede ser alterado una vez registrado". Este es el
-- mismo principio aplicado al registro de las solicitudes del 10.7(b): si
-- una solicitud se puede borrar, no hay prueba de que K+AIR "dio trámite".
--
-- Tests: tests/solicitudes-titular.test.js (aplica ESTE archivo real en una
--         base en memoria, como hace tests/conservacion-purga.test.js con la
--         020 y la 025).
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_solicitudes_titular_eventos_no_update
BEFORE UPDATE ON gh_solicitudes_titular_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_solicitudes_titular_eventos es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_solicitudes_titular_eventos_no_delete
BEFORE DELETE ON gh_solicitudes_titular_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_solicitudes_titular_eventos es append-only: no se puede DELETE');
END;
