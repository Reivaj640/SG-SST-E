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
const XLSX = require('xlsx');
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

function booleanoACelda(value) {
  return value === true ? 'X' : '';
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
// Helper – leerExcelCompleto(filePath)
// ---------------------------------------------------------------------------

function leerExcelCompleto(filePath) {
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Archivo no encontrado: ${filePath}`), {
      code: 'FILE_NOT_FOUND',
    });
  }

  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const documentos = [];

  // --- Main sheet (única hoja de datos) ---
  const mainSheet = workbook.Sheets[MAIN_SHEET_NAME];
  if (mainSheet) {
    const mainRange = XLSX.utils.decode_range(mainSheet['!ref'] || 'A1');

    for (let r = MAIN_DATA_START_ROW; r <= mainRange.e.r; r++) {
      const row = {};

      for (const [field, colIdx] of Object.entries(MAIN_COLUMNS)) {
        const cellAddress = XLSX.utils.encode_cell({ r, c: colIdx });
        const cell = mainSheet[cellAddress];

        if (BOOLEAN_FIELDS.includes(field)) {
          row[field] = cell ? aBooleano(cell.v) : false;
        } else {
          row[field] = cell ? aCadena(cell.v) : '';
        }
      }

      // Saltar filas vacías
      if (!row.descripcion || row.descripcion.trim() === '') continue;

      // Auto-generar número secuencial (columna A se ignora)
      row.numero = documentos.length + 1;
      row.hojaOrigen = MAIN_SHEET_NAME;
      documentos.push(row);
    }
  }

  return documentos;
}

// ---------------------------------------------------------------------------
// Helper – escribirExcel(filePath, documentos)
// ---------------------------------------------------------------------------

function escribirExcel(filePath, documentos) {
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Archivo no encontrado: ${filePath}`), {
      code: 'FILE_NOT_FOUND',
    });
  }

  // Backup antes de cualquier modificación
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.bak-${timestamp}`;
  fs.copyFileSync(filePath, backupPath);

  // Leer el workbook completo preservando estilos, formatos, merges, etc.
  // cellStyles:true y sheetStubs:true aseguran que XLSX conserve el máximo
  // de metadatos posible al releer el archivo.
  const workbook = XLSX.readFile(filePath, { cellStyles: true, sheetStubs: true });

  const mainSheet = workbook.Sheets[MAIN_SHEET_NAME];
  if (!mainSheet) {
    throw Object.assign(
      new Error(`Hoja "${MAIN_SHEET_NAME}" no encontrada en el archivo.`),
      { code: 'SHEET_NOT_FOUND' }
    );
  }

  // ── Edición QUIRÚRGICA celda por celda ─────────────────────────────────────
  // Solo se tocan las columnas B-M (índices 1-12) en las filas de datos
  // (MAIN_DATA_START_ROW en adelante). Nada fuera de ese rango se modifica.

  // Columnas de datos que se pueden sobrescribir (B=1 … M=12)
  const COLUMNAS_DATOS = [
    'descripcion',        // col B = 1
    'codigo',             // col C = 2
    'revision',           // col D = 3
    'tipoDoc',            // col E = 4  (boolean → 'X' / '')
    'tipoReg',            // col F = 5
    'tipoInterno',        // col G = 6
    'tipoExterno',        // col H = 7
    'fechaCreacion',      // col I = 8
    'fechaActualizacion', // col J = 9
    'almacenamiento',     // col K = 10
    'retencion',          // col L = 11
    'disposicion',        // col M = 12
  ];

  // Determinar el rango actual de la hoja para poder borrarlo/ajustarlo
  const rangoActual = mainSheet['!ref']
    ? XLSX.utils.decode_range(mainSheet['!ref'])
    : { s: { r: 0, c: 0 }, e: { r: MAIN_DATA_START_ROW, c: 12 } };

  // Borrar SOLO las filas de datos anteriores (B-M desde MAIN_DATA_START_ROW)
  // de forma que filas sobrantes (si se eliminaron documentos) queden vacías.
  const filaFinAnterior = rangoActual.e.r;
  for (let r = MAIN_DATA_START_ROW; r <= filaFinAnterior; r++) {
    for (let c = 1; c <= 12; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (mainSheet[addr]) {
        // Conservar el objeto celda pero vaciar su valor
        mainSheet[addr] = { t: 's', v: '', w: '' };
      }
    }
  }

  // Escribir los nuevos valores en las filas de datos
  for (let i = 0; i < documentos.length; i++) {
    const doc = documentos[i];
    const rowIdx = MAIN_DATA_START_ROW + i;

    // Columna A (índice 0): número secuencial — también se actualiza para consistencia
    const addrA = XLSX.utils.encode_cell({ r: rowIdx, c: 0 });
    mainSheet[addrA] = { t: 'n', v: i + 1 };

    for (const field of COLUMNAS_DATOS) {
      const colIdx = MAIN_COLUMNS[field];
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });

      if (BOOLEAN_FIELDS.includes(field)) {
        const val = booleanoACelda(doc[field]);
        mainSheet[addr] = { t: 's', v: val, w: val };
      } else {
        const val = doc[field] ?? '';
        mainSheet[addr] = { t: 's', v: String(val), w: String(val) };
      }
    }
  }

  // Actualizar el rango (!ref) para reflejar las filas escritas
  const nuevaFilaFin = Math.max(
    filaFinAnterior,
    MAIN_DATA_START_ROW + documentos.length - 1
  );
  mainSheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: nuevaFilaFin, c: rangoActual.e.c },
  });

  // Persistir — se usa bookSST:false para no romper cadenas compartidas
  // y cellStyles:true para que XLSX intente conservar los estilos leídos.
  XLSX.writeFile(workbook, filePath, { cellStyles: true, bookSST: false });

  return documentos.length;
}

// ---------------------------------------------------------------------------
// IPC Handler Registrations
// ---------------------------------------------------------------------------

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
      const documentos = leerExcelCompleto(filePath);
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

      const filePath = await resolverRutaExcel(appInstance, companyName);
      const registrosGuardados = escribirExcel(filePath, documentos);
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
      const existentes = leerExcelCompleto(filePath);

      const maxNumero = existentes.reduce((max, doc) => {
        return doc.numero > max ? doc.numero : max;
      }, 0);
      const nuevoNumero = maxNumero + 1;

      const documentoCompleto = {
        numero: nuevoNumero,
        descripcion: nuevoDocumento.descripcion ?? '',
        codigo: nuevoDocumento.codigo ?? '',
        revision: nuevoDocumento.revision ?? '',
        tipoDoc: !!nuevoDocumento.tipoDoc,
        tipoReg: !!nuevoDocumento.tipoReg,
        tipoInterno: !!nuevoDocumento.tipoInterno,
        tipoExterno: !!nuevoDocumento.tipoExterno,
        fechaCreacion: nuevoDocumento.fechaCreacion ?? '',
        fechaActualizacion: nuevoDocumento.fechaActualizacion ?? '',
        almacenamiento: nuevoDocumento.almacenamiento ?? '',
        retencion: nuevoDocumento.retencion ?? '',
        disposicion: nuevoDocumento.disposicion ?? '',
        hojaOrigen: MAIN_SHEET_NAME,
      };

      existentes.push(documentoCompleto);
      escribirExcel(filePath, existentes);

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
        const existentes = leerExcelCompleto(filePath);

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

        for (const campo of camposPermitidos) {
          if (campo in campos) {
            if (BOOLEAN_FIELDS.includes(campo)) {
              existentes[idx][campo] = !!campos[campo];
            } else {
              existentes[idx][campo] = campos[campo] ?? '';
            }
          }
        }

        escribirExcel(filePath, existentes);

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
      const existentes = leerExcelCompleto(filePath);

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

      escribirExcel(filePath, existentes);

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
  resolverRutaExcel,
};
