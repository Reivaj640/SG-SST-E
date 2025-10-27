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
      
      const result = [];
      for (const item of items) {
        const itemPath = path.join(directoryPath, item.name);
        const stats = await fsp.stat(itemPath);
        
        result.push({
          name: item.name,
          path: itemPath,
          isDirectory: item.isDirectory(),
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        });
      }
      
      console.log('Directory read successfully');
      return result;
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
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
      const submoduleCode = submodule.match(/^[ -]+/);
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
        console.log(`[SUCCESS] Found path for '${companyName}' -> '${module}' -> '${submodule}': ${foundPath}`);
        return { success: true, path: foundPath };
      } else {
        console.log(`[WARN] Path not found for code: ${code} under module '${module}' or root.`);
        return { success: false, error: `Path not found for module: ${module}, submodule: ${submodule} (code: ${code})` };
      }
    } catch (error) {
      console.error('[CRITICAL ERROR] Error in find-submodule-path:', error);
      return { success: false, error: error.message };
    }
  });

  // Función auxiliar para buscar una ruta en la estructura de directorio
  // Busca coincidencias parciales del 'code' (ej. "1.1.1") en el 'name' de los directorios o archivos.
  function searchInStructure(directoryNode, code, depth = 0) {
    // Verificar que directoryNode no sea undefined, null o vacío
    if (!directoryNode || typeof directoryNode !== 'object') {
      console.log(`[searchInStructure] Invalid directory node received. Type: ${typeof directoryNode}`);
      return null;
    }
    
    const indent = "  ".repeat(depth);
    const nodeName = directoryNode.name || 'unnamed directory';
    console.log(`${indent}[searchInStructure] Searching in: ${nodeName} (path: ${directoryNode.path || 'N/A'})`);
    
    // Verificar archivos en el directorio actual
    const files = directoryNode.files || [];
    for (const file of files) {
      if (file && file.name) {
        // console.log(`${indent}  [searchInStructure] Checking file: ${file.name} (includes ${code})`); // Demasiado verbose
        if (file.name.includes(code)) {
          console.log(`${indent}  [searchInStructure] Found FILE match: ${file.path}`);
          return file.path;
        }
      }
    }
    
    // Verificar subdirectorios
    const subdirs = directoryNode.subdirectories || {};
    // console.log(`${indent}  [searchInStructure] Subdirectories found: [${Object.keys(subdirs).join(', ')}]`); // Demasiado verbose
    
    for (const [subDirName, subDirNode] of Object.entries(subdirs)) {
      if (subDirName && subDirNode) {
        // console.log(`${indent}    [searchInStructure] Checking subdirectory: '${subDirName}' (includes '${code}')`); // Demasiado verbose
        // ✅ Buscar coincidencia parcial en el nombre de la carpeta (subDirName)
        if (subDirName.includes(code)) {
          console.log(`${indent}    [searchInStructure] Found DIRECTORY match: ${subDirNode.path}`);
          return subDirNode.path;
        }
        
        // Si no, seguir buscando recursivamente dentro de ese subdirectorio
        const foundPath = searchInStructure(subDirNode, code, depth + 1);
        if (foundPath) {
          return foundPath;
        }
      }
    }
    
    return null;
  }

  // Manejar procesamiento de PDF
  ipcMain.handle('process-remision-pdf', async (event, pdfPath) => {
    sendLog(`IPC: process-remision-pdf recibido para: ${pdfPath}`);
    try {
      const pythonPath = await getPython();
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'process_pdf_cli.py');
      
      sendLog(`Ejecutando script de Python: ${pythonPath} "${pythonScriptPath}" "${pdfPath}"`);
      const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, pdfPath], { cwd: path.dirname(pythonScriptPath) });
      
      if (stderr) {
        sendLog(`Error en script de procesamiento de PDF: ${stderr}`, 'ERROR');
      }

      // Procesar el stream de logs y el resultado final
      let finalResult = null;
      const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
      lines.forEach(line => {
        try {
          const output = JSON.parse(line);
          if (output.type === 'log') {
            sendLog(`[Python] ${output.message}`, output.level);
          } else if (output.type === 'result') {
            finalResult = output.payload; // Estandarizado para usar siempre el payload
          }
        } catch (e) {
          sendLog(`No se pudo parsear la línea de salida de Python: ${line}`, 'WARN');
        }
      });

      if (finalResult) {
        // Log del texto completo del PDF si está presente en el resultado
        if (finalResult.debug_full_text) {
          sendLog(`Texto extraído del PDF ${path.basename(pdfPath)}:\n---\nINICIO ---\n${finalResult.debug_full_text}\n--- FIN ---`, 'DEBUG');
          delete finalResult.debug_full_text;
        }
        sendLog('Procesamiento de PDF completado exitosamente.');
        return finalResult;
      } else {
        throw new Error("El script de Python no devolvió un resultado final.");
      }

    } catch (error) {
      sendLog(`Fallo en la ejecución del script de procesamiento de PDF: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, traceback: error.stack };
    }
  });

  // Manejar conversión de DOCX a PDF para previsualización
  ipcMain.handle('convert-docx-to-pdf', async (event, docxPath) => {
    try {
      const pythonPath = await getPython();
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_docx_to_pdf.py');
      
      console.log(`Executing DOCX conversion for: ${docxPath}`);
      const { stdout, stderr } = await execFilePromise(pythonPath, [pythonScriptPath, docxPath], { cwd: path.dirname(pythonScriptPath) });

      // Si stderr contiene nuestro error JSON específico, lo procesamos como error.
      if (stderr && stderr.includes('"success": false')) {
        try {
          const errJsonMatch = stderr.match(/\{.*\}/s);
          if (errJsonMatch && errJsonMatch[0]) {
            return JSON.parse(errJsonMatch[0]);
          }
          // Fallback si la expresión regular falla
          throw new Error(`Error en script (no se pudo parsear JSON de error): ${stderr}`);
        } catch (e) {
          throw new Error(`Error al procesar error del script: ${stderr}`);
        }
      }

      // Si stderr solo contenía la barra de progreso, lo ignoramos y confiamos en stdout.
      if (!stdout) {
        const errorMessage = stderr ? `El script produjo un error o mensaje inesperado: ${stderr}` : 'El script de conversión no produjo ninguna salida.';
        throw new Error(errorMessage);
      }

      // Buscamos el JSON de éxito en stdout.
      const jsonMatch = stdout.match(/\{.*\}/s);
      if (jsonMatch && jsonMatch[0]) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          throw new Error(`Error al parsear la salida JSON del script: ${e.message}. Salida recibida: ${stdout}`);
        }
      }
      
      throw new Error(`No se encontró una respuesta JSON válida en la salida del script. Salida recibida: ${stdout}`);

    } catch (error) {
      console.error('Error executing DOCX conversion script:', error);
      return { success: false, error: error.message };
    }
  });

  // Manejar selección de archivo PDF
  ipcMain.handle('select-pdf-file', async () => {
    console.log('Handling select-pdf-file request');
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    
    if (result.canceled) {
      console.log('PDF file selection canceled');
      return null;
    }
    
    console.log('Selected PDF file:', result.filePaths[0]);
    return result.filePaths[0];
  });
  
  
  
  // Manejar generación de documento de remisión
  ipcMain.handle('generate-remision-document', async (event, extractedData, empresa) => {
    sendLog(`IPC: generate-remision-document recibido para empresa: ${empresa}`);
    try {
      const pythonPath = await getPython();
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'remision_utils.py');
      const tempDataPath = path.join(app.getPath('temp'), `remision_data_${Date.now()}.json`);
      
      sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
      await fsp.writeFile(tempDataPath, JSON.stringify({ data: extractedData, empresa: empresa }));
      
      const commandArgs = [pythonScriptPath, '--generate-remision', tempDataPath];
      
      sendLog(`Ejecutando script de generación de remisión...`);
      const { stdout, stderr } = await execFilePromise(pythonPath, commandArgs, { cwd: path.dirname(pythonScriptPath) });
      
      await fsp.unlink(tempDataPath);
      
      if (stderr) {
        sendLog(`Error en script de generación de remisión: ${stderr}`, 'ERROR');
      }

      let finalResult = null;
      const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
      lines.forEach(line => {
        try {
          const output = JSON.parse(line);
          if (output.type === 'log') {
            sendLog(`[Python] ${output.message}`, output.level);
          } else if (output.type === 'result') {
            finalResult = output.payload; // Estandarizado para usar siempre el payload
          }
        } catch (e) {
          sendLog(`No se pudo parsear la línea de salida de Python: ${line}`, 'WARN');
        }
      });

      if (!finalResult) {
        throw new Error("El script de Python no devolvió un resultado final.");
      }

      sendLog(`Resultado de la generación: ${JSON.stringify(finalResult)}`);
      
      if (finalResult.success && finalResult.documentPath) {
        const docPath = finalResult.documentPath;
        try {
          await fsp.access(docPath);
        } catch (accessError) {
          // Silencio
        }
        
        try {
          const empresaPaths = {
            "Temposum": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\2. Temposum Est SAS\\3. Gestión de la Salud\\3.1.6 Restricciones y recomendaciones médicas\\3.1.6.1. Remisiones EPS",
            "Tempoactiva": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\1. Tempoactiva Est SAS\\3. Gestión de la Salud\\3.1.6 Restricciones y recomendaciones médicas\\3.1.6.1. Remisiones EPS",
            "Aseplus": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\2. Temporales Comfa\\3. Aseplus\\3. Gestión de la Salud\\3.1.6 Restricciones y recomendaciones médicas\\3.1.6.1. Remisiones EPS",
            "Asel": "G:\\Mi unidad\\2. Trabajo\\1. SG-SST\\19. Asel S.A.S\\3. Gestión de la Salud\\3.1.6 Restricciones y recomendaciones médicas\\3.1.6.1. Remisiones EPS"
          };
          
          const remisionesDir = empresaPaths[empresa] || empresaPaths["Temposum"];
          const files = await fsp.readdir(remisionesDir);
          const docxFiles = files.filter(file => file.endsWith('.docx') && file.includes('GI-OD-007 REMISION A EPS'));
          
          if (docxFiles.length > 0) {
            const fileStats = await Promise.all(docxFiles.map(async (file) => {
              const filePath = path.join(remisionesDir, file);
              const stats = await fsp.stat(filePath);
              return { file, filePath, mtime: stats.mtime };
            }));
            
            fileStats.sort((a, b) => b.mtime - a.mtime);
            const latestFile = fileStats[0];
            
            const tempFileName = `temp_remision_${Date.now()}.docx`;
            const tempFilePath = path.join(app.getPath('temp'), tempFileName);
            
            await fsp.copyFile(latestFile.filePath, tempFilePath);
            finalResult.documentPath = tempFilePath;
            finalResult.originalDocumentPath = latestFile.filePath;
            sendLog(`Documento copiado a ruta temporal: ${tempFilePath}`);
          } else {
            sendLog('No se encontraron archivos de remisión para la copia de seguridad.', 'WARN');
          }
        } catch (searchError) {
          sendLog(`Error buscando el archivo más reciente para la copia: ${searchError.message}`, 'ERROR');
        }
      }
      
      return finalResult;
    } catch (error) {
      sendLog(`Fallo en la ejecución del script de generación de remisión: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  });

  // Manejar envío de remisión por email
  ipcMain.handle('send-remision-by-email', async (event, docPath, extractedData, empresa) => {
    sendLog(`IPC: send-remision-by-email recibido para: ${docPath}`);
    try {
      const pythonPath = await getPython();
      sendLog('Creando copia temporal del archivo para envío de correo...');
      const tempFileName = `temp_remision_${Date.now()}.docx`;
      const tempFilePath = path.join(app.getPath('temp'), tempFileName);
      
      await fsp.copyFile(docPath, tempFilePath);
      sendLog(`Archivo copiado a: ${tempFilePath}`);
      
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'remision_utils.py');
      const tempDataPath = path.join(app.getPath('temp'), `email_data_${Date.now()}.json`);
      const tempData = { 
        docPath: tempFilePath, 
        data: extractedData, 
        empresa: empresa 
      };
      
      sendLog(`Creando archivo de datos temporal para email: ${tempDataPath}`);
      await fsp.writeFile(tempDataPath, JSON.stringify(tempData), 'utf-8');
      
      const commandArgs = [pythonScriptPath, '--send-email', tempDataPath];
      
      sendLog(`Ejecutando script de envío de email...`);
      const { stdout, stderr } = await execFilePromise(pythonPath, commandArgs, { encoding: 'utf-8', cwd: path.dirname(pythonScriptPath) });
      
      await fsp.unlink(tempFilePath);
      await fsp.unlink(tempDataPath);

      if (stderr) {
        sendLog(`Error en script de email (stderr): ${stderr}`, 'ERROR');
      }

      let finalResult = null;
      const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
      lines.forEach(line => {
        try {
          const output = JSON.parse(line);
          if (output.type === 'log') {
            sendLog(`[Python] ${output.message}`, output.level);
          } else if (output.type === 'result') {
            finalResult = output.payload;
          }
        } catch (e) {
          sendLog(`No se pudo parsear la línea de salida de Python: ${line}`, 'WARN');
        }
      });

      if (finalResult) {
        sendLog(`Resultado del envío de email: ${JSON.stringify(finalResult)}`);
        return finalResult;
      } else {
        throw new Error("El script de Python no devolvió un resultado final.");
      }

    } catch (error) {
      sendLog(`Fallo en la ejecución del script de email: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  });
  
  
// Clase para manejar Excel en tiempo real - VERSIÓN SIMPLIFICADA Y ROBUSTA
class RealTimeExcelManager {
  constructor(filePath) {
    sendLog(`[DEBUG] Constructor recibió filePath: "${filePath}"`);
    this.originalFilePath = filePath;
    
    // Obtenemos la ruta para PowerShell desde el inicio.
    // Esta será la única ruta que usaremos.
    this.filePath = this.getPowerShellSafePath(filePath);
    
    this.workbook = new ExcelJS.Workbook();
    this.worksheet = null;
    this.isUpdating = false;
    this.pendingUpdates = new Map();
    this.formulaCells = new Set();
    this.isInitialized = false;

    if (!fsSync.existsSync(this.filePath)) {
      throw new Error(`Archivo no encontrado en la ruta segura generada: "${this.filePath}"`);
    }
    sendLog(`[DEBUG] Usando ruta final segura: "${this.filePath}"`);
  }

  async forceRecalculationFinal() {
    try {
      if (!fsSync.existsSync(this.filePath)) {
        throw new Error(`Archivo no existe antes del recálculo: "${this.filePath}"`);
      }

      const psPath = this.getEscapedPathForScript();
      sendLog(`[DEBUG] Usando ruta optimizada y escapada para PowerShell: "${psPath}"`);

      const script = `
$ErrorActionPreference = "Stop"

Write-Host "=== EXCEL RECALCULATION SCRIPT (Encoded) ==="
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"

try {
    $filePath = '${psPath}'
    Write-Host "Archivo a procesar: $filePath"
    
    if (-not (Test-Path -LiteralPath $filePath)) {
        throw "CRITICAL: Archivo no encontrado en ruta: $filePath"
    }
    
    $fileInfo = Get-Item -LiteralPath $filePath
    Write-Host "Archivo verificado: $($fileInfo.FullName)"
    
    Write-Host "Iniciando aplicación Excel..."
    $excel = New-Object -ComObject Excel.Application -ErrorAction Stop
    
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false
    $excel.EnableEvents = $false
    
    Write-Host "Abriendo workbook..."
    $workbook = $excel.Workbooks.Open($filePath, 0, $false, [Type]::Missing, [Type]::Missing, [Type]::Missing, $true)
    
    $excel.Calculation = -4105
    Write-Host "Ejecutando CalculateFullRebuild..."
    $excel.CalculateFullRebuild()
    
    Write-Host "Esperando finalización del cálculo..."
    $maxWaitSeconds = 45
    $checkIntervalMs = 200
    $totalWaited = 0
    
    do {
        Start-Sleep -Milliseconds $checkIntervalMs
        $totalWaited += $checkIntervalMs
        $waitedSeconds = $totalWaited / 1000
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host "ADVERTENCIA: Timeout alcanzado después de $maxWaitSeconds segundos"
            break
        }
    } while ($excel.CalculationState -ne -4143)
    
    $workbook.Save()
    $workbook.Close($false)
    
    Write-Output "SUCCESS - Excel recalculation completed"
    
} catch {
    $errorMsg = $_.Exception.Message
    $errorLine = $_.InvocationInfo.ScriptLineNumber
    Write-Error "SCRIPT ERROR at line $errorLine\`: $errorMsg"
    throw "Excel processing failed: $errorMsg"
} finally {
    if ($workbook) { try { $workbook.Close($false) } catch {} }
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {}}
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
      `;

      const encodedCommand = Buffer.from(script, 'utf16le').toString('base64');

      return await new Promise((resolve, reject) => {
        const ps = spawn('powershell', [
          '-NoProfile',
          '-NonInteractive',
          '-EncodedCommand',
          encodedCommand
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { ...process.env, POWERSHELL_TELEMETRY_OPTOUT: '1' }
        });

        let output = '';
        let errorOutput = '';

        const timeout = setTimeout(() => {
          ps.kill('SIGTERM');
          setTimeout(() => ps.kill('SIGKILL'), 5000);
          reject(new Error('Timeout: Excel recalculation took too long (60s)'));
        }, 60000);

        ps.stdout.on('data', (data) => {
          const text = data.toString('utf8');
          output += text;
          sendLog(`[PS OUT] ${text.trim()}`);
        });

        ps.stderr.on('data', (data) => {
          const text = data.toString('utf8');
          errorOutput += text;
          sendLog(`[PS ERR] ${text.trim()}`, 'ERROR');
        });

        ps.on('close', (code) => {
          clearTimeout(timeout);
          if (code === 0 && output.includes('SUCCESS')) {
            sendLog('[SUCCESS] Excel recálculo exitoso con -EncodedCommand');
            resolve();
          } else {
            const errorMsg = `PowerShell failed with code ${code}. Error: ${errorOutput}`;
            sendLog(`[ERROR] ${errorMsg}`, 'ERROR');
            reject(new Error(errorMsg));
          }
        });

        ps.on('error', (err) => {
          clearTimeout(timeout);
          sendLog(`[ERROR] PowerShell process error: ${err.message}`, 'ERROR');
          reject(err);
        });
      });

    } catch (error) {
      throw error;
    }
  }



  /**
   * Obtiene la ruta más segura para PowerShell.
   * Estrategia: Prioriza la ruta corta nativa de Node.js. Si falla, usa la original.
   */
  getPowerShellSafePath(originalPath) {
    // 1. La mejor y más eficiente estrategia: fs.realpathSync.native
    try {
      const nativeShortPath = fsSync.realpathSync.native(originalPath);
      if (nativeShortPath && fsSync.existsSync(nativeShortPath)) {
        sendLog(`[SUCCESS] Estrategia de ruta corta nativa funcionó: "${nativeShortPath}"`);
        return nativeShortPath;
      }
    } catch (error) {
      sendLog(`[WARN] Estrategia de ruta corta nativa falló: ${error.message}. Se intentará la normalización manual.`);
    }

    // 2. Fallback: Normalización manual de caracteres problemáticos.
    // Esto es un parche necesario porque la ruta corta no está disponible (posiblemente por ser una unidad de red como Google Drive)
    // y la cadena de ruta llega con la codificación dañada.
    let normalizedPath = path.normalize(originalPath);
    const corrections = {
        'Gestio╠ün': 'Gestion',
        'Medicio╠ün': 'Medicion',
        'Administracio╠ün': 'Administracion',
        'cio╠ün': 'cion',
        'o╠ün': 'on',
        'a╠ün': 'an',
        'e╠ün': 'en',
        'i╠ün': 'in',
        'u╠ün': 'un'
    };
    
    let appliedCorrections = false;
    for (const [bad, good] of Object.entries(corrections)) {
        if (normalizedPath.includes(bad)) {
            normalizedPath = normalizedPath.replace(new RegExp(bad, 'g'), good);
            appliedCorrections = true;
        }
    }

    if(appliedCorrections) {
        sendLog(`[DEBUG] Ruta corregida manualmente: "${normalizedPath}"`);
    }

    return normalizedPath;
  }

  /**
   * Prepara la ruta para ser insertada en el string del script de PowerShell.
   * La única manipulación necesaria es escapar comillas simples.
   */
  getEscapedPathForScript() {
    return this.filePath.replace(/'/g, "''");
  }

  async debugPathResolution() {
    console.log('\n=== DEBUGGING HÍBRIDO DE RUTAS v2 ===');
    console.log(`1. Ruta original: "${this.originalFilePath}"`);
    console.log(`2. Ruta final seleccionada: "${this.filePath}"`);
    console.log(`3. Ruta para PowerShell (escapada): "${this.getEscapedPathForScript()}"`);
    
    console.log('\n=== VERIFICACIONES ===');
    console.log(`7. Archivo existe (ruta final): ${fsSync.existsSync(this.filePath)}`);
    console.log(`8. Ruta absoluta: ${path.isAbsolute(this.filePath)}`);
    
    if (fsSync.existsSync(this.filePath)) {
      const stats = fsSync.statSync(this.filePath);
      console.log(`9. Tamaño del archivo: ${stats.size} bytes`);
      console.log(`10. Última modificación: ${stats.mtime}`);
    }
    
    console.log('=== FIN DEBUGGING HÍBRIDO ===\n');
  }

  async forceExcelRecalculationWithTempScript() {
    const tempScriptPath = path.join(os.tmpdir(), `excel_recalc_${Date.now()}.ps1`);
    try {
      if (!fsSync.existsSync(this.filePath)) {
        throw new Error(`Archivo no existe antes del recálculo: "${this.filePath}"`);
      }

      const psPath = this.getEscapedPathForScript();
      sendLog(`[DEBUG] Usando ruta optimizada para PowerShell: "${psPath}"`);

      const script = `
# Configuración de codificación mejorada
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

Write-Host "=== EXCEL RECALCULATION SCRIPT ==="
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "Current Encoding: $([System.Text.Encoding]::Default.EncodingName)"

try {
    $filePath = '${psPath}'
    Write-Host "Archivo a procesar: $filePath"
    
    if (-not (Test-Path -LiteralPath $filePath)) {
        throw "CRITICAL: Archivo no encontrado en ruta: $filePath"
    }
    
    $fileInfo = Get-Item -LiteralPath $filePath
    Write-Host "Archivo verificado: $($fileInfo.FullName)"
    
    Write-Host "Iniciando aplicación Excel..."
    try {
        $excel = New-Object -ComObject Excel.Application -ErrorAction Stop
    } catch {
        throw "ERROR: No se pudo crear Excel COM Object: $($_.Exception.Message)"
    }
    
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false
    $excel.EnableEvents = $false
    
    Write-Host "Abriendo workbook..."
    try {
        $workbook = $excel.Workbooks.Open($filePath, 0, $false, [Type]::Missing, [Type]::Missing, [Type]::Missing, $true)
    } catch {
        throw "ERROR: No se pudo abrir el workbook: $($_.Exception.Message)"
    }
    
    $excel.Calculation = -4105
    Write-Host "Ejecutando CalculateFullRebuild..."
    $excel.CalculateFullRebuild()
    
    Write-Host "Esperando finalización del cálculo..."
    $maxWaitSeconds = 45
    $checkIntervalMs = 200
    $totalWaited = 0
    
    do {
        Start-Sleep -Milliseconds $checkIntervalMs
        $totalWaited += $checkIntervalMs
        $waitedSeconds = $totalWaited / 1000
        
        if ($waitedSeconds -ge $maxWaitSeconds) {
            Write-Host "ADVERTENCIA: Timeout alcanzado después de $maxWaitSeconds segundos"
            break
        }
    } while ($excel.CalculationState -ne -4143)
    
    $workbook.Save()
    $workbook.Close($false)
    
    Write-Output "SUCCESS - Excel recalculation completed"
    
} catch {
    $errorMsg = $_.Exception.Message
    $errorLine = $_.InvocationInfo.ScriptLineNumber
    Write-Error "SCRIPT ERROR at line $errorLine\`: $errorMsg"
    throw "Excel processing failed: $errorMsg"
} finally {
    if ($workbook) { try { $workbook.Close($false) } catch {} }
    if ($excel) {
        try {
            $excel.Quit()
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        } catch {}
    }
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
      `;

      await fsp.writeFile(tempScriptPath, script, { encoding: 'utf8' });

      return await new Promise((resolve, reject) => {
        const ps = spawn('powershell', [
          '-ExecutionPolicy', 'Bypass',
          '-NoProfile',
          '-NoLogo',
          '-NonInteractive',
          '-File', tempScriptPath
        ], {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          env: { 
            ...process.env, 
            POWERSHELL_TELEMETRY_OPTOUT: '1',
            PYTHONIOENCODING: 'utf-8',
            LC_ALL: 'en_US.UTF-8'
          }
        });

        let output = '';
        let errorOutput = '';

        const timeout = setTimeout(() => {
          ps.kill('SIGTERM');
          setTimeout(() => ps.kill('SIGKILL'), 5000);
          reject(new Error('Timeout: Excel recalculation took too long (60s)'));
        }, 60000);

        ps.stdout.on('data', (data) => {
          const text = data.toString('utf8');
          output += text;
          sendLog(`[PS OUT] ${text.trim()}`);
        });

        ps.stderr.on('data', (data) => {
          const text = data.toString('utf8');
          errorOutput += text;
          sendLog(`[PS ERR] ${text.trim()}`, 'ERROR');
        });

        ps.on('close', async (code) => {
          clearTimeout(timeout);
          try { await fsp.unlink(tempScriptPath); } catch (e) { /* ignore */ }

          if (code === 0 && output.includes('SUCCESS')) {
            sendLog('[SUCCESS] Excel recálculo exitoso con solución simplificada');
            resolve();
          } else {
            const errorMsg = `PowerShell failed with code ${code}. Error: ${errorOutput}`;
            sendLog(`[ERROR] ${errorMsg}`, 'ERROR');
            reject(new Error(errorMsg));
          }
        });

        ps.on('error', (err) => {
          clearTimeout(timeout);
          sendLog(`[ERROR] PowerShell process error: ${err.message}`, 'ERROR');
          reject(err);
        });
      });

    } catch (error) {
      try { await fsp.unlink(tempScriptPath); } catch (e) {}
      throw error;
    }
  }

  async initialize() {
    if (this.isInitialized) {
      sendLog(`[DEBUG] Excel Manager ya está inicializado para: ${this.filePath}`);
      return;
    }
    sendLog(`[DEBUG] Inicializando Excel Manager para: ${this.filePath}`);
    await this.debugPathResolution();
    await this.loadWorkbook();
    this.detectFormulaCells();
    this.isInitialized = true;
    sendLog(`[DEBUG] Inicializado. Fórmulas detectadas: ${Array.from(this.formulaCells).join(', ')}`);
  }

  async loadWorkbook() {
    await this.workbook.xlsx.readFile(this.filePath);
    this.worksheet = this.workbook.worksheets[0];
  }

  detectFormulaCells() {
    this.formulaCells.clear();
    if (!this.worksheet) return;
    this.worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell && cell.formula) {
          const cellAddress = this.getCellAddress(rowNumber, colNumber);
          this.formulaCells.add(cellAddress);
        }
      });
    });
  }

  getCellAddress(row, col) {
    return this.worksheet.getCell(row, col).address;
  }

  async updateCellAndRecalculate(cellAddress, value) {
    if (this.isUpdating) {
      this.pendingUpdates.set(cellAddress, value);
      return await this.waitForCurrentUpdate();
    }

    this.isUpdating = true;
    sendLog(`[DEBUG] Actualizando celda ${cellAddress} con valor: ${value}`);

    try {
      await this.loadWorkbook();
      this.worksheet.getCell(cellAddress).value = value;
      await this.workbook.xlsx.writeFile(this.filePath);
      
      await this.forceRecalculationFinal();
      
      const updatedData = await this.getCurrentData();
      await this.processPendingUpdates();
      return updatedData;
    } catch (error) {
      sendLog(`[ERROR] Error actualizando celda: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  async getCurrentData() {
    await this.loadWorkbook();
    const data = [];
    const formulaResults = {};

    this.worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const cellAddress = this.getCellAddress(rowNumber, colNumber);
        let cellValue = cell.value;

        if (cell && cell.formula) {
          formulaResults[cellAddress] = {
            formula: cell.formula,
            value: cellValue,
            calculated: true
          };
        }

        if (cellValue && typeof cellValue === 'object') {
          if (cellValue.formula) {
            cellValue = cellValue.result || cellValue.value || '';
          } else if (cellValue.text) {
            cellValue = cellValue.text;
          }
        }

        rowData.push(cellValue != null ? cellValue : '');
      });
      data.push(rowData);
    });

    return { data, formulaResults, timestamp: Date.now() };
  }

  async processPendingUpdates() {
    if (this.pendingUpdates.size === 0) return;
    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();
    for (const [cellAddress, value] of updates) {
      await this.updateCellAndRecalculate(cellAddress, value);
    }
  }

  async waitForCurrentUpdate() {
    return new Promise((resolve) => {
      const checkUpdate = () => {
        if (!this.isUpdating) {
          resolve(this.getCurrentData());
        } else {
          setTimeout(checkUpdate, 100);
        }
      };
      checkUpdate();
    });
  }
}

