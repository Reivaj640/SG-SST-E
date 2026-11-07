-- =============================================================================
-- 059 · LA CONTRAFIRMA DEL ANEXO DE ENCARGO (FASE 2)
-- =============================================================================
--
-- POR QUÉ ESTA MIGRACIÓN
-- ----------------------
-- El Anexo de Encargo es BILATERAL: el §12 tiene dos bloques de firma, el de
-- la Empresa (responsable) y el de Gesstiar S.A.S. (encargado). La fase 1
-- (la 056 y la 058) deja constancia de la SÚCRIPCION de la Empresa. Esta
-- migración deja espacio para el SEGUNDO ACTO: la contrafirma de K+AIR.
--
-- El abogado, el 7-nov-2026, fue explícito: «la empresa no debería empezar a
-- usar el servicio hasta que K+AIR firme la otra parte». Por eso la fase 2
-- escribe `anexo_encargo_firmado_at` en la ficha de la Empresa, y ese campo
-- es el que `verificarHabilitacionFirma` exige para habilitarla. Sin
-- contrafirma, la Empresa NO puede firmar documentos de sus trabajadores.
--
-- QUÉ GUARDA CADA COLUMNA
-- -----------------------
-- En `gh_firma_anexo_encargo_suscripciones`:
--
--   contrafirma_otp_hash ...... El HMAC del código de la contrafirma. Es un
--                                código DISTINTO al de la suscripción, con otro
--                                propósito de derivación: los mismos seis
--                                dígitos no pueden servir para los dos actos.
--   contrafirma_otp_intentos . Los intentos fallidos de ese código.
--   contrafirma_otp_envios ... Cuántos códigos de contrafirma se han pedido.
--   contrafirma_otp_enviado_at . Cuándo salió el último.
--   contrafirma_canal ........ El buzón al que salió el código. NO lo declara
--                                quien llama: es el canal fijo de la
--                                configuración (FIRMA_CANAL_PROTECCION_DATOS),
--                                porque un canal elegido por quien pide la
--                                contrafirma no probaría nada.
--   contrafirma_actor ....... Quién hizo el acto (el operador de K+AIR).
--   contrafirma_motivo ...... Por qué (el X-Admin-Motivo, obligatorio).
--   contrafirma_ip / contrafirma_user_agent . Desde dónde se hizo el acto.
--   contrafirma_acta_hash ... La huella del SEGUNDO acta (la de sus bytes).
--   contrafirma_acta_bytes .. El tamaño de ese acta.
--   contrafirma_acta_archivo . El NOMBRE del archivo (no la ruta del
--                                servidor: la evidencia sale del servidor).
--
-- En `gh_firma_empresas` NO SE TOCA NADA: `anexo_encargo_firmado_at` ya
-- existe (la 017) y lo escribe la contrafirma. La versión y la huella del
-- instrumento no cambian entre los dos actos (es el MISMO texto), así que
-- siguen en `anexo_encargo_suscrito_version` y `anexo_encargo_suscrito_hash`
-- (la 058): la contrafirma no crea un instrumento nuevo, lo ejecuta.
--
-- EL ACTA DE SUSCRIPCIÓN NO SE TOCA
-- ---------------------------------
-- La Empresa ya se llevó esa huella (en la 056 se guardó su hash en la
-- evidencia de la suscripción). La contrafirma NO lo reescribe: genera un
-- SEGUNDO acta, que cita la primera (fecha y huella) y deja por escrito los
-- dos actos. El acta de suscripción queda como el acta de la suscripción.
--
-- COMPATIBILIDAD
-- --------------
-- Son columnas nuevas con valor NULL: las filas que ya existieran (ninguna en
-- producción: la 056 se aplicó el 6-nov y el flujo aún no se ha desplegado)
-- siguen siendo válidas. Un NULL en `contrafirma_otp_hash` significa que no
-- se ha pedido código de contrafirma; un NULL en `contrafirmado_at` que el
-- instrumento todavía no está ejecutado.
-- =============================================================================

ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_otp_hash TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_otp_intentos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_otp_envios INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_otp_enviado_at TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_canal TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_actor TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_motivo TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_ip TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_user_agent TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_acta_hash TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_acta_bytes INTEGER;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN contrafirma_acta_archivo TEXT;
