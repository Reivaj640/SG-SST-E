-- =============================================================================
-- Migración 032: la 9A — medios autorizados y firma autográfica
-- =============================================================================
-- ESTA MIGRACIÓN ES ADITIVA (no breaking para datos existentes). Crea DOS
-- tablas nuevas. No altera ni borra nada de lo que ya existe.
--
-- QUÉ RESUELVE (la 9A del plan de cierre)
-- ---------------------------------------
-- El Capítulo VII (7.1-7.3) y el Capítulo VIII (8.1-8.7) del Acuerdo de uso
-- prometen cuatro cosas que hoy no existen en el sistema:
--
--   (1) Los MEDIOS AUTORIZADOS por el Trabajador (el 8.2 y el párrafo 2 del
--       2.2.1.1.12 del Decreto 1072 de 2015): el registro de a qué medios
--       electrónicos autoriza el Trabajador que le sea entregada la copia, y
--       la vía por la que los modifica "en cualquier momento y sin costo
--       alguno".
--
--   (2) La FIRMA AUTOGRÁFICA (el 7.2): el derecho del Trabajador a que la
--       Empresa le provea la firma de forma autográfica, sobre soporte papel,
--       "en todo momento y sin costo alguno". Y el 7.3: la imposibilidad de
--       firmar electrónicamente NO puede ser una barrera de acceso al empleo.
--       Esta es la vía que hace posible encender el rechazo del D-02 (el
--       2.2.1.1.11): sin salida en papel, exigir un medio personal sería una
--       barrera de acceso al empleo.
--
--   (3) La COPIA PERMANENTE (el 8.3 y el 8.5).
--
--   (4) El SUMINISTRO A AUTORIDADES (el 8.4).
--
-- Las piezas (3) y (4) no necesitan tabla propia: la (3) se sirve con el
-- canal de solicitudes del titular que ya existe (10.7(b)) más la descarga
-- interna del documento firmado, y la (4) se registra con el evento de
-- auditoría. Lo que SÍ necesita tabla propia es lo que es un REGISTRO con
-- historia: los medios autorizados y la firma autográfica.
--
-- POR QUÉ DOS TABLAS Y NO UNA
-- ----------------------------
-- - Los medios autorizados son un dato DEL TRABAJADOR (modificable por él).
-- - La firma autográfica es un ACTO (un evento en el tiempo), no un atributo.
--
-- Mezclarlas en la fila de la firma haría que una modificación del Trabajador
-- pareciera una firma, y que una firma pareciera una modificación.
--
-- SOBRE LOS ESTADOS
-- -----------------
-- `gh_firma_firmas_electronicas.estado` tiene un CHECK que NO se puede
-- alterar en SQLite sin reconstruir la tabla. Por eso la firma autográfica
-- NO se mete en esa columna: vive en su propia tabla, y el estado de la vía
-- electrónica pasa a `CANCELLED` con el evento que explica por qué (la
-- pidió el Trabajador para firmar en papel). La verdad del acto en papel
-- está en `gh_firma_firmas_papel`, y los eventos cuentan la historia.
--
-- `gh_firma_medios_trabajador.estado` tiene tres valores a propósito:
--   - PENDIENTE: el Trabajador declaró el medio pero todavía NO demostró que
--     lo controla (el OTP no ha sido verificado). No sirve para entregar
--     copias: entregarlas a un buzón no verificado sería entregar la copia a
--     un desconocido.
--   - ACTIVO: el medio está verificado y autorizado.
--   - BAJA: el Trabajador lo retiró (el 8.2: puede modificar la autorización
--     en cualquier momento). Se conserva la fila: el registro de lo que se
--     retiró es parte de la evidencia.
--
-- Tests: tests/n9a-medios-y-papel.test.js
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla 1: los medios electrónicos autorizados por el Trabajador (8.2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_medios_trabajador (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empresa TEXT NOT NULL,
  -- El seudónimo del Trabajador (psn1_...), no el documento crudo: la base
  -- de un Encargado no guarda documentos de identidad en claro.
  id_trabajador TEXT NOT NULL,
  -- EMAIL_HOJA_VIDA = el correo registrado en la hoja de vida (el 8.2 lo
  --   autoriza de entrada; lo registra la Empresa).
  -- CORREO_OTP     = el medio personal que declaró el Trabajador para el
  --   código de verificación (el D-02). Lo declara y lo modifica el
  --   Trabajador.
  -- LINK_KAIR      = el enlace de firma electrónica de K+AIR (el 8.2 lo
  --   autoriza de entrada; lo registra el sistema).
  tipo TEXT NOT NULL CHECK (tipo IN (
    'EMAIL_HOJA_VIDA', 'CORREO_OTP', 'LINK_KAIR'
  )),
  -- El valor del medio. Para LINK_KAIR es '' (no tiene un valor propio).
  valor TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE', 'ACTIVO', 'BAJA'
  )),
  -- Quién lo registró: TRABAJADOR (él mismo), EMPRESA (la ficha de la
  -- Empresa) o SISTEMA (el alta automática al crear la solicitud).
  origen TEXT NOT NULL CHECK (origen IN (
    'TRABAJADOR', 'EMPRESA', 'SISTEMA'
  )),
  fecha_registro TEXT NOT NULL,
  fecha_modificacion TEXT NOT NULL,
  fecha_baja TEXT,
  -- Un medio no se registra dos veces. Con `valor` en '' (no NULL) el
  -- UNIQUE funciona también para LINK_KAIR.
  UNIQUE (id_empresa, id_trabajador, tipo, valor)
);

