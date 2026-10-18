-- =============================================================================
-- Migración 017: identificación de la empresa que solicita la firma
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- PROBLEMA QUE RESUELVE
-- ---------------------
-- El Acuerdo de uso (capítulo I) habla de "la Empresa" en genérico, pero el
-- firmante nunca podía saber QUIÉN le estaba pidiendo firmar. Hoy el único
-- identificador de empresa que viaja con la solicitud es `id_empresa`, que en
-- la práctica es el NIT: un código, no una identificación legible ni
-- verificable por el trabajador.
--
-- Dónde vive hoy la información: en la cabeza del operador humano. En ninguna
-- tabla. `gh_internal_clients` guarda una fila POR API KEY y NO tiene razón
-- social, domicilio ni representante: una misma empresa puede tener varias
-- claves (rotación, ambientes), así que los datos de la empresa NO pueden
-- vivir ahí sin duplicarse y desincronizarse.
--
-- DECISIÓN DE DISEÑO
-- ------------------
-- Tabla nueva `gh_firma_empresas`, UNA fila por empresa (no por clave).
-- `id_empresa` es la MISMA clave que ya usan `gh_internal_clients.id_empresa`,
-- `gh_consentimientos_firma.id_empresa` y `gh_firmas_electronicas.id_empresa`.
-- No se agrega columna a `gh_internal_clients` justamente para no duplicar.
--
-- POR QUÉ NO VA DENTRO DEL TEXTO DEL ACUERDO
-- ------------------------------------------
-- Si el nombre y el NIT de la empresa entraran en el texto del Acuerdo, cada
-- empresa necesitaría su propia versión del Acuerdo con su propia huella. El
-- Acuerdo es único y global; la identificación de la empresa se muestra en
-- pantalla y se archiva CON SU PROPIA huella (migración 018), sin alterar el
-- texto ni la huella del Acuerdo. Así una corrección de los datos de la
-- empresa no invalida las firmas ya realizadas.
--
-- SOBRE `anexo_encargo_firmado_at`
-- --------------------------------
-- El artículo 25 del Decreto 1377 de 2013 exige el Anexo de Encargo firmado
-- para que K+AIR (operada por el proveedor de la plataforma) trate datos en
-- nombre de la empresa. La columna existe para dejar constancia de cuándo se
-- firmó. OJO: esta migración NO bloquea la creación de sign requests por
-- ausencia del anexo. Ese candado se activa por separado y solo cuando exista
-- el Anexo firmado con cada empresa cliente.
--
-- Backfill: ninguno. Las empresas existentes (Aseplus) se dan de alta por el
-- endpoint admin; hasta entonces `getByEmpresa` devuelve null y la mini-app
-- omite el bloque, que es el comportamiento de hoy.
--
-- Tests:
--   - tests/migration-017.test.js: crea la tabla, es idempotente al re-aplicar
--     el SQL (IF NOT EXISTS) y el registro de migraciones queda con 017.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gh_firma_empresas (
  -- Clave de empresa. MISMO valor que id_empresa en el resto del esquema
  -- (típicamente el NIT). No se renumera ni se cambia después de alta.
  id_empresa TEXT PRIMARY KEY,

  -- Identificación que ve el firmante. Los tres primeros son los mínimos:
  -- razón social y NIT para saber con quién firma; domicilio para saber dónde.
  razon_social TEXT NOT NULL,
  nit TEXT,
  domicilio TEXT,

  -- Quién firma por la empresa (cuándo aplica doble firma, rol_firmante
  -- = 'EMPRESA', ver migración 016).
  representante_legal TEXT,
  representante_legal_identificacion TEXT,

  -- Responsable del tratamiento de los datos de sus trabajadores
  -- (capítulo X del Acuerdo) y canal para recibir sus peticiones.
  responsable_tratamiento TEXT,
  responsable_tratamiento_correo TEXT,
  canal_pqrs TEXT,

  -- Canal de incidentes de seguridad y política de datos publicada.
  canal_incidentes TEXT,
  politica_datos_url TEXT,

  -- Fecha de firma del Anexo de Encargo (art. 25 Decreto 1377 de 2013).
  -- NULL = no firmado todavía. Ver nota del encabezado antes de usar esto
  -- como candado.
  anexo_encargo_firmado_at TEXT,

  -- Empresa dada de baja (soft). Un id_empresa inactivo NO muestra bloque.
  activo INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- Índice por empresa activa: cubre el lookup del hot path (mostrar el bloque
-- en cada firma) y el listado del admin. El WHERE activo = 1 lo mantiene
-- chico conforme se dan de baja clientes.
CREATE INDEX IF NOT EXISTS idx_firma_empresas_activas
  ON gh_firma_empresas(activo);

-- Índice parcial sobre las que ya tienen Anexo firmado: el chequeo futuro de
-- "empresa activable" va a filtrar por esto.
CREATE INDEX IF NOT EXISTS idx_firma_empresas_con_anexo
  ON gh_firma_empresas(id_empresa)
  WHERE anexo_encargo_firmado_at IS NOT NULL;