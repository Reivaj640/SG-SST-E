// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const fs = require('fs');           // Para operaciones síncronas
const fsSync = require('fs');       // Para operaciones síncronas
const { exec, spawn, execFile } = require('child_process'); // Asegúrate de incluir execFile
const { promisify } = require('util');
const xlsx = require('xlsx');
const os = require('os');
// TEMPORAL: Comentado para pruebas de OnlyOffice Bridge
// const { autoUpdater } = require('electron-updater');
const autoUpdater = null; // Placeholder
const log = require('electron-log');
const ExcelJS = require('exceljs');

// Importar handlers de investigación de accidentes
require('./modules/gestion-salud/investigacion-accidentes/investigacion_handlers.js');

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
// autoUpdater.logger = log; // TEMPORAL: Comentado
// ------------------------------------

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// --- Detección robusta de Python ---
// EXPONER A GLOBAL PARA QUE LOS HANDLERS PUEDAN USARLO
global.cachedPythonPath = null;

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
    console.log('[DEBUG] Current global.cachedPythonPath:', global.cachedPythonPath);
    if (global.cachedPythonPath && fs.existsSync(global.cachedPythonPath)) {
        console.log('[DEBUG] Using cached Python path:', global.cachedPythonPath);
        return global.cachedPythonPath;
    }
    global.cachedPythonPath = await findPython();
    console.log('[DEBUG] New Python path cached:', global.cachedPythonPath);
    return global.cachedPythonPath;
}

let mainWindow;
let isWindowCreated = false; // Variable para rastrear si la ventana ya ha sido creada

