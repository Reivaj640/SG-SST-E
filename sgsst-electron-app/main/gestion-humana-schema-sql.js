// main/gestion-humana-schema-sql.js
// Schema del módulo Gestión Humana (v0.3.0) — POST-LEGACY-SIGN-REMOVE
// 8 tablas: contrataciones, base_personal, gh_sedes, vacaciones, permisos, documentos,
//           anuncios, mensajes  (📦710 + 📦760 + 📦764)
//
// Cambio v0.3.0 (LEGACY-SIGN-REMOVE 2026-08-20):
//   - Eliminada tabla gh_firmas_digitales (firma canvas operativa interna sin valor
//     jurídico). La firma ahora es únicamente electrónica vía firma-service (I-101).
//   - Eliminada columna gh_documentos.firma_id.
//   - Mantenidos gh_documentos.estado y gh_documentos.fecha_firma: se re-poblan desde
//     firma-service cuando llega un evento SIGN_COMMITTED (ver I-105).
//
// Patrón: mismo estilo que main/presupuesto-schema-sql.js.
// Se ejecuta con sql.js en tests, better-sqlite3 en producción.
//
// Empresa multi-tenant: TODAS las tablas tienen empresa_id + índice (multi-tenant via filter).
// Para tablas que se relacionan con Trabajador (vacaciones, permisos, documentos, etc.)
// el multi-tenant se hace via JOIN a base_personal.empresa_id.
// IDs:
//   ct-{nanoid}   contrataciones
//   bp-{nanoid}   base_personal
//   se-{nanoid}   gh_sedes
//   va-{nanoid}   vacaciones
//   pe-{nanoid}   permisos
//   do-{nanoid}   documentos
//   an-{nanoid}   anuncios
//   me-{nanoid}   mensajes
//   daf-{nanoid}  documentos_afiliaciones   (📦760)
//   tp-{nanoid}   templates                  (📦764)
//   ev-{nanoid}   eventos_personal           (I-103.A1.0-D-1 · trazabilidad de ciclos laborales)
// Fechas: ISO 8601 strings, nunca Date objects
// Soft delete: activo=0 en base_personal. contrataciones usa estado='cancelado' (decisión validada con usuario 2026-08-15)