// ----------------------
// ExcelManagerRegistry
// ----------------------
class ExcelManagerRegistry {
  constructor() {
    this.instances = new Map(); // resolvedPath -> manager
    this.activeManager = null;
  }

  async getOrCreateManager(filePath) {
    const resolvedPath = path.resolve(filePath);

    if (this.instances.has(resolvedPath)) {
      sendLog(`[DEBUG] Reutilizando instancia existente para: ${resolvedPath}`);
      const existingManager = this.instances.get(resolvedPath);
      this.activeManager = existingManager;
      if (!existingManager.isInitialized) {
        await existingManager.initialize();
      }
      return existingManager;
    }

    sendLog(`[DEBUG] Creando nueva instancia para: ${resolvedPath}`);
    const manager = new RealTimeExcelManager(resolvedPath);
    await manager.initialize();
    this.instances.set(resolvedPath, manager);
    this.activeManager = manager;
    return manager;
  }

  getActiveManager() {
    return this.activeManager;
  }

  clearInstances() {
    this.instances.clear();
    this.activeManager = null;
  }
}

const excelRegistry = new ExcelManagerRegistry();

// ----------------------
// IPC Handlers
// ----------------------

// limpiar manejadores previos (si existían)
try {
  ipcMain.removeHandler('init-excel');
  ipcMain.removeHandler('update-excel-cell');
  ipcMain.removeHandler('diagnose-excel-path');
} catch (e) { /* ignore */ }

