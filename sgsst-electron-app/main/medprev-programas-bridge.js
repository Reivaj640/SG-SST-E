// =====================================================================
// 📦825 (2026-09-29) — Bridge IPC para los programas del 3.1.2
// "Actividades de medicina preventiva y promoción de la salud".
//
// Esqueleto de gestión de programas: crea/lista/actualiza programas por
// línea (sve / dme / promocion) y deja marcar el progreso de sus
// secciones. La interfaz real de cada sección (dashboard, casos,
// alertas...) llega en fases siguientes — este bridge solo administra
// el ciclo de vida del programa.
//
// Canales:
//   medprev:programas:plantillas      — catálogo de plantillas (estático)
//   medprev:programas:list            — programas de una empresa (por tipo opcional)
//   medprev:programas:get             — programa + secciones
//   medprev:programas:create          — crea programa (siembra secciones de plantilla)
//   medprev:programas:update          — nombre/descripcion/estado/fechas
//   medprev:programas:delete          — soft-delete (estado='eliminado')
//   medprev:programas:seccion-estado  — progreso de una sección
//
// 🔒 Auth: lección de la auditoría 2026-09-29 (GH-1 soft-auth no-op) —
// las MUTACIONES (create/update/delete/seccion-estado) exigen token de
// sesión válido con validateSession (hard, sin bypass). Las lecturas
// validan el token si llega. Todo el SQL es con prepared statements.
//
// Patrón: misma firma (app, deps) que presupuesto-bridge.js y gestacion-bridge.js.
// main.js llama: registerMedprevProgramasHandlers(app, { getDb, validateSession }).
// =====================================================================
'use strict';

const { ipcMain } = require('electron');
const {
  MP_PROGRAMAS_SCHEMA_SQL,
  MP_PROGRAMAS_SCHEMA_ALTERS,
  MP_PROGRAMAS_MIGRATIONS_SQL,
  MP_PROGRAMAS_MIGRATION_IDS
} = require('./medprev-programas-schema-sql');

const MOD = 'MEDPREV-PROGRAMAS';

// ---------- DB handle inyectada por main.js ----------
let _getDb = null;
let _validateSession = null;

// ---------- Helpers compartidos ----------
function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}

function _ok(data) {
  return { success: true, data: data || {} };
}

/**
 * 🔒825 — Auth DURA para mutaciones: token requerido y validado.
 * Devuelve { ok:true, user } o { ok:false, error } (que el handler
 * convierte en respuesta 401-equivalente). Sin soft-auth a propósito:
 * ver auditoría 2026-09-29, hallazgo GH-1.
 */
function _requireAuth(token) {
  if (!_validateSession || typeof _validateSession !== 'function') {
    return { ok: false, error: _err('AUTH_UNAVAILABLE', 'Sistema de sesiones no disponible') };
  }
  var session = _validateSession(token);
  if (!session || !session.ok) {
    var code = (session && session.error && session.error.code) || 'INVALID_SESSION';
    return { ok: false, error: _err('AUTH_' + code, 'Sesión inválida o expirada') };
  }
  return { ok: true, user: session.user };
}

/**
 * Auth blanda solo para LECTURAS: si llega token se valida (y un token
 * inválido se rechaza — no se sigue igual), si no llega se asume el
 * usuario logueado de la app de escritorio.
 */
function _optionalAuth(token) {
  if (!token) return { ok: true, user: null };
  if (!_validateSession || typeof _validateSession !== 'function') return { ok: true, user: null };
  var session = _validateSession(token);
  if (!session || !session.ok) {
    return { ok: false, error: _err('AUTH_INVALID_SESSION', 'Sesión inválida o expirada') };
  }
  return { ok: true, user: session.user };
}

// ---------- Helpers de dominio ----------

/** Busca una empresa por nombre (display_name o company_key, case-insensitive). */
function _getCompanyByName(companyName) {
  if (!_getDb) return null;
  var localDb = _getDb();
  if (!localDb) return null;
  var normalized = String(companyName || '').toLowerCase().trim();
  if (!normalized) return null;
  try {
    var row = localDb.prepare(
      "SELECT id, company_key, display_name FROM companies " +
      "WHERE LOWER(display_name) = ? OR LOWER(company_key) = ? " +
      "LIMIT 1"
    ).get(normalized, normalized);
    return row || null;
  } catch (e) {
    console.error('[' + MOD + '][_getCompanyByName]', e.message);
    return null;
  }
}

