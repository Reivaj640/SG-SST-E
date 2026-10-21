-- =============================================================================
-- Migración 027: los documentos con información de salud (numeral 10.8)
-- =============================================================================
--
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- EL PROBLEMA
-- -----------
-- El numeral 10.8 del Acuerdo de uso exige, para los documentos que contengan
-- información relativa a la salud:
--
--   a) informar de manera EXPRESA Y PREVIA de que el dato es sensible, de
--      cuáles son los datos que serán objeto de tratamiento y de la finalidad
--      de éste; y obtener el CONSENTIMIENTO EXPRESO del Titular. Informarle
--      además que, por tratarse de datos sensibles, NO está obligado a
--      autorizar su tratamiento.
--   c) La base legal es la autorización expresa del Titular. Si la Empresa
--      fundara el tratamiento en otra base legal, debe informarlo de forma
--      expresa y anticipada, y esa base debe constar en su política.
--
-- En el código no había nada de esto: el documento se servía igual que
-- cualquier otro, con la misma casilla de aceptación del Acuerdo. Un
-- documento de salud se firmaba con el mismo consentimiento genérico que un
-- formato de asistencia, y nadie había informado al Titular de que su dato era
-- sensible.
--
-- LO QUE HACE ESTA MIGRACIÓN
-- --------------------------
-- 1. Tres columnas en la fila de la firma: si el documento es sensible, qué
--    categorías de dato se tratan y con qué base legal.
--
-- 2. La tabla de la PRUEBA del consentimiento expreso. Sin llave foránea
--    contra la firma, por la misma razón que la prueba de aceptación del
--    Acuerdo (el 12.7): la 5B borra la fila de la firma cuando vence el
--    plazo, pero la prueba de que el Titular autorizó el dato de salud tiene
--    que sobrevivir a esa supresión.
--
-- LA CONSTATACIÓN DEL DATO
-- ------------------------
-- El sistema NO puede saber qué contiene un PDF (puede ser una imagen, y
-- ni siquiera escanearlo en busca de términos sería lícito: eso ya sería
-- tratar el dato sensible ANTES del consentimiento). Por eso la
-- clasificación tiene dos fuentes y el suelo lo pone la segunda:
--
--   - Lo que declara la Empresa (`datos_sensibles`).
--   - Lo que se INFIERE del tipo de documento (services/sensibles.js): los
--     tipos cuya finalidad en un SG-SST ES el dato de salud.
--
-- La Empresa puede subir la clasificación, no bajarla. Es una decisión
-- deliberada: no declarar algo sensible es la forma habitual de que un dato
-- sensible se trate sin base legal.
--
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Las columnas de la fila de la firma
-- -----------------------------------------------------------------------------
-- `datos_sensibles`: 1 si el documento contiene información de salud.
-- `categorias_sensibles`: JSON con las categorías concretas que se tratan
--   (las declara la Empresa; el sistema pone un valor por defecto según el
--   tipo). El 10.8(a) exige informar de "cuáles son los datos", así que
--   esta lista es la que ve el Titular.
-- `finalidad_sensible`: la finalidad del tratamiento, que también es la que
--   ve el Titular.
-- `base_legal_sensible`: 'autorizacion_expresa' (la del 10.8(c), por
--   defecto) u 'otra' (la declara la Empresa).
--
-- `aviso_sensible_texto`, `aviso_sensible_hash` y `aviso_sensible_version`:
-- el aviso EXACTO que se le mostró al Titular, con su huella y su versión.
--
--   Se guarda FIJADO, y no se arma en runtime, por una razón: la prueba del
--   consentimiento tiene que poder demostrar QUÉ se le informó. Si el texto
--   se compusiera en cada visita, un cambio de redacción (o de versión)
--   cambiaría lo que "aceptó" el Titular sin que se note. Fijado, la huella
--   es la del texto que realmente leyó.
ALTER TABLE gh_firmas_electronicas ADD COLUMN datos_sensibles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gh_firmas_electronicas ADD COLUMN categorias_sensibles TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN finalidad_sensible TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN base_legal_sensible TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN aviso_sensible_texto TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN aviso_sensible_hash TEXT;
ALTER TABLE gh_firmas_electronicas ADD COLUMN aviso_sensible_version TEXT;

-- -----------------------------------------------------------------------------
-- 2. La prueba del consentimiento expreso del dato de salud
-- -----------------------------------------------------------------------------
-- Una fila por documento (no por persona): las categorías y la finalidad son
-- de ESE documento, y un mismo trabajador puede firmar documentos con datos
-- sensibles distintos.
--
-- Sin llave foránea contra gh_firmas_electronicas a propósito: la prueba
-- sobrevive a la supresión de la 5B (el mismo criterio que la prueba de
-- aceptación del Acuerdo, que el 12.7 deja en cabeza de la Empresa).
CREATE TABLE IF NOT EXISTS gh_consentimientos_sensibles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- La solicitud a la que pertenece este consentimiento.
  id_solicitud TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  -- El seudónimo del Titular (nunca el documento): el 10.8 no autoriza a
  -- archivar la cédula para poder probar la autorización.
  id_trabajador TEXT NOT NULL,
  -- La versión del texto del aviso que se mostró, y su huella. Sin esto no
  -- se puede probar QUÉ se le dijo al Titular.
  version_aviso TEXT NOT NULL,
  hash_aviso TEXT NOT NULL,
  -- Lo que se le informó: las categorías concretas y la finalidad. Se
  -- guardan porque forman parte de la prueba (el 10.8(a) exige informar de
  -- cuáles son los datos y con qué finalidad).
  categorias TEXT NOT NULL,
  finalidad TEXT NOT NULL,
  -- 'autorizacion_expresa' | 'otra'
  base_legal TEXT NOT NULL,
  -- Si la base legal es 'otra', la descripción que declaró la Empresa. Con
  -- 'autorizacion_expresa' queda en NULL.
  base_legal_descripcion TEXT,
  -- 1 si el Titular otorgo la autorización; 0 si no (o si la base legal no
  -- era la autorización expresa, en cuyo caso no hay nada que otorgar).
  manifestacion_aceptada INTEGER NOT NULL DEFAULT 0,
  fecha_manifestacion TEXT NOT NULL,
  fecha_aceptacion TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Una prueba por solicitud: la segunda no puede pisar la primera (la
-- aceptación es un hecho, no un estado que se reescriba).
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_sensible_solicitud
  ON gh_consentimientos_sensibles(id_solicitud);

CREATE INDEX IF NOT EXISTS idx_consent_sensible_empresa_trabajador
  ON gh_consentimientos_sensibles(id_empresa, id_trabajador);
