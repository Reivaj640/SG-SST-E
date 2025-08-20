// main.js - Proceso principal de la aplicación Electron

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

// Ruta del archivo de configuración
const configPath = path.join(app.getPath('userData'), 'config.json');

// Verificar si se está ejecutando con squirrel (instalador de Windows)
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Función para crear la ventana principal
const createWindow = () => {
  const mainWindow = new BrowserWindow({
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

  // NUEVA FUNCIÓN PARA BÚSQUEDA RECURSIVA
  ipcMain.handle('find-files-recursively', async (event, basePath) => {
    console.log('Recursively finding files in:', basePath);
    const allFiles = [];

    async function walkDir(currentPath) {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else {
            // Opcional: filtrar por extensión, ej. solo PDFs
            if (path.extname(entry.name).toLowerCase() === '.pdf') {
              const stats = await fs.stat(fullPath);
              allFiles.push({
                name: entry.name,
                path: fullPath,
                size: stats.size,
                mtime: stats.mtime,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error walking directory ${currentPath}:`, error);
        // Ignorar errores de directorios individuales (ej. permisos) y continuar
      }
    }

    await walkDir(basePath);
    console.log(`Found ${allFiles.length} PDF files recursively.`);
    return allFiles;
  });
  // FIN DE LA NUEVA FUNCIÓN

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
      
      // Buscar la ruta en la estructura
      const foundPath = searchInStructure(companyStructure.structure.structure, code);
      
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
// El directoryNode se espera que sea el objeto creado por la función
// _map_directory_recursive del script de Python. Debe tener propiedades 'name' (string), 'path' (string),
// 'files' (array), y 'subdirectories' (objeto).
function searchInStructure(directoryNode, code, depth = 0) {
  // Verificar que directoryNode no sea undefined o null
  if (!directoryNode) {
    console.log("Directory node is undefined or null");
    return null;
  }
  
  const indent = "  ".repeat(depth);
  console.log(`${indent}Searching in: ${directoryNode.name || 'unnamed directory'}`);
  
  // Verificar archivos en el directorio actual
  const files = directoryNode.files || [];
  for (const file of files) {
    if (file && file.name) {
      console.log(`${indent}  Checking file: ${file.name} (starts with ${code})`);
      if (file.name.startsWith(code)) {
        console.log(`${indent}  Found file match: ${file.path}`);
        return file.path;
      }
    }
  }
  
  // Verificar subdirectorios
  const subdirs = directoryNode.subdirectories || {};
  for (const [subDirName, subDirNode] of Object.entries(subdirs)) {
    if (subDirName && subDirNode) {
      console.log(`${indent}  Checking subdirectory: ${subDirName} (starts with ${code})`);
      if (subDirName.startsWith(code)) {
        console.log(`${indent}  Found directory match: ${subDirNode.path}`);
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

  // Manejar conversión de DOCX a PDF para previsualización
  ipcMain.handle('convert-docx-to-pdf', async (event, docxPath) => {
    try {
      const pythonScriptPath = path.join(__dirname, 'Portear', 'src', 'convert_docx_to_pdf.py');
      const command = `python "${pythonScriptPath}" "${docxPath}"`;
      
      console.log(`Executing DOCX conversion: ${command}`);
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr) {
        // Si hay un error en stderr, es probable que sea un error JSON de nuestro script
        console.error('DOCX conversion script error:', stderr);
        return JSON.parse(stderr);
      }

      return JSON.parse(stdout);

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
  
  // Manejar procesamiento de PDF de remisión
  ipcMain.handle('process-remision-pdf', async (event, pdfPath, empresa, companyName, moduleName, submoduleName) => {
    try {
      console.log(`Processing remision PDF: ${pdfPath} for empresa: ${empresa}`);
      
      // Aquí iría la lógica para procesar el PDF de remisión
      // Por ahora, solo simulamos el éxito
      return { success: true, message: "Funcionalidad de procesamiento de PDF aún no implementada." };
    } catch (error) {
      console.error('Error processing remision PDF:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Manejar envío de remisión por email
  ipcMain.handle('send-remision-by-email', async (event, docPath, extractedData, empresa) => {
    try {
      console.log(`Sending remision by email: ${docPath} for empresa: ${empresa}`);
      // Aquí iría la lógica para enviar el correo electrónico
      // Por ahora, solo simulamos el éxito
      return { success: true, message: "Funcionalidad de envío de email aún no implementada." };
    } catch (error) {
      console.error('Error sending remision by email:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Manejar envío de remisión por WhatsApp
  ipcMain.handle('send-remision-by-whatsapp', async (event, docPath, extractedData, empresa) => {
    try {
      console.log(`Preparing to send remision by WhatsApp: ${docPath} for empresa: ${empresa}`);
      // Aquí iría la lógica para preparar el envío por WhatsApp
      // Por ahora, solo simulamos el éxito
      return { success: true, message: "Funcionalidad de envío por WhatsApp aún no implementada." };
    } catch (error) {
      console.error('Error preparing remision for WhatsApp:', error);
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