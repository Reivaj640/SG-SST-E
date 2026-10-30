-- =============================================================================
-- Migración 047: la VÍA DE SUPRESIÓN DE LA PRUEBA DE ACEPTACIÓN (numeral 12.7)
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- EL PROBLEMA QUE RESUELVE
-- -------------------------
-- El numeral 12.7 del Acuerdo v1.2 dice:
--
--   "Esta prueba subsiste a la supresión de los demás registros del 8.6 y se
--    sujeta al plazo de conservación que la Empresa declare para ella; mientras
--    ese plazo no esté declarado, la prueba no se suprime y queda retenida por
--    esa razón, conforme al 8.6(h)."
--
-- El CÓDIGO no tenía esa vía: la lápida (`gh_firma_purgadas`) y el recibo
-- (`gh_firma_purga_registro`) se escriben SOLO al purgar la firma. La prueba de
-- la aceptación vive en `gh_consentimientos_firma`, que no tiene llave foránea
-- contra la firma: sobrevive a la supresión del 8.6, pero no había forma de
-- registrar SU supresión, con el plazo declarado, su fundamento y el punto de
-- inicio desde el que corre.
--
-- QUÉ CREA
-- --------
--   1. `gh_firma_prueba_supresion`: la SOLICITUD de supresión de la prueba de
--      aceptación. Una fila por solicitud (UNIQUE), con el plazo declarado, su
--      fundamento, el punto de inicio, la fecha de conservación que resulta de
--      los dos y el ESTADO de la vía.
--
--   2. `gh_firma_prueba_lapida`: la LÁPIDA de esa vía. Es un HECHO: se escribe
--      una vez, cuando la supresión se ejecuta, y no se reescribe.
--
--   3. `gh_firma_prueba_recibo`: el RECIBO que la Empresa entrega al
--      Trabajador (el 3.6(g) y el 10.5(d)). También de una sola escritura.
--
-- POR QUÉ TRES TABLAS Y NO UNA
-- -----------------------------
-- La solicitud es un registro VIVO: su estado cambia (de 'SOLICITADA' a
-- 'SUPRIMIDA' cuando vence el plazo declarado). La lápida y el recibo son
-- HECHOS: se escriben una vez y no se tocan. Meter las tres cosas en una tabla
-- obligaría a que un hecho se reescribiera, y el 3.6(g) pide que el rastro de
-- la supresión no se altere.
--
-- LO QUE NO SE INVENTA
-- ---------------------
-- El plazo declarado, su fundamento y su punto de inicio los DECLARA la
-- Empresa (el 8.6(a) y el 8.6(h)); esta migración no los calcula. La fecha de
-- conservación es la suma del punto de inicio y el plazo declarado, y nada
-- más: si falta cualquiera de los dos, la vía no se puede abrir.
--
-- IDEMPOTENCIA
-- ------------
-- `id_solicitud` es UNIQUE en las tres tablas: la vía no puede duplicar ni la
-- solicitud, ni la lápida, ni el recibo.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 1. La SOLICITUD de supresión de la prueba de aceptación (el 12.7)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_prueba_supresion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_empresa TEXT NOT NULL,
  consent_id INTEGER,
  categoria TEXT NOT NULL DEFAULT 'prueba_aceptacion',
  -- El PLAZO DECLARADO por la Empresa, en días. No es NULL: un plazo sin
  -- declarar no abre la vía (el 8.6(h) ordena retener, no suprimir).
  plazo_declarado_dias INTEGER NOT NULL,
  -- El FUNDAMENTO del plazo: por qué se conserva ese tiempo (el 8.6(h) no
  -- admite un plazo sin fundamento).
  fundamento_plazo TEXT NOT NULL,
  -- El PUNTO DE INICIO desde el que corre el plazo (el 8.6(h) no admite un
  -- plazo sin punto de inicio identificable).
  punto_inicio TEXT NOT NULL,
  -- La fecha de conservación que resulta de los dos anteriores.
  fecha_conservacion TEXT NOT NULL,
  -- 'SOLICITADA' (registrada, el plazo declarado aún no vence) o 'SUPRIMIDA'
  -- (la supresión se ejecutó: hay lápida y recibo).
  estado TEXT NOT NULL DEFAULT 'SOLICITADA',
  -- 1 cuando se comprobó que no había hold vigente antes de suprimir.
  hold_verificado INTEGER NOT NULL DEFAULT 0,
  solicitado_at TEXT NOT NULL DEFAULT (datetime('now')),
  suprimido_at TEXT,
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prueba_supresion_empresa
  ON gh_firma_prueba_supresion(id_empresa, solicitado_at DESC);

-- -----------------------------------------------------------------------------
-- 2. La LÁPIDA de la vía (hecho, no se reescribe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_prueba_lapida (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_empresa TEXT NOT NULL,
  consent_id INTEGER,
  categorias TEXT,
  suprimido_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  -- El 3.6(g): la lápida identifica la solicitud, la fecha y hora, las
  -- categorías suprimidas y el fundamento del plazo.
  fecha_conservacion TEXT NOT NULL,
  fundamento_plazo TEXT NOT NULL,
  punto_inicio TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 3. El RECIBO de la vía (hecho, no se reescribe)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_prueba_recibo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_empresa TEXT NOT NULL,
  emitido_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  motivo TEXT NOT NULL,
  categorias TEXT,
  fecha_conservacion TEXT NOT NULL,
  fundamento_plazo TEXT NOT NULL,
  punto_inicio TEXT NOT NULL,
  hold_verificado INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prueba_recibo_empresa
  ON gh_firma_prueba_recibo(id_empresa, emitido_at DESC);
