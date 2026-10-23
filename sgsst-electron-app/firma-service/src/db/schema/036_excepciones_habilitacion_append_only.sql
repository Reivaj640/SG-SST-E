-- @skip-when-env test
-- ============================================================================
-- 036 · BITACORA DE EXCEPCIONES APPEND-ONLY
-- ============================================================================
--
-- La bitacora de las excepciones de habilitacion (migracion 035) es
-- INALTERABLE. El abogado la pide asi: "Rastro: bitacora inmutable: usuario,
-- fecha, motivo, Empresa, numero de firmas".
--
-- A diferencia de la bitacora de eventos de firma (migracion 020), esta NO
-- tiene ventana de purga: es la traza de quien decidio saltarse un
-- bloqueo de cumplimiento, y no se borra por vencer un plazo de conservacion.
-- Unica excepcion: la ventana de purga general del 8.6 no aplica aqui, porque
-- esta bitacora no contiene datos personales del Titular: contiene la
-- decision administrativa y quien la tomo.
--
-- POR QUE LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migracion se salta en el ambiente de test
--   y el test de inmutabilidad (tests/excepcion-habilitacion.test.js) aplica
--   este MISMO archivo a una base en memoria para comprobar que los triggers
--   muerden de verdad.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_excepciones_habilitacion_eventos_no_update
BEFORE UPDATE ON gh_firma_excepciones_habilitacion_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_excepciones_habilitacion_eventos es append-only: la bitacora de excepciones no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_excepciones_habilitacion_eventos_no_delete
BEFORE DELETE ON gh_firma_excepciones_habilitacion_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_excepciones_habilitacion_eventos es append-only: la bitacora de excepciones no se borra');
END;
