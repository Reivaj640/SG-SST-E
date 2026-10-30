-- @skip-when-env test
-- =============================================================================
-- Migración 048: la lápida y el recibo de la prueba de aceptación son
-- inalterables (numerales 12.7 y 3.6(g))
-- =============================================================================
--
-- Esta migración es ADITIVA (no breaking para datos existentes). Solo crea
-- cuatro triggers sobre las tablas que crea la migración 047.
--
-- POR QUÉ ESTÁ SEPARADA DE LA 047
-- --------------------------------
-- La 047 crea las tablas: las tres cosas hacen falta en TODOS los ambientes,
-- incluido el de test.
--
-- Los triggers, en cambio, chocan con la limpieza entre tests: `resetDb()`
-- borra las tablas para que cada test arranque de cero, y con el trigger
-- activo ese DELETE abortaría. Por eso van en su propio archivo, con la
-- directiva `@skip-when-env test` — el MISMO mecanismo y la misma razón que la
-- migración 020 (el registro de auditoría) y la 025 (la lápida de la firma).
--
-- Debilitar la garantía "para que los tests pasen" dejaría la puerta abierta
-- en producción. Lo correcto es lo contrario: la garantía se salta SOLO en el
-- ambiente que la necesita, y el test la comprueba aparte aplicando el
-- ARCHIVO REAL de esta migración en una base de datos aislada. En producción
-- (NODE_ENV distinto de test) la migración 048 sí se aplica: el runner la
-- registra y ejecuta.
--
-- LA GARANTÍA
-- ------------
-- La lápida de la prueba de aceptación dice QUÉ se suprimió, POR QUÉ, POR
-- QUIÉN y CUÁNDO, con el plazo declarado, su fundamento y su punto de inicio.
-- El recibo es lo que la Empresa entrega al Trabajador. Si cualquiera de los
-- dos se pudiera corregir o borrar, no habría forma de demostrar qué se
-- suprimió — y el 10.6 del Acuerdo exige que la supresión quede probada.
--
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_firma_prueba_lapida_no_update
BEFORE UPDATE ON gh_firma_prueba_lapida
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_prueba_lapida es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_prueba_lapida_no_delete
BEFORE DELETE ON gh_firma_prueba_lapida
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_prueba_lapida es append-only: no se puede DELETE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_prueba_recibo_no_update
BEFORE UPDATE ON gh_firma_prueba_recibo
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_prueba_recibo es append-only: no se puede UPDATE');
END;

CREATE TRIGGER IF NOT EXISTS trg_firma_prueba_recibo_no_delete
BEFORE DELETE ON gh_firma_prueba_recibo
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_prueba_recibo es append-only: no se puede DELETE');
END;
