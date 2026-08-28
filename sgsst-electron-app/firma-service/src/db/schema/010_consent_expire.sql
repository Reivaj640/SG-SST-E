-- =============================================================================
-- Migración 010: Expiración de consentimientos (FASE 3 · A1.5.4-B)
-- =============================================================================
-- Esta migración es ADITIVA (no breaking para datos existentes).
--
-- Motivación:
--   El consentimiento (gh_consentimientos_firma) tiene hoy 3 transiciones
--   posibles desde OTP_PENDING:
--     · OTP correcto  → ACCEPTED
--     · 5 intentos    → OTP_LOCKED
--     · OTP vencido   → (no transiciona, queda colgado)
--
--   El caso del OTP vencido es real: si el SMTP falla o el usuario ignora
--   el correo, el consentimiento queda en OTP_PENDING indefinidamente y
--   BLOQUEA la creación de un nuevo consentimiento para la misma key
--   (trabajador, empresa, version_acuerdo) por la UNIQUE constraint.
--
-- Cambios:
--   1. Agrega columna fecha_otp_enviado TEXT a gh_consentimientos_firma.
--      Permite saber CUÁNDO se envió el OTP para calcular expiración.
--      Default NULL para consentimientos legacy (pre-migración 010):
--      si es NULL, verifyOtp() no puede calcular expiración, pero eso
--      es aceptable — los consentimientos legacy están pre-010.
--
--   2. Crea tabla gh_consentimientos_eventos (separación de dominio).
--      Los eventos de SIGN REQUEST viven en gh_firma_eventos (que tiene
--      FK a gh_firmas_electronicas). Los eventos de CONSENTIMIENTO no
--      tienen un sign request asociado (e.g. expiración antes de crear
--      SR, o eventos administrativos sin SR).
--
--      Crear una tabla separada es la decisión correcta arquitectónica:
--      · No contamina gh_firma_eventos con filas firma_id=0 (que serían
--        huérfanos lógicos aunque pasaran la FK).
--      · Permite escalar el dominio de consentimientos sin tocar el
--        dominio de sign requests.
--      · Permite índices específicos para queries de consentimiento.
--
--      Columnas:
--        id: PK autoincrement
--        consent_id: FK a gh_consentimientos_firma(id) — NOT NULL
--        evento: nombre del evento (e.g. 'CONSENT_EXPIRED', 'CONSENT_OTP_SENT')
--        fecha_hora: ISO 8601
--        id_actor: quién originó el evento
--        ip: IP de origen
--        user_agent: User-Agent
--        metadata: JSON con contexto adicional
--
--      Índices:
--        idx_consent_eventos_consent_fecha: lookup por consentimiento
--        idx_consent_eventos_tipo_fecha: lookup por tipo de evento
--
-- Backfill:
--   - fecha_otp_enviado: NULL para consentimientos existentes.
--     Si en el futuro se quiere inferir retroactivamente, se puede
--     tomar created_at como proxy (es la primera fila donde el
--     consentimiento apareció en BD; el OTP se envió ~al mismo tiempo).
--     NO se hace backfill ahora — preserva la historia real.
--
-- Tests:
--   - tests/migration-010.test.js: verifica que la migración aplica
--     sin romper consentimientos legacy.
--   - tests/routes/consent-expire.test.js: cubre el flujo end-to-end
--     de expiración (OTP vencido → EXPIRED, endpoint /expire).
-- =============================================================================

-- 1. Columna fecha_otp_enviado en consentimientos
ALTER TABLE gh_consentimientos_firma
  ADD COLUMN fecha_otp_enviado TEXT;

-- 2. Tabla gh_consentimientos_eventos (separación de dominio)
CREATE TABLE IF NOT EXISTS gh_consentimientos_eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consent_id INTEGER NOT NULL,
  evento TEXT NOT NULL,
  fecha_hora TEXT NOT NULL,
  id_actor TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  metadata TEXT,
  FOREIGN KEY (consent_id) REFERENCES gh_consentimientos_firma(id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_consent_eventos_consent_fecha
  ON gh_consentimientos_eventos(consent_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_consent_eventos_tipo_fecha
  ON gh_consentimientos_eventos(evento, fecha_hora);
