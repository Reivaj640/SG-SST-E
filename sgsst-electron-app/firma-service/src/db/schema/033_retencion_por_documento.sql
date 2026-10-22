-- ============================================================================
-- 033 · RETENCIÓN POR TIPO DE DOCUMENTO
-- ============================================================================
--
-- Hasta la migración 032 el plazo de conservación era UNO por Empresa
-- (`gh_firma_empresas.plazo_retencion_dias`) y se contaba desde la firma. Eso
-- no puede representar los plazos que la ley fija por documento:
--
--   * El artículo 2.2.4.6.13 del Decreto 1072 de 2015 ordena conservar por un
--     mínimo de 20 años, desde el CESE de la relación laboral, cinco grupos de
--     registros del SG-SST.
--   * El artículo 2.2.1.1.12 (Decreto 526 de 2021) obliga a conservar los
--     contratos electrónicos con autenticidad, integridad y disponibilidad,
--     sin término: el contrato no se purga por la tabla de la Empresa.
--   * La historia laboral tiene un deber de conservación de 80 a 100 años
--     desde el retiro (T-470/2019; Concepto AGN 2-2017-01654).
--
-- Estas columnas guardan la decisión en la FILA, no en la Empresa:
--
--   categoria_retencion       · id del catálogo (src/services/retencion.js).
--                               NULL = solicitud legacy: se conserva el
--                               comportamiento anterior (tabla de la Empresa
--                               con texto vivo).
--   regla_retencion           · id de la regla aplicada (SST_20_ANOS,
--                               CONTRATO_ELECTRONICO, HISTORIA_LABORAL,
--                               TABLA_EMPRESA). NULL en las legacy.
--   fecha_terminacion         · cese de la relación laboral o retiro. Es la
--                               base del cómputo de 20/100 años. NULL si aún
--                               no se conoce: en ese caso la fila queda con
--                               fecha_conservacion NULL y un aviso.
--   plazo_retencion_aplicable · texto que se comunica al Trabajador para ESTA
--                               solicitud. Congela el texto legal (20 años,
--                               contrato, historia laboral) para que un cambio
--                               posterior de la tabla de la Empresa no altere
--                               lo que se le comunicó.
--
-- No hay backfill. Las filas existentes quedan con las cuatro columnas NULL y
-- siguen funcionando con la Empresa viva, exactamente como antes.
-- ============================================================================

ALTER TABLE gh_firmas_electronicas ADD COLUMN categoria_retencion TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN regla_retencion TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN fecha_terminacion TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN plazo_retencion_aplicable TEXT;

CREATE INDEX IF NOT EXISTS idx_firmas_categoria_retencion
  ON gh_firmas_electronicas(categoria_retencion);
