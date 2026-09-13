/**
 * =====================================================================
 * 📦701 (2026-08-11) — SUBMÓDULO SEGUIMIENTO DE INCAPACIDADES
 * Respaldo en SQLite (kair.db) — fuente de verdad primaria
 *
 * Bridge IPC · Backend Process
 *
 * Persistencia: SQLite central en app.getPath('userData')/kair.db
 * Tablas:
 *   - seguimiento_incapacidad_caso        (1 fila por caso: trabajador + incapacidad + PRIC + calificación)
 *   - seguimiento_incapacidad_registro    (FK al caso, para los seguimientos múltiples que el usuario registra)
 *
 * FLUJO NUEVO (invertido vs el anterior):
 *   - ANTES:  Form → IPC → Python → Excel
 *   - AHORA:  Form → IPC → SQLite  (PRIMARIO)
 *             Botón "Exportar a Excel" → IPC → Python → Excel (SECUNDARIO, on-demand)
 *
 * El Excel sigue siendo requerido para la integración con el equipo que
 * trabaja con archivos (reportes, formatos, etc.), pero ya no es la
 * fuente de verdad. Si se daña, los datos están en SQLite y se pueden
 * re-exportar a un Excel nuevo.
 *
 * Patrón idéntico a gestacion-bridge.js:
 *   - registerHandlers(app, deps) recibe getDb() por inyección
 *   - ipcMain.handle('namespace:action', async (event, params) => { ... })
 *   - Retorna { success: true, data } o { success: false, error: { code, message } }
 * =====================================================================
 */

const { ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// ─── Dependencias inyectadas ───
var _getDb = null;
var _deps = null;

/**
 * Nombre del submódulo (para logs).
 */
var MOD = '📦701-SEGUIMIENTO-INCAPACIDAD';

// =====================================================================
// SCHEMA SQL · Se ejecuta en initDbOnce() desde main.js (idempotente)
// Tabla con TODAS las columnas separadas (normalizada) como pidió el user.
// Las recomendaciones (que son un array) se guardan como JSON en una
// columna TEXT porque vienen como lista de objetos del frontend.
// =====================================================================
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_caso (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL,
    -- Trabajador
    cedula TEXT NOT NULL,
    nombre TEXT NOT NULL,
    fecha_nacimiento TEXT,
    genero TEXT,
    cargo TEXT,
    area TEXT,
    fecha_ingreso TEXT,
    antiguedad TEXT,
    tipo_contrato TEXT,
    salario TEXT,
    eps TEXT,
    afp TEXT,
    arl TEXT,
    peso TEXT,
    talla TEXT,
    imc TEXT,
    actividades_extralaborales TEXT,
    tipo_evento TEXT,
    tipo_cargo TEXT,
    dominancia TEXT,
    -- Incapacidad
    fecha_inicio TEXT,
    fecha_fin TEXT,
    dias_acumulados TEXT,
    codigo_cie10 TEXT,
    descripcion_diagnostico TEXT,
    numero_prorrogas TEXT,
    fecha_ultima_prorroga TEXT,
    cie10_dx2 TEXT,
    origen_dx2 TEXT,
    cie10_dx3 TEXT,
    origen_dx3 TEXT,
    inc_fecha_reincorporacion TEXT,
    inc_tipo_reintegro TEXT,
    inc_adaptaciones TEXT,
    inc_fecha_cierre TEXT,
    inc_motivo_cierre TEXT,
    inc_observaciones_finales TEXT,
    -- PRIC · Condiciones de Salud
    fecha_examen_medico TEXT,
    resultado_examen_medico TEXT,
    fecha_examen_periodico TEXT,
    resultado_examen_post_incapacidad TEXT,
    trabajador_remoto TEXT,
    fecha_inicio_remoto TEXT,
    -- PRIC · Etapa 1: Captura
    caso_ingresado_pric TEXT,
    mecanismo_deteccion TEXT,
    fecha_ingreso_pric TEXT,
    -- PRIC · Etapa 2: Plan de Tratamiento
    trabajador_plan_tratamiento TEXT,
    meta_rehabilitacion TEXT,
    fecha_emision_plan TEXT,
    fecha_probable_reintegro TEXT,
    -- PRIC · Etapa 3: Ejecución y Seguimiento
    fecha_proxima_cita TEXT,
    observaciones_seguimiento TEXT,
    fecha_apt_reincorporacion TEXT,
    modalidad_reincorporacion TEXT,
    fecha_reintegro TEXT,
    periodicidad_seguimiento TEXT,
    recomendaciones_laborales TEXT,
    fecha_vencimiento_recomendaciones TEXT,
    descripcion_recomendaciones TEXT,
    fecha_proximo_seguimiento_recomendaciones TEXT,
    tiene_desercion TEXT,
    logro_mejoria_medica TEXT,
    -- PRIC · Etapa 3: Seguimientos (sección intermedia)
    fecha_seguimiento_1 TEXT,
    descripcion_seguimiento_1 TEXT,
    fecha_seguimiento_2 TEXT,
    descripcion_seguimiento_2 TEXT,
    -- PRIC · Etapa 4: Reincorporación
    fecha_reincorporacion TEXT,
    tipo_reintegro TEXT,
    adaptaciones TEXT,
    -- PRIC · Etapa 5: Cierre
    fecha_cierre TEXT,
    motivo_cierre TEXT,
    fecha_calificacion_pcl TEXT,
    porcentaje_pcl_calificacion TEXT,
    -- PRIC · Historial de Diagnóstico
    cie10_calificada_dx1 TEXT,
    origen_dx_calificada1 TEXT,
    cie10_calificada_dx2 TEXT,
    origen_dx_calificada2 TEXT,
    cie10_calificada_dx3 TEXT,
    origen_dx_calificada3 TEXT,
    cie10_calificada_dx4 TEXT,
    origen_dx_calificada4 TEXT,
    origen_caso TEXT,
    ingreso_sve TEXT,
    anio_ultima_calificacion_pcl TEXT,
    anio_seguimiento_empresa TEXT,
    -- Calificación Regional
    estado_proceso_regional TEXT,
    fecha_solicitud_regional TEXT,
    fecha_dictamen_regional TEXT,
    porcentaje_pcl_regional TEXT,
    origen_calificacion_regional TEXT,
    fecha_estructuracion_regional TEXT,
    observaciones_calificacion_regional TEXT,
    -- Calificación Nacional
    estado_proceso_nacional TEXT,
    fecha_solicitud_nacional TEXT,
    fecha_dictamen_nacional TEXT,
    porcentaje_pcl_nacional TEXT,
    origen_calificacion_nacional TEXT,
    fecha_estructuracion_nacional TEXT,
    observaciones_calificacion_nacional TEXT,
    -- Metadata
    estado TEXT NOT NULL DEFAULT 'activo',
    recomendaciones_json TEXT,
    recomendaciones_count INTEGER DEFAULT 0,
    exportado_excel_en TEXT,
    exportado_excel_fila INTEGER,
    creado_en TEXT NOT NULL,
    actualizado_en TEXT NOT NULL,
    UNIQUE(empresa_id, cedula, fecha_inicio, fecha_fin)
  );

  CREATE INDEX IF NOT EXISTS idx_seg_inc_empresa
    ON seguimiento_incapacidad_caso(empresa_id);
  CREATE INDEX IF NOT EXISTS idx_seg_inc_empresa_estado
    ON seguimiento_incapacidad_caso(empresa_id, estado);
  CREATE INDEX IF NOT EXISTS idx_seg_inc_empresa_cedula
    ON seguimiento_incapacidad_caso(empresa_id, cedula);
  CREATE INDEX IF NOT EXISTS idx_seg_inc_exportado
    ON seguimiento_incapacidad_caso(exportado_excel_en);

  -- Tabla de seguimientos múltiples (los registros mensuales que el usuario
  -- agrega al caso). FK con CASCADE para que al borrar el caso se borren
  -- sus seguimientos.
  CREATE TABLE IF NOT EXISTS seguimiento_incapacidad_registro (
    id TEXT PRIMARY KEY,
    caso_id TEXT NOT NULL,
    empresa_id TEXT NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'seguimiento',
    descripcion TEXT,
    profesional TEXT,
    recomendaciones TEXT,
    proxima_cita TEXT,
    creado_en TEXT NOT NULL,
    FOREIGN KEY (caso_id) REFERENCES seguimiento_incapacidad_caso(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_seg_reg_caso
    ON seguimiento_incapacidad_registro(caso_id);
  CREATE INDEX IF NOT EXISTS idx_seg_reg_empresa
    ON seguimiento_incapacidad_registro(empresa_id);
`;

// =====================================================================
// Helpers internos
// =====================================================================

/**
 * Genera un ID único estilo UUID v4 simple.
 */
function _generarId() {
    return 'seg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Normaliza el payload del frontend a un objeto plano con los campos de
 * la tabla seguimiento_incapacidad_caso. Esto es el "aplanado" que
 * matchea con la estructura de columnas de la tabla.
 */
function _aplanarCaso(empresaId, data) {
    var t = data.trabajador || {};
    var i = data.incapacidad || {};
    var p = data.pric || {};
    var c = data.calificacion || {};

    var recomendaciones = data.recommendations || data.recomendaciones || [];
    var recomendacionesJson = JSON.stringify(recomendaciones);
    var recomendacionesCount = Array.isArray(recomendaciones) ? recomendaciones.length : 0;

    return {
        id: data.id || _generarId(),
        empresa_id: empresaId,
        cedula: (t.cedula || data.employeeId || '').toString().trim(),
        nombre: t.nombre || data.employeeName || '',
        fecha_nacimiento: t.fechaNacimiento || '',
        genero: t.genero || '',
        cargo: t.cargo || '',
        area: t.area || '',
        fecha_ingreso: t.fechaIngreso || '',
        antiguedad: t.antiguedad || '',
        tipo_contrato: t.tipoContrato || '',
        salario: t.salario || '',
        eps: t.eps || '',
        afp: t.afp || '',
        arl: t.arl || '',
        peso: t.peso || '',
        talla: t.talla || '',
        imc: t.imc || '',
        actividades_extralaborales: t.actividadesExtralaborales || '',
        tipo_evento: t.tipoEvento || '',
        tipo_cargo: t.tipoCargo || '',
        dominancia: t.dominancia || '',
        fecha_inicio: i.fechaInicio || data.fechaInicio || '',
        fecha_fin: i.fechaFin || data.fechaFin || '',
        dias_acumulados: i.diasAcumulados || '',
        codigo_cie10: i.codigoCie10 || '',
        descripcion_diagnostico: i.descripcionDiagnostico || '',
        numero_prorrogas: i.numeroProrrogas || '',
        fecha_ultima_prorroga: i.fechaUltimaProrroga || '',
        cie10_dx2: i.cie10Dx2 || '',
        origen_dx2: i.origenDx2 || '',
        cie10_dx3: i.cie10Dx3 || '',
        origen_dx3: i.origenDx3 || '',
        inc_fecha_reincorporacion: i.fechaReincorporacion || '',
        inc_tipo_reintegro: i.tipoReintegro || '',
        inc_adaptaciones: i.adaptaciones || '',
        inc_fecha_cierre: i.fechaCierre || '',
        inc_motivo_cierre: i.motivoCierre || '',
        inc_observaciones_finales: i.observacionesFinales || '',
        fecha_examen_medico: p.fechaExamenMedico || '',
        resultado_examen_medico: p.resultadoExamenMedico || '',
        fecha_examen_periodico: p.fechaExamenPeriodico || '',
        resultado_examen_post_incapacidad: p.resultadoExamenPostIncapacidad || '',
        trabajador_remoto: p.trabajadorRemoto || '',
        fecha_inicio_remoto: p.fechaInicioRemoto || '',
        caso_ingresado_pric: p.casoIngresadoPRIC || '',
        mecanismo_deteccion: p.mecanismoDeteccion || '',
        fecha_ingreso_pric: p.fechaIngresoPRIC || '',
        trabajador_plan_tratamiento: p.trabajadorPlanTratamiento || '',
        meta_rehabilitacion: p.metaRehabilitacion || '',
        fecha_emision_plan: p.fechaEmisionPlan || '',
        fecha_probable_reintegro: p.fechaProbableReintegro || '',
        fecha_proxima_cita: p.fechaProximaCita || '',
        observaciones_seguimiento: p.observacionesSeguimiento || '',
        fecha_apt_reincorporacion: p.fechaAPTReincorporacion || '',
        modalidad_reincorporacion: p.modalidadReincorporacion || '',
        fecha_reintegro: p.fechaReintegro || '',
        periodicidad_seguimiento: p.periodicidadSeguimiento || '',
        recomendaciones_laborales: p.recomendacionesLaborales || '',
        fecha_vencimiento_recomendaciones: p.fechaVencimientoRecomendaciones || '',
        descripcion_recomendaciones: p.descripcionRecomendaciones || '',
        fecha_proximo_seguimiento_recomendaciones: p.fechaProximoSeguimientoRecomendaciones || '',
        tiene_desercion: p.tieneDesercion || '',
        logro_mejoria_medica: p.logroMejoriaMedica || '',
        fecha_seguimiento_1: p.fechaSeguimiento1 || '',
        descripcion_seguimiento_1: p.descripcionSeguimiento1 || '',
        fecha_seguimiento_2: p.fechaSeguimiento2 || '',
        descripcion_seguimiento_2: p.descripcionSeguimiento2 || '',
        fecha_reincorporacion: p.fechaReincorporacion || '',
        tipo_reintegro: p.tipoReintegro || '',
        adaptaciones: p.adaptaciones || '',
        fecha_cierre: p.fechaCierre || '',
        motivo_cierre: p.motivoCierre || '',
        fecha_calificacion_pcl: p.fechaCalificacionPCL || '',
        porcentaje_pcl_calificacion: p.porcentajePCLCalificacion || '',
        cie10_calificada_dx1: p.cie10CalificadaDX1 || '',
        origen_dx_calificada1: p.origenDX1 || '',
        cie10_calificada_dx2: p.cie10CalificadaDX2 || '',
        origen_dx_calificada2: p.origenDX2 || '',
        cie10_calificada_dx3: p.cie10CalificadaDX3 || '',
        origen_dx_calificada3: p.origenDX3 || '',
        cie10_calificada_dx4: p.cie10CalificadaDX4 || '',
        origen_dx_calificada4: p.origenDX4 || '',
        origen_caso: p.origenCaso || '',
        ingreso_sve: p.ingresoSVE || '',
        anio_ultima_calificacion_pcl: p.anioUltimaCalificacionPCL || '',
        anio_seguimiento_empresa: p.anioSeguimientoEmpresa || '',
        estado_proceso_regional: c.estadoProcesoRegional || '',
        fecha_solicitud_regional: c.fechaSolicitudRegional || '',
        fecha_dictamen_regional: c.fechaDictamenRegional || '',
        porcentaje_pcl_regional: c.porcentajePclRegional || '',
        origen_calificacion_regional: c.origenCalificacionRegional || '',
        fecha_estructuracion_regional: c.fechaEstructuracionRegional || '',
        observaciones_calificacion_regional: c.observacionesCalificacionRegional || '',
        estado_proceso_nacional: c.estadoProcesoNacional || '',
        fecha_solicitud_nacional: c.fechaSolicitudNacional || '',
        fecha_dictamen_nacional: c.fechaDictamenNacional || '',
        porcentaje_pcl_nacional: c.porcentajePclNacional || '',
        origen_calificacion_nacional: c.origenCalificacionNacional || '',
        fecha_estructuracion_nacional: c.fechaEstructuracionNacional || '',
        observaciones_calificacion_nacional: c.observacionesCalificacionNacional || '',
        estado: data.estado || 'activo',
        recomendaciones_json: recomendacionesJson,
        recomendaciones_count: recomendacionesCount,
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString()
    };
}

/**
 * Convierte un row de la BD al mismo formato anidado que el frontend
 * envía (trabajador, incapacidad, pric, calificacion) + extra (id, fechas).
 * Esto permite que el frontend re-abra el caso sin cambios.
 */
function _expandirCaso(row, registros) {
    if (!row) return null;

    var recomendaciones = [];
    if (row.recomendaciones_json) {
        try { recomendaciones = JSON.parse(row.recomendaciones_json); } catch (e) { /* ignore */ }
    }

    return {
        id: row.id,
        empresaId: row.empresa_id,
        estado: row.estado,
        exportadoExcelEn: row.exportado_excel_en,
        exportadoExcelFila: row.exportado_excel_fila,
        creadoEn: row.creado_en,
        actualizadoEn: row.actualizado_en,
        employeeId: row.cedula,
        employeeName: row.nombre,
        recommendations: recomendaciones,
        // Estructura anidada (compatible con el frontend)
        trabajador: {
            cedula: row.cedula,
            nombre: row.nombre,
            fechaNacimiento: row.fecha_nacimiento,
            genero: row.genero,
            cargo: row.cargo,
            area: row.area,
            fechaIngreso: row.fecha_ingreso,
            antiguedad: row.antiguedad,
            tipoContrato: row.tipo_contrato,
            salario: row.salario,
            eps: row.eps,
            afp: row.afp,
            arl: row.arl,
            peso: row.peso,
            talla: row.talla,
            imc: row.imc,
            actividadesExtralaborales: row.actividades_extralaborales,
            tipoEvento: row.tipo_evento,
            tipoCargo: row.tipo_cargo,
            dominancia: row.dominancia
        },
        incapacidad: {
            fechaInicio: row.fecha_inicio,
            fechaFin: row.fecha_fin,
            diasAcumulados: row.dias_acumulados,
            codigoCie10: row.codigo_cie10,
            descripcionDiagnostico: row.descripcion_diagnostico,
            numeroProrrogas: row.numero_prorrogas,
            fechaUltimaProrroga: row.fecha_ultima_prorroga,
            cie10Dx2: row.cie10_dx2,
            origenDx2: row.origen_dx2,
            cie10Dx3: row.cie10_dx3,
            origenDx3: row.origen_dx3,
            fechaReincorporacion: row.inc_fecha_reincorporacion,
            tipoReintegro: row.inc_tipo_reintegro,
            adaptaciones: row.inc_adaptaciones,
            fechaCierre: row.inc_fecha_cierre,
            motivoCierre: row.inc_motivo_cierre,
            observacionesFinales: row.inc_observaciones_finales,
            seguimientos: registros || []
        },
        pric: {
            fechaExamenMedico: row.fecha_examen_medico,
            resultadoExamenMedico: row.resultado_examen_medico,
            fechaExamenPeriodico: row.fecha_examen_periodico,
            resultadoExamenPostIncapacidad: row.resultado_examen_post_incapacidad,
            trabajadorRemoto: row.trabajador_remoto,
            fechaInicioRemoto: row.fecha_inicio_remoto,
            casoIngresadoPRIC: row.caso_ingresado_pric,
            mecanismoDeteccion: row.mecanismo_deteccion,
            fechaIngresoPRIC: row.fecha_ingreso_pric,
            trabajadorPlanTratamiento: row.trabajador_plan_tratamiento,
            metaRehabilitacion: row.meta_rehabilitacion,
            fechaEmisionPlan: row.fecha_emision_plan,
            fechaProbableReintegro: row.fecha_probable_reintegro,
            fechaProximaCita: row.fecha_proxima_cita,
            observacionesSeguimiento: row.observaciones_seguimiento,
            fechaAPTReincorporacion: row.fecha_apt_reincorporacion,
            modalidadReincorporacion: row.modalidad_reincorporacion,
            fechaReintegro: row.fecha_reintegro,
            periodicidadSeguimiento: row.periodicidad_seguimiento,
            recomendacionesLaborales: row.recomendaciones_laborales,
            fechaVencimientoRecomendaciones: row.fecha_vencimiento_recomendaciones,
            descripcionRecomendaciones: row.descripcion_recomendaciones,
            fechaProximoSeguimientoRecomendaciones: row.fecha_proximo_seguimiento_recomendaciones,
            tieneDesercion: row.tiene_desercion,
            logroMejoriaMedica: row.logro_mejoria_medica,
            fechaSeguimiento1: row.fecha_seguimiento_1,
            descripcionSeguimiento1: row.descripcion_seguimiento_1,
            fechaSeguimiento2: row.fecha_seguimiento_2,
            descripcionSeguimiento2: row.descripcion_seguimiento_2,
            fechaReincorporacion: row.fecha_reincorporacion,
            tipoReintegro: row.tipo_reintegro,
            adaptaciones: row.adaptaciones,
            fechaCierre: row.fecha_cierre,
            motivoCierre: row.motivo_cierre,
            fechaCalificacionPCL: row.fecha_calificacion_pcl,
            porcentajePCLCalificacion: row.porcentaje_pcl_calificacion,
            cie10CalificadaDX1: row.cie10_calificada_dx1,
            origenDX1: row.origen_dx_calificada1,
            cie10CalificadaDX2: row.cie10_calificada_dx2,
            origenDX2: row.origen_dx_calificada2,
            cie10CalificadaDX3: row.cie10_calificada_dx3,
            origenDX3: row.origen_dx_calificada3,
            cie10CalificadaDX4: row.cie10_calificada_dx4,
            origenDX4: row.origen_dx_calificada4,
            origenCaso: row.origen_caso,
            ingresoSVE: row.ingreso_sve,
            anioUltimaCalificacionPCL: row.anio_ultima_calificacion_pcl,
            anioSeguimientoEmpresa: row.anio_seguimiento_empresa
        },
        calificacion: {
            estadoProcesoRegional: row.estado_proceso_regional,
            fechaSolicitudRegional: row.fecha_solicitud_regional,
            fechaDictamenRegional: row.fecha_dictamen_regional,
            porcentajePclRegional: row.porcentaje_pcl_regional,
            origenCalificacionRegional: row.origen_calificacion_regional,
            fechaEstructuracionRegional: row.fecha_estructuracion_regional,
            observacionesCalificacionRegional: row.observaciones_calificacion_regional,
            estadoProcesoNacional: row.estado_proceso_nacional,
            fechaSolicitudNacional: row.fecha_solicitud_nacional,
            fechaDictamenNacional: row.fecha_dictamen_nacional,
            porcentajePclNacional: row.porcentaje_pcl_nacional,
            origenCalificacionNacional: row.origen_calificacion_nacional,
            fechaEstructuracionNacional: row.fecha_estructuracion_nacional,
            observacionesCalificacionNacional: row.observaciones_calificacion_nacional
        }
    };
}

// =====================================================================
// Handlers IPC
// =====================================================================

/**
 * Guardar (insertar o actualizar) un caso de seguimiento.
 * Si ya existe (empresa_id, cedula, fecha_inicio, fecha_fin), actualiza.
 * Si no, inserta un nuevo row.
 */
function _handlerGuardar(empresaId, data) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!empresaId) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'empresaId requerido' } };
    }
    if (!data || !data.trabajador || !data.trabajador.cedula) {
        return { success: false, error: { code: 'VALIDATION', message: 'Faltan datos del trabajador (cedula requerido)' } };
    }

    try {
        var db = _getDb();
        var caso = _aplanarCaso(empresaId, data);

        // Detectar si ya existe (mismo empresa + cedula + fechas)
        var existente = db.prepare(
            'SELECT id, exportado_excel_en, exportado_excel_fila FROM seguimiento_incapacidad_caso WHERE empresa_id = ? AND cedula = ? AND fecha_inicio = ? AND fecha_fin = ?'
        ).get(empresaId, caso.cedula, caso.fecha_inicio, caso.fecha_fin);

        var esActualizacion = false;
        if (existente) {
            // Actualizar: mantener id + metadatos de export si los hay
            caso.id = existente.id;
            caso.exportado_excel_en = existente.exportado_excel_en;
            caso.exportado_excel_fila = existente.exportado_excel_fila;
            caso.actualizado_en = new Date().toISOString();
            esActualizacion = true;
        }

        // Columnas de la tabla
        var columnas = [
            'id', 'empresa_id', 'cedula', 'nombre', 'fecha_nacimiento', 'genero', 'cargo', 'area',
            'fecha_ingreso', 'antiguedad', 'tipo_contrato', 'salario', 'eps', 'afp', 'arl',
            'peso', 'talla', 'imc', 'actividades_extralaborales', 'tipo_evento', 'tipo_cargo', 'dominancia',
            'fecha_inicio', 'fecha_fin', 'dias_acumulados', 'codigo_cie10', 'descripcion_diagnostico',
            'numero_prorrogas', 'fecha_ultima_prorroga', 'cie10_dx2', 'origen_dx2', 'cie10_dx3', 'origen_dx3',
            'inc_fecha_reincorporacion', 'inc_tipo_reintegro', 'inc_adaptaciones', 'inc_fecha_cierre',
            'inc_motivo_cierre', 'inc_observaciones_finales',
            'fecha_examen_medico', 'resultado_examen_medico', 'fecha_examen_periodico',
            'resultado_examen_post_incapacidad', 'trabajador_remoto', 'fecha_inicio_remoto',
            'caso_ingresado_pric', 'mecanismo_deteccion', 'fecha_ingreso_pric',
            'trabajador_plan_tratamiento', 'meta_rehabilitacion', 'fecha_emision_plan', 'fecha_probable_reintegro',
            'fecha_proxima_cita', 'observaciones_seguimiento', 'fecha_apt_reincorporacion',
            'modalidad_reincorporacion', 'fecha_reintegro', 'periodicidad_seguimiento',
            'recomendaciones_laborales', 'fecha_vencimiento_recomendaciones', 'descripcion_recomendaciones',
            'fecha_proximo_seguimiento_recomendaciones', 'tiene_desercion', 'logro_mejoria_medica',
            'fecha_seguimiento_1', 'descripcion_seguimiento_1', 'fecha_seguimiento_2', 'descripcion_seguimiento_2',
            'fecha_reincorporacion', 'tipo_reintegro', 'adaptaciones', 'fecha_cierre', 'motivo_cierre',
            'fecha_calificacion_pcl', 'porcentaje_pcl_calificacion',
            'cie10_calificada_dx1', 'origen_dx_calificada1', 'cie10_calificada_dx2', 'origen_dx_calificada2',
            'cie10_calificada_dx3', 'origen_dx_calificada3', 'cie10_calificada_dx4', 'origen_dx_calificada4',
            'origen_caso', 'ingreso_sve', 'anio_ultima_calificacion_pcl', 'anio_seguimiento_empresa',
            'estado_proceso_regional', 'fecha_solicitud_regional', 'fecha_dictamen_regional',
            'porcentaje_pcl_regional', 'origen_calificacion_regional', 'fecha_estructuracion_regional',
            'observaciones_calificacion_regional',
            'estado_proceso_nacional', 'fecha_solicitud_nacional', 'fecha_dictamen_nacional',
            'porcentaje_pcl_nacional', 'origen_calificacion_nacional', 'fecha_estructuracion_nacional',
            'observaciones_calificacion_nacional',
            'estado', 'recomendaciones_json', 'recomendaciones_count',
            'exportado_excel_en', 'exportado_excel_fila',
            'creado_en', 'actualizado_en'
        ];

        var placeholders = columnas.map(function () { return '?'; }).join(', ');
        var values = columnas.map(function (c) { return caso[c] !== undefined ? caso[c] : null; });

        if (esActualizacion) {
            // UPDATE
            var setClause = columnas.filter(function (c) { return c !== 'id' && c !== 'creado_en'; })
                .map(function (c) { return c + ' = ?'; }).join(', ');
            var updateValues = columnas.filter(function (c) { return c !== 'id' && c !== 'creado_en'; })
                .map(function (c) { return caso[c] !== undefined ? caso[c] : null; });
            db.prepare('UPDATE seguimiento_incapacidad_caso SET ' + setClause + ' WHERE id = ?').run(updateValues.concat([caso.id]));
        } else {
            // INSERT
            db.prepare('INSERT INTO seguimiento_incapacidad_caso (' + columnas.join(', ') + ') VALUES (' + placeholders + ')').run(values);
        }

        // Guardar seguimientos múltiples (borrar los anteriores del caso y re-insertar)
        var seguimientos = (data.incapacidad && data.incapacidad.seguimientos) || [];
        if (Array.isArray(seguimientos) && seguimientos.length > 0) {
            db.prepare('DELETE FROM seguimiento_incapacidad_registro WHERE caso_id = ?').run(caso.id);
            var stmtReg = db.prepare(
                'INSERT INTO seguimiento_incapacidad_registro (id, caso_id, empresa_id, fecha, tipo, descripcion, profesional, recomendaciones, proxima_cita, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            for (var idx = 0; idx < seguimientos.length; idx++) {
                var seg = seguimientos[idx] || {};
                stmtReg.run(
                    caso.id + '-reg-' + idx + '-' + Date.now(),
                    caso.id,
                    empresaId,
                    seg.fecha || '',
                    seg.tipo || 'seguimiento',
                    seg.descripcion || '',
                    seg.profesional || '',
                    seg.recomendaciones || '',
                    seg.proximaCita || seg.proxima_cita || '',
                    new Date().toISOString()
                );
            }
        }

        return {
            success: true,
            data: {
                id: caso.id,
                esActualizacion: esActualizacion,
                mensaje: esActualizacion ? 'Caso actualizado en BD' : 'Caso guardado en BD'
            }
        };
    } catch (e) {
        // 📦706 — Log detallado para diagnóstico
        console.error('[' + MOD + '][GUARDAR] Error completo:', e);
        console.error('[' + MOD + '][GUARDAR] Stack:', e.stack);
        // Mensaje más descriptivo (incluye el código SQLite si existe)
        var msg = e.message || String(e);
        if (e.code) msg = '[' + e.code + '] ' + msg;
        return { success: false, error: { code: 'DB_ERROR', message: msg, details: e.stack } };
    }
}

/**
 * Listar todos los casos de una empresa (resumen).
 */
function _handlerListar(empresaId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var rows = db.prepare(
            'SELECT id, cedula, nombre, fecha_inicio, fecha_fin, dias_acumulados, codigo_cie10, descripcion_diagnostico, estado, recomendaciones_count, exportado_excel_en, exportado_excel_fila, creado_en, actualizado_en FROM seguimiento_incapacidad_caso WHERE empresa_id = ? ORDER BY actualizado_en DESC'
        ).all(empresaId);
        return { success: true, data: rows };
    } catch (e) {
        console.error('[' + MOD + '][LISTAR]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * 📦701-fix4 — Buscar TODOS los casos de una cédula en una empresa.
 * Usado por el renderer cuando el usuario reabre un caso existente desde
 * la UI de seguimiento. Devuelve los casos completos (con todos los campos)
 * para que el renderer pueda cargarlos en el formulario.
 *
 * Retorna { success, data: [caso, ...] } o { success, data: [] } si no hay.
 */
function _handlerBuscarPorCedula(empresaId, cedula) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    if (!empresaId) {
        return { success: false, error: { code: 'NO_COMPANY', message: 'empresaId requerido' } };
    }
    if (!cedula) {
        return { success: false, error: { code: 'NO_CEDULA', message: 'cedula requerida' } };
    }
    try {
        var db = _getDb();
        // 📦701-fix8 — Normalizar la cédula: viene formateada desde el display
        // (ej "1,044,392,755") pero en BD está sin formato ("1044392755").
        // Sin esta normalización la query no matchea y siempre retorna 0 filas.
        var cedulaNormalizada = String(cedula || '').replace(/,/g, '').replace(/\./g, '').trim();
        // Traer TODOS los casos (con todos los campos) de esta cédula
        // (puede haber varios: el mismo empleado pudo tener varias incapacidades)
        var rows = db.prepare(
            'SELECT * FROM seguimiento_incapacidad_caso WHERE empresa_id = ? AND cedula = ? ORDER BY actualizado_en DESC'
        ).all(empresaId, cedulaNormalizada);
        // Expandir cada caso (DB row → frontend JSON) para que el renderer
        // pueda usarlo directamente en el formulario.
        var casos = rows.map(function (row) {
            // Cargar seguimientos del caso también
            var regs = db.prepare(
                'SELECT * FROM seguimiento_incapacidad_registro WHERE caso_id = ? ORDER BY fecha ASC, creado_en ASC'
            ).all(row.id);
            // 📦701-fix4 (CORRECCIÓN): _expandirCaso espera (row, registros),
            // NO (empresaId, row) — antes pasaba mal los argumentos y devolvía
            // un objeto con strings en lugar de los datos correctos.
            var casoExpandido = _expandirCaso(row, regs);
            // Sobrescribir seguimientos con el formato plano que espera el
            // frontend (no el formato de BD row).
            casoExpandido.seguimientos = regs.map(function (r) {
                return {
                    id: r.id,
                    fecha: r.fecha,
                    tipo: r.tipo,
                    descripcion: r.descripcion,
                    profesional: r.profesional,
                    recomendaciones: r.recomendaciones,
                    proximaCita: r.proxima_cita
                };
            });
            casoExpandido.recomendaciones = [];
            try {
                if (row.recomendaciones_json) {
                    casoExpandido.recomendaciones = JSON.parse(row.recomendaciones_json);
                }
            } catch (e) {
                // Ignorar si no se puede parsear
            }
            return casoExpandido;
        });
        return { success: true, data: casos };
    } catch (e) {
        console.error('[' + MOD + '][BUSCAR_POR_CEDULA]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * Obtener un caso completo con sus seguimientos.
 */
function _handlerObtener(empresaId, casoId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var row = db.prepare(
            'SELECT * FROM seguimiento_incapacidad_caso WHERE id = ? AND empresa_id = ?'
        ).get(casoId, empresaId);
        if (!row) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } };
        }
        var registros = db.prepare(
            'SELECT * FROM seguimiento_incapacidad_registro WHERE caso_id = ? ORDER BY fecha DESC, creado_en DESC'
        ).all(casoId);
        return { success: true, data: _expandirCaso(row, registros) };
    } catch (e) {
        console.error('[' + MOD + '][OBTENER]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * Eliminar un caso (y sus seguimientos via CASCADE).
 */
function _handlerEliminar(empresaId, casoId) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var result = db.prepare('DELETE FROM seguimiento_incapacidad_caso WHERE id = ? AND empresa_id = ?').run(casoId, empresaId);
        if (result.changes === 0) {
            return { success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado' } };
        }
        return { success: true, data: { eliminados: result.changes } };
    } catch (e) {
        console.error('[' + MOD + '][ELIMINAR]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * Marcar un caso como exportado a Excel (con la fila donde quedó).
 */
function _handlerMarcarExportado(empresaId, casoId, fila) {
    if (!_getDb) {
        return { success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } };
    }
    try {
        var db = _getDb();
        var result = db.prepare(
            'UPDATE seguimiento_incapacidad_caso SET exportado_excel_en = ?, exportado_excel_fila = ?, actualizado_en = ? WHERE id = ? AND empresa_id = ?'
        ).run(new Date().toISOString(), fila || null, new Date().toISOString(), casoId, empresaId);
        return { success: result.changes > 0, data: { cambios: result.changes } };
    } catch (e) {
        console.error('[' + MOD + '][MARCAR_EXPORTADO]', e.message);
        return { success: false, error: { code: 'DB_ERROR', message: e.message } };
    }
}

/**
 * Exportar un caso a Excel (vía Python como antes).
 * Toma el caso desde la BD, lo envía al script Python, y si tiene éxito,
 * marca el caso como exportado.
 */
function _handlerExportarExcel(empresaId, casoId) {
    if (!_getDb) {
        return Promise.resolve({ success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } });
    }
    if (!_deps || !_deps.getPython || !_deps.obtenerRutaPri || !_deps.getPythonScriptPath) {
        return Promise.resolve({ success: false, error: { code: 'NO_DEPS', message: 'Funciones de Python no inyectadas' } });
    }

    return new Promise(function (resolve) {
        try {
            var db = _getDb();
            var row = db.prepare(
                'SELECT * FROM seguimiento_incapacidad_caso WHERE id = ? AND empresa_id = ?'
            ).get(casoId, empresaId);
            if (!row) {
                return resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Caso no encontrado en BD' } });
            }
            var registros = db.prepare(
                'SELECT * FROM seguimiento_incapacidad_registro WHERE caso_id = ? ORDER BY fecha DESC'
            ).all(casoId);
            var casoExpandido = _expandirCaso(row, registros);

            // Convertir a la estructura que espera el script Python
            var followUpData = {
                employeeId: casoExpandido.employeeId,
                employeeName: casoExpandido.employeeName,
                fechaFin: casoExpandido.incapacidad.fechaFin,
                diasAcumulados: casoExpandido.incapacidad.diasAcumulados,
                recommendations: casoExpandido.recommendations,
                trabajador: casoExpandido.trabajador,
                incapacidad: casoExpandido.incapacidad,
                pric: casoExpandido.pric,
                calificacion: casoExpandido.calificacion
            };

            _deps.obtenerRutaPri(empresaId).then(function (filePath) {
                if (!filePath) {
                    return resolve({ success: false, error: { code: 'NO_EXCEL', message: 'No se encontró el archivo PRI.xlsx' } });
                }
                _deps.getPython().then(function (pythonPath) {
                    var scriptPath = _deps.getPythonScriptPath('actualizar_ausentismo.py');
                    var child = spawn(pythonPath, [
                        scriptPath, 'guardar_seguimiento', empresaId, filePath, JSON.stringify(followUpData)
                    ], { cwd: path.dirname(scriptPath), env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }), windowsHide: true });

                    var buffer = '';
                    var excelFila = null;
                    var excelExito = false;

                    child.stdout.on('data', function (data) {
                        buffer += data.toString();
                        var lines = buffer.split('\n');
                        buffer = lines.pop();
                        lines.forEach(function (line) {
                            line = line.trim();
                            if (!line) return;
                            try {
                                var obj = JSON.parse(line);
                                if (obj.type === 'result' && obj.payload) {
                                    if (obj.payload.success) {
                                        excelExito = true;
                                        excelFila = obj.payload.fila || null;
                                    }
                                }
                            } catch (e) { /* ignore */ }
                        });
                    });

                    child.on('close', function () {
                        if (excelExito) {
                            // Marcar como exportado en la BD
                            _handlerMarcarExportado(empresaId, casoId, excelFila);
                            resolve({ success: true, data: { fila: excelFila, mensaje: 'Caso exportado a Excel correctamente' } });
                        } else {
                            resolve({ success: false, error: { code: 'PYTHON_ERROR', message: 'El script Python no confirmó éxito. Ver consola.' } });
                        }
                    });

                    child.on('error', function (err) {
                        console.error('[' + MOD + '][EXPORTAR_EXCEL]', err.message);
                        resolve({ success: false, error: { code: 'PYTHON_SPAWN', message: err.message } });
                    });
                }).catch(function (err) {
                    resolve({ success: false, error: { code: 'NO_PYTHON', message: err.message } });
                });
            }).catch(function (err) {
                resolve({ success: false, error: { code: 'NO_EXCEL', message: err.message } });
            });
        } catch (e) {
            console.error('[' + MOD + '][EXPORTAR_EXCEL]', e.message);
            resolve({ success: false, error: { code: 'INTERNAL', message: e.message } });
        }
    });
}

/**
 * Exportar TODOS los casos pendientes de exportar a Excel.
 * Útil para sincronización masiva.
 */
function _handlerExportarTodos(empresaId) {
    if (!_getDb) {
        return Promise.resolve({ success: false, error: { code: 'NO_DB', message: 'Base de datos no disponible' } });
    }
    try {
        var db = _getDb();
        var rows = db.prepare(
            'SELECT id FROM seguimiento_incapacidad_caso WHERE empresa_id = ? AND exportado_excel_en IS NULL'
        ).all(empresaId);

        var promesas = rows.map(function (row) {
            return _handlerExportarExcel(empresaId, row.id);
        });

        return Promise.all(promesas).then(function (resultados) {
            var exitosos = resultados.filter(function (r) { return r.success; }).length;
            var fallidos = resultados.filter(function (r) { return !r.success; }).length;
            return {
                success: true,
                data: {
                    total: rows.length,
                    exitosos: exitosos,
                    fallidos: fallidos,
                    resultados: resultados
                }
            };
        });
    } catch (e) {
        console.error('[' + MOD + '][EXPORTAR_TODOS]', e.message);
        return Promise.resolve({ success: false, error: { code: 'DB_ERROR', message: e.message } });
    }
}

// =====================================================================
// Register IPC handlers
// =====================================================================
function registerHandlers(app, deps) {
    _getDb = deps && deps.getDb ? deps.getDb : null;
    _deps = deps || null;

    console.log('[' + MOD + '][INIT][INFO] Registrando handlers de Seguimiento de Incapacidad...');

    // ── Guardar (insertar o actualizar) un caso ──
    ipcMain.handle('seguimiento-incapacidad:guardar', async function (event, params) {
        return _handlerGuardar(params.empresaId, params.data || params);
    });

    // ── Listar todos los casos de una empresa ──
    ipcMain.handle('seguimiento-incapacidad:listar', async function (event, params) {
        return _handlerListar(params.empresaId);
    });

    // ── Buscar casos de una cédula (📦701-fix4) ──
    // Usado por el renderer cuando el usuario reabre un caso existente.
    // Devuelve TODOS los casos de esa cédula con todos los campos +
    // sus seguimientos múltiples, listos para cargar en el formulario.
    ipcMain.handle('seguimiento-incapacidad:buscarPorCedula', async function (event, params) {
        return _handlerBuscarPorCedula(params.empresaId, params.cedula);
    });

    // ── Obtener un caso completo con sus seguimientos ──
    ipcMain.handle('seguimiento-incapacidad:obtener', async function (event, params) {
        return _handlerObtener(params.empresaId, params.casoId);
    });

    // ── Eliminar un caso ──
    ipcMain.handle('seguimiento-incapacidad:eliminar', async function (event, params) {
        return _handlerEliminar(params.empresaId, params.casoId);
    });

    // ── Exportar un caso a Excel ──
    ipcMain.handle('seguimiento-incapacidad:exportarExcel', async function (event, params) {
        return _handlerExportarExcel(params.empresaId, params.casoId);
    });

    // ── Exportar TODOS los casos pendientes a Excel ──
    ipcMain.handle('seguimiento-incapacidad:exportarTodos', async function (event, params) {
        return _handlerExportarTodos(params.empresaId);
    });

    // ── Marcar como exportado (uso interno, no debería llamarse desde UI) ──
    ipcMain.handle('seguimiento-incapacidad:marcarExportado', async function (event, params) {
        return _handlerMarcarExportado(params.empresaId, params.casoId, params.fila);
    });

    console.log('[' + MOD + '][INIT][SUCCESS] Handlers de Seguimiento de Incapacidad registrados (6 canales)');
}

module.exports = {
    SCHEMA_SQL: SCHEMA_SQL,
    MIGRATIONS_SQL: [], // No migrations needed for new table
    // 📦701-fix — Exportar también con el nombre largo que usa main.js
    // (alias del corto para que el destructuring no quede undefined)
    registerHandlers: registerHandlers,
    registerSeguimientoIncapacidadHandlers: registerHandlers,
    // Exportar internals para testing
    _internals: {
        _aplanarCaso: _aplanarCaso,
        _expandirCaso: _expandirCaso
    }
};
