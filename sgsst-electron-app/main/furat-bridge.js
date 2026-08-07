// =====================================================================
// 📦658 — FURAT (Reportes de Accidentes) — IPC handler
// Bridge entre el renderer (frontend FURAT) y el main process.
// Maneja la subida de archivos FURAT al filesystem + persistencia de
// metadata en la tabla furat_metadata.
//
// Patrón: mismo estilo que excel-bridge.js, email-db.js, etc.
// - Una función registerFuratHandlers(ipcMain, deps)
// - deps: { getDb, findSubmodulePath, file system access }
// =====================================================================

const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
// 📦674 — FIX: importar ipcMain de electron (antes faltaba, por eso
// los handlers 'furat:list-metadata' y 'furat:get-analytics' no se registraban).
// Los otros bridges (gestacion, inspecciones, etc.) SÍ lo importan.
const { ipcMain } = require('electron');

/**
 * Tipos MIME permitidos para subir como FURAT.
 * PDF es el más común (FURAT = Formato Único de Reporte de Accidente de Trabajo).
 * También aceptamos Excel/Word por si la empresa maneja el FURAT en otro formato.
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const ALLOWED_EXTENSIONS = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Extrae un año (4 dígitos, 19xx o 20xx) del nombre del archivo o path.
 * Si no encuentra, devuelve el año actual.
 */
function extractYearFromText(text, fallbackYear) {
  if (!text) return fallbackYear;
  var match = String(text).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? parseInt(match[1], 10) : fallbackYear;
}

/**
 * Sanitiza un nombre de archivo para que sea seguro en el filesystem.
 * - Reemplaza caracteres no permitidos por '_'
 * - Colapsa múltiples '_' consecutivos
 * - Trimea '_' al inicio y al final
 * - Limita longitud a 200 chars
 */
