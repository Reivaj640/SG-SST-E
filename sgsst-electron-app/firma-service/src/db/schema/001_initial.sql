-- =============================================================================
-- Servicio de Firma Electrónica K+AIR v1 — Schema inicial (001)
-- =============================================================================
-- 5 tablas del Servicio, según DATA_MODEL.md.
-- Tablas espejo de K+AIR local viven en la BD de K+AIR (no aquí).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabla 1: Versiones del Acuerdo de uso
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_acuerdo_versiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  texto TEXT NOT NULL,
  texto_hash TEXT NOT NULL,
  fecha_vigencia_inicio TEXT NOT NULL,
  fecha_vigencia_fin TEXT,
  activa INTEGER NOT NULL DEFAULT 0,
  creado_por TEXT,
  kair_version TEXT,
  fecha_creacion TEXT NOT NULL,
  metadata TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_acuerdo_version_unica
  ON gh_firma_acuerdo_versiones(version);

-- -----------------------------------------------------------------------------
-- Tabla 2: Consentimientos del Acuerdo
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_consentimientos_firma (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  version_acuerdo TEXT NOT NULL,
  hash_texto_acuerdo TEXT NOT NULL,
  correo_verificacion TEXT NOT NULL,
  correo_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_sal TEXT NOT NULL,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  fecha_aceptacion TEXT,
  kair_version TEXT NOT NULL,
  manifestacion_aceptada INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'OTP_PENDING',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (id_trabajador, id_empresa, version_acuerdo)
);

CREATE INDEX IF NOT EXISTS idx_consentimientos_trabajador
  ON gh_consentimientos_firma(id_trabajador, id_empresa, version_acuerdo);

-- -----------------------------------------------------------------------------
-- Tabla 3: Solicitudes de firma (la principal)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firmas_electronicas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_solicitud TEXT NOT NULL UNIQUE,
  id_documento TEXT NOT NULL,
  id_trabajador TEXT NOT NULL,
  id_empresa TEXT NOT NULL,
  tipo_firma TEXT NOT NULL CHECK (tipo_firma IN ('presencial', 'remoto')),
  estado TEXT NOT NULL DEFAULT 'PENDING',
  document_hash_original TEXT NOT NULL,
  document_hash_firmado TEXT,
  agreement_hash TEXT NOT NULL,
  evidence_hash TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  identificacion_tipo TEXT,
  identificacion_numero_hash TEXT,
  identificacion_coincidio INTEGER,
  correo_verificacion TEXT,
  correo_hash TEXT,
  otp_hash TEXT,
  otp_sal TEXT,
  otp_intentos INTEGER NOT NULL DEFAULT 0,
  otp_bloqueado INTEGER NOT NULL DEFAULT 0,
  ip_origen TEXT,
  user_agent TEXT,
  sesion_id TEXT,
  verification_channel TEXT NOT NULL DEFAULT 'email',
  fecha_creacion TEXT NOT NULL,
  fecha_expiracion TEXT NOT NULL,
  fecha_apertura TEXT,
  fecha_otp_enviado TEXT,
  fecha_otp_verificado TEXT,
  fecha_documento_visto TEXT,
  fecha_manifestacion TEXT,
  fecha_firma TEXT,
  fecha_revocacion TEXT,
  motivo_revocacion TEXT,
  motivo_rechazo TEXT,
  version_kair TEXT NOT NULL,
  manifestacion_voluntad_texto TEXT,
  manifestacion_voluntad_hash TEXT,
  pdf_original_path TEXT,
  pdf_firmado_path TEXT,
  constancia_path TEXT,
  metadata TEXT,
  CHECK (estado IN (
    'PENDING', 'OPENED', 'IDENTIFICATION_STARTED', 'IDENTIFIED',
    'OTP_SENT', 'OTP_VERIFIED', 'DOCUMENT_OPENED', 'DOCUMENT_VIEWED',
    'MANIFESTATION_RECORDED', 'SIGNED', 'REJECTED', 'EXPIRED',
    'REVOKED', 'CANCELLED', 'OTP_LOCKED', 'IDENTIFICATION_FAILED'
  ))
);

CREATE INDEX IF NOT EXISTS idx_firmas_token_hash
  ON gh_firmas_electronicas(token_hash);
CREATE INDEX IF NOT EXISTS idx_firmas_empresa_estado_fecha
  ON gh_firmas_electronicas(id_empresa, estado, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_firmas_documento
  ON gh_firmas_electronicas(id_documento);
CREATE INDEX IF NOT EXISTS idx_firmas_trabajador
  ON gh_firmas_electronicas(id_trabajador, fecha_creacion DESC);

-- -----------------------------------------------------------------------------
-- Tabla 4: Eventos de auditoría (append-only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT,
  id_actor TEXT NOT NULL,
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas(id)
);

CREATE INDEX IF NOT EXISTS idx_eventos_firma_fecha
  ON gh_firma_eventos(firma_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo_fecha
  ON gh_firma_eventos(evento, fecha_hora);

-- -----------------------------------------------------------------------------
-- Tabla 5: Sesiones de firma (estado transitorio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_sesiones (
  id TEXT PRIMARY KEY,
  firma_id INTEGER NOT NULL UNIQUE,
  estado_sesion TEXT NOT NULL,
  iniciado_en TEXT NOT NULL,
  ultimo_cambio_en TEXT NOT NULL,
  cambios_estado INTEGER NOT NULL DEFAULT 0,
  ip_actual TEXT,
  user_agent_actual TEXT,
  metadata_sesion TEXT,
  FOREIGN KEY (firma_id) REFERENCES gh_firmas_electronicas(id)
);

-- -----------------------------------------------------------------------------
-- Tabla de migraciones aplicadas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gh_firma_schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT
);
