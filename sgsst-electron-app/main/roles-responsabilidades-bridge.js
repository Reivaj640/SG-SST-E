/**
 * main/roles-responsabilidades-bridge.js
 *
 * Bridge IPC para gestión del estándar 1.1.2 (Roles y Responsabilidades)
 * del SG-SST. Reemplaza el file viewer legacy con una vista de gestión
 * que cumple con Decreto 1072 de 2015 art. 2.2.4.6.8 y Resolución 0312/2019.
 *
 * Tablas (prefijo `roles_responsabilidades_`):
 *   - roles_responsabilidades_catalogo     (9 roles predefinidos + personalizados)
 *   - roles_responsabilidades_asignacion    (persona-rol por empresa)
 *   - roles_responsabilidades_divulgacion   (estado de aceptación por persona)
 */
'use strict';

const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const MOD = 'ROLES-RESP';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;

// ---------- Schema (idempotente) ----------
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS roles_responsabilidades_catalogo (
    id              TEXT PRIMARY KEY,
    codigo          TEXT NOT NULL,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    responsabilidades TEXT,
    autoridad       TEXT,
    rendicion_cuentas TEXT,
    base_legal      TEXT,
    obligatorio     INTEGER NOT NULL DEFAULT 1,
    orden           INTEGER NOT NULL DEFAULT 0,
    version         TEXT NOT NULL DEFAULT '2026-08-13.v2',
    activo          INTEGER NOT NULL DEFAULT 1,
    es_predefinido  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS roles_responsabilidades_asignacion (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id               TEXT NOT NULL,
    rol_id                   TEXT NOT NULL,
    persona_cedula           TEXT,
    persona_nombre           TEXT NOT NULL,
    persona_cargo            TEXT,
    fecha_asignacion         TEXT NOT NULL,
    fecha_vigencia_hasta     TEXT,
    documento_soporte_path   TEXT,
    creado_por               TEXT,
    creado_en                TEXT NOT NULL,
    actualizado_en           TEXT,
    activo                   INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_rr_asig_empresa ON roles_responsabilidades_asignacion(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_rr_asig_rol ON roles_responsabilidades_asignacion(rol_id);
  CREATE INDEX IF NOT EXISTS idx_rr_asig_cedula ON roles_responsabilidades_asignacion(persona_cedula);
  CREATE INDEX IF NOT EXISTS idx_rr_asig_activo ON roles_responsabilidades_asignacion(empresa_id, rol_id, activo);

  CREATE TABLE IF NOT EXISTS roles_responsabilidades_divulgacion (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id               TEXT NOT NULL,
    persona_cedula           TEXT NOT NULL,
    persona_nombre           TEXT NOT NULL,
    persona_cargo            TEXT,
    version_responsabilidades TEXT NOT NULL,
    estado                   TEXT NOT NULL CHECK(estado IN ('pendiente','aceptado','rechazado')),
    fecha_divulgacion        TEXT NOT NULL,
    fecha_aceptacion         TEXT,
    metodo                   TEXT NOT NULL DEFAULT 'app',
    ip                       TEXT,
    user_agent               TEXT,
    documento_soporte_path   TEXT,
    creado_en                TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rr_div_empresa ON roles_responsabilidades_divulgacion(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_rr_div_cedula ON roles_responsabilidades_divulgacion(persona_cedula);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_rr_div_per_version
    ON roles_responsabilidades_divulgacion(empresa_id, persona_cedula, version_responsabilidades);
`;

// ---------- Seed de los 8 roles predefinidos (basado en G-OD-006) ----------
// Extraído del Excel G-OD-006 "Matriz de roles, funciones y responsabilidades"
// (REV.02 Enero de 2018). 4 columnas: NIVEL, RESPONSABILIDADES, AUTORIDAD,
// RENDICION DE CUENTAS. Cumplen con Decreto 1072 de 2015 art. 2.2.4.6.8.
const SEED_CATALOGO = [
  { id: 'representantes-de-la-alta-direccion', codigo: '1.1.2.R1', nombre: 'REPRESENTANTES DE LA ALTA DIRECCION', obligatorio: 1, orden: 1,
    responsabilidades: '1. Definir y actualizar cuando sea necesario la política del Sistema de Gestion en Seguridad y Salud en el Trabajo\n2. Garantizar el cumplimiento de requisitos legales aplicables de acuerdo con la actividad económica de la organización\n3. Asegurar la disponibilidad de los recursos necesarios para el funcionamiento y optimo desarrollo del SGSST\n4. Nombrar el (los) Representantes de la Dirección para el Sistema Integral de Gestión Institucional\n5. Designar una persona en materia de Seguridad y Salud, que coordine y controle las actuaciones y mantenga informada a la organización de lo más significativo en esta materia.\n6. Establecer objetivos anuales de Prevención de Riesgos Laborales en coherencia con la política preventiva existente.\n7. Visitar periódicamente los lugares de trabajo para poder estimular comportamientos eficientes, detectar deficiencias y trasladar interés por su solución.\n8. Mostrar interés por los accidentes laborales acaecidos y por las medidas adoptadas para evitar su repetición.',
    autoridad: '1. Hacer cumplir lo definido en el documentos SG - SST\n2. Aprobar los recursos para el funcionamiento del SGSST\n3. Suspender cualquier actividad cuando en su desarrollo se determine el incumplimiento de normas legales vigentes y/o internas relacionadas con el SIGI\n4. Requerir informes de gestión a los líderes que participan en cada proceso, para hacer seguimiento de la gestión del SGSST',
    rendicion_cuentas: '1. Demostrar compromiso hacia la excelencia en asuntos de Seguridad y Salud en el Trabajo.\n2. Velar por el compromiso en Seguridad y Salud en el Trabajo de sus subordinados directos, y supervisión para que se haga lo mismo en los demás niveles jerárquicos.\n3. Participar activamente en acciones de reconocimiento y motivación por labores meritorias en Seguridad y salud en el Trabajo\n4. Cumplir con la ejecución de las inspecciones gerenciales y los comités.',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.8 + G-OD-006 v2 (Enero 2018)' },
  { id: 'jefes-de-area', codigo: '1.1.2.R2', nombre: 'JEFES DE AREA', obligatorio: 1, orden: 2,
    responsabilidades: '1. Conocer los avances, resultados, operación y efectividad de las acciones emprendidas en el SGSST\n2. Cumplir con los requisitos legales aplicables a cada uno de los procesos, seguridad y salud en el trabajo.\n3. Participar en la implementación del SGSST\n4. Cumplir y hacer cumplir los programas y planes establecidos del Sistema de Gestion en SST\n5. Mantener permanente retroalimentación de los procesos, planes y programas de su responsabilidad mediante la implementación de acciones correctivas, preventivas y de mejora.',
    autoridad: '1. Vigilar la implementación, mantenimiento y mejora del SGSST\n2. Revisar los proyectos para asignación de recursos para el funcionamiento del SGSST\n3. Suspender cualquier actividad cuando en su desarrollo se determine el incumplimiento de normas legales vigentes y/o internas relacionadas con el SGSST',
    rendicion_cuentas: 'Rinde cuentas al representante de la alta dirección  en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.8 + G-OD-006 v2 (Enero 2018)' },
  { id: 'trabajadores', codigo: '1.1.2.R3', nombre: 'TRABAJADORES', obligatorio: 1, orden: 3,
    responsabilidades: '1. Conocer la política y objetivos del SGSST,  e identificar cómo contribuye su trabajo al logro de la misma.\n2. Suministrar información clara, completa y veraz sobre su estado de salud\n3. Reportar inmediatamente todo incidente, accidente o presunta enfermedad laboral, así como condiciones y actos inseguros.\n4. Informar oportunamente al empleador o contratante acerca de los peligros y riesgos latentes en su sitio de trabajo\n5. Participar en las actividades de capacitación en seguridad y salud en el trabajo definido en el plan de capacitación del SG-SST\n6. Participar y contribuir al cumplimiento de los objetivos del Sistema de Gestión de la Seguridad y Salud en el Trabajo SG-SST',
    autoridad: '1. Reportar condiciones y actos inseguros\n2. Reportar una emergencia\n3. Elegir representantes de los comités\n4. Reportar incidentes, accidentes y presuntas enfermedades laborales al supervisor o jefe inmediato.\n5. Solicitar capacitaciones relacionadas con el SGSST',
    rendicion_cuentas: 'Rinde cuentas al representante de la alta dirección  y al líder de SST, a los Jefes en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.8 + G-OD-006 v2 (Enero 2018)' },
  { id: 'responsable-del-sg-sst', codigo: '1.1.2.R4', nombre: 'RESPONSABLE DEL SG SST', obligatorio: 1, orden: 4,
    responsabilidades: '1. Colaborar con la dirección de la empresa en la mejora de la acción preventiva.\n2. Promover y fomentar la cooperación de los trabajadores en la ejecución de la normativa sobre prevención de riesgos laborales\n3. Ser consultados por el empresario, con carácter previo a su ejecución, acerca de cualquier decisión que pudiera tener efecto sustancial sobre la seguridad y la salud de los trabajadores\n4. Ejercer una labor de vigilancia y control sobre el cumplimiento de la normativa de prevención de riesgos laborales',
    autoridad: '1. Suspender actividades que estén afectando la salud y seguridad del personal de la universidad.\n2. Requerir a los grupos y líderes de apoyo informes de gestión del componente SST.\n3. Solicitar informes de cumplimiento de las actividades propuestas en el componente de SST.\n4. Solicitar información como insumo para la actualización y evaluación de los requisitos legales aplicables y suscritos.\n5. Solicitar informes a los comités asociados al componente así como los líderes y grupos que le apoyan.\n6. Diseñar la documentación relacionada en la implementación del componente de SST.\n7. Verificar y hacer seguimiento a los indicadores de gestión del componente SST.\n8. Exigir el reporte oportuno de los accidentes de trabajo y enfermedades laborales.',
    rendicion_cuentas: 'Rinde cuentas al Representante de la Alta dirección en la implementación del SGSST  en los reportes de accidentes de trabajo, incidentes, enfermedades laborales, actos y condiciones inseguras, situaciones de emergencia y todas las demás actividades que se deriven de la gestión de la seguridad y salud en el trabajo',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.8 + G-OD-006 v2 (Enero 2018)' },
  { id: 'vigia-de-seguridad-y-salud-en-el-trabajo-copasst', codigo: '1.1.2.R5', nombre: 'VIGIA DE SEGURIDAD Y SALUD EN EL TRABAJO COPASST', obligatorio: 1, orden: 5,
    responsabilidades: '1. Participar activamente de todas las actividades que proponga el componente de seguridad y salud en el trabajo, ya sean actividades específicas o programas de gestión\n2. Vigilar el desarrollo de las actividades que en materia de medicina preventiva y del trabajo, higiene y seguridad industrial sean ejecutadas\n3. Promover el autocuidado y el reporte de condiciones y actos inseguros a todo el personal\n4. Dar cumplimiento a las políticas del SGSST, así como a las políticas complementarias.\n5. Participar activamente en las actividades de emergencias que se programen así como lo eventos que ocurran infortunadamente.',
    autoridad: '1. Solicitar informes de Gestión de Seguridad y Salud en el trabajo, para proponer acciones de mejora.\n2. Solicitar los reportes de incidentes laborales, para posterior participar en su investigación.\n3. Inspeccionar y tener acceso a todos los lugares de trabajo verificando las condiciones de seguridad.\n4. Hacer llamados de atención al personal  que este contradiciendo las normas de seguridad y salud en el trabajo.\n5. Suspender actividades que estén afectando la salud y seguridad del personal en el desarrollo de las actividades.',
    rendicion_cuentas: 'Rinde cuentas al representante de la alta dirección  y al líder de SST, a los Jefes en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.8 + G-OD-006 v2 (Enero 2018)' },
  { id: 'comite-de-convivencia-laboral', codigo: '1.1.2.R6', nombre: 'COMITÉ DE CONVIVENCIA LABORAL', obligatorio: 1, orden: 6,
    responsabilidades: '1. Propender por una adecuada convivencia laboral al interior de la organización.\n2. Realizar informes de gestión del Comité y remitirlos a los líderes del componente de seguridad y salud en el trabajo\n3. Dar cumplimiento a las políticas del SIG, así como a las políticas complementarias de cada uno de sus componentes.\n4. Mantener criterio éticos y de confidencialidad para el manejo de los casos tratados en el Comité\n5. Trabajar en equipo con el componente de seguridad y salud en el trabajo para la prevención del acoso  laboral y promoción de un buen clima laboral.',
    autoridad: '1. Realizar citaciones al personal involucrado en caso de presunto acoso laboral.\n2. Establecer medidas preventivas y correctivas en relación al acoso laboral.\n3. Solicitar evidencias que soporten las quejas de presunto acoso laboral.',
    rendicion_cuentas: 'Rinde cuentas al representante de la alta dirección  y al líder de SST, a los Jefes en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Ley 1010/2006 + Resolución 652/2006 + G-OD-006 v2' },
  { id: 'brigada-de-emergencias', codigo: '1.1.2.R7', nombre: 'BRIGADA DE EMERGENCIAS', obligatorio: 1, orden: 7,
    responsabilidades: '1. Dirigir de manera adecuada y ordenada la atención de la emergencia.\n2. Administrar, hacer seguimiento, mantenerlo actualizado y responder por los elementos de primeros auxilios que se encuentran en el botiquín\n3. Mantener actualizado al personal  de las rutas de evacuación, puntos de encuentro, sistema de alerta y alarma y demás contenidos del plan de emergencias.\n4. Participar en la evaluación de simulacros y en el establecimiento de planes de mejora.',
    autoridad: '1. Suspender actividades que estén afectando la salud y seguridad del personal en el desarrollo de las actividades.\n2. Solicitar datos del personal para el consolidado de información en caso de emergencia.\n3. Administrar los elementos que contiene el botiquín.\n4. Evacuar al personal en caso de emergencia.\n5. Direccionar el personal a cargo en el momento de una evacuación.\n6. Solicitar la participación de todo el personal en las actividades de emergencias programas como simulacros.\n7. Activar el sistema de alarma en caso de emergencia.',
    rendicion_cuentas: 'Rinde cuentas al representante de la alta dirección  y al líder de SST, a los Jefes en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.25 + G-OD-006 v2' },
  { id: 'contratistas', codigo: '1.1.2.R8', nombre: 'CONTRATISTAS', obligatorio: 1, orden: 8,
    responsabilidades: '1. Implementar un SG SST\n2. Asegurar las competencias de los trabajadores\n3. Cumplir las normas de seguridad y salud en el trabajo establecidas por el contratante\n4. Reportar actos y condiciones inseguras',
    autoridad: '1. Reportar condiciones y actos inseguros\n2. Reportar una emergencia\n3. Elegir representantes de los comités\n4. Reportar incidentes, accidentes y presuntas enfermedades laborales al supervisor o jefe inmediato.',
    rendicion_cuentas: 'Rinden cuentas al líder de SST y/o responsable del contrato, en caso de que se presenten incidentes, accidentes, enfermedades laborales, actos, condiciones inseguras y emergencias que puedan llegar a afectar la seguridad y salud de las personas en la ausencia o alteración de no ejecutar los procedimientos o los lineamientos definidos para el SGSST',
    base_legal: 'Decreto 1072 de 2015 art. 2.2.4.6.32 + G-OD-006 v2' }
];

const CATALOGO_VERSION = '2026-08-13.v2';

function _ensureSchemaMigrated(db) {
  if (!db) return;
  try {
    db.exec(SCHEMA_SQL);
  } catch (e) {
    console.error('[' + MOD + '] Error creando schema:', e.message);
  }
  // 📦705-fix (2026-08-14) — Migración idempotente de columnas.
  // El SEED del Excel G-OD-006 requiere 3 columnas nuevas
  // (responsabilidades, autoridad, rendicion_cuentas) que el SEED v1
  // no tenía. `CREATE TABLE IF NOT EXISTS` no agrega columnas a una
  // tabla existente, así que las detectamos con PRAGMA table_info y
  // las agregamos con ALTER TABLE ADD COLUMN (idempotente por el check).
  // Sin este fix, el INSERT OR IGNORE del SEED v2 falla silenciosamente
  // y el handler `_handlerListarCatalogo` revienta con "no such column"
  // → `cargarDatos()` se aborta → `renderBanner()` nunca corre → el
  // banner "Cargando..." persiste y las tablas quedan vacías.
  try {
    var colsInfo = db.prepare('PRAGMA table_info(roles_responsabilidades_catalogo)').all();
    var existingCols = new Set();
    colsInfo.forEach(function (c) { existingCols.add(c.name); });
    var requiredCols = [
      { name: 'responsabilidades', type: 'TEXT' },
      { name: 'autoridad', type: 'TEXT' },
      { name: 'rendicion_cuentas', type: 'TEXT' }
    ];
    requiredCols.forEach(function (col) {
      if (!existingCols.has(col.name)) {
        db.exec('ALTER TABLE roles_responsabilidades_catalogo ADD COLUMN ' + col.name + ' ' + col.type);
        console.log('[' + MOD + '][MIGRATION] Agregada columna ' + col.name);
      }
    });
  } catch (alterErr) {
    console.error('[' + MOD + '] Error en ALTER TABLE:', alterErr.message);
  }
  // Seed de los 8 roles predefinidos (idempotente por PRIMARY KEY)
  try {
    var insertStmt = db.prepare(`
      INSERT OR IGNORE INTO roles_responsabilidades_catalogo
        (id, codigo, nombre, descripcion, responsabilidades, autoridad, rendicion_cuentas,
         base_legal, obligatorio, orden, version, activo, es_predefinido)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `);
    var count = 0;
    SEED_CATALOGO.forEach(function (rol) {
      var result = insertStmt.run(
        rol.id, rol.codigo, rol.nombre, rol.descripcion || null,
        rol.responsabilidades || null, rol.autoridad || null, rol.rendicion_cuentas || null,
        rol.base_legal || null, rol.obligatorio, rol.orden, CATALOGO_VERSION
      );
      if (result.changes > 0) count++;
    });
    if (count > 0) {
      console.log('[📦705-DEBUG][' + MOD + '] Seed insertó ' + count + ' roles predefinidos');
    }
  } catch (seedErr) {
    console.error('[' + MOD + '] Error en seed del catálogo:', seedErr.message);
  }
  // Migración: desactivar roles viejos que NO están en el nuevo seed (G-OD-006).
  // Los roles del Decreto 1072 (representante-legal, responsable-sgsst, etc.) ya no
  // aplican — los del Excel G-OD-006 los reemplazan. Si el user ya tenía
  // asignaciones sobre los viejos roles, el handler de listar sigue trayéndolos
  // (porque hace JOIN con activo=1 solo en roles_responsabilidades_catalogo).
  // Los desactivamos para que la UI muestre solo los del Excel.
  try {
    var seedIds = SEED_CATALOGO.map(function (r) { return r.id; });
    var placeholders = seedIds.map(function () { return '?'; }).join(',');
    var deactResult = db.prepare(
      'UPDATE roles_responsabilidades_catalogo SET activo = 0 ' +
      'WHERE id NOT IN (' + placeholders + ') AND es_predefinido = 1'
    ).run.apply(null, seedIds);
    if (deactResult.changes > 0) {
      console.log('[📦705-DEBUG][' + MOD + '] Migración desactivó ' + deactResult.changes + ' roles viejos (fuera del G-OD-006)');
    }
  } catch (migErr) {
    console.error('[' + MOD + '] Error desactivando roles viejos:', migErr.message);
  }
}

// ---------- Handlers internos ----------

function _handlerListarCatalogo() {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  try {
    var db = _getDb();
    var rows = db.prepare(
      'SELECT id, codigo, nombre, descripcion, responsabilidades, autoridad, rendicion_cuentas, ' +
      'base_legal, obligatorio, orden, version, activo, es_predefinido ' +
      'FROM roles_responsabilidades_catalogo ' +
      'WHERE activo = 1 ' +
      'ORDER BY orden ASC, nombre ASC'
    ).all();
    return { success: true, data: rows };
  } catch (e) {
    console.error('[' + MOD + '][CATALOGO-LISTAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerCrearRol(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.id || !payload.nombre) {
    return { success: false, error: { code: 'VALIDATION', message: 'id y nombre son requeridos' } };
  }
  try {
    var db = _getDb();
    db.prepare(`
      INSERT INTO roles_responsabilidades_catalogo
        (id, codigo, nombre, descripcion, responsabilidades, autoridad, rendicion_cuentas,
         base_legal, obligatorio, orden, version, activo, es_predefinido)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(orden) + 1 FROM roles_responsabilidades_catalogo), 100), ?, 1, 0)
    `).run(
      payload.id, payload.codigo || payload.id, payload.nombre,
      payload.descripcion || null,
      payload.responsabilidades || null, payload.autoridad || null, payload.rendicion_cuentas || null,
      payload.base_legal || null, payload.obligatorio ? 1 : 0, CATALOGO_VERSION
    );
    return { success: true, data: { id: payload.id } };
  } catch (e) {
    console.error('[' + MOD + '][CATALOGO-CREAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerActualizarRol(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.id) {
    return { success: false, error: { code: 'VALIDATION', message: 'id es requerido' } };
  }
  try {
    var db = _getDb();
    var updates = [];
    var values = [];
    if (payload.nombre !== undefined) { updates.push('nombre = ?'); values.push(payload.nombre); }
    if (payload.descripcion !== undefined) { updates.push('descripcion = ?'); values.push(payload.descripcion || null); }
    if (payload.responsabilidades !== undefined) { updates.push('responsabilidades = ?'); values.push(payload.responsabilidades || null); }
    if (payload.autoridad !== undefined) { updates.push('autoridad = ?'); values.push(payload.autoridad || null); }
    if (payload.rendicion_cuentas !== undefined) { updates.push('rendicion_cuentas = ?'); values.push(payload.rendicion_cuentas || null); }
    if (payload.base_legal !== undefined) { updates.push('base_legal = ?'); values.push(payload.base_legal || null); }
    if (payload.obligatorio !== undefined) { updates.push('obligatorio = ?'); values.push(payload.obligatorio ? 1 : 0); }
    if (updates.length === 0) {
      return { success: true };
    }
    values.push(payload.id);
    db.prepare('UPDATE roles_responsabilidades_catalogo SET ' + updates.join(', ') + ' WHERE id = ?').run.apply(null, values);
    return { success: true };
  } catch (e) {
    console.error('[' + MOD + '][CATALOGO-ACTUALIZAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerDesactivarRol(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.id) {
    return { success: false, error: { code: 'VALIDATION', message: 'id es requerido' } };
  }
  try {
    var db = _getDb();
    db.prepare('UPDATE roles_responsabilidades_catalogo SET activo = 0 WHERE id = ?').run(payload.id);
    return { success: true };
  } catch (e) {
    console.error('[' + MOD + '][CATALOGO-DESACTIVAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerListarAsignaciones(empresaId) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId es requerido' } };
  }
  try {
    var db = _getDb();
    var rows = db.prepare(`
      SELECT a.id, a.empresa_id, a.rol_id, c.nombre AS rol_nombre, c.codigo AS rol_codigo,
             a.persona_cedula, a.persona_nombre, a.persona_cargo,
             a.fecha_asignacion, a.fecha_vigencia_hasta, a.documento_soporte_path,
             a.creado_por, a.creado_en, a.actualizado_en, a.activo
      FROM roles_responsabilidades_asignacion a
      JOIN roles_responsabilidades_catalogo c ON a.rol_id = c.id
      WHERE a.empresa_id = ? AND a.activo = 1
      ORDER BY c.orden ASC, a.creado_en ASC
    `).all(empresaId);
    return { success: true, data: rows };
  } catch (e) {
    console.error('[' + MOD + '][ASIGNACION-LISTAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerUpsertAsignacion(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.empresaId || !payload.rolId || !payload.personaNombre) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId, rolId y personaNombre son requeridos' } };
  }
  try {
    var db = _getDb();
    var now = new Date().toISOString();
    var fechaAsignacion = payload.fechaAsignacion || now;
    // Archivar la asignación activa anterior (si existe) para el mismo (empresa, rol)
    db.prepare(`
      UPDATE roles_responsabilidades_asignacion
      SET activo = 0, actualizado_en = ?
      WHERE empresa_id = ? AND rol_id = ? AND activo = 1
    `).run(now, payload.empresaId, payload.rolId);
    // Insertar la nueva
    var result = db.prepare(`
      INSERT INTO roles_responsabilidades_asignacion
        (empresa_id, rol_id, persona_cedula, persona_nombre, persona_cargo,
         fecha_asignacion, fecha_vigencia_hasta, documento_soporte_path,
         creado_por, creado_en, actualizado_en, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      payload.empresaId, payload.rolId,
      payload.personaCedula || null, payload.personaNombre, payload.personaCargo || null,
      fechaAsignacion, payload.fechaVigenciaHasta || null, payload.documentoSoportePath || null,
      payload.creadoPor || null, now, now
    );
    return { success: true, data: { id: result.lastInsertRowid } };
  } catch (e) {
    console.error('[' + MOD + '][ASIGNACION-UPSERT]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _calcularEstado(documentoSoportePath) {
  return documentoSoportePath && documentoSoportePath.trim() !== '' ? 'aceptado' : 'pendiente';
}

function _handlerListarDivulgaciones(empresaId) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId es requerido' } };
  }
  try {
    var db = _getDb();
    var rows = db.prepare(`
      SELECT id, empresa_id, persona_cedula, persona_nombre, persona_cargo,
             version_responsabilidades, estado, fecha_divulgacion, fecha_aceptacion,
             metodo, ip, user_agent, documento_soporte_path, creado_en,
             CASE WHEN documento_soporte_path IS NOT NULL AND TRIM(documento_soporte_path) != '' THEN 'aceptado' ELSE 'pendiente' END AS estado_calculado
      FROM roles_responsabilidades_divulgacion
      WHERE empresa_id = ?
      ORDER BY estado_calculado ASC, persona_nombre ASC
    `).all(empresaId);
    return { success: true, data: rows };
  } catch (e) {
    console.error('[' + MOD + '][DIVULGACION-LISTAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerUpsertDivulgacion(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.empresaId || !payload.personaCedula || !payload.personaNombre) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId, personaCedula y personaNombre son requeridos' } };
  }
  try {
    var db = _getDb();
    var now = new Date().toISOString();
    var version = payload.versionResponsabilidades || CATALOGO_VERSION;
    var fechaDivulgacion = payload.fechaDivulgacion || now;
    var estado = _calcularEstado(payload.documentoSoportePath);
    var fechaAceptacion = estado === 'aceptado' ? (payload.fechaAceptacion || now) : null;
    db.prepare(`
      INSERT INTO roles_responsabilidades_divulgacion
        (empresa_id, persona_cedula, persona_nombre, persona_cargo,
         version_responsabilidades, estado, fecha_divulgacion, fecha_aceptacion,
         metodo, ip, user_agent, documento_soporte_path, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'app', ?, ?, ?, ?)
      ON CONFLICT(empresa_id, persona_cedula, version_responsabilidades) DO UPDATE SET
        persona_nombre = excluded.persona_nombre,
        persona_cargo = excluded.persona_cargo,
        estado = excluded.estado,
        fecha_divulgacion = excluded.fecha_divulgacion,
        fecha_aceptacion = excluded.fecha_aceptacion,
        documento_soporte_path = excluded.documento_soporte_path
    `).run(
      payload.empresaId, payload.personaCedula, payload.personaNombre, payload.personaCargo || null,
      version, estado, fechaDivulgacion, fechaAceptacion,
      payload.ip || null, payload.userAgent || null, payload.documentoSoportePath || null, now
    );
    return { success: true, data: { estado: estado } };
  } catch (e) {
    console.error('[' + MOD + '][DIVULGACION-UPSERT]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

function _handlerEliminarDivulgacion(payload) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!payload || !payload.id) {
    return { success: false, error: { code: 'VALIDATION', message: 'id es requerido' } };
  }
  try {
    var db = _getDb();
    db.prepare('DELETE FROM roles_responsabilidades_divulgacion WHERE id = ?').run(payload.id);
    return { success: true };
  } catch (e) {
    console.error('[' + MOD + '][DIVULGACION-ELIMINAR]', e.message);
    return { success: false, error: { code: 'DB_ERROR', message: e.message } };
  }
}