// --- Función de Logging Centralizada ---
function sendLog(message, level = 'INFO') {
  console.log(`[${level}] ${message}`); // Log to main process console
  if (mainWindow && !mainWindow.isDestroyed()) {
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
  // Verificar si la ventana ya ha sido creada o si mainWindow existe y no está destruida
  if (isWindowCreated && mainWindow && !mainWindow.isDestroyed()) {
    console.log('[MAIN] La ventana ya existe, trayéndola al frente...');
    mainWindow.focus();
    return;
  }
  
  console.log('[MAIN] Creando ventana principal...');
  isWindowCreated = true;
  
  mainWindow = new BrowserWindow({
    width: 1024, // Ancho inicial 1200 para mejor visualización
    height: 900, // Alto inicial 900 para mejor visualización
    minWidth: 900,
    minHeight: 800,
    icon: path.join(__dirname, 'assets', 'KIAR256.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Habilitar webviews para OnlyOffice
    },
  });

  // Manejar el evento de cierre para resetear el flag
  mainWindow.on('closed', () => {
    console.log('[MAIN] Ventana principal cerrada, reseteando isWindowCreated...');
    mainWindow = null;
    isWindowCreated = false;
  });

  // Cargar el archivo HTML principal
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Abrir DevTools en modo desarrollo
  // mainWindow.webContents.openDevTools();
};

// Función auxiliar para búsqueda recursiva de archivos en el sistema de archivos
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

// Función para buscar rutas en la estructura mapeada
function searchInStructure(node, searchTerm) {
  // Si el nombre del nodo contiene el término de búsqueda
  if (node.name) {
    // Si el término parece un código (ej. "2.4.1"), buscar coincidencia exacta al inicio
    // Esto evita que "2.4.1" coincida con "4.2.4.1"
    const isCode = /^[0-9.]+$/.test(searchTerm);

    if (isCode) {
      // Verificar si empieza con el código seguido de un espacio o punto, o es igual
      // Ej: "2.4.1 " o "2.4.1." o "2.4.1"
      if (node.name.startsWith(searchTerm + ' ') ||
          node.name.startsWith(searchTerm + '.') ||
          node.name === searchTerm) {
        return node.path;
      }
    } else {
      // Búsqueda laxa para nombres normales
      if (node.name.includes(searchTerm)) {
        return node.path;
      }
    }
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
    console.log('========================================');
    console.log('[CONFIG][MAIN] save-config llamado');
    console.log(`[CONFIG][MAIN] Ruta de configuración: ${configPath}`);
    
    // Verificar estructura de companyPaths
    if (config.companyPaths) {
      console.log('[CONFIG][MAIN] companyPaths encontradas:');
      for (const [companyName, companyData] of Object.entries(config.companyPaths)) {
        console.log(`  - ${companyName}:`, {
          hasRoot: !!companyData.root,
          hasStructure: !!companyData.structure,
          hasStructureStructure: !!(companyData.structure?.structure),
          root: companyData.root
        });
      }
    } else {
      console.warn('[CONFIG][MAIN] companyPaths no encontrada en config');
    }
    
    console.log('[CONFIG][MAIN] Escribiendo archivo de configuración...');
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('[CONFIG][MAIN] Config saved successfully');
    console.log('========================================');
    return { success: true };
  } catch (error) {
    console.error('[CONFIG][MAIN][ERROR] Error saving config:', error);
    console.error('[CONFIG][MAIN][ERROR] Stack:', error.stack);
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

// Manejar la obtención de la ruta de la aplicación
ipcMain.handle('get-app-path', async () => {
  try {
    console.log('Handling get-app-path request');
    return app.getAppPath();
  } catch (error) {
    console.error('Error getting app path:', error);
    return __dirname; // Valor por defecto en caso de error
  }
});

// ===============================
// 🎨 SISTEMA DE TEMAS (Claro/Oscuro/Sistema)
// ===============================

// Obtener el tema actual del sistema operativo
ipcMain.handle('get-system-theme', async () => {
  try {
    const isDark = nativeTheme.shouldUseDarkColors;
    return { success: true, theme: isDark ? 'dark' : 'light' };
  } catch (error) {
    console.error('Error getting system theme:', error);
    return { success: false, error: error.message, theme: 'light' };
  }
});

// Guardar preferencia de tema del usuario
ipcMain.handle('save-theme-preference', async (event, themeMode) => {
  try {
    const config = await (async () => {
      try {
        const data = await fsp.readFile(configPath, 'utf8');
        return JSON.parse(data);
      } catch {
        return {};
      }
    })();
    
    if (!config.uiSettings) config.uiSettings = {};
    config.uiSettings.theme = themeMode;
    
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`[MAIN] Tema guardado: ${themeMode}`);
    
    return { success: true, theme: themeMode };
  } catch (error) {
    console.error('Error saving theme preference:', error);
    return { success: false, error: error.message };
  }
});

// Obtener preferencia de tema guardada
ipcMain.handle('get-theme-preference', async () => {
  try {
    const data = await fsp.readFile(configPath, 'utf8');
    const config = JSON.parse(data);
    const savedTheme = config.uiSettings?.theme || 'system';
    return { success: true, theme: savedTheme };
  } catch (error) {
    return { success: true, theme: 'system' };
  }
});

// Aplicar tema efectivo (resuelve 'system' a 'light' o 'dark')
ipcMain.handle('get-effective-theme', async () => {
  try {
    const data = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(data);
    const savedTheme = config.uiSettings?.theme || 'system';
    
    if (savedTheme === 'system') {
      const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      return { success: true, theme: systemTheme, source: 'system' };
    }
    
    return { success: true, theme: savedTheme, source: 'user' };
  } catch (error) {
    return { success: true, theme: 'light', source: 'default' };
  }
});

// Notificar a todas las ventanas cuando cambia el tema del sistema
nativeTheme.on('updated', () => {
  const systemTheme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  console.log(`[MAIN] Tema del sistema cambiado a: ${systemTheme}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system-theme-changed', systemTheme);
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
    console.log('========================================');
    console.log('[MAPEO][MAIN] Handler map-directory llamado');
    console.log(`[MAPEO][MAIN] Directorio a mapear: ${directoryPath}`);
    console.log(`[MAPEO][MAIN] Verificando existencia del directorio...`);
    
    if (!fs.existsSync(directoryPath)) {
      const errorMsg = `El directorio no existe: ${directoryPath}`;
      console.error(`[MAPEO][MAIN][ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg, log: errorMsg };
    }
    console.log(`[MAPEO][MAIN] Directorio existe: ✅`);
    
    const pythonPath = await getPython();
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'map_directory.py');

    console.log(`[MAPEO][MAIN] Python path: ${pythonPath}`);
    console.log(`[MAPEO][MAIN] Script path: ${pythonScriptPath}`);
    console.log(`[MAPEO][MAIN] Ejecutando: ${pythonPath} "${pythonScriptPath}" "${directoryPath}"`);

    const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, directoryPath], { 
      cwd: path.dirname(pythonScriptPath),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    console.log(`[MAPEO][MAIN] stdout recibido (${stdout.length} bytes)`);
    console.log(`[MAPEO][MAIN] stderr: ${stderr || '(vacío)'}`);
    
    // Parsear el JSON de salida
    let structure;
    try {
      structure = JSON.parse(stdout);
      console.log(`[MAPEO][MAIN] JSON parseado exitosamente`);
      console.log(`[MAPEO][MAIN] Estructura keys: ${Object.keys(structure).join(', ')}`);
      console.log(`[MAPEO][MAIN] structure.structure existe: ${!!structure.structure}`);
      
      if (structure.structure) {
        console.log(`[MAPEO][MAIN] structure.structure keys: ${Object.keys(structure.structure).join(', ')}`);
        console.log(`[MAPEO][MAIN] Total archivos: ${structure.total_files}`);
        console.log(`[MAPEO][MAIN] Total carpetas: ${structure.total_folders}`);
      }
    } catch (parseError) {
      console.error(`[MAPEO][MAIN][ERROR] Error parseando JSON:`, parseError);
      console.error(`[MAPEO][MAIN][ERROR] stdout raw (primeros 500 chars):`, stdout.substring(0, 500));
      throw new Error(`Error parseando JSON: ${parseError.message}`);
    }

    console.log('[MAPEO][MAIN] Mapeo completado exitosamente');
    console.log('========================================');

    return { 
      success: true, 
      structure: structure, 
      log: stderr || 'Mapeo completado sin errores.' 
    };
  } catch (error) {
    console.error('========================================');
    console.error('[MAPEO][MAIN][ERROR] Error mapping directory:', error);
    console.error('[MAPEO][MAIN][ERROR] Stack:', error.stack);
    console.error('========================================');
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

// Manejar construcción de ruta de archivo
ipcMain.handle('get-file-path', async (event, { directory, fileName }) => {
  try {
    // Validar entradas
    if (!directory || !fileName) {
      throw new Error('Directorio o nombre de archivo no proporcionados');
    }

    // Construir la ruta
    const filePath = path.join(directory, fileName);
    console.log('[MAIN] Construyendo ruta de archivo:', filePath);

    // Verificar si existe (opcional, pero útil)
    if (fs.existsSync(filePath)) {
      return { success: true, path: filePath, exists: true };
    } else {
      console.warn('[MAIN] El archivo construido no existe:', filePath);
      return { success: true, path: filePath, exists: false };
    }
  } catch (error) {
    console.error('[MAIN] Error en get-file-path:', error);
    return { success: false, error: error.message };
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

// Handler para procesar datos del archivo Excel del plan de trabajo
ipcMain.handle('process-excel-data', async (event, { buffer, company, period }) => {
  try {
    sendLog(`[MAIN] Procesando datos del archivo Excel para la empresa: ${company} y periodo: ${period}`, 'INFO');

    if (!buffer || buffer.length === 0) {
      throw new Error('No se proporcionó un buffer de archivo Excel válido');
    }

    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Leer como matriz de arrays (más fácil para buscar encabezados)
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    sendLog(`[MAIN] Datos crudos extraídos: ${rawData.length} filas`, 'INFO');

    // --- DEBUG: IMPRIMIR LAS PRIMERAS 10 FILAS PARA VER LA ESTRUCTURA ---
    sendLog(`[MAIN][DEBUG] --- INICIO ESTRUCTURA DEL ARCHIVO (Primeras 10 filas) ---`, 'DEBUG');
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        sendLog(`[MAIN][DEBUG] Fila ${i}: ${JSON.stringify(rawData[i])}`, 'DEBUG');
    }
    sendLog(`[MAIN][DEBUG] --- FIN ESTRUCTURA DEL ARCHIVO ---`, 'DEBUG');

    // --- 1. BUSCAR LA FILA DE ENCABEZADOS ---
    let headerRowIndex = -1;
    let columnMap = {}; // { 'actividad': index, 'enero': index, ... }

    // Palabras clave para identificar columnas (normalizadas)
    const keywords = {
        'actividad': ['actividad', 'actividades', 'descripcion', 'tema', 'nombre actividad', 'item'],
        'responsable': ['responsable', 'cargo', 'quien', 'asignado'],
        'meses': ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'set', 'oct', 'nov', 'dic', 'enero']
    };

    // Función normalizadora
    const normalize = (str) => {
        if (!str) return "";
        return str.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Buscar en las primeras 20 filas
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        // Contar coincidencias en esta fila
        let matches = 0;
        let monthMatches = 0;
        let actOrRespFound = false;
        let foundKeywords = [];

        row.forEach(cell => {
            const val = normalize(cell);
            // Búsqueda más estricta para actividad/responsable para evitar falsos positivos como "Act. Prog."
            if (keywords.actividad.some(k => val === k || val.startsWith(k + ' ') || val.includes(' ' + k))) {
                matches++;
                actOrRespFound = true;
                foundKeywords.push('actividad');
            }
            if (keywords.responsable.some(k => val === k || val.startsWith(k + ' ') || val.includes(' ' + k))) {
                matches++;
                actOrRespFound = true;
                foundKeywords.push('responsable');
            }

            // Verificación de meses (muy importante para confirmar que es la cabecera del cronograma)
            if (keywords.meses.some(k => val === k)) {
                monthMatches++;
                foundKeywords.push('mes');
            }
        });

        sendLog(`[MAIN][DEBUG] Escaneando fila ${i}: ${matches} coincidencias clave, ${monthMatches} meses encontrados. (${foundKeywords.join(', ')})`, 'DEBUG');

        // CRITERIO REFORZADO:
        // 1. Debe haber encontrado al menos una palabra clave de actividad/responsable Y al menos 2 meses.
        // 2. O si encontramos muchos meses (>= 6) aunque la palabra 'actividad' sea sutil.
        if ((actOrRespFound && monthMatches >= 2) || monthMatches >= 6) {
            headerRowIndex = i;
            sendLog(`[MAIN] Encabezados encontrados en la fila ${i + 1}`, 'INFO');

            // Mapear índices de columnas basándose en esta fila
            row.forEach((cell, colIndex) => {
                const val = normalize(cell);
                if (keywords.actividad.some(k => val.includes(k))) columnMap['actividad'] = colIndex;
                else if (keywords.responsable.some(k => val.includes(k))) columnMap['responsable'] = colIndex;

                // Mapeo específico de meses (buscando abreviaturas comunes)
                else if (val === 'ene' || val === 'enero') columnMap['enero'] = colIndex;
                else if (val === 'feb' || val === 'febrero') columnMap['febrero'] = colIndex;
                else if (val === 'mar' || val === 'marzo') columnMap['marzo'] = colIndex;
                else if (val === 'abr' || val === 'abril') columnMap['abril'] = colIndex;
                else if (val === 'may' || val === 'mayo') columnMap['mayo'] = colIndex;
                else if (val === 'jun' || val === 'junio') columnMap['junio'] = colIndex;
                else if (val === 'jul' || val === 'julio') columnMap['julio'] = colIndex;
                else if (val === 'ago' || val === 'agosto') columnMap['agosto'] = colIndex;
                else if (val === 'sep' || val === 'set' || val === 'septiembre') columnMap['septiembre'] = colIndex;
                else if (val === 'oct' || val === 'octubre') columnMap['octubre'] = colIndex;
                else if (val === 'nov' || val === 'noviembre') columnMap['noviembre'] = colIndex;
                else if (val === 'dic' || val === 'diciembre') columnMap['diciembre'] = colIndex;

                else if (['observaciones', 'notas', 'comentarios'].some(k => val.includes(k))) columnMap['observaciones'] = colIndex;
            });
            break;
        }
    }

    if (headerRowIndex === -1) {
        sendLog(`[MAIN][WARN] No se encontró fila de encabezados clara. Intentando usar primera fila como fallback.`, 'WARN');
        headerRowIndex = 0;
        // Fallback: Mapeo por posición estándar si falla la detección
        columnMap = {
            'actividad': 1, // Columna B
            'responsable': 6, // Columna G
            'enero': 7, 'febrero': 8, 'marzo': 9, 'abril': 10, 'mayo': 11, 'junio': 12,
            'julio': 13, 'agosto': 14, 'septiembre': 15, 'octubre': 16, 'noviembre': 17, 'diciembre': 18,
            'observaciones': 19
        };
    }

    sendLog(`[MAIN] Mapeo de columnas final: ${JSON.stringify(columnMap)}`, 'DEBUG');

    const processedData = {};
    const parentTitles = [
        'MEDICINA PREVENTIVA Y DEL TRABAJO',
        'SEGURIDAD INDUSTRIAL',
        'HIGIENE INDUSTRIAL',
        'VERIFICACION Y MEJORAMIENTO',
        'VERIFICACIÓN Y MEJORAMIENTO'
    ];
    const phvaTitles = ['PLANEAR', 'HACER', 'VERIFICAR', 'ACTUAR'];

    for (let year = 2024; year <= 2026; year++) {
      processedData[year] = [];
      if (year == period) {
        let rowsProcessed = 0;
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            const actividad = String(row[columnMap['actividad']] || '').trim();

            if (actividad.length > 0) {
                // Determinar nivel jerárquico
                let level = 4;
                let type = 'activity';
                const colA = String(row[0] || '').trim();
                const normalizedAct = actividad.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // 1. Títulos Padre (Nivel 1)
                if (parentTitles.some(t => normalizedAct.includes(t.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))) {
                    level = 1;
                    type = 'header';
                }
                // 2. PHVA (Nivel 3)
                else if (phvaTitles.includes(normalizedAct)) {
                    level = 3;
                    type = 'subtitle';
                }
                // 3. Actividades (Nivel 4 - Tienen número en Col A)
                else if (colA !== '' && !isNaN(parseFloat(colA.replace(',', '.')))) {
                    level = 4;
                    type = 'activity';
                }
                // 4. Títulos Hijos (Nivel 2)
                else {
                    level = 2;
                    type = 'header';
                }

                const activity = {
                  id: i + 1,
                  name: actividad,
                  level: level,
                  type: type,
                  expanded: true,
                  responsible: row[columnMap['responsable']] || 'Profesional SST',
                  months: [
                    row[columnMap['enero']] || '',
                    row[columnMap['febrero']] || '',
                    row[columnMap['marzo']] || '',
                    row[columnMap['abril']] || '',
                    row[columnMap['mayo']] || '',
                    row[columnMap['junio']] || '',
                    row[columnMap['julio']] || '',
                    row[columnMap['agosto']] || '',
                    row[columnMap['septiembre']] || '',
                    row[columnMap['octubre']] || '',
                    row[columnMap['noviembre']] || '',
                    row[columnMap['diciembre']] || ''
                  ],
                  observations: row[columnMap['observaciones']] || ''
                };
                processedData[year].push(activity);
                rowsProcessed++;
            }
        }
      }
    }

    sendLog(`[INFO] [MAIN] Datos procesados: ${processedData[period].length} filas con jerarquía detectadas.`, 'INFO');
    return { success: true, data: processedData };
  } catch (error) {
    sendLog(`[MAIN] Error al procesar datos del Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message, data: null };
  }
});

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
ipcMain.handle('update-capacitaciones-excel', async (event, { filePath, capacitacionesData, sheetName: requestedSheetName, clearBeforeSave = true, startRow = 7 }) => {
  try {
    sendLog(`[MAIN] Actualizando archivo de capacitaciones: ${filePath}`, 'INFO');
    if (requestedSheetName) {
      sendLog(`[MAIN] Hoja de destino explícita: ${requestedSheetName}`, 'INFO');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    let sheetName = requestedSheetName;
    let worksheet = sheetName ? workbook.getWorksheet(sheetName) : null;

    // Añadir búsqueda tolerante por si hay discrepancias entre librerías (xlsx vs exceljs)
    if (!worksheet && sheetName) {
        const tolerantSheet = workbook.worksheets.find(ws => ws.name.trim() === sheetName.trim());
        if (tolerantSheet) {
            worksheet = tolerantSheet;
            sendLog(`[WARN] Se encontró la hoja '${sheetName}' con una búsqueda tolerante (sin espacios extra).`, 'WARN');
        }
    }

    if (!worksheet) {
        if(sheetName) sendLog(`[WARN] La hoja solicitada '${sheetName}' sigue sin encontrarse. Buscando una alternativa por año.`, 'WARN');
        const currentYear = new Date().getFullYear().toString();
        const matrixPatternCurrent = new RegExp(`Matriz Cap\\.\\s*${currentYear}`, 'i');

        const foundSheet = workbook.worksheets.find(ws => matrixPatternCurrent.test(ws.name));

        if (foundSheet) {
            worksheet = foundSheet;
            sheetName = worksheet.name;
            sendLog(`[INFO] Alternativa encontrada por año actual: '${sheetName}'`, 'INFO');
        } else if (workbook.worksheets.length > 0) {
            worksheet = workbook.worksheets[0];
            sheetName = worksheet.name;
            sendLog(`[WARN] No se encontró hoja por año. Usando la primera hoja disponible como fallback: '${sheetName}'`, 'WARN');
        }
    }

    if (!worksheet) {
      throw new Error(`No se pudo encontrar ninguna hoja de trabajo válida para escribir en el archivo.`);
    }

    // --- LÓGICA CLAVE PARA EVITAR DUPLICADOS ---
    // Si se solicita limpiar, borramos todas las filas desde startRow hasta el final
    if (clearBeforeSave) {
        const lastRowNumber = worksheet.rowCount;
        // Borra las filas en orden inverso para no afectar los índices
        for (let i = lastRowNumber; i >= startRow; i--) {
            const row = worksheet.getRow(i);
            const cellB = row.getCell(2).value;
            // No borrar la fila de "Total capacitaciones programadas" ni las filas después de ella
            if (cellB && typeof cellB === 'string' && cellB.includes('Total capacitaciones programadas')) {
                // Encontramos la fila de total, dejar de borrar desde aquí hacia abajo
                break;
            }
            // Eliminar la fila si está dentro del rango de datos
            worksheet.spliceRows(i, 1);
        }
        sendLog(`[MAIN] Limpiadas filas desde la fila ${startRow} hasta antes de 'Total capacitaciones programadas'.`, 'INFO');
    } else {
        // Si no se limpia, encontrar la fila de "Total capacitaciones programadas" y limpiar solo hasta allí
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
        if (endCleanRow !== -1) {
            for (let i = startRow; i <= endCleanRow; i++) {
                const row = worksheet.getRow(i);
                row.values = [];
            }
        }
    }

    // Filtrar datos inválidos antes de procesarlos
    const validCapacitaciones = capacitacionesData.filter(cap => {
      return cap &&
             typeof cap === 'object' &&
             cap.nombre !== undefined &&
             cap.nombre !== null &&
             cap.nombre !== '' &&
             typeof cap.nombre === 'string';
    });

    // Escribir nuevos datos
    validCapacitaciones.forEach((capacitacion, index) => {
      const rowIndex = startRow + index;
      const row = worksheet.getRow(rowIndex);

      row.getCell(2).value = capacitacion.nombre; // B
      row.getCell(3).value = capacitacion.tipo.toUpperCase(); // C

      // --- CORRECCIÓN CLAVE PARA LA FECHA ---
      if (capacitacion.fechaProgramada && capacitacion.fechaProgramada !== 'No especificada') {
          // Descomponer la fecha para crearla sin ajuste de zona horaria
          const dateParts = capacitacion.fechaProgramada.split('-'); // [YYYY, MM, DD]
          const year = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1; // Los meses en JS son 0-11
          const day = parseInt(dateParts[2]);

          // Crear la fecha en UTC para evitar problemas de zona horaria
          const date = new Date(Date.UTC(year, month, day));

          row.getCell(4).value = date;
      } else {
          row.getCell(4).value = null;
      }

      row.getCell(7).value = capacitacion.instructor; // G
      row.getCell(8).value = parseInt(capacitacion.duracion.replace(' Horas', '')) || 0; // H
      row.getCell(9).value = capacitacion.estado === 'completed' ? 'Ejecutado' : 'Pendiente'; // I

      // Formatear la celda de fecha
      if (row.getCell(4).value) {
        row.getCell(4).numFmt = 'dd/mm/yyyy';
      }
    });

    await workbook.xlsx.writeFile(filePath);
    sendLog(`[MAIN] Archivo de capacitaciones actualizado en hoja '${sheetName}' exitosamente.`, 'INFO');
    return { success: true };

  } catch (error) {
    sendLog(`[MAIN] Error al actualizar el archivo de capacitaciones: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

  // --- Handler para duplicar hoja de capacitaciones (Nuevo Periodo) ---
  ipcMain.handle('duplicate-capacitaciones-sheet', async (event, { filePath, currentSheetName, newYear }) => {
    console.log(`[MAIN] Duplicando hoja de capacitaciones. Archivo: ${filePath}, Origen: ${currentSheetName}, Nuevo Año: ${newYear}`);
    try {
      // Verificar que el archivo exista
      try {
        await fsp.access(filePath);
      } catch (error) {
        return { success: false, error: 'El archivo no existe' };
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sourceSheet = workbook.getWorksheet(currentSheetName);
      if (!sourceSheet) {
        return { success: false, error: `No se encontró la hoja origen: ${currentSheetName}` };
      }

      // Determinar nombre de la nueva hoja
      // Intentar mantener el formato "Matriz Cap. YYYY"
      let newSheetName = `Matriz Cap. ${newYear}`;

      // Si el nombre origen no sigue el patrón estándar, intentar adaptarlo o usar el estándar
      if (!currentSheetName.includes('Matriz Cap.')) {
          // Si tiene el año viejo, reemplazarlo
          const sourceYearMatch = currentSheetName.match(/\d{4}/);
          if (sourceYearMatch) {
              newSheetName = currentSheetName.replace(sourceYearMatch[0], newYear);
          }
      }

      if (workbook.getWorksheet(newSheetName)) {
        return { success: false, error: `La hoja destino ya existe: ${newSheetName}` };
      }

      // Crear la nueva hoja
      const newSheet = workbook.addWorksheet(newSheetName);

      console.log(`[MAIN] Copiando contenido de ${currentSheetName} a ${newSheetName}...`);

      // Copiar configuración de página y vistas
      newSheet.pageSetup = sourceSheet.pageSetup;
      newSheet.views = sourceSheet.views;

      // Copiar columnas (ancho, etc)
      if (sourceSheet.columns) {
          newSheet.columns = sourceSheet.columns.map(col => ({ ...col }));
      }

      // Copiar filas y celdas
      sourceSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const newRow = newSheet.getRow(rowNumber);

        // Copiar altura de fila
        if (row.height) newRow.height = row.height;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const newCell = newRow.getCell(colNumber);
          newCell.value = cell.value;
          newCell.style = JSON.parse(JSON.stringify(cell.style)); // Copia profunda de estilos

          // Clonar datos pero LIMPIAR información de ejecución para el nuevo año
          // Suponiendo que las filas de datos empiezan en la fila 7 (según update-capacitaciones-excel startRow=7)
          if (rowNumber >= 7) {
              // Columna D (4): Fecha Programada -> Limpiar o poner fecha futura tentativa? Mejor limpiar.
              // Columna I (9): Estado -> Resetear a pendiente

              if (colNumber === 4) { // Fecha
                  // newCell.value = 'No especificada'; // O dejar vacío
                  // Si queremos mantener la estructura pero sin fechas viejas:
                  newCell.value = null;
              }
              if (colNumber === 9) { // Estado (columna I)
                  // Resetear visualmente si hay texto
                  if (typeof newCell.value === 'string') {
                      newCell.value = 'Pendiente'; // O valor por defecto
                  }
              }
              // Columna de Ejecutado/Realizado si existe (asumimos lógica genérica de limpieza)
          }
        });
        newRow.commit();
      });

      // Copiar celdas combinadas (Merges)
      // ExcelJS no itera merges fácilmente, hay que acceder a `model` o `_merges` (interno) o iterar.
      // Una forma segura es ver las celdas maestras de los merges.
      // Nota: model.merges devuelve rangos ['A1:B2', ...]
      if (sourceSheet.model && sourceSheet.model.merges) {
          sourceSheet.model.merges.forEach(mergeRange => {
              try {
                  newSheet.mergeCells(mergeRange);
              } catch (e) {
                  console.warn(`[MAIN] No se pudo fusionar celdas ${mergeRange} en nueva hoja: ${e.message}`);
              }
          });
      }

      // Guardar archivo
      await workbook.xlsx.writeFile(filePath);
      console.log(`[MAIN] Hoja duplicada exitosamente: ${newSheetName}`);

      return { success: true, newSheetName };

    } catch (error) {
      console.error('[MAIN] Error crítico al duplicar hoja:', error);
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
    const numericFields = ['asignacion', 'ejecutado_acumulado', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                           'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    // Mantener acumuladores para cálculos de TOTAL AÑO
    const totalAccumulators = {
      asignacion: 0,
      ejecutado_acumulado: 0,
      enero: 0, febrero: 0, marzo: 0, abril: 0, mayo: 0, junio: 0,
      julio: 0, agosto: 0, septiembre: 0, octubre: 0, noviembre: 0, diciembre: 0
    };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      sendLog(`[DEBUG] readPresupuestoData - Procesando fila ${i + dataStartIndex + 1}: ${JSON.stringify(row)}`, 'DEBUG');

      // Verificar si la fila contiene texto especial como "TOTAL AÑO" o "ANALISIS PRESUPUESTAL"
      const firstCell = row[0]; // Primera columna (ID)

      // Verificar también en la columna B en caso de celdas unificadas
      const secondCell = row[1]; // Segunda columna (B) - podría contener "TOTAL AÑO" si la celda A-B está unificada

      // Si encontramos "TOTAL AÑO" en cualquier celda de la fila (A o B), creamos la fila TOTAL AÑO con los totales acumulados
      if ((typeof firstCell === 'string' && firstCell.includes('TOTAL AÑO')) ||
          (typeof secondCell === 'string' && secondCell.includes('TOTAL AÑO'))) {
        // FUNCIÓN DE FORMATEO - Agregar ANTES de crear el objeto TOTAL AÑO
        function formatColombianDisplay(value) {
          // Si el valor es 0 o vacío, retornar "$ -"
          if (!value || value === 0) {
            return ' $ -   ';
          }

          // Asegurarse de que es un número
          const num = typeof value === 'number' ? value : parseFloat(value);

          if (isNaN(num)) {
            return ' $ -   ';
          }

          // Formatear con comas como separador de miles (formato internacional) y sin decimales
          // Este es el formato que se usa en tus archivos Excel: 13,407,464
          const formatted = num.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
          });

          return ` $ ${formatted} `;
        }

        // Actualizar la fila TOTAL AÑO con los totales acumulados, formateados adecuadamente
        const obj = {
          id: typeof firstCell === 'string' && firstCell.includes('TOTAL AÑO') ? firstCell :
              typeof secondCell === 'string' && secondCell.includes('TOTAL AÑO') ? secondCell : 'TOTAL AÑO',
          detalle: 'TOTAL AÑO',  // Mostrar TOTAL AÑO en la columna de detalle
          asignacion: formatColombianDisplay(totalAccumulators.asignacion),
          ejecutado_acumulado: formatColombianDisplay(totalAccumulators.ejecutado_acumulado),
          porcentaje_ejecutado: totalAccumulators.asignacion > 0
            ? ((totalAccumulators.ejecutado_acumulado / totalAccumulators.asignacion) * 100).toFixed(2) + '%'
            : '0,00%',
          enero: formatColombianDisplay(totalAccumulators.enero),
          febrero: formatColombianDisplay(totalAccumulators.febrero),
          marzo: formatColombianDisplay(totalAccumulators.marzo),
          abril: formatColombianDisplay(totalAccumulators.abril),
          mayo: formatColombianDisplay(totalAccumulators.mayo),
          junio: formatColombianDisplay(totalAccumulators.junio),
          julio: formatColombianDisplay(totalAccumulators.julio),
          agosto: formatColombianDisplay(totalAccumulators.agosto),
          septiembre: formatColombianDisplay(totalAccumulators.septiembre),
          octubre: formatColombianDisplay(totalAccumulators.octubre),
          noviembre: formatColombianDisplay(totalAccumulators.noviembre),
          diciembre: formatColombianDisplay(totalAccumulators.diciembre)
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

          // Acumular valores numéricos para el TOTAL AÑO si es un campo numérico
          if (numericFields.includes(propName)) {
            let numericValue = value;

            if (typeof value === 'string') {
              // ====================================================================
              // PARSEO PARA FORMATO NUMÉRICO INTERNACIONAL (en-US)
              // Coma (,) como separador de miles, Punto (.) como separador decimal.
              // ====================================================================

              // Paso 1: Limpiar el string
              let cleanValue = value
                .replace(/\$/g, '')      // Quitar símbolo $
                .replace(/\s/g, '')      // Quitar TODOS los espacios
                .replace(/,/g, '');      // Quitar comas (separador de miles)

              // Log para debug
              console.log(`[PARSEO DEBUG] Original: "${value}" -> Limpio (sin $, espacios, comas): "${cleanValue}"`);

              // Paso 2: Verificar si es valor vacío
              if (cleanValue === '' || cleanValue === '-') {
                numericValue = 0;
                console.log(`[PARSEO DEBUG] Valor vacío detectado o '-', asignando 0`);
              } else {
                // Paso 3: Parsear el valor final. El punto (.) ahora es el separador decimal estándar.
                numericValue = parseFloat(cleanValue) || 0;
                console.log(`[PARSEO DEBUG] Resultado final: ${numericValue}`);
              }
            } else if (typeof value !== 'number') {
              numericValue = 0;
              console.log(`[PARSEO DEBUG] Tipo no válido, asignando 0`);
            }

            // Acumular en totalAccumulators
            totalAccumulators[propName] += numericValue;

            // Eliminamos el log redundante que ya está en la parte de arriba
            // console.log(`[PARSEO DEBUG] ${propName}: "${value}" -> ${numericValue}, Total acumulado: ${totalAccumulators[propName]}`);
          }
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

// --- Manejadores para el módulo de Objetivos SST ---

// Handler para obtener la ruta del archivo Excel de objetivos
ipcMain.handle('get-objetivos-excel-path', async (event, companyName) => {
  try {
    sendLog(`[MAIN] Obteniendo ruta del archivo Excel de objetivos para la empresa: ${companyName}`, 'INFO');

    // Cargar la configuración para obtener las rutas de la empresa
    const configData = await fsp.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);

    if (!config.companyPaths || !config.companyPaths[companyName]) {
      throw new Error(`No se encontró configuración para la empresa: ${companyName}`);
    }

    const companyConfig = config.companyPaths[companyName];
    const companyRootPath = companyConfig.root;
    const companyStructure = companyConfig.structure?.structure;

    let targetFolderPath = null;

    // 1. Intentar encontrar la carpeta específica del submódulo usando el mapeo
    if (companyStructure) {
        // Buscar el submódulo "2.2.1"
        targetFolderPath = searchInStructure(companyStructure, "2.2.1");
        if (targetFolderPath) {
            sendLog(`[MAIN] Carpeta de "2.2.1 Objetivos SST" encontrada en mapeo: ${targetFolderPath}`, 'INFO');
        }
    }

    // Si no se encuentra en el mapeo, usar la raíz (fallback, aunque menos preciso)
    const searchPath = targetFolderPath || companyRootPath;

    if (!searchPath) {
      throw new Error(`No se encontró la ruta raíz ni la carpeta del submódulo para la empresa: ${companyName}`);
    }

    // Función de búsqueda local en la carpeta específica (o recursiva si es necesario)
    async function findObjetivosFile(dir, recursive = false) {
      try {
        const entries = await fsp.readdir(dir, { withFileTypes: true });

        // Prioridad 1: Búsqueda exacta del archivo esperado
        const exactMatch = entries.find(e =>
            !e.isDirectory() &&
            e.name.toUpperCase().includes('GI-FO-044 OBJETIVOS Y METAS DEL SST') &&
            !e.name.startsWith('~$')
        );
        if (exactMatch) return path.join(dir, exactMatch.name);

        // Prioridad 2: Búsqueda flexible pero ROBUSTA dentro de esta carpeta
        for (const entry of entries) {
          const name = entry.name.toLowerCase();
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
             if (recursive) {
                 // Evitar carpetas del sistema
                 if (name.startsWith('.') || name === 'node_modules') continue;
                 const res = await findObjetivosFile(fullPath, true);
                 if (res) return res;
             }
          } else {
            // Ignorar archivos temporales
            if (name.startsWith('~$')) continue;

            // Ignorar archivos de Psicosocial explícitamente
            if (name.includes('psicosocial')) continue;

            // Criterios de coincidencia
            // Debe ser excel y contener (objetivos Y metas) O (objetivos Y sst)
            if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                 if ((name.includes('objetivos') && name.includes('metas')) ||
                     (name.includes('objetivos') && name.includes('sst'))) {
                     return fullPath;
                 }
            }
          }
        }
      } catch (error) {
         // sendLog(`[MAIN] Error buscando en ${dir}: ${error.message}`, 'WARN');
      }
      return null;
    }

    // Buscar primero solo en la carpeta destino (sin recursividad profunda si es la carpeta del submódulo)
    // Si targetFolderPath existe, buscamos ahí. Si no, buscamos recursivamente desde la raíz.
    let excelFilePath = await findObjetivosFile(searchPath, !targetFolderPath);

    if (!excelFilePath) {
        // Fallback final: Si falló la búsqueda específica, intentar búsqueda recursiva amplia desde la raíz
        // pero con filtros estrictos
        if (targetFolderPath) {
             sendLog(`[MAIN] No se encontró en la carpeta específica. Buscando en toda la empresa...`, 'WARN');
             excelFilePath = await findObjetivosFile(companyRootPath, true);
        }
    }

    if (!excelFilePath) {
      throw new Error(`No se encontró el archivo "GI-FO-044 OBJETIVOS Y METAS DEL SST.xlsx" en la ruta de la empresa.`);
    }

    sendLog(`[MAIN] Archivo Excel de objetivos seleccionado: ${excelFilePath}`, 'INFO');

    return {
      success: true,
      filePath: excelFilePath
    };
  } catch (error) {
    sendLog(`[MAIN] Error obteniendo ruta del archivo Excel de objetivos: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Handler para cargar datos del archivo Excel de objetivos
ipcMain.handle('load-objetivos-excel-data', async (event, filePath) => {
  try {
    sendLog(`[MAIN] Cargando datos del archivo Excel de objetivos: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN] Archivo Excel accesible: ${filePath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN] Error de acceso al archivo Excel ${filePath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    // Leer el archivo Excel
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Tomar la primera hoja
    const worksheet = workbook.Sheets[sheetName];

    // Obtener los datos como JSON
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    // Extraer la política desde la celda A6
    let policyText = '';
    if (worksheet['A6']) {
        policyText = worksheet['A6'].v ? worksheet['A6'].v.toString() : '';
    }

    // Extraer los objetivos
    // Según instrucciones: Titulos en fila 5 (índice 4). Datos inician desde fila 6 o 7.
    // Asumiremos que los datos inician en la fila 7 (índice 6) porque la fila 6 suele ser la política o espacio.
    // Mapeo solicitado:
    // Objetivos (B) -> 1
    // Indicadores (C) -> 2
    // Formula (D) -> 3
    // Meta (E) -> 4
    // Frecuencia (F) -> 5
    // Responsable (G) -> 6

    const startIndex = 6; // Fila 7 (índice 6)
    const objectivesData = [];

    for (let i = startIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      // Verificar si existe el objetivo en la columna B (índice 1)
      if (row && row[1]) {
        objectivesData.push({
          id: objectivesData.length + 1,
          objective: row[1] ? row[1].toString() : '',
          indicator: row[2] ? row[2].toString() : '',
          formula: row[3] ? row[3].toString() : '',
          goal: row[4] ? row[4].toString() : '',
          frequency: row[5] ? row[5].toString() : '',
          responsible: row[6] ? row[6].toString() : ''
        });
      }
    }

    sendLog(`[MAIN] Datos de objetivos cargados: ${objectivesData.length} registros`, 'INFO');

    return {
      success: true,
      data: {
        policyText: policyText,
        objectivesData: objectivesData
      }
    };
  } catch (error) {
    sendLog(`[MAIN] Error cargando datos del archivo Excel de objetivos: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Handler para guardar datos en el archivo Excel de objetivos
ipcMain.handle('save-objetivos-excel-data', async (event, filePath, data) => {
  try {
    sendLog(`[MAIN] Guardando datos en archivo Excel de objetivos: ${filePath}`, 'INFO');

    // Verificar que el archivo existe
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN] Archivo Excel accesible para escritura: ${filePath}`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN] Error de acceso al archivo Excel ${filePath}: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    // Leer el archivo Excel existente
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Obtener la primera hoja
    const worksheet = workbook.getWorksheet(1);

    // Actualizar la política en la celda A6
    if (data.policyText) {
      worksheet.getCell('A6').value = data.policyText;
    }

    // Actualizar los objetivos
    // Iniciar escritura desde la fila 7 (índice 7 en ExcelJS que es 1-based)
    const startIndex = 7;
    const dataRows = data.objectivesData || [];

    // Limpiar filas anteriores (eliminar datos pero mantener encabezados y estructura)
    // Limpiamos columnas 2 a 7 (B a G) desde la fila 7 hacia abajo
    for (let i = startIndex; i < startIndex + 100; i++) { // Limpiar hasta 100 filas potenciales
      const row = worksheet.getRow(i);
      for (let col = 2; col <= 7; col++) {
          row.getCell(col).value = null;
      }
    }

    // Escribir los nuevos datos
    dataRows.forEach((obj, index) => {
      const row = worksheet.getRow(startIndex + index);
      row.getCell(2).value = obj.objective || '';   // Col B
      row.getCell(3).value = obj.indicator || '';   // Col C
      row.getCell(4).value = obj.formula || '';     // Col D
      row.getCell(5).value = obj.goal || '';        // Col E
      row.getCell(6).value = obj.frequency || '';   // Col F
      row.getCell(7).value = obj.responsible || ''; // Col G
    });

    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[MAIN] Datos de objetivos guardados exitosamente en: ${filePath}`, 'INFO');

    return { success: true };
  } catch (error) {
    sendLog(`[MAIN] Error guardando datos en archivo Excel de objetivos: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-word-preview', async (event, rawFilePath) => {
  sendLog(`[MAIN][get-word-preview] Solicitud recibida para filePath: ${rawFilePath}`, 'INFO');
  
  // La ruta puede venir codificada, decodificar si es necesario
  let filePath = typeof rawFilePath === 'string' ? rawFilePath : (rawFilePath?.filePath || '');
  let prev = '';
  while (filePath !== prev) {
      prev = filePath;
      try {
          filePath = decodeURIComponent(filePath);
      } catch (e) {
          break;
      }
  }
  
  // Si la ruta empieza con una letra de unidad (ej: G:), usarla directamente
  const driveLetterMatch = filePath.match(/^([A-Za-z]):(.*)$/);
  if (driveLetterMatch) {
      filePath = driveLetterMatch[1] + ':' + driveLetterMatch[2];
      filePath = filePath.replace(/\\/g, '\\').replace(/\//g, '\\');
  }
  
  sendLog(`[MAIN][get-word-preview] Ruta normalizada: ${filePath}`, 'INFO');
  
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

// =============================================================================
// HANDLERS PARA EDICIÓN DE DOCUMENTOS (POLÍTICA)
// =============================================================================

// Manejador para obtener contenido editable de un documento
ipcMain.handle('get-editable-content', async (event, payload) => {
  //兼容 payload como objeto o como string directo
  const rawFilePath = typeof payload === 'string' ? payload : (payload?.filePath || '');
  
  sendLog(`[MAIN][get-editable-content] Solicitud recibida para: ${rawFilePath}`, 'INFO');
  
  try {
    // La ruta puede venir codificada, decodificar si es necesario
    let filePath = rawFilePath;
    let prev = '';
    while (filePath !== prev) {
        prev = filePath;
        try {
            filePath = decodeURIComponent(filePath);
        } catch (e) {
            break;
        }
    }
    
    // Si la ruta empieza con una letra de unidad (ej: G:), usarla directamente
    // Esto es importante para unidades de Google Drive
    const driveLetterMatch = filePath.match(/^([A-Za-z]):(.*)$/);
    if (driveLetterMatch) {
        filePath = driveLetterMatch[1] + ':' + driveLetterMatch[2];
        // Normalizar separadores de ruta
        filePath = filePath.replace(/\\/g, '\\').replace(/\//g, '\\');
    }
    
    sendLog(`[MAIN][get-editable-content] Ruta normalizada: ${filePath}`, 'INFO');
    
    // Verificar que el archivo existe
    await fsp.access(filePath, fs.constants.R_OK);
    sendLog(`[MAIN][get-editable-content] Archivo accesible: ${filePath}`, 'DEBUG');
    
    const fileBuffer = await fsp.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');
    const fileName = path.basename(filePath);
    
    // Devolver el contenido como base64 para que el renderer lo procese
    return { 
      success: true, 
      content: base64Data,
      fileName: fileName,
      filePath: filePath
    };
  } catch (error) {
    sendLog(`[MAIN][get-editable-content] Error: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para guardar documento editado
ipcMain.handle('save-edited-document', async (event, payload) => {
  //兼容 payload como objeto o como propiedades directas
  const rawFilePath = payload?.filePath || '';
  const content = payload?.content || '';
  
  sendLog(`[MAIN][save-edited-document] Solicitud para guardar: ${rawFilePath}`, 'INFO');
  
  try {
    // La ruta puede venir codificada, decodificar si es necesario
    let filePath = rawFilePath;
    let prev = '';
    while (filePath !== prev) {
        prev = filePath;
        try {
            filePath = decodeURIComponent(filePath);
        } catch (e) {
            break;
        }
    }
    
    // Si la ruta empieza con una letra de unidad (ej: G:), usarla directamente
    const driveLetterMatch = filePath.match(/^([A-Za-z]):(.*)$/);
    if (driveLetterMatch) {
        filePath = driveLetterMatch[1] + ':' + driveLetterMatch[2];
        filePath = filePath.replace(/\\/g, '\\').replace(/\//g, '\\');
    }
    
    sendLog(`[MAIN][save-edited-document] Ruta normalizada: ${filePath}`, 'INFO');
    
    // Verificar que el directorio existe
    const dir = path.dirname(filePath);
    await fsp.mkdir(dir, { recursive: true });
    
    // Guardar el contenido
    if (typeof content === 'string' && content.startsWith('<')) {
      // Es HTML
      const htmlPath = filePath.replace(/\.(docx?|doc)$/i, '_editado.html');
      await fsp.writeFile(htmlPath, content, 'utf8');
      return { 
        success: true, 
        message: 'Documento guardado como HTML',
        savedPath: htmlPath
      };
    } else {
      // Es base64
      try {
        const buffer = Buffer.from(content, 'base64');
        await fsp.writeFile(filePath, buffer);
      } catch (base64Error) {
        await fsp.writeFile(filePath, content, 'utf8');
      }
      return { 
        success: true, 
        message: 'Documento guardado correctamente',
        savedPath: filePath
      };
    }
  } catch (error) {
    sendLog(`[MAIN][save-edited-document] Error: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para abrir editor OnlyOffice
ipcMain.handle('open-onlyoffice-editor', async (event, payload) => {
  const rawFilePath = payload?.filePath || '';
  const fileName = payload?.fileName || '';
  
  sendLog(`[MAIN][open-onlyoffice-editor] Solicitud para abrir: ${rawFilePath}`, 'INFO');
  
  try {
    // Decodificar la ruta si viene codificada
    let filePath = rawFilePath;
    let prev = '';
    while (filePath !== prev) {
        prev = filePath;
        try {
            filePath = decodeURIComponent(filePath);
        } catch (e) {
            break;
        }
    }
    
    // Manejar rutas de unidades de red (ej: G:)
    const driveLetterMatch = filePath.match(/^([A-Za-z]):(.*)$/);
    if (driveLetterMatch) {
        filePath = driveLetterMatch[1] + ':' + driveLetterMatch[2].replace(/\\/g, '\\\\').replace(/\//g, '\\\\');
    }
    
    sendLog(`[MAIN][open-onlyoffice-editor] Ruta normalizada: ${filePath}`, 'INFO');
    
    // Verificar que el archivo existe
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      throw new Error(`El archivo no existe: ${filePath}`);
    }
    
    // Construir configuración para el editor OnlyOffice
    // NOTA: El frontend (politica-view.html) inicializa el editor internamente usando DocsAPI
    // Este handler main.js ya no es necesario para el flujo principal, pero se mantiene por compatibilidad
    
    // Generar llave única para el documento
    const documentKey = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Registrar la llave en el puente (si el servidor Bridge está corriendo)
    try {
        const http = require('http');
        const postData = JSON.stringify({ key: documentKey, filePath: filePath });
        
        const req = http.request({
            hostname: 'localhost',
            port: 3011,
            path: '/register-key',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            console.log(`[Bridge] Registro de llave respondió: ${res.statusCode}`);
        });
        
        req.on('error', (e) => {
        });
        
        req.write(postData);
        req.end();
    } catch (e) {
    }
    
    // Generar configuración completa para DocsAPI de OnlyOffice
    const getFileExtension = (filePath) => {
        const parts = String(filePath).split('.');
        return parts.length > 1 ? '.' + parts.pop().toLowerCase() : '';
    };

    const getDocumentType = (extension) => {
        const ext = String(extension).toLowerCase().replace('.', '');
        if (['doc', 'docx'].includes(ext)) return 'word';
        if (['xls', 'xlsx'].includes(ext)) return 'cell';
        if (['ppt', 'pptx'].includes(ext)) return 'slide';
        return 'word';
    };

    // Usar la variable documentKey declarada al inicio
    const currentDocumentKey = documentKey;
    const callbackUrl = `http://host.docker.internal:3011/track?key=${currentDocumentKey}`;
    
    // Obtener configuración del Bridge (CON JWT)
    try {
        const http = require('http');
        const postData = JSON.stringify({
            filePath: filePath,
            fileName: fileName,
            documentKey: currentDocumentKey
        });
        
        const configResult = await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3011,
                path: '/get-editor-config',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Error parseando respuesta del Bridge'));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        if (!configResult.success) {
            throw new Error(configResult.error || 'Error generando configuración');
        }
        
        // Retornar configuración con URL completa del editor
        const bridgeConfig = configResult.config;
        const documentUrl = bridgeConfig.document?.url || '';
        const bridgeDocKey = bridgeConfig.document?.key || currentDocumentKey;
        const bridgeCallbackUrl = bridgeConfig.editorConfig?.callbackUrl || callbackUrl;
        const jwtToken = bridgeConfig.token || '';
        
        console.log('[MAIN] 🔍 Config recibida del bridge:');
        console.log('[MAIN] 🔍 document.url:', documentUrl);
        console.log('[MAIN] 🔍 document.key:', bridgeDocKey);
        console.log('[MAIN] 🔍 editorConfig.callbackUrl:', bridgeCallbackUrl);
        console.log('[MAIN] 🔍 token:', jwtToken ? jwtToken.substring(0, 50) + '...' : 'NINGUNO');
        
        console.log('[MAIN] 📦 Retornando config JSON completa para inicializar DocsAPI');
        
        // Retornar config JSON completa para inicializar DocsAPI
        // NO construir URL con ?fileURL= - eso es el método obsoleto de 2018
        return {
            success: true,
            message: 'Configuración OnlyOffice lista para inicializar DocsAPI',
            editorUrl: 'about:blank', // El frontend cargará wrapper.html
            config: bridgeConfig
        };
    } catch (bridgeError) {
        // Fallback: generar configuración sin JWT (si el Bridge falla)
        console.warn('[MAIN] Usando fallback sin JWT:', bridgeError.message);
        
        const fetchFileUrl = `http://host.docker.internal:3011/fetch-file?filePath=${encodeURIComponent(filePath)}`;
        const extension = getFileExtension(filePath);

        const editorConfig = {
            document: {
                fileType: extension.substring(1).toLowerCase(),
                key: currentDocumentKey,
                title: fileName,
                url: fetchFileUrl,
                permissions: {
                    edit: true,
                    download: true,
                    print: true
                }
            },
            documentType: getDocumentType(extension),
            editorConfig: {
                mode: 'edit',
                lang: 'es-ES',
                callbackUrl: callbackUrl,
                user: {
                    id: 'user-1',
                    name: 'Usuario K+AIR'
                },
                customization: {
                    autosave: true,
                    forcesave: true,
                    compactHeader: false,
                    hideRightMenu: false,
                    hideRulers: false
                }
            },
            onlyofficeServerUrl: 'http://localhost:8080',
            token: ''
        };
        
        console.log('[MAIN] 📦 Retornando config JSON fallback sin JWT');
        
        return {
            success: true,
            message: 'Configuración OnlyOffice lista (fallback sin JWT)',
            editorUrl: 'about:blank',
            config: editorConfig
        };
    }
  } catch (error) {
    sendLog(`[MAIN][open-onlyoffice-editor] Error: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
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

    // ============================================================================
    // 🛡️ PRESERVACIÓN DE MERGES - LEER Y GUARDAR TODOS LOS MERGES EXISTENTES
    // ============================================================================
    const existingMerges = [];
    if (worksheet.model && worksheet.model.merges) {
      for (const mergeRange of worksheet.model.merges) {
        existingMerges.push(mergeRange);
        sendLog(`[DEBUG] Merge encontrado: ${mergeRange}`, 'DEBUG');
      }
    }
    sendLog(`[DEBUG] Total de merges preservados: ${existingMerges.length}`, 'DEBUG');

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

      // Asignar valores CÉLULA POR CÉLULA para preservar completamente la columna B
      // (incluyendo merges, formato y otras propiedades)

      // Columna A (índice 0) - ID
      row.getCell(1).value = rowData.id; // ExcelJS usa índice base 1, así que 1 = columna A

      // ⚠️ COLUMNA B (índice 1) - NO SE TOCA - Se preserva valor, formato y merges
      // No asignamos nada a row.getCell(2) para mantener la celda intacta

      // Columna C (índice 2) - Detalle
      row.getCell(3).value = rowData.detalle;

      // Columna D (índice 3) - Asignación
      row.getCell(4).value = parseValue(rowData.asignacion);
      row.getCell(4).numFmt = '#,##0.00';

      // Columna E (índice 4) - Ejecutado Acumulado
      row.getCell(5).value = parseValue(rowData.ejecutado_acumulado);
      row.getCell(5).numFmt = '#,##0.00';

      // Columna F (índice 5) - Porcentaje Ejecutado
      row.getCell(6).value = parsePercentage(rowData.porcentaje_ejecutado);
      row.getCell(6).numFmt = '0.00%';

      // Columnas G a R (índices 6-17) - Meses
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

      meses.forEach((mes, idx) => {
        const colIndex = 7 + idx; // 7 = columna G (índice base 1 de ExcelJS)
        row.getCell(colIndex).value = parseValue(rowData[mes]);
        row.getCell(colIndex).numFmt = '#,##0.00';
      });

      sendLog(`[DEBUG] handleSaveBudgetFile - Escribiendo valores en fila ${rowIndex}`, 'DEBUG');
    }

    // ============================================================================
    // 🛡️ RESTAURACIÓN DE MERGES - REAPLICAR TODOS LOS MERGES ORIGINALES
    // ============================================================================
    sendLog(`[DEBUG] Restaurando ${existingMerges.length} merges...`, 'DEBUG');
    for (const mergeRange of existingMerges) {
      try {
        // Decodificar el rango del merge (ej: "B11:B20")
        const decodedRange = xlsx.utils.decode_range(mergeRange);

        // Convertir a formato de ExcelJS (1-based)
        const startRow = decodedRange.s.r + 1;
        const startCol = decodedRange.s.c + 1;
        const endRow = decodedRange.e.r + 1;
        const endCol = decodedRange.e.c + 1;

        // Reaplicar el merge usando ExcelJS
        worksheet.mergeCells(startRow, startCol, endRow, endCol);
        sendLog(`[DEBUG] Merge restaurado: ${mergeRange} -> (${startRow},${startCol}):(${endRow},${endCol})`, 'DEBUG');
      } catch (mergeError) {
        sendLog(`[WARN] Error al restaurar merge ${mergeRange}: ${mergeError.message}`, 'WARN');
      }
    }
    sendLog(`[DEBUG] Todos los merges han sido restaurados`, 'DEBUG');

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
  // Solo crear ventana si no ha sido creada antes
  if (!isWindowCreated) {
    createWindow();
  }

  // Iniciar la búsqueda de actualizaciones una vez que la app esté lista
// autoUpdater.checkForUpdatesAndNotify(); // TEMPORAL: Comentado

  app.on('activate', () => {
    // En macOS, es común volver a crear una ventana en la aplicación cuando
    // se hace clic en el ícono del dock y no hay otras ventanas abiertas.
    // Usamos isWindowCreated para evitar crear ventanas duplicadas
    if ((BrowserWindow.getAllWindows().length === 0 || !mainWindow || mainWindow.isDestroyed()) && !isWindowCreated) {
      createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      // Si la ventana existe pero está oculta, mostrarla
      mainWindow.show();
      mainWindow.focus();
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

// --- Eventos del Auto-Updater (TEMPORALMENTE COMENTADO) ---
// log.info('Actualización disponible.');
// if (mainWindow) {
//   mainWindow.webContents.send('update_available');
// }

// log.info('Actualización descargada. Lista para ser instalada.');
// if (mainWindow) {
//   mainWindow.webContents.send('update_downloaded');
// }

// log.error('Error en el auto-updater: ' + err.toString());

// =============================================================================
// Handler: Leer datos de ausentismo desde Excel
// =============================================================================
ipcMain.handle('get-ausentismo-data', async (event, companyName) => {
  console.log('========================================');
  console.log(`[AUSENTISMO][MAIN] Handler get-ausentismo-data llamado para empresa: ${companyName}`);
  sendLog(`[DEBUG] Handler get-ausentismo-data llamado para empresa: ${companyName}`);
  sendLog(`[TEST] Este log debería aparecer si el handler se llama.`);

  try {
    // -------------------------------------------------------------------------
    // 1. Cargar configuración
    // -------------------------------------------------------------------------
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    console.log(`[AUSENTISMO][MAIN] Configuración cargada:`);
    console.log(`[AUSENTISMO][MAIN] companyPaths disponibles:`, Object.keys(config.companyPaths || {}));

    // -------------------------------------------------------------------------
    // 2. Obtener la estructura real de la empresa
    // -------------------------------------------------------------------------
    const normalizedCompanyName = companyName.toLowerCase();
    const companyKey = Object.keys(config.companyPaths || {}).find(
      key => key.toLowerCase() === normalizedCompanyName
    );

    console.log(`[AUSENTISMO][MAIN] normalizedCompanyName: ${normalizedCompanyName}`);
    console.log(`[AUSENTISMO][MAIN] companyKey encontrada: ${companyKey || '(NO ENCONTRADA)'}`);

    const companyConfig = companyKey ? config.companyPaths[companyKey] : null;

    if (companyConfig) {
      console.log(`[AUSENTISMO][MAIN] companyConfig para ${companyKey}:`, {
        hasRoot: !!companyConfig.root,
        root: companyConfig.root,
        hasStructure: !!companyConfig.structure,
        hasStructureStructure: !!(companyConfig.structure?.structure)
      });
    } else {
      console.error(`[AUSENTISMO][MAIN] companyConfig es NULL para ${companyKey}`);
    }

    if (!companyConfig || !companyConfig.structure?.structure) {
      const available = Object.keys(config.companyPaths || {});
      const errorMsg = `Empresa "${companyName}" no tiene estructura mapeada. Disponibles: [${available.join(', ')}]`;
      console.error(`[AUSENTISMO][MAIN][ERROR] ${errorMsg}`);
      console.error(`[AUSENTISMO][MAIN][ERROR] companyConfig:`, companyConfig);
      console.log('========================================');
      throw new Error(errorMsg);
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
    // 6. Obtener archivos de la carpeta de ausentismo
    // -------------------------------------------------------------------------
    const allFiles = ausentismoDir.files || [];
    
    console.log(`[AUSENTISMO][MAIN] === ARCHIVOS EN LA CARPETA DE AUSENTISMO ===`);
    console.log(`[AUSENTISMO][MAIN] Total de archivos encontrados: ${allFiles.length}`);
    allFiles.forEach((f, idx) => {
      console.log(`  [${idx}] ${f.name} (ext: ${f.extension || 'sin extensión'})`);
    });
    console.log(`[AUSENTISMO][MAIN] ============================================`);
    
    // Filtrar solo archivos .xlsx
    const excelFiles = allFiles.filter(
      f => f.extension?.toLowerCase() === '.xlsx'
    );
    
    console.log(`[AUSENTISMO][MAIN] Archivos .xlsx encontrados: ${excelFiles.length}`);
    excelFiles.forEach((f, idx) => {
      console.log(`  [${idx}] ${f.name}`);
    });
    
    // Buscar específicamente archivos que contengan "PRI" en el nombre
    const priFiles = allFiles.filter(
      f => f.name && f.name.toUpperCase().includes('PRI')
    );
    
    console.log(`[AUSENTISMO][MAIN] Archivos que contienen "PRI" en el nombre: ${priFiles.length}`);
    if (priFiles.length > 0) {
      priFiles.forEach((f, idx) => {
        console.log(`  [${idx}] ${f.name} (ext: ${f.extension || 'sin extensión'})`);
      });
    } else {
      console.log(`[AUSENTISMO][MAIN] ⚠️ NO se encontró ningún archivo con "PRI" en el nombre`);
    }
    
    if (excelFiles.length === 0) {
      throw new Error('No hay archivos .xlsx en la carpeta de ausentismo.');
    }

    // === CORRECCIÓN: Seleccionar el archivo correcto según el propósito ===
    // Para get-ausentismo-data (lista principal), usar el archivo PI-FO-076, NO el PRI.xlsx
    // El PRI.xlsx se usa solo para seguimiento detallado de casos individuales
    
    // Buscar específicamente el archivo PI-FO-076 (ausentismo general)
    const ausentismoGeneralFile = excelFiles.find(
      f => f.name && (f.name.toUpperCase().includes('PI-FO-076') || f.name.toUpperCase().includes('PG-FO-076') || f.name.toUpperCase().includes('GI-FO-076'))
    );
    
    // Si no encuentra PI-FO-076, usar el primer .xlsx que NO sea PRI.xlsx
    const excelFile = ausentismoGeneralFile || excelFiles.find(f => !f.name.toUpperCase().includes('PRI')) || excelFiles[0];
    
    console.log(`[AUSENTISMO][MAIN] Archivo SELECCIONADO: ${excelFile.name}`);
    console.log(`[AUSENTISMO][MAIN] ¿Es archivo de ausentismo general (PI/PG/GI-FO-076)?: ${ausentismoGeneralFile ? '✅ SÍ' : '❌ NO'}`);
    console.log(`[AUSENTISMO][MAIN] Ruta completa: ${excelFile.path}`);
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
    const result = {
      success: true,
      headers: limitedHeaders,
      rows: limitedRows,
      filePath: excelFile.path,
      companyName
    };
    
    console.log('========================================');
    console.log('[AUSENTISMO][MAIN] Datos de ausentismo listos para enviar:');
    console.log(`  - Éxito: ${result.success}`);
    console.log(`  - Encabezados: ${limitedHeaders.length} columnas`);
    console.log(`  - Filas: ${limitedRows.length} registros`);
    console.log(`  - Archivo: ${excelFile.path}`);
    console.log('========================================');

    return result;

  } catch (error) {
    sendLog(`[ERROR] Error crítico en get-ausentismo-data: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message,
      companyName
    };
  }
});

// =============================================================================
// Handler: read-ausentismo-data (Para estadísticas - retorna todos los datos sin filtrar)
// =============================================================================
ipcMain.handle('read-ausentismo-data', async (event, companyName) => {
  console.log('========================================');
  console.log(`[ESTADISTICAS][MAIN] Handler read-ausentismo-data llamado para empresa: ${companyName}`);
  sendLog(`[ESTADISTICAS] Cargando datos para estadísticas: ${companyName}`, 'INFO');

  try {
    // 1. Cargar configuración
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    // 2. Obtener estructura de la empresa
    const normalizedCompanyName = companyName.toLowerCase();
    const companyKey = Object.keys(config.companyPaths || {}).find(
      key => key.toLowerCase() === normalizedCompanyName
    );

    const companyConfig = companyKey ? config.companyPaths[companyKey] : null;

    if (!companyConfig || !companyConfig.root) {
      throw new Error(`Empresa "${companyName}" no tiene ruta mapeada`);
    }

    // 3. Buscar archivo de ausentismo (PI-FO-076)
    const ausentismoDir = path.join(
      companyConfig.root,
      '3. Gestión de la Salud',
      '3.3.6 Medición del ausentismo por causa médica'
    );

    const files = await fsp.readdir(ausentismoDir);
    const ausentismoFile = files.find(f => 
      f.includes('PI-FO-076') || f.includes('AUSENTISMO')
    );

    if (!ausentismoFile) {
      throw new Error('No se encontró el archivo de ausentismo (PI-FO-076)');
    }

    const filePath = path.join(ausentismoDir, ausentismoFile);
    console.log(`[ESTADISTICAS] Archivo encontrado: ${filePath}`);

    // 4. Leer Excel con XLSX
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    
    // 5. Obtener hoja del año actual (o la primera que tenga datos)
    const sheetName = workbook.SheetNames.find(name => 
      name.includes(companyKey ? companyKey.toUpperCase() : '2024')
    ) || workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // 6. Encontrar encabezados (primera fila con "NOMBRE" o "CEDULA")
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(rawData.length, 20); i++) {
      const row = rawData[i];
      if (row.some(cell => cell && (String(cell).includes('NOMBRE') || String(cell).includes('CEDULA')))) {
        headerRowIndex = i;
        break;
      }
    }

    const headers = rawData[headerRowIndex].map(h => h ? String(h).trim() : '');
    const dataRows = rawData.slice(headerRowIndex + 1);

    console.log(`[ESTADISTICAS] Headers: ${headers.length} columnas`);
    console.log(`[ESTADISTICAS] Data rows: ${dataRows.length} filas`);

    // 7. Retornar datos
    return {
      success: true,
      headers,
      rows: dataRows,
      file: filePath,
      sheet: sheetName
    };

  } catch (error) {
    console.error('[ESTADISTICAS] Error:', error);
    sendLog(`[ERROR] Error en read-ausentismo-data: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
});

// =============================================================================
// Handler: Leer datos del PRI.xlsx (hoja "Casos en seguimiento")
// =============================================================================
ipcMain.handle('get-pri-seguimiento-data', async (event, companyName) => {
  console.log('========================================');
  console.log(`[PRI][MAIN] Handler get-pri-seguimiento-data llamado para empresa: ${companyName}`);
  
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
      throw new Error(`Empresa "${companyName}" no tiene estructura mapeada. Disponibles: [${available.join(', ')}]`);
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
    const gestionSalud = findDirFlexible(rootStructure.subdirectories, "3. Gestión de la Salud");

    if (!gestionSalud) {
      throw new Error(`No se encontró "3. Gestión de la Salud".`);
    }

    // -------------------------------------------------------------------------
    // 5. Buscar el submódulo de ausentismo
    // -------------------------------------------------------------------------
    const ausentismoDir = findDirFlexible(gestionSalud.subdirectories, "3.3.6 Medición del ausentismo por causa médica");

    if (!ausentismoDir) {
      throw new Error(`No se encontró submódulo de ausentismo.`);
    }

    // -------------------------------------------------------------------------
    // 6. Buscar específicamente el archivo PRI.xlsx
    // -------------------------------------------------------------------------
    const allFiles = ausentismoDir.files || [];
    const priFile = allFiles.find(
      f => f.name && f.name.toUpperCase() === 'PRI.XLSX' && f.extension?.toLowerCase() === '.xlsx'
    );

    if (!priFile) {
      // Listar archivos disponibles para debug
      console.log(`[PRI][MAIN] Archivos en la carpeta:`, allFiles.map(f => f.name));
      throw new Error(`No se encontró el archivo PRI.xlsx en la carpeta de ausentismo.`);
    }

    console.log(`[PRI][MAIN] ✅ Archivo PRI.xlsx encontrado: ${priFile.path}`);

    // -------------------------------------------------------------------------
    // 7. Leer archivo PRI.xlsx
    // -------------------------------------------------------------------------
    const workbook = xlsx.readFile(priFile.path);
    console.log('[PRI][MAIN] Nombres de hojas en PRI.xlsx:', workbook.SheetNames);

    // Buscar la hoja "Casos en seguimiento"
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('casos en seguimiento') ||
      name.toLowerCase().includes('casos') ||
      name.toLowerCase().includes('seguimiento')
    );

    if (!sheetName) {
      throw new Error(`No se encontró la hoja "Casos en seguimiento" en PRI.xlsx. Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
    }

    console.log(`[PRI][MAIN] Hoja seleccionada: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    console.log('[PRI][MAIN] !ref de la hoja:', worksheet['!ref']);

    // -------------------------------------------------------------------------
    // 8. Leer todos los datos de la hoja
    // -------------------------------------------------------------------------
    const allData = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: null
    });

    console.log(`[PRI][MAIN] Total de filas leídas: ${allData.length}`);

    // -------------------------------------------------------------------------
    // 9. Buscar encabezados (adaptar según la estructura del PRI)
    // -------------------------------------------------------------------------
    // El PRI tiene una estructura diferente - buscar la fila con encabezados
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, allData.length); i++) {
      const row = allData[i];
      if (row && row.some(cell => cell && cell.toString().toLowerCase().includes('identificación') || cell && cell.toString().toLowerCase().includes('nombre') || cell && cell.toString().toLowerCase().includes('cedula'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Si no encuentra encabezados, usar la fila 1 como fallback
      headerRowIndex = 0;
    }

    console.log(`[PRI][MAIN] Fila de encabezados encontrada en índice: ${headerRowIndex}`);
    const headers = allData[headerRowIndex];
    console.log(`[PRI][MAIN] Encabezados:`, headers);

    // -------------------------------------------------------------------------
    // 10. Extraer datos (filas después del encabezado)
    // -------------------------------------------------------------------------
    const rows = allData.slice(headerRowIndex + 1).filter(row => 
      row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    console.log(`[PRI][MAIN] Total de registros: ${rows.length}`);

    // -------------------------------------------------------------------------
    // 11. Retornar datos procesados
    // -------------------------------------------------------------------------
    const result = {
      success: true,
      headers: headers || [],
      rows: rows,
      filePath: priFile.path,
      sheetName: sheetName,
      companyName
    };

    console.log('========================================');
    console.log('[PRI][MAIN] Datos del PRI listos para enviar:');
    console.log(`  - Éxito: ${result.success}`);
    console.log(`  - Encabezados: ${result.headers.length} columnas`);
    console.log(`  - Filas: ${result.rows.length} registros`);
    console.log(`  - Archivo: ${priFile.path}`);
    console.log(`  - Hoja: ${sheetName}`);
    console.log('========================================');

    return result;

  } catch (error) {
    console.error('[PRI][MAIN][ERROR] Error crítico en get-pri-seguimiento-data:', error);
    sendLog(`[ERROR] Error en get-pri-seguimiento-data: ${error.message}`, 'ERROR');
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

// Función específica para obtener la ruta del PRI.xlsx
async function obtenerRutaPri(companyName) {
  console.log(`[PRI][RUTA] Obteniendo ruta de PRI.xlsx para empresa: ${companyName}`);
  
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

  // Buscar específicamente PRI.xlsx
  const allFiles = ausentismoDir.files || [];
  const priFile = allFiles.find(
    f => f.name && f.name.toUpperCase() === 'PRI.XLSX' && f.extension?.toLowerCase() === '.xlsx'
  );

  if (!priFile) {
    console.log(`[PRI][RUTA] Archivos en la carpeta:`, allFiles.map(f => f.name));
    throw new Error(`No se encontró el archivo PRI.xlsx en la carpeta de ausentismo.`);
  }

  console.log(`[PRI][RUTA] ✅ PRI.xlsx encontrado: ${priFile.path}`);
  return priFile.path;
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

// Manejador para guardar seguimiento de incapacidades - AHORA USA PRI.xlsx ESPECÍFICAMENTE
ipcMain.handle('save-follow-up', async (event, followUpData, companyName) => {
  console.log('========================================');
  console.log(`[PRI][GUARDAR] Handler save-follow-up llamado para empresa: ${companyName}`);
  sendLog(`[MAIN] Guardando seguimiento de incapacidad para empresa: ${companyName}`, 'INFO');

  try {
    // === OBTENER RUTA ESPECÍFICA DE PRI.xlsx ===
    const filePath = await obtenerRutaPri(companyName);
    console.log(`[PRI][GUARDAR] ✅ PRI.xlsx encontrado: ${filePath}`);
    sendLog(`[MAIN] Archivo PRI.xlsx encontrado: ${filePath}`, 'INFO');

    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    // Convertir followUpData en string seguro para pasar a Python
    const followUpDataJson = JSON.stringify(followUpData);

    console.log(`[PRI][GUARDAR] Llamando script Python: guardar_seguimiento`);
    console.log(`[PRI][GUARDAR] Empresa: ${companyName}`);
    console.log(`[PRI][GUARDAR] Archivo: ${filePath}`);
    console.log(`[PRI][GUARDAR] Datos:`, followUpData);

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'guardar_seguimiento',
        companyName,    // ARG 1
        filePath,       // ARG 2 - Ruta específica de PRI.xlsx
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
              console.log(`[PRI][GUARDAR] Resultado de Python:`, obj.payload);
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Seguimiento - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      python.stderr.on('data', (data) => {
        sendLog(`[Python Seguimiento - STDERR] ${data.toString()}`, 'ERROR');
        console.error(`[PRI][GUARDAR] Error Python:`, data.toString());
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
        console.error(`[PRI][GUARDAR] Error al iniciar Python:`, err);
        reject(err);
      });
    });

  } catch (error) {
    console.error('[PRI][GUARDAR][ERROR] Error crítico en save-follow-up:', error);
    sendLog(`[ERROR] Falló save-follow-up: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Manejador para buscar registros existentes por cédula
ipcMain.handle('buscar-registros-cedula', async (event, cedula, companyName) => {
  console.log('========================================');
  console.log(`[PRI][BUSCAR] Buscando registros para cédula: ${cedula}, empresa: ${companyName}`);

  try {
    const filePath = await obtenerRutaPri(companyName);
    console.log(`[PRI][BUSCAR] ✅ PRI.xlsx encontrado: ${filePath}`);

    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'buscar_registros_por_cedula',
        companyName,
        filePath,
        cedula
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
              sendLog(`[Python Buscar] ${obj.message}`, 'INFO');
            } else if (obj.type === 'result') {
              console.log(`[PRI][BUSCAR] Resultado:`, obj.payload);
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Buscar - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      python.stderr.on('data', (data) => {
        sendLog(`[Python Buscar - STDERR] ${data.toString()}`, 'ERROR');
      });

      python.on('close', (code) => {
        if (buffer?.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch { /* ignore */ }
        }
        resolve({ success: false, error: 'Proceso cerrado sin resultado.' });
      });

      python.on('error', (err) => {
        sendLog(`Error al iniciar Python para buscar: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    console.error('[PRI][BUSCAR][ERROR] Error:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para cargar TODOS los registros de PRI.xlsx (para tabla de seguimiento)
ipcMain.handle('buscar-todos-registros-pri', async (event, companyName) => {
  console.log('========================================');
  console.log(`[PRI][TODOS] Cargando todos los registros de PRI para empresa: ${companyName}`);

  try {
    const filePath = await obtenerRutaPri(companyName);
    console.log(`[PRI][TODOS] ✅ PRI.xlsx encontrado: ${filePath}`);

    const { spawn } = require('child_process');
    const scriptPath = path.join(__dirname, 'Portear', 'src', 'actualizar_ausentismo.py');
    const pythonPath = await getPython();

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [
        scriptPath,
        'cargar_todos_registros_pri',
        companyName,
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
              sendLog(`[Python Todos PRI] ${obj.message}`, 'INFO');
            } else if (obj.type === 'result') {
              console.log(`[PRI][TODOS] Resultado: ${obj.payload.registros?.length || 0} registros`);
              resolve(obj.payload);
            }
          } catch (e) {
            sendLog(`[Python Todos PRI - RAW] ${line}`, 'DEBUG');
          }
        });
      });

      python.stderr.on('data', (data) => {
        sendLog(`[Python Todos PRI - STDERR] ${data.toString()}`, 'ERROR');
      });

      python.on('close', (code) => {
        if (buffer?.trim()) {
          try {
            const last = JSON.parse(buffer.trim());
            if (last.type === 'result') return resolve(last.payload);
          } catch { /* ignore */ }
        }
        resolve({ success: false, error: 'Proceso cerrado sin resultado.' });
      });

      python.on('error', (err) => {
        sendLog(`Error al iniciar Python para cargar todos PRI: ${err.message}`, 'CRITICAL');
        reject(err);
      });
    });

  } catch (error) {
    console.error('[PRI][TODOS][ERROR] Error:', error);
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


// REPLACEMENT_MARKER

// Manejador para duplicar archivo de presupuesto con nuevo año
ipcMain.handle('duplicate-budget-file', async (event, { currentFilePath, newYear }) => {
    try {
        sendLog(`[MAIN] Iniciando duplicación de archivo: ${currentFilePath} con nuevo año: ${newYear}`, 'INFO');

        // Verificar que el archivo original exista
        await fsp.access(currentFilePath);
        sendLog(`[MAIN] Archivo original verificado: ${currentFilePath}`, 'DEBUG');

        // Extraer directorio y nombre base del archivo
        const dirPath = path.dirname(currentFilePath);
        const fileExtension = path.extname(currentFilePath);
        const fileNameWithoutExt = path.basename(currentFilePath, fileExtension);

        sendLog(`[MAIN] Directorio: ${dirPath}, Nombre base: ${fileNameWithoutExt}, Extensión: ${fileExtension}`, 'DEBUG');

        // Extraer el año actual del nombre del archivo si existe
        const yearMatch = fileNameWithoutExt.match(/(20\d{2})/);
        let newFileName;

        if (yearMatch) {
            // Si el nombre del archivo contiene un año, reemplazarlo con el nuevo año
            const currentYear = yearMatch[1];
            newFileName = fileNameWithoutExt.replace(currentYear, newYear) + fileExtension;
            sendLog(`[MAIN] Año encontrado en el nombre: ${currentYear}, nuevo nombre: ${newFileName}`, 'DEBUG');
        } else {
            // Si no hay año en el nombre, agregar el año al final
            newFileName = `${fileNameWithoutExt}_${newYear}${fileExtension}`;
            sendLog(`[MAIN] No se encontró año en el nombre, nuevo nombre: ${newFileName}`, 'DEBUG');
        }

        // Ruta del nuevo archivo
        const newFilePath = path.join(dirPath, newFileName);
        sendLog(`[MAIN] Ruta del nuevo archivo: ${newFilePath}`, 'DEBUG');

        // Verificar si el nuevo archivo ya existe
        if (fs.existsSync(newFilePath)) {
            const errorMsg = `Ya existe un archivo con el nombre "${newFileName}" en la carpeta.`;
            sendLog(`[MAIN] Error: ${errorMsg}`, 'ERROR');
            throw new Error(errorMsg);
        }

        // Copiar el archivo original al nuevo archivo
        fs.copyFileSync(currentFilePath, newFilePath);
        sendLog(`[MAIN] Archivo copiado exitosamente`, 'DEBUG');

        // Verificar que el archivo se haya creado
        await fsp.access(newFilePath);
        sendLog(`[MAIN] Archivo nuevo verificado: ${newFilePath}`, 'DEBUG');

        sendLog(`[MAIN] Archivo de presupuesto duplicado exitosamente: ${currentFilePath} -> ${newFilePath}`, 'INFO');

        return {
            success: true,
            newFilePath: newFilePath,
            newFileName: newFileName,
            message: `Archivo duplicado exitosamente como "${newFileName}"`
        };
    } catch (error) {
        sendLog(`[MAIN] Error duplicando archivo de presupuesto: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
});

// Manejador para obtener datos detallados de inducciones
ipcMain.handle('get-inducciones-data', async (event, companyName) => {
  sendLog(`[MAIN] Obteniendo datos DETALLADOS de inducciones para: ${companyName}`, 'INFO');
  try {
    const rootPath = await getCompanyRootPath(companyName);
    if (!rootPath) throw new Error(`No se encontró ruta raíz para la empresa: ${companyName}`);

    const recursosPath = path.join(rootPath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.1 Inducción y Reinducción');

    if (!fs.existsSync(targetPath)) {
       if (fs.existsSync(recursosPath)) {
            const subs = await fsp.readdir(recursosPath);
            const indFolder = subs.find(s => s.includes('1.1') || s.toLowerCase().includes('inducci'));
            if (indFolder) targetPath = path.join(recursosPath, indFolder);
        }
    }

    if (!fs.existsSync(targetPath)) throw new Error('No se encontró la carpeta de inducciones');

    const files = await fsp.readdir(targetPath);
    const excelFile = files.find(f =>
        !f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
        (f.includes('046') || f.toLowerCase().includes('induccion'))
    );

    if (!excelFile) throw new Error('No se encontró el archivo Excel de inducciones (FO-046)');

    const filePath = path.join(targetPath, excelFile);
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1 });

    const inducciones = [];
    // Según backup, los datos reales empiezan en la fila 2 (índice 1)
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        // Empleado en Col G (índice 6)
        const empleado = row[6] ? String(row[6]).trim() : '';
        if (!empleado || empleado === 'Nombre del empleado' || empleado === '') continue;

        // Detener si es la fila de totalizadores
        if (empleado.toLowerCase().includes('total inducciones')) break;

        // Fecha en Col D (índice 3)
        let fecha = row[3];
        if (typeof fecha === 'number') {
            const dateCode = xlsx.SSF.parse_date_code(fecha);
            fecha = `${dateCode.y}-${String(dateCode.m).padStart(2, '0')}-${String(dateCode.d).padStart(2, '0')}`;
        } else if (fecha instanceof Date) {
            fecha = fecha.toISOString().split('T')[0];
        }

        // Mapeo según Backup:
        // Col B (1): Puntaje
        // Col C (2): Estado
        // Col E (4): Año
        // Col H (7): Cédula
        // Col I (8): Cargo
        // Col L (11): Género

        inducciones.push({
            id: i,
            date: fecha || '',
            year: row[4] || '',
            name: empleado,
            idCard: row[7] || 'N/A',
            position: row[8] || 'N/A',
            gender: row[11] || '',
            score: row[1] || '0 / 22',
            status: (row[2] && row[2].toString().toLowerCase().includes('aprob')) ? 'approved' : 'failed'
        });
    }

    return { success: true, data: inducciones, filePath };
  } catch (error) {
    sendLog(`[MAIN] Error en get-inducciones-data: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.on('restart_app', () => {
  log.info('El usuario ha aceptado la actualización. Reiniciando para instalar...');
  // autoUpdater.quitAndInstall(); // TEMPORAL: Comentado
});

// --- FUNCIONES AUXILIARES INTERNAS PARA ESTADÍSTICAS ---

async function getCompanyRootPath(companyName) {
  try {
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    const normalized = companyName.toLowerCase().trim();
    const companyKey = Object.keys(config.companyPaths || {}).find(
      k => k.toLowerCase().trim() === normalized
    );

    if (!companyKey) return null;

    // Preferir la estructura mapeada si existe, sino la ruta raíz
    const companyConfig = config.companyPaths[companyKey];
    return companyConfig.root || companyConfig.ruta_base;
  } catch (e) {
    console.error('Error obteniendo ruta empresa:', e);
    return null;
  }
}

async function calculateCapacitacionesStats(basePath) {
  const stats = {
    totalCapacitaciones: 0,
    programadas: 0,
    realizadas: 0,
    porcentajeCumplimiento: 0,
    mensual: {
        programadas: new Array(12).fill(0),
        realizadas: new Array(12).fill(0)
    }
  };
  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');

    // Búsqueda prioritaria de la carpeta "1.2.1"
    let targetPath = path.join(recursosPath, '1.2.1 Programa de capacitación Anual');

    if (!fs.existsSync(targetPath)) {
        if (fs.existsSync(recursosPath)) {
            const subs = await fsp.readdir(recursosPath);
            // Intentar encontrar carpeta que empiece por 1.2.1 o contenga capacitación
            let capFolder = subs.find(s => s.startsWith('1.2.1') && s.toLowerCase().includes('capacita'));
            if (!capFolder) {
                capFolder = subs.find(s => (s.includes('1.2') || s.includes('Capacita')) && !s.startsWith('.'));
            }
            if (capFolder) targetPath = path.join(recursosPath, capFolder);
        }
    }

    if (!fs.existsSync(targetPath)) return stats;

    const files = await fsp.readdir(targetPath);
    // Buscar archivo cronograma (ACT-FO-005 o similar) de forma insensible a mayúsculas
    const excelFile = files.find(f =>
        (f.toLowerCase().includes('act-fo-005') || f.toLowerCase().includes('cronograma')) &&
        !f.startsWith('~$') &&
        (f.endsWith('.xlsx') || f.endsWith('.xls'))
    );

    if (!excelFile) {
        sendLog(`[WARN] No se encontró archivo de cronograma (ACT-FO-005) en: ${targetPath}`, 'WARN');
        return stats;
    }

    const workbook = xlsx.readFile(path.join(targetPath, excelFile));
    const currentYear = new Date().getFullYear();

    // Buscar hoja del año actual, preferiblemente con "Matriz Cap."
    let sheetName = workbook.SheetNames.find(s =>
        s.toLowerCase().includes('matriz cap') && s.includes(currentYear.toString())
    );

    // Fallback: buscar solo por año
    if (!sheetName) {
        sheetName = workbook.SheetNames.find(s => s.includes(currentYear.toString()));
    }
    // Fallback final: primera hoja
    if (!sheetName) sheetName = workbook.SheetNames[0];

    sendLog(`[INFO] Calculando stats desde archivo: ${excelFile}, Hoja: ${sheetName}`, 'INFO');

    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Empezar en fila 6 (índice 5) igual que el viewer
    let startIndex = 5;

    for (let i = startIndex; i < data.length; i++) {
        const row = data[i];
        if (!Array.isArray(row) || row.length < 2) continue;

        // Columna B (1): Nombre
        const nombre = row[1];
        if (!nombre || typeof nombre !== 'string' || nombre.includes('Nombre de la capacitación')) continue;
        if (nombre.toLowerCase().includes('total')) break;

        stats.totalCapacitaciones++;
        stats.programadas++;

        // Columna D (3): Fecha
        let monthIndex = -1;
        const fechaVal = row[3];
        if (fechaVal) {
            if (typeof fechaVal === 'number') {
                const dateCode = xlsx.SSF.parse_date_code(fechaVal);
                monthIndex = dateCode.m - 1;
            } else if (fechaVal instanceof Date) {
                monthIndex = fechaVal.getMonth();
            } else if (typeof fechaVal === 'string') {
                const parts = fechaVal.split(/[-/]/);
                if (parts.length >= 2) {
                    // Asumir formato dd/mm/yyyy o yyyy-mm-dd
                    const p1 = parseInt(parts[1]);
                    if (p1 >= 1 && p1 <= 12) monthIndex = p1 - 1;
                }
            }
        }

        if (monthIndex >= 0 && monthIndex < 12) {
            stats.mensual.programadas[monthIndex]++;
        }

        // Columna I (8): Estado
        // Verificar específicamente la columna de estado para mayor precisión
        const estadoVal = row[8];
        let isRealizada = false;

        if (estadoVal && typeof estadoVal === 'string') {
            const estadoStr = estadoVal.toLowerCase();
            isRealizada = estadoStr.includes('ejecutado') || estadoStr.includes('realizado') || estadoStr.includes('completado');
        } else {
            // Fallback: Si no hay estado explícito, buscar en la fila pero con cuidado
            // (Deshabilitado para coincidir con la precisión del viewer, pero se puede reactivar si es necesario)
            // const rowStr = JSON.stringify(row).toLowerCase();
            // isRealizada = rowStr.includes('ejecutado') || ...
        }

        if (isRealizada) {
            stats.realizadas++;
            if (monthIndex >= 0 && monthIndex < 12) {
                stats.mensual.realizadas[monthIndex]++;
            }
        }
    }

    if (stats.programadas > 0) {
        stats.porcentajeCumplimiento = Math.round((stats.realizadas / stats.programadas) * 100);
    }

  } catch (e) {
    sendLog(`Error calculando capacitaciones: ${e.message}`, 'WARN');
  }
  return stats;
}

async function calculateInduccionesStats(basePath) {
  const currentYear = new Date().getFullYear();
  const stats = {
    totalInducciones: 0,
    completadas: 0,
    pendientes: 0,
    porcentajeCompletado: 0,
    mensual: new Array(12).fill(0)
  };
  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.1 Inducción y Reinducción');

    if (!fs.existsSync(targetPath)) {
       if (fs.existsSync(recursosPath)) {
            const subs = await fsp.readdir(recursosPath);
            const indFolder = subs.find(s => s.includes('1.1') || s.toLowerCase().includes('inducci'));
            if (indFolder) targetPath = path.join(recursosPath, indFolder);
        }
    }

    if (!fs.existsSync(targetPath)) return stats;

    const files = await fsp.readdir(targetPath);
    // Filtrar archivos Excel que coincidan con ACT-FO-046
    const excelFiles = files.filter(f =>
        !f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
        f.toLowerCase().includes('act-fo-046')
    );

    for (const file of excelFiles) {
        try {
            const wb = xlsx.readFile(path.join(targetPath, file));
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

            // Según backup, los datos reales empiezan en la fila 2 (índice 1)
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row) continue;

                // Empleado en Col G (6)
                const empleado = row[6] ? String(row[6]).trim() : '';
                if (!empleado || empleado.toLowerCase().includes('total')) break;

                // Fecha en Col D (3)
                let rowDate = null;
                const fechaVal = row[3];

                if (fechaVal) {
                    if (typeof fechaVal === 'number') {
                        const dateCode = xlsx.SSF.parse_date_code(fechaVal);
                        rowDate = new Date(dateCode.y, dateCode.m - 1, dateCode.d);
                    } else {
                        const parsed = new Date(fechaVal);
                        if (!isNaN(parsed.getTime())) rowDate = parsed;
                    }
                }

                // Año en Col E (4) como respaldo
                const yearVal = row[4] ? parseInt(row[4]) : null;

                // Contar si es del año actual
                if ((rowDate && rowDate.getFullYear() === currentYear) || yearVal === currentYear) {
                    stats.totalInducciones++;
                    stats.completadas++;
                    if (rowDate) stats.mensual[rowDate.getMonth()]++;
                }
            }
        } catch (err) { continue; }
    }

    // Convertir mensual a acumulado para el gráfico de tendencia
    let cumulative = 0;
    const trendData = [...stats.mensual];
    for (let i = 0; i < 12; i++) {
        cumulative += trendData[i];
        stats.mensual[i] = cumulative;
    }

    stats.porcentajeCompletado = stats.totalInducciones > 0 ? 100 : 0;

  } catch (e) {
    sendLog(`Error calculando inducciones: ${e.message}`, 'WARN');
  }
  return stats;
}

async function calculateEppsStats(basePath) {
  const stats = { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 };
  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.3 EPP'); // O nombre similar

    if (!fs.existsSync(targetPath)) {
       if (fs.existsSync(recursosPath)) {
            const subs = await fsp.readdir(recursosPath);
            const eppFolder = subs.find(s => s.includes('1.3') || s.toLowerCase().includes('epp'));
            if (eppFolder) targetPath = path.join(recursosPath, eppFolder);
        }
    }

    if (!fs.existsSync(targetPath)) return stats;

    const files = await fsp.readdir(targetPath);
    const matrizFile = files.find(f => (f.includes('Matriz') || f.includes('Entrega')) && !f.startsWith('~$') && f.endsWith('.xlsx'));

    if (matrizFile) {
        const wb = xlsx.readFile(path.join(targetPath, matrizFile));
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

        for (let i = 5; i < data.length; i++) {
            const row = data[i];
            if (row && row[1]) { // Si hay item
                stats.totalEPPs++;
                stats.entregados++; // Simplificación
            }
        }
        stats.stockActual = stats.totalEPPs; // Simplificación
    }

  } catch (e) {
    sendLog(`Error calculando EPPs: ${e.message}`, 'WARN');
  }
  return stats;
}

// --- API Estadísticas de Recursos (Implementación Real) ---
ipcMain.handle('get-recursos-stats', async (event, companyName) => {
  try {
    sendLog(`[MAIN] Obteniendo estadísticas REALES de recursos para: ${companyName}`, 'INFO');

    const rootPath = await getCompanyRootPath(companyName);

    if (!rootPath) {
        sendLog(`[MAIN] No se encontró ruta raíz para ${companyName}. Retornando ceros.`, 'WARN');
        return {
            success: true,
            stats: {
                inducciones: { totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0 },
                capacitaciones: { totalCapacitaciones: 0, programadas: 0, realizadas: 0, porcentajeCumplimiento: 0 },
                epps: { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 }
            }
        };
    }

    // Ejecutar cálculos en paralelo
    const [capacitaciones, inducciones, epps] = await Promise.all([
        calculateCapacitacionesStats(rootPath),
        calculateInduccionesStats(rootPath),
        calculateEppsStats(rootPath)
    ]);

    const stats = {
      inducciones,
      capacitaciones,
      epps
    };

    sendLog(`[MAIN] Estadísticas calculadas: ${JSON.stringify(stats)}`, 'DEBUG');
    return { success: true, stats };

  } catch (error) {
    sendLog(`[MAIN] Error crítico en estadísticas: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});


// Manejar la carga del archivo normativa-0312.json
ipcMain.handle('load-normativa', async () => {
  try {
    console.log('Handling load-normativa request');
    const normativaPath = path.join(__dirname, 'components', 'config', 'normativa-0312.json');
    const normativaData = await fsp.readFile(normativaPath, 'utf8');
    console.log('Normativa loaded successfully');
    return JSON.parse(normativaData);
  } catch (error) {
    console.error('Error loading normativa:', error);
    // En caso de error, devolver una estructura vacía o valores por defecto
    return {
      escenarios: {}
    };
  }
});

// Manejar el procesamiento de PDFs de evaluación inicial
ipcMain.handle('process-evaluacion-pdf', async (event, pdfPath, sourceType) => {
  try {
    console.log(`[MAIN] Procesando PDF de evaluación: ${pdfPath}, fuente: ${sourceType}`);

    // Importar el parser de PDFs
    const EvaluacionPdfParser = require('./utils/evaluacionPdfParser');
    const parser = new EvaluacionPdfParser();

    // Procesar el PDF
    const result = await parser.parsePdf(pdfPath, sourceType);

    if (result.success) {
      console.log(`[MAIN] PDF procesado exitosamente: ${result.findings.length} hallazgos encontrados`);
      console.log(`[MAIN] Métricas:`, result.metrics);
    } else {
      console.error(`[MAIN] Error procesando PDF: ${result.error}`);
    }

    return result;

  } catch (error) {
    console.error('[MAIN] Error procesando PDF de evaluación:', error);
    return {
      success: false,
      error: error.message,
      year: new Date().getFullYear().toString(),
      source: sourceType,
      findings: [],
      metrics: { cumplimiento: 0, totalItems: 0, cumplidos: 0, noCumplidos: 0, parcial: 0 }
    };
  }
});

// --- HANDLERS ONLYOFFICE CON JWT ---

// Handler para generar configuración del editor OnlyOffice con JWT
ipcMain.handle('generate-onlyoffice-config', async (event, payload) => {
    const { filePath, fileName, documentKey } = payload;
    
    console.log('LOG: generate-onlyoffice-config');
    
    try {
        // Importar el módulo del Bridge para obtener configuración JWT
        const bridgePath = path.join(__dirname, 'modules', 'gestion-integral', 'politica', 'onlyoffice-bridge.js');
        
        if (!fs.existsSync(bridgePath)) {
            throw new Error('Archivo OnlyOffice Bridge no encontrado');
        }
        
        // Preparar payload para el Bridge
        const http = require('http');
        const bridgePayload = JSON.stringify({
            filePath: filePath,
            fileName: fileName,
            documentKey: documentKey
        });
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3011,
                path: '/get-editor-config',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(bridgePayload)
                }
            };
            
            console.log('[MAIN] Llamando al Bridge para configuración JWT...');
            
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log('[MAIN] Configuracion OnlyOffice generada');
                    
                    try {
                        const response = JSON.parse(data);
                        if (response.success) {
                            resolve(response.config);
                        } else {
                            reject(new Error(response.error || 'Error generando configuración'));
                        }
                    } catch (e) {
                        reject(new Error('Error parseando respuesta del Bridge: ' + e.message));
                    }
                });
            });
            
            req.on('error', (e) => {
                console.error('[MAIN] Error conectando al Bridge:', e.message);
                // Fallback: generar configuración local sin JWT para pruebas
                console.warn('[MAIN] Generando configuración local (sin JWT) como fallback');
                
                // Determinar tipo de documento
                const ext = path.extname(filePath).toLowerCase();
                let documentType = 'word';
                if (['.xls', '.xlsx'].includes(ext)) documentType = 'cell';
                if (['.ppt', '.pptx'].includes(ext)) documentType = 'slide';
                
                const localConfig = {
                    document: {
                        fileType: ext.replace('.', ''),
                        key: documentKey,
                        title: fileName,
                        url: `file://${filePath}`,
                        permissions: {
                            edit: true,
                            download: true,
                            print: true,
                            review: true,
                            comment: true,
                            fillForms: true
                        }
                    },
                    documentType: documentType,
                    editorConfig: {
                        mode: 'edit',
                        lang: 'es-ES',
                        user: { id: 'user-1', name: 'Usuario K+AIR' },
                    customization: { autosave: true, forcesave: true }
                },
                    onlyofficeServerUrl: 'http://localhost:8080'
                };
                
                resolve(localConfig);
            });
            
            req.write(bridgePayload);
            req.end();
        });
        
    } catch (error) {
        console.error('[MAIN] Error generando configuración OnlyOffice:', error);
        return { success: false, error: error.message };
    }
});

// --- INTEGRACIÓN ONLYOFFICE BRIDGE SERVER ---
let onlyofficeBridgeServer = null;

// Función para iniciar el servidor OnlyOffice Bridge al iniciar la app
function startOnlyOfficeBridge() {
    try {
        console.log('[MAIN] 🚀 Iniciando OnlyOffice Bridge...');
        
        // Verificar si el módulo de OnlyOffice Bridge existe
        const bridgePath = path.join(__dirname, 'modules', 'gestion-integral', 'politica', 'onlyoffice-bridge.js');
        console.log(`[MAIN] 🔍 Verificando existencia del archivo bridge: ${bridgePath}`);

        if (fs.existsSync(bridgePath)) {
            console.log('[MAIN] ✅ Archivo bridge encontrado, importando módulo...');
            
            // Importar el módulo del Bridge
            const { startServer } = require(bridgePath);
            
            // Iniciar el servidor Bridge
            startServer().then((server) => {
                onlyofficeBridgeServer = server;
                console.log('[MAIN] ✅ Servidor OnlyOffice Bridge iniciado correctamente');
                console.log('[MAIN] 📊 Estado del servidor:', server.listening ? 'ESCUCHANDO' : 'INACTIVO');
            }).catch((err) => {
                console.error('[MAIN] ❌ Error iniciando servidor Bridge:', err);
            });
        } else {
            console.warn('[MAIN] ⚠️ Archivo OnlyOffice Bridge no encontrado, omitiendo servidor');
        }
    } catch (error) {
        console.error('[MAIN] ❌ Excepción iniciando servidor OnlyOffice Bridge:', error.message);
        console.error('[MAIN] Stack trace:', error.stack);
    }
}

// --- SERVIDOR LLM PARA ANÁLISIS DE ACCIDENTES ---
let llmServerProcess = null;

async function startLlmServer() {
    const http = require('http');
    const LLM_SERVER_HOST = '127.0.0.1';
    const LLM_SERVER_PORT = 5555;
    
    // Función para verificar si el servidor ya está corriendo Y el modelo está cargado
    const checkServerHealth = () => {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: LLM_SERVER_HOST,
                port: LLM_SERVER_PORT,
                path: '/health',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        // Solo retornar true si el modelo está cargado
                        resolve(json.model_loaded === true);
                    } catch {
                        resolve(false);
                    }
                });
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.end();
        });
    };

    try {
        // Verificar si ya está corriendo con modelo cargado
        const isRunning = await checkServerHealth();
        if (isRunning) {
            console.log('[MAIN] ✅ Servidor LLM ya está corriendo con modelo cargado');
            return;
        }

        console.log('[MAIN] 🚀 Iniciando servidor LLM...');
        
        // Obtener ruta de Python
        const pythonPath = global.cachedPythonPath || 'python';
        const serverScript = path.join(__dirname, 'Portear', 'src', 'llm_server.py');
        
        if (!fs.existsSync(serverScript)) {
            console.warn('[MAIN] ⚠️ Script del servidor LLM no encontrado:', serverScript);
            return;
        }

        // Iniciar servidor en background
        llmServerProcess = spawn(pythonPath, [serverScript], {
            cwd: path.dirname(serverScript),
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        
        llmServerProcess.unref();
        
        // Esperar a que el servidor esté listo Y el modelo esté cargado
        console.log('[MAIN] ⏳ Esperando a que el servidor LLM y el modelo estén listos...');
        console.log('[MAIN] ⏳ Esto puede tardar varios minutos (carga del modelo LLM)...');
        
        const maxAttempts = 600; // 20 minutos máximo (600 * 2 segundos)
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const ready = await checkServerHealth();
            if (ready) {
                console.log('[MAIN] ✅ Servidor LLM iniciado correctamente con modelo cargado');
                return;
            }
            if (i % 30 === 0) {
                console.log(`[MAIN] ⏳ Cargando modelo LLM... (${Math.floor(i * 2 / 60)}min ${i * 2 % 60}s)`);
            }
        }
        
        console.warn('[MAIN] ⚠️ Timeout esperando al servidor LLM');
        
    } catch (error) {
        console.error('[MAIN] ❌ Error iniciando servidor LLM:', error.message);
    }
}

// Iniciar el servidor OnlyOffice al iniciar la aplicación
app.whenReady().then(() => {
    createWindow();

    // Iniciar el servidor OnlyOffice Bridge
    startOnlyOfficeBridge();
    
    // NOTA: El servidor LLM ya no se inicia automáticamente.
    // El análisis de accidentes usa spawn directo con Invest_APP_V_3.py
    // que carga el modelo una sola vez usando el patrón Singleton.

    // Iniciar la búsqueda de actualizaciones una vez que la app esté lista
// autoUpdater.checkForUpdatesAndNotify(); // TEMPORAL: Comentado

    app.on('activate', () => {
        // En macOS, es común volver a crear una ventana en la aplicación cuando
        // se hace clic en el ícono del dock y no hay otras ventanas abiertas.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});