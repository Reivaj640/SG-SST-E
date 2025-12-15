// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const fs = require('fs');           // Para operaciones síncronas
const fsSync = require('fs');       // Para operaciones síncronas
const { exec, spawn, execFile } = require('child_process'); // Asegúrate de incluir execFile
const { promisify } = require('util');
const xlsx = require('xlsx');
const os = require('os');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const ExcelJS = require('exceljs');

// Importar handlers de investigación de accidentes
require('./investigacion_handlers.js');

// Capturar promesas no manejadas globalmente
process.on('unhandledRejection', (reason, promise) => {
  const errorMessage = `
Unhandled Rejection at: Promise ${promise}
Reason: ${reason instanceof Error ? reason.stack : JSON.stringify(reason)}
`;
  console.error(errorMessage);
  log.error(errorMessage); // Loguear a archivo

  // Mostrar un diálogo de error solo si la app ya está lista
  if (app.isReady()) {
    dialog.showErrorBox(
      'Error Inesperado en el Proceso Principal',
      'Ha ocurrido un error no controlado. La aplicación podría estar inestable.\n\n' +
      'Por favor, revise los logs para más detalles.\n\n' +
      `Razón: ${reason instanceof Error ? reason.message : reason}`
    );
  }
});

// --- Configuración del Auto-Updater ---
log.transports.file.level = 'info';
autoUpdater.logger = log;
// ------------------------------------

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// --- Detección robusta de Python ---
let cachedPythonPath = null;

