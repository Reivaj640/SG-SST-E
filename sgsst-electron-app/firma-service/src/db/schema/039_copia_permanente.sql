-- =============================================================================
-- Migración 039: la COPIA PERMANENTE (el 8.5 y el 8.6(e)(iii) del Acuerdo)
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes). Solo añade
-- una columna a `gh_solicitudes_titular` y un índice. No crea tablas ni borra
-- datos.
--
-- EL PROBLEMA QUE RESUELVE
-- -----------------------
-- El numeral 8.5 del Acuerdo (texto final aprobado por el abogado, v1.1) dice:
--
--   "8.5. El Trabajador puede solicitar en cualquier momento una copia
--    permanente del contrato firmado, sus anexos, modificaciones y la Constancia.
--    La Empresa la entrega por el medio autorizado, sin costo, dentro de los
--    cinco (5) días hábiles siguientes. La copia se conserva aunque el enlace
--    haya expirado; la descarga desde el enlace es una cortesía y no sustituye
--    este derecho."
--
-- Y el 8.6(e)(iii) pone la condición de la supresión:
--
--   "(iii) ausencia de solicitud de copia pendiente"
--
-- En el código no había ninguna de las dos cosas:
--
--   - La taxonomía de solicitudes (10.7(a)) no tenía un tipo COPIA: el derecho
--     del 8.5 no se podía ejercer por el canal.
--   - No había forma de saber si una empresa tenía una copia PENDIENTE, así
--     que la cuarta condición del 8.6(e) no se podía cumplir.
--
-- QUÉ AÑADE
-- ---------
-- `plazo_copia`: la FECHA LÍMITE de entrega, en ISO 8601. Se calcula al
-- registrar la solicitud (cinco días hábiles desde el registro, con el helper
-- `_sumarDiasHabiles` de src/services/solicitudes.js) y NO se recalcula: es
-- la constancia del plazo que se le ofreció al Titular, y recalcularlo movería
-- la fecha que ya se le Peu comunicado.
--
-- Es NULL para las solicitudes que no son de tipo COPIA: el plazo del 8.5 no
-- aplica a un reclamo ni a una corrección de datos.
--
-- NOTA SOBRE EL 8.5 VIGENTE (v1.0, publicada y sellada)
-- ------------------------------------------------------
-- La v1.0 ya decía: "El Trabajador tiene derecho a obtener de la Empresa, en
-- cualquier momento y sin costo, una copia de su documento firmado" (8.5 de la
-- v1.0). Lo que aporta la v1.1 es el PLAZO de cinco (5) días hábiles y la
-- regla de que la copia se conserva aunque el enlace haya expirado. Esta
-- migración no cambia el texto de ninguna versión: deja el código listo para
-- el texto aprobado.
--
-- Tests: tests/copia-permanente-8-5.test.js
-- =============================================================================

ALTER TABLE gh_solicitudes_titular
  ADD COLUMN plazo_copia TEXT;

-- La consulta que decide si una Empresa tiene una copia PENDIENTE (la
-- cuarta condición del 8.6(e)) filtra por tipo, empresa y estado.
CREATE INDEX IF NOT EXISTS idx_solicitudes_titular_copia
  ON gh_solicitudes_titular(tipo, id_empresa, estado);
