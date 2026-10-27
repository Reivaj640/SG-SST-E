-- =============================================================================
-- 042 · CUENTA DE CORREO DE ENVÍO DE LA EMPRESA
-- =============================================================================
--
-- QUÉ RESUELVE
-- -------------
-- La decisión 1.b del owner: "la Empresa es quien realiza el envío, con sus
-- propios correos; K+AIR es el puente".
--
-- Hasta ahora TODO salía por la cuenta de K+AIR (`config.smtp`): la invitación
-- con el enlace de acceso, el aviso posterior a la firma, la copia del documento
-- firmado en papel y la invitación al representante legal. Con esta migración
-- cada Empresa puede registrar su PROPIA cuenta de envío (host, puerto, secure,
-- usuario, clave, nombre y correo del remitente) y esas cuatro comunicaciones
-- salen por ahí, con la identidad del remitente de la Empresa.
--
-- EL CÓDIGO DE VERIFICACIÓN QUEDA FUERA, Y NO ES UNA EXCEPCIÓN
-- ------------------------------------------------------------
-- El OTP se remite SIEMPRE desde la cuenta de K+AIR, nunca desde la cuenta de
-- la Empresa, aunque la Empresa tenga cuenta configurada y activa.
--
-- POR QUÉ: el OTP es el dato de creación de la firma. Si su custodia dependiera
-- de la Empresa, el dato de creación dejaría de corresponder exclusivamente al
-- firmante (el 3.7(a) y el 2.2.2.47.4 num. 1 del Acuerdo de uso) y la garantía
-- del 6.1(d) sería falsa. Esto es lo que hace que, cuando el enlace sale de la
-- cuenta de la Empresa, el enlace y el código viajen por canales distintos.
--
-- LA CONTRASEÑA NO ES UN DATO DE LA TABLA
-- ----------------------------------------
-- `clave_cuenta_envio` guarda el SOBRE cifrado (`enc:v2:...`), no la clave. La
-- llave maestra vive fuera de la base (src/crypto/cifrado.js), así que quien
-- lea la tabla no puede recuperar la contraseña probando candidatos.
--
-- La clave se cifra con la ambito = id_empresa y el propósito
-- 'cifrado-cuenta-envio': una clave de una Empresa no se puede descifrar con
-- la ambito de otra.
--
-- LA CONTRASEÑA NO APARECE EN NINGÚN OTRO LADO
-- ---------------------------------------------
-- El `GET` de admin devuelve la vista ENMASCARADA (sin la clave: solo un
-- booleano `clave_presente`) y el rastro de auditoría nunca la copia: para el
-- campo de la clave se anotan los estados CONFIGURADA / CAMBIADA / ELIMINADA.
--
-- EL RASTRO ES APPEND-ONLY
-- -------------------------
-- Mismo patrón que la 036 (bitácora de excepciones) y la 038 (rastro de la
-- ficha de la empresa): lo que se escribe una vez, no se altera ni se borra.
--
-- POR QUÉ LOS TRIGGERS VAN EN ESTE MISMO ARCHIVO
-- -----------------------------------------------
-- En la 036 y la 038 los triggers van aparte y con `@skip-when-env test`,
-- porque `resetDb()` (tests/helpers.js) vacía esas tablas entre tests y un
-- trigger de no-borrar se lo impediría.
--
-- Estas tablas NO están en la lista de `resetDb()`: la cuenta de envío es una
-- cuenta por Empresa (no una fila por test), y su rastro tiene que sobrevivir
-- a la limpieza igual que el rastro de la ficha. Por eso los triggers pueden
-- vivir acá y quedar activos también en el ambiente de test: el test prueba
-- que muerden sobre la base real, en vez de simularlos en memoria.
--
-- SIN LLAVE FORÁNEA A LA FICHA
-- -----------------------------
-- Igual que `gh_firma_empresas_auditoria` (037): el rastro no declara FK.
-- Con FK y ON DELETE CASCADE, un borrado en cascada de la ficha dispararía el
-- trigger de no-borrar del rastro y dejaría la operación a medias. La ficha de
-- la Empresa no se borra (se da de baja lógicamente), así que la integridad la
-- garantiza el código, no la base.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- La cuenta de envío de la Empresa (una por Empresa).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_empresas_cuenta_envio (
  id_empresa          TEXT    PRIMARY KEY,
  host                TEXT    NOT NULL,
  puerto              INTEGER NOT NULL,
  secure              INTEGER NOT NULL DEFAULT 0,
  usuario             TEXT    NOT NULL,
  -- El SOBRE cifrado de la contraseña (enc:v2:...). NUNCA la clave en claro.
  clave_cuenta_envio  TEXT    NOT NULL,
  from_nombre         TEXT    NOT NULL,
  from_email          TEXT    NOT NULL,
  activo              INTEGER NOT NULL DEFAULT 1,
  fecha_creacion      TEXT    NOT NULL DEFAULT (datetime('now')),
  fecha_actualizacion TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- El rastro de los cambios de la cuenta de envío (append-only).
--
-- Mismos campos que el rastro de la ficha (037): quién, cuándo, desde dónde,
-- por qué, y de qué valor a qué valor.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gh_firma_empresas_cuenta_envio_auditoria (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empresa      TEXT NOT NULL,
  fecha_hora      TEXT NOT NULL,
  id_actor        TEXT NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  campo           TEXT NOT NULL,
  valor_anterior  TEXT,
  valor_nuevo     TEXT,
  motivo          TEXT
);

CREATE INDEX IF NOT EXISTS idx_empresas_cuenta_envio_auditoria_empresa
  ON gh_firma_empresas_cuenta_envio_auditoria(id_empresa);

CREATE TRIGGER IF NOT EXISTS trg_empresas_cuenta_envio_auditoria_no_update
BEFORE UPDATE ON gh_firma_empresas_cuenta_envio_auditoria
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_empresas_cuenta_envio_auditoria es append-only: el rastro de la cuenta de envio no se altera');
END;

CREATE TRIGGER IF NOT EXISTS trg_empresas_cuenta_envio_auditoria_no_delete
BEFORE DELETE ON gh_firma_empresas_cuenta_envio_auditoria
BEGIN
  SELECT RAISE(ABORT, 'gh_firma_empresas_cuenta_envio_auditoria es append-only: el rastro de la cuenta de envio no se borra');
END;
