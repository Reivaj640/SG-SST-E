// main/gestion-humana-bridge.js
// Bridge IPC del módulo Gestión Humana (v0.1.191) — FASE 1
//
// Patrón: mismo que main/presupuesto-bridge.js
// Firma: registerGestionHumanaHandlers(app, deps)
//   - app: electron app instance
//   - deps: { getDb, validateSession }
//
// FASE 1: 5 read handlers implementados:
//   - gh:list-contrataciones (filtros: companyName, estado)
//   - gh:get-contratacion (por id)
//   - gh:list-personal (filtros: companyName, estado, search)
//   - gh:get-personal (por id)
//   - gh:list-sedes (filtros: companyName)
//
// STUB (Fases 2-3): write contratacion, write personal, write sedes, marcar-paso, cambiar-estado
// Diag siempre activo.

const MOD = 'GESTION-HUMANA';

let _getDb = null;
let _validateSession = null;
let _app = null;             // electron app instance (set en registerGestionHumanaHandlers)
let _firmaDb = null;         // conexión read-only a firma-service/data/firma.sqlite (singleton lazy)
let _path = null;            // require('path') cacheado

function _err(code, message, extra) {
  var e = { success: false, error: { code: code, message: message } };
  if (extra) e.error.extra = extra;
  return e;
}
function _ok(data) {
  return { success: true, data: data || {} };
}
function _stub(channel, payload) {
  // Stub para handlers pendientes
  console.log('[' + MOD + '][' + channel + '] (stub) payload:', JSON.stringify(payload || {}));
  return _err('NOT_IMPLEMENTED', 'Handler "' + channel + '" pendiente', { phase: 2 });
}