// ---------- Generador de PDF ----------
// 📦705-fix8 (2026-08-14) — fs y path ya están importados arriba (líneas 16-17),
// no re-declararlos acá. Solo importamos pdf-lib que es la única dependencia nueva.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function _handlerGenerarReportePDF(empresaId, outputPath) {
  if (!_getDb) {
    return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
  }
  if (!empresaId) {
    return { success: false, error: { code: 'VALIDATION', message: 'empresaId es requerido' } };
  }
  if (!outputPath) {
    return { success: false, error: { code: 'VALIDATION', message: 'outputPath es requerido' } };
  }
  try {
    var db = _getDb();
    var asignaciones = db.prepare(`
      SELECT a.*, c.nombre AS rol_nombre, c.codigo AS rol_codigo
      FROM roles_responsabilidades_asignacion a
      JOIN roles_responsabilidades_catalogo c ON a.rol_id = c.id
      WHERE a.empresa_id = ? AND a.activo = 1
      ORDER BY c.orden
    `).all(empresaId);
    var divulgaciones = db.prepare(`
      SELECT *,
        CASE WHEN documento_soporte_path IS NOT NULL AND TRIM(documento_soporte_path) != '' THEN 'aceptado' ELSE 'pendiente' END AS estado_calculado
      FROM roles_responsabilidades_divulgacion
      WHERE empresa_id = ?
      ORDER BY estado_calculado ASC, persona_nombre
    `).all(empresaId);
    // Crear PDF con pdf-lib
    var pdfDoc = await PDFDocument.create();
    var font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    var fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    var black = rgb(0, 0, 0);
    var blue = rgb(0.09, 0.31, 0.65);
    var gray = rgb(0.45, 0.45, 0.45);
    // Página 1: Portada
    var page = pdfDoc.addPage();
    var y = 750;
    page.drawText('K+AIR · Reporte de Cumplimiento', { x: 50, y: y, size: 22, font: fontBold, color: blue });
    y -= 30;
    page.drawText('Estándar 1.1.2 Responsabilidades SG-SST', { x: 50, y: y, size: 14, font: font, color: black });
    y -= 20;
    page.drawText('Resolución 0312 de 2019 + Decreto 1072 de 2015 art. 2.2.4.6.8', { x: 50, y: y, size: 9, font: font, color: gray });
    y -= 50;
    page.drawText('Empresa: ' + empresaId, { x: 50, y: y, size: 12, font: fontBold });
    y -= 18;
    page.drawText('Fecha de generación: ' + new Date().toLocaleDateString('es-CO'), { x: 50, y: y, size: 10, font: font });
    y -= 25;
    var totalRolesOblig = divulgaciones.length === 0 ? 0 : 1; // simplificado
    var rolesAsignados = asignaciones.length;
    var trabAceptados = divulgaciones.filter(function(d) { return d.estado_calculado === 'aceptado'; }).length;
    var pctRoles = Math.min(100, Math.round((rolesAsignados / 9) * 100));
    var pctTrab = divulgaciones.length > 0 ? Math.round((trabAceptados / divulgaciones.length) * 100) : 0;
    var pctGlobal = Math.round((pctRoles + pctTrab) / 2);
    page.drawText('CUMPLIMIENTO', { x: 50, y: y, size: 10, font: fontBold, color: blue });
    y -= 16;
    page.drawText('Roles asignados: ' + rolesAsignados + '/9', { x: 50, y: y, size: 11, font: font });
    y -= 14;
    page.drawText('Trabajadores con soporte PDF: ' + trabAceptados + '/' + divulgaciones.length, { x: 50, y: y, size: 11, font: font });
    y -= 14;
    page.drawText('Cumplimiento global: ' + pctGlobal + '%', { x: 50, y: y, size: 11, font: fontBold, color: blue });
    y -= 30;
    page.drawText('Generado por: SG-SST Responsable', { x: 50, y: y, size: 9, font: font, color: gray });
    y -= 12;
    page.drawText('Timestamp: ' + new Date().toISOString(), { x: 50, y: y, size: 8, font: font, color: gray });
    // Página 2: Matriz
    page = pdfDoc.addPage();
    y = 750;
    page.drawText('Matriz de Roles', { x: 50, y: y, size: 16, font: fontBold, color: blue });
    y -= 30;
    if (asignaciones.length === 0) {
      page.drawText('No hay roles asignados todavía.', { x: 50, y: y, size: 11, font: font, color: gray });
    } else {
      asignaciones.forEach(function(a) {
        if (y < 100) { page = pdfDoc.addPage(); y = 750; }
        page.drawText('• ' + a.rol_codigo + ' — ' + a.rol_nombre, { x: 50, y: y, size: 11, font: fontBold });
        y -= 14;
        page.drawText('  Persona: ' + a.persona_nombre + ' (' + (a.persona_cedula || 'sin cédula') + ')', { x: 50, y: y, size: 9, font: font });
        y -= 12;
        page.drawText('  Cargo: ' + (a.persona_cargo || '—') + ' · Asignado: ' + (a.fecha_asignacion || '—').substring(0, 10), { x: 50, y: y, size: 9, font: font, color: gray });
        y -= 16;
      });
    }
    // Página 3: Divulgación
    page = pdfDoc.addPage();
    y = 750;
    page.drawText('Divulgación a Trabajadores', { x: 50, y: y, size: 16, font: fontBold, color: blue });
    y -= 30;
    if (divulgaciones.length === 0) {
      page.drawText('No hay divulgaciones registradas.', { x: 50, y: y, size: 11, font: font, color: gray });
    } else {
      divulgaciones.forEach(function(d) {
        if (y < 100) { page = pdfDoc.addPage(); y = 750; }
        var estadoTexto = d.estado_calculado === 'aceptado' ? '✓ Aceptado' : '⏳ Pendiente';
        page.drawText('• ' + d.persona_nombre + ' (' + d.persona_cedula + ') — ' + estadoTexto, { x: 50, y: y, size: 10, font: font });
        y -= 12;
        page.drawText('  Fecha divulgación: ' + (d.fecha_divulgacion || '—').substring(0, 10) + ' · Soporte: ' + (d.documento_soporte_path ? d.documento_soporte_path.split(/[\\/]/).pop() : '—'), { x: 50, y: y, size: 8, font: font, color: gray });
        y -= 14;
      });
    }
    // Guardar
    var bytes = await pdfDoc.save();
    var outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, bytes);
    return { success: true, data: { path: outputPath, bytes: bytes.length } };
  } catch (e) {
    console.error('[' + MOD + '][GENERAR-PDF]', e.message);
    return { success: false, error: { code: 'PDF_ERROR', message: e.message } };
  }
}

