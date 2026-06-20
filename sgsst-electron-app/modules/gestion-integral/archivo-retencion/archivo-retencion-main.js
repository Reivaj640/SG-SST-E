/**
 * ============================================================================
 * archivo-retencion-main.js
 * ============================================================================
 * Electron MAIN PROCESS module — Submódulo 2.5.1
 * (Archivo y Retención Documental del SG-SST)
 *
 * Registers IPC handlers under the prefix `archivo-retencion:` for reading,
 * writing, creating, updating, and deleting records in the Excel workbook:
 *   GI-FO-010 LISTADO MAESTRO DE CONTROL DE DOCUMENTOS Y REGISTROS.xlsx
 *
 * Multi-company support: each IPC call receives `companyName` and resolves
 * the Excel file path dynamically via config.json company structure mapping.
 *
 * Usage (in the Electron main process):
 *   const { registerArchivoRetencionHandlers } =
 *     require('./modules/gestion-integral/archivo-retencion/archivo-retencion-main');
 *
 *   app.whenReady().then(() => {
 *     registerArchivoRetencionHandlers(app);
 *   });
 * ============================================================================
 */

const { ipcMain } = require('electron');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the Excel workbook file. */
const EXCEL_FILE_NAME = 'GI-FO-010 LISTADO MAESTRO DE CONTROL DE DOCUMENTOS Y REGISTROS.xlsx';

/** Code used to locate the submodule folder in the company structure. */
const SUBMODULE_CODE = '2.5.1';

/** Name of the primary (writeable) sheet in the workbook. */
const MAIN_SHEET_NAME = 'listado maestro actualizado ';

/** 0-indexed row where data begins in the main sheet (row 7 in Excel UI). */
const MAIN_DATA_START_ROW = 6;

/**
 * Column mapping — main sheet.
 * Columna A (índice 0) se ignora; el 'numero' se auto-genera secuencialmente.
 * Datos leídos de columnas B–M (índices 1–12).
 */
const MAIN_COLUMNS = {
  descripcion: 1,
  codigo: 2,
  revision: 3,
  tipoDoc: 4,
  tipoReg: 5,
  tipoInterno: 6,
  tipoExterno: 7,
  fechaCreacion: 8,
  fechaActualizacion: 9,
  almacenamiento: 10,
  retencion: 11,
  disposicion: 12,
};

/** Fields that carry boolean values (X → true, empty → false). */
const BOOLEAN_FIELDS = ['tipoDoc', 'tipoReg', 'tipoInterno', 'tipoExterno'];

// ---------------------------------------------------------------------------
// Helpers – value conversion
// ---------------------------------------------------------------------------

function aCadena(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value).trim();
}

function aBooleano(value) {
  const str = aCadena(value).toUpperCase();
  return str === 'X';
}

function construirError(code, message) {
  return { success: false, error: { code, message } };
}

function construirExito(data) {
  return { success: true, data };
}

// ---------------------------------------------------------------------------
// Config & Path Resolution
// ---------------------------------------------------------------------------

/**
 * Reads the app config.json and returns the parsed object.
 * @param {Electron.App} appInstance
 * @returns {Promise<object>}
 */