// ========== ID GENERATOR ==========
function _newId(prefix) {
  return prefix + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

// ========== AUTH (soft — mismo patrón que presupuesto) ==========
function _checkAuth(token) {
  if (!token) return { ok: true, user: null, softAuth: true };
  if (!_validateSession || typeof _validateSession !== 'function') {
    return { ok: true, user: null, softAuth: true };
  }
  var session = _validateSession(token);
  if (!session || !session.ok) {
    console.warn('[' + MOD + '] Token inválido en handler, continuando con soft auth');
    return { ok: true, user: null, softAuth: true };
  }
  return { ok: true, user: session.user };
}

// ========== COMPANY LOOKUP ==========
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

// ========== ROW → OBJECT CONVERTERS (snake_case → camelCase) ==========
function _rowToContratacion(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombres: row.nombres,
    apellidos: row.apellidos,
    cedula: row.cedula,
    telefono: row.telefono,
    cargo: row.cargo,
    salario: row.salario,
    fechaIngreso: row.fecha_ingreso,
    sedeId: row.sede_id,
    empresaUsuaria: row.empresa_usuaria,
    pasoActual: row.paso_actual,
    memoRecibido: row.memo_recibido,
    memoFecha: row.memo_fecha,
    memoNotas: row.memo_notas,
    contactoRealizado: row.contacto_realizado,
    contactoFecha: row.contacto_fecha,
    contactoNotas: row.contacto_notas,
    examenesProgramados: row.examenes_programados,
    examenesFecha: row.examenes_fecha,
    examenesIps: row.examenes_ips,
    examenesNotas: row.examenes_notas,
    documentosFirmados: row.documentos_firmados,
    documentosFecha: row.documentos_fecha,
    documentosNotas: row.documentos_notas,
    afiliacionesCompletadas: row.afiliaciones_completadas,
    afiliacionesFecha: row.afiliaciones_fecha,
    afiliacionesNotas: row.afiliaciones_notas,
    s400Activado: row.s400_activado,
    s400Fecha: row.s400_fecha,
    s400Notas: row.s400_notas,
    estado: row.estado,
    trabajadorId: row.trabajador_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToPersonal(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombres: row.nombres,
    apellidos: row.apellidos,
    cedula: row.cedula,
    tipoDocumento: row.tipo_documento,
    fechaExpCedula: row.fecha_exp_cedula,
    lugarExpCedula: row.lugar_exp_cedula,
    fechaNacimiento: row.fecha_nacimiento,
    lugarNacimiento: row.lugar_nacimiento,
    telefono: row.telefono,
    celular: row.celular,
    email: row.email,
    estadoCivil: row.estado_civil,
    nivelEducativo: row.nivel_educativo,
    direccion: row.direccion,
    barrio: row.barrio,
    ciudad: row.ciudad,
    cargo: row.cargo,
    salario: row.salario,
    tipoContrato: row.tipo_contrato,
    fechaIngreso: row.fecha_ingreso,
    fechaRetiro: row.fecha_retiro,
    estado: row.estado,
    eps: row.eps,
    epsFecha: row.eps_fecha,
    pension: row.pension,
    pensionFecha: row.pension_fecha,
    arl: row.arl,
    arlFecha: row.arl_fecha,
    cajaCompensacion: row.caja_compensacion,
    cajaFecha: row.caja_fecha,
    activoS400: row.activo_s400,
    empresaUsuaria: row.empresa_usuaria,
    banco: row.banco,
    numeroCuenta: row.numero_cuenta,
    sedeId: row.sede_id,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToSede(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    nombre: row.nombre,
    direccion: row.direccion,
    ciudad: row.ciudad,
    activo: row.activo,
    createdAt: row.created_at
  };
}

// ========== ROW → OBJECT CONVERTERS (Fase 5 — 6 tablas nuevas) ==========
function _rowToVacacion(row) {
  if (!row) return null;
  return {
    id: row.id,
    trabajadorId: row.trabajador_id,
    empresaId: row.empresa_id,
    fechaSolicitud: row.fecha_solicitud,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    diasSolicitados: row.dias_solicitados,
    diasPendientes: row.dias_pendientes,
    estado: row.estado,
    aprobadoPor: row.aprobado_por,
    fechaAprobacion: row.fecha_aprobacion,
    notas: row.notas,
    notificarCliente: row.notificar_cliente,
    clienteNotificado: row.cliente_notificado,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToPermiso(row) {
  if (!row) return null;
  return {
    id: row.id,
    trabajadorId: row.trabajador_id,
    empresaId: row.empresa_id,
    tipo: row.tipo,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    dias: row.dias,
    estado: row.estado,
    motivo: row.motivo,
    soporteUrl: row.soporte_url,
    prorroga: row.prorroga,
    notas: row.notas,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToDocumento(row) {
  if (!row) return null;
  return {
    id: row.id,
    trabajadorId: row.trabajador_id,
    empresaId: row.empresa_id,
    tipo: row.tipo,
    titulo: row.titulo,
    contenido: row.contenido,
    // firmaId eliminado en LEGACY-SIGN-REMOVE (2026-08-20). El estado 'firmado'
    // ahora se popula desde firma-service (ver I-101 / I-105).
    estado: row.estado,
    fechaFirma: row.fecha_firma,
    version: row.version,
    // 📦102.2.E · id de la solicitud de firma en firma-service. Se setea
    // cuando se llama POST /sign-requests desde la UI (I-102.2.D). El polling
    // consulta este id para actualizar estado y fecha_firma.
    idSolicitudFirma: row.id_solicitud_firma,
    rutaArchivo: row.ruta_archivo,         // 📦764 · ruta del archivo generado
    nombreArchivo: row.nombre_archivo,     // 📦764 · nombre del archivo generado
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToAnuncio(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    titulo: row.titulo,
    contenido: row.contenido,
    tipo: row.tipo,
    dirigidoA: row.dirigido_a,
    sedeId: row.sede_id,
    cargoFiltro: row.cargo_filtro,
    fechaPublicacion: row.fecha_publicacion,
    fechaExpiracion: row.fecha_expiracion,
    publicadoPor: row.publicado_por,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _rowToMensaje(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    remitenteId: row.remitente_id,
    destinatarioId: row.destinatario_id,
    asunto: row.asunto,
    contenido: row.contenido,
    leido: row.leido,
    fechaLectura: row.fecha_lectura,
    prioridad: row.prioridad,
    createdAt: row.created_at
  };
}

// ========== READ HANDLERS (Fase 1) ==========

/**
 * gh:list-contrataciones
 * Filtros: companyName (requerido), estado (opcional: en_proceso | completado | cancelado)
 * Devuelve todas las contrataciones de la empresa, ordenadas por fecha_ingreso DESC.
 */
function _handlerListContrataciones(token, companyName, estado) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM contrataciones WHERE empresa_id = ?";
    var params = [company.company_key];
    if (estado && typeof estado === 'string') {
      sql += " AND estado = ?";
      params.push(estado);
    }
    sql += " ORDER BY fecha_ingreso DESC, created_at DESC";

    var stmtC = localDb.prepare(sql);
    var rows = stmtC.all.apply(stmtC, params);
    var contrataciones = rows.map(_rowToContratacion);

    return _ok({
      contrataciones: contrataciones,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: contrataciones.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-contrataciones]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-contratacion
 * Devuelve una contratación completa por su ID.
 */
function _handlerGetContratacion(token, contratacionId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!contratacionId || typeof contratacionId !== 'string') {
    return _err('INVALID_INPUT', 'contratacionId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM contrataciones WHERE id = ?").get(contratacionId);
    if (!row) {
      return _err('NOT_FOUND', 'Contratación "' + contratacionId + '" no encontrada');
    }
    return _ok({ contratacion: _rowToContratacion(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-contratacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:list-personal
 * Filtros: companyName (requerido), estado (opcional), search (opcional, busca en nombres/apellidos/cedula)
 * Devuelve todos los trabajadores activos (activo=1) de la empresa.
 */
function _handlerListPersonal(token, companyName, estado, search) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM base_personal WHERE empresa_id = ? AND activo = 1";
    var params = [company.company_key];
    if (estado && typeof estado === 'string') {
      sql += " AND estado = ?";
      params.push(estado);
    }
    if (search && typeof search === 'string' && search.trim()) {
      var like = '%' + search.trim().toLowerCase() + '%';
      sql += " AND (LOWER(nombres) LIKE ? OR LOWER(apellidos) LIKE ? OR cedula LIKE ?)";
      params.push(like, like, like);
    }
    sql += " ORDER BY nombres, apellidos";

    var stmtP = localDb.prepare(sql);
    var rows = stmtP.all.apply(stmtP, params);
    var personales = rows.map(_rowToPersonal);

    return _ok({
      personales: personales,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: personales.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-personal]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-personal
 * Devuelve un trabajador completo por su ID.
 */
function _handlerGetPersonal(token, personalId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!personalId || typeof personalId !== 'string') {
    return _err('INVALID_INPUT', 'personalId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM base_personal WHERE id = ?").get(personalId);
    if (!row) {
      return _err('NOT_FOUND', 'Trabajador "' + personalId + '" no encontrado');
    }
    return _ok({ personal: _rowToPersonal(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-personal]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:list-sedes
 * Devuelve las sedes activas de la empresa.
 */
function _handlerListSedes(token, companyName) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var rows = localDb.prepare(
      "SELECT * FROM gh_sedes WHERE empresa_id = ? AND activo = 1 ORDER BY nombre"
    ).all(company.company_key);
    var sedes = rows.map(_rowToSede);
    return _ok({
      sedes: sedes,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: sedes.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-sedes]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== WRITE CONTRATACIÓN HANDLERS (Fase 2) ==========

/**
 * gh:create-contratacion
 * Crea una nueva contratación en paso 1 (memo) con estado en_proceso.
 * Input: { token, companyName, data: { nombres, apellidos, cedula?, telefono?, cargo, salario?, fechaIngreso, sedeId?, empresaUsuaria? } }
 * Devuelve: { success, data: { contratacionId } }
 */
function _handlerCreateContratacion(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.nombres || typeof data.nombres !== 'string') {
    return _err('INVALID_INPUT', 'nombres es requerido');
  }
  if (!data.apellidos || typeof data.apellidos !== 'string') {
    return _err('INVALID_INPUT', 'apellidos es requerido');
  }
  if (!data.cargo || typeof data.cargo !== 'string') {
    return _err('INVALID_INPUT', 'cargo es requerido');
  }
  if (!data.fechaIngreso || typeof data.fechaIngreso !== 'string') {
    return _err('INVALID_INPUT', 'fechaIngreso es requerido (ISO 8601)');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var id = _newId('ct-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO contrataciones (id, empresa_id, nombres, apellidos, cedula, telefono, cargo, salario, " +
      "  fecha_ingreso, sede_id, empresa_usuaria, paso_actual, estado, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'en_proceso', ?, ?)"
    ).run(
      id, company.company_key,
      data.nombres, data.apellidos,
      data.cedula || null, data.telefono || null,
      data.cargo, data.salario || null,
      data.fechaIngreso,
      data.sedeId || null, data.empresaUsuaria || null,
      now, now
    );
    return _ok({ contratacionId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-contratacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-contratacion
 * Actualiza campos básicos de una contratación (whitelist).
 * NO actualiza campos de pasos del pipeline — usar gh:marcar-paso para eso.
 * Input: { token, contratacionId, updates: { nombres?, apellidos?, cedula?, telefono?, cargo?, salario?, fechaIngreso?, sedeId?, empresaUsuaria? } }
 * Devuelve: { success, data: { contratacionId } }
 */
function _handlerUpdateContratacion(token, contratacionId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!contratacionId || typeof contratacionId !== 'string') {
    return _err('INVALID_INPUT', 'contratacionId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  // Whitelist: solo estos campos se pueden actualizar via update-contratacion
  var fieldMap = {
    nombres: 'nombres',
    apellidos: 'apellidos',
    cedula: 'cedula',
    telefono: 'telefono',
    cargo: 'cargo',
    salario: 'salario',
    fechaIngreso: 'fecha_ingreso',
    sedeId: 'sede_id',
    empresaUsuaria: 'empresa_usuaria'
  };

  try {
    var existing = localDb.prepare('SELECT id FROM contrataciones WHERE id = ?').get(contratacionId);
    if (!existing) return _err('NOT_FOUND', 'Contratación no encontrada');

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(updates[key]);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar. Permitidos: ' + Object.keys(fieldMap).join(', '));
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(contratacionId);

    var stmtU = localDb.prepare('UPDATE contrataciones SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU.run.apply(stmtU, values);
    return _ok({ contratacionId: contratacionId });
  } catch (e) {
    console.error('[' + MOD + '][update-contratacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:delete-contratacion
 * Cancela una contratación (soft via estado='cancelado', no se borra la fila).
 * Input: { token, contratacionId }
 * Devuelve: { success, data: { contratacionId, cancelled: true } }
 */
function _handlerDeleteContratacion(token, contratacionId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!contratacionId || typeof contratacionId !== 'string') {
    return _err('INVALID_INPUT', 'contratacionId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, estado FROM contrataciones WHERE id = ?').get(contratacionId);
    if (!existing) return _err('NOT_FOUND', 'Contratación no encontrada');
    if (existing.estado === 'cancelado') {
      return _err('ALREADY_DELETED', 'La contratación ya está cancelada');
    }

    var now = new Date().toISOString();
    localDb.prepare(
      "UPDATE contrataciones SET estado = 'cancelado', updated_at = ? WHERE id = ?"
    ).run(now, contratacionId);
    return _ok({ contratacionId: contratacionId, cancelled: true });
  } catch (e) {
    console.error('[' + MOD + '][delete-contratacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:marcar-paso
 * Avanza el pipeline de una contratación. Marca el paso como completado
 * (bool=1) y guarda la fecha + notas del paso.
 * Si pasoNum=6 (Activación S400), el estado pasa a 'completado'.
 *
 * Input: { token, contratacionId, pasoNum (1-6), fecha? (ISO 8601, default=now), notas? }
 * Devuelve: { success, data: { contratacionId, pasoActual, estado } }
 */
function _handlerMarcarPaso(token, contratacionId, pasoNum, fecha, notas) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!contratacionId || typeof contratacionId !== 'string') {
    return _err('INVALID_INPUT', 'contratacionId es requerido');
  }

  var pasoInt = parseInt(pasoNum, 10);
  if (isNaN(pasoInt) || pasoInt < 1 || pasoInt > 6) {
    return _err('INVALID_INPUT', 'pasoNum debe ser un entero entre 1 y 6');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  // Map pasoNum → columnas del schema
  var pasoFields = {
    1: { bool: 'memo_recibido',          fecha: 'memo_fecha',          notas: 'memo_notas' },
    2: { bool: 'contacto_realizado',     fecha: 'contacto_fecha',      notas: 'contacto_notas' },
    3: { bool: 'examenes_programados',   fecha: 'examenes_fecha',      notas: 'examenes_notas' },
    4: { bool: 'documentos_firmados',    fecha: 'documentos_fecha',    notas: 'documentos_notas' },
    5: { bool: 'afiliaciones_completadas', fecha: 'afiliaciones_fecha', notas: 'afiliaciones_notas' },
    6: { bool: 's400_activado',          fecha: 's400_fecha',          notas: 's400_notas' }
  };

  try {
    var existing = localDb.prepare('SELECT id, paso_actual, estado FROM contrataciones WHERE id = ?').get(contratacionId);
    if (!existing) return _err('NOT_FOUND', 'Contratación no encontrada');
    if (existing.estado === 'cancelado') {
      return _err('ALREADY_DELETED', 'La contratación está cancelada, no se puede marcar pasos');
    }

    var f = pasoFields[pasoInt];
    var fechaFinal = (fecha && typeof fecha === 'string') ? fecha : new Date().toISOString();
    var now = new Date().toISOString();
    var nuevoEstado = (pasoInt === 6) ? 'completado' : 'en_proceso';

    localDb.prepare(
      "UPDATE contrataciones SET paso_actual = ?, " + f.bool + " = 1, " + f.fecha + " = ?, " + f.notas + " = ?, " +
      "estado = ?, updated_at = ? WHERE id = ?"
    ).run(pasoInt, fechaFinal, notas || null, nuevoEstado, now, contratacionId);

    // 📦775 · Paso 6 (S400 Activado) = crear/vincular en base_personal
    // Cuando el user completa el pipeline de 6 pasos, el trabajador se "activa" en
    // base_personal para que aparezca en Base Personal y se actualicen los KPIs.
    var personalId = null;
    if (pasoInt === 6) {
      // Necesitamos el company_key para hacer la búsqueda/insert
      var companyKey = localDb.prepare('SELECT empresa_id FROM contrataciones WHERE id = ?').get(contratacionId).empresa_id;
      var ct = localDb.prepare('SELECT * FROM contrataciones WHERE id = ?').get(contratacionId);

      if (!ct.cedula) {
        // base_personal requiere cedula NOT NULL — sin cédula no se puede crear.
        // Log warning pero no fallar: el user puede agregar la cédula después
        // y reactivar manualmente con un nuevo paso 6 (marcando cancelado y reabriendo).
        console.warn('[marcar-paso] paso 6 sin cedula — no se crea en base_personal:', contratacionId);
      } else {
        // 1) Buscar si ya existe en base_personal (caso de re-contratación)
        var existing2 = localDb.prepare(
          'SELECT id FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1'
        ).get(companyKey, ct.cedula);

        if (existing2) {
          // Vincular al registro existente (no duplicar)
          personalId = existing2.id;
          console.log('[marcar-paso] vinculado a personal existente:', personalId);
        } else {
          // 2) Crear nuevo registro en base_personal
          personalId = _newId('bp-');
          localDb.prepare(
            "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, cargo, salario, " +
            "  fecha_ingreso, fecha_ingreso_s400, fecha_afiliaciones, sede_id, empresa_usuaria, " +
            "  activo_s400, estado, activo, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'activo', 1, ?, ?)"
          ).run(
            personalId, companyKey,
            ct.nombres, ct.apellidos, ct.cedula,
            ct.cargo, ct.salario,
            ct.fecha_ingreso, fechaFinal, ct.afiliaciones_fecha || null,
            ct.sede_id, ct.empresa_usuaria,
            now, now
          );
          console.log('[marcar-paso] creado en base_personal:', personalId);
        }

        // 3) Vincular la contratación con el personal_id
        localDb.prepare(
          "UPDATE contrataciones SET trabajador_id = ?, updated_at = ? WHERE id = ?"
        ).run(personalId, now, contratacionId);
      }
    }

    return _ok({
      contratacionId: contratacionId,
      pasoActual: pasoInt,
      estado: nuevoEstado,
      personalId: personalId
    });
  } catch (e) {
    console.error('[' + MOD + '][marcar-paso]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== WRITE PERSONAL HANDLERS (Fase 3) ==========

// Whitelist de estados válidos para base_personal
var _ESTADOS_PERSONAL = ['activo', 'incapacitado', 'vacaciones', 'permiso', 'maternidad', 'paternidad', 'luto', 'retirado'];

/**
 * gh:create-personal
 * Crea un nuevo trabajador en base_personal.
 * Input: { token, companyName, data: { nombres, apellidos, cedula, ...28 más (todos opcionales) } }
 * Devuelve: { success, data: { personalId } }
 *
 * Valida: nombres + apellidos + cedula requeridos, UNIQUE(empresa_id, cedula).
 */
function _handlerCreatePersonal(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.nombres || typeof data.nombres !== 'string') {
    return _err('INVALID_INPUT', 'nombres es requerido');
  }
  if (!data.apellidos || typeof data.apellidos !== 'string') {
    return _err('INVALID_INPUT', 'apellidos es requerido');
  }
  if (!data.cedula || typeof data.cedula !== 'string') {
    return _err('INVALID_INPUT', 'cedula es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Verificar UNIQUE(empresa_id, cedula)
    var existing = localDb.prepare(
      "SELECT id FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1"
    ).get(company.company_key, data.cedula);
    if (existing) {
      return _err('ALREADY_EXISTS', 'Ya existe un trabajador con cédula ' + data.cedula + ' en esta empresa', { existingId: existing.id });
    }

    var id = _newId('bp-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, " +
      "  tipo_documento, fecha_exp_cedula, lugar_exp_cedula, fecha_nacimiento, lugar_nacimiento, " +
      "  telefono, celular, email, estado_civil, nivel_educativo, " +
      "  direccion, barrio, ciudad, cargo, salario, tipo_contrato, " +
      "  fecha_ingreso, fecha_retiro, estado, " +
      "  eps, pension, arl, caja_compensacion, activo_s400, " +
      "  empresa_usuaria, banco, numero_cuenta, sede_id, " +
      "  activo, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, " +
      "  ?, ?, ?, ?, ?, " +
      "  ?, ?, ?, ?, ?, " +
      "  ?, ?, ?, ?, ?, ?, " +
      "  ?, ?, 'activo', " +
      "  ?, ?, ?, ?, ?, " +
      "  ?, ?, ?, ?, " +
      "  1, ?, ?)"
    ).run(
      id, company.company_key, data.nombres, data.apellidos, data.cedula,
      data.tipoDocumento || 'CC',
      data.fechaExpCedula || null, data.lugarExpCedula || null,
      data.fechaNacimiento || null, data.lugarNacimiento || null,
      data.telefono || null, data.celular || null, data.email || null,
      data.estadoCivil || null, data.nivelEducativo || null,
      data.direccion || null, data.barrio || null, data.ciudad || null,
      data.cargo || null, data.salario || null, data.tipoContrato || null,
      data.fechaIngreso || null, data.fechaRetiro || null,
      data.eps || null, data.pension || null, data.arl || null, data.cajaCompensacion || null,
      data.activoS400 || 0,
      data.empresaUsuaria || null, data.banco || null, data.numeroCuenta || null,
      data.sedeId || null,
      now, now
    );
    return _ok({ personalId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-personal]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-personal
 * Actualiza campos editables de un trabajador. Whitelist de campos permitidos.
 * NO permite tocar: id, empresa_id, created_at, activo (usar delete en su lugar).
 * Input: { token, personalId, updates: { nombres?, apellidos?, ... } }
 * Devuelve: { success, data: { personalId } }
 */
function _handlerUpdatePersonal(token, personalId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!personalId || typeof personalId !== 'string') {
    return _err('INVALID_INPUT', 'personalId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  // Whitelist camelCase → snake_case
  var fieldMap = {
    nombres: 'nombres',
    apellidos: 'apellidos',
    cedula: 'cedula',
    tipoDocumento: 'tipo_documento',
    fechaExpCedula: 'fecha_exp_cedula',
    lugarExpCedula: 'lugar_exp_cedula',
    fechaNacimiento: 'fecha_nacimiento',
    lugarNacimiento: 'lugar_nacimiento',
    telefono: 'telefono',
    celular: 'celular',
    email: 'email',
    estadoCivil: 'estado_civil',
    nivelEducativo: 'nivel_educativo',
    direccion: 'direccion',
    barrio: 'barrio',
    ciudad: 'ciudad',
    cargo: 'cargo',
    salario: 'salario',
    tipoContrato: 'tipo_contrato',
    fechaIngreso: 'fecha_ingreso',
    fechaRetiro: 'fecha_retiro',
    estado: 'estado',
    eps: 'eps',
    pension: 'pension',
    arl: 'arl',
    cajaCompensacion: 'caja_compensacion',
    activoS400: 'activo_s400',
    empresaUsuaria: 'empresa_usuaria',
    banco: 'banco',
    numeroCuenta: 'numero_cuenta',
    sedeId: 'sede_id'
  };

  try {
    var existing = localDb.prepare('SELECT id FROM base_personal WHERE id = ?').get(personalId);
    if (!existing) return _err('NOT_FOUND', 'Trabajador no encontrado');

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(updates[key]);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar. Use gh:cambiar-estado para estado o gh:delete-personal para retirar.');
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(personalId);

    var stmtU2 = localDb.prepare('UPDATE base_personal SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU2.run.apply(stmtU2, values);
    return _ok({ personalId: personalId });
  } catch (e) {
    console.error('[' + MOD + '][update-personal]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:delete-personal
 * Soft delete de un trabajador (activo=0, estado='retirado', fecha_retiro=now).
 * NO borra la fila, preserva histórico.
 * Input: { token, personalId }
 * Devuelve: { success, data: { personalId, retired: true } }
 */
function _handlerDeletePersonal(token, personalId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!personalId || typeof personalId !== 'string') {
    return _err('INVALID_INPUT', 'personalId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, activo FROM base_personal WHERE id = ?').get(personalId);
    if (!existing) return _err('NOT_FOUND', 'Trabajador no encontrado');
    if (existing.activo === 0) {
      return _err('ALREADY_DELETED', 'El trabajador ya está retirado');
    }

    var now = new Date().toISOString();
    localDb.prepare(
      "UPDATE base_personal SET activo = 0, estado = 'retirado', fecha_retiro = ?, updated_at = ? WHERE id = ?"
    ).run(now, now, personalId);
    return _ok({ personalId: personalId, retired: true });
  } catch (e) {
    console.error('[' + MOD + '][delete-personal]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:cambiar-estado
 * Cambia el estado de un trabajador (activo, vacaciones, permiso, etc).
 * Si estado='retirado' y no se pasa fechaRetiro, se setea automáticamente a now.
 * Input: { token, personalId, estado, fechaRetiro? (ISO 8601, default=null), notas? }
 * Devuelve: { success, data: { personalId, estado } }
 */
function _handlerCambiarEstado(token, personalId, estado, fechaRetiro, notas) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!personalId || typeof personalId !== 'string') {
    return _err('INVALID_INPUT', 'personalId es requerido');
  }
  if (!estado || typeof estado !== 'string') {
    return _err('INVALID_INPUT', 'estado es requerido');
  }
  if (_ESTADOS_PERSONAL.indexOf(estado) === -1) {
    return _err('INVALID_INPUT', 'estado debe ser uno de: ' + _ESTADOS_PERSONAL.join(', '));
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, activo FROM base_personal WHERE id = ?').get(personalId);
    if (!existing) return _err('NOT_FOUND', 'Trabajador no encontrado');
    if (existing.activo === 0) {
      return _err('ALREADY_DELETED', 'El trabajador está retirado, no se puede cambiar estado');
    }

    var now = new Date().toISOString();
    // Si estado=retirado y no hay fecha, auto-set
    var fechaFinal;
    if (estado === 'retirado') {
      fechaFinal = fechaRetiro || now;
    } else {
      fechaFinal = fechaRetiro || null;
    }

    localDb.prepare(
      "UPDATE base_personal SET estado = ?, fecha_retiro = ?, updated_at = ? WHERE id = ?"
    ).run(estado, fechaFinal, now, personalId);
    return _ok({ personalId: personalId, estado: estado, fechaRetiro: fechaFinal });
  } catch (e) {
    console.error('[' + MOD + '][cambiar-estado]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== WRITE SEDES HANDLERS (Fase 3) ==========

/**
 * gh:create-sede
 * Crea una nueva sede. UNIQUE(empresa_id, nombre) — no permite duplicados.
 * Input: { token, companyName, data: { nombre, direccion?, ciudad? } }
 * Devuelve: { success, data: { sedeId } }
 */
function _handlerCreateSede(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.nombre || typeof data.nombre !== 'string') {
    return _err('INVALID_INPUT', 'nombre es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // UNIQUE(empresa_id, nombre)
    var existing = localDb.prepare(
      "SELECT id FROM gh_sedes WHERE empresa_id = ? AND nombre = ? AND activo = 1"
    ).get(company.company_key, data.nombre);
    if (existing) {
      return _err('ALREADY_EXISTS', 'Ya existe una sede con nombre "' + data.nombre + '" en esta empresa', { existingId: existing.id });
    }

    var id = _newId('se-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO gh_sedes (id, empresa_id, nombre, direccion, ciudad, activo, created_at) " +
      "VALUES (?, ?, ?, ?, ?, 1, ?)"
    ).run(id, company.company_key, data.nombre, data.direccion || null, data.ciudad || null, now);
    return _ok({ sedeId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-sede]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-sede
 * Actualiza una sede. Whitelist: nombre, direccion, ciudad, activo.
 * Si se cambia el nombre, valida UNIQUE(empresa_id, nombre).
 * Input: { token, sedeId, updates: { nombre?, direccion?, ciudad?, activo? } }
 * Devuelve: { success, data: { sedeId } }
 */
function _handlerUpdateSede(token, sedeId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!sedeId || typeof sedeId !== 'string') {
    return _err('INVALID_INPUT', 'sedeId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  var fieldMap = {
    nombre: 'nombre',
    direccion: 'direccion',
    ciudad: 'ciudad',
    activo: 'activo'
  };

  try {
    var existing = localDb.prepare('SELECT id, empresa_id, nombre FROM gh_sedes WHERE id = ?').get(sedeId);
    if (!existing) return _err('NOT_FOUND', 'Sede no encontrada');

    // Si cambia nombre, validar UNIQUE
    if (updates.nombre && updates.nombre !== existing.nombre) {
      var dupe = localDb.prepare(
        "SELECT id FROM gh_sedes WHERE empresa_id = ? AND nombre = ? AND id != ? AND activo = 1"
      ).get(existing.empresa_id, updates.nombre, sedeId);
      if (dupe) {
        return _err('ALREADY_EXISTS', 'Ya existe otra sede con nombre "' + updates.nombre + '" en esta empresa');
      }
    }

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(updates[key]);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar');
    }

    values.push(sedeId);
    var stmtU3 = localDb.prepare('UPDATE gh_sedes SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU3.run.apply(stmtU3, values);
    return _ok({ sedeId: sedeId });
  } catch (e) {
    console.error('[' + MOD + '][update-sede]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== VACACIONES HANDLERS (Fase 5) ==========

/**
 * gh:list-vacaciones
 * Filtros: companyName (requerido), estado (opcional), trabajadorId (opcional).
 * Multi-tenant: filtra por empresa_id.
 */
function _handlerListVacaciones(token, companyName, estado, trabajadorId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM gh_vacaciones WHERE empresa_id = ?";
    var params = [company.company_key];
    if (estado && typeof estado === 'string') {
      sql += " AND estado = ?";
      params.push(estado);
    }
    if (trabajadorId && typeof trabajadorId === 'string') {
      sql += " AND trabajador_id = ?";
      params.push(trabajadorId);
    }
    sql += " ORDER BY fecha_inicio DESC, created_at DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var vacaciones = rows.map(_rowToVacacion);
    return _ok({
      vacaciones: vacaciones,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: vacaciones.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-vacaciones]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-vacacion
 */
function _handlerGetVacacion(token, vacacionId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!vacacionId || typeof vacacionId !== 'string') {
    return _err('INVALID_INPUT', 'vacacionId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM gh_vacaciones WHERE id = ?").get(vacacionId);
    if (!row) {
      return _err('NOT_FOUND', 'Vacación "' + vacacionId + '" no encontrada');
    }
    return _ok({ vacacion: _rowToVacacion(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-vacacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:create-vacacion
 * Crea una solicitud de vacaciones. Multi-tenant valida que el trabajador pertenezca a la empresa.
 */
function _handlerCreateVacacion(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.trabajadorId || typeof data.trabajadorId !== 'string') {
    return _err('INVALID_INPUT', 'trabajadorId es requerido');
  }
  if (!data.fechaSolicitud || typeof data.fechaSolicitud !== 'string') {
    return _err('INVALID_INPUT', 'fechaSolicitud es requerido (ISO 8601)');
  }
  if (!data.fechaInicio || typeof data.fechaInicio !== 'string') {
    return _err('INVALID_INPUT', 'fechaInicio es requerido (ISO 8601)');
  }
  if (!data.fechaFin || typeof data.fechaFin !== 'string') {
    return _err('INVALID_INPUT', 'fechaFin es requerido (ISO 8601)');
  }
  if (!data.diasSolicitados || typeof data.diasSolicitados !== 'number') {
    return _err('INVALID_INPUT', 'diasSolicitados es requerido (número)');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Validar que el trabajador pertenezca a la empresa (multi-tenant via JOIN)
    var trab = localDb.prepare(
      "SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?"
    ).get(data.trabajadorId, company.company_key);
    if (!trab) {
      return _err('TRABAJADOR_NOT_FOUND', 'Trabajador no encontrado en esta empresa', { trabajadorId: data.trabajadorId });
    }

    var id = _newId('va-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO gh_vacaciones (id, trabajador_id, empresa_id, fecha_solicitud, fecha_inicio, fecha_fin, " +
      "  dias_solicitados, dias_pendientes, estado, aprobado_por, fecha_aprobacion, notas, " +
      "  notificar_cliente, cliente_notificado, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id, data.trabajadorId, company.company_key,
      data.fechaSolicitud, data.fechaInicio, data.fechaFin,
      data.diasSolicitados, data.diasPendientes || null,
      data.estado || 'solicitada',
      data.aprobadoPor || null, data.fechaAprobacion || null, data.notas || null,
      data.notificarCliente ? 1 : 0,
      data.clienteNotificado ? 1 : 0,
      now, now
    );
    return _ok({ vacacionId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-vacacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-vacacion
 * Whitelist: diasPendientes, estado, aprobadoPor, fechaAprobacion, notas, notificarCliente, clienteNotificado.
 * NO permite cambiar trabajador_id, empresa_id, fechas, dias_solicitados.
 */
function _handlerUpdateVacacion(token, vacacionId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!vacacionId || typeof vacacionId !== 'string') {
    return _err('INVALID_INPUT', 'vacacionId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  var fieldMap = {
    diasPendientes: 'dias_pendientes',
    estado: 'estado',
    aprobadoPor: 'aprobado_por',
    fechaAprobacion: 'fecha_aprobacion',
    notas: 'notas',
    notificarCliente: 'notificar_cliente',
    clienteNotificado: 'cliente_notificado'
  };

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_vacaciones WHERE id = ?').get(vacacionId);
    if (!existing) return _err('NOT_FOUND', 'Vacación no encontrada');
    if (existing.estado === 'cancelado') {
      return _err('ALREADY_DELETED', 'La vacación está cancelada');
    }

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        var v = updates[key];
        // Normalizar booleans a int (0/1)
        if (key === 'notificarCliente' || key === 'clienteNotificado') {
          v = v ? 1 : 0;
        }
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(v);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar. Use gh:cambiar-estado-vacacion para estado.');
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(vacacionId);

    var stmtU = localDb.prepare('UPDATE gh_vacaciones SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU.run.apply(stmtU, values);
    return _ok({ vacacionId: vacacionId });
  } catch (e) {
    console.error('[' + MOD + '][update-vacacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:delete-vacacion
 * Soft delete via estado='cancelado'.
 */
function _handlerDeleteVacacion(token, vacacionId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!vacacionId || typeof vacacionId !== 'string') {
    return _err('INVALID_INPUT', 'vacacionId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_vacaciones WHERE id = ?').get(vacacionId);
    if (!existing) return _err('NOT_FOUND', 'Vacación no encontrada');
    if (existing.estado === 'cancelado') {
      return _err('ALREADY_DELETED', 'La vacación ya está cancelada');
    }

    var now = new Date().toISOString();
    localDb.prepare(
      "UPDATE gh_vacaciones SET estado = 'cancelado', updated_at = ? WHERE id = ?"
    ).run(now, vacacionId);
    return _ok({ vacacionId: vacacionId, cancelled: true });
  } catch (e) {
    console.error('[' + MOD + '][delete-vacacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:cambiar-estado-vacacion
 * Cambia el estado de una vacación con registro de aprobador.
 * Estados: solicitada | aprobada | rechazada | programada | disfrutada | cancelado.
 */
function _handlerCambiarEstadoVacacion(token, vacacionId, nuevoEstado, aprobadoPor, fechaAprobacion) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!vacacionId || typeof vacacionId !== 'string') {
    return _err('INVALID_INPUT', 'vacacionId es requerido');
  }
  if (!nuevoEstado || typeof nuevoEstado !== 'string') {
    return _err('INVALID_INPUT', 'nuevoEstado es requerido');
  }

  var estadosValidos = ['solicitada', 'aprobada', 'rechazada', 'programada', 'disfrutada', 'cancelado'];
  if (estadosValidos.indexOf(nuevoEstado) === -1) {
    return _err('INVALID_INPUT', 'estado debe ser uno de: ' + estadosValidos.join(', '));
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_vacaciones WHERE id = ?').get(vacacionId);
    if (!existing) return _err('NOT_FOUND', 'Vacación no encontrada');

    var now = new Date().toISOString();
    var fechaApr = (nuevoEstado === 'aprobada' && !fechaAprobacion) ? now : (fechaAprobacion || null);
    var aprobador = aprobadoPor || null;

    localDb.prepare(
      "UPDATE gh_vacaciones SET estado = ?, aprobado_por = ?, fecha_aprobacion = ?, updated_at = ? WHERE id = ?"
    ).run(nuevoEstado, aprobador, fechaApr, now, vacacionId);
    return _ok({ vacacionId: vacacionId, estado: nuevoEstado });
  } catch (e) {
    console.error('[' + MOD + '][cambiar-estado-vacacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== PERMISOS HANDLERS (Fase 5) ==========

var _TIPOS_PERMISO = ['incapacidad', 'maternidad', 'paternidad', 'luto', 'permiso_personal', 'cita_medica', 'calamidad', 'licencia_no_remunerada'];
var _ESTADOS_PERMISO = ['activo', 'finalizado', 'prorrogado'];

/**
 * gh:list-permisos
 * Filtros: companyName (requerido), tipo (opcional), estado (opcional), trabajadorId (opcional).
 */
function _handlerListPermisos(token, companyName, tipo, estado, trabajadorId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM gh_permisos WHERE empresa_id = ?";
    var params = [company.company_key];
    if (tipo && typeof tipo === 'string') {
      sql += " AND tipo = ?";
      params.push(tipo);
    }
    if (estado && typeof estado === 'string') {
      sql += " AND estado = ?";
      params.push(estado);
    }
    if (trabajadorId && typeof trabajadorId === 'string') {
      sql += " AND trabajador_id = ?";
      params.push(trabajadorId);
    }
    sql += " ORDER BY fecha_inicio DESC, created_at DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var permisos = rows.map(_rowToPermiso);
    return _ok({
      permisos: permisos,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: permisos.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-permisos]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-permiso
 */
function _handlerGetPermiso(token, permisoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!permisoId || typeof permisoId !== 'string') {
    return _err('INVALID_INPUT', 'permisoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM gh_permisos WHERE id = ?").get(permisoId);
    if (!row) {
      return _err('NOT_FOUND', 'Permiso "' + permisoId + '" no encontrado');
    }
    return _ok({ permiso: _rowToPermiso(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-permiso]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:create-permiso
 * Crea un permiso/incapacidad/etc. Multi-tenant valida trabajador.
 */
function _handlerCreatePermiso(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.trabajadorId || typeof data.trabajadorId !== 'string') {
    return _err('INVALID_INPUT', 'trabajadorId es requerido');
  }
  if (!data.tipo || typeof data.tipo !== 'string') {
    return _err('INVALID_INPUT', 'tipo es requerido');
  }
  if (_TIPOS_PERMISO.indexOf(data.tipo) === -1) {
    return _err('INVALID_INPUT', 'tipo debe ser uno de: ' + _TIPOS_PERMISO.join(', '));
  }
  if (!data.fechaInicio || typeof data.fechaInicio !== 'string') {
    return _err('INVALID_INPUT', 'fechaInicio es requerido (ISO 8601)');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var trab = localDb.prepare(
      "SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?"
    ).get(data.trabajadorId, company.company_key);
    if (!trab) {
      return _err('TRABAJADOR_NOT_FOUND', 'Trabajador no encontrado en esta empresa', { trabajadorId: data.trabajadorId });
    }

    var id = _newId('pe-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO gh_permisos (id, trabajador_id, empresa_id, tipo, fecha_inicio, fecha_fin, " +
      "  dias, estado, motivo, soporte_url, prorroga, notas, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id, data.trabajadorId, company.company_key,
      data.tipo, data.fechaInicio, data.fechaFin || null,
      data.dias || null, data.estado || 'activo',
      data.motivo || null, data.soporteUrl || null,
      data.prorroga ? 1 : 0, data.notas || null,
      now, now
    );
    return _ok({ permisoId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-permiso]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-permiso
 * Whitelist: fechaFin, dias, estado, motivo, soporteUrl, prorroga, notas.
 */
function _handlerUpdatePermiso(token, permisoId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!permisoId || typeof permisoId !== 'string') {
    return _err('INVALID_INPUT', 'permisoId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  var fieldMap = {
    fechaFin: 'fecha_fin',
    dias: 'dias',
    estado: 'estado',
    motivo: 'motivo',
    soporteUrl: 'soporte_url',
    prorroga: 'prorroga',
    notas: 'notas'
  };

  try {
    var existing = localDb.prepare('SELECT id FROM gh_permisos WHERE id = ?').get(permisoId);
    if (!existing) return _err('NOT_FOUND', 'Permiso no encontrado');

    if (updates.estado && _ESTADOS_PERMISO.indexOf(updates.estado) === -1) {
      return _err('INVALID_INPUT', 'estado debe ser uno de: ' + _ESTADOS_PERMISO.join(', '));
    }

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        var v = updates[key];
        if (key === 'prorroga') v = v ? 1 : 0;
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(v);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar. Use gh:finalizar-permiso para terminar.');
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(permisoId);

    var stmtU = localDb.prepare('UPDATE gh_permisos SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU.run.apply(stmtU, values);
    return _ok({ permisoId: permisoId });
  } catch (e) {
    console.error('[' + MOD + '][update-permiso]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:finalizar-permiso
 * Marca el permiso como finalizado y setea fecha_fin.
 */
function _handlerFinalizarPermiso(token, permisoId, fechaFin) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!permisoId || typeof permisoId !== 'string') {
    return _err('INVALID_INPUT', 'permisoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_permisos WHERE id = ?').get(permisoId);
    if (!existing) return _err('NOT_FOUND', 'Permiso no encontrado');
    if (existing.estado === 'finalizado') {
      return _err('ALREADY_FINALIZED', 'El permiso ya está finalizado');
    }

    var now = new Date().toISOString();
    var fechaFinal = (fechaFin && typeof fechaFin === 'string') ? fechaFin : now;

    localDb.prepare(
      "UPDATE gh_permisos SET estado = 'finalizado', fecha_fin = ?, updated_at = ? WHERE id = ?"
    ).run(fechaFinal, now, permisoId);
    return _ok({ permisoId: permisoId, estado: 'finalizado', fechaFin: fechaFinal });
  } catch (e) {
    console.error('[' + MOD + '][finalizar-permiso]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== DOCUMENTOS HANDLERS (Fase 5) ==========

var _TIPOS_DOCUMENTO = ['autorizacion_datos', 'autorizacion_hojas_vida', 'actualizacion_datos', 'induccion', 'contrato', 'carta_examenes', 'carta_cuenta_bancaria'];
var _ESTADOS_DOCUMENTO = ['pendiente', 'esperando_firma', 'firmado', 'rechazado', 'expirado', 'anulado'];

/**
 * gh:list-documentos
 * Filtros: companyName, tipo, estado, trabajadorId.
 */
function _handlerListDocumentos(token, companyName, tipo, estado, trabajadorId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // 📦102.2.E · Lazy migration: columna id_solicitud_firma para relacionar
    // gh_documentos.id con firma-service (id devuelto por POST /sign-requests).
    // Idempotente: falla silenciosamente si la columna ya existe.
    try { localDb.exec("ALTER TABLE gh_documentos ADD COLUMN id_solicitud_firma TEXT;"); } catch (e) { /* ya existe */ }
    try { localDb.exec("CREATE INDEX IF NOT EXISTS idx_gh_documentos_id_solicitud_firma ON gh_documentos(id_solicitud_firma);"); } catch (e) { /* ya existe */ }

    var sql = "SELECT * FROM gh_documentos WHERE empresa_id = ?";
    var params = [company.company_key];
    if (tipo && typeof tipo === 'string') {
      sql += " AND tipo = ?";
      params.push(tipo);
    }
    if (estado && typeof estado === 'string') {
      sql += " AND estado = ?";
      params.push(estado);
    }
    if (trabajadorId && typeof trabajadorId === 'string') {
      sql += " AND trabajador_id = ?";
      params.push(trabajadorId);
    }
    sql += " ORDER BY created_at DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var documentos = rows.map(_rowToDocumento);
    return _ok({
      documentos: documentos,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: documentos.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-documentos]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-documento
 */
function _handlerGetDocumento(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM gh_documentos WHERE id = ?").get(documentoId);
    if (!row) {
      return _err('NOT_FOUND', 'Documento "' + documentoId + '" no encontrado');
    }
    return _ok({ documento: _rowToDocumento(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-documento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * I-103.A1.6 · Acceso read-only a firma-service/data/firma.sqlite.
 * Devuelve una conexión singleton en modo readonly. Si la BD no existe
 * (firma-service no corriendo o instalado en otra ruta), retorna
 * { ok: false, code: 'FIRMA_DB_UNAVAILABLE', message: ... }.
 *
 * Ruta: <app.getAppPath()>/firma-service/data/firma.sqlite
 *
 * NO modifica firma-service. Solo abre la BD en modo read-only para
 * resolver el correo_verificacion del consentimiento. Patrón singleton
 * lazy: la primera llamada abre la BD, las siguientes reusan.
 */
function _getFirmaDb() {
  if (_firmaDb) {
    try {
      // sanity check: si la BD se cerró externamente, mejor reabrir
      _firmaDb.prepare('SELECT 1').get();
      return { ok: true, db: _firmaDb };
    } catch (e) {
      _firmaDb = null;
    }
  }
  if (!_app || !_path) {
    return { ok: false, code: 'NOT_INITIALIZED', message: 'app/path no disponibles' };
  }
  var dbPath = _path.join(_app.getAppPath(), 'firma-service', 'data', 'firma.sqlite');
  var fs = require('fs');
  if (!fs.existsSync(dbPath)) {
    return { ok: false, code: 'FIRMA_DB_UNAVAILABLE', message: 'BD de firma-service no encontrada en ' + dbPath };
  }
  try {
    var Database = require('better-sqlite3');
    _firmaDb = new Database(dbPath, { readonly: true, fileMustExist: true });
    return { ok: true, db: _firmaDb };
  } catch (e) {
    return { ok: false, code: 'FIRMA_DB_OPEN_FAILED', message: 'No se pudo abrir la BD de firma-service: ' + e.message };
  }
}

/**
 * I-103.A1.6 · Resuelve idEmpresa de secrets.enc para una empresa K+AIR.
 * NO toca firma-bridge.js. Lee directamente userData/secrets.enc con safeStorage
 * (misma fuente que firma-bridge) y retorna solo el idEmpresa (dato no secreto).
 * Si no encuentra la empresa en secrets.enc, retorna { ok: false, code: 'NO_ID_EMPRESA' }.
 *
 * Esto es necesario porque la BD de firma-service guarda id_empresa (NIT), pero
 * el bridge de GH solo conoce companyName/companyKey. La traducción requiere
 * leer el registro per-empresa de secrets.enc.
 */
function _resolveIdEmpresaFromSecrets(companyName) {
  if (!_app || !_path) {
    return { ok: false, code: 'NOT_INITIALIZED', message: 'app/path no disponibles' };
  }
  var safeStorage = _app.safeStorage || (_app.getSafeStorage && _app.getSafeStorage());
  // Si _app es electron.app, safeStorage viene de require('electron')
  if (!safeStorage) {
    try {
      safeStorage = require('electron').safeStorage;
    } catch (e) {
      return { ok: false, code: 'NO_SAFE_STORAGE', message: 'safeStorage no disponible: ' + e.message };
    }
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) {
    return { ok: false, code: 'NO_SAFE_STORAGE', message: 'safeStorage no disponible en este OS' };
  }
  var fs = require('fs');
  var secretsPath = _path.join(_app.getPath('userData'), 'secrets.enc');
  if (!fs.existsSync(secretsPath)) {
    return { ok: false, code: 'SECRETS_NOT_FOUND', message: 'secrets.enc no existe en ' + secretsPath };
  }
  var raw;
  try {
    var buf = fs.readFileSync(secretsPath);
    var json = safeStorage.decryptString(buf);
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false, code: 'SECRETS_DECRYPT_FAILED', message: 'Error descifrando secrets.enc: ' + e.message };
  }
  if (!raw || !raw.empresas || typeof raw.empresas !== 'object') {
    return { ok: false, code: 'SECRETS_EMPTY', message: 'secrets.enc sin bloque empresas' };
  }
  // Match exacto primero, luego case-insensitive
  if (raw.empresas[companyName] && raw.empresas[companyName].idEmpresa) {
    return { ok: true, idEmpresa: String(raw.empresas[companyName].idEmpresa) };
  }
  var target = String(companyName || '').toLowerCase().trim();
  var keys = Object.keys(raw.empresas);
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase().trim() === target) {
      var entry = raw.empresas[keys[i]];
      if (entry && entry.idEmpresa) {
        return { ok: true, idEmpresa: String(entry.idEmpresa) };
      }
    }
  }
  return { ok: false, code: 'NO_ID_EMPRESA', message: 'Empresa "' + companyName + '" no tiene idEmpresa configurado en secrets.enc' };
}

/**
 * gh:get-consentimiento
 * I-103.A1.6 · Consulta MÍNIMA de un consentimiento de firma por ID.
 *
 * Retorna solo los campos necesarios para el flujo "Enviar correo" del
 * módulo Firma electrónica: id, correo_verificacion, estado.
 *
 * Valida que el consentimiento pertenezca a la empresa solicitada
 * comparando gh_consentimientos_firma.id_empresa (NIT) contra el
 * idEmpresa resuelto de secrets.enc.
 * No expone correo_hash, otp_hash ni otp_sal.
 *
 * NOTA: gh_consentimientos_firma vive en firma-service/data/firma.sqlite
 * (BD separada de kair.db). Se abre read-only via _getFirmaDb().
 *
 * @param {string} token         - token de sesión
 * @param {number} consentId    - ID del consentimiento (INTEGER PK en gh_consentimientos_firma)
 * @param {string} companyName  - nombre (display_name o company_key) de la empresa
 */
function _handlerGetConsentimiento(token, consentId, companyName) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!consentId || (typeof consentId !== 'number' && typeof consentId !== 'string')) {
    return _err('INVALID_INPUT', 'consentId es requerido');
  }
  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var idEmpRes = _resolveIdEmpresaFromSecrets(companyName);
  if (!idEmpRes.ok) {
    return _err(idEmpRes.code, idEmpRes.message);
  }
  var idEmpresa = idEmpRes.idEmpresa;

  var firmaDbRes = _getFirmaDb();
  if (!firmaDbRes.ok) {
    return _err(firmaDbRes.code, firmaDbRes.message);
  }
  var firmaDb = firmaDbRes.db;

  try {
    // Solo exponemos campos mínimos: no se retornan hashes, salts ni OTPs.
    // Scope multi-empresa: comparamos id_empresa de la BD (NIT) contra
    // el idEmpresa resuelto de secrets.enc (mismo NIT, NO contra company_key
    // porque company_key en kair.companies es "Tempoactiva" mientras que
    // firma-service guarda el NIT como id_empresa).
    var row = firmaDb.prepare(
      "SELECT id, id_empresa, estado, correo_verificacion " +
      "FROM gh_consentimientos_firma WHERE id = ? LIMIT 1"
    ).get(Number(consentId));

    if (!row) {
      return _err('NOT_FOUND', 'Consentimiento #' + consentId + ' no encontrado');
    }
    if (String(row.id_empresa) !== idEmpresa) {
      return _err('NOT_FOUND', 'Consentimiento #' + consentId + ' no pertenece a la empresa "' + companyName + '"');
    }
    return _ok({
      consentimiento: {
        id: row.id,
        correo_verificacion: row.correo_verificacion,
        estado: row.estado
      }
    });
  } catch (e) {
    console.error('[' + MOD + '][get-consentimiento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-sign-request
 * I-103.A1.6 · Consulta MÍNIMA de un sign request de firma por id_solicitud.
 *
 * Retorna los datos que el modal de expediente necesita pero firma-service
 * NO expone en GET /sign-requests/:id (que omite metadata y link deliberadamente).
 *
 * Datos que retorna (todos desde la BD local, READ-ONLY):
 *   - id_solicitud, estado, id_empresa, fecha_creacion, fecha_expiracion
 *   - correo_verificacion: parseado de gh_firmas_electronicas.metadata.correo
 *   - fecha_envio: del último evento INVITE_SENT en gh_firma_eventos
 *
 * NO retorna url_publica / qr_payload (esos vienen de firma:sign-request:link,
 * endpoint que descifra el token con la clave del servidor — único punto donde
 * se puede construir el link de forma segura).
 *
 * Valida scope multi-empresa: gh_firmas_electronicas.id_empresa debe coincidir
 * con el idEmpresa resuelto de secrets.enc.
 *
 * @param {string} token         - token de sesión
 * @param {string} idSolicitud   - id_solicitud (formato SIGN-YYYY-NNNNNN)
 * @param {string} companyName   - nombre (display_name o company_key) de la empresa
 */
function _handlerGetSignRequest(token, idSolicitud, companyName) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!idSolicitud || typeof idSolicitud !== 'string') {
    return _err('INVALID_INPUT', 'idSolicitud es requerido (formato SIGN-YYYY-NNNNNN)');
  }
  // Validación de formato ligera (no exhaustiva; firma-service valida la real)
  if (!/^SIGN-\d{4}-\d{6}$/.test(idSolicitud)) {
    return _err('INVALID_INPUT', 'idSolicitud debe tener formato SIGN-YYYY-NNNNNN');
  }
  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var idEmpRes = _resolveIdEmpresaFromSecrets(companyName);
  if (!idEmpRes.ok) {
    return _err(idEmpRes.code, idEmpRes.message);
  }
  var idEmpresa = idEmpRes.idEmpresa;

  var firmaDbRes = _getFirmaDb();
  if (!firmaDbRes.ok) {
    return _err(firmaDbRes.code, firmaDbRes.message);
  }
  var firmaDb = firmaDbRes.db;

  try {
    // 1) Datos del sign request desde gh_firmas_electronicas
    var sr = firmaDb.prepare(
      "SELECT id, id_solicitud, id_empresa, estado, metadata, " +
      "fecha_creacion, fecha_expiracion " +
      "FROM gh_firmas_electronicas WHERE id_solicitud = ? LIMIT 1"
    ).get(idSolicitud);

    if (!sr) {
      return _err('NOT_FOUND', 'Sign request "' + idSolicitud + '" no encontrado');
    }
    if (String(sr.id_empresa) !== idEmpresa) {
      return _err('NOT_FOUND', 'Sign request "' + idSolicitud + '" no pertenece a la empresa "' + companyName + '"');
    }

    // 2) Parsear metadata (JSON) → extraer correo_verificacion
    //    El correo NO se persiste en columna plana; solo dentro de metadata.
    //    Estructura típica: { "correo": "user@x.com", "_server_metadata": {...} }
    var correoVerificacion = null;
    if (sr.metadata) {
      try {
        var md = JSON.parse(sr.metadata);
        if (md && typeof md.correo === 'string') {
          correoVerificacion = md.correo;
        }
      } catch (_) {
        // metadata corrupto; continuamos sin correo (no es fatal)
      }
    }

    // 3) Último evento INVITE_SENT desde gh_firma_eventos (para fecha_envio)
    var lastInvite = firmaDb.prepare(
      "SELECT fecha_hora, metadata FROM gh_firma_eventos " +
      "WHERE firma_id = ? AND evento = 'INVITE_SENT' " +
      "ORDER BY fecha_hora DESC LIMIT 1"
    ).get(sr.id);

    var fechaEnvio = null;
    if (lastInvite) {
      fechaEnvio = lastInvite.fecha_hora;
    }

    return _ok({
      signRequest: {
        id_solicitud: sr.id_solicitud,
        estado: sr.estado,
        correo_verificacion: correoVerificacion,
        fecha_envio: fechaEnvio,
        fecha_creacion: sr.fecha_creacion,
        fecha_expiracion: sr.fecha_expiracion
      }
    });
  } catch (e) {
    console.error('[' + MOD + '][get-sign-request]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:create-documento
 * Crea un documento. estado default 'pendiente'. version default 1.
 */
function _handlerCreateDocumento(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.trabajadorId || typeof data.trabajadorId !== 'string') {
    return _err('INVALID_INPUT', 'trabajadorId es requerido');
  }
  if (!data.tipo || typeof data.tipo !== 'string') {
    return _err('INVALID_INPUT', 'tipo es requerido');
  }
  if (_TIPOS_DOCUMENTO.indexOf(data.tipo) === -1) {
    return _err('INVALID_INPUT', 'tipo debe ser uno de: ' + _TIPOS_DOCUMENTO.join(', '));
  }
  if (!data.titulo || typeof data.titulo !== 'string') {
    return _err('INVALID_INPUT', 'titulo es requerido');
  }
  if (!data.contenido || typeof data.contenido !== 'string') {
    return _err('INVALID_INPUT', 'contenido es requerido (JSON string)');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var trab = localDb.prepare(
      "SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?"
    ).get(data.trabajadorId, company.company_key);
    if (!trab) {
      return _err('TRABAJADOR_NOT_FOUND', 'Trabajador no encontrado en esta empresa', { trabajadorId: data.trabajadorId });
    }

    var id = _newId('do-');
    var now = new Date().toISOString();
    // 📦764 · Si viene templateId, copiamos el archivo del template a una
    // nueva ubicación para el documento generado. Así el template queda
    // intacto y el user puede tener múltiples documentos del mismo template.
    var rutaArchivo = data.rutaArchivo || null;
    var nombreArchivo = data.nombreArchivo || null;
    if (data.templateId && !rutaArchivo) {
      var fs2 = registerGestionHumanaHandlers._fs;
      var path2 = registerGestionHumanaHandlers._path;
      if (fs2 && path2) {
        try {
          var tplRow = localDb.prepare('SELECT * FROM gh_templates WHERE id = ?').get(data.templateId);
          if (tplRow && tplRow.ruta_archivo && fs2.existsSync(tplRow.ruta_archivo)) {
            var srcPath = tplRow.ruta_archivo;
            var ext = path2.extname(srcPath) || '.docx';
            var app = registerGestionHumanaHandlers._app;
            var baseDir = app ? app.getPath('userData') : require('os').tmpdir();
            var docDir = path2.join(baseDir, 'gh-docs', company.company_key);
            if (!fs2.existsSync(docDir)) fs2.mkdirSync(docDir, { recursive: true });
            var destPath = path2.join(docDir, id + ext);
            fs2.copyFileSync(srcPath, destPath);
            rutaArchivo = destPath;
            nombreArchivo = tplRow.nombre_archivo;
            console.log('[' + MOD + '] Template ' + data.templateId + ' copiado a ' + destPath);
          } else {
            console.warn('[' + MOD + '] Template ' + data.templateId + ' no encontrado o sin archivo');
          }
        } catch (e) {
          console.error('[' + MOD + '][copy-template]', e.message);
          // No fatal: el documento se crea igual sin archivo adjunto
        }
      }
    }
    localDb.prepare(
      "INSERT INTO gh_documentos (id, trabajador_id, empresa_id, tipo, titulo, contenido, " +
      "  estado, fecha_firma, version, ruta_archivo, nombre_archivo, " +
      "  created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id, data.trabajadorId, company.company_key,
      data.tipo, data.titulo, data.contenido,
      data.estado || 'pendiente',
      data.fechaFirma || null, data.version || 1,
      rutaArchivo, nombreArchivo,
      now, now
    );
    return _ok({ documentoId: id, rutaArchivo: rutaArchivo, nombreArchivo: nombreArchivo });
  } catch (e) {
    console.error('[' + MOD + '][create-documento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-documento
 * Whitelist: titulo, contenido, estado, fechaFirma, version.
 * NO permite cambiar tipo ni trabajador_id.
 * (firmaId eliminado en LEGACY-SIGN-REMOVE — el estado 'firmado' lo setea
 *  firma-service vía I-105 al recibir SIGN_COMMITTED.)
 */
function _handlerUpdateDocumento(token, documentoId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  var fieldMap = {
    titulo: 'titulo',
    contenido: 'contenido',
    estado: 'estado',
    fechaFirma: 'fecha_firma',
    version: 'version',
    // 📦102.2.E · id de la solicitud de firma (firm-service POST /sign-requests).
    // Se setea en I-102.2.D al crear la sign request. No se permite cambiar
    // una vez que el documento está firmado.
    idSolicitudFirma: 'id_solicitud_firma'
  };

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_documentos WHERE id = ?').get(documentoId);
    if (!existing) return _err('NOT_FOUND', 'Documento no encontrado');
    if (existing.estado === 'anulado') {
      return _err('ALREADY_DELETED', 'El documento está anulado');
    }

    if (updates.estado && _ESTADOS_DOCUMENTO.indexOf(updates.estado) === -1) {
      return _err('INVALID_INPUT', 'estado debe ser uno de: ' + _ESTADOS_DOCUMENTO.join(', '));
    }

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(updates[key]);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar');
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(documentoId);

    var stmtU = localDb.prepare('UPDATE gh_documentos SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU.run.apply(stmtU, values);
    return _ok({ documentoId: documentoId });
  } catch (e) {
    console.error('[' + MOD + '][update-documento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:delete-documento
 * Soft delete via estado='anulado'.
 */
function _handlerDeleteDocumento(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, estado FROM gh_documentos WHERE id = ?').get(documentoId);
    if (!existing) return _err('NOT_FOUND', 'Documento no encontrado');
    if (existing.estado === 'anulado') {
      return _err('ALREADY_DELETED', 'El documento ya está anulado');
    }

    var now = new Date().toISOString();
    localDb.prepare(
      "UPDATE gh_documentos SET estado = 'anulado', updated_at = ? WHERE id = ?"
    ).run(now, documentoId);
    return _ok({ documentoId: documentoId, cancelled: true });
  } catch (e) {
    console.error('[' + MOD + '][delete-documento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * SECCIÓN ELIMINADA EN LEGACY-SIGN-REMOVE (2026-08-20):
 *   - _handlerFirmarDocumento  (gh:firmar-documento)
 *   - _handlerListFirmas       (gh:list-firmas)
 *   - _handlerCreateFirma      (gh:create-firma)
 *   - _rowToFirma
 * La firma canvas operativa interna (base64 PNG) ya no se usa. La firma
 * jurídica es únicamente electrónica, vía firma-service (I-101+).
 * Las funciones de UPDATE del estado 'firmado' las dispara firma-service
 * al recibir el evento SIGN_COMMITTED (ver I-105).
 */

// ========== ANUNCIOS HANDLERS (Fase 5) ==========

var _TIPOS_ANUNCIO = ['info', 'urgente', 'mantenimiento', 'evento'];
var _DIRIGIDO_A = ['todos', 'sede', 'cargo', 'trabajador'];

/**
 * gh:list-anuncios
 * Filtros: companyName, tipo, activo.
 */
function _handlerListAnuncios(token, companyName, tipo, activo) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM gh_anuncios WHERE empresa_id = ?";
    var params = [company.company_key];
    if (tipo && typeof tipo === 'string') {
      sql += " AND tipo = ?";
      params.push(tipo);
    }
    if (typeof activo === 'boolean' || activo === 0 || activo === 1) {
      sql += " AND activo = ?";
      params.push(activo ? 1 : 0);
    }
    sql += " ORDER BY fecha_publicacion DESC, created_at DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var anuncios = rows.map(_rowToAnuncio);
    return _ok({
      anuncios: anuncios,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: anuncios.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-anuncios]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-anuncio
 */
function _handlerGetAnuncio(token, anuncioId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!anuncioId || typeof anuncioId !== 'string') {
    return _err('INVALID_INPUT', 'anuncioId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM gh_anuncios WHERE id = ?").get(anuncioId);
    if (!row) {
      return _err('NOT_FOUND', 'Anuncio "' + anuncioId + '" no encontrado');
    }
    return _ok({ anuncio: _rowToAnuncio(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-anuncio]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:create-anuncio
 * Crea un anuncio. activo default 1, tipo default 'info', dirigido_a default 'todos'.
 */
function _handlerCreateAnuncio(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.titulo || typeof data.titulo !== 'string') {
    return _err('INVALID_INPUT', 'titulo es requerido');
  }
  if (!data.contenido || typeof data.contenido !== 'string') {
    return _err('INVALID_INPUT', 'contenido es requerido');
  }
  if (!data.fechaPublicacion || typeof data.fechaPublicacion !== 'string') {
    return _err('INVALID_INPUT', 'fechaPublicacion es requerido (ISO 8601)');
  }
  if (!data.publicadoPor || typeof data.publicadoPor !== 'string') {
    return _err('INVALID_INPUT', 'publicadoPor es requerido');
  }

  if (data.tipo && _TIPOS_ANUNCIO.indexOf(data.tipo) === -1) {
    return _err('INVALID_INPUT', 'tipo debe ser uno de: ' + _TIPOS_ANUNCIO.join(', '));
  }
  if (data.dirigidoA && _DIRIGIDO_A.indexOf(data.dirigidoA) === -1) {
    return _err('INVALID_INPUT', 'dirigidoA debe ser uno de: ' + _DIRIGIDO_A.join(', '));
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var id = _newId('an-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO gh_anuncios (id, empresa_id, titulo, contenido, tipo, dirigido_a, " +
      "  sede_id, cargo_filtro, fecha_publicacion, fecha_expiracion, publicado_por, activo, " +
      "  created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id, company.company_key,
      data.titulo, data.contenido,
      data.tipo || 'info', data.dirigidoA || 'todos',
      data.sedeId || null, data.cargoFiltro || null,
      data.fechaPublicacion, data.fechaExpiracion || null,
      data.publicadoPor, 1, now, now
    );
    return _ok({ anuncioId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-anuncio]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:update-anuncio
 * Whitelist: titulo, contenido, tipo, dirigidoA, sedeId, cargoFiltro, fechaExpiracion, activo.
 */
function _handlerUpdateAnuncio(token, anuncioId, updates) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!anuncioId || typeof anuncioId !== 'string') {
    return _err('INVALID_INPUT', 'anuncioId es requerido');
  }
  if (!updates || typeof updates !== 'object') {
    return _err('INVALID_INPUT', 'updates es requerido (objeto)');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  var fieldMap = {
    titulo: 'titulo',
    contenido: 'contenido',
    tipo: 'tipo',
    dirigidoA: 'dirigido_a',
    sedeId: 'sede_id',
    cargoFiltro: 'cargo_filtro',
    fechaExpiracion: 'fecha_expiracion',
    activo: 'activo'
  };

  try {
    var existing = localDb.prepare('SELECT id FROM gh_anuncios WHERE id = ?').get(anuncioId);
    if (!existing) return _err('NOT_FOUND', 'Anuncio no encontrado');

    if (updates.tipo && _TIPOS_ANUNCIO.indexOf(updates.tipo) === -1) {
      return _err('INVALID_INPUT', 'tipo debe ser uno de: ' + _TIPOS_ANUNCIO.join(', '));
    }
    if (updates.dirigidoA && _DIRIGIDO_A.indexOf(updates.dirigidoA) === -1) {
      return _err('INVALID_INPUT', 'dirigidoA debe ser uno de: ' + _DIRIGIDO_A.join(', '));
    }

    var sqlParts = [];
    var values = [];
    Object.keys(updates).forEach(function (key) {
      if (fieldMap[key]) {
        var v = updates[key];
        if (key === 'activo') v = v ? 1 : 0;
        sqlParts.push(fieldMap[key] + ' = ?');
        values.push(v);
      }
    });

    if (sqlParts.length === 0) {
      return _err('INVALID_INPUT', 'No hay campos válidos para actualizar');
    }

    sqlParts.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(anuncioId);

    var stmtU = localDb.prepare('UPDATE gh_anuncios SET ' + sqlParts.join(', ') + ' WHERE id = ?');
    stmtU.run.apply(stmtU, values);
    return _ok({ anuncioId: anuncioId });
  } catch (e) {
    console.error('[' + MOD + '][update-anuncio]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:delete-anuncio
 * Soft delete via activo=0.
 */
function _handlerDeleteAnuncio(token, anuncioId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!anuncioId || typeof anuncioId !== 'string') {
    return _err('INVALID_INPUT', 'anuncioId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, activo FROM gh_anuncios WHERE id = ?').get(anuncioId);
    if (!existing) return _err('NOT_FOUND', 'Anuncio no encontrado');
    if (existing.activo === 0) {
      return _err('ALREADY_DELETED', 'El anuncio ya está desactivado');
    }

    var now = new Date().toISOString();
    localDb.prepare(
      "UPDATE gh_anuncios SET activo = 0, updated_at = ? WHERE id = ?"
    ).run(now, anuncioId);
    return _ok({ anuncioId: anuncioId, cancelled: true });
  } catch (e) {
    console.error('[' + MOD + '][delete-anuncio]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== MENSAJES HANDLERS (Fase 5) ==========

var _PRIORIDADES_MENSAJE = ['baja', 'normal', 'alta'];

/**
 * gh:list-mensajes
 * Filtros: companyName, destinatarioId, leido.
 */
function _handlerListMensajes(token, companyName, destinatarioId, leido) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM gh_mensajes WHERE empresa_id = ?";
    var params = [company.company_key];
    if (destinatarioId && typeof destinatarioId === 'string') {
      sql += " AND destinatario_id = ?";
      params.push(destinatarioId);
    }
    if (typeof leido === 'boolean' || leido === 0 || leido === 1) {
      sql += " AND leido = ?";
      params.push(leido ? 1 : 0);
    }
    sql += " ORDER BY created_at DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var mensajes = rows.map(_rowToMensaje);
    return _ok({
      mensajes: mensajes,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      count: mensajes.length
    });
  } catch (e) {
    console.error('[' + MOD + '][list-mensajes]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:get-mensaje
 */
function _handlerGetMensaje(token, mensajeId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!mensajeId || typeof mensajeId !== 'string') {
    return _err('INVALID_INPUT', 'mensajeId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare("SELECT * FROM gh_mensajes WHERE id = ?").get(mensajeId);
    if (!row) {
      return _err('NOT_FOUND', 'Mensaje "' + mensajeId + '" no encontrado');
    }
    return _ok({ mensaje: _rowToMensaje(row) });
  } catch (e) {
    console.error('[' + MOD + '][get-mensaje]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:create-mensaje
 * Crea un mensaje directo. Multi-tenant valida remitente y destinatario.
 */
function _handlerCreateMensaje(token, companyName, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!data || typeof data !== 'object') {
    return _err('INVALID_INPUT', 'data es requerido (objeto)');
  }
  if (!data.remitenteId || typeof data.remitenteId !== 'string') {
    return _err('INVALID_INPUT', 'remitenteId es requerido');
  }
  if (!data.destinatarioId || typeof data.destinatarioId !== 'string') {
    return _err('INVALID_INPUT', 'destinatarioId es requerido');
  }
  if (!data.asunto || typeof data.asunto !== 'string') {
    return _err('INVALID_INPUT', 'asunto es requerido');
  }
  if (!data.contenido || typeof data.contenido !== 'string') {
    return _err('INVALID_INPUT', 'contenido es requerido');
  }

  if (data.remitenteId === data.destinatarioId) {
    return _err('INVALID_INPUT', 'remitente y destinatario deben ser distintos');
  }

  if (data.prioridad && _PRIORIDADES_MENSAJE.indexOf(data.prioridad) === -1) {
    return _err('INVALID_INPUT', 'prioridad debe ser una de: ' + _PRIORIDADES_MENSAJE.join(', '));
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Validar que ambos trabajadores pertenezcan a la empresa
    var remitente = localDb.prepare(
      "SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?"
    ).get(data.remitenteId, company.company_key);
    if (!remitente) {
      return _err('REMITENTE_NOT_FOUND', 'Remitente no encontrado en esta empresa', { remitenteId: data.remitenteId });
    }
    var destinatario = localDb.prepare(
      "SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?"
    ).get(data.destinatarioId, company.company_key);
    if (!destinatario) {
      return _err('DESTINATARIO_NOT_FOUND', 'Destinatario no encontrado en esta empresa', { destinatarioId: data.destinatarioId });
    }

    var id = _newId('me-');
    var now = new Date().toISOString();
    localDb.prepare(
      "INSERT INTO gh_mensajes (id, empresa_id, remitente_id, destinatario_id, asunto, contenido, " +
      "  leido, fecha_lectura, prioridad, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)"
    ).run(
      id, company.company_key,
      data.remitenteId, data.destinatarioId,
      data.asunto, data.contenido,
      null, data.prioridad || 'normal', now
    );
    return _ok({ mensajeId: id });
  } catch (e) {
    console.error('[' + MOD + '][create-mensaje]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:marcar-leido
 * Marca un mensaje como leído. Si ya estaba leído, retorna ALREADY_READ.
 */
function _handlerMarcarLeido(token, mensajeId, fechaLectura) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!mensajeId || typeof mensajeId !== 'string') {
    return _err('INVALID_INPUT', 'mensajeId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare('SELECT id, leido FROM gh_mensajes WHERE id = ?').get(mensajeId);
    if (!existing) return _err('NOT_FOUND', 'Mensaje no encontrado');
    if (existing.leido === 1) {
      return _err('ALREADY_READ', 'El mensaje ya está marcado como leído');
    }

    var now = new Date().toISOString();
    var fecha = (fechaLectura && typeof fechaLectura === 'string') ? fechaLectura : now;

    localDb.prepare(
      "UPDATE gh_mensajes SET leido = 1, fecha_lectura = ? WHERE id = ?"
    ).run(fecha, mensajeId);
    return _ok({ mensajeId: mensajeId, leido: true, fechaLectura: fecha });
  } catch (e) {
    console.error('[' + MOD + '][marcar-leido]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== 📦760 · DOCUMENTOS DE AFILIACIONES — certificados EPS / Pensión / ARL / Caja ==========
// 1 documento por slot (trabajador + tipo_afiliacion). El archivo se guarda en el
// filesystem (AppData) y esta tabla solo guarda la metadata + ruta absoluta.

var _TIPOS_AFIL = ['eps', 'pension', 'arl', 'caja'];

function _rowToDocAfil(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    trabajadorId: row.trabajador_id,
    tipoAfiliacion: row.tipo_afiliacion,
    nombreArchivo: row.nombre_archivo,
    rutaArchivo: row.ruta_archivo,
    tamanoBytes: row.tamano_bytes,
    mimeType: row.mime_type,
    subidoPor: row.subido_por,
    fechaSubida: row.fecha_subida,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Construye la ruta de storage para el documento.
// Path: <userData>/gh-docs-afil/<empresaId>/<trabajadorId>/<tipoAfiliacion>.pdf
function _docsAfilPath(empresaId, trabajadorId, tipoAfiliacion) {
  var app = registerGestionHumanaHandlers._app;
  var path = registerGestionHumanaHandlers._path;
  if (!app || !path) return null;
  var base = app.getPath('userData');
  return path.join(base, 'gh-docs-afil', String(empresaId), String(trabajadorId), String(tipoAfiliacion) + '.pdf');
}

// Asegura que el directorio exista (mkdir -p recursivo).
function _ensureDirSync(dirPath) {
  var fs = registerGestionHumanaHandlers._fs;
  if (!fs) return;
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    console.error('[' + MOD + '][_ensureDirSync]', e.message);
  }
}

// Borra un archivo si existe, sin throw.
function _safeUnlinkSync(filePath) {
  var fs = registerGestionHumanaHandlers._fs;
  if (!fs || !filePath) return false;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (e) {
    console.warn('[' + MOD + '][_safeUnlinkSync] No se pudo borrar', filePath, ':', e.message);
  }
  return false;
}

/**
 * gh:list-documentos-afiliaciones
 * Lista los 4 documentos del trabajador (uno por tipo_afiliacion).
 * Devuelve un array de 4 elementos (uno por slot, con doc=null si no hay).
 * Input: { token, companyName, trabajadorId }
 * Devuelve: { success, data: { documentos: [{ tipoAfiliacion, doc|null }] } }
 */
function _handlerListDocsAfil(token, companyName, trabajadorId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!trabajadorId || typeof trabajadorId !== 'string') {
    return _err('INVALID_INPUT', 'trabajadorId es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var stmtL = localDb.prepare(
      "SELECT * FROM gh_documentos_afiliaciones WHERE empresa_id = ? AND trabajador_id = ? ORDER BY tipo_afiliacion"
    );
    var rows = stmtL.all(company.company_key, trabajadorId);
    var docsByTipo = {};
    rows.forEach(function (r) {
      docsByTipo[r.tipo_afiliacion] = _rowToDocAfil(r);
    });

    // Devolver SIEMPRE 4 slots (uno por tipo), con doc=null si no hay
    var documentos = _TIPOS_AFIL.map(function (tipo) {
      return { tipoAfiliacion: tipo, doc: docsByTipo[tipo] || null };
    });

    return _ok({ documentos: documentos, count: rows.length });
  } catch (e) {
    console.error('[' + MOD + '][list-documentos-afiliaciones]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:subir-documento-afiliacion
 * Sube (o reemplaza) el documento PDF de un slot (trabajador + tipo_afiliacion).
 * Usa dialog.showOpenDialog para que el usuario seleccione el PDF.
 * El archivo se copia a <userData>/gh-docs-afil/<empresaId>/<trabajadorId>/<tipoAfiliacion>.pdf
 * Input: { token, companyName, trabajadorId, tipoAfiliacion }
 * Devuelve: { success, data: { doc: { id, nombreArchivo, tamanoBytes, ... } } }
 */
function _handlerSubirDocAfil(token, companyName, trabajadorId, tipoAfiliacion) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!trabajadorId || typeof trabajadorId !== 'string') {
    return _err('INVALID_INPUT', 'trabajadorId es requerido');
  }
  if (!tipoAfiliacion || _TIPOS_AFIL.indexOf(tipoAfiliacion) < 0) {
    return _err('INVALID_INPUT', 'tipoAfiliacion inválido. Permitidos: ' + _TIPOS_AFIL.join(', '));
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var dialog = registerGestionHumanaHandlers._dialog;
  var fs = registerGestionHumanaHandlers._fs;
  if (!dialog || !fs) return _err('NO_DIALOG', 'dialog/fs no disponibles');

  // Verificar que el trabajador existe
  try {
    var trabRow = localDb.prepare('SELECT id FROM base_personal WHERE id = ? AND empresa_id = ?').get(trabajadorId, company.company_key);
    if (!trabRow) return _err('NOT_FOUND', 'Trabajador "' + trabajadorId + '" no encontrado');
  } catch (e) {
    return _err('INTERNAL', e.message);
  }

  // Abrir dialog
  return dialog.showOpenDialog({
    title: 'Seleccionar PDF de ' + tipoAfiliacion.toUpperCase(),
    filters: [
      { name: 'Documentos PDF', extensions: ['pdf'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  }).then(function (result) {
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return _ok({ canceled: true });
    }
    var sourcePath = result.filePaths[0];

    // Verificar tamaño (max 10MB)
    var stats;
    try { stats = fs.statSync(sourcePath); } catch (e) { return _err('FILE_ERROR', 'No se pudo leer el archivo: ' + e.message); }
    var tamanoBytes = stats.size;
    if (tamanoBytes > 10 * 1024 * 1024) {
      return _err('FILE_TOO_LARGE', 'El PDF es demasiado grande (max 10MB). Tamaño actual: ' + Math.round(tamanoBytes / 1024 / 1024) + 'MB');
    }

    // Construir ruta destino y copiar
    var destPath = _docsAfilPath(company.company_key, trabajadorId, tipoAfiliacion);
    if (!destPath) return _err('NO_PATH', 'No se pudo construir la ruta de destino');
    _ensureDirSync(require('path').dirname(destPath));

    // Si ya existe un doc en este slot, eliminarlo antes
    _safeUnlinkSync(destPath);

    try {
      fs.copyFileSync(sourcePath, destPath);
    } catch (e) {
      return _err('COPY_ERROR', 'No se pudo copiar el archivo: ' + e.message);
    }

    // Extraer nombre original
    var path = require('path');
    var nombreArchivo = path.basename(sourcePath);
    var now = new Date().toISOString();

    // UPSERT: si ya existe un doc para este slot, actualizar; si no, insertar
    var existing = localDb.prepare(
      'SELECT id FROM gh_documentos_afiliaciones WHERE empresa_id = ? AND trabajador_id = ? AND tipo_afiliacion = ?'
    ).get(company.company_key, trabajadorId, tipoAfiliacion);

    var stmtU;
    if (existing) {
      stmtU = localDb.prepare(
        'UPDATE gh_documentos_afiliaciones SET nombre_archivo = ?, ruta_archivo = ?, tamano_bytes = ?, fecha_subida = ?, updated_at = ? WHERE id = ?'
      );
      var stmtUx = stmtU;  // Capturar para apply con this correcto
      stmtUx.run.apply(stmtUx, [nombreArchivo, destPath, tamanoBytes, now, now, existing.id]);
    } else {
      var id = _newId('daf-');
      stmtU = localDb.prepare(
        'INSERT INTO gh_documentos_afiliaciones (id, empresa_id, trabajador_id, tipo_afiliacion, nombre_archivo, ruta_archivo, tamano_bytes, mime_type, fecha_subida, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      var stmtIx = stmtU;
      stmtIx.run.apply(stmtIx, [id, company.company_key, trabajadorId, tipoAfiliacion, nombreArchivo, destPath, tamanoBytes, 'application/pdf', now, now, now]);
    }

    // Leer el doc final
    var finalRow = localDb.prepare(
      'SELECT * FROM gh_documentos_afiliaciones WHERE empresa_id = ? AND trabajador_id = ? AND tipo_afiliacion = ?'
    ).get(company.company_key, trabajadorId, tipoAfiliacion);

    return _ok({ doc: _rowToDocAfil(finalRow), replaced: !!existing });
  }).catch(function (e) {
    console.error('[' + MOD + '][subir-documento-afiliacion]', e.message);
    return _err('INTERNAL', e.message);
  });
}

/**
 * gh:eliminar-documento-afiliacion
 * Borra el archivo del FS + el registro de la BD.
 * Input: { token, documentoId }
 * Devuelve: { success, data: { documentoId } }
 */
function _handlerEliminarDocAfil(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare('SELECT * FROM gh_documentos_afiliaciones WHERE id = ?').get(documentoId);
    if (!row) return _err('NOT_FOUND', 'Documento no encontrado');

    // Borrar archivo del FS (no fatal si falla)
    if (row.ruta_archivo) _safeUnlinkSync(row.ruta_archivo);

    // Borrar registro
    var stmtD = localDb.prepare('DELETE FROM gh_documentos_afiliaciones WHERE id = ?');
    stmtD.run(documentoId);
    return _ok({ documentoId: documentoId });
  } catch (e) {
    console.error('[' + MOD + '][eliminar-documento-afiliacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:obtener-documento-afiliacion
 * Devuelve el doc con la ruta + tamano (para que el frontend pueda abrirlo o hacer preview).
 * Input: { token, documentoId }
 * Devuelve: { success, data: { doc: { ... rutaArchivo, tamanoBytes, ... } } }
 */
function _handlerObtenerDocAfil(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare('SELECT * FROM gh_documentos_afiliaciones WHERE id = ?').get(documentoId);
    if (!row) return _err('NOT_FOUND', 'Documento no encontrado');
    return _ok({ doc: _rowToDocAfil(row) });
  } catch (e) {
    console.error('[' + MOD + '][obtener-documento-afiliacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:abrir-documento-afiliacion
 * Abre el PDF con la aplicación por defecto del sistema (Windows: Edge, Acrobat, etc.).
 * Input: { token, documentoId }
 * Devuelve: { success, data: { rutaArchivo } }
 */
function _handlerAbrirDocAfil(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var shell = registerGestionHumanaHandlers._shell;
  if (!shell) return _err('NO_SHELL', 'shell no disponible');

  try {
    var row = localDb.prepare('SELECT ruta_archivo FROM gh_documentos_afiliaciones WHERE id = ?').get(documentoId);
    if (!row) return _err('NOT_FOUND', 'Documento no encontrado');
    if (!row.ruta_archivo) return _err('NO_PATH', 'Documento sin ruta');
    return shell.openPath(row.ruta_archivo).then(function (errMsg) {
      if (errMsg) return _err('OPEN_FAILED', errMsg);
      return _ok({ rutaArchivo: row.ruta_archivo });
    });
  } catch (e) {
    console.error('[' + MOD + '][abrir-documento-afiliacion]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// 📦764 · Abre el archivo generado de un documento (gh_documentos.ruta_archivo)
// con la app por defecto del sistema (Word, Acrobat, etc.)
function _handlerAbrirDocumento(token, documentoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);
  if (!documentoId || typeof documentoId !== 'string') {
    return _err('INVALID_INPUT', 'documentoId es requerido');
  }
  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var shell = registerGestionHumanaHandlers._shell;
  if (!shell) return _err('NO_SHELL', 'shell no disponible');
  try {
    var row = localDb.prepare('SELECT ruta_archivo FROM gh_documentos WHERE id = ?').get(documentoId);
    if (!row) return _err('NOT_FOUND', 'Documento no encontrado');
    if (!row.ruta_archivo) return _err('NO_PATH', 'Documento sin archivo adjunto');
    return shell.openPath(row.ruta_archivo).then(function (errMsg) {
      if (errMsg) return _err('OPEN_FAILED', errMsg);
      return _ok({ rutaArchivo: row.ruta_archivo });
    });
  } catch (e) {
    console.error('[' + MOD + '][abrir-documento]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== 📦764 · TEMPLATES DE DOCUMENTOS — .docx/.pdf subidos por el user ==========
// Cada template está asociado a un tipo de documento (autorizacion_datos, contrato, etc.)
// y se guarda el archivo en el filesystem (AppData) y metadata en gh_templates.
// Al generar un documento, se copia el template seleccionado como archivo del documento.

var _TIPOS_DOC = ['autorizacion_datos', 'autorizacion_hojas_vida', 'actualizacion_datos', 'induccion', 'contrato', 'carta_examenes', 'carta_cuenta_bancaria'];

function _rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    empresaId: row.empresa_id,
    tipoDocumento: row.tipo_documento,
    nombre: row.nombre,
    nombreArchivo: row.nombre_archivo,
    rutaArchivo: row.ruta_archivo,
    tamanoBytes: row.tamano_bytes,
    mimeType: row.mime_type,
    subidoPor: row.subido_por,
    fechaSubida: row.fecha_subida,
    activo: row.activo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Construye la ruta de storage para el template.
// Path: <userData>/gh-templates/<empresaId>/<templateId>.<ext>
function _templatePath(empresaId, templateId, ext) {
  var app = registerGestionHumanaHandlers._app;
  var path = registerGestionHumanaHandlers._path;
  if (!app || !path) return null;
  var base = app.getPath('userData');
  return path.join(base, 'gh-templates', String(empresaId), templateId + '.' + ext);
}

/**
 * gh:list-templates
 * Lista los templates activos de la empresa, opcionalmente filtrados por tipo.
 * Input: { token, companyName, tipoDocumento? }
 * Devuelve: { success, data: { templates: [...] } }
 */
function _handlerListTemplates(token, companyName, tipoDocumento) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var sql = "SELECT * FROM gh_templates WHERE empresa_id = ? AND activo = 1";
    var params = [company.company_key];
    if (tipoDocumento && typeof tipoDocumento === 'string') {
      sql += " AND tipo_documento = ?";
      params.push(tipoDocumento);
    }
    sql += " ORDER BY fecha_subida DESC";

    var stmt = localDb.prepare(sql);
    var rows = stmt.all.apply(stmt, params);
    var templates = rows.map(_rowToTemplate);

    return _ok({ templates: templates, count: templates.length });
  } catch (e) {
    console.error('[' + MOD + '][list-templates]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:subir-template
 * Sube un nuevo template (PDF o DOCX). Usa dialog.showOpenDialog para que el
 * user seleccione el archivo. El archivo se copia a AppData y se crea un
 * registro en gh_templates.
 * Input: { token, companyName, tipoDocumento, nombre, subidoPor? }
 * Devuelve: { success, data: { template: {...} } }
 */
function _handlerSubirTemplate(token, companyName, tipoDocumento, nombre, subidoPor) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  if (!tipoDocumento || _TIPOS_DOC.indexOf(tipoDocumento) < 0) {
    return _err('INVALID_INPUT', 'tipoDocumento inválido. Permitidos: ' + _TIPOS_DOC.join(', '));
  }
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    return _err('INVALID_INPUT', 'nombre es requerido');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var dialog = registerGestionHumanaHandlers._dialog;
  var fs = registerGestionHumanaHandlers._fs;
  var path = registerGestionHumanaHandlers._path;
  if (!dialog || !fs || !path) return _err('NO_DIALOG', 'dialog/fs/path no disponibles');

  // I-103.A1.5.4-B · Restringido a PDF. El flujo de firma electrónica
  // (firma-service) solo acepta PDFs (valida header %PDF-). Aceptar DOCX/DOC
  // aquí generaba documentos no firmables. Conversión DOCX→PDF queda fuera
  // de scope (fase propia posterior).
  return dialog.showOpenDialog({
    title: 'Seleccionar template de documento',
    filters: [
      { name: 'Documentos PDF', extensions: ['pdf'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
    properties: ['openFile']
  }).then(function (result) {
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return _ok({ canceled: true });
    }
    var sourcePath = result.filePaths[0];
    var ext = path.extname(sourcePath).toLowerCase().replace(/^\./, '') || 'docx';
    if (['pdf', 'docx', 'doc'].indexOf(ext) < 0) {
      return _err('INVALID_FORMAT', 'Solo se permiten archivos .pdf, .docx o .doc');
    }

    // Verificar tamaño (max 10MB)
    var stats;
    try { stats = fs.statSync(sourcePath); } catch (e) { return _err('FILE_ERROR', 'No se pudo leer el archivo: ' + e.message); }
    var tamanoBytes = stats.size;
    if (tamanoBytes > 10 * 1024 * 1024) {
      return _err('FILE_TOO_LARGE', 'El template es demasiado grande (max 10MB). Tamaño actual: ' + Math.round(tamanoBytes / 1024 / 1024) + 'MB');
    }

    // Crear ID y ruta destino
    var templateId = _newId('tp-');
    var destPath = _templatePath(company.company_key, templateId, ext);
    if (!destPath) return _err('NO_PATH', 'No se pudo construir la ruta de destino');

    // Crear directorio si no existe
    var destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copiar archivo
    try {
      fs.copyFileSync(sourcePath, destPath);
    } catch (e) {
      return _err('COPY_ERROR', 'No se pudo copiar el archivo: ' + e.message);
    }

    var nombreArchivo = path.basename(sourcePath);
    var mimeType = ext === 'pdf' ? 'application/pdf'
      : (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword');
    var now = new Date().toISOString();

    // Insertar en BD
    localDb.prepare(
      'INSERT INTO gh_templates (id, empresa_id, tipo_documento, nombre, nombre_archivo, ruta_archivo, tamano_bytes, mime_type, subido_por, fecha_subida, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
    ).run(
      templateId, company.company_key, tipoDocumento, nombre.trim(), nombreArchivo, destPath, tamanoBytes, mimeType,
      subidoPor || null, now, now, now
    );

    // Leer el template recién creado
    var row = localDb.prepare('SELECT * FROM gh_templates WHERE id = ?').get(templateId);
    return _ok({ template: _rowToTemplate(row) });
  }).catch(function (e) {
    console.error('[' + MOD + '][subir-template]', e.message);
    return _err('INTERNAL', e.message);
  });
}

/**
 * gh:eliminar-template
 * Borra el archivo del FS y el registro de la BD (soft delete).
 * Input: { token, templateId }
 * Devuelve: { success, data: { templateId } }
 */
function _handlerEliminarTemplate(token, templateId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!templateId || typeof templateId !== 'string') {
    return _err('INVALID_INPUT', 'templateId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var fs = registerGestionHumanaHandlers._fs;
  if (!fs) return _err('NO_FS', 'fs no disponible');

  try {
    var row = localDb.prepare('SELECT * FROM gh_templates WHERE id = ?').get(templateId);
    if (!row) return _err('NOT_FOUND', 'Template no encontrado');

    // Borrar archivo del FS (no fatal si falla)
    if (row.ruta_archivo) _safeUnlinkSync(row.ruta_archivo);

    // Soft delete (activo = 0) para mantener historial
    var stmt = localDb.prepare('UPDATE gh_templates SET activo = 0, updated_at = ? WHERE id = ?');
    var stmtExec = stmt;  // capturar para apply con this correcto
    stmtExec.run.apply(stmtExec, [new Date().toISOString(), templateId]);
    return _ok({ templateId: templateId });
  } catch (e) {
    console.error('[' + MOD + '][eliminar-template]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:obtener-template
 * Retorna metadata del template (incluida la ruta del archivo) para que el
 * frontend pueda descargarlo o hacer preview.
 * Input: { token, templateId }
 * Devuelve: { success, data: { template: {...} } }
 */
function _handlerObtenerTemplate(token, templateId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!templateId || typeof templateId !== 'string') {
    return _err('INVALID_INPUT', 'templateId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare('SELECT * FROM gh_templates WHERE id = ?').get(templateId);
    if (!row) return _err('NOT_FOUND', 'Template no encontrado');
    return _ok({ template: _rowToTemplate(row) });
  } catch (e) {
    console.error('[' + MOD + '][obtener-template]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * gh:abrir-template
 * Abre el archivo del template con la aplicación por defecto del sistema.
 * Input: { token, templateId }
 * Devuelve: { success, data: { rutaArchivo } }
 */
function _handlerAbrirTemplate(token, templateId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!templateId || typeof templateId !== 'string') {
    return _err('INVALID_INPUT', 'templateId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');
  var shell = registerGestionHumanaHandlers._shell;
  if (!shell) return _err('NO_SHELL', 'shell no disponible');

  try {
    var row = localDb.prepare('SELECT ruta_archivo FROM gh_templates WHERE id = ?').get(templateId);
    if (!row) return _err('NOT_FOUND', 'Template no encontrado');
    if (!row.ruta_archivo) return _err('NO_PATH', 'Template sin ruta');
    return shell.openPath(row.ruta_archivo).then(function (errMsg) {
      if (errMsg) return _err('OPEN_FAILED', errMsg);
      return _ok({ rutaArchivo: row.ruta_archivo });
    });
  } catch (e) {
    console.error('[' + MOD + '][abrir-template]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ========== STUBS (legacy — kept for compat, but all are now real) ==========
function _stubHandler(channel) {
  return function (event, payload) {
    var p = payload || {};
    return _stub(channel, p);
  };
}

// ========== REGISTRATION ==========
function registerGestionHumanaHandlers(app, deps) {
  _getDb = (deps && typeof deps.getDb === 'function') ? deps.getDb : null;
  _validateSession = (deps && typeof deps.validateSession === 'function') ? deps.validateSession : null;
  _app = app || null;
  _path = require('path');

  if (!registerGestionHumanaHandlers._ipcMain) {
    throw new Error('ipcMain no configurado. Usar registerGestionHumanaHandlers.init(ipcMain) primero.');
  }
  var ipcMainHandle = registerGestionHumanaHandlers._ipcMain.handle.bind(registerGestionHumanaHandlers._ipcMain);

  // ========== READ (5) — Fase 1 ==========
  ipcMainHandle('gh:list-contrataciones', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListContrataciones(p.token || '', p.companyName, p.estado);
    } catch (e) {
      console.error('[' + MOD + '][list-contrataciones]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-contratacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetContratacion(p.token || '', p.contratacionId);
    } catch (e) {
      console.error('[' + MOD + '][get-contratacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:list-personal', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListPersonal(p.token || '', p.companyName, p.estado, p.search);
    } catch (e) {
      console.error('[' + MOD + '][list-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-personal', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetPersonal(p.token || '', p.personalId);
    } catch (e) {
      console.error('[' + MOD + '][get-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:list-sedes', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListSedes(p.token || '', p.companyName);
    } catch (e) {
      console.error('[' + MOD + '][list-sedes]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== WRITE CONTRATACIÓN (4) — Fase 2 ==========
  ipcMainHandle('gh:create-contratacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateContratacion(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-contratacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-contratacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateContratacion(p.token || '', p.contratacionId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-contratacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:delete-contratacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeleteContratacion(p.token || '', p.contratacionId);
    } catch (e) {
      console.error('[' + MOD + '][delete-contratacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:marcar-paso', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerMarcarPaso(p.token || '', p.contratacionId, p.pasoNum, p.fecha, p.notas);
    } catch (e) {
      console.error('[' + MOD + '][marcar-paso]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== WRITE PERSONAL (4) — Fase 3 ==========
  ipcMainHandle('gh:create-personal', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreatePersonal(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-personal', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdatePersonal(p.token || '', p.personalId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:delete-personal', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeletePersonal(p.token || '', p.personalId);
    } catch (e) {
      console.error('[' + MOD + '][delete-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:cambiar-estado', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCambiarEstado(p.token || '', p.personalId, p.estado, p.fechaRetiro, p.notas);
    } catch (e) {
      console.error('[' + MOD + '][cambiar-estado]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== WRITE SEDES (2) — Fase 3 ==========
  ipcMainHandle('gh:create-sede', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateSede(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-sede]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-sede', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateSede(p.token || '', p.sedeId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-sede]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== VACACIONES (6) — Fase 5 ==========
  ipcMainHandle('gh:list-vacaciones', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListVacaciones(p.token || '', p.companyName, p.estado, p.trabajadorId);
    } catch (e) {
      console.error('[' + MOD + '][list-vacaciones]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-vacacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetVacacion(p.token || '', p.vacacionId);
    } catch (e) {
      console.error('[' + MOD + '][get-vacacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:create-vacacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateVacacion(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-vacacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-vacacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateVacacion(p.token || '', p.vacacionId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-vacacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:delete-vacacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeleteVacacion(p.token || '', p.vacacionId);
    } catch (e) {
      console.error('[' + MOD + '][delete-vacacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:cambiar-estado-vacacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCambiarEstadoVacacion(p.token || '', p.vacacionId, p.nuevoEstado, p.aprobadoPor, p.fechaAprobacion);
    } catch (e) {
      console.error('[' + MOD + '][cambiar-estado-vacacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== PERMISOS (5) — Fase 5 ==========
  ipcMainHandle('gh:list-permisos', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListPermisos(p.token || '', p.companyName, p.tipo, p.estado, p.trabajadorId);
    } catch (e) {
      console.error('[' + MOD + '][list-permisos]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-permiso', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetPermiso(p.token || '', p.permisoId);
    } catch (e) {
      console.error('[' + MOD + '][get-permiso]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:create-permiso', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreatePermiso(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-permiso]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-permiso', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdatePermiso(p.token || '', p.permisoId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-permiso]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:finalizar-permiso', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerFinalizarPermiso(p.token || '', p.permisoId, p.fechaFin);
    } catch (e) {
      console.error('[' + MOD + '][finalizar-permiso]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== DOCUMENTOS (6) — Fase 5 ==========
  ipcMainHandle('gh:list-documentos', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListDocumentos(p.token || '', p.companyName, p.tipo, p.estado, p.trabajadorId);
    } catch (e) {
      console.error('[' + MOD + '][list-documentos]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-documento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetDocumento(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][get-documento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-103.A1.6 · IPC mínimo para consulta de consentimiento de firma
  // (Fase 3). Usado por el módulo Firma electrónica para obtener
  // correo_verificacion sin pedirlo de nuevo al user.
  ipcMainHandle('gh:get-consentimiento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetConsentimiento(p.token || '', p.consentId, p.companyName);
    } catch (e) {
      console.error('[' + MOD + '][get-consentimiento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // I-103.A1.6 · IPC mínimo para consulta de sign request desde la BD local.
  // Complementa firma:sign-request:get (datos generales) y firma:sign-request:link
  // (url_publica + qr_payload). Este handler retorna: correo_verificacion (parseado
  // de metadata) y fecha_envio (último INVITE_SENT). Lectura READ-ONLY, no
  // modifica firma.sqlite. Validación de scope por id_empresa vs secrets.enc.
  ipcMainHandle('gh:get-sign-request', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetSignRequest(p.token || '', p.id, p.companyName);
    } catch (e) {
      console.error('[' + MOD + '][get-sign-request]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:create-documento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateDocumento(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-documento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-documento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateDocumento(p.token || '', p.documentoId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-documento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:delete-documento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeleteDocumento(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][delete-documento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // ========== FIRMAS DIGITALES (3) — ELIMINADO en LEGACY-SIGN-REMOVE (2026-08-20) ==========
  // gh:firmar-documento, gh:list-firmas, gh:create-firma → ya no existen.
  // La firma canvas operativa interna se reemplazó por firma electrónica
  // vía firma-service (I-101). Ver comentario en sección de handlers.

  // ========== ANUNCIOS (5) — Fase 5 ==========
  ipcMainHandle('gh:list-anuncios', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListAnuncios(p.token || '', p.companyName, p.tipo, p.activo);
    } catch (e) {
      console.error('[' + MOD + '][list-anuncios]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-anuncio', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetAnuncio(p.token || '', p.anuncioId);
    } catch (e) {
      console.error('[' + MOD + '][get-anuncio]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:create-anuncio', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateAnuncio(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-anuncio]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:update-anuncio', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateAnuncio(p.token || '', p.anuncioId, p.updates);
    } catch (e) {
      console.error('[' + MOD + '][update-anuncio]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:delete-anuncio', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeleteAnuncio(p.token || '', p.anuncioId);
    } catch (e) {
      console.error('[' + MOD + '][delete-anuncio]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== MENSAJES (4) — Fase 5 ==========
  ipcMainHandle('gh:list-mensajes', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListMensajes(p.token || '', p.companyName, p.destinatarioId, p.leido);
    } catch (e) {
      console.error('[' + MOD + '][list-mensajes]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:get-mensaje', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetMensaje(p.token || '', p.mensajeId);
    } catch (e) {
      console.error('[' + MOD + '][get-mensaje]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:create-mensaje', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreateMensaje(p.token || '', p.companyName, p.data);
    } catch (e) {
      console.error('[' + MOD + '][create-mensaje]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:marcar-leido', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerMarcarLeido(p.token || '', p.mensajeId, p.fechaLectura);
    } catch (e) {
      console.error('[' + MOD + '][marcar-leido]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== DIAG (1) — siempre activo ==========
  ipcMainHandle('gh:diag', function (event, payload) {
    var localDb = _getDb ? _getDb() : null;
    var tables = [];
    if (localDb) {
      try {
        var tablesResult = localDb.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN (" +
          "  'contrataciones', 'base_personal', 'gh_sedes'," +
          "  'gh_vacaciones', 'gh_permisos', 'gh_documentos'," +
          "  'gh_anuncios', 'gh_mensajes'," +
          "  'gh_documentos_afiliaciones', 'gh_templates'" +
          ") ORDER BY name"
        ).all();
        tables = tablesResult.map(function(r) { return r.name; });
      } catch (e) {}
    }
    return _ok({
      bridge: 'gestion-humana',
      phase: 7,  // 📦764 · FASE G: 5 handlers nuevos para templates de documentos
      has_getDb: !!_getDb,
      has_validateSession: !!_validateSession,
      tables: tables,
      message: 'Gestión Humana bridge en Fase 7 (54 handlers reales + 1 diag · 10 tablas) · LEGACY-SIGN-REMOVE 2026-08-20'
    });
  });

  // ========== 📦760 · DOCUMENTOS DE AFILIACIONES (5) — Fase 6 ==========
  ipcMainHandle('gh:list-documentos-afiliaciones', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListDocsAfil(p.token || '', p.companyName, p.trabajadorId);
    } catch (e) {
      console.error('[' + MOD + '][list-documentos-afiliaciones]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:subir-documento-afiliacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerSubirDocAfil(p.token || '', p.companyName, p.trabajadorId, p.tipoAfiliacion);
    } catch (e) {
      console.error('[' + MOD + '][subir-documento-afiliacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:eliminar-documento-afiliacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerEliminarDocAfil(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][eliminar-documento-afiliacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:obtener-documento-afiliacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerObtenerDocAfil(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][obtener-documento-afiliacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:abrir-documento-afiliacion', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerAbrirDocAfil(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][abrir-documento-afiliacion]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  // 📦764 · Abrir documento generado (gh_documentos.ruta_archivo)
  ipcMainHandle('gh:abrir-documento', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerAbrirDocumento(p.token || '', p.documentoId);
    } catch (e) {
      console.error('[' + MOD + '][abrir-documento]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== 📦764 · TEMPLATES (5) — Fase 7 ==========
  ipcMainHandle('gh:list-templates', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListTemplates(p.token || '', p.companyName, p.tipoDocumento);
    } catch (e) {
      console.error('[' + MOD + '][list-templates]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:subir-template', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerSubirTemplate(p.token || '', p.companyName, p.tipoDocumento, p.nombre, p.subidoPor);
    } catch (e) {
      console.error('[' + MOD + '][subir-template]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:eliminar-template', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerEliminarTemplate(p.token || '', p.templateId);
    } catch (e) {
      console.error('[' + MOD + '][eliminar-template]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:obtener-template', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerObtenerTemplate(p.token || '', p.templateId);
    } catch (e) {
      console.error('[' + MOD + '][obtener-template]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMainHandle('gh:abrir-template', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerAbrirTemplate(p.token || '', p.templateId);
    } catch (e) {
      console.error('[' + MOD + '][abrir-template]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // ========== 📦732 · IMPORT EXCEL (3 handlers nuevos) ==========

  // gh:select-excel — abre el dialogo del sistema para seleccionar .xlsx/.xls/.csv
  ipcMainHandle('gh:select-excel', function (event, payload) {
    try {
      var dialog = registerGestionHumanaHandlers._dialog;
      if (!dialog) return _err('NO_DIALOG', 'Dialog no disponible');
      var opts = {
        title: 'Seleccionar archivo Excel de trabajadores',
        filters: [
          { name: 'Archivos Excel', extensions: ['xlsx', 'xls', 'csv'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ],
        properties: ['openFile']
      };
      return dialog.showOpenDialog(opts).then(function (result) {
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          return _ok({ canceled: true, filePath: null });
        }
        return _ok({ canceled: false, filePath: result.filePaths[0] });
      });
    } catch (e) {
      console.error('[' + MOD + '][select-excel]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // gh:parse-excel — lee el archivo y devuelve headers + rows como JSON.
  // El renderer usa estos datos para mostrar un preview y mapear columnas.
  ipcMainHandle('gh:parse-excel', function (event, payload) {
    try {
      var xlsx = registerGestionHumanaHandlers._xlsx;
      if (!xlsx) return _err('XLSX_NOT_AVAILABLE', 'xlsx no disponible');
      var p = payload || {};
      var filePath = p.filePath;
      if (!filePath) return _err('INVALID_INPUT', 'filePath requerido');

      var workbook = xlsx.readFile(filePath, { cellDates: true });
      var sheetName = workbook.SheetNames[0];
      var sheet = workbook.Sheets[sheetName];
      var json = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });

      if (json.length === 0) {
        return _err('EMPTY_FILE', 'El archivo no tiene filas con datos');
      }

      var headers = Object.keys(json[0]);
      return _ok({
        sheetName: sheetName,
        headers: headers,
        rows: json,
        totalRows: json.length
      });
    } catch (e) {
      console.error('[' + MOD + '][parse-excel]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // gh:import-personal — recibe rows ya mapeadas, valida y crea/actualiza bulk.
  // 📦736 · duplicateMode = 'skip' (default) | 'update' | 'error'
  //   - 'skip': si la cédula existe, la fila se omite (no se crea ni se actualiza)
  //   - 'update': si existe, se actualizan los campos (whitelist, preservando retirado)
  //   - 'error': si existe, se reporta como error (rollback implícito por no-insert)
  ipcMainHandle('gh:import-personal', function (event, payload) {
    try {
      var p = payload || {};
      var companyName = p.companyName;
      var rows = p.rows || [];
      var duplicateMode = p.duplicateMode || 'skip';
      if (['skip', 'update', 'error'].indexOf(duplicateMode) < 0) duplicateMode = 'skip';
      // Back-compat: si el cliente viejo envía skipDuplicates boolean
      if (typeof p.skipDuplicates === 'boolean') {
        duplicateMode = p.skipDuplicates ? 'skip' : 'error';
      }

      if (!companyName) return _err('INVALID_INPUT', 'companyName requerido');
      if (!Array.isArray(rows) || rows.length === 0) return _err('INVALID_INPUT', 'rows requerido (array no vacío)');

      var localDb = _getDb();
      if (!localDb) return _err('NO_DB', 'BD no disponible');

      // 📦743 · Lazy migration: si la BD no tiene la columna sede_id
      // (porque el usuario tenía la BD antes de la migración 📦731),
      // la creamos ahora antes de cualquier INSERT/UPDATE. Antes este bloque
      // corría antes de definir localDb, lo que hacía fallar la migración en
      // silencio y provocaba el error "table base_personal has no column
      // named sede_id" al intentar el INSERT.
      try { localDb.exec("ALTER TABLE base_personal ADD COLUMN sede_id TEXT;"); } catch (e) { /* ya existe */ }
      try { localDb.exec("CREATE INDEX IF NOT EXISTS idx_base_personal_sede ON base_personal(empresa_id, sede_id);"); } catch (e) { /* ya existe */ }
      // 📦759 · Lazy migration: agregar columnas de fecha de afiliaciones
      try { localDb.exec("ALTER TABLE base_personal ADD COLUMN eps_fecha TEXT;"); } catch (e) { /* ya existe */ }
      try { localDb.exec("ALTER TABLE base_personal ADD COLUMN pension_fecha TEXT;"); } catch (e) { /* ya existe */ }
      try { localDb.exec("ALTER TABLE base_personal ADD COLUMN arl_fecha TEXT;"); } catch (e) { /* ya existe */ }
      try { localDb.exec("ALTER TABLE base_personal ADD COLUMN caja_fecha TEXT;"); } catch (e) { /* ya existe */ }

      var company = _getCompanyByName(companyName);
      if (!company) return _err('NOT_FOUND', 'Empresa no encontrada');

      var created = 0;
      var updated = 0;
      var skipped = [];
      var errors = [];
      var sedesCreated = [];

      // 📦742 · Auto-resolver nombres de sede a IDs (y crear las que no existan).
      // Si una row trae `sede` (string, nombre), se auto-crea una sede en gh_sedes
      // si no existe y se mapea a su id. Esto permite reimportar Excels legacy
      // que tienen una columna "Unidad" o "Sucursal" como TUBDES.
      var stmtFindSede = localDb.prepare(
        "SELECT id FROM gh_sedes WHERE empresa_id = ? AND nombre = ? AND activo = 1"
      );
      var stmtInsertSede = localDb.prepare(
        "INSERT INTO gh_sedes (id, empresa_id, nombre, activo, created_at) VALUES (?, ?, ?, 1, ?)"
      );
      var sedeNombreToId = {};
      // Cargar las sedes existentes (cache)
      var stmtAllSedes = localDb.prepare(
        "SELECT id, nombre FROM gh_sedes WHERE empresa_id = ? AND activo = 1"
      );
      var sedesExistentes = stmtAllSedes.all(company.company_key);
      sedesExistentes.forEach(function (s) { sedeNombreToId[s.nombre] = s.id; });

      // Usar transacción para que el import sea atómico
      var stmtFind = localDb.prepare(
        "SELECT id, estado FROM base_personal WHERE empresa_id = ? AND cedula = ? AND activo = 1"
      );
      // 📦747 · INSERT ampliado con TODOS los campos del schema para que el modal
      // muestre información completa desde el import. Los campos no enviados
      // desde el frontend quedan como null (que es el default).
      var stmtInsert = localDb.prepare(
        "INSERT INTO base_personal (id, empresa_id, nombres, apellidos, cedula, " +
        "  tipo_documento, fecha_exp_cedula, lugar_exp_cedula, " +
        "  fecha_nacimiento, lugar_nacimiento, " +
        "  telefono, celular, email, " +
        "  estado_civil, nivel_educativo, " +
        "  direccion, barrio, ciudad, " +
        "  cargo, salario, tipo_contrato, " +
        "  fecha_ingreso, fecha_retiro, estado, " +
        "  eps, pension, arl, caja_compensacion, " +
        "  empresa_usuaria, banco, numero_cuenta, sede_id, " +
        "  activo, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, " +
        "  ?, ?, ?, " +
        "  ?, ?, " +
        "  ?, ?, ?, " +
        "  ?, ?, " +
        "  ?, ?, ?, " +
        "  ?, ?, ?, " +
        "  ?, ?, ?, " +
        "  ?, ?, ?, ?, " +
        "  ?, ?, ?, ?, " +
        "  1, ?, ?)"
      );
      // 📦747 · UPDATE whitelist ampliado con los mismos campos que el INSERT.
      // No se tocan id/empresa_id/cedula/created_at/activo.
      // Si el existente está 'retirado', el estado NO se actualiza (preservar histórico).
      var stmtUpdate = localDb.prepare(
        "UPDATE base_personal SET " +
        "  nombres = ?, apellidos = ?, " +
        "  tipo_documento = ?, fecha_exp_cedula = ?, lugar_exp_cedula = ?, " +
        "  fecha_nacimiento = ?, lugar_nacimiento = ?, " +
        "  telefono = ?, celular = ?, email = ?, " +
        "  estado_civil = ?, nivel_educativo = ?, " +
        "  direccion = ?, barrio = ?, ciudad = ?, " +
        "  cargo = ?, salario = ?, tipo_contrato = ?, " +
        "  fecha_ingreso = ?, fecha_retiro = ?, " +
        "  eps = ?, pension = ?, arl = ?, caja_compensacion = ?, " +
        "  empresa_usuaria = ?, banco = ?, numero_cuenta = ?, " +
        "  sede_id = ?, " +
        "  estado = CASE WHEN estado = 'retirado' THEN estado ELSE ? END, " +
        "  updated_at = ? " +
        "WHERE id = ?"
      );

      localDb.transaction(function () {
        // 📦742 · Resolver nombres de sede a IDs antes del loop (crear si no existen)
        rows.forEach(function (row) {
          if (row.sede && !row.sedeId) {
            var nombre = String(row.sede).trim();
            if (nombre && !sedeNombreToId[nombre]) {
              var existingSede = stmtFindSede.get(company.company_key, nombre);
              if (existingSede) {
                sedeNombreToId[nombre] = existingSede.id;
              } else {
                var newSedeId = _newId('se-');
                var sedeNow = new Date().toISOString();
                stmtInsertSede.run(newSedeId, company.company_key, nombre, sedeNow);
                sedeNombreToId[nombre] = newSedeId;
                sedesCreated.push({ id: newSedeId, nombre: nombre });
              }
            }
            row.sedeId = sedeNombreToId[nombre] || null;
            delete row.sede;
          }
        });

        rows.forEach(function (row, index) {
          try {
            if (!row.cedula || !row.nombres || !row.apellidos) {
              errors.push({ row: index + 1, error: 'Faltan campos requeridos (cedula, nombres, apellidos)', data: row });
              return;
            }

            var existing = stmtFind.get(company.company_key, row.cedula);
            if (existing) {
              if (duplicateMode === 'skip') {
                skipped.push({ row: index + 1, cedula: row.cedula, id: existing.id });
                return;
              } else if (duplicateMode === 'error') {
                errors.push({ row: index + 1, error: 'Cédula ya existe (id=' + existing.id + ')', data: row });
                return;
              } else if (duplicateMode === 'update') {
                // Whitelist: no toca id, empresa_id, cedula, created_at, activo
                // Si el existente ya está retirado, no cambia el estado (preservar histórico)
                var now = new Date().toISOString();
                stmtUpdate.run(
                  row.nombres, row.apellidos,
                  row.tipoDocumento || 'CC', row.fechaExpCedula || null, row.lugarExpCedula || null,
                  row.fechaNacimiento || null, row.lugarNacimiento || null,
                  row.telefono || null, row.celular || null, row.email || null,
                  row.estadoCivil || null, row.nivelEducativo || null,
                  row.direccion || null, row.barrio || null, row.ciudad || null,
                  row.cargo || null, row.salario || null, row.tipoContrato || null,
                  row.fechaIngreso || null, row.fechaRetiro || null,
                  row.eps || null, row.pension || null, row.arl || null, row.cajaCompensacion || null,
                  row.empresaUsuaria || null, row.banco || null, row.numeroCuenta || null,
                  row.sedeId || null,
                  row.estado || 'activo',
                  now,
                  existing.id
                );
                updated++;
                return;
              }
            }

            var id = _newId('bp-');
            var now = new Date().toISOString();
            stmtInsert.run(
              id, company.company_key,
              row.nombres, row.apellidos, row.cedula,
              row.tipoDocumento || 'CC', row.fechaExpCedula || null, row.lugarExpCedula || null,
              row.fechaNacimiento || null, row.lugarNacimiento || null,
              row.telefono || null, row.celular || null, row.email || null,
              row.estadoCivil || null, row.nivelEducativo || null,
              row.direccion || null, row.barrio || null, row.ciudad || null,
              row.cargo || null, row.salario || null, row.tipoContrato || null,
              row.fechaIngreso || null, row.fechaRetiro || null, row.estado || 'activo',
              row.eps || null, row.pension || null, row.arl || null, row.cajaCompensacion || null,
              row.empresaUsuaria || null, row.banco || null, row.numeroCuenta || null, row.sedeId || null,
              now, now
            );
            created++;
          } catch (e) {
            errors.push({ row: index + 1, error: e.message, data: row });
          }
        });
      })();

      return _ok({ created: created, updated: updated, skipped: skipped, errors: errors, total: rows.length, sedesCreated: sedesCreated.length });
    } catch (e) {
      console.error('[' + MOD + '][import-personal]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 5 read + 4 write-contratacion + 4 write-personal + 2 write-sedes + 6 vacaciones + 5 permisos + 5 documentos + 5 anuncios + 4 mensajes + 5 docs-afiliaciones + 5 templates + 3 import-excel + 1 diag · 55 handlers totales · LEGACY-SIGN-REMOVE (sin firma canvas)');
}

registerGestionHumanaHandlers.init = function(ipcMain) {
  registerGestionHumanaHandlers._ipcMain = ipcMain;
  // 📦732 — Patrón mismo que profesiograma: inyectar dialog y xlsx via init
  // para que los tests puedan mockearlos fácilmente.
  var electron = require('electron');
  registerGestionHumanaHandlers._dialog = electron.dialog;
  registerGestionHumanaHandlers._shell = electron.shell;  // 📦760 · Para abrir PDFs
  registerGestionHumanaHandlers._app = electron.app;      // 📦760 · Para getPath('userData')
  registerGestionHumanaHandlers._fs = require('fs');        // 📦760 · Para mover/borrar archivos
  registerGestionHumanaHandlers._path = require('path');    // 📦760 · Para construir rutas
  try {
    registerGestionHumanaHandlers._xlsx = require('xlsx');
  } catch (e) {
    console.warn('[' + MOD + '] xlsx no disponible:', e.message);
    registerGestionHumanaHandlers._xlsx = null;
  }
};

module.exports = {
  registerGestionHumanaHandlers: registerGestionHumanaHandlers
};
