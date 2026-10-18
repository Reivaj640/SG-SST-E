/**
 * 📦904 · Datos de identificación de la empresa para firma electrónica.
 *
 * Tabla local (kair.db) donde K+AIR guarda lo que la empresa declara como su
 * identificación. Esta información es la que despues viaja al firma-service y
 * se le muestra al trabajador en el bloque "Empresa que solicita tu firma".
 *
 * POR QUÉ UNA TABLA PROPIA Y NO COLUMNAS EN `companies`
 * --------------------------------------------
 * `companies` es la tabla multi-tenant compartida por los 16 módulos de
 * gestión humana. Sus columnas son `company_key` y `display_name`, y las
 * consume todo el sistema. Agregarle NIT, domicilio y canales de contacto
 * sería meter datos de firma en una tabla que no tiene que ver con firma.
 *
 * Además, esta tabla guarda datos con una fecha de revisión distinta a la de
 * la configuración general: la identificación publicada al firmante es
 * evidencia legal y necesita su propio ciclo de vida.
 *
 * RELACIÓN CON EL FIRMA-SERVICE
 * ----------------------------
 * Esta tabla es la fuente en el PC. El firma-service tiene su propia
 * `gh_firma_empresas` (migración 017) que es la fuente autoritativa de lo que
 * se muestra al firmante. Esta tabla NO es la que se lee al firmar: es de
 * donde se toma lo que se manda a sincronizar.
 */
'use strict';

// Una fila por empresa (empresa_id = company_key). La razón social NO se
// duplica acá: se toma de `companies.display_name` al leer. Duplicarla
// permitiría que quedaran dos verdades distintas.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS empresa_datos_firma (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT NOT NULL UNIQUE,          -- company_key (mismo multi-tenant que el resto)

  -- Identificación que ve el firmante.
  nit TEXT,                                  -- NIT de la sociedad
  domicilio TEXT,                            -- domicilio principal
  domicilio_municipio TEXT,
  domicilio_departamento TEXT,

  -- Responsable del tratamiento de los datos de sus trabajadores.
  -- Puede ser la misma persona que el representante legal, pero NO es lo
  -- mismo: el representante legal obliga a la sociedad; el responsable del
  -- tratamiento es quien responde ante el titular. Se guardan por separado.
  responsable_nombre TEXT,
  responsable_cargo TEXT,
  responsable_correo TEXT,

  -- Canales de contacto. Uno solo puede servir para los tres; por eso hay un
  -- campo y dos banderas de "es el mismo".
  canal_contacto TEXT,                       -- correo general de la empresa
  canal_pqrs TEXT,                           -- PQRS (puede ser = canal_contacto)
  canal_incidentes TEXT,                     -- incidentes de seguridad (puede ser = canal_contacto)

  -- Política de tratamiento de datos personales de la EMPRESA (no la de
  -- K+AIR: la empresa es la responsable, K+AIR es la encargada).
  politica_datos_url TEXT,

  -- Snapshot de "cuándo se declaró esto", para saber si hay que revisarlo.
  declarado_en TEXT,
  actualizado_en TEXT
);

CREATE INDEX IF NOT EXISTS idx_empresa_datos_firma ON empresa_datos_firma(empresa_id);
`;

// Sin migraciones: la tabla se crea completa desde el principio. Cuando
// agreguen columnas (por ejemplo el procedimimiento de incidentes), se
// listan acá y se aplican con el patron try/catch de main.js.
const MIGRATIONS_SQL = [];

module.exports = { SCHEMA_SQL, MIGRATIONS_SQL };