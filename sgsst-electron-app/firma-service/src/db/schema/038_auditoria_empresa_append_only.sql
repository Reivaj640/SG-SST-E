-- @skip-when-env test
-- ============================================================================
-- 038 · RASTRO DE LA FICHA DE LA EMPRESA, APPEND-ONLY
-- ============================================================================
--
-- La tabla del rastro de los cambios de la ficha (migracion 037) es
-- INALTERABLE. Es el mismo criterio de la bitacora de eventos (020) y de la
-- bitacora de excepciones (036): lo que se escribe una vez, no se altera.
--
-- POR QUE
-- -------
-- El abogado lo pone como bloqueante de la publicacion de la v1.1:
--
--   "Canal de PQRS unico (formulario o endpoint) | Si - sin el, el override no
--    deja rastro"
--
-- El `PUT /internal/admin/empresas/:id` es un REEMPLAZO de la ficha completa:
-- lo que no se manda queda en NULL. Sin esta migracion, un canal de PQRS
-- declarado por via administrativa puede ser pisado por un guardado de
-- escritorio y no queda NADA que diga quien lo cambio ni cuando.
--
-- Unica excepcion: la ventana de purga general del 8.6 no aplica aqui. Esta
-- tabla no contiene datos personales del Titular: contiene los datos de la
-- Empresa y la decision administrativa de quien cambio que. El documento del
-- representante legal no se copia en claro: va enmascarado (ultimos 4), igual
-- que en el resto del sistema.
--
-- POR QUE LLEVA @skip-when-env test
--   El trigger de no-borrar hace que `resetDb()` (tests/helpers.js) no pueda
--   vaciar la tabla entre tests. La migracion se salta en el ambiente de test
--   y el test de inmutabilidad (tests/empresa-auditoria.test.js) aplica este
--   MISMO archivo a una base en memoria para comprobar que los triggers
--   muerden de verdad.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_empresas_auditoria_no_update
BEFORE UPDATE ON gh_firma_empresas_auditoria
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_empresas_auditoria es append-only: el rastro de la ficha no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_empresas_auditoria_no_delete
BEFORE DELETE ON gh_firma_empresas_auditoria
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_empresas_auditoria es append-only: el rastro de la ficha no se borra');
END;
