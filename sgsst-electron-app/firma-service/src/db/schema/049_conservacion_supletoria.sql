-- ============================================================================
-- 049 · TRAZABILIDAD DE LA CONSERVACIÓN (tabla supletoria de K+AIR)
-- ============================================================================
--
-- QUÉ ES ESTA MIGRACIÓN
-- --------------------
-- La tabla de conservación administrada por K+AIR (config/tabla-conservacion.json)
-- es, desde esta versión, la fuente única del plazo por defecto: si la Empresa
-- NO declara un plazo en su tabla de retención documental, el sistema aplica el
-- de la categoría que corresponda en la tabla supletoria. Con eso, ningún
-- documento queda retenido indefinidamente por falta de configuración: la
-- ausencia de un plazo de la Empresa ya no es una razón para retener.
--
-- Estas columnas dejan EN LA FILA la regla que se aplicó, para que el §4
-- (trazabilidad) se pueda demostrar documento por documento:
--
--   plazo_conservacion_dias     · el plazo APLICADO, en días. NULL cuando la
--                                  categoría no tiene plazo (el contrato sin
--                                  término).
--   plazo_conservacion_fuente   · de dónde salió ese plazo:
--                                    'empresa'          → la tabla de retención
--                                                        documental de la Empresa
--                                                        (la fuente del 8.6(a));
--                                    'tabla_supletoria' → la tabla de
--                                                        conservación de K+AIR,
--                                                        porque la Empresa no
--                                                        declaró uno;
--                                    'piso_legal'       → el mínimo legal de la
--                                                        categoría (los grupos
--                                                        SG-SST del 2.2.4.6.13).
--                                  NULL cuando la categoría no tiene plazo.
--   fecha_inicio_conservacion   · la fecha desde la que CORRIÓ el plazo. Es lo
--                                  que hace auditable el cálculo: sin ella, un
--                                  plazo en días no se puede verificar.
--   categoria_conservacion      · el id de la categoría de la tabla supletoria
--                                  que se aplicó (DOCUMENTO_FIRMADO,
--                                  SST_ESPECIAL, CONTRATO_SIN_TERMINO...).
--
-- LAS COLUMNAS CONGELAN; NO SE RECALCULAN
-- ----------------------------------------
-- Cambiar la tabla supletoria (o el plazo de la Empresa) NO altera las filas ya
-- calculadas: su fecha de conservación, su plazo, su fuente y su fecha de inicio
-- quedan como quedaron. Un recálculo es una operación EXPLICITA, AUTORIZADA y
-- AUDITADA (conservacion.recalcularPlazosDeclarados, que se llama desde
-- empresa.update con actor y motivo) y solo toca las filas que NO tienen fecha:
-- las que quedaron retenidas por el motivo 'plazo_no_declarado'.
--
-- IDEMPOTENCIA
-- ------------
-- El runner (src/db/migrate.js) aplica cada migración en una transacción y
-- tolera el error 'duplicate column name' cuando otro proceso ya la aplicó.
-- Por eso el patrón es el de las 023 y 033: ALTER TABLE ... ADD COLUMN, sin
-- IF NOT EXISTS (SQLite no lo tiene para columnas).
-- ============================================================================

ALTER TABLE gh_firmas_electronicas ADD COLUMN plazo_conservacion_dias INTEGER;
ALTER TABLE gh_firmas_electronicas ADD COLUMN plazo_conservacion_fuente TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN fecha_inicio_conservacion TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN categoria_conservacion TEXT;

CREATE INDEX IF NOT EXISTS idx_firmas_categoria_conservacion
  ON gh_firmas_electronicas(categoria_conservacion);
