-- @skip-when-env test
-- ============================================================================
-- 053 · BITACORA DEL CANAL DE FECHA DE TERMINACION, APPEND-ONLY
-- ============================================================================
--
-- La bitacora del canal de la fecha de terminacion (migracion 052) es
-- INALTERABLE. El Anexo de Encargo, seccion 6, dice que el Encargado
-- "registra la fecha con la evidencia de la comunicacion y recalcula el plazo
-- de las filas afectadas, dejando registro de la operacion". Un registro que
-- se puede reescribir no deja registro de nada.
--
-- A diferencia de la bitacora de eventos de firma (migracion 020), esta NO
-- tiene ventana de purga: es la traza de una comunicacion de la Empresa y de
-- la decision del operador, y no se borra por vencer un plazo de conservacion.
-- La unica excepcion a la regla general de la 020 es que esta bitacora NO
-- contiene datos personales del Titular: contiene la decision administrativa,
-- el pseudonimo del trabajador y quien la tomo.
--
-- POR QUE LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migracion se salta en el ambiente de test
--   y el test de inmutabilidad (tests/fecha-terminacion-canal.test.js) aplica
--   este MISMO archivo a una base en memoria para comprobar que los triggers
--   muerden de verdad.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_fecha_terminacion_eventos_no_update
BEFORE UPDATE ON gh_firma_fecha_terminacion_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_fecha_terminacion_eventos es append-only: la bitacora del canal de fecha de terminacion no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_fecha_terminacion_eventos_no_delete
BEFORE DELETE ON gh_firma_fecha_terminacion_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_fecha_terminacion_eventos es append-only: la bitacora del canal de fecha de terminacion no se borra');
END;
