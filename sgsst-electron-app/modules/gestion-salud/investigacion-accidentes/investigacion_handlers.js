const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fsp = require('fs').promises;
const fs = require('fs');
const { promisify } = require('util');
const { execFile } = require('child_process');
const http = require('http');

// Determinar la ruta base del proyecto (raíz de sgsst-electron-app)
// Usar app.getAppPath() para Electron o __dirname como fallback
const PROJECT_ROOT = app ? app.getAppPath() : path.resolve(__dirname, '..', '..', '..');
const PORTAR_SRC_PATH = path.join(PROJECT_ROOT, 'Portear', 'src');

// Configuración del servidor LLM (Flask existente)
const LLM_SERVER_HOST = '127.0.0.1';
const LLM_SERVER_PORT = 5555;  // Puerto Flask (llm_server.py)
const LLM_SERVER_URL = `http://${LLM_SERVER_HOST}:${LLM_SERVER_PORT}`;
const LLM_SERVER_SCRIPT = 'llm_server.py';

// Variable para rastrear el estado del servidor
let llmServerProcess = null;
let llmServerReady = false;
let llmServerStarting = false;

console.log('[HANDLERS] Project root:', PROJECT_ROOT);
console.log('[HANDLERS] Portear src path:', PORTAR_SRC_PATH);
console.log('[HANDLERS] LLM Server URL:', LLM_SERVER_URL);
console.log('[HANDLERS] LLM Server Script:', LLM_SERVER_SCRIPT);

// Resuelve la ruta del intérprete de Python priorizando SIEMPRE el Python embebido
// del proyecto (Portear/python-embed/python.exe), que tiene todas las dependencias
// instaladas (docxtpl, transformers, torch, etc.).
//
// Bug histórico: si global.getPython aún no estaba inicializado cuando se cargó este
// módulo (porque investigacion_handlers.js se requiere en main.js ANTES de que se
// defina global.getPython = getPython), el fallback retornaba 'python' del PATH del
// sistema, que es un Python diferente sin las dependencias → ImportError al ejecutar
// accident_processor.py (ej: "No module named 'docxtpl'").
//
// Ahora: verificamos primero el Python embebido si existe, luego el .venv, luego
// delegamos a global.getPython, y solo al final caemos al 'python' del sistema.
async function resolvePython() {
    // 1. PRIORIDAD MÁXIMA: Python embebido del proyecto (Portear/python-embed/python.exe)
    const embeddedPath = path.join(PORTAR_SRC_PATH, '..', 'python-embed', 'python.exe');
    if (fs.existsSync(embeddedPath)) {
        console.log('[PYTHON-RESOLVE] Usando Python embebido del proyecto:', embeddedPath);
        // Cachear para que global.cachedPythonPath no use otro Python
        global.cachedPythonPath = embeddedPath;
        return embeddedPath;
    }

    // 2. .venv del proyecto como segunda opción
    const venvPath = path.join(PORTAR_SRC_PATH, '..', '.venv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPath)) {
        console.log('[PYTHON-RESOLVE] Usando .venv del proyecto:', venvPath);
        global.cachedPythonPath = venvPath;
        return venvPath;
    }

    // 3. Delegar a global.getPython si está disponible (definido por main.js)
    if (typeof global.getPython === 'function') {
        try {
            const pyPath = await global.getPython();
            if (pyPath && fs.existsSync(pyPath)) {
                console.log('[PYTHON-RESOLVE] Usando global.getPython:', pyPath);
                return pyPath;
            }
        } catch (e) {
            console.warn('[PYTHON-RESOLVE] global.getPython() falló:', e.message);
        }
    }

    // 4. Cache en memoria si existe y es válido
    if (global.cachedPythonPath && fs.existsSync(global.cachedPythonPath)) {
        console.log('[PYTHON-RESOLVE] Usando global.cachedPythonPath:', global.cachedPythonPath);
        return global.cachedPythonPath;
    }

    // 5. Último recurso: 'python' del PATH (probablemente fallará por deps faltantes)
    console.warn('[PYTHON-RESOLVE] ⚠ Ningún Python del proyecto encontrado, usando "python" del PATH (puede fallar por dependencias faltantes)');
    return 'python';
}

function sendLog(message, level = 'INFO') {
    console.log(`[${level}] ${message}`);
    if (global.mainWindow) {
        global.mainWindow.webContents.send('log-message', message, level);
    }
}

// --- FUNCIONES PARA COMUNICACIÓN CON SERVIDOR LLM ---

/**
 * Realiza una petición HTTP al servidor LLM
 */
function llmServerRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: LLM_SERVER_HOST,
            port: LLM_SERVER_PORT,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 1200000 // 20 minutos de timeout
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonResponse = JSON.parse(responseData);
                    resolve(jsonResponse);
                } catch (e) {
                    reject(new Error(`Error parseando respuesta: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Error de conexión con servidor LLM: ${e.message}`));
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout conectando con servidor LLM'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Verifica si el servidor LLM está corriendo
 */
async function checkLlmServerHealth() {
    try {
        const response = await llmServerRequest('/health', 'GET');
        // Solo retornar true si el modelo está cargado
        return response.model_loaded === true;
    } catch (e) {
        sendLog(`[LLM] Health check falló: ${e.message}`, 'WARN');
        return false;
    }
}

/**
 * Verifica si el servidor está corriendo (sin verificar modelo)
 */
async function checkLlmServerRunning() {
    try {
        const response = await llmServerRequest('/status', 'GET');
        return response.server_port !== undefined;
    } catch (e) {
        return false;
    }
}

/**
 * Probe rápido (3s timeout) del servidor Flask. Retorna true si responde,
 * false si conexión rehusada o timeout. Usado para auto-recuperación.
 */
async function probeLlmServer() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: LLM_SERVER_HOST,
            port: LLM_SERVER_PORT,
            path: '/health',
            method: 'GET',
            timeout: 3000,
        }, (res) => {
            // Cualquier respuesta HTTP (incluso 503) cuenta como "vivo"
            resolve(true);
            res.resume();
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

/**
 * Verifica si Ollama está corriendo en :11434. Si no, lo inicia en background.
 * Esto evita que el usuario tenga que correr `ollama serve` manualmente.
 *
 * Además, mata instancias zombies de Ollama que puedan haber quedado de arranques
 * anteriores. Tener múltiples ollama.exe escuchando en :11434 causa que las
 * peticiones HTTP se conecten aleatoriamente a cualquiera de ellas — algunas
 * están zombie y no responden, dando falsos "Ollama no está corriendo".
 */
async function ensureOllamaRunning() {
    // 0. Matar instancias zombie previas para evitar conflictos de puerto.
    // Esto sucede cuando la app se cerró abruptamente o Ollama quedó colgado.
    try {
        const { execSync } = require('child_process');
        const out = execSync('tasklist /FI "IMAGENAME eq ollama.exe" /FO CSV /NH', { encoding: 'utf-8', timeout: 5000 });
        const pids = [...out.matchAll(/ollama\.exe","(\d+)"/g)].map(m => parseInt(m[1], 10));
        if (pids.length > 0) {
            sendLog(`[OLLAMA] Detectadas ${pids.length} instancias previas de ollama.exe. Verificando cuál responde...`);
            // Probar cada una; matar las que NO responden
            const livePids = [];
            for (const pid of pids) {
                const alive = await new Promise((resolve) => {
                    const req = http.request({ hostname: '127.0.0.1', port: 11434, path: '/api/tags', method: 'GET', timeout: 1500 }, (res) => {
                        resolve(true);
                        res.resume();
                    });
                    req.on('error', () => resolve(false));
                    req.on('timeout', () => { req.destroy(); resolve(false); });
                    req.end();
                });
                if (alive) {
                    livePids.push(pid);
                } else {
                    sendLog(`[OLLAMA] Matando instancia zombie PID ${pid} (no responde)`);
                    try { execSync(`taskkill /F /PID ${pid}`, { encoding: 'utf-8', timeout: 3000 }); } catch (e) { /* ignorar */ }
                }
            }
            if (livePids.length > 0) {
                sendLog(`[OLLAMA] Ya hay ${livePids.length} instancia(s) viva(s). Reutilizando.`);
                return true;
            }
        }
    } catch (e) {
        sendLog(`[OLLAMA] No se pudo enumerar instancias previas: ${e.message}`, 'WARN');
    }

    // 1. Verificar si Ollama ya responde
    try {
        await new Promise((resolve, reject) => {
            const req = http.request({ hostname: '127.0.0.1', port: 11434, path: '/', method: 'GET', timeout: 2000 }, (res) => {
                resolve();
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.end();
        });
        sendLog('[OLLAMA] Ya está corriendo en :11434');
        return true;
    } catch (e) {
        sendLog('[OLLAMA] No responde, intentando iniciar...');
    }

    // 2. Intentar iniciar `ollama serve` en background
    const { spawn } = require('child_process');
    const candidates = [
        'ollama',                                          // PATH
        'C:\\Users\\Javier RF\\AppData\\Local\\Programs\\Ollama\\ollama.exe', // instalación típica Windows
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    ];
    for (const cmd of candidates) {
        try {
            sendLog(`[OLLAMA] Intentando iniciar con: ${cmd} serve`);
            const proc = spawn(cmd, ['serve'], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });
            proc.unref();
            // Esperar hasta 15s a que responda
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 500));
                try {
                    await new Promise((resolve, reject) => {
                        const req = http.request({ hostname: '127.0.0.1', port: 11434, path: '/', method: 'GET', timeout: 1000 }, () => resolve());
                        req.on('error', reject);
                        req.end();
                    });
                    sendLog(`[OLLAMA] Iniciado correctamente (PID ${proc.pid})`);
                    return true;
                } catch (e) { /* seguir esperando */ }
            }
            sendLog('[OLLAMA] No respondió en 15s, continuando de todas formas...', 'WARN');
            return false;
        } catch (e) {
            sendLog(`[OLLAMA] No se pudo iniciar con ${cmd}: ${e.message}`, 'WARN');
        }
    }
    sendLog('[OLLAMA] No se pudo iniciar automáticamente. El usuario debe correr "ollama serve" manualmente.', 'WARN');
    return false;
}

/**
 * Inicia el servidor LLM si no está corriendo
 */
async function startLlmServer() {
    // 0. Asegurar que Ollama esté corriendo (lo inicia si no lo está)
    await ensureOllamaRunning();

    // Verificar si ya está corriendo CON MODELO CARGADO
    const isRunning = await checkLlmServerHealth();
    if (isRunning) {
        sendLog('[LLM] Servidor LLM ya está corriendo con modelo cargado');
        llmServerReady = true;
        return true;
    }

    // Verificar si el servidor está corriendo (aunque el modelo no esté cargado)
    const serverRunning = await checkLlmServerRunning();
    if (serverRunning) {
        sendLog('[LLM] Servidor LLM ya está corriendo, esperando carga del modelo...');
        llmServerStarting = true;
        return true;
    }

    sendLog('[LLM] Iniciando servidor LLM...');

	// Obtener ruta de Python
	const pythonExecutable = await resolvePython();
	if (!pythonExecutable) {
		throw new Error('No se encontró Python en el sistema');
	}

    const serverScriptPath = path.join(PORTAR_SRC_PATH, 'llm_server.py');
    
    // Verificar que el script existe
    if (!require('fs').existsSync(serverScriptPath)) {
        throw new Error(`Script del servidor no encontrado: ${serverScriptPath}`);
    }

    sendLog(`[LLM] Iniciando servidor con: "${pythonExecutable}" "${serverScriptPath}"`);

    // Iniciar el servidor como proceso en background
    llmServerProcess = spawn(pythonExecutable, [serverScriptPath], {
        cwd: path.dirname(serverScriptPath),
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    llmServerProcess.unref();

    sendLog('[LLM] Proceso del servidor iniciado, PID: ' + llmServerProcess.pid);
    sendLog('[LLM] Esperando a que el servidor esté listo...');

    // Esperar a que el servidor esté listo (modelo puede estar cargando)
    const maxAttempts = 300; // 10 minutos máximo
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            const status = await llmServerRequest('/health', 'GET');
            sendLog(`[LLM] Intento ${i + 1}: status=${status.status}, model_loaded=${status.model_loaded}`);
            
            if (status.model_loaded === true) {
                sendLog('[LLM] Servidor LLM iniciado correctamente con modelo cargado');
                llmServerReady = true;
                return true;
            }
            
            // Si el servidor está corriendo pero el modelo está cargando, continuar esperando
            if (status.status === 'loading') {
                if (i % 15 === 0) {
                    sendLog(`[LLM] Modelo cargando... (${Math.floor(i * 2 / 60)}min ${i * 2 % 60}s)`);
                }
                continue;
            }
        } catch (e) {
            sendLog(`[LLM] Error verificando servidor (intento ${i + 1}): ${e.message}`, 'WARN');
        }
        
        if (i % 30 === 0 && i > 0) {
            sendLog(`[LLM] Esperando servidor... (${Math.floor(i * 2 / 60)}min ${i * 2 % 60}s)`);
        }
    }

    throw new Error('Timeout esperando al servidor LLM');
}

/**
 * Analiza un accidente usando el servidor LLM
 */
async function analyzeAccidentViaServer(descripcion, contexto) {
    // Auto-recuperación: si Flask no responde, marcar como caído y reiniciar.
    // Esto cubre el caso donde Ollama se cayó y el wrapper Flask también.
    const probeOk = await probeLlmServer();
    if (!probeOk) {
        sendLog('[LLM] Servidor Flask no responde, reiniciando...', 'WARN');
        llmServerReady = false;
        llmServerProcess = null;
    }

    // Verificar/Iniciar servidor
    if (!llmServerReady) {
        await startLlmServer();
    }

    // Verificar que el modelo está cargado
    sendLog('[LLM] Verificando estado del modelo...');
    const health = await llmServerRequest('/health', 'GET');
    
    if (!health.model_loaded) {
        sendLog('[LLM] Modelo no cargado, esperando...');
        
        // Esperar a que el modelo esté listo (máximo 15 minutos)
        const maxAttempts = 450; // 15 minutos
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const status = await llmServerRequest('/health', 'GET');
            
            if (status.model_loaded) {
                sendLog('[LLM] Modelo cargado correctamente');
                break;
            }
            
            if (i % 30 === 0) {
                sendLog(`[LLM] Esperando carga del modelo... (${Math.floor(i * 2 / 60)}min)`);
            }
            
            if (i === maxAttempts - 1) {
                return {
                    success: false,
                    error: 'Timeout esperando carga del modelo LLM'
                };
            }
        }
    }

    sendLog('[LLM] Enviando solicitud de análisis al servidor...');

    const response = await llmServerRequest('/analyze', 'POST', {
        descripcion: descripcion,
        contexto: contexto || ''
    });

    return response;
}


