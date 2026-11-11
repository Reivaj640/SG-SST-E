-- =============================================================================
-- 060 · LA CONTRAFIRMA DEL ANEXO DE NUBE (FASE 2)
-- =============================================================================
--
-- POR QUE ESTA MIGRACION
-- ----------------------
-- El Anexo de Nube v1.2 es BILATERAL: su parrafo 10 dice que la suscripcion
-- de la Empresa es el PRIMER acto y la contrafirma de K+AIR el SEGUNDO, y que
-- la contrafirma "se documenta con la fecha, el actor, el motivo y la huella
-- SHA-256 del acta de contrafirma".
--
-- El servicio solo registra el PRIMER acto. Sin esta migracion, un manifiesto
-- que dijera "firmado" seria un verde falso: faltaria la mitad del
-- instrumento. Esta migracion deja espacio para el SEGUNDO ACTO, igual que
-- hizo la 059 para el Anexo de Encargo.
--
-- QUE GUARDA CADA COLUMNA
-- -----------------------
-- En `gh_firma_anexo_nube_suscripciones`:
--
--   contrafirmado_at ........... La fecha del segundo acto (ISO 8601).
--   contrafirma_actor .......... Quien hizo el acto en K+AIR (X-Admin-Actor).
--   contrafirma_motivo ......... Por que (X-Admin-Motivo, obligatorio).
--   contrafirma_codigo_enviado_at . Cuando salio el codigo de contrafirma.
--   contrafirma_canal .......... El buzon al que salio ese codigo. NO lo
--                                declara quien pide la contrafirma: es el canal
--                                fijo de la configuracion del servicio
--                                (FIRMA_CANAL_PROTECCION_DATOS), porque un
--                                canal elegido por quien pide el acto no
--                                probaria nada.
--   contrafirma_otp_hash ....... El HMAC del codigo de contrafirma. Es un
--                                codigo DISTINTO al de la suscripcion, con otro
--                                proposito de derivacion: los mismos seis
--                                digitos no pueden servir para los dos actos.
--   contrafirma_otp_intentos ... Los intentos fallidos de ese codigo.
--   contrafirma_otp_envios ..... Cuantos codigos de contrafirma se han pedido.
--   contrafirma_estado ......... El estado del SEGUNDO acto: PENDIENTE,
--                                CODIGO_ENVIADO, BLOQUEADA o CONTRAFIRMADA.
--                                Vive aqui, y no en `estado`, porque `estado`
--                                es el del PRIMER acto (la suscripcion de la
--                                Empresa): si el codigo de la contrafirma se
--                                bloqueara, la suscripcion sigue firmada y el
--                                manifiesto la tiene que seguir viendo.
--   contrafirma_ip / contrafirma_user_agent . Desde donde se hizo el acto.
--   contrafirma_evidencia ....... La evidencia del segundo acto en JSON.
--   contrafirma_acta_hash ...... La huella SHA-256 del ACTA de contrafirma
--                                (la de sus bytes).
--   contrafirma_acta_bytes ..... El tamano de ese acta.
--   contrafirma_acta_archivo ... El NOMBRE del archivo (no la ruta del
--                                servidor: la evidencia sale del servidor).
--
-- En `gh_firma_empresas`:
--
--   anexo_nube_ejecutado_at .... La fecha del SEGUNDO acto: el instrumento
--                                queda EJECUTADO con esta fecha. NO se
--                                reutiliza `anexo_nube_firmado_at`, que es la
--                                del PRIMER acto (la suscripcion). La
--                                contrafirma no crea un instrumento nuevo: lo
--                                ejecuta, asi que la version y la huella del
--                                texto no cambian entre los dos actos.
--
-- EL ACTA DE LA SUSCRIPCION NO SE TOCA
-- ------------------------------------
-- El Anexo de Nube no genera acta en la suscripcion (la Empresa no se lleva
-- ningun PDF: su constancia es la pantalla). El acta de la contrafirma es un
-- documento NUEVO, con su propia huella, y no reescribe nada de lo anterior.
--
-- IDEMPOTENCIA Y APLICACION
-- --------------------------
-- La migracion es ADITIVA: no toca ninguna tabla existente ni reescribe
-- datos. Todas las columnas son nuevas con valor NULL, asi que las filas que
-- ya existieran siguen siendo validas.
--
-- El runner de migraciones (src/db/migrate.js) aplica cada archivo dentro de
-- una transaccion y trata el error "duplicate column name" como exito
-- idempotente (dos procesos pueden correr el runner a la vez). Por eso el
-- archivo no lleva directivas propias: la idempotencia la garantiza el
-- runner, y un fallo real deja la transaccion sin aplicar.
-- =============================================================================

ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirmado_at TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_actor TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_motivo TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_codigo_enviado_at TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_canal TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_otp_hash TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_otp_intentos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_otp_envios INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_estado TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_ip TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_user_agent TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_evidencia TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_acta_hash TEXT;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_acta_bytes INTEGER;
ALTER TABLE gh_firma_anexo_nube_suscripciones ADD COLUMN contrafirma_acta_archivo TEXT;

ALTER TABLE gh_firma_empresas ADD COLUMN anexo_nube_ejecutado_at TEXT;
