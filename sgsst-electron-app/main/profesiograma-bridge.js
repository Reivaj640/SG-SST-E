/**
 * main/profesiograma-bridge.js
 *
 * Bridge IPC para el submódulo 3.1.3 Perfiles de cargo y Profesioma.
 * Implementa el modelo de datos del preview Next.js (10 entidades) en SQLite
 * con better-sqlite3, siguiendo el patrón de los otros bridges del K+AIR.
 *
 * Entidades (prefijo kp_ = K+AIR Profesiograma):
 *   - kp_profesiograma       (codigo, nombre, version, empresaId)
 *   - kp_grupo_ocupacional  (nombre, descripcion)
 *   - kp_cargo              (nombre, descripcion, peligrosRiesgos, grupoId, profId)
 *   - kp_tipo_examen        (nombre, categoria, orden)
 *   - kp_cargo_examen       (relacion cargo x tipoExamen con I/P/R)
 *   - kp_descripcion_prueba (tipoExamen, personalObjetivo, ingreso, periodico, retiro, referencia)
 *   - kp_recomendacion      (factorRiesgo, definicion, examenes, pruebasEspecificas, restricciones)
 *   - kp_altura_requisito   (actividadRiesgo, hallazgosLimitantes, paraclinicos, observaciones)
 *   - kp_vacuna             (nombre, recomendacion, esquema)
 *   - kp_vacunacion_cargo   (relacion cargo x vacuna, requerida)
 *
 * IPC handlers (prefijo profesiograma:):
 *   kpis, matriz
 *   cargos:list, cargos:get, cargos:save, cargos:delete
 *   tipo-examen:list, tipo-examen:save, tipo-examen:delete
 *   cargo-examen:list-by-cargo, cargo-examen:save, cargo-examen:delete
 *   pruebas:list, pruebas:save, pruebas:delete
 *   recomendaciones:list, recomendaciones:save, recomendaciones:delete
 *   vacunacion:list, vacunacion:save, vacunacion:delete
 *   alturas:list, alturas:save, alturas:delete
 *   grupo-ocupacional:list, grupo-ocupacional:save, grupo-ocupacional:delete
 *   import-excel (importa el Excel GI-FO-047 y carga los datos)
 *
 * Persistencia: SQLite (better-sqlite3) - la misma DB que usa el resto del K+AIR.
 */
'use strict';

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const MOD = 'PROFESIOGRAMA';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;
let _getCompanyRoot = null; // path a la carpeta de la empresa (para el import del Excel)

// ============================================================================
// SCHEMA SQL - 10 tablas (prefijo kp_ para evitar colisiones)
// ============================================================================
const SCHEMA_SQL = `
  -- Empresa (referencia, no la gestionamos nosotros: la maneja el sistema de empresas)
  CREATE TABLE IF NOT EXISTS kp_empresa (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    nit         TEXT,
    activa      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  -- Profesiograma (el documento principal, versionado)
  CREATE TABLE IF NOT EXISTS kp_profesiograma (
    id            TEXT PRIMARY KEY,
    codigo        TEXT UNIQUE NOT NULL,
    nombre        TEXT NOT NULL,
    version       TEXT DEFAULT '01',
    fecha_revision TEXT,
    empresa_id    TEXT,
    activo        INTEGER DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kp_profesiograma_empresa ON kp_profesiograma(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_kp_profesiograma_activo  ON kp_profesiograma(activo);

  -- GrupoOcupacional (agrupacion de cargos, ej: "DEPARTAMENTO DE RECREACION")
  CREATE TABLE IF NOT EXISTS kp_grupo_ocupacional (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kp_grupo_nombre ON kp_grupo_ocupacional(nombre);

  -- Cargo
  CREATE TABLE IF NOT EXISTS kp_cargo (
    id                  TEXT PRIMARY KEY,
    nombre              TEXT NOT NULL,
    descripcion         TEXT,
    peligros_riesgos    TEXT,
    grupo_ocupacional_id TEXT,
    profesiograma_id    TEXT NOT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    FOREIGN KEY (grupo_ocupacional_id) REFERENCES kp_grupo_ocupacional(id) ON DELETE SET NULL,
    FOREIGN KEY (profesiograma_id)      REFERENCES kp_profesiograma(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_kp_cargo_grupo ON kp_cargo(grupo_ocupacional_id);
  CREATE INDEX IF NOT EXISTS idx_kp_cargo_prof  ON kp_cargo(profesiograma_id);

  -- TipoExamen (20 tipos en 3 categorias: EVALUACION_MEDICA, PRUEBAS_COMPLEMENTARIAS, LABORATORIO)
  CREATE TABLE IF NOT EXISTS kp_tipo_examen (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    categoria   TEXT NOT NULL CHECK (categoria IN ('EVALUACION_MEDICA', 'PRUEBAS_COMPLEMENTARIAS', 'LABORATORIO')),
    descripcion TEXT,
    orden       INTEGER DEFAULT 0,
    activo      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kp_tipo_examen_orden ON kp_tipo_examen(orden);

  -- CargoExamen: relacion cargo x tipoExamen con flags I/P/R (ingreso, periodico, retiro)
  CREATE TABLE IF NOT EXISTS kp_cargo_examen (
    id            TEXT PRIMARY KEY,
    cargo_id      TEXT NOT NULL,
    tipo_examen_id TEXT NOT NULL,
    ingreso       INTEGER DEFAULT 0,
    periodico     INTEGER DEFAULT 0,
    retiro        INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    UNIQUE(cargo_id, tipo_examen_id),
    FOREIGN KEY (cargo_id)       REFERENCES kp_cargo(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_examen_id) REFERENCES kp_tipo_examen(id) ON DELETE CASCADE
  );

  -- DescripcionPrueba (detalle de cada tipo de examen)
  CREATE TABLE IF NOT EXISTS kp_descripcion_prueba (
    id                 TEXT PRIMARY KEY,
    tipo_examen        TEXT NOT NULL,
    personal_objetivo  TEXT,
    ingreso            TEXT,
    periodico          TEXT,
    retiro             TEXT,
    referencia         TEXT,
    orden              INTEGER DEFAULT 0,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kp_descripcion_tipo ON kp_descripcion_prueba(tipo_examen);

  -- Recomendacion (por factor de riesgo)
  CREATE TABLE IF NOT EXISTS kp_recomendacion (
    id                  TEXT PRIMARY KEY,
    factor_riesgo       TEXT NOT NULL,
    definicion          TEXT,
    examenes            TEXT,
    pruebas_especificas TEXT,
    restricciones       TEXT,
    orden               INTEGER DEFAULT 0,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
  );

  -- AlturaRequisito (requisitos para trabajo en alturas)
  CREATE TABLE IF NOT EXISTS kp_altura_requisito (
    id                   TEXT PRIMARY KEY,
    actividad_riesgo     TEXT NOT NULL,
    hallazgos_limitantes TEXT,
    paraclinicos         TEXT,
    observaciones        TEXT,
    orden                INTEGER DEFAULT 0,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  );

  -- Vacuna
  CREATE TABLE IF NOT EXISTS kp_vacuna (
    id            TEXT PRIMARY KEY,
    nombre        TEXT NOT NULL,
    recomendacion TEXT,
    esquema       TEXT,
    orden         INTEGER DEFAULT 0,
    activa        INTEGER DEFAULT 1,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_kp_vacuna_nombre ON kp_vacuna(nombre);

  -- VacunacionCargo: relacion cargo x vacuna
  CREATE TABLE IF NOT EXISTS kp_vacunacion_cargo (
    id          TEXT PRIMARY KEY,
    cargo_id    TEXT NOT NULL,
    vacuna_id   TEXT NOT NULL,
    requerida   INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE(cargo_id, vacuna_id),
    FOREIGN KEY (cargo_id)  REFERENCES kp_cargo(id) ON DELETE CASCADE,
    FOREIGN KEY (vacuna_id) REFERENCES kp_vacuna(id) ON DELETE CASCADE
  );
`;