// 📦705-fix8 (2026-08-14) — File dialogs y copia de archivos para el modal
// "Subir soporte PDF" del submódulo 1.1.2.
// 📦705-fix9 (2026-08-14) — Usar BrowserWindow.fromWebContents(event.sender)
// como parent del dialog. Sin esto, el dialog se abría detrás del modal HTML
// y el user no lo veía, dando timeout en 10s sin posibilidad de interactuar.
function _getParentWindow(event) {
  try {
    return BrowserWindow.fromWebContents(event.sender) || null;
  } catch (e) {
    return null;
  }
}

async function _handlerSeleccionarArchivoOrigen(event) {
  try {
    var win = _getParentWindow(event);
    var dialogOpts = {
      title: 'Seleccionar PDF de soporte (acta de divulgación firmada)',
      properties: ['openFile'],
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    };
    var result = win
      ? await dialog.showOpenDialog(win, dialogOpts)
      : await dialog.showOpenDialog(dialogOpts);
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, error: { code: 'CANCELED', message: 'Selección cancelada' } };
    }
    var filePath = result.filePaths[0];
    var stats = null;
    try { stats = fs.statSync(filePath); } catch (e) { /* ignore */ }
    return {
      success: true,
      data: {
        path: filePath,
        filename: path.basename(filePath),
        bytes: stats ? stats.size : null
      }
    };
  } catch (e) {
    return { success: false, error: { code: 'DIALOG_ERROR', message: e.message } };
  }
}

