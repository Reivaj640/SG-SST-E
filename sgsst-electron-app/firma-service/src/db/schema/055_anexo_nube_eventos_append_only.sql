-- @skip-when-env test
-- ============================================================================
-- 055 · EL RASTRO DE LA SUSCRIPCIÓN DEL ANEXO DE NUBE, APPEND-ONLY
-- ============================================================================
--
-- La tabla del rastro de la suscripción del Anexo de Nube (migración 054) es
-- INALTERABLE. Es el mismo criterio de la bitácora de eventos (020), del
-- rastro de las excepciones (036) y del rastro de la ficha de la Empresa
-- (038): lo que se escribe una vez, no se altera.
--
-- POR QUÉ
-- -------
-- El §10 del Anexo de Nube v1.1 promete que la suscripción queda registrada
-- "con la auditoría del servicio". Si ese rastro se pudiera reescribir, la
-- promesa sería decorativa: bastaría con cambiar una fila para que la
-- secuencia de hechos dijera otra cosa.
--
-- La suscripción es un ACTO DE VOLUNTAD de una Empresa sobre un documento con
-- efectos jurídicos. La secuencia de hechos que lo acompaña (enlace abierto,
-- código enviado, código verificado, suscripción) es lo que permite después
-- demostrar qué se firmó, cuándo y desde dónde. Esa secuencia no se
-- reescribe.
--
-- POR QUÉ LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migración se salta en el ambiente de test
--   y el test de inmutabilidad (tests/anexo-nube-suscripcion.test.js) aplica
--   este MISMO archivo a una base en memoria para comprobar que los triggers
--   muerden de verdad.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_anexo_nube_eventos_no_update
BEFORE UPDATE ON gh_firma_anexo_nube_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_anexo_nube_eventos es append-only: el rastro de la suscripcion no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_anexo_nube_eventos_no_delete
BEFORE DELETE ON gh_firma_anexo_nube_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_anexo_nube_eventos es append-only: el rastro de la suscripcion no se borra');
END;
