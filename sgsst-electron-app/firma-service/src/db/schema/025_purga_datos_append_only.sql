-- @skip-when-env test
-- =============================================================================
-- Migración 025: la lápida de la supresión es inalterable
-- =============================================================================
--
-- Esta migración es ADITIVA (no breaking para datos existentes). Solo crea
-- dos triggers sobre la tabla `gh_firma_purgadas` que crea la migración 024.
--
-- POR QUÉ ESTÁ SEPARADA DE LA 024
-- --------------------------------
-- La 024 crea la tabla y la columna del identificador de la solicitud: las
-- dos cosas hacen falta en TODOS los ambientes, incluido el de test.
--
-- Los triggers, en cambio, chocan con la limpieza entre tests: `resetDb()`
-- borra las tablas para que cada test arranque de cero, y con el trigger
-- activo ese DELETE abortaría. Por eso van en su propio archivo, con la
-- directiva `@skip-when-env test` — el MISMO mecanismo y la misma razón que la
-- migración 020 (el registro de auditoría).
--
-- Debilitar la garantía "para que los tests pasen" dejaría la puerta abierta
-- en producción. Lo correcto es lo contrario: la garantía se salta SOLO en el
-- ambiente que la necesita, y el test la comprueba aparte aplicando el
-- ARCHIVO REAL de esta migración en una base de datos aislada. En producción
-- (NODE_ENV distinto de test) la migración 025 sí se aplica: el runner la
-- registra y ejecuta.
--
-- LA GARANTÍA
-- ------------
-- La lápida es la prueba de qué se suprimió, por qué, por quién y cuándo. Si
-- la supresión pudiera borrar su propio rastro, no habría forma de demostrar
-- qué se suprimió — y el 10.6 del Acuerdo exige que la supresión quede
-- probada.
--
-- A diferencia del registro de auditoría (3.6(g)), la lápida NO tiene
-- ventanas ni excepciones: no hay ningún caso legitimate en el que se deba
-- corregir o borrar una lápida. Si hay que corregir una, se inserta otra con
-- el motivo correcto.
--
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_firma_purgadas_no_update
BEFORE UPDATE ON gh_firma_purgadas
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purgadas es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_purgadas_no_delete
BEFORE DELETE ON gh_firma_purgadas
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_purgadas es append-only: no se puede DELETE');
END;
