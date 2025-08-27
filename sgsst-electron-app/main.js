// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

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
      const XLSX = require('xlsx');
      sendLog(`[MAIN] Leyendo archivo Excel...`);
      const workbook = XLSX.readFile(excelFilePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Leer todo el contenido del sheet
      const allData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      sendLog(`[MAIN] Datos extraídos. Total filas: ${allData.length}`);

      if (allData.length < 7) {
          sendLog('[MAIN] Archivo Excel no contiene datos suficientes (solo cabecera).', 'WARN');
          return { 
              success: true, 
              headers: allData.length > 0 ? allData[0] : [], 
              rows: [], 
              message: 'Archivo no contiene filas de datos.',
              filePath: excelFilePath,
              companyName 
          };
      }

      // Saltar las primeras 6 filas (las de cabecera)
      const headers = allData[6]; // Los encabezados reales están en la fila 7 (índice 6)
      const rows = allData.slice(7); // Los datos reales comienzan en la fila 8 (índice 7)

      sendLog(`[MAIN] Datos de remisiones encontrados. Total filas: ${rows.length}`);
      
      console.log(`[MAIN] Excel procesado exitosamente para ${companyName}. Encontradas ${rows.length} filas.`);
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
      console.log(`Finding path for company: ${companyName}, module: ${module}, submodule: ${submodule}`);

      // Cargar la configuración
      const config = await fs.readFile(configPath, 'utf8').then(JSON.parse).catch(() => ({}));

      // Verificar si tenemos rutas de empresa para la empresa especificada
      if (!config.companyPaths || !config.companyPaths[companyName]) {
        throw new Error(`No configuration or path found for company: ${companyName}`);
      }
      
      // Obtener la estructura para esta empresa
      const companyStructure = config.companyPaths[companyName];
      console.log('Company structure:', JSON.stringify(companyStructure, null, 2));
      
      if (!companyStructure || !companyStructure.structure) {
        throw new Error(`No structure found for company: ${companyName}`);
      }
      
      // Extraer el código del nombre del submódulo (ej. "1.1.1 Responsable del SG" -> "1.1.1")
      const submoduleCode = submodule.match(/^([\d.]+)/);
      if (!submoduleCode) {
        throw new Error(`Invalid submodule name format: ${submodule}`);
      }
      const code = submoduleCode[1];
      console.log(`Extracted code: ${code}`);
      
      // Para el módulo "Recursos", necesitamos buscar primero el módulo y luego el submódulo dentro de él
      let foundPath = null;
      if (module === "Recursos") {
        // Buscar primero el módulo "Recursos"
        const resourcesModules = ["1. Recursos", "1. Recursos\\\\"]; // Corregido: escapar la barra invertida
        for (const resourcesName of resourcesModules) {
          if (companyStructure.structure.structure.subdirectories && 
              companyStructure.structure.structure.subdirectories[resourcesName]) {
            // Buscar el submódulo dentro del módulo "Recursos"
            foundPath = searchInStructure(companyStructure.structure.structure.subdirectories[resourcesName], code);
            if (foundPath) break;
          }
        }
      }
      
      // Si no se encontró en "Recursos" o no es del módulo "Recursos", buscar en la raíz
      if (!foundPath) {
        foundPath = searchInStructure(companyStructure.structure.structure, code);
      }
      
      if (foundPath) {
        console.log(`Found path: ${foundPath}`);
        return { success: true, path: foundPath };
      } else {
        console.log(`Path not found for code: ${code}`);
        return { success: false, error: `Path not found for module: ${module}, submodule: ${submodule} (code: ${code})` };
      }
    } catch (error) {
      console.error('Error finding submodule path:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Función auxiliar para buscar una ruta en la estructura de directorio
  function searchInStructure(directoryNode, code, depth = 0) {
    // ... (código de la función auxiliar)
  }

  // Manejar procesamiento de PDF
  ipcMain.handle('process-remision-pdf', async (event, pdfPath) => {
    // ... (código del handler)
  });

  // Manejar conversión de DOCX a PDF
  ipcMain.handle('convert-docx-to-pdf', async (event, docxPath) => {
    // ... (código del handler)
  });

  // Manejar selección de PDF
  ipcMain.handle('select-pdf-file', async () => {
    // ... (código del handler)
  });

  // Manejar generación de documento
  ipcMain.handle('generate-remision-document', async (event, extractedData, empresa) => {
    // ... (código del handler)
  });

  // Manejar envío por email
  ipcMain.handle('send-remision-by-email', async (event, docPath, extractedData, empresa) => {
    // ... (código del handler)
  });

  // Manejar envío por WhatsApp
  ipcMain.handle('send-remision-by-whatsapp', async (event, docPath, extractedData, empresa) => {
    // ... (código del handler)
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