async function leerConfig(appInstance) {
  const configPath = path.join(appInstance.getPath('userData'), 'config.json');
  const raw = await fsp.readFile(configPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Recursive search function to find a folder node by code in the company
 * structure tree.
 * @param {object} node
 * @param {string} code
 * @returns {string|null}
 */
function buscarEnEstructura(node, code) {
  if (node.name) {
    if (
      node.name.startsWith(code + ' ') ||
      node.name.startsWith(code + '.') ||
      node.name === code
    ) {
      return node.path;
    }
  }
  if (node.subdirectories) {
    for (const key in node.subdirectories) {
      const result = buscarEnEstructura(node.subdirectories[key], code);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Resolves the absolute path to the Excel file for a given company.
 *
 * Strategy:
 * 1. Read config.json → companyPaths[companyName].structure.structure
 * 2. Search for folder matching code "2.5.1"
 * 3. Scan that folder for the Excel file
 *
 * @param {Electron.App} appInstance
 * @param {string} companyName
 * @returns {Promise<string>} Absolute path to the .xlsx file
 * @throws {Error} if config, structure, or file not found
 */
async function resolverRutaExcel(appInstance, companyName) {
  const config = await leerConfig(appInstance);

  if (!config.companyPaths || !config.companyPaths[companyName]) {
    const disponibles = config.companyPaths
      ? Object.keys(config.companyPaths).join(', ')
      : '(ninguna)';
    throw Object.assign(
      new Error(`Empresa no configurada: ${companyName}. Disponibles: ${disponibles}`),
      { code: 'COMPANY_NOT_FOUND' }
    );
  }

  const companyStructure = config.companyPaths[companyName].structure?.structure;
  if (!companyStructure) {
    throw Object.assign(
      new Error(`Estructura inválida para la empresa: ${companyName}`),
      { code: 'INVALID_STRUCTURE' }
    );
  }

  // Buscar la carpeta del submódulo 2.5.1
  const folderPath = buscarEnEstructura(companyStructure, SUBMODULE_CODE);
  if (!folderPath) {
    throw Object.assign(
      new Error(`No se encontró la carpeta del submódulo ${SUBMODULE_CODE} para la empresa: ${companyName}`),
      { code: 'SUBMODULE_FOLDER_NOT_FOUND' }
    );
  }

  // Buscar el archivo Excel dentro de esa carpeta
  if (!fs.existsSync(folderPath)) {
    throw Object.assign(
      new Error(`La carpeta del submódulo no existe: ${folderPath}`),
      { code: 'FOLDER_NOT_FOUND' }
    );
  }

  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const excelFile = entries.find(
    (e) =>
      !e.isDirectory() &&
      e.name.toUpperCase().includes('GI-FO-010') &&
      e.name.toUpperCase().includes('LISTADO MAESTRO') &&
      !e.name.startsWith('~$')
  );

  if (!excelFile) {
    // List available files for debugging
    const files = entries.filter((e) => !e.isDirectory() && !e.name.startsWith('~$')).map((e) => e.name);
    throw Object.assign(
      new Error(
        `No se encontró el archivo Excel "${EXCEL_FILE_NAME}" en: ${folderPath}\n` +
        `Archivos disponibles: ${files.join(', ') || '(ninguno)'}`
      ),
      { code: 'EXCEL_FILE_NOT_FOUND' }
    );
  }

  return path.join(folderPath, excelFile.name);
}

// ---------------------------------------------------------------------------
// Helper – leerExcelCompleto(filePath)  —  ExcelJS
// ---------------------------------------------------------------------------

async function leerExcelCompleto(filePath) {
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Archivo no encontrado: ${filePath}`), {
      code: 'FILE_NOT_FOUND',
    });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(MAIN_SHEET_NAME);
  if (!worksheet) {
    throw Object.assign(
      new Error(`Hoja "${MAIN_SHEET_NAME}" no encontrada en el archivo.`),
      { code: 'SHEET_NOT_FOUND' }
    );
  }

  const documentos = [];

  // MAIN_DATA_START_ROW es 0-indexed (6 → fila 7 en Excel UI)
  // ExcelJS usa 1-indexed, así que empezamos en MAIN_DATA_START_ROW + 1
  const startRow1 = MAIN_DATA_START_ROW + 1; // 7

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < startRow1) return;

    // Columnas: A=1 (ignored), B=2 … M=13
    const getVal = (colIdx) => {
      const cell = row.getCell(colIdx);
      if (!cell || cell.value === null || cell.value === undefined) return '';

      // ExcelJS puede devolver objetos { richText }, { formula }, etc.
      if (typeof cell.value === 'object') {
        if (cell.value.richText) {
          return cell.value.richText.map(r => r.text).join('').trim();
        }
        if (cell.value.result !== undefined) return String(cell.value.result).trim();
        if (cell.value.text !== undefined) return String(cell.value.text).trim();
        return String(cell.value).trim();
      }

      // Manejo de fechas
      if (cell.value instanceof Date) {
        const day = String(cell.value.getDate()).padStart(2, '0');
        const month = String(cell.value.getMonth() + 1).padStart(2, '0');
        const year = cell.value.getFullYear();
        return `${day}/${month}/${year}`;
      }

      return String(cell.value).trim();
    };

    const descripcion = getVal(MAIN_COLUMNS.descripcion + 1); // +1 porque ExcelJS es 1-indexed
    if (!descripcion || descripcion.trim() === '') return; // saltar filas vacías

    const doc = {
      numero: documentos.length + 1,
      descripcion: descripcion,
      codigo: getVal(MAIN_COLUMNS.codigo + 1),
      revision: getVal(MAIN_COLUMNS.revision + 1),
      tipoDoc: aBooleano(getVal(MAIN_COLUMNS.tipoDoc + 1)),
      tipoReg: aBooleano(getVal(MAIN_COLUMNS.tipoReg + 1)),
      tipoInterno: aBooleano(getVal(MAIN_COLUMNS.tipoInterno + 1)),
      tipoExterno: aBooleano(getVal(MAIN_COLUMNS.tipoExterno + 1)),
      fechaCreacion: getVal(MAIN_COLUMNS.fechaCreacion + 1),
      fechaActualizacion: getVal(MAIN_COLUMNS.fechaActualizacion + 1),
      almacenamiento: getVal(MAIN_COLUMNS.almacenamiento + 1),
      retencion: getVal(MAIN_COLUMNS.retencion + 1),
      disposicion: getVal(MAIN_COLUMNS.disposicion + 1),
      hojaOrigen: MAIN_SHEET_NAME,
    };

    documentos.push(doc);
  });

  return documentos;
}

// ---------------------------------------------------------------------------
// Helper – escribirExcel(filePath, documentos)  —  ExcelJS
// ---------------------------------------------------------------------------
// Estrategia "capacitaciones-style":
//  1. Lee el workbook con ExcelJS (preserva estilos, merges, fórmulas)
//  2. Detecta filas de estructura (fórmulas, totales) y NO las toca
//  3. Limpia solo las celdas de datos (B-M) en el rango de datos
//  4. Escribe los nuevos valores fila por fila
//  5. writeFile al final
// ---------------------------------------------------------------------------

async function escribirExcel(filePath, documentos) {
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Archivo no encontrado: ${filePath}`), {
      code: 'FILE_NOT_FOUND',
    });
  }

  // Backup antes de cualquier modificación
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak-${timestamp}`;
  fs.copyFileSync(filePath, backupPath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(MAIN_SHEET_NAME);
  if (!worksheet) {
    throw Object.assign(
      new Error(`Hoja "${MAIN_SHEET_NAME}" no encontrada en el archivo.`),
      { code: 'SHEET_NOT_FOUND' }
    );
  }

  // ── Detectar fila de estructura (NO tocar) ────────────────────────────────
  // Buscamos filas que contengan "Total", "SUMA", fórmulas u otros marcadores
  // de estructura que NO deben ser sobrescritos.
  let estructuraStartRow = -1; // 1-indexed: si se encuentra, es el límite

  const lastRow = worksheet.rowCount;
  const dataStartRow1 = MAIN_DATA_START_ROW + 1; // 7 (1-indexed)

  for (let r = dataStartRow1; r <= lastRow; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.cellCount === 0) continue;

    const cellB = row.getCell(2); // columna B = descripción
    const val = cellB && cellB.value ? String(cellB.value).toLowerCase() : '';

    // Marcadores de filas de estructura que NO deben tocarse
    if (
      val.includes('total') ||
      val.includes('suma') ||
      val.includes('resumen') ||
      val.includes('observacion') ||
      val.includes('nota') ||
      val.includes('firma') ||
      val.includes('elaborado') ||
      val.includes('revisado') ||
      val.includes('aprobado')
    ) {
      estructuraStartRow = r;
      break;
    }

    // También detectar fórmulas en la columna B (indica fila calculada)
    if (cellB.value && typeof cellB.value === 'object' && cellB.value.formula) {
      estructuraStartRow = r;
      break;
    }
  }

  // ── Determinar el límite de limpieza ───────────────────────────────────────
  // Si hay estructura, limpiamos hasta ANTES de ella.
  // Si no, limpiamos hasta el final de datos actuales.
  const cleanLimitRow = estructuraStartRow > 0 ? estructuraStartRow - 1 : lastRow;

  // ── Limpiar solo celdas de datos (columnas B=2 … M=13) ────────────────────
  for (let r = dataStartRow1; r <= Math.min(cleanLimitRow, lastRow); r++) {
    const row = worksheet.getRow(r);
    if (!row) continue;
    // Limpiar columnas B(2) a M(13) — columnas A(1) se preserva
    for (let c = 2; c <= 13; c++) {
      const cell = row.getCell(c);
      if (cell) {
        cell.value = null;
      }
    }
  }

  // ── Escribir nuevos datos ─────────────────────────────────────────────────
  // Columnas de datos mapeadas a índices 1-indexed de ExcelJS:
  const COLUMNAS_MAP = [
    { field: 'descripcion',   col: 2  },  // B
    { field: 'codigo',        col: 3  },  // C
    { field: 'revision',      col: 4  },  // D
    { field: 'tipoDoc',       col: 5, boolean: true },  // E
    { field: 'tipoReg',       col: 6, boolean: true },  // F
    { field: 'tipoInterno',   col: 7, boolean: true },  // G
    { field: 'tipoExterno',   col: 8, boolean: true },  // H
    { field: 'fechaCreacion', col: 9  },  // I
    { field: 'fechaActualizacion', col: 10 },  // J
    { field: 'almacenamiento',col: 11 },  // K
    { field: 'retencion',     col: 12 },  // L
    { field: 'disposicion',   col: 13 },  // M
  ];

  for (let i = 0; i < documentos.length; i++) {
    const doc = documentos[i];
    const rowIndex = dataStartRow1 + i;
    const row = worksheet.getRow(rowIndex);

    // Columna A: número secuencial
    row.getCell(1).value = i + 1;

    for (const mapping of COLUMNAS_MAP) {
      let value = doc[mapping.field] ?? '';

      if (mapping.boolean) {
        value = value === true ? 'X' : '';
      }

      row.getCell(mapping.col).value = value;
    }
  }

  // ── Persistir ──────────────────────────────────────────────────────────────
  await workbook.xlsx.writeFile(filePath);

  return documentos.length;
}

// ---------------------------------------------------------------------------
// Stats para widget del dashboard
// ---------------------------------------------------------------------------

/**
 * Calcula estadísticas del listado maestro para el widget de gestión documental.
 * @param {string} companyName
 * @param {Electron.App} appInstance
 * @returns {Promise<object>}
 */
async function calcularStats(companyName, appInstance) {
  try {
    const filePath = await resolverRutaExcel(appInstance, companyName);
    const documentos = await leerExcelCompleto(filePath);

    if (!documentos || documentos.length === 0) {
      return {
        success: false,
        error: { code: 'SIN_DATOS', message: 'No hay documentos en el listado maestro.' }
      };
    }

    const total = documentos.length;
    const currentYear = new Date().getFullYear();

    // Clasificación por tipo
    let tipoDocCount = 0, tipoRegCount = 0, tipoIntCount = 0, tipoExtCount = 0;

    // Clasificación por disposición
    let vigentesCount = 0, obsoletosCount = 0, muertosCount = 0, naCount = 0;

    // Actualizaciones por año
    const actualizacionesPorAnio = {};

    // Sin actualizar en +2 años
    let sinActualizar2Anios = 0;

    // Distribución por retención
    const distribucionRetencion = {};

    for (const doc of documentos) {
      // Tipos
      if (doc.tipoDoc) tipoDocCount++;
      if (doc.tipoReg) tipoRegCount++;
      if (doc.tipoInterno) tipoIntCount++;
      if (doc.tipoExterno) tipoExtCount++;

      // Disposición
      const disp = (doc.disposicion || '').toLowerCase();
      if (disp === 'obsoleto') obsoletosCount++;
      else if (disp.includes('muerto')) muertosCount++;
      else if (disp === 'n/a' || disp === '') vigentesCount++;
      else vigentesCount++; // otros = vigentes

      // Año de última actualización
      if (doc.fechaActualizacion) {
        const yearMatch = doc.fechaActualizacion.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          actualizacionesPorAnio[year] = (actualizacionesPorAnio[year] || 0) + 1;

          // Sin actualizar en +2 años
          if (year < currentYear - 2) {
            sinActualizar2Anios++;
          }
        } else {
          sinActualizar2Anios++;
        }
      } else {
        sinActualizar2Anios++;
      }

      // Retención
      const ret = doc.retencion || 'No especificado';
      distribucionRetencion[ret] = (distribucionRetencion[ret] || 0) + 1;
    }

    const noVigentes = obsoletosCount + muertosCount;
    const porcentajeVigencia = total > 0 ? Math.round(((total - noVigentes) / total) * 100) : 0;

    // Estado semáforo
    let estado = 'ok';
    if (porcentajeVigencia < 50) estado = 'danger';
    else if (porcentajeVigencia < 80) estado = 'warning';

    return {
      success: true,
      data: {
        total,
        tipoDoc: tipoDocCount,
        tipoReg: tipoRegCount,
        tipoInterno: tipoIntCount,
        tipoExterno: tipoExtCount,
        vigentes: total - noVigentes,
        obsoletos: obsoletosCount,
        muertos: muertosCount,
        noAplica: naCount,
        porcentajeVigencia,
        estado,
        sinActualizar2Anios,
        distribucionRetencion,
        actualizacionesPorAnio,
        ultimoMesRegistrado: currentYear.toString()
      }
    };
  } catch (err) {
    return {
      success: false,
      error: { code: err.code || 'STATS_ERROR', message: err.message }
    };
  }
}

// ---------------------------------------------------------------------------
// IPC Handler Registrations
// ---------------------------------------------------------------------------

/**
 * Handler: archivo-retencion:get-stats
 */
function registrarGetStats(appInstance) {
  ipcMain.handle('archivo-retencion:get-stats', async (_event, companyName) => {
    return calcularStats(companyName, appInstance);
  });
}

/**
 * Handler: archivo-retencion:get-excel-path
 * Returns the resolved Excel file path for a company (diagnostic/helper).
 */
function registrarGetExcelPath(appInstance) {
  ipcMain.handle('archivo-retencion:get-excel-path', async (_event, companyName) => {
    try {
      const filePath = await resolverRutaExcel(appInstance, companyName);
      return construirExito({ path: filePath, companyName });
    } catch (err) {
      return construirError(
        err.code || 'RUTA_ERROR',
        err.message || 'Error al resolver la ruta del archivo Excel.'
      );
    }
  });
}

/**
 * Handler: archivo-retencion:leer-todos
 */
function registrarLeerTodos(appInstance) {
  ipcMain.handle('archivo-retencion:leer-todos', async (_event, companyName) => {
    try {
      const filePath = await resolverRutaExcel(appInstance, companyName);
      const documentos = await leerExcelCompleto(filePath);
      return construirExito(documentos);
    } catch (err) {
      return construirError(
        err.code || 'LECTURA_ERROR',
        err.message || 'Error al leer el archivo Excel.'
      );
    }
  });
}

/**
 * Handler: archivo-retencion:guardar
 */
function registrarGuardar(appInstance) {
  ipcMain.handle('archivo-retencion:guardar', async (_event, companyName, documentos) => {
    try {
      if (!Array.isArray(documentos)) {
        return construirError(
          'DATOS_INVALIDOS',
          'Se esperaba un arreglo de documentos.'
        );
      }

      // Normalizar tipos en todos los documentos (acepta string o booleanos)
      const documentosNormalizados = documentos.map(normalizarTipos);

      const filePath = await resolverRutaExcel(appInstance, companyName);
      const registrosGuardados = await escribirExcel(filePath, documentosNormalizados);
      return construirExito({ registrosGuardados });
    } catch (err) {
      return construirError(
        err.code || 'ESCRITURA_ERROR',
        err.message || 'Error al guardar el archivo Excel.'
      );
    }
  });
}

/**
 * Helper – parsea el campo combinado `tipo` (ej: "Documento, Interno")
 * en los 4 campos booleanos individuales del modelo.
 * Si el documento ya tiene los campos booleanos, los usa directamente.
 *
 * @param {object} doc - Documento entrante
 * @returns {object} - El mismo doc con los campos booleanos establecidos
 */
function normalizarTipos(doc) {
  const result = { ...doc };

  // Si ya viene con campos booleanos individuales, usarlos tal cual
  if ('tipoDoc' in result || 'tipoReg' in result || 'tipoInterno' in result || 'tipoExterno' in result) {
    result.tipoDoc = !!result.tipoDoc;
    result.tipoReg = !!result.tipoReg;
    result.tipoInterno = !!result.tipoInterno;
    result.tipoExterno = !!result.tipoExterno;
    return result;
  }

  // Si viene con campo combinado `tipo` (string), parsearlo
  const tipoStr = (result.tipo || '').toLowerCase();
  result.tipoDoc = tipoStr.includes('documento');
  result.tipoReg = tipoStr.includes('registro');
  result.tipoInterno = tipoStr.includes('interno');
  result.tipoExterno = tipoStr.includes('externo');

  return result;
}

/**
 * Handler: archivo-retencion:crear
 */
function registrarCrear(appInstance) {
  ipcMain.handle('archivo-retencion:crear', async (_event, companyName, nuevoDocumento) => {
    try {
      if (!nuevoDocumento || typeof nuevoDocumento !== 'object') {
        return construirError(
          'DATOS_INVALIDOS',
          'Se esperaba un objeto de documento.'
        );
      }

      const filePath = await resolverRutaExcel(appInstance, companyName);
      const existentes = await leerExcelCompleto(filePath);

      const maxNumero = existentes.reduce((max, doc) => {
        return doc.numero > max ? doc.numero : max;
      }, 0);
      const nuevoNumero = maxNumero + 1;

      // Normalizar tipos (acepta tanto string combinado como booleanos)
      const normalizado = normalizarTipos(nuevoDocumento);

      const documentoCompleto = {
        numero: nuevoNumero,
        descripcion: normalizado.descripcion ?? '',
        codigo: normalizado.codigo ?? '',
        revision: normalizado.revision ?? '',
        tipoDoc: normalizado.tipoDoc,
        tipoReg: normalizado.tipoReg,
        tipoInterno: normalizado.tipoInterno,
        tipoExterno: normalizado.tipoExterno,
        fechaCreacion: normalizado.fechaCreacion ?? '',
        fechaActualizacion: normalizado.fechaActualizacion ?? '',
        almacenamiento: normalizado.almacenamiento ?? '',
        retencion: normalizado.retencion ?? '',
        disposicion: normalizado.disposicion ?? '',
        hojaOrigen: MAIN_SHEET_NAME,
      };

      existentes.push(documentoCompleto);
      await escribirExcel(filePath, existentes);

      return construirExito(documentoCompleto);
    } catch (err) {
      return construirError(
        err.code || 'CREACION_ERROR',
        err.message || 'Error al crear el documento.'
      );
    }
  });
}

/**
 * Handler: archivo-retencion:actualizar
 */
function registrarActualizar(appInstance) {
  ipcMain.handle(
    'archivo-retencion:actualizar',
    async (_event, companyName, cambios) => {
      try {
        if (!cambios || typeof cambios !== 'object' || cambios.numero === undefined) {
          return construirError(
            'DATOS_INVALIDOS',
            'Se esperaba un objeto con la propiedad "numero".'
          );
        }

        const filePath = await resolverRutaExcel(appInstance, companyName);
        const { numero, ...campos } = cambios;
        const existentes = await leerExcelCompleto(filePath);

        const idx = existentes.findIndex((d) => d.numero === numero);
        if (idx === -1) {
          return construirError(
            'NO_ENCONTRADO',
            `No se encontró un documento con numero ${numero}.`
          );
        }

        const camposPermitidos = [
          'descripcion', 'codigo', 'revision',
          'tipoDoc', 'tipoReg', 'tipoInterno', 'tipoExterno',
          'fechaCreacion', 'fechaActualizacion',
          'almacenamiento', 'retencion', 'disposicion',
        ];

        // Si viene `tipo` como string combinado, parsearlo en booleanos
        if ('tipo' in campos) {
          const normalizado = normalizarTipos({ tipo: campos.tipo });
          existentes[idx].tipoDoc = normalizado.tipoDoc;
          existentes[idx].tipoReg = normalizado.tipoReg;
          existentes[idx].tipoInterno = normalizado.tipoInterno;
          existentes[idx].tipoExterno = normalizado.tipoExterno;
        }

        // Aplicar campos individuales permitidos
        for (const campo of camposPermitidos) {
          if (campo in campos) {
            if (BOOLEAN_FIELDS.includes(campo)) {
              existentes[idx][campo] = !!campos[campo];
            } else {
              existentes[idx][campo] = campos[campo] ?? '';
            }
          }
        }

        await escribirExcel(filePath, existentes);

        return construirExito(existentes[idx]);
      } catch (err) {
        return construirError(
          err.code || 'ACTUALIZACION_ERROR',
          err.message || 'Error al actualizar el documento.'
        );
      }
    }
  );
}

/**
 * Handler: archivo-retencion:eliminar
 */
function registrarEliminar(appInstance) {
  ipcMain.handle('archivo-retencion:eliminar', async (_event, companyName, { numero }) => {
    try {
      if (numero === undefined || numero === null) {
        return construirError(
          'DATOS_INVALIDOS',
          'Se esperaba un objeto con la propiedad "numero".'
        );
      }

      const filePath = await resolverRutaExcel(appInstance, companyName);
      const existentes = await leerExcelCompleto(filePath);

      const idx = existentes.findIndex((d) => d.numero === numero);
      if (idx === -1) {
        return construirError(
          'NO_ENCONTRADO',
          `No se encontró un documento con numero ${numero}.`
        );
      }

      existentes.splice(idx, 1);

      // Re-numerar secuencialmente
      existentes.forEach((doc, i) => {
        doc.numero = i + 1;
      });

      await escribirExcel(filePath, existentes);

      return construirExito({ eliminado: true, numero });
    } catch (err) {
      return construirError(
        err.code || 'ELIMINACION_ERROR',
        err.message || 'Error al eliminar el documento.'
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Registers all IPC handlers for the Archivo y Retención Documental module.
 *
 * @param {Electron.App} appInstance - The Electron app instance (needed for
 *   `app.getPath('userData')` to resolve config.json and company paths).
 */
function registerArchivoRetencionHandlers(appInstance) {
  if (!appInstance || typeof appInstance.getPath !== 'function') {
    throw new Error(
      'registerArchivoRetencionHandlers: se requiere una instancia válida de Electron App.'
    );
  }

  registrarGetStats(appInstance);
  registrarGetExcelPath(appInstance);
  registrarLeerTodos(appInstance);
  registrarGuardar(appInstance);
  registrarCrear(appInstance);
  registrarActualizar(appInstance);
  registrarEliminar(appInstance);
}

module.exports = {
  registerArchivoRetencionHandlers,
  leerExcelCompleto,
  escribirExcel,
  calcularStats,
  resolverRutaExcel,
};