async function _handlerSeleccionarCarpetaDestino(event, defaultPath) {
  try {
    var win = _getParentWindow(event);
    var dialogOpts = {
      title: 'Seleccionar carpeta destino donde se copiará el soporte',
      defaultPath: defaultPath || undefined,
      properties: ['openDirectory', 'createDirectory']
    };
    var result = win
      ? await dialog.showOpenDialog(win, dialogOpts)
      : await dialog.showOpenDialog(dialogOpts);
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, error: { code: 'CANCELED', message: 'Selección cancelada' } };
    }
    return { success: true, data: { path: result.filePaths[0] } };
  } catch (e) {
    return { success: false, error: { code: 'DIALOG_ERROR', message: e.message } };
  }
}

async function _handlerCopiarArchivo(origen, destino) {
  if (!origen || !destino) {
    return { success: false, error: { code: 'VALIDATION', message: 'origen y destino son requeridos' } };
  }
  try {
    if (!fs.existsSync(origen)) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'El archivo origen no existe: ' + origen } };
    }
    var destFinal = destino;
    var destStat = null;
    try { destStat = fs.statSync(destino); } catch (e) { /* ignore */ }
    if (destStat && destStat.isDirectory()) {
      // Si destino es una carpeta, le agregamos el nombre del archivo origen
      destFinal = path.join(destino, path.basename(origen));
    }
    // Si el archivo destino ya existe, le agregamos sufijo (1), (2), etc.
    if (fs.existsSync(destFinal)) {
      var ext = path.extname(destFinal);
      var base = destFinal.slice(0, -ext.length);
      var counter = 1;
      while (fs.existsSync(base + ' (' + counter + ')' + ext)) {
        counter++;
      }
      destFinal = base + ' (' + counter + ')' + ext;
    }
    fs.copyFileSync(origen, destFinal);
    var copiedStats = fs.statSync(destFinal);
    return {
      success: true,
      data: {
        path: destFinal,
        filename: path.basename(destFinal),
        bytes: copiedStats.size,
        originalName: path.basename(origen)
      }
    };
  } catch (e) {
    return { success: false, error: { code: 'COPY_ERROR', message: e.message } };
  }
}