// --- ACCIDENT INVESTIGATION HANDLERS ---

// 🔒 Bloqueo anti-duplicación para prevenir ejecuciones paralelas
let isProcessingPdf = false;
let isAnalyzingAccident = false;

ipcMain.handle('investigacion-accidentes-select-accident-pdf', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });
    return result.canceled ? null : result.filePaths[0];
});

// Función para descargar y guardar temporalmente un archivo blob
async function downloadBlobToFile(blobUrl, fileName) {
    try {
        // Convertir blob URL a Buffer
        const response = await fetch(blobUrl);
        const buffer = await response.arrayBuffer();
        
        // Crear nombre de archivo temporal
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, fileName);
        
        // Escribir el archivo temporalmente
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        
        return tempFilePath;
    } catch (error) {
        console.error('Error descargando blob a archivo temporal:', error);
        throw error;
    }
}

ipcMain.handle('investigacion-accidentes-process-accident-pdf', async (event, pdfPath) => {
    // 🔒 Bloqueo anti-duplicación
    if (isProcessingPdf) {
        sendLog('⛔ Ya hay un procesamiento de PDF en curso, ignorando solicitud duplicada');
        return { success: false, error: 'Ya hay un procesamiento en curso' };
    }
    isProcessingPdf = true;
    
    try {
        sendLog(`IPC: investigacion-accidentes-process-accident-pdf (extract) recibido para: ${pdfPath}`);
        
        // Verificar si la ruta es una URL blob y convertirla a archivo físico si es necesario
        let actualPdfPath = pdfPath;
        if (pdfPath.startsWith('blob:')) {
            const fileName = `temp_pdf_${Date.now()}.pdf`;
            actualPdfPath = await downloadBlobToFile(pdfPath, fileName);
            sendLog(`Archivo blob convertido a archivo temporal: ${actualPdfPath}`);
        }

	// Obtener ruta de Python usando la función robusta de main.js
	const pythonExecutable = await resolvePython();
	if (!pythonExecutable) {
		throw new Error('No se encontró Python en el sistema. Por favor instale Python 3.10+ y agréguelo al PATH.');
	}

	sendLog(`[DEBUG] Python resuelto: "${pythonExecutable}"`);

	// USAR PORTAR_SRC_PATH para ruta correcta
	const pythonScriptPath = path.join(PORTAR_SRC_PATH, 'accident_processor.py');
        
        // Verificar que el script existe
        if (!require('fs').existsSync(pythonScriptPath)) {
            throw new Error(`Script de Python no encontrado en: ${pythonScriptPath}`);
	}

	const { spawn } = require('child_process');

	sendLog(`[DEBUG] pythonExecutable: "${pythonExecutable}"`);
	sendLog(`[DEBUG] pythonScriptPath: "${pythonScriptPath}"`);
	sendLog(`[DEBUG] actualPdfPath: "${actualPdfPath}"`);

	const pythonProcess = spawn(pythonExecutable, [
		pythonScriptPath,
		'extract',
		'--pdf_path',
		actualPdfPath
	], {
		cwd: path.dirname(pythonScriptPath),
		timeout: 120000,
		windowsHide: true,
		env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
	});
        
        let stdoutData = '';
        let stderrData = '';
        
        return new Promise((resolve, reject) => {
            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
                sendLog(`Python stderr: ${data}`, 'ERROR');
            });
            
            pythonProcess.on('close', (code) => {
                sendLog(`Python process closed with code: ${code}`);
                sendLog(`stdoutData: ${stdoutData}`);
                
                if (code !== 0) {
                    reject(new Error(`Script de Python falló con código ${code}: ${stderrData}`));
                } else {
                    try {
                        // Buscar la línea que contiene el resultado final (type: "result")
                        const lines = stdoutData.split('\n');
                        let resultJson = null;
                        
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('{') && trimmedLine.includes('"type": "result"')) {
                                try {
                                    resultJson = JSON.parse(trimmedLine);
                                    break;
                                } catch (e) {
                                    // Continuar buscando
                                }
                            }
                        }
                        
                        if (resultJson && resultJson.type === 'result') {
                            resolve({ success: true, data: resultJson.payload });
                        } else {
                            // Fallback: buscar cualquier JSON en la salida
                            const jsonMatch = stdoutData.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const result = JSON.parse(jsonMatch[0]);
                                if (result.type === 'result') {
                                    resolve({ success: true, data: result.payload });
                                } else {
                                    resolve({ success: true, data: result });
                                }
                            } else {
                                throw new Error('No se encontró JSON válido en la salida');
                            }
                        }
                    } catch (e) {
                        sendLog(`Error parsing output: ${stdoutData}`, 'ERROR');
                        // Devolver datos vacíos pero con éxito
                        resolve({ success: true, data: { error: 'No se pudieron extraer datos del PDF' } });
                    }
                }
            });
            
            pythonProcess.on('error', (err) => {
                sendLog(`Python process error: ${err.message}`, 'ERROR');
                reject(err);
            });
        });
        
    } catch (error) {
        sendLog(`Error en process-accident-pdf: ${error.message}`, 'ERROR');
        throw error;
    } finally {
        // 🔓 Liberar bloqueo
        isProcessingPdf = false;
    }
});

// ============================================================================
// IPC: Gestión de Modelos Ollama + Configuración IA (desde Configuración IA tab)
// ============================================================================

/**
 * Lista los modelos Ollama disponibles.
 * Devuelve la lista de modelos + el modelo activo actualmente.
 */
ipcMain.handle('llm-list-models', async () => {
    try {
        const response = await llmServerRequest('/models', 'GET', null);
        return response;
    } catch (error) {
        sendLog(`Error listando modelos LLM: ${error.message}`, 'ERROR');
        return { success: false, error: error.message, models: [], active_model: null };
    }
});

/**
 * Cambia el modelo Ollama activo en caliente (sin reiniciar Flask).
 * Body: { model: 'nombre' }
 */
