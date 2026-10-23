-- =============================================================================
-- 040 · LA LÁPIDA IDENTIFICA LA SOLICITUD Y EL FUNDAMENTO DEL PLAZO
-- =============================================================================
--
-- EL 3.6(g) DEL ACUERDO DE USO
-- ---------------------------
-- "La supresión dentro de la ventana de purga del 8.6 no es alteración: da
--  lugar a una lápida que identifica la solicitud, la fecha y hora, las
--  categorías suprimidas y el fundamento del plazo, y a un recibo que la
--  Empresa entrega al Trabajador si lo solicita."
--
-- (Y el 10.6: "La supresión del documento, la Constancia y los registros de
-- auditoría deja la lápida y el recibo del 3.6(g) y 10.5(d)".)
--
-- QUÉ LE FALTABA A LA LÁPIDA
-- --------------------------
-- La lápida (`gh_firma_purgadas`, migración 024) guardaba `firma_id` (un
-- entero interno), `id_empresa`, la fecha, el actor, el motivo y las
-- categorías. Le faltaban DOS de las cuatro cosas que el texto exige:
--
--   1. "identifica la solicitud". Guardaba el ID INTERNO de la fila, no el
--      identificador de la solicitud (SIGN-YYYY-NNNNNN), que es lo que el
--      Trabajador y la Empresa conocen. Y como la fila de la firma se borra
--      entera en la supresión, ese dato no se podía recuperar después: una
--      vez suprimida, la lápida NO decía a qué solicitud pertenecía.
--   2. "el fundamento del plazo". Guardaba el MOTIVO declarado por quien
--      suprimió, pero no la FECHA DE CONSERVACIÓN que venció: el dato que
--      sustenta por qué se podía suprimir.
--
-- Sin esas dos columnas, el recibo que el 3.6(g) obliga a entregar a la
-- Empresa no se puede armar: no hay forma de decir "esta es la solicitud
-- SIGN-2026-020330, se conservó hasta el 2026-10-23 y por eso se suprimió".
--
-- POR QUÉ SE AGREGAN Y NO SE REESCRIBEN
-- --------------------------------------
-- La lápida es APPEND-ONLY (la migración 025 pone los triggers de no-update
-- y no-delete). Agregar columnas es una operación de ESQUEMA, no de datos:
-- no reescribe filas ni dispara los triggers. Las lápidas ya escritas
-- (pocas: en producción hay 0 hasta la fecha) quedan con estas columnas en
-- NULL, y el endpoint de entrega lo dice explícito en vez de inventar un
-- valor.
--
-- `id_solicitud` NO es un dato personal: es el identificador de la
-- solicitud (como "SIGN-2026-020330"), el mismo que ya vive en la fila de
-- la firma, en el consentimiento (la 024 lo agregó ahí) y en el PDF.
--
-- `fecha_conservacion` es la fecha hasta la que el dato estaba obligado a
-- conservarse: el FUNDAMENTO del plazo. No es la fecha de la supresión (esa
-- ya está en `purgado_at`).
--
-- La 020 (que trae `gh_firma_purga_registro`) lleva `@skip-when-env test`,
-- así que en el ambiente de test esa tabla se crea a mano en
-- tests/helpers.js. Por eso esta migración SOLO altera `gh_firma_purgadas`,
-- que la 024 crea siempre y sin directiva de ambiente: así el ALTER
-- encuentra la tabla exista en los dos ambientes.
-- =============================================================================

ALTER TABLE gh_firma_purgadas
  ADD COLUMN id_solicitud TEXT;

ALTER TABLE gh_firma_purgadas
  ADD COLUMN fecha_conservacion TEXT;

CREATE INDEX IF NOT EXISTS idx_firma_purgadas_solicitud
  ON gh_firma_purgadas(id_solicitud);