ipcMain.handle('init-excel', async (event, filePath) => {
  try {
    sendLog(`[DEBUG] init-excel ruta: ${filePath}`);
    if (!fsSync.existsSync(filePath)) {
      throw new Error(`El archivo no existe en la ruta especificada: ${filePath}`);
    }
    const stats = fsSync.statSync(filePath);
    const manager = await excelRegistry.getOrCreateManager(filePath);
    const data = await manager.getCurrentData();
    return {
      success: true,
      data,
      fileInfo: { path: filePath, size: stats.size, modified: stats.mtime }
    };
  } catch (error) {
    sendLog(`Error inicializando Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message, stack: error.stack };
  }
});

ipcMain.handle('update-excel-cell', async (event, { cellAddress, value }) => {
  try {
    let manager = excelRegistry.getActiveManager();
    if (!manager) throw new Error('Excel Manager no está inicializado. Llama a init-excel primero.');
    if (!manager.isInitialized) await manager.initialize();
    const result = await manager.updateCellAndRecalculate(cellAddress, value);
    return { success: true, data: result, cellAddress, value, timestamp: Date.now() };
  } catch (error) {
    sendLog(`Error actualizando celda: ${error.message}`, 'ERROR');
    return { success: false, error: error.message, stack: error.stack, cellAddress, value };
  }
});

ipcMain.handle('diagnose-excel-path', async (event, filePath) => {
  try {
    const resolvedPath = path.resolve(filePath);
    const exists = fsSync.existsSync(resolvedPath);
    let fileInfo = null;
    if (exists) {
      const stats = fsSync.statSync(resolvedPath);
      fileInfo = { size: stats.size, modified: stats.mtime, isFile: stats.isFile(), isDirectory: stats.isDirectory() };
    }
    const hasInstance = excelRegistry.instances.has(resolvedPath);
    const activeManager = excelRegistry.getActiveManager();
    return {
      originalPath: filePath,
      resolvedPath,
      exists,
      fileInfo,
      pathSeparator: path.sep,
      platform: process.platform,
      registry: { hasInstance, hasActiveManager: !!activeManager, totalInstances: excelRegistry.instances.size }
    };
  } catch (error) {
    return { error: error.message, originalPath: filePath };
  }
});

module.exports = {
  RealTimeExcelManager,
  ExcelManagerRegistry,
  excelRegistry
};

  // --- Nuevos manejadores IPC para procesamiento de accidentes ---
  
  // Manejar selección de PDF de accidente
  ipcMain.handle('select-accident-pdf', async () => {
    try {
      console.log('Handling select-accident-pdf request');
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      
      if (result.canceled) {
        console.log('Accident PDF selection canceled');
        return null;
      }
      
      console.log('Selected accident PDF:', result.filePaths[0]);
      return result.filePaths[0];
    } catch (error) {
      console.error('Error selecting accident PDF:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('process-accident-pdf', async (event, pdfPath) => {
    const pythonPath = await getPython();
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
    return new Promise((resolve, reject) => {
      sendLog(`IPC: process-accident-pdf (extract) recibido para: ${pdfPath}`);
      
      const pythonProcess = spawn(pythonPath, [pythonScriptPath, 'extract', '--pdf_path', pdfPath], { cwd: path.dirname(pythonScriptPath) });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        const lines = stdoutData.split('\n');
        stdoutData = lines.pop();

        lines.forEach(line => {
          if (line) {
            try {
              const json = JSON.parse(line);
              if (json.type === 'progress') {
                event.sender.send('accident-processing-progress', json);
              } else if (json.type === 'result') {
                resolve(json.payload);
              }
            } catch (e) {
              sendLog(`Error parsing python output: ${e.message}`, 'WARN');
            }
          }
        });
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        sendLog(`Python stderr: ${data}`, 'ERROR');
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
  });

  ipcMain.handle('analyze-accident', async (event, extractedData, contextoAdicional) => {
    const pythonPath = await getPython();
    const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
    return new Promise((resolve, reject) => {
      sendLog(`IPC: analyze-accident recibido`);
      
      const jsonData = JSON.stringify(extractedData);
      const pythonProcess = spawn(pythonPath, [pythonScriptPath, 'analyze', '--json_data', jsonData, '--contexto', contextoAdicional], { cwd: path.dirname(pythonScriptPath) });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        const lines = stdoutData.split('\n');
        stdoutData = lines.pop();

        lines.forEach(line => {
          if (line) {
            try {
              const json = JSON.parse(line);
              if (json.type === 'progress') {
                event.sender.send('accident-processing-progress', json);
              } else if (json.type === 'result') {
                resolve(json.payload);
              }
            } catch (e) {
              sendLog(`Error parsing python output: ${e.message}`, 'WARN');
            }
          }
        });
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        sendLog(`Python stderr: ${data}`, 'ERROR');
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
        }
      });

      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
  });
  // En main.js, dentro de registerIPCHandlers()
  ipcMain.handle('start-model-loading', async () => {
      try {
          console.log('Iniciando carga del modelo LLM en segundo plano...');
          // Aquí podrías ejecutar un script que inicie un proceso Python separado
          // o simplemente lanzar el comando de carga con un tiempo de espera.
          // Por simplicidad, vamos a simularlo con un timeout.
          await new Promise(resolve => setTimeout(resolve, 5000)); // Simula 5 segundos de carga
          console.log('Modelo LLM cargado en segundo plano.');
          return { success: true };
      } catch (error) {
          console.error('Error al iniciar la carga del modelo:', error);
          return { success: false, error: error.message };
      }
  });

  // --- Manejar generación de informe de accidente ---
  ipcMain.handle('generate-accident-report', (event, combinedData) => {
    return new Promise(async (resolve, reject) => {
      sendLog(`IPC: generate-accident-report recibido`);
      let tempDataPath;
      try {
        const pythonPath = await getPython();
        // Crear archivo temporal con los datos
        tempDataPath = path.join(app.getPath('temp'), `accident_report_data_${Date.now()}.json`);
        
        const reportData = {
          combinedData: combinedData,
          empresa: combinedData.empresa || 'TEMPOACTIVA'
        };
        
        sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
        await fsp.writeFile(tempDataPath, JSON.stringify(reportData, null, 2));
        
        const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_report_generator.py');

        // Verificar que el script existe
        await fsp.access(pythonScriptPath);
        
        sendLog(`Ejecutando script con UTF-8 forzado: ${pythonPath} -X utf8 "${pythonScriptPath}"`);

        const pythonProcess = spawn(pythonPath, [
          '-X', 'utf8',
          pythonScriptPath,
          tempDataPath
        ], { cwd: path.dirname(pythonScriptPath) });

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
          stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          // Loguear errores de Python en tiempo real
          const stderrLine = data.toString();
          stderrData += stderrLine;
          sendLog(`[Python STDERR] ${stderrLine}`, 'ERROR');
        });

        pythonProcess.on('close', async (code) => {
          sendLog(`Proceso de Python terminado con código: ${code}`);
          
          // Limpiar archivo temporal
          if (tempDataPath) {
            await fsp.unlink(tempDataPath).catch(err => sendLog(`No se pudo limpiar el archivo temporal: ${err.message}`, 'WARN'));
          }

          if (code !== 0) {
            return reject(new Error(`El script de Python falló con código ${code}. Revisa los logs de STDERR.`));
          }

          // Procesar la salida estándar para encontrar el resultado JSON final
          let finalResult = null;
          const lines = stdoutData.split(/\r?\n/).filter(line => line.trim() !== '');
          
          for (const line of lines) {
            try {
              const output = JSON.parse(line);
              if (output.type === 'progress') {
                sendLog(`[Python Progress] ${output.message}`, 'INFO');
              } else if (output.success !== undefined) {
                finalResult = output;
              }
            } catch (e) {
              sendLog(`No se pudo parsear la línea de salida de Python (stdout): ${line}`, 'WARN');
            }
          }

          if (finalResult) {
            // Limpiar el prefijo de ruta larga de Windows si existe, para que sea usable por el frontend.
            if (finalResult.documentPath && finalResult.documentPath.startsWith('\\\\?\\')) {
              finalResult.documentPath = finalResult.documentPath.substring(4);
              console.log('Path corregido:', finalResult.documentPath);
            }
            // Asegurar que los separadores de ruta son los correctos para el OS actual.
            finalResult.documentPath = finalResult.documentPath.replace(/[\\\/]/g, path.sep);

            sendLog(`Resultado de la generación: ${JSON.stringify(finalResult)}`);
            resolve(finalResult);
          } else {
            reject(new Error(`El script de Python no devolvió un resultado JSON válido en stdout.`));
          }
        });

        pythonProcess.on('error', (err) => {
          sendLog(`Fallo al iniciar el proceso de Python: ${err.message}`, 'CRITICAL');
          reject(err);
        });

      } catch (error) {
        sendLog(`Fallo en la ejecución del script de generación de informe: ${error.message}`, 'ERROR');
        if (tempDataPath) {
          await fsp.unlink(tempDataPath).catch(err => sendLog(`No se pudo limpiar el archivo temporal tras error: ${err.message}`, 'WARN'));
        }
        reject(error);
      }
    });
  });

  ipcMain.handle('get-config', async (event, empresa) => {
      const pythonPath = await getPython();
      const investAppPath = path.join(__dirname, 'Portear', 'src', 'Invest_APP_V_3.py');
      const { stdout } = await execFilePromise(pythonPath, [investAppPath, '--get-config', empresa], { cwd: path.dirname(investAppPath) });
      return JSON.parse(stdout.trim());
  });

  // Manejador para leer la plantilla de acta de COPASST
  ipcMain.handle('get-acta-data', async () => {
    try {
        // Ruta a la plantilla de Excel
        const templatePath = path.join(__dirname, 'utils', 'ACT-FO-029 Acta de Reunión Copasst Enero.xlsx');
        console.log(`[INFO] Leyendo plantilla de acta desde: ${templatePath}`);

        // Verificar que el archivo existe
        await fsp.access(templatePath);

        // Leer el archivo Excel
        const workbook = xlsx.readFile(templatePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir la hoja a un arreglo de datos
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        // Obtener las celdas combinadas (merges)
        const merges = worksheet['!merges'] || [];

        console.log(`[SUCCESS] Plantilla cargada. Filas: ${data.length}, Merges: ${merges.length}`);
        return {
            success: true,
            data,
            merges
        };
    } catch (error) {
        console.error('[ERROR] Error al cargar la plantilla del acta:', error);
        return {
            success: false,
            error: error.message
        };
    }
  });

// Manejador para leer datos de ausentismo desde Excel
ipcMain.handle('get-ausentismo-data', async (event, companyName) => {
    sendLog(`[DEBUG] Handler get-ausentismo-data llamado para empresa: ${companyName}`);
    sendLog(`[TEST] Este log debería aparecer si el handler se llama.`);

    try {
      // --- Cargar configuración ---
      const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
      const config = JSON.parse(configData);

      // --- Obtener la estructura real de la empresa (como en find-submodule-path) ---
      const companyConfig = config.companyPaths?.[companyName];
      if (!companyConfig || !companyConfig.structure?.structure) {
        const available = Object.keys(config.companyPaths || {});
        throw new Error(`Empresa "${companyName}" no tiene estructura mapeada. Disponibles: [${available.join(', ')}]`);
      }

      const rootStructure = companyConfig.structure.structure;

      // --- Función auxiliar: buscar carpeta de forma flexible ---
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

      // --- Buscar "3. Gestión de la Salud" ---
      const gestionSalud = findDirFlexible(rootStructure.subdirectories, "3. Gestión de la Salud");
      if (!gestionSalud) {
        const keys = Object.keys(rootStructure.subdirectories || {});
        throw new Error(`No se encontró "3. Gestión de la Salud". Carpetas: [${keys.join(', ')}]`);
      }

      // --- Buscar el submódulo de ausentismo ---
      const ausentismoDir = findDirFlexible(
        gestionSalud.subdirectories,
        "3.3.6 Medición del ausentismo por causa médica"
      );
      if (!ausentismoDir) {
        const keys = Object.keys(gestionSalud.subdirectories || {});
        throw new Error(`No se encontró submódulo de ausentismo. Carpetas: [${keys.join(', ')}]`);
      }

      // --- Obtener el primer archivo .xlsx ---
      const excelFiles = (ausentismoDir.files || []).filter(f => f.extension?.toLowerCase() === '.xlsx');
      if (excelFiles.length === 0) {
        throw new Error(`No hay archivos .xlsx en la carpeta de ausentismo.`);
      }

      const excelFile = excelFiles[0];
      sendLog(`[DEBUG] Archivo de ausentismo encontrado: ${excelFile.path}`);

      // --- Leer Excel ---
      const workbook = xlsx.readFile(excelFile.path);
      console.log('[DEBUG] Nombres de hojas en el archivo:', workbook.SheetNames);

      // Buscar la hoja que contiene los datos según el nombre de la empresa
      const normalizedCompanyName = companyName.toLowerCase().replace(/\s+/g, '');
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes(normalizedCompanyName) && name.toLowerCase().includes('2024')
      ) || workbook.SheetNames[0]; // Si no encuentra, usa la primera

      console.log('[DEBUG] Hoja seleccionada:', sheetName);
      const worksheet = workbook.Sheets[sheetName];
      console.log('[DEBUG] !ref de la hoja:', worksheet['!ref']);

      if (!worksheet['!ref']) {
        sendLog('[WARN] La hoja de cálculo de ausentismo parece estar vacía (sin !ref).');
        return { success: true, headers: [], rows: [], filePath: excelFile.path, companyName };
      }

      // --- Usar la fila 7 (índice 6) como encabezado, ya que sabemos que está ahí ---
      const allData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });

      // Intenta leer la hoja como JSON y ver si tiene datos
      console.log('[DEBUG] Total de filas leídas:', allData.length);
      console.log('[DEBUG] Primeras 5 filas:', allData.slice(0, 5));

      // Log adicional para ver cuántas filas hay
      sendLog(`[DEBUG] Total de filas en el archivo: ${allData.length}`);
      sendLog(`[DEBUG] allData primeras 10 filas: ${JSON.stringify(allData.slice(0, 10))}`);
      if (allData.length > 6) {
        sendLog(`[DEBUG] allData fila 7 (índice 6): ${JSON.stringify(allData[6])}`);
      }

      // Verificar que haya al menos 7 filas
      if (allData.length <= 6) {
        sendLog('[WARN] No hay suficientes filas para encontrar el encabezado en la fila 7.');
        return { success: true, headers: [], rows: [], filePath: excelFile.path, companyName };
      }

      // Fila 7 (índice 6) es el encabezado
      const headerRowIndex = 6;
      const headers = allData[headerRowIndex];

      // Validar que tenga al menos 4 columnas
      if (!headers || headers.filter(cell => cell !== null).length < 4) {
        sendLog('[WARN] La fila 7 no parece ser un encabezado válido (menos de 4 columnas).');
        return { success: true, headers: [], rows: [], filePath: excelFile.path, companyName };
      }

      sendLog(`[INFO] Encabezado fijo tomado de la fila 7 (índice ${headerRowIndex}).`);
      sendLog(`[DEBUG] Encabezado detectado: ${JSON.stringify(headers)}`);

      // Filtrar filas que no tengan al menos la mitad de las columnas del encabezado
      const rows = allData.slice(headerRowIndex + 1)
                          .filter(row => row && row.filter(cell => cell !== null).length >= (headers.length / 2));

      // Limitar las columnas a mostrar (por ejemplo, hasta la columna S = índice 18)
      const maxColumnsToShow = 19; // Columna S es índice 18 (0-based)
      const limitedHeaders = headers.slice(0, maxColumnsToShow);
      const limitedRows = rows.map(row => row.slice(0, maxColumnsToShow));

      sendLog(`[DEBUG] Total de filas filtradas: ${limitedRows.length}`);
      if (limitedRows.length > 0) {
        sendLog(`[DEBUG] Primera fila de datos: ${JSON.stringify(limitedRows[0])}`);
      }

      return {
        success: true,
        headers: limitedHeaders,
        rows: limitedRows,
        filePath: excelFile.path,
        companyName
      };

    } catch (error) {
      sendLog(`[ERROR] Error crítico en get-ausentismo-data: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, companyName };
    }
  });

  // Manejador para leer la plantilla de acta de Comité de Convivencia
  ipcMain.handle('getConvivenciaActaData', async () => {
    try {
        // Ruta a la plantilla de Excel
        const templatePath = path.join(__dirname, 'utils', 'GI-FO-029 ACTA DE REUNION CONVIVENCIA Mayo.xlsx');
        console.log(`[INFO] Leyendo plantilla de acta de convivencia desde: ${templatePath}`);

        // Verificar que el archivo existe
        await fsp.access(templatePath);

        // Leer el archivo Excel
        const workbook = xlsx.readFile(templatePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir la hoja a un arreglo de datos
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        // Obtener las celdas combinadas (merges)
        const merges = worksheet['!merges'] || [];

        console.log(`[SUCCESS] Plantilla de convivencia cargada. Filas: ${data.length}, Merges: ${merges.length}`);
        return {
            success: true,
            data,
            merges
        };
    } catch (error) {
        console.error('[ERROR] Error al cargar la plantilla del acta de convivencia:', error);
        return {
            success: false,
            error: `No se encontró o no se pudo cargar la plantilla para el Comité de Convivencia. Asegúrate de que el archivo 'PLANTILLA_CONVIVENCIA_POR_DEFINIR.xlsx' existe en la carpeta 'utils'. Detalle: ${error.message}`
        };
    }
  });

  // Manejador para generar el acta de COPASST usando el script de Python
  ipcMain.handle('generate-copasst-acta', async (event, changes) => {
    sendLog(`IPC: generate-copasst-acta recibido con ${changes.length} cambios`);
    try {
        const pythonPath = await getPython();
        // 1. Pedir al usuario la ruta para guardar el archivo
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Guardar Acta de COPASST',
            defaultPath: `Acta-COPASST-${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [
                { name: 'Archivos de Excel', extensions: ['xlsx'] }
            ]
        });

        if (canceled) {
            sendLog('El usuario canceló el guardado del acta.');
            return { success: false, canceled: true };
        }

        // 2. Preparar para llamar al script de Python
        const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'copasst_acta_generator.py');
        const tempDataPath = path.join(app.getPath('temp'), `copasst_data_${Date.now()}.json`);
        
        sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
        await fsp.writeFile(tempDataPath, JSON.stringify({ changes }, null, 2));

        // 3. Ejecutar el script de Python con la ruta del JSON y la ruta de salida
        const commandArgs = [pythonScriptPath, tempDataPath, filePath];
        
        sendLog(`Ejecutando script de generación de acta...`);
        const { stdout, stderr } = await execFilePromise(pythonPath, commandArgs, { cwd: path.dirname(pythonScriptPath) });
        
        // 4. Limpiar el archivo temporal
        await fsp.unlink(tempDataPath);

        if (stderr) {
            sendLog(`Error en script de generación de acta: ${stderr}`, 'ERROR');
        }

        // 5. Procesar la respuesta del script
        let finalResult = null;
        const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
        lines.forEach(line => {
            try {
                const output = JSON.parse(line);
                if (output.type === 'log') {
                    sendLog(`[Python] ${output.message}`, output.level);
                } else if (output.type === 'result') {
                    finalResult = output.payload;
                }
            } catch (e) {
                sendLog(`No se pudo parsear la línea de salida de Python: ${line}`, 'WARN');
            }
        });

        if (finalResult) {
            sendLog(`Resultado de la generación: ${JSON.stringify(finalResult)}`);
            return finalResult;
        } else {
            throw new Error("El script de Python no devolvió un resultado final.");
        }

    } catch (error) {
        sendLog(`Fallo en la ejecución del script de acta: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
  });

  // Manejador para generar el acta de Comité de Convivencia usando el script de Python
  ipcMain.handle('generateConvivenciaActa', async (event, changes) => {
    sendLog(`IPC: generateConvivenciaActa recibido con ${changes.length} cambios`);
    try {
        const pythonPath = await getPython();
        // 1. Pedir al usuario la ruta para guardar el archivo
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Guardar Acta de Comité de Convivencia',
            defaultPath: `Acta-Convivencia-${new Date().toISOString().split('T')[0]}.xlsx`,
            filters: [
                { name: 'Archivos de Excel', extensions: ['xlsx'] }
            ]
        });

        if (canceled) {
            sendLog('El usuario canceló el guardado del acta de convivencia.');
            return { success: false, canceled: true };
        }

        // 2. Preparar para llamar al script de Python
        const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'comite_convivencia_acta_generator.py');
        const tempDataPath = path.join(app.getPath('temp'), `convivencia_data_${Date.now()}.json`);
        
        sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
        await fsp.writeFile(tempDataPath, JSON.stringify({ changes }, null, 2));

        // 3. Ejecutar el script de Python
        const commandArgs = [pythonScriptPath, tempDataPath, filePath];
        
        sendLog(`Ejecutando script de generación de acta de convivencia...`);
        const { stdout, stderr } = await execFilePromise(pythonPath, commandArgs, { cwd: path.dirname(pythonScriptPath) });
        
        // 4. Limpiar el archivo temporal
        await fsp.unlink(tempDataPath);

        if (stderr) {
            sendLog(`Error en script de generación de acta de convivencia: ${stderr}`, 'ERROR');
        }

        // 5. Procesar la respuesta del script
        let finalResult = null;
        const lines = stdout.split(/\r?\n/).filter(line => line.trim() !== '');
        lines.forEach(line => {
            try {
                const output = JSON.parse(line);
                if (output.type === 'log') {
                    sendLog(`[Python] ${output.message}`, output.level);
                } else if (output.type === 'result') {
                    finalResult = output.payload;
                }
            } catch (e) {
                sendLog(`No se pudo parsear la línea de salida de Python: ${line}`, 'WARN');
            }
        });

        if (finalResult) {
            sendLog(`Resultado de la generación: ${JSON.stringify(finalResult)}`);
            return finalResult;
        } else {
            throw new Error("El script de Python no devolvió un resultado final.");
        }

    } catch (error) {
        sendLog(`Fallo en la ejecución del script de acta de convivencia: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
  });

  // Convertir Excel a PDF usando Microsoft Office'''
  ipcMain.handle('convertExcelToPdf', async (event, filePath) => {
      try {
          console.log('=== INICIO CONVERSIÓN EXCEL ===');
          console.log('Archivo original:', filePath);
          
          // Normalizar ruta y manejar caracteres especiales
          const normalizedPath = path.resolve(filePath);
          console.log('Ruta normalizada:', normalizedPath);

          // Verificar que el archivo existe
          if (!fs.existsSync(normalizedPath)) {
              console.error('Archivo no encontrado');
              return {
                  success: false,
                  error: `Archivo no encontrado: ${normalizedPath}`
              };
          }

          // Usar directorio temporal local para evitar problemas con unidades de red
          const tempDir = path.join(app.getPath('temp'), 'excel_pdf_conversions');
          if (!fs.existsSync(tempDir)) {
              fs.mkdirSync(tempDir, { recursive: true });
          }

          const fileNameWithoutExt = path.basename(normalizedPath, path.extname(normalizedPath));
          
          // Limpiar nombre para evitar problemas con caracteres especiales
          const cleanFileName = fileNameWithoutExt
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '') // Remover acentos
              .replace(/[^ - -퟿豈-﷏ﷰ-￯]/g, '_') // Reemplazar caracteres no ASCII
              .replace(/ +/g, '_') // Reemplazar espacios
              .substring(0, 50); // Limitar longitud
          
          // Copiar archivo de entrada a temporal local
          const tempInputPath = path.join(tempDir, `${cleanFileName}.xlsx`);
          await fsp.copyFile(normalizedPath, tempInputPath);
          console.log('Archivo copiado a temporal:', tempInputPath);

          const outputPath = path.join(tempDir, `${cleanFileName}.pdf`);
          console.log('Archivo PDF destino:', outputPath);

          // Verificar si ya existe PDF actualizado
          if (fs.existsSync(outputPath)) {
              const excelStats = fs.statSync(normalizedPath);
              const pdfStats = fs.statSync(outputPath);
              
              if (pdfStats.mtime > excelStats.mtime) {
                  console.log('PDF ya existe y está actualizado');
                  return {
                      success: true,
                      pdf_path: outputPath
                  };
              }
          }

          // Convertir usando Microsoft Office
          console.log('Iniciando conversión con Microsoft Office...');
          const result = await convertWithMicrosoftOffice(tempInputPath, outputPath);
          
          // Limpiar temporal input después de conversión
          await fsp.unlink(tempInputPath).catch(e => console.warn('No se pudo eliminar temp input:', e.message));
          
          if (result.success) {
              console.log('Conversión exitosa');
              return {
                  success: true,
                  pdf_path: outputPath
              };
          } else {
              console.error('Error en conversión:', result.error);
              return result;
          }

      } catch (error) {
          console.error('Error crítico en convertExcelToPdf:', error);
          return {
              success: false,
              error: `Error crítico: ${error.message}`
          };
      } finally {
          // Opcional: Limpiar directorio temp después de un tiempo
          setTimeout(() => cleanTempDir(tempDir), 300000); // 5 minutos
      }
  });

// Función para limpiar directorio temporal
async function cleanTempDir(dir) {
    try {
        const files = await fsp.readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stats = await fsp.stat(filePath);
            if (Date.now() - stats.mtimeMs > 3600000) { // 1 hora
                await fsp.unlink(filePath);
            }
        }
    } catch (e) {
        console.warn('Error limpiando temp dir:', e.message);
    }
}

// Función mejorada para convertir usando Microsoft Office COM
function convertWithMicrosoftOffice(inputPath, outputPath) {
    return new Promise((resolve) => {
        console.log('Creando script PowerShell para conversión...');
        
        // Codificar rutas en Base64 para evitar problemas de caracteres especiales
        const inputPathB64 = Buffer.from(inputPath, 'utf8').toString('base64');
        const outputPathB64 = Buffer.from(outputPath, 'utf8').toString('base64');
        
        // Script PowerShell mejorado con correcciones
        const powershellScript = `
# Establecer codificación UTF-8 para PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Write-Host "=== INICIO CONVERSION EXCEL ===" -Encoding UTF8
    
    # Decodificar rutas desde Base64
    $inputPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${inputPathB64}"))
    $outputPath = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${outputPathB64}"))
    
    Write-Host "Ruta de entrada: $inputPath" -Encoding UTF8
    Write-Host "Ruta de salida: $outputPath" -Encoding UTF8
    
    # Verificar que el archivo de entrada existe
    if (-not (Test-Path $inputPath)) {
        throw "Archivo de entrada no encontrado: $inputPath"
    }
    
    # Crear directorio de salida si no existe
    $outputDir = Split-Path $outputPath -Parent
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
        Write-Host "Directorio creado: $outputDir" -Encoding UTF8
    }
    
    Write-Host "Iniciando Excel..." -Encoding UTF8
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false
    $excel.EnableEvents = $false
    $excel.AskToUpdateLinks = $false
    
    Write-Host "Abriendo archivo Excel..." -Encoding UTF8
    
    # Parámetros para Open() con ReadOnly = $false
    $workbook = $excel.Workbooks.Open(
        $inputPath,
        0,      # UpdateLinks: 0 = No
        $false, # ReadOnly: $false para permitir guardar/exportar
        5,      # Format: 5 = CSV, pero para XLSX es ignorado
        "",     # Password
        "",     # WriteResPassword
        $true,  # IgnoreReadOnlyRecommended
        2,      # Origin: xlWindows
        "",     # Delimiter
        $false, # Editable
        $false, # Notify
        0,      # Converter
        $true   # AddToMru
    )
    
    Write-Host "Archivo Excel abierto correctamente" -Encoding UTF8
    
    # Activar el libro de trabajo para asegurar que es el foco
    $workbook.Activate()
    Write-Host "Libro de trabajo activado" -Encoding UTF8

    # Esperar un momento para que Excel procese completamente el archivo
    Start-Sleep -Seconds 7 # Aumentado a 7 segundos
    
    Write-Host "Iniciando exportación a PDF..." -Encoding UTF8
    
    # Usar SaveAs como método principal por su fiabilidad en este entorno.
    # ExportAsFixedFormat estaba fallando consistentemente.
    try {
        $workbook.SaveAs(
            $outputPath,
            57  # xlTypePDF
        )
        Write-Host "Exportación completada con SaveAs" -Encoding UTF8
        
    } catch {
        Write-Host "La exportación con SaveAs falló: $($_.Exception.Message)" -Encoding UTF8
        throw "No se pudo exportar el archivo a PDF"
    }
    
    Write-Host "Cerrando libro de trabajo..." -Encoding UTF8
    $workbook.Close($false)
    
    Write-Host "Cerrando Excel..." -Encoding UTF8
    $excel.Quit()
    
    # Liberar objetos COM
    Write-Host "Liberando recursos COM..." -Encoding UTF8
    if ($workbook) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook); $workbook = $null }
    if ($excel) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel); $excel = $null }
    
    # Forzar recolección de basura
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    [System.GC]::Collect()
    
    # Verificar que el PDF se creó correctamente
    if (Test-Path $outputPath) {
        $pdfSize = (Get-Item $outputPath).Length
        if ($pdfSize -gt 1024) { # PDF debe tener al menos 1KB
            Write-Host "PDF creado exitosamente. Tamaño: $pdfSize bytes" -Encoding UTF8
            Write-Host "CONVERSION_SUCCESS" -Encoding UTF8
        } else {
            throw "PDF creado pero parece estar vacío o corrupto (tamaño: $pdfSize bytes)"
        }
    } else {
        throw "PDF no fue creado en la ruta esperada: $outputPath"
    }
    
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "=== ERROR EN CONVERSION ===" -Encoding UTF8
    Write-Host "ERROR: $errorMsg" -Encoding UTF8
    Write-Host "Tipo de excepción: $($_.Exception.GetType().Name)" -Encoding UTF8
    
    # Información adicional de debugging
    if ($_.Exception.InnerException) {
        Write-Host "Error interno: $($_.Exception.InnerException.Message)" -Encoding UTF8
    }
    
    # Cleanup forzado en caso de error
    Write-Host "Iniciando cleanup de emergencia..." -Encoding UTF8
    try {
        if ($workbook -ne $null) { 
            Write-Host "Cerrando workbook..." -Encoding UTF8
            $workbook.Close($false)
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook)
        }
    } catch { Write-Host "Error cerrando workbook: $($_.Exception.Message)" -Encoding UTF8 }
    
    try {
        if ($excel -ne $null) { 
            Write-Host "Cerrando Excel..." -Encoding UTF8
            $excel.Quit()
            [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
        }
    } catch { Write-Host "Error cerrando Excel: $($_.Exception.Message)" -Encoding UTF8 }
    
    # Forzar terminación de procesos Excel colgados
    Write-Host "Terminando procesos Excel residuales..." -Encoding UTF8
    try {
        Get-Process excel -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    } catch { Write-Host "Sin procesos Excel para terminar" -Encoding UTF8 }
    
    # Forzar recolección de basura final
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    exit 1
}
`;

        console.log('=== EJECUTANDO POWERSHELL ===');
        
        // Crear archivo temporal para el script PS1
        const tempPs1Path = path.join(app.getPath('temp'), `excel_convert_${Date.now()}.ps1`);
        console.log('Guardando script temporal en:', tempPs1Path);
        
        fs.writeFileSync(tempPs1Path, powershellScript, 'utf8');

        // Ejecutar PowerShell con -File para evitar problemas con stdin
        const child = spawn('powershell.exe', [
            '-ExecutionPolicy', 'Bypass',
            '-NoProfile',
            '-NoLogo',
            '-File', tempPs1Path
        ], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: false, // Mostrar ventana para debugging si es necesario
            shell: false,
            cwd: path.dirname(inputPath) // Establecer directorio de trabajo
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const output = data.toString('utf8').trim();
            if (output) {
                stdout += output + '\n';
                console.log('📋 PowerShell OUT:', output);
            }
        });

        child.stderr.on('data', (data) => {
            const error = data.toString('utf8').trim();
            if (error) {
                stderr += error + '\n';
                console.log('❌ PowerShell ERR:', error);
            }
        });

        child.on('close', async (code) => {
            // Limpiar archivo temporal
            try {
                await fsp.unlink(tempPs1Path);
                console.log('Archivo temporal PS1 eliminado');
            } catch (e) { console.warn('No se pudo eliminar temp PS1:', e.message); }
            
            console.log('=== RESULTADO POWERSHELL ===');
            console.log('Código de salida:', code);
            console.log('STDOUT longitud:', stdout.length);
            console.log('STDERR longitud:', stderr.length);
            
            if (code !== 0) {
                console.error('PowerShell falló con código:', code);
                resolve({
                    success: false,
                    error: `PowerShell falló (código ${code}): ${stderr || stdout || 'Sin salida'}`
                });
                return;
            }
            
            if (stdout.includes('CONVERSION_SUCCESS')) {
                console.log('✅ Marcador de éxito encontrado');
                
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    console.log(`✅ PDF existe: ${stats.size} bytes`);
                    
                    if (stats.size > 1024) { // PDF debe tener al menos 1KB
                        resolve({ success: true });
                    } else {
                        resolve({
                            success: false,
                            error: `PDF generado pero muy pequeño: ${stats.size} bytes`
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        error: 'Marcador de éxito encontrado pero PDF no existe'
                    });
                }
            } else if (stdout.includes('ERROR')) {
                // Extraer error específico
                const errorMatch = stdout.match(/ERROR:\s*(.+)/);
                const specificError = errorMatch ? errorMatch[1].trim() : 'Error desconocido';
                console.log('❌ Error detectado:', specificError);
                
                resolve({
                    success: false,
                    error: specificError
                });
            } else {
                console.log('❌ No se encontraron marcadores reconocibles');
                console.log('Salida completa:', stdout);
                console.log('Errores:', stderr);
                
                resolve({
                    success: false,
                    error: `Salida inesperada de PowerShell. Ver logs para detalles.`
                });
            }
        });

        child.on('error', (error) => {
            console.error('❌ Error ejecutando PowerShell:', error);
            resolve({
                success: false,
                error: `Error ejecutando PowerShell: ${error.message}`
            });
        });

        // Timeout con mejor logging
        const timeout = setTimeout(() => {
            console.log('⏱️ TIMEOUT ALCANZADO');
            console.log('Salida hasta el momento:', stdout);
            
            try {
                child.kill('SIGTERM');
                
                // Cleanup después de timeout
                setTimeout(() => {
                    exec('taskkill /F /IM EXCEL.EXE /T', (error) => {
                        if (!error) { console.log('🧹 Procesos Excel terminados'); }
                    });
                }, 3000);
            } catch (e) { console.error('Error terminando proceso:', e); }
            
            resolve({
                success: false,
                error: 'Timeout: La conversión tomó demasiado tiempo. Revisa si Excel está bloqueado.'
            });
        }, 120000);

        // Limpiar timeout si el proceso termina normally
        child.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

// Función para registrar los manejadores IPC
const registerIPCHandlers = () => {
  // Manejador para obtener la versión de la aplicación
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
}

// --- Ciclo de vida de la aplicación ---

// Este método se llamará cuando Electron haya terminado la inicialización
// y esté listo para crear ventanas de navegador.
// Algunas API solo se pueden usar después de que ocurra este evento.
app.whenReady().then(() => {
  log.info(`Ruta de datos del usuario (userData) para config.json: ${app.getPath('userData')}`);
  registerIPCHandlers(); // Registrar todos los manejadores de eventos
  createWindow(); // Crear la ventana principal

  // Iniciar la búsqueda de actualizaciones una vez que la app está lista
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

// --- Manejador para reiniciar la aplicación ---
ipcMain.on('restart_app', () => {
  log.info('El usuario ha aceptado la actualización. Reiniciando para instalar...');
  autoUpdater.quitAndInstall();
});