async function findPython() {
    console.log('[DEBUG] Starting Python path search');

    // 1. Buscar en la variable de entorno PATH
    console.log('[DEBUG] Searching for "python.exe" in system PATH');
    try {
        // En Windows, 'where' es el comando para encontrar un ejecutable en el PATH
        const { stdout } = await execPromise('where python');
        const potentialPaths = stdout.split(/\r?\n/).filter(p => p.endsWith('python.exe'));

        for (const p of potentialPaths) {
            const trimmedPath = p.trim();
            if (trimmedPath && fs.existsSync(trimmedPath)) {
                try {
                    console.log(`[DEBUG] Testing Python executable from PATH: ${trimmedPath}`);
                    await execFilePromise(trimmedPath, ['--version']);
                    console.log(`[SUCCESS] Python found in PATH at: ${trimmedPath}`);
                    return trimmedPath;
                } catch (e) {
                    console.warn(`[WARN] Path from PATH found but not executable: ${trimmedPath}. Error: ${e.message}`);
                    continue;
                }
            }
        }
    } catch (e) {
        console.log('[DEBUG] "where python" command failed or returned no results. Will check common paths.');
    }

    // 2. Si no se encuentra en PATH, buscar en rutas comunes (fallback)
    console.log('[DEBUG] Python not found in PATH, checking common installation directories.');
    const username = os.userInfo().username;
    console.log('[DEBUG] Current username:', username);
    const commonPaths = [
        path.join(__dirname, 'Portear', '.venv', 'Scripts', 'python.exe'), // Entorno virtual local
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python312\\python.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python311\\python.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Programs\\Python\\Python310\\python.exe`,
        'C:\\Python312\\python.exe',
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
        'C:\\Program Files\\Python312\\python.exe',
        'C:\\Program Files\\Python311\\python.exe',
        'C:\\Program Files\\Python310\\python.exe',
        `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe`,
        `C:\\Users\\${username}\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe`
    ];

    for (const p of commonPaths) {
        console.log(`[DEBUG] Checking common path: ${p}`);
        if (fs.existsSync(p)) {
            try {
                console.log(`[DEBUG] Testing Python executable: ${p}`);
                await execFilePromise(p, ['--version']);
                console.log(`[SUCCESS] Python found at: ${p}`);
                return p;
            } catch (e) {
                console.warn(`[WARN] Path found but not executable: ${p}. Error: ${e.message}`);
                continue;
            }
        } else {
            console.log(`[DEBUG] Path does not exist: ${p}`);
        }
    }

    throw new Error('No se pudo encontrar un ejecutable de Python válido en el PATH del sistema ni en las rutas conocidas.');
}

async function getPython() {
    console.log('[DEBUG] Current cachedPythonPath:', cachedPythonPath);
    if (cachedPythonPath && fs.existsSync(cachedPythonPath)) {
        console.log('[DEBUG] Using cached Python path:', cachedPythonPath);
        return cachedPythonPath;
    }
    cachedPythonPath = await findPython();
    console.log('[DEBUG] New Python path cached:', cachedPythonPath);
    return cachedPythonPath;
}

let mainWindow;

// --- Función de Logging Centralizada ---
function sendLog(message, level = 'INFO') {
  console.log(`[${level}] ${message}`); // Log to main process console
  if (mainWindow) {
    mainWindow.webContents.send('log-message', message, level);
  }
}

// Ruta del archivo de configuración
const configPath = path.join(app.getPath('userData'), 'config.json');

// Verificar si se está ejecutando con squirrel (instalador de Windows)
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Función para crear la ventana principal
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1024, // Ancho inicial 1200 para mejor visualización
    height: 900, // Alto inicial 900 para mejor visualización
    minWidth: 900,
    minHeight: 800,
    icon: path.join(__dirname, 'assets', 'icons8-adelante-100.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Cargar el archivo HTML principal
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Abrir DevTools en modo desarrollo
  // mainWindow.webContents.openDevTools();
};

// Función para buscar rutas en la estructura mapeada
function searchInStructure(node, searchTerm) {
  // Si el nombre del nodo contiene el término de búsqueda, devolver la ruta
  if (node.name && node.name.includes(searchTerm)) {
    return node.path;
  }

  // Si tiene subdirectorios, buscar recursivamente en ellos
  if (node.subdirectories) {
    for (const key in node.subdirectories) {
      const result = searchInStructure(node.subdirectories[key], searchTerm);
      if (result) {
        return result; // Devolver la primera coincidencia encontrada
      }
    }
  }

  // Si no se encuentra en este nodo ni en sus hijos, devolver null
  return null;
}

// Manejar selección de directorio
ipcMain.handle('select-directory', async () => {
  console.log('Handling select-directory request');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (result.canceled) {
    console.log('Directory selection canceled');
    return null;
  }

  console.log('Selected directory:', result.filePaths[0]);
  return result.filePaths[0];
});

// Manejar diálogo para guardar archivo
ipcMain.handle('save-file-dialog', async (event, options = {}) => {
  console.log('Handling save-file-dialog request');

  const result = await dialog.showSaveDialog({
    title: options.title || 'Guardar archivo',
    defaultPath: options.defaultPath || undefined,
    filters: options.filters || [
      { name: 'Archivos de Excel', extensions: ['xlsx', 'xls'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    console.log('File save dialog canceled');
    return null;
  }

  console.log('Selected file path:', result.filePath);
  return result.filePath;
});

// Manejar guardado de configuración
ipcMain.handle('save-config', async (event, config) => {
  try {
    console.log('Saving config:', config);
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('Config saved successfully');
    return { success: true };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: error.message };
  }
});

// Manejar carga de configuración
ipcMain.handle('load-config', async () => {
  try {
    console.log('Loading config from:', configPath);
    const data = await fsp.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    console.log('Config loaded successfully');
    return config;
  } catch (error) {
    // Si el archivo no existe, devolver objeto vacío
    if (error.code === 'ENOENT') {
      console.log('Config file not found, returning empty object');
      return {};
    }
    console.error('Error loading config:', error);
    return {};
  }
});

// Manejar la obtención de la versión de la aplicación
ipcMain.handle('get-app-version', async () => {
  try {
    console.log('Handling get-app-version request');
    return app.getVersion();
  } catch (error) {
    console.error('Error getting app version:', error);
    return '1.0.0'; // Valor por defecto en caso de error
  }
});

// Manejar lectura de carpetas de documentos (versión corregida y unificada)
ipcMain.handle('get-document-folders', async (event, payload) => {
  const { companyName, moduleName, submoduleName } = payload;
  sendLog(`[MAIN][get-document-folders] Solicitud unificada para: Empresa=${companyName}, Módulo=${moduleName}, Submódulo=${submoduleName}`, 'INFO');

  try {
    // --- 1. Encontrar la ruta del submódulo (lógica de 'find-submodule-path') ---
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    if (!config.companyPaths || !config.companyPaths[companyName]) {
      throw new Error(`No se encontró configuración para la empresa: ${companyName}`);
    }
    const actualCompanyStructure = config.companyPaths[companyName]?.structure?.structure;
    if (!actualCompanyStructure) {
        throw new Error(`La estructura de directorios para la empresa '${companyName}' es inválida o no está mapeada.`);
    }

    const submoduleCodeMatch = submoduleName.match(/^[0-9.]+/);
    if (!submoduleCodeMatch) {
      throw new Error(`Formato de nombre de submódulo inválido: ${submoduleName}`);
    }
    const code = submoduleCodeMatch[0];
    sendLog(`[MAIN][get-document-folders] Código de submódulo extraído: '${code}'`, 'DEBUG');

    let submodulePath = null;
    // Búsqueda específica para módulos que actúan como carpetas contenedoras
    if (moduleName === "Recursos") {
      const resourcesFolderName = "1. Recursos";
      if (actualCompanyStructure.subdirectories && actualCompanyStructure.subdirectories[resourcesFolderName]) {
          const resourcesFolderNode = actualCompanyStructure.subdirectories[resourcesFolderName];
          submodulePath = searchInStructure(resourcesFolderNode, code);
          if(submodulePath) sendLog(`[MAIN][get-document-folders] Ruta encontrada dentro de '${resourcesFolderName}': ${submodulePath}`, 'DEBUG');
      }
    }
    // Fallback: buscar en toda la estructura si no se encontró antes
    if (!submodulePath) {
      submodulePath = searchInStructure(actualCompanyStructure, code);
      if(submodulePath) sendLog(`[MAIN][get-document-folders] Ruta encontrada en la estructura raíz: ${submodulePath}`, 'DEBUG');
    }

    if (!submodulePath) {
      throw new Error(`No se pudo encontrar la ruta para el submódulo '${submoduleName}' en la estructura de la empresa.`);
    }
    sendLog(`[MAIN][get-document-folders] Ruta resuelta: ${submodulePath}`, 'INFO');

    // --- 2. Leer el contenido de la ruta encontrada (lógica de 'get-document-folders' original) ---
    const fullPath = submodulePath; // La ruta del mapeo ya es absoluta

    if (!fs.existsSync(fullPath)) {
      sendLog(`[MAIN][get-document-folders] La ruta resuelta no existe en el sistema de archivos: ${fullPath}`, 'ERROR');
      return { success: false, error: `La ruta no existe: ${fullPath}` };
    }

    const items = await fsp.readdir(fullPath, { withFileTypes: true });
    const result = { success: true, folders: [], files: [], path: fullPath };

    for (const item of items) {
      const itemPath = path.join(fullPath, item.name);
      if (item.isDirectory()) {
        result.folders.push({ name: item.name, path: itemPath });
      } else {
        const stats = await fsp.stat(itemPath);
        result.files.push({
          name: item.name,
          path: itemPath,
          size: stats.size,
          modified: stats.mtime,
          extension: path.extname(item.name).substring(1) // Extensión para el icono en el frontend
        });
      }
    }

    sendLog(`[MAIN][get-document-folders] Encontrados ${result.folders.length} carpetas y ${result.files.length} archivos en ${fullPath}`, 'INFO');
    return result;

  } catch (error) {
    sendLog(`[MAIN][get-document-folders] Error crítico: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejar lectura de datos del archivo de control de remisiones
ipcMain.handle('get-control-remisiones-data', async (event, companyName) => {
  sendLog(`[MAIN] Handler get-control-remisiones-data llamado para empresa: ${companyName}`);

  try {
    // Función auxiliar para búsqueda recursiva
    async function findFileRecursive(dir, fileName) {
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const result = await findFileRecursive(fullPath, fileName);
            if (result) return result;
          } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
            return fullPath;
          }
        }
      } catch (error) {
        sendLog(`[MAIN] Error walking directory ${dir}: ` + error.message, 'WARN');
      }
      return null;
    }

    // Cargar configuración
    sendLog(`[MAIN] Cargando configuración desde: ${configPath}`);
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);
    sendLog(`[MAIN] Configuración cargada.`);

    // Buscar mapeo de empresa - USANDO LA ESTRUCTURA CORRECTA
    let basePath = null;

    if (config.companyPaths && config.companyPaths[companyName]) {
      basePath = config.companyPaths[companyName].root || config.companyPaths[companyName].ruta_base;
      sendLog(`[MAIN] Usando ruta base de config.companyPaths[${companyName}]: ${basePath}`);
    }

    if (!basePath) {
      const availableCompanies = config.companyPaths ? Object.keys(config.companyPaths) : [];
      const error = `No se encontró configuración para la empresa "${companyName}". Empresas configuradas: [${availableCompanies.join(', ')}]`;
      throw new Error(error);
    }

    sendLog(`[MAIN] Ruta base encontrada: ${basePath}`);

    // Verificar que la ruta base exista
    await fsp.access(basePath);
    sendLog(`[MAIN] Ruta base verificada exitosamente`);

    // Buscar archivo recursivamente
    const fileName = 'GI-FO-012 CONTROL DE REMISIONES.xlsx';
    sendLog(`[MAIN] Iniciando búsqueda recursiva de: ${fileName}`);
    const excelFilePath = await findFileRecursive(basePath, fileName);

    if (!excelFilePath) {
      throw new Error(`Archivo "${fileName}" no encontrado para empresa "${companyName}" en la ruta "${basePath}"`);
    }

    sendLog(`[MAIN] Archivo Excel encontrado: ${excelFilePath}`);

    // Leer y procesar Excel
    sendLog(`[MAIN] Leyendo archivo Excel...`);
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Obtener el rango de datos
    const range = xlsx.utils.decode_range(worksheet['!ref']);
    sendLog(`[MAIN] Rango de datos en la hoja: ${worksheet['!ref']}`);

    // Definir el rango para leer desde la fila 7 (índice 6 en base 0)
    const startRow = 6; // Fila 7
    const endRow = range.e.r; // Última fila

    // Crear un nuevo rango que comience desde la fila 7
    const newRange = {
      s: { c: range.s.c, r: startRow }, // Comenzar desde la columna 0, fila 7
      e: { c: range.e.c, r: endRow }    // Terminar en la última columna y fila
    };

    // Convertir el rango a string
    const rangeStr = xlsx.utils.encode_range(newRange);
    sendLog(`[MAIN] Rango para lectura: ${rangeStr}`);

    // Leer los datos desde la fila 7
    const allData = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      range: rangeStr
    });

    sendLog(`[MAIN] Datos extraídos. Total filas: ${allData.length}`);

    if (allData.length < 1) {
        sendLog('[MAIN] Archivo Excel no contiene datos suficientes.', 'WARN');
        return {
            success: true,
            headers: [],
            rows: [],
            message: 'Archivo no contiene filas de datos.',
            filePath: excelFilePath,
            companyName
        };
    }

    // La primera fila ahora será los encabezados (fila 7 del Excel original)
    const headers = allData[0]; // Fila 7 del Excel
    const rows = allData.slice(1); // Filas 8 en adelante del Excel

    sendLog(`[MAIN] Encabezados encontrados: ${headers.length} columnas`);
    sendLog(`[MAIN] Datos de remisiones encontrados. Total filas: ${rows.length}`);

    // Validar y ajustar la longitud de las filas
    const expectedColumns = headers.length;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length < expectedColumns) {
        // Rellenar con cadenas vacías si faltan columnas
        while (rows[i].length < expectedColumns) {
          rows[i].push('');
        }
      } else if (rows[i].length > expectedColumns) {
        // Truncar si hay demasiadas columnas
        rows[i] = rows[i].slice(0, expectedColumns);
      }
    }

    // Log para depuración
    sendLog(`[MAIN] Primeras 3 filas de datos:`, 'DEBUG');
    for(let i = 0; i < Math.min(3, rows.length); i++) {
      sendLog(`[MAIN] Fila ${i+1}: ${JSON.stringify(rows[i])}`, 'DEBUG');
    }

    return {
      success: true,
      headers: headers,
      rows: rows,
      filePath: excelFilePath,
      companyName
    };

  } catch (error) {
    sendLog(`[MAIN] Error crítico en get-control-remisiones-data: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      companyName
    };
  }
});

// Manejar mapeo de directorio
ipcMain.handle('map-directory', async (event, directoryPath) => {
  try {
    console.log('Mapping directory:', directoryPath);
    const pythonPath = await getPython();
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'map_directory.py');

    console.log(`Executing command: ${pythonPath} "${pythonScriptPath}" "${directoryPath}"`);

    const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, directoryPath], { cwd: path.dirname(pythonScriptPath) });

    const structure = JSON.parse(stdout);
    console.log('Directory mapping completed successfully');

    return { success: true, structure: structure, log: stderr || 'Mapeo completado sin errores.' };
  } catch (error) {
    console.error('Error mapping directory:', error);
    throw error;
  }
});

// Manejar lectura de contenido de directorio
ipcMain.handle('read-directory', async (event, directoryPath) => {
  try {
    console.log('Reading directory:', directoryPath);
    const items = await fsp.readdir(directoryPath, { withFileTypes: true });

    const files = [];
    const folders = [];
    for (const item of items) {
      const itemPath = path.join(directoryPath, item.name);
      if (item.isDirectory()) {
          folders.push({
              name: item.name,
              path: itemPath,
          });
      } else {
          const stats = await fsp.stat(itemPath);
          files.push({
            name: item.name,
            path: itemPath,
            size: stats.size,
            modified: stats.mtime,
            extension: path.extname(item.name).substring(1)
          });
      }
    }

    console.log('Directory read successfully');
    return { success: true, files: files, folders: folders }; // Devolver objeto estructurado
  } catch (error) {
    console.error('Error reading directory:', error);
    return { success: false, error: error.message }; // Devolver objeto de error
  }
});

// Manejar apertura de archivo o carpeta
ipcMain.handle('open-path', async (event, pathToOpen) => {
  try {
    console.log('Opening path:', pathToOpen);
    await shell.openPath(pathToOpen);
    console.log('Path opened successfully');
    return { success: true };
  } catch (error) {
    console.error('Error opening path:', error);
    return { success: false, error: error.message };
  }
});

// Manejar lectura de archivo Excel como buffer
ipcMain.handle('read-excel-file', async (event, filePath) => {
  try {
    sendLog(`[MAIN] Leyendo archivo Excel desde: ${filePath}`, 'INFO');

    // Verificar que la ruta del archivo exista
    await fsp.access(filePath);

    // Leer el archivo como un buffer
    const buffer = await fsp.readFile(filePath);

    sendLog(`[MAIN] Archivo leído exitosamente. Tamaño del buffer: ${buffer.length} bytes`, 'INFO');

    return { success: true, data: buffer };
  } catch (error) {
    sendLog(`[MAIN] Error al leer el archivo Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// --- Manejadores para funcionalidad Excel ---

// Handler para obtener las hojas de un archivo de capacitaciones
ipcMain.handle('get-capacitaciones-sheets', async (event, filePath) => {
  try {
    await fsp.access(filePath);
    const workbook = xlsx.readFile(filePath, { bookSheets: true });
    const sheetPattern = /Matriz Cap\.\s*\d{4}/i;
    const relevantSheets = workbook.SheetNames.filter(name => sheetPattern.test(name));
    sendLog(`[MAIN] Hojas encontradas para capacitaciones en ${filePath}: ${relevantSheets.join(', ')}`, 'INFO');
    return { success: true, sheets: relevantSheets };
  } catch (error) {
    sendLog(`[MAIN] Error al leer las hojas del archivo ${filePath}: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para actualizar el archivo de capacitaciones
ipcMain.handle('update-capacitaciones-excel', async (event, { filePath, capacitacionesData, sheetName: requestedSheetName }) => {
  try {
    sendLog(`[MAIN] Actualizando archivo de capacitaciones: ${filePath}`, 'INFO');
    if (requestedSheetName) {
      sendLog(`[MAIN] Hoja de destino explícita: ${requestedSheetName}`, 'INFO');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    let sheetName = requestedSheetName;
    if (!sheetName || !workbook.getWorksheet(sheetName)) {
      if(sheetName) sendLog(`[WARN] La hoja solicitada '${sheetName}' no se encontró para escribir. Buscando una alternativa.`, 'WARN');
      const currentYear = new Date().getFullYear().toString();
      const matrixPatternCurrent = new RegExp(`Matriz Cap\\.\\s*${currentYear}`, 'i');
      sheetName = workbook.worksheets.map(ws => ws.name).find(name => matrixPatternCurrent.test(name));
    }
    if (!sheetName) {
      sheetName = workbook.worksheets[0].name;
    }

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`No se pudo encontrar la hoja de trabajo '${sheetName}' para escribir`);
    }

    const startRow = 7;
    const totalRowCount = worksheet.lastRow ? worksheet.lastRow.number : startRow;

    let endCleanRow = -1;
    for (let i = startRow; i <= totalRowCount; i++) {
        const row = worksheet.getRow(i);
        const cellB = row.getCell(2).value;
        if (cellB && typeof cellB === 'string' && cellB.includes('Total capacitaciones programadas')) {
            endCleanRow = i - 1;
            break;
        }
    }
    if (endCleanRow === -1) {
        endCleanRow = totalRowCount > startRow ? totalRowCount : startRow;
    }

    for (let i = startRow; i <= endCleanRow + 1; i++) { // +1 para limpiar la fila siguiente
        const row = worksheet.getRow(i);
        row.values = [];
    }

    // Escribir nuevos datos
    capacitacionesData.forEach((capacitacion, index) => {
      const rowIndex = startRow + index;
      const row = worksheet.getRow(rowIndex);

      row.getCell(2).value = capacitacion.nombre; // B
      row.getCell(3).value = capacitacion.tipo.toUpperCase(); // C
      row.getCell(4).value = new Date(capacitacion.fechaProgramada); // D
      row.getCell(7).value = capacitacion.instructor; // G
      row.getCell(8).value = parseInt(capacitacion.duracion.replace(' Horas', '')) || 0; // H
      row.getCell(9).value = capacitacion.estado === 'completed' ? 'Ejecutado' : 'Pendiente'; // I

      row.getCell(4).numFmt = 'dd/mm/yyyy';
    });

    await workbook.xlsx.writeFile(filePath);
    sendLog(`[MAIN] Archivo de capacitaciones actualizado en hoja '${sheetName}' exitosamente.`, 'INFO');
    return { success: true };

  } catch (error) {
    sendLog(`[MAIN] Error al actualizar el archivo de capacitaciones: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('init-excel', async (event, { filePath, sheetName: requestedSheetName }) => {
  try {
    sendLog(`[MAIN] Inicializando archivo Excel: ${filePath}`, 'INFO');
    if (requestedSheetName) {
      sendLog(`[MAIN] Hoja solicitada explícitamente: ${requestedSheetName}`, 'INFO');
    }

    await fsp.access(filePath);
    const workbook = xlsx.readFile(filePath);
    let sheetName = requestedSheetName;

    if (!sheetName || !workbook.SheetNames.includes(sheetName)) {
      if(sheetName) sendLog(`[WARN] La hoja solicitada '${sheetName}' no se encontró. Buscando una alternativa.`, 'WARN');

      const currentYear = new Date().getFullYear().toString();
      const matrixPatternCurrent = new RegExp(`Matriz Cap\\.\\s*${currentYear}`, 'i');
      sheetName = workbook.SheetNames.find(name => matrixPatternCurrent.test(name));

      if (!sheetName) {
        for (let year = parseInt(currentYear); year >= 2017; year--) {
          const pattern = new RegExp(`Matriz Cap\\.\\s*${year}`, 'i');
          sheetName = workbook.SheetNames.find(name => pattern.test(name));
          if (sheetName) break;
        }
      }
      if (!sheetName) {
        sheetName = workbook.SheetNames[0];
      }
    }

    if (!sheetName) {
      throw new Error('No se encontró ninguna hoja en el archivo Excel');
    }

    sendLog(`[DEBUG] Hoja seleccionada para la lectura: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet || !worksheet['!ref']) {
      sendLog(`[WARN] La hoja '${sheetName}' parece estar vacía.`);
      return { success: true, data: { processedData: [], headers: [] } };
    }

    const allData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });
    const headers = allData[5] || []; // Asumiendo que los encabezados están en la fila 6 (índice 5)
    const processedData = allData;

    sendLog(`[MAIN] Archivo Excel procesado. Hoja: ${sheetName}, Filas leídas: ${allData.length}`, 'INFO');

    return {
      success: true,
      data: {
        processedData,
        headers,
        sheetName: sheetName // Devolver el nombre de la hoja utilizada
      }
    };
  } catch (error) {
    sendLog(`[MAIN] Error al inicializar el archivo Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador específico para leer datos del presupuesto - encabezados en fila 9, datos desde fila 10
ipcMain.handle('readPresupuestoData', async (event, filePath) => {
  try {
    sendLog(`[MAIN] Leyendo datos de presupuesto desde: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    await fsp.access(filePath);

    // Leer el archivo Excel
    const workbook = xlsx.readFile(filePath);

    // Obtener la primera hoja (podríamos mejorar esta lógica si es necesario)
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet || !worksheet['!ref']) {
      sendLog(`[WARN] La hoja '${sheetName}' parece estar vacía.`, 'WARN');
      return { success: true, data: { processedData: [], headers: [], formulaCells: [] } };
    }

        // --- INICIO DE LA CORRECCIÓN ---
    // La detección automática del rango ('!ref') no es fiable después de guardar con exceljs.
    // Forzamos el rango para que siempre empiece en A1 y termine en la columna R,
    // pero respetando la última fila detectada por la librería.
    const originalRange = xlsx.utils.decode_range(worksheet['!ref']);
    const correctedRange = {
      s: { c: 0, r: 0 }, // Empezar en la columna A (0) y fila 1 (0)
      e: { c: 17, r: originalRange.e.r } // Terminar en la columna R (17) y la última fila detectada
    };
    const correctedRangeStr = xlsx.utils.encode_range(correctedRange);
    sendLog(`[DEBUG] readPresupuestoData - Rango original: ${worksheet['!ref']}, Rango corregido: ${correctedRangeStr}`, 'DEBUG');
    // --- FIN DE LA CORRECCIÓN ---

    // Obtener todos los datos de la hoja usando el rango corregido
    const allData = xlsx.utils.sheet_to_json(worksheet, { 
        header: 1, 
        raw: false, 
        defval: null,
        range: correctedRangeStr // Usar el rango corregido aquí
    });

    // Extraer encabezados de la fila 9 (índice 8) y datos desde la fila 10 (índice 9 en adelante)
    const headers = allData[8] || []; // Fila 9 para encabezados (índice 8)
    const dataStartIndex = 9; // Datos empiezan desde fila 10 (índice 9)
    const rawData = allData.slice(dataStartIndex); // Datos desde fila 10 hasta el final

    // Mapeo de encabezados a propiedades esperadas por el frontend
    const headerMapping = {
      'id': [0, 'A'],                    // Índice 0, Columna A - ID
      'detalle': [2, 'C'],               // Índice 2, Columna C - Detalle
      'asignacion': [3, 'D'],            // Índice 3, Columna D - Asignación
      'ejecutado_acumulado': [4, 'E'],   // Índice 4, Columna E - Ejecutado Acumulado
      'porcentaje_ejecutado': [5, 'F'],  // Índice 5, Columna F - % Ejecutado
      'enero': [6, 'G'],                 // Índice 6, Columna G - Enero
      'febrero': [7, 'H'],               // Índice 7, Columna H - Febrero
      'marzo': [8, 'I'],                 // Índice 8, Columna I - Marzo
      'abril': [9, 'J'],                 // Índice 9, Columna J - Abril
      'mayo': [10, 'K'],                // Índice 10, Columna K - Mayo
      'junio': [11, 'L'],               // Índice 11, Columna L - Junio
      'julio': [12, 'M'],               // Índice 12, Columna M - Julio
      'agosto': [13, 'N'],              // Índice 13, Columna N - Agosto
      'septiembre': [14, 'O'],          // Índice 14, Columna O - Septiembre
      'octubre': [15, 'P'],             // Índice 15, Columna P - Octubre
      'noviembre': [16, 'Q'],           // Índice 16, Columna Q - Noviembre
      'diciembre': [17, 'R']            // Índice 17, Columna R - Diciembre
    };

    // Log de información del archivo y mapeo
    sendLog(`[DEBUG] readPresupuestoData - Hoja: ${sheetName}, Rango de datos: ${worksheet['!ref']}`, 'DEBUG');
    sendLog(`[DEBUG] readPresupuestoData - Encabezados encontrados: ${JSON.stringify(headers)}`, 'DEBUG');
    sendLog(`[DEBUG] readPresupuestoData - Total de filas de datos: ${rawData.length}`, 'DEBUG');
    sendLog(`[DEBUG] readPresupuestoData - Mapeo de columnas: ${JSON.stringify(headerMapping)}`, 'DEBUG');

    // Procesar los datos mapeando cada encabezado a su propiedad correspondiente
    let processedData = [];
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      sendLog(`[DEBUG] readPresupuestoData - Procesando fila ${i + dataStartIndex + 1}: ${JSON.stringify(row)}`, 'DEBUG');

      // Verificar si la fila contiene texto especial como "TOTAL AÑO" o "ANALISIS PRESUPUESTAL"
      const firstCell = row[0]; // Primera columna (ID)

      // Verificar también en la columna B en caso de celdas unificadas
      const secondCell = row[1]; // Segunda columna (B) - podría contener "TOTAL AÑO" si la celda A-B está unificada

      // Si encontramos "TOTAL AÑO" en cualquier celda de la fila (A o B), detenemos la lectura de más filas
      if ((typeof firstCell === 'string' && firstCell.includes('TOTAL AÑO')) ||
          (typeof secondCell === 'string' && secondCell.includes('TOTAL AÑO'))) {
        // Crear un objeto especial para TOTAL AÑO con solo el id
        const obj = {
          id: typeof firstCell === 'string' && firstCell.includes('TOTAL AÑO') ? firstCell :
              typeof secondCell === 'string' && secondCell.includes('TOTAL AÑO') ? secondCell : 'TOTAL AÑO',
          detalle: 'TOTAL AÑO',  // Mostrar TOTAL AÑO en la columna de detalle
          asignacion: 0,
          ejecutado_acumulado: 0,
          porcentaje_ejecutado: 0,
          enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
          julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
        };
        processedData.push(obj);
        sendLog(`[DEBUG] readPresupuestoData - Detectado TOTAL AÑO en fila ${i + dataStartIndex + 1}, deteniendo lectura`, 'DEBUG');
        break; // Detener el bucle para no incluir filas posteriores
      }

      const obj = {};

      // Mapear cada columna al nombre de propiedad que espera el frontend
      for (const [propName, [indexCol, columnLetter]] of Object.entries(headerMapping)) {
        if (row[indexCol] !== undefined && row[indexCol] !== null) {
          const value = row[indexCol];
          obj[propName] = value; // Asignar el valor original sin conversiones
          sendLog(`[DEBUG] readPresupuestoData - Fila ${i + dataStartIndex + 1}, Columna ${columnLetter}[${indexCol}]: ${propName} = ${value}`, 'DEBUG');
        } else {
          // Si no hay valor, asignar un valor por defecto basado en el tipo
          obj[propName] = propName.includes('asignacion') || propName.includes('acumulado') ||
                          propName.includes('enero') || propName.includes('febrero') ||
                          propName.includes('marzo') || propName.includes('abril') ||
                          propName.includes('mayo') || propName.includes('junio') ||
                          propName.includes('julio') || propName.includes('agosto') ||
                          propName.includes('septiembre') || propName.includes('octubre') ||
                          propName.includes('noviembre') || propName.includes('diciembre') ? 0 : '';
          sendLog(`[DEBUG] readPresupuestoData - Fila ${i + dataStartIndex + 1}, Columna ${columnLetter}[${indexCol}]: ${propName} = valor por defecto`, 'DEBUG');
        }
      }

      // Si la primera o segunda celda contiene texto especial (pero no TOTAL AÑO), preservarlo
      if (typeof firstCell === 'string' && (firstCell.includes('ANALISIS'))) {
        obj.id = firstCell;
      } else if (typeof secondCell === 'string' && (secondCell.includes('ANALISIS'))) {
        obj.id = secondCell;
      }

      processedData.push(obj);
    }

    // Filtrar filas especiales o vacías si es necesario para cálculos
    const filteredData = processedData.filter(item => {
      // Excluir filas que contengan texto especial como "TOTAL AÑO" o "ANALISIS PRESUPUESTAL" de los cálculos
      return !(typeof item.detalle === 'string' &&
               (item.detalle.includes('TOTAL') || item.detalle.includes('ANALISIS')));
    });

    sendLog(`[MAIN] Datos de presupuesto procesados. Encabezados: ${headers.length}, Filas de datos: ${processedData.length}, Filas para cálculo: ${filteredData.length}`, 'INFO');
    sendLog(`[DEBUG] readPresupuestoData - Muestra de los primeros 3 datos procesados: ${JSON.stringify(processedData.slice(0, 3))}`, 'DEBUG');

    // Devolver también las celdas de fórmulas (vacío por ahora, pero estructura compatible)
    // En el futuro se podría implementar la detección de fórmulas si es necesario
    const formulaCells = [];

    return {
      success: true,
      data: {
        processedData, // Devolver todos los datos, incluyendo filas especiales para mostrar en tabla
        filteredData,  // Devolver datos filtrados para cálculos
        headers,
        formulaCells,
        rawData,
        sheetName: sheetName
      }
    };
  } catch (error) {
    sendLog(`[MAIN] Error leyendo datos de presupuesto: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-excel-cell', async (event, data) => {
  try {
    const { filePath, cellAddress, newValue, sheetName } = data;
    sendLog(`[MAIN] Actualizando celda ${cellAddress} en archivo Excel: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    await fsp.access(filePath);

    // Leer el archivo Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Obtener la hoja específica o la primera hoja
    const worksheet = sheetName ? workbook.getWorksheet(sheetName) : workbook.getWorksheet(1);

    if (!worksheet) {
      throw new Error(`Hoja '${sheetName || '1'}' no encontrada en el archivo Excel`);
    }

    // Actualizar la celda
    const cell = worksheet.getCell(cellAddress);
    cell.value = newValue;

    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[MAIN] Celda ${cellAddress} actualizada exitosamente`, 'INFO');

    return { success: true, message: `Celda ${cellAddress} actualizada correctamente` };
  } catch (error) {
    sendLog(`[MAIN] Error al actualizar celda en archivo Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('convertExcelToPdf', async (event, filePath) => {
  try {
    sendLog(`[MAIN] Convirtiendo archivo Excel a PDF: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    await fsp.access(filePath);

    // Para la conversión Excel a PDF, usaríamos un script Python similar al de Word
    const pythonPath = await getPython();
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_xlsx_to_pdf.py');

    // Verificar si el script de conversión existe
    try {
      await fsp.access(pythonScriptPath);
    } catch {
      // Si no existe el script específico, podríamos usar la conversión de ExcelJS a PDF
      // pero por ahora lanzamos un error para indicar la funcionalidad faltante
      throw new Error(`Script de conversión Excel a PDF no encontrado: ${pythonScriptPath}`);
    }

    // Ejecutar el script de conversión
    const outputPdfPath = filePath.replace(/\.[^/.]+$/, '.pdf');
    const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, filePath, outputPdfPath]);

    sendLog(`[MAIN] Archivo Excel convertido a PDF exitosamente: ${outputPdfPath}`, 'INFO');

    return { success: true, pdfPath: outputPdfPath };
  } catch (error) {
    sendLog(`[MAIN] Error al convertir Excel a PDF: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// --- Manejadores para el Visor de Documentos ---

ipcMain.handle('get-excel-preview', async (event, filePath) => {
  sendLog(`[MAIN][get-excel-preview] Solicitud recibida para filePath: ${filePath}`, 'INFO');

  let tempPdfPath = null; // Variable para el archivo temporal

  try {
    // 1. Verificar que el archivo es accesible
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN][get-excel-preview] Archivo XLSX accesible: ${filePath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][get-excel-preview] Error de acceso al archivo XLSX ${filePath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo XLSX no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    sendLog(`[MAIN][get-excel-preview] Iniciando conversión de Excel a PDF para: ${filePath}`, 'INFO');

    // 2. Obtener ruta de Python
    const pythonPath = await getPython();
    sendLog(`[MAIN][get-excel-preview] Usando Python de: ${pythonPath}`, 'DEBUG');

    // 3. Definir rutas de script y archivo temporal
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_xlsx_to_pdf.py');
    tempPdfPath = path.join(os.tmpdir(), `preview-${Date.now()}.pdf`);

    sendLog(`[MAIN][get-excel-preview] Script de conversión: ${pythonScriptPath}`, 'DEBUG');
    sendLog(`[MAIN][get-excel-preview] Archivo de entrada: ${filePath}`, 'DEBUG');
    sendLog(`[MAIN][get-excel-preview] Archivo de salida temporal: ${tempPdfPath}`, 'DEBUG');

    // 4. Ejecutar el script de conversión
    const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, filePath, tempPdfPath]);
    if (stdout) sendLog(`[MAIN][get-excel-preview] Python stdout: ${stdout}`, 'DEBUG');
    if (stderr) sendLog(`[MAIN][get-excel-preview] Python stderr: ${stderr}`, 'WARN');

    sendLog(`[MAIN][get-excel-preview] Conversión a PDF completada exitosamente.`, 'INFO');

    // 5. Leer el PDF generado
    try {
      await fsp.access(tempPdfPath, fs.constants.R_OK);
      sendLog(`[MAIN][get-excel-preview] PDF temporal accesible: ${tempPdfPath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][get-excel-preview] Error de acceso al PDF temporal ${tempPdfPath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El PDF temporal no es accesible o no existe: ${tempPdfPath}. Error: ${accessError.message}` };
    }
    const buffer = await fsp.readFile(tempPdfPath);
    sendLog(`[MAIN][get-excel-preview] PDF temporal leído. Tamaño: ${buffer.length} bytes`, 'INFO');

    return { success: true, data: buffer.toString('base64') };

  } catch (error) {
    if (error.message.includes('no such file')) {
      sendLog(`[MAIN][get-excel-preview] El script de conversión de Excel no existe: ${path.join(__dirname, 'Portear', 'src', 'convert_xlsx_to_pdf.py')}`, 'ERROR');
      return { success: false, error: "No se encontró el script de conversión para archivos Excel. Contacte al administrador." };
    }
    sendLog(`[MAIN][get-excel-preview] Error durante la conversión de Excel a PDF: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  } finally {
    // 5. Limpiar el archivo temporal
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        await fsp.unlink(tempPdfPath);
        sendLog(`[MAIN][get-excel-preview] Archivo PDF temporal eliminado: ${tempPdfPath}`, 'INFO');
      } catch (cleanupError) {
        sendLog(`[MAIN][get-excel-preview] Error al eliminar el archivo PDF temporal: ${cleanupError.message}`, 'WARN');
      }
    }
  }
});

ipcMain.handle('get-pdf-preview', async (event, filePath) => {
  sendLog(`[MAIN][get-pdf-preview] Solicitud recibida para filePath: ${filePath}`, 'INFO');
  try {
    // Verificar que el archivo existe y es accesible
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN][get-pdf-preview] Archivo accesible: ${filePath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][get-pdf-preview] Error de acceso al archivo ${filePath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    const buffer = await fsp.readFile(filePath);
    sendLog(`[MAIN][get-pdf-preview] PDF leído exitosamente. Tamaño: ${buffer.length} bytes`, 'INFO');
    return { success: true, data: buffer.toString('base64') };
  } catch (error) {
    sendLog(`[MAIN][get-pdf-preview] Error al leer el archivo PDF: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-word-preview', async (event, filePath) => {
  sendLog(`[MAIN][get-word-preview] Solicitud recibida para filePath: ${filePath}`, 'INFO');
  let tempPdfPath = '';
  try {
    // Verificar que el archivo de entrada existe y es accesible
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN][get-word-preview] Archivo DOCX accesible: ${filePath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][get-word-preview] Error de acceso al archivo DOCX ${filePath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo DOCX no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    sendLog(`[MAIN][get-word-preview] Iniciando conversión de Word a PDF para: ${filePath}`, 'INFO');

    // 1. Obtener ruta de Python
    const pythonPath = await getPython();
    sendLog(`[MAIN][get-word-preview] Usando Python de: ${pythonPath}`, 'DEBUG');

    // 2. Definir rutas de script y archivo temporal
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_docx_to_pdf.py');
    tempPdfPath = path.join(os.tmpdir(), `preview-${Date.now()}.pdf`);

    sendLog(`[MAIN][get-word-preview] Script de conversión: ${pythonScriptPath}`, 'DEBUG');
    sendLog(`[MAIN][get-word-preview] Archivo de entrada: ${filePath}`, 'DEBUG');
    sendLog(`[MAIN][get-word-preview] Archivo de salida temporal: ${tempPdfPath}`, 'DEBUG');

    // 3. Ejecutar el script de conversión
    const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, filePath, tempPdfPath]);
    if (stdout) sendLog(`[MAIN][get-word-preview] Python stdout: ${stdout}`, 'DEBUG');
    if (stderr) sendLog(`[MAIN][get-word-preview] Python stderr: ${stderr}`, 'WARN');

    sendLog(`[MAIN][get-word-preview] Conversión a PDF completada exitosamente.`, 'INFO');

    // 4. Leer el PDF generado
    try {
      await fsp.access(tempPdfPath, fs.constants.R_OK);
      sendLog(`[MAIN][get-word-preview] PDF temporal accesible: ${tempPdfPath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][get-word-preview] Error de acceso al PDF temporal ${tempPdfPath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El PDF temporal no es accesible o no existe: ${tempPdfPath}. Error: ${accessError.message}` };
    }
    const buffer = await fsp.readFile(tempPdfPath);
    sendLog(`[MAIN][get-word-preview] PDF temporal leído. Tamaño: ${buffer.length} bytes`, 'INFO');

    return { success: true, data: buffer.toString('base64') };

  } catch (error) {
    sendLog(`[MAIN][get-word-preview] Error durante la conversión de Word a PDF: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  } finally {
    // 5. Limpiar el archivo temporal
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        await fsp.unlink(tempPdfPath);
        sendLog(`[MAIN][get-word-preview] Archivo PDF temporal eliminado: ${tempPdfPath}`, 'INFO');
      } catch (cleanupError) {
        sendLog(`[MAIN][get-word-preview] Error al eliminar el archivo PDF temporal: ${cleanupError.message}`, 'WARN');
      }
    }
  }
});

// Manejador para descargar documentos
ipcMain.handle('download-document', async (event, filePath) => {
  sendLog(`[MAIN][download-document] Solicitud para descargar archivo: ${filePath}`, 'INFO');

  try {
    // Verificar que el archivo existe
    await fsp.access(filePath, fs.constants.R_OK);
    sendLog(`[MAIN][download-document] Archivo verificado: ${filePath}`, 'DEBUG');

    // Enviar el archivo al renderer como base64
    const fileBuffer = await fsp.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');

    // Obtener el nombre del archivo desde la ruta
    const fileName = path.basename(filePath);

    return { success: true, fileName, base64Data };
  } catch (error) {
    sendLog(`[MAIN][download-document] Error al descargar archivo: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para obtener la lista de archivos de presupuesto
ipcMain.handle('getPresupuestoFiles', async (event, companyName) => {
  sendLog(`[MAIN] Buscando archivos de presupuesto para: ${companyName} en el submódulo 1.1.3.`);
  try {
      const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
      const config = JSON.parse(configData);

      // --- Lógica para encontrar la ruta del submódulo "1.1.3 Asignación de Recursos" ---
      const normalizedCompanyName = companyName.toLowerCase();
      const companyKey = Object.keys(config.companyPaths || {}).find(
          key => key.toLowerCase() === normalizedCompanyName
      );

      const companyConfig = companyKey ? config.companyPaths[companyKey] : null;

      if (!companyConfig || !companyConfig.structure?.structure) {
          throw new Error(`Empresa "${companyName}" no tiene estructura mapeada.`);
      }

      const actualCompanyStructure = companyConfig.structure.structure;

      // Corregido: searchInStructure devuelve una cadena de texto (la ruta) directamente.
      const submodulePath = searchInStructure(actualCompanyStructure, "1.1.3");

      if (!submodulePath) {
          throw new Error(`No se encontró la ruta para el submódulo '1.1.3 Asignación de Recursos' para la empresa "${companyName}".`);
      }

      sendLog(`[MAIN] Ruta del submódulo '1.1.3 Asignación de Recursos' encontrada: ${submodulePath}`);
      const searchPath = submodulePath;
      // --- FIN Lógica para encontrar la ruta del submódulo ---

      async function findBudgetFilesRecursive(dir) {
          let files = [];
          try {
              const entries = await fsp.readdir(dir, { withFileTypes: true });
              for (const entry of entries) {
                  const fullPath = path.join(dir, entry.name);
                  if (entry.isDirectory()) {
                      files = files.concat(await findBudgetFilesRecursive(fullPath));
                  } else if (
                      !entry.name.startsWith('~$') &&
                      (entry.name.toLowerCase().includes('presupuesto') ||
                       entry.name.toLowerCase().includes('costo') ||
                       entry.name.toLowerCase().includes('gasto') ||
                       entry.name.toLowerCase().includes('recurso') ||
                       entry.name.toLowerCase().includes('asignacion')) &&
                      (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))
                  ) {
                      const stats = await fsp.stat(fullPath);
                      files.push({
                          name: entry.name,
                          path: fullPath,
                          size: stats.size,
                          modified: stats.mtime
                      });
                  }
              }
          } catch (error) {
              sendLog(`[WARN] No se pudo leer el directorio ${dir}: ${error.message}`);
          }
          return files;
      }

      let budgetFiles = await findBudgetFilesRecursive(searchPath); // Usar searchPath aquí

      if (budgetFiles.length > 0) {
           sendLog(`[MAIN] Encontrados ${budgetFiles.length} archivos de presupuesto con búsqueda robusta.`);
           return { success: true, files: budgetFiles };
      }

      // Fallback si no se encuentra nada
      sendLog(`[MAIN] No se encontraron archivos de presupuesto con búsqueda robusta, intentando fallback a archivo de ejemplo.`);
      const ejemploPath = path.join(__dirname, 'utils', 'Presupuesto SG-SST.xlsx');
      if (fs.existsSync(ejemploPath)) {
          const stats = fs.statSync(ejemploPath);
          return {
              success: true,
              files: [{
                  name: 'Ejemplo_Presupuesto_SG-SST.xlsx',
                  path: ejemploPath,
                  size: stats.size,
                  modified: stats.mtime
              }],
              empty: true, // Indicar que es un ejemplo
              message: 'No se encontraron archivos de presupuesto reales. Se muestra un archivo de ejemplo.'
          };
      }

      // Si ni siquiera el ejemplo existe
      return { success: true, files: [], empty: true, message: 'No se encontraron archivos de presupuesto y el archivo de ejemplo no está disponible.' };

  } catch (error) {
      sendLog(`[MAIN] Error en getPresupuestoFiles: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
  }
});


// Manejador para guardar archivos de presupuesto
ipcMain.handle('saveBudgetFile', async (event, filePath, dataToSave) => {
  return await handleSaveBudgetFile(event, filePath, dataToSave);
});

// Manejador para guardar archivos de presupuesto (nombre alternativo para compatibilidad)
ipcMain.handle('saveBudgetChanges', async (event, filePath, dataToSave) => {
  sendLog(`[MAIN] Guardando cambios de presupuesto en: ${filePath}`, 'INFO');
  // Reutiliza la misma lógica que saveBudgetFile para compatibilidad
  return await handleSaveBudgetFile(event, filePath, dataToSave);
});

// Función auxiliar para manejar la lógica de guardado de presupuesto, reutilizable
async function handleSaveBudgetFile(event, filePath, dataToSave) {
  sendLog(`[MAIN] Guardando archivo de presupuesto: ${filePath}`, 'INFO');

  try {
    // Validar que se hayan recibido los datos necesarios
    if (!dataToSave || !Array.isArray(dataToSave)) {
      throw new Error('Datos de presupuesto no válidos o no proporcionados para guardar');
    }

    // Verificar que la ruta del archivo exista
    await fsp.access(filePath);

    // Verificar el tamaño del archivo para asegurar que no esté vacío
    const stats = await fsp.stat(filePath);
    if (stats.size === 0) {
      throw new Error('El archivo Excel está vacío y no se puede procesar.');
    }

    // Leer el archivo existente
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile(filePath);
    } catch (error) {
      sendLog(`[MAIN] Error al leer el archivo Excel con ExcelJS: ${error.message}`, 'ERROR');
      throw new Error(`No se pudo leer el archivo Excel. Puede estar dañado o en un formato no compatible: ${error.message}`);
    }

    // Verificar si el libro tiene hojas válidas
    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      sendLog(`[DEBUG] No se encontraron hojas en el libro. Intentando crear una nueva hoja.`, 'DEBUG');
      // Si no hay hojas, crear una nueva hoja con un nombre predeterminado
      const newWorksheet = workbook.addWorksheet('Hoja1');

      // Configurar las cabeceras basadas en la estructura esperada del presupuesto
      // Aseguramos que la estructura coincida con lo que el frontend espera
      const headerRow = newWorksheet.getRow(9); // Fila 9 es donde normalmente están los encabezados
      headerRow.values = [
        '', // Columna A vacía
        '', // Columna B vacía
        'Detalle', // Columna C
        'Asignación', // Columna D
        'Ejecutado Acumulado', // Columna E
        '% Ejecutado', // Columna F
        'Enero', // Columna G
        'Febrero', // Columna H
        'Marzo', // Columna I
        'Abril', // Columna J
        'Mayo', // Columna K
        'Junio', // Columna L
        'Julio', // Columna M
        'Agosto', // Columna N
        'Septiembre', // Columna O
        'Octubre', // Columna P
        'Noviembre', // Columna Q
        'Diciembre' // Columna R
      ]; // Columnas A-R

      // Ajustar ancho de columnas
      newWorksheet.columns = [
        { key: 'id', width: 10 },
        { key: 'empty_b', width: 5 },
        { key: 'detalle', width: 30 },
        { key: 'asignacion', width: 15 },
        { key: 'ejecutado_acumulado', width: 15 },
        { key: 'porcentaje_ejecutado', width: 12 },
        { key: 'enero', width: 12 },
        { key: 'febrero', width: 12 },
        { key: 'marzo', width: 12 },
        { key: 'abril', width: 12 },
        { key: 'mayo', width: 12 },
        { key: 'junio', width: 12 },
        { key: 'julio', width: 12 },
        { key: 'agosto', width: 12 },
        { key: 'septiembre', width: 12 },
        { key: 'octubre', width: 12 },
        { key: 'noviembre', width: 12 },
        { key: 'diciembre', width: 12 }
      ];
    }

    // Obtener la primera hoja disponible
    let worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No se pudo acceder a ninguna hoja del archivo Excel.');
    }

    sendLog(`[DEBUG] Hoja seleccionada: ${worksheet.name || 'Hoja sin nombre'}`, 'DEBUG');

    // Mapeo de propiedades a columnas basado en el archivo Excel real de presupuesto
    // Basado en el mapeo de la función de lectura: [índice, columna]
    const columnMapping = {
      'id': [0, 'A'],                    // Índice 0, Columna A - ID
      'detalle': [2, 'C'],               // Índice 2, Columna C - Detalle
      'asignacion': [3, 'D'],            // Índice 3, Columna D - Asignación
      'ejecutado_acumulado': [4, 'E'],   // Índice 4, Columna E - Ejecutado Acumulado
      'porcentaje_ejecutado': [5, 'F'],  // Índice 5, Columna F - % Ejecutado
      'enero': [6, 'G'],                 // Índice 6, Columna G - Enero
      'febrero': [7, 'H'],               // Índice 7, Columna H - Febrero
      'marzo': [8, 'I'],                 // Índice 8, Columna I - Marzo
      'abril': [9, 'J'],                 // Índice 9, Columna J - Abril
      'mayo': [10, 'K'],                // Índice 10, Columna K - Mayo
      'junio': [11, 'L'],               // Índice 11, Columna L - Junio
      'julio': [12, 'M'],               // Índice 12, Columna M - Julio
      'agosto': [13, 'N'],              // Índice 13, Columna N - Agosto
      'septiembre': [14, 'O'],          // Índice 14, Columna O - Septiembre
      'octubre': [15, 'P'],             // Índice 15, Columna P - Octubre
      'noviembre': [16, 'Q'],           // Índice 16, Columna Q - Noviembre
      'diciembre': [17, 'R']            // Índice 17, Columna R - Diciembre
    };

    // Actualizar los datos en el archivo Excel desde la fila 10 en adelante
    for (let i = 0; i < dataToSave.length; i++) {
      const rowData = dataToSave[i];
      const rowIndex = i + 10;
      const row = worksheet.getRow(rowIndex);

      const values = new Array(18);

      // Función interna para parsear de forma segura, similar a la del frontend
      const parseValue = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val !== 'string') return 0;
        let cleanValue = val.replace(/\$/g, '').replace(/\s/g, '');
        if (cleanValue.indexOf(',') > cleanValue.indexOf('.')) {
            return parseFloat(cleanValue.replace(/\./g, '').replace(',', '.')) || 0;
        }
        return parseFloat(cleanValue.replace(/,/g, '')) || 0;
      };

      const parsePercentage = (val) => {
          if (typeof val === 'number') return val / 100; // Si ya es un número (ej: 50), convertir a 0.5
          if (typeof val === 'string') {
              const num = parseValue(val.replace('%', ''));
              return (num / 100) || 0;
          }
          return 0;
      };

      // Asignar valores a los índices correctos del array
      values[0] = rowData.id;
      values[1] = ''; // Columna B explícitamente vacía
      values[2] = rowData.detalle;
      
      values[3] = parseValue(rowData.asignacion);
      values[4] = parseValue(rowData.ejecutado_acumulado);
      values[5] = parsePercentage(rowData.porcentaje_ejecutado);
      
      values[6] = parseValue(rowData.enero);
      values[7] = parseValue(rowData.febrero);
      values[8] = parseValue(rowData.marzo);
      values[9] = parseValue(rowData.abril);
      values[10] = parseValue(rowData.mayo);
      values[11] = parseValue(rowData.junio);
      values[12] = parseValue(rowData.julio);
      values[13] = parseValue(rowData.agosto);
      values[14] = parseValue(rowData.septiembre);
      values[15] = parseValue(rowData.octubre);
      values[16] = parseValue(rowData.noviembre);
      values[17] = parseValue(rowData.diciembre);

      row.values = values;
      
      // Aplicar formato de número a las celdas para correcta visualización en Excel
      row.getCell('D').numFmt = '#,##0.00'; // Asignación
      row.getCell('E').numFmt = '#,##0.00'; // Ejecutado
      row.getCell('F').numFmt = '0.00%';    // Porcentaje
      
      // Formato para meses (columnas G a R)
      for (let col = 7; col <= 18; col++) { // 7 es 'G', 18 es 'R'
        row.getCell(col).numFmt = '#,##0.00';
      }
      
      sendLog(`[DEBUG] handleSaveBudgetFile - Escribiendo valores en fila ${rowIndex}`, 'DEBUG');
    }

    // Guardar el archivo actualizado
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[MAIN] Archivo de presupuesto guardado exitosamente: ${filePath}`, 'INFO');
    return { success: true, message: 'Archivo guardado exitosamente' };
  } catch (error) {
    sendLog(`[MAIN] Error al guardar archivo de presupuesto: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
}


// Manejar búsqueda de ruta de submódulo
ipcMain.handle('find-submodule-path', async (event, companyName, module, submodule) => {
  try {
    console.log(`[INFO] Finding path for company: ${companyName}, module: ${module}, submodule: ${submodule}`);

    // Cargar la configuración
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);
    console.log(`[DEBUG] Full config keys: [${Object.keys(config)}]`);

    // Verificar si tenemos rutas de empresa para la empresa especificada
    if (!config.companyPaths || !config.companyPaths[companyName]) {
      const availableCompanies = config.companyPaths ? Object.keys(config.companyPaths) : [];
      console.log(`[ERROR] Company '${companyName}' not found. Available: [${availableCompanies.join(', ')}]`);
      throw new Error(`No configuration found for company: ${companyName}`);
    }

    // Obtener la estructura para esta empresa - Nivel 1
    const companyStructureRoot = config.companyPaths[companyName];
    console.log(`[DEBUG] Company root keys: [${Object.keys(companyStructureRoot)}]`);

    // Obtener la estructura real que contiene las carpetas - Nivel 2 (ESTE ES EL CORRECTO)
    // Según el config.json: config.companyPaths.Tempoactiva.structure.structure
    const actualCompanyStructure = companyStructureRoot.structure?.structure;

    if (!actualCompanyStructure) {
        console.log(`[ERROR] Actual company structure (structure.structure) is missing or invalid.`, companyStructureRoot);
        throw new Error(`Invalid structure found for company: ${companyName}`);
    }

    console.log(`[DEBUG] Actual structure name: '${actualCompanyStructure.name}', path: '${actualCompanyStructure.path}'`);
    console.log(`[DEBUG] Actual structure subdirectories keys: [${Object.keys(actualCompanyStructure.subdirectories || {}).join(', ')}]`);

    // Extraer el código del nombre del submódulo (ej. "1.1.1 Responsable del SG" -> "1.1.1")
    const submoduleCode = submodule.match(/^[0-9.]+/);
    if (!submoduleCode) {
      console.log(`[ERROR] Invalid submodule name format: ${submodule}`);
      throw new Error(`Invalid submodule name format: ${submodule}`);
    }
    const code = submoduleCode[0];
    console.log(`[DEBUG] Extracted code: '${code}'`);

    let foundPath = null;

    // Para ciertos módulos conocidos, buscar primero el módulo y luego el submódulo dentro de él
    // Asumimos que "Recursos" es uno de ellos basado en el log anterior.
    if (module === "Recursos") {
      const resourcesFolderName = "1. Recursos"; // Nombre fijo esperado

      console.log(`[DEBUG] Searching for module '${module}' (folder: '${resourcesFolderName}') containing code '${code}'`);

      // Verificar si la carpeta "1. Recursos" existe en el nivel raíz de la estructura
      if (actualCompanyStructure.subdirectories && actualCompanyStructure.subdirectories[resourcesFolderName]) {
          const resourcesFolderNode = actualCompanyStructure.subdirectories[resourcesFolderName];
          console.log(`[DEBUG] Found '${resourcesFolderName}' folder. Searching inside it for code '${code}'...`);
          // Buscar el submódulo (ej. "1.1.1 Responsable del SG") DENTRO de la carpeta "1. Recursos"
          foundPath = searchInStructure(resourcesFolderNode, code);
      } else {
          console.log(`[WARN] Folder '${resourcesFolderName}' not found at root level. Available root folders: [${Object.keys(actualCompanyStructure.subdirectories || {}).join(', ')}]`);
      }
    }

    // Si no se encontró en un módulo específico o no es un módulo conocido, buscar el código directamente en la raíz
    if (!foundPath) {
      console.log(`[DEBUG] Searching for code '${code}' directly in root structure...`);
      foundPath = searchInStructure(actualCompanyStructure, code);
    }

    if (foundPath) {
      console.log(`[SUCCESS] Path found for '${submodule}': ${foundPath}`);
      return { success: true, path: foundPath };
    } else {
      console.log(`[ERROR] Path for '${submodule}' not found in structure.`);
      return { success: false, error: `No se encontró la ruta para el submódulo '${submodule}'` };
    }
  } catch (error) {
    console.error(`[ERROR] Error in find-submodule-path: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// --- Vigilancia de archivos ---
let capacitacionesFileWatcher = null;
let debounceTimer = null;

ipcMain.on('start-watching-capacitaciones', (event, filePath) => {
  // Detener cualquier watcher anterior
  if (capacitacionesFileWatcher) {
    capacitacionesFileWatcher.close();
  }

  try {
    sendLog(`[MAIN] Iniciando vigilancia sobre el archivo: ${filePath}`, 'INFO');
    capacitacionesFileWatcher = fs.watch(filePath, (eventType, filename) => {
      if (eventType === 'change') {
        // Usar debounce para evitar múltiples eventos rápidos
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          sendLog(`[MAIN] Archivo de capacitaciones modificado: ${filename}. Notificando al renderer.`, 'INFO');
          mainWindow.webContents.send('capacitaciones-file-changed');
        }, 1000); // Esperar 1 segundo antes de notificar
      }
    });

    capacitacionesFileWatcher.on('error', (err) => {
        sendLog(`[MAIN] Error en el watcher de capacitaciones: ${err.message}`, 'ERROR');
    });

  } catch (error) {
      sendLog(`[MAIN] No se pudo iniciar la vigilancia sobre el archivo ${filePath}: ${error.message}`, 'ERROR');
  }
});

ipcMain.on('stop-watching-capacitaciones', () => {
  if (capacitacionesFileWatcher) {
    sendLog('[MAIN] Deteniendo la vigilancia sobre el archivo de capacitaciones.', 'INFO');
    capacitacionesFileWatcher.close();
    capacitacionesFileWatcher = null;
  }
});

// Manejador para la creación de la ventana principal
app.whenReady().then(() => {
  createWindow();

  // Iniciar la búsqueda de actualizaciones una vez que la app esté lista
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    // En macOS, es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el ícono del dock y no hay otras ventanas abiertas.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Salir cuando todas las ventanas estén cerradas, excepto en macOS.
// Allí, es común que las aplicaciones y su barra de menú permanezcan activas
// hasta que el usuario salga explícitamente con Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// En este archivo puedes incluir el resto del código del proceso principal de tu aplicación.
// También puedes ponerlos en archivos separados y requerirlos aquí.

// --- Eventos del Auto-Updater ---

autoUpdater.on('update-available', () => {
  log.info('Actualización disponible.');
  if (mainWindow) {
    mainWindow.webContents.send('update_available');
  }
});

autoUpdater.on('update-downloaded', () => {
  log.info('Actualización descargada. Lista para ser instalada.');
  if (mainWindow) {
    mainWindow.webContents.send('update_downloaded');
  }
});

autoUpdater.on('error', (err) => {
  log.error('Error en el auto-updater: ' + err.toString());
});

// =============================================================================
// Handler: Leer datos de ausentismo desde Excel
// =============================================================================
ipcMain.handle('get-ausentismo-data', async (event, companyName) => {
  sendLog(`[DEBUG] Handler get-ausentismo-data llamado para empresa: ${companyName}`);
  sendLog(`[TEST] Este log debería aparecer si el handler se llama.`);

  try {
    // -------------------------------------------------------------------------
    // 1. Cargar configuración
    // -------------------------------------------------------------------------
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    // -------------------------------------------------------------------------
    // 2. Obtener la estructura real de la empresa
    // -------------------------------------------------------------------------
    const normalizedCompanyName = companyName.toLowerCase();
    const companyKey = Object.keys(config.companyPaths || {}).find(
      key => key.toLowerCase() === normalizedCompanyName
    );

    const companyConfig = companyKey ? config.companyPaths[companyKey] : null;

    if (!companyConfig || !companyConfig.structure?.structure) {
      const available = Object.keys(config.companyPaths || {});
      throw new Error(
        `Empresa "${companyName}" no tiene estructura mapeada. ` +
        `Disponibles: [${available.join(', ')}]`
      );
    }

    const rootStructure = companyConfig.structure.structure;

    // -------------------------------------------------------------------------
    // 3. Función auxiliar: Buscar carpeta de forma flexible
    // -------------------------------------------------------------------------
    function findDirFlexible(subdirs, target) {
      if (!subdirs) return null;

      const normalizedTarget = target
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      for (const [key, value] of Object.entries(subdirs)) {
        const normalizedKey = key
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (normalizedKey === normalizedTarget) {
          return value;
        }
      }

      return null;
    }

    // -------------------------------------------------------------------------
    // 4. Buscar carpeta "3. Gestión de la Salud"
    // -------------------------------------------------------------------------
    const gestionSalud = findDirFlexible(
      rootStructure.subdirectories,
      "3. Gestión de la Salud"
    );

    if (!gestionSalud) {
      const keys = Object.keys(rootStructure.subdirectories || {});
      throw new Error(
        `No se encontró "3. Gestión de la Salud". ` +
        `Carpetas disponibles: [${keys.join(', ')}]`
      );
    }

    // -------------------------------------------------------------------------
    // 5. Buscar el submódulo de ausentismo
    // -------------------------------------------------------------------------
    const ausentismoDir = findDirFlexible(
      gestionSalud.subdirectories,
      "3.3.6 Medición del ausentismo por causa médica"
    );

    if (!ausentismoDir) {
      const keys = Object.keys(gestionSalud.subdirectories || {});
      throw new Error(
        `No se encontró submódulo de ausentismo. ` +
        `Carpetas disponibles: [${keys.join(', ')}]`
      );
    }

    // -------------------------------------------------------------------------
    // 6. Obtener el primer archivo .xlsx
    // -------------------------------------------------------------------------
    const excelFiles = (ausentismoDir.files || []).filter(
      f => f.extension?.toLowerCase() === '.xlsx'
    );

    if (excelFiles.length === 0) {
      throw new Error('No hay archivos .xlsx en la carpeta de ausentismo.');
    }

    const excelFile = excelFiles[0];
    sendLog(`[DEBUG] Archivo de ausentismo encontrado: ${excelFile.path}`);

    // -------------------------------------------------------------------------
    // 7. Leer archivo Excel
    // -------------------------------------------------------------------------
    const workbook = xlsx.readFile(excelFile.path);
    console.log('[DEBUG] Nombres de hojas en el archivo:', workbook.SheetNames);

    // Buscar la hoja que contiene los datos según el nombre de la empresa
    const normalizedCompanyForSheet = companyName.toLowerCase().replace(/\s+/g, '');
    const sheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes(normalizedCompanyForSheet) &&
      name.toLowerCase().includes('2024')
    ) || workbook.SheetNames[0]; // Si no encuentra, usa la primera

    console.log('[DEBUG] Hoja seleccionada:', sheetName);
    const worksheet = workbook.Sheets[sheetName];
    console.log('[DEBUG] !ref de la hoja:', worksheet['!ref']);

    // -------------------------------------------------------------------------
    // 8. Validar que la hoja no esté vacía
    // -------------------------------------------------------------------------
    if (!worksheet['!ref']) {
      sendLog('[WARN] La hoja de cálculo de ausentismo parece estar vacía (sin !ref).');
      return {
        success: true,
        headers: [],
        rows: [],
        filePath: excelFile.path,
        companyName
      };
    }

    // -------------------------------------------------------------------------
    // 9. Leer todos los datos de la hoja
    // -------------------------------------------------------------------------
    const allData = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: null
    });

    console.log('[DEBUG] Total de filas leídas:', allData.length);
    console.log('[DEBUG] Primeras 5 filas:', allData.slice(0, 5));

    sendLog(`[DEBUG] Total de filas en el archivo: ${allData.length}`);
    sendLog(`[DEBUG] Primeras 10 filas: ${JSON.stringify(allData.slice(0, 10))}`);

    if (allData.length > 6) {
      sendLog(`[DEBUG] Fila 7 (índice 6): ${JSON.stringify(allData[6])}`);
    }

    // -------------------------------------------------------------------------
    // 10. Verificar que haya suficientes filas
    // -------------------------------------------------------------------------
    if (allData.length <= 6) {
      sendLog('[WARN] No hay suficientes filas para encontrar el encabezado en la fila 7.');
      return {
        success: true,
        headers: [],
        rows: [],
        filePath: excelFile.path,
        companyName
      };
    }

    // -------------------------------------------------------------------------
    // 11. Extraer encabezado de la fila 7 (índice 6)
    // -------------------------------------------------------------------------
    const headerRowIndex = 6;
    const headers = allData[headerRowIndex];

    // Validar que tenga al menos 4 columnas
    if (!headers || headers.filter(cell => cell !== null).length < 4) {
      sendLog('[WARN] La fila 7 no parece ser un encabezado válido (menos de 4 columnas).');
      return {
        success: true,
        headers: [],
        rows: [],
        filePath: excelFile.path,
        companyName
      };
    }

    sendLog(`[INFO] Encabezado fijo tomado de la fila 7 (índice ${headerRowIndex}).`);
    sendLog(`[DEBUG] Encabezado detectado: ${JSON.stringify(headers)}`);

    // -------------------------------------------------------------------------
    // 12. Filtrar y limitar las filas de datos
    // -------------------------------------------------------------------------
    const minFilledCells = Math.floor(headers.length / 2);
    const rows = allData
      .slice(headerRowIndex + 1)
      .filter(row =>
        row && row.filter(cell => cell !== null).length >= minFilledCells
      );

    // Limitar columnas hasta la columna S (índice 18)
    const maxColumnsToShow = 19; // Columna S = índice 18 (0-based)
    const limitedHeaders = headers.slice(0, maxColumnsToShow);
    const limitedRows = rows.map(row => row.slice(0, maxColumnsToShow));

    sendLog(`[DEBUG] Total de filas filtradas: ${limitedRows.length}`);

    if (limitedRows.length > 0) {
      sendLog(`[DEBUG] Primera fila de datos: ${JSON.stringify(limitedRows[0])}`);
    }

    // -------------------------------------------------------------------------
    // 13. Retornar datos procesados
    // -------------------------------------------------------------------------
    return {
      success: true,
      headers: limitedHeaders,
      rows: limitedRows,
      filePath: excelFile.path,
      companyName
    };

  } catch (error) {
    sendLog(`[ERROR] Error crítico en get-ausentismo-data: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message,
      companyName
    };
  }
});

// ===============================
// 🔍 Manejador para buscar empleado por cédula
// ===============================
ipcMain.handle('buscar-empleado-por-cedula', async (event, { cedula, empresa }) => {
  const { spawn } = require('child_process');
  const path = require('path');

  const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');

  return new Promise((resolve, reject) => {
    sendLog(`IPC: buscar-empleado-por-cedula recibido. Empresa: ${empresa}, Cédula: ${cedula}`);

    const python = spawn('python', [scriptPath, 'buscar_empleado', cedula, empresa], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let buffer = '';

    python.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        try {
          const obj = JSON.parse(line);
          if (obj.type === 'log') {
            sendLog(`[Python Empleado] ${obj.message}`, 'INFO');
          } else if (obj.type === 'result') {
            resolve(obj.payload);
          }
        } catch (e) {
          sendLog(`[Python Empleado - RAW] ${line}`, 'DEBUG');
        }
      });
    });

    python.stderr.on('data', (data) => {
      sendLog(`[Python Empleado - STDERR] ${data.toString()}`, 'ERROR');
    });

    python.on('close', (code) => {
      sendLog(`[Python Empleado] Proceso cerrado con código ${code}`);
      if (buffer?.trim()) {
        try {
          const last = JSON.parse(buffer.trim());
          if (last.type === 'result') return resolve(last.payload);
        } catch { /* Ignorar errores menores */ }
      }
      resolve({ success: false, error: 'Proceso cerrado sin resultado.' });
    });

    python.on('error', (err) => {
      sendLog(`Error al iniciar proceso Python para buscar empleado: ${err.message}`, 'CRITICAL');
      reject(err);
    });
  });
});

// Manejador para buscar descripción de CIE-10
ipcMain.handle('buscar-cie10-descripcion', async (event, { companyName, cie10Code }) => {
  sendLog(`[MAIN] Handler buscar-cie10-descripcion llamado para empresa: ${companyName}, código: ${cie10Code}`);

  try {
    const ausentismoFiles = {
      "TEMPOACTIVA": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/1. Tempoactiva Est SAS/3. Gestión de la Salud/3.3.6 Medición del ausentismo por causa médica/GI-FO-076 AUSENTISMO POR ARL Y EPS 2024.xlsx",
      "TEMPOSUM": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/2. Temposum Est SAS/3. Gestión de la Salud/3.3.6 Medición del ausentismo por causa médica/3 AUSENTISMO POR ARL Y EPS (TEMPOSUM) 2024.XLSX",
      "ASEPLUS": "G:/Mi unidad/2. Trabajo/1. SG-SST/2. Temporales Comfa/3. Aseplus/3. Gestión de la Salud/3.3.6 Medición del ausentismo por causa médica/PI-FO-076 AUSENTISMO POR ARL Y EPS (ASEPLUS).XLSX",
      "ASEL": "G:/Mi unidad/2. Trabajo/1. SG-SST/19. Asel S.A.S/3. Gestión de la Salud/3.3.6 Medición del ausentismo por causa médica/A-FR-31 Ausentismo Laboral.xlsx"
    };

    const excelFilePath = ausentismoFiles[companyName.toUpperCase()];

    if (!excelFilePath) {
      throw new Error(`No se encontró la ruta del archivo de ausentismo para la empresa: ${companyName}`);
    }

    sendLog(`[MAIN] Usando ruta directa para el archivo de ausentismo: ${excelFilePath}`);

    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`El archivo de ausentismo no se encontró en la ruta esperada: ${excelFilePath}`);
    }

    // --- Ahora, llamar al script de Python ---
    const pythonPath = await getPython();
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');

    const pythonProcess = spawn(pythonPath, [scriptPath, 'buscar_cie10', excelFilePath, cie10Code], {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    return new Promise((resolve, reject) => {
      let buffer = '';
      pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach((line) => {
          line = line.trim();
          if (!line) return;
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'log') {
              sendLog(`[Python CIE-10] ${obj.message}`);
            } else if (obj.type === 'result') {
              sendLog('[Python CIE-10] Resultado recibido.');
              resolve(obj.payload);
            }
          } catch (err) {
            sendLog(`[Python CIE-10 - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      pythonProcess.stderr.on('data', (data) => {
        sendLog(`[Python CIE-10 - STDERR] ${data.toString()}`, 'ERROR');
      });

      pythonProcess.on('close', (code) => {
        sendLog(`[Python CIE-10] Proceso cerrado con código ${code}`);
        if (buffer && buffer.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch (e) { /* ignore */ }
        }
        resolve({ success: false, error: 'No se recibió resultado del script de Python.' });
      });

      pythonProcess.on('error', (err) => {
        sendLog(`Error al iniciar proceso Python para CIE-10: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    sendLog(`[MAIN] Error crítico en buscar-cie10-descripcion: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

async function obtenerRutaAusentismo(companyName) {
  const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
  const config = JSON.parse(configData);

  const normalizedCompanyName = companyName.toLowerCase();
  const companyKey = Object.keys(config.companyPaths || {}).find(
    key => key.toLowerCase() === normalizedCompanyName
  );

  const companyConfig = companyKey ? config.companyPaths[companyKey] : null;
  if (!companyConfig || !companyConfig.structure?.structure) {
    throw new Error(`Empresa "${companyName}" no tiene estructura mapeada.`);
  }

  const rootStructure = companyConfig.structure.structure;

  function findDirFlexible(subdirs, target) {
    if (!subdirs) return null;
    const normalizedTarget = target
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    for (const [key, value] of Object.entries(subdirs)) {
      const normalizedKey = key
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (normalizedKey === normalizedTarget) return value;
    }
    return null;
  }

  const gestionSalud = findDirFlexible(rootStructure.subdirectories, "3. Gestión de la Salud");
  if (!gestionSalud) throw new Error("No se encontró '3. Gestión de la Salud'");

  const ausentismoDir = findDirFlexible(gestionSalud.subdirectories, "3.3.6 Medición del ausentismo por causa médica");
  if (!ausentismoDir) throw new Error("No se encontró submódulo de ausentismo");

  const excelFiles = (ausentismoDir.files || []).filter(f => f.extension?.toLowerCase() === '.xlsx');
  if (excelFiles.length === 0) throw new Error('No hay archivos .xlsx en la carpeta de ausentismo.');

  return excelFiles[0].path;
}

 // =============================================================================
// Handler: Registrar nueva incapacidad en archivo de ausentismo
// =============================================================================
// ✅ Manejador actualizado para procesar y registrar ausentismo
ipcMain.handle('procesar-ausentismo', async (event, empresa, formData) => {
  sendLog(`[MAIN] Registrando nueva incapacidad para empresa: ${empresa}`, 'INFO');

  try {
    // ✅ Obtener la ruta del archivo de ausentismo de manera dinámica
    const filePath = await obtenerRutaAusentismo(empresa);
    sendLog(`[MAIN] Archivo de ausentismo seleccionado: ${filePath}`, 'INFO');

    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    // ✅ Convertir formData en string seguro para pasar a Python
    const formDataJson = JSON.stringify(formData);

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'registrar_incapacidad',
        empresa,      // ARG 1
        filePath,     // ARG 2
        formDataJson  // ARG 3
      ], {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let buffer = '';

      // ✅ Captura de salida estándar
      python.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(line => {
          line = line.trim();
          if (!line) return;

          try {
            const obj = JSON.parse(line);
            if (obj.type === 'log') {
              sendLog(`[Python Registrar] ${obj.message}`, 'INFO');
            } else if (obj.type === 'result') {
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Registrar - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      // ✅ Captura de errores del proceso Python
      python.stderr.on('data', (data) => {
        sendLog(`[Python Registrar - STDERR] ${data.toString()}`, 'ERROR');
      });

      // ✅ Evento al cerrar el proceso
      python.on('close', (code) => {
        if (buffer?.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch { /* Ignorar errores menores */ }
        }
        resolve({ success: false, error: 'Proceso cerrado sin resultado.' });
      });

      // ✅ Captura de errores al iniciar Python
      python.on('error', (err) => {
        sendLog(`Error al iniciar Python para registrar incapacidad: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    sendLog(`[ERROR] Falló procesar-ausentismo: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para guardar seguimiento de incapacidades
ipcMain.handle('save-follow-up', async (event, followUpData, companyName) => {
  sendLog(`[MAIN] Guardando seguimiento de incapacidad para empresa: ${companyName}`, 'INFO');

  try {
    // Obtener la ruta del archivo de ausentismo
    const filePath = await obtenerRutaAusentismo(companyName);
    sendLog(`[MAIN] Archivo de ausentismo encontrado: ${filePath}`, 'INFO');

    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    // Convertir followUpData en string seguro para pasar a Python
    const followUpDataJson = JSON.stringify(followUpData);

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'guardar_seguimiento',
        companyName,    // ARG 1
        filePath,       // ARG 2
        followUpDataJson // ARG 3
      ], {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let buffer = '';

      python.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(line => {
          line = line.trim();
          if (!line) return;

          try {
            const obj = JSON.parse(line);
            if (obj.type === 'log') {
              sendLog(`[Python Seguimiento] ${obj.message}`, 'INFO');
            } else if (obj.type === 'result') {
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Seguimiento - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      python.stderr.on('data', (data) => {
        sendLog(`[Python Seguimiento - STDERR] ${data.toString()}`, 'ERROR');
      });

      python.on('close', (code) => {
        if (buffer?.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch { /* Ignorar errores menores */ }
        }
        resolve({ success: false, error: 'Proceso cerrado sin resultado.' });
      });

      python.on('error', (err) => {
        sendLog(`Error al iniciar Python para guardar seguimiento: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    sendLog(`[ERROR] Falló save-follow-up: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para exportar datos de incapacidades
ipcMain.handle('export-incapacity-data', async (event, companyName) => {
  sendLog(`[MAIN] Exportando datos de incapacidades para empresa: ${companyName}`, 'INFO');

  try {
    // Obtener la ruta del archivo de ausentismo
    const filePath = await obtenerRutaAusentismo(companyName);
    sendLog(`[MAIN] Archivo de origen: ${filePath}`, 'INFO');

    // Crear una ruta para el archivo exportado
    const exportDir = path.join(app.getPath('downloads'), 'Exportados_Incapacidades');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('_')[0];
    const exportFileName = `incapacidades_${companyName}_${timestamp}.xlsx`;
    const exportPath = path.join(exportDir, exportFileName);

    // Copiar el archivo original al directorio de exportación
    fs.copyFileSync(filePath, exportPath);

    sendLog(`[MAIN] Datos exportados exitosamente a: ${exportPath}`, 'INFO');

    return {
      success: true,
      path: exportPath,
      message: `Datos exportados exitosamente a: ${exportPath}`
    };

  } catch (error) {
    sendLog(`[ERROR] Falló export-incapacity-data: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para obtener historial de seguimientos de una incapacidad
ipcMain.handle('get-follow-up-history', async (event, caseId, companyName) => {
  sendLog(`[MAIN] Obteniendo historial de seguimientos para caso: ${caseId}, empresa: ${companyName}`, 'INFO');

  try {
    // Obtener la ruta del archivo de ausentismo
    const filePath = await obtenerRutaAusentismo(companyName);
    sendLog(`[MAIN] Buscando historial en archivo: ${filePath}`, 'INFO');

    // En este ejemplo simple, creamos datos de historial simulados
    // En una implementación real, esto leería del archivo de datos
    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    const params = {
      caseId,
      filePath
    };

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'obtener_historial',
        companyName,
        caseId,
        filePath
      ], {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let buffer = '';

      python.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach(line => {
          line = line.trim();
          if (!line) return;

          try {
            const obj = JSON.parse(line);
            if (obj.type === 'log') {
              sendLog(`[Python Historial] ${obj.message}`, 'INFO');
            } else if (obj.type === 'result') {
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Historial - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      python.stderr.on('data', (data) => {
        sendLog(`[Python Historial - STDERR] ${data.toString()}`, 'ERROR');
      });

      python.on('close', (code) => {
        if (buffer?.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch { /* Ignorar errores menores */ }
        }
        // Si no hay resultado del proceso Python, devolver un historial vacío
        resolve({
          success: true,
          followUps: []
        });
      });

      python.on('error', (err) => {
        sendLog(`Error al iniciar Python para obtener historial: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    sendLog(`[ERROR] Falló get-follow-up-history: ${error.message}`, 'ERROR');
    return { success: false, error: error.message, followUps: [] };
  }
});

// Manejador para cargar datos de seguimientos desde el archivo externo

ipcMain.handle('load-follow-up-data', async (event, companyName) => {

  sendLog(`[MAIN][DEBUG] El handler 'load-follow-up-data' ha sido invocado para la empresa: ${companyName}.`);

  sendLog(`[MAIN] Cargando datos de seguimientos para empresa: ${companyName}`, 'INFO');



  try {

    // Ruta al archivo de seguimientos

    const seguimientoFilePath = path.join(app.getPath('documents'), 'Seguimiento Casos Medicos.xlsx');

    sendLog(`[MAIN] Archivo de seguimientos buscado en: ${seguimientoFilePath}`, 'INFO');



    // Verificar si existe en la ruta predeterminada, si no, probar ruta en Google Drive

    let filePathToUse = seguimientoFilePath;

    if (!fs.existsSync(seguimientoFilePath)) {

      const googleDrivePath = "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\Seguimiento Casos Medicos.xlsx";

      if (fs.existsSync(googleDrivePath)) {

        filePathToUse = googleDrivePath;

        sendLog(`[MAIN] Usando ruta de Google Drive: ${filePathToUse}`, 'INFO');

      } else {

        sendLog(`[MAIN] Archivo de seguimientos no encontrado en ninguna ubicación`, 'WARN');

        return { success: true, followUps: {}, message: 'Archivo de seguimientos no encontrado' };

      }

    }



    // Usar pandas para leer el archivo de seguimientos

    const { spawn } = require('child_process');

    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');

    const pythonPath = await getPython();



    return new Promise((resolve, reject) => {

      const python = spawn(pythonPath, [

        scriptPath,

        'cargar_seguimientos',

        companyName,

        filePathToUse

      ], {

        cwd: path.dirname(scriptPath),

        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }

      });



      let buffer = '';



      python.stdout.on('data', (data) => {

        buffer += data.toString();

        const lines = buffer.split('\n');

        buffer = lines.pop();

        lines.forEach(line => {

          line = line.trim();

          if (!line) return;



          try {

            const obj = JSON.parse(line);

            if (obj.type === 'log') {

              sendLog(`[Python Carga Seguimientos] ${obj.message}`, 'INFO');

            } else if (obj.type === 'result') {

              resolve(obj.payload);

            }

          } catch (e) {

            sendLog(`[Python Carga Seguimientos - RAW] ${line}`, 'DEBUG');

          }

        });

      });



      python.stderr.on('data', (data) => {

        sendLog(`[Python Carga Seguimientos - STDERR] ${data.toString()}`, 'ERROR');

      });



      python.on('close', (code) => {

        if (buffer?.trim()) {

          try {

            const last = JSON.parse(buffer.trim());

            if (last.type === 'result') return resolve(last.payload);

          } catch { /* Ignorar errores menores */ }

        }

        // Si no hay resultado del proceso Python, devolver un objeto vacío

        resolve({

          success: true,

          followUps: {}

        });

      });



      python.on('error', (err) => {

        sendLog(`Error al iniciar Python para cargar seguimientos: ${err.message}`, 'CRITICAL');

        reject(err);

      });

    });



  } catch (error) {

    sendLog(`[ERROR] Falló load-follow-up-data: ${error.message}`, 'ERROR');

    return { success: false, error: error.message, followUps: {} };

  }

});



// --- Manejador para guardar HTML de depuración ---

ipcMain.handle('save-debug-html', async (event, htmlContent) => {

  try {

    const tempDir = app.getPath('temp');

    const filePath = path.join(tempDir, 'debug_pdf_content.html');

    await fsp.writeFile(filePath, htmlContent, 'utf8');

    sendLog(`[DEBUG] HTML de depuración guardado en: ${filePath}`, 'INFO');

    return { success: true, path: filePath };

  } catch (error) {

    sendLog(`[ERROR] No se pudo guardar el HTML de depuración: ${error.message}`, 'ERROR');

    return { success: false, error: error.message };

  }

});



// --- Manejador para generar acta de COPASST ---
ipcMain.handle('generate-copasst-acta', async (event, changes, savePath = null) => {
  sendLog(`[MAIN][generate-copasst-acta] Handler invocado con ${changes.length} cambios`, 'INFO');

  try {
    // Validar que los cambios se hayan enviado correctamente
    if (!Array.isArray(changes)) {
      throw new Error('El parámetro "changes" debe ser un array de cambios para aplicar al Excel.');
    }

    // Obtener la ruta de Python
    const pythonPath = await getPython();
    sendLog(`[MAIN][generate-copasst-acta] Usando Python de: ${pythonPath}`, 'DEBUG');

    // Definir rutas necesarias
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'copasst_acta_generator.py');
    const tempDir = app.getPath('temp'); // Directorio temporal del sistema
    const tempJsonPath = path.join(tempDir, `temp_acta_data_${Date.now()}.json`);

    // Determinar la ruta de salida basada en si se proporcionó savePath
    let outputPath;
    if (savePath) {
      outputPath = savePath;
    } else {
      const outputDir = path.join(app.getPath('documents'), 'SG-SST', 'Actas_COPASST');
      // Asegurar que el directorio de salida exista
      if (!fs.existsSync(outputDir)) {
        await fsp.mkdir(outputDir, { recursive: true });
        sendLog(`[MAIN][generate-copasst-acta] Directorio de salida creado: ${outputDir}`, 'INFO');
      }

      // Definir nombre de archivo con timestamp
      const fileName = `ACTA_COPASST_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`;
      outputPath = path.join(outputDir, fileName);
    }

    // Guardar los datos temporales en un archivo JSON
    const tempData = {
      changes: changes,
      timestamp: new Date().toISOString()
    };

    await fsp.writeFile(tempJsonPath, JSON.stringify(tempData, null, 2), 'utf8');
    sendLog(`[MAIN][generate-copasst-acta] Datos temporales guardados en: ${tempJsonPath}`, 'DEBUG');

    // Ejecutar el script Python
    const { stdout, stderr } = await execFilePromise(pythonPath, [scriptPath, tempJsonPath, outputPath]);

    // Verificar el resultado del script
    if (stderr) {
      sendLog(`[MAIN][generate-copasst-acta] Python stderr: ${stderr}`, 'WARN');
    }

    sendLog(`[MAIN][generate-copasst-acta] stdout del script Python: ${stdout}`, 'DEBUG');

    // Verificar que el archivo de salida haya sido creado
    if (!fs.existsSync(outputPath)) {
      throw new Error(`El archivo de salida no se creó correctamente en: ${outputPath}`);
    }

    sendLog(`[MAIN][generate-copasst-acta] Acta generada exitosamente en: ${outputPath}`, 'INFO');

    // Limpiar el archivo temporal
    try {
      await fsp.unlink(tempJsonPath);
      sendLog(`[MAIN][generate-copasst-acta] Archivo temporal eliminado: ${tempJsonPath}`, 'INFO');
    } catch (cleanupError) {
      sendLog(`[MAIN][generate-copasst-acta] Error al eliminar archivo temporal: ${cleanupError.message}`, 'WARN');
    }

    return {
      success: true,
      documentPath: outputPath,
      message: 'Acta de COPASST generada exitosamente'
    };

  } catch (error) {
    sendLog(`[MAIN][generate-copasst-acta] Error: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
});

// --- Manejador para generar acta de Comité de Convivencia ---
ipcMain.handle('generate-convivencia-acta', async (event, changes, savePath = null) => {
  sendLog(`[MAIN][generate-convivencia-acta] Handler invocado con ${changes.length} cambios`, 'INFO');

  try {
    // Validar que los cambios se hayan enviado correctamente
    if (!Array.isArray(changes)) {
      throw new Error('El parámetro "changes" debe ser un array de cambios para aplicar al Excel.');
    }

    // Obtener la ruta de Python
    const pythonPath = await getPython();
    sendLog(`[MAIN][generate-convivencia-acta] Usando Python de: ${pythonPath}`, 'DEBUG');

    // Definir rutas necesarias
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'comite_convivencia_acta_generator.py');
    const tempDir = app.getPath('temp'); // Directorio temporal del sistema
    const tempJsonPath = path.join(tempDir, `temp_convivencia_acta_changes_${Date.now()}.json`);

    // Determinar la ruta de salida basada en si se proporcionó savePath
    let outputPath;
    if (savePath) {
      outputPath = savePath;
    } else {
      const outputDir = path.join(app.getPath('documents'), 'SG-SST', 'Actas_Convivencia');
      // Asegurar que el directorio de salida exista
      if (!fs.existsSync(outputDir)) {
        await fsp.mkdir(outputDir, { recursive: true });
        sendLog(`[MAIN][generate-convivencia-acta] Directorio de salida creado: ${outputDir}`, 'INFO');
      }

      // Definir nombre de archivo con timestamp
      const fileName = `ACTA_CONVIVENCIA_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`;
      outputPath = path.join(outputDir, fileName);
    }

    // Guardar los datos temporales en un archivo JSON
    const tempData = {
      changes: changes,
      timestamp: new Date().toISOString()
    };

    await fsp.writeFile(tempJsonPath, JSON.stringify(tempData, null, 2), 'utf8');
    sendLog(`[MAIN][generate-convivencia-acta] Datos temporales guardados en: ${tempJsonPath}`, 'DEBUG');

    // Ejecutar el script Python
    const { stdout, stderr } = await execFilePromise(pythonPath, [scriptPath, tempJsonPath, outputPath]);

    // Verificar el resultado del script
    if (stderr) {
      sendLog(`[MAIN][generate-convivencia-acta] Python stderr: ${stderr}`, 'WARN');
    }

    sendLog(`[MAIN][generate-convivencia-acta] stdout del script Python: ${stdout}`, 'DEBUG');

    // Verificar que el archivo de salida haya sido creado
    if (!fs.existsSync(outputPath)) {
      throw new Error(`El archivo de salida no se creó correctamente en: ${outputPath}`);
    }

    sendLog(`[MAIN][generate-convivencia-acta] Acta generada exitosamente en: ${outputPath}`, 'INFO');

    // Limpiar el archivo temporal
    try {
      await fsp.unlink(tempJsonPath);
      sendLog(`[MAIN][generate-convivencia-acta] Archivo temporal eliminado: ${tempJsonPath}`, 'INFO');
    } catch (cleanupError) {
      sendLog(`[MAIN][generate-convivencia-acta] Error al eliminar archivo temporal: ${cleanupError.message}`, 'WARN');
    }

    return {
      success: true,
      documentPath: outputPath,
      message: 'Acta de Comité de Convivencia generada exitosamente'
    };

  } catch (error) {
    sendLog(`[MAIN][generate-convivencia-acta] Error: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
});

// --- Manejador para reiniciar la aplicación ---

ipcMain.on('restart_app', () => {
  log.info('El usuario ha aceptado la actualización. Reiniciando para instalar...');

  autoUpdater.quitAndInstall();

});