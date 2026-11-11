-- @skip-when-env test
-- =============================================================================
-- 062 · EL RASTRO DE LOS PODERES DEL ENCARGADO, APPEND-ONLY
-- =============================================================================
--
-- La tabla del rastro de los poderes acreditados (migracion 061) es
-- INALTERABLE. Es el mismo criterio que el rastro de la suscripcion del
-- Anexo de Nube (055), el de la bitacora de eventos (020), el del rastro de
-- las excepciones (036) y el de la ficha de la Empresa (038): lo que se
-- escribe una vez, no se altera.
--
-- POR QUE
-- -------
-- El poder acreditado es lo que sostiene el SEGUNDO ACTO del Anexo de Nube: el
-- acta de contrafirma dice que quien la firmo tenia facultad para hacerlo, y
-- esa afirmacion se apoya en el rastro de los poderes. Si ese rastro se
-- pudiera reescribir, la serie de hechos ("se registro este poder", "se
-- revoco") podria decir otra cosa sin que nadie lo notara.
--
-- POR QUE LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migracion se salta en el ambiente de test
--   y el test de inmutabilidad (tests/poderes-encargado.test.js) aplica este
--   MISMO archivo a una base en memoria para comprobar que los triggers
--   muerden de verdad.
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS trg_encargado_poderes_eventos_no_update
BEFORE UPDATE ON gh_firma_encargado_poderes_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_encargado_poderes_eventos es append-only: el rastro de los poderes no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_encargado_poderes_eventos_no_delete
BEFORE DELETE ON gh_firma_encargado_poderes_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_encargado_poderes_eventos es append-only: el rastro de los poderes no se borra');
END;