// 📦705-fix10 (2026-08-14) — Descargar PDF soporte con save dialog nativo.
// Muestra un diálogo de "Guardar como..." y copia el archivo a la ruta elegida.
async function _handlerDescargarArchivo(event, sourcePath) {
  if (!sourcePath) {
    return { success: false, error: { code: 'VALIDATION', message: 'sourcePath es requerido' } };
  }
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'El archivo no existe: ' + sourcePath } };
    }
    var win = _getParentWindow(event);
    var filename = path.basename(sourcePath);
    var dialogOpts = {
      title: 'Guardar PDF de soporte como...',
      defaultPath: filename,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    };
    var result = win
      ? await dialog.showSaveDialog(win, dialogOpts)
      : await dialog.showSaveDialog(dialogOpts);
    if (result.canceled || !result.filePath) {
      return { success: false, error: { code: 'CANCELED', message: 'Descarga cancelada' } };
    }
    // Asegurar extensión .pdf
    var destPath = result.filePath;
    if (!destPath.toLowerCase().endsWith('.pdf')) destPath += '.pdf';
    // Si ya existe en el destino, agregar sufijo
    if (fs.existsSync(destPath)) {
      var ext = path.extname(destPath);
      var base = destPath.slice(0, -ext.length);
      var counter = 1;
      while (fs.existsSync(base + ' (' + counter + ')' + ext)) {
        counter++;
      }
      destPath = base + ' (' + counter + ')' + ext;
    }
    fs.copyFileSync(sourcePath, destPath);
    var stats = fs.statSync(destPath);
    return {
      success: true,
      data: {
        path: destPath,
        filename: path.basename(destPath),
        bytes: stats.size
      }
    };
  } catch (e) {
    return { success: false, error: { code: 'DOWNLOAD_ERROR', message: e.message } };
  }
}