function _nuevoId(prefixo) {
  return prefixo + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** Si la tabla existe. Para bases viejas, que pueden no tener las mp_sve_*. */
function _existeTabla(db, nombre) {
  try {
    return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nombre);
  } catch (e) { return false; }
}

/**
 * Deja constancia de una baja de programa para que VIAJE por el .kairsync.
 * El serializer manda estas filas en la entidad medprev_programas, y el otro
 * equipo al recibirlas borra su copia.
 *
 * Guarda solo lo NO personal (nombre, tipo, fechas): los casos del SVE, que si
 * llevan nombre, documento y telefono del trabajador, se borran de verdad.
 */
function _registrarBaja(db, row, companyKey, cuando, usuario, origen) {
  if (!_existeTabla(db, 'mp_programas_bajas')) return false;
  db.prepare(
    'INSERT OR REPLACE INTO mp_programas_bajas (programa_id, empresa_id, tipo, nombre, fecha_inicio, fecha_fin, eliminado_en, eliminado_por, origen) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(row.id, companyKey, row.tipo || null, row.nombre || null,
    row.fecha_inicio || null, row.fecha_fin || null, cuando, usuario || null, origen);
  return true;
}

var RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function _validarFechaOpcional(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  var s = String(valor).trim();
  if (!RE_FECHA_ISO.test(s)) {
    throw { code: 'VALIDATION', message: 'El campo "' + campo + '" debe ser una fecha yyyy-mm-dd (llegó: ' + s + ')' };
  }
  return s;
}

/** Convierte una fila de mp_programas al shape camelCase de la UI. */
function _rowToPrograma(r) {
  if (!r) return null;
  return {
    id: r.id,
    empresaId: r.empresa_id,
    tipo: r.tipo,
    nombre: r.nombre,
    descripcion: r.descripcion || '',
    estado: r.estado,
    fechaInicio: r.fecha_inicio || null,
    fechaFin: r.fecha_fin || null,
    plantilla: r.plantilla,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
    creadoPor: r.creado_por
  };
}

/** Convierte una fila de mp_programa_secciones al shape camelCase de la UI. */
function _rowToSeccion(r) {
  if (!r) return null;
  return {
    id: r.id,
    programaId: r.programa_id,
    clave: r.clave,
    nombre: r.nombre,
    descripcion: r.descripcion || '',
    orden: r.orden,
    estado: r.estado,
    actualizadoEn: r.actualizado_en
  };
}

function _seccionesDe(programaId) {
  var localDb = _getDb();
  return localDb.prepare(
    "SELECT id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en " +
    "FROM mp_programa_secciones WHERE programa_id = ? ORDER BY orden ASC"
  ).all(programaId).map(_rowToSeccion);
}

function _progresoDe(secciones) {
  var total = secciones.length;
  var completas = 0, enCurso = 0;
  secciones.forEach(function (s) {
    if (s.estado === 'completo') completas++;
    else if (s.estado === 'en_curso') enCurso++;
  });
  return {
    total: total,
    completas: completas,
    enCurso: enCurso,
    pendientes: total - completas - enCurso,
    pct: total > 0 ? Math.round((completas / total) * 100) : 0
  };
}

// ---------- Plantillas del 3.1.2 ----------
// 📦825 — Las secciones de la plantilla SVE salen del cap. 2.3 / 8 de la
// Documentación Técnica SVE (módulos funcionales de la plataforma).
// DME y Promoción usan la estructura estándar de un programa SG-SST de su
// tipo. La plantilla se instancia al crear el programa (no se guarda en BD).
//
// 📦826 — Plantilla SVE v2: se alinea con la INTERFAZ REAL del prototipo
// (módulo sve/ montado por sección): Dashboard, Gestión de casos (seguimiento),
// Plan PHVA, Indicadores y Áreas expuestas. Las secciones "Centro de alertas",
// "Reportes", "Administración" y "Auditoría" del PDF vuelven cuando existan
// sus interfaces. Migración 20260930-sve-template-v2 actualiza los programas
// sve ya creados con la plantilla v1.
const MEDPREV_TIPOS = ['sve', 'dme', 'promocion'];

