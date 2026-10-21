-- =============================================================================
-- Migración 029: el deber legal de conservación sin término (por Empresa)
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes). Solo añade
-- dos columnas a `gh_firma_empresas`. No crea tablas ni borra datos.
--
-- EL PROBLEMA QUE RESUELVE
-- -----------------------
-- El artículo 2.2.1.1.12 del Decreto 1072 de 2015 (añadido por el Decreto 526
-- de 2021) dice:
--
--   "Los empleadores deberán conservar los contratos de trabajo firmados
--    electrónicamente mediante los mecanismos técnicos que garanticen la
--    autenticidad, integridad y disponibilidad de los documentos."
--
-- SIN TÉRMINO. Y el 8.6 del Acuerdo deja el plazo en la tabla de retención
-- documental de la Empresa, con lo que el vencimiento de esa tabla hoy
-- extingue un deber que la ley no extingue: el sistema suprime el contrato.
--
-- Decisión del owner (2026-10-20): la carga es **a nivel de EMPRESA**, no de
-- documento. Por qué:
--
--   (a) es una cualidad de la relación laboral, no del archivo;
--   (b) por documento se olvida y se reproduce la contradicción;
--   (c) el sistema NO puede clasificar un PDF con acierto — el mismo
--       argumento del 10.8: no se lee el documento antes del consentimiento;
--   (d) ya existe el patrón: `gh_firma_empresas` guarda los datos de política
--       de la Empresa, y la habilitación (D-03) exige declararlos.
--
-- QUÉ SIGNIFICA EL FLAG
-- ---------------------
-- `conservacion_por_deber_legal = 1` significa: "esta Empresa tiene una
-- relación laboral con deber de conservación sin término". Con el flag en 1:
--
--   - las firmas de esa empresa NO reciben fecha de supresión automática;
--   - se levanta un HOLD legal automático (actor 'sistema'), gobernado por
--     `gh_firma_holds`: se libera con actor y motivo cuando la relación
--     termina o el documento se sustituye;
--   - el Trabajador recibe el aviso en la mini-app y en el correo: su
--     documento no se borra automáticamente.
--
-- NO es "nunca se purga": es "nunca se purga SOLO". La diferencia entre un
-- deber legal y un accidente.
--
-- `norma_conservacion` es el texto de la norma que impone el deber (p. ej.
-- "2.2.1.1.12 del Decreto 1072 de 2015"). Se comunica al Trabajador
-- (transparencia) y se archiva con la solicitud.
--
-- Tests: tests/d03-habilitacion-empresa.test.js y
--         tests/conservacion-deber-legal.test.js
-- =============================================================================

ALTER TABLE gh_firma_empresas
  ADD COLUMN conservacion_por_deber_legal INTEGER NOT NULL DEFAULT 0;

ALTER TABLE gh_firma_empresas
  ADD COLUMN norma_conservacion TEXT;