// ============================================================================
// HELPERS - generadores de IDs y timestamps
// ============================================================================
function _genId() {
  // ID simple: timestamp + random. Suficiente para SQLite local.
  return 'kp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 8);
}

function _now() {
  return new Date().toISOString();
}

function _ok(data) {
  return { success: true, data: data };
}

function _err(code, message) {
  return { success: false, error: { code: code, message: message } };
}

function _db() {
  if (!_getDb) return null;
  try { return _getDb(); } catch (e) { return null; }
}

// ============================================================================
// HELPERS - extracción segura de strings desde celdas de Excel
// ============================================================================
function getStr(sheet, addr) {
  if (!sheet || !addr) return '';
  var cell = sheet[addr];
  if (!cell) return '';
  return String(cell.v == null ? '' : cell.v).trim();
}

// ============================================================================
// HANDLERS - KPIs y Matriz
// ============================================================================

/**
 * Devuelve los KPIs del dashboard principal:
 *   - totalCargos, totalGrupos, totalTiposExamen, totalVacunas
 *   - examenesIngreso, vacunacionesRequeridas
 */
function _handlerGetKpis() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var kpis = {};
    kpis.totalCargos = db.prepare('SELECT COUNT(*) as c FROM kp_cargo').get().c;
    kpis.totalGrupos = db.prepare('SELECT COUNT(*) as c FROM kp_grupo_ocupacional').get().c;
    kpis.totalTiposExamen = db.prepare('SELECT COUNT(*) as c FROM kp_tipo_examen WHERE activo = 1').get().c;
    kpis.totalVacunas = db.prepare('SELECT COUNT(*) as c FROM kp_vacuna WHERE activa = 1').get().c;
    kpis.examenesIngreso = db.prepare('SELECT COUNT(*) as c FROM kp_cargo_examen WHERE ingreso = 1').get().c;
    kpis.vacunacionesRequeridas = db.prepare('SELECT COUNT(*) as c FROM kp_vacunacion_cargo WHERE requerida = 1').get().c;
    return _ok(kpis);
  } catch (e) {
    console.error('[' + MOD + '][KPIS]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

/**
 * Devuelve la matriz completa: cargos + sus examenes (I/P/R) + tipos de examen.
 * Formato: { cargos: [...], tiposExamen: [...] }
 */
function _handlerGetMatriz() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var tiposExamen = db.prepare('SELECT id, nombre, categoria, orden FROM kp_tipo_examen WHERE activo = 1 ORDER BY orden').all();
    var cargos = db.prepare(`
      SELECT c.id, c.nombre, c.descripcion, c.peligros_riesgos,
             c.profesiograma_id, c.grupo_ocupacional_id,
             g.id as grupo_id, g.nombre as grupo_nombre
      FROM kp_cargo c
      LEFT JOIN kp_grupo_ocupacional g ON g.id = c.grupo_ocupacional_id
      ORDER BY g.nombre, c.nombre
    `).all();
    // Agrupar examenes por cargo
    var examenesByCargo = {};
    var rows = db.prepare(`
      SELECT cargo_id, tipo_examen_id, ingreso, periodico, retiro
      FROM kp_cargo_examen
    `).all();
    rows.forEach(function(r) {
      if (!examenesByCargo[r.cargo_id]) examenesByCargo[r.cargo_id] = [];
      examenesByCargo[r.cargo_id].push({
        tipoExamenId: r.tipo_examen_id,
        ingreso: !!r.ingreso,
        periodico: !!r.periodico,
        retiro: !!r.retiro
      });
    });
    cargos.forEach(function(c) {
      c.examenes = examenesByCargo[c.id] || [];
      c.grupoOcupacional = c.grupo_id ? { id: c.grupo_id, nombre: c.grupo_nombre } : null;
      delete c.grupo_id;
      delete c.grupo_nombre;
    });
    return _ok({ cargos: cargos, tiposExamen: tiposExamen });
  } catch (e) {
    console.error('[' + MOD + '][MATRIZ]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - CRUD Cargos
// ============================================================================

function _handlerListCargos() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare(`
      SELECT c.*, g.nombre as grupo_nombre
      FROM kp_cargo c
      LEFT JOIN kp_grupo_ocupacional g ON g.id = c.grupo_ocupacional_id
      ORDER BY g.nombre, c.nombre
    `).all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][CARGOS:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerGetCargo(cargoId) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!cargoId) return _err('VALIDATION', 'cargoId es requerido');
  try {
    var cargo = db.prepare(`
      SELECT c.*, g.nombre as grupo_nombre
      FROM kp_cargo c
      LEFT JOIN kp_grupo_ocupacional g ON g.id = c.grupo_ocupacional_id
      WHERE c.id = ?
    `).get(cargoId);
    if (!cargo) return _err('NOT_FOUND', 'Cargo no encontrado');
    cargo.examenes = db.prepare(`
      SELECT tipo_examen_id, ingreso, periodico, retiro
      FROM kp_cargo_examen WHERE cargo_id = ?
    `).all(cargoId);
    return _ok(cargo);
  } catch (e) {
    console.error('[' + MOD + '][CARGOS:GET]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveCargo(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload) return _err('VALIDATION', 'payload es requerido');
  var isNew = !payload.id;
  if (isNew) {
    // INSERT — requiere nombre y profesiogramaId
    if (!payload.nombre || !payload.profesiogramaId) {
      return _err('VALIDATION', 'nombre y profesiogramaId son requeridos para cargos nuevos');
    }
  } else {
    // UPDATE — al menos un campo de cargo O array de examenes
    var hasCargoField = !!(payload.nombre || payload.descripcion || payload.peligrosRiesgos || payload.grupoOcupacionalId);
    var hasExamenes = Array.isArray(payload.examenes);
    if (!hasCargoField && !hasExamenes) {
      return _err('VALIDATION', 'Debe proporcionar al menos un campo del cargo o un array de examenes');
    }
  }
  var hasFieldsToUpdate = !!(payload.nombre || payload.descripcion || payload.peligrosRiesgos || payload.grupoOcupacionalId);
  var hasExamenes = Array.isArray(payload.examenes);
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_cargo (id, nombre, descripcion, peligros_riesgos, grupo_ocupacional_id, profesiograma_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.nombre, payload.descripcion || null, payload.peligrosRiesgos || null,
            payload.grupoOcupacionalId || null, payload.profesiogramaId, now, now);
    } else if (hasFieldsToUpdate) {
      // Solo hacer UPDATE si hay campos de cargo para actualizar.
      // Si el payload es solo examenes, saltamos el UPDATE para no pisar el nombre a NULL.
      // Usamos COALESCE para preservar valores existentes cuando un campo no viene en el payload.
      db.prepare(`
        UPDATE kp_cargo
        SET nombre = COALESCE(?, nombre),
            descripcion = COALESCE(?, descripcion),
            peligros_riesgos = COALESCE(?, peligros_riesgos),
            grupo_ocupacional_id = COALESCE(?, grupo_ocupacional_id),
            updated_at = ?
        WHERE id = ?
      `).run(payload.nombre || null, payload.descripcion || null, payload.peligrosRiesgos || null,
            payload.grupoOcupacionalId || null, now, id);
    }
    // Guardar examenes del cargo (I/P/R) si vienen
    if (hasExamenes) {
      db.prepare('DELETE FROM kp_cargo_examen WHERE cargo_id = ?').run(id);
      var ins = db.prepare(`
        INSERT OR IGNORE INTO kp_cargo_examen (id, cargo_id, tipo_examen_id, ingreso, periodico, retiro, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      payload.examenes.forEach(function(e) {
        ins.run(_genId(), id, e.tipoExamenId, e.ingreso ? 1 : 0, e.periodico ? 1 : 0, e.retiro ? 1 : 0, now, now);
      });
    }
    return _ok({ id: id, created: isNew, examenesCount: hasExamenes ? payload.examenes.length : 0 });
  } catch (e) {
    console.error('[' + MOD + '][CARGOS:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteCargo(cargoId) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!cargoId) return _err('VALIDATION', 'cargoId es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_cargo WHERE id = ?').run(cargoId);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][CARGOS:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - CRUD TipoExamen
// ============================================================================

function _handlerListTipoExamen() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare('SELECT * FROM kp_tipo_examen ORDER BY orden, nombre').all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][TIPO-EXAMEN:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveTipoExamen(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.nombre || !payload.categoria) {
    return _err('VALIDATION', 'nombre y categoria son requeridos');
  }
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_tipo_examen (id, nombre, categoria, descripcion, orden, activo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.nombre, payload.categoria, payload.descripcion || null,
            payload.orden || 0, payload.activo !== false ? 1 : 0, now, now);
    } else {
      db.prepare(`
        UPDATE kp_tipo_examen
        SET nombre = ?, categoria = ?, descripcion = ?, orden = ?, activo = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.nombre, payload.categoria, payload.descripcion || null,
            payload.orden || 0, payload.activo !== false ? 1 : 0, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][TIPO-EXAMEN:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteTipoExamen(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_tipo_examen WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][TIPO-EXAMEN:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - Pruebas (DescripcionPrueba)
// ============================================================================

function _handlerListPruebas() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare('SELECT * FROM kp_descripcion_prueba ORDER BY orden, tipo_examen').all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][PRUEBAS:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSavePrueba(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.tipoExamen) return _err('VALIDATION', 'tipoExamen es requerido');
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_descripcion_prueba
          (id, tipo_examen, personal_objetivo, ingreso, periodico, retiro, referencia, orden, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.tipoExamen, payload.personalObjetivo || null,
            payload.ingreso || null, payload.periodico || null, payload.retiro || null,
            payload.referencia || null, payload.orden || 0, now, now);
    } else {
      db.prepare(`
        UPDATE kp_descripcion_prueba
        SET tipo_examen = ?, personal_objetivo = ?, ingreso = ?, periodico = ?, retiro = ?,
            referencia = ?, orden = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.tipoExamen, payload.personalObjetivo || null,
            payload.ingreso || null, payload.periodico || null, payload.retiro || null,
            payload.referencia || null, payload.orden || 0, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][PRUEBAS:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeletePrueba(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_descripcion_prueba WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][PRUEBAS:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - Recomendaciones
// ============================================================================

function _handlerListRecomendaciones() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare('SELECT * FROM kp_recomendacion ORDER BY orden, factor_riesgo').all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][REC:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveRecomendacion(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.factorRiesgo) return _err('VALIDATION', 'factorRiesgo es requerido');
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_recomendacion
          (id, factor_riesgo, definicion, examenes, pruebas_especificas, restricciones, orden, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.factorRiesgo, payload.definicion || null, payload.examenes || null,
            payload.pruebasEspecificas || null, payload.restricciones || null,
            payload.orden || 0, now, now);
    } else {
      db.prepare(`
        UPDATE kp_recomendacion
        SET factor_riesgo = ?, definicion = ?, examenes = ?, pruebas_especificas = ?,
            restricciones = ?, orden = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.factorRiesgo, payload.definicion || null, payload.examenes || null,
            payload.pruebasEspecificas || null, payload.restricciones || null,
            payload.orden || 0, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][REC:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteRecomendacion(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_recomendacion WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][REC:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - Vacunas
// ============================================================================

function _handlerListVacunas() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var vacunas = db.prepare('SELECT * FROM kp_vacuna WHERE activa = 1 ORDER BY orden, nombre').all();
    var asignaciones = db.prepare(`
      SELECT vc.id, vc.cargo_id, vc.vacuna_id, vc.requerida
      FROM kp_vacunacion_cargo vc
    `).all();
    return _ok({ vacunas: vacunas, asignaciones: asignaciones });
  } catch (e) {
    console.error('[' + MOD + '][VAC:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveVacuna(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.nombre) return _err('VALIDATION', 'nombre es requerido');
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_vacuna (id, nombre, recomendacion, esquema, orden, activa, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.nombre, payload.recomendacion || null, payload.esquema || null,
            payload.orden || 0, payload.activa !== false ? 1 : 0, now, now);
    } else {
      db.prepare(`
        UPDATE kp_vacuna
        SET nombre = ?, recomendacion = ?, esquema = ?, orden = ?, activa = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.nombre, payload.recomendacion || null, payload.esquema || null,
            payload.orden || 0, payload.activa !== false ? 1 : 0, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][VAC:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteVacuna(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_vacuna WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][VAC:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - Alturas
// ============================================================================

function _handlerListAlturas() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare('SELECT * FROM kp_altura_requisito ORDER BY orden, actividad_riesgo').all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][ALT:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveAltura(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.actividadRiesgo) return _err('VALIDATION', 'actividadRiesgo es requerido');
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_altura_requisito
          (id, actividad_riesgo, hallazgos_limitantes, paraclinicos, observaciones, orden, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, payload.actividadRiesgo, payload.hallazgosLimitantes || null,
            payload.paraclinicos || null, payload.observaciones || null,
            payload.orden || 0, now, now);
    } else {
      db.prepare(`
        UPDATE kp_altura_requisito
        SET actividad_riesgo = ?, hallazgos_limitantes = ?, paraclinicos = ?,
            observaciones = ?, orden = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.actividadRiesgo, payload.hallazgosLimitantes || null,
            payload.paraclinicos || null, payload.observaciones || null,
            payload.orden || 0, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][ALT:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteAltura(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_altura_requisito WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][ALT:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLERS - GrupoOcupacional
// ============================================================================

function _handlerListGrupos() {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  try {
    var rows = db.prepare('SELECT * FROM kp_grupo_ocupacional ORDER BY nombre').all();
    return _ok(rows);
  } catch (e) {
    console.error('[' + MOD + '][GRUPOS:LIST]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerSaveGrupo(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.nombre) return _err('VALIDATION', 'nombre es requerido');
  try {
    var now = _now();
    var isNew = !payload.id;
    var id = payload.id || _genId();
    if (isNew) {
      db.prepare(`
        INSERT INTO kp_grupo_ocupacional (id, nombre, descripcion, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, payload.nombre, payload.descripcion || null, now, now);
    } else {
      db.prepare(`
        UPDATE kp_grupo_ocupacional SET nombre = ?, descripcion = ?, updated_at = ?
        WHERE id = ?
      `).run(payload.nombre, payload.descripcion || null, now, id);
    }
    return _ok({ id: id, created: isNew });
  } catch (e) {
    console.error('[' + MOD + '][GRUPOS:SAVE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

function _handlerDeleteGrupo(id) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!id) return _err('VALIDATION', 'id es requerido');
  try {
    var result = db.prepare('DELETE FROM kp_grupo_ocupacional WHERE id = ?').run(id);
    return _ok({ deleted: result.changes > 0 });
  } catch (e) {
    console.error('[' + MOD + '][GRUPOS:DELETE]', e.message);
    return _err('DB_ERROR', e.message);
  }
}

// ============================================================================
// HANDLER - Importar Excel GI-FO-047
// ============================================================================

/**
 * Importa un Excel GI-FO-047 y carga todos los datos en la BD.
 * payload: { filePath: string, profesiogramaId: string, empresaId?: string }
 *
 * El Excel tiene 8 hojas:
 *  1. PRESENTACION (info, no se importa)
 *  2. INSTRUCTIVO (info, no se importa)
 *  3. MATRIZ EXAMENES (37x64) - CARGOS + cargo_examen
 *  4. DESCRIPCION DE LAS PRUEBAS (20x10) - descripcion_prueba
 *  5. RECOMENDACIONES (23x14) - recomendacion
 *  6. ALTURAS (11x8) - altura_requisito
 *  7. VACUNACION TRABAJADORES (54x11) - vacuna + vacunacion_cargo
 *  8. ESQUEMA INMUNIZACION (11x3) - vacuna (info adicional)
 */
function _handlerImportExcel(payload) {
  if (!payload || !payload.filePath) {
    return _err('VALIDATION', 'filePath es requerido');
  }
  if (!fs.existsSync(payload.filePath)) {
    return _err('FILE_NOT_FOUND', 'Archivo no encontrado: ' + payload.filePath);
  }

  var XLSX;
  try {
    XLSX = require('xlsx');
  } catch (e) {
    return _err('NO_XLSX', 'Modulo xlsx no disponible: ' + e.message);
  }

  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');

  try {
    var wb = XLSX.readFile(payload.filePath);

    // Aliases locales (declarados ANTES de cualquier uso)
    var now = _now();
    var genId = _genId;

    // Si no se pasa profesiogramaId, crear (o reutilizar) el profesiograma por defecto
    var profesiogramaId = payload.profesiogramaId;
    if (!profesiogramaId) {
      var existing = db.prepare("SELECT id FROM kp_profesiograma WHERE codigo = 'DEFAULT' LIMIT 1").get();
      if (existing) {
        profesiogramaId = existing.id;
      } else {
        profesiogramaId = genId();
        db.prepare(`
          INSERT INTO kp_profesiograma (id, codigo, nombre, version, fecha_revision, activo, created_at, updated_at)
          VALUES (?, 'DEFAULT', 'Profesiograma Principal', '01', ?, 1, ?, ?)
        `).run(profesiogramaId, now, now, now);
      }
    }

    var stats = {
      grupos: 0, cargos: 0, tiposExamen: 0, cargoExamen: 0,
      descripcionPruebas: 0, recomendaciones: 0,
      alturas: 0, vacunas: 0, vacunacionCargo: 0
    };

    db.exec('BEGIN TRANSACTION');

    // Mapeo de grupos para evitar duplicados
    var grupoMap = {};
    db.prepare('SELECT id, nombre FROM kp_grupo_ocupacional').all().forEach(function(g) {
      grupoMap[g.nombre] = g.id;
    });

    // Mapeo de tipos de examen
    var tipoExamenMap = {};
    db.prepare('SELECT id, nombre FROM kp_tipo_examen').all().forEach(function(t) {
      tipoExamenMap[t.nombre] = t.id;
    });

    // Mapeo de cargos
    var cargoMap = {};
    db.prepare('SELECT id, nombre FROM kp_cargo WHERE profesiograma_id = ?').all(profesiogramaId).forEach(function(c) {
      cargoMap[c.nombre] = c.id;
    });

    // Mapeo de vacunas
    var vacunaMap = {};
    db.prepare('SELECT id, nombre FROM kp_vacuna').all().forEach(function(v) {
      vacunaMap[v.nombre] = v.id;
    });

    // 1) MATRIZ EXAMENES - extraer grupos, cargos y examenes
    // Estructura del Excel:
    //   Filas 1-6: headers varios (PROCESO DE GESTION, GI-FO-047, etc)
    //   Fila 7:    titulos de las 3 categorias (EVALUACION MEDICA, PRUEBAS, LABORATORIO)
    //   Fila 8:    headers de columnas: GRUPO OCUPACIONAL | CARGO | DESCRIPCION | PELIGROS | EXAMEN FISICO (3 cols) | ...
    //   Filas 9+: datos de cargos
    var matriz = wb.Sheets['MATRIZ EXAMENES'];
    if (matriz && matriz['!ref']) {
      var range = XLSX.utils.decode_range(matriz['!ref']);
      // 1.a) Detectar la fila de headers (fila donde col 0 = "GRUPO OCUPACIONAL")
      var headerRowIdx = -1;
      for (var hr = 0; hr <= range.e.r; hr++) {
        var c0 = getStr(matriz, XLSX.utils.encode_cell({r: hr, c: 0})).toLowerCase();
        if (c0.indexOf('grupo') >= 0 && c0.indexOf('ocupacional') >= 0) {
          headerRowIdx = hr;
          break;
        }
      }
      if (headerRowIdx < 0) {
        console.warn('[' + MOD + '][IMPORT-EXCEL] No se encontro fila de headers en MATRIZ EXAMENES');
      } else {
        // 1.b) Detectar tipos de examen en la fila de headers (cols 4+)
        //   y mapear la categoria desde la fila 7
        var tiposExamenCols = [];
        var currentCategoria = 'EVALUACION_MEDICA';
        for (var c = 4; c <= range.e.c; c++) {
          var tipoCellAddr = XLSX.utils.encode_cell({r: headerRowIdx, c: c});
          var tipoCellVal = getStr(matriz, tipoCellAddr);
          // Saltar celdas vacias o que son parte de la columna I/P/R (no son tipos, son sub-cols)
          if (!tipoCellVal) continue;
          // Si la celda tiene valor, es un tipo de examen
          // Verificar si hay categoria en la fila 7 (header de categoria)
          var catCellAddr = XLSX.utils.encode_cell({r: 6, c: c});
          var catCellVal = getStr(matriz, catCellAddr).toUpperCase();
          if (catCellVal.indexOf('EVALUACION') >= 0 || catCellVal.indexOf('EVALUACI') >= 0) {
            currentCategoria = 'EVALUACION_MEDICA';
          } else if (catCellVal.indexOf('PRUEBAS') >= 0) {
            currentCategoria = 'PRUEBAS_COMPLEMENTARIAS';
          } else if (catCellVal.indexOf('LABORATORIO') >= 0) {
            currentCategoria = 'LABORATORIO';
          }
          tiposExamenCols.push({ nombre: tipoCellVal, col: c, categoria: currentCategoria });
        }

        // 1.c) Crear tipos de examen si no existen
        tiposExamenCols.forEach(function(t, idx) {
          if (!tipoExamenMap[t.nombre]) {
            var newId = genId();
            db.prepare(`
              INSERT INTO kp_tipo_examen (id, nombre, categoria, orden, activo, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?)
            `).run(newId, t.nombre, t.categoria, idx + 1, now, now);
            tipoExamenMap[t.nombre] = newId;
            stats.tiposExamen++;
          }
        });

        // 1.d) Recorrer filas de datos (despues de headerRowIdx)
        for (var rr = headerRowIdx + 1; rr <= range.e.r; rr++) {
          var grupoCell = matriz[XLSX.utils.encode_cell({r: rr, c: 0})];
          var nombreCell = matriz[XLSX.utils.encode_cell({r: rr, c: 1})];
          if (!grupoCell || !nombreCell) continue;
          var grupoNombre = String(grupoCell.v || '').trim();
          var cargoNombre = String(nombreCell.v || '').trim();
          if (!grupoNombre || !cargoNombre) continue;
          // Filtrar headers obvios que pueden aparecer en esta zona
          var grupoLower = grupoNombre.toLowerCase();
          if (grupoLower.indexOf('grupo') >= 0 && grupoLower.indexOf('ocupacional') >= 0) continue;
          if (grupoLower.indexOf('proceso') >= 0) continue;
          if (grupoLower.indexOf('total') >= 0) continue;
          // Filtrar filas de convencion I/P/R (NO son cargos reales, son solo referencias de columnas)
          // Estas filas tienen grupo="I"/"P"/"R" (1 letra) y cargo="Inicial"/"Periodico"/"Retiro"
          if (grupoLower === 'i' || grupoLower === 'p' || grupoLower === 'r') continue;
          var cargoLower = cargoNombre.toLowerCase();
          if (cargoLower === 'inicial' || cargoLower === 'periodico' || cargoLower === 'retiro') continue;
          // El cargo debe tener contenido real
          if (cargoNombre.length < 3) continue;

          // Crear grupo si no existe
          if (!grupoMap[grupoNombre]) {
            var gid = genId();
            db.prepare(`
              INSERT INTO kp_grupo_ocupacional (id, nombre, created_at, updated_at)
              VALUES (?, ?, ?, ?)
            `).run(gid, grupoNombre, now, now);
            grupoMap[grupoNombre] = gid;
            stats.grupos++;
          }

          // Crear cargo si no existe
          var descCell = matriz[XLSX.utils.encode_cell({r: rr, c: 2})];
          var riesgoCell = matriz[XLSX.utils.encode_cell({r: rr, c: 3})];
          if (!cargoMap[cargoNombre]) {
            var cid = genId();
            db.prepare(`
              INSERT INTO kp_cargo (id, nombre, descripcion, peligros_riesgos, grupo_ocupacional_id, profesiograma_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(cid, cargoNombre, descCell ? String(descCell.v || '') : null,
                  riesgoCell ? String(riesgoCell.v || '') : null,
                  grupoMap[grupoNombre], profesiogramaId, now, now);
            cargoMap[cargoNombre] = cid;
            stats.cargos++;
          }

          // Crear examenes (I/P/R) para este cargo
          // Asumimos 3 columnas por tipo: I, P, R
          tiposExamenCols.forEach(function(t) {
            var iCell = matriz[XLSX.utils.encode_cell({r: rr, c: t.col})];
            var pCell = matriz[XLSX.utils.encode_cell({r: rr, c: t.col + 1})];
            var rCell = matriz[XLSX.utils.encode_cell({r: rr, c: t.col + 2})];
            // Considerar "X" o cualquier valor no vacio como TRUE
            var isI = iCell && String(iCell.v || '').trim().length > 0;
            var isP = pCell && String(pCell.v || '').trim().length > 0;
            var isR = rCell && String(rCell.v || '').trim().length > 0;
            if (isI || isP || isR) {
              db.prepare(`
                INSERT OR IGNORE INTO kp_cargo_examen
                  (id, cargo_id, tipo_examen_id, ingreso, periodico, retiro, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).run(genId(), cargoMap[cargoNombre], tipoExamenMap[t.nombre],
                    isI ? 1 : 0, isP ? 1 : 0, isR ? 1 : 0, now, now);
              stats.cargoExamen++;
            }
          });
        }
      }
    }

    // 2) DESCRIPCION DE LAS PRUEBAS
    var desc = wb.Sheets['DESCRIPCION DE LAS PRUEBAS'];
    if (desc && desc['!ref']) {
      var drange = XLSX.utils.decode_range(desc['!ref']);
      // Estructura esperada: [TIPO EXAMEN | PERSONAL OBJETIVO | INGRESO | PERIODICO | RETIRO | REFERENCIA]
      for (var dr = 0; dr <= drange.e.r; dr++) {
        var tipoCell = desc[XLSX.utils.encode_cell({r: dr, c: 0})];
        if (!tipoCell || !tipoCell.v) continue;
        var tipoNombre = String(tipoCell.v || '').trim();
        if (!tipoNombre || tipoNombre.length < 3) continue;

        var personal = desc[XLSX.utils.encode_cell({r: dr, c: 1})];
        var ingresoD = desc[XLSX.utils.encode_cell({r: dr, c: 2})];
        var periodicoD = desc[XLSX.utils.encode_cell({r: dr, c: 3})];
        var retiroD = desc[XLSX.utils.encode_cell({r: dr, c: 4})];
        var refD = desc[XLSX.utils.encode_cell({r: dr, c: 5})];

        db.prepare(`
          INSERT INTO kp_descripcion_prueba
            (id, tipo_examen, personal_objetivo, ingreso, periodico, retiro, referencia, orden, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(genId(), tipoNombre,
              personal ? String(personal.v || '') : null,
              ingresoD ? String(ingresoD.v || '') : null,
              periodicoD ? String(periodicoD.v || '') : null,
              retiroD ? String(retiroD.v || '') : null,
              refD ? String(refD.v || '') : null,
              dr + 1, now, now);
        stats.descripcionPruebas++;
      }
    }

    // 3) RECOMENDACIONES
    var recs = wb.Sheets['RECOMENDACIONES'];
    if (recs && recs['!ref']) {
      var rrange = XLSX.utils.decode_range(recs['!ref']);
      for (var recR = 0; recR <= rrange.e.r; recR++) {
        var frCell = recs[XLSX.utils.encode_cell({r: recR, c: 0})];
        if (!frCell || !frCell.v) continue;
        var factorRiesgo = String(frCell.v || '').trim();
        if (!factorRiesgo || factorRiesgo.length < 3) continue;

        var defR = recs[XLSX.utils.encode_cell({r: recR, c: 1})];
        var examR = recs[XLSX.utils.encode_cell({r: recR, c: 2})];
        var pruR = recs[XLSX.utils.encode_cell({r: recR, c: 3})];
        var restR = recs[XLSX.utils.encode_cell({r: recR, c: 4})];

        db.prepare(`
          INSERT INTO kp_recomendacion
            (id, factor_riesgo, definicion, examenes, pruebas_especificas, restricciones, orden, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(genId(), factorRiesgo,
              defR ? String(defR.v || '') : null,
              examR ? String(examR.v || '') : null,
              pruR ? String(pruR.v || '') : null,
              restR ? String(restR.v || '') : null,
              recR + 1, now, now);
        stats.recomendaciones++;
      }
    }

    // 4) ALTURAS
    var alturas = wb.Sheets['ALTURAS'];
    if (alturas && alturas['!ref']) {
      var arange = XLSX.utils.decode_range(alturas['!ref']);
      for (var ar = 0; ar <= arange.e.r; ar++) {
        var actCell = alturas[XLSX.utils.encode_cell({r: ar, c: 0})];
        if (!actCell || !actCell.v) continue;
        var actRiesgo = String(actCell.v || '').trim();
        if (!actRiesgo || actRiesgo.length < 3) continue;

        var hallA = alturas[XLSX.utils.encode_cell({r: ar, c: 1})];
        var paraA = alturas[XLSX.utils.encode_cell({r: ar, c: 2})];
        var obsA = alturas[XLSX.utils.encode_cell({r: ar, c: 3})];

        db.prepare(`
          INSERT INTO kp_altura_requisito
            (id, actividad_riesgo, hallazgos_limitantes, paraclinicos, observaciones, orden, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(genId(), actRiesgo,
              hallA ? String(hallA.v || '') : null,
              paraA ? String(paraA.v || '') : null,
              obsA ? String(obsA.v || '') : null,
              ar + 1, now, now);
        stats.alturas++;
      }
    }

    // 5) VACUNAS - usar la hoja "ESQUEMA INMUNIZACION" (fuente limpia)
    //    Estructura: [VACUNA | RECOMENDACIÓN | ESQUEMA] con header en fila 6 (o donde aparezca VACUNA)
    //    La hoja "VACUNACIÓN TRABAJADORES" tiene las vacunas como columnas de cruce
    //    con cargos, pero es más complejo; usamos la fuente canónica.
    var esq = wb.Sheets['ESQUEMA INMUNIZACION'];
    if (esq && esq['!ref']) {
      var erange = XLSX.utils.decode_range(esq['!ref']);
      // Detectar fila de headers buscando "VACUNA" en col 0
      var eHeaderRow = -1;
      for (var ehr = 0; ehr <= erange.e.r; ehr++) {
        var e0 = getStr(esq, XLSX.utils.encode_cell({r: ehr, c: 0})).toUpperCase();
        if (e0 === 'VACUNA' || e0.indexOf('VACUNA') === 0) {
          eHeaderRow = ehr;
          break;
        }
      }
      if (eHeaderRow < 0) eHeaderRow = 6; // fallback
      // Leer vacunas desde fila eHeaderRow+1
      for (var er = eHeaderRow + 1; er <= erange.e.r; er++) {
        var nombreCell = esq[XLSX.utils.encode_cell({r: er, c: 0})];
        if (!nombreCell || !nombreCell.v) continue;
        var nombreVacuna = String(nombreCell.v || '').trim();
        if (!nombreVacuna || nombreVacuna.length < 3) continue;
        if (vacunaMap[nombreVacuna]) continue; // ya existe
        var recCell = esq[XLSX.utils.encode_cell({r: er, c: 1})];
        var esqCell = esq[XLSX.utils.encode_cell({r: er, c: 2})];
        db.prepare(`
          INSERT INTO kp_vacuna (id, nombre, recomendacion, esquema, orden, activa, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `).run(genId(), nombreVacuna,
              recCell ? String(recCell.v || '') : null,
              esqCell ? String(esqCell.v || '') : null,
              stats.vacunas + 1, now, now);
        vacunaMap[nombreVacuna] = genId();
        stats.vacunas++;
      }
    }

    // 5b) VACUNACIÓN TRABAJADORES - crea asignaciones cargo-vacuna (no implementada aún)
    //     Esta hoja cruza cada cargo con cada vacuna, pero su estructura es:
    //     - Primeras 9 filas vacías
    //     - Fila 9: header con nombres de vacunas (cols 4-10)
    //     - Filas 10+: cargos (col 0) + SI/NO por cada vacuna
    //     Por ahora solo se importan las vacunas desde ESQUEMA INMUNIZACION.
    //     TODO futuro: parsear las asignaciones cargo-vacuna.

    db.exec('COMMIT');

    console.log('[' + MOD + '][IMPORT-EXCEL] Exito:', JSON.stringify(stats));
    return _ok({ imported: true, stats: stats, profesiogramaId: profesiogramaId, cargos: stats.cargos });
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error('[' + MOD + '][IMPORT-EXCEL]', e.message);
    return _err('IMPORT_ERROR', e.message);
  }
}

// ============================================================================
// HANDLER - Exportar a Excel
// ============================================================================
function _handlerExportExcel(payload) {
  var db = _db();
  if (!db) return _err('NO_DB', 'Base de datos no disponible');
  if (!payload || !payload.filePath) {
    return _err('VALIDATION', 'filePath es requerido');
  }

  var XLSX;
  try {
    XLSX = require('xlsx');
  } catch (e) {
    return _err('NO_XLSX', 'Modulo xlsx no disponible: ' + e.message);
  }

  try {
    // Cargar toda la data de la DB
    var grupos = db.prepare('SELECT * FROM kp_grupo_ocupacional ORDER BY nombre').all();
    var tipos = db.prepare('SELECT * FROM kp_tipo_examen WHERE activo = 1 ORDER BY orden, nombre').all();
    var cargos = db.prepare(`
      SELECT c.*, g.nombre as grupo_nombre
      FROM kp_cargo c
      LEFT JOIN kp_grupo_ocupacional g ON g.id = c.grupo_ocupacional_id
      ORDER BY g.nombre, c.nombre
    `).all();
    var cargoExamen = db.prepare(`
      SELECT cargo_id, tipo_examen_id, ingreso, periodico, retiro
      FROM kp_cargo_examen
    `).all();
    var descripcionPruebas = db.prepare('SELECT * FROM kp_descripcion_prueba ORDER BY orden, tipo_examen').all();
    var recomendaciones = db.prepare('SELECT * FROM kp_recomendacion ORDER BY orden, factor_riesgo').all();
    var alturas = db.prepare('SELECT * FROM kp_altura_requisito ORDER BY orden, actividad_riesgo').all();
    var vacunas = db.prepare('SELECT * FROM kp_vacuna WHERE activa = 1 ORDER BY orden, nombre').all();

    // Armar la matriz como map cargo_id -> tipoExamenId -> {ingreso, periodico, retiro}
    var examMap = {};
    cargoExamen.forEach(function(e) {
      if (!examMap[e.cargo_id]) examMap[e.cargo_id] = {};
      examMap[e.cargo_id][e.tipo_examen_id] = {
        ingreso: !!e.ingreso,
        periodico: !!e.periodico,
        retiro: !!e.retiro
      };
    });

    // Hoja 1: MATRIZ DE EXAMENES
    var matrizAoa = [];
    var header1 = ['GRUPO OCUPACIONAL', 'CARGO', 'DESCRIPCION', 'PELIGROS / RIESGOS'];
    tipos.forEach(function(t) { header1.push(t.nombre); header1.push(''); header1.push(''); });
    header1.push('TOTAL EXAMENES');
    matrizAoa.push(header1);
    var header2 = ['', '', '', ''];
    tipos.forEach(function() { header2.push('I'); header2.push('P'); header2.push('R'); });
    header2.push('');
    matrizAoa.push(header2);
    cargos.forEach(function(c) {
      var row = [c.grupo_nombre || '', c.nombre, c.descripcion || '', c.peligros_riesgos || ''];
      var total = 0;
      var cargoExams = examMap[c.id] || {};
      tipos.forEach(function(t) {
        var e = cargoExams[t.id] || { ingreso: false, periodico: false, retiro: false };
        row.push(e.ingreso ? 'X' : '');
        row.push(e.periodico ? 'X' : '');
        row.push(e.retiro ? 'X' : '');
        if (e.ingreso || e.periodico || e.retiro) total++;
      });
      row.push(total);
      matrizAoa.push(row);
    });
    var matrizSheet = XLSX.utils.aoa_to_sheet(matrizAoa);
    matrizSheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 40 }, { wch: 40 }]
      .concat(tipos.map(function() { return { wch: 5 }; }))
      .concat([{ wch: 12 }]);

    // Hoja 2: TIPOS DE EXAMEN
    var tiposAoa = [['#', 'NOMBRE', 'CATEGORIA', 'DESCRIPCION', 'ORDEN']];
    tipos.forEach(function(t, idx) {
      tiposAoa.push([idx + 1, t.nombre, t.categoria, t.descripcion || '', t.orden || 0]);
    });
    var tiposSheet = XLSX.utils.aoa_to_sheet(tiposAoa);
    tiposSheet['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 25 }, { wch: 50 }, { wch: 8 }];

    // Hoja 3: DESCRIPCION DE PRUEBAS
    var pruebasAoa = [['TIPO DE EXAMEN', 'PERSONAL OBJETIVO', 'INGRESO', 'PERIODICO', 'RETIRO', 'REFERENCIA']];
    descripcionPruebas.forEach(function(p) {
      pruebasAoa.push([p.tipo_examen, p.personal_objetivo || '', p.ingreso || '', p.periodico || '', p.retiro || '', p.referencia || '']);
    });
    var pruebasSheet = XLSX.utils.aoa_to_sheet(pruebasAoa);
    pruebasSheet['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 25 }];

    // Hoja 4: RECOMENDACIONES
    var recsAoa = [['FACTOR DE RIESGO', 'DEFINICION', 'EXAMENES', 'PRUEBAS ESPECIFICAS', 'RESTRICCIONES']];
    recomendaciones.forEach(function(r) {
      recsAoa.push([r.factor_riesgo, r.definicion || '', r.examenes || '', r.pruebas_especificas || '', r.restricciones || '']);
    });
    var recsSheet = XLSX.utils.aoa_to_sheet(recsAoa);
    recsSheet['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }];

    // Hoja 5: ALTURAS
    var alturasAoa = [['ACTIVIDAD / RIESGO', 'HALLAZGOS LIMITANTES', 'PARACLINICOS', 'OBSERVACIONES']];
    alturas.forEach(function(a) {
      alturasAoa.push([a.actividad_riesgo, a.hallazgos_limitantes || '', a.paraclinicos || '', a.observaciones || '']);
    });
    var alturasSheet = XLSX.utils.aoa_to_sheet(alturasAoa);
    alturasSheet['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 40 }];

    // Hoja 6: VACUNAS
    var vacunasAoa = [['NOMBRE', 'RECOMENDACION', 'ESQUEMA']];
    vacunas.forEach(function(v) {
      vacunasAoa.push([v.nombre, v.recomendacion || '', v.esquema || '']);
    });
    var vacunasSheet = XLSX.utils.aoa_to_sheet(vacunasAoa);
    vacunasSheet['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 50 }];

    // Hoja 7: GRUPOS
    var gruposAoa = [['NOMBRE', 'DESCRIPCION']];
    grupos.forEach(function(g) {
      gruposAoa.push([g.nombre, g.descripcion || '']);
    });
    var gruposSheet = XLSX.utils.aoa_to_sheet(gruposAoa);
    gruposSheet['!cols'] = [{ wch: 30 }, { wch: 50 }];

    // Crear workbook
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, matrizSheet, 'Matriz Examenes');
    XLSX.utils.book_append_sheet(wb, tiposSheet, 'Tipos Examen');
    XLSX.utils.book_append_sheet(wb, pruebasSheet, 'Pruebas');
    XLSX.utils.book_append_sheet(wb, recsSheet, 'Recomendaciones');
    XLSX.utils.book_append_sheet(wb, alturasSheet, 'Alturas');
    XLSX.utils.book_append_sheet(wb, vacunasSheet, 'Vacunas');
    XLSX.utils.book_append_sheet(wb, gruposSheet, 'Grupos');

    XLSX.writeFile(wb, payload.filePath);

    var stats = {
      cargos: cargos.length,
      tipos: tipos.length,
      cargoExamen: cargoExamen.length,
      descripcionPruebas: descripcionPruebas.length,
      recomendaciones: recomendaciones.length,
      alturas: alturas.length,
      vacunas: vacunas.length,
      grupos: grupos.length
    };

    console.log('[' + MOD + '][EXPORT-EXCEL] OK:', JSON.stringify(stats), '->', payload.filePath);
    return _ok({ exported: true, filePath: payload.filePath, stats: stats });
  } catch (e) {
    console.error('[' + MOD + '][EXPORT-EXCEL]', e.message);
    return _err('EXPORT_ERROR', e.message);
  }
}

// ============================================================================
// REGISTRO DE HANDLERS IPC
// ============================================================================
function registerProfesiogramaHandlers(app, deps) {
  _getDb = deps && deps.getDb ? deps.getDb : null;
  _getCompanyRoot = deps && deps.getCompanyRoot ? deps.getCompanyRoot : null;

  console.log('[' + MOD + '][INIT][INFO] Registrando handlers de Profesiograma...');

  // KPIs
  ipcMain.handle('profesiograma:kpis', async function (event, payload) {
    try { return _handlerGetKpis(); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Matriz
  ipcMain.handle('profesiograma:matriz', async function (event, payload) {
    try { return _handlerGetMatriz(); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Cargos CRUD
  ipcMain.handle('profesiograma:cargos:list', async function (event, payload) {
    try { return _handlerListCargos(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:cargos:get', async function (event, payload) {
    try { return _handlerGetCargo(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:cargos:save', async function (event, payload) {
    try { return _handlerSaveCargo(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:cargos:delete', async function (event, payload) {
    try { return _handlerDeleteCargo(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // TipoExamen CRUD
  ipcMain.handle('profesiograma:tipo-examen:list', async function (event, payload) {
    try { return _handlerListTipoExamen(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:tipo-examen:save', async function (event, payload) {
    try { return _handlerSaveTipoExamen(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:tipo-examen:delete', async function (event, payload) {
    try { return _handlerDeleteTipoExamen(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Pruebas CRUD
  ipcMain.handle('profesiograma:pruebas:list', async function (event, payload) {
    try { return _handlerListPruebas(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:pruebas:save', async function (event, payload) {
    try { return _handlerSavePrueba(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:pruebas:delete', async function (event, payload) {
    try { return _handlerDeletePrueba(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Recomendaciones CRUD
  ipcMain.handle('profesiograma:recomendaciones:list', async function (event, payload) {
    try { return _handlerListRecomendaciones(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:recomendaciones:save', async function (event, payload) {
    try { return _handlerSaveRecomendacion(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:recomendaciones:delete', async function (event, payload) {
    try { return _handlerDeleteRecomendacion(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Vacunas
  ipcMain.handle('profesiograma:vacunacion:list', async function (event, payload) {
    try { return _handlerListVacunas(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:vacunacion:save', async function (event, payload) {
    try { return _handlerSaveVacuna(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:vacunacion:delete', async function (event, payload) {
    try { return _handlerDeleteVacuna(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Alturas CRUD
  ipcMain.handle('profesiograma:alturas:list', async function (event, payload) {
    try { return _handlerListAlturas(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:alturas:save', async function (event, payload) {
    try { return _handlerSaveAltura(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:alturas:delete', async function (event, payload) {
    try { return _handlerDeleteAltura(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // GrupoOcupacional CRUD
  ipcMain.handle('profesiograma:grupo-ocupacional:list', async function (event, payload) {
    try { return _handlerListGrupos(); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:grupo-ocupacional:save', async function (event, payload) {
    try { return _handlerSaveGrupo(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });
  ipcMain.handle('profesiograma:grupo-ocupacional:delete', async function (event, payload) {
    try { return _handlerDeleteGrupo(payload && payload.id); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Import Excel
  ipcMain.handle('profesiograma:import-excel', async function (event, payload) {
    try { return _handlerImportExcel(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });

  // Selector de archivo Excel (abre el dialogo del sistema)
  ipcMain.handle('profesiograma:select-excel', async function (event, payload) {
    try {
      const opts = {
        title: 'Seleccionar archivo GI-FO-047 Profesiograma',
        filters: [
          { name: 'Archivos Excel', extensions: ['xlsx', 'xls'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ],
        properties: ['openFile']
      };
      const result = await dialog.showOpenDialog(opts);
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return _ok({ canceled: true, filePath: null });
      }
      return _ok({ canceled: false, filePath: result.filePaths[0] });
    } catch (e) {
      return _err('SELECT_ERROR', e.message);
    }
  });

  // Selector de ruta de guardado (para export)
  ipcMain.handle('profesiograma:select-save-path', async function (event, payload) {
    try {
      const defaultName = (payload && payload.defaultName) || ('profesiograma-' + new Date().toISOString().slice(0, 10) + '.xlsx');
      const opts = {
        title: 'Guardar Profesiograma como Excel',
        defaultPath: defaultName,
        filters: [
          { name: 'Archivos Excel', extensions: ['xlsx'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      };
      const result = await dialog.showSaveDialog(opts);
      if (result.canceled || !result.filePath) {
        return _ok({ canceled: true, filePath: null });
      }
      return _ok({ canceled: false, filePath: result.filePath });
    } catch (e) {
      return _err('SELECT_ERROR', e.message);
    }
  });

  // Exportar a Excel
  ipcMain.handle('profesiograma:export-excel', async function (event, payload) {
    try { return _handlerExportExcel(payload); } catch (e) { return _err('INTERNAL', e.message); }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] 28 handlers de Profesiograma registrados');
}

module.exports = {
  registerProfesiogramaHandlers: registerProfesiogramaHandlers,
  SCHEMA_SQL: SCHEMA_SQL,
  // Exportar handlers internos para tests
  _handlerGetKpis: _handlerGetKpis,
  _handlerGetMatriz: _handlerGetMatriz,
  _handlerListCargos: _handlerListCargos,
  _handlerGetCargo: _handlerGetCargo,
  _handlerSaveCargo: _handlerSaveCargo,
  _handlerDeleteCargo: _handlerDeleteCargo,
  _handlerListTipoExamen: _handlerListTipoExamen,
  _handlerSaveTipoExamen: _handlerSaveTipoExamen,
  _handlerDeleteTipoExamen: _handlerDeleteTipoExamen,
  _handlerListPruebas: _handlerListPruebas,
  _handlerSavePrueba: _handlerSavePrueba,
  _handlerDeletePrueba: _handlerDeletePrueba,
  _handlerListRecomendaciones: _handlerListRecomendaciones,
  _handlerSaveRecomendacion: _handlerSaveRecomendacion,
  _handlerDeleteRecomendacion: _handlerDeleteRecomendacion,
  _handlerListVacunas: _handlerListVacunas,
  _handlerSaveVacuna: _handlerSaveVacuna,
  _handlerDeleteVacuna: _handlerDeleteVacuna,
  _handlerListAlturas: _handlerListAlturas,
  _handlerSaveAltura: _handlerSaveAltura,
  _handlerDeleteAltura: _handlerDeleteAltura,
  _handlerListGrupos: _handlerListGrupos,
  _handlerSaveGrupo: _handlerSaveGrupo,
  _handlerDeleteGrupo: _handlerDeleteGrupo,
  _handlerImportExcel: _handlerImportExcel,
  _handlerExportExcel: _handlerExportExcel
};
