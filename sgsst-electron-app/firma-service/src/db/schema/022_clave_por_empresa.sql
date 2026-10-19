-- =============================================================================
-- Migración 022: huella con ámbito de empresa y versión de llave
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- Dos cosas, que conviene separar porque tienen consecuencias distintas.
--
-- (1) ÁMBITO POR EMPRESA
--
--     Las huellas persistentes (identificación, seudónimo del trabajador,
--     correo) se derivaban con UNA sola llave para todo el servicio. Con
--     esa llave, la misma cédula produce la misma huella en TODAS las
--     empresas: quien lea la base de datos (o quien reciba dos constancias
--     de empresas distintas) puede enlazar "es la misma persona" sin
--     conocer el número de documento.
--
--     Con el ámbito, la derivación incluye el `id_empresa`: la huella se
--     calcula con la info
--
--         kair-firma/v2/<versión de llave>/<id_empresa>/<propósito>
--
--     y el mismo documento en dos empresas produce dos huellas distintas, sin
--     ningún vínculo entre ellas.
--
--     OJO: el ÁMBITO NO FILTRA LAS BÚSQUEDAS. Las consultas siempre filtran
--     también por `id_empresa`; el ámbito rompe el enlace, no la búsqueda.
--
-- (2) VERSIÓN DE LLAVE Y ANILLO DE LLAVES
--
--     Con una sola llave, en el momento en que la llave rota, el 100% de
--     las firmas anteriores queda sin poder verificarse. Eso es peor que el
--     enlace entre empresas que la rotación iba a resolver.
--
--     A partir de ahora cada fila registra la VERSIÓN con la que se calculó
--     su huella, en su columna `*_alg` (con el formato
--     `hmac-sha256.v2.k1`). Al verificar se prueba esa versión y, si no
--     coincide, las demás del anillo (ver src/crypto/keys.js). La versión
--     vieja se conserva mientras viva la evidencia que la usó, que es el
--     plazo de conservación del Capítulo VIII.
--
--     Esto hace que la rotación de llaves deje de ser una operación que
--     invalida la evidencia: pasa a ser una operación normal.
--
-- COLUMNAS NUEVAS
-- ---------------
-- `correo_alg` en las dos tablas: el hash del correo es una huella
-- persistente más, y necesita decir con qué se calculó, igual que las
-- demás. Antes no hacía falta: la columna `correo_hash` se añadió con el
-- HMAC y todas sus filas eran del mismo formato.
--
-- Backfill: ninguno. Las filas viejas tienen `*_alg = NULL`, que significa
-- "algoritmo heredado": siguen verificando con su algoritmo viejo y se
-- REESCRIBEN con el vigente la primera vez que se usan (migración
-- autosuficiente, sin ventana de mantenimiento).
-- =============================================================================

-- Algoritmo con el que se calculó `correo_hash` (consentimiento).
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN correo_alg TEXT;

-- Algoritmo con el que se calculó `correo_hash` (sign request).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN correo_alg TEXT;

-- Algoritmo con el que se calculó `identificacion_aceptante` (consentimiento
-- del representante legal).
--
-- Este campo guardaba el NÚMERO DE DOCUMENTO DEL REPRESENTANTE EN TEXTO
-- CLARO. Es el mismo problema que se corrigió para el trabajador en la
-- migración 019 (la cédula del firmante), y la misma razón: la base de datos
-- del encargado no debe guardar el documento de identidad de nadie en claro.
--
-- A partir de aquí guarda el SEUDÓNIMO del representante (con el marcador
-- `psn1_`), derivado con el ámbito de la empresa. El número en claro sigue
-- viviendo donde DEBE vivir: en el snapshot de la empresa (numeral 1.2 del
-- Acuerdo), que es el bloque «Empresa que solicita tu firma» y es dato
-- público del registro mercantil.
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN identificacion_aceptante_alg TEXT;
