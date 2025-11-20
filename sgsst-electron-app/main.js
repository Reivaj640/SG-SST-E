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
ipcMain.handle('init-excel', async (event, filePath) => {
  try {
    sendLog(`[MAIN] Inicializando archivo Excel desde: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    await fsp.access(filePath);

    // Leer el archivo Excel usando exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Obtener la primera hoja
    const worksheet = workbook.getWorksheet(1);

    let processedData = [];
    let headers = [];
    let formulaCells = [];

    // Leer todas las filas y extraer datos
    worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell((cell, colNumber) => {
        rowData.push({
          value: cell.value,
          formula: cell.formula ? cell.formula : undefined,
          type: cell.type,
          address: cell.address
        });

        // Si es una fórmula, almacenarla para seguimiento
        if (cell.formula) {
          formulaCells.push({
            address: cell.address,
            formula: cell.formula,
            result: cell.value
          });
        }
      });

      if (rowNumber === 1) {
        // Suponemos que la primera fila son los encabezados
        headers = rowData.map(cell => cell.value);
      }

      processedData.push(rowData);
    });

    sendLog(`[MAIN] Archivo Excel procesado exitosamente. Filas: ${processedData.length}`, 'INFO');

    return {
      success: true,
      data: {
        processedData,
        headers,
        formulaCells
      }
    };
  } catch (error) {
    sendLog(`[MAIN] Error al inicializar el archivo Excel: ${error.message}`, 'ERROR');
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

// Manejar la creación de la ventana principal
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

// --- Manejador para reiniciar la aplicación ---
ipcMain.on('restart_app', () => {
  log.info('El usuario ha aceptado la actualización. Reiniciando para instalar...');
  autoUpdater.quitAndInstall();
});