ipcMain.handle('llm-select-model', async (event, { model }) => {
    try {
        if (!model || typeof model !== 'string') {
            return { success: false, error: 'Se requiere el nombre del modelo' };
        }
        const response = await llmServerRequest('/models/select', 'POST', { model });
        sendLog(`[LLM-CONFIG] Modelo cambiado a: ${response.active_model || model}`);
        return response;
    } catch (error) {
        sendLog(`Error cambiando modelo LLM: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
});

/**
 * Obtiene la configuración LLM (modelo + temperatura + max_tokens + prompt).
 */
ipcMain.handle('llm-get-config', async () => {
    try {
        const response = await llmServerRequest('/llm-config', 'GET', null);
        return response;
    } catch (error) {
        sendLog(`Error leyendo config LLM: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
});

/**
 * Guarda la configuración LLM y aplica cambios en caliente.
 * Body: { llmModel?, llmTemperature?, llmMaxTokens?, llmSystemPrompt? }
 */
ipcMain.handle('llm-save-config', async (event, config) => {
    try {
        const response = await llmServerRequest('/llm-config', 'POST', config || {});
        sendLog(`[LLM-CONFIG] Config guardada: model=${response.config?.llmModel}`);
        return response;
    } catch (error) {
        sendLog(`Error guardando config LLM: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
});

ipcMain.handle('investigacion-accidentes-analyze-accident', async (event, extractedData, contextoAdicional) => {
    // 🔒 Bloqueo anti-duplicación
    if (isAnalyzingAccident) {
        sendLog('⛔ Ya hay un análisis en curso, ignorando solicitud duplicada');
        return { success: false, error: 'Ya hay un análisis en curso' };
    }
    isAnalyzingAccident = true;

    try {
        sendLog(`IPC: analyze-accident recibido`);
        sendLog(`[DEBUG] extractedData es de tipo: ${typeof extractedData}`);
        sendLog(`[DEBUG] extractedData tiene success: ${extractedData?.success}`);
        sendLog(`[DEBUG] extractedData.data tiene success: ${extractedData?.data?.success}`);

        // 🔧 CORRECCIÓN: Extraer solo los datos del accidente del wrapper (DOBLE wrapper)
        let dataToAnalyze = extractedData;

        // Primer nivel de desanidamiento
        if (extractedData && extractedData.success && extractedData.data) {
            const primerNivel = extractedData.data;
            sendLog(`[DEBUG] Primer nivel - tiene success: ${primerNivel?.success}, tiene data: ${!!primerNivel?.data}`);
            // Segundo nivel de desanidamiento
            if (primerNivel && primerNivel.success && primerNivel.data) {
                dataToAnalyze = primerNivel.data;
                sendLog('[DEBUG] Datos desanidados del DOBLE wrapper para análisis');
            } else {
                dataToAnalyze = primerNivel;
                sendLog('[DEBUG] Datos desanidados del wrapper (un nivel) para análisis');
            }
        }

        // Debug: verificar que la descripción existe
        const descripcion = dataToAnalyze['Descripcion del Accidente'] || dataToAnalyze['Descripcion'];
        sendLog(`[DEBUG] Claves en dataToAnalyze: ${Object.keys(dataToAnalyze).join(', ')}`);
        sendLog(`[DEBUG] Descripción encontrada: ${descripcion ? descripcion.substring(0, 80) + '...' : 'NO ENCONTRADA'}`);

        // 🚀 NUEVO ENFOQUE: Usar servidor HTTP persistente (FastAPI)
        sendLog('[LLM] Iniciando análisis con servidor HTTP persistente...');
        
        // Verificar que hay descripción
        if (!descripcion || descripcion.trim() === 'N/A') {
            sendLog('[LLM] Descripción no válida, retornando fallback', 'WARN');
            return {
                success: true,
                data: {
                    PorQue1: {
                        Pregunta: '¿Por qué ocurrió el accidente?',
                        'Mano de Obra': 'N/A - Descripción no disponible',
                        'Método': 'N/A',
                        'Maquinaria': 'N/A',
                        'Medio Ambiente': 'N/A',
                        'Material': 'N/A'
                    }
                },
                raw_text: 'No se pudo generar análisis - descripción no disponible',
                generation_time: 0
            };
        }

        // Enviar solicitud al servidor LLM
        sendLog('[LLM] Enviando solicitud al servidor LLM...');
        
        const response = await llmServerRequest('/analyze', 'POST', {
            descripcion: descripcion,
            contexto: contextoAdicional || ''
        });

        sendLog(`[LLM] Respuesta recibida: success=${response.success}`);

        if (!response.success) {
            sendLog(`[LLM] Error en análisis: ${response.error}`, 'ERROR');
            return {
                success: false,
                error: response.error || 'Error desconocido en el análisis'
            };
        }

        // Enviar evento de progreso al frontend
        if (event.sender) {
            event.sender.send('accident-processing-progress', {
                type: 'progress',
                step: 'completed',
                percentage: 100,
                message: 'Análisis completado exitosamente'
            });
        }

        sendLog('[LLM] Análisis completado exitosamente');

        return {
            success: true,
            data: response.data,
            raw_text: response.raw_text,
            generation_time: response.generation_time
        };

    } catch (error) {
        sendLog(`Error en analyze-accident: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    } finally {
        // 🔓 Liberar bloqueo
        isAnalyzingAccident = false;
    }
});

/**
 * Regenera el análisis 5 Porqués (total o parcial) con feedback del usuario.
 *
 * Request body:
 *   - descripcion:        descripción del accidente (string, requerido)
 *   - contexto:          contexto adicional (string, opcional)
 *   - feedback:          comentario del usuario (string, opcional)
 *   - level:             1-5 para regenerar SOLO ese nivel; null/ausente = regenerar todo
 *   - current_analysis:  análisis actual (objeto, usado como referencia)
 *
 * Response: { success, data, raw_text, generation_time, regenerated_level }
 *   - regenerated_level: número regenerado (1-5) o null si fue completo
 */
ipcMain.handle('investigacion-accidentes-regenerate-analysis', async (event, { descripcion, contexto, feedback, level, currentAnalysis }) => {
    try {
        sendLog(`IPC: regenerate-analysis recibido (level=${level}, feedback=${(feedback || '').length} chars)`);

        if (!descripcion || !descripcion.trim()) {
            return { success: false, error: 'Se requiere la descripción del accidente' };
        }
        if (level !== null && level !== undefined && !(Number.isInteger(level) && level >= 1 && level <= 5)) {
            return { success: false, error: `level debe ser 1-5 o null, recibido: ${level}` };
        }

        const response = await llmServerRequest('/regenerate', 'POST', {
            descripcion: descripcion,
            contexto: contexto || '',
            feedback: feedback || '',
            level: level,
            current_analysis: currentAnalysis || {}
        });

        sendLog(`[LLM] Regeneración completada: success=${response.success} (level=${response.regenerated_level})`);
        return response;
    } catch (error) {
        sendLog(`Error en regenerate-analysis: ${error.message}`, 'ERROR');
        return { success: false, error: error.message };
    }
});

ipcMain.handle('investigacion-accidentes-generate-accident-report', (event, combinedData) => {
    return new Promise(async (resolve, reject) => {
        let tempDataPath;
        try {
            sendLog(`IPC: generate-accident-report recibido`);
            sendLog(`[DEBUG] combinedData keys: ${Object.keys(combinedData || {}).join(', ')}`);
            sendLog(`[DEBUG] combinedData.empresa: ${combinedData?.empresa}`);
            
      // Obtener empresa del combinedData, o usar TEMPOACTIVA como fallback
      const empresa = (combinedData?.empresa || 'TEMPOACTIVA').toUpperCase();
      sendLog(`[DEBUG] Empresa final para informe: ${empresa}`);

      const outputDir = combinedData?._outputDir || null;
      const outputFilename = combinedData?._outputFilename || null;
      if (outputDir) sendLog(`[DEBUG] Output dir override: ${outputDir}`);
      if (outputFilename) sendLog(`[DEBUG] Output filename override: ${outputFilename}`);

      tempDataPath = path.join(app.getPath('temp'), `accident_report_data_${Date.now()}.json`);
      const reportData = { combinedData: combinedData, empresa: empresa, outputDir: outputDir, outputFilename: outputFilename };
            await fsp.writeFile(tempDataPath, JSON.stringify(reportData, null, 2));

	const pythonExecutable = await resolvePython();
            const pythonScriptPath = path.join(PORTAR_SRC_PATH, 'accident_report_generator.py');
            await fsp.access(pythonScriptPath);

            const pythonProcess = spawn(pythonExecutable, ['-X', 'utf8', pythonScriptPath, tempDataPath], { cwd: path.dirname(pythonScriptPath) });

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
            pythonProcess.stderr.on('data', (data) => { stderrData += data.toString(); sendLog(`[Python STDERR] ${data}`, 'ERROR'); });

            pythonProcess.on('close', async (code) => {
                if (tempDataPath) await fsp.unlink(tempDataPath).catch(err => sendLog(`No se pudo limpiar el archivo temporal: ${err.message}`, 'WARN'));
                if (code !== 0) return reject(new Error(`El script de Python falló con código ${code}. STDERR: ${stderrData || '(vacío)'}. Revisa los logs.`));

                try {
                    const finalResult = JSON.parse(stdoutData.match(/^[\s\S]*\{.*\}[\s\S]*$/s)[0]);
                    if (finalResult.documentPath && finalResult.documentPath.startsWith('\\?\\')) {
                        finalResult.documentPath = finalResult.documentPath.substring(4);
                    }
                    finalResult.documentPath = finalResult.documentPath.replace(/[\\\/]/g, path.sep);
                    resolve(finalResult);
                } catch(e) {
                    reject(new Error(`El script de Python no devolvió un resultado JSON válido. Salida: ${stdoutData}`));
                }
            });
            pythonProcess.on('error', (err) => reject(err));
        } catch (error) {
            if (tempDataPath) await fsp.unlink(tempDataPath).catch(err => sendLog(`No se pudo limpiar el archivo temporal tras error: ${err.message}`, 'WARN'));
            reject(error);
        }
    });
});

// Función para guardar archivos temporalmente
ipcMain.handle('investigacion-accidentes-save-temp-file', async (event, filename, data) => {
    try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        // Crear nombre de archivo temporal
        const tempDir = os.tmpdir();
        const uniqueFilename = `temp_investigation_pdf_${Date.now()}_${filename}`;
        const tempFilePath = path.join(tempDir, uniqueFilename);
        
        // Convertir el array de bytes de vuelta a Buffer y escribir el archivo
        const buffer = Buffer.from(data);
        fs.writeFileSync(tempFilePath, buffer);
        
        return {
            success: true,
            filePath: tempFilePath
        };
    } catch (error) {
        console.error('Error guardando archivo temporal:', error);
        throw error;
    }
});

// Función para guardar archivos PDF temporalmente
ipcMain.handle('investigacion-accidentes-save-temp-pdf-file', async (event, filename, data) => {
    try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        // Asegurar que el nombre del archivo tenga extensión .pdf
        let pdfFilename = filename;
        if (!pdfFilename.toLowerCase().endsWith('.pdf')) {
            pdfFilename += '.pdf';
        }
        
        // Crear nombre de archivo temporal
        const tempDir = os.tmpdir();
        const uniqueFilename = `temp_investigation_pdf_${Date.now()}_${pdfFilename}`;
        const tempFilePath = path.join(tempDir, uniqueFilename);
        
        // Convertir el array de bytes de vuelta a Buffer y escribir el archivo
        const buffer = Buffer.from(data);
        fs.writeFileSync(tempFilePath, buffer);
        
        return {
            success: true,
            filePath: tempFilePath
        };
    } catch (error) {
        console.error('Error guardando archivo PDF temporal:', error);
        throw error;
    }
});

ipcMain.handle('investigacion-accidentes-get-config', async (event, empresa) => {
	const pythonExecutable = await resolvePython();
	const investAppPath = path.join(PORTAR_SRC_PATH, 'Invest_APP_V_3.py');
    const { stdout } = await promisify(execFile)(pythonExecutable, [investAppPath, '--get-config', empresa], { cwd: path.dirname(investAppPath) });
    return JSON.parse(stdout.trim());
});

/**
 * Inicializa el servidor LLM en segundo plano
 * Esta función retorna INMEDIATAMENTE - el modelo carga en background
 */
async function initializeLlmServer() {
    try {
        sendLog('[LLM] Inicializando servidor LLM en segundo plano...');

        // 0. Asegurar que Ollama esté corriendo (lo inicia si no lo está).
        // Esto cubre el caso donde el usuario abre la app sin haber ejecutado
        // 'ollama serve' manualmente.
        await ensureOllamaRunning();
        
        // Verificar si ya está corriendo CON MODELO CARGADO
        const isRunning = await checkLlmServerHealth();
        if (isRunning) {
            sendLog('[LLM] Servidor LLM ya está inicializado con modelo cargado');
            llmServerReady = true;
            return true;
        }
        
        // Verificar si el servidor está iniciando (pero modelo aún no cargado)
        if (llmServerStarting) {
            sendLog('[LLM] Servidor LLM ya está iniciando...');
            return true;
        }
        
        // Iniciar servidor en segundo plano
        sendLog('[LLM] Iniciando servidor LLM...');
        
	// Obtener ruta de Python
	const pythonExecutable = await resolvePython();
	if (!pythonExecutable) {
		sendLog('[LLM] No se encontró Python, se iniciará bajo demanda', 'WARN');
		return false;
	}
	sendLog(`[LLM] Python resuelto: ${pythonExecutable}`);

	const serverScriptPath = path.join(PORTAR_SRC_PATH, 'llm_server.py');
	sendLog(`[LLM] Ruta del script: ${serverScriptPath}`);

	// Verificar que el script existe
	if (!fs.existsSync(serverScriptPath)) {
		sendLog(`[LLM] Script del servidor no encontrado: ${serverScriptPath}`, 'ERROR');
		return false;
	}

	sendLog(`[LLM] Iniciando servidor: "${pythonExecutable}" "${serverScriptPath}"`);

	llmServerProcess = spawn(pythonExecutable, [serverScriptPath], {
		cwd: path.dirname(serverScriptPath),
		detached: false,
		stdio: ['ignore', 'pipe', 'pipe'],
		windowsHide: true,
		env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });

        sendLog(`[LLM] Proceso del servidor iniciado, PID: ${llmServerProcess.pid}`);
        
        // Variable para tracking de progreso de carga del modelo
        let lastLoggedPercent = -1;
        let modelLoadStartTime = Date.now();
        let progressFinished = false;  // Evitar múltiples mensajes de finalización

        // Función para dibujar barra de progreso en una sola línea (ASCII compatible)
        function drawProgressBar(percent, elapsed) {
            const barWidth = 30;
            const filledWidth = Math.round((barWidth * percent) / 100);
            const emptyWidth = barWidth - filledWidth;
            // Usar caracteres ASCII compatibles con Windows
            const bar = '='.repeat(filledWidth) + '-'.repeat(emptyWidth);
            
            // Construir línea de progreso
            const progressLine = `[LLM] Cargando modelo... [${bar}] ${percent}% (${elapsed}s)`;
            
            // Limpiar línea y escribir nueva (compatible con Windows)
            process.stdout.write(`\r${' '.repeat(80)}\r${progressLine}`);
        }

        // Función para finalizar la barra de progreso (mover a nueva línea)
        function finishProgressBar(message) {
            if (progressFinished) return;  // Evitar múltiples finalizaciones
            progressFinished = true;
            process.stdout.write(`\r${' '.repeat(80)}\r${message}\n`);
        }

        // Capturar stdout del servidor - FILTRAR progreso de tqdm
        llmServerProcess.stdout.on('data', (data) => {
            const msg = data.toString();
            
            // Filtrar líneas de progreso de carga de pesos del modelo (tqdm)
            if (msg.includes('Loading weights:') || msg.includes('Materializing param=')) {
                // Extraer porcentaje si está disponible
                const percentMatch = msg.match(/(\d+)%/);
                if (percentMatch) {
                    const percent = parseInt(percentMatch[1]);
                    // Actualizar cada 5% para mayor fluidez
                    if (percent - lastLoggedPercent >= 5 || percent === 100) {
                        lastLoggedPercent = percent;
                        const elapsed = ((Date.now() - modelLoadStartTime) / 1000).toFixed(0);
                        drawProgressBar(percent, elapsed);
                        
                        // Si llegó a 100%, finalizar barra
                        if (percent === 100) {
                            finishProgressBar(`[LLM] OK: Modelo cargado exitosamente (${elapsed}s)`);
                        }
                    }
                }
                return; // No imprimir la línea completa de tqdm
            }
            
            // Imprimir otros mensajes normales
            sendLog(`[LLM SERVER] ${msg.trim()}`);
        });

        // Capturar stderr del servidor - FILTRAR progreso de tqdm
        llmServerProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            
            // Filtrar líneas de progreso de carga de pesos del modelo (también van a stderr)
            if (msg.includes('Loading weights:') || msg.includes('Materializing param=') || msg.includes('tqdm')) {
                // Extraer porcentaje si está disponible
                const percentMatch = msg.match(/(\d+)%/);
                if (percentMatch) {
                    const percent = parseInt(percentMatch[1]);
                    // Actualizar cada 5% para mayor fluidez
                    if (percent - lastLoggedPercent >= 5 || percent === 100) {
                        lastLoggedPercent = percent;
                        const elapsed = ((Date.now() - modelLoadStartTime) / 1000).toFixed(0);
                        drawProgressBar(percent, elapsed);
                        
                        // Si llegó a 100%, finalizar barra
                        if (percent === 100) {
                            finishProgressBar(`[LLM] OK: Modelo cargado exitosamente (${elapsed}s)`);
                        }
                    }
                }
                return; // No imprimir la línea completa de tqdm
            }
            
            // Imprimir solo errores reales (excluyendo progreso)
            const errorMsg = msg.trim();
            if (errorMsg && !errorMsg.includes('Loading weights:') && !errorMsg.includes('Materializing')) {
                // Finalizar barra de progreso si hay error
                if (lastLoggedPercent < 100 && lastLoggedPercent >= 0 && !progressFinished) {
                    finishProgressBar(`[LLM] ERROR: Fallo al cargar modelo`);
                }
                sendLog(`[LLM SERVER ERROR] ${errorMsg}`, 'ERROR');
            }
        });
        
        // Manejar cierre del proceso
        llmServerProcess.on('close', (code) => {
            sendLog(`[LLM] Servidor cerrado con código: ${code}`, code === 0 ? 'INFO' : 'ERROR');
            llmServerStarting = false;
            llmServerReady = false;
        });
        
        // Manejar error del proceso
        llmServerProcess.on('error', (err) => {
            sendLog(`[LLM] Error en el proceso del servidor: ${err.message}`, 'ERROR');
            llmServerStarting = false;
            llmServerReady = false;
        });
        
        sendLog('[LLM] Servidor LLM iniciado en segundo plano');
        sendLog('[LLM] El modelo se cargará bajo demanda cuando se solicite el primer análisis');
        
        llmServerStarting = true;
        llmServerReady = false;  // No marcar como listo hasta que el modelo cargue
        
        return true;
        
    } catch (error) {
        sendLog(`[LLM] Error inicializando servidor: ${error.message}`, 'ERROR');
        llmServerStarting = false;
        return false;
    }
}

// ============================================================================
// INVESTIGACIÓN MANAGEMENT HANDLERS
// Gestión de investigaciones: listar, contar, detalle (no confundir con los
// handlers de análisis IA que ya existen arriba)
// ============================================================================

/**
 * Helper: encuentra la ruta del submódulo de investigación para una empresa.
 * Reutiliza la misma lógica de mapeo que get-document-folders en main.js.
 */
async function _findInvestigacionSubmodulePath(companyName) {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    const configData = await fsp.readFile(configPath, 'utf8').catch(() => '{}');
    const config = JSON.parse(configData);

    if (!config.companyPaths || !config.companyPaths[companyName]) {
        throw new Error(`No se encontró configuración para la empresa: ${companyName}`);
    }

    const actualCompanyStructure = config.companyPaths[companyName]?.structure?.structure;
    if (!actualCompanyStructure) {
        throw new Error(`La estructura de directorios para la empresa '${companyName}' es inválida o no está mapeada.`);
    }

    // DEBUG: Imprimir estructura mapeada
    sendLog(`[INV-PATH-DEBUG] Estructura raíz: name="${actualCompanyStructure.name}", path="${actualCompanyStructure.path}"`, 'INFO');
    sendLog(`[INV-PATH-DEBUG] Subdirectorios en raíz: [${Object.keys(actualCompanyStructure.subdirectories || {}).join(', ')}]`, 'INFO');

    // Buscar la carpeta que contenga el código "3.2.2" (Investigación de Accidentes)
    // NOTA: Los nodos NO tienen mappedPath, solo tienen name, path y subdirectories
    function searchInStructure(node, targetCode) {
      if (!node) return null;
      const codeRegex = new RegExp(targetCode.replace(/\./g, '\\.') + '\\b');
      if (node.name && codeRegex.test(node.name)) {
        return node.path || null;
      }
      if (node.subdirectories) {
        for (const childName of Object.keys(node.subdirectories)) {
          const child = node.subdirectories[childName];
          if (child.name && codeRegex.test(child.name)) {
            return child.path || null;
          }
          const found = searchInStructure(child, targetCode);
          if (found) return found;
        }
      }
      return null;
    }

    const submodulePath = searchInStructure(actualCompanyStructure, '3.2.2');
    if (!submodulePath) {
        sendLog(`[INV-PATH-DEBUG] Búsqueda fallida: No se encontró ningún nodo con "3.2.2" en el nombre`, 'ERROR');
        throw new Error(`No se pudo encontrar la ruta del submódulo 3.2.2 para la empresa '${companyName}'.`);
    }
    sendLog(`[INV-PATH-DEBUG] Ruta encontrada: ${submodulePath}`, 'INFO');
    return submodulePath;
}

/**
 * Helper: determina si un nombre de carpeta corresponde a un patrón de año
 * (ej: "AT 2024", "2024", "Año 2025", etc.)
 */
function _isYearFolder(name) {
    // Busca un año de 4 dígitos que empiece con 19 o 20
    return /\b(19|20)\d{2}\b/.test(name);
}

/**
 * Helper: extrae el año del relativePath buscando el segmento "AT YYYY" o "YYYY".
 * Ej: "Investigaciones/2. Accidentes/AT 2023/7. Julio/Cristian Alvarez" → 2023
 * Retorna el año como número, o null si no se encuentra.
 */
function _extractYearFromPath(relativePath) {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  for (const part of parts) {
    const m = part.match(/\b((?:19|20)\d{2})\b/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function _buildDateFromPath(relativePath) {
  const year = _extractYearFromPath(relativePath);
  const month = _extractMonthFromPath(relativePath);
  if (year) {
    const monthNum = month ? month.number - 1 : 0;
    return new Date(year, monthNum, 1);
  }
  return null;
}

function _extractMonthFromPath(relativePath) {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  for (const part of parts) {
    const m = part.match(/(\d{1,2})[.\-\s]+(\w+)/);
    if (m) {
      const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      const monthName = m[2].toLowerCase();
      const idx = monthNames.findIndex(n => monthName.includes(n));
      if (idx >= 0) return { number: idx + 1, name: monthNames[idx].charAt(0).toUpperCase() + monthNames[idx].slice(1) };
    }
  }
  for (const part of parts) {
    const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const lower = part.toLowerCase().trim();
    const idx = monthNames.findIndex(n => lower.includes(n));
    if (idx >= 0) return { number: idx + 1, name: monthNames[idx].charAt(0).toUpperCase() + monthNames[idx].slice(1) };
  }
  return null;
}

/**
 * Helper: determina si un nombre de carpeta corresponde a un patrón de mes
 * (ej: "1. Enero", "2. Febrero", "01-Enero", etc.)
 */
function _isMonthFolder(name) {
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const lowerName = name.toLowerCase();
    return monthNames.some(m => lowerName.includes(m));
}

/**
 * Helper: determina si un archivo es un documento de investigación de accidente,
 * independientemente del esquema de nombre usado (FURAT, InformeATE, GI-FO-020, etc.)
 */
function _isInvestigationFile(filename) {
    const upper = filename.toUpperCase();
    const lower = filename.toLowerCase();
    const isDoc = lower.endsWith('.pdf') || lower.endsWith('.docx');
    if (!isDoc) return false;
    return (
        upper.includes('FURAT')          ||
        upper.includes('INFORMEATE')     ||
        upper.includes('INFORMEAT ')     ||
        upper.includes('GI-FO-020')      ||
        upper.includes('INVESTIGACION')
    );
}

function _extractPersonName(filename) {
  const noExt = filename.replace(/\.[^.]+$/, '');
  let m;

  m = noExt.match(/^FURAT\s+(.+)/i);
  if (m) return m[1].trim();

  m = noExt.match(/^Furat\s+(.+)/i);
  if (m) return m[1].trim();

  m = noExt.match(/InformeATEmpleadorContratante\s+(.+)/i);
  if (m) return m[1].trim();

  m = noExt.match(/^InformeATE?[-\s]+(.+)/i);
  if (m) return m[1].trim();

  m = noExt.match(/GI-FO-020[_\s]+INVESTIGACION(?:\s+DE\s+(?:INCIDENTES|ACCIDENTES))?[._\s]+(.+)/i);
  if (m) {
    let name = m[1].trim();
    const dateSuffix = name.match(/^(.+?)\s+\d{8}(_\d+)?$/);
    if (dateSuffix) name = dateSuffix[1].trim();
    const underscoreName = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const titleCase = underscoreName.replace(/\b\w/g, c => c.toUpperCase());
    return titleCase;
  }

  m = noExt.match(/^(.+?)\s+AT\s+\d{2}-\d{2}-\d{4}$/i);
  if (m) return m[1].trim();

  m = noExt.match(/^\d{6,8}\s*(.+)$/);
  if (m) {
    const candidate = m[1].trim();
    if (candidate.length > 2 && !/^\d+$/.test(candidate)) return candidate;
  }

  m = noExt.match(/^(.+?)\s*-\s*\d.*$/);
  if (m) {
    const candidate = m[1].trim();
    if (!/^(GI|FURAT|INFORME|REPORTE)/i.test(candidate)) return candidate;
  }

  if (/^(FURAT|InformeATEmpleadorContratante|InformeATE?\s*$)/i.test(noExt.trim())) {
    return noExt.trim();
  }

  return noExt.trim();
}

/**
 * Helper: descubre investigaciones dentro de una ruta base, soportando:
 *  - Estructura plana: <basePath>/<investigación>/FURAT.pdf
 *  - Estructura año/mes: <basePath>/<año>/<mes>/<investigación>/FURAT.pdf
 *  - Estructura con carpetas intermedias: <basePath>/Investigaciones/2. Accidentes/<año>/<mes>/...
 *
 * Retorna un array de objetos con:
 *  { name, relativePath, fullPath, isFolder, hasFurat }
 */
async function _discoverInvestigations(basePath) {
    const investigations = [];

    /**
     * Determina si un nombre corresponde a una carpeta intermedia conocida
     * (no es una investigación ni un año ni un mes)
     */
    function isIntermediateFolder(name) {
        const intermediates = ['investigaciones', '1. eventos', '2. accidentes',
                               '3. incidentes menores', '4. procedimientos'];
        return intermediates.some(i => name.toLowerCase().includes(i));
    }

    /**
     * Procesa una carpeta que potencialmente contiene investigaciones.
     * Si tiene FURAT directo → es investigación.
     * Si tiene subcarpetas → verificar recursivamente.
     */
    async function processFolder(folderPath, relativeFrom) {
        let items;
        try {
            items = await fsp.readdir(folderPath, { withFileTypes: true });
        } catch (err) { return; }

        // Verificar si esta carpeta es una investigación válida (tiene FURAT)
        const hasFurat = items.some(item =>
            item.isFile() && item.name.toUpperCase().includes('FURAT') && item.name.toLowerCase().endsWith('.pdf')
        );

        if (hasFurat) {
            const folderName = path.basename(folderPath);
            const relativePath = path.relative(relativeFrom, folderPath);
            sendLog(`[INV-DISCOVER] ✅ Investigación encontrada: ${relativePath}`, 'INFO');
            investigations.push({
                name: folderName,
                relativePath,
                fullPath: folderPath,
                isFolder: true,
                hasFurat: true
            });
            return; // No descendemos más, ya es una investigación
        }

        const relPath = path.relative(relativeFrom, folderPath);
        const dirCount = items.filter(i => i.isDirectory()).length;
        const fileCount = items.filter(i => i.isFile()).length;
        sendLog(`[INV-DISCOVER] 📂 Explorando: ${relPath || '(raíz)'} → ${dirCount} carpetas, ${fileCount} archivos`, 'INFO');

        // Si no tiene FURAT, explorar subcarpetas
        for (const item of items) {
            if (!item.isDirectory()) continue;
            const itemPath = path.join(folderPath, item.name);

            if (isIntermediateFolder(item.name)) {
                // Carpeta intermedia: descender automáticamente
                sendLog(`[INV-DISCOVER]   ↳ Carpeta intermedia: ${item.name}`, 'INFO');
                await processFolder(itemPath, relativeFrom);
            } else if (_isYearFolder(item.name)) {
                // Carpeta de año: buscar meses e investigaciones dentro
                sendLog(`[INV-DISCOVER]   ↳ Carpeta de año: ${item.name}`, 'INFO');
                await processYearFolder(itemPath, folderPath, relativeFrom);
            } else if (_isMonthFolder(item.name)) {
                // Carpeta de mes: buscar investigaciones dentro
                sendLog(`[INV-DISCOVER]   ↳ Carpeta de mes: ${item.name}`, 'INFO');
                await processMonthFolder(itemPath, folderPath, relativeFrom);
            } else {
                // Carpeta genérica: verificar si es investigación o contenedor
                await processFolder(itemPath, relativeFrom);
            }
        }
    }

    /**
     * Procesa una carpeta de año (AT 2024, 2024, etc.)
     */
    async function processYearFolder(yearPath, basePath, relativeFrom) {
        let yearItems;
        try {
            yearItems = await fsp.readdir(yearPath, { withFileTypes: true });
        } catch (err) { return; }

        const monthFolders = yearItems.filter(item => item.isDirectory() && _isMonthFolder(item.name));

        if (monthFolders.length > 0) {
            // Estructura Año > Mes > Investigación
            for (const monthItem of monthFolders) {
                await processMonthFolder(path.join(yearPath, monthItem.name), basePath, relativeFrom);
            }
        } else {
            // Año sin meses nombrados: buscar investigaciones directas
            for (const subItem of yearItems) {
                if (!subItem.isDirectory()) {
                    if (subItem.name.toLowerCase().endsWith('.pdf') && subItem.name.toUpperCase().includes('FURAT')) {
                        const relativePath = path.relative(relativeFrom, path.join(yearPath, subItem.name));
                        investigations.push({
                            name: subItem.name,
                            relativePath,
                            fullPath: path.join(yearPath, subItem.name),
                            isFolder: false,
                            hasFurat: true
                        });
                    }
                    continue;
                }
                await processFolder(path.join(yearPath, subItem.name), relativeFrom);
            }
        }
    }

    /**
     * Procesa una carpeta de mes (1. Enero, Enero, etc.)
     */
    async function processMonthFolder(monthPath, basePath, relativeFrom) {
        let monthItems;
        try {
            monthItems = await fsp.readdir(monthPath, { withFileTypes: true });
        } catch (err) { return; }

        const relMonth = path.relative(relativeFrom, monthPath);
        const dirs = monthItems.filter(i => i.isDirectory()).map(i => i.name);
        const files = monthItems.filter(i => i.isFile()).map(i => i.name);
        sendLog(`[INV-DISCOVER]   📋 Contenido de mes "${relMonth}": carpetas=[${dirs.join(', ')}], archivos=[${files.join(', ')}]`, 'INFO');

        for (const subItem of monthItems) {
            const subItemPath = path.join(monthPath, subItem.name);
            if (subItem.isDirectory()) {
                // Verificar si es una investigación (tiene FURAT)
                let folderFiles;
                try {
                    folderFiles = await fsp.readdir(subItemPath, { withFileTypes: true });
                } catch (err) { continue; }

                const subFileNames = folderFiles.filter(f => f.isFile()).map(f => f.name);
                sendLog(`[INV-DISCOVER]     🔍 Revisando carpeta "${subItem.name}": archivos=[${subFileNames.join(', ')}]`, 'INFO');

                const hasFurat = folderFiles.some(f =>
                    f.isFile() && f.name.toUpperCase().includes('FURAT') && f.name.toLowerCase().endsWith('.pdf')
                );

                if (hasFurat) {
                    const relativePath = path.relative(relativeFrom, subItemPath);
                    sendLog(`[INV-DISCOVER]     ✅ ¡FURAT encontrado en: ${relativePath}`, 'INFO');
                    investigations.push({
                        name: subItem.name,
                        relativePath,
                        fullPath: subItemPath,
                        isFolder: true,
                        hasFurat: true
                    });
                }
            }
        }

        // Agrupar archivos sueltos de investigación por persona
        const looseInvFiles = monthItems.filter(i => i.isFile() && _isInvestigationFile(i.name));
        if (looseInvFiles.length > 0) {
            const byPerson = new Map();
            for (const f of looseInvFiles) {
                    const personName = _extractPersonName(f.name);
                    const key = personName.toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/\s+/g, '_');
                if (!byPerson.has(key)) {
                    byPerson.set(key, { personName, files: [], hasFurat: false, hasInforme: false });
                }
                const entry = byPerson.get(key);
                entry.files.push(f.name);
                if (f.name.toUpperCase().includes('FURAT')) entry.hasFurat = true;
                if (f.name.toUpperCase().includes('GI-FO-020') ||
                    f.name.toUpperCase().includes('INFORMEATE') ||
                    f.name.toUpperCase().includes('INFORMEAT ') ||
                    f.name.toLowerCase().includes('informe')) {
                    entry.hasInforme = true;
                }
            }
            for (const [, entry] of byPerson) {
                const relativePath = path.relative(relativeFrom, monthPath);
                sendLog(`[INV-DISCOVER]   ✅ Investigación encontrada (archivos sueltos): ${entry.personName}`, 'INFO');
                investigations.push({
                    name: entry.personName,
                    relativePath,
                    fullPath: monthPath,
                    isFolder: false,
                    hasFurat: entry.hasFurat,
                    _filesInMonth: entry.files,
                    _hasInforme: entry.hasInforme
                });
            }
        }
    }

    // Iniciar el descubrimiento desde la raíz
    await processFolder(basePath, basePath);

    return investigations;
}

/**
 * Helper: analiza el contenido de una carpeta de investigación y determina
 * su estado (pendiente, completada).
 *
 * Criterios:
 * - PENDIENTE: solo contiene archivos FURAT (PDFs con "FURAT" en el nombre)
 * - COMPLETADA: contiene un archivo con "Informe_Investigacion" o "informe" en el nombre
 */
function _analyzeInvestigationState(folderName, files) {
  const hasFurat = files.some(f =>
    f.name.toUpperCase().includes('FURAT') && f.name.toLowerCase().endsWith('.pdf')
  );

  const hasInforme = files.some(f => {
    const u = f.name.toUpperCase();
    const l = f.name.toLowerCase();
    return (
      l.includes('informe_investigacion') ||
      l.includes('informe de investigacion') ||
      l.includes('informe_accidente') ||
      u.includes('INFORMEATE') ||
      u.includes('INFORMEAT ') ||
      u.includes('GI-FO-020') ||
      u.includes('PSP-F-005') ||
      l.includes('leccion') && l.includes('aprendida')
    );
  });

  if (hasInforme) {
    return { estado: 'completada', tipo: 'carpeta', reason: 'Con informe final' };
  }
  if (hasFurat && !hasInforme) {
    return { estado: 'pendiente', tipo: 'carpeta', reason: 'Solo FURAT, sin informe final' };
  }
  return { estado: 'pendiente', tipo: 'carpeta', reason: 'Sin FURAT ni informe' };
}

function _isInformeFile(filename) {
  const u = filename.toUpperCase();
  const l = filename.toLowerCase();
  return (
    u.includes('GI-FO-020') ||
    u.includes('INFORMEATE') ||
    u.includes('INFORMEAT ') ||
    u.includes('PSP-F-005') ||
    l.includes('informe_investigacion') ||
    l.includes('informe de investigacion') ||
    l.includes('informe_accidente') ||
    (l.includes('leccion') && l.includes('aprendida'))
  );
}

function _analyzeLooseFilesState(files) {

  const hasFurat = files.some(f =>
    f.toUpperCase().includes('FURAT') && f.toLowerCase().endsWith('.pdf')
  );
  const hasInforme = files.some(f => _isInformeFile(f));

  if (hasInforme) {
    return { estado: 'completada', reason: 'Con informe final' };
  }
  if (hasFurat && !hasInforme) {
    return { estado: 'pendiente', reason: 'Solo FURAT, sin informe final' };
  }
  return { estado: 'pendiente', reason: 'Sin FURAT ni informe' };
}

/**
 * IPC Handler: investigacion-accidentes-get-stats
 * Cuenta investigaciones pendientes y completadas en la carpeta del submódulo.
 *
 * Input: { companyName: string }
 * Output: { success: true, data: { pendientes: N, completadas: N, total: N } }
 */
ipcMain.handle('investigacion-accidentes-get-stats', async (event, { companyName }) => {
    try {
        sendLog(`[INV-STATS] Solicitud de estadísticas para: ${companyName}`, 'INFO');

        if (!companyName) {
            return { success: false, error: { code: 'MISSING_COMPANY', message: 'Nombre de empresa requerido' } };
        }

        const submodulePath = await _findInvestigacionSubmodulePath(companyName);

        if (!fs.existsSync(submodulePath)) {
            sendLog(`[INV-STATS] La ruta del submódulo no existe: ${submodulePath}`, 'WARN');
            return { success: true, data: { pendientes: 0, completadas: 0, total: 0 } };
        }

        // Usar el mismo descubrimiento que el list handler para consistencia
  const discovered = await _discoverInvestigations(submodulePath);
  let pendientes = 0;
  let completadas = 0;

        for (const inv of discovered) {
            if (!inv.isFolder) {
                const looseState = _analyzeLooseFilesState(inv._filesInMonth || []);
                if (looseState.estado === 'completada') completadas++;
                else pendientes++;
                continue;
            }
     try {
       const folderFiles = await fsp.readdir(inv.fullPath, { withFileTypes: true });
       const fileInfos = folderFiles
         .filter(f => f.isFile())
         .map(f => ({ name: f.name, path: path.join(inv.fullPath, f.name) }));
       const state = _analyzeInvestigationState(inv.name, fileInfos);
       if (state.estado === 'completada') {
         completadas++;
       } else {
         pendientes++;
       }
     } catch (err) {
       pendientes++;
     }
   }

   const total = pendientes + completadas;
   const result = {
     success: true,
     data: {
       pendientes,
       completadas,
       total
     }
   };

   sendLog(`[INV-STATS] Estadísticas para ${companyName}: ${pendientes} pendientes, ${completadas} completadas, ${total} total`, 'INFO');
        return result;

    } catch (error) {
        sendLog(`[INV-STATS] Error: ${error.message}`, 'ERROR');
        return { success: false, error: { code: 'STATS_ERROR', message: error.message } };
    }
});

/**
 * Helper: extrae la fecha real del evento desde el nombre del archivo FURAT.
 * Soporta formatos: YYYYMMDD, DDMMYY, YYYY-MM-DD.
 * Retorna un objeto Date o null.
 */
function _extractFuratDate(name) {
  if (!name) return null;
  const noExt = name.replace(/\.[^.]+$/, '');

  // Patrón 1: YYYYMMDD (e.g. ...20250609)
  let m = noExt.match(/(\d{4})(\d{2})(\d{2})(?![\d])/);
  if (m) {
    const [_, year, month, day] = m;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (date.getFullYear() === parseInt(year)) return date;
  }

  // Patrón 2: DDMMYY (e.g. ...010625)
  m = noExt.match(/(\d{2})(\d{2})(\d{2})(?![\d])/);
  if (m) {
    const [_, day, month, yearShort] = m;
    const year = 2000 + parseInt(yearShort);
    if (year > 2020) {
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      if (date.getFullYear() === year) return date;
    }
  }

  // Patrón 3: YYYY-MM-DD
  m = noExt.match(/(\d{4})[-](\d{2})[-](\d{2})/);
  if (m) {
    const [_, year, month, day] = m;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (date.getFullYear() === parseInt(year)) return date;
  }

  return null;
}

/**
 * Helper: determina el estado 'completada' si existe un informe final en archivos.
 */
function _hasInformeFinal(archivos) {
  return archivos.some(f => _isInformeFile(f.name));
}

/**
 * IPC Handler: investigacion-accidentes-find-furat-by-name
 * Busca el archivo FURAT (PDF) en el módulo 3.2.1 por nombre de caso.
 * Se usa como fallback cuando el viewer no envía la ruta del FURAT.
 *
 * Input: { companyName: string, caseName: string }
 * Output: { success: true, data: { furatPath, furatName, relativePath } } | { success: false, error }
 */
ipcMain.handle('investigacion-accidentes-find-furat-by-name', async (event, { companyName, caseName }) => {
    try {
        sendLog(`[INV-FIND-FURAT] Buscando FURAT para "${caseName}" en empresa ${companyName}`, 'INFO');

        if (!companyName || !caseName) {
            return { success: false, error: { code: 'MISSING_PARAMS', message: 'companyName y caseName requeridos' } };
        }

        const furatBasePath = await _findReportesAccidentesSubmodulePath(companyName);
        if (!furatBasePath || !fs.existsSync(furatBasePath)) {
            return { success: false, error: { code: 'PATH_NOT_FOUND', message: 'Ruta 3.2.1 no encontrada' } };
        }

        // Normalizar el caseName para búsqueda flexible
        const normalize = (s) => (s || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');

        const targetNormalized = normalize(caseName);

        // Buscar recursivamente en toda la estructura
        const found = await _findFuratRecursive(furatBasePath, targetNormalized, normalize);

        if (found) {
            sendLog(`[INV-FIND-FURAT] FURAT encontrado: ${found.furatPath}`, 'INFO');
            return { success: true, data: found };
        }

        sendLog(`[INV-FIND-FURAT] No se encontró FURAT para "${caseName}"`, 'WARN');
        return { success: false, error: { code: 'NOT_FOUND', message: `No se encontró FURAT para "${caseName}"` } };
    } catch (error) {
        sendLog(`[INV-FIND-FURAT] Error: ${error.message}`, 'ERROR');
        return { success: false, error: { code: 'FIND_ERROR', message: error.message } };
    }
});

/**
 * Helper recursivo: busca archivo PDF en toda la estructura cuyo nombre normalizado
 * contenga el targetNormalized (o viceversa). Retorna el primero que coincida.
 */
async function _findFuratRecursive(dirPath, targetNormalized, normalizeFn) {
    try {
        const entries = await fsp.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                // Saltar carpetas del sistema y de backups
                if (entry.name.startsWith('.') || entry.name === 'desktop.ini' || entry.name.startsWith('$')) continue;
                const result = await _findFuratRecursive(fullPath, targetNormalized, normalizeFn);
                if (result) return result;
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ext !== '.pdf') continue;
                if (entry.name === 'desktop.ini') continue;
                const fileNormalized = normalizeFn(entry.name);
                // Match: target contenido en nombre OR nombre contenido en target
                if (fileNormalized.includes(targetNormalized) || targetNormalized.includes(fileNormalized)) {
                    return {
                        furatPath: fullPath,
                        furatName: entry.name,
                        relativePath: fullPath
                    };
                }
            }
        }
    } catch (_) { /* silencioso */ }
    return null;
}

/**
 * IPC Handler: investigacion-accidentes-list-investigations (v2)
 * Lista TODOS los eventos (FURATs + Investigaciones) unificados.
 * - Fuentes: 3.2.1 (FURATs) y 3.2.2 (Investigaciones).
 * - Si un FURAT tiene investigación → estado 'completada'.
 * - Si un FURAT NO tiene investigación → estado 'pendiente'.
 * - La fecha se extrae del nombre del archivo FURAT si es posible.
 *
 * Input: { companyName: string, filter?: 'todas' | 'pendiente' | 'completada' }
 * Output: { success: true, data: [ { id, nombre, estado, fecha, archivos: [] } ] }
 */
 if (!ipcMain.listenerCount('investigacion-accidentes-list-investigations')) {
ipcMain.handle('investigacion-accidentes-list-investigations', async (event, { companyName, filter }) => {
    try {
        sendLog(`[INV-LIST] Solicitud de lista para: ${companyName}, filtro: ${filter || 'todas'}`, 'INFO');

        if (!companyName) {
            return { success: false, error: { code: 'MISSING_COMPANY', message: 'Nombre de empresa requerido' } };
        }

        // ============== BLOQUE 1: DESCUBRIR INVESTIGACIONES (3.2.2) ==============
        let invPath = null;
        let invDiscovered = [];
        try {
          invPath = await _findInvestigacionSubmodulePath(companyName);
          if (fs.existsSync(invPath)) {
            invDiscovered = await _discoverInvestigations(invPath);
            sendLog(`[INV-LIST] Investigaciones descubiertas en 3.2.2: ${invDiscovered.length}`, 'INFO');
          }
        } catch (err) {
          sendLog(`[INV-LIST] Error descubriendo investigaciones: ${err.message}`, 'WARN');
        }

        // ============== BLOQUE 2: DESCUBRIR FURATS (3.2.1) ==============
        let furatPath = null;
        let furatDiscovered = [];
        try {
          furatPath = await _findReportesAccidentesSubmodulePath(companyName);
          if (furatPath && fs.existsSync(furatPath)) {
            furatDiscovered = await _discoverInvestigations(furatPath);
            sendLog(`[INV-LIST] FURATs descubiertos en 3.2.1: ${furatDiscovered.length}`, 'INFO');
          }
        } catch (err) {
          sendLog(`[INV-LIST] Error descubriendo FURATs: ${err.message}`, 'WARN');
        }

        // ============== BLOQUE 3: CONSTRUIR MAPA DE INVESTIGACIONES ==============
        const invByName = new Map();
        for (const inv of invDiscovered) {
          const key = inv.name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

          let archivos = [];
          let hasInformeFinal = false;
          if (inv.isFolder) {
            try {
              const folderFiles = await fsp.readdir(inv.fullPath, { withFileTypes: true });
              archivos = folderFiles.filter(f => f.isFile()).map(f => {
                const filePath = path.join(inv.fullPath, f.name);
                try {
                  const stats = fs.statSync(filePath);
                  return { name: f.name, path: filePath, extension: path.extname(f.name).substring(1), size: stats.size, modified: stats.mtime.toISOString() };
                } catch (_) {
                  return { name: f.name, path: filePath, extension: path.extname(f.name).substring(1), size: 0, modified: new Date().toISOString() };
                }
              });
              hasInformeFinal = _hasInformeFinal(archivos);
            } catch (_) {}
          } else {
            archivos = (inv._filesInMonth || []).map(fname => {
              const fp = path.join(inv.fullPath, fname);
              try {
                const s = fs.statSync(fp);
                return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: s.size, modified: s.mtime.toISOString() };
              } catch (_) {
                return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: 0, modified: new Date().toISOString() };
              }
            });
            hasInformeFinal = _hasInformeFinal(archivos);
          }

          invByName.set(key, {
            ...inv,
            archivos,
            hasInformeFinal,
            estado: hasInformeFinal ? 'completada' : 'pendiente',
            fechaReal: _extractFuratDate(inv.name) || _buildDateFromPath(inv.relativePath)
          });
        }

        // ============== BLOQUE 4: UNIFICAR CON FURATS ==============
        const investigations = new Map(); // Usar Map para evitar duplicados por nombre normalizado

        // Primero agregamos todos los FURATs como base
        for (const furat of furatDiscovered) {
          const key = furat.name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

          const fechaReal = _extractFuratDate(furat.name);
          let archivos = [];

          if (furat.isFolder) {
            try {
              const folderFiles = await fsp.readdir(furat.fullPath, { withFileTypes: true });
              archivos = folderFiles.filter(f => f.isFile()).map(f => {
                const filePath = path.join(furat.fullPath, f.name);
                try {
                  const stats = fs.statSync(filePath);
                  return { name: f.name, path: filePath, extension: path.extname(f.name).substring(1), size: stats.size, modified: stats.mtime.toISOString() };
                } catch (_) {
                  return { name: f.name, path: filePath, extension: path.extname(f.name).substring(1), size: 0, modified: new Date().toISOString() };
                }
              });
            } catch (_) {}
          } else {
            archivos = (furat._filesInMonth || []).map(fname => {
              const fp = path.join(furat.fullPath, fname);
              try {
                const s = fs.statSync(fp);
                return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: s.size, modified: s.mtime.toISOString() };
              } catch (_) {
                return { name: fname, path: fp, extension: path.extname(fname).substring(1), size: 0, modified: new Date().toISOString() };
              }
            });
          }

          // Verificar si existe una investigación completa para este FURAT
          const invMatch = invByName.get(key);
          let estado = 'pendiente';
          let allArchivos = [...archivos];
    let fecha = fechaReal || _buildDateFromPath(furat.relativePath);

    if (invMatch) {
      if (invMatch.hasInformeFinal) {
        estado = 'completada';
      }
      allArchivos = [...allArchivos, ...invMatch.archivos];
      if (!fecha && invMatch.fechaReal) fecha = invMatch.fechaReal;
    }

    if (!fecha) fecha = new Date();

          investigations.set(key, {
            id: `inv-${furat.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
            nombre: furat.name,
            estado,
            tipo: 'evento',
            fecha: fecha.toISOString(),
      año: _extractYearFromPath(furat.relativePath),
      mes: _extractMonthFromPath(furat.relativePath),
      totalArchivos: allArchivos.length,
      archivos: allArchivos,
      relativePath: furat.relativePath,
      hasFurat: true
          });
        }

        // Segundo: agregar investigaciones que NO tuvieron FURAT (raras, pero posibles)
        for (const [key, inv] of invByName) {
          if (!investigations.has(key)) {
    let fecha = inv.fechaReal || _buildDateFromPath(inv.relativePath);
    if (!fecha) fecha = new Date();

            investigations.set(key, {
              id: `inv-${inv.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
              nombre: inv.name,
              estado: inv.estado,
              tipo: 'only_investigacion',
              fecha: fecha.toISOString(),
        año: _extractYearFromPath(inv.relativePath),
        mes: _extractMonthFromPath(inv.relativePath),
        totalArchivos: inv.archivos.length,
        archivos: inv.archivos,
        relativePath: inv.relativePath,
        hasFurat: false
            });
          }
        }

        // ============== BLOQUE 5: FILTRAR Y ORDENAR ==============
        let results = Array.from(investigations.values());
        if (filter && filter !== 'todas') {
          results = results.filter(r => r.estado === filter);
        }

        results.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        sendLog(`[INV-LIST] ${results.length} eventos encontrados (unificados FURAT + Investigaciones)`, 'INFO');
      return { success: true, data: results };

    } catch (error) {
      sendLog(`[INV-LIST] Error: ${error.message}`, 'ERROR');
      return { success: false, error: { code: 'LIST_ERROR', message: error.message } };
    }
  });
}

/**
 * IPC Handler: investigacion-accidentes-get-investigation-detail
 * Obtiene el detalle completo de una investigación específica.
 * Soporta investigationName como nombre directo o relativePath (año/mes/nombre).
 *
 * Input: { companyName: string, investigationName: string }
 *        investigationName puede ser: "AT 2024", "AT 2024/1. Enero/NombreInv", o solo "NombreInv"
 * Output: { success: true, data: { id, nombre, estado, fecha, archivos: [], informePath?: string } }
 */
ipcMain.handle('investigacion-accidentes-get-investigation-detail', async (event, { companyName, investigationName }) => {
    try {
        sendLog(`[INV-DETAIL] Solicitud de detalle para: ${companyName}, investigación: ${investigationName}`, 'INFO');

        if (!companyName || !investigationName) {
            return { success: false, error: { code: 'MISSING_PARAMS', message: 'Nombre de empresa e investigación requeridos' } };
        }

        const submodulePath = await _findInvestigacionSubmodulePath(companyName);

        if (!fs.existsSync(submodulePath)) {
            return { success: false, error: { code: 'PATH_NOT_FOUND', message: `Ruta del submódulo no encontrada para ${companyName}` } };
        }

        // Intentar resolver la ruta de la investigación
        let investigationPath = null;
        let investigationNameOnly = null;
        let isFolder = false;

        // Estrategia 1: Si investigationName contiene separadores de ruta, es un relativePath
        if (investigationName.includes('/') || investigationName.includes('\\')) {
            const fullPath = path.join(submodulePath, investigationName);
            if (fs.existsSync(fullPath)) {
                const stat = fs.statSync(fullPath);
                investigationPath = fullPath;
                isFolder = stat.isDirectory();
                investigationNameOnly = path.basename(investigationName);
            }
        }

        // Estrategia 2: Intentar como nombre directo en la raíz del submódulo
        if (!investigationPath) {
            const folderCandidate = path.join(submodulePath, investigationName);
            if (fs.existsSync(folderCandidate)) {
                const stat = fs.statSync(folderCandidate);
                if (stat.isDirectory()) {
                    investigationPath = folderCandidate;
                    isFolder = true;
                    investigationNameOnly = investigationName;
                } else if (stat.isFile() && investigationName.toLowerCase().endsWith('.pdf')) {
                    investigationPath = folderCandidate;
                    isFolder = false;
                    investigationNameOnly = investigationName;
                }
            }
        }

        // Estrategia 3: Usar descubrimiento recursivo para buscar por nombre
        if (!investigationPath) {
            const discovered = await _discoverInvestigations(submodulePath);
            const searchTerm = investigationName.toLowerCase();

            // Buscar por coincidencia exacta o parcial en el nombre
            const match = discovered.find(d =>
                d.name.toLowerCase() === searchTerm || d.name.toLowerCase().includes(searchTerm)
            );

            if (match) {
                investigationPath = match.fullPath;
                isFolder = match.isFolder;
                investigationNameOnly = match.name;
            }
        }

        // Estrategia 4: Búsqueda fuzzy en la raíz (fallback legacy)
        if (!investigationPath) {
            const items = await fsp.readdir(submodulePath, { withFileTypes: true });
            const searchTerm = investigationName.toLowerCase();

            for (const item of items) {
                if (item.name.toLowerCase().includes(searchTerm)) {
                    investigationPath = path.join(submodulePath, item.name);
                    isFolder = item.isDirectory();
                    investigationNameOnly = item.name;
                    break;
                }
            }
        }

        if (!investigationPath) {
            return { success: false, error: { code: 'INVESTIGATION_NOT_FOUND', message: `No se encontró la investigación: ${investigationName}` } };
        }

        let archivos = [];
        let state;
        let modifiedDate;

        if (isFolder) {
            const folderFiles = await fsp.readdir(investigationPath, { withFileTypes: true });
            archivos = folderFiles
                .filter(f => f.isFile())
                .map(f => {
                    const filePath = path.join(investigationPath, f.name);
                    const stats = fs.statSync(filePath);
                    return {
                        name: f.name,
                        path: filePath,
                        extension: path.extname(f.name).substring(1),
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    };
                });

            const folderStats = fs.statSync(investigationPath);
            modifiedDate = folderStats.mtime.toISOString();
            state = _analyzeInvestigationState(investigationNameOnly, archivos);
        } else {
            const fileStats = fs.statSync(investigationPath);
            modifiedDate = fileStats.mtime.toISOString();
            archivos = [{
                name: path.basename(investigationPath),
                path: investigationPath,
                extension: 'pdf',
                size: fileStats.size,
                modified: fileStats.mtime.toISOString()
            }];
            state = { estado: 'pendiente', tipo: 'archivo' };
        }

        // Buscar informe
        const informe = archivos.find(f =>
            f.name.toLowerCase().includes('informe_investigacion') ||
            f.name.toLowerCase().includes('informe de investigacion')
        );

        const result = {
            success: true,
            data: {
                id: `inv-${investigationNameOnly.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
                nombre: investigationNameOnly,
                estado: state.estado,
                tipo: isFolder ? 'carpeta' : 'archivo',
                fecha: modifiedDate,
                totalArchivos: archivos.length,
                archivos,
                informePath: informe ? informe.path : null
            }
        };

        sendLog(`[INV-DETAIL] Detalle obtenido para: ${investigationNameOnly}`, 'INFO');
        return result;

    } catch (error) {
        sendLog(`[INV-DETAIL] Error: ${error.message}`, 'ERROR');
        return { success: false, error: { code: 'DETAIL_ERROR', message: error.message } };
    }
});

async function _findReportesAccidentesSubmodulePath(companyName) {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  let config;
  try {
    const configData = await fsp.readFile(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    sendLog(`[XREF-DEBUG] Error leyendo config.json: ${err.message}`, 'WARN');
    return null;
  }

  if (!config.companyPaths || !config.companyPaths[companyName]) {
    sendLog(`[XREF-DEBUG] No se encontró empresa: ${companyName}`, 'WARN');
    return null;
  }

  const actualCompanyStructure = config.companyPaths[companyName]?.structure?.structure;
  if (!actualCompanyStructure) {
    sendLog(`[XREF-DEBUG] Estructura inválida para: ${companyName}`, 'WARN');
    return null;
  }

  function searchInStructure(node, targetCode) {
    if (!node) return null;
    const codeRegex = new RegExp(targetCode.replace(/\./g, '\\.') + '\\b');
    if (node.name && codeRegex.test(node.name)) {
      return node.path || null;
    }
    if (node.subdirectories) {
      for (const childName of Object.keys(node.subdirectories)) {
        const child = node.subdirectories[childName];
        if (child.name && codeRegex.test(child.name)) {
          return child.path || null;
        }
        const found = searchInStructure(child, targetCode);
        if (found) return found;
      }
    }
    return null;
  }

  const submodulePath = searchInStructure(actualCompanyStructure, '3.2.1');
  if (!submodulePath) {
    sendLog(`[XREF-DEBUG] No se encontró nodo "3.2.1" para ${companyName}`, 'WARN');
    return null;
  }
  sendLog(`[XREF-DEBUG] Ruta 3.2.1 encontrada: ${submodulePath}`, 'INFO');
  return submodulePath;
}

function _isSamePerson(nameA, nameB) {
  const normalize = (s) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const a = normalize(nameA);
  const b = normalize(nameB);

  if (a === b) return true;

  const tokensA = a.split(' ').filter(t => t.length > 1);
  const tokensB = b.split(' ').filter(t => t.length > 1);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const matchCount = tokensA.filter(tA =>
    tokensB.some(tB => tA === tB || (tA.length >= 4 && tB.length >= 4 && (tA.includes(tB) || tB.includes(tA))))
  ).length;

  const minTokens = Math.min(tokensA.length, tokensB.length);
  const overlap = matchCount / minTokens;

  if (overlap >= 0.6 && minTokens >= 2) return true;
  if (overlap >= 0.8 && minTokens >= 1) return true;

  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const sortedA = [...tokensA].sort().join(' ');
    const sortedB = [...tokensB].sort().join(' ');
    if (sortedA === sortedB) return true;
  }

  return false;
}

ipcMain.handle('investigacion-accidentes-cross-reference-data', async (event, { companyName }) => {
  try {
    sendLog(`[XREF] Solicitud cross-reference para: ${companyName}`, 'INFO');

    if (!companyName) {
      return { success: false, error: { code: 'MISSING_COMPANY', message: 'Nombre de empresa requerido' } };
    }

    const invPath = await _findInvestigacionSubmodulePath(companyName);
    const furatPath = await _findReportesAccidentesSubmodulePath(companyName);

    let furatFolders = [];
    if (furatPath && fs.existsSync(furatPath)) {
      const furatDiscovered = await _discoverInvestigations(furatPath);
      furatFolders = furatDiscovered.map(inv => ({
        name: inv.name,
        relativePath: inv.relativePath,
        fullPath: inv.fullPath,
        isFolder: inv.isFolder,
        hasFurat: inv.hasFurat,
        año: _extractYearFromPath(inv.relativePath),
        mes: _extractMonthFromPath(inv.relativePath)
      }));
    }

    let invFolders = [];
    if (invPath && fs.existsSync(invPath)) {
      const invDiscovered = await _discoverInvestigations(invPath);
      for (const inv of invDiscovered) {
        let estado = 'pendiente';
        let archivos = [];
        if (inv.isFolder) {
          try {
            const folderFiles = await fsp.readdir(inv.fullPath, { withFileTypes: true });
            const fileInfos = folderFiles
              .filter(f => f.isFile())
              .map(f => ({ name: f.name, path: path.join(inv.fullPath, f.name) }));
            const state = _analyzeInvestigationState(inv.name, fileInfos);
            estado = state.estado;
            archivos = fileInfos.map(f => f.name);
          } catch (err) {
            archivos = [];
          }
        } else {
          archivos = inv._filesInMonth || [];
          const looseState = _analyzeLooseFilesState(archivos);
          estado = looseState.estado;
        }
      invFolders.push({
        name: inv.name,
        relativePath: inv.relativePath,
        fullPath: inv.fullPath,
        isFolder: inv.isFolder,
        estado,
        archivos,
        año: _extractYearFromPath(inv.relativePath),
        mes: _extractMonthFromPath(inv.relativePath)
      });
      }
    }

      const matchedInvNames = new Set();
      const matched = [];
      const unmatchedFurats = [];
      const yearMismatchFurats = [];

      for (const furat of furatFolders) {
        const nameCandidates = invFolders.filter(inv => _isSamePerson(furat.name, inv.name));

        if (nameCandidates.length === 0) {
          unmatchedFurats.push({
            nombre: furat.name,
            furatPath: furat.relativePath,
            estado: 'sin_investigacion',
            archivosInvestigacion: [],
            furatYear: furat.año,
            furatMonth: furat.mes
          });
          continue;
        }

        let match = null;
        let matchType = 'exact';

        match = nameCandidates.find(inv =>
          inv.año === furat.año &&
          inv.mes && furat.mes &&
          inv.mes.number === furat.mes.number
        );

        if (!match) {
          match = nameCandidates.find(inv => inv.año === furat.año);
          if (match) matchType = 'partial';
        }

        if (match) {
          matchedInvNames.add(match.name + '|' + match.año);
          matched.push({
            nombre: furat.name,
            furatPath: furat.relativePath,
            investigacionPath: match.relativePath,
            estado: match.estado,
            archivosInvestigacion: match.archivos,
            matchType,
            furatYear: furat.año,
            furatMonth: furat.mes,
            invYear: match.año,
            invMonth: match.mes
          });
        } else {
          yearMismatchFurats.push({
            nombre: furat.name,
            furatPath: furat.relativePath,
            furatYear: furat.año,
            furatMonth: furat.mes,
            existingInvPaths: nameCandidates.map(c => ({
              investigacionPath: c.relativePath,
              invYear: c.año,
              invMonth: c.mes,
              estado: c.estado
            }))
          });
          nameCandidates.forEach(c => matchedInvNames.add(c.name + '|' + c.año));
        }
      }

      const unmatchedInvestigaciones = invFolders.filter(inv => !matchedInvNames.has(inv.name + '|' + inv.año));

      const result = {
        success: true,
        data: {
          furatCount: furatFolders.length,
          investigacionCount: invFolders.length,
          matchedCount: matched.length,
  pendientes: invFolders.filter(i => i.estado === 'pendiente').length,
  completadas: invFolders.filter(i => i.estado === 'completada').length,
          matched,
          unmatchedFurats,
          yearMismatchFurats,
          yearMismatchCount: yearMismatchFurats.length,
          unmatchedInvestigaciones: unmatchedInvestigaciones.map(i => ({
            nombre: i.name,
            investigacionPath: i.relativePath,
            estado: i.estado,
            archivosInvestigacion: i.archivos,
            año: i.año,
            mes: i.mes
          }))
        }
      };

      sendLog(`[XREF] Resultado: ${furatFolders.length} FURATs, ${invFolders.length} investigaciones, ${matched.length} emparejados (${matched.filter(m => m.matchType === 'exact').length} exactos, ${matched.filter(m => m.matchType === 'partial').length} parciales), ${yearMismatchFurats.length} año diferente, ${unmatchedFurats.length} sin investigación, ${unmatchedInvestigaciones.length} inv. sin FURAT`, 'INFO');
    return result;

  } catch (error) {
    sendLog(`[XREF] Error: ${error.message}`, 'ERROR');
    return { success: false, error: { code: 'XREF_ERROR', message: error.message } };
  }
});

// Exportar funciones para inicialización desde el exterior
module.exports = {
  initializeLlmServer,
  checkLlmServerHealth,
  startLlmServer,
  analyzeAccidentViaServer,
  _findInvestigacionSubmodulePath,
  _discoverInvestigations,
  _isSamePerson,
  _analyzeInvestigationState,
  _extractYearFromPath,
  _findReportesAccidentesSubmodulePath
};

// Inicializar servidor automáticamente al cargar el módulo
// Esto permite pre-cargar el modelo en segundo plano
sendLog('[HANDLERS] Iniciando inicialización del módulo...');
initializeLlmServer().then((result) => {
    sendLog(`[HANDLERS] Módulo de handlers inicializado. Resultado: ${result}`);
}).catch(err => {
    sendLog(`[HANDLERS] Error en inicialización: ${err.message}`, 'WARN');
});

