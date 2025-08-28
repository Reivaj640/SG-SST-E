// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const xlsx = require('xlsx');

const execPromise = promisify(exec);

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
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
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
      const data = await fs.readFile(configPath, 'utf8');
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
          const entries = await fs.readdir(dir, { withFileTypes: true });
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
      const configData = await fs.readFile(configPath, 'utf8').catch(() => '{}');
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
      await fs.access(basePath);
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
        await fs.access(pythonScriptPath);
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
      const items = await fs.readdir(directoryPath, { withFileTypes: true });
      
      const result = [];
      for (const item of items) {
        const itemPath = path.join(directoryPath, item.name);
        const stats = await fs.stat(itemPath);
        
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
      const configData = await fs.readFile(configPath, 'utf8').catch(() => '{}');
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
      const submoduleCode = submodule.match(/^([\d.]+)/);
      if (!submoduleCode) {
        console.log(`[ERROR] Invalid submodule name format: ${submodule}`);
        throw new Error(`Invalid submodule name format: ${submodule}`);
      }
      const code = submoduleCode[1];
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
          sendLog(`Texto extraído del PDF ${path.basename(pdfPath)}:
---
INICIO ---
${finalResult.debug_full_text}
--- FIN ---`, 'DEBUG');
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
      await fs.writeFile(tempDataPath, JSON.stringify({ data: extractedData, empresa: empresa }));
      
      const command = `python "${pythonScriptPath}" --generate-remision "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de generación de remisión: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command);
      
      await fs.unlink(tempDataPath);
      
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
            finalResult = output.payload;
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
          await fs.access(docPath);
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
          const files = await fs.readdir(remisionesDir);
          const docxFiles = files.filter(file => file.endsWith('.docx') && file.includes('GI-OD-007 REMISION A EPS'));
          
          if (docxFiles.length > 0) {
            const fileStats = await Promise.all(docxFiles.map(async (file) => {
              const filePath = path.join(remisionesDir, file);
              const stats = await fs.stat(filePath);
              return { file, filePath, mtime: stats.mtime };
            }));
            
            fileStats.sort((a, b) => b.mtime - a.mtime);
            const latestFile = fileStats[0];
            
            const tempFileName = `temp_remision_${Date.now()}.docx`;
            const tempFilePath = path.join(app.getPath('temp'), tempFileName);
            
            await fs.copyFile(latestFile.filePath, tempFilePath);
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
      
      await fs.copyFile(docPath, tempFilePath);
      sendLog(`Archivo copiado a: ${tempFilePath}`);
      
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'remision_utils.py');
      const tempDataPath = path.join(app.getPath('temp'), `email_data_${Date.now()}.json`);
      const tempData = { 
        docPath: tempFilePath, 
        data: extractedData, 
        empresa: empresa 
      };
      
      sendLog(`Creando archivo de datos temporal para email: ${tempDataPath}`);
      await fs.writeFile(tempDataPath, JSON.stringify(tempData), 'utf-8');
      
      const command = `python "${pythonScriptPath}" --send-email "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de envío de email: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command, { encoding: 'utf-8' });
      
      await fs.unlink(tempFilePath);
      await fs.unlink(tempDataPath);

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
      await fs.access(filePath);
      
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
      await fs.writeFile(tempDataPath, JSON.stringify({ 
        docPath: docPath, 
        data: extractedData, 
        empresa: empresa 
      }));
      
      const command = `python "${pythonScriptPath}" --send-whatsapp "${tempDataPath}"`;
      
      sendLog(`Ejecutando script de preparación de WhatsApp: ${command.replace(/\\/g, '/')}`);
      const { stdout, stderr } = await execPromise(command);
      
      await fs.unlink(tempDataPath);
      
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
          const messageBody = `Remisión EPS - ${empresa.toUpperCase()}

Trabajador: ${nombreTrabajador}
Cédula: ${cedulaTrabajador}

Adjunto encontrará su documento de remisión EPS con las recomendaciones médicas.

Por favor:
1. Revise el documento adjunto ✅
2. Siga las indicaciones del profesional de salud ✅
3. Confirme recepción ✅

Cualquier duda estamos disponibles para resolverla`;
          
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
};

// Registrar los manejadores IPC antes de que la aplicación esté lista
registerIPCHandlers();

// Evento cuando la aplicación está lista
app.on('ready', () => {
  console.log('App is ready');
  createWindow();
});

// Evento cuando todas las ventanas se cierran
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Evento cuando la aplicación se activa
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
