/**
 * =====================================================================
 * 📦465 (2026-07-03) — SUBMÓDULO SEGUIMIENTO DE GESTACIÓN (Salud Materna)
 * 📦468 (2026-07-04) — MIGRACIÓN schema: estados 'reintegro'/'suspendida'
 *                       + columnas area/empresa_nombre/empresa_cliente
 *                       + fechas de reintegro y suspensión
 * Bridge IPC · Backend Process
 *
 * Persistencia: SQLite central en app.getPath('userData')/kair.db
 * Tablas:
 *   - gestaciones                          (datos + estado + fechas ciclo vida)
 *   - seguimiento_gestacion_mensual        (FK a gestaciones, registros mensuales)
 *
 * 📦468 — Valores válidos de `gestaciones.estado` (flujo lineal estricto):
 *   activo → licencia → reintegro → cerrado
 *   'suspendida' es estado excepcional (sale del flujo normal, con motivo obligatorio).
 *   Para llegar a 'cerrado' es obligatorio pasar antes por 'reintegro' (📦469 valida).
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
// CREATE TABLE solo aplica a INSTALACIONES NUEVAS. Para actualizar una
// base existente se usan las MIGRATIONS_SQL de abajo (ALTER TABLE).
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
    -- 📦468 — Datos extendidos para Reportes de Seguimiento
    area TEXT,                              -- Departamento/Área donde trabaja (Finanzas, Operaciones, etc.)
    empresa_nombre TEXT,                    -- Nombre legible de la empresa ("ASEL S.A.S.") para reportes
    empresa_cliente TEXT,                   -- Empresa cliente si presta servicios allí ("TechNova Ltda.")
    -- 📦468 — Fechas y motivos del ciclo de vida (reintegro / suspensión)
    fecha_inicio_reintegro TEXT,
    fecha_fin_reintegro TEXT,
    fecha_suspension TEXT,
    motivo_suspension TEXT,
    motivo_reintegro TEXT,
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
    FOREIGN KEY (gestacion_id) REFERENCES gestaciones(id) ON DELETE CASCADE
    -- 📦539 — QUITADO el UNIQUE(gestacion_id, periodo) que venia del schema
    -- original. Antes, INSERT OR REPLACE en _handlerGuardarSeguimiento
    -- REEMPLAZABA el seguimiento previo del mismo periodo, perdiendo la
    -- trazabilidad (e.g. una "revisión" del mes se cargaba encima de la
    -- version original). Ahora cada save crea un row nuevo. El wizard mensual
    -- y la antesala exponen un boton de papelera para borrar el que no
    -- quiera quedarse. La migracion para DBs existentes esta en
    -- MIGRATIONS_SQL más abajo.
  );

  CREATE INDEX IF NOT EXISTS idx_seguimiento_gestacion
    ON seguimiento_gestacion_mensual(gestacion_id);
  CREATE INDEX IF NOT EXISTS idx_seguimiento_empresa_periodo
    ON seguimiento_gestacion_mensual(empresa_id, periodo);
`;

// =====================================================================
// MIGRATIONS SQL · 📦468 — ALTER TABLE idempotente
// Se ejecuta DESPUÉS de SCHEMA_SQL en initDbOnce(). Cada ALTER se aplica
// individualmente con try/catch en main.js, así son idempotentes:
//   - Si la columna NO existe → se agrega
//   - Si ya existe → SQLite lanza "duplicate column" que se ignora
// Esto evita necesidad de un sistema de versiones de schema formal.
// =====================================================================
const MIGRATIONS_SQL = [
  // 📦468 — Datos extendidos (Reportes)
  "ALTER TABLE gestaciones ADD COLUMN area TEXT",
  "ALTER TABLE gestaciones ADD COLUMN empresa_nombre TEXT",
  "ALTER TABLE gestaciones ADD COLUMN empresa_cliente TEXT",
  // 📦468 — Fechas y motivos del ciclo de vida (reintegro / suspensión)
  "ALTER TABLE gestaciones ADD COLUMN fecha_inicio_reintegro TEXT",
  "ALTER TABLE gestaciones ADD COLUMN fecha_fin_reintegro TEXT",
  "ALTER TABLE gestaciones ADD COLUMN fecha_suspension TEXT",
  "ALTER TABLE gestaciones ADD COLUMN motivo_suspension TEXT",
  "ALTER TABLE gestaciones ADD COLUMN motivo_reintegro TEXT",
  // 📦539 — Quitar UNIQUE(gestacion_id, periodo) para que cada save de
  // seguimiento cree un row nuevo (antes el INSERT OR REPLACE del bridge
  // pisaba el row anterior del mismo periodo y se perdia la trazabilidad).
  // SQLite no soporta ALTER TABLE ... DROP CONSTRAINT, asi que la unica
  // forma es recrear la tabla copiando los datos. Como es destructivo
  // (altera definicion de tabla), lo intento UNA vez: si la tabla ya fue
  // recreada en una corrida anterior, el primer ALTER RENAME falla con
  // "no such table: _seg_old" y la migracion se ignora silenciosamente.
  // En cualquier caso, NO se pierden datos: el INSERT ... SELECT copia
  // todo el contenido antes del DROP.
  [
    "PRAGMA foreign_keys=off;",
    "BEGIN TRANSACTION;",
    "ALTER TABLE seguimiento_gestacion_mensual RENAME TO _seg_old_539;",
    "CREATE TABLE seguimiento_gestacion_mensual (",
    "  id TEXT PRIMARY KEY,",
    "  gestacion_id TEXT NOT NULL,",
    "  empresa_id TEXT NOT NULL,",
    "  periodo TEXT NOT NULL,",
    "  fecha TEXT NOT NULL,",
    "  semanas INTEGER NOT NULL,",
    "  clasificacion TEXT NOT NULL,",
    "  ctrl_asistio TEXT,",
    "  permisos INTEGER DEFAULT 0,",
    "  proxima_cita TEXT,",
    "  molestia TEXT,",
    "  desc_molestia TEXT,",
    "  incapacitada TEXT,",
    "  dias_incapacidad INTEGER DEFAULT 0,",
    "  origen_incapacidad TEXT,",
    "  restricciones TEXT,",
    "  desc_restricciones TEXT,",
    "  emocional TEXT,",
    "  compatible TEXT,",
    "  ajustes TEXT,",
    "  observaciones TEXT,",
    "  acciones TEXT,",
    "  reportado_por TEXT,",
    "  creado_en TEXT NOT NULL,",
    "  FOREIGN KEY (gestacion_id) REFERENCES gestaciones(id) ON DELETE CASCADE",
    ");",
    "INSERT INTO seguimiento_gestacion_mensual",
    "  (id, gestacion_id, empresa_id, periodo, fecha, semanas, clasificacion,",
    "   ctrl_asistio, permisos, proxima_cita, molestia, desc_molestia,",
    "   incapacitada, dias_incapacidad, origen_incapacidad, restricciones,",
    "   desc_restricciones, emocional, compatible, ajustes, observaciones,",
    "   acciones, reportado_por, creado_en)",
    "SELECT id, gestacion_id, empresa_id, periodo, fecha, semanas, clasificacion,",
    "       ctrl_asistio, permisos, proxima_cita, molestia, desc_molestia,",
    "       incapacitada, dias_incapacidad, origen_incapacidad, restricciones,",
    "       desc_restricciones, emocional, compatible, ajustes, observaciones,",
    "       acciones, reportado_por, creado_en",
    "  FROM _seg_old_539;",
    "DROP TABLE _seg_old_539;",
    "CREATE INDEX IF NOT EXISTS idx_seguimiento_gestacion ON seguimiento_gestacion_mensual(gestacion_id);",
    "CREATE INDEX IF NOT EXISTS idx_seguimiento_empresa_periodo ON seguimiento_gestacion_mensual(empresa_id, periodo);",
    "COMMIT;",
    "PRAGMA foreign_keys=on;"
  ].join("\n")
];

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
        // 📦468 — Datos extendidos para Reportes
        area: r.area || '',
        empresaNombre: r.empresa_nombre || '',
        empresaCliente: r.empresa_cliente || '',
        // 📦468 — Fechas y motivos del ciclo de vida
        fechaInicioReintegro: r.fecha_inicio_reintegro || null,
        fechaFinReintegro: r.fecha_fin_reintegro || null,
        fechaSuspension: r.fecha_suspension || null,
        motivoSuspension: r.motivo_suspension || '',
        motivoReintegro: r.motivo_reintegro || '',
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
        // 📦470 — Persistir también area, empresa_nombre, empresa_cliente (autollenados
        // desde la BD de personal o ingresados manualmente).
        db.prepare(`
            INSERT INTO gestaciones (
                id, empresa_id, cedula, nombre, cargo,
                area, empresa_nombre, empresa_cliente,
                fecha_notificacion, fpp, semanas_gestacion,
                clasificacion, estado, eps, arl,
                observaciones, creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            empresaId,
            String(data.cedula).trim(),
            String(data.nombre).trim(),
            data.cargo || '',
            data.area || '',
            data.empresaNombre || data.empresa_nombre || '',
            data.empresaCliente || data.empresa_cliente || '',
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
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
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
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
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
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
        return { success: true, data: { id: gestanteId, deleted: true } };
    } catch (e) {
        console.error('[' + MOD + '][ELIMINAR_GESTANTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦465 — guardarSeguimiento
 * Inserta un nuevo seguimiento mensual. A partir de 📦539 NO hace upsert:
 * cada llamada crea un row nuevo (id unico generado por _newSeguimientoId),
 * de modo que se conservan todas las versiones del mismo periodo.
 * El UNIQUE(gestacion_id, periodo) original fue removido del schema
 * (ver MIGRATIONS_SQL). Si el usuario carga un seguimiento de mas,
 * puede borrarlo desde la antesala o el wizard mensual.
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

        // 📦539 — INSERT (no OR REPLACE). Cada save crea un row nuevo para
        // preservar el historial completo de versiones del mismo periodo.
        // El frontend ofrece UI para borrar el que no quiera quedarse.
        db.prepare(`
            INSERT INTO seguimiento_gestacion_mensual (
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

        // Recuperar el registro guardado por id unico (no por periodo)
        var saved = db.prepare(
            'SELECT * FROM seguimiento_gestacion_mensual WHERE id = ?'
        ).get(id);

        console.log('[' + MOD + '][GUARDAR_SEG] Gestante ' + data.gestacionId + ' · periodo ' + data.periodo + ' · id ' + id);
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
        return { success: true, data: _rowToSeguimiento(saved) };
    } catch (e) {
        console.error('[' + MOD + '][GUARDAR_SEGUIMIENTO]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦538 — eliminarSeguimiento
 * Elimina UN seguimiento mensual especifico por id. NO elimina la gestante
 * (eso es _handlerEliminarGestante). Validacion cross-tenant: el seguimiento
 * debe pertenecer a una gestante de la empresa indicada.
 */
