-- =============================================================================
-- Migración 007: tipo_identificacion en sign requests (Bloque integración v1, D-1 + A1/A2)
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- Cambios:
--   1. Agrega columna tipo_identificacion TEXT a gh_firmas_electronicas.
--      Es la categoría legal/administrativa del documento que se firma.
--      Valores permitidos (validados en service + zod — ver
--      src/schemas/index.js y src/services/signRequest.js#TIPOS_IDENTIFICACION):
--        CONTRATO, OTROSI, ACTA, CONSENTIMIENTO, AUTORIZACION,
--        REGLAMENTO, POLITICA, CERTIFICADO, FORMATO, OTRO.
--
--      Es DISTINTA de la columna identificacion_tipo (que almacena el tipo
--      de documento de IDENTIFICACIÓN del firmante: CC, CE, TI, PPT, PA).
--      Esta nueva columna es sobre el documento que se está FIRMANDO, no
--      sobre cómo se identifica al firmante.
--
--      Decisión D-1 (aprobada): la palabra `tipo_documento` se reemplaza
--      por `tipo_identificacion` en todo el código y esquema. Esta
--      migration aplica esa decisión a la nueva columna del sign request.
--      El parámetro HTTP `tipo_documento` en POST /api/sign/:token/identify
--      también se renombra a `tipo_identificacion` (tarea I-002 / I-005,
--      fuera de esta migration).
--
--   2. Por qué NO se incluye validación a nivel SQL (ni constraint ni dominio):
--      - Consistencia con agreement_version, consent_id e id_constancia
--        (ninguna tiene validación a nivel SQL en este proyecto).
--      - Evitar la complejidad del patrón 12-step usado en 005_reduce_check
--        (que requiere FK=OFF y recreate table).
--      - El service es la única puerta de entrada para INSERTs; zod valida
--        en la frontera HTTP. No hay scripts que inserten directamente.
--
--   3. Índices (cubren las queries Q1-Q4 de A2):
--      - idx_firmas_tipo_identificacion: simple, para reportes globales
--        por tipo (e.g. "todos los CONTRATOS firmados en un rango").
--      - idx_firmas_empresa_tipo_estado: compuesto (id_empresa, tipo_identificacion,
--        estado, fecha_creacion DESC). Cubre la query principal del panel
--        K+AIR ("firmas pendientes por empresa + tipo + estado"). Decisión
--        A2 sobre A1: compuesto > parcial WHERE IS NOT NULL.
--
--   4. Backfill: NINGUNO. Los sign requests existentes (legacy pre-007)
--      quedan con tipo_identificacion = NULL. Las queries deben tratar NULL
--      como bucket separado (los legacy son "no clasificados").
--
--   5. K+AIR (cliente) debe:
--      - Enviar tipo_identificacion en POST /internal/sign-requests (opcional en v1)
--      - Enviar opcionalmente subtipo_identificacion dentro de metadata
--        (string libre; p.ej. 'autorizacion_datos', 'contrato', etc.)
--      - Migración gradual: si K+AIR aún no tiene el dato, puede omitirlo
--        (es opcional a nivel zod)
--
-- Tests:
--   - tests/migration-007.test.js:
--     * El archivo 007_tipo_identificacion.sql existe y contiene el ALTER + 2 índices
--     * La migración aplica sin romper sign requests legacy (sin tipo_identificacion)
--     * La columna tipo_identificacion es TEXT nullable
--     * Los 2 índices existen (verificación con PRAGMA index_list / index_info)
--     * Registry: gh_firma_schema_migrations tiene fila para 007
--     * Re-aplicar migrate() no duplica la fila en el registry (C-21)
-- =============================================================================

-- 1. Nueva columna en sign requests (nullable, sin validación a nivel SQL)
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN tipo_identificacion TEXT;

-- 2. Índice simple sobre tipo_identificacion
--    Cubre queries de reporte global por tipo (A2 §3.2 Q2).
CREATE INDEX IF NOT EXISTS idx_firmas_tipo_identificacion
  ON gh_firmas_electronicas(tipo_identificacion);

-- 3. Índice compuesto (id_empresa, tipo_identificacion, estado, fecha_creacion DESC)
--    Cubre la query principal del panel K+AIR (A2 §3.2 Q1): "firmas
--    pendientes por empresa + tipo + estado ordenadas por fecha".
--    El orden de columnas sigue la selectividad esperada: id_empresa (alta),
--    tipo_identificacion (media), estado (media), fecha_creacion (orden).
CREATE INDEX IF NOT EXISTS idx_firmas_empresa_tipo_estado
  ON gh_firmas_electronicas(id_empresa, tipo_identificacion, estado, fecha_creacion DESC);