CREATE INDEX IF NOT EXISTS idx_medios_trabajador
  ON gh_firma_medios_trabajador(id_empresa, id_trabajador, estado);

-- -----------------------------------------------------------------------------
-- Tabla 2: la firma autográfica sobre soporte papel (7.1-7.3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_firmas_papel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- La solicitud de firma sobre la que se firma en papel.
  firma_id INTEGER NOT NULL,
  id_solicitud TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  id_trabajador TEXT,
  -- SOLICITADO = el Trabajador pidió la vía en papel.
  -- ENTREGADO  = la Empresa entregó el documento en papel para firmar.
  -- FIRMADO    = el documento firmado en papel quedó registrado.
  estado TEXT NOT NULL DEFAULT 'SOLICITADO' CHECK (estado IN (
    'SOLICITADO', 'ENTREGADO', 'FIRMADO'
  )),
  fecha_solicitud TEXT NOT NULL,
  fecha_entrega TEXT,
  fecha_firma TEXT,
  -- El PDF del documento firmado en papel (el que la Empresa escaneó).
  pdf_firmado_path TEXT,
  -- El SHA-256 del PDF firmado en papel, calculado por el servidor.
  pdf_hash TEXT,
  -- El "Registro de firma autográfica": la evidencia del acto, en el mismo
  -- sentido en que la Constancia de firma electrónica es la evidencia del
  -- acto electrónico.
  registro_path TEXT,
  -- La versión del Acuerdo y su huella: el papel no está por fuera del
  -- Acuerdo (el 7.1 y el 8.2 hablan del mismo mecanismo).
  version_kair TEXT,
  acuerdo_hash TEXT,
  -- Quién registró el documento firmado en papel (el operador de la
  -- Empresa, desde K+AIR).
  id_actor TEXT,
  metadata TEXT,
  UNIQUE (firma_id)
);

CREATE INDEX IF NOT EXISTS idx_firmas_papel_empresa
  ON gh_firma_firmas_papel(id_empresa, estado, fecha_solicitud DESC);

CREATE INDEX IF NOT EXISTS idx_firmas_papel_trabajador
  ON gh_firma_firmas_papel(id_empresa, id_trabajador, fecha_solicitud DESC);