const SCHEMA_SQL = `
-- 📦709 · Tabla principal: procesos de contratación en curso (pipeline 6 pasos)
CREATE TABLE IF NOT EXISTS contrataciones (
  id TEXT PRIMARY KEY,                       -- formato ct-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT,
  telefono TEXT,
  cargo TEXT NOT NULL,
  salario REAL,
  fecha_ingreso TEXT NOT NULL,               -- ISO 8601
  sede_id TEXT,
  empresa_usuaria TEXT,
  paso_actual INTEGER DEFAULT 1,             -- 1-6 (memo, contacto, examenes, documentos, afiliaciones, s400)
  memo_recibido INTEGER DEFAULT 0,
  memo_fecha TEXT,
  memo_notas TEXT,
  contacto_realizado INTEGER DEFAULT 0,
  contacto_fecha TEXT,
  contacto_notas TEXT,
  examenes_programados INTEGER DEFAULT 0,
  examenes_fecha TEXT,
  examenes_ips TEXT,
  examenes_notas TEXT,
  documentos_firmados INTEGER DEFAULT 0,
  documentos_fecha TEXT,
  documentos_notas TEXT,
  afiliaciones_completadas INTEGER DEFAULT 0,
  afiliaciones_fecha TEXT,
  afiliaciones_notas TEXT,
  s400_activado INTEGER DEFAULT 0,
  s400_fecha TEXT,
  s400_notas TEXT,
  estado TEXT DEFAULT 'en_proceso',          -- en_proceso | completado | cancelado
  trabajador_id TEXT,                        -- link a base_personal cuando completa (v0.2)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contrataciones_empresa ON contrataciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contrataciones_estado ON contrataciones(estado);
CREATE INDEX IF NOT EXISTS idx_contrataciones_paso ON contrataciones(paso_actual);

-- 📦709 · Tabla principal: trabajadores activos/inactivos (Base de Personal)
CREATE TABLE IF NOT EXISTS base_personal (
  id TEXT PRIMARY KEY,                       -- formato bp-{nanoid}
  empresa_id TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cedula TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'CC',          -- CC | CE | TI | PAS
  fecha_exp_cedula TEXT,
  lugar_exp_cedula TEXT,
  fecha_nacimiento TEXT,
  lugar_nacimiento TEXT,
  telefono TEXT,
  celular TEXT,
  email TEXT,
  estado_civil TEXT,                         -- soltero | casado | union_libre | separado | viudo
  nivel_educativo TEXT,                      -- primaria | secundaria | tecnico | tecnologo | profesional | especializacion | maestria
  direccion TEXT,
  barrio TEXT,
  ciudad TEXT,
  cargo TEXT,
  salario REAL,
  tipo_contrato TEXT,                        -- indefinido | fijo | prestacion | obra_labor | aprendizaje
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  estado TEXT DEFAULT 'activo',              -- activo | incapacitado | vacaciones | permiso | maternidad | paternidad | luto | retirado
  fecha_ingreso_s400 TEXT,                   -- 📦775 · fecha del paso 6 S400 (activación en sistema Tempoactiva)
  fecha_afiliaciones TEXT,                   -- 📦775 · fecha del paso 5 (afiliaciones completadas)
  eps TEXT,
  eps_fecha TEXT,
  pension TEXT,
  pension_fecha TEXT,
  arl TEXT,
  arl_fecha TEXT,
  caja_compensacion TEXT,
  caja_fecha TEXT,
  activo_s400 INTEGER DEFAULT 0,
  empresa_usuaria TEXT,
  banco TEXT,
  numero_cuenta TEXT,
  sede_id TEXT,                              -- 📦731 · Sede asignada al trabajador (FK a gh_sedes.id)
  activo INTEGER DEFAULT 1,                  -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(empresa_id, cedula)
);
CREATE INDEX IF NOT EXISTS idx_base_personal_empresa ON base_personal(empresa_id);
CREATE INDEX IF NOT EXISTS idx_base_personal_estado ON base_personal(estado);
CREATE INDEX IF NOT EXISTS idx_base_personal_activo ON base_personal(activo);
CREATE INDEX IF NOT EXISTS idx_base_personal_cedula ON base_personal(empresa_id, cedula);
CREATE INDEX IF NOT EXISTS idx_base_personal_sede ON base_personal(empresa_id, sede_id);

-- 📦709 · Tabla auxiliar: sedes (referencia para contrataciones y base_personal)
CREATE TABLE IF NOT EXISTS gh_sedes (
  id TEXT PRIMARY KEY,                       -- formato se-{nanoid}
  empresa_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  activo INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(empresa_id, nombre)
);
CREATE INDEX IF NOT EXISTS idx_gh_sedes_empresa ON gh_sedes(empresa_id);

-- 📦710 · VACACIONES — programación, aprobaciones y notificación a clientes
CREATE TABLE IF NOT EXISTS gh_vacaciones (
  id TEXT PRIMARY KEY,                       -- formato va-{nanoid}
  trabajador_id TEXT NOT NULL,               -- referencia a base_personal.id
  empresa_id TEXT NOT NULL,                  -- denormalizado para multi-tenant filter
  fecha_solicitud TEXT NOT NULL,             -- ISO 8601 (cuándo se pidió)
  fecha_inicio TEXT NOT NULL,                -- ISO 8601 (cuándo sale)
  fecha_fin TEXT NOT NULL,                   -- ISO 8601 (cuándo regresa)
  dias_solicitados INTEGER NOT NULL,
  dias_pendientes INTEGER,                   -- salgo a disfrutar después
  estado TEXT DEFAULT 'solicitada',          -- solicitada | aprobada | rechazada | programada | disfrutada
  aprobado_por TEXT,                         -- nombre o user_id
  fecha_aprobacion TEXT,
  notas TEXT,
  notificar_cliente INTEGER DEFAULT 0,       -- boolean
  cliente_notificado INTEGER DEFAULT 0,      -- boolean (estado de la notificación)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_vacaciones_trabajador ON gh_vacaciones(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_gh_vacaciones_empresa ON gh_vacaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_vacaciones_estado ON gh_vacaciones(estado);
CREATE INDEX IF NOT EXISTS idx_gh_vacaciones_inicio ON gh_vacaciones(fecha_inicio);

-- 📦710 · PERMISOS Y ESTADOS — incapacidades, maternidad, luto, citas, calamidad
CREATE TABLE IF NOT EXISTS gh_permisos (
  id TEXT PRIMARY KEY,                       -- formato pe-{nanoid}
  trabajador_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                        -- incapacidad | maternidad | paternidad | luto | permiso_personal | cita_medica | calamidad | licencia_no_remunerada
  fecha_inicio TEXT NOT NULL,
  fecha_fin TEXT,                            -- null si aún no termina
  dias INTEGER,
  estado TEXT DEFAULT 'activo',              -- activo | finalizado | prorrogado
  motivo TEXT,
  soporte_url TEXT,                          -- ruta al documento de soporte (incapacidad, etc.)
  prorroga INTEGER DEFAULT 0,                -- boolean
  notas TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_permisos_trabajador ON gh_permisos(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_gh_permisos_empresa ON gh_permisos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_permisos_tipo ON gh_permisos(tipo);
CREATE INDEX IF NOT EXISTS idx_gh_permisos_estado ON gh_permisos(estado);
CREATE INDEX IF NOT EXISTS idx_gh_permisos_inicio ON gh_permisos(fecha_inicio);

-- 📦710 · DOCUMENTOS — 7 formatos del proceso de contratación
CREATE TABLE IF NOT EXISTS gh_documentos (
  id TEXT PRIMARY KEY,                       -- formato do-{nanoid}
  trabajador_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                        -- autorizacion_datos | autorizacion_hojas_vida | actualizacion_datos | induccion | contrato | carta_examenes | carta_cuenta_bancaria
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,                   -- JSON con datos capturados al generar
  estado TEXT DEFAULT 'pendiente',           -- pendiente | firmado | anulado  (firmado: vía firma-service, ver I-101/I-105)
  fecha_firma TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_documentos_trabajador ON gh_documentos(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_gh_documentos_empresa ON gh_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_documentos_tipo ON gh_documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_gh_documentos_estado ON gh_documentos(estado);

-- 📦710 · ANUNCIOS — tablón de anuncios oficiales (info, urgente, mantenimiento, evento)
CREATE TABLE IF NOT EXISTS gh_anuncios (
  id TEXT PRIMARY KEY,                       -- formato an-{nanoid}
  empresa_id TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',                  -- info | urgente | mantenimiento | evento
  dirigido_a TEXT DEFAULT 'todos',           -- todos | sede | cargo | trabajador
  sede_id TEXT,                              -- si dirigido_a='sede'
  cargo_filtro TEXT,                         -- si dirigido_a='cargo'
  fecha_publicacion TEXT NOT NULL,
  fecha_expiracion TEXT,
  publicado_por TEXT NOT NULL,               -- nombre o user_id
  activo INTEGER DEFAULT 1,                  -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_anuncios_empresa ON gh_anuncios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_anuncios_activo ON gh_anuncios(activo);
CREATE INDEX IF NOT EXISTS idx_gh_anuncios_tipo ON gh_anuncios(tipo);
CREATE INDEX IF NOT EXISTS idx_gh_anuncios_fecha ON gh_anuncios(fecha_publicacion);

-- 📦710 · MENSAJES — mensajes directos entre trabajadores
CREATE TABLE IF NOT EXISTS gh_mensajes (
  id TEXT PRIMARY KEY,                       -- formato me-{nanoid}
  empresa_id TEXT NOT NULL,
  remitente_id TEXT NOT NULL,                -- base_personal.id del que envía
  destinatario_id TEXT NOT NULL,             -- base_personal.id del que recibe
  asunto TEXT NOT NULL,
  contenido TEXT NOT NULL,
  leido INTEGER DEFAULT 0,                   -- boolean
  fecha_lectura TEXT,
  prioridad TEXT DEFAULT 'normal',           -- baja | normal | alta
  created_at TEXT NOT NULL,
  FOREIGN KEY (remitente_id) REFERENCES base_personal(id) ON DELETE CASCADE,
  FOREIGN KEY (destinatario_id) REFERENCES base_personal(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_mensajes_empresa ON gh_mensajes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_mensajes_destinatario ON gh_mensajes(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_gh_mensajes_remitente ON gh_mensajes(remitente_id);
CREATE INDEX IF NOT EXISTS idx_gh_mensajes_leido ON gh_mensajes(destinatario_id, leido);

-- 📦726 · ENVÍOS — bitácora de envíos externos (correo/WhatsApp) de anuncios y mensajes
CREATE TABLE IF NOT EXISTS gh_envios (
  id TEXT PRIMARY KEY,                       -- formato ev-{nanoid}
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                        -- anuncio | mensaje
  referencia_id TEXT NOT NULL,               -- gh_anuncios.id o gh_mensajes.id
  canal TEXT NOT NULL,                       -- email | whatsapp
  destinatario_id TEXT,                      -- base_personal.id (puede ser null si solo hay destino)
  destino TEXT NOT NULL,                     -- correo o teléfono usado
  estado TEXT NOT NULL,                      -- enviado | fallido
  detalle TEXT,                              -- mensaje de error o message-id
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_envios_empresa ON gh_envios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_envios_ref ON gh_envios(referencia_id);
CREATE INDEX IF NOT EXISTS idx_gh_envios_dest ON gh_envios(destinatario_id);

-- 📦727 · ADJUNTOS DE COMUNICACIÓN — archivos de anuncios y mensajes (van en cada correo)
CREATE TABLE IF NOT EXISTS gh_comunicacion_adjuntos (
  id TEXT PRIMARY KEY,                       -- formato ca-{nanoid}
  empresa_id TEXT NOT NULL,
  tipo TEXT NOT NULL,                        -- anuncio | mensaje
  referencia_id TEXT NOT NULL,               -- gh_anuncios.id o gh_mensajes.id
  nombre_archivo TEXT NOT NULL,
  ruta_archivo TEXT NOT NULL,
  tamano_bytes INTEGER DEFAULT 0,
  mime_type TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_comadj_ref ON gh_comunicacion_adjuntos(referencia_id);

-- 📦760 · DOCUMENTOS DE AFILIACIONES — certificados de EPS / Pensión / ARL / Caja
-- Un único documento por slot (trabajador + tipo de afiliación). Reemplaza el anterior.
-- Los archivos se almacenan en el filesystem (AppData/Roaming/sgsst-electron-app/gh-docs-afil/<empresa>/<trabajador>/<tipo>.pdf)
-- y esta tabla solo guarda la metadata + ruta absoluta al archivo.
CREATE TABLE IF NOT EXISTS gh_documentos_afiliaciones (
  id TEXT PRIMARY KEY,                       -- formato daf-{nanoid}
  empresa_id TEXT NOT NULL,
  trabajador_id TEXT NOT NULL,               -- FK a base_personal.id
  tipo_afiliacion TEXT NOT NULL,             -- eps | pension | arl | caja
  nombre_archivo TEXT NOT NULL,              -- nombre original del PDF subido
  ruta_archivo TEXT NOT NULL,                -- ruta absoluta en el filesystem
  tamano_bytes INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',
  subido_por TEXT,                           -- user_id o nombre
  fecha_subida TEXT NOT NULL,                -- ISO 8601
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(empresa_id, trabajador_id, tipo_afiliacion),  -- 1 doc por slot
  FOREIGN KEY (trabajador_id) REFERENCES base_personal(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_docs_afil_trabajador ON gh_documentos_afiliaciones(trabajador_id);
CREATE INDEX IF NOT EXISTS idx_gh_docs_afil_empresa ON gh_documentos_afiliaciones(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_docs_afil_tipo ON gh_documentos_afiliaciones(trabajador_id, tipo_afiliacion);

-- 📦764 · TEMPLATES DE DOCUMENTOS — plantillas .docx/.pdf que el user sube
-- para usar al generar documentos del proceso de contratación. Cada template
-- está asociado a un tipo de documento y se guarda el archivo en el filesystem
-- (AppData) y la metadata en esta tabla.
CREATE TABLE IF NOT EXISTS gh_templates (
  id TEXT PRIMARY KEY,                       -- formato tp-{nanoid}
  empresa_id TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,             -- autorizacion_datos | autorizacion_hojas_vida | actualizacion_datos | induccion | contrato | carta_examenes | carta_cuenta_bancaria
  nombre TEXT NOT NULL,                      -- nombre legible del template (ej: 'AUTORIZACIÓN TEMPOACTIVA v1')
  nombre_archivo TEXT NOT NULL,              -- nombre original del archivo (.docx o .pdf)
  ruta_archivo TEXT NOT NULL,                -- ruta absoluta en el filesystem (AppData)
  tamano_bytes INTEGER,
  mime_type TEXT,                            -- application/pdf | application/vnd.openxmlformats-officedocument.wordprocessingml.document
  subido_por TEXT,                           -- user_id o nombre
  fecha_subida TEXT NOT NULL,                -- ISO 8601
  activo INTEGER DEFAULT 1,                  -- soft delete
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_templates_empresa ON gh_templates(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_templates_tipo ON gh_templates(empresa_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_gh_templates_activo ON gh_templates(empresa_id, activo);

-- SOPORTES DE CONTRATACIÓN — evidencias adjuntas por paso del pipeline (memo,
-- orden de exámenes, constancias de afiliación, etc.). Patrón idéntico a
-- gh_documentos_afiliaciones: el binario vive en el filesystem
-- (<userData>/gh-soportes-contratacion/<empresa>/<contratacion>/paso-N/<archivo>)
-- y esta tabla solo guarda metadata + ruta.
-- A diferencia de afiliaciones (1 doc por slot), un paso puede tener N soportes.
CREATE TABLE IF NOT EXISTS gh_contratacion_soportes (
  id TEXT PRIMARY KEY,                       -- formato sop-{nanoid}
  empresa_id TEXT NOT NULL,
  contratacion_id TEXT NOT NULL,             -- FK a contrataciones.id
  paso_num INTEGER NOT NULL CHECK (paso_num BETWEEN 1 AND 6),
  nombre_archivo TEXT NOT NULL,              -- nombre original del archivo subido
  ruta_archivo TEXT NOT NULL,                -- ruta absoluta en el filesystem
  tamano_bytes INTEGER,
  mime_type TEXT,
  subido_por TEXT,                           -- user_id o nombre
  fecha_subida TEXT NOT NULL,                -- ISO 8601
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contratacion_id) REFERENCES contrataciones(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_gh_soportes_contratacion ON gh_contratacion_soportes(contratacion_id);
CREATE INDEX IF NOT EXISTS idx_gh_soportes_empresa ON gh_contratacion_soportes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gh_soportes_paso ON gh_contratacion_soportes(contratacion_id, paso_num);
`;

