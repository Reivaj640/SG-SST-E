-- @skip-when-env test
-- ============================================================================
-- 057 · EL RASTRO DE LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO, APPEND-ONLY
-- ============================================================================
--
-- La tabla del rastro de la suscripción del Anexo de Encargo (migración 056)
-- es INALTERABLE. Es el mismo criterio de la bitácora de eventos (020), del
-- rastro de las excepciones (036), del rastro de la ficha de la Empresa (038)
-- y del rastro de la suscripción del Anexo de Nube (055).
--
-- POR QUÉ
-- -------
-- El §12 del Anexo de Encargo promete que el registro de la firma "queda
-- además en la bitácora de auditoría, con el valor anterior, el nuevo, quién
-- lo registró, su dirección IP, su navegador y, cuando se cambia una fecha ya
-- registrada, el motivo del cambio". Si ese rastro se pudiera reescribir, la
-- promesa sería decorativa: bastaría con cambiar una fila para que la
-- secuencia de hechos dijera otra cosa.
--
-- Y aquí pesa más que en el Anexo de Nube: el Anexo de Encargo es un
-- CONTRATO BILATERAL. La secuencia de hechos que lo acompaña (enlace abierto,
-- código enviado, código verificado, suscripción de la Empresa,
-- contrafirma de K+AIR) es lo que permite demostrar después qué se firmó,
-- cuándo y desde dónde. Esa secuencia no se reescribe.
--
-- POR QUÉ LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migración se salta en el ambiente de test
--   y el test de inmutabilidad (tests/migration-057.test.js) aplica este MISMO
--   archivo a una base en memoria para comprobar que los triggers muerden de
--   verdad.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_anexo_encargo_eventos_no_update
BEFORE UPDATE ON gh_firma_anexo_encargo_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_anexo_encargo_eventos es append-only: el rastro de la suscripcion no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_anexo_encargo_eventos_no_delete
BEFORE DELETE ON gh_firma_anexo_encargo_eventos
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_anexo_encargo_eventos es append-only: el rastro de la suscripcion no se borra');
END;
