-- ============================================================================
-- 058 · LOS AJUSTES DEL ABOGADO EN LA SUSCRIPCIÓN DEL ANEXO DE ENCARGO
-- ============================================================================
--
-- POR QUÉ ESTA MIGRACIÓN
-- ----------------------
-- El abogado respondió el 7-nov-2026 las diez preguntas del plan de
-- suscripción digital. Tres de sus ajustes cambian el MODELO DE DATOS de la
-- suscripción, y por eso van en su propia migración:
--
--   1. QUE LA EMPRESA NO SE HABILITE CON LA FASE 1. La fase 1 escribía
--      `gh_firma_empresas.anexo_encargo_firmado_at`, y ese campo dice
--      «firmado» cuando solo firmó una parte. El abogado lo llamó
--      «una inconsistencia semántica que puede convertirse en un problema
--      probatorio: el sistema afirma que el Anexo está firmado, pero el
--      instrumento no está ejecutado». Con esta migración la fase 1 escribe
--      `anexo_encargo_suscrito_at` (que no miente) y la fase 2 —la contrafirma
--      de K+AIR— escribe `anexo_encargo_firmado_at`, que desde ese momento sí
--      es cierto. `verificarHabilitacionFirma` sigue exigiendo la fecha de
--      firma: la Empresa NO queda habilitada para firmar documentos de sus
--      trabajadores hasta que el instrumento esté ejecutado por las dos partes.
--   2. EL SEGUNDO CANAL DEL CÓDIGO. El código de verificación no puede llegar
--      al mismo buzón que el enlace: el artículo 4 del Decreto 2364 exige que
--      los datos de creación de la firma correspondan EXCLUSIVAMENTE al
--      firmante, y un buzón compartido no corresponde a una persona. El canal
--      lo declara K+AIR al abrir la suscripción (lo confirma con la Empresa
--      fuera de banda) y no quien está haciendo clic en el enlace.
--   3. LA VERIFICACIÓN DOCUMENTAL DEL REPRESENTANTE. El flujo probaba control
--      de un buzón, no que quien firmara fuera el representante legal ni que
--      tuviera poder. Ahora la Empresa declara el documento de quien firma y
--      la calidad con la que firma, y K+AIR registra la verificación contra el
--      certificado de la cámara de comercio, el RUT o el poder.
--
-- QUÉ GUARDA CADA COLUMNA
-- -----------------------
-- En `gh_firma_anexo_encargo_suscripciones`:
--
--   canal_codigo .............. El segundo canal (correo), por donde sale el
--                                código de verificación. NUNCA puede ser el
--                                mismo que `correo_firmante`.
--   canal_codigo_tipo .......... 'correo'. El canal por teléfono queda
--                                documentado como no disponible: el servicio
--                                no tiene pasarela de SMS.
--   canal_codigo_confirmacion .. Cómo se confirmó el canal fuera de banda
--                                (llamada al teléfono de la Empresa, correo de
--                                la Empresa al buzón de K+AIR, etc.). Es texto
--                                libre porque el procedimiento lo define la
--                                operación.
--   canal_codigo_confirmado_por Quién lo confirmó por K+AIR.
--   canal_codigo_confirmado_at . Cuándo.
--
--   representante_documento ..... El número de documento de quien firma.
--   representante_calidad ...... 'REPRESENTANTE_LEGAL' | 'DELEGADO'.
--   representante_verificacion . JSON: { tipo_documento, referencia, nota }, con
--                                el tipo de documento contra el que se
--                                verificó ('CERTIFICADO_CAMARA' | 'RUT' |
--                                'PODER') y la referencia de su radicado en el
--                                expediente.
--   representante_verificado_por Quién verificó.
--   representante_verificado_at . Cuándo.
--
--   aceptacion_hash ........... La huella del texto de aceptación que la
--                                Empresa marcó (la cláusula del mecanismo y la
--                                declaración de representación). Es la prueba
--                                de QUÉ palabras aceptó.
--   aceptacion_tratamiento_hash  La huella de la frase informativa de
--                                tratamiento de datos.
--
-- En `gh_firma_empresas`:
--
--   anexo_encargo_suscrito_at .. La fecha de la FASE 1: la Empresa suscribió.
--   anexo_encargo_suscrito_version  La versión del texto que suscribió.
--   anexo_encargo_suscrito_hash  La huella de ese texto.
--   anexo_encargo_suscrito_evidencia  El resumen de la evidencia de la
--                                suscripción.
--
--   `anexo_encargo_firmado_at` NO SE TOCA: sigue siendo la fecha de la
--   ejecución del instrumento, y a partir de ahora la escribe la contrafirma.
--
-- COMPATIBILIDAD
-- --------------
-- Son columnas nuevas con valor NULL: las filas que ya existieran (ninguna en
-- producción: la 056 se aplicó el 6-nov y el flujo aún no se ha desplegado)
-- siguen siendo válidas. La fase 1 pasa a exigir el segundo canal y el
-- documento del representante, así que una suscripción vieja, sin esos datos,
-- no podría completarse: por eso el guard está en el SERVICIO y no en la
-- base.
-- ============================================================================

ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN canal_codigo TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN canal_codigo_tipo TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN canal_codigo_confirmacion TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN canal_codigo_confirmado_por TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN canal_codigo_confirmado_at TEXT;

ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN representante_documento TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN representante_calidad TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN representante_verificacion TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN representante_verificado_por TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN representante_verificado_at TEXT;

ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN aceptacion_hash TEXT;
ALTER TABLE gh_firma_anexo_encargo_suscripciones ADD COLUMN aceptacion_tratamiento_hash TEXT;

ALTER TABLE gh_firma_empresas ADD COLUMN anexo_encargo_suscrito_at TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_encargo_suscrito_version TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_encargo_suscrito_hash TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_encargo_suscrito_evidencia TEXT;
