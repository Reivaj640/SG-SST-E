-- @skip-when-env test
-- =============================================================================
-- Migración 041: el recibo de purgas identifica la solicitud y el fundamento
--                del plazo
-- =============================================================================
--
-- PROBLEMA QUE RESUELVE
-- ----------------------
-- El 3.6(g) del Acuerdo de uso:
--
--   "La supresión dentro de la ventana de purga del 8.6 no es alteración: da
--    lugar a una lápida que identifica la solicitud, la fecha y hora, las
--    categorías suprimidas y el fundamento del plazo, y a un recibo que la
--    Empresa entrega al Trabajador si lo solicita."
--
-- Y el 10.5(d):
--
--   "Los registros de auditoría no se alteran. Su supresión en la ventana de
--    purga deja la lápida y el recibo del 3.6(g) y no afecta la prueba de
--    aceptación del 12.7."
--
-- O sea: la supresión del REGISTRO DE AUDITORÍA también tiene que dejar un
-- recibo que identifique la solicitud y el fundamento del plazo.
--
-- El recibo de purgas (`gh_firma_purga_registro`, migración 020) guardaba la
-- firma, la empresa, la fecha, el actor, el motivo, la ventana, las categorías
-- y el hold. NO guardaba el identificador de la solicitud ni la fecha de
-- conservación. Sin esas dos columnas, el recibo de la capa de auditoría no
-- podía decir a qué solicitud pertenecía ni hasta cuándo estaba obligada a
-- conservarse: las dos cosas que el 3.6(g) exige.
--
-- La lápida (`gh_firma_purgadas`) sí las tiene desde la migración 040, pero la
-- lápida es de la capa de DATOS: cuando solo se purga el registro de auditoría
-- (el documento y la constancia siguen ahí, con su deber de conservación), no
-- hay lápida y el recibo se queda sin identificar.
--
-- LA DECISIÓN DE NO ESCRIBIR EN `gh_firma_purgadas` DESDE LA CAPA DE AUDITORÍA
-- --------------------------------------------------------------------------
-- Es tentador meter ahí una fila de "lápida" por cada purga de auditoría. No
-- se hace, por una razón concreta: `gh_firma_purgadas` NO es solo el archivo
-- de la evidencia, es el mecanismo del 410. `supresion.buscarLapidada()`
-- busca por `token_tombstone` y, si encuentra la fila, el enlace responde
-- "no disponible por vencimiento del plazo". Si la capa de auditoría escribiera
-- ahí, una fila que no es una lápida de tokens podría hacer que un enlace
-- que SIGUE VIVO respondiera 410. Mezclar el archivo de la evidencia con el
-- mecanismo del 410 es la clase de error que después nadie sabe explicar.
--
-- La solución es la de esta migración: las dos piezas de la evidencia
-- guardan las dos columnas, y el servicio de recibos (reciboSupresion.js)
-- arma el recibo con la que esté.
--
-- POR QUÉ SE APLICA SOLO FUERA DE LOS TESTS
-- -------------------------------------------
-- La tabla `gh_firma_purga_registro` la crea la migración 020, que lleva
-- `@skip-when-env test`: en el ambiente de test esa tabla se crea a mano en
-- tests/helpers.js. Si esta migración corriera en el ambiente de test, el
-- ALTER no encontraría la tabla (todavía no existiría) y la migración
-- reventaría. Por eso esta también lleva la directiva, y el ambiente de test
-- agrega las columnas a mano, en el mismo helpers.js.
--
-- La garantía NO se debilita: en producción (NODE_ENV distinto de test) las
-- columnas quedan fijadas y el runner registra la migración.
--
-- LAS COLUMNAS NO SON DATOS PERSONALES
-- -------------------------------------
-- `id_solicitud` es el identificador de la solicitud (como "SIGN-2026-020330"),
-- el mismo que ya vive en la fila de la firma, en el consentimiento (la 024 lo
-- agregó ahí) y en el PDF. `fecha_conservacion` es la fecha hasta la que el
-- dato estaba obligado a conservarse: el fundamento del plazo, no la fecha de
-- la supresión (esa ya está en `purgado_at`).
--
-- Las lápidas y los recibos ya escritos quedan con estas columnas en NULL, y
-- el endpoint de entrega lo dice explícito en vez de inventar un valor.
-- =============================================================================

ALTER TABLE gh_firma_purga_registro
  ADD COLUMN id_solicitud TEXT;

ALTER TABLE gh_firma_purga_registro
  ADD COLUMN fecha_conservacion TEXT;

CREATE INDEX IF NOT EXISTS idx_purga_registro_solicitud
  ON gh_firma_purga_registro(id_solicitud);