// ---------- Registro de handlers IPC ----------

function registerRolesResponsabilidadesHandlers(app, deps) {
  _getDb = deps && deps.getDb ? deps.getDb : null;

  // Schema + seed
  if (_getDb) {
    try {
      _ensureSchemaMigrated(_getDb());
    } catch (e) {
      console.error('[' + MOD + '][MIGRATION] ' + e.message);
    }
  }

  console.log('[' + MOD + '][INIT][INFO] Registrando handlers de Roles y Responsabilidades...');

  ipcMain.handle('roles-resp:catalogo-listar', async function (event, payload) {
    try { return _handlerListarCatalogo(); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-CATALOGO-LISTAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:catalogo-crear', async function (event, payload) {
    try { return _handlerCrearRol(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-CATALOGO-CREAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:catalogo-actualizar', async function (event, payload) {
    try { return _handlerActualizarRol(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-CATALOGO-ACTUALIZAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:catalogo-desactivar', async function (event, payload) {
    try { return _handlerDesactivarRol(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-CATALOGO-DESACTIVAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:asignacion-listar', async function (event, payload) {
    try { return _handlerListarAsignaciones(payload && payload.empresaId); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ASIGNACION-LISTAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:asignacion-upsert', async function (event, payload) {
    try { return _handlerUpsertAsignacion(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ASIGNACION-UPSERT]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:divulgacion-listar', async function (event, payload) {
    try { return _handlerListarDivulgaciones(payload && payload.empresaId); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-DIVULGACION-LISTAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:divulgacion-upsert', async function (event, payload) {
    try { return _handlerUpsertDivulgacion(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-DIVULGACION-UPSERT]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:divulgacion-eliminar', async function (event, payload) {
    try { return _handlerEliminarDivulgacion(payload); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-DIVULGACION-ELIMINAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:reporte-pdf', async function (event, payload) {
    try { return await _handlerGenerarReportePDF(payload && payload.empresaId, payload && payload.outputPath); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-REPORTE-PDF]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  // 📦705-fix8 (2026-08-14) — File dialogs para drag&drop / examinar del modal
  // "Subir soporte PDF". Permiten al user seleccionar el PDF origen (drag&drop
  // o explorador) y la carpeta destino donde se va a copiar el soporte.
  // 📦705-fix9 (2026-08-14) — Pasamos el BrowserWindow como parent del dialog
  // para que tenga foco correcto (sino se abría detrás del modal HTML y daba
  // timeout sin que el user pudiera interactuar).
  ipcMain.handle('roles-resp:archivo-seleccionar-origen', async function (event, payload) {
    try { return await _handlerSeleccionarArchivoOrigen(event); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ARCHIVO-SEL-ORIGEN]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:archivo-seleccionar-destino', async function (event, payload) {
    try { return await _handlerSeleccionarCarpetaDestino(event, payload && payload.defaultPath); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ARCHIVO-SEL-DESTINO]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  ipcMain.handle('roles-resp:archivo-copiar', async function (event, payload) {
    try { return await _handlerCopiarArchivo(payload && payload.origen, payload && payload.destino); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ARCHIVO-COPIAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });
  // 📦705-fix10 (2026-08-14) — Descargar PDF de soporte
  ipcMain.handle('roles-resp:archivo-descargar', async function (event, payload) {
    try { return await _handlerDescargarArchivo(event, payload && payload.sourcePath); }
    catch (e) {
      console.error('[' + MOD + '][HANDLER-ARCHIVO-DESCARGAR]', e.message);
      return { success: false, error: { code: 'INTERNAL', message: e.message } };
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] 14 handlers de Roles y Responsabilidades registrados');
}

module.exports = {
  registerRolesResponsabilidadesHandlers: registerRolesResponsabilidadesHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  _handlerListarCatalogo: _handlerListarCatalogo,
  _handlerCrearRol: _handlerCrearRol,
  _handlerActualizarRol: _handlerActualizarRol,
  _handlerDesactivarRol: _handlerDesactivarRol,
  _handlerListarAsignaciones: _handlerListarAsignaciones,
  _handlerUpsertAsignacion: _handlerUpsertAsignacion,
  _handlerListarDivulgaciones: _handlerListarDivulgaciones,
  _handlerUpsertDivulgacion: _handlerUpsertDivulgacion,
  _handlerEliminarDivulgacion: _handlerEliminarDivulgacion,
  _handlerGenerarReportePDF: _handlerGenerarReportePDF
};