const MEDPREV_PLANTILLAS = {
  sve: {
    clave: 'sve',
    nombre: 'SVE — Sistema de Vigilancia Epidemiológica',
    descripcion: 'Interfaz del prototipo SVE: dashboard con KPIs y anillo PHVA, seguimiento de casos con ficha completa, plan PHVA editable, indicadores 2020-2024 y áreas expuestas.',
    secciones: [
      { clave: 'dashboard',    nombre: 'Dashboard ejecutivo',         descripcion: 'KPIs del año, cumplimiento del Plan PHVA, seguimientos por mes y últimos casos.' },
      { clave: 'casos',        nombre: 'Gestión de casos',            descripcion: 'Seguimiento epidemiológico: lista con filtros, ficha del caso y formulario de 4 secciones.' },
      { clave: 'plan',         nombre: 'Plan PHVA',                   descripcion: '19 actividades × 12 meses con programación (AP) y ejecución (AE) y cumplimiento por trimestre.' },
      { clave: 'indicadores',  nombre: 'Indicadores epidemiológicos', descripcion: 'Prevalencia, incidencia, ausentismo y eficacia 2020-2024 con metas y análisis por periodos.' },
      { clave: 'areas',        nombre: 'Áreas expuestas',             descripcion: 'Distribución del riesgo por área y pivote Cargo × Área.' }
    ]
  },
  dme: {
    clave: 'dme',
    nombre: 'DME — Diagnóstico Médico Epidemiológico',
    descripcion: 'Caracterización de las condiciones de salud del personal y plan de acción resultante.',
    secciones: [
      { clave: 'caracterizacion', nombre: 'Caracterización de condiciones de salud', descripcion: 'Baterías, mediciones y caracterización del estado de salud.' },
      { clave: 'matriz',          nombre: 'Matriz de resultados',                    descripcion: 'Consolidación de resultados por condición y grupo.' },
      { clave: 'plan-accion',     nombre: 'Plan de acción',                          descripcion: 'Intervenciones derivadas del diagnóstico, con responsables.' },
      { clave: 'seguimiento',     nombre: 'Seguimiento e indicadores',               descripcion: 'Ejecución del plan e indicadores de cobertura y efecto.' }
    ]
  },
  promocion: {
    clave: 'promocion',
    nombre: 'Programas de promoción y prevención',
    descripcion: 'Seguridad vial, bioseguridad, estilos de vida saludables y demás programas del 3.1.2.',
    secciones: [
      { clave: 'diagnostico',  nombre: 'Diagnóstico y caracterización',      descripcion: 'Necesidades y línea base de la población objetivo.' },
      { clave: 'objetivos',    nombre: 'Objetivos y metas',                  descripcion: 'Objetivos del programa y metas verificables.' },
      { clave: 'cronograma',   nombre: 'Cronograma de actividades',          descripcion: 'Actividades, responsables y fechas del programa.' },
      { clave: 'indicadores',  nombre: 'Indicadores de proceso y efecto',    descripcion: 'Medición de ejecución y de resultado.' },
      { clave: 'informe',      nombre: 'Informe y lecciones aprendidas',     descripcion: 'Cierre del periodo, resultados y ajustes.' }
    ]
  }
};

var PROGRAMA_ESTADOS = ['activo', 'pausado', 'cerrado'];
var SECCION_ESTADOS = ['pendiente', 'en_curso', 'completo'];

// =====================================================================
// Handlers
// =====================================================================