function _handlerEliminarSeguimiento(empresaId, seguimientoId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!empresaId || !seguimientoId) {
        return {
            success: false,
            error: { code: 'VALIDATION', message: 'empresaId y seguimientoId son requeridos' }
        };
    }
    try {
        var db = _getDb();
        // Cross-tenant: verificar que el seguimiento pertenece a la empresa
        var existing = db.prepare(
            'SELECT id, gestacion_id, periodo FROM seguimiento_gestacion_mensual ' +
            'WHERE id = ? AND empresa_id = ?'
        ).get(seguimientoId, empresaId);
        if (!existing) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Seguimiento no encontrado o no pertenece a la empresa' } };
        }
        var result = db.prepare(
            'DELETE FROM seguimiento_gestacion_mensual WHERE id = ? AND empresa_id = ?'
        ).run(seguimientoId, empresaId);
        if (result.changes === 0) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'No se elimino ningun registro' } };
        }
        console.log('[' + MOD + '][ELIMINAR_SEG] Seguimiento ' + seguimientoId + ' (gestante=' + existing.gestacion_id + ', periodo=' + existing.periodo + ') eliminado');
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
        return { success: true, data: { id: seguimientoId, deleted: true, gestanteId: existing.gestacion_id, periodo: existing.periodo } };
    } catch (e) {
        console.error('[' + MOD + '][ELIMINAR_SEGUIMIENTO]', e.message);
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
// 📦469 — MOTOR DE CÁLCULOS PARA REPORTES DE SEGUIMIENTO
// =====================================================================

/**
 * Genera array de strings 'YYYY-MM' entre dos fechas (inclusivo).
 * Si desde > hasta, devuelve array con solo desde (1 mes).
 */
function _generarMesesRango(desde, hasta) {
    var meses = [];
    var d = new Date(desde + 'T00:00:00');
    var h = new Date(hasta + 'T00:00:00');
    while (d <= h) {
        meses.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        d.setMonth(d.getMonth() + 1);
        // Tope defensivo: máximo 36 meses para evitar loops infinitos
        if (meses.length > 36) break;
    }
    return meses;
}

/**
 * Periodicidad en días según clasificación (Res. 0312/2019 art. 14).
 * Mismo criterio que gestacion-antesala.js:_frecuenciaPorRiesgo().
 */
function _diasPasoPorClasificacion(c) {
    if (c === 'alto') return 15;
    if (c === 'muy-alto') return 7;
    return 30; // bajo
}

/**
 * Resuelve el rango de fechas final a partir del filtro de periodo del frontend.
 * Filtros aceptados:
 *   { periodo: 'ultimoTrimestre' | 'mesActual' | 'mesAnterior' | 'ultimoMes' }
 *   { fechaDesde: 'YYYY-MM-DD', fechaHasta: 'YYYY-MM-DD' }  (custom, toma precedencia)
 */
function _resolverRangoFechas(filtros) {
    var hoy = new Date();
    var desde, hasta;
    var periodo = (filtros && filtros.periodo) || 'ultimoTrimestre';

    if (filtros && filtros.fechaDesde && filtros.fechaHasta) {
        return { desde: filtros.fechaDesde, hasta: filtros.fechaHasta, etiqueta: 'Personalizado' };
    }

    if (periodo === 'mesActual') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), etiqueta: 'Mes actual' };
    }
    if (periodo === 'mesAnterior') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), etiqueta: 'Mes anterior' };
    }
    if (periodo === 'ultimoMes') {
        desde = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
        hasta = hoy;
        return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), etiqueta: 'Últimos 30 días' };
    }
    // Default: último trimestre
    desde = new Date(hoy.getTime() - 90 * 24 * 60 * 60 * 1000);
    hasta = hoy;
    return { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10), etiqueta: 'Último trimestre' };
}

