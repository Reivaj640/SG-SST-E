// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const fs = require('fs');
const { exec, spawn, execFile } = require('child_process'); // Asegúrate de incluir execFile
const { promisify } = require('util');
const xlsx = require('xlsx');
const os = require('os');

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile); // Añadir esta línea


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
    width: 1200,
    height: 900,
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

// Función para registrar los manejadores IPC
const registerIPCHandlers = () => {
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
      // Ruta al script de mapeo de Python
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'map_directory.py');
      
      // Verificar si el script de Python existe
      try {
        await fsp.access(pythonScriptPath);
      } catch (error) {
        throw new Error(`Python script not found at: ${pythonScriptPath}`);
      }
      
      // Ejecutar el script de Python
      const command = `python "${pythonScriptPath}" "${directoryPath}"`;
      console.log(`Executing command: ${command}`);
      
      const { stdout, stderr } = await execPromise(command);
      
      // Parsear la salida JSON del script de Python
      const structure = JSON.parse(stdout);
      console.log('Directory mapping completed successfully');
      
      // Devolver tanto la estructura como los posibles logs/errores de stderr
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
      // Usar el comando apropiado según el sistema operativo
      let command;
      switch (process.platform) {
        case 'win32':
          command = `start "" "${pathToOpen}"`;
          break;
        case 'darwin':
          command = `open "${pathToOpen}"`;
          break;
        case 'linux':
          command = `xdg-open "${pathToOpen}"`;
          break;
        default:
          throw new Error(`Unsupported platform: ${process.platform}`);
      }
      
      await execPromise(command);
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
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'process_pdf_cli.py');
      const tempDataPath = path.join(app.getPath('temp'), `remision_data_${Date.now()}.json`);
      
      sendLog(`Ejecutando script de Python: python "${pythonScriptPath}" "${pdfPath}"`);
      const { stdout, stderr } = await execPromise(`python "${pythonScriptPath}" "${pdfPath}"`);
      
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
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_docx_to_pdf.py');
      const command = `python "${pythonScriptPath}" "${docxPath}"`;
      
      console.log(`Executing DOCX conversion: ${command}`);
      const { stdout, stderr } = await execPromise(command);

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
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'remision_utils.py');
      const tempDataPath = path.join(app.getPath('temp'), `remision_data_${Date.now()}.json`);
      
      sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
      await fsp.writeFile(tempDataPath, JSON.stringify({ data: extractedData, empresa: empresa }));
      
      const command = `python "${pythonScriptPath}" --generate-remision "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de generación de remisión: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command);
      
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
      
      const command = `python "${pythonScriptPath}" --send-email "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de envío de email: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command, { encoding: 'utf-8' });
      
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
  
  // Agrega este nuevo handler IPC en tu main.js
  ipcMain.handle('update-excel-cell', async (event, filePath, row, col, value) => {
    sendLog(`[MAIN] Actualizando celda en ${filePath}, fila: ${row}, columna: ${col}, valor: ${value}`);
    
    try {
      // Verificar que el archivo existe
      await fsp.access(filePath);
      
      // Leer el workbook
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir coordenadas a formato de celda de Excel (ej: A1, B2, etc.)
      const cellAddress = xlsx.utils.encode_cell({ r: row - 1, c: col - 1 }); // Convertir a 0-indexed
      
      // Actualizar el valor de la celda
      worksheet[cellAddress] = { v: value, t: 's' }; // t: 's' para string
      
      // Guardar el archivo
      xlsx.writeFile(workbook, filePath);
      
      sendLog(`[MAIN] Celda actualizada exitosamente: ${cellAddress} = ${value}`);
      
      return { success: true };
      
    } catch (error) {
      sendLog(`[MAIN] Error al actualizar celda: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  });

  // Manejar envío de remisión por WhatsApp
  ipcMain.handle('send-remision-by-whatsapp', async (event, docPath, extractedData, empresa) => {
    sendLog(`IPC: send-remision-by-whatsapp recibido para: ${docPath}`);
    try {
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'remision_utils.py');
      const tempDataPath = path.join(app.getPath('temp'), `whatsapp_data_${Date.now()}.json`);
      
      sendLog(`Creando archivo de datos temporal para WhatsApp: ${tempDataPath}`);
      await fsp.writeFile(tempDataPath, JSON.stringify({
        docPath: docPath, 
        data: extractedData, 
        empresa: empresa 
      }));
      
      const command = `python "${pythonScriptPath}" --send-whatsapp "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de preparación de WhatsApp: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command);
      
      await fsp.unlink(tempDataPath);
      
      if (stderr) {
        sendLog(`Error en script de WhatsApp: ${stderr}`, 'ERROR');
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
        sendLog(`Resultado de preparación de WhatsApp: ${JSON.stringify(finalResult)}`);
        
        // Si el script fue exitoso y devolvió un número de teléfono
        if (finalResult.success && finalResult.phoneNumber) {
          const phoneNumber = finalResult.phoneNumber;
          let cleanPhoneNumber = String(phoneNumber).replace(/[^0-9]/g, '');
          if (cleanPhoneNumber.length === 10) {
            cleanPhoneNumber = `57${cleanPhoneNumber}`;
          }

          // Datos del trabajador para el mensaje
          const nombreTrabajador = finalResult.nombre || 'N/A';
          const cedulaTrabajador = finalResult.cedula || 'N/A';

          // Plantilla del mensaje
          const messageBody = `Remisión EPS - ${empresa.toUpperCase()}\n\nTrabajador: ${nombreTrabajador}\nCédula: ${cedulaTrabajador}\n\nAdjunto encontrará su documento de remisión EPS con las recomendaciones médicas.\n\nPor favor:\n1. Revise el documento adjunto ✅\n2. Siga las indicaciones del profesional de salud ✅\n3. Confirme recepción ✅\n\nCualquier duda estamos disponibles para resolverla`;
          
          const message = encodeURIComponent(messageBody);
          const whatsappUrl = `https://wa.me/${cleanPhoneNumber}?text=${message}`;
          
          sendLog(`Abriendo WhatsApp con la URL: ${whatsappUrl}`);
          shell.openExternal(whatsappUrl);
        }
        
        return finalResult;
      } else {
        throw new Error("El script de Python no devolvió un resultado final.");
      }

    } catch (error) {
      sendLog(`Fallo en la ejecución del script de WhatsApp: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  });

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

  ipcMain.handle('process-accident-pdf', (event, pdfPath) => {
    return new Promise((resolve, reject) => {
      sendLog(`IPC: process-accident-pdf (extract) recibido para: ${pdfPath}`);
      
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
      const pythonProcess = spawn('python', [pythonScriptPath, 'extract', '--pdf_path', pdfPath]);

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

  ipcMain.handle('analyze-accident', (event, extractedData, contextoAdicional) => {
    return new Promise((resolve, reject) => {
      sendLog(`IPC: analyze-accident recibido`);
      
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_processor.py');
      const jsonData = JSON.stringify(extractedData);
      const pythonProcess = spawn('python', [pythonScriptPath, 'analyze', '--json_data', jsonData, '--contexto', contextoAdicional]);

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
        // Crear archivo temporal con los datos
        tempDataPath = path.join(app.getPath('temp'), `accident_report_data_${Date.now()}.json`);
        
        const reportData = {
          combinedData: combinedData,
          empresa: combinedData.empresa || 'TEMPOACTIVA'
        };
        
        sendLog(`Creando archivo de datos temporal: ${tempDataPath}`);
        await fsp.writeFile(tempDataPath, JSON.stringify(reportData, null, 2));
        
        const pythonExecutable = 'python';
        const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'accident_report_generator.py');

        // Verificar que el script existe
        await fsp.access(pythonScriptPath);
        
        sendLog(`Ejecutando script con UTF-8 forzado: ${pythonExecutable} -X utf8 "${pythonScriptPath}"`);

        const pythonProcess = spawn(pythonExecutable, [
          '-X', 'utf8',
          pythonScriptPath,
          tempDataPath
        ]);

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
      const investAppPath = path.join(__dirname, 'Portear', 'src', 'Invest_APP_V_3.py');
      const { stdout } = await execFilePromise('python', [investAppPath, '--get-config', empresa]);
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
        const command = `python "${pythonScriptPath}" "${tempDataPath}" "${filePath}"`;
        
        sendLog(`Ejecutando script de generación de acta: ${command.replace(/\\/g, '/')}`);
        const { stdout, stderr } = await execPromise(command);
        
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
        const command = `python "${pythonScriptPath}" "${tempDataPath}" "${filePath}"`;
        
        sendLog(`Ejecutando script de generación de acta de convivencia: ${command.replace(/\\/g, '/')}`);
        const { stdout, stderr } = await execPromise(command);
        
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

};

// --- Ciclo de vida de la aplicación ---

// Este método se llamará cuando Electron haya terminado la inicialización
// y esté listo para crear ventanas de navegador.
// Algunas API solo se pueden usar después de que ocurra este evento.
app.whenReady().then(() => {
  registerIPCHandlers(); // Registrar todos los manejadores de eventos
  createWindow(); // Crear la ventana principal

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