// ========== MIGRATIONS · 📦731/📦764 + LEGACY-SIGN-REMOVE — idempotentes (se ejecutan una por una con try/catch) ==========
// Cada ALTER se aplica individualmente; si la columna ya existe SQLite lanza
// "duplicate column name" que main.js ignora. Esto permite upgrades en caliente
// de una BD que ya tiene tablas de la versión anterior.
//
// Migración 1: agregar sede_id a base_personal (nullable, sin default — los
// trabajadores existentes quedan sin sede asignada hasta que se actualice).
// Migración 2-3: agregar ruta_archivo + nombre_archivo a gh_documentos (📦764)
// para guardar el archivo del documento generado desde un template.
// Migración 4-5: tracking del flujo de Contratación → Base Personal (📦775).
// Migración 6 (LEGACY-SIGN-REMOVE 2026-08-20): eliminar firma canvas.
//   - DROP COLUMN firma_id de gh_documentos (la firma canvas ya no se usa).
//   - DROP TABLE gh_firmas_digitales (no tiene valor jurídico).
//   - DROP INDEX de los 3 índices de la tabla eliminada.
// Migración 7 (I-103.A1.0-D-1): gh_eventos_personal — trazabilidad de ciclos laborales.
//   Permite registrar RETIRO / REINGRESO / RECONTRATACION sin alterar base_personal ni
//   contrataciones. Los CHECK constraints blindan la coherencia semántica. Los eventos
//   NO se generan retroactivamente para los 625 bp retirados históricos — solo a partir del deploy.
const MIGRATIONS_SQL = [
  "ALTER TABLE base_personal ADD COLUMN sede_id TEXT;",
  "CREATE INDEX IF NOT EXISTS idx_base_personal_sede ON base_personal(empresa_id, sede_id);",
  "ALTER TABLE gh_documentos ADD COLUMN ruta_archivo TEXT;",
  "ALTER TABLE gh_documentos ADD COLUMN nombre_archivo TEXT;",
  // 📦775 · columnas para tracking del flujo de Contratación → Base Personal
  "ALTER TABLE base_personal ADD COLUMN fecha_ingreso_s400 TEXT;",
  "ALTER TABLE base_personal ADD COLUMN fecha_afiliaciones TEXT;",
  // LEGACY-SIGN-REMOVE · eliminar firma canvas (try/catch en main.js hace skip si la columna/tabla no existe)
  "ALTER TABLE gh_documentos DROP COLUMN firma_id;",
  "DROP INDEX IF EXISTS idx_gh_firmas_trabajador;",
  "DROP INDEX IF EXISTS idx_gh_firmas_empresa;",
  "DROP INDEX IF EXISTS idx_gh_firmas_documento;",
  "DROP TABLE IF EXISTS gh_firmas_digitales;",
  // I-103.A1.0-D-1 · gh_eventos_personal + 4 índices
  "CREATE TABLE IF NOT EXISTS gh_eventos_personal (" +
  " id TEXT PRIMARY KEY," +
  " empresa_id TEXT NOT NULL," +
  " trabajador_id TEXT NOT NULL," +
  " tipo_evento TEXT NOT NULL," +
  " fecha_evento TEXT NOT NULL," +
  " estado_anterior TEXT NOT NULL," +
  " estado_nuevo TEXT NOT NULL," +
  " fecha_referencia TEXT," +
  " contratacion_id TEXT," +
  " metadata TEXT," +
  " usuario_id TEXT," +
  " created_at TEXT NOT NULL," +
  " CHECK (tipo_evento IN ('RETIRO','REINGRESO','RECONTRATACION'))," +
  " CHECK (estado_anterior IN ('activo','incapacitado','vacaciones','permiso','maternidad','paternidad','luto','retirado'))," +
  " CHECK (estado_nuevo IN ('activo','retirado'))," +
  " CHECK (" +
  "  (tipo_evento='RETIRO'         AND estado_anterior<>'retirado' AND estado_nuevo='retirado'                                  ) OR" +
  "  (tipo_evento='REINGRESO'      AND estado_anterior ='retirado' AND estado_nuevo='activo'  AND contratacion_id IS NULL     ) OR" +
  "  (tipo_evento='RECONTRATACION' AND estado_anterior ='retirado' AND estado_nuevo='activo'  AND contratacion_id IS NOT NULL )" +
  " )," +
  " CHECK (" +
  "  (tipo_evento IN ('REINGRESO','RECONTRATACION') AND fecha_referencia IS NOT NULL) OR" +
  "  (tipo_evento='RETIRO')" +
  " )" +
  ");",
  "CREATE INDEX IF NOT EXISTS idx_gh_eventos_trabajador   ON gh_eventos_personal(trabajador_id, fecha_evento DESC);",
  "CREATE INDEX IF NOT EXISTS idx_gh_eventos_empresa      ON gh_eventos_personal(empresa_id, fecha_evento DESC);",
  "CREATE INDEX IF NOT EXISTS idx_gh_eventos_tipo         ON gh_eventos_personal(tipo_evento);",
  "CREATE INDEX IF NOT EXISTS idx_gh_eventos_contratacion ON gh_eventos_personal(contratacion_id) WHERE contratacion_id IS NOT NULL;"
];

module.exports = {
  SCHEMA_SQL: SCHEMA_SQL,
  MIGRATIONS_SQL: MIGRATIONS_SQL,
  // Conteos esperados para validación en tests
  // (post-LEGACY-SIGN-REMOVE: -1 tabla, -3 índices)
  // (post-I-103.A1.0-D-1: +1 tabla, +4 índices)
  EXPECTED_TABLES: 12,  // era 11, +1 gh_contratacion_soportes (soportes por paso)
  EXPECTED_INDEXES: 43  // era 40, +3 idx_gh_soportes_*
                        // 3 contrataciones + 5 base_personal (era 4, +1 sede) + 1 gh_sedes
                        // + 4 vacaciones + 5 permisos + 4 documentos
                        // + 4 anuncios + 4 mensajes
                        // + 3 documentos_afiliaciones (📦760)
                        // + 3 templates (📦764)
                        // + 4 eventos_personal (I-103.A1.0-D-1)
};