function registerMedprevProgramasHandlers(app, deps) {
  if (deps) {
    _getDb = deps.getDb || _getDb;
    _validateSession = deps.validateSession || _validateSession;
  }

  // ── plantillas — catálogo estático para el asistente de creación ──
  ipcMain.handle('medprev:programas:plantillas', function (event, payload) {
    try {
      var auth = _optionalAuth(payload && payload.token);
      if (!auth.ok) return auth.error;
      return _ok({ plantillas: MEDPREV_PLANTILLAS, tipos: MEDPREV_TIPOS });
    } catch (e) {
      console.error('[' + MOD + '][plantillas]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── list — programas de la empresa (filtro opcional por tipo) ──
  ipcMain.handle('medprev:programas:list', function (event, payload) {
    try {
      var auth = _optionalAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada: ' + ((payload && payload.companyName) || '(vacía)'));

      var tipo = payload && payload.tipo ? String(payload.tipo).trim() : null;
      if (tipo && MEDPREV_TIPOS.indexOf(tipo) === -1) {
        return _err('VALIDATION', 'Tipo de programa desconocido: ' + tipo, { tiposValidos: MEDPREV_TIPOS });
      }

      var localDb = _getDb();
      var rows;
      if (tipo) {
        rows = localDb.prepare(
          "SELECT * FROM mp_programas WHERE empresa_id = ? AND tipo = ? AND estado != 'eliminado' " +
          "ORDER BY CASE estado WHEN 'activo' THEN 0 WHEN 'pausado' THEN 1 ELSE 2 END, creado_en DESC"
        ).all(company.company_key, tipo);
      } else {
        rows = localDb.prepare(
          "SELECT * FROM mp_programas WHERE empresa_id = ? AND estado != 'eliminado' " +
          "ORDER BY tipo ASC, CASE estado WHEN 'activo' THEN 0 WHEN 'pausado' THEN 1 ELSE 2 END, creado_en DESC"
        ).all(company.company_key);
      }

      var programas = rows.map(function (r) {
        var p = _rowToPrograma(r);
        var secciones = _seccionesDe(r.id);
        p.secciones = secciones;
        p.progreso = _progresoDe(secciones);
        return p;
      });
      return _ok({ programas: programas });
    } catch (e) {
      console.error('[' + MOD + '][list]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── get — programa + secciones ──
  ipcMain.handle('medprev:programas:get', function (event, payload) {
    try {
      var auth = _optionalAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      if (!payload || !payload.programaId) return _err('VALIDATION', 'programaId requerido');

      var localDb = _getDb();
      var row = localDb.prepare(
        "SELECT * FROM mp_programas WHERE id = ? AND empresa_id = ? AND estado != 'eliminado'"
      ).get(String(payload.programaId), company.company_key);
      if (!row) return _err('NOT_FOUND', 'Programa no encontrado');

      var programa = _rowToPrograma(row);
      programa.secciones = _seccionesDe(row.id);
      programa.progreso = _progresoDe(programa.secciones);
      return _ok({ programa: programa });
    } catch (e) {
      console.error('[' + MOD + '][get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── create — crea el programa y siembra las secciones de la plantilla ──
  ipcMain.handle('medprev:programas:create', function (event, payload) {
    try {
      // 🔒825 — mutación: token requerido y validado (hard auth).
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');

      var tipo = payload && payload.tipo ? String(payload.tipo).trim() : '';
      if (MEDPREV_TIPOS.indexOf(tipo) === -1) {
        return _err('VALIDATION', 'Tipo de programa desconocido: ' + tipo, { tiposValidos: MEDPREV_TIPOS });
      }

      var nombre = payload && payload.nombre ? String(payload.nombre).trim() : '';
      if (!nombre) return _err('VALIDATION', 'El nombre del programa es obligatorio');
      if (nombre.length > 120) return _err('VALIDATION', 'El nombre no puede superar 120 caracteres');

      var descripcion = payload && payload.descripcion ? String(payload.descripcion).trim() : null;
      if (descripcion && descripcion.length > 1000) return _err('VALIDATION', 'La descripción no puede superar 1000 caracteres');

      var usarPlantilla = !(payload && payload.usarPlantilla === false);
      var plantillaClave = usarPlantilla ? 'estandar' : 'blanco';

      var fechaInicio, fechaFin;
      try {
        fechaInicio = _validarFechaOpcional(payload && payload.fechaInicio, 'fecha de inicio');
        fechaFin = _validarFechaOpcional(payload && payload.fechaFin, 'fecha de fin');
      } catch (vErr) {
        return _err(vErr.code, vErr.message);
      }
      if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        return _err('VALIDATION', 'La fecha de fin no puede ser anterior a la de inicio');
      }

      var ahora = new Date().toISOString();
      var nuevoId = _nuevoId('mpp');
      var seccionesPlantilla = usarPlantilla ? (MEDPREV_PLANTILLAS[tipo] ? MEDPREV_PLANTILLAS[tipo].secciones : []) : [];

      var localDb = _getDb();

      var resultado = localDb.transaction(function () {
        localDb.prepare(
          "INSERT INTO mp_programas (id, empresa_id, tipo, nombre, descripcion, estado, fecha_inicio, fecha_fin, plantilla, creado_en, actualizado_en, creado_por) " +
          "VALUES (?, ?, ?, ?, ?, 'activo', ?, ?, ?, ?, ?, ?)"
        ).run(nuevoId, company.company_key, tipo, nombre, descripcion, fechaInicio, fechaFin, plantillaClave, ahora, ahora, auth.user ? auth.user.id : null);

        var stmtSeccion = localDb.prepare(
          "INSERT INTO mp_programa_secciones (id, programa_id, clave, nombre, descripcion, orden, estado, actualizado_en) " +
          "VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)"
        );
        seccionesPlantilla.forEach(function (s, idx) {
          stmtSeccion.run(_nuevoId('mps'), nuevoId, s.clave, s.nombre, s.descripcion || '', idx + 1, ahora);
        });
        return seccionesPlantilla.length;
      })();

      console.log('[' + MOD + '][create] Programa "' + nombre + '" (' + tipo + ') creado para ' + company.company_key +
        ' con ' + resultado + ' secciones de plantilla');

      var row = localDb.prepare('SELECT * FROM mp_programas WHERE id = ?').get(nuevoId);
      var programa = _rowToPrograma(row);
      programa.secciones = _seccionesDe(nuevoId);
      programa.progreso = _progresoDe(programa.secciones);
      return _ok({ programa: programa });
    } catch (e) {
      if (e && e.message && e.message.indexOf('UNIQUE constraint failed: mp_programas.empresa_id') === 0) {
        return _err('ALREADY_EXISTS', 'Ya existe un programa con ese nombre en esta línea de trabajo');
      }
      console.error('[' + MOD + '][create]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── update — nombre / descripcion / estado / fechas ──
  ipcMain.handle('medprev:programas:update', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      if (!payload || !payload.programaId) return _err('VALIDATION', 'programaId requerido');

      var cambios = (payload && payload.cambios) || {};
      var sets = [];
      var valores = [];

      if (cambios.nombre !== undefined) {
        var nombre = String(cambios.nombre).trim();
        if (!nombre) return _err('VALIDATION', 'El nombre no puede quedar vacío');
        if (nombre.length > 120) return _err('VALIDATION', 'El nombre no puede superar 120 caracteres');
        sets.push('nombre = ?'); valores.push(nombre);
      }
      if (cambios.descripcion !== undefined) {
        var desc = cambios.descripcion === null ? null : String(cambios.descripcion).trim();
        if (desc && desc.length > 1000) return _err('VALIDATION', 'La descripción no puede superar 1000 caracteres');
        sets.push('descripcion = ?'); valores.push(desc);
      }
      if (cambios.estado !== undefined) {
        if (PROGRAMA_ESTADOS.indexOf(cambios.estado) === -1) {
          return _err('VALIDATION', 'Estado desconocido: ' + cambios.estado, { estadosValidos: PROGRAMA_ESTADOS });
        }
        sets.push('estado = ?'); valores.push(cambios.estado);
      }
      if (cambios.fechaInicio !== undefined) {
        try { sets.push('fecha_inicio = ?'); valores.push(_validarFechaOpcional(cambios.fechaInicio, 'fecha de inicio')); }
        catch (vErr) { return _err(vErr.code, vErr.message); }
      }
      if (cambios.fechaFin !== undefined) {
        try { sets.push('fecha_fin = ?'); valores.push(_validarFechaOpcional(cambios.fechaFin, 'fecha de fin')); }
        catch (vErr) { return _err(vErr.code, vErr.message); }
      }

      if (sets.length === 0) return _err('VALIDATION', 'No hay cambios que aplicar');

      var localDb = _getDb();
      var row = localDb.prepare(
        "SELECT * FROM mp_programas WHERE id = ? AND empresa_id = ? AND estado != 'eliminado'"
      ).get(String(payload.programaId), company.company_key);
      if (!row) return _err('NOT_FOUND', 'Programa no encontrado');

      // Coherencia de fechas tras el cambio (contra los valores ya guardados).
      var fi = row.fecha_inicio, ff = row.fecha_fin;
      sets.forEach(function (s, i) {
        if (s === 'fecha_inicio = ?') fi = valores[i];
        if (s === 'fecha_fin = ?') ff = valores[i];
      });
      if (fi && ff && ff < fi) return _err('VALIDATION', 'La fecha de fin no puede ser anterior a la de inicio');

      sets.push('actualizado_en = ?'); valores.push(new Date().toISOString());
      valores.push(row.id);

      var stmtUpdate = localDb.prepare('UPDATE mp_programas SET ' + sets.join(', ') + ' WHERE id = ?');
      stmtUpdate.run.apply(stmtUpdate, valores);

      var actualizado = _rowToPrograma(localDb.prepare('SELECT * FROM mp_programas WHERE id = ?').get(row.id));
      actualizado.secciones = _seccionesDe(row.id);
      actualizado.progreso = _progresoDe(actualizado.secciones);
      return _ok({ programa: actualizado });
    } catch (e) {
      if (e && e.message && e.message.indexOf('UNIQUE constraint failed: mp_programas.empresa_id') === 0) {
        return _err('ALREADY_EXISTS', 'Ya existe un programa con ese nombre en esta línea de trabajo');
      }
      console.error('[' + MOD + '][update]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── delete — dos modos, porque "eliminar" significaba dos cosas distintas ──
  //
  //   modo 'archivar' (default, lo que hacía antes este handler)
  //     UPDATE estado='eliminado'. NO se borra nada, NO viaja por el sync.
  //     Sirve para un programa que dejó de aplicar y cuya historia importa.
  //
  //   modo 'eliminar'
  //     Borra el programa, sus secciones y TODO su contenido de SVE (casos con
  //     nombre/documento/teléfono, plan, indicadores, morbilidad, análisis), y
  //     deja una fila en mp_programas_bajas para que la baja VIAJE al resto de
  //     equipos. Sirve para un programa creado por error, o cuando lo que se
  //     quiere es que los datos personales no queden en ninguna máquina.
  //
  // El borrado es explícito y en transacción: si algo falla a mitad, no queda
  // un programa sin contenido ni contenido sin programa.
  //
  // 🔒 Requiere token válido (auth dura) en los dos modos, y además exige
  // `confirmacion: 'eliminar'` en el modo destructivo: es una guarda contra
  // que un clic perdido borre la historia de un programa entero.
  ipcMain.handle('medprev:programas:delete', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      if (!payload || !payload.programaId) return _err('VALIDATION', 'programaId requerido');

      var localDb = _getDb();
      var row = localDb.prepare(
        "SELECT * FROM mp_programas WHERE id = ? AND empresa_id = ? AND estado != 'eliminado'"
      ).get(String(payload.programaId), company.company_key);
      if (!row) return _err('NOT_FOUND', 'Programa no encontrado');

      var modo = (payload.modo === 'eliminar') ? 'eliminar' : 'archivar';
      var ahora = new Date().toISOString();
      var usuario = (auth.user && auth.user.id) || null;

      if (modo === 'archivar') {
        localDb.prepare(
          "UPDATE mp_programas SET estado = 'eliminado', actualizado_en = ? WHERE id = ?"
        ).run(ahora, row.id);
        // La baja se REGISTRA igual, para poder informar "esto se archivó en
        // tal equipo el tal día" si alguien pregunta. No se propaga al sync
        // (ver el filtro del serializer): archivar es local a propósito.
        _registrarBaja(localDb, row, company.company_key, ahora, usuario, 'archivo');
        console.log('[' + MOD + '][delete:archivar] "' + row.nombre + '" (' + row.id + ') archivado (soft, recuperable desde BD)');
        return _ok({ id: row.id, estado: 'eliminado', modo: 'archivar' });
      }

      if (payload.confirmacion !== 'eliminar') {
        return _err('VALIDATION',
          'Eliminar de verdad requiere confirmacion explicita. Archiva el programa si solo queres dejar de usarlo.');
      }

      // Tablas de contenido del programa. Se listan una por una (y no con
      // "DELETE FROM <tabla> WHERE programa_id" calculado) porque el nombre va
      // concatenado en el SQL: tiene que ser una constante de este archivo.
      var HIJOS = [
        'mp_sve_plan_meses', 'mp_sve_plan_actividades', 'mp_sve_casos', 'mp_sve_meta',
        'mp_sve_indicadores_valores', 'mp_sve_indicadores', 'mp_sve_morbilidad', 'mp_sve_analisis',
        'mp_programa_secciones'
      ];
      var borrados = { secciones: 0, sve: 0 };
      try {
        localDb.transaction(function () {
          HIJOS.forEach(function (t) {
            if (!_existeTabla(localDb, t)) return;
            if (t === 'mp_programa_secciones') {
              borrados.secciones = localDb.prepare('DELETE FROM ' + t + ' WHERE programa_id = ?').run(row.id).changes;
            } else {
              // Estas solo existen si el programa es SVE; si no, no hay nada.
              borrados.sve += localDb.prepare('DELETE FROM ' + t + ' WHERE programa_id = ?').run(row.id).changes;
            }
          });
          _registrarBaja(localDb, row, company.company_key, ahora, usuario, 'eliminar');
          localDb.prepare('DELETE FROM mp_programas WHERE id = ? AND empresa_id = ?').run(row.id, company.company_key);
        })();
      } catch (e) {
        console.error('[' + MOD + '][delete:eliminar]', e.message);
        return _err('INTERNAL', 'No se pudo eliminar el programa: ' + e.message);
      }

      console.log('[' + MOD + '][delete:eliminar] "' + row.nombre + '" (' + row.id + ') eliminado. ' +
        'secciones=' + borrados.secciones + ' filas de SVE=' + borrados.sve + '. Baja registrada (viaja por el sync).');
      return _ok({ id: row.id, estado: 'eliminado', modo: 'eliminar', borrados: borrados, bajaRegistrada: true });
    } catch (e) {
      console.error('[' + MOD + '][delete]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ── seccion-estado — progreso de una sección del programa ──
  ipcMain.handle('medprev:programas:seccion-estado', function (event, payload) {
    try {
      var auth = _requireAuth(payload && payload.token);
      if (!auth.ok) return auth.error;

      var company = _getCompanyByName(payload && payload.companyName);
      if (!company) return _err('COMPANY_NOT_FOUND', 'Empresa no encontrada');
      if (!payload || !payload.programaId || !payload.seccionId) {
        return _err('VALIDATION', 'programaId y seccionId requeridos');
      }
      if (SECCION_ESTADOS.indexOf(payload.estado) === -1) {
        return _err('VALIDATION', 'Estado de sección desconocido: ' + payload.estado, { estadosValidos: SECCION_ESTADOS });
      }

      var localDb = _getDb();
      var programa = localDb.prepare(
        "SELECT id FROM mp_programas WHERE id = ? AND empresa_id = ? AND estado != 'eliminado'"
      ).get(String(payload.programaId), company.company_key);
      if (!programa) return _err('NOT_FOUND', 'Programa no encontrado');

      var ahora = new Date().toISOString();
      var res = localDb.prepare(
        "UPDATE mp_programa_secciones SET estado = ?, actualizado_en = ? WHERE id = ? AND programa_id = ?"
      ).run(payload.estado, ahora, String(payload.seccionId), programa.id);
      if (res.changes === 0) return _err('NOT_FOUND', 'Sección no encontrada');

      // El cambio de sección también toca el programa (para ordenar por actividad).
      localDb.prepare('UPDATE mp_programas SET actualizado_en = ? WHERE id = ?').run(ahora, programa.id);

      var seccion = _rowToSeccion(localDb.prepare('SELECT * FROM mp_programa_secciones WHERE id = ?').get(String(payload.seccionId)));
      var secciones = _seccionesDe(programa.id);
      return _ok({ seccion: seccion, progreso: _progresoDe(secciones) });
    } catch (e) {
      console.error('[' + MOD + '][seccion-estado]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  console.log('[' + MOD + '] Handlers registrados: plantillas, list, get, create, update, delete, seccion-estado');
}

// Re-export del schema: main.js lo aplica en initDbOnce() igual que presupuesto.
module.exports = {
  registerMedprevProgramasHandlers,
  SCHEMA_SQL: MP_PROGRAMAS_SCHEMA_SQL,
  SCHEMA_ALTERS: MP_PROGRAMAS_SCHEMA_ALTERS,
  MIGRATIONS_SQL: MP_PROGRAMAS_MIGRATIONS_SQL,
  MIGRATION_IDS: MP_PROGRAMAS_MIGRATION_IDS,
  MEDPREV_PLANTILLAS,
  MEDPREV_TIPOS
};
