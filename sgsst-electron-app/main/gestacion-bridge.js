/**
 * =====================================================================
 * 📦465 (2026-07-03) — SUBMÓDULO SEGUIMIENTO DE GESTACIÓN (Salud Materna)
 * Bridge IPC · Backend Process
 *
 * Persistencia: SQLite central en app.getPath('userData')/kair.db
 * Tablas:
 *   - gestaciones                          (datos básicos + clasificación + estado)
 *   - seguimiento_gestacion_mensual        (FK a gestaciones, registros mensuales)
 *
 * Patrón idéntico a revision-alta-direccion-bridge.js:
 *   - registerHandlers(app, deps) recibe getDb() por inyección
 *   - ipcMain.handle('namespace:action', async (event, params) => { ... })
 *   - Retorna { success: true, data } o { success: false, error: { code, message } }
 * =====================================================================
 */

const { ipcMain } = require('electron');

// ─── Dependencias inyectadas ───
var _getDb = null;

/**
 * Nombre del submódulo (para logs).
 */
var MOD = '📦465-GESTACION';

// =====================================================================
// SCHEMA SQL · Se ejecuta en initDbOnce() desde main.js (idempotente)
// =====================================================================
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS gestaciones (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL,
    cedula TEXT NOT NULL,
    nombre TEXT NOT NULL,
    cargo TEXT,
    fecha_notificacion TEXT NOT NULL,
    fpp TEXT NOT NULL,
    semanas_gestacion INTEGER NOT NULL DEFAULT 0,
    clasificacion TEXT NOT NULL DEFAULT 'bajo',
    estado TEXT NOT NULL DEFAULT 'activo',
    eps TEXT,
    arl TEXT,
    fecha_inicio_licencia TEXT,
    fecha_fin_licencia TEXT,
    observaciones TEXT,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    UNIQUE(empresa_id, cedula)
  );

  CREATE INDEX IF NOT EXISTS idx_gestaciones_empresa
    ON gestaciones(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_gestaciones_empresa_estado
    ON gestaciones(empresa_id, estado);
  CREATE INDEX IF NOT EXISTS idx_gestaciones_empresa_clasificacion
    ON gestaciones(empresa_id, clasificacion);

  CREATE TABLE IF NOT EXISTS seguimiento_gestacion_mensual (
    id TEXT PRIMARY KEY,
    gestacion_id TEXT NOT NULL,
    empresa_id TEXT NOT NULL,
    periodo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    semanas INTEGER NOT NULL,
    clasificacion TEXT NOT NULL,
    ctrl_asistio TEXT,
    permisos INTEGER DEFAULT 0,
    proxima_cita TEXT,
    molestia TEXT,
    desc_molestia TEXT,
    incapacitada TEXT,
    dias_incapacidad INTEGER DEFAULT 0,
    origen_incapacidad TEXT,
    restricciones TEXT,
    desc_restricciones TEXT,
    emocional TEXT,
    compatible TEXT,
    ajustes TEXT,
    observaciones TEXT,
    acciones TEXT,
    reportado_por TEXT,
    creado_en TEXT NOT NULL,
    FOREIGN KEY (gestacion_id) REFERENCES gestaciones(id) ON DELETE CASCADE,
    UNIQUE(gestacion_id, periodo)
  );

  CREATE INDEX IF NOT EXISTS idx_seguimiento_gestacion
    ON seguimiento_gestacion_mensual(gestacion_id);
  CREATE INDEX IF NOT EXISTS idx_seguimiento_empresa_periodo
    ON seguimiento_gestacion_mensual(empresa_id, periodo);
`;

// =====================================================================
// HELPERS · Generadores de ID y conversores
// =====================================================================

/**
 * Genera un ID único para gestaciones con formato g-{timestamp}-{random}.
 * Ej: g-1720050000-a3f4
 */
function _newGestacionId() {
    var ts = Date.now().toString(36);
    var rnd = Math.random().toString(36).slice(2, 6);
    return 'g-' + ts + '-' + rnd;
}

/**
 * Genera un ID único para seguimientos.
 */
function _newSeguimientoId() {
    return 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/**
 * Convierte una fila de SQLite (snake_case) al formato del JS camelCase.
 */
function _rowToGestacion(r) {
    if (!r) return null;
    return {
        id: r.id,
        empresa: r.empresa_id,
        cedula: r.cedula,
        nombre: r.nombre,
        cargo: r.cargo || '',
        fechaNotificacion: r.fecha_notificacion,
        fpp: r.fpp,
        semanasGestacion: r.semanas_gestacion || 0,
        clasificacion: r.clasificacion,
        estado: r.estado,
        eps: r.eps || '',
        arl: r.arl || '',
        fechaInicioLicencia: r.fecha_inicio_licencia || null,
        fechaFinLicencia: r.fecha_fin_licencia || null,
        observaciones: r.observaciones || '',
        ultimoSeguimiento: null, // Se actualiza con JOIN si aplica
        creadoEn: r.creado_en,
        actualizadoEn: r.actualizado_en
    };
}

function _rowToSeguimiento(r) {
    if (!r) return null;
    var acciones = [];
    try {
        if (r.acciones) acciones = JSON.parse(r.acciones);
    } catch (e) {
        console.warn('[' + MOD + '] Error parseando acciones JSON:', e.message);
        acciones = [];
    }
    return {
        id: r.id,
        gestacionId: r.gestacion_id,
        empresa: r.empresa_id,
        periodo: r.periodo,
        fecha: r.fecha,
        semanas: r.semanas,
        clasificacion: r.clasificacion,
        ctrlAsistio: r.ctrl_asistio,
        permisos: r.permisos || 0,
        proximaCita: r.proxima_cita,
        molestia: r.molestia,
        descMolestia: r.desc_molestia,
        incapacitada: r.incapacitada,
        diasIncapacidad: r.dias_incapacidad || 0,
        origenIncapacidad: r.origen_incapacidad,
        restricciones: r.restricciones,
        descRestricciones: r.desc_restricciones,
        emocional: r.emocional,
        compatible: r.compatible,
        ajustes: r.ajustes,
        observaciones: r.observaciones,
        acciones: acciones,
        reportadoPor: r.reportado_por,
        creadoEn: r.creado_en
    };
}

/**
 * Enriquece las gestantes con su último seguimiento (fecha) en una sola query.
 */
function _enriquecerConUltimoSeguimiento(empresaId, gestantes) {
    if (!_getDb || gestantes.length === 0) return gestantes;
    try {
        var db = _getDb();
        var ultimos = db.prepare(`
            SELECT gestacion_id, MAX(fecha) as ultima_fecha
            FROM seguimiento_gestacion_mensual
            WHERE empresa_id = ?
            GROUP BY gestacion_id
        `).all(empresaId);
        var map = {};
        ultimos.forEach(function (u) { map[u.gestacion_id] = u.ultima_fecha; });
        gestantes.forEach(function (g) { g.ultimoSeguimiento = map[g.id] || null; });
        return gestantes;
    } catch (e) {
        console.warn('[' + MOD + '] Error enriqueciendo último seguimiento:', e.message);
        return gestantes;
    }
}

// =====================================================================
// HANDLERS IPC
// =====================================================================

/**
 * 📦465 — getEmbarazadasStats
 * Retorna los KPIs calculados del dashboard.
 */
function _handlerGetStats(empresaId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var totalActivas = db.prepare(
            'SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ? AND estado = ?'
        ).get(empresaId, 'activo').n;
        var enLicencia = db.prepare(
            'SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ? AND estado = ?'
        ).get(empresaId, 'licencia').n;
        var altoRiesgo = db.prepare(
            "SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ? AND clasificacion IN ('alto','muy-alto') AND estado IN ('activo','licencia')"
        ).get(empresaId).n;
        var cerradas = db.prepare(
            'SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ? AND estado = ?'
        ).get(empresaId, 'cerrado').n;
        var totalGestantes = db.prepare(
            'SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ?'
        ).get(empresaId).n;

        // Próximas a licencia: FPP dentro de 60 días y estado activo
        var hoy = new Date().toISOString().slice(0, 10);
        var hace60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        var proxLicencia = db.prepare(
            "SELECT COUNT(*) AS n FROM gestaciones WHERE empresa_id = ? AND estado = 'activo' AND fpp BETWEEN ? AND ?"
        ).get(empresaId, hoy, hace60).n;

        return {
            success: true,
            data: {
                total: totalGestantes,
                activas: totalActivas,
                enLicencia: enLicencia,
                altoRiesgo: altoRiesgo,
                proxLicencia: proxLicencia,
                cerradas: cerradas
            }
        };
    } catch (e) {
        console.error('[' + MOD + '][GET_STATS]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — listarGestantes
 * Retorna todas las gestantes de una empresa con su último seguimiento.
 */
function _handlerListarGestantes(empresaId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var rows = db.prepare(
            'SELECT * FROM gestaciones WHERE empresa_id = ? ORDER BY creado_en DESC'
        ).all(empresaId);
        var gestantes = rows.map(_rowToGestacion);
        _enriquecerConUltimoSeguimiento(empresaId, gestantes);
        return { success: true, data: gestantes };
    } catch (e) {
        console.error('[' + MOD + '][LISTAR_GESTANTES]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — obtenerGestante
 * Retorna una gestante con sus seguimientos mensuales.
 */
function _handlerObtenerGestante(empresaId, gestanteId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var row = db.prepare(
            'SELECT * FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).get(gestanteId, empresaId);
        if (!row) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Gestante no encontrada' } };
        }
        var gestante = _rowToGestacion(row);
        var seguimientos = db.prepare(
            'SELECT * FROM seguimiento_gestacion_mensual WHERE gestacion_id = ? ORDER BY periodo DESC, fecha DESC'
        ).all(gestanteId).map(_rowToSeguimiento);
        gestante.seguimientos = seguimientos;
        return { success: true, data: gestante };
    } catch (e) {
        console.error('[' + MOD + '][OBTENER_GESTANTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — registrarGestante
 * Crea una nueva gestante en estado activo.
 */
function _handlerRegistrarGestante(empresaId, data) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!data || !data.cedula || !data.nombre || !data.fpp || !data.fechaNotificacion) {
        return {
            success: false,
            error: {
                code: 'VALIDATION',
                message: 'Faltan datos requeridos (cedula, nombre, fpp, fechaNotificacion)'
            }
        };
    }
    try {
        var db = _getDb();

        // Verificar duplicado (empresa + cedula)
        var existing = db.prepare(
            'SELECT id FROM gestaciones WHERE empresa_id = ? AND cedula = ?'
        ).get(empresaId, String(data.cedula).trim());
        if (existing) {
            return {
                success: false,
                error: { code: 'DUPLICATE', message: 'Ya existe una gestante con esta cédula en la empresa' }
            };
        }

        var now = new Date().toISOString();
        var id = _newGestacionId();
        db.prepare(`
            INSERT INTO gestaciones (
                id, empresa_id, cedula, nombre, cargo,
                fecha_notificacion, fpp, semanas_gestacion,
                clasificacion, estado, eps, arl,
                observaciones, creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            empresaId,
            String(data.cedula).trim(),
            String(data.nombre).trim(),
            data.cargo || '',
            data.fechaNotificacion,
            data.fpp,
            data.semanasGestacion || 0,
            data.clasificacion || 'bajo',
            data.estado || 'activo',
            data.eps || '',
            data.arl || '',
            data.observaciones || '',
            now,
            now
        );

        var creado = _rowToGestacion(db.prepare('SELECT * FROM gestaciones WHERE id = ?').get(id));
        console.log('[' + MOD + '][REGISTRAR] Nueva gestante ' + id + ' · ' + creado.nombre + ' · ' + empresaId);
        return { success: true, data: creado };
    } catch (e) {
        console.error('[' + MOD + '][REGISTRAR_GESTANTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — actualizarGestante
 * Actualiza datos de una gestante (clasificación, estado, semanas, FPP, etc.).
 */
function _handlerActualizarGestante(empresaId, gestanteId, data) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var existing = db.prepare(
            'SELECT * FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).get(gestanteId, empresaId);
        if (!existing) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Gestante no encontrada' } };
        }

        // Whitelist de campos editables
        var allowed = [
            'nombre', 'cargo', 'fpp', 'semanas_gestacion', 'clasificacion',
            'estado', 'eps', 'arl', 'fecha_inicio_licencia', 'fecha_fin_licencia',
            'observaciones', 'fecha_notificacion'
        ];
        var sets = [];
        var values = [];
        allowed.forEach(function (k) {
            // camelCase → snake_case
            var snake = k.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); });
            if (data && Object.prototype.hasOwnProperty.call(data, _camel(k))) {
                sets.push(snake + ' = ?');
                values.push(data[_camel(k)]);
            }
        });
        if (sets.length === 0) {
            return { success: false, error: { code: 'NO_CHANGES', message: 'No hay campos para actualizar' } };
        }

        sets.push('actualizado_en = ?');
        values.push(new Date().toISOString());
        values.push(gestanteId);
        values.push(empresaId);

        db.prepare('UPDATE gestaciones SET ' + sets.join(', ') +
            ' WHERE id = ? AND empresa_id = ?').run.apply(null, values);

        var updated = _rowToGestacion(db.prepare('SELECT * FROM gestaciones WHERE id = ?').get(gestanteId));
        console.log('[' + MOD + '][ACTUALIZAR] Gestante ' + gestanteId + ' actualizada');
        return { success: true, data: updated };
    } catch (e) {
        console.error('[' + MOD + '][ACTUALIZAR_GESTANTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

function _camel(snake) {
    return snake.replace(/_([a-z])/g, function (m, c) { return c.toUpperCase(); });
}

/**
 * 📦465 — eliminarGestante
 * Elimina una gestante y todos sus seguimientos (CASCADE).
 */
function _handlerEliminarGestante(empresaId, gestanteId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var result = db.prepare(
            'DELETE FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).run(gestanteId, empresaId);
        if (result.changes === 0) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Gestante no encontrada' } };
        }
        console.log('[' + MOD + '][ELIMINAR] Gestante ' + gestanteId + ' eliminada (' + result.changes + ' rows)');
        return { success: true, data: { id: gestanteId, deleted: true } };
    } catch (e) {
        console.error('[' + MOD + '][ELIMINAR_GESTANTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — guardarSeguimiento
 * Inserta o actualiza un seguimiento mensual (upsert por gestacion_id + periodo).
 */
function _handlerGuardarSeguimiento(empresaId, data) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!data || !data.gestacionId || !data.periodo || !data.fecha) {
        return {
            success: false,
            error: { code: 'VALIDATION', message: 'Faltan datos requeridos (gestacionId, periodo, fecha)' }
        };
    }
    try {
        var db = _getDb();

        // Verificar que la gestante existe y pertenece a la empresa
        var gestante = db.prepare(
            'SELECT id FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).get(data.gestacionId, empresaId);
        if (!gestante) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Gestante no encontrada' } };
        }

        var id = _newSeguimientoId();
        var accionesJson = JSON.stringify(data.acciones || []);

        // INSERT OR REPLACE (upsert por la UNIQUE(gestacion_id, periodo))
        db.prepare(`
            INSERT OR REPLACE INTO seguimiento_gestacion_mensual (
                id, gestacion_id, empresa_id, periodo, fecha,
                semanas, clasificacion, ctrl_asistio, permisos,
                proxima_cita, molestia, desc_molestia,
                incapacitada, dias_incapacidad, origen_incapacidad,
                restricciones, desc_restricciones,
                emocional, compatible, ajustes,
                observaciones, acciones, reportado_por, creado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, data.gestacionId, empresaId, data.periodo, data.fecha,
            data.semanas || 0, data.clasificacion || 'bajo',
            data.ctrlAsistio || null, data.permisos || 0,
            data.proximaCita || null,
            data.molestia || null, data.descMolestia || null,
            data.incapacitada || null, data.diasIncapacidad || 0,
            data.origenIncapacidad || null,
            data.restricciones || null, data.descRestricciones || null,
            data.emocional || null,
            data.compatible || null, data.ajustes || null,
            data.observaciones || null, accionesJson,
            data.reportadoPor || '',
            new Date().toISOString()
        );

        // Recuperar el registro guardado (puede haber cambiado el id si fue UPDATE)
        var saved = db.prepare(
            'SELECT * FROM seguimiento_gestacion_mensual WHERE gestacion_id = ? AND periodo = ?'
        ).get(data.gestacionId, data.periodo);

        console.log('[' + MOD + '][GUARDAR_SEG] Gestante ' + data.gestacionId + ' · periodo ' + data.periodo);
        return { success: true, data: _rowToSeguimiento(saved) };
    } catch (e) {
        console.error('[' + MOD + '][GUARDAR_SEGUIMIENTO]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — obtenerSeguimientos
 * Lista todos los seguimientos de una gestante (ordenados por periodo DESC).
 */
function _handlerObtenerSeguimientos(empresaId, gestanteId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var rows = db.prepare(
            'SELECT * FROM seguimiento_gestacion_mensual WHERE gestacion_id = ? AND empresa_id = ? ORDER BY periodo DESC, fecha DESC'
        ).all(gestanteId, empresaId);
        return { success: true, data: rows.map(_rowToSeguimiento) };
    } catch (e) {
        console.error('[' + MOD + '][OBTENER_SEGUIMIENTOS]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

// =====================================================================
// REGISTRO DE HANDLERS IPC
// =====================================================================

function registerGestacionHandlers(app, deps) {
    _getDb = deps && deps.getDb ? deps.getDb : null;

    console.log('[' + MOD + '][INIT][INFO] Registrando handlers de Seguimiento de Gestación...');

    // ── Dashboard: stats + listado + seguimientos recientes en una sola llamada ──
    ipcMain.handle('gestacion:cargarTodo', async function (event, params) {
        try {
            var empresaId = params.empresaId;
            if (!empresaId) {
                return { success: false, error: { code: 'NO_COMPANY', message: 'empresaId requerido' } };
            }
            var statsResult = _handlerGetStats(empresaId);
            if (!statsResult.success) return statsResult;
            var gestantesResult = _handlerListarGestantes(empresaId);
            if (!gestantesResult.success) return gestantesResult;
            var ultimosResult = _handlerObtenerSeguimientos(empresaId, '%');
            // El filtro '%' no funciona en SQL; hacemos query directa
            var ultimosSeguimientos = [];
            if (_getDb) {
                try {
                    var db = _getDb();
                    var rows = db.prepare(
                        "SELECT * FROM seguimiento_gestacion_mensual WHERE empresa_id = ? ORDER BY fecha DESC LIMIT 10"
                    ).all(empresaId);
                    ultimosSeguimientos = rows.map(_rowToSeguimiento);
                } catch (e) {
                    console.warn('[' + MOD + '][CARGAR_TODO][ULTIMOS_SEG]', e.message);
                }
            }
            return {
                success: true,
                data: {
                    stats: statsResult.data,
                    gestantes: gestantesResult.data,
                    ultimosSeguimientos: ultimosSeguimientos,
                    fuente: 'sqlite'
                }
            };
        } catch (e) {
            console.error('[' + MOD + '][CARGAR_TODO]', e.message);
            return { success: false, error: { code: 'INTERNAL', message: e.message } };
        }
    });

    // ── Stats (KPIs) ──
    ipcMain.handle('gestacion:getStats', async function (event, params) {
        return _handlerGetStats(params.empresaId);
    });

    // ── Listar gestantes ──
    ipcMain.handle('gestacion:listarGestantes', async function (event, params) {
        return _handlerListarGestantes(params.empresaId);
    });

    // ── Obtener gestante con sus seguimientos ──
    ipcMain.handle('gestacion:obtenerGestante', async function (event, params) {
        return _handlerObtenerGestante(params.empresaId, params.gestanteId);
    });

    // ── Registrar nueva gestante ──
    ipcMain.handle('gestacion:registrarGestante', async function (event, params) {
        return _handlerRegistrarGestante(params.empresaId, params.data || params);
    });

    // ── Actualizar gestante ──
    ipcMain.handle('gestacion:actualizarGestante', async function (event, params) {
        return _handlerActualizarGestante(params.empresaId, params.gestanteId, params.data || {});
    });

    // ── Eliminar gestante ──
    ipcMain.handle('gestacion:eliminarGestante', async function (event, params) {
        return _handlerEliminarGestante(params.empresaId, params.gestanteId);
    });

    // ── Guardar seguimiento mensual (upsert) ──
    ipcMain.handle('gestacion:guardarSeguimiento', async function (event, params) {
        return _handlerGuardarSeguimiento(params.empresaId, params.data || params);
    });

    // ── Obtener seguimientos de una gestante ──
    ipcMain.handle('gestacion:obtenerSeguimientos', async function (event, params) {
        return _handlerObtenerSeguimientos(params.empresaId, params.gestanteId);
    });

    console.log('[' + MOD + '][INIT][SUCCESS] 8 handlers de Seguimiento de Gestación registrados');
}

module.exports = {
    registerGestacionHandlers: registerGestacionHandlers,
    SCHEMA_SQL: SCHEMA_SQL
};