function sanitizeFilename(name) {
  if (!name) return 'FURAT_sin_nombre';
  // Reemplazar separadores de path por si acaso
  var cleaned = String(name).replace(/[\\/]/g, '_');
  // Reemplazar caracteres no permitidos en Windows/macOS/Linux
  cleaned = cleaned.replace(/[<>:"|?*\x00-\x1F]/g, '_');
  // Colapsar '_' repetidos
  cleaned = cleaned.replace(/_{2,}/g, '_');
  // Trim '_' al inicio/final
  cleaned = cleaned.replace(/^_+|_+$/g, '');
  // Truncar
  if (cleaned.length > 200) {
    var ext = path.extname(cleaned);
    var base = path.basename(cleaned, ext).slice(0, 200 - ext.length);
    cleaned = base + ext;
  }
  return cleaned || 'FURAT_sin_nombre';
}

/**
 * Si el archivo destino ya existe, genera un nombre único con sufijo "(1)", "(2)", etc.
 */
async function ensureUniquePath(targetPath) {
  if (!fssync.existsSync(targetPath)) return targetPath;
  var dir = path.dirname(targetPath);
  var ext = path.extname(targetPath);
  var base = path.basename(targetPath, ext);
  for (var i = 1; i < 1000; i++) {
    var candidate = path.join(dir, base + ' (' + i + ')' + ext);
    if (!fssync.existsSync(candidate)) return candidate;
  }
  // Fallback: timestamp
  return path.join(dir, base + '_' + Date.now() + ext);
}

/**
 * Handler principal: sube un archivo FURAT al filesystem y guarda metadata.
 *
 * Request:
 * {
 *   companyName: string,
 *   submodulePath: string,  -- ruta absoluta a la carpeta del submódulo
 *                              (la obtiene el frontend con find-submodule-path)
 *   file: { name, type, size, data (base64) },
 *   metadata: { accidentDate, accidentType, severity, area, description, reportedBy }
 * }
 *
 * Response:
 * { success: true, file: { name, path, year, size } }
 * { success: false, error: { code, message } }
 */
async function uploadFuratFile(params) {
  try {
    // ─── 1. Validar params ───
    if (!params || typeof params !== 'object') {
      return { success: false, error: { code: 'INVALID_PARAMS', message: 'Parámetros inválidos' } };
    }
    var companyName = params.companyName;
    var submodulePath = params.submodulePath;
    var file = params.file;
    var metadata = params.metadata || {};

    if (!companyName) {
      return { success: false, error: { code: 'MISSING_CONTEXT', message: 'Falta companyName' } };
    }
    if (!submodulePath) {
      return { success: false, error: { code: 'MISSING_PATH', message: 'Falta la ruta del submódulo' } };
    }
    if (!file || !file.name || !file.data) {
      return { success: false, error: { code: 'MISSING_FILE', message: 'Falta el archivo' } };
    }

    // ─── 2. Validar que submodulePath existe y es un directorio ───
    try {
      var stat = await fs.stat(submodulePath);
      if (!stat.isDirectory()) {
        return {
          success: false,
          error: { code: 'INVALID_PATH', message: 'La ruta del submódulo no es un directorio' }
        };
      }
    } catch (e) {
      return {
        success: false,
        error: { code: 'PATH_NOT_FOUND', message: 'La ruta del submódulo no existe: ' + submodulePath }
      };
    }

    // ─── 3. Validar tipo ───
    var ext = path.extname(file.name).toLowerCase();
    var typeOk = ALLOWED_EXTENSIONS.includes(ext) ||
                 (file.type && ALLOWED_MIME_TYPES.includes(file.type));
    if (!typeOk) {
      return {
        success: false,
        error: {
          code: 'INVALID_TYPE',
          message: 'Tipo de archivo no permitido. Solo se aceptan PDF, Excel y Word.'
        }
      };
    }

    // ─── 4. Validar tamaño ───
    var declaredSize = file.size || 0;
    if (declaredSize > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'El archivo excede el tamaño máximo permitido (25 MB).'
        }
      };
    }

    // ─── 5. Decodificar base64 a buffer ───
    var base64Data = String(file.data);
    // Limpiar prefijo "data:...;base64," si existe
    var commaIdx = base64Data.indexOf(',');
    if (base64Data.indexOf('base64,') !== -1 && commaIdx !== -1) {
      base64Data = base64Data.substring(commaIdx + 1);
    }
    var buffer;
    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch (e) {
      return {
        success: false,
        error: { code: 'INVALID_BASE64', message: 'El archivo no se pudo decodificar.' }
      };
    }
    var actualSize = buffer.length;
    if (actualSize > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'El archivo decodificado excede el tamaño máximo permitido (25 MB).'
        }
      };
    }

    // ─── 6. Determinar año y carpeta destino ───
    var currentYear = new Date().getFullYear();
    var year = extractYearFromText(file.name, currentYear);
    // Sanity check: si el año extraído es absurdo (ej: 1900 o 2099), usar el actual
    if (year < 2000 || year > currentYear + 1) {
      year = currentYear;
    }
    var yearFolder = path.join(submodulePath, String(year));
    // Crear carpeta del año si no existe
    try {
      await fs.mkdir(yearFolder, { recursive: true });
    } catch (e) {
      return {
        success: false,
        error: { code: 'CANNOT_CREATE_YEAR_FOLDER', message: 'No se pudo crear la carpeta del año: ' + e.message }
      };
    }

    // ─── 7. Nombre final del archivo (sanitizado + único) ───
    var sanitizedName = sanitizeFilename(file.name);
    var finalPath = path.join(yearFolder, sanitizedName);
    finalPath = await ensureUniquePath(finalPath);

    // ─── 8. Escribir archivo a disco ───
    try {
      await fs.writeFile(finalPath, buffer);
    } catch (e) {
      return {
        success: false,
        error: { code: 'WRITE_FAILED', message: 'No se pudo escribir el archivo: ' + e.message }
      };
    }

    // ─── 9. Persistir metadata en furat_metadata ───
    try {
      var { getDb } = require('./db-instance');
      var db = getDb();
      if (!db) {
        // Rollback: borrar archivo
        try { await fs.unlink(finalPath); } catch (e2) { /* ignore */ }
        return { success: false, error: { code: 'DB_NOT_READY', message: 'Base de datos no inicializada' } };
      }
      var now = new Date().toISOString();
      var stmt = db.prepare(`
        INSERT INTO furat_metadata
          (file_path, company_name, accident_date, accident_type, severity, area, description, reported_by, upload_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          accident_date = excluded.accident_date,
          accident_type = excluded.accident_type,
          severity = excluded.severity,
          area = excluded.area,
          description = excluded.description,
          reported_by = excluded.reported_by,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        finalPath,
        companyName,
        metadata.accidentDate || null,
        metadata.accidentType || null,
        metadata.severity || null,
        metadata.area || null,
        metadata.description || null,
        metadata.reportedBy || null,
        now,
        now,
        now
      );
    } catch (e) {
      // Si falla la metadata pero el archivo ya se escribió, hacer rollback
      try { await fs.unlink(finalPath); } catch (e2) { /* ignore */ }
      return {
        success: false,
        error: { code: 'DB_INSERT_FAILED', message: 'No se pudo guardar la metadata: ' + e.message }
      };
    }

    console.log('[FURAT] Archivo subido OK:', finalPath, '(' + actualSize + ' bytes)');

    return {
      success: true,
      file: {
        name: path.basename(finalPath),
        path: finalPath,
        year: year,
        size: actualSize
      }
    };
  } catch (e) {
    console.error('[FURAT] Error en uploadFuratFile:', e);
    return { success: false, error: { code: 'UNEXPECTED', message: e.message } };
  }
}

/**
 * Lista los metadatos de los FURAT de una empresa.
 * Útil para el dashboard analítico (Fase 3).
 */
function listFuratMetadata(companyName) {
  try {
    var { getDb } = require('./db-instance');
    var db = getDb();
    if (!db) return [];
    var rows = db.prepare('SELECT * FROM furat_metadata WHERE company_name = ? ORDER BY accident_date DESC').all(companyName);
    return rows;
  } catch (e) {
    console.error('[FURAT] Error en listFuratMetadata:', e);
    return [];
  }
}

/**
 * 📦659 — Fase 3: Agregaciones analíticas para el dashboard.
 * Devuelve distribuciones por tipo, gravedad, área, y tendencia mensual.
 * Solo cuenta reportes que tienen metadata completa (accident_date + accident_type).
 *
 * @param {string} companyName
 * @returns {Object} {
 *   total: number,                    -- total de FURATs en la empresa
 *   withMetadata: number,             -- cuántos tienen metadata
 *   withoutMetadata: number,          -- cuántos NO tienen metadata (archivos viejos)
 *   byYear: { year: count },          -- distribución por año (basada en accident_date)
 *   byType: { type: count },          -- distribución por tipo
 *   bySeverity: { severity: count },  -- distribución por gravedad
 *   byArea: [{ area, count }],        -- top 10 áreas con más accidentes
 *   monthlyTrend: [{ year, month, count }]  -- tendencia mensual (últimos 12 meses)
 * }
 */
function getFuratAnalytics(companyName) {
  try {
    var { getDb } = require('./db-instance');
    var db = getDb();
    if (!db) {
      return { total: 0, withMetadata: 0, withoutMetadata: 0, byYear: {}, byType: {}, bySeverity: {}, byArea: [], monthlyTrend: [] };
    }

    // 1. Contar total de archivos FURAT en la DB (independiente de metadata)
    // Para el "total" usamos una combinación: archivos en metadata + archivos en filesystem sin metadata.
    // Como no tenemos un listado global de archivos, usamos solo metadata como referencia.
    // (Los archivos sin metadata NO se cuentan en "total" — eso es el report "withoutMetadata"
    // en el dashboard: "X archivos sin metadata, no podemos analizarlos".)
    // Por simplicidad: total = con metadata + sin metadata (que se calcula contra filesystem).
    // Para esta implementación: usamos TODOS los registros de metadata, asumiendo que
    // cada archivo subido tiene metadata. Los archivos viejos del filesystem se
    // cuentan en otra métrica ("legacyFiles") desde el renderer (ya lo hace via getDocumentFolders).
    var allRows = db.prepare('SELECT * FROM furat_metadata WHERE company_name = ?').all(companyName);

    // 2. Filtrar solo los que tienen metadata completa
    var withMeta = allRows.filter(function (r) {
      return r.accident_date && r.accident_type && r.severity;
    });

    // 3. Agregaciones
    var byYear = {};
    var byType = {};
    var bySeverity = {};
    var byAreaMap = {};
    var monthlyMap = {}; // key = "YYYY-MM" → count

    withMeta.forEach(function (r) {
      // Por año (extraído de accident_date)
      if (r.accident_date) {
        var yearMatch = String(r.accident_date).match(/^(\d{4})/);
        if (yearMatch) {
          var y = yearMatch[1];
          byYear[y] = (byYear[y] || 0) + 1;
        }
        // Por mes (YYYY-MM)
        var monthKey = String(r.accident_date).substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(monthKey)) {
          monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
        }
      }
      // Por tipo
      if (r.accident_type) {
        var t = r.accident_type;
        byType[t] = (byType[t] || 0) + 1;
      }
      // Por gravedad
      if (r.severity) {
        var s = r.severity;
        bySeverity[s] = (bySeverity[s] || 0) + 1;
      }
      // Por área
      if (r.area && r.area.trim()) {
        var a = r.area.trim();
        byAreaMap[a] = (byAreaMap[a] || 0) + 1;
      }
    });

    // 4. Top 10 áreas (ordenadas desc)
    var byArea = Object.keys(byAreaMap)
      .map(function (area) { return { area: area, count: byAreaMap[area] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 10);

    // 5. Tendencia mensual: últimos 12 meses (rellenar ceros para meses sin datos)
    var monthlyTrend = [];
    var now = new Date();
    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      monthlyTrend.push({
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: monthNames[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2),
        key: key,
        count: monthlyMap[key] || 0
      });
    }

    return {
      total: allRows.length,        // reportes con metadata en DB
      withMetadata: withMeta.length,
      byYear: byYear,
      byType: byType,
      bySeverity: bySeverity,
      byArea: byArea,
      monthlyTrend: monthlyTrend
    };
  } catch (e) {
    console.error('[FURAT] Error en getFuratAnalytics:', e);
    return { total: 0, withMetadata: 0, byYear: {}, byType: {}, bySeverity: {}, byArea: [], monthlyTrend: [] };
  }
}

/**
 * Registra los IPC handlers del FURAT.
 * Llamar desde main.js después de initDbOnce().
 *
 * 📦675 — FIX: usa el `ipcMain` IMPORTADO de electron (línea 18), NO el
 * argumento `app` que se pasa desde main.js. Mismo patrón que sync-bridge.js
 * y los demás bridges — `app` no tiene `.handle()`, solo `ipcMain`.
 */
function registerFuratHandlers(appOrIpcMain, deps) {
  // Ignoramos el primer argumento (main.js pasa `app` que no tiene .handle).
  // Usamos el `ipcMain` importado arriba (línea 18).
  ipcMain.handle('furat:upload-file', async (event, params) => {
    return await uploadFuratFile(params);
  });
  ipcMain.handle('furat:list-metadata', async (event, companyName) => {
    return { success: true, metadata: listFuratMetadata(companyName) };
  });
  ipcMain.handle('furat:get-analytics', async (event, companyName) => {
    return { success: true, analytics: getFuratAnalytics(companyName) };
  });
  // 📦680 — Crear nueva carpeta (período) en el filesystem de la empresa.
  ipcMain.handle('furat:create-folder', async (event, params) => {
    return await createFuratFolder(params);
  });
  // 📦692 — Eliminar carpeta (con todo su contenido) y limpiar metadata.
  ipcMain.handle('furat:delete-folder', async (event, params) => {
    return await deleteFuratFolder(params);
  });
  // 📦693 — Upsert metadata (crear o actualizar) para un archivo PDF.
  // Usado para editar manualmente la metadata de PDFs viejos que no tienen.
  ipcMain.handle('furat:upsert-metadata', async (event, params) => {
    return await upsertFuratMetadata(params);
  });
  // 📦693 — Obtener metadata de un solo archivo (para pre-llenar el modal de edición).
  ipcMain.handle('furat:get-metadata-for-file', async (event, filePath) => {
    return { success: true, metadata: getFuratMetadataForFile(filePath) };
  });
  console.log('[K+AIRSST][FURAT][IPC][REGISTER][SUCCESS] handlers=7 (upload-file, list-metadata, get-analytics, create-folder, delete-folder, upsert-metadata, get-metadata-for-file)');
}

/**
 * 📦680 — Crea una nueva carpeta (período) en el filesystem de la empresa.
 * Valida el nombre (solo letras, números, guiones, guiones bajos, espacios).
 * Si la carpeta ya existe, retorna error.
 *
 * Params:
 *   - submodulePath: string (ruta absoluta al submódulo 3.2.1, igual que uploadFuratFile)
 *   - folderName: string (nombre de la carpeta a crear)
 */
async function createFuratFolder(params) {
  try {
    var submodulePath = params && params.submodulePath;
    var folderName = params && params.folderName;
    if (!submodulePath) {
      return { success: false, error: { code: 'NO_SUBMODULE', message: 'Falta submodulePath' } };
    }
    if (!folderName) {
      return { success: false, error: { code: 'MISSING_NAME', message: 'Falta el nombre de la carpeta' } };
    }
    // Validar nombre
    var cleanName = String(folderName).trim();
    if (!/^[\p{L}\p{N}_\-\s]{1,100}$/u.test(cleanName)) {
      return { success: false, error: { code: 'INVALID_NAME', message: 'El nombre solo puede tener letras, números, guiones, guiones bajos y espacios (máx 100)' } };
    }
    var sanitized = cleanName.replace(/\s+/g, ' ').trim();
    var folderPath = path.join(submodulePath, sanitized);
    // Verificar que no exista
    if (fssync.existsSync(folderPath)) {
      return { success: false, error: { code: 'ALREADY_EXISTS', message: 'Ya existe una carpeta con ese nombre' } };
    }
    // Verificar que el submodulePath existe
    if (!fssync.existsSync(submodulePath)) {
      return { success: false, error: { code: 'SUBMODULE_NOT_FOUND', message: 'La ruta del submódulo no existe' } };
    }
    // Crear carpeta
    await fs.mkdir(folderPath, { recursive: false });
    console.log('[FURAT] Carpeta creada:', folderPath);
    return { success: true, folder: { name: sanitized, path: folderPath } };
  } catch (e) {
    console.error('[FURAT] Error en createFuratFolder:', e);
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
}

/**
 * 📦692 — Elimina una carpeta (y todo su contenido) del filesystem de la empresa.
 * También limpia la metadata de la DB (furat_metadata) para los archivos que
 * estaban dentro de esa carpeta.
 *
 * @param {Object} params
 * @param {string} params.folderPath - Ruta absoluta de la carpeta a eliminar
 * @param {string} params.companyName - Nombre de la empresa (para limpiar metadata)
 * @returns {Promise<{success: boolean, error?: Object, deletedFiles?: number}>}
 */
async function deleteFuratFolder(params) {
  try {
    var folderPath = params && params.folderPath;
    var companyName = params && params.companyName;
    if (!folderPath) {
      return { success: false, error: { code: 'NO_PATH', message: 'Falta folderPath' } };
    }
    if (!companyName) {
      return { success: false, error: { code: 'NO_COMPANY', message: 'Falta companyName' } };
    }

    // 1. Verificar que la carpeta existe
    if (!fssync.existsSync(folderPath)) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'La carpeta no existe: ' + folderPath } };
    }
    var stat = fssync.statSync(folderPath);
    if (!stat.isDirectory()) {
      return { success: false, error: { code: 'NOT_A_FOLDER', message: 'La ruta no es una carpeta' } };
    }

    // 2. SEGURIDAD: verificar que la carpeta está DENTRO del submódulo 3.2.1
    // Usamos una heurística simple: el path debe contener el código "3.2.1"
    // (si la ruta no contiene el código del submódulo, no la borramos).
    // Esto protege contra paths arbitrarios como C:\Windows\System32.
    var submoduleCode = '3.2.1';
    if (folderPath.indexOf(submoduleCode) === -1) {
      return { success: false, error: { code: 'OUT_OF_SCOPE', message: 'La carpeta no pertenece al submódulo 3.2.1' } };
    }

    // 3. Limpiar metadata de la DB para los archivos de esta carpeta
    var db = (function () {
      try { return require('./db-instance').getDb(); } catch (e) { return null; }
    })();
    var deletedMeta = 0;
    if (db) {
      try {
        // Normalizar separadores para la query
        var normalizedPath = folderPath.replace(/\\/g, '\\\\');
        var result = db.prepare('DELETE FROM furat_metadata WHERE company_name = ? AND file_path LIKE ?')
          .run(companyName, normalizedPath + '%');
        deletedMeta = result.changes || 0;
        console.log('[FURAT] Metadata eliminada: ' + deletedMeta + ' registros para ' + folderPath);
      } catch (dbErr) {
        console.warn('[FURAT] Error limpiando metadata (continúa con filesystem):', dbErr.message);
      }
    }

    // 4. Eliminar carpeta recursivamente
    // force: true para evitar error si la carpeta tiene subcarpetas vacías con permisos raros
    await fs.rm(folderPath, { recursive: true, force: true });
    console.log('[FURAT] Carpeta eliminada: ' + folderPath);

    return { success: true, deletedMetadataRecords: deletedMeta };
  } catch (e) {
    console.error('[FURAT] Error en deleteFuratFolder:', e);
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
}

/**
 * 📦693 — Crea o actualiza la metadata de un archivo PDF.
 * Usa INSERT OR REPLACE (file_path es UNIQUE) para hacer upsert.
 * Si el registro no existe, lo crea. Si ya existe, lo actualiza.
 *
 * @param {Object} params
 * @param {string} params.filePath - Ruta absoluta del archivo
 * @param {string} params.companyName - Nombre de la empresa
 * @param {string} [params.accidentDate] - Fecha del accidente (ISO YYYY-MM-DD)
 * @param {string} [params.accidentType] - caida|golpe|atrapamiento|corte|quemadura|esfuerzo|exposicion|otro
 * @param {string} [params.severity] - leve|moderado|grave|mortal
 * @param {string} [params.area] - Área donde ocurrió
 * @param {string} [params.description] - Descripción breve
 * @param {string} [params.reportedBy] - Nombre de quien reportó
 * @returns {Promise<{success: boolean, error?: Object}>}
 */
async function upsertFuratMetadata(params) {
  try {
    if (!params || !params.filePath || !params.companyName) {
      return { success: false, error: { code: 'MISSING_PARAMS', message: 'Falta filePath o companyName' } };
    }
    var db = (function () {
      try { return require('./db-instance').getDb(); } catch (e) { return null; }
    })();
    if (!db) {
      return { success: false, error: { code: 'NO_DB', message: 'No hay conexión a la DB' } };
    }

    var now = new Date().toISOString();
    var stmt = db.prepare(`
      INSERT INTO furat_metadata
        (file_path, company_name, accident_date, accident_type, severity, area, description, reported_by, upload_date, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        accident_date = excluded.accident_date,
        accident_type = excluded.accident_type,
        severity = excluded.severity,
        area = excluded.area,
        description = excluded.description,
        reported_by = excluded.reported_by,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      params.filePath,
      params.companyName,
      params.accidentDate || null,
      params.accidentType || null,
      params.severity || null,
      params.area || null,
      params.description || null,
      params.reportedBy || null,
      now,
      now,
      now
    );
    console.log('[FURAT] Metadata upserted:', params.filePath);
    return { success: true };
  } catch (e) {
    console.error('[FURAT] Error en upsertFuratMetadata:', e);
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
}

/**
 * 📦693 — Obtiene la metadata de un solo archivo por file_path.
 * Devuelve null si no existe metadata para ese archivo.
 */
function getFuratMetadataForFile(filePath) {
  try {
    if (!filePath) return null;
    var db = (function () {
      try { return require('./db-instance').getDb(); } catch (e) { return null; }
    })();
    if (!db) return null;
    var row = db.prepare('SELECT * FROM furat_metadata WHERE file_path = ?').get(filePath);
    if (!row) return null;
    return {
      filePath: row.file_path,
      companyName: row.company_name,
      accidentDate: row.accident_date,
      accidentType: row.accident_type,
      severity: row.severity,
      area: row.area,
      description: row.description,
      reportedBy: row.reported_by,
      uploadDate: row.upload_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  } catch (e) {
    console.error('[FURAT] Error en getFuratMetadataForFile:', e);
    return null;
  }
}

module.exports = {
  registerFuratHandlers,
  uploadFuratFile,
  listFuratMetadata,
  getFuratAnalytics,
  createFuratFolder,
  deleteFuratFolder,
  upsertFuratMetadata,
  getFuratMetadataForFile,
  // Exportar helpers para tests
  _internal: { extractYearFromText, sanitizeFilename, ensureUniquePath, ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES }
};
