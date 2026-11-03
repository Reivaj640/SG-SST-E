-- C-2 (A1 9.2) y J3 (A1 5.6): lo que el REGISTRO DE ACEPTACION consigna.
--
-- La aceptacion del Trabajador quedaba ligada solo a la huella del Acuerdo,
-- pero el ordinal 3 de la Manifestacion de Voluntad delega en la matriz del
-- Anexo de Encargo la definicion de que finalidades se fundan en su
-- autorizacion: el Titular aceptaba sobre una matriz que no aceptaba ni veia.
--
-- Por eso, en el MISMO ACTO de aceptacion, la fila del consentimiento ahora
-- consigna:
--   - la version y la huella SHA-256 del Anexo de Encargo que rigen esa firma
--     para esa Empresa (y si la Empresa lo firmó, y cuando);
--   - la version y la huella SHA-256 del Anexo de Nube que rigen esa firma
--     para esa Empresa (la FIRMADA; si no hay, se registra la ausencia y de
--     donde sale lo que hay);
--   - la version y la huella de la MATRIZ DE FINALIDADES que se le puso a
--     disposicion al Firmante antes de habilitar la casilla;
--   - el MEDIO concreto por el que se le pusieron a disposicion las politicas
--     de seguridad, y la FECHA de esa puesta a disposicion (que no puede ser
--     posterior a la fecha de aceptacion).
--
-- La fecha de puesta a disposicion la pone el SERVIDOR, no el navegador: es
-- el momento en que el servidor sirvio el texto al Firmante. Por eso vive en
-- la fila de la solicitud (que es la que se sirve) y la copia aceptada queda
-- en el consentimiento.

-- En la SOLICITUD: la fecha en que el servidor puso las politicas a
-- disposicion (la del servidor) y la matriz que se sirvio en ese momento
-- (la que el Firmante vio: no la que despues se edite en el archivo).
ALTER TABLE gh_firmas_electronicas ADD COLUMN fecha_disposicion_politicas TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN matriz_version_disponible TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN matriz_hash_disponible TEXT;

-- En el CONSENTIMIENTO: lo que el registro de aceptacion consigna.
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_encargo_version TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_encargo_hash TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_encargo_firmado_at TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_nube_version TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_nube_hash TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_nube_origen TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN anexo_nube_firmado_at TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN matriz_version TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN matriz_hash TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN medio_disposicion TEXT;
ALTER TABLE gh_consentimientos_firma ADD COLUMN fecha_disposicion TEXT;