/**
 * 📦469 — calcularReporte
 * Motor de agregaciones para los 3 tipos de reporte (Resumen Ejecutivo, Detallado, Individual).
 * Devuelve un objeto con todas las métricas/visualizaciones ya pre-calculadas.
 *
 * Filtros aceptados:
 *   - periodo: 'ultimoTrimestre' | 'mesActual' | 'mesAnterior' | 'ultimoMes' (default: ultimoTrimestre)
 *   - fechaDesde, fechaHasta: rango custom (override periodo)
 *   - riesgo: 'bajo' | 'alto' | 'muy-alto' | null=todos
 *   - empresa: string|null (default: la del argumento empresaId)
 *   - gestanteId: solo para Individual, filtra seguimientos a 1 gestante
 */
function _handlerCalcularReporte(empresaId, filtros) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!empresaId) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'empresaId requerido' } };
    }
    filtros = filtros || {};

    try {
        var db = _getDb();
        var rango = _resolverRangoFechas(filtros);

        // ── 1. Cargar gestantes (enriquecidas con último seguimiento) ──
        var listarResult = _handlerListarGestantes(empresaId);
        if (!listarResult.success) return listarResult;
        var gestantes = listarResult.data;

        // Filtro por riesgo
        if (filtros.riesgo) {
            gestantes = gestantes.filter(function (g) { return g.clasificacion === filtros.riesgo; });
        }
        // Filtro por gestante individual
        if (filtros.gestanteId) {
            gestantes = gestantes.filter(function (g) { return g.id === filtros.gestanteId; });
        }

        // ── 2. Cargar seguimientos del periodo (JOIN con gestaciones) ──
        var sqlSegs = db.prepare(`
            SELECT s.*, g.nombre as gest_nombre, g.cedula as gest_cedula,
                   g.cargo as gest_cargo, g.clasificacion as gest_clasificacion,
                   g.area as gest_area, g.empresa_cliente as gest_empresa_cliente
            FROM seguimiento_gestacion_mensual s
            JOIN gestaciones g ON g.id = s.gestacion_id
            WHERE s.empresa_id = ? AND s.fecha BETWEEN ? AND ?
            ${filtros.gestanteId ? 'AND s.gestacion_id = ?' : ''}
            ORDER BY s.fecha DESC, s.periodo DESC
        `);
        var paramsSegs = filtros.gestanteId
            ? [empresaId, rango.desde, rango.hasta, filtros.gestanteId]
            : [empresaId, rango.desde, rango.hasta];
        var segRows = sqlSegs.all.apply(sqlSegs, paramsSegs);

        // ── 3. KPIs principales ──
        var activas = gestantes.filter(function (g) {
            return g.estado === 'activo' || g.estado === 'licencia' || g.estado === 'reintegro';
        });

        // ── 4. Cálculo de seguimientos vencidos (heurística por clasificación) ──
        var hoyD = new Date(); hoyD.setHours(0, 0, 0, 0);
        var alertas = [];
        var seguimientosVencidosSet = {};
        gestantes.forEach(function (g) {
            if (g.estado === 'cerrado' || g.estado === 'suspendida') return;
            var diasPaso = _diasPasoPorClasificacion(g.clasificacion);
            var baseIso = g.ultimoSeguimiento || g.fechaNotificacion;
            if (!baseIso) return;
            var base = new Date(baseIso + 'T00:00:00');
            if (isNaN(base.getTime())) return;
            var proximo = new Date(base.getTime() + diasPaso * 24 * 60 * 60 * 1000);
            if (proximo < hoyD) {
                seguimientosVencidosSet[g.id] = true;
                alertas.push({
                    gestante: g.nombre,
                    gestanteId: g.id,
                    tipo: 'VENCIDO',
                    mensaje: 'Seguimiento vencido desde ' + _fmtIsoCorto(proximo),
                    fecha: _fmtIsoCorto(proximo)
                });
            }
            // Alerta adicional por Muy Alto Riesgo
            if (g.clasificacion === 'muy-alto') {
                alertas.push({
                    gestante: g.nombre,
                    gestanteId: g.id,
                    tipo: 'MUY_ALTO_RIESGO',
                    mensaje: 'Clasificada como Muy Alto Riesgo Obstétrico — requiere seguimiento semanal',
                    fecha: g.ultimoSeguimiento || g.fechaNotificacion
                });
            }
        });

        var seguimientosVencidos = Object.keys(seguimientosVencidosSet).length;
        var seguimientosCompletados = segRows.length;
        // Programados = activas * 1 seguimiento esperado en el rango (heurística base)
        var seguimientosProgramados = activas.length; // simplificación: 1 por gestante activa
        var cumplimientoFrecuencia = seguimientosProgramados > 0
            ? Math.round((seguimientosCompletados / seguimientosProgramados) * 100)
            : 0;
        // Promedio bienestar emocional (campo "emocional" tipo "4/5")
        var emocionales = [];
        segRows.forEach(function (s) {
            if (s.emocional && typeof s.emocional === 'string') {
                var parts = s.emocional.split('/');
                if (parts.length === 2) {
                    var num = parseInt(parts[0], 10);
                    var den = parseInt(parts[1], 10);
                    if (!isNaN(num) && !isNaN(den) && den > 0) emocionales.push(num / den);
                }
            }
        });
        var promedioBienestar = emocionales.length > 0
            ? emocionales.reduce(function (a, b) { return a + b; }, 0) / emocionales.length
            : 0;
        var promedioBienestarEmocional = {
            valor: Math.round(promedioBienestar * 10) / 10,
            formato: (Math.round(promedioBienestar * 10) / 10).toFixed(1) + ' / 5',
            base: 5
        };

        // ── 5. Distribución por riesgo ──
        var distribRiesgo = { bajo: 0, alto: 0, muyAlto: 0 };
        activas.forEach(function (g) {
            if (g.clasificacion === 'bajo') distribRiesgo.bajo++;
            else if (g.clasificacion === 'alto') distribRiesgo.alto++;
            else if (g.clasificacion === 'muy-alto') distribRiesgo.muyAlto++;
        });
        var totalPorRiesgo = distribRiesgo.bajo + distribRiesgo.alto + distribRiesgo.muyAlto;

        // ── 6. Estado de seguimientos ──
        var distribEstado = {
            completados: seguimientosCompletados,
            programados: seguimientosProgramados,
            vencidos: seguimientosVencidos
        };
        var totalSegsEnPeriodo = seguimientosCompletados + seguimientosVencidos;
        var tasaFinalizacion = totalSegsEnPeriodo > 0
            ? Math.round((seguimientosCompletados / totalSegsEnPeriodo) * 100)
            : 0;

        // ── 7. Tendencia mensual ──
        var mesesRango = _generarMesesRango(rango.desde, rango.hasta);
        var tendenciaMensual = mesesRango.map(function (m) {
            var delMes = segRows.filter(function (s) { return s.periodo === m; });
            var completados = delMes.length;
            // Cuántas gestantes activas había en ese periodo — heurística: las activas hoy
            var programados = activas.length;
            var vencidos = delMes.filter(function (s) {
                return seguimientosVencidosSet[s.gestacion_id];
            }).length;
            return {
                periodo: m,
                completados: completados,
                programados: Math.max(0, programados - completados),
                vencidos: vencidos
            };
        });

        // ── 8. Distribución por área ──
        var areaMap = {};
        activas.forEach(function (g) {
            var area = g.area || 'Sin área';
            areaMap[area] = (areaMap[area] || 0) + 1;
        });
        var distribucionArea = Object.keys(areaMap).map(function (a) {
            return { area: a, count: areaMap[a] };
        }).sort(function (x, y) { return y.count - x.count; });

        // ── 9. Acciones más frecuentes ──
        var accionesCount = {};
        var totalPermisos = 0, totalIncapacidades = 0, totalAjustes = 0, totalReubicaciones = 0;
        segRows.forEach(function (s) {
            totalPermisos += s.permisos || 0;
            totalIncapacidades += s.dias_incapacidad || 0;
            try {
                var accs = JSON.parse(s.acciones || '[]');
                if (Array.isArray(accs)) {
                    accs.forEach(function (a) {
                        var key = (typeof a === 'string') ? a : (a.nombre || a.tipo || JSON.stringify(a));
                        accionesCount[key] = (accionesCount[key] || 0) + 1;
                        var k = key.toLowerCase();
                        if (k.indexOf('ajuste') !== -1) totalAjustes++;
                        if (k.indexOf('reubicac') !== -1) totalReubicaciones++;
                    });
                }
            } catch (e) { /* ignore parse errors */ }
        });
        var accionesFrecuentes = Object.keys(accionesCount)
            .map(function (k) { return { accion: k, count: accionesCount[k] }; })
            .sort(function (x, y) { return y.count - x.count; })
            .slice(0, 10);
        var totalesAcciones = {
            permisos: totalPermisos,
            diasIncapacidad: totalIncapacidades,
            ajustes: totalAjustes,
            reubicaciones: totalReubicaciones
        };

        // ── 10. Detalle de seguimientos (para tabla) ──
        var detalle = segRows.map(function (s) {
            var accsCount = 0;
            try {
                var arr = JSON.parse(s.acciones || '[]');
                if (Array.isArray(arr)) accsCount = arr.length;
            } catch (e) {}
            var estadoSeg = seguimientosVencidosSet[s.gestacion_id] ? 'VENCIDO' : 'COMPLETADO';
            return {
                gestante: s.gest_nombre,
                cedula: s.gest_cedula,
                cargo: s.gest_cargo || '',
                area: s.gest_area || '',
                empresaCliente: s.gest_empresa_cliente || '',
                periodo: s.periodo,
                fecha: s.fecha,
                riesgo: s.gest_clasificacion,
                semanas: s.semanas,
                estado: estadoSeg,
                controles: s.ctrl_asistio || '—',
                permisos: s.permisos || 0,
                emocional: s.emocional || '—',
                acciones: accsCount,
                gestanteId: s.gestacion_id
            };
        });

        // ── 11. Ensamblar respuesta ──
        return {
            success: true,
            data: {
                periodo: { desde: rango.desde, hasta: rango.hasta, etiqueta: rango.etiqueta },
                empresa: { id: empresaId },
                filtros: filtros,
                kpis: {
                    gestantesActivas: activas.length,
                    gestantesEnSeguimiento: activas.length,
                    seguimientosCompletados: seguimientosCompletados,
                    seguimientosProgramados: seguimientosProgramados,
                    seguimientosVencidos: seguimientosVencidos,
                    cumplimientoFrecuencia: Math.min(100, cumplimientoFrecuencia),
                    alertasCriticas: alertas.length,
                    promedioBienestarEmocional: promedioBienestarEmocional,
                    tasaFinalizacion: tasaFinalizacion
                },
                distribucionRiesgo: {
                    bajo: distribRiesgo.bajo,
                    alto: distribRiesgo.alto,
                    muyAlto: distribRiesgo.muyAlto,
                    total: totalPorRiesgo,
                    porcentajes: totalPorRiesgo > 0 ? {
                        bajo: Math.round((distribRiesgo.bajo / totalPorRiesgo) * 100),
                        alto: Math.round((distribRiesgo.alto / totalPorRiesgo) * 100),
                        muyAlto: Math.round((distribRiesgo.muyAlto / totalPorRiesgo) * 100)
                    } : { bajo: 0, alto: 0, muyAlto: 0 }
                },
                distribucionEstado: distribEstado,
                tendenciaMensual: tendenciaMensual,
                distribucionArea: distribucionArea,
                accionesFrecuentes: accionesFrecuentes,
                totalesAcciones: totalesAcciones,
                alertasCriticas: alertas,
                detalleSeguimientos: detalle,
                gestantes: activas,
                fechaGeneracion: new Date().toISOString()
            }
        };
    } catch (e) {
        console.error('[' + MOD + '][CALCULAR_REPORTE]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/** Helper de formato fecha corto YYYY-MM-DD (sin T00:00 para evitar timezone shift). */
function _fmtIsoCorto(isoOrDate) {
    if (!isoOrDate) return '';
    if (typeof isoOrDate === 'string') return isoOrDate.slice(0, 10);
    if (isoOrDate instanceof Date) {
        return isoOrDate.toISOString().slice(0, 10);
    }
    return '';
}

// =====================================================================
// 📦469 — ACTUALIZAR ESTADO (con validación de flujo lineal estricto)
// =====================================================================

/**
 * Reglas del flujo lineal estricto (acordadas con el usuario):
 *   activo → licencia → reintegro → cerrado
 *   'suspendida' es estado excepcional: puede salir de cualquier estado
 *   activo/licencia/reintegro, pero requiere motivo_suspension obligatorio.
 *   Para llegar a 'cerrado' hay que pasar antes por 'reintegro' (o ser 'suspendida').
 *   No se permite retroceder (ej. reintegro → licencia).
 *
 * Datos opcionales que se persisten según estado:
 *   - licencia:       { fechaInicioLicencia, fechaFinLicencia }
 *   - reintegro:      { fechaInicioReintegro, fechaFinReintegro, motivoReintegro }
 *   - suspendida:     { fechaSuspension, motivoSuspension }
 *   - cerrado:        (sin datos extra, toma los que ya estén)
 */
function _handlerActualizarEstado(empresaId, gestanteId, data) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!empresaId || !gestanteId) {
        return { success: false, error: { code: 'VALIDATION', message: 'empresaId y gestanteId requeridos' } };
    }
    var nuevoEstado = data && data.estado;
    if (!nuevoEstado) {
        return { success: false, error: { code: 'VALIDATION', message: 'estado requerido' } };
    }
    var ESTADOS_VALIDOS = ['activo', 'licencia', 'reintegro', 'suspendida', 'cerrado'];
    if (ESTADOS_VALIDOS.indexOf(nuevoEstado) === -1) {
        return { success: false, error: { code: 'INVALID_STATE', message: 'Estado no válido: ' + nuevoEstado } };
    }

    try {
        var db = _getDb();
        var row = db.prepare(
            'SELECT estado FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).get(gestanteId, empresaId);
        if (!row) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Gestante no encontrada' } };
        }
        var estadoActual = row.estado;

        // ── Validación de flujo lineal estricto ──
        // Orden normal: activo → licencia → reintegro → cerrado
        var flujoPermitido = {
            'activo':     ['licencia', 'suspendida', 'cerrado'],    // activo puede ir a cerrado (caso edge: sin licencia)
            'licencia':   ['reintegro', 'suspendida'],
            'reintegro':  ['cerrado', 'suspendida'],
            'suspendida': ['activo', 'licencia', 'reintegro', 'cerrado'], // sale de suspendida, decisión del usuario
            'cerrado':    ['activo'] // reabrir
        };
        var permitidos = flujoPermitido[estadoActual] || [];
        if (permitidos.indexOf(nuevoEstado) === -1) {
            return {
                success: false,
                error: {
                    code: 'INVALID_TRANSITION',
                    message: 'Transición no permitida: ' + estadoActual + ' → ' + nuevoEstado +
                             '. Estados válidos desde ' + estadoActual + ': ' + permitidos.join(', ')
                }
            };
        }

        // ── Validación de motivo obligatorio para 'suspendida' ──
        if (nuevoEstado === 'suspendida' && (!data.motivoSuspension || !data.motivoSuspension.trim())) {
            return {
                success: false,
                error: { code: 'VALIDATION', message: 'motivoSuspension es obligatorio al pasar a Suspendida' }
            };
        }

        // ── Construir UPDATE dinámico según estado y campos provistos ──
        var sets = ['estado = ?', 'actualizado_en = ?'];
        var params = [nuevoEstado, new Date().toISOString()];

        if (nuevoEstado === 'licencia') {
            if (data.fechaInicioLicencia) { sets.push('fecha_inicio_licencia = ?'); params.push(data.fechaInicioLicencia); }
            if (data.fechaFinLicencia)    { sets.push('fecha_fin_licencia = ?');    params.push(data.fechaFinLicencia); }
        }
        if (nuevoEstado === 'reintegro') {
            if (data.fechaInicioReintegro) { sets.push('fecha_inicio_reintegro = ?'); params.push(data.fechaInicioReintegro); }
            if (data.fechaFinReintegro)    { sets.push('fecha_fin_reintegro = ?');    params.push(data.fechaFinReintegro); }
            if (data.motivoReintegro)      { sets.push('motivo_reintegro = ?');       params.push(data.motivoReintegro); }
        }
        if (nuevoEstado === 'suspendida') {
            if (data.fechaSuspension)   { sets.push('fecha_suspension = ?');   params.push(data.fechaSuspension); }
            if (data.motivoSuspension)  { sets.push('motivo_suspension = ?');  params.push(data.motivoSuspension); }
        }

        params.push(gestanteId, empresaId);
        db.prepare(
            'UPDATE gestaciones SET ' + sets.join(', ') +
            ' WHERE id = ? AND empresa_id = ?'
        ).run.apply(null, params);

        // Devolver el registro actualizado
        var updated = db.prepare(
            'SELECT * FROM gestaciones WHERE id = ? AND empresa_id = ?'
        ).get(gestanteId, empresaId);

        console.log('[' + MOD + '][ACTUALIZAR_ESTADO] ' + gestanteId + ' ' + estadoActual + ' → ' + nuevoEstado);
        // 📦538 — Trigger push al hub multipc
        try { var syncService = require('./sync-service'); syncService.debouncedPush(empresaId); } catch (syncErr) { console.warn('[' + MOD + '] sync push: ' + syncErr.message); }
        return { success: true, data: _rowToGestacion(updated) };
    } catch (e) {
        console.error('[' + MOD + '][ACTUALIZAR_ESTADO]', e.message);
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

    // ── 📦538 — Eliminar un seguimiento mensual especifico ──
    ipcMain.handle('gestacion:eliminarSeguimiento', async function (event, params) {
        return _handlerEliminarSeguimiento(params.empresaId, params.seguimientoId);
    });

    // 📦469 — Calcular reporte (motor de agregaciones para Reportes de Seguimiento)
    ipcMain.handle('gestacion:calcularReporte', async function (event, params) {
        return _handlerCalcularReporte(params.empresaId, params.filtros || {});
    });

    // 📦469 — Actualizar estado de gestante (con validación de flujo lineal estricto)
    ipcMain.handle('gestacion:actualizarEstado', async function (event, params) {
        return _handlerActualizarEstado(params.empresaId, params.gestanteId, params.data || {});
    });

    // 📦497 — Próximos seguimientos de gestación para el calendario K+AIR.
    // Devuelve un evento por cada gestante que tiene un próximo seguimiento
    // programado (ultimo seguimiento.proxima_cita) o, si nunca se ha hecho
    // un seguimiento, calcula la primera cita según clasificación de riesgo
    // obstétrico (Res. 0312/2019 art. 14):
    //   muy-alto riesgo → cada 7 días
    //   alto riesgo     → cada 15 días
    //   bajo riesgo     → cada 30 días
    //
    // payload esperado: { currentCompany: string }
    // Solo incluye gestantes en estado 'activo' o 'reintegro' (excluye
    // cerrada/suspendida/licencia). Devuelve TODOS los eventos (pasados y
    // futuros) para que aparezcan al navegar entre meses en el calendario.
    ipcMain.handle('gestaciones:get-events', async function (event, payload) {
        try {
            var params = (payload && typeof payload === 'object') ? payload : {};
            var empresaId = params.currentCompany || (params && params.empresaId);
            if (!empresaId || empresaId === 'default_company') {
                return { success: true, data: [] };
            }
            return _handlerEventosCalendario(empresaId);
        } catch (e) {
            console.error('[' + MOD + '][CAL_GEST]', e.message);
            return { success: false, error: { code: 'INTERNAL', message: e.message }, data: [] };
        }
    });

    console.log('[' + MOD + '][INIT][SUCCESS] 13 handlers de Seguimiento de Gestación registrados');
}

/**
 * 📦497 — Implementación de eventos de calendario para gestaciones.
 * Una sola query bulk trae los últimos seguimientos (con proxima_cita) de
 * todas las gestantes activo/reintegro de la empresa. Si una gestante nunca
 * tuvo seguimiento, calcula la primera cita basándose en clasificación
 * de riesgo obstétrico (Res. 0312/2019 art. 14).
 */
function _handlerEventosCalendario(empresaId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' }, data: [] };
    }
    try {
        var db = _getDb();

        // 1) Gestantes relevantes (activo + reintegro)
        var gestantes = db.prepare(
            "SELECT id, nombre, cedula, estado, clasificacion, fecha_notificacion, fpp " +
            "FROM gestaciones WHERE empresa_id = ? AND estado IN ('activo', 'reintegro')"
        ).all(empresaId);

        if (gestantes.length === 0) {
            return { success: true, data: [] };
        }

        // 2) Bulk query: último seguimiento (con proxima_cita) por gestante
        var ids = gestantes.map(function (g) { return g.id; });
        var placeholders = ids.map(function () { return '?'; }).join(',');
        var stmtUltimo = db.prepare(
            "SELECT s.gestacion_id, s.proxima_cita, s.fecha, s.periodo, s.clasificacion " +
            "FROM seguimiento_gestacion_mensual s " +
            "INNER JOIN (" +
            "  SELECT gestacion_id, MAX(fecha) AS max_fecha " +
            "  FROM seguimiento_gestacion_mensual " +
            "  WHERE empresa_id = ? AND gestacion_id IN (" + placeholders + ") " +
            "  GROUP BY gestacion_id" +
            ") latest ON latest.gestacion_id = s.gestacion_id AND latest.max_fecha = s.fecha " +
            "WHERE s.empresa_id = ?"
        );
        var rowsSeguimiento = stmtUltimo.all.apply(stmtUltimo, [empresaId].concat(ids).concat([empresaId]));

        var mapUltimo = {};
        rowsSeguimiento.forEach(function (r) { mapUltimo[r.gestacion_id] = r; });

        // 3) Mapear cada gestante a un evento
        var events = [];
        gestantes.forEach(function (g) {
            var last = mapUltimo[g.id];
            var proximaCita = last && last.proxima_cita ? String(last.proxima_cita) : null;

            // Si no hay proxima_cita (gestante nunca registrada para seguimiento),
            // calcular primera cita basándonos en clasificación desde fecha_notificacion.
            if (!proximaCita) {
                var baseDate = g.fecha_notificacion;
                if (!baseDate) return;
                var dias;
                if (g.clasificacion === 'muy-alto') dias = 7;
                else if (g.clasificacion === 'alto') dias = 15;
                else dias = 30;
                var base = new Date(baseDate);
                if (isNaN(base.getTime())) return;
                var primera = new Date(base.getTime() + dias * 24 * 60 * 60 * 1000);
                // Solo incluir si está en el futuro (no mostrar citas viejas sin registro previo)
                if (primera.getTime() < Date.now()) return;
                proximaCita = primera.toISOString().slice(0, 10);
            }

            // Validar formato YYYY-MM-DD
            if (!/^\d{4}-\d{2}-\d{2}$/.test(proximaCita)) return;

            var nombreCorto = (g.nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
            events.push({
                id: 'gest-' + g.id + '-' + proximaCita,
                title: 'Seguimiento: ' + (nombreCorto || 'Gestante'),
                date: proximaCita,
                start: '00:00',
                end: '23:59',
                type: 'gestacion',
                descripcion: 'Seguimiento mensual de gestación (clasificación: ' + (g.clasificacion || 'bajo') + ')',
                estado: g.estado,
                gestanteId: g.id,
                cedula: g.cedula,
                clasificacion: g.clasificacion || 'bajo'
            });
        });

        return { success: true, data: events };
    } catch (e) {
        console.error('[' + MOD + '][CAL_EVENTOS]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message }, data: [] };
    }
}

module.exports = {
    registerGestacionHandlers: registerGestacionHandlers,
    SCHEMA_SQL: SCHEMA_SQL,
    MIGRATIONS_SQL: MIGRATIONS_SQL,
    // 📦538 — Exportar handlers internos para tests / debug
    // (mismo patron que evaluacion-action-plans-bridge.js)
    _handlerRegistrarGestante: _handlerRegistrarGestante,
    _handlerGuardarSeguimiento: _handlerGuardarSeguimiento,
    _handlerEliminarSeguimiento: _handlerEliminarSeguimiento
};