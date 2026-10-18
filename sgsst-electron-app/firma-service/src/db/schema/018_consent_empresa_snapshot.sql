-- =============================================================================
-- Migración 018: snapshot de la empresa en el consentimiento
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- La migración 017 crea `gh_firma_empresas` con los datos que se leen en la
-- pantalla. Pero esos datos son EDITABLES: si el dominio de una empresa, su
-- representante o su correo cambian, el valor guardado en el consentimiento
-- tiene que seguir siendo el que el firmante vio el día de la firma. Si solo
-- guardáramos el id_empresa, el archivo quedaría apuntando a la fila "de hoy",
-- que es otra cosa.
--
-- DECISIÓN
-- --------
-- Al crear el consentimiento se archiva una COPIA de los datos mostrados
-- (`empresa_snapshot`, JSON canónico) junto con su huella SHA-256
-- (`empresa_hash`). Es el mismo patrón que ya usa el Acuerdo:
-- `hash_texto_acuerdo` es la huella del texto que el firmante aceptó, y el
-- texto completo vive en `gh_firma_acuerdo_versiones`. Aquí el texto completo
-- vive en `gh_firma_empresas` y la copia en el consentimiento.
--
-- POR QUÉ LA HUELLA ES SU PROPIA Y NO LA DEL ACUERDO
-- --------------------------------------------------
-- `hash_texto_acuerdo` es la huella del Acuerdo, que es único y global. Si la
-- identificación de la empresa entrara en ese texto, cada empresa necesitaria
-- su propia versión del Acuerdo. Al mantenerlas separadas:
--   - el `agreement_hash` sigue siendo el del texto global que todos leyeron;
--   - corregir el NIT de una empresa NO invalida ninguna firma previa;
--   - se puede demostrar ante un tercero qué empresa estaba identificada al
--     momento de esa firma concreta, sin depender de cómo está la tabla hoy.
--
-- CANONICALIZACIÓN DEL JSON
-- -------------------------
-- El snapshot se serializa con las claves en el orden fijo que impone
-- `empresa.js` (no con el orden de inserción de un objeto arbitrario). Dos
-- empresas con los mismos datos producen el mismo string y por tanto la misma
-- huella; sin eso la huella no sería reproducible y no serviría como prueba.
--
-- Backfill: ninguno. Los consentimientos anteriores a esta migración quedan
-- con empresa_snapshot = NULL, que significa "no se le mostró identificación
-- de empresa". Es un valor honesto, no un dato perdido: el flujo no existía.
--
-- Tests:
--   - tests/migration-018.test.js: agrega ambas columnas, el snapshot y la
--     huella quedan Null en filas viejas y se leen correctamente en las nuevas.
-- =============================================================================

ALTER TABLE gh_consentimientos_firma
  ADD COLUMN empresa_snapshot TEXT;

ALTER TABLE gh_consentimientos_firma
  ADD COLUMN empresa_hash TEXT;

-- Índice parcial: el hot path de la Constancia busca consentimientos con
-- snapshot para incluir la identificación de la empresa en el documento.
CREATE INDEX IF NOT EXISTS idx_consentimientos_con_empresa
  ON gh_consentimientos_firma(id)
  WHERE empresa_snapshot IS NOT NULL;