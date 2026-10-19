-- =============================================================================
-- Migración 019: algoritmos de hash y seudónimo del trabajador
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El Capítulo III del Acuerdo de uso dice (3.4(d), 3.4(e), 3.6(e)) que el
-- número de documento del firmante y el código OTP "se conservan únicamente
-- en forma de huella digital con sal, y nunca en texto claro".
--
-- La implementación usaba "hash con sal", pero la sal se guardaba EN LA MISMA
-- TABLA que el hash. Eso no protege nada: quien lee la base de datos tiene la
-- sal y el hash, y puede recomputar candidatos. Para un OTP de 6 dígitos
-- (10^6) es instantáneo; para una cédula (10^10) son minutos en una GPU.
--
-- Peor aún: la cédula se guardaba además EN TEXTO CLARO en
-- `id_trabajador` y dentro del JSON de `metadata`, porque K+AIR la envía así
-- (por convención del proyecto, `id_trabajador` ES la cédula).
--
-- DECISIÓN
-- --------
-- 1. Las huellas sensibles pasan a ser HMAC-SHA256 con clave derivada por
--    HKDF de `TOKEN_ENCRYPTION_KEY` (ver src/crypto/hmac.js). La llave vive
--    FUERA de la base de datos: quien lea la base ya no puede recomputar
--    ningún candidato.
-- 2. `id_trabajador` deja de ser la cédula y pasa a ser un SEUDÓNIMO
--    determinístico (HMAC del documento de identidad). El servidor lo calcula
--    al recibir la solicitud, así que el cliente puede seguir mandando la
--    cédula por el canal interno: cambia lo que se ALMACENA, no lo que se
--    transmite, y las búsquedas por `id_trabajador` (que es la llave de
--    unión del sistema) siguen funcionando.
-- 3. Cada fila registra con qué algoritmo se calculó su huella, para poder
--    distinguir las filas nuevas de las heredadas y migrarlas sin adivinar.
--
-- Backfill: ninguno. Las filas viejas quedan con `*_alg = NULL`, que
-- significa "algoritmo heredado". El código las reconoce, las compara con su
-- algoritmo viejo y las REESCRIBE con el nuevo en el momento en que se
-- usan (migración autosuficiente, sin ventana de mantenimiento).
--
-- COMPATIBILIDAD
-- --------------
-- Las filas viejas NO se invalidan: siguen verificando con su algoritmo
-- heredado y se actualizan solas la primera vez que se tocan.
--
-- Tests:
--   - tests/migration-019.test.js: las columnas existen y quedan NULL en
--     filas viejas.
-- =============================================================================

-- Algoritmo con el que se calculó `identificacion_numero_hash`.
-- Valores: 'hmac-sha256' | 'sha256-salt' | 'sha256-plain' | NULL (heredado).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN identificacion_numero_alg TEXT;

-- Algoritmo con el que se calculó `otp_hash` (sign request).
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN otp_alg TEXT;

-- Marca que `id_trabajador` es un seudónimo HMAC y no el documento crudo.
ALTER TABLE gh_firmas_electronicas
  ADD COLUMN id_trabajador_alg TEXT;

-- Algoritmo con el que se calculó `otp_hash` (consentimiento).
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN otp_alg TEXT;

-- Marca que `id_trabajador` es un seudónimo HMAC y no el documento crudo.
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN id_trabajador_alg TEXT;
