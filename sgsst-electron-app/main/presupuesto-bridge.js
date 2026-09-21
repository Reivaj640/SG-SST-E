// =====================================================================
// 📦708 (2026-08-15) — Bridge IPC para Presupuesto SG-SST
// Migración del submódulo 1.1.3 "Asignación de Recursos" a SQLite.
// Fuente de verdad primaria: BD local. Excel = reporte generado on-demand.
//
// FASE 1 (2026-08-15): Handlers de LECTURA implementados.
//   - presupuesto:list-by-empresa
//   - presupuesto:get
//   - presupuesto:get-by-empresa-anio
//   - presupuesto:calcular-resumen
// Los handlers de escritura, import y export siguen como STUB
// (retornan NOT_IMPLEMENTED, phase 1) hasta Fases 3-5.
//
// Patrón: misma firma (app, deps) que gestacion-bridge.js,
// bandeja-integrada-permissions-bridge.js y los demás bridges.
// Plan completo: docs/plans/presupuesto-bd-migration.md
// =====================================================================
'use strict';

const { ipcMain } = require('electron');
const { PRESUPUESTO_SCHEMA_SQL, PRESUPUESTO_MIGRATIONS_SQL } = require('./presupuesto-schema-sql');

const MOD = 'PRESUPUESTO';

// ---------- DB handle inyectada por main.js ----------
// 📦702-fix (mismo bug que en bandeja-integrada) — La firma es (app, deps).
// main.js llama con registerPresupuestoHandlers(app, { getDb, validateSession }).
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

function _checkAuth(token) {
  // 📦708 (Fase 2) — Auth OPCIONAL para alinear con el patrón de los handlers
  // viejos de Excel (readPresupuestoData, getPresupuestoFiles, saveBudgetFile)
  // que NO requerían token. La idea: el usuario ya está logueado en la app,
  // no necesita re-autenticarse para cada operación de presupuesto.
  // Si llega token, se valida y se usa. Si no, se asume "logueado" y
  // creado_por queda null.
  if (!token) {
    return { ok: true, user: null, softAuth: true };
  }
  if (!_validateSession || typeof _validateSession !== 'function') {
    // No hay validateSession configurado, pero llegó token: lo aceptamos igual
    // (consistente con los handlers viejos de Excel que no validaban)
    return { ok: true, user: null, softAuth: true };
  }
  var session = _validateSession(token);
  if (!session || !session.ok) {
    // Token inválido pero seguimos (soft auth) — log warning
    console.warn('[' + MOD + '] Token inválido en handler, continuando con soft auth');
    return { ok: true, user: null, softAuth: true };
  }
  return { ok: true, user: session.user };
}

function _notImplemented(channel) {
  return _err('NOT_IMPLEMENTED', 'Handler "' + channel + '" aún no implementado. Plan: docs/plans/presupuesto-bd-migration.md', { phase: 1 });
}

function _stub(channel) {
  return function (event, payload) {
    try {
      console.log('[' + MOD + '][' + channel + '] (Fase 1 stub) payload:', payload || '(none)');
      return _notImplemented(channel);
    } catch (e) {
      console.error('[' + MOD + '][' + channel + ']', e.message);
      return _err('INTERNAL', e.message);
    }
  };
}

// ---------- Helpers de dominio (Presupuesto) ----------

/**
 * Busca una empresa por nombre (display_name o company_key, case-insensitive).
 * Devuelve { id, company_key, display_name } o null.
 */
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

/**
 * Convierte una fila snake_case de la BD al shape camelCase que usa la UI.
 */
function _rowToPresupuesto(r) {
  if (!r) return null;
  return {
    id: r.id,
    empresaId: r.empresa_id,
    anio: r.anio,
    nombre: r.nombre,
    notas: r.notas || '',
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
    creadoPor: r.creado_por
  };
}

/**
 * Carga las partidas activas de un presupuesto, con sus 12 valores mensuales
 * (rellena los meses faltantes con 0). Calcula asignado/ejecutado/porcentaje
 * agregados por partida.
 */
function _getPartidasConValores(presupuestoId) {
  if (!_getDb) return [];
  var localDb = _getDb();
  if (!localDb) return [];

  var partidasRows = localDb.prepare(
    "SELECT id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en " +
    "FROM presupuesto_partidas " +
    "WHERE presupuesto_id = ? AND activo = 1 " +
    "ORDER BY numero ASC"
  ).all(presupuestoId);

  if (partidasRows.length === 0) return [];

  var stmtValores = localDb.prepare(
    "SELECT anio, mes, asignado, ejecutado, notas " +
    "FROM presupuesto_valores_mensuales " +
    "WHERE partida_id = ? " +
    "ORDER BY mes ASC"
  );

  return partidasRows.map(function (p) {
    var valoresRows = stmtValores.all(p.id);
    var valoresByMes = {};
    valoresRows.forEach(function (v) {
      valoresByMes[v.mes] = v;
    });

    var valoresFull = [];
    var totalAsignado = 0;
    var totalEjecutado = 0;
    for (var mes = 1; mes <= 12; mes++) {
      var v = valoresByMes[mes];
      var asignado = v ? (v.asignado || 0) : 0;
      var ejecutado = v ? (v.ejecutado || 0) : 0;
      valoresFull.push({
        mes: mes,
        anio: v ? v.anio : null,
        asignado: asignado,
        ejecutado: ejecutado,
        notas: v ? (v.notas || '') : ''
      });
      totalAsignado += asignado;
      totalEjecutado += ejecutado;
    }

    var porcentaje = totalAsignado > 0 ? (totalEjecutado / totalAsignado) * 100 : 0;

    return {
      id: p.id,
      numero: p.numero,
      concepto: p.concepto,
      descripcion: p.descripcion || '',
      activo: p.activo,
      creadoEn: p.creado_en,
      actualizadoEn: p.actualizado_en,
      asignado: totalAsignado,
      ejecutado: totalEjecutado,
      porcentaje: porcentaje,
      valores: valoresFull
    };
  });
}

/**
 * Calcula el resumen (KPIs del ribbon) a partir de las partidas ya cargadas.
 */
function _calcularResumen(partidas) {
  var totalAsignado = 0;
  var totalEjecutado = 0;
  var mensualAsignado = new Array(12).fill(0);
  var mensualEjecutado = new Array(12).fill(0);

  partidas.forEach(function (p) {
    p.valores.forEach(function (v, idx) {
      mensualAsignado[idx] += v.asignado;
      mensualEjecutado[idx] += v.ejecutado;
      totalAsignado += v.asignado;
      totalEjecutado += v.ejecutado;
    });
  });

  return {
    totalAsignado: totalAsignado,
    totalEjecutado: totalEjecutado,
    porcentaje: totalAsignado > 0 ? (totalEjecutado / totalAsignado) * 100 : 0,
    saldo: totalAsignado - totalEjecutado,
    mensual: {
      asignado: mensualAsignado,
      ejecutado: mensualEjecutado
    }
  };
}

// ---------- Handlers de LECTURA (Fase 1) ----------

/**
 * presupuesto:list-by-empresa
 * Devuelve todos los presupuestos de una empresa, ordenados por año DESC.
 */
function _handlerListByEmpresa(token, companyName) {
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
      "SELECT p.id, p.empresa_id, p.anio, p.nombre, p.notas, p.creado_en, p.actualizado_en, p.creado_por, " +
      "  (SELECT COUNT(*) FROM presupuesto_partidas WHERE presupuesto_id = p.id AND activo = 1) AS partidas_count, " +
      "  (SELECT COALESCE(SUM(v.asignado), 0) FROM presupuesto_valores_mensuales v " +
      "     JOIN presupuesto_partidas pp ON pp.id = v.partida_id " +
      "     WHERE pp.presupuesto_id = p.id AND pp.activo = 1) AS total_asignado, " +
      "  (SELECT COALESCE(SUM(v.ejecutado), 0) FROM presupuesto_valores_mensuales v " +
      "     JOIN presupuesto_partidas pp ON pp.id = v.partida_id " +
      "     WHERE pp.presupuesto_id = p.id AND pp.activo = 1) AS total_ejecutado " +
      "FROM presupuestos p " +
      "WHERE p.empresa_id = ? " +
      "ORDER BY p.anio DESC"
    ).all(company.company_key);

    var presupuestos = rows.map(function (r) {
      var obj = _rowToPresupuesto(r);
      obj.partidasCount = r.partidas_count;
      obj.totalAsignado = r.total_asignado;
      obj.totalEjecutado = r.total_ejecutado;
      obj.porcentaje = obj.totalAsignado > 0 ? (obj.totalEjecutado / obj.totalAsignado) * 100 : 0;
      return obj;
    });

    return _ok({
      presupuestos: presupuestos,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name }
    });
  } catch (e) {
    console.error('[' + MOD + '][list-by-empresa]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:get
 * Devuelve un presupuesto completo por su ID.
 */
function _handlerGet(token, presupuestoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare(
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por " +
      "FROM presupuestos WHERE id = ?"
    ).get(presupuestoId);

    if (!row) {
      return _err('NOT_FOUND', 'Presupuesto "' + presupuestoId + '" no encontrado');
    }

    var presupuesto = _rowToPresupuesto(row);
    var partidas = _getPartidasConValores(presupuestoId);
    var resumen = _calcularResumen(partidas);

    return _ok({
      presupuesto: presupuesto,
      partidas: partidas,
      resumen: resumen
    });
  } catch (e) {
    console.error('[' + MOD + '][get]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:get-by-empresa-anio
 * Devuelve el presupuesto de una empresa para un año específico.
 * Si no existe, devuelve { presupuesto: null, partidas: [] } (no es error).
 */
function _handlerGetByEmpresaAnio(token, companyName, anio) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  var anioNum = parseInt(anio, 10);
  if (!anioNum || anioNum < 2000 || anioNum > 2100) {
    return _err('INVALID_INPUT', 'anio debe ser un número entre 2000 y 2100');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare(
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por " +
      "FROM presupuestos WHERE empresa_id = ? AND anio = ?"
    ).get(company.company_key, anioNum);

    if (!row) {
      return _ok({
        presupuesto: null,
        partidas: [],
        resumen: _calcularResumen([]),
        company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
        anio: anioNum,
        message: 'No hay presupuesto en BD para ' + companyName + ' ' + anioNum
      });
    }

    var presupuesto = _rowToPresupuesto(row);
    var partidas = _getPartidasConValores(row.id);
    var resumen = _calcularResumen(partidas);

    return _ok({
      presupuesto: presupuesto,
      partidas: partidas,
      resumen: resumen,
      company: { id: company.id, companyKey: company.company_key, displayName: company.display_name },
      anio: anioNum
    });
  } catch (e) {
    console.error('[' + MOD + '][get-by-empresa-anio]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:calcular-resumen
 * Recalcula los KPIs de un presupuesto sin traer todas las partidas.
 * Útil para refrescar el ribbon después de una edición.
 */
function _handlerCalcularResumen(token, presupuestoId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var row = localDb.prepare(
      "SELECT id FROM presupuestos WHERE id = ?"
    ).get(presupuestoId);
    if (!row) return _err('NOT_FOUND', 'Presupuesto "' + presupuestoId + '" no encontrado');

    var partidas = _getPartidasConValores(presupuestoId);
    var resumen = _calcularResumen(partidas);

    return _ok({ resumen: resumen, partidasCount: partidas.length });
  } catch (e) {
    console.error('[' + MOD + '][calcular-resumen]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ---------- Handlers granulares (Fase 3.5) ----------
// Permiten agregar, eliminar y modificar partidas desde la UI sin
// tener que volver al Excel. Complementan a bulk-save (que reemplaza
// todas las partidas).

/**
 * presupuesto:add-partida
 * Crea una nueva partida en un presupuesto existente.
 *
 * Input: { presupuestoId, concepto, descripcion?, asignadoTotal? }
 *   - asignadoTotal: valor anual (se distribuye en 12 meses).
 *     Si no se pasa, se asume 0 (todos los meses en 0).
 *
 * El numero se asigna automáticamente (max actual + 1).
 */
function _handlerAddPartida(token, presupuestoId, concepto, descripcion, asignadoTotal) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }
  if (!concepto || typeof concepto !== 'string' || concepto.trim() === '') {
    return _err('INVALID_INPUT', 'concepto es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Verificar que el presupuesto existe
    var pres = localDb.prepare('SELECT id, anio FROM presupuestos WHERE id = ?').get(presupuestoId);
    if (!pres) return _err('NOT_FOUND', 'Presupuesto "' + presupuestoId + '" no encontrado');

    // Siguiente numero = max + 1
    var maxRow = localDb.prepare(
      'SELECT COALESCE(MAX(numero), 0) AS max FROM presupuesto_partidas WHERE presupuesto_id = ?'
    ).get(presupuestoId);
    var nextNumero = (maxRow.max || 0) + 1;

    // Calcular asignado por mes
    var asigTotal = _toNumericValue(asignadoTotal);
    var asigPorMes = asigTotal / 12;

    var now = new Date().toISOString();
    var newPartidaId = _newPartidaId();

    localDb.exec('BEGIN TRANSACTION;');
    try {
      // Insertar partida
      localDb.prepare(
        "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en) " +
        "VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
      ).run(newPartidaId, presupuestoId, nextNumero, concepto.trim(), (descripcion || '').trim(), now, now);

      // Insertar 12 valores mensuales (asignado distribuido, ejecutado = 0)
      var stmtValor = localDb.prepare(
        "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
        "VALUES (?, ?, ?, ?, 0, '', ?)"
      );
      for (var m = 1; m <= 12; m++) {
        stmtValor.run(newPartidaId, pres.anio, m, asigPorMes, now);
      }
      localDb.exec('COMMIT;');

      return _ok({
        partida: {
          id: newPartidaId,
          presupuestoId: presupuestoId,
          numero: nextNumero,
          concepto: concepto.trim(),
          descripcion: (descripcion || '').trim(),
          asignado: asigTotal,
          ejecutado: 0
        }
      });
    } catch (e) {
      localDb.exec('ROLLBACK;');
      throw e;
    }
  } catch (e) {
    console.error('[' + MOD + '][add-partida]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:delete-partida
 * Soft-delete: marca la partida como activo=0 (no la borra físicamente).
 * Cascada: sus valores_mensuales quedan pero no aparecen en queries con activo=1.
 *
 * Input: { partidaId }
 */
function _handlerDeletePartida(token, partidaId) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!partidaId || typeof partidaId !== 'string') {
    return _err('INVALID_INPUT', 'partidaId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Verificar que la partida existe
    var partida = localDb.prepare(
      'SELECT id, presupuesto_id, numero, concepto, activo FROM presupuesto_partidas WHERE id = ?'
    ).get(partidaId);
    if (!partida) return _err('NOT_FOUND', 'Partida "' + partidaId + '" no encontrada');
    if (partida.activo === 0) return _err('ALREADY_DELETED', 'La partida ya está eliminada');

    // Soft delete
    var now = new Date().toISOString();
    localDb.prepare(
      'UPDATE presupuesto_partidas SET activo = 0, actualizado_en = ? WHERE id = ?'
    ).run(now, partidaId);

    return _ok({
      deleted: {
        id: partidaId,
        numero: partida.numero,
        concepto: partida.concepto,
        presupuestoId: partida.presupuesto_id
      }
    });
  } catch (e) {
    console.error('[' + MOD + '][delete-partida]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:set-mes-values
 * Actualiza los valores (asignado/ejecutado) de un mes específico de una partida.
 * Útil para edición granular sin tener que enviar bulk-save completo.
 *
 * Input: { partidaId, anio, mes, asignado, ejecutado }
 */
function _handlerSetMesValues(token, partidaId, anio, mes, asignado, ejecutado) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!partidaId || typeof partidaId !== 'string') {
    return _err('INVALID_INPUT', 'partidaId es requerido');
  }
  var anioNum = parseInt(anio, 10);
  if (!anioNum || anioNum < 2000 || anioNum > 2100) {
    return _err('INVALID_INPUT', 'anio debe ser un número entre 2000 y 2100');
  }
  var mesNum = parseInt(mes, 10);
  if (!mesNum || mesNum < 1 || mesNum > 12) {
    return _err('INVALID_INPUT', 'mes debe ser un número entre 1 y 12');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // Verificar que la partida existe y está activa
    var partida = localDb.prepare(
      'SELECT id FROM presupuesto_partidas WHERE id = ? AND activo = 1'
    ).get(partidaId);
    if (!partida) return _err('NOT_FOUND', 'Partida "' + partidaId + '" no encontrada o inactiva');

    // Upsert (INSERT OR UPDATE)
    var now = new Date().toISOString();
    var asigVal = _toNumericValue(asignado);
    var ejecVal = _toNumericValue(ejecutado);

    // Verificar si ya existe el row
    var existing = localDb.prepare(
      'SELECT id FROM presupuesto_valores_mensuales WHERE partida_id = ? AND anio = ? AND mes = ?'
    ).get(partidaId, anioNum, mesNum);

    if (existing) {
      localDb.prepare(
        'UPDATE presupuesto_valores_mensuales SET asignado = ?, ejecutado = ?, actualizado_en = ? WHERE id = ?'
      ).run(asigVal, ejecVal, now, existing.id);
    } else {
      localDb.prepare(
        'INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) ' +
        'VALUES (?, ?, ?, ?, ?, "", ?)'
      ).run(partidaId, anioNum, mesNum, asigVal, ejecVal, now);
    }

    return _ok({
      partidaId: partidaId,
      anio: anioNum,
      mes: mesNum,
      asignado: asigVal,
      ejecutado: ejecVal
    });
  } catch (e) {
    console.error('[' + MOD + '][set-mes-values]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:update-meta
 * Actualiza el nombre y/o las notas de un presupuesto.
 *
 * Input: { presupuestoId, nombre?, notas? }
 */
function _handlerUpdateMeta(token, presupuestoId, nombre, notas) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var pres = localDb.prepare('SELECT id FROM presupuestos WHERE id = ?').get(presupuestoId);
    if (!pres) return _err('NOT_FOUND', 'Presupuesto no encontrado');

    // Build dynamic update
    var updates = [];
    var values = [];
    if (typeof nombre === 'string') {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (typeof notas === 'string') {
      updates.push('notas = ?');
      values.push(notas);
    }
    if (updates.length === 0) {
      return _err('INVALID_INPUT', 'Debe pasar al menos nombre o notas');
    }
    updates.push('actualizado_en = ?');
    values.push(new Date().toISOString());
    values.push(presupuestoId);

    localDb.prepare('UPDATE presupuestos SET ' + updates.join(', ') + ' WHERE id = ?').run.apply(null, values);

    return _ok({ presupuestoId: presupuestoId });
  } catch (e) {
    console.error('[' + MOD + '][update-meta]', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ---------- Exportador a Excel (Fase 5) ----------

/**
 * Genera un .xlsx con la misma estructura ACT-FO-043 a partir de los datos
 * del presupuesto en BD.
 *
 * Estructura generada:
 *   - Filas 1-8: vacías (mismo margen que el original)
 *   - Fila 9: headers (ID, Detalle, Asignación, Ejecutado, %, Ene..Dic)
 *   - Fila 10+: una fila por partida con sus valores mensuales
 *   - Última fila: TOTAL AÑO (suma de todas las partidas)
 *
 * Devuelve un Buffer con el .xlsx listo para escribir a disco.
 */
function _buildPresupuestoXLSX(presupuesto, partidas) {
  var ExcelJS = require('exceljs');
  var workbook = new ExcelJS.Workbook();
  var ws = workbook.addWorksheet('Presupuesto ' + presupuesto.anio);

  // Headers en fila 9
  var headerRow = ws.getRow(9);
  headerRow.values = [
    '',                                  // A: ID
    '',                                  // B: (vacía)
    'Detalle',                           // C
    'Asignación',                        // D
    'Ejecutado Acumulado',               // E
    '% Ejecutado',                       // F
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre' // G-R
  ];

  // Anchos de columna
  ws.columns = [
    { width: 10 }, { width: 5 }, { width: 30 },
    { width: 15 }, { width: 15 }, { width: 12 }
  ];
  for (var c = 0; c < 12; c++) ws.getColumn(7 + c).width = 12;

  // Datos
  var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var totalAsignado = 0;
  var totalEjecutado = 0;
  var mensualesAsignado = new Array(12).fill(0);

  partidas.forEach(function (p, idx) {
    var rowIdx = 10 + idx;
    var row = ws.getRow(rowIdx);
    row.getCell(1).value = p.numero;  // A: ID
    row.getCell(3).value = p.concepto;  // C: Detalle
    row.getCell(4).value = p.asignado || 0;  // D: Asignación
    row.getCell(5).value = p.ejecutado || 0;  // E: Ejecutado
    var pct = (p.asignado > 0) ? ((p.ejecutado || 0) / p.asignado * 100) : 0;
    row.getCell(6).value = pct.toFixed(2) + '%';  // F: %

    // Valores mensuales (G-R = columnas 7-18)
    if (p.valores) {
      p.valores.forEach(function (v, mIdx) {
        row.getCell(7 + mIdx).value = v.asignado || 0;
        mensualesAsignado[mIdx] += v.asignado || 0;
      });
    }

    totalAsignado += p.asignado || 0;
    totalEjecutado += p.ejecutado || 0;
  });

  // Fila TOTAL AÑO
  var totalRowIdx = 10 + partidas.length;
  var totalRow = ws.getRow(totalRowIdx);
  totalRow.getCell(1).value = 'TOTAL AÑO';
  totalRow.getCell(3).value = 'TOTAL AÑO';
  totalRow.getCell(4).value = totalAsignado;
  totalRow.getCell(5).value = totalEjecutado;
  var totalPct = totalAsignado > 0 ? (totalEjecutado / totalAsignado * 100) : 0;
  totalRow.getCell(6).value = totalPct.toFixed(2) + '%';
  for (var m = 0; m < 12; m++) {
    totalRow.getCell(7 + m).value = mensualesAsignado[m];
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * presupuesto:export-excel
 * Exporta un presupuesto de la BD a un archivo .xlsx.
 *
 * Input: { presupuestoId, outputPath? }
 *   - outputPath: ruta completa del archivo .xlsx a generar
 *   - Si no se pasa, muestra un dialog de "Save As"
 *
 * Devuelve: { success, path, size }
 */
async function _handlerExportExcel(token, presupuestoId, outputPath) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  // 1. Leer presupuesto
  var presRow;
  try {
    presRow = localDb.prepare(
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por " +
      "FROM presupuestos WHERE id = ?"
    ).get(presupuestoId);
  } catch (e) {
    return _err('INTERNAL', e.message);
  }
  if (!presRow) return _err('NOT_FOUND', 'Presupuesto "' + presupuestoId + '" no encontrado');

  // 2. Leer partidas + valores
  var partidasRows = localDb.prepare(
    "SELECT id, presupuesto_id, numero, concepto, descripcion " +
    "FROM presupuesto_partidas WHERE presupuesto_id = ? AND activo = 1 ORDER BY numero ASC"
  ).all(presupuestoId);

  var stmtValores = localDb.prepare(
    "SELECT mes, asignado, ejecutado FROM presupuesto_valores_mensuales " +
    "WHERE partida_id = ? ORDER BY mes ASC"
  );

  var presupuesto = _rowToPresupuesto(presRow);
  var partidas = partidasRows.map(function (p) {
    var valores = stmtValores.all(p.id);
    var valoresFull = [];
    var totalAsig = 0, totalEjec = 0;
    for (var m = 1; m <= 12; m++) {
      var v = null;
      for (var i = 0; i < valores.length; i++) {
        if (valores[i].mes === m) { v = valores[i]; break; }
      }
      var asig = v ? (v.asignado || 0) : 0;
      var ejec = v ? (v.ejecutado || 0) : 0;
      valoresFull.push({ mes: m, asignado: asig, ejecutado: ejec });
      totalAsig += asig;
      totalEjec += ejec;
    }
    return {
      id: p.id,
      numero: p.numero,
      concepto: p.concepto,
      descripcion: p.descripcion || '',
      asignado: totalAsig,
      ejecutado: totalEjec,
      porcentaje: totalAsig > 0 ? (totalEjec / totalAsig * 100) : 0,
      valores: valoresFull
    };
  });

  // 3. Generar el archivo .xlsx (writeBuffer es async)
  var buffer;
  try {
    buffer = await _buildPresupuestoXLSX(presupuesto, partidas);
  } catch (e) {
    console.error('[' + MOD + '][export-excel] build error:', e.message);
    return _err('BUILD_ERROR', 'Error generando Excel: ' + e.message);
  }

  // 4. Si no hay outputPath, abrir dialog "Save As"
  var finalPath = outputPath;
  if (!finalPath) {
    try {
      var dialog = require('electron').dialog || (typeof electron !== 'undefined' ? electron.dialog : null);
      // En el contexto del bridge (main process), dialog está disponible
      var electronModule = require('electron');
      var saveResult = electronModule.dialog.showSaveDialogSync({
        title: 'Exportar presupuesto a Excel',
        defaultPath: (presRow.empresa_id || 'presupuesto') + '_' + presRow.anio + '.xlsx',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });
      if (!saveResult || !saveResult.filePath) {
        return _err('CANCELLED', 'Cancelado por el usuario');
      }
      finalPath = saveResult.filePath;
    } catch (e) {
      return _err('NO_DIALOG', 'No se puede mostrar dialog. Pasá outputPath explícito. (' + e.message + ')');
    }
  }

  // 5. Escribir a disco
  var fs = require('fs');
  try {
    fs.writeFileSync(finalPath, buffer);
  } catch (e) {
    console.error('[' + MOD + '][export-excel] write error:', e.message);
    return _err('WRITE_ERROR', 'Error escribiendo archivo: ' + e.message);
  }

  return _ok({
    path: finalPath,
    size: buffer.length,
    presupuesto: presupuesto,
    partidasCount: partidas.length
  });
}

// ---------- Handlers de ESCRITURA (Fase 3) ----------

/**
 * presupuesto:bulk-save
 * Reemplaza TODAS las partidas y valores de un presupuesto con los datos
 * enviados por la UI. Usa una transacción SQL: si algo falla, hace ROLLBACK.
 *
 * Input shape (mismo que la UI envía hoy para Excel):
 *   data: [
 *     { id, detalle, asignacion, ejecutado_acumulado, enero, feb, mar, abr, may, jun, jul, ago, sep, oct, nov, dic },
 *     ...
 *   ]
 *   (Stop en fila con id='TOTAL AÑO' o sin detalle)
 *
 * El handler:
 *   1. Verifica que el presupuesto existe
 *   2. Soft-delete todas las partidas existentes (cascade a valores)
 *   3. Para cada fila del array: crea una partida + 12 valores mensuales
 *   4. Actualiza presupuesto.actualizado_en
 *   5. Todo en una transacción
 */
function _handlerBulkSave(token, presupuestoId, data) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!presupuestoId || typeof presupuestoId !== 'string') {
    return _err('INVALID_INPUT', 'presupuestoId es requerido');
  }
  if (!data || !Array.isArray(data)) {
    return _err('INVALID_INPUT', 'data (array de partidas) es requerido');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  // 1. Verificar que el presupuesto existe y obtener el año
  var pres;
  try {
    pres = localDb.prepare("SELECT id, anio, empresa_id FROM presupuestos WHERE id = ?").get(presupuestoId);
  } catch (e) {
    return _err('INTERNAL', e.message);
  }
  if (!pres) return _err('NOT_FOUND', 'Presupuesto "' + presupuestoId + '" no encontrado');

  // 2. Filtrar filas vacías y la fila TOTAL AÑO
  var now = new Date().toISOString();
  var partidasInput = data.filter(function (row) {
    if (!row) return false;
    var detalle = row.detalle;
    var id = row.id;
    // Saltar fila TOTAL AÑO
    if (typeof id === 'string' && id.indexOf('TOTAL') >= 0) return false;
    if (typeof detalle === 'string' && detalle.indexOf('TOTAL') >= 0) return false;
    // Saltar filas sin detalle
    if (!detalle || (typeof detalle === 'string' && detalle.trim() === '')) return false;
    return true;
  });

  // 3. Transacción
  try {
    localDb.exec('BEGIN TRANSACTION;');

    // Soft-delete partidas existentes (cascade a valores_mensuales)
    localDb.prepare("DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?").run(presupuestoId);

    // Preparar statements
    var stmtInsertPartida = localDb.prepare(
      "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en) " +
      "VALUES (?, ?, ?, ?, '', 1, ?, ?)"
    );
    var stmtInsertValor = localDb.prepare(
      "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
      "VALUES (?, ?, ?, ?, ?, '', ?)"
    );

    var insertedPartidas = 0;
    var insertedValores = 0;
    var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    for (var i = 0; i < partidasInput.length; i++) {
      var row = partidasInput[i];
      var newPartidaId = _newPartidaId();
      var numero = (typeof row.id === 'number') ? row.id : (i + 1);
      var concepto = (typeof row.detalle === 'string') ? row.detalle.trim() : String(row.detalle || '');

      stmtInsertPartida.run(newPartidaId, presupuestoId, numero, concepto, now, now);
      insertedPartidas++;

      // Detectar si hay al menos un valor mensual != 0
      var hasMonthly = false;
      for (var c = 0; c < 12; c++) {
        if (_toNumericValue(row[COLUMN_MESES[c]]) > 0) { hasMonthly = true; break; }
      }

      // Insertar 12 valores mensuales.
      // Estrategia:
      //   - Si hay valores mensuales, se usan como ASIGNADO por mes
      //   - Si NO hay valores mensuales, se distribuye el anual en 12
      //   - El ejecutado por mes siempre arranca en 0 (la UI lo edita después)
      // Esto preserva los datos del usuario y mantiene consistencia con
      // el importador desde Excel (Fase 4).
      var asignadoTotal = _toNumericValue(row.asignacion);
      for (var m = 0; m < 12; m++) {
        var asignadoMes = hasMonthly
          ? _toNumericValue(row[COLUMN_MESES[m]])
          : (asignadoTotal / 12);
        stmtInsertValor.run(newPartidaId, pres.anio, m + 1, asignadoMes, 0, now);
        insertedValores++;
      }
    }

    // Actualizar timestamp del presupuesto
    localDb.prepare("UPDATE presupuestos SET actualizado_en = ? WHERE id = ?").run(now, presupuestoId);

    localDb.exec('COMMIT;');

    return _ok({
      inserted: insertedPartidas,
      valores: insertedValores,
      presupuestoId: presupuestoId,
      savedAt: now
    });
  } catch (e) {
    try { localDb.exec('ROLLBACK;'); } catch (re) {}
    console.error('[' + MOD + '][bulk-save]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:create
 * Crea un presupuesto "shell" (vacío, sin partidas) para una empresa/año.
 * Útil cuando se quiere empezar desde cero.
 */
function _handlerCreate(token, companyName, anio, nombre) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  var anioNum = parseInt(anio, 10);
  if (!anioNum || anioNum < 2000 || anioNum > 2100) {
    return _err('INVALID_INPUT', 'anio debe ser un número entre 2000 y 2100');
  }

  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var existing = localDb.prepare(
      "SELECT id FROM presupuestos WHERE empresa_id = ? AND anio = ?"
    ).get(company.company_key, anioNum);
    if (existing) {
      return _err('ALREADY_EXISTS', 'Ya existe un presupuesto para ' + companyName + ' ' + anioNum, { existingId: existing.id });
    }

    var now = new Date().toISOString();
    var newPresId = _newPresupuestoId();
    var presupuestoNombre = (nombre && typeof nombre === 'string') ? nombre : ('Presupuesto ' + companyName + ' ' + anioNum);

    localDb.prepare(
      "INSERT INTO presupuestos (id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por) " +
      "VALUES (?, ?, ?, ?, '', ?, ?, ?)"
    ).run(newPresId, company.company_key, anioNum, presupuestoNombre, now, now, auth.user && auth.user.id ? auth.user.id : null);

    return _ok({ presupuestoId: newPresId, presupuesto: { id: newPresId, empresaId: company.company_key, anio: anioNum, nombre: presupuestoNombre } });
  } catch (e) {
    console.error('[' + MOD + '][create]', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * Genera un ID único para presupuestos con formato p-{timestamp36}-{rand}.
 * Ej: p-l8k2j3h4-a3f4
 */
function _newPresupuestoId() {
  return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

function _newPartidaId() {
  return 'pp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/**
 * Convierte un valor del Excel (string con formato US, número, o vacío) a número.
 * - "$1,234.56" → 1234.56
 * - "" o "-" → 0
 * - null/undefined → 0
 * - número → 그대로
 */
function _toNumericValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    var clean = value.replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
    if (clean === '' || clean === '-') return 0;
    var n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/**
 * Parsea un archivo Excel de presupuesto y devuelve la estructura normalizada.
 * Formato esperado (basado en ACT-FO-043):
 *   - Primera hoja
 *   - Headers en fila 9 (índice 8)
 *   - Datos desde fila 10 (índice 9)
 *   - Stop en fila que contenga "TOTAL AÑO" en col A o B
 *   - Col A=id, C=detalle, D=asignacion, E=ejecutado_acumulado, F=%, G-R=meses
 *
 * Devuelve:
 *   {
 *     sheetName: string,
 *     range: string,
 *     nombre: string (extraído del título o genérico),
 *     partidas: [{ numero, concepto, asignado, ejecutado, valores: [{mes, asignado, ejecutado}] }]
 *   }
 */
function _parsePresupuestoXLSX(filePath) {
  var xlsx = require('xlsx');
  var workbook = xlsx.readFile(filePath);
  var sheetName = workbook.SheetNames[0];
  var worksheet = workbook.Sheets[sheetName];

  if (!worksheet || !worksheet['!ref']) {
    throw new Error('La hoja "' + sheetName + '" está vacía o no se puede leer');
  }

  // Mismo rango corregido que usa readPresupuestoData (A1 a R{lastRow})
  var originalRange = xlsx.utils.decode_range(worksheet['!ref']);
  var correctedRange = { s: { c: 0, r: 0 }, e: { c: 17, r: originalRange.e.r } };
  var correctedRangeStr = xlsx.utils.encode_range(correctedRange);

  var allData = xlsx.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: null,
    range: correctedRangeStr
  });

  // Mapeo de columnas (mismo que readPresupuestoData)
  var COL = {
    id: 0,        // A
    detalle: 2,   // C
    asignacion: 3, // D
    ejecucion: 4, // E
    pct: 5,       // F
    meses: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]  // G..R (Ene..Dic)
  };

  // Headers en fila 9 (índice 8) — los ignoramos porque conocemos el formato
  // Datos desde fila 10 (índice 9)
  var dataStartIndex = 9;
  var rawData = allData.slice(dataStartIndex);
  var partidas = [];
  var nextNumero = 1;

  for (var i = 0; i < rawData.length; i++) {
    var row = rawData[i];
    if (!row) continue;

    var firstCell = row[COL.id];
    var secondCell = row[1]; // B — puede tener "TOTAL AÑO" si A-B está merged

    // Stop en TOTAL AÑO
    if ((typeof firstCell === 'string' && firstCell.indexOf('TOTAL AÑO') >= 0) ||
        (typeof secondCell === 'string' && secondCell.indexOf('TOTAL AÑO') >= 0)) {
      break;
    }

    // Saltar filas vacías
    var detalle = row[COL.detalle];
    if (!detalle || (typeof detalle === 'string' && detalle.trim() === '')) continue;

    // Parsear valores mensuales.
    // Estructura del Excel:
    //   - Col D (asignacion) = ASIGNADO TOTAL ANUAL (no se desglosa por mes)
    //   - Col E (ejecucion) = EJECUTADO TOTAL ANUAL
    //   - Cols G-R (meses) = EJECUTADO MENSUAL (por mes)
    //
    // Para la BD, distribuimos el asignado anual en 12 meses (asignado_mes = total/12)
    // para que SUM(v.asignado) por partida == total anual (consistente con la UI).
    // El ejecutado mensual se guarda tal cual viene del Excel.
    var valores = [];
    var asignadoTotal = _toNumericValue(row[COL.asignacion]);
    var asignadoPorMes = asignadoTotal / 12;
    for (var m = 0; m < 12; m++) {
      var ejecutadoMes = _toNumericValue(row[COL.meses[m]]);
      valores.push({ mes: m + 1, asignado: asignadoPorMes, ejecutado: ejecutadoMes });
    }

    partidas.push({
      numero: nextNumero++,
      concepto: typeof detalle === 'string' ? detalle.trim() : String(detalle),
      descripcion: '',
      asignado: asignadoTotal,
      ejecutado: _toNumericValue(row[COL.ejecucion]),
      valores: valores
    });
  }

  return {
    sheetName: sheetName,
    range: correctedRangeStr,
    nombre: 'Presupuesto importado de ' + sheetName,
    partidas: partidas
  };
}

/**
 * presupuesto:import-from-excel
 * Lee un Excel con formato ACT-FO-043 y crea presupuesto + partidas + valores en BD.
 *
 * Payload:
 *   { token, filePath, companyName, anio, options?: { overwrite?: boolean, dryRun?: boolean } }
 *
 * Comportamiento:
 *   - Si dryRun=true: parsea el Excel y devuelve stats SIN escribir en BD
 *   - Si overwrite=false (default) y ya existe el presupuesto: retorna error ALREADY_EXISTS
 *   - Si overwrite=true: marca el presupuesto existente como activo=0 (soft delete) y crea uno nuevo
 */
function _handlerImportFromExcel(token, filePath, companyName, anio, options) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  if (!filePath || typeof filePath !== 'string') {
    return _err('INVALID_INPUT', 'filePath es requerido');
  }
  if (!companyName || typeof companyName !== 'string') {
    return _err('INVALID_INPUT', 'companyName es requerido');
  }
  var anioNum = parseInt(anio, 10);
  if (!anioNum || anioNum < 2000 || anioNum > 2100) {
    return _err('INVALID_INPUT', 'anio debe ser un número entre 2000 y 2100');
  }

  options = options || {};
  var overwrite = !!options.overwrite;
  var dryRun = !!options.dryRun;

  // 1. Verificar que el archivo existe
  var fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return _err('FILE_NOT_FOUND', 'Archivo no encontrado: ' + filePath);
  }

  // 2. Buscar la empresa
  var company = _getCompanyByName(companyName);
  if (!company) {
    return _err('COMPANY_NOT_FOUND', 'Empresa "' + companyName + '" no encontrada en la BD');
  }

  // 3. Parsear el Excel
  var parsed;
  try {
    parsed = _parsePresupuestoXLSX(filePath);
  } catch (e) {
    console.error('[' + MOD + '][import-from-excel] parse error:', e.message);
    return _err('PARSE_ERROR', 'Error parseando Excel: ' + e.message);
  }

  if (!parsed.partidas || parsed.partidas.length === 0) {
    return _err('EMPTY_FILE', 'El Excel no contiene partidas válidas (¿verificaste que tiene la estructura ACT-FO-043 con headers en fila 9 y datos desde fila 10?)');
  }

  if (dryRun) {
    return _ok({
      dryRun: true,
      parsed: {
        sheetName: parsed.sheetName,
        range: parsed.range,
        nombre: parsed.nombre,
        partidasCount: parsed.partidas.length,
        firstPartida: parsed.partidas[0] ? { numero: parsed.partidas[0].numero, concepto: parsed.partidas[0].concepto } : null,
        lastPartida: parsed.partidas[parsed.partidas.length - 1] ? { numero: parsed.partidas[parsed.partidas.length - 1].numero, concepto: parsed.partidas[parsed.partidas.length - 1].concepto } : null
      }
    });
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    // 4. Verificar si ya existe un presupuesto para esta empresa/año
    var existing = localDb.prepare(
      "SELECT id FROM presupuestos WHERE empresa_id = ? AND anio = ?"
    ).get(company.company_key, anioNum);

    if (existing && !overwrite) {
      return _err('ALREADY_EXISTS', 'Ya existe un presupuesto para ' + companyName + ' ' + anioNum + ' (id=' + existing.id + '). Usa options.overwrite=true para reemplazarlo.', { existingId: existing.id });
    }

    var now = new Date().toISOString();
    var stmtInsertPartida, stmtInsertValor;
    var insertedPartidas = 0, insertedValores = 0;
    var replacedId = null;

    localDb.exec('BEGIN TRANSACTION;');
    try {
      var newPresId;
      if (existing && overwrite) {
        // 5a. Overwrite: borrar las partidas viejas (cascada a valores) y reusar el mismo id
        localDb.prepare("DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?").run(existing.id);
        localDb.prepare("UPDATE presupuestos SET actualizado_en = ?, nombre = ? WHERE id = ?")
          .run(now, parsed.nombre || ('Presupuesto ' + companyName + ' ' + anioNum), existing.id);
        newPresId = existing.id;
        replacedId = existing.id;
      } else {
        // 5b. Crear nuevo
        newPresId = _newPresupuestoId();
        localDb.prepare(
          "INSERT INTO presupuestos (id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por) " +
          "VALUES (?, ?, ?, ?, '', ?, ?, ?)"
        ).run(newPresId, company.company_key, anioNum, parsed.nombre || ('Presupuesto ' + companyName + ' ' + anioNum), now, now, auth.user && auth.user.id ? auth.user.id : null);
      }

      // 6. Insertar partidas + valores
      stmtInsertPartida = localDb.prepare(
        "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en) " +
        "VALUES (?, ?, ?, ?, '', 1, ?, ?)"
      );
      stmtInsertValor = localDb.prepare(
        "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
        "VALUES (?, ?, ?, ?, ?, '', ?)"
      );

      for (var p = 0; p < parsed.partidas.length; p++) {
        var partidaData = parsed.partidas[p];
        var newPartidaId = _newPartidaId();
        stmtInsertPartida.run(newPartidaId, newPresId, partidaData.numero, partidaData.concepto, now, now);
        insertedPartidas++;
        for (var v = 0; v < partidaData.valores.length; v++) {
          var val = partidaData.valores[v];
          stmtInsertValor.run(newPartidaId, anioNum, val.mes, val.asignado, val.ejecutado, now);
          insertedValores++;
        }
      }
      localDb.exec('COMMIT;');
    } catch (e) {
      localDb.exec('ROLLBACK;');
      throw e;
    }

    return _ok({
      inserted: insertedPartidas,
      valores: insertedValores,
      presupuestoId: newPresId,
      sheetName: parsed.sheetName,
      range: parsed.range,
      replaced: replacedId
    });
  } catch (e) {
    console.error('[' + MOD + '][import-from-excel] DB error:', e.message);
    return _err('INTERNAL', e.message);
  }
}

// ---------- Registro de handlers IPC ----------
// 📦708 Fase 4 — Importador desde Excel implementado.
// Lectura (Fase 1) y import (Fase 4) activos. Escritura y export siguen como stub.
function registerPresupuestoHandlers(app, deps) {
  _getDb = (deps && typeof deps.getDb === 'function') ? deps.getDb : null;
  _validateSession = (deps && typeof deps.validateSession === 'function') ? deps.validateSession : null;

  // --------- Lectura (Fase 1) ---------
  ipcMain.handle('presupuesto:list-by-empresa', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerListByEmpresa(p.token || '', p.companyName);
    } catch (e) {
      console.error('[' + MOD + '][list-by-empresa]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('presupuesto:get', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGet(p.token || '', p.presupuestoId);
    } catch (e) {
      console.error('[' + MOD + '][get]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('presupuesto:get-by-empresa-anio', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerGetByEmpresaAnio(p.token || '', p.companyName, p.anio);
    } catch (e) {
      console.error('[' + MOD + '][get-by-empresa-anio]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  ipcMain.handle('presupuesto:calcular-resumen', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCalcularResumen(p.token || '', p.presupuestoId);
    } catch (e) {
      console.error('[' + MOD + '][calcular-resumen]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

  // --------- Escritura (Fase 3 + Fase 3.5) ---------
  // Implementados: create, bulk-save, add-partida, delete-partida, set-mes-values, update-meta.
  // Pendiente: update-partida (no prioritario — bulk-save cubre la edición).
  ipcMain.handle('presupuesto:create', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerCreate(p.token || '', p.companyName, p.anio, p.nombre);
    } catch (e) {
      console.error('[' + MOD + '][create]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:update-meta', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerUpdateMeta(p.token || '', p.presupuestoId, p.nombre, p.notas);
    } catch (e) {
      console.error('[' + MOD + '][update-meta]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:add-partida', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerAddPartida(p.token || '', p.presupuestoId, p.concepto, p.descripcion, p.asignadoTotal);
    } catch (e) {
      console.error('[' + MOD + '][add-partida]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:delete-partida', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDeletePartida(p.token || '', p.partidaId);
    } catch (e) {
      console.error('[' + MOD + '][delete-partida]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:set-mes-values', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerSetMesValues(p.token || '', p.partidaId, p.anio, p.mes, p.asignado, p.ejecutado);
    } catch (e) {
      console.error('[' + MOD + '][set-mes-values]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:bulk-save', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerBulkSave(p.token || '', p.presupuestoId, p.data);
    } catch (e) {
      console.error('[' + MOD + '][bulk-save]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:update-partida', _stub('presupuesto:update-partida'));

  // --------- Import / Export ---------
  // Fase 4: import-from-excel implementado.
  // Fase 5: export-excel implementado.
  // Fase 5: export-template sigue como stub (no prioritario).
  ipcMain.handle('presupuesto:import-from-excel', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerImportFromExcel(p.token || '', p.filePath, p.companyName, p.anio, p.options);
    } catch (e) {
      console.error('[' + MOD + '][import-from-excel]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:export-excel', async function (event, payload) {
    try {
      var p = payload || {};
      return await _handlerExportExcel(p.token || '', p.presupuestoId, p.outputPath);
    } catch (e) {
      console.error('[' + MOD + '][export-excel]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:export-template', _stub('presupuesto:export-template'));

  // --------- Diagnóstico (Fase 0+, sigue activo) ---------
  ipcMain.handle('presupuesto:diag', function (event, payload) {
    try {
      var localDb = _getDb ? _getDb() : null;
      var tables = [];
      var counts = {};
      if (localDb) {
        try {
          var rows = localDb.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'presupuesto%' ORDER BY name"
          ).all();
          tables = rows.map(function (r) { return r.name; });
          ['presupuestos', 'presupuesto_partidas', 'presupuesto_valores_mensuales'].forEach(function (t) {
            try {
              counts[t] = localDb.prepare('SELECT COUNT(*) AS c FROM ' + t).get().c;
            } catch (e) { counts[t] = '<error: ' + e.message + '>'; }
          });
        } catch (e) {
          tables = ['<error: ' + e.message + '>'];
        }
      }
      return {
        success: true,
        data: {
          bridge: 'presupuesto-bridge',
          phase: 1,
          schema_applied: tables.length === 3,
          tables: tables,
          counts: counts,
          has_getDb: typeof _getDb === 'function',
          has_validateSession: typeof _validateSession === 'function',
          message: '📦708 Fase 1 — Bridge con handlers de LECTURA. 4 canales activos, 10 siguen como stub.'
        }
      };
    } catch (e) {
      return _err('INTERNAL', e.message);
    }
  });

  console.log('[' + MOD + '][INIT][SUCCESS] Bridge registrado · 4 read + 6 write (create + bulk-save + add-partida + delete-partida + set-mes-values + update-meta) + 1 stub (update-partida) + 1 import + 1 export + 1 export (stub) + 1 diag · schema v' + (PRESUPUESTO_MIGRATIONS_SQL.length + 1));
}

module.exports = {
  registerPresupuestoHandlers: registerPresupuestoHandlers,
  SCHEMA_SQL: PRESUPUESTO_SCHEMA_SQL,
  MIGRATIONS_SQL: PRESUPUESTO_MIGRATIONS_SQL
};
