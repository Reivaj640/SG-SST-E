-- =============================================================================
-- Migración 023: fecha de conservación, deber legal de conservación y plazo
--                declarado por la Empresa
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El numeral 8.6 del Acuerdo de uso dice:
--
--   "El plazo de conservación de los registros del proceso de firma se
--    determina por la tabla de retención documental de la Empresa [...] Este
--    Acuerdo no fija un plazo propio porque la ley no lo fija. [...] Vencido
--    ese plazo y sin que exista un deber legal o contractual de conservación,
--    el dato se suprime."
--
-- Y el 10.6 lo repite por categoría de dato.
--
-- O sea: la supresión tiene DOS condiciones, no una.
--
--   1. El plazo venció. Y el plazo NO lo fija K+AIR: lo declara la Empresa,
--      que es la Responsable del tratamiento. K+AIR es el Encargado.
--   2. No existe un deber legal o contractual de conservación.
--
-- La migración 021 ya dejó el plazo en texto libre (`plazo_retencion`), que
-- es lo que se MUESTRA al firmante: la tabla de retención de la Empresa puede
-- fijar plazos distintos por categoría de dato (hojas de vida, contrataciones,
-- accidentes) y K+AIR no puede representarlos con un entero.
--
-- Pero para SUPIMIR hace falta un plazo computable. De ahí el campo aparte
-- `plazo_retencion_dias`: es el plazo que la Empresa declara para los
-- registros del proceso de firma, en días. Si no lo declara, no hay fecha de
-- conservación y no hay purga: el sistema no inventa plazos (el 8.6 dice que
-- el Acuerdo no los fija porque la ley no los fija).
--
-- `fecha_conservacion` se calcula una vez, al crear la firma:
--
--     fecha_conservacion = fecha_creacion + plazo_retencion_dias
--
-- Es el plazo que CORRESPONDÍA al firmante cuando firmó, no el que la
-- Empresa declare después. Si la Empresa cambia su política de retención, las
-- firmas ya hechas no se mueven: la fecha queda congelada.
--
-- EL DEBER LEGAL DE CONSERVACIÓN (el hold)
-- ----------------------------------------
-- La segunda condición del 8.6 no es teórica. Es la forma operativa de:
-- una reclamación, un proceso judicial, una investigación administrativa, un
-- requerimiento de la SIC, la UGPP, el Ministerio de Trabajo o una ARL, o
-- una auditoría. Mientras exista, los datos NO se suprimen: se conservan.
--
-- El hold se declara con QUIÉN (actor), POR QUÉ (motivo), sobre QUÉ
-- (alcance: la materia, el expediente, la autoridad), DESDE CUÁNDO (fecha) y
-- se LIBERA con su propio actor y motivo. El estado vigente vive en la fila
-- de la firma (`hold_legal`), que es lo que lee el trigger de la migración
-- 020: la base de datos se niega a suprimir una firma con hold activo, aunque
-- haya ventana y lote. El historial queda en `gh_firma_holds`.
--
-- VALORES NULL / 0
-- ----------------
--   fecha_conservacion NULL = la Empresa no declaró plazo. No hay purga.
--   hold_legal = 0          = no hay deber legal de conservación.
--   motivo_hold NULL        = sin hold, o con hold sin motivo escrito.
-- =============================================================================

-- Fecha en la que el dato de esta firma vence su plazo de conservación.
-- NULL = la Empresa no declaró plazo, o la firma es anterior a esta
-- migración (y por tanto no tiene plazo computado).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN fecha_conservacion TEXT;

-- 1 = existe un deber legal o contractual de conservación: la fila no se
-- suprime aunque su plazo haya vencido. Lo lee el trigger de la 020.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN hold_legal INTEGER NOT NULL DEFAULT 0;

-- Por qué existe el deber legal de conservación.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN motivo_hold TEXT;

-- Quién declaró el hold.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN hold_actor TEXT;

-- Sobre qué aplica: la materia, el expediente, la autoridad.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN hold_alcance TEXT;

-- Desde cuándo aplica el hold.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN hold_fecha TEXT;

-- Historial de holds: cada declaración y cada liberación quedan escritas.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN hold_liberado_at TEXT;

-- Plazo de conservación que la Empresa declara para los registros del proceso
-- de firma, en días. Es el dato computable que usa el 8.6; el texto libre
-- `plazo_retencion` (migración 021) es el que se le muestra al firmante.
-- NULL = la Empresa no declaró plazo: no hay fecha de conservación y no hay
-- purga. La empresa es la Responsable y declara; K+AIR solo transporta.
ALTER TABLE gh_firma_empresas
  ADD COLUMN plazo_retencion_dias INTEGER;

-- -----------------------------------------------------------------------------
-- Historial de declares de deber legal de conservación.
--
-- Una fila por declaración y una por cada liberación. La fila de la firma
-- guarda el estado vigente (lo que lee el trigger); esta tabla guarda el
-- recorrido: quién, por qué, desde cuándo y hasta cuándo.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_holds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  alcance TEXT,
  declarado_at TEXT NOT NULL DEFAULT (datetime('now')),
  liberado_at TEXT,
  liberado_por TEXT,
  motivo_liberacion TEXT,
  activo INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_firma_holds_firma
  ON gh_firma_holds(firma_id);

-- Índice del reporte de vencimientos: por fecha de conservación.
CREATE INDEX IF NOT EXISTS idx_firmas_fecha_conservacion
  ON gh_firmas_electronicas(fecha_conservacion);
