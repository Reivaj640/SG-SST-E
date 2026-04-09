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
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const ExcelJS = require('exceljs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Importar handlers de investigación de accidentes
require('./modules/gestion-salud/investigacion-accidentes/investigacion_handlers.js');

// Importar handlers de Archivo y Retención Documental (Submódulo 2.5.1)
const { registerArchivoRetencionHandlers } = require('./modules/gestion-integral/archivo-retencion/archivo-retencion-main');

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
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.autoRunAppAfterInstall = true;
// Configurar timeout para evitar cuelgues en conexiones lentas
autoUpdater.requestHeaders = {
  'Cache-Control': 'no-cache'
};
// ------------------------------------

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

// --- Detección robusta de Python ---
// EXPONER A GLOBAL PARA QUE LOS HANDLERS PUEDAN USARLO
global.cachedPythonPath = null;

/**
 * Obtiene la ruta de Python empaquetado con la aplicación.
 * En producción, usa Python embeddable incluido en resources/python-embed/
 * En desarrollo, usa Python del sistema o .venv
 * 
 * @returns {Promise<string>} - Ruta al ejecutable de Python
 */
async function getEmbeddedPythonPath() {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    if (isDev) {
        // Desarrollo: usar Python del sistema o .venv
        console.log('[PYTHON] Modo desarrollo: buscando Python del sistema...');
        return await findPython();
    } else {
        // Producción: usar Python empaquetado
        const embeddedPythonPath = path.join(process.resourcesPath, 'python-embed', 'python.exe');
        console.log(`[PYTHON] Modo producción: verificando Python empaquetado en: ${embeddedPythonPath}`);
        
        if (fs.existsSync(embeddedPythonPath)) {
            console.log('[PYTHON] ✓ Python empaquetado encontrado');
            return embeddedPythonPath;
        } else {
            console.warn('[PYTHON] ⚠ Python empaquetado NO encontrado, usando fallback al sistema');
            // Fallback: buscar Python en sistema
            return await findPython();
        }
    }
}

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

    // Si hay un cache, verificar que exista y sea ejecutable
    if (global.cachedPythonPath) {
        if (fs.existsSync(global.cachedPythonPath)) {
            try {
                await execFilePromise(global.cachedPythonPath, ['--version']);
                console.log('[DEBUG] Using cached Python path:', global.cachedPythonPath);
                return global.cachedPythonPath;
            } catch (e) {
                console.log('[DEBUG] Cached Python path is not executable, clearing cache:', global.cachedPythonPath);
                global.cachedPythonPath = null;
            }
        } else {
            console.log('[DEBUG] Cached Python path does not exist, clearing cache:', global.cachedPythonPath);
            global.cachedPythonPath = null;
        }
    }

    // Usar Python empaquetado (producción) o buscar Python desde cero (desarrollo)
    global.cachedPythonPath = await getEmbeddedPythonPath();
    console.log('[DEBUG] New Python path cached:', global.cachedPythonPath);
    return global.cachedPythonPath;
}

/**
 * Obtiene la ruta correcta para scripts de Python tanto en desarrollo como en app empaquetada.
 * En producción, los scripts se empaquetan en process.resourcesPath/python-scripts/
 * En desarrollo, están en __dirname/Portear/src/
 * 
 * @param {string} scriptName - Nombre del script Python (ej: 'map_directory.py')
 * @returns {string} - Ruta absoluta al script
 */
function getPythonScriptPath(scriptName) {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const resourcesPath = isDev 
        ? __dirname 
        : (process.resourcesPath || __dirname);
    
    const scriptDir = isDev ? 'Portear/src' : 'python-scripts';
    return path.join(resourcesPath, scriptDir, scriptName);
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

// ===============================
// 🗄️ BASE DE DATOS LOCAL (SQLite)
// ===============================
let db = null;
let dbInitialized = false;

function readConfigSync() {
  try {
    if (!fsSync.existsSync(configPath)) return {};
    const data = fsSync.readFileSync(configPath, 'utf8');
    return JSON.parse(data || '{}');
  } catch (e) {
    console.warn('[DB] Error leyendo config.json:', e.message);
    return {};
  }
}

function initDbOnce() {
  if (dbInitialized) return;
  const dbPath = path.join(app.getPath('userData'), 'kair.db');

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user_company_roles (
        user_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, company_id, role_id)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);

    const roleNames = ['Administrador', 'SST', 'Auditoría', 'Gerencia', 'Recursos Humanos'];
    const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
    roleNames.forEach(r => insertRole.run(r));

    const userCount = db.prepare('SELECT COUNT(1) AS total FROM users').get().total;
    if (userCount === 0) {
      const defaultEmail = 'admin@kair.local';
      const defaultPass = 'Admin123!';
      const hash = bcrypt.hashSync(defaultPass, 10);
      db.prepare(`
        INSERT INTO users (email, full_name, password_hash, status, created_at)
        VALUES (?, ?, ?, 'active', ?)
      `).run(defaultEmail, 'Administrador K+AIR', hash, new Date().toISOString());
      console.log('[DB] Usuario admin creado por defecto:', defaultEmail);
    }

    try {
      companiesSyncInternal(db);
    } catch (syncErr) {
      console.warn('[DB] Error en companiesSyncInternal (no crítico):', syncErr.message);
    }
    dbInitialized = true;
    console.log('[DB] Base de datos inicializada en:', dbPath);
  } catch (e) {
    console.error('[DB] Error inicializando DB:', e.message);
    dbInitialized = false;
  }
}

function getDb() {
  if (!dbInitialized) {
    initDbOnce();
  }
  if (!db) throw new Error('DB_NOT_INITIALIZED');
  return db;
}

function companiesSyncInternal(localDb = null) {
  const dbRef = localDb || db;
  if (!dbRef) {
    console.warn('[DB] companiesSyncInternal llamado sin DB inicializada');
    return;
  }
  const config = readConfigSync();
  const companyPaths = config.companyPaths || {};
  const upsert = dbRef.prepare(`
    INSERT INTO companies (company_key, display_name)
    VALUES (?, ?)
    ON CONFLICT(company_key) DO UPDATE SET display_name=excluded.display_name
  `);
  Object.keys(companyPaths).forEach(key => {
    upsert.run(key, key);
  });
}

function validateSession(token) {
  if (!token) {
    return { ok: false, error: { code: 'AUTH_REQUIRED', message: 'Token requerido' } };
  }
  const localDb = getDb();
  const row = localDb.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!row) {
    return { ok: false, error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } };
  }
  const now = new Date();
  if (new Date(row.expires_at) <= now) {
    localDb.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return { ok: false, error: { code: 'SESSION_EXPIRED', message: 'Sesión expirada' } };
  }
  
  // Obtener información completa del usuario incluyendo sus roles y empresas
  const userInfo = localDb.prepare(`
    SELECT u.id, u.email, u.full_name, u.status,
           GROUP_CONCAT(DISTINCT c.company_key || '|' || r.name) AS user_roles
    FROM users u
    LEFT JOIN user_company_roles ucr ON ucr.user_id = u.id
    LEFT JOIN companies c ON c.id = ucr.company_id
    LEFT JOIN roles r ON r.id = ucr.role_id
    WHERE u.id = ?
    GROUP BY u.id
  `).get(row.user_id);

  // Parsear los roles del usuario
  const userRoles = [];
  const companies = [];
  if (userInfo.user_roles) {
    const rolesList = userInfo.user_roles.split(',');
    rolesList.forEach(roleEntry => {
      const [companyKey, roleName] = roleEntry.split('|');
      if (companyKey && roleName) {
        companies.push(companyKey);
        userRoles.push({ company: companyKey, role: roleName });
      }
    });
  }

  // Verificar si el usuario tiene rol de administrador en alguna empresa
  const isAdmin = userRoles.some(ur =>
    ur.role.toLowerCase() === 'administrador' ||
    ur.role.toLowerCase() === 'administrador del sistema'
  );

  // Si no tiene empresas asignadas, verificar si es el usuario administrador global por email O por rol
  const isAdminGlobal = !isAdmin && userRoles.length === 0 &&
    (userInfo.email === 'admin@kair.local' ||
     userInfo.email === 'administrador@kair.local' ||
     userInfo.email === 'admin@kair.com' ||
     userInfo.email === 'administrador@kair.com');

  // También verificar si el usuario tiene el rol "Administrador" directamente en la base de datos
  // (incluso si no tiene empresas asignadas, por si fue creado como admin global)
  const isAdminByDefault = userRoles.length === 0 && 
    userInfo.email.toLowerCase().includes('admin');

  return {
    ok: true,
    session: row,
    user: {
      id: row.user_id,
      email: userInfo.email,
      full_name: userInfo.full_name,
      companies: companies,
      roles: userRoles,
      isAdmin: isAdmin || isAdminGlobal || isAdminByDefault
    }
  };
}

/**
 * Valida que el usuario tenga rol de administrador
 * @param {object} sessionResult - Resultado de validateSession
 * @returns {object} - { ok: boolean, error?: object }
 */
function requireAdmin(sessionResult) {
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }
  if (!sessionResult.user.isAdmin) {
    return { 
      ok: false, 
      error: { 
        code: 'PERMISSION_DENIED', 
        message: 'Acceso denegado. Se requiere rol de administrador.' 
      } 
    };
  }
  return { ok: true };
}

// ===============================
// 🔄 SISTEMA DE AUTO-ACTUALIZACIONES
// ===============================

// Verificar actualizaciones disponibles
autoUpdater.on('checking-for-update', () => {
  sendLog('Verificando actualizaciones disponibles...', 'INFO');
  sendLog(`[UPDATER] mainWindow existe: ${mainWindow !== null}`, 'DEBUG');
  sendLog(`[UPDATER] mainWindow destruida: ${mainWindow && mainWindow.isDestroyed()}`, 'DEBUG');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_checking');
    sendLog('[UPDATER] Enviado: update_checking', 'DEBUG');
  }
});

// Cuando hay una actualización disponible
autoUpdater.on('update-available', (info) => {
  sendLog(`Actualización disponible: v${info.version}`, 'INFO');
  sendLog(`[UPDATER] Enviando evento update_available con versión: ${info.version}`, 'INFO');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_available', info);
    sendLog('[UPDATER] Enviado: update_available', 'DEBUG');
  }
  // Iniciar descarga automáticamente
  autoUpdater.downloadUpdate();
});

// Cuando NO hay actualizaciones
autoUpdater.on('update-not-available', (info) => {
  sendLog(`No hay actualizaciones disponibles. Versión actual: v${info.version}`, 'INFO');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_not_available', info);
    sendLog('[UPDATER] Enviado: update_not_available', 'DEBUG');
  }
});

// Progreso de descarga
autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  const speed = (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2);
  sendLog(`Descargando: ${percent}% (${speed} MB/s)`, 'INFO');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_progress', { percent, speed });
  }
});

// Cuando la descarga se completa
autoUpdater.on('update-downloaded', (info) => {
  sendLog(`Actualización v${info.version} descargada. Lista para instalar.`, 'INFO');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_downloaded', info);
  }
});

// Errores
autoUpdater.on('error', (err) => {
  sendLog(`Error en el auto-updater: ${err.message}`, 'ERROR');
  sendLog(`[UPDATER] Error details: ${JSON.stringify(err)}`, 'DEBUG');

  let errorMessage = err.message;
  let shouldRetry = false;

  // Detectar error código 2 de Squirrel (archivos en uso)
  if (err.message && err.message.includes('Exit code: 2')) {
    errorMessage = 'No se pudo instalar la actualización. Por favor, cierre otras aplicaciones e intente de nuevo.';
    sendLog('Error Squirrel código 2: archivos en uso. Intentando nuevamente...', 'WARN');
    shouldRetry = true;
  }
  
  // Detectar errores de red (HTTP2, conexión, etc.)
  if (err.message && (
    err.message.includes('ERR_HTTP2_SERVER_REFUSED_STREAM') ||
    err.message.includes('ERR_INTERNET_DISCONNECTED') ||
    err.message.includes('ERR_NAME_NOT_RESOLVED') ||
    err.message.includes('ERR_CONNECTION_FAILED') ||
    err.message.includes('net::ERR_')
  )) {
    sendLog('[UPDATER] Error de red detectado. No es crítico, la app funcionará normalmente.', 'WARN');
    errorMessage = 'No se pudo verificar actualizaciones. La aplicación funcionará normalmente. Se reintentará más tarde.';
    shouldRetry = false; // No reintentar inmediatamente para no saturar
  }
  
  // Detectar errores de rate limiting de GitHub API
  if (err.message && (
    err.message.includes('403') ||
    err.message.includes('rate limit')
  )) {
    sendLog('[UPDATER] Rate limit de GitHub API alcanzado. Se reintentará más tarde.', 'WARN');
    errorMessage = 'Límite de verificaciones alcanzado. Se reintentará más tarde.';
    shouldRetry = false;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update_error', { message: errorMessage });
  }
  
  // Reintentar solo si es un error recuperable y después de un delay mayor
  if (shouldRetry) {
    setTimeout(() => {
      sendLog('[UPDATER] Reintentando verificación de actualizaciones...', 'INFO');
      checkForUpdatesSafe();
    }, 10000); // 10 segundos de espera
  }
});

// Función segura para verificar actualizaciones con try-catch
function checkForUpdatesSafe() {
  try {
    sendLog('[UPDATER] checkForUpdatesSafe: Iniciando verificación...', 'INFO');
    const result = autoUpdater.checkForUpdates();
    
    // Manejar la promesa para evitar unhandled rejections
    if (result && typeof result.then === 'function') {
      result.catch((err) => {
        sendLog(`[UPDATER] checkForUpdatesSafe: Error capturado en Promise: ${err.message}`, 'ERROR');
        // El error ya será manejado por el event listener 'error'
      });
    }
  } catch (err) {
    sendLog(`[UPDATER] checkForUpdatesSafe: Error síncrono capturado: ${err.message}`, 'ERROR');
    // El error ya será manejado por el event listener 'error'
  }
}

// Verificar si se está ejecutando con squirrel (instalador de Windows)
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Función para crear la ventana principal
const createWindow = () => {
  initDbOnce();
  // Verificar si la ventana ya ha sido creada o si mainWindow existe y no está destruida
  if (isWindowCreated && mainWindow && !mainWindow.isDestroyed()) {
    console.log('[MAIN] La ventana ya existe, trayéndola al frente...');
    mainWindow.focus();
    return;
  }
  
  console.log('[MAIN] Creando ventana principal...');
  isWindowCreated = true;
  
  mainWindow = new BrowserWindow({
    width: 1200, // Ancho inicial 1200 para mejor visualización en 1366px y 1920px
    height: 700, // Alto inicial 700 para que quepa en 768px con margen para barra de título
    minWidth: 1024, // Mínimo razonable para UI funcional
    minHeight: 650, // Permite uso en pantallas 1366x768
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

// ===============================
// 🔐 AUTH & COMPANIES (V1)
// ===============================
ipcMain.handle('auth-login-v1', async (event, payload = {}) => {
  try {
    const { email, password } = payload;
    if (!email || !password) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'Email y password son requeridos.' } };
    }

    const localDb = getDb();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = localDb.prepare('SELECT * FROM users WHERE lower(email) = ?').get(normalizedEmail);
    if (!user) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } };
    }
    if (user.status !== 'active') {
      return { success: false, error: { code: 'USER_INACTIVE', message: 'Usuario inactivo.' } };
    }
    if (!bcrypt.compareSync(String(password), user.password_hash)) {
      return { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas.' } };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    localDb.prepare(`
      INSERT INTO sessions (user_id, token, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, token, now.toISOString(), expiresAt.toISOString());

    localDb.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(now.toISOString(), user.id);

    // Obtener empresas y roles del usuario
    const userCompanies = localDb.prepare(`
      SELECT c.company_key, c.display_name, r.name AS role
      FROM user_company_roles ucr
      JOIN companies c ON c.id = ucr.company_id
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = ?
    `).all(user.id);

    // Validar sesión para obtener isAdmin (usando validateSession)
    const sessionCheck = validateSession(token);
    const isAdmin = sessionCheck.ok ? sessionCheck.user.isAdmin : false;

    console.log(`[AUTH] Login exitoso para ${email}, isAdmin: ${isAdmin}, companies: ${userCompanies.length}`);

    return {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          status: user.status,
          isAdmin: isAdmin,  // ← AGREGADO: isAdmin desde validateSession
          companies: userCompanies  // ← AGREGADO: companies dentro del user
        },
        companies: userCompanies  // ← Mantenido para compatibilidad
      }
    };
  } catch (error) {
    console.error('[AUTH] Error en login:', error);
    return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
  }
});

ipcMain.handle('auth-logout-v1', async (event, payload = {}) => {
  try {
    const { token } = payload;
    if (!token) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'Token requerido.' } };
    }
    const localDb = getDb();
    localDb.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return { success: true };
  } catch (error) {
    console.error('[AUTH] Error en logout:', error);
    return { success: false, error: { code: 'AUTH_ERROR', message: error.message } };
  }
});

ipcMain.handle('companies-sync-v1', async (event, payload = {}) => {
  try {
    const { token } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) {
      return { success: false, error: sessionCheck.error };
    }

    const config = readConfigSync();
    const companyPaths = config.companyPaths || {};
    companiesSyncInternal(localDb);
    return { success: true, data: { count: Object.keys(companyPaths).length } };
  } catch (error) {
    console.error('[COMPANIES] Error en sync:', error);
    return { success: false, error: { code: 'SYNC_ERROR', message: error.message } };
  }
});

// ===============================
// 👤 USERS & ASSIGNMENTS (V1)
// ===============================
ipcMain.handle('users-list-v1', async (event, payload = {}) => {
  try {
    const { token } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    // Validar que el usuario tenga rol de administrador
    const adminCheck = requireAdmin(sessionCheck);
    if (!adminCheck.ok) return { success: false, error: adminCheck.error };

    const localDb = getDb();
    const users = localDb.prepare(`
      SELECT id, email, full_name, status, created_at, last_login_at
      FROM users
      ORDER BY id ASC
    `).all();

    return { success: true, data: { users } };
  } catch (error) {
    console.error('[USERS] Error listando usuarios:', error);
    return { success: false, error: { code: 'USERS_LIST_ERROR', message: error.message } };
  }
});

ipcMain.handle('users-create-v1', async (event, payload = {}) => {
  try {
    const { token, user } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    if (!user || !user.email || !user.full_name || !user.password) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'Datos de usuario incompletos.' } };
    }

    const localDb = getDb();
    const email = String(user.email).trim().toLowerCase();
    const fullName = String(user.full_name).trim();
    const passwordHash = bcrypt.hashSync(String(user.password), 10);

    const exists = localDb.prepare('SELECT id FROM users WHERE lower(email) = ?').get(email);
    if (exists) {
      return { success: false, error: { code: 'EMAIL_EXISTS', message: 'El email ya existe.' } };
    }

    const result = localDb.prepare(`
      INSERT INTO users (email, full_name, password_hash, status, created_at)
      VALUES (?, ?, ?, 'active', ?)
    `).run(email, fullName, passwordHash, new Date().toISOString());

    return { success: true, data: { userId: result.lastInsertRowid } };
  } catch (error) {
    console.error('[USERS] Error creando usuario:', error);
    return { success: false, error: { code: 'USERS_CREATE_ERROR', message: error.message } };
  }
});

ipcMain.handle('users-update-v1', async (event, payload = {}) => {
  try {
    const { token, userId, patch } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    if (!userId || !patch) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'userId y patch son requeridos.' } };
    }

    const localDb = getDb();
    const current = localDb.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!current) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } };
    }

    const updates = [];
    const params = [];

    if (patch.email) {
      const email = String(patch.email).trim().toLowerCase();
      const exists = localDb.prepare('SELECT id FROM users WHERE lower(email) = ? AND id != ?').get(email, userId);
      if (exists) {
        return { success: false, error: { code: 'EMAIL_EXISTS', message: 'El email ya existe.' } };
      }
      updates.push('email = ?');
      params.push(email);
    }

    if (patch.full_name) {
      updates.push('full_name = ?');
      params.push(String(patch.full_name).trim());
    }

    if (patch.status) {
      updates.push('status = ?');
      params.push(String(patch.status));
    }

    if (patch.password) {
      updates.push('password_hash = ?');
      params.push(bcrypt.hashSync(String(patch.password), 10));
    }

    if (updates.length === 0) {
      return { success: false, error: { code: 'NO_CHANGES', message: 'No hay cambios para aplicar.' } };
    }

    params.push(userId);
    localDb.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return { success: true };
  } catch (error) {
    console.error('[USERS] Error actualizando usuario:', error);
    return { success: false, error: { code: 'USERS_UPDATE_ERROR', message: error.message } };
  }
});

ipcMain.handle('users-disable-v1', async (event, payload = {}) => {
  try {
    const { token, userId } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    if (!userId) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'userId es requerido.' } };
    }

    const localDb = getDb();
    const result = localDb.prepare('UPDATE users SET status = ? WHERE id = ?').run('inactive', userId);
    if (result.changes === 0) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' } };
    }
    return { success: true };
  } catch (error) {
    console.error('[USERS] Error desactivando usuario:', error);
    return { success: false, error: { code: 'USERS_DISABLE_ERROR', message: error.message } };
  }
});

ipcMain.handle('assignments-set-v1', async (event, payload = {}) => {
  try {
    const { token, assignments, replaceAllForUser = false } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'assignments requeridos.' } };
    }

    const localDb = getDb();
    companiesSyncInternal();

    const findUser = localDb.prepare('SELECT id FROM users WHERE id = ?');
    const findCompany = localDb.prepare('SELECT id FROM companies WHERE company_key = ?');
    const findRole = localDb.prepare('SELECT id FROM roles WHERE lower(name) = lower(?)');
    const insertRole = localDb.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
    const deleteExisting = localDb.prepare('DELETE FROM user_company_roles WHERE user_id = ? AND company_id = ?');
    const deleteAllForUser = localDb.prepare('DELETE FROM user_company_roles WHERE user_id = ?');
    const insertAssignment = localDb.prepare(`
      INSERT OR IGNORE INTO user_company_roles (user_id, company_id, role_id)
      VALUES (?, ?, ?)
    `);

    const tx = localDb.transaction((items) => {
      if (replaceAllForUser) {
        const firstUserId = items[0]?.userId;
        if (firstUserId) {
          deleteAllForUser.run(firstUserId);
        }
      }
      items.forEach(item => {
        const userId = item.userId;
        const companyKey = String(item.companyKey || '').trim();
        const roleName = String(item.role || '').replace(/\s+/g, ' ').trim();

        if (!userId || !companyKey || !roleName) {
          throw new Error('Asignación inválida: userId, companyKey y role son requeridos.');
        }

        const user = findUser.get(userId);
        if (!user) throw new Error(`Usuario no encontrado: ${userId}`);

        const company = findCompany.get(companyKey);
        if (!company) throw new Error(`Empresa no encontrada: ${companyKey}`);

        let role = findRole.get(roleName);
        if (!role) {
          insertRole.run(roleName);
          role = findRole.get(roleName);
        }
        if (!role) throw new Error(`Rol no encontrado: ${roleName}`);

        deleteExisting.run(user.id, company.id);
        insertAssignment.run(user.id, company.id, role.id);
      });
    });

    tx(assignments);
    return { success: true };
  } catch (error) {
    console.error('[ASSIGNMENTS] Error asignando:', error);
    return { success: false, error: { code: 'ASSIGNMENTS_ERROR', message: error.message } };
  }
});

ipcMain.handle('assignments-list-v1', async (event, payload = {}) => {
  try {
    const { token } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    const localDb = getDb();
    const sessionUserId = sessionCheck.session.user_id;
    const rows = localDb.prepare(`
      SELECT
        u.id AS user_id,
        u.email AS user_email,
        u.full_name AS user_full_name,
        c.company_key AS company_key,
        c.display_name AS company_name,
        r.name AS role
      FROM user_company_roles ucr
      JOIN users u ON u.id = ucr.user_id
      JOIN companies c ON c.id = ucr.company_id
      JOIN roles r ON r.id = ucr.role_id
      WHERE u.id = ?
      ORDER BY u.id ASC, c.company_key ASC
    `).all(sessionUserId);

    return { success: true, data: { assignments: rows } };
  } catch (error) {
    console.error('[ASSIGNMENTS] Error listando:', error);
    return { success: false, error: { code: 'ASSIGNMENTS_LIST_ERROR', message: error.message } };
  }
});

