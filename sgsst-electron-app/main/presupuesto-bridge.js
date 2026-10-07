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
const {
  PRESUPUESTO_SCHEMA_SQL,
  PRESUPUESTO_SCHEMA_ALTERS,
  PRESUPUESTO_MIGRATIONS_SQL,
  PRESUPUESTO_MIGRATION_IDS
} = require('./presupuesto-schema-sql');

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
    creadoPor: r.creado_por,
    // 📦824 — Datos del archivo de origen. La UI los usa para mostrar de dónde
    // salió el presupuesto y para avisar cuando el Excel cambió.
    archivoOrigen: r.archivo_origen || null,
    archivoNombre: r.archivo_nombre || null,
    archivoImportadoEn: r.archivo_importado_en || null,
    // El TOTAL que declara el Excel, guardado aparte del calculado. Si no
    // coinciden, la diferencia está en la fila de resumen del archivo.
    totalDeclaradoAsignado: r.total_declarado_asignado,
    totalDeclaradoEjecutado: r.total_declarado_ejecutado,
    // 📦824 — IPC por período, editable por el owner (cambia cada año).
    ipc: r.ipc,
    // Avisos del import (JSON array) — p. ej. el TOTAL AÑO del Excel que no cuadra.
    avisos: (function () {
      if (!r.avisos_importacion) return [];
      try { return JSON.parse(r.avisos_importacion); } catch (e) { return []; }
    })()
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
    // 📦824 — se suman las columnas del archivo de Excel que la v1 no leía:
    // el anual real, el ejecutado acumulado y el % de ejecución.
    "SELECT id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en, " +
    "  asignado_anual, ejecutado_acumulado, porcentaje_eje, numero_excel " +
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

    // 📦824 — El ANUAL de la partida es la columna D del ACT-FO-043
    // (`asignado_anual`), que es lo que escribió el archivo. El `asignado` que
    // se devuelve antes era la SUMA de los 12 meses, y esos meses son un reparto
    // derivado: al recalcularlos la suma daba 9.999.999,999999998 en vez de
    // 10.000.000. Se usa la columna D y, solo si no existe, se cae a la suma.
    var anualDeLaPartida = (p.asignado_anual !== null && p.asignado_anual !== undefined)
      ? p.asignado_anual
      : totalAsignado;
    var porcentajeReal = anualDeLaPartida > 0 ? (totalEjecutado / anualDeLaPartida) * 100 : 0;

    return {
      id: p.id,
      numero: p.numero,
      concepto: p.concepto,
      descripcion: p.descripcion || '',
      activo: p.activo,
      creadoEn: p.creado_en,
      actualizadoEn: p.actualizado_en,
      asignadoAnual: p.asignado_anual,
      ejecutadoAcumulado: p.ejecutado_acumulado,
      porcentajeEje: p.porcentaje_eje,
      numeroExcel: p.numero_excel,
      asignado: anualDeLaPartida,
      asignadoSumaMeses: totalAsignado,
      ejecutado: totalEjecutado,
      porcentaje: porcentajeReal,
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
    // 📦824 — El total asignado sale de la columna D de cada partida
    // (`p.asignado`), no de la suma de los 12 meses. La curva "programada" de
    // cada mes (`mensualAsignado`) sí sigue viniendo del reparto, porque es lo
    // único que existe mes a mes.
    totalAsignado += p.asignado || 0;
    p.valores.forEach(function (v, idx) {
      mensualAsignado[idx] += v.asignado;
      mensualEjecutado[idx] += v.ejecutado;
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
      // 📦824 — Sin estas columnas, _rowToPresupuesto devolvía ipc/archivo/
      // avisos en undefined: el selector de período no tenía con qué armar la
      // ficha de cada año. Lo detectó test-presupuesto-824-aislamiento.js.
      "  p.archivo_origen, p.archivo_nombre, p.archivo_importado_en, " +
      "  p.total_declarado_asignado, p.total_declarado_ejecutado, p.ipc, p.avisos_importacion, " +
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
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por, " +
      // 📦824 — columnas del 📦824 (rastro del Excel + IPC + avisos). Sin estas,
      // el detalle de un período llegaba a la UI con todo en undefined.
      "archivo_origen, archivo_nombre, archivo_importado_en, " +
      "total_declarado_asignado, total_declarado_ejecutado, ipc, avisos_importacion " +
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
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por, " +
      // 📦824 — columnas del 📦824 (rastro del Excel + IPC + avisos). Sin estas,
      // el detalle de un período llegaba a la UI con todo en undefined.
      "archivo_origen, archivo_nombre, archivo_importado_en, " +
      "total_declarado_asignado, total_declarado_ejecutado, ipc, avisos_importacion " +
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
 * Input: { presupuestoId, nombre?, notas?, ipc? }
 */
function _handlerUpdateMeta(token, presupuestoId, nombre, notas, ipc) {
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
    // 📦824 — El IPC es un DATO DEL PERÍODO, y cambia cada año (el owner lo
    // digita por período: 5,2% en 2026, otro en 2027...). Por eso es editable
    // y NO se aplica automáticamente al total: se guarda tal cual y el total
    // sigue siendo la suma de las partidas. Quien lo pone es el owner.
    if (ipc !== undefined) {
      if (ipc === null || ipc === '') {
        updates.push('ipc = ?');
        values.push(null);
      } else {
        var nIpc = Number(ipc);
        if (isNaN(nIpc)) {
          return _err('INVALID_INPUT', 'El IPC debe ser un número (por ejemplo 0.052 para 5,2%)');
        }
        // Se acepta 5.2 (porcentaje) o 0.052 (fracción): se normaliza a fracción.
        if (nIpc > 1) nIpc = nIpc / 100;
        if (nIpc < 0 || nIpc > 1) {
          return _err('INVALID_INPUT', 'El IPC debe estar entre 0% y 100%');
        }
        updates.push('ipc = ?');
        values.push(nIpc);
      }
    }
    if (updates.length === 0) {
      return _err('INVALID_INPUT', 'Debe pasar al menos nombre, notas o ipc');
    }
    updates.push('actualizado_en = ?');
    values.push(new Date().toISOString());
    values.push(presupuestoId);

    // 📦824 — `.run.apply(null, values)` fallaba con "Illegal invocation" en
    // better-sqlite3 (el motor de producción). Los tests usaban sql.js, donde
    // sí funciona, así que el bug llevaba meses escondido: el IPC nunca se
    // guardaba y el handler devolvía INTERNAL sin que nadie lo notara.
    // Se invoca con el statement como receptor: `stmt.run(...values)`.
    localDb.prepare('UPDATE presupuestos SET ' + updates.join(', ') + ' WHERE id = ?').run(...values);

    // 📦824 — Se devuelve el presupuesto ya actualizado: la UI muestra el IPC
    // guardado sin tener que releer.
    var actualizado = localDb.prepare(
      'SELECT id, anio, nombre, notas, ipc FROM presupuestos WHERE id = ?'
    ).get(presupuestoId);

    return _ok({ presupuestoId: presupuestoId, presupuesto: actualizado });
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
 *
 * 📦824 — plantillaPath (opcional)
 * Si se pasa la ruta de un Excel ACT-FO-043 real, se abre ESE archivo y se
 * escriben los datos encima, en vez de generar uno desde cero. Motivo: el
 * archivo generado desde cero pierde el encabezado del sistema, el código
 * ACT-FO-043, los merges de categoría, el pie de firmas y el formato — es decir,
 * no sirve para entregar a auditoría ni a la ARL.
 *
 * La plantilla también es la base de "duplicar período": se hereda la
 * estructura y se cambian los datos.
 *
 * Sin plantilla, se mantiene el comportamiento original (hoja nueva).
 */
function _buildPresupuestoXLSX(presupuesto, partidas, plantillaPath) {
  return _buildPresupuestoXLSXAsync(presupuesto, partidas, plantillaPath);
}

async function _buildPresupuestoXLSXAsync(presupuesto, partidas, plantillaPath) {
  var ExcelJS = require('exceljs');

  // ── Plantilla? ───────────────────────────────────────────────────────
  //
  // 📦824 — `workbook.xlsx.readFile()` es ASÍNCRONO (devuelve Promise). Sin
  // await, el workbook quedaba vacío, `ws` salía undefined y el export caía
  // al fallback "generar desde cero" — que es justo lo que se quería evitar.
  // El síntoma era silencioso: el archivo salía, pero sin encabezado ni merges.
  var workbook;
  var ws;
  var usandoPlantilla = false;
  if (plantillaPath) {
    try {
      var fsMod = require('fs');
      if (fsMod.existsSync(plantillaPath)) {
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(plantillaPath);
        // La hoja del formato es la que tiene 'PRESUPUESTO' en el nombre;
        // si no existe se usa la primera.
        ws = workbook.worksheets.find(function (s) { return /PRESUP/i.test(s.name); }) || workbook.worksheets[0];
        usandoPlantilla = !!ws;
      } else {
        console.warn('[' + MOD + '][export] La plantilla no existe: ' + plantillaPath + ' — se genera desde cero');
      }
    } catch (e) {
      console.warn('[' + MOD + '][export] No se pudo usar la plantilla "' + plantillaPath + '": ' + e.message + ' — se genera desde cero');
      workbook = null;
      ws = null;
      usandoPlantilla = false;
    }
  }

  if (!usandoPlantilla) {
    workbook = new ExcelJS.Workbook();
    ws = workbook.addWorksheet('Presupuesto ' + presupuesto.anio);
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
  }

  // ── Celdas combinadas: diagnóstico antes de escribir ────────────────
  //
  // 📦824 FIX (bug real, encontrado probando con el Excel de Tempoactiva) —
  // El ACT-FO-043 oficial combina la categoría (col B) con celdas combinadas:
  // `B11:B22` es un solo texto que cubre 12 partidas ("SISTEMA INTEGRAL DE
  // ..."). Cuando la BD tiene OTRA distribución de partidas, escribir sobre una
  // celda esclava no agrega texto: ExcelJS lo guarda en el master del merge.
  //
  // El síntoma era un archivo exportado donde 12 filas mostraban la categoría
  // equivocada y —peor— si la fila TOTAL o la del IPC caía dentro del rango
  // combinado, el valor se perdía porque se escribía dentro del merge.
  //
  // Se deshacen los merges que SE SOLAPAN con el rango donde van los datos y
  // se reconstruyen al final, según los bloques REALES de categoría de la BD.
  var FILA_DATOS_INI = 10;
  var FILA_DATOS_FIN = FILA_DATOS_INI + (partidas.length - 1);
  if (usandoPlantilla && ws.model && ws.model.merges && ws.model.merges.length) {
    var _mergesChocan = [];
    ws.model.merges.forEach(function (m) {
      var mm = String(m).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (!mm) return;
      var _ini = parseInt(mm[2], 10);
      var _fin = parseInt(mm[4], 10);
      if (_fin >= FILA_DATOS_INI && _ini <= FILA_DATOS_FIN) _mergesChocan.push(m);
    });
    _mergesChocan.forEach(function (m) {
      try { ws.unMergeCells(m); } catch (e) { /* ya no era un merge */ }
    });
    if (_mergesChocan.length) {
      console.log('[' + MOD + '][export] Se deshicieron ' + _mergesChocan.length +
        ' combinación(es) de la plantilla que chocaban con los datos: ' + _mergesChocan.join(', '));
    }
  }

  // Datos
  // 📦824 — La categoría (col B) se escribe solo en la primera fila de cada
  // bloque; las demás son celdas esclavas del mismo merge (ver arriba).
  var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var totalAsignado = 0;
  var totalEjecutado = 0;
  var mensualesAsignado = new Array(12).fill(0);
  var mensualesEjecutado = new Array(12).fill(0);
  var categoriaPrevia = null;

  partidas.forEach(function (p, idx) {
    var rowIdx = FILA_DATOS_INI + idx;
    var row = ws.getRow(rowIdx);
    row.getCell(1).value = p.numero;  // A: ID
    row.getCell(3).value = p.concepto;  // C: Detalle
    row.getCell(4).value = p.asignado || 0;  // D: Asignación
    row.getCell(5).value = p.ejecutado || 0;  // E: Ejecutado
    var pct = (p.asignado > 0) ? ((p.ejecutado || 0) / p.asignado * 100) : 0;
    row.getCell(6).value = pct.toFixed(2) + '%';  // F: %

    // Columnas G-R = ENE..DIC = "EJECUCION PRESUPUESTAL" del ACT-FO-043, que es
    // la EJECUCIÓN MES A MES, no el asignado.
    //
    // 📦824 BUG: la v1 escribía `v.asignado` en esas columnas. O sea que el
    // archivo exportado mostraba el presupuesto planeado donde debía ir lo
    // gastado — por eso todo salía en 0% de ejecución frente a lo que la app sí
    // tenía. Ahora va el ejecutado del mes.
    if (p.valores) {
      p.valores.forEach(function (v, mIdx) {
        row.getCell(7 + mIdx).value = v.ejecutado || 0;
        mensualesEjecutado[mIdx] += v.ejecutado || 0;
      });
    }

    // 📦824 — Categoría (col B). Se escribe en TODA fila que abre un bloque;
    // los merges del rango de datos ya se deshicieron arriba, así que escribir
    // aquí nunca cae en una celda esclava.
    if (usandoPlantilla) {
      if (p.descripcion && p.descripcion !== categoriaPrevia) {
        row.getCell(2).value = p.descripcion;
        categoriaPrevia = p.descripcion;
      }
      if (p.numeroExcel) row.getCell(1).value = p.numeroExcel;
    }

    totalAsignado += p.asignado || 0;
    totalEjecutado += p.ejecutado || 0;
  });

  // 📦824 — Reconstruir las combinaciones de la columna B según los bloques
  // REALES de categoría de la BD, para que el archivo siga con el formato
  // oficial (una categoría combinada por bloque) y no con 12 filas repitiendo
  // el mismo texto.
  if (usandoPlantilla) {
    var _catActual = null, _iniCat = null, _finCat = null;
    partidas.forEach(function (p, idx) {
      var f = FILA_DATOS_INI + idx;
      if (p.descripcion !== _catActual) {
        if (_catActual && _finCat > _iniCat) {
          try { ws.mergeCells('B' + _iniCat + ':B' + _finCat); } catch (e) { }
        }
        _catActual = p.descripcion; _iniCat = f; _finCat = f;
      } else {
        _finCat = f;
      }
    });
    if (_catActual && _finCat > _iniCat) {
      try { ws.mergeCells('B' + _iniCat + ':B' + _finCat); } catch (e) { }
    }
  }

  // Fila TOTAL AÑO
  //
  // 📦824 — Esta fila se escribe con la SUMA REAL de las partidas, no con lo que
  // declaraba el Excel original. El 2026 de Tempoactiva venía con la fórmula
  // mal (contaba cada partida dos veces: declaraba 55.638.568 frente a una suma
  // de 27.819.284) y también mal en la ejecución. Al exportar se corrige.
  var totalRowIdx = FILA_DATOS_INI + partidas.length;
  var totalRow = ws.getRow(totalRowIdx);
  totalRow.getCell(1).value = 'TOTAL AÑO';
  totalRow.getCell(3).value = 'TOTAL AÑO';
  totalRow.getCell(4).value = totalAsignado;
  totalRow.getCell(5).value = totalEjecutado;
  var totalPct = totalAsignado > 0 ? (totalEjecutado / totalAsignado * 100) : 0;
  totalRow.getCell(6).value = totalPct.toFixed(2) + '%';
  for (var m = 0; m < 12; m++) {
    // Columnas de ejecución (G-R), igual que las filas de detalle.
    totalRow.getCell(7 + m).value = mensualesEjecutado[m];
  }

  // 📦824 — Fila IPC, si el período lo tiene definido. El IPC es un dato
  // editable por año (cambia cada año y lo digita el owner), así que se
  // escribe con su valor real y solo si existe.
  //
  // ⚠️ Solo si la fila NO está dentro de un merge. La plantilla oficial usa
  // celdas combinadas para las categorías (B11:B22 cubre 12 partidas). Si el
  // presupuesto tiene MENOS partidas que la plantilla, la fila del IPC cae
  // dentro de ese rango, y escribir ahí no agrega una fila: sobrescribe el
  // valor de la categoría (ExcelJS lo guarda en la celda master del merge).
  // En ese caso se salta y el IPC sigue disponible en la BD.
  if (presupuesto.ipc !== null && presupuesto.ipc !== undefined) {
    var ipcRowIdx = totalRowIdx + 1;
    var ipcCellB = ws.getRow(ipcRowIdx).getCell(2);
    if (ipcCellB.isMerged) {
      console.warn('[' + MOD + '][export] Fila ' + ipcRowIdx + ' cae dentro de una celda combinada de la plantilla; ' +
        'se omite la fila IPC en el archivo (el valor queda en la BD)');
    } else {
      var ipcRow = ws.getRow(ipcRowIdx);
      ipcRow.getCell(2).value = 'IPC';
      ipcRow.getCell(3).value = (Number(presupuesto.ipc) * 100).toFixed(1).replace('.', ',') + '%';
      ipcRow.getCell(4).value = totalAsignado * (1 + Number(presupuesto.ipc));
      ipcRow.getCell(5).value = totalEjecutado * (1 + Number(presupuesto.ipc));
    }
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
async function _handlerExportExcel(token, presupuestoId, outputPath, plantillaPath) {
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
      "SELECT id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por, " +
      // 📦824 — columnas del 📦824 (rastro del Excel + IPC + avisos). Sin estas,
      // el detalle de un período llegaba a la UI con todo en undefined.
      "archivo_origen, archivo_nombre, archivo_importado_en, " +
      "total_declarado_asignado, total_declarado_ejecutado, ipc, avisos_importacion " +
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
      // 📦824 — se leen los valores del archivo para escribir el anual y el
      // acumulado tal como venían, no solo lo que se calcula sumando meses.
      asignadoAnual: p.asignado_anual,
      ejecutadoAcumulado: p.ejecutado_acumulado,
      porcentajeEje: p.porcentaje_eje,
      numeroExcel: p.numero_excel,
      asignado: totalAsig,
      ejecutado: totalEjec,
      porcentaje: totalAsig > 0 ? (totalEjec / totalAsig * 100) : 0,
      valores: valoresFull
    };
  });

  // 3. Generar el .xlsx (writeBuffer es async)
  var buffer;
  try {
    // 📦824 — Si se pasa plantilla, se escribe ENCIMA del archivo oficial en vez
    // de generar uno pelado (que pierdo el encabezado del sistema, los merges de
    // categoría y el pie de firmas).
    buffer = await _buildPresupuestoXLSX(presupuesto, partidas, plantillaPath);
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

    // 📦824 — Se preserva el EJECUTADO de lo que ya está en la BD.
    //
    // BUG ORIGINAL (grave, pérdida de dato confirmada por diseño): este
    // handler borraba TODAS las partidas y las reinsertaba con `ejecutado = 0`
    // hardcodeado. Cada guardado de la UI ponía la ejecución real en cero —
    // por eso las 168 filas de la base de Tempoactiva están todas en 0, siendo
    // que el Excel de origen declara una ejecución de más de veinte millones.
    // (La cifra exacta se reporta en el aviso de import; no se escribe acá
    // porque el Excel lo edita el cliente y ese número ya quedó viejo dos
    // veces. Ver PROMPT.md 7.5.)
    //
    // La UI nunca manda el ejecutado (viene de una tabla read-only), así que no
    // puede venir en `row`. La solución NO es confiar en la UI: es leer el valor
    // real de la BD antes de borrar y restaurarlo por (numero, mes).
    var ejecutadoPrevio = {};
    try {
      var rowsPrevios = localDb.prepare(
        "SELECT p.numero AS numero, v.mes AS mes, v.ejecutado AS ejecutado " +
        "FROM presupuesto_valores_mensuales v " +
        "JOIN presupuesto_partidas p ON p.id = v.partida_id " +
        "WHERE p.presupuesto_id = ?"
      ).all(presupuestoId);
      for (var ep = 0; ep < rowsPrevios.length; ep++) {
        ejecutadoPrevio[rowsPrevios[ep].numero + ':' + rowsPrevios[ep].mes] = rowsPrevios[ep].ejecutado || 0;
      }
    } catch (epErr) {
      console.warn('[' + MOD + '][bulk-save] no se pudo leer el ejecutado previo: ' + epErr.message);
    }

    // 📦824 FIX (pérdida de dato confirmada en producción) — Lo mismo con el
    // resto de campos que la UI NO viaja a través de la grilla: la categoría
    // (col B del Excel), el número de bloque del Excel y los agregados.
    //
    // El bug: la "preservación" de `descripcion` consultaba
    // `presupuesto_partidas` DESPUÉS del DELETE de dos líneas más abajo, o sea
    // sobre una tabla ya vacía → siempre daba NULL. Resultado real medido: el
    // 2026 de Tempoactiva quedó con 0 de 14 categorías, y los agregados en NULL,
    // que es lo que hacía que las tarjetas no cuadraran.
    //
    // El arreglo: leer el estado COMPLETO de las partidas ANTES de borrar y
    // usarlo como respaldo. Así un guardado solo puede cambiar lo que la UI
    // realmente cambió.
    var partidasPrevias = {};
    try {
      var pPrevias = localDb.prepare(
        "SELECT numero, descripcion, numero_excel, asignado_anual " +
        "FROM presupuesto_partidas WHERE presupuesto_id = ?"
      ).all(presupuestoId);
      for (var pp = 0; pp < pPrevias.length; pp++) {
        partidasPrevias[pPrevias[pp].numero] = pPrevias[pp];
      }
    } catch (ppErr) {
      console.warn('[' + MOD + '][bulk-save] no se pudo leer el estado previo de las partidas: ' + ppErr.message);
    }

    // Borrado real (no soft-delete) + borrado explícito de los valores, porque
    // los ON DELETE CASCADE declarados en el schema solo funcionan con
    // PRAGMA foreign_keys=ON (ya activo en main.js desde 📦824, pero no
    // dependemos de eso: borrar explícito es correcto en ambos casos).
    localDb.prepare("DELETE FROM presupuesto_valores_mensuales WHERE partida_id IN (SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ?)").run(presupuestoId);
    localDb.prepare("DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?").run(presupuestoId);

    // Preparar statements
    var stmtInsertPartida = localDb.prepare(
      "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en, asignado_anual, ejecutado_acumulado, porcentaje_eje, numero_excel) " +
      "VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)"
    );
    var stmtInsertValor = localDb.prepare(
      "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
      "VALUES (?, ?, ?, ?, ?, '', ?)"
    );

    var insertedPartidas = 0;
    var insertedValores = 0;
    var ejecutadosRestaurados = 0;
    var COLUMN_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    for (var i = 0; i < partidasInput.length; i++) {
      var row = partidasInput[i];
      var newPartidaId = _newPartidaId();
      var numero = (typeof row.id === 'number') ? row.id : (i + 1);
      var concepto = (typeof row.detalle === 'string') ? row.detalle.trim() : String(row.detalle || '');

      // 📦824 — `descripcion` se conserva si la UI no la manda. El respaldo se
      // lee del SNAPSHOT tomado ANTES del borrado (antes se consultaba la tabla
      // ya vacía y por eso se perdía la categoría de TODAS las partidas).
      var descripcion = null;
      if (typeof row.descripcion === 'string' && row.descripcion.trim() !== '') {
        descripcion = row.descripcion.trim();
      } else if (partidasPrevias[numero] && typeof partidasPrevias[numero].descripcion === 'string' &&
        partidasPrevias[numero].descripcion.trim() !== '') {
        descripcion = partidasPrevias[numero].descripcion.trim();
      }

      // 📦824 FIX — El número de bloque del Excel tampoco viaja por la grilla;
      // sin respaldo se perdía en cada guardado.
      var numeroExcel = (row.numeroExcel || (partidasPrevias[numero] && partidasPrevias[numero].numero_excel)) || null;

      // 📦824 FIX — El anual (columna D del ACT-FO-043) es la verdad del
      // documento y NO se deriva de los meses. Si la UI no lo manda, se toma del
      // snapshot. Antes de esto el import lo repartía entre 12 meses y cualquier
      // hueco en ese reparto se comía el total.
      //
      // ⚠️ Se mira el valor CRUDO antes de convertirlo: `_toNumericValue(undefined)`
      // devuelve 0, no null, y con un `|| null` la fila se ponía en 0 en vez de
      // conservar el anual que ya estaba en la BD.
      var asignadoAnual;
      if (row.asignacion === null || row.asignacion === undefined || row.asignacion === '') {
        var previo = partidasPrevias[numero];
        asignadoAnual = (previo && previo.asignado_anual !== null && previo.asignado_anual !== undefined)
          ? previo.asignado_anual
          : null;
      } else {
        asignadoAnual = _toNumericValue(row.asignacion);
      }

      // 📦824 — se conservan los 3 campos del Excel que la v1 descartaba.
      stmtInsertPartida.run(
        newPartidaId, presupuestoId, numero, concepto, descripcion, now, now,
        asignadoAnual,
        _toNumericValue(row.ejecutado) || null,
        _toNumericValue(row.porcentaje_eje) || null,
        numeroExcel
      );
      insertedPartidas++;

      // 📦824 — Cómo se interpretan las 12 columnas de mes del payload.
      //
      // La grilla las titula como el ACT-FO-043: "EJECUCION PRESUPUESTAL"
      // (fila 8) con el nombre del mes debajo (fila 9). O sea que `row[mes]`
      // es el dinero GASTADO ese mes, no un presupuesto mensual.
      //
      // El ACT-FO-043 NO trae presupuesto por mes: la asignación va solo en la
      // columna D (anual). El `asignado` de cada mes es un reparto derivado
      // (anual/12) que existe únicamente para dibujar la curva "programada" del
      // dashboard, y se vuelve a calcular aquí — no viene de la grilla.
      //
      // El resto del remanente se mete en DICIEMBRE para que la suma de los 12
      // dé EXACTAMENTE el anual: con 2.500.000/12 = 208.333,33 el redondeo en
      // coma flotante dejaba centavos fuera y el total no cuadraba con la
      // columna D.
      //
      // Se redondea a 2 decimales (precisión de la moneda) ANTES de calcular el
      // remanente: sin eso, 10.000.000/12 en coma flotante daba
      // 9.999.999,999999998 en la BD y ninguna suma cuadraba.
      var asignadoMesBase = (asignadoAnual === null) ? 0 : _redondearMoneda(asignadoAnual / 12);
      for (var m = 0; m < 12; m++) {
        var asignadoMes = (m === 11 && asignadoAnual !== null)
          ? _redondearMoneda(asignadoAnual - (asignadoMesBase * 11))
          : asignadoMesBase;

        // El ejecutado puede venir explícito (import) o en la columna del mes.
        var ejecutadoMes = _toNumericValue(row['ejecutado_' + COLUMN_MESES[m]]);
        if (!ejecutadoMes) ejecutadoMes = _toNumericValue(row[COLUMN_MESES[m]]);
        if (!ejecutadoMes) {
          var key = numero + ':' + (m + 1);
          ejecutadoMes = ejecutadoPrevio[key] !== undefined ? ejecutadoPrevio[key] : 0;
          if (ejecutadoMes > 0) ejecutadosRestaurados++;
        }

        stmtInsertValor.run(newPartidaId, pres.anio, m + 1, asignadoMes, ejecutadoMes, now);
        insertedValores++;
      }
    }

    // 📦824 FIX — Agregados por partida.
    //
    // `ejecutado_acumulado` SÍ se recalcula: los 12 meses son DATO REAL del
    // Excel (columnas G-R = "EJECUCION PRESUPUESTAL") y su suma coincide con la
    // columna E del ACT-FO-043.
    //
    // `asignado_anual` NO se recalcula NUNCA. La columna D ("ASIGNACION PRESUPUESTO
    // ANUAL") es la verdad del documento, y los 12 meses de ASIGNADO son un
    // reparto INVENTADO que hace el import (anual/12) porque el formato no trae
    // un asignado por mes. Recalcular el anual sumando ese reparto convierte
    // cualquier hueco en el número oficial: medido en Tempoactiva 2026, la
    // partida "Realización de Capacitaciones" (D = 240.000) quedaba en 220.000
    // porque marzo venía en 0. El anual se preserva arriba (insert + snapshot);
    // el % sí se recalcula porque se deriva de los dos.
    try {
      localDb.prepare(
        "UPDATE presupuesto_partidas SET " +
        "  ejecutado_acumulado = (SELECT COALESCE(SUM(v.ejecutado),0) FROM presupuesto_valores_mensuales v WHERE v.partida_id = presupuesto_partidas.id) " +
        "WHERE presupuesto_id = ?"
      ).run(presupuestoId);
      localDb.prepare(
        "UPDATE presupuesto_partidas SET porcentaje_eje = " +
        "  CASE WHEN asignado_anual > 0 THEN ROUND((ejecutado_acumulado / asignado_anual) * 100, 2) ELSE 0 END " +
        "WHERE presupuesto_id = ?"
      ).run(presupuestoId);
    } catch (aggErr) {
      console.warn('[' + MOD + '][bulk-save] no se pudieron recalcular los agregados: ' + aggErr.message);
    }

    // Actualizar timestamp del presupuesto
    localDb.prepare("UPDATE presupuestos SET actualizado_en = ? WHERE id = ?").run(now, presupuestoId);

    localDb.exec('COMMIT;');

    return _ok({
      inserted: insertedPartidas,
      valores: insertedValores,
      // 📦824 — se reporta cuántos ejecutados se salvaron del borrado, para que
      // el bug sea visible si alguna vez vuelve a pasar.
      ejecutadosRestaurados: ejecutadosRestaurados,
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
 * Redondea a 2 decimales (precisión de la moneda).
 *
 * 📦824 — Repartir un anual entre 12 meses en coma flotable produce valores como
 * 833.333,3333333334. Con eso la suma de los 12 meses daba 9.999.999,999999998
 * y NINGUNA suma del sistema cuadraba con la columna D del ACT-FO-043.
 */
function _redondearMoneda(n) {
  if (n === null || n === undefined || isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Convierte un valor del Excel (string con formato US, número, o vacío) a número.
 * - "$1,234.56" → 1234.56
 * - "" o "-" → 0
 * - null/undefined → 0
 * - número → se devuelve tal cual
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
  var avisos = [];

  // 📦824 — El total que DECLARA el Excel y el factor IPC. Se leen de la fila de
  // cierre ANTES del break, porque ahí están.
  //
  // En el Excel 2026 de Tempoactiva la fila "TOTAL AÑO" declara 55.638.568
  // cuando las 14 partidas suman 27.819.284: el doble exacto. Es un bug de
  // fórmula en el archivo (cuenta cada partida dos veces). Guardamos el valor
  // declarado para REPORTARLO en vez de propagarlo como verdad.
  var totalDeclaradoAsignado = null;
  var totalDeclaradoEjecutado = null;
  var ipc = null;

  // 📦824 — CATEGORÍA (col B) con forward-fill.
  //
  // El Excel usa celdas combinadas para la categoría: B11:B22 es un solo texto
  // "SISTEMA INTEGRAL DE GESTION DE SEGURIDAD..." que cubre 12 partidas. Con
  // sheet_to_json solo la PRIMERA fila de un merge trae el valor y las demás
  // vienen null. Sin propagar, 11 partidas quedan sin categoría — que es
  // justo lo que pasaba: la v1 ponía descripcion='' fijo y se perdían todas.
  var categoriaActual = '';
  var cerrado = false;

  for (var i = 0; i < rawData.length; i++) {
    var row = rawData[i];
    if (!row) continue;

    var firstCell = row[COL.id];
    var secondCell = row[1]; // B — puede tener "TOTAL AÑO" si A-B está merged
    var thirdCell = row[COL.detalle];
    var colB = row[1];

    // 📦824 — La fila IPC va DESPUÉS de la de TOTAL AÑO, así que se revisa
    // primero: se sigue leyendo una fila más (en vez de cortar en seco) para no
    // perder el factor, que es justo lo que explica por qué el total del Excel
    // no cuadra con la suma de las partidas.
    if (typeof colB === 'string' && colB.trim().toUpperCase() === 'IPC') {
      ipc = _toNumericValue(row[2]) || null;
      continue;
    }

    // 📦824 — La fila de cierre se lee, pero NO se corta en seco: la fila IPC
    // viene justo después y es la que explica por qué el total del Excel no
    // cuadra con la suma de las partidas. Se marca `cerrado` y se sigue una fila
    // más; en la siguiente iteración se corta de verdad.
    if ((typeof firstCell === 'string' && firstCell.indexOf('TOTAL AÑO') >= 0) ||
        (typeof secondCell === 'string' && secondCell.indexOf('TOTAL AÑO') >= 0) ||
        (typeof thirdCell === 'string' && thirdCell.indexOf('TOTAL AÑO') >= 0)) {
      totalDeclaradoAsignado = _toNumericValue(row[COL.asignacion]) || null;
      totalDeclaradoEjecutado = _toNumericValue(row[COL.ejecucion]) || null;
      cerrado = true;
      continue;
    }

    // Ya pasamos la fila de cierre y no era la IPC: no hay más partidas.
    if (cerrado) break;

    // Propagar la categoría del merge hacia abajo
    if (typeof colB === 'string' && colB.trim() !== '') {
      categoriaActual = colB.trim();
    }

    // Saltar filas vacías
    var detalle = row[COL.detalle];
    if (!detalle || (typeof detalle === 'string' && detalle.trim() === '')) continue;

    // Parsear valores mensuales.
    // Estructura del Excel:
    //   - Col D (asignacion) = ASIGNADO TOTAL ANUAL (no se desglosa por mes)
    //   - Col E (ejecucion)  = EJECUTADO ACUMULADO a la fecha del archivo
    //   - Cols G-R (meses)   = EJECUTADO MENSUAL (por mes)
    //
    // Para la BD se distribuye el anual en 12 meses (asignado_mes = total/12)
    // para que SUM(asignado) por partida == total anual. Ese valor DERIVADO se
    // compara contra la col D real, que se guarda aparte como asignado_anual.
    var valores = [];
    var asignadoTotal = _toNumericValue(row[COL.asignacion]);
    var ejecutadoAcumulado = _toNumericValue(row[COL.ejecucion]);
    var asignadoPorMes = _redondearMoneda(asignadoTotal / 12);
    var sumaEjecutadoMes = 0;
    for (var m = 0; m < 12; m++) {
      var ejecutadoMes = _toNumericValue(row[COL.meses[m]]);
      sumaEjecutadoMes += ejecutadoMes;
      // 📦824 — El remanente va en DICIEMBRE y se redondea a centavos, para que
      // la suma de los 12 dé EXACTAMENTE la columna D. Sin esto, 240.000/12 en
      // coma flotante dejaba el total anual descuadrado.
      var asignadoMes = (m === 11)
        ? _redondearMoneda(asignadoTotal - (asignadoPorMes * 11))
        : asignadoPorMes;
      valores.push({ mes: m + 1, asignado: asignadoMes, ejecutado: ejecutadoMes });
    }

    // 📦824 — Comprobación: el ejecutado de los 12 meses debería dar el
    // acumulado de la col E. Si no da, el Excel tiene un descuadre y se avisa
    // (no se corrige en silencio: la fuente de verdad es el Excel).
    if (ejecutadoAcumulado > 0 && Math.abs(sumaEjecutadoMes - ejecutadoAcumulado) > 1) {
      avisos.push(
        'Partida "' + String(detalle).trim().slice(0, 40) + '": la suma de los 12 meses (' +
        Math.round(sumaEjecutadoMes).toLocaleString('es-CO') + ') no cuadra con el ejecutado acumulado de la fila (' +
        Math.round(ejecutadoAcumulado).toLocaleString('es-CO') + '). Se guardó la suma de los meses.'
      );
    }

    // 📦824 — La columna N del Excel NO numera partidas: numera BLOQUES de
    // categoría. En el 2026 vale 1 (ASESORIAS SST), 2 (SISTEMA INTEGRAL, que
    // abarca 12 partidas) y 3 (PAPELERIA SG-SST), y viene en celdas combinadas,
    // así que solo la primera fila de cada bloque trae el número.
    //
    // Usar ese valor como `numero` rompía con UNIQUE(presupuesto_id, numero):
    // las 12 filas del bloque 2 caían al mismo número y el import moría con
    // "UNIQUE constraint failed" (lo detectó test-presupuesto-824-real.js).
    // Se separan los dos conceptos: `numero` sigue siendo la posición de la
    // partida (1..N, lo que la UI y el export usan) y el número del Excel se
    // guarda aparte en numero_excel para poder rastrear el bloque al exportar.
    var numeroExcel = _toNumericValue(row[COL.id]);
    var numero = partidas.length + 1;

    partidas.push({
      numero: numero,
      numeroExcel: (numeroExcel > 0) ? Math.round(numeroExcel) : null,
      concepto: typeof detalle === 'string' ? detalle.trim() : String(detalle),
      // 📦824 — la categoría del Excel (col B), no '' fijo como antes.
      descripcion: categoriaActual,
      asignado: asignadoTotal,
      ejecutado: ejecutadoAcumulado,
      porcentaje_eje: _toNumericValue(row[COL.pct]) || null,
      valores: valores
    });
  }

  // 📦824 — Validación cruzada: el TOTAL AÑO declarado vs la suma real.
  //
  // El Excel 2026 de Tempoactiva falla en LAS DOS columnas de esa fila: declara casi el doble
  // de lo que realmente suman sus partidas (hoy ×2 en asignado y ×1,96 en ejecutado).
  //
  // 🐛2026-10-07 — Este comentario antes citaba las cifras exactas (55.638.568 vs 27.819.284,
  // 33.694.321,66 vs 19.696.874,33). Se SACARON a propósito: el Excel lo edita el cliente, y
  // cuando le agregaron septiembre a la fila de honorarios esos numeros quedaron viejos y
  // este comentario paso a describir una realidad que ya no existia — sin que nadie se
  // enterara. Es el mismo error que fazia fallar los tests, documentado en PROMPT.md 7.5:
  // no se citan cifras de un archivo que el usuario edita. El factor exacto se reporta en
  // runtime, en el aviso de import, que sale de los numeros del momento.
  //
  // Las 3 filas con ejecución sí cuadran internamente (la suma de sus 12 meses
  // da exactamente su acumulado), así que el error está en la fila de resumen,
  // no en el detalle.
  //
  // Se usa SIEMPRE la suma de las partidas y se reporta la diferencia. Usar el
  // declarado importaría un presupuesto inflado ~2×.
  var sumaCalculada = partidas.reduce(function (a, p) { return a + (p.asignado || 0); }, 0);
  var sumaEjecCalculada = partidas.reduce(function (a, p) { return a + (p.ejecutado || 0); }, 0);

  if (totalDeclaradoAsignado !== null && partidas.length > 0) {
    var dif = Math.abs(totalDeclaradoAsignado - sumaCalculada);
    if (dif > 1) {
      var factor = sumaCalculada > 0 ? totalDeclaradoAsignado / sumaCalculada : 0;
      avisos.push(
        'La fila "TOTAL AÑO" del Excel declara ' + Math.round(totalDeclaradoAsignado).toLocaleString('es-CO') +
        ' de asignado pero la suma de las ' + partidas.length + ' partidas da ' + Math.round(sumaCalculada).toLocaleString('es-CO') +
        ' (diferencia de ' + Math.round(dif).toLocaleString('es-CO') + ', factor ' + (Math.round(factor * 100) / 100) + '). ' +
        'Se usó la suma de las partidas. Revisar la fórmula de esa fila en el Excel.'
      );
    }
  }

  if (totalDeclaradoEjecutado !== null && sumaEjecCalculada > 0) {
    var difEj = Math.abs(totalDeclaradoEjecutado - sumaEjecCalculada);
    if (difEj > 1) {
      var factorEj = sumaEjecCalculada > 0 ? totalDeclaradoEjecutado / sumaEjecCalculada : 0;
      avisos.push(
        'La fila "TOTAL AÑO" del Excel declara ' + Math.round(totalDeclaradoEjecutado).toLocaleString('es-CO') +
        ' de ejecutado pero las partidas suman ' + Math.round(sumaEjecCalculada).toLocaleString('es-CO') +
        ' (diferencia de ' + Math.round(difEj).toLocaleString('es-CO') + ', factor ' + (Math.round(factorEj * 100) / 100) + '). ' +
        'Se usó la suma de las partidas.'
      );
    }
  }

  return {
    sheetName: sheetName,
    range: correctedRangeStr,
    nombre: 'Presupuesto importado de ' + sheetName.trim(),
    // 📦824 — rastro del archivo + los totales que DECLARA el Excel.
    archivoNombre: filePath ? String(filePath).split(/[\\/]/).pop() : null,
    archivoOrigen: filePath || null,
    totalDeclaradoAsignado: totalDeclaradoAsignado,
    totalDeclaradoEjecutado: totalDeclaradoEjecutado,
    ipc: ipc,
    sumaCalculadaAsignado: sumaCalculada,
    sumaCalculadaEjecutado: sumaEjecCalculada,
    avisos: avisos,
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
    // 📦824 — el dryRun es la vista previa: debe enseñar los mismos avisos que
    // vería el usuario al importar, para decidir antes de escribir en BD.
    return _ok({
      dryRun: true,
      parsed: {
        sheetName: parsed.sheetName,
        range: parsed.range,
        nombre: parsed.nombre,
        archivoNombre: parsed.archivoNombre,
        partidasCount: parsed.partidas.length,
        // 📦824 — los totales van en la vista previa: son justo lo que el
        // usuario necesita comparar contra el Excel antes de importar.
        totalAsignado: parsed.sumaCalculadaAsignado,
        totalDeclarado: parsed.totalDeclaradoAsignado,
        totalDeclaradoEjecutado: parsed.totalDeclaradoEjecutado,
        ipc: parsed.ipc,
        avisos: parsed.avisos || [],
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
        // 5a. Overwrite: borrar partidas + valores explícitamente (los
        // ON DELETE CASCADE del schema solo aplican con foreign_keys=ON) y
        // reusar el mismo id.
        localDb.prepare("DELETE FROM presupuesto_valores_mensuales WHERE partida_id IN (SELECT id FROM presupuesto_partidas WHERE presupuesto_id = ?)").run(existing.id);
        localDb.prepare("DELETE FROM presupuesto_partidas WHERE presupuesto_id = ?").run(existing.id);
        // 📦824 — se actualizan también el rastro del archivo y los totales
        // declarados: un overwrite viene de un Excel nuevo, y dejarlo con los
        // metadatos del anterior haría creer que la fuente no cambió.
        localDb.prepare(
          "UPDATE presupuestos SET actualizado_en = ?, nombre = ?, " +
          "archivo_origen = ?, archivo_nombre = ?, archivo_importado_en = ?, " +
          "total_declarado_asignado = ?, total_declarado_ejecutado = ?, ipc = ?, avisos_importacion = ? " +
          "WHERE id = ?"
        ).run(
          now,
          parsed.nombre || ('Presupuesto ' + companyName + ' ' + anioNum),
          parsed.archivoOrigen,
          parsed.archivoNombre,
          now,
          parsed.totalDeclaradoAsignado,
          parsed.totalDeclaradoEjecutado,
          parsed.ipc,
          parsed.avisos && parsed.avisos.length ? JSON.stringify(parsed.avisos) : null,
          existing.id
        );
        newPresId = existing.id;
        replacedId = existing.id;
      } else {
        // 5b. Crear nuevo
        newPresId = _newPresupuestoId();
        localDb.prepare(
          "INSERT INTO presupuestos (id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por, " +
          "archivo_origen, archivo_nombre, archivo_importado_en, total_declarado_asignado, total_declarado_ejecutado, ipc, avisos_importacion) " +
          "VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          newPresId, company.company_key, anioNum,
          parsed.nombre || ('Presupuesto ' + companyName + ' ' + anioNum),
          now, now, auth.user && auth.user.id ? auth.user.id : null,
          parsed.archivoOrigen, parsed.archivoNombre, now,
          parsed.totalDeclaradoAsignado, parsed.totalDeclaradoEjecutado, parsed.ipc,
          parsed.avisos && parsed.avisos.length ? JSON.stringify(parsed.avisos) : null
        );
      }

      // 6. Insertar partidas + valores
      // 📦824 — descripcion ya no se pisa con '' (era la categoría del Excel,
      // col B, con celdas combinadas), y se guardan los 3 campos que la v1
      // descartaba: asignado_anual, ejecutado_acumulado, porcentaje_eje.
      stmtInsertPartida = localDb.prepare(
        "INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, creado_en, actualizado_en, asignado_anual, ejecutado_acumulado, porcentaje_eje, numero_excel) " +
        "VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)"
      );
      stmtInsertValor = localDb.prepare(
        "INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) " +
        "VALUES (?, ?, ?, ?, ?, '', ?)"
      );

      for (var p = 0; p < parsed.partidas.length; p++) {
        var partidaData = parsed.partidas[p];
        var newPartidaId = _newPartidaId();
        stmtInsertPartida.run(
          newPartidaId, newPresId, partidaData.numero, partidaData.concepto,
          partidaData.descripcion || null, now, now,
          partidaData.asignado !== undefined ? partidaData.asignado : null,
          partidaData.ejecutado !== undefined ? partidaData.ejecutado : null,
          partidaData.porcentaje_eje !== undefined ? partidaData.porcentaje_eje : null,
          partidaData.numeroExcel !== undefined ? partidaData.numeroExcel : null
        );
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

    // 📦824 — Si el Excel venía con inconsistencias, se registra en consola
    // aunque el import sea exitoso: el import NO debe fallar por un descuadre
    // del archivo, pero tampoco debe esconderse en silencio.
    if (parsed.avisos && parsed.avisos.length) {
      console.warn('[' + MOD + '][import-from-excel] ' + parsed.avisos.length + ' aviso(s) del Excel:');
      parsed.avisos.forEach(function (av) { console.warn('  · ' + av); });
    }

    return _ok({
      inserted: insertedPartidas,
      valores: insertedValores,
      presupuestoId: newPresId,
      sheetName: parsed.sheetName,
      range: parsed.range,
      replaced: replacedId,
      // 📦824 — el import responde qué encontró, para que la UI pueda avisar.
      archivoNombre: parsed.archivoNombre,
      totalAsignado: parsed.sumaCalculadaAsignado,
      totalDeclarado: parsed.totalDeclaradoAsignado,
      ipc: parsed.ipc,
      avisos: parsed.avisos || []
    });
  } catch (e) {
    console.error('[' + MOD + '][import-from-excel] DB error:', e.message);
    return _err('INTERNAL', e.message);
  }
}

/**
 * presupuesto:duplicar-periodo
 * 📦824 — Crea un período NUEVO a partir de uno existente, para empezar el
 * siguiente año sin arrancar de cero.
 *
 * Qué copia y qué no (decisión de negocio, no técnica):
 *   - COPIA: la lista de partidas (concepto, categoría, asignado anual).
 *     El Excel ACT-FO-043 tiene una estructura de partidas que se mantiene
 *     año a año; es la "plantilla" y debe conservarse.
 *   - PONE EN CERO: toda la ejecución. Un presupuesto de 2027 no puede
 *     arrancar con lo ejecutado de 2026.
 *   - VACÍO: el IPC. El owner lo digita para el año nuevo (cambia cada año) —
 *     por eso NO se hereda, para que no se le pase por alto.
 *
 * El aislamiento entre períodos es la misma garantía que da
 * test-presupuesto-824-aislamiento.js: tocar el nuevo no puede mover el viejo.
 *
 * Input: { token, presupuestoIdOrigen, anioDestino, nombre? }
 */
function _handlerDuplicarPeriodo(token, presupuestoIdOrigen, anioDestino, nombre) {
  var auth = _checkAuth(token);
  if (!auth.ok) return _err(auth.error.code, auth.error.message);

  var anioNum = parseInt(anioDestino, 10);
  if (!anioNum || anioNum < 2000 || anioNum > 2100) {
    return _err('INVALID_INPUT', 'anioDestino debe ser un año entre 2000 y 2100');
  }

  var localDb = _getDb();
  if (!localDb) return _err('NO_DB', 'BD no disponible');

  try {
    var origen = localDb.prepare('SELECT * FROM presupuestos WHERE id = ?').get(presupuestoIdOrigen);
    if (!origen) return _err('NOT_FOUND', 'El presupuesto origen no existe');

    // El destino no puede pisar un período existente: es la misma protección
    // que evita perder trabajo por un clic en falso.
    var existente = localDb.prepare('SELECT id FROM presupuestos WHERE empresa_id = ? AND anio = ?')
      .get(origen.empresa_id, anioNum);
    if (existente) {
      return _err('ALREADY_EXISTS',
        'Ya existe un presupuesto para ' + origen.anio + ' → ' + anioNum + '. Reimporta ese año o bórralo primero.',
        { existingId: existente.id });
    }

    var partidas = localDb.prepare(
      'SELECT numero, concepto, descripcion, asignado_anual FROM presupuesto_partidas ' +
      'WHERE presupuesto_id = ? AND activo = 1 ORDER BY numero'
    ).all(origen.id);

    if (partidas.length === 0) {
      return _err('EMPTY_SOURCE', 'El presupuesto de ' + origen.anio + ' no tiene partidas para duplicar');
    }

    var now = new Date().toISOString();
    var nuevoId = _newPresupuestoId();
    var nombreFinal = (typeof nombre === 'string' && nombre.trim())
      ? nombre.trim()
      : 'Presupuesto ' + anioNum;

    localDb.exec('BEGIN TRANSACTION;');
    try {
      // La cabecera hereda la procedencia para que se sepa de dónde salió el
      // período nuevo (el Excel del año destino todavía no existe).
      localDb.prepare(
        'INSERT INTO presupuestos (id, empresa_id, anio, nombre, notas, creado_en, actualizado_en, creado_por, ' +
        'archivo_origen, archivo_nombre, avisos_importacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        nuevoId, origen.empresa_id, anioNum, nombreFinal,
        'Duplicado del presupuesto ' + origen.anio,
        now, now, auth.user && auth.user.id ? auth.user.id : null,
        null, null,
        'Creado duplicando el período ' + origen.anio + '. La ejecución quedó en cero.'
      );

      var stmtPartida = localDb.prepare(
        'INSERT INTO presupuesto_partidas (id, presupuesto_id, numero, concepto, descripcion, activo, ' +
        'creado_en, actualizado_en, asignado_anual, ejecutado_acumulado, porcentaje_eje, numero_excel) ' +
        'VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0, 0, ?)'
      );
      var stmtValor = localDb.prepare(
        // 📦824 — OJO con las comillas: en SQLite "" es un IDENTIFICADOR, no un
        // string vacío. Con "" el INSERT moría con "no such column: """ .
        // Un string vacío va con comillas simples ''.
        'INSERT INTO presupuesto_valores_mensuales (partida_id, anio, mes, asignado, ejecutado, notas, actualizado_en) ' +
        'VALUES (?, ?, ?, ?, 0, \'\', ?)'
      );

      var insertadas = 0, valores = 0;
      for (var i = 0; i < partidas.length; i++) {
        var p = partidas[i];
        var pid = _newPartidaId();
        stmtPartida.run(pid, nuevoId, i + 1, p.concepto, p.descripcion, now, now, p.asignado_anual, p.numero_excel);
        insertadas++;
        // 12 meses con el asignado repartido (misma regla que el import) y
        // ejecución en cero: un año nuevo arranca en blanco.
        var anual = Number(p.asignado_anual) || 0;
        for (var m = 1; m <= 12; m++) {
          stmtValor.run(pid, anioNum, m, anual / 12, now);
          valores++;
        }
      }

      localDb.exec('COMMIT;');

      return _ok({
        presupuestoId: nuevoId,
        anio: anioNum,
        anioOrigen: origen.anio,
        nombre: nombreFinal,
        partidas: insertadas,
        valores: valores,
        // Se dice explícitamente qué NO se heredó, para que la UI lo muestre.
        avisos: [
          'La ejecución quedó en cero (es un período nuevo).',
          'El IPC no se heredó: defínelo para ' + anioNum + ' cuando lo confirmes.',
          'El asignado anual se repartió en 12 meses iguales, como en el import.'
        ]
      });
    } catch (e2) {
      localDb.exec('ROLLBACK;');
      throw e2;
    }
  } catch (e) {
    console.error('[' + MOD + '][duplicar-periodo]', e.message);
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
      return _handlerUpdateMeta(p.token || '', p.presupuestoId, p.nombre, p.notas, p.ipc);
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
      // 📦824 — plantillaPath: si viene, se escribe encima del ACT-FO-043 real
      // en vez de generar un archivo pelado que no sirve para entregar.
      return await _handlerExportExcel(p.token || '', p.presupuestoId, p.outputPath, p.plantillaPath);
    } catch (e) {
      console.error('[' + MOD + '][export-excel]', e.message);
      return _err('INTERNAL', e.message);
    }
  });
  ipcMain.handle('presupuesto:export-template', _stub('presupuesto:export-template'));

  // --------- Diagnóstico (Fase 0+, sigue activo) ---------
  // 📦824 — Duplicar período (crear el año siguiente partiendo del actual).
  ipcMain.handle('presupuesto:duplicar-periodo', function (event, payload) {
    try {
      var p = payload || {};
      return _handlerDuplicarPeriodo(p.token || '', p.presupuestoIdOrigen, p.anioDestino, p.nombre);
    } catch (e) {
      console.error('[' + MOD + '][duplicar-periodo]', e.message);
      return _err('INTERNAL', e.message);
    }
  });

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
  // 📦824 — ALTERs de columnas nuevas. Se exportan aparte porque
  // `CREATE TABLE IF NOT EXISTS` no altera tablas ya creadas y un ALTER repetido
  // revienta con "duplicate column name": main.js los aplica uno a uno con
  // try/catch, que es donde el fallo esperado es inocuo.
  SCHEMA_ALTERS: PRESUPUESTO_SCHEMA_ALTERS,
  MIGRATIONS_SQL: PRESUPUESTO_MIGRATIONS_SQL,
  MIGRATION_IDS: PRESUPUESTO_MIGRATION_IDS
};
