-- =============================================================================
-- Migración 045: los anexos que rigen cada firma + la declaración de salud
-- =============================================================================
--
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El numeral 1.5 del Acuerdo de uso promete:
--
--   "La version incorporada del Anexo de Encargo y la del Anexo de Nube son
--    las que constan, con su identificador y huella SHA-256, en el Anexo de
--    Encargo y en la Constancia de cada firma."
--
-- En el codigo NO habia nada de eso: la Constancia no mencionaba ningun anexo
-- (grep de "anexo" en los generadores daba cero coincidencias) y el Anexo de
-- Encargo solo se guardaba como FECHA de firma
-- (gh_firma_empresas.anexo_encargo_firmado_at), sin version y sin huella.
--
-- El texto prometia un control que el codigo no cumplia. Esta migracion deja
-- el dato CONSULTABLE POR FIRMA (no solo impreso en el PDF): cuatro columnas
-- que dicen que version y que huella regian cada firma.
--
-- QUE HAY EN CADA COLUMNA
-- -----------------------
--   anexo_encargo_version / anexo_encargo_hash
--       La version y la huella SHA-256 del TEXTO del Anexo de Encargo que
--       rigio esa firma (las del manifiesto legal). NO son la huella de una
--       copia firmada: la copia firmada por la Empresa tiene otros bytes.
--       La fecha de la firma de la Empresa va aparte, en
--       gh_firma_empresas.anexo_encargo_firmado_at.
--
--   anexo_nube_version / anexo_nube_hash
--       La version y la huella SHA-256 del TEXTO del Anexo de Nube que rigio
--       esa firma. Del Anexo de Nube hoy solo existe el MODELO (sin firmar),
--       asi que estas columnas guardan la version y la huella del modelo; si
--       algun dia hay una version firmada, el manifiesto manda y estas
--       columnas guardan la firmada (el servicio elige, ver
--       services/manifiestoLegal.js).
--
-- LAS COLUMNAS DE LA DECLARACION DE SALUD
-- ---------------------------------------
-- La declaracion de que el documento NO contiene datos sensibles de salud es
-- obligatoria para que la Empresa pueda subir un documento (politica 1 del
-- abogado). Se archiva JUNTO a la solicitud, en la misma fila que guarda la
-- huella del PDF original: eso es lo que hace la declaracion trazable al
-- documento exacto. El evento con el detalle vive en gh_firma_eventos
-- (append-only).
--
--   declaracion_datos_sensibles
--       El valor declarado, tal cual: la constante
--       EL_DOCUMENTO_NO_CONTIENE_DATOS_SENSIBLES_DE_SALUD. NULL cuando la
--       solicitud se creo por una via interna que no exige la declaracion.
--   declaracion_datos_sensibles_at
--       El momento de la declaracion (ISO-8601).
--
-- POR QUE NO LLEVA @skip-when-env test
-- -------------------------------------
-- Esta migracion NO crea triggers: solo son columnas. No hay nada que
-- debilite y nada que chocar con la limpieza entre tests (las limpiezas son
-- DELETE de filas, no de columnas). Aplicarla tambien en el ambiente de test
-- es lo que permite que los tests puedan LEER y ESCRIBIR estas columnas, que
-- es justamente lo que se quiere verificar.
--
-- COMPATIBILIDAD
-- --------------
-- Las columnas quedan en NULL en las filas existentes: no se hace backfill
-- porque el dato historico (que version del anexo rigio cada firma pasada)
-- no existe en ningun lado. Inventarlo seria mentir. La Constancia de esas
-- firmas tampoco lo inventa: sale diciendo que no hay version firmada.
-- =============================================================================

-- 1. Los anexos que rigen la firma (numeral 1.5 del Acuerdo).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN anexo_encargo_version TEXT;

ALTER TABLE gh_firmas_electronicas
  ADD COLUMN anexo_encargo_hash TEXT;

ALTER TABLE gh_firmas_electronicas
  ADD COLUMN anexo_nube_version TEXT;

ALTER TABLE gh_firmas_electronicas
  ADD COLUMN anexo_nube_hash TEXT;

-- 2. La declaracion de que el documento no tiene datos sensibles de salud.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN declaracion_datos_sensibles TEXT;

ALTER TABLE gh_firmas_electronicas
  ADD COLUMN declaracion_datos_sensibles_at TEXT;