ipcMain.handle('assignments-list-by-user-v1', async (event, payload = {}) => {
  try {
    const { token, userId } = payload;
    const sessionCheck = validateSession(token);
    if (!sessionCheck.ok) return { success: false, error: sessionCheck.error };

    if (!userId) {
      return { success: false, error: { code: 'INVALID_INPUT', message: 'userId es requerido.' } };
    }

    const localDb = getDb();
    const rows = localDb.prepare(`
      SELECT
        c.company_key AS company_key,
        c.display_name AS company_name,
        r.name AS role
      FROM user_company_roles ucr
      JOIN companies c ON c.id = ucr.company_id
      JOIN roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = ?
      ORDER BY c.company_key ASC
    `).all(userId);

    return { success: true, data: { assignments: rows } };
  } catch (error) {
    console.error('[ASSIGNMENTS] Error listando por usuario:', error);
    return { success: false, error: { code: 'ASSIGNMENTS_LIST_ERROR', message: error.message } };
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
// 🔍 VERIFICACIÓN DE DEPENDENCIAS
// ===============================

/**
 * Verifica el estado de las dependencias externas (Python, scripts, etc.)
 * @returns {object} - Estado de las dependencias
 */
ipcMain.handle('check-dependencies', async () => {
  const result = {
    python: { available: false, path: null, version: null, error: null },
    scripts: { available: false, missing: [], error: null },
    overall: false,
    messages: []
  };

  // 1. Verificar Python
  try {
    const pythonPath = await getPython();
    result.python.available = true;
    result.python.path = pythonPath;

    // Obtener versión de Python
    try {
      const { stdout } = await execFilePromise(pythonPath, ['--version']);
      result.python.version = stdout.trim();
    } catch (vError) {
      result.python.version = 'Desconocida';
    }
  } catch (pyError) {
    result.python.error = pyError.message;
    result.messages.push({
      type: 'error',
      title: 'Python no está instalado',
      message: 'Python 3.10-3.12 no fue encontrado. Instálelo desde python.org y agréguelo al PATH.'
    });
  }

  // 2. Verificar scripts críticos de Python
  const criticalScripts = [
    'map_directory.py',
    'actualizar_ausentismo.py',
    'convert_docx_to_pdf.py',
    'convert_xlsx_to_pdf.py',
    'copasst_acta_generator.py',
    'comite_convivencia_acta_generator.py',
    'dashboard_scanner.py'
  ];

  const missingScripts = [];
  for (const script of criticalScripts) {
    const scriptPath = getPythonScriptPath(script);
    if (!fs.existsSync(scriptPath)) {
      missingScripts.push(script);
    }
  }

  if (missingScripts.length === 0) {
    result.scripts.available = true;
  } else {
    result.scripts.missing = missingScripts;
    result.scripts.error = `Scripts faltantes: ${missingScripts.join(', ')}`;
    result.messages.push({
      type: 'error',
      title: 'Scripts de Python faltantes',
      message: `Los siguientes scripts no se encontraron: ${missingScripts.join(', ')}. Esto puede indicar un problema con la instalación.`
    });
  }

  // 3. Determinar estado general
  result.overall = result.python.available && result.scripts.available;

  if (result.overall) {
    result.messages.push({
      type: 'success',
      title: 'Todas las dependencias están disponibles',
      message: 'Python y los scripts requeridos están correctamente instalados.'
    });
  }

  return result;
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

// ===============================
// 📊 DASHBOARD ALERTAS - CÁLCULO DESDE DATOS INTERNOS
// ===============================

/**
 * Calcula las alertas del dashboard usando las funciones existentes de Recursos
 * en lugar de depender de archivos Excel externos.
 */
async function getDashboardAlertas(rootPath, companyName) {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Estructura base de retorno (misma que dashboard_scanner.py)
  const dashboard_data = {
    kpis: {
      accidents_month: 0,
      pric_active: 0,
      overdue_docs: 0,
      compliance: 0,
      recursos_alerts: 0,
      gestion_salud_alerts: 0
    },
    tasks: [],
    module_status: {
      recursos: "ok",
      "gestion-integral": "ok",
      "gestion-salud": "ok",
      peligros: "ok",
      amenazas: "ok",
      verificacion: "ok",
      mejoramiento: "ok"
    },
    recursos_detail: {
      capacitaciones_vencidas: {
        total: 0,
        copasst: 0,
        comite_convivencia: 0,
        inducciones: 0,
        curso_50_horas: 0,
        otros: 0
      },
      capacitaciones_proximas: {
        total: 0,
        en_7_dias: 0,
        en_15_dias: 0
      },
      epp_por_entregar: 0,
      cumplimiento_porcentaje: 0
    },
    overall_status: "ok"
  };

  try {
    // ========================================================================
    // 1. CAPACITACIONES - Usar calculateCapacitacionesStats
    // ========================================================================
    const capacitacionesStats = await calculateCapacitacionesStats(rootPath);
    
    // Calcular vencidas y próximas desde las capacitaciones programadas
    const capacitaciones = await obtenerCapacitacionesDetalladas(rootPath);

    const vencidas = capacitaciones.filter(c => c.vencida && !c.realizada);
    const proximas_7 = capacitaciones.filter(c => c.proxima_7 && !c.realizada);
    const proximas_15 = capacitaciones.filter(c => c.proxima_15 && !c.realizada);
    // Solo contar como pendientes las que tienen fecha asignada y no están realizadas
    // Esto alinea el badge del dashboard con el widget de capacitaciones
    const pendientes_totales = capacitaciones.filter(c => c.fecha && !c.realizada);
    const sin_fecha = capacitaciones.filter(c => !c.fecha && !c.realizada);

    // Clasificar vencidas por tipo
    const vencidas_por_tipo = {
      copasst: 0,
      comite_convivencia: 0,
      inducciones: 0,
      curso_50_horas: 0,
      otros: 0
    };
    
    vencidas.forEach(c => {
      const tema = (c.tema || '').toLowerCase();
      if (tema.includes('copasst') || tema.includes('copas')) {
        vencidas_por_tipo.copasst++;
      } else if (tema.includes('comite') || tema.includes('convivencia')) {
        vencidas_por_tipo.comite_convivencia++;
      } else if (tema.includes('induccion') || tema.includes('reinduccion')) {
        vencidas_por_tipo.inducciones++;
      } else if (tema.includes('50 horas') || tema.includes('curso 50')) {
        vencidas_por_tipo.curso_50_horas++;
      } else {
        vencidas_por_tipo.otros++;
      }
    });
    
    // Actualizar KPIs
    dashboard_data.kpis.overdue_docs = vencidas.length;
    dashboard_data.kpis.compliance = capacitacionesStats.porcentajeCumplimiento;

    // REGLA DE ORO ACTUALIZADA: Alertas de recursos = Vencidas + Pendientes de gestión
    // Esto asegura que el badge del home coincida con lo que el usuario ve dentro del módulo.
    
    // KPI ESPECÍFICO: Solo capacitaciones (para alinear con widget)
    dashboard_data.kpis.capacitaciones_alertas = pendientes_totales.length;
    
    // KPI GENERAL: Todo el módulo Recursos (capacitaciones + presupuesto + comités)
    dashboard_data.kpis.recursos_alerts = pendientes_totales.length;

    // LOG DE AUDITORÍA: Desglose de alertas para debugging
    const futuras = pendientes_totales.length - vencidas.length - proximas_7.length;
    sendLog(`[DASHBOARD] 📊 Capacitaciones: ${pendientes_totales.length} alertas (${vencidas.length} vencidas, ${proximas_7.length} en 7 días, ${futuras > 0 ? futuras : 0} futuras, ${sin_fecha.length} sin fecha)`, 'INFO');

    // LOG DETALLADO: Listar las capacitaciones pendientes con fecha
    if (pendientes_totales.length > 0) {
      sendLog(`[DASHBOARD] 📋 Detalle de ${pendientes_totales.length} capacitaciones pendientes:`, 'INFO');
      pendientes_totales.forEach((c, i) => {
        const estado = c.vencida ? 'VENCIDA' : c.proxima_7 ? 'PRÓXIMA (7 días)' : c.proxima_15 ? 'PRÓXIMA (15 días)' : 'FUTURA';
        const fechaStr = c.fecha ? c.fecha.toISOString().split('T')[0] : 'SIN FECHA';
        sendLog(`  [${i+1}] "${c.tema}" - Fecha: ${fechaStr} - Estado: ${estado}`, 'INFO');
      });
    }

    dashboard_data.recursos_detail.capacitaciones_vencidas = {
      total: vencidas.length,
      copasst: vencidas_por_tipo.copasst,
      comite_convivencia: vencidas_por_tipo.comite_convivencia,
      inducciones: vencidas_por_tipo.inducciones,
      curso_50_horas: vencidas_por_tipo.curso_50_horas,
      otros: vencidas_por_tipo.otros
    };
    
    dashboard_data.recursos_detail.capacitaciones_proximas = {
      total: proximas_7.length + proximas_15.length,
      en_7_dias: proximas_7.length,
      en_15_dias: proximas_15.length
    };
    
    dashboard_data.recursos_detail.cumplimiento_porcentaje = capacitacionesStats.porcentajeCumplimiento;

    // TAREA CRÍTICA: Capacitaciones vencidas
    if (vencidas.length > 0) {
      const detalles = [];
      if (vencidas_por_tipo.copasst > 0) detalles.push(`${vencidas_por_tipo.copasst} COPASST`);
      if (vencidas_por_tipo.comite_convivencia > 0) detalles.push(`${vencidas_por_tipo.comite_convivencia} Comité Convivencia`);
      if (vencidas_por_tipo.inducciones > 0) detalles.push(`${vencidas_por_tipo.inducciones} Inducciones`);
      if (vencidas_por_tipo.curso_50_horas > 0) detalles.push(`${vencidas_por_tipo.curso_50_horas} Curso 50 Horas`);
      if (vencidas_por_tipo.otros > 0) detalles.push(`${vencidas_por_tipo.otros} Otras`);

      const mensaje_detalles = detalles.length > 0 ? ` (${detalles.join(', ')})` : '';

      // Obtener nombres de las capacitaciones vencidas para mostrar en la descripción
      const nombresVencidas = vencidas.slice(0, 3).map(v => v.tema).join('; ');
      const faltantes = vencidas.length > 3 ? ` (+${vencidas.length - 3} más)` : '';

      dashboard_data.tasks.push({
        title: `${vencidas.length} Capacitaciones Vencidas${mensaje_detalles}`,
        desc: `${nombresVencidas}${faltantes}. Cumplimiento actual: ${capacitacionesStats.porcentajeCumplimiento}%`,
        priority: capacitacionesStats.porcentajeCumplimiento < 50 ? "critical" : "warning",
        module: "capacitaciones",
        icon: "fas fa-chalkboard-teacher",
        submodule: "1.2.1 Programa de Capacitación"
      });

      // LOG DE DEPURACIÓN: Alerta de capacitaciones vencidas
      console.log(`[DASHBOARD] 📋 [CAPACITACIONES] Alerta agregada (VENCIDAS):`, {
        titulo: `${vencidas.length} Capacitaciones Vencidas${mensaje_detalles}`,
        descripcion: `${nombresVencidas}${faltantes}. Cumplimiento: ${capacitacionesStats.porcentajeCumplimiento}%`,
        vencidas: vencidas.length,
        detalles: detalles,
        cumplimiento: capacitacionesStats.porcentajeCumplimiento
      });

      dashboard_data.module_status.recursos = capacitacionesStats.porcentajeCumplimiento < 50 ? "danger" : "warning";
    }
    // TAREA DE GESTIÓN: Capacitaciones pendientes (aunque no estén vencidas)
    else if (pendientes_totales.length > 0) {
      const proximas_texto = proximas_7.length > 0 ? ` (${proximas_7.length} esta semana)` : '';

      dashboard_data.tasks.push({
        title: `${pendientes_totales.length} Capacitaciones Pendientes${proximas_texto}`,
        desc: `Cronograma anual en curso. Próxima ejecución: ${pendientes_totales[0].fecha || 'Sin fecha'}.`,
        priority: "info",
        module: "capacitaciones",
        icon: "fas fa-calendar-check",
        submodule: "1.2.1 Programa de Capacitación"
      });

      // LOG DE DEPURACIÓN: Alerta de capacitaciones pendientes
      console.log(`[DASHBOARD] 📋 [CAPACITACIONES] Alerta agregada (PENDIENTES):`, {
        titulo: `${pendientes_totales.length} Capacitaciones Pendientes${proximas_texto}`,
        descripcion: `Cronograma anual en curso. Próxima: ${pendientes_totales[0].fecha || 'Sin fecha'}`,
        pendientes: pendientes_totales.length,
        proximas_7: proximas_7.length
      });
    } else {
      // LOG DE DEPURACIÓN: Sin alertas de capacitaciones
      console.log(`[DASHBOARD] ✅ [CAPACITACIONES] Sin alertas - ${vencidas.length} vencidas, ${pendientes_totales.length} pendientes`);
    }

    // ========================================================================
    // 2. INDUCCIONES - Usar calculateInduccionesStats
    // ========================================================================
    const induccionesStats = await calculateInduccionesStats(rootPath, companyName);

    // Si hay inducciones pendientes, agregar alerta
    if (induccionesStats.pendientes > 0) {
      const cumplimiento = induccionesStats.porcentajeCompletado;

      dashboard_data.tasks.push({
        title: `${induccionesStats.pendientes} Inducciones Pendientes`,
        desc: `Trabajadores sin inducción SST. Cumplimiento: ${cumplimiento}%`,
        priority: cumplimiento < 50 ? "critical" : (cumplimiento < 90 ? "warning" : "info"),
        module: "inducciones",
        icon: "fas fa-user-check",
        submodule: "1.2.2 Inducción y Reinducción"
      });

      // LOG DE DEPURACIÓN: Alerta de inducciones
      console.log(`[DASHBOARD] 📋 [INDUCCIONES] Alerta agregada:`, {
        titulo: `${induccionesStats.pendientes} Inducciones Pendientes`,
        descripcion: `Trabajadores sin inducción. Cumplimiento: ${cumplimiento}%`,
        pendientes: induccionesStats.pendientes,
        totalTrabajadores: induccionesStats.totalTrabajadores,
        completadas: induccionesStats.completadas,
        cumplimiento: cumplimiento
      });

      // Sumar al contador de alertas de gestion-salud
      if (cumplimiento < 90) {
        dashboard_data.kpis.gestion_salud_alerts = (dashboard_data.kpis.gestion_salud_alerts || 0) + induccionesStats.pendientes;
      }

      // Actualizar estado de gestion-salud (NO recursos)
      if (cumplimiento < 50) {
        dashboard_data.module_status["gestion-salud"] = "danger";
      } else if (dashboard_data.module_status["gestion-salud"] !== "danger") {
        dashboard_data.module_status["gestion-salud"] = "warning";
      }
    } else {
      // LOG DE DEPURACIÓN: Sin alertas de inducciones
      console.log(`[DASHBOARD] ✅ [INDUCCIONES] Sin alertas - ${induccionesStats.pendientes} pendientes`);
    }

    // ========================================================================
    // 3. EPP - Usar calculateEppsStats
    // ========================================================================
    const eppsStats = await calculateEppsStats(rootPath);

    // Si hay EPP pendientes, agregar alerta
    if (eppsStats.pendientes > 0) {
      dashboard_data.tasks.push({
        title: `${eppsStats.pendientes} EPP Por Entregar`,
        desc: "Equipos de protección programados sin registro de entrega.",
        priority: "critical",
        module: "epp",
        icon: "fas fa-vest",
        submodule: "2.13.1 Elementos de Protección Personal"
      });

      // LOG DE DEPURACIÓN: Alerta de EPP
      console.log(`[DASHBOARD] 📋 [EPP] Alerta agregada:`, {
        titulo: `${eppsStats.pendientes} EPP Por Entregar`,
        descripcion: "Equipos de protección programados sin registro de entrega.",
        pendientes: eppsStats.pendientes,
        totalEPPs: eppsStats.totalEPPs,
        entregados: eppsStats.entregados
      });

      dashboard_data.kpis.recursos_alerts += eppsStats.pendientes;
      dashboard_data.recursos_detail.epp_por_entregar = eppsStats.pendientes;
      dashboard_data.module_status.recursos = "danger";
    } else {
      // LOG DE DEPURACIÓN: Sin alertas de EPP
      console.log(`[DASHBOARD] ✅ [EPP] Sin alertas - ${eppsStats.pendientes} pendientes`);
    }

    // ========================================================================
    // 4. PRESUPUESTO - Usar calculatePresupuestoStats
    // ========================================================================
    const presupuestoStats = await calculatePresupuestoStats(rootPath, companyName);

    // Si hay alertas de presupuesto, agregar tarea
    if (presupuestoStats.alertas.length > 0 || presupuestoStats.estado !== 'ok') {
      let titulo = `Presupuesto: ${presupuestoStats.porcentajeEjecucion}% ejecutado`;
      let descripcion = `Total asignado: $${(presupuestoStats.totalAsignado / 1000000).toFixed(1)}M | Ejecutado: $${(presupuestoStats.totalEjecutado / 1000000).toFixed(1)}M | Saldo: $${(presupuestoStats.saldoDisponible / 1000000).toFixed(1)}M`;

      if (presupuestoStats.alertas.length > 0) {
        descripcion += ` | Alertas: ${presupuestoStats.alertas.join(', ')}`;
      }

      dashboard_data.tasks.push({
        title: titulo,
        desc: descripcion,
        priority: presupuestoStats.estado === 'danger' ? 'critical' : 'warning',
        module: 'presupuesto',
        icon: 'fas fa-chart-line',
        submodule: '1.4 Presupuesto'
      });

      // LOG DE DEPURACIÓN: Alerta de presupuesto
      console.log(`[DASHBOARD] 📋 [PRESUPUESTO] Alerta agregada:`, {
        titulo: titulo,
        descripcion: descripcion,
        totalAsignado: presupuestoStats.totalAsignado,
        totalEjecutado: presupuestoStats.totalEjecutado,
        porcentajeEjecucion: presupuestoStats.porcentajeEjecucion,
        saldoDisponible: presupuestoStats.saldoDisponible,
        estado: presupuestoStats.estado,
        alertas: presupuestoStats.alertas
      });

      dashboard_data.kpis.recursos_alerts += 1;

      if (presupuestoStats.estado === 'danger') {
        dashboard_data.module_status.recursos = 'danger';
      } else if (dashboard_data.module_status.recursos !== 'danger') {
        dashboard_data.module_status.recursos = 'warning';
      }
    } else {
      // LOG DE DEPURACIÓN: Sin alertas de presupuesto
      console.log(`[DASHBOARD] ✅ [PRESUPUESTO] Sin alertas - Ejecución: ${presupuestoStats.porcentajeEjecucion}%`);
    }

    // ========================================================================
    // 5. AFILIACIÓN SSSI - Usar calculateAfiliacionStats
    // ========================================================================
    const afiliacionStats = await calculateAfiliacionStats(rootPath, companyName);

    // Si hay alertas de afiliación, agregar tarea
    if (afiliacionStats.estado !== 'ok' || afiliacionStats.alertas.length > 0) {
      let titulo = `Afiliación SSSI: ${afiliacionStats.planillaMesEnCurso ? 'Al día' : 'Pendiente'}`;
      let descripcion = `Planillas registradas: ${afiliacionStats.totalPlanillas}`;

      if (afiliacionStats.alertas.length > 0) {
        descripcion += ` | Alertas: ${afiliacionStats.alertas.join(', ')}`;
      }

      dashboard_data.tasks.push({
        title: titulo,
        desc: descripcion,
        priority: afiliacionStats.estado === 'danger' ? 'critical' : 'warning',
        module: 'afiliacion',
        icon: 'fas fa-file-invoice',
        submodule: '1.1.4 Afiliación al SSSI'
      });

      dashboard_data.kpis.recursos_alerts += 1;

      // LOG DE DEPURACIÓN: Alerta de afiliación agregada
      console.log(`[DASHBOARD] 📋 [AFILIACIÓN] Alerta agregada:`, {
        titulo: titulo,
        descripcion: descripcion,
        priority: afiliacionStats.estado === 'danger' ? 'critical' : 'warning',
        totalPlanillas: afiliacionStats.totalPlanillas,
        planillaMesEnCurso: afiliacionStats.planillaMesEnCurso,
        ultimoMesRegistrado: afiliacionStats.ultimoMesRegistrado,
        alertas: afiliacionStats.alertas
      });

      if (afiliacionStats.estado === 'danger') {
        dashboard_data.module_status.recursos = 'danger';
      } else if (dashboard_data.module_status.recursos !== 'danger') {
        dashboard_data.module_status.recursos = 'warning';
      }
    } else {
      // LOG DE DEPURACIÓN: Afiliación al día
      console.log(`[DASHBOARD] ✅ [AFILIACIÓN] Al día - Planilla del mes en curso encontrada`);
    }

    // ========================================================================
    // 6. VERIFICAR ACTAS COPASST Y COMITÉ DE CONVIVENCIA
    // ========================================================================
    const actasPath = path.join(rootPath, '1. Recursos');
    const currentYear = new Date().getFullYear();

    // ------------------------------------------------------------------------
    // 6.1 VERIFICAR COPASST
    // ------------------------------------------------------------------------
    const copasstPath = path.join(actasPath, '1.1.6 Conformación de Copasst');
    
    if (fs.existsSync(copasstPath)) {
      // 6.1.1 Verificar período vigente (elección cada 2 años)
      const constitucionPath = path.join(copasstPath, 'Constitución');
      const periodoCOPASST = verifyCommitteePeriod(constitucionPath, 'COPASST');
      
      console.log(`[DASHBOARD] 🔍 [COPASST] Período verificado:`, periodoCOPASST);
      
      if (!periodoCOPASST.yearUltima) {
        // No se encontró acta de elección/constitución
        dashboard_data.tasks.push({
          title: "COPASST: Sin Acta de Elección/Constitución",
          desc: "No se encontró acta de elección o constitución de COPASST. Requisito normativo obligatorio.",
          priority: "critical",
          module: "copasst",
          icon: "fas fa-users",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;
        
        console.log(`[DASHBOARD] 📋 [COPASST] Alerta crítica: Sin acta de elección`);
      } else if (!periodoCOPASST.vigente) {
        // Período vencido (más de 2 años)
        dashboard_data.tasks.push({
          title: `COPASST: Período vencido (${periodoCOPASST.yearUltima}-${periodoCOPASST.yearUltima + 2})`,
          desc: `Última elección: ${periodoCOPASST.yearUltima}. Período máximo: 2 años. Próxima elección requerida: Antes de diciembre ${periodoCOPASST.yearUltima + 2}`,
          priority: "critical",
          module: "copasst",
          icon: "fas fa-users",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;
        
        console.log(`[DASHBOARD] 📋 [COPASST] Alerta crítica: Período vencido`);
      } else if (periodoCOPASST.porVencer) {
        // Período por vencer (alerta temprana)
        dashboard_data.tasks.push({
          title: `COPASST: Período por vencer (${periodoCOPASST.yearUltima}-${periodoCOPASST.yearUltima + 2})`,
          desc: `Última elección: ${periodoCOPASST.yearUltima}. Renovación requerida antes de diciembre ${periodoCOPASST.yearUltima + 2}`,
          priority: "warning",
          module: "copasst",
          icon: "fas fa-users",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COPASST] Alerta warning: Período por vencer`);
      } else {
        // Período vigente - Agregar alerta informativa
        dashboard_data.tasks.push({
          title: `COPASST: Constitución al día (Período ${periodoCOPASST.yearUltima}-${periodoCOPASST.yearUltima + 2})`,
          desc: `Última elección: ${periodoCOPASST.yearUltima}. Próxima renovación: Diciembre ${periodoCOPASST.yearUltima + 2}.`,
          priority: "info",
          module: "copasst",
          icon: "fas fa-check-circle",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.kpis.recursos_alerts += 1;
        console.log(`[DASHBOARD] ✅ [COPASST] Período vigente (${periodoCOPASST.yearUltima}-${periodoCOPASST.yearUltima + 2})`);
      }
      
      // 6.1.2 Verificar reuniones mensuales (SIEMPRE, independientemente del período)
      const reunionesCOPASST = verifyCOPASSTMeetings(copasstPath, currentYear);
      console.log(`[DASHBOARD] 🔍 [COPASST] Reuniones verificadas:`, reunionesCOPASST);

      if (!reunionesCOPASST.cumple && reunionesCOPASST.mesesFaltantes.length > 0) {
        const mesesFaltantesStr = reunionesCOPASST.mesesFaltantes.join(', ');
        dashboard_data.tasks.push({
          title: `COPASST: Sin reunión desde ${reunionesCOPASST.ultimoMes || 'Enero'} ${currentYear}`,
          desc: `Última acta registrada: ${reunionesCOPASST.ultimoMes || 'Ninguna'} ${currentYear}. Mes actual: ${numberToMonth(currentMonth)} ${currentYear}. Requisito: Reuniones mensuales. Meses sin acta: ${mesesFaltantesStr}`,
          priority: "critical",
          module: "copasst",
          icon: "fas fa-calendar-times",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COPASST] Alerta crítica: Sin reunión mensual`);
      } else if (!reunionesCOPASST.cumple && reunionesCOPASST.ultimoMesNumero === 0) {
        // No hay ninguna acta registrada en el año
        dashboard_data.tasks.push({
          title: `COPASST: Sin reuniones registradas en ${currentYear}`,
          desc: `No se encontró ninguna acta de reunión registrada en ${currentYear}. Requisito: Reuniones mensuales.`,
          priority: "critical",
          module: "copasst",
          icon: "fas fa-calendar-times",
          submodule: "1.1.6 Conformación de Copasst"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COPASST] Alerta crítica: Sin reuniones en el año`);
      } else {
        console.log(`[DASHBOARD] ✅ [COPASST] Reuniones al día: ${reunionesCOPASST.message}`);
      }
    } else {
      console.log(`[DASHBOARD] ⚠️ [COPASST] Carpeta NO existe: ${copasstPath}`);
    }

    // ------------------------------------------------------------------------
    // 6.2 VERIFICAR COMITÉ DE CONVIVENCIA
    // ------------------------------------------------------------------------
    // NOTA: Se verifican ambas variaciones del nombre para mayor resiliencia
    const convivenciaPath1 = path.join(actasPath, '1.1.8 Comité de Convivencia');
    const convivenciaPath2 = path.join(actasPath, '1.1.8 Conformación de Comite de Convivencia');
    const convivenciaPath = fs.existsSync(convivenciaPath1) ? convivenciaPath1 : convivenciaPath2;
    console.log(`[DASHBOARD] 🔍 [COMITÉ CONVIVENCIA] Verificando ruta: ${convivenciaPath}`);

    if (fs.existsSync(convivenciaPath)) {
      console.log(`[DASHBOARD] ✅ [COMITÉ CONVIVENCIA] Carpeta encontrada`);
      
      // 6.2.1 Verificar período vigente (elección cada 2 años)
      const constitucionPath = path.join(convivenciaPath, 'Constitución');
      const periodoConvivencia = verifyCommitteePeriod(constitucionPath, 'COMITÉ CONVIVENCIA');
      
      console.log(`[DASHBOARD] 🔍 [COMITÉ CONVIVENCIA] Período verificado:`, periodoConvivencia);
      
      if (!periodoConvivencia.yearUltima) {
        // No se encontró acta de elección/constitución
        dashboard_data.tasks.push({
          title: "Comité: Sin Acta de Elección/Constitución",
          desc: "No se encontró acta de elección o constitución del Comité. Requisito normativo obligatorio.",
          priority: "critical",
          module: "comite_convivencia",
          icon: "fas fa-handshake",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;
        
        console.log(`[DASHBOARD] 📋 [COMITÉ CONVIVENCIA] Alerta crítica: Sin acta de elección`);
      } else if (!periodoConvivencia.vigente) {
        // Período vencido (más de 2 años)
        dashboard_data.tasks.push({
          title: `Comité: Período vencido (${periodoConvivencia.yearUltima}-${periodoConvivencia.yearUltima + 2})`,
          desc: `Última elección: ${periodoConvivencia.yearUltima}. Período máximo: 2 años. Próxima elección requerida: Antes de diciembre ${periodoConvivencia.yearUltima + 2}`,
          priority: "critical",
          module: "comite_convivencia",
          icon: "fas fa-handshake",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;
        
        console.log(`[DASHBOARD] 📋 [COMITÉ CONVIVENCIA] Alerta crítica: Período vencido`);
      } else if (periodoConvivencia.porVencer) {
        // Período por vencer (alerta temprana)
        dashboard_data.tasks.push({
          title: `Comité: Período por vencer (${periodoConvivencia.yearUltima}-${periodoConvivencia.yearUltima + 2})`,
          desc: `Última elección: ${periodoConvivencia.yearUltima}. Renovación requerida antes de diciembre ${periodoConvivencia.yearUltima + 2}`,
          priority: "warning",
          module: "comite_convivencia",
          icon: "fas fa-handshake",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COMITÉ CONVIVENCIA] Alerta warning: Período por vencer`);
      } else {
        // Constitución vigente - Agregar alerta informativa
        dashboard_data.tasks.push({
          title: `Comité: Constitución al día (Período ${periodoConvivencia.yearUltima}-${periodoConvivencia.yearUltima + 2})`,
          desc: `Última elección: ${periodoConvivencia.yearUltima}. Próxima renovación: Diciembre ${periodoConvivencia.yearUltima + 2}.`,
          priority: "info",
          module: "comite_convivencia",
          icon: "fas fa-check-circle",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.kpis.recursos_alerts += 1;
        console.log(`[DASHBOARD] ✅ [COMITÉ CONVIVENCIA] Período vigente (${periodoConvivencia.yearUltima}-${periodoConvivencia.yearUltima + 2})`);
      }

      // 6.2.2 Verificar reuniones mensuales (SIEMPRE, independientemente del período)
      const reunionesConvivencia = verifyConvivenciaMeetings(convivenciaPath, currentYear);
      console.log(`[DASHBOARD] 🔍 [COMITÉ CONVIVENCIA] Reuniones verificadas:`, reunionesConvivencia);

      if (!reunionesConvivencia.cumple && reunionesConvivencia.mesesFaltantes.length > 0) {
        const mesesFaltantesStr = reunionesConvivencia.mesesFaltantes.join(', ');
        dashboard_data.tasks.push({
          title: `Comité: Sin reunión desde ${reunionesConvivencia.ultimoMes || 'Ninguna'} ${reunionesConvivencia.ultimoMesYear || currentYear}`,
          desc: `Última acta registrada: ${reunionesConvivencia.ultimoMes || 'Ninguna'} ${reunionesConvivencia.ultimoMesYear || currentYear - 1}. Mes actual: ${numberToMonth(currentMonth)} ${currentYear}. Requisito: Reuniones mensuales. Meses sin acta: ${mesesFaltantesStr}`,
          priority: "critical",
          module: "comite_convivencia",
          icon: "fas fa-calendar-times",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COMITÉ CONVIVENCIA] Alerta crítica: Sin reunión mensual`);
      } else if (!reunionesConvivencia.cumple && reunionesConvivencia.ultimoMesNumero === 0) {
        // No hay ninguna acta registrada en el año
        dashboard_data.tasks.push({
          title: `Comité: Sin reuniones registradas en ${currentYear}`,
          desc: `No se encontró ninguna acta de reunión registrada en ${currentYear}. Requisito: Reuniones mensuales.`,
          priority: "critical",
          module: "comite_convivencia",
          icon: "fas fa-calendar-times",
          submodule: "1.1.8 Conformación de Comite de Convivencia"
        });
        dashboard_data.module_status.recursos = "danger";
        dashboard_data.kpis.recursos_alerts += 1;

        console.log(`[DASHBOARD] 📋 [COMITÉ CONVIVENCIA] Alerta crítica: Sin reuniones en el año`);
      } else {
        console.log(`[DASHBOARD] ✅ [COMITÉ CONVIVENCIA] Reuniones al día: ${reunionesConvivencia.message}`);
      }
    } else {
      console.log(`[DASHBOARD] ⚠️ [COMITÉ CONVIVENCIA] Carpeta NO existe: ${convivenciaPath}`);
    }

  } catch (error) {
    console.error(`[DASHBOARD ALERTAS] Error calculando alertas: ${error.message}`);
    sendLog(`[DASHBOARD ALERTAS] Error: ${error.message}`, 'ERROR');
  }

  // ========================================================================
  // ORDENAR TAREAS POR PRIORIDAD
  // ========================================================================
  const priority_map = { 'critical': 0, 'warning': 1, 'info': 2 };
  dashboard_data.tasks.sort((a, b) => (priority_map[a.priority] || 3) - (priority_map[b.priority] || 3));

  // ========================================================================
  // ACTUALIZAR ESTADO GENERAL
  // ========================================================================
  const critical_count = dashboard_data.tasks.filter(t => t.priority === 'critical').length;
  if (critical_count > 0) {
    dashboard_data.overall_status = 'critical';
  } else if (dashboard_data.tasks.length > 0) {
    dashboard_data.overall_status = 'warning';
  } else {
    dashboard_data.overall_status = 'ok';
  }

  // LOG FINAL: Resumen de KPIs de Recursos
  sendLog(`[DASHBOARD] ✅ KPIs Recursos: capacitaciones_alertas=${dashboard_data.kpis.capacitaciones_alertas}, recursos_alerts=${dashboard_data.kpis.recursos_alerts}`, 'INFO');

  // LOG DE DEPURACIÓN: Resumen completo de alertas
  console.log(`[DASHBOARD] 📊 ========= RESUMEN DE ALERTAS GENERADAS =========`);
  console.log(`[DASHBOARD] 📊 Empresa: ${companyName}`);
  console.log(`[DASHBOARD] 📊 Total alertas: ${dashboard_data.tasks.length}`);
  console.log(`[DASHBOARD] 📊 Recursos alerts: ${dashboard_data.kpis.recursos_alerts}`);
  console.log(`[DASHBOARD] 📊 Gestión salud alerts: ${dashboard_data.kpis.gestion_salud_alerts}`);
  console.log(`[DASHBOARD] 📊 Estado general: ${dashboard_data.overall_status}`);
  
  if (dashboard_data.tasks.length > 0) {
    console.log(`[DASHBOARD] 📊 --- DETALLE DE TAREAS ---`);
    dashboard_data.tasks.forEach((task, index) => {
      console.log(`[DASHBOARD] 📊 [${index + 1}] ${task.priority.toUpperCase()}: ${task.title}`);
      console.log(`[DASHBOARD] 📊     Módulo: ${task.module} | Submódulo: ${task.submodule}`);
      console.log(`[DASHBOARD] 📊     Descripción: ${task.desc}`);
    });
  } else {
    console.log(`[DASHBOARD] 📊 ✅ SIN ALERTAS - Todo en orden`);
  }
  console.log(`[DASHBOARD] 📊 ================================================`);

  return dashboard_data;
}

/**
 * Obtiene detalles de capacitaciones para calcular vencidas y próximas
 */
async function obtenerCapacitacionesDetalladas(basePath) {
  const capacitaciones = [];
  const today = new Date();

  try {
    if (!basePath) return capacitaciones;

    const recursosPath = path.join(basePath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.2.1 Programa de capacitación Anual');

    if (!fs.existsSync(targetPath)) {
      if (fs.existsSync(recursosPath)) {
        const subs = await fsp.readdir(recursosPath);
        let capFolder = subs.find(s => s.startsWith('1.2.1') && s.toLowerCase().includes('capacita'));
        if (!capFolder) {
          capFolder = subs.find(s => (s.includes('1.2') || s.toLowerCase().includes('capacita')) && !s.startsWith('.'));
        }
        if (capFolder) targetPath = path.join(recursosPath, capFolder);
      }
    }

    if (!fs.existsSync(targetPath)) return capacitaciones;

    const files = await fsp.readdir(targetPath);
    const excelFile = files.find(f =>
      (f.toLowerCase().includes('act-fo-005') || f.toLowerCase().includes('cronograma')) &&
      !f.startsWith('~$') &&
      (f.endsWith('.xlsx') || f.endsWith('.xls'))
    );

    if (!excelFile) return capacitaciones;

    const workbook = xlsx.readFile(path.join(targetPath, excelFile));
    let sheetName = workbook.SheetNames.find(s =>
      s.toLowerCase().includes('matriz cap') && s.includes(new Date().getFullYear().toString())
    );
    if (!sheetName) {
      sheetName = workbook.SheetNames.find(s => s.includes(new Date().getFullYear().toString()));
    }
    if (!sheetName) sheetName = workbook.SheetNames[0];

    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Empezar en fila 6 (índice 5)
    for (let i = 5; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row) || row.length < 2) continue;

      const nombre = row[1];
      if (!nombre || typeof nombre !== 'string' || nombre.includes('Nombre de la capacitación')) continue;
      if (nombre.toLowerCase().trim() === 'total') break;

      // Obtener fecha
      let fecha = null;
      const fechaVal = row[3];
      if (fechaVal) {
        // Usar la misma fórmula de conversión que el renderer para evitar errores de timezone
        if (typeof fechaVal === 'number' && fechaVal >= 1) {
          const utcDate = new Date((fechaVal - 25569) * 86400 * 1000);
          fecha = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
        } else if (fechaVal instanceof Date) {
          fecha = fechaVal;
        } else if (typeof fechaVal === 'string') {
          const parsed = new Date(fechaVal);
          if (!isNaN(parsed.getTime())) fecha = parsed;
        }
      }

      // Obtener estado
      const estadoVal = row[8];
      let realizada = false;
      if (estadoVal && typeof estadoVal === 'string') {
        const estadoStr = estadoVal.toLowerCase();
        realizada = estadoStr.includes('ejecutado') || estadoStr.includes('realizado') || estadoStr.includes('completado');
      }

      // Obtener tema
      const tema = row[1] || '';

      // Log de depuración para verificar conversión de fechas
      if (fechaVal && typeof fechaVal === 'number') {
        sendLog(`[DASHBOARD] 🔍 Fecha raw (Excel): ${fechaVal}, Fecha convertida: ${fecha ? fecha.toISOString().split('T')[0] : 'null'}`, 'INFO');
      }

      // Calcular si está vencida o próxima
      // IMPORTANTE: Solo marcar como vencida si TIENE fecha y está en el pasado y no se realizó
      let vencida = false;
      let proxima_7 = false;
      let proxima_15 = false;

      if (fecha) {
        const diffTime = fecha - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        vencida = fecha < today && !realizada;
        proxima_7 = diffDays >= 0 && diffDays <= 7 && !realizada;
        proxima_15 = diffDays > 7 && diffDays <= 15 && !realizada;

        // Log para depuración de capacitaciones vencidas
        if (vencida) {
          sendLog(`[DASHBOARD] ⚠️ Capacitación VENCIDA detectada: "${tema}" - Fecha programada: ${fecha.toISOString().split('T')[0]} - Días de retraso: ${Math.abs(diffDays)}`, 'WARN');
        }
      } else {
        // Si no hay fecha, no se puede determinar si está vencida
        sendLog(`[DASHBOARD] ℹ️ Capacitación sin fecha: "${tema}" - No se puede determinar estado`, 'INFO');
      }

      capacitaciones.push({
        tema: tema,
        fecha: fecha,
        realizada: realizada,
        vencida: vencida,
        proxima_7: proxima_7,
        proxima_15: proxima_15
      });
    }
  } catch (e) {
    console.error(`[DASHBOARD] Error obteniendo capacitaciones: ${e.message}`);
  }

  // LOG DE AUDITORÍA: Conteo final para debugging
  const realizadas = capacitaciones.filter(c => c.realizada).length;
  const pendientes = capacitaciones.filter(c => !c.realizada).length;
  const vencidas = capacitaciones.filter(c => c.vencida).length;
  sendLog(`[DASHBOARD] 📊 Capacitaciones procesadas: ${capacitaciones.length} total (${realizadas} realizadas, ${pendientes} pendientes, ${vencidas} vencidas)`, 'INFO');

  return capacitaciones;
}

// ===============================
// 📊 DASHBOARD SCANNER HANDLER
// ===============================
ipcMain.handle('get-dashboard-summary', async (event, companyName) => {
  console.log(`[DASHBOARD] Escaneando datos para: ${companyName}`);

  try {
    // 1. Cargar configuración para obtener la ruta de la empresa
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    if (!config.companyPaths || !config.companyPaths[companyName]) {
      throw new Error(`No se encontró configuración para la empresa: ${companyName}`);
    }

    const companyPath = config.companyPaths[companyName].root;
    console.log(`[DASHBOARD] Ruta de empresa: ${companyPath}`);

    if (!companyPath) {
      throw new Error('Ruta de empresa no encontrada en configuración');
    }

    // 2. Verificar que la ruta existe
    await fsp.access(companyPath);

    // 3. USAR FUNCIÓN JAVASCRIPT EN LUGAR DE PYTHON
    console.log(`[DASHBOARD] Calculando alertas con funciones JavaScript...`);
    const result = await getDashboardAlertas(companyPath, companyName);

    console.log(`[DASHBOARD] Escaneo completado exitosamente`);
    console.log(`[DASHBOARD] KPIs:`, result.kpis);
    console.log(`[DASHBOARD] Recursos Alerts:`, result.kpis?.recursos_alerts);
    console.log(`[DASHBOARD] Tareas:`, result.tasks.length);

    return { success: true, data: result };

  } catch (error) {
    console.error(`[DASHBOARD] Error crítico: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Helper para ejecutar Python y devolver JSON
async function runPythonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    // Obtener ruta de Python dinámicamente
    getPython().then(pythonPath => {
      console.log(`[DASHBOARD] Usando Python: ${pythonPath}`);
      console.log(`[DASHBOARD] Script: ${scriptPath}`);
      console.log(`[DASHBOARD] Args: ${JSON.stringify(args)}`);
      
      // Verificar que el script existe
      if (!fs.existsSync(scriptPath)) {
        console.error(`[DASHBOARD] El script no existe: ${scriptPath}`);
        resolve({ error: `Script no encontrado: ${scriptPath}` });
        return;
      }
      
      const pythonProcess = spawn(pythonPath, [scriptPath, ...args], {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`[PYTHON STDOUT] ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`[PYTHON STDERR] ${data}`);
      });

      pythonProcess.on('close', (code) => {
        console.log(`[PYTHON] Exit code: ${code}`);
        if (code !== 0) {
          console.error(`[PYTHON] Exit code: ${code}`);
          resolve({ error: stderrData || `Python exit code: ${code}` });
        } else {
          try {
            const jsonData = JSON.parse(stdoutData);
            resolve(jsonData);
          } catch (e) {
            console.error('[PYTHON] Error parseando JSON:', e);
            console.error('[PYTHON] stdout:', stdoutData);
            resolve({ error: 'JSON Parse Error: ' + e.message });
          }
        }
      });
    }).catch(err => {
      console.error('[DASHBOARD] Error obteniendo Python:', err);
      resolve({ error: `No se pudo encontrar Python: ${err.message}` });
    });
  });
}


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

    // Validar Python disponible
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      const errorMsg = 'Python no está instalado en este equipo. Para usar esta función, instale Python 3.10-3.12 desde python.org y agréguelo al PATH.';
      console.error(`[MAPEO][MAIN][ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg, log: errorMsg };
    }

    const pythonScriptPath = getPythonScriptPath('map_directory.py');

    // Validar que el script existe
    if (!fs.existsSync(pythonScriptPath)) {
      const errorMsg = `Script de Python no encontrado: ${pythonScriptPath}`;
      console.error(`[MAPEO][MAIN][ERROR] ${errorMsg}`);
      return { success: false, error: errorMsg, log: errorMsg };
    }

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

    // --- LÓGICA MEJORADA: BUSCAR LA HOJA CORRECTA ---
    let worksheet = null;
    let targetSheetName = "";

    // 1. Prioridad: Hojas con nombres específicos que incluyan el año
    const priorityNames = ['PLAN DE TRABAJO', 'CRONOGRAMA', 'MATRIZ', 'ACTIVIDADES', 'PLAN ANUAL', 'PROGRAMA'];
    for (const sheetName of workbook.SheetNames) {
        const normalizedName = sheetName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (priorityNames.some(p => normalizedName.includes(p))) {
            if (normalizedName.includes(period.toString())) {
                targetSheetName = sheetName;
                break;
            }
            if (!targetSheetName) targetSheetName = sheetName;
        }
    }

    // 2. Si no hay por nombre, buscamos la hoja que tenga más meses en las cabeceras
    if (!targetSheetName) {
        let maxMatches = 0;
        for (const sheetName of workbook.SheetNames) {
            const ws = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: "" });
            let currentMatches = 0;
            for (let i = 0; i < Math.min(15, data.length); i++) {
                const row = data[i];
                if (!Array.isArray(row)) continue;
                const rowStr = row.join(' ').toLowerCase();
                if (['ene', 'feb', 'mar', 'abr', 'may', 'jun'].every(m => rowStr.includes(m))) {
                    currentMatches = 10;
                    break;
                }
            }
            if (currentMatches > maxMatches) {
                maxMatches = currentMatches;
                targetSheetName = sheetName;
            }
        }
    }

    // Fallback final: Primera hoja
    if (!targetSheetName) targetSheetName = workbook.SheetNames[0];

    worksheet = workbook.Sheets[targetSheetName];
    sendLog(`[MAIN] Hoja seleccionada para procesamiento: "${targetSheetName}"`, 'INFO');

    // Leer como matriz de arrays
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    sendLog(`[MAIN] Datos crudos extraídos de "${targetSheetName}": ${rawData.length} filas`, 'INFO');

    // --- DEBUG: IMPRIMIR LAS PRIMERAS 15 FILAS PARA VER LA ESTRUCTURA ---
    sendLog(`[MAIN][DEBUG] --- INICIO ESTRUCTURA DEL ARCHIVO (Primeras 15 filas) ---`, 'DEBUG');
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
        sendLog(`[MAIN][DEBUG] Fila ${i}: ${JSON.stringify(rawData[i])}`, 'DEBUG');
    }
    sendLog(`[MAIN][DEBUG] --- FIN ESTRUCTURA DEL ARCHIVO ---`, 'DEBUG');

    // --- 1. BUSCAR LA FILA DE ENCABEZADOS (Formato GI-FO-045) ---
    // Encabezados esperados: N°, ACTIVIDADES, RESPONSABLE, ENE, FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT, NOV, DIC, % AVANCE, ESTADO, OBSERVACIONES
    let headerRowIndex = -1;
    let columnMap = {};

    const normalize = (str) => {
        if (!str) return "";
        return str.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    // Buscar en las primeras 15 filas la fila de encabezados
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        // Contar coincidencias de meses (al menos 6 para confirmar)
        let monthCount = 0;
        let hasActividades = false;
        let hasResponsable = false;

        row.forEach(cell => {
            const val = normalize(cell);
            if (['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'set', 'oct', 'nov', 'dic'].includes(val)) {
                monthCount++;
            }
            if (val.includes('actividad') || val.includes('actividades')) {
                hasActividades = true;
            }
            if (val.includes('responsable')) {
                hasResponsable = true;
            }
        });

        // Criterio: al menos 6 meses Y (actividades O responsable)
        if (monthCount >= 6 && (hasActividades || hasResponsable)) {
            headerRowIndex = i;
            sendLog(`[MAIN] Encabezados encontrados en la fila ${i + 1} (índice 0-based)`, 'INFO');

            // Mapear índices de columnas
            row.forEach((cell, colIndex) => {
                const val = normalize(cell);
                
                // Columna N° (índice de actividad)
                if (val === 'n°' || val === 'n' || val === '#' || val === 'numero' || val === 'número') {
                    columnMap['numero'] = colIndex;
                }
                // Columna ACTIVIDADES
                else if (val.includes('actividad') || val.includes('actividades')) {
                    columnMap['actividad'] = colIndex;
                }
                // Columna RESPONSABLE
                else if (val.includes('responsable')) {
                    columnMap['responsable'] = colIndex;
                }
                // Meses
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
                // Columnas adicionales
                else if (val.includes('observacion') || val.includes('seguimiento')) columnMap['observaciones'] = colIndex;
                else if (val.includes('avance') || val.includes('%')) columnMap['avance'] = colIndex;
                else if (val.includes('estado')) columnMap['estado'] = colIndex;
            });
            break;
        }
    }

    // Fallback si no se encontraron encabezados
    if (headerRowIndex === -1) {
        sendLog(`[MAIN][WARN] No se encontró fila de encabezados clara. Usando fallback estándar (formato GI-FO-045).`, 'WARN');
        headerRowIndex = 7; // Fila 8 en índice 0-based (formato típico)
        columnMap = {
            'numero': 0,
            'actividad': 1,
            'responsable': 2,
            'enero': 3, 'febrero': 4, 'marzo': 5, 'abril': 6,
            'mayo': 7, 'junio': 8, 'julio': 9, 'agosto': 10,
            'septiembre': 11, 'octubre': 12, 'noviembre': 13, 'diciembre': 14,
            'avance': 15,
            'estado': 16,
            'observaciones': 17
        };
    }

    sendLog(`[MAIN] Mapeo de columnas: ${JSON.stringify(columnMap)}`, 'INFO');

    // --- 2. PROCESAR FILAS DE DATOS ---
    const processedData = {};
    
    // Palabras clave para identificar niveles según estructura GI-FO-045
    // Nivel 1: Títulos mayores (ej: "MEDICINA PREVENTIVA Y DEL TRABAJO")
    const nivel1Keywords = [
        'MEDICINA PREVENTIVA', 'SEGURIDAD INDUSTRIAL', 'HIGIENE INDUSTRIAL', 
        'SALUD PÚBLICA', 'BIENESTAR', 'VERIFICACION', 'VERIFICACIÓN',
        'GESTIÓN DEL PLAN', 'SST', 'SG-SST', 'INTEGRAL'
    ];
    
    // Nivel 2: Títulos menores (ej: "SVE - Desorden Musculo Esquelético")
    const nivel2Keywords = [
        'SVE', 'DESORDEN', 'MUSCULO', 'ESQUELÉTICO', 'ERGONOMÍA',
        'ENFERMEDAD', 'SALUD MENTAL', 'ESTRÉS', 'RIESGO', 'BIOMECÁNICO',
        'OSTEOMUSCULAR', 'DISCAPACIDAD', 'REHABILITACIÓN'
    ];
    
    // Nivel 3: Títulos hijos / Fases PHVA (ej: "Planear", "Hacer")
    const nivel3Keywords = ['PLANEAR', 'HACER', 'VERIFICAR', 'ACTUAR', 'PHVA'];

    for (let year = 2024; year <= 2026; year++) {
      processedData[year] = [];
      
      if (year == period) {
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            
            // Obtener nombre de la actividad (columna B, índice 1)
            const actividad = String(row[columnMap['actividad']] || '').trim();
            
            // Saltar filas vacías o de totales
            if (!actividad || actividad.length < 2) continue;
            if (actividad.toLowerCase().includes('total') || 
                actividad.toLowerCase().includes('velocímetro') ||
                actividad.toLowerCase().includes('velocimetro')) continue;

            // Determinar nivel jerárquico según estructura GI-FO-045
            let level = 4;
            let type = 'activity';
            const normalizedAct = actividad.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            
            // Obtener valor de columna A (índice de nivel: T1, T2, T3 o número)
            const colA = String(row[columnMap['numero'] || 0] || '').trim();
            const normalizedColA = colA.toUpperCase().trim();
            
            // PRIORIDAD 1: Si ColA es un número, es actividad (Nivel 4)
            // Esto previene que actividades con keywords en el nombre se clasifiquen mal
            if (colA !== '' && colA !== 'undefined' && !isNaN(parseFloat(colA.replace(',', '.')))) {
                level = 4;
                type = 'activity';
            }
            // PRIORIDAD 2: Verificar marcadores T1, T2, T3
            else if (normalizedColA === 'T1') {
                level = 1;
                type = 'header';
            }
            else if (normalizedColA === 'T2') {
                level = 2;
                type = 'header';
            }
            else if (normalizedColA === 'T3') {
                level = 3;
                type = 'subtitle';
            }
            // PRIORIDAD 3: Fallback a keywords solo si no hay marcador ni número
            else if (nivel1Keywords.some(k => normalizedAct.includes(k))) {
                level = 1;
                type = 'header';
            }
            else if (nivel2Keywords.some(k => normalizedAct.includes(k))) {
                level = 2;
                type = 'header';
            }
            else if (nivel3Keywords.some(k => normalizedAct === k || normalizedAct.startsWith(k))) {
                level = 3;
                type = 'subtitle';
            }
            // Fallback por defecto
            else {
                level = 2;
                type = 'header';
            }

            // DEBUG: Log para verificar detección de niveles
            sendLog(`[DEBUG] Fila ${i}: Actividad="${actividad.substring(0, 50)}...", ColA="${colA}", Nivel Detectado=${level}, Tipo=${type}`, 'DEBUG');

            // Extraer meses (C = ejecutado, P = programado)
            const months = [
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
            ];

            processedData[year].push({
              id: i + 1,
              name: actividad,
              level: level,
              type: type,
              expanded: true,
              responsible: row[columnMap['responsable']] || 'Profesional SST',
              months: months,
              observations: row[columnMap['observaciones']] || '',
              avance: row[columnMap['avance']] || '',
              estado: row[columnMap['estado']] || ''
            });
        }
      }
    }

    sendLog(`[MAIN] Datos procesados exitosamente de la hoja "${targetSheetName}". Total actividades: ${processedData[period]?.length || 0}`, 'INFO');
    return { success: true, data: processedData };
  } catch (error) {
    sendLog(`[MAIN] Error al procesar datos del Excel: ${error.message}`, 'ERROR');
    return { success: false, error: error.message, data: null };
  }
});

// Handler para actualizar estados P/C en el Plan de Trabajo
// Usa ExcelJS para preservar la estructura y formato original del archivo
// Similar a update-capacitaciones-excel pero solo actualiza columnas específicas
ipcMain.handle('update-plan-trabajo-excel', async (event, { filePath, periodsData, period }) => {
  try {
    sendLog(`[UPDATE-PLAN][MAIN] === INICIO ACTUALIZACIÓN PLAN DE TRABAJO ===`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] Archivo: ${filePath}`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] Período: ${period}`, 'INFO');
    sendLog(`[UPDATE-PLAN][DEBUG] periodsData keys: ${Object.keys(periodsData).join(', ')}`, 'DEBUG');

    const data = periodsData[period];
    sendLog(`[UPDATE-PLAN][DEBUG] data para período ${period}: ${data ? data.length : 'undefined'} actividades`, 'DEBUG');

    if (!data || !Array.isArray(data)) {
      sendLog(`[UPDATE-PLAN][ERROR] No hay datos para el período ${period}`, 'ERROR');
      return { success: false, error: 'No hay datos para el período especificado' };
    }

    // Validar que el archivo existe
    try {
      await fsp.access(filePath);
    } catch (accessError) {
      sendLog(`[UPDATE-PLAN][ERROR] Archivo no encontrado: ${filePath}`, 'ERROR');
      return { success: false, error: 'Archivo no encontrado' };
    }

    // === USAR ExcelJS PARA PRESERVAR FORMATO ===
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // === BUSCAR HOJA CORRECTA CON VALIDACIÓN ROBUSTA ===
    let worksheet = null;
    let sheetName = null;

    // Prioridad 1: Buscar por nombre exacto "PLAN DE TRABAJO ANUAL" (sin año)
    worksheet = workbook.getWorksheet('PLAN DE TRABAJO ANUAL');
    if (worksheet) {
      sheetName = worksheet.name;
      sendLog(`[UPDATE-PLAN][INFO] Hoja encontrada por nombre exacto: ${sheetName}`, 'INFO');
    }

    // Prioridad 2: Buscar por nombre con año (formato alternativo)
    if (!worksheet) {
      worksheet = workbook.getWorksheet(`PLAN DE TRABAJO ANUAL ${period}`);
      if (worksheet) {
        sheetName = worksheet.name;
        sendLog(`[UPDATE-PLAN][INFO] Hoja encontrada por nombre con año: ${sheetName}`, 'INFO');
      }
    }

    // Prioridad 3: Buscar por patrón que contenga "PLAN DE TRABAJO"
    if (!worksheet) {
      const foundByPattern = workbook.worksheets.find(ws =>
        ws && ws.name && ws.name.toUpperCase().includes('PLAN DE TRABAJO')
      );
      if (foundByPattern) {
        worksheet = foundByPattern;
        sheetName = worksheet.name;
        sendLog(`[UPDATE-PLAN][WARN] Hoja encontrada por patrón: ${sheetName}`, 'WARN');
      }
    }

    // Prioridad 4: Buscar hojas alternativas comunes
    if (!worksheet) {
      const alternativeNames = ['CRONOGRAMA', 'ACTIVIDADES', 'PLAN ANUAL', 'PROGRAMA'];
      for (const altName of alternativeNames) {
        const found = workbook.getWorksheet(altName);
        if (found) {
          worksheet = found;
          sheetName = found.name;
          sendLog(`[UPDATE-PLAN][WARN] Hoja encontrada por nombre alternativo: ${sheetName}`, 'WARN');
          break;
        }
      }
    }

    // Prioridad 5: Usar primera hoja disponible como fallback
    if (!worksheet && workbook.worksheets.length > 0) {
      worksheet = workbook.worksheets[0];
      sheetName = worksheet.name;
      sendLog(`[UPDATE-PLAN][WARN] Usando primera hoja disponible: ${sheetName}`, 'WARN');
    }

    // === VALIDACIÓN CRÍTICA: worksheet debe existir ===
    if (!worksheet) {
      sendLog(`[UPDATE-PLAN][ERROR] No se encontró ninguna hoja válida en el archivo`, 'ERROR');
      sendLog(`[UPDATE-PLAN][DEBUG] Hojas disponibles en el archivo: ${workbook.worksheets.map(ws => ws.name).join(', ')}`, 'DEBUG');
      return {
        success: false,
        error: 'No se encontró la hoja del Plan de Trabajo. Verifique que el archivo tenga una hoja llamada "PLAN DE TRABAJO ANUAL" o similar.'
      };
    }

    sendLog(`[UPDATE-PLAN][MAIN] Hoja seleccionada: "${sheetName}"`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] Filas totales en la hoja: ${worksheet.rowCount}`, 'INFO');

    // === CONFIGURACIÓN DE ESCRITURA ===
    // Encabezados están en fila 8, actividades empiezan en fila 9
    // Columnas: A=N°, B=ACTIVIDAD, C=RESPONSABLE, D-O=ENE-DIC, P=% AVANCE, Q=ESTADO, R=OBSERVACIONES
    const START_ROW = 9; // Fila 9 es donde empiezan las actividades (índice 1-based)

    // Filtrar solo actividades de nivel 4 (actividades reales, no headers ni subtítulos)
    const actividades = data.filter(item =>
      item &&
      item.type === 'activity' &&
      item.level === 4 &&
      item.name // Validar que tenga nombre
    );
    sendLog(`[UPDATE-PLAN][DEBUG] Actividades de nivel 4 a actualizar: ${actividades.length}`, 'DEBUG');

    // Contador de actualizaciones exitosas
    let updatedCount = 0;
    let notFoundCount = 0;

    // === ACTUALIZAR FILA POR FILA ===
    actividades.forEach((actividad, index) => {
      // Validar que la actividad tenga la estructura esperada
      if (!actividad || !actividad.name || !Array.isArray(actividad.months)) {
        sendLog(`[UPDATE-PLAN][WARN] Actividad ${index} sin estructura válida, saltando`, 'WARN');
        return;
      }

      let targetRow = null;
      let foundRowIndex = -1;

      // Estrategia 1: Buscar por índice relativo (asumiendo que el orden se mantiene)
      const expectedRowIndex = START_ROW + index;
      if (expectedRowIndex <= worksheet.rowCount) {
        const row = worksheet.getRow(expectedRowIndex);
        const excelActividad = row.getCell(2).value; // Columna B = ACTIVIDAD

        // Verificar coincidencia parcial del nombre (primeros 20 caracteres)
        if (excelActividad) {
          const excelActStr = excelActividad.toString().substring(0, 30).toLowerCase();
          const actNameStr = actividad.name.toString().substring(0, 30).toLowerCase();

          if (excelActStr && actNameStr && (excelActStr.includes(actNameStr) || actNameStr.includes(excelActStr))) {
            targetRow = row;
            foundRowIndex = expectedRowIndex;
            sendLog(`[UPDATE-PLAN][DEBUG] Fila ${expectedRowIndex}: Coincidencia por índice`, 'DEBUG');
          }
        }
      }

      // Estrategia 2: Búsqueda lineal si no se encontró por índice
      if (!targetRow) {
        sendLog(`[UPDATE-PLAN][DEBUG] Buscando actividad "${actividad.name.substring(0, 40)}..." en toda la hoja`, 'DEBUG');

        for (let searchRow = START_ROW; searchRow <= worksheet.rowCount; searchRow++) {
          const searchRowObj = worksheet.getRow(searchRow);
          const searchActividad = searchRowObj.getCell(2).value;

          if (searchActividad) {
            const searchActStr = searchActividad.toString().toLowerCase();
            const actNameStr = actividad.name.toString().toLowerCase();

            // Búsqueda por coincidencia parcial (al menos 20 caracteres)
            if (searchActStr.length >= 20 && actNameStr.length >= 20) {
              if (searchActStr.includes(actNameStr.substring(0, 20)) ||
                  actNameStr.includes(searchActStr.substring(0, 20))) {
                targetRow = searchRowObj;
                foundRowIndex = searchRow;
                sendLog(`[UPDATE-PLAN][DEBUG] Actividad encontrada en fila ${searchRow}`, 'DEBUG');
                break;
              }
            }
          }
        }
      }

      // Si no se encontró la actividad, registrar y continuar
      if (!targetRow) {
        notFoundCount++;
        sendLog(`[UPDATE-PLAN][WARN] Actividad no encontrada: "${actividad.name.substring(0, 50)}..."`, 'WARN');
        return;
      }

      // === ACTUALIZAR SOLO COLUMNAS ESPECÍFICAS (D-O, P, Q) ===
      // Columnas D-O (ENE-DIC) con P/C - SOLO si hay valor
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

      meses.forEach((mes, idx) => {
        const colIndex = idx + 4; // Columna D = 4 (1-based)
        const valor = actividad.months && actividad.months[idx] ? actividad.months[idx] : null;

        // Solo escribir si hay valor (P o C)
        if (valor && (valor === 'P' || valor === 'C')) {
          targetRow.getCell(colIndex).value = valor;
        }
      });

      // ⚠️ NO actualizar columna P (% AVANCE) ni Q (ESTADO)
      // El archivo Excel original tiene fórmulas compartidas en estas columnas
      // que ExcelJS no puede preservar. Las fórmulas originales calcularán
      // automáticamente los valores basándose en las columnas D-O (meses).

      updatedCount++;
      const completadas = actividad.months ? actividad.months.filter(m => m === 'C').length : 0;
      const programadas = actividad.months ? actividad.months.filter(m => m === 'P').length : 0;
      sendLog(`[UPDATE-PLAN][DEBUG] Fila ${foundRowIndex}: Actualizado - ${completadas}C/${programadas}P (Fórmulas originales calculan % y Estado)`, 'DEBUG');
    });

    sendLog(`[UPDATE-PLAN][MAIN] === RESUMEN DE ACTUALIZACIÓN ===`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] Total actividades procesadas: ${actividades.length}`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] Actualizadas exitosamente: ${updatedCount}`, 'INFO');
    sendLog(`[UPDATE-PLAN][MAIN] No encontradas: ${notFoundCount}`, 'INFO');

    // === GUARDAR ARCHIVO CON ExcelJS (PRESERVA FORMATO) ===
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[UPDATE-PLAN][MAIN] ✅ Archivo guardado exitosamente en: ${filePath}`, 'INFO');

    return {
      success: true,
      message: 'Archivo guardado exitosamente',
      updatedCount: updatedCount,
      notFoundCount: notFoundCount
    };

  } catch (error) {
    sendLog(`[UPDATE-PLAN][ERROR] Error al actualizar Plan de Trabajo: ${error.message}`, 'ERROR');
    sendLog(`[UPDATE-PLAN][ERROR] Stack: ${error.stack}`, 'ERROR');
    return { success: false, error: error.message };
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
    sendLog(`[UPDATE-CAP][MAIN] === INICIO ESCRITURA DE CAPACITACIONES ===`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] Archivo: ${filePath}`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] Hoja solicitada: ${requestedSheetName || 'AUTO'}`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] Datos a escribir: ${capacitacionesData.length} capacitaciones`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] startRow: ${startRow}`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] clearBeforeSave: ${clearBeforeSave}`, 'INFO');

    // 📊 LOG QUIRÚRGICO: Mostrar CADA dato que se va a escribir
    sendLog(`[UPDATE-CAP][DEBUG] === DATOS DE ENTRADA (CAPACITACIONES) ===`, 'DEBUG');
    capacitacionesData.forEach((cap, idx) => {
      sendLog(`[UPDATE-CAP][DEBUG] [${idx}] nombre="${cap.nombre}", tipo="${cap.tipo}", fecha="${cap.fechaProgramada}", instructor="${cap.instructor}", duracion="${cap.duracion}", estado="${cap.estado}"`, 'DEBUG');
    });

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

    sendLog(`[UPDATE-CAP][MAIN] Hoja seleccionada: ${sheetName}`, 'INFO');
    sendLog(`[UPDATE-CAP][MAIN] Filas actuales en la hoja: ${worksheet.rowCount}`, 'INFO');

    // 📊 LOG QUIRÚRGICO: Mostrar estado ANTES de limpiar
    sendLog(`[UPDATE-CAP][DEBUG] === ESTADO ANTES DE LIMPIEZA ===`, 'DEBUG');
    for (let i = startRow; i <= Math.min(startRow + 10, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      sendLog(`[UPDATE-CAP][DEBUG] Fila ${i}: B="${row.getCell(2).value}", C="${row.getCell(3).value}", D="${row.getCell(4).value}"`, 'DEBUG');
    }

    // --- LÓGICA CLAVE PARA EVITAR DUPLICADOS ---
    // Si se solicita limpiar, borramos todas las filas desde startRow hasta el final
    if (clearBeforeSave) {
        const lastRowNumber = worksheet.rowCount;
        let deletedCount = 0;
        // Borra las filas en orden inverso para no afectar los índices
        for (let i = lastRowNumber; i >= startRow; i--) {
            const row = worksheet.getRow(i);
            const cellB = row.getCell(2).value;
            // No borrar la fila de "Total capacitaciones programadas" ni las filas después de ella
            if (cellB && typeof cellB === 'string' && cellB.includes('Total capacitaciones programadas')) {
                // Encontramos la fila de total, dejar de borrar desde aquí hacia abajo
                sendLog(`[UPDATE-CAP][DEBUG] Deteniendo limpieza en fila ${i} (encontrado 'Total capacitaciones programadas')`, 'DEBUG');
                break;
            }
            // Eliminar la fila si está dentro del rango de datos
            worksheet.spliceRows(i, 1);
            deletedCount++;
        }
        sendLog(`[UPDATE-CAP][MAIN] Limpiadas ${deletedCount} filas desde la fila ${startRow} hasta antes de 'Total capacitaciones programadas'.`, 'INFO');
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
            sendLog(`[UPDATE-CAP][MAIN] Limpiadas filas desde ${startRow} hasta ${endCleanRow} (sin borrar estructura)`, 'INFO');
        }
    }

    // 📊 LOG QUIRÚRGICO: Mostrar estado DESPUÉS de limpiar
    sendLog(`[UPDATE-CAP][DEBUG] === ESTADO DESPUÉS DE LIMPIEZA ===`, 'DEBUG');
    sendLog(`[UPDATE-CAP][DEBUG] Filas restantes: ${worksheet.rowCount}`, 'DEBUG');
    for (let i = startRow; i <= Math.min(startRow + 5, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i);
      sendLog(`[UPDATE-CAP][DEBUG] Fila ${i}: B="${row.getCell(2).value}", C="${row.getCell(3).value}", D="${row.getCell(4).value}"`, 'DEBUG');
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

    sendLog(`[UPDATE-CAP][DEBUG] Capacitaciones válidas después de filtrar: ${validCapacitaciones.length}`, 'DEBUG');

    // 📊 LOG QUIRÚRGICO: Mostrar DÓNDE se va a escribir cada dato
    sendLog(`[UPDATE-CAP][DEBUG] === ESCRITURA DE DATOS EN EXCEL ===`, 'DEBUG');
    
    // Escribir nuevos datos
    validCapacitaciones.forEach((capacitacion, index) => {
      const rowIndex = startRow + index;
      const row = worksheet.getRow(rowIndex);

      // Valores ANTES de escribir
      const oldB = row.getCell(2).value;
      const oldC = row.getCell(3).value;
      const oldD = row.getCell(4).value;

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

      // 📊 LOG QUIRÚRGICO: Confirmar escritura
      sendLog(`[UPDATE-CAP][DEBUG] [Fila ${rowIndex}] ESCRITO: B="${capacitacion.nombre}", C="${capacitacion.tipo.toUpperCase()}", D="${capacitacion.fechaProgramada}", G="${capacitacion.instructor}", H="${capacitacion.duracion}", I="${capacitacion.estado}"`, 'DEBUG');
    });

    sendLog(`[UPDATE-CAP][DEBUG] === RESUMEN DE ESCRITURA ===`, 'DEBUG');
    sendLog(`[UPDATE-CAP][DEBUG] Total capacitaciones escritas: ${validCapacitaciones.length}`, 'DEBUG');
    sendLog(`[UPDATE-CAP][DEBUG] Última fila ocupada: ${startRow + validCapacitaciones.length - 1}`, 'DEBUG');

    await workbook.xlsx.writeFile(filePath);
    sendLog(`[UPDATE-CAP][MAIN] Archivo de capacitaciones actualizado en hoja '${sheetName}' exitosamente.`, 'INFO');
    
    // 📊 VERIFICACIÓN POST-ESCRITURA
    sendLog(`[UPDATE-CAP][DEBUG] === VERIFICACIÓN POST-ESCRITURA ===`, 'DEBUG');
    const verifyWorkbook = new ExcelJS.Workbook();
    await verifyWorkbook.xlsx.readFile(filePath);
    const verifyWorksheet = verifyWorkbook.getWorksheet(sheetName);
    for (let i = startRow; i <= Math.min(startRow + 5, verifyWorksheet.rowCount); i++) {
      const row = verifyWorksheet.getRow(i);
      sendLog(`[UPDATE-CAP][DEBUG] [VERIFICACIÓN] Fila ${i}: B="${row.getCell(2).value}", C="${row.getCell(3).value}", D="${row.getCell(4).value}"`, 'DEBUG');
    }

    return { success: true };

  } catch (error) {
    sendLog(`[UPDATE-CAP][ERROR] Error al actualizar el archivo de capacitaciones: ${error.message}`, 'ERROR');
    sendLog(`[UPDATE-CAP][ERROR] Stack: ${error.stack}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

  // --- Handler para duplicar hoja de capacitaciones (Nuevo Periodo) ---
  ipcMain.handle('duplicate-capacitaciones-sheet', async (event, { filePath, currentSheetName, newYear }) => {
    console.log(`[MAIN] Duplicando hoja de capacitaciones. Archivo: ${filePath}, Origen: ${currentSheetName}, Nuevo Año: ${newYear}`);
    
    // Verificar extensión del archivo
    const fileExt = require('path').extname(filePath).toLowerCase();
    if (fileExt !== '.xlsx') {
        console.error(`[MAIN] Error: Formato de archivo no soportado. Solo se permiten archivos .xlsx. Archivo actual: ${filePath}`);
        return { 
            success: false, 
            error: `Formato de archivo no soportado. La función solo trabaja con archivos .xlsx. Archivo actual: ${filePath}. Por favor convierte el archivo a formato .xlsx`
        };
    }
    
    try {
      // Verificar que el archivo exista
      try {
        await fsp.access(filePath);
      } catch (error) {
        return { success: false, error: 'El archivo no existe' };
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Debug: Mostrar información del workbook
      console.log(`[MAIN] Workbook cargado. Total de hojas: ${workbook.worksheets.length}`);
      console.log(`[MAIN] Hojas: ${workbook.worksheets.map(ws => ws.name).join(', ')}`);

      // Búsqueda flexible de la hoja origen (case-insensitive y trim)
      let sourceSheet = workbook.getWorksheet(currentSheetName);

      // Si no encuentra exacta, buscar de forma flexible
      if (!sourceSheet) {
          const normalizedSearchName = currentSheetName.trim().toLowerCase();
          sourceSheet = workbook.worksheets.find(ws =>
              ws.name.trim().toLowerCase() === normalizedSearchName
          );
      }

      if (!sourceSheet) {
          // Listar hojas disponibles para debug
          const availableSheets = workbook.worksheets.map(ws => ws.name).join(', ');
          console.error(`[MAIN] Hoja no encontrada. Hojas disponibles: ${availableSheets}`);
          return { success: false, error: `No se encontró la hoja origen: ${currentSheetName}. Hojas disponibles: ${availableSheets}` };
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

  // ============================================================================
  // 📊 HANDLER DE AUDITORÍA QUIRÚRGICA - Para depurar contenido de Excel
  // ============================================================================
  ipcMain.handle('audit-excel-content', async (event, { filePath, sheetName: requestedSheetName }) => {
    try {
      sendLog(`[AUDIT][MAIN] === INICIO AUDITORÍA DE EXCEL ===`, 'INFO');
      sendLog(`[AUDIT][MAIN] Archivo: ${filePath}`, 'INFO');
      sendLog(`[AUDIT][MAIN] Hoja solicitada: ${requestedSheetName || 'AUTO'}`, 'INFO');

      await fsp.access(filePath);
      const workbook = xlsx.readFile(filePath);

      // 1. Listar todas las hojas disponibles
      sendLog(`[AUDIT][MAIN] Hojas disponibles en el archivo:`, 'INFO');
      workbook.SheetNames.forEach((name, idx) => {
        sendLog(`[AUDIT][MAIN]   [${idx}] ${name}`, 'INFO');
      });

      // 2. Determinar qué hoja usar
      let sheetName = requestedSheetName;
      if (!sheetName || !workbook.SheetNames.includes(sheetName)) {
        if(sheetName) sendLog(`[AUDIT][WARN] Hoja '${sheetName}' no encontrada, buscando alternativa...`, 'WARN');

        const currentYear = new Date().getFullYear().toString();
        const matrixPatternCurrent = new RegExp(`Matriz Cap\\.\\s*${currentYear}`, 'i');
        sheetName = workbook.SheetNames.find(name => matrixPatternCurrent.test(name));

        if (!sheetName) {
          for (let year = parseInt(currentYear); year >= 2017; year--) {
            const pattern = new RegExp(`Matriz Cap\\.\\s*${year}`, 'i');
            sheetName = workbook.SheetNames.find(name => pattern.test(name));
            if (sheetName) {
              sendLog(`[AUDIT][MAIN] Hoja encontrada por año: ${sheetName}`, 'INFO');
              break;
            }
          }
        }
        if (!sheetName) {
          sheetName = workbook.SheetNames[0];
          sendLog(`[AUDIT][WARN] Usando primera hoja: ${sheetName}`, 'WARN');
        }
      }

      sendLog(`[AUDIT][MAIN] Hoja seleccionada: ${sheetName}`, 'INFO');
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet || !worksheet['!ref']) {
        sendLog(`[AUDIT][ERROR] La hoja '${sheetName}' está vacía o no tiene rango válido`, 'ERROR');
        return { success: false, error: 'Hoja vacía' };
      }

      // 3. Mostrar rango de la hoja
      sendLog(`[AUDIT][MAIN] Rango de la hoja (!ref): ${worksheet['!ref']}`, 'INFO');

      // 4. Leer TODOS los datos como matriz
      const allData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '<<EMPTY>>' });
      sendLog(`[AUDIT][MAIN] Total de filas leídas: ${allData.length}`, 'INFO');

      // 5. Mostrar las primeras 20 filas COMPLETAS (auditoría quirúrgica)
      sendLog(`[AUDIT][MAIN] === CONTENIDO DE FILAS (Primeras 20 filas) ===`, 'INFO');
      for (let i = 0; i < Math.min(20, allData.length); i++) {
        const row = allData[i];
        const rowStr = row.map((cell, colIdx) => {
          const colLetter = String.fromCharCode(65 + colIdx); // A, B, C...
          return `${colLetter}${i+1}="${cell}"`;
        }).join(' | ');
        sendLog(`[AUDIT][MAIN] Fila ${i+1}: ${rowStr}`, 'INFO');
      }

      // 6. Mostrar análisis de encabezados (buscar fila con meses)
      sendLog(`[AUDIT][MAIN] === ANÁLISIS DE ENCABEZADOS ===`, 'INFO');
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      let headerRowIndex = -1;

      for (let i = 0; i < Math.min(15, allData.length); i++) {
        const row = allData[i];
        const rowText = row.join(' ').toLowerCase();
        const monthCount = months.filter(m => rowText.includes(m)).length;

        if (monthCount >= 6) {
          headerRowIndex = i;
          sendLog(`[AUDIT][MAIN] Fila de encabezados encontrada en índice ${i} (fila ${i+1})`, 'INFO');
          sendLog(`[AUDIT][MAIN] Encabezados detectados:`, 'INFO');

          row.forEach((cell, colIdx) => {
            const colLetter = String.fromCharCode(65 + colIdx);
            sendLog(`[AUDIT][MAIN]   Columna ${colLetter} (${colIdx}): "${cell}"`, 'INFO');
          });
          break;
        }
      }

      if (headerRowIndex === -1) {
        sendLog(`[AUDIT][WARN] No se encontró fila de encabezados con meses`, 'WARN');
      }

      // 7. Mostrar análisis de datos (filas después de encabezados)
      if (headerRowIndex !== -1) {
        sendLog(`[AUDIT][MAIN] === MUESTRA DE DATOS (Filas ${headerRowIndex+2} a ${headerRowIndex+6}) ===`, 'INFO');
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 6, allData.length); i++) {
          const row = allData[i];
          sendLog(`[AUDIT][MAIN] Fila ${i+1} (dato):`, 'INFO');
          sendLog(`[AUDIT][MAIN]   A${i+1} (Índice): "${row[0]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   B${i+1} (Nombre): "${row[1]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   C${i+1} (Tipo): "${row[2]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   D${i+1} (Fecha): "${row[3]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   G${i+1} (Instructor): "${row[6]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   H${i+1} (Duración): "${row[7]}"`, 'INFO');
          sendLog(`[AUDIT][MAIN]   I${i+1} (Estado): "${row[8]}"`, 'INFO');
        }
      }

      // 8. Mostrar totales y estructura
      sendLog(`[AUDIT][MAIN] === ESTRUCTURA DEL ARCHIVO ===`, 'INFO');
      sendLog(`[AUDIT][MAIN] Total filas: ${allData.length}`, 'INFO');
      sendLog(`[AUDIT][MAIN] Última fila con contenido: ${allData.filter(r => r.some(c => c !== '<<EMPTY>>')).length}`, 'INFO');

      // 9. Buscar filas especiales
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i];
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('total') || rowText.includes('programada')) {
          sendLog(`[AUDIT][MAIN] Fila especial encontrada en índice ${i} (fila ${i+1}): "${row[1] || row[0]}"`, 'INFO');
        }
      }

      sendLog(`[AUDIT][MAIN] === FIN AUDITORÍA DE EXCEL ===`, 'INFO');

      return {
        success: true,
        audit: {
          filePath,
          sheetName,
          totalRows: allData.length,
          headerRowIndex,
          sampleRows: allData.slice(0, 20),
          allData // Devolver TODO para análisis en frontend si es necesario
        }
      };
    } catch (error) {
      sendLog(`[AUDIT][ERROR] Error en auditoría: ${error.message}`, 'ERROR');
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

    // 📊 LOG QUIRÚRGICO: Mostrar qué se está leyendo
    sendLog(`[INIT-EXCEL][DEBUG] === CONTENIDO DEL EXCEL (Hoja: ${sheetName}) ===`, 'DEBUG');
    sendLog(`[INIT-EXCEL][DEBUG] Total filas: ${allData.length}`, 'DEBUG');
    sendLog(`[INIT-EXCEL][DEBUG] Encabezados (fila 6): ${JSON.stringify(headers)}`, 'DEBUG');

    // Mostrar primeras 10 filas de datos
    for (let i = 0; i < Math.min(10, allData.length); i++) {
      const row = allData[i];
      sendLog(`[INIT-EXCEL][DEBUG] Fila ${i+1}: [A="${row[0]}", B="${row[1]}", C="${row[2]}", D="${row[3]}", G="${row[6]}", H="${row[7]}", I="${row[8]}"]`, 'DEBUG');
    }

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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

    const pythonScriptPath = getPythonScriptPath('convert_xlsx_to_pdf.py');

    // Verificar si el script de conversión existe
    if (!fs.existsSync(pythonScriptPath)) {
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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      sendLog(`[MAIN][get-excel-preview] Python no disponible: ${pyError.message}`, 'ERROR');
      return { success: false, error: 'Python no está instalado. Instale Python 3.10-3.12 desde python.org' };
    }
    sendLog(`[MAIN][get-excel-preview] Usando Python de: ${pythonPath}`, 'DEBUG');

    // 3. Definir rutas de script y archivo temporal
    const pythonScriptPath = getPythonScriptPath('convert_xlsx_to_pdf.py');
    tempPdfPath = path.join(os.tmpdir(), `preview-${Date.now()}.pdf`);

    // Verificar que el script existe
    if (!fs.existsSync(pythonScriptPath)) {
      sendLog(`[MAIN][get-excel-preview] El script de conversión de Excel no existe: ${pythonScriptPath}`, 'ERROR');
      return { success: false, error: `Script de conversión no encontrado: ${pythonScriptPath}` };
    }

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
    // ESTRUCTURA DEL EXCEL:
    // - Fila 5 (índice 4): Encabezados de columnas
    // - Fila 6 (índice 5): Primer fila de datos
    // Mapeo de columnas:
    // B (índice 1): Objetivos estratégicos
    // C (índice 2): Indicadores de gestión
    // D (índice 3): Fórmula
    // E (índice 4): Meta
    // F (índice 5): Frecuencia
    // G (índice 6): Responsable
    // H (índice 7): Principle ID (1-4)

    const startIndex = 5; // Fila 6 (índice 5) - DONDE COMIENZAN LOS DATOS
    const objectivesData = [];

    sendLog(`[MAIN][Objetivos] Iniciando lectura desde fila 6 (índice ${startIndex})`, 'INFO');
    sendLog(`[MAIN][Objetivos] Total de filas en el Excel: ${jsonData.length}`, 'INFO');

    for (let i = startIndex; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Debug: mostrar las primeras 3 filas encontradas
      if (i < startIndex + 3) {
        sendLog(`[MAIN][Objetivos] Fila ${i + 1}: ${JSON.stringify(row)}`, 'DEBUG');
      }
      
      // Verificar si existe el objetivo en la columna B (índice 1)
      if (row && row[1]) {
        const objectiveValue = row[1] ? row[1].toString() : '';
        
        // Solo agregar si el objetivo no está vacío
        if (objectiveValue.trim() !== '') {
          objectivesData.push({
            id: objectivesData.length + 1,
            objective:   objectiveValue,
            indicator:   row[2] ? row[2].toString() : '',
            formula:     row[3] ? row[3].toString() : '',
            goal:        row[4] ? row[4].toString() : '',
            frequency:   row[5] ? row[5].toString() : '',
            responsible: row[6] ? row[6].toString() : '',
            principleId: row[7] ? parseInt(row[7]) || null : null  // Col H: principio asignado (1-4), null = auto-detectar
          });
          sendLog(`[MAIN][Objetivos] Fila ${i + 1}: Objetivo encontrado: "${objectiveValue.substring(0, 50)}..."`, 'INFO');
        }
      }
    }

    sendLog(`[MAIN][Objetivos] Total de objetivos leídos: ${objectivesData.length} registros`, 'INFO');

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
    sendLog(`[MAIN][Objetivos][GUARDADO] === INICIO DEL GUARDADO ===`, 'INFO');
    sendLog(`[MAIN][Objetivos][GUARDADO] Archivo: ${filePath}`, 'INFO');
    
    const dataRows = data.objectivesData || [];
    sendLog(`[MAIN][Objetivos][GUARDADO] Datos a guardar: ${dataRows.length} registros`, 'INFO');

    // Verificar que el archivo existe
    try {
      await fsp.access(filePath, fs.constants.R_OK);
      sendLog(`[MAIN][Objetivos][GUARDADO] Archivo Excel accesible para escritura`, 'DEBUG');
    } catch (accessError) {
      sendLog(`[MAIN][Objetivos][GUARDADO] Error de acceso al archivo: ${accessError.message}`, 'ERROR');
      return { success: false, error: `El archivo no es accesible o no existe: ${filePath}. Error: ${accessError.message}` };
    }

    // Leer el archivo Excel existente
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Obtener la primera hoja
    const worksheet = workbook.getWorksheet(1);
    sendLog(`[MAIN][Objetivos][GUARDADO] Hoja obtenida: ${worksheet.name}`, 'INFO');
    sendLog(`[MAIN][Objetivos][GUARDADO] Total de filas actuales: ${worksheet.rowCount}`, 'INFO');

    // Actualizar la política en la celda A6
    if (data.policyText) {
      worksheet.getCell('A6').value = data.policyText;
      sendLog(`[MAIN][Objetivos][GUARDADO] Política actualizada en celda A6`, 'DEBUG');
    }

    // ESTRUCTURA DEL EXCEL:
    // - Fila 5 (índice 5 en ExcelJS 1-based): Encabezados de columnas
    // - Fila 6 (índice 6 en ExcelJS 1-based): PRIMER FILA DE DATOS
    // Mapeo de columnas:
    // B (col 2): Objetivos estratégicos
    // C (col 3): Indicadores de gestión
    // D (col 4): Fórmula
    // E (col 5): Meta
    // F (col 6): Frecuencia
    // G (col 7): Responsable
    // H (col 8): Principle ID (1-4)

    const startIndex = 6; // Fila 6 en ExcelJS (1-based) - DONDE COMIENZAN LOS DATOS
    sendLog(`[MAIN][Objetivos][GUARDADO] Iniciando escritura desde fila ${startIndex}`, 'INFO');

    // ESTRATEGIA DE LIMPIEZA SEGURA:
    // 1. NO limpiar 100 filas indiscriminadamente
    // 2. Solo limpiar las filas necesarias basadas en datos existentes y nuevos
    // 3. Preservar formato, solo cambiar valores
    
    const currentRowCount = worksheet.rowCount;
    const newEndRow = startIndex + dataRows.length - 1;
    const rowsToClear = Math.max(0, currentRowCount - startIndex + 1);
    
    sendLog(`[MAIN][Objetivos][GUARDADO] Filas actuales: ${currentRowCount}, Nuevas filas necesarias: ${newEndRow}`, 'DEBUG');
    sendLog(`[MAIN][Objetivos][GUARDADO] Limpiando ${rowsToClear} filas existentes (desde fila ${startIndex} hasta ${currentRowCount})`, 'DEBUG');

    // Limpiar solo las filas existentes desde startIndex hasta el final
    // Esto preserva el formato y solo elimina valores antiguos
    for (let i = startIndex; i <= currentRowCount; i++) {
      const row = worksheet.getRow(i);
      for (let col = 2; col <= 8; col++) {
        const cell = row.getCell(col);
        // Solo limpiar si hay un valor previo
        if (cell.value !== null && cell.value !== '') {
          cell.value = null;
        }
      }
    }

    sendLog(`[MAIN][Objetivos][GUARDADO] Escribiendo ${dataRows.length} nuevos registros...`, 'INFO');

    // Escribir los nuevos datos comenzando desde fila 6
    dataRows.forEach((obj, index) => {
      const rowNum = startIndex + index;
      const row = worksheet.getRow(rowNum);
      
      row.getCell(2).value = obj.objective   || '';  // Col B: Objetivo
      row.getCell(3).value = obj.indicator   || '';  // Col C: Indicador
      row.getCell(4).value = obj.formula     || '';  // Col D: Fórmula
      row.getCell(5).value = obj.goal        || '';  // Col E: Meta
      row.getCell(6).value = obj.frequency   || '';  // Col F: Frecuencia
      row.getCell(7).value = obj.responsible || '';  // Col G: Responsable
      row.getCell(8).value = (obj.principleId != null) ? obj.principleId : ''; // Col H: principleId
      
      // Log de las primeras 3 filas escritas
      if (index < 3) {
        sendLog(`[MAIN][Objetivos][GUARDADO] Fila ${rowNum}: "${obj.objective?.substring(0, 40) || ''}..." - Principle: ${obj.principleId || 'auto'}`, 'DEBUG');
      }
    });

    if (dataRows.length > 3) {
      sendLog(`[MAIN][Objetivos][GUARDADO] ... y ${dataRows.length - 3} registros adicionales`, 'DEBUG');
    }

    // Guardar el archivo
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[MAIN][Objetivos][GUARDADO] === GUARDADO COMPLETADO EXITOSAMENTE ===`, 'INFO');
    sendLog(`[MAIN][Objetivos][GUARDADO] Archivo guardado: ${filePath}`, 'INFO');
    sendLog(`[MAIN][Objetivos][GUARDADO] Total de registros guardados: ${dataRows.length}`, 'INFO');

    return { success: true };
  } catch (error) {
    sendLog(`[MAIN][Objetivos][GUARDADO] ERROR: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// Handler para guardar datos en el archivo Excel de proveedores (Submódulo 2.9.1)
ipcMain.handle('save-proveedores-excel-data', async (event, filePath, proveedoresData) => {
  try {
    sendLog(`[PROVEEDORES][MAIN] === INICIO GUARDADO DE PROVEEDORES ===`, 'INFO');
    sendLog(`[PROVEEDORES][MAIN] Archivo: ${filePath}`, 'INFO');
    sendLog(`[PROVEEDORES][MAIN] Datos recibidos: ${Array.isArray(proveedoresData) ? proveedoresData.length : 'NO ES ARRAY'} registros`, 'INFO');
    
    // 📊 LOG QUIRÚRGICO: Mostrar estructura exacta de datos recibidos
    if (Array.isArray(proveedoresData) && proveedoresData.length > 0) {
      sendLog(`[PROVEEDORES][DEBUG] === ESTRUCTURA DEL PRIMER REGISTRO ===`, 'DEBUG');
      const primerRegistro = proveedoresData[0];
      sendLog(`[PROVEEDORES][DEBUG] Tipo de dato: ${typeof primerRegistro}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG] Claves del objeto: ${Object.keys(primerRegistro).join(', ')}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG] Registro completo: ${JSON.stringify(primerRegistro, null, 2)}`, 'DEBUG');
      
      // Verificar si viene como objeto plano o con estructura criteria
      if (primerRegistro.criteria) {
        sendLog(`[PROVEEDORES][DEBUG] ✅ El registro TIENE objeto 'criteria'`, 'DEBUG');
        sendLog(`[PROVEEDORES][DEBUG] criteria contenido: ${JSON.stringify(primerRegistro.criteria, null, 2)}`, 'DEBUG');
      } else {
        sendLog(`[PROVEEDORES][DEBUG] ❌ El registro NO tiene objeto 'criteria'. Buscando claves alternativas...`, 'DEBUG');
        // Buscar claves que parezcan criterios
        const criteriaKeys = Object.keys(primerRegistro).filter(k => 
          k.includes('ARL') || k.includes('Politica') || k.includes('IPERC') || 
          k.includes('PTA') || k.includes('Capacitacion') || k.includes('EPP') ||
          k.includes('Estadisticas') || k.includes('Clausula') || k.includes('Reporte') ||
          k.includes('Investigacion')
        );
        if (criteriaKeys.length > 0) {
          sendLog(`[PROVEEDORES][DEBUG] Claves encontradas que parecen criterios: ${criteriaKeys.join(', ')}`, 'DEBUG');
          criteriaKeys.forEach(k => {
            sendLog(`[PROVEEDORES][DEBUG]   ${k} = ${primerRegistro[k]}`, 'DEBUG');
          });
        }
      }
    }

    // Verificar que el archivo existe, si no, crear uno nuevo
    let workbook;
    let worksheet;
    let fileExists = false;

    try {
      await fsp.access(filePath, fs.constants.R_OK);
      fileExists = true;
      sendLog(`[MAIN][2.9.1] Archivo Excel existe, leyendo...`, 'DEBUG');
      
      // Leer archivo existente
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      // Obtener o crear la primera hoja
      if (workbook.worksheets.length > 0) {
        worksheet = workbook.getWorksheet(1);
      } else {
        worksheet = workbook.addWorksheet('Proveedores');
      }
    } catch (accessError) {
      sendLog(`[MAIN][2.9.1] Archivo no existe, creando nuevo: ${accessError.message}`, 'INFO');
      
      // Crear nuevo libro
      workbook = new ExcelJS.Workbook();
      worksheet = workbook.addWorksheet('Proveedores');
      
      // Configurar encabezados (fila 7)
      const headers = [
        'ID', 'Razón Social', 'NIT', 'Tipo', 'Objeto Contractual', 
        'Fecha Evaluación', 'Puntaje (%)', 'Estado', 'Observaciones', 'Ruta Carpeta',
        'ARL/SS', 'Política SST', 'IPERC', 'PTA', 'Capacitación', 
        'EPP', 'Estadísticas', 'Cláusula SST', 'Reporte', 'Investigación'
      ];
      
      // Escribir encabezados en fila 7
      const headerRow = worksheet.getRow(7);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' } // Rosa claro
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Congelar paneles (dejar filas 1-7 fijas)
      worksheet.views = [{ state: 'frozen', ySplit: 7 }];
    }

    // Limpiar datos anteriores (desde fila 8 en adelante)
    for (let i = 8; i < 1000; i++) {
      const row = worksheet.getRow(i);
      for (let col = 1; col <= 20; col++) {
        row.getCell(col).value = null;
      }
    }

    // Escribir nuevos datos desde fila 8
    proveedoresData.forEach((proveedor, index) => {
      const row = worksheet.getRow(8 + index);

      // 📊 LOG QUIRÚRGICO: Mostrar qué se va a escribir
      sendLog(`[PROVEEDORES][DEBUG] === ESCRITURA REGISTRO ${index + 1} ===`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG] Fila de destino: ${8 + index}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG] Datos del registro: ${JSON.stringify(proveedor)}`, 'DEBUG');

      // Columna A: ID
      const idValue = proveedor['ID'] || proveedor['id'] || (index + 1);
      row.getCell(1).value = idValue;
      sendLog(`[PROVEEDORES][DEBUG]   A${8 + index} (ID): ${idValue} ← proveedor['ID']='${proveedor['ID']}', proveedor['id']='${proveedor['id']}'`, 'DEBUG');

      // Columna B: Razón Social
      const nameValue = proveedor['Razón Social'] || proveedor['name'] || '';
      row.getCell(2).value = nameValue;
      sendLog(`[PROVEEDORES][DEBUG]   B${8 + index} (Razón Social): ${nameValue} ← proveedor['Razón Social']='${proveedor['Razón Social']}', proveedor['name']='${proveedor['name']}'`, 'DEBUG');

      // Columna C: NIT
      const nitValue = proveedor['NIT'] || proveedor['nit'] || '';
      row.getCell(3).value = nitValue;
      sendLog(`[PROVEEDORES][DEBUG]   C${8 + index} (NIT): ${nitValue} ← proveedor['NIT']='${proveedor['NIT']}', proveedor['nit']='${proveedor['nit']}'`, 'DEBUG');

      // Columna D: Tipo
      const typeValue = proveedor['Tipo'] || proveedor['type'] || 'Servicio';
      row.getCell(4).value = typeValue;
      sendLog(`[PROVEEDORES][DEBUG]   D${8 + index} (Tipo): ${typeValue} ← proveedor['Tipo']='${proveedor['Tipo']}', proveedor['type']='${proveedor['type']}'`, 'DEBUG');

      // Columna E: Objeto Contractual
      const objectValue = proveedor['Objeto Contractual'] || proveedor['object'] || '';
      row.getCell(5).value = objectValue;
      sendLog(`[PROVEEDORES][DEBUG]   E${8 + index} (Objeto Contractual): ${objectValue} ← proveedor['Objeto Contractual']='${proveedor['Objeto Contractual']}', proveedor['object']='${proveedor['object']}'`, 'DEBUG');

      // Columna F: Fecha Evaluación
      const dateValue = proveedor['Fecha Evaluación'] || proveedor['date'] || new Date().toISOString().split('T')[0];
      row.getCell(6).value = dateValue;
      sendLog(`[PROVEEDORES][DEBUG]   F${8 + index} (Fecha): ${dateValue} ← proveedor['Fecha Evaluación']='${proveedor['Fecha Evaluación']}', proveedor['date']='${proveedor['date']}'`, 'DEBUG');

      // Columna G: Puntaje (%)
      const scoreValue = proveedor['Puntaje (%)'] || proveedor['score'];
      row.getCell(7).value = scoreValue !== undefined ? scoreValue : 0;
      sendLog(`[PROVEEDORES][DEBUG]   G${8 + index} (Puntaje): ${scoreValue !== undefined ? scoreValue : 0} ← proveedor['Puntaje (%)']='${proveedor['Puntaje (%)']}', proveedor['score']='${proveedor['score']}'`, 'DEBUG');

      // Columna H: Estado
      const statusValue = proveedor['Estado'] || proveedor['status'] || 'Pendiente';
      row.getCell(8).value = statusValue;
      sendLog(`[PROVEEDORES][DEBUG]   H${8 + index} (Estado): ${statusValue} ← proveedor['Estado']='${proveedor['Estado']}', proveedor['status']='${proveedor['status']}'`, 'DEBUG');

      // Columna I: Observaciones
      const obsValue = proveedor['Observaciones'] || proveedor['observations'] || '';
      row.getCell(9).value = obsValue;
      sendLog(`[PROVEEDORES][DEBUG]   I${8 + index} (Observaciones): ${obsValue} ← proveedor['Observaciones']='${proveedor['Observaciones']}', proveedor['observations']='${proveedor['observations']}'`, 'DEBUG');

      // Columna J: Ruta Carpeta
      const folderValue = proveedor['Ruta Carpeta'] || proveedor['folder'] || '';
      row.getCell(10).value = folderValue;
      sendLog(`[PROVEEDORES][DEBUG]   J${8 + index} (Ruta Carpeta): ${folderValue} ← proveedor['Ruta Carpeta']='${proveedor['Ruta Carpeta']}', proveedor['folder']='${proveedor['folder']}'`, 'DEBUG');

      // Columnas K-T: Criterios de verificación (objeto plano con claves del Excel)
      const arlValue = proveedor['1. ARL/SS'] || proveedor['ARL/SS'] || '';
      row.getCell(11).value = arlValue;
      sendLog(`[PROVEEDORES][DEBUG]   K${8 + index} (ARL/SS): '${arlValue}' ← proveedor['1. ARL/SS']='${proveedor['1. ARL/SS']}', proveedor['ARL/SS']='${proveedor['ARL/SS']}'`, 'DEBUG');
      
      const politicaValue = proveedor['2. Política SST'] || proveedor['Política SST'] || '';
      row.getCell(12).value = politicaValue;
      sendLog(`[PROVEEDORES][DEBUG]   L${8 + index} (Política SST): '${politicaValue}' ← proveedor['2. Política SST']='${proveedor['2. Política SST']}', proveedor['Política SST']='${proveedor['Política SST']}'`, 'DEBUG');
      
      const ipercValue = proveedor['3. IPERC'] || proveedor['IPERC'] || '';
      row.getCell(13).value = ipercValue;
      sendLog(`[PROVEEDORES][DEBUG]   M${8 + index} (IPERC): '${ipercValue}' ← proveedor['3. IPERC']='${proveedor['3. IPERC']}', proveedor['IPERC']='${proveedor['IPERC']}'`, 'DEBUG');
      
      const ptaValue = proveedor['4. PTA'] || proveedor['PTA'] || '';
      row.getCell(14).value = ptaValue;
      sendLog(`[PROVEEDORES][DEBUG]   N${8 + index} (PTA): '${ptaValue}' ← proveedor['4. PTA']='${proveedor['4. PTA']}', proveedor['PTA']='${proveedor['PTA']}'`, 'DEBUG');
      
      const capacitacionValue = proveedor['5. Capacitación'] || proveedor['Capacitación'] || '';
      row.getCell(15).value = capacitacionValue;
      sendLog(`[PROVEEDORES][DEBUG]   O${8 + index} (Capacitación): '${capacitacionValue}' ← proveedor['5. Capacitación']='${proveedor['5. Capacitación']}', proveedor['Capacitación']='${proveedor['Capacitación']}'`, 'DEBUG');
      
      const eppValue = proveedor['6. EPP'] || proveedor['EPP'] || '';
      row.getCell(16).value = eppValue;
      sendLog(`[PROVEEDORES][DEBUG]   P${8 + index} (EPP): '${eppValue}' ← proveedor['6. EPP']='${proveedor['6. EPP']}', proveedor['EPP']='${proveedor['EPP']}'`, 'DEBUG');
      
      const estadisticasValue = proveedor['7. Estadísticas'] || proveedor['Estadísticas'] || '';
      row.getCell(17).value = estadisticasValue;
      sendLog(`[PROVEEDORES][DEBUG]   Q${8 + index} (Estadísticas): '${estadisticasValue}' ← proveedor['7. Estadísticas']='${proveedor['7. Estadísticas']}', proveedor['Estadísticas']='${proveedor['Estadísticas']}'`, 'DEBUG');
      
      const clausulaValue = proveedor['8. Cláusula SST'] || proveedor['Cláusula SST'] || '';
      row.getCell(18).value = clausulaValue;
      sendLog(`[PROVEEDORES][DEBUG]   R${8 + index} (Cláusula SST): '${clausulaValue}' ← proveedor['8. Cláusula SST']='${proveedor['8. Cláusula SST']}', proveedor['Cláusula SST']='${proveedor['Cláusula SST']}'`, 'DEBUG');
      
      const reporteValue = proveedor['9. Reporte'] || proveedor['Reporte'] || '';
      row.getCell(19).value = reporteValue;
      sendLog(`[PROVEEDORES][DEBUG]   S${8 + index} (Reporte): '${reporteValue}' ← proveedor['9. Reporte']='${proveedor['9. Reporte']}', proveedor['Reporte']='${proveedor['Reporte']}'`, 'DEBUG');
      
      const investigacionValue = proveedor['10. Investigación'] || proveedor['Investigación'] || '';
      row.getCell(20).value = investigacionValue;
      sendLog(`[PROVEEDORES][DEBUG]   T${8 + index} (Investigación): '${investigacionValue}' ← proveedor['10. Investigación']='${proveedor['10. Investigación']}', proveedor['Investigación']='${proveedor['Investigación']}'`, 'DEBUG');

      // Aplicar bordes a la fila
      for (let col = 1; col <= 20; col++) {
        row.getCell(col).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    });

    sendLog(`[PROVEEDORES][DEBUG] === RESUMEN DE ESCRITURA ===`, 'DEBUG');
    sendLog(`[PROVEEDORES][DEBUG] Total registros escritos: ${proveedoresData.length}`, 'DEBUG');
    sendLog(`[PROVEEDORES][DEBUG] Última fila ocupada: ${8 + proveedoresData.length - 1}`, 'DEBUG');

    // Ajustar ancho de columnas
    worksheet.columns = [
      { key: 'id', width: 8 },
      { key: 'name', width: 30 },
      { key: 'nit', width: 15 },
      { key: 'type', width: 12 },
      { key: 'object', width: 35 },
      { key: 'date', width: 14 },
      { key: 'score', width: 12 },
      { key: 'status', width: 12 },
      { key: 'observations', width: 30 },
      { key: 'folder', width: 25 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 10 }, { width: 12 }, { width: 12 },
      { width: 10 }, { width: 12 }
    ];

    // Guardar archivo
    await workbook.xlsx.writeFile(filePath);

    sendLog(`[PROVEEDORES][MAIN] Archivo guardado exitosamente`, 'INFO');
    
    // 📊 VERIFICACIÓN POST-ESCRITURA
    sendLog(`[PROVEEDORES][DEBUG] === VERIFICACIÓN POST-ESCRITURA ===`, 'DEBUG');
    const verifyWorkbook = new ExcelJS.Workbook();
    await verifyWorkbook.xlsx.readFile(filePath);
    const verifyWorksheet = verifyWorkbook.getWorksheet(1);
    
    for (let i = 8; i <= Math.min(8 + Math.min(3, proveedoresData.length), 8 + 3); i++) {
      const row = verifyWorksheet.getRow(i);
      sendLog(`[PROVEEDORES][DEBUG] [VERIFICACIÓN] Fila ${i}:`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG]   A${i} (ID): ${row.getCell(1).value}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG]   B${i} (Razón Social): ${row.getCell(2).value}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG]   K${i} (ARL/SS): ${row.getCell(11).value}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG]   L${i} (Política SST): ${row.getCell(12).value}`, 'DEBUG');
      sendLog(`[PROVEEDORES][DEBUG]   M${i} (IPERC): ${row.getCell(13).value}`, 'DEBUG');
    }

    sendLog(`[PROVEEDORES][MAIN] Datos de proveedores guardados exitosamente: ${proveedoresData.length} registros`, 'INFO');

    return { success: true };
  } catch (error) {
    sendLog(`[PROVEEDORES][ERROR] Error guardando datos de proveedores: ${error.message}`, 'ERROR');
    console.error('[PROVEEDORES][ERROR] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

// ========================================================================
// HANDLERS PARA GESTIÓN DE ARCHIVOS DE PROVEEDORES
// ========================================================================

/**
 * Crea una carpeta para las evidencias de un proveedor
 */
ipcMain.handle('create-provider-folder', async (event, basePath, folderName) => {
  const sendLog = (msg, level = 'INFO') => {
    console.log(`[PROVEEDORES][${level}] ${msg}`);
  };

  try {
    sendLog(`[MAIN] Creando carpeta para proveedor: ${folderName}`, 'INFO');
    sendLog(`[MAIN] Ruta base: ${basePath}`, 'INFO');

    // Normalizar ruta
    const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    const normalizedFolder = folderName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    const folderPath = path.join(normalizedBase, normalizedFolder);

    sendLog(`[MAIN] Ruta completa de la carpeta: ${folderPath}`, 'INFO');

    // Verificar si la carpeta ya existe
    if (fs.existsSync(folderPath)) {
      sendLog(`[MAIN] La carpeta ya existe: ${folderPath}`, 'WARN');
      return { success: true, path: folderPath, exists: true };
    }

    // Crear la carpeta recursivamente
    await fsp.mkdir(folderPath, { recursive: true });

    sendLog(`[MAIN] Carpeta creada exitosamente: ${folderPath}`, 'INFO');

    return { success: true, path: folderPath, exists: false };
  } catch (error) {
    sendLog(`[ERROR] Error creando carpeta: ${error.message}`, 'ERROR');
    console.error('[PROVEEDORES][ERROR] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

/**
 * Copia un archivo a la carpeta del proveedor (recibe datos en base64)
 */
ipcMain.handle('copy-file-to-provider-folder', async (event, base64Data, destFolderPath, fileName, mimeType) => {
  const sendLog = (msg, level = 'INFO') => {
    console.log(`[PROVEEDORES][${level}] ${msg}`);
  };

  try {
    sendLog(`[MAIN] Copiando archivo: ${fileName}`, 'INFO');
    sendLog(`[MAIN] Destino: ${destFolderPath}`, 'INFO');
    sendLog(`[MAIN] Tipo MIME: ${mimeType || 'no especificado'}`, 'INFO');

    // Normalizar rutas
    const normalizedDest = destFolderPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    const normalizedFileName = fileName.replace(/[^a-zA-Z0-9._\-]/g, '_');

    const destPath = path.join(normalizedDest, normalizedFileName);

    sendLog(`[MAIN] Ruta completa de destino: ${destPath}`, 'INFO');

    // Decodificar datos base64 a buffer
    const fileBuffer = Buffer.from(base64Data, 'base64');

    sendLog(`[MAIN] Tamaño del archivo: ${fileBuffer.length} bytes`, 'INFO');

    // Escribir archivo en el destino
    await fsp.writeFile(destPath, fileBuffer);

    sendLog(`[MAIN] Archivo guardado exitosamente: ${destPath}`, 'INFO');

    return { success: true, path: destPath };
  } catch (error) {
    sendLog(`[ERROR] Error guardando archivo: ${error.message}`, 'ERROR');
    console.error('[PROVEEDORES][ERROR] Error stack:', error.stack);
    return { success: false, error: error.message };
  }
});

/**
 * Lista los archivos en la carpeta de un proveedor
 */
ipcMain.handle('list-provider-files', async (event, folderPath) => {
  const sendLog = (msg, level = 'INFO') => {
    console.log(`[PROVEEDORES][${level}] ${msg}`);
  };

  try {
    sendLog(`[MAIN] Listando archivos en: ${folderPath}`, 'INFO');

    // Normalizar ruta
    const normalizedPath = folderPath.replace(/\\/g, '/').replace(/\/+/g, '/');

    // Verificar que la carpeta existe
    if (!fs.existsSync(normalizedPath)) {
      sendLog(`[WARN] La carpeta no existe: ${normalizedPath}`, 'WARN');
      return { success: false, error: 'La carpeta no existe', files: [] };
    }

    // Leer contenido de la carpeta
    const files = await fsp.readdir(normalizedPath);
    
    // Filtrar solo archivos (no directorios)
    const fileDetails = [];
    for (const file of files) {
      const filePath = path.join(normalizedPath, file);
      const stats = await fsp.stat(filePath);
      if (stats.isFile()) {
        fileDetails.push({
          name: file,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }

    sendLog(`[MAIN] Archivos encontrados: ${fileDetails.length}`, 'INFO');

    return { success: true, files: fileDetails };
  } catch (error) {
    sendLog(`[ERROR] Error listando archivos: ${error.message}`, 'ERROR');
    console.error('[PROVEEDORES][ERROR] Error stack:', error.stack);
    return { success: false, error: error.message, files: [] };
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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      sendLog(`[MAIN][get-word-preview] Python no disponible: ${pyError.message}`, 'ERROR');
      return { success: false, error: 'Python no está instalado. Instale Python 3.10-3.12 desde python.org' };
    }
    sendLog(`[MAIN][get-word-preview] Usando Python de: ${pythonPath}`, 'DEBUG');

    // 2. Definir rutas de script y archivo temporal
    const pythonScriptPath = getPythonScriptPath('convert_docx_to_pdf.py');
    tempPdfPath = path.join(os.tmpdir(), `preview-${Date.now()}.pdf`);

    // Verificar que el script existe
    if (!fs.existsSync(pythonScriptPath)) {
      sendLog(`[MAIN][get-word-preview] El script de conversión de Word no existe: ${pythonScriptPath}`, 'ERROR');
      return { success: false, error: `Script de conversión no encontrado: ${pythonScriptPath}` };
    }

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

// ===============================
// Manejador para subir documentos (Drag & Drop)
// ===============================
ipcMain.handle('upload-document', async (event, payload) => {
  const { fileName, base64Data, destinationPath } = payload;
  
  sendLog(`[MAIN][upload-document] Solicitud para subir archivo: ${fileName} a ${destinationPath}`, 'INFO');

  try {
    // 1. Validar que se recibieron los datos necesarios
    if (!fileName || !base64Data || !destinationPath) {
      throw new Error('Datos incompletos para subir el archivo');
    }

    // 2. Normalizar ruta (importante para Windows con espacios/caracteres especiales)
    const normalizedPath = path.normalize(destinationPath);
    
    // 3. Validar que la ruta de destino existe
    await fsp.access(normalizedPath);

    // 4. Validar extensión del archivo (solo tipos permitidos)
    const allowedExtensions = ['.pdf', '.xls', '.xlsx', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
    const fileExtension = path.extname(fileName).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`Tipo de archivo no permitido: ${fileExtension}. Tipos permitidos: ${allowedExtensions.join(', ')}`);
    }

    // 5. Validar tamaño del archivo (máximo 10MB)
    const fileSizeBytes = Math.ceil((base64Data.length * 3) / 4);
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    if (fileSizeBytes > maxSizeBytes) {
      throw new Error(`El archivo excede el tamaño máximo permitido de 10MB. Tamaño: ${(fileSizeBytes / 1024 / 1024).toFixed(2)}MB`);
    }

    // 6. Validar y limpiar nombre del archivo (evitar caracteres especiales)
    const invalidChars = /[<>:"/\\|?*]/g;
    if (invalidChars.test(fileName)) {
      throw new Error('El nombre del archivo contiene caracteres inválidos');
    }

    // 7. Construir ruta completa del archivo (normalizada)
    const filePath = path.normalize(path.join(normalizedPath, fileName));

    // 8. Verificar si el archivo ya existe
    const fileExists = await fsp.access(filePath).then(() => true).catch(() => false);

    if (fileExists) {
      sendLog(`[MAIN][upload-document] El archivo ya existe: ${filePath}`, 'WARN');
      // Nota: Podríamos agregar lógica para renombrar automáticamente o pedir confirmación
      // Por ahora, sobrescribimos el archivo
    }

    // 9. Decodificar base64 a buffer (eliminar data URL prefix si existe)
    const base64DataClean = base64Data.split(',')[1] || base64Data;
    const fileBuffer = Buffer.from(base64DataClean, 'base64');

    // 10. Guardar archivo con manejo robusto de errores
    try {
      await fsp.writeFile(filePath, fileBuffer);
    } catch (writeError) {
      // Si falla con la ruta normalizada, intentar con ruta absoluta
      const absolutePath = path.resolve(filePath);
      sendLog(`[MAIN][upload-document] Reintentando con ruta absoluta: ${absolutePath}`, 'INFO');
      await fsp.writeFile(absolutePath, fileBuffer);
    }

    sendLog(`[MAIN][upload-document] Archivo subido exitosamente: ${filePath}`, 'INFO');

    return { 
      success: true, 
      filePath: filePath,
      fileName: fileName,
      message: fileExists ? 'Archivo actualizado' : 'Archivo subido exitosamente'
    };

  } catch (error) {
    sendLog(`[MAIN][upload-document] Error al subir archivo: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
});

// ===============================
// Manejador para eliminar documentos
// ===============================
// Helper function: Sleep
// ===============================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===============================
ipcMain.handle('delete-document', async (event, filePath) => {
  sendLog(`[MAIN][delete-document] Solicitud para eliminar archivo: ${filePath}`, 'INFO');

  try {
    // 1. Validar que se recibió la ruta
    if (!filePath) {
      sendLog(`[MAIN][delete-document] Error: Ruta vacía`, 'ERROR');
      throw new Error('Ruta de archivo no válida');
    }

    // 2. Normalizar ruta
    const normalizedPath = path.normalize(filePath);
    sendLog(`[MAIN][delete-document] Ruta normalizada: ${normalizedPath}`, 'DEBUG');

    // 3. Verificar que el archivo existe
    const fileExists = await fsp.access(normalizedPath).then(() => true).catch(() => false);
    sendLog(`[MAIN][delete-document] Archivo existe: ${fileExists}`, 'DEBUG');

    if (!fileExists) {
      sendLog(`[MAIN][delete-document] Error: Archivo no existe en ${normalizedPath}`, 'ERROR');
      throw new Error('El archivo no existe');
    }

    // 4. Verificar que es un archivo (no carpeta)
    const stats = await fsp.stat(normalizedPath);
    sendLog(`[MAIN][delete-document] Stats del archivo: isFile=${stats.isFile()}, size=${stats.size} bytes`, 'DEBUG');

    if (!stats.isFile()) {
      sendLog(`[MAIN][delete-document] Error: No es un archivo`, 'ERROR');
      throw new Error('La ruta no corresponde a un archivo');
    }

    // 5. Eliminar archivo - Estrategia múltiple para Google Drive
    
    // === ESTRATEGIA 1: Mover a papelera (CORREGIDO) ===
    sendLog(`[MAIN][delete-document] Intentando mover a papelera (shell.trashItem)...`, 'INFO');

    try {
      await shell.trashItem(normalizedPath);  // ✅ Método correcto Electron 10+

      // Verificar que se movió
      const stillExists = await fsp.access(normalizedPath).then(() => true).catch(() => false);

      if (!stillExists) {
        sendLog(`[MAIN][delete-document] Archivo movido a papelera exitosamente`, 'INFO');
        return {
          success: true,
          message: 'Archivo eliminado correctamente'
        };
      }

      sendLog(`[MAIN][delete-document] Archivo sigue existiendo después de trashItem`, 'WARN');
    } catch (trashError) {
      sendLog(`[MAIN][delete-document] Error al mover a papelera: ${trashError.message}`, 'WARN');
    }

    // === ESTRATEGIA 2: Liberar handles de Windows (solo Windows) ===
    if (process.platform === 'win32') {
      sendLog(`[MAIN][delete-document] Intentando liberar handles de Windows...`, 'DEBUG');
      try {
        // Abrir y cerrar para intentar liberar locks
        const handle = await fsp.open(normalizedPath, 'r');
        await fsp.close(handle);
        await sleep(500); // Pequeña pausa para liberar
      } catch (e) {
        sendLog(`[MAIN][delete-document] No se pudo liberar handles: ${e.message}`, 'DEBUG');
      }
    }

    // === ESTRATEGIA 3: Eliminación forzada con reintentos mejorados ===
    // Detectar tipo de archivo para ajustar estrategia
    const fileExt = path.extname(normalizedPath).toLowerCase();
    const isExcel = fileExt === '.xlsx' || fileExt === '.xls';
    const isLargeFile = stats.size > 1024 * 1024; // > 1MB
    
    // Configurar reintentos basados en tipo de archivo
    const maxRetries = isExcel || isLargeFile ? 15 : 10;  // 15 para Excel/grandes, 10 para otros
    const delay = isExcel ? 3000 : 2000;  // 3s para Excel, 2s para otros
    
    sendLog(`[MAIN][delete-document] Intentando eliminación forzada (${maxRetries} intentos, ${delay}ms delay)...`, 'INFO');
    sendLog(`[MAIN][delete-document] Tipo: ${fileExt}, Tamaño: ${stats.size} bytes, Es Excel: ${isExcel}`, 'DEBUG');

    let deleted = false;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await fsp.unlink(normalizedPath);
        await sleep(delay);

        const stillExists = await fsp.access(normalizedPath).then(() => true).catch(() => false);

        if (!stillExists) {
          deleted = true;
          sendLog(`[MAIN][delete-document] Archivo eliminado en intento ${i + 1}/${maxRetries}`, 'INFO');
          break;
        }

        sendLog(`[MAIN][delete-document] Reintento ${i + 1}/${maxRetries} - archivo aún existe`, 'WARN');
      } catch (retryError) {
        // Si el error es ENOENT, el archivo ya no existe (éxito)
        if (retryError.code === 'ENOENT') {
          deleted = true;
          break;
        }
        // Otros errores, lanzar
        throw retryError;
      }
    }

    if (!deleted) {
      sendLog(`[MAIN][delete-document] ERROR: El archivo sigue existiendo después de ${maxRetries} intentos`, 'ERROR');
      
      // Mensaje específico para Excel
      if (isExcel) {
        throw new Error('Google Drive tiene el archivo Excel bloqueado. Cierra Excel y Google Drive, luego intenta nuevamente.');
      }
      
      throw new Error('Google Drive tiene el archivo bloqueado. Cierra Google Drive temporalmente e intenta nuevamente.');
    }

    sendLog(`[MAIN][delete-document] Archivo eliminado exitosamente: ${normalizedPath}`, 'INFO');

    return {
      success: true,
      message: 'Archivo eliminado correctamente'
    };

  } catch (error) {
    sendLog(`[MAIN][delete-document] Error al eliminar archivo: ${error.message}`, 'ERROR');

    // Manejo específico para error EPERM (archivo en uso)
    let userMessage = error.message;
    let errorCode = error.code || 'UNKNOWN';

    if (error.code === 'EPERM') {
      userMessage = 'El archivo está abierto en otra aplicación. Ciérralo e intenta nuevamente.';
      sendLog(`[MAIN][delete-document] Archivo está en uso o bloqueado (EPERM)`, 'WARN');
    } else if (error.code === 'ENOENT') {
      userMessage = 'El archivo no existe. Puede que ya haya sido eliminado.';
      sendLog(`[MAIN][delete-document] Archivo no existe (ENOENT)`, 'WARN');
    } else if (error.code === 'EACCES') {
      userMessage = 'No tienes permisos para eliminar este archivo.';
      sendLog(`[MAIN][delete-document] Sin permisos (EACCES)`, 'WARN');
    } else if (error.message.includes('Google Drive')) {
      // Error personalizado para Google Drive
      errorCode = 'GDRIVE_LOCK';
      sendLog(`[MAIN][delete-document] Google Drive bloqueó la eliminación`, 'WARN');
    }

    return {
      success: false,
      error: userMessage,
      code: errorCode
    };
  }
});

// ===============================
// Manejador para abrir archivo con aplicación predeterminada
// ===============================
ipcMain.handle('open-file', async (event, filePath) => {
  const { shell } = require('electron');
  
  sendLog(`[MAIN][open-file] Solicitud para abrir archivo: ${filePath}`, 'INFO');

  try {
    // 1. Validar que se recibió la ruta
    if (!filePath) {
      throw new Error('Ruta de archivo no válida');
    }

    // 2. Normalizar ruta
    const normalizedPath = path.normalize(filePath);

    // 3. Verificar que el archivo existe
    const fileExists = await fsp.access(normalizedPath).then(() => true).catch(() => false);
    
    if (!fileExists) {
      throw new Error('El archivo no existe');
    }

    // 4. Abrir con aplicación predeterminada del sistema
    await shell.openPath(normalizedPath);

    sendLog(`[MAIN][open-file] Archivo abierto exitosamente: ${normalizedPath}`, 'INFO');

    return {
      success: true,
      message: 'Archivo abierto'
    };

  } catch (error) {
    sendLog(`[MAIN][open-file] Error al abrir archivo: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
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
    // 🛡️ DETECCIÓN DE FÓRMULAS - IDENTIFICAR CELDAS CON FÓRMULAS COMPARTIDAS
    // ============================================================================
    const formulaCells = new Map(); // Mapa: "row,col" -> { formula, value }
    const totalRowIndices = new Set(); // Filas que son TOTAL (no se deben sobrescribir fórmulas)

    // Detectar filas con "TOTAL" en la columna A o C
    for (let rowIdx = 1; rowIdx <= worksheet.rowCount; rowIdx++) {
      const row = worksheet.getRow(rowIdx);
      const cellA = row.getCell(1);
      const cellC = row.getCell(3);
      
      if (cellA.value && typeof cellA.value === 'string' && cellA.value.includes('TOTAL')) {
        totalRowIndices.add(rowIdx);
        sendLog(`[DEBUG] Fila TOTAL detectada: ${rowIdx}`, 'DEBUG');
      }
    }

    // Detectar celdas con fórmula en el rango de datos (filas 10-78, columnas A-R)
    for (let rowIdx = 10; rowIdx <= Math.min(78, worksheet.rowCount); rowIdx++) {
      const row = worksheet.getRow(rowIdx);
      for (let colIdx = 1; colIdx <= 18; colIdx++) { // A=1, R=18
        const cell = row.getCell(colIdx);
        if (cell.value && typeof cell.value === 'object' && cell.value.formula) {
          const key = `${rowIdx},${colIdx}`;
          formulaCells.set(key, {
            formula: cell.value.formula,
            value: cell.value.result,
            shared: cell.value.sharedFormula
          });
          sendLog(`[DEBUG] Fórmula detectada en ${key}: ${cell.value.formula}`, 'DEBUG');
        }
      }
    }
    sendLog(`[DEBUG] Total de celdas con fórmula detectadas: ${formulaCells.size}`, 'DEBUG');

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

    // ============================================================================
    // 📝 ESCRITURA DE DATOS - PRESERVANDO FÓRMULAS COMPARTIDAS
    // ============================================================================
    for (let i = 0; i < dataToSave.length; i++) {
      const rowData = dataToSave[i];
      const rowIndex = i + 10;
      const row = worksheet.getRow(rowIndex);

      // Verificar si es una fila TOTAL (no sobrescribir fórmulas)
      const isTotalRow = totalRowIndices.has(rowIndex);

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
      // ⚠️ VERIFICAR si hay fórmula compartida - si es así, NO sobrescribir
      const formulaKeyF = `${rowIndex},6`; // Columna F = índice 6 en ExcelJS
      if (formulaCells.has(formulaKeyF) && !isTotalRow) {
        // Preservar fórmula compartida - no sobrescribir con valor directo
        sendLog(`[DEBUG] Preservando fórmula en F${rowIndex}`, 'DEBUG');
      } else {
        // No hay fórmula o es fila TOTAL (calculamos el valor)
        row.getCell(6).value = parsePercentage(rowData.porcentaje_ejecutado);
        row.getCell(6).numFmt = '0.00%';
      }

      // Columnas G a R (índices 6-17) - Meses
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                     'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

      meses.forEach((mes, idx) => {
        const colIndex = 7 + idx; // 7 = columna G (índice base 1 de ExcelJS)
        const formulaKey = `${rowIndex},${colIndex}`;
        
        // ⚠️ VERIFICAR si hay fórmula compartida - si es así, NO sobrescribir
        if (formulaCells.has(formulaKey)) {
          // Preservar fórmula compartida
          sendLog(`[DEBUG] Preservando fórmula en columna ${String.fromCharCode(64 + colIndex)}${rowIndex}`, 'DEBUG');
        } else {
          // No hay fórmula, escribir valor normal
          row.getCell(colIndex).value = parseValue(rowData[mes]);
          row.getCell(colIndex).numFmt = '#,##0.00';
        }
      });

      sendLog(`[DEBUG] handleSaveBudgetFile - Escribiendo valores en fila ${rowIndex}${isTotalRow ? ' (TOTAL)' : ''}`, 'DEBUG');
    }

    // ============================================================================
    // 📊 CÁLCULO DE TOTALES DESDE BACKEND (si existe fila TOTAL)
    // ============================================================================
    if (totalRowIndices.size > 0) {
      sendLog(`[DEBUG] Calculando totales para ${totalRowIndices.size} fila(s) TOTAL`, 'DEBUG');
      
      for (const totalRowIdx of totalRowIndices) {
        const totalRow = worksheet.getRow(totalRowIdx);
        
        // Calcular suma de columnas D a R (excluyendo columna F que es porcentaje)
        const columnsToSum = [4, 5]; // D (Asignación), E (Ejecutado)
        const monthColumns = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // G a R
        
        // Sumar columnas D y E
        columnsToSum.forEach(colIdx => {
          let sum = 0;
          for (let i = 0; i < dataToSave.length; i++) {
            const rowIndex = i + 10;
            const cell = worksheet.getRow(rowIndex).getCell(colIdx);
            if (cell.value && typeof cell.value === 'number') {
              sum += cell.value;
            }
          }
          totalRow.getCell(colIdx).value = sum;
          totalRow.getCell(colIdx).numFmt = '#,##0.00';
        });
        
        // Sumar columnas de meses (G a R)
        monthColumns.forEach(colIdx => {
          let sum = 0;
          for (let i = 0; i < dataToSave.length; i++) {
            const rowIndex = i + 10;
            const cell = worksheet.getRow(rowIndex).getCell(colIdx);
            if (cell.value && typeof cell.value === 'number') {
              sum += cell.value;
            }
          }
          totalRow.getCell(colIdx).value = sum;
          totalRow.getCell(colIdx).numFmt = '#,##0.00';
        });
        
        // Calcular porcentaje total (E / D * 100)
        const asignacionTotal = totalRow.getCell(4).value || 0;
        const ejecutadoTotal = totalRow.getCell(5).value || 0;
        if (asignacionTotal > 0) {
          const porcentajeTotal = ejecutadoTotal / asignacionTotal;
          totalRow.getCell(6).value = porcentajeTotal;
          totalRow.getCell(6).numFmt = '0.00%';
        }
        
        sendLog(`[DEBUG] Totales calculados para fila ${totalRowIdx}`, 'DEBUG');
      }
    }

    // ============================================================================
    // 🛡️ RESTAURACIÓN DE MERGES - REAPLICAR SOLO SI NO EXISTEN YA
    // ============================================================================
    sendLog(`[DEBUG] Restaurando ${existingMerges.length} merges...`, 'DEBUG');
    
    // Obtener merges actuales después de la escritura
    const currentMerges = new Set();
    if (worksheet.model && worksheet.model.merges) {
      for (const mergeRange of worksheet.model.merges) {
        currentMerges.add(mergeRange);
      }
    }
    
    for (const mergeRange of existingMerges) {
      try {
        // Verificar si el merge ya existe (no intentar reaplicar)
        if (currentMerges.has(mergeRange)) {
          sendLog(`[DEBUG] Merge ya existe, omitiendo: ${mergeRange}`, 'DEBUG');
          continue;
        }
        
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
    sendLog(`[DEBUG] Todos los merges han sido procesados`, 'DEBUG');

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

// ═══════════════════════════════════════════════════════
// FURAT - Reportes de Accidentes (Submódulo 3.2.1)
// Handlers IPC para dashboard y biblioteca
// ═══════════════════════════════════════════════════════

function registerFuratHandlers(appInstance) {
  sendLog('[FURAT] Registrando handlers IPC...', 'INFO');

  // No necesitamos handlers adicionales porque el logic.js
  // usa los contracts existentes (get-document-folders, get-pdf-preview, etc.)
  // El dashboard y biblioteca se calculan en el frontend (renderer)

  sendLog('[FURAT] Handlers registrados correctamente (usa contratos existentes)', 'INFO');
}

// Manejador para la creación de la ventana principal
app.whenReady().then(() => {
  // Solo crear ventana si no ha sido creada antes
  if (!isWindowCreated) {
    createWindow();
  }

  // Registrar handlers de Archivo y Retención Documental (Submódulo 2.5.1)
  try {
    registerArchivoRetencionHandlers(app);
    sendLog('[MAIN] Handlers de Archivo y Retención Documental (2.5.1) registrados correctamente', 'INFO');
  } catch (err) {
    sendLog(`[MAIN] Error registrando handlers de Archivo Retención: ${err.message}`, 'ERROR');
  }

  // Registrar handlers de FURAT - Reportes de Accidentes (Submódulo 3.2.1)
  try {
    registerFuratHandlers(app);
    sendLog('[MAIN] Handlers de FURAT (3.2.1) registrados correctamente', 'INFO');
  } catch (err) {
    sendLog(`[MAIN] Error registrando handlers de FURAT: ${err.message}`, 'ERROR');
  }

  // Iniciar la búsqueda de actualizaciones una vez que la app esté lista
  // Usar función segura con manejo de errores
  setTimeout(() => {
    sendLog('Iniciando verificación de actualizaciones...', 'INFO');
    checkForUpdatesSafe();
  }, 5000);  // Esperar 5 segundos después de cargar la ventana para evitar conflictos

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

  const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

  // Verificar que el script existe
  if (!fs.existsSync(scriptPath)) {
    sendLog(`[Python Empleado - ERROR] Script no encontrado: ${scriptPath}`, 'ERROR');
    return { success: false, error: `Script de Python no encontrado: ${scriptPath}` };
  }

  return new Promise((resolve, reject) => {
    sendLog(`IPC: buscar-empleado-por-cedula recibido. Empresa: ${empresa}, Cédula: ${cedula}`);

    // Obtener Python path correcto
    getPython().then(pythonPath => {
      const python = spawn(pythonPath, [scriptPath, 'buscar_empleado', cedula, empresa], {
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
    }).catch(pyErr => {
      sendLog(`Python no disponible para buscar empleado: ${pyErr.message}`, 'ERROR');
      resolve({ success: false, error: 'Python no está instalado. Instale Python 3.10-3.12 desde python.org' });
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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

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
    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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
    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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
    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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
    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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
    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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

    const scriptPath = getPythonScriptPath('actualizar_ausentismo.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }

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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }
    sendLog(`[MAIN][generate-copasst-acta] Usando Python de: ${pythonPath}`, 'DEBUG');

    // Definir rutas necesarias
    const scriptPath = getPythonScriptPath('copasst_acta_generator.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

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
    let pythonPath;
    try {
      pythonPath = await getPython();
    } catch (pyError) {
      throw new Error('Python no está instalado. Instale Python 3.10-3.12 desde python.org');
    }
    sendLog(`[MAIN][generate-convivencia-acta] Usando Python de: ${pythonPath}`, 'DEBUG');

    // Definir rutas necesarias
    const scriptPath = getPythonScriptPath('comite_convivencia_acta_generator.py');

    // Verificar que el script existe
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script de Python no encontrado: ${scriptPath}`);
    }

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

    sendLog(`[MAIN] Buscando carpeta inducciones en: ${recursosPath}`, 'DEBUG');

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] Ruta estándar no existe, buscando alternativas...`, 'DEBUG');
      if (fs.existsSync(recursosPath)) {
        const subs = await fsp.readdir(recursosPath);
        sendLog(`[MAIN] Subcarpetas encontradas: ${subs.join(', ')}`, 'DEBUG');
        
        // Normalizar nombres (quitar tildes) para comparación
        const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // PRIORIDAD 1: Buscar carpeta que contenga "induccion" o "reinduccion" (con o sin tildes)
        const indFolder = subs.find(s => {
          const norm = normalize(s);
          return norm.includes('induccion') || norm.includes('reinduccion');
        });
        
        // PRIORIDAD 2: Si no, buscar carpeta 1.1 o 1.2 que contenga "induccion"
        const indFolderNumeric = subs.find(s => {
          const norm = normalize(s);
          return (s.startsWith('1.1') || s.startsWith('1.2')) && norm.includes('induccion');
        });
        
        // PRIORIDAD 3: Si no, buscar cualquier carpeta 1.1
        const fallbackFolder = subs.find(s => s.includes('1.1') || normalize(s).includes('inducci'));
        
        const finalFolder = indFolder || indFolderNumeric || fallbackFolder;
        
        sendLog(`[MAIN] Carpeta de inducciones encontrada: ${finalFolder || 'NINGUNA'}`, 'DEBUG');
        if (finalFolder) targetPath = path.join(recursosPath, finalFolder);
      }
    }

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] ERROR: No se encontró carpeta de inducciones. Ruta buscada: ${targetPath}`, 'ERROR');
      throw new Error('No se encontró la carpeta de inducciones');
    }

    const files = await fsp.readdir(targetPath);
    sendLog(`[MAIN] Archivos en carpeta inducciones: ${files.join(', ')}`, 'DEBUG');
    
    // Buscar archivo Excel de inducciones con múltiples variaciones
    const excelFile = files.find(f => {
        if (!f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls'))) {
            const lowerName = f.toLowerCase();
            // Buscar variaciones: inducción, induccion, inducciones, fo-046, 046, registro
            return lowerName.includes('inducción') ||
                   lowerName.includes('induccion') || 
                   lowerName.includes('inducciones') ||
                   lowerName.includes('fo-046') || 
                   lowerName.includes('fo_046') ||
                   lowerName.includes('046') ||
                   lowerName.includes('registro');  // Para archivos como "Registro de Inducción"
        }
        return false;
    });
    
    sendLog(`[MAIN] Archivo Excel encontrado: ${excelFile || 'NINGUNO'}`, 'DEBUG');

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
        
        // Saltar fila de encabezados (puede variar entre empresas)
        const lowerRow = row.join(' ').toLowerCase();
        if (lowerRow.includes('fecha de ingreso') || 
            lowerRow.includes('nombre completo') || 
            lowerRow.includes('cedula') || 
            lowerRow.includes('cargo') ||
            lowerRow.includes('fecha') && lowerRow.includes('empleado')) {
            continue;
        }

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

// ============================================================================
// INDUCCIONES - Actualizar Excel Power Query (COM Automation via VBScript)
// ============================================================================
async function refreshExcelPowerQuery(filePath) {
  return new Promise((resolve, reject) => {
    sendLog(`[EXCEL COM] Iniciando actualización de Power Query`, 'INFO');
    sendLog(`[EXCEL COM] Ruta del archivo: ${filePath}`, 'DEBUG');
    
    // Crear archivo VBScript temporal
    const vbsPath = path.join(os.tmpdir(), `refresh_excel_${Date.now()}.vbs`);
    
    // Script VBScript que recibe la ruta como argumento
    const vbsScript = `
On Error Resume Next

Dim excelApp
Dim workbook
Dim fso
Dim filePath

' Obtener ruta desde argumento
If WScript.Arguments.Count = 0 Then
    WScript.Echo "ERROR: No se proporcionó ruta de archivo"
    WScript.Quit 1
End If
filePath = WScript.Arguments(0)

' Crear FileSystemObject para verificar archivo
Set fso = CreateObject("Scripting.FileSystemObject")

' Verificar que el archivo existe
If Not fso.FileExists(filePath) Then
    WScript.Echo "ERROR: El archivo no existe: " & filePath
    WScript.Quit 1
End If

' Crear instancia de Excel
Set excelApp = CreateObject("Excel.Application")

If Err.Number <> 0 Then
    WScript.Echo "ERROR: No se pudo crear Excel.Application - " & Err.Description
    WScript.Quit 1
End If

excelApp.Visible = False
excelApp.DisplayAlerts = False

' Abrir libro
Set workbook = excelApp.Workbooks.Open(filePath)

If Err.Number <> 0 Then
    WScript.Echo "ERROR: No se pudo abrir el archivo - " & Err.Description
    If Not workbook Is Nothing Then workbook.Close False
    excelApp.Quit
    WScript.Quit 1
End If

' Actualizar todas las consultas (Power Query)
workbook.RefreshAll

' Esperar a que termine la actualización (máximo 60 segundos)
Dim timeout, startTime, elapsedTime
timeout = 60
startTime = Timer

Do While excelApp.BackgroundQueryDownloading
    WScript.Sleep 500
    elapsedTime = Timer - startTime
    If elapsedTime < 0 Then elapsedTime = elapsedTime + 86400 ' Manejar medianoche
    If elapsedTime > timeout Then
        WScript.Echo "WARNING: Timeout de actualización alcanzado"
        Exit Do
    End If
Loop

' Esperar un poco más para asegurar que los datos se carguen
WScript.Sleep 2000

' Guardar y cerrar
workbook.Save
workbook.Close

excelApp.Quit

' Liberar objetos
Set workbook = Nothing
Set excelApp = Nothing
Set fso = Nothing

WScript.Echo "SUCCESS: Power Query actualizado correctamente"
WScript.Quit 0
`;

    // Escribir archivo VBS
    fs.writeFile(vbsPath, vbsScript, { encoding: 'utf8' }, (err) => {
      if (err) {
        sendLog(`[EXCEL COM] Error al crear VBS: ${err.message}`, 'ERROR');
        reject(new Error('No se pudo crear script temporal'));
        return;
      }

      // Ejecutar VBScript con cscript, pasando la ruta como argumento
      const vbsProcess = spawn('cscript.exe', [vbsPath, '//Nologo', filePath]);
      
      let output = '';
      let errorOutput = '';

      vbsProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        sendLog(`[EXCEL COM] STDOUT: ${text.trim()}`, 'INFO');
      });

      vbsProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        sendLog(`[EXCEL COM] STDERR: ${text.trim()}`, 'ERROR');
      });

      vbsProcess.on('close', (code) => {
        // Limpiar archivo temporal
        try {
          fs.unlinkSync(vbsPath);
        } catch (e) {
          // Ignorar error al limpiar
        }

        if (code === 0 || output.includes('SUCCESS')) {
          sendLog(`[EXCEL COM] Actualización completada exitosamente`, 'INFO');
          resolve({ success: true, message: 'Power Query actualizado correctamente' });
        } else {
          sendLog(`[EXCEL COM] Error en actualización (código ${code}): ${errorOutput || output}`, 'ERROR');
          reject(new Error(`Error al actualizar Excel: ${errorOutput || output || 'Código de error: ' + code}`));
        }
      });

      vbsProcess.on('error', (err) => {
        sendLog(`[EXCEL COM] Error al ejecutar VBScript: ${err.message}`, 'ERROR');
        reject(new Error(`No se pudo ejecutar VBScript: ${err.message}`));
      });
    });
  });
}

// ============================================================================
// INDUCCIONES - Verificar cambios en el archivo (para sincronización)
// ============================================================================
ipcMain.handle('check-inducciones-changes', async (event, companyName, lastKnownHash) => {
  sendLog(`[MAIN] Verificando cambios en inducciones para: ${companyName}`, 'INFO');
  try {
    const rootPath = await getCompanyRootPath(companyName);
    if (!rootPath) {
      return { success: false, error: 'Empresa no encontrada' };
    }

    const recursosPath = path.join(rootPath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.1 Inducción y Reinducción');

    sendLog(`[MAIN] Buscando carpeta inducciones en: ${recursosPath}`, 'DEBUG');

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] Ruta estándar no existe, buscando alternativas...`, 'DEBUG');
      if (fs.existsSync(recursosPath)) {
        const subs = await fsp.readdir(recursosPath);
        sendLog(`[MAIN] Subcarpetas encontradas: ${subs.join(', ')}`, 'DEBUG');
        
        // Normalizar nombres (quitar tildes) para comparación
        const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // PRIORIDAD 1: Buscar carpeta que contenga "induccion" o "reinduccion" (con o sin tildes)
        const indFolder = subs.find(s => {
          const norm = normalize(s);
          return norm.includes('induccion') || norm.includes('reinduccion');
        });
        
        // PRIORIDAD 2: Si no, buscar carpeta 1.1 o 1.2 que contenga "induccion"
        const indFolderNumeric = subs.find(s => {
          const norm = normalize(s);
          return (s.startsWith('1.1') || s.startsWith('1.2')) && norm.includes('induccion');
        });
        
        // PRIORIDAD 3: Si no, buscar cualquier carpeta 1.1
        const fallbackFolder = subs.find(s => s.includes('1.1') || normalize(s).includes('inducci'));
        
        const finalFolder = indFolder || indFolderNumeric || fallbackFolder;
        
        sendLog(`[MAIN] Carpeta de inducciones encontrada: ${finalFolder || 'NINGUNA'}`, 'DEBUG');
        if (finalFolder) targetPath = path.join(recursosPath, finalFolder);
      }
    }

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] ERROR: No se encontró carpeta de inducciones. Ruta buscada: ${targetPath}`, 'ERROR');
      return { success: false, error: 'Carpeta de inducciones no encontrada' };
    }

    const files = await fsp.readdir(targetPath);
    sendLog(`[MAIN] Archivos en carpeta inducciones: ${files.join(', ')}`, 'DEBUG');
    
    // Buscar archivo Excel de inducciones con múltiples variaciones
    const excelFile = files.find(f => {
        if (!f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls'))) {
            const lowerName = f.toLowerCase();
            // Buscar variaciones: inducción, induccion, inducciones, fo-046, 046
            return lowerName.includes('inducción') ||
                   lowerName.includes('Inducción') ||
                   lowerName.includes('Induccion') ||
                   lowerName.includes('induccion') || 
                   lowerName.includes('inducciones') ||
                   lowerName.includes('fo-046') || 
                   lowerName.includes('fo_046') ||
                   lowerName.includes('Registro');
        }
        return false;
    });
    
    sendLog(`[MAIN] Archivo Excel encontrado: ${excelFile || 'NINGUNO'}`, 'DEBUG');

    if (!excelFile) {
      return { success: false, error: 'Archivo Excel de inducciones no encontrado' };
    }

    const filePath = path.join(targetPath, excelFile);
    
    // Obtener estadísticas del archivo para detectar cambios
    const stats = await fsp.stat(filePath);
    const currentHash = `${stats.size}-${stats.mtimeMs}`;
    
    // Si no hay hash conocido, retornar solo información del archivo
    if (!lastKnownHash) {
      return { 
        success: true, 
        hasChanges: false, 
        currentHash,
        lastModified: stats.mtime,
        filePath 
      };
    }

    // Comparar hashes
    const hasChanges = currentHash !== lastKnownHash;
    
    if (!hasChanges) {
      return { 
        success: true, 
        hasChanges: false, 
        currentHash,
        lastModified: stats.mtime,
        filePath 
      };
    }

    // Si hay cambios, contar registros totales
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1 });
    
    let totalRecords = 0;
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;
        const empleado = row[6] ? String(row[6]).trim() : '';
        if (!empleado || empleado === 'Nombre del empleado' || empleado === '') continue;
        if (empleado.toLowerCase().includes('total inducciones')) break;
        
        // Saltar fila de encabezados (puede variar entre empresas)
        const lowerRow = row.join(' ').toLowerCase();
        if (lowerRow.includes('fecha de ingreso') || 
            lowerRow.includes('nombre completo') || 
            lowerRow.includes('cedula') || 
            lowerRow.includes('cargo') ||
            lowerRow.includes('fecha') && lowerRow.includes('empleado')) {
            continue;
        }
        
        totalRecords++;
    }

    return { 
      success: true, 
      hasChanges: true, 
      currentHash,
      lastModified: stats.mtime,
      filePath,
      totalRecords 
    };
  } catch (error) {
    sendLog(`[MAIN] Error en check-inducciones-changes: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// ============================================================================
// INDUCCIONES - Sincronizar desde Forms (Actualizar Excel + Recargar datos)
// ============================================================================
ipcMain.handle('sync-inducciones-from-forms', async (event, companyName) => {
  sendLog(`[MAIN] Sincronizando inducciones desde Forms para: ${companyName}`, 'INFO');
  try {
    const rootPath = await getCompanyRootPath(companyName);
    if (!rootPath) {
      return { success: false, error: 'Empresa no encontrada' };
    }

    const recursosPath = path.join(rootPath, '1. Recursos');
    let targetPath = path.join(recursosPath, '1.1 Inducción y Reinducción');

    sendLog(`[MAIN] Buscando carpeta inducciones en: ${recursosPath}`, 'DEBUG');

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] Ruta estándar no existe, buscando alternativas...`, 'DEBUG');
      if (fs.existsSync(recursosPath)) {
        const subs = await fsp.readdir(recursosPath);
        sendLog(`[MAIN] Subcarpetas encontradas: ${subs.join(', ')}`, 'DEBUG');
        
        // Normalizar nombres (quitar tildes) para comparación
        const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // PRIORIDAD 1: Buscar carpeta que contenga "induccion" o "reinduccion" (con o sin tildes)
        const indFolder = subs.find(s => {
          const norm = normalize(s);
          return norm.includes('induccion') || norm.includes('reinduccion');
        });
        
        // PRIORIDAD 2: Si no, buscar carpeta 1.1 o 1.2 que contenga "induccion"
        const indFolderNumeric = subs.find(s => {
          const norm = normalize(s);
          return (s.startsWith('1.1') || s.startsWith('1.2')) && norm.includes('induccion');
        });
        
        // PRIORIDAD 3: Si no, buscar cualquier carpeta 1.1
        const fallbackFolder = subs.find(s => s.includes('1.1') || normalize(s).includes('inducci'));
        
        const finalFolder = indFolder || indFolderNumeric || fallbackFolder;
        
        sendLog(`[MAIN] Carpeta de inducciones encontrada: ${finalFolder || 'NINGUNA'}`, 'DEBUG');
        if (finalFolder) targetPath = path.join(recursosPath, finalFolder);
      }
    }

    if (!fs.existsSync(targetPath)) {
      sendLog(`[MAIN] ERROR: No se encontró carpeta de inducciones. Ruta buscada: ${targetPath}`, 'ERROR');
      return { success: false, error: 'Carpeta de inducciones no encontrada' };
    }

    const files = await fsp.readdir(targetPath);
    sendLog(`[MAIN] Archivos en carpeta inducciones: ${files.join(', ')}`, 'DEBUG');
    
    // Buscar archivo Excel de inducciones con múltiples variaciones
    const excelFile = files.find(f => {
        if (!f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls'))) {
            const lowerName = f.toLowerCase();
            // Buscar variaciones: inducción, induccion, inducciones, fo-046, 046
            return lowerName.includes('inducción') ||
                   lowerName.includes('Inducción') ||
                   lowerName.includes('Induccion') ||
                   lowerName.includes('induccion') || 
                   lowerName.includes('inducciones') ||
                   lowerName.includes('fo-046') || 
                   lowerName.includes('fo_046') ||
                   lowerName.includes('Registro');
        }
        return false;
    });
    
    sendLog(`[MAIN] Archivo Excel encontrado: ${excelFile || 'NINGUNO'}`, 'DEBUG');

    if (!excelFile) {
      return { success: false, error: 'Archivo Excel de inducciones no encontrado' };
    }

    const filePath = path.join(targetPath, excelFile);
    
    // Paso 1: Actualizar Power Query
    sendLog(`[MAIN] Actualizando Power Query en: ${filePath}`, 'INFO');
    await refreshExcelPowerQuery(filePath);
    
    // Esperar un momento para asegurar que el archivo se guardó
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Paso 2: Leer datos actualizados
    const wb = xlsx.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(ws, { header: 1 });

    const inducciones = [];
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row) continue;

        const empleado = row[6] ? String(row[6]).trim() : '';
        if (!empleado || empleado === 'Nombre del empleado' || empleado === '') continue;
        if (empleado.toLowerCase().includes('total inducciones')) break;

        let fecha = row[3];
        if (typeof fecha === 'number') {
            const dateCode = xlsx.SSF.parse_date_code(fecha);
            fecha = `${dateCode.y}-${String(dateCode.m).padStart(2, '0')}-${String(dateCode.d).padStart(2, '0')}`;
        } else if (fecha instanceof Date) {
            fecha = fecha.toISOString().split('T')[0];
        }

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

    // Obtener stats del archivo
    const stats = await fsp.stat(filePath);
    
    sendLog(`[MAIN] Sincronización completada: ${inducciones.length} registros`, 'INFO');
    
    return { 
      success: true, 
      data: inducciones, 
      filePath,
      currentHash: `${stats.size}-${stats.mtimeMs}`,
      lastModified: stats.mtime,
      message: `Se sincronizaron ${inducciones.length} registros desde Google Forms`
    };
  } catch (error) {
    sendLog(`[MAIN] Error en sync-inducciones-from-forms: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

ipcMain.on('restart_app', () => {
    log.info('[UPDATER] El usuario ha aceptado la actualización. Iniciando secuencia de reinicio...');

    // 1. Cerrar todas las ventanas abiertas para liberar recursos de UI/GPU
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        if (!win.isDestroyed()) {
            win.close();
        }
    });

    // 2. Limpiar procesos secundarios inmediatamente
    cleanupProcesses();

    // 3. Forzar el cierre de la aplicación para que el instalador pueda reemplazar archivos
    log.info('[UPDATER] Cerrando aplicación para instalación...', 'INFO');
    
    // IMPORTANTE: En Windows, quitAndInstall necesita que la app se cierre completamente
    // Los parámetros (true, true) significan:
    // - forceQuit: true  = Forzar el cierre de la aplicación
    // - autoInstall: true = Instalar automáticamente la actualización
    try {
        log.info('[UPDATER] Ejecutando autoUpdater.quitAndInstall(true, true)...', 'INFO');
        autoUpdater.quitAndInstall(true, true);
    } catch (err) {
        log.error(`[UPDATER] Error en quitAndInstall: ${err.message}`, 'ERROR');
        
        // Fallback: Salir manualmente y esperar que el instalador se ejecute
        log.info('[UPDATER] Intentando salida de emergencia...', 'WARN');
        
        // Cerrar todos los procesos de Python restantes
        if (process.platform === 'win32') {
            try {
                const { execSync } = require('child_process');
                execSync('taskkill /F /IM python.exe /T', { stdio: 'ignore' });
            } catch (e) {
                // Ignorar si no hay procesos Python
            }
        }
        
        // Salir de la aplicación
        app.quit();
    }
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

// ============================================================================
// FUNCIONES AUXILIARES PARA VERIFICACIÓN DE COPASST Y COMITÉ DE CONVIVENCIA
// ============================================================================

/**
 * Extrae el año más reciente desde nombres de archivos en una carpeta
 * @param {string} folderPath - Ruta de la carpeta a escanear
 * @param {string[]} filePatterns - Patrones de búsqueda (ej: ['ACTA DE CONSTITUCIÓN', 'ACTA DE ESCRUTINIO'])
 * @returns {number|null} - Año encontrado o null si no hay archivos
 */
function extractLatestYearFromFiles(folderPath, filePatterns) {
  try {
    if (!fs.existsSync(folderPath)) return null;
    
    const archivos = fs.readdirSync(folderPath);
    const years = [];
    
    for (const archivo of archivos) {
      const upperName = archivo.toUpperCase();
      // Verificar si coincide con algún patrón
      const matchesPattern = filePatterns.some(pattern => 
        upperName.includes(pattern.toUpperCase())
      );
      
      if (matchesPattern) {
        // Extraer año del nombre (ej: "ACTA 2022" o "CONSTITUCIÓN 2 .doc" -> 2022)
        const yearMatch = archivo.match(/(20\d{2}|202\d)/);
        if (yearMatch) {
          years.push(parseInt(yearMatch[1]));
        }
      }
    }
    
    return years.length > 0 ? Math.max(...years) : null;
  } catch (e) {
    console.error(`Error extrayendo año desde ${folderPath}:`, e.message);
    return null;
  }
}

/**
 * Extrae el mes desde un nombre de archivo de acta
 * @param {string} fileName - Nombre del archivo
 * @returns {string|null} - Nombre del mes en español o null
 */
function extractMonthFromFileName(fileName) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const upperName = fileName.toUpperCase();
  for (const month of months) {
    if (upperName.includes(month.toUpperCase())) {
      return month;
    }
  }
  return null;
}

/**
 * Obtiene las actas encontradas en una carpeta de año específico
 * @param {string} folderPath - Ruta de la carpeta (ej: COPASST 2025)
 * @returns {Array<{fileName: string, month: string}>} - Lista de actas con mes
 */
function getActasInYearFolder(folderPath) {
  const result = [];
  try {
    if (!fs.existsSync(folderPath)) return result;

    const archivos = fs.readdirSync(folderPath);
    for (const archivo of archivos) {
      if (archivo.startsWith('~$')) continue; // Saltar archivos temporales

      const month = extractMonthFromFileName(archivo);
      if (month) {
        result.push({ fileName: archivo, month: month });
      }
    }
  } catch (e) {
    console.error(`Error leyendo actas en ${folderPath}:`, e.message);
  }
  return result;
}

/**
 * Convierte nombre de mes a número (1-12)
 * @param {string} monthName - "Enero", "Febrero", etc.
 * @returns {number} - 1, 2, 3...12
 */
function monthToNumber(monthName) {
  const months = {
    'Enero': 1, 'Febrero': 2, 'Marzo': 3, 'Abril': 4,
    'Mayo': 5, 'Junio': 6, 'Julio': 7, 'Agosto': 8,
    'Septiembre': 9, 'Octubre': 10, 'Noviembre': 11, 'Diciembre': 12
  };
  return months[monthName] || 0;
}

/**
 * Convierte número de mes a nombre
 * @param {number} monthNumber - 1, 2, 3...12
 * @returns {string} - "Enero", "Febrero", etc.
 */
function numberToMonth(monthNumber) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[monthNumber - 1] || '';
}

/**
 * Obtiene actas con fecha de modificación para verificar registro real
 * @param {string} folderPath - Ruta de la carpeta (ej: COPASST 2025)
 * @returns {Array<{fileName: string, month: string, monthNumber: number, modified: Date}>}
 */
function getActasWithModificationDate(folderPath) {
  const result = [];
  try {
    if (!fs.existsSync(folderPath)) return result;

    const archivos = fs.readdirSync(folderPath);
    for (const archivo of archivos) {
      if (archivo.startsWith('~$')) continue; // Saltar archivos temporales

      const month = extractMonthFromFileName(archivo);
      if (month) {
        const filePath = path.join(folderPath, archivo);
        const stats = fs.statSync(filePath);
        result.push({
          fileName: archivo,
          month: month,
          monthNumber: monthToNumber(month),
          modified: stats.mtime
        });
      }
    }
  } catch (e) {
    console.error(`Error leyendo actas con fecha en ${folderPath}:`, e.message);
  }
  return result;
}

/**
 * Obtiene actas por nombre de archivo (sin considerar fecha de modificación)
 * @param {string} folderPath - Ruta de la carpeta (ej: COPASST 2025)
 * @returns {Array<{fileName: string, month: string, monthNumber: number}>}
 */
function getActasByFileName(folderPath) {
  const result = [];
  try {
    if (!fs.existsSync(folderPath)) return result;

    const archivos = fs.readdirSync(folderPath);
    for (const archivo of archivos) {
      if (archivo.startsWith('~$')) continue; // Saltar archivos temporales

      const month = extractMonthFromFileName(archivo);
      if (month) {
        result.push({
          fileName: archivo,
          month: month,
          monthNumber: monthToNumber(month)
        });
      }
    }
  } catch (e) {
    console.error(`Error leyendo actas por nombre en ${folderPath}:`, e.message);
  }
  return result;
}

/**
 * Verifica el período vigente de un comité (COPASST o Convivencia)
 * @param {string} constitucionPath - Ruta de la carpeta Constitución
 * @param {string} committeeName - Nombre para logs ('COPASST' o 'COMITÉ CONVIVENCIA')
 * @returns {{vigente: boolean, yearUltima: number|null, anosTranscurridos: number, porVencer: boolean}}
 */
function verifyCommitteePeriod(constitucionPath, committeeName) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // Buscar actas de elección/constitución más recientes
  const filePatterns = [
    'ACTA DE ESCRUTINIO',
    'ACTA DE VOTACION',
    'ACTA DE CONSTITUCIÓN',
    'ACTA DE CONSTITUCION'
  ];

  const latestYear = extractLatestYearFromFiles(constitucionPath, filePatterns);

  if (!latestYear) {
    return {
      vigente: false,
      yearUltima: null,
      anosTranscurridos: 999,
      porVencer: false,
      message: `No se encontró acta de elección/constitución de ${committeeName}`
    };
  }

  const endYear = latestYear + 2;  // El período termina en diciembre de endYear
  const endMonth = 12;  // Diciembre
  
  // Vigente si: año actual < endYear O (año actual == endYear Y mes <= diciembre)
  const vigente = (currentYear < endYear) || 
                  (currentYear === endYear && currentMonth <= endMonth);
  
  const anosTranscurridos = currentYear - latestYear;
  
  // Por vencer: alerta temprana cuando faltan 3 meses o menos para terminar el período
  const mesesRestantes = (endYear - currentYear) * 12 + (endMonth - currentMonth);
  const porVencer = mesesRestantes <= 3 && mesesRestantes > 0;

  return {
    vigente,
    yearUltima: latestYear,
    anosTranscurridos,
    porVencer,
    message: `Período ${latestYear}-${latestYear + 2}`
  };
}

/**
 * Verifica reuniones mensuales de COPASST usando nombre de archivo
 * @param {string} basePath - Ruta base (1.1.6 Conformación de Copasst)
 * @param {number} year - Año a verificar
 * @returns {{cumple: boolean, ultimoMes: string|null, ultimoMesNumero: number, mesesFaltantes: string[], message: string}}
 */
function verifyCOPASSTMeetings(basePath, year) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();

  // Buscar carpetas del año actual y año anterior
  const yearFolder = path.join(basePath, `COPASST ${year}`);
  const prevYearFolder = path.join(basePath, `COPASST ${year - 1}`);

  // Obtener actas por nombre de archivo (NO por fecha de modificación)
  const actasYear = getActasByFileName(yearFolder);
  const actasPrevYear = getActasByFileName(prevYearFolder);

  // Combinar todas las actas encontradas y ordenar por año y mes
  const allActas = [
    ...actasPrevYear.map(a => ({ ...a, year: year - 1 })),
    ...actasYear.map(a => ({ ...a, year: year }))
  ];

  // Ordenar por año y luego por mes (descendente para obtener el último primero)
  allActas.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.monthNumber - a.monthNumber;
  });

  // Obtener último mes registrado
  const ultimoActa = allActas[0];
  const ultimoMesRegistrado = ultimoActa?.monthNumber || 0;
  const ultimoMesNombre = ultimoActa?.month || null;
  const ultimoMesYear = ultimoActa?.year || year - 1;

  // Calcular meses faltantes desde el último registrado hasta el mes actual
  let mesesFaltantes = [];
  
  if (ultimoMesYear === year - 1) {
    // El último acta es del año anterior, faltan todos los meses de Enero hasta el mes actual
    for (let m = 1; m <= currentMonth; m++) {
      mesesFaltantes.push(numberToMonth(m));
    }
  } else {
    // El último acta es del año actual, faltan desde el mes siguiente hasta el mes actual
    for (let m = ultimoMesRegistrado + 1; m <= currentMonth; m++) {
      mesesFaltantes.push(numberToMonth(m));
    }
  }

  const cumple = mesesFaltantes.length === 0;

  return {
    cumple,
    ultimoMes: ultimoMesNombre,
    ultimoMesNumero: ultimoMesRegistrado,
    mesesFaltantes,
    message: cumple
      ? `Reuniones al día (última: ${ultimoMesNombre} ${ultimoMesYear})`
      : `Sin reunión desde ${ultimoMesNombre || 'Ninguna'} ${ultimoMesYear}`
  };
}

/**
 * Verifica reuniones mensuales del Comité de Convivencia usando nombre de archivo
 * @param {string} basePath - Ruta base (1.1.8 Conformación de Comite de Convivencia)
 * @param {number} year - Año a verificar
 * @returns {{cumple: boolean, ultimoMes: string|null, ultimoMesNumero: number, mesesFaltantes: string[], ultimoMesYear: number, message: string}}
 */
function verifyConvivenciaMeetings(basePath, year) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentYear = currentDate.getFullYear();

  // Buscar carpetas del año actual y año anterior
  const yearFolder = path.join(basePath, `CONVIVENCIA ${year}`);
  const prevYearFolder = path.join(basePath, `CONVIVENCIA ${year - 1}`);

  // Obtener actas por nombre de archivo (NO por fecha de modificación)
  const actasYear = getActasByFileName(yearFolder);
  const actasPrevYear = getActasByFileName(prevYearFolder);

  // Combinar todas las actas encontradas y ordenar por año y mes
  const allActas = [
    ...actasPrevYear.map(a => ({ ...a, year: year - 1 })),
    ...actasYear.map(a => ({ ...a, year: year }))
  ];

  // Ordenar por año y luego por mes (descendente para obtener el último primero)
  allActas.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.monthNumber - a.monthNumber;
  });

  // Obtener último mes registrado
  const ultimoActa = allActas[0];
  const ultimoMesRegistrado = ultimoActa?.monthNumber || 0;
  const ultimoMesNombre = ultimoActa?.month || null;
  const ultimoMesYear = ultimoActa?.year || year - 1;

  // Calcular meses faltantes desde el último registrado hasta el mes actual
  let mesesFaltantes = [];
  
  if (ultimoMesYear === year - 1) {
    // El último acta es del año anterior, faltan todos los meses de Enero hasta el mes actual
    for (let m = 1; m <= currentMonth; m++) {
      mesesFaltantes.push(numberToMonth(m));
    }
  } else {
    // El último acta es del año actual, faltan desde el mes siguiente hasta el mes actual
    for (let m = ultimoMesRegistrado + 1; m <= currentMonth; m++) {
      mesesFaltantes.push(numberToMonth(m));
    }
  }

  const cumple = mesesFaltantes.length === 0;

  return {
    cumple,
    ultimoMes: ultimoMesNombre,
    ultimoMesNumero: ultimoMesRegistrado,
    mesesFaltantes,
    ultimoMesYear,
    message: cumple
      ? `Reuniones al día (última: ${ultimoMesNombre} ${ultimoMesYear})`
      : `Sin reunión desde ${ultimoMesNombre || 'Ninguna'} ${ultimoMesYear}`
  };
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
        if (nombre.toLowerCase().trim() === 'total') break;

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

async function calculateInduccionesStats(basePath, companyName) {
  const currentYear = new Date().getFullYear();
  const stats = {
    totalTrabajadores: 0,        // ← NUEVO: Total de trabajadores de la empresa
    totalInducciones: 0,         // Inducciones detectadas en Excel
    completadas: 0,              // Inducciones completadas (año actual)
    pendientes: 0,               // ← CAMBIA: Ahora es employees - completadas
    porcentajeCompletado: 0,     // ← CAMBIA: (completadas / employees) * 100
    mensual: new Array(12).fill(0),
    ultimoMesRegistrado: null    // ← NUEVO: Último mes con inducción completada
  };
  try {
    // ========================================================================
    // 1. LEER NÚMERO DE TRABAJADORES DESDE CONFIG
    // ========================================================================
    if (companyName) {
      try {
        const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
        const config = JSON.parse(configData);
        const employees = config.companyPaths?.[companyName]?.stats?.employees || 0;
        stats.totalTrabajadores = employees;
        sendLog(`[DEBUG] calculateInduccionesStats - ${companyName}: ${employees} trabajadores`, 'DEBUG');
      } catch (configError) {
        sendLog(`[WARN] Error leyendo config para ${companyName}: ${configError.message}`, 'WARN');
      }
    }

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

    // Track del último mes registrado
    let ultimoMesIndex = -1;
    let ultimoMesRegistrado = null;

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

                    // Track del último mes encontrado (considerando año + mes)
                    if (rowDate) {
                        const monthIndex = rowDate.getMonth();
                        const fileYear = rowDate.getFullYear();
                        const fechaInduccion = new Date(fileYear, monthIndex);
                        
                        // Comparar con la última fecha registrada
                        if (!ultimoMesRegistrado || fechaInduccion > ultimoMesRegistrado.date) {
                            const mesCorto = rowDate.toLocaleString('es-ES', { month: 'short' }); // "feb", "mar", etc.
                            ultimoMesRegistrado = {
                                date: fechaInduccion,
                                display: `${mesCorto} ${fileYear}`
                            };
                        }
                    }
                }
            }
        } catch (err) { continue; }
    }

    // Asignar último mes registrado
    stats.ultimoMesRegistrado = ultimoMesRegistrado ? ultimoMesRegistrado.display : null;

    // ========================================================================
    // 2. CALCULAR PENDIENTES Y PORCENTAJE REAL BASADO EN TRABAJADORES
    // ========================================================================
    // Convertir mensual a acumulado para el gráfico de tendencia
    let cumulative = 0;
    const trendData = [...stats.mensual];
    for (let i = 0; i < 12; i++) {
        cumulative += trendData[i];
        stats.mensual[i] = cumulative;
    }

    // Calcular pendientes: trabajadores que NO han recibido inducción
    stats.pendientes = Math.max(0, stats.totalTrabajadores - stats.completadas);

    // Calcular porcentaje REAL: (completadas / totalTrabajadores) * 100
    if (stats.totalTrabajadores > 0) {
        stats.porcentajeCompletado = Math.round((stats.completadas / stats.totalTrabajadores) * 100);
    } else {
        // Fallback: si no hay empleados configurados, usar lógica antigua
        stats.porcentajeCompletado = stats.totalInducciones > 0 ? 100 : 0;
    }

    sendLog(`[DEBUG] calculateInduccionesStats - Completadas: ${stats.completadas}, Pendientes: ${stats.pendientes}, Porcentaje: ${stats.porcentajeCompletado}%, Último: ${stats.ultimoMesRegistrado || 'N/A'}`, 'DEBUG');

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

/**
 * Calcula estadísticas de Actas de Reunión COPASST
 * Similar a calculateAfiliacionStats - Detecta actas del mes en curso
 * @param {string} basePath - Ruta raíz de la empresa
 * @param {number} currentYear - Año actual
 * @returns {Promise<Object>} Stats de actas COPASST
 */
async function calculateCopasstStats(basePath, currentYear) {
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const currentMonthName = monthNames[currentMonth];

  const stats = {
    totalActas: 0,
    actaMesEnCurso: false,
    ultimoMesRegistrado: null,
    actasAnio: 0,
    estado: 'ok', // 'ok', 'warning', 'danger'
    alertas: []
  };

  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    const copasstPath = path.join(recursosPath, '1.1.6 Conformación de Copasst');

    if (!fs.existsSync(copasstPath)) {
      sendLog(`[COPASST] Carpeta no encontrada: ${copasstPath}`, 'WARN');
      return stats;
    }

    // Buscar carpetas de años (COPASST 2024, COPASST 2025, etc.)
    const yearFolders = await fsp.readdir(copasstPath);
    let allActas = [];
    let ultimaFechaRegistro = null; // { date: Date, display: "dic 2024" }

    for (const folder of yearFolders) {
      if (!folder.startsWith('COPASST')) continue;

      const folderPath = path.join(copasstPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      // Extraer año del nombre de la carpeta
      const yearMatch = folder.match(/(\d{4})/);
      if (!yearMatch) continue;

      const folderYear = parseInt(yearMatch[1]);
      const files = await fsp.readdir(folderPath);

      // Buscar archivos de actas (Excel)
      const actasFiles = files.filter(f =>
        !f.startsWith('~$') &&
        f.endsWith('.xlsx') &&
        f.toLowerCase().includes('acta') &&
        f.toLowerCase().includes('copasst')
      );

      sendLog(`[COPASST] Carpeta ${folder}: ${actasFiles.length} actas encontradas`, 'INFO');

      for (const file of actasFiles) {
        const fileName = file.toLowerCase();
        sendLog(`[COPASST] Analizando archivo: ${file}`, 'DEBUG');

        // Buscar patrones de mes en el nombre del archivo
        const monthMatch = fileName.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
        if (monthMatch) {
          const mesEncontrado = monthMatch[1];
          const monthIndex = monthNames.indexOf(mesEncontrado);

          sendLog(`[COPASST] Archivo: ${file}, Mes encontrado: ${mesEncontrado}`, 'DEBUG');

          allActas.push({
            year: folderYear,
            month: mesEncontrado,
            monthNumber: monthIndex + 1,
            file: file
          });

          // Verificar si es el mes en curso
          if (mesEncontrado === currentMonthName && folderYear === currentYear) {
            stats.actaMesEnCurso = true;
            sendLog(`[COPASST] ✅ Acta del mes en curso encontrada: ${file}`, 'INFO');
          }

          // Track del último mes encontrado (considerando año + mes)
          const fechaActa = new Date(folderYear, monthIndex);
          if (!ultimaFechaRegistro || fechaActa > ultimaFechaRegistro.date) {
            const mesCorto = mesEncontrado.substring(0, 3); // "dic", "feb", etc.
            stats.ultimoMesRegistrado = `${mesCorto} ${folderYear}`;
            ultimaFechaRegistro = { date: fechaActa, display: stats.ultimoMesRegistrado };
          }
        }
      }
    }

    stats.totalActas = allActas.length;
    sendLog(`[COPASST] Total actas encontradas: ${allActas.length}`, 'INFO');

    // Actas del año actual
    const actasCurrentYear = allActas.filter(a => a.year === currentYear);
    stats.actasAnio = actasCurrentYear.length;

    // Determinar estado y alertas
    if (!stats.actaMesEnCurso) {
      stats.estado = 'danger';
      const alerta = `No se encontró acta de ${currentMonthName} ${currentYear}`;
      stats.alertas.push(alerta);
      sendLog(`[COPASST] ⚠️ ALERTA: ${alerta}`, 'WARN');

      if (stats.ultimoMesRegistrado) {
        const alertaExtra = `Última acta registrada: ${stats.ultimoMesRegistrado}`;
        stats.alertas.push(alertaExtra);
        sendLog(`[COPASST] ℹ️ Info: ${alertaExtra}`, 'INFO');
      }
    } else {
      sendLog(`[COPASST] ✅ Actas COPASST al día`, 'INFO');
    }

    sendLog(`[COPASST] Acta mes en curso (${currentMonthName}): ${stats.actaMesEnCurso ? 'Sí' : 'No'}`, 'INFO');
    sendLog(`[COPASST] Último mes registrado: ${stats.ultimoMesRegistrado || 'N/A'}`, 'INFO');

  } catch (e) {
    sendLog(`[COPASST] Error: ${e.message}`, 'ERROR');
  }

  return stats;
}

/**
 * Calcula estadísticas de Actas de Reunión Comité de Convivencia
 * Similar a calculateCopasstStats - Detecta actas del mes en curso
 * @param {string} basePath - Ruta raíz de la empresa
 * @param {number} currentYear - Año actual
 * @returns {Promise<Object>} Stats de actas Comité de Convivencia
 */
async function calculateConvivenciaStats(basePath, currentYear) {
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const currentMonthName = monthNames[currentMonth];

  const stats = {
    totalActas: 0,
    actaMesEnCurso: false,
    ultimoMesRegistrado: null,
    actasAnio: 0,
    estado: 'ok', // 'ok', 'warning', 'danger'
    alertas: []
  };

  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    
    // Buscar ambas variaciones del nombre de la carpeta
    const convivenciaPath1 = path.join(recursosPath, '1.1.8 Comité de Convivencia');
    const convivenciaPath2 = path.join(recursosPath, '1.1.8 Conformación de Comite de Convivencia');
    const convivenciaPath = fs.existsSync(convivenciaPath1) ? convivenciaPath1 : convivenciaPath2;

    if (!fs.existsSync(convivenciaPath)) {
      sendLog(`[COMITÉ CONVIVENCIA] Carpeta no encontrada: ${convivenciaPath}`, 'WARN');
      return stats;
    }

    // Buscar carpetas de años (CONVIVENCIA 2024, CONVIVENCIA 2025, etc.)
    const yearFolders = await fsp.readdir(convivenciaPath);
    let allActas = [];
    let ultimaFechaRegistro = null; // { date: Date, display: "dic 2024" }

    for (const folder of yearFolders) {
      if (!folder.startsWith('CONVIVENCIA')) continue;

      const folderPath = path.join(convivenciaPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      // Extraer año del nombre de la carpeta
      const yearMatch = folder.match(/(\d{4})/);
      if (!yearMatch) continue;

      const folderYear = parseInt(yearMatch[1]);
      const files = await fsp.readdir(folderPath);

      // Buscar archivos de actas (Excel o PDF)
      const actasFiles = files.filter(f =>
        !f.startsWith('~$') &&
        (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.pdf')) &&
        f.toLowerCase().includes('acta')
      );

      sendLog(`[COMITÉ CONVIVENCIA] Carpeta ${folder}: ${actasFiles.length} actas encontradas`, 'INFO');

      for (const file of actasFiles) {
        const fileName = file.toLowerCase();
        sendLog(`[COMITÉ CONVIVENCIA] Analizando archivo: ${file}`, 'DEBUG');

        // Buscar patrones de mes en el nombre del archivo
        const monthMatch = fileName.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
        if (monthMatch) {
          const mesEncontrado = monthMatch[1];
          const monthIndex = monthNames.indexOf(mesEncontrado);

          sendLog(`[COMITÉ CONVIVENCIA] Archivo: ${file}, Mes encontrado: ${mesEncontrado}`, 'DEBUG');

          allActas.push({
            year: folderYear,
            month: mesEncontrado,
            monthNumber: monthIndex + 1,
            file: file
          });

          // Verificar si es el mes en curso
          if (mesEncontrado === currentMonthName && folderYear === currentYear) {
            stats.actaMesEnCurso = true;
            sendLog(`[COMITÉ CONVIVENCIA] ✅ Acta del mes en curso encontrada: ${file}`, 'INFO');
          }

          // Track del último mes encontrado (considerando año + mes)
          const fechaActa = new Date(folderYear, monthIndex);
          if (!ultimaFechaRegistro || fechaActa > ultimaFechaRegistro.date) {
            const mesCorto = mesEncontrado.substring(0, 3); // "dic", "feb", etc.
            stats.ultimoMesRegistrado = `${mesCorto} ${folderYear}`;
            ultimaFechaRegistro = { date: fechaActa, display: stats.ultimoMesRegistrado };
          }
        }
      }
    }

    stats.totalActas = allActas.length;
    sendLog(`[COMITÉ CONVIVENCIA] Total actas encontradas: ${allActas.length}`, 'INFO');

    // Actas del año actual
    const actasCurrentYear = allActas.filter(a => a.year === currentYear);
    stats.actasAnio = actasCurrentYear.length;

    // Determinar estado y alertas
    if (!stats.actaMesEnCurso) {
      stats.estado = 'danger';
      const alerta = `No se encontró acta de ${currentMonthName} ${currentYear}`;
      stats.alertas.push(alerta);
      sendLog(`[COMITÉ CONVIVENCIA] ⚠️ ALERTA: ${alerta}`, 'WARN');

      if (stats.ultimoMesRegistrado) {
        const alertaExtra = `Última acta registrada: ${stats.ultimoMesRegistrado}`;
        stats.alertas.push(alertaExtra);
        sendLog(`[COMITÉ CONVIVENCIA] ℹ️ Info: ${alertaExtra}`, 'INFO');
      }
    } else {
      sendLog(`[COMITÉ CONVIVENCIA] ✅ Actas Comité de Convivencia al día`, 'INFO');
    }

    sendLog(`[COMITÉ CONVIVENCIA] Acta mes en curso (${currentMonthName}): ${stats.actaMesEnCurso ? 'Sí' : 'No'}`, 'INFO');
    sendLog(`[COMITÉ CONVIVENCIA] Último mes registrado: ${stats.ultimoMesRegistrado || 'N/A'}`, 'INFO');

  } catch (e) {
    sendLog(`[COMITÉ CONVIVENCIA] Error: ${e.message}`, 'ERROR');
  }

  return stats;
}

/**
 * Calcula estadísticas de Afiliación al SSSI
 * Verifica si existe planilla de afiliación del mes en curso
 * @param {string} basePath - Ruta raíz de la empresa
 * @param {string} companyName - Nombre de la empresa
 * @returns {Promise<Object>} Stats de afiliación
 */
async function calculateAfiliacionStats(basePath, companyName) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const currentMonthName = monthNames[currentMonth];

  const stats = {
    totalPlanillas: 0,
    planillaMesEnCurso: false,
    planillasAnio: 0,       // ← NUEVO: Planillas del año actual
    ultimoMesRegistrado: null,
    estado: 'ok', // 'ok', 'warning', 'danger'
    alertas: []
  };

  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    const targetPath = path.join(recursosPath, '1.1.4 Afiliación al SSSI');

    if (!fs.existsSync(targetPath)) {
      sendLog(`[Afiliación] Carpeta no encontrada: ${targetPath}`, 'WARN');
      return stats;
    }

    // Buscar archivos de planillas (PDF o Excel)
    const files = await fsp.readdir(targetPath);
    const planillas = files.filter(f =>
      !f.startsWith('~$') &&
      (f.endsWith('.pdf') || f.endsWith('.xlsx') || f.endsWith('.xls')) &&
      f.toLowerCase().includes('planilla')
    );

    stats.totalPlanillas = planillas.length;
    sendLog(`[Afiliación] Total planillas encontradas: ${planillas.length}`, 'INFO');

    // Verificar si existe planilla del mes en curso
    let planillaEncontrada = false;
    let ultimaFechaRegistro = null; // { date: Date, display: "dic 2024" }
    let planillasCurrentYear = 0;

    planillas.forEach(f => {
      const fileName = f.toLowerCase();
      sendLog(`[Afiliación] Analizando archivo: ${f}`, 'DEBUG');

      // Buscar patrones de mes en el nombre del archivo
      const monthMatch = fileName.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
      if (monthMatch) {
        const mesEncontrado = monthMatch[1];
        const monthIndex = monthNames.indexOf(mesEncontrado);

        sendLog(`[Afiliación] Archivo: ${f}, Mes encontrado: ${mesEncontrado}`, 'DEBUG');

        // Verificar si es el mes en curso
        if (mesEncontrado === currentMonthName) {
          planillaEncontrada = true;
          sendLog(`[Afiliación] ✅ Planilla del mes en curso encontrada: ${f}`, 'INFO');
        }

        // Track del último mes encontrado (considerando año + mes)
        // Extraer año del nombre del archivo o usar año actual por defecto
        const yearMatch = f.match(/(20\d{2})/);
        const fileYear = yearMatch ? parseInt(yearMatch[1]) : currentYear;
        
        const fechaPlanilla = new Date(fileYear, monthIndex);
        if (!ultimaFechaRegistro || fechaPlanilla > ultimaFechaRegistro.date) {
          const mesCorto = mesEncontrado.substring(0, 3); // "dic", "feb", etc.
          stats.ultimoMesRegistrado = `${mesCorto} ${fileYear}`;
          ultimaFechaRegistro = { date: fechaPlanilla, display: stats.ultimoMesRegistrado };
        }

        // Contar planillas del año actual
        if (fileYear === currentYear) {
          planillasCurrentYear++;
        }
      }
    });

    stats.planillaMesEnCurso = planillaEncontrada;
    stats.planillasAnio = planillasCurrentYear; // ← NUEVO: Planillas del año actual

    sendLog(`[Afiliación] Planilla mes en curso (${currentMonthName}): ${planillaEncontrada ? 'Sí' : 'No'}`, 'INFO');
    sendLog(`[Afiliación] Último mes registrado: ${stats.ultimoMesRegistrado || 'N/A'}`, 'INFO');
    sendLog(`[Afiliación] Planillas año ${currentYear}: ${planillasCurrentYear}`, 'INFO');

    // Determinar estado y alertas
    if (!planillaEncontrada) {
      stats.estado = 'danger';
      const alerta = `No se encontró planilla de ${currentMonthName} ${currentYear}`;
      stats.alertas.push(alerta);
      sendLog(`[Afiliación] ⚠️ ALERTA: ${alerta}`, 'WARN');

      if (stats.ultimoMesRegistrado) {
        const alertaExtra = `Última planilla registrada: ${stats.ultimoMesRegistrado}`;
        stats.alertas.push(alertaExtra);
        sendLog(`[Afiliación] ℹ️ Info: ${alertaExtra}`, 'INFO');
      }
    } else {
      sendLog(`[Afiliación] ✅ Afiliación al día`, 'INFO');
    }

  } catch (error) {
    sendLog(`[Afiliación] Error: ${error.message}`, 'ERROR');
  }

  return stats;
}

/**
 * Calcula estadísticas del Presupuesto
 * @param {string} basePath - Ruta raíz de la empresa
 * @param {string} companyName - Nombre de la empresa
 * @returns {Promise<Object>} Stats de presupuesto
 */
async function calculatePresupuestoStats(basePath, companyName) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  
  const stats = {
    totalAsignado: 0,
    totalEjecutado: 0,
    porcentajeEjecucion: 0,
    saldoDisponible: 0,
    estado: 'ok', // 'ok', 'warning', 'danger'
    alertas: [],
    ejecucionMensual: {
      programada: new Array(12).fill(0),
      ejecutada: new Array(12).fill(0)
    },
    mesesConSobreEjecucion: [],
    desviacionSignificativa: false
  };

  try {
    if (!basePath) return stats;

    const recursosPath = path.join(basePath, '1. Recursos');
    
    // Buscar carpeta de Presupuesto en múltiples ubicaciones posibles
    let targetPath = null;
    const possiblePaths = [
      '1.4 Presupuesto',
      '1.1.3 Asignación de Recursos',
      '1.1.3 Asignacion de Recursos',
      '1.3 Presupuesto',
      'Presupuesto',
      'Asignación de Recursos',
      'Asignacion de Recursos'
    ];
    
    if (fs.existsSync(recursosPath)) {
      const subs = await fsp.readdir(recursosPath);
      
      // Intentar encontrar alguna de las carpetas conocidas
      for (const possiblePath of possiblePaths) {
        const found = subs.find(s => 
          s.includes(possiblePath.split(' ')[0]) && // Coincide por el código numérico o primera palabra
          (s.toLowerCase().includes('presupuesto') || 
           s.toLowerCase().includes('asignacion') ||
           s.toLowerCase().includes('asignación') ||
           s.toLowerCase().includes('recursos'))
        );
        if (found) {
          targetPath = path.join(recursosPath, found);
          sendLog(`[Presupuesto] Carpeta encontrada: ${found}`, 'INFO');
          break;
        }
      }
      
      // Si no se encontró por nombre exacto, buscar cualquier carpeta que contenga "presupuesto" o "asignacion"
      if (!targetPath) {
        const budgetFolder = subs.find(s => 
          s.toLowerCase().includes('presupuesto') || 
          s.toLowerCase().includes('asignacion') ||
          s.toLowerCase().includes('asignación')
        );
        if (budgetFolder) {
          targetPath = path.join(recursosPath, budgetFolder);
          sendLog(`[Presupuesto] Carpeta encontrada por búsqueda flexible: ${budgetFolder}`, 'INFO');
        }
      }
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
      sendLog(`[Presupuesto] Carpeta no encontrada. Rutas intentadas: ${possiblePaths.join(', ')}`, 'WARN');
      return stats;
    }

    // Buscar archivo Excel del año actual con búsqueda flexible
    const files = await fsp.readdir(targetPath);
    
    // Estrategia 1: Buscar archivo con el año actual
    let budgetFile = files.find(f => 
      !f.startsWith('~$') && 
      (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
      f.includes(currentYear.toString())
    );
    
    // Estrategia 2: Si no hay del año actual, buscar el más reciente
    if (!budgetFile) {
      const yearPattern = /(20\d{2})/g;
      const filesWithYear = files
        .filter(f => !f.startsWith('~$') && (f.endsWith('.xlsx') || f.endsWith('.xls')))
        .map(f => {
          const match = f.match(yearPattern);
          return { file: f, year: match ? parseInt(match[match.length - 1]) : 0 };
        })
        .filter(f => f.year > 0)
        .sort((a, b) => b.year - a.year);
      
      if (filesWithYear.length > 0) {
        budgetFile = filesWithYear[0].file;
        sendLog(`[Presupuesto] Usando archivo del año ${filesWithYear[0].year} (más reciente)`, 'INFO');
      }
    }
    
    // Estrategia 3: Tomar cualquier Excel que contenga "presupuesto" o "ACT-FO-043"
    if (!budgetFile) {
      budgetFile = files.find(f => 
        !f.startsWith('~$') && 
        (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
        (f.toLowerCase().includes('presupuesto') || f.includes('ACT-FO-043'))
      );
    }

    if (!budgetFile) {
      sendLog(`[Presupuesto] No se encontró archivo de presupuesto en: ${targetPath}`, 'WARN');
      return stats;
    }

    sendLog(`[Presupuesto] Leyendo archivo: ${budgetFile}`, 'INFO');

    // Leer Excel
    const workbook = xlsx.readFile(path.join(targetPath, budgetFile));
    
    // Buscar la hoja "PRESUPUESTO" o similar (igual que readPresupuestoData)
    let sheetName = workbook.SheetNames.find(s => 
      s.toUpperCase().includes('PRESUPUESTO') || s.toUpperCase().includes('PRESUP')
    );
    if (!sheetName) {
      sheetName = workbook.SheetNames[0]; // Fallback a primera hoja
    }
    sendLog(`[Presupuesto] Hoja seleccionada: ${sheetName}`, 'INFO');
    
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) return stats;

    // Convertir a JSON
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Función para parsear valores monetarios (igual que recursos-home.js)
    const parseMoney = (value) => {
      if (!value) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'object' && value.value !== undefined) return value.value;
      if (typeof value === 'string') {
        // Limpiar formato: "$ 13,407,464" -> 13407464
        const clean = value.toString().replace(/\$/g, '').replace(/\s/g, '').replace(/,/g, '');
        return parseFloat(clean) || 0;
      }
      return 0;
    };

    // ESTRATEGIA: Sumar TODAS las filas individuales (igual que calculateBudgetSummary en recursos-home.js)
    // NO usar la fila "TOTAL AÑO" porque puede estar desactualizada
    let totalAsignado = 0;
    let totalEjecutado = 0;
    const ejecucionMensual = new Array(12).fill(0);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    let filasProcesadas = 0;

    sendLog(`[Presupuesto] Iniciando procesamiento de ${data.length} filas`, 'INFO');

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const firstCell = row[0]?.toString() || '';
      const detalleCell = row[2]?.toString() || '';

      // Saltar filas de encabezado (contienen 'ITEM' o '#')
      if (firstCell.toUpperCase().includes('ITEM') ||
          firstCell === '#') {
        continue;
      }

      // Detectar fila 'TOTAL AÑO' en la columna de detalle para detener la lectura
      // Esto alinea la lógica con readPresupuestoData
      if (detalleCell.toUpperCase().includes('TOTAL')) {
        sendLog(`[Presupuesto] Detectada fila TOTAL en fila ${i}, deteniendo lectura`, 'INFO');
        break;
      }

      // Columna D (índice 3) = Asignación, Columna E (índice 4) = Ejecutado acumulado
      const asignacion = parseMoney(row[3]);
      const ejecutado = parseMoney(row[4]);

      if (asignacion > 0 || ejecutado > 0) {
        totalAsignado += asignacion;
        totalEjecutado += ejecutado;
        filasProcesadas++;

        // Log detallado de cada fila válida
        const detalle = row[2] || 'Sin detalle';
        sendLog(`[Presupuesto] Fila ${i}: "${detalle.substring(0, 50)}..." - Asignado: $${(asignacion/1000000).toFixed(2)}M, Ejecutado: $${(ejecutado/1000000).toFixed(2)}M`, 'INFO');

        // Sumar ejecución mensual (columnas de meses)
        months.forEach((m, idx) => {
          const monthVal = parseMoney(row[idx + 6]);
          if (monthVal > 0) {
            ejecucionMensual[idx] += monthVal;
          }
        });
      }
    }

    sendLog(`[Presupuesto] Filas procesadas: ${filasProcesadas}`, 'INFO');
    sendLog(`[Presupuesto] TOTAL ASIGNADO: $${(totalAsignado/1000000).toFixed(2)}M ($${totalAsignado.toLocaleString()})`, 'INFO');
    sendLog(`[Presupuesto] TOTAL EJECUTADO: $${(totalEjecutado/1000000).toFixed(2)}M ($${totalEjecutado.toLocaleString()})`, 'INFO');

    // Asignar stats
    stats.totalAsignado = totalAsignado;
    stats.totalEjecutado = totalEjecutado;

    if (stats.totalAsignado > 0) {
      stats.porcentajeEjecucion = Math.round((stats.totalEjecutado / stats.totalAsignado) * 100);
      stats.saldoDisponible = stats.totalAsignado - stats.totalEjecutado;
      
      sendLog(`[Presupuesto] PORCENTAJE EJECUCIÓN: ${stats.porcentajeEjecucion}%`, 'INFO');
      sendLog(`[Presupuesto] SALDO DISPONIBLE: $${(stats.saldoDisponible/1000000).toFixed(2)}M ($${stats.saldoDisponible.toLocaleString()})`, 'INFO');
    }

    // Calcular ejecución acumulada para desviación
    const cumulativeExecution = [];
    let cumE = 0;
    for (let i = 0; i < 12; i++) {
      cumE += ejecucionMensual[i];
      stats.ejecucionMensual.ejecutada[i] = cumE;
    }

    if (totalAsignado > 0) {
      // Determinar estado según ejecución
      if (stats.porcentajeEjecucion > 100) {
        stats.estado = 'danger';
        stats.alertas.push('Sobre-ejecución presupuestal');
      } else if (stats.porcentajeEjecucion < 50 && currentMonth >= 5) {
        // Sub-ejecución crítica después de junio
        stats.estado = 'warning';
        stats.alertas.push(`Sub-ejecución crítica (${stats.porcentajeEjecucion}%)`);
      } else if (stats.porcentajeEjecucion < 20) {
        // Alerta temprana de baja ejecución (cualquier mes)
        stats.alertas.push(`Baja ejecución temprana (${stats.porcentajeEjecucion}%)`);
      }

      // Detectar sobre-ejecución mensual
      const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const promedioMensual = totalAsignado / 12;
      
      for (let m = 0; m < 12; m++) {
        if (ejecucionMensual[m] > promedioMensual * 1.2) {
          stats.mesesConSobreEjecucion.push(monthNames[m]);
        }
      }

      // Calcular desviación significativa
      const totalEjecutadoHastaFecha = stats.ejecucionMensual.ejecutada
        .slice(0, currentMonth + 1)
        .reduce((sum, val) => sum + val, 0);
      const esperadoHastaFecha = promedioMensual * (currentMonth + 1);

      if (esperadoHastaFecha > 0) {
        const desviacion = Math.abs(totalEjecutadoHastaFecha - esperadoHastaFecha) / esperadoHastaFecha;
        if (desviacion > 0.3) { // 30% de desviación
          stats.desviacionSignificativa = true;
          stats.alertas.push('Desviación significativa vs esperado');
        }
      }
    }

    sendLog(`[Presupuesto] Stats calculados: ${JSON.stringify(stats)}`, 'DEBUG');

  } catch (error) {
    sendLog(`[Presupuesto] Error: ${error.message}`, 'ERROR');
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
                inducciones: { totalTrabajadores: 0, totalInducciones: 0, completadas: 0, pendientes: 0, porcentajeCompletado: 0, mensual: new Array(12).fill(0) },
                capacitaciones: { totalCapacitaciones: 0, programadas: 0, realizadas: 0, porcentajeCumplimiento: 0, mensual: { programadas: new Array(12).fill(0), realizadas: new Array(12).fill(0) } },
                epps: { totalEPPs: 0, entregados: 0, pendientes: 0, stockActual: 0 },
                afiliacion: { totalPlanillas: 0, planillaMesEnCurso: false, ultimoMesRegistrado: null, estado: 'ok', alertas: [] }
            }
        };
    }

    // Ejecutar cálculos en paralelo
    const currentYear = new Date().getFullYear();
    const [capacitaciones, inducciones, epps, copasst, convivencia, afiliacion] = await Promise.all([
        calculateCapacitacionesStats(rootPath),
        calculateInduccionesStats(rootPath, companyName),
        calculateEppsStats(rootPath),
        calculateCopasstStats(rootPath, currentYear),
        calculateConvivenciaStats(rootPath, currentYear),  // ← NUEVO: Comité de Convivencia
        calculateAfiliacionStats(rootPath, companyName)
    ]);

    const stats = {
      inducciones,
      capacitaciones,
      epps,
      copasst,
      comite_convivencia: convivencia,  // ← NUEVO: Comité de Convivencia
      afiliacion
    };

    sendLog(`[MAIN] Estadísticas calculadas: ${JSON.stringify(stats)}`, 'DEBUG');
    return { success: true, stats };

  } catch (error) {
    sendLog(`[MAIN] Error crítico en estadísticas: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

// --- API Estadísticas de Gestión Integral ---
ipcMain.handle('get-gestion-integral-stats', async (event, companyName) => {
  try {
    sendLog(`[MAIN] Obteniendo estadísticas de Gestión Integral para: ${companyName}`, 'INFO');

    const rootPath = await getCompanyRootPath(companyName);

    if (!rootPath) {
        sendLog(`[MAIN] No se encontró ruta raíz para ${companyName}. Retornando ceros.`, 'WARN');
        return {
            success: true,
            stats: {
                politica: { actualizada: false, fecha: null, estado: 'No disponible' },
                objetivos: { total: 0, cumplidos: 0, porcentaje: 0 },
                plan_trabajo: { tareas_pendientes: 0, tareas_realizadas: 0, total: 0 },
                rendicion_cuentas: { actas_realizadas: 0, proxima_fecha: null },
                evaluacion_inicial: { disponible: false, cumplimiento: 0, hallazgosCriticos: 0 }
            }
        };
    }

    const currentYear = new Date().getFullYear();

    // Calcular estadísticas en paralelo (incluyendo evaluación inicial)
    const [politica, objetivos, plan_trabajo, rendicion, evaluacion_inicial] = await Promise.all([
        calculatePoliticaStats(rootPath),
        calculateObjetivosStats(rootPath),
        calculatePlanTrabajoStats(rootPath, currentYear),
        calculateRendicionCuentasStats(rootPath),
        calculateEvaluacionInicialStats(rootPath)
    ]);

    const stats = {
        politica,
        objetivos,
        plan_trabajo,
        rendicion_cuentas: rendicion,
        evaluacion_inicial
    };

    sendLog(`[MAIN] Estadísticas Gestión Integral calculadas: ${JSON.stringify(stats)}`, 'DEBUG');
    return { success: true, stats };

  } catch (error) {
    sendLog(`[MAIN] Error crítico en estadísticas de Gestión Integral: ${error.message}`, 'ERROR');
    return { success: false, error: error.message };
  }
});

/**
 * Calcular estadísticas de Política SST
 */
async function calculatePoliticaStats(basePath) {
  const stats = {
    actualizada: false,
    fecha: null,
    estado: 'No disponible',
    documento_encontrado: false
  };

  try {
    // Intentar múltiples nombres de carpeta (priorizar nombre corto)
    const posiblesNombres = [
        '2. Gestión Integral',        // Nombre corto (primero)
        '2. Gestion Integral',        // Sin tilde
        '2. Gestión Integral del SG-SST'  // Nombre completo
    ];

    let gestionIntegralPath = null;
    for (const nombre of posiblesNombres) {
        const pathIntento = path.join(basePath, nombre);
        if (fs.existsSync(pathIntento)) {
            gestionIntegralPath = pathIntento;
            break;
        }
    }

    if (!gestionIntegralPath) {
        return stats;
    }

    const politicaPath = path.join(gestionIntegralPath, '2.1 Política SST');
    const politicaPathAlt = path.join(gestionIntegralPath, '2.1 Politica SST');

    const rutaFinal = fs.existsSync(politicaPath) ? politicaPath : politicaPathAlt;

    if (!fs.existsSync(rutaFinal)) {
        return stats;
    }

    const files = await fsp.readdir(rutaFinal);
    const politicaFiles = files.filter(f => 
        f.toLowerCase().includes('politica') && (f.endsWith('.pdf') || f.endsWith('.docx') || f.endsWith('.xlsx'))
    );

    if (politicaFiles.length > 0) {
        stats.documento_encontrado = true;
        stats.estado = 'Disponible';
        
        // Obtener fecha del archivo más reciente
        const filePath = path.join(rutaFinal, politicaFiles[0]);
        const fileStats = await fsp.stat(filePath);
        stats.fecha = fileStats.mtime;
        stats.actualizada = (Date.now() - fileStats.mtime.getTime()) < (365 * 24 * 60 * 60 * 1000); // Menos de 1 año
        
        if (stats.actualizada) {
            stats.estado = 'Actualizada';
        } else {
            stats.estado = 'Por actualizar';
        }
    }
  } catch (error) {
    sendLog(`[MAIN] Error calculando política stats: ${error.message}`, 'WARN');
  }

  return stats;
}

/**
 * Calcular estadísticas de Objetivos SST
 */
async function calculateObjetivosStats(basePath) {
  const stats = {
    total: 0,
    cumplidos: 0,
    porcentaje: 0,
    vencidos: 0
  };

  try {
    // Intentar múltiples nombres de carpeta (priorizar nombre corto)
    const posiblesNombres = [
        '2. Gestión Integral',        // Nombre corto (primero)
        '2. Gestion Integral',        // Sin tilde
        '2. Gestión Integral del SG-SST'  // Nombre completo
    ];

    let gestionIntegralPath = null;
    for (const nombre of posiblesNombres) {
        const pathIntento = path.join(basePath, nombre);
        if (fs.existsSync(pathIntento)) {
            gestionIntegralPath = pathIntento;
            break;
        }
    }

    if (!gestionIntegralPath) {
        return stats;
    }

    const objetivosPath = path.join(gestionIntegralPath, '2.2 Objetivos SST');
    const objetivosPathAlt = path.join(gestionIntegralPath, '2.2 Objetivos');

    const rutaFinal = fs.existsSync(objetivosPath) ? objetivosPath : objetivosPathAlt;

    if (!fs.existsSync(rutaFinal)) {
        return stats;
    }

    const files = await fsp.readdir(rutaFinal);
    const objetivosFiles = files.filter(f => 
        (f.endsWith('.xlsx') || f.endsWith('.xls')) && !f.startsWith('~$')
    );

    if (objetivosFiles.length > 0) {
        const filePath = path.join(rutaFinal, objetivosFiles[0]);
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        // Asumir que hay columnas: Objetivo, Estado/Cumplimiento, Fecha
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;

            const objetivo = row[1];
            if (!objetivo || typeof objetivo !== 'string') continue;
            if (objetivo.toLowerCase().includes('total') || objetivo.toLowerCase().includes('objetivo')) continue;

            stats.total++;

            // Verificar estado de cumplimiento
            const estado = (row[2] || row[3] || '').toString().toLowerCase();
            if (estado.includes('cumplido') || estado.includes('realizado') || estado.includes('completado') || estado === 'si') {
                stats.cumplidos++;
            }
        }

        if (stats.total > 0) {
            stats.porcentaje = Math.round((stats.cumplidos / stats.total) * 100);
        }
    }
  } catch (error) {
    sendLog(`[MAIN] Error calculando objetivos stats: ${error.message}`, 'WARN');
  }

  return stats;
}

/**
 * Calcular estadísticas de Plan de Trabajo Anual
 * Replica la lógica de process-excel-data (handler del módulo Plan de Trabajo)
 * @param {string} basePath - Ruta raíz de la empresa
 * @param {number} currentYear - Año actual
 * @returns {Promise<Object>} Stats de plan de trabajo
 */
async function calculatePlanTrabajoStats(basePath, currentYear) {
  const stats = {
    totalActividades: 0,
    actividadesEjecutadas: 0,
    actividadesPendientes: 0,
    actividadesProgramadas: 197,
    porcentajeAvance: 0,
    ultimoMesRegistrado: null,
    estado: 'warning'
  };

  const mesesNombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  try {
    sendLog(`[Plan Trabajo] Iniciando cálculo para año ${currentYear}`, 'INFO');

    // 1. Buscar carpeta de Gestión Integral
    const posiblesNombres = [
        '2. Gestión Integral',
        '2. Gestion Integral',
        '2. Gestión Integral del SG-SST'
    ];

    let gestionIntegralPath = null;
    for (const nombre of posiblesNombres) {
        const pathIntento = path.join(basePath, nombre);
        sendLog(`[Plan Trabajo] Buscando Gestión Integral en: ${pathIntento}`, 'DEBUG');
        if (fs.existsSync(pathIntento)) {
            gestionIntegralPath = pathIntento;
            sendLog(`[Plan Trabajo] ✅ Gestión Integral encontrada: ${gestionIntegralPath}`, 'INFO');
            break;
        }
    }

    if (!gestionIntegralPath) {
        sendLog(`[Plan Trabajo] ❌ Carpeta Gestión Integral no encontrada`, 'WARN');
        return stats;
    }

    // 2. Buscar carpeta Plan de Trabajo (MÚLTIPLES VARIACIONES)
    const posiblesNombresPlan = [
        '2.4.1 Plan de Trabajo Anual',
        '2.4 Plan de Trabajo Anual',
        '2.4.1 Plan de Trabajo',
        '2.4 Plan de Trabajo',
        'Plan de Trabajo Anual'
    ];

    let planPath = null;
    for (const nombre of posiblesNombresPlan) {
        const pathIntento = path.join(gestionIntegralPath, nombre);
        sendLog(`[Plan Trabajo] Buscando Plan de Trabajo en: ${pathIntento}`, 'DEBUG');
        if (fs.existsSync(pathIntento)) {
            planPath = pathIntento;
            sendLog(`[Plan Trabajo] ✅ Carpeta encontrada: ${planPath}`, 'INFO');
            break;
        }
    }

    if (!planPath) {
        sendLog(`[Plan Trabajo] ❌ Carpeta Plan de Trabajo no encontrada en ninguna variación`, 'WARN');
        // Listar subcarpetas disponibles para debug
        try {
            const subs = await fsp.readdir(gestionIntegralPath);
            sendLog(`[Plan Trabajo] Subcarpetas disponibles: ${subs.join(', ')}`, 'DEBUG');
        } catch (e) {
            // Ignorar error al listar
        }
        return stats;
    }

    // 3. Buscar archivo del año
    const files = await fsp.readdir(planPath);
    sendLog(`[Plan Trabajo] Archivos en carpeta: ${files.join(', ')}`, 'DEBUG');
    
    const planFile = files.find(f =>
        f.includes('PLAN DE TRABAJO ANUAL') &&
        f.includes(currentYear.toString()) &&
        (f.endsWith('.xlsx') || f.endsWith('.xls')) &&
        !f.startsWith('~$')
    );

    if (!planFile) {
        sendLog(`[Plan Trabajo] ❌ No se encontró archivo para el año ${currentYear}`, 'WARN');
        return stats;
    }

    const filePath = path.join(planPath, planFile);
    sendLog(`[Plan Trabajo] ✅ Archivo encontrado: ${planFile}`, 'INFO');

    // 3. Leer Excel
    const workbook = xlsx.readFile(filePath);
    
    // 4. Buscar hoja correcta (misma lógica que process-excel-data)
    let worksheet = null;
    let targetSheetName = "";
    const priorityNames = ['PLAN DE TRABAJO', 'CRONOGRAMA', 'MATRIZ', 'ACTIVIDADES', 'PLAN ANUAL'];
    
    for (const sheetName of workbook.SheetNames) {
        const normalizedName = sheetName.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (priorityNames.some(p => normalizedName.includes(p))) {
            if (normalizedName.includes(currentYear.toString())) {
                targetSheetName = sheetName;
                break;
            }
            if (!targetSheetName) targetSheetName = sheetName;
        }
    }
    
    if (!targetSheetName) targetSheetName = workbook.SheetNames[0];
    worksheet = workbook.Sheets[targetSheetName];
    
    sendLog(`[Plan Trabajo] Hoja seleccionada: "${targetSheetName}"`, 'INFO');

    // 5. Leer como matriz
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    sendLog(`[Plan Trabajo] Total filas: ${rawData.length}`, 'DEBUG');

    // 6. BUSCAR FILA DE ENCABEZADOS (misma lógica que process-excel-data)
    let headerRowIndex = -1;
    let columnMap = {};

    const normalize = (str) => {
        if (!str) return "";
        return str.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    for (let i = 0; i < Math.min(15, rawData.length); i++) {
        const row = rawData[i];
        if (!Array.isArray(row)) continue;

        let monthCount = 0;
        let hasActividades = false;
        let hasResponsable = false;

        row.forEach(cell => {
            const val = normalize(cell);
            if (['ene', 'feb', 'mar', 'abr', 'may', 'jun'].every(m => val.includes(m))) {
                monthCount = 6;
            }
            if (val.includes('actividad') || val.includes('actividades')) {
                hasActividades = true;
            }
            if (val.includes('responsable')) {
                hasResponsable = true;
            }
        });

        if (monthCount >= 6 && (hasActividades || hasResponsable)) {
            headerRowIndex = i;
            sendLog(`[Plan Trabajo] Encabezados en fila ${i + 1}`, 'INFO');

            row.forEach((cell, colIndex) => {
                const val = normalize(cell);
                if (val === 'n°' || val === 'n' || val === '#' || val === 'numero') {
                    columnMap['numero'] = colIndex;
                } else if (val.includes('actividad')) {
                    columnMap['actividad'] = colIndex;
                } else if (val.includes('responsable')) {
                    columnMap['responsable'] = colIndex;
                } else if (val === 'ene' || val === 'enero') columnMap['enero'] = colIndex;
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
                else if (val.includes('avance') || val.includes('%')) columnMap['avance'] = colIndex;
                else if (val.includes('estado')) columnMap['estado'] = colIndex;
            });
            break;
        }
    }

    // Fallback
    if (headerRowIndex === -1) {
        headerRowIndex = 7;
        columnMap = {
            'numero': 0, 'actividad': 1, 'responsable': 2,
            'enero': 3, 'febrero': 4, 'marzo': 5, 'abril': 6,
            'mayo': 7, 'junio': 8, 'julio': 9, 'agosto': 10,
            'septiembre': 11, 'octubre': 12, 'noviembre': 13, 'diciembre': 14,
            'avance': 15, 'estado': 16
        };
        sendLog(`[Plan Trabajo] Usando fallback: encabezados en fila 8`, 'WARN');
    }

    sendLog(`[Plan Trabajo] ColumnMap: ${JSON.stringify(columnMap)}`, 'DEBUG');

    // 7. PROCESAR FILAS - Replicar lógica de process-excel-data
    const nivel1Keywords = [
        'MEDICINA PREVENTIVA', 'SEGURIDAD INDUSTRIAL', 'HIGIENE INDUSTRIAL',
        'SALUD PÚBLICA', 'BIENESTAR', 'VERIFICACION', 'VERIFICACIÓN', 'INTEGRAL'
    ];
    const nivel2Keywords = [
        'SVE', 'DESORDEN', 'MUSCULO', 'ESQUELÉTICO', 'ERGONOMÍA',
        'ENFERMEDAD', 'SALUD MENTAL', 'ESTRÉS', 'RIESGO', 'BIOMECÁNICO'
    ];
    const nivel3Keywords = ['PLANEAR', 'HACER', 'VERIFICAR', 'ACTUAR', 'PHVA'];

    let ultimoMesIndex = -1;

    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        const actividad = String(row[columnMap['actividad'] || 1] || '').trim();

        // Saltar filas vacías o totales
        if (!actividad || actividad.length < 2) continue;
        if (actividad.toLowerCase().includes('total') ||
            actividad.toLowerCase().includes('velocímetro') ||
            actividad.toLowerCase().includes('velocimetro')) continue;

        // Determinar nivel jerárquico
        let level = 4;
        const normalizedAct = actividad.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const colA = String(row[columnMap['numero'] || 0] || '').trim();
        const normalizedColA = colA.toUpperCase().trim();

        // PRIORIDAD 1: Si ColA es número → Nivel 4 (actividad)
        if (colA !== '' && colA !== 'undefined' && !isNaN(parseFloat(colA.replace(',', '.')))) {
            level = 4;
        }
        // PRIORIDAD 2: Marcadores T1, T2, T3
        else if (normalizedColA === 'T1') level = 1;
        else if (normalizedColA === 'T2') level = 2;
        else if (normalizedColA === 'T3') level = 3;
        // PRIORIDAD 3: Keywords
        else if (nivel1Keywords.some(k => normalizedAct.includes(k))) level = 1;
        else if (nivel2Keywords.some(k => normalizedAct.includes(k))) level = 2;
        else if (nivel3Keywords.some(k => normalizedAct === k || normalizedAct.startsWith(k))) level = 3;
        // Fallback
        else level = 2;

        // 8. CONTAR SOLO ACTIVIDADES (Nivel 4)
        if (level !== 4) continue;

        stats.totalActividades++;

        // 9. Verificar si está ejecutada (tiene "C" en algún mes)
        let tieneCompletado = false;
        const mesesCols = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

        for (let mIndex = 0; mIndex < 12; mIndex++) {
            const mesCol = columnMap[mesesCols[mIndex]];
            if (mesCol !== undefined && row[mesCol] !== undefined) {
                const mesValor = String(row[mesCol]).trim().toLowerCase();
                if (mesValor === 'c') {
                    tieneCompletado = true;
                    // Track último mes
                    if (mIndex > ultimoMesIndex) {
                        ultimoMesIndex = mIndex;
                        stats.ultimoMesRegistrado = `${mesesNombres[mIndex].substring(0, 3)} ${currentYear}`;
                    }
                }
            }
        }

        if (tieneCompletado) {
            stats.actividadesEjecutadas++;
        }
    }

    // 10. Calcular pendientes y porcentaje
    stats.actividadesPendientes = stats.totalActividades - stats.actividadesEjecutadas;

    if (stats.actividadesProgramadas > 0 && stats.totalActividades > 0) {
        stats.porcentajeAvance = Math.round((stats.actividadesEjecutadas / stats.totalActividades) * 100);
    }

    // 11. Determinar estado
    if (stats.porcentajeAvance >= 80) stats.estado = 'ok';
    else if (stats.porcentajeAvance >= 50) stats.estado = 'warning';
    else stats.estado = 'danger';

    sendLog(`[Plan Trabajo] Total: ${stats.totalActividades}, Ejecutadas: ${stats.actividadesEjecutadas}, Avance: ${stats.porcentajeAvance}%`, 'INFO');
    sendLog(`[Plan Trabajo] Último registro: ${stats.ultimoMesRegistrado || 'N/A'}`, 'INFO');

  } catch (error) {
    sendLog(`[Plan Trabajo] Error: ${error.message}`, 'ERROR');
  }

  return stats;
}

/**
 * Calcular estadísticas de Rendición de Cuentas
 */
async function calculateRendicionCuentasStats(basePath) {
  const stats = {
    actas_realizadas: 0,
    proxima_fecha: null,
    ultima_fecha: null
  };

  try {
    // Intentar múltiples nombres de carpeta (priorizar nombre corto)
    const posiblesNombres = [
        '2. Gestión Integral',        // Nombre corto (primero)
        '2. Gestion Integral',        // Sin tilde
        '2. Gestión Integral del SG-SST'  // Nombre completo
    ];

    let gestionIntegralPath = null;
    for (const nombre of posiblesNombres) {
        const pathIntento = path.join(basePath, nombre);
        if (fs.existsSync(pathIntento)) {
            gestionIntegralPath = pathIntento;
            break;
        }
    }

    if (!gestionIntegralPath) {
        return stats;
    }

    const rendicionPath = path.join(gestionIntegralPath, '2.6 Rendición de cuentas');
    const rendicionPathAlt = path.join(gestionIntegralPath, '2.6 Rendicion de cuentas');

    const rutaFinal = fs.existsSync(rendicionPath) ? rendicionPath : rendicionPathAlt;

    if (!fs.existsSync(rutaFinal)) {
        return stats;
    }

    const files = await fsp.readdir(rutaFinal);
    const actasFiles = files.filter(f => 
        f.toLowerCase().includes('acta') && (f.endsWith('.pdf') || f.endsWith('.docx'))
    );

    stats.actas_realizadas = actasFiles.length;

    // Obtener fecha de la última acta
    if (actasFiles.length > 0) {
        const sortedFiles = actasFiles.sort();
        const lastFile = sortedFiles[sortedFiles.length - 1];
        const filePath = path.join(rutaFinal, lastFile);
        const fileStats = await fsp.stat(filePath);
        stats.ultima_fecha = fileStats.mtime;

        // Próxima rendición (aproximadamente 1 año después)
        stats.proxima_fecha = new Date(stats.ultima_fecha);
        stats.proxima_fecha.setFullYear(stats.proxima_fecha.getFullYear() + 1);
    }
  } catch (error) {
    sendLog(`[MAIN] Error calculando rendición de cuentas stats: ${error.message}`, 'WARN');
  }

  return stats;
}

/**
 * Calcular estadísticas de Evaluación Inicial del SG-SST
 * Procesa los PDFs más recientes de Ministerio y ARL (sin filtro estricto por año)
 * @param {string} basePath - Ruta raíz de la empresa
 * @returns {Promise<Object>} Stats de evaluación inicial separados por fuente
 */
async function calculateEvaluacionInicialStats(basePath) {
  const stats = {
    disponible: false,
    combinado: {
      cumplimiento: 0,
      hallazgosCriticos: 0,
      hallazgosParciales: 0,
      hallazgosCumplidos: 0,
      totalHallazgos: 0
    },
    ministerio: {
      disponible: false,
      cumplimiento: 0,
      hallazgosCriticos: 0,
      hallazgosParciales: 0,
      hallazgosCumplidos: 0,
      totalHallazgos: 0,
      ultimoInforme: null,
      fechaProcesamiento: null
    },
    arl: {
      disponible: false,
      cumplimiento: 0,
      hallazgosCriticos: 0,
      hallazgosParciales: 0,
      hallazgosCumplidos: 0,
      totalHallazgos: 0,
      ultimoInforme: null,
      fechaProcesamiento: null
    }
  };

  try {
    // Intentar múltiples nombres de carpeta (priorizar nombre corto)
    const posiblesNombres = [
        '2. Gestión Integral',        // Nombre corto (primero)
        '2. Gestion Integral',        // Sin tilde
        '2. Gestión Integral del SG-SST'  // Nombre completo
    ];

    let gestionIntegralPath = null;
    for (const nombre of posiblesNombres) {
        const pathIntento = path.join(basePath, nombre);
        if (fs.existsSync(pathIntento)) {
            gestionIntegralPath = pathIntento;
            break;
        }
    }

    if (!gestionIntegralPath) {
        return stats;
    }

    const evaluacionPath = path.join(gestionIntegralPath, '2.3.1 Evaluación inicial del SG-SST');
    const evaluacionPathAlt = path.join(gestionIntegralPath, '2.3.1 Evaluacion inicial del SG-SST');

    const rutaFinal = fs.existsSync(evaluacionPath) ? evaluacionPath : evaluacionPathAlt;

    if (!fs.existsSync(rutaFinal)) {
        return stats;
    }

    // Buscar PDFs en la carpeta principal y subcarpetas
    const subfolders = ['', 'Diagnostico Ministerio', 'Diagnostico ARL', 'SGSST'];
    let allPdfFiles = [];

    for (const sub of subfolders) {
        const subPath = sub ? path.join(rutaFinal, sub) : rutaFinal;
        if (fs.existsSync(subPath)) {
            const files = await fsp.readdir(subPath);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
            allPdfFiles = allPdfFiles.concat(pdfFiles.map(f => ({
                name: f,
                path: path.join(subPath, f),
                folder: sub || 'raíz'
            })));
        }
    }

    if (allPdfFiles.length === 0) {
        return stats;
    }

    // Separar por fuente (sin filtro por año)
    const ministerioPdfs = allPdfFiles.filter(f => 
        f.folder.toLowerCase().includes('ministerio') || 
        f.name.toLowerCase().includes('ministerio') ||
        f.name.toLowerCase().includes('resultados calificacion')
    );
    
    // Para ARL: priorizar informes reales (Informe Res 0312) sobre certificaciones
    const arlInformes = allPdfFiles.filter(f => 
        f.folder.toLowerCase().includes('arl') || 
        f.name.toLowerCase().includes('informe res 0312') ||
        f.name.toLowerCase().includes('informe arl')
    );
    const arlCertificaciones = allPdfFiles.filter(f => 
        f.name.toLowerCase().includes('certificacion') && 
        f.name.toLowerCase().includes('arl')
    );
    
    // Usar informes primero, si no hay usar certificaciones
    const arlPdfs = arlInformes.length > 0 ? arlInformes : arlCertificaciones;

    sendLog(`[Evaluacion] PDFs encontrados: ministerio=${ministerioPdfs.length}, arl=${arlPdfs.length} (informes=${arlInformes.length}, certificaciones=${arlCertificaciones.length})`, 'INFO');

    // Función auxiliar para procesar un PDF
    const procesarPdf = async (pdfInfo, fuente) => {
        if (!pdfInfo || pdfInfo.length === 0) return null;
        
        // Ordenar por fecha (más reciente primero)
        const sorted = await Promise.all(
            pdfInfo.map(async (f) => {
                try {
                    const fileStats = await fsp.stat(f.path);
                    return { ...f, mtime: fileStats.mtime };
                } catch (e) {
                    return { ...f, mtime: new Date(0) };
                }
            })
        );
        sorted.sort((a, b) => b.mtime - a.mtime);
        
        const latest = sorted[0];
        sendLog(`[Evaluacion] Procesando ${fuente}: ${latest.name}`, 'INFO');
        
        const EvaluacionPdfParser = require('./utils/evaluacionPdfParser');
        const parser = new EvaluacionPdfParser();
        const result = await parser.parsePdf(latest.path, fuente);
        
        if (result.success && result.metrics) {
            return {
                disponible: true,
                cumplimiento: result.metrics.cumplimiento || 0,
                hallazgosCriticos: result.metrics.noCumplidos || 0,
                hallazgosParciales: result.metrics.parcial || 0,
                hallazgosCumplidos: result.metrics.cumplidos || 0,
                totalHallazgos: result.metrics.totalItems || 0,
                ultimoInforme: latest.name,
                fechaProcesamiento: latest.mtime
            };
        }
        return null;
    };

    // Procesar Ministerio
    if (ministerioPdfs.length > 0) {
        const ministerioStats = await procesarPdf(ministerioPdfs, 'ministerio');
        if (ministerioStats) {
            stats.ministerio = ministerioStats;
        }
    }

    // Procesar ARL
    if (arlPdfs.length > 0) {
        const arlStats = await procesarPdf(arlPdfs, 'arl');
        if (arlStats) {
            stats.arl = arlStats;
        }
    }

    // Calcular combinados (suma de ambos)
    if (stats.ministerio.disponible || stats.arl.disponible) {
        stats.disponible = true;
        
        // Si solo hay uno, usar sus datos como combinado
        if (!stats.ministerio.disponible && stats.arl.disponible) {
            stats.combinado = {
                cumplimiento: stats.arl.cumplimiento,
                hallazgosCriticos: stats.arl.hallazgosCriticos,
                hallazgosParciales: stats.arl.hallazgosParciales,
                hallazgosCumplidos: stats.arl.hallazgosCumplidos,
                totalHallazgos: stats.arl.totalHallazgos
            };
        } else if (stats.ministerio.disponible && !stats.arl.disponible) {
            stats.combinado = {
                cumplimiento: stats.ministerio.cumplimiento,
                hallazgosCriticos: stats.ministerio.hallazgosCriticos,
                hallazgosParciales: stats.ministerio.hallazgosParciales,
                hallazgosCumplidos: stats.ministerio.hallazgosCumplidos,
                totalHallazgos: stats.ministerio.totalHallazgos
            };
        } else {
            // Ambos disponibles - promediar cumplimiento, sumar hallazgos
            stats.combinado = {
                cumplimiento: Math.round((stats.ministerio.cumplimiento + stats.arl.cumplimiento) / 2),
                hallazgosCriticos: stats.ministerio.hallazgosCriticos + stats.arl.hallazgosCriticos,
                hallazgosParciales: stats.ministerio.hallazgosParciales + stats.arl.hallazgosParciales,
                hallazgosCumplidos: stats.ministerio.hallazgosCumplidos + stats.arl.hallazgosCumplidos,
                totalHallazgos: stats.ministerio.totalHallazgos + stats.arl.totalHallazgos
            };
        }
    }

    sendLog(`[Evaluacion] Stats calculados: combinado=${stats.combinado.cumplimiento}%, min=${stats.ministerio.cumplimiento}%, arl=${stats.arl.cumplimiento}%`, 'INFO');

  } catch (error) {
    sendLog(`[MAIN] Error calculando evaluación inicial stats: ${error.message}`, 'WARN');
  }

  return stats;
}


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

// ============================================================================
// GESTIÓN DEL CAMBIO (2.11.1) — IPC Handlers
// ============================================================================

/**
 * Obtiene la ruta del archivo Excel de Gestión del Cambio para una empresa.
 * Navega la estructura mapeada del repositorio de la empresa (patrón obtenerRutaAusentismo).
 * Solo crea directorio como último recurso si la estructura no está mapeada.
 */
async function obtenerRutaGestionCambio(companyName) {
  try {
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    const normalizedName = companyName.toLowerCase().trim();
    const companyKey = Object.keys(config.companyPaths || {}).find(
      k => k.toLowerCase().trim() === normalizedName
    );
    const companyConfig = companyKey ? config.companyPaths[companyKey] : null;

    if (!companyConfig) {
      console.error(`[GestionCambio] No se encontró configuración para empresa: ${companyName}`);
      return null;
    }

    // Helper: normalizar string para comparación flexible (ignora tildes, mayúsculas, espacios extra)
    const norm = (s) => String(s).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();

    // Búsqueda flexible: el key puede contener prefijos numéricos como "2. Gestión Integral"
    function findDirFlexible(subdirs, target) {
      if (!subdirs) return null;
      const tgt = norm(target);
      for (const [key, value] of Object.entries(subdirs)) {
        const k = norm(key);
        // Coincidencia exacta, o el key contiene el target, o el target coincide con la parte sin prefijo numérico
        const kSinPrefijo = k.replace(/^\d+[\s.]+/, '');
        if (k === tgt || k.includes(tgt) || kSinPrefijo === tgt) return value;
      }
      return null;
    }

    // Intentar navegar la estructura mapeada del repositorio
    const rootStructure = companyConfig.structure?.structure;
    if (rootStructure?.subdirectories) {
      // Buscar carpeta "Gestión Integral" en el nivel raíz
      const gestionIntegral = findDirFlexible(rootStructure.subdirectories, 'Gestion Integral');

      if (gestionIntegral) {
        // Buscar subcarpeta "Gestión del Cambio" dentro de Gestión Integral
        const gcDir = findDirFlexible(gestionIntegral.subdirectories, 'Gestion del Cambio');

        // Usar la subcarpeta si existe, si no usar Gestión Integral directamente
        const targetDir = gcDir || gestionIntegral;
        if (targetDir.path) {
          const excelPath = path.join(targetDir.path, 'GI-FO-059_GestionDelCambio.xlsx');
          console.log(`[GestionCambio] Ruta en repositorio: ${excelPath}`);
          return excelPath;
        }
      }
    }

    // Fallback: usar raíz de la empresa + "Gestión Integral" (sin crear subcarpeta "2.11.1")
    const root = companyConfig.root || companyConfig.ruta_base;
    if (!root) {
      console.error(`[GestionCambio] No se encontró ruta raíz para empresa: ${companyName}`);
      return null;
    }

    const fallbackDir = path.join(root, 'Gestión Integral');
    await fsp.mkdir(fallbackDir, { recursive: true });
    console.warn(`[GestionCambio] Carpeta Gestión Integral no encontrada en estructura. Usando fallback: ${fallbackDir}`);
    return path.join(fallbackDir, 'GI-FO-059_GestionDelCambio.xlsx');

  } catch (err) {
    console.error('[GestionCambio] Error obteniendo ruta:', err);
    return null;
  }
}

/**
 * Re-aplica los keys de columna al worksheet después de leer un archivo xlsx.
 * ExcelJS no persiste los column keys en el archivo — solo existen en memoria
 * cuando se crean con ws.columns. Sin esto, row.getCell('id') falla.
 */
function applyGestionCambioColumnKeys(worksheet) {
  if (!worksheet) return;
  const keys = [
    'id','fecha','areaEjecutora','areaUsuaria','responsable','cargo',
    'descripcion','justificacion','tipoCambio','nivelRiesgo','estado',
    'riesgoAntes','riesgoDespues','introducePeligros','modificaRiesgos',
    'fechaEjecucion','controlesImplementados','controlesEficaces',
    'fechaCierre','jsonFull',
  ];
  keys.forEach((key, i) => {
    const col = worksheet.getColumn(i + 1);
    if (col) col.key = key;
  });
}

/**
 * Asegura que el archivo Excel exista con la estructura correcta.
 */
async function ensureGestionCambioExcel(filePath) {
  if (fs.existsSync(filePath)) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'K+AIR SG-SST';
  workbook.lastModifiedBy = 'K+AIR SG-SST';

  // Hoja principal de cambios
  const ws = workbook.addWorksheet('Cambios', {
    properties: { tabColor: { argb: '174EA6' } }
  });

  ws.columns = [
    { header: 'ID', key: 'id', width: 20 },
    { header: 'Fecha', key: 'fecha', width: 14 },
    { header: 'Área Ejecutora', key: 'areaEjecutora', width: 20 },
    { header: 'Área Usuaria', key: 'areaUsuaria', width: 20 },
    { header: 'Responsable', key: 'responsable', width: 25 },
    { header: 'Cargo', key: 'cargo', width: 20 },
    { header: 'Descripción', key: 'descripcion', width: 40 },
    { header: 'Justificación', key: 'justificacion', width: 40 },
    { header: 'Tipo de Cambio', key: 'tipoCambio', width: 30 },
    { header: 'Nivel de Riesgo', key: 'nivelRiesgo', width: 15 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Riesgo Antes', key: 'riesgoAntes', width: 15 },
    { header: 'Riesgo Después', key: 'riesgoDespues', width: 15 },
    { header: 'Introduce Peligros', key: 'introducePeligros', width: 15 },
    { header: 'Modifica Riesgos', key: 'modificaRiesgos', width: 15 },
    { header: 'Fecha Ejecución', key: 'fechaEjecucion', width: 14 },
    { header: 'Controles Implementados', key: 'controlesImplementados', width: 15 },
    { header: 'Controles Eficaces', key: 'controlesEficaces', width: 15 },
    { header: 'Fecha Cierre', key: 'fechaCierre', width: 14 },
    { header: 'Datos Completos (JSON)', key: 'jsonFull', width: 50 },
  ];

  // Estilo de header
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '174EA6' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  await workbook.xlsx.writeFile(filePath);
  console.log(`[GestionCambio] Archivo Excel creado: ${filePath}`);
}

/**
 * Carga todos los cambios del archivo Excel.
 */
ipcMain.handle('gestion-cambio-load-data', async (event, companyName) => {
  try {
    const filePath = await obtenerRutaGestionCambio(companyName);
    if (!filePath) {
      return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
    }

    await ensureGestionCambioExcel(filePath);

    if (!fs.existsSync(filePath)) {
      return { success: true, data: { changes: [], metrics: { pending: 0, highRisk: 0, active: 0, month: 0 } } };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Cambios');

    if (!worksheet || worksheet.rowCount <= 1) {
      return { success: true, data: { changes: [], metrics: { pending: 0, highRisk: 0, active: 0, month: 0 } } };
    }

    // ExcelJS no persiste los keys de columna en el archivo xlsx —
    // hay que re-aplicarlos después de leer para que getCell(key) funcione.
    applyGestionCambioColumnKeys(worksheet);

    const changes = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Saltar header

      const rowData = {
        id: row.getCell('id').value,
        fecha: row.getCell('fecha').value,
        areaEjecutora: row.getCell('areaEjecutora').value,
        areaUsuaria: row.getCell('areaUsuaria').value,
        responsable: row.getCell('responsable').value,
        cargo: row.getCell('cargo').value,
        descripcion: row.getCell('descripcion').value,
        justificacion: row.getCell('justificacion').value,
        tipoCambio: row.getCell('tipoCambio').value,
        nivelRiesgo: row.getCell('nivelRiesgo').value,
        estado: row.getCell('estado').value,
        riesgoAntes: row.getCell('riesgoAntes').value,
        riesgoDespues: row.getCell('riesgoDespues').value,
        introducePeligros: row.getCell('introducePeligros').value,
        modificaRiesgos: row.getCell('modificaRiesgos').value,
        fechaEjecucion: row.getCell('fechaEjecucion').value,
        controlesImplementados: row.getCell('controlesImplementados').value,
        controlesEficaces: row.getCell('controlesEficaces').value,
        fechaCierre: row.getCell('fechaCierre').value,
      };

      // Intentar leer JSON completo si existe
      const jsonFull = row.getCell('jsonFull').value;
      if (jsonFull && typeof jsonFull === 'string') {
        try {
          Object.assign(rowData, JSON.parse(jsonFull));
        } catch (e) { /* ignorar */ }
      }

      // Normalizar fecha
      if (rowData.fecha instanceof Date) {
        rowData.fecha = rowData.fecha.toISOString().split('T')[0];
      }

      // Parsear tipoCambio si es string
      if (typeof rowData.tipoCambio === 'string') {
        try {
          rowData.tipoCambio = JSON.parse(rowData.tipoCambio);
        } catch (e) {
          rowData.tipoCambio = [rowData.tipoCambio];
        }
      }

      changes.push(rowData);
    });

    return { success: true, data: { changes } };
  } catch (err) {
    console.error('[GestionCambio] Error al cargar datos:', err);
    return { success: false, error: { code: 'LOAD_ERROR', message: err.message } };
  }
});

/**
 * Guarda o actualiza un cambio en el archivo Excel.
 */
ipcMain.handle('gestion-cambio-save-data', async (event, companyName, changeData) => {
  try {
    const filePath = await obtenerRutaGestionCambio(companyName);
    if (!filePath) {
      return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
    }

    await ensureGestionCambioExcel(filePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Cambios');

    // Re-aplicar keys de columna (ExcelJS no los persiste en xlsx)
    applyGestionCambioColumnKeys(worksheet);

    // Serializar datos complejos como JSON
    const jsonFull = JSON.stringify(changeData);
    const tipoCambioStr = Array.isArray(changeData.tipoCambio)
      ? JSON.stringify(changeData.tipoCambio)
      : (changeData.tipoCambio || '');

    const rowValues = {
      id: changeData.id,
      fecha: changeData.fecha,
      areaEjecutora: changeData.areaEjecutora,
      areaUsuaria: changeData.areaUsuaria,
      responsable: changeData.responsable,
      cargo: changeData.cargo,
      descripcion: changeData.descripcion,
      justificacion: changeData.justificacion,
      tipoCambio: tipoCambioStr,
      nivelRiesgo: changeData.nivelRiesgo,
      estado: changeData.estado,
      riesgoAntes: changeData.riesgoAntes,
      riesgoDespues: changeData.riesgoDespues,
      introducePeligros: changeData.introducePeligros ? 'SI' : 'NO',
      modificaRiesgos: changeData.modificaRiesgos ? 'SI' : 'NO',
      fechaEjecucion: changeData.fechaEjecucion,
      controlesImplementados: changeData.controlesImplementados,
      controlesEficaces: changeData.controlesEficaces,
      fechaCierre: changeData.fechaCierre,
      jsonFull: jsonFull,
    };

    // Buscar si ya existe (por ID) para actualizar
    let existingRow = null;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // saltar cabecera
      if (row.getCell('id').value === changeData.id) {
        existingRow = row;
      }
    });

    if (existingRow) {
      // Actualizar fila existente usando los keys de columna
      Object.keys(rowValues).forEach((key) => {
        existingRow.getCell(key).value = rowValues[key];
      });
      console.log(`[GestionCambio] Cambio actualizado: ${changeData.id}`);
    } else {
      // Agregar nueva fila
      worksheet.addRow(rowValues);
      console.log(`[GestionCambio] Nuevo cambio agregado: ${changeData.id}`);
    }

    await workbook.xlsx.writeFile(filePath);

    return { success: true, data: { id: changeData.id } };
  } catch (err) {
    console.error('[GestionCambio] Error al guardar:', err);
    return { success: false, error: { code: 'SAVE_ERROR', message: err.message } };
  }
});

/**
 * Genera el siguiente ID consecutivo CHG-YYYY-XXX.
 */
ipcMain.handle('gestion-cambio-generate-id', async (event, companyName) => {
  try {
    const filePath = await obtenerRutaGestionCambio(companyName);
    if (!filePath) {
      return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
    }

    await ensureGestionCambioExcel(filePath);

    const year = new Date().getFullYear();
    let maxNum = 0;

    if (fs.existsSync(filePath)) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet('Cambios');

      // Re-aplicar keys de columna (ExcelJS no los persiste en xlsx)
      applyGestionCambioColumnKeys(worksheet);

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const id = row.getCell('id').value;
        if (id && typeof id === 'string') {
          // Formato CHG-YYYY-XXX
          const match = id.match(/CHG-(\d{4})-(\d+)/);
          if (match && parseInt(match[1]) === year) {
            const num = parseInt(match[2]);
            if (num > maxNum) maxNum = num;
          }
        }
      });
    }

    const nextId = `CHG-${year}-${String(maxNum + 1).padStart(3, '0')}`;
    return { success: true, data: { id: nextId } };
  } catch (err) {
    console.error('[GestionCambio] Error al generar ID:', err);
    const year = new Date().getFullYear();
    return { success: true, data: { id: `CHG-${year}-001` } };
  }
});

/**
 * Actualiza el estado de un cambio (máquina de estados con transiciones validadas).
 * Solo permite transiciones definidas en VALID_TRANSITIONS.
 */
ipcMain.handle('gestion-cambio-update-estado', async (event, companyName, changeId, nuevoEstado, extraData = {}) => {
  const VALID_TRANSITIONS = {
    'Solicitud':     ['En Evaluación'],
    'Pendiente':     ['En Evaluación'],
    'En Evaluación': ['Aprobado', 'No Aprobado'],
    'Aprobado':      ['En Ejecución'],
    'En Ejecución':  ['Cerrado'],
  };

  try {
    const filePath = await obtenerRutaGestionCambio(companyName);
    if (!filePath) {
      return { success: false, error: { code: 'COMPANY_NOT_FOUND', message: 'Empresa no encontrada' } };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Archivo de datos no encontrado' } };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Cambios');
    applyGestionCambioColumnKeys(worksheet);

    // Buscar la fila por ID
    let targetRow = null;
    let currentEstado = null;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      if (row.getCell('id').value === changeId) {
        targetRow = row;
        currentEstado = String(row.getCell('estado').value || '');
      }
    });

    if (!targetRow) {
      return { success: false, error: { code: 'NOT_FOUND', message: `Cambio "${changeId}" no encontrado` } };
    }

    // Validar transición permitida
    const allowed = VALID_TRANSITIONS[currentEstado] || [];
    if (!allowed.includes(nuevoEstado)) {
      return {
        success: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `No se puede cambiar de "${currentEstado}" a "${nuevoEstado}"`,
        },
      };
    }

    // Actualizar campo estado
    targetRow.getCell('estado').value = nuevoEstado;

    // Campos adicionales opcionales según el estado destino
    if (nuevoEstado === 'En Ejecución' && extraData.fechaEjecucion) {
      targetRow.getCell('fechaEjecucion').value = extraData.fechaEjecucion;
    }
    if (nuevoEstado === 'Cerrado' && extraData.fechaCierre) {
      targetRow.getCell('fechaCierre').value = extraData.fechaCierre;
    }

    // Actualizar jsonFull para mantener consistencia con el estado nuevo
    const jsonCell = targetRow.getCell('jsonFull');
    if (jsonCell.value) {
      try {
        const parsed = JSON.parse(String(jsonCell.value));
        parsed.estado = nuevoEstado;
        Object.assign(parsed, extraData);
        jsonCell.value = JSON.stringify(parsed);
      } catch (e) { /* ignorar si no es JSON válido */ }
    }

    await workbook.xlsx.writeFile(filePath);
    console.log(`[GestionCambio] Transición exitosa: ${changeId} → "${currentEstado}" → "${nuevoEstado}"`);

    return { success: true, data: { id: changeId, estado: nuevoEstado, estadoAnterior: currentEstado } };

  } catch (err) {
    console.error('[GestionCambio] Error al actualizar estado:', err);
    return { success: false, error: { code: 'UPDATE_ERROR', message: err.message } };
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

// Función para limpiar procesos hijos antes de salir
function cleanupProcesses() {
    console.log('[MAIN] 🛡️ Iniciando limpieza profunda de procesos...');
    
    // 1. Cerrar servidor LLM si tenemos la referencia
    if (llmServerProcess) {
        console.log('[MAIN] Cerrando servidor LLM por PID...');
        try {
            if (process.platform === 'win32') {
                const { execSync } = require('child_process');
                execSync(`taskkill /pid ${llmServerProcess.pid} /T /F`);
            } else {
                llmServerProcess.kill('SIGKILL');
            }
            console.log('[MAIN] ✅ Servidor LLM cerrado correctamente');
        } catch (e) {
            console.warn('[MAIN] ⚠️ Error al cerrar servidor LLM (puede que ya no exista):', e.message);
        }
        llmServerProcess = null;
    }

    // 2. En Windows, hacer un barrido de procesos de Python residuales
    if (process.platform === 'win32') {
        try {
            const { execSync } = require('child_process');
            console.log('[MAIN] 🔍 Buscando procesos de Python residuales...');
            // Forzar el cierre de cualquier python.exe para asegurar que la carpeta de la app no esté bloqueada
            // Esto es necesario porque algunos procesos pueden no tener referencia directa en el main process
            execSync('taskkill /F /IM python.exe /T', { stdio: 'ignore' });
            console.log('[MAIN] ✅ Barrido de Python completado');
        } catch (e) {
            // Taskkill falla si no hay procesos, es normal
        }
    }
}

// Asegurar limpieza en cualquier intento de cierre
app.on('before-quit', (e) => {
    cleanupProcesses();
});

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
        const serverScript = getPythonScriptPath('llm_server.py');

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

// ==========================================================================
// Módulo 2.10.1 — Evaluación y Selección de Proveedores y Contratistas
// Handlers IPC para persistencia JSON de datos del módulo
// ==========================================================================

function getESDataDir() {
  // Usar el directorio de datos de la app para almacenar datos del módulo 2.10.1
  const dataDir = path.join(app.getPath('userData'), 'evaluacion-seleccion-data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function readESFile(filename) {
  try {
    const filePath = path.join(getESDataDir(), filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) { console.error('[2.10.1] Error leyendo ' + filename + ':', e); }
  return [];
}

function writeESFile(filename, data) {
  try {
    const filePath = path.join(getESDataDir(), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.error('[2.10.1] Error escribiendo ' + filename + ':', e); }
}

ipcMain.handle('get-asociados-es', async () => readESFile('asociados.json'));
ipcMain.handle('save-asociados-es', async (event, data) => writeESFile('asociados.json', data));
ipcMain.handle('get-evaluaciones-es', async () => readESFile('evaluaciones.json'));
ipcMain.handle('save-evaluaciones-es', async (event, data) => writeESFile('evaluaciones.json', data));
ipcMain.handle('get-reevaluaciones-es', async () => readESFile('reevaluaciones.json'));
ipcMain.handle('save-reevaluaciones-es', async (event, data) => writeESFile('reevaluaciones.json', data));
ipcMain.handle('get-noconformidades-es', async () => readESFile('noconformidades.json'));
ipcMain.handle('save-noconformidades-es', async (event, data) => writeESFile('noconformidades.json', data